<template>
    <div
        class="pg-progress"
        role="progressbar"
        :aria-valuenow="indeterminate ? undefined : value"
        aria-valuemin="0"
        aria-valuemax="100"
    >
        <div
            class="pg-progress__bar"
            :class="{ 'pg-progress__bar--indeterminate': indeterminate }"
            :style="indeterminate ? undefined : { width: `${clamped}%` }"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ value?: number; indeterminate?: boolean }>(), {
    value: 0,
    indeterminate: false
});
const clamped = computed(() => Math.min(100, Math.max(0, props.value)));
</script>

<script lang="ts">
export default { name: 'PgProgress' };
</script>

<style scoped>
.pg-progress {
    width: 100%;
    height: 4px;
    border-radius: 999px;
    background: var(--cds-bg-neutral);
    overflow: hidden;
}
.pg-progress__bar {
    height: 100%;
    border-radius: inherit;
    background: hsl(var(--accent-brand));
    transition: width 200ms var(--cds-ease-out);
}
.pg-progress__bar--indeterminate {
    width: 35%;
    animation: pg-progress-slide 1.4s var(--cds-ease-snap) infinite;
}
@keyframes pg-progress-slide {
    from { transform: translateX(-120%); }
    to { transform: translateX(340%); }
}
@media (prefers-reduced-motion: reduce) {
    .pg-progress__bar--indeterminate { animation-duration: 3s; }
}
</style>
