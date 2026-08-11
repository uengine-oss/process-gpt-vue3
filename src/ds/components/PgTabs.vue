<template>
    <div class="pg-tabs" :class="`pg-tabs--${variant}`" role="tablist">
        <button
            v-for="tab in items"
            :key="String(tab.value)"
            class="pg-tabs__item"
            type="button"
            role="tab"
            :aria-selected="modelValue === tab.value"
            :disabled="tab.disabled"
            @click="$emit('update:modelValue', tab.value)"
        >
            <PgIcon v-if="tab.icon" :name="tab.icon" :size="15" />
            <span>{{ tab.label }}</span>
            <PgChip v-if="tab.count !== undefined" size="sm">{{ tab.count }}</PgChip>
        </button>
    </div>
</template>

<script setup lang="ts">
import PgIcon from './PgIcon.vue';
import PgChip from './PgChip.vue';

withDefaults(
    defineProps<{
        modelValue?: string | number;
        items?: Array<{ label: string; value: string | number; icon?: string; count?: number; disabled?: boolean }>;
        /** segmented = 알약형 그룹, underline = 밑줄형 */
        variant?: 'segmented' | 'underline';
    }>(),
    { items: () => [], variant: 'segmented' }
);

defineEmits<{ (e: 'update:modelValue', v: string | number): void }>();
</script>

<script lang="ts">
export default { name: 'PgTabs' };
</script>

<style scoped>
.pg-tabs {
    display: flex;
    align-items: center;
    min-width: 0;
}

.pg-tabs__item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: var(--cds-text-secondary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    font-weight: var(--cds-font-weight-medium);
    line-height: var(--cds-leading-body);
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 120ms var(--cds-ease-out), color 120ms var(--cds-ease-out);
}
.pg-tabs__item:disabled {
    opacity: 0.4;
    cursor: default;
}
.pg-tabs__item:focus-visible {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: -2px;
}

/* --- segmented: 사이드바 상단 세그먼트 컨트롤과 동일한 형태 --- */
.pg-tabs--segmented {
    gap: 2px;
    padding: 2px;
    border-radius: var(--cds-radius--lg);
    background: var(--cds-bg-neutral);
}
.pg-tabs--segmented .pg-tabs__item {
    flex: 1 1 0;
    border-radius: var(--cds-radius);
}
.pg-tabs--segmented .pg-tabs__item:hover:not(:disabled) {
    color: var(--cds-text-primary);
}
.pg-tabs--segmented .pg-tabs__item[aria-selected='true'] {
    background: var(--cds-surface-2);
    color: var(--cds-text-primary);
    box-shadow: var(--cds-shadow-sm);
}

/* --- underline --- */
.pg-tabs--underline {
    gap: 4px;
    border-bottom: 0.5px solid var(--cds-border);
    overflow-x: auto;
}
.pg-tabs--underline .pg-tabs__item {
    position: relative;
    height: 36px;
    padding: 0 10px;
}
.pg-tabs--underline .pg-tabs__item::after {
    content: '';
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: -0.5px;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: transparent;
    transition: background-color 140ms var(--cds-ease-out);
}
.pg-tabs--underline .pg-tabs__item:hover:not(:disabled) {
    color: var(--cds-text-primary);
}
.pg-tabs--underline .pg-tabs__item[aria-selected='true'] {
    color: var(--cds-text-primary);
}
.pg-tabs--underline .pg-tabs__item[aria-selected='true']::after {
    background: hsl(var(--accent-brand));
}
</style>
