<template>
    <v-card elevation="10" v-if="currentComponent" :key="updatedKey"  :style="isMobile ? 'margin-top: 10px;' : ''">
        <div class="pa-2 pb-0 pl-4 align-center">
            <div class="d-flex align-center"
                :style="isMobile ? 'display: block !important;' : ''"
            >
                <h5 class="text-h5 font-weight-semibold">
                    {{ activityName }}
                </h5>
                <v-row class="pa-0 pt-1 pb-1 ma-0 align-center">
                    <v-chip v-if="workItemStatus" size="x-small" variant="outlined" 
                        style = "margin: 2px 0px 0px 5px !important; display: flex; align-items: center"
                        :style="isMobile ? 'margin: 0px !important;' : ''">
                        {{ workItemStatus }}
                    </v-chip>
                    <v-tooltip :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-if="!isMobile" 
                                @click="$globalState.methods.toggleZoom()"
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
                </v-row>
            </div>
        </div>

        <v-row :class="isMobile ? 'ma-0 pa-0' : 'ma-0 pa-0'">
            <!-- Left -->
            <v-col :cols="isMobile ? 12 : 5"
                :class="isMobile ? 'pa-4 pt-0 order-last' : 'pa-0 pt-3 pl-4 pb-4'"
            >
                <v-alert class="pa-0 primary-border" variant="outlined">
                    <!-- 데스크톱: 기존 탭 -->
                    <div v-if="!isMobile">
                        <v-tabs v-model="selectedTab" color="primary">
                            <template v-if="inFormNameTabs && inFormNameTabs.length > 0">
                                <v-tab v-for="(inFormNameTab, index) in inFormNameTabs" :key="index" :value="`form-${index}`">
                                    {{ inFormNameTab }}
                                </v-tab>
                            </template>
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
                        </v-tabs>
                    </div>
                    
                    <!-- 모바일: 버튼 형태 -->
                    <div v-else class="pa-2">
                        <div class="d-flex flex-wrap ga-2">
                            <template v-if="inFormNameTabs && inFormNameTabs.length > 0">
                                <v-btn
                                    v-for="(inFormNameTab, index) in inFormNameTabs"
                                    :key="index"
                                    :variant="selectedTab === `form-${index}` ? 'flat' : 'text'"
                                    :color="selectedTab === `form-${index}` ? 'primary' : 'default'"
                                    size="small"
                                    @click="selectedTab = `form-${index}`"
                                >
                                    {{ inFormNameTab }}
                                </v-btn>
                            </template>
                            <v-btn
                                v-for="tab in tabList"
                                :key="tab.value"
                                :variant="selectedTab === tab.value ? 'flat' : 'text'"
                                :color="selectedTab === tab.value ? '' : 'default'"
                                :style="selectedTab === tab.value ? 'background-color: #808080; color: white;' : ''"
                                size="small"
                                @click="selectedTab = tab.value"
                            >
                                {{ tab.label }}
                                <v-icon
                                    v-if="tab.value == 'agent' && isAddedNewForm"
                                    class="bouncing-arrow-horizontal-left ml-1" 
                                    color="primary" 
                                    size="small"
                                >
                                    mdi-arrow-left-bold
                                </v-icon>
                            </v-btn>
                        </div>
                    </div>
                    <v-window v-model="selectedTab"
                        :style="$globalState.state.isZoomed ? 'height: calc(100vh - 130px); overflow: auto' : 'height: calc(100vh - 257px); color: black; overflow: auto'"
                        :touch="false"
                    >
                        <v-window-item v-if="isTabAvailable('progress')" value="progress">
                            <div
                                class="pa-2"
                                :style="$globalState.state.isZoomed ? 'height: calc(100vh - 130px);' : 'height: calc(100vh - 260px); color: black; overflow: auto'"

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
                                            :instanceId="workItem?.worklist?.instId"
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
                        <v-window-item v-if="isTabAvailable('history')" value="history" class="pa-2">
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
                        <v-window-item v-if="isTabAvailable('chatbot')" value="chatbot" class="pa-2">
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
                        <v-window-item v-if="isTabAvailable('agent-monitor')" value="agent-monitor" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <BrowserAgent :html="html" :workItem="workItem" />
                                <AgentMonitor :html="html" :workItem="workItem" :key="updatedDefKey"/>
                            </v-card>
                        </v-window-item>
                        <v-window-item v-if="isTabAvailable('agent-feedback')" value="agent-feedback" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <AgentFeedback :workItem="workItem"/>
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
                        <v-window-item v-if="isTabAvailable('output')" value="output" class="pa-2">
                            <InstanceOutput :instance="processInstance" :isInWorkItem="true" />
                        </v-window-item>
                    </v-window>
                </v-alert>
            </v-col>
            <!-- Right -->
            <v-col
                class="pa-0"
                :cols="isMobile ? 12 : 7"
                :class="isMobile ? 'order-first' : ''"
                :style="isMobile ? 'overflow: auto' : ($globalState.state.isZoomed ? 'height: calc(100vh - 70px); overflow: auto' : 'height: calc(100vh - 190px); overflow: auto')"
            >
                <div v-if="currentComponent && !isNotExistDefaultForm" class="work-itme-current-component" style="height: 100%;">
                    <div :style="isMobile ? 'top: 90px;' : 'top: 70px;'" style="position: absolute; right: 28px; z-index: 9999;">
                        <v-btn v-if="hasGeneratedContent"
                            @click="resetGeneratedContent"
                            :disabled="isGeneratingExample"
                            :class="isMobile ? 'mr-1 text-medium-emphasis' : 'pl-5 pr-6 mr-1'"
                            :icon="isMobile"
                            :variant="isMobile ? 'outlined' : 'flat'"
                            :size="isMobile ? 'small' : 'default'"
                            :rounded="!isMobile"
                            density="comfortable"
                            :style="isMobile ? 'border-color: #e0e0e0 !important;' : 'background-color: #808080; color: white;'"
                        >
                            <v-icon>mdi-delete-outline</v-icon>
                            <span v-if="!isMobile" class="ms-1">예시 초기화</span>
                        </v-btn>
                        <v-btn
                            v-if="!isMobile"
                            class="pl-5 pr-6 mr-1" 
                            density="comfortable"
                            rounded
                            style="background-color: #808080; color: white;"
                            @click="beforeGenerateExample"
                            :loading="isGeneratingExample"
                            :disabled="isGeneratingExample"
                        >
                            <template v-if="!isGeneratingExample">
                                <v-row v-if="generator">
                                    <v-icon>mdi-refresh</v-icon>
                                    <span class="ms-2">예시 재생성</span>
                                </v-row>
                                <v-row v-else>
                                    <Icons :icon="'sparkles'" :size="20" />
                                    <div class="ms-1">빠른 예시 생성</div>
                                </v-row>
                            </template>
                        </v-btn>
                        <div v-if="isSimulate == 'true'" style="margin-left: 10px;">
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
                                :disabled="isGeneratingExample"
                            >
                                <v-icon>{{ showFeedbackForm ? 'mdi-close' : 'mdi-message-reply-text' }}</v-icon>
                                <span v-if="!showFeedbackForm" class="ms-2">{{ $t('feedback') || 'Feedback' }}</span>
                            </v-btn>
                        </div>
                        <v-btn v-if="isMobile"
                            @click="beforeGenerateExample"
                            :loading="isGeneratingExample"
                            :disabled="isGeneratingExample"
                            class="mr-1 text-medium-emphasis"
                            density="comfortable"
                            icon
                            variant="outlined"
                            size="small"
                            style="border-color: #e0e0e0 !important;"
                        >
                            <template v-if="!isGeneratingExample">
                                <v-icon v-if="generator">mdi-refresh</v-icon>
                                <Icons v-else :icon="'sparkles'" :size="'16'" />
                            </template>
                        </v-btn>
                        <v-btn v-if="!isMicRecording && !isMicRecorderLoading" @click="startVoiceRecording()"
                            class="mr-1 text-medium-emphasis"
                            density="comfortable"
                            icon
                            variant="outlined"
                            size="small"
                            style="border-color: #e0e0e0 !important;"
                            :disabled="isGenerationFinished"
                        >
                            <Icons :icon="'sharp-mic'" :size="'16'" />
                        </v-btn>
                        <v-btn v-else-if="!isMicRecorderLoading" @click="stopVoiceRecording()"
                            class="mr-1 text-medium-emphasis"
                            density="comfortable"
                            icon
                            variant="outlined"
                            size="small"
                            style="border-color: #e0e0e0 !important;"
                            :disabled="isGenerationFinished"
                        >
                            <Icons :icon="'stop'" :size="'16'" />
                        </v-btn>
                        <Icons v-if="isMicRecorderLoading" :icon="'bubble-loading'" />
                    </div>
                    <component 
                        class="work-item-current-component-box"
                        :is="currentComponent" 
                        :definitionId="definitionId"
                        :work-item="workItem" 
                        :workItemStatus="workItemStatus" 
                        :isDryRun="isDryRun" 
                        :dryRunWorkItem="dryRunWorkItem"
                        :currentActivities="currentActivities"
                        :isOwnWorkItem="isOwnWorkItem"
                        @updateCurrentActivities="updateCurrentActivities"
                        @close="close"
                        @executeProcess="executeProcess"
                        :is-simulate="isSimulate"
                        :is-finished-agent-generation="isFinishedAgentGeneration"
                        :processDefinition="processDefinition"
                    ></component>
                </div>
                <div v-else-if="isNotExistDefaultForm">
                    <div class="d-flex justify-center align-center" style="height: 100%;">
                        <div class="text-center">
                            <v-icon size="100" color="grey-lighten-1">mdi-form-textbox</v-icon>
                            <h3 class="mt-4 text-grey-darken-1">해당 단계의 입력 폼이 없습니다.</h3>
                            <p class="mt-2 text-grey-darken-2">기본 폼을 생성하여 입력 폼이 없는 단계들에 사용하실 수 있습니다.</p>
                            <v-btn 
                                color="primary" 
                                class="mt-4"
                                @click="goToDefaultForm"
                                variant="flat"
                                size="large"
                            >
                                <v-icon class="mr-2">mdi-plus</v-icon>
                                기본 폼 생성하러 가기
                            </v-btn>
                        </div>
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
import InstanceOutput from './InstanceOutput.vue';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
import AgentMonitor from '@/views/markdown/AgentMonitor.vue';
import BrowserAgent from '@/components/BrowserAgent.vue';

