<template>
    <div ref="rootEl" class="oe-root">
        <!-- 상단 바: 타이틀 · 카운트 · 뷰 모드 · EVIDENCE 배지 · 범례 -->
        <div class="oe-topbar">
            <div class="oe-brand">
                <div class="oe-brand__logo">
                    <span class="oe-brand__mark">◈</span>
                </div>
                <div>
                    <div class="oe-brand__title">온톨로지 익스플로러</div>
                    <div class="oe-brand__subtitle">Ontology Explorer</div>
                </div>
            </div>

            <div class="oe-counts">
                <span class="oe-count"
                    ><b>{{ totalNodes }}</b> 노드</span
                >
                <span class="oe-count-sep">·</span>
                <span class="oe-count"
                    ><b>{{ totalEdges }}</b> 관계</span
                >
                <span v-if="riskCount" class="oe-count oe-count--risk"
                    ><b>{{ riskCount }}</b> 위험</span
                >
            </div>

            <span class="oe-mode-chip">{{ viewModeLabel }}</span>

            <div v-if="evidence.active" class="oe-evidence">
                <span class="oe-evidence__badge">EVIDENCE</span>
                <button class="oe-evidence__exit" title="근거 모드 종료" @click="exitEvidence">종료 ✕</button>
            </div>

            <div class="oe-legend">
                <span v-for="entry in topLegend" :key="entry.type" class="oe-legend__item"
                    ><i class="dot" :style="{ background: entry.color }"></i>{{ entry.label }}</span
                >
            </div>
        </div>

        <!-- 본문: 좌 컨트롤 / 중앙(캔버스+콘솔) / 우 필터·포커스·인사이트 -->
        <div class="oe-body">
            <WhatIfSimulatorPanel
                class="oe-left"
                :view-mode="viewMode"
                :parse-summary="parseSummary"
                :sources="sourceState.sources"
                :current-source-id="sourceState.currentSourceId"
                :metadata="metadata"
                :summary="graphSummary"
                :report-ready="Boolean(graph) && !loading"
                @update:view-mode="setViewMode"
                @select-source="switchSource"
                @load-artifact="onLoadArtifact"
                @generate-report="openReport"
                @show-parse-report="parseReportOpen = true"
            />

            <div class="oe-center">
                <div class="oe-canvas-region">
                    <div v-if="loading" class="oe-overlay">온톨로지 그래프 로딩 중…</div>
                    <div v-else-if="error" class="oe-overlay oe-overlay--error">{{ error }}</div>
                    <!-- 희소 포커스 안내 배너(FR-034) — 컨텍스트 노드 0 + 엣지 ≤1 -->
                    <div v-else-if="sparseFocus.active" class="oe-sparse-banner">
                        <span class="oe-sparse-banner__text">{{ sparseFocus.message }}</span>
                        <button v-if="viewMode !== 'activityDetail'" class="oe-sparse-banner__btn" @click="setViewMode('activityDetail')">
                            활동 상세 모드로 전환
                        </button>
                    </div>
                    <OntologyCanvas2D
                        :nodes="renderNodes"
                        :edges="renderEdges"
                        :visibility="visibilityMap"
                        :risk-node-ids="riskNodeIdRecord"
                        :evidence-active="evidence.active"
                        :render-blocked="renderBlocked"
                        :depth="sliceState.depth"
                        :focus-node-id="sliceState.focusNodeId"
                        :selected-node-id="sliceState.selectedNodeId"
                        @node-click="onNodeClick"
                        @focus="setFocus"
                        @set-depth="setDepth"
                        @background-click="clearSelection"
                        @open-focus-panel="openFocusPane"
                    />

                    <!-- AI 추론 콘솔 — 캔버스 하단 고정 드로어(레이아웃 계산과 무관하게 항상 보임) -->
                    <div class="oe-console-drawer" :class="{ open: consoleOpen }">
                        <button class="drawer-bar" @click="consoleOpen = !consoleOpen">
                            <span class="drawer-title">AI Reasoning Console</span>
                            <span class="drawer-node">{{ consoleSubtitle }}</span>
                            <span v-if="selectedRiskType" class="drawer-risk">⚠ {{ selectedRiskType }}</span>
                            <span class="drawer-chevron">{{ consoleOpen ? '▾' : '▴' }}</span>
                        </button>
                        <div v-show="consoleOpen" class="drawer-body">
                            <AiReasoningConsole
                                :selected-node="selectedNode"
                                :cq-actions="cqActionsForSelected"
                                :active-insight="activeInsight"
                                :node-context="nodeContext"
                                :narrative="activeNarrative"
                                :narrative-loading="activeNarrativeLoading"
                                :narrative-error="activeNarrativeError"
                                :evidence-active="evidence.active"
                                :workflow-status="activeInsightStatus"
                                @run-cq="runCq"
                                @show-evidence="onShowEvidence"
                                @request-narrative="ensureNarrative"
                                @focus-node="onFocusNode"
                                @add-to-focus="onAddToFocus"
                                @context-highlight="onContextHighlight"
                                @focus-entity="onFocusEntity"
                                @update-status="onUpdateInsightStatus"
                                @create-task="onCreateTask"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div class="oe-right">
                <DimensionFilterPanel
                    :axes="dimensionAxes"
                    :active-filters="sliceState.activeFilters"
                    :node-type-options="nodeTypeOptions"
                    :visible-node-types="visibleNodeTypeList"
                    :visible-activity-subtypes="visibleActivitySubtypeList"
                    :view-mode="viewMode"
                    :search-term="sliceState.searchTerm"
                    :entity-options="entityOptions"
                    :focus="entityFocus"
                    :insights-by-category="insightsByCategory"
                    :active-insight-id="activeInsight?.id ?? null"
                    :overview-stats="overviewStats"
                    :overview-sections="overviewSections"
                    :scope-note="overviewScopeNote"
                    :tasks="dataTasks"
                    :workflow-statuses="workflowStatuses"
                    :display-limit="displayLimit"
                    :large-graph="largeGraph"
                    :active-pane="rightPane"
                    @update:active-pane="rightPane = $event"
                    @filters-change="setFilters"
                    @update:visible-node-types="setNodeTypes"
                    @update:visible-activity-subtypes="setActivitySubtypes"
                    @update:search-term="setSearch"
                    @update:focus="setEntityFocus"
                    @clear-focus="clearFocus"
                    @select-insight="onSelectInsight"
                    @show-evidence="onShowEvidence"
                    @open-insight="onOpenOverviewInsight"
                    @go-tab="onGoTab"
                    @update:display-limit="setDisplayLimit"
                    @update-task-status="onUpdateTaskStatus"
                />
            </div>
        </div>

        <!-- 종합 분석 리포트 다이얼로그 (결정론 마크다운 — 복사/다운로드) -->
        <v-dialog v-model="reportOpen" max-width="860" scrollable>
            <v-card class="report-card">
                <div class="dialog-head">
                    <span class="dialog-title">프로세스 지식그래프 분석 리포트</span>
                    <div class="dialog-actions">
                        <button class="dialog-btn" @click="copyReport">
                            {{ reportCopyState === 'copied' ? '복사됨' : reportCopyState === 'failed' ? '복사 실패' : '마크다운 복사' }}
                        </button>
                        <button class="dialog-btn" @click="downloadReport">.md 다운로드</button>
                        <button class="dialog-btn dialog-btn--close" @click="reportOpen = false">닫기 ✕</button>
                    </div>
                </div>
                <div class="dialog-body">
                    <pre class="report-pre">{{ reportMarkdown }}</pre>
                </div>
            </v-card>
        </v-dialog>

        <!-- 파싱 리포트 드로어(경고/미해결 참조 목록) -->
        <v-dialog v-model="parseReportOpen" max-width="720" scrollable>
            <v-card class="report-card">
                <div class="dialog-head">
                    <span class="dialog-title">파싱 리포트</span>
                    <div class="dialog-actions">
                        <button class="dialog-btn dialog-btn--close" @click="parseReportOpen = false">닫기 ✕</button>
                    </div>
                </div>
                <div class="dialog-body">
                    <template v-if="parseReport">
                        <div class="parse-summary-row">
                            <span class="parse-chip">파싱 성공 {{ parseReport.parsedFiles }}</span>
                            <span class="parse-chip parse-chip--failed">실패 {{ parseReport.failedFiles }}</span>
                            <span class="parse-chip parse-chip--warn">경고 {{ parseReport.warnings.length }}</span>
                            <span class="parse-chip parse-chip--unresolved">미해결 {{ parseReport.unresolvedReferences.length }}</span>
                        </div>

                        <div class="parse-section-title">경고</div>
                        <div v-if="!parseReport.warnings.length" class="parse-empty">경고 없음</div>
                        <div
                            v-for="(warning, i) in parseReport.warnings"
                            :key="'w' + i"
                            class="parse-row"
                            :class="'parse-row--' + warning.severity"
                        >
                            <span class="parse-row__severity">{{ warning.severity }}</span>
                            <span class="parse-row__code">{{ warning.code }}</span>
                            <span class="parse-row__message">
                                {{ warning.message }}
                                <span v-if="warning.file" class="parse-row__file">({{ warning.file }})</span>
                            </span>
                        </div>

                        <div class="parse-section-title">미해결 참조</div>
                        <div v-if="!parseReport.unresolvedReferences.length" class="parse-empty">미해결 참조 없음</div>
                        <div
                            v-for="(unresolved, i) in parseReport.unresolvedReferences"
                            :key="'u' + i"
                            class="parse-row parse-row--warning"
                        >
                            <span class="parse-row__code">{{ unresolved.sourceModelId }}</span>
                            <span class="parse-row__message">
                                {{ unresolved.sourceElementId }} → definitionId "{{ unresolved.definitionId }}" 해석 불가
                            </span>
                        </div>
                    </template>
                    <div v-else class="parse-empty">파싱 리포트가 없습니다.</div>
                </div>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import WhatIfSimulatorPanel from '@/components/ontology-explorer/WhatIfSimulatorPanel.vue';
