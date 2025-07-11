-- Enable required extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Create tenant_id function
create or replace function public.tenant_id()
returns text
language sql stable
as $$
    select 
        nullif(
            ((current_setting('request.jwt.claims')::jsonb ->>  'app_metadata')::jsonb ->> 'tenant_id'),
            ''
        )::text
$$;

-- Create initial tables
create table if not exists public.tenants (
    id text not null,
    owner uuid null default auth.uid (),
    is_deleted boolean not null default false,
    deleted_at timestamp with time zone null,
    mcp jsonb null,
    constraint tenants_pkey primary key (id)
) tablespace pg_default;

INSERT INTO public.tenants (id, owner) VALUES ('process-gpt', null);

create table if not exists public.user_devices (
    user_email text not null,
    device_token text null,
    constraint user_devices_pkey primary key (user_email)
) tablespace pg_default;

create table if not exists public.users (
    id uuid not null,
    username text null,
    profile text null default '/images/defaultUser.png'::text,
    email text null,
    is_admin boolean not null default false,
    role text null,
    tenant_id text null,
    device_token text null,
    google_credentials jsonb,
    google_credentials_updated_at TIMESTAMP WITH TIME ZONE,
    goal text null,
    persona text null,
    url text null,
    description text null,
    tools text null,
    skills text null,
    is_agent boolean not null default false,
    model text null,
    constraint users_pkey primary key (id, tenant_id),
    constraint users_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.configuration (
    key text not null,
    value jsonb null,
    tenant_id text null default public.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint configuration_pkey primary key (uuid),
    constraint configuration_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.proc_map_history (
    value jsonb not null,
    created_at timestamp with time zone not null default now(),
    tenant_id text null default public.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint proc_map_history_pkey primary key (uuid),
    constraint proc_map_history_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.proc_def (
    id text not null,
    name text null,
    definition jsonb null,
    bpmn text null,
    uuid uuid not null default gen_random_uuid (),
    tenant_id text null default public.tenant_id(),
    isdeleted boolean not null default false,
    constraint proc_def_pkey primary key (uuid),
    constraint proc_def_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.proc_def_arcv (
    arcv_id text not null,
    proc_def_id text not null,
    version text not null,
    snapshot text null,
    "timeStamp" timestamp without time zone null default current_timestamp,
    diff text null,
    message text null,
    uuid uuid not null default gen_random_uuid (),
    tenant_id text null default public.tenant_id(),
    constraint proc_def_arcv_pkey primary key (uuid),
    constraint proc_def_arcv_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.form_def (
    uuid uuid not null default gen_random_uuid (),
    html text not null,
    proc_def_id text not null,
    activity_id text not null,
    tenant_id text null default public.tenant_id(),
    id text null default ''::text,
    fields_json jsonb null,
    constraint form_def_pkey primary key (uuid),
    constraint form_def_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.notifications (
    id uuid not null,
    title text null,
    type text null,
    description text null,
    is_checked boolean null default false,
    time_stamp timestamp with time zone null default now(),
    user_id text null,
    url text null,
    consumer text null,
    from_user_id text null,
    tenant_id text null default public.tenant_id(),
    constraint notifications_pkey primary key (id),
    constraint notifications_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.lock (
    id text not null,
    user_id text null,
    tenant_id text null default public.tenant_id(),
    uuid uuid not null default gen_random_uuid (),
    constraint lock_pkey primary key (uuid),
    constraint lock_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.bpm_proc_inst (
    proc_def_id text null,
    proc_inst_id text not null,
    proc_inst_name text null,
    current_activity_ids text[] null,
    current_user_ids text[] null,
    role_bindings jsonb null,
    variables_data jsonb null,
    status text null,
    tenant_id text null default public.tenant_id(),
    proc_def_version text null,
    project_id uuid null,
    start_date timestamp without time zone null,
    end_date timestamp without time zone null,
    due_date timestamp without time zone null,
    updated_at timestamp with time zone default now(),
    is_deleted boolean not null default false,
    deleted_at timestamp with time zone null,
    constraint bpm_proc_inst_pkey primary key (proc_inst_id),
    constraint bpm_proc_inst_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

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
    tenant_id text null default public.tenant_id(),
    reference_ids text[] null,
    adhoc boolean null default false,
    assignees jsonb null,
    duration integer null,
    output jsonb null,
    retry integer null default 0,
    consumer text null,
    log text null,
    project_id uuid null,
    draft jsonb null,
    agent_mode text null,
    feedback jsonb null,
    draft_status text null,
    updated_at timestamp with time zone default now(),
    constraint todolist_pkey primary key (id),
    constraint todolist_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.chat_rooms (
    id text not null,
    participants jsonb not null,
    message jsonb null,
    name text null,
    tenant_id text null default public.tenant_id(),
    constraint chat_rooms_pkey primary key (id),
    constraint chat_rooms_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.chats (
    uuid text not null,
    id text not null,
    messages jsonb null,
    tenant_id text null default public.tenant_id(),
    thread_id text null,
    constraint chats_pkey primary key (uuid),
    constraint chats_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create table if not exists public.chat_attachments (
    id text not null,
    file_name text null,
    file_path text null,
    chat_room_id text null,
    user_name text null,
    created_at timestamp with time zone not null default now(),
    tenant_id text null,
    constraint chat_attachments_pkey primary key (id),
    constraint chat_attachments_chat_room_id_fkey foreign KEY (chat_room_id) references chat_rooms (id) on update CASCADE on delete CASCADE,
    constraint chat_attachments_tenant_id_fkey foreign KEY (tenant_id) references tenants (id)
) TABLESPACE pg_default;

create table if not exists public.calendar (
    uid text not null,
    data jsonb null,
    tenant_id text null default public.tenant_id(),
    constraint calendar_pkey primary key (uid)
) tablespace pg_default;

create table if not exists public.user_permissions (
    id text not null,
    user_id uuid not null,
    tenant_id text not null default public.tenant_id(),
    proc_def_id text not null,
    proc_def_ids jsonb not null,
    readable boolean not null default false,
    writable boolean not null default false,
    constraint user_permissions_pkey primary key (id)
) tablespace pg_default;

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
    image text null,
    import_count integer not null default 0,
    constraint proc_def_marketplace_pkey primary key (uuid)
) tablespace pg_default;

create table if not exists public.form_def_marketplace (
    uuid uuid not null default gen_random_uuid (),
    id text null default ''::text,
    proc_def_id text not null,
    activity_id text not null,
    html text not null,
    author_uid text null,
    constraint form_def_marketplace_pkey primary key (uuid)
) tablespace pg_default;

create table if not exists public.tenant_oauth (
    id text not null,
    tenant_id text not null,
    provider text not null,
    client_id text not null,
    client_secret text not null,
    redirect_uri text null,
    drive_folder_id text null,
    created_at timestamp with time zone null default now(),
    updated_at timestamp with time zone null default now(),
    constraint tenant_oauth_pkey primary key (id)
) tablespace pg_default;

create table if not exists public.project (
    name character varying null,
    start_date date null,
    end_date date null,
    created_date date null,
    status character varying not null,
    project_id uuid not null default gen_random_uuid (),
    due_date date null,
    user_id text null,
    updated_at timestamp with time zone default now(),
    tenant_id text null default public.tenant_id(),
    constraint project_pkey primary key (project_id),
    constraint project_tenant_id_fkey foreign key (tenant_id) references tenants (id) on update cascade on delete cascade
) tablespace pg_default;

-- create table if not exists public.milestone (
--     id bigserial,
--     impact_type character varying null,
--     impact_desc text null,
--     created_date date null,
--     task_id uuid null,
--     impact_id uuid null,
--     constraint milestone_pkey primary key (id),
--     constraint fk_milestone_task foreign key (task_id) references worklist (task_id),
--     constraint fk_milestone_impact_id foreign key (impact_id) references worklist (task_id),
--     constraint fk_milestone_impact foreign key (impact_id) references worklist (task_id)
-- ) tablespace pg_default;

create table if not exists public.task_dependency (
    id bigserial,
    lag_time integer null,
    lead_time integer null,
    type character varying null,
    created_date date null,
    task_id uuid null,
    depends_id uuid null,
    constraint worklist_dependency_pkey primary key (id)
) tablespace pg_default;

create table if not exists public.processed_files (
    id uuid not null default uuid_generate_v4 (),
    file_id text not null,
    tenant_id text not null,
    processed_at timestamp with time zone null default now(),
    file_name text null,
    constraint processed_files_pkey primary key (id),
    constraint processed_files_file_id_tenant_id_key unique (file_id, tenant_id)
) tablespace pg_default;

create table if not exists public.documents (
    id uuid primary key,
    content text,
    metadata jsonb,
    embedding vector(1536)
);

create table if not exists public.events (
  id text not null,
  run_id text not null,
  job_id text not null,
  todo_id text null,
  proc_inst_id text null,
  event_type text not null,
  crew_type text null,
  data jsonb not null,
  timestamp timestamp with time zone null default now(),
  constraint events_pkey primary key (id)
) TABLESPACE pg_default;

-- Create indexes
create index if not exists idx_processed_files_tenant_id on public.processed_files using btree (tenant_id) tablespace pg_default;
create index if not exists idx_processed_files_file_id on public.processed_files using btree (file_id) tablespace pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS unique_proc_def_id_per_tenant ON proc_def (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_form_def_id_per_tenant ON form_def (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_config_key_per_tenant ON configuration (key, tenant_id);

-- Create views
CREATE OR REPLACE VIEW public.chat_room_chats AS
SELECT
    cr.id,
    cr.name,
    cr.participants,
    c.uuid,
    c.messages
FROM
    chat_rooms cr
    JOIN chats c ON cr.id = c.id;

CREATE OR REPLACE VIEW public.v_task_dependency AS
SELECT
    d.id,
    d.lag_time,
    d.lead_time,
    d.type,
    d.created_date,
    d.task_id,
    d.depends_id,
    t.proc_inst_id,
    t.project_id
FROM
    task_dependency d
    JOIN todolist t ON d.task_id = t.id;

-- Create functions
CREATE OR REPLACE FUNCTION set_user_permissions_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.id := NEW.proc_def_id || '_' || NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION public.update_tenant_id_for_first_tenant()
RETURNS TRIGGER AS $$
DECLARE
    tenant_count INT;
BEGIN
    SELECT COUNT(*) INTO tenant_count FROM public.tenants;
    IF tenant_count = 1 THEN
        UPDATE public.proc_def
        SET tenant_id = NEW.id
        WHERE id = 'leave_request_process';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_todolist_change()
RETURNS TRIGGER AS $$
DECLARE
    v_proc_inst_name text;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status != 'SUBMITTED') THEN
        SELECT proc_inst_name, tenant_id INTO v_proc_inst_name 
        FROM bpm_proc_inst 
        WHERE proc_inst_id = NEW.proc_inst_id;
        
        INSERT INTO notifications (id, user_id, title, type, description, is_checked, time_stamp, tenant_id, url)
        VALUES (
            gen_random_uuid(),
            NEW.user_id,
            NEW.activity_name,
            CASE 
                WHEN NEW.proc_inst_id IS NOT NULL AND NEW.proc_inst_id <> '' THEN 'workitem_bpm'
                ELSE 'workitem'
            END,
            COALESCE(v_proc_inst_name, NEW.activity_name),
            CASE WHEN NEW.status = 'DONE' THEN true ELSE false END,
            now(),
            NEW.tenant_id,
            '/todolist/' || NEW.id
        )
        ON CONFLICT (id) DO UPDATE
        SET
            user_id = EXCLUDED.user_id,
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            description = EXCLUDED.description,
            is_checked = EXCLUDED.is_checked,
            time_stamp = EXCLUDED.time_stamp,
            tenant_id = EXCLUDED.tenant_id,
            url = EXCLUDED.url;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_notification_user_id()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE notifications
    SET user_id = NEW.user_id,
        time_stamp = now()
    WHERE url = '/todolist/' || NEW.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_notification_on_todolist_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM notifications
    WHERE url = '/todolist/' || OLD.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_chat_insert()
RETURNS TRIGGER AS $$
DECLARE
    chat_room_participant jsonb;
    participant_email text;
    participant_record record;
    chat_room_name text;
BEGIN
    SELECT name INTO chat_room_name FROM public.chat_rooms WHERE id = NEW.id;

    FOR participant_record IN
        SELECT jsonb_array_elements(participants) as p
        FROM public.chat_rooms
        WHERE id = NEW.id
    LOOP
        chat_room_participant := participant_record.p;
        
        IF chat_room_participant->>'username' != 'System' AND chat_room_participant->>'email' != NEW.messages->>'email' THEN
            participant_email := chat_room_participant->>'email';
            
            INSERT INTO notifications (id, user_id, title, type, description, is_checked, time_stamp, url, from_user_id)
            VALUES (
                gen_random_uuid(),
                participant_email,
                NEW.messages->>'content',
                'chat',
                chat_room_name,
                false,
                now(),
                '/chats?id=' || NEW.id,
                NEW.messages->>'name'
            )
            ON CONFLICT (id) DO UPDATE
            SET
                user_id = EXCLUDED.user_id,
                title = EXCLUDED.title,
                time_stamp = EXCLUDED.time_stamp,
                is_checked = EXCLUDED.is_checked,
                url = EXCLUDED.url,
                from_user_id = EXCLUDED.from_user_id;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION duplicate_definition_from_marketplace(
    p_definition_id TEXT,
    p_definition_name TEXT,
    p_author_uid TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_proc_def_record RECORD;
    v_form_def_record RECORD;
    v_result JSONB := '{}';
    v_proc_def_uuid UUID;
    v_form_def_uuid UUID;
BEGIN
    -- 프로세스 정의를 marketplace에서 복사
    SELECT * INTO v_proc_def_record
    FROM proc_def_marketplace
    WHERE id = p_definition_id AND name = p_definition_name;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Process definition not found in marketplace');
    END IF;
    
    -- proc_def에 복사
    INSERT INTO proc_def (
        id,
        name,
        definition,
        bpmn,
        tenant_id
    ) VALUES (
        v_proc_def_record.id,
        v_proc_def_record.name,
        v_proc_def_record.definition,
        v_proc_def_record.bpmn,
        public.tenant_id()
    )
    ON CONFLICT (id, tenant_id) DO UPDATE SET
        name = EXCLUDED.name,
        definition = EXCLUDED.definition,
        bpmn = EXCLUDED.bpmn
    RETURNING uuid INTO v_proc_def_uuid;
    
    -- form_def_marketplace에서 관련 폼들을 찾아서 form_def로 복사
    FOR v_form_def_record IN
        SELECT *
        FROM form_def_marketplace
        WHERE proc_def_id = p_definition_id AND author_uid = p_author_uid
    LOOP
        INSERT INTO form_def (
            html,
            proc_def_id,
            activity_id,
            tenant_id,
            id,
            fields_json
        ) VALUES (
            v_form_def_record.html,
            v_form_def_record.proc_def_id,
            v_form_def_record.activity_id,
            public.tenant_id(),
            v_form_def_record.id,
            NULL
        )
        ON CONFLICT (id, tenant_id) DO UPDATE SET
            html = EXCLUDED.html,
            proc_def_id = EXCLUDED.proc_def_id,
            activity_id = EXCLUDED.activity_id
        RETURNING uuid INTO v_form_def_uuid;
    END LOOP;
    
    -- import_count 증가
    UPDATE proc_def_marketplace
    SET import_count = import_count + 1
    WHERE id = p_definition_id AND name = p_definition_name;
    
    v_result := jsonb_build_object(
        'success', true,
        'proc_def_uuid', v_proc_def_uuid,
        'message', 'Definition duplicated successfully'
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'error', SQLERRM,
            'success', false
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- project updated_at 업데이트 
CREATE OR REPLACE FUNCTION update_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    UPDATE public.project
    SET updated_at = now()
    WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- bpm_proc_inst updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_bpm_proc_inst_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proc_inst_id IS NOT NULL THEN
    UPDATE public.bpm_proc_inst
    SET updated_at = now()
    WHERE proc_inst_id = NEW.proc_inst_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- todolist updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_project_updated_at
    AFTER UPDATE OF updated_at ON public.bpm_proc_inst
    FOR EACH ROW
    EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER trigger_update_bpm_proc_inst_updated_at
    AFTER UPDATE ON public.todolist
    FOR EACH ROW
    EXECUTE FUNCTION update_bpm_proc_inst_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.todolist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER encrypt_credentials_trigger
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_credentials_trigger();

CREATE TRIGGER before_insert_user_permissions
    BEFORE INSERT ON public.user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION set_user_permissions_id();

CREATE TRIGGER on_first_tenant_inserted
    AFTER INSERT ON public.tenants
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_tenant_id_for_first_tenant();

CREATE TRIGGER todolist_change_trigger
    AFTER INSERT ON todolist
    FOR EACH ROW
    EXECUTE FUNCTION handle_todolist_change();

CREATE TRIGGER update_user_id_trigger
    AFTER UPDATE ON todolist
    FOR EACH ROW
    WHEN (OLD.user_id IS DISTINCT FROM NEW.user_id)
    EXECUTE FUNCTION update_notification_user_id();

CREATE TRIGGER delete_notification_trigger
    AFTER DELETE ON todolist
    FOR EACH ROW
    EXECUTE FUNCTION delete_notification_on_todolist_delete();

CREATE TRIGGER chat_insert_trigger
    AFTER INSERT ON public.chats
    FOR EACH ROW
    EXECUTE FUNCTION handle_chat_insert();

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_map_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_def ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_def_arcv ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_def ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE bpm_proc_inst ENABLE ROW LEVEL SECURITY;
ALTER TABLE todolist ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_def_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_def_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_oauth ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Tenants policies
CREATE POLICY tenants_insert_policy ON tenants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tenants_select_policy ON tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY tenants_update_policy ON tenants FOR UPDATE TO authenticated USING (auth.uid() = owner);
CREATE POLICY tenants_delete_policy ON tenants FOR DELETE TO authenticated USING (auth.uid() = owner);

-- Users policies
CREATE POLICY users_insert_policy ON users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY users_select_policy ON users FOR SELECT TO public USING (true);
CREATE POLICY users_update_policy ON users FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true) OR auth.uid() = id) WITH CHECK (true);
CREATE POLICY users_delete_policy ON users FOR DELETE TO authenticated USING (public.tenant_id() = tenant_id);

-- Configuration policies
CREATE POLICY configuration_insert_policy ON configuration FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY configuration_select_policy ON configuration FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY configuration_update_policy ON configuration FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY configuration_delete_policy ON configuration FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));

-- Proc map history policies
CREATE POLICY proc_map_history_insert_policy ON proc_map_history FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY proc_map_history_select_policy ON proc_map_history FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY proc_map_history_update_policy ON proc_map_history FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY proc_map_history_delete_policy ON proc_map_history FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- Proc def policies
CREATE POLICY proc_def_insert_policy ON proc_def FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY proc_def_select_policy ON proc_def FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY proc_def_update_policy ON proc_def FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY proc_def_delete_policy ON proc_def FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));

-- Proc def arcv policies
CREATE POLICY proc_def_arcv_insert_policy ON proc_def_arcv FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY proc_def_arcv_select_policy ON proc_def_arcv FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY proc_def_arcv_update_policy ON proc_def_arcv FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY proc_def_arcv_delete_policy ON proc_def_arcv FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- Form def policies
CREATE POLICY form_def_insert_policy ON form_def FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));
CREATE POLICY form_def_select_policy ON form_def FOR SELECT TO authenticated USING (true);
CREATE POLICY form_def_update_policy ON form_def FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));
CREATE POLICY form_def_delete_policy ON form_def FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

-- Notifications policies
CREATE POLICY notifications_insert_policy ON notifications FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY notifications_select_policy ON notifications FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY notifications_update_policy ON notifications FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY notifications_delete_policy ON notifications FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- Lock policies
CREATE POLICY lock_insert_policy ON lock FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));
CREATE POLICY lock_select_policy ON lock FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY lock_update_policy ON lock FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));
CREATE POLICY lock_delete_policy ON lock FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

