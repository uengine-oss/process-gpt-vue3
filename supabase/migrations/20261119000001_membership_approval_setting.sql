-- =============================================================================
-- 가입 승인을 설정으로 켜고 끈다 (2026-11-19)
--
-- 왜
--   20260908000001_membership_approvals.sql 은 새로 가입한 사람을 '승인 대기'로 두고,
--   관리자가 승인할 때까지 회사 데이터를 못 보게 한다. 설치형에서는 이게 맞다.
--   그런데 누구나 들어와 써 보는 데모 서버(process-gpt.io)는 열어 둬야 한다.
--   그래서 배포(데이터베이스)마다 한 줄 설정으로 고른다.
--
-- 설정
--   public.membership_settings.require_approval (행 하나)
--     true  (기본값, 설치형) — 20260908000001 그대로. 덧붙인 것 하나:
--            테넌트 소유자는 자기 테넌트에 곧바로 승인된 상태로 들어간다
--            (새 테넌트를 만든 사람을 승인해 줄 관리자가 아직 없기 때문).
--     false (데모 서버)      — 승인 기능이 들어오기 전과 똑같이 동작한다.
--            · 새 가입자는 곧바로 승인 상태이고, 역할은 가입 흐름이 정한 그대로다.
--              가입 신청(signup_requests)은 들어오는 즉시 승인으로 닫힌다(reviewed_by 'system:approval-off').
--            · membership_access_gate · users_membership_read_gate 는 아무것도 막지 않는다(식이 true).
--            · current_user_role() 은 승인 기능 이전의 판단을 그대로 쓴다.
--            · 권한·가입 상태를 바꾸는 UPDATE 를 막는 검사도 하지 않는다(이전과 같다).
--            · membership_approved() / membership_admin() 은 '이 테넌트의 회원인가 /
--              관리자인가' 로만 판단한다(가입 상태는 보지 않는다).
--
-- 바꾸는 법 — SQL Editor(postgres) 또는 service_role 로만. 테넌트 관리자는 못 바꾼다
-- (한 데이터베이스를 여러 테넌트가 함께 쓰므로 배포 전체의 설정이다).
--     UPDATE public.membership_settings SET require_approval = false;  -- 열기(데모)
--     UPDATE public.membership_settings SET require_approval = true;   -- 승인 받기(설치형)
--   끌 때 승인 대기 중이던 사람은 모두 승인된다(역할은 대기 중 역할 viewer 그대로).
--
-- 게이트를 바꾸는 방식
--   설정이 바뀌면 membership_access_gate · users_membership_read_gate 의 식 자체를 바꾼다(membership_apply_gates()).
--   끔이면 식이 true — 승인 기능 이전과 똑같고 행마다 함수를 부르지도 않는다. 켬이면 20260908000001 의 식.
--   정책 식에 (SELECT …) 같은 하위 쿼리를 넣지 않는다: users 의 UPDATE 정책처럼 자기 테이블을 하위 쿼리로 읽는
--   정책이 있으면 'infinite recursion detected in policy for relation "users"' 로 깨진다(로컬에서 확인).
--
-- 여러 번 실행해도 결과가 같다. 20260908000001 이 먼저 적용돼 있어야 한다.
-- =============================================================================

DO $$
BEGIN
    IF to_regprocedure('public.membership_admin()') IS NULL
       OR to_regprocedure('public.guard_membership_access()') IS NULL
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'membership_status') THEN
        RAISE EXCEPTION '20260908000001_membership_approvals.sql 을 먼저 적용하세요.';
    END IF;
END $$;

-- 1. 설정 ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    require_approval boolean NOT NULL DEFAULT true
);
INSERT INTO public.membership_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.membership_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.membership_settings TO service_role;
COMMENT ON TABLE public.membership_settings IS
    '가입 승인 설정(배포 전체, 행 하나). require_approval=true 설치형 기본값, false 는 누구나 들어오는 데모 서버.';

CREATE OR REPLACE FUNCTION public.membership_require_approval() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE((SELECT require_approval FROM public.membership_settings WHERE id), true);
$$;

-- 2. 판단 함수 -----------------------------------------------------------------
-- 이 테넌트의 (승인된) 회원인가. 승인을 받지 않는 배포에서는 회원이기만 하면 된다.
CREATE OR REPLACE FUNCTION public.membership_approved() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()
        AND tenant_id = public.tenant_id()
        AND (membership_status = 'approved' OR NOT public.membership_require_approval()));
$$;
CREATE OR REPLACE FUNCTION public.membership_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()
        AND tenant_id = public.tenant_id()
        AND (membership_status = 'approved' OR NOT public.membership_require_approval())
        AND (is_admin OR lower(role) IN ('admin','superadmin')));
