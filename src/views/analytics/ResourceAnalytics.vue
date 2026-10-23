<template>
    <div class="pa-4">
        <div class="d-flex align-center mb-4">
            <div>
                <h2 class="text-h6 mb-1">{{ $t('resourceAnalytics.title') }}</h2>
                <div class="text-caption text-medium-emphasis">
                    {{ $t('resourceAnalytics.subtitle') }}
                </div>
            </div>
            <v-spacer />
            <v-btn variant="text" size="small" :loading="loading" @click="load">
                <v-icon start>mdi-refresh</v-icon>{{ $t('resourceAnalytics.reload') }}
            </v-btn>
        </div>

        <v-row class="mb-1" dense>
            <v-col v-for="c in coverageCards" :key="c.label" cols="6" md="3">
                <v-card variant="outlined">
                    <div class="pa-3">
                        <div class="text-caption text-medium-emphasis">{{ c.label }}</div>
                        <div class="text-h6">{{ c.value }}</div>
                        <div v-if="c.sub" class="text-caption text-medium-emphasis">{{ c.sub }}</div>
                    </div>
                </v-card>
            </v-col>
        </v-row>

        <v-alert v-if="durationWarning" type="warning" variant="tonal"
                 density="compact" class="mb-4">
            {{ durationWarning }}
        </v-alert>

        <!-- 필터 -->
        <v-card variant="outlined" class="mb-3">
            <div class="pa-4">
                <div class="d-flex align-center mb-2">
                    <v-icon size="18" class="mr-2">mdi-filter-variant</v-icon>
                    <span class="text-subtitle-2">{{ $t('resourceAnalytics.filter') }}</span>
                    <v-spacer />
                    <v-btn v-if="activeFilterCount" size="x-small" variant="text"
                           @click="clearFilters">
                        {{ $t('resourceAnalytics.clearAll', { n: activeFilterCount }) }}
                    </v-btn>
                </div>
                <div class="d-flex flex-wrap ga-3">
                    <v-select
                        v-for="fd in filterDims"
                        :key="fd.key"
                        v-model="filters[fd.key]"
                        :items="valueItems[fd.key] ?? []"
                        :label="fd.label"
                        multiple chips closable-chips
                        density="compact" variant="outlined" hide-details
                        style="min-width: 230px; max-width: 320px"
                        @update:model-value="refresh"
                        @update:menu="(o: boolean) => o && loadValues(fd.key)"
                    >
                        <template #chip="{ props: cp, item }">
                            <v-chip v-bind="cp" size="x-small" :text="item.title" />
                        </template>
                    </v-select>
                </div>
            </div>
        </v-card>

        <!-- 축 -->
        <v-card variant="outlined" class="mb-4">
            <div class="pa-4 d-flex flex-wrap ga-4 align-center">
                <v-select v-model="rowDim" :items="dimItems" :label="$t('resourceAnalytics.rowDim')"
                          density="compact" variant="outlined" hide-details
                          style="max-width: 220px" @update:model-value="refresh" />
                <v-icon>mdi-close</v-icon>
                <v-select v-model="colDim" :items="colItems" :label="$t('resourceAnalytics.colDim')"
                          density="compact" variant="outlined" hide-details clearable
                          style="max-width: 220px" @update:model-value="refresh" />
                <v-select v-model="measure" :items="measureItems" :label="$t('resourceAnalytics.measure')"
                          density="compact" variant="outlined" hide-details
                          style="max-width: 230px" @update:model-value="refresh" />
            </div>
            <div v-if="measureNote" class="px-4 pb-3">
                <v-alert type="info" variant="tonal" density="compact" class="text-caption">
                    {{ measureNote }}
                </v-alert>
            </div>
        </v-card>

        <v-card variant="outlined" class="mb-4">
            <v-card-title class="text-subtitle-1">
                {{ rowLabel }}<span v-if="shownCol"> × {{ colLabel }}</span> — {{ measureLabel }}
            </v-card-title>
            <v-divider />
            <div class="pa-3 table-scroll">
                <table v-if="matrix.rows.length" class="xtab">
                    <thead>
                        <tr>
                            <th class="corner">{{ rowLabel }}</th>
                            <th v-for="c in matrix.cols" :key="c">{{ c }}</th>
                            <th v-if="additive" class="total">{{ $t('resourceAnalytics.total') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in matrix.rows" :key="r">
                            <th class="rowhead">{{ r }}</th>
                            <td v-for="c in matrix.cols" :key="c" :style="cellStyle(matrix.get(r, c))">
                                {{ fmt(matrix.get(r, c)) }}
                            </td>
                            <td v-if="additive" class="total">{{ fmt(matrix.rowTotal(r)) }}</td>
                        </tr>
                        <tr v-if="additive" class="foot">
                            <th class="rowhead">{{ $t('resourceAnalytics.total') }}</th>
                            <td v-for="c in matrix.cols" :key="c">{{ fmt(matrix.colTotal(c)) }}</td>
                            <td class="total">{{ fmt(matrix.grand()) }}</td>
                        </tr>
                    </tbody>
                </table>
                <div v-else class="pa-6 text-center text-medium-emphasis">
                    {{ $t('resourceAnalytics.noData') }}
                </div>
            </div>
        </v-card>

        <v-row dense>
            <v-col cols="12" md="7">
                <v-card variant="outlined" height="100%">
                    <v-card-title class="text-subtitle-1">{{ $t('resourceAnalytics.topTitle') }}</v-card-title>
                    <v-divider />
                    <v-data-table :headers="topHeaders" :items="summary?.top ?? []"
                                  density="compact" items-per-page="10">
                        <template #item.actor_kind="{ item }">
                            <v-chip size="x-small" variant="tonal"
                                    :color="item.actor_kind === '에이전트' ? 'info' : undefined">
                                {{ item.actor_kind }}
                            </v-chip>
                        </template>
                        <template #item.rework_rate="{ item }">
                            <span :class="{ 'text-error': Number(item.rework_rate) > 0 }">
                                {{ item.rework_rate }}%
                            </span>
                        </template>
                    </v-data-table>
                </v-card>
            </v-col>
            <v-col cols="12" md="5">
                <v-card variant="outlined" height="100%">
                    <v-card-title class="text-subtitle-1">{{ $t('resourceAnalytics.reworkTitle') }}</v-card-title>
                    <v-divider />
                    <v-data-table :headers="reworkHeaders" :items="summary?.by_b ?? []"
                                  density="compact" items-per-page="10">
                        <template #no-data>
                            <div class="pa-6 text-center text-medium-emphasis">
                                {{ $t('resourceAnalytics.noRework') }}
                            </div>
                        </template>
                    </v-data-table>
                </v-card>
            </v-col>
        </v-row>

        <v-snackbar v-model="snack.open" :color="snack.color" timeout="4000">
            {{ snack.text }}
        </v-snackbar>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { timelineApi } from '@/services/analyticsApi';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const CUBE = 'resource';
// 필터로 노출할 차원. 값이 너무 많은 차원(담당자/액티비티/일자)은 뺀다.
const FILTER_DIMS = ['actor_kind', 'department', 'process', 'status', 'agent_mode'];

const meta = ref<any>(null);
const summary = ref<any>(null);
const pivotData = ref<any>(null);
const loading = ref(false);
const snack = ref({ open: false, text: '', color: 'error' });

const rowDim = ref('resource');
const colDim = ref<string | null>('process');
const measure = ref('tasks');

const filters = reactive<Record<string, string[]>>({});
const valueItems = reactive<Record<string, { title: string; value: string }[]>>({});

const dimItems = computed(() =>
    (meta.value?.dimensions ?? []).map((d: any) => ({ title: d.label, value: d.key })));
const colItems = computed(() => dimItems.value.filter((d: any) => d.value !== rowDim.value));
const measureItems = computed(() =>
    (meta.value?.measures ?? []).map((m: any) => ({ title: m.label, value: m.key })));
const filterDims = computed(() =>
    (meta.value?.dimensions ?? []).filter((d: any) => FILTER_DIMS.includes(d.key)));

const activeFilters = computed(() => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(filters)) if (v?.length) out[k] = v;
    return out;
});
const activeFilterCount = computed(() =>
    Object.values(activeFilters.value).reduce((a, v) => a + v.length, 0));

