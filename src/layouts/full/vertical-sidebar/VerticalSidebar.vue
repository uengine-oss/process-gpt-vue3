<script setup>
import { useCustomizerStore } from '@/stores/customizer';

import NavGroup from './NavGroup/index.vue';
import NavItem from './NavItem/index.vue';
import NavCollapse from './NavCollapse/NavCollapse.vue';
import ExtraBox from './extrabox/ExtraBox.vue';
import Logo from '../logo/Logo.vue';

const customizer = useCustomizerStore();
</script>

<template>
    <v-navigation-drawer left v-model="customizer.Sidebar_drawer" rail-width="70" :mobile-breakpoint="960" app
        class="leftSidebar ml-sm-5 mt-sm-5 bg-containerBg" elevation="10" :rail="customizer.mini_sidebar" expand-on-hover
        width="270">
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
                    <NavGroup :item="item" v-if="item.header" :key="item.title" />
                    <!---If Has Child -->
                    <NavCollapse class="leftPadding" :item="item" :level="0" v-else-if="item.children" />
                    <!---Single Item-->
                    <NavItem :item="item" v-else class="leftPadding" />
                    <!---End Single Item-->
                </template>
                <!-- Process Definition List -->
                <template v-if="definitions">
                    <NavCollapse class="leftPadding" :item="definitions" :level="0" />
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
import partialParse from "partial-json-parser";

import StorageBase from "@/utils/StorageBase";

export default {
    data: () => ({
        storage: null,
        sidebarItem: [
            {
            title: "dashboard.title",
                icon: 'lucide:layout-panel-top',
                BgColor: 'primary',
                to: "/dashboard2",
            },
            {
                title: "todoList.title",
                icon: 'pajamas:overview',
                BgColor: 'primary',
                to: "/todolist",
            },
            {
                title: 'calendar.title',
                icon: 'solar:calendar-line-duotone',
                BgColor: 'primary',
                to: '/apps/calendar'
            },
            {
                title: "chats.title",
                icon: 'solar:chat-round-unread-line-duotone',
                BgColor: 'primary',
                to: "/chats",
            },
            // {
            //     title: "proposals.title",
            //     icon: 'solar:chat-round-unread-line-duotone',
            //     BgColor: 'primary',
            //     to: "/proposals",
            // },
            {
                header: 'instance.title'
            },
            {
                title: "processExecution.title",
                icon: 'solar:chat-dots-linear',
                BgColor: 'primary',
                to: '/instances/chat',
            },
            {
                header: 'definitionManagement.title'
            },
            {
                title: "organizationChartDefinition.title",
                icon: 'solar:users-group-rounded-line-duotone',
                BgColor: 'primary',
                to: "/organization",
            },
            {
                title: "processDefinitionMap.title",
                icon: 'carbon:flow-connection',
                BgColor: 'primary',
                to: "/definition-map",
            },
            {
                title: "processDefinition.title",
                icon: 'carbon:flow-connection',
                BgColor: 'primary',
                to: "/definitions/chat",
            },
        ],
        definitions: null,
    }),
    created() {
        this.storage = StorageBase.getStorage("supabase");

        this.getDefinitionList();
        this.storage.watch(`proc_def`, this.getDefinitionList);
    },
    methods: {
        async getDefinitionList() {
            let def = await this.storage.getObject(`proc_def`);
            if (def) {
                var menu = {
                    title: 'processList.title',
                    icon: 'solar:list-bold',
                    BgColor: 'primary',
                    to: `/`,
                    children: []
                };
                var list = Object.values(def);
                if (list.length > 0) {
                    list.forEach(item => {
                        if (item && item.definition) {
                            var obj = {
                                title: item.definition.processDefinitionName,
                                to: `/definitions/${item.definition.processDefinitionId}`
                            }
                            menu.children.push(obj);
                        }
                    });
                }
                this.definitions = menu;
            }
        }
    }
}
</script>