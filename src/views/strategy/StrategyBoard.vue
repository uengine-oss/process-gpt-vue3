<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStrategyStore } from '@/stores/strategy/strategyStore';
import BackendFactory from '@/components/api/BackendFactory';

const store = useStrategyStore();
const router = useRouter();
const backend = BackendFactory.createBackend();

// 전략맵을 처음 수립할 때는 bsc-strategy-interview 스킬이 연결된 deepagent 와의
// 대화로 수행한다. ChatRoomPage 를 좁은 도킹 패널에 넣으면 컨텍스트 패널 때문에
// 채팅 영역이 한 글자씩 줄바꿈될 정도로 깨져서, 전용 대화 페이지로 이동한다.
// 이미 목표가 있는 보드에서는 이 경로를 노출하지 않는다(버튼 자체를 숨김).
const STRATEGY_EDIT_SKILL = 'bsc-strategy-interview';
const strategyAgentLoading = ref(false);

async function openAiEditPage() {
    strategyAgentLoading.value = true;
    let agentId: string | null = null;
    try {
        const rows = await backend.getAgentSkillsBySkill(STRATEGY_EDIT_SKILL);
        agentId = rows?.[0]?.user_id || null;
    } finally {
        strategyAgentLoading.value = false;
    }
    if (!agentId) {
        showSnack(
            `전략맵 수립을 담당하는 에이전트를 찾을 수 없습니다. 스킬 관리에서 에이전트에 '${STRATEGY_EDIT_SKILL}' 스킬을 연결해주세요.`,
            'error'
        );
        return;
    }
    router.push({ name: 'Agent Chat', params: { id: agentId } });
}

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
const multiSelectedIds = ref<Set<string>>(new Set());
const contextMenu = reactive({ show: false, x: 0, y: 0 });
const detailTab = ref('kpis');
const measuring = ref(false);
const importing = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });

const selectedObjective = computed(() => store.objectives.find((o: any) => o.id === selectedObjectiveId.value) || null);

// ------------------------------------------------------------------ 전략 정합성 검사
const alignmentDialog = reactive({
    open: false,
    description: '',
    procDefId: null as string | null,
    checking: false,
    linking: false,
    result: null as any
});
const selectedAlignmentKpiIds = ref<string[]>([]);

function openAlignmentDialog() {
    alignmentDialog.description = '';
    alignmentDialog.procDefId = null;
    alignmentDialog.result = null;
    selectedAlignmentKpiIds.value = [];
    alignmentDialog.open = true;
}

async function runAlignmentCheck() {
    if (!alignmentDialog.description.trim()) return;
    alignmentDialog.checking = true;
    alignmentDialog.result = null;
    selectedAlignmentKpiIds.value = [];
    try {
        alignmentDialog.result = await store.lookupAlignment({
            description: alignmentDialog.description.trim(),
            proc_def_id: alignmentDialog.procDefId || null
        });
    } catch (e: any) {
        alignmentDialog.result = {
            status: 'unavailable',
            candidates: [],
            existing_connections: [],
            reason: e?.response?.data?.detail || e?.message || '전략 정합성 확인에 실패했습니다.'
        };
    } finally {
        alignmentDialog.checking = false;
    }
}

function isKpiCandidate(candidate: any) {
    return candidate?.type === 'kpi';
}

async function linkSelectedAlignmentKpis() {
    if (!alignmentDialog.procDefId || !selectedAlignmentKpiIds.value.length) return;
    alignmentDialog.linking = true;
    try {
        const linked = await store.linkKpisToProcess(selectedAlignmentKpiIds.value, alignmentDialog.procDefId);
        showSnack(`선택한 KPI ${linked}개를 프로세스에 연결했습니다.`);
        alignmentDialog.open = false;
    } catch (e: any) {
        showSnack(e?.message || 'KPI 연결에 실패했습니다.', 'error');
    } finally {
        alignmentDialog.linking = false;
    }
}

// 선택된 전략목표와 직접 연결된(상위/하위) 목표 id 집합 — 나머지는 반투명 처리, 연결된 것끼리는 하이라이팅
const connectedIds = computed(() => {
    const id = selectedObjectiveId.value;
    if (!id) return null;
    const objective = store.objectives.find((o: any) => o.id === id);
    if (!objective) return null;
    const set = new Set<string>([id, ...(objective.parents || [])]);
    for (const o of store.objectives) {
        if ((o.parents || []).includes(id)) set.add(o.id);
    }
    return set;
});

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
                y2: p.bottom - base.top,
                childId: objective.id,
                parentId
            });
        }
    }
    edges.value = result;
}

function edgePath(edge: any) {
    const midY = (edge.y1 + edge.y2) / 2;
    return `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`;
}

