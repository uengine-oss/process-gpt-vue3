<template>
    <div ref="rootEl" class="oen-root">
        <!-- 상단 바: 제목 · 레이어 토글 · 검색 · 범례 -->
        <header class="oen-topbar">
            <div class="oen-title">
                <h1>온톨로지 익스플로러 <span class="oen-new">NEW</span></h1>
                <span class="oen-subtitle">전략에서 스킬까지 — 비즈니스 북극성 추적</span>
            </div>

            <div class="oen-controls">
                <div class="oen-layer-toggles">
                    <button
                        v-for="layer in layerOrder"
                        :key="layer"
                        class="oen-toggle"
                        :class="{ on: visibleLayers.has(layer), empty: emptyLayers.includes(layer) }"
                        :style="visibleLayers.has(layer) ? { borderColor: layerColor(layer), color: layerColor(layer) } : {}"
                        :title="emptyLayers.includes(layer) ? '적재된 데이터 없음' : ''"
                        @click="toggleLayer(layer)"
                    >
                        {{ layerLabelKo(layer) }}<template v-if="emptyLayers.includes(layer)"> ∅</template>
                    </button>
                </div>
                <input v-model="searchTerm" class="oen-search" type="search" placeholder="노드 검색 (이름/유형)" />
                <TypeFilterPanel
                    :visible-labels="visibleLabels"
                    :visible-edge-groups="visibleEdgeGroups"
                    :label-counts="labelCounts"
                    :active="typeFilterActive"
                    @toggle-label="toggleLabel"
                    @toggle-edge-group="toggleEdgeGroup"
                    @reset="resetTypeFilters"
                />
            </div>

            <!-- 범례: 레이어 색 + UML 표기 (FR-012/SC-006, T028) -->
            <div class="oen-legend">
                <span v-for="layer in layerOrder" :key="layer" class="oen-legend-item">
                    <i class="dot" :style="{ background: layerColor(layer) }" />{{ layerLabelKo(layer).split(' ')[0] }}
                </span>
                <span class="oen-legend-item"><i class="uml-inh" />상속/포크 (EXTENDS)</span>
                <span class="oen-legend-item"><i class="uml-ref" />참조/호출 (REQUIRES_SKILL)</span>
            </div>
        </header>

        <!-- 헬스 게이트 — 미설치/불호환/오류는 캔버스 대신 안내 (FR-014, SC-005) -->
        <GraphHealthBanner v-if="healthState !== 'ready'" :state="healthState" :health="health" :error-message="error" />
        <div v-if="healthState === 'loading'" class="oen-loading">
            <v-progress-circular indeterminate color="primary" size="40" width="4" />
            <span>온톨로지 그래프 확인 중…</span>
        </div>

        <div v-if="healthState === 'ready'" class="oen-body">
            <GraphHealthBanner :state="healthState" :health="health" />
            <div class="oen-main">
                <div class="oen-canvas-col">
                    <!-- 렌더 계측 칩 (NVL 단독 — 라이브러리 비교 탭은 NVL 확정 후 제거) -->
                    <div class="oen-canvas-head">
                        <span v-if="perfMetric" class="oen-perf-chip">
                            <b>NVL</b>
                            로드 {{ perfMetric.libLoadMs }}ms · 렌더 {{ perfMetric.renderMs }}ms · {{ perfMetric.nodes }}N/{{
                                perfMetric.edges
                            }}E · {{ perfMetric.finishedAt }}
                        </span>
                    </div>

                    <!-- 그래프 데이터(RPC) 로드 스피너 — 헬스 이후 서브그래프/집계 fetch 구간 -->
                    <div v-if="loading" class="oen-data-loading">
                        <v-progress-circular indeterminate color="primary" size="40" width="4" />
                        <span>그래프 데이터 로드 중…</span>
                    </div>

                    <!-- 렌더 가드 (FR-017) -->
                    <div v-if="visible.blocked.blocked" class="oen-canvas oen-guard">
                        <div class="oen-guard-card">
                            <div class="oen-guard-title">표시 대상이 너무 많습니다</div>
                            <p>
                                현재 조건의 노드 수가 {{ visible.blocked.visibleCount }}개로 렌더 가드를 초과했습니다. 레이어 토글이나
                                필터·검색으로 범위를 좁혀 주세요.
                            </p>
                        </div>
                    </div>

                    <NvlCanvas
                        v-else
                        ref="canvasRef"
                        class="oen-canvas"
                        :nodes="visible.nodes"
                        :edges="visible.edges"
                        :selected-node-id="selectedNodeId"
                        :trace="trace"
                        @node-click="onNodeClick"
                        @background-click="onBackgroundClick"
                        @perf="onPerf"
                    />

                    <!-- 빈 레이어 안내 배지 (FR-014/US5) -->
                    <div v-if="!visible.blocked.blocked && emptyLayers.length" class="oen-empty-chips">
                        <span v-for="layer in emptyLayers" :key="layer" class="oen-empty-chip">
                            {{ layerLabelKo(layer) }} — 적재된 데이터 없음
                        </span>
                    </div>
                </div>

                <!-- 우측 패널: 상세 / 추적 탭 -->
                <aside class="oen-side">
                    <div class="oen-tabs">
                        <button class="oen-tab" :class="{ active: sideTab === 'detail' }" @click="sideTab = 'detail'">상세</button>
                        <button class="oen-tab" :class="{ active: sideTab === 'trace' }" @click="sideTab = 'trace'">
                            추적<span v-if="trace" class="oen-tab-dot" />
                        </button>
                    </div>
                    <NodeDetailPanel
                        v-show="sideTab === 'detail'"
                        class="oen-panel"
                        :node="selectedNode"
                        :edges="graph?.edges ?? []"
                        :node-by-id="nodeById"
                        :kpi-status="selectedKpiStatus"
                        :rollup="selectedRollup"
                        :survey="selectedSurvey"
                        @go-node="goNode"
                        @trace-root-cause="onTraceRootCause"
                        @trace-contribution="onTraceContribution"
                    />
                    <ImpactTracePanel
                        v-show="sideTab === 'trace'"
                        class="oen-panel"
                        :trace="trace"
                        :node-by-id="nodeById"
                        @go-node="goNode"
                        @exit-trace="exitTrace"
                    />
                </aside>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import GraphHealthBanner from '@/components/ontology-explorer-new/GraphHealthBanner.vue';
