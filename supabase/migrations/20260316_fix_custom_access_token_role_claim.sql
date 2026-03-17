-- =============================================================================
-- Fix custom access token hook:
-- - do not overwrite the reserved JWT role claim
-- - expose application role as user_role instead
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    claims jsonb;
    v_user_id uuid;
    v_tenant_id text;
    v_is_admin boolean := false;
    v_user_role text := null;
BEGIN
    v_user_id := NULLIF(event->>'user_id', '')::uuid;
    claims := COALESCE(event->'claims', '{}'::jsonb);

    v_tenant_id := COALESCE(
        claims->>'tenant_id',
        claims->'app_metadata'->>'tenant_id',
        (
            SELECT u.raw_app_meta_data->>'tenant_id'
            FROM auth.users u
            WHERE u.id = v_user_id
        ),
        'localhost'
    );

    SELECT u.is_admin, u.role
      INTO v_is_admin, v_user_role
      FROM public.users u
     WHERE u.id = v_user_id
       AND u.tenant_id = v_tenant_id
     LIMIT 1;

    claims := jsonb_set(claims, '{is_admin}', to_jsonb(COALESCE(v_is_admin, false)), true);
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id), true);

    IF v_user_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{user_role}', to_jsonb(v_user_role), true);
    END IF;

    claims := jsonb_set(
        claims,
        '{app_metadata,is_admin}',
        to_jsonb(COALESCE(v_is_admin, false)),
        true
    );
    claims := jsonb_set(
        claims,
        '{app_metadata,tenant_id}',
        to_jsonb(v_tenant_id),
        true
    );

    IF v_user_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(v_user_role), true);
    END IF;

    event := jsonb_set(event, '{claims}', claims, true);
    RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Supabase Custom Access Token Hook. Injects users.is_admin/user_role/tenant_id into JWT claims.';
