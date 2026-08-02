<template>
    <span
        class="pg-tooltip"
        @mouseenter="show"
        @mouseleave="hide"
        @focusin="show"
        @focusout="hide"
    >
        <slot />
        <span v-if="text" class="pg-tooltip__bubble" :class="`pg-tooltip__bubble--${placement}`" role="tooltip" :data-open="open">
            {{ text }}
        </span>
    </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

const props = withDefaults(
    defineProps<{ text?: string; placement?: 'top' | 'bottom' | 'left' | 'right'; delay?: number }>(),
    { placement: 'top', delay: 250 }
);

const open = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function show() {
    clearTimeout(timer);
    timer = setTimeout(() => (open.value = true), props.delay);
}
function hide() {
    clearTimeout(timer);
    open.value = false;
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<script lang="ts">
export default { name: 'PgTooltip' };
</script>

<style scoped>
.pg-tooltip {
    position: relative;
    display: inline-flex;
}

.pg-tooltip__bubble {
    position: absolute;
    z-index: 2600;
    padding: 4px 8px;
    border-radius: var(--cds-radius--xs);
    background: var(--cds-text-primary);
    color: var(--cds-surface-2);
    font-size: var(--cds-font-size-caption);
    line-height: var(--cds-leading-caption);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: scale(0.94);
    transition: opacity 120ms var(--cds-ease-out), transform 120ms var(--cds-ease-out);
}
.pg-tooltip__bubble[data-open='true'] {
    opacity: 1;
    transform: scale(1);
}

.pg-tooltip__bubble--top {
    bottom: calc(100% + 6px);
    left: 50%;
    translate: -50% 0;
}
.pg-tooltip__bubble--bottom {
    top: calc(100% + 6px);
    left: 50%;
    translate: -50% 0;
}
.pg-tooltip__bubble--left {
    right: calc(100% + 6px);
    top: 50%;
    translate: 0 -50%;
}
.pg-tooltip__bubble--right {
    left: calc(100% + 6px);
    top: 50%;
    translate: 0 -50%;
}

@media (prefers-reduced-motion: reduce) {
    .pg-tooltip__bubble {
        transition: none;
    }
}
</style>
