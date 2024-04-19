<template>
    <v-list class="py-4 px-4 bg-containerBg">
        <NavGroup :item="instMenu" :key="instMenu.header" />
        <NavItem class="leftPadding" :item="instExecution" />
        <NavCollapse v-if="runningInstances.children.length" class="leftPadding" :item="runningInstances" :level="0" />
        <NavCollapse v-if="completeInstances.children.length" class="leftPadding" :item="completeInstances" :level="0" />
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
            disable: false,
        },
        instExecution: {
            title: "processExecution.title",
            icon: 'solar:chat-dots-linear',
            BgColor: 'primary',
            to: '/instances/chat',
            disable: false,
        },
        runningInstances: {
            title: '실행 중 인스턴스',
            // title: 'runningInstances.title',
            icon: 'solar:list-bold',
            BgColor: 'primary',
            children: [],
            disable: false,
        },
        completeInstances: {
            title: '종료된 인스턴스',
            // title: 'completeInstances.title',
            icon: 'solar:list-bold',
            BgColor: 'primary',
            children: [],
            disable: false,
        },
    }),
    async created() {
        const execution = localStorage.getItem("execution");
        if (execution == 'true') {
            this.instMenu.disable = false;
            await this.loadInstances();
        }
    },
    methods: {
        async loadInstances() {
            this.runningInstances.children = await backend.getInstanceList();
            this.runningInstances.children = this.runningInstances.children.map((item) => {
                item = {
                    title: item.instName,
                    to: `/todolist/${item.instId}`,
                }
                return item;
            });
            this.completeInstances.children = await backend.getCompleteInstanceList();
            this.completeInstances.children = this.completeInstances.children.map((item) => {
                item = {
                    title: item.instName,
                    to: `/todolist/${item.isntid}`,
                }
                return item;
            });
        },
    }
}
</script>