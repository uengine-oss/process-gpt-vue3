/**
 * @deprecated specs/002 — src/lib/processKg 로 대체됨(다음 정리 시 삭제 예정).
 * 대체 경로: src/lib/processKg/analysis/spofAnalysis.ts (rankSpofCandidates).
 *
 * spofAnalyzer — 그래프 지표 기반 SPOF/구조적 결함 후보 산출 (순수 함수, FR-018).
 *
 * AI 자연어 리포트(SpofReasoningGenerator) 이전의 1차 탐지 단계.
 *  - SPOF: 관절점(articulation point) — 제거 시 그래프가 분리되는 노드
 *  - StructuralDefect: 과도한 fan-in/fan-out(병목) 노드
 * 각 후보에 impactedProcessCount(도달 가능 ProcessTask 수)·fte(dimensions 집계) 지표를
 * 계산해 node.risk / node.metrics 에 첨부한다(FR-021). 결함이 없으면 빈 후보(Edge Case).
 */
import type { OntologyGraph, OntologyNode } from './ontologyTypes';

// 게이트웨이 축약으로 :isFollowedBy 인접이 pairwise 확장되어 degree가 부풀므로 임계값을 보수적으로 잡는다.
// Role/System 허브는 설계상 고차수(모든 소속 task 연결)라 병목 판정에서 제외하고,
// 관절점(SPOF)도 Role 은 제외해 위험 표시가 실제 구조 리스크에 집중되게 한다(가독성).
const BOTTLENECK_DEGREE = 8;

function buildAdjacency(graph: OntologyGraph): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    const link = (a: string, b: string) => {
        if (!adj.has(a)) adj.set(a, new Set());
        adj.get(a)!.add(b);
    };
    for (const n of graph.nodes) if (!adj.has(n.id)) adj.set(n.id, new Set());
    for (const e of graph.edges) {
        if (e.source === e.target) continue;
        link(e.source, e.target);
        link(e.target, e.source);
    }
    return adj;
}

/** Tarjan 기반 관절점 탐색(무방향). */
function findArticulationPoints(adj: Map<string, Set<string>>): Set<string> {
    const ids = Array.from(adj.keys());
    const disc = new Map<string, number>();
    const low = new Map<string, number>();
    const visited = new Set<string>();
    const aps = new Set<string>();
    let timer = 0;

    const dfs = (root: string) => {
        // 반복 DFS(스택 오버플로 방지)
        const stack: Array<{ u: string; parent: string | null; iter: Iterator<string>; children: number }> = [];
        visited.add(root);
        disc.set(root, timer);
        low.set(root, timer);
        timer++;
        stack.push({ u: root, parent: null, iter: (adj.get(root) || new Set()).values(), children: 0 });

        while (stack.length) {
            const frame = stack[stack.length - 1];
            const next = frame.iter.next();
            if (!next.done) {
                const v = next.value;
                if (v === frame.parent) continue;
                if (!visited.has(v)) {
                    visited.add(v);
                    disc.set(v, timer);
                    low.set(v, timer);
                    timer++;
                    frame.children++;
                    stack.push({ u: v, parent: frame.u, iter: (adj.get(v) || new Set()).values(), children: 0 });
                } else {
                    low.set(frame.u, Math.min(low.get(frame.u)!, disc.get(v)!));
                }
            } else {
                stack.pop();
                const parentFrame = stack[stack.length - 1];
                if (parentFrame) {
                    low.set(parentFrame.u, Math.min(low.get(parentFrame.u)!, low.get(frame.u)!));
                    if (parentFrame.parent !== null && low.get(frame.u)! >= disc.get(parentFrame.u)!) {
                        aps.add(parentFrame.u);
                    }
                }
                if (frame.parent === null && frame.children > 1) {
                    aps.add(frame.u);
                }
            }
        }
    };

    for (const id of ids) if (!visited.has(id)) dfs(id);
    return aps;
}

/** focus 노드에서 도달 가능한 ProcessTask 수(영향 프로세스 수, FR-021). */
function reachableProcessCount(graph: OntologyGraph, startId: string, adj: Map<string, Set<string>>): number {
    const kindById = new Map(graph.nodes.map((n) => [n.id, n.kind] as const));
    const visited = new Set<string>([startId]);
    const queue = [startId];
    let count = 0;
    while (queue.length) {
        const cur = queue.shift()!;
        if (cur !== startId && kindById.get(cur) === 'ProcessTask') count++;
        for (const nb of adj.get(cur) || []) if (!visited.has(nb)) visited.add(nb), queue.push(nb);
    }
    return count;
}

/** 후보 노드 FTE 추정 — 조직/시스템 연관 규모의 근사(맥락 지표). */
function estimateFte(node: OntologyNode, impacted: number): number {
    const base = node.kind === 'System' ? 1.5 : node.kind === 'Role' ? 2 : 1;
    return Math.round((base + impacted * 0.5) * 10) / 10;
}

export interface SpofAnalysis {
    candidates: OntologyNode[];
}

/**
 * 그래프를 분석해 위험 후보를 태깅하고 반환. graph.nodes 의 risk/metrics 를 변이한다.
 */
export function analyzeSpof(graph: OntologyGraph): SpofAnalysis {
    // 기존 위험 태깅 초기화
    for (const n of graph.nodes) n.risk = null;

    const adj = buildAdjacency(graph);
    const aps = findArticulationPoints(adj);
    const candidates: OntologyNode[] = [];

    for (const node of graph.nodes) {
        const degree = (adj.get(node.id) || new Set()).size;
        const isSpof = node.kind !== 'Role' && aps.has(node.id) && degree >= 2;
        const isBottleneck = node.kind === 'ProcessTask' && node.metrics.inDegree + node.metrics.outDegree >= BOTTLENECK_DEGREE;
        if (!isSpof && !isBottleneck) continue;

        const impacted = reachableProcessCount(graph, node.id, adj);
        node.metrics.impactedProcessCount = impacted;
        node.metrics.fte = estimateFte(node, impacted);
        node.risk = { isRisk: true, type: isSpof ? 'SPOF' : 'StructuralDefect' };
        candidates.push(node);
    }

    return { candidates };
}
