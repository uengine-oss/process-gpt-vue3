<template>
    <div v-if="!definitionMapOnlyInput" class="chat-info-view-wrapper" style="background-color: rgba(255, 255, 255, 1)">
        <div class="chat-info-view-wrapper">
            <div class="chat-info-view-area">
                <div class="chat-info-view-area" style="position: relative">
                    <slot name="custom-chat-top" />

                    <!-- 타이틀 영역 -->
                    <slot name="custom-title" v-if="!definitionMapOnlyInput">
                        <div v-if="(name && name !== '') || chatInfo">
                            <div v-if="name && name !== ''" class="d-flex gap-2 align-center">
                                <div>
                                    <h5 class="text-h5 mb-n1">{{ name }}</h5>
                                </div>
                            </div>
                            <div v-else-if="chatInfo" class="d-flex gap-2 align-center">
                                <v-avatar v-if="chatInfo.img">
                                    <img :src="chatInfo.img" width="50" />
                                </v-avatar>
                                <div>
                                    <h5 class="text-h5 mb-n1">{{ $t(chatInfo.title) }}</h5>
                                    <small class="textPrimary">{{ chatInfo.subtitle }}</small>
                                </div>
                            </div>
                            <slot name="custom-tools" />
                        </div>
                        <v-divider v-if="(name && name !== '') || chatInfo || type === 'form'" style="margin: 0px" />
                    </slot>

                    <!-- 메시지 영역 -->
                    <ChatMessages
                        ref="chatMessagesRef"
                        :messages="filteredMessages"
                        :originalMessages="messages"
                        :userInfo="userInfo"
                        :userList="userList"
                        :participantUsers="participantUsers"
                        :type="type"
                        :agentInfo="agentInfo"
                        :isLoading="isLoading"
                        :disableChat="disableChat"
                        :isSystemChat="isSystemChat"
                        :processGPTActive="ProcessGPTActive"
                        :generatedWorkList="generatedWorkList"
                        :isAnalyzingChat="isAnalyzingChat"
                        :showScrollButtons="showScrollTopButton"
                        :isMobile="isMobile"
                        :isRightZoomed="$globalState.state.isRightZoomed"
                        :agentMessage="agentMessage"
                        :allUserList="allUserList"
                        @scroll="handleScroll"
                        @scrollToTop="scrollToTop"
                        @scrollToBottom="scrollToBottom"
                        @checkProcessFromChat="checkProcessFromChat"
                        @editMessage="editMessage"
                        @send="send"
                        @cancelEdit="cancelEdit"
                        @beforeReply="beforeReply"
                        @viewJSON="viewJSON"
                        @startProcess="startProcess"
                        @deleteWorkList="deleteWorkList"
                        @deleteAllWorkList="deleteAllWorkList"
                        @addTeam="addTeam"
                        @addTeamMembers="addTeamMembers"
                        @executeProcess="executeProcess"
                        @navigateToCompanyQuery="navigateToCompanyQuery"
                    >
                        <template #custom-content>
                            <slot name="custom-content" />
                            <InfoAlert :howToUseInfo="howToUseInfo" :chatInfo="chatInfo" />
                        </template>
                        <template #custom-chat>
                            <slot name="custom-chat" />
                        </template>
                    </ChatMessages>

                    <!-- 메시지 미리보기 / 답장 정보 -->
                    <div
                        v-if="!hideInput && !definitionMapOnlyInput"
                        style="position: absolute; bottom: 15.1%; left: 24.3%; right: 0px; width: 75%"
                    >
                        <div v-if="isReply || (!isAtBottom && previewMessage)" class="message-info-box">
                            <div class="message-info-content">
                                <template v-if="isReply">
                                    <div class="message-info-header">
                                        <div>
                                            {{
                                                replyUser.role === 'system'
                                                    ? $t('chat.systemReply')
                                                    : $t('chat.userReply', { name: replyUser.name })
                                            }}
                                        </div>
                                        <v-icon @click="cancelReply" size="small">mdi-close</v-icon>
                                    </div>
                                    <div class="message-info-text">{{ replyUser.content }}</div>
                                </template>
                                <template v-else>
                                    <div class="message-info-header">
                                        <div>{{ previewMessage.name }}</div>
                                        <v-icon @click="scrollToBottom" color="primary" size="small">mdi-arrow-down-circle</v-icon>
                                    </div>
                                    <div class="message-info-text">{{ previewMessage.content }}</div>
                                </template>
                            </div>
                        </div>
                    </div>

                    <v-divider v-if="!hideInput && !definitionMapOnlyInput" />
                </div>

                <!-- 입력 영역 -->
                <div v-if="!hideInput" class="chat-info-message-input-box">
                    <ChatInput
                        ref="chatInputRef"
                        v-model:newMessage="newMessage"
                        v-model:selectedUserIndex="selectedUserIndex"
                        v-model:file="file"
                        :mentionedUsers="mentionedUsers"
                        :attachedImages="attachedImages"
                        :showUserList="showUserList"
                        :filteredUserList="computedFilteredUserList"
                        :isOpenedChatMenu="isOpenedChatMenu"
                        :isLoading="isLoading"
                        :isMicRecording="isMicRecording"
                        :isMicRecorderLoading="isMicRecorderLoading"
                        :disabled="disableChat"
                        :placeholder="$t('chat.inputMessage')"
                        :showDraftAgent="showDraftAgent"
                        :agentRunning="agentInfo?.isRunning"
                        :canDraftAgent="!!(newMessage || agentInfo?.draftPrompt)"
                        :showFileUpload="showFileUpload"
                        :showProcessGPTToggle="type === 'chats' && !isSystemChat"
                        :processGPTActive="ProcessGPTActive"
                        @send="beforeSend"
                        @stopLoading="stopLoading"
                        @toggleMenu="toggleChatMenu"
                        @textareaInput="handleTextareaInput"
                        @paste="handlePaste"
                        @keydown="handleKeydown"
                        @selectUser="selectUser"
                        @removeMention="removeMention"
                        @deleteImage="deleteImage"
                        @changeImage="changeImage"
                        @startVoiceRecording="startVoiceRecording"
                        @stopVoiceRecording="stopVoiceRecording"
                        @recordingModeChange="recordingModeChange"
                        @requestDraftAgent="requestDraftAgent"
                        @submitFile="submitFile"
                        @toggleProcessGPT="toggleProcessGPTActive"
                    >
                        <template #custom-input-tools>
                            <slot name="custom-input-tools" />
                        </template>
                    </ChatInput>
                </div>
            </div>
        </div>
    </div>

    <!-- 정의맵 전용 입력 UI -->
    <div v-else>
        <v-card elevation="10" class="pa-4">
            <ChatInput
                ref="chatInputRef"
                v-model:newMessage="newMessage"
                v-model:selectedUserIndex="selectedUserIndex"
                v-model:file="file"
                :mentionedUsers="mentionedUsers"
                :attachedImages="attachedImages"
                :showUserList="showUserList"
                :filteredUserList="computedFilteredUserList"
                :isOpenedChatMenu="false"
                :isLoading="isLoading"
                :isMicRecording="isMicRecording"
                :isMicRecorderLoading="isMicRecorderLoading"
                :disabled="disableChat || isGenerationFinished"
                :placeholder="$t('chat.definitionMapInputMessage')"
                :showDraftAgent="showDraftAgent"
                :agentRunning="agentInfo?.isRunning"
                :canDraftAgent="!!(newMessage || agentInfo?.draftPrompt)"
                :showFileUpload="showFileUpload"
                :showProcessGPTToggle="false"
                :processGPTActive="ProcessGPTActive"
                @send="beforeSend"
                @stopLoading="stopLoading"
                @textareaInput="handleTextareaInput"
                @paste="handlePaste"
                @keydown="handleKeydown"
                @selectUser="selectUser"
                @removeMention="removeMention"
                @deleteImage="deleteImage"
                @changeImage="changeImage"
                @startVoiceRecording="startVoiceRecording"
                @stopVoiceRecording="stopVoiceRecording"
                @recordingModeChange="recordingModeChange"
                @requestDraftAgent="requestDraftAgent"
                @submitFile="submitFile"
            />
        </v-card>
    </div>

    <!-- 다이얼로그들 -->
    <ChatDialogs
        :recordingMode="recordingMode"
        :audioResponse="newMessage"
        :chatRoomId="chatRoomId"
        v-model:processCreationDialog="processCreationDialog"
        :isAnalyzingChat="isAnalyzingChat"
        :isCreatingProcess="isCreatingProcess"
        :processAnalysisResult="processAnalysisResult"
        @recordingModeChange="recordingModeChange"
        @startRecording="startRecording"
        @stopRecording="stopRecording"
        @createProcess="createProcessFromChat"
    />
