<script setup lang="ts">
// 데이터셋 탭 — 에이전트 판단이 근거로 쓰는 데이터셋(판단 설정, strategy_decision_models)을 보고 고친다(spec 020).
// 10/22 회의: 어떤 데이터를 쓰는지는 Process-GPT 화면에서 보여야 하고, 기본은 초안 + 관리자 수정이다.
// 정의에 화면이 다루지 않는 키(price_reference·defaults·kpi_links 등)는 그대로 보존한다.
import { computed, onMounted, ref, watch } from 'vue';
import { ontologyDataApi, apiError, type DatasetItem, type StudioColumn, type StudioRows, type StudioSchema } from './ontologyDataApi';

const props = defineProps<{ focus?: { proc?: string; act?: string; newClass?: string } | null }>();

// 견적 후보에 늘 있는 수치(strategy data_decision.OPTION_FIELDS 와 같게 유지)
const OPTION_FIELDS = ['price_per_kg', 'marbling_no', 'grade_score', 'price_index', 'price_ratio', 'market_price_per_kg', 'defect_pct', 'month_no', 'lead_days', 'qty_kg'];

const items = ref<DatasetItem[]>([]);
const listLoading = ref(false);
const listError = ref<string | null>(null);
const processes = ref<{ id: string; name: string }[]>([]);
const activityNames = ref<Record<string, Record<string, string>>>({});
const schemas = ref<StudioSchema[]>([]);
const studioError = ref<string | null>(null);

// 편집 상태
const current = ref<{ proc_def_id: string; activity_id: string; isNew: boolean } | null>(null);
const cfg = ref<Record<string, any> | null>(null);
const original = ref('');
const newActivities = ref<{ id: string; name: string }[]>([]);
const history = ref<StudioRows | null>(null);
const historyLoading = ref(false);
const preview = ref<any | null>(null);
const previewLoading = ref(false);
const check = ref<{ ok: boolean; errors: any[]; warnings: any[] } | null>(null);
const saving = ref(false);
const snack = ref<{ show: boolean; text: string; color: string }>({ show: false, text: '', color: 'success' });
const confirmDelete = ref(false);

const dirty = computed(() => !!cfg.value && JSON.stringify(cfg.value) !== original.value);

function procName(id: string) {
    return processes.value.find((p) => p.id === id)?.name || id;
}
function actName(proc: string, act: string) {
    return activityNames.value[proc]?.[act] || act || '(프로세스 전체)';
}

async function loadActivities(proc: string) {
    if (activityNames.value[proc]) return;
    try {
        const acts = await ontologyDataApi.processActivities(proc);
        activityNames.value = { ...activityNames.value, [proc]: Object.fromEntries(acts.map((a) => [a.id, a.name])) };
    } catch {
        /* 이름 없이 id 로 보인다 */
    }
}

async function loadList() {
    listLoading.value = true;
    listError.value = null;
    try {
        items.value = await ontologyDataApi.listDatasets();
        await Promise.all([...new Set(items.value.map((i) => i.proc_def_id))].map(loadActivities));
    } catch (e) {
        listError.value = apiError(e);
    } finally {
        listLoading.value = false;
    }
}

async function loadMeta() {
    try {
        processes.value = await ontologyDataApi.processDefinitions();
    } catch {
        processes.value = [];
    }
    try {
        const res = await ontologyDataApi.studioSchemas();
        schemas.value = res.schemas || [];
        studioError.value = res.error;
    } catch (e) {
        studioError.value = apiError(e);
    }
}

const classOptions = computed(() => {
    const out: any[] = [];
    for (const s of schemas.value) {
        out.push({ type: 'subheader', title: s.name });
        for (const c of s.classes) out.push({ title: `${c.class_name} — ${c.description || ''}`, value: c.class_name, count: c.entity_count });
    }
    return out;
});

function normalize(c: Record<string, any>) {
    const x = JSON.parse(JSON.stringify(c || {}));
    x.history = { class: '', where: {}, min_rows: 30, ...(x.history || {}) };
    x.history.where = x.history.where || {};
    x.features = x.features || [];
    x.params = x.params || {};
    x.outputs = x.outputs || [];
    x.preference = { features: ['grade_score', 'price_index', 'defect_pct'], min_cases: 8, ...(x.preference || {}) };
    x.min_r2 = x.min_r2 ?? 0.5;
    x.objective = x.objective || 'pred';
    delete x.draft;
    delete x.total_rows;
    return x;
}

async function open(item: DatasetItem) {
    if (dirty.value && !window.confirm('저장하지 않은 변경이 있습니다. 버리고 이동할까요?')) return;
    current.value = { proc_def_id: item.proc_def_id, activity_id: item.activity_id, isNew: false };
    cfg.value = normalize(item.config);
    original.value = JSON.stringify(cfg.value);
    preview.value = null;
    check.value = null;
    await loadHistory();
}

