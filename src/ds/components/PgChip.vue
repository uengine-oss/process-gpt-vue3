<template>
    <component
        :is="clickable ? 'button' : 'span'"
        class="pg-chip"
        :class="[`pg-chip--${tone}`, `pg-chip--${size}`, { 'pg-chip--clickable': clickable, 'pg-chip--selected': selected }]"
        :aria-pressed="clickable && selected !== undefined ? String(selected) : undefined"
        v-bind="$attrs"
    >
        <slot name="prepend" />
        <span class="pg-chip__label"><slot /></span>
        <button v-if="closable" class="pg-chip__close" type="button" aria-label="제거" @click.stop="$emit('close')">
            <PgIcon name="mdi-close" :size="12" />
        </button>
    </component>
</template>

<script setup lang="ts">
import PgIcon from './PgIcon.vue';

withDefaults(
    defineProps<{
        tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'brand';
        size?: 'sm' | 'md';
        clickable?: boolean;
        selected?: boolean;
        closable?: boolean;
    }>(),
    { tone: 'neutral', size: 'md', clickable: false, selected: undefined, closable: false }
);

defineEmits<{ (e: 'close'): void }>();
</script>

<script lang="ts">
export default { name: 'PgChip', inheritAttrs: false };
</script>

<style scoped>
.pg-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    max-width: 100%;
    padding: 0 8px;
    border: 0;
    border-radius: var(--cds-radius--xs);
    background: var(--cds-bg-neutral);
    color: var(--cds-text-secondary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-caption);
    line-height: var(--cds-leading-caption);
    white-space: nowrap;
}
.pg-chip--sm {
    height: 20px;
    padding: 0 6px;
}

.pg-chip__label {
    overflow: hidden;
    text-overflow: ellipsis;
}

.pg-chip--accent {
    background: var(--cds-bg-accent);
    color: var(--cds-text-accent);
}
.pg-chip--success {
    background: var(--cds-bg-success);
    color: var(--cds-text-success);
}
.pg-chip--warning {
    background: var(--cds-bg-warning);
    color: var(--cds-text-warning);
}
.pg-chip--danger {
    background: var(--cds-bg-danger);
    color: var(--cds-text-danger);
}
.pg-chip--brand {
    background: color-mix(in srgb, hsl(var(--accent-brand)) 16%, transparent);
    color: hsl(var(--accent-brand));
}

.pg-chip--clickable {
    cursor: pointer;
    transition: background-color 120ms var(--cds-ease-out), color 120ms var(--cds-ease-out);
}
.pg-chip--clickable:hover {
    background: var(--cds-bg-neutral-hover);
}
.pg-chip--clickable:focus-visible {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: 1px;
}
.pg-chip--selected {
    background: var(--cds-text-primary);
    color: var(--cds-surface-2);
}
.pg-chip--selected:hover {
    background: color-mix(in srgb, var(--cds-text-primary) 88%, #fff);
}

.pg-chip__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin-right: -2px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
}
.pg-chip__close:hover {
    opacity: 1;
    background: var(--cds-bg-neutral-hover);
}
</style>
