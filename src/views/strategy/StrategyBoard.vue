<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStrategyStore } from '@/stores/strategy/strategyStore';
import BackendFactory from '@/components/api/BackendFactory';
import StrategyOntologyExplorer from '@/components/strategy/ontology/StrategyOntologyExplorer.vue';
import OntologySchemaView from '@/components/strategy/ontology/OntologySchemaView.vue';
import StrategyImprovePanel from '@/components/strategy/StrategyImprovePanel.vue';
import { LEVEL_TEXT, achievementLevel, levelColor } from '@/components/strategy/ontology/achievementLevel.js';
import { useDashboardThresholds } from '@/services/dashboardThresholdsService';
import '@/components/strategy/ontology/strategyTheme.css';

const store = useStrategyStore();
const router = useRouter();
const route = useRoute();
const backend = BackendFactory.createBackend();

// 전략맵 | 온톨로지 익스플로러 | 온톨로지 스키마 탭과 좌우 분할 상세 패널은 모든 모드 공통 (specs/013).
// isPal 은 PAL 디자인 시스템(sk-page-card·page-header — PAL 에서만 로드)을 쓰는 헤더/박스에만 쓴다.
const isPal = !!(window as any).$pal;
const BOARD_VIEWS = ['map', 'explorer', 'schema'];
const boardView = ref<string>(BOARD_VIEWS.includes(String(route.query.view)) ? String(route.query.view) : 'map');
const explorerFocusId = ref<string | null>(null);

watch(boardView, async (view) => {
    if (route.query.view !== view) router.replace({ query: { ...route.query, view: view === 'map' ? undefined : view } });
    if (view === 'map') scheduleEdges();
});

