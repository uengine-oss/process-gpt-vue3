<template>
    <v-card
        elevation="10"
        style="background-color: rgba(255, 255, 255, 0)"
        :class="{ 'is-deleted': isDeleted, 'user-left-part': !isAdmin }"
    >
        <v-card v-if="isConsultingMode">
            <div :key="chatRenderKey">
                <div style="display: none;">
                    <process-definition
                        class="process-definition-resize"
                        :bpmn="bpmn"
                        :isViewMode="true"
                        :key="definitionChangeCount"
                        :isXmlMode="isXmlMode"
                        :definitionPath="fullPath"
                        :definitionChat="this"
                        @update="updateDefinition"
                        @update:processVariables="(val) => (processVariables = val)"
                    ></process-definition>
                </div>
                <div style="position: relative;">
                    <Chat
                        :messages="messages"
                        :userInfo="userInfo"
                        :agentInfo="agentInfo"
                        :type="'consulting'"
                        :ProcessGPTActive="ProcessGPTActive"
                        @requestDraftAgent="requestDraftAgent"
                        @requestFile="requestFile"
                        @beforeReply="beforeReply"
                        @sendMessage="beforeSendMessage"
                        @startProcess="startProcess"
                        @cancelProcess="cancelProcess"
                        @deleteWorkList="deleteWorkList"
                        @deleteAllWorkList="deleteAllWorkList"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                        @toggleProcessGPTActive="toggleProcessGPTActive"
                    ></Chat>
                </div>
            </div>
        </v-card>
        <AppBaseCard v-else>
            <template v-slot:leftpart>
                <h5 v-if="!isAdmin" class="text-h5 font-weight-semibold pa-3" style="background-color: white;">
                    {{ projectName }}
                </h5>
                <process-definition
                    class="process-definition-resize"
                    :bpmn="bpmn"
                    :isAIGenerated="isAIGenerated"
                    :processDefinition="processDefinition"
                    :key="definitionChangeCount"
                    :isViewMode="isViewMode"
                    :isXmlMode="isXmlMode"
                    :definitionPath="fullPath"
                    :definitionChat="this"
                    :isAdmin="isAdmin"
                    :generateFormTask="generateFormTask"
                    :isPreviewPDFDialog="isPreviewPDFDialog"
                    @closePDFDialog="isPreviewPDFDialog = false"
                    @update="updateDefinition"
                    @changeBpmn="changeBpmn"
                    @changeElement="changeElement"
                    @onLoaded="onLoadBpmn()"
                    @update:processVariables="(val) => (processVariables = val)"
                ></process-definition>
                <process-definition-version-dialog
                    :process="processDefinition"
                    :loading="loading"
                    :open="versionDialog"
                    :definitionPath="fullPath"
                    :processName="projectName"
                    :type="'bpmn'"
                    @close="toggleVersionDialog"
                    @save="beforeSaveDefinition"
                ></process-definition-version-dialog>
                <ProcessDefinitionVersionManager
                    :process="processDefinition"
                    :open="verMangerDialog"
                    :type="'bpmn'"
                    @close="toggleVerMangerDialog"
                    @changeXML="changeXML"
                ></ProcessDefinitionVersionManager>
                <v-dialog v-model="deleteDialog" max-width="500">
                    <v-card class="pa-4">
                        <v-row class="ma-0 pa-0 mb-8">
                            <v-card-text class="ma-0 pa-0" style="font-size:24px;">
                                {{ $t('processDefinition.deleteProcessMessage') }}
                            </v-card-text>
                            <v-spacer></v-spacer>
                            <v-btn @click="deleteDialog = false" icon variant="text" density="comfortable"
                                style="margin-top:-8px;"
                            >
                                <Icons :icon="'close'" :size="16" />
                            </v-btn>
                        </v-row>
                        <v-row class="ma-0 pa-0">
                            <v-spacer></v-spacer>
                            <v-btn color="error" rounded variant="flat" @click="deleteProcess">{{ $t('processDefinition.delete') }}</v-btn>
                        </v-row>
                    </v-card>
                </v-dialog>
                <v-dialog v-model="restoreDialog" max-width="500">
                    <v-card class="pa-4">
                        <v-row class="ma-0 pa-0 mb-8">
                            <v-card-text class="ma-0 pa-0" style="font-size:24px;">
                                {{ $t('processDefinition.restoreProcessMessage') }}
                            </v-card-text>
                            <v-spacer></v-spacer>
                            <v-btn @click="restoreDialog = false" icon variant="text" density="comfortable"
                                style="margin-top:-8px;"
                            >
                                <Icons :icon="'close'" :size="16" />
                            </v-btn>
                        </v-row>
                        <v-row class="ma-0 pa-0">
                            <v-spacer></v-spacer>
                            <v-btn color="error" rounded variant="flat" @click="restoreProcess">{{ $t('processDefinition.restore') }}</v-btn>
                        </v-row>
                    </v-card>
                </v-dialog>
            </template>
            <template v-slot:rightpart>
                <div v-if="isAdmin" class="no-scrollbar">
                    <Chat
                        :prompt="prompt"
                        :name="projectName"
                        :messages="messages"
                        :chatInfo="chatInfo"
                        :userInfo="userInfo"
                        :lock="lock"
                        :disableChat="disableChat"
                        :chatRoomId="chatRoomId"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                    >
                        <template v-slot:custom-title>
                            <ProcessDefinitionChatHeader v-model="projectName" :bpmn="bpmn" :fullPath="fullPath" 
                                :lock="lock" :editUser="editUser" :userInfo="userInfo" :isXmlMode="isXmlMode" 
                                :isEditable="isEditable"
                                :chatMode="chatMode"
                                :isDeleted="isDefinitionDeleted"
                                @handleFileChange="handleFileChange" @toggleVerMangerDialog="toggleVerMangerDialog" 
                                @executeProcess="executeProcess" @executeSimulate="executeSimulate"
                                @toggleLock="toggleLock" @showXmlMode="showXmlMode" @beforeDelete="beforeDelete"
                                @beforeRestore="beforeRestore" @savePDF="savePDF"
                                @createFormUrl="createFormUrl" @toggleMarketplaceDialog="toggleMarketplaceDialog" />
                        </template>
                    </Chat>
                </div>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat
                    v-if="isAdmin"
                    :prompt="prompt"
                    :name="projectName"
                    :messages="messages"
                    :chatInfo="chatInfo"
                    :userInfo="userInfo"
                    :lock="lock"
                    :disableChat="disableChat"
                    :chatRoomId="chatRoomId"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                >
                    <template v-slot:custom-title>
                        <ProcessDefinitionChatHeader v-model="projectName" :bpmn="bpmn" :fullPath="fullPath" 
                            :lock="lock" :editUser="editUser" :userInfo="userInfo" :isXmlMode="isXmlMode" 
                            :isEditable="isEditable"
                            :chatMode="chatMode"
                            @handleFileChange="handleFileChange" @toggleVerMangerDialog="toggleVerMangerDialog" 
                            @executeProcess="executeProcess" @executeSimulate="executeSimulate"
                            @toggleLock="toggleLock" @showXmlMode="showXmlMode" @beforeDelete="beforeDelete"
                            @createFormUrl="createFormUrl" @toggleMarketplaceDialog="toggleMarketplaceDialog" />
                    </template>
                </Chat>
            </template>
        </AppBaseCard>
        <v-dialog v-model="executeDialog" max-width="80%"
            :class="$globalState.state.isZoomed ? 'dry-run-process-dialog' : ''"
             :fullscreen="isMobile"
        >
            <div v-if="!pal && mode === 'ProcessGPT'">
                <process-gpt-execute :isSimulate="isSimulate" :processDefinition="processDefinition" :bpmn="bpmn" :definitionId="fullPath" @close="executeDialog = false"></process-gpt-execute>
            </div>
            <div v-else>
                <test-process v-if="isSimulate == 'true'" :executeDialog="executeDialog" :definitionId="fullPath" @close="executeDialog = false" />
                <dry-run-process v-else :is-simulate="isSimulate" :definitionId="fullPath" @close="executeDialog = false"></dry-run-process>
            </div>
        </v-dialog>

        <v-dialog v-model="marketplaceDialog" max-width="400">
            <process-definition-market-place-dialog :processDefinition="processDefinition" 
                :bpmn="bpmn" @toggleMarketplaceDialog="toggleMarketplaceDialog" />
        </v-dialog>
    </v-card>