function startNew(className = '') {
    if (dirty.value && !window.confirm('저장하지 않은 변경이 있습니다. 버리고 새로 만들까요?')) return;
    current.value = { proc_def_id: '', activity_id: '', isNew: true };
    cfg.value = normalize({ name: '', decision: '', history: { class: className, where: {}, min_rows: 30 } });
    original.value = '';
    history.value = null;
    preview.value = null;
    check.value = null;
    if (className) loadHistory();
}

watch(
    () => current.value?.isNew && current.value.proc_def_id,
    async (proc) => {
        newActivities.value = [];
        if (!proc) return;
        try {
            newActivities.value = await ontologyDataApi.processActivities(proc);
        } catch {
            newActivities.value = [];
        }
    }
);

// ---------------------------------------------------------------- 이력 원천
const whereRows = ref<{ key: string; value: string }[]>([]);
watch(
    cfg,
    (c) => {
        if (!c) return;
        const w = c.history?.where || {};
        const rows = Object.entries(w).map(([key, value]) => ({ key, value: String(value) }));
        if (JSON.stringify(rows) !== JSON.stringify(whereRows.value.filter((r) => r.key))) whereRows.value = rows;
    },
    { immediate: true }
);

function applyWhere() {
    if (!cfg.value) return;
    const w: Record<string, any> = {};
    for (const r of whereRows.value) {
        if (!r.key) continue;
        w[r.key] = r.value.trim() !== '' && !isNaN(Number(r.value)) ? Number(r.value) : r.value;
    }
    cfg.value.history.where = w;
    loadHistory();
}

async function loadHistory() {
    if (!cfg.value?.history?.class) {
        history.value = null;
        return;
    }
    historyLoading.value = true;
    try {
        history.value = await ontologyDataApi.studioRows(cfg.value.history.class, cfg.value.history.where, 5);
    } catch (e) {
        history.value = { class: cfg.value.history.class, total: 0, rows: [], columns: [], error: apiError(e) };
    } finally {
        historyLoading.value = false;
    }
}

// 열 순서: 스키마에 정의된 속성 순서 → 나머지(값이 많이 찬 순)
const columns = computed<StudioColumn[]>(() => {
    const order = Object.keys(classProps.value);
    const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : 1000);
    return (history.value?.columns || [])
        .filter((c) => !c.system && c.key !== 'name')
        .sort((a, b) => rank(a.key) - rank(b.key) || b.filled - a.filled);
});
const numericColumns = computed(() => columns.value.filter((c) => c.numeric));
const classProps = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const s of schemas.value) for (const c of s.classes) if (c.class_name === cfg.value?.history?.class) for (const p of c.properties) out[p.name] = p.description || '';
    return out;
});
function colLabel(key: string) {
    return classProps.value[key] ? `${classProps.value[key]} (${key})` : key;
}

// ---------------------------------------------------------------- 목표·특징
const featureCandidates = computed(() => numericColumns.value.filter((c) => c.key !== cfg.value?.target));
function featureOf(key: string) {
    return (cfg.value?.features || []).find((f: any) => f.key === key);
}
function toggleFeature(key: string, on: boolean | null) {
    if (!cfg.value) return;
    if (on) {
        if (!featureOf(key)) cfg.value.features.push({ key, label: classProps.value[key] || key });
    } else {
        cfg.value.features = cfg.value.features.filter((f: any) => f.key !== key);
    }
}
function setTarget(key: string) {
    if (!cfg.value) return;
    cfg.value.target = key;
    cfg.value.target_label = classProps.value[key] || key;
    cfg.value.features = cfg.value.features.filter((f: any) => f.key !== key);
}
// 정의엔 있는데 지금 이력에 없는 특징 — 지우지 않고 경고로 보인다
const missingFeatures = computed(() =>
    history.value && !history.value.error ? (cfg.value?.features || []).filter((f: any) => !columns.value.some((c) => c.key === f.key)) : []
);

// ---------------------------------------------------------------- 산식
const paramRows = ref<{ key: string; value: string }[]>([]);
watch(
    () => current.value && `${current.value.proc_def_id}/${current.value.activity_id}/${current.value.isNew}`,
    () => {
        paramRows.value = Object.entries(cfg.value?.params || {}).map(([key, value]) => ({ key, value: String(value) }));
    },
    { immediate: true }
);
watch(
    paramRows,
    (rows) => {
        if (!cfg.value) return;
        const p: Record<string, any> = {};
        for (const r of rows) if (r.key) p[r.key] = r.value.trim() !== '' && !isNaN(Number(r.value)) ? Number(r.value) : r.value;
        cfg.value.params = p;
    },
    { deep: true }
);
const objectiveOptions = computed(() => [
    { title: `예측값 그대로 (${cfg.value?.target_label || cfg.value?.target || 'pred'})`, value: 'pred' },
    ...(cfg.value?.outputs || []).filter((o: any) => o.key).map((o: any) => ({ title: `${o.label || o.key} (${o.key})`, value: o.key }))
]);

