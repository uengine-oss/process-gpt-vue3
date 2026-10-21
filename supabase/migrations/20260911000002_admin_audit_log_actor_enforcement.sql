-- =============================================================================
-- 관리자 감사 로그 actor 위·변조 차단 (docs/security.md 1-3, 항목 16)
--
-- [목표]
--   감사 로그의 "누가(Who)" 는 클라이언트가 아니라 DB 가 결정해야 한다.
--   현재 insertAdminAuditLog (PalModeBackend.ts) 는 localStorage 의
--   employeeNo / email / uid 를 actor_id 로 그대로 보낸다. 브라우저 콘솔에서
--   localStorage 를 바꾸거나 anon 키로 직접 INSERT 하면 다른 사람 이름으로
--   감사 로그를 남길 수 있다.
--
-- [무엇이 바뀌나]
--   - 변경 ① actor_username / actor_org_name / actor_employee_no 컬럼 추가
--            (AuditTrail.vue·ProcessHierarchyProperties.vue 가 이미 읽고 있으나
--             지금까지 아무도 채우지 않아 항상 비어 있던 필드)
--   - 변경 ② BEFORE INSERT 트리거로 로그인 사용자의 INSERT 는 actor_id 를
--            auth.uid() 로 강제 덮어쓴다. 클라이언트가 보낸 값은 버린다.
--   - 변경 ③ actor 이름·조직·사번도 클라이언트 값 대신 public.users 조회 결과로
--            채운다. users 에 행이 없으면 NULL (클라이언트 값을 살리지 않는다).
--
-- [무엇이 안 바뀌나]
--   - 앱 코드 변경 불필요. 클라이언트가 계속 actor_id 를 보내도 무시된다.
--     (actor_id 는 NOT NULL 이므로 미로그인 경로를 위해 클라이언트 fallback 은 유지)
--   - 기존 행은 그대로 둔다. append-only 테이블이라 소급 수정하지 않는다.
--     과거 행의 actor_id 는 예전 형식(사번/이메일)이고, UI 는 actor_username 이
--     비면 actor_id 를 그대로 보여주므로 화면은 깨지지 않는다.
--   - SELECT / INSERT 허용, UPDATE / DELETE 차단 (20260526 마이그레이션) 유지.
--
-- [auth.uid() 가 NULL 인 경우]
--   service_role 키로 도는 서버 작업·마이그레이션·백필에는 세션이 없어
--   auth.uid() 가 NULL 이다. 이때 덮어쓰면 actor_id (NOT NULL) 가 깨지므로
--   클라이언트가 보낸 값을 그대로 둔다.
--   ※ 세션 없는 anon 키 INSERT 도 같은 분기를 타서 값이 유지된다. 이 구멍은
--     "로그인 세션이 있으면 절대 위조 불가" 라는 이 마이그레이션의 보장 범위
--     밖이며, anon INSERT 자체를 막는 것은 RLS 정책 조정(별도 작업) 영역이다.
--
-- [멱등성] ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE FUNCTION /
--          DROP TRIGGER IF EXISTS → CREATE TRIGGER. 재실행 안전.
--
-- [롤백] 파일 하단 주석 참고
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. actor 신원 스냅샷 컬럼
--    감사 로그는 "그 시점의 사실" 을 남기는 테이블이다. users 를 조인해서
--    보여주면 나중에 사용자가 조직 이동·퇴사·삭제됐을 때 과거 기록이 바뀌어
--    버린다. 그래서 INSERT 시점의 이름·조직·사번을 행에 박아둔다(스냅샷).
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS actor_username TEXT;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS actor_org_name TEXT;
ALTER TABLE public.admin_audit_log ADD COLUMN IF NOT EXISTS actor_employee_no TEXT;

COMMENT ON COLUMN public.admin_audit_log.actor_id IS
'수행자 식별자. 로그인 세션이 있으면 트리거가 auth.uid() 로 강제 덮어쓴다 (클라이언트 값 무시).';
COMMENT ON COLUMN public.admin_audit_log.actor_username IS
'INSERT 시점 users.username 스냅샷. 트리거가 채운다 (클라이언트 값 무시).';
COMMENT ON COLUMN public.admin_audit_log.actor_org_name IS
'INSERT 시점 users.org_name(없으면 department_name) 스냅샷. 트리거가 채운다.';
COMMENT ON COLUMN public.admin_audit_log.actor_employee_no IS
'INSERT 시점 users.employee_no 스냅샷. 트리거가 채운다 (클라이언트 값 무시).';

-- ---------------------------------------------------------------------------
-- 2. 트리거 함수
--    SECURITY DEFINER 인 이유: users 에 RLS 가 걸려 있어(20260403000001)
--    호출자 권한으로는 자기 행조차 못 읽는 상황이 생길 수 있다. 함수 소유자
--    권한으로 조회해야 이름·조직·사번을 안정적으로 채울 수 있다.
--    search_path 고정은 SECURITY DEFINER 함수의 필수 안전장치
--    (호출자가 만든 동명 스키마로 테이블이 바꿔치기되는 것을 막는다).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_admin_audit_log_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_username text;
    v_org_name text;
    v_employee_no text;
