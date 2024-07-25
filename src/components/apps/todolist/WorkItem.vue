<template>
    <v-card elevation="10" v-if="currentComponent" :key="updatedKey">
        <div class="px-3 py-3 pb-2 align-center">
            <div class="d-flex">
                <h5 class="text-h5 font-weight-semibold">
                    {{ activityName }}
                </h5>
                <v-chip v-if="workItemStatus" size="x-small" variant="outlined" 
                    style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center">
                    {{ workItemStatus }}
                </v-chip>
            </div>
        </div>

        <v-row :class="isMobile ? 'ma-0 pa-2 mt-2' : 'ma-0 pa-2'">
            <!-- Left -->
            <v-col
                class="pa-0"
                :cols="isMobile ? 12 : 4"
                :style="isMobile ? 'overflow: auto' : ($globalState.state.isZoomed ? 'height: calc(100vh - 70px); overflow: auto' : 'height: calc(100vh - 215px); overflow: auto')"
            >
                <div v-if="currentComponent" class="work-itme-current-component" style="height: 100%;">
                    <component 
                        :is="currentComponent" 
                        :definitionId="definitionId"
                        :work-item="workItem" 
                        :workItemStatus="workItemStatus" 
                        :isDryRun="isDryRun" 
                        :dryRunWorkItem="dryRunWorkItem"
                        :currentActivities="currentActivities"
                        @updateCurrentActivities="updateCurrentActivities"
                        @close="close"
                        @executeProcess="executeProcess"
                    ></component>
                    <v-tooltip :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                @click="$globalState.methods.toggleZoom()"
                                size="small"
                                icon
                                v-bind="props"
                                class="processVariables-zoom task-btn"
                            >
                                <!-- zoom-out(캔버스 확대), zoom-in(캔버스 축소) -->
                                <Icons
                                    :icon="!$globalState.state.isZoomed ? 'zoom-out' : 'zoom-in'"
                                    :width="32"
                                    :height="32"
                                />
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>
            </v-col>
            <!-- Right -->
            <v-col class="pa-0" :cols="isMobile ? 12 : 8">
                <v-alert class="pa-0 mt-4" color="#2196F3" variant="outlined">
                    <v-tabs v-model="selectedTab">
                        <v-tab value="progress">진행 상황</v-tab>
                        <v-tab v-if="messages && messages.length > 0" value="history">워크 히스토리</v-tab>
                        <v-tab v-if="messages" value="agent">Agent 초안 생성</v-tab>
                    </v-tabs>
                    <v-window v-model="selectedTab">
                        <v-window-item value="progress">
                            <div
                                class="pa-2"
                                :style="$globalState.state.isZoomed ? 'height: calc(100vh - 130px);' : 'height: calc(100vh - 280px); color: black; overflow: auto'"
                            >
                                <div class="pa-0 pl-2" style="height:100%;" :key="updatedDefKey">
                                    <div v-if="bpmn" style="height: 100%">
                                        <BpmnUengine
                                            ref="bpmnVue"
                                            :bpmn="bpmn"
                                            :options="options"
                                            :isViewMode="true"
                                            :currentActivities="currentActivities"
                                            v-on:error="handleError"
                                            v-on:shown="handleShown"
                                            v-on:openDefinition="(ele) => openSubProcess(ele)"
                                            v-on:loading="handleLoading"
                                            v-on:openPanel="(id) => openPanel(id)"
                                            v-on:update-xml="(val) => $emit('update-xml', val)"
                                            v-on:definition="(def) => (definitions = def)"
                                            v-on:add-shape="onAddShape"
                                            v-on:done="setDefinition"
                                            v-on:change-sequence="onChangeSequence"
                                            v-on:remove-shape="onRemoveShape"
                                            v-on:change-shape="onChangeShape"
                                            style="height: 100%"
                                        ></BpmnUengine>
                                        
                                        <!-- <process-definition
                                            style="height: 100%"
                                            :currentActivities="currentActivities"
                                            :bpmn="bpmn"
                                            :key="updatedDefKey"
                                            :isViewMode="true"
                                        ></process-definition> -->
                                    </div>
                                    <div v-else class="no-bpmn-found-text">No BPMN found</div>
                                </div>
                            </div>
                        </v-window-item>
                        <v-window-item value="history" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component
                                            :is="'work-history-' + mode"
                                            :messages="messages"
                                            :isCompleted="isCompleted"
                                            @clickMessage="navigateToWorkItemByTaskId"
                                        />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                        <v-window-item value="agent" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component
                                            :is="'work-history-' + mode"
                                            :messages="[]"
                                            :html="html"
                                            :formData="formData"
                                            :isAgentMode="true"
                                        />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                    </v-window>
                </v-alert>
            </v-col>
        </v-row>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
// import ProcessDefinition from '@/components/ProcessDefinition.vue';
import DefaultWorkItem from './DefaultWorkItem.vue';
import FormWorkItem from './FormWorkItem.vue'; // FormWorkItem 컴포넌트 임포트
import URLWorkItem from './URLWorkItem.vue';
import BpmnUengine from '@/components/BpmnUengine.vue';

import WorkItemChat from '@/components/ui/WorkItemChat.vue';
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';
import customBpmnModule from '@/components/customBpmn';

