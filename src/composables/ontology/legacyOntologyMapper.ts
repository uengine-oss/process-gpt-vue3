/**
 * legacyOntologyMapper — processKg ProcessGraph 를 레거시 OntologyGraph 로 투영하는 순수 함수.
 *
 * 매핑 규칙 (specs/002-process-kg-integration/data-model.md §5, FR-010 하위 호환):
 *  - ProcessTask ← ProcessActivity
 *  - Role        ← Organization (performedByOrganization 롤업; org 롤업이 없으면 Lane 폴백)
 *  - System      ← System
 *  - Data        ← DataStore + DataObject (활동과 연결된 노드만 — 고립 노드 미노출)
 *  - :isFollowedBy ← isFollowedBy 원본을 activity 간 인접으로 축약(게이트웨이·이벤트 건너뜀,
 *                    레거시 collapseToActivityAdjacency BFS 이식)
 *  - :hasRole      ← Activity→Organization 직접 롤업 + Activity→Lane→Organization 순회
 *  - :usesSystem   ← usesSystem (activity 레벨만, Process 레벨 롤업 엣지는 제외)
 *  - :hasManual    ← hasManual(Manual 노드)을 레거시 계약대로 activity SELF-LOOP 으로 표현,
 *                    Manual.url 은 node.manualUrl 로 승격 (url 이 있을 때만 — 레거시 동작)
 *
 * Data 엣지(referencesDataStore/usesDataObject/producesDataObject)는 레거시 OntologyRelation
 * 유니언(':isFollowedBy'|':hasRole'|':usesSystem'|':hasManual')으로 표현할 수 없어 생략한다.
 * 레거시 뷰에는 Data 노드의 kind 매핑만 제공하고, 엣지는 확장(processKg) 뷰 전용이다.
 * 고립 Data 노드가 떠다니지 않도록 활동 링크가 1개 이상인 Data 노드만 포함한다.
 *
 * ID 규칙(전역 dedup — 레거시의 modelKey 접두사 폐기):
 *  - task:   'task:'   + ProcessActivity 노드 id 의 'Activity:' 접두사 제거분 (모델 스코프 유지)
 *  - role:   'role:'   + orgCode(Organization.properties.organizationId, 폴백 시 lane id)
 *  - system: 'system:' + systemKey('System:' 접두사 제거분 — 이미 전역 정규화됨)
 *  - data:   'data:'   + DataStore/DataObject 노드 id 의 타입 접두사 제거분
 * 두 모델이 같은 조직/시스템을 쓰면 하나의 Role/System 노드로 합쳐진다.
 */
import type { EdgeType, GraphEdge, GraphNode, ProcessGraph } from '@/lib/processKg/graph/types';
import type { DimensionAxis, OntologyEdge, OntologyGraph, OntologyNode } from './ontologyTypes';

const TASK_ID_PREFIX = 'task:';
const ROLE_ID_PREFIX = 'role:';
const SYSTEM_ID_PREFIX = 'system:';
const DATA_ID_PREFIX = 'data:';

/** extractGraph.safeLabel 의 무명 기본값 — lane 폴백 Role 생성 시 조직명 없음으로 간주. */
const UNNAMED_LABEL = '(unnamed)';

const DATA_EDGE_TYPES: ReadonlySet<EdgeType> = new Set<EdgeType>(['referencesDataStore', 'usesDataObject', 'producesDataObject']);
const DATA_NODE_TYPES = new Set(['DataStore', 'DataObject']);

/** processKg 노드 id 에서 타입 접두사('Activity:' 등)를 제거. */
function stripPrefix(id: string, prefix: string): string {
    return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/** unknown 프로퍼티 값을 비어있지 않은 문자열로 관대하게 읽기. */
function readString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
}

/** 활동 노드 properties(직접 키 또는 rawExtension)에서 lifecycle 값을 조회. */
function readLifecycle(props: Record<string, unknown>): string | null {
    const direct = readString(props.lifecycle) ?? readString(props.lifeCycle);
    if (direct) return direct;
    const raw = props.rawExtension;
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
        const rec = raw as Record<string, unknown>;
        return readString(rec.lifecycle) ?? readString(rec.lifeCycle);
    }
    return null;
}