-- BPM proc inst policies
CREATE POLICY bpm_proc_inst_insert_policy ON bpm_proc_inst FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY bpm_proc_inst_select_policy ON bpm_proc_inst FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY bpm_proc_inst_update_policy ON bpm_proc_inst FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY bpm_proc_inst_delete_policy ON bpm_proc_inst FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));

-- Todolist policies
CREATE POLICY todolist_insert_policy ON todolist FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY todolist_select_policy ON todolist FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY todolist_update_policy ON todolist FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY todolist_delete_policy ON todolist FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- Chat rooms policies
CREATE POLICY chat_rooms_insert_policy ON chat_rooms FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY chat_rooms_select_policy ON chat_rooms FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY chat_rooms_update_policy ON chat_rooms FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY chat_rooms_delete_policy ON chat_rooms FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- Chats policies
CREATE POLICY chats_insert_policy ON chats FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY chats_select_policy ON chats FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY chats_update_policy ON chats FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY chats_delete_policy ON chats FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- Calendar policies
CREATE POLICY calendar_insert_policy ON calendar FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY calendar_select_policy ON calendar FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY calendar_update_policy ON calendar FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY calendar_delete_policy ON calendar FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- User permissions policies
CREATE POLICY user_permissions_insert_policy ON user_permissions FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id());
CREATE POLICY user_permissions_select_policy ON user_permissions FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY user_permissions_update_policy ON user_permissions FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY user_permissions_delete_policy ON user_permissions FOR DELETE TO authenticated USING (tenant_id = public.tenant_id());

