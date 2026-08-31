<template>
    <!-- compact: 목록용 요약 줄만 (specs/002 T035) -->
    <div v-if="compact" class="insight-card insight-card--compact">
        <span class="severity-dot" :class="'severity-dot--' + severityKey" />
        <span v-if="rank != null" class="compact-rank">#{{ rank }}</span>
        <span class="compact-title">{{ card.title }}</span>
        <span v-if="card.score != null" class="compact-score">{{ formattedScore }}</span>
        <span class="compact-answer">{{ card.answer }}</span>
        <!-- 검토 상태 점 (T066, FR-026 목록측) -->
        <span
            v-if="showWorkflow"
            class="workflow-dot"
            :class="'workflow-dot--' + workflowKey"
            :title="'검토 상태: ' + workflowLabel"
        />
    </div>

    <div v-else class="insight-card">
        <div class="card-head">
            <span class="severity-badge" :class="'severity-badge--' + severityKey">{{ severityLabel }}</span>
            <span class="category-label">{{ categoryLabel }}</span>
            <span v-if="priorityBadge != null" class="priority-badge">우선순위 {{ priorityBadge }}</span>
            <span v-if="readinessBadge != null" class="readiness-badge">등급 {{ readinessBadge }}</span>
            <span
                v-if="showWorkflow"
                class="workflow-badge"
                :class="'workflow-badge--' + workflowKey"
            >{{ workflowLabel }}</span>
            <span v-if="card.score != null" class="score-chip">score {{ formattedScore }}</span>
        </div>

        <!-- 검토 상태 select (T066, FR-026) -->
        <div v-if="showWorkflow" class="workflow-row">
            <label class="workflow-label" :for="statusSelectId">검토 상태</label>
            <select
                :id="statusSelectId"
                class="workflow-select"
                :value="workflowKey"
                @change="onStatusChange"
            >
                <option v-for="status in WORKFLOW_STATUSES" :key="status" :value="status">
                    {{ WORKFLOW_STATUS_LABELS[status] }}
                </option>
            </select>
        </div>

        <div class="card-title">
            <span v-if="rank != null" class="rank-badge">#{{ rank }}</span>
            <span class="card-title-text">{{ card.title }}</span>
        </div>
        <div v-if="card.question" class="card-question">{{ card.question }}</div>
        <div class="card-answer">{{ card.answer }}</div>
        <p class="card-explanation">{{ card.explanation }}</p>

        <!-- 메트릭 그리드 -->
        <div v-if="metricEntries.length" class="metrics-grid">
            <div v-for="[key, value] in metricEntries" :key="key" class="metric-cell">
                <span class="metric-value">{{ formatMetricValue(value) }}</span>
                <span class="metric-key">{{ key }}</span>
            </div>
        </div>

        <!-- 접이식 scoreBreakdown + reasons -->
        <template v-if="hasDetails">
            <button type="button" class="details-toggle" @click="detailsOpen = !detailsOpen">
                {{ detailsOpen ? '상세 근거 접기 ▴' : '상세 근거 펼치기 ▾' }}
            </button>
            <div v-if="detailsOpen" class="details-body">
                <div v-if="card.scoreBreakdown?.length" class="breakdown-block">
                    <div class="details-caption">점수 구성</div>
                    <div v-for="(item, i) in card.scoreBreakdown" :key="i" class="breakdown-row">
                        <span class="breakdown-label">{{ item.labelKo }}</span>
                        <span class="breakdown-points">+{{ item.points }}</span>
                        <span class="breakdown-detail">{{ item.detail }}</span>
                    </div>
                </div>
                <div v-if="card.reasons.length" class="reasons-block">
                    <div class="details-caption">구조적 신호</div>
                    <ul class="reasons-list">
                        <li v-for="(reason, i) in card.reasons" :key="i">{{ reason }}</li>
                    </ul>
                </div>
            </div>
        </template>

        <!-- enrichment 전용: 권장 필드 / 추천 소스 접이식 목록 (T066, FR-027) -->
        <div v-if="isEnrichment && enrichmentFields.length" class="enrichment-block">
            <button type="button" class="details-toggle" @click="fieldsOpen = !fieldsOpen">
                권장 필드 ({{ enrichmentFields.length }}) {{ fieldsOpen ? '▴' : '▾' }}
            </button>
            <div v-if="fieldsOpen" class="enrichment-body">
                <div class="list-preview">{{ fieldsPreview }}</div>
                <ul class="enrichment-list">
                    <li v-for="(field, i) in enrichmentFields" :key="i">{{ field }}</li>
                </ul>
            </div>
        </div>
        <div v-if="isEnrichment && enrichmentSources.length" class="enrichment-block">
            <button type="button" class="details-toggle" @click="sourcesOpen = !sourcesOpen">
                추천 소스 ({{ enrichmentSources.length }}) {{ sourcesOpen ? '▴' : '▾' }}
            </button>
            <div v-if="sourcesOpen" class="enrichment-body">
                <div class="list-preview">{{ sourcesPreview }}</div>
                <ul class="enrichment-list">
                    <li v-for="(source, i) in enrichmentSources" :key="i">{{ source }}</li>
                </ul>
            </div>
        </div>

        <!-- caveat 문구 (있으면) -->
        <div v-if="caveatText" class="caveat-note">⚠ {{ caveatText }}</div>

        <!-- 버튼 줄 -->
        <div class="card-actions">
            <button
                type="button"
                class="action-btn"
                :class="{ 'action-btn--active': evidenceActive }"
                @click="emit('show-evidence', card)"
            >
                {{ evidenceActive ? '근거 표시 중' : '근거 보기' }}
            </button>
            <button
                v-if="!displayNarrative"
                type="button"
                class="action-btn"
                :disabled="narrativeLoading"
                @click="emit('request-narrative', card)"
            >
                <v-progress-circular
                    v-if="narrativeLoading"
                    indeterminate
                    size="12"
                    width="2"
                    class="btn-spinner"
                />
                {{ narrativeLoading ? '해설 생성 중…' : 'AI 해설' }}
            </button>
            <button type="button" class="action-btn" @click="copyMarkdown">
                {{ copyState === 'copied' ? '복사됨' : copyState === 'failed' ? '복사 실패' : '마크다운 복사' }}
            </button>
            <!-- enrichment 전용: 데이터 태스크 생성 (T066, FR-027) -->
            <button
                v-if="isEnrichment"
                type="button"
                class="action-btn"
                :disabled="taskCreated"
                @click="emit('create-task', card)"
            >
                {{ taskCreated ? '조치 생성됨' : '데이터 태스크 생성' }}
            </button>
        </div>

        <!-- 접이식 마크다운 원문 (읽기전용, 포커스 시 전체 선택) -->
        <button type="button" class="details-toggle markdown-toggle" @click="markdownOpen = !markdownOpen">
            {{ markdownOpen ? '마크다운 접기 ▴' : '마크다운 펼치기 ▾' }}
        </button>
        <textarea
            v-if="markdownOpen"
            class="markdown-textarea"
            readonly
            rows="8"
            :value="card.markdown"
            @focus="onMarkdownFocus"
        />

        <!-- AI 내러티브 (계약: ai-narrative.contract.md §3) -->
        <div v-if="narrativeError" class="narrative-error">
            <span>{{ narrativeError }}</span>
            <button type="button" class="retry-btn" @click="emit('request-narrative', card)">재시도</button>
        </div>
        <div v-else-if="displayNarrative" class="narrative-block">
            <div class="details-caption">AI 해설</div>
            <p class="narrative-text">{{ displayNarrative }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { InsightCard } from '@/lib/processKg/analysis/types';

const props = withDefaults(
    defineProps<{
        card: InsightCard;
        narrative?: string | null;
        narrativeLoading?: boolean;
        narrativeError?: string | null;
        evidenceActive?: boolean;
        compact?: boolean;
        /** 목록 내 순위 — '#n' 배지 (T066, FR-031) */
        rank?: number | null;
        /** 검토 워크플로 상태 (data-model §3.1 — 미기록은 'new') */
        workflowStatus?: string;
        /** 워크플로 UI(상태 배지/select/dot) 표시 여부 */
        showWorkflow?: boolean;
    }>(),
    {
        narrative: null,
        narrativeLoading: false,
        narrativeError: null,
        evidenceActive: false,
        compact: false,
        rank: null,
        workflowStatus: 'new',
        showWorkflow: true,
    }
);

const emit = defineEmits<{
    (e: 'show-evidence', card: InsightCard): void;
    (e: 'request-narrative', card: InsightCard): void;
    (e: 'update-status', payload: { card: InsightCard; status: string }): void;
    (e: 'create-task', card: InsightCard): void;
}>();

/** 카드 category(9종) + 목록 그룹 키(10종) 겸용 한국어 라벨 */
const CATEGORY_LABELS: Record<string, string> = {
    cq: 'CQ',
    bottleneck: '병목',
    impact: '영향도',
    system_impact: '영향도',
    organization: '조율',
    organization_coordination: '조율',
    cross_org_handoff: '핸드오프',
    automation: '자동화',
    redesign: '재설계',
    enrichment: '보강',
    reasoning_readiness: '준비도',
    quality: '품질',
    modeling_quality: '품질',
    spof: 'SPOF',
};

const SEVERITY_LABELS: Record<string, string> = {
    info: '정보',
    medium: '주의',
    high: '위험',
};

/** 검토 워크플로 6상태 (data-model §3.1, 샘플 insightWorkflow 파리티) */
const WORKFLOW_STATUSES = [
    'new',
    'reviewed',
    'accepted',
    'rejected',
    'needs_data',
    'action_created',
] as const;

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
    new: '신규',
    reviewed: '검토됨',
    accepted: '승인',
    rejected: '반려',
    needs_data: '데이터 필요',
    action_created: '조치 생성됨',
};

