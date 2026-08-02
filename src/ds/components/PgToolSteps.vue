<template>
    <div class="pg-tool-steps"><slot /></div>
</template>

<script lang="ts">
export default { name: 'PgToolSteps' };
</script>

<style scoped>
.pg-tool-steps {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 16px;
}
.pg-tool-steps::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 12px;
    bottom: 12px;
    width: 1px;
    background: var(--cds-border);
}
</style>
