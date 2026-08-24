<script setup lang="ts">
/** 누적 예상 ROI 위젯 — 선택된 To-Be 솔루션 기반으로 실시간 롤링 표시. */
import { ref, computed, watch, onBeforeUnmount, inject } from 'vue';
import { AN_STUDIO_KEY } from '@/composables/anStudio/useAnStudio';

const an = inject(AN_STUDIO_KEY)!;
const roi = an.roi;

const ANNUAL_HOURS = 2080;

const targetKrw = computed(() => Math.round(roi.totalSavingsKrw.value || 0));
const targetFte = computed(() => Math.max(0, roi.savings.value.fte || 0));
const targetHours = computed(() => Math.round((targetFte.value * ANNUAL_HOURS) / 12));
const ratePct = computed(() => roi.savingsRatePct.value || 0);
const count = computed(() => roi.selectedCount.value || 0);

/* ---- count-up tween ---- */
function useTween(source: () => number) {
    const display = ref(source());
    let raf = 0;
    watch(source, (to) => {
        const from = display.value;
        const start = performance.now();
        const dur = 600;
        cancelAnimationFrame(raf);
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            display.value = from + (to - from) * eased;
            if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    });
    onBeforeUnmount(() => cancelAnimationFrame(raf));
    return display;
}

const krwDisp = useTween(() => targetKrw.value);
const fteDisp = useTween(() => targetFte.value);
const hoursDisp = useTween(() => targetHours.value);

function formatKrw(v: number) {
    const n = Math.round(v);
    if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
    if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`;
    return n.toLocaleString();
}
</script>

<template>
    <div class="an-roi">
        <div class="an-roi__head">
            <v-icon size="16" color="white">mdi-finance</v-icon>
            <span>누적 예상 ROI</span>
            <v-spacer />
            <v-chip size="x-small" variant="flat" color="rgba(255,255,255,0.2)" class="text-white">{{ count }}개 적용</v-chip>
        </div>
        <div class="an-roi__hero">
            <span class="an-roi__currency">₩</span>
            <span class="an-roi__value">{{ formatKrw(krwDisp) }}</span>
            <span class="an-roi__unit">/ 년</span>
        </div>
        <div class="an-roi__metrics">
            <div class="an-roi__metric">
                <div class="an-roi__metric-label"><v-icon size="13">mdi-account-minus-outline</v-icon> 인력 절감</div>
                <div class="an-roi__metric-value">{{ fteDisp.toFixed(1) }} <small>FTE</small></div>
            </div>
            <div class="an-roi__metric">
                <div class="an-roi__metric-label"><v-icon size="13">mdi-timer-outline</v-icon> 월 절감</div>
                <div class="an-roi__metric-value">{{ Math.round(hoursDisp).toLocaleString() }} <small>시간</small></div>
            </div>
            <div class="an-roi__metric">
                <div class="an-roi__metric-label"><v-icon size="13">mdi-chart-line</v-icon> 절감률</div>
                <div class="an-roi__metric-value">{{ ratePct }} <small>%</small></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.an-roi {
    border-radius: 14px;
    padding: 16px;
    color: #fff;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a855f7 100%);
    box-shadow: 0 10px 24px rgba(99, 102, 241, 0.28);
}
.an-roi__head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    opacity: 0.95;
}
.an-roi__hero {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin: 8px 0 12px;
}
.an-roi__currency {
    font-size: 1.1rem;
    font-weight: 700;
    opacity: 0.9;
}
.an-roi__value {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
}
.an-roi__unit {
    font-size: 0.8rem;
    opacity: 0.8;
}
.an-roi__metrics {
    display: flex;
    gap: 8px;
}
.an-roi__metric {
    flex: 1 1 0;
    background: rgba(255, 255, 255, 0.14);
    border-radius: 9px;
    padding: 8px 10px;
}
.an-roi__metric-label {
    font-size: 0.66rem;
    opacity: 0.85;
    display: flex;
    align-items: center;
    gap: 3px;
}
.an-roi__metric-value {
    font-size: 1rem;
    font-weight: 700;
    margin-top: 2px;
}
.an-roi__metric-value small {
    font-size: 0.62rem;
    font-weight: 600;
    opacity: 0.85;
}
</style>
