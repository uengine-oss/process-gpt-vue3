/**
 * To-Be Blueprint Studio — shared data model, catalogs, and helpers.
 *
 * All To-Be data lives inside `proc_def.definition.tobe` (JSON), persisted via
 * `backend.updateProcessDefinitionMetadata(defId, { definition }, label)` — the
 * same mechanism the existing `definition.tobe_bpmn` field already uses.
 *
 * ROI convention: `expected_impact` deltas are SIGNED. Savings/reductions are
 * NEGATIVE (cost_delta < 0 = 비용 절감, fte_delta < 0 = 인력 절감). The ROI panel
 * sums deltas over *selected* solutions and renders savings as positive numbers.
 */

import { normalizeExecutableData, hasBpmnActivities, type ExecutableData } from './executableModel';

export const TOBE_SCHEMA_VERSION = 1;

/** 기본 연간 인건비 단가 (1 FTE 당, KRW) — ROI에서 FTE → 비용 환산 시 사용. 사용자가 수정 가능. */
export const DEFAULT_ANNUAL_COST_PER_FTE = 80_000_000;
export const DEFAULT_CURRENCY = 'KRW';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SolutionType =
    | 'API_INTEGRATION'
    | 'RPA'
    | 'PROCESS_REDESIGN'
    | 'MANUAL_AUTOMATION'
    | 'SYSTEM_ENHANCEMENT'
    | 'OUTSOURCING'
    | 'OTHER';

export type EffortLevel = 'low' | 'medium' | 'high';
export type Confidence = 'low' | 'medium' | 'high';
export type IssueStatus = 'confirmed' | 'solution_selected' | 'in_blueprint';
export type MappingType =
    | 'unchanged'
    | 'modified'
    | 'added'
    | 'removed'
    | 'consolidated' // N:1 (여러 As-Is → 하나의 To-Be)
    | 'split'; // 1:N (하나의 As-Is → 여러 To-Be)
export type BlueprintStatus = 'empty' | 'draft' | 'current';

export interface ExpectedImpact {
    /** 연간 비용 변화 (KRW). 음수 = 절감. */
    cost_delta: number;
    /** FTE 변화. 음수 = 절감. */
    fte_delta: number;
    /** 예상 구현 기간(개월). */
    timeline_months?: number;
    confidence?: Confidence;
}

export interface SolutionOption {
    id: string;
    solution_type: SolutionType;
    title: string;
    description?: string;
    pros?: string;
    cons?: string;
    implementation_effort: EffortLevel;
    expected_impact: ExpectedImpact;
    /** AI가 자동 제안했는지 여부 (사용자가 수정하면 false 로 내려갈 수 있음). */
    ai_generated: boolean;
    created_at: string;
    updated_at: string;
}

