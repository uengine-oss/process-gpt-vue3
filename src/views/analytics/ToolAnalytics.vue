<template>
    <div class="pa-4">
        <div class="d-flex align-center mb-4">
            <div>
                <h2 class="text-h6 mb-1">{{ $t('toolAnalytics.title') }}</h2>
                <div class="text-caption text-medium-emphasis">
                    {{ $t('toolAnalytics.subtitle') }}
                </div>
            </div>
            <v-spacer />
            <v-btn variant="text" size="small" :loading="loading" @click="load">
                <v-icon start>mdi-refresh</v-icon>{{ $t('toolAnalytics.reload') }}
            </v-btn>
        </div>

        <!-- 커버리지: 축마다 데이터가 얼마나 붙어 있는지 먼저 밝힌다 -->
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

        <v-alert v-if="coverageWarning" type="info" variant="tonal"
                 density="compact" class="mb-4">
            {{ coverageWarning }}
        </v-alert>

        <!-- 축 선택 -->
        <v-card variant="outlined" class="mb-4">
            <div class="pa-4 d-flex flex-wrap ga-4 align-center">
                <v-select v-model="rowDim" :items="dimItems" :label="$t('toolAnalytics.rowDim')"
                          density="compact" variant="outlined" hide-details
                          style="max-width: 210px" @update:model-value="runPivot" />
                <v-icon>mdi-close</v-icon>
                <v-select v-model="colDim" :items="colItems" :label="$t('toolAnalytics.colDim')"
                          density="compact" variant="outlined" hide-details clearable
                          style="max-width: 210px" @update:model-value="runPivot" />
                <v-select v-model="measure" :items="measureItems" :label="$t('toolAnalytics.measure')"
                          density="compact" variant="outlined" hide-details
                          style="max-width: 200px" @update:model-value="runPivot" />
                <v-chip v-if="dimNote" size="small" variant="tonal">{{ dimNote }}</v-chip>
            </div>
        </v-card>

        <!-- 교차표 -->
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
                            <th v-if="additive" class="total">{{ $t('toolAnalytics.total') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="r in matrix.rows" :key="r">
                            <th class="rowhead">{{ r }}</th>
                            <td v-for="c in matrix.cols" :key="c"
                                :style="cellStyle(matrix.get(r, c))">
                                {{ fmt(matrix.get(r, c)) }}
                            </td>
                            <td v-if="additive" class="total">{{ fmt(matrix.rowTotal(r)) }}</td>
                        </tr>
                        <tr v-if="additive" class="foot">
                            <th class="rowhead">{{ $t('toolAnalytics.total') }}</th>
                            <td v-for="c in matrix.cols" :key="c">{{ fmt(matrix.colTotal(c)) }}</td>
                            <td class="total">{{ fmt(matrix.grand()) }}</td>
                        </tr>
                    </tbody>
                </table>
                <div v-else class="pa-6 text-center text-medium-emphasis">
                    {{ $t('toolAnalytics.noData') }}
                </div>
            </div>
        </v-card>

        <!-- 요약 -->
        <v-row dense>
            <v-col cols="12" md="7">
                <v-card variant="outlined" height="100%">
                    <v-card-title class="text-subtitle-1">{{ $t('toolAnalytics.toolStatus') }}</v-card-title>
                    <v-divider />
                    <v-data-table :headers="toolHeaders" :items="summary?.top_tools ?? []"
                                  density="compact" items-per-page="10">
                        <template #item.error_rate="{ item }">
                            <span :class="{ 'text-error': Number(item.error_rate) > 0 }">
                                {{ item.error_rate }}%
                            </span>
                        </template>
                    </v-data-table>
                </v-card>
            </v-col>
            <v-col cols="12" md="5">
                <v-card variant="outlined" height="100%">
                    <v-card-title class="text-subtitle-1">{{ $t('toolAnalytics.deptToolTop') }}</v-card-title>
                    <v-divider />
                    <v-data-table :headers="deptHeaders" :items="summary?.by_department ?? []"
                                  density="compact" items-per-page="10" />
                </v-card>
            </v-col>
        </v-row>

        <v-snackbar v-model="snack.open" :color="snack.color" timeout="4000">
            {{ snack.text }}
        </v-snackbar>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { timelineApi } from '@/services/analyticsApi';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const meta = ref<any>(null);
const summary = ref<any>(null);
const pivotData = ref<any>(null);
const loading = ref(false);
const snack = ref({ open: false, text: '', color: 'error' });

const rowDim = ref('tool');
const colDim = ref<string | null>('exec_dept');
const measure = ref('calls');

const dimItems = computed(() =>
    (meta.value?.dimensions ?? []).map((d: any) => ({ title: d.label, value: d.key })));
// 행과 같은 차원을 열에 두면 의미 없는 대각선 표가 된다.
const colItems = computed(() => dimItems.value.filter((d: any) => d.value !== rowDim.value));
const measureItems = computed(() =>
    (meta.value?.measures ?? []).map((m: any) => ({ title: m.label, value: m.key })));

const labelOf = (key: string | null) =>
    (meta.value?.dimensions ?? []).find((d: any) => d.key === key)?.label ?? key ?? '';
// 제목도 응답 기준이어야 표와 어긋나지 않는다.
const shownRow = computed(() => pivotData.value?.rows?.[0] ?? rowDim.value);
const shownCol = computed(() => pivotData.value?.cols?.[0] ?? null);
const rowLabel = computed(() => labelOf(shownRow.value));
const colLabel = computed(() => labelOf(shownCol.value));
// 비율·평균·중복제거 카운트는 셀을 더할 수 없다. 더하면 실패율 합계가
// 109.6% 처럼 나온다. 그런 측정값에서는 합계 행/열을 아예 숨긴다.
const shownMeasure = computed(() => pivotData.value?.measures?.[0] ?? measure.value);
const additive = computed(() =>
    (meta.value?.measures ?? []).find((m: any) => m.key === shownMeasure.value)?.additive !== false);

const measureLabel = computed(() =>
    (meta.value?.measures ?? []).find((m: any) => m.key === shownMeasure.value)?.label ?? '');
const dimNote = computed(() =>
    (meta.value?.dimensions ?? []).find((d: any) => d.key === colDim.value)?.note || '');

const coverageCards = computed(() => {
    const c = meta.value?.coverage;
    if (!c) return [];
    const pct = (n: number) => c.total_calls ? `${Math.round(100 * n / c.total_calls)}%` : '-';
    return [
        { label: t('toolAnalytics.coverage.toolCalls'), value: c.total_calls?.toLocaleString() ?? '-' },
        { label: t('toolAnalytics.coverage.withProcess'), value: pct(c.with_process), sub: t('toolAnalytics.coverage.count', { n: c.with_process }) },
        { label: t('toolAnalytics.coverage.withActivity'), value: pct(c.with_activity), sub: t('toolAnalytics.coverage.count', { n: c.with_activity }) },
        { label: t('toolAnalytics.coverage.withDepartment'), value: pct(c.with_department), sub: t('toolAnalytics.coverage.count', { n: c.with_department }) }
    ];
});

// 귀속되지 않은 호출이 많으면 "(미상)" 이 크게 나온다. 표를 보기 전에 알린다.
const coverageWarning = computed(() => {
    const c = meta.value?.coverage;
    if (!c?.total_calls) return '';
    const miss = c.total_calls - c.with_process;
    if (miss <= 0) return '';
    const pct = Math.round(100 * miss / c.total_calls);
    return t('toolAnalytics.coverageWarning', { miss, pct });
});

/** 레코드 배열을 행×열 행렬로. 열 차원이 없으면 단일 열로 처리한다. */
const matrix = computed(() => {
    const recs = pivotData.value?.records ?? [];
    // 선택값이 아니라 응답에 실린 차원을 쓴다. 요청이 실패하거나 아직
    // 돌아오지 않았을 때 새 제목 + 옛 열값이 섞이는 것을 막는다.
    const rKey = pivotData.value?.rows?.[0] ?? rowDim.value;
    const cKey = pivotData.value?.cols?.[0] ?? null;
    const m = new Map<string, Map<string, number>>();
    const cols: string[] = cKey ? (pivotData.value?.col_values ?? []) : [t('toolAnalytics.valueCol')];
    void colDim.value;   // 선택이 바뀌면 재계산되도록

    for (const rec of recs) {
        const r = String(rec[rKey] ?? t('toolAnalytics.unknown'));
        const c = cKey ? String(rec[cKey] ?? t('toolAnalytics.unknown')) : t('toolAnalytics.valueCol');
        if (!m.has(r)) m.set(r, new Map());
        m.get(r)!.set(c, Number(rec[shownMeasure.value] ?? 0));
    }
    const rows = [...m.keys()];
    const get = (r: string, c: string) => m.get(r)?.get(c) ?? 0;
    const rowTotal = (r: string) => cols.reduce((a, c) => a + get(r, c), 0);
    const colTotal = (c: string) => rows.reduce((a, r) => a + get(r, c), 0);
    const grand = () => rows.reduce((a, r) => a + rowTotal(r), 0);
    // 합계 큰 행이 위로
    // 비가산 측정값은 합계로 정렬하면 의미가 없으므로 최댓값 기준으로 세운다.
    const rank = additive.value
        ? rowTotal
        : (r: string) => Math.max(...cols.map((c) => get(r, c)));
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
    // 값이 클수록 진하게 — 히트맵으로 쏠림이 바로 보이게
    const a = 0.08 + 0.5 * (v / maxCell.value);
    return { background: `rgba(29, 111, 139, ${a.toFixed(3)})` };
}

const fmt = (v: number) => {
    if (v === 0) return '·';
    // 비율 측정값은 소수 한 자리까지
    return shownMeasure.value.includes('rate') || shownMeasure.value.includes('ms')
        ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
        : Number(v).toLocaleString();
};

const toolHeaders = computed(() => [
    { title: t('toolAnalytics.toolHeaders.tool'), key: 'tool' },
    { title: t('toolAnalytics.toolHeaders.server'), key: 'server' },
    { title: t('toolAnalytics.toolHeaders.providerDept'), key: 'provider_dept' },
    { title: t('toolAnalytics.toolHeaders.calls'), key: 'calls', align: 'end' as const },
    { title: t('toolAnalytics.toolHeaders.errorRate'), key: 'error_rate', align: 'end' as const },
    { title: t('toolAnalytics.toolHeaders.avgMs'), key: 'avg_ms', align: 'end' as const },
    { title: t('toolAnalytics.toolHeaders.processes'), key: 'processes', align: 'end' as const }
]);
const deptHeaders = computed(() => [
    { title: t('toolAnalytics.deptHeaders.department'), key: 'department' },
    { title: t('toolAnalytics.deptHeaders.tool'), key: 'tool' },
    { title: t('toolAnalytics.deptHeaders.calls'), key: 'calls', align: 'end' as const }
]);

async function runPivot() {
    try {
        pivotData.value = await timelineApi.getToolPivot({
            rows: [rowDim.value],
            cols: colDim.value ? [colDim.value] : [],
            measures: [measure.value]
        });
    } catch (e: any) {
        // 실패하면 옛 표를 남기지 않는다 — 새 축 제목에 옛 값이 붙어
        // 있는 것보다 비어 있는 편이 낫다.
        pivotData.value = null;
        snack.value = { open: true, color: 'error',
                        text: e?.response?.data?.detail || e.message };
    }
}

async function load() {
    loading.value = true;
    try {
        const [m, s] = await Promise.all([
            timelineApi.getToolMeta(),
            timelineApi.getToolSummary(10)
        ]);
        meta.value = m;
        summary.value = s;
        await runPivot();
    } catch (e: any) {
        snack.value = { open: true, color: 'error', text: t('toolAnalytics.loadFailed', { message: e.message }) };
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
    padding: 6px 10px;
    white-space: nowrap;
}
.xtab thead th { background: rgba(120, 120, 120, 0.08); font-weight: 600; text-align: center; }
.xtab td { text-align: right; font-variant-numeric: tabular-nums; }
.xtab .rowhead, .xtab .corner { text-align: left; font-weight: 500; }
.xtab .total { font-weight: 600; background: rgba(120, 120, 120, 0.06); }
.xtab tr.foot th, .xtab tr.foot td { font-weight: 600; background: rgba(120, 120, 120, 0.06); }
</style>
