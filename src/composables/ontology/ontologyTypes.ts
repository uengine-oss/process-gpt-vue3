/**
 * Ontology Explorer 타입 계약.
 *
 * BPMN 파싱 결과를 프로세스·시스템·조직·데이터 온톨로지 그래프로 투영한 클라이언트
 * 메모리 모델. 신규 영속 테이블 없이 기존 tb_bpmn_* 조회 결과에서 파생된다.
 * (specs/001-ontology-explorer/data-model.md 기준)
 */

export type OntologyNodeKind = 'ProcessTask' | 'Role' | 'System' | 'Data';

export type OntologyRelation = ':isFollowedBy' | ':hasRole' | ':usesSystem' | ':hasManual';

/** 노드 다차원 슬라이서 메타. 조직은 org_code/org_name만 사용(department 미사용). */
export interface OntologyDimensions {
    orgCode?: string;
    orgName?: string;
    system?: string;
    lifecycle?: string;
    [axis: string]: string | undefined;
}

export interface OntologyNodeMetrics {
    inDegree: number;
    outDegree: number;
    /** 위험 노드가 영향을 미치는 프로세스 수(FR-021). */
    impactedProcessCount?: number;
    /** 위험 노드 연관 FTE 맥락 지표(FR-021). */
    fte?: number;
}

export interface OntologyRisk {
    isRisk: boolean;
    type?: 'SPOF' | 'StructuralDefect';
}

export interface OntologyNode {
    id: string;
    kind: OntologyNodeKind;
    label: string;
    dimensions: OntologyDimensions;
    /** Confluence 매뉴얼 URL — 값이 있을 때만(FR-007). */
    manualUrl: string | null;
    metrics: OntologyNodeMetrics;
    risk: OntologyRisk | null;
}

export interface OntologyEdge {
    id: string;
    source: string;
    target: string;
    relation: OntologyRelation;
}

export interface DimensionAxisValue {
    value: string;
    label: string;
}

export interface DimensionAxis {
    key: string;
    label: string;
    values: DimensionAxisValue[];
}

export interface OntologyGraph {
    nodes: OntologyNode[];
    edges: OntologyEdge[];
    dimensionAxes: DimensionAxis[];
}

/** 뷰 상태: 필터·포커스·Depth·선택 노드. */
export interface SliceState {
    /** 축별 선택 조건(추가/제거). key = DimensionAxis.key */
    activeFilters: Record<string, string[]>;
    /** Context Slicing 기준 노드(FR-015). */
    focusNodeId: string | null;
    /** 연관 추적 깊이(휠/슬라이더, FR-016). */
    depth: number;
    /** 콘솔·측면 패널 연동 대상(FR-011). */
    selectedNodeId: string | null;
}

/** 노드별 가시성 계산 결과(fade-out은 opacity 토글, 노드 제거 없음). */
export type VisibilityMap = Record<string, { visible: boolean; opacity: number }>;

/** AI 산출 리스크 리포트(FR-020, FR-021). */
export interface RiskReport {
    nodeId: string;
    riskType: 'SPOF' | 'StructuralDefect';
    impactedProcessCount: number;
    fte: number;
    narrative: string;
}

export function createEmptySliceState(): SliceState {
    return { activeFilters: {}, focusNodeId: null, depth: 1, selectedNodeId: null };
}

/* ── 온톨로지 매퍼 입력(파서 산출물) — proc_def BPMN 파싱 결과의 최소 형태 ── */

export interface OntologyParseNode {
    element_id: string;
    /** BPMN localName (예: Task, UserTask, CallActivity, ExclusiveGateway, StartEvent) */
    element_type: string;
    name: string | null;
    /** 소속 lane element id (없으면 null) */
    lane_id: string | null;
    /** extensionElements 에서 추출한 커스텀 속성(usesSystem, hasManual 등) */
    properties: Record<string, string>;
}

export interface OntologyParseLane {
    element_id: string;
    name: string | null;
    properties: Record<string, string>;
}

export interface OntologyParseLink {
    source_element_id: string;
    target_element_id: string;
}

export interface OntologyParseInput {
    nodes: OntologyParseNode[];
    lanes: OntologyParseLane[];
    links: OntologyParseLink[];
}
