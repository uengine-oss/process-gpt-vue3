create table if not exists public.tenants (
    id text not null,
    owner uuid null default auth.uid (),
    constraint tenants_pkey primary key (id)
) tablespace pg_default;

INSERT INTO public.tenants (id, owner) VALUES ('process-gpt', '');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='id') THEN
        ALTER TABLE public.tenants ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='owner') THEN
        ALTER TABLE public.tenants ADD COLUMN owner uuid null default auth.uid();
    END IF;
END;
$$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_insert_policy
    ON tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY tenants_select_policy
    ON tenants
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY tenants_update_policy
    ON tenants
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner);

CREATE POLICY tenants_delete_policy
    ON tenants
    FOR DELETE
    TO authenticated
    USING (auth.uid() = owner);



SET request.jwt.claims = '{"app_metadata": {"tenant_id": "your_tenant_id"}}';
create or replace function auth.tenant_id()
returns text
language sql stable
as $$
    select 
        nullif(
            ((current_setting('request.jwt.claims')::jsonb ->>  'app_metadata')::jsonb ->> 'tenant_id'),
            ''
        )::text
$$;



create table if not exists public.users (
    id uuid not null,
    username text null,
    profile text null default '/images/defaultUser.png'::text,
    email text null,
    is_admin boolean not null default false,
    role text null,
    tenant_id text null,
    constraint users_pkey primary key (id, tenant_id),
    constraint users_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id') THEN
        ALTER TABLE public.users ADD COLUMN id uuid not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
        ALTER TABLE public.users ADD COLUMN username text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile') THEN
        ALTER TABLE public.users ADD COLUMN profile text null default '/images/defaultUser.png'::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
        ALTER TABLE public.users ADD COLUMN email text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
        ALTER TABLE public.users ADD COLUMN is_admin boolean not null default false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
        ALTER TABLE public.users ADD COLUMN role text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
        ALTER TABLE public.users ADD COLUMN tenant_id text null;
    END IF;
END;
$$;

create or replace function public.handle_delete_user() 
returns trigger as $$
begin
    delete from auth.users where id = old.id;
    return old;
end;
$$ language plpgsql security definer;

create or replace trigger on_public_user_deleted
    after delete on public.users
    for each row execute procedure public.handle_delete_user();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_insert_policy
    ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY users_select_policy
    ON users
    FOR SELECT
    TO public
    USING (
        true
    );

CREATE POLICY users_update_policy
    ON users
    FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1
            FROM users u
            WHERE u.is_admin = true
        )
        OR
        auth.uid() = id
    )
    WITH CHECK (
        true
    );

CREATE POLICY users_delete_policy
    ON users
    FOR DELETE
    TO authenticated
    USING (auth.tenant_id() = tenant_id);



DROP TRIGGER IF EXISTS after_tenant_delete ON public.tenants;
DROP FUNCTION IF EXISTS update_users_on_tenant_delete();
DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;
DROP FUNCTION IF EXISTS public.handle_delete_user();



create table if not exists public.configuration (
    key text not null,
    value jsonb null,
    tenant_id text null default auth.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint configuration_pkey primary key (uuid),
    constraint configuration_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='key') THEN
        ALTER TABLE public.configuration ADD COLUMN key text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='value') THEN
        ALTER TABLE public.configuration ADD COLUMN value jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='uuid') THEN
        ALTER TABLE public.configuration ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuration' AND column_name='tenant_id') THEN
        ALTER TABLE public.configuration ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY configuration_insert_policy
    ON configuration
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY configuration_select_policy
    ON configuration
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY configuration_update_policy
    ON configuration
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY configuration_delete_policy
    ON configuration
    FOR DELETE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));



create table if not exists public.proc_map_history (
    value jsonb not null,
    created_at timestamp with time zone not null default now(),
    tenant_id text null default auth.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint proc_map_history_pkey primary key (uuid),
    constraint proc_map_history_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='value') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN value jsonb not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='created_at') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN created_at timestamp with time zone not null default now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='tenant_id') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_map_history' AND column_name='uuid') THEN
        ALTER TABLE public.proc_map_history ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
END;
$$;