</template>
  
  <script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import partialParse from 'partial-json-parser';

// 컴포넌트
import ChatMessages from '@/components/groupchat/ChatMessages.vue';
import ChatInput from '@/components/groupchat/ChatInput.vue';
import ChatDialogs from '@/components/groupchat/ChatDialogs.vue';
import InfoAlert from '@/components/ui/InfoAlert.vue';

// Composables
import { useMessages } from '@/components/groupchat/composables/useMessages';
import { useMention } from '@/components/groupchat/composables/useMention';
import { useMediaUpload } from '@/components/groupchat/composables/useMediaUpload';
import { useScroll } from '@/components/groupchat/composables/useScroll';

// 유틸리티
import { useDefaultSetting } from '@/stores/defaultSetting';
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinitionGenerator from '@/components/ai/ProcessDefinitionGenerator.js';
import BPMNXmlGeneratorMixin from '@/components/BPMNXmlGenerator.vue';

const backend = BackendFactory.createBackend();
const instance = getCurrentInstance();
const $t = (key, params) => instance?.proxy?.$t(key, params) || key;
const router = useRouter();

// Props
const props = defineProps({
    prompt: String,
    name: String,
    messages: Array,
    userInfo: Object,
    chatInfo: Object,
    disableChat: Boolean,
    isChanged: Boolean,
    type: String,
    agentInfo: Object,
    userList: Array,
    currentChatRoom: Object,
    lock: Boolean,
    generatedWorkList: Array,
    ProcessGPTActive: Boolean,
    isSystemChat: Boolean,
    isAgentMode: Boolean,
    chatRoomId: String,
    isMobile: Boolean,
    newMessageInfo: Object,
    hideInput: {
        type: Boolean,
        default: false
    },
    definitionMapOnlyInput: {
        type: Boolean,
        default: false
    },
    allUserList: {
        type: Array,
        default: () => []
    },
    participantUsers: {
        type: Array,
        default: () => []
    },
    howToUseInfo: {
        type: Object,
        default: null
    },
    showScrollTopButton: {
        type: Boolean,
        default: false
    },
    agentMessage: {
        type: Boolean,
        default: false
    },
    showDetailInfo: {
        type: Boolean,
        default: false
    }
});

