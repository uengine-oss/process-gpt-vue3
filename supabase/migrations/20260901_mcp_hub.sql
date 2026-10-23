-- ============================================================
-- MCP Hub : 서버 등록 / 버전 / 툴 카탈로그 / 권한 / 헬스 / 관측
-- ------------------------------------------------------------
-- 정본은 아래 테이블이고, 레거시 public.tenants.mcp jsonb 는
-- public.sync_tenants_mcp() 트리거가 재생성하는 파생 미러로 강등된다.
-- 덕분에 기존 소비자(deepagents/core/llm/mcp.py, completion 의
-- mcp_processor.py, cli-agent/core/bridge.py, AgentField.vue)는
-- 코드 수정 없이 계속 동작한다.
-- ============================================================

-- ---------- enum ----------
DO $$ BEGIN
  CREATE TYPE mcp_transport_enum AS ENUM ('stdio','http','sse','streamable-http');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mcp_server_status_enum AS ENUM ('draft','active','deprecated','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mcp_health_state_enum AS ENUM ('unknown','healthy','degraded','unhealthy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mcp_source_enum AS ENUM ('manual','gallery','registry','imported-jsonb');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mcp_principal_enum AS ENUM ('tenant','department','role','user','agent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mcp_permission_enum AS ENUM ('none','use','manage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 공용 트리거 함수 ----------
create or replace function public.mcp_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- 1) 서버 ----------
create table if not exists public.mcp_server (
    id uuid not null default gen_random_uuid(),
    tenant_id text not null default public.tenant_id(),
    name text not null,
    display_name text null,
    description text null,
    category text null,
    tags text[] null default '{}',
    department_id text null,
    owner_email text null,
    doc_url text null,
    status mcp_server_status_enum not null default 'draft',
    is_default boolean not null default false,
    enabled boolean not null default true,
    current_version_id uuid null,
    source mcp_source_enum not null default 'manual',
    source_ref text null,
    created_at timestamp with time zone not null default now(),
    created_by text null,
    updated_at timestamp with time zone not null default now(),
    updated_by text null,
    is_deleted boolean not null default false,
    deleted_at timestamp with time zone null,
    constraint mcp_server_pkey primary key (id),
    constraint mcp_server_uk unique (tenant_id, name),
    constraint mcp_server_tenant_fkey foreign key (tenant_id)
        references public.tenants (id) on update cascade on delete cascade
) tablespace pg_default;

create index if not exists idx_mcp_server_tenant on public.mcp_server (tenant_id) where is_deleted = false;
create index if not exists idx_mcp_server_department on public.mcp_server (tenant_id, department_id);

drop trigger if exists mcp_server_updated_at on public.mcp_server;
create trigger mcp_server_updated_at
    before update on public.mcp_server
    for each row execute function public.mcp_touch_updated_at();

-- ---------- 2) 버전 (연결정보 불변 스냅샷) ----------
create table if not exists public.mcp_server_version (
    id uuid not null default gen_random_uuid(),
    server_id uuid not null references public.mcp_server (id) on delete cascade,
    tenant_id text not null default public.tenant_id(),
    version integer not null,
    semver text null,
    transport mcp_transport_enum not null,
    command text null,
    args jsonb null default '[]'::jsonb,
    url text null,
    headers jsonb null default '{}'::jsonb,
    env jsonb null default '{}'::jsonb,
    timeout_ms integer not null default 30000,
    config_hash text not null,
    change_note text null,
    validated_at timestamp with time zone null,
    validation_result jsonb null,
    created_at timestamp with time zone not null default now(),
    created_by text null,
    constraint mcp_server_version_pkey primary key (id),
    constraint mcp_server_version_uk unique (server_id, version)
) tablespace pg_default;

create index if not exists idx_mcp_server_version_server on public.mcp_server_version (server_id, version desc);

DO $$ BEGIN
  ALTER TABLE public.mcp_server
    ADD CONSTRAINT mcp_server_current_version_fkey
    FOREIGN KEY (current_version_id) REFERENCES public.mcp_server_version (id)
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 3) 툴 카탈로그 캐시 ----------
create table if not exists public.mcp_tool (
    id uuid not null default gen_random_uuid(),
    server_id uuid not null references public.mcp_server (id) on delete cascade,
    version_id uuid null references public.mcp_server_version (id) on delete set null,
    tenant_id text not null default public.tenant_id(),
    tool_name text not null,
    sanitized_name text not null,
    description text null,
    input_schema jsonb null,
    output_schema jsonb null,
    annotations jsonb null,
    is_available boolean not null default true,
    first_seen_at timestamp with time zone not null default now(),
    last_seen_at timestamp with time zone not null default now(),
    constraint mcp_tool_pkey primary key (id),
    constraint mcp_tool_uk unique (server_id, tool_name)
) tablespace pg_default;

