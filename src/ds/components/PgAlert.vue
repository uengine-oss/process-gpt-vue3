<template>
    <div class="pg-alert" :class="`pg-alert--${tone}`" role="status">
        <PgIcon :name="icon || defaultIcon" :size="16" class="pg-alert__icon" />
        <div class="pg-alert__content">
            <div v-if="title" class="pg-alert__title">{{ title }}</div>
            <div v-if="$slots.default" class="pg-alert__text"><slot /></div>
        </div>
        <PgButton v-if="closable" icon size="sm" variant="ghost" aria-label="닫기" @click="$emit('close')">
            <PgIcon name="mdi-close" :size="14" />
        </PgButton>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PgIcon from './PgIcon.vue';
import PgButton from './PgButton.vue';

const props = withDefaults(
    defineProps<{
        tone?: 'info' | 'success' | 'warning' | 'danger';
        title?: string;
        icon?: string;
        closable?: boolean;
    }>(),
    { tone: 'info', closable: false }
);

defineEmits<{ (e: 'close'): void }>();

const defaultIcon = computed(
    () =>
        ({
            info: 'mdi-information-outline',
            success: 'mdi-check-circle-outline',
            warning: 'mdi-alert-outline',
            danger: 'mdi-alert-circle-outline'
        }[props.tone])
);
</script>

<script lang="ts">
export default { name: 'PgAlert' };
</script>

<style scoped>
.pg-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--cds-radius);
    font-size: var(--cds-font-size-body);
    line-height: var(--cds-leading-body);
}

.pg-alert__icon {
    margin-top: 2px;
    flex: 0 0 auto;
}
.pg-alert__content {
    flex: 1 1 auto;
    min-width: 0;
}
.pg-alert__title {
    font-weight: var(--cds-font-weight-semibold);
}
.pg-alert__title + .pg-alert__text {
    margin-top: 2px;
}
.pg-alert__text {
    color: inherit;
    opacity: 0.9;
}

.pg-alert--info {
    background: var(--cds-bg-accent);
    color: var(--cds-text-accent);
}
.pg-alert--success {
    background: var(--cds-bg-success);
    color: var(--cds-text-success);
}
.pg-alert--warning {
    background: var(--cds-bg-warning);
    color: var(--cds-text-warning);
}
.pg-alert--danger {
    background: var(--cds-bg-danger);
    color: var(--cds-text-danger);
}
</style>
