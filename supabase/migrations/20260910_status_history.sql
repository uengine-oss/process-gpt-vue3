-- ============================================================
-- todolist 상태전이 이력 — 리드타임 분해용
--
-- 왜 필요한가:
--   완료된 사람 태스크 124건 중 task_started 이벤트는 6건뿐이다.
--   task_started/task_completed 는 에이전트 executor 만 방출하므로
--   사람이 언제 착수해서 언제 제출했는지가 어디에도 남지 않는다.
--   그 결과 정작 병목인 HITL 태스크가 워터폴에서 0초로 찍힌다.
--
--   todolist 는 현재 상태만 들고 있고 updated_at 은 이후 쓰기에 계속
--   덮인다(사람 행 중앙값 29일). task_execution_properties 는 행을
--   덮어쓰며 비종료 상태를 전부 'STARTED' 로 뭉갠다. 그래서 전이를
--   append-only 로 쌓는 테이블이 따로 필요하다.
-- ============================================================

create table if not exists public.todolist_status_history (
    id              bigserial primary key,
    tenant_id       text not null default public.tenant_id(),

    todo_id         uuid not null,
    proc_inst_id    text,
    activity_id     text,

    from_status     todo_status,          -- INSERT 시 null (=배정)
    to_status       todo_status not null,
    changed_at      timestamptz not null default now(),

    changed_by      text,                 -- todolist.user_id
    changed_by_is_agent boolean not null default false,

    -- 같은 todo_id 에서 IN_PROGRESS 재진입 횟수. 0 = 최초 수행, 1+ = 재작업.
    -- 같은 todo_id 가 여러 번 실행되므로(로컬 데이터의 전 태스크가 2세션)
    -- 이 값 없이 min/max 로 묶으면 태스크 길이가 며칠로 부푼다.
    rework_seq      int not null default 0,

    draft_status    draft_status,
    feedback_status text,

    -- 트리거가 남긴 실측이 아니라 과거 데이터에서 역산한 추정치인지.
    -- actual_start_date 는 COALESCE(start_date, updated_at) 로 백필된
    -- 행이 있어 대기가 0 으로 나온다. 구분하지 않으면 "대기 없음" 이라는
    -- 거짓 결론이 나온다.
    is_estimated    boolean not null default false
);

create index if not exists idx_tsh_todo      on public.todolist_status_history (todo_id, changed_at);
create index if not exists idx_tsh_inst      on public.todolist_status_history (proc_inst_id, changed_at);
create index if not exists idx_tsh_tenant    on public.todolist_status_history (tenant_id, changed_at desc);

comment on table  public.todolist_status_history is '워크아이템 상태전이 append-only 이력. 리드타임을 큐대기/사람판단/에이전트수행으로 분해하는 근거.';
comment on column public.todolist_status_history.is_estimated is '과거 데이터 백필로 역산한 추정치(실측 아님)';
comment on column public.todolist_status_history.rework_seq is 'IN_PROGRESS 재진입 횟수. 0=최초, 1+=재작업 세션';

-- ------------------------------------------------------------
-- 전이 적재 트리거
-- ------------------------------------------------------------
create or replace function public.record_todolist_status_change()
returns trigger as $$
declare
    v_from  todo_status;
    v_seq   int;
begin
    if TG_OP = 'UPDATE' then
        -- status 가 실제로 바뀐 경우만. UPDATE OF status 는 값이 같아도 발화한다.
        if NEW.status is not distinct from OLD.status then
            return NEW;
        end if;
        v_from := OLD.status;
    else
        v_from := null;   -- 배정
    end if;

    -- IN_PROGRESS 로 들어갈 때마다 세션 번호를 올린다.
    if NEW.status = 'IN_PROGRESS' then
        select count(*) into v_seq
          from public.todolist_status_history
         where todo_id = NEW.id and to_status = 'IN_PROGRESS';
    else
        select coalesce(max(rework_seq), 0) into v_seq
          from public.todolist_status_history
         where todo_id = NEW.id;
    end if;

    insert into public.todolist_status_history (
        tenant_id, todo_id, proc_inst_id, activity_id,
        from_status, to_status, changed_at,
        changed_by, changed_by_is_agent, rework_seq,
        draft_status, feedback_status, is_estimated
    ) values (
        coalesce(NEW.tenant_id, public.tenant_id()),
        NEW.id, NEW.proc_inst_id, NEW.activity_id,
        v_from, NEW.status, now(),
        NEW.user_id, (NEW.agent_mode is not null), v_seq,
        NEW.draft_status, NEW.feedback_status, false
    );

    return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_record_todolist_status_change on public.todolist;
