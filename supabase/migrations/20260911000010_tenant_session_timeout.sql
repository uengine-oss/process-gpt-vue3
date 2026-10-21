-- 세션 타임아웃 테넌트 설정 (docs/security.md 2-1, 항목 12)
--
-- 값은 public.tenants 에 컬럼을 더하지 않고, 이 레포가 이미 테넌트 설정에 쓰는
-- public.configuration (tenant_id + key 유일, admin 만 쓰기) 에 한 행으로 둔다.
--
--   key   = 'session_timeout'
--   value = { "idle_timeout_minutes": 30, "warning_seconds": 60 }
--
--   idle_timeout_minutes : 유휴 허용 시간(분). 0 이하면 유휴 타이머 비활성.
--   warning_seconds      : 경고 모달을 띄우고 로그아웃까지 기다리는 유예(초). 최소 5초.
--
-- 행이 없으면 화면(src/composables/useIdleTimeout.ts)이 기본값 30분 / 60초를 쓴다.
-- 기존 동작을 유지해야 하는 테넌트는 idle_timeout_minutes 를 0 으로 둔다.
--
-- 이 마이그레이션은 값을 심지 않는다 — 미설정(기본값)과 명시적 설정을 구분해야
-- 나중에 기본값을 바꿔도 이미 조정해 둔 테넌트를 덮어쓰지 않는다.
-- 여기서는 (a) 업서트에 필요한 유일 제약이 있는지 확인하고 (b) 키를 문서화한다.

DO $$
BEGIN
    IF to_regclass('public.configuration') IS NULL THEN
        RAISE NOTICE 'public.configuration 이 없어 세션 타임아웃 설정 준비를 건너뜁니다.';
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
-- 통째로 덮어쓰지 않고 이어 붙인다. 이 테이블의 COMMENT 는 여러 마이그레이션이 나눠 쓴다
-- (20260911000005_mfa_policy.sql 등). 각자 SET 하면 나중에 적용된 쪽만 남으므로,
-- 적용 순서와 무관하게 모두 남도록 "없으면 덧붙인다"로 쓴다 (재실행해도 중복되지 않는다).
DO $$
DECLARE
    existing text;
    addition CONSTANT text :=
        'key=''session_timeout'' → {"idle_timeout_minutes": 30, "warning_seconds": 60} (docs/security-gotrue-session-policy.md)';
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
--   INSERT INTO public.configuration (tenant_id, key, value)
--   VALUES ('<tenant>', 'session_timeout', '{"idle_timeout_minutes": 30, "warning_seconds": 60}'::jsonb)
--   ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
--
-- 유휴 타이머를 끄려면:
--
--   INSERT INTO public.configuration (tenant_id, key, value)
--   VALUES ('<tenant>', 'session_timeout', '{"idle_timeout_minutes": 0}'::jsonb)
--   ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