create index if not exists idx_mcp_tool_tenant on public.mcp_tool (tenant_id) where is_available = true;
create index if not exists idx_mcp_tool_name on public.mcp_tool (tenant_id, tool_name);

-- ---------- 4) 접근 권한 ----------
create table if not exists public.mcp_server_permission (
    id uuid not null default gen_random_uuid(),
    server_id uuid not null references public.mcp_server (id) on delete cascade,
    tenant_id text not null default public.tenant_id(),
    principal_type mcp_principal_enum not null,
    principal_id text null,
    permission mcp_permission_enum not null default 'use',
    allowed_tools text[] null,
    denied_tools text[] null default '{}',
    created_at timestamp with time zone not null default now(),
    created_by text null,
    constraint mcp_server_permission_pkey primary key (id)
) tablespace pg_default;

-- principal_id 가 null 인 tenant 스코프도 유일해야 하므로 표현식 인덱스로 대체
create unique index if not exists mcp_server_permission_uk
    on public.mcp_server_permission (server_id, principal_type, coalesce(principal_id, '*'));

-- ---------- 5) 에이전트 바인딩 ----------
create table if not exists public.mcp_agent_binding (
    id uuid not null default gen_random_uuid(),
    tenant_id text not null default public.tenant_id(),
    agent_id text not null,
    server_id uuid not null references public.mcp_server (id) on delete cascade,
    allowed_tools text[] null,
    enabled boolean not null default true,
    created_at timestamp with time zone not null default now(),
    constraint mcp_agent_binding_pkey primary key (id),
    constraint mcp_agent_binding_uk unique (agent_id, server_id)
) tablespace pg_default;

create index if not exists idx_mcp_agent_binding_agent on public.mcp_agent_binding (tenant_id, agent_id);

-- ---------- 6) 헬스 ----------
create table if not exists public.mcp_server_health (
    id bigserial primary key,
    server_id uuid not null references public.mcp_server (id) on delete cascade,
    tenant_id text not null default public.tenant_id(),
    checked_at timestamp with time zone not null default now(),
    state mcp_health_state_enum not null default 'unknown',
    latency_ms integer null,
    tool_count integer null,
    protocol_version text null,
    server_info jsonb null,
    error_code text null,
    error_message text null,
    checker text null default 'mcp-hub'
) tablespace pg_default;

create index if not exists idx_mcp_server_health_server on public.mcp_server_health (server_id, checked_at desc);

create table if not exists public.mcp_server_health_current (
    server_id uuid not null references public.mcp_server (id) on delete cascade,
    tenant_id text not null default public.tenant_id(),
    state mcp_health_state_enum not null default 'unknown',
    checked_at timestamp with time zone not null default now(),
    latency_ms integer null,
    tool_count integer null,
    consecutive_failures integer not null default 0,
    availability_24h numeric(5,2) null,
    error_message text null,
    constraint mcp_server_health_current_pkey primary key (server_id)
) tablespace pg_default;

create index if not exists idx_mcp_health_current_tenant on public.mcp_server_health_current (tenant_id, state);

-- ---------- 7) MCP 호출 로그 (관측 정본) ----------
create table if not exists public.mcp_call_log (
    id uuid not null default gen_random_uuid(),
    tenant_id text not null default public.tenant_id(),
    server_id uuid null references public.mcp_server (id) on delete set null,
    server_name text not null,
    tool_name text not null,
    trace_id text null,
    span_id text null,
    parent_span_id text null,
    proc_inst_id text null,
    todo_id text null,
    job_id text null,
    agent_id text null,
    user_id text null,
    engine text null,
    started_at timestamp with time zone not null default now(),
    finished_at timestamp with time zone null,
    duration_ms integer null,
    status text not null default 'running',
    error_type text null,
    error_message text null,
    input_bytes integer null,
    output_bytes integer null,
    input_preview jsonb null,
    output_preview jsonb null,
    constraint mcp_call_log_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_mcp_call_log_tenant_time on public.mcp_call_log (tenant_id, started_at desc);
create index if not exists idx_mcp_call_log_server_time on public.mcp_call_log (server_id, started_at desc);
create index if not exists idx_mcp_call_log_proc on public.mcp_call_log (proc_inst_id);
create index if not exists idx_mcp_call_log_todo on public.mcp_call_log (todo_id);
create index if not exists idx_mcp_call_log_trace on public.mcp_call_log (trace_id);

-- ---------- 8) LLM 호출 로그 (LiteLLM 콜백 수신) ----------
create table if not exists public.llm_call_log (
    id uuid not null default gen_random_uuid(),
    tenant_id text null default public.tenant_id(),
    trace_id text null,
    span_id text null,
    parent_span_id text null,
    proc_inst_id text null,
    todo_id text null,
    job_id text null,
    agent_id text null,
    engine text null,
    call_type text null,
    model text null,
    provider text null,
    litellm_call_id text null,
    started_at timestamp with time zone null,
    finished_at timestamp with time zone null,
    duration_ms integer null,
    status text not null default 'success',
    prompt_tokens integer null,
    completion_tokens integer null,
    total_tokens integer null,
    cache_read_tokens integer null,
    cost_usd numeric(14,8) null,
    error_type text null,
    error_message text null,
    tool_calls_count integer null,
    raw jsonb null,
    constraint llm_call_log_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_llm_call_log_tenant_time on public.llm_call_log (tenant_id, started_at desc);
create index if not exists idx_llm_call_log_proc on public.llm_call_log (proc_inst_id);
create index if not exists idx_llm_call_log_trace on public.llm_call_log (trace_id);

-- ---------- 9) 갤러리 / 레지스트리 카탈로그 ----------
create table if not exists public.mcp_catalog_entry (
    id uuid not null default gen_random_uuid(),
    source mcp_source_enum not null,
    slug text not null,
    name text not null,
    description text null,
    category text null,
    tags text[] null default '{}',
    publisher text null,
    homepage_url text null,
    icon_url text null,
    install_template jsonb not null,
    required_env jsonb null default '[]'::jsonb,
    registry_payload jsonb null,
    updated_at timestamp with time zone not null default now(),
    constraint mcp_catalog_entry_pkey primary key (id),
    constraint mcp_catalog_entry_uk unique (source, slug)
) tablespace pg_default;

