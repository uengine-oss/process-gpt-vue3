<template>
    <hr v-if="!vertical" class="pg-divider" :class="{ 'pg-divider--inset': inset }" />
    <span v-else class="pg-divider pg-divider--vertical" role="separator" />
</template>

<script setup lang="ts">
withDefaults(defineProps<{ vertical?: boolean; inset?: boolean }>(), { vertical: false, inset: false });
</script>

<script lang="ts">
export default { name: 'PgDivider' };
</script>

<style scoped>
.pg-divider {
    border: 0;
    border-top: 0.5px solid var(--cds-border);
    margin: 0;
    width: 100%;
}
.pg-divider--inset {
    margin-inline: 8px;
    width: auto;
}
.pg-divider--vertical {
    display: inline-block;
    width: 0;
    align-self: stretch;
    min-height: 16px;
    border-top: 0;
    border-left: 0.5px solid var(--cds-border);
}
</style>
