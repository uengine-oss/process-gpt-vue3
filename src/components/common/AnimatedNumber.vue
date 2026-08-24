<template>
    <span class="animated-number" :class="{ 'animated-number--pulse': pulsing }">{{ display }}</span>
</template>

<script setup lang="ts">
/**
 * AnimatedNumber — requestAnimationFrame 기반 카운트업 숫자.
 * 외부 라이브러리(gsap/count-to) 없이 값 변화를 부드럽게 보간하고, 변경 시 pulse.
 * 요구사항: ROI 변화가 직관적인 애니메이션/수치 변화로 인지 가능해야 함.
 */
import { ref, watch, onBeforeUnmount, computed } from 'vue';

const props = withDefaults(
    defineProps<{
        value: number;
        duration?: number;
        decimals?: number;
        prefix?: string;
        suffix?: string;
        /** 천단위 콤마 + (선택) 한국형 만/억 단위 압축. */
        format?: 'plain' | 'comma' | 'korean';
    }>(),
    { duration: 700, decimals: 0, prefix: '', suffix: '', format: 'comma' }
);

const current = ref(Number(props.value) || 0);
const pulsing = ref(false);
let rafId: number | null = null;
let pulseTimer: any = null;

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

function formatNumber(n: number): string {
    const dec = props.decimals;
    if (props.format === 'korean') {
        return formatKorean(n, dec);
    }
    const fixed = n.toFixed(dec);
    if (props.format === 'plain') return fixed;
    // comma
    const [intPart, decPart] = fixed.split('.');
    const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart != null ? `${withComma}.${decPart}` : withComma;
}

function formatKorean(n: number, dec: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 1)}억`;
    if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(abs % 10_000 === 0 ? 0 : 1)}만`;
    return `${sign}${abs.toFixed(dec)}`;
}

const display = computed(() => `${props.prefix}${formatNumber(current.value)}${props.suffix}`);

function animateTo(target: number) {
    if (rafId) cancelAnimationFrame(rafId);
    const start = current.value;
    const delta = target - start;
    if (Math.abs(delta) < 1e-9) {
        current.value = target;
        return;
    }
    const startTime = performance.now();
    const dur = Math.max(120, props.duration);

    const step = (t: number) => {
        const elapsed = t - startTime;
        const progress = Math.min(1, elapsed / dur);
        current.value = start + delta * easeOutCubic(progress);
        if (progress < 1) {
            rafId = requestAnimationFrame(step);
        } else {
            current.value = target;
            rafId = null;
        }
    };
    rafId = requestAnimationFrame(step);

    pulsing.value = true;
    if (pulseTimer) clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => (pulsing.value = false), 600);
}

watch(
    () => props.value,
    (val) => animateTo(Number(val) || 0)
);

onBeforeUnmount(() => {
    if (rafId) cancelAnimationFrame(rafId);
    if (pulseTimer) clearTimeout(pulseTimer);
});
</script>

<style scoped>
.animated-number {
    display: inline-block;
    font-variant-numeric: tabular-nums;
    transition: color 0.3s ease;
    will-change: transform;
}
.animated-number--pulse {
    animation: animated-number-pulse 0.6s ease;
}
@keyframes animated-number-pulse {
    0% {
        transform: scale(1);
    }
    35% {
        transform: scale(1.18);
        color: var(--v-theme-primary, #6750a4);
    }
    100% {
        transform: scale(1);
    }
}
</style>