ALTER TABLE proc_map_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_map_history_insert_policy
    ON proc_map_history
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY proc_map_history_select_policy
    ON proc_map_history
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY proc_map_history_update_policy
    ON proc_map_history
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY proc_map_history_delete_policy
    ON proc_map_history
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE OR REPLACE FUNCTION public.save_previous_proc_map()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.key = 'proc_map' THEN
        INSERT INTO public.proc_map_history(value, tenant_id, created_at)
        VALUES (OLD.value, OLD.tenant_id, now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

create or replace trigger trigger_save_previous_proc_map
BEFORE UPDATE ON configuration
FOR EACH ROW
WHEN (OLD.key = 'proc_map' AND NEW.value IS DISTINCT FROM OLD.value)
EXECUTE PROCEDURE public.save_previous_proc_map();



create table if not exists public.proc_def (
    id text not null,
    name text null,
    definition jsonb null,
    bpmn text null,
    uuid uuid not null default gen_random_uuid (),
    tenant_id text null default auth.tenant_id(),
    isdeleted boolean not null default false,
    constraint proc_def_pkey primary key (uuid),
    constraint proc_def_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='id') THEN
        ALTER TABLE public.proc_def ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='name') THEN
        ALTER TABLE public.proc_def ADD COLUMN name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='definition') THEN
        ALTER TABLE public.proc_def ADD COLUMN definition jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='bpmn') THEN
        ALTER TABLE public.proc_def ADD COLUMN bpmn text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='uuid') THEN
        ALTER TABLE public.proc_def ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def' AND column_name='tenant_id') THEN
        ALTER TABLE public.proc_def ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE proc_def ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_def_insert_policy
    ON proc_def
    FOR INSERT
    TO authenticated
    WITH CHECK ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY proc_def_select_policy
    ON proc_def
    FOR SELECT        
    TO authenticated
    USING (
        tenant_id = auth.tenant_id()
    );

CREATE POLICY proc_def_update_policy
    ON proc_def
    FOR UPDATE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY proc_def_delete_policy
    ON proc_def
    FOR DELETE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));



create table if not exists public.proc_def_arcv (
    arcv_id text not null,
    proc_def_id text not null,
    version text not null,
    snapshot text null,
    "timeStamp" timestamp without time zone null default current_timestamp,
    diff text null,
    message text null,
    uuid uuid not null default gen_random_uuid (),
    tenant_id text null default auth.tenant_id(),
    constraint proc_def_arcv_pkey primary key (uuid),
    constraint proc_def_arcv_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='arcv_id') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN arcv_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='proc_def_id') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN proc_def_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='version') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN version text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='snapshot') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN snapshot text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='timeStamp') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN timeStamp timestamp without time zone null default current_timestamp;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='diff') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN diff text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='message') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN message text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='uuid') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_arcv' AND column_name='tenant_id') THEN
        ALTER TABLE public.proc_def_arcv ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE proc_def_arcv ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_def_arcv_insert_policy
    ON proc_def_arcv
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY proc_def_arcv_select_policy
    ON proc_def_arcv
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY proc_def_arcv_update_policy
    ON proc_def_arcv
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());;

CREATE POLICY proc_def_arcv_delete_policy
    ON proc_def_arcv
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());



create table if not exists public.form_def (
    uuid uuid not null default gen_random_uuid (),
    html text not null,
    proc_def_id text not null,
    activity_id text not null,
    tenant_id text null default auth.tenant_id(),
    id text null default ''::text,
    fields_json jsonb null,
    constraint form_def_pkey primary key (uuid),
    constraint form_def_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='uuid') THEN
        ALTER TABLE public.form_def ADD COLUMN uuid uuid not null default gen_random_uuid ();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='html') THEN
        ALTER TABLE public.form_def ADD COLUMN html text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='proc_def_id') THEN
        ALTER TABLE public.form_def ADD COLUMN proc_def_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='activity_id') THEN
        ALTER TABLE public.form_def ADD COLUMN activity_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='tenant_id') THEN
        ALTER TABLE public.form_def ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='id') THEN
        ALTER TABLE public.form_def ADD COLUMN id text null default ''::text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def' AND column_name='fields_json') THEN
        ALTER TABLE public.form_def ADD COLUMN fields_json jsonb null;
    END IF;
END;
$$;

ALTER TABLE form_def ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_def_insert_policy
    ON form_def
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY form_def_select_policy
    ON form_def
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY form_def_update_policy
    ON form_def
    FOR UPDATE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY form_def_delete_policy
    ON form_def
    FOR DELETE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));



