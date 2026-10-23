<template>
    <div class="lt-breakdown">
        <div class="lt-head">
            <span class="lt-title">{{ $t('leadTimeBreakdownBar.title') }}</span>
            <span class="lt-total">{{ formatDurationLong(leadTimeSec) }}</span>
            <v-chip v-if="hasEstimated" size="x-small" color="warning" variant="tonal">
                {{ $t('leadTimeBreakdownBar.estimatedIncluded') }}
            </v-chip>
        </div>

        <div class="lt-bar">
            <div
                v-for="p in parts"
                :key="p.key"
                class="lt-seg"
                :class="'seg-' + p.key"
                :style="{ width: p.pct + '%' }"
                :title="`${p.label} ${formatDurationLong(p.sec)} (${p.pct.toFixed(1)}%)`"
            />
        </div>

        <div class="lt-legend">
            <div v-for="p in parts" :key="p.key" class="lt-item">
                <span class="dot" :class="'seg-' + p.key" />
                <span class="nm">{{ p.label }}</span>
                <span class="vl">{{ formatDurationLong(p.sec) }}</span>
                <span class="pc">{{ p.pct.toFixed(1) }}%</span>
            </div>
        </div>

        <p v-if="note" class="lt-note">{{ note }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';
import { formatDurationLong } from '@/composables/useDuration';

const props = defineProps<{
    leadTimeSec: number;
    totals: Record<string, number>;
    hasEstimated?: boolean;
    note?: string | null;
}>();

const { proxy } = getCurrentInstance() as any;

// 표시 순서는 "누가 시간을 썼나" 가 먼저 읽히게 둔다.
const ORDER = ['human_work', 'agent_work', 'review_wait', 'queue_wait', 'rework', 'idle_gap'];

const parts = computed(() => {
    const lead = props.leadTimeSec || 0;
    return ORDER
        .filter((k) => (props.totals?.[k] ?? 0) > 0)
        .map((k) => {
            const sec = props.totals[k];
            return {
                key: k,
                label: proxy.$t(`leadTimeBreakdownBar.labels.${k}`),
                sec,
                pct: lead > 0 ? (sec / lead) * 100 : 0
            };
        });
});
</script>

<style scoped>
.lt-breakdown { display: flex; flex-direction: column; gap: 10px; }
.lt-head { display: flex; align-items: center; gap: 10px; }
.lt-title { font-weight: 600; }
.lt-total { font-variant-numeric: tabular-nums; opacity: 0.75; }

.lt-bar {
    display: flex;
    height: 18px;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(120, 120, 120, 0.12);
}
.lt-seg { height: 100%; min-width: 2px; }

.lt-legend {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 4px 16px;
}
.lt-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.lt-item .nm { flex: 1; }
.lt-item .vl, .lt-item .pc { font-variant-numeric: tabular-nums; opacity: 0.8; }
.lt-item .pc { width: 48px; text-align: right; }
.dot { width: 10px; height: 10px; border-radius: 2px; flex: none; }

/* 색은 행위자 기준으로 고정한다 — 사람/에이전트/대기가 한눈에 갈리게 */
.seg-human_work  { background: #C2410C; }
.seg-agent_work  { background: #1D6F8B; }
.seg-review_wait { background: #B08900; }
.seg-queue_wait  { background: #8A8A8A; }
.seg-rework      { background: #7C3AED; }
.seg-idle_gap    { background: #C9C9C9; }

.lt-note { font-size: 12px; opacity: 0.7; margin: 0; }
</style>
