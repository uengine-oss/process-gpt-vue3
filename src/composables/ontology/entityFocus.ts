/**
 * entityFocus — 엔터티 포커스 서브그래프 계산 (specs/002 T042, 순수 함수).
 *
 * SAMPLE bpmn-process-kg `src/web/utils/entityFocus.ts` 번안 — 의미(semantics) 동일 유지.
 *  - EntityFocusState:        유형 7종(Process/Organization/Supplier/System/DataStore/Project/Manual)
 *                             + 다중 entityIds + depth(1|2) + 활동 상세/메타데이터 포함 토글
 *  - buildFocusedSubgraph:    포커스 엔터티에서 의미 기반 확장(BFS) → nodeIds/edgeIds/focusEdges
 *  - intersectFocusedVisibility: 뷰 모드·필터 가시성과 포커스 서브그래프의 교차
 *  - addNodeToCurrentFocus:   그래프에서 노드 클릭 시 현재 포커스에 같은 유형 노드 추가
 *  - getEntityOptions:        포커스 패널 검색형 선택용 옵션 목록(라벨 dedupe + 정렬)
 *
 * 프레임워크 비의존(순수 함수) — SAMPLE의 nodeLabel/activitySubtype/processContext 헬퍼는
 * 동일 로직의 비공개 함수로 인라인했다(라이브러리 web/utils 미이식 상태와 무관하게 동작).
 */
import type { EdgeType, GraphEdge, GraphNode, NodeType, ProcessGraph } from '@/lib/processKg/graph/types';

/** viewModes.ts(T020)의 ViewMode와 구조적으로 동일한 뷰 모드 유니언. */
export type ViewMode = 'processOverview' | 'activityDetail' | 'full';

export type FocusEntityType =
    | 'Process'
    | 'Organization'
    | 'Supplier'
    | 'System'
    | 'DataStore'
    | 'Project'
    | 'Manual';

export type FocusDepth = 1 | 2;

export interface EntityFocusState {
    entityType: FocusEntityType | '';
    entityIds: string[];
    depth: FocusDepth;
    includeActivityDetail: boolean;
    includeMetadata: boolean;
}

export interface EntityOption {
    id: string;
    label: string;
    type: FocusEntityType;
    secondaryLabel?: string;
}

export interface FocusedSubgraph {
    active: boolean;
    nodeIds: Set<string>;
    edgeIds: Set<string>;
    focusEdges: GraphEdge[];
}

export const FOCUS_ENTITY_TYPES: FocusEntityType[] = [
    'Process',
    'Organization',
    'Supplier',
    'System',
    'DataStore',
    'Project',
    'Manual',
];

export const FOCUSABLE_NODE_TYPES = new Set<NodeType>(FOCUS_ENTITY_TYPES);

export const ANNOTATION_FOCUS_DISABLED_REASON =
    'Annotations are not available as focus targets because they are free-form memo fields.';

export const defaultEntityFocusState: EntityFocusState = {
    entityType: '',
    entityIds: [],
    depth: 1,
    includeActivityDetail: false,
    includeMetadata: false,
};

const METADATA_NODE_TYPES = new Set<NodeType>(['ProcessModel', 'Participant']);
const ACTIVITY_DETAIL_NODE_TYPES = new Set<NodeType>([
    'ProcessActivity',
    'Gateway',
    'Event',
    'Lane',
    'Annotation',
]);
const METRIC_NODE_TYPES = new Set<NodeType>(['FTEProfile', 'CostProfile']);

const ACTIVITY_RELATION_EDGE_TYPES = new Set<EdgeType>([
    'usesSystem',
    'performedByOrganization',
    'performedBySupplier',
    'referencesDataStore',
    'usesDataObject',
    'producesDataObject',
    'hasManual',
    'hasAnnotation',
    'isFollowedBy',
    'callsProcessModel',
]);

// ---------------------------------------------------------------------------
// SAMPLE src/web/utils/processContext.ts 인라인 (entityFocus가 쓰는 부분만, 로직 동일)
// ---------------------------------------------------------------------------

const PROCESS_CONTEXT_NODE_TYPES = new Set<NodeType>([
    'System',
    'Organization',
    'Supplier',
    'DataStore',
    'DataObject',
    'Manual',
    'Project',
]);

/** Process 노드에서 컨텍스트 대상으로 롤업되는 엣지 유형 화이트리스트. */
const PROCESS_ROLLUP_EDGE_TYPES = new Set<EdgeType>([
    'usesSystem',
    'performedByOrganization',
    'performedBySupplier',
    'relatedToProject',
    'hasManual',
    'referencesDataStore',
    'usesDataObject',
    'producesDataObject',
    'hasAnnotation',
]);

interface BusinessProcessPair {
    processModelId: string | null;
    processId: string | null;
}

function isProcessContextNode(node: GraphNode | undefined): boolean {
    return node != null && PROCESS_CONTEXT_NODE_TYPES.has(node.type);
}

export function findDefinedProcessIds(graph: ProcessGraph, processModelId: string): string[] {
    return graph.edges
        .filter((edge) => edge.type === 'definesProcess' && edge.source === processModelId)
        .map((edge) => edge.target);
}