create table if not exists public.notifications (
    id uuid not null,
    title text null,
    type text null,
    description text null,
    is_checked boolean null default false,
    time_stamp timestamp with time zone null default now(),
    user_id text null,
    url text null,
    from_user_id text null,
    tenant_id text null default auth.tenant_id(),
    constraint notifications_pkey primary key (id),
    constraint notifications_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='id') THEN
        ALTER TABLE public.notifications ADD COLUMN id uuid not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='title') THEN
        ALTER TABLE public.notifications ADD COLUMN title text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
        ALTER TABLE public.notifications ADD COLUMN type text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='description') THEN
        ALTER TABLE public.notifications ADD COLUMN description text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='is_checked') THEN
        ALTER TABLE public.notifications ADD COLUMN is_checked boolean null default false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='time_stamp') THEN
        ALTER TABLE public.notifications ADD COLUMN time_stamp timestamp with time zone null default now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id') THEN
        ALTER TABLE public.notifications ADD COLUMN user_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='url') THEN
        ALTER TABLE public.notifications ADD COLUMN url text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='tenant_id') THEN
        ALTER TABLE public.notifications ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='from_user_id') THEN
        ALTER TABLE public.notifications ADD COLUMN from_user_id text null;
    END IF;
END;
$$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_insert_policy
    ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY notifications_select_policy
    ON notifications
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY notifications_update_policy
    ON notifications
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY notifications_delete_policy
    ON notifications
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());



create table if not exists public.lock (
    id text not null,
    user_id text null,
    tenant_id text null default auth.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint lock_pkey primary key (uuid),
    constraint lock_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='id') THEN
        ALTER TABLE public.lock ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='user_id') THEN
        ALTER TABLE public.lock ADD COLUMN user_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='tenant_id') THEN
        ALTER TABLE public.lock ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lock' AND column_name='uuid') THEN
        ALTER TABLE public.lock ADD COLUMN uuid uuid not null default gen_random_uuid();
    END IF;
END;
$$;

ALTER TABLE lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY lock_insert_policy
    ON lock
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY lock_select_policy
    ON lock
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY lock_update_policy
    ON lock
    FOR UPDATE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));

CREATE POLICY lock_delete_policy
    ON lock
    FOR DELETE
    TO authenticated
    USING (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))));



create table if not exists public.bpm_proc_inst (
    proc_def_id text null,
    proc_inst_id text not null,
    proc_inst_name text null,
    current_activity_ids text[] null,
    current_user_ids text[] null,
    role_bindings jsonb null,
    variables_data jsonb null,
    status text null,
    tenant_id text null default auth.tenant_id(),
    proc_def_version text null,
    constraint bpm_proc_inst_pkey primary key (proc_inst_id),
    constraint bpm_proc_inst_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='proc_def_id') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN proc_def_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='proc_inst_id') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN proc_inst_id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='proc_inst_name') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN proc_inst_name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='current_activity_ids') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN current_activity_ids text[] null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='current_user_ids') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN current_user_ids text[] null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='role_bindings') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN role_bindings jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='variables_data') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN variables_data jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='status') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN status text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='tenant_id') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bpm_proc_inst' AND column_name='proc_def_version') THEN
        ALTER TABLE public.bpm_proc_inst ADD COLUMN proc_def_version text null;
    END IF;
END;
$$;

ALTER TABLE bpm_proc_inst ENABLE ROW LEVEL SECURITY;

CREATE POLICY bpm_proc_inst_insert_policy
    ON bpm_proc_inst
    FOR INSERT
    TO authenticated
    WITH CHECK ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY bpm_proc_inst_select_policy
    ON bpm_proc_inst  
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY bpm_proc_inst_update_policy
    ON bpm_proc_inst
    FOR UPDATE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

CREATE POLICY bpm_proc_inst_delete_policy
    ON bpm_proc_inst
    FOR DELETE
    TO authenticated
    USING ((tenant_id = auth.tenant_id()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));



