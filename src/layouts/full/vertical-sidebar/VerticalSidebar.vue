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
        :mobile-breakpoint="1279"
        app
        class="leftSidebar ml-sm-5 mt-sm-5 bg-containerBg"
        elevation="10"
        :rail="customizer.mini_sidebar"
        expand-on-hover
        width="275"
    >
        <v-row class="pa-5 pl-4 ma-0 is-sidebar-pc">
            <Logo :style="logoPadding"/>
            <v-spacer></v-spacer>
            <v-tooltip :text="$t('processDefinitionMap.title')"
                location="bottom"
            >
                <template v-slot:activator="{ props }">
                    <v-btn icon variant="text"
                        v-bind="props"
                        class="text-medium-emphasis"
                        density="comfortable"
                        :to="'/definition-map'"
                    >
                        <Icons :icon="'write'" />
                    </v-btn>
                </template>
            </v-tooltip>
        </v-row>
        <div class="pa-5 pl-4 is-sidebar-mobile">
            <Logo />
        </div>
        <!-- ---------------------------------------------- -->
        <!---Navigation -->
        <!-- ---------------------------------------------- -->
        <perfect-scrollbar class="scrollnavbar bg-containerBg overflow-y-hidden">
            <v-list class="py-4 px-4 bg-containerBg"
                style="height: 100%;"
            >
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
                <ProcessInstanceList :style="definitionList ? 'max-height: 47%; overflow: auto;' : 'max-height: 93%; overflow: auto;'" 
                    @update:instanceList="handleInstanceListUpdate" 
                />

                <!-- definition menu item -->
                <template v-for="item in definitionItem" :key="item.title">
                    <!-- Item Sub Header -->
                    <v-row v-if="item.header && !item.disable"
                        class="pa-0 pl-2 ma-0" 
                    >
                        <NavGroup :item="item" :key="item.title" />
                        <template v-for="subItem in definitionItem" :key="subItem.title">
                            <v-tooltip v-if="subItem.title" location="bottom" :text="$t(subItem.title)">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-if="!subItem.header && !subItem.disable"
                                        @click="navigateTo(subItem.to)"
                                        v-bind="props"
                                        icon variant="text" 
                                        class="text-medium-emphasis cp-menu"
                                        density="comfortable"
                                    >
                                        <Icons :icon="subItem.icon" :size="20" />    
                                    </v-btn>
                                </template>
                            </v-tooltip>
                        </template>
                    </v-row>
                    <NavCollapse v-else-if="item.children && !item.disable" class="leftPadding" :item="item" :level="0" />
                </template>
                <div :style="instanceList.length > 0 ? 'max-height: 47%; overflow: auto;' : 'max-height: 93%; overflow: auto;'">
                    <template v-if="definitionList">
                        <!-- 정의 목록 리스트 -->
                            <NavCollapse v-for="(definition, i) in definitionList.children" :key="i"
                                :item="definition" 
                                class="leftPadding"
                                @update:item="(def) => (definitionList[i] = def)" 
                                :level="0" 
                                :type="'definition-list'" 
                            />
                    </template>
                </div>
            </v-list>
        </perfect-scrollbar>

        <div class="pa-4 px-4 bg-containerBg">
            <ExtraBox />
        </div>
    </v-navigation-drawer>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';

const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessInstanceList
    },
    data: () => ({
        sidebarItem: [],
        definitionItem: [],
        definitionList: null,
        logoPadding: '',
        instanceList: []
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
                    title: 'processDefinition.title',
                    icon: 'ibm-process-mining',
                    BgColor: 'primary',
                    to: '/definitions/chat',
                    disable: false
                },
                {
                    title: 'uiDefinition.title',
                    icon: 'document',
                    BgColor: 'primary',
                    to: '/ui-definitions/chat',
                    disable: true
                },
                {
                    title: 'organizationChartDefinition.title',
                    icon: 'users-group-rounded-line-duotone',
                    BgColor: 'primary',
                    to: '/organization',
                    disable: true
                },
                {
                    title: 'systemDefinition.title',
                    icon: 'server-line-duotone',
                    BgColor: 'primary',
                    to: '/system',
                    disable: true
                },
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
        if (window.$mode === 'uEngine') {
            this.logoPadding = 'padding:6px'
        }
        // this.EventBus.on('instances-updated', async () => {
        //     await this.loadInstances();
        // });
    },
    methods: {
        async getChild(subitem) {
            let res = await backend.listDefinition(subitem.path);
            let menu = [];
            const me = this
            res.forEach((el) => {
                var obj = {
                    title: el.name.split('.')[0],
                    type: el.name.split('.')[1],
                    BgColor : 'primary'
                };

                if (el.directory) {                 
                    obj.directory = true;
                    obj.children = [];
                    obj.path = el.path
                    me.getChild(obj)
                } else {
                    if (el.name.split('.')[1] == 'form') {
                        obj.to = `/ui-definitions/${el.path.split('.')[0]}`;
                    } else {
                        obj.to = `/definitions/${el.path.split('.')[0]}`;
                    }
                }
                menu.push(obj);
            });
            subitem.children = menu;
        },
        async getDefinitionList() {
            const me = this
            const list = await backend.listDefinition();
            if (list && list.length > 0) {
                var menu = {
                    
                    children: []
                };
                list.forEach((item) => {
                    if (item.directory) {
                        if (item.name != 'instances') {
                            var obj = {
                                title: item.name,
                                icon: 'outline-folder',
                                // to: `/definitions/${item.definition.processDefinitionId}`,
                                directory: true,
                                BgColor: 'primary',
                                path: item.path
                            };
                            me.getChild(obj)
                            menu.children.push(obj);
                        }
                    } else if (item) {
                        var obj = {};
                        if (item.path && item.path.includes('.bpmn')) {
                            obj = {
                                title: item.name,
                                to: `/definitions/${item.path.split('.')[0]}`,
                                BgColor: 'primary',
                                type: 'bpmn'
                            };
                            menu.children.push(obj);
                        } else if (item.path && item.path.includes('.form')) {
                            obj = {
                                title: item.name,
                                to: `/ui-definitions/${item.path.split('.')[0]}`,
                                BgColor: 'primary',
                                type: 'form'
                            };
                            menu.children.push(obj);
                        } else if (item.definition) {
                            obj = {
                                title: item.definition.processDefinitionName,
                                to: `/definitions/${item.definition.processDefinitionId}`,
                                BgColor: 'primary'
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
        handleInstanceListUpdate(instanceList) {
            this.instanceList = instanceList;
        }
    }
};
</script>