-- Proc def marketplace policies
CREATE POLICY proc_def_marketplace_insert_policy ON proc_def_marketplace FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY proc_def_marketplace_select_policy ON proc_def_marketplace FOR SELECT TO public USING (true);
CREATE POLICY proc_def_marketplace_update_policy ON proc_def_marketplace FOR UPDATE TO authenticated USING (true);
CREATE POLICY proc_def_marketplace_delete_policy ON proc_def_marketplace FOR DELETE TO authenticated USING (true);

-- Form def marketplace policies
CREATE POLICY form_def_marketplace_insert_policy ON form_def_marketplace FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY form_def_marketplace_select_policy ON form_def_marketplace FOR SELECT TO authenticated USING (true);
CREATE POLICY form_def_marketplace_update_policy ON form_def_marketplace FOR UPDATE TO authenticated USING (true);
CREATE POLICY form_def_marketplace_delete_policy ON form_def_marketplace FOR DELETE TO authenticated USING (true);

-- Tenant oauth policies
CREATE POLICY tenant_oauth_insert_policy ON tenant_oauth FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));
CREATE POLICY tenant_oauth_select_policy ON tenant_oauth FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));
CREATE POLICY tenant_oauth_update_policy ON tenant_oauth FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));
CREATE POLICY tenant_oauth_delete_policy ON tenant_oauth FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true));

