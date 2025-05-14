<template>
    <v-card elevation="10" v-if="currentComponent" :key="updatedKey">
        <div class="pa-2 pb-0 pl-4 align-center"
            style="height: 40px;"
        >
            <div class="d-flex align-center">
                <h5 class="text-h5 font-weight-semibold">
                    {{ activityName }}
                </h5>
                <v-chip v-if="workItemStatus" size="x-small" variant="outlined" 
                    style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center">
                    {{ workItemStatus }}
                </v-chip>
                <v-tooltip :text="$t('processDefinition.zoom')">
                    <template v-slot:activator="{ props }">
                        <v-btn @click="$globalState.methods.toggleZoom()"
                            class="ml-1"
                            size="x-small"
                            icon="$vuetify" variant="text"
                            v-bind="props"
                        >
                            <Icons
                                :icon="!$globalState.state.isZoomed ? 'zoom-out' : 'zoom-in'"
                                :size="20"
                            />
                        </v-btn>
                    </template>
                </v-tooltip>
                <!-- <v-tooltip v-if="isSimulate == 'true'" text="이전 단계">
                    <template v-slot:activator="{ props }">
                        <v-btn @click="backToPrevStep"
                            class="ml-1"
                            size="x-small"
                            icon="mdi-arrow-left"
                            v-bind="props"
                            :disabled="activityIndex == 0"
                        >
                            
                        </v-btn>
                    </template>
                </v-tooltip> -->
                <v-btn v-if="isSimulate == 'true'" :disabled="activityIndex == 0" @click="backToPrevStep" density="compact" rounded>이전 단계</v-btn>
            </div>
        </div>

        <v-row :class="isMobile ? 'ma-0 pa-0' : 'ma-0 pa-0'">
            <!-- Left -->
            <v-col :cols="isMobile ? 12 : 5"
                :class="isMobile ? 'pa-4 pt-3' : 'pa-0 pt-3 pl-4 pb-4'"
            >
                <v-alert class="pa-0" color="#2196F3" variant="outlined">
                    <v-tabs v-model="selectedTab">
                        <v-tab v-if="inFormNameTabs && inFormNameTabs.length > 0" v-for="(inFormNameTab, index) in inFormNameTabs" :key="index" :value="`form-${index}`">
                            {{ inFormNameTab }}
                        </v-tab>
                        <v-tab v-for="tab in tabList" :key="tab.value" :value="tab.value">
                            {{ tab.label }} 
                            <v-icon
                                v-if="tab.value == 'agent' && isAddedNewForm"
                                class="bouncing-arrow-horizontal-left" 
                                color="primary" 
                                size="large"
                            >
                                mdi-arrow-left-bold
                            </v-icon>
                        </v-tab>
                        <!-- <v-tab value="progress">{{ $t('WorkItem.progress') }}</v-tab>
                        <v-tab v-if="messages && messages.length > 0" value="history">{{ $t('WorkItem.history') }}</v-tab>
                        <v-tab v-if="messages" value="agent">{{ $t('WorkItem.agent') }}</v-tab> -->
                    </v-tabs>
                    <v-window v-model="selectedTab">
                        <v-window-item value="progress">
                            <div
                                class="pa-2"
                                :style="$globalState.state.isZoomed ? 'height: calc(100vh - 130px);' : 'height: calc(100vh - 210px); color: black; overflow: auto'"
                            >
                                <div class="pa-0 pl-2" style="height:100%;" :key="updatedDefKey">
                                    <div v-if="bpmn" style="height: 100%">
                                        <BpmnUengine
                                            ref="bpmnVue"
                                            :bpmn="bpmn"
                                            :options="options"
                                            :isViewMode="true"
                                            :currentActivities="currentActivities"
                                            :taskStatus="taskStatus"
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
                        <v-window-item value="chatbot" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component
                                            :is="'work-history-' + mode"
                                            :messages="[]"
                                            :useThreadId="true"
                                        />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                        <v-window-item value="agent" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar v-if="messages" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div :key="agentRenderKey" class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component
                                            :is="'work-history-' + mode"
                                            :messages="[]"
                                            :html="html"
                                            :formData="formData"
                                            :isAgentMode="true"
                                            :simulationInstances="simulationInstances"
                                            @agentGenerationFinished="agentGenerationFinished"
                                        />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                        <v-window-item v-for="(inFormNameTab, index) in inFormNameTabs" :key="index" :value="`form-${index}`">
                           <DynamicForm 
                                v-if="inFormValues[index]?.html" 
                                ref="dynamicForm" 
                                :formHTML="inFormValues[index]?.html" 
                                v-model="inFormValues[index].formData" 
                                :readonly="true"
                                class="dynamic-form">
                            </DynamicForm>
                        </v-window-item>
                    </v-window>
                </v-alert>
            </v-col>
            <!-- Right -->
            <v-col
                class="pa-0"
                :cols="isMobile ? 12 : 7"
                :style="isMobile ? 'overflow: auto' : ($globalState.state.isZoomed ? 'height: calc(100vh - 70px); overflow: auto' : 'height: calc(100vh - 190px); overflow: auto')"
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
                        :is-simulate="isSimulate"
                        :is-finished-agent-generation="isFinishedAgentGeneration"
                        :processDefinition="processDefinition"
                    ></component>
                    
                    <div v-if="isSimulate == 'true'" class="feedback-container">
                        <FormDefinition
                            ref="formDefinition"
                            type="simulation"
                            :formId="formId"
                            :simulation_data="simulation_data"
                            @addedNewForm="addedNewForm"
                            v-model="tempFormHtml"
                            v-if="showFeedbackForm"
                            class="feedback-form"
                        />   
                        <v-btn 
                            class="feedback-btn" 
                            fab 
                            elevation="2" 
                            color="primary" 
                            @click="toggleFeedback"
                        >
                            <v-icon>{{ showFeedbackForm ? 'mdi-close' : 'mdi-message-reply-text' }}</v-icon>
                            <span v-if="!showFeedbackForm" class="ms-2">{{ $t('feedback') || 'Feedback' }}</span>
                        </v-btn>
                    </div>
                </div>
            </v-col>
        </v-row>
    </v-card>