const labelOf = (key: string | null) =>
    (meta.value?.dimensions ?? []).find((d: any) => d.key === key)?.label ?? key ?? '';

// 표는 선택값이 아니라 응답 스냅샷 기준으로 그린다. 요청이 실패하거나 아직
// 돌아오지 않았을 때 새 제목 + 옛 열값이 섞이는 것을 막는다.
const shownRow = computed(() => pivotData.value?.rows?.[0] ?? rowDim.value);
const shownCol = computed(() => pivotData.value?.cols?.[0] ?? null);
const shownMeasure = computed(() => pivotData.value?.measures?.[0] ?? measure.value);
const rowLabel = computed(() => labelOf(shownRow.value));
const colLabel = computed(() => labelOf(shownCol.value));
const measureLabel = computed(() =>
    (meta.value?.measures ?? []).find((m: any) => m.key === shownMeasure.value)?.label ?? '');
const measureNote = computed(() =>
    (meta.value?.measures ?? []).find((m: any) => m.key === measure.value)?.note || '');
const additive = computed(() =>
    (meta.value?.measures ?? []).find((m: any) => m.key === shownMeasure.value)?.additive !== false);

const coverageCards = computed(() => {
    const c = meta.value?.coverage;
    if (!c) return [];
    const pct = (n: number) => c.total_tasks ? `${Math.round(100 * n / c.total_tasks)}%` : '-';
    return [
        { label: t('resourceAnalytics.coverage.tasks'), value: c.total_tasks?.toLocaleString() ?? '-' },
        { label: t('resourceAnalytics.coverage.withResource'), value: pct(c.with_resource), sub: t('resourceAnalytics.coverage.count', { n: c.with_resource }) },
        { label: t('resourceAnalytics.coverage.withDepartment'), value: pct(c.with_department), sub: t('resourceAnalytics.coverage.count', { n: c.with_department }) },
        { label: t('resourceAnalytics.coverage.withSegments'), value: pct(c.with_segments), sub: t('resourceAnalytics.coverage.count', { n: c.with_segments }) }
    ];
});