// Emits
const emit = defineEmits([
    'stopMessage',
    'clickedWorkOrder',
    'startWorkOrder',
    'toggleProcessGPTActive',
    'openVerMangerDialog',
    'requestDraftAgent',
    'viewProcess',
    'startProcess',
    'deleteWorkList',
    'cancelProcess',
    'deleteAllWorkList',
    'getMoreChat',
    'beforeReply',
    'sendEditedMessage',
    'sendMessage',
    'addTeam',
    'addTeamMembers',
    'requestFile',
    'executeProcess'
]);

// Refs
const chatMessagesRef = ref(null);
const chatInputRef = ref(null);

// 로컬 상태
const isOpenedChatMenu = ref(false);
const recordingMode = ref(false);
const isReply = ref(false);
const replyUser = ref(null);
const editIndex = ref(-1);
const editText = ref(null);
const isViewJSON = ref([]);
const showGeneratedWorkList = ref(false);
const isSending = ref(false);
const isGenerationFinished = ref(false);

// 프로세스 생성 관련
const processCreationDialog = ref(false);
const isAnalyzingChat = ref(false);
const isCreatingProcess = ref(false);
const processAnalysisResult = ref(null);

// Composables 초기화
const messagesRef = computed(() => props.messages);
const userInfoRef = computed(() => props.userInfo);
const userListRef = computed(() => props.userList);
const currentChatRoomRef = computed(() => props.currentChatRoom);
const participantUsersRef = computed(() => props.participantUsers);

const { filteredMessages, myMessages } = useMessages(messagesRef, userInfoRef);

const {
    newMessage,
    mentionedUsers,
    showUserList,
    mentionStartIndex,
    selectedUserIndex,
    filteredUserList,
    isSystemMentioned,
    mentionedAgent,
    handleTextareaInput,
    selectUser,
    removeMention,
    handleKeydown,
    getMessageWithMentions,
    resetMention
} = useMention(userListRef, currentChatRoomRef, participantUsersRef);

const {
    attachedImages,
    file,
    isMicRecording,
    isMicRecorderLoading,
    changeImage,
    handlePaste,
    deleteImage,
    clearImages,
    startVoiceRecording,
    stopVoiceRecording,
    startRecording,
    stopRecording,
    submitFile: uploadFile
} = useMediaUpload();

const { scrollContainer, isAtBottom, previewMessage, handleScroll, scrollToTop, scrollToBottom, updateScroll } = useScroll();