</template>

<script>
import FormDefinition from '@/components/FormDefinition.vue';
import BackendFactory from '@/components/api/BackendFactory';
// import ProcessDefinition from '@/components/ProcessDefinition.vue';
import DefaultWorkItem from './DefaultWorkItem.vue';
import FormWorkItem from './FormWorkItem.vue'; // FormWorkItem 컴포넌트 임포트
import URLWorkItem from './URLWorkItem.vue';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';

import WorkItemChat from '@/components/ui/WorkItemChat.vue';
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';
import customBpmnModule from '@/components/customBpmn';
import DynamicForm from '@/components/designer/DynamicForm.vue';

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
        dryRunWorkItem: Object,
        isSimulate:  {
            type: String,
            default: 'false'
        },
        simulationInstances: Array,
        processDefinition: Object,
        activityIndex: Number
    },
    components: {
        // ProcessDefinition,
        DefaultWorkItem,
        FormWorkItem,
        URLWorkItem,
        'work-history-uEngine': WorkItemChat,
        'work-history-ProcessGPT': ProcessInstanceChat,
        BpmnUengine,
        DynamicForm,
        FormDefinition
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
        taskStatus: null,

        // status variables
        updatedKey: 0,
        updatedDefKey: 0,

        // WorkItem Tabs
        selectedTab: 'progress',
        
        eventList: [],

        html: null,
        formData: null,

        // Form data
        inFormNameTabs: [],
        inFormValues: [],

        isFinishedAgentGeneration: false,
        showFeedbackForm: false,
        tempFormHtml: null,
        formId: null,
        simulation_data: {},
        agentRenderKey: 0,
        isAddedNewForm: false,
    }),
    created() {
        // this.init();
        this.EventBus.on('process-definition-updated', async () => {
            this.updatedDefKey++;
        });
        this.EventBus.on('html-updated', (newHtml) => {
            this.html = newHtml
        });
        this.EventBus.on('formData-updated', (newformData) => {
            this.formData = newformData
        });
        this.EventBus.on('form-data-loaded', (formData) => {
            this.inFormNameTabs = formData.inFormNameTabs;
            this.inFormValues = formData.inFormValues;
        });
        window.addEventListener('resize', this.handleResize);

        if(this.isSimulate == 'true') {
            if(this.processDefinition && 
            this.processDefinition['activities'] && 
            this.processDefinition['activities'][this.activityIndex] && !this.processDefinition['activities'][this.activityIndex].inputFormData){
                setTimeout(() => {
                    this.selectedTab = 'agent';
                }, 1500);
            }
        }
    },
    async mounted() {
        await this.init();
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.handleResize);
    },
    computed: {
        mode() {
            return window.$mode;
        },
        pal() {
            return window.$pal;
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
        },
        tabList() {
            if (this.mode == 'ProcessGPT') {
                if(this.bpmn) {
                    return [
                        { value: 'progress', label: this.$t('WorkItem.progress') },
                        // { value: 'history', label: this.$t('WorkItem.history') },
                        { value: 'chatbot', label: this.$t('WorkItem.chatbot') },
                        { value: 'agent', label: this.$t('WorkItem.agent') },
                    ]
                } else {
                    return [
                        { value: 'chatbot', label: this.$t('WorkItem.chatbot') },
                        { value: 'agent', label: this.$t('WorkItem.agent') },
                    ]
                }
                
            } else {
                return[
                    { value: 'progress', label: this.$t('WorkItem.progress') },
                    { value: 'history', label: this.$t('WorkItem.history') },
                    { value: 'agent', label: this.$t('WorkItem.agent') },
                ]

                // if(this.inFormNameTabs.length > 0) {
                //     this.inFormNameTabs.forEach((tab, index) => {
                //         tabList.push({ value: `form-${index}`, label: tab });
                //     });
                // }
            }
        },
    },
    watch: {
        windowWidth(newWidth) {
            if (newWidth <= 700) {
                this.isMobile = true;
            } else {
                this.isMobile = false;
            }
        },
        "$route": {
            handler(newVal, oldVal) {
                if (newVal.params.taskId && newVal.params.taskId != oldVal.params.taskId) {
                    this.init();
                }
            },
            deep: true
        },
        selectedTab(newVal) {
            if(newVal == 'agent'){
                this.agentRenderKey++;
                this.isAddedNewForm = false
            }
        },
        inFormNameTabs(newVal) {
            console.log(newVal);
        }
    },
    methods: {
        addedNewForm(){
            this.isAddedNewForm = true
            this.isFinishedAgentGeneration = false
        },
        agentGenerationFinished(value) {
            if(this.isSimulate == 'true') {
                // setTimeout(() => {
                //     this.executeProcess();
                // }, 2000);
                this.$emit('agentGenerationFinished', value)
                this.isFinishedAgentGeneration = true;
                setTimeout(() => {
                    this.selectedTab = 'progress';
                }, 1500);
            }
        },
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.isDryRun) {
                        me.workItem = me.dryRunWorkItem
                        me.currentActivities = [me.workItem.activity.tracingTag];
                        if(me.isSimulate == 'true') {
                            me.bpmn = me.processDefinition.bpmn;
                        } else {
                            me.bpmn = await backend.getRawDefinition(me.definitionId, { type: 'bpmn' });
                        }
                    } else {
                        me.workItem = await backend.getWorkItem(me.currentTaskId);
                        me.bpmn = await backend.getRawDefinition(me.workItem.worklist.defId, { type: 'bpmn', version: me.workItem.worklist.defVerId });
                        if (me.workItem.worklist.execScope) me.workItem.execScope = me.workItem.worklist.execScope;
                        me.workListByInstId = await backend.getWorkListByInstId(me.workItem.worklist.instId);
                        
                        let tmp = {}
                        tmp[me.workItem?.activity?.tracingTag] = "Running"
                        me.taskStatus = tmp
                        
                        if (me.workItem.worklist.currentActivities) {
                            me.currentActivities = me.workItem.worklist.currentActivities;
                        } else {
                            me.currentActivities = me.workListByInstId.map((item) => item.tracingTag);
                        }

                        // FormWorkItem 데이터 로드
                        await me.loadRefForm();
                    }
                    if(me.workItem.worklist) {
                        me.taskStatus = await backend.getActivitiesStatus(me.workItem.worklist.instId);
                    }

                    if (me.mode == 'ProcessGPT' && !me.pal) {
                        me.currentComponent = 'FormWorkItem';
                    } else {
                        me.currentComponent = me.workItem.activity.tool.includes('urlHandler') ? 'URLWorkItem' : (me.workItem.activity.tool.includes('formHandler') ? 'FormWorkItem' : 'DefaultWorkItem');
                    }

                    me.updatedDefKey++;
                },
                errorMsg: '워크아이템을 찾을 수 없습니다.'
            });
        },
        async loadRefForm() {
            var me = this;
            if(!me.workItem || !me.workItem.activity) return;
            if (me.workItem && me.workItem.worklist && me.workItem.activity && !me.workItem.activity.inParameterContexts) {
                const refForms = await backend.getRefForm(me.workItem.worklist.taskId);
                refForms.forEach((refForm) => {
                    const tabName = `${me.$t('WorkItem.previous')} (${refForm.name}) ${me.$t('WorkItem.inputForm')}`;
                    me.inFormNameTabs.push(tabName);
                    me.inFormValues.push({'html': refForm.html, 'formData': refForm.formData});
                    me.selectedTab = `form-0`;
                });
                return;
            }

            me.inFormNameTabs = [];
            me.inFormValues = [];

            const promises = me.workItem.activity.inParameterContexts.map(async inParameterContext => {
                const formName = inParameterContext.variable.name; 
                const variable = await backend.getVariableWithTaskId(
                    me.workItem.worklist.instId, 
                    me.$route.params.taskId, 
                    formName
                );
                
                if(Array.isArray(variable)) { 
                    const itemPromises = variable.map(async (item, idx) => {
                        const form = await backend.getRawDefinition(item.formDefId, { type: 'form' });
                        me.inFormNameTabs.push(item.subProcessLabel || `${formName}-${idx + 1}`);
                        me.inFormValues.push({'html': form, 'formData': item.valueMap});
                    });
                    await Promise.all(itemPromises);
                } else if(variable) {
                    const form = await backend.getRawDefinition(variable.formDefId, { type: 'form' });
                    me.inFormNameTabs.push(variable.subProcessLabel || formName);
                    me.inFormValues.push({'html': form, 'formData': variable.valueMap});
                }
            });
            
            await Promise.all(promises);
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
            this.showFeedbackForm = false
            this.$emit('executeProcess', value)
        },
        backToPrevStep() {
            this.$emit('backToPrevStep');
        },
        async toggleFeedback() {
            this.showFeedbackForm = !this.showFeedbackForm;
            if(this.showFeedbackForm){
                this.formId = this.processDefinition.processDefinitionId + '_' + this.dryRunWorkItem.activity.tracingTag + '_form'
                this.simulation_data = {
                    proc_def_id: this.processDefinition.processDefinitionId,
                    element_id: this.dryRunWorkItem.activity.tracingTag
                }
                if(window.location.pathname == '/definition-map'){
                    this.tempFormHtml = localStorage.getItem(this.formId);
                } else {
                    this.tempFormHtml = await backend.getRawDefinition(this.formId, { type: 'form' })
                }
            }
        }
    }
};
</script>
<style>
.feedback-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    align-items: flex-end;
    z-index: 100;
}

.feedback-btn {
    display: flex;
    align-items: center;
    border-radius: 20px !important;
    height: 40px !important;
    min-width: 40px;
    padding: 0 15px;
}

.feedback-form {
    margin-right: 15px;
    width: 500px;
    max-height: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    background-color: white;
    overflow: hidden;
    transition: all 0.3s ease;
}
</style>