import OntologyCanvas2D from '@/components/ontology-explorer/OntologyCanvas2D.vue';
import AiReasoningConsole from '@/components/ontology-explorer/AiReasoningConsole.vue';
import DimensionFilterPanel from '@/components/ontology-explorer/DimensionFilterPanel.vue';
import { useOntologyGraph } from '@/composables/ontology/useOntologyGraph';
import { colorForNodeType, labelForNodeType } from '@/composables/ontology/nodeTypeColors';
import type { ViewMode } from '@/composables/ontology/viewModes';
import type { InsightCard } from '@/lib/processKg/analysis/types';

const {
    graph,
    loading,
    error,
    viewMode,
    sliceState,
    entityFocus,
    evidence,
    activeInsight,
    sourceState,
    parseReport,
    parseSummary,
    metadata,
    dimensionAxes,
    renderNodes,
    renderEdges,
    renderBlocked,
    visibilityMap,
    nodeTypeOptions,
    entityOptions,
    insightsByCategory,
    riskNodeIdRecord,
    selectedNode,
    cqActionsForSelected,
    activeNarrative,
    activeNarrativeLoading,
    activeNarrativeError,
    nodeContext,
    sparseFocus,
    largeGraph,
    graphSummary,
    overviewStats,
    overviewSections,
    overviewScopeNote,
    workflowStatuses,
    activeInsightStatus,
    displayLimit,
    dataTasks,
    loadGraph,
    switchSource,
    setViewMode,
    setFilters,
    setNodeTypes,
    setSearch,
    setEntityFocus,
    clearFocus,
    setActivitySubtypes,
    focusSelectedNode,
    addSelectedToFocus,
    focusEntity,
    selectNode,
    clearSelection,
    setFocus,
    setDepth,
    selectInsight,
    setDisplayLimit,
    updateInsightStatus,
    createDataTask,
    updateTaskStatus,
    runCq,
    enterEvidence,
    exitEvidence,
    ensureNarrative,
    buildReport
} = useOntologyGraph();

