<script setup>
import { useCustomizerStore } from '@/stores/customizer';

import Logo from '../logo/Logo.vue';
import NavCollapse from './NavCollapse/NavCollapse.vue';
import NavGroup from './NavGroup/index.vue';
import NavItem from './NavItem/index.vue';
import ExtraBox from './extrabox/ExtraBox.vue';

const customizer = useCustomizerStore();
</script>

<template>
    <v-navigation-drawer left v-model="customizer.Sidebar_drawer" rail-width="70" :mobile-breakpoint="960" app
        class="leftSidebar ml-sm-5 mt-sm-5 bg-containerBg" elevation="10" :rail="customizer.mini_sidebar"
        expand-on-hover width="270">
        <div class="pa-5 pl-4 ">
            <Logo />
        </div>
        <!-- ---------------------------------------------- -->
        <!---Navigation -->
        <!-- ---------------------------------------------- -->
        <perfect-scrollbar class="scrollnavbar bg-containerBg overflow-y-hidden">

            <v-list class="py-4 px-4 bg-containerBg">
                <!---Menu Loop -->
                <template v-for="item in sidebarItem" :key="item.title">
                    <!---Item Sub Header -->
                    <NavGroup v-if="item.header && !item.disable" :item="item" :key="item.title" />
                    <!---If Has Child -->
                    <NavCollapse v-else-if="item.children && !disable" class="leftPadding" :item="item" :level="0" />
                    <!---Single Item-->
                    <NavItem v-else-if="!item.disable" class="leftPadding" :item="item" />
                    <!---End Single Item-->
                </template>

                <template v-if="definition">
                    <NavItem :item="definition" class="leftPadding" />
                </template>
                <!-- Process Definition List -->
                <template v-if="definitionList">
                    <NavCollapse class="leftPadding" :item="definitionList" :level="0" />
                </template>
                <!-- <Moreoption/> -->
            </v-list>
            <div class="pa-6 px-4 userbottom bg-containerBg mt-10">
                <ExtraBox />
            </div>
        </perfect-scrollbar>
    </v-navigation-drawer>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

export default {
    data: () => ({
        sidebarItem: [
            {
                title: "dashboard.title",
                icon: 'lucide:layout-panel-top',
                BgColor: 'primary',
                to: "/dashboard2",
                disable: true,
            },
            {
                title: "todoList.title",
                icon: 'pajamas:overview',
                BgColor: 'primary',
                to: "/todolist",
                disable: true,
            },
            {
                title: 'calendar.title',
                icon: 'solar:calendar-line-duotone',
                BgColor: 'primary',
                to: '/calendar',
                disable: true,
            },
            {
                title: "chats.title",
                icon: 'solar:chat-round-unread-line-duotone',
                BgColor: 'primary',
                to: "/chats",
                disable: true,
            },
            {
                header: 'instance.title',
                disable: true,
            },
            {
                title: "processExecution.title",
                icon: 'solar:chat-dots-linear',
                BgColor: 'primary',
                to: '/instances/chat',
                disable: true,
            },
            {
                header: 'definitionManagement.title',
                disable: false,
            },
            {
                title: "organizationChartDefinition.title",
                icon: 'solar:users-group-rounded-line-duotone',
                BgColor: 'primary',
                to: "/organization",
                disable: true,
            },
            {
                title: "processDefinitionMap.title",
                icon: 'carbon:flow-connection',
                BgColor: 'primary',
                to: "/definition-map",
                disable: false,
            },
            {
                title: "uiDefinition.title",
                icon: 'icon-park-outline:layout-five',
                BgColor: 'primary',
                to: "/ui-definitions/chat",
            },
        ],
        definition: null,
        definitionList: null,
    }),
    async created() {
        const isAdmin = localStorage.getItem("isAdmin");
        if (isAdmin == 'true') {
            this.definition = {
                title: "processDefinition.title",
                icon: 'tabler:device-imac-cog',
                BgColor: 'primary',
                to: "/definitions/chat",
            }
            this.getDefinitionList();
        }

        const execution = localStorage.getItem("execution");
        if (execution == 'true') {
            this.sidebarItem.forEach(item => {
                if (item.disable) {
                    item.disable = false;
                }
            });
        }
    },
    methods: {
        async getDefinitionList() {
            const backend = BackendFactory.createBackend();
            const list = await backend.listDefinition();
            if (list && list.length > 0) {
                var menu = {
                    title: 'processList.title',
                    icon: 'solar:list-bold',
                    BgColor: 'primary',
                    to: `/`,
                    children: []
                };
                list.forEach(item => {
                    console.log(item)
                    if (item.directory) {
                        var obj = {
                            title: item.name,
                            // to: `/definitions/${item.definition.processDefinitionId}`,
                            directory: true
                        }
                        menu.children.push(obj);
                    }
                    if (item && item.definition) {
                        var obj = {
                            title: item.definition.processDefinitionName,
                            to: `/definitions/${item.definition.processDefinitionId}`
                        }
                        menu.children.push(obj);
                    }
                });
                this.definitionList = menu;
            }
        }
    }
}
</script>