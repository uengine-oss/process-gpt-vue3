/**
 * useOntologyGraph — Ontology Explorer 상태 오케스트레이션 (specs/002 재작성, 단일 상태 소유자).
 *
 * canonical ProcessGraph(src/lib/processKg) 위에서 동작한다:
 *  - 그래프 소스: ProcDefGraphSource(proc_def 기본) / ArtifactGraphSource(graph.json) 전환(FR-025 전체 초기화)
 *  - 분석: useAnalysisCache(랭킹 9종 + SPOF eager, CQ 온디맨드, 근거 서브그래프 LRU)
 *  - 가시성 파이프라인(data-model.md §3 순서 고정):
 *    렌더 가드 → evidence(배타) → 엔터티 포커스 → 뷰 모드 → 노드 타입 토글 → 축 필터 → 검색 → focus+Depth fade
 *  - 레거시 호환: 우측 축 필터(본부/시스템/라이프사이클)는 legacyOntologyMapper 의 dimensions 로
 *    canonical 노드에 축 값을 부여해 기존 의미(축 간 AND·축 내 OR, 축 값 없는 노드 제외)를 유지한다.
 *  - AI 내러티브: InsightNarrativeGenerator(qdrantChat 전용, mock 금지) — 카드 단위 온디맨드 + 캐시.
 *
 * 컴포넌트는 props/emit 전용 — 모든 상태 변경은 이 composable 의 액션을 통해서만 일어난다.
 */
import { computed, reactive, ref, shallowRef } from 'vue';
import type { EdgeType, GraphEdge, GraphNode, NodeType, ParseReport, ProcessGraph } from '@/lib/processKg/graph/types';
import type { GraphBuildMetadata } from '@/lib/processKg/config/graphSource';
import type { GraphSource, GraphSourceProvider } from '@/lib/processKg/source/graphSource';
import { ArtifactGraphSource, type ArtifactFileLike } from '@/lib/processKg/source/artifactSource';
import { ProcDefGraphSource } from '@/services/processKgGraphService';
import type { InsightCard } from '@/lib/processKg/analysis/types';
import { generateAnalysisReportMarkdown } from '@/lib/processKg/analysis/reportMarkdown';
import { getNodeLabel, type GraphIndex } from '@/lib/processKg/analysis/graphIndex';
import { generateInsightNarrative } from '@/components/ontology-explorer/ai/InsightNarrativeGenerator';
import { useAnalysisCache, type SpofRiskType } from './useAnalysisCache';
import {
    applyViewModeFilters,
    DEFAULT_VISIBLE_ACTIVITY_SUBTYPES,
    getDefaultNodeTypesForView,
    isCallActivityNode,
    PROCESS_CONTEXT_NODE_TYPES,
    type ActivityUiSubtype,
    type ViewMode
} from './viewModes';
import { MAX_VISIBLE_NODES, shouldRenderGraph } from './renderGuard';
import {
    addNodeToCurrentFocus,
    ANNOTATION_FOCUS_DISABLED_REASON,
    buildFocusedSubgraph,
    createFocusStateForNode,
    defaultEntityFocusState,
    getEntityOptions,
    isEntityFocusActive,
    type EntityFocusState,
    type EntityOption
} from './entityFocus';
import { useInsightWorkflow, type DataTask, type DataTaskStatus, type InsightWorkflowStatus } from './useInsightWorkflow';
import { buildTopInsightSections, computeOverviewStats, type OverviewStats, type TopInsightSection } from './overviewInsights';
import { toLegacyOntologyGraph } from './legacyOntologyMapper';
import type { DimensionAxis, OntologyDimensions } from './ontologyTypes';
import { colorForNodeType, labelForNodeType } from './nodeTypeColors';

/** 001 contextSlicer 와 동일한 fade 불투명도(제거가 아닌 잔상 유지). */
const FADE_OPACITY = 0.06;
/** 001 SliceState 기본 depth(휠/슬라이더 0~6 범위). */
const DEFAULT_DEPTH = 1;
const DEFAULT_SOURCE_ID = 'proc-def';
const DEFAULT_SOURCE_LABEL = '프로세스 정의 (proc_def)';

/** 001 SliceState 확장(data-model.md §3) — 노드 타입 토글·활동 서브타입·검색 추가. */
export interface KgSliceState {
    activeFilters: Record<string, string[]>;
    visibleNodeTypes: Set<NodeType>;
    visibleActivitySubtypes: Set<ActivityUiSubtype>;
    searchTerm: string;
    focusNodeId: string | null;
    depth: number;
    selectedNodeId: string | null;
}

export interface EvidenceState {
    active: boolean;
    insightId: string | null;
    subgraph: { nodeIds: Set<string>; edgeIds: Set<string> } | null;
}

export interface GraphSourceState {
    sources: GraphSource[];
    currentSourceId: string;
}

export interface RenderBlockedState {
    blocked: boolean;
    reason?: string;
    visibleCount?: number;
}

export interface NodeTypeOption {
    type: NodeType;
    label: string;
    color: string;
    count: number;
}

export interface CqAction {
    key: string;
    label: string;
}

export type SwitchSourceTarget = { id: string } | { artifact: { url?: string; file?: ArtifactFileLike } };

interface RenderComputation {
    nodes: GraphNode[];
    edges: GraphEdge[];
    blocked: RenderBlockedState;
}

/** AiReasoningConsole 의 NodeContextEdge 계약(FR-029)과 구조 동일 — 관련 엣지 1행. */
export interface NodeContextEdgeView {
    type: string;
    counterpartLabel: string;
    derived: boolean;
    activityCount?: number;
}

/** AiReasoningConsole 의 NodeContext 계약(FR-029)과 구조 동일 — 선택 노드 상세 컨텍스트. */
export interface NodeContextView {
    incoming: NodeContextEdgeView[];
    outgoing: NodeContextEdgeView[];
    incomingTotal: number;
    outgoingTotal: number;
    processSummary: { counts: Record<string, number>; lists: Record<string, string[]> } | null;
    callActivity: {
        parentProcessLabel: string | null;
        parentFocusNodeId: string | null;
        invokes: Array<{ label: string; focusNodeId: string | null }>;
        definitionId: string | null;
    } | null;
    rawPropertiesJson: string;
    focus: { canFocus: boolean; canAddToFocus: boolean; disabledReason?: string };
}