const fieldErrors = computed(() => {
    const m: Record<string, string[]> = {};
    for (const e of check.value?.errors || []) (m[e.field] ||= []).push(e.message);
    return m;
});
function errs(prefix: string) {
    return Object.entries(fieldErrors.value)
        .filter(([f]) => f === prefix || f.startsWith(prefix + '.') || f.startsWith(prefix + '['))
        .flatMap(([, v]) => v);
}

// ---------------------------------------------------------------- 동작
async function runPreview() {
    if (!cfg.value) return;
    previewLoading.value = true;
    preview.value = null;
    try {
        const res = await ontologyDataApi.previewDataset(cfg.value, 5);
        preview.value = res;
        check.value = res.check;
    } catch (e) {
        preview.value = { model: { error: apiError(e) } };
    } finally {
        previewLoading.value = false;
    }
}

async function makeDraft() {
    if (!cfg.value || !current.value) return;
    if (!cfg.value.history.class) {
        snack.value = { show: true, text: '이력 클래스를 먼저 고르세요', color: 'warning' };
        return;
    }
    try {
        const act = newActivities.value.find((a) => a.id === current.value!.activity_id)?.name;
        const name = cfg.value.name || (current.value.proc_def_id ? [procName(current.value.proc_def_id), act].filter(Boolean).join(' · ') : '');
        const d = await ontologyDataApi.draftDataset({
            proc_def_id: current.value.proc_def_id,
            activity_id: current.value.activity_id,
            class_name: cfg.value.history.class,
            where: cfg.value.history.where,
            name
        });
        if (d.error) {
            snack.value = { show: true, text: d.error, color: 'warning' };
            return;
        }
        cfg.value = normalize({ ...d, name: name || d.name, decision: cfg.value.decision || name || d.decision });
        paramRows.value = [];
        snack.value = { show: true, text: `초안을 채웠습니다 (이력 ${d.total_rows}건) — 확인 후 고쳐 저장하세요`, color: 'info' };
        loadHistory();
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    }
}

async function save() {
    if (!cfg.value || !current.value) return;
    if (current.value.isNew && !current.value.proc_def_id) {
        snack.value = { show: true, text: '이 데이터셋을 쓸 프로세스를 고르세요', color: 'warning' };
        return;
    }
    saving.value = true;
    try {
        check.value = await ontologyDataApi.validateDataset(cfg.value);
        if (!check.value.ok) {
            snack.value = { show: true, text: `저장하지 않았습니다 — ${check.value.errors.length}개 항목을 확인하세요`, color: 'error' };
            return;
        }
        await ontologyDataApi.saveDataset(current.value.proc_def_id, current.value.activity_id, cfg.value);
        original.value = JSON.stringify(cfg.value);
        const key = { proc_def_id: current.value.proc_def_id, activity_id: current.value.activity_id };
        current.value = { ...key, isNew: false };
        await loadList();
        await loadActivities(key.proc_def_id);
        snack.value = { show: true, text: '저장했습니다 — 다음 실행부터 에이전트가 이 정의로 판단합니다', color: 'success' };
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    } finally {
        saving.value = false;
    }
}

function revert() {
    if (!original.value) return;
    cfg.value = JSON.parse(original.value);
    paramRows.value = Object.entries(cfg.value?.params || {}).map(([key, value]) => ({ key, value: String(value) }));
    check.value = null;
    preview.value = null;
    loadHistory();
}

async function remove() {
    if (!current.value) return;
    confirmDelete.value = false;
    try {
        await ontologyDataApi.deleteDataset(current.value.proc_def_id, current.value.activity_id);
        current.value = null;
        cfg.value = null;
        await loadList();
        snack.value = { show: true, text: '삭제했습니다', color: 'success' };
    } catch (e) {
        snack.value = { show: true, text: apiError(e), color: 'error' };
    }
}

function isActive(i: DatasetItem) {
    return !current.value?.isNew && current.value?.proc_def_id === i.proc_def_id && current.value?.activity_id === i.activity_id;
}

function fmt(v: any) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return v.toLocaleString('ko-KR', { maximumFractionDigits: 3 });
    const s = String(v);
    return s.length > 40 ? s.slice(0, 39) + '…' : s;
}

