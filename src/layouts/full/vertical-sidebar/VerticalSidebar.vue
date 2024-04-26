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
    <v-navigation-drawer
        left
        v-model="customizer.Sidebar_drawer"
        rail-width="70"
        :mobile-breakpoint="960"
        app
        class="leftSidebar ml-sm-5 mt-sm-5 bg-containerBg"
        elevation="10"
        :rail="customizer.mini_sidebar"
        expand-on-hover
        width="270"
    >
        <div class="pa-5 pl-4">
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
                    <NavCollapse v-else-if="item.children && !item.disable" class="leftPadding" :item="item" :level="0" />
                    <!---Single Item-->
                    <NavItem v-else-if="!item.disable" class="leftPadding" :item="item" />
                    <!---End Single Item-->
                </template>

                <!-- definition menu item -->
                <template v-if="definitionItem.length" v-for="item in definitionItem" :key="item.title">
                    <!---Item Sub Header -->
                    <NavGroup v-if="item.header && !item.disable" :item="item" :key="item.title" />
                    <!---If Has Child -->
                    <NavCollapse v-else-if="item.children && !item.disable" class="leftPadding" :item="item" :level="0" />
                    <!---Single Item-->
                    <NavItem v-else-if="!item.disable" class="leftPadding" :item="item" />
                    <!---End Single Item-->
                </template>
                <template v-if="definitionList">
                    <NavCollapse class="leftPadding" :item="definitionList" @update:item="(def) => (definitionList = def)" :level="0" />
                </template>
                <!-- <Moreoption/> -->
            </v-list>

            <ProcessInstanceList />

            <div class="pa-6 px-4 userbottom bg-containerBg mt-10">
                <ExtraBox />
            </div>
        </perfect-scrollbar>
    </v-navigation-drawer>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';

export default {
    components: {
        ProcessInstanceList
    },
    data: () => ({
        sidebarItem: [
            {
                title: 'dashboard.title',
                icon: 'lucide:layout-panel-top',
                BgColor: 'primary',
                to: '/dashboard2',
                disable: false
            },
            {
                title: 'todoList.title',
                icon: 'pajamas:overview',
                BgColor: 'primary',
                to: '/todolist',
                disable: false
            },
            {
                title: 'calendar.title',
                icon: 'solar:calendar-line-duotone',
                BgColor: 'primary',
                to: '/calendar',
                disable: false
            },
            {
                title: 'chats.title',
                icon: 'solar:chat-round-unread-line-duotone',
                BgColor: 'primary',
                to: '/chats',
                disable: true
            },
        ],
        definitionItem: [],
        definitionList: null
    }),
    computed: {
        useChat() {
            if (window.$mode == "ProcessGPT") {
                return true;
            }
            return false;
        }
    },
    async created() {
        const isAdmin = localStorage.getItem('isAdmin');
        if (isAdmin == 'true') {
            this.definitionItem = [
                {
                    header: 'definitionManagement.title',
                    disable: false
                },
                {
                    title: 'organizationChartDefinition.title',
                    icon: 'solar:users-group-rounded-line-duotone',
                    BgColor: 'primary',
                    to: '/organization',
                    disable: true
                },
                {
                    title: 'uiDefinition.title',
                    icon: 'icon-park-outline:layout-five',
                    BgColor: 'primary',
                    to: '/ui-definitions/chat',
                    disable: false
                },
                {
                    title: 'processDefinition.title',
                    icon: 'tabler:device-imac-cog',
                    BgColor: 'primary',
                    to: '/definitions/chat',
                    disable: false
                }
            ]
            this.getDefinitionList();
        }

        if (this.useChat) {
            this.sidebarItem.forEach((item) => {
                if (item.disable) {
                    item.disable = false;
                }
            });
            this.definitionItem.forEach((item) => {
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
                list.forEach((item) => {
                    if (item.directory) {
                        if (item.name != 'instances') {
                            var obj = {
                                title: item.name,
                                // to: `/definitions/${item.definition.processDefinitionId}`,
                                directory: true
                            };
                            menu.children.push(obj);
                        }
                    } else if (item) {
                        var obj = {};
                        if (item.path && item.path.includes('.bpmn')) {
                            obj = {
                                title: item.name,
                                to: `/definitions/${item.path.split('.')[0]}`
                            };
                            menu.children.push(obj);
                        } else if (item.path && item.path.includes('.form')) {
                            obj = {
                                title: item.name,
                                to: `/ui-definitions/${item.path.split('.')[0]}`
                            };
                            menu.children.push(obj);
                        } else if (item.definition) {
                            obj = {
                                title: item.definition.processDefinitionName,
                                to: `/definitions/${item.definition.processDefinitionId}`
                            };
                            menu.children.push(obj);
                        }
                    }
                });
                this.definitionList = menu;
            }
        }
    }
};
</script>