/** 희소 포커스 안내 상태(FR-034 — SAMPLE ExplorePage sparseFocusWarning 규칙). */
export interface SparseFocusState {
    active: boolean;
    message: string | null;
}

/** 그래프 요약(FR-032) — WhatIfSimulatorPanel summary prop 계약과 동일. */
export interface GraphSummaryView {
    models: number;
    processes: number;
    nodes: number;
    edges: number;
    warnings: number;
    unresolved: number;
    nodeTypeCounts: Array<{ type: string; label: string; count: number }>;
    edgeTypeCounts: Array<{ type: string; count: number }>;
    isLarge: boolean;
}

/** SAMPLE ExplorePage SPARSE_FOCUS_MESSAGE 한국어 번안(FR-034). */
const SPARSE_FOCUS_MESSAGE =
    '이 포커스에서는 최소한의 컨텍스트만 발견되었습니다. 프로세스에 모델링된 시스템·데이터 저장소·조직이 없거나, 현재 필터가 관련 노드를 숨기고 있을 수 있습니다.';
/** SAMPLE SPARSE_FOCUS_FULL_GRAPH_HINT 번안 — 대규모 그래프에서만 덧붙임. */
const SPARSE_FOCUS_LARGE_HINT = '활동 상세 모드를 사용하거나 관련 노드 필터를 켜 보세요.';

/** Annotation 외 포커스 불가 유형의 안내 사유(FR-029). */
const NON_FOCUSABLE_REASON = '이 노드 유형은 포커스 대상이 아닙니다. (프로세스/조직/공급사/시스템/데이터 저장소/프로젝트/매뉴얼만 지원)';

/** 개요 스코프 배너 문구(FR-028) — metadata.isSample 기반. */
const SCOPE_NOTE_SAMPLE = '샘플 그래프 범위 기준 — 일부 프로세스 정의만 포함된 통계입니다.';
const SCOPE_NOTE_FULL = '전체 그래프 기준 — 로드된 모든 프로세스 정의를 포함한 통계입니다.';

/** data-model §3.1 검토 상태 6종 — update-status 페이로드 검증용. */
const WORKFLOW_STATUS_VALUES: ReadonlyArray<InsightWorkflowStatus> = [
    'new',
    'reviewed',
    'accepted',
    'rejected',
    'needs_data',
    'action_created'
];

/* ── 순수 헬퍼 ─────────────────────────────────────────────────────────── */

function stripPrefix(id: string, prefix: string): string {
    return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

function readIdString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
}

/**
 * canonical 노드 → 레거시 투영 노드 ID(legacyOntologyMapper 의 ID 규칙과 동일).
 * 축 값(dimensions)을 canonical 노드에 역-부여하기 위해 사용한다.
 */
function legacyIdForNode(node: GraphNode): string | null {
    switch (node.type) {
        case 'ProcessActivity':
            return `task:${stripPrefix(node.id, 'Activity:')}`;
        case 'Organization':
            return `role:${readIdString(node.properties.organizationId) ?? stripPrefix(node.id, 'Organization:')}`;
        case 'System':
            return `system:${stripPrefix(node.id, 'System:')}`;
        case 'DataStore':
            return `data:${stripPrefix(node.id, 'DataStore:')}`;
        case 'DataObject':
            return `data:${stripPrefix(node.id, 'DataObject:')}`;
        default:
            return null;
    }
}

/** contextSlicer.nodeAxisValue 이식 — 축 키를 레거시 dimensions 필드에 매핑. */
function axisValueOf(dimensions: OntologyDimensions, axisKey: string): string | undefined {
    switch (axisKey) {
        case 'org':
            return dimensions.orgName;
        case 'system':
            return dimensions.system;
        case 'lifecycle':
            return dimensions.lifecycle;
        default:
            return dimensions[axisKey];
    }
}

/** 라벨/표시명/원본명/ID 대상 대소문자 무시 부분 일치 검색. */
function nodeMatchesSearch(node: GraphNode, term: string): boolean {
    const t = term.trim().toLowerCase();
    if (!t) return true;
    if (node.label.toLowerCase().includes(t)) return true;
    const displayName = node.properties.displayName;
    if (typeof displayName === 'string' && displayName.toLowerCase().includes(t)) return true;
    const name = node.properties.name;
    if (typeof name === 'string' && name.toLowerCase().includes(t)) return true;
    return node.id.toLowerCase().includes(t);
}

/** contextSlicer.relatedWithinDepth 이식 — canonical 엣지 위 무방향 BFS(self-loop 제외). */
function relatedWithinDepth(edges: GraphEdge[], focusNodeId: string, depth: number): Set<string> {
    const adj = new Map<string, Set<string>>();
    const link = (a: string, b: string) => {
        if (!adj.has(a)) adj.set(a, new Set());
        adj.get(a)!.add(b);
    };
    for (const e of edges) {
        if (e.source === e.target) continue;
        link(e.source, e.target);
        link(e.target, e.source);
    }

    const visited = new Set<string>([focusNodeId]);
    let frontier = [focusNodeId];
    for (let d = 0; d < Math.max(0, depth); d++) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const nb of adj.get(id) || []) {
                if (!visited.has(nb)) {
                    visited.add(nb);
                    next.push(nb);
                }
            }
        }
        if (next.length === 0) break;
        frontier = next;
    }
    return visited;
}

/* ── Process 요약(SAMPLE NodeDetailPanel ProcessSummarySection 규칙) ──── */

interface SummaryListItem {
    id: string;
    label: string;
    activityCount?: number;
}

/** SAMPLE asSummaryList 번안 — 롤업 properties 배열(systems[] 등) 안전 파싱. */
function asSummaryList(value: unknown): SummaryListItem[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SummaryListItem => item != null && typeof item === 'object' && 'id' in item && 'label' in item);
}

