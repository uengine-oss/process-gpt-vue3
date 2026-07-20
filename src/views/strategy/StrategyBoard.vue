<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStrategyStore } from '@/stores/strategy/strategyStore';
import StrategyChatPanel from '@/components/strategy/StrategyChatPanel.vue';

const store = useStrategyStore();
const router = useRouter();
const chatPanelOpen = ref(false);

const PERSPECTIVES = ['financial', 'customer', 'internal_process', 'learning_growth'];
const PERSPECTIVE_COLORS: Record<string, string> = {
    financial: '#1565c0',
    customer: '#2e7d32',
    internal_process: '#e65100',
    learning_growth: '#6a1b9a'
};
const MEASURE_TYPES = ['instance_count', 'avg_duration_hours', 'survey_score', 'external_source', 'manual'];
const INITIATIVE_STATUSES = ['planned', 'in_progress', 'completed', 'on_hold'];
const STATUS_COLORS: Record<string, string> = {
    planned: 'grey',
    in_progress: 'primary',
    completed: 'success',
    on_hold: 'warning'
};

const selectedObjectiveId = ref<string | null>(null);
const detailTab = ref('kpis');
const measuring = ref(false);
const importing = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });

const selectedObjective = computed(() => store.objectives.find((o: any) => o.id === selectedObjectiveId.value) || null);

const objectivesByPerspective = computed(() => {
    const grouped: Record<string, any[]> = {};
    for (const perspective of PERSPECTIVES) grouped[perspective] = [];
    for (const objective of store.objectives) {
        (grouped[objective.perspective] || grouped.financial).push(objective);
    }
    return grouped;
});

// ------------------------------------------------------------------ SVG 연결선
const mapContainer = ref<HTMLElement | null>(null);
const cardEls: Record<string, HTMLElement> = {};
const edges = ref<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

function setCardRef(id: string, el: any) {
    if (el) cardEls[id] = el.$el || el;
    else delete cardEls[id];
}

function computeEdges() {
    const container = mapContainer.value;
    if (!container) return;
    const base = container.getBoundingClientRect();
    const result: any[] = [];
    for (const objective of store.objectives) {
        const childEl = cardEls[objective.id];
        if (!childEl) continue;
        for (const parentId of objective.parents || []) {
            const parentEl = cardEls[parentId];
            if (!parentEl) continue;
            const c = childEl.getBoundingClientRect();
            const p = parentEl.getBoundingClientRect();
            result.push({
                x1: c.left + c.width / 2 - base.left,
                y1: c.top - base.top,
                x2: p.left + p.width / 2 - base.left,
                y2: p.bottom - base.top
            });
        }
    }
    edges.value = result;
}

function edgePath(edge: any) {
    const midY = (edge.y1 + edge.y2) / 2;
    return `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`;
}

watch(() => store.objectives, () => nextTick(computeEdges), { deep: true });
const handleResize = () => computeEdges();

// ------------------------------------------------------------------ 전략목표 다이얼로그
const objectiveDialog = reactive({
    open: false,
    editingId: null as string | null,
    form: { name: '', description: '', perspective: 'financial', parents: [] as string[] }
});

function openObjectiveDialog(objective?: any) {
    objectiveDialog.editingId = objective?.id || null;
    objectiveDialog.form = {
        name: objective?.name || '',
        description: objective?.description || '',
        perspective: objective?.perspective || 'financial',
        parents: [...(objective?.parents || [])]
    };
    objectiveDialog.open = true;
}

async function saveObjective() {
    if (!objectiveDialog.form.name) return;
    if (objectiveDialog.editingId) await store.updateObjective(objectiveDialog.editingId, objectiveDialog.form);
    else await store.createObjective(objectiveDialog.form);
    objectiveDialog.open = false;
}

async function removeObjective(objective: any) {
    if (!confirm(`'${objective.name}' 전략목표와 하위 KPI/이니셔티브를 모두 삭제할까요?`)) return;
    selectedObjectiveId.value = null;
    await store.deleteObjective(objective.id);
}

const parentOptions = computed(() =>
    store.objectives
        .filter((o: any) => o.id !== objectiveDialog.editingId)
        .map((o: any) => ({ title: o.name, value: o.id }))
);

// ------------------------------------------------------------------ KPI 다이얼로그 + AI 추천
const kpiDialog = reactive({
    open: false,
    editingId: null as string | null,
    suggesting: false,
    suggestion: null as any,
    form: {
        objective_id: '',
        name: '',
        description: '',
        unit: '',
        measure_type: 'survey_score',
        proc_def_id: null as string | null,
        direction: 'increase',
        baseline_value: null as number | null,
        target_value: null as number | null,
        period_start: '',
        period_end: '',
        survey_questions: [] as string[],
        source_url: '',
        source_field: ''
    }
});