// duration_sec 는 todolist.end_date 기반이라 음수가 0 으로 눌린다.
// 그 비율이 크면 "평균 소요" 를 그대로 읽으면 안 된다.
const durationWarning = computed(() => {
    const c = meta.value?.coverage;
    if (!c?.with_duration || !c?.duration_zeroed) return '';
    const pct = Math.round(100 * c.duration_zeroed / c.with_duration);
    if (pct < 10) return '';
    return t('resourceAnalytics.durationWarning',
             { total: c.with_duration, zeroed: c.duration_zeroed, pct });
});

const matrix = computed(() => {
    const recs = pivotData.value?.records ?? [];
    const rKey = pivotData.value?.rows?.[0] ?? rowDim.value;
    const cKey = pivotData.value?.cols?.[0] ?? null;
    const m = new Map<string, Map<string, number>>();
    const cols: string[] = cKey ? (pivotData.value?.col_values ?? []) : [t('resourceAnalytics.valueCol')];
    for (const rec of recs) {
        const r = String(rec[rKey] ?? t('resourceAnalytics.unknown'));
        const c = cKey ? String(rec[cKey] ?? t('resourceAnalytics.unknown')) : t('resourceAnalytics.valueCol');
        if (!m.has(r)) m.set(r, new Map());
        m.get(r)!.set(c, Number(rec[shownMeasure.value] ?? 0));
    }
    const rows = [...m.keys()];
    const get = (r: string, c: string) => m.get(r)?.get(c) ?? 0;
    const rowTotal = (r: string) => cols.reduce((a, c) => a + get(r, c), 0);
    const colTotal = (c: string) => rows.reduce((a, r) => a + get(r, c), 0);
    const grand = () => rows.reduce((a, r) => a + rowTotal(r), 0);
    const rank = additive.value ? rowTotal : (r: string) => Math.max(...cols.map((c) => get(r, c)));
    rows.sort((a, b) => rank(b) - rank(a));
    return { rows, cols, get, rowTotal, colTotal, grand };
});