export function findDefiningProcessModelIds(graph: ProcessGraph, processId: string): string[] {
    return graph.edges
        .filter((edge) => edge.type === 'definesProcess' && edge.target === processId)
        .map((edge) => edge.source);
}

function resolveBusinessProcessPair(graph: ProcessGraph, nodeId: string): BusinessProcessPair | null {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return null;

    if (node.type === 'Process') {
        return {
            processId: node.id,
            processModelId: findDefiningProcessModelIds(graph, node.id)[0] ?? null,
        };
    }

    if (node.type === 'ProcessModel') {
        return {
            processModelId: node.id,
            processId: findDefinedProcessIds(graph, node.id)[0] ?? null,
        };
    }

    return null;
}

function getBusinessProcessKey(pair: BusinessProcessPair): string {
    return pair.processId ?? pair.processModelId ?? '';
}

function getBusinessProcessDisplayNodeId(pair: BusinessProcessPair): string {
    if (pair.processId) return pair.processId;
    if (pair.processModelId) return pair.processModelId;
    throw new Error('Business process pair has no display node.');
}

function getBusinessProcessHiddenNodeId(pair: BusinessProcessPair): string | null {
    if (pair.processId && pair.processModelId) {
        return pair.processModelId;
    }
    return null;
}

function buildBusinessProcessRemap(graph: ProcessGraph, nodeIds: Set<string>): Map<string, string> {
    const remap = new Map<string, string>();

    for (const nodeId of nodeIds) {
        const pair = resolveBusinessProcessPair(graph, nodeId);
        if (!pair?.processId || !pair.processModelId) continue;

        const displayId = getBusinessProcessDisplayNodeId(pair);
        const hiddenId = getBusinessProcessHiddenNodeId(pair);
        if (!hiddenId) continue;

        if (nodeIds.has(displayId) || nodeIds.has(hiddenId)) {
            remap.set(hiddenId, displayId);
        }
    }

    return remap;
}

/**
 * 비즈니스 표시 모드: Process/ProcessModel 쌍을 Process 하나로 접고(collapse),
 * definesProcess 엣지 제거 + 숨은 노드로 향하던 엣지를 표시 노드로 재매핑(dedupe 포함).
 */