import ImpactTracePanel from '@/components/ontology-explorer-new/ImpactTracePanel.vue';
import NodeDetailPanel from '@/components/ontology-explorer-new/NodeDetailPanel.vue';
import NvlCanvas from '@/components/ontology-explorer-new/NvlCanvas.vue';
import TypeFilterPanel from '@/components/ontology-explorer-new/TypeFilterPanel.vue';
import { enabledLayerOrder } from '@/composables/ontologyNew/config';
import { LAYER_COLOR, LAYER_LABEL_KO } from '@/composables/ontologyNew/layerMapping';
import type { BusinessLayer, CanvasPerfMetric } from '@/composables/ontologyNew/types';
import { useBusinessOntology } from '@/composables/ontologyNew/useBusinessOntology';

const {
    health,
    healthState,
    emptyLayers,
    graph,
    error,
    loading,
    visibleLayers,
    visibleLabels,
    visibleEdgeGroups,
    labelCounts,
    typeFilterActive,
    searchTerm,
    selectedNodeId,
    selectedNode,
    trace,
    visible,
    kpiStatusRecord,
    activityRollupMap,
    kpiSurveyMap,
    nodeById,
    load,
    selectNode,
    clearSelection,
    toggleLayer,
    toggleLabel,
    toggleEdgeGroup,
    resetTypeFilters,
    startTrace,
    exitTrace
} = useBusinessOntology();

const rootEl = ref<HTMLElement | null>(null);
const canvasRef = ref<InstanceType<typeof NvlCanvas> | null>(null);
const sideTab = ref<'detail' | 'trace'>('detail');

/** 렌더 계측 — NVL 마지막 로드/렌더 시간 (비교 탭은 NVL 확정으로 제거, T051) */
const perfMetric = ref<CanvasPerfMetric | null>(null);

function onPerf(metric: CanvasPerfMetric) {
    perfMetric.value = metric;
}

/** 이 배포에서 활성화된 레이어만 토글·범례에 노출 (FR-021 — config.ts) */
const layerOrder = enabledLayerOrder();
const layerColor = (layer: BusinessLayer) => LAYER_COLOR[layer];
const layerLabelKo = (layer: BusinessLayer) => LAYER_LABEL_KO[layer];

/* ── 선택 노드 파생 (상세 패널) ── */
const selectedKpiStatus = computed(() => (selectedNodeId.value ? kpiStatusRecord.value[selectedNodeId.value] ?? null : null));
const selectedRollup = computed(() => (selectedNodeId.value ? activityRollupMap.value.get(selectedNodeId.value) ?? null : null));
const selectedSurvey = computed(() => (selectedNodeId.value ? kpiSurveyMap.value.get(selectedNodeId.value) ?? null : null));

/* ── 상호작용 ── */

function onNodeClick(nodeId: string) {
    selectNode(nodeId);
    sideTab.value = 'detail';
}

function onBackgroundClick() {
    clearSelection();
}