$$;

-- 3. 역할 판단: 승인을 받지 않는 배포에서는 승인 기능 이전의 판단 그대로 --------------
-- 승인 기능 이전의 current_user_role() (20260403000001_role_based_rls.sql 과 같다).
-- 이미 있으면 그대로 둔다 — 운영처럼 이전 함수를 그대로 옮겨 둔 데이터베이스가 있다.
DO $outer$
BEGIN
    IF to_regprocedure('public.current_user_role_before_approval()') IS NULL THEN
        EXECUTE $fn$
CREATE FUNCTION public.current_user_role_before_approval()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $body$
DECLARE
  v_role text;
  v_uid  uuid;
  v_is_admin boolean;
  v_jwt_role text;
BEGIN
  BEGIN
    v_uid := (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    SELECT u.role, u.is_admin
    INTO v_role, v_is_admin
    FROM public.users u
    WHERE u.id = v_uid
      AND u.tenant_id = public.tenant_id()
    LIMIT 1;

    IF v_role IS NOT NULL AND public.get_role_level(v_role) > 0 THEN
      RETURN lower(v_role);
    END IF;
    IF v_is_admin = true THEN
      RETURN 'admin';
    END IF;
    IF v_role IS NOT NULL OR v_is_admin IS NOT NULL THEN
      RETURN 'viewer';
    END IF;
  END IF;

  BEGIN
    v_jwt_role := coalesce(
      current_setting('request.jwt.claims', true)::json ->> 'user_role',
      current_setting('request.jwt.claims', true)::json ->> 'role'
    );
  EXCEPTION WHEN OTHERS THEN
    v_jwt_role := NULL;
  END;

  IF v_jwt_role IS NOT NULL
     AND v_jwt_role NOT IN ('authenticated', 'anon', 'service_role', '')
     AND public.get_role_level(v_jwt_role) > 0
  THEN
    RETURN lower(v_jwt_role);
  END IF;

  RETURN 'viewer';
END;
$body$
$fn$;
    END IF;
END $outer$;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NOT public.membership_require_approval() THEN
        RETURN public.current_user_role_before_approval();
    END IF;
    -- 승인을 받는 배포: 20260908000001 그대로(승인 전에는 아무 역할도 없다)
    RETURN COALESCE((SELECT CASE
        WHEN membership_status <> 'approved' THEN ''
        WHEN lower(role) = 'superadmin' THEN 'admin'
        WHEN public.get_role_level(role) > 0 THEN lower(role)
        WHEN is_admin THEN 'admin' ELSE 'viewer' END
        FROM public.users WHERE id = auth.uid() AND tenant_id = public.tenant_id()), '');
END;
$$;

-- 4. 가입할 때 ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_membership_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    required boolean := public.membership_require_approval();
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- An upsert of an existing account must not reset its granted role.
        IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id AND tenant_id = NEW.tenant_id) THEN
            RETURN NEW;
        END IF;
        IF NOT required OR COALESCE(NEW.is_agent, false) THEN
            -- 승인을 받지 않는 배포: 가입 흐름이 정한 역할 그대로 곧바로 회원이다.
            NEW.membership_status := 'approved';
        ELSIF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = NEW.tenant_id AND t.owner = NEW.id) THEN
            -- 새 테넌트를 만든 사람: 승인해 줄 관리자가 아직 없다.
            NEW.membership_status := 'approved';
        ELSE
            NEW.membership_status := 'pending';
            NEW.role := 'viewer';
            NEW.is_admin := false;
        END IF;
        RETURN NEW;
    END IF;

    IF NOT required THEN
        RETURN NEW;
    END IF;
    IF auth.role() IN ('authenticated','anon') AND NOT public.membership_admin()
        AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
            OR NEW.membership_status IS DISTINCT FROM OLD.membership_status
            OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.id IS DISTINCT FROM OLD.id
            OR NEW.permission_ids IS DISTINCT FROM OLD.permission_ids
            OR NEW.is_agent IS DISTINCT FROM OLD.is_agent) THEN
        RAISE EXCEPTION '관리자만 권한과 가입 상태를 변경할 수 있습니다.' USING ERRCODE = '42501';
    END IF;
    -- Pre-registration hooks may assign roles after the auth insert. Approval still comes first.
    IF NEW.membership_status <> 'approved' THEN
        NEW.role := 'viewer';
        NEW.is_admin := false;
    END IF;
    RETURN NEW;
END;
$$;

