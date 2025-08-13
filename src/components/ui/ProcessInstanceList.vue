<template>
    <div>
        <template v-for="item in instanceList" :key="item.title">
            <div v-if="item.isNew" class="d-flex">
                <v-progress-circular indeterminate class="mt-2" color="primary" :size="20"></v-progress-circular>
                <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
            </div>
            <NavItem v-else-if="!JMS && !item.isNew" class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
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
                const route = window.$mode == 'ProcessGPT' ? btoa(encodeURIComponent(item.instId)) : item.instId;
                item = {
                    // icon: 'ph:cube',
                    instId: item.instId,
                    title: item.status == 'NEW' ? title + this.$t('runningInstance.running') : title,
                    to: `/instancelist/${route}`,
                    BgColor:'primary',
                    updatedAt: item.updatedAt,
                    isNew: item.status == 'NEW'
                };
                return item;
            });
            this.$emit('update:instanceList', this.instanceList);
        },
        async loadInstancesByRole(){
            const roles = window.localStorage.getItem('roles');
            if(!roles) return;
            const roleList = await backend.getInstanceListByRole(roles);
            if(!roleList) return;
            this.instanceList = roleList.map((item) => {
                const route = window.$mode == 'ProcessGPT' ? btoa(encodeURIComponent(item.instId)) : item.instId;
                const title = item.instName;
                return {
                    title: title,
                    to: `/instancelist/${route}`,
                    BgColor:'primary'
                };
            });
        },
        async loadGroupInstances(){
            const groups = window.localStorage.getItem('groups');
            if(!groups) return;
            const groupList = await backend.getInstanceListByGroup(groups);
            this.myGroupInstanceList = groupList.map((item) => {
                const route = window.$mode == 'ProcessGPT' ? btoa(encodeURIComponent(item.instId)) : item.instId;
                const title = item.instName;
                return {
                    title: title,
                    to: `/instancelist/${route}`,
                    BgColor:'primary'
                };
            });
        }
        
        
    }
};
</script>
