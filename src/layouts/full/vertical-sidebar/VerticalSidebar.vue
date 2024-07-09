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
        width="275"
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

                <!-- <ProcessInstanceList /> -->

                <!-- definition menu item -->
                <template v-for="item in definitionItem" :key="item.title">
                    <!-- Item Sub Header -->
                    <v-row v-if="item.header && !item.disable"
                        class="pa-0 ma-0" 
                    >
                        <NavGroup :item="item" :key="item.title" />
                        <template v-for="subItem in definitionItem" :key="subItem.title">
                            <v-tooltip v-if="subItem.title" location="bottom" :text="$t(subItem.title)">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-if="!subItem.header && !subItem.disable"
                                        @click="navigateTo(subItem.to)"
                                        v-bind="props"
                                        icon variant="text" 
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                    >
                                        <Icon :icon="subItem.icon" width="20" height="20" />    
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </template>
                    </v-row>
                    <NavCollapse v-else-if="item.children && !item.disable" class="leftPadding" :item="item" :level="0" />

                    <!-- 하단 목록으로 뿌려주던 리스트 형식 메뉴 -->
                    <!-- <NavItem v-else-if="!item.disable && !item.header" class="leftPadding" :item="item" /> -->
                </template>
                <template v-if="definitionList">
                    <!-- 정의 목록 리스트 -->
                    <NavCollapse class="leftPadding" :item="definitionList" @update:item="(def) => (definitionList = def)" :level="0" :type="'definition-list'" />
                </template>
                <!-- <Moreoption/> -->
            </v-list>
        </perfect-scrollbar>

        <div class="pa-6 px-4 bg-containerBg">
            <ExtraBox />
        </div>
    </v-navigation-drawer>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
// import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';

const backend = BackendFactory.createBackend();

export default {
    components: {
        // ProcessInstanceList
    },
    data: () => ({
        sidebarItem: [],
        definitionItem: [],
        definitionList: null
    }),
    computed: {
        JMS() {
            return window.$jms;
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
                    title: 'systemDefinition.title',
                    icon: 'solar:server-line-duotone',
                    BgColor: 'primary',
                    to: '/system',
                    disable: true
                },
                {
                    title: 'uiDefinition.title',
                    icon: 'icon-park-outline:layout-five',
                    BgColor: 'primary',
                    to: '/ui-definitions/chat',
                    disable: true
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

        if (!this.JMS) {
            this.definitionItem.forEach((item) => {
                if (item.disable) {
                    item.disable = false;
                }
            });
        }
    },
    mounted() {
        this.EventBus.on('definitions-updated', async () => {
            await this.getDefinitionList();
        });
        this.EventBus.on('instances-updated', async () => {
            await this.loadInstances();
        });
    },
    methods: {
        async getDefinitionList() {
            const list = await backend.listDefinition();
            if (list && list.length > 0) {
                var menu = {
                    title: 'processList.title',
                    icon: 'solar:list-bold',
                    BgColor: 'primary',
                    to: `/`,
                    children: []
                };
                let instanceList = await backend.getInstanceList();
                if (!instanceList) instanceList = [];
                instanceList = instanceList.map((item) => {
                    item = {
                        title: item.instName,
                        to: `/instancelist/${btoa(item.instId)}`,
                        type:'instance'
                    };
                    menu.children.push(item);
                    return item;
                });
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
        },
        navigateTo(path) {
            this.$router.push(path);
        },
    }
};
</script>
