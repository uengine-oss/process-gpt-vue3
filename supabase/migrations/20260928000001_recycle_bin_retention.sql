-- =============================================================================
-- 휴지통 보존 정책 — 서버측 스케줄 정리 (specs/010-tenant-terminology-policy)
--
-- [배경]
--   휴지통(soft delete, deleted_at) 항목의 영구 삭제는 지금까지 RecycleBin.vue 가
--   화면을 열 때 클라이언트에서 실행했다. 관리자가 화면을 열지 않으면 만료 항목이
--   영구히 남았고, 보존 일수 30 은 코드 여러 곳에 박혀 있었다.
--   감사 로그 보관 정책(20260911000003_audit_log_retention.sql)과 같은 방식으로
--   DB 함수 + pg_cron 으로 옮긴다.
--
-- [구성]
--   ① public.configuration 의 key = 'operation_policy'
--        value = { "recycle_bin_retention_days": 30, ... }   (테넌트별, 화면: /admin-console/operation-policy)
--      행이 없거나 값이 없으면 기본 30일. 어떤 경우든 1 ~ 365 일로 clamp 한다(화면과 같은 범위).
--   ② public.purge_expired_recycle_bin(p_batch_size)
--      deleted_at 이 보존 일수를 넘긴 행을 테이블별로 지운다. 대상 테이블/컬럼이
--      없는 스냅샷에서도 실패하지 않도록 전부 존재 확인 후 동적 SQL 로 실행한다.
--        · proc_def            — 관련 행(form_def, proc_def_version, lock, todolist, bpm_proc_inst, tb_bpmn_model) 먼저 정리
--        · bpm_proc_inst, task_property_schema, audit_policy, kpi_targets,
--          lane_role_groups(+members), suppliers, systems
--        · configuration.pi_flag_types(JSON 배열의 deletedAt) — 배열에서 만료 항목 제거
--   ③ pg_cron 'recycle-bin-retention' — 매일 03:30. pg_cron 이 없는 환경에서도 통과.
--
-- [멱등성] CREATE OR REPLACE FUNCTION / cron 은 같은 이름 unschedule 후 재등록. 재실행 안전.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.purge_expired_recycle_bin(
    p_batch_size integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    DEFAULT_DAYS constant integer := 30;
    MIN_DAYS     constant integer := 1;
    MAX_DAYS     constant integer := 365;
    POLICY_KEY   constant text    := 'operation_policy';

    v_batch   integer := GREATEST(1, LEAST(COALESCE(p_batch_size, 500), 10000));
    v_result  jsonb := '{}'::jsonb;
    v_rows    bigint;
    v_total   bigint;
    v_table   text;
    v_pk      text;
    v_sql     text;
    -- 테넌트별 보존 일수 표현식 (configuration 이 없으면 기본값)
    v_days_expr text;
    v_has_config boolean := to_regclass('public.configuration') IS NOT NULL;
    v_pair    record;
    v_cfg     record;
    v_new     jsonb;
BEGIN
    IF v_has_config THEN
        v_days_expr := format($e$
            GREATEST(%1$s, LEAST(%2$s, COALESCE(
                (SELECT NULLIF(regexp_replace(COALESCE(c.value ->> 'recycle_bin_retention_days', ''), '[^0-9]', '', 'g'), '')::integer
                   FROM public.configuration c
                  WHERE c.key = %3$L AND c.tenant_id = t.tenant_id
                  LIMIT 1),
                %4$s)))
        $e$, MIN_DAYS, MAX_DAYS, POLICY_KEY, DEFAULT_DAYS);
    ELSE
        v_days_expr := DEFAULT_DAYS::text;
    END IF;

    -- ------------------------------------------------------------------
    -- 1. proc_def — 관련 테이블부터 정리한 뒤 본체 삭제
    -- ------------------------------------------------------------------
    IF to_regclass('public.proc_def') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proc_def' AND column_name = 'deleted_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'proc_def' AND column_name = 'tenant_id') THEN
        v_total := 0;
        LOOP
            CREATE TEMP TABLE IF NOT EXISTS _expired_proc_def (id text, tenant_id text) ON COMMIT DROP;
            TRUNCATE _expired_proc_def;
            EXECUTE format($sql$
                INSERT INTO _expired_proc_def (id, tenant_id)
                SELECT t.id::text, t.tenant_id::text
                  FROM public.proc_def t
                 WHERE t.deleted_at IS NOT NULL
                   AND t.deleted_at < now() - (%s) * INTERVAL '1 day'
                 LIMIT %s
            $sql$, v_days_expr, v_batch);
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            EXIT WHEN v_rows = 0;

            FOR v_pair IN
                SELECT * FROM (VALUES
                    ('form_def', 'proc_def_id'),
                    ('proc_def_version', 'proc_def_id'),
                    ('lock', 'id'),
                    ('todolist', 'proc_def_id'),
                    ('bpm_proc_inst', 'proc_def_id'),
                    ('tb_bpmn_model', 'proc_def_id')
                ) AS r(tbl, col)
            LOOP
                CONTINUE WHEN to_regclass('public.' || quote_ident(v_pair.tbl)) IS NULL
                           OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_pair.tbl AND column_name = v_pair.col);
                EXECUTE format('DELETE FROM public.%I d USING _expired_proc_def e WHERE d.%I::text = e.id', v_pair.tbl, v_pair.col);
            END LOOP;

            EXECUTE 'DELETE FROM public.proc_def d USING _expired_proc_def e WHERE d.id::text = e.id';
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_total := v_total + v_rows;
            EXIT WHEN v_rows < v_batch;
        END LOOP;
        v_result := v_result || jsonb_build_object('proc_def', v_total);
    END IF;

    -- ------------------------------------------------------------------
    -- 2. 단순 soft-delete 테이블들
    -- ------------------------------------------------------------------
    FOR v_pair IN
        SELECT * FROM (VALUES
            ('bpm_proc_inst', 'proc_inst_id'),
            ('task_property_schema', 'id'),
            ('audit_policy', 'id'),
            ('kpi_targets', 'id'),
            ('lane_role_groups', 'id'),
            ('suppliers', 'id'),
            ('systems', 'id')
        ) AS r(tbl, pk)
    LOOP
        v_table := v_pair.tbl;
        v_pk := v_pair.pk;
        CONTINUE WHEN to_regclass('public.' || quote_ident(v_table)) IS NULL
                   OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'deleted_at')
                   OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'tenant_id')
                   OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_pk);

        v_total := 0;
        LOOP
            -- lane_role_groups 는 멤버 행을 먼저 지운다 (FK 가 없어도 고아 행을 남기지 않기 위해)
            IF v_table = 'lane_role_groups' AND to_regclass('public.lane_role_group_members') IS NOT NULL
               AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lane_role_group_members' AND column_name = 'group_id') THEN
                EXECUTE format($sql$
                    DELETE FROM public.lane_role_group_members m
                     USING (SELECT t.%1$I AS pk FROM public.lane_role_groups t
                             WHERE t.deleted_at IS NOT NULL AND t.deleted_at < now() - (%2$s) * INTERVAL '1 day'
                             LIMIT %3$s) e
                     WHERE m.group_id::text = e.pk::text
                $sql$, v_pk, v_days_expr, v_batch);
            END IF;

            v_sql := format($sql$
                WITH expired AS (
                    SELECT t.%1$I AS pk
                      FROM public.%2$I t
                     WHERE t.deleted_at IS NOT NULL
                       AND t.deleted_at < now() - (%3$s) * INTERVAL '1 day'
                     LIMIT %4$s
                )
                DELETE FROM public.%2$I d USING expired e WHERE d.%1$I = e.pk
            $sql$, v_pk, v_table, v_days_expr, v_batch);
            EXECUTE v_sql;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_total := v_total + v_rows;
            EXIT WHEN v_rows < v_batch;
        END LOOP;
        v_result := v_result || jsonb_build_object(v_table, v_total);
    END LOOP;

    -- ------------------------------------------------------------------
    -- 3. PI Flag 유형 — configuration(key='pi_flag_types') JSON 배열의 deletedAt 항목
    -- ------------------------------------------------------------------
    IF v_has_config THEN
        v_total := 0;
        FOR v_cfg IN
            SELECT c.uuid, c.tenant_id, c.value,
                   GREATEST(MIN_DAYS, LEAST(MAX_DAYS, COALESCE(
                       (SELECT NULLIF(regexp_replace(COALESCE(p.value ->> 'recycle_bin_retention_days', ''), '[^0-9]', '', 'g'), '')::integer
                          FROM public.configuration p
                         WHERE p.key = POLICY_KEY AND p.tenant_id = c.tenant_id LIMIT 1),
                       DEFAULT_DAYS))) AS days
              FROM public.configuration c
             WHERE c.key = 'pi_flag_types'
               AND jsonb_typeof(c.value) = 'array'
        LOOP
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
              INTO v_new
              FROM jsonb_array_elements(v_cfg.value) AS elem
             WHERE NOT (
                 COALESCE(elem ->> 'deletedAt', '') <> ''
                 AND (elem ->> 'deletedAt')::timestamptz < now() - (v_cfg.days) * INTERVAL '1 day'
             );
            IF jsonb_array_length(v_new) <> jsonb_array_length(v_cfg.value) THEN
                UPDATE public.configuration SET value = v_new WHERE uuid = v_cfg.uuid;
                v_total := v_total + (jsonb_array_length(v_cfg.value) - jsonb_array_length(v_new));
            END IF;
        END LOOP;
        v_result := v_result || jsonb_build_object('pi_flag_types', v_total);
    END IF;

    RETURN v_result || jsonb_build_object('ran_at', now());
