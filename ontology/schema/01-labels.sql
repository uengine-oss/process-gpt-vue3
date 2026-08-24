-- =============================================================================
-- Process GPT 그래프 온톨로지 — 01. 라벨 정의
-- 노드 29종 + 엣지 47종 (+ Governance 레이어 3/10종은 **보류** — 파일 말미 주석).
-- 계약(속성·키·카디널리티)은 ontology/SCHEMA.md 가 정본.
-- AGE 특성: 라벨은 스키마를 강제하지 않는다(속성·endpoint 자유).
--           따라서 이 파일은 "라벨 존재"만 보장하고, 키는 02-indexes.sql 의
--           유니크 인덱스가, 계약 준수는 동기화 코드와 검증 질의가 담당한다.
-- =============================================================================

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- -----------------------------------------------------------------------------
-- 1) 노드(Vertex) 라벨
-- -----------------------------------------------------------------------------

-- Strategy 레이어 (북극성)
SELECT public.graph_ensure_vlabel('Perspective');        -- BSC 관점 (financial/customer/internal_process/learning_growth)
SELECT public.graph_ensure_vlabel('Objective');          -- 전략목표 (strategy-service)
SELECT public.graph_ensure_vlabel('KPI');                -- 핵심성과지표 (정량+정성 이중 평가)
SELECT public.graph_ensure_vlabel('Initiative');         -- 실행과제

-- Definition 레이어
SELECT public.graph_ensure_vlabel('Tenant');
SELECT public.graph_ensure_vlabel('MegaProcess');        -- configuration('proc_map')
SELECT public.graph_ensure_vlabel('MajorProcess');
SELECT public.graph_ensure_vlabel('ProcessDefinition');  -- proc_def
SELECT public.graph_ensure_vlabel('ProcessVersion');     -- proc_def_version
SELECT public.graph_ensure_vlabel('Activity');           -- definition.activities[]/subProcesses[] (type 속성으로 세분)
SELECT public.graph_ensure_vlabel('Event');              -- definition.events[]
SELECT public.graph_ensure_vlabel('Gateway');            -- definition.gateways[]
SELECT public.graph_ensure_vlabel('Role');               -- definition.roles[] (레인)
SELECT public.graph_ensure_vlabel('Variable');           -- definition.data[]
SELECT public.graph_ensure_vlabel('Form');               -- form_def
SELECT public.graph_ensure_vlabel('FormField');          -- form_def.fields_json[]

-- Organization 레이어
SELECT public.graph_ensure_vlabel('User');               -- users (is_agent=false)
SELECT public.graph_ensure_vlabel('Agent');              -- users (is_agent=true)
SELECT public.graph_ensure_vlabel('Team');               -- 조직도 JSON(isTeam) / departments
SELECT public.graph_ensure_vlabel('OrgGroup');           -- org_chart_groups

-- Execution 레이어
SELECT public.graph_ensure_vlabel('ProcessInstance');    -- bpm_proc_inst
SELECT public.graph_ensure_vlabel('WorkItem');           -- todolist
SELECT public.graph_ensure_vlabel('Delegation');         -- delegation_history (reified)
SELECT public.graph_ensure_vlabel('Project');            -- project
SELECT public.graph_ensure_vlabel('ChatRoom');           -- chat_rooms
SELECT public.graph_ensure_vlabel('Topic');              -- instance-classifier

-- Knowledge 레이어
SELECT public.graph_ensure_vlabel('Skill');              -- tenant_skills + SKILL.md
SELECT public.graph_ensure_vlabel('KnowledgeDoc');       -- knowledge_files

-- 운영 메타
SELECT public.graph_ensure_vlabel('GraphMeta');          -- 스키마 버전 노드 (id='meta')

-- -----------------------------------------------------------------------------
-- 2) 엣지(Edge) 라벨   ※ 엣지 라벨은 그래프 전역 — endpoint 조합은 SCHEMA.md 참조
-- -----------------------------------------------------------------------------

-- Strategy (북극성 계보)
SELECT public.graph_ensure_elabel('IN_PERSPECTIVE');     -- Objective → Perspective
SELECT public.graph_ensure_elabel('CONTRIBUTES_TO');     -- Objective → Objective (스트레티지 맵 인과관계)
SELECT public.graph_ensure_elabel('MEASURES');           -- KPI → Objective
SELECT public.graph_ensure_elabel('DRIVES');             -- Initiative → Objective
SELECT public.graph_ensure_elabel('SOURCED_FROM');       -- KPI → ProcessDefinition {measure_type}
SELECT public.graph_ensure_elabel('REALIZED_BY');        -- Initiative → ProcessDefinition
SELECT public.graph_ensure_elabel('OWNED_BY');           -- Initiative → User
SELECT public.graph_ensure_elabel('SURVEYED');           -- ProcessInstance → KPI {request_id, status, avg_rating}

