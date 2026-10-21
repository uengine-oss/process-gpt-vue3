-- ============================================================================
-- 로그인/로그아웃/로그인 실패 감사 로그 (auth_login_audit)
--
-- [목표] 보안 확인표 항목 14 — "누가 언제 어디서 로그인/로그아웃했고, 실패했는가"
--        를 남긴다. 실패한 로그인(비밀번호 오류, 미가입 이메일 등)도 기록 대상.
--
-- [설계 요약]
--   · 기록은 항상 SECURITY DEFINER RPC `public.record_auth_audit()` 를 통해서만.
--     로그인 "전"(anon 상태)에도 호출돼야 하므로 anon 에게도 EXECUTE 를 준다.
--   · IP / User-Agent 는 클라이언트가 보내는 값을 믿지 않고 PostgREST 가 넘겨주는
--     `request.headers` 에서 서버측으로 직접 뽑는다.
--   · 조회(SELECT)는 관리자만. (20260403_admin_audit_log / 20260521_menu_role_overrides
--     의 admin 판정 패턴과 동일하게 users.is_admin 또는 role in (admin, superadmin))
--   · append-only. UPDATE/DELETE 는 정책 미선언 + REVOKE 로 이중 차단
--     (20260526_admin_audit_log_append_only.sql 과 동일한 방식).
--
-- [이 파일의 출처] 기존 `supabase/migrations/auth_audit_log.sql` (날짜 접두어가
--   없어 `supabase db reset` 적용 대상이 아니었음)을 정식 마이그레이션으로 편입하며
--   아래를 보완했다.
--     ① action 에 'login_failed' 허용 (실패를 별도 액션으로도 남길 수 있게)
--     ② tenants FK 제거 — 감사 기록이 테넌트 참조 무결성 때문에 실패하거나
--        테넌트 삭제로 소급 NULL 처리되면 안 된다 (미등록 테넌트의 로그인 시도도 기록)
--     ③ metadata 에 요청 헤더 전체를 넣던 부분 제거 — authorization/apikey 등
--        토큰이 감사 테이블에 평문 저장되는 문제. 안전한 헤더만 선별 저장
--     ④ 직접 INSERT 는 authenticated 가 "자기 기록"만 가능하도록 축소, anon 은 RPC 전용
--     ⑤ 재실행 안전(idempotent) — 이미 예전 파일을 수동 적용한 DB 에서도 그대로 통과
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_login_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),

    -- 로그인 전 시도라 테넌트를 모를 수 있으므로 NULL 허용 (FK 없음)
    tenant_id text NULL,

    -- 시도한 계정. OAuth 시작 시점처럼 알 수 없으면 NULL
    email text NULL,

    -- login / login_failed / logout / login_oauth
    action text NOT NULL,

    -- 성공 여부
    success boolean NOT NULL,

    -- 실패 사유
    error_message text NULL,

    -- auth.users.id — 인증된 요청에서만 채워진다 (실패 로그인은 NULL)
    user_id uuid NULL,

    -- 서버측에서 캡처한 클라이언트 정보
    ip_address text NULL,
    user_agent text NULL,

    -- provider(keycloak 등), method(password), reason, origin/referer 등 부가 정보
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 예전 파일을 이미 적용한 DB 대비 (컬럼 누락 보정)
ALTER TABLE public.auth_login_audit ADD COLUMN IF NOT EXISTS tenant_id     text NULL;
ALTER TABLE public.auth_login_audit ADD COLUMN IF NOT EXISTS email         text NULL;
ALTER TABLE public.auth_login_audit ADD COLUMN IF NOT EXISTS error_message text NULL;
ALTER TABLE public.auth_login_audit ADD COLUMN IF NOT EXISTS user_id       uuid NULL;
ALTER TABLE public.auth_login_audit ADD COLUMN IF NOT EXISTS ip_address    text NULL;
ALTER TABLE public.auth_login_audit ADD COLUMN IF NOT EXISTS user_agent    text NULL;
ALTER TABLE public.auth_login_audit ADD COLUMN IF NOT EXISTS metadata      jsonb NOT NULL DEFAULT '{}'::jsonb;

-- tenants FK 는 사용하지 않는다 (위 설계 ② 참고)
ALTER TABLE public.auth_login_audit DROP CONSTRAINT IF EXISTS auth_login_audit_tenant_fkey;