// Computed
const isLoading = computed(() => {
    if (!props.messages || props.messages.length === 0) return false;
    return props.messages.some((item) => item.isLoading);
});

const computedFilteredUserList = computed(() => filteredUserList.value);

const showDraftAgent = computed(() => {
    return (props.type === 'instances' || props.type === 'chats') && props.agentInfo;
});

const showFileUpload = computed(() => {
    return (
        (props.type === 'instances' || props.type === 'chats' || props.type === 'consulting') &&
        props.agentInfo &&
        !props.agentInfo.isRunning
    );
});

// Watchers
watch(
    () => props.prompt,
    (newVal, oldVal) => {
        if (newVal !== oldVal) {
            newMessage.value = newVal;
            beforeSend();
        }
    }
);

watch(
    () => props.newMessageInfo,
    (newVal) => {
        if (newVal && !isAtBottom.value) {
            previewMessage.value = newVal;
        }
    }
);

watch(isAtBottom, (newVal) => {
    if (newVal) {
        previewMessage.value = null;
    }
});

watch(
    () => props.messages?.length,
    () => {
        syncScrollContainer();
    }
);

// Lifecycle
onMounted(() => {
    document.addEventListener('click', handleRequestFileClick);
    nextTick(() => {
        syncScrollContainer();
        scrollToBottom();
    });
});

onBeforeUnmount(() => {
    document.removeEventListener('click', handleRequestFileClick);
});

// Methods
function handleRequestFileClick(event) {
    if (event.target.matches('.request-file-link')) {
        event.preventDefault();
        emit('requestFile', event.target.getAttribute('data-filename'));
    }
}

function toggleChatMenu() {
    isOpenedChatMenu.value = !isOpenedChatMenu.value;
}

function syncScrollContainer() {
    const cm = chatMessagesRef.value;
    if (cm && cm.scrollContainer) {
        // PerfectScrollbar ref는 내부에 다시 DOM을 가진 ref를 포함할 수 있어 한 번 풀어준다.
        scrollContainer.value = cm.scrollContainer.value || cm.scrollContainer;
    }
}

function recordingModeChange() {
    recordingMode.value = !recordingMode.value;
}

function toggleProcessGPTActive() {
    emit('toggleProcessGPTActive');
}

function beforeReply(message) {
    emit('beforeReply', message);
    isReply.value = true;
    replyUser.value = message;
}

function cancelReply() {
    isReply.value = false;
    replyUser.value = null;
    emit('beforeReply', false);
}

function editMessage(index) {
    editIndex.value = index;
    editText.value = props.messages[index].content;
}

function cancelEdit() {
    if (editIndex.value >= 0) {
        props.messages[editIndex.value].content = editText.value;
    }
    editIndex.value = -1;
}

function viewJSON(index) {
    if (!isViewJSON.value.includes(index)) {
        isViewJSON.value.push(index);
    } else {
        isViewJSON.value = isViewJSON.value.filter((idx) => idx !== index);
    }
}

function stopLoading() {
    emit('stopMessage');
}

function requestDraftAgent() {
    const agent = mentionedAgent.value;
    if (agent) {
        const cleanMessage = newMessage.value.replace(/@[^\s@]+\s*/g, '').trim();
        emit('requestDraftAgent', cleanMessage || newMessage.value, agent);
    } else {
        emit('requestDraftAgent', newMessage.value);
    }
}

