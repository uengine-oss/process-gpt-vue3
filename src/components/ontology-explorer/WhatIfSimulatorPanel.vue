<template>
    <div class="whatif-panel" :class="{ collapsed }">
        <button class="whatif-toggle" @click="collapsed = !collapsed">
            <span v-if="collapsed">⟩</span>
            <span v-else>⟨ What-If</span>
        </button>

        <div v-if="!collapsed" class="whatif-body">
            <div class="panel-title">그래프 컨트롤</div>

            <!-- 그래프 소스 -->
            <div class="section">
                <div class="section-label">그래프 소스</div>
                <v-select
                    :items="sourceItems"
                    :model-value="currentSourceId"
                    item-title="title"
                    item-value="value"
                    density="compact"
                    variant="outlined"
                    hide-details
                    :disabled="!sources.length"
                    @update:model-value="onSourceChange"
                />
                <div class="artifact-load">
                    <input
                        v-model="artifactUrl"
                        class="url-input"
                        type="text"
                        placeholder="아티팩트 URL (process-kg.json)"
                        @keyup.enter="loadFromUrl"
                    />
                    <button class="mini-btn" :disabled="!artifactUrl.trim()" @click="loadFromUrl">로드</button>
                </div>
                <v-file-input
                    class="artifact-file"
                    density="compact"
                    variant="outlined"
                    hide-details
                    prepend-icon=""
                    label="아티팩트 파일 업로드"
                    accept=".json,application/json"
                    @update:model-value="onFileSelected"
                />
                <div v-if="metadata" class="meta-box">
                    <div v-if="metaInfo.sourceLabel" class="meta-row">
                        <span class="meta-key">소스</span>
                        <span class="meta-val">{{ metaInfo.sourceLabel }}</span>
                    </div>
                    <div v-if="metaInfo.generatedAt" class="meta-row">
                        <span class="meta-key">생성</span>
                        <span class="meta-val">{{ metaInfo.generatedAt }}</span>
                    </div>
                    <div v-if="metaInfo.fileCount != null" class="meta-row">
                        <span class="meta-key">파일</span>
                        <span class="meta-val">{{ metaInfo.fileCount }}개</span>
                    </div>
                    <span v-if="metaInfo.isSample" class="sample-badge">샘플 그래프</span>
                </div>
            </div>

            <!-- 그래프 요약 (specs/002 T069, FR-032) -->
            <div v-if="summary" class="section">
                <div class="section-label">그래프 요약</div>
                <span v-if="summary.isLarge" class="large-badge">대규모 그래프</span>
                <div class="summary-grid">
                    <div v-for="item in summaryCounts" :key="item.label" class="summary-cell">
                        <span class="summary-value">{{ item.value.toLocaleString('ko-KR') }}</span>
                        <span class="summary-key">{{ item.label }}</span>
                    </div>
                </div>
                <button
                    type="button"
                    class="breakdown-toggle"
                    @click="breakdownOpen = !breakdownOpen"
                >
                    {{ breakdownOpen ? '타입별 브레이크다운 접기 ▴' : '타입별 브레이크다운 펼치기 ▾' }}
                </button>
                <div v-if="breakdownOpen" class="breakdown-body">
                    <div class="breakdown-caption">노드 타입</div>
                    <div v-if="!summary.nodeTypeCounts.length" class="section-empty">없음</div>
                    <div
                        v-for="nodeType in summary.nodeTypeCounts"
                        :key="nodeType.type"
                        class="breakdown-row"
                    >
                        <span class="breakdown-label">{{ nodeType.label }}</span>
                        <span class="breakdown-count">{{ nodeType.count }}</span>
                    </div>
                    <div class="breakdown-caption">엣지 타입</div>
                    <div v-if="!summary.edgeTypeCounts.length" class="section-empty">없음</div>
                    <div
                        v-for="edgeType in summary.edgeTypeCounts"
                        :key="edgeType.type"
                        class="breakdown-row"
                    >
                        <span class="breakdown-label">{{ edgeType.type }}</span>
                        <span class="breakdown-count">{{ edgeType.count }}</span>
                    </div>
                </div>
            </div>

            <!-- 뷰 모드 -->
            <div class="section">
                <div class="section-label">뷰 모드</div>
                <div class="mode-toggle">
                    <button
                        v-for="m in MODE_OPTIONS"
                        :key="m.value"
                        class="mode-btn"
                        :class="{ active: viewMode === m.value }"
                        @click="emit('update:viewMode', m.value)"
                    >
                        {{ m.label }}
                    </button>
                </div>
            </div>

            <!-- 파싱 리포트 -->
            <div class="section">
                <div class="section-label">파싱 리포트</div>
                <button
                    v-if="parseSummary"
                    class="parse-badges"
                    title="파싱 리포트 상세 보기"
                    @click="emit('show-parse-report')"
                >
                    <span class="badge warn">경고 {{ parseSummary.warnings }}</span>
                    <span class="badge unresolved">미해결 {{ parseSummary.unresolved }}</span>
                    <span v-if="parseSummary.failedFiles > 0" class="badge failed">
                        실패 {{ parseSummary.failedFiles }}
                    </span>
                </button>
                <div v-else class="section-empty">파싱 리포트 없음</div>
            </div>

            <!-- 리포트 -->
            <div class="section">
                <div class="section-label">리포트</div>
                <button class="report-btn" :disabled="!reportReady" @click="emit('generate-report')">
                    분석 리포트 생성
                </button>
                <div v-if="!reportReady" class="section-hint">그래프 로드 후 생성할 수 있습니다.</div>
            </div>

            <p class="whatif-note">
                What-If 시뮬레이션(선택 노드 기준 가상 제거·대체 영향 분석)은 후속 확장 대상입니다.
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ViewMode } from '@/composables/ontology/viewModes';

