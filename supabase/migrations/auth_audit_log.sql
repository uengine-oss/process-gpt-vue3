-- =============================================================================
-- Auth login/logout audit logging
-- - Records *all* login attempts (success/failure) and logout timestamps
-- - Designed to be callable even before authentication (anon role)
-- =============================================================================

-- 1) Audit table
CREATE TABLE IF NOT EXISTS public.auth_login_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Can be NULL for pre-auth attempts or unknown tenant
    tenant_id text NULL,

    -- What user tried (may be NULL for OAuth-only flows)
    email text NULL,

    -- login/logout/login_oauth
    action text NOT NULL,

    -- Whether the attempt succeeded (for oauth-start we still record as true/false based on caller intent)
    success boolean NOT NULL,

    -- Optional error message on failures
    error_message text NULL,

    -- auth.users id (available only when request is authenticated)
    user_id uuid NULL,

    -- Optional client info
    ip_address text NULL,
    user_agent text NULL,

    -- Extra context (provider, headers, etc.)
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT auth_login_audit_tenant_fkey
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
        ON UPDATE CASCADE ON DELETE SET NULL,

    CONSTRAINT auth_login_audit_action_check
        CHECK (action IN ('login', 'logout', 'login_oauth'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_created_at ON public.auth_login_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_tenant_created_at ON public.auth_login_audit (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_email_created_at ON public.auth_login_audit (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_user_created_at ON public.auth_login_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_action_created_at ON public.auth_login_audit (action, created_at DESC);

COMMENT ON TABLE public.auth_login_audit IS 'Login/logout audit trail (includes failed login attempts).';

-- 2) RLS
ALTER TABLE public.auth_login_audit ENABLE ROW LEVEL SECURITY;

-- Insert allowed for anon (pre-auth) and authenticated (app will write via RPC)
DROP POLICY IF EXISTS "auth_login_audit_insert_anon" ON public.auth_login_audit;
CREATE POLICY "auth_login_audit_insert_anon" ON public.auth_login_audit
    FOR INSERT TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "auth_login_audit_insert_authenticated" ON public.auth_login_audit;
CREATE POLICY "auth_login_audit_insert_authenticated" ON public.auth_login_audit
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IS NULL OR tenant_id = public.tenant_id());

-- Select only for tenant admins (authenticated)
DROP POLICY IF EXISTS "auth_login_audit_select_admin" ON public.auth_login_audit;
CREATE POLICY "auth_login_audit_select_admin" ON public.auth_login_audit
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.is_admin = true
              AND u.tenant_id = auth_login_audit.tenant_id
        )
    );

-- 3) Grants (RLS still applies)
GRANT INSERT ON public.auth_login_audit TO anon, authenticated;
GRANT SELECT ON public.auth_login_audit TO authenticated;

-- 4) RPC function: record_auth_audit
DROP FUNCTION IF EXISTS public.record_auth_audit(text, text, boolean, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.record_auth_audit(
    p_action text,
    p_email text,
    p_success boolean,
    p_error_message text DEFAULT NULL,
    p_tenant_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_tenant_id text;
    v_headers jsonb;
    v_user_agent text;
    v_ip text;
BEGIN
    IF p_action IS NULL OR btrim(p_action) = '' THEN
        RAISE EXCEPTION 'p_action is required';
    END IF;

    IF p_action NOT IN ('login', 'logout', 'login_oauth') THEN
        RAISE EXCEPTION 'invalid p_action: %', p_action;
    END IF;

    -- tenant_id: prefer explicit parameter (pre-auth), otherwise use JWT-derived tenant id
    v_tenant_id := NULLIF(btrim(COALESCE(p_tenant_id, public.tenant_id())), '');

    -- Best-effort request headers extraction (may be NULL depending on execution context)
    BEGIN
        v_headers := current_setting('request.headers', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    v_user_agent := COALESCE(v_headers->>'user-agent', v_headers->>'User-Agent');

    v_ip := NULL;
    IF v_headers ? 'x-forwarded-for' THEN
        v_ip := btrim(split_part(v_headers->>'x-forwarded-for', ',', 1));
    ELSIF v_headers ? 'x-real-ip' THEN
        v_ip := btrim(v_headers->>'x-real-ip');
    END IF;

    INSERT INTO public.auth_login_audit (
        tenant_id,
        email,
        action,
        success,
        error_message,
        user_id,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        v_tenant_id,
        NULLIF(btrim(p_email), ''),
        p_action,
        p_success,
        NULLIF(btrim(p_error_message), ''),
        auth.uid(),
        NULLIF(v_ip, ''),
        NULLIF(btrim(v_user_agent), ''),
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('headers', v_headers)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_auth_audit(text, text, boolean, text, text, jsonb) TO anon, authenticated;

