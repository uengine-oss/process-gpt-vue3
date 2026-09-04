-- Keep the fixed TYM tenant membership in sync with Supabase Auth.
-- The previous trigger only added the tenant claim and did not create the
-- corresponding public.users row for signups made after that migration.

INSERT INTO public.tenants (id, owner)
VALUES (
    'tym',
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
)
ON CONFLICT (id) DO UPDATE
SET owner = COALESCE(public.tenants.owner, EXCLUDED.owner);

CREATE OR REPLACE FUNCTION public.set_auth_user_tenant_id_tym()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    tenant_owner uuid;
BEGIN
    -- The first account becomes the tenant owner when no owner exists yet.
    UPDATE public.tenants
    SET owner = COALESCE(owner, NEW.id)
    WHERE id = 'tym'
    RETURNING owner INTO tenant_owner;

    UPDATE auth.users
    SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('tenant_id', 'tym')
    WHERE id = NEW.id;

    INSERT INTO public.users (id, username, email, is_admin, role, tenant_id)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
        NEW.email,
        tenant_owner = NEW.id,
        CASE WHEN tenant_owner = NEW.id THEN 'superAdmin' ELSE 'user' END,
        'tym'
    )
    ON CONFLICT (id, tenant_id) DO UPDATE
    SET username = EXCLUDED.username,
        email = EXCLUDED.email,
        is_admin = EXCLUDED.is_admin,
        role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_auth_user_tenant_id_localhost ON auth.users;
DROP TRIGGER IF EXISTS trg_set_auth_user_tenant_id_tym ON auth.users;
CREATE TRIGGER trg_set_auth_user_tenant_id_tym
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.set_auth_user_tenant_id_tym();

-- Repair accounts that were created while the incomplete trigger was active.
UPDATE auth.users
SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('tenant_id', 'tym')
WHERE COALESCE(raw_app_meta_data->>'tenant_id', '') <> 'tym';

INSERT INTO public.users (id, username, email, is_admin, role, tenant_id)
SELECT
    au.id,
    COALESCE(NULLIF(au.raw_user_meta_data->>'name', ''), split_part(au.email, '@', 1)),
    au.email,
    t.owner = au.id,
    CASE WHEN t.owner = au.id THEN 'superAdmin' ELSE 'user' END,
    'tym'
FROM auth.users au
JOIN public.tenants t ON t.id = 'tym'
ON CONFLICT (id, tenant_id) DO UPDATE
SET username = EXCLUDED.username,
    email = EXCLUDED.email,
    is_admin = EXCLUDED.is_admin,
    role = EXCLUDED.role;