create trigger trg_record_todolist_status_change
    after insert or update of status on public.todolist
    for each row
    execute function public.record_todolist_status_change();

-- ------------------------------------------------------------
-- 과거 데이터 백필 (1회)
--
-- 트리거는 소급되지 않는다. 기존 행에서 배정/착수/완료를 역산하되
-- 전부 is_estimated=true 로 표시한다. 근거:
--   * start_date 는 naive 이고 계획일이 들어간 행이 있다
--     (실행 09-01 인데 값이 09-13).
--   * actual_start_date 는 20260128 마이그레이션이
--     COALESCE(start_date, updated_at) 로 백필해 둔 행이 섞여 있어
--     그런 행의 대기시간은 0 이 되는데 이는 실측이 아니다.
--   * end_date 는 규칙이 깨져 있다. KST-naive 로 봐도 182건 중 140건,
--     UTC-naive 로 봐도 90건이 착수시각보다 이르다. 완료시각으로 쓰지 않는다.
-- 완료시각은 events 의 마지막 타임스탬프만 인정한다. updated_at 은 이후
-- 쓰기에 계속 덮이므로(사람 행 중앙값 29일) 완료시각으로 쓰면 사람 작업시간이
-- 29일로 찍힌다. 근거가 없으면 완료 행을 만들지 않아 "모름" 으로 남긴다 —
-- 없는 값을 지어내는 것보다 낫다. 앞으로는 트리거가 실측을 남긴다.
-- ------------------------------------------------------------
insert into public.todolist_status_history (
    tenant_id, todo_id, proc_inst_id, activity_id,
    from_status, to_status, changed_at,
    changed_by, changed_by_is_agent, rework_seq,
    draft_status, feedback_status, is_estimated
)
select * from (
    with last_evt as (
        select todo_id, max(timestamp) as ts
          from public.events
         where todo_id is not null
         group by todo_id
    ),
    base as (
        select t.*,
               -- 배정시각: naive start_date 를 UTC 로 보되, 계획일이라
               -- 착수보다 늦으면 착수시각으로 눌러 음수 대기를 만들지 않는다.
               least(
                   coalesce(t.start_date at time zone 'UTC', t.actual_start_date, t.updated_at),
                   coalesce(t.actual_start_date, t.updated_at)
               ) as assigned_at,
               t.actual_start_date as started_at,
               e.ts as finished_at   -- 이벤트 근거가 없으면 null → 완료 행 생략
          from public.todolist t
          left join last_evt e on e.todo_id = t.id::text
    )
    -- 배정
    select b.tenant_id, b.id, b.proc_inst_id, b.activity_id,
           null::todo_status, 'TODO'::todo_status, b.assigned_at,
           b.user_id, (b.agent_mode is not null), 0,
           b.draft_status, b.feedback_status, true
      from base b
     where b.assigned_at is not null

    union all
    -- 착수
    select b.tenant_id, b.id, b.proc_inst_id, b.activity_id,
           'TODO'::todo_status, 'IN_PROGRESS'::todo_status, b.started_at,
           b.user_id, (b.agent_mode is not null), 0,
           b.draft_status, b.feedback_status, true
      from base b
     where b.started_at is not null

    union all
    -- 완료 (종료 상태인 행만)
    select b.tenant_id, b.id, b.proc_inst_id, b.activity_id,
           'IN_PROGRESS'::todo_status, b.status, b.finished_at,
           b.user_id, (b.agent_mode is not null), 0,
           b.draft_status, b.feedback_status, true
      from base b
     where b.status in ('DONE','CANCELLED')
       and b.finished_at is not null
       and b.finished_at >= coalesce(b.started_at, b.assigned_at)
) s
where not exists (select 1 from public.todolist_status_history);

-- ------------------------------------------------------------
-- RLS (mcp_hub 마이그레이션과 동일 패턴)
-- ------------------------------------------------------------
alter table public.todolist_status_history enable row level security;

drop policy if exists todolist_status_history_select_policy on public.todolist_status_history;
create policy todolist_status_history_select_policy on public.todolist_status_history
    for select to authenticated using (tenant_id = public.tenant_id());

drop policy if exists todolist_status_history_insert_policy on public.todolist_status_history;
create policy todolist_status_history_insert_policy on public.todolist_status_history
    for insert to authenticated with check (tenant_id = public.tenant_id());
