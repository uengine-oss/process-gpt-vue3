-- ============================================================================
-- GS 인증모드: 에이전트 학습/지식관리 필수 스키마
-- - agent_knowledge_history
-- - agent_knowledge_setup_log
-- - agent_needing_knowledge_setup()
-- - get_memories(), delete_memory(), delete_memories_by_agent()
-- - realtime publication + grants
-- ============================================================================

-- 1) 에이전트 지식 변경 이력
create table if not exists public.agent_knowledge_history (
  id uuid not null default gen_random_uuid (),
  knowledge_type text not null,
  knowledge_id text not null,
  knowledge_name text null,
  agent_id uuid not null,
  tenant_id text null,
  operation text not null,
  previous_content text null,
  new_content text null,
  moved_from_storage text null,
  moved_to_storage text null,
  feedback_content text null,
  batch_job_id text null,
  created_at timestamp with time zone not null default now(),
  constraint agent_knowledge_history_pkey primary key (id),
  constraint agent_knowledge_history_agent_id_fkey
    foreign key (agent_id, tenant_id) references public.users (id, tenant_id)
    on update cascade on delete cascade,
  constraint agent_knowledge_history_knowledge_type_check
    check (knowledge_type = any (array['MEMORY'::text, 'DMN_RULE'::text, 'SKILL'::text])),
  constraint agent_knowledge_history_operation_check
    check (operation = any (array['CREATE'::text, 'UPDATE'::text, 'DELETE'::text, 'MOVE'::text]))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_knowledge_history_moved_from_storage_check'
  ) then
    alter table public.agent_knowledge_history
      add constraint agent_knowledge_history_moved_from_storage_check
      check (
        moved_from_storage is null
        or moved_from_storage = any (array['MEMORY'::text, 'DMN_RULE'::text, 'SKILL'::text])
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_knowledge_history_moved_to_storage_check'
  ) then
    alter table public.agent_knowledge_history
      add constraint agent_knowledge_history_moved_to_storage_check
      check (
        moved_to_storage is null
        or moved_to_storage = any (array['MEMORY'::text, 'DMN_RULE'::text, 'SKILL'::text])
      );
  end if;
end $$;

create index if not exists idx_agent_knowledge_history_agent_id
  on public.agent_knowledge_history using btree (agent_id);
create index if not exists idx_agent_knowledge_history_tenant_id
  on public.agent_knowledge_history using btree (tenant_id);
create index if not exists idx_agent_knowledge_history_operation
  on public.agent_knowledge_history using btree (operation);
create index if not exists idx_agent_knowledge_history_created_at
  on public.agent_knowledge_history using btree (created_at desc);
create index if not exists idx_agent_knowledge_history_batch_job_id
  on public.agent_knowledge_history using btree (batch_job_id);
create index if not exists idx_agent_knowledge_history_knowledge_type
  on public.agent_knowledge_history using btree (knowledge_type);
create index if not exists idx_agent_knowledge_history_knowledge_id
  on public.agent_knowledge_history using btree (knowledge_id);


-- 2) 에이전트 초기 지식 셋업 로그
create table if not exists public.agent_knowledge_setup_log (
  agent_id uuid not null,
  tenant_id text,
  status text not null default 'DONE',
  created_at timestamptz not null default now(),
  primary key (agent_id),
  constraint agent_knowledge_setup_log_user_fkey
    foreign key (agent_id, tenant_id) references public.users (id, tenant_id)
    on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_knowledge_setup_log_status_check'
  ) then
    alter table public.agent_knowledge_setup_log
      add constraint agent_knowledge_setup_log_status_check
      check (status = any (array['STARTED'::text, 'DONE'::text, 'FAILED'::text]));
  end if;
end $$;

grant select, insert, update on public.agent_knowledge_setup_log to anon, authenticated, service_role;
create index if not exists idx_agent_knowledge_setup_log_agent_id
  on public.agent_knowledge_setup_log(agent_id);

-- realtime 구독 (AgentChatInfo watchData)
do $$
begin
  begin
    alter publication supabase_realtime add table public.agent_knowledge_setup_log;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;


-- 3) 초기 셋업 대상 에이전트 조회
create or replace function public.agent_needing_knowledge_setup(p_limit integer default 1)
returns setof public.users
language plpgsql
stable
as $$
begin
  return query
  select u.*
  from public.users u
  left join public.agent_knowledge_setup_log s on u.id = s.agent_id
  where u.is_agent = true
    and u.agent_type = 'agent'
    and u.goal is not null
    and u.goal <> ''
    and s.agent_id is null
  order by u.id asc
  limit p_limit;
end;
$$;

grant execute on function public.agent_needing_knowledge_setup(integer)
  to anon, authenticated, service_role;


-- 4) Mem0 vector RPC (AgentChat.vue -> getVecsDocuments / deleteVecsDocument)
create or replace function public.get_memories(agent text, lim int default 100)
returns setof vecs.memories
language sql
stable
security definer
as $$
  select *
  from vecs.memories
  where (agent is null or metadata->>'agent_id' = agent)
  order by id
  limit lim;
$$;

create or replace function public.delete_memory(mem_id text)
returns void
language sql
volatile
security definer
as $$
  delete from vecs.memories where id = mem_id;
$$;

create or replace function public.delete_memories_by_agent(agent text)
returns void
language sql
volatile
security definer
as $$
  delete from vecs.memories where metadata->>'agent_id' = agent;
$$;

grant execute on function public.get_memories(text, int)
  to anon, authenticated, service_role;
grant execute on function public.delete_memory(text)
  to anon, authenticated, service_role;
grant execute on function public.delete_memories_by_agent(text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
