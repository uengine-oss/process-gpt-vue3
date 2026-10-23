<template>
    <v-container fluid class="pa-6">
        <div class="d-flex align-center mb-4 flex-wrap ga-2">
            <v-btn icon="mdi-arrow-left" variant="text" to="/analytics" />
            <div class="flex-grow-1" style="min-width: 0">
                <h2 class="text-h5 font-weight-bold mb-1 text-truncate">
                    {{ summary?.name || $t('instanceProfiler.title') }}
                </h2>
                <div class="text-body-2 text-medium-emphasis mono text-truncate">
                    {{ procInstId }}
                </div>
            </div>
            <v-btn variant="tonal" prepend-icon="mdi-refresh" :loading="loading" @click="load">
                {{ $t('instanceProfiler.refresh') }}
            </v-btn>
        </div>

        <!-- 요약 -->
        <v-row dense class="mb-2">
            <v-col v-for="k in kpis" :key="k.label" cols="6" md="3" lg="2">
                <v-card variant="outlined" class="pa-3">
                    <div class="text-caption text-medium-emphasis">{{ k.label }}</div>
                    <div class="text-h6 font-weight-bold tabular">{{ k.value }}</div>
                </v-card>
            </v-col>
        </v-row>

        <v-card v-if="breakdown && breakdown.lead_time_sec" variant="outlined" class="mb-4">
            <div class="pa-4">
                <LeadTimeBreakdownBar
                    :lead-time-sec="breakdown.lead_time_sec"
                    :totals="breakdown.totals"
                    :has-estimated="breakdown.has_estimated"
                    :note="breakdown.coverage_note"
                />
            </div>
        </v-card>

        <v-card variant="outlined">
            <v-card-title class="text-subtitle-1 d-flex align-center">
                {{ $t('instanceProfiler.spansSection') }}
                <v-btn-toggle
                    v-model="axisMode"
                    density="compact"
                    variant="outlined"
                    mandatory
                    class="ml-4"
                >
                    <v-btn value="wall" size="small">{{ $t('instanceProfiler.axis.wall') }}</v-btn>
                    <v-btn value="work" size="small" :disabled="!workWindows.length">
                        {{ $t('instanceProfiler.axis.work') }}
                    </v-btn>
                </v-btn-toggle>
                <v-spacer />
                <span class="text-caption text-medium-emphasis">
                    {{ $t('instanceProfiler.drillHint') }}
                </span>
            </v-card-title>
            <v-divider />
            <div class="pa-3">
                <SpanWaterfall
                    :rows="displayRows"
                    :selected-id="selectedId"
                    :mode="axisMode"
                    :work-windows="workWindows"
                    @select="onSelect"
                />
            </div>
        </v-card>

        <!-- scrim 을 끈다. 켜두면 뒤쪽 워터폴이 클릭을 못 받는다. -->
        <v-navigation-drawer
            v-model="drawer"
            location="right"
            temporary
            :scrim="false"
            width="620"
        >
            <div class="d-flex align-center pa-3 pb-0">
                <v-btn
                    v-if="spanDetail"
                    icon="mdi-arrow-left"
                    variant="text"
                    size="small"
                    :title="$t('instanceProfiler.backToSpans')"
                    @click="spanDetail = null"
                />
                <h3 class="text-subtitle-1 font-weight-bold text-truncate">
                    {{ spanDetail ? $t('instanceProfiler.spanDetail') : selectedLabel }}
                </h3>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" size="small" @click="drawer = false" />
            </div>

            <EngineUnsupportedNotice
                v-if="spanTree && !spanTree.span_tracing"
                :engine="spanTree.engine"
                class="ma-3"
            />
            <div v-else-if="loadingSpans" class="pa-6 text-center">
                <v-progress-circular indeterminate />
                <div class="text-caption mt-2">{{ $t('instanceProfiler.loading') }}</div>
            </div>

            <!-- 스팬 상세 -->
            <SpanDetailPanel v-else-if="spanDetail" :detail="spanDetail" @close="drawer = false" />

            <!-- 태스크 안의 스팬 워터폴 (태스크 자체 시간축) -->
            <div v-else-if="spanTree" class="pa-3">
                <div v-if="!spanTree.spans.length" class="text-body-2 text-medium-emphasis">
                    {{ $t('instanceProfiler.noSpans') }}
                </div>
                <template v-else>
                    <div class="d-flex ga-4 mb-2 text-caption text-medium-emphasis">
                        <span>{{ $t('instanceProfiler.stats.spans', { n: spanTree.spans.length }) }}</span>
                        <span>{{ $t('instanceProfiler.stats.tokens', { v: formatTokens(spanTree.tokens_total) }) }}</span>
                        <span>{{ $t('instanceProfiler.stats.cost', { v: formatCost(spanTree.cost_total) }) }}</span>
                        <span>{{ formatMs(spanTree.total_duration_ms) }}</span>
                    </div>
                    <SpanWaterfall
                        :rows="spanRows"
                        :selected-id="selectedSpanId"
                        label-width="220px"
                        @select="openSpan"
                    />
                    <div class="text-caption text-medium-emphasis mt-2">
                        {{ $t('instanceProfiler.spanHint') }}
                    </div>
                </template>
            </div>
        </v-navigation-drawer>

        <v-snackbar v-model="snack.open" :color="snack.color" timeout="4000">
            {{ snack.text }}
        </v-snackbar>
    </v-container>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { timelineApi } from '@/services/analyticsApi';
