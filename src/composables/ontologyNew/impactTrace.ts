/**
 * impactTrace — 역추적(rootCause)/순추적(contribution) 클라이언트 BFS
 * (specs/005 data-model.md §4 방향 규칙표, research.md R7).
 *
 * 로드된 비즈니스 서브그래프 위에서 엣지 라벨별 순회 방향 규칙을 적용해
 * 경로(노드·엣지 집합)와 원인 후보·경고를 산출한다. 방문 집합으로 순환을
 * 차단하고(cycle-detected 경고), CALLS 재귀는 1회로 제한한다.
 */
import { isWhitelistedEdge } from './layerMapping';
import type {
    ActivityRollup,
    BusinessEdge,
    BusinessNode,
    CauseCandidate,
    CauseReason,
    ImpactTrace,
    TraceMode,
    TraceWarning
} from './types';

interface TraceGraph {
    nodes: BusinessNode[];
    edges: BusinessEdge[];
}

/** 순회 규칙: 현재 노드 라벨에서 (엣지 타입, 방향) 으로 확장. dir 'out' = source→target */
type TraceRule = { label: string; edge: string; dir: 'out' | 'in' };

/** 역추적(원인 탐색) — KPI/Objective 에서 상향(전략)+하향(프로세스→리소스/스킬) */
const ROOT_CAUSE_RULES: TraceRule[] = [
    // 상향 전파: 경고가 번지는 전략 계보
    { label: 'KPI', edge: 'MEASURES', dir: 'out' },
    { label: 'Objective', edge: 'CONTRIBUTES_TO', dir: 'out' },
    // 하향 원인: 전략 → 프로세스 (형제 KPI 로의 확산 방지 — MEASURES 역방향은 규칙에 없음)
    { label: 'KPI', edge: 'SOURCED_FROM', dir: 'out' },
    { label: 'Objective', edge: 'DRIVES', dir: 'in' },
    { label: 'Initiative', edge: 'REALIZED_BY', dir: 'out' },
    // 프로세스 내부
    { label: 'ProcessDefinition', edge: 'DEFINES', dir: 'out' },
    { label: 'Activity', edge: 'FLOWS_TO', dir: 'out' },
    { label: 'Activity', edge: 'CALLS', dir: 'out' }, // depth 1 제한 (아래 BFS)
    // 리소스/스킬
    { label: 'Activity', edge: 'IN_LANE', dir: 'out' },
    { label: 'Role', edge: 'RESOLVES_TO', dir: 'out' },
    { label: 'Activity', edge: 'PERFORMED_BY_AGENT', dir: 'out' },
    { label: 'Activity', edge: 'PI_USES_SYSTEM', dir: 'out' },
    { label: 'Activity', edge: 'PI_USES_SERVICE', dir: 'out' },
    { label: 'Activity', edge: 'REQUIRES_SKILL', dir: 'out' },
    { label: 'Agent', edge: 'HAS_SKILL', dir: 'out' },
    { label: 'Skill', edge: 'EXTENDS', dir: 'out' }
];

/** 순추적(기여 탐색) — Skill/Agent/User/Team/Activity 에서 전략까지 상향 */
const CONTRIBUTION_RULES: TraceRule[] = [
    { label: 'Skill', edge: 'REQUIRES_SKILL', dir: 'in' },
    { label: 'Skill', edge: 'HAS_SKILL', dir: 'in' },
    { label: 'Skill', edge: 'EXTENDS', dir: 'in' }, // 이 스킬을 상속한 파생 스킬도 개선 수혜
    { label: 'Agent', edge: 'PERFORMED_BY_AGENT', dir: 'in' },
    { label: 'Agent', edge: 'RESOLVES_TO', dir: 'in' }, // 에이전트로 해석된 레인 경유 상향
    { label: 'Agent', edge: 'HAS_SKILL', dir: 'out' },
    { label: 'PiSystem', edge: 'PI_USES_SYSTEM', dir: 'in' }, // 이 시스템을 쓰는 테스크
    { label: 'PiService', edge: 'PI_USES_SERVICE', dir: 'in' },
    { label: 'User', edge: 'RESOLVES_TO', dir: 'in' },
    { label: 'Team', edge: 'RESOLVES_TO', dir: 'in' },
    { label: 'Role', edge: 'IN_LANE', dir: 'in' },
    { label: 'Activity', edge: 'DEFINES', dir: 'in' },
    { label: 'ProcessDefinition', edge: 'CALLS', dir: 'in' }, // 상위 정의의 호출 지점
    { label: 'ProcessDefinition', edge: 'SOURCED_FROM', dir: 'in' },
    { label: 'ProcessDefinition', edge: 'REALIZED_BY', dir: 'in' },
    { label: 'Initiative', edge: 'DRIVES', dir: 'out' },
    { label: 'KPI', edge: 'MEASURES', dir: 'out' },
    { label: 'Objective', edge: 'CONTRIBUTES_TO', dir: 'out' }
];

