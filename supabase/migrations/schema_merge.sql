-- ============================================
-- Part 1: BPMN Model Tables (Phase 1 핵심 테이블)
-- ============================================

-- 1-1. TB_BPMN_MODEL (모델 메타데이터)
CREATE TABLE IF NOT EXISTS public.tb_bpmn_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    proc_def_id TEXT NOT NULL,
    name VARCHAR(500),
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    parent_proc_def_id TEXT,
    domain_id TEXT,
    hierarchy_level VARCHAR(20),  -- mega, major, sub
    process_id VARCHAR(255),
    is_executable BOOLEAN DEFAULT false,
    xml_hash VARCHAR(64),
    node_count INTEGER DEFAULT 0,
    link_count INTEGER DEFAULT 0,
    lane_count INTEGER DEFAULT 0,
    parsed_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT tb_bpmn_model_proc_def_unique UNIQUE (tenant_id, proc_def_id)
);

-- 1-2. TB_BPMN_LANE (Pool/Lane 정보)
CREATE TABLE IF NOT EXISTS public.tb_bpmn_lane (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.tb_bpmn_model(id) ON DELETE CASCADE,
    element_id VARCHAR(255) NOT NULL,
    element_type VARCHAR(100) NOT NULL,
    name VARCHAR(500),
    participant_ref VARCHAR(255),
    parent_lane_id UUID REFERENCES public.tb_bpmn_lane(id) ON DELETE SET NULL,
    is_horizontal BOOLEAN DEFAULT true,
    x NUMERIC,
    y NUMERIC,
    width NUMERIC,
    height NUMERIC,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tb_bpmn_lane_unique UNIQUE (model_id, element_id)
);

-- 1-3. TB_BPMN_NODE (노드 정보)
CREATE TABLE IF NOT EXISTS public.tb_bpmn_node (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.tb_bpmn_model(id) ON DELETE CASCADE,
    element_id VARCHAR(255) NOT NULL,
    element_type VARCHAR(100) NOT NULL,
    name VARCHAR(500),
    x NUMERIC,
    y NUMERIC,
    width NUMERIC,
    height NUMERIC,
    lane_id UUID REFERENCES public.tb_bpmn_lane(id) ON DELETE SET NULL,
    -- Task 속성
    task_type VARCHAR(50),
    assignee TEXT,
    candidate_groups TEXT,
    candidate_users TEXT,
    due_date TEXT,
    -- Gateway 속성
    gateway_direction VARCHAR(20),
    -- Event 속성
    event_type VARCHAR(50),
    event_definition VARCHAR(50),
    -- SubProcess 속성
    is_expanded BOOLEAN DEFAULT true,
    called_element VARCHAR(255),
    -- 공통
    documentation TEXT,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tb_bpmn_node_unique UNIQUE (model_id, element_id)
);

-- 1-4. TB_BPMN_LINK (연결선 정보)
CREATE TABLE IF NOT EXISTS public.tb_bpmn_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.tb_bpmn_model(id) ON DELETE CASCADE,
    element_id VARCHAR(255) NOT NULL,
    element_type VARCHAR(100) NOT NULL,
    name VARCHAR(500),
    source_node_id UUID REFERENCES public.tb_bpmn_node(id) ON DELETE SET NULL,
    target_node_id UUID REFERENCES public.tb_bpmn_node(id) ON DELETE SET NULL,
    source_element_id VARCHAR(255),
    target_element_id VARCHAR(255),
    condition_expression TEXT,
    is_default BOOLEAN DEFAULT false,
    waypoints JSONB,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tb_bpmn_link_unique UNIQUE (model_id, element_id)
);

-- 1-5. TB_BPMN_VERSION (버전 이력)
CREATE TABLE IF NOT EXISTS public.tb_bpmn_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.tb_bpmn_model(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_label VARCHAR(50),
    xml_snapshot TEXT NOT NULL,
    change_log TEXT,
    node_count INTEGER DEFAULT 0,
    link_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tb_bpmn_version_unique UNIQUE (model_id, version_number)
);

