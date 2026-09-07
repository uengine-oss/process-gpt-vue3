<template>
    <div class="exec-inst-admin">
        <div class="exec-inst-admin__head">
            <div>
                <h2 class="exec-inst-admin__title">실행 인스턴스 관리</h2>
                <p class="exec-inst-admin__desc">
                    테넌트 전체의 프로세스 인스턴스를 참여자 제한 없이 조회합니다. 카드를 클릭하면 인스턴스 상세로 이동합니다.
                </p>
            </div>
        </div>
        <InstanceListPage
            :list-type="['*']"
            :all-users="true"
            title="전체 실행 인스턴스"
            :config="{ itemsPerPage: 10, height: 700 }"
        />
    </div>
</template>

<script>
import InstanceListPage from '@/components/ui/list-pages/InstanceListPage.vue';

export default {
    name: 'ExecInstanceAdmin',
    components: { InstanceListPage }
};
</script>

<style scoped>
.exec-inst-admin {
    padding: 20px 24px;
    height: 100%;
    overflow: auto;
}
.exec-inst-admin__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
}
.exec-inst-admin__title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
}
.exec-inst-admin__desc {
    font-size: 13px;
    color: #6b7280;
    margin: 4px 0 0;
}
</style>
