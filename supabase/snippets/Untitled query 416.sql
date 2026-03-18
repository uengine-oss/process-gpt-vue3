ALTER TABLE signup_requests ENABLE ROW LEVEL SECURITY;

-- Signup requests policies
CREATE POLICY signup_requests_insert_policy ON signup_requests
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.tenant_id());

CREATE POLICY signup_requests_select_policy ON signup_requests
FOR SELECT TO authenticated
USING (
    (tenant_id = public.tenant_id())
    AND (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM users
            WHERE users.id = auth.uid()
              AND users.tenant_id = public.tenant_id()
              AND users.is_admin = true
        )
    )
);

CREATE POLICY signup_requests_update_policy ON signup_requests
FOR UPDATE TO authenticated
USING (
    (tenant_id = public.tenant_id())
    AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.tenant_id = public.tenant_id()
          AND users.is_admin = true
    )
)
WITH CHECK (
    (tenant_id = public.tenant_id())
    AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.tenant_id = public.tenant_id()
          AND users.is_admin = true
    )
);

CREATE POLICY signup_requests_delete_policy ON signup_requests
FOR DELETE TO authenticated
USING (
    (tenant_id = public.tenant_id())
    AND EXISTS (
        SELECT 1
        FROM users
        WHERE users.id = auth.uid()
          AND users.tenant_id = public.tenant_id()
          AND users.is_admin = true
    )
);