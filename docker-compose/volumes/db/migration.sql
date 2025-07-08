-- Migration SQL for schema synchronization
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

-- tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS owner uuid DEFAULT auth.uid();

-- user_devices table
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS device_token text;

-- users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile text DEFAULT '/images/defaultUser.png';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_credentials jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_credentials_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goal text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS persona text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tools text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS skills text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_agent boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS model text;


-- configuration table
ALTER TABLE public.configuration ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE public.configuration ADD COLUMN IF NOT EXISTS value jsonb;
ALTER TABLE public.configuration ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.configuration ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();

-- proc_map_history table
ALTER TABLE public.proc_map_history ADD COLUMN IF NOT EXISTS value jsonb;
ALTER TABLE public.proc_map_history ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.proc_map_history ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.proc_map_history ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();

-- proc_def table
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS definition jsonb;
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS bpmn text;
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS isdeleted boolean DEFAULT false;

-- proc_def_arcv table
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS arcv_id text;
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS proc_def_id text;
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS version text;
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS snapshot text;
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS "timeStamp" timestamp without time zone DEFAULT current_timestamp;
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS diff text;
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();
ALTER TABLE public.proc_def_arcv ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();

-- form_def table
ALTER TABLE public.form_def ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();
ALTER TABLE public.form_def ADD COLUMN IF NOT EXISTS html text;
ALTER TABLE public.form_def ADD COLUMN IF NOT EXISTS proc_def_id text;
ALTER TABLE public.form_def ADD COLUMN IF NOT EXISTS activity_id text;
ALTER TABLE public.form_def ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.form_def ADD COLUMN IF NOT EXISTS id text DEFAULT '';
ALTER TABLE public.form_def ADD COLUMN IF NOT EXISTS fields_json jsonb;

-- notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_checked boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS time_stamp timestamp with time zone DEFAULT now();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS from_user_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS consumer text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();

-- lock table
ALTER TABLE public.lock ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.lock ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.lock ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.lock ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();

-- bpm_proc_inst table
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS proc_def_id text;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS proc_inst_id text;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS proc_inst_name text;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS current_activity_ids text[];
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS current_user_ids text[];
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS role_bindings jsonb;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS variables_data jsonb;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS proc_def_version text;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS start_date timestamp without time zone;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS end_date timestamp without time zone;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS due_date timestamp without time zone;
ALTER TABLE public.bpm_proc_inst ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- todolist table
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS proc_inst_id text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS proc_def_id text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS activity_id text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS activity_name text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS start_date timestamp without time zone;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS end_date timestamp without time zone;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS tool text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS due_date timestamp without time zone;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS reference_ids text[];
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS adhoc boolean DEFAULT false;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS assignees jsonb;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS duration integer;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS output jsonb;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS retry integer DEFAULT 0;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS consumer text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS log text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS draft jsonb;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS agent_mode text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS feedback jsonb;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS draft_status text;
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default now();


-- chat_rooms table
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS participants jsonb;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS message jsonb;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();

-- chats table
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS uuid text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS messages jsonb;
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS thread_id text;

-- chat_attachments table
ALTER TABLE public.chat_attachments ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.chat_attachments ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.chat_attachments ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.chat_attachments ADD COLUMN IF NOT EXISTS chat_room_id text;
ALTER TABLE public.chat_attachments ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE public.chat_attachments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.chat_attachments ADD COLUMN IF NOT EXISTS tenant_id text;

-- calendar table
ALTER TABLE public.calendar ADD COLUMN IF NOT EXISTS uid text;
ALTER TABLE public.calendar ADD COLUMN IF NOT EXISTS data jsonb;
ALTER TABLE public.calendar ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();

-- user_permissions table
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS proc_def_id text;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS proc_def_ids jsonb;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS readable boolean DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS writable boolean DEFAULT false;

-- proc_def_marketplace table
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS definition jsonb;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS bpmn text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS author_uid text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE public.proc_def_marketplace ADD COLUMN IF NOT EXISTS import_count integer DEFAULT 0;

-- form_def_marketplace table
ALTER TABLE public.form_def_marketplace ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid();
ALTER TABLE public.form_def_marketplace ADD COLUMN IF NOT EXISTS id text DEFAULT '';
ALTER TABLE public.form_def_marketplace ADD COLUMN IF NOT EXISTS proc_def_id text;
ALTER TABLE public.form_def_marketplace ADD COLUMN IF NOT EXISTS activity_id text;
ALTER TABLE public.form_def_marketplace ADD COLUMN IF NOT EXISTS html text;
ALTER TABLE public.form_def_marketplace ADD COLUMN IF NOT EXISTS author_uid text;

-- agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS goal text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS persona text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS tools text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS profile text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS skills text;

-- tenant_oauth table
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS client_id VARCHAR(255);
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS client_secret TEXT;
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS redirect_uri VARCHAR(255);
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.tenant_oauth ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- project table
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS name character varying;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS created_date date;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS status character varying;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS project_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT public.tenant_id();
ALTER TABLE public.project ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- milestone table
-- ALTER TABLE public.milestone ADD COLUMN IF NOT EXISTS id bigserial;
-- ALTER TABLE public.milestone ADD COLUMN IF NOT EXISTS impact_type character varying;
-- ALTER TABLE public.milestone ADD COLUMN IF NOT EXISTS impact_desc text;
-- ALTER TABLE public.milestone ADD COLUMN IF NOT EXISTS created_date date;
-- ALTER TABLE public.milestone ADD COLUMN IF NOT EXISTS task_id uuid;
-- ALTER TABLE public.milestone ADD COLUMN IF NOT EXISTS impact_id uuid;

-- task_dependency table
ALTER TABLE public.task_dependency ADD COLUMN IF NOT EXISTS id bigserial;
ALTER TABLE public.task_dependency ADD COLUMN IF NOT EXISTS lag_time integer;
ALTER TABLE public.task_dependency ADD COLUMN IF NOT EXISTS lead_time integer;
ALTER TABLE public.task_dependency ADD COLUMN IF NOT EXISTS type character varying;
ALTER TABLE public.task_dependency ADD COLUMN IF NOT EXISTS created_date date;
ALTER TABLE public.task_dependency ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE public.task_dependency ADD COLUMN IF NOT EXISTS depends_id uuid; 

-- project
CREATE POLICY project_insert_policy ON project FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY project_select_policy ON project FOR SELECT TO authenticated USING (tenant_id = public.tenant_id());
CREATE POLICY project_update_policy ON project FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));
CREATE POLICY project_delete_policy ON project FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()) AND (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)));


DROP TRIGGER IF EXISTS encrypt_credentials_trigger ON public.users;

DROP FUNCTION IF EXISTS encrypt_credentials(TEXT);
DROP FUNCTION IF EXISTS decrypt_credentials(TEXT);
DROP FUNCTION IF EXISTS encrypt_credentials_trigger();


alter publication supabase_realtime add table chats;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table todolist;
alter publication supabase_realtime add table bpm_proc_inst;
alter publication supabase_realtime add table proc_def;

-- Agents
DROP TABLE IF EXISTS public.agents;
