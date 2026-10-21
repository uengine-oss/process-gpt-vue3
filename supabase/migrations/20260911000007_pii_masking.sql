-- =============================================================================
-- 개인정보 마스킹 (보안 확인표 항목 6 / docs/security.md 4-1)
--
-- 무엇을 만드는가
--   1. 마스킹 함수 : public.mask_email(), public.mask_phone()
--   2. 판정 함수   : public.pii_visible(uuid) — admin 이상이거나 본인 행이면 원본
--   3. 마스킹 뷰   : public.users_masked, public.pending_org_members_masked,
--                    public.signup_requests_masked, public.admin_requests_masked
--                    모두 `security_invoker = true` 로 만들어 기반 테이블의 RLS 가
--                    호출자 기준으로 그대로 적용된다(뷰 소유자 권한으로 RLS 를
--                    우회하지 않는다).
--
-- 무엇을 아직 하지 않는가
--   원본 컬럼의 REVOKE SELECT. 이유와 단계적 적용 계획은 파일 맨 아래 주석 참고.
--
-- 전화번호
--   2026-09-11 기준 이 스키마에는 전화번호 컬럼이 하나도 없다(users, 조직 관련
--   테이블 전수 확인). mask_phone() 은 함수만 미리 만들어 두고, 뷰 생성기가
--   phone / phone_number / mobile / tel / cell_phone 컬럼을 발견하면 자동으로
--   마스킹 대상에 넣는다. 나중에 컬럼이 추가되면 rebuild_pii_masked_views() 만
--   다시 부르면 된다.
--
-- 재실행 안전(idempotent). PostgreSQL 15+ 필요(security_invoker).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 마스킹 함수
-- -----------------------------------------------------------------------------

