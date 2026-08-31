/**
 * contextSlicer — 다차원 필터 + Depth 기반 Dynamic Context Slicing (순수 함수).
 *
 *  - applyFilters:      축 조건(본부·시스템·라이프사이클)에 부합하는 노드 집합 산출 (FR-012~014)
 *  - computeVisibility: focus 노드에서 BFS depth 이내 관련 노드만 유지, 나머지 fade-out (FR-015~017)
 *
 * fade-out 은 노드 제거가 아닌 opacity 토글이며, force 레이아웃 위치는 유지되어
 * 재레이아웃 없이 실시간 재렌더가 가능하다(SC-003).
 */
import type { OntologyEdge, OntologyGraph, SliceState, VisibilityMap } from './ontologyTypes';

const FADE_OPACITY = 0.06;

/** 노드의 특정 축 값을 SliceState.activeFilters 키에 맞춰 조회. */
function nodeAxisValue(dimensions: Record<string, string | undefined>, axisKey: string): string | undefined {
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

/**
 * 활성 필터에 부합하는 노드 ID 집합을 반환.
 * 축별 조건은 AND, 같은 축 내 값은 OR. 활성 조건이 없으면 전체 노드.
 */
export function applyFilters(graph: OntologyGraph, activeFilters: Record<string, string[]>): Set<string> {
    const activeAxes = Object.entries(activeFilters).filter(([, vals]) => vals && vals.length > 0);
    if (activeAxes.length === 0) return new Set(graph.nodes.map((n) => n.id));

    const result = new Set<string>();
    for (const node of graph.nodes) {
        const match = activeAxes.every(([axisKey, vals]) => {
            const v = nodeAxisValue(node.dimensions, axisKey);
            // 축 값이 없는 노드(예: 다른 종류)는 해당 축 조건에서 제외
            return v != null && vals.includes(v);
        });
        if (match) result.add(node.id);
    }
    return result;
}

/** 무방향 인접 리스트 구성(선후행·소속·사용 관계를 연관으로 취급). */
function buildAdjacency(edges: OntologyEdge[]): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    const link = (a: string, b: string) => {
        if (!adj.has(a)) adj.set(a, new Set());
        adj.get(a)!.add(b);
    };
    for (const e of edges) {
        if (e.source === e.target) continue; // self-loop(:hasManual) 은 연관 확장에서 제외
        link(e.source, e.target);
        link(e.target, e.source);
    }
    return adj;
}

/** focus 노드에서 depth 이내 도달 가능한 노드 집합(BFS). */
export function relatedWithinDepth(graph: OntologyGraph, focusNodeId: string, depth: number): Set<string> {
    const adj = buildAdjacency(graph.edges);
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

/**
 * 필터 + focus/Depth 를 합쳐 노드별 가시성 계산.
 *  1) 필터 부합 노드 집합 산출
 *  2) focus 지정 시 depth 이내 관련 노드로 추가 제한, 그 외는 fade-out
 */
export function computeVisibility(graph: OntologyGraph, sliceState: SliceState): VisibilityMap {
    const filtered = applyFilters(graph, sliceState.activeFilters);
    const related = sliceState.focusNodeId ? relatedWithinDepth(graph, sliceState.focusNodeId, sliceState.depth) : null;

    const map: VisibilityMap = {};
    for (const node of graph.nodes) {
        const passFilter = filtered.has(node.id);
        const passFocus = related ? related.has(node.id) : true;
        const visible = passFilter && passFocus;
        map[node.id] = { visible, opacity: visible ? 1 : FADE_OPACITY };
    }
    return map;
}
