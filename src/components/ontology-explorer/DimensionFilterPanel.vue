<template>
    <div class="filter-panel">
        <v-tabs v-model="activeTab" density="compact" grow color="#0085db" class="panel-tabs">
            <v-tab value="overview" class="panel-tab">개요</v-tab>
            <v-tab value="filter" class="panel-tab">필터</v-tab>
            <v-tab value="focus" class="panel-tab">
                포커스<span v-if="focusActive" class="tab-badge">{{ focus.entityIds.length }}</span>
            </v-tab>
            <v-tab value="insight" class="panel-tab">
                인사이트<span v-if="insightCount" class="tab-badge">{{ insightCount }}</span>
            </v-tab>
            <v-tab value="tasks" class="panel-tab">
                태스크<span v-if="openTaskCount" class="tab-badge">{{ openTaskCount }}</span>
            </v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="panel-window">
            <!-- ── 개요 탭: 통계 카드 + Top 인사이트 + 빠른 이동(FR-028) ── -->
            <v-window-item value="overview">
                <div class="pane-scroll pane-scroll--flush">
                    <OverviewPanel
                        :stats="overviewStats"
                        :sections="overviewSections"
                        :scope-note="scopeNote"
                        @open-insight="onOpenInsight"
                        @go-tab="onGoTab"
                    />
                </div>
            </v-window-item>

            <!-- ── 필터 탭: 텍스트 검색 + 노드 타입 토글 + 활동 서브타입 + 기존 축 필터 ── -->
            <v-window-item value="filter">
                <div class="pane-scroll">
                    <div class="section">
                        <div class="section-title">텍스트 검색</div>
                        <v-text-field
                            :model-value="searchTerm"
                            density="compact"
                            variant="outlined"
                            hide-details
                            clearable
                            placeholder="노드 라벨 검색"
                            prepend-inner-icon="mdi-magnify"
                            @update:model-value="onSearchInput"
                        />
                    </div>

                    <div v-if="nodeTypeOptions.length" class="section">
                        <div class="section-title">
                            노드 타입 <span class="axis-count">{{ nodeTypeOptions.length }}</span>
                        </div>
                        <label v-for="opt in nodeTypeOptions" :key="opt.type" class="axis-option">
                            <input type="checkbox" :checked="isTypeVisible(opt.type)" @change="toggleNodeType(opt.type)" />
                            <i class="type-dot" :style="{ background: opt.color }"></i>
                            <span class="axis-option-label">{{ opt.label }}</span>
                            <span class="type-count">{{ opt.count }}</span>
                        </label>
                    </div>

                    <div class="section">
                        <div class="section-title">
                            활동 서브타입
                            <span v-if="subtypesDisabled" class="section-hint">활동 상세/전체 뷰에서 적용됩니다</span>
                        </div>
                        <label
                            v-for="opt in ACTIVITY_SUBTYPE_OPTIONS"
                            :key="opt.value"
                            class="axis-option"
                            :class="{ 'axis-option--disabled': subtypesDisabled }"
                        >
                            <input
                                type="checkbox"
                                :checked="isSubtypeVisible(opt.value)"
                                :disabled="subtypesDisabled"
                                @change="toggleSubtype(opt.value)"
                            />
                            <span class="axis-option-label">{{ opt.label }}</span>
                        </label>
                    </div>

                    <div class="section">
                        <div class="section-title">다차원 필터 <span class="section-hint">축 간 AND · 축 내 OR</span></div>
                        <div v-if="!axes.length" class="panel-empty">사용 가능한 축이 없습니다.</div>

                        <div v-for="axis in axes" :key="axis.key" class="axis-block">
                            <div class="axis-header">
                                {{ axis.label }} <span class="axis-count">{{ axis.values.length }}</span>
                            </div>
                            <label v-for="opt in axis.values" :key="opt.value" class="axis-option">
                                <input type="checkbox" :checked="isChecked(axis.key, opt.value)" @change="toggle(axis.key, opt.value)" />
                                <span class="axis-option-label">{{ opt.label }}</span>
                            </label>
                        </div>

                        <button v-if="hasActive" class="clear-btn" @click="clearAll">필터 초기화</button>
                    </div>
                </div>
            </v-window-item>

            <!-- ── 포커스 탭 ── -->
            <v-window-item value="focus">
                <div class="pane-scroll pane-scroll--flush">
                    <EntityFocusPanel
                        :entity-options="entityOptions"
                        :focus="focus"
                        @update:focus="emit('update:focus', $event)"
                        @clear-focus="emit('clear-focus')"
                    />
                </div>
            </v-window-item>

            <!-- ── 인사이트 탭 ── -->
            <v-window-item value="insight">
                <div class="pane-scroll pane-scroll--flush">
                    <InsightListPanel
                        :insights-by-category="insightsByCategory"
                        :active-insight-id="activeInsightId"
                        :workflow-statuses="workflowStatuses"
                        :display-limit="displayLimit"
                        :large-graph="largeGraph"
                        @select-insight="emit('select-insight', $event)"
                        @show-evidence="emit('show-evidence', $event)"
                        @update:display-limit="emit('update:displayLimit', $event)"
                    />
                </div>
            </v-window-item>

            <!-- ── 태스크 탭: 데이터 태스크 목록(FR-027) ── -->
            <v-window-item value="tasks">
                <div class="pane-scroll pane-scroll--flush">
                    <DataTasksPanel :tasks="tasks" @update-task-status="emit('update-task-status', $event)" />
                </div>
            </v-window-item>
        </v-window>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DimensionAxis } from '@/composables/ontology/ontologyTypes';
