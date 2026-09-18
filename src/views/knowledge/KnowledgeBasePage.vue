<template>
    <div class="kb-page">
        <KnowledgeMap />
    </div>
</template>

<script>
import KnowledgeMap from '@/components/knowledge/map/KnowledgeMap.vue';

export default {
    name: 'KnowledgeBasePage',
    components: { KnowledgeMap }
};
</script>

<style scoped>
.kb-page {
    height: calc(100vh - 88px);
    min-height: 480px;
    margin: 0 12px 12px;
    border: 1px solid var(--cds-border);
    border-radius: var(--cds-radius, 10px);
    overflow: hidden;
    background: var(--cds-surface-2, #fff);
}
</style>