import SpanWaterfall, { type WaterfallRow } from '@/components/analytics/SpanWaterfall.vue';
import SpanDetailPanel from '@/components/analytics/SpanDetailPanel.vue';
import EngineUnsupportedNotice from '@/components/analytics/EngineUnsupportedNotice.vue';
import LeadTimeBreakdownBar from '@/components/analytics/LeadTimeBreakdownBar.vue';
import { formatCost, formatDuration, formatMs, formatTokens } from '@/composables/useDuration';

const route = useRoute();
const procInstId = route.params.procInstId as string;
const { proxy } = getCurrentInstance() as any;

const summary = ref<any>(null);
const timeline = ref<any>(null);
const loading = ref(false);
const loadingSpans = ref(false);
const rows = ref<WaterfallRow[]>([]);
const breakdown = ref<any>(null);
const axisMode = ref<'wall' | 'work'>('wall');

// 작업시간 축에서는 태스크 막대 대신 '구간' 을 보여준다.
//
// 워터폴의 태스크 막대는 fact_task.start_timestamp(= todolist.start_date)에서
// 오는데 그 컬럼에는 계획일이 섞여 있다(실행 09-01 인데 값이 09-13). 그래서
// 태스크 축은 18일로 벌어지는 반면 실제 실행은 몇 분이다. 그 축 위에서
// 휴지를 접어봐야 접히는 건 가짜 간격이다.
//
// 분해 구간은 상태전이 이력과 이벤트에서만 나오므로 시각을 믿을 수 있다.
// 작업시간 축은 "휴지를 뺀 실제 일한 시간" 이 목적이므로 대기 구간은
// 막대로 그리지 않는다. 접힌 대기는 눈금 아래 배지로 표시된다.
const WORK_KINDS = new Set(['human_work', 'agent_work', 'rework']);

const segmentRows = computed<WaterfallRow[]>(() => {
    const segs = (breakdown.value?.segments ?? [])
        .filter((sg: any) => WORK_KINDS.has(sg.segment_type));
    const byActivity = new Map<string, any[]>();
    for (const sg of segs) {
        const key = sg.activity_id || proxy.$t('instanceProfiler.unassigned');
        if (!byActivity.has(key)) byActivity.set(key, []);
        byActivity.get(key)!.push(sg);
    }

    const out: WaterfallRow[] = [];
    for (const [actId, list] of byActivity) {
        const starts = list.map((x: any) => new Date(x.start).getTime());
        const ends = list.map((x: any) => new Date(x.end).getTime());
        const lo = Math.min(...starts);
        const hi = Math.max(...ends);
        out.push({
            id: 'seg-act:' + actId,
            depth: 0,
            label: list[0].activity_name || actId,
            kind: 'activity',
            start: lo, end: hi, durationMs: hi - lo,
            badge: null
        });
        list.forEach((sg: any, i: number) => {
            const a = new Date(sg.start).getTime();
            const b = new Date(sg.end).getTime();
            out.push({
                id: `seg:${actId}:${i}`,
                parentId: 'seg-act:' + actId,
                depth: 1,
                label: segLabel(sg.segment_type),
                kind: sg.actor_kind === 'human' ? 'human'
                    : sg.actor_kind === 'agent' ? 'agent' : 'wait',
                start: a, end: b, durationMs: b - a,
                badge: sg.is_estimated ? proxy.$t('instanceProfiler.estimated') : null
            });
        });
    }
    return out.sort((x, y) => x.start - y.start);
});

