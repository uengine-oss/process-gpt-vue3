<template>
    <div>
        <!-- <NavItem class="leftPadding" :item="definitionMap" /> -->
        <NavGroup v-if="!JMS && instanceList.length > 0" :item="runningInstances" :key="runningInstances.header" />
        <template v-for="item in instanceList" :key="item.title">
            <NavItem v-if="!JMS" class="leftPadding" :item="item" :use-i18n="false" />
        </template>
        <!-- <NavCollapse v-if="!JMS" class="leftPadding" :item="runningInstances" :level="0" :type="'running-instances'" /> -->
        <!-- <NavCollapse v-if="!JMS" class="leftPadding" :item="completeInstances" :level="0" :type="'complete-instances'" /> -->
    </div>
</template>

<script>
import NavCollapse from '@/layouts/full/vertical-sidebar/NavCollapse/NavCollapse.vue';
import NavGroup from '@/layouts/full/vertical-sidebar/NavGroup/index.vue';
import NavItem from '@/layouts/full/vertical-sidebar/NavItem/index.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        NavCollapse,
        NavGroup,
        NavItem
    },
    data: () => ({
        // definitionMap: {
        //     title: "processDefinitionMap.title",
        //     icon: 'ri:layout-grid-2-line',
        //     BgColor: 'primary',
        //     to: "/definition-map",
        // },
        // runningInstances: {
        //     title: 'runningInstance.title',
        //     icon: 'solar:list-bold',
        //     BgColor: 'primary',
        //     children: [],
        // },
        // completeInstances: {
        //     title: 'completeInstance.title',
        //     icon: 'solar:list-bold',
        //     BgColor: 'primary',
        //     children: [],
        // }
        runningInstances: {
            header: 'runningInstance.title',
        },
        instanceList: [],
    }),
    async created() {
        await this.loadInstances();
    },
    mounted() {
        this.EventBus.on('instances-updated', async () => {
            await this.loadInstances();
        });
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
                    title: item.instName,
                    to: `/instancelist/${btoa(item.instId)}`
                };
                return item;
            });
            // let complatedResult = await backend.getCompleteInstanceList();
            // if (!complatedResult) complatedResult = [];
            // this.completeInstances.children = complatedResult.map((item) => {
            //     item = {
            //         title: item.instName,
            //         to: `/instancelist/${btoa(item.instId)}`
            //     };
            //     return item;
            // });
        }
    }
};
</script>
