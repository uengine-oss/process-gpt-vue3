/**
 * Ontology Explorer New 소비 타입 계약 (specs/005 data-model.md).
 *
 * 그래프 스키마 정본은 ../process-gpt-vue3-main/ontology/SCHEMA.md(0.2.x) —
 * 여기서는 페이지 관점의 소비 모델(레이어 매핑·순회·화면 상태)만 정의하고
 * 노드/엣지 속성 집합은 재정의하지 않는다(properties 원문 보존).
 */

export type BusinessLayer = 'strategy' | 'process' | 'task' | 'resource' | 'knowledge';

export interface BusinessNode {
    /** `${label}:${tenant}:${업무키}` — RPC 가 결정론적으로 생성(V5) */
    id: string;
    /** AGE 노드 라벨 (PascalCase) */
    label: string;
    layer: BusinessLayer;
    /** 표시명 (name → username → alias → file_name → 업무키 폴백) */
    name: string;
    /** properties(n) 원문 — 상세 패널 표시용 */
    properties: Record<string, unknown>;
}

export interface BusinessEdge {
    /** `${type}:${sourceId}->${targetId}` (+FLOWS_TO 는 `#${seq_id}` 접미) */
    id: string;
    /** AGE 엣지 라벨 (UPPER_SNAKE) */
    type: string;
    source: string;
    target: string;
    properties: Record<string, unknown>;
}

export interface BusinessOntologyGraph {
    nodes: BusinessNode[];
    edges: BusinessEdge[];
    /** RPC 노드 5,000 상한 절단 여부 */
    truncated?: boolean;
}

/* ── 실행 집계 (ontology_execution_rollup, data-model.md §5) ── */

export interface ProcessRollup {
    procDefId: string;
    runningCount: number;
}

export interface ActivityRollup {
    procDefId: string;
    elementId: string;
    workItemCount: number;
    /** DONE 건 평균 소요(시간). 산출 불가 시 null */
    avgDurationHours: number | null;
    reworkSum: number;
    inProgressCount: number;
}

export interface KpiSurveyRollup {
    kpiId: string;
    avgRating: number;
    answeredCount: number;
}

export interface ExecutionRollup {
    processes: ProcessRollup[];
    activities: ActivityRollup[];
    kpiSurveys: KpiSurveyRollup[];
}

/** KPI 달성 상태 — direction·target_value 대비 current_value (값 부재 시 unknown) */
export type KpiStatus = 'ok' | 'warning' | 'unknown';

/* ── 역추적/순추적 (data-model.md §4) ── */

export type TraceMode = 'rootCause' | 'contribution';

export type TraceWarningKind = 'strategy-execution-gap' | 'unknown-role' | 'cycle-detected';

export interface TraceWarning {
    kind: TraceWarningKind;
    /** 경고 발생 지점 노드 id */
    nodeId: string;
    message: string;
}

export type CauseReason =
    | 'bottleneck'
    | 'agent-performance'
    | 'skill-dependency'
    | 'system-dependency'
    | 'unresolved-role'
    | 'no-execution-link';

export interface CauseCandidate {
    nodeId: string;
    /** null → '집계 없음' 강등 (FR-010) */
    metrics: ActivityRollup | null;
    reason: CauseReason;
}

export interface ImpactTrace {
    originId: string;
    mode: TraceMode;
    nodeIds: Set<string>;
    edgeIds: Set<string>;
    /** rootCause 모드만 채움. 집계 내림차순, 집계 없음 후순위 */
    causeCandidates: CauseCandidate[];
    warnings: TraceWarning[];
}

/* ── 그래프 헬스 (ontology_graph_health, data-model.md §6) ── */

export interface GraphHealth {
    installed: boolean;
    schemaVersion: string | null;
    /** '0.2' prefix 일치 여부 (V4 — 불일치 시 렌더 중단) */
    compatible: boolean;
    layerCounts: Record<BusinessLayer, number>;
    danglingCount: number;
}

export type HealthState = 'loading' | 'notInstalled' | 'incompatible' | 'ready' | 'error';

/* ── 화면 상태 (data-model.md §7) ── */

export interface RenderBlocked {
    blocked: boolean;
    visibleCount?: number;
}

/* ── 캔버스 렌더 계측 (라이브러리 비교 후 NVL 확정 — T051) ── */

export type CanvasLib = 'nvl';

export interface CanvasPerfMetric {
    lib: CanvasLib;
    /** 라이브러리 동적 import 소요(ms). 정적 번들(cytoscape)은 0 */
    libLoadMs: number;
    /** 데이터 → 첫 렌더 완료 소요(ms) */
    renderMs: number;
    /** 렌더 완료 시각 (로컬, ms 포함) */
    finishedAt: string;
    nodes: number;
    edges: number;
}

/** 캔버스 렌더 가드 상한(기존 explorer 정책 재사용, FR-017) */
export const MAX_VISIBLE_NODES = 1500;