-- Definition 구조
SELECT public.graph_ensure_elabel('OWNS');               -- Tenant → ProcessDefinition
SELECT public.graph_ensure_elabel('CONTAINS');           -- Mega→Major→Definition / Activity(subProcess)→하위요소
SELECT public.graph_ensure_elabel('HAS_VERSION');        -- ProcessDefinition → ProcessVersion
SELECT public.graph_ensure_elabel('PRODUCTION');         -- ProcessDefinition → ProcessVersion (prod_version)
SELECT public.graph_ensure_elabel('DERIVED_FROM');       -- ProcessVersion → ProcessVersion (parent_version)
SELECT public.graph_ensure_elabel('DEFINES');            -- ProcessDefinition → Activity|Event|Gateway|Role|Variable
SELECT public.graph_ensure_elabel('FLOWS_TO');           -- 요소 → 요소 {seq_id, name, condition}
SELECT public.graph_ensure_elabel('CALLS');              -- Activity(callActivity) → ProcessDefinition
SELECT public.graph_ensure_elabel('IN_LANE');            -- Activity|Event|Gateway → Role
SELECT public.graph_ensure_elabel('RESOLVES_TO');        -- Role → User|Team|OrgGroup {kind, rule}
SELECT public.graph_ensure_elabel('USES_FORM');          -- Activity → Form (tool=formHandler:*)
SELECT public.graph_ensure_elabel('HAS_FIELD');          -- Form → FormField
SELECT public.graph_ensure_elabel('REFERENCES');         -- Activity → FormField (inputData "formId.fieldId")
SELECT public.graph_ensure_elabel('DECIDES_BY');         -- Gateway → FormField (conditionData)
SELECT public.graph_ensure_elabel('BINDS_TO');           -- FormField → Variable
SELECT public.graph_ensure_elabel('PERFORMED_BY_AGENT'); -- Activity → Agent {mode, orchestration}
SELECT public.graph_ensure_elabel('REQUIRES_SKILL');     -- Activity → Skill
SELECT public.graph_ensure_elabel('INVOLVES');           -- ProcessDefinition → Team (process_organizations)

-- Organization
SELECT public.graph_ensure_elabel('MEMBER_OF');          -- User|Agent → Team {position}
SELECT public.graph_ensure_elabel('PART_OF');            -- Team → Team
SELECT public.graph_ensure_elabel('INCLUDES');           -- OrgGroup → Team
SELECT public.graph_ensure_elabel('HAS_SKILL');          -- Agent → Skill
SELECT public.graph_ensure_elabel('EXTENDS');            -- Skill → Skill (SKILL.md 상속)

-- Execution
SELECT public.graph_ensure_elabel('INSTANCE_OF');        -- ProcessInstance → ProcessDefinition {version, version_tag}
SELECT public.graph_ensure_elabel('SUB_OF');             -- ProcessInstance → ProcessInstance (parent)
SELECT public.graph_ensure_elabel('IN_INSTANCE');        -- WorkItem → ProcessInstance
SELECT public.graph_ensure_elabel('EXECUTES');           -- WorkItem → Activity
SELECT public.graph_ensure_elabel('ASSIGNED_TO');        -- WorkItem → User|Agent {kind}
SELECT public.graph_ensure_elabel('ROLE_BOUND');         -- ProcessInstance → User {role_name, is_default}
SELECT public.graph_ensure_elabel('DEPENDS_ON');         -- WorkItem → WorkItem {type, lag_time, lead_time}
SELECT public.graph_ensure_elabel('DELEGATION_OF');      -- Delegation → WorkItem
SELECT public.graph_ensure_elabel('DELEGATION_FROM');    -- Delegation → User
SELECT public.graph_ensure_elabel('DELEGATION_TO');      -- Delegation → User
SELECT public.graph_ensure_elabel('CLASSIFIED_AS');      -- ProcessInstance → Topic {similarity}
SELECT public.graph_ensure_elabel('ABOUT');              -- ChatRoom → ProcessInstance
SELECT public.graph_ensure_elabel('PARTICIPATES_IN');    -- User|Agent → ChatRoom
SELECT public.graph_ensure_elabel('IN_PROJECT');         -- ProcessInstance → Project
SELECT public.graph_ensure_elabel('ORIGINATED_FROM');    -- ProcessInstance → KnowledgeDoc (proc_inst_source)
SELECT public.graph_ensure_elabel('TRIGGERED_BY');       -- ProcessVersion → WorkItem (source_todolist_id)

-- =============================================================================
-- [보류] Governance 레이어 (2026-07-10 결정 — Phase 4 활성화 시 주석 해제)
--   노드: Review(proc_def_approval_state), ResourcePR(resource_pull_requests),
--         Terminology(standard_terminology)
--   엣지: REVIEWS, SUBMITTED, HQ_REVIEWED, FIELD_REVIEWED, PUBLISHED, REJECTED,
--         FOLLOWS, TARGETS, REQUESTED, REVIEWS_PR
--   활성화 시 02-indexes.sql 의 보류 키(Review/ResourcePR/Terminology)도 함께 해제.
-- =============================================================================
-- SELECT public.graph_ensure_vlabel('Review');
-- SELECT public.graph_ensure_vlabel('ResourcePR');
-- SELECT public.graph_ensure_vlabel('Terminology');
-- SELECT public.graph_ensure_elabel('REVIEWS');
-- SELECT public.graph_ensure_elabel('SUBMITTED');
-- SELECT public.graph_ensure_elabel('HQ_REVIEWED');
-- SELECT public.graph_ensure_elabel('FIELD_REVIEWED');
-- SELECT public.graph_ensure_elabel('PUBLISHED');
-- SELECT public.graph_ensure_elabel('REJECTED');
-- SELECT public.graph_ensure_elabel('FOLLOWS');
-- SELECT public.graph_ensure_elabel('TARGETS');
-- SELECT public.graph_ensure_elabel('REQUESTED');
-- SELECT public.graph_ensure_elabel('REVIEWS_PR');