create table if not exists public.todolist (
    id uuid not null,
    user_id text null,
    proc_inst_id text null,
    proc_def_id text null,
    activity_id text null,
    activity_name text null,
    start_date timestamp without time zone null,
    end_date timestamp without time zone null,
    status text null,
    description text null,
    tool text null,
    due_date timestamp without time zone null,
    tenant_id text null default auth.tenant_id(),
    reference_ids text[] null,
    adhoc boolean null default false,
    assignees jsonb null,
    duration integer null,
    output jsonb null,
    retry integer null default 0,
    consumer text null,
    log text null,
    constraint todolist_pkey primary key (id),
    constraint todolist_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='id') THEN
        ALTER TABLE public.todolist ADD COLUMN id uuid not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='user_id') THEN
        ALTER TABLE public.todolist ADD COLUMN user_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='proc_inst_id') THEN
        ALTER TABLE public.todolist ADD COLUMN proc_inst_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='proc_def_id') THEN
        ALTER TABLE public.todolist ADD COLUMN proc_def_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='activity_id') THEN
        ALTER TABLE public.todolist ADD COLUMN activity_id text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='activity_name') THEN
        ALTER TABLE public.todolist ADD COLUMN activity_name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='start_date') THEN
        ALTER TABLE public.todolist ADD COLUMN start_date timestamp without time zone null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='end_date') THEN
        ALTER TABLE public.todolist ADD COLUMN end_date timestamp without time zone null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='status') THEN
        ALTER TABLE public.todolist ADD COLUMN status text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='description') THEN
        ALTER TABLE public.todolist ADD COLUMN description text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='tool') THEN
        ALTER TABLE public.todolist ADD COLUMN tool text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='due_date') THEN
        ALTER TABLE public.todolist ADD COLUMN due_date timestamp without time zone null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='tenant_id') THEN
        ALTER TABLE public.todolist ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='reference_ids') THEN
        ALTER TABLE public.todolist ADD COLUMN reference_ids text[] null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='adhoc') THEN
        ALTER TABLE public.todolist ADD COLUMN adhoc boolean null default false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='assignees') THEN
        ALTER TABLE public.todolist ADD COLUMN assignees jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='duration') THEN
        ALTER TABLE public.todolist ADD COLUMN duration integer null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='output') THEN
        ALTER TABLE public.todolist ADD COLUMN output jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='retry') THEN
        ALTER TABLE public.todolist ADD COLUMN retry integer null default 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='consumer') THEN
        ALTER TABLE public.todolist ADD COLUMN consumer text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todolist' AND column_name='log') THEN
        ALTER TABLE public.todolist ADD COLUMN log text null;
    END IF;
END;
$$;

ALTER TABLE todolist ENABLE ROW LEVEL SECURITY;

CREATE POLICY todolist_insert_policy
    ON todolist
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY todolist_select_policy
    ON todolist
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY todolist_update_policy
    ON todolist
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY todolist_delete_policy
    ON todolist
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

create or replace function handle_todolist_change()
returns trigger as $$
declare
    v_proc_inst_name text;
begin
    if (TG_OP = 'INSERT') then
        select proc_inst_name, tenant_id into v_proc_inst_name 
        from bpm_proc_inst 
        where proc_inst_id = NEW.proc_inst_id;
        
        insert into notifications (id, user_id, title, type, description, is_checked, time_stamp, tenant_id, url)
        values (
            gen_random_uuid(),
            NEW.user_id,
            NEW.activity_name,
            CASE 
                WHEN NEW.proc_inst_id IS NOT NULL AND NEW.proc_inst_id <> '' THEN 'workitem_bpm'
                ELSE 'workitem'
            END,
            coalesce(v_proc_inst_name, NEW.activity_name),
            case when NEW.status = 'DONE' then true else false end,
            now(),
            NEW.tenant_id,
            '/todolist/' || NEW.id
        )
        on conflict (id) do update
        set
            user_id = EXCLUDED.user_id,
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            description = EXCLUDED.description,
            is_checked = EXCLUDED.is_checked,
            time_stamp = EXCLUDED.time_stamp,
            tenant_id = EXCLUDED.tenant_id,
            url = EXCLUDED.url;
    end if;
    return null;
end;
$$ language plpgsql;

create or replace trigger todolist_change_trigger
after insert on todolist
for each row
execute function handle_todolist_change();

create or replace function update_notification_user_id()
returns trigger as $$
begin
    update notifications
    set user_id = NEW.user_id,
        time_stamp = now()
    where url = '/todolist/' || NEW.id;

    return null;