-- 1-6. TB_BPMN_MODEL_LOCK (편집 잠금)
CREATE TABLE IF NOT EXISTS public.tb_bpmn_model_lock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.tb_bpmn_model(id) ON DELETE CASCADE,
    locked_by TEXT NOT NULL,
    locked_by_name VARCHAR(255),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT tb_bpmn_model_lock_unique UNIQUE (model_id)
);

-- ============================================
-- Part 2: 댓글 및 승인 워크플로우
-- ============================================

-- 2-1. proc_def_comments (노드 단위 댓글)
CREATE TABLE IF NOT EXISTS proc_def_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proc_def_id TEXT NOT NULL,
    element_id TEXT NOT NULL,
    element_type TEXT,
    element_name TEXT,
    author_id TEXT NOT NULL,
    author_name TEXT,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES proc_def_comments(id) ON DELETE CASCADE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    resolve_action_text TEXT,          -- 조치 내용 (from governance_workflow)
    reviewer_type TEXT                 -- hq/field/public (from governance_workflow)
        CHECK (reviewer_type IS NULL OR reviewer_type IN ('hq', 'field', 'public')),
    tenant_id TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-2. proc_def_approval_state (승인 상태 - 최종 스키마)
--   NOTE: proc_def_id UNIQUE 제약 없음 (per-submission 모델, 프로세스당 여러 리뷰 허용)
CREATE TABLE IF NOT EXISTS proc_def_approval_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proc_def_id TEXT NOT NULL,

    -- 상태: 거버넌스 워크플로우 최종 상태값
    state TEXT NOT NULL DEFAULT 'draft'
        CHECK (state IN (
            'draft',              -- 초안 작성 (v0.x)
            'in_review',          -- 전문가 병렬 검토 (HQ + Field)
            'public_feedback',    -- 전사 30일 공람
            'final_edit',         -- 최종 편집 (공람 후)
            'published',          -- 배포 완료
            'reopen_requested',   -- 현장 개선 요청
            'archived',           -- 아카이빙
            'rejected',           -- 반려
            'cancelled'           -- 취소
        )),

    -- 버전 정보
    version TEXT,                          -- per-submission 버전 텍스트
    major_version INTEGER DEFAULT 0,
    minor_version INTEGER DEFAULT 1,
    version_label TEXT,                    -- e.g. "v1.2"

    -- 제출 정보
    submitted_by TEXT,
    submitted_at TIMESTAMPTZ,
    submit_comment TEXT,

    -- 1차 승인 (레거시, 하위호환)
    reviewer_level1_id TEXT,
    reviewer_level1_name TEXT,
    reviewed_at_level1 TIMESTAMPTZ,
    review_comment_level1 TEXT,

    -- 2차 승인 (레거시, 하위호환)
    reviewer_level2_id TEXT,
    reviewer_level2_name TEXT,
    reviewed_at_level2 TIMESTAMPTZ,
    review_comment_level2 TEXT,

    -- 병렬 승인: HQ(본사)
    hq_reviewer_id TEXT,
    hq_reviewer_name TEXT,
    hq_reviewed_at TIMESTAMPTZ,
    hq_review_comment TEXT,
    hq_status TEXT DEFAULT 'pending'
        CHECK (hq_status IS NULL OR hq_status IN ('pending', 'approved', 'rejected')),

    -- 병렬 승인: Field(현업)
    field_reviewer_id TEXT,
    field_reviewer_name TEXT,
    field_reviewed_at TIMESTAMPTZ,
    field_review_comment TEXT,
    field_status TEXT DEFAULT 'pending'
        CHECK (field_status IS NULL OR field_status IN ('pending', 'approved', 'rejected')),

    -- 공람(Public Feedback) 기간
    public_feedback_started_at TIMESTAMPTZ,
    public_feedback_ends_at TIMESTAMPTZ,
    public_feedback_auto_transitioned BOOLEAN DEFAULT FALSE,

    -- 최종 확정 (레거시 confirmed)
    confirmed_by_id TEXT,
    confirmed_by_name TEXT,
    confirmed_at TIMESTAMPTZ,
    confirm_comment TEXT,

    -- 최종 배포 (published)
    published_by_id TEXT,
    published_by_name TEXT,
    published_at TIMESTAMPTZ,
    publish_comment TEXT,

    -- 반려 정보
    rejected_by_id TEXT,
    rejected_by_name TEXT,
    rejected_at TIMESTAMPTZ,
    reject_comment TEXT,

    -- Re-open 요청
    reopen_requested_by TEXT,
    reopen_requested_at TIMESTAMPTZ,
    reopen_reason TEXT,
    reopen_approved_by TEXT,
    reopen_approved_at TIMESTAMPTZ,
    root_cause_review_id UUID,

    -- 담당자 지정
    assigned_reviewer_id TEXT,
    assigned_reviewer_name TEXT,

    tenant_id TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-3. proc_def_approval_history (승인 이력)
