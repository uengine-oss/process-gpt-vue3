-- Fixed single-tenant setup for TYM.
-- Keeps auth.users metadata and public.users membership in sync for existing
-- users, and assigns the tenant claim to future signups.

INSERT INTO public.tenants (id, owner)
VALUES (
    'tym',
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

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
    (t.owner = au.id),
    CASE WHEN t.owner = au.id THEN 'superAdmin' ELSE 'user' END,
    'tym'
FROM auth.users au
CROSS JOIN public.tenants t
WHERE t.id = 'tym'
ON CONFLICT (id, tenant_id) DO UPDATE
SET username = EXCLUDED.username,
    email = EXCLUDED.email,
    is_admin = EXCLUDED.is_admin,
    role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION public.set_auth_user_tenant_id_tym()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    UPDATE auth.users u
    SET raw_app_meta_data =
        COALESCE(u.raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('tenant_id', 'tym')
    WHERE u.id = NEW.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_auth_user_tenant_id_localhost ON auth.users;
DROP TRIGGER IF EXISTS trg_set_auth_user_tenant_id_tym ON auth.users;
CREATE TRIGGER trg_set_auth_user_tenant_id_tym
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.set_auth_user_tenant_id_tym();

DROP FUNCTION IF EXISTS public.set_auth_user_tenant_id_localhost();
