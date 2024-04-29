<template>
    <v-list class="py-4 px-4 bg-containerBg">
        <NavGroup :item="instMenu" :key="instMenu.header" />
        <NavItem class="leftPadding" :item="definitionMap" />
        <NavItem v-if="!instExecution.disable" class="leftPadding" :item="instExecution" />
        <NavCollapse v-if="!runningInstances.disable && runningInstances.children.length" class="leftPadding" 
            :item="runningInstances" :level="0" />
        <NavCollapse v-if="!completeInstances.disable && completeInstances.children.length" class="leftPadding" 
            :item="completeInstances" :level="0" />
    </v-list>
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
        NavItem,
    },
    data: () => ({
        instMenu: {
            header: 'instance.title',
        },
        definitionMap: {
            title: "processDefinitionMap.title",
            icon: 'ri:layout-grid-2-line',
            BgColor: 'primary',
            to: "/definition-map",
        },
        instExecution: {
            title: "processExecution.title",
            icon: 'solar:chat-dots-linear',
            BgColor: 'primary',
            to: '/instances/chat',
            disable: true,
        },
        runningInstances: {
            title: 'runningInstance.title',
            icon: 'solar:list-bold',
            BgColor: 'primary',
            children: [],
            disable: true,
        },
        completeInstances: {
            title: 'completeInstance.title',
            icon: 'solar:list-bold',
            BgColor: 'primary',
            children: [],
            disable: true,
        },
    }),
    computed: {
        useChat() {
            const execution = localStorage.getItem('execution');
            if (window.$mode == "ProcessGPT" && execution == "true") {
                return true;
            } else if (execution == "true") {
                return false;
            }
            return false;
        }
    },
    async created() {
        if (this.useChat) {
            this.instExecution.disable = false;
            this.runningInstances.disable = false;
            this.completeInstances.disable = false;
            await this.loadInstances();
        }
    },
    methods: {
        async loadInstances() {
            let result = await backend.getInstanceList();
            if(!result) result = []
            this.runningInstances.children = result.map((item) => {
                item = {
                    title: item.instName,
                    to: `/instancelist/${btoa(item.instId)}`,
                }
                return item;
            });
            let complatedResult = await backend.getCompleteInstanceList();
            if(!complatedResult) complatedResult = []
            this.completeInstances.children = complatedResult.map((item) => {
                item = {
                    title: item.instName,
                    to: `/instancelist/${btoa(item.instId)}`,
                }
                return item;
            });
        },
    }
}
</script>