CREATE TABLE IF NOT EXISTS proc_def_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proc_def_id TEXT NOT NULL,
    review_id UUID REFERENCES proc_def_approval_state(id),  -- per-submission 연결
    action TEXT NOT NULL,
    -- action 값들:
    --   submit, approve_hq, approve_field, reject_hq, reject_field,
    --   approve_level1, approve_level2, confirm, reject, reopen,
    --   start_public_feedback, auto_transition_final_edit,
    --   publish, request_reopen, approve_reopen, reject_reopen,
    --   reset_approvals, comment, reassign, cancel, archive
    from_state TEXT,
    to_state TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    comment TEXT,
    tenant_id TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2-4. proc_def_snapshots (단계별 BPMN 상태 보존)
CREATE TABLE IF NOT EXISTS proc_def_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES proc_def_approval_state(id) ON DELETE CASCADE,
    proc_def_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    major_version INTEGER,
    minor_version INTEGER,
    bpmn_xml TEXT,
    bpmn_json JSONB,
    metadata JSONB DEFAULT '{}',
    tenant_id TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Part 3: 표준 용어 사전
-- ============================================

CREATE TABLE IF NOT EXISTS standard_terminology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    category TEXT NOT NULL,  -- task_name, lane_name, gateway_name, event_name, condition
    term TEXT NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, category, term)
);

-- ============================================
-- Part 4: Property Schema 확장
-- ============================================

ALTER TABLE IF EXISTS public.task_property_schema
    ADD COLUMN IF NOT EXISTS applies_to VARCHAR(20) DEFAULT 'both',
    ADD COLUMN IF NOT EXISTS placeholder TEXT,
    ADD COLUMN IF NOT EXISTS visible_by_default BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS config JSONB;

COMMENT ON COLUMN public.task_property_schema.property_type IS 'string | number | boolean | select | textarea | url | db-select | formula';
COMMENT ON COLUMN public.task_property_schema.applies_to IS 'both | process | task';
COMMENT ON COLUMN public.task_property_schema.config IS 'DB-Select: {"table":"...","label_col":"...","value_col":"..."}, Formula: {"expression":"SUM(tasks.fte)"}';

-- ============================================
-- Part 5: KPI 목표 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS kpi_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    period_type TEXT NOT NULL DEFAULT 'quarterly'
        CHECK (period_type IN ('monthly','quarterly','yearly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_target INTEGER NOT NULL DEFAULT 0,
    domain_targets JSONB DEFAULT '[]',
    org_targets JSONB DEFAULT '[]',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, period_type, period_start)
);

-- ============================================
-- Part 6: Indexes
-- ============================================

