<template>
    <button class="pg-menu-item" :class="{ 'pg-menu-item--danger': danger }" type="button" role="menuitem" :disabled="disabled" v-bind="$attrs">
        <PgIcon v-if="icon" :name="icon" :size="16" class="pg-menu-item__icon" />
        <span class="pg-menu-item__label"><slot /></span>
        <span v-if="shortcut" class="pg-menu-item__shortcut">{{ shortcut }}</span>
    </button>
</template>

<script setup lang="ts">
import PgIcon from './PgIcon.vue';

withDefaults(defineProps<{ icon?: string; shortcut?: string; danger?: boolean; disabled?: boolean }>(), {
    danger: false,
    disabled: false
});
</script>

<script lang="ts">
export default { name: 'PgMenuItem', inheritAttrs: false };
</script>

<style scoped>
.pg-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: var(--row-h);
    padding: 0 var(--row-px);
    border: 0;
    border-radius: var(--cds-radius);
    background: transparent;
    color: var(--cds-text-primary);
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
    text-align: left;
    cursor: pointer;
    transition: background-color 120ms var(--cds-ease-out);
}
.pg-menu-item:hover:not(:disabled) {
    background: var(--cds-bg-neutral);
}
.pg-menu-item:disabled {
    opacity: 0.4;
    cursor: default;
}
.pg-menu-item--danger {
    color: var(--cds-text-danger);
}

.pg-menu-item__icon {
    color: var(--cds-text-muted);
}
.pg-menu-item--danger .pg-menu-item__icon {
    color: inherit;
}
.pg-menu-item__label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.pg-menu-item__shortcut {
    color: var(--cds-text-muted);
    font-size: var(--cds-font-size-caption);
}
</style>