-- Storage policies
CREATE POLICY "Allow authenticated users to upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Project policies
CREATE POLICY project_insert_policy ON project FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY project_select_policy ON project FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY project_update_policy ON project FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY project_delete_policy ON project FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));

-- Enable Realtime for specific tables
alter publication supabase_realtime add table chats;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table todolist;
alter publication supabase_realtime add table bpm_proc_inst;
alter publication supabase_realtime add table proc_def; 
alter publication supabase_realtime add table project;



-- schedule 관련
create table if not exists public.cron_job_run_log (
  id serial primary key,
  job_name text,
  executed_at timestamptz default now(),
  status text,
  http_status int,
  response_body jsonb,
  error_message text
);

create or replace function public.start_process_scheduled(
  p_job_name text,
  p_input jsonb
)
returns void
language plpgsql
as $$
declare
  response text;
  status_code int; 
begin
  response := net.http_post(
    'http://host.docker.internal:8000/initiate',
    p_input,
    '{"Content-Type":"application/json"}'
  )::text;

  status_code := 200;

  insert into public.cron_job_run_log (
    job_name, status, http_status, response_body
  )
  values (
    p_job_name,
    'SUCCESS',
    status_code,
    to_jsonb(response)
  );

  raise notice '✅ HTTP status: %, response: %', status_code, response;

