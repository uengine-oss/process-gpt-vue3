<template>
    <div>
        <!-- <NavItem class="leftPadding" :item="definitionMap" /> -->
        <template v-for="item in instanceList" :key="item.title">
            <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
    </div>
</template>

<script>
import NavItem from '@/layouts/full/vertical-sidebar/NavItem/index.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import StorageBaseFactory from '@/utils/StorageBaseFactory';


export default {
    components: {
        NavItem
    },
    data: () => ({
        // definitionMap: {
        //     title: "processDefinitionMap.title",
        //     icon: 'ri:layout-grid-2-line',
        //     BgColor: 'primary',
        //     to: "/definition-map",
        // },
        runningInstances: {
            header: 'runningInstance.title',
        },
        instanceList: [],
    }),
    async created() {
        await this.loadInstances();
    },
    mounted() {
        // const storage = StorageBaseFactory.getStorage();
        // storage.watch('proc_inst', async (data) => {
        //     if(data && data.new){
        //         await this.loadInstances();
        //     }
        // });

        // this.EventBus.on('instances-updated', async () => {
        //     await this.loadInstances();
        // });
    },
    computed: {
        JMS() {
            return window.$jms;
        }
    },
    methods: {
        async loadInstances() {
            let result = await backend.getInstanceList();
            if (!result) result = [];
            this.instanceList = result.map((item) => {
                item = {
                    // icon: 'ph:cube',
                    title: item.instName,
                    to: `/instancelist/${btoa(item.instId)}`,
                    BgColor:'primary'
                };
                return item;
            });
        }
    }
};
</script>
