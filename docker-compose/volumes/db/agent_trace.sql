-- ============================================================================
-- agent_trace.sql  —  에이전트 실행 디버깅 뷰어용 standalone 스크립트
--
-- 수동으로 따로 실행한다. (init.sql / migration.sql 은 건드리지 않음)
--   psql "$DATABASE_URL" -f agent_trace.sql
--   또는 Supabase Studio SQL editor 에 붙여넣기
--
-- 담는 것:
--   ① 신규 public.agent_trace  — deepagents-lite 한 턴의 실행 과정(메인 행동·도구
--      호출·서브에이전트 위임·LLM 프롬프트/응답/토큰)을 append-only 로 적재.
--      FK·RLS·트리거 없음. 전부 INSERT (run_start 1행 → 이벤트 N행 → run_end 1행).
--   ② 기존 chats / chat_rooms 최근순 정렬 컬럼 보강 (+ chat_rooms updated_at 트리거).
-- 멱등(idempotent): 여러 번 실행해도 안전.
-- ============================================================================


-- ① ─────────────────────────────────────────────────────────────────────────
-- 에이전트 실행 트레이스 (단일 테이블, append-only)
-- ----------------------------------------------------------------------------
create table if not exists public.agent_trace (
    id              bigint generated always as identity primary key,
    run_id          text   not null,            -- 턴 id (uuid 문자열). FK 아님.
    conversation_id text,                        -- 채팅방 id (= chat_rooms.id, 제약 아님)
    tenant_id       text,                        -- 필터용 컬럼 (제약 아님)
    seq             int    not null,             -- 턴 내 이벤트 순서 (sink 가 발급)
    ts              timestamptz not null default now(),
    kind            text   not null,             -- run_start|run_end|tool_start|tool_end|llm_call|pipeline|error
    agent           text,                        -- main / answerer / knowledge-navigator ...
    parent_subagent text,                        -- 트리 들여쓰기용 (이 이벤트가 속한 상위 서브)
    depth           int,                         -- 0 = 메인, 1+ = 서브 깊이
    tool            text,                        -- 도구 이벤트일 때 도구명
    title           text,                        -- 짧은 라벨 (예: "→ knowledge-navigator")
    success         boolean,
    duration_ms     numeric,
    payload         jsonb                        -- kind 별 상세 (프롬프트/응답/args/result/tokens ...)
);

create index if not exists agent_trace_conv_idx on public.agent_trace (conversation_id, seq);
create index if not exists agent_trace_run_idx  on public.agent_trace (run_id, seq);
create index if not exists agent_trace_tenant_ts_idx on public.agent_trace (tenant_id, ts desc);


-- ② ─────────────────────────────────────────────────────────────────────────
-- 기존 chat 테이블 최근순 정렬 컬럼 보강
-- ----------------------------------------------------------------------------

-- chats: 메시지 1건 = 1행 (uuid PK, insert-per-message) → created_at 만으로 정확.
--        동시각 tie-break 용 자동증가 seq(identity) 추가. (UPDATE 안 되므로 트리거 불필요)
alter table public.chats add column if not exists created_at timestamptz not null default now();
alter table public.chats add column if not exists seq        bigint generated always as identity;
create index if not exists chats_id_created_idx on public.chats (id, created_at desc);

-- chat_rooms: 방당 1행 (활동 중 upsert=UPDATE) → created_at + updated_at,
--             BEFORE UPDATE 트리거로 마지막 활동시각 자동 반영.
alter table public.chat_rooms add column if not exists created_at timestamptz not null default now();
alter table public.chat_rooms add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_chat_rooms_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chat_rooms_set_updated_at on public.chat_rooms;
create trigger chat_rooms_set_updated_at
  before update on public.chat_rooms
  for each row execute function public.set_chat_rooms_updated_at();

create index if not exists chat_rooms_updated_idx on public.chat_rooms (tenant_id, updated_at desc);