const backend = BackendFactory.createBackend();
export default {
    props: {
        definitionId: {
            type: String,
            required: true
        },
        taskId: String,
        isDryRun: {
            type: Boolean,
            default: false
        },
        dryRunWorkItem: Object
    },
    components: {
        // ProcessDefinition,
        DefaultWorkItem,
        FormWorkItem,
        URLWorkItem,
        'work-history-uEngine': WorkItemChat,
        'work-history-ProcessGPT': ProcessInstanceChat,
        BpmnUengine,
    },
    data: () => ({    
        workItem: null,
        workListByInstId: null,
        windowWidth: window.innerWidth,
    
        // bpmn
        bpmn: null,
        options: {
            propertiesPanel: {},
            additionalModules: [customBpmnModule]
        },
        currentComponent: null,
        currentActivities: [],
        
        // status variables
        updatedKey: 0,
        updatedDefKey: 0,
        selectedTab: 'progress',
        eventList: [],
        html: null,
        formData: null
    }),
    created() {
        this.init();
        this.EventBus.on('process-definition-updated', async () => {
            this.updatedDefKey++;
        });
        this.EventBus.on('html-updated', (newHtml) => {
            this.html = newHtml
        });
        this.EventBus.on('formData-updated', (newformData) => {
            this.formData = newformData
        });
        window.addEventListener('resize', this.handleResize);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.handleResize);
    },
    computed: {
        mode() {
            return window.$mode;
        },
        currentTaskId() {
            return this.taskId ? this.taskId : this.$route.params.taskId
        },
        messages() {
            if (!this.workListByInstId) return [];
            return this.workListByInstId.map((workItem) => ({
                profile: 'https://avatars0.githubusercontent.com/u/9064066?v=4&s=460',
                roleName: workItem.task.roleName,
                _item: workItem,
                content: workItem.title,
                description: workItem.description,
                timeStamp: workItem.startDate
            }));
        },
        activityName(){
            if(!this.workItem) return null
            return this.workItem.activity.name;
        },
        workItemStatus() {
            if(!this.workItem) return null;
            if(this.isDryRun) return 'NEW'

            return this.workItem.worklist.status;
        },
        isCompleted() {
            return this.workItemStatus == "COMPLETED" || this.workItemStatus == "DONE"
        },
        isMobile() {
            return this.windowWidth <= 700;
        }
    },
    watch: {
        windowWidth(newWidth) {
            if (newWidth <= 700) {
                this.isMobile = true;
            } else {
                this.isMobile = false;
            }
        }
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if(me.isDryRun) {
                        me.bpmn = await backend.getRawDefinition(me.definitionId, { type: 'bpmn' });
                        me.workItem = me.dryRunWorkItem
                       
                        me.currentComponent = me.workItem.activity.tool.includes('urlHandler') ? 'URLWorkItem' : (me.workItem.activity.tool.includes('formHandler') ? 'FormWorkItem' : 'DefaultWorkItem');

                        me.currentActivities = [me.workItem.activity.tracingTag];
                    } else {
                        me.workItem = await backend.getWorkItem(me.currentTaskId);
                        me.bpmn = await backend.getRawDefinition(me.workItem.worklist.defId, { type: 'bpmn' });
                        if (me.workItem.worklist.execScope) me.workItem.execScope = me.workItem.worklist.execScope;
                        me.workListByInstId = await backend.getWorkListByInstId(me.workItem.worklist.instId);
                        me.currentComponent = me.workItem.worklist.tool.includes('urlHandler') ? 'URLWorkItem' : (me.workItem.worklist.tool.includes('formHandler') ? 'FormWorkItem' : 'DefaultWorkItem');
                        if (me.workItem.worklist.currentActivities) {
                            me.currentActivities = me.workItem.worklist.currentActivities;
                        } else {
                            me.currentActivities = me.workListByInstId.map((item) => {
                                if(item.status != 'COMPLETED' && item.status != 'DONE') {
                                    return item.tracingTag;
                                }
                            });
                        }
                    }
                    me.updatedDefKey++;
                }
            });
        },
        handleResize() {
            this.windowWidth = window.innerWidth;
        },
        updateCurrentActivities(currentActivities){
            if(!currentActivities) currentActivities = []

            this.currentActivities = currentActivities
            this.updatedDefKey++;
        },
        close(){
            this.$emit('close')
        },
        navigateToWorkItemByTaskId(obj) {
            var me = this;
            me.$router.push(`/todolist/${obj._item.taskId}`);
            this.$nextTick(() => {
                me.delay(500).then(() => {
                    me.init();
                    me.updatedKey++;
                });
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        executeProcess(value) {
            this.$emit('executeProcess', value)
        }
    }
};
</script>
<style>
.work-itme-current-component .v-checkbox .v-input__details {
    display: none;
}
.work-itme-current-component .v-checkbox {
    height: 40px;
}
.work-itme-current-component .v-checkbox label {
    opacity: 0.6 !important;
}
.work-itme-current-component .form-checkbox-label {
    font-size: 20px;
    font-weight: 500;
}
.work-itme-current-component .form-radio-box {
    margin-top: 25px;
}
.work-itme-current-component .form-radio-box .v-radio-group {
    margin-top: 8px;
}
.work-itme-current-component .form-radio-box .form-radio-label {
    font-size: 20px;
    font-weight: 500;
}

.work-itme-current-component .form-label {
    font-size: 20px;
    font-weight: 500;
}

.processExecute {
    position: absolute;
    right: 80px;
    top: 20px;
    z-index: 1;
}
</style>
