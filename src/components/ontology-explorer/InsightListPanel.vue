<template>
    <div class="insight-list-panel">
        <div class="panel-title">인사이트</div>

        <!-- 카테고리 탭 (10종 고정 순서 + 모듈 통합 탭, specs/002 T036/T067) -->
        <div class="category-tabs">
            <button
                v-for="tab in CATEGORY_TABS"
                :key="tab.key"
                type="button"
                class="category-tab"
                :class="{ 'category-tab--active': activeCategory === tab.key }"
                @click="activeCategory = tab.key"
            >
                {{ tab.label }}
                <v-chip
                    size="x-small"
                    density="comfortable"
                    :color="activeCategory === tab.key ? 'primary' : undefined"
                    :variant="countOf(tab.key) > 0 ? 'tonal' : 'text'"
                    class="tab-count"
                >
                    {{ countOf(tab.key) }}
                </v-chip>
            </button>
        </div>

        <!-- 보강 탭: 데이터 격차 통합 보기 (enrichment+modeling_quality 병합, FR-031) -->
        <div v-if="activeCategory === 'enrichment'" class="gap-merge-row">
            <v-switch
                v-model="dataGapMerged"
                density="compact"
                color="primary"
                hide-details
                label="데이터 격차 통합 보기"
                class="gap-merge-switch"
            />
        </div>

        <!-- 카테고리 내 유형 필터 (재설계/자동화/보강, FR-031) -->
        <div v-if="typeFilterOptions.length" class="type-filter-row">
            <span class="type-filter-label">유형 필터</span>
            <v-select
                v-model="typeFilters[activeCategory]"
                :items="typeFilterOptions"
                item-title="label"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                class="type-filter-select"
            />
        </div>

        <!-- 표시 제한 토글 Top 20/50 (FR-033) — 슬라이스는 표시에만 적용 -->
        <div class="limit-row">
            <span class="limit-label">표시</span>
            <button
                v-for="n in DISPLAY_LIMIT_OPTIONS"
                :key="n"
                type="button"
                class="limit-btn"
                :class="{ 'limit-btn--active': displayLimit === n }"
                @click="emit('update:displayLimit', n)"
            >
                Top {{ n }}
            </button>
            <span v-if="largeGraph" class="limit-note">
                대규모 그래프: 성능을 위해 상위 {{ displayLimit }}개만 표시
            </span>
        </div>

        <!-- 활성 카테고리 카드 목록: 심각도(high>medium>info) → score desc (모듈/격차 통합은 score desc) -->
        <div v-if="!visibleCards.length" class="panel-empty">해당 없음</div>
        <div v-else class="card-rows">
            <div
                v-for="card in visibleCards"
                :key="card.id"
                class="card-row"
                :class="{ 'card-row--active': card.id === activeInsightId }"
                role="button"
                tabindex="0"
                @click="emit('select-insight', card)"
                @keydown.enter="emit('select-insight', card)"
            >
                <InsightCardView :card="card" compact class="card-row-body" />
                <span
                    class="status-dot"
                    :style="{ background: statusMeta(card.id).color }"
                    :title="'검토 상태: ' + statusMeta(card.id).label"
                    :aria-label="'검토 상태: ' + statusMeta(card.id).label"
                    role="img"
                />
                <button
                    type="button"
                    class="evidence-btn"
                    title="근거 보기"
                    aria-label="근거 보기"
                    @click.stop="emit('show-evidence', card)"
                >
                    <v-icon icon="mdi-graph-outline" size="16" />
                </button>
            </div>
        </div>

        <!-- 표시 제한으로 잘린 수 (카운트 칩은 전체 수 유지) -->
        <div v-if="hiddenCount > 0" class="truncated-note">외 {{ hiddenCount }}개 후보</div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { InsightCard, InsightSeverity } from '@/lib/processKg/analysis/types';
import InsightCardView from './InsightCardView.vue';

