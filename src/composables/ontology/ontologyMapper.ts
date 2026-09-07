/**
 * @deprecated specs/002 — src/lib/processKg 로 대체됨(다음 정리 시 삭제 예정).
 * 대체 경로: src/lib/processKg/graph/extractGraph.ts + src/composables/ontology/legacyOntologyMapper.ts.
 *
 * ontologyMapper — BPMN 파싱 결과(proc_def)를 온톨로지 Node/Edge로 투영하는 순수 함수.
 *
 * 매핑 규칙 (specs/001-ontology-explorer/spec.md FR-001~007):
 *  - ProcessTask ← activity(<bpmn:task> 계열 + callActivity/subProcess)
 *  - Role        ← <bpmn:lane> 조직명 (org_code/org_name만, department 미사용)
 *  - System      ← Extension Property usesSystem
 *  - :isFollowedBy ← sequenceFlow (게이트웨이·이벤트를 축약해 activity 간 연결)
 *  - :hasRole      ← task-lane 소속
 *  - :usesSystem   ← task-system 사용
 *  - :hasManual    ← Confluence URL (값이 non-null 일 때만)
 *
 * lane / usesSystem 값이 없으면 해당 노드·엣지는 생성하지 않는다(Edge Case).
 * Data 노드 축은 예약 상태로, 이번 범위에서는 생성하지 않는다(FR-009a).
 */
import type { DimensionAxis, OntologyEdge, OntologyGraph, OntologyNode, OntologyParseInput, OntologyParseLane } from './ontologyTypes';

const ACTIVITY_RE = /task$|callactivity|subprocess/;
const TASK_ID_PREFIX = 'task:';
const ROLE_ID_PREFIX = 'role:';
const SYSTEM_ID_PREFIX = 'system:';

/** activity(프로세스 태스크 후보) 여부 — task 계열/callActivity/subProcess. */
function isActivity(elementType: string): boolean {
    return ACTIVITY_RE.test((elementType || '').toLowerCase());
}