BEGIN
    -- 세션 없음(service_role 등) → 클라이언트가 보낸 값 유지. 위 헤더 주석 참고.
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    -- ① 수행자 강제: 클라이언트가 무엇을 보냈든 실제 로그인 사용자로 덮어쓴다.
    NEW.actor_id := v_uid::text;

    -- ② 신원 조회: users PK 는 (id, tenant_id) 라 같은 계정이 여러 테넌트에
    --    있을 수 있다. 로그가 기록되는 테넌트의 행을 우선 고르고, 없으면
    --    아무 행이나(ORDER BY 로 우선순위만 부여) 하나 쓴다.
    SELECT u.username,
           COALESCE(u.org_name, u.department_name),
           u.employee_no
      INTO v_username, v_org_name, v_employee_no
      FROM public.users u
     WHERE u.id = v_uid
     ORDER BY (u.tenant_id IS NOT DISTINCT FROM NEW.tenant_id) DESC
     LIMIT 1;

    -- ③ 신원 강제: 조회 결과로만 채운다. users 에 행이 없으면 NULL 로 남긴다.
    --    (클라이언트가 보낸 이름·조직·사번을 살려두면 위조 통로가 된다)
    NEW.actor_username := v_username;
    NEW.actor_org_name := v_org_name;
    NEW.actor_employee_no := v_employee_no;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_admin_audit_log_actor() IS
'admin_audit_log INSERT 시 actor_id 를 auth.uid() 로, actor 이름·조직·사번을 users 조회값으로 강제한다. auth.uid() 가 NULL(service_role)이면 클라이언트 값 유지.';

-- ---------------------------------------------------------------------------
-- 3. 트리거 연결
--    BEFORE INSERT 여야 한다. AFTER 에서는 NEW 를 바꿔도 저장된 행에 반영되지
--    않는다. UPDATE 는 RLS 로 이미 차단돼 있어 INSERT 만 걸면 충분하다.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS enforce_admin_audit_log_actor ON public.admin_audit_log;
CREATE TRIGGER enforce_admin_audit_log_actor
    BEFORE INSERT ON public.admin_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_audit_log_actor();

-- ---------------------------------------------------------------------------
-- 4. 테이블 코멘트 갱신 — 20260526 이 남겨둔 "추후 트리거로 처리 예정" 을 해소
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.admin_audit_log IS
'관리자 감사 로그. append-only (UPDATE/DELETE 차단, 20260526). actor_id·actor_username·actor_org_name·actor_employee_no 는 BEFORE INSERT 트리거가 auth.uid() 와 users 조회값으로 강제 설정한다 (20260911).';

COMMIT;

-- =============================================================================
-- 검증 쿼리 (적용 후 별도 실행)
-- =============================================================================
-- ① 트리거 등록 확인
--    SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgrelid = 'public.admin_audit_log'::regclass AND NOT tgisinternal;
--    → enforce_admin_audit_log_actor / O
--
-- ② 위조 시도 차단 확인 (로그인한 브라우저 세션에서 실행)
--    INSERT INTO admin_audit_log (tenant_id, actor_id, action, target_type)
--    VALUES ('<tenant>', 'ceo@example.com', 'test', 'system');
--    → 저장된 행의 actor_id 는 'ceo@example.com' 이 아니라 본인 auth.uid()
--
-- ③ 신원 채움 확인
--    SELECT actor_id, actor_username, actor_org_name, actor_employee_no
--    FROM admin_audit_log ORDER BY created_at DESC LIMIT 5;
--    → 앱에서 권한 변경 등을 한 번 수행한 뒤 이름/조직/사번이 채워져야 한다.
--      (users 에 org_name·employee_no 가 비어 있으면 해당 칸만 NULL)
--
-- ④ 서비스 롤 경로 확인
--    service_role 키로 INSERT 했을 때 actor_id 가 보낸 값 그대로 남는지.
--
-- 참고: 과거 행은 소급 수정하지 않는다(append-only 원칙). 화면은
--       actor_username 이 비면 actor_id 를 그대로 표시하므로 문제 없다.

-- =============================================================================
-- 롤백 SQL (문제 발생 시)
-- =============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS enforce_admin_audit_log_actor ON public.admin_audit_log;
-- DROP FUNCTION IF EXISTS public.enforce_admin_audit_log_actor();
-- -- 컬럼은 남겨둬도 무해하다. 굳이 되돌리려면:
-- -- ALTER TABLE public.admin_audit_log
-- --     DROP COLUMN IF EXISTS actor_username,
-- --     DROP COLUMN IF EXISTS actor_org_name,
-- --     DROP COLUMN IF EXISTS actor_employee_no;
-- COMMIT;
