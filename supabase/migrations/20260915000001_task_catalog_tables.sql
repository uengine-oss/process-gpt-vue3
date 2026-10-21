-- ============================================================
-- Task Catalog 테이블 (task_systems / task_catalog)
--
-- 두 테이블은 지금까지 라이브 DB에만 존재하고 리포에 DDL이 없었다
-- (docs/specs/graph-ontology-apache-age.md 의 "live DB only" 갭).
-- 새 환경에서 카탈로그 저장 시 "Could not find the table 'public.task_catalog'"
-- 404 가 나는 원인 — 여기서 스키마를 리포로 수렴한다.
--
-- 컬럼은 클라이언트 사용처(ProcessGPTBackend.getTaskCatalogList/saveTaskCatalog,
-- stores/taskCatalog.ts 의 TaskCatalogItem/TaskSystem)와 일치시킨다.
-- properties jsonb 에는 RACI(raci)·절차(procedure)·관련자료(manualLinks)·
-- 사용자 정의 속성 값이 담기고, 순서도 적용 시 요소의 uengine:Properties 로 복사된다.
--
-- 테넌트 스코프·RLS 는 palette_task_types / option_list 와 같은 방식.
-- 쓰기는 editor 이상 — 카탈로그 등록은 관리자 페이지뿐 아니라 프로세스 작성 중
-- 속성패널("카탈로그에 저장")에서도 일어난다.
-- 이미 테이블이 있는 라이브 DB에서도 안전 (idempotent, IF NOT EXISTS).
-- ============================================================

-- ── task_systems: 카탈로그 항목이 참조하는 시스템(OSS) 목록 ──
CREATE TABLE IF NOT EXISTS public.task_systems (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id text NULL DEFAULT public.tenant_id(),
    name text NOT NULL,
    description text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task_systems_pkey PRIMARY KEY (id),
    CONSTRAINT task_systems_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS task_systems_tenant_idx ON public.task_systems (tenant_id);

-- ── task_catalog: 재사용 Task 템플릿 ──
CREATE TABLE IF NOT EXISTS public.task_catalog (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id text NULL DEFAULT public.tenant_id(),
    name text NOT NULL,
    -- 목록 표시·정렬 기준. 저장 시 클라이언트가 name(+ system) 으로 만들어 넣는다
    display_name text NULL,
    -- bpmn:UserTask 등 BPMN 요소 타입 — 순서도 적용 시 요소 타입이 이 값으로 바뀐다
    task_type text NULL,
    description text NULL,
    -- 요소 uengine:Properties 로 복사되는 속성 전체 (raci/procedure/manualLinks/커스텀 키)
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    system_id uuid NULL,
    system_name text NULL,
    -- 구형 카탈로그 구조의 레벨(L2~L5) — 신규 등록 UI 에서는 받지 않지만 기존 데이터 호환 유지
    level text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task_catalog_pkey PRIMARY KEY (id),
    CONSTRAINT task_catalog_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT task_catalog_system_id_fkey FOREIGN KEY (system_id)
        REFERENCES public.task_systems (id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS task_catalog_tenant_idx ON public.task_catalog (tenant_id);
CREATE INDEX IF NOT EXISTS task_catalog_tenant_type_idx ON public.task_catalog (tenant_id, task_type);

-- 라이브 DB에 이미 있던 테이블과의 수렴: 빠졌을 수 있는 컬럼을 보강
ALTER TABLE public.task_systems ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.task_systems ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.task_systems ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS task_type text;
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS properties jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS system_id uuid;
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS system_name text;
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.task_catalog ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── RLS: 조회는 테넌트 구성원, 쓰기는 editor 이상 ──
ALTER TABLE public.task_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_systems_select" ON public.task_systems;
CREATE POLICY "task_systems_select" ON public.task_systems
    FOR SELECT TO authenticated
    USING (tenant_id = public.tenant_id());

DROP POLICY IF EXISTS "task_systems_write_editor" ON public.task_systems;
CREATE POLICY "task_systems_write_editor" ON public.task_systems
    FOR ALL TO authenticated
    USING (tenant_id = public.tenant_id() AND public.has_role_at_least('editor'))
    WITH CHECK (tenant_id = public.tenant_id() AND public.has_role_at_least('editor'));

DROP POLICY IF EXISTS "task_catalog_select" ON public.task_catalog;
CREATE POLICY "task_catalog_select" ON public.task_catalog
    FOR SELECT TO authenticated
    USING (tenant_id = public.tenant_id());

DROP POLICY IF EXISTS "task_catalog_write_editor" ON public.task_catalog;
CREATE POLICY "task_catalog_write_editor" ON public.task_catalog
    FOR ALL TO authenticated
    USING (tenant_id = public.tenant_id() AND public.has_role_at_least('editor'))
    WITH CHECK (tenant_id = public.tenant_id() AND public.has_role_at_least('editor'));

COMMENT ON TABLE public.task_systems IS 'Task Catalog 이 참조하는 시스템(OSS) 목록 (테넌트 스코프)';
COMMENT ON TABLE public.task_catalog IS '재사용 Task 템플릿. properties 가 순서도 요소의 uengine:Properties 로 복사된다';
COMMENT ON COLUMN public.task_catalog.properties IS 'raci / procedure / manualLinks / 사용자 정의 속성 키 등 요소 속성 전체';
COMMENT ON COLUMN public.task_catalog.task_type IS 'bpmn:* 요소 타입 — 카탈로그 적용 시 요소가 이 타입으로 전환';
