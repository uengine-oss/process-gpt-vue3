-- MFA(TOTP) 테넌트 설정 (docs/security.md 2-3, 항목 3)
--
-- 값은 public.tenants 에 컬럼을 더하지 않고, 이 레포가 이미 테넌트 설정에 쓰는
-- public.configuration (tenant_id + key 유일, admin 만 쓰기) 에 한 행으로 둔다.
-- session_timeout / login_lockout 과 같은 자리다.
--
--   key   = 'mfa_policy'
--   value = { "require_mfa": false }
--
--   require_mfa : true 면 그 테넌트의 모든 사용자가 TOTP 를 등록해야 한다.
--                 미등록 사용자는 라우터 가드가 계정 설정 화면으로 보내 등록을 유도하고,
--                 등록했지만 아직 챌린지를 통과하지 않은 세션(aal1)은 /auth/two-step 으로 보낸다.
--                 false(기본)면 등록은 선택이며, 등록한 사용자만 로그인 때 챌린지를 거친다.
--
-- 행이 없으면 화면(src/utils/mfaGate.ts)이 기본값 require_mfa=false 를 쓴다.
-- 즉 이 마이그레이션을 적용해도 기존 로그인 동작은 바뀌지 않는다.
--
-- 이 마이그레이션은 값을 심지 않는다 — 미설정(기본값)과 명시적 설정을 구분해야
-- 나중에 기본값을 바꿔도 이미 조정해 둔 테넌트를 덮어쓰지 않는다.
-- 여기서는 (a) 업서트에 필요한 유일 제약이 있는지 확인하고 (b) 키를 문서화한다.
--
-- GoTrue 쪽 선행 조건: GOTRUE_MFA_TOTP_ENROLL_ENABLED / GOTRUE_MFA_TOTP_VERIFY_ENABLED = true
-- (docker-compose/docker-compose.yaml, kubernetes/supabase-deployment.yaml)

DO $$
BEGIN
    IF to_regclass('public.configuration') IS NULL THEN
        RAISE NOTICE 'public.configuration 이 없어 MFA 정책 설정 준비를 건너뜁니다.';
        RETURN;
    END IF;

    -- 20260902000001_proc_def_configuration_unique.sql 에서 이미 추가되지만,
    -- 이 마이그레이션만 단독으로 적용되는 환경(구 스냅샷)에서도 업서트가 되게 한다.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.configuration'::regclass
           AND conname = 'configuration_tenant_id_key_unique'
    ) THEN
        ALTER TABLE public.configuration
            ADD CONSTRAINT configuration_tenant_id_key_unique UNIQUE (tenant_id, key);
    END IF;
END $$;

-- 키 문서화.
--
-- 통째로 덮어쓰지 않고 이어 붙인다. 이 테이블의 COMMENT 는 여러 마이그레이션이
-- 나눠 쓰고 있고(20260911000010_tenant_session_timeout.sql 등), 파일명 정렬상 그쪽이
-- 뒤에 적용되기 때문에 여기서 SET 하면 그 마이그레이션이 다시 지워 버린다.
-- 적용 순서와 무관하게 남도록 "없으면 덧붙인다"로 쓴다 (재실행해도 중복되지 않는다).
DO $$
DECLARE
    existing text;
    addition CONSTANT text :=
        'key=''mfa_policy'' → {"require_mfa": false} (docs/security-gotrue-mfa-policy.md)';
BEGIN
    IF to_regclass('public.configuration') IS NULL THEN
        RETURN;
    END IF;

    existing := obj_description('public.configuration'::regclass, 'pg_class');

    IF existing IS NULL OR existing = '' THEN
        EXECUTE format('COMMENT ON TABLE public.configuration IS %L', '테넌트별 key/value 설정. ' || addition);
    ELSIF position(addition IN existing) = 0 THEN
        EXECUTE format('COMMENT ON TABLE public.configuration IS %L', existing || '; ' || addition);
    END IF;
END $$;

-- 테넌트에 값을 넣는 예 (관리자 UI 가 붙기 전까지 수동 적용):
--
--   -- MFA 필수로 전환
--   INSERT INTO public.configuration (tenant_id, key, value)
--   VALUES ('<tenant>', 'mfa_policy', '{"require_mfa": true}'::jsonb)
--   ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
--
--   -- 다시 선택 사항으로
--   INSERT INTO public.configuration (tenant_id, key, value)
--   VALUES ('<tenant>', 'mfa_policy', '{"require_mfa": false}'::jsonb)
--   ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
--
-- 등록 현황 확인 (verified 상태의 TOTP 팩터를 가진 사용자):
--
--   SELECT u.email, f.friendly_name, f.status, f.created_at
--     FROM auth.mfa_factors f
--     JOIN auth.users u ON u.id = f.user_id
--    WHERE f.factor_type = 'totp'
--    ORDER BY f.created_at DESC;
--
-- 선택 항목: 민감 테이블 RLS 에 aal2 조건 (아직 적용하지 않음)
--
--   이 마이그레이션은 RLS 를 건드리지 않는다. 적용하려면 해당 테이블 정책에
--   아래 조건을 AND 로 덧붙인다 (GoTrue 가 액세스 토큰의 aal 클레임을 채운다).
--
--     USING ( ... AND (auth.jwt() ->> 'aal') = 'aal2' )
--
--   주의: 모든 사용자가 TOTP 를 등록하기 전에 켜면 미등록 사용자는 aal1 이라
--   해당 테이블을 전혀 읽지 못한다. require_mfa 를 먼저 켜고 등록을 마친 뒤에 적용한다.
--   SSO(헤더 교환) 경로는 GoTrue 세션이 아니라 aal 클레임이 없으므로 함께 차단된다.