/** enrichment 목록 미리보기 항목 수 (샘플 LIST_PREVIEW_LIMIT 파리티) */
const LIST_PREVIEW_LIMIT = 5;

const detailsOpen = ref(false);
const fieldsOpen = ref(false);
const sourcesOpen = ref(false);
const markdownOpen = ref(false);
const copyState = ref<'idle' | 'copied' | 'failed'>('idle');
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const severityKey = computed(() => props.card.severity ?? 'info');
const severityLabel = computed(() => SEVERITY_LABELS[severityKey.value] ?? severityKey.value);
const categoryLabel = computed(() => CATEGORY_LABELS[props.card.category] ?? props.card.category);

/** 알 수 없는 상태 문자열은 'new'로 간주 (data-model §3.1) */
const workflowKey = computed<string>(() =>
    (WORKFLOW_STATUSES as readonly string[]).includes(props.workflowStatus)
        ? props.workflowStatus
        : 'new'
);
const workflowLabel = computed(() => WORKFLOW_STATUS_LABELS[workflowKey.value]);
const taskCreated = computed(() => workflowKey.value === 'action_created');
const statusSelectId = computed(() => `insight-status-${props.card.id}`);

const priorityBadge = computed(() => props.card.metrics?.['추천 우선순위'] ?? null);
const readinessBadge = computed(() => props.card.metrics?.['준비도 등급'] ?? null);

