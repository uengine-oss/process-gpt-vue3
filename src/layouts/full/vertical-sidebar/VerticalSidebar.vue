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
        <v-row class="pa-5 pl-4 ma-0 is-sidebar-pc" >
            <Logo :style="logoPadding"/>
            <v-spacer></v-spacer>
            <v-tooltip v-if="!pal" :text="$t('processDefinitionMap.title')"
                location="bottom"
            >
                <template v-slot:activator="{ props }">
                    <v-btn icon variant="text" density="comfortable"
                        v-bind="props"
                        class="text-medium-emphasis"
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
        <div class="scrollnavbar bg-containerBg overflow-y-hidden">
            <v-list class="py-4 px-4 bg-containerBg pt-0 pb-0"
                style="display: flex; flex-direction: column; height: 100%;"
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
                <v-btn variant="text"
                    class="text-medium-emphasis d-flex align-center"
                    :to="'/definition-map'"
                    v-if="pal"
                >
                    <Icons :icon="'write'" class="mr-2" />
                    <span>{{ $t('processDefinitionMap.title') }}</span>
                </v-btn>
                <div
                    v-if="!pal && isShowProcessInstanceList"
                    style="font-size:14px;"
                    class="text-medium-emphasis cp-menu mt-3 ml-2"
                >{{ $t('VerticalSidebar.instanceList') }}</div>
                <v-col v-if="isShowProcessInstanceList && !pal" class="pa-0" style="flex: 1 1 50%; max-height: 50%; overflow: auto;">
                    <ProcessInstanceList
                        @update:instanceLists="handleInstanceListUpdate" 
                    />
                </v-col>
                <div
                    v-if="isShowProject"
                    style="font-size:14px;"
                    class="text-medium-emphasis cp-menu mt-3 ml-2"
                >
                    {{ $t('VerticalSidebar.projectList') }} 
                    <v-btn @click="openNewProject()" icon style="margin-bottom: 5px;"> <PlusIcon size="15"/> </v-btn>
                    
                </div>
                <v-col v-if="isShowProject" class="pa-0" style="flex: 1 1 50%; max-height: 50%; overflow: auto;">
                    <ProjectList/>
                </v-col>
                <div
                    v-if="isShowProject"
                    style="font-size:14px;"
                    class="text-medium-emphasis cp-menu mt-3 ml-2"
                >{{ $t('VerticalSidebar.instanceList') }}</div>
                <v-col v-if="isShowProject" class="pa-0" style="flex: 1 1 50%; max-height: 50%; overflow: auto;">
                    <ProcessInstanceList
                        @update:instanceLists="handleInstanceListUpdate" 
                    />
                </v-col>

                <v-col class="pa-0" style="flex: 0 0 auto;">
                    <!-- definition menu item -->
                    <template v-for="(item, index) in definitionItem" :key="item.title">
                        <!-- Item Sub Header -->
                        <div v-if="item.header && index === 0"
                            style="font-size:14px;"
                            class="text-medium-emphasis cp-menu mt-3 ml-2"
                        >{{ $t(item.header) }}</div>
                        <v-row v-if="item.header && !item.disable"
                            class="pa-0 ma-0" 
                        >
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
                </v-col>
                <v-col class="pa-0" style="flex: 1 1 50%; overflow: auto;">
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
                </v-col>
                <v-col class="pa-0" style="flex: 1 1; overflow: auto;">
                    <div class="text-medium-emphasis cp-menu mt-3 ml-2">{{ $t('VerticalSidebar.trash') }}</div>
                        <template v-if="deletedDefinitionList">
                            <NavCollapse v-for="(deletedDefinition, i) in deletedDefinitionList.children" :key="i"
                                :item="deletedDefinition" 
                                class="leftPadding"
                                @update:item="(deletedDefinitionList[i] = $event)" 
                                :level="0" 
                                :type="'definition-list'" 
                            />
                        </template>
                </v-col>
            </v-list>
        </div>

        <div class="pa-4 px-4 bg-containerBg">
            <ExtraBox />
        </div>
    </v-navigation-drawer>

    <v-dialog v-model="isNewProjectOpen" max-width="400" class="delete-input-details">
        <ProjectCreationForm  @close="closeNewProject" @save="createNewProject" />
    </v-dialog>


    <v-dialog v-model="isOpen" max-width="400" class="delete-input-details">
        <v-card class="pa-4 pt-2">
            <v-row class="ma-0 pa-0 pb-2" align="center">
                <v-card-title class="pa-0">{{ $t('VerticalSidebar.downloadDefinitionList') }}</v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="closeDownloadDefinitionList()" icon variant="text" density="comfortable">
                    <Icons :icon="'close'" :size="16" />
                </v-btn>
            </v-row>
            <v-text-field
                v-model="release"
                :label="$t('VerticalSidebar.saveFileName')"
                required
                class="pb-2"
            ></v-text-field>
            <v-row class="pa-0 pa-4">
                <v-spacer></v-spacer>
                <v-btn @click="downloadDefinitionList(release)" color="primary" rounded>{{ $t('VerticalSidebar.save') }}</v-btn>
            </v-row>
        </v-card>
    </v-dialog>
</template>

<script>
import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';
import ProjectList from '@/components/ui/ProjectList.vue';
import ProjectCreationForm from '@/components/apps/todolist/ProjectCreationForm.vue';

import { useCustomizerStore } from '@/stores/customizer';

