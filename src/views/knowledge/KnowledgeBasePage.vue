<template>
    <!-- 다른 관리 화면(프로세스 체계도 · 조직도 · 스킬)과 같은 흰 카드 틀 — 높이는 앱 공통 .is-work-height -->
    <v-card elevation="10" class="rounded-xl kb-page is-work-height">
        <KnowledgeMap />
    </v-card>
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
    min-height: 480px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
</style>