const formattedScore = computed(() => {
    const score = props.card.score;
    if (score == null) return '';
    return Number.isInteger(score) ? String(score) : score.toFixed(1);
});

const metricEntries = computed<[string, number | string][]>(() =>
    Object.entries(props.card.metrics ?? {})
);

const hasDetails = computed(
    () => Boolean(props.card.scoreBreakdown?.length) || props.card.reasons.length > 0
);

const isEnrichment = computed(() => props.card.category === 'enrichment');

/**
 * enrichment 카드의 권장 필드/추천 소스 추출 (샘플 insightCardHelpers 파리티):
 * markdown의 불릿 섹션(전체 목록) 우선, 없으면 metrics 미리보기 문자열 콤마 분리 폴백.
 * (enrichmentRecommendations.ts — markdown '**추천 연결 데이터:**'/'**추천 데이터 소스:**' 섹션,
 *  metrics '추천 연결 데이터'/'추천 데이터 소스'는 절단된 미리보기)
 */
function parseMarkdownBulletSection(markdown: string, header: string): string[] {
    const lines = markdown.split('\n');
    const startIdx = lines.findIndex((line) => line.includes(header));
    if (startIdx < 0) return [];

    const items: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.startsWith('**') && !line.startsWith('- ')) break;
        if (line.startsWith('- ')) {
            items.push(line.slice(2).trim());
            continue;
        }
        if (line.trim() === '' && items.length > 0) break;
    }
    return items;
}

