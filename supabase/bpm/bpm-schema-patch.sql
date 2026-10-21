-- 일반 BPM 모드(:8081)용 스키마 보강.
-- docker-compose/volumes/db/init.sql + migration.sql 을 빈 DB 에 적용한 것과 비교해, 지금 DB 에 없는 것만 추가한다.
-- 기존 테이블의 트리거·기존 함수는 건드리지 않는다 (PAL 동작 보존).
BEGIN;
SET check_function_bodies = false;
-- 1) 타입
CREATE TYPE public.delegation_status AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'COMPLETED');
CREATE TYPE public.event_status AS ENUM ('ASKED', 'APPROVED', 'REJECTED');
CREATE TYPE public.event_type_enum AS ENUM ('task_started', 'task_completed', 'tool_usage_started', 'tool_usage_finished', 'crew_completed', 'human_asked', 'human_response', 'human_checked', 'task_working', 'error');
CREATE TYPE public.memory_type AS ENUM ('conversation', 'tool_result', 'fact', 'preference');
-- 2) 테이블·뷰
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8




--
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_rooms (
    id text NOT NULL,
    participants jsonb NOT NULL,
    message jsonb,
    name text,
    primary_agent_id text,
    tenant_id text DEFAULT public.tenant_id(),
    context jsonb
);


--
-- Name: chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chats (
    uuid text NOT NULL,
    id text NOT NULL,
    messages jsonb,
    tenant_id text DEFAULT public.tenant_id(),
    thread_id text
);


--
-- Name: chat_room_chats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.chat_room_chats AS
 SELECT cr.id,
    cr.name,
    cr.participants,
    c.uuid,
    c.messages
   FROM (public.chat_rooms cr
     JOIN public.chats c ON ((cr.id = c.id)));


--
-- Name: agent_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_skills (
    user_id uuid NOT NULL,
    tenant_id text NOT NULL,
    skill_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid()
);


--
-- Name: calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar (
    uid text NOT NULL,
    data jsonb,
    tenant_id text DEFAULT public.tenant_id()
);


--
-- Name: chat_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_attachments (
    id text NOT NULL,
    file_name text,
    file_path text,
    chat_room_id text,
    user_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id text
);


--
-- Name: chat_vector_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_vector_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    user_uid uuid NOT NULL,
    room_id text NOT NULL,
    agent_id text,
    source_role text,
    memory_type public.memory_type DEFAULT 'conversation'::public.memory_type NOT NULL,
    content text NOT NULL,
    embedding public.vector(1536),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);


--
-- Name: cron_job_run_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_job_run_log (
    id integer NOT NULL,
    job_name text,
    executed_at timestamp with time zone DEFAULT now(),
    status text,
    http_status integer,
    response_body jsonb,
    error_message text
);


--
-- Name: cron_job_run_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cron_job_run_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cron_job_run_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cron_job_run_log_id_seq OWNED BY public.cron_job_run_log.id;