/** properties 에서 관심 키를 관대하게 조회. */
function readProp(props: Record<string, string> | null | undefined, ...keys: string[]): string | null {
    if (!props) return null;
    for (const key of keys) {
        const v = props[key];
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
}

function laneOrgName(lane: OntologyParseLane): string | null {
    return readProp(lane.properties, 'org_name', 'orgName') || (lane.name && lane.name.trim() ? lane.name.trim() : null);
}

function laneOrgCode(lane: OntologyParseLane): string {
    return readProp(lane.properties, 'org_code', 'orgCode') || lane.element_id;
}

/** 다차원 슬라이서가 노출할 축(본부/시스템/라이프사이클)을 노드 집합에서 산출. */
function buildDimensionAxes(nodes: OntologyNode[]): DimensionAxis[] {
    const axisDefs: Array<{ key: string; label: string; dim: keyof OntologyNode['dimensions'] }> = [
        { key: 'org', label: '본부', dim: 'orgName' },
        { key: 'system', label: '시스템', dim: 'system' },
        { key: 'lifecycle', label: '라이프사이클', dim: 'lifecycle' }
    ];
    return axisDefs
        .map(({ key, label, dim }) => {
            const seen = new Set<string>();
            for (const n of nodes) {
                const v = n.dimensions[dim];
                if (v) seen.add(v);
            }
            return { key, label, values: Array.from(seen).map((value) => ({ value, label: value })) };
        })
        .filter((axis) => axis.values.length > 0);
}

/**
 * sequenceFlow 를 activity 간 인접으로 축약: 게이트웨이·이벤트 등 비-activity 노드를 건너뛰고
 * 한 activity 에서 다음 activity 로 도달하는 (source→target) 쌍을 산출.
 */
function collapseToActivityAdjacency(activityIds: Set<string>, forward: Map<string, string[]>): Array<{ from: string; to: string }> {
    const pairs: Array<{ from: string; to: string }> = [];
    const pairSeen = new Set<string>();

    for (const start of activityIds) {
        // start 에서 나가는 흐름을 따라 다음 activity 들을 BFS 로 탐색
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
 * 단일 BPMN 모델의 파싱 입력을 온톨로지 그래프로 변환.
 * modelKey는 여러 모델을 한 그래프에 합칠 때 노드 ID 충돌을 막기 위한 접두사.
 */
export function toOntology(input: OntologyParseInput, modelKey = ''): OntologyGraph {
    const prefix = modelKey ? `${modelKey}::` : '';
    const nodes: OntologyNode[] = [];
    const edges: OntologyEdge[] = [];
    const nodeIndex = new Map<string, OntologyNode>();
    const roleIndex = new Map<string, OntologyNode>();
    const systemIndex = new Map<string, OntologyNode>();

    const laneById = new Map<string, OntologyParseLane>();
    for (const lane of input.lanes) laneById.set(lane.element_id, lane);

    const addNode = (node: OntologyNode) => {
        if (!nodeIndex.has(node.id)) {
            nodeIndex.set(node.id, node);
            nodes.push(node);
        }
    };

    // 1) ProcessTask 노드 (FR-001) — activity 만
    const taskByElementId = new Map<string, OntologyNode>();
    for (const bnode of input.nodes) {
        if (!isActivity(bnode.element_type)) continue;
        const lane = bnode.lane_id ? laneById.get(bnode.lane_id) : undefined;
        const system = readProp(bnode.properties, 'usesSystem', 'uses_system');
        const manualUrl = readProp(bnode.properties, 'hasManual', 'has_manual', 'confluenceUrl', 'manualUrl');
        const lifecycle = readProp(bnode.properties, 'lifecycle', 'lifeCycle');
        const taskNode: OntologyNode = {
            id: `${prefix}${TASK_ID_PREFIX}${bnode.element_id}`,
            kind: 'ProcessTask',
            label: bnode.name || bnode.element_id,
            dimensions: {
                orgCode: lane ? laneOrgCode(lane) : undefined,
                orgName: lane ? laneOrgName(lane) || undefined : undefined,
                system: system || undefined,
                lifecycle: lifecycle || undefined
            },
            manualUrl,
            metrics: { inDegree: 0, outDegree: 0 },
            risk: null
        };
        addNode(taskNode);
        taskByElementId.set(bnode.element_id, taskNode);

        // 2) Role 노드 + :hasRole (FR-002, FR-005) — lane 조직명이 있을 때만
        if (lane) {
            const orgName = laneOrgName(lane);
            if (orgName) {
                const orgCode = laneOrgCode(lane);
                const roleId = `${prefix}${ROLE_ID_PREFIX}${orgCode}`;
                if (!roleIndex.has(roleId)) {
                    const roleNode: OntologyNode = {
                        id: roleId,
                        kind: 'Role',
                        label: orgName,
                        dimensions: { orgCode, orgName },
                        manualUrl: null,
                        metrics: { inDegree: 0, outDegree: 0 },
                        risk: null
                    };
                    roleIndex.set(roleId, roleNode);
                    addNode(roleNode);
                }
                edges.push({ id: `${taskNode.id}->hasRole->${roleId}`, source: taskNode.id, target: roleId, relation: ':hasRole' });
            }
        }

        // 3) System 노드 + :usesSystem (FR-003, FR-006) — usesSystem 값이 있을 때만
        if (system) {
            const systemId = `${prefix}${SYSTEM_ID_PREFIX}${system}`;
            if (!systemIndex.has(systemId)) {
                const systemNode: OntologyNode = {
                    id: systemId,
                    kind: 'System',
                    label: system,
                    dimensions: { system },
                    manualUrl: null,
                    metrics: { inDegree: 0, outDegree: 0 },
                    risk: null
                };
                systemIndex.set(systemId, systemNode);
                addNode(systemNode);
            }
            edges.push({ id: `${taskNode.id}->usesSystem->${systemId}`, source: taskNode.id, target: systemId, relation: ':usesSystem' });
        }

        // 4) :hasManual (FR-007) — Confluence URL 이 non-null 일 때만
        if (manualUrl) {
            edges.push({ id: `${taskNode.id}->hasManual`, source: taskNode.id, target: taskNode.id, relation: ':hasManual' });
        }
    }

    // 5) :isFollowedBy — sequenceFlow (FR-004), 게이트웨이·이벤트 축약
    const forward = new Map<string, string[]>();
    for (const link of input.links) {
        if (!forward.has(link.source_element_id)) forward.set(link.source_element_id, []);
        forward.get(link.source_element_id)!.push(link.target_element_id);
    }
    const activityIds = new Set(taskByElementId.keys());
    for (const { from, to } of collapseToActivityAdjacency(activityIds, forward)) {
        const src = taskByElementId.get(from)!;
        const tgt = taskByElementId.get(to)!;
        edges.push({ id: `${src.id}->isFollowedBy->${tgt.id}`, source: src.id, target: tgt.id, relation: ':isFollowedBy' });
        src.metrics.outDegree += 1;
        tgt.metrics.inDegree += 1;
    }

    return { nodes, edges, dimensionAxes: buildDimensionAxes(nodes) };
}

/** 여러 모델의 그래프를 하나로 병합(노드 dedup, 축 재산출). */
export function mergeGraphs(graphs: OntologyGraph[]): OntologyGraph {
    const nodeIndex = new Map<string, OntologyNode>();
    const edgeIndex = new Map<string, OntologyEdge>();
    for (const g of graphs) {
        for (const n of g.nodes) if (!nodeIndex.has(n.id)) nodeIndex.set(n.id, n);
        for (const e of g.edges) if (!edgeIndex.has(e.id)) edgeIndex.set(e.id, e);
    }
    const nodes = Array.from(nodeIndex.values());
    return { nodes, edges: Array.from(edgeIndex.values()), dimensionAxes: buildDimensionAxes(nodes) };
}
