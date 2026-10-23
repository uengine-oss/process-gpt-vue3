-- ============================================================
-- 실행 프로파일링용 페이로드 사이드카
-- ------------------------------------------------------------
-- llm_call_log / mcp_call_log 는 관측 대시보드가 풀스캔 집계하는
-- 핫 테이블이라 큰 텍스트를 넣으면 안 된다. 프롬프트·응답·툴 인자
-- 원문은 여기에 따로 두고 보존기간을 짧게 가져간다.
-- ============================================================

create table if not exists public.trace_payload (
    id bigserial primary key,
    tenant_id text not null default public.tenant_id(),
    trace_id text null,
    span_id text not null,
    span_kind text not null,            -- 'llm' | 'mcp'
    proc_inst_id text null,
    todo_id text null,
    job_id text null,
    created_at timestamp with time zone not null default now(),
    -- LLM
    messages jsonb null,                -- 마스킹된 프롬프트 배열
    completion jsonb null,              -- {content, tool_calls, finish_reason}
    model_params jsonb null,            -- temperature/max_tokens/tool_choice/tools(이름만)
    -- MCP / tool
    tool_input jsonb null,
    tool_output jsonb null,
    -- 공통
    truncated boolean not null default false,
    orig_bytes integer null
) tablespace pg_default;

-- 같은 스팬이 재전송돼도 한 행만 남게 한다 (업서트 키)
create unique index if not exists trace_payload_span_uk
    on public.trace_payload (span_id, span_kind);
create index if not exists idx_trace_payload_tenant_time
    on public.trace_payload (tenant_id, created_at desc);
create index if not exists idx_trace_payload_todo on public.trace_payload (todo_id);
create index if not exists idx_trace_payload_job on public.trace_payload (job_id);
create index if not exists idx_trace_payload_trace on public.trace_payload (trace_id);

alter table public.trace_payload enable row level security;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS trace_payload_select_policy ON public.trace_payload';
  EXECUTE 'CREATE POLICY trace_payload_select_policy ON public.trace_payload
             FOR SELECT TO authenticated USING (tenant_id = public.tenant_id())';
  EXECUTE 'DROP POLICY IF EXISTS trace_payload_insert_policy ON public.trace_payload';
  EXECUTE 'CREATE POLICY trace_payload_insert_policy ON public.trace_payload
             FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id())';
  EXECUTE 'DROP POLICY IF EXISTS trace_payload_delete_policy ON public.trace_payload';
  EXECUTE 'CREATE POLICY trace_payload_delete_policy ON public.trace_payload
             FOR DELETE TO authenticated USING (tenant_id = public.tenant_id())';
END $$;

-- ------------------------------------------------------------
-- llm_call_log: 집계·필터에 쓰이는 스칼라만 본 테이블에 추가.
-- 프롬프트·응답 본문은 위 사이드카로 간다.
-- ------------------------------------------------------------
alter table public.llm_call_log add column if not exists finish_reason text;
alter table public.llm_call_log add column if not exists model_actual text;
alter table public.llm_call_log add column if not exists user_id text;
alter table public.llm_call_log add column if not exists cache_creation_tokens integer;
alter table public.llm_call_log add column if not exists request_id text;
alter table public.llm_call_log add column if not exists api_base text;

comment on table public.trace_payload is
  '실행 프로파일링용 원문(프롬프트·응답·툴 인자). 마스킹 후 짧은 보존기간으로 유지한다.';
