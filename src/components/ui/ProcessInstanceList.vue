<template>
    <div>
        <template v-for="item in instanceList" :key="item.title">
            <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
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
        runningInstances: {
            header: 'runningInstance.title',
        },
        instanceList: [],
        myGroupInstanceList: [],
        intervalId: null
    }),
    async created() {
        await this.init();
    },
    mounted() {
        this.EventBus.on('instances-updated', async () => {
            await this.init();
        });
        
        this.intervalId = setInterval(() => {
            this.init();
        }, 10000);
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
            let result = await backend.getInstanceList();
            if (!result) result = [];
            this.instanceList = result.map((item) => {
                const route = window.$mode == 'ProcessGPT' ? btoa(item.instId) : item.instId;
                const title = item.instName;
                item = {
                    // icon: 'ph:cube',
                    title: title,
                    to: `/instancelist/${route}`,
                    BgColor:'primary'
                };
                return item;
            });
            this.$emit('update:instanceList', this.instanceList);
        },
        async loadInstancesByRole(){
            const roles = window.localStorage.getItem('roles');
            if(!roles) return;
            const roleList = await backend.getInstanceListByRole(roles);
            this.instanceList = roleList.map((item) => {
                const route = window.$mode == 'ProcessGPT' ? btoa(item.instId) : item.instId;
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
                const route = window.$mode == 'ProcessGPT' ? btoa(item.instId) : item.instId;
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