function openKpiDialog(kpi?: any) {
    kpiDialog.editingId = kpi?.id || null;
    kpiDialog.suggestion = null;
    kpiDialog.form = {
        objective_id: kpi?.objective_id || selectedObjectiveId.value || '',
        name: kpi?.name || '',
        description: kpi?.description || '',
        unit: kpi?.unit || '',
        measure_type: kpi?.measure_type || 'survey_score',
        proc_def_id: kpi?.proc_def_id || null,
        direction: kpi?.direction || 'increase',
        baseline_value: kpi?.baseline_value != null ? Number(kpi.baseline_value) : null,
        target_value: kpi?.target_value != null ? Number(kpi.target_value) : null,
        period_start: kpi?.period_start || '',
        period_end: kpi?.period_end || '',
        survey_questions: [...(kpi?.survey_questions || [])],
        source_url: kpi?.source_url || '',
        source_field: kpi?.source_field || ''
    };
    kpiDialog.open = true;
}

async function aiSuggest() {
    if (!kpiDialog.form.name) return;
    kpiDialog.suggesting = true;
    try {
        kpiDialog.suggestion = await store.suggestMapping({
            name: kpiDialog.form.name,
            description: kpiDialog.form.description,
            measure_type: kpiDialog.form.measure_type
        });
        // 최적 후보/문항 자동 적용 (사용자가 다이얼로그에서 바꿀 수 있음)
        const best = kpiDialog.suggestion?.process_candidates?.[0];
        if (best && !kpiDialog.form.proc_def_id) kpiDialog.form.proc_def_id = best.id;
        if (kpiDialog.suggestion?.survey_questions?.length && !kpiDialog.form.survey_questions.length) {
            kpiDialog.form.survey_questions = [...kpiDialog.suggestion.survey_questions];
        }
    } catch (e: any) {
        showSnack(e?.message || 'AI suggest failed', 'error');
    } finally {
        kpiDialog.suggesting = false;
    }
}

function applyCandidate(candidate: any) {
    kpiDialog.form.proc_def_id = candidate.id;
}

async function saveKpi() {
    if (!kpiDialog.form.name || !kpiDialog.form.objective_id) return;
    const payload = {
        ...kpiDialog.form,
        baseline_value: kpiDialog.form.baseline_value ?? null,
        target_value: kpiDialog.form.target_value ?? null,
        period_start: kpiDialog.form.period_start || null,
        period_end: kpiDialog.form.period_end || null,
        survey_questions: kpiDialog.form.survey_questions.filter((q) => q && q.trim()),
        source_url: kpiDialog.form.source_url || null,
        source_field: kpiDialog.form.source_field || null
    };
    if (kpiDialog.editingId) await store.updateKpi(kpiDialog.editingId, payload);
    else await store.createKpi(payload);
    kpiDialog.open = false;
}

async function removeKpi(kpi: any) {
    if (!confirm(`KPI '${kpi.name}' 을(를) 삭제할까요?`)) return;
    await store.deleteKpi(kpi.id);
}

// KPI 상세 (측정 이력 / 설문 현황)
const kpiDetails = reactive<Record<string, any>>({});

async function toggleKpiDetail(kpi: any) {
    if (kpiDetails[kpi.id]) {
        delete kpiDetails[kpi.id];
        return;
    }
    const detail: any = { measurements: [], surveys: null };
    detail.measurements = await store.getMeasurements(kpi.id);
    if (kpi.measure_type === 'survey_score') {
        const surveys = await store.getSurveys(kpi.id);
        detail.surveys = {
            sent: surveys.length,
            answered: surveys.filter((s: any) => s.status === 'ANSWERED').length
        };
    }
    kpiDetails[kpi.id] = detail;
}

// 수동 실적 입력
const manualDialog = reactive({ open: false, kpi: null as any, value: null as number | null });

function openManualDialog(kpi: any) {
    manualDialog.kpi = kpi;
    manualDialog.value = kpi.current_value != null ? Number(kpi.current_value) : null;
    manualDialog.open = true;
}

async function saveManualValue() {
    if (manualDialog.kpi && manualDialog.value != null) {
        await store.setManualValue(manualDialog.kpi.id, Number(manualDialog.value));
    }
    manualDialog.open = false;
}

// ------------------------------------------------------------------ 이니셔티브 다이얼로그
const initiativeDialog = reactive({
    open: false,
    editingId: null as string | null,
    form: {
        objective_id: '',
        name: '',
        description: '',
        owner_email: '',
        status: 'planned',
        progress: 0,
        proc_def_id: null as string | null,
        start_date: '',
        due_date: ''
    }
});

