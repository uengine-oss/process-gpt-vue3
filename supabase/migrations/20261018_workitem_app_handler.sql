-- ============================================================
-- 워크아이템 화면 플러그인 (Workitem App Handler)
--
-- 활동의 데이터 계약은 그대로 폼(formHandler:<formId>)이다 — 에이전트·폴링·완료 처리는 바뀌지 않는다.
-- 이 테이블은 "그 폼을 어떤 화면으로 보여 주고 받을지"만 정한다. 등록된 외부 앱(업무 시스템) 화면을
-- 워크아이템의 '현재 작업' 영역에 임베드하고, postMessage 계약(pgpt:workitem:*)으로 폼 값을 주고받는다.
-- Process GPT 는 특정 업무 시스템을 모른다 — 앱 등록과 바인딩은 각 시스템의 설치 스크립트가 넣는다.
-- ============================================================
create table if not exists public.workitem_app (
    tenant_id   text not null default public.tenant_id(),
    app_id      text not null,
    name        text not null,
    base_url    text not null,              -- 같은 출처 경로(/myapp/) 권장. 다른 출처면 allowed_origin 필수
    allowed_origin text null,               -- postMessage 를 받을 출처 (null = 같은 출처만)
    description text null,
    enabled     boolean not null default true,
    created_at  timestamptz not null default now(),
    primary key (tenant_id, app_id)
);

create table if not exists public.workitem_app_binding (
    tenant_id   text not null default public.tenant_id(),
    form_id     text not null,              -- formHandler:<formId> 의 formId
    app_id      text not null,
    view_path   text not null,              -- base_url 뒤에 붙는 경로. {task_id} {proc_inst_id} {proc_def_id} {activity_id} {form_id} 치환
    mode        text not null default 'replace',   -- replace: 폼 대신 앱 화면 | beside: 앱 화면 아래에 폼도 보인다
    enabled     boolean not null default true,
    created_at  timestamptz not null default now(),
    primary key (tenant_id, form_id),
    foreign key (tenant_id, app_id) references public.workitem_app (tenant_id, app_id) on delete cascade
);

alter table public.workitem_app enable row level security;
alter table public.workitem_app_binding enable row level security;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workitem_app','workitem_app_binding'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select_policy ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.tenant_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_write_policy ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_write_policy ON public.%I FOR ALL TO authenticated USING (tenant_id = public.tenant_id()) WITH CHECK (tenant_id = public.tenant_id())', t, t);
  END LOOP;
END $$;
