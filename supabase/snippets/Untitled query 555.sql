create table if not exists public.signup_requests (
    id uuid not null default gen_random_uuid (),
    user_id uuid not null,
    username text null,
    email text not null,
    tenant_id text not null default public.tenant_id(),
    status text not null default 'pending',
    reject_reason text null,
    reviewed_by text null,
    reviewed_at timestamp with time zone null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint signup_requests_pkey primary key (id),
    constraint signup_requests_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade,
    constraint signup_requests_status_check check (
        status = any (array['pending'::text, 'approved'::text, 'rejected'::text])
    ),
    constraint signup_requests_user_tenant_unique unique (user_id, tenant_id),
    constraint signup_requests_email_tenant_unique unique (email, tenant_id)
) tablespace pg_default;