-- ============================================================
-- 권한 판정
-- department_id / role 은 users 스키마에 부서 컬럼이 없으므로
-- 호출자(mcp-hub)가 알고 있는 값을 인자로 넘긴다.
-- ============================================================
create or replace function public.mcp_can_use(
    p_server_id uuid,
    p_agent_id text,
    p_department_id text default null
) returns boolean language sql stable as $$
  select case
    -- 권한 행이 하나도 없으면 테넌트 전체 허용(기존 동작 유지)
    when not exists (select 1 from public.mcp_server_permission p where p.server_id = p_server_id)
      then true
    else coalesce(bool_or(p.permission in ('use','manage')), false)
  end
  from public.mcp_server_permission p
  where p.server_id = p_server_id
    and (
         p.principal_type = 'tenant'
      or (p.principal_type = 'agent' and p.principal_id = p_agent_id)
      or (p.principal_type = 'user'  and p.principal_id = p_agent_id)
      or (p.principal_type = 'department' and p_department_id is not null
          and p.principal_id = p_department_id)
      or (p.principal_type = 'role' and p.principal_id in
            (select u.role from public.users u where u.id::text = p_agent_id))
    );
$$;

-- ============================================================
-- 레거시 호환: 정본 테이블 -> tenants.mcp jsonb 투영
-- ============================================================
create or replace function public.mcp_servers_jsonb(p_tenant text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'mcpServers',
    coalesce(jsonb_object_agg(s.name, c.cfg), '{}'::jsonb)
  )
  from public.mcp_server s
  join public.mcp_server_version v on v.id = s.current_version_id
  cross join lateral (
    select jsonb_strip_nulls(
      case when v.transport = 'stdio' then
        jsonb_build_object(
          'command', v.command,
          'args',    nullif(v.args, '[]'::jsonb),
          'env',     nullif(v.env, '{}'::jsonb)
        )
      else
        jsonb_build_object(
          'type',    v.transport::text,
          'url',     v.url,
          'headers', nullif(v.headers, '{}'::jsonb)
        )
      end
      || jsonb_build_object('enabled', s.enabled, 'is_default', s.is_default)
    ) as cfg
  ) c
  where s.tenant_id = p_tenant
    and s.is_deleted = false;
$$;

create or replace function public.sync_tenants_mcp()
returns trigger language plpgsql security definer as $$
declare
  t text;
begin
  t := coalesce(new.tenant_id, old.tenant_id);
  if t is null then
    return null;
  end if;
  update public.tenants
     set mcp = public.mcp_servers_jsonb(t)
   where id = t;
  return null;
end $$;

drop trigger if exists trg_mcp_server_sync on public.mcp_server;
create trigger trg_mcp_server_sync
    after insert or update or delete on public.mcp_server
    for each row execute function public.sync_tenants_mcp();

drop trigger if exists trg_mcp_server_version_sync on public.mcp_server_version;
create trigger trg_mcp_server_version_sync
    after insert or update on public.mcp_server_version
    for each row execute function public.sync_tenants_mcp();

