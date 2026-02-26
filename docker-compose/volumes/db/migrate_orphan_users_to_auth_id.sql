-- ===============================================
-- 유령 계정 / 유령 테넌트 조회 및 마이그레이션
-- ===============================================
-- 1) 아래 조회 쿼리로 유령 계정·테넌트가 있는지 확인
-- 2) 필요 시 마이그레이션 함수 실행: migrate_orphan_users(), migrate_ghost_tenants()
-- ===============================================


-- ===============================================
-- 조회 쿼리 (복사해서 실행, 데이터 변경 없음)
-- ===============================================

-- 유령 계정: is_agent=false 이면서 auth.users에 id가 없는 경우만
SELECT u.*
FROM public.users u
WHERE u.is_agent = false
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users au
    WHERE au.id = u.id
  );

-- 유령 테넌트: owner가 auth.users에 존재하지 않는 테넌트
SELECT
  t.id        AS tenant_id,
  t.owner     AS owner_user_id
FROM public.tenants t
WHERE t.owner IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = t.owner)
ORDER BY t.id;

-- (참고) owner가 public.users에 해당 테넌트로 레코드가 없는 테넌트
-- SELECT
--   t.id        AS tenant_id,
--   t.owner     AS owner_user_id,
--   au.email    AS owner_email
-- FROM public.tenants t
-- LEFT JOIN public.users u
--        ON u.id = t.owner AND u.tenant_id = t.id
-- LEFT JOIN auth.users au ON au.id = t.owner
-- WHERE t.owner IS NOT NULL
--   AND u.id IS NULL
-- ORDER BY t.id;


-- ===============================================
-- 마이그레이션 함수 (실행 시 데이터 변경)
-- ===============================================

-- 유령 계정 정리
-- - auth.users에는 id가 있지만 public.users.email이 null/빈 값 → auth.users.email로 갱신
-- - auth.users에 id가 없는 사람 사용자: (tenant_id, email) 중복 시 정리, 동일 이메일이 auth에 있으면 id 갱신
CREATE OR REPLACE FUNCTION public.migrate_orphan_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  updated_email int;
  deleted_dup   int;
  deleted_dup2  int;
  updated_perms int;
  updated_ak   int;
  updated_users int;
BEGIN
  -- Step 0: auth.users에는 id가 있는데 public.users.email이 null/빈 값인 경우 → auth.email로 갱신
  UPDATE public.users u
  SET email = au.email
  FROM auth.users au
  WHERE u.id = au.id
    AND u.is_agent = false
    AND (u.email IS NULL OR u.email = '');
  GET DIAGNOSTICS updated_email = ROW_COUNT;

  -- Step 1: (tenant_id, email) 동일 조합에서 "auth에 있는 id" 행이 이미 있을 때, auth에 없는 고아 행만 삭제
  DELETE FROM public.users u
  WHERE u.is_agent = false
    AND u.id NOT IN (SELECT id FROM auth.users)
    AND EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.tenant_id = u.tenant_id
        AND u2.email = u.email
        AND u2.id IN (SELECT id FROM auth.users)
    );
  GET DIAGNOSTICS deleted_dup = ROW_COUNT;

  -- Step 2a: (tenant_id, email) 조합에 고아 행이 여러 개 남은 경우, 한 건만 남기고 나머지 삭제
  DELETE FROM public.users u
  WHERE u.is_agent = false
    AND u.id NOT IN (SELECT id FROM auth.users)
    AND EXISTS (SELECT 1 FROM auth.users au WHERE au.email = u.email)
    AND EXISTS (
      SELECT 1 FROM public.users u2
      WHERE u2.tenant_id = u.tenant_id
        AND u2.email = u.email
        AND u2.id NOT IN (SELECT id FROM auth.users)
        AND u2.id < u.id
    );
  GET DIAGNOSTICS deleted_dup2 = ROW_COUNT;

  -- Step 2b: user_permissions 선행 갱신
  UPDATE public.user_permissions up
  SET user_id = au.id
  FROM public.users u
  JOIN auth.users au ON au.email = u.email
  WHERE up.user_id = u.id
    AND u.is_agent = false
    AND u.id != au.id
    AND u.id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS updated_perms = ROW_COUNT;

  -- agent_knowledge_setup_log 선행 갱신
  UPDATE public.agent_knowledge_setup_log ak
  SET agent_id = au.id
  FROM public.users u
  JOIN auth.users au ON au.email = u.email
  WHERE ak.agent_id = u.id
    AND u.is_agent = false
    AND u.id != au.id
    AND u.id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS updated_ak = ROW_COUNT;

  -- public.users id 갱신
  UPDATE public.users u
  SET id = au.id
  FROM auth.users au
  WHERE u.email = au.email
    AND u.is_agent = false
    AND u.id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS updated_users = ROW_COUNT;

  RETURN jsonb_build_object(
    'updated_email_from_auth', updated_email,
    'deleted_duplicate_rows', deleted_dup + deleted_dup2,
    'updated_user_permissions', updated_perms,
    'updated_agent_knowledge_setup_log', updated_ak,
    'updated_users_id', updated_users
  );
END;
$$;

COMMENT ON FUNCTION public.migrate_orphan_users() IS '유령 계정 정리: email auth 동기화 + auth에 없는 사람 사용자 삭제/id 갱신';


-- 유령 테넌트 정리: owner가 auth.users에 없는 테넌트의 owner를 NULL로 설정
CREATE OR REPLACE FUNCTION public.migrate_ghost_tenants()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.tenants t
  SET owner = NULL
  WHERE t.owner IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = t.owner);
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN jsonb_build_object('tenants_owner_set_to_null', updated_count);
END;
$$;

COMMENT ON FUNCTION public.migrate_ghost_tenants() IS '유령 테넌트 정리: owner가 auth.users에 없는 테넌트의 owner를 NULL로 설정';