onMounted(async () => {
    await Promise.all([loadList(), loadMeta()]);
    const f = props.focus;
    if (f?.newClass) startNew(f.newClass);
    else if (f?.proc) {
        const hit = items.value.find((i) => i.proc_def_id === f.proc && (!f.act || i.activity_id === f.act));
        if (hit) open(hit);
    } else if (items.value.length) open(items.value[0]);
});
watch(
    () => props.focus,
    (f) => {
        if (f?.newClass) startNew(f.newClass);
    }
);
</script>

<template>
    <div class="dataset-tab">
        <v-alert v-if="studioError" type="warning" variant="tonal" density="compact" class="mb-3">
            Ontology Studio 에 접속하지 못해 클래스 목록·미리보기를 쓸 수 없습니다. {{ studioError }}
        </v-alert>
        <div class="dataset-layout">
            <!-- 목록 -->
            <v-card variant="outlined" class="dataset-list">
                <div class="d-flex align-center pa-3 pb-1">
                    <span class="text-subtitle-2 font-weight-bold">데이터셋</span>
                    <v-spacer />
                    <v-btn size="small" variant="tonal" color="primary" @click="startNew()">
                        <v-icon start size="16">mdi-plus</v-icon>새 데이터셋
                    </v-btn>
                </div>
                <div class="px-3 pb-2 text-caption text-medium-emphasis">
                    프로세스 판단 단계의 에이전트가 근거로 읽는 Ontology Studio 데이터와 학습 정의입니다.
                </div>
                <v-progress-linear v-if="listLoading" indeterminate color="primary" />
                <v-alert v-if="listError" type="error" variant="tonal" density="compact" class="ma-2">{{ listError }}</v-alert>
                <v-list density="compact" class="py-0">
                    <v-list-item v-for="i in items" :key="i.proc_def_id + '/' + i.activity_id" :active="isActive(i)" color="primary" lines="three" @click="open(i)">
                        <v-list-item-title class="font-weight-medium">{{ i.config?.name || procName(i.proc_def_id) }}</v-list-item-title>
                        <v-list-item-subtitle>{{ procName(i.proc_def_id) }} › {{ actName(i.proc_def_id, i.activity_id) }}</v-list-item-subtitle>
                        <v-list-item-subtitle>
                            <v-icon size="12">mdi-database-outline</v-icon> {{ i.config?.history?.class }}
                            <span v-if="i.config?.history?.where && Object.keys(i.config.history.where).length">
                                · {{ Object.entries(i.config.history.where).map(([k, v]) => `${k}=${v}`).join(', ') }}
                            </span>
                        </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="current?.isNew" active color="primary">
                        <v-list-item-title class="font-weight-medium">(새 데이터셋)</v-list-item-title>
                    </v-list-item>
                </v-list>
                <div v-if="!listLoading && !items.length && !current?.isNew" class="pa-4 text-caption text-medium-emphasis">
                    아직 데이터셋이 없습니다. '새 데이터셋'으로 판단 단계에 데이터를 연결하세요.
                </div>
            </v-card>

            <!-- 편집 -->
            <v-card variant="outlined" class="dataset-editor">
                <div v-if="!cfg" class="empty-detail text-medium-emphasis">
                    <v-icon size="40" class="mb-2">mdi-table-cog</v-icon>
                    <div>왼쪽에서 데이터셋을 고르거나 새로 만드세요.</div>
                </div>
                <template v-else>
                    <div class="editor-head pa-4 pb-2 d-flex align-start ga-2 flex-wrap">
                        <div class="flex-grow-1">
                            <div class="text-caption text-medium-emphasis" v-if="!current?.isNew">
                                {{ procName(current!.proc_def_id) }} › {{ actName(current!.proc_def_id, current!.activity_id) }} — 이 단계의 에이전트가 근거로 사용
                            </div>
                            <div class="text-h6 font-weight-bold">{{ cfg.name || '새 데이터셋' }}</div>
                        </div>
                        <v-chip v-if="dirty" size="small" color="warning" variant="tonal">저장 안 됨</v-chip>
                        <v-btn size="small" variant="tonal" :loading="previewLoading" @click="runPreview">
                            <v-icon start size="16">mdi-play-circle-outline</v-icon>학습 실행(미리보기)
                        </v-btn>
                        <v-btn size="small" variant="text" :disabled="!dirty || !original" @click="revert">되돌리기</v-btn>
                        <v-btn size="small" color="primary" :loading="saving" :disabled="!dirty && !current?.isNew" @click="save">
                            <v-icon start size="16">mdi-content-save</v-icon>저장
                        </v-btn>
                        <v-btn v-if="!current?.isNew" size="small" variant="text" color="error" @click="confirmDelete = true">삭제</v-btn>
                    </div>

                    <div class="editor-body px-4 pb-4">
                        <v-alert v-if="check && !check.ok" type="error" variant="tonal" density="compact" class="mb-3">
                            <div v-for="(e, idx) in check.errors" :key="idx">· {{ e.message }}</div>
                        </v-alert>
                        <v-alert v-if="check?.warnings?.length" type="warning" variant="tonal" density="compact" class="mb-3">
                            <div v-for="(w, idx) in check.warnings" :key="idx">· {{ w.message }}</div>
                        </v-alert>

                        <!-- 1. 어디에 쓰나 -->
                        <section class="editor-section">
                            <div class="section-title">1. 사용 위치·이름</div>
                            <v-row dense>
                                <template v-if="current?.isNew">
                                    <v-col cols="12" md="6">
                                        <v-autocomplete
                                            v-model="current!.proc_def_id"
                                            :items="processes"
                                            item-title="name"
                                            item-value="id"
                                            label="프로세스"
                                            density="compact"
                                            hide-details="auto"
                                        />
                                    </v-col>
                                    <v-col cols="12" md="6">
                                        <v-select
                                            v-model="current!.activity_id"
                                            :items="[{ id: '', name: '(프로세스 전체)' }, ...newActivities]"
                                            item-title="name"
                                            item-value="id"
                                            label="판단 단계(활동)"
                                            density="compact"
                                            hide-details="auto"
                                            :disabled="!current?.proc_def_id"
                                        />
                                    </v-col>
                                </template>
                                <v-col cols="12" md="5">
                                    <v-text-field v-model="cfg.name" label="데이터셋 이름" density="compact" hide-details="auto" />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-text-field
                                        v-model="cfg.decision"
                                        label="판단 종류"
                                        hint="같은 판단 종류끼리 사람의 선택 사례·규칙을 함께 씁니다"
                                        density="compact"
                                        hide-details="auto"
                                        :error-messages="errs('decision')"
                                    />
                                </v-col>
                                <v-col cols="12" md="3">
                                    <v-text-field v-model="cfg.subject" label="대상(부위·품목)" density="compact" hide-details="auto" />
                                </v-col>
                            </v-row>
                        </section>

                        <!-- 2. 이력 원천 -->
                        <section class="editor-section">
                            <div class="section-title">2. 학습 데이터 (Ontology Studio)</div>
                            <v-row dense>
                                <v-col cols="12" md="7">
                                    <v-autocomplete
                                        v-model="cfg.history.class"
                                        :items="classOptions"
                                        label="이력 클래스"
                                        density="compact"
                                        hide-details="auto"
                                        :error-messages="errs('history.class')"
                                        @update:model-value="loadHistory"
                                    >
                                        <template #item="{ props: p, item }">
                                            <v-list-subheader v-if="(item.raw as any).type === 'subheader'">{{ (item.raw as any).title }}</v-list-subheader>
                                            <v-list-item v-else v-bind="p">
                                                <template #append>
                                                    <span class="text-caption text-medium-emphasis">{{ (item.raw as any).count?.toLocaleString() }}건</span>
                                                </template>
                                            </v-list-item>
                                        </template>
                                    </v-autocomplete>
                                </v-col>
                                <v-col cols="6" md="2">
                                    <v-text-field
                                        v-model.number="cfg.history.min_rows"
                                        type="number"
                                        label="최소 행 수"
                                        density="compact"
                                        hide-details="auto"
                                        :error-messages="errs('history.min_rows')"
                                    />
                                </v-col>
                                <v-col cols="6" md="3" v-if="current?.isNew" class="d-flex align-center">
                                    <v-btn size="small" variant="outlined" color="primary" block @click="makeDraft">
                                        <v-icon start size="16">mdi-auto-fix</v-icon>초안 만들기
                                    </v-btn>
                                </v-col>
                            </v-row>
                            <div class="d-flex flex-wrap align-center ga-2 mt-2">
                                <span class="text-caption text-medium-emphasis">필터</span>
                                <div v-for="(r, idx) in whereRows" :key="idx" class="d-flex align-center ga-1">
                                    <v-select v-model="r.key" :items="columns.map((c) => c.key)" density="compact" hide-details style="width: 160px" />
                                    <span>=</span>
                                    <v-text-field v-model="r.value" density="compact" hide-details style="width: 160px" @keyup.enter="applyWhere" />
                                    <v-btn icon size="x-small" variant="text" @click="whereRows.splice(idx, 1); applyWhere()"><v-icon size="16">mdi-close</v-icon></v-btn>
                                </div>
                                <v-btn size="x-small" variant="text" @click="whereRows.push({ key: '', value: '' })"><v-icon start size="14">mdi-plus</v-icon>조건</v-btn>
                                <v-btn size="x-small" variant="tonal" @click="applyWhere">적용</v-btn>
                            </div>
                            <div class="history-box mt-2">
                                <v-progress-linear v-if="historyLoading" indeterminate color="primary" />
                                <v-alert v-if="history?.error" type="warning" variant="tonal" density="compact">{{ history.error }}</v-alert>
                                <template v-else-if="history">
                                    <div class="text-caption mb-1">
                                        조건에 맞는 행 <b>{{ history.total.toLocaleString() }}</b>건
                                        <span v-if="history.total < (cfg.history.min_rows || 30)" class="text-error">
                                            — 최소 행 수({{ cfg.history.min_rows || 30 }})보다 적어 데이터 근거 판단 대신 사람의 선택 사례·질문으로 내려갑니다
                                        </span>
                                    </div>
                                    <div class="table-scroll">
                                        <table class="mini-table">
                                            <thead>
                                                <tr>
                                                    <th v-for="c in columns.slice(0, 12)" :key="c.key" :title="classProps[c.key] || c.key">
                                                        {{ c.key }}<span v-if="c.numeric" class="num-badge">#</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="(r, idx) in history.rows" :key="idx">
                                                    <td v-for="c in columns.slice(0, 12)" :key="c.key" :class="{ num: c.numeric }">{{ fmt(r[c.key]) }}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </template>
                            </div>
                        </section>

                        <!-- 3. 목표·특징 -->
                        <section class="editor-section">
                            <div class="section-title">3. 무엇을 예측하고, 무엇으로 설명하나</div>
                            <v-row dense>
                                <v-col cols="12" md="5">
                                    <v-select
                                        :model-value="cfg.target"
                                        :items="numericColumns.map((c) => ({ title: colLabel(c.key), value: c.key }))"
                                        label="예측 목표(수치)"
                                        density="compact"
                                        hide-details="auto"
                                        :error-messages="errs('target')"
                                        @update:model-value="setTarget"
                                    />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-text-field v-model="cfg.target_label" label="목표 이름(보고서 표기)" density="compact" hide-details="auto" />
                                </v-col>
                                <v-col cols="12" md="3">
                                    <v-text-field
                                        v-model.number="cfg.min_r2"
                                        type="number"
                                        step="0.05"
                                        label="최소 설명력(R²)"
                                        hint="이보다 낮으면 데이터 근거로 쓰지 않습니다"
                                        density="compact"
                                        hide-details="auto"
                                        :error-messages="errs('min_r2')"
                                    />
                                </v-col>
                            </v-row>
                            <div class="text-caption text-medium-emphasis mt-3 mb-1">
                                특징 — 견적 후보에도 있는 값(<v-icon size="12" color="success">mdi-check-circle</v-icon>)이어야 판단 때 예측에 쓰입니다.
                            </div>
                            <v-alert v-if="errs('features').length" type="error" variant="tonal" density="compact" class="mb-2">
                                {{ errs('features').join(' / ') }}
                            </v-alert>
                            <div class="feature-grid">
                                <div v-for="c in featureCandidates" :key="c.key" class="feature-row" :class="{ on: !!featureOf(c.key) }">
                                    <v-checkbox-btn :model-value="!!featureOf(c.key)" density="compact" @update:model-value="(v: any) => toggleFeature(c.key, v)" />
                                    <div class="feature-name">
                                        <div class="text-body-2">
                                            {{ c.key }}
                                            <v-icon v-if="OPTION_FIELDS.includes(c.key)" size="12" color="success" title="견적 후보에 있는 값">mdi-check-circle</v-icon>
                                        </div>
                                        <div class="text-caption text-medium-emphasis">{{ classProps[c.key] }}</div>
                                    </div>
                                    <template v-if="featureOf(c.key)">
                                        <v-text-field v-model="featureOf(c.key).label" density="compact" hide-details placeholder="보고서 표기" class="feature-label" />
                                        <v-checkbox
                                            :model-value="featureOf(c.key).kind === 'category'"
                                            label="범주"
                                            density="compact"
                                            hide-details
                                            @update:model-value="(v: any) => (featureOf(c.key).kind = v ? 'category' : undefined)"
                                        />
                                    </template>
                                </div>
                            </div>
                            <v-alert v-if="missingFeatures.length" type="warning" variant="tonal" density="compact" class="mt-2">
                                정의에 있지만 지금 이력에 없는 특징: {{ missingFeatures.map((f: any) => f.key).join(', ') }}
                                <v-btn size="x-small" variant="text" @click="cfg.features = cfg.features.filter((f: any) => !missingFeatures.includes(f))">빼기</v-btn>
                            </v-alert>
                        </section>

                        <!-- 4. 산식 -->
                        <section class="editor-section">
                            <div class="section-title">4. 판단 산식 (예측값으로 후보를 비교하는 식)</div>
                            <div class="text-caption text-medium-emphasis mb-2">
                                쓸 수 있는 이름: 예측값 <code>pred</code>, 아래 상수, 견적 값({{ OPTION_FIELDS.join(', ') }}). 사칙연산만.
                            </div>
                            <div class="d-flex flex-wrap ga-2 align-center mb-3">
                                <span class="text-caption text-medium-emphasis">상수</span>
                                <div v-for="(r, idx) in paramRows" :key="idx" class="d-flex align-center ga-1">
                                    <v-text-field v-model="r.key" density="compact" hide-details style="width: 130px" placeholder="이름" />
                                    <span>=</span>
                                    <v-text-field v-model="r.value" density="compact" hide-details style="width: 110px" placeholder="값" />
                                    <v-btn icon size="x-small" variant="text" @click="paramRows.splice(idx, 1)"><v-icon size="16">mdi-close</v-icon></v-btn>
                                </div>
                                <v-btn size="x-small" variant="text" @click="paramRows.push({ key: '', value: '' })"><v-icon start size="14">mdi-plus</v-icon>상수</v-btn>
                            </div>
                            <v-alert v-if="errs('params').length" type="error" variant="tonal" density="compact" class="mb-2">{{ errs('params').join(' / ') }}</v-alert>
                            <div v-for="(o, idx) in cfg.outputs" :key="idx" class="d-flex align-start ga-2 mb-2 flex-wrap">
                                <v-text-field v-model="o.key" label="키" density="compact" hide-details="auto" style="max-width: 140px" />
                                <v-text-field v-model="o.label" label="표기" density="compact" hide-details="auto" style="max-width: 180px" />
                                <v-text-field
                                    v-model="o.expr"
                                    label="산식"
                                    density="compact"
                                    hide-details="auto"
                                    class="flex-grow-1 expr-field"
                                    :error-messages="errs(`outputs[${idx}]`)"
                                />
                                <v-btn icon size="small" variant="text" @click="cfg.outputs.splice(idx, 1)"><v-icon size="18">mdi-delete-outline</v-icon></v-btn>
                            </div>
                            <v-btn size="x-small" variant="text" @click="cfg.outputs.push({ key: '', label: '', expr: '' })"><v-icon start size="14">mdi-plus</v-icon>산출 항목</v-btn>
                            <v-row dense class="mt-2">
                                <v-col cols="12" md="6">
                                    <v-select
                                        v-model="cfg.objective"
                                        :items="objectiveOptions"
                                        label="최종 비교 기준(가장 큰 후보를 고름)"
                                        density="compact"
                                        hide-details="auto"
                                        :error-messages="errs('objective')"
                                    />
                                </v-col>
                            </v-row>
                        </section>

                        <!-- 5. 선호 학습 -->
                        <section class="editor-section">
                            <div class="section-title">5. 데이터가 없을 때 — 사람의 선택에서 배우기</div>
                            <v-row dense>
                                <v-col cols="12" md="8">
                                    <v-select
                                        v-model="cfg.preference.features"
                                        :items="OPTION_FIELDS"
                                        label="선호 학습 특징"
                                        multiple
                                        chips
                                        closable-chips
                                        density="compact"
                                        hide-details="auto"
                                        :error-messages="errs('preference.features')"
                                    />
                                </v-col>
                                <v-col cols="12" md="4">
                                    <v-text-field
                                        v-model.number="cfg.preference.min_cases"
                                        type="number"
                                        label="학습에 필요한 선택 사례 수"
                                        density="compact"
                                        hide-details="auto"
                                    />
                                </v-col>
                            </v-row>
                        </section>

                        <!-- 미리보기 결과 -->
                        <section v-if="preview || previewLoading" class="editor-section preview-section">
                            <div class="section-title">학습 실행 결과 <span class="text-caption text-medium-emphasis">(저장 전 정의 기준 · 저장되지 않음)</span></div>
                            <v-progress-linear v-if="previewLoading" indeterminate color="primary" />
                            <template v-else-if="preview">
                                <v-alert v-if="preview.history?.error" type="warning" variant="tonal" density="compact">{{ preview.history.error }}</v-alert>
                                <v-alert v-else-if="preview.check && !preview.check.ok" type="error" variant="tonal" density="compact">
                                    정의에 오류가 있어 학습하지 않았습니다(위 오류 목록 참고).
                                </v-alert>
                                <v-alert v-else-if="preview.model?.error" type="error" variant="tonal" density="compact">{{ preview.model.error }}</v-alert>
                                <v-alert v-else-if="preview.model?.insufficient" type="info" variant="tonal" density="compact">
                                    학습 데이터가 {{ preview.model.rows }}건으로 최소 행 수({{ preview.model.min_rows }})보다 적습니다. 판단 때는 사람의 선택 사례 학습 → 질문 순으로 내려갑니다.
                                </v-alert>
                                <div v-else-if="preview.model" class="model-result">
                                    <div class="d-flex flex-wrap ga-8 mb-3">
                                        <div><div class="text-caption text-medium-emphasis">학습 행</div><div class="text-h6">{{ preview.model.rows }}</div></div>
                                        <div><div class="text-caption text-medium-emphasis">최고 모델</div><div class="text-h6">{{ preview.model.best_model }}</div></div>
                                        <div>
                                            <div class="text-caption text-medium-emphasis">교차검증 R²</div>
                                            <div class="text-h6" :class="preview.model.cv_r2 >= (cfg.min_r2 ?? 0.5) ? 'text-success' : 'text-error'">
                                                {{ Number(preview.model.cv_r2).toFixed(3) }}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-caption text-medium-emphasis">설명 산식</div>
                                    <div class="formula mb-2">{{ preview.model.formula }}</div>
                                    <table class="mini-table">
                                        <thead><tr><th>순위</th><th>모델</th><th class="num">CV R²</th><th class="num">MAE</th></tr></thead>
                                        <tbody>
                                            <tr v-for="(b, idx) in (preview.model.leaderboard || []).slice(0, 5)" :key="idx">
                                                <td>{{ idx + 1 }}</td>
                                                <td>{{ b.model }}</td>
                                                <td class="num">{{ b.cv_r2 != null ? Number(b.cv_r2).toFixed(3) : '' }}</td>
                                                <td class="num">{{ b.cv_mae != null ? Number(b.cv_mae).toFixed(1) : '' }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div v-if="preview.model.cv_r2 < (cfg.min_r2 ?? 0.5)" class="text-caption text-error mt-1">
                                        최소 설명력보다 낮아 이 정의로는 데이터 근거 판단을 하지 않습니다.
                                    </div>
                                </div>
                            </template>
                        </section>
                    </div>
                </template>
            </v-card>
        </div>

        <v-dialog v-model="confirmDelete" max-width="420">
            <v-card>
                <v-card-title>데이터셋 삭제</v-card-title>
                <v-card-text>이 판단 단계의 데이터 근거 설정을 지웁니다. 에이전트는 이후 전략·KPI 기준만으로 판단합니다. Studio 데이터는 지우지 않습니다.</v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="confirmDelete = false">취소</v-btn>
                    <v-btn color="error" @click="remove">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <v-snackbar v-model="snack.show" :color="snack.color" timeout="3500">{{ snack.text }}</v-snackbar>
    </div>
</template>

<style scoped>
.dataset-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 12px;
    min-height: 420px;
}
.dataset-list {
    overflow-y: auto;
    max-height: calc(100vh - 272px);
}
.dataset-editor {
    min-width: 0;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 272px);
}
.editor-head {
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.editor-body {
    overflow-y: auto;
    padding-top: 12px;
}
.empty-detail {
    min-height: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.editor-section {
    padding: 12px 0;
    border-bottom: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
}
.editor-section:last-child {
    border-bottom: none;
}
.section-title {
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 16px;
}
.history-box {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 6px;
    padding: 8px;
}
.table-scroll {
    overflow-x: auto;
}
.mini-table {
    border-collapse: collapse;
    font-size: 12px;
    width: 100%;
}
.mini-table th,
.mini-table td {
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 4px 8px;
    text-align: left;
    white-space: nowrap;
}
.mini-table th {
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.mini-table th.num,
.mini-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
}
.num-badge {
    margin-left: 2px;
    font-size: 10px;
    color: rgb(var(--v-theme-primary));
}
.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 4px 12px;
}
.feature-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    border-radius: 6px;
}
.feature-row.on {
    background: rgba(var(--v-theme-primary), 0.06);
}
.feature-row :deep(.v-selection-control) {
    flex: 0 0 auto;
}
.feature-name {
    min-width: 120px;
    flex: 1;
}
.feature-label {
    max-width: 150px;
}
.expr-field :deep(input) {
    font-family: ui-monospace, monospace;
    font-size: 13px;
}
.formula {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    background: rgba(var(--v-theme-on-surface), 0.04);
    border-radius: 4px;
    padding: 6px 8px;
    word-break: break-all;
}
@media (max-width: 900px) {
    .dataset-layout {
        grid-template-columns: 1fr;
    }
}
</style>