const CAUSE_REASON_ORDER: CauseReason[] = [
    'bottleneck',
    'agent-performance',
    'system-dependency',
    'skill-dependency',
    'unresolved-role',
    'no-execution-link'
];

function isUnknownRole(node: BusinessNode): boolean {
    return node.label === 'Role' && (node.properties?.name === 'Unknown' || node.name === 'Unknown');
}

/** 특정 엣지 타입(EXTENDS/CONTRIBUTES_TO 등 DAG 기대)의 방문 서브그래프 순환 검출 */
function hasCycle(edges: BusinessEdge[], type: string, within: Set<string>): boolean {
    const adj = new Map<string, string[]>();
    for (const e of edges) {
        if (e.type !== type || !within.has(e.source) || !within.has(e.target)) continue;
        if (!adj.has(e.source)) adj.set(e.source, []);
        adj.get(e.source)!.push(e.target);
    }
    const state = new Map<string, 1 | 2>(); // 1=방문중, 2=완료
    const dfs = (id: string): boolean => {
        state.set(id, 1);
        for (const next of adj.get(id) ?? []) {
            const s = state.get(next);
            if (s === 1) return true;
            if (!s && dfs(next)) return true;
        }
        state.set(id, 2);
        return false;
    };
    for (const id of adj.keys()) {
        if (!state.has(id) && dfs(id)) return true;
    }
    return false;
}

