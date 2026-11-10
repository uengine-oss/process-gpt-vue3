<template>
    <div>
        <div v-if="isLoading" class="pl-4 pr-4 py-2 text-caption text-grey">
            {{ $t('ProcessInstanceList.loading') || '인스턴스 로딩 중...' }}
        </div>
        <div v-else-if="instanceList.length === 0" class="pl-4 pr-4 py-2 text-caption text-grey">
            {{ $t('ProcessInstanceList.empty') || '실행 중인 인스턴스가 없습니다' }}
        </div>
        <ExpandableList v-else :items="instanceList" :limit="10" @expanded="onInstancesExpanded" @collapsed="onInstancesCollapsed">
            <template #items="{ displayedItems }">
                <template v-for="item in displayedItems" :key="item.instId || item.to">
                    <div v-if="item.isNew" class="d-flex">
                        <v-progress-circular indeterminate class="mt-2" color="primary" :size="20"></v-progress-circular>
                        <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
                    </div>
                    <NavItem v-else-if="!JMS && !item.isNew" class="leftPadding pl-2" :item="item" :use-i18n="false" />
                </template>
            </template>
        </ExpandableList>
    </div>
    <div v-if="myGroupInstanceList.length > 0" style="font-size: 14px" class="text-medium-emphasis cp-menu mt-3 ml-2">
        {{ $t('VerticalSidebar.instanceMyGroup') }}
    </div>
    <div>
        <template v-for="item in myGroupInstanceList" :key="item.title">
            <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
    </div>
</template>

<script>
import NavItem from '@/layouts/full/vertical-sidebar/NavItem/index.vue';
import BackendFactory from '@/components/api/BackendFactory';
import ExpandableList from '@/components/ui/ExpandableList.vue';
import { sortSidebarInstances } from '@/utils/instanceListDisplay';

const backend = BackendFactory.createBackend();

export default {
    components: {
        NavItem,
        ExpandableList
    },
    data: () => ({
        isLoading: true,
        instanceList: [],
        //
        myGroupInstanceList: [],
        // intervalId: null,
        runningInstances: {
            header: 'runningInstance.title'
        },
        watchRef: null
    }),
    async created() {
        await this.init();
    },
    async mounted() {
        this.EventBus.on('instances-updated', this.init);
        // 업무를 끝내거나 넘기면 칩 수가 바뀐다
        this.EventBus.on('todolist-updated', this.loadMyWorkChips);

        this.watchRef = await backend.watchInstanceList(
            () => {
                this.loadInstances();
            },
            { status: ['NEW', 'RUNNING', 'COMPLETED'] }
        );
    },
    beforeUnmount() {
        this.EventBus.off('instances-updated', this.init);
        this.EventBus.off('todolist-updated', this.loadMyWorkChips);
        if (this.watchRef) {
            backend.watchOff(this.watchRef);
        }
    },
    computed: {
        JMS() {
            return window.$jms;
        }
    },
    methods: {
        async init() {
            this.isLoading = true;
            try {
                if (window.$mode == 'ProcessGPT') {
                    await this.loadInstances();
                } else {
                    await this.loadInstancesByRole();
                    await this.loadGroupInstances();
                }
            } finally {
                this.isLoading = false;
            }
        },
        async loadInstances() {
            // 사이드바는 "가장 최근에 바뀐 인스턴스가 맨 위"다. 서버에도 updated_at 순으로 달라고 하고
            // (다른 화면은 start_date 순 기본값을 그대로 쓴다), 받은 뒤 한 번 더 정렬한다 —
            // PostgreSQL DESC 는 NULL 을 맨 앞에 두기 때문이다(날짜가 빈 오래된 인스턴스가 위로 올라오던 원인).
            let result = await backend.getInstanceListByStatus(['NEW', 'RUNNING'], { orderBy: 'updated_at', sort: 'desc' });
            if (!result) result = [];
            const processedInstances = result.map((item) => {
                const title = item.name;
                item = {
                    // icon: 'ph:cube',
                    instId: item.instId,
                    title: item.status == 'NEW' ? title + this.$t('runningInstance.running') : title,
                    to: `/instancelist/${item.instId.replace(/\./g, '_DOT_')}`,
                    BgColor: 'primary',
                    updatedAt: item.updatedAt,
                    startDate: item.startDate,
                    isNew: item.status == 'NEW',
                    isDeleted: item.is_deleted,
                    deletedAt: item.deleted_at
                };
                return item;
            });

            // 최근에 바뀐 것(updated_at, 없으면 start_date) 먼저, 삭제된 항목은 맨 아래(삭제일 내림차순)
            this.instanceList = sortSidebarInstances(processedInstances);
            this.$emit('update:instanceList', this.instanceList);
            await this.loadMyWorkChips();
        },
        /**
         * 내가 처리할 업무가 있는 인스턴스에 「내 업무 N」 칩을 단다. 상단의 「나의 업무」 목록을 없앤 대신
         * 여기서 내 차례인 인스턴스를 알아보고 들어가 확인한다. 칩을 못 읽어도 목록은 그대로 보인다.
         */
        async loadMyWorkChips() {
            if (typeof backend.getMyOpenWorkCountByInstance !== 'function') return;
            let counts = {};
            try {
                counts = await backend.getMyOpenWorkCountByInstance();
            } catch (e) {
                console.warn('[ProcessInstanceList] 내 업무 수를 읽지 못했습니다:', e);
                return;
            }
            this.instanceList = this.instanceList.map((item) => {
                const n = counts[item.instId] || 0;
                return {
                    ...item,
                    chip: n > 0 ? this.$t('ProcessInstanceList.myWork', { count: n }) : undefined,
                    chipColor: n > 0 ? 'primary' : undefined,
                    chipVariant: n > 0 ? 'flat' : undefined,
                    chipTestId: n > 0 ? 'sidebar-instance-mywork' : undefined,
                    myWorkCount: n
                };
            });
        },
        async loadInstancesByRole() {
            const roles = window.localStorage.getItem('roles');
            if (!roles) return;
            const roleList = await backend.getInstanceListByRole(roles);
            if (!roleList) return;
            this.instanceList = roleList.map((item) => {
                const title = item.instName;
                return {
                    title: title,
                    to: `/instancelist/${item.instId.replace(/\./g, '_DOT_')}`,
                    BgColor: 'primary'
                };
            });
        },
        async loadGroupInstances() {
            const groups = window.localStorage.getItem('groups');
            if (!groups) return;
            const groupList = await backend.getInstanceListByGroup(groups);
            this.myGroupInstanceList = groupList.map((item) => {
                const title = item.instName;
                return {
                    title: title,
                    to: `/instancelist/${item.instId.replace(/\./g, '_DOT_')}`,
                    BgColor: 'primary'
                };
            });
        },
        onInstancesExpanded() {
            // 확장 시 필요한 로직이 있다면 여기에 추가
        },
        onInstancesCollapsed() {
            // 축소 시 필요한 로직이 있다면 여기에 추가
        }
    }
};
</script>

<style scoped>
.empty-state {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
}
</style>