-- action 허용값 재정의 (재실행 안전하도록 항상 DROP 후 ADD)
ALTER TABLE public.auth_login_audit DROP CONSTRAINT IF EXISTS auth_login_audit_action_check;
ALTER TABLE public.auth_login_audit
    ADD CONSTRAINT auth_login_audit_action_check
    CHECK (action IN ('login', 'login_failed', 'logout', 'login_oauth'));

-- ---------------------------------------------------------------------------
-- 2. 인덱스 — 관리자 조회 화면(1-2)의 기본 정렬/필터 기준
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_created_at
    ON public.auth_login_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_tenant_created_at
    ON public.auth_login_audit (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_email_created_at
    ON public.auth_login_audit (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_user_created_at
    ON public.auth_login_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_action_created_at
    ON public.auth_login_audit (action, created_at DESC);
-- 반복 실패 탐지(2단계 계정 잠금)에서 쓸 인덱스
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_failed_email_created_at
    ON public.auth_login_audit (email, created_at DESC)
    WHERE success = false;

COMMENT ON TABLE public.auth_login_audit IS
'로그인/로그아웃/로그인 실패 감사 로그. append-only (UPDATE/DELETE 차단). 기록은 public.record_auth_audit() RPC 로만, 조회는 관리자만.';
COMMENT ON COLUMN public.auth_login_audit.action IS 'login | login_failed | logout | login_oauth';
COMMENT ON COLUMN public.auth_login_audit.ip_address IS 'PostgREST request.headers 의 x-forwarded-for/x-real-ip 에서 서버측 캡처 (클라이언트 입력 아님)';
COMMENT ON COLUMN public.auth_login_audit.metadata IS 'provider/method/reason 등 부가 정보. 인증 헤더는 저장하지 않는다.';

-- ---------------------------------------------------------------------------
-- 3. RLS
--    ENABLE 하는 순간 정책 없는 동작은 전부 차단된다. 필요한 것만 다시 연다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_login_audit ENABLE ROW LEVEL SECURITY;

-- 예전 파일이 만든 정책 + 이 파일의 정책 정리 (재실행 안전)
DROP POLICY IF EXISTS "auth_login_audit_insert_anon"          ON public.auth_login_audit;
DROP POLICY IF EXISTS "auth_login_audit_insert_authenticated" ON public.auth_login_audit;
DROP POLICY IF EXISTS "auth_login_audit_insert_self"          ON public.auth_login_audit;
DROP POLICY IF EXISTS "auth_login_audit_select_admin"         ON public.auth_login_audit;

-- (3-1) INSERT — 로그인한 사용자는 "자기 기록"만 직접 넣을 수 있다.
--       anon 은 직접 INSERT 불가(위조 방지). 로그인 전 기록은 RPC 를 통한다.
CREATE POLICY "auth_login_audit_insert_self" ON public.auth_login_audit
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- (3-2) SELECT — 관리자만.
--       · 관리자 판정은 레포 표준 헬퍼 public.current_user_role() (SECURITY DEFINER,
--         20260403000001_role_based_rls / 20260908000001_membership_approvals)을 쓰고,
--         JWT 에 tenant 클레임이 없어 헬퍼가 판정하지 못하는 경우를 위해
--         users 테이블 직접 조회를 OR 로 함께 둔다.
--       · 테넌트가 확정된 행은 같은 테넌트 관리자만, 테넌트 미상(미가입 이메일의
--         로그인 실패 등) 행은 관리자면 볼 수 있게 한다.
CREATE POLICY "auth_login_audit_select_admin" ON public.auth_login_audit
    FOR SELECT TO authenticated
    USING (
        (auth_login_audit.tenant_id IS NULL OR auth_login_audit.tenant_id = public.tenant_id()
         OR EXISTS (
             SELECT 1 FROM public.users u
             WHERE u.id = auth.uid() AND u.tenant_id = auth_login_audit.tenant_id
         ))
        AND (
            public.current_user_role() = 'admin'
            OR EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
            )
        )
    );

-- (3-3) UPDATE / DELETE — 정책을 만들지 않는다 = 차단 (append-only)

-- ---------------------------------------------------------------------------
-- 4. GRANT / REVOKE — RLS 와 별개인 두 번째 안전망
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.auth_login_audit FROM anon, authenticated, PUBLIC;
GRANT INSERT ON public.auth_login_audit TO authenticated;   -- 정책상 자기 기록만
GRANT SELECT ON public.auth_login_audit TO authenticated;   -- 정책상 관리자만

-- ---------------------------------------------------------------------------
-- 5. 기록 RPC — 로그인 전(anon)에도 호출 가능해야 하므로 SECURITY DEFINER
--    · IP / User-Agent 는 파라미터로 받지 않는다 (클라이언트 위조 차단)
--    · 어떤 이유로도 예외를 밖으로 던지지 않는다 — 감사 기록 실패가
--      로그인 흐름을 깨면 안 된다 (클라이언트도 try/catch 하지만 이중 방어)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_auth_audit(text, text, boolean, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.record_auth_audit(
    p_action text,
    p_email text,
    p_success boolean,
    p_error_message text DEFAULT NULL,
    p_tenant_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_action    text;
    v_tenant_id text;
    v_headers   jsonb;
    v_agent     text;
    v_ip        text;
    v_meta      jsonb;
BEGIN
    v_action := lower(btrim(COALESCE(p_action, '')));
    IF v_action NOT IN ('login', 'login_failed', 'logout', 'login_oauth') THEN
        -- 알 수 없는 액션은 조용히 버린다 (예외를 던지면 로그인 흐름이 흔들린다)
        RETURN;
    END IF;

    -- tenant_id: 명시 파라미터(로그인 전) 우선, 없으면 JWT 클레임에서
    v_tenant_id := NULLIF(btrim(COALESCE(p_tenant_id, public.tenant_id(), '')), '');

    -- PostgREST 가 넣어주는 요청 헤더. 실행 컨텍스트에 따라 없을 수 있다.
    BEGIN
        v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    v_agent := left(btrim(COALESCE(v_headers->>'user-agent', '')), 1000);

    IF v_headers ? 'x-forwarded-for' THEN
        v_ip := btrim(split_part(v_headers->>'x-forwarded-for', ',', 1));
    ELSIF v_headers ? 'x-real-ip' THEN
        v_ip := btrim(v_headers->>'x-real-ip');
    ELSE
        v_ip := NULL;
    END IF;

    -- 헤더 전체를 넣지 않는다 (authorization/apikey 등 토큰 저장 방지).
    -- 추적에 쓸 만한 안전한 헤더만 골라 담는다.
    v_meta := COALESCE(p_metadata, '{}'::jsonb);
    IF v_headers IS NOT NULL THEN
        v_meta := v_meta || jsonb_strip_nulls(jsonb_build_object(
            'origin',  v_headers->>'origin',
            'referer', v_headers->>'referer',
            'host',    v_headers->>'host'
        ));
    END IF;

    INSERT INTO public.auth_login_audit (
        tenant_id, email, action, success, error_message,
        user_id, ip_address, user_agent, metadata
    ) VALUES (
        v_tenant_id,
        NULLIF(btrim(COALESCE(p_email, '')), ''),
        v_action,
        COALESCE(p_success, false),
        left(NULLIF(btrim(COALESCE(p_error_message, '')), ''), 2000),
        auth.uid(),
        NULLIF(v_ip, ''),
        NULLIF(v_agent, ''),
        v_meta
    );
EXCEPTION WHEN OTHERS THEN
    -- 기록 실패가 로그인/로그아웃을 막지 않도록 삼킨다.
    RAISE WARNING 'record_auth_audit failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.record_auth_audit(text, text, boolean, text, text, jsonb) IS
'로그인/로그아웃/실패 감사 기록. anon(로그인 전)도 호출 가능. IP/User-Agent 는 서버측 헤더에서 캡처한다.';

REVOKE ALL ON FUNCTION public.record_auth_audit(text, text, boolean, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_auth_audit(text, text, boolean, text, text, jsonb) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (적용 후 별도 실행)
-- ============================================================================
-- ① RLS 활성화:  SELECT relname, relrowsecurity FROM pg_class WHERE relname='auth_login_audit';
-- ② 정책 2개:    SELECT polname, polcmd FROM pg_policy WHERE polrelid='public.auth_login_audit'::regclass;
--                → auth_login_audit_insert_self / a, auth_login_audit_select_admin / r
-- ③ 기록 동작:   SELECT public.record_auth_audit('login_failed','a@b.com',false,'wrong password','process-gpt','{"method":"password"}');
--                SELECT created_at, email, action, success, error_message, ip_address FROM public.auth_login_audit ORDER BY created_at DESC LIMIT 5;
-- ④ 변조 차단:   UPDATE public.auth_login_audit SET email='x'; → 0 rows / 권한 오류면 정상
-- ============================================================================
-- 롤백
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.record_auth_audit(text, text, boolean, text, text, jsonb);
-- DROP TABLE IF EXISTS public.auth_login_audit;
-- COMMIT;
