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
                                :isDeleted="isDefinitionDeleted"
                                @handleFileChange="handleFileChange" @toggleVerMangerDialog="toggleVerMangerDialog" 
                                @executeProcess="executeProcess" @executeSimulate="executeSimulate"
                                @toggleLock="toggleLock" @showXmlMode="showXmlMode" @beforeDelete="beforeDelete"
                                @beforeRestore="beforeRestore" @savePDF="savePDF"
                                @createFormUrl="createFormUrl" />
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
                            @handleFileChange="handleFileChange" @toggleVerMangerDialog="toggleVerMangerDialog" 
                            @executeProcess="executeProcess" @executeSimulate="executeSimulate"
                            @toggleLock="toggleLock" @showXmlMode="showXmlMode" @beforeDelete="beforeDelete"
                            @createFormUrl="createFormUrl" />
                    </template>
                </Chat>
            </template>
        </AppBaseCard>
        <v-dialog v-model="executeDialog" max-width="80%"
            :class="$globalState.state.isZoomed ? 'dry-run-process-dialog' : ''"
        >
            <div v-if="!pal && mode === 'ProcessGPT'">
                <process-gpt-execute :isSimulate="isSimulate" :processDefinition="processDefinition" :bpmn="bpmn" :definitionId="fullPath" @close="executeDialog = false"></process-gpt-execute>
            </div>
            <div v-else>
                <test-process v-if="isSimulate == 'true'" :executeDialog="executeDialog" :definitionId="fullPath" @close="executeDialog = false" />
                <dry-run-process v-else :is-simulate="isSimulate" :definitionId="fullPath" @close="executeDialog = false"></dry-run-process>
            </div>
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
        TestProcess
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
        }
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
            this.saveDefinition(info);
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
                    me.$router.go(0);
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
                // 파일 내용 처리
                me.loadBPMN(convertedBpmn);
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
                            this.processDefinition['processDefinitionId'] = unknown.processDefinitionId;
                            this.processDefinition['processDefinitionName'] = unknown.processDefinitionName;
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
                        // unknown.modifications.forEach(async (modification) => {
                        for (let modification of unknown.modifications) {
                            if (modification.action == 'replace') {
                                this.jsonPathReplace(this.processDefinition, modification.targetJsonPath, modification.value);
                                console.log(this.processDefinition);
                                this.bpmn = this.createBpmnXml(this.processDefinition);
                            } else if (modification.action == 'add') {
                                this.modificationAdd(modification);
                                this.modificationElement(modification, modeler);
                                let xml = await modeler.saveXML({ format: true, preamble: true });
                                this.bpmn = xml.xml;
                                console.log('done');
                            } else if (modification.action == 'delete') {
                                this.modificationRemove(modification, modeler);
                                let xml = await modeler.saveXML({ format: true, preamble: true });
                                this.bpmn = xml.xml;
                                // this.bpmn = this.createBpmnXml(this.processDefinition);
                            }
                        }
    
                        this.definitionChangeCount++;
                    }
                    await this.checkedFormData();
        
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
