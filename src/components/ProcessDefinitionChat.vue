<template>
    <v-card
        elevation="10"
        style="background-color: rgba(255, 255, 255, 0)"
        :class="{ 'is-deleted': isDeleted, 'user-left-part': !isAdmin }"
    >
        <v-card v-if="isConsultingMode && chatMode != 'tree'">
            <div :key="chatRenderKey">
                <div style="display: none;">
                    <process-definition
                        ref="definitionComponent"    
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
                <div class="process-consulting-ai-first-screen">
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
        <div v-else :class="{ 'chat-collapsed': isChatCollapsed }">
            <AppBaseCard>
                <template v-slot:leftpart>
                    <div style="position: relative; width: 100%; height: 100%;">
                        <h5 v-if="!isAdmin" class="text-h5 font-weight-semibold pa-3" style="background-color: white;">
                            {{ projectName }}
                        </h5>
                        
                        <!-- 프로세스 정의 내부에 있는 ProcessDefinition.vue 컴포넌트 -->
                        <process-definition
                            ref="definitionComponent"
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
                            @update:isAIGenerated="isAIGenerated = false"
                        ></process-definition>
                        
                        <!-- Flow 오버레이 (leftpart에만 표시) -->
                        <transition name="fade">
                            <div v-if="showFlowOverlay && currentProcessDefinitionForFlow && !isXmlMode" 
                                class="flow-overlay-leftpart">
                                <div class="flow-content">
                                    <div :style="{ width: showActivityPanel ? '70%' : '100%', height: '100%', transition: 'width 0.3s' }">
                                        <ProcessFlowExample 
                                            ref="processFlowExample"
                                            :process-definition="currentProcessDefinitionForFlow"
                                            :flow-layout="flowLayout"
                                            @node-double-click="handleFlowNodeDoubleClick"
                                            @nodes-position-changed="handleNodesPositionChanged"
                                        />
                                    </div>
                                    
                                    <!-- 속성 편집 패널 -->
                                    <v-slide-x-reverse-transition>
                                        <div v-if="showActivityPanel && selectedFlowActivity" 
                                            class="activity-panel pa-4">
                                            <div class="d-flex align-center mb-4">
                                                <h3 class="text-h6">액티비티 속성</h3>
                                                <v-spacer></v-spacer>
                                                <v-btn 
                                                    color="primary"
                                                    variant="flat" 
                                                    size="small"
                                                    @click="saveActivity"
                                                >
                                                    <v-icon class="mr-1">mdi-content-save</v-icon>
                                                    저장
                                                </v-btn>
                                                <v-btn 
                                                    variant="text" 
                                                    icon
                                                    size="small"
                                                    @click="$emit('closeActivityPanel')"
                                                >
                                                    <v-icon>mdi-close</v-icon>
                                                </v-btn>
                                            </div>
                                            
                                            <v-card variant="outlined" class="mb-3">
                                                <v-card-text>
                                                    <div class="mb-3">
                                                        <div class="text-caption text-grey mb-1">액티비티명</div>
                                                        <div class="text-body-1 font-weight-medium">{{ selectedFlowActivity.content || selectedFlowActivity.name }}</div>
                                                    </div>
                                                    
                                                    <v-text-field
                                                        :model-value="selectedFlowActivity.header || selectedFlowActivity.role"
                                                        label="역할/담당"
                                                        variant="outlined"
                                                        density="compact"
                                                        hide-details
                                                        class="mb-3"
                                                        readonly
                                                    ></v-text-field>
                                                    
                                                    <v-text-field
                                                        v-model="selectedFlowActivity.footer"
                                                        label="시스템/도구"
                                                        variant="outlined"
                                                        density="compact"
                                                        hide-details
                                                        class="mb-3"
                                                    ></v-text-field>
                                                    
                                                    <v-text-field
                                                        v-model="selectedFlowActivity.requiredTime"
                                                        label="소요시간 (들어오는 화살표)"
                                                        variant="outlined"
                                                        density="compact"
                                                        hide-details
                                                        class="mb-3"
                                                        placeholder="예: 55s, 1m, 2h"
                                                    ></v-text-field>
                                                    
                                                    <v-text-field
                                                        v-if="selectedFlowActivity.backflowSequenceId"
                                                        v-model="selectedFlowActivity.backflowRequiredTime"
                                                        label="역행 소요시간 (빨간 화살표)"
                                                        variant="outlined"
                                                        density="compact"
                                                        hide-details
                                                        class="mb-3"
                                                        placeholder="예: 160s, 5m, 1h"
                                                    >
                                                        <template v-slot:prepend-inner>
                                                            <v-icon color="error" size="small">mdi-arrow-u-left-top</v-icon>
                                                        </template>
                                                    </v-text-field>
                                                    
                                                    <v-text-field
                                                        :model-value="selectedFlowActivity.description ? (selectedFlowActivity.description.length > 50 ? selectedFlowActivity.description.substring(0, 50) + '...' : selectedFlowActivity.description) : ''"
                                                        label="설명"
                                                        variant="outlined"
                                                        density="compact"
                                                        hide-details
                                                        class="mb-3 clickable-field"
                                                        readonly
                                                        @click="openTextEditorDialog('description', '설명', selectedFlowActivity.description)"
                                                    >
                                                        <template v-slot:append-inner>
                                                            <v-icon size="small" color="grey">mdi-pencil</v-icon>
                                                        </template>
                                                    </v-text-field>
                                                    
                                                    <v-text-field
                                                        :model-value="selectedFlowActivity.issues ? (selectedFlowActivity.issues.length > 50 ? selectedFlowActivity.issues.substring(0, 50) + '...' : selectedFlowActivity.issues) : ''"
                                                        label="이슈"
                                                        variant="outlined"
                                                        density="compact"
                                                        hide-details
                                                        class="mb-3 clickable-field"
                                                        placeholder="이슈 사항을 입력하세요"
                                                        readonly
                                                        @click="openTextEditorDialog('issues', '이슈', selectedFlowActivity.issues)"
                                                    >
                                                        <template v-slot:append-inner>
                                                            <v-icon size="small" color="grey">mdi-pencil</v-icon>
                                                        </template>
                                                    </v-text-field>
                                                </v-card-text>
                                            </v-card>
                                        </div>
                                    </v-slide-x-reverse-transition>
                                    
                                    <!-- 텍스트 에디터 다이얼로그 -->
                                    <v-dialog v-model="textEditorDialog" max-width="700" persistent>
                                        <v-card>
                                            <v-card-title class="d-flex align-center pa-4">
                                                <span>{{ textEditorTitle }}</span>
                                                <v-spacer></v-spacer>
                                                <v-btn icon variant="text" @click="closeTextEditorDialog">
                                                    <v-icon>mdi-close</v-icon>
                                                </v-btn>
                                            </v-card-title>
                                            <v-divider></v-divider>
                                            <v-card-text class="pa-4">
                                                <v-textarea
                                                    v-model="textEditorContent"
                                                    :label="textEditorTitle"
                                                    variant="outlined"
                                                    rows="12"
                                                    auto-grow
                                                    hide-details
                                                    autofocus
                                                ></v-textarea>
                                            </v-card-text>
                                            <v-divider></v-divider>
                                            <v-card-actions class="pa-4">
                                                <v-spacer></v-spacer>
                                                <v-btn 
                                                    variant="outlined" 
                                                    @click="closeTextEditorDialog"
                                                >
                                                    취소
                                                </v-btn>
                                                <v-btn 
                                                    color="primary" 
                                                    variant="flat"
                                                    @click="saveTextEditorContent"
                                                >
                                                    <v-icon class="mr-1">mdi-check</v-icon>
                                                    적용
                                                </v-btn>
                                            </v-card-actions>
                                        </v-card>
                                    </v-dialog>
                                </div>
                            </div>
                        </transition>
                    </div>
                    <process-definition-version-dialog
                        :process="processDefinition"
                        :open="versionDialog"
                        :definitionPath="fullPath"
                        :processName="projectName"
                        :type="'bpmn'"
                        :useOptimize="useOptimize"
                        @update:useOptimize="useOptimize = $event"
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
                        <v-card class="pa-0">
                            <v-row class="ma-0 pa-4 pb-0 align-center">
                                <v-card-title class="pa-0">
                                    {{ $t('processDefinition.deleteProcessMessage') }}
                                </v-card-title>
                                <v-spacer></v-spacer>
                                <v-btn @click="deleteDialog = false"
                                    class="ml-auto" 
                                    variant="text" 
                                    density="compact"
                                    icon
                                >
                                    <v-icon>mdi-close</v-icon>
                                </v-btn>
                            </v-row>
                            <v-row class="ma-0 pa-4">
                                <v-spacer></v-spacer>
                                <v-btn @click="deleteProcess"
                                    color="error" 
                                    rounded 
                                    variant="flat" 
                                >
                                    {{ $t('processDefinition.delete') }}
                                </v-btn>
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
                    
                    <!-- 채팅창 접기/펴기 탭 버튼 (leftpart 오른쪽 끝에 위치) -->
                    <div 
                        class="chat-collapse-tab"
                        @click="isChatCollapsed = !isChatCollapsed"
                        :title="isChatCollapsed ? '채팅창 펼치기' : '채팅창 접기'"
                    >
                        <v-icon size="18">{{ isChatCollapsed ? 'mdi-chevron-left' : 'mdi-chevron-right' }}</v-icon>
                    </div>
                </template>
                <template v-slot:rightpart>
                    <div v-if="isAdmin && !isChatCollapsed" class="process-consulting-ai-second-screen no-scrollbar chat-content">
                            <Chat
                                :prompt="prompt"
                                :name="projectName"
                                :messages="messages"
                                :chatInfo="chatInfo"
                                :userInfo="userInfo"
                                :allUserList="allUserList"
                                :lock="lock"
                                :disableChat="disableChat"
                                :chatRoomId="chatRoomId"
                                @sendMessage="beforeSendMessage"
                                @sendEditedMessage="sendEditedMessage"
                                @stopMessage="stopMessage"
                                @addTeam="addTeam"
                                @addTeamMembers="addTeamMembers"
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
                    <div class="process-consulting-ai-third-screen">
                        <Chat
                            v-if="isAdmin"
                            :prompt="prompt"
                            :name="projectName"
                            :messages="messages"
                            :chatInfo="chatInfo"
                            :userInfo="userInfo"
                            :allUserList="allUserList"
                            :lock="lock"
                            :disableChat="disableChat"
                            :chatRoomId="chatRoomId"
                            @sendMessage="beforeSendMessage"
                            @sendEditedMessage="sendEditedMessage"
                            @stopMessage="stopMessage"
                            @addTeam="addTeam"
                            @addTeamMembers="addTeamMembers"
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
                    </div>
                </template>
            </AppBaseCard>
        </div>
        <v-dialog v-model="executeDialog" max-width="80%" persistent
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

        <v-dialog v-model="marketplaceDialog" max-width="400" persistent
            :fullscreen="isMobile"
        >
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
import ProcessFlowExample from '@/components/ProcessFlowExample.vue';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

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
        ProcessDefinitionMarketPlaceDialog,
        ProcessFlowExample
    },
    props: {
        chatMode: {
            type: String,
            default: ""
        },
        selectedProcessDefinitionId: {
            type: String,
            default: null
        },
        treeProcessLocation: {
            type: Object,
            default: null
        },
        showFlowOverlay: {
            type: Boolean,
            default: false
        },
        currentProcessDefinitionForFlow: {
            type: Object,
            default: null
        },
        showActivityPanel: {
            type: Boolean,
            default: false
        },
        selectedFlowActivity: {
            type: Object,
            default: null
        }
    },
    data: () => ({
        allUserList: [],
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
        organizationChart: [],
        strategy: null,
        isHorizontal: false,
        // CrewAI 서비스 연동 관련
        useCrewAI: false, // 테스트용 플래그
        crewAIBaseURL: 'http://localhost:8000',
        crewAISessionId: null,
        
        // 실시간 JSON 파싱용
        accumulatedJSON: '',
        lastParsedJSON: null,
        isRetry: false,
        retryCount: 0,
        // 텍스트 에디터 다이얼로그
        textEditorDialog: false,
        textEditorField: '',
        textEditorTitle: '',
        textEditorContent: '',
        // 채팅창 접힘 상태
        isChatCollapsed: false,
        // Flow 레이아웃 (노드 위치 정보)
        flowLayout: null,
        flowLayoutChanged: false, // 위치 변경 여부 추적
    }),
    async created() {
        $try(async () => {
            // Issue: init Methods가 종료되기전에, ChatGenerator를 생성하면서 this로 넘겨주는 Client 정보가 누락되는 현상 발생.
            if(this.chatMode == 'consulting'){
                this.isConsultingMode = true
                this.isEditable = true;
            } else if(this.chatMode == 'tree') {
                // tree 모드일 때는 실제 프로세스 존재 여부를 확인
                try {
                    const value = await backend.getRawDefinition(this.selectedProcessDefinitionId);
                    // 프로세스가 존재하면 일반 채팅 모드
                    this.isConsultingMode = !value;
                } catch(e) {
                    // 에러 발생 시 컨설팅 모드
                    this.isConsultingMode = true;
                }
                this.isEditable = true;
            }
            
            if(this.isConsultingMode){
                this.userInfo = await this.backend.getUserInfo();

                this.processDefinitionMap = await backend.getProcessDefinitionMap();

                if(this.chatMode == 'tree'){
                    this.messages.push({
                        "role": "system",
                        "content": `${this.userInfo.name}님 안녕하세요! 생성할 프로세스의 .xlsx 파일을 첨부 후 맵 생성 버튼을 클릭하시면 요구사항 분석 후 프로세스 정의를 생성해드릴게요!`,
                        // "content": this.$t('ProcessDefinitionChat.greetingMessageTree', { name: this.userInfo.name }),
                        "timeStamp": Date.now(),
                    })
                } else {
                    this.messages.push({
                        "role": "system",
                        "content": this.$t('ProcessDefinitionChat.greetingMessage', { name: this.userInfo.name }),
                        "timeStamp": Date.now(),
                    })
                }

                // CrewAI 서비스 사용 여부에 따라 분기
                if (this.useCrewAI) {
                    // CrewAI 세션 초기화
                    await this.initCrewAISession();
                } else {
                    this.generator = new ConsultingGenerator(this, {
                        isStream: true,
                        preferredLanguage: "Korean"
                    });
                }

                this.EventBus.on('messages-updated', () => {
                    this.chatRenderKey++;
                });

            } else {
                await this.init();

                const isUseDataSource = localStorage.getItem('isUseDataSource');
                if(isUseDataSource == 'true') {
                    this.$try({
                        context: this,
                        action: async () => {
                            this.datasourceSchema = await backend.extractDatasourceSchema();
                            this.datasourceURL = this.datasourceSchema.map(item => item.endpoint);
                        },
                        errorMsg: '데이터소스 스키마 연동 실패'
                    });
                }

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

            this.EventBus.on('orientation-changed', (data) => {
                this.isHorizontal = data.isHorizontal;
            });

            const data = await this.getData(`configuration`, { match: { key: 'organization' } });
            if (data && data.value) {
                this.organizationChartId = data.uuid;
                if (data.value.chart) {
                    this.organizationChart = data.value.chart;
                }
            }

            const card = await backend.getBSCard();
            if (card) {
                this.strategy = card.value;
            }

            if (this.chatMode == 'tree') {
                this.isEditable = true;
                this.lock = false;
                this.disableChat = false;
                this.isViewMode = false;
            }
        });
    },
    watch: {
        selectedProcessDefinitionId(newVal, oldVal) {
            if (newVal && newVal !== oldVal) {
                console.log('✨ selectedProcessDefinitionId 변경됨:', newVal);
                // fullPath가 computed이므로 자동으로 업데이트되고 init()이 호출됨
                this.messages = [];
                if (this.init) {
                    this.init();
                }
            }
        },
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
            // selectedProcessDefinitionId가 있으면 우선 사용
            if (this.selectedProcessDefinitionId) {
                path = this.selectedProcessDefinitionId;
            } else if(this.$route.params.pathMatch){
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
        maxRetryCount() {
            // 컨설팅 모드: 최대 10번, 일반 모드: 최대 3번
            return this.isConsultingMode ? 10 : 3;
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
        /**
         * 텍스트 에디터 다이얼로그 열기
         */
        openTextEditorDialog(field, title, content) {
            this.textEditorField = field;
            this.textEditorTitle = title;
            this.textEditorContent = content || '';
            this.textEditorDialog = true;
        },
        
        /**
         * 텍스트 에디터 다이얼로그 닫기
         */
        closeTextEditorDialog() {
            this.textEditorDialog = false;
            this.textEditorField = '';
            this.textEditorTitle = '';
            this.textEditorContent = '';
        },
        
        /**
         * 텍스트 에디터 내용 저장
         */
        saveTextEditorContent() {
            if (this.selectedFlowActivity && this.textEditorField) {
                this.selectedFlowActivity[this.textEditorField] = this.textEditorContent;
            }
            this.closeTextEditorDialog();
        },
        
        /**
         * Flow 노드 더블클릭 핸들러 (부모로 이벤트 전달)
         */
        handleFlowNodeDoubleClick(nodeData) {
            this.$emit('node-double-click', nodeData);
        },
        
        /**
         * Flow 노드 위치 변경 핸들러
         * @param {Object} positions - 노드 위치 정보 객체
         */
        handleNodesPositionChanged(positions) {
            console.log('📍 노드 위치 변경 감지:', Object.keys(positions).length, '개 노드');
            this.flowLayout = positions;
            this.flowLayoutChanged = true;
        },
        
        /**
         * 액티비티 변경사항 저장
         */
        async saveActivity() {
            const me = this;
            
            try {
                // ✅ 직접 저장 처리 (이벤트 emit 불필요)
                await me.saveActivityChanges(me.selectedFlowActivity);
                
                // Flow 화면 업데이트를 위한 이벤트
                me.$emit('process-definition-updated', me.processDefinition);
                me.$emit('closeActivityPanel');
                
                console.log('✅ 액티비티 저장 완료');
            } catch (error) {
                console.error('❌ 액티비티 저장 중 오류:', error);
                alert('저장 중 오류가 발생했습니다: ' + error.message);
            }
        },
        
        /**
         * 액티비티 변경사항 저장 후 닫기
         */
        async closeAndSave() {
            await this.saveActivity();
        },
        
        async addTeamMembers(teamMemberData){
            const selectedTeamInfo = teamMemberData.selectedTeamInfo;
            const selectedTeamMembers = teamMemberData.selectedTeamMembers;

            const team = this.organizationChart.children.find(team => team.data.id === selectedTeamInfo.endpoint);
            if (team) {
                team.children = [];
                team.children.push(...selectedTeamMembers.map(member => ({
                    data: {
                        email: member.email,
                        id: member.id,
                        img: member.profile,
                        name: member.username,
                        pid: selectedTeamInfo.endpoint,
                        role: member.role
                    },
                    id: member.id,
                    name: member.username
                })));
            }

            var putObj =  {
                key: 'organization',
                value: {
                    chart: this.organizationChart,
                }
            };
            if (this.organizationChartId) {
                putObj.uuid = this.organizationChartId;
            }
            await this.putObject("configuration", putObj);
        
        },
        async addTeam(newTeamData){
            try {
                let teamInfo = newTeamData.teamInfo;
                let index = newTeamData.index;
                this.messages[index].adding = true;
    
                const newTeam = {
                    id: teamInfo.endpoint,
                    data: {
                        id: teamInfo.endpoint,
                        name: teamInfo.name,
                        isTeam: true,
                        img: '/images/chat-icon.png'
                    },
                    children: []
                }
    
                this.organizationChart.children.push(newTeam);
    
                var putObj =  {
                    key: 'organization',
                    value: {
                        chart: this.organizationChart,
                    }
                };
                if (this.organizationChartId) {
                    putObj.uuid = this.organizationChartId;
                }
                // await this.putObject("configuration", putObj);

                this.messages[index].added = true;
                this.messages[index].adding = false;

                this.allUserList = await backend.getUserList();
            } catch(e) {
                console.log(e);
                this.messages[index].added = false;
                this.messages[index].adding = false;
            }
        },
        setProcessDefinitionPrompt(){
            if (this.processDefinitionMap) {
                this.generator.setProcessDefinitionMap(this.processDefinitionMap);
            }
            if (this.processDefinition) {
                this.generator.setProcessDefinition(this.processDefinition);
            }

            if (this.organizationChart) {
                this.generator.setOrganizationChart(JSON.stringify(this.organizationChart));
            }

            if (this.strategy) {
                this.generator.setStrategy(JSON.stringify(this.strategy));
            }
        },
        // 시퀀스 정보를 활용하여 activities 순서를 재정렬하는 함수
        reorderActivitiesBySequence(jsonData) {
            try {
                if (!jsonData.sequences || !jsonData.activities || jsonData.activities.length === 0) {
                    return jsonData;
                }

                // 모든 노드의 등장 횟수를 카운트
                const nodeCount = new Map();
                
                // source와 target에서의 등장 횟수를 각각 카운트
                jsonData.sequences.forEach(seq => {
                    nodeCount.set(seq.source, (nodeCount.get(seq.source) || 0) + 1);
                    nodeCount.set(seq.target, (nodeCount.get(seq.target) || 0) + 1);
                });

                // source에만 한 번 등장하는 노드를 찾음 (시작점)
                let startNode = null;
                jsonData.sequences.forEach(seq => {
                    const sourceCount = nodeCount.get(seq.source) || 0;
                    if (sourceCount === 1 && !jsonData.sequences.some(s => s.target === seq.source)) {
                        startNode = seq.source;
                    }
                });

                if (!startNode) {
                    console.warn("시작점을 찾을 수 없습니다.");
                    return jsonData;
                }

                // 시작점부터 순서대로 노드를 따라가며 activities 순서 결정
                const orderedNodes = [];
                const visited = new Set();
                
                function traverseNodes(currentNode) {
                    if (visited.has(currentNode)) return;
                    visited.add(currentNode);
                    orderedNodes.push(currentNode);

                    // 현재 노드에서 시작하는 모든 시퀀스를 찾아서 순서대로 처리
                    const nextSequences = jsonData.sequences.filter(seq => seq.source === currentNode);
                    nextSequences.forEach(seq => {
                        traverseNodes(seq.target);
                    });
                }

                traverseNodes(startNode);

                // activities 배열 재정렬
                const activityMap = new Map(jsonData.activities.map(act => [act.id, act]));
                const reorderedActivities = [];

                // 순서가 결정된 노드들 중 activity인 것들만 순서대로 추가
                orderedNodes.forEach(nodeId => {
                    if (activityMap.has(nodeId)) {
                        reorderedActivities.push(activityMap.get(nodeId));
                    }
                });

                // 혹시 순서가 결정되지 않은 activity가 있다면 마지막에 추가
                jsonData.activities.forEach(activity => {
                    if (!reorderedActivities.some(act => act.id === activity.id)) {
                        reorderedActivities.push(activity);
                    }
                });

                jsonData.activities = reorderedActivities;
                return jsonData;
                
            } catch (error) {
                console.error('Error reordering activities:', error);
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

            if(!this.isConsultingMode){
                this.setProcessDefinitionPrompt();
            }

            this.startGenerate();
        },
        async beforeSaveDefinition(info){
            if(this.chatMode == 'consulting'){
                await this.$emit("createdBPMN", this.processDefinition)
                info.skipSaveProcMap = true
            }
            if (this.useOptimize) {
                this.optimizeDefinition(info.definition);
            }
            if(window.$pal){
                await this.beforeSavePALUserTasks(info);
            }
            
            // Flow 레이아웃 저장 (ProcessFlowExample ref에서 현재 위치 가져오기)
            if (this.$refs.processFlowExample && typeof this.$refs.processFlowExample.getNodesPositions === 'function') {
                info.flow_layout = this.$refs.processFlowExample.getNodesPositions();
                console.log('📍 저장할 Flow 레이아웃:', Object.keys(info.flow_layout || {}).length, '개 노드');
            } else if (this.flowLayout) {
                // ref가 없으면 저장된 flowLayout 사용
                info.flow_layout = this.flowLayout;
            }
            
            // 엑셀 파일이 업로드되어 있으면 Supabase Storage에 저장
            try {
                if(this.processDefinition && !this.processDefinition.excel_template_url) {
                    const excelTemplateUrl = await new Promise((resolve) => {
                        // emit으로 부모 컴포넌트에 업로드 요청
                        this.$emit('upload-excel-to-storage', (url) => {
                            resolve(url);
                        });
                    });
                    
                    if (excelTemplateUrl) {
                        // processDefinition에 엑셀 템플릿 URL 저장
                        if (!this.processDefinition) {
                            this.processDefinition = {};
                        }
                        this.processDefinition.excel_template_url = excelTemplateUrl;
                        console.log('✅ 엑셀 템플릿 URL이 processDefinition에 저장되었습니다:', excelTemplateUrl);
                    }
                }
            } catch (error) {
                console.error('❌ 엑셀 파일 업로드 중 오류:', error);
                // 엑셀 업로드 실패해도 프로세스 저장은 계속 진행
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
                            // me.lock = true;
                            // me.disableChat = true;
                            // me.isViewMode = true;
                        }
                    } else {
                        // me.editUser = '';
                        // me.lock = true;
                        // me.disableChat = true;
                        // me.isViewMode = true;
                    }

                    if(me.chatMode == 'tree') {
                        me.disableChat = false;
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
                            await backend.setLock({
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
            if (open) {
                // 다이얼로그를 열 때는 먼저 false로 설정한 후 true로 설정하여 watch가 트리거되도록 함
                this.verMangerDialog = false;
                this.$nextTick(() => {
                    this.verMangerDialog = true;
                });
            } else {
                this.verMangerDialog = false;
            }
        },
        async changeXML(info) {
            var me = this;
            if(me.mode == 'ProcessGPT') {
                if (!info) return;
                if (!info.id) return;
                if (!info.xml) return;

                // processDefinition 변환
                me.processDefinition = await me.convertXMLToJSON(info.xml);

                // 기존 putRawDefinition 메서드를 사용해서 안전하게 업데이트
                await me.backend.putRawDefinition(info.xml, info.id, {
                    name: info.name,
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
        async changeBpmn(newVal) {
            this.loadBPMN(newVal);
            // BPMN이 변경되면 processDefinition도 업데이트
            if (newVal) {
                try {
                    // ✅ 변환 전에 메타데이터 백업 (excel_template_url 등)
                    const metadataBackup = {
                        excel_template_url: this.processDefinition?.excel_template_url,
                        processDefinitionId: this.processDefinition?.processDefinitionId,
                        processDefinitionName: this.processDefinition?.processDefinitionName,
                        shortDescription: this.processDefinition?.shortDescription,
                        version: this.processDefinition?.version
                    };
                    
                    this.processDefinition = await this.convertXMLToJSON(newVal);
                    
                    // ✅ 변환 후 메타데이터 복원 (변환 결과에 없는 경우만)
                    if (metadataBackup.excel_template_url && !this.processDefinition.excel_template_url) {
                        this.processDefinition.excel_template_url = metadataBackup.excel_template_url;
                        console.log('✅ excel_template_url 복원됨:', metadataBackup.excel_template_url);
                    }
                    if (metadataBackup.processDefinitionId && !this.processDefinition.processDefinitionId) {
                        this.processDefinition.processDefinitionId = metadataBackup.processDefinitionId;
                    }
                    if (metadataBackup.processDefinitionName && !this.processDefinition.processDefinitionName) {
                        this.processDefinition.processDefinitionName = metadataBackup.processDefinitionName;
                    }
                    if (metadataBackup.shortDescription && !this.processDefinition.shortDescription) {
                        this.processDefinition.shortDescription = metadataBackup.shortDescription;
                    }
                    if (metadataBackup.version && !this.processDefinition.version) {
                        this.processDefinition.version = metadataBackup.version;
                    }
                    
                    console.log('🔄 BPMN 변경으로 processDefinition 업데이트:', this.processDefinition);
                } catch (error) {
                    console.error('❌ BPMN to JSON 변환 오류:', error);
                }
            }
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
        /**
         * Flow 화면에서 액티비티 정보를 업데이트하는 메서드
         * ⚠️ 중요: elements/activities/sequences만 수정, 메타데이터는 절대 건드리지 않음
         * @param {Object} activityData - 업데이트할 액티비티 정보
         * @returns {Promise<Object>} 업데이트된 processDefinition
         */
        async updateActivityFromFlow(activityData) {
            try {
                console.log('🔄 액티비티 업데이트 시작:', activityData.id);
                
                if (!this.processDefinition) {
                    throw new Error('프로세스 정의를 찾을 수 없습니다.');
                }
                
                // ✅ 메타데이터 보호 - 업데이트 전 확인
                const originalName = this.processDefinition.processDefinitionName;
                const originalId = this.processDefinition.processDefinitionId;
                
                // ✅ elements가 있으면 activities/sequences로 동기화 (근본 해결)
                if (this.processDefinition.elements && Array.isArray(this.processDefinition.elements)) {
                    // activities 배열 동기화
                    this.processDefinition.activities = this.processDefinition.elements.filter(el => 
                        el && el.elementType === 'Activity'
                    );
                    
                    // sequences 배열 동기화
                    this.processDefinition.sequences = this.processDefinition.elements.filter(el => 
                        el && el.elementType === 'Sequence'
                    );
                    
                    // gateways 배열 동기화
                    this.processDefinition.gateways = this.processDefinition.elements.filter(el => 
                        el && el.elementType === 'Gateway'
                    );
                    
                    // events 배열 동기화
                    this.processDefinition.events = this.processDefinition.elements.filter(el => 
                        el && el.elementType === 'Event'
                    );
                    
                    console.log('✅ elements → activities/sequences 동기화 완료:', {
                        activities: this.processDefinition.activities.length,
                        sequences: this.processDefinition.sequences.length,
                        gateways: this.processDefinition.gateways?.length,
                        events: this.processDefinition.events?.length
                    });
                }
                
                const activityName = activityData.content || activityData.name;
                let updated = false;
                
                // activities 구조로 처리 (이제 항상 최신 상태)
                if (this.processDefinition.activities && Array.isArray(this.processDefinition.activities)) {
                    const activity = this.processDefinition.activities.find(act => 
                        act && (act.id === activityData.id || act.name === activityName)
                    );
                    
                    if (activity) {
                        // ✅ activity 속성 수정
                        activity.system = activityData.footer;
                        activity.description = activityData.description;
                        activity.role = activityData.header;
                        activity.issues = activityData.issues;
                        
                        if (activityData.inputData !== undefined) activity.inputData = activityData.inputData;
                        if (activityData.outputData !== undefined) activity.outputData = activityData.outputData;
                        if (activityData.coreData !== undefined) activity.coreData = activityData.coreData;
                        
                        updated = true;
                        console.log('✅ Activity 업데이트:', activity.name);
                        
                        // ✅ elements에도 동기화 (양방향 동기화)
                        if (this.processDefinition.elements) {
                            const element = this.processDefinition.elements.find(el => 
                                el && el.id === activity.id
                            );
                            if (element) {
                                element.system = activity.system;
                                element.description = activity.description;
                                element.role = activity.role;
                                element.issues = activity.issues;
                                element.inputData = activity.inputData;
                                element.outputData = activity.outputData;
                                element.coreData = activity.coreData;
                                console.log('✅ Element도 동기화 완료');
                            }
                        }
                    }
                    
                    // ✅ 시퀀스 수정
                    if (activityData.incomingSequenceId && this.processDefinition.sequences) {
                        const sequence = this.processDefinition.sequences.find(seq => 
                            seq.id === activityData.incomingSequenceId
                        );
                        if (sequence) {
                            sequence.requiredTime = activityData.requiredTime;
                            console.log('✅ 들어오는 시퀀스 시간 업데이트:', sequence.id);
                            
                            // ✅ elements에도 동기화
                            if (this.processDefinition.elements) {
                                const element = this.processDefinition.elements.find(el => 
                                    el && el.id === sequence.id
                                );
                                if (element) {
                                    element.requiredTime = sequence.requiredTime;
                                }
                            }
                        }
                    }
                    
                    if (activityData.backflowSequenceId && this.processDefinition.sequences) {
                        const sequence = this.processDefinition.sequences.find(seq => 
                            seq.id === activityData.backflowSequenceId
                        );
                        if (sequence) {
                            sequence.requiredTime = activityData.backflowRequiredTime;
                            console.log('✅ 역행 시퀀스 시간 업데이트:', sequence.id);
                            
                            // ✅ elements에도 동기화
                            if (this.processDefinition.elements) {
                                const element = this.processDefinition.elements.find(el => 
                                    el && el.id === sequence.id
                                );
                                if (element) {
                                    element.requiredTime = sequence.requiredTime;
                                }
                            }
                        }
                    }
                }
                
                if (!updated) {
                    throw new Error('액티비티를 찾을 수 없습니다: ' + activityData.id);
                }
                
                // ✅ 메타데이터 검증 - 혹시 손실되었다면 복원
                if (!this.processDefinition.processDefinitionName && originalName) {
                    console.warn('⚠️ processDefinitionName 손실 감지, 복원:', originalName);
                    this.processDefinition.processDefinitionName = originalName;
                }
                if (!this.processDefinition.processDefinitionId && originalId) {
                    console.warn('⚠️ processDefinitionId 손실 감지, 복원:', originalId);
                    this.processDefinition.processDefinitionId = originalId;
                }
                
                // ⚠️ Vue 반응성 트리거는 saveActivityChanges()에서 처리 (XML 생성 후)
                console.log('✅ 액티비티 업데이트 완료 (elements/sequences만 수정)');
                return this.processDefinition;
                
            } catch (error) {
                console.error('❌ 액티비티 업데이트 실패:', error.message);
                throw error;
            }
        },
        /**
         * Flow 화면에서 액티비티 저장 (업데이트 + 백엔드 저장)
         * @param {Object} activityData - 저장할 액티비티 정보
         * @returns {Promise<Object>} 업데이트된 processDefinition
         */
        async saveActivityChanges(activityData) {
            try {
                if (!activityData) {
                    throw new Error('저장할 액티비티 정보가 없습니다.');
                }
                
                console.log('💾 액티비티 저장 시작:', activityData.id);
                
                // ✅ 저장 전 메타데이터 백업 (processDefinitionName 보존)
                const metadataBackup = {
                    processDefinitionId: this.processDefinition.processDefinitionId,
                    processDefinitionName: this.processDefinition.processDefinitionName,
                    shortDescription: this.processDefinition.shortDescription,
                    version: this.processDefinition.version,
                    excel_template_url: this.processDefinition.excel_template_url,
                };
                
                console.log('📋 메타데이터 백업:', metadataBackup);
                
                // 1. 액티비티 업데이트 (elements/sequences만 수정)
                await this.updateActivityFromFlow(activityData);
                
                // ✅ 저장 후 메타데이터 복원 (혹시 손실되었다면)
                if (!this.processDefinition.processDefinitionName && metadataBackup.processDefinitionName) {
                    console.warn('⚠️ processDefinitionName이 손실되어 복원합니다.');
                    this.processDefinition.processDefinitionName = metadataBackup.processDefinitionName;
                }
                if (!this.processDefinition.processDefinitionId && metadataBackup.processDefinitionId) {
                    this.processDefinition.processDefinitionId = metadataBackup.processDefinitionId;
                }
                if (metadataBackup.shortDescription && !this.processDefinition.shortDescription) {
                    this.processDefinition.shortDescription = metadataBackup.shortDescription;
                }
                if (metadataBackup.version && !this.processDefinition.version) {
                    this.processDefinition.version = metadataBackup.version;
                }
                if (metadataBackup.excel_template_url && !this.processDefinition.excel_template_url) {
                    this.processDefinition.excel_template_url = metadataBackup.excel_template_url;
                }
                
                // ✅ 2. elements 구조로 변환 (필요한 경우)
                if (!this.processDefinition.elements && this.processDefinition.activities) {
                    console.log('🔄 예전 구조 감지 - elements 구조로 변환 시작');
                    if (this.convertOldFormatToElements) {
                        this.processDefinition = await this.convertOldFormatToElements(this.processDefinition);
                        console.log('✅ elements 구조 변환 완료');
                    }
                }
                
                // ✅ 3. null 제거
                if (Array.isArray(this.processDefinition.elements)) {
                    this.processDefinition.elements = this.processDefinition.elements.filter(el => el !== null && el !== undefined);
                    console.log('✅ null 요소 제거 완료');
                }
                
                // ✅ 4. BPMN XML 재생성 (저장 전 최신 상태 반영)
                if (this.createBpmnXml && this.processDefinition.elements) {
                    this.bpmn = this.createBpmnXml(this.processDefinition, false);
                    console.log('✅ 저장용 BPMN XML 재생성 완료');
                } else {
                    console.warn('⚠️ createBpmnXml 실패 또는 elements 없음:', {
                        hasCreateBpmnXml: !!this.createBpmnXml,
                        hasElements: !!this.processDefinition.elements,
                        elementsType: typeof this.processDefinition.elements,
                        elementsLength: this.processDefinition.elements?.length
                    });
                }
                
                // 5. 백엔드 저장
                // Flow 레이아웃 수집 (ProcessFlowExample ref에서 현재 위치 가져오기)
                let currentFlowLayout = this.flowLayout;
                if (this.$refs.processFlowExample && typeof this.$refs.processFlowExample.getNodesPositions === 'function') {
                    currentFlowLayout = this.$refs.processFlowExample.getNodesPositions();
                    console.log('📍 현재 Flow 레이아웃 수집:', Object.keys(currentFlowLayout || {}).length, '개 노드');
                }
                
                const info = {
                    name: this.processDefinition.processDefinitionName,
                    type: "bpmn",
                    definition: this.processDefinition,
                    flow_layout: currentFlowLayout || null, // Flow 레이아웃 저장
                };
                
                console.log('💾 저장할 정보:', {
                    processDefinitionName: info.name,
                    processDefinitionId: this.processDefinition.processDefinitionId,
                    elementsCount: this.processDefinition.elements?.length || 0,
                    hasFlowLayout: !!info.flow_layout
                });
                
                // ✅ processDefinitionName이 null이면 저장 중단
                if (!info.name) {
                    console.error('❌ processDefinitionName이 null입니다. 백업:', metadataBackup);
                    throw new Error('프로세스 이름을 찾을 수 없습니다. 저장을 중단합니다.');
                }
                
                await backend.putRawDefinition(
                    this.bpmn,
                    this.processDefinition.processDefinitionId,
                    info
                );
                
                // ✅ Vue 반응성 트리거 (XML 보기 화면 업데이트)
                this.definitionChangeCount++;
                this.isChanged = true;
                
                console.log('✅ 액티비티 저장 완료:', activityData.id);
                console.log('🔄 definitionChangeCount 업데이트:', this.definitionChangeCount);
                
                // 3. 업데이트된 processDefinition 반환
                return this.processDefinition;
                
            } catch (error) {
                console.error('❌ 액티비티 저장 실패:', error.message);
                throw error;
            }
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
            let fullPath = me.fullPath;
            let lastPath = me.$route.params.pathMatch ? me.$route.params.pathMatch[me.$route.params.pathMatch.length - 1] : null;
                if (fullPath && fullPath != 'definitions-tree' && lastPath != 'chat') {
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
                            // Flow 레이아웃 불러오기
                            if (value.flow_layout) {
                                me.flowLayout = value.flow_layout;
                                console.log('📍 저장된 Flow 레이아웃 로드:', Object.keys(me.flowLayout).length, '개 노드');
                            }
                            me.afterLoadBpmn();
                        } else {
                            me.processDefinition.processDefinitionId = fullPath;
                        }
                        if (!this.isConsultingMode) {
                            this.$emit('process-definition-ready');
                        }

                        // const role = localStorage.getItem('role');
                        // if (role !== 'superAdmin') {
                        //     // 수정 권한 체크
                        //     const permission = await me.checkPermission(lastPath);
                        //     if (permission && permission.writable) {
                        //         me.isEditable = true;
                        //         me.checkedLock(lastPath);
                        //     } else if (permission && !permission.writable) {
                        //         me.isEditable = false;
                        //         me.lock = true;
                        //         me.disableChat = true;
                        //         me.isViewMode = true;
                        //     }
                        // } else {
                        //     me.isEditable = true;
                        //     me.checkedLock(lastPath);
                        // }
                        me.isEditable = true;
                        me.checkedLock(lastPath);
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
                // if (me.$route.query && me.$route.query.edit) {
                //     me.lock = true;
                //     me.toggleLock();
                // }
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
            this.setOrientation();
            let fullPath = me.fullPath;
            let lastPath = me.$route.params.pathMatch ? me.$route.params.pathMatch[me.$route.params.pathMatch.length - 1] : null;
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
        setOrientation() {
            const store = useBpmnStore();
            let me = this;
            let modeler = store.getModeler;
            const canvas = modeler.get('canvas');
            const container = canvas.getContainer();
            const elementRegistry = modeler.get('elementRegistry');
            const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
            let isMobile = false;
            
            const { width, height } = container.getBoundingClientRect();
            if(width - 100 > height) {
                isMobile = false;
            } else {
                isMobile = true;
            }

            participant.forEach(element => {
                const horizontal = element.di.isHorizontal;
                if(!isMobile && !horizontal) {
                    if(element.width < element.height) {
                        me.isHorizontal = true;
                    }
                } else if(isMobile && horizontal) {
                    if(element.width > element.height) {
                        me.isHorizontal = false;
                    }
                }
            });
        },
        beforeSendMessage(newMessage) {
            this.waitForCustomer = false
            // 새로운 메시지를 보낼 때 재시도가 아니라면 retryCount 초기화
            if(!this.isRetry) {
                this.retryCount = 0;
            }
            if(!this.isConsultingMode){
                this.generator = new ChatGenerator(this, {
                    isStream: true,
                    preferredLanguage: 'Korean'
                });
                this.generator.client.genType = 'proc_def'
                this.setProcessDefinitionPrompt();
                this.sendMessage(newMessage);
            } else {
                // 컨설팅 모드에서 CrewAI 사용 여부에 따라 분기
                if (this.useCrewAI) {
                    this.sendMessageToCrewAI(newMessage);
                } else {
                    this.sendMessage(newMessage);
                }
            }
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
                            if(unknown.answerType && unknown.answerType == 'consulting'){
                                this.messages[this.messages.length - 1].disableMsg = false
                            }
                        }
                    } else {
                        if (unknown.processDefinitionId) {
                            this.processDefinition = unknown;
                            if(!this.processDefinition) this.processDefinition = {};
                            
                            // 트리에서 생성한 프로세스인 경우 트리에서 정한 ID 사용
                            if (this.treeProcessLocation && this.treeProcessLocation.processDefinitionId) {
                                this.processDefinition['processDefinitionId'] = this.treeProcessLocation.processDefinitionId;
                                this.processDefinition['processDefinitionName'] = this.treeProcessLocation.processDefinitionName || unknown.processDefinitionName;
                                this.projectName = this.treeProcessLocation.processDefinitionName || unknown.processDefinitionName;
                                this.oldProcDefId = this.treeProcessLocation.processDefinitionId;
                            } else {
                                this.processDefinition['processDefinitionId'] = unknown.processDefinitionId;
                                this.processDefinition['processDefinitionName'] = unknown.processDefinitionName;
                                this.projectName = unknown.processDefinitionName;
                                this.oldProcDefId = unknown.processDefinitionId;
                            }
                            
                            // this.bpmn = this.createBpmnXml(this.processDefinition);
                            this.bpmn = this.createBpmnXml(unknown, true); // 항상 가로형으로 생성
                            this.definitionChangeCount++;

                            if (!this.isConsultingMode) {
                                this.$emit('process-definition-ready');
                            }
                        }
                    }
                } 
            } catch (error) {
                console.log(jsonProcess);
                console.log(error);
            }
        },

        parseJsonProcess(response) {
            if(response != ""){
                if(this.retryCount < this.maxRetryCount) {
                    this.retryCount++;
                    this.isRetry = true;
                    this.messages.push({
                        "role": "system",
                        "content": `프로세스 생성 시도중 오류 발생하여 다시 시도합니다. (${this.retryCount}/${this.maxRetryCount})`,
                        "timeStamp": Date.now()
                    })
                    const newMessage = {
                        "images": [],
                        "text": "프로세스 생성 시도중 오류 발생하여 다시 시도합니다. 올바른 json 형식으로 다시 생성해주세요.",
                        "mentionedUsers": []
                    }
                    this.beforeSendMessage(newMessage)
                } else {
                    this.isRetry = false;
                    this.retryCount = 0;
                    this.messages.push({
                        "role": "system",
                        "content": `프로세스 생성 시도중 오류 발생하였습니다. 최대 재시도 횟수(${this.maxRetryCount}회)를 초과했습니다. 잠시 후 다시 시도해주세요.`,
                        "timeStamp": Date.now()
                    })
                }
            } else {
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
            }
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
                    duration: duration,
                    // ✅ system, issues 추가
                    system: activity.system || "",
                    issues: activity.issues || ""
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
                
                // ✅ requiredTime 추가
                if (sequence.requiredTime) {
                    newElement.requiredTime = sequence.requiredTime;
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
                            try {
                                jsonProcess = partialParse(jsonProcess)
                            } catch(e){
                                // 재시도
                                if(this.retryCount < this.maxRetryCount) {
                                    this.retryCount++;
                                    this.isRetry = true;
                                    this.messages.push({
                                        "role": "system",
                                        "content": `프로세스 생성 시도중 오류 발생하여 다시 시도합니다. (${this.retryCount}/${this.maxRetryCount})`,
                                        "timeStamp": Date.now()
                                    })
                                    const newMessage = {
                                        "images": [],
                                        "text": "프로세스 생성 시도중 오류 발생하여 다시 시도합니다. 올바른 json 형식으로 다시 생성해주세요.",
                                        "mentionedUsers": []
                                    }
                                    this.beforeSendMessage(newMessage)
                                } else {
                                    this.isRetry = false;
                                    this.retryCount = 0;
                                    this.messages.push({
                                        "role": "system",
                                        "content": `프로세스 생성 시도중 오류 발생하였습니다. 최대 재시도 횟수(${this.maxRetryCount}회)를 초과했습니다. 잠시 후 다시 시도해주세요.`,
                                        "timeStamp": Date.now()
                                    })
                                }
                            }
                        }
                    }
                }
            } else {
                jsonProcess = response;
            }
            let isAskProcessDef = false;
            if (jsonProcess) {
                let unknown = jsonProcess;

                if(this.isConsultingMode){
                    let content
                    if(unknown){
                        content = unknown.content
                        this.messages[this.messages.length - 1].content = content

                        if(unknown.validity && unknown.validity == "Suitable"){
                            // 적절한 답변이 생성되었으므로 재시도 카운트 초기화
                            this.retryCount = 0;
                            this.isRetry = false;
                            this.generator = new ConsultingGenerator(this, {
                                isStream: true,
                                preferredLanguage: "Korean"
                            });
                        } else if(unknown.validity && unknown.validity == "Unsuitable"){
                            // 부적절한 답변이므로 재시도 카운트 증가
                            if(this.retryCount < this.maxRetryCount) {
                                this.retryCount++;
                                console.log(`컨설팅 답변 재생성 중... (${this.retryCount}/${this.maxRetryCount})`);
                            } else {
                                // 최대 재시도 횟수 초과
                                this.retryCount = 0;
                                this.isRetry = false;
                                this.messages.push({
                                    "role": "system",
                                    "content": `적절한 답변 생성을 위한 최대 재시도 횟수(${this.maxRetryCount}회)를 초과했습니다. 다른 질문을 해주시거나 잠시 후 다시 시도해주세요.`,
                                    "timeStamp": Date.now()
                                });
                                return; // 재시도 중단
                            }
                            this.generator = new ConsultingGenerator(this, {
                                isStream: true,
                                preferredLanguage: "Korean"
                            });
                        } else {
                            if(unknown.answerType && unknown.answerType == 'generateProcessDef'){
                                // 프로세스 생성 모드로 전환 시 재시도 카운트 초기화
                                this.retryCount = 0;
                                this.isRetry = false;
                                this.generator = new ChatGenerator(this, {
                                    isStream: true,
                                    preferredLanguage: 'Korean'
                                });
                                this.isConsultingMode = false
                                this.waitForCustomer = true
                                this.$emit("openProcessPreview")
                            } 
                        }
                        if(!unknown.answerType || unknown.answerType != 'consulting'){
                            this.beforeStartGenerate()
                        }
                    }
                } 

                if(!this.isConsultingMode) {
                    if(unknown.answerType && unknown.answerType == 'askProcessDef'){
                        this.messages[this.messages.length - 1].content = unknown.content
                        isAskProcessDef = true;
                    } else {
                        if(unknown.processDefinitionName){
                            this.projectName = unknown.processDefinitionName
                        }
                        
                        // 트리에서 생성한 프로세스인 경우 트리에서 정한 ID를 사용
                        let megaProcessId = unknown.megaProcessId;
                        let majorProcessId = unknown.majorProcessId;
                        let processDefinitionId = unknown.processDefinitionId;
                        let processDefinitionName = unknown.processDefinitionName;
                        
                        if (this.treeProcessLocation) {
                            megaProcessId = this.treeProcessLocation.megaProcessId || megaProcessId;
                            majorProcessId = this.treeProcessLocation.majorProcessId || majorProcessId;
                            processDefinitionId = this.treeProcessLocation.processDefinitionId || processDefinitionId;
                            processDefinitionName = this.treeProcessLocation.processDefinitionName || processDefinitionName;
                        }
                        
                        if (megaProcessId && this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                            if (!this.processDefinitionMap.mega_proc_list.some((megaProcess) => megaProcess.id == megaProcessId)) {
                                this.processDefinitionMap.mega_proc_list.push({
                                    name: this.treeProcessLocation?.megaProcessName || megaProcessId,
                                    id: megaProcessId,
                                    major_proc_list: [
                                        {
                                            name: this.treeProcessLocation?.majorProcessName || majorProcessId,
                                            id: majorProcessId,
                                            sub_proc_list: [
                                                {
                                                    id: processDefinitionId,
                                                    name: processDefinitionName
                                                }
                                            ]
                                        }
                                    ]
                                });
                            }
                            if (majorProcessId) {
                                this.processDefinitionMap.mega_proc_list.forEach((megaProcess) => {
                                    if (megaProcess.id == megaProcessId) {
                                        if (megaProcess.major_proc_list.some((majorProcess) => majorProcess.id == majorProcessId)) {
                                            const idx = megaProcess.major_proc_list.findIndex(
                                                (majorProcess) => majorProcess.id == majorProcessId
                                            );
                                            if (
                                                !megaProcess.major_proc_list[idx].sub_proc_list.some(
                                                    (subProcess) => subProcess.id == processDefinitionId
                                                )
                                            ) {
                                                megaProcess.major_proc_list[idx].sub_proc_list.push({
                                                    id: processDefinitionId,
                                                    name: processDefinitionName
                                                });
                                            }
                                        } else {
                                            megaProcess.major_proc_list.push({
                                                name: this.treeProcessLocation?.majorProcessName || majorProcessId,
                                                id: majorProcessId,
                                                sub_proc_list: [
                                                    {
                                                        id: processDefinitionId,
                                                        name: processDefinitionName
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
                                    const elementToDelete = modification.value;
                                    const elementId = elementToDelete.id;
                                    
                                    // 1. 먼저 sequences에서 해당 요소와 관련된 모든 연결 제거
                                    if (this.processDefinition.sequences) {
                                        this.processDefinition.sequences = this.processDefinition.sequences.filter(seq => 
                                            seq.source !== elementId && seq.target !== elementId
                                        );
                                    }
                                    
                                    // 2. elements 배열에서 sequence 요소들 제거
                                    if (this.processDefinition.elements) {
                                        this.processDefinition.elements = this.processDefinition.elements.filter(element => {
                                            if (element.elementType === 'Sequence') {
                                                return element.source !== elementId && element.target !== elementId;
                                            }
                                            return element.id !== elementId;
                                        });
                                    }
                                    
                                    // 3. 타겟 경로에서 요소 제거
                                    if (this.processDefinition[targetJsonPath]) {
                                        this.processDefinition[targetJsonPath] = this.processDefinition[targetJsonPath].filter(
                                            item => item.id !== elementId
                                        );
                                    }
                                    
                                    // 4. 다른 요소들의 참조 정리
                                    const cleanupReferences = (items) => {
                                        if (!items) return;
                                        items.forEach(item => {
                                            if (item.source === elementId) {
                                                item.source = '';
                                            }
                                            if (item.target === elementId) {
                                                item.target = '';
                                            }
                                        });
                                    };
                                    
                                    cleanupReferences(this.processDefinition.elements);
                                    cleanupReferences(this.processDefinition.sequences);
                                    
                                    // 5. 프로세스 정의 정리 및 변환
                                    if (this.processDefinition.activities && this.processDefinition.sequences) {
                                        this.processDefinition = await this.convertOldFormatToElements(this.processDefinition);
                                    }
                                    
                                    // 6. BPMN XML 재생성
                                    try {
                                        this.bpmn = this.createBpmnXml(this.processDefinition, true); // 항상 가로형으로 생성
                                    } catch (error) {
                                        console.error('Error creating BPMN XML:', error);
                                        // 오류 발생 시 기본 BPMN 구조 유지
                                        if (!this.bpmn) {
                                            this.bpmn = '<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"></bpmn:definitions>';
                                        }
                                    }
                                }
                                if(this.processDefinition['activities'] && this.processDefinition['sequences']) {
                                    this.processDefinition = await this.convertOldFormatToElements(this.processDefinition);
                                }
                                this.bpmn = this.createBpmnXml(this.processDefinition, true); // 항상 가로형으로 생성
                            }
                            this.oldProcDefId = unknown.processDefinitionId;
                            this.definitionChangeCount++;
                            
                            // 🔥 modifications 처리 완료 후 Flow 업데이트를 위한 이벤트 emit
                            console.log('🔄 modifications 처리 완료 - Flow 업데이트 이벤트 emit', this.processDefinition);
                            this.$emit('process-definition-updated', this.processDefinition);
                        }
    
                        if(!jsonProcess.answerType){
                            const addTeamMessage = (team) => {
                                this.messages.push({
                                    "role": "system",
                                    "content": `${team.name} 팀이 새로 추가되었습니다. 해당 팀을 조직도에 추가하시겠습니까?`,
                                    "timeStamp": Date.now(),
                                    "type": "add_team",
                                    "newTeamInfo": team
                                })
                            }
                            if(jsonProcess.modifications){
                                // 수정이 성공적으로 완료되었으므로 재시도 카운트 초기화
                                this.retryCount = 0;
                                this.isRetry = false;
                                this.messages.push({
                                    "role": "system",
                                    "content": `요청하신 내용에 따라 수정을 완료하였습니다.`,
                                    "timeStamp": Date.now()
                                });
                                
                                // 🔥 프로세스 수정 완료 후 Flow 업데이트를 위한 이벤트 emit
                                console.log('🔄 프로세스 수정 완료 - Flow 업데이트 이벤트 emit', this.processDefinition);
                                this.$emit('process-definition-updated', this.processDefinition);
                                
                                jsonProcess.modifications.forEach(modification => {
                                    if(modification.action == 'add' 
                                    && modification.value 
                                    && modification.value.origin 
                                    && modification.value.origin == 'created'){
                                        addTeamMessage(modification.value)
                                    }
                                })
                            } else {
                                await this.checkedFormData();
                                // 성공적으로 생성되었으므로 재시도 카운트 초기화
                                this.retryCount = 0;
                                this.isRetry = false;
                                
                                this.$emit('process-definition-ready');
                                
                                // 🔥 프로세스 생성 완료 후 Flow 업데이트를 위한 이벤트 emit
                                console.log('🎉 프로세스 생성 완료 - Flow 업데이트 이벤트 emit', this.processDefinition);
                                this.$emit('process-definition-updated', this.processDefinition);

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
    
                                if(jsonProcess.roles) {
                                    jsonProcess.roles.forEach(role => {
                                        if(role.origin == 'created'){
                                            addTeamMessage(role)
                                        }
                                    })
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
            if(!isAskProcessDef){
                this.isAIGenerated = true;
                this.definitionChangeCount++;
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

        // ====== CrewAI 서비스 연동 메서드들 ======
        
        async initCrewAISession() {
            try {
                console.log('🤖 CrewAI 세션 초기화 중...');
                // 세션 ID 생성 (임시)
                this.crewAISessionId = 'session_' + Date.now();
                console.log('✅ CrewAI 세션 초기화 완료:', this.crewAISessionId);
            } catch (error) {
                console.error('❌ CrewAI 세션 초기화 실패:', error);
                // 실패 시 기존 방식으로 폴백
                this.useCrewAI = false;
                this.generator = new ConsultingGenerator(this, {
                    isStream: true,
                    preferredLanguage: "Korean"
                });
            }
        },

        getChatHistory() {
            // 현재 메시지들을 CrewAI 형식으로 변환
            return this.messages
                .filter(msg => msg.role !== 'system' && !msg.isLoading) // 시스템 메시지와 로딩 중인 메시지 제외
                .map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timeStamp || Date.now()
                }));
        },

        async sendMessageToCrewAI(newMessage) {
            try {
                console.log('🚀 CrewAI로 스트리밍 메시지 전송:', newMessage);
                
                // 메시지가 객체인 경우 텍스트만 추출
                let messageText = newMessage;
                if (typeof newMessage === 'object' && newMessage.text) {
                    messageText = newMessage.text;
                } else if (typeof newMessage === 'object' && newMessage.content) {
                    messageText = newMessage.content;
                }
                
                // 사용자 메시지를 채팅에 추가
                this.messages.push({
                    role: "user",
                    content: messageText,
                    timeStamp: Date.now()
                });

                // AI 응답을 위한 임시 메시지 추가
                const aiMessageIndex = this.messages.length;
                this.messages.push({
                    role: "assistant",
                    content: "생각하는 중...",
                    timeStamp: Date.now(),
                    isLoading: true,
                    isStreaming: true
                });

                // SSE를 사용한 스트리밍 호출
                await this.callCrewAIStreamingService(newMessage, aiMessageIndex);

            } catch (error) {
                console.error('❌ CrewAI 스트리밍 메시지 전송 실패:', error);
                
                // 에러 메시지 표시
                if (this.messages[this.messages.length - 1].isLoading) {
                    this.messages[this.messages.length - 1] = {
                        role: "assistant",
                        content: `오류가 발생했습니다: ${error.message}`,
                        timeStamp: Date.now(),
                        isLoading: false,
                        isError: true
                    };
                }
                this.chatRenderKey++;
            }
        },

        async callCrewAIStreamingService(message, aiMessageIndex) {
            return new Promise((resolve, reject) => {
                // 메시지 텍스트 추출
                let userMessage = message;
                if (typeof message === 'object' && message !== null) {
                    if (message.text) {
                        userMessage = message.text;
                    } else if (message.content) {
                        userMessage = message.content;
                    }
                }

                const requestData = {
                    user_message: userMessage,
                    chat_history: this.getChatHistory(),
                    organization_chart: this.organizationChart,
                    strategy_map: this.strategy,
                    process_definition_map: this.processDefinitionMap,
                    existing_process: this.processDefinition,
                    auto_generate: true
                };

                console.log('🔍 CrewAI 스트리밍 요청 데이터:', requestData);

                // Fetch API를 사용한 스트리밍 (EventSource는 POST를 지원하지 않으므로)
                fetch(`${this.crewAIBaseURL}/api/consulting/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/plain'
                    },
                    body: JSON.stringify(requestData)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let accumulatedResponse = '';
                    
                    const readStream = () => {
                        reader.read().then(({ done, value }) => {
                            if (done) {
                                console.log('✅ 스트리밍 완료');
                                this.chatRenderKey++;
                                resolve();
                                return;
                            }
                            
                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split('\n');
                            
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.slice(6));
                                        this.handleSSEEvent(data, aiMessageIndex, accumulatedResponse);
                                        
                                        if (data.type === 'response_chunk') {
                                            accumulatedResponse += data.content;
                                        }
                                        
                                    } catch (e) {
                                        console.warn('SSE 파싱 오류:', e, line);
                                    }
                                }
                            }
                            
                            readStream();
                        }).catch(error => {
                            console.error('스트림 읽기 오류:', error);
                            reject(error);
                        });
                    };
                    
                    readStream();
                })
                .catch(error => {
                    console.error('스트리밍 요청 오류:', error);
                    reject(error);
                });
            });
        },

        handleSSEEvent(data, aiMessageIndex, accumulatedResponse) {
            console.log('📡 SSE 이벤트:', data);
            
            switch (data.type) {
                case 'response_start':
                    // 응답 시작
                    this.messages[aiMessageIndex] = {
                        role: "assistant", 
                        content: "",
                        timeStamp: Date.now(),
                        isLoading: false,
                        isStreaming: true
                    };
                    this.chatRenderKey++;
                    break;
                    
                case 'loading_update':
                    // 로딩 상태 업데이트 (생각하는 중..., 프로세스 생성 중...)
                    this.messages[aiMessageIndex] = {
                        role: "assistant",
                        content: data.content,
                        timeStamp: Date.now(),
                        isLoading: true,
                        isStreaming: true
                    };
                    this.chatRenderKey++;
                    break;
                    
                case 'response_chunk':
                    // 일반 응답 텍스트 점진적 추가
                    this.messages[aiMessageIndex].content += data.content;
                    this.messages[aiMessageIndex].isLoading = false;
                    this.chatRenderKey++;
                    break;
                    
                case 'process_start':
                    // 🚀 프로세스 생성 시작 - 즉시 화면 전환!
                    this.messages[aiMessageIndex].content += data.content;
                    this.messages[aiMessageIndex].isLoading = false;
                    
                    // 즉시 컨설팅 모드에서 프로세스 생성 모드로 전환
                    console.log('🎯 프로세스 생성 모드로 즉시 전환');
                    this.isConsultingMode = false;
                    this.waitForCustomer = true;
                    this.$emit("openProcessPreview");
                    
                    // 누적 JSON 초기화
                    this.accumulatedJSON = '';
                    
                    this.chatRenderKey++;
                    break;
                    
                case 'json_start':
                    // JSON 스트리밍 시작
                    this.messages[aiMessageIndex].content += data.content;
                    this.accumulatedJSON = ''; // JSON 누적 시작
                    this.chatRenderKey++;
                    break;
                    
                case 'json_chunk':
                    // 🔥 실시간 JSON 파싱 및 점진적 BPMN 그리기
                    this.messages[aiMessageIndex].content += data.content;
                    this.accumulatedJSON += data.content;
                    
                    // 실시간 JSON 파싱 시도
                    this.tryParseAndUpdateBPMN(this.accumulatedJSON);
                    
                    this.chatRenderKey++;
                    break;
                    
                case 'json_end':
                    // JSON 스트리밍 끝
                    this.messages[aiMessageIndex].content += data.content;
                    
                    // 최종 JSON 파싱 시도
                    this.tryParseAndUpdateBPMN(this.accumulatedJSON, true);
                    
                    this.chatRenderKey++;
                    break;
                    
                case 'process_generated':
                    // 프로세스 정의 생성 완료 - 최종 BPMN 생성
                    console.log('✅ 최종 프로세스 정의 수신');
                    this.messages[aiMessageIndex].isStreaming = false;
                    
                    // 최종 프로세스 정의로 BPMN 완성
                    if (data.process_definition) {
                        this.handleCrewAIProcessDefinition(data.process_definition);
                    }
                    break;
                    
                case 'consulting_response':
                    // 컨설팅 응답만 있는 경우
                    this.messages[aiMessageIndex] = {
                        role: "assistant",
                        content: data.response.content,
                        timeStamp: Date.now(),
                        isLoading: false,
                        isStreaming: false
                    };
                    this.chatRenderKey++;
                    break;
                    
                case 'complete':
                    // 완료
                    this.messages[aiMessageIndex].isStreaming = false;
                    console.log('✅ 컨설팅 완료:', data.message);
                    break;
                    
                case 'error':
                    // 오류 처리
                    this.messages[aiMessageIndex] = {
                        role: "assistant",
                        content: data.message,
                        timeStamp: Date.now(),
                        isLoading: false,
                        isStreaming: false,
                        isError: true
                    };
                    this.chatRenderKey++;
                    break;
            }
        },

        async callCrewAIFullService(message) {
            console.log('🚀 원본 메시지:', message, typeof message);
            
            // 메시지가 객체인 경우 텍스트만 추출
            let userMessage = message;
            if (typeof message === 'object' && message !== null) {
                if (message.text) {
                    userMessage = message.text;
                } else if (message.content) {
                    userMessage = message.content;
                } else {
                    userMessage = JSON.stringify(message); // 최후의 방법
                }
            }
            
            console.log('📝 추출된 텍스트:', userMessage, typeof userMessage);

            const requestData = {
                user_message: userMessage,
                chat_history: this.getChatHistory(),
                organization_chart: this.organizationChart,
                strategy_map: this.strategy,
                process_definition_map: this.processDefinitionMap,
                existing_process: this.processDefinition,
                auto_generate: true
            };

            console.log('🔍 CrewAI 요청 데이터:', requestData);

            const response = await fetch(`${this.crewAIBaseURL}/api/consulting/full-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ CrewAI API 오류:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
            }

            return await response.json();
        },

        async handleCrewAIProcessDefinition(processDefinition) {
            try {
                console.log('🎯 프로세스 정의 처리:', processDefinition);
                
                // 기존 컨설팅 로직과 동일하게 처리
                if (processDefinition.processDefinitionId) {
                    // 프로세스 정의를 현재 컴포넌트에 설정
                    this.processDefinition = processDefinition;
                    if (!this.processDefinition) this.processDefinition = {};
                    
                    // BPMN XML 생성
                    this.bpmn = this.createBpmnXml(processDefinition, true); // 항상 가로형으로 생성
                    
                    // 프로젝트 정보 설정 - 트리에서 생성한 프로세스인 경우 트리에서 정한 ID 사용
                    if (this.treeProcessLocation && this.treeProcessLocation.processDefinitionId) {
                        this.processDefinition['processDefinitionId'] = this.treeProcessLocation.processDefinitionId;
                        this.processDefinition['processDefinitionName'] = this.treeProcessLocation.processDefinitionName || processDefinition.processDefinitionName;
                        this.projectName = this.treeProcessLocation.processDefinitionName || processDefinition.processDefinitionName;
                        this.oldProcDefId = this.treeProcessLocation.processDefinitionId;
                    } else {
                        this.processDefinition['processDefinitionId'] = processDefinition.processDefinitionId;
                        this.processDefinition['processDefinitionName'] = processDefinition.processDefinitionName;
                        this.projectName = processDefinition.processDefinitionName;
                        this.oldProcDefId = processDefinition.processDefinitionId;
                    }
                    
                    // 정의 변경 카운트 증가 (UI 업데이트 트리거)
                    this.definitionChangeCount++;
                    this.isAIGenerated = true;
                    this.isChanged = true;

                    // 컨설팅 모드에서 프로세스 생성 모드로 전환 (기존 로직과 동일)
                    this.isConsultingMode = false;
                    this.waitForCustomer = true;
                    
                    // 프로세스 정의 체계도 업데이트 (기존 로직과 동일)
                    await this.updateProcessDefinitionMap(processDefinition);
                    
                    // 프로세스 미리보기 열기
                    this.$emit("openProcessPreview");
                    
                    // 🔥 CrewAI 프로세스 생성 완료 후 Flow 업데이트를 위한 이벤트 emit
                    console.log('🎉 CrewAI 프로세스 생성 완료 - Flow 업데이트 이벤트 emit', this.processDefinition);
                    this.$emit('process-definition-updated', this.processDefinition);

                    // 성공 메시지들 추가 (기존 로직과 동일)
                    this.messages.push({
                        role: "system",
                        content: "🎉 프로세스 정의 생성이 완료되었습니다!",
                        timeStamp: Date.now()
                    });

                    this.messages.push({
                        role: "system",
                        content: "생성된 프로세스의 실제 실행화면을 시뮬레이션 기능을 통해 확인 및 수정이 가능합니다.",
                        timeStamp: Date.now()
                    });

                    if (this.chatMode == 'consulting') {
                        this.messages.push({
                            role: "system",
                            content: "생성된 프로세스 정의에 대하여 추가적인 요청사항이 있으시다면 말씀해주세요.",
                            timeStamp: Date.now()
                        });
                    }

                    // 새로운 팀 추가 메시지 처리 (기존 로직과 동일)
                    if (processDefinition.roles) {
                        processDefinition.roles.forEach(role => {
                            if (role.origin == 'created') {
                                this.addTeamMessage(role);
                            }
                        });
                    }

                    console.log('✅ 프로세스 정의 처리 완료 - 컨설팅 모드에서 프로세스 모드로 전환');
                }

            } catch (error) {
                console.error('❌ 프로세스 정의 처리 실패:', error);
                
                this.messages.push({
                    role: "system",
                    content: "프로세스 정의 생성 중 오류가 발생했습니다.",
                    timeStamp: Date.now(),
                    isError: true
                });
            }
        },

        // CrewAI 서비스 상태 확인
        async checkCrewAIHealth() {
            try {
                const response = await fetch(`${this.crewAIBaseURL}/health`);
                return response.ok;
            } catch (error) {
                console.error('CrewAI 서비스 연결 실패:', error);
                return false;
            }
        },

        // CrewAI 사용 토글 (테스트용)
        toggleCrewAI() {
            this.useCrewAI = !this.useCrewAI;
            console.log('CrewAI 사용 여부:', this.useCrewAI ? '활성화' : '비활성화');
        },

        // 프로세스 정의 체계도 업데이트 (기존 로직에서 추출)
        async updateProcessDefinitionMap(processDefinition) {
            try {
                // 트리에서 생성한 프로세스인 경우 트리에서 정한 ID를 사용
                let megaProcessId = processDefinition.megaProcessId;
                let majorProcessId = processDefinition.majorProcessId;
                let processDefId = processDefinition.processDefinitionId;
                let processDefName = processDefinition.processDefinitionName;
                
                if (this.treeProcessLocation) {
                    megaProcessId = this.treeProcessLocation.megaProcessId || megaProcessId;
                    majorProcessId = this.treeProcessLocation.majorProcessId || majorProcessId;
                    processDefId = this.treeProcessLocation.processDefinitionId || processDefId;
                    processDefName = this.treeProcessLocation.processDefinitionName || processDefName;
                }
                
                if (megaProcessId && this.processDefinitionMap && this.processDefinitionMap.mega_proc_list) {
                    if (!this.processDefinitionMap.mega_proc_list.some((megaProcess) => megaProcess.id == megaProcessId)) {
                        this.processDefinitionMap.mega_proc_list.push({
                            name: this.treeProcessLocation?.megaProcessName || megaProcessId,
                            id: megaProcessId,
                            major_proc_list: [
                                {
                                    name: this.treeProcessLocation?.majorProcessName || majorProcessId,
                                    id: majorProcessId,
                                    sub_proc_list: [
                                        {
                                            id: processDefId,
                                            name: processDefName
                                        }
                                    ]
                                }
                            ]
                        });
                    }
                    if (majorProcessId) {
                        this.processDefinitionMap.mega_proc_list.forEach((megaProcess) => {
                            if (megaProcess.id == megaProcessId) {
                                if (megaProcess.major_proc_list.some((majorProcess) => majorProcess.id == majorProcessId)) {
                                    const idx = megaProcess.major_proc_list.findIndex(
                                        (majorProcess) => majorProcess.id == majorProcessId
                                    );
                                    if (
                                        !megaProcess.major_proc_list[idx].sub_proc_list.some(
                                            (subProcess) => subProcess.id == processDefId
                                        )
                                    ) {
                                        megaProcess.major_proc_list[idx].sub_proc_list.push({
                                            id: processDefId,
                                            name: processDefName
                                        });
                                    }
                                } else {
                                    megaProcess.major_proc_list.push({
                                        name: this.treeProcessLocation?.majorProcessName || majorProcessId,
                                        id: majorProcessId,
                                        sub_proc_list: [
                                            {
                                                id: processDefId,
                                                name: processDefName
                                            }
                                        ]
                                    });
                                }
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('프로세스 정의 체계도 업데이트 실패:', error);
            }
        },

        // 팀 추가 메시지 생성 (기존 로직에서 추출)
        addTeamMessage(team) {
            this.messages.push({
                "role": "system",
                "content": `${team.name} 팀이 새로 추가되었습니다. 해당 팀을 조직도에 추가하시겠습니까?`,
                "timeStamp": Date.now(),
                "type": "add_team",
                "newTeamInfo": team
            });
        },

        // 🔥 실시간 JSON 파싱 및 점진적 BPMN 그리기
        tryParseAndUpdateBPMN(jsonString, isFinal = false) {
            try {
                console.log('🧪 JSON 파싱 시도:', jsonString.substring(0, 100) + '...');
                
                let processDefinition;
                
                // **기존 로직과 동일한 파싱 순서**
                jsonString = this.extractJSON(jsonString);
                try {
                    processDefinition = JSON.parse(jsonString);
                } catch (e) {
                    processDefinition = partialParse(jsonString + '"');
                }
                
                // 파싱된 JSON이 이전과 동일하면 스킵
                if (JSON.stringify(processDefinition) === JSON.stringify(this.lastParsedJSON)) {
                    return;
                }

                
                this.bpmn = this.createBpmnXml(processDefinition, true); // 항상 가로형으로 생성
                
                this.lastParsedJSON = processDefinition;
                
                // 유효한 프로세스 정의인지 확인
                if (processDefinition && (processDefinition.processDefinitionName || processDefinition.elements)) {
                    console.log('🎯 점진적 BPMN 업데이트:', processDefinition.processDefinitionName);
                    
                    // 시퀀스 정보를 활용하여 activities 순서 재정렬
                    const reorderedProcess = this.reorderActivitiesBySequence(processDefinition);
                    
                    // 프로세스 정의 설정
                    this.processDefinition = reorderedProcess;
                    
                    // BPMN XML 생성
                    if (reorderedProcess.elements && reorderedProcess.elements.length > 0) {
                        this.bpmn = this.createBpmnXml(reorderedProcess, true); // 항상 가로형으로 생성
                        
                        // 프로젝트 정보 설정
                        if (reorderedProcess.processDefinitionName) {
                            this.projectName = reorderedProcess.processDefinitionName;
                        }
                        if (reorderedProcess.processDefinitionId) {
                            this.oldProcDefId = reorderedProcess.processDefinitionId;
                        }
                        
                        // UI 업데이트 트리거
                        this.definitionChangeCount++;
                        this.isAIGenerated = true;
                        this.isChanged = true;
                        
                        // 🔥 실시간 BPMN 업데이트 후 Flow 업데이트를 위한 이벤트 emit
                        console.log('🔄 점진적 BPMN 업데이트 완료 - Flow 업데이트 이벤트 emit');
                        this.$emit('process-definition-updated', this.processDefinition);
                    }
                }
                
            } catch (error) {
                console.warn('⚠️ 실시간 JSON 파싱 오류:', error);
            }
        },

        /**
         * 액티비티 이름으로 검색하고 포커싱
         * @param {String} activityName - 검색할 액티비티 이름
         */
        searchAndFocusActivity(activityName) {
            if (!activityName || activityName.trim() === '') {
                console.log('검색어가 비어있습니다.');
                return;
            }

            try {
                const store = useBpmnStore();
                let modeler = store.getModeler;
                
                if (!modeler) {
                    console.error('Modeler를 찾을 수 없습니다.');
                    return;
                }

                const elementRegistry = modeler.get('elementRegistry');
                const canvas = modeler.get('canvas');
                const selection = modeler.get('selection');

                // 모든 엘리먼트 검색
                const allElements = elementRegistry.getAll();
                
                // 액티비티 이름과 일치하는 엘리먼트 찾기
                const matchedElement = allElements.find(element => {
                    return element.businessObject && 
                           element.businessObject.name && 
                           element.businessObject.name.toLowerCase().includes(activityName.toLowerCase());
                });

                if (matchedElement) {
                    console.log('✅ 액티비티를 찾았습니다:', matchedElement.businessObject.name);
                    
                    // 엘리먼트 선택
                    selection.select(matchedElement);
                    
                    // 화면 정중앙에 액티비티 배치
                    const viewbox = canvas.viewbox();
                    const elementMid = {
                        x: matchedElement.x + matchedElement.width / 2,
                        y: matchedElement.y + matchedElement.height / 2
                    };

                    // 적절한 줌 레벨 설정 (1.0 = 100%)
                    const zoom = 1.0;
                    
                    // viewbox를 element 중심으로 이동
                    canvas.viewbox({
                        x: elementMid.x - (viewbox.outer.width / zoom / 2),
                        y: elementMid.y - (viewbox.outer.height / zoom / 2),
                        width: viewbox.outer.width / zoom,
                        height: viewbox.outer.height / zoom
                    });

                    return true;
                } else {
                    console.log('❌ 일치하는 액티비티를 찾을 수 없습니다.');
                    return false;
                }
            } catch (error) {
                console.error('❌ 액티비티 검색 중 오류:', error);
                return false;
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
}

.chat-collapsed :deep(.left-part) {
    width: 98.5%;
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

/* Flow 오버레이 스타일 (leftpart 전용) */
.flow-overlay-leftpart {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    z-index: 100;
    display: flex;
    flex-direction: column;
}

.flow-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
}

/* 액티비티 속성 패널 스타일 */
.activity-panel {
    background-color: #fafafa;
    width: 30%; 
    border-left: 1px solid #e0e0e0; 
    overflow-y: auto;
}

.activity-panel::-webkit-scrollbar {
    width: 6px;
}

.activity-panel::-webkit-scrollbar-track {
    background: transparent;
}

.activity-panel::-webkit-scrollbar-thumb {
    background: #c0c0c0;
    border-radius: 3px;
}

.activity-panel::-webkit-scrollbar-thumb:hover {
    background: #a0a0a0;
}

/* 채팅창 접기/펴기 탭 버튼 (leftpart 오른쪽 끝에 위치) */
.chat-collapse-tab {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 50px;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-right: none;
    border-radius: 4px 0 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 100;
}

.chat-collapse-tab:hover {
    background: #eeeeee;
}

.chat-collapse-tab:active {
    background: #e0e0e0;
}

/* 채팅 콘텐츠 영역 */
.chat-content {
    flex: 1;
    overflow: auto;
}

/* 클릭 가능한 필드 스타일 */
.clickable-field {
    cursor: pointer;
}

.clickable-field :deep(.v-field) {
    cursor: pointer;
}

.clickable-field:hover :deep(.v-field) {
    background-color: rgba(0, 0, 0, 0.04);
}

/* Fade 트랜지션 */
.fade-enter-active, .fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
    opacity: 0;
}
</style>