</template>
<script>
import partialParse from 'partial-json-parser';
import xml2js from 'xml2js';

import ProcessDefinition from '@/components/ProcessDefinition.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import ProcessDefinitionVersionManager from '@/components/ProcessDefinitionVersionManager.vue';
import ProcessDefinitionChatHeader from '@/components/ProcessDefinitionChatHeader.vue';
import ProcessDefinitionConvertModule from '@/components/ProcessDefinitionConvertModule.vue';
import ProcessExecuteDialog from './apps/definition-map/ProcessExecuteDialog.vue';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import { useBpmnStore } from '@/stores/bpmn';

import * as jsondiff from 'jsondiffpatch';
import ChatModule from './ChatModule.vue';
import ProcessDefinitionModule from './ProcessDefinitionModule.vue';
import ChatGenerator from './ai/ProcessDefinitionGenerator';
import ConsultingGenerator from "@/components/ai/ProcessConsultingGenerator.js";
import ConsultingMentoGenerator from "@/components/ai/ProcessConsultingMentoGenerator.js";
import Chat from './ui/Chat.vue';

import FormGenerator from './ai/FormDesignGenerator';
import BackendFactory from '@/components/api/BackendFactory';

import ProcessGPTExecute from '@/components/apps/definition-map/ProcessGPTExecute.vue';
import DryRunProcess from '@/components/apps/definition-map/DryRunProcess.vue';
import TestProcess from "@/components/apps/definition-map/TestProcess.vue"
import ProcessDefinitionMarketPlaceDialog from '@/components/ProcessDefinitionMarketPlaceDialog.vue';

const backend = BackendFactory.createBackend();

