/**
 * useAnalysisCache — 결정론 분석 레이어 eager 캐시 composable (specs/002 T034).
 *
 * SAMPLE(bpmn-process-kg) `src/web/hooks/useAnalysisCache.ts`의 Vue 번안.
 *  - 그래프 변경 시(watch + shallowRef 캐시): buildGraphIndex 1회 → 랭킹 분석 9종 + SPOF를
 *    limit 50으로 eager 계산(공유 인덱스 재사용 — 파리티+성능 요건, 계약 §2).
 *  - enrichment는 bottleneck/organization/system 인사이트를 입력으로 재사용(샘플과 동일 배선).
 *  - CQ1~CQ8·단일 시스템 영향도는 온디맨드 동기 실행.
 *  - 근거 서브그래프는 insightId 키 LRU 캐시(계약 §4, SAMPLE evidenceCache 번안).
 *  - 대형 배열은 shallowRef/computed로 깊은 반응성 없이 노출한다.
 *
 * 컴포넌트 밖(테스트 포함)에서도 호출 가능 — 라이프사이클 훅 미사용, watch({immediate:true})만 사용.
 */
import { computed, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import type { ProcessGraph } from '@/lib/processKg/graph/types';
import type { InsightCard } from '@/lib/processKg/analysis/types';
import { buildGraphIndex, type GraphIndex } from '@/lib/processKg/analysis/graphIndex';
import { rankStructuralBottleneckCandidates } from '@/lib/processKg/analysis/bottleneckAnalysis';
import {
    analyzeSingleSystemImpact as analyzeSingleSystemImpactFn,
    rankSystemBlastRadius,
} from '@/lib/processKg/analysis/impactAnalysis';
import { rankOrganizationCoordinationCandidates } from '@/lib/processKg/analysis/organizationAnalysis';
import { rankEnrichmentRecommendations } from '@/lib/processKg/analysis/enrichmentRecommendations';
import { rankRedesignRecommendations } from '@/lib/processKg/analysis/redesignRecommendations';
import { rankAutomationCandidates } from '@/lib/processKg/analysis/automationAnalysis';
import { rankCrossOrgHandoffHotspots } from '@/lib/processKg/analysis/crossOrgHandoffAnalysis';
import { rankReasoningReadiness } from '@/lib/processKg/analysis/readinessAnalysis';
import { rankModelingQualityIssues } from '@/lib/processKg/analysis/modelingQualityAnalysis';
import { rankSpofCandidates } from '@/lib/processKg/analysis/spofAnalysis';
import {
    answerActivitiesWithoutResponsibility as answerActivitiesWithoutResponsibilityFn,
    answerDataStoresReferencedByProcess as answerDataStoresReferencedByProcessFn,
    answerManualOnlyActivities as answerManualOnlyActivitiesFn,
    answerOrganizationsInvolvedInProcess as answerOrganizationsInvolvedInProcessFn,
    answerProcessesInvolvingOrganization as answerProcessesInvolvingOrganizationFn,
    answerProcessesUsingSystem as answerProcessesUsingSystemFn,
    answerSuppliersInvolvedInProcess as answerSuppliersInvolvedInProcessFn,
    answerSystemsUsedByProcess as answerSystemsUsedByProcessFn,
} from '@/lib/processKg/analysis/competencyQuestions';
import { buildEvidenceSubgraph } from '@/lib/processKg/analysis/evidence';
import { generateAnalysisReportMarkdown } from '@/lib/processKg/analysis/reportMarkdown';

/** 그래프당 eager 랭킹 상한(샘플 RANKING_CACHE_LIMIT과 동일) */
const RANKING_CACHE_LIMIT = 50;
/** 근거 서브그래프 LRU 상한(insightId 키) */
const EVIDENCE_CACHE_LIMIT = 100;

/** SPOF 펄스용 위험 유형(기존 spofAnalyzer risk.type과 동일 값) */
export type SpofRiskType = 'SPOF' | 'StructuralDefect';

/** 근거 서브그래프 뷰(SAMPLE EvidenceSubgraphView와 동일 형태) */
export interface EvidenceSubgraphView {
    nodeIds: Set<string>;
    edgeIds: Set<string>;
}

/**
 * SAMPLE `src/web/utils/evidenceCache.ts` 번안 + LRU 상한(계약 §4).
 * Map 삽입 순서를 recency로 사용: 적중 시 재삽입, 상한 초과 시 가장 오래된 항목 축출.
 */
export function createEvidenceCache(limit: number = EVIDENCE_CACHE_LIMIT) {
    const cache = new Map<string, EvidenceSubgraphView>();

    return {
        get(insightId: string): EvidenceSubgraphView | undefined {
            const existing = cache.get(insightId);
            if (existing) {
                cache.delete(insightId);
                cache.set(insightId, existing);
            }
            return existing;
        },
        set(insightId: string, value: EvidenceSubgraphView): void {
            cache.delete(insightId);
            cache.set(insightId, value);
            if (cache.size > limit) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) cache.delete(oldest);
            }
        },
        clear(): void {
            cache.clear();
        },
        getOrCompute(insightId: string, compute: () => EvidenceSubgraphView): EvidenceSubgraphView {
            const existing = this.get(insightId);
            if (existing) return existing;
            const value = compute();
            this.set(insightId, value);
            return value;
        },
    };
}

