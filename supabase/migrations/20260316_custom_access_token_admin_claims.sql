-- =============================================================================
-- Custom Access Token Hook: inject users.is_admin into JWT claims
--
-- Purpose
-- - Read admin/role information from public.users
-- - Add it to access token claims at sign-in / refresh time
--
-- Notes
-- - After applying this migration, enable the hook in Supabase Dashboard:
--   Authentication -> Hooks -> Custom Access Token -> public.custom_access_token_hook
-- - Claims are refreshed on next token issue/refresh, not instantly.
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
    v_role text := null;
BEGIN
    v_user_id := NULLIF(event->>'user_id', '')::uuid;
    claims := COALESCE(event->'claims', '{}'::jsonb);

    -- Resolve tenant_id as defensively as possible.
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
      INTO v_is_admin, v_role
      FROM public.users u
     WHERE u.id = v_user_id
       AND u.tenant_id = v_tenant_id
     LIMIT 1;

    claims := jsonb_set(claims, '{is_admin}', to_jsonb(COALESCE(v_is_admin, false)), true);
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id), true);

    IF v_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{role}', to_jsonb(v_role), true);
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

    IF v_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(v_role), true);
    END IF;

    event := jsonb_set(event, '{claims}', claims, true);
    RETURN event;
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
'Supabase Custom Access Token Hook. Injects users.is_admin/role/tenant_id into JWT claims.';