// import BpmnModelingCanvas from '@/components/designer/bpmnModeling/BpmnModelCanvas.vue';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    }
});
export default {
    mixins: [ChatModule, ProcessDefinitionModule, ProcessDefinitionConvertModule],
    name: 'ProcessDefinitionChat',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatDetail,
        ChatProfile,
        ProcessDefinition,
        // BpmnModelingCanvas,
        ChatGenerator,
        ProcessDefinitionVersionDialog,
        ProcessDefinitionVersionManager,
        ProcessDefinitionChatHeader,
        ProcessDefinitionConvertModule,
        FormGenerator,
        ProcessExecuteDialog,
        'process-gpt-execute': ProcessGPTExecute,
        DryRunProcess,
        TestProcess,
        ProcessDefinitionMarketPlaceDialog
    },
    props: {
        chatMode: {
            type: String,
            default: ""
        },
    },
    data: () => ({
        isEditable: false,
        isXmlMode: false,
        prompt: '',
        changedXML: '',
        path: 'proc_def',
        isChanged: false,
        chatInfo: {
            title: 'processDefinition.cardTitle',
            text: 'processDefinition.processDefinitionExplanation'
        },
        processDefinitionMap: null,
        modeler: null,
        editUser: '',
        // version
        versionDialog: false,
        verMangerDialog: false,
        // delete
        deleteDialog: false,
        restoreDialog: false,
        isDeleted: false,
        isDefinitionDeleted: false,
        externalSystems: [],
        executeDialog: false,
        isSimulate: 'false',
        waitForCustomer: false,
        isConsultingMode: false,
        isPreviewPDFDialog: false,
        marketplaceDialog: false,
        isAIGenerated: false,
    }),
    async created() {
        $try(async () => {
            // Issue: init Methods가 종료되기전에, ChatGenerator를 생성하면서 this로 넘겨주는 Client 정보가 누락되는 현상 발생.
            if(this.chatMode == 'consulting'){
                this.isConsultingMode = true
                this.isEditable = true;
            } 
            if(this.isConsultingMode){
                this.userInfo = await this.backend.getUserInfo();

                this.processDefinitionMap = await backend.getProcessDefinitionMap();

                this.messages.push({
                    "role": "system",
                    "content": this.$t('ProcessDefinitionChat.greetingMessage', { name: this.userInfo.name }),                    
                    "timeStamp": Date.now(),
                })

                
                this.generator = new ConsultingGenerator(this, {
                    isStream: true,
                    preferredLanguage: "Korean"
                });

                this.EventBus.on('messages-updated', () => {
                    this.chatRenderKey++;
                });

            } else {
                await this.init();
                this.generator = new ChatGenerator(this, {
                    isStream: true,
                    preferredLanguage: 'Korean'
                });
                if (this.$store.state.messages) {
                    const messagesString = JSON.stringify(this.$store.state.messages);
                    this.prompt = `아래 대화 내용에서 프로세스를 유추하여 프로세스 정의를 생성해주세요. 이때 가능한 프로세스를 일반화하여 작성:
                    ${messagesString}.`;
                    this.$store.commit('clearMessages');
                }
                if (this.$store.state.editMessages) {
                    const messagesString = JSON.stringify(this.$store.state.editMessages);
                    this.prompt = `아래 대화 내용을 보고 기존 프로세스에서 수정 가능한 부분을 유추하여 프로세스 정의를 수정해주세요.
                    ${messagesString}.`;
                    this.$store.commit('clearMessages');
                }
    
                if (this.fullPath && this.fullPath != '') {
                    this.chatRoomId = this.fullPath;
                }
            }
        });
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    if (!(newVal.path.startsWith('/definitions') || newVal.path.startsWith('/forms'))) return;
                    this.messages = [];
                    if (newVal.params.pathMatch) {
                        this.init();
                    }
                }
            }
        },
        executeDialog(newVal) {
            if(newVal == false){
                if(this.isSimulate == 'true'){
                    this.isSimulate = 'false'
                    this.processDefinition.activities.forEach(activity => {
                        activity.inputFormData = null
                    })
                    this.$emit('closeExecuteDialog')
                }
            }
        }
    },
    computed: {
        fullPath() {
            let path
            if(this.$route.params.pathMatch){
                path = this.$route.params.pathMatch.join('/');
                if (path.startsWith('/')) {
                    path = fullPath.substring(1);
                }
            } else if (this.$route.params.id) {
                path = this.$route.params.id;
            } else {
                path = this.$route.path.replace('/', '');
            }
            return path;
        },
        isAdmin() {
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            return isAdmin;
        },
        mode(){
            return window.$mode;
        },
        pal(){
            return window.$pal;
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
    },
    async beforeRouteLeave(to, from, next) {
        if (this.bpmn && this.bpmn.length > 0) {
            if (this.useLock && this.lock) {
                next();
            }
            const store = useBpmnStore();
            const modeler = store.getModeler;
            const xmlObj = await modeler.saveXML({ format: true, preamble: true });

            if (from.path === '/definitions/chat' && xmlObj && xmlObj.xml && !this.isViewMode) {
            const answer = window.confirm(this.$t('changePath'));
                if (answer) {
                    next();
                } else {
                    next(false);
                }
            } else {
                next();
            }
        } else {
            next();
        }
    },
    methods: {
        // 시퀀스 정보를 활용하여 activities 순서를 재정렬하는 함수
        reorderActivitiesBySequence(jsonData) {
            try {
                if (!jsonData.sequences || !jsonData.activities || jsonData.activities.length === 0) {
                    return jsonData;
                }

                // 시퀀스로부터 그래프 구조 생성
                const graph = {};
                const inDegree = {};
                
                // 모든 노드 초기화
                [...jsonData.events, ...jsonData.activities, ...jsonData.gateways].forEach(node => {
                    graph[node.id] = [];
                    inDegree[node.id] = 0;
                });

                // 시퀀스로부터 그래프 간선 추가
                jsonData.sequences.forEach(seq => {
                    if (graph[seq.source] && inDegree.hasOwnProperty(seq.target)) {
                        graph[seq.source].push(seq.target);
                        inDegree[seq.target]++;
                    }
                });

                // 시작 노드 찾기 (보통 start_event이지만 inDegree가 0인 노드들 중에서)
                let startNodes = Object.keys(inDegree).filter(node => inDegree[node] === 0);
                
                if (startNodes.length === 0) {
                    // 순환이 있는 경우 원래 순서 유지
                    return jsonData;
                }

                // BFS를 통한 순서 결정
                const visitedOrder = [];
                const visited = new Set();
                const queue = [...startNodes];

                while (queue.length > 0) {
                    const currentNode = queue.shift();
                    
                    if (visited.has(currentNode)) {
                        continue;
                    }
                    
                    visited.add(currentNode);
                    visitedOrder.push(currentNode);
                    
                    // 다음 노드들을 큐에 추가 (inDegree 감소시키면서)
                    graph[currentNode].forEach(nextNode => {
                        inDegree[nextNode]--;
                        if (inDegree[nextNode] === 0 && !visited.has(nextNode)) {
                            queue.push(nextNode);
                        }
                    });
                }

                // activities만 추출하여 순서대로 재정렬
                const activityIds = jsonData.activities.map(activity => activity.id);
                const orderedActivityIds = visitedOrder.filter(id => activityIds.includes(id));
                
                // 순서대로 activities 재배열
                const reorderedActivities = [];
                orderedActivityIds.forEach(id => {
                    const activity = jsonData.activities.find(act => act.id === id);
                    if (activity) {
                        reorderedActivities.push(activity);
                    }
                });

                // 혹시 누락된 activities가 있다면 마지막에 추가
                jsonData.activities.forEach(activity => {
                    if (!reorderedActivities.find(act => act.id === activity.id)) {
                        reorderedActivities.push(activity);
                    }
                });

                jsonData.activities = reorderedActivities;
                return jsonData;
                
            } catch (error) {
                console.error('Error reordering activities:', error);
                // 에러 발생 시 원래 데이터 반환
                return jsonData;
            }
        },
        toggleMarketplaceDialog(value) {
            this.marketplaceDialog = value;
        },
        executeProcess() {
            this.isSimulate = 'false'
            this.executeDialog = !this.executeDialog;
        },
        executeSimulate() {
            console.log("simulate")
            this.isSimulate = 'true'
            this.executeDialog = !this.executeDialog;
            this.$emit('executeSimulate')
        },
        beforeStartGenerate(){
            let chatMsgs = [];
            if (this.messages && this.messages.length > 0) {
                this.messages.forEach((msg) => {
                    if (msg.content) {
                        chatMsgs.push({
                            role: msg.role,
                            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                        });
                    }
                });
            }

            if(this.generator){
                this.generator.model = "gpt-4o";
            }
            this.generator.previousMessages = [this.generator.previousMessages[0], ...chatMsgs];
            this.startGenerate();
        },
        async beforeSaveDefinition(info){
            if(this.chatMode == 'consulting'){
                await this.$emit("createdBPMN", this.processDefinition)
                info.skipSaveProcMap = true
            } 
            if(window.$pal){
                await this.beforeSavePALUserTasks(info);
            }
            this.saveDefinition(info);
        },
        async beforeSavePALUserTasks(info) {
            var me = this;
            if (!me.processDefinition || !me.processDefinition.activities) {
                console.warn('프로세스 정의가 없거나 activities가 정의되지 않았습니다.');
                return;
            }
            
            try {
                for (let activity of me.processDefinition.activities) {
                    const taskId = activity.uuid;
                    
                    const task = await backend.saveTask(
                        taskId,                
                        activity.name,         
                        activity.type,        
                        JSON.stringify({       
                            description: activity.description,
                            instruction: activity.instruction,
                            role: activity.role,
                            process: activity.process,
                            inputData: activity.inputData || [],
                            outputData: activity.outputData || [],
                            properties: activity.properties,
                            duration: activity.duration,
                            tool: activity.tool
                        })
                    );
                    activity.uuid = task.id;
                }
                
                console.log('모든 PAL 태스크가 저장되었습니다.');
            } catch (error) {
                console.error('PAL 태스크 저장 중 오류가 발생했습니다:', error);
            }
        },
        showXmlMode() {
            this.isXmlMode = !this.isXmlMode;
        },
        beforeDelete() {
            if (this.bpmn) {
                this.deleteDialog = true;
            }
        },
        beforeRestore() {
            if (this.bpmn) {
                this.restoreDialog = true;
            }
        },
        async deleteProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const path = me.fullPath + ".bpmn";
                    await backend.deleteDefinition(path);
                    me.deleteDialog = false;
                    // me.isDeleted = true;
                    me.EventBus.emit('definitions-updated');
                    me.EventBus.emit('instances-updated');
                    me.$router.push('/definitions/chat');
                }
            });
        },
        async restoreProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const path = me.fullPath + ".bpmn";
                    await backend.restoreDefinition(path);
                    me.restoreDialog = false;
                    me.EventBus.emit('definitions-updated');
                    me.EventBus.emit('instances-updated');
                    me.$router.go(0);
                }
            });
        },
        handleFileChange(event) {
            let me = this;
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;

                let jsonContent = content;
                let convertedBpmn = jsonContent;

                if(file.name.indexOf('.jsonold') != -1) {
                    jsonContent = me.convertOldJson(JSON.parse(content));
                    convertedBpmn = me.createBpmnXml(jsonContent);
                }
                if(file.name.indexOf('.csv') != -1 || file.name.indexOf('.xlsx') != -1) {
                    jsonContent = me.convertCSVToJSON(content);
                    console.log("convertCSVToJSON", jsonContent);
                    if(jsonContent) {
                        convertedBpmn = me.createBpmnXml(jsonContent);
                    }
                }

                if(convertedBpmn) {
                    me.loadBPMN(convertedBpmn);
                } else {
                    alert('BPMN 파일 변환 중 오류가 발생했습니다.');
                }
            };
            reader.readAsText(file);
        },
        checkedLock(defId) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const lockObj = await me.getData(`lock/${defId}`, { key: 'id' });
                    if (lockObj && lockObj.id && lockObj.user_id) {
                        me.editUser = lockObj.user_id;
                        if (lockObj.user_id == this.userInfo.name) {
                            me.lock = false;
                            me.disableChat = false;
                            me.isViewMode = false;
                        } else {
                            me.lock = true;
                            me.disableChat = true;
                            me.isViewMode = true;
                        }
                    } else {
                        me.editUser = '';
                        me.lock = true;
                        me.disableChat = true;
                        me.isViewMode = true;
                    }
                }
            });
        },
        toggleLock() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.lock) {
                        // 잠금 > 수정가능 하도록
                        if (me.processDefinition && me.useLock) {
                            await me.storage.putObject('lock', {
                                id: me.processDefinition.processDefinitionId,
                                user_id: me.userInfo.name
                            });
                        }
                        me.editUser = me.userInfo.name;
                        me.disableChat = false;
                        me.isViewMode = false;
                        me.lock = false;
                        me.definitionChangeCount++;
                    } else {
                        // 현재 수정가능 > 잠금 상태로 (저장)
                        me.toggleVersionDialog(true);
                    }
                }
            });
        },
        toggleVerMangerDialog(open) {
            // Version Manager Dialog
            this.verMangerDialog = open;
        },
        async changeXML(info) {
            var me = this;
            if(me.mode == 'ProcessGPT') {
                if (!info) return;
                if (!info.id) return;
                if (info.xml) {
                    me.processDefinition = await me.convertXMLToJSON(info.xml);
                }
                await me.storage.putObject('proc_def', {
                    id: info.id,
                    name: info.name,
                    bpmn: info.xml,
                    definition: me.processDefinition
                }); 
            } else {
                
            }
            
            me.bpmn = info.xml;
            me.definitionChangeCount++;
            me.toggleVerMangerDialog(false);
        },
        loadBPMN(bpmn) {
            this.bpmn = bpmn;
            this.definitionChangeCount++;
        },
        changeBpmn(newVal) {
            this.loadBPMN(newVal);
        },
        changeElement(newVal) {
            this.bpmn = newVal;
        },
        removePositionKey(obj) {
            // 배열인 경우, 각 요소에 대해 재귀적으로 함수를 호출
            if (Array.isArray(obj)) {
                return obj.map((item) => removePositionKey(item));
            }
            // 객체인 경우, 키를 순회하며 'position' 키를 제외한 새 객체 생성
            else if (typeof obj === 'object' && obj !== null) {
                const newObj = {};
                Object.keys(obj).forEach((key) => {
                    if (key !== 'position') {
                        // 'position' 키가 아닌 경우, 재귀적으로 처리
                        newObj[key] = removePositionKey(obj[key]);
                    }
                });
                return newObj;
            }
            // 기본 타입인 경우, 그대로 반환
            return obj;
        },
        async updateDefinition() {
            const store = useBpmnStore();
            let modeler = store.getModeler;
            let xml = await modeler.saveXML({ format: true, preamble: true });
            console.log(xml.xml);
            this.bpmn = xml.xml;
            this.definitionChangeCount++;
            // this.processDefinition = val
            // this.bpmn = this.createBpmnXml(val)
            this.isChanged = true;
        },
        async loadData(path) {
            const me = this;
            
            try {
                const externalSystems = await backend.getSystemList();
                if (externalSystems) {
                    externalSystems.forEach(async (externalSystem) => {
                        const system = await backend.getSystem(externalSystem.name.replace('.json', ''));
                        me.externalSystems.push(system);
                    });
                }
                me.isDeleted = false;
                let fullPath = me.$route.params.pathMatch.join('/');
                if (fullPath.startsWith('/')) {
                    fullPath = fullPath.substring(1);
                }
                let lastPath = this.$route.params.pathMatch[this.$route.params.pathMatch.length - 1];
                if (fullPath && lastPath != 'chat') {
                    let bpmn = await backend.getRawDefinition(fullPath, { type: 'bpmn' });
                    me.bpmn = bpmn;             
                    me.definitionChangeCount++;
                    let isDeleted = await backend.getRawDefinition(fullPath, { type: 'deleted' }); 
                    me.isDefinitionDeleted = isDeleted;
                    if (me.useLock) { // ProcessGPT 모드
                        const value = await backend.getRawDefinition(fullPath);
                        if (value) {
                            me.processDefinition = value.definition;
                            me.processDefinition.processDefinitionId = value.id;
                            me.processDefinition.processDefinitionName = value.name;
                            me.projectName = value.name ? value.name : me.processDefinition.processDefinitionName;
                            me.oldProcDefId = me.processDefinition.processDefinitionId;
                            me.afterLoadBpmn();
                        }

                        const role = localStorage.getItem('role');
                        if (role !== 'superAdmin') {
                            // 수정 권한 체크
                            const permission = await me.checkPermission(lastPath);
                            if (permission && permission.writable) {
                                me.isEditable = true;
                                me.checkedLock(lastPath);
                            } else if (permission && !permission.writable) {
                                me.isEditable = false;
                                me.lock = true;
                                me.disableChat = true;
                                me.isViewMode = true;
                            }
                        } else {
                            me.isEditable = true;
                            me.checkedLock(lastPath);
                        }
                    } else {
                        // uEngine 모드
                        me.isEditable = true;
                    }

                } else if (lastPath == 'chat') {
                    // me.processDefinition = null;
                    me.projectName = null;
                    me.bpmn = null;
                    me.processDefinition = await me.convertXMLToJSON(me.bpmn);

                    if (me.$route.query && me.$route.query.id) {
                        me.processDefinition = {
                            processDefinitionId: me.$route.query.id.replace('.bpmn', '')
                        };
                        if (me.$route.query.name) {
                            me.projectName = me.$route.query.name.replace('.bpmn', '');
                            me.processDefinition.processDefinitionName = me.projectName;
                        }
                        me.oldProcDefId = me.processDefinition.processDefinitionId;
                    }

                    me.isEditable = true;
                    me.lock = false;
                    me.disableChat = false;
                    me.isViewMode = false;
                    me.definitionChangeCount++;
                }

                // 프로세스 정의 체계도에서 넘어온 쿼리 파라미터 처리
                if (me.$route.query && me.$route.query.modeling) {
                    document.title = me.projectName;
                }
                me.processDefinitionMap = await backend.getProcessDefinitionMap();
            } catch (e) {
                console.log(e);
                alert(e);
            }
        },
        async afterLoadBpmn(){
            if(!this.pal) return;
            if(this.processDefinition && this.processDefinition.activities && this.processDefinition.activities.length > 0) {
                Object.keys(this.processDefinition.activities).forEach(async (actId) => {
                    const activity = this.processDefinition.activities[actId];

                    if (activity) {
                        if (activity.uuid) {
                            const task = await this.backend.getTask({ id: activity.uuid });
                            const json = task.json_ko;

                            this.activity = json;
                            this.activity.uuid = task.id;
                            this.activity.type = task.type;
                        }

                        console.log('Activity updated:', activity);
                    } else {
                        console.log('Activity not found:', actId);
                    }
                });
            }
        },
        async onLoadBpmn() {
            const store = useBpmnStore();
            let modeler = store.getModeler;
            let me = this;
            let definitions;
            let xmlObj = await modeler.saveXML({ format: true, preamble: true });
            me.bpmn = xmlObj.xml;
            let fullPath = me.$route.params.pathMatch.join('/');
            if (fullPath.startsWith('/')) {
                fullPath = fullPath.substring(1);
            }
            let lastPath = this.$route.params.pathMatch[this.$route.params.pathMatch.length - 1];
            if(fullPath == 'chat' && lastPath == 'chat') return;
            definitions = modeler.getDefinitions();
            if(definitions) {
                if (!me.useLock) {
                    me.processDefinition = await me.convertXMLToJSON(me.bpmn);
                    me.processDefinition.processDefinitionId = fullPath;
                    me.processDefinition.processDefinitionName = fullPath;
                    me.projectName = definitions.name ? definitions.name : me.processDefinition.processDefinitionName;
                }
            }
        },
        beforeSendMessage(newMessage) {
            this.waitForCustomer = false
            if(!this.isConsultingMode){
                this.generator = new ChatGenerator(this, {
                    isStream: true,
                    preferredLanguage: 'Korean'
                });
                this.generator.client.genType = 'proc_def'
                if (this.processDefinitionMap) {
                    this.generator.setProcessDefinitionMap(this.processDefinitionMap);
                }
                if (this.processDefinition) {
                    this.generator.setProcessDefinition(this.processDefinition);
                }
            }
            this.sendMessage(newMessage);
        },
        async afterModelCreated(response) {
            let jsonProcess;
            try {
                if (typeof response === 'string') {
                    try {
                        jsonProcess = JSON.parse(response);
                    } catch(e){
                        try {
                            jsonProcess = partialParse(response);
                            if(jsonProcess && Object.keys(jsonProcess).length !== 0){
                                jsonProcess = partialParse(response + '"');
                            }
                        } catch(e){
                            jsonProcess = this.extractJSON(response);
                            try {
                                jsonProcess = JSON.parse(jsonProcess);
                            } catch(e){
                                jsonProcess = partialParse(jsonProcess)
                            }
                        }
                    }
                } else {
                    jsonProcess = response;
                }
                // jsonProcess = this.extractJSON(response);

                if (jsonProcess) {
                    // let unknown = partialParse(jsonProcess);
                    let unknown = jsonProcess;
                    if(this.isConsultingMode){
                        if(unknown){
                            this.messages[this.messages.length - 1].disableMsg = true
                            if(unknown.validity && unknown.validity == "Suitable"){
                                this.messages[this.messages.length - 2].disableMsg = false
                            }
                        }
                    } else {
                        if (unknown.processDefinitionId) {
                            this.processDefinition = unknown;
                            if(!this.processDefinition) this.processDefinition = {};
                            // this.bpmn = this.createBpmnXml(this.processDefinition);
                            this.bpmn = this.createBpmnXml(unknown);
                            this.isAIGenerated = true;
                            this.processDefinition['processDefinitionId'] = unknown.processDefinitionId;
                            this.processDefinition['processDefinitionName'] = unknown.processDefinitionName;
                            this.projectName = unknown.processDefinitionName
                            this.oldProcDefId = unknown.processDefinitionId;
                            this.definitionChangeCount++;
                        }
                    }
                } 
            } catch (error) {
                console.log(jsonProcess);
                console.log(error);
            }
        },

        parseJsonProcess(response) {
            return new Promise((resolve, reject) => {
                try {
                    const jsonProcess = JSON.parse(response);
                    resolve(jsonProcess);
                } catch(error) {
                    console.log(error);
                    const maxRetries = 3;
                    let retryCount = 0;

                    const retry = async () => {
                        if (retryCount < maxRetries) {
                            console.log('retrying parse json process');
                            retryCount++;
                            resolve(partialParse(response));
                        } else {
                            reject(error);
                        }
                    };

                    retry();
                }
            })
        },
        async convertOldFormatToElements(oldObj) {
            oldObj.elements = []
            // Type mapping to convert from old activity types to new element types
            const typeMapping = {
                'startEvent': 'StartEvent',
                'endEvent': 'EndEvent',
                'userTask': 'UserActivity',
                'serviceTask': 'ServiceActivity',
                'scriptTask': 'ScriptActivity',
                'sendTask': 'EmailActivity',
                'exclusiveGateway': 'ExclusiveGateway',
                'parallelGateway': 'ParallelGateway',
                'task': 'Activity'
            };
            
            // Convert old activities to elements format
            if (oldObj.activities && Array.isArray(oldObj.activities)) {
                oldObj.activities.forEach(activity => {
                const elementType = activity.type === 'userTask' ? 'Activity' : 'Activity';
                const type = typeMapping[activity.type] || 'Activity';
                
                // Parse properties if they exist
                let checkpoints = [];
                let duration = activity.duration || "5";
                try {
                    if (activity.properties) {
                    const props = JSON.parse(activity.properties);
                    if (props.checkpoints) {
                        checkpoints = props.checkpoints;
                    }
                    if (props.duration) {
                        duration = props.duration;
                    }
                    }
                } catch (e) {
                    console.error("Error parsing properties:", e);
                }
                
                const newElement = {
                    elementType: elementType,
                    id: activity.id,
                    name: activity.name,
                    type: type,
                    source: "", // This will be filled from sequences
                    description: activity.description || "",
                    instruction: activity.instruction || "",
                    role: activity.role || "",
                    inputData: activity.inputData || [],
                    outputData: activity.outputData || [],
                    checkpoints: checkpoints,
                    duration: duration
                };
                
                oldObj.elements.push(newElement);
                });
            }
            
            // Convert old events to elements format
            if (oldObj.events && Array.isArray(oldObj.events)) {
                oldObj.events.forEach(event => {
                const elementType = "Event";
                const type = typeMapping[event.type] || event.type;
                
                const newElement = {
                    elementType: elementType,
                    id: event.id,
                    name: event.name,
                    role: event.role || "",
                    source: "",
                    type: type,
                    description: event.description || "",
                    trigger: event.type === "startEvent" ? "프로세스 시작" : "프로세스 종료"
                };
                
                oldObj.elements.push(newElement);
                });
            }
            
            // Convert old gateways to elements format
            if (oldObj.gateways && Array.isArray(oldObj.gateways)) {
                oldObj.gateways.forEach(gateway => {
                const elementType = "Gateway";
                const type = typeMapping[gateway.type] || "ExclusiveGateway";
                
                const newElement = {
                    elementType: elementType,
                    id: gateway.id,
                    name: gateway.name || "Gateway",
                    role: gateway.role || "",
                    source: "",
                    type: type,
                    description: gateway.description || "분기점"
                };
                
                oldObj.elements.push(newElement);
                });
            }
            
            // Convert old sequences to elements format and set source properties
            if (oldObj.sequences && Array.isArray(oldObj.sequences)) {
                // First, create a mapping of target IDs to source IDs
                const targetToSourceMap = {};
                oldObj.sequences.forEach(sequence => {
                if (!targetToSourceMap[sequence.target]) {
                    targetToSourceMap[sequence.target] = [];
                }
                targetToSourceMap[sequence.target].push(sequence.source);
                });
                
                // Update source properties in existing elements
                oldObj.elements.forEach(element => {
                if (targetToSourceMap[element.id] && targetToSourceMap[element.id].length > 0) {
                    element.source = targetToSourceMap[element.id][0]; // Take the first source
                }
                });
                
                // Now convert sequences to elements
                oldObj.sequences.forEach(sequence => {
                let condition = null;
                try {
                    if (sequence.condition && sequence.condition !== "") {
                    // Try to parse condition if it exists
                    if (typeof sequence.condition === 'string' && sequence.condition.startsWith('{')) {
                        const condObj = JSON.parse(sequence.condition);
                        condition = {
                        key: condObj.key || "",
                        condition: condObj.operator || "==",
                        value: condObj.value || ""
                        };
                    }
                    }
                } catch (e) {
                    console.error("Error parsing condition:", e);
                }
                
                const newElement = {
                    elementType: "Sequence",
                    id: sequence.id,
                    name: sequence.id.replace("SequenceFlow_", "").replace(/_/g, " "),
                    source: sequence.source,
                    target: sequence.target
                };
                
                if (condition) {
                    newElement.condition = condition;
                }
                
                oldObj.elements.push(newElement);
                });
            }
            
            return oldObj;
        },
        async afterGenerationFinished(response) {
            let jsonProcess = null;
            if (typeof response === 'string') {
                try {
                    jsonProcess = await this.parseJsonProcess(response);
                } catch(e){
                    try {
                        jsonProcess = await this.parseJsonProcess(response);
                        if(jsonProcess && Object.keys(jsonProcess).length !== 0){
                            jsonProcess = await this.parseJsonProcess(response + '"');
                        }
                    } catch(e){
                        jsonProcess = this.extractJSON(response);
                        try {
                            jsonProcess = JSON.parse(jsonProcess);
                        } catch(e){
                            jsonProcess = partialParse(jsonProcess)
                        }
                    }
                }
            } else {
                jsonProcess = response;
            }

            if (jsonProcess) {
                let unknown = jsonProcess;

                if(this.isConsultingMode){
                    let content
                    if(unknown){
                        content = unknown.content
                        this.messages[this.messages.length - 1].content = content

                        if(unknown.validity && unknown.validity == "Suitable"){
                            this.messages.pop();
                            this.generator = new ConsultingGenerator(this, {
                                isStream: true,
                                preferredLanguage: "Korean"
                            });
                        } else {
                            if(unknown.answerType && unknown.answerType == 'generateProcessDef'){
                                this.generator = new ChatGenerator(this, {
                                    isStream: true,
                                    preferredLanguage: 'Korean'
                                });
                                this.isConsultingMode = false
                                this.waitForCustomer = true
                                this.$emit("openProcessPreview")
                            } else {
                                if(unknown.validity && unknown.validity == "Unsuitable"){
                                    this.generator = new ConsultingGenerator(this, {
                                        isStream: true,
                                        preferredLanguage: "Korean"
                                    });
                                } else {
                                    this.generator = new ConsultingMentoGenerator(this, {
                                        isStream: true,
                                        preferredLanguage: "Korean"
                                    });
                                }
                            }
                            this.beforeStartGenerate()
                        }
                    }
                } 

                if(!this.isConsultingMode) {
                    if(unknown.processDefinitionName){
                        this.projectName = unknown.processDefinitionName
                    }
                    if (unknown.megaProcessId && this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                        if (!this.processDefinitionMap.mega_proc_list.some((megaProcess) => megaProcess.name == unknown.megaProcessId)) {
                            this.processDefinitionMap.mega_proc_list.push({
                                name: unknown.megaProcessId,
                                id: unknown.megaProcessId,
                                major_proc_list: [
                                    {
                                        name: unknown.majorProcessId,
                                        id: unknown.majorProcessId,
                                        sub_proc_list: [
                                            {
                                                id: unknown.processDefinitionId,
                                                name: unknown.processDefinitionName
                                            }
                                        ]
                                    }
                                ]
                            });
                        }
                        if (unknown.majorProcessId) {
                            this.processDefinitionMap.mega_proc_list.forEach((megaProcess) => {
                                if (megaProcess.name == unknown.megaProcessId) {
                                    if (megaProcess.major_proc_list.some((majorProcess) => majorProcess.name == unknown.majorProcessId)) {
                                        const idx = megaProcess.major_proc_list.findIndex(
                                            (majorProcess) => majorProcess.name == unknown.majorProcessId
                                        );
                                        if (
                                            !megaProcess.major_proc_list[idx].sub_proc_list.some(
                                                (subProcess) => subProcess.id == unknown.processDefinitionId
                                            )
                                        ) {
                                            megaProcess.major_proc_list[idx].sub_proc_list.push({
                                                id: unknown.processDefinitionId,
                                                name: unknown.processDefinitionName
                                            });
                                        }
                                    } else {
                                        megaProcess.major_proc_list.push({
                                            name: unknown.majorProcessId,
                                            id: unknown.majorProcessId,
                                            sub_proc_list: [
                                                {
                                                    id: unknown.processDefinitionId,
                                                    name: unknown.processDefinitionName
                                                }
                                            ]
                                        });
                                    }
                                }
                            });
                        }
                    }
                    const store = useBpmnStore();
                    const modeler = store.getModeler;
                    if (unknown.modifications) {
                        if(!this.processDefinition['elements']) this.processDefinition = await this.convertOldFormatToElements(this.processDefinition);
                        // unknown.modifications.forEach(async (modification) => {
                        for (let modification of unknown.modifications) {
                            let targetJsonPath = modification.targetJsonPath.includes('[') ? modification.targetJsonPath.split('[')[0].replace('$.', ''):modification.targetJsonPath.replace('$.', '')
                            if (modification.action == 'replace') {
                                if(this.processDefinition[targetJsonPath]) {
                                    this.jsonPathReplace(this.processDefinition, modification.targetJsonPath, modification.value);
                                } else {
                                    this.jsonPathReplace(this.processDefinition, modification.targetJsonPath.replace(targetJsonPath, 'elements'), modification.value);
                                }
                            } else if (modification.action == 'add') {
                                if(this.processDefinition[modification.targetJsonPath.replace('$.', '')]) {
                                    this.processDefinition[modification.targetJsonPath.replace('$.', '')].push(modification.value);
                                } else {
                                    this.processDefinition['elements'].push(modification.value);
                                }
                                // this.modificationAdd(modification);
                                // this.modificationElement(modification, modeler);
                                // let xml = await modeler.saveXML({ format: true, preamble: true });
                                // this.bpmn = xml.xml;
                                // this.bpmn = this.createBpmnXml(this.processDefinition);
                                // console.log('done');
                            } else if (modification.action == 'delete') {
                                if(this.processDefinition[targetJsonPath]) {
                                    let deleteIdx = this.processDefinition[targetJsonPath].findIndex(x => x.id == modification.value.id)
                                    if(deleteIdx != -1) this.processDefinition[targetJsonPath].splice(deleteIdx, 1)
                                } else {
                                    let deleteIdx = this.processDefinition['elements'].findIndex(x => x.id == modification.value.id)
                                    if(deleteIdx != -1) this.processDefinition['elements'].splice(deleteIdx, 1)
                                }
                                // this.modificationRemove(modification, modeler);
                                // let xml = await modeler.saveXML({ format: true, preamble: true });
                                // this.bpmn = xml.xml;
                            }
                            if(this.processDefinition['activities'] && this.processDefinition['sequences']) {
                                this.processDefinition = await this.convertOldFormatToElements(this.processDefinition);
                            }
                            this.bpmn = this.createBpmnXml(this.processDefinition);
                        }
                        this.oldProcDefId = unknown.processDefinitionId;
                        this.definitionChangeCount++;
                    }

                    if(!jsonProcess.answerType){
                        if(jsonProcess.modifications){
                            this.messages.push({
                                "role": "system",
                                "content": `요청하신 내용에 따라 수정을 완료하였습니다.`,
                                "timeStamp": Date.now()
                            });
                        } else {
                            await this.checkedFormData();
                            this.messages.push({
                                "role": "system",
                                "content": `요청하신 프로세스 생성을 모두 완료하였습니다. 🎉🎉`,
                                "timeStamp": Date.now()
                            });
                            this.messages.push({
                                "role": "system",
                                "content": `생성된 프로세스의 실제 실행화면을 시뮬레이션 기능을 통해 확인 및 수정이 가능합니다.`,
                                "timeStamp": Date.now()
                            });
        
                            if(this.chatMode == 'consulting'){
                                this.messages.push({
                                    "role": "system",
                                    "content": `생성된 프로세스 정의에 대하여 추가적인 요청사항이 있으시다면 말씀해주세요.`,
                                    "timeStamp": Date.now()
                                });
                            }
        
                            this.$try({
                                context: this,
                                action: () => {
                                },
                                successMsg: this.$t('successMsg.processGenerationCompleted')
                            })
                        }
                    }
        
                    this.isChanged = true;
                }
            } else {
                if(this.isConsultingMode){
                    if(this.messages[this.messages.length - 1].role == 'system'){
                        this.messages.pop()
                    }
                    this.generator = new ConsultingGenerator(this, {
                        isStream: true,
                        preferredLanguage: "Korean"
                    });
                    this.beforeStartGenerate()
                }
            }

        },
        generateElement(name, x, y, width, height, id, canvas) {
            var me = this;
            const component = me.getComponentByName(name);
            if (!component) return null;

            if (!id) id = me.uuid();
            if (!x) x = 500;
            if (!y) x = 500;
            if (!canvas) canvas = null;

            return component.computed.createNew(canvas, id, x, y, width, height);
        },
        getComponentByName: function (name) {
            var componentByName;
            $.each(window.bpmnComponents, function (i, component) {
                if (component.default.name == name) {
                    componentByName = component;
                }
            });
            return componentByName;
        },
        savePDF() {
            this.isPreviewPDFDialog = false;
            this.isPreviewPDFDialog = true;
        },
        async checkPermission(id) {
            const uid = localStorage.getItem('uid');
            const options = {
                proc_def_id: id,
                user_id: uid
            }
            const permissions = await backend.getUserPermissions(options);
            if (permissions && permissions.length > 0) {
                return permissions[0];
            } else {
                return null;
            }
        },

        // 외부 고객용 폼 URL 생성
        async createFormUrl() {
            let hasExternalCustomerRole = false;
            let roleName = '';

            let processDefinition = await this.convertXMLToJSON(this.bpmn);
            if (processDefinition.roles) {
                processDefinition.roles.forEach((role) => {
                    if(role.endpoint == 'external_customer'){
                        hasExternalCustomerRole = true;
                        roleName = role.name;
                    }
                });
            }

            let processDefinitionId = processDefinition.processDefinitionId;

            if (hasExternalCustomerRole) {
                let activityId = '';
                let externalFormId = '';
                if (this.processDefinition.activities) {
                    for (const activity of this.processDefinition.activities) {
                        if (activity.type == 'userTask' && activity.role == roleName) {
                            activityId = activity.id;
                            externalFormId = activity.tool.replace('formHandler:', '');
                            break;
                        }
                    }
                }

                if (externalFormId && externalFormId != '') {
                    const url = `/external-forms/${externalFormId}?process_definition_id=${processDefinitionId}&activity_id=${activityId}`;
                    window.open(url, '_blank');
                }
            }

        },
    }
};
</script>

<style scoped>
.process-definition-resize {
    width: 100%;
    height: 100%;
}

@media only screen and (max-width: 1279px) {
    .process-definition-resize {
        width: 100%;
        height: calc(100% - 38px) !important;
    }
}

:deep(.left-part) {
    width: 75%;
    /* Apply specific width */
}

.user-left-part :deep(.left-part) {
    width: 100%;
    /* Apply specific width for admin */
}

.is-deleted {
    position: relative;
}
.is-deleted::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5); /* 회색 오버레이 */
    z-index: 10;
}
</style>
