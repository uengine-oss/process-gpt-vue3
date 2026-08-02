<template>
    <span class="pg-skeleton" :class="`pg-skeleton--${shape}`" :style="style" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{ width?: string | number; height?: string | number; shape?: 'text' | 'block' | 'circle' }>(),
    { shape: 'text' }
);

const toCss = (v?: string | number) => (typeof v === 'number' ? `${v}px` : v);
const style = computed(() => ({ width: toCss(props.width), height: toCss(props.height) }));
</script>

<script lang="ts">
export default { name: 'PgSkeleton' };
</script>

<style scoped>
/* 원본 cds-shimmer: 2s linear infinite, translateX(-100% → 100%) */
.pg-skeleton {
    position: relative;
    display: block;
    background: var(--cds-bg-neutral);
    overflow: hidden;
}
.pg-skeleton--text {
    height: 12px;
    border-radius: 4px;
}
.pg-skeleton--block {
    height: 64px;
    border-radius: var(--cds-radius);
}
.pg-skeleton--circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
}

.pg-skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, hsl(0 0% 100% / 45%), transparent);
    animation: pg-shimmer 2s linear infinite;
}
@keyframes pg-shimmer {
    from { transform: translateX(-100%); }
    to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
    .pg-skeleton::after { animation: none; }
}
</style>
