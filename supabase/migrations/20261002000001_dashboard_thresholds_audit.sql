-- =============================================================================
-- 분석 대시보드 차트 기준값 변경 감사 로그 (specs/012-dashboard-thresholds)
--
-- [저장 위치]
--   public.configuration (tenant_id, key='dashboard_thresholds', value jsonb)
--   value 는 평탄 JSON. 키·기본값은 process-gpt-completion/dashboard_thresholds.py 와
--   src/services/dashboardThresholdsService.ts 가 같게 유지한다.
--   예) {"zombie_warning_days": 90, "zombie_danger_days": 180, "review_delay_days": 7, ...}
--
-- [감사 로그]
--   관리자 화면은 configuration 에 직접 upsert 한다(RLS: admin 만 쓰기).
--   클라이언트가 로그를 따로 남기면 SQL 직접 수정·다른 화면 경로가 빠지므로,
--   이 키의 INSERT/UPDATE/DELETE 를 AFTER 트리거로 admin_audit_log 에 남긴다.
--   - action      = 'dashboard_threshold_update' (삭제는 'dashboard_threshold_reset')
--   - target_type = 'dashboard_threshold'
--   - before/after = 바뀐 키만 담은 JSON 텍스트 (값이 같으면 로그를 남기지 않는다).
--     행이 없을 때는 기본값(dashboard_threshold_defaults)을 이전 값으로 본다.
--   - actor 는 enforce_admin_audit_log_actor 트리거가 auth.uid() 로 강제한다.
--     세션이 없는 경로(service_role·psql)는 'system:<db role>' 로 남는다.
--
-- [멱등성] CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS → CREATE TRIGGER.
-- [롤백]
--   DROP TRIGGER IF EXISTS trg_log_dashboard_threshold_change ON public.configuration;
--   DROP FUNCTION IF EXISTS public.log_dashboard_threshold_change();
--   DROP FUNCTION IF EXISTS public.dashboard_threshold_defaults();
-- =============================================================================

-- 기본값. 비교 기준선으로만 쓴다 — 행이 없던 테넌트의 첫 저장이나 삭제(초기화)에서
-- "기본값과 달라진 키"만 로그에 남기기 위해서다. dashboard_thresholds.py /
-- dashboardThresholdsService.ts 의 DEFAULT_THRESHOLDS 와 같게 유지할 것.
CREATE OR REPLACE FUNCTION public.dashboard_threshold_defaults()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT '{
        "kpi_rag_green_pct": 100, "kpi_rag_amber_pct": 50, "velocity_weekly_target": 0,
        "churn_high": 3, "churn_medium": 2, "fte_working_days": 22,
        "fte_critical": 5, "fte_high": 3, "fte_medium": 1,
        "zombie_warning_days": 90, "zombie_danger_days": 180, "review_delay_days": 7,
        "dq_good_pct": 80, "dq_warning_pct": 60
    }'::jsonb
$$;

CREATE OR REPLACE FUNCTION public.log_dashboard_threshold_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old jsonb := public.dashboard_threshold_defaults();
    v_new jsonb := public.dashboard_threshold_defaults();
    v_before jsonb := '{}'::jsonb;
    v_after jsonb := '{}'::jsonb;
    v_key text;
    v_tenant text;
    v_action text := 'dashboard_threshold_update';
BEGIN
    -- 다중 이벤트 트리거는 WHEN 에서 NEW/OLD 를 함께 못 쓰므로 여기서 거른다.
    IF NOT ((TG_OP <> 'DELETE' AND NEW.key = 'dashboard_thresholds')
            OR (TG_OP <> 'INSERT' AND OLD.key = 'dashboard_thresholds')) THEN
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.key = 'dashboard_thresholds'
       AND jsonb_typeof(OLD.value) = 'object' THEN
        v_old := v_old || OLD.value;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.key = 'dashboard_thresholds'
       AND jsonb_typeof(NEW.value) = 'object' THEN
        v_new := v_new || NEW.value;
    END IF;
    IF TG_OP = 'DELETE' THEN
        v_action := 'dashboard_threshold_reset';
    END IF;

    -- 기본값 위에 덮어쓴 값끼리 비교해 바뀐 키만 남긴다 (첫 저장·초기화도 실제 변화분만).
    FOR v_key IN
        SELECT k FROM jsonb_object_keys(v_old) k
        UNION
        SELECT k FROM jsonb_object_keys(v_new) k
    LOOP
        IF (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
            IF v_old ? v_key THEN v_before := v_before || jsonb_build_object(v_key, v_old -> v_key); END IF;
            IF v_new ? v_key THEN v_after := v_after || jsonb_build_object(v_key, v_new -> v_key); END IF;
        END IF;
    END LOOP;

    IF v_before = '{}'::jsonb AND v_after = '{}'::jsonb THEN
        RETURN NULL;
    END IF;

    v_tenant := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;

    INSERT INTO public.admin_audit_log
        (tenant_id, actor_id, action, target_type, target_id, target_name, before_value, after_value, comment)
    VALUES (
        COALESCE(v_tenant, ''),
        COALESCE(auth.uid()::text, 'system:' || session_user),
        v_action,
        'dashboard_threshold',
        'dashboard_thresholds',
        '분석 대시보드 차트 기준값',
        CASE WHEN v_before = '{}'::jsonb THEN NULL ELSE v_before::text END,
        CASE WHEN v_after = '{}'::jsonb THEN NULL ELSE v_after::text END,
        NULL
    );
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.log_dashboard_threshold_change() IS
'configuration key=dashboard_thresholds 변경 시 바뀐 키만 admin_audit_log 에 기록한다 (specs/012-dashboard-thresholds).';

DROP TRIGGER IF EXISTS trg_log_dashboard_threshold_change ON public.configuration;
CREATE TRIGGER trg_log_dashboard_threshold_change
    AFTER INSERT OR UPDATE OR DELETE ON public.configuration
    FOR EACH ROW
    EXECUTE FUNCTION public.log_dashboard_threshold_change();

-- 키 문서화 (다른 마이그레이션과 같은 "없으면 덧붙인다" 방식)
DO $$
DECLARE
    existing text;
    addition CONSTANT text :=
        'key=''dashboard_thresholds'' → 분석 대시보드 차트 기준값 평탄 JSON (specs/012-dashboard-thresholds, 변경 시 admin_audit_log 기록)';
BEGIN
    existing := obj_description('public.configuration'::regclass, 'pg_class');
    IF existing IS NULL OR existing = '' THEN
        EXECUTE format('COMMENT ON TABLE public.configuration IS %L', '테넌트별 key/value 설정. ' || addition);
    ELSIF position(addition IN existing) = 0 THEN
        EXECUTE format('COMMENT ON TABLE public.configuration IS %L', existing || '; ' || addition);
    END IF;
END $$;