const props = withDefaults(
    defineProps<{
        insightsByCategory: Record<string, InsightCard[]>;
        activeInsightId?: string | null;
        /** 인사이트별 검토 상태(insightId→status). 미기록은 'new' 간주 (data-model §3.1, FR-026) */
        workflowStatuses?: Record<string, string>;
        /** 표시 제한(Top 20/50, FR-033). 표시에만 적용 — 탭 카운트 칩은 전체 수 유지 */
        displayLimit?: number;
        /** 대규모 그래프 여부 — 성능 노트 표시 (FR-033) */
        largeGraph?: boolean;
    }>(),
    {
        activeInsightId: null,
        workflowStatuses: () => ({}),
        displayLimit: 20,
        largeGraph: false,
    }
);

const emit = defineEmits<{
    (e: 'select-insight', card: InsightCard): void;
    (e: 'show-evidence', card: InsightCard): void;
    (e: 'update:displayLimit', n: number): void;
}>();

/** 모듈 통합 탭 키 (재설계+자동화 모듈/시퀀스 후보 병합, 샘플 ProcessModulesPanel 파리티) */
const MODULE_TAB_KEY = 'modules';

/** 탭 순서/라벨 고정 (계약: explorer-ui.contract.md §1 인사이트 탭 + T067 모듈 통합 탭) */
const CATEGORY_TABS: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'bottleneck', label: '병목' },
    { key: 'system_impact', label: '영향도' },
    { key: 'organization_coordination', label: '조율' },
    { key: 'cross_org_handoff', label: '핸드오프' },
    { key: 'automation', label: '자동화' },
    { key: 'redesign', label: '재설계' },
    { key: 'enrichment', label: '보강' },
    { key: 'reasoning_readiness', label: '준비도' },
    { key: 'modeling_quality', label: '품질' },
    { key: 'spof', label: 'SPOF' },
    { key: MODULE_TAB_KEY, label: '모듈' },
];

const SEVERITY_RANK: Record<InsightSeverity, number> = {
    high: 3,
    medium: 2,
    info: 1,
};

/** 표시 제한 옵션 (샘플 InsightLimitControl: DEFAULT 20 / EXTENDED 50) */
const DISPLAY_LIMIT_OPTIONS = [20, 50] as const;

/**
 * 유형 필터 옵션 — value 는 우리 analysis 모듈이 metrics 에 기록하는 라벨과 정확히 일치해야 함.
 * 재설계: metrics['추천 유형'] ← REDESIGN_TYPE_LABELS (redesignRecommendations.ts)
 */
const REDESIGN_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'all', label: '전체' },
    { value: '통합', label: '통합' },
    { value: '분리', label: '분리' },
    { value: '모듈화', label: '모듈화' },
    { value: 'R&R', label: 'R&R 명확화' },
    { value: 'Ownership', label: 'Ownership 재정렬' },
    { value: '공통 Task Sequence', label: '공통 Task Sequence' },
];

/**
 * 자동화: metrics['후보 유형'] ← AUTOMATION_TYPE_LABELS (automationAnalysis.ts),
 * Agent Skill/Process Module 은 metrics['정제 라벨'] substring 매칭 (샘플 AutomationPanel 파리티)
 */
const AUTOMATION_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'RPA', label: 'RPA' },
    { value: 'AI Assistant', label: 'AI Assistant' },
    { value: 'Agent Workflow', label: 'Agent Workflow' },
    { value: 'Human-in-the-loop', label: 'Human-in-the-loop' },
    { value: 'Standardization', label: '표준화' },
    { value: 'agent_skill', label: 'Agent Skill' },
    { value: 'process_module', label: 'Process Module' },
];

/** 보강: metrics['추천 유형'] ← RECOMMENDATION_TYPE_LABELS (enrichmentRecommendations.ts) */
const ENRICHMENT_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'all', label: '전체' },
    { value: '병목 검증', label: '병목 검증' },
    { value: '조직 capacity', label: '조직 capacity' },
    { value: '시스템 risk', label: '시스템 risk' },
    { value: '자동화 readiness', label: '자동화 readiness' },
    { value: '모델링 품질', label: '모델링 품질' },
];

