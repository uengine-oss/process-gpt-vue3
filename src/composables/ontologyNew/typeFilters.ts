/**
 * typeFilters — 노드 유형(라벨)·엣지 유형(스타일 그룹) 필터 (가시성 파이프라인 단계).
 *
 * 레이어 토글이 밴드 단위 on/off 라면, 이 필터는 그 안에서 세부 유형을 고른다
 * (예: 테스크 레이어에서 Role 만 끄기, 구조 엣지(DEFINES/CONTAINS)만 숨기기).
 * 엣지는 유형 그룹이 켜져 있고 양끝 노드가 살아 있을 때만 남는다.
 */
import { EDGE_WHITELIST, LABEL_LAYER, edgeStyleClass } from './layerMapping';
import type { EdgeStyleClass } from './layerMapping';
import type { BusinessEdge, BusinessNode } from './types';

/** 필터 대상 전체 라벨 (활성 레이어 소속만 — config 는 호출부에서 주입) */
export const ALL_LABELS: string[] = Object.keys(LABEL_LAYER);

export const ALL_EDGE_GROUPS: EdgeStyleClass[] = ['thin', 'arrow', 'gateway', 'dashedThin', 'reference', 'inheritance'];

export const EDGE_GROUP_KO: Record<EdgeStyleClass, string> = {
    thin: '구조 (포함·정의·레인·소속)',
    arrow: '흐름·인과 (순서·기여·측정)',
    gateway: '관문 (수행·시스템·원천)',
    dashedThin: '보조 (호출·보유·담당)',
    reference: '스킬 참조',
    inheritance: '스킬 상속'
};

/** 그룹에 속하는 엣지 타입 나열 (패널 툴팁용) */
export function edgeTypesOfGroup(group: EdgeStyleClass): string[] {
    return Object.entries(EDGE_WHITELIST)
        .filter(([, g]) => g === group)
        .map(([type]) => type);
}

export function applyTypeFilters(
    nodes: BusinessNode[],
    edges: BusinessEdge[],
    visibleLabels: ReadonlySet<string>,
    visibleEdgeGroups: ReadonlySet<EdgeStyleClass>
): { nodes: BusinessNode[]; edges: BusinessEdge[] } {
    const filteredNodes = nodes.filter((n) => visibleLabels.has(n.label));
    const ids = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = edges.filter((e) => visibleEdgeGroups.has(edgeStyleClass(e.type)) && ids.has(e.source) && ids.has(e.target));
    return { nodes: filteredNodes, edges: filteredEdges };
}

/** 현재 그래프의 라벨별 노드 수 (필터 패널 카운트 표기) */
export function countByLabel(nodes: BusinessNode[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const n of nodes) counts[n.label] = (counts[n.label] ?? 0) + 1;
    return counts;
}