export type EvidenceCache = ReturnType<typeof createEvidenceCache>;

const IS_DEV: boolean = Boolean(
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
);

/** SAMPLE `src/web/utils/perf.ts` measure 번안 — DEV에서만 계측 로그. */
function measure<T>(label: string, fn: () => T): T {
    if (!IS_DEV) return fn();
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    console.info(`[perf] ${label}: ${elapsed.toFixed(1)}ms`);
    return result;
}

/** spof 카드에서 위험 유형 추출(metrics.riskType 우선, 카드 식별자 폴백). */
function spofRiskTypeOf(card: InsightCard): SpofRiskType {
    const raw = card.metrics?.riskType;
    if (raw === 'SPOF' || raw === 'StructuralDefect') return raw;
    return /StructuralDefect/i.test(`${card.id} ${card.title}`) ? 'StructuralDefect' : 'SPOF';
}

export interface UseAnalysisCacheOptions {
    /** 리포트에 샘플 그래프 범위 주석 추가 여부(SAMPLE graphSource.isSample 대응) */
    isSampleGraph?: boolean;
}

export interface UseAnalysisCacheResult {
    graphIndex: ComputedRef<GraphIndex | null>;
    // 카테고리별 eager 인사이트(limit 50, score 내림차순 — 각 분석 함수가 정렬 보장)
    bottleneckInsights: ComputedRef<InsightCard[]>;
    systemBlastRadiusInsights: ComputedRef<InsightCard[]>;
    organizationCoordinationInsights: ComputedRef<InsightCard[]>;
    enrichmentRecommendations: ComputedRef<InsightCard[]>;
    redesignRecommendations: ComputedRef<InsightCard[]>;
    automationCandidates: ComputedRef<InsightCard[]>;
    crossOrgHandoffHotspots: ComputedRef<InsightCard[]>;
    reasoningReadinessInsights: ComputedRef<InsightCard[]>;
    modelingQualityInsights: ComputedRef<InsightCard[]>;
    spofInsights: ComputedRef<InsightCard[]>;
    /** 전 카테고리 병합, score 내림차순 */
    allInsights: ComputedRef<InsightCard[]>;
    /** SPOF 펄스용 — spof 카드 metrics.nodeId → 위험 유형 */
    riskNodeIds: ComputedRef<Map<string, SpofRiskType>>;
    generateReport: () => string;
    getEvidenceSubgraph: (insight: InsightCard) => EvidenceSubgraphView;
    // CQ 온디맨드 콜백(SAMPLE CQPanel 사용 목록과 동일)
    answerSystemsUsedByProcess: (processId: string) => InsightCard;
    answerProcessesUsingSystem: (systemId: string) => InsightCard;
    answerOrganizationsInvolvedInProcess: (processId: string) => InsightCard;
    answerProcessesInvolvingOrganization: (organizationId: string) => InsightCard;
    answerSuppliersInvolvedInProcess: (processId: string) => InsightCard;
    answerDataStoresReferencedByProcess: (processId: string) => InsightCard;
    answerManualOnlyActivities: () => InsightCard;
    answerActivitiesWithoutResponsibility: () => InsightCard;
    analyzeSingleSystemImpact: (systemId: string) => InsightCard;
}