end;
$$ language plpgsql;

create or replace trigger update_user_id_trigger
after update on todolist
for each row
when (OLD.user_id is distinct from NEW.user_id)
execute function update_notification_user_id();

create or replace function delete_notification_on_todolist_delete()
returns trigger as $$
begin
    delete from notifications
    where url = '/todolist/' || OLD.id;

    return null;
end;
$$ language plpgsql;

create or replace trigger delete_notification_trigger
after delete on todolist
for each row
execute function delete_notification_on_todolist_delete();



create table if not exists public.chat_rooms (
    id text not null,
    participants jsonb not null,
    message jsonb null,
    name text null,
    tenant_id text null default auth.tenant_id(),
    constraint chat_rooms_pkey primary key (id),
    constraint chat_rooms_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='id') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='participants') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN participants jsonb not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='message') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN message jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='name') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN name text null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_rooms' AND column_name='tenant_id') THEN
        ALTER TABLE public.chat_rooms ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_rooms_insert_policy
    ON chat_rooms
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY chat_rooms_select_policy
    ON chat_rooms
    FOR SELECT
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chat_rooms_update_policy
    ON chat_rooms
    FOR UPDATE
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chat_rooms_delete_policy
    ON chat_rooms
    FOR DELETE
    TO authenticated 
    USING (tenant_id = auth.tenant_id());



create table if not exists public.chats (
    uuid text not null,
    id text not null,
    messages jsonb null,
    tenant_id text null default auth.tenant_id(),
    thread_id text null,
    constraint chats_pkey primary key (uuid),
    constraint chats_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='uuid') THEN
        ALTER TABLE public.chats ADD COLUMN uuid text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='id') THEN
        ALTER TABLE public.chats ADD COLUMN id text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='messages') THEN
        ALTER TABLE public.chats ADD COLUMN messages jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='tenant_id') THEN
        ALTER TABLE public.chats ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chats' AND column_name='thread_id') THEN
        ALTER TABLE public.chats ADD COLUMN thread_id text null;
    END IF;
END;
$$;

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY chats_insert_policy
    ON chats
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY chats_select_policy
    ON chats
    FOR SELECT
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chats_update_policy
    ON chats
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY chats_delete_policy
    ON chats
    FOR DELETE
    TO authenticated 
    USING (tenant_id = auth.tenant_id());

create or replace function handle_chat_insert()
returns trigger as $$
declare
    chat_room_participant jsonb;
    participant_email text;
    participant_record record;
    chat_room_name text;
begin
    -- Fetch the chat room name
    select name into chat_room_name from public.chat_rooms where id = NEW.id;

    for participant_record in
        select jsonb_array_elements(participants) as p
        from public.chat_rooms
        where id = NEW.id
    loop
        chat_room_participant := participant_record.p;
        
        if chat_room_participant->>'username' != 'System' and chat_room_participant->>'email' != NEW.messages->>'email' then
            participant_email := chat_room_participant->>'email';
            
            insert into notifications (id, user_id, title, type, description, is_checked, time_stamp, url, from_user_id)
            values (
                gen_random_uuid(),
                participant_email,
                NEW.messages->>'content',
                'chat',
                chat_room_name,  -- Use chat room name as description
                false,
                now(),
                '/chats?id=' || NEW.id,
                NEW.messages->>'name'
            )
            on conflict (id) do update
            set
                user_id = EXCLUDED.user_id,
                title = EXCLUDED.title,
                time_stamp = EXCLUDED.time_stamp,
                is_checked = EXCLUDED.is_checked,
                url = EXCLUDED.url,
                from_user_id = EXCLUDED.from_user_id;
        end if;
    end loop;

    return null;
end;
$$ language plpgsql;

create or replace trigger chat_insert_trigger
after insert on public.chats
for each row
execute function handle_chat_insert();



create table if not exists public.calendar (
    uid text not null,
    data jsonb null,
    tenant_id text null default auth.tenant_id(),
    constraint calendar_pkey primary key (uid)
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar' AND column_name='uid') THEN
        ALTER TABLE public.calendar ADD COLUMN uid text not null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar' AND column_name='data') THEN
        ALTER TABLE public.calendar ADD COLUMN data jsonb null;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar' AND column_name='tenant_id') THEN
        ALTER TABLE public.calendar ADD COLUMN tenant_id text null default auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_insert_policy
    ON calendar
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY calendar_select_policy
    ON calendar
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY calendar_update_policy
    ON calendar
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY calendar_delete_policy
    ON calendar
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());



DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_views
        WHERE viewname = 'chat_room_chats'
        AND schemaname = 'public'
    ) THEN
        CREATE VIEW public.chat_room_chats AS
        SELECT
            cr.id,
            cr.name,
            cr.participants,
            c.uuid,
            c.messages
        FROM
            chat_rooms cr
            JOIN chats c ON cr.id = c.id;
    END IF;
END;
$$;



CREATE OR REPLACE FUNCTION search_bpm_proc_inst(keyword TEXT, user_email TEXT)
RETURNS SETOF bpm_proc_inst AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM bpm_proc_inst
    WHERE (proc_def_id ILIKE '%' || keyword || '%'
       OR proc_inst_id ILIKE '%' || keyword || '%'
       OR proc_inst_name ILIKE '%' || keyword || '%'
       OR variables_data::text ILIKE '%' || keyword || '%')
      AND user_email = ANY(current_user_ids);
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION search_chat_room_chats(keyword TEXT)
RETURNS SETOF chat_room_chats AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM chat_room_chats
    WHERE messages->>'content' ILIKE '%' || keyword || '%'
       OR messages->>'name' ILIKE '%' || keyword || '%'
       OR messages->>'email' ILIKE '%' || keyword || '%';
END;
$$ LANGUAGE plpgsql;



-- public.proc_def의 tenant_id를 업데이트하는 새로운 함수 생성
CREATE OR REPLACE FUNCTION public.update_tenant_id_for_first_tenant()
RETURNS TRIGGER AS $$
DECLARE
    tenant_count INT;
BEGIN
    -- public.tenants 테이블의 현재 행 수를 확인
    SELECT COUNT(*) INTO tenant_count FROM public.tenants;

    -- 첫 번째 행이 삽입될 때만 업데이트 수행
    IF tenant_count = 1 THEN
        UPDATE public.proc_def
        SET tenant_id = NEW.id
        WHERE id = 'leave_request_process';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- public.tenants 테이블에 대한 트리거 생성
CREATE OR REPLACE TRIGGER on_first_tenant_inserted
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE PROCEDURE public.update_tenant_id_for_first_tenant();



CREATE POLICY "Allow authenticated users to upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
);




-- user_permissions 테이블: 테넌트별 사용자의 프로세스 접근 권한 관리
create table if not exists public.user_permissions (
    id text not null,
    user_id uuid not null,
    tenant_id text not null default auth.tenant_id(),
    proc_def_id text not null,
    proc_def_ids jsonb not null,
    readable boolean not null default false,
    writable boolean not null default false,
    constraint user_permissions_pkey primary key (id)
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN id TEXT PRIMARY KEY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='user_id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN user_id UUID PRIMARY KEY;
    END IF;    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='proc_def_id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN proc_def_id TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='proc_def_ids') THEN
        ALTER TABLE public.user_permissions ADD COLUMN proc_def_ids JSONB NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='readable') THEN
        ALTER TABLE public.user_permissions ADD COLUMN readable BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='writable') THEN
        ALTER TABLE public.user_permissions ADD COLUMN writable BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_permissions' AND column_name='tenant_id') THEN
        ALTER TABLE public.user_permissions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT auth.tenant_id();
    END IF;
END;
$$;

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_permissions_insert_policy
    ON user_permissions
    FOR INSERT
    TO authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

CREATE POLICY user_permissions_select_policy
    ON user_permissions
    FOR SELECT
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY user_permissions_update_policy
    ON user_permissions
    FOR UPDATE
    TO authenticated
    USING (tenant_id = auth.tenant_id());

CREATE POLICY user_permissions_delete_policy
    ON user_permissions
    FOR DELETE
    TO authenticated
    USING (tenant_id = auth.tenant_id());


-- Create a function to set the id column
CREATE OR REPLACE FUNCTION set_user_permissions_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.id := NEW.proc_def_id || '_' || NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before insert
CREATE TRIGGER before_insert_user_permissions
BEFORE INSERT ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION set_user_permissions_id();

