<template>
    <div class="waterfall" :style="{ '--label-w': labelWidth }">
        <!-- 눈금 -->
        <div class="ruler">
            <div class="ruler-label" />
            <div class="ruler-track">
                <div v-for="(t, i) in ticks" :key="i" class="tick" :style="{ left: t.pct + '%' }">
                    <span>{{ t.label }}</span>
                </div>
            </div>
        </div>

        <!-- 접힌 휴지구간: 시간이 사라진 게 아니라 접혔음을 명시한다 -->
        <div v-if="mode === 'work' && gapMarkers.length" class="ruler gap-lane">
            <div class="ruler-label">{{ $t('spanWaterfall.collapsedWait') }}</div>
            <div class="ruler-track">
                <div
                    v-for="(g, i) in gapMarkers"
                    :key="i"
                    class="gap-mark"
                    :style="{ left: g.left + '%', width: g.width + '%' }"
                    :title="$t('spanWaterfall.collapsedWaitTitle', { label: g.label })"
                >⋯ {{ g.label }}</div>
            </div>
            <div class="badge" />
        </div>

        <div class="rows">
            <div
                v-for="row in visibleRows"
                :key="row.id"
                class="row"
                :class="{ selected: row.id === selectedId }"
                @click="$emit('select', row)"
            >
                <div class="label" :style="{ paddingLeft: 8 + row.depth * 16 + 'px' }">
                    <v-icon
                        v-if="hasChildren(row.id)"
                        size="14"
                        class="chev"
                        @click.stop="toggle(row.id)"
                    >
                        {{ collapsed.has(row.id) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
                    </v-icon>
                    <span v-else class="chev-spacer" />
                    <span class="kind" :class="'kind-' + row.kind" />
                    <span class="name" :title="row.label">{{ row.label }}</span>
                </div>
                <div class="track">
                    <div
                        v-for="(g, i) in gapMarkers"
                        :key="'g' + i"
                        class="gap-band"
                        :style="{ left: g.left + '%', width: g.width + '%' }"
                    />
                    <div
                        v-if="row.start > 0"
                        class="bar"
                        :class="['bar-' + row.kind, { failed: row.status && row.status !== 'success' }]"
                        :style="barStyle(row)"
                    >
                        <span class="dur">{{ fmt(row.durationMs) }}</span>
                    </div>
                    <span v-else class="no-time">{{ $t('spanWaterfall.noTime') }}</span>
                </div>
                <div class="badge">{{ row.badge || '' }}</div>
            </div>

            <div v-if="!visibleRows.length" class="empty">{{ $t('spanWaterfall.empty') }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatMs } from '@/composables/useDuration';

export interface WaterfallRow {
    id: string;
    parentId?: string | null;
    depth: number;
    label: string;
    kind: string;              // activity | task | llm | mcp
    start: number;             // epoch ms
    end: number;
    durationMs: number;
    status?: string | null;
    badge?: string | null;
}

export interface WorkWindow {
    start: number;   // epoch ms
    end: number;
}

const props = withDefaults(defineProps<{
    rows: WaterfallRow[];
    selectedId?: string | null;
    labelWidth?: string;
    /** 'wall' = 실시간 축, 'work' = 휴지를 접은 작업시간 축 */
    mode?: 'wall' | 'work';
    /** mode='work' 일 때 실제로 일이 벌어진 구간들 */
    workWindows?: WorkWindow[];
}>(), { labelWidth: '280px', mode: 'wall', workWindows: () => [] });
defineEmits<{ (e: 'select', row: WaterfallRow): void }>();

const collapsed = ref<Set<string>>(new Set());
const fmt = formatMs;

// 시각이 없는 행은 start=0 으로 들어온다. 그대로 두면 창이 1970년부터
// 잡혀 눈금이 "30일" 이 되고 실제 구간이 전부 뭉개진다.
const timed = computed(() => props.rows.filter((r) => r.start > 0));
const windowStart = computed(() =>
    timed.value.length ? Math.min(...timed.value.map((r) => r.start)) : 0);
const windowEnd = computed(() =>
    timed.value.length ? Math.max(...timed.value.map((r) => r.end)) : 1);
const total = computed(() => Math.max(windowEnd.value - windowStart.value, 1));

// 휴지구간에 배정할 폭. 실제 길이에 비례시키면 작업구간이 다시 안 보인다.
// 리드타임의 99% 이상이 휴지라서(실측) 비례 배분은 의미가 없다.
const GAP_SHARE = 0.06;

/**
 * 작업구간은 실제 비율대로, 휴지구간은 고정 몫으로 접는 조각선형 매핑.
 * 반환값은 0~1. mode='wall' 이면 그냥 선형이다.
 */
const projector = computed(() => {
    const lo = windowStart.value;
    const hi = windowEnd.value;
    const span = Math.max(hi - lo, 1);

    if (props.mode !== 'work' || !props.workWindows.length) {
        return { map: (t: number) => (t - lo) / span, segments: [] as any[] };
    }

    // 작업구간을 정렬·병합하고 그 사이를 휴지로 채운다.
    const work = [...props.workWindows]
        .map((w) => ({ start: Math.max(w.start, lo), end: Math.min(w.end, hi) }))
        .filter((w) => w.end > w.start)
        .sort((a, b) => a.start - b.start);

    const parts: { start: number; end: number; work: boolean }[] = [];
    let cursor = lo;
    for (const w of work) {
        if (w.start > cursor) parts.push({ start: cursor, end: w.start, work: false });
        parts.push({ start: w.start, end: w.end, work: true });
        cursor = Math.max(cursor, w.end);
    }
    if (cursor < hi) parts.push({ start: cursor, end: hi, work: false });

    const workTotal = parts.filter((p) => p.work)
        .reduce((a, p) => a + (p.end - p.start), 0) || 1;
    const gapCount = parts.filter((p) => !p.work).length;
    // 휴지가 차지할 전체 몫 (구간 수에 따라 커지되 절반을 넘지 않게)
    const gapShare = Math.min(GAP_SHARE * gapCount, 0.5);
    const workScale = (1 - gapShare) / workTotal;
    const gapEach = gapCount ? gapShare / gapCount : 0;

    let acc = 0;
    const segments = parts.map((p) => {
        const width = p.work ? (p.end - p.start) * workScale : gapEach;
        const seg = { ...p, offset: acc, width };
        acc += width;
        return seg;
    });

    function map(t: number) {
        if (t <= lo) return 0;
        if (t >= hi) return 1;
        for (const seg of segments) {
            if (t >= seg.start && t <= seg.end) {
                const frac = seg.end > seg.start ? (t - seg.start) / (seg.end - seg.start) : 0;
                // 접힌 구간 안에서는 위치를 펴지 않는다 — 폭이 이미 가짜라서
                return seg.offset + (seg.work ? frac * seg.width : frac * seg.width);
            }
        }
        return 1;
    }
    return { map, segments };
});

/** 접힌 휴지구간 — 배지로 "사라진 게 아니라 접혔음" 을 알린다. */
const gapMarkers = computed(() =>
    projector.value.segments
        .filter((s: any) => !s.work && s.end - s.start > 1000)
        .map((s: any) => ({
            left: s.offset * 100,
            width: s.width * 100,
            label: formatMs(s.end - s.start)
        }))
);

const childIds = computed(() => {
    const m = new Set<string>();
    props.rows.forEach((r) => { if (r.parentId) m.add(r.parentId); });
    return m;
});
function hasChildren(id: string) {
    return childIds.value.has(id);
}

function toggle(id: string) {
    const next = new Set(collapsed.value);
    next.has(id) ? next.delete(id) : next.add(id);
    collapsed.value = next;
}

/** 접힌 조상이 있으면 감춘다. */
const visibleRows = computed(() => {
    const byId = new Map(props.rows.map((r) => [r.id, r]));
    return props.rows.filter((r) => {
        let p = r.parentId;
        while (p) {
            if (collapsed.value.has(p)) return false;
            p = byId.get(p)?.parentId ?? null;
        }
        return true;
    });
});

function barStyle(row: WaterfallRow) {
    // 시작과 끝을 각각 투영해 차이를 폭으로 쓴다. durationMs 를 직접
    // 스케일하면 접힌 축에서 폭이 틀어진다.
    const p = projector.value.map;
    const a = p(row.start) * 100;
    const b = p(row.end || row.start + row.durationMs) * 100;
    const left = a;
    const width = Math.max(b - a, 0);
    return {
        left: `${Math.max(0, Math.min(left, 100))}%`,
        // 아주 짧은 구간도 보이도록 최소 폭을 준다
        width: `max(${Math.max(width, 0)}%, 3px)`
    };
}

const ticks = computed(() => {
    if (props.mode === 'work' && projector.value.segments.length) {
        // 균등 5분할은 접힌 축에서 거짓말이 된다. 구간 경계에 눈금을 둔다.
        let acc = 0;
        const out = [{ pct: 0, label: '0' }];
        for (const seg of projector.value.segments) {
            if (seg.work) acc += seg.end - seg.start;
            out.push({ pct: (seg.offset + seg.width) * 100, label: formatMs(acc) });
        }
        // 구간이 많으면 눈금이 겹쳐 읽을 수 없다. 6개 안팎으로 솎는다.
        const step = Math.max(1, Math.ceil(out.length / 6));
        return out.filter((t, i) => i === 0 || i === out.length - 1 || i % step === 0);
    }
    const out = [];
    for (let i = 0; i <= 4; i++) {
        out.push({ pct: i * 25, label: formatMs((total.value * i) / 4) });
    }
    return out;
});
</script>

<style scoped>
.waterfall { font-size: 13px; }

.gap-lane { margin-bottom: 2px; }
.gap-lane .ruler-label {
    font-size: 11px;
    opacity: 0.6;
    text-align: right;
    padding-right: 8px;
}
.gap-mark {
    position: absolute;
    top: 0;
    height: 16px;
    line-height: 16px;
    font-size: 10px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    border-radius: 3px;
    background: repeating-linear-gradient(
        45deg,
        rgba(120, 120, 120, 0.16),
        rgba(120, 120, 120, 0.16) 4px,
        transparent 4px,
        transparent 8px
    );
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.75;
}
.kind-human, .bar-human   { background: #C2410C; }
.kind-agent, .bar-agent   { background: #1D6F8B; }
.kind-wait,  .bar-wait    { background: #9E9E9E; }

.gap-band {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(120, 120, 120, 0.07);
    pointer-events: none;
}
.ruler, .row {
    display: grid;
    grid-template-columns: var(--label-w, 280px) 1fr 76px;
    align-items: center;
}
.ruler { height: 26px; border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12); }
.ruler-track { position: relative; height: 100%; }
.tick {
    position: absolute; top: 0; height: 100%;
    border-left: 1px dashed rgba(var(--v-theme-on-surface), 0.12);
}
.tick span {
    position: absolute; top: 4px; left: 4px; font-size: 10px;
    color: rgba(var(--v-theme-on-surface), 0.55);
    font-variant-numeric: tabular-nums;
}
.rows { max-height: 460px; overflow-y: auto; }
.row {
    height: 30px; cursor: pointer;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.row:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.row.selected { background: rgba(var(--v-theme-primary), 0.10); }
.label { display: flex; align-items: center; gap: 4px; overflow: hidden; padding-right: 8px; }
.chev { opacity: 0.6; }
.chev-spacer { width: 14px; display: inline-block; }
.kind { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.kind-activity { background: #6C737D; }
.kind-task { background: #0E6E68; }
.kind-llm { background: #4C6FB8; }
.kind-mcp { background: #B4690E; }
.name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track { position: relative; height: 100%; }
.bar {
    position: absolute; top: 7px; height: 16px; border-radius: 3px;
    display: flex; align-items: center; padding: 0 5px; min-width: 3px;
}
.bar-activity { background: rgba(108, 115, 125, 0.35); }
.bar-task { background: rgba(14, 110, 104, 0.45); }
.bar-llm { background: rgba(76, 111, 184, 0.65); }
.bar-mcp { background: rgba(180, 105, 14, 0.65); }
.bar.failed { background: rgba(163, 42, 32, 0.7); }
.dur {
    font-size: 10px; color: rgba(var(--v-theme-on-surface), 0.85);
    white-space: nowrap; font-variant-numeric: tabular-nums;
}
.badge {
    font-size: 11px; text-align: right; padding-right: 8px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    font-variant-numeric: tabular-nums;
}
.no-time {
    font-size: 10px; color: rgba(var(--v-theme-on-surface), 0.4);
    line-height: 30px; padding-left: 4px;
}
.empty { padding: 24px; text-align: center; color: rgba(var(--v-theme-on-surface), 0.5); }
</style>