-- ============================================================
-- RLS
-- ============================================================
alter table public.mcp_server              enable row level security;
alter table public.mcp_server_version      enable row level security;
alter table public.mcp_tool                enable row level security;
alter table public.mcp_server_permission   enable row level security;
alter table public.mcp_agent_binding       enable row level security;
alter table public.mcp_server_health       enable row level security;
alter table public.mcp_server_health_current enable row level security;
alter table public.mcp_call_log            enable row level security;
alter table public.llm_call_log            enable row level security;
alter table public.mcp_catalog_entry       enable row level security;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mcp_server','mcp_server_version','mcp_tool','mcp_server_permission',
    'mcp_agent_binding','mcp_server_health','mcp_server_health_current',
    'mcp_call_log','llm_call_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.tenant_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_insert_policy ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_update_policy ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_delete_policy ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.tenant_id())', t, t);
  END LOOP;
END $$;

-- 카탈로그는 테넌트 무관 전역 읽기, 쓰기는 service_role 만
DROP POLICY IF EXISTS mcp_catalog_entry_select_policy ON public.mcp_catalog_entry;
CREATE POLICY mcp_catalog_entry_select_policy ON public.mcp_catalog_entry
    FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 백필 : tenants.mcp jsonb -> mcp_server + mcp_server_version(v1)
-- 여러 번 실행해도 안전하다 (이미 있는 name 은 건너뛴다).
-- ============================================================
create or replace function public.mcp_backfill_from_tenants()
returns integer language plpgsql security definer as $$
declare
  r          record;
  v_srv_id   uuid;
  v_ver_id   uuid;
  v_transport mcp_transport_enum;
  v_count    integer := 0;
begin
  for r in
    select t.id as tenant_id, e.key as name, e.value as cfg
      from public.tenants t
      cross join lateral jsonb_each(coalesce(t.mcp -> 'mcpServers', '{}'::jsonb)) e
  loop
    -- 이미 등록된 서버는 건너뛴다
    if exists (select 1 from public.mcp_server s
                where s.tenant_id = r.tenant_id and s.name = r.name) then
      continue;
    end if;

    v_transport := case
      when coalesce(r.cfg ->> 'command', '') <> '' then 'stdio'
      when coalesce(r.cfg ->> 'type', '') in ('http','streamable_http','streamable-http') then 'streamable-http'
      when coalesce(r.cfg ->> 'type', '') = 'sse' then 'sse'
      when coalesce(r.cfg ->> 'url', '') <> '' then 'streamable-http'
      else 'stdio'
    end;

    insert into public.mcp_server (
      tenant_id, name, description, status, enabled, is_default, source
    ) values (
      r.tenant_id,
      r.name,
      r.cfg ->> 'description',
      'active',
      coalesce((r.cfg ->> 'enabled')::boolean, true),
      coalesce((r.cfg ->> 'is_default')::boolean, false),
      'imported-jsonb'
    ) returning id into v_srv_id;

    insert into public.mcp_server_version (
      server_id, tenant_id, version, transport,
      command, args, url, headers, env, config_hash, change_note
    ) values (
      v_srv_id, r.tenant_id, 1, v_transport,
      r.cfg ->> 'command',
      coalesce(r.cfg -> 'args',    '[]'::jsonb),
      r.cfg ->> 'url',
      coalesce(r.cfg -> 'headers', '{}'::jsonb),
      coalesce(r.cfg -> 'env',     '{}'::jsonb),
      encode(sha256((r.cfg #- '{enabled}' #- '{is_default}')::text::bytea), 'hex'),
      'tenants.mcp 에서 자동 이관'
    ) returning id into v_ver_id;

    update public.mcp_server set current_version_id = v_ver_id where id = v_srv_id;
    v_count := v_count + 1;
  end loop;

  -- users.tools CSV -> mcp_agent_binding
  insert into public.mcp_agent_binding (tenant_id, agent_id, server_id)
  select u.tenant_id, u.id::text, s.id
    from public.users u
    cross join lateral unnest(string_to_array(coalesce(u.tools, ''), ',')) tool_name
    join public.mcp_server s
      on s.tenant_id = u.tenant_id and s.name = btrim(tool_name)
   where u.is_agent = true
     and btrim(tool_name) <> ''
  on conflict (agent_id, server_id) do nothing;

  return v_count;
end $$;

select public.mcp_backfill_from_tenants();

comment on table public.mcp_server is 'MCP 서버 정본. tenants.mcp jsonb 는 sync_tenants_mcp() 트리거가 만드는 파생 미러다.';
comment on table public.mcp_server_version is '연결정보 불변 스냅샷. 수정은 새 버전 생성으로만 이뤄진다.';
comment on table public.mcp_call_log is 'MCP 툴 호출 관측 정본. events 는 UI 스트림용 요약만 담는다.';
comment on table public.llm_call_log is 'LiteLLM 프록시 콜백이 적재하는 LLM 호출 로그. trace_id 로 mcp_call_log 와 조인된다.';
comment on function public.mcp_servers_jsonb(text) is '정본 테이블을 레거시 {"mcpServers":{...}} 형태로 투영한다.';