import WorkItemChat from '@/components/ui/WorkItemChat.vue';
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';
import customBpmnModule from '@/components/customBpmn';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import AgentFeedback from './AgentFeedback.vue';
import exampleGenerator from '@/components/ai/WorkItemAgentGenerator.js';
import JSON5 from 'json5';
import partialParse from 'partial-json-parser';
import axios from 'axios';

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
        activityIndex: Number,
        isStarted: {
            type: Boolean,
            default: false
        },
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
        FormDefinition,
        InstanceOutput,
        AgentMonitor,
        AgentFeedback,
        BrowserAgent
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
        selectedTab: 'history',
        
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

        processInstance: null,
        generator: null,
        imgKeyList: [],
        isVisionMode: false,
        isGeneratingExample: false,
        
        // Audio recording
        newMessage: '',
        isMicRecording: false,
        isMicRecorderLoading: false,
        micRecorder: null,
        micAudioChunks: [],

        isNotExistDefaultForm: false,
    }),
    created() {
        // this.init();
        this.EventBus.on('process-definition-updated', async () => {
            this.updatedDefKey++;
        });
        this.EventBus.on('html-updated', (newHtml) => {
            if(newHtml === '<NotExistDefaultForm/>') {
                this.isNotExistDefaultForm = true;
            } else {
                this.html = newHtml
                if(this.isSimulate == 'true' && !this.generator) {
                    this.beforeGenerateExample();
                }
            }
        });
        this.EventBus.on('formData-updated', (newformData) => {
            this.formData = newformData
        });
        this.EventBus.on('form-data-loaded', (formData) => {
            this.inFormNameTabs = formData.inFormNameTabs;
            this.inFormValues = formData.inFormValues;
        });
        window.addEventListener('resize', this.handleResize);
    },
    async mounted() {
        await this.init();
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.handleResize);
    },
    computed: {
        hasGeneratedContent() {
            // 생성 중인 경우
            if (this.isGeneratingExample) return true;
            
            // generator가 있고 이전 메시지가 있는 경우
            if (this.generator && this.generator.previousMessages && this.generator.previousMessages.length > 0) return true;
            
            // 오디오 메시지가 있는 경우
            if (this.newMessage && this.newMessage.trim()) return true;
            
            // formData에 실제 값이 있는지 확인
            if (this.formData && typeof this.formData === 'object') {
                for (const key of Object.keys(this.formData)) {
                    const value = this.formData[key];
                    if (value && typeof value === 'string' && value.trim() !== '') {
                        return true;
                    }
                }
            }
            
            return false;
        },
        isOwnWorkItem() {
            if (this.isStarted || this.isSimulate == 'true') {
                return true
            }
            const email = localStorage.getItem('email')
            return this.workItem.worklist.endpoint.includes(email)
        },
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
            return window.innerWidth <= 768;
        },
        tabList() {
            if (this.mode == 'ProcessGPT') {
                if(this.bpmn && this.isStarted) {
                    return [
                        { value: 'progress', label: this.$t('WorkItem.progress') },
                    ]
                } else if (this.bpmn && !this.isStarted && this.isCompleted) {
                    return [
                        // { value: 'output', label: this.$t('InstanceCard.output') }, //산출물
                        { value: 'progress', label: this.$t('WorkItem.progress') }, //프로세스
                        { value: 'agent-monitor', label: this.$t('WorkItem.agentMonitor') }, //에이전트에 맡기기
                        { value: 'agent-feedback', label: '에이전트 피드백' },
                    ]
                } else if (this.bpmn && !this.isStarted && !this.isCompleted) {
                    return [
                        { value: 'history', label: this.$t('WorkItem.history') }, //액티비티
                        { value: 'progress', label: this.$t('WorkItem.progress') }, //프로세스
                        // { value: 'chatbot', label: this.$t('WorkItem.chatbot') },
                        { value: 'agent-monitor', label: this.$t('WorkItem.agentMonitor') }, //에이전트에 맡기기
                        { value: 'agent-feedback', label: '에이전트 피드백' },
                        // { value: 'output', label: this.$t('InstanceCard.output') }, //산출물
                    ]
                } else {
                    return [
                        { value: 'chatbot', label: this.$t('WorkItem.chatbot') }, //어시스턴트
                        { value: 'agent-feedback', label: '에이전트 피드백' },
                    ]
                }
                
            } else {
                return[
                    { value: 'history', label: this.$t('WorkItem.history') }, //액티비티
                    { value: 'progress', label: this.$t('WorkItem.progress') }, //프로세스
                    { value: 'agent-feedback', label: '에이전트 피드백' },
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
            if (newWidth <= 768) {
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
        inFormNameTabs(newVal) {
            console.log(newVal);
        },
        selectedTab(newTab) {
            // 현재 탭이 사용 가능한 탭 목록에 있는지 확인
            if (!this.isTabAvailable(newTab)) {
                // 사용 가능한 첫 번째 탭으로 변경
                const firstAvailableTab = this.tabList[0];
                if (firstAvailableTab) {
                    this.selectedTab = firstAvailableTab.value;
                }
            }
        }
    },
    methods: {
        isTabAvailable(tabValue) {
            return this.tabList.some(tab => tab.value === tabValue);
        },
        async startVoiceRecording() {
            this.isMicRecording = true;

            if (!navigator.mediaDevices) {
                alert('getUserMedia를 지원하지 않는 브라우저입니다.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.micRecorder = new MediaRecorder(stream);
            this.micAudioChunks = [];
            this.micRecorder.ondataavailable = e => {
                this.micAudioChunks.push(e.data);
            };
            this.micRecorder.start();
        },
        stopVoiceRecording() {
            this.isMicRecording = false;
            // MediaRecorder의 상태가 'recording'인 경우에만 stop 메서드를 호출
            if (this.micRecorder && this.micRecorder.state === 'recording') {
                this.micRecorder.stop();
                this.micRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.micAudioChunks, { type: 'audio/wav' });
                    await this.uploadAudio(audioBlob);
                };
            }
        },
        async uploadAudio(audioBlob) {
            this.isMicRecorderLoading = true; // 로딩 상태 시작

            const formData = new FormData();
            formData.append('audio', audioBlob);

            try {
                const response = await axios.post(`/execution/upload`, formData);
                const data = response.data;
                this.newMessage = data.transcript;
                this.beforeGenerateExample();
            } catch (error) {
                console.error('Error:', error);
            } finally {
                this.isMicRecorderLoading = false; // 로딩 상태 종료
            }
        },
        hasUnclosedTripleBackticks(inputString) {
            // 백틱 세 개의 시작과 끝을 찾는 정규 표현식
            const regex = /`{3}/g;
            let match;
            let isOpen = false;

            // 모든 백틱 세 개의 시작과 끝을 찾습니다
            while ((match = regex.exec(inputString)) !== null) {
                // 현재 상태를 토글합니다 (열림 -> 닫힘, 닫힘 -> 열림)
                isOpen = !isOpen;
            }

            // 마지막으로 찾은 백틱 세 개가 닫혀있지 않은 경우 true 반환
            return isOpen;
        },
        extractJSON(inputString, checkFunction) {
            try {
                JSON5.parse(inputString); // if no problem, just return the whole thing
                return inputString;
            } catch (e) {}

            if (this.hasUnclosedTripleBackticks(inputString)) {
                inputString = inputString + '\n```';
            }

            // 정규 표현식 정의
            //const regex = /^.*?`{3}(?:json)?\n(.*?)`{3}.*?$/s;
            let regex = /```(?:json)?\s*([\s\S]*?)\s*```/;
            
            // 정규 표현식을 사용하여 입력 문자열에서 JSON 부분 추출
            let match = inputString.match(regex);
            // 매치된 결과가 있다면, 첫 번째 캡쳐 그룹(즉, JSON 부분)을 반환
            if (match) {
                if (checkFunction)
                    match.forEach((shouldBeJson) => {
                        const lastIndex = shouldBeJson.lastIndexOf('}');
                        const result = shouldBeJson.slice(0, lastIndex + 1);
                        if (checkFunction(result)) return result;
                    });
                else return match[1];
            } else {
                regex = /\{[\s\S]*\}/
                match = inputString.match(regex);
                return match && match[0] ? match[0] : null;
            }

            // 매치된 결과가 없으면 null 반환
            return null;
        },
        async resizeBase64Image(base64Str, minWidth, minHeight) {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = base64Str;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > minWidth) {
                            height *= minWidth / width;
                            width = minWidth;
                        }
                    } else {
                        if (height > minHeight) {
                            width *= minHeight / height;
                            height = minHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL());
                };
            });
        },
        async beforeGenerateExample() {
            if(!this.generator) {
                this.generator = new exampleGenerator(this, {
                    isStream: true,
                    preferredLanguage: 'Korean'
                });
            }            
            

            this.isGeneratingExample = true;
            this.isVisionMode = false
            this.imgKeyList = []
        
            if(this.formData && typeof this.formData == 'object'){
                for (const key of Object.keys(this.formData)) {
                    if(this.formData[key] && (typeof this.formData[key] == 'string' && this.formData[key].includes("data:image/"))){
                        this.imgKeyList.push(key)
                        this.isVisionMode = true
                        this.generator.previousMessages = []
                        const resizedImage = await this.resizeBase64Image(this.formData[key], 512, 512);
                        this.generator.previousMessages.push({
                            "content": [
                                {
                                    "type": "text",
                                    "text": "해당 이미지를 분석하고 이미지 분석 내용을 자세하게 한글로 설명해. 이미지에 표시된 날짜, 글자 위주로 집중 분석한 결과를 설명해. 결과는 최대한 정확하고 자세하지만 최대한 요약해서 생성해주면 좋아."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": resizedImage
                                    }
                                }
                            ],
                            "role": "user"
                        });
                        this.generator.model = "gpt-4-vision-preview";
                    } 
                }
            }
            if(this.isVisionMode){
                this.generator.generate()
            } else {
                if(this.newMessage){
                    this.generateExample(this.newMessage, 'audio')
                } else {
                    this.generateExample()
                }
            }
        },
        resetGeneratedContent() {
            // 생성 중인 상태 초기화
            this.isGeneratingExample = false;
            
            // 비전 모드 관련 초기화
            this.isVisionMode = false;
            this.imgKeyList = [];
            
            // 생성기 초기화
            if(this.generator) {
                this.generator.previousMessages = [];
                this.generator = null;
            }
            
            // 오디오 메시지 초기화
            this.newMessage = '';
            
            // 폼 데이터에서 이미지 데이터 제거
            if(this.formData && typeof this.formData === 'object') {
                for (const key of Object.keys(this.formData)) {
                    if(this.formData[key] && typeof this.formData[key] === 'string' && this.formData[key].includes("data:image/")) {
                        this.formData[key] = '';
                    }
                }
            }
            
            // 컴포넌트 다시 렌더링을 위한 키 업데이트
            this.updatedKey++;
        },
        async generateExample(response, type){
            var me = this
            this.isVisionMode = false
            
            this.generator = new exampleGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
                        
            this.generator.model = "gpt-4o";
            
            if(response){
                if(type == 'audio'){
                    this.generator.previousMessages.push({
                        "content": "오디오 내용을 보고 오디오 내용을 개선해서 예시를 생성해. 오디오 내용을 기반으로 생성해야하고 오디오에 관한 언급은 하면 안돼. 오디오 내용과 생성될 내용이 달라서도 안돼. 적당한 수준의 보완, 정리만 해서 생성해.",
                        "role": "user"
                    })
                    this.generator.previousMessages.push({
                        "content": "오디오 내용: " + response,
                        "role": "user"
                    })
                } else if(type == 'vision'){
                    this.generator.previousMessages.push({
                        "content": "첨부된 이미지에 대한 설명: " + response,
                        "role": "user"
                    })
                }
            }
            if(this.processInstance && this.processInstance.instId){
                const instance = await backend.getInstance(this.processInstance.instId);
                this.generator.previousMessages.push({
                    "content": "이전 작업 내역 리스트: " + JSON.stringify(instance),
                    "role": "user"
                })
            } else if(this.simulationInstances && this.simulationInstances.length > 0) {
                this.generator.previousMessages.push({
                    "content": "이전 작업 내역 리스트: " + JSON.stringify(this.simulationInstances),
                    "role": "user"
                })
            } else {
                this.generator.previousMessages.push({
                    "content": "이전 작업 내역 리스트: []",
                    "role": "user"
                })
            }

            this.generator.previousMessages.push({
                "content": "현재 작업 입력 양식: " + this.html,
                "role": "user"
            })

            let formData = JSON.parse(JSON.stringify(me.formData))
            if(this.imgKeyList.length > 0){
                this.imgKeyList.forEach(function (key){
                    delete formData[key]
                })
                me.imgKeyList = []
            }
            let formValues = {
                "formValues": formData
            }
            this.generator.previousMessages.push({
                "content": "생성해야할 답변 형식: " + JSON.stringify(formValues),
                "role": "user"
            })
            const userList = await backend.getUserList();
            this.generator.previousMessages.push({
                "content": "유저 목록: " + JSON.stringify(userList),
                "role": "user"
            })
            const organization = await backend.getOrganization(`db://configuration/organization`, {key: 'key'});
            if(organization && organization.value){
                this.generator.previousMessages.push({
                    "content": "회사 조직도: " + JSON.stringify(organization.value),
                    "role": "user"
                })
            }

            this.generator.generate()
        },
        onModelCreated(response) {
            //
        },
        onGenerationFinished(response) {
            var me = this
            me.$try({
                action: async () => {
                    if(me.isVisionMode){
                        me.generateExample(response, 'vision')
                    } else {
                        let jsonData = response;
                        if (typeof response == 'string') {
                            jsonData = me.extractJSON(response);
                            if(jsonData && jsonData.includes('{')){
                                try {
                                    jsonData = JSON.parse(jsonData);
                                } catch(e) {
                                    jsonData = partialParse(jsonData)
                                }
                            } else {
                                jsonData = null
                            }
                        }
                        if(jsonData && jsonData['formValues'] && Object.keys(jsonData['formValues']).length > 0){
                            me.EventBus.emit('form-values-updated', jsonData['formValues']);
                            me.agentGenerationFinished(jsonData);
                        } else {
                            me.agentGenerationFinished(null);
                        }
                        me.isGeneratingExample = false;
                        me.newMessage = null;
                    }
                },
                errorMsg: '초안 생성을 실패하였습니다. 잠시 후 다시 시도해주세요.',
                finalAction: () => {
                    me.isGeneratingExample = false;
                    me.newMessage = null;
                }
            });
            
        },
        addedNewForm(){
            this.isFinishedAgentGeneration = false
        },
        agentGenerationFinished(value) {
            if(this.isSimulate == 'true') {
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
                        if(me.isSimulate == 'true' && me.processDefinition.bpmn) {
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

                        if (me.mode !== 'ProcessGPT') {
                            // FormWorkItem 데이터 로드
                            await me.loadRefForm();
                        }
                    }

                    if(me.workItem.worklist && me.workItem.worklist.instId) {
                        me.taskStatus = await backend.getActivitiesStatus(me.workItem.worklist.instId);
                        me.processInstance = await backend.getInstance(me.workItem.worklist.instId);
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
        },
        goToDefaultForm() {
            this.$router.push('/ui-definitions/defaultform');
        }
    }
};
</script>
<style>
.primary-border {
    border-color: rgb(var(--v-theme-primary)) !important;
}

.feedback-container {
    position: absolute;
    bottom: 3px;
    right: 35px;
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