function openInitiativeDialog(initiative?: any) {
    initiativeDialog.editingId = initiative?.id || null;
    initiativeDialog.form = {
        objective_id: initiative?.objective_id || selectedObjectiveId.value || '',
        name: initiative?.name || '',
        description: initiative?.description || '',
        owner_email: initiative?.owner_email || '',
        status: initiative?.status || 'planned',
        progress: initiative?.progress || 0,
        proc_def_id: initiative?.proc_def_id || null,
        start_date: initiative?.start_date || '',
        due_date: initiative?.due_date || ''
    };
    initiativeDialog.open = true;
}

async function saveInitiative() {
    if (!initiativeDialog.form.name || !initiativeDialog.form.objective_id) return;
    const payload = {
        ...initiativeDialog.form,
        start_date: initiativeDialog.form.start_date || null,
        due_date: initiativeDialog.form.due_date || null
    };
    if (initiativeDialog.editingId) await store.updateInitiative(initiativeDialog.editingId, payload);
    else await store.createInitiative(payload);
    initiativeDialog.open = false;
}

async function removeInitiative(initiative: any) {
    if (!confirm(`이니셔티브 '${initiative.name}' 을(를) 삭제할까요?`)) return;
    await store.deleteInitiative(initiative.id);
}

// ------------------------------------------------------------------ 공통
function showSnack(text: string, color = 'success') {
    snackbar.text = text;
    snackbar.color = color;
    snackbar.show = true;
}

async function refreshMeasurement() {
    measuring.value = true;
    try {
        const result = await store.runMeasurement();
        showSnack(`측정 완료 — KPI ${result.kpis_measured}건 갱신, 설문 ${result.surveys_dispatched}건 발행`);
    } catch (e: any) {
        showSnack(e?.message || 'measurement failed', 'error');
    } finally {
        measuring.value = false;
    }
}

async function importLegacy() {
    importing.value = true;
    try {
        const result = await store.importLegacyBscard();
        showSnack(`기존 전략맵에서 ${result.imported}개 목표를 가져왔습니다`);
    } catch (e: any) {
        showSnack(e?.message || 'import failed', 'error');
    } finally {
        importing.value = false;
    }
}

function processName(procDefId: string | null) {
    if (!procDefId) return null;
    return store.processDefinitions.find((p: any) => p.id === procDefId)?.name || procDefId;
}

function achievementColor(rate: number | null) {
    if (rate == null) return 'grey';
    if (rate >= 100) return 'success';
    if (rate >= 70) return 'primary';
    if (rate >= 40) return 'warning';
    return 'error';
}

