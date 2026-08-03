<template>
    <div class="pg-thread">
        <div class="pg-thread__inner"><slot /></div>
    </div>
</template>

<script lang="ts">
export default { name: 'PgThread' };
</script>

<style scoped>
/* 대화 콘텐츠 컬럼 최대 768px 중앙 정렬 */
.pg-thread {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 16px 24px;
}
.pg-thread__inner {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: var(--app-content-max);
    margin: 0 auto;
}
</style>
