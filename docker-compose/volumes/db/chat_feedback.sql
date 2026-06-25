-- ============================================================================
-- chat_feedback.sql  —  채팅 AI 답변 피드백(👍/👎 + 코멘트) standalone 스크립트
--
-- 수동으로 따로 실행한다. (init.sql / migration.sql 은 건드리지 않음)
--   docker exec -i -e PGPASSWORD=postgres <db컨테이너> \
--     psql -U supabase_admin -d postgres -f - < chat_feedback.sql
--
-- 설계:
--   - 피드백 단위 = AI 답변(메시지)별. target_uuid = 답변 메시지 uuid
--     (= 프론트 response_uuid = chats.uuid). agent_trace.run_start.payload->>'response_uuid'
--     와 매칭해 그 답을 만든 run 의 트레이스로 직결된다.
--   - 1인 1메시지 = (target_uuid, user_uid) unique → upsert(토글/수정).
--   - PoC 간소화: RLS·FK 없음. tenant_id 는 public.tenant_id() default 로 JWT 에서 자동.
-- 멱등(idempotent).
-- ============================================================================

create table if not exists public.chat_feedback (
    id              bigint generated always as identity primary key,
    tenant_id       text default public.tenant_id(),   -- authenticated insert 시 JWT 에서 자동
    conversation_id text not null,                      -- chat_rooms.id (방)
    target_uuid     text not null,                      -- AI 답변 uuid (=response_uuid=chats.uuid)
    rating          smallint not null,                  -- 1=👍, -1=👎
    category        text,                               -- 👎 분류: wrong|insufficient|irrelevant|other
    comment         text,
    user_uid        text,
    user_email      text,
    user_name       text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- 1인 1메시지 = upsert 키 (재클릭으로 rating/코멘트 수정)
create unique index if not exists chat_feedback_uniq on public.chat_feedback (target_uuid, user_uid);
create index if not exists chat_feedback_conv_idx   on public.chat_feedback (conversation_id, created_at desc);
create index if not exists chat_feedback_tenant_idx on public.chat_feedback (tenant_id, created_at desc);
create index if not exists chat_feedback_target_idx on public.chat_feedback (target_uuid);

-- updated_at 자동 갱신 트리거 (chat_rooms 패턴 재사용)
create or replace function public.set_chat_feedback_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chat_feedback_set_updated_at on public.chat_feedback;
create trigger chat_feedback_set_updated_at
  before update on public.chat_feedback
  for each row execute function public.set_chat_feedback_updated_at();
