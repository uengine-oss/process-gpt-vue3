-- ============================================================
-- 용어 정의 사전 (glossary_terms)
--
-- 프로세스별로 사용하는 용어(용어 | 정의)를 정리한다 — 프로세스 규정서의
-- "용어 정의" 표(예: P5.4.3 내부심사 프로세스 p.7)를 시스템화한 것.
-- 행 단위 = (프로세스, 용어) 1건. 같은 용어가 여러 프로세스에서 정의될 수
-- 있으며, 통합 용어 사전 페이지가 term 으로 묶어 "어떤 프로세스에서 어떻게
-- 쓰이는지"를 보여주고, 속성패널의 용어 등록 시 기존 용어 재사용(자동완성)에
-- 쓰인다.
--
-- proc_def_name 은 표시용 비정규화 — 해당 프로세스의 용어를 저장할 때마다
-- 최신 프로세스명으로 함께 갱신된다.
-- 테넌트 스코프·RLS 는 task_catalog 와 같은 방식 (조회 테넌트, 쓰기 editor+).
-- idempotent — 재실행 안전.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.glossary_terms (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id text NULL DEFAULT public.tenant_id(),
    -- 프로세스 정의 식별자 (proc_def id/path — 프로세스 체계도의 definitionPath)
    proc_def_id text NOT NULL,
    proc_def_name text NULL,
    term text NOT NULL,
    definition text NULL,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT glossary_terms_pkey PRIMARY KEY (id),
    CONSTRAINT glossary_terms_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 같은 프로세스 안에서 용어 중복 금지
CREATE UNIQUE INDEX IF NOT EXISTS glossary_terms_tenant_proc_term_unique
    ON public.glossary_terms (tenant_id, proc_def_id, term);

CREATE INDEX IF NOT EXISTS glossary_terms_tenant_idx ON public.glossary_terms (tenant_id);
CREATE INDEX IF NOT EXISTS glossary_terms_tenant_term_idx ON public.glossary_terms (tenant_id, term);

ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "glossary_terms_select" ON public.glossary_terms;
CREATE POLICY "glossary_terms_select" ON public.glossary_terms
    FOR SELECT TO authenticated
    USING (tenant_id = public.tenant_id());

DROP POLICY IF EXISTS "glossary_terms_write_editor" ON public.glossary_terms;
CREATE POLICY "glossary_terms_write_editor" ON public.glossary_terms
    FOR ALL TO authenticated
    USING (tenant_id = public.tenant_id() AND public.has_role_at_least('editor'))
    WITH CHECK (tenant_id = public.tenant_id() AND public.has_role_at_least('editor'));

COMMENT ON TABLE public.glossary_terms IS '프로세스별 용어 정의 사전 — 통합 용어 사전·용어 재사용의 데이터 소스';
COMMENT ON COLUMN public.glossary_terms.proc_def_id IS '프로세스 정의 식별자 (definitionPath)';
COMMENT ON COLUMN public.glossary_terms.proc_def_name IS '표시용 프로세스명 (저장 시 최신값으로 갱신되는 비정규화 컬럼)';
