-- ============================================================
-- 목록 관리 (option_list)
--
-- 관리자가 "주제" 단위로 선택지 목록(예: 부서, 시스템 유형)을 만들어 두면
-- 속성 스키마 스튜디오의 select/multiselect 필드가 Options Source = 'list' 로
-- 이 목록을 참조한다 (task_property_schema.select_source_type='list' +
-- config.list = { list_key }).
--
-- 항목을 별도 테이블로 정규화하지 않고 items jsonb 로 둔다:
--   · 항목은 {value, label} 쌍의 순서 있는 배열이고 목록 단위로만 편집된다
--   · 렌더러(SchemaFieldInput)는 목록 한 건을 읽어 통째로 선택지로 쓴다
--   · static options(task_property_schema.options jsonb)와 같은 형태를 유지해
--     기존 값 데이터(저장된 value 문자열)와 완전히 호환된다
--
-- 테넌트 스코프는 task_property_schema / task_systems 와 같은 방식
-- (tenant_id 기본값 public.tenant_id() + 클라이언트 match 필터)을 따른다.
-- idempotent — 재실행 안전.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.option_list (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id text NULL DEFAULT public.tenant_id(),
    -- 참조 키. 스키마 행이 config.list.list_key 로 이 값을 가리키므로 생성 후 변경 불가(UI에서 잠금)
    list_key text NOT NULL,
    -- 주제 (표시 이름)
    name text NOT NULL,
    description text NULL,
    -- [{ "value": "...", "label": "..." }] — 배열 순서 = 표시 순서
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT option_list_pkey PRIMARY KEY (id),
    CONSTRAINT option_list_tenant_id_fkey FOREIGN KEY (tenant_id)
        REFERENCES public.tenants (id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 같은 테넌트 안에서 참조 키 중복 금지
CREATE UNIQUE INDEX IF NOT EXISTS option_list_tenant_key_unique
    ON public.option_list (tenant_id, list_key);

COMMENT ON TABLE public.option_list IS '관리자 정의 선택지 목록(주제별). 속성 스키마 select/multiselect 의 Options Source=list 가 참조';
COMMENT ON COLUMN public.option_list.list_key IS 'task_property_schema.config.list.list_key 가 참조하는 키 — 생성 후 변경 금지';
COMMENT ON COLUMN public.option_list.items IS '[{value, label}] 순서 있는 배열. static options 와 동일 형태';