function readNumericProperty(props: Record<string, unknown>, key: string): number | null {
    const raw = props[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
    return null;
}

function formatSummaryItem(item: SummaryListItem): string {
    return item.activityCount != null && item.activityCount > 0 ? `${item.label} (활동 ${item.activityCount}개)` : item.label;
}

/**
 * Process 노드 요약(FR-029) — SAMPLE NodeDetailPanel 규칙:
 * 롤업 카운트 properties(activityCount/systemCount 등) 우선, 없으면 파생(derived) 롤업
 * 엣지에서 재구성. 대표 목록은 항목별 최대 8개('외 N개'는 counts 대비 초과분).
 */
function buildProcessSummary(node: GraphNode, index: GraphIndex): { counts: Record<string, number>; lists: Record<string, string[]> } {
    const props = node.properties;
    const outgoing = index.outgoingByNodeId.get(node.id) ?? [];
    const rollups = outgoing.filter((edge) => edge.properties?.derived === true);

    const rollupList = (edgeType: EdgeType): SummaryListItem[] =>
        rollups
            .filter((edge) => edge.type === edgeType)
            .map((edge) => ({
                id: edge.target,
                label: getNodeLabel(index.nodesById.get(edge.target)) || edge.target,
                activityCount: Number(edge.properties?.activityCount ?? 0)
            }));

    const pick = (propKey: string, edgeType: EdgeType): SummaryListItem[] => {
        const fromProps = asSummaryList(props[propKey]);
        return fromProps.length > 0 ? fromProps : rollupList(edgeType);
    };

    const counts: Record<string, number> = {};
    const lists: Record<string, string[]> = {};

    // 구조 카운트 — hasActivity 대상의 Task/CallActivity 분해(SAMPLE countProcessStructure 동등)
    let taskCount = 0;
    let callActivityCount = 0;
    for (const edge of outgoing) {
        if (edge.type !== 'hasActivity') continue;
        const target = index.nodesById.get(edge.target);
        if (!target) continue;
        if (isCallActivityNode(target)) callActivityCount += 1;
        else taskCount += 1;
    }
    const activityCount = readNumericProperty(props, 'activityCount') ?? taskCount + callActivityCount;
    if (activityCount > 0) {
        counts['활동'] = activityCount;
        counts['Task'] = taskCount;
        counts['Call Activity'] = callActivityCount;
    }

    const sections: Array<{ key: string; countKey: string; items: SummaryListItem[] }> = [
        { key: '시스템', countKey: 'systemCount', items: pick('systems', 'usesSystem') },
        { key: '조직', countKey: 'organizationCount', items: pick('organizations', 'performedByOrganization') },
        { key: '공급사', countKey: 'supplierCount', items: pick('suppliers', 'performedBySupplier') },
        { key: '프로젝트', countKey: 'projectCount', items: pick('projects', 'relatedToProject') },
        { key: '데이터 저장소', countKey: 'dataStoreCount', items: pick('dataStores', 'referencesDataStore') },
        { key: '데이터 객체(사용)', countKey: 'dataObjectUsedCount', items: pick('dataObjectsUsed', 'usesDataObject') },
        { key: '데이터 객체(생성)', countKey: 'dataObjectProducedCount', items: pick('dataObjectsProduced', 'producesDataObject') }
    ];

    for (const section of sections) {
        const total = readNumericProperty(props, section.countKey) ?? section.items.length;
        if (total <= 0 && section.items.length === 0) continue;
        counts[section.key] = Math.max(total, section.items.length);
        if (section.items.length > 0) {
            lists[section.key] = section.items.slice(0, 8).map(formatSummaryItem);
        }
    }

    const manualCount = readNumericProperty(props, 'manualCount');
    if (manualCount != null && manualCount > 0) counts['매뉴얼'] = manualCount;
    const annotationCount = readNumericProperty(props, 'annotationCount');
    if (annotationCount != null && annotationCount > 0) counts['주석'] = annotationCount;

    return { counts, lists };
}

/* ── CQ 액션(노드 유형별) ──────────────────────────────────────────────── */

const GLOBAL_CQ_ACTIONS: CqAction[] = [
    { key: 'cq7', label: 'CQ7 수작업 전용 활동' },
    { key: 'cq8', label: 'CQ8 책임 미지정 활동' }
];

const CQ_ACTIONS_BY_TYPE: Partial<Record<NodeType, CqAction[]>> = {
    Process: [
        { key: 'cq1', label: 'CQ1 사용 시스템' },
        { key: 'cq3', label: 'CQ3 참여 조직' },
        { key: 'cq5', label: 'CQ5 참여 공급사' },
        { key: 'cq6', label: 'CQ6 참조 데이터저장소' }
    ],
    System: [
        { key: 'cq2', label: 'CQ2 사용 프로세스' },
        { key: 'impact-system', label: '단일 시스템 영향도' }
    ],
    Organization: [{ key: 'cq4', label: 'CQ4 수행 프로세스' }]
};

export function useOntologyGraph() {
    /* ── 핵심 상태 ── */
    const graph = shallowRef<ProcessGraph | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const viewMode = ref<ViewMode>('processOverview');

    const sliceState = reactive<KgSliceState>({
        activeFilters: {},
        visibleNodeTypes: getDefaultNodeTypesForView('processOverview'),
        visibleActivitySubtypes: new Set(DEFAULT_VISIBLE_ACTIVITY_SUBTYPES),
        searchTerm: '',
        focusNodeId: null,
        depth: DEFAULT_DEPTH,
        selectedNodeId: null
    });

    const entityFocus = ref<EntityFocusState>({ ...defaultEntityFocusState });

    const evidence = reactive<EvidenceState>({ active: false, insightId: null, subgraph: null });

    const activeInsight = shallowRef<InsightCard | null>(null);

    /* ── 그래프 소스 상태(FR-025) ── */
    const sourceState = reactive<GraphSourceState>({
        sources: [{ id: DEFAULT_SOURCE_ID, label: DEFAULT_SOURCE_LABEL, kind: 'proc-def' }],
        currentSourceId: DEFAULT_SOURCE_ID
    });
    const providers = new Map<string, GraphSourceProvider>();

    /* ── AI 내러티브 상태(카드 id 키, 온디맨드 캐시) ── */
    const narrativeById = ref<Record<string, string>>({});
    const narrativeLoadingById = ref<Record<string, boolean>>({});
    const narrativeErrorById = ref<Record<string, string | null>>({});

    /* ── 분석 레이어(eager 랭킹 + CQ 온디맨드 + 근거 캐시) ── */
    const analysis = useAnalysisCache(graph);

    /* ── 검토 워크플로·데이터 태스크(FR-026/027, 세션 메모리 한정) ── */
    const workflow = useInsightWorkflow();

    /* ── 인사이트 목록 표시 제한(Top 20/50, FR-033) ── */
    const displayLimit = ref<number>(20);

    /* ── 파생: 파스 리포트·메타데이터 ── */
    const parseReport = computed<ParseReport | null>(() => graph.value?.parseReport ?? null);
    const metadata = computed<GraphBuildMetadata | null>(() => graph.value?.metadata ?? null);
    const parseSummary = computed<{ warnings: number; unresolved: number; failedFiles: number } | null>(() => {
        const report = parseReport.value;
        if (!report) return null;
        return {
            warnings: report.warnings.length,
            unresolved: report.unresolvedReferences.length,
            failedFiles: report.failedFiles
        };
    });

    /* ── 파생: 레거시 축(우측 다차원 필터 하위 호환, FR-010) ── */
    const legacyGraph = computed(() => (graph.value ? toLegacyOntologyGraph(graph.value) : null));
    const dimensionAxes = computed<DimensionAxis[]>(() => legacyGraph.value?.dimensionAxes ?? []);

    /** canonical 노드 id → 레거시 dimensions(org/system/lifecycle 축 값). */
    const axisDimsByNodeId = computed<Map<string, OntologyDimensions>>(() => {
        const g = graph.value;
        const legacy = legacyGraph.value;
        const map = new Map<string, OntologyDimensions>();
        if (!g || !legacy) return map;
        const legacyById = new Map(legacy.nodes.map((n) => [n.id, n]));
        for (const node of g.nodes) {
            const legacyId = legacyIdForNode(node);
            if (!legacyId) continue;
            const legacyNode = legacyById.get(legacyId);
            if (legacyNode) map.set(node.id, legacyNode.dimensions);
        }
        return map;
    });

    const nodeById = computed(() => new Map((graph.value?.nodes ?? []).map((n) => [n.id, n] as const)));
    const edgeById = computed(() => new Map((graph.value?.edges ?? []).map((e) => [e.id, e] as const)));

    const selectedNode = computed<GraphNode | null>(() =>
        sliceState.selectedNodeId ? nodeById.value.get(sliceState.selectedNodeId) ?? null : null
    );

    /* ── 가시성 파이프라인(data-model.md §3 순서) ── */
    const renderComputation = computed<RenderComputation>(() => {
        const g = graph.value;
        if (!g) return { nodes: [], edges: [], blocked: { blocked: false } };

        const focus = entityFocus.value;

        // 1) evidence 모드 — 근거 서브그래프만 배타 렌더(fade 아님, 그 외 제거)
        if (evidence.active && evidence.subgraph) {
            const { nodeIds, edgeIds } = evidence.subgraph;
            const nodes = g.nodes.filter((n) => nodeIds.has(n.id));
            const edges = g.edges.filter((e) => edgeIds.has(e.id) && nodeIds.has(e.source) && nodeIds.has(e.target));
            return { nodes, edges, blocked: { blocked: false, visibleCount: nodes.length } };
        }

        // 2) 엔터티 포커스 — 의미 기반 서브그래프(파생 focus 엣지 포함)를 이후 단계의 베이스로 사용
        const focused = buildFocusedSubgraph(g, focus, viewMode.value);
        const base = focused.active
            ? { nodes: g.nodes.filter((n) => focused.nodeIds.has(n.id)), edges: focused.focusEdges }
            : { nodes: g.nodes, edges: g.edges };

        // 4~5, 7) 뷰 모드 화이트리스트 + 노드 타입 토글 + 검색(applyViewModeFilters 일괄)
        const { visibleNodeIds, visibleEdges } = applyViewModeFilters(
            base,
            viewMode.value,
            sliceState.visibleNodeTypes,
            sliceState.visibleActivitySubtypes,
            sliceState.searchTerm,
            nodeMatchesSearch
        );

        // 6) 다차원 축 필터(레거시 의미: 축 간 AND·축 내 OR, 축 값 없는 노드는 해당 축에서 제외)
        const activeAxes = Object.entries(sliceState.activeFilters).filter(([, vals]) => vals && vals.length > 0);
        let nodeIds = visibleNodeIds;
        let edges = visibleEdges;
        if (activeAxes.length > 0) {
            const dims = axisDimsByNodeId.value;
            nodeIds = new Set(
                [...visibleNodeIds].filter((id) => {
                    const nodeDims = dims.get(id);
                    return activeAxes.every(([axisKey, vals]) => {
                        const v = nodeDims ? axisValueOf(nodeDims, axisKey) : undefined;
                        return v != null && vals.includes(v);
                    });
                })
            );
            edges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
        }

        const nodes = base.nodes.filter((n) => nodeIds.has(n.id));

        // 3) 렌더 가드 — 필터 적용 후 "최종 가시 노드 수"로만 판정(샘플 의미론).
        //    총 노드 수로 진입을 차단하지 않는다: 기본 프로세스 개요 뷰는 대형 테넌트에서도
        //    가시 노드가 상한 이하라 즉시 렌더되고, 활동 상세/전체 뷰에서 상한 초과 시에만 안내.
        const postGuard = shouldRenderGraph({
            source: { isLarge: false },
            focus: { entityIds: focus.entityIds },
            evidenceMode: false,
            visibleNodeCount: nodes.length
        });
        if (!postGuard.canRender) {
            return {
                nodes: [],
                edges: [],
                blocked: { blocked: true, reason: postGuard.reason, visibleCount: nodes.length }
            };
        }

        return { nodes, edges, blocked: { blocked: false, visibleCount: nodes.length } };
    });

    const renderNodes = computed<GraphNode[]>(() => renderComputation.value.nodes);
    const renderEdges = computed<GraphEdge[]>(() => renderComputation.value.edges);
    const renderBlocked = computed<RenderBlockedState>(() => renderComputation.value.blocked);

    // 8) focus+Depth fade — 파이프라인 마지막(불투명도만 조정, 노드 제거 없음)
    const visibilityMap = computed<Record<string, { visible: boolean; opacity: number }>>(() => {
        const { nodes, edges } = renderComputation.value;
        const map: Record<string, { visible: boolean; opacity: number }> = {};
        const focusId = sliceState.focusNodeId;
        // focus 노드가 현재 렌더 집합에 없으면(뷰 전환/필터로 제외) fade 미적용 —
        // 전부 fade되어 빈 화면처럼 보이는 상태를 방지한다.
        if (!focusId || !nodes.some((n) => n.id === focusId)) {
            for (const n of nodes) map[n.id] = { visible: true, opacity: 1 };
            return map;
        }
        const related = relatedWithinDepth(edges, focusId, sliceState.depth);
        for (const n of nodes) {
            const visible = related.has(n.id);
            map[n.id] = { visible, opacity: visible ? 1 : FADE_OPACITY };
        }
        return map;
    });

    /* ── 파생: 우측 패널 옵션들 ── */
    const nodeTypeOptions = computed<NodeTypeOption[]>(() => {
        const g = graph.value;
        if (!g) return [];
        const counts = new Map<NodeType, number>();
        for (const n of g.nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => ({
                type,
                label: labelForNodeType(type),
                color: colorForNodeType(type),
                count
            }));
    });

    const entityOptions = computed<EntityOption[]>(() => {
        const g = graph.value;
        const type = entityFocus.value.entityType;
        if (!g || !type) return [];
        return getEntityOptions(g, type);
    });

    /* ── 파생: 인사이트/위험 ── */
    const insightsByCategory = computed<Record<string, InsightCard[]>>(() => ({
        bottleneck: analysis.bottleneckInsights.value,
        system_impact: analysis.systemBlastRadiusInsights.value,
        organization_coordination: analysis.organizationCoordinationInsights.value,
        cross_org_handoff: analysis.crossOrgHandoffHotspots.value,
        automation: analysis.automationCandidates.value,
        redesign: analysis.redesignRecommendations.value,
        enrichment: analysis.enrichmentRecommendations.value,
        reasoning_readiness: analysis.reasoningReadinessInsights.value,
        modeling_quality: analysis.modelingQualityInsights.value,
        spof: analysis.spofInsights.value
    }));

    /** SPOF 펄스용 — 캔버스 props 형태(Record)로 변환. */
    const riskNodeIdRecord = computed<Record<string, SpofRiskType>>(() => {
        const record: Record<string, SpofRiskType> = {};
        for (const [nodeId, riskType] of analysis.riskNodeIds.value) record[nodeId] = riskType;
        return record;
    });

    /* ── 파생: 선택 노드 유형별 CQ 버튼(전역 CQ7/8은 미선택 시) ── */
    const cqActionsForSelected = computed<CqAction[]>(() => {
        const node = selectedNode.value;
        if (!node) return GLOBAL_CQ_ACTIONS;
        return CQ_ACTIONS_BY_TYPE[node.type] ?? [];
    });

    /* ── 파생: 활성 인사이트의 내러티브 상태(콘솔 pass-through) ── */
    const activeNarrative = computed<string | null>(() => {
        const card = activeInsight.value;
        if (!card) return null;
        return narrativeById.value[card.id] ?? card.narrative ?? null;
    });
    const activeNarrativeLoading = computed<boolean>(() => {
        const card = activeInsight.value;
        return card ? Boolean(narrativeLoadingById.value[card.id]) : false;
    });
    const activeNarrativeError = computed<string | null>(() => {
        const card = activeInsight.value;
        return card ? narrativeErrorById.value[card.id] ?? null : null;
    });

    /* ── 파생: 검토 워크플로(FR-026) ── */

    /** InsightListPanel 상태 점용 — insightId → status(미기록은 'new' 간주라 미포함). */
    const workflowStatuses = computed<Record<string, string>>(() => {
        const record: Record<string, string> = {};
        for (const [id, entry] of Object.entries(workflow.statusById.value)) record[id] = entry.status;
        return record;
    });

    /** 콘솔 고정 카드의 검토 상태(InsightCardView workflowStatus prop). */
    const activeInsightStatus = computed<InsightWorkflowStatus>(() => {
        const card = activeInsight.value;
        if (!card) return 'new';
        return workflow.statusById.value[card.id]?.status ?? 'new';
    });

    /* ── 파생: 대규모 그래프 여부(렌더 가드 상한 기준, FR-033) ── */
    const largeGraph = computed<boolean>(() => (graph.value?.nodes.length ?? 0) > MAX_VISIBLE_NODES);

    /* ── 파생: 개요(Overview) 통계·Top 인사이트(FR-028) ── */
    const overviewStats = computed<OverviewStats>(() =>
        computeOverviewStats(graph.value, insightsByCategory.value, workflow.openTaskCount.value)
    );
    const overviewSections = computed<TopInsightSection[]>(() => buildTopInsightSections(insightsByCategory.value));
    const overviewScopeNote = computed<string | null>(() => {
        if (!graph.value) return null;
        return metadata.value?.isSample ? SCOPE_NOTE_SAMPLE : SCOPE_NOTE_FULL;
    });

    /* ── 파생: 그래프 요약(FR-032 — WhatIfSimulatorPanel summary) ── */
    const graphSummary = computed<GraphSummaryView | null>(() => {
        const g = graph.value;
        if (!g) return null;
        let processes = 0;
        for (const node of g.nodes) {
            if (node.type === 'Process') processes += 1;
        }
        const edgeCounts = new Map<string, number>();
        for (const edge of g.edges) edgeCounts.set(edge.type, (edgeCounts.get(edge.type) ?? 0) + 1);
        return {
            models: g.models.length,
            processes,
            nodes: g.nodes.length,
            edges: g.edges.length,
            warnings: g.parseReport.warnings.length,
            unresolved: g.parseReport.unresolvedReferences.length,
            nodeTypeCounts: nodeTypeOptions.value.map(({ type, label, count }) => ({ type, label, count })),
            edgeTypeCounts: [...edgeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
            isLarge: largeGraph.value
        };
    });

    /* ── 파생: 희소 포커스 안내(FR-034 — SAMPLE ExplorePage sparse 규칙) ── */
    const sparseFocus = computed<SparseFocusState>(() => {
        if (evidence.active) return { active: false, message: null };
        if (!isEntityFocusActive(entityFocus.value)) return { active: false, message: null };
        const { nodes, edges, blocked } = renderComputation.value;
        if (blocked.blocked) return { active: false, message: null };

        const contextNodeCount = nodes.reduce((count, node) => (PROCESS_CONTEXT_NODE_TYPES.has(node.type) ? count + 1 : count), 0);
        if (contextNodeCount > 0 || edges.length > 1) return { active: false, message: null };

        const message = largeGraph.value ? `${SPARSE_FOCUS_MESSAGE} ${SPARSE_FOCUS_LARGE_HINT}` : SPARSE_FOCUS_MESSAGE;
        return { active: true, message };
    });

    /* ── 파생: 선택 노드 컨텍스트(FR-029 — AiReasoningConsole NodeContext 계약) ── */
    const nodeContext = computed<NodeContextView | null>(() => {
        const node = selectedNode.value;
        const index = analysis.graphIndex.value;
        if (!node || !index) return null;

        const incomingEdges = index.incomingByNodeId.get(node.id) ?? [];
        const outgoingEdges = index.outgoingByNodeId.get(node.id) ?? [];

        const toEdgeView = (edge: GraphEdge, counterpartId: string): NodeContextEdgeView => {
            const view: NodeContextEdgeView = {
                type: edge.type,
                counterpartLabel: getNodeLabel(index.nodesById.get(counterpartId)) || counterpartId,
                derived: edge.properties?.derived === true
            };
            const rawCount = edge.properties?.activityCount;
            const count = Number(rawCount);
            if (rawCount != null && Number.isFinite(count)) view.activityCount = count;
            return view;
        };

        // CallActivity 드릴다운 — 부모 Process(containsElement/hasActivity 역추적) + invokes(callsProcessModel)
        let callActivity: NodeContextView['callActivity'] = null;
        if (isCallActivityNode(node)) {
            const parentEdge = incomingEdges.find(
                (edge) =>
                    (edge.type === 'hasActivity' || edge.type === 'containsElement') && index.nodesById.get(edge.source)?.type === 'Process'
            );
            const parent = parentEdge ? index.nodesById.get(parentEdge.source) ?? null : null;
            const invokes = outgoingEdges
                .filter((edge) => edge.type === 'callsProcessModel')
                .map((edge) => {
                    const model = index.nodesById.get(edge.target);
                    // 포커스는 Process 유형만 지원 — 모델이 정의(definesProcess)하는 Process로 해석
                    const definesEdge = (index.outgoingByNodeId.get(edge.target) ?? []).find(
                        (candidate) => candidate.type === 'definesProcess'
                    );
                    const childProcess = definesEdge ? index.nodesById.get(definesEdge.target) : undefined;
                    return {
                        label: getNodeLabel(model) || edge.target,
                        focusNodeId: childProcess && childProcess.type === 'Process' ? childProcess.id : null
                    };
                });
            const definitionId = node.properties.definitionId;
            callActivity = {
                parentProcessLabel: parent ? getNodeLabel(parent) : null,
                parentFocusNodeId: parent ? parent.id : null,
                invokes,
                definitionId: typeof definitionId === 'string' && definitionId.trim() !== '' ? definitionId : null
            };
        }

        // 포커스 액션 가능 여부(SAMPLE NodeDetailPanel 규칙 — Annotation 사유 포함)
        const canFocus = createFocusStateForNode(node) != null;
        const focusState = entityFocus.value;
        const canAddToFocus =
            isEntityFocusActive(focusState) &&
            focusState.entityType === node.type &&
            !focusState.entityIds.includes(node.id) &&
            addNodeToCurrentFocus(focusState, node) != null;
        const disabledReason = canFocus ? undefined : node.type === 'Annotation' ? ANNOTATION_FOCUS_DISABLED_REASON : NON_FOCUSABLE_REASON;

        const context: NodeContextView = {
            incoming: incomingEdges.slice(0, 10).map((edge) => toEdgeView(edge, edge.source)),
            outgoing: outgoingEdges.slice(0, 10).map((edge) => toEdgeView(edge, edge.target)),
            incomingTotal: incomingEdges.length,
            outgoingTotal: outgoingEdges.length,
            processSummary: node.type === 'Process' ? buildProcessSummary(node, index) : null,
            callActivity,
            rawPropertiesJson: JSON.stringify(node.properties, null, 2),
            focus: { canFocus, canAddToFocus }
        };
        if (disabledReason) context.focus.disabledReason = disabledReason;
        return context;
    });

    /* ── 액션: 소스/로드 ── */

    /** 소스 전환·재로드 시 파생 상태 전체 초기화(FR-025). */
    function resetDerivedState() {
        sliceState.activeFilters = {};
        sliceState.visibleNodeTypes = getDefaultNodeTypesForView(viewMode.value);
        sliceState.visibleActivitySubtypes = new Set(DEFAULT_VISIBLE_ACTIVITY_SUBTYPES);
        sliceState.searchTerm = '';
        sliceState.focusNodeId = null;
        sliceState.depth = DEFAULT_DEPTH;
        sliceState.selectedNodeId = null;
        entityFocus.value = { ...defaultEntityFocusState };
        exitEvidence();
        activeInsight.value = null;
        narrativeById.value = {};
        narrativeLoadingById.value = {};
        narrativeErrorById.value = {};
        // 검토 상태·데이터 태스크는 세션 메모리 한정 — 그래프/소스 교체 시 전체 초기화(FR-025/026)
        workflow.reset();
        displayLimit.value = 20;
    }

    async function loadFromProvider(provider: GraphSourceProvider) {
        loading.value = true;
        error.value = null;
        try {
            const g = await provider.load();
            resetDerivedState();
            graph.value = g;
        } catch (e: any) {
            error.value = e?.message || '그래프 로드에 실패했습니다.';
            resetDerivedState();
            graph.value = null;
        } finally {
            loading.value = false;
        }
    }

    /** proc-def 소스 로드(초기 진입·재로드). procDefIds 미지정 시 테넌트 전체 정의. */
    async function loadGraph(procDefIds?: string[]) {
        const provider = new ProcDefGraphSource({
            id: DEFAULT_SOURCE_ID,
            label: DEFAULT_SOURCE_LABEL,
            procDefIds
        });
        providers.set(provider.id, provider);
        sourceState.currentSourceId = provider.id;
        await loadFromProvider(provider);
    }

    /**
     * 그래프 소스 전환 — 등록된 소스 id 또는 아티팩트(url/file) 지정.
     * 전환 시 파생 상태 전체 초기화 후 재계산(FR-025).
     */
    async function switchSource(target: SwitchSourceTarget) {
        if ('artifact' in target) {
            const provider = new ArtifactGraphSource({
                url: target.artifact.url,
                file: target.artifact.file
            });
            providers.set(provider.id, provider);
            const descriptor: GraphSource = {
                id: provider.id,
                label: provider.label,
                kind: 'artifact',
                url: target.artifact.url
            };
            const others = sourceState.sources.filter((s) => s.kind !== 'artifact');
            sourceState.sources = [...others, descriptor];
            sourceState.currentSourceId = provider.id;
            await loadFromProvider(provider);
            return;
        }

        let provider = providers.get(target.id);
        if (!provider && target.id === DEFAULT_SOURCE_ID) {
            provider = new ProcDefGraphSource({ id: DEFAULT_SOURCE_ID, label: DEFAULT_SOURCE_LABEL });
            providers.set(provider.id, provider);
        }
        if (!provider) {
            error.value = `알 수 없는 그래프 소스입니다: ${target.id}`;
            return;
        }
        sourceState.currentSourceId = provider.id;
        await loadFromProvider(provider);
    }

    /* ── 액션: 뷰 모드/필터/검색/포커스 ── */

    /** 뷰 모드 전환 — 노드 타입 토글을 해당 뷰 기본 집합으로 리셋. */
    function setViewMode(mode: ViewMode) {
        viewMode.value = mode;
        sliceState.visibleNodeTypes = getDefaultNodeTypesForView(mode);
        sliceState.visibleActivitySubtypes = new Set(DEFAULT_VISIBLE_ACTIVITY_SUBTYPES);
    }

    function setFilters(activeFilters: Record<string, string[]>) {
        sliceState.activeFilters = { ...activeFilters };
    }

    function setNodeTypes(types: Array<NodeType | string>) {
        sliceState.visibleNodeTypes = new Set(types as NodeType[]);
    }

    function setSearch(term: string) {
        sliceState.searchTerm = term;
    }

    function setEntityFocus(focus: EntityFocusState) {
        entityFocus.value = { ...focus, entityIds: [...new Set(focus.entityIds)] };
    }

    function clearFocus() {
        entityFocus.value = { ...defaultEntityFocusState };
    }

    /** 활동 서브타입(Task/CallActivity) 토글 갱신 — 파이프라인(applyViewModeFilters)이 소비(FR-030). */
    function setActivitySubtypes(subtypes: Array<ActivityUiSubtype | string>) {
        sliceState.visibleActivitySubtypes = new Set(subtypes as ActivityUiSubtype[]);
    }

    /** 선택 노드를 단독 포커스로 전환(FR-029 — createFocusStateForNode). 성공 여부 반환. */
    function focusSelectedNode(): boolean {
        const node = selectedNode.value;
        if (!node) return false;
        const focus = createFocusStateForNode(node);
        if (!focus) return false;
        setEntityFocus(focus);
        return true;
    }

    /** 선택 노드를 현재 포커스에 추가(같은 유형·미포함일 때만). 성공 여부 반환. */
    function addSelectedToFocus(): boolean {
        const node = selectedNode.value;
        if (!node) return false;
        const next = addNodeToCurrentFocus(entityFocus.value, node);
        if (!next) return false;
        setEntityFocus(next);
        return true;
    }

    /** 지정 노드 id 를 단독 포커스로 전환(콜 액티비티 부모/자식 드릴다운). 성공 여부 반환. */
    function focusEntity(nodeId: string): boolean {
        const node = nodeById.value.get(nodeId);
        if (!node) return false;
        const focus = createFocusStateForNode(node);
        if (!focus) return false;
        setEntityFocus(focus);
        return true;
    }

    /* ── 액션: 선택/focus+Depth(001 의미 유지) ── */

    /** 노드 선택 → 콘솔 연동. SPOF 위험 노드면 해당 spof 카드를 콘솔에 고정(001 UX 계승). */
    function selectNode(nodeId: string | null) {
        sliceState.selectedNodeId = nodeId;
        if (!nodeId) return;
        if (analysis.riskNodeIds.value.has(nodeId)) {
            const spofCard = analysis.spofInsights.value.find((card) => card.metrics?.nodeId === nodeId);
            if (spofCard) activeInsight.value = spofCard;
        }
    }

    /** 선택·focus 일괄 해제(배경 클릭/ESC/해제 버튼). */
    function clearSelection() {
        sliceState.selectedNodeId = null;
        sliceState.focusNodeId = null;
    }

    function setFocus(nodeId: string | null) {
        sliceState.focusNodeId = nodeId;
    }

    function setDepth(depth: number) {
        sliceState.depth = Math.min(6, Math.max(0, Math.round(depth)));
    }

    /* ── 액션: 인사이트/CQ/근거 ── */

    function selectInsight(card: InsightCard) {
        activeInsight.value = card;
    }

    /** 인사이트 목록 표시 제한 토글(Top 20/50, FR-033). */
    function setDisplayLimit(n: number) {
        displayLimit.value = n >= 50 ? 50 : 20;
    }

    /** 카드 검토 상태 변경(FR-026) — data-model §3.1 리터럴만 허용. */
    function updateInsightStatus(card: InsightCard, status: string) {
        if ((WORKFLOW_STATUS_VALUES as readonly string[]).includes(status)) {
            workflow.setStatus(card.id, status as InsightWorkflowStatus);
        }
    }

    /**
     * enrichment 카드에서 데이터 태스크 생성(FR-027) — 생성 시 'action_created' 전이.
     * 생성된 태스크(또는 비 enrichment 카드면 null)를 반환해 우측 태스크 탭 유도 신호로 사용.
     */
    function createDataTask(card: InsightCard): DataTask | null {
        return workflow.createTaskFromInsight(card);
    }

    /** 데이터 태스크 상태 변경(열림/진행 중/완료, FR-027). */
    function updateTaskStatus(taskId: string, status: DataTaskStatus) {
        workflow.updateTaskStatus(taskId, status);
    }

    /** CQ 온디맨드 동기 실행 → 결과 카드를 콘솔에 표시. */
    function runCq(key: string) {
        if (!graph.value) return;
        const nodeId = sliceState.selectedNodeId;
        try {
            let card: InsightCard | null = null;
            switch (key) {
                case 'cq1':
                    if (nodeId) card = analysis.answerSystemsUsedByProcess(nodeId);
                    break;
                case 'cq2':
                    if (nodeId) card = analysis.answerProcessesUsingSystem(nodeId);
                    break;
                case 'cq3':
                    if (nodeId) card = analysis.answerOrganizationsInvolvedInProcess(nodeId);
                    break;
                case 'cq4':
                    if (nodeId) card = analysis.answerProcessesInvolvingOrganization(nodeId);
                    break;
                case 'cq5':
                    if (nodeId) card = analysis.answerSuppliersInvolvedInProcess(nodeId);
                    break;
                case 'cq6':
                    if (nodeId) card = analysis.answerDataStoresReferencedByProcess(nodeId);
                    break;
                case 'cq7':
                    card = analysis.answerManualOnlyActivities();
                    break;
                case 'cq8':
                    card = analysis.answerActivitiesWithoutResponsibility();
                    break;
                case 'impact-system':
                    if (nodeId) card = analysis.analyzeSingleSystemImpact(nodeId);
                    break;
                default:
                    break;
            }
            if (card) activeInsight.value = card;
        } catch (e) {
            // CQ는 결정론 동기 분석 — 실패는 방어적 로그만(그래프 미로드 등)
            console.error('[useOntologyGraph] CQ 실행 실패:', key, e);
        }
    }

    /** 근거 모드 진입 — 근거 서브그래프만 배타 렌더 + 카드 콘솔 고정. */
    function enterEvidence(card: InsightCard) {
        const subgraph = analysis.getEvidenceSubgraph(card);
        evidence.subgraph = { nodeIds: subgraph.nodeIds, edgeIds: subgraph.edgeIds };
        evidence.insightId = card.id;
        evidence.active = true;
        activeInsight.value = card;
    }

    function exitEvidence() {
        evidence.active = false;
        evidence.insightId = null;
        evidence.subgraph = null;
    }

    /* ── 액션: AI 내러티브(qdrantChat 전용, 온디맨드 + 캐시) ── */

    function buildEvidenceLabels(card: InsightCard): { nodes: string[]; edges: string[] } {
        const nodes = card.evidence.nodeIds.slice(0, 25).map((id) => nodeById.value.get(id)?.label ?? id);
        const edges = card.evidence.edgeIds.slice(0, 40).map((id) => {
            const edge = edgeById.value.get(id);
            if (!edge) return id;
            const source = nodeById.value.get(edge.source)?.label ?? edge.source;
            const target = nodeById.value.get(edge.target)?.label ?? edge.target;
            return `${source} -[${edge.type}]-> ${target}`;
        });
        return { nodes, edges };
    }

    /** 카드 1건 AI 해설 생성(캐시 적중 시 재호출 없음, 실패 시 오류 노출 + 재시도 가능). */
    async function ensureNarrative(card: InsightCard) {
        const g = graph.value;
        if (!g) return;
        if (narrativeById.value[card.id] || card.narrative) {
            narrativeErrorById.value = { ...narrativeErrorById.value, [card.id]: null };
            return;
        }
        if (narrativeLoadingById.value[card.id]) return;

        narrativeLoadingById.value = { ...narrativeLoadingById.value, [card.id]: true };
        narrativeErrorById.value = { ...narrativeErrorById.value, [card.id]: null };
        try {
            const text = await generateInsightNarrative(card, {
                graphSummary: {
                    nodeCount: g.nodes.length,
                    edgeCount: g.edges.length,
                    sourceLabel: g.metadata?.sourceLabel ?? DEFAULT_SOURCE_LABEL
                },
                evidenceLabels: buildEvidenceLabels(card)
            });
            narrativeById.value = { ...narrativeById.value, [card.id]: text };
            card.narrative = text; // 카드 캐시(ai-narrative.contract §3) — 그래프 재로드 시 무효화
        } catch (e: any) {
            narrativeErrorById.value = {
                ...narrativeErrorById.value,
                [card.id]: e?.message || 'AI 해설 생성에 실패했습니다.'
            };
        } finally {
            narrativeLoadingById.value = { ...narrativeLoadingById.value, [card.id]: false };
        }
    }

    /* ── 액션: 종합 리포트(결정론 마크다운, AI 미포함) ── */

    function buildReport(): string {
        const g = graph.value;
        if (!g) return '';
        return generateAnalysisReportMarkdown(g, {
            isSampleGraph: g.metadata?.isSample ?? false,
            graphIndex: analysis.graphIndex.value ?? undefined
        });
    }

    return {
        // 핵심 상태
        graph,
        loading,
        error,
        viewMode,
        sliceState,
        entityFocus,
        evidence,
        activeInsight,
        sourceState,
        // 파생(뷰 출력)
        parseReport,
        parseSummary,
        metadata,
        dimensionAxes,
        renderNodes,
        renderEdges,
        renderBlocked,
        visibilityMap,
        nodeTypeOptions,
        entityOptions,
        insightsByCategory,
        riskNodeIdRecord,
        selectedNode,
        cqActionsForSelected,
        activeNarrative,
        activeNarrativeLoading,
        activeNarrativeError,
        nodeContext,
        sparseFocus,
        largeGraph,
        graphSummary,
        // 파생: 개요(FR-028)
        overviewStats,
        overviewSections,
        overviewScopeNote,
        // 검토 워크플로·데이터 태스크(FR-026/027)
        workflowStatuses,
        activeInsightStatus,
        displayLimit,
        getStatus: workflow.getStatus,
        setStatus: workflow.setStatus,
        dataTasks: workflow.dataTasks,
        createTaskFromInsight: workflow.createTaskFromInsight,
        openTaskCount: workflow.openTaskCount,
        // 액션
        loadGraph,
        switchSource,
        setViewMode,
        setFilters,
        setNodeTypes,
        setSearch,
        setEntityFocus,
        clearFocus,
        setActivitySubtypes,
        focusSelectedNode,
        addSelectedToFocus,
        focusEntity,
        selectNode,
        clearSelection,
        setFocus,
        setDepth,
        selectInsight,
        setDisplayLimit,
        updateInsightStatus,
        createDataTask,
        updateTaskStatus,
        runCq,
        enterEvidence,
        exitEvidence,
        ensureNarrative,
        buildReport
    };
}

export type UseOntologyGraph = ReturnType<typeof useOntologyGraph>;