const SEG_KEYS = new Set([
    'human_work', 'agent_work', 'review_wait', 'queue_wait', 'rework', 'idle_gap'
]);

/** 알 수 없는 구간 종류는 원문 그대로 둔다. */
function segLabel(kind: string) {
    return SEG_KEYS.has(kind) ? proxy.$t(`instanceProfiler.segments.${kind}`) : kind;
}

/** 실시간 축은 기존 태스크 막대, 작업시간 축은 신뢰할 수 있는 구간 막대. */
const displayRows = computed(() =>
    axisMode.value === 'work' && segmentRows.value.length ? segmentRows.value : rows.value);

// 축 압축이 쓸 '실제 일한 구간'. epoch ms 로 바꿔 넘긴다.
const workWindows = computed(() =>
    (breakdown.value?.work_windows ?? [])
        .map((w: any) => ({
            start: new Date(w.start).getTime(),
            end: new Date(w.end).getTime()
        }))
        .filter((w: any) => w.end > w.start)
);
const selectedId = ref<string | null>(null);
const selectedLabel = ref('');
const spanTree = ref<any>(null);
const spanDetail = ref<any>(null);
const drawer = ref(false);
const snack = ref({ open: false, text: '', color: 'error' });

const kpis = computed(() => [
    { label: proxy.$t('instanceProfiler.kpi.totalDuration'), value: formatDuration(timeline.value?.total_duration_sec) },
    { label: proxy.$t('instanceProfiler.kpi.activities'), value: timeline.value?.activities?.length ?? '-' },
    { label: proxy.$t('instanceProfiler.kpi.tasks'), value: summary.value?.task_count ?? '-' },
    { label: proxy.$t('instanceProfiler.kpi.errors'), value: summary.value?.error_count ?? 0 },
    { label: proxy.$t('instanceProfiler.kpi.tokens'), value: formatTokens(timeline.value?.tokens_total) },
    { label: proxy.$t('instanceProfiler.kpi.cost'), value: formatCost(timeline.value?.cost_total) }
]);

function ms(v?: string | null) {
    const t = v ? new Date(v).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
}

/**
 * 실제 데이터에는 종료가 시작보다 이른 행이 섞여 있다(집계 시점 차이 등).
 * 그대로 그리면 막대가 음수가 되고 눈금 창까지 망가지므로 여기서 정리한다.
 */
function span(startRaw?: string | null, endRaw?: string | null, durationSec?: number | null) {
    const start = ms(startRaw);
    let end = ms(endRaw);
    if (!start) return { start: 0, end: 0, durationMs: 0 };
    if (!end || end < start) {
        end = start + Math.max((durationSec ?? 0) * 1000, 0);
    }
    const measured = end - start;
    const declared = Math.max((durationSec ?? 0) * 1000, 0);
    // 선언된 소요와 측정치가 크게 어긋나면 선언값을 믿는다.
    const durationMs = declared > 0 && measured > declared * 10 ? declared : Math.max(measured, 0);
    return { start, end: start + durationMs, durationMs };
}