import type { EntityFocusState, EntityOption } from '@/composables/ontology/entityFocus';
import { defaultEntityFocusState, isEntityFocusActive } from '@/composables/ontology/entityFocus';
import type { InsightCard } from '@/lib/processKg/analysis/types';
import type { OverviewStats, TopInsightSection } from '@/composables/ontology/overviewInsights';
import type { DataTask, DataTaskStatus } from '@/composables/ontology/useInsightWorkflow';
import type { ViewMode } from '@/composables/ontology/viewModes';
import EntityFocusPanel from '@/components/ontology-explorer/EntityFocusPanel.vue';
import InsightListPanel from '@/components/ontology-explorer/InsightListPanel.vue';
import OverviewPanel from '@/components/ontology-explorer/OverviewPanel.vue';
import DataTasksPanel from '@/components/ontology-explorer/DataTasksPanel.vue';

/** 노드 타입 토글 옵션(가시 타입 체크박스 그룹, FR-018). */
export interface NodeTypeOption {
    type: string;
    label: string;
    color: string;
    count: number;
}

/** 우측 패널 5탭 키(FR-027/028 — 개요/태스크 추가, activePane 외부 제어 유지). */
export type PanelPane = 'overview' | 'filter' | 'focus' | 'insight' | 'tasks';

