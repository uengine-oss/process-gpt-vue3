-- ============================================================================
-- 반복 로그인 실패 시 계정 잠금 (docs/security.md 2-4, 항목 18)
--
-- [목표] 같은 계정에 대해 최근 M분 안에 N회 이상 비밀번호 검증이 실패하면
--        일정 시간 동안 로그인을 차단한다 (크리덴셜 스터핑 / 무차별 대입 방어).
--
-- [동작 지점] GoTrue 의 Password Verification Attempt Hook.
--   GoTrue 는 비밀번호 검증 "직후" 이 함수를 호출하고, 함수가 돌려준 decision 에
--   따라 로그인 성립 여부를 결정한다.
--     입력  event  = { "user_id": <uuid>, "valid": <boolean> }
--     출력  result = { "decision": "continue" | "reject",
--                      "message": <text>,               -- reject 일 때 사용자에게 보일 문구
--                      "should_logout_user": <boolean> } -- 기존 세션까지 끊을지
--   설정(별도 반영):
--     GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED = "true"
--     GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_URI =
--       "pg-functions://postgres/public/hook_password_verification_attempt"
--   → docker-compose/docker-compose.yaml, kubernetes/supabase-deployment.yaml,
--     docker-compose/.env.example, docs/security-gotrue-lockout-policy.md 참고.
--
-- [카운트의 신뢰 원천 — 왜 auth_login_audit 를 쓰지 않는가]
--   `public.auth_login_audit` (20260911000001) 는 브라우저가 로그인 성공/실패 후
--   `record_auth_audit()` RPC 를 호출해 남기는 기록이다. 클라이언트가 호출을
--   생략하거나(스크립트 로그인, 네트워크 오류) 임의 이메일로 위조 호출할 수 있어
--   "잠금" 판단의 근거로 쓰기에는 부적절하다.
--   그래서 이 마이그레이션은 GoTrue 가 서버측에서 직접 호출하는 훅이 기록하는
--   `public.auth_failed_attempts` 를 카운트의 유일한 신뢰 원천으로 둔다.
--   다만 "잠금이 걸린 순간"은 관리자가 로그인 이력 탭에서 같이 보도록
--   auth_login_audit 에도 한 줄(action='login_failed', reason='account_locked') 남긴다
--   (기록 실패가 로그인 흐름을 막지 않도록 예외는 삼킨다).
--
-- [정책 값] public.configuration 의 key = 'login_lockout' 로 테넌트별 오버라이드.
--     { "max_attempts": 5, "window_minutes": 15, "lockout_minutes": 15 }
--   행이 없으면 위 기본값. max_attempts <= 0 이면 잠금 비활성(전부 continue).
--   ※ session_timeout(20260911000010_tenant_session_timeout.sql) 과 같은 자리·같은 방식.
--
-- [fail-open] 훅 안에서 어떤 예외가 나도 decision='continue' 로 돌려준다.
--   잠금 로직의 버그나 일시적 DB 오류가 "전 사용자 로그인 불가" 로 번지면 안 된다.
--
-- [멱등성] CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION /
--          DROP FUNCTION IF EXISTS → CREATE. 재실행 안전.
--
-- [롤백] 파일 하단 주석 참고.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 실패 카운터 테이블 (훅 전용 — 서버측 신뢰 원천)
--
--    auth.users 로의 FK 는 걸지 않는다. auth 스키마는 GoTrue 가 소유하고 마이그레이션
--    순서/권한이 환경마다 달라, FK 하나 때문에 이 마이그레이션이 통째로 실패하는
--    상황을 피한다. 사용자가 삭제되면 고아 행이 남지만 조회 RPC 가 걸러낸다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_failed_attempts (
    -- auth.users.id. 훅이 주는 유일한 식별자이며, 이메일과 달리 위조될 수 없다.
    user_id         uuid PRIMARY KEY,

    -- 표시용 스냅샷 (auth.users 조회 결과). 판단에는 쓰지 않는다.
    email           text NULL,

    -- 현재 윈도우 안에서 누적된 연속 실패 횟수
    failed_count    integer NOT NULL DEFAULT 0,

    -- 현재 윈도우의 첫 실패 / 마지막 실패 시각
    first_failed_at timestamptz NULL,
    last_failed_at  timestamptz NULL,

    -- 잠금 해제 예정 시각. NULL 이거나 과거면 잠금 아님.
    locked_until    timestamptz NULL,

    -- 마지막으로 잠금이 걸린 시각 (관리자 화면 "잠금 시각")
    locked_at       timestamptz NULL,

    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 예전 버전 테이블 대비 (컬럼 누락 보정)
ALTER TABLE public.auth_failed_attempts ADD COLUMN IF NOT EXISTS email           text NULL;
ALTER TABLE public.auth_failed_attempts ADD COLUMN IF NOT EXISTS first_failed_at timestamptz NULL;
ALTER TABLE public.auth_failed_attempts ADD COLUMN IF NOT EXISTS locked_at       timestamptz NULL;

-- 잠긴 계정 목록 조회용 (관리자 화면의 기본 질의)
CREATE INDEX IF NOT EXISTS idx_auth_failed_attempts_locked_until
    ON public.auth_failed_attempts (locked_until DESC)
    WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_failed_attempts_email
    ON public.auth_failed_attempts (email);

COMMENT ON TABLE public.auth_failed_attempts IS
'로그인 실패 카운터. GoTrue password_verification_attempt 훅만 기록한다(서버측 신뢰 원천). 클라이언트 직접 접근 불가 — 조회/해제는 admin_list_locked_accounts() / admin_unlock_account() RPC 로만.';
COMMENT ON COLUMN public.auth_failed_attempts.user_id IS 'auth.users.id. 훅 입력의 user_id (위조 불가). FK 는 일부러 걸지 않는다.';
COMMENT ON COLUMN public.auth_failed_attempts.locked_until IS '이 시각까지 로그인 차단. NULL 또는 과거이면 잠금 아님.';

-- RLS: 클라이언트(anon/authenticated)에게는 아예 열지 않는다.
-- 정책을 하나도 만들지 않으므로 ENABLE 만으로 전면 차단이며, GRANT 도 주지 않는다.
-- 접근은 전부 SECURITY DEFINER RPC 를 통한다.
ALTER TABLE public.auth_failed_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_failed_attempts FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. 정책 값 조회 — public.configuration 의 'login_lockout' 키
--
--    훅은 JWT 없이 도는 컨텍스트라 public.tenant_id() 가 NULL 이다.
--    그래서 테넌트를 파라미터로 받고, 다음 우선순위로 해석한다.
--      ① 해당 테넌트의 login_lockout 행
--      ② tenant_id 가 NULL 인 전역 login_lockout 행
--      ③ 코드 기본값 (5회 / 15분 윈도우 / 15분 잠금)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.login_lockout_policy(p_tenant_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_value jsonb;
BEGIN
    SELECT c.value INTO v_value
    FROM public.configuration c
    WHERE c.key = 'login_lockout'
      AND (
            (p_tenant_id IS NOT NULL AND c.tenant_id = p_tenant_id)
         OR c.tenant_id IS NULL
      )
    -- 테넌트 지정 행을 전역 행보다 우선
    ORDER BY (c.tenant_id IS NULL)
    LIMIT 1;

    RETURN jsonb_build_object(
        'max_attempts',    GREATEST(COALESCE((v_value->>'max_attempts')::int, 5), 0),
        'window_minutes',  GREATEST(COALESCE((v_value->>'window_minutes')::int, 15), 1),
        'lockout_minutes', GREATEST(COALESCE((v_value->>'lockout_minutes')::int, 15), 1)
    );
EXCEPTION WHEN OTHERS THEN
    -- 설정 파싱 실패도 기본값으로 흡수 (보안 기능이 설정 오타로 꺼지지 않게)
    RETURN jsonb_build_object('max_attempts', 5, 'window_minutes', 15, 'lockout_minutes', 15);
END;
$$;

COMMENT ON FUNCTION public.login_lockout_policy(text) IS
'로그인 잠금 정책 값. public.configuration key=''login_lockout'' (테넌트 행 → 전역 행 → 기본값 5회/15분/15분).';

REVOKE ALL ON FUNCTION public.login_lockout_policy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_lockout_policy(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. GoTrue Password Verification Attempt Hook
--
--    SECURITY DEFINER 인 이유: 훅은 supabase_auth_admin 권한으로 실행되는데,
--    이 함수는 public.users / public.configuration / public.auth_login_audit 등
--    RLS 가 걸린 public 테이블을 읽고 써야 한다. 소유자(postgres) 권한으로 돌리는
--    편이 권한 표를 늘리지 않으면서 확실하다. 대신 EXECUTE 는
--    supabase_auth_admin 에게만 준다 (아래 5번).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hook_password_verification_attempt(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id       uuid;
    v_valid         boolean;
    v_email         text;
    v_tenant_id     text;
    v_policy        jsonb;
    v_max_attempts  int;
    v_window        interval;
    v_lockout       interval;
    v_row           public.auth_failed_attempts%ROWTYPE;
    v_count         int;
    v_now           timestamptz := now();
    v_locked_until  timestamptz;
    v_message       text;
BEGIN
    v_user_id := NULLIF(event->>'user_id', '')::uuid;
    v_valid   := COALESCE((event->>'valid')::boolean, false);

    -- 사용자를 특정할 수 없으면 판단하지 않는다 (미가입 이메일 등은 GoTrue 가 이미 거절).
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('decision', 'continue');
    END IF;

    -- 표시용 이메일과 정책 판단용 테넌트. auth.users 가 없거나 못 읽어도 진행한다.
    BEGIN
        SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
        v_email := NULL;
    END;

    BEGIN
        SELECT pu.tenant_id INTO v_tenant_id
        FROM public.users pu
        WHERE pu.id = v_user_id
        ORDER BY pu.tenant_id
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_tenant_id := NULL;
    END;

    v_policy       := public.login_lockout_policy(v_tenant_id);
    v_max_attempts := (v_policy->>'max_attempts')::int;
    v_window       := make_interval(mins => (v_policy->>'window_minutes')::int);
    v_lockout      := make_interval(mins => (v_policy->>'lockout_minutes')::int);

    -- max_attempts = 0 → 잠금 비활성. 카운트도 남기지 않는다.
    IF v_max_attempts <= 0 THEN
        RETURN jsonb_build_object('decision', 'continue');
    END IF;

    v_message := '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';

    SELECT * INTO v_row FROM public.auth_failed_attempts WHERE user_id = v_user_id FOR UPDATE;

    -- ── (a) 이미 잠긴 상태: 비밀번호가 맞아도 거절한다.
    --     잠금 시간은 연장하지 않는다 — 계속 두드리는 것만으로 영구 잠금이 되면
    --     정상 사용자가 영원히 못 들어온다.
    IF v_row.user_id IS NOT NULL AND v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
        RETURN jsonb_build_object(
            'decision', 'reject',
            'message', v_message,
            'should_logout_user', false
        );
    END IF;

    -- ── (b) 성공: 카운터 초기화 후 통과
    IF v_valid THEN
        IF v_row.user_id IS NOT NULL THEN
            UPDATE public.auth_failed_attempts
               SET failed_count = 0,
                   first_failed_at = NULL,
                   last_failed_at = NULL,
                   locked_until = NULL,
                   locked_at = NULL,
                   email = COALESCE(v_email, email),
                   updated_at = v_now
             WHERE user_id = v_user_id;
        END IF;
        RETURN jsonb_build_object('decision', 'continue');
    END IF;

    -- ── (c) 실패: 윈도우 안이면 누적, 벗어났으면 1부터 다시
    IF v_row.user_id IS NOT NULL
       AND v_row.last_failed_at IS NOT NULL
       AND v_row.last_failed_at > v_now - v_window THEN
        v_count := COALESCE(v_row.failed_count, 0) + 1;
    ELSE
        v_count := 1;
    END IF;

    IF v_count >= v_max_attempts THEN
        v_locked_until := v_now + v_lockout;
    ELSE
        v_locked_until := NULL;
    END IF;

    INSERT INTO public.auth_failed_attempts AS a (
        user_id, email, failed_count, first_failed_at, last_failed_at,
        locked_until, locked_at, updated_at
    ) VALUES (
        v_user_id, v_email, v_count,
        CASE WHEN v_count = 1 THEN v_now ELSE COALESCE(v_row.first_failed_at, v_now) END,
        v_now,
        v_locked_until,
        CASE WHEN v_locked_until IS NOT NULL THEN v_now ELSE NULL END,
        v_now
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email           = COALESCE(EXCLUDED.email, a.email),
        failed_count    = EXCLUDED.failed_count,
        first_failed_at = EXCLUDED.first_failed_at,
        last_failed_at  = EXCLUDED.last_failed_at,
        locked_until    = EXCLUDED.locked_until,
        locked_at       = COALESCE(EXCLUDED.locked_at, a.locked_at),
        updated_at      = EXCLUDED.updated_at;

    IF v_locked_until IS NOT NULL THEN
        -- 관리자 화면(로그인 이력 탭)에서 잠금 발생을 볼 수 있게 감사 로그에도 한 줄.
        -- 판단 근거가 아니라 "보이기" 용도이므로 실패해도 무시한다.
        BEGIN
            INSERT INTO public.auth_login_audit (
                tenant_id, email, action, success, error_message, user_id, metadata
            ) VALUES (
                v_tenant_id, v_email, 'login_failed', false,
                'account locked after repeated failures', v_user_id,
                jsonb_build_object(
                    'reason', 'account_locked',
                    'source', 'password_verification_hook',
                    'failed_count', v_count,
                    'locked_until', v_locked_until
                )
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        RETURN jsonb_build_object(
            'decision', 'reject',
            'message', v_message,
            'should_logout_user', false
        );
    END IF;

    -- 아직 임계치 미만 — GoTrue 가 평소대로 "잘못된 비밀번호" 로 응답하게 둔다.
    RETURN jsonb_build_object('decision', 'continue');

EXCEPTION WHEN OTHERS THEN
    -- fail-open. 훅의 오류가 전 사용자 로그인 차단으로 번지면 안 된다.
    RAISE WARNING 'hook_password_verification_attempt failed: %', SQLERRM;
    RETURN jsonb_build_object('decision', 'continue');
END;
$$;

COMMENT ON FUNCTION public.hook_password_verification_attempt(jsonb) IS
'GoTrue Password Verification Attempt Hook. 최근 window_minutes 안에 max_attempts 회 실패하면 lockout_minutes 동안 거절한다. 정책은 public.configuration key=login_lockout. 오류 시 fail-open(continue).';

-- ---------------------------------------------------------------------------
-- 4. 잠금 상태 조회 / 해제
-- ---------------------------------------------------------------------------

-- (4-1) DB 점검용 뷰. PostgREST 로는 노출하지 않는다 (GRANT 없음).
CREATE OR REPLACE VIEW public.locked_accounts AS
SELECT
    a.user_id,
    a.email,
    a.failed_count,
    a.first_failed_at,
    a.last_failed_at,
    a.locked_at,
    a.locked_until
FROM public.auth_failed_attempts a
WHERE a.locked_until IS NOT NULL
  AND a.locked_until > now();

COMMENT ON VIEW public.locked_accounts IS
'현재 잠긴 계정. psql 점검용 — 앱에서는 admin_list_locked_accounts() RPC 를 쓴다(테넌트/권한 필터 포함).';

REVOKE ALL ON public.locked_accounts FROM anon, authenticated, PUBLIC;

-- (4-2) 관리자 판정 헬퍼 (이 파일 안에서만 쓴다)
--   레포 표준 조합: current_user_role()/has_role_at_least('admin') 에
--   JWT 클레임이 없어 헬퍼가 판정 못 하는 경우를 대비한 users 직접 조회를 OR 로 둔다.
--   (20260911000001_auth_audit_log.sql 의 SELECT 정책과 같은 패턴)
CREATE OR REPLACE FUNCTION public.is_lockout_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        public.current_user_role() = 'admin'
        OR public.has_role_at_least('admin')
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
        ),
        false
    );
$$;

COMMENT ON FUNCTION public.is_lockout_admin() IS
'계정 잠금 조회/해제 권한 판정. current_user_role()/has_role_at_least(admin) + users.is_admin 폴백.';

REVOKE ALL ON FUNCTION public.is_lockout_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_lockout_admin() TO authenticated;

-- (4-3) 잠긴 계정 목록 RPC — 관리자 전용, 같은 테넌트만
DROP FUNCTION IF EXISTS public.admin_list_locked_accounts();

CREATE FUNCTION public.admin_list_locked_accounts()
RETURNS TABLE (
    user_id         uuid,
    email           text,
    username        text,
    failed_count    integer,
    first_failed_at timestamptz,
    last_failed_at  timestamptz,
    locked_at       timestamptz,
    locked_until    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant text := public.tenant_id();
BEGIN
    IF NOT public.is_lockout_admin() THEN
        RAISE EXCEPTION '권한이 없습니다.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        a.user_id,
        COALESCE(u.email, a.email) AS email,
        u.username,
        a.failed_count,
        a.first_failed_at,
        a.last_failed_at,
        a.locked_at,
        a.locked_until
    FROM public.auth_failed_attempts a
    -- 같은 테넌트의 사용자만. users 에 행이 없는 고아 기록은 노출하지 않는다
    -- (다른 테넌트 사용자의 이메일이 새어 나갈 수 있다).
    JOIN public.users u
      ON u.id = a.user_id
     AND u.tenant_id = COALESCE(v_tenant, u.tenant_id)
    WHERE a.locked_until IS NOT NULL
      AND a.locked_until > now()
    ORDER BY a.locked_until DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_list_locked_accounts() IS
'현재 잠긴 계정 목록(같은 테넌트). 관리자만 호출 가능.';

REVOKE ALL ON FUNCTION public.admin_list_locked_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_locked_accounts() TO authenticated;

-- (4-4) 잠금 해제 RPC — 이메일 또는 user_id 중 하나로 지정
DROP FUNCTION IF EXISTS public.admin_unlock_account(text, uuid);

CREATE FUNCTION public.admin_unlock_account(
    p_email text DEFAULT NULL,
    p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant  text := public.tenant_id();
    v_uid     uuid := p_user_id;
    v_email   text := NULLIF(btrim(COALESCE(p_email, '')), '');
    v_found   int  := 0;
BEGIN
    IF NOT public.is_lockout_admin() THEN
        RAISE EXCEPTION '권한이 없습니다.' USING ERRCODE = '42501';
    END IF;

    IF v_uid IS NULL AND v_email IS NULL THEN
        RAISE EXCEPTION '이메일 또는 사용자 ID 가 필요합니다.' USING ERRCODE = '22023';
    END IF;

    -- 이메일로 온 경우 같은 테넌트 안에서만 사용자를 찾는다 (타 테넌트 계정 해제 방지)
    IF v_uid IS NULL THEN
        SELECT u.id INTO v_uid
        FROM public.users u
        WHERE lower(u.email) = lower(v_email)
          AND u.tenant_id = COALESCE(v_tenant, u.tenant_id)
        LIMIT 1;

        IF v_uid IS NULL THEN
            -- users 에 없으면 카운터 테이블의 스냅샷 이메일로 한 번 더
            SELECT a.user_id INTO v_uid
            FROM public.auth_failed_attempts a
            WHERE lower(a.email) = lower(v_email)
            LIMIT 1;
        END IF;
    ELSE
        -- user_id 로 온 경우도 같은 테넌트 소속인지 확인
        IF v_tenant IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.tenant_id = v_tenant
        ) THEN
            RAISE EXCEPTION '다른 테넌트의 계정은 해제할 수 없습니다.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_uid IS NULL THEN
        RAISE EXCEPTION '대상 계정을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
    END IF;

    -- 표시용 이메일 보강 (감사 로그 target_name). 못 찾으면 파라미터 값을 그대로 둔다.
    IF v_email IS NULL THEN
        SELECT a.email INTO v_email FROM public.auth_failed_attempts a WHERE a.user_id = v_uid;
    END IF;
    IF v_email IS NULL THEN
        SELECT u.email INTO v_email FROM public.users u WHERE u.id = v_uid LIMIT 1;
    END IF;

    -- 카운터를 지운다 (0 으로 되돌리는 것과 동일하되 행을 남기지 않는다)
    DELETE FROM public.auth_failed_attempts WHERE user_id = v_uid;
    GET DIAGNOSTICS v_found = ROW_COUNT;

    -- 관리자 행위 기록. actor_id 는 20260911000002_admin_audit_log_actor_enforcement 의
    -- 트리거가 auth.uid() 로 강제 덮어쓴다.
    BEGIN
        INSERT INTO public.admin_audit_log (
            tenant_id, actor_id, action, target_type, target_id, target_name, comment
        ) VALUES (
            COALESCE(v_tenant, 'process-gpt'),
            COALESCE(auth.uid()::text, 'system'),
            'account_unlock',
            'user',
            v_uid::text,
            v_email,
            '로그인 반복 실패 잠금 해제'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'admin_unlock_account audit failed: %', SQLERRM;
    END;

    RETURN jsonb_build_object('unlocked', v_found > 0, 'user_id', v_uid, 'email', v_email);
END;
$$;

COMMENT ON FUNCTION public.admin_unlock_account(text, uuid) IS
'계정 잠금 해제(실패 카운터 삭제). 관리자만, 같은 테넌트 계정만. admin_audit_log 에 action=account_unlock 기록.';

REVOKE ALL ON FUNCTION public.admin_unlock_account(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unlock_account(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. GoTrue(supabase_auth_admin) 권한 — Supabase 훅 표준 보일러플레이트
--
--    훅 함수는 supabase_auth_admin 역할로 호출된다. 그 역할만 EXECUTE 할 수 있게
--    하고 나머지에서는 회수한다. supabase_auth_admin 이 없는 환경(순수 Postgres
--    테스트 컨테이너 등)에서도 마이그레이션이 깨지지 않도록 존재 여부로 감싼다.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.hook_password_verification_attempt(jsonb) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA public TO supabase_auth_admin';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.hook_password_verification_attempt(jsonb) TO supabase_auth_admin';
        -- SECURITY DEFINER 라 아래 테이블 권한이 꼭 필요하지는 않지만,
        -- Supabase 문서 권장 구성과 맞춰 두어 나중에 DEFINER 를 떼도 동작하게 한다.
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_failed_attempts TO supabase_auth_admin';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- 검증 쿼리 (적용 후 별도 실행)
-- ============================================================================
-- ① 정책 확인:   SELECT public.login_lockout_policy('process-gpt');
--                → {"max_attempts": 5, "window_minutes": 15, "lockout_minutes": 15}
-- ② 실패 5회:    SELECT public.hook_password_verification_attempt(
--                    jsonb_build_object('user_id', '<uuid>', 'valid', false));
--                → 1~4회 {"decision":"continue"}, 5회째 {"decision":"reject", ...}
-- ③ 잠금 목록:   SELECT * FROM public.locked_accounts;
-- ④ 해제:        SELECT public.admin_unlock_account('user@example.com');
-- ⑤ 정책 변경:   INSERT INTO public.configuration (tenant_id, key, value)
--                VALUES ('<tenant>', 'login_lockout',
--                        '{"max_attempts":10,"window_minutes":30,"lockout_minutes":30}'::jsonb)
--                ON CONFLICT (tenant_id, key) DO UPDATE SET value = excluded.value;
-- ⑥ 잠금 끄기:   value 를 '{"max_attempts":0}'::jsonb 로 둔다.
-- ============================================================================
-- 롤백
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.admin_unlock_account(text, uuid);
-- DROP FUNCTION IF EXISTS public.admin_list_locked_accounts();
-- DROP FUNCTION IF EXISTS public.is_lockout_admin();
-- DROP VIEW IF EXISTS public.locked_accounts;
-- DROP FUNCTION IF EXISTS public.hook_password_verification_attempt(jsonb);
-- DROP FUNCTION IF EXISTS public.login_lockout_policy(text);
-- DROP TABLE IF EXISTS public.auth_failed_attempts;
-- COMMIT;
-- ※ GoTrue 의 GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED 를 먼저 false 로
--   내린 뒤 롤백한다 (훅 함수가 없으면 GoTrue 가 로그인 요청을 실패 처리한다).