export function useAnalysisCache(
    graph: Ref<ProcessGraph | null>,
    options?: UseAnalysisCacheOptions
): UseAnalysisCacheResult {
    const evidenceCache = createEvidenceCache();

    const graphIndexRef = shallowRef<GraphIndex | null>(null);
    const bottleneckRef = shallowRef<InsightCard[]>([]);
    const systemBlastRadiusRef = shallowRef<InsightCard[]>([]);
    const organizationCoordinationRef = shallowRef<InsightCard[]>([]);
    const enrichmentRef = shallowRef<InsightCard[]>([]);
    const redesignRef = shallowRef<InsightCard[]>([]);
    const automationRef = shallowRef<InsightCard[]>([]);
    const crossOrgHandoffRef = shallowRef<InsightCard[]>([]);
    const reasoningReadinessRef = shallowRef<InsightCard[]>([]);
    const modelingQualityRef = shallowRef<InsightCard[]>([]);
    const spofRef = shallowRef<InsightCard[]>([]);

    const rankingRefs = [
        bottleneckRef,
        systemBlastRadiusRef,
        organizationCoordinationRef,
        enrichmentRef,
        redesignRef,
        automationRef,
        crossOrgHandoffRef,
        reasoningReadinessRef,
        modelingQualityRef,
        spofRef,
    ];

    /** 그래프 교체 시 인덱스 1회 생성 후 랭킹 분석 9종 + SPOF를 eager 재계산. */
    watch(
        graph,
        (g) => {
            evidenceCache.clear();

            if (!g) {
                graphIndexRef.value = null;
                for (const r of rankingRefs) r.value = [];
                return;
            }

            const index = measure('buildGraphIndex', () => buildGraphIndex(g));
            graphIndexRef.value = index;

            const limitOpt = { limit: RANKING_CACHE_LIMIT };
            const bottleneck = measure('rankStructuralBottleneckCandidates', () =>
                rankStructuralBottleneckCandidates(g, limitOpt, index)
            );
            const systemBlastRadius = measure('rankSystemBlastRadius', () =>
                rankSystemBlastRadius(g, limitOpt, index)
            );
            const organizationCoordination = measure('rankOrganizationCoordinationCandidates', () =>
                rankOrganizationCoordinationCandidates(g, limitOpt, index)
            );

            bottleneckRef.value = bottleneck;
            systemBlastRadiusRef.value = systemBlastRadius;
            organizationCoordinationRef.value = organizationCoordination;
            // enrichment는 위 세 결과를 입력으로 재사용(샘플과 동일 배선 — 재계산 금지)
            enrichmentRef.value = measure('rankEnrichmentRecommendations', () =>
                rankEnrichmentRecommendations(g, limitOpt, index, {
                    bottleneckInsights: bottleneck,
                    organizationInsights: organizationCoordination,
                    systemImpactInsights: systemBlastRadius,
                })
            );
            redesignRef.value = measure('rankRedesignRecommendations', () =>
                rankRedesignRecommendations(g, limitOpt, index)
            );
            automationRef.value = measure('rankAutomationCandidates', () =>
                rankAutomationCandidates(g, limitOpt, index)
            );
            crossOrgHandoffRef.value = measure('rankCrossOrgHandoffHotspots', () =>
                rankCrossOrgHandoffHotspots(g, limitOpt, index)
            );
            reasoningReadinessRef.value = measure('rankReasoningReadiness', () =>
                rankReasoningReadiness(g, limitOpt, index)
            );
            modelingQualityRef.value = measure('rankModelingQualityIssues', () =>
                rankModelingQualityIssues(g, limitOpt, index)
            );
            spofRef.value = measure('rankSpofCandidates', () =>
                rankSpofCandidates(g, limitOpt, index)
            );
        },
        { immediate: true }
    );

    const allInsights = computed<InsightCard[]>(() =>
        rankingRefs
            .flatMap((r) => r.value)
            .slice()
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    );

    /** spof 카드 → 노드별 위험 유형 맵(붉은 펄스 시각화용, FR-014). */
    const riskNodeIds = computed<Map<string, SpofRiskType>>(() => {
        const map = new Map<string, SpofRiskType>();
        for (const card of spofRef.value) {
            const nodeId = card.metrics?.nodeId;
            if (typeof nodeId !== 'string' || !nodeId) continue;
            map.set(nodeId, spofRiskTypeOf(card));
        }
        return map;
    });

    function requireGraph(): ProcessGraph {
        const g = graph.value;
        if (!g) throw new Error('Graph not loaded');
        return g;
    }

    function currentIndex(): GraphIndex | undefined {
        return graphIndexRef.value ?? undefined;
    }

    function generateReport(): string {
        const g = graph.value;
        if (!g) return '';
        return measure('generateAnalysisReportMarkdown', () =>
            generateAnalysisReportMarkdown(g, {
                isSampleGraph: options?.isSampleGraph ?? false,
                graphIndex: currentIndex(),
            })
        );
    }

    function getEvidenceSubgraph(insight: InsightCard): EvidenceSubgraphView {
        const g = graph.value;
        if (!g) {
            return { nodeIds: new Set(), edgeIds: new Set() };
        }
        return evidenceCache.getOrCompute(insight.id, () => {
            const subgraph = measure('buildEvidenceSubgraph', () =>
                buildEvidenceSubgraph(g, insight)
            );
            return { nodeIds: subgraph.nodeIds, edgeIds: subgraph.edgeIds };
        });
    }

    return {
        graphIndex: computed(() => graphIndexRef.value),
        bottleneckInsights: computed(() => bottleneckRef.value),
        systemBlastRadiusInsights: computed(() => systemBlastRadiusRef.value),
        organizationCoordinationInsights: computed(() => organizationCoordinationRef.value),
        enrichmentRecommendations: computed(() => enrichmentRef.value),
        redesignRecommendations: computed(() => redesignRef.value),
        automationCandidates: computed(() => automationRef.value),
        crossOrgHandoffHotspots: computed(() => crossOrgHandoffRef.value),
        reasoningReadinessInsights: computed(() => reasoningReadinessRef.value),
        modelingQualityInsights: computed(() => modelingQualityRef.value),
        spofInsights: computed(() => spofRef.value),
        allInsights,
        riskNodeIds,
        generateReport,
        getEvidenceSubgraph,
        answerSystemsUsedByProcess: (processId: string) =>
            answerSystemsUsedByProcessFn(requireGraph(), processId, currentIndex()),
        answerProcessesUsingSystem: (systemId: string) =>
            answerProcessesUsingSystemFn(requireGraph(), systemId, currentIndex()),
        answerOrganizationsInvolvedInProcess: (processId: string) =>
            answerOrganizationsInvolvedInProcessFn(requireGraph(), processId, currentIndex()),
        answerProcessesInvolvingOrganization: (organizationId: string) =>
            answerProcessesInvolvingOrganizationFn(requireGraph(), organizationId, currentIndex()),
        answerSuppliersInvolvedInProcess: (processId: string) =>
            answerSuppliersInvolvedInProcessFn(requireGraph(), processId),
        answerDataStoresReferencedByProcess: (processId: string) =>
            answerDataStoresReferencedByProcessFn(requireGraph(), processId),
        answerManualOnlyActivities: () => answerManualOnlyActivitiesFn(requireGraph()),
        answerActivitiesWithoutResponsibility: () =>
            answerActivitiesWithoutResponsibilityFn(requireGraph()),
        analyzeSingleSystemImpact: (systemId: string) =>
            analyzeSingleSystemImpactFn(requireGraph(), systemId, currentIndex()),
    };
}

export type UseAnalysisCache = ReturnType<typeof useAnalysisCache>;