const props = defineProps<{
    viewMode: ViewMode;
    parseSummary: { warnings: number; unresolved: number; failedFiles: number } | null;
    sources: Array<{ id: string; label: string; kind: 'proc-def' | 'artifact' }>;
    currentSourceId: string;
    metadata: { sourceLabel?: string; generatedAt?: string; fileCount?: number; isSample?: boolean } | null;
    reportReady: boolean;
    /** 그래프 요약 (specs/002 T069, FR-032) — 없으면 섹션 숨김 */
    summary?: {
        models: number;
        processes: number;
        nodes: number;
        edges: number;
        warnings: number;
        unresolved: number;
        nodeTypeCounts: Array<{ type: string; label: string; count: number }>;
        edgeTypeCounts: Array<{ type: string; count: number }>;
        isLarge: boolean;
    } | null;
}>();

// 현재 프로젝트(vue 3.2 타입 정의)에서는 템플릿 v-if 내로잉이 metadata를 unknown으로 만들어
// 프로퍼티 접근이 타입 에러가 되므로, 항상 non-null인 파생 객체로 우회한다.
const metaInfo = computed(() => props.metadata ?? ({} as NonNullable<typeof props.metadata>));

const emit = defineEmits<{
    (e: 'update:viewMode', mode: ViewMode): void;
    (e: 'select-source', payload: { id: string }): void;
    (e: 'load-artifact', payload: { url?: string; file?: File }): void;
    (e: 'generate-report'): void;
    (e: 'show-parse-report'): void;
}>();

const collapsed = ref(false);
const artifactUrl = ref('');
const breakdownOpen = ref(false);

/** 그래프 요약 카운트 그리드 (모델/프로세스/노드/엣지/경고/미해결) */
const summaryCounts = computed<Array<{ label: string; value: number }>>(() => {
    const s = props.summary;
    if (!s) return [];
    return [
        { label: '모델', value: s.models },
        { label: '프로세스', value: s.processes },
        { label: '노드', value: s.nodes },
        { label: '엣지', value: s.edges },
        { label: '경고', value: s.warnings },
        { label: '미해결', value: s.unresolved },
    ];
});

const MODE_OPTIONS: Array<{ value: ViewMode; label: string }> = [
    { value: 'processOverview', label: '프로세스 개요' },
    { value: 'activityDetail', label: '활동 상세' },
    { value: 'full', label: '전체' }
];

const sourceItems = computed(() =>
    props.sources.map((s) => ({
        title: s.kind === 'artifact' ? `[아티팩트] ${s.label}` : s.label,
        value: s.id
    }))
);

function onSourceChange(id: unknown) {
    if (typeof id === 'string' && id && id !== props.currentSourceId) {
        emit('select-source', { id });
    }
}

function loadFromUrl() {
    const url = artifactUrl.value.trim();
    if (!url) return;
    emit('load-artifact', { url });
}