const props = withDefaults(
    defineProps<{
        axes: DimensionAxis[];
        activeFilters: Record<string, string[]>;
        /* ── 002 확장(additive) — 상태 소유는 useOntologyGraph, 여기는 props/emit만 ── */
        nodeTypeOptions?: NodeTypeOption[];
        visibleNodeTypes?: string[];
        searchTerm?: string;
        entityOptions?: EntityOption[];
        focus?: EntityFocusState;
        insightsByCategory?: Record<string, InsightCard[]>;
        activeInsightId?: string | null;
        /* ── 002 갭 클로징(T070) — 개요/태스크 탭 + 서브타입 필터 + 인사이트 pass-through ── */
        overviewStats?: OverviewStats;
        overviewSections?: TopInsightSection[];
        scopeNote?: string | null;
        tasks?: DataTask[];
        workflowStatuses?: Record<string, string>;
        displayLimit?: number;
        largeGraph?: boolean;
        /** 활동 서브타입(Task/CallActivity) 표시 필터(FR-030) — 활동이 보이는 뷰에서만 유효. */
        visibleActivitySubtypes?: string[];
        viewMode?: ViewMode;
        /** 탭 외부 제어(선택) — 미지정 시 내부 로컬 탭 상태로 동작(기존 동작 유지). */
        activePane?: PanelPane | null;
    }>(),
    {
        nodeTypeOptions: () => [],
        visibleNodeTypes: () => [],
        searchTerm: '',
        entityOptions: () => [],
        focus: () => ({ ...defaultEntityFocusState }),
        insightsByCategory: () => ({}),
        activeInsightId: null,
        overviewStats: () => ({ processes: 0, activities: 0, systems: 0, organizations: 0, insights: 0, openTasks: 0 }),
        overviewSections: () => [],
        scopeNote: null,
        tasks: () => [],
        workflowStatuses: () => ({}),
        displayLimit: 20,
        largeGraph: false,
        visibleActivitySubtypes: () => ['Task', 'CallActivity'],
        viewMode: 'processOverview',
        activePane: null
    }
);

const emit = defineEmits<{
    (e: 'filters-change', filters: Record<string, string[]>): void;
    (e: 'update:visibleNodeTypes', types: string[]): void;
    (e: 'update:searchTerm', term: string): void;
    (e: 'update:focus', focus: EntityFocusState): void;
    (e: 'clear-focus'): void;
    (e: 'select-insight', card: InsightCard): void;
    (e: 'show-evidence', card: InsightCard): void;
    (e: 'open-insight', payload: { card: InsightCard; tab: string }): void;
    (e: 'go-tab', tab: string): void;
    (e: 'update:visibleActivitySubtypes', subtypes: string[]): void;
    (e: 'update:displayLimit', n: number): void;
    (e: 'update-task-status', payload: { taskId: string; status: DataTaskStatus }): void;
    (e: 'update:activePane', pane: PanelPane): void;
}>();

/** activePane prop 이 있으면 제어형(v-model:active-pane), 없으면 로컬 탭 상태(개요 기본 활성). */
const localTab = ref<PanelPane>('overview');
const activeTab = computed<PanelPane>({
    get: () => props.activePane ?? localTab.value,
    set: (pane) => {
        localTab.value = pane;
        emit('update:activePane', pane);
    }
});

const hasActive = computed(() => Object.values(props.activeFilters).some((v) => v && v.length > 0));
const focusActive = computed(() => isEntityFocusActive(props.focus));
const insightCount = computed(() => Object.values(props.insightsByCategory).reduce((sum, cards) => sum + (cards?.length ?? 0), 0));
const openTaskCount = computed(() => props.tasks.filter((task) => task.status === 'open').length);

/* ── 개요 탭(OverviewPanel pass-through) ── */

/** OverviewPanel 빠른 이동 탭 키 → 내부 5탭 키 매핑. */
const GO_TAB_TO_PANE: Record<string, PanelPane> = {
    overview: 'overview',
    insights: 'insight',
    insight: 'insight',
    tasks: 'tasks',
    focus: 'focus',
    filter: 'filter'
};

/** 상세 보기 — 인사이트 탭으로 전환 후 상위(콘솔 고정 등) 처리 위임. */
function onOpenInsight(payload: { card: InsightCard; tab: string }) {
    activeTab.value = 'insight';
    emit('open-insight', payload);
}

/** 빠른 이동 — 내부 탭 전환 + 재-emit(상위 부가 동작용). */
function onGoTab(tab: string) {
    const pane = GO_TAB_TO_PANE[tab];
    if (pane) activeTab.value = pane;
    emit('go-tab', tab);
}

/* ── 축 필터(기존 동작 유지: 축 간 AND · 축 내 OR) ── */

