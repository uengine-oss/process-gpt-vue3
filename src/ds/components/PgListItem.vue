<template>
    <component
        :is="to ? 'a' : 'button'"
        class="pg-list-item"
        :class="{ 'pg-list-item--active': active }"
        :href="to"
        :type="to ? undefined : 'button'"
        :aria-current="active ? 'page' : undefined"
        :disabled="!to && disabled ? true : undefined"
        v-bind="$attrs"
    >
        <slot name="prepend">
            <PgIcon v-if="icon" :name="icon" :size="16" class="pg-list-item__icon" />
        </slot>

        <span class="pg-list-item__text">
            <span class="pg-list-item__title"><slot>{{ title }}</slot></span>
            <span v-if="subtitle" class="pg-list-item__subtitle">{{ subtitle }}</span>
        </span>

        <slot name="append" />
    </component>
</template>

<script setup lang="ts">
import PgIcon from './PgIcon.vue';

withDefaults(
    defineProps<{
        title?: string;
        subtitle?: string;
        icon?: string;
        active?: boolean;
        disabled?: boolean;
        /** 지정하면 <a> 로 렌더 */
        to?: string;
    }>(),
    { active: false, disabled: false }
);
</script>

<script lang="ts">
export default { name: 'PgListItem', inheritAttrs: false };
</script>

<style scoped>
.pg-list-item {
    display: flex;
    align-items: center;
    gap: var(--row-gap);
    width: 100%;
    min-height: var(--row-h);
    padding: 0 var(--row-px);
    border: 0;
    border-radius: var(--cds-radius);
    background: transparent;
    color: hsl(var(--text-300));
    font-family: var(--cds-font-sans);
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 120ms var(--cds-ease-out), color 120ms var(--cds-ease-out);
}
.pg-list-item:hover {
    background: var(--cds-bg-neutral);
    text-decoration: none;
}
.pg-list-item:focus-visible {
    outline: 2px solid hsl(var(--accent-100));
    outline-offset: -2px;
}
.pg-list-item:disabled {
    opacity: 0.4;
    cursor: default;
}
.pg-list-item--active {
    background: var(--cds-bg-neutral);
    color: var(--cds-text-primary);
    font-weight: var(--cds-font-weight-medium);
}

.pg-list-item__icon {
    flex: 0 0 16px;
    opacity: 0.8;
}

.pg-list-item__text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1 1 auto;
    min-width: 0;
    padding: 4px 0;
}
.pg-list-item__title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.pg-list-item__subtitle {
    color: var(--cds-text-muted);
    font-size: var(--cds-font-size-caption);
    line-height: var(--cds-leading-caption);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
</style>