function onFileSelected(value: unknown) {
    const file = Array.isArray(value) ? value[0] : value;
    if (file instanceof File) {
        emit('load-artifact', { file });
    }
}
</script>

<style scoped>
.whatif-panel {
    height: 100%;
    width: 280px;
    background: #ffffff;
    color: #1f2533;
    display: flex;
    flex-direction: column;
    transition: width 0.15s ease;
}
.whatif-panel.collapsed {
    width: 46px;
}
.whatif-toggle {
    background: transparent;
    color: #0085db;
    border: none;
    padding: 12px;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
}
.whatif-body {
    padding: 4px 14px 14px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
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
.section-empty {
    color: #8a93a6;
    font-size: 12px;
}
.section-hint {
    margin-top: 6px;
    font-size: 11px;
    color: #8a93a6;
}
.artifact-load {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}
.url-input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    font-size: 12px;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    color: #1f2533;
    background: #fff;
}
.url-input:focus {
    outline: none;
    border-color: #0085db;
}
.mini-btn {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}
.mini-btn:hover:not(:disabled) {
    background: #e5f3fb;
}
.mini-btn:disabled {
    color: #8a93a6;
    cursor: not-allowed;
}
.artifact-file {
    margin-top: 8px;
}
.meta-box {
    margin-top: 10px;
    padding: 8px 10px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    background: #f8fafd;
}
.meta-row {
    display: flex;
    gap: 8px;
    font-size: 12px;
    line-height: 1.7;
}
.meta-key {
    color: #8a93a6;
    flex: 0 0 34px;
}
.meta-val {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.sample-badge {
    display: inline-block;
    margin-top: 4px;
    font-size: 10px;
    font-weight: 700;
    color: #b7791f;
    background: #fdf3df;
    border-radius: 8px;
    padding: 2px 8px;
}
.large-badge {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #b25b12;
    background: #fff2e5;
    border-radius: 8px;
    padding: 2px 8px;
}
.summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
}
.summary-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 6px 8px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    background: #f8fafd;
    min-width: 0;
}
.summary-value {
    font-size: 14px;
    font-weight: 700;
    color: #0085db;
    line-height: 1.3;
}
.summary-key {
    font-size: 10px;
    font-weight: 600;
    color: #5a6478;
    white-space: nowrap;
}
.breakdown-toggle {
    display: block;
    width: 100%;
    text-align: left;
    margin-top: 6px;
    padding: 4px 0;
    border: none;
    background: transparent;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.breakdown-toggle:hover {
    text-decoration: underline;
}
.breakdown-body {
    margin-top: 4px;
    padding: 8px 10px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    background: #f8fafd;
}
.breakdown-caption {
    font-size: 11px;
    font-weight: 700;
    color: #5a6478;
    margin-bottom: 4px;
}
.breakdown-caption + .breakdown-caption,
.breakdown-row + .breakdown-caption,
.section-empty + .breakdown-caption {
    margin-top: 8px;
}
.breakdown-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    line-height: 1.7;
    min-width: 0;
}
.breakdown-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #1f2533;
}
.breakdown-count {
    flex: 0 0 auto;
    font-weight: 600;
    color: #0085db;
}
.mode-toggle {
    display: flex;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    overflow: hidden;
}
.mode-btn {
    flex: 1;
    padding: 7px 4px;
    border: none;
    background: #fff;
    color: #5a6478;
    font-size: 12px;
    cursor: pointer;
}
.mode-btn + .mode-btn {
    border-left: 1px solid #e7eaf3;
}
.mode-btn:hover {
    background: #f4f6fb;
}
.mode-btn.active {
    background: #e5f3fb;
    color: #0085db;
    font-weight: 700;
}
.parse-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    padding: 6px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    text-align: left;
}
.parse-badges:hover {
    background: #f4f6fb;
}
.badge {
    font-size: 11px;
    font-weight: 700;
    border-radius: 8px;
    padding: 2px 8px;
}
.badge.warn {
    color: #b7791f;
    background: #fdf3df;
}
.badge.unresolved {
    color: #b83280;
    background: #fdeef7;
}
.badge.failed {
    color: #c53030;
    background: #fde8e8;
}
.report-btn {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #0085db;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
}
.report-btn:hover:not(:disabled) {
    background: #e5f3fb;
}
.report-btn:disabled {
    color: #8a93a6;
    cursor: not-allowed;
}
.whatif-note {
    font-size: 12px;
    opacity: 0.7;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