-- 내 가입 상태: 승인을 받지 않는 배포에서는 늘 승인. 화면이 쓰도록 설정도 함께 돌려준다.
CREATE OR REPLACE FUNCTION public.my_membership() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE((SELECT jsonb_build_object(
            'status', CASE WHEN public.membership_require_approval() THEN u.membership_status ELSE 'approved' END,
            'role', u.role, 'is_admin', u.is_admin, 'tenant_id', u.tenant_id, 'reject_reason', s.reject_reason,
            'approval_required', public.membership_require_approval())
        FROM public.users u LEFT JOIN public.signup_requests s ON s.user_id = u.id AND s.tenant_id = u.tenant_id
        WHERE u.id = auth.uid() AND u.tenant_id = public.tenant_id()),
        jsonb_build_object('status', 'missing', 'approval_required', public.membership_require_approval()));
$$;

-- 끔이면 가입 신청은 들어오는 즉시 승인으로 닫힌다. 아무도 기다리지 않는데 '대기' 가 쌓이면
-- 관리자 화면의 신청 건수만 늘어난다(예전 가입 트리거가 신청을 늘 'pending' 으로 넣는 데이터베이스가 있다).
CREATE OR REPLACE FUNCTION public.membership_close_signup_when_open() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF NEW.status = 'pending' AND NOT public.membership_require_approval() THEN
        NEW.status := 'approved';
        NEW.reviewed_by := 'system:approval-off';
        NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS membership_close_signup_when_open ON public.signup_requests;
CREATE TRIGGER membership_close_signup_when_open BEFORE INSERT OR UPDATE ON public.signup_requests
FOR EACH ROW EXECUTE FUNCTION public.membership_close_signup_when_open();

-- 5. 게이트: 설정에 따라 정책 식 자체를 바꾼다 ------------------------------------------
-- 끔: true(아무것도 막지 않는다). 켬: 20260908000001 의 식(users 는 20260911000011 의 tenant claim 폴백 포함).
-- 나중 이주가 membership_access_gate 를 새로 만들어도 SELECT public.membership_apply_gates(); 한 번이면 맞춰진다.
CREATE OR REPLACE FUNCTION public.membership_apply_gates() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    is_open boolean := NOT public.membership_require_approval();
    gate text := CASE WHEN is_open THEN 'true' ELSE 'public.membership_approved()' END;
    p record;
BEGIN
    FOR p IN SELECT tablename, cmd FROM pg_policies
             WHERE schemaname = 'public' AND policyname = 'membership_access_gate'
    LOOP
        IF p.cmd IN ('SELECT', 'DELETE') THEN
            EXECUTE format('ALTER POLICY membership_access_gate ON public.%I USING (%s)', p.tablename, gate);
        ELSIF p.cmd = 'INSERT' THEN
            EXECUTE format('ALTER POLICY membership_access_gate ON public.%I WITH CHECK (%s)', p.tablename, gate);
        ELSE
            EXECUTE format('ALTER POLICY membership_access_gate ON public.%I USING (%s) WITH CHECK (%s)', p.tablename, gate, gate);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_membership_read_gate') THEN
        EXECUTE 'ALTER POLICY users_membership_read_gate ON public.users USING ('
            || CASE WHEN is_open THEN 'true'
                    ELSE '(tenant_id = public.tenant_id() AND (public.membership_approved() OR id = auth.uid()))'
                         ' OR (public.tenant_id() IS NULL AND id = auth.uid())' END
            || ')';
    END IF;
END;
$$;

-- 6. 설정이 바뀔 때: 끄면 대기 중이던 사람을 승인하고, 게이트 식을 바꾼다 ------------------
CREATE OR REPLACE FUNCTION public.membership_settings_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF OLD.require_approval IS NOT DISTINCT FROM NEW.require_approval THEN
        RETURN NEW;
    END IF;
    IF NOT NEW.require_approval THEN
        UPDATE public.users SET membership_status = 'approved' WHERE membership_status = 'pending';
        UPDATE public.signup_requests
           SET status = 'approved', reviewed_by = 'system:approval-off', reviewed_at = now(), updated_at = now()
         WHERE status = 'pending';
    END IF;
    PERFORM public.membership_apply_gates();
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS membership_settings_changed ON public.membership_settings;
CREATE TRIGGER membership_settings_changed AFTER UPDATE ON public.membership_settings
FOR EACH ROW EXECUTE FUNCTION public.membership_settings_changed();

SELECT public.membership_apply_gates();

-- 7. 권한 ----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.membership_require_approval(),
    public.membership_approved(), public.membership_admin() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.membership_settings_changed(), public.membership_apply_gates(),
    public.membership_close_signup_when_open() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