-- TB_BPMN_MODEL
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_model_tenant ON public.tb_bpmn_model(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_model_proc_def ON public.tb_bpmn_model(proc_def_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_model_status ON public.tb_bpmn_model(status);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_model_parent ON public.tb_bpmn_model(parent_proc_def_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_model_domain ON public.tb_bpmn_model(domain_id);

-- TB_BPMN_LANE
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_lane_model ON public.tb_bpmn_lane(model_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_lane_type ON public.tb_bpmn_lane(element_type);

-- TB_BPMN_NODE
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_node_model ON public.tb_bpmn_node(model_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_node_type ON public.tb_bpmn_node(element_type);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_node_lane ON public.tb_bpmn_node(lane_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_node_task_type ON public.tb_bpmn_node(task_type);

-- TB_BPMN_LINK
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_link_model ON public.tb_bpmn_link(model_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_link_source ON public.tb_bpmn_link(source_node_id);
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_link_target ON public.tb_bpmn_link(target_node_id);

-- TB_BPMN_VERSION
CREATE INDEX IF NOT EXISTS idx_tb_bpmn_version_model ON public.tb_bpmn_version(model_id);

-- proc_def_comments
CREATE INDEX IF NOT EXISTS idx_proc_def_comments_def_element ON proc_def_comments(proc_def_id, element_id);
CREATE INDEX IF NOT EXISTS idx_proc_def_comments_parent ON proc_def_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_proc_def_comments_tenant ON proc_def_comments(tenant_id);

-- proc_def_approval_state
CREATE INDEX IF NOT EXISTS idx_proc_def_approval_state_def ON proc_def_approval_state(proc_def_id);
CREATE INDEX IF NOT EXISTS idx_proc_def_approval_state_status ON proc_def_approval_state(state);
CREATE INDEX IF NOT EXISTS idx_proc_def_approval_state_tenant ON proc_def_approval_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_state_hq_status ON proc_def_approval_state(hq_status);
CREATE INDEX IF NOT EXISTS idx_approval_state_field_status ON proc_def_approval_state(field_status);
CREATE INDEX IF NOT EXISTS idx_approval_state_feedback_end ON proc_def_approval_state(public_feedback_ends_at)
    WHERE state = 'public_feedback';
CREATE INDEX IF NOT EXISTS idx_approval_state_major_version ON proc_def_approval_state(proc_def_id, major_version);

-- proc_def_approval_history
CREATE INDEX IF NOT EXISTS idx_proc_def_approval_history_def ON proc_def_approval_history(proc_def_id);
CREATE INDEX IF NOT EXISTS idx_proc_def_approval_history_tenant ON proc_def_approval_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_def_approval_history_review ON proc_def_approval_history(review_id);

-- proc_def_snapshots
CREATE INDEX IF NOT EXISTS idx_proc_def_snapshots_review ON proc_def_snapshots(review_id);
CREATE INDEX IF NOT EXISTS idx_proc_def_snapshots_proc ON proc_def_snapshots(proc_def_id);
CREATE INDEX IF NOT EXISTS idx_proc_def_snapshots_tenant ON proc_def_snapshots(tenant_id);

-- standard_terminology
CREATE INDEX IF NOT EXISTS idx_terminology_tenant_category ON standard_terminology(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_terminology_usage ON standard_terminology(tenant_id, category, usage_count DESC);

-- kpi_targets
CREATE INDEX IF NOT EXISTS idx_kpi_targets_tenant ON kpi_targets(tenant_id);

-- ============================================
-- Part 7: Row Level Security (RLS)
-- ============================================

-- BPMN 테이블
ALTER TABLE public.tb_bpmn_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_bpmn_lane ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_bpmn_node ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_bpmn_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_bpmn_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_bpmn_model_lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tb_bpmn_model_select_policy" ON public.tb_bpmn_model FOR SELECT USING (true);
CREATE POLICY "tb_bpmn_model_insert_policy" ON public.tb_bpmn_model FOR INSERT WITH CHECK (true);
CREATE POLICY "tb_bpmn_model_update_policy" ON public.tb_bpmn_model FOR UPDATE USING (true);
CREATE POLICY "tb_bpmn_model_delete_policy" ON public.tb_bpmn_model FOR DELETE USING (true);

CREATE POLICY "tb_bpmn_lane_select_policy" ON public.tb_bpmn_lane FOR SELECT USING (true);
CREATE POLICY "tb_bpmn_lane_insert_policy" ON public.tb_bpmn_lane FOR INSERT WITH CHECK (true);
CREATE POLICY "tb_bpmn_lane_update_policy" ON public.tb_bpmn_lane FOR UPDATE USING (true);
CREATE POLICY "tb_bpmn_lane_delete_policy" ON public.tb_bpmn_lane FOR DELETE USING (true);

CREATE POLICY "tb_bpmn_node_select_policy" ON public.tb_bpmn_node FOR SELECT USING (true);
CREATE POLICY "tb_bpmn_node_insert_policy" ON public.tb_bpmn_node FOR INSERT WITH CHECK (true);
CREATE POLICY "tb_bpmn_node_update_policy" ON public.tb_bpmn_node FOR UPDATE USING (true);
CREATE POLICY "tb_bpmn_node_delete_policy" ON public.tb_bpmn_node FOR DELETE USING (true);

CREATE POLICY "tb_bpmn_link_select_policy" ON public.tb_bpmn_link FOR SELECT USING (true);
CREATE POLICY "tb_bpmn_link_insert_policy" ON public.tb_bpmn_link FOR INSERT WITH CHECK (true);
CREATE POLICY "tb_bpmn_link_update_policy" ON public.tb_bpmn_link FOR UPDATE USING (true);
CREATE POLICY "tb_bpmn_link_delete_policy" ON public.tb_bpmn_link FOR DELETE USING (true);

CREATE POLICY "tb_bpmn_version_select_policy" ON public.tb_bpmn_version FOR SELECT USING (true);
CREATE POLICY "tb_bpmn_version_insert_policy" ON public.tb_bpmn_version FOR INSERT WITH CHECK (true);
CREATE POLICY "tb_bpmn_version_update_policy" ON public.tb_bpmn_version FOR UPDATE USING (true);
CREATE POLICY "tb_bpmn_version_delete_policy" ON public.tb_bpmn_version FOR DELETE USING (true);

CREATE POLICY "tb_bpmn_model_lock_select_policy" ON public.tb_bpmn_model_lock FOR SELECT USING (true);
CREATE POLICY "tb_bpmn_model_lock_insert_policy" ON public.tb_bpmn_model_lock FOR INSERT WITH CHECK (true);
CREATE POLICY "tb_bpmn_model_lock_update_policy" ON public.tb_bpmn_model_lock FOR UPDATE USING (true);
CREATE POLICY "tb_bpmn_model_lock_delete_policy" ON public.tb_bpmn_model_lock FOR DELETE USING (true);

-- 댓글/승인 테이블
ALTER TABLE proc_def_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proc_def_comments_select_policy" ON proc_def_comments FOR SELECT USING (true);
CREATE POLICY "proc_def_comments_insert_policy" ON proc_def_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "proc_def_comments_update_policy" ON proc_def_comments FOR UPDATE USING (true);
CREATE POLICY "proc_def_comments_delete_policy" ON proc_def_comments FOR DELETE USING (true);

ALTER TABLE proc_def_approval_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proc_def_approval_state_select_policy" ON proc_def_approval_state FOR SELECT USING (true);
CREATE POLICY "proc_def_approval_state_insert_policy" ON proc_def_approval_state FOR INSERT WITH CHECK (true);
CREATE POLICY "proc_def_approval_state_update_policy" ON proc_def_approval_state FOR UPDATE USING (true);

ALTER TABLE proc_def_approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proc_def_approval_history_select_policy" ON proc_def_approval_history FOR SELECT USING (true);
CREATE POLICY "proc_def_approval_history_insert_policy" ON proc_def_approval_history FOR INSERT WITH CHECK (true);

ALTER TABLE proc_def_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proc_def_snapshots_select" ON proc_def_snapshots FOR SELECT USING (true);
CREATE POLICY "proc_def_snapshots_insert" ON proc_def_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "proc_def_snapshots_delete" ON proc_def_snapshots FOR DELETE USING (true);

ALTER TABLE standard_terminology ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON standard_terminology
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::text OR tenant_id = 'default');

ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_targets_all" ON kpi_targets FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Part 8: Triggers
-- ============================================

-- tb_bpmn_model updated_at
CREATE OR REPLACE FUNCTION update_tb_bpmn_model_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tb_bpmn_model_updated_at
    BEFORE UPDATE ON public.tb_bpmn_model
    FOR EACH ROW
    EXECUTE FUNCTION update_tb_bpmn_model_updated_at();

-- proc_def_comments updated_at
CREATE OR REPLACE FUNCTION update_proc_def_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proc_def_comments_updated_at_trigger
    BEFORE UPDATE ON proc_def_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_proc_def_comments_updated_at();

-- proc_def_approval_state updated_at
CREATE OR REPLACE FUNCTION update_proc_def_approval_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proc_def_approval_state_updated_at_trigger
    BEFORE UPDATE ON proc_def_approval_state
    FOR EACH ROW
    EXECUTE FUNCTION update_proc_def_approval_state_updated_at();

-- ============================================
-- Part 9: Helper Functions
-- ============================================

-- 모델 다음 버전 번호
CREATE OR REPLACE FUNCTION get_next_version_number(p_model_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_max_version
    FROM public.tb_bpmn_version
    WHERE model_id = p_model_id;
    RETURN v_max_version;
END;
$$ LANGUAGE plpgsql;

-- 모델 통계 업데이트
CREATE OR REPLACE FUNCTION update_model_counts(p_model_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.tb_bpmn_model
    SET
        node_count = (SELECT COUNT(*) FROM public.tb_bpmn_node WHERE model_id = p_model_id),
        link_count = (SELECT COUNT(*) FROM public.tb_bpmn_link WHERE model_id = p_model_id),
        lane_count = (SELECT COUNT(*) FROM public.tb_bpmn_lane WHERE model_id = p_model_id),
        parsed_at = NOW()
    WHERE id = p_model_id;
END;
$$ LANGUAGE plpgsql;

-- 만료된 잠금 자동 해제
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.tb_bpmn_model_lock
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 용어 사용 빈도 증가
CREATE OR REPLACE FUNCTION increment_terminology_usage(
    p_tenant_id TEXT,
    p_category TEXT,
    p_term TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE standard_terminology
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND category = p_category
      AND term = p_term;

    IF NOT FOUND THEN
        INSERT INTO standard_terminology (tenant_id, category, term, usage_count)
        VALUES (p_tenant_id, p_category, p_term, 1)
        ON CONFLICT (tenant_id, category, term) DO UPDATE
        SET usage_count = standard_terminology.usage_count + 1,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 공람 30일 자동 전환 (Cron/Edge Function에서 호출)
CREATE OR REPLACE FUNCTION auto_transition_public_feedback()
RETURNS INTEGER AS $$
DECLARE
    transitioned_count INTEGER := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT id, proc_def_id, tenant_id
        FROM proc_def_approval_state
        WHERE state = 'public_feedback'
          AND public_feedback_ends_at IS NOT NULL
          AND public_feedback_ends_at <= NOW()
          AND public_feedback_auto_transitioned = FALSE
    LOOP
        UPDATE proc_def_approval_state
        SET state = 'final_edit',
            public_feedback_auto_transitioned = TRUE,
            updated_at = NOW()
        WHERE id = rec.id;

        INSERT INTO proc_def_approval_history
            (proc_def_id, review_id, action, from_state, to_state, actor_id, actor_name, comment, tenant_id)
        VALUES
            (rec.proc_def_id, rec.id, 'auto_transition_final_edit', 'public_feedback', 'final_edit',
             'system', 'System', '30일 공람 기간 만료로 자동 전환', rec.tenant_id);

        transitioned_count := transitioned_count + 1;
    END LOOP;
    RETURN transitioned_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Part 10: Views (최종 버전)
-- ============================================

-- 댓글 개수 집계 뷰
CREATE OR REPLACE VIEW proc_def_element_comment_counts AS
SELECT
    proc_def_id,
    element_id,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE NOT is_resolved) as unresolved_count,
    COUNT(*) FILTER (WHERE is_resolved) as resolved_count
FROM proc_def_comments
WHERE parent_comment_id IS NULL
GROUP BY proc_def_id, element_id;

-- 리뷰 보드 뷰 (병렬 승인 + 공람 + 버전 + 담당자)
CREATE OR REPLACE VIEW v_review_board AS
SELECT
    pas.id AS review_id,
    pas.proc_def_id,
    pd.name AS process_name,
    pd.owner,
    pas.state,
    pas.version,
    pas.version_label,
    pas.major_version,
    pas.minor_version,
    -- 제출 정보
    pas.submitted_by,
    pas.submitted_at,
    -- 병렬 승인 (HQ)
    pas.hq_reviewer_id, pas.hq_reviewer_name, pas.hq_reviewed_at, pas.hq_status,
    -- 병렬 승인 (Field)
    pas.field_reviewer_id, pas.field_reviewer_name, pas.field_reviewed_at, pas.field_status,
    -- 공람 기간
    pas.public_feedback_started_at, pas.public_feedback_ends_at,
    CASE
        WHEN pas.state = 'public_feedback' AND pas.public_feedback_ends_at IS NOT NULL
        THEN EXTRACT(DAY FROM pas.public_feedback_ends_at - NOW())::INTEGER
        ELSE NULL
    END AS public_feedback_days_remaining,
    -- 배포 정보
    pas.published_by_name, pas.published_at,
    -- 반려 정보
    pas.rejected_by_name, pas.rejected_at, pas.reject_comment,
    -- Re-open 정보
    pas.reopen_requested_by, pas.reopen_requested_at, pas.reopen_reason,
    -- 담당자
    pas.assigned_reviewer_id, pas.assigned_reviewer_name,
    -- 도메인
    m.domain_id,
    -- 코멘트 집계
    COALESCE(cc.total_comment_count, 0) AS comment_count,
    COALESCE(cc.unresolved_comment_count, 0) AS unresolved_comment_count,
    -- 정체 일수
    EXTRACT(DAY FROM NOW() - pas.updated_at)::INTEGER AS days_since_update,
    -- 테넌트
    pas.tenant_id,
    pas.created_at,
    pas.updated_at
FROM proc_def_approval_state pas
JOIN proc_def pd ON pas.proc_def_id = pd.id AND pas.tenant_id = pd.tenant_id
LEFT JOIN tb_bpmn_model m ON pas.proc_def_id = m.proc_def_id AND pas.tenant_id = m.tenant_id
LEFT JOIN (
    SELECT
        proc_def_id, tenant_id,
        COUNT(*) AS total_comment_count,
        COUNT(*) FILTER (WHERE NOT is_resolved) AS unresolved_comment_count
    FROM proc_def_comments
    WHERE parent_comment_id IS NULL
    GROUP BY proc_def_id, tenant_id
) cc ON pas.proc_def_id = cc.proc_def_id AND pas.tenant_id = cc.tenant_id
WHERE pd.isdeleted = false;

-- KPI 파이프라인 집계 (프로세스당 최신 리뷰만)
CREATE OR REPLACE VIEW v_kpi_pipeline_summary AS
SELECT tenant_id,
    COUNT(*) AS total_processes,
    COUNT(CASE WHEN state = 'draft' THEN 1 END) AS draft_count,
    COUNT(CASE WHEN state = 'in_review' THEN 1 END) AS in_review_count,
    COUNT(CASE WHEN state = 'public_feedback' THEN 1 END) AS public_feedback_count,
    COUNT(CASE WHEN state = 'final_edit' THEN 1 END) AS final_edit_count,
    COUNT(CASE WHEN state = 'published' THEN 1 END) AS published_count,
    COUNT(CASE WHEN state = 'reopen_requested' THEN 1 END) AS reopen_requested_count,
    COUNT(CASE WHEN state = 'rejected' THEN 1 END) AS rejected_count,
    COUNT(CASE WHEN state = 'archived' THEN 1 END) AS archived_count
FROM (
    SELECT DISTINCT ON (proc_def_id, tenant_id) proc_def_id, tenant_id, state
    FROM proc_def_approval_state
    ORDER BY proc_def_id, tenant_id, created_at DESC
) latest_reviews
GROUP BY tenant_id;

-- 도메인별 진행 현황
CREATE OR REPLACE VIEW v_kpi_domain_progress AS
SELECT m.domain_id, m.tenant_id,
    COUNT(*) AS total_processes,
    COUNT(CASE WHEN lr.state = 'published' THEN 1 END) AS published_count,
    COUNT(CASE WHEN lr.state = 'draft' THEN 1 END) AS draft_count,
    COUNT(CASE WHEN lr.state = 'in_review' THEN 1 END) AS in_review_count,
    COUNT(CASE WHEN lr.state = 'public_feedback' THEN 1 END) AS public_feedback_count,
    COUNT(CASE WHEN lr.state = 'final_edit' THEN 1 END) AS final_edit_count
FROM tb_bpmn_model m
LEFT JOIN (
    SELECT DISTINCT ON (proc_def_id, tenant_id) proc_def_id, tenant_id, state
    FROM proc_def_approval_state
    ORDER BY proc_def_id, tenant_id, created_at DESC
) lr ON m.proc_def_id = lr.proc_def_id AND m.tenant_id = lr.tenant_id
WHERE m.deleted_at IS NULL
GROUP BY m.domain_id, m.tenant_id;

-- 주간 배포 속도
CREATE OR REPLACE VIEW v_weekly_deployment_velocity AS
SELECT h.tenant_id,
    DATE_TRUNC('week', h.created_at) AS week_start,
    COUNT(*) AS deployments
FROM proc_def_approval_history h
WHERE h.action = 'publish' AND h.to_state = 'published'
GROUP BY h.tenant_id, DATE_TRUNC('week', h.created_at)
ORDER BY week_start DESC;

-- ============================================
-- Part 11: GRANT & Realtime
-- ============================================

GRANT ALL ON kpi_targets TO authenticated;
GRANT ALL ON proc_def_snapshots TO authenticated;
GRANT SELECT ON v_review_board TO authenticated;
GRANT SELECT ON v_kpi_pipeline_summary TO authenticated;
GRANT SELECT ON v_kpi_domain_progress TO authenticated;
GRANT SELECT ON v_weekly_deployment_velocity TO authenticated;

-- Realtime 지원
ALTER TABLE proc_def_approval_state REPLICA IDENTITY FULL;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE proc_def_approval_state;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- Part 12: 초기 데이터 (표준 용어)
-- ============================================

INSERT INTO standard_terminology (tenant_id, category, term, description, usage_count)
VALUES
    -- Task 이름 용어
    ('default', 'task_name', '검토', 'Review task', 100),
    ('default', 'task_name', '승인', 'Approval task', 100),
    ('default', 'task_name', '결재', 'Approval/Sign-off task', 100),
    ('default', 'task_name', '작성', 'Create/Write task', 100),
    ('default', 'task_name', '등록', 'Register task', 100),
    ('default', 'task_name', '수정', 'Modify/Edit task', 100),
    ('default', 'task_name', '삭제', 'Delete task', 100),
    ('default', 'task_name', '조회', 'Query/View task', 100),
    ('default', 'task_name', '전송', 'Send/Transfer task', 100),
    ('default', 'task_name', '접수', 'Receive/Accept task', 100),
    ('default', 'task_name', '처리', 'Process/Handle task', 100),
    ('default', 'task_name', '확인', 'Confirm/Check task', 100),
    ('default', 'task_name', '요청', 'Request task', 100),
    ('default', 'task_name', '완료', 'Complete task', 100),
    ('default', 'task_name', '반려', 'Reject task', 100),
    -- Lane 이름 용어
    ('default', 'lane_name', '담당자', 'Person in charge', 100),
    ('default', 'lane_name', '팀장', 'Team leader', 100),
    ('default', 'lane_name', '부장', 'Department head', 100),
    ('default', 'lane_name', '기획팀', 'Planning team', 100),
    ('default', 'lane_name', '개발팀', 'Development team', 100),
    ('default', 'lane_name', '영업팀', 'Sales team', 100),
    ('default', 'lane_name', '인사팀', 'HR team', 100),
    ('default', 'lane_name', '재무팀', 'Finance team', 100),
    ('default', 'lane_name', '고객', 'Customer', 100),
    ('default', 'lane_name', '시스템', 'System', 100),
    -- 조건 표현식 용어
    ('default', 'condition', '승인', 'Approved condition', 100),
    ('default', 'condition', '반려', 'Rejected condition', 100),
    ('default', 'condition', '보류', 'Pending condition', 100),
    ('default', 'condition', '완료', 'Completed condition', 100),
    ('default', 'condition', '취소', 'Cancelled condition', 100)
ON CONFLICT (tenant_id, category, term) DO NOTHING;
