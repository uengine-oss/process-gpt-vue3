<template>
    <div class="pg-tool-step">
        <PgIcon :name="icon" :size="16" class="pg-tool-step__icon" />
        <span class="pg-tool-step__label"><slot>{{ label }}</slot></span>
        <PgSpinner v-if="running" :size="13" />
    </div>
</template>

<script setup lang="ts">
import PgIcon from './PgIcon.vue';
import PgSpinner from './PgSpinner.vue';

withDefaults(defineProps<{ label?: string; icon?: string; running?: boolean }>(), {
    icon: 'mdi-wrench-outline',
    running: false
});
</script>

<script lang="ts">
export default { name: 'PgToolStep' };
</script>

<style scoped>
/* 실측: 산세리프 15px/24px, muted, 좌측 세로 연결선 1px */
.pg-tool-step {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    color: var(--cds-text-muted);
    font-size: 15px;
    line-height: 24px;
}
.pg-tool-step__icon { flex: 0 0 16px; opacity: 0.7; }
.pg-tool-step__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