// 전략맵 목표 → 익스플로러(그 목표에 포커스)
function openInExplorer(objectiveId: string) {
    explorerFocusId.value = objectiveId;
    selectedObjectiveId.value = null;
    boardView.value = 'explorer';
}
// 익스플로러 → 전략맵(해당 목표 선택). 빈 id 면 탭만 전환.
function openObjectiveFromExplorer(objectiveId: string) {
    boardView.value = 'map';
    if (objectiveId && store.objectives.some((o: any) => o.id === objectiveId)) selectedObjectiveId.value = objectiveId;
}

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
// CSS 사용자 정의 속성(--lane)은 Vue 의 StyleValue 타입에 없어 any 로 넘긴다
const laneStyle = (perspective: string): any => ({ '--lane': PERSPECTIVE_COLORS[perspective] });
const PERSPECTIVE_COLORS: Record<string, string> = {
    financial: '#1d4ed8',
    customer: '#0f766e',
    internal_process: '#c2410c',
    learning_growth: '#6d28d9'
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

// PAL 은 상세 패널이 전략맵 옆에 붙어 맵 폭이 바뀌므로 연결선을 다시 계산한다
watch(
    () => selectedObjectiveId.value,
    () => scheduleEdges()
);
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
    // 카드마다 한 번만 측정한다(엣지마다 다시 재면 레이아웃 읽기가 엣지 수만큼 늘어난다)
    const rects = new Map<string, DOMRect>();
    const rectOf = (id: string) => {
        if (!rects.has(id) && cardEls[id]) rects.set(id, cardEls[id].getBoundingClientRect());
        return rects.get(id);
    };
    const result: any[] = [];
    for (const objective of store.objectives) {
        if (!cardEls[objective.id]) continue;
        for (const parentId of objective.parents || []) {
            if (!cardEls[parentId]) continue;
            const c = rectOf(objective.id)!;
            const p = rectOf(parentId)!;
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

// 연결선 재계산은 프레임당 한 번으로 모은다(리사이즈·선택·데이터 변경이 한꺼번에 와도)
let edgeFrame = 0;
function scheduleEdges() {
    if (edgeFrame) return;
    edgeFrame = requestAnimationFrame(() => {
        edgeFrame = 0;
        computeEdges();
    });
}
// 상세 패널 열고 닫기·사이드바 접기처럼 창 크기는 그대로인데 맵 폭이 바뀌는 경우도 잡는다
let mapObserver: ResizeObserver | null = null;
watch(mapContainer, (el, prev) => {
    if (prev) mapObserver?.unobserve(prev);
    if (!el) return;
    mapObserver ??= new ResizeObserver(() => scheduleEdges());
    mapObserver.observe(el);
});

function edgePath(edge: any) {
    const midY = (edge.y1 + edge.y2) / 2;
    return `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`;
}

function isEdgeHighlighted(edge: any) {
    return !!selectedObjectiveId.value && (edge.childId === selectedObjectiveId.value || edge.parentId === selectedObjectiveId.value);
}

watch(
    () => store.objectives,
    () => nextTick(scheduleEdges),
    { deep: true }
);

// ------------------------------------------------------------------ 전략목표 다이얼로그
// importance: 전략적 중요도(1~5, 기본 3). 기여도 가중 합산의 가중치로 쓰인다.
const IMPORTANCE_LEVELS = [1, 2, 3, 4, 5];
// 판단 우선순위(1 = 최우선, 비우면 미정) — 상충하는 전략·KPI 사이에서 실행 중 에이전트가 따를 쪽(spec 018).
// 미정·동률이면 에이전트가 그 업무에서 담당자에게 묻는다. importance(달성률 가중치)와 별개다.
const PRIORITY_OPTIONS = [
    { title: '미정 — 상충 시 담당자에게 묻기', value: null },
    { title: '1 (최우선)', value: 1 },
    { title: '2', value: 2 },
    { title: '3', value: 3 },
    { title: '4', value: 4 },
    { title: '5', value: 5 }
];
const objectiveDialog = reactive({
    open: false,
    editingId: null as string | null,
    form: {
        name: '',
        description: '',
        perspective: 'financial',
        parents: [] as string[],
        importance: 3,
        priority: null as number | null,
        conflicts_with: [] as string[]
    }
});

function openObjectiveDialog(objective?: any) {
    objectiveDialog.editingId = objective?.id || null;
    objectiveDialog.form = {
        name: objective?.name || '',
        description: objective?.description || '',
        perspective: objective?.perspective || 'financial',
        parents: [...(objective?.parents || [])],
        importance: objective?.importance ?? 3,
        priority: objective?.priority ?? null,
        conflicts_with: [...(objective?.conflicts_with || [])]
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
function onCardClick(objective: any, event: MouseEvent | KeyboardEvent) {
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

// 상충 후보 — 같은 종류만(KPI↔KPI, 전략↔전략). KPI 는 소속 전략 이름을 붙여 구분한다.
const kpiNameById = computed(() => {
    const m = new Map<string, string>();
    for (const o of store.objectives) for (const k of o.kpis || []) m.set(k.id, k.name);
    return m;
});
const conflictKpiOptions = computed(() =>
    store.objectives.flatMap((o: any) =>
        (o.kpis || []).filter((k: any) => k.id !== kpiDialog.editingId).map((k: any) => ({ title: k.name, subtitle: o.name, value: k.id }))
    )
);
const kpiById = computed(() => {
    const m = new Map<string, any>();
    for (const o of store.objectives) for (const k of o.kpis || []) m.set(k.id, k);
    return m;
});
const conflictObjectiveOptions = computed(() =>
    store.objectives.filter((o: any) => o.id !== objectiveDialog.editingId).map((o: any) => ({ title: o.name, value: o.id }))
);

const parentOptions = computed(() =>
    store.objectives.filter((o: any) => o.id !== objectiveDialog.editingId).map((o: any) => ({ title: o.name, value: o.id }))
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
        importance: 3,
        priority: null as number | null,
        conflicts_with: [] as string[],
        activity_ids: [] as string[]
    }
});
// 판단 적용 활동 선택지 — 연결 프로세스의 활동(사람·에이전트 단계)
const kpiActivityOptions = ref<{ title: string; value: string; subtitle?: string }[]>([]);
watch(
    () => [kpiDialog.open, kpiDialog.form.proc_def_id] as const,
    async ([open, procId]) => {
        if (!open || !procId) {
            kpiActivityOptions.value = [];
            return;
        }
        try {
            const acts = await store.loadProcessActivities(procId);
            kpiActivityOptions.value = acts.map((a: any) => ({
                title: a.name,
                value: a.id,
                subtitle: a.type === 'serviceTask' ? '에이전트 단계' : '사람 단계'
            }));
        } catch {
            kpiActivityOptions.value = [];
        }
    }
);

// 상충 KPI 고르면 프로세스를 맞춘다 — 이 KPI 가 프로세스 미연결이면 상대 KPI 의 프로세스를 따른다.
// 반대(상대가 미연결)는 저장할 때 상대 KPI 에 이 KPI 의 프로세스를 자동 등록한다(saveKpi).
function adoptConflictProcess() {
    if (kpiDialog.form.proc_def_id) return;
    const linked = kpiDialog.form.conflicts_with.map((id) => kpiById.value.get(id)).find((k: any) => k?.proc_def_id);
    if (!linked) return;
    kpiDialog.form.proc_def_id = linked.proc_def_id;
    showSnack(`상충 KPI '${linked.name}' 의 프로세스 '${processName(linked.proc_def_id)}' 에 연결했습니다`, 'info');
}
watch(() => [...kpiDialog.form.conflicts_with], adoptConflictProcess);

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
        importance: kpi?.importance ?? 3,
        priority: kpi?.priority ?? null,
        conflicts_with: [...(kpi?.conflicts_with || [])],
        activity_ids: [...(kpi?.activity_ids || [])]
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
    await linkConflictKpisToProcess(payload.proc_def_id, payload.conflicts_with);
}

// 상충 KPI 중 프로세스 미연결인 것은 이 KPI 의 프로세스에 자동 등록한다. 다른 프로세스에 연결된 KPI 는
// 한 KPI 가 프로세스 하나에만 연결되므로 바꾸지 않고, 이 프로세스 판단에선 상충이 빠진다고 알린다.
async function linkConflictKpisToProcess(procDefId: string | null, conflictIds: string[]) {
    if (!procDefId || !conflictIds?.length) return;
    const partners = conflictIds.map((id) => kpiById.value.get(id)).filter(Boolean);
    const unlinked = partners.filter((k: any) => !k.proc_def_id);
    const elsewhere = partners.filter((k: any) => k.proc_def_id && k.proc_def_id !== procDefId);
    try {
        if (unlinked.length)
            await store.linkKpisToProcess(
                unlinked.map((k: any) => k.id),
                procDefId
            );
    } catch (e: any) {
        showSnack(e?.message || '상충 KPI 프로세스 연결 실패', 'error');
        return;
    }
    if (elsewhere.length) {
        showSnack(
            `상충 KPI ${elsewhere.map((k: any) => `'${k.name}'`).join(', ')} 은(는) 다른 프로세스에 연결돼 있어 '${processName(
                procDefId
            )}' 판단에는 반영되지 않습니다`,
            'warning'
        );
    } else if (unlinked.length) {
        showSnack(`상충 KPI ${unlinked.map((k: any) => `'${k.name}'`).join(', ')} 을(를) '${processName(procDefId)}' 에 자동 연결했습니다`);
    }
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

// 달성률 단계·색 — 온톨로지 익스플로러와 같은 기준(분석 대시보드 KPI RAG 기준값)과 같은 색
const dashboardThresholds = useDashboardThresholds();
const levelThresholds = computed(() => ({
    green: Number(dashboardThresholds.values?.kpi_rag_green_pct ?? 100),
    amber: Number(dashboardThresholds.values?.kpi_rag_amber_pct ?? 50)
}));
function achievementLevelOf(rate: number | null) {
    return achievementLevel(rate, levelThresholds.value);
}
function achievementColor(rate: number | null) {
    return levelColor(achievementLevelOf(rate));
}
// 목표별 달성률·상태를 한 번에 계산해 둔다(카드마다 템플릿에서 여러 번 부르지 않게)
const achievementById = computed(() => {
    const map = new Map<string, { rate: number | null; level: string | null; color: string }>();
    for (const o of store.objectives) {
        const rate = objectiveAchievement(o);
        map.set(o.id, { rate, level: achievementLevelOf(rate), color: achievementColor(rate) });
    }
    return map;
});
// 전략맵 상단 요약 — 목표 수 · 평균 달성률 · 위험/주의 개수
const mapSummary = computed(() => {
    let sum = 0;
    let measured = 0;
    let risk = 0;
    let warn = 0;
    for (const a of achievementById.value.values()) {
        if (a.rate == null) continue;
        sum += a.rate;
        measured++;
        if (a.level === 'risk') risk++;
        else if (a.level === 'warn') warn++;
    }
    const avg = measured ? Math.round((sum / measured) * 10) / 10 : null;
    return { total: store.objectives.length, measured, avg, avgColor: achievementColor(avg), risk, warn };
});
// 관점 레일 — 관점별 평균 달성률
const perspectiveAvg = computed(() => {
    const out: Record<string, number | null> = {};
    for (const p of PERSPECTIVES) {
        const rates = objectivesByPerspective.value[p].map((o: any) => achievementById.value.get(o.id)?.rate).filter((r: any) => r != null);
        out[p] = rates.length ? Math.round((rates.reduce((a: number, b: number) => a + b, 0) / rates.length) * 10) / 10 : null;
    }
    return out;
});

// 목표 달성률 = 하위 KPI 중요도 가중 평균(익스플로러 computeMetrics 와 같은 규칙). KPI 측정값이 없으면 서비스 값.
function objectiveAchievement(objective: any): number | null {
    let sum = 0;
    let weight = 0;
    for (const k of objective.kpis || []) {
        if (k.achievement == null) continue;
        const w = Number(k.importance) || 3;
        sum += Number(k.achievement) * w;
        weight += w;
    }
    if (!weight) return objective.achievement ?? null;
    return Math.round((sum / weight) * 10) / 10;
}

function formatValue(value: any) {
    if (value == null) return '-';
    const num = Number(value);
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

onMounted(async () => {
    await Promise.all([store.loadMap(), store.loadProcessDefinitions()]);
    await nextTick();
    scheduleEdges();
});

onBeforeUnmount(() => {
    mapObserver?.disconnect();
    if (edgeFrame) cancelAnimationFrame(edgeFrame);
});
</script>

<template>
    <!-- PAL: 다른 PAL 화면과 같은 박스(sk-page-card) + page-header. 비 PAL 은 기존 헤더 -->
    <v-card
        :elevation="isPal ? 10 : 0"
        class="strategy-board-page sx-theme"
        :class="{ 'rounded-xl sk-page-card': isPal }"
        :style="{ height: isPal ? '100%' : 'calc(100vh - 132px)' }"
    >
        <!-- 본문(헤더·탭·뷰)과 상세 패널을 좌우로 나눈다 — 패널이 카드 오른쪽 전체 높이를 쓰고 헤더는 왼쪽으로 밀린다(모든 모드) -->
        <div class="board-main">
            <!-- Header (PAL: 공통 page-header 패턴 — board-main 패딩 16px 이 헤더 패딩을 대신한다. 비 PAL: 기존 헤더) -->
            <div
                class="board-header"
                :class="isPal ? 'page-header pa-0 mb-4' : 'd-flex align-center justify-space-between mb-4 flex-wrap ga-2'"
            >
                <div v-if="isPal" class="page-header-left">
                    <h1 class="page-title">전략 보드</h1>
                    <p class="page-subtitle">{{ $t('strategyBoard.subtitle') }}</p>
                </div>
                <div v-else>
                    <h2 class="text-h5 font-weight-bold">{{ $t('strategyBoard.title') }}</h2>
                    <span class="text-caption text-medium-emphasis">{{ $t('strategyBoard.subtitle') }}</span>
                </div>
                <!-- 액션: 주 액션(전략목표 추가) 1개 + 나머지는 더보기 메뉴(파괴적 작업은 메뉴 맨 아래로 분리) -->
                <div v-if="boardView === 'map'" class="board-actions">
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
                    <v-menu location="bottom end">
                        <template #activator="{ props: menuProps }">
                            <v-btn
                                v-bind="menuProps"
                                variant="outlined"
                                size="small"
                                data-testid="board-more"
                                :loading="measuring || importing"
                            >
                                더보기<v-icon end size="16">mdi-chevron-down</v-icon>
                            </v-btn>
                        </template>
                        <v-list density="compact" min-width="220">
                            <v-list-item
                                prepend-icon="mdi-refresh"
                                :title="$t('strategyBoard.refreshMeasure')"
                                @click="refreshMeasurement"
                            />
                            <v-list-item
                                prepend-icon="mdi-vector-link"
                                title="전략 정합성 검사"
                                data-testid="open-alignment-check"
                                @click="openAlignmentDialog"
                            />
                            <v-list-item
                                v-if="!store.objectives.length"
                                prepend-icon="mdi-database-import-outline"
                                :title="$t('strategyBoard.importLegacy')"
                                @click="importLegacy"
                            />
                            <template v-if="store.objectives.length">
                                <v-divider class="my-1" />
                                <v-list-item
                                    class="board-danger-item"
                                    prepend-icon="mdi-delete-sweep-outline"
                                    title="전략맵 초기화…"
                                    @click="openResetDialog"
                                />
                            </template>
                        </v-list>
                    </v-menu>
                    <v-btn color="primary" size="small" variant="flat" @click="openObjectiveDialog()">
                        <v-icon start size="16">mdi-plus</v-icon>
                        {{ $t('strategyBoard.addObjective') }}
                    </v-btn>
                </div>
            </div>

            <!-- 탭+본문: 테두리 박스 하나 안에 탭 바와 뷰 -->
            <div class="board-tab-card">
                <div class="board-tab-toolbar">
                    <v-tabs v-model="boardView" color="primary" height="48" class="board-view-tabs" hide-slider>
                        <v-tab value="map" data-testid="board-tab-map"><v-icon start size="18">mdi-sitemap-outline</v-icon>전략맵</v-tab>
                        <v-tab value="explorer" data-testid="board-tab-explorer">
                            <v-icon start size="18">mdi-graph-outline</v-icon>온톨로지 익스플로러
                        </v-tab>
                        <v-tab value="schema" data-testid="board-tab-schema"
                            ><v-icon start size="18">mdi-shape-outline</v-icon>온톨로지 스키마</v-tab
                        >
                    </v-tabs>
                </div>
                <div class="board-tab-body">
                    <div v-if="boardView === 'explorer'" class="board-view-pane" :class="{ 'board-view-pane--appbar': !isPal }">
                        <StrategyOntologyExplorer :focus-id="explorerFocusId" @open-objective="openObjectiveFromExplorer" />
                    </div>
                    <div v-else-if="boardView === 'schema'" class="board-view-pane" :class="{ 'board-view-pane--appbar': !isPal }">
                        <OntologySchemaView />
                    </div>

                    <!-- Loading: 레인 자리를 먼저 잡아 두어 로드 후 화면이 밀리지 않게 -->
                    <div v-else-if="store.loading" class="map-skeleton" aria-busy="true" aria-label="전략맵 불러오는 중">
                        <div v-for="p in PERSPECTIVES" :key="p" class="map-skeleton-lane">
                            <div class="map-skeleton-rail"></div>
                            <div class="map-skeleton-card"></div>
                            <div class="map-skeleton-card"></div>
                        </div>
                    </div>

                    <div v-else>
                        <!-- 요약: 목표 수 · 평균 달성률 · 위험/주의 -->
                        <div v-if="store.objectives.length" class="map-summary" data-testid="map-summary">
                            <div class="map-stat">
                                <span class="map-stat-label">전략목표</span>
                                <span class="map-stat-value sx-num">{{ mapSummary.total }}</span>
                            </div>
                            <div class="map-stat">
                                <span class="map-stat-label">평균 달성률</span>
                                <span
                                    class="map-stat-value sx-num"
                                    :style="{ color: mapSummary.avg != null ? mapSummary.avgColor : undefined }"
                                >
                                    {{ mapSummary.avg != null ? `${mapSummary.avg}%` : '-' }}
                                </span>
                            </div>
                            <div class="map-stat">
                                <span class="map-stat-label">위험</span>
                                <span class="map-stat-value sx-num" :class="{ 'is-risk': mapSummary.risk }">{{ mapSummary.risk }}</span>
                            </div>
                            <div class="map-stat">
                                <span class="map-stat-label">주의</span>
                                <span class="map-stat-value sx-num" :class="{ 'is-warn': mapSummary.warn }">{{ mapSummary.warn }}</span>
                            </div>
                            <span class="map-summary-hint">
                                <v-icon size="14">mdi-gesture-tap</v-icon>클릭: 상세 · Shift+클릭: 다중 선택 · 우클릭: 삭제
                            </span>
                        </div>

                        <div class="board-map-main">
                            <!-- 전략맵 -->
                            <div ref="mapContainer" class="strategy-map position-relative" @click="clearSelections">
                                <svg class="edge-layer" aria-hidden="true">
                                    <defs>
                                        <marker id="strategy-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                                            <path d="M0,0 L6,3 L0,6 Z" class="edge-marker" />
                                        </marker>
                                        <marker id="strategy-arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                                            <path d="M0,0 L6,3 L0,6 Z" class="edge-marker edge-marker--active" />
                                        </marker>
                                    </defs>
                                    <path
                                        v-for="(edge, i) in edges"
                                        :key="i"
                                        :d="edgePath(edge)"
                                        class="map-edge"
                                        :class="{
                                            'map-edge--active': isEdgeHighlighted(edge),
                                            'map-edge--muted': selectedObjectiveId && !isEdgeHighlighted(edge)
                                        }"
                                        fill="none"
                                        :marker-end="isEdgeHighlighted(edge) ? 'url(#strategy-arrow-active)' : 'url(#strategy-arrow)'"
                                    />
                                </svg>

                                <div
                                    v-for="perspective in PERSPECTIVES"
                                    :key="perspective"
                                    class="perspective-lane"
                                    :style="laneStyle(perspective)"
                                >
                                    <div class="lane-label">
                                        <span class="lane-name"
                                            ><span class="lane-dot" aria-hidden="true"></span
                                            >{{ $t(`strategyBoard.perspectives.${perspective}`) }}</span
                                        >
                                        <span class="lane-meta">
                                            <span class="sx-num">{{ objectivesByPerspective[perspective].length }}</span
                                            >개
                                            <template v-if="perspectiveAvg[perspective] != null">
                                                · 평균
                                                <span class="sx-num" :style="{ color: achievementColor(perspectiveAvg[perspective]) }"
                                                    >{{ perspectiveAvg[perspective] }}%</span
                                                >
                                            </template>
                                        </span>
                                    </div>
                                    <div class="lane-cards">
                                        <v-card
                                            v-for="objective in objectivesByPerspective[perspective]"
                                            :key="objective.id"
                                            :ref="(el: any) => setCardRef(objective.id, el)"
                                            variant="flat"
                                            class="objective-card"
                                            :class="{
                                                selected: objective.id === selectedObjectiveId,
                                                'multi-selected': multiSelectedIds.has(objective.id),
                                                connected:
                                                    connectedIds && objective.id !== selectedObjectiveId && connectedIds.has(objective.id),
                                                dimmed: connectedIds && !connectedIds.has(objective.id)
                                            }"
                                            :aria-pressed="objective.id === selectedObjectiveId"
                                            role="button"
                                            tabindex="0"
                                            @click.stop="onCardClick(objective, $event)"
                                            @keydown.enter.prevent="onCardClick(objective, $event)"
                                            @keydown.space.prevent="onCardClick(objective, $event)"
                                            @contextmenu.stop.prevent="onCardContextMenu(objective, $event)"
                                        >
                                            <v-icon
                                                v-if="multiSelectedIds.has(objective.id)"
                                                size="16"
                                                color="secondary"
                                                class="multi-select-check"
                                            >
                                                mdi-check-circle
                                            </v-icon>
                                            <div class="oc-head">
                                                <span class="oc-name">{{ objective.name }}</span>
                                                <span
                                                    v-if="objective.importance != null"
                                                    class="oc-importance"
                                                    :title="$t('strategyBoard.importance')"
                                                    :aria-label="`${$t('strategyBoard.importance')} ${objective.importance}`"
                                                >
                                                    <v-icon size="12">mdi-star</v-icon>{{ objective.importance }}
                                                </span>
                                            </div>
                                            <div class="oc-meta">
                                                <span><v-icon size="14">mdi-target</v-icon>{{ objective.kpis.length }} KPI</span>
                                                <span>
                                                    <v-icon size="14">mdi-rocket-launch-outline</v-icon>{{ objective.initiatives.length }}
                                                    {{ $t('strategyBoard.initiativeShort') }}
                                                </span>
                                            </div>
                                            <div v-if="achievementById.get(objective.id)?.rate != null" class="oc-progress">
                                                <div class="oc-progress-row">
                                                    <span
                                                        class="oc-rate sx-num"
                                                        :style="{ color: achievementById.get(objective.id)!.color }"
                                                        >{{ achievementById.get(objective.id)!.rate }}%</span
                                                    >
                                                    <span
                                                        v-if="achievementById.get(objective.id)!.level === 'risk'"
                                                        class="sx-pill sx-pill--risk sb-badge--risk"
                                                        >{{ LEVEL_TEXT.risk }}</span
                                                    >
                                                    <span
                                                        v-else-if="achievementById.get(objective.id)!.level === 'warn'"
                                                        class="sx-pill sx-pill--warn sb-badge--warn"
                                                        >{{ LEVEL_TEXT.warn }}</span
                                                    >
                                                </div>
                                                <div class="oc-bar" role="presentation">
                                                    <span
                                                        :style="{
                                                            transform: `scaleX(${Math.min(achievementById.get(objective.id)!.rate!, 100) / 100})`,
                                                            background: achievementById.get(objective.id)!.color
                                                        }"
                                                    ></span>
                                                </div>
                                            </div>
                                            <span v-else class="oc-unmeasured">{{ $t('strategyBoard.notMeasured') }}</span>
                                        </v-card>
                                        <div v-if="!objectivesByPerspective[perspective].length" class="lane-empty">
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- 상세 패널 -->
        <v-slide-x-reverse-transition>
            <v-card v-if="selectedObjective && boardView === 'map'" class="detail-panel detail-panel--side" elevation="0">
                <div class="detail-head">
                    <div class="min-width-0">
                        <span class="detail-perspective" :style="laneStyle(selectedObjective.perspective)">
                            <span class="lane-dot" aria-hidden="true"></span>
                            {{ $t(`strategyBoard.perspectives.${selectedObjective.perspective}`) }}
                        </span>
                        <h3 class="detail-title">{{ selectedObjective.name }}</h3>
                        <p v-if="selectedObjective.description" class="detail-desc">
                            {{ selectedObjective.description }}
                        </p>
                        <div v-if="achievementById.get(selectedObjective.id)?.rate != null" class="detail-rate">
                            <span class="sx-num" :style="{ color: achievementById.get(selectedObjective.id)!.color }"
                                >{{ achievementById.get(selectedObjective.id)!.rate }}%</span
                            >
                            <span class="detail-rate-label">KPI 중요도 가중 달성률</span>
                        </div>
                    </div>
                    <div class="d-flex ga-1 flex-shrink-0">
                        <v-btn
                            icon
                            size="x-small"
                            variant="text"
                            title="연관관계 보기 (온톨로지 익스플로러)"
                            aria-label="연관관계 보기 (온톨로지 익스플로러)"
                            data-testid="open-in-explorer"
                            @click="openInExplorer(selectedObjective.id)"
                        >
                            <v-icon size="18">mdi-graph-outline</v-icon>
                        </v-btn>
                        <v-btn
                            icon
                            size="x-small"
                            variant="text"
                            aria-label="전략목표 수정"
                            title="수정"
                            @click="openObjectiveDialog(selectedObjective)"
                        >
                            <v-icon size="18">mdi-pencil</v-icon>
                        </v-btn>
                        <v-btn
                            icon
                            size="x-small"
                            variant="text"
                            color="error"
                            aria-label="전략목표 삭제"
                            title="삭제"
                            @click="removeObjective(selectedObjective)"
                        >
                            <v-icon size="18">mdi-delete-outline</v-icon>
                        </v-btn>
                        <v-btn
                            icon
                            size="x-small"
                            variant="text"
                            aria-label="상세 패널 닫기"
                            title="닫기"
                            @click="selectedObjectiveId = null"
                        >
                            <v-icon size="18">mdi-close</v-icon>
                        </v-btn>
                    </div>
                </div>

                <v-tabs v-model="detailTab" density="compact" class="px-2">
                    <v-tab value="kpis">KPI ({{ selectedObjective.kpis.length }})</v-tab>
                    <v-tab value="initiatives">{{ $t('strategyBoard.initiatives') }} ({{ selectedObjective.initiatives.length }})</v-tab>
                    <v-tab value="contribution" data-testid="contribution-tab">{{ $t('strategyBoard.contribution') }}</v-tab>
                    <v-tab value="improve" data-testid="improve-tab">{{ $t('strategyBoard.improve') }}</v-tab>
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
                                <span class="text-subtitle-2 font-weight-bold">
                                    {{ kpi.name }}
                                    <span v-if="kpi.priority" class="kpi-priority sx-num" :title="`판단 우선순위 ${kpi.priority}`"
                                        >우선 {{ kpi.priority }}</span
                                    >
                                </span>
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
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="text"
                                        :aria-label="kpiDetails[kpi.id] ? '측정 이력 접기' : '측정 이력 보기'"
                                        :title="kpiDetails[kpi.id] ? '측정 이력 접기' : '측정 이력 보기'"
                                        @click="toggleKpiDetail(kpi)"
                                    >
                                        <v-icon size="16">{{ kpiDetails[kpi.id] ? 'mdi-chevron-up' : 'mdi-chart-line' }}</v-icon>
                                    </v-btn>
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="text"
                                        aria-label="KPI 수정"
                                        title="수정"
                                        @click="openKpiDialog(kpi)"
                                    >
                                        <v-icon size="16">mdi-pencil</v-icon>
                                    </v-btn>
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="text"
                                        color="error"
                                        aria-label="KPI 삭제"
                                        title="삭제"
                                        @click="removeKpi(kpi)"
                                    >
                                        <v-icon size="16">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                            <div class="d-flex align-center ga-2 my-1 flex-wrap">
                                <v-chip size="x-small" variant="tonal">{{ $t(`strategyBoard.measureTypes.${kpi.measure_type}`) }}</v-chip>
                                <v-chip v-if="kpi.proc_def_id" size="x-small" variant="tonal" color="primary" prepend-icon="mdi-sitemap">
                                    {{ processName(kpi.proc_def_id) }}
                                </v-chip>
                                <span
                                    v-for="cid in kpi.conflicts_with || []"
                                    :key="cid"
                                    class="kpi-conflict"
                                    :title="`상충: 실행 중 에이전트가 우선순위로 고르거나, 미정이면 담당자에게 묻습니다`"
                                    ><v-icon size="13">mdi-scale-unbalanced</v-icon>상충 · {{ kpiNameById.get(cid) || cid }}</span
                                >
                            </div>
                            <div class="d-flex align-center justify-space-between mt-1">
                                <span class="text-caption">
                                    {{ formatValue(kpi.current_value) }} / {{ formatValue(kpi.target_value) }}
                                    <span v-if="kpi.unit">{{ kpi.unit }}</span>
                                </span>
                                <span class="text-caption font-weight-bold" :style="{ color: achievementColor(kpi.achievement) }">
                                    {{ kpi.achievement != null ? kpi.achievement + '%' : $t('strategyBoard.notMeasured') }}
                                </span>
                            </div>
                            <v-progress-linear
                                :model-value="Math.min(kpi.achievement || 0, 100)"
                                :color="achievementColor(kpi.achievement)"
                                bg-color="rgba(var(--v-theme-on-surface), 0.08)"
                                bg-opacity="1"
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
                                        <div v-if="!kpiDetails[kpi.id].contribution.performers.length" class="text-caption text-disabled">
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
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="text"
                                        aria-label="이니셔티브 수정"
                                        title="수정"
                                        @click="openInitiativeDialog(initiative)"
                                    >
                                        <v-icon size="16">mdi-pencil</v-icon>
                                    </v-btn>
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="text"
                                        color="error"
                                        aria-label="이니셔티브 삭제"
                                        title="삭제"
                                        @click="removeInitiative(initiative)"
                                    >
                                        <v-icon size="16">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                            <div class="d-flex align-center ga-2 my-1 flex-wrap">
                                <v-chip size="x-small" variant="tonal" :color="STATUS_COLORS[initiative.status]">
                                    {{ $t(`strategyBoard.statuses.${initiative.status}`) }}
                                </v-chip>
                                <v-chip
                                    v-if="initiative.proc_def_id"
                                    size="x-small"
                                    variant="tonal"
                                    color="primary"
                                    prepend-icon="mdi-sitemap"
                                >
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

                    <!-- 개선점 탭: 미달 KPI → 병목 태스크 → 개선할 스킬(전략 하향 분석) -->
                    <StrategyImprovePanel v-else-if="detailTab === 'improve'" :objective-id="selectedObjective.id" />

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
                <v-select
                    v-model="objectiveDialog.form.priority"
                    :items="PRIORITY_OPTIONS"
                    label="판단 우선순위"
                    hint="상충하는 전략 사이에서 실행 중 에이전트가 따를 쪽. 미정이면 담당자에게 묻습니다"
                    persistent-hint
                    density="compact"
                    variant="outlined"
                    class="mt-3"
                    data-testid="objective-priority"
                />
                <v-autocomplete
                    v-model="objectiveDialog.form.conflicts_with"
                    :items="conflictObjectiveOptions"
                    label="상충하는 전략"
                    hint="함께 최대화하기 어려운(트레이드오프) 전략"
                    persistent-hint
                    density="compact"
                    variant="outlined"
                    multiple
                    chips
                    closable-chips
                    class="mt-3"
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

                <!-- 수동 입력 KPI 도 프로세스에 연결할 수 있다 — 측정은 안 하지만 실행 중 에이전트 판단의 근거가 된다(spec 018) -->
                <v-autocomplete
                    v-model="kpiDialog.form.proc_def_id"
                    :items="store.processDefinitions.map((p: any) => ({ title: p.name, value: p.id }))"
                    :label="$t('strategyBoard.linkedProcess')"
                    :hint="
                        kpiDialog.form.measure_type === 'manual'
                            ? '수동 입력 KPI 는 측정에 쓰지 않고, 이 프로세스 실행 중 에이전트 판단의 근거로만 쓴다'
                            : ''
                    "
                    :persistent-hint="kpiDialog.form.measure_type === 'manual'"
                    density="compact"
                    variant="outlined"
                    clearable
                    data-testid="kpi-process"
                />
                <v-autocomplete
                    v-if="kpiDialog.form.proc_def_id"
                    v-model="kpiDialog.form.activity_ids"
                    :items="kpiActivityOptions"
                    item-props
                    label="판단 적용 활동"
                    hint="비우면 프로세스 전체. 판단 단계가 여럿이면 이 KPI 를 근거로 삼을 단계만 고른다"
                    persistent-hint
                    density="compact"
                    variant="outlined"
                    multiple
                    chips
                    closable-chips
                    class="mt-3 mb-4"
                    data-testid="kpi-activities"
                />
                <v-row dense>
                    <v-col cols="4">
                        <v-text-field
                            v-model="kpiDialog.form.unit"
                            :label="$t('strategyBoard.unit')"
                            density="compact"
                            variant="outlined"
                        />
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
                    <v-col cols="12" sm="4">
                        <v-select
                            v-model="kpiDialog.form.priority"
                            :items="PRIORITY_OPTIONS"
                            label="판단 우선순위"
                            density="compact"
                            variant="outlined"
                            data-testid="kpi-priority"
                        />
                    </v-col>
                    <v-col cols="12" sm="8">
                        <v-autocomplete
                            v-model="kpiDialog.form.conflicts_with"
                            :items="conflictKpiOptions"
                            item-props
                            label="상충하는 KPI"
                            hint="함께 최대화하기 어려운 KPI — 실행 중 에이전트가 우선순위로 고르거나, 미정이면 담당자에게 묻습니다"
                            persistent-hint
                            density="compact"
                            variant="outlined"
                            multiple
                            chips
                            closable-chips
                            data-testid="kpi-conflicts"
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
                        <v-chip size="x-small" variant="flat" :color="performerTypeColor(performerDialog.data.performer.performer_type)">
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
                    <div v-if="!performerDialog.data.strategy_breakdown.length" class="text-caption text-disabled text-center py-3">
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
                    현재 전략맵의 모든 전략목표·KPI·이니셔티브와 측정이력·설문 응답이 <strong>영구적으로 삭제</strong>됩니다. 되돌릴 수
                    없습니다.
                </v-alert>
                <p class="text-body-2 mb-2">
                    계속하려면 아래 입력란에 <strong>{{ RESET_CONFIRM_PHRASE }}</strong
                    >를 입력하세요.
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
                                    :color="
                                        alignmentDialog.result.status === 'matched'
                                            ? 'success'
                                            : alignmentDialog.result.status === 'unavailable'
                                            ? 'error'
                                            : 'warning'
                                    "
                                    data-testid="alignment-status"
                                >
                                    {{
                                        alignmentDialog.result.status === 'matched'
                                            ? '관련 후보 있음'
                                            : alignmentDialog.result.status === 'unavailable'
                                            ? '확인 불가'
                                            : '관련 항목 없음'
                                    }}
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
                                        <v-icon size="19">{{
                                            isKpiCandidate(candidate) ? 'mdi-target' : 'mdi-flag-variant-outline'
                                        }}</v-icon>
                                    </v-avatar>
                                    <div class="flex-grow-1 min-width-0">
                                        <div class="d-flex align-center justify-space-between ga-2">
                                            <span class="text-subtitle-2 font-weight-bold">{{ candidate.name }}</span>
                                            <v-chip
                                                size="x-small"
                                                variant="tonal"
                                                :color="isKpiCandidate(candidate) ? 'primary' : 'secondary'"
                                            >
                                                {{ isKpiCandidate(candidate) ? 'KPI' : '전략목표' }} ·
                                                {{ Math.round((candidate.score || 0) * 100) }}%
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
/* 좌우 분할(모든 모드): 본문(헤더·탭·뷰) | 상세 패널. PAL 의 sk-page-card 가 column 을 강제하므로 !important. 스크롤은 본문만 */
.strategy-board-page.strategy-board-page {
    display: flex !important;
    flex-direction: row !important;
    overflow: hidden !important;
    padding: 0;
}
.strategy-board-page > .board-main {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 16px;
}
.detail-panel.detail-panel--side {
    position: relative;
    top: auto;
    right: auto;
    bottom: auto;
    width: 420px;
    max-width: 45%;
    height: auto;
    align-self: stretch;
    flex-shrink: 0;
    z-index: 1;
    border-left: 1px solid var(--sx-line);
    border-radius: 0;
    background: var(--sx-surface);
}
.board-view-pane {
    /* PAL: 상단 앱바 없음. 비 PAL 은 앱바(약 90px)만큼 더 뺀다 */
    height: calc(100vh - 254px);
    min-height: 480px;
}
.board-view-pane.board-view-pane--appbar {
    height: calc(100vh - 344px);
}

/* ── 탭 박스 ─────────────────────────────────────────── */
.board-tab-card {
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius-lg);
    background: var(--sx-surface);
}
.board-tab-toolbar {
    display: flex;
    align-items: center;
    padding: 0 8px;
    border-bottom: 1px solid var(--sx-line);
}
.board-view-tabs :deep(.v-tab) {
    min-width: 92px;
    margin: 6px 2px;
    height: 36px !important;
    padding: 0 14px;
    border-radius: 8px;
    text-transform: none !important;
    font-weight: 600;
    letter-spacing: 0 !important;
    color: var(--sx-ink-2);
    transition: background-color var(--sx-dur) var(--sx-ease), color var(--sx-dur) var(--sx-ease);
}
.board-view-tabs :deep(.v-tab:hover) {
    background: var(--sx-surface-hover);
}
.board-view-tabs :deep(.v-tab.v-tab--selected) {
    background: var(--sx-accent-soft);
    color: var(--sx-accent);
}
.board-view-tabs :deep(.v-tab .v-btn__overlay) {
    display: none;
}
.board-tab-body {
    padding: 16px;
}

/* ── 헤더 ─────────────────────────────────────────────── */
.board-header {
    flex-wrap: wrap;
    row-gap: 8px;
}
/* 좁은 화면에서 제목이 글자 단위로 쪼개지지 않게 — 액션이 아래 줄로 내려간다 */
.board-header > :first-child {
    flex: 1 1 220px;
    min-width: 160px;
}
.board-header .page-title,
.board-header h2 {
    white-space: nowrap;
}
.board-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
}
.board-actions :deep(.v-btn) {
    text-transform: none;
    letter-spacing: 0;
    border-radius: 8px;
}
.board-danger-item {
    color: #dc2626;
}