/** 검토 상태 점 팔레트 — InsightCardView 상태 배지와 동일 팔레트 유지 (T066/T067, data-model §3.1) */
const WORKFLOW_STATUS_META: Record<string, { label: string; color: string }> = {
    new: { label: '신규', color: '#8a93a6' },
    reviewed: { label: '검토됨', color: '#0085db' },
    accepted: { label: '수용', color: '#31c48d' },
    rejected: { label: '반려', color: '#ff6b60' },
    needs_data: { label: '데이터 필요', color: '#ff9d54' },
    action_created: { label: '태스크 생성', color: '#7c3aed' },
};

const activeCategory = ref<string>(CATEGORY_TABS[0].key);

/** 카테고리별 유형 필터 상태 (탭 전환 시 각 탭의 선택 유지 — 샘플 패널별 로컬 상태 파리티) */
const typeFilters = ref<Record<string, string>>({
    redesign: 'all',
    automation: 'all',
    enrichment: 'all',
});

/** 보강 탭 '데이터 격차 통합 보기' (샘플 DataGapsPanel 파리티, FR-031) */
const dataGapMerged = ref(false);

/** 모듈/시퀀스 후보 판정 (샘플 isModuleOrSequenceCandidate 포팅) */
function isModuleOrSequenceCandidate(card: InsightCard): boolean {
    const redesignType = String(card.metrics?.['추천 유형'] ?? '');
    if (redesignType === '공통 Task Sequence' || redesignType === '모듈화') return true;
    const refinement = String(card.metrics?.['정제 라벨'] ?? '');
    if (refinement.includes('Process Module') || refinement.includes('Agent Skill')) return true;
    return card.id.startsWith('automation-sequence-');
}

