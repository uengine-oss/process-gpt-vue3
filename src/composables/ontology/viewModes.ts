/**
 * viewModes — 프로세스 지식그래프 뷰 모드 3종(개요/활동 상세/전체) 가시성 필터 (순수 함수).
 *
 * SAMPLE bpmn-process-kg `src/web/utils/viewModes.ts` 번안 (specs/002 T020).
 *  - processOverview: Process ↔ 롤업 대상(System/Organization/Supplier/…) 화이트리스트만 표시
 *  - activityDetail:  + ProcessActivity/Gateway/Event/Lane, isFollowedBy 흐름 표시
 *  - full:            제한 없음(전체 기술 그래프)
 *
 * 자체 완결 모듈 유지를 위해 SAMPLE 의존 헬퍼도 함께 포팅했다:
 *  - activitySubtype:            isCallActivityNode / nodeMatchesActivitySubtypeFilter
 *  - processContext:             isProcessContextNode (컨텍스트 노드 화이트리스트)
 *  - dataObjectEdgeAggregation:  aggregateProcessOverviewDataEdges (개요 뷰 uses/produces 집계)
 *
 * Vue 반응성 없음 — 프레임워크 독립 순수 함수만 export 한다.
 */
import type { EdgeType, GraphEdge, GraphNode, NodeType } from '@/lib/processKg/graph/types';

export type ViewMode = 'processOverview' | 'activityDetail' | 'full';

// ---------------------------------------------------------------------------
// 활동 서브타입 필터 (SAMPLE src/web/utils/activitySubtype.ts 발췌 포팅)
// ---------------------------------------------------------------------------

export type ActivityUiSubtype = 'Task' | 'CallActivity';

export const DEFAULT_VISIBLE_ACTIVITY_SUBTYPES: Set<ActivityUiSubtype> = new Set([
    'Task',
    'CallActivity',
]);

/** callActivity(하위 프로세스 호출) 성격의 활동 노드인지 판정. */
export function isCallActivityNode(node: GraphNode): boolean {
    if (node.type !== 'ProcessActivity') return false;
    const props = node.properties;
    if (props.bpmnType === 'callActivity') return true;
    if (props.activityKind === 'process_call') return true;
    if (props.isCallReference === true) return true;
    const definitionId = props.definitionId;
    return typeof definitionId === 'string' && definitionId.trim().length > 0;
}

/** ProcessActivity 노드의 UI 서브타입(Task | CallActivity). 활동 노드가 아니면 null. */
export function getActivityUiSubtype(node: GraphNode): ActivityUiSubtype | null {
    if (node.type !== 'ProcessActivity') return null;
    return isCallActivityNode(node) ? 'CallActivity' : 'Task';
}

/** 활동 서브타입 토글 필터 통과 여부. 활동 노드가 아니면 항상 통과. */
export function nodeMatchesActivitySubtypeFilter(
    node: GraphNode,
    visibleSubtypes: Set<ActivityUiSubtype>,
): boolean {
    const subtype = getActivityUiSubtype(node);
    if (!subtype) return true;
    return visibleSubtypes.has(subtype);
}

// ---------------------------------------------------------------------------
// 프로세스 컨텍스트 판정 (SAMPLE src/web/utils/processContext.ts 발췌 포팅)
// ---------------------------------------------------------------------------

export const PROCESS_CONTEXT_NODE_TYPES = new Set<NodeType>([
    'System',
    'Organization',
    'Supplier',
    'DataStore',
    'DataObject',
    'Manual',
    'Project',
]);

/** 프로세스 개요 뷰에서 Process 와 직접 연결해 보여줄 컨텍스트 노드인지 판정. */
export function isProcessContextNode(node: GraphNode | undefined): boolean {
    return node != null && PROCESS_CONTEXT_NODE_TYPES.has(node.type);
}

// ---------------------------------------------------------------------------
// 뷰 모드별 노드/엣지 화이트리스트
// ---------------------------------------------------------------------------

const PROCESS_OVERVIEW_NODE_TYPES: NodeType[] = [
    'ProcessModel',
    'Process',
    'System',
    'Organization',
    'Supplier',
    'Project',
    'Manual',
    'DataStore',
    'DataObject',
];

const ACTIVITY_DETAIL_NODE_TYPES: NodeType[] = [
    'ProcessModel',
    'Process',
    'ProcessActivity',
    'Gateway',
    'Event',
    'Lane',
    'System',
    'DataStore',
    'DataObject',
    'Manual',
    'Organization',
    'Supplier',
    'Project',
];

const PROCESS_OVERVIEW_EDGE_TYPES = new Set<EdgeType>([
    'usesSystem',
    'performedByOrganization',
    'performedBySupplier',
    'relatedToProject',
    'hasManual',
    'referencesDataStore',
    'usesDataObject',
    'producesDataObject',
    'hasAnnotation',
    'definesProcess',
    'invokesSubprocess',
]);