--
-- Name: data_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_source (
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb,
    version integer DEFAULT 1 NOT NULL,
    description text,
    tenant_id text DEFAULT public.tenant_id(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delegation_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delegation_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    from_user_id text NOT NULL,
    from_username text,
    to_user_id text NOT NULL,
    to_username text,
    reason text,
    status public.delegation_status DEFAULT 'COMPLETED'::public.delegation_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    tenant_id text DEFAULT public.tenant_id()
);


--
-- Name: document_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    tenant_id text NOT NULL,
    image_id text,
    image_url text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: document_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_pages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tenant_id text NOT NULL,
    file_id text NOT NULL,
    page_number integer NOT NULL,
    content text NOT NULL,
    page_meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(1536),
    drive_folder_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: env; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.env (
    key character varying(255) NOT NULL,
    value text,
    tenant_id character varying(255) NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id text NOT NULL,
    job_id text NOT NULL,
    todo_id text,
    proc_inst_id text,
    event_type public.event_type_enum NOT NULL,
    status public.event_status,
    crew_type text,
    data jsonb NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: form_def; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_def (
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    html text NOT NULL,
    proc_def_id text NOT NULL,
    activity_id text NOT NULL,
    tenant_id text DEFAULT public.tenant_id(),
    id text DEFAULT ''::text,
    fields_json jsonb
);


--
-- Name: form_def_marketplace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_def_marketplace (
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    id text DEFAULT ''::text,
    proc_def_id text NOT NULL,
    activity_id text NOT NULL,
    html text NOT NULL,
    fields_json jsonb,
    author_uid text
);


--
-- Name: knowledge_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_files (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tenant_id text NOT NULL,
    source_type text NOT NULL,
    source_ref text NOT NULL,
    file_name text NOT NULL,
    folder_path text,
    drive_folder_id text,
    mime_type text,
    size_bytes bigint,
    modified_time timestamp with time zone,
    owner text,
    uploaded_by_uid text,
    uploaded_by_name text,
    file_hash character(64),
    index_status text DEFAULT 'pending'::text NOT NULL,
    index_error text,
    indexed_at timestamp with time zone,
    doc_role text DEFAULT 'content'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    doc_card jsonb,
    doc_summary jsonb,
    glossary_compact text,
    CONSTRAINT knowledge_files_role_check CHECK ((doc_role = ANY (ARRAY['content'::text, 'glossary'::text, 'template'::text, 'reference'::text, 'dataset'::text]))),
    CONSTRAINT knowledge_files_status_check CHECK ((index_status = ANY (ARRAY['pending'::text, 'processing'::text, 'indexed'::text, 'failed'::text, 'excluded'::text])))
);


--
-- Name: knowledge_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_folders (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tenant_id text NOT NULL,
    folder_path text NOT NULL,
    doc_role text DEFAULT 'content'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_folders_role_check CHECK ((doc_role = ANY (ARRAY['content'::text, 'glossary'::text, 'template'::text, 'reference'::text, 'dataset'::text])))
);


--
-- Name: proc_def_arcv; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proc_def_arcv (
    arcv_id text NOT NULL,
    proc_def_id text NOT NULL,
    version text NOT NULL,
    snapshot text,
    "timeStamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    diff text,
    message text,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text DEFAULT public.tenant_id()
);


--
-- Name: proc_inst_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proc_inst_source (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proc_inst_id text,
    file_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_process boolean DEFAULT false NOT NULL,
    file_path text,
    file_id text
);


--
-- Name: proc_map_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proc_map_history (
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id text DEFAULT public.tenant_id(),
    uuid uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: processed_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_files (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    file_id text NOT NULL,
    tenant_id text NOT NULL,
    processed_at timestamp with time zone DEFAULT now(),
    file_name text
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    name character varying,
    start_date date,
    end_date date,
    created_date date,
    status character varying NOT NULL,
    project_id uuid DEFAULT gen_random_uuid() NOT NULL,
    due_date date,
    user_id text,
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id text DEFAULT public.tenant_id()
);


--
-- Name: task_dependency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_dependency (
    id bigint NOT NULL,
    lag_time integer,
    lead_time integer,
    type character varying,
    created_date date,
    task_id uuid,
    depends_id uuid
);


--
-- Name: task_dependency_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_dependency_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_dependency_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_dependency_id_seq OWNED BY public.task_dependency.id;


--
-- Name: tenant_git_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_git_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    provider text NOT NULL,
    base_url text,
    username text NOT NULL,
    token text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenant_git_config_provider_check CHECK ((provider = ANY (ARRAY['github'::text, 'gitlab'::text, 'gitea'::text])))
);


--
-- Name: tenant_oauth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_oauth (
    tenant_id text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    redirect_uri text,
    drive_folder_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    google_credentials jsonb,
    google_credentials_updated_at timestamp with time zone,
    github_token text,
    github_username text
);


--
-- Name: tenant_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_skills (
    tenant_id text NOT NULL,
    skill_name text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: v_task_dependency; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_task_dependency AS
 SELECT d.id,
    d.lag_time,
    d.lead_time,
    d.type,
    d.created_date,
    d.task_id,
    d.depends_id,
    t.proc_inst_id,
    t.project_id
   FROM (public.task_dependency d
     JOIN public.todolist t ON ((d.task_id = t.id)));


--
-- Name: cron_job_run_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_job_run_log ALTER COLUMN id SET DEFAULT nextval('public.cron_job_run_log_id_seq'::regclass);


--
-- Name: task_dependency id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_dependency ALTER COLUMN id SET DEFAULT nextval('public.task_dependency_id_seq'::regclass);


--
-- Name: TABLE chat_rooms; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_rooms TO postgres;
GRANT ALL ON TABLE public.chat_rooms TO anon;
GRANT ALL ON TABLE public.chat_rooms TO authenticated;
GRANT ALL ON TABLE public.chat_rooms TO service_role;


--
-- Name: TABLE chats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chats TO postgres;
GRANT ALL ON TABLE public.chats TO anon;
GRANT ALL ON TABLE public.chats TO authenticated;
GRANT ALL ON TABLE public.chats TO service_role;


--
-- Name: TABLE chat_room_chats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_room_chats TO postgres;
GRANT ALL ON TABLE public.chat_room_chats TO anon;
GRANT ALL ON TABLE public.chat_room_chats TO authenticated;
GRANT ALL ON TABLE public.chat_room_chats TO service_role;


--
-- Name: TABLE agent_skills; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_skills TO postgres;
GRANT ALL ON TABLE public.agent_skills TO anon;
GRANT ALL ON TABLE public.agent_skills TO authenticated;
GRANT ALL ON TABLE public.agent_skills TO service_role;


--
-- Name: TABLE calendar; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.calendar TO postgres;
GRANT ALL ON TABLE public.calendar TO anon;
GRANT ALL ON TABLE public.calendar TO authenticated;
GRANT ALL ON TABLE public.calendar TO service_role;


--
-- Name: TABLE chat_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_attachments TO postgres;
GRANT ALL ON TABLE public.chat_attachments TO anon;
GRANT ALL ON TABLE public.chat_attachments TO authenticated;
GRANT ALL ON TABLE public.chat_attachments TO service_role;


--
-- Name: TABLE chat_vector_memory; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_vector_memory TO postgres;
GRANT ALL ON TABLE public.chat_vector_memory TO anon;
GRANT ALL ON TABLE public.chat_vector_memory TO authenticated;
GRANT ALL ON TABLE public.chat_vector_memory TO service_role;


--
-- Name: TABLE cron_job_run_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cron_job_run_log TO postgres;
GRANT ALL ON TABLE public.cron_job_run_log TO anon;
GRANT ALL ON TABLE public.cron_job_run_log TO authenticated;
GRANT ALL ON TABLE public.cron_job_run_log TO service_role;


--
-- Name: SEQUENCE cron_job_run_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.cron_job_run_log_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.cron_job_run_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cron_job_run_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cron_job_run_log_id_seq TO service_role;


--
-- Name: TABLE data_source; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_source TO postgres;
GRANT ALL ON TABLE public.data_source TO anon;
GRANT ALL ON TABLE public.data_source TO authenticated;
GRANT ALL ON TABLE public.data_source TO service_role;


--
-- Name: TABLE delegation_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.delegation_history TO postgres;
GRANT ALL ON TABLE public.delegation_history TO anon;
GRANT ALL ON TABLE public.delegation_history TO authenticated;
GRANT ALL ON TABLE public.delegation_history TO service_role;


--
-- Name: TABLE document_images; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_images TO postgres;
GRANT ALL ON TABLE public.document_images TO anon;
GRANT ALL ON TABLE public.document_images TO authenticated;
GRANT ALL ON TABLE public.document_images TO service_role;


--
-- Name: TABLE document_pages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_pages TO postgres;
GRANT ALL ON TABLE public.document_pages TO anon;
GRANT ALL ON TABLE public.document_pages TO authenticated;
GRANT ALL ON TABLE public.document_pages TO service_role;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.documents TO postgres;
GRANT ALL ON TABLE public.documents TO anon;
GRANT ALL ON TABLE public.documents TO authenticated;
GRANT ALL ON TABLE public.documents TO service_role;


--
-- Name: TABLE env; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.env TO postgres;
GRANT ALL ON TABLE public.env TO anon;
GRANT ALL ON TABLE public.env TO authenticated;
GRANT ALL ON TABLE public.env TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO postgres;
GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE form_def; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.form_def TO postgres;
GRANT ALL ON TABLE public.form_def TO anon;
GRANT ALL ON TABLE public.form_def TO authenticated;
GRANT ALL ON TABLE public.form_def TO service_role;


--
-- Name: TABLE form_def_marketplace; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.form_def_marketplace TO postgres;
GRANT ALL ON TABLE public.form_def_marketplace TO anon;
GRANT ALL ON TABLE public.form_def_marketplace TO authenticated;
GRANT ALL ON TABLE public.form_def_marketplace TO service_role;


--
-- Name: TABLE knowledge_files; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_files TO postgres;
GRANT ALL ON TABLE public.knowledge_files TO anon;
GRANT ALL ON TABLE public.knowledge_files TO authenticated;
GRANT ALL ON TABLE public.knowledge_files TO service_role;


--
-- Name: TABLE knowledge_folders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_folders TO postgres;
GRANT ALL ON TABLE public.knowledge_folders TO anon;
GRANT ALL ON TABLE public.knowledge_folders TO authenticated;
GRANT ALL ON TABLE public.knowledge_folders TO service_role;


--
-- Name: TABLE proc_def_arcv; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.proc_def_arcv TO postgres;
GRANT ALL ON TABLE public.proc_def_arcv TO anon;
GRANT ALL ON TABLE public.proc_def_arcv TO authenticated;
GRANT ALL ON TABLE public.proc_def_arcv TO service_role;


--
-- Name: TABLE proc_inst_source; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.proc_inst_source TO postgres;
GRANT ALL ON TABLE public.proc_inst_source TO anon;
GRANT ALL ON TABLE public.proc_inst_source TO authenticated;
GRANT ALL ON TABLE public.proc_inst_source TO service_role;


--
-- Name: TABLE proc_map_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.proc_map_history TO postgres;
GRANT ALL ON TABLE public.proc_map_history TO anon;
GRANT ALL ON TABLE public.proc_map_history TO authenticated;
GRANT ALL ON TABLE public.proc_map_history TO service_role;


--
-- Name: TABLE processed_files; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.processed_files TO postgres;
GRANT ALL ON TABLE public.processed_files TO anon;
GRANT ALL ON TABLE public.processed_files TO authenticated;
GRANT ALL ON TABLE public.processed_files TO service_role;


--
-- Name: TABLE project; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project TO postgres;
GRANT ALL ON TABLE public.project TO anon;
GRANT ALL ON TABLE public.project TO authenticated;
GRANT ALL ON TABLE public.project TO service_role;


--
-- Name: TABLE task_dependency; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_dependency TO postgres;
GRANT ALL ON TABLE public.task_dependency TO anon;
GRANT ALL ON TABLE public.task_dependency TO authenticated;
GRANT ALL ON TABLE public.task_dependency TO service_role;


--
-- Name: SEQUENCE task_dependency_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.task_dependency_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.task_dependency_id_seq TO anon;
GRANT ALL ON SEQUENCE public.task_dependency_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.task_dependency_id_seq TO service_role;


--
-- Name: TABLE tenant_git_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_git_config TO postgres;
GRANT ALL ON TABLE public.tenant_git_config TO anon;
GRANT ALL ON TABLE public.tenant_git_config TO authenticated;
GRANT ALL ON TABLE public.tenant_git_config TO service_role;


--
-- Name: TABLE tenant_oauth; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_oauth TO postgres;
GRANT ALL ON TABLE public.tenant_oauth TO anon;
GRANT ALL ON TABLE public.tenant_oauth TO authenticated;
GRANT ALL ON TABLE public.tenant_oauth TO service_role;


--
-- Name: TABLE tenant_skills; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tenant_skills TO postgres;
GRANT ALL ON TABLE public.tenant_skills TO anon;
GRANT ALL ON TABLE public.tenant_skills TO authenticated;
GRANT ALL ON TABLE public.tenant_skills TO service_role;


--
-- Name: TABLE v_task_dependency; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_task_dependency TO postgres;
GRANT ALL ON TABLE public.v_task_dependency TO anon;
GRANT ALL ON TABLE public.v_task_dependency TO authenticated;
GRANT ALL ON TABLE public.v_task_dependency TO service_role;


--
-- PostgreSQL database dump complete
--

-- 3) 함수
CREATE OR REPLACE FUNCTION public.check_process_permission(p_proc_def_id text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF user_permissions
 LANGUAGE plpgsql
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.cleanup_bpm_proc_inst_related_data()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.cleanup_deleted_bpm_proc_inst_job(p_job_name text, p_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.cleanup_deleted_tenants_job(p_job_name text, p_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.crewai_action_fetch_pending_task(p_limit integer, p_consumer text)
 RETURNS TABLE(id uuid, user_id text, proc_inst_id text, proc_def_id text, activity_id text, activity_name text, start_date timestamp without time zone, end_date timestamp without time zone, description text, tool text, due_date timestamp without time zone, tenant_id text, reference_ids text[], adhoc boolean, assignees jsonb, duration integer, output jsonb, retry integer, consumer text, log text, draft jsonb, project_id uuid, feedback jsonb, updated_at timestamp with time zone, username text, status todo_status, agent_mode agent_mode, agent_orch agent_orch, temp_feedback text, draft_status draft_status, task_type draft_status, root_proc_inst_id text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    WITH cte AS (
      SELECT
        t.*,
        t.draft_status AS task_type   -- 원본 보관
      FROM todolist AS t
      WHERE t.status = 'IN_PROGRESS'
        AND t.agent_orch = 'crewai-action'
        AND (
          (t.agent_mode IN ('DRAFT','COMPLETE') AND t.draft IS NULL AND t.draft_status IS NULL)
          OR t.draft_status = 'FB_REQUESTED'
        )
      ORDER BY t.start_date
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    ),
    upd AS (
      UPDATE todolist AS t
         SET draft_status = 'STARTED',
             consumer     = p_consumer
        FROM cte
       WHERE t.id = cte.id
       RETURNING
         t.id,
         t.user_id,
         t.proc_inst_id,
         t.proc_def_id,
         t.activity_id,
         t.activity_name,
         t.start_date,
         t.end_date,
         t.description,
         t.tool,
         t.due_date,
         t.tenant_id,
         t.reference_ids,
         t.adhoc,
         t.assignees,
         t.duration,
         t.output,
         t.retry,
         t.consumer,
         t.log,
         t.draft,
         t.project_id,
         t.feedback,
         t.updated_at,
         t.username,
         t.status,
         t.agent_mode,
         t.agent_orch,
         t.temp_feedback,
         t.draft_status,              -- 변경 후 값 (STARTED)
         cte.task_type,      -- 변경 전 값
         t.root_proc_inst_id
    )
    SELECT * FROM upd;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.crewai_action_fetch_pending_task_dev(p_limit integer, p_consumer text, p_tenant_id text)
 RETURNS TABLE(id uuid, user_id text, proc_inst_id text, proc_def_id text, activity_id text, activity_name text, start_date timestamp without time zone, end_date timestamp without time zone, description text, tool text, due_date timestamp without time zone, tenant_id text, reference_ids text[], adhoc boolean, assignees jsonb, duration integer, output jsonb, retry integer, consumer text, log text, draft jsonb, project_id uuid, feedback jsonb, updated_at timestamp with time zone, username text, status todo_status, agent_mode agent_mode, agent_orch agent_orch, temp_feedback text, draft_status draft_status, task_type draft_status, root_proc_inst_id text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    WITH cte AS (
      SELECT
        t.*,
        t.draft_status AS task_type   -- 원본 보관
      FROM todolist AS t
      WHERE t.status = 'IN_PROGRESS'
        AND t.agent_orch = 'crewai-action'
        AND t.tenant_id = p_tenant_id
        AND (
          (t.agent_mode IN ('DRAFT','COMPLETE') AND t.draft IS NULL AND t.draft_status IS NULL)
          OR t.draft_status = 'FB_REQUESTED'
        )
      ORDER BY t.start_date
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    ),
    upd AS (
      UPDATE todolist AS t
         SET draft_status = 'STARTED',
             consumer     = p_consumer
        FROM cte
       WHERE t.id = cte.id
       RETURNING
         t.id,
         t.user_id,
         t.proc_inst_id,
         t.proc_def_id,
         t.activity_id,
         t.activity_name,
         t.start_date,
         t.end_date,
         t.description,
         t.tool,
         t.due_date,
         t.tenant_id,
         t.reference_ids,
         t.adhoc,
         t.assignees,
         t.duration,
         t.output,
         t.retry,
         t.consumer,
         t.log,
         t.draft,
         t.project_id,
         t.feedback,
         t.updated_at,
         t.username,
         t.status,
         t.agent_mode,
         t.agent_orch,
         t.temp_feedback,
         t.draft_status,              -- 변경 후 값 (STARTED)
         cte.task_type,                -- 변경 전 값
         t.root_proc_inst_id
    )
    SELECT * FROM upd;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.crewai_deep_fetch_pending_task(p_limit integer, p_consumer text)
 RETURNS TABLE(id uuid, user_id text, proc_inst_id text, proc_def_id text, activity_id text, activity_name text, start_date timestamp without time zone, end_date timestamp without time zone, description text, tool text, due_date timestamp without time zone, tenant_id text, reference_ids text[], adhoc boolean, assignees jsonb, duration integer, output jsonb, retry integer, consumer text, log text, draft jsonb, project_id uuid, feedback jsonb, updated_at timestamp with time zone, username text, status todo_status, agent_mode agent_mode, agent_orch agent_orch, temp_feedback text, draft_status draft_status, task_type draft_status, root_proc_inst_id text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    WITH cte AS (
      SELECT
        t.*,
        t.draft_status AS task_type   -- 원본 보관
      FROM todolist AS t
      WHERE t.status = 'IN_PROGRESS'
        AND t.agent_orch = 'crewai-deep-research'
        AND (
          (t.agent_mode IN ('DRAFT','COMPLETE') AND t.draft IS NULL AND t.draft_status IS NULL)
          OR t.draft_status = 'FB_REQUESTED'
        )
      ORDER BY t.start_date
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    ),
    upd AS (
      UPDATE todolist AS t
         SET draft_status = 'STARTED',
             consumer     = p_consumer
        FROM cte
       WHERE t.id = cte.id
       RETURNING
         t.id,
         t.user_id,
         t.proc_inst_id,
         t.proc_def_id,
         t.activity_id,
         t.activity_name,
         t.start_date,
         t.end_date,
         t.description,
         t.tool,
         t.due_date,
         t.tenant_id,
         t.reference_ids,
         t.adhoc,
         t.assignees,
         t.duration,
         t.output,
         t.retry,
         t.consumer,
         t.log,
         t.draft,
         t.project_id,
         t.feedback,
         t.updated_at,
         t.username,
         t.status,
         t.agent_mode,
         t.agent_orch,
         t.temp_feedback,
         t.draft_status,              -- 변경 후 값 (STARTED)
         cte.task_type,
         t.root_proc_inst_id
    )
    SELECT * FROM upd;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.crewai_deep_fetch_pending_task_dev(p_limit integer, p_consumer text, p_tenant_id text)
 RETURNS TABLE(id uuid, user_id text, proc_inst_id text, proc_def_id text, activity_id text, activity_name text, start_date timestamp without time zone, end_date timestamp without time zone, description text, tool text, due_date timestamp without time zone, tenant_id text, reference_ids text[], adhoc boolean, assignees jsonb, duration integer, output jsonb, retry integer, consumer text, log text, draft jsonb, project_id uuid, feedback jsonb, updated_at timestamp with time zone, username text, status todo_status, agent_mode agent_mode, agent_orch agent_orch, temp_feedback text, draft_status draft_status, task_type draft_status, root_proc_inst_id text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    WITH cte AS (
      SELECT
        t.*,
        t.draft_status AS task_type   -- 원본 보관
      FROM todolist AS t
      WHERE t.status = 'IN_PROGRESS'
        AND t.agent_orch = 'crewai-deep-research'
        AND t.tenant_id = p_tenant_id
        AND (
          (t.agent_mode IN ('DRAFT','COMPLETE') AND t.draft IS NULL AND t.draft_status IS NULL)
          OR t.draft_status = 'FB_REQUESTED'
        )
      ORDER BY t.start_date
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    ),
    upd AS (
      UPDATE todolist AS t
         SET draft_status = 'STARTED',
             consumer     = p_consumer
        FROM cte
       WHERE t.id = cte.id
       RETURNING
         t.id,
         t.user_id,
         t.proc_inst_id,
         t.proc_def_id,
         t.activity_id,
         t.activity_name,
         t.start_date,
         t.end_date,
         t.description,
         t.tool,
         t.due_date,
         t.tenant_id,
         t.reference_ids,
         t.adhoc,
         t.assignees,
         t.duration,
         t.output,
         t.retry,
         t.consumer,
         t.log,
         t.draft,
         t.project_id,
         t.feedback,
         t.updated_at,
         t.username,
         t.status,
         t.agent_mode,
         t.agent_orch,
         t.temp_feedback,
         t.draft_status,              -- 변경 후 값 (STARTED)
         cte.task_type,               -- 변경 전 값
         t.root_proc_inst_id
    )
    SELECT * FROM upd;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.decide_feedback_proposal_target(p_batch_id uuid, p_target_type text, p_status text, p_decided_by uuid, p_decided_by_name text, p_decided_by_email text, p_decision_note text)
 RETURNS feedback_proposals
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_row         public.feedback_proposals;
    v_targets     jsonb;
    v_elem        jsonb;
    v_found       boolean := false;
    v_all_decided boolean := true;
    i             int;
BEGIN
    SELECT * INTO v_row
    FROM public.feedback_proposals
    WHERE id = p_batch_id AND status = 'PROPOSED'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_targets := v_row.targets;

    FOR i IN 0 .. jsonb_array_length(v_targets) - 1 LOOP
        v_elem := v_targets -> i;
        IF (v_elem ->> 'type') = p_target_type AND (v_elem ->> 'status') = 'PENDING' THEN
            v_elem := v_elem || jsonb_build_object(
                'status', p_status,
                'decided_by', p_decided_by,
                'decided_by_name', p_decided_by_name,
                'decided_by_email', p_decided_by_email,
                'decision_note', p_decision_note,
                'decided_at', to_jsonb(now())
            );
            v_targets := jsonb_set(v_targets, ARRAY[i::text], v_elem);
            v_found := true;
        END IF;
    END LOOP;

    IF NOT v_found THEN
        RETURN NULL;
    END IF;

    FOR i IN 0 .. jsonb_array_length(v_targets) - 1 LOOP
        IF (v_targets -> i ->> 'status') = 'PENDING' THEN
            v_all_decided := false;
        END IF;
    END LOOP;

    UPDATE public.feedback_proposals
    SET targets = v_targets,
        status = CASE WHEN v_all_decided THEN 'RESOLVED' ELSE status END
    WHERE id = p_batch_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.deep_research_fetch_pending_task(p_agent_orch text, p_consumer text, p_limit integer)
 RETURNS TABLE(id uuid, user_id text, proc_inst_id text, proc_def_id text, activity_id text, activity_name text, start_date timestamp without time zone, end_date timestamp without time zone, description text, tool text, due_date timestamp without time zone, tenant_id text, reference_ids text[], adhoc boolean, assignees jsonb, duration integer, output jsonb, retry integer, consumer text, log text, draft jsonb, project_id uuid, feedback jsonb, updated_at timestamp with time zone, username text, status todo_status, agent_mode agent_mode, agent_orch agent_orch, temp_feedback text, draft_status draft_status, query text, task_type draft_status)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    WITH cte AS (
      SELECT
        t.*,
        t.draft_status AS task_type
      FROM todolist AS t
      WHERE t.status = 'IN_PROGRESS'
        AND (p_agent_orch IS NULL OR p_agent_orch = '' OR t.agent_orch::text = p_agent_orch)
        AND (
          (t.agent_mode IN ('DRAFT','COMPLETE') AND t.draft IS NULL AND t.draft_status IS NULL)
          OR t.draft_status = 'FB_REQUESTED'
        )
      ORDER BY t.start_date
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    ),
    upd AS (
      UPDATE todolist AS t
         SET draft_status = 'STARTED',
             consumer     = p_consumer
        FROM cte
       WHERE t.id = cte.id
       RETURNING
         t.id,
         t.user_id,
         t.proc_inst_id,
         t.proc_def_id,
         t.activity_id,
         t.activity_name,
         t.start_date,
         t.end_date,
         t.description,
         t.tool,
         t.due_date,
         t.tenant_id,
         t.reference_ids,
         t.adhoc,
         t.assignees,
         t.duration,
         t.output,
         t.retry,
         t.consumer,
         t.log,
         t.draft,
         t.project_id,
         t.feedback,
         t.updated_at,
         t.username,
         t.status,
         t.agent_mode::public.agent_mode,
         t.agent_orch::public.agent_orch,
         t.temp_feedback,
         t.draft_status,
         t.query,
         cte.task_type
    )
    SELECT * FROM upd;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.deep_research_fetch_pending_task_dev(p_agent_orch text, p_consumer text, p_limit integer, p_tenant_id text)
 RETURNS TABLE(id uuid, user_id text, proc_inst_id text, proc_def_id text, activity_id text, activity_name text, start_date timestamp without time zone, end_date timestamp without time zone, description text, tool text, due_date timestamp without time zone, tenant_id text, reference_ids text[], adhoc boolean, assignees jsonb, duration integer, output jsonb, retry integer, consumer text, log text, draft jsonb, project_id uuid, feedback jsonb, updated_at timestamp with time zone, username text, status todo_status, agent_mode agent_mode, agent_orch agent_orch, temp_feedback text, draft_status draft_status, query text, task_type draft_status)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    WITH cte AS (
      SELECT
        t.*,
        t.draft_status AS task_type
      FROM todolist AS t
      WHERE t.status = 'IN_PROGRESS'
        AND t.tenant_id = p_tenant_id
        AND (p_agent_orch IS NULL OR p_agent_orch = '' OR t.agent_orch::text = p_agent_orch)
        AND (
          (t.agent_mode IN ('DRAFT','COMPLETE') AND t.draft IS NULL AND t.draft_status IS NULL)
          OR t.draft_status = 'FB_REQUESTED'
        )
      ORDER BY t.start_date
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    ),
    upd AS (
      UPDATE todolist AS t
         SET draft_status = 'STARTED',
             consumer     = p_consumer
        FROM cte
       WHERE t.id = cte.id
       RETURNING
         t.id,
         t.user_id,
         t.proc_inst_id,
         t.proc_def_id,
         t.activity_id,
         t.activity_name,
         t.start_date,
         t.end_date,
         t.description,
         t.tool,
         t.due_date,
         t.tenant_id,
         t.reference_ids,
         t.adhoc,
         t.assignees,
         t.duration,
         t.output,
         t.retry,
         t.consumer,
         t.log,
         t.draft,
         t.project_id,
         t.feedback,
         t.updated_at,
         t.username,
         t.status,
         t.agent_mode::public.agent_mode,
         t.agent_orch::public.agent_orch,
         t.temp_feedback,
         t.draft_status,
         t.query,
         cte.task_type
    )
    SELECT * FROM upd;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.delegate_super_admin(p_new_super_admin_id uuid, p_tenant_id text DEFAULT tenant_id())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_current_user_id uuid;
    v_current_role text;
    v_target_exists boolean;
BEGIN
    v_current_user_id := auth.uid();
    IF v_current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT role
      INTO v_current_role
      FROM public.users
     WHERE id = v_current_user_id
       AND tenant_id = p_tenant_id
     LIMIT 1;

    IF COALESCE(v_current_role, '') <> 'superAdmin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only superAdmin can delegate');
    END IF;

    IF p_new_super_admin_id = v_current_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot delegate to yourself');
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM public.users
         WHERE id = p_new_super_admin_id
           AND tenant_id = p_tenant_id
           AND is_agent = false
    ) INTO v_target_exists;

    IF NOT v_target_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
    END IF;

    UPDATE public.users
       SET role = 'superAdmin',
           is_admin = true
     WHERE id = p_new_super_admin_id
       AND tenant_id = p_tenant_id;

    UPDATE public.users
       SET role = 'admin',
           is_admin = true
     WHERE id = v_current_user_id
       AND tenant_id = p_tenant_id;

    UPDATE public.tenants
       SET owner = p_new_super_admin_id
     WHERE id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', p_tenant_id,
        'new_super_admin_id', p_new_super_admin_id,
        'previous_super_admin_id', v_current_user_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_cron_job(p_job_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  perform cron.unschedule(p_job_name);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_expired_chat_vector_memory()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM chat_vector_memory WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_notification_on_todolist_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM notifications
    WHERE url = '/todolist/' || OLD.id;

    RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
declare
  result json;
begin
  execute query into result;
  return result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.fetch_done_data(p_proc_inst_id text)
 RETURNS TABLE(output jsonb)
 LANGUAGE sql
AS $function$
  SELECT t.output
    FROM public.todolist AS t
   WHERE (t.root_proc_inst_id = p_proc_inst_id OR t.proc_inst_id = p_proc_inst_id)
     AND t.status = 'DONE'
     AND t.output IS NOT NULL
   ORDER BY t.start_date;
$function$
;
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
 RETURNS SETOF cron.job
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  select * from cron.job;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  insert into public.users (
    id,
    username,
    email,
    tenant_id,
    is_admin,
    role
  )
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data ->> 'name'),
      new.email
    ),
    new.email,
    'process-gpt',   -- 고정 테넌트
    false,           -- 항상 일반 유저
    'user'           -- 기본 역할
  )
  on conflict (id, tenant_id) do nothing;  -- 이미 있으면 무시

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, filter jsonb DEFAULT '{}'::jsonb, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
AS $function$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
$function$
;
CREATE OR REPLACE FUNCTION public.normalize_cron_expr_for_pg_cron(p_cron_expr text)
 RETURNS TABLE(normalized_expr text, target_year integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_tokens text[];
  v_count int;
  v_dom text;
  v_dow text;
begin
  v_tokens := regexp_split_to_array(
    trim(regexp_replace(coalesce(p_cron_expr, ''), '\s+', ' ', 'g')),
    ' '
  );
  v_count := coalesce(array_length(v_tokens, 1), 0);

  if v_count = 5 then
    v_dom := replace(v_tokens[3], '?', '*');
    v_dow := replace(v_tokens[5], '?', '*');
    normalized_expr := format('%s %s %s %s %s', v_tokens[1], v_tokens[2], v_dom, v_tokens[4], v_dow);
    target_year := null;
    return next;
    return;
  end if;

  if v_count = 6 then
    v_dom := replace(v_tokens[4], '?', '*');
    v_dow := replace(v_tokens[6], '?', '*');
    normalized_expr := format('%s %s %s %s %s', v_tokens[2], v_tokens[3], v_dom, v_tokens[5], v_dow);
    target_year := null;
    return next;
    return;
  end if;

  if v_count = 7 then
    v_dom := replace(v_tokens[4], '?', '*');
    v_dow := replace(v_tokens[6], '?', '*');
    normalized_expr := format('%s %s %s %s %s', v_tokens[2], v_tokens[3], v_dom, v_tokens[5], v_dow);

    if v_tokens[7] ~ '^\d{4}$' then
      target_year := v_tokens[7]::int;
    elsif v_tokens[7] in ('*', '?') then
      target_year := null;
    else
      raise exception 'Unsupported 7th cron token(year): %', v_tokens[7];
    end if;

    return next;
    return;
  end if;

  raise exception 'Unsupported cron field count: %, expr=%', v_count, p_cron_expr;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.openai_deep_fetch_pending_task_dev(p_limit integer, p_consumer text, p_tenant_id text)
 RETURNS TABLE(id uuid, user_id text, proc_inst_id text, proc_def_id text, activity_id text, activity_name text, start_date timestamp without time zone, end_date timestamp without time zone, description text, tool text, due_date timestamp without time zone, tenant_id text, reference_ids text[], adhoc boolean, assignees jsonb, duration integer, output jsonb, retry integer, consumer text, log text, draft jsonb, project_id uuid, feedback jsonb, updated_at timestamp with time zone, username text, status todo_status, agent_mode agent_mode, agent_orch agent_orch, temp_feedback text, draft_status draft_status, task_type draft_status)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
    WITH cte AS (
      SELECT
        t.*,
        t.draft_status AS task_type   -- 원본 보관
      FROM todolist AS t
      WHERE t.status = 'IN_PROGRESS'
        AND t.agent_orch = 'openai-deep-research'
        AND t.tenant_id = p_tenant_id
        AND (
          (t.agent_mode IN ('DRAFT','COMPLETE') AND t.draft IS NULL AND t.draft_status IS NULL)
          OR t.draft_status = 'FB_REQUESTED'
        )
      ORDER BY t.start_date
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    ),
    upd AS (
      UPDATE todolist AS t
         SET draft_status = 'STARTED',
             consumer     = p_consumer
        FROM cte
       WHERE t.id = cte.id
       RETURNING
         t.id,
         t.user_id,
         t.proc_inst_id,
         t.proc_def_id,
         t.activity_id,
         t.activity_name,
         t.start_date,
         t.end_date,
         t.description,
         t.tool,
         t.due_date,
         t.tenant_id,
         t.reference_ids,
         t.adhoc,
         t.assignees,
         t.duration,
         t.output,
         t.retry,
         t.consumer,
         t.log,
         t.draft,
         t.project_id,
         t.feedback,
         t.updated_at,
         t.username,
         t.status,
         t.agent_mode,
         t.agent_orch,
         t.temp_feedback,
         t.draft_status,              -- 변경 후 값 (STARTED)
         cte.task_type                -- 변경 전 값
    )
    SELECT * FROM upd;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.record_events_bulk(p_events jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO events (id, job_id, todo_id, proc_inst_id, crew_type, event_type, data, status)
  SELECT COALESCE((e->>'id')::uuid, gen_random_uuid()),
         e->>'job_id',
         e->>'todo_id',
         e->>'proc_inst_id',
         e->>'crew_type',
         (e->>'event_type')::public.event_type_enum,
         (e->'data')::jsonb,
         NULLIF(e->>'status','')::public.event_status
    FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb)) AS e;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.register_bpm_proc_inst_cleanup()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.register_cron_intermidiated(p_job_name text, p_cron_expr text, p_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_job_name text;
  v_normalized_cron_expr text;
  v_target_year int;
begin
  select normalized_expr, target_year
    into v_normalized_cron_expr, v_target_year
  from public.normalize_cron_expr_for_pg_cron(p_cron_expr);

  -- 기존 job이 있으면 unschedule
  select jobname into v_job_name
  from cron.job
  where jobname = p_job_name;

  if v_job_name is not null then
    perform cron.unschedule(v_job_name);
  end if;

  -- 새로 schedule
  perform cron.schedule(
    p_job_name,
    v_normalized_cron_expr,
    format(
      E'select public.update_todolist_status_with_year(''%s'', ''%s'', %s);',
      p_input->>'proc_inst_id',
      p_input->>'activity_id',
      coalesce(v_target_year::text, 'null')
    )
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.register_cron_job(p_job_name text, p_cron_expr text, p_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.register_tenant_cleanup()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.save_task_result(p_todo_id uuid, p_payload jsonb, p_final boolean)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_mode text;
BEGIN
  SELECT agent_mode
    INTO v_mode
    FROM todolist
   WHERE id = p_todo_id;

  IF p_final THEN
    IF v_mode = 'COMPLETE' THEN
      UPDATE todolist
         SET output       = p_payload,
             status       = 'SUBMITTED',
             draft_status = 'COMPLETED',
             consumer     = NULL
       WHERE id = p_todo_id;
    ELSE
      UPDATE todolist
         SET draft        = p_payload,
             draft_status = 'COMPLETED',
             consumer     = NULL
       WHERE id = p_todo_id;
    END IF;
  ELSE
    UPDATE todolist
       SET draft = p_payload
     WHERE id = p_todo_id;
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.search_bpm_proc_inst(keyword text, user_email text)
 RETURNS SETOF bpm_proc_inst
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT *
    FROM bpm_proc_inst
    WHERE (proc_def_id ILIKE '%' || keyword || '%'
       OR proc_inst_id ILIKE '%' || keyword || '%'
       OR proc_inst_name ILIKE '%' || keyword || '%'
       OR variables_data::text ILIKE '%' || keyword || '%')
      AND user_email = ANY(participants);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.search_chat_room_chats(keyword text)
 RETURNS SETOF chat_room_chats
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT *
    FROM chat_room_chats
    WHERE messages->>'content' ILIKE '%' || keyword || '%'
       OR messages->>'name' ILIKE '%' || keyword || '%'
       OR messages->>'email' ILIKE '%' || keyword || '%';
END;
$function$
;
CREATE OR REPLACE FUNCTION public.search_chat_vector_memory(p_tenant_id text, p_user_uid uuid, p_room_id text, p_embedding vector, p_limit integer DEFAULT 8, p_memory_types memory_type[] DEFAULT NULL::memory_type[], p_agent_id text DEFAULT NULL::text, p_min_similarity double precision DEFAULT NULL::double precision)
 RETURNS TABLE(id uuid, room_id text, agent_id text, source_role text, memory_type memory_type, content text, metadata jsonb, similarity double precision, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.room_id,
        m.agent_id,
        m.source_role,
        m.memory_type,
        m.content,
        m.metadata,
        1 - (m.embedding <=> p_embedding) AS similarity,
        m.created_at
    FROM chat_vector_memory m
    WHERE m.tenant_id = p_tenant_id
      AND m.user_uid = p_user_uid
      AND m.room_id = p_room_id
      AND (m.expires_at IS NULL OR m.expires_at > NOW())
      AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
      AND (p_agent_id IS NULL OR m.agent_id = p_agent_id)
      AND m.embedding IS NOT NULL
      AND (p_min_similarity IS NULL OR (1 - (m.embedding <=> p_embedding)) >= p_min_similarity)
    ORDER BY m.embedding <=> p_embedding
    LIMIT p_limit;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_user_permissions_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.id := NEW.proc_def_id || '_' || NEW.user_id;
    RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.start_process_scheduled(p_job_name text, p_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.update_bpm_proc_inst_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.proc_inst_id IS NOT NULL THEN
    UPDATE public.bpm_proc_inst
    SET updated_at = now()
    WHERE proc_inst_id = NEW.proc_inst_id;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_notification_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE notifications
    SET user_id = NEW.user_id,
        time_stamp = now()
    WHERE url = '/todolist/' || NEW.id;

    RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_project_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    UPDATE public.project
    SET updated_at = now()
    WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_tenant_id_for_first_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.update_todolist_status(p_proc_inst_id text, p_activity_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_job_name text := p_proc_inst_id || '_' || p_activity_id;
begin
  -- 상태를 SUBMITTED로 업데이트
  update todolist
  set status = 'SUBMITTED',
      updated_at = now()
  where proc_inst_id = p_proc_inst_id
    and activity_id = p_activity_id;

  -- 스케줄에서 job 제거
  perform cron.unschedule(v_job_name);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_todolist_status_with_year(p_proc_inst_id text, p_activity_id text, p_target_year integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_current_year int := extract(year from now())::int;
  v_job_name text := p_proc_inst_id || '_' || p_activity_id;
begin
  if p_target_year is not null then
    if v_current_year > p_target_year then
      -- 이미 지나간 연도인 경우 불필요 반복 실행 방지를 위해 잡 정리
      perform cron.unschedule(v_job_name);
      return;
    end if;

    if v_current_year < p_target_year then
      -- 대상 연도가 아니면 대기
      return;
    end if;
  end if;

  perform public.update_todolist_status(p_proc_inst_id, p_activity_id);
end;
$function$
;
-- 4) 제약·인덱스·트리거·RLS 정책
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8



--
-- Name: agent_skills agent_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_pkey PRIMARY KEY (user_id, tenant_id, skill_name);


--
-- Name: calendar calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar
    ADD CONSTRAINT calendar_pkey PRIMARY KEY (uid);


--
-- Name: chat_attachments chat_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_pkey PRIMARY KEY (id);


--
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: chat_vector_memory chat_vector_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_vector_memory
    ADD CONSTRAINT chat_vector_memory_pkey PRIMARY KEY (id);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (uuid);


--
-- Name: cron_job_run_log cron_job_run_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_job_run_log
    ADD CONSTRAINT cron_job_run_log_pkey PRIMARY KEY (id);


--
-- Name: data_source data_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_source
    ADD CONSTRAINT data_source_pkey PRIMARY KEY (uuid);


--
-- Name: delegation_history delegation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_history
    ADD CONSTRAINT delegation_history_pkey PRIMARY KEY (id);


--
-- Name: document_images document_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_images
    ADD CONSTRAINT document_images_pkey PRIMARY KEY (id);


--
-- Name: document_pages document_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_pkey PRIMARY KEY (id);


--
-- Name: document_pages document_pages_unique_page; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_unique_page UNIQUE (tenant_id, file_id, page_number);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: env env_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.env
    ADD CONSTRAINT env_pkey PRIMARY KEY (tenant_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: form_def_marketplace form_def_marketplace_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_def_marketplace
    ADD CONSTRAINT form_def_marketplace_pkey PRIMARY KEY (uuid);


--
-- Name: form_def form_def_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_def
    ADD CONSTRAINT form_def_pkey PRIMARY KEY (uuid);


--
-- Name: knowledge_files knowledge_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_files
    ADD CONSTRAINT knowledge_files_pkey PRIMARY KEY (id);


--
-- Name: knowledge_files knowledge_files_unique_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_files
    ADD CONSTRAINT knowledge_files_unique_source UNIQUE (tenant_id, source_type, source_ref);


--
-- Name: knowledge_folders knowledge_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_folders
    ADD CONSTRAINT knowledge_folders_pkey PRIMARY KEY (id);


--
-- Name: knowledge_folders knowledge_folders_unique_role; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_folders
    ADD CONSTRAINT knowledge_folders_unique_role UNIQUE (tenant_id, doc_role, folder_path);


--
-- Name: proc_def_arcv proc_def_arcv_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proc_def_arcv
    ADD CONSTRAINT proc_def_arcv_pkey PRIMARY KEY (uuid);


--
-- Name: proc_inst_source proc_inst_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proc_inst_source
    ADD CONSTRAINT proc_inst_source_pkey PRIMARY KEY (id);


--
-- Name: proc_map_history proc_map_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proc_map_history
    ADD CONSTRAINT proc_map_history_pkey PRIMARY KEY (uuid);


--
-- Name: processed_files processed_files_file_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_files
    ADD CONSTRAINT processed_files_file_id_tenant_id_key UNIQUE (file_id, tenant_id);


--
-- Name: processed_files processed_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_files
    ADD CONSTRAINT processed_files_pkey PRIMARY KEY (id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (project_id);


--
-- Name: tenant_git_config tenant_git_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_git_config
    ADD CONSTRAINT tenant_git_config_pkey PRIMARY KEY (id);


--
-- Name: tenant_git_config tenant_git_config_tenant_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_git_config
    ADD CONSTRAINT tenant_git_config_tenant_id_provider_key UNIQUE (tenant_id, provider);


--
-- Name: tenant_oauth tenant_oauth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_oauth
    ADD CONSTRAINT tenant_oauth_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_skills tenant_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_skills
    ADD CONSTRAINT tenant_skills_pkey PRIMARY KEY (tenant_id, skill_name);


--
-- Name: task_dependency worklist_dependency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_dependency
    ADD CONSTRAINT worklist_dependency_pkey PRIMARY KEY (id);


--
-- Name: documents_drive_folder_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_drive_folder_id_idx ON public.documents USING btree (drive_folder_id);


--
-- Name: idx_agent_skills_tenant_skill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_skills_tenant_skill ON public.agent_skills USING btree (tenant_id, skill_name);


--
-- Name: idx_chat_vector_memory_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_vector_memory_agent ON public.chat_vector_memory USING btree (agent_id);


--
-- Name: idx_chat_vector_memory_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_vector_memory_created ON public.chat_vector_memory USING btree (created_at DESC);


--
-- Name: idx_chat_vector_memory_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_vector_memory_embedding ON public.chat_vector_memory USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_chat_vector_memory_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_vector_memory_expires ON public.chat_vector_memory USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_chat_vector_memory_room_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_vector_memory_room_created ON public.chat_vector_memory USING btree (room_id, created_at DESC);


--
-- Name: idx_chat_vector_memory_tenant_user_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_vector_memory_tenant_user_room ON public.chat_vector_memory USING btree (tenant_id, user_uid, room_id);


--
-- Name: idx_chat_vector_memory_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_vector_memory_type ON public.chat_vector_memory USING btree (memory_type);


--
-- Name: idx_delegation_history_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegation_history_task_id ON public.delegation_history USING btree (task_id);


--
-- Name: idx_delegation_history_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delegation_history_tenant_id ON public.delegation_history USING btree (tenant_id);


--
-- Name: idx_document_images_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_images_document_id ON public.document_images USING btree (document_id);


--
-- Name: idx_document_images_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_images_tenant_id ON public.document_images USING btree (tenant_id);


--
-- Name: idx_document_pages_tenant_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_pages_tenant_file ON public.document_pages USING btree (tenant_id, file_id);


--
-- Name: idx_knowledge_files_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_files_tenant ON public.knowledge_files USING btree (tenant_id);


--
-- Name: idx_knowledge_files_tenant_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_files_tenant_folder ON public.knowledge_files USING btree (tenant_id, folder_path);


--
-- Name: idx_knowledge_files_tenant_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_files_tenant_hash ON public.knowledge_files USING btree (tenant_id, file_hash) WHERE (file_hash IS NOT NULL);


--
-- Name: idx_knowledge_files_tenant_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_files_tenant_role ON public.knowledge_files USING btree (tenant_id, doc_role);


--
-- Name: idx_knowledge_files_tenant_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_files_tenant_source ON public.knowledge_files USING btree (tenant_id, source_type);


--
-- Name: idx_knowledge_files_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_files_tenant_status ON public.knowledge_files USING btree (tenant_id, index_status);


--
-- Name: idx_knowledge_folders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_folders_tenant ON public.knowledge_folders USING btree (tenant_id);


--
-- Name: idx_knowledge_folders_tenant_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_folders_tenant_role ON public.knowledge_folders USING btree (tenant_id, doc_role);


--
-- Name: idx_proc_inst_source_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proc_inst_source_file_id ON public.proc_inst_source USING btree (file_id);


--
-- Name: idx_processed_files_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_files_file_id ON public.processed_files USING btree (file_id);


--
-- Name: idx_processed_files_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_files_tenant_id ON public.processed_files USING btree (tenant_id);


--
-- Name: idx_tenant_skills_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_skills_tenant ON public.tenant_skills USING btree (tenant_id);


--
-- Name: tenant_git_config_one_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenant_git_config_one_default ON public.tenant_git_config USING btree (tenant_id) WHERE (is_default = true);


--
-- Name: unique_data_source_key_version_per_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_data_source_key_version_per_tenant ON public.data_source USING btree (key, version, tenant_id);


--
-- Name: unique_form_def_id_per_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_form_def_id_per_tenant ON public.form_def USING btree (id, tenant_id);


--
-- Name: chats chat_insert_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_insert_trigger AFTER INSERT ON public.chats FOR EACH ROW EXECUTE FUNCTION public.handle_chat_insert();


--
-- Name: knowledge_files set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.knowledge_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_git_config tenant_git_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenant_git_config_updated_at BEFORE UPDATE ON public.tenant_git_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: agent_skills agent_skills_skill_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_skill_fkey FOREIGN KEY (tenant_id, skill_name) REFERENCES public.tenant_skills(tenant_id, skill_name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: agent_skills agent_skills_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT agent_skills_user_fkey FOREIGN KEY (user_id, tenant_id) REFERENCES public.users(id, tenant_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chat_attachments chat_attachments_chat_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_chat_room_id_fkey FOREIGN KEY (chat_room_id) REFERENCES public.chat_rooms(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chat_attachments chat_attachments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: chat_rooms chat_rooms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chats chats_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: data_source data_source_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_source
    ADD CONSTRAINT data_source_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: delegation_history delegation_history_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_history
    ADD CONSTRAINT delegation_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.todolist(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: delegation_history delegation_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegation_history
    ADD CONSTRAINT delegation_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: document_images document_images_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_images
    ADD CONSTRAINT document_images_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: document_pages document_pages_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chat_vector_memory fk_chat_vector_memory_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_vector_memory
    ADD CONSTRAINT fk_chat_vector_memory_user FOREIGN KEY (user_uid) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: form_def form_def_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_def
    ADD CONSTRAINT form_def_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: knowledge_files knowledge_files_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_files
    ADD CONSTRAINT knowledge_files_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: knowledge_folders knowledge_folders_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_folders
    ADD CONSTRAINT knowledge_folders_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: proc_def_arcv proc_def_arcv_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proc_def_arcv
    ADD CONSTRAINT proc_def_arcv_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: proc_map_history proc_map_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proc_map_history
    ADD CONSTRAINT proc_map_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project project_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_oauth tenant_oauth_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_oauth
    ADD CONSTRAINT tenant_oauth_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_skills tenant_skills_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_skills
    ADD CONSTRAINT tenant_skills_owner_fkey FOREIGN KEY (owner_id, tenant_id) REFERENCES public.users(id, tenant_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: calendar; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar calendar_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_delete_policy ON public.calendar FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: calendar calendar_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_insert_policy ON public.calendar FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: calendar calendar_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_select_policy ON public.calendar FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: calendar calendar_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_update_policy ON public.calendar FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: chat_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_rooms chat_rooms_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_rooms_delete_policy ON public.chat_rooms FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: chat_rooms chat_rooms_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_rooms_insert_policy ON public.chat_rooms FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: chat_rooms chat_rooms_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_rooms_select_policy ON public.chat_rooms FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: chat_rooms chat_rooms_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_rooms_update_policy ON public.chat_rooms FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: chat_vector_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_vector_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_vector_memory chat_vector_memory_user_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_vector_memory_user_policy ON public.chat_vector_memory TO authenticated USING (((user_uid = auth.uid()) AND (tenant_id = public.tenant_id())));


--
-- Name: chats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

--
-- Name: chats chats_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chats_delete_policy ON public.chats FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: chats chats_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chats_insert_policy ON public.chats FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: chats chats_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chats_select_policy ON public.chats FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: chats chats_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chats_update_policy ON public.chats FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: data_source; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_source ENABLE ROW LEVEL SECURITY;

--
-- Name: delegation_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delegation_history ENABLE ROW LEVEL SECURITY;

--
-- Name: delegation_history delegation_history_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delegation_history_delete_policy ON public.delegation_history FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: delegation_history delegation_history_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delegation_history_insert_policy ON public.delegation_history FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: delegation_history delegation_history_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delegation_history_select_policy ON public.delegation_history FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: delegation_history delegation_history_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delegation_history_update_policy ON public.delegation_history FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: document_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: document_pages document_pages_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_pages_delete_policy ON public.document_pages FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: document_pages document_pages_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_pages_insert_policy ON public.document_pages FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: document_pages document_pages_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_pages_select_policy ON public.document_pages FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: document_pages document_pages_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_pages_update_policy ON public.document_pages FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: form_def; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_def ENABLE ROW LEVEL SECURITY;

--
-- Name: form_def form_def_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_delete_policy ON public.form_def FOR DELETE TO authenticated USING (((tenant_id = public.tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));


--
-- Name: form_def form_def_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_insert_policy ON public.form_def FOR INSERT TO authenticated WITH CHECK (((tenant_id = public.tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));


--
-- Name: form_def_marketplace; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_def_marketplace ENABLE ROW LEVEL SECURITY;

--
-- Name: form_def_marketplace form_def_marketplace_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_marketplace_delete_policy ON public.form_def_marketplace FOR DELETE TO authenticated USING (true);


--
-- Name: form_def_marketplace form_def_marketplace_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_marketplace_insert_policy ON public.form_def_marketplace FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: form_def_marketplace form_def_marketplace_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_marketplace_select_policy ON public.form_def_marketplace FOR SELECT TO authenticated USING (true);


--
-- Name: form_def_marketplace form_def_marketplace_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_marketplace_update_policy ON public.form_def_marketplace FOR UPDATE TO authenticated USING (true);


--
-- Name: form_def form_def_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_select_policy ON public.form_def FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: form_def form_def_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_def_update_policy ON public.form_def FOR UPDATE TO authenticated USING (((tenant_id = public.tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));


--
-- Name: knowledge_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_files knowledge_files_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_files_delete_policy ON public.knowledge_files FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: knowledge_files knowledge_files_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_files_insert_policy ON public.knowledge_files FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: knowledge_files knowledge_files_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_files_select_policy ON public.knowledge_files FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: knowledge_files knowledge_files_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_files_update_policy ON public.knowledge_files FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: knowledge_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_folders knowledge_folders_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_folders_delete_policy ON public.knowledge_folders FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: knowledge_folders knowledge_folders_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_folders_insert_policy ON public.knowledge_folders FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: knowledge_folders knowledge_folders_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_folders_select_policy ON public.knowledge_folders FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: knowledge_folders knowledge_folders_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_folders_update_policy ON public.knowledge_folders FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: proc_def_arcv; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proc_def_arcv ENABLE ROW LEVEL SECURITY;

--
-- Name: proc_def_arcv proc_def_arcv_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_def_arcv_delete_policy ON public.proc_def_arcv FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: proc_def_arcv proc_def_arcv_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_def_arcv_insert_policy ON public.proc_def_arcv FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: proc_def_arcv proc_def_arcv_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_def_arcv_select_policy ON public.proc_def_arcv FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: proc_def_arcv proc_def_arcv_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_def_arcv_update_policy ON public.proc_def_arcv FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: proc_map_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proc_map_history ENABLE ROW LEVEL SECURITY;

--
-- Name: proc_map_history proc_map_history_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_map_history_delete_policy ON public.proc_map_history FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: proc_map_history proc_map_history_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_map_history_insert_policy ON public.proc_map_history FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: proc_map_history proc_map_history_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_map_history_select_policy ON public.proc_map_history FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: proc_map_history proc_map_history_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proc_map_history_update_policy ON public.proc_map_history FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: project project_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_delete_policy ON public.project FOR DELETE TO authenticated USING (((tenant_id = public.tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));


--
-- Name: project project_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_insert_policy ON public.project FOR INSERT TO authenticated WITH CHECK (((tenant_id = public.tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));


--
-- Name: project project_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_select_policy ON public.project FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: project project_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_update_policy ON public.project FOR UPDATE TO authenticated USING (((tenant_id = public.tenant_id()) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))));


--
-- Name: tenant_git_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_git_config ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_git_config tenant_git_config_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_git_config_delete_policy ON public.tenant_git_config FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: tenant_git_config tenant_git_config_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_git_config_insert_policy ON public.tenant_git_config FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: tenant_git_config tenant_git_config_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_git_config_select_policy ON public.tenant_git_config FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: tenant_git_config tenant_git_config_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_git_config_update_policy ON public.tenant_git_config FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: tenant_oauth; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_oauth ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_oauth tenant_oauth_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_oauth_delete_policy ON public.tenant_oauth FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: tenant_oauth tenant_oauth_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_oauth_insert_policy ON public.tenant_oauth FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: tenant_oauth tenant_oauth_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_oauth_select_policy ON public.tenant_oauth FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: tenant_oauth tenant_oauth_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_oauth_update_policy ON public.tenant_oauth FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));


--
-- Name: tenant_skills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_skills tenant_skills_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_skills_delete_policy ON public.tenant_skills FOR DELETE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: tenant_skills tenant_skills_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_skills_insert_policy ON public.tenant_skills FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.tenant_id()));


--
-- Name: tenant_skills tenant_skills_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_skills_select_policy ON public.tenant_skills FOR SELECT TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- Name: tenant_skills tenant_skills_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_skills_update_policy ON public.tenant_skills FOR UPDATE TO authenticated USING ((tenant_id = public.tenant_id()));


--
-- PostgreSQL database dump complete
--

-- 5) 기존 테이블에 빠진 컬럼
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS agent_id text;
ALTER TABLE public.proc_def ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;
ALTER TABLE public.resource_pull_requests ADD COLUMN IF NOT EXISTS requester_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS skills text[];
ALTER TABLE public.todolist ADD COLUMN IF NOT EXISTS feedback_collected_count integer DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;
-- 6) exec_sql 은 임의 SQL 실행 함수라 service_role(completion polling) 에만 연다.
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
-- 6-1) RLS 가 없는 새 테이블은 원본대로면 anon 키로 읽기/쓰기가 열린다. 54321 이 외부 공개라 anon 만 막는다.
REVOKE ALL ON public.chat_attachments, public.project, public.task_dependency, public.processed_files, public.documents,
    public.events, public.cron_job_run_log, public.proc_inst_source, public.document_images, public.env, public.agent_skills FROM anon;
-- 7) 실시간 구독 대상
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats, public.events, public.project, public.bpm_proc_inst, public.todolist, public.proc_def;
COMMIT;
NOTIFY pgrst, 'reload schema';