export function computeImpactTrace(
    graph: TraceGraph,
    originId: string,
    mode: TraceMode,
    activityRollupByNodeId?: Map<string, ActivityRollup> | null
): ImpactTrace {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));
    const origin = nodeById.get(originId);
    const warnings: TraceWarning[] = [];
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    if (!origin) {
        return { originId, mode, nodeIds, edgeIds, causeCandidates: [], warnings };
    }

    // 인접 인덱스
    const outEdges = new Map<string, BusinessEdge[]>();
    const inEdges = new Map<string, BusinessEdge[]>();
    for (const e of graph.edges) {
        if (!outEdges.has(e.source)) outEdges.set(e.source, []);
        if (!inEdges.has(e.target)) inEdges.set(e.target, []);
        outEdges.get(e.source)!.push(e);
        inEdges.get(e.target)!.push(e);
    }

    const rules = mode === 'rootCause' ? ROOT_CAUSE_RULES : CONTRIBUTION_RULES;
    const rulesByLabel = new Map<string, TraceRule[]>();
    for (const rule of rules) {
        if (!rulesByLabel.has(rule.label)) rulesByLabel.set(rule.label, []);
        rulesByLabel.get(rule.label)!.push(rule);
    }

    // BFS — 방문 집합으로 순환 차단(V3), CALLS 재귀 1회 제한
    const queue: Array<{ id: string; callsDepth: number }> = [{ id: originId, callsDepth: 0 }];
    nodeIds.add(originId);

    while (queue.length) {
        const { id, callsDepth } = queue.shift()!;
        const node = nodeById.get(id);
        if (!node) continue;

        // 미해석 역할 — 단절 지점 표기 후 그 아래로 확장 중단 (FR-019)
        if (isUnknownRole(node)) {
            if (!warnings.some((w) => w.kind === 'unknown-role' && w.nodeId === id)) {
                warnings.push({
                    kind: 'unknown-role',
                    nodeId: id,
                    message: '미해석 역할(Unknown) — 수행 주체를 확정할 수 없어 경로가 끊깁니다'
                });
            }
            continue;
        }

        for (const rule of rulesByLabel.get(node.label) ?? []) {
            if (rule.edge === 'CALLS' && rule.dir === 'out' && callsDepth >= 1) continue;
            const candidates = rule.dir === 'out' ? outEdges.get(id) ?? [] : inEdges.get(id) ?? [];
            for (const e of candidates) {
                if (e.type !== rule.edge) continue;
                const nextId = rule.dir === 'out' ? e.target : e.source;
                if (!nodeById.has(nextId)) continue;
                edgeIds.add(e.id);
                if (nodeIds.has(nextId)) continue;
                nodeIds.add(nextId);
                queue.push({
                    id: nextId,
                    callsDepth: rule.edge === 'CALLS' ? callsDepth + 1 : callsDepth
                });
            }
        }
    }

    // 방문 노드 사이의 화이트리스트 엣지를 근거 서브그래프에 포함(문맥 판독성)
    for (const e of graph.edges) {
        if (isWhitelistedEdge(e.type) && nodeIds.has(e.source) && nodeIds.has(e.target)) {
            edgeIds.add(e.id);
        }
    }

    // 순환 경고 — DAG 기대 엣지(EXTENDS·CONTRIBUTES_TO)에 한정
    for (const dagType of ['EXTENDS', 'CONTRIBUTES_TO']) {
        if (hasCycle(graph.edges, dagType, nodeIds)) {
            warnings.push({
                kind: 'cycle-detected',
                nodeId: originId,
                message: `${dagType} 관계에 순환이 있습니다 (DAG 위반 데이터) — 순회는 방문 집합으로 안전하게 종료됨`
            });
        }
    }

    // 전략-실행 단절 — KPI 인데 SOURCED_FROM 이 없음 (FR-018)
    const causeCandidates: CauseCandidate[] = [];
    if (mode === 'rootCause') {
        const originIsKpi = origin.label === 'KPI';
        const hasSource = (outEdges.get(originId) ?? []).some((e) => e.type === 'SOURCED_FROM');
        if (originIsKpi && !hasSource) {
            warnings.push({
                kind: 'strategy-execution-gap',
                nodeId: originId,
                message: '이 KPI 는 원천 프로세스 연결(SOURCED_FROM)이 없습니다 — 전략-실행 단절'
            });
            causeCandidates.push({ nodeId: originId, metrics: null, reason: 'no-execution-link' });
        }

        for (const id of nodeIds) {
            if (id === originId) continue;
            const node = nodeById.get(id)!;
            if (node.label === 'Activity') {
                causeCandidates.push({
                    nodeId: id,
                    metrics: activityRollupByNodeId?.get(id) ?? null,
                    reason: 'bottleneck'
                });
            } else if (node.label === 'Agent') {
                causeCandidates.push({ nodeId: id, metrics: null, reason: 'agent-performance' });
            } else if (node.label === 'PiSystem' || node.label === 'PiService') {
                causeCandidates.push({ nodeId: id, metrics: null, reason: 'system-dependency' });
            } else if (node.label === 'Skill') {
                causeCandidates.push({ nodeId: id, metrics: null, reason: 'skill-dependency' });
            } else if (isUnknownRole(node)) {
                causeCandidates.push({ nodeId: id, metrics: null, reason: 'unresolved-role' });
            }
        }

        // 정렬: 집계 있는 후보 우선(평균 소요 → 재작업 → 진행 건수 내림차순),
        // 집계 없음은 후순위 강등(FR-010), 이유 그룹 순서로 안정 정렬
        causeCandidates.sort((a, b) => {
            const am = a.metrics;
            const bm = b.metrics;
            if (am && bm) {
                return (
                    (bm.avgDurationHours ?? 0) - (am.avgDurationHours ?? 0) ||
                    bm.reworkSum - am.reworkSum ||
                    bm.inProgressCount - am.inProgressCount ||
                    a.nodeId.localeCompare(b.nodeId)
                );
            }
            if (am) return -1;
            if (bm) return 1;
            return CAUSE_REASON_ORDER.indexOf(a.reason) - CAUSE_REASON_ORDER.indexOf(b.reason) || a.nodeId.localeCompare(b.nodeId);
        });
    }

    return { originId, mode, nodeIds, edgeIds, causeCandidates, warnings };
}

/** 노드 레이어/라벨 기준 추적 진입 가능 모드 (상세 패널 버튼 노출 규칙) */
export function availableTraceMode(node: BusinessNode): TraceMode | null {
    if (node.label === 'KPI' || node.label === 'Objective') return 'rootCause';
    if (node.layer === 'resource' || node.layer === 'knowledge') return 'contribution';
    return null;
}
