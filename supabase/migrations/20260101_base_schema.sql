-- =============================================================================
-- Base schema required for local Supabase startup
-- - The rest of migrations assume these objects already exist.
-- - Extracted/minimized from docker-compose/volumes/db/init.sql
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE process_status AS ENUM ('NEW', 'RUNNING', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE todo_status AS ENUM ('NEW', 'TODO', 'IN_PROGRESS', 'SUBMITTED', 'PENDING', 'DONE', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_mode AS ENUM ('DRAFT', 'COMPLETE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_orch AS ENUM ('crewai-action', 'openai-deep-research', 'crewai-deep-research', 'langchain-react', 'browser-automation-agent', 'a2a', 'visionparse');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE draft_status AS ENUM ('STARTED', 'CANCELLED', 'COMPLETED', 'FB_REQUESTED', 'HUMAN_ASKED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tenant id helper
CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    btrim(
      COALESCE(
        ((current_setting('request.jwt.claims', true)::jsonb ->> 'app_metadata')::jsonb ->> 'tenant_id'),
        (current_setting('request.jwt.claim.tenant_id', true))
      )
    ),
    ''
  );
$$;

-- Core tables
CREATE TABLE IF NOT EXISTS public.tenants (
  id text PRIMARY KEY,
  owner uuid NULL DEFAULT auth.uid(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL,
  mcp jsonb NULL
);

-- Keep a default tenant for local usage (safe if rerun)
INSERT INTO public.tenants (id, owner)
VALUES ('process-gpt', NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL,
  username text NULL,
  profile text NULL DEFAULT '/images/defaultUser.png'::text,
  email text NULL,
  is_admin boolean NOT NULL DEFAULT false,
  role text NULL,
  tenant_id text NOT NULL DEFAULT 'process-gpt',
  device_token text NULL,
  goal text NULL,
  persona text NULL,
  endpoint text NULL,
  description text NULL,
  tools text NULL,
  skills text NULL,
  is_agent boolean NOT NULL DEFAULT false,
  agent_type text NULL,
  model text NULL,
  alias text NULL,
  last_used_at timestamptz NULL DEFAULT now(),
  tool_priority jsonb NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id, tenant_id),
  CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_is_agent_true
  ON public.users (is_agent)
  WHERE is_agent = true;

CREATE TABLE IF NOT EXISTS public.proc_def (
  id text NOT NULL,
  name text NULL,
  definition jsonb NULL,
  bpmn text NULL,
  prod_version text NULL,
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NULL DEFAULT public.tenant_id(),
  isdeleted boolean NOT NULL DEFAULT false,
  owner text NULL,
  type text NULL,
  CONSTRAINT proc_def_pkey PRIMARY KEY (uuid),
  CONSTRAINT proc_def_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.bpm_proc_inst (
  proc_def_id text NULL,
  proc_inst_id text NOT NULL,
  proc_inst_name text NULL,
  root_proc_inst_id text NULL,
  parent_proc_inst_id text NULL,
  execution_scope text NULL,
  current_activity_ids text[] NULL,
  participants text[] NULL,
  role_bindings jsonb NULL,
  variables_data jsonb NULL,
  status process_status NULL,
  tenant_id text NULL DEFAULT public.tenant_id(),
  proc_def_version text NULL,
  version_tag text NULL,
  version text NULL,
  project_id uuid NULL,
  start_date timestamp without time zone NULL,
  end_date timestamp without time zone NULL,
  due_date timestamp without time zone NULL,
  updated_at timestamptz DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL,
  is_clean_up boolean NOT NULL DEFAULT false,
  CONSTRAINT bpm_proc_inst_pkey PRIMARY KEY (proc_inst_id),
  CONSTRAINT bpm_proc_inst_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.todolist (
  id uuid NOT NULL,
  user_id text NULL,
  username text NULL,
  proc_inst_id text NULL,
  root_proc_inst_id text NULL,
  execution_scope text NULL,
  proc_def_id text NULL,
  version_tag text NULL,
  version text NULL,
  activity_id text NULL,
  activity_name text NULL,
  start_date timestamp without time zone NULL,
  end_date timestamp without time zone NULL,
  status todo_status NULL,
  description text NULL,
  tool text NULL,
  due_date timestamp without time zone NULL,
  tenant_id text NULL DEFAULT public.tenant_id(),
  reference_ids text[] NULL,
  adhoc boolean NULL DEFAULT false,
  assignees jsonb NULL,
  duration integer NULL,
  output jsonb NULL,
  retry integer NULL DEFAULT 0,
  consumer text NULL,
  log text NULL,
  project_id uuid NULL,
  draft jsonb NULL,
  agent_mode agent_mode NULL,
  agent_orch agent_orch NULL,
  feedback jsonb NULL,
  draft_status draft_status NULL,
  updated_at timestamptz DEFAULT now(),
  temp_feedback text NULL,
  output_url text NULL,
  rework_count integer NULL DEFAULT 0,
  query text NULL,
  feedback_status text NULL,
  CONSTRAINT todolist_pkey PRIMARY KEY (id),
  CONSTRAINT todolist_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id text NOT NULL,
  user_id uuid NOT NULL,
  tenant_id text NOT NULL DEFAULT public.tenant_id(),
  proc_def_id text NOT NULL,
  proc_def_ids jsonb NOT NULL,
  readable boolean NOT NULL DEFAULT false,
  writable boolean NOT NULL DEFAULT false,
  deployable boolean NOT NULL DEFAULT false,
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id)
);