function goNode(nodeId: string) {
    selectNode(nodeId);
    canvasRef.value?.focusNode(nodeId);
}

function onTraceRootCause(nodeId: string) {
    if (startTrace(nodeId, 'rootCause')) sideTab.value = 'trace';
}

function onTraceContribution(nodeId: string) {
    if (startTrace(nodeId, 'contribution')) sideTab.value = 'trace';
}

/** ESC — 추적 종료 → 선택 해제 순 (ui.contract) */
function onKeydown(ev: KeyboardEvent) {
    if (ev.key !== 'Escape') return;
    if (trace.value) {
        exitTrace();
        return;
    }
    clearSelection();
}

/** 루트 높이 실측 고정 — 레이아웃 크롬과의 calc 어긋남 방지 (기존 explorer 패턴) */
function fitHeight() {
    const el = rootEl.value;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    el.style.height = `${Math.max(560, window.innerHeight - top - 16)}px`;
}

onMounted(() => {
    load();
    fitHeight();
    window.addEventListener('resize', fitHeight);
    window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', fitHeight);
    window.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.oen-root {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 8px;
    overflow: hidden;
}
.oen-topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fff;
}
.oen-title h1 {
    font-size: 17px;
    margin: 0;
    display: inline;
}
.oen-new {
    font-size: 10px;
    vertical-align: super;
    color: #7c3aed;
    font-weight: 800;
}
.oen-subtitle {
    display: block;
    font-size: 11px;
    color: #94a3b8;
}
.oen-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.oen-layer-toggles {
    display: flex;
    gap: 6px;
}
.oen-toggle {
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: #f8fafc;
    color: #94a3b8;
    font-size: 12px;
    padding: 4px 12px;
    cursor: pointer;
}
.oen-toggle.on {
    background: #fff;
    font-weight: 600;
}
.oen-toggle.empty {
    opacity: 0.6;
}
.oen-search {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 5px 10px;
    font-size: 12px;
    min-width: 200px;
}
.oen-legend {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-left: auto;
    font-size: 11px;
    color: #64748b;
}
.oen-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.oen-legend-item .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}
/* UML 표기 미니어처 — 상속: 실선+채워진 삼각촉 / 참조: 점선+열린 촉 */
.uml-inh {
    display: inline-block;
    width: 26px;
    height: 2px;
    background: #15803d;
    position: relative;
}
.uml-inh::after {
    content: '';
    position: absolute;
    right: -2px;
    top: -4px;
    border-left: 9px solid #15803d;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
}
.uml-ref {
    display: inline-block;
    width: 26px;
    height: 0;
    border-top: 2px dashed #16a34a;
    position: relative;
}
.uml-ref::after {
    content: '›';
    position: absolute;
    right: -5px;
    top: -11px;
    color: #16a34a;
    font-size: 15px;
    font-weight: 700;
}
.oen-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #64748b;
    padding: 60px 0;
    font-size: 13px;
}
.oen-data-loading {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.75);
    color: #475569;
    font-size: 13px;
    border-radius: 0 12px 12px 12px;
}
.oen-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.oen-main {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 8px;
}
.oen-canvas-col {
    position: relative; /* 데이터 로드 스피너 오버레이 기준 */
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.oen-canvas-head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 22px;
}
.oen-perf-chip {
    font-size: 10.5px;
    color: #475569;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 2px 9px;
    white-space: nowrap;
}
.oen-perf-chip b {
    margin-right: 4px;
}
.oen-guard {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
}
.oen-guard-card {
    max-width: 420px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fff;
    color: #334155;
    font-size: 13px;
}
.oen-guard-title {
    font-weight: 700;
    margin-bottom: 8px;
}
.oen-empty-chips {
    position: absolute;
    top: 40px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 5;
}
.oen-empty-chip {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 999px;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    color: #92400e;
}
.oen-canvas {
    flex: 1;
    min-width: 0;
    min-height: 0;
    border: 1px solid #e2e8f0;
    border-radius: 0 12px 12px 12px;
    overflow: hidden;
}
.oen-side {
    width: 330px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fff;
    overflow: hidden;
}
.oen-tabs {
    display: flex;
    border-bottom: 1px solid #f1f5f9;
}
.oen-tab {
    flex: 1;
    border: none;
    background: #f8fafc;
    padding: 8px 0;
    font-size: 13px;
    cursor: pointer;
    color: #64748b;
    position: relative;
}
.oen-tab.active {
    background: #fff;
    color: #1e293b;
    font-weight: 700;
}
.oen-tab-dot {
    position: absolute;
    top: 8px;
    margin-left: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d97706;
    display: inline-block;
}
.oen-panel {
    flex: 1;
    min-height: 0;
}
</style>