function formatValue(value: any) {
    if (value == null) return '-';
    const num = Number(value);
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

onMounted(async () => {
    window.addEventListener('resize', handleResize);
    await Promise.all([store.loadMap(), store.loadProcessDefinitions()]);
    await nextTick();
    computeEdges();
});

onBeforeUnmount(() => window.removeEventListener('resize', handleResize));
</script>

<template>
    <v-card elevation="0" class="strategy-board-page" style="overflow: auto; height: 100%">
        <!-- Header -->
        <div class="d-flex align-center justify-space-between mb-4 px-2 flex-wrap ga-2">
            <div>
                <h2 class="text-h5 font-weight-bold">{{ $t('strategyBoard.title') }}</h2>
                <span class="text-caption text-medium-emphasis">{{ $t('strategyBoard.subtitle') }}</span>
            </div>
            <div class="d-flex align-center ga-2">
                <v-btn v-if="!store.objectives.length" variant="outlined" size="small" :loading="importing" @click="importLegacy">
                    <v-icon start size="16">mdi-database-import-outline</v-icon>
                    {{ $t('strategyBoard.importLegacy') }}
                </v-btn>
                <v-btn variant="outlined" size="small" :loading="measuring" @click="refreshMeasurement">
                    <v-icon start size="16">mdi-refresh</v-icon>
                    {{ $t('strategyBoard.refreshMeasure') }}
                </v-btn>
                <!-- 온톨로지 뷰(애널리틱스)로 이동 — 전략/프로세스/리소스/지식 전체 그래프 -->
                <v-btn variant="outlined" size="small" @click="router.push('/analytics/ontology')">
                    <v-icon start size="16">mdi-graph-outline</v-icon>
                    온톨로지 뷰
                </v-btn>
                <!-- 채팅으로 전략맵 편집 -->
                <v-btn variant="outlined" size="small" @click="chatPanelOpen = true">
                    <v-icon start size="16">mdi-robot</v-icon>
                    {{ $t('strategyBoard.chatButton') }}
                </v-btn>
                <v-btn color="primary" size="small" @click="openObjectiveDialog()">
                    <v-icon start size="16">mdi-plus</v-icon>
                    {{ $t('strategyBoard.addObjective') }}
                </v-btn>
            </div>
        </div>

        <StrategyChatPanel v-model="chatPanelOpen" />

        <!-- Loading -->
        <div v-if="store.loading" class="d-flex justify-center py-12">
            <v-progress-circular indeterminate color="primary" />
        </div>

        <template v-else>
            <!-- 전략맵 -->
            <div ref="mapContainer" class="strategy-map position-relative">
                <svg class="edge-layer">
                    <defs>
                        <marker id="strategy-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                            <path d="M0,0 L6,3 L0,6 Z" fill="#9e9e9e" />
                        </marker>
                    </defs>
                    <path
                        v-for="(edge, i) in edges"
                        :key="i"
                        :d="edgePath(edge)"
                        stroke="#9e9e9e"
                        stroke-width="1.5"
                        fill="none"
                        marker-end="url(#strategy-arrow)"
                    />
                </svg>

                <div v-for="perspective in PERSPECTIVES" :key="perspective" class="perspective-lane mb-3">
                    <div class="lane-label" :style="{ borderColor: PERSPECTIVE_COLORS[perspective] }">
                        <span class="text-subtitle-2 font-weight-bold" :style="{ color: PERSPECTIVE_COLORS[perspective] }">
                            {{ $t(`strategyBoard.perspectives.${perspective}`) }}
                        </span>
                    </div>
                    <div class="lane-cards">
                        <v-card
                            v-for="objective in objectivesByPerspective[perspective]"
                            :key="objective.id"
                            :ref="(el: any) => setCardRef(objective.id, el)"
                            variant="outlined"
                            rounded="lg"
                            class="objective-card pa-3"
                            :class="{ selected: objective.id === selectedObjectiveId }"
                            @click="selectedObjectiveId = objective.id === selectedObjectiveId ? null : objective.id"
                        >
                            <div class="text-subtitle-2 font-weight-bold mb-1">{{ objective.name }}</div>
                            <div class="d-flex align-center ga-2 mb-2">
                                <v-chip size="x-small" variant="tonal" prepend-icon="mdi-target">{{ objective.kpis.length }} KPI</v-chip>
                                <v-chip size="x-small" variant="tonal" prepend-icon="mdi-rocket-launch-outline">
                                    {{ objective.initiatives.length }} {{ $t('strategyBoard.initiativeShort') }}
                                </v-chip>
                            </div>
                            <div v-if="objective.achievement != null">
                                <v-progress-linear
                                    :model-value="Math.min(objective.achievement, 100)"
                                    :color="achievementColor(objective.achievement)"
                                    height="6"
                                    rounded
                                />
                                <span class="text-caption text-medium-emphasis">{{ objective.achievement }}%</span>
                            </div>
                            <span v-else class="text-caption text-disabled">{{ $t('strategyBoard.notMeasured') }}</span>
                        </v-card>
                        <div v-if="!objectivesByPerspective[perspective].length" class="text-caption text-disabled pa-3">
                            {{ $t('strategyBoard.emptyLane') }}
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- 상세 패널 -->
        <v-slide-x-reverse-transition>
            <v-card v-if="selectedObjective" class="detail-panel" elevation="8">
                <div class="d-flex align-center justify-space-between pa-4 pb-2">
                    <div>
                        <v-chip
                            size="x-small"
                            variant="tonal"
                            :style="{ color: PERSPECTIVE_COLORS[selectedObjective.perspective] }"
                            class="mb-1"
                        >
                            {{ $t(`strategyBoard.perspectives.${selectedObjective.perspective}`) }}
                        </v-chip>
                        <h3 class="text-h6 font-weight-bold">{{ selectedObjective.name }}</h3>
                        <p v-if="selectedObjective.description" class="text-caption text-medium-emphasis mb-0">
                            {{ selectedObjective.description }}
                        </p>
                    </div>
                    <div class="d-flex ga-1">
                        <v-btn icon size="x-small" variant="text" @click="openObjectiveDialog(selectedObjective)">
                            <v-icon size="18">mdi-pencil</v-icon>
                        </v-btn>
                        <v-btn icon size="x-small" variant="text" color="error" @click="removeObjective(selectedObjective)">
                            <v-icon size="18">mdi-delete-outline</v-icon>
                        </v-btn>
                        <v-btn icon size="x-small" variant="text" @click="selectedObjectiveId = null">
                            <v-icon size="18">mdi-close</v-icon>
                        </v-btn>
                    </div>
                </div>

                <v-tabs v-model="detailTab" density="compact" class="px-2">
                    <v-tab value="kpis">KPI ({{ selectedObjective.kpis.length }})</v-tab>
                    <v-tab value="initiatives">{{ $t('strategyBoard.initiatives') }} ({{ selectedObjective.initiatives.length }})</v-tab>
                </v-tabs>
                <v-divider />

                <div class="detail-body pa-3">
                    <!-- KPI 탭 -->
                    <template v-if="detailTab === 'kpis'">
                        <v-btn block variant="tonal" color="primary" size="small" class="mb-3" @click="openKpiDialog()">
                            <v-icon start size="16">mdi-plus</v-icon>{{ $t('strategyBoard.addKpi') }}
                        </v-btn>
                        <v-card v-for="kpi in selectedObjective.kpis" :key="kpi.id" variant="outlined" rounded="lg" class="pa-3 mb-2">
                            <div class="d-flex align-center justify-space-between">
                                <span class="text-subtitle-2 font-weight-bold">{{ kpi.name }}</span>
                                <div class="d-flex ga-1">
                                    <v-btn
                                        v-if="kpi.measure_type === 'manual'"
                                        icon
                                        size="x-small"
                                        variant="text"
                                        :title="$t('strategyBoard.manualValue')"
                                        @click="openManualDialog(kpi)"
                                    >
                                        <v-icon size="16">mdi-pencil-box-outline</v-icon>
                                    </v-btn>
                                    <v-btn icon size="x-small" variant="text" @click="toggleKpiDetail(kpi)">
                                        <v-icon size="16">{{ kpiDetails[kpi.id] ? 'mdi-chevron-up' : 'mdi-chart-line' }}</v-icon>
                                    </v-btn>
                                    <v-btn icon size="x-small" variant="text" @click="openKpiDialog(kpi)">
                                        <v-icon size="16">mdi-pencil</v-icon>
                                    </v-btn>
                                    <v-btn icon size="x-small" variant="text" color="error" @click="removeKpi(kpi)">
                                        <v-icon size="16">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                            <div class="d-flex align-center ga-2 my-1 flex-wrap">
                                <v-chip size="x-small" variant="tonal">{{ $t(`strategyBoard.measureTypes.${kpi.measure_type}`) }}</v-chip>
                                <v-chip v-if="kpi.proc_def_id" size="x-small" variant="tonal" color="primary" prepend-icon="mdi-sitemap">
                                    {{ processName(kpi.proc_def_id) }}
                                </v-chip>
                            </div>
                            <div class="d-flex align-center justify-space-between mt-1">
                                <span class="text-caption">
                                    {{ formatValue(kpi.current_value) }} / {{ formatValue(kpi.target_value) }}
                                    <span v-if="kpi.unit">{{ kpi.unit }}</span>
                                </span>
                                <span class="text-caption font-weight-bold" :class="`text-${achievementColor(kpi.achievement)}`">
                                    {{ kpi.achievement != null ? kpi.achievement + '%' : $t('strategyBoard.notMeasured') }}
                                </span>
                            </div>
                            <v-progress-linear
                                :model-value="Math.min(kpi.achievement || 0, 100)"
                                :color="achievementColor(kpi.achievement)"
                                height="5"
                                rounded
                                class="mt-1"
                            />
                            <!-- 측정 이력 / 설문 현황 -->
                            <div v-if="kpiDetails[kpi.id]" class="mt-2 pt-2" style="border-top: 1px dashed rgba(0, 0, 0, 0.12)">
                                <div v-if="kpiDetails[kpi.id].surveys" class="text-caption mb-1">
                                    <v-icon size="14">mdi-clipboard-text-outline</v-icon>
                                    {{ $t('strategyBoard.surveyStatus') }}: {{ kpiDetails[kpi.id].surveys.answered }} /
                                    {{ kpiDetails[kpi.id].surveys.sent }} {{ $t('strategyBoard.answered') }}
                                </div>
                                <div v-if="kpiDetails[kpi.id].measurements.length" class="text-caption">
                                    <div
                                        v-for="(m, i) in kpiDetails[kpi.id].measurements.slice(0, 5)"
                                        :key="i"
                                        class="d-flex justify-space-between"
                                    >
                                        <span>{{ new Date(m.measured_at).toLocaleString() }}</span>
                                        <span class="font-weight-bold">{{ formatValue(m.value) }} ({{ m.source }})</span>
                                    </div>
                                </div>
                                <div v-else class="text-caption text-disabled">{{ $t('strategyBoard.noMeasurements') }}</div>
                            </div>
                        </v-card>
                        <div v-if="!selectedObjective.kpis.length" class="text-caption text-disabled text-center py-4">
                            {{ $t('strategyBoard.noKpis') }}
                        </div>
                    </template>

                    <!-- 이니셔티브 탭 -->
                    <template v-else>
                        <v-btn block variant="tonal" color="primary" size="small" class="mb-3" @click="openInitiativeDialog()">
                            <v-icon start size="16">mdi-plus</v-icon>{{ $t('strategyBoard.addInitiative') }}
                        </v-btn>
                        <v-card
                            v-for="initiative in selectedObjective.initiatives"
                            :key="initiative.id"
                            variant="outlined"
                            rounded="lg"
                            class="pa-3 mb-2"
                        >
                            <div class="d-flex align-center justify-space-between">
                                <span class="text-subtitle-2 font-weight-bold">{{ initiative.name }}</span>
                                <div class="d-flex ga-1">
                                    <v-btn icon size="x-small" variant="text" @click="openInitiativeDialog(initiative)">
                                        <v-icon size="16">mdi-pencil</v-icon>
                                    </v-btn>
                                    <v-btn icon size="x-small" variant="text" color="error" @click="removeInitiative(initiative)">
                                        <v-icon size="16">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                            <div class="d-flex align-center ga-2 my-1 flex-wrap">
                                <v-chip size="x-small" variant="tonal" :color="STATUS_COLORS[initiative.status]">
                                    {{ $t(`strategyBoard.statuses.${initiative.status}`) }}
                                </v-chip>
                                <v-chip v-if="initiative.proc_def_id" size="x-small" variant="tonal" color="primary" prepend-icon="mdi-sitemap">
                                    {{ processName(initiative.proc_def_id) }}
                                </v-chip>
                                <span v-if="initiative.owner_email" class="text-caption text-medium-emphasis">
                                    <v-icon size="12">mdi-account-outline</v-icon> {{ initiative.owner_email }}
                                </span>
                            </div>
                            <div class="d-flex align-center ga-2">
                                <v-progress-linear :model-value="initiative.progress" color="primary" height="5" rounded style="flex: 1" />
                                <span class="text-caption">{{ initiative.progress }}%</span>
                            </div>
                            <div v-if="initiative.due_date" class="text-caption text-medium-emphasis mt-1">
                                <v-icon size="12">mdi-calendar</v-icon> ~ {{ initiative.due_date }}
                            </div>
                        </v-card>
                        <div v-if="!selectedObjective.initiatives.length" class="text-caption text-disabled text-center py-4">
                            {{ $t('strategyBoard.noInitiatives') }}
                        </div>
                    </template>
                </div>
            </v-card>
        </v-slide-x-reverse-transition>

        <!-- 전략목표 다이얼로그 -->
        <v-dialog v-model="objectiveDialog.open" max-width="480">
            <v-card class="pa-4">
                <h3 class="text-h6 mb-3">
                    {{ objectiveDialog.editingId ? $t('strategyBoard.editObjective') : $t('strategyBoard.addObjective') }}
                </h3>
                <v-text-field v-model="objectiveDialog.form.name" :label="$t('strategyBoard.name')" density="compact" variant="outlined" />
                <v-textarea
                    v-model="objectiveDialog.form.description"
                    :label="$t('strategyBoard.description')"
                    density="compact"
                    variant="outlined"
                    rows="2"
                />
                <v-select
                    v-model="objectiveDialog.form.perspective"
                    :items="PERSPECTIVES.map((p) => ({ title: $t(`strategyBoard.perspectives.${p}`), value: p }))"
                    :label="$t('strategyBoard.perspective')"
                    density="compact"
                    variant="outlined"
                />
                <v-select
                    v-model="objectiveDialog.form.parents"
                    :items="parentOptions"
                    :label="$t('strategyBoard.parentObjectives')"
                    density="compact"
                    variant="outlined"
                    multiple
                    chips
                    closable-chips
                />
                <div class="d-flex justify-end ga-2 mt-2">
                    <v-btn variant="text" @click="objectiveDialog.open = false">{{ $t('strategyBoard.cancel') }}</v-btn>
                    <v-btn color="primary" :disabled="!objectiveDialog.form.name" @click="saveObjective">
                        {{ $t('strategyBoard.save') }}
                    </v-btn>
                </div>
            </v-card>
        </v-dialog>

        <!-- KPI 다이얼로그 -->
        <v-dialog v-model="kpiDialog.open" max-width="640">
            <v-card class="pa-4">
                <h3 class="text-h6 mb-3">{{ kpiDialog.editingId ? $t('strategyBoard.editKpi') : $t('strategyBoard.addKpi') }}</h3>
                <v-text-field v-model="kpiDialog.form.name" :label="$t('strategyBoard.name')" density="compact" variant="outlined" />
                <v-textarea
                    v-model="kpiDialog.form.description"
                    :label="$t('strategyBoard.description')"
                    density="compact"
                    variant="outlined"
                    rows="2"
                />
                <v-row dense>
                    <v-col cols="6">
                        <v-select
                            v-model="kpiDialog.form.measure_type"
                            :items="MEASURE_TYPES.map((t) => ({ title: $t(`strategyBoard.measureTypes.${t}`), value: t }))"
                            :label="$t('strategyBoard.measureType')"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="6">
                        <v-btn
                            block
                            variant="tonal"
                            color="secondary"
                            :loading="kpiDialog.suggesting"
                            :disabled="!kpiDialog.form.name"
                            style="height: 40px"
                            @click="aiSuggest"
                        >
                            <v-icon start size="16">mdi-creation</v-icon>
                            {{ $t('strategyBoard.aiSuggest') }}
                        </v-btn>
                    </v-col>
                </v-row>

                <!-- AI 추천 결과 -->
                <v-alert v-if="kpiDialog.suggestion" variant="tonal" color="secondary" density="compact" class="mb-3">
                    <div class="text-caption font-weight-bold mb-1">{{ $t('strategyBoard.aiCandidates') }}</div>
                    <div v-if="!kpiDialog.suggestion.process_candidates?.length" class="text-caption">
                        {{ $t('strategyBoard.noCandidates') }}
                    </div>
                    <div
                        v-for="candidate in kpiDialog.suggestion.process_candidates"
                        :key="candidate.id"
                        class="d-flex align-center ga-2 mb-1"
                    >
                        <v-chip
                            size="small"
                            :variant="kpiDialog.form.proc_def_id === candidate.id ? 'elevated' : 'outlined'"
                            color="secondary"
                            @click="applyCandidate(candidate)"
                        >
                            {{ candidate.name }}
                        </v-chip>
                        <span class="text-caption">{{ candidate.reason }}</span>
                    </div>
                </v-alert>

                <v-autocomplete
                    v-if="kpiDialog.form.measure_type !== 'manual'"
                    v-model="kpiDialog.form.proc_def_id"
                    :items="store.processDefinitions.map((p: any) => ({ title: p.name, value: p.id }))"
                    :label="$t('strategyBoard.linkedProcess')"
                    density="compact"
                    variant="outlined"
                    clearable
                />
                <v-row dense>
                    <v-col cols="4">
                        <v-text-field v-model="kpiDialog.form.unit" :label="$t('strategyBoard.unit')" density="compact" variant="outlined" />
                    </v-col>
                    <v-col cols="4">
                        <v-text-field
                            v-model.number="kpiDialog.form.baseline_value"
                            :label="$t('strategyBoard.baseline')"
                            type="number"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="4">
                        <v-text-field
                            v-model.number="kpiDialog.form.target_value"
                            :label="$t('strategyBoard.target')"
                            type="number"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                </v-row>
                <v-row dense>
                    <v-col cols="4">
                        <v-select
                            v-model="kpiDialog.form.direction"
                            :items="[
                                { title: $t('strategyBoard.directionIncrease'), value: 'increase' },
                                { title: $t('strategyBoard.directionDecrease'), value: 'decrease' }
                            ]"
                            :label="$t('strategyBoard.direction')"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="4">
                        <v-text-field
                            v-model="kpiDialog.form.period_start"
                            :label="$t('strategyBoard.periodStart')"
                            type="date"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="4">
                        <v-text-field
                            v-model="kpiDialog.form.period_end"
                            :label="$t('strategyBoard.periodEnd')"
                            type="date"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                </v-row>

                <!-- 설문 문항 편집기 -->
                <template v-if="kpiDialog.form.measure_type === 'survey_score'">
                    <div class="d-flex align-center justify-space-between mb-1">
                        <span class="text-subtitle-2">{{ $t('strategyBoard.surveyQuestions') }}</span>
                        <v-btn size="x-small" variant="text" @click="kpiDialog.form.survey_questions.push('')">
                            <v-icon start size="14">mdi-plus</v-icon>{{ $t('strategyBoard.addQuestion') }}
                        </v-btn>
                    </div>
                    <div v-for="(q, i) in kpiDialog.form.survey_questions" :key="i" class="d-flex align-center ga-1 mb-1">
                        <v-text-field
                            v-model="kpiDialog.form.survey_questions[i]"
                            density="compact"
                            variant="outlined"
                            hide-details
                            :placeholder="`Q${i + 1}`"
                        />
                        <v-btn icon size="x-small" variant="text" color="error" @click="kpiDialog.form.survey_questions.splice(i, 1)">
                            <v-icon size="16">mdi-close</v-icon>
                        </v-btn>
                    </div>
                    <p class="text-caption text-medium-emphasis mt-1">{{ $t('strategyBoard.surveyHint') }}</p>
                </template>

                <!-- 외부 System of Record 연동 -->
                <template v-if="kpiDialog.form.measure_type === 'external_source'">
                    <v-text-field
                        v-model="kpiDialog.form.source_url"
                        :label="$t('strategyBoard.sourceUrl')"
                        density="compact"
                        variant="outlined"
                        placeholder="https://sor.example.com/api/metrics"
                    />
                    <v-text-field
                        v-model="kpiDialog.form.source_field"
                        :label="$t('strategyBoard.sourceField')"
                        density="compact"
                        variant="outlined"
                        placeholder="data.metrics.nps_score"
                    />
                    <p class="text-caption text-medium-emphasis mt-1">{{ $t('strategyBoard.sourceHint') }}</p>
                </template>

                <div class="d-flex justify-end ga-2 mt-2">
                    <v-btn variant="text" @click="kpiDialog.open = false">{{ $t('strategyBoard.cancel') }}</v-btn>
                    <v-btn color="primary" :disabled="!kpiDialog.form.name" @click="saveKpi">{{ $t('strategyBoard.save') }}</v-btn>
                </div>
            </v-card>
        </v-dialog>

        <!-- 이니셔티브 다이얼로그 -->
        <v-dialog v-model="initiativeDialog.open" max-width="560">
            <v-card class="pa-4">
                <h3 class="text-h6 mb-3">
                    {{ initiativeDialog.editingId ? $t('strategyBoard.editInitiative') : $t('strategyBoard.addInitiative') }}
                </h3>
                <v-text-field v-model="initiativeDialog.form.name" :label="$t('strategyBoard.name')" density="compact" variant="outlined" />
                <v-textarea
                    v-model="initiativeDialog.form.description"
                    :label="$t('strategyBoard.description')"
                    density="compact"
                    variant="outlined"
                    rows="2"
                />
                <v-row dense>
                    <v-col cols="6">
                        <v-select
                            v-model="initiativeDialog.form.status"
                            :items="INITIATIVE_STATUSES.map((s) => ({ title: $t(`strategyBoard.statuses.${s}`), value: s }))"
                            :label="$t('strategyBoard.status')"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="6">
                        <v-text-field
                            v-model="initiativeDialog.form.owner_email"
                            :label="$t('strategyBoard.owner')"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                </v-row>
                <v-autocomplete
                    v-model="initiativeDialog.form.proc_def_id"
                    :items="store.processDefinitions.map((p: any) => ({ title: p.name, value: p.id }))"
                    :label="$t('strategyBoard.linkedProcess')"
                    density="compact"
                    variant="outlined"
                    clearable
                />
                <v-row dense>
                    <v-col cols="6">
                        <v-text-field
                            v-model="initiativeDialog.form.start_date"
                            :label="$t('strategyBoard.startDate')"
                            type="date"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="6">
                        <v-text-field
                            v-model="initiativeDialog.form.due_date"
                            :label="$t('strategyBoard.dueDate')"
                            type="date"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                </v-row>
                <div class="mb-2">
                    <span class="text-caption">{{ $t('strategyBoard.progress') }}: {{ initiativeDialog.form.progress }}%</span>
                    <v-slider v-model="initiativeDialog.form.progress" :min="0" :max="100" :step="5" hide-details density="compact" />
                </div>
                <div class="d-flex justify-end ga-2 mt-2">
                    <v-btn variant="text" @click="initiativeDialog.open = false">{{ $t('strategyBoard.cancel') }}</v-btn>
                    <v-btn color="primary" :disabled="!initiativeDialog.form.name" @click="saveInitiative">
                        {{ $t('strategyBoard.save') }}
                    </v-btn>
                </div>
            </v-card>
        </v-dialog>

        <!-- 수동 실적 입력 다이얼로그 -->
        <v-dialog v-model="manualDialog.open" max-width="360">
            <v-card class="pa-4">
                <h3 class="text-h6 mb-3">{{ $t('strategyBoard.manualValue') }}</h3>
                <v-text-field
                    v-model.number="manualDialog.value"
                    :label="$t('strategyBoard.enterValue')"
                    type="number"
                    density="compact"
                    variant="outlined"
                />
                <div class="d-flex justify-end ga-2">
                    <v-btn variant="text" @click="manualDialog.open = false">{{ $t('strategyBoard.cancel') }}</v-btn>
                    <v-btn color="primary" :disabled="manualDialog.value == null" @click="saveManualValue">
                        {{ $t('strategyBoard.save') }}
                    </v-btn>
                </div>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">{{ snackbar.text }}</v-snackbar>
    </v-card>
</template>

<style scoped>
.strategy-board-page {
    padding: 16px;
}
.strategy-map {
    min-height: 400px;
}
.edge-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}
.perspective-lane {
    display: flex;
    align-items: stretch;
    gap: 12px;
    min-height: 96px;
}
.lane-label {
    flex: 0 0 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-left: 4px solid;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 8px;
    text-align: center;
    padding: 8px;
}
.lane-cards {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    padding: 4px 0;
}
.objective-card {
    width: 220px;
    cursor: pointer;
    transition: box-shadow 0.15s, border-color 0.15s;
    background: rgb(var(--v-theme-surface));
    z-index: 2;
}
.objective-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.objective-card.selected {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}
.detail-panel {
    position: fixed;
    top: 64px;
    right: 0;
    bottom: 0;
    width: 440px;
    max-width: 90vw;
    z-index: 1005;
    display: flex;
    flex-direction: column;
    border-radius: 12px 0 0 12px;
}
.detail-body {
    flex: 1;
    overflow-y: auto;
}
</style>
