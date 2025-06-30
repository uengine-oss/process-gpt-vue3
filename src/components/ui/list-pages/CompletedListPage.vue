<template>
    <div class="dashboard">
        <InstanceListPage title="완료된 인스턴스" :list-type="['COMPLETED']" :config="{itemsPerPage: 10, height: 800}" />
    </div>
</template>

<script>
import InstanceListPage from '@/components/ui/list-pages/InstanceListPage.vue';
export default {
    components: {
        InstanceListPage,
    },
}
</script>

<style scoped>
/* 그리드 레이아웃 */
.dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    padding: 24px;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* 카드 스타일 */
.dashboard-section {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 24px;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
}

/* 반응형 */
@media (max-width: 768px) {
    .dashboard {
        padding: 16px;
        grid-template-columns: 1fr;
    }
    
    .dashboard-section {
        padding: 16px;
    }
}
</style>