const rootEl = ref<HTMLElement | null>(null);
const consoleOpen = ref(false);
/** 우측 패널 5탭(개요 기본 활성, FR-028). */
const rightPane = ref<'overview' | 'filter' | 'focus' | 'insight' | 'tasks'>('overview');

const reportOpen = ref(false);
const reportMarkdown = ref('');
const reportCopyState = ref<'idle' | 'copied' | 'failed'>('idle');
let reportCopyTimer: ReturnType<typeof setTimeout> | null = null;

const parseReportOpen = ref(false);

const VIEW_MODE_LABELS_KO: Record<ViewMode, string> = {
    processOverview: '프로세스 개요',
    activityDetail: '활동 상세',
    full: '전체 기술 그래프'
};

const totalNodes = computed(() => graph.value?.nodes.length ?? 0);
const totalEdges = computed(() => graph.value?.edges.length ?? 0);
const riskCount = computed(() => Object.keys(riskNodeIdRecord.value).length);
const viewModeLabel = computed(() => VIEW_MODE_LABELS_KO[viewMode.value]);

/** 상단 바 범례 — canonical 팔레트의 핵심 4종(캔버스는 표시 중 타입 자동 범례 별도 제공). */
const topLegend = (['Process', 'ProcessActivity', 'Organization', 'System'] as const).map((type) => ({
    type,
    color: colorForNodeType(type),
    label: labelForNodeType(type)
}));