/**
 * isFollowedBy 원본(flow element 간)을 activity 간 인접으로 축약.
 * 게이트웨이·이벤트 등 비-activity 노드를 BFS 로 건너뛰어 (from→to) 쌍을 산출한다.
 * 레거시 ontologyMapper.collapseToActivityAdjacency 이식(FR-010 축약 로직 유지).
 */
function collapseToActivityAdjacency(activityIds: Set<string>, forward: Map<string, string[]>): Array<{ from: string; to: string }> {
    const pairs: Array<{ from: string; to: string }> = [];
    const pairSeen = new Set<string>();

    for (const start of activityIds) {
        const visited = new Set<string>();
        const queue = [...(forward.get(start) || [])];
        while (queue.length) {
            const cur = queue.shift()!;
            if (visited.has(cur)) continue;
            visited.add(cur);
            if (activityIds.has(cur)) {
                const key = `${start}->${cur}`;
                if (!pairSeen.has(key)) {
                    pairSeen.add(key);
                    pairs.push({ from: start, to: cur });
                }
                continue; // activity 에 도달하면 그 뒤는 그 activity 의 BFS 가 담당
            }
            for (const nxt of forward.get(cur) || []) if (!visited.has(nxt)) queue.push(nxt);
        }
    }
    return pairs;
}

/**
 * 다차원 슬라이서 축(본부/시스템/라이프사이클)을 레거시 그래프 노드 집합에서 재산출.
 * 값이 하나도 없는 축은 노출하지 않는다(레거시 buildDimensionAxes 의미 유지).
 */
export function buildDimensionAxes(legacyGraph: OntologyGraph): DimensionAxis[] {
    const axisDefs: Array<{ key: string; label: string; dim: keyof OntologyNode['dimensions'] }> = [
        { key: 'org', label: '본부', dim: 'orgName' },
        { key: 'system', label: '시스템', dim: 'system' },
        { key: 'lifecycle', label: '라이프사이클', dim: 'lifecycle' }
    ];
    return axisDefs
        .map(({ key, label, dim }) => {
            const seen = new Set<string>();
            for (const n of legacyGraph.nodes) {
                const v = n.dimensions[dim];
                if (v) seen.add(v);
            }
            return { key, label, values: Array.from(seen).map((value) => ({ value, label: value })) };
        })
        .filter((axis) => axis.values.length > 0);
}

/** Organization 노드에서 전역 orgCode 를 결정(organizationId 우선, 노드 id 접미사 폴백). */
function orgCodeOf(org: GraphNode): string {
    return readString(org.properties.organizationId) ?? stripPrefix(org.id, 'Organization:');
}

