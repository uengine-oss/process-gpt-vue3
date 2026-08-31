<template>
    <div class="overview-panel">
        <div class="panel-title">개요</div>

        <!-- 스코프 배너 (있으면) -->
        <div v-if="scopeNote" class="scope-banner">{{ scopeNote }}</div>

        <!-- 통계 카드 6종 (specs/002 T069, FR-028) -->
        <div class="section">
            <div class="section-label">통계</div>
            <div class="stats-grid">
                <div v-for="stat in statCards" :key="stat.label" class="stat-card">
                    <span class="stat-value">{{ stat.value.toLocaleString('ko-KR') }}</span>
                    <span class="stat-label">{{ stat.label }}</span>
                </div>
            </div>
        </div>

        <!-- Top 인사이트 섹션 목록 -->
        <div class="section">
            <div class="section-label">Top 인사이트</div>
            <div class="top-insight-list">
                <div v-for="item in sections" :key="item.key" class="top-insight-card">
                    <div class="top-insight-section">{{ item.title }}</div>
                    <template v-if="item.card">
                        <div class="top-insight-summary">
                            <span
                                class="severity-dot"
                                :class="'severity-dot--' + (item.card.severity ?? 'info')"
                            />
                            <span class="summary-title">{{ item.card.title }}</span>
                            <span v-if="item.card.score != null" class="summary-score">
                                {{ formatScore(item.card.score) }}
                            </span>
                        </div>
                        <div class="summary-answer">{{ item.card.answer }}</div>
                        <button
                            type="button"
                            class="detail-btn"
                            @click="emit('open-insight', { card: item.card, tab: item.targetTab })"
                        >
                            상세 보기
                        </button>
                    </template>
                    <div v-else class="top-insight-empty">아직 후보 없음</div>
                </div>
            </div>
        </div>

        <!-- 빠른 이동 -->
        <div class="section">
            <div class="section-label">빠른 이동</div>
            <div class="quick-links">
                <button
                    v-for="link in QUICK_LINKS"
                    :key="link.tab"
                    type="button"
                    class="quick-btn"
                    @click="emit('go-tab', link.tab)"
                >
                    {{ link.label }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { InsightCard } from '@/lib/processKg/analysis/types';

const props = withDefaults(
    defineProps<{
        stats: {
            processes: number;
            activities: number;
            systems: number;
            organizations: number;
            insights: number;
            openTasks: number;
        };
        sections: Array<{
            key: string;
            title: string;
            card: InsightCard | null;
            targetTab: string;
        }>;
        scopeNote?: string | null;
    }>(),
    {
        scopeNote: null,
    }
);

const emit = defineEmits<{
    (e: 'open-insight', payload: { card: InsightCard; tab: string }): void;
    (e: 'go-tab', tab: string): void;
}>();

/** 통계 카드 6종 고정 순서 (샘플 SummaryCards 파리티, FR-028) */
const statCards = computed<Array<{ label: string; value: number }>>(() => [
    { label: '프로세스', value: props.stats.processes },
    { label: '활동', value: props.stats.activities },
    { label: '시스템', value: props.stats.systems },
    { label: '조직', value: props.stats.organizations },
    { label: '인사이트', value: props.stats.insights },
    { label: '열린 태스크', value: props.stats.openTasks },
]);

/** 빠른 이동 4버튼 (샘플 OverviewPage quick links 파리티) */
const QUICK_LINKS: ReadonlyArray<{ tab: string; label: string }> = [
    { tab: 'insights', label: '인사이트 전체 보기' },
    { tab: 'tasks', label: '태스크 확인' },
    { tab: 'focus', label: '포커스 탐색' },
    { tab: 'filter', label: '필터' },
];

function formatScore(score: number): string {
    return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
</script>

<style scoped>
.overview-panel {
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
.section {
    margin-bottom: 16px;
}
.section-label {
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
    text-transform: uppercase;
    margin-bottom: 6px;
}

/* 스코프 배너 */
.scope-banner {
    margin-bottom: 12px;
    padding: 8px 10px;
    border: 1px solid #f3e3bd;
    border-radius: 8px;
    background: #fdf3df;
    color: #b7791f;
    font-size: 12px;
    line-height: 1.5;
}

/* 통계 카드 (2열 그리드) */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}
.stat-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    background: #f8fafd;
}
.stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #0085db;
    line-height: 1.2;
}
.stat-label {
    font-size: 11px;
    font-weight: 600;
    color: #5a6478;
}

/* Top 인사이트 카드 */
.top-insight-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.top-insight-card {
    padding: 10px 12px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    background: #ffffff;
}
.top-insight-section {
    font-size: 11px;
    font-weight: 700;
    color: #5a6478;
    text-transform: uppercase;
    margin-bottom: 6px;
}
.top-insight-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.severity-dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.severity-dot--info {
    background: #0085db;
}
.severity-dot--medium {
    background: #ff9d54;
}
.severity-dot--high {
    background: #ff6b60;
}
.summary-title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.summary-score {
    flex: 0 0 auto;
    font-size: 11px;
    font-weight: 600;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 8px;
    padding: 1px 6px;
}
.summary-answer {
    margin-top: 4px;
    font-size: 12px;
    color: #5a6478;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.detail-btn {
    margin-top: 8px;
    padding: 5px 10px;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    background: #fff;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.detail-btn:hover {
    background: #e5f3fb;
}
.top-insight-empty {
    font-size: 12px;
    color: #8a93a6;
    padding: 4px 0;
}

/* 빠른 이동 */
.quick-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
}
.quick-btn {
    padding: 8px;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    background: #fff;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.quick-btn:hover {
    background: #e5f3fb;
}
</style>