const consoleSubtitle = computed(() => {
    if (selectedNode.value) return selectedNode.value.label || selectedNode.value.id;
    if (activeInsight.value) return activeInsight.value.title;
    return '노드를 선택하거나 인사이트를 열면 상세가 표시됩니다';
});

const selectedRiskType = computed(() => {
    const id = sliceState.selectedNodeId;
    return id ? riskNodeIdRecord.value[id] ?? null : null;
});

const visibleNodeTypeList = computed(() => [...sliceState.visibleNodeTypes] as string[]);
const visibleActivitySubtypeList = computed(() => [...sliceState.visibleActivitySubtypes] as string[]);

function onNodeClick(nodeId: string) {
    // 노드 클릭 → 선택+상세만(샘플 사용법). Depth fade 는 콘솔의 '주변 하이라이트'로 명시 발동.
    selectNode(nodeId);
    consoleOpen.value = true;
}

/** 콘솔 '주변 하이라이트(Depth)' — 선택 노드 기준 fade 슬라이싱을 명시적으로 켠다(FR-015/019). */
function onContextHighlight() {
    if (sliceState.selectedNodeId) setFocus(sliceState.selectedNodeId);
}

function onSelectInsight(card: InsightCard) {
    selectInsight(card);
    consoleOpen.value = true;
}

/** 근거 보기 토글 — 같은 카드 재클릭 시 근거 모드 종료. */
function onShowEvidence(card: InsightCard) {
    if (evidence.active && evidence.insightId === card.id) {
        exitEvidence();
    } else {
        enterEvidence(card);
    }
    consoleOpen.value = true;
}

function onLoadArtifact(payload: { url?: string; file?: File }) {
    switchSource({ artifact: payload });
}

function openFocusPane() {
    rightPane.value = 'focus';
}

/* ── 개요 탭(FR-028) — 상세 보기/빠른 이동 ── */

/** 개요 '상세 보기' — 인사이트 탭 열기 + 카드 콘솔 고정(카테고리 탭은 목록 내부 상태라 콘솔 고정으로 대신). */
function onOpenOverviewInsight(payload: { card: InsightCard; tab: string }) {
    selectInsight(payload.card);
    rightPane.value = 'insight';
    consoleOpen.value = true;
}

/** 빠른 이동 — 패널이 내부 탭 전환 후 재-emit(제어형이라 방어적으로 동기화). */
function onGoTab(tab: string) {
    const mapped: Record<string, typeof rightPane.value> = {
        overview: 'overview',
        insights: 'insight',
        insight: 'insight',
        tasks: 'tasks',
        focus: 'focus',
        filter: 'filter'
    };
    if (mapped[tab]) rightPane.value = mapped[tab];
}

/* ── 콘솔 포커스 액션(FR-029) ── */

function onFocusNode() {
    if (focusSelectedNode()) rightPane.value = 'focus';
}

function onAddToFocus() {
    if (addSelectedToFocus()) rightPane.value = 'focus';
}

/** 콜 액티비티 부모/자식 드릴다운 — setEntityFocus 계열 + 포커스 탭 열기. */
function onFocusEntity(nodeId: string) {
    if (focusEntity(nodeId)) rightPane.value = 'focus';
}

/* ── 검토 워크플로·데이터 태스크(FR-026/027) ── */