function isChecked(axisKey: string, value: string): boolean {
    return (props.activeFilters[axisKey] || []).includes(value);
}

function toggle(axisKey: string, value: string) {
    const next: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(props.activeFilters)) next[k] = [...v];
    const cur = next[axisKey] || [];
    next[axisKey] = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    if (!next[axisKey].length) delete next[axisKey];
    emit('filters-change', next);
}

function clearAll() {
    emit('filters-change', {});
}

/* ── 노드 타입 토글 ── */

function isTypeVisible(type: string): boolean {
    return props.visibleNodeTypes.includes(type);
}

function toggleNodeType(type: string) {
    const cur = props.visibleNodeTypes;
    const next = cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type];
    emit('update:visibleNodeTypes', next);
}

/* ── 활동 서브타입 필터(FR-030) ── */

const ACTIVITY_SUBTYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'Task', label: 'Task' },
    { value: 'CallActivity', label: 'Call Activity' }
];

/** 프로세스 개요 뷰에는 활동 노드가 없음 — 비활성 + 안내 힌트(FR-030). */
const subtypesDisabled = computed(() => props.viewMode === 'processOverview');

function isSubtypeVisible(subtype: string): boolean {
    return props.visibleActivitySubtypes.includes(subtype);
}

function toggleSubtype(subtype: string) {
    const cur = props.visibleActivitySubtypes;
    const next = cur.includes(subtype) ? cur.filter((s) => s !== subtype) : [...cur, subtype];
    emit('update:visibleActivitySubtypes', next);
}

/* ── 텍스트 검색 ── */

function onSearchInput(value: string | null) {
    emit('update:searchTerm', value ?? '');
}
</script>

<style scoped>
.filter-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    color: #1f2533;
    background: #ffffff;
}
.panel-tabs {
    flex: 0 0 auto;
    border-bottom: 1px solid #e7eaf3;
}
.panel-tab {
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    min-width: 0;
    padding: 0 6px;
}
.tab-badge {
    margin-left: 5px;
    font-size: 10px;
    font-weight: 600;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 8px;
    padding: 1px 6px;
}
.panel-window {
    flex: 1 1 auto;
    min-height: 0;
}
.panel-window :deep(.v-window__container),
.panel-window :deep(.v-window-item) {
    height: 100%;
}
.pane-scroll {
    height: 100%;
    overflow-y: auto;
    padding: 14px 16px;
}
.pane-scroll--flush {
    padding: 0;
}
.section {
    margin-bottom: 18px;
}
.section-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e7eaf3;
    display: flex;
    align-items: center;
    gap: 6px;
}
.section-hint {
    font-size: 10px;
    font-weight: 500;
    color: #8a93a6;
}
.panel-empty {
    color: #8a93a6;
    font-size: 12px;
}
.axis-block {
    margin-bottom: 16px;
}
.axis-header {
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
    text-transform: uppercase;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.axis-count {
    font-size: 10px;
    font-weight: 600;
    color: #0085db;
    background: #e5f3fb;
    border-radius: 8px;
    padding: 1px 6px;
}
.axis-option {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    padding: 3px 4px;
    border-radius: 6px;
    cursor: pointer;
}
.axis-option:hover {
    background: #f4f6fb;
}
.axis-option input {
    accent-color: #0085db;
}
.axis-option--disabled {
    opacity: 0.55;
    cursor: not-allowed;
}
.axis-option--disabled:hover {
    background: transparent;
}
.axis-option-label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.type-dot {
    flex: 0 0 auto;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
}
.type-count {
    flex: 0 0 auto;
    font-size: 11px;
    color: #8a93a6;
}
.clear-btn {
    margin-top: 8px;
    width: 100%;
    padding: 7px;
    border-radius: 6px;
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #0085db;
    font-weight: 600;
    cursor: pointer;
}
.clear-btn:hover {
    background: #e5f3fb;
}
</style>