EXCEPTION WHEN OTHERS THEN
    -- 한 테이블의 실패가 전체를 막지 않도록 지금까지의 결과에 오류를 붙여 돌려준다.
    RETURN v_result || jsonb_build_object('error', SQLERRM, 'ran_at', now());
END;
$fn$;

COMMENT ON FUNCTION public.purge_expired_recycle_bin(integer) IS
'휴지통(soft delete) 항목 중 보존 일수(configuration.operation_policy.recycle_bin_retention_days, 기본 30, 1~365 clamp)를 넘긴 행을 영구 삭제한다. pg_cron recycle-bin-retention 이 매일 실행. 클라이언트 키로 호출 불가(SECURITY DEFINER + REVOKE).';

REVOKE ALL ON FUNCTION public.purge_expired_recycle_bin(integer) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- pg_cron 스케줄 등록 (매일 03:30 — 감사 로그 아카이브 03:00 뒤)
-- ---------------------------------------------------------------------------
DO $cron_setup$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron 이 설치되어 있지 않아 recycle-bin-retention 스케줄 등록을 건너뜁니다. 운영 DB 에서는 다음을 수동 실행하세요: SELECT cron.schedule(''recycle-bin-retention'', ''30 3 * * *'', ''SELECT public.purge_expired_recycle_bin();'');';
        RETURN;
    END IF;

    BEGIN
        PERFORM cron.unschedule('recycle-bin-retention');
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    PERFORM cron.schedule(
        'recycle-bin-retention',
        '30 3 * * *',
        'SELECT public.purge_expired_recycle_bin();'
    );
    RAISE NOTICE 'pg_cron 스케줄 recycle-bin-retention 등록 완료 (매일 03:30).';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'recycle-bin-retention 스케줄 등록 실패(무시): %', SQLERRM;
END;
$cron_setup$;
