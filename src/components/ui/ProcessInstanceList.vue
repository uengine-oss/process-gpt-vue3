<template>
    <div>
        <template v-for="item in displayedInstanceList" :key="item.title">
            <div v-if="item.isNew" class="d-flex">
                <v-progress-circular indeterminate class="mt-2" color="primary" :size="20"></v-progress-circular>
                <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
            </div>
            <NavItem v-else-if="!JMS && !item.isNew" class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
        
        <!-- 더보기/접기 버튼 -->
        <div v-if="hasMoreInstances" class="mt-2">
            <v-card @click="showMoreInstances"
                v-if="!showAllInstances" 
                class="text-center cursor-pointer pa-2"
                elevation="10"
                rounded="10"
            >
                <v-card-text class="pa-0">
                    <span class="text-caption text-primary">
                        {{ $t('VerticalSidebar.showMore') }} ({{ instanceList.length - 10 }})
                    </span>
                    <v-icon size="small" class="ml-1" color="primary">mdi-chevron-down</v-icon>
                </v-card-text>
            </v-card>
            <v-card @click="showLessInstances"
                v-else 
                class="text-center cursor-pointer pa-2"
                elevation="10"
                rounded="10"
            >
                <v-card-text class="pa-0">
                    <span class="text-caption text-primary">
                        {{ $t('VerticalSidebar.showLess') }}
                    </span>
                    <v-icon size="small" class="ml-1" color="primary">mdi-chevron-up</v-icon>
                </v-card-text>
            </v-card>
        </div>
    </div>
    <div v-if="myGroupInstanceList.length > 0"
                style="font-size:14px;"
        class="text-medium-emphasis cp-menu mt-3 ml-2"
    >{{ $t('VerticalSidebar.instanceMyGroup') }}</div>
    <div>
        <template v-for="item in myGroupInstanceList" :key="item.title">
            <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
    </div>
</template>

<script>
import NavItem from '@/layouts/full/vertical-sidebar/NavItem/index.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        NavItem
    },
    data: () => ({
        instanceList: [],
        //
        myGroupInstanceList: [],
        // intervalId: null,
        runningInstances: {
            header: 'runningInstance.title',
        },
        watchRef: null,
        showAllInstances: false, // 더보기 상태 관리
        
    }),
    async created() {
        await this.init();
    },
    async mounted() {
        this.EventBus.on('instances-updated', async () => {
            await this.init();
        });
        
        // this.intervalId = setInterval(() => {
        //     this.init();
        // }, 10000);

        this.watchRef = await backend.watchInstanceList((callback => {
            this.loadInstances();           
        }),{status: ['NEW', 'RUNNING']});
    },
    computed: {
        JMS() {
            return window.$jms;
        },
        displayedInstanceList() {
            if (this.showAllInstances || this.instanceList.length <= 10) {
                return this.instanceList;
            }
            return this.instanceList.slice(0, 10);
        },
        hasMoreInstances() {
            return this.instanceList.length > 10;
        }
    },
    methods: {
        async init() {
            if(window.$mode == 'ProcessGPT') {
                await this.loadInstances();
            } else {
                await this.loadInstancesByRole();
                await this.loadGroupInstances();
            }
        },
        async loadInstances() {
            let result = await backend.getInstanceListByStatus(["NEW", "RUNNING"]);
            if (!result) result = [];
            this.instanceList = result.map((item) => {
                const title = item.name;
                item = {
                    // icon: 'ph:cube',
                    instId: item.instId,
                    title: item.status == 'NEW' ? title + this.$t('runningInstance.running') : title,
                    to: `/instancelist/${item.instId.replace(/\./g, '_DOT_')}`,
                    BgColor:'primary',
                    updatedAt: item.updatedAt,
                    isNew: item.status == 'NEW',
                    isDeleted: item.is_deleted,
                    deletedAt: item.deleted_at
                };
                return item;
            });
            
            // isDeleted 항목을 마지막으로 정렬하고, 삭제된 항목들은 삭제일자 기준 내림차순 정렬
            this.instanceList.sort((a, b) => {
                if (a.isDeleted === b.isDeleted) {
                    if (a.isDeleted) {
                        // 둘 다 삭제된 경우 삭제일자 기준 내림차순
                        return new Date(b.deletedAt) - new Date(a.deletedAt);
                    }
                    return 0;
                }
                return a.isDeleted ? 1 : -1;
            });
            this.$emit('update:instanceList', this.instanceList);
        },
        async loadInstancesByRole(){
            const roles = window.localStorage.getItem('roles');
            if(!roles) return;
            const roleList = await backend.getInstanceListByRole(roles);
            if(!roleList) return;
            this.instanceList = roleList.map((item) => {
                const title = item.instName;
                return {
                    title: title,
                    to: `/instancelist/${item.instId.replace(/\./g, '_DOT_')}`,
                    BgColor:'primary'
                };
            });
        },
        async loadGroupInstances(){
            const groups = window.localStorage.getItem('groups');
            if(!groups) return;
            const groupList = await backend.getInstanceListByGroup(groups);
            this.myGroupInstanceList = groupList.map((item) => {
                const title = item.instName;
                return {
                    title: title,
                    to: `/instancelist/${item.instId.replace(/\./g, '_DOT_')}`,
                    BgColor:'primary'
                };
            });
        },
        showMoreInstances() {
            this.showAllInstances = true;
        },
        showLessInstances() {
            this.showAllInstances = false;
        }
        
        
    }
};
</script>
