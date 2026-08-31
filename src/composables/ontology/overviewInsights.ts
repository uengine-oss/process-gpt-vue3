/**
 * overviewInsights — 개요(Overview) 뷰 통계 카드·Top 인사이트 섹션 파생 (순수 함수).
 *
 * SAMPLE bpmn-process-kg `src/web/utils/overviewInsights.ts` +
 * `src/web/components/overview/SummaryCards.tsx` 통계 산출 번안 (specs/002 T065, FR-028).
 *  - computeOverviewStats: 통계 카드 6종(프로세스/활동/시스템/조직/인사이트 수/열린 태스크).
 *    인사이트 수는 SAMPLE countTotalInsights와 동일하게 랭킹 9개 카테고리 합산(spof 제외).
 *  - buildTopInsightSections: SAMPLE과 동일 7섹션(각 카테고리 1위 카드) + 딥링크 탭 키.
 *    모델링 품질 섹션은 metrics['인사이트 유형'] === '모델링 품질 보완' 카드 우선(SAMPLE
 *    firstModelingQuality 규칙), 없으면 1위 카드 폴백, 빈 카테고리는 null.
 *
 * 입력 insightsByCategory는 useOntologyGraph.insightsByCategory(카테고리 키 →
 * InsightCard[])와 동일한 record 형태를 받는다 — 상태 소유자(useOntologyGraph)가
 * computed로 감싸 배선한다(Wire 단계). Vue 반응성 없음 — 프레임워크 독립 순수 함수.
 */
import type { ProcessGraph } from '@/lib/processKg/graph/types';
import type { InsightCard } from '@/lib/processKg/analysis/types';

// ---------------------------------------------------------------------------
// 통계 카드 (SAMPLE SummaryCards + countTotalInsights 번안)
// ---------------------------------------------------------------------------

export interface OverviewStats {
    processes: number;
    activities: number;
    systems: number;
    organizations: number;
    insights: number;
    openTasks: number;
}

/**
 * SAMPLE countTotalInsights 합산 대상 카테고리 키(랭킹 9종 — spof 제외, 파리티).
 * 키는 useOntologyGraph.insightsByCategory / InsightListPanel 탭 키와 동일.
 */
const INSIGHT_TOTAL_CATEGORY_KEYS: ReadonlyArray<string> = [
    'bottleneck',
    'system_impact',
    'organization_coordination',
    'cross_org_handoff',
    'redesign',
    'automation',
    'enrichment',
    'reasoning_readiness',
    'modeling_quality',
];

/** SAMPLE SummaryCards countNodes 번안 — 그래프 노드 타입별 카운트(null 그래프는 0). */
function countNodesOfType(graph: ProcessGraph | null, type: string): number {
    if (!graph) return 0;
    let count = 0;
    for (const node of graph.nodes) {
        if (node.type === type) count += 1;
    }
    return count;
}

/** SAMPLE countTotalInsights 번안 — 랭킹 9개 카테고리 인사이트 총합(spof 제외). */
export function countTotalInsights(insightsByCategory: Record<string, InsightCard[]>): number {
    let total = 0;
    for (const key of INSIGHT_TOTAL_CATEGORY_KEYS) {
        total += insightsByCategory[key]?.length ?? 0;
    }
    return total;
}

/**
 * 개요 통계 카드 값 산출(FR-028).
 * SAMPLE SummaryCards와 동일: Process/ProcessActivity/System/Organization 노드 카운트
 * + 인사이트 총합(countTotalInsights) + 열린 데이터 태스크 수(호출측 산출 passthrough).
 */
export function computeOverviewStats(
    graph: ProcessGraph | null,
    insightsByCategory: Record<string, InsightCard[]>,
    openTaskCount: number
): OverviewStats {
    return {
        processes: countNodesOfType(graph, 'Process'),
        activities: countNodesOfType(graph, 'ProcessActivity'),
        systems: countNodesOfType(graph, 'System'),
        organizations: countNodesOfType(graph, 'Organization'),
        insights: countTotalInsights(insightsByCategory),
        openTasks: openTaskCount,
    };
}

// ---------------------------------------------------------------------------
// Top 인사이트 7섹션 (SAMPLE buildTopInsightSections 번안)
// ---------------------------------------------------------------------------

export interface TopInsightSection {
    /** 섹션 식별자(SAMPLE section id와 동일) */
    key: string;
    /** 한국어 섹션 제목 */
    title: string;
    /** 해당 카테고리 1위 카드(빈 카테고리는 null) */
    card: InsightCard | null;
    /** 상세 딥링크 대상 — InsightListPanel 탭 키 */
    targetTab: string;
}

/** SAMPLE firstInsight — 카테고리 1위 카드(각 랭커가 score 내림차순 정렬 보장). */
function firstInsight(cards: InsightCard[] | undefined): InsightCard | null {
    return cards?.[0] ?? null;
}

/**
 * SAMPLE firstModelingQuality — metrics['인사이트 유형'] === '모델링 품질 보완' 카드
 * 우선 선정, 없으면 1위 카드 폴백, 빈 카테고리는 null.
 */
function firstModelingQuality(cards: InsightCard[] | undefined): InsightCard | null {
    if (!cards || cards.length === 0) return null;
    return (
        cards.find((card) => card.metrics?.['인사이트 유형'] === '모델링 품질 보완') ??
        cards[0] ??
        null
    );
}

/**
 * 개요 Top 인사이트 섹션 구성(FR-028) — SAMPLE과 동일 7섹션·순서·선정 규칙.
 * targetTab은 InsightListPanel 탭 키로, 상태 소유자가 탭 딥링크에 사용한다.
 */
export function buildTopInsightSections(
    insightsByCategory: Record<string, InsightCard[]>
): TopInsightSection[] {
    return [
        {
            key: 'bottleneck',
            title: 'Top 구조적 병목 후보',
            card: firstInsight(insightsByCategory['bottleneck']),
            targetTab: 'bottleneck',
        },
        {
            key: 'impact',
            title: 'Top 시스템 영향도 후보',
            card: firstInsight(insightsByCategory['system_impact']),
            targetTab: 'system_impact',
        },
        {
            key: 'organization',
            title: 'Top 조직 조율 후보',
            card: firstInsight(insightsByCategory['organization_coordination']),
            targetTab: 'organization_coordination',
        },
        {
            key: 'redesign',
            title: 'Top 재설계 추천',
            card: firstInsight(insightsByCategory['redesign']),
            targetTab: 'redesign',
        },
        {
            key: 'automation',
            title: 'Top 자동화 후보',
            card: firstInsight(insightsByCategory['automation']),
            targetTab: 'automation',
        },
        {
            key: 'enrichment',
            title: 'Top 보강 추천',
            card: firstInsight(insightsByCategory['enrichment']),
            targetTab: 'enrichment',
        },
        {
            key: 'modeling',
            title: 'Top 모델링 품질 후보',
            card: firstModelingQuality(insightsByCategory['modeling_quality']),
            targetTab: 'modeling_quality',
        },
    ];
}
