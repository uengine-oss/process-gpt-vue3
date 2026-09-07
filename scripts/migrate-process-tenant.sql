\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _process_tenant_migration_context (
    source_tenant text NOT NULL,
    target_tenant text NOT NULL,
    include_runtime boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO _process_tenant_migration_context
    (source_tenant, target_tenant, include_runtime)
VALUES
    (:'source_tenant', :'target_tenant', :'include_runtime'::boolean);

DO $validate$
DECLARE
    v_source text;
    v_target text;
    v_conflict boolean;
BEGIN
    SELECT source_tenant, target_tenant
      INTO v_source, v_target
      FROM _process_tenant_migration_context;

    IF btrim(v_source) = '' THEN
        RAISE EXCEPTION 'source tenant must not be empty';
    END IF;

    IF btrim(v_target) = '' THEN
        RAISE EXCEPTION 'target tenant must not be empty';
    END IF;

    IF v_source = v_target THEN
        RAISE EXCEPTION 'source and target tenant are identical: %', v_source;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_source) THEN
        RAISE EXCEPTION 'source tenant does not exist: %', v_source;
    END IF;

    -- These tables have tenant-scoped natural keys. Abort before changing any
    -- row instead of silently merging or overwriting target data.
    IF EXISTS (
        SELECT 1
          FROM public.proc_def source_row
          JOIN public.proc_def target_row ON target_row.id = source_row.id
         WHERE source_row.tenant_id = v_source
           AND target_row.tenant_id = v_target
    ) THEN
        RAISE EXCEPTION 'proc_def id conflict exists between % and %', v_source, v_target;
    END IF;

    IF to_regclass('public.configuration') IS NOT NULL THEN
        EXECUTE $query$
            SELECT EXISTS (
                SELECT 1
                  FROM public.configuration source_row
                  JOIN public.configuration target_row ON target_row.key = source_row.key
                 WHERE source_row.tenant_id = $1
                   AND target_row.tenant_id = $2
                   AND source_row.key IN ('proc_map', 'metrics')
            )
        $query$ INTO v_conflict USING v_source, v_target;
        IF v_conflict THEN
            RAISE EXCEPTION 'configuration key conflict (proc_map/metrics) exists between % and %', v_source, v_target;
        END IF;
    END IF;

    IF to_regclass('public.form_def') IS NOT NULL THEN
        EXECUTE $query$
            SELECT EXISTS (
                SELECT 1
                  FROM public.form_def source_row
                  JOIN public.form_def target_row ON target_row.id = source_row.id
                 WHERE source_row.tenant_id = $1
                   AND target_row.tenant_id = $2
                   AND source_row.id IS NOT NULL
            )
        $query$ INTO v_conflict USING v_source, v_target;
        IF v_conflict THEN
            RAISE EXCEPTION 'form_def id conflict exists between % and %', v_source, v_target;
        END IF;
    END IF;

    IF to_regclass('public.tb_bpmn_model') IS NOT NULL THEN
        EXECUTE $query$
            SELECT EXISTS (
                SELECT 1
                  FROM public.tb_bpmn_model source_row
                  JOIN public.tb_bpmn_model target_row ON target_row.proc_def_id = source_row.proc_def_id
                 WHERE source_row.tenant_id = $1
                   AND target_row.tenant_id = $2
            )
        $query$ INTO v_conflict USING v_source, v_target;
        IF v_conflict THEN
            RAISE EXCEPTION 'tb_bpmn_model proc_def_id conflict exists between % and %', v_source, v_target;
        END IF;
    END IF;
END
$validate$;