export interface ToBeIssue {
    id: string;
    /** 원본 PI Flag 코멘트 id (역추적용). */
    source_comment_id?: string;
    /** 플래그가 달린 As-Is BPMN element id. */
    source_element_id?: string;
    source_element_name?: string;
    title: string;
    description?: string;
    /** PI Flag 유형 코드 (DEFAULT_PI_FLAG_TYPES). */
    flag_type?: string;
    status: IssueStatus;
    solutions: SolutionOption[];
    selected_solution_id: string | null;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface TaskMapEntry {
    id: string;
    tobe_element_id: string;
    tobe_element_name?: string;
    /** 출처 As-Is element id 목록. length>1 → N:1(consolidated). 동일 As-Is id가 여러 entry 에 → 1:N(split). */
    asis_element_ids: string[];
    mapping_type: MappingType;
    issue_id?: string | null;
    solution_id?: string | null;
    change_description?: string;
    /** true = 자동 도출, false = 사용자 수동 보정. */
    auto: boolean;
}

export interface BlueprintMeta {
    generated_at: string;
    generated_from_solution_ids: string[];
    xml_hash: string;
    node_count: number;
    link_count: number;
    status: BlueprintStatus;
    summary?: string;
}

export interface ToBeRoiConfig {
    currency: string;
    annual_cost_per_fte: number;
    baseline: { cost: number; fte: number };
    cumulative: { cost: number; fte: number };
}

export interface ToBeData {
    version: number;
    blueprint_xml: string;
    blueprint_meta: BlueprintMeta;
    issues: ToBeIssue[];
    task_map: TaskMapEntry[];
    roi: ToBeRoiConfig;
    updated_at: string;
    /* --- AN Transformation Studio (4-stage) 확장 필드 (additive) --- */
    partitions?: PartitionBlock[];
    gaps?: GapCard[];
    orchestrator?: OrchestratorModel | null;
    roadmap?: RoadmapModel | null;
    skill_shift?: SkillShiftModel | null;
    /** Call Activity 모듈화로 생성된 자식 프로세스 추적(블록 → 자식 proc_def). */
    modularized?: ModularizedChild[];
    /** 원본을 Call Activity 로 치환한 To-Be 미리보기 BPMN (live proc_def.bpmn 은 건드리지 않음). */
    modularized_bpmn?: string;
    publish_status?: PublishStatus;
    published_at?: string;
    /** AI 실행형 변환 결과 (엔진 definition JSON + 검증). */
    executable?: ExecutableData | null;
}

/* ------------------------------------------------------------------ */
/* AN Transformation Studio — 4-stage extension                        */
/* As-Is Partitioning → Gap Triage → To-Be Orchestrator → Roadmap.     */
/* 모든 데이터는 To-Be 와 함께 proc_def.definition.tobe 에 저장된다.        */
/* ------------------------------------------------------------------ */

export type GapCategory = 'PROCESS' | 'DATA' | 'AUTOMATION';
export type GapTriageAction = 'pending' | 'accepted' | 'edited' | 'kept';
export type Severity = 'low' | 'medium' | 'high';
export type PublishStatus = 'draft' | 'published';

/** 3-Way Tollgate 합의 상태 (PI / 현업 / 본사). */
export interface TollgateState {
    pi: boolean;
    field: boolean; // 현업
    hq: boolean; // 본사
}

export interface PartitionTask {
    id: string;
    name: string;
    /** TMF Open API 코드. 2개 이상이면 콤마로 구분 (예: "TMF641, TMF645"). */
    tmf?: string;
}

/** Call Activity 모듈화로 생성된 자식 프로세스 1건. */
export interface ModularizedChild {
    partition_id: string;
    def_id: string; // 생성된 자식 proc_def id
    name: string;
    etom_process_id?: string;
    /** 블록 태스크들에 매핑된 TMF Open API 코드 목록. */
    tmf_apis?: string[];
    element_ids: string[]; // 자식으로 추출된 원본 요소 id
    created_at: string;
}

/** eTOM L3 매핑 후보 1건. 확신도 순으로 정렬되며 1순위가 블록의 대표(etom_l3/etom_process_id) 매핑이다. */
export interface EtomCandidate {
    etom_l3: string; // eTOM L3 카테고리명
    etom_process_id?: string; // eTOM L3 Process ID (예: "1.5.10.3")
    reason?: string; // 이 후보로 판단한 근거 한 문장
}

/** As-Is 도면을 eTOM L3 기준으로 구획한 논리 블록. */
export interface PartitionBlock {
    id: string;
    name: string; // 한글 블록명
    name_en?: string; // 영문 부제
    etom_l3?: string; // 매핑된 eTOM L3 카테고리명
    etom_process_id?: string; // 매핑된 eTOM L3 Process ID (qdrantChat RAG 제공). Call Activity 모듈 ID prefix 로도 사용.
    /** eTOM L3 매핑 후보 목록(확신도 순, 1순위 = 대표 매핑). 구버전 결과에는 없을 수 있다. */
    etom_candidates?: EtomCandidate[];
    reasoning?: string; // 이 블록으로 분류된 근거(맥락)
    tasks: PartitionTask[];
    /** 이 블록에 속한 As-Is BPMN 캔버스 요소 ID 목록. Group 박스 바운딩·모듈화 추출의 기준. */
    element_ids?: string[];
    confirmed?: boolean;
    /**
     * 팔레트 색 인덱스(0~7). 블록 생성 시 1회 배정되어 생애 동안 불변 —
     * 목록 순서가 바뀌거나 다른 블록이 삭제돼도 색이 밀리지 않는다.
     * 구버전 데이터에는 없으며 ensurePartitionColors 가 지연 배정한다.
     */
    color_idx?: number;
}

/** Gap Triage 단계의 이슈 카드 (Process / Data / Automation). */
export interface GapCard {
    id: string;
    category: GapCategory;
    title: string;
    description?: string;
    partition_id?: string | null;
    partition_name?: string;
    element_ids?: string[];
    severity?: Severity;
    recommendation?: string;
    triage: GapTriageAction;
    tollgate: TollgateState;
    /** 3주체 합의 완료 → Issue Backlog 락인. */
    locked: boolean;
    /** 현업(Audit Reviewer)이 직접 등록한 커스텀 Gap. */
    custom?: boolean;
    created_by?: string;
    created_at: string;
}

export interface OrchestratorStep {
    name: string;
    automated: boolean;
    tmf?: string;
}

export interface OrchestratorBlock {
    partition_id?: string | null;
    name: string;
    tmf?: string;
    to_be_steps: OrchestratorStep[];
}

/** To-Be Master Orchestrator 모델 (상단 스윔레인). */
export interface OrchestratorModel {
    master_name: string;
    gateway: { name: string; subtitle?: string };
    blocks: OrchestratorBlock[];
    generated_at: string;
}

export interface RoadmapInitiative {
    id: string;
    name: string;
    partition_id?: string | null;
    start_index: number; // quarter 시작 인덱스(0-base)
    span: number; // 진행 분기 수
    label?: string;
}

export interface RoadmapModel {
    quarters: string[]; // ['Q1 2026', 'Q2 2026', ...]
    initiatives: RoadmapInitiative[];
    generated_at: string;
}

/** HR 역량 전환(Skill Shift) 시뮬레이션. */
export interface SkillShiftItem {
    partition_id?: string | null;
    partition_name?: string;
    as_is: string; // 현재 역량
    to_be: string; // 미래 역량
    insight?: string; // 임원 보고용 인사이트
    reskill_count?: number;
}

export interface SkillShiftModel {
    items: SkillShiftItem[];
    generated_at: string;
}

/* ------------------------------------------------------------------ */
/* Catalogs (UI metadata)                                              */
/* ------------------------------------------------------------------ */

export interface SolutionTypeMeta {
    value: SolutionType;
    label: string;
    icon: string;
    color: string;
}

export const SOLUTION_TYPES: SolutionTypeMeta[] = [
    { value: 'API_INTEGRATION', label: 'API 연동', icon: 'mdi-api', color: 'indigo' },
    { value: 'RPA', label: 'RPA 자동화', icon: 'mdi-robot-industrial', color: 'deep-purple' },
    { value: 'PROCESS_REDESIGN', label: '프로세스 재설계', icon: 'mdi-sitemap-outline', color: 'teal' },
    { value: 'MANUAL_AUTOMATION', label: '수작업 자동화', icon: 'mdi-cog-sync-outline', color: 'cyan' },
    { value: 'SYSTEM_ENHANCEMENT', label: '시스템 고도화', icon: 'mdi-application-cog-outline', color: 'blue' },
    { value: 'OUTSOURCING', label: '아웃소싱', icon: 'mdi-handshake-outline', color: 'brown' },
    { value: 'OTHER', label: '기타', icon: 'mdi-dots-horizontal', color: 'grey' }
];

export const EFFORT_META: Record<EffortLevel, { label: string; color: string }> = {
    low: { label: '낮음', color: 'success' },
    medium: { label: '보통', color: 'warning' },
    high: { label: '높음', color: 'error' }
};

export const CONFIDENCE_META: Record<Confidence, { label: string; color: string }> = {
    low: { label: '낮음', color: 'grey' },
    medium: { label: '보통', color: 'info' },
    high: { label: '높음', color: 'success' }
};

export const MAPPING_TYPE_META: Record<MappingType, { label: string; color: string; marker: string }> = {
    unchanged: { label: '유지', color: 'grey', marker: 'tobe-map-unchanged' },
    modified: { label: '변경', color: 'orange', marker: 'tobe-map-modified' },
    added: { label: '신규', color: 'green', marker: 'tobe-map-added' },
    removed: { label: '삭제', color: 'red', marker: 'tobe-map-removed' },
    consolidated: { label: '통합(N:1)', color: 'purple', marker: 'tobe-map-consolidated' },
    split: { label: '분할(1:N)', color: 'blue', marker: 'tobe-map-split' }
};

export function solutionTypeMeta(type: string | undefined): SolutionTypeMeta {
    return SOLUTION_TYPES.find((t) => t.value === type) || SOLUTION_TYPES[SOLUTION_TYPES.length - 1];
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export function nowIso(): string {
    return new Date().toISOString();
}

export function genId(prefix: string): string {
    try {
        const uuid = (globalThis as any)?.crypto?.randomUUID?.();
        if (uuid) return `${prefix}_${uuid}`;
    } catch {
        /* ignore */
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** djb2 문자열 해시 (보안용 아님 — XML 변경 감지용). */
export function hashString(input: string): string {
    let hash = 5381;
    const str = String(input || '');
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */

export function createExpectedImpact(partial: Partial<ExpectedImpact> = {}): ExpectedImpact {
    return {
        cost_delta: Number(partial.cost_delta) || 0,
        fte_delta: Number(partial.fte_delta) || 0,
        timeline_months: partial.timeline_months,
        confidence: partial.confidence || 'medium'
    };
}

export function createSolution(partial: Partial<SolutionOption> = {}): SolutionOption {
    const ts = nowIso();
    return {
        id: partial.id || genId('sol'),
        solution_type: partial.solution_type || 'OTHER',
        title: partial.title || '새 솔루션 옵션',
        description: partial.description || '',
        pros: partial.pros || '',
        cons: partial.cons || '',
        implementation_effort: partial.implementation_effort || 'medium',
        expected_impact: createExpectedImpact(partial.expected_impact),
        ai_generated: partial.ai_generated ?? false,
        created_at: partial.created_at || ts,
        updated_at: ts
    };
}

export function createIssue(partial: Partial<ToBeIssue> = {}): ToBeIssue {
    const ts = nowIso();
    return {
        id: partial.id || genId('iss'),
        source_comment_id: partial.source_comment_id,
        source_element_id: partial.source_element_id,
        source_element_name: partial.source_element_name,
        title: partial.title || '제목 없는 이슈',
        description: partial.description || '',
        flag_type: partial.flag_type,
        status: partial.status || 'confirmed',
        solutions: Array.isArray(partial.solutions) ? partial.solutions.map(createSolution) : [],
        selected_solution_id: partial.selected_solution_id ?? null,
        created_by: partial.created_by,
        created_at: partial.created_at || ts,
        updated_at: ts
    };
}

export function createTaskMapEntry(partial: Partial<TaskMapEntry> = {}): TaskMapEntry {
    return {
        id: partial.id || genId('map'),
        tobe_element_id: partial.tobe_element_id || '',
        tobe_element_name: partial.tobe_element_name || '',
        asis_element_ids: Array.isArray(partial.asis_element_ids) ? [...partial.asis_element_ids] : [],
        mapping_type: partial.mapping_type || 'modified',
        issue_id: partial.issue_id ?? null,
        solution_id: partial.solution_id ?? null,
        change_description: partial.change_description || '',
        auto: partial.auto ?? true
    };
}

export function createTollgate(partial: Partial<TollgateState> = {}): TollgateState {
    return { pi: !!partial.pi, field: !!partial.field, hq: !!partial.hq };
}

/**
 * task.tmf 류의 값(문자열/배열)을 개별 TMF Open API 코드 배열로 정규화한다.
 * 콤마·세미콜론·슬래시 구분을 허용하고, placeholder("TMF XXX")와 중복은 제거한다.
 */
export function splitTmfCodes(value: unknown): string[] {
    const parts = Array.isArray(value) ? value : String(value ?? '').split(/[,;/]+/);
    const out: string[] = [];
    for (const part of parts) {
        const code = String(part ?? '').trim();
        if (!code || /^TMF[\s_-]*XXX$/i.test(code)) continue;
        if (!out.includes(code)) out.push(code);
    }
    return out;
}

export function createPartition(partial: Partial<PartitionBlock> = {}): PartitionBlock {
    const tasks = Array.isArray(partial.tasks)
        ? partial.tasks.map((t) => ({ id: t.id || genId('pt'), name: t.name || '', tmf: t.tmf || '' }))
        : [];
    // element_ids 가 명시되지 않았으면 task 의 실제 BPMN 요소 ID(pt_ 합성 ID 제외)에서 파생.
    const explicitEls = Array.isArray(partial.element_ids) ? partial.element_ids : [];
    const derivedEls = tasks.map((t) => t.id).filter((id) => id && !id.startsWith('pt_'));
    const element_ids = Array.from(new Set([...explicitEls, ...derivedEls]));
    const etom_candidates = Array.isArray(partial.etom_candidates)
        ? partial.etom_candidates
              .map((c) => ({
                  etom_l3: String(c?.etom_l3 || '').trim(),
                  etom_process_id: String(c?.etom_process_id || '').trim(),
                  reason: String(c?.reason || '').trim()
              }))
              .filter((c) => c.etom_l3 || c.etom_process_id)
        : [];
    return {
        id: partial.id || genId('part'),
        name: partial.name || '논리 블록',
        name_en: partial.name_en || '',
        etom_l3: partial.etom_l3 || '',
        etom_process_id: partial.etom_process_id || '',
        etom_candidates,
        reasoning: partial.reasoning || '',
        tasks,
        element_ids,
        confirmed: partial.confirmed ?? false
    };
}

export function createModularizedChild(partial: Partial<ModularizedChild> = {}): ModularizedChild {
    return {
        partition_id: partial.partition_id || '',
        def_id: partial.def_id || '',
        name: partial.name || '',
        etom_process_id: partial.etom_process_id || '',
        element_ids: Array.isArray(partial.element_ids) ? [...partial.element_ids] : [],
        created_at: partial.created_at || nowIso()
    };
}

export function createGapCard(partial: Partial<GapCard> = {}): GapCard {
    return {
        id: partial.id || genId('gap'),
        category: (['PROCESS', 'DATA', 'AUTOMATION'].includes(partial.category as string) ? partial.category : 'PROCESS') as GapCategory,
        title: partial.title || '제목 없는 Gap',
        description: partial.description || '',
        partition_id: partial.partition_id ?? null,
        partition_name: partial.partition_name || '',
        element_ids: Array.isArray(partial.element_ids) ? [...partial.element_ids] : [],
        severity: partial.severity || 'medium',
        recommendation: partial.recommendation || '',
        triage: partial.triage || 'pending',
        tollgate: createTollgate(partial.tollgate),
        locked: partial.locked ?? false,
        custom: partial.custom ?? false,
        created_by: partial.created_by,
        created_at: partial.created_at || nowIso()
    };
}

export function createOrchestrator(partial: any = {}): OrchestratorModel {
    const blocks = Array.isArray(partial?.blocks) ? partial.blocks : [];
    return {
        master_name: String(partial?.master_name || 'To-Be Master Orchestrator'),
        gateway: {
            name: String(partial?.gateway?.name || 'API Gateway'),
            subtitle: String(partial?.gateway?.subtitle || '')
        },
        blocks: blocks.map((b: any) => ({
            partition_id: b?.partition_id ?? null,
            name: String(b?.name || '블록'),
            tmf: String(b?.tmf || 'TMF XXX'),
            to_be_steps: (Array.isArray(b?.to_be_steps) ? b.to_be_steps : []).map((s: any) => ({
                name: String(s?.name || ''),
                automated: !!s?.automated,
                tmf: String(s?.tmf || '')
            }))
        })),
        generated_at: partial?.generated_at || nowIso()
    };
}

export function createRoadmap(partial: any = {}): RoadmapModel {
    return {
        quarters: Array.isArray(partial?.quarters) ? partial.quarters.map((q: any) => String(q)) : [],
        initiatives: (Array.isArray(partial?.initiatives) ? partial.initiatives : []).map((x: any) => ({
            id: x?.id || genId('init'),
            name: String(x?.name || ''),
            partition_id: x?.partition_id ?? null,
            start_index: Number(x?.start_index) || 0,
            span: Number(x?.span) || 1,
            label: String(x?.label || '')
        })),
        generated_at: partial?.generated_at || nowIso()
    };
}

export function createSkillShift(partial: any = {}): SkillShiftModel {
    return {
        items: (Array.isArray(partial?.items) ? partial.items : []).map((k: any) => ({
            partition_id: k?.partition_id ?? null,
            partition_name: String(k?.partition_name || ''),
            as_is: String(k?.as_is || ''),
            to_be: String(k?.to_be || ''),
            insight: String(k?.insight || ''),
            reskill_count: k?.reskill_count != null ? Number(k.reskill_count) : undefined
        })),
        generated_at: partial?.generated_at || nowIso()
    };
}

export function createEmptyRoi(): ToBeRoiConfig {
    return {
        currency: DEFAULT_CURRENCY,
        annual_cost_per_fte: DEFAULT_ANNUAL_COST_PER_FTE,
        baseline: { cost: 0, fte: 0 },
        cumulative: { cost: 0, fte: 0 }
    };
}

export function createEmptyBlueprintMeta(): BlueprintMeta {
    return {
        generated_at: '',
        generated_from_solution_ids: [],
        xml_hash: '',
        node_count: 0,
        link_count: 0,
        status: 'empty'
    };
}

export function createEmptyToBe(): ToBeData {
    return {
        version: TOBE_SCHEMA_VERSION,
        blueprint_xml: '',
        blueprint_meta: createEmptyBlueprintMeta(),
        issues: [],
        task_map: [],
        roi: createEmptyRoi(),
        updated_at: nowIso(),
        partitions: [],
        gaps: [],
        orchestrator: null,
        roadmap: null,
        skill_shift: null,
        modularized: [],
        modularized_bpmn: '',
        publish_status: 'draft',
        published_at: undefined,
        executable: null
    };
}

/**
 * 저장된 raw 값을 정규화 + 구버전 마이그레이션.
 * - 구버전: `definition.tobe_bpmn` (단일 XML 문자열) → `tobe.blueprint_xml` 으로 흡수.
 */
export function normalizeToBe(raw: any, legacyToBeBpmn?: string): ToBeData {
    const base = createEmptyToBe();
    if (raw && typeof raw === 'object') {
        base.version = Number(raw.version) || TOBE_SCHEMA_VERSION;
        base.blueprint_xml = typeof raw.blueprint_xml === 'string' ? raw.blueprint_xml : base.blueprint_xml;
        base.blueprint_meta = { ...base.blueprint_meta, ...(raw.blueprint_meta || {}) };
        base.issues = Array.isArray(raw.issues) ? raw.issues.map(createIssue) : [];
        base.task_map = Array.isArray(raw.task_map) ? raw.task_map.map(createTaskMapEntry) : [];
        base.roi = { ...createEmptyRoi(), ...(raw.roi || {}) };
        base.updated_at = raw.updated_at || base.updated_at;
        // AN Transformation Studio 확장 필드 (round-trip 보존)
        base.partitions = Array.isArray(raw.partitions) ? raw.partitions.map(createPartition) : [];
        base.gaps = Array.isArray(raw.gaps) ? raw.gaps.map(createGapCard) : [];
        base.orchestrator = raw.orchestrator && typeof raw.orchestrator === 'object' ? createOrchestrator(raw.orchestrator) : null;
        base.roadmap = raw.roadmap && typeof raw.roadmap === 'object' ? createRoadmap(raw.roadmap) : null;
        base.skill_shift = raw.skill_shift && typeof raw.skill_shift === 'object' ? createSkillShift(raw.skill_shift) : null;
        base.modularized = Array.isArray(raw.modularized) ? raw.modularized.map(createModularizedChild) : [];
        base.modularized_bpmn = typeof raw.modularized_bpmn === 'string' ? raw.modularized_bpmn : '';
        base.publish_status = raw.publish_status === 'published' ? 'published' : 'draft';
        base.published_at = raw.published_at || undefined;
        base.executable = normalizeExecutableData(raw.executable);
    }
    // tobe_bpmn(순서도 To-Be 캔버스 저장본) 흡수.
    // studio persist 는 항상 tobe_bpmn = blueprint_xml 로 동기화하므로 두 값이 다르면
    // 캔버스 쪽(tobe_bpmn)이 더 최신이다 — 단, As-Is↔To-Be 토글만으로도 저장되는
    // 빈 To-Be 스켈레톤이 실청사진을 지우지 않도록 액티비티가 있는 도면만 우선한다.
    if (legacyToBeBpmn && legacyToBeBpmn !== base.blueprint_xml && (!base.blueprint_xml || hasBpmnActivities(legacyToBeBpmn))) {
        base.blueprint_xml = legacyToBeBpmn;
        if (base.blueprint_meta.status === 'empty') base.blueprint_meta.status = 'draft';
        base.blueprint_meta.xml_hash = hashString(legacyToBeBpmn);
    }
    return base;
}

/* ------------------------------------------------------------------ */
/* ROI math                                                            */
/* ------------------------------------------------------------------ */

/** 선택된 솔루션들의 impact 합산 (delta). 음수 = 절감. */
export function sumSelectedImpact(issues: ToBeIssue[]): { cost: number; fte: number; count: number } {
    let cost = 0;
    let fte = 0;
    let count = 0;
    for (const issue of issues || []) {
        if (!issue.selected_solution_id) continue;
        const sol = issue.solutions.find((s) => s.id === issue.selected_solution_id);
        if (!sol) continue;
        cost += Number(sol.expected_impact?.cost_delta) || 0;
        fte += Number(sol.expected_impact?.fte_delta) || 0;
        count += 1;
    }
    return { cost, fte, count };
}

/** FTE 절감을 비용으로 환산한 총 절감 효과 (양수 = 절감). */
export function totalSavings(impact: { cost: number; fte: number }, annualCostPerFte: number): number {
    const fromCost = -(impact.cost || 0);
    const fromFte = -(impact.fte || 0) * (annualCostPerFte || 0);
    return fromCost + fromFte;
}