const ACTIVITY_DETAIL_EDGE_TYPES = new Set<EdgeType>([
    'hasActivity',
    'isFollowedBy',
    'assignedToLane',
    'usesSystem',
    'referencesDataStore',
    'usesDataObject',
    'producesDataObject',
    'hasManual',
    'hasAnnotation',
    'performedByOrganization',
    'performedBySupplier',
    'relatedToProject',
    'containsElement',
    'hasLane',
    'definesProcess',
    'callsProcessModel',
]);

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
    processOverview: 'Process Overview',
    activityDetail: 'Activity Detail',
    full: 'Full Technical Graph',
};

/** 뷰 모드 기본 노드 타입 집합(우측 패널 타입 토글의 초기값). */
export function getDefaultNodeTypesForView(viewMode: ViewMode): Set<NodeType> {
    switch (viewMode) {
        case 'processOverview':
            return new Set(PROCESS_OVERVIEW_NODE_TYPES);
        case 'activityDetail':
            return new Set(ACTIVITY_DETAIL_NODE_TYPES);
        default:
            return new Set([
                ...PROCESS_OVERVIEW_NODE_TYPES,
                ...ACTIVITY_DETAIL_NODE_TYPES,
                'Participant',
                'SequenceFlow',
                'Gateway',
                'Event',
                'Lane',
                'FTEProfile',
                'CostProfile',
            ]);
    }
}

export function viewModeSupportsActivityNodes(viewMode: ViewMode): boolean {
    return viewMode === 'activityDetail' || viewMode === 'full';
}

/** 뷰 모드 기준 노드 표시 여부 — 개요 뷰에서는 ProcessActivity 를 항상 숨긴다. */
export function nodeVisibleInViewMode(
    node: GraphNode,
    viewMode: ViewMode,
    visibleActivitySubtypes: Set<ActivityUiSubtype>,
): boolean {
    if (node.type !== 'ProcessActivity') return true;
    if (!viewModeSupportsActivityNodes(viewMode)) return false;
    return nodeMatchesActivitySubtypeFilter(node, visibleActivitySubtypes);
}

/** 뷰 모드 기준 엣지 표시 여부(노드 가시성 통과를 전제로 호출). */
export function edgeVisibleInView(
    edge: GraphEdge,
    viewMode: ViewMode,
    nodesById: Map<string, GraphNode>,
): boolean {
    if (viewMode === 'full') return true;

    const sourceType = nodesById.get(edge.source)?.type;

    if (viewMode === 'processOverview') {
        if (edge.type === 'definesProcess') {
            return false;
        }
        if (edge.type === 'containsElement') {
            const target = nodesById.get(edge.target);
            return (
                nodesById.get(edge.source)?.type === 'Process' && isProcessContextNode(target)
            );
        }
        if (edge.properties?.focusDerived === true) {
            return (
                nodesById.get(edge.source)?.type === 'Process' &&
                PROCESS_OVERVIEW_EDGE_TYPES.has(edge.type)
            );
        }
        return sourceType === 'Process' && PROCESS_OVERVIEW_EDGE_TYPES.has(edge.type);
    }

    if (viewMode === 'activityDetail') {
        if (edge.type === 'invokesSubprocess') return false;
        if (edge.type === 'definesProcess') return false;
        return ACTIVITY_DETAIL_EDGE_TYPES.has(edge.type);
    }

    return true;
}

/** 타입 토글 + 활동 서브타입 필터 기준 노드 표시 여부. */
export function nodeVisibleInFilters(
    node: GraphNode,
    visibleNodeTypes: Set<NodeType>,
    visibleActivitySubtypes: Set<ActivityUiSubtype>,
): boolean {
    if (node.type === 'ProcessActivity') {
        return nodeMatchesActivitySubtypeFilter(node, visibleActivitySubtypes);
    }
    return visibleNodeTypes.has(node.type);
}

/**
 * 뷰 모드 + 타입 토글 + 검색을 합쳐 가시 노드 ID 집합과 가시 엣지 목록을 산출.
 *  - activityDetail: 어떤 가시 엣지에도 연결되지 않은 활동 노드는 제거(고아 활동 pruning)
 *  - processOverview: 동일 Process→DataObject 쌍의 uses/produces 엣지를 집계 엣지로 병합
 */
export function applyViewModeFilters(
    graph: { nodes: GraphNode[]; edges: GraphEdge[] },
    viewMode: ViewMode,
    visibleNodeTypes: Set<NodeType>,
    visibleActivitySubtypes: Set<ActivityUiSubtype>,
    searchTerm: string,
    nodeMatchesSearch: (node: GraphNode, term: string) => boolean,
): { visibleNodeIds: Set<string>; visibleEdges: GraphEdge[] } {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const visibleNodeIds = new Set<string>();

    for (const node of graph.nodes) {
        if (!nodeVisibleInFilters(node, visibleNodeTypes, visibleActivitySubtypes)) continue;
        if (!nodeVisibleInViewMode(node, viewMode, visibleActivitySubtypes)) continue;
        if (!nodeMatchesSearch(node, searchTerm)) continue;
        visibleNodeIds.add(node.id);
    }

    let visibleEdges = graph.edges.filter((edge) => {
        if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
            return false;
        }
        return edgeVisibleInView(edge, viewMode, nodesById);
    });

    if (viewMode === 'activityDetail') {
        visibleEdges = pruneDisconnectedActivityNodes(graph.nodes, visibleEdges, visibleNodeIds);
    }

    visibleEdges = aggregateProcessOverviewDataEdges(nodesById, visibleEdges, viewMode);

    return { visibleNodeIds, visibleEdges };
}