function isEdgeHighlighted(edge: any) {
    return !!selectedObjectiveId.value && (edge.childId === selectedObjectiveId.value || edge.parentId === selectedObjectiveId.value);
}

watch(() => store.objectives, () => nextTick(computeEdges), { deep: true });
const handleResize = () => computeEdges();

// ------------------------------------------------------------------ 전략목표 다이얼로그
// importance: 전략적 중요도(1~5, 기본 3). 기여도 가중 합산의 가중치로 쓰인다.
const IMPORTANCE_LEVELS = [1, 2, 3, 4, 5];
const objectiveDialog = reactive({
    open: false,
    editingId: null as string | null,
    form: { name: '', description: '', perspective: 'financial', parents: [] as string[], importance: 3 }
});

function openObjectiveDialog(objective?: any) {
    objectiveDialog.editingId = objective?.id || null;
    objectiveDialog.form = {
        name: objective?.name || '',
        description: objective?.description || '',
        perspective: objective?.perspective || 'financial',
        parents: [...(objective?.parents || [])],
        importance: objective?.importance ?? 3
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

// ------------------------------------------------------------------ 멀티 셀렉트 (Shift+클릭) / 우클릭 삭제
function onCardClick(objective: any, event: MouseEvent) {
    if (event.shiftKey) {
        if (multiSelectedIds.value.has(objective.id)) multiSelectedIds.value.delete(objective.id);
        else multiSelectedIds.value.add(objective.id);
        return;
    }
    multiSelectedIds.value.clear();
    selectedObjectiveId.value = objective.id === selectedObjectiveId.value ? null : objective.id;
}

function onCardContextMenu(objective: any, event: MouseEvent) {
    if (!multiSelectedIds.value.has(objective.id)) {
        multiSelectedIds.value.clear();
        multiSelectedIds.value.add(objective.id);
    }
    contextMenu.x = event.clientX;
    contextMenu.y = event.clientY;
    contextMenu.show = true;
}

function clearSelections() {
    multiSelectedIds.value.clear();
    selectedObjectiveId.value = null;
}

async function removeMultiSelected() {
    contextMenu.show = false;
    const ids = [...multiSelectedIds.value];
    if (!ids.length) return;
    const names = ids.map((id) => store.objectives.find((o: any) => o.id === id)?.name).filter(Boolean);
    const message =
        ids.length === 1
            ? `'${names[0]}' 전략목표와 하위 KPI/이니셔티브를 모두 삭제할까요?`
            : `선택한 전략목표 ${ids.length}개(${names.join(', ')})와 하위 KPI/이니셔티브를 모두 삭제할까요?`;
    if (!confirm(message)) return;
    if (selectedObjectiveId.value && ids.includes(selectedObjectiveId.value)) selectedObjectiveId.value = null;
    multiSelectedIds.value.clear();
    await store.deleteObjectives(ids);
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
        source_field: '',
        importance: 3
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
        source_field: kpi?.source_field || '',
        importance: kpi?.importance ?? 3
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

// KPI 상세 (측정 이력 / 설문 현황 / 기여도)
const kpiDetails = reactive<Record<string, any>>({});

async function toggleKpiDetail(kpi: any) {
    if (kpiDetails[kpi.id]) {
        delete kpiDetails[kpi.id];
        return;
    }
    const detail: any = { measurements: [], surveys: null, contribution: null };
    detail.measurements = await store.getMeasurements(kpi.id);
    if (kpi.measure_type === 'survey_score') {
        const surveys = await store.getSurveys(kpi.id);
        detail.surveys = {
            sent: surveys.length,
            answered: surveys.filter((s: any) => s.status === 'ANSWERED').length
        };
    }
    kpiDetails[kpi.id] = detail;
    // KPI 단위 기여도 — 측정에 실제 반영된 인스턴스 기준 성과자 비중.
    // 실패해도 측정 이력 표시는 막지 않는다(기여도 API 는 별도 배포일 수 있음).
    try {
        detail.contribution = await store.getContributionKpi(kpi.id);
    } catch {
        detail.contribution = null;
    }
    kpiDetails[kpi.id] = { ...detail };
}

// ------------------------------------------------------------------ 기여도 탭 (성과·성장 기여)
// 선택한 목표(+하위 전략) 범위의 성과자 가중 순위와 스킬 성장 기여자.
const contribution = reactive({
    loading: false,
    forObjectiveId: null as string | null,
    performers: [] as any[],
    skills: [] as any[],
    error: null as string | null,
    expandedPerformerId: null as string | null
});

async function loadContribution(objectiveId: string) {
    contribution.loading = true;
    contribution.error = null;
    contribution.performers = [];
    contribution.skills = [];
    contribution.expandedPerformerId = null;
    try {
        const data = await store.getObjectiveContribution(objectiveId);
        const item = (data?.data || []).find((d: any) => d.objective?.id === objectiveId) || data?.data?.[0];
        contribution.performers = item?.performers || [];
        contribution.skills = item?.skill_contributions || [];
        contribution.forObjectiveId = objectiveId;
        if (data?.success === false) contribution.error = data?.error || null;
    } catch (e: any) {
        contribution.error = e?.response?.data?.detail || e?.message || null;
    } finally {
        contribution.loading = false;
    }
}

// 기여도 탭이 열려 있거나 선택 목표가 바뀌면 그 목표 기준으로 다시 로드한다.
watch(
    () => [detailTab.value, selectedObjectiveId.value],
    ([tab, objectiveId]) => {
        if (tab === 'contribution' && objectiveId && contribution.forObjectiveId !== objectiveId) {
            loadContribution(objectiveId as string);
        }
    }
);

const topWeightedScore = computed(() => Math.max(...contribution.performers.map((p: any) => p.weighted_score || 0), 0));

// 성과자 요약 다이얼로그 — 역방향(성과자 → 전략별 가중 기여 내역) 조회
const performerDialog = reactive({ open: false, loading: false, data: null as any });

async function openPerformerDialog(performerId: string) {
    performerDialog.open = true;
    performerDialog.loading = true;
    performerDialog.data = null;
    try {
        performerDialog.data = await store.getContributionPerformer(performerId);
    } catch (e: any) {
        showSnack(e?.response?.data?.detail || e?.message || '성과자 기여도 조회에 실패했습니다.', 'error');
        performerDialog.open = false;
    } finally {
        performerDialog.loading = false;
    }
}

function performerTypeColor(type: string) {
    return type === 'AGENT' ? 'secondary' : 'primary';
}

function sharePercent(share: number | null | undefined) {
    return share != null ? (share * 100).toFixed(1) + '%' : '-';
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

// ------------------------------------------------------------------ 전략맵 초기화(완전히 새로 작성)
const RESET_CONFIRM_PHRASE = '초기화';
const resetDialog = reactive({ open: false, confirmText: '', loading: false });

function openResetDialog() {
    resetDialog.confirmText = '';
    resetDialog.open = true;
}

async function confirmResetMap() {
    if (resetDialog.confirmText !== RESET_CONFIRM_PHRASE) return;
    resetDialog.loading = true;
    try {
        await store.resetMap();
        selectedObjectiveId.value = null;
        multiSelectedIds.value.clear();
        resetDialog.open = false;
        showSnack('전략맵이 초기화되었습니다');
        await openAiEditPage();
    } catch (e: any) {
        showSnack(e?.message || 'reset failed', 'error');
    } finally {
        resetDialog.loading = false;
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
                <v-btn
                    variant="outlined"
                    color="primary"
                    size="small"
                    data-testid="open-alignment-check"
                    @click="openAlignmentDialog"
                >
                    <v-icon start size="16">mdi-vector-link</v-icon>
                    전략 정합성 검사
                </v-btn>
                <!-- 온톨로지 뷰(애널리틱스)로 이동 — 전략/프로세스/리소스/지식 전체 그래프 -->
                <v-btn variant="outlined" size="small" @click="router.push('/analytics/ontology')">
                    <v-icon start size="16">mdi-graph-outline</v-icon>
                    온톨로지 뷰
                </v-btn>
                <!-- 처음 전략맵을 세울 때만: skill(bsc-strategy-interview) 이 연결된 deepagent 대화 페이지로 이동 -->
                <v-btn
                    v-if="!store.objectives.length"
                    variant="outlined"
                    size="small"
                    :loading="strategyAgentLoading"
                    @click="openAiEditPage"
                >
                    <v-icon start size="16">mdi-robot</v-icon>
                    {{ $t('strategyBoard.chatButton') }}
                </v-btn>
                <!-- 전략맵 전체 초기화(완전히 새로 작성) — 파괴적 작업, 타이핑 확인 필요 -->
                <v-btn v-if="store.objectives.length" variant="outlined" color="error" size="small" @click="openResetDialog">
                    <v-icon start size="16">mdi-delete-sweep-outline</v-icon>
                    전략맵 초기화
                </v-btn>
                <v-btn color="primary" size="small" @click="openObjectiveDialog()">
                    <v-icon start size="16">mdi-plus</v-icon>
                    {{ $t('strategyBoard.addObjective') }}
                </v-btn>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="d-flex justify-center py-12">
            <v-progress-circular indeterminate color="primary" />
        </div>

        <template v-else>
            <!-- 전략맵 -->
            <div ref="mapContainer" class="strategy-map position-relative" @click="clearSelections">
                <svg class="edge-layer">
                    <defs>
                        <marker id="strategy-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                            <path d="M0,0 L6,3 L0,6 Z" fill="#9e9e9e" />
                        </marker>
                        <marker id="strategy-arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                            <path d="M0,0 L6,3 L0,6 Z" fill="#1565c0" />
                        </marker>
                    </defs>
                    <path
                        v-for="(edge, i) in edges"
                        :key="i"
                        :d="edgePath(edge)"
                        :stroke="isEdgeHighlighted(edge) ? '#1565c0' : '#9e9e9e'"
                        :stroke-width="isEdgeHighlighted(edge) ? 2.5 : 1.5"
                        :opacity="!selectedObjectiveId || isEdgeHighlighted(edge) ? 1 : 0.25"
                        fill="none"
                        :marker-end="isEdgeHighlighted(edge) ? 'url(#strategy-arrow-active)' : 'url(#strategy-arrow)'"
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
                            :class="{
                                selected: objective.id === selectedObjectiveId,
                                'multi-selected': multiSelectedIds.has(objective.id),
                                connected: connectedIds && objective.id !== selectedObjectiveId && connectedIds.has(objective.id),
                                dimmed: connectedIds && !connectedIds.has(objective.id)
                            }"
                            @click.stop="onCardClick(objective, $event)"
                            @contextmenu.stop.prevent="onCardContextMenu(objective, $event)"
                        >
                            <v-icon v-if="multiSelectedIds.has(objective.id)" size="16" color="secondary" class="multi-select-check">
                                mdi-check-circle
                            </v-icon>
                            <div class="d-flex align-center ga-1 mb-1">
                                <span class="text-subtitle-2 font-weight-bold" style="flex: 1">{{ objective.name }}</span>
                                <v-chip
                                    v-if="objective.importance != null"
                                    size="x-small"
                                    variant="tonal"
                                    color="warning"
                                    prepend-icon="mdi-star"
                                    :title="$t('strategyBoard.importance')"
                                >
                                    {{ objective.importance }}
                                </v-chip>
                            </div>
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

            <!-- 우클릭 컨텍스트 메뉴 (선택 삭제) -->
            <v-menu v-model="contextMenu.show" :target="[contextMenu.x, contextMenu.y]" :close-on-content-click="false">
                <v-list density="compact">
                    <v-list-item @click.stop="removeMultiSelected">
                        <template #prepend><v-icon size="18" color="error">mdi-delete-outline</v-icon></template>
                        <v-list-item-title>
                            {{ multiSelectedIds.size > 1 ? `선택한 ${multiSelectedIds.size}개 삭제` : '삭제' }}
                        </v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>
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
                    <v-tab value="contribution" data-testid="contribution-tab">{{ $t('strategyBoard.contribution') }}</v-tab>
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

                                <!-- KPI 단위 기여도: 측정값에 실제 반영된 인스턴스 기준 성과자 비중 -->
                                <template v-if="kpiDetails[kpi.id].contribution">
                                    <div class="text-caption font-weight-bold mt-2">
                                        <v-icon size="14">mdi-account-group-outline</v-icon>
                                        {{ $t('strategyBoard.kpiContribution') }}
                                    </div>
                                    <template v-if="kpiDetails[kpi.id].contribution.traceable">
                                        <div
                                            v-for="p in kpiDetails[kpi.id].contribution.performers"
                                            :key="p.id"
                                            class="d-flex align-center ga-2 text-caption"
                                        >
                                            <a class="performer-name" @click.stop="openPerformerDialog(p.id)">{{ p.name }}</a>
                                            <v-chip size="x-small" variant="flat" :color="performerTypeColor(p.performer_type)">
                                                {{
                                                    p.performer_type === 'AGENT'
                                                        ? $t('strategyBoard.performerAgent')
                                                        : $t('strategyBoard.performerHuman')
                                                }}
                                            </v-chip>
                                            <span class="ml-auto font-weight-bold">{{ sharePercent(p.share) }}</span>
                                        </div>
                                        <div
                                            v-if="!kpiDetails[kpi.id].contribution.performers.length"
                                            class="text-caption text-disabled"
                                        >
                                            {{ $t('strategyBoard.noContribution') }}
                                        </div>
                                    </template>
                                    <div v-else class="text-caption text-disabled">
                                        {{ $t('strategyBoard.untraceableKpi') }}
                                    </div>
                                </template>
                            </div>
                        </v-card>
                        <div v-if="!selectedObjective.kpis.length" class="text-caption text-disabled text-center py-4">
                            {{ $t('strategyBoard.noKpis') }}
                        </div>
                    </template>

                    <!-- 이니셔티브 탭 -->
                    <template v-else-if="detailTab === 'initiatives'">
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

                    <!-- 기여도 탭: 이 목표(+하위 전략) 범위의 성과자 가중 순위 + 스킬 성장 기여 -->
                    <template v-else>
                        <div v-if="contribution.loading" class="d-flex justify-center py-6">
                            <v-progress-circular indeterminate size="24" color="primary" />
                        </div>
                        <template v-else>
                            <div class="text-caption text-medium-emphasis mb-2">
                                {{ $t('strategyBoard.contributionHint') }}
                            </div>
                            <v-card
                                v-for="(performer, rank) in contribution.performers"
                                :key="performer.id"
                                variant="outlined"
                                rounded="lg"
                                class="pa-3 mb-2 performer-row"
                                data-testid="performer-row"
                                @click="
                                    contribution.expandedPerformerId =
                                        contribution.expandedPerformerId === performer.id ? null : performer.id
                                "
                            >
                                <div class="d-flex align-center ga-2">
                                    <span class="text-caption text-medium-emphasis" style="width: 16px">{{ rank + 1 }}</span>
                                    <a
                                        class="text-subtitle-2 font-weight-bold performer-name"
                                        @click.stop="openPerformerDialog(performer.id)"
                                    >
                                        {{ performer.name }}
                                    </a>
                                    <v-chip size="x-small" variant="flat" :color="performerTypeColor(performer.performer_type)">
                                        {{
                                            performer.performer_type === 'AGENT'
                                                ? $t('strategyBoard.performerAgent')
                                                : $t('strategyBoard.performerHuman')
                                        }}
                                    </v-chip>
                                    <span class="text-subtitle-2 font-weight-bold ml-auto">{{ performer.weighted_score }}</span>
                                </div>
                                <v-progress-linear
                                    :model-value="topWeightedScore ? (performer.weighted_score / topWeightedScore) * 100 : 0"
                                    color="primary"
                                    height="5"
                                    rounded
                                    class="mt-2"
                                />
                                <!-- 행 확장: KPI별 산출 내역 (비중 × 전략 중요도 = 가중) -->
                                <div
                                    v-if="contribution.expandedPerformerId === performer.id"
                                    class="mt-2 pt-2 text-caption"
                                    style="border-top: 1px dashed rgba(0, 0, 0, 0.12)"
                                >
                                    <div v-for="b in performer.kpi_breakdown" :key="b.kpi_id" class="d-flex justify-space-between">
                                        <span>{{ b.kpi_name }}</span>
                                        <span class="text-medium-emphasis">
                                            {{ sharePercent(b.share) }} × <b>{{ b.importance }}</b> = {{ b.weighted }}
                                        </span>
                                    </div>
                                </div>
                            </v-card>
                            <div
                                v-if="!contribution.performers.length"
                                class="text-caption text-disabled text-center py-4"
                                data-testid="no-contribution"
                            >
                                {{ contribution.error || $t('strategyBoard.noContribution') }}
                            </div>

                            <!-- 스킬 성장 기여: 이 전략에 연결된 스킬을 키운 사람 -->
                            <template v-if="contribution.skills.length">
                                <div class="text-subtitle-2 font-weight-bold mt-4 mb-1">
                                    {{ $t('strategyBoard.skillGrowth') }}
                                </div>
                                <div class="text-caption text-medium-emphasis mb-2">{{ $t('strategyBoard.skillGrowthHint') }}</div>
                                <v-card
                                    v-for="sc in contribution.skills"
                                    :key="sc.skill.name"
                                    variant="outlined"
                                    rounded="lg"
                                    class="pa-3 mb-2"
                                >
                                    <div class="text-subtitle-2 font-weight-bold mb-1">
                                        <v-icon size="14" class="mr-1">mdi-toolbox-outline</v-icon>{{ sc.skill.name }}
                                    </div>
                                    <div
                                        v-for="c in sc.contributors"
                                        :key="c.contributor_user_id"
                                        class="d-flex align-center ga-2 text-caption"
                                    >
                                        <span>{{ c.contributor_name || c.contributor_user_id }}</span>
                                        <span class="text-medium-emphasis">{{ c.count }}{{ $t('strategyBoard.contributionCount') }}</span>
                                        <span class="ml-auto font-weight-bold">{{ sharePercent(c.share) }}</span>
                                    </div>
                                    <div v-if="!sc.contributors.length" class="text-caption text-disabled">
                                        {{ $t('strategyBoard.noSkillContributors') }}
                                    </div>
                                </v-card>
                            </template>
                        </template>
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
                <v-select
                    v-model="objectiveDialog.form.importance"
                    :items="IMPORTANCE_LEVELS"
                    :label="$t('strategyBoard.importance')"
                    :hint="$t('strategyBoard.importanceHint')"
                    persistent-hint
                    density="compact"
                    variant="outlined"
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
                    <v-col cols="3">
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
                    <v-col cols="3">
                        <v-select
                            v-model="kpiDialog.form.importance"
                            :items="IMPORTANCE_LEVELS"
                            :label="$t('strategyBoard.importance')"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="3">
                        <v-text-field
                            v-model="kpiDialog.form.period_start"
                            :label="$t('strategyBoard.periodStart')"
                            type="date"
                            density="compact"
                            variant="outlined"
                        />
                    </v-col>
                    <v-col cols="3">
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

        <!-- 성과자 기여 요약 다이얼로그 — 역방향(성과자 → 전략별 가중 기여 내역) -->
        <v-dialog v-model="performerDialog.open" max-width="520">
            <v-card class="pa-4" data-testid="performer-dialog">
                <div v-if="performerDialog.loading" class="d-flex justify-center py-6">
                    <v-progress-circular indeterminate size="24" color="primary" />
                </div>
                <template v-else-if="performerDialog.data">
                    <div class="d-flex align-center ga-2 mb-1">
                        <h3 class="text-h6">{{ performerDialog.data.performer.name }}</h3>
                        <v-chip
                            size="x-small"
                            variant="flat"
                            :color="performerTypeColor(performerDialog.data.performer.performer_type)"
                        >
                            {{
                                performerDialog.data.performer.performer_type === 'AGENT'
                                    ? $t('strategyBoard.performerAgent')
                                    : $t('strategyBoard.performerHuman')
                            }}
                        </v-chip>
                    </div>
                    <div class="text-caption text-medium-emphasis mb-3">
                        {{ $t('strategyBoard.totalWeightedScore') }}
                        <b>{{ performerDialog.data.total_weighted_score }}</b>
                        · {{ $t('strategyBoard.contributedKpis', { count: performerDialog.data.kpi_count }) }}
                    </div>
                    <v-table density="compact">
                        <thead>
                            <tr>
                                <th>{{ $t('strategyBoard.objective') }}</th>
                                <th>KPI</th>
                                <th class="text-right">{{ $t('strategyBoard.share') }}</th>
                                <th class="text-right">{{ $t('strategyBoard.importance') }}</th>
                                <th class="text-right">{{ $t('strategyBoard.weighted') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="b in performerDialog.data.strategy_breakdown" :key="b.kpi_id">
                                <td>{{ b.strategy?.name || '-' }}</td>
                                <td>{{ b.kpi_name }}</td>
                                <td class="text-right">{{ sharePercent(b.share) }}</td>
                                <td class="text-right">{{ b.importance }}</td>
                                <td class="text-right font-weight-bold">{{ b.weighted }}</td>
                            </tr>
                        </tbody>
                    </v-table>
                    <div
                        v-if="!performerDialog.data.strategy_breakdown.length"
                        class="text-caption text-disabled text-center py-3"
                    >
                        {{ $t('strategyBoard.noContribution') }}
                    </div>
                    <div class="d-flex justify-end mt-3">
                        <v-btn variant="text" @click="performerDialog.open = false">{{ $t('strategyBoard.close') }}</v-btn>
                    </div>
                </template>
            </v-card>
        </v-dialog>

        <!-- 전략맵 초기화 확인 다이얼로그 — 파괴적 작업이라 타이핑 확인을 요구한다 -->
        <v-dialog v-model="resetDialog.open" max-width="480" persistent>
            <v-card class="pa-4">
                <h3 class="text-h6 mb-3">전략맵 초기화</h3>
                <v-alert type="error" variant="tonal" density="compact" class="mb-3">
                    현재 전략맵의 모든 전략목표·KPI·이니셔티브와 측정이력·설문 응답이 <strong>영구적으로 삭제</strong>됩니다.
                    되돌릴 수 없습니다.
                </v-alert>
                <p class="text-body-2 mb-2">
                    계속하려면 아래 입력란에 <strong>{{ RESET_CONFIRM_PHRASE }}</strong>를 입력하세요.
                </p>
                <v-text-field
                    v-model="resetDialog.confirmText"
                    density="compact"
                    variant="outlined"
                    :placeholder="RESET_CONFIRM_PHRASE"
                    autofocus
                    @keydown.enter="confirmResetMap"
                />
                <div class="d-flex justify-end ga-2 mt-2">
                    <v-btn variant="text" :disabled="resetDialog.loading" @click="resetDialog.open = false">
                        {{ $t('strategyBoard.cancel') }}
                    </v-btn>
                    <v-btn
                        color="error"
                        :disabled="resetDialog.confirmText !== RESET_CONFIRM_PHRASE"
                        :loading="resetDialog.loading"
                        @click="confirmResetMap"
                    >
                        전략맵 초기화
                    </v-btn>
                </div>
            </v-card>
        </v-dialog>

        <!-- 프로세스/개선 설명을 현재 전략맵과 비교하는 승인 전 정합성 게이트 -->
        <v-dialog v-model="alignmentDialog.open" max-width="880" scrollable>
            <v-card class="alignment-dialog" data-testid="alignment-dialog">
                <div class="d-flex align-start justify-space-between pa-5 pb-3">
                    <div>
                        <div class="d-flex align-center ga-2 mb-1">
                            <v-avatar color="primary" variant="tonal" size="36">
                                <v-icon size="20">mdi-vector-link</v-icon>
                            </v-avatar>
                            <h3 class="text-h6 font-weight-bold">전략 정합성 검사</h3>
                        </div>
                        <p class="text-body-2 text-medium-emphasis mb-0">
                            프로세스 초안이나 개선 내용을 현재 전략목표·KPI와 비교합니다. 후보는 자동 연결되지 않습니다.
                        </p>
                    </div>
                    <v-btn icon variant="text" size="small" @click="alignmentDialog.open = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>
                <v-divider />

                <v-card-text class="pa-5">
                    <v-row>
                        <v-col cols="12" md="7">
                            <v-textarea
                                v-model="alignmentDialog.description"
                                label="검사할 프로세스 또는 개선 내용"
                                placeholder="예: 교육 웨비나 고객 문의를 자동 분류하고 후속 상담 담당자에게 배정해 응답 리드타임을 줄이는 프로세스"
                                variant="outlined"
                                rows="5"
                                counter="1000"
                                data-testid="alignment-description"
                            />
                        </v-col>
                        <v-col cols="12" md="5">
                            <v-select
                                v-model="alignmentDialog.procDefId"
                                :items="store.processDefinitions"
                                item-title="name"
                                item-value="id"
                                label="기존 프로세스 (선택)"
                                clearable
                                variant="outlined"
                                density="comfortable"
                                hint="선택하면 기존 전략 연결도 함께 확인합니다."
                                persistent-hint
                                data-testid="alignment-process-select"
                            />
                            <v-alert type="info" variant="tonal" density="compact" class="mt-4">
                                기존 프로세스를 선택한 경우에만 검토 후 선택 KPI를 연결할 수 있습니다.
                            </v-alert>
                        </v-col>
                    </v-row>

                    <div class="d-flex justify-end mb-4">
                        <v-btn
                            color="primary"
                            :loading="alignmentDialog.checking"
                            :disabled="!alignmentDialog.description.trim()"
                            data-testid="run-alignment-check"
                            @click="runAlignmentCheck"
                        >
                            <v-icon start>mdi-magnify-scan</v-icon>
                            정합성 검사 실행
                        </v-btn>
                    </div>

                    <template v-if="alignmentDialog.result">
                        <v-divider class="mb-4" />
                        <div class="d-flex align-center justify-space-between mb-3 flex-wrap ga-2">
                            <div class="d-flex align-center ga-2">
                                <span class="text-subtitle-1 font-weight-bold">검사 결과</span>
                                <v-chip
                                    size="small"
                                    variant="tonal"
                                    :color="alignmentDialog.result.status === 'matched' ? 'success' : alignmentDialog.result.status === 'unavailable' ? 'error' : 'warning'"
                                    data-testid="alignment-status"
                                >
                                    {{ alignmentDialog.result.status === 'matched' ? '관련 후보 있음' : alignmentDialog.result.status === 'unavailable' ? '확인 불가' : '관련 항목 없음' }}
                                </v-chip>
                            </div>
                            <v-chip v-if="alignmentDialog.result.generated_by" size="x-small" variant="outlined">
                                {{ alignmentDialog.result.generated_by === 'llm' ? 'AI 의미 분석' : '키워드 분석' }}
                            </v-chip>
                        </div>

                        <v-alert
                            v-if="alignmentDialog.result.status === 'no_related_items'"
                            type="warning"
                            variant="tonal"
                            class="mb-3"
                            data-testid="alignment-empty"
                        >
                            현재 전략맵에서 관련 전략목표나 KPI를 찾지 못했습니다. 확인 후 전략 연결 없이 진행할 수 있습니다.
                        </v-alert>
                        <v-alert v-else-if="alignmentDialog.result.status === 'unavailable'" type="error" variant="tonal" class="mb-3">
                            {{ alignmentDialog.result.reason || '전략 정합성을 확인할 수 없습니다.' }}
                        </v-alert>

                        <div v-if="alignmentDialog.result.candidates?.length" class="alignment-candidates">
                            <v-card
                                v-for="(candidate, index) in alignmentDialog.result.candidates"
                                :key="candidate.id"
                                variant="outlined"
                                rounded="lg"
                                class="alignment-candidate pa-3 mb-2"
                                :data-testid="`alignment-candidate-${index}`"
                            >
                                <div class="d-flex align-start ga-3">
                                    <v-checkbox
                                        v-if="isKpiCandidate(candidate) && alignmentDialog.procDefId"
                                        v-model="selectedAlignmentKpiIds"
                                        :value="candidate.id"
                                        density="compact"
                                        hide-details
                                        color="primary"
                                    />
                                    <v-avatar :color="isKpiCandidate(candidate) ? 'primary' : 'secondary'" variant="tonal" size="36">
                                        <v-icon size="19">{{ isKpiCandidate(candidate) ? 'mdi-target' : 'mdi-flag-variant-outline' }}</v-icon>
                                    </v-avatar>
                                    <div class="flex-grow-1 min-width-0">
                                        <div class="d-flex align-center justify-space-between ga-2">
                                            <span class="text-subtitle-2 font-weight-bold">{{ candidate.name }}</span>
                                            <v-chip size="x-small" variant="tonal" :color="isKpiCandidate(candidate) ? 'primary' : 'secondary'">
                                                {{ isKpiCandidate(candidate) ? 'KPI' : '전략목표' }} · {{ Math.round((candidate.score || 0) * 100) }}%
                                            </v-chip>
                                        </div>
                                        <p class="text-caption text-medium-emphasis mb-0 mt-1">{{ candidate.reason }}</p>
                                    </div>
                                </div>
                            </v-card>
                        </div>

                        <div v-if="alignmentDialog.result.existing_connections?.length" class="mt-4">
                            <div class="text-subtitle-2 font-weight-bold mb-2">기존 전략 연결</div>
                            <v-chip
                                v-for="connection in alignmentDialog.result.existing_connections"
                                :key="connection.kpi?.id"
                                size="small"
                                variant="tonal"
                                color="info"
                                class="mr-2 mb-2"
                                prepend-icon="mdi-link-variant"
                            >
                                {{ connection.strategy?.name || '전략목표' }} · {{ connection.kpi?.name || connection.kpi?.id }}
                            </v-chip>
                        </div>
                    </template>
                </v-card-text>

                <v-divider />
                <v-card-actions class="px-5 py-3">
                    <span v-if="selectedAlignmentKpiIds.length" class="text-caption text-medium-emphasis">
                        KPI {{ selectedAlignmentKpiIds.length }}개 선택됨
                    </span>
                    <v-spacer />
                    <v-btn variant="text" @click="alignmentDialog.open = false">닫기</v-btn>
                    <v-btn
                        v-if="alignmentDialog.procDefId && alignmentDialog.result?.status === 'matched'"
                        color="primary"
                        :disabled="!selectedAlignmentKpiIds.length"
                        :loading="alignmentDialog.linking"
                        data-testid="link-alignment-kpis"
                        @click="linkSelectedAlignmentKpis"
                    >
                        선택 KPI 연결
                    </v-btn>
                </v-card-actions>
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
    position: relative;
    width: 220px;
    cursor: pointer;
    user-select: none;
    transition: box-shadow 0.15s, border-color 0.15s, opacity 0.15s;
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
.objective-card.multi-selected {
    border-color: rgb(var(--v-theme-secondary));
    background: rgba(var(--v-theme-secondary), 0.08);
}
.objective-card.connected {
    border-color: rgba(var(--v-theme-primary), 0.6);
    box-shadow: 0 0 0 1px rgba(var(--v-theme-primary), 0.25);
}
.objective-card.dimmed {
    opacity: 0.35;
}
.multi-select-check {
    position: absolute;
    top: 6px;
    right: 6px;
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
.performer-row {
    cursor: pointer;
}
.performer-name {
    color: rgb(var(--v-theme-primary));
    cursor: pointer;
    text-decoration: none;
}
.performer-name:hover {
    text-decoration: underline;
}
.detail-body {
    flex: 1;
    overflow-y: auto;
}
.alignment-dialog {
    border-radius: 16px;
}
.alignment-candidates {
    max-height: 350px;
    overflow-y: auto;
    padding-right: 4px;
}
.alignment-candidate {
    transition: border-color 0.15s, box-shadow 0.15s;
}
.alignment-candidate:hover {
    border-color: rgba(var(--v-theme-primary), 0.55);
    box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.1);
}
.min-width-0 {
    min-width: 0;
}
</style>