import Logo from '../logo/Logo.vue';
import NavCollapse from './NavCollapse/NavCollapse.vue';
import NavGroup from './NavGroup/index.vue';
import NavItem from './NavItem/index.vue';
import ExtraBox from './extrabox/ExtraBox.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessInstanceList,
        ProjectList,
        ProjectCreationForm,
        Logo,
        NavCollapse,
        NavGroup,
        NavItem,
        ExtraBox
    },
    setup() {
        const customizer = useCustomizerStore();
        return {
            customizer
        };
    },
    data: () => ({
        sidebarItem: [],
        definitionItem: [],
        definitionList: null,
        logoPadding: '',
        instanceLists: [],
        isOpen: false,
        startDateMenu: false,
        dueDateMenu: false,
        newProjectInfo: {
            name: '',
            startDate: null,
            dueDate: null,
        },
        isNewProjectOpen: false,
        deletedDefinitionList: [],
    }),
    computed: {
        JMS() {
            return window.$jms;
        },
        mode() {
            return window.$mode;
        },
        pal() {
            return window.$pal;
        },
        isShowProcessInstanceList() {
            return this.instanceLists.length > 0;
        },
        isShowProject(){
            return true;
        },
    },
    created() {
        const isAdmin = localStorage.getItem('isAdmin');
        if (isAdmin == 'true') {
            this.loadSidebar();
        }
    },
    mounted() {
        this.EventBus.on('definitions-updated', async () => {
            await this.getDefinitionList();
        });
        if (window.$mode === 'uEngine') {
            this.logoPadding = 'padding:6px'
        }

        window.addEventListener('localStorageChange', (event) => {
            if (event.detail.key === 'isAdmin') {
                if (event.detail.value === 'true' || event.detail.value === true) {
                    this.loadSidebar();
                } else {
                    this.definitionItem = [];
                    this.definitionList = [];
                }
            }
        });
    },
    methods: {
        loadSidebar() {
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
                {
                    title: 'definitionManagement.upload',
                    icon: 'upload',
                    BgColor: 'primary',
                    to: function() {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.zip';
                        input.onchange = (event) => {
                            const file = event.target.files[0];
                            if (file) {
                                backend.uploadDefinition(file);
                            }
                        };
                        input.click();
                    },
                    disable: true
                },
                {
                    title: 'definitionManagement.release',
                    icon: 'download',
                    BgColor: 'primary',
                    disable: true,
                    to: this.openDialog
                },
            ]
            if (this.mode === 'ProcessGPT') {
                this.definitionItem = this.definitionItem.filter((item) => 
                    item.title !== 'uiDefinition.title' && item.title !== 'systemDefinition.title');
            }
            this.getDefinitionList();

            if (!this.JMS) {
                this.definitionItem.forEach((item) => {
                    if (item.disable) {
                        item.disable = false;
                    }
                });
            }
        },
        openNewProject(){
            this.isNewProjectOpen = true;
        },
        async createNewProject(value){
            await backend.putProject({
                name: value.name,
                startDate: value.startDate,
                dueDate: value.dueDate,
                endDate: null,
                status: "NEW",
                createdDate: new Date().toISOString(),
                userId: localStorage.getItem('email'),
            });
            
            this.closeNewProject();
        },
        closeNewProject(){
            this.isNewProjectOpen = false;
        },
        openDialog() {
            this.isOpen = true;
        },
        closeDownloadDefinitionList() {
            this.isOpen = false;
        },
        async downloadDefinitionList(releaseName) {
            await backend.releaseVersion(releaseName);
            this.closeDownloadDefinitionList()
        },
        async getChild(subitem) {
            let res = await backend.listDefinition(subitem.path);
            let menu = [];
            const me = this;

            if (Array.isArray(res)) {
                res.forEach((el) => {
                    var obj = {
                        title: el.name.split('.')[0],
                        type: el.name.split('.')[1],
                        BgColor: 'primary'
                    };

                    if (el.directory) {                 
                        obj.directory = true;
                        obj.children = [];
                        obj.path = el.path;
                        me.getChild(obj);
                    } else {
                        if (el.name.split('.')[1] == 'form') {
                            obj.to = `/ui-definitions/${el.path.split('.')[0]}`;
                        } else {
                            obj.to = `/definitions/${el.path.split('.')[0]}`;
                        }
                    }
                    menu.push(obj);
                });
            }
            subitem.children = menu;
        },
        async getDefinitionList() {
            const me = this
            const list = await backend.listDefinition();
            if (list && list.length > 0) {
                var menu = {
                    children: []
                };
                var deletedMenu = {
                    children: []
                };
                list.forEach((item) => {
                    if(!item.isDeleted){
                        if (item.directory) {
                            if (item.name != 'instances'  || item.name != 'archive') {
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
                    } else {
                        if (item.directory) {
                            if (item.name != 'instances'  || item.name != 'archive') {
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
                                deletedMenu.children.push(obj);
                            } else if (item.path && item.path.includes('.form')) {
                                obj = {
                                    title: item.name,
                                    to: `/ui-definitions/${item.path.split('.')[0]}`,
                                    BgColor: 'primary',
                                    type: 'form'
                                };
                                deletedMenu.children.push(obj);
                            } else if (item.definition) {
                                obj = {
                                    title: item.definition.processDefinitionName,
                                    to: `/definitions/${item.definition.processDefinitionId}`,
                                    BgColor: 'primary'
                                };
                                deletedMenu.children.push(obj);
                            }
                        }
                    }
                });
                this.definitionList = menu;
                this.deletedDefinitionList = deletedMenu;
            }
        },
        navigateTo(path) {
            if (typeof path === 'function') {
                path();
            } else {
                this.$router.push(path);
            }
        },
        handleInstanceListUpdate(instanceList) {
            this.instanceLists = instanceList;
        }
    }
};
</script>