function collapseBusinessProcessDisplay(
    graph: ProcessGraph,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
): void {
    const remap = buildBusinessProcessRemap(graph, nodeIds);

    for (const hiddenId of remap.keys()) {
        nodeIds.delete(hiddenId);
        nodeIds.add(remap.get(hiddenId)!);
    }

    const nextEdges: GraphEdge[] = [];
    const seen = new Set<string>();

    for (const edge of focusEdges) {
        if (edge.type === 'definesProcess') {
            edgeIds.delete(edge.id);
            continue;
        }

        const source = remap.get(edge.source) ?? edge.source;
        const target = remap.get(edge.target) ?? edge.target;
        if (source === target) {
            edgeIds.delete(edge.id);
            continue;
        }

        const key = `${edge.type}:${source}:${target}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const remapped =
            source !== edge.source || target !== edge.target
                ? {
                      ...edge,
                      id: `focus-remap:${edge.type}:${source}:${target}`,
                      source,
                      target,
                  }
                : edge;

        if (remapped.id !== edge.id) {
            edgeIds.delete(edge.id);
        }

        nextEdges.push(remapped);
        edgeIds.add(remapped.id);
    }

    focusEdges.splice(0, focusEdges.length, ...nextEdges);
}

/** Process 가 hasActivity/containsElement 로 직접 보유한 ProcessActivity ID 목록. */
function getProcessActivityIds(graph: ProcessGraph, processId: string): string[] {
    const ids = new Set<string>();

    for (const edge of graph.edges) {
        if (edge.source !== processId) continue;
        if (edge.type !== 'hasActivity' && edge.type !== 'containsElement') continue;
        const target = graph.nodes.find((candidate) => candidate.id === edge.target);
        if (target?.type === 'ProcessActivity') {
            ids.add(edge.target);
        }
    }

    return [...ids];
}

/** 활동 레벨 컨텍스트를 Process 레벨로 승격한 파생(focusDerived) 엣지 생성. */
function createDerivedProcessContextEdge(
    processId: string,
    activityId: string,
    edgeType: EdgeType,
    targetId: string,
): GraphEdge {
    return {
        id: `focus-derived:${edgeType}:${processId}:${targetId}:${activityId}`,
        type: edgeType,
        source: processId,
        target: targetId,
        properties: {
            derived: true,
            viaActivityId: activityId,
            focusDerived: true,
        },
    };
}

function countVisibleChildSubprocesses(
    graph: ProcessGraph,
    anchorProcessId: string,
    visibleNodeIds: Set<string>,
): number {
    const childKeys = new Set<string>();

    for (const edge of graph.edges) {
        if (edge.source !== anchorProcessId || edge.type !== 'invokesSubprocess') continue;

        const pair = resolveBusinessProcessPair(graph, edge.target);
        if (!pair) continue;

        const displayId = getBusinessProcessDisplayNodeId(pair);
        if (!visibleNodeIds.has(displayId) && !visibleNodeIds.has(edge.target)) continue;
        childKeys.add(getBusinessProcessKey(pair));
    }

    return childKeys.size;
}

// ---------------------------------------------------------------------------
// SAMPLE src/web/utils/{nodeLabel,activitySubtype}.ts 인라인 (로직 동일)
// ---------------------------------------------------------------------------

function propertyString(properties: Record<string, unknown>, key: string): string | undefined {
    const value = properties[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getNodeDisplayLabel(node: GraphNode): string {
    const displayName = propertyString(node.properties, 'displayName');
    if (displayName) return displayName;

    if (node.type === 'Participant') {
        const name = propertyString(node.properties, 'name');
        if (name) return `Pool: ${name}`;
    }

    if (node.label.trim()) return node.label.trim();

    const name = propertyString(node.properties, 'name');
    if (name) return name;

    return node.id;
}

function isCallActivityNode(node: GraphNode): boolean {
    if (node.type !== 'ProcessActivity') return false;
    const props = node.properties;
    if (props.bpmnType === 'callActivity') return true;
    if (props.activityKind === 'process_call') return true;
    if (props.isCallReference === true) return true;
    const definitionId = props.definitionId;
    return typeof definitionId === 'string' && definitionId.trim().length > 0;
}

// ---------------------------------------------------------------------------
// 엔터티 옵션(포커스 패널 검색형 선택)
// ---------------------------------------------------------------------------

function compareLabels(a: string, b: string): number {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function firstPropertyString(properties: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = propertyString(properties, key);
        if (value) return value;
    }
    return undefined;
}

function buildSecondaryLabel(node: GraphNode, entityType: FocusEntityType): string | undefined {
    const props = node.properties;

    switch (entityType) {
        case 'Process':
            return firstPropertyString(props, ['processCode', 'sourceModelId']);
        case 'Organization':
        case 'Supplier':
            return firstPropertyString(props, ['organizationType', 'businessNumber', 'memberCount']);
        case 'System':
            return firstPropertyString(props, ['systemId', 'id', 'category']);
        case 'DataStore':
            return firstPropertyString(props, ['sourceModelId', 'dataStoreType']);
        case 'Project':
            return firstPropertyString(props, ['projectType', 'url']);
        case 'Manual':
            return firstPropertyString(props, ['url', 'source']);
        default:
            return undefined;
    }
}

export function isEntityFocusActive(focus: EntityFocusState): boolean {
    return focus.entityType !== '' && focus.entityIds.length > 0;
}

export function isFocusableNodeType(nodeType: NodeType): nodeType is FocusEntityType {
    return FOCUSABLE_NODE_TYPES.has(nodeType);
}

/** 지정 유형의 노드를 라벨 dedupe + locale 정렬한 옵션 목록으로 반환. */
export function getEntityOptions(graph: ProcessGraph, entityType: FocusEntityType): EntityOption[] {
    const byLabel = new Map<string, EntityOption>();

    for (const node of graph.nodes) {
        if (node.type !== entityType) continue;

        const label = getNodeDisplayLabel(node);
        if (byLabel.has(label)) continue;

        byLabel.set(label, {
            id: node.id,
            label,
            type: entityType,
            secondaryLabel: buildSecondaryLabel(node, entityType),
        });
    }

    const options = [...byLabel.values()];
    options.sort((left, right) => compareLabels(left.label, right.label));
    return options;
}

/** 포커스 대상 ID를 Process/ProcessModel 쌍으로 해석(어느 쪽을 선택해도 동작). */
export function resolveProcessFocusIds(
    graph: ProcessGraph,
    entityId: string,
): { processIds: string[]; processModelIds: string[] } {
    const node = graph.nodes.find((candidate) => candidate.id === entityId);
    if (!node) {
        return { processIds: [entityId], processModelIds: [] };
    }

    if (node.type === 'Process') {
        return {
            processIds: [node.id],
            processModelIds: findDefiningProcessModelIds(graph, node.id),
        };
    }

    if (node.type === 'ProcessModel') {
        return {
            processIds: findDefinedProcessIds(graph, node.id),
            processModelIds: [node.id],
        };
    }

    return { processIds: [], processModelIds: [] };
}

export interface FocusedProcessContextSummary {
    processLabel: string;
    depthLabel: string;
    connectedSystems: number;
    connectedOrganizations: number;
    connectedSuppliers: number;
    connectedDataStores: number;
    connectedDataObjects: number;
    connectedManuals: number;
    connectedProjects: number;
    visibleTasks: number;
    visibleCallActivities: number;
    visibleChildSubprocesses: number;
    includesChildSubprocessContext: boolean;
    contextNote?: string;
}

export function summarizeFocusedProcessContext(
    graph: ProcessGraph,
    entityId: string,
    visibleNodeIds: Set<string>,
    options: {
        includeActivityCounts: boolean;
        depth: FocusDepth;
        viewMode: ViewMode;
    },
): FocusedProcessContextSummary | null {
    const resolved = resolveProcessFocusIds(graph, entityId);
    const processId = resolved.processIds[0];
    if (!processId) return null;

    const process = graph.nodes.find((candidate) => candidate.id === processId);
    if (!process || process.type !== 'Process') return null;

    const countType = (type: NodeType): number =>
        [...visibleNodeIds].filter((nodeId) => graph.nodes.find((n) => n.id === nodeId)?.type === type).length;

    let visibleTasks = 0;
    let visibleCallActivities = 0;

    if (options.includeActivityCounts) {
        for (const activityId of getProcessActivityIds(graph, processId)) {
            if (!visibleNodeIds.has(activityId)) continue;
            const activity = graph.nodes.find((candidate) => candidate.id === activityId);
            if (!activity) continue;
            if (isCallActivityNode(activity)) visibleCallActivities += 1;
            else visibleTasks += 1;
        }
    }

    const visibleChildSubprocesses = countVisibleChildSubprocesses(graph, processId, visibleNodeIds);

    const includesChildSubprocessContext = options.depth === 2 && visibleChildSubprocesses > 0;

    const hasDataArtifacts = countType('DataStore') > 0 || countType('DataObject') > 0;
    const hasSystemOrg =
        countType('System') > 0 || countType('Organization') > 0 || countType('Supplier') > 0;
    const hasAnyContext =
        hasDataArtifacts || hasSystemOrg || countType('Manual') > 0 || countType('Project') > 0;

    let contextNote: string | undefined;
    if (includesChildSubprocessContext && !hasAnyContext) {
        contextNote = 'Child subprocesses are modeled, but their roll-up context is sparse or missing.';
    } else if (includesChildSubprocessContext) {
        contextNote = 'Includes child subprocess context.';
    } else if (!hasAnyContext) {
        contextNote =
            'No modeled system/organization/data context was found for this process. Try Activity Detail or inspect BPMN enrichment.';
    } else if (hasDataArtifacts && !hasSystemOrg) {
        contextNote = 'This process has modeled data artifacts, but system/organization metadata is sparse.';
    }

    return {
        processLabel: getNodeDisplayLabel(process),
        depthLabel:
            options.depth === 2
                ? 'Depth 2: direct context + child subprocess context'
                : 'Depth 1: direct context only',
        connectedSystems: countType('System'),
        connectedOrganizations: countType('Organization'),
        connectedSuppliers: countType('Supplier'),
        connectedDataStores: countType('DataStore'),
        connectedDataObjects: countType('DataObject'),
        connectedManuals: countType('Manual'),
        connectedProjects: countType('Project'),
        visibleTasks,
        visibleCallActivities,
        visibleChildSubprocesses,
        includesChildSubprocessContext,
        contextNote,
    };
}

// ---------------------------------------------------------------------------
// 포커스 서브그래프 확장(BFS) 내부 구현 — SAMPLE 동일 로직
// ---------------------------------------------------------------------------

function linkProcessModelForProcess(
    graph: ProcessGraph,
    processId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    viewMode: ViewMode,
    focus: EntityFocusState,
): void {
    if (viewMode !== 'full' && !focus.includeMetadata) return;

    for (const edge of graph.edges) {
        if (edge.type === 'definesProcess' && edge.target === processId) {
            addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
        }
    }
}

function expandInvokesSubprocessFromCallActivities(
    graph: ProcessGraph,
    processId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
): void {
    const directInvokes = graph.edges.filter(
        (edge) => edge.source === processId && edge.type === 'invokesSubprocess',
    );

    for (const edge of directInvokes) {
        addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
    }

    if (directInvokes.length > 0) return;

    for (const activityId of getProcessActivityIds(graph, processId)) {
        const activity = graph.nodes.find((candidate) => candidate.id === activityId);
        if (!activity || !isCallActivityNode(activity)) continue;

        for (const callEdge of graph.edges) {
            if (callEdge.source !== activityId || callEdge.type !== 'callsProcessModel') {
                continue;
            }

            const invokeEdge = graph.edges.find(
                (candidate) =>
                    candidate.type === 'invokesSubprocess' &&
                    candidate.source === processId &&
                    candidate.target === callEdge.target,
            );
            if (invokeEdge) {
                addNodeAndEdge(nodeIds, edgeIds, focusEdges, invokeEdge);
            }
        }
    }
}

export function getFocusedEntityLabel(graph: ProcessGraph, focus: EntityFocusState): string | undefined {
    if (!isEntityFocusActive(focus)) return undefined;

    const count = focus.entityIds.length;
    const typeLabel = count === 1 ? focus.entityType : `${focus.entityType}s`;

    if (count === 1) {
        const node = graph.nodes.find((candidate) => candidate.id === focus.entityIds[0]);
        return node ? getNodeDisplayLabel(node) : focus.entityIds[0];
    }

    return `${count} ${typeLabel}`;
}

export function getSelectedEntityLabels(graph: ProcessGraph, focus: EntityFocusState): string[] {
    return focus.entityIds.map((entityId) => {
        const node = graph.nodes.find((candidate) => candidate.id === entityId);
        return node ? getNodeDisplayLabel(node) : entityId;
    });
}

function shouldIncludeNodeType(
    nodeType: NodeType,
    nodeId: string,
    focus: EntityFocusState,
    graph: ProcessGraph,
): boolean {
    if (METRIC_NODE_TYPES.has(nodeType)) return false;
    if (nodeType === 'ProcessModel') {
        if (focus.includeMetadata) return true;
        if (focus.entityType === 'Process') {
            const linkedToFocusedProcess = graph.edges.some(
                (edge) =>
                    edge.type === 'definesProcess' &&
                    edge.source === nodeId &&
                    focus.entityIds.includes(edge.target),
            );
            if (linkedToFocusedProcess) return true;

            const linkedViaResolvedProcess = graph.edges.some(
                (edge) =>
                    edge.type === 'definesProcess' &&
                    edge.source === nodeId &&
                    focus.entityIds.some((entityId) => {
                        const resolved = resolveProcessFocusIds(graph, entityId);
                        return resolved.processIds.includes(edge.target);
                    }),
            );
            if (linkedViaResolvedProcess) return true;

            return graph.edges.some(
                (edge) =>
                    edge.target === nodeId &&
                    (edge.type === 'invokesSubprocess' ||
                        (edge.type === 'callsProcessModel' &&
                            graph.edges.some(
                                (parentEdge) =>
                                    parentEdge.type === 'hasActivity' &&
                                    parentEdge.target === edge.source &&
                                    focus.entityIds.some((entityId) => {
                                        const resolved = resolveProcessFocusIds(graph, entityId);
                                        return resolved.processIds.includes(parentEdge.source);
                                    }),
                            ))),
            );
        }
        return false;
    }
    if (METADATA_NODE_TYPES.has(nodeType)) return focus.includeMetadata;
    if (ACTIVITY_DETAIL_NODE_TYPES.has(nodeType)) {
        return focus.entityType === 'Process' || focus.includeActivityDetail;
    }
    if (nodeType === 'SequenceFlow') return false;
    return true;
}

function addNodeAndEdge(
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    edge: GraphEdge,
): void {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
    focusEdges.push(edge);
}

function addSyntheticEdge(
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    edge: GraphEdge,
): void {
    if (edgeIds.has(edge.id)) return;
    addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
}

function expandProcessContainsContext(
    graph: ProcessGraph,
    processId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
): void {
    for (const edge of graph.edges) {
        if (edge.source !== processId || edge.type !== 'containsElement') continue;
        const target = graph.nodes.find((candidate) => candidate.id === edge.target);
        if (!isProcessContextNode(target)) continue;
        addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
    }
}

function expandDerivedProcessRollupsFromActivities(
    graph: ProcessGraph,
    processId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
): void {
    const seenTargets = new Set<string>();

    for (const activityId of getProcessActivityIds(graph, processId)) {
        for (const edge of graph.edges) {
            if (edge.source !== activityId) continue;
            if (!PROCESS_ROLLUP_EDGE_TYPES.has(edge.type)) continue;

            const key = `${edge.type}:${edge.target}`;
            if (seenTargets.has(key)) continue;

            const hasProcessLevel =
                graph.edges.some(
                    (candidate) =>
                        candidate.source === processId &&
                        candidate.type === edge.type &&
                        candidate.target === edge.target,
                ) ||
                focusEdges.some(
                    (candidate) =>
                        candidate.source === processId &&
                        candidate.type === edge.type &&
                        candidate.target === edge.target,
                );
            if (hasProcessLevel) continue;

            seenTargets.add(key);
            const derived = createDerivedProcessContextEdge(processId, activityId, edge.type, edge.target);
            addSyntheticEdge(nodeIds, edgeIds, focusEdges, derived);
        }
    }
}

function expandProcessLevelContext(
    graph: ProcessGraph,
    processId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
): void {
    for (const edge of graph.edges) {
        if (edge.source !== processId) continue;
        if (PROCESS_ROLLUP_EDGE_TYPES.has(edge.type)) {
            addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
        }
    }

    expandProcessContainsContext(graph, processId, nodeIds, edgeIds, focusEdges);
    expandDerivedProcessRollupsFromActivities(graph, processId, nodeIds, edgeIds, focusEdges);
}

function findParentProcessId(activityId: string, edges: GraphEdge[]): string | undefined {
    for (const edge of edges) {
        if (edge.type === 'hasActivity' && edge.target === activityId) {
            return edge.source;
        }
    }
    return undefined;
}

function expandProcessFocus(
    graph: ProcessGraph,
    focus: EntityFocusState,
    processId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    viewMode: ViewMode,
): void {
    nodeIds.add(processId);
    linkProcessModelForProcess(graph, processId, nodeIds, edgeIds, focusEdges, viewMode, focus);

    const showActivityDetail =
        viewMode === 'activityDetail' || viewMode === 'full' || focus.includeActivityDetail;

    expandProcessLevelContext(graph, processId, nodeIds, edgeIds, focusEdges);

    if (viewMode === 'processOverview' || viewMode === 'full') {
        expandInvokesSubprocessFromCallActivities(graph, processId, nodeIds, edgeIds, focusEdges);
    }

    if (!showActivityDetail) return;

    for (const edge of graph.edges) {
        if (edge.source !== processId) continue;

        if (viewMode === 'full' && edge.type === 'invokesSubprocess') {
            addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
            continue;
        }

        if (edge.type === 'hasActivity' || edge.type === 'containsElement') {
            const activity = graph.nodes.find((candidate) => candidate.id === edge.target);
            if (!activity || activity.type !== 'ProcessActivity') continue;

            const isCall = isCallActivityNode(activity);
            if (
                !isCall &&
                !focus.includeActivityDetail &&
                viewMode !== 'activityDetail' &&
                viewMode !== 'full'
            ) {
                continue;
            }

            addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);

            if (isCall) {
                for (const callEdge of graph.edges) {
                    if (callEdge.source !== activity.id || callEdge.type !== 'callsProcessModel') {
                        continue;
                    }
                    addNodeAndEdge(nodeIds, edgeIds, focusEdges, callEdge);
                }
            }
        }
    }

    const activityIds = getProcessActivityIds(graph, processId).filter((id) => nodeIds.has(id));

    for (const activityId of activityIds) {
        for (const edge of graph.edges) {
            if (edge.source !== activityId) continue;
            if (ACTIVITY_RELATION_EDGE_TYPES.has(edge.type) || edge.type === 'assignedToLane') {
                addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
            }
        }

        for (const edge of graph.edges) {
            if (edge.source !== activityId || edge.type !== 'assignedToLane') continue;
            const laneId = edge.target;
            for (const laneEdge of graph.edges) {
                if (
                    laneEdge.source === laneId &&
                    (laneEdge.type === 'performedByOrganization' ||
                        laneEdge.type === 'performedBySupplier')
                ) {
                    addNodeAndEdge(nodeIds, edgeIds, focusEdges, laneEdge);
                }
            }
        }
    }
}

function expandChildSubprocessSemanticContext(
    graph: ProcessGraph,
    focus: EntityFocusState,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
): void {
    const expandedChildren = new Set<string>();

    for (const entityId of focus.entityIds) {
        for (const processId of resolveProcessFocusIds(graph, entityId).processIds) {
            for (const edge of graph.edges) {
                if (edge.source !== processId || edge.type !== 'invokesSubprocess') continue;

                const childProcessIds = findDefinedProcessIds(graph, edge.target);
                if (childProcessIds.length === 0) continue;

                for (const childProcessId of childProcessIds) {
                    if (expandedChildren.has(childProcessId)) continue;
                    expandedChildren.add(childProcessId);

                    addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
                    nodeIds.add(childProcessId);
                    expandProcessLevelContext(graph, childProcessId, nodeIds, edgeIds, focusEdges);
                }
            }
        }
    }
}

function expandProcessModelFocus(
    graph: ProcessGraph,
    focus: EntityFocusState,
    processModelId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    viewMode: ViewMode,
): void {
    if (viewMode !== 'full' && !focus.includeMetadata) {
        for (const processId of findDefinedProcessIds(graph, processModelId)) {
            expandProcessFocus(graph, focus, processId, nodeIds, edgeIds, focusEdges, viewMode);
        }
        return;
    }

    nodeIds.add(processModelId);

    for (const processId of findDefinedProcessIds(graph, processModelId)) {
        for (const edge of graph.edges) {
            if (
                edge.type === 'definesProcess' &&
                edge.source === processModelId &&
                edge.target === processId
            ) {
                addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
            }
        }
        expandProcessFocus(graph, focus, processId, nodeIds, edgeIds, focusEdges, viewMode);
    }
}

function expandIncomingProcessEdgeFocus(
    graph: ProcessGraph,
    focus: EntityFocusState,
    entityId: string,
    edgeType: EdgeType,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    viewMode: ViewMode,
): void {
    nodeIds.add(entityId);

    for (const edge of graph.edges) {
        if (edge.target !== entityId) continue;

        if (edge.type === edgeType) {
            const sourceNode = graph.nodes.find((candidate) => candidate.id === edge.source);
            if (!sourceNode) continue;

            if (sourceNode.type === 'Process') {
                addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
                expandProcessLevelContext(graph, sourceNode.id, nodeIds, edgeIds, focusEdges);
                continue;
            }

            if (edgeType === 'referencesDataStore' && sourceNode.type === 'ProcessActivity') {
                addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
                const processId = findParentProcessId(sourceNode.id, graph.edges);
                if (processId) {
                    nodeIds.add(processId);
                    const bridge = graph.edges.find(
                        (candidate) =>
                            (candidate.type === 'hasActivity' || candidate.type === 'containsElement') &&
                            candidate.source === processId &&
                            candidate.target === sourceNode.id,
                    );
                    if (bridge) {
                        addNodeAndEdge(nodeIds, edgeIds, focusEdges, bridge);
                    }
                }
                continue;
            }

            if (
                (focus.includeActivityDetail || viewMode === 'activityDetail') &&
                sourceNode.type === 'ProcessActivity'
            ) {
                addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);

                const processId = findParentProcessId(sourceNode.id, graph.edges);
                if (!processId) continue;

                nodeIds.add(processId);
                const hasActivityEdge = graph.edges.find(
                    (candidate) =>
                        (candidate.type === 'hasActivity' || candidate.type === 'containsElement') &&
                        candidate.source === processId &&
                        candidate.target === sourceNode.id,
                );
                if (hasActivityEdge) {
                    addNodeAndEdge(nodeIds, edgeIds, focusEdges, hasActivityEdge);
                }

                for (const relatedEdge of graph.edges) {
                    if (relatedEdge.source !== sourceNode.id) continue;
                    if (PROCESS_ROLLUP_EDGE_TYPES.has(relatedEdge.type)) {
                        addNodeAndEdge(nodeIds, edgeIds, focusEdges, relatedEdge);
                    }
                }
            }
            continue;
        }

        if (edge.type === 'containsElement' && edgeType === 'referencesDataStore') {
            const sourceNode = graph.nodes.find((candidate) => candidate.id === edge.source);
            if (sourceNode?.type === 'Process') {
                addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
                expandProcessLevelContext(graph, sourceNode.id, nodeIds, edgeIds, focusEdges);
            }
        }
    }
}

function expandSemanticFocusForEntity(
    graph: ProcessGraph,
    focus: EntityFocusState,
    entityId: string,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    viewMode: ViewMode,
): void {
    switch (focus.entityType) {
        case 'Process': {
            const node = graph.nodes.find((candidate) => candidate.id === entityId);
            if (node?.type === 'ProcessModel') {
                expandProcessModelFocus(graph, focus, entityId, nodeIds, edgeIds, focusEdges, viewMode);
                break;
            }
            const { processIds, processModelIds } = resolveProcessFocusIds(graph, entityId);
            for (const processModelId of processModelIds) {
                if (viewMode === 'full' || focus.includeMetadata) {
                    nodeIds.add(processModelId);
                }
            }
            for (const processId of processIds) {
                expandProcessFocus(graph, focus, processId, nodeIds, edgeIds, focusEdges, viewMode);
            }
            break;
        }
        case 'System':
            expandIncomingProcessEdgeFocus(
                graph,
                focus,
                entityId,
                'usesSystem',
                nodeIds,
                edgeIds,
                focusEdges,
                viewMode,
            );
            break;
        case 'Organization':
            expandIncomingProcessEdgeFocus(
                graph,
                focus,
                entityId,
                'performedByOrganization',
                nodeIds,
                edgeIds,
                focusEdges,
                viewMode,
            );
            break;
        case 'Supplier':
            expandIncomingProcessEdgeFocus(
                graph,
                focus,
                entityId,
                'performedBySupplier',
                nodeIds,
                edgeIds,
                focusEdges,
                viewMode,
            );
            break;
        case 'DataStore':
            expandIncomingProcessEdgeFocus(
                graph,
                focus,
                entityId,
                'referencesDataStore',
                nodeIds,
                edgeIds,
                focusEdges,
                viewMode,
            );
            break;
        case 'Project':
            expandIncomingProcessEdgeFocus(
                graph,
                focus,
                entityId,
                'relatedToProject',
                nodeIds,
                edgeIds,
                focusEdges,
                viewMode,
            );
            break;
        case 'Manual':
            expandIncomingProcessEdgeFocus(
                graph,
                focus,
                entityId,
                'hasManual',
                nodeIds,
                edgeIds,
                focusEdges,
                viewMode,
            );
            break;
        default:
            break;
    }
}

/** 프런티어에서 depth 홉만큼 이웃으로 확장(BFS). Process 외 유형의 depth 2 에 사용. */
function expandNeighborhoodHops(
    graph: ProcessGraph,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    depth: FocusDepth,
): void {
    let frontier = new Set(nodeIds);

    for (let hop = 0; hop < depth; hop += 1) {
        const nextFrontier = new Set<string>();

        for (const edge of graph.edges) {
            const touchesFrontier = frontier.has(edge.source) || frontier.has(edge.target);
            if (!touchesFrontier) continue;

            addNodeAndEdge(nodeIds, edgeIds, focusEdges, edge);
            nextFrontier.add(edge.source);
            nextFrontier.add(edge.target);
        }

        frontier = nextFrontier;
    }
}

function ensureFocusEdgeEndpoints(
    graph: ProcessGraph,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
): void {
    for (const edge of [...focusEdges]) {
        if (!edgeIds.has(edge.id)) continue;
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
    }

    for (const edgeId of [...edgeIds]) {
        if (focusEdges.some((edge) => edge.id === edgeId)) continue;
        const edge = graph.edges.find((candidate) => candidate.id === edgeId);
        if (!edge) {
            edgeIds.delete(edgeId);
            continue;
        }
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
        focusEdges.push(edge);
    }
}

function applyNodeTypeFilters(
    graph: ProcessGraph,
    focus: EntityFocusState,
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    focusEdges: GraphEdge[],
    viewMode: ViewMode,
): void {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

    for (const nodeId of [...nodeIds]) {
        const node = nodesById.get(nodeId);
        if (!node || shouldIncludeNodeType(node.type, nodeId, focus, graph)) continue;
        nodeIds.delete(nodeId);
    }

    if (viewMode === 'processOverview') {
        for (const nodeId of [...nodeIds]) {
            const node = nodesById.get(nodeId);
            if (node?.type === 'ProcessActivity') {
                nodeIds.delete(nodeId);
            }
        }
    }

    for (const edgeId of [...edgeIds]) {
        const edge =
            focusEdges.find((candidate) => candidate.id === edgeId) ??
            graph.edges.find((candidate) => candidate.id === edgeId);
        if (!edge) {
            edgeIds.delete(edgeId);
            continue;
        }
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
            edgeIds.delete(edgeId);
        }
        if (viewMode === 'activityDetail' && edge.type === 'invokesSubprocess') {
            edgeIds.delete(edgeId);
        }
    }
}

/**
 * 포커스 엔터티에서 의미 기반으로 확장한 서브그래프 산출.
 * depth 2: Process 포커스는 자식 서브프로세스 롤업 컨텍스트, 그 외 유형은 1홉 이웃 확장.
 */
export function buildFocusedSubgraph(
    graph: ProcessGraph,
    focus: EntityFocusState,
    viewMode: ViewMode = 'processOverview',
): FocusedSubgraph {
    if (!isEntityFocusActive(focus)) {
        return {
            active: false,
            nodeIds: new Set<string>(),
            edgeIds: new Set<string>(),
            focusEdges: [],
        };
    }

    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const focusEdges: GraphEdge[] = [];

    for (const entityId of focus.entityIds) {
        expandSemanticFocusForEntity(graph, focus, entityId, nodeIds, edgeIds, focusEdges, viewMode);
    }

    if (focus.depth === 2) {
        if (focus.entityType === 'Process') {
            expandChildSubprocessSemanticContext(graph, focus, nodeIds, edgeIds, focusEdges);
        } else {
            expandNeighborhoodHops(graph, nodeIds, edgeIds, focusEdges, 1);
        }
    }

    ensureFocusEdgeEndpoints(graph, nodeIds, edgeIds, focusEdges);
    applyNodeTypeFilters(graph, focus, nodeIds, edgeIds, focusEdges, viewMode);

    if (viewMode !== 'full' && !focus.includeMetadata) {
        collapseBusinessProcessDisplay(graph, nodeIds, edgeIds, focusEdges);
    }

    ensureFocusEdgeEndpoints(graph, nodeIds, edgeIds, focusEdges);

    const prunedFocusEdges = focusEdges.filter(
        (edge) => edgeIds.has(edge.id) && nodeIds.has(edge.source) && nodeIds.has(edge.target),
    );

    return {
        active: true,
        nodeIds,
        edgeIds,
        focusEdges: prunedFocusEdges,
    };
}

/** 필터/뷰 모드 가시성과 포커스 서브그래프의 교집합. 포커스 비활성 시 원본 그대로. */
export function intersectFocusedVisibility(
    visibleNodeIds: Set<string>,
    visibleEdges: GraphEdge[],
    focused: FocusedSubgraph,
): { visibleNodeIds: Set<string>; visibleEdges: GraphEdge[] } {
    if (!focused.active) {
        return { visibleNodeIds, visibleEdges };
    }

    const nextNodeIds = new Set<string>();
    for (const nodeId of visibleNodeIds) {
        if (focused.nodeIds.has(nodeId)) {
            nextNodeIds.add(nodeId);
        }
    }

    const nextEdges = visibleEdges.filter(
        (edge) =>
            focused.edgeIds.has(edge.id) &&
            nextNodeIds.has(edge.source) &&
            nextNodeIds.has(edge.target),
    );

    return {
        visibleNodeIds: nextNodeIds,
        visibleEdges: nextEdges,
    };
}

/** 노드 클릭 → 해당 노드 단독 포커스 상태 생성(포커스 불가 유형이면 null). */
export function createFocusStateForNode(node: GraphNode): EntityFocusState | null {
    if (!isFocusableNodeType(node.type)) return null;

    return {
        entityType: node.type,
        entityIds: [node.id],
        depth: 1,
        includeActivityDetail: false,
        includeMetadata: false,
    };
}

/** 현재 포커스에 같은 유형의 노드를 추가(유형 불일치·포커스 불가 유형이면 null). */
export function addNodeToCurrentFocus(focus: EntityFocusState, node: GraphNode): EntityFocusState | null {
    if (!isFocusableNodeType(node.type)) return null;
    if (focus.entityType !== '' && focus.entityType !== node.type) return null;

    const entityIds = focus.entityIds.includes(node.id) ? focus.entityIds : [...focus.entityIds, node.id];

    return {
        ...focus,
        entityType: node.type,
        entityIds,
    };
}

export function uniqueEntityIds(entityIds: string[]): string[] {
    return [...new Set(entityIds)];
}