/* ── 요약 띠 ──────────────────────────────────────────── */
.map-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 8px;
    margin-bottom: 16px;
}
.map-stat {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 112px;
    padding: 10px 14px;
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius);
    background: var(--sx-surface);
}
.map-stat-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--sx-ink-2);
}
.map-stat-value {
    font-size: 22px;
    line-height: 1.1;
    color: var(--sx-ink);
}
.map-stat-value.is-risk {
    color: var(--sx-risk);
}
.map-stat-value.is-warn {
    color: var(--sx-warn);
}
.map-summary-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    align-self: flex-end;
    font-size: 12px;
    color: var(--sx-ink-3);
}

/* ── 전략맵 ───────────────────────────────────────────── */
.strategy-map {
    min-height: 400px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.edge-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}
.map-edge {
    stroke: var(--sx-ink-3);
    stroke-opacity: 0.55;
    stroke-width: 1.5;
    transition: opacity var(--sx-dur) var(--sx-ease), stroke var(--sx-dur) var(--sx-ease);
}
.map-edge--active {
    stroke: var(--sx-accent);
    stroke-opacity: 1;
    stroke-width: 2.25;
}
.map-edge--muted {
    opacity: 0.2;
}
.edge-marker {
    fill: var(--sx-ink-3);
    fill-opacity: 0.7;
}
.edge-marker--active {
    fill: var(--sx-accent);
    fill-opacity: 1;
}
.perspective-lane {
    display: flex;
    align-items: stretch;
    gap: 12px;
    min-height: 104px;
    padding: 8px;
    border-radius: var(--sx-radius-lg);
    background: var(--sx-surface-sunken);
}
.lane-label {
    flex: 0 0 132px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 4px;
    padding: 8px 10px;
}
.lane-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--lane);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--lane) 18%, transparent);
}
.lane-name {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    word-break: keep-all;
    font-size: 14px;
    font-weight: 700;
    color: var(--sx-ink);
    line-height: 1.3;
}
.lane-meta {
    font-size: 12px;
    color: var(--sx-ink-2);
}
.lane-cards {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    align-content: flex-start;
    padding: 2px 0;
}
.lane-empty {
    align-self: center;
    padding: 12px;
    font-size: 12px;
    color: var(--sx-ink-3);
}
.objective-card {
    position: relative;
    width: 232px;
    padding: 12px 14px;
    cursor: pointer;
    user-select: none;
    border: 1px solid var(--sx-line) !important;
    border-radius: var(--sx-radius) !important;
    background: var(--sx-surface) !important;
    box-shadow: var(--sx-shadow-1);
    transition: box-shadow var(--sx-dur) var(--sx-ease), border-color var(--sx-dur) var(--sx-ease), opacity var(--sx-dur) var(--sx-ease),
        transform var(--sx-dur) var(--sx-ease);
    z-index: 2;
}
.objective-card:hover {
    box-shadow: var(--sx-shadow-2);
    transform: translateY(-1px);
}
.objective-card:focus-visible {
    outline: 2px solid var(--sx-accent);
    outline-offset: 2px;
}
.objective-card.selected {
    border-color: var(--sx-accent) !important;
    box-shadow: 0 0 0 3px var(--sx-accent-ring), var(--sx-shadow-2);
}
.objective-card.multi-selected {
    border-color: rgb(var(--v-theme-secondary)) !important;
    background: rgba(var(--v-theme-secondary), 0.06) !important;
}
.objective-card.connected {
    border-color: rgba(var(--v-theme-primary), 0.55) !important;
}
.objective-card.dimmed {
    opacity: 0.4;
}
.objective-card :deep(.v-card__overlay),
.objective-card :deep(.v-card__underlay) {
    display: none;
}
.multi-select-check {
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--sx-surface);
    border-radius: 50%;
}
.oc-head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}
.oc-name {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
    color: var(--sx-ink);
    word-break: keep-all;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.kpi-priority {
    display: inline-flex;
    align-items: center;
    height: 18px;
    margin-left: 6px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--sx-accent-soft);
    color: var(--sx-accent);
    font-size: 11px;
    vertical-align: middle;
}
.kpi-conflict {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 20px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--sx-warn-soft);
    color: var(--sx-warn);
    font-size: 11px;
    font-weight: 600;
}
.oc-importance {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--sx-warn-soft);
    color: var(--sx-warn);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.oc-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--sx-ink-2);
}
.oc-meta > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.oc-meta :deep(.v-icon) {
    color: var(--sx-ink-3);
}
.oc-progress {
    margin-top: 10px;
}
.oc-progress-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}
.oc-rate {
    font-size: 16px;
    line-height: 1;
}
.oc-bar {
    height: 4px;
    border-radius: 999px;
    background: var(--sx-surface-hover);
    overflow: hidden;
}
.oc-bar > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    transform-origin: left center;
    transition: transform 0.4s var(--sx-ease);
}
.oc-unmeasured {
    display: inline-block;
    margin-top: 10px;
    font-size: 12px;
    color: var(--sx-ink-3);
}
.map-skeleton {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.map-skeleton-lane {
    display: flex;
    gap: 12px;
    height: 104px;
    padding: 8px;
    border-radius: var(--sx-radius-lg);
    background: var(--sx-surface-sunken);
}
.map-skeleton-rail {
    width: 132px;
}
.map-skeleton-card {
    width: 232px;
    border-radius: var(--sx-radius);
    background: linear-gradient(90deg, var(--sx-surface-hover) 25%, var(--sx-surface) 50%, var(--sx-surface-hover) 75%);
    background-size: 200% 100%;
    animation: sb-shimmer 1.4s ease-in-out infinite;
}
@keyframes sb-shimmer {
    from {
        background-position: 200% 0;
    }
    to {
        background-position: -200% 0;
    }
}

/* ── 상세 패널 ────────────────────────────────────────── */
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
.detail-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 18px 16px 10px;
}
.detail-perspective {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--sx-ink-2);
}
.detail-title {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.35;
    color: var(--sx-ink);
    word-break: keep-all;
}
.detail-desc {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--sx-ink-2);
}
.detail-rate {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-top: 10px;
}
.detail-rate .sx-num {
    font-size: 28px;
    line-height: 1;
}
.detail-rate-label {
    font-size: 12px;
    color: var(--sx-ink-2);
}
.detail-body :deep(.v-card--variant-outlined) {
    border-color: var(--sx-line);
    border-radius: var(--sx-radius) !important;
    transition: border-color var(--sx-dur) var(--sx-ease), box-shadow var(--sx-dur) var(--sx-ease);
}
.detail-body :deep(.v-card--variant-outlined:hover) {
    border-color: var(--sx-line-strong);
    box-shadow: var(--sx-shadow-1);
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
@media (prefers-reduced-motion: reduce) {
    .objective-card:hover {
        transform: none;
    }
    .map-skeleton-card {
        animation: none;
    }
}
@media (max-width: 760px) {
    .board-tab-body {
        padding: 12px;
    }
    .board-view-pane,
    .board-view-pane.board-view-pane--appbar {
        height: auto;
        min-height: 0;
    }
    .board-view-tabs :deep(.v-tab) {
        min-width: 0;
        padding: 0 10px;
    }
    .perspective-lane {
        flex-direction: column;
    }
    .lane-label {
        flex: none;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        padding: 4px 6px;
    }
    .objective-card {
        width: 100%;
    }
    .map-summary-hint {
        display: none;
    }
}
</style>