-- 프로세스 권한 체크
CREATE OR REPLACE FUNCTION check_process_permission(p_proc_def_id TEXT, p_user_id UUID DEFAULT NULL)
RETURNS SETOF user_permissions AS $$
BEGIN
    RETURN QUERY
    SELECT up.*
    FROM user_permissions up,
         jsonb_array_elements(up.proc_def_ids->'major_proc_list') AS major_proc,
         jsonb_array_elements(major_proc->'sub_proc_list') AS sub_proc
    WHERE (p_user_id IS NULL OR up.user_id = p_user_id)
    AND (
        up.proc_def_ids->>'id' = p_proc_def_id OR
        major_proc->>'id' = p_proc_def_id OR
        sub_proc->>'id' = p_proc_def_id
    );
END;
$$ LANGUAGE plpgsql;



-- vector store 구성
-- Enable the pgvector extension to work with embedding vectors
create extension vector;

-- Create a table to store your documents
create table documents (
  id uuid primary key,
  content text, -- corresponds to Document.pageContent
  metadata jsonb, -- corresponds to Document.metadata
  embedding vector(1536) -- 1536 works for OpenAI embeddings, change if needed
);

create or replace function match_documents(
  filter jsonb,
  query_embedding vector(1536)
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by embedding <=> query_embedding;
$$;



-- proc_def 테이블
CREATE UNIQUE INDEX IF NOT EXISTS unique_proc_def_id_per_tenant
ON proc_def (id, tenant_id);

-- form_def 테이블
CREATE UNIQUE INDEX IF NOT EXISTS unique_form_def_id_per_tenant
ON form_def (id, tenant_id);

-- configuration 테이블
CREATE UNIQUE INDEX IF NOT EXISTS unique_config_key_per_tenant
ON configuration (key, tenant_id);



-- proc_def_marketplace 테이블
create table if not exists public.proc_def_marketplace (
    uuid uuid not null default gen_random_uuid (),
    id text not null,
    name text null,
    definition jsonb null,
    bpmn text null,
    description text null,
    category text null,
    tags text null,
    author_name text null,
    author_uid text null,
    import_count integer not null default 0,
    constraint proc_def_marketplace_pkey primary key (uuid),
    constraint proc_def_marketplace_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='id') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN id TEXT PRIMARY KEY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='name') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN name TEXT;
    END IF;    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='definition') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN definition JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='bpmn') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN bpmn TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='description') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='category') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN category TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='tags') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN tags TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='author_name') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN author_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='author_uid') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN author_uid TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='import_count') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN import_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END;
$$;

ALTER TABLE proc_def_marketplace ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_def_marketplace_insert_policy
    ON proc_def_marketplace
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY proc_def_marketplace_select_policy
    ON proc_def_marketplace
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY proc_def_marketplace_update_policy
    ON proc_def_marketplace
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY proc_def_marketplace_delete_policy
    ON proc_def_marketplace
    FOR DELETE
    TO authenticated
    USING (true);



create table if not exists public.form_def_marketplace (
    uuid uuid not null default gen_random_uuid (),
    id text null default ''::text,
    proc_def_id text not null,
    activity_id text not null,
    html text not null,
    author_uid text null,
    constraint form_def_marketplace_pkey primary key (uuid)
) tablespace pg_default;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proc_def_marketplace' AND column_name='id') THEN
        ALTER TABLE public.proc_def_marketplace ADD COLUMN id TEXT PRIMARY KEY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def_marketplace' AND column_name='proc_def_id') THEN
        ALTER TABLE public.form_def_marketplace ADD COLUMN proc_def_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def_marketplace' AND column_name='activity_id') THEN
        ALTER TABLE public.form_def_marketplace ADD COLUMN activity_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def_marketplace' AND column_name='html') THEN
        ALTER TABLE public.form_def_marketplace ADD COLUMN html TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='form_def_marketplace' AND column_name='author_uid') THEN
        ALTER TABLE public.form_def_marketplace ADD COLUMN author_uid TEXT;
    END IF;
END;
$$;

ALTER TABLE form_def_marketplace ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_def_marketplace_insert_policy
    ON form_def_marketplace
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY form_def_marketplace_select_policy
    ON form_def_marketplace
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY form_def_marketplace_update_policy
    ON form_def_marketplace
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY form_def_marketplace_delete_policy
    ON form_def_marketplace
    FOR DELETE
    TO authenticated
    USING (true);