function onUpdateInsightStatus(payload: { card: InsightCard; status: string }) {
    updateInsightStatus(payload.card, payload.status);
}

/** 태스크 생성 성공 시 우측 태스크 탭으로 유도. */
function onCreateTask(card: InsightCard) {
    const task = createDataTask(card);
    if (task) rightPane.value = 'tasks';
}

function onUpdateTaskStatus(payload: { taskId: string; status: 'open' | 'in_progress' | 'done' }) {
    updateTaskStatus(payload.taskId, payload.status);
}

function openReport() {
    reportMarkdown.value = buildReport();
    reportOpen.value = true;
}

async function copyReport() {
    try {
        await navigator.clipboard.writeText(reportMarkdown.value);
        reportCopyState.value = 'copied';
    } catch {
        reportCopyState.value = 'failed';
    }
    if (reportCopyTimer) clearTimeout(reportCopyTimer);
    reportCopyTimer = setTimeout(() => {
        reportCopyState.value = 'idle';
    }, 1500);
}

function downloadReport() {
    const blob = new Blob([reportMarkdown.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `process-kg-report-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
}

/** 루트 높이를 실측으로 고정 — calc 추정이 레이아웃 크롬과 어긋나 하단 콘솔이 fold 밖으로 밀리는 문제 방지. */
function fitHeight() {
    const el = rootEl.value;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    el.style.height = `${Math.max(540, window.innerHeight - top - 16)}px`;
}

function onKeydown(ev: KeyboardEvent) {
    if (ev.key !== 'Escape') return;
    if (evidence.active) exitEvidence();
    clearSelection();
}

onMounted(() => {
    loadGraph();
    fitHeight();
    requestAnimationFrame(fitHeight);
    window.addEventListener('resize', fitHeight);
    window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', fitHeight);
    window.removeEventListener('keydown', onKeydown);
    if (reportCopyTimer) clearTimeout(reportCopyTimer);
});
</script>

<style scoped>
/* v-main(v-container) 안에 카드로 배치 — AN Studio 패턴과 동일한 높이 계산. */
.oe-root {
    width: 100%;
    height: calc(100dvh - var(--v-layout-top, 64px) - 44px);
    min-height: 540px;
    display: flex;
    flex-direction: column;
    background: #f4f6fb;
    border: 1px solid #e7eaf3;
    border-radius: 14px;
    overflow: hidden;
}

/* ── 상단 바 ── */
.oe-topbar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 16px;
    height: 60px;
    padding: 0 20px;
    background: #ffffff;
    border-bottom: 1px solid #e7eaf3;
}
.oe-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 200px;
}
.oe-brand__logo {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(135deg, #0085db 0%, #4f8cff 100%);
    box-shadow: 0 4px 12px rgba(0, 133, 219, 0.3);
}
.oe-brand__mark {
    font-size: 18px;
}
.oe-brand__title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #1f2533;
    line-height: 1.1;
}
.oe-brand__subtitle {
    font-size: 0.68rem;
    letter-spacing: 0.02em;
    color: #97a0b5;
    font-family: 'JetBrains Mono', monospace;
}
.oe-counts {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    color: #5a6478;
}
.oe-count b {
    color: #1f2533;
}
.oe-count-sep {
    color: #c3cad6;
}
.oe-count--risk b {
    color: #e5484d;
}
.oe-count--risk {
    color: #e5484d;
}
.oe-mode-chip {
    font-size: 0.72rem;
    font-weight: 700;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 999px;
    padding: 3px 10px;
    white-space: nowrap;
}
.oe-evidence {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.oe-evidence__badge {
    background: #1f2533;
    color: #ffd166;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
}
.oe-evidence__exit {
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #e5484d;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    cursor: pointer;
}
.oe-evidence__exit:hover {
    background: #fff1f0;
}
.oe-legend {
    margin-left: auto;
    display: flex;
    gap: 14px;
    font-size: 0.78rem;
    color: #5a6478;
}
.oe-legend__item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.oe-legend__item .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}

/* ── 본문 3열 ── */
.oe-body {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 320px;
}
.oe-left {
    position: relative;
    z-index: 2;
    background: #ffffff;
    border-right: 1px solid #e7eaf3;
}
.oe-center {
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.oe-canvas-region {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}
.oe-right {
    position: relative;
    z-index: 2;
    background: #ffffff;
    border-left: 1px solid #e7eaf3;
    overflow: hidden;
}

/* ── AI 콘솔 드로어: 캔버스 하단 고정 오버레이 ── */
.oe-console-drawer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 6;
    background: #ffffff;
    border-top: 1px solid #e7eaf3;
    box-shadow: 0 -4px 16px rgba(31, 37, 51, 0.08);
}
.drawer-bar {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 16px;
    background: #ffffff;
    border: none;
    cursor: pointer;
    font-size: 12px;
}
.drawer-bar:hover {
    background: #f8fafd;
}
.drawer-title {
    font-weight: 700;
    color: #5a6478;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
}
.drawer-node {
    flex: 1;
    text-align: left;
    color: #8a93a6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.drawer-risk {
    color: #e5484d;
    font-weight: 600;
    white-space: nowrap;
}
.drawer-chevron {
    color: #8a93a6;
}
.drawer-body {
    height: 260px;
    border-top: 1px solid #f0f2f8;
}
.oe-overlay {
    position: absolute;
    z-index: 5;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: #ffffff;
    color: #1f2533;
    border: 1px solid #e7eaf3;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.oe-overlay--error {
    color: #e5484d;
}

/* ── 희소 포커스 안내 배너(FR-034) — 캔버스 상단 ── */
.oe-sparse-banner {
    position: absolute;
    z-index: 5;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    max-width: min(620px, calc(100% - 32px));
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fdf3df;
    border: 1px solid #f3e3bd;
    color: #b7791f;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.5;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.oe-sparse-banner__text {
    flex: 1 1 auto;
    min-width: 0;
}
.oe-sparse-banner__btn {
    flex: 0 0 auto;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #0085db;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    cursor: pointer;
    white-space: nowrap;
}
.oe-sparse-banner__btn:hover {
    background: #e5f3fb;
}

/* ── 다이얼로그(리포트/파싱 리포트) ── */
.report-card {
    background: #ffffff;
    color: #1f2533;
    border-radius: 12px;
}
.dialog-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid #e7eaf3;
}
.dialog-title {
    font-size: 14px;
    font-weight: 700;
}
.dialog-actions {
    display: flex;
    gap: 8px;
}
.dialog-btn {
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #0085db;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
}
.dialog-btn:hover {
    background: #e5f3fb;
}
.dialog-btn--close {
    color: #5a6478;
}
.dialog-btn--close:hover {
    background: #f4f6fb;
}
.dialog-body {
    padding: 14px 18px;
    max-height: 64vh;
    overflow-y: auto;
}
.report-pre {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'JetBrains Mono', 'D2Coding', monospace;
}

/* ── 파싱 리포트 목록 ── */
.parse-summary-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
}
.parse-chip {
    font-size: 11px;
    font-weight: 700;
    border-radius: 8px;
    padding: 2px 8px;
    color: #2f855a;
    background: #e6f6ee;
}
.parse-chip--failed {
    color: #c53030;
    background: #fde8e8;
}
.parse-chip--warn {
    color: #b7791f;
    background: #fdf3df;
}
.parse-chip--unresolved {
    color: #b83280;
    background: #fdeef7;
}
.parse-section-title {
    font-size: 12px;
    font-weight: 700;
    color: #5a6478;
    text-transform: uppercase;
    margin: 12px 0 6px;
}
.parse-empty {
    font-size: 12px;
    color: #8a93a6;
    padding: 4px 0;
}
.parse-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 6px;
    margin-bottom: 2px;
    background: #f8fafd;
}
.parse-row--error {
    background: #fff5f5;
}
.parse-row--warning {
    background: #fffaf0;
}
.parse-row__severity {
    flex: 0 0 auto;
    font-weight: 700;
    color: #b7791f;
    text-transform: uppercase;
    font-size: 10px;
}
.parse-row--error .parse-row__severity {
    color: #c53030;
}
.parse-row__code {
    flex: 0 0 auto;
    font-family: 'JetBrains Mono', monospace;
    color: #5a6478;
}
.parse-row__message {
    flex: 1 1 0;
    min-width: 0;
    color: #1f2533;
    word-break: break-word;
}
.parse-row__file {
    color: #8a93a6;
}
</style>