exception
  when others then
    insert into public.cron_job_run_log (
      job_name, status, http_status, error_message
    )
    values (
      p_job_name,
      'ERROR',
      500,
      SQLERRM
    );
    raise notice '❌ exception: %', SQLERRM;
    raise;
end;
$$;


create or replace function public.register_cron_job(
  p_job_name text,
  p_cron_expr text,
  p_input jsonb
)
returns void
language plpgsql
security definer
as $$
DECLARE
  v_job_name text;
BEGIN
  SELECT jobname INTO v_job_name
  FROM cron.job
  WHERE jobname = p_job_name;

  IF v_job_name IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_name);
  END IF;

  -- ✅ 새로 schedule
  PERFORM cron.schedule(
    p_job_name,
    p_cron_expr,
    format(
      E'select public.start_process_scheduled(''%s'', ''%s''::jsonb);',
      replace(p_job_name, '''', ''''''),
      replace(p_input::text, '''', '''''')
    )
  );
END;
$$;


grant execute on function public.register_cron_job(text, text, jsonb) to authenticated;


create or replace function public.get_cron_jobs()
returns setof cron.job
language sql
security definer
as $$
  select * from cron.job;
$$;

grant execute on function public.get_cron_jobs() to authenticated;

create or replace function public.delete_cron_job(
  p_job_name text
)
returns void
language plpgsql
security definer
as $$
begin
  perform cron.unschedule(p_job_name);
end;
$$;

grant execute on function public.delete_cron_job(text) to authenticated;



GRANT USAGE ON SCHEMA cron TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cron TO authenticated;

-- ===============================================
-- 테넌트 자동 삭제 기능 (deleted_at 기준 7일 후)
-- ===============================================

-- pg_cron 확장 추가 (이미 있을 수 있지만 안전하게)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 테넌트 정리 함수 (기존 start_process_scheduled 패턴과 동일)
create or replace function public.cleanup_deleted_tenants_job(
  p_job_name text,
  p_input jsonb
)
returns void
language plpgsql
as $$
declare
  deleted_count int;
  response text;
  status_code int; 
begin
  -- deleted_at이 일주일(7일) 지난 테넌트들을 실제로 삭제
  delete from public.tenants
  where deleted_at is not null
    and deleted_at < now() - interval '7 days';
  
  get diagnostics deleted_count = row_count;
  
  response := format('Successfully deleted %s expired tenants', deleted_count);
  status_code := 200;

  insert into public.cron_job_run_log (
    job_name, status, http_status, response_body
  )
  values (
    p_job_name,
    'SUCCESS',
    status_code,
    jsonb_build_object(
      'deleted_count', deleted_count,
      'message', response
    )
  );

  raise notice '✅ Tenant cleanup completed: % tenants deleted', deleted_count;

exception
  when others then
    insert into public.cron_job_run_log (
      job_name, status, http_status, error_message
    )
    values (
      p_job_name,
      'ERROR',
      500,
      SQLERRM
    );
    raise notice '❌ Tenant cleanup failed: %', SQLERRM;
    raise;
end;
$$;

grant execute on function public.cleanup_deleted_tenants_job(text, jsonb) to authenticated;

-- 테넌트 정리 cron job 등록 함수
create or replace function public.register_tenant_cleanup()
returns void
language plpgsql
security definer
as $$
begin
  -- 기존 job이 있다면 삭제
  perform cron.unschedule('tenant_cleanup_daily') where exists (
    select 1 from cron.job where jobname = 'tenant_cleanup_daily'
  );

  -- 새로 등록 (매일 새벽 2시에 실행 - 한국시간 기준, UTC로는 17시)
  perform cron.schedule(
    'tenant_cleanup_daily',
    '0 17 * * *',
    'select public.cleanup_deleted_tenants_job(''tenant_cleanup_daily'', ''{}''::jsonb);'
  );
  
  raise notice '✅ Tenant cleanup job registered successfully (runs daily at 2:00 AM KST / 17:00 UTC)';
end;
$$;

grant execute on function public.register_tenant_cleanup() to authenticated;

-- 테넌트 정리 cron job 등록 실행 (한 번 실행하면 매일 자동 실행)
SELECT public.register_tenant_cleanup();

-- ===============================================
-- bpm_proc_inst 자동 삭제 기능 (deleted_at 기준 7일 후)
-- ===============================================

-- bpm_proc_inst 삭제 시 관련 데이터를 삭제하는 트리거 함수
create or replace function public.cleanup_bpm_proc_inst_related_data()
returns trigger as $$
begin
    -- proc_inst_id와 관련된 todolist 삭제
    delete from public.todolist
    where proc_inst_id = old.proc_inst_id;
    
    -- proc_inst_id와 관련된 chats 삭제 (id 컬럼이 proc_inst_id와 매칭)
    delete from public.chats
    where id = old.proc_inst_id;
    
    -- proc_inst_id와 관련된 chat_rooms 삭제 (id 컬럼이 proc_inst_id와 매칭)
    delete from public.chat_rooms
    where id = old.proc_inst_id;
    
    return old;
end;
$$ language plpgsql;

-- bpm_proc_inst 삭제 시 관련 데이터를 삭제하는 트리거 생성
create trigger cleanup_bpm_proc_inst_related_data_trigger
    before delete on public.bpm_proc_inst
    for each row
    execute function public.cleanup_bpm_proc_inst_related_data();

-- bpm_proc_inst 정리 함수 (기존 start_process_scheduled 패턴과 동일)
create or replace function public.cleanup_deleted_bpm_proc_inst_job(
  p_job_name text,
  p_input jsonb
)
returns void
language plpgsql
as $$
declare
  deleted_count int;
  response text;
  status_code int; 
begin
  -- deleted_at이 일주일(7일) 지난 bpm_proc_inst들을 실제로 삭제
  delete from public.bpm_proc_inst
  where deleted_at is not null
    and deleted_at < now() - interval '7 days';
  
  get diagnostics deleted_count = row_count;
  
  response := format('Successfully deleted %s expired bpm_proc_inst records', deleted_count);
  status_code := 200;

  insert into public.cron_job_run_log (
    job_name, status, http_status, response_body
  )
  values (
    p_job_name,
    'SUCCESS',
    status_code,
    jsonb_build_object(
      'deleted_count', deleted_count,
      'message', response
    )
  );

  raise notice '✅ BPM Process Instance cleanup completed: % records deleted', deleted_count;

exception
  when others then
    insert into public.cron_job_run_log (
      job_name, status, http_status, error_message
    )
    values (
      p_job_name,
      'ERROR',
      500,
      SQLERRM
    );
    raise notice '❌ BPM Process Instance cleanup failed: %', SQLERRM;
    raise;
end;
$$;

grant execute on function public.cleanup_deleted_bpm_proc_inst_job(text, jsonb) to authenticated;

-- bpm_proc_inst 정리 cron job 등록 함수
create or replace function public.register_bpm_proc_inst_cleanup()
returns void
language plpgsql
security definer
as $$
begin
  -- 기존 job이 있다면 삭제
  perform cron.unschedule('bpm_proc_inst_cleanup_daily') where exists (
    select 1 from cron.job where jobname = 'bpm_proc_inst_cleanup_daily'
  );

  -- 새로 등록 (매일 새벽 3시에 실행 - 한국시간 기준, UTC로는 18시)
  perform cron.schedule(
    'bpm_proc_inst_cleanup_daily',
    '0 18 * * *',
    'select public.cleanup_deleted_bpm_proc_inst_job(''bpm_proc_inst_cleanup_daily'', ''{}''::jsonb);'
  );
  
  raise notice '✅ BPM Process Instance cleanup job registered successfully (runs daily at 3:00 AM KST / 18:00 UTC)';
end;
$$;

grant execute on function public.register_bpm_proc_inst_cleanup() to authenticated;

-- bpm_proc_inst 정리 cron job 등록 실행 (한 번 실행하면 매일 자동 실행)
SELECT public.register_bpm_proc_inst_cleanup();