-- ab***@domain.com
--   로컬파트 3자 이상 → 앞 2자 + '***'
--   로컬파트 2자      → 앞 1자 + '***'
--   로컬파트 1자      → '***'
--   '@' 가 없으면 전체를 로컬파트로 보고 같은 규칙을 적용한다.
CREATE OR REPLACE FUNCTION public.mask_email(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    v_at     integer;
    v_local  text;
    v_domain text;
BEGIN
    IF p_email IS NULL THEN
        RETURN NULL;
    END IF;

    IF btrim(p_email) = '' THEN
        RETURN p_email;
    END IF;

    v_at := position('@' in p_email);
    IF v_at > 0 THEN
        v_local  := left(p_email, v_at - 1);
        v_domain := substring(p_email from v_at);   -- '@' 포함
    ELSE
        v_local  := p_email;
        v_domain := '';
    END IF;

    IF length(v_local) >= 3 THEN
        RETURN left(v_local, 2) || '***' || v_domain;
    ELSIF length(v_local) = 2 THEN
        RETURN left(v_local, 1) || '***' || v_domain;
    ELSE
        RETURN '***' || v_domain;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.mask_email(text) IS
    '이메일 마스킹: ab***@domain.com 형태. 도메인은 남긴다.';

-- 010-****-1234
--   하이픈 유무, 공백, 괄호, 국가번호(+82) 를 모두 흡수한다.
--   02 로 시작하는 서울 지역번호는 앞 2자리, 그 밖에는 앞 3자리를 남긴다.
--   숫자가 7자리 미만이면 식별이 불가능하므로 전부 가린다.
CREATE OR REPLACE FUNCTION public.mask_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    v_digits text;
    v_prefix text;
BEGIN
    IF p_phone IS NULL THEN
        RETURN NULL;
    END IF;

    IF btrim(p_phone) = '' THEN
        RETURN p_phone;
    END IF;

    v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

    -- +82-10-1234-5678 / 82 10 1234 5678 → 01012345678
    IF left(btrim(p_phone), 1) = '+' AND left(v_digits, 2) = '82' THEN
        v_digits := '0' || substring(v_digits from 3);
    END IF;

    IF length(v_digits) < 7 THEN
        RETURN '****';
    END IF;

    IF left(v_digits, 2) = '02' THEN
        v_prefix := left(v_digits, 2);
    ELSE
        v_prefix := left(v_digits, 3);
    END IF;

    RETURN v_prefix || '-****-' || right(v_digits, 4);
END;
$$;

COMMENT ON FUNCTION public.mask_phone(text) IS
    '전화번호 마스킹: 010-****-1234 형태. 하이픈 유무·+82 국가번호·02 지역번호 대응.';

-- -----------------------------------------------------------------------------
-- 2. 원본 노출 판정
--    admin 이상(has_role_at_least) 이거나 본인 행이면 원본을 그대로 돌려준다.
--    has_role_at_least() 는 SECURITY DEFINER STABLE 이라 뷰 안에서 스칼라
--    서브쿼리(`(SELECT public.pii_admin())`) 로 감싸 쿼리당 한 번만 평가한다.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pii_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(public.has_role_at_least('admin'), false);
$$;

COMMENT ON FUNCTION public.pii_admin() IS
    '현재 요청자가 개인정보 원본을 볼 수 있는 역할(admin 이상)인지.';

CREATE OR REPLACE FUNCTION public.pii_visible(p_subject uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT public.pii_admin()
        OR (p_subject IS NOT NULL AND p_subject = auth.uid());
$$;

COMMENT ON FUNCTION public.pii_visible(uuid) IS
    '개인정보 원본 노출 여부: admin 이상이거나 대상이 본인일 때 true.';

GRANT EXECUTE ON FUNCTION public.mask_email(text)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mask_phone(text)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pii_admin()        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pii_visible(uuid)  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. 마스킹 뷰 생성기
--
--    컬럼을 손으로 나열하지 않는다. users 테이블만 해도 15개 마이그레이션이
--    컬럼을 덧붙여 왔고, 목록을 손으로 적으면 다음에 컬럼이 하나 늘 때마다
--    `select('*')` 를 쓰는 화면에서 값이 조용히 사라진다. information_schema 를
--    읽어 "이메일/전화 컬럼만 바꾸고 나머지는 그대로" 를 생성한다.
--
--    p_owner_col 은 "이 행의 주인" 을 가리키는 uuid 컬럼명이다(본인 행 판정용).
--    없으면 NULL 을 넘긴다 → admin 만 원본을 본다.
--    p_keep_when 은 행 단위로 마스킹을 면제하는 추가 조건식이다(예: 에이전트 행).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rebuild_pii_masked_view(
    p_table     text,
    p_view      text,
    p_owner_col text DEFAULT NULL,
    p_keep_when text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_cols    text;
    v_visible text;
BEGIN
    IF to_regclass(format('public.%I', p_table)) IS NULL THEN
        RAISE NOTICE 'rebuild_pii_masked_view: public.% 가 없어 건너뜁니다', p_table;
        RETURN;
    END IF;

    -- 원본 노출 조건. 스칼라 서브쿼리로 감싸 쿼리당 1회만 평가된다.
    v_visible := '(SELECT public.pii_admin())';
    IF p_owner_col IS NOT NULL THEN
        v_visible := v_visible || format(' OR t.%I = auth.uid()', p_owner_col);
    END IF;
    IF p_keep_when IS NOT NULL THEN
        v_visible := v_visible || ' OR (' || p_keep_when || ')';
    END IF;
    v_visible := '(' || v_visible || ')';

    SELECT string_agg(expr, E',\n    ' ORDER BY ordinal_position)
    INTO v_cols
    FROM (
        SELECT
            c.ordinal_position,
            CASE
                WHEN c.column_name = 'email' THEN
                    format(
                        'CASE WHEN %1$s THEN t.%2$I ELSE public.mask_email(t.%2$I) END AS %2$I',
                        v_visible, c.column_name
                    )
                WHEN c.column_name IN ('phone', 'phone_number', 'mobile', 'mobile_phone', 'tel', 'cell_phone') THEN
                    format(
                        'CASE WHEN %1$s THEN t.%2$I ELSE public.mask_phone(t.%2$I) END AS %2$I',
                        v_visible, c.column_name
                    )
                ELSE format('t.%I', c.column_name)
            END AS expr
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = p_table
    ) s;

    IF v_cols IS NULL THEN
        RAISE NOTICE 'rebuild_pii_masked_view: public.% 의 컬럼을 읽지 못했습니다', p_table;
        RETURN;
    END IF;

    -- 컬럼 구성이 바뀌면 CREATE OR REPLACE VIEW 가 실패하므로 항상 다시 만든다.
    EXECUTE format('DROP VIEW IF EXISTS public.%I', p_view);
    EXECUTE format(
        'CREATE VIEW public.%I WITH (security_invoker = true) AS SELECT %s FROM public.%I t',
        p_view, v_cols, p_table
    );
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated, service_role', p_view);
    EXECUTE format(
        'COMMENT ON VIEW public.%I IS %L',
        p_view,
        format('%s 의 이메일/전화 마스킹 뷰(security_invoker=true). admin 이상%s은 원본. 화면 표시용 조회만 이 뷰를 쓴다 — 이메일을 값으로 쓰는 경로는 원본 테이블을 그대로 쓸 것.',
               p_table,
               CASE WHEN p_owner_col IS NULL THEN '' ELSE '·본인 행' END)
    );
END;
$$;

COMMENT ON FUNCTION public.rebuild_pii_masked_view(text, text, text, text) IS
    '기반 테이블의 현재 컬럼을 읽어 이메일/전화만 마스킹한 security_invoker 뷰를 다시 만든다. 기반 테이블에 컬럼을 추가한 뒤 다시 호출할 것.';

CREATE OR REPLACE FUNCTION public.rebuild_pii_masked_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- users: 에이전트(is_agent) 행의 email 은 사람의 연락처가 아니라 에이전트
    -- 식별자다(채팅 참가자 매칭, 알림 대상). 마스킹하면 기능이 깨지므로 원본 유지.
    PERFORM public.rebuild_pii_masked_view('users',               'users_masked',               'id',      't.is_agent');
    PERFORM public.rebuild_pii_masked_view('pending_org_members', 'pending_org_members_masked', NULL,      NULL);
    PERFORM public.rebuild_pii_masked_view('signup_requests',     'signup_requests_masked',     'user_id', NULL);
    PERFORM public.rebuild_pii_masked_view('admin_requests',      'admin_requests_masked',      'user_id', NULL);
END;
$$;

SELECT public.rebuild_pii_masked_views();

-- -----------------------------------------------------------------------------
-- 4. 마스킹된 목록에서도 깨지면 안 되는 기능용 조회
--
--    조직도 사전등록 화면은 "이미 가입한 이메일인가" 를 사용자 목록을 받아
--    클라이언트에서 비교하고 있었다. 목록이 마스킹되면 이 비교가 조용히 틀린
--    답을 낸다. 존재 여부만 서버에서 판정하는 함수로 옮긴다.
--    (5단계 REVOKE 이후에도 그대로 동작한다.)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tenant_user_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.has_role_at_least('editor')
       AND EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.tenant_id = public.tenant_id()
              AND lower(btrim(u.email)) = lower(btrim(p_email))
       );
$$;

COMMENT ON FUNCTION public.tenant_user_email_exists(text) IS
    '같은 테넌트에 해당 이메일 사용자가 있는지만 반환(editor 이상). 조직도 사전등록 중복 검사용 — 이메일 목록을 내려주지 않는다.';

GRANT EXECUTE ON FUNCTION public.tenant_user_email_exists(text) TO authenticated, service_role;

-- PostgREST 스키마 캐시 갱신 (새 뷰/함수를 바로 쓸 수 있게)
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 5. 원본 컬럼 REVOKE — 이번 마이그레이션에서는 적용하지 않는다
--
-- docs/security.md 4-1 은 "원본 컬럼은 일반 역할에서 REVOKE SELECT 로 숨긴다"
-- 라고 적었다. 지금 그대로 실행하면 화면이 깨진다. 실제 코드를 전수 조사한
-- 결과는 다음과 같다.
--
--   (a) PostgreSQL 의 컬럼 단위 REVOKE 는 `SELECT *` 전체를 거부한다.
--       (`ERROR: permission denied for table users`) 빠지는 컬럼만 비는 것이
--       아니라 쿼리 자체가 실패한다.
--   (b) `from('users').select('*')` / `select()` 를 쓰는 지점이 남아 있다:
--         · src/utils/StorageBaseSupabase.js:449   getUserInfo()
--         · src/utils/StorageBaseSupabase.js:1078  writeUserData() — 로그인 직후
--         · src/utils/StorageBaseSupabase.js  list('users', …) → getUserList()
--           (ProcessGPTBackend.getUserList 가 부르고, 채팅·담당자 지정·알림 등
--            30곳 넘는 화면이 이 목록을 쓴다)
--       이 중 로그인 경로(getUserInfo / writeUserData)는 본인 행만 읽으므로
--       RLS·마스킹 모두 원본이 필요하고, 기능상 마스킹 대상도 아니다.
--   (c) 이메일을 "표시" 가 아니라 "식별자" 로 쓰는 곳이 많다. 담당자 지정,
--       채팅 참가자 매칭, 알림 발송 대상, 결재선 매칭이 모두 이메일 문자열
--       비교다. 컬럼을 막으면 이 기능들이 전부 멈춘다.
--
-- 그래서 2단계로 나눈다.
--
--   1단계(이번 마이그레이션) — 마스킹 뷰를 만들고 "표시용" 조회만 뷰로 옮긴다.
--       원본 테이블 권한은 건드리지 않는다. RLS 는 지금 그대로(users_select_all
--       = USING(true)) 라 이 단계의 마스킹은 화면 노출 축소이지 접근 통제가
--       아니다. 이 점을 분명히 해 둔다.
--
--   2단계(별도 마이그레이션, 예: 2026xxxx_pii_revoke.sql) — 아래 순서로.
--       ① 표시용 조회가 남김없이 뷰로 옮겨졌는지 확인한다. 확인 방법:
--          `grep -rn "from('users')" src/` 결과가 (i) 로그인/세션 경로,
--          (ii) 이메일을 식별자로 쓰는 기능 경로 두 가지만 남아야 한다.
--       ② 기능 경로가 이메일 원본을 정말 필요로 하는지 재검토하고, 가능한
--          것은 user_id(uuid) 기반으로 바꾼다. 남는 것은 SECURITY DEFINER
--          RPC 로 감싸 필요한 값만 돌려준다(예: tenant_user_email_exists).
--       ③ `SELECT *` 를 쓰는 지점을 컬럼 명시로 바꾼다. 이것을 먼저 하지 않으면
--          REVOKE 와 동시에 로그인이 막힌다.
--       ④ 그 다음에야
--              REVOKE SELECT (email) ON public.users FROM authenticated, anon;
--              -- users_masked 는 security_invoker 라 뷰를 통해서도 막힌다.
--              -- 따라서 REVOKE 와 동시에 users_masked 도 못 읽게 된다.
--          여기서 security_invoker 의 대가가 드러난다. 원본 컬럼을 REVOKE 하면
--          같은 권한으로 도는 마스킹 뷰도 함께 막힌다. 그 시점에는
--            · users_masked 만 security_invoker = false 로 바꾸고
--              (뷰 소유자 권한으로 email 을 읽되) 뷰 정의에 RLS 와 같은
--              테넌트 조건(`t.tenant_id = public.tenant_id()`)을 직접 넣거나,
--            · 마스킹된 값을 담은 별도 컬럼/생성 컬럼을 두고 그쪽만 GRANT
--          둘 중 하나를 골라야 한다. 전자는 뷰 정의가 RLS 를 재현해야 하므로
--          그 시점의 users RLS 정책과 반드시 함께 검토한다.
--       ⑤ users RLS 의 `users_select_all USING (true)` 도 함께 좁힌다.
--          지금은 다른 테넌트의 행까지 읽힌다(20260403000001_role_based_rls.sql).
--          마스킹보다 이쪽이 실효가 크다.
--
-- 요약: 이번 마이그레이션은 "표시 경로 마스킹" 까지다. 컬럼 차단은 표시 경로
--       전환 완료 + SELECT * 제거 + RLS 정비가 끝난 뒤 별도 마이그레이션에서.
-- =============================================================================
