-- =============================================================================
-- Duplicate process definition from marketplace into proc_def/form_def
-- =============================================================================

DROP FUNCTION IF EXISTS public.duplicate_definition_from_marketplace(text, text, text);
DROP FUNCTION IF EXISTS public.duplicate_definition_from_marketplace(text, text, text, text);

CREATE OR REPLACE FUNCTION public.duplicate_definition_from_marketplace(
    p_definition_id TEXT,
    p_definition_name TEXT,
    p_tenant_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_proc_def_record RECORD;
    v_form_def_record RECORD;
    v_proc_def_uuid UUID;
    v_form_def_uuid UUID;
    v_new_definition_id TEXT;
    v_new_definition JSONB;
    v_activities JSONB;
    v_activity JSONB;
    v_tool TEXT;
    v_form_id TEXT;
BEGIN
    SELECT *
      INTO v_proc_def_record
      FROM public.proc_def_marketplace
     WHERE id = p_definition_id
       AND name = p_definition_name;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Process definition not found in marketplace');
    END IF;

    v_new_definition_id := p_definition_id || '_' || gen_random_uuid()::TEXT;

    v_new_definition := v_proc_def_record.definition;
    v_new_definition := jsonb_set(
        v_new_definition,
        '{processDefinitionId}',
        to_jsonb(v_new_definition_id)
    );

    v_activities := COALESCE(v_new_definition->'activities', '[]'::jsonb);

    FOR v_activity IN SELECT * FROM jsonb_array_elements(v_activities)
    LOOP
        v_tool := v_activity->>'tool';
        IF v_tool = 'form' THEN
            v_form_id := v_activity->>'form';
            IF v_form_id IS NOT NULL AND v_form_id <> '' THEN
                v_new_definition := replace(v_new_definition::TEXT, v_form_id, v_new_definition_id || '_' || v_form_id)::jsonb;
            END IF;
        END IF;
    END LOOP;

    INSERT INTO public.proc_def (
        id,
        name,
        definition,
        bpmn,
        tenant_id
    ) VALUES (
        v_new_definition_id,
        v_proc_def_record.name,
        v_new_definition,
        v_proc_def_record.bpmn,
        p_tenant_id
    )
    ON CONFLICT (id, tenant_id) DO UPDATE SET
        name = EXCLUDED.name,
        definition = EXCLUDED.definition,
        bpmn = EXCLUDED.bpmn;

    SELECT uuid
      INTO v_proc_def_uuid
      FROM public.proc_def
     WHERE id = v_new_definition_id
       AND tenant_id = p_tenant_id;

    FOR v_form_def_record IN
        SELECT *
          FROM public.form_def_marketplace
         WHERE proc_def_id = p_definition_id
    LOOP
        v_form_id := v_form_def_record.id;

        INSERT INTO public.form_def (
            id,
            proc_def_id,
            activity_id,
            html,
            tenant_id
        ) VALUES (
            v_new_definition_id || '_' || v_form_id,
            v_new_definition_id,
            v_form_def_record.activity_id,
            v_form_def_record.html,
            p_tenant_id
        )
        ON CONFLICT (id, tenant_id) DO UPDATE SET
            proc_def_id = EXCLUDED.proc_def_id,
            activity_id = EXCLUDED.activity_id,
            html = EXCLUDED.html;

        SELECT uuid
          INTO v_form_def_uuid
          FROM public.form_def
         WHERE id = v_new_definition_id || '_' || v_form_id
           AND tenant_id = p_tenant_id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'new_definition_id', v_new_definition_id,
        'proc_def_uuid', v_proc_def_uuid
    );
END;
$$;