/** 액티비티 → 태스크 계층을 워터폴 행으로 편다. */
function buildRows(t: any): WaterfallRow[] {
    const out: WaterfallRow[] = [];
    for (const a of t.activities || []) {
        const aSpan = span(a.start_time, a.end_time, a.duration_sec);
        out.push({
            id: `act:${a.activity_id}`,
            parentId: null,
            depth: 0,
            label: a.activity_name || a.activity_id,
            kind: 'activity',
            ...aSpan,
            badge: a.tokens_total ? formatTokens(a.tokens_total) : null
        });
        for (const task of a.tasks || []) {
            out.push({
                id: `task:${task.todo_id}`,
                parentId: `act:${a.activity_id}`,
                depth: 1,
                label: task.task_label || task.todo_id,
                kind: 'task',
                ...span(task.start_time, task.end_time, task.duration_sec),
                status: task.status,
                badge: task.cost_total ? formatCost(task.cost_total) : null
            });
        }
    }
    return out;
}

/**
 * 스팬은 메인 워터폴에 끼워 넣지 않는다.
 * 인스턴스는 며칠, 스팬은 밀리초 단위라 같은 축에 올리면 스팬이 아예 안 보인다.
 * 태스크 자체 시간축을 쓰는 별도 워터폴로 drawer 안에서 그린다.
 */
const spanRows = computed<WaterfallRow[]>(() => {
    const tree = spanTree.value;
    if (!tree?.spans?.length) return [];
    const rowsOut: WaterfallRow[] = tree.spans.map((s: any) => {
        const start = ms(s.started_at);
        const durationMs = Math.max(s.duration_ms || 0, 0);
        return {
            id: `span:${s.span_id}`,
            parentId: s.parent_span_id ? `span:${s.parent_span_id}` : null,
            depth: s.parent_span_id ? 1 : 0,
            label: s.name,
            kind: s.kind,
            start,
            end: start + durationMs,
            durationMs,
            status: s.status,
            badge: s.total_tokens ? formatTokens(s.total_tokens) : null
        };
    });
    // 부모를 자식보다 먼저 놓아야 접기가 어긋나지 않는다.
    const byParent = new Map<string | null, WaterfallRow[]>();
    rowsOut.forEach((r) => {
        const k = r.parentId ?? null;
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k)!.push(r);
    });
    const ordered: WaterfallRow[] = [];
    const walk = (parent: string | null) => {
        (byParent.get(parent) || [])
            .sort((a, b) => a.start - b.start)
            .forEach((r) => { ordered.push(r); walk(r.id); });
    };
    walk(null);
    return ordered;
});

const selectedSpanId = ref<string | null>(null);

async function openSpan(row: WaterfallRow) {
    selectedSpanId.value = row.id;
    loadingSpans.value = true;
    spanDetail.value = null;
    try {
        spanDetail.value = await timelineApi.getSpan(row.id.slice(5));
    } catch (e: any) {
        snack.value = {
            open: true,
            text: proxy.$t('instanceProfiler.spanLoadFailed', { message: e.message }),
            color: 'error'
        };
    } finally {
        loadingSpans.value = false;
    }
}

async function onSelect(row: WaterfallRow) {
    selectedId.value = row.id;
    selectedLabel.value = row.label;

    if (!row.id.startsWith('task:')) {
        drawer.value = false;
        return;
    }

    spanDetail.value = null;
    spanTree.value = null;
    selectedSpanId.value = null;
    drawer.value = true;
    loadingSpans.value = true;
    try {
        spanTree.value = await timelineApi.getTaskSpans(row.id.slice(5));
    } catch (e: any) {
        snack.value = {
            open: true,
            text: proxy.$t('instanceProfiler.spanLoadFailed', { message: e.message }),
            color: 'error'
        };
    } finally {
        loadingSpans.value = false;
    }
}

async function load() {
    loading.value = true;
    try {
        const [s, t, b] = await Promise.all([
            timelineApi.getSummary(procInstId).catch(() => null),
            timelineApi.getTimeline(procInstId),
            timelineApi.getBreakdown(procInstId).catch(() => null)
        ]);
        summary.value = s;
        timeline.value = t;
        breakdown.value = b;
        rows.value = buildRows(t);
    } catch (e: any) {
        snack.value = {
            open: true,
            text: proxy.$t('instanceProfiler.loadFailed', { message: e.message }),
            color: 'error'
        };
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>

<style scoped>
.tabular { font-variant-numeric: tabular-nums; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
</style>
