-- ============================================================================
-- 역량(capability) 기반 조직 모델
--
-- 지금까지 조직도에는 "누가 어느 팀인가"만 있었고, "이 일을 하려면 어떤 역량이
-- 필요한가 / 누가 그 일을 맡을 자격이 있는가" 를 표현할 방법이 없었다.
-- 그래서 프로세스의 다음 단계 담당자를 사람 이름으로만 지정할 수밖에 없었고,
-- 인계 기록에서 조직 구조를 도출해도 붙일 자리가 없었다.
--
-- 세 층으로 나눈다:
--   org_capabilities        역량 사전 (예: 견적 산출, 계약 검토, 승인 권한)
--   user_capabilities       누가 어떤 역량을 가졌나 (관측 근거와 함께)
--   activity_eligibility    어떤 활동을 하려면 어떤 역량/역할/부서여야 하나
--
-- user_capabilities 는 사람이 직접 등록할 수도 있고(source='declared'),
-- 인계 기록에서 도출할 수도 있다(source='observed'). 도출된 것은 근거 건수를
-- 함께 남겨 "왜 이 사람이 후보인가" 를 설명할 수 있게 한다.
-- ============================================================================

create table if not exists public.org_capabilities (
    id           uuid        not null default gen_random_uuid(),
    tenant_id    text        not null default public.tenant_id(),
    name         text        not null,
    description  text        null,
    -- 이 역량이 처음 어떻게 생겼는지: 사람이 정의 / 인계 기록에서 도출
    origin       text        not null default 'declared',
    created_at   timestamptz not null default now(),
    constraint org_capabilities_pkey primary key (id),
    constraint org_capabilities_origin_check check (origin in ('declared', 'observed')),
    constraint org_capabilities_tenant_fkey foreign key (tenant_id)
        references public.tenants (id) on update cascade on delete cascade
);
create unique index if not exists uq_org_capabilities_name
    on public.org_capabilities (tenant_id, name);

create table if not exists public.user_capabilities (
    id             uuid        not null default gen_random_uuid(),
    tenant_id      text        not null default public.tenant_id(),
    user_id        text        not null,          -- users.id (사람 또는 에이전트)
    capability_id  uuid        not null,
    -- declared: 관리자가 등록 / observed: 인계 기록에서 도출
    source         text        not null default 'declared',
    -- 도출 근거 건수. 왜 후보로 떴는지 설명하는 데 쓴다.
    evidence_count integer     not null default 0,
    proficiency    text        null,              -- 예: primary / backup
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    constraint user_capabilities_pkey primary key (id),
    constraint user_capabilities_source_check check (source in ('declared', 'observed')),
    constraint user_capabilities_capability_fkey foreign key (capability_id)
        references public.org_capabilities (id) on update cascade on delete cascade,
    constraint user_capabilities_tenant_fkey foreign key (tenant_id)
        references public.tenants (id) on update cascade on delete cascade
);
create unique index if not exists uq_user_capabilities
    on public.user_capabilities (tenant_id, user_id, capability_id);

-- 활동 → 자격 요건. 담당자를 사람 이름으로 못 박지 않고
-- "이 역량을 가진 사람 / 이 역할 / 이 부서" 로 풀 수 있게 한다.
create table if not exists public.activity_eligibility (
    id                   uuid        not null default gen_random_uuid(),
    tenant_id            text        not null default public.tenant_id(),
    proc_def_id          text        null,        -- 아직 제안 단계면 비어 있을 수 있다
    activity_name        text        not null,
    required_capability  uuid        null,
    required_role        text        null,
    required_department  text        null,
    -- 이 요건이 어떻게 정해졌는지
    origin               text        not null default 'observed',
    evidence_count       integer     not null default 0,
    created_at           timestamptz not null default now(),
    constraint activity_eligibility_pkey primary key (id),
    constraint activity_eligibility_origin_check check (origin in ('declared', 'observed')),
    constraint activity_eligibility_capability_fkey foreign key (required_capability)
        references public.org_capabilities (id) on update cascade on delete set null,
    constraint activity_eligibility_tenant_fkey foreign key (tenant_id)
        references public.tenants (id) on update cascade on delete cascade
);
create index if not exists idx_activity_eligibility_lookup
    on public.activity_eligibility (tenant_id, activity_name);

drop trigger if exists user_capabilities_updated_at on public.user_capabilities;
create trigger user_capabilities_updated_at
    before update on public.user_capabilities
    for each row execute function public.update_updated_at_column();

-- RLS (resource_pull_requests 패턴과 동일)
alter table public.org_capabilities enable row level security;
alter table public.user_capabilities enable row level security;
alter table public.activity_eligibility enable row level security;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_capabilities','user_capabilities','activity_eligibility'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_insert_policy ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.tenant_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.tenant_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_update_policy ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.tenant_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_delete_policy ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.tenant_id())', t, t);
  END LOOP;
END $$;

comment on table public.org_capabilities is '역량 사전. 프로세스 단계가 요구하는 능력을 이름으로 다룬다.';
comment on table public.user_capabilities is '누가 어떤 역량을 가졌나. observed 는 인계 기록에서 도출된 것이며 evidence_count 가 근거 건수다.';
comment on table public.activity_eligibility is '활동 수행 자격. 담당자를 이름이 아니라 역량/역할/부서로 풀 수 있게 한다.';