function beforeSend(event) {
    if (isSending.value) return;

    if (event?.type === 'keypress') {
        if (event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
    }

    const agent = mentionedAgent.value;

    if (agent) {
        isSending.value = true;
        const messageText = getMessageWithMentions();
        const cleanMessage = newMessage.value.replace(/@[^\s@]+\s*/g, '').trim();

        if (messageText.length > 0 || attachedImages.value.length > 0) {
            emit('sendMessage', {
                images: attachedImages.value,
                text: messageText,
                mentionedUsers: mentionedUsers.value
            });
            clearImages();
        }

        emit('requestDraftAgent', cleanMessage || newMessage.value, agent);

        setTimeout(() => {
            resetMention();
            isSending.value = false;
        }, 100);
        return;
    }

    if (props.isAgentMode) {
        isSending.value = true;
        requestDraftAgent();
        setTimeout(() => {
            newMessage.value = '';
            isSending.value = false;
        }, 100);
        return;
    }

    if (isLoading.value) {
        emit('stopMessage');
        return;
    }

    const copyMsg = newMessage.value.replace(/(?:\r\n|\r|\n)/g, '');
    if (copyMsg.length > 0 || attachedImages.value.length > 0) {
        isSending.value = true;
        send();
    }
}

function send() {
    if (editIndex.value >= 0) {
        emit('sendEditedMessage', editIndex.value + 1);
        editIndex.value = -1;
    } else {
        const messageText = getMessageWithMentions();

        emit('sendMessage', {
            images: attachedImages.value,
            text: messageText,
            mentionedUsers: mentionedUsers.value
        });
    }

    if (isReply.value) {
        isReply.value = false;
    }

    clearImages();
    isAtBottom.value = true;

    setTimeout(() => {
        if (!props.definitionMapOnlyInput) {
            resetMention();
        }
        isSending.value = false;
    }, 100);
}

function startProcess(data) {
    emit('startProcess', data.work);
    if (props.ProcessGPTActive) {
        emit('deleteWorkList', data.index);
    }
}

function deleteWorkList(index) {
    emit('deleteWorkList', index);
}

function deleteAllWorkList() {
    emit('deleteAllWorkList');
}

function addTeam(data) {
    emit('addTeam', {
        teamInfo: data.message.newTeamInfo,
        index: data.index
    });
}

function addTeamMembers(data) {
    emit('addTeamMembers', data);
}

function executeProcess(data) {
    emit('executeProcess', data);
}

function navigateToCompanyQuery(url) {
    if (url) {
        router.push(url);
    }
}

async function submitFile() {
    if (!file.value) return;
    await uploadFile(props.chatRoomId, props.userInfo.name);
}

// 프로세스 생성 관련
async function checkProcessFromChat() {
    if (!props.chatRoomId) {
        alert('채팅방 ID가 없습니다.');
        return;
    }

    processCreationDialog.value = true;
    isAnalyzingChat.value = true;
    processAnalysisResult.value = null;

    try {
        const response = await axios.post('/langchain-chat/process/analyze', {
            chat_room_id: props.chatRoomId
        });
        processAnalysisResult.value = response.data;
    } catch (error) {
        console.error('채팅 분석 실패:', error);
        processAnalysisResult.value = {
            can_create_process: false,
            reason: `분석 중 오류가 발생했습니다: ${error.response?.data?.detail || error.message}`
        };
    } finally {
        isAnalyzingChat.value = false;
    }
}

async function createProcessFromChat() {
    if (!processAnalysisResult.value?.can_create_process) return;

    isCreatingProcess.value = true;

    try {
        const historyResponse = await axios.post('/langchain-chat/process/chat-history', {
            chat_room_id: props.chatRoomId
        });

        const chatHistory = historyResponse.data.raw_history || [];

        // ProcessDefinitionGenerator 사용
        const generator = new ProcessDefinitionGenerator(this, {
            isStream: false,
            preferredLanguage: 'Korean'
        });

        if (chatHistory.length > 0) {
            chatHistory.forEach((msg) => {
                if (msg.role && msg.content) {
                    generator.previousMessages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            });
        }

        const processCreationPrompt = `아래 대화 내용을 바탕으로 프로세스 정의를 생성해주세요.
  
  프로세스 이름: ${processAnalysisResult.value.suggested_process_name || '새 프로세스'}
  프로세스 설명: ${processAnalysisResult.value.suggested_process_description || ''}
  
  위 대화 내용을 분석하여 프로세스 정의 JSON을 생성해주세요.`;

        generator.previousMessages.push({
            role: 'user',
            content: processCreationPrompt
        });

        generator.newMessage = '';

        const response = await new Promise((resolve, reject) => {
            generator.client.onGenerationFinished = (model) => {
                resolve(generator.modelJson || model);
            };
            generator.client.onError = reject;
            generator.generate();
        });

        const jsonProcess = parseProcessResponse(response);

        if (!jsonProcess?.processDefinitionId) {
            throw new Error('유효한 프로세스 정의를 생성하지 못했습니다.');
        }

        // BPMN XML 생성 (믹스인 사용)
        const bpmnXml = BPMNXmlGeneratorMixin.methods.createBpmnXml(jsonProcess, true);

        const saveResponse = await axios.post('/langchain-chat/process/save', {
            process_definition: jsonProcess,
            bpmn_xml: bpmnXml
        });

        if (saveResponse.data.success) {
            alert('프로세스가 성공적으로 생성되었습니다!');
            processCreationDialog.value = false;
            processAnalysisResult.value = null;
        } else {
            alert('프로세스 저장에 실패했습니다.');
        }
    } catch (error) {
        console.error('프로세스 생성 실패:', error);
        alert(`프로세스 생성 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        isCreatingProcess.value = false;
    }
}

function parseProcessResponse(response) {
    if (typeof response === 'object' && response?.processDefinitionId) {
        return response;
    }

    const responseText = String(response);
    let jsonString = null;

    const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
        jsonString = jsonBlockMatch[1].trim();
    } else {
        const codeBlockMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonString = codeBlockMatch[1].trim();
        } else {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonString = jsonMatch[0];
            }
        }
    }

    if (!jsonString) {
        throw new Error('응답에서 JSON을 찾을 수 없습니다.');
    }

    try {
        return JSON.parse(jsonString);
    } catch {
        try {
            return partialParse(jsonString);
        } catch {
            throw new Error('JSON 파싱 실패');
        }
    }
}

// Expose
defineExpose({
    scrollToBottom,
    scrollToTop,
    updateScroll,
    syncScrollContainer
});
</script>
  
<style lang="scss" scoped>
.chat-info-view-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.chat-info-view-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0; /* 추가: flex item이 overflow를 제대로 처리하도록 */
}

/* 메시지 영역 컨테이너 - 입력창 제외한 나머지 공간 차지 */
.chat-messages-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0; /* 추가 */
}

/* ChatMessages 컴포넌트 영역 */
.chat-messages-wrapper {
    height: 100%;
    overflow: hidden;
}

.chat-view-box {
    height: 100% !important;
    padding-bottom: 120px; /* 추가: 입력창 높이만큼 하단 여유 공간 */
}

.chat-info-message-input-box {
    flex-shrink: 0;
    padding: 8px;
    background: white;
    border-top: 1px solid rgba(0, 0, 0, 0.12); /* 추가: 구분선 */
    z-index: 10; /* 추가 */
}

.message-info-box {
    position: absolute; /* 추가 */
    bottom: 0; /* 추가: 입력창 바로 위에 고정 */
    left: 24.3%;
    right: 0;
    width: 75%;
    margin: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(5px);
    border-radius: 4px 4px 0 0;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-bottom: none;
    z-index: 11; /* 추가: 입력창보다 위에 표시 */
}

.message-info-content {
    padding: 8px 16px;
}

.message-info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    font-weight: 500;
    color: rgb(var(--v-theme-primary));
    font-size: 0.875rem;
}

.message-info-text {
    color: rgba(0, 0, 0, 0.87);
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}

.message-input-box .v-field__input {
    font-size: 16px;
    padding-left: 12px;
}

.message-input-box .v-field {
    padding: 0px;
}

.chat-file-up-load .v-input__control {
    display: none;
    margin-top: -20px;
}

.chat-file-up-load-display .v-input__control {
    display: block;
}

.chat-file-up-load-display .v-input__prepend {
    display: none;
}

pre {
    width: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
}

// 마크다운 콘텐츠 스타일
.markdown-content {
    :deep(p) {
        margin-bottom: 0.5em;
    }

    :deep(ul),
    :deep(ol) {
        padding-left: 1.5em;
        margin-bottom: 0.5em;
    }

    :deep(code) {
        background-color: rgba(0, 0, 0, 0.05);
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 0.9em;
    }

    :deep(pre) {
        background-color: rgba(0, 0, 0, 0.05);
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
    }
}

// 띵킹 애니메이션
.thinking-wave-text {
    display: inline-block;
}

.thinking-char {
    display: inline-block;
    animation: thinking-wave 1.5s ease-in-out infinite;
}

@keyframes thinking-wave {
    0%,
    100% {
        opacity: 0.3;
        transform: translateY(0);
    }
    50% {
        opacity: 1;
        transform: translateY(-3px);
    }
}

// 멘션 하이라이트
.mention-highlight {
    color: #1976d2;
    font-weight: 600;
    background-color: rgba(25, 118, 210, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.95em;
}

// 반응형
@media (max-width: 960px) {
    .right-sidebar {
        position: absolute;
        right: -320px;

        &.showLeftPart {
            right: 0;
            z-index: 2;
            box-shadow: 2px 1px 20px rgba(0, 0, 0, 0.1);
        }
    }

    .boxoverlay {
        position: absolute;
        height: 100%;
        width: 100%;
        z-index: 1;
        background: rgba(0, 0, 0, 0.2);
    }

    /* 모바일에서 입력창 고려한 패딩 */
    .chat-view-box {
        padding-bottom: 140px !important;
    }
}
</style>