function splitCommaList(value: number | string | undefined): string[] {
    if (value == null || value === '') return [];
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

const enrichmentFields = computed<string[]>(() => {
    if (!isEnrichment.value) return [];
    const fromMarkdown = parseMarkdownBulletSection(props.card.markdown, '추천 연결 데이터');
    if (fromMarkdown.length > 0) return fromMarkdown;
    return splitCommaList(props.card.metrics?.['추천 연결 데이터']);
});

const enrichmentSources = computed<string[]>(() => {
    if (!isEnrichment.value) return [];
    const fromMarkdown = parseMarkdownBulletSection(props.card.markdown, '추천 데이터 소스');
    if (fromMarkdown.length > 0) return fromMarkdown;
    return splitCommaList(props.card.metrics?.['추천 데이터 소스']);
});

/** 미리보기: 'a, b, c 외 N개' */
function previewList(items: string[]): string {
    const visible = items.slice(0, LIST_PREVIEW_LIMIT);
    const remaining = items.length - visible.length;
    return remaining > 0 ? `${visible.join(', ')} 외 ${remaining}개` : visible.join(', ');
}

const fieldsPreview = computed(() => previewList(enrichmentFields.value));
const sourcesPreview = computed(() => previewList(enrichmentSources.value));

/** 온디맨드 내러티브(props 우선) → 카드 캐시(card.narrative) 폴백 */
const displayNarrative = computed(() => props.narrative ?? props.card.narrative ?? null);

/** caveat: metrics.caveat 우선, 없으면 markdown의 "**주의:**" 섹션 추출 */
const caveatText = computed<string | null>(() => {
    const fromMetrics = props.card.metrics?.caveat;
    if (typeof fromMetrics === 'string' && fromMetrics.trim()) return fromMetrics.trim();

    const lines = props.card.markdown.split('\n');
    const headIdx = lines.findIndex((line) => line.trim() === '**주의:**');
    if (headIdx < 0) return null;

    const collected: string[] = [];
    for (let i = headIdx + 1; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (!line) {
            if (collected.length) break;
            continue;
        }
        if (line.startsWith('**') || line.startsWith('#')) break;
        collected.push(line.replace(/^-\s*/, ''));
    }
    return collected.length ? collected.join(' ') : null;
});

function formatMetricValue(value: number | string): string {
    return typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
}

function onStatusChange(event: Event) {
    const status = (event.target as HTMLSelectElement).value;
    if (status !== workflowKey.value) {
        emit('update-status', { card: props.card, status });
    }
}

function onMarkdownFocus(event: FocusEvent) {
    (event.target as HTMLTextAreaElement).select();
}

async function copyMarkdown() {
    try {
        await navigator.clipboard.writeText(props.card.markdown);
        copyState.value = 'copied';
    } catch {
        copyState.value = 'failed';
    }
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
        copyState.value = 'idle';
    }, 1500);
}
</script>

<style scoped>
.insight-card {
    background: #ffffff;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    padding: 12px 14px;
    color: #1f2533;
    font-size: 13px;
}

/* compact 요약 줄 */
.insight-card--compact {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
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
.compact-rank {
    flex: 0 0 auto;
    font-size: 11px;
    font-weight: 700;
    color: #5a6478;
}
.compact-title {
    flex: 0 1 auto;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.compact-score {
    flex: 0 0 auto;
    font-size: 11px;
    font-weight: 600;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 8px;
    padding: 1px 6px;
}
.compact-answer {
    flex: 1 1 0;
    min-width: 0;
    font-size: 12px;
    color: #5a6478;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 검토 상태 dot (compact 행) */
.workflow-dot {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.workflow-dot--new {
    background: #8a93a6;
}
.workflow-dot--reviewed {
    background: #46618c;
}
.workflow-dot--accepted {
    background: #1e8a4a;
}
.workflow-dot--rejected {
    background: #d1322a;
}
.workflow-dot--needs_data {
    background: #ff9d54;
}
.workflow-dot--action_created {
    background: #0085db;
}

/* 헤더 */
.card-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
}
.severity-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
}
.severity-badge--info {
    color: #0085db;
    background: #e5f3fb;
}
.severity-badge--medium {
    color: #b25b12;
    background: #fff2e5;
}
.severity-badge--high {
    color: #d1322a;
    background: #ffecea;
}
.category-label {
    font-size: 11px;
    font-weight: 600;
    color: #5a6478;
    background: #f4f6fb;
    border-radius: 4px;
    padding: 2px 8px;
}
.priority-badge {
    font-size: 11px;
    font-weight: 600;
    color: #b25b12;
    background: #fff2e5;
    border-radius: 4px;
    padding: 2px 8px;
}
.readiness-badge {
    font-size: 11px;
    font-weight: 600;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 4px;
    padding: 2px 8px;
}
.score-chip {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    color: #0085db;
}

/* 검토 상태 배지 (상태별 색) */
.workflow-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
}
.workflow-badge--new {
    color: #5a6478;
    background: #f4f6fb;
}
.workflow-badge--reviewed {
    color: #46618c;
    background: #eef2f9;
}
.workflow-badge--accepted {
    color: #1e8a4a;
    background: #e6f6ec;
}
.workflow-badge--rejected {
    color: #d1322a;
    background: #ffecea;
}
.workflow-badge--needs_data {
    color: #b25b12;
    background: #fff2e5;
}
.workflow-badge--action_created {
    color: #0085db;
    background: #e5f3fb;
}

/* 검토 상태 select 줄 */
.workflow-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.workflow-label {
    font-size: 11px;
    font-weight: 600;
    color: #5a6478;
}
.workflow-select {
    font-size: 12px;
    color: #1f2533;
    background: #fff;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
}
.workflow-select:focus {
    outline: none;
    border-color: #0085db;
}

.card-title {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 4px;
}
.rank-badge {
    flex: 0 0 auto;
    font-size: 11px;
    font-weight: 700;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 4px;
    padding: 1px 6px;
}
.card-title-text {
    min-width: 0;
}
.card-question {
    font-size: 12px;
    color: #5a6478;
    margin-bottom: 4px;
}
.card-answer {
    font-weight: 600;
    margin-bottom: 6px;
}
.card-explanation {
    font-size: 12px;
    line-height: 1.6;
    color: #5a6478;
    margin: 0 0 10px;
}

/* 메트릭 그리드 */
.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
    margin-bottom: 10px;
}
.metric-cell {
    display: flex;
    flex-direction: column;
    background: #f4f6fb;
    border-radius: 6px;
    padding: 6px 8px;
    min-width: 0;
}
.metric-value {
    font-size: 15px;
    font-weight: 700;
    color: #1f2533;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.metric-key {
    font-size: 10px;
    color: #8a93a6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 접이식 상세 */
.details-toggle {
    border: none;
    background: none;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    margin-bottom: 8px;
}
.details-body {
    border-top: 1px dashed #e7eaf3;
    padding-top: 8px;
    margin-bottom: 8px;
}
.details-caption {
    font-size: 11px;
    font-weight: 600;
    color: #5a6478;
    text-transform: uppercase;
    margin-bottom: 4px;
}
.breakdown-block {
    margin-bottom: 8px;
}
.breakdown-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    padding: 2px 0;
}
.breakdown-label {
    flex: 0 0 auto;
    font-weight: 600;
}
.breakdown-points {
    flex: 0 0 auto;
    color: #0085db;
    font-weight: 700;
}
.breakdown-detail {
    flex: 1 1 0;
    min-width: 0;
    color: #5a6478;
}
.reasons-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: #5a6478;
}
.reasons-list li {
    margin-bottom: 2px;
}

/* enrichment 권장 필드/추천 소스 */
.enrichment-block {
    margin-bottom: 4px;
}
.enrichment-block .details-toggle {
    display: block;
    margin-bottom: 4px;
}
.enrichment-body {
    border-top: 1px dashed #e7eaf3;
    padding-top: 6px;
    margin-bottom: 8px;
}
.list-preview {
    font-size: 12px;
    color: #5a6478;
    margin-bottom: 4px;
}
.enrichment-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: #1f2533;
}
.enrichment-list li {
    margin-bottom: 2px;
    word-break: break-all;
}

/* caveat */
.caveat-note {
    font-size: 12px;
    color: #b25b12;
    background: #fff8f0;
    border: 1px solid #ffe1c4;
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 10px;
    line-height: 1.5;
}

/* 버튼 줄 */
.card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.action-btn:hover:not(:disabled) {
    background: #e5f3fb;
}
.action-btn:disabled {
    opacity: 0.6;
    cursor: default;
}
.action-btn--active {
    background: #0085db;
    border-color: #0085db;
    color: #fff;
}
.action-btn--active:hover:not(:disabled) {
    background: #0072bc;
}
.btn-spinner {
    color: #0085db;
}

/* 접이식 마크다운 */
.markdown-toggle {
    display: block;
    margin-top: 10px;
    margin-bottom: 0;
}
.markdown-textarea {
    display: block;
    width: 100%;
    margin-top: 6px;
    font-family: monospace;
    font-size: 11px;
    line-height: 1.5;
    color: #1f2533;
    background: #f4f6fb;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    padding: 8px;
    resize: vertical;
}
.markdown-textarea:focus {
    outline: none;
    border-color: #0085db;
}

/* AI 내러티브 */
.narrative-block {
    margin-top: 10px;
    border-top: 1px solid #e7eaf3;
    padding-top: 8px;
}
.narrative-text {
    font-size: 13px;
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
}
.narrative-error {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    font-size: 12px;
    color: #d1322a;
    background: #ffecea;
    border-radius: 6px;
    padding: 6px 10px;
}
.retry-btn {
    flex: 0 0 auto;
    border: 1px solid #d1322a;
    background: #fff;
    color: #d1322a;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    padding: 3px 10px;
    cursor: pointer;
}
.retry-btn:hover {
    background: #ffe0dd;
}
</style>
