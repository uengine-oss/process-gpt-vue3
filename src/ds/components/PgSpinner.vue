<template>
    <span class="pg-spinner" :style="{ width: px, height: px }" role="status" :aria-label="label">
        <svg viewBox="0 0 24 24" :width="size" :height="size" fill="none" aria-hidden="true">
            <circle class="pg-spinner__track" cx="12" cy="12" r="9.5" :stroke-width="width" />
            <circle class="pg-spinner__head" cx="12" cy="12" r="9.5" :stroke-width="width" />
        </svg>
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        size?: number;
        width?: number;
        label?: string;
    }>(),
    { size: 18, width: 2.5, label: '불러오는 중' }
);

const px = computed(() => `${props.size}px`);
</script>

<script lang="ts">
export default { name: 'PgSpinner' };
</script>

<style scoped>
.pg-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
}
.pg-spinner svg {
    animation: pg-spin 900ms linear infinite;
}
.pg-spinner__track {
    stroke: currentColor;
    opacity: 0.18;
}
.pg-spinner__head {
    stroke: currentColor;
    stroke-linecap: round;
    stroke-dasharray: 60;
    stroke-dashoffset: 45;
}

@keyframes pg-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .pg-spinner svg {
        animation-duration: 2.4s;
    }
}
</style>