-- Creating the target is part of the same transaction, so preview mode also
-- verifies the FK path without leaving a tenant behind.
INSERT INTO public.tenants (id, owner)
VALUES (:'target_tenant', NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _process_tenant_migration_report (
    category text NOT NULL,
    table_name text NOT NULL,
    moved_rows bigint,
    note text
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.move_process_tenant_rows(
    p_category text,
    p_table_name text,
    p_predicate text DEFAULT 'true'
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_source text;
    v_target text;
    v_table regclass;
    v_count bigint;
BEGIN
    SELECT source_tenant, target_tenant
      INTO v_source, v_target
      FROM _process_tenant_migration_context;

    v_table := to_regclass(p_table_name);
    IF v_table IS NULL THEN
        INSERT INTO _process_tenant_migration_report
            (category, table_name, moved_rows, note)
        VALUES
            (p_category, p_table_name, NULL, 'table not present; skipped');
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_attribute
         WHERE attrelid = v_table
           AND attname = 'tenant_id'
           AND NOT attisdropped
    ) THEN
        INSERT INTO _process_tenant_migration_report
            (category, table_name, moved_rows, note)
        VALUES
            (p_category, p_table_name, NULL, 'tenant_id column not present; skipped');
        RETURN;
    END IF;

    -- A tenant-only ownership change must not create workflow notifications or
    -- rewrite business updated_at values. RI constraint triggers remain active.
    EXECUTE format('ALTER TABLE %s DISABLE TRIGGER USER', v_table);
    BEGIN
        EXECUTE format(
            'UPDATE %s SET tenant_id = $1 WHERE tenant_id = $2 AND (%s)',
            v_table,
            p_predicate
        ) USING v_target, v_source;
        GET DIAGNOSTICS v_count = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        EXECUTE format('ALTER TABLE %s ENABLE TRIGGER USER', v_table);
        RAISE;
    END;
    EXECUTE format('ALTER TABLE %s ENABLE TRIGGER USER', v_table);

    INSERT INTO _process_tenant_migration_report
        (category, table_name, moved_rows, note)
    VALUES
        (p_category, p_table_name, v_count, NULL);
END
$function$;

-- Process hierarchy and definitions. Child tables without tenant_id
-- (tb_bpmn_lane/node/link/version/lock) remain connected by model_id.
DO $design_data$
DECLARE
    v_item record;
BEGIN
    FOR v_item IN
        SELECT *
          FROM (VALUES
              ('hierarchy',     'public.configuration',             $predicate$key IN ('proc_map', 'metrics')$predicate$),
              ('hierarchy',     'public.proc_map_history',          'true'),
              ('definition',    'public.proc_def_arcv',             'true'),
              ('definition',    'public.proc_def_version',          'true'),
              ('definition',    'public.form_def',                  'true'),
              ('definition',    'public.tb_bpmn_model',             'true'),
              ('definition',    'public.bpmn_element_map',          'true'),
              ('governance',    'public.proc_def_comments',         'true'),
              ('governance',    'public.proc_def_approval_history', 'true'),
              ('governance',    'public.proc_def_snapshots',        'true'),
              ('governance',    'public.proc_def_approval_state',   'true'),
              ('governance',    'public.proc_def_copilot_log',      'true'),
              ('configuration', 'public.activity_config',           'true'),
              ('configuration', 'public.fte_capacity',              'true'),
              ('configuration', 'public.task_property_schema',      'true'),
              ('configuration', 'public.palette_task_types',        'true'),
              ('marketplace',   'public.installed_components',      'true'),
              ('improvement',   'public.feedback_proposals',        'true')
          ) AS manifest(category, table_name, predicate)
    LOOP
        PERFORM pg_temp.move_process_tenant_rows(
            v_item.category,
            v_item.table_name,
            v_item.predicate
        );
    END LOOP;

    -- Move the definition last. Its UUID is preserved, so bpmn_element_map
    -- and every non-tenant child relation continue to point at it.
    PERFORM pg_temp.move_process_tenant_rows('definition', 'public.proc_def');
END
$design_data$;

DO $runtime$
DECLARE
    v_include_runtime boolean;
BEGIN
    SELECT include_runtime
      INTO v_include_runtime
      FROM _process_tenant_migration_context;

    IF v_include_runtime THEN
        PERFORM pg_temp.move_process_tenant_rows('runtime', 'public.task_execution_properties');
        PERFORM pg_temp.move_process_tenant_rows('runtime', 'public.fte_snapshot');
        PERFORM pg_temp.move_process_tenant_rows('runtime', 'public.todolist');
        PERFORM pg_temp.move_process_tenant_rows('runtime', 'public.bpm_proc_inst');
    ELSE
        INSERT INTO _process_tenant_migration_report
            (category, table_name, moved_rows, note)
        VALUES
            ('runtime', 'runtime tables', NULL, 'excluded; use --include-runtime to move them');
    END IF;
END
$runtime$;

SELECT category, table_name, moved_rows, COALESCE(note, '') AS note
  FROM _process_tenant_migration_report
 ORDER BY category, table_name;

SELECT
    (SELECT source_tenant FROM _process_tenant_migration_context) AS source_tenant,
    (SELECT target_tenant FROM _process_tenant_migration_context) AS target_tenant,
    COALESCE(SUM(moved_rows), 0) AS total_moved_rows
  FROM _process_tenant_migration_report;

\if :apply
COMMIT;
\echo 'APPLIED: process data tenant migration committed.'
\else
ROLLBACK;
\echo 'PREVIEW: all changes rolled back. Re-run with --apply to commit.'
\endif