const maxCell = computed(() => {
    let mx = 0;
    for (const r of matrix.value.rows)
        for (const c of matrix.value.cols) mx = Math.max(mx, matrix.value.get(r, c));
    return mx || 1;
});
function cellStyle(v: number) {
    if (!v) return {};
    const a = 0.08 + 0.5 * (v / maxCell.value);
    return { background: `rgba(29, 111, 139, ${a.toFixed(3)})` };
}
const fmt = (v: number) => {
    if (!v) return '·';
    return shownMeasure.value.includes('rate')
        ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
        : Number(v).toLocaleString();
};

const topHeaders = computed(() => [
    { title: t('resourceAnalytics.topHeaders.resource'), key: 'resource' },
    { title: t('resourceAnalytics.topHeaders.actorKind'), key: 'actor_kind' },
    { title: t('resourceAnalytics.topHeaders.department'), key: 'department' },
    { title: t('resourceAnalytics.topHeaders.tasks'), key: 'tasks', align: 'end' as const },
    { title: t('resourceAnalytics.topHeaders.reworkTasks'), key: 'rework_tasks', align: 'end' as const },
    { title: t('resourceAnalytics.topHeaders.reworkRate'), key: 'rework_rate', align: 'end' as const },
    { title: t('resourceAnalytics.topHeaders.retries'), key: 'retries', align: 'end' as const },
    { title: t('resourceAnalytics.topHeaders.processes'), key: 'processes', align: 'end' as const }
]);
const reworkHeaders = computed(() => [
    { title: t('resourceAnalytics.reworkHeaders.resource'), key: 'resource' },
    { title: t('resourceAnalytics.reworkHeaders.process'), key: 'process' },
    { title: t('resourceAnalytics.reworkHeaders.reworkTasks'), key: 'rework_tasks', align: 'end' as const },
    { title: t('resourceAnalytics.reworkHeaders.retries'), key: 'retries', align: 'end' as const }
]);

async function loadValues(dim: string) {
    if (valueItems[dim]) return;   // 한 번만 읽는다
    try {
        const r = await timelineApi.getCubeValues(CUBE, dim);
        valueItems[dim] = (r.values ?? []).map((v: any) => ({
            title: `${v.value} (${v.n})`, value: v.value
        }));
    } catch { /* 값 목록 실패는 조용히 넘긴다 — 필터만 못 쓸 뿐이다 */ }
}

function clearFilters() {
    for (const k of Object.keys(filters)) filters[k] = [];
    refresh();
}

async function refresh() {
    try {
        const body = {
            rows: [rowDim.value],
            cols: colDim.value ? [colDim.value] : [],
            measures: [measure.value],
            filters: activeFilters.value
        };
        const [p, s] = await Promise.all([
            timelineApi.getCubePivot(CUBE, body),
            timelineApi.getCubeSummary(CUBE, { filters: activeFilters.value, limit: 10 })
        ]);
        pivotData.value = p;
        summary.value = s;
    } catch (e: any) {
        pivotData.value = null;
        snack.value = { open: true, color: 'error',
                        text: e?.response?.data?.detail || e.message };
    }
}

async function load() {
    loading.value = true;
    try {
        meta.value = await timelineApi.getCubeMeta(CUBE);
        await Promise.all(FILTER_DIMS.map(loadValues));
        await refresh();
    } catch (e: any) {
        snack.value = { open: true, color: 'error', text: t('resourceAnalytics.loadFailed', { message: e.message }) };
    } finally {
        loading.value = false;
    }
}
onMounted(load);
</script>

<style scoped>
.table-scroll { overflow-x: auto; }
.xtab { border-collapse: collapse; width: 100%; font-size: 13px; }
.xtab th, .xtab td {
    border: 1px solid rgba(120, 120, 120, 0.18);
    padding: 6px 10px; white-space: nowrap;
}
.xtab thead th { background: rgba(120, 120, 120, 0.08); font-weight: 600; text-align: center; }
.xtab td { text-align: right; font-variant-numeric: tabular-nums; }
.xtab .rowhead, .xtab .corner { text-align: left; font-weight: 500; }
.xtab .total { font-weight: 600; background: rgba(120, 120, 120, 0.06); }
.xtab tr.foot th, .xtab tr.foot td { font-weight: 600; background: rgba(120, 120, 120, 0.06); }
</style>