/** activityDetail 뷰에서 가시 엣지에 연결되지 않은 활동 노드를 집합에서 제거. */
function pruneDisconnectedActivityNodes(
    nodes: GraphNode[],
    edges: GraphEdge[],
    visibleNodeIds: Set<string>,
): GraphEdge[] {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const connectedActivityIds = new Set<string>();

    for (const edge of edges) {
        if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) continue;
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (source?.type === 'ProcessActivity') connectedActivityIds.add(edge.source);
        if (target?.type === 'ProcessActivity') connectedActivityIds.add(edge.target);
    }

    for (const nodeId of [...visibleNodeIds]) {
        const node = nodesById.get(nodeId);
        if (node?.type === 'ProcessActivity' && !connectedActivityIds.has(nodeId)) {
            visibleNodeIds.delete(nodeId);
        }
    }

    return edges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    );
}

// ---------------------------------------------------------------------------
// 개요 뷰 dataObject 엣지 집계 (SAMPLE src/web/utils/dataObjectEdgeAggregation.ts 포팅)
// ---------------------------------------------------------------------------

const DATA_OBJECT_RELATION_EDGE_TYPES = new Set<EdgeType>([
    'usesDataObject',
    'producesDataObject',
]);

export type DataObjectRole = 'uses' | 'produces';

export function dataRoleForEdgeType(edgeType: EdgeType): DataObjectRole | null {
    if (edgeType === 'usesDataObject') return 'uses';
    if (edgeType === 'producesDataObject') return 'produces';
    return null;
}

export function buildDataObjectRoleLabel(roles: DataObjectRole[]): string {
    const unique = [...new Set(roles)];
    if (unique.length === 2) return 'uses + produces';
    if (unique[0] === 'uses') return 'uses';
    if (unique[0] === 'produces') return 'produces';
    return 'data';
}

function isProcessToDataObjectEdge(
    edge: GraphEdge,
    nodesById: Map<string, GraphNode>,
): boolean {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    return source?.type === 'Process' && target?.type === 'DataObject';
}

function buildAggregateDataObjectEdge(group: GraphEdge[]): GraphEdge {
    const originalEdgeTypes: EdgeType[] = [];
    const originalEdgeIds: string[] = [];
    const dataRoles: DataObjectRole[] = [];

    for (const edge of group) {
        originalEdgeIds.push(edge.id);
        originalEdgeTypes.push(edge.type);
        const role = dataRoleForEdgeType(edge.type);
        if (role) dataRoles.push(role);
    }

    const uniqueRoles = [...new Set(dataRoles)];
    const roleLabel = buildDataObjectRoleLabel(uniqueRoles);
    const source = group[0]!.source;
    const target = group[0]!.target;
    const displayType: EdgeType =
        uniqueRoles.length === 1 && uniqueRoles[0] === 'produces'
            ? 'producesDataObject'
            : 'usesDataObject';

    return {
        id: `view-aggregate:dataObject:${source}:${target}`,
        type: displayType,
        source,
        target,
        properties: {
            aggregated: true,
            originalEdgeTypes,
            originalEdgeIds,
            dataRoles: uniqueRoles,
            roleLabel,
            derived: group.some((edge) => edge.properties?.derived === true),
            focusDerived: group.some((edge) => edge.properties?.focusDerived === true),
        },
    };
}

/**
 * processOverview 뷰 한정: 같은 Process→DataObject 쌍의 uses/produces 엣지를
 * 단일 집계 엣지(view-aggregate:dataObject:*)로 병합. 다른 뷰에서는 원본 그대로 반환.
 */
export function aggregateProcessOverviewDataEdges(
    nodesById: Map<string, GraphNode>,
    edges: GraphEdge[],
    viewMode: ViewMode,
): GraphEdge[] {
    if (viewMode !== 'processOverview') return edges;

    const otherEdges: GraphEdge[] = [];
    const processDataObjectGroups = new Map<string, GraphEdge[]>();

    for (const edge of edges) {
        if (
            !DATA_OBJECT_RELATION_EDGE_TYPES.has(edge.type) ||
            !isProcessToDataObjectEdge(edge, nodesById)
        ) {
            otherEdges.push(edge);
            continue;
        }

        const key = `${edge.source}-->${edge.target}`;
        const group = processDataObjectGroups.get(key) ?? [];
        group.push(edge);
        processDataObjectGroups.set(key, group);
    }

    const aggregatedEdges: GraphEdge[] = [];
    for (const group of processDataObjectGroups.values()) {
        if (group.length === 1) {
            aggregatedEdges.push(group[0]!);
            continue;
        }
        aggregatedEdges.push(buildAggregateDataObjectEdge(group));
    }

    return [...otherEdges, ...aggregatedEdges];
}