/** processKg ProcessGraph → 레거시 OntologyGraph 투영(순수 함수, 입력 불변). */
export function toLegacyOntologyGraph(graph: ProcessGraph): OntologyGraph {
    const nodesById = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));
    const outgoing = new Map<string, GraphEdge[]>();
    for (const edge of graph.edges) {
        if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
        outgoing.get(edge.source)!.push(edge);
    }
    const outgoingOfType = (nodeId: string, type: EdgeType): GraphEdge[] => (outgoing.get(nodeId) || []).filter((e) => e.type === type);

    const nodes: OntologyNode[] = [];
    const nodeIndex = new Map<string, OntologyNode>();
    const edges: OntologyEdge[] = [];
    const edgeIds = new Set<string>();

    const addNode = (node: OntologyNode): OntologyNode => {
        const existing = nodeIndex.get(node.id);
        if (existing) return existing; // 전역 dedup — 첫 등록 우선
        nodeIndex.set(node.id, node);
        nodes.push(node);
        return node;
    };
    const addEdge = (edge: OntologyEdge): void => {
        if (edgeIds.has(edge.id)) return;
        edgeIds.add(edge.id);
        edges.push(edge);
    };

    const activities = graph.nodes.filter((n) => n.type === 'ProcessActivity');
    const taskIdByActivityId = new Map<string, string>();

    // 1) ProcessTask + Role(:hasRole) + System(:usesSystem) + :hasManual(self-loop) + fte
    for (const activity of activities) {
        const taskId = `${TASK_ID_PREFIX}${stripPrefix(activity.id, 'Activity:')}`;
        taskIdByActivityId.set(activity.id, taskId);

        // Role 후보: Activity→Organization 직접 롤업 엣지 + Activity→Lane→Organization 순회
        const orgById = new Map<string, GraphNode>();
        for (const e of outgoingOfType(activity.id, 'performedByOrganization')) {
            const t = nodesById.get(e.target);
            if (t?.type === 'Organization') orgById.set(t.id, t);
        }
        const lanes: GraphNode[] = [];
        for (const e of outgoingOfType(activity.id, 'assignedToLane')) {
            const lane = nodesById.get(e.target);
            if (lane?.type !== 'Lane') continue;
            lanes.push(lane);
            for (const le of outgoingOfType(lane.id, 'performedByOrganization')) {
                const t = nodesById.get(le.target);
                if (t?.type === 'Organization') orgById.set(t.id, t);
            }
        }

        const roleRefs: Array<{ roleId: string; orgCode: string; orgName: string }> = [];
        for (const org of orgById.values()) {
            const orgCode = orgCodeOf(org);
            roleRefs.push({ roleId: `${ROLE_ID_PREFIX}${orgCode}`, orgCode, orgName: org.label });
        }
        // lane 폴백: org 롤업이 전혀 없을 때만, 이름 있는 lane 을 Role 로 승격(레거시 lane=Role 의미)
        if (roleRefs.length === 0) {
            for (const lane of lanes) {
                const laneLabel = lane.label && lane.label.trim() !== '' ? lane.label.trim() : '';
                if (!laneLabel || laneLabel === UNNAMED_LABEL) continue;
                const orgCode = readString(lane.properties.laneId) ?? stripPrefix(lane.id, 'Lane:');
                roleRefs.push({ roleId: `${ROLE_ID_PREFIX}${orgCode}`, orgCode, orgName: laneLabel });
            }
        }

        // System 후보: activity 레벨 usesSystem 만(Process 레벨 롤업은 source 가 Process 라 제외됨)
        const systemRefs: Array<{ systemId: string; label: string }> = [];
        for (const e of outgoingOfType(activity.id, 'usesSystem')) {
            const t = nodesById.get(e.target);
            if (t?.type !== 'System') continue;
            systemRefs.push({ systemId: `${SYSTEM_ID_PREFIX}${stripPrefix(t.id, 'System:')}`, label: t.label });
        }

        // Manual: Manual 노드 url → node.manualUrl (activity.manualLink 폴백)
        let manualUrl: string | null = null;
        for (const e of outgoingOfType(activity.id, 'hasManual')) {
            const t = nodesById.get(e.target);
            if (t?.type !== 'Manual') continue;
            manualUrl = readString(t.properties.url);
            if (manualUrl) break;
        }
        if (!manualUrl) manualUrl = readString(activity.properties.manualLink);

        // FTE: 실데이터 FTEProfile.headcount 합계(존재할 때만 지표 부여)
        let fteSum = 0;
        let hasFte = false;
        for (const e of outgoingOfType(activity.id, 'hasFTEProfile')) {
            const profile = nodesById.get(e.target);
            if (profile?.type !== 'FTEProfile') continue;
            const headcount = profile.properties.headcount;
            if (typeof headcount === 'number' && Number.isFinite(headcount)) {
                hasFte = true;
                fteSum += headcount;
            }
        }

        const firstRole = roleRefs[0];
        const firstSystem = systemRefs[0];
        const taskNode = addNode({
            id: taskId,
            kind: 'ProcessTask',
            label: activity.label || stripPrefix(activity.id, 'Activity:'),
            dimensions: {
                orgCode: firstRole?.orgCode,
                orgName: firstRole?.orgName,
                system: firstSystem?.label,
                lifecycle: readLifecycle(activity.properties) || undefined
            },
            manualUrl,
            metrics: hasFte ? { inDegree: 0, outDegree: 0, fte: Math.round(fteSum * 10) / 10 } : { inDegree: 0, outDegree: 0 },
            risk: null
        });

        for (const ref of roleRefs) {
            addNode({
                id: ref.roleId,
                kind: 'Role',
                label: ref.orgName,
                dimensions: { orgCode: ref.orgCode, orgName: ref.orgName },
                manualUrl: null,
                metrics: { inDegree: 0, outDegree: 0 },
                risk: null
            });
            addEdge({ id: `${taskNode.id}->hasRole->${ref.roleId}`, source: taskNode.id, target: ref.roleId, relation: ':hasRole' });
        }

        for (const ref of systemRefs) {
            addNode({
                id: ref.systemId,
                kind: 'System',
                label: ref.label,
                dimensions: { system: ref.label },
                manualUrl: null,
                metrics: { inDegree: 0, outDegree: 0 },
                risk: null
            });
            addEdge({ id: `${taskNode.id}->usesSystem->${ref.systemId}`, source: taskNode.id, target: ref.systemId, relation: ':usesSystem' });
        }

        // 레거시 계약: manualUrl 이 있을 때만 self-loop (Manual 노드 정규화는 확장 뷰 전용)
        if (manualUrl) {
            addEdge({ id: `${taskNode.id}->hasManual`, source: taskNode.id, target: taskNode.id, relation: ':hasManual' });
        }
    }

    // 2) :isFollowedBy — isFollowedBy 원본을 activity 간 인접으로 축약
    const forward = new Map<string, string[]>();
    for (const edge of graph.edges) {
        if (edge.type !== 'isFollowedBy') continue;
        if (!forward.has(edge.source)) forward.set(edge.source, []);
        forward.get(edge.source)!.push(edge.target);
    }
    const activityIds = new Set(activities.map((a) => a.id));
    for (const { from, to } of collapseToActivityAdjacency(activityIds, forward)) {
        const src = taskIdByActivityId.get(from)!;
        const tgt = taskIdByActivityId.get(to)!;
        addEdge({ id: `${src}->isFollowedBy->${tgt}`, source: src, target: tgt, relation: ':isFollowedBy' });
    }

    // 3) Data 노드 — 활동 링크가 있는 DataStore/DataObject 만 kind 매핑으로 포함.
    //    엣지는 레거시 OntologyRelation 유니언으로 표현 불가하여 생략(확장 뷰 전용, 파일 상단 주석 참고).
    for (const edge of graph.edges) {
        if (!DATA_EDGE_TYPES.has(edge.type)) continue;
        const source = nodesById.get(edge.source);
        const target = nodesById.get(edge.target);
        if (source?.type !== 'ProcessActivity') continue; // Process 레벨 롤업 엣지 제외
        if (!target || !DATA_NODE_TYPES.has(target.type)) continue;
        const suffix = stripPrefix(stripPrefix(target.id, 'DataStore:'), 'DataObject:');
        addNode({
            id: `${DATA_ID_PREFIX}${suffix}`,
            kind: 'Data',
            label: target.label,
            dimensions: {},
            manualUrl: null,
            metrics: { inDegree: 0, outDegree: 0 },
            risk: null
        });
    }

    // 4) 메트릭 — 매핑된 레거시 엣지 전체 기준 in/outDegree(:hasManual self-loop 은 연결이 아니라 제외)
    for (const edge of edges) {
        if (edge.source === edge.target) continue;
        const src = nodeIndex.get(edge.source);
        const tgt = nodeIndex.get(edge.target);
        if (src) src.metrics.outDegree += 1;
        if (tgt) tgt.metrics.inDegree += 1;
    }

    const legacyGraph: OntologyGraph = { nodes, edges, dimensionAxes: [] };
    legacyGraph.dimensionAxes = buildDimensionAxes(legacyGraph);
    return legacyGraph;
}