/** id dedup 후 score desc 정렬 (샘플 ProcessModulesPanel/DataGapsPanel 병합 규칙) */
function dedupSortByScore(cards: InsightCard[]): InsightCard[] {
    const deduped = new Map<string, InsightCard>();
    for (const card of cards) deduped.set(card.id, card);
    return [...deduped.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/** 모듈 탭: 재설계+자동화 중 모듈/시퀀스 후보 병합 */
const moduleCards = computed<InsightCard[]>(() =>
    dedupSortByScore(
        [
            ...(props.insightsByCategory['redesign'] ?? []),
            ...(props.insightsByCategory['automation'] ?? []),
        ].filter(isModuleOrSequenceCandidate)
    )
);

/** 데이터 격차 통합: enrichment+modeling_quality 병합 */
const dataGapCards = computed<InsightCard[]>(() =>
    dedupSortByScore([
        ...(props.insightsByCategory['enrichment'] ?? []),
        ...(props.insightsByCategory['modeling_quality'] ?? []),
    ])
);

function countOf(key: string): number {
    if (key === MODULE_TAB_KEY) return moduleCards.value.length;
    return props.insightsByCategory[key]?.length ?? 0;
}

/** 활성 탭의 유형 필터 옵션 (격차 통합 보기 중에는 필터 미적용 — 샘플 DataGapsPanel 파리티) */
const typeFilterOptions = computed<ReadonlyArray<{ value: string; label: string }>>(() => {
    if (activeCategory.value === 'redesign') return REDESIGN_FILTER_OPTIONS;
    if (activeCategory.value === 'automation') return AUTOMATION_FILTER_OPTIONS;
    if (activeCategory.value === 'enrichment' && !dataGapMerged.value) {
        return ENRICHMENT_FILTER_OPTIONS;
    }
    return [];
});

function matchesTypeFilter(card: InsightCard, category: string, filter: string): boolean {
    if (filter === 'all') return true;
    if (category === 'automation') {
        const refinement = String(card.metrics?.['정제 라벨'] ?? '');
        if (filter === 'agent_skill') return refinement.includes('Agent Skill');
        if (filter === 'process_module') return refinement.includes('Process Module');
        return String(card.metrics?.['후보 유형'] ?? '') === filter;
    }
    // 재설계/보강: '추천 유형' 정확 일치
    return String(card.metrics?.['추천 유형'] ?? '') === filter;
}

/** 활성 탭 카드(정렬 적용): 일반 탭은 심각도→score, 모듈/격차 통합은 score desc */
const categoryCards = computed<InsightCard[]>(() => {
    if (activeCategory.value === MODULE_TAB_KEY) return moduleCards.value;
    if (activeCategory.value === 'enrichment' && dataGapMerged.value) return dataGapCards.value;
    const cards = props.insightsByCategory[activeCategory.value] ?? [];
    return [...cards].sort((a, b) => {
        const severityDiff =
            (SEVERITY_RANK[b.severity ?? 'info'] ?? 0) - (SEVERITY_RANK[a.severity ?? 'info'] ?? 0);
        if (severityDiff !== 0) return severityDiff;
        return (b.score ?? 0) - (a.score ?? 0);
    });
});

const filteredCards = computed<InsightCard[]>(() => {
    if (!typeFilterOptions.value.length) return categoryCards.value;
    const filter = typeFilters.value[activeCategory.value] ?? 'all';
    if (filter === 'all') return categoryCards.value;
    return categoryCards.value.filter((card) =>
        matchesTypeFilter(card, activeCategory.value, filter)
    );
});

/** 표시 슬라이스 (FR-033) — 카운트 칩은 전체 수 유지, 잘린 수는 푸터로 안내 */
const visibleCards = computed<InsightCard[]>(() => filteredCards.value.slice(0, props.displayLimit));
const hiddenCount = computed<number>(() =>
    Math.max(0, filteredCards.value.length - props.displayLimit)
);

function statusMeta(insightId: string): { label: string; color: string } {
    const status = props.workflowStatuses?.[insightId] ?? 'new';
    return WORKFLOW_STATUS_META[status] ?? WORKFLOW_STATUS_META.new;
}
</script>

<style scoped>
.insight-list-panel {
    height: 100%;
    overflow-y: auto;
    padding: 14px 16px;
    color: #1f2533;
    background: #ffffff;
}
.panel-title {
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e7eaf3;
}
.panel-empty {
    color: #8a93a6;
    font-size: 12px;
    padding: 12px 0;
    text-align: center;
}

/* 카테고리 탭 */
.category-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
}
.category-tab {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #5a6478;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.category-tab:hover {
    background: #f4f6fb;
}
.category-tab--active {
    border-color: #0085db;
    background: #e5f3fb;
    color: #0085db;
}
.tab-count {
    pointer-events: none;
}

/* 데이터 격차 통합 보기 스위치 */
.gap-merge-row {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
}
.gap-merge-switch {
    flex: 0 0 auto;
}
.gap-merge-switch :deep(.v-label) {
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
    opacity: 1;
}

/* 유형 필터 */
.type-filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.type-filter-label {
    flex: 0 0 auto;
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
}
.type-filter-select {
    flex: 1 1 0;
    min-width: 0;
    font-size: 12px;
}
.type-filter-select :deep(.v-field__input) {
    font-size: 12px;
    min-height: 32px;
    padding-top: 2px;
    padding-bottom: 2px;
}

/* 표시 제한 토글 */
.limit-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}
.limit-label {
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
}
.limit-btn {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #5a6478;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.limit-btn:hover {
    background: #f4f6fb;
}
.limit-btn--active {
    border-color: #0085db;
    background: #e5f3fb;
    color: #0085db;
}
.limit-note {
    font-size: 11px;
    color: #b25b12;
}

/* 카드 행 */
.card-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.card-row {
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    cursor: pointer;
    min-width: 0;
}
.card-row:hover {
    background: #f4f6fb;
}
.card-row--active {
    border-color: #0085db;
    background: #e5f3fb;
}
.card-row-body {
    flex: 1 1 0;
    min-width: 0;
    border: none;
    background: transparent;
}

/* 검토 상태 점 */
.status-dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    cursor: help;
}

.evidence-btn {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-right: 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #0085db;
    cursor: pointer;
}
.evidence-btn:hover {
    background: #e5f3fb;
}
.card-row--active .evidence-btn:hover {
    background: #d0eaf9;
}

/* 잘린 수 푸터 */
.truncated-note {
    margin-top: 8px;
    font-size: 12px;
    color: #8a93a6;
    text-align: center;
}
</style>
