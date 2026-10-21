-- =============================================================================
-- public.users SELECT 를 테넌트 범위로 좁힌다 (보안 후속 과제 #5)
--
-- 무엇이 문제였나
--   20260403000001_role_based_rls.sql 의 `users_select_all USING (true)` 는
--   역할(role) 을 전혀 보지 않는 전역 허용 정책이다. 그 결과
--     · anon(로그인 전) 키만 있으면 PostgREST 로 /rest/v1/users 를 그대로 열어
--       모든 테넌트의 이메일·이름·부서·is_admin 을 통째로 가져갈 수 있었다.
--     · authenticated 는 20260908000001 의 RESTRICTIVE `users_membership_read_gate`
--       덕분에 이미 자기 테넌트로 묶여 있었지만, 허용 정책 자체가 `true` 라
--       그 RESTRICTIVE 정책 하나가 사라지는 순간 전 테넌트가 열린다.
--   즉 테넌트 격리가 "허용 정책"이 아니라 "제한 정책 하나"에만 걸려 있었다.
--
-- 무엇을 하는가
--   1. login_precheck(email, tenant) — 로그인 직전 anon 이 호출하는 SECURITY
--      DEFINER RPC. boolean 하나만 돌려준다(2번에서 anon 의 users 직접 조회가
--      막히므로 로그인 흐름을 대체할 통로가 필요하다).
--   2. users_select_all 제거 → users_select_tenant (TO authenticated).
--      anon 에는 SELECT 허용 정책을 하나도 두지 않고, 그 위에 RESTRICTIVE
--      users_anon_no_select (TO anon USING false) 를 덮어 영구 차단한다.
--   3. users_membership_read_gate(RESTRICTIVE) 에 tenant claim 부재 폴백 추가.
--      tenant_id() 가 NULL 인 인증 사용자(구 토큰, claim 을 주입하지 않는 배포)는
--      `tenant_id = NULL` 이 never true 라 자기 행조차 못 읽는다. 로그인은 되는데
--      화면이 통째로 비는 상태다. 이때만 '본인 행' 을 열어 준다.
--
-- 조회 가능 집합의 변화 (중요)
--   변경 후 = 변경 전 ∪ {tenant_id() 가 NULL 일 때의 본인 행}. 순수 추가다.
--   즉 지금 보이던 행이 안 보이게 되는 authenticated 경로는 없다.
--   (anon 만 전면 차단된다 — 이번 과제의 목적)
--
-- 일부러 하지 않은 것: 본인 행의 전 테넌트 조회
--   테넌트 전환 목록(getUserAllTenants → TenantManagePage)은 내 users 행을
--   테넌트 무관하게 읽어야 제대로 동작한다. 그러려면 `id = auth.uid()` 에서
--   테넌트 조건을 떼야 하는데, 그러면 한 사람이 여러 테넌트에 행을 가진 경우
--   `.eq('id', uid).maybeSingle()` 로 자기 행을 읽는 곳들이 PGRST116 으로 깨진다
--   (customPermissions.ts:47, PolicyDocumentManager.vue:146 등 — 현재는
--    RESTRICTIVE 게이트가 테넌트로 좁혀 줘서 항상 1행이다).
--   테넌트 전환은 지금도 같은 이유로 현재 테넌트만 보여 주는 상태이고, 이번
--   과제의 범위(= anon 차단 + 테넌트 한정)가 아니다. 고칠 때는 호출부를 먼저
--   고친 뒤 정책을 넓혀야 한다.
--
-- 무엇을 건드리지 않는가
--   users_insert_admin / users_update_self_or_admin / users_delete_admin 은
--   그대로 둔다. 이번 과제는 SELECT 범위 축소다.
--
-- 재실행 안전(idempotent).
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 1. 로그인 사전 조회 RPC
--
--    StorageBaseSupabase.signIn() 은 비밀번호를 넣기 전에 "이 이메일이 지금
--    테넌트에 등록돼 있는가" 를 확인한다. 인증이 전역(auth.users)이라 이 확인이
--    없으면 A 테넌트 계정으로 B 테넌트 서브도메인에 로그인할 수 있다.
--    즉 없앨 수 없는 인가 관문이다.
--
--    기존 구현은 anon 으로 public.users 를 직접 select 해서 행 전체를 받아왔다.
--    돌려주는 값을 boolean 하나로 줄인다.
--      · 호출부가 실제로 쓰던 값은 `existUser.id` 의 존재 여부뿐이다
--        (users 에는 is_delete 류 컬럼이 없다 — 2026-09-11 기준 전 컬럼 확인).
--      · 목록/이메일/이름을 일절 돌려주지 않으므로 열거로 얻을 수 있는 정보가
--        기존보다 늘지 않는다. 오히려 "한 번에 한 (이메일, 테넌트) 쌍" 으로
--        줄어든다. 로그인 실패 문구는 계정 유무와 무관하게 동일하므로
--        (invalidCredentials) 화면상 열거 신호도 그대로 없다.
--      · 시도 자체는 record_auth_audit 이 남긴다(기존과 동일).
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.login_precheck(text, text);

CREATE OR REPLACE FUNCTION public.login_precheck(
    p_email     text,
    p_tenant_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE lower(btrim(u.email)) = lower(btrim(COALESCE(p_email, '')))
          AND btrim(COALESCE(p_email, '')) <> ''
          AND (
                NULLIF(btrim(COALESCE(p_tenant_id, '')), '') IS NULL
             OR u.tenant_id = btrim(p_tenant_id)
          )
    );
$$;

COMMENT ON FUNCTION public.login_precheck(text, text) IS
    '로그인 직전 "이 이메일이 해당 테넌트에 등록돼 있는가" 만 boolean 으로 반환. anon 호출 가능. 행/목록은 돌려주지 않는다.';

REVOKE ALL ON FUNCTION public.login_precheck(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_precheck(text, text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. 허용(PERMISSIVE) SELECT 정책: 같은 테넌트 (claim 이 없으면 본인 행)
--
--    · TO authenticated 로 못 박는다. anon 에는 SELECT 허용 정책이 하나도
--      남지 않으므로 anon 의 /rest/v1/users 는 항상 0행이다.
--    · 관리자 전 테넌트 조회는 넣지 않는다. 실제 관리 화면(ManageAccessTab,
--      UserListPage, 조직도, 리뷰어 선택, 채팅 참가자, 분석 대시보드)은 모두
--      window.$tenantName 으로 자기 테넌트만 조회한다 — 전 테넌트를 요구하는
--      관리 화면은 없다. 게다가 RESTRICTIVE 게이트가 이미 테넌트로 묶고 있어
--      허용 정책에 관리자 예외를 넣어도 실제로는 동작하지 않는다(죽은 조건).
--    · tenant claim 이 없을 때만 본인 행으로 폴백한다. claim 이 있으면 본인
--      행도 그 테넌트 안에서만 보인다 — 위 헤더의 "일부러 하지 않은 것" 참고.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "users_select_all"    ON public.users;
DROP POLICY IF EXISTS "users_select_tenant" ON public.users;

CREATE POLICY "users_select_tenant" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN public.tenant_id() IS NULL THEN id = auth.uid()
      ELSE tenant_id = public.tenant_id()
    END
  );

COMMENT ON POLICY "users_select_tenant" ON public.users IS
    '같은 테넌트(JWT app_metadata.tenant_id) 의 사용자만 조회. tenant claim 이 없으면 본인 행만(안전 폴백). anon 은 허용 정책이 없어 전면 차단.';

-- -----------------------------------------------------------------------------
-- 3. 승인 게이트(RESTRICTIVE) 에 tenant claim 부재 폴백만 추가
--
--    원본(20260908000001:135)
--      tenant_id = tenant_id() AND (membership_approved() OR id = auth.uid())
--    추가되는 절
--      OR (tenant_id() IS NULL AND id = auth.uid())
--    claim 이 있는 평소에는 원본과 완전히 같다. claim 이 없을 때만 본인 행이
--    열린다 — 승인 게이트의 취지(미승인 멤버가 사용자 목록을 못 본다)는
--    본인 행 하나로는 훼손되지 않는다.
--
--    이 정책이 없던 배포(20260908000001 미적용)에서도 안전하도록
--    membership_approved() 존재 여부를 확인하고 조건부로 재생성한다.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'membership_approved'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS users_membership_read_gate ON public.users';
    EXECUTE $pol$
      CREATE POLICY users_membership_read_gate ON public.users
        AS RESTRICTIVE
        FOR SELECT
        TO authenticated
        USING (
          (tenant_id = public.tenant_id() AND (public.membership_approved() OR id = auth.uid()))
          OR (public.tenant_id() IS NULL AND id = auth.uid())
        )
    $pol$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. anon 봉인 — 제한 정책 + 쓰기 권한 회수
--
--    (a) RESTRICTIVE ... TO anon USING (false)
--        2번에서 anon 용 허용 정책을 없앴으니 지금도 0행이다. 그럼에도 제한
--        정책을 하나 더 두는 이유는, 나중에 누가 `FOR SELECT USING (true)` 를
--        다시 만들어도 anon 만은 끝까지 막히게 하기 위해서다
--        (RESTRICTIVE 는 AND 로 합쳐지므로 허용 정책이 늘어나도 뚫리지 않는다).
--
--        GRANT SELECT 자체는 남겨 둔다. 권한을 회수하면 PostgREST 가
--        "permission denied for table users" 라는 42501 오류를 돌려주는데,
--        비로그인으로 열리는 /external-forms 의 사용자 선택 필드처럼 목록을
--        받아 그리는 화면이 빈 목록 대신 예외로 죽는다. RLS 로 막으면 같은
--        요청이 빈 배열로 끝나 화면이 조용히 비어 있을 뿐이다. 노출되는 정보는
--        양쪽 모두 0이므로 덜 깨지는 쪽을 고른다.
--        users_masked(security_invoker = true) 도 같은 이유로 GRANT 를 유지한다
--        — 기반 테이블 RLS 를 그대로 타므로 anon 에게는 역시 0행이다.
--
--    (b) anon 의 쓰기 권한 회수
--        Supabase 기본 설정이 public 스키마 전체를 anon 에게 GRANT ALL 한다.
--        users 의 INSERT/UPDATE/DELETE 정책은 has_role_at_least('admin') 을
--        요구해 anon 은 어차피 통과하지 못하지만, 테이블 권한이 열려 있을
--        이유가 없다. 가입 시 users 행 생성은 SECURITY DEFINER 트리거
--        (apply_pending_org_member_on_signup / queue_membership_signup) 와
--        GoTrue 가 하므로 anon 의 직접 권한은 쓰이지 않는다.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "users_anon_no_select" ON public.users;

CREATE POLICY "users_anon_no_select" ON public.users
  AS RESTRICTIVE
  FOR SELECT
  TO anon
  USING (false);

COMMENT ON POLICY "users_anon_no_select" ON public.users IS
    '비로그인(anon) 조회 영구 차단. 허용 정책이 나중에 다시 넓어져도 anon 은 뚫리지 않는다.';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON public.users FROM anon;

-- PostgREST 스키마 캐시 갱신 (새 RPC 를 바로 쓸 수 있게)
NOTIFY pgrst, 'reload schema';
