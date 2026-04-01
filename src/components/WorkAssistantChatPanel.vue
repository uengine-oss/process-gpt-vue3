<template>
    <div class="work-assistant-chat-panel">
        <!-- 채팅방 목록 UI는 좌측 패널(사이드바)로 이동 -->

        <!-- PDF2BPMN 진행 상황은 메시지 내부에 표시됨 -->

        <!-- BPMN 미리보기 다이얼로그 -->
        <v-dialog v-model="bpmnPreviewDialog" max-width="900" scrollable>
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2">mdi-sitemap</v-icon>
                    {{ selectedBpmn?.process_name || 'BPMN Preview' }}
                    <v-spacer></v-spacer>
                    <!-- 다이어그램/XML 토글 버튼 -->
                    <v-btn-toggle v-model="bpmnViewMode" mandatory density="compact" class="mr-2 bpmn-view-toggle">
                        <v-btn value="diagram" size="small" class="bpmn-toggle-btn">
                            <v-icon size="18" :color="bpmnViewMode === 'diagram' ? 'primary' : undefined">mdi-sitemap</v-icon>
                        </v-btn>
                        <v-btn value="xml" size="small" class="bpmn-toggle-btn">
                            <v-icon size="18" :color="bpmnViewMode === 'xml' ? 'primary' : undefined">mdi-xml</v-icon>
                        </v-btn>
                        <v-btn value="ontology" size="small" class="bpmn-toggle-btn">
                            <v-icon size="18" :color="bpmnViewMode === 'ontology' ? 'primary' : undefined">mdi-graph-outline</v-icon>
                        </v-btn>
                    </v-btn-toggle>
                    <v-btn icon variant="text" @click="bpmnPreviewDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="pa-0">
                    <!-- 다이어그램 뷰 -->
                    <div v-if="bpmnViewMode === 'diagram'" class="bpmn-diagram-container">
                        <ProcessDefinition
                            v-if="selectedBpmn?.bpmn_xml"
                            :bpmn="selectedBpmn.bpmn_xml"
                            :key="selectedBpmn?.process_name"
                            isViewMode="true"
                            isAIGenerated="true"
                        />
                    </div>
                    <!-- XML 뷰 -->
                    <div v-else-if="bpmnViewMode === 'xml'" class="bpmn-preview-container">
                        <pre class="bpmn-xml-content">{{ selectedBpmn?.bpmn_xml }}</pre>
                    </div>
                    <!-- Ontology Graph 뷰 -->
                    <div v-else class="bpmn-ontology-container">
                        <OntologyGraphViewer :definition="selectedBpmn?.definition" />
                    </div>
                </v-card-text>
                <v-card-actions>
                    <!-- XML 모드일 때: XML 복사 버튼 -->
                    <v-btn v-if="bpmnViewMode === 'xml'" variant="tonal" @click="copyBpmnToClipboard">
                        <v-icon class="mr-1">mdi-content-copy</v-icon>
                        XML 복사
                    </v-btn>
                    <!-- 다이어그램 모드일 때: 프로세스 수정 버튼 -->
                    <v-btn v-if="bpmnViewMode === 'diagram'" variant="tonal" @click="openInModeler">
                        <v-icon class="mr-1">mdi-pencil</v-icon>
                        프로세스 수정
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 이미지 미리보기 다이얼로그 -->
        <v-dialog v-model="imagePreviewDialog" max-width="900">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2">mdi-image</v-icon>
                    이미지 미리보기
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" @click="imagePreviewDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text class="pa-2">
                    <v-img v-if="previewImageUrl" :src="previewImageUrl" max-height="600" contain />
                </v-card-text>
            </v-card>
        </v-dialog>

        <ChatThread
            ref="thread"
            :messages="messages"
            :currentUserEmail="userInfo?.email || ''"
            :isLoadingHistory="isLoadingHistory"
            :isLoading="isLoading"
            :loadingMessage="loadingMessage"
            :pdf2bpmnProgress="currentPdf2bpmnProgress"
            @preview-image="openImagePreview"
            @preview-bpmn="showBpmnPreview"
            @open-external-url="openExternalUrl"
            @human-feedback-submit="handleHumanFeedbackSubmit"
        />

        <!-- 입력 영역 - Chat 컴포넌트 사용 -->
        <div class="chat-input-container">
            <Chat
                :workAssistantAgentMode="true"
                :disableChat="isLoading"
                :isMobile="false"
                :showStopButton="isLoading"
                @stopMessage="stopAgent(currentRoomId)"
                @sendMessage="handleChatInputMessage"
            />
        </div>

        <!-- 참가자(초대) 관리 -->
        <v-dialog v-model="participantsDialog" persistent max-width="600px">
            <v-card class="pa-4">
                <v-row class="ma-0 pa-0">
                    <v-card-title class="pa-0">
                        {{ $t('chatListing.selectParticipants') || '참여자 변경' }}
                    </v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="participantsDialog = false" icon variant="text" density="comfortable" style="margin-top: -8px">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-card-text class="ma-0 pa-0 pb-2 pt-4">
                    <v-autocomplete
                        v-model="participantsDraft"
                        :items="userList"
                        chips
                        closable-chips
                        item-title="username"
                        :item-value="(item) => item"
                        multiple
                        :label="$t('chatListing.selectParticipants') || '참여자 선택'"
                        small-chips
                        :loading="isLoadingUsers"
                    >
                        <template v-slot:chip="{ props, item }">
                            <v-chip
                                v-if="item.raw.profile"
                                v-bind="props"
                                :prepend-avatar="item.raw.profile"
                                :text="item.raw.username ? item.raw.username : item.raw.email"
                            ></v-chip>
                            <v-chip
                                v-else-if="item.raw.id == 'system_id'"
                                v-bind="props"
                                prepend-avatar="/images/chat-icon.png"
                                text="System"
                            ></v-chip>
                            <v-chip
                                v-else
                                v-bind="props"
                                prepend-icon="mdi-account-circle"
                                :text="item.raw.username ? item.raw.username : item.raw.email"
                            ></v-chip>
                        </template>

                        <template v-slot:item="{ props, item }">
                            <v-list-item
                                v-if="item.raw.profile"
                                v-bind="props"
                                :prepend-avatar="item.raw.profile"
                                :title="item.raw.username ? item.raw.username : item.raw.email"
                                :subtitle="item.raw.email"
                            ></v-list-item>
                            <v-list-item
                                v-else-if="item.raw.id == 'system_id'"
                                v-bind="props"
                                prepend-avatar="/images/chat-icon.png"
                                title="System"
                            ></v-list-item>
                            <v-list-item
                                v-else
                                v-bind="props"
                                :title="item.raw.username ? item.raw.username : item.raw.email"
                                :subtitle="item.raw.email"
                            >
                                <template v-slot:prepend>
                                    <v-icon style="position: relative; margin-right: 10px; margin-left: -3px" size="48"
                                        >mdi-account-circle</v-icon
                                    >
                                </template>
                            </v-list-item>
                        </template>
                    </v-autocomplete>
                    <div class="text-caption text-grey mt-2">- 시스템과 내 계정은 항상 참가자로 유지됩니다.</div>
                </v-card-text>
                <v-row class="ma-0 pa-0">
                    <v-spacer></v-spacer>
                    <v-btn color="primary" rounded @click="saveParticipants" variant="flat">
                        {{ $t('chatListing.save') || '저장' }}
                    </v-btn>
                </v-row>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import workAssistantAgentService from '@/services/WorkAssistantAgentService.js';
import BackendFactory from '@/components/api/BackendFactory';
import ConsultingGenerator from '@/components/ai/ProcessConsultingGenerator.js';
import { getValidToken } from '@/utils/supabaseAuth.js';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import OntologyGraphViewer from '@/components/ui/OntologyGraphViewer.vue';
import Chat from '@/components/ui/Chat.vue';
import ChatThread from '@/components/chat/ChatThread.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'WorkAssistantChatPanel',
    components: {
        ProcessDefinition,
        OntologyGraphViewer,
        Chat,
        ChatThread
    },
    props: {
        // 초기 메시지 - 문자열 또는 { text, images, file } 객체
        initialMessage: {
            type: [String, Object],
            default: null
        },
        userInfo: {
            type: Object,
            required: true
        },
        // 히스토리에서 선택한 채팅방
        openHistoryRoom: {
            type: Object,
            default: null
        }
    },
    data() {
        return {
            chatRooms: [],
            currentRoomId: null,
            messages: [],
            inputText: '',
            // 로딩 상태를 채팅방별로 관리 (여러 채팅방 동시 요청 지원)
            // { roomId: { isLoading: true, message: '...' } }
            loadingStates: {},
            // 에이전트 스트리밍 중지(Abort)용 컨트롤러 (채팅방별)
            agentAbortControllers: {},
            // 사용자가 "중지" 버튼을 눌렀는지 여부 (채팅방별)
            agentAbortRequested: {},
            isLoadingHistory: true,
            streamingContent: '',
            // ConsultingGenerator 관련
            generator: null,
            isConsultingMode: false,
            lastSendMessage: null,
            // 중복 처리 방지 플래그
            initialMessageHandled: false,
            // PDF2BPMN 진행 상황/구독 (채팅방별로 분리)
            // progressByRoomId: { [roomId]: { isActive, taskId, status, progress, message, generatedBpmns } }
            pdf2bpmnProgressByRoomId: {},
            // taskIdByRoomId: { [roomId]: taskId }
            pdf2bpmnTaskIdByRoomId: {},
            // eventsChannelByTaskId: { [taskId]: RealtimeChannel }
            pdf2bpmnEventsChannelByTaskId: {},
            // BPMN 미리보기
            bpmnPreviewDialog: false,
            bpmnViewMode: 'diagram', // 'diagram' | 'xml' | 'ontology'
            selectedBpmn: null,
            // 음성 인식 관련
            isMicRecording: false,
            micRecorder: null,
            micAudioChunks: [],
            isMicRecorderLoading: false,
            // 첨부 파일 (Chat 컴포넌트에서 전달받음)
            pendingImages: [],
            pendingPdfFile: null,
            // 이미지 미리보기
            imagePreviewDialog: false,
            previewImageUrl: null,

            // 참가자 관리
            participantsDialog: false,
            participantsDraft: [],
            userList: [],
            isLoadingUsers: false
        };
    },
    computed: {
        tenantId() {
            return window.$tenantName || 'uengine';
        },
        currentRoom() {
            return this.chatRooms.find((r) => r.id === this.currentRoomId);
        },
        // 현재 채팅방의 로딩 상태
        isLoading() {
            const state = this.loadingStates[this.currentRoomId];
            return state?.isLoading || false;
        },
        loadingMessage() {
            const state = this.loadingStates[this.currentRoomId];
            return state?.message || '생각 중...';
        },
        // 현재 채팅방의 PDF2BPMN 진행 상태
        currentPdf2bpmnProgress() {
            const state = this.pdf2bpmnProgressByRoomId[this.currentRoomId];
            return (
                state || {
                    isActive: false,
                    taskId: null,
                    status: '',
                    progress: 0,
                    message: '',
                    generatedBpmns: []
                }
            );
        }
    },
    watch: {
        // 히스토리에서 채팅방 선택 시 처리 (패널이 이미 열려있는 상태에서 다른 채팅방 선택 시)
        openHistoryRoom: {
            async handler(newRoom) {
                if (newRoom && newRoom.id) {
                    await this.openHistoryChatRoom(newRoom);
                }
            }
        }
    },
    async mounted() {
        await this.loadChatRooms();

        // 히스토리에서 선택된 채팅방이 있으면 우선 처리 (새 채팅방 생성 X)
        if (this.openHistoryRoom && this.openHistoryRoom.id) {
            await this.openHistoryChatRoom(this.openHistoryRoom);
        }
        // 초기 메시지가 있으면 새 채팅방 생성 후 메시지 전송
        else if (this.initialMessage && !this.initialMessageHandled) {
            // 문자열 또는 객체 형태 모두 처리
            const hasContent =
                typeof this.initialMessage === 'string'
                    ? this.initialMessage.trim()
                    : this.initialMessage.text || this.initialMessage.images?.length > 0 || this.initialMessage.file;
            if (hasContent) {
                this.initialMessageHandled = true;
                await this.handleInitialMessage(this.initialMessage);
            }
        }
    },
    beforeUnmount() {
        // 패널이 닫힐 때 채팅방 선택 해제 알림 (알림 활성화)
        if (this.currentRoomId) {
            this.EventBus.emit('chat-room-unselected');
        }
        // PDF2BPMN Events 채널 정리
        this.unsubscribeAllPdf2bpmnEvents();
        // 진행 중인 에이전트 스트림 중지
        this.abortAllAgentStreams();
    },
    methods: {
        /**
         * HumanFeedbackPanel에서 사용자가 선택을 완료했을 때 호출
         * 선택 결과를 사용자 메시지로 전송하여 에이전트가 이어서 처리하도록 함
         */
        async handleHumanFeedbackSubmit(message, feedbackResult) {
            if (!feedbackResult || !this.currentRoomId) return;

            // 메시지를 제출 완료 상태로 변경
            if (message.__humanFeedback) {
                message.__humanFeedback.__submitted = true;
            }

            let userText = '';
            if (feedbackResult.type === 'select_items') {
                const selectedLabels = feedbackResult.selectedItems.map(item => item.label);
                userText = `다음 문서를 참고해서 작성해 주세요: ${selectedLabels.join(', ')}`;
            } else if (feedbackResult.type === 'suggestions') {
                userText = feedbackResult.selected;
            } else {
                userText = '확인';
            }

            // 기존 sendMessage 로직 재사용: inputText를 설정하고 sendMessage 호출
            this.inputText = userText;
            await this.sendMessage();
        },

        normalizeParticipant(p) {
            if (!p) return null;
            return {
                id: p?.id || p?.uid || null,
                email: p?.email || null,
                username: p?.username || p?.name || p?.email || '',
                profile: p?.profile || null
            };
        },
        participantMatches(a, b) {
            if (!a || !b) return false;
            if (a.email && b.email && a.email === b.email) return true;
            if (a.id && b.id && a.id === b.id) return true;
            return false;
        },
        ensureBaseParticipants(list) {
            const system = { email: 'system@uengine.org', id: 'system_id', username: 'AI 어시스턴트' };
            const me = this.normalizeParticipant(this.userInfo);

            const normalized = (Array.isArray(list) ? list : []).map(this.normalizeParticipant).filter(Boolean);

            const hasSystem = normalized.some((p) => p.id === 'system_id' || p.email === 'system@uengine.org');
            const hasMe = me ? normalized.some((p) => this.participantMatches(p, me)) : false;

            const next = [...normalized];
            if (!hasSystem) next.unshift(system);
            if (me && !hasMe) next.push(me);

            const seen = new Set();
            return next.filter((p) => {
                const key = p.email ? `e:${p.email}` : p.id ? `i:${p.id}` : null;
                if (!key) return false;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        },
        async loadInviteUserList() {
            this.isLoadingUsers = true;
            try {
                const list = await backend.getUserList(null);
                this.userList = Array.isArray(list) ? list : [];
            } catch (e) {
                this.userList = [];
            } finally {
                this.isLoadingUsers = false;
            }
        },
        async openParticipantsDialog() {
            if (!this.currentRoomId) return;
            if (!this.userList || this.userList.length === 0) {
                await this.loadInviteUserList();
            }
            const room = this.chatRooms.find((r) => r.id === this.currentRoomId);
            const current = room?.participants || [];
            this.participantsDraft = [...current];
            this.participantsDialog = true;
        },
        async saveParticipants() {
            if (!this.currentRoomId) {
                this.participantsDialog = false;
                return;
            }
            const room = this.chatRooms.find((r) => r.id === this.currentRoomId);
            if (!room) {
                this.participantsDialog = false;
                return;
            }
            const next = this.ensureBaseParticipants(this.participantsDraft);
            room.participants = next;
            try {
                await this.putObject('chat_rooms', room);
                this.EventBus.emit('chat-rooms-updated');
            } catch (e) {
                // ignore
            } finally {
                this.participantsDialog = false;
            }
        },
        async renameRoom(roomId, newName) {
            const trimmed = String(newName || '').trim();
            if (!roomId || !trimmed) return;
            const nextName = trimmed.substring(0, 50);
            const room = this.chatRooms.find((r) => r.id === roomId);
            if (room) {
                room.name = nextName;
                await this.putObject('chat_rooms', room);
                this.EventBus.emit('chat-rooms-updated');
            }
        },
        // UUID 생성
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },

        // 채팅방 목록 로드
        async loadChatRooms() {
            try {
                const rooms = await backend.getChatRoomList('chat_rooms');
                if (rooms && rooms.length > 0) {
                    // 현재 사용자가 참가한 채팅방만 필터링 (System 참가자가 있는 것)
                    this.chatRooms = rooms
                        .filter((room) => {
                            const hasSystem = room.participants?.some((p) => p.id === 'system_id' || p.email === 'system@uengine.org');
                            const hasUser = room.participants?.some((p) => p.email === this.userInfo.email);
                            return hasSystem && hasUser && room.participants.length === 2;
                        })
                        .sort((a, b) => new Date(b.message?.createdAt || 0) - new Date(a.message?.createdAt || 0));

                    // 자동 선택은 하지 않음 (initialMessage나 openHistoryRoom에서 처리)
                }
                this.EventBus.emit('chat-rooms-updated');
            } catch (error) {
                console.error('채팅방 로드 오류:', error);
            }
        },

        // 채팅방 선택
        async selectRoom(room) {
            this.currentRoomId = room.id;
            // App.vue에 현재 채팅방 알림 (알림 중복 방지용)
            this.EventBus.emit('chat-room-selected', room.id);
            // DB 트리거(알림 생성)에서 "현재 채팅방에 있음"을 판단하는 access_page 갱신
            // Chats.vue와 동일하게 chat:<roomId> 형태로 기록
            this.updateChatAccessPage(room.id);
            await this.loadMessages(room.id);
        },

        // 메시지 로드 (ChatModule과 동일한 방식)
        async loadMessages(roomId) {
            try {
                this.isLoadingHistory = true;
                this.messages = [];

                const messages = await backend.getMessages(roomId);
                if (messages && messages.length > 0) {
                    const allMessages = messages.map((message) => {
                        const newMessage = message.messages;
                        newMessage.thread_id = message.thread_id || null;
                        newMessage.uuid = message.uuid;
                        return newMessage;
                    });
                    allMessages.sort((a, b) => new Date(a.timeStamp) - new Date(b.timeStamp));
                    this.messages = allMessages;

                    // 해당 채팅방의 PDF2BPMN 작업 확인 및 구독 시작
                    this.checkExistingPdf2BpmnTask(roomId);
                }
                this.$nextTick(() => this.scrollToBottom());
            } catch (error) {
                console.error('메시지 로드 오류:', error);
            } finally {
                this.isLoadingHistory = false;
            }
        },

        // 새 채팅방 생성
        async createNewRoom(initialMessage = null) {
            this.isLoadingHistory = false;
            const roomId = this.uuid();
            const room = {
                id: roomId,
                name: initialMessage && typeof initialMessage === 'string' ? this.truncateText(initialMessage, 20) : '새 대화',
                participants: [
                    {
                        email: 'system@uengine.org',
                        id: 'system_id',
                        username: 'AI 어시스턴트'
                    },
                    {
                        email: this.userInfo.email,
                        id: this.userInfo.uid || this.userInfo.id,
                        username: this.userInfo.name || this.userInfo.username || this.userInfo.email
                    }
                ],
                message: {
                    msg: initialMessage || 'NEW',
                    type: 'text',
                    createdAt: Date.now()
                }
            };

            // DB에 저장
            await this.putObject('chat_rooms', room);

            // 로컬 상태 업데이트
            this.chatRooms.unshift(room);
            this.currentRoomId = roomId;
            this.EventBus.emit('chat-room-selected', roomId);
            this.EventBus.emit('chat-rooms-updated');
            this.updateChatAccessPage(roomId);
            this.messages = [];

            return room;
        },

        // 채팅방 삭제
        async deleteRoom(roomId) {
            try {
                await backend.delete(`chats/${roomId}`, { key: 'id' });
                await backend.delete(`chat_rooms/${roomId}`, { key: 'id' });

                this.chatRooms = this.chatRooms.filter((r) => r.id !== roomId);
                this.EventBus.emit('chat-rooms-updated');

                if (this.currentRoomId === roomId) {
                    if (this.chatRooms.length > 0) {
                        await this.selectRoom(this.chatRooms[0]);
                    } else {
                        this.currentRoomId = null;
                        this.messages = [];
                        this.EventBus.emit('chat-room-unselected');
                    }
                }
            } catch (error) {
                console.error('채팅방 삭제 오류:', error);
            }
        },

        // 초기 메시지 처리
        async handleInitialMessage(message) {
            console.log('[WorkAssistantChatPanel] handleInitialMessage 시작:', message);
            // 문자열 또는 객체 형태 모두 지원
            let text = '';
            let images = [];
            let pdfFile = null;

            if (typeof message === 'string') {
                text = message;
            } else if (message && typeof message === 'object') {
                text = message.text || '';
                images = message.images || [];
                pdfFile = message.file || null;
                console.log('[WorkAssistantChatPanel] 추출된 file:', pdfFile);
            }

            // 새 채팅방 생성
            const room = await this.createNewRoom(text);

            // 메시지 전송 (이미지/PDF 포함)
            this.inputText = text;
            this.pendingImages = images;
            this.pendingPdfFile = pdfFile;
            console.log('[WorkAssistantChatPanel] sendMessage 호출 전 pendingPdfFile:', this.pendingPdfFile);
            await this.sendMessage();
        },

        // 히스토리에서 선택된 채팅방 열기
        async openHistoryChatRoom(room) {
            // 채팅방 목록에 없으면 추가
            if (!this.chatRooms.find((r) => r.id === room.id)) {
                this.chatRooms.unshift(room);
            }

            // 채팅방 선택 및 메시지 로드
            await this.selectRoom(room);
        },

        // Chat 컴포넌트에서 메시지 전송 시 처리
        handleChatInputMessage(message) {
            if (!message || (!message.text && (!message.images || message.images.length === 0) && !message.file)) return;
            this.inputText = message.text || '';
            this.pendingImages = message.images || [];
            // Chat.vue에서 업로드 완료된 fileInfo를 전달받음 (MainChatInput과 동일)
            this.pendingPdfFile = message.file || null;
            this.sendMessage();
        },

        // 메시지 전송
        async sendMessage() {
            console.log('[WorkAssistantChatPanel] sendMessage 시작, pendingPdfFile:', this.pendingPdfFile);
            // 텍스트, 이미지, PDF 중 하나라도 있어야 전송 가능
            const hasText = this.inputText.trim();
            const hasImages = this.pendingImages && this.pendingImages.length > 0;
            const hasPdf = this.pendingPdfFile;
            console.log('[WorkAssistantChatPanel] 조건 체크 - hasText:', !!hasText, 'hasImages:', hasImages, 'hasPdf:', !!hasPdf);

            // 현재 채팅방이 로딩 중인 경우에만 메시지 전송 차단 (다른 채팅방은 허용)
            const currentRoomState = this.loadingStates[this.currentRoomId];
            if ((!hasText && !hasImages && !hasPdf) || currentRoomState?.isLoading) return;

            // 현재 첨부된 이미지/PDF 복사 후 초기화
            const currentImages = [...this.pendingImages];
            const currentPdfFile = this.pendingPdfFile;
            console.log('[WorkAssistantChatPanel] currentPdfFile:', currentPdfFile);
            this.pendingImages = [];
            this.pendingPdfFile = null;

            // 텍스트가 없고 첨부만 있는 경우 기본 메시지 설정
            let userMessage = this.inputText.trim();
            // if (!userMessage && (currentPdfFile || currentImages.length > 0)) {
            //     userMessage = currentPdfFile
            //         ? 'PDF 파일을 분석하여 BPMN 프로세스를 생성해주세요.'
            //         : '첨부된 내용을 확인해주세요.';
            // }
            this.inputText = '';

            // 컨설팅 모드는 "사용자 메시지 라우팅"이 아니라,
            // 에이전트가 start_process_consulting 도구를 호출할 때마다 1회 컨설팅 응답을 생성하는 방식으로 동작합니다.
            // 따라서 사용자의 다음 답변은 항상 에이전트가 의도 파악(생성/추가 컨설팅/질문)을 하도록 그대로 전달합니다.

            // 채팅방이 없으면 메시지 전송 불가
            if (!this.currentRoomId) {
                console.error('채팅방이 없습니다.');
                return;
            }

            // ★ 시작 시점의 roomId 캡처 (콜백에서 사용)
            const targetRoomId = this.currentRoomId;
            const targetRoom = this.currentRoom;
            // 알림 트리거 억제용 access_page 갱신 (5분 윈도우 내 유지)
            this.updateChatAccessPage(targetRoomId);

            // 사용자 메시지 추가 (이미지/PDF 정보 포함)
            const userMsgObj = this.createMessageObj(userMessage, 'user', {
                images: currentImages,
                pdfFile: currentPdfFile
            });
            this.messages.push(userMsgObj);
            await this.saveMessage(userMsgObj);

            // 기존 방식 유지: 첨부 정보는 [InputData]로 텍스트에 포함시켜 에이전트에게 전달
            let messageForAgent = userMessage;
            if ((currentImages && currentImages.length > 0) || currentPdfFile) {
                const inputData = {};
                if (currentImages && currentImages.length > 0) inputData.images = currentImages;
                if (currentPdfFile) inputData.file = currentPdfFile;
                messageForAgent += `\n\n[InputData]\n${JSON.stringify(inputData)}`;
                console.log('[WorkAssistantChatPanel] [InputData] 추가됨:', inputData);
            }
            console.log('[WorkAssistantChatPanel] messageForAgent:', messageForAgent.substring(0, 200) + '...');

            // API 호출 - 로딩 상태를 채팅방별로 관리
            this.loadingStates[targetRoomId] = {
                isLoading: true,
                message: '생각 중...'
            };

            this.scrollToBottom();

            try {
                // 스트리밍 응답 처리
                let fullResponse = '';
                const toolCalls = [];

                // Supabase 세션에서 JWT 가져오기 (자동 갱신 포함)
                const userJwt = (await getValidToken()) || '';

                // 채팅방별 AbortController 저장 (중지 버튼용)
                const abortController = new AbortController();
                this.agentAbortControllers[targetRoomId] = abortController;

                await workAssistantAgentService.sendMessageStream(
                    {
                        message: messageForAgent,
                        tenant_id: this.tenantId,
                        user_uid: this.userInfo.uid || this.userInfo.id,
                        user_email: this.userInfo.email,
                        user_name: this.userInfo.name || this.userInfo.username,
                        user_jwt: userJwt,
                        conversation_id: targetRoomId // 캡처된 채팅방 ID 사용
                    },
                    {
                        onToken: (token) => {
                            fullResponse += token;
                            // 스트리밍 중 표시 업데이트 (해당 채팅방의 로딩 상태)
                            if (this.loadingStates[targetRoomId]) {
                                this.loadingStates[targetRoomId].message = fullResponse.length === 0 ? '생각 중...' : fullResponse;
                            }
                        },
                        onToolStart: (toolName, input) => {
                            if (toolName === 'work-assistant__ask_user') {
                                if (toolCalls.length > 0 && toolCalls[toolCalls.length - 1].name === 'work-assistant__ask_user') {
                                    return;
                                }
                            }
                            toolCalls.push({ name: toolName, input });
                            // 해당 채팅방의 로딩 상태 업데이트
                            if (this.loadingStates[targetRoomId]) {
                                this.loadingStates[targetRoomId].message = `🔧 ${this.formatToolName(toolName)} 실행 중...`;
                            }
                        },
                        onToolEnd: (output) => {
                            // 마지막 도구 호출에 결과 저장
                            if (toolCalls.length > 0) {
                                toolCalls[toolCalls.length - 1].output = output;
                            }

                            // list_reference_documents 등 human feedback 도구 결과 감지
                            if (toolCalls.length > 0) {
                                const lastTool = toolCalls[toolCalls.length - 1];
                                console.log('[HumanFeedback] onToolEnd - toolName:', lastTool.name, 'output type:', typeof output, 'output[:200]:', String(output).substring(0, 200));
                                if (lastTool.name && lastTool.name.includes('list_reference_documents')) {
                                    try {
                                        const parsed = typeof output === 'string' ? JSON.parse(output) : output;
                                        console.log('[HumanFeedback] parsed:', JSON.stringify(parsed).substring(0, 300));
                                        console.log('[HumanFeedback] user_request_type:', parsed?.user_request_type, 'items:', !!parsed?.items, 'items.length:', parsed?.items?.length);
                                        if (parsed && parsed.user_request_type === 'select_items' && parsed.items) {
                                            lastTool.__humanFeedback = parsed;
                                            console.log('[HumanFeedback] ✅ __humanFeedback 설정 완료');
                                        }
                                    } catch (e) {
                                        console.warn('[HumanFeedback] 파싱 실패:', e, 'output:', String(output).substring(0, 200));
                                    }
                                }
                            }
                        },
                        onAbort: async () => {
                            // 로딩 상태 해제 (해당 채팅방)
                            if (this.loadingStates[targetRoomId]) {
                                this.loadingStates[targetRoomId].isLoading = false;
                            }

                            // 컨트롤러 정리
                            delete this.agentAbortControllers[targetRoomId];

                            // 사용자가 직접 중지한 경우: 지금까지 생성된 내용을 최종 답변으로 확정
                            if (this.agentAbortRequested[targetRoomId]) {
                                delete this.agentAbortRequested[targetRoomId];

                                // 현재까지 스트리밍된 결과가 있으면 메시지로 저장/표시
                                const partial = (fullResponse || '').trim();
                                if (partial) {
                                    const assistantMsgObj = this.createMessageObj(partial, 'assistant');
                                    assistantMsgObj.toolCalls = toolCalls;

                                    if (this.currentRoomId === targetRoomId) {
                                        this.messages.push(assistantMsgObj);
                                    }
                                    await this.saveMessageToRoom(assistantMsgObj, targetRoomId);
                                }
                            }
                        },
                        onDone: async (content) => {
                            // 로딩 상태 해제 (해당 채팅방)
                            if (this.loadingStates[targetRoomId]) {
                                this.loadingStates[targetRoomId].isLoading = false;
                            }

                            // 컨트롤러 정리
                            delete this.agentAbortControllers[targetRoomId];
                            delete this.agentAbortRequested[targetRoomId];

                            // AI 응답 메시지 생성
                            const assistantMsgObj = this.createMessageObj(content, 'assistant');
                            assistantMsgObj.toolCalls = toolCalls;

                            // human feedback 도구 결과가 있으면 메시지에 첨부
                            const feedbackToolCall = toolCalls.find(tc => tc.__humanFeedback);
                            console.log('[HumanFeedback] onDone - feedbackToolCall:', !!feedbackToolCall, 'toolCalls count:', toolCalls.length);
                            if (feedbackToolCall) {
                                assistantMsgObj.__humanFeedback = feedbackToolCall.__humanFeedback;
                                console.log('[HumanFeedback] ✅ 메시지에 __humanFeedback 첨부됨, items:', feedbackToolCall.__humanFeedback?.items?.length);
                            }

                            // ★ 현재 채팅방이 요청 시작 채팅방과 같을 때만 UI에 추가
                            if (this.currentRoomId === targetRoomId) {
                                this.messages.push(assistantMsgObj);
                            }

                            // DB에는 항상 저장 (targetRoomId 기준)
                            await this.saveMessageToRoom(assistantMsgObj, targetRoomId);

                            // 채팅방 이름 업데이트: 최초(기본값)인 경우에만 첫 사용자 메시지로 고정
                            if (targetRoom) {
                                const currentName = (targetRoom.name || '').trim();
                                const isDefaultName = !currentName || currentName === '새 대화';
                                if (isDefaultName) {
                                    targetRoom.name = this.truncateText(userMessage, 20);
                                    await this.putObject('chat_rooms', targetRoom);
                                }
                            }

                            // PDF2BPMN 작업 감지 및 events watch 시작
                            this.checkAndSubscribePdf2Bpmn(content, toolCalls, targetRoomId);

                            // ===== 파싱 없이 toolCalls.name 기반으로 분기 =====
                            const lastToolCall = Array.isArray(toolCalls) && toolCalls.length > 0 ? toolCalls[toolCalls.length - 1] : null;
                            const directiveToolCall = Array.isArray(toolCalls)
                                ? [...toolCalls]
                                      .reverse()
                                      .find(
                                          (tc) =>
                                              typeof tc?.name === 'string' &&
                                              (tc.name.includes('start_process_consulting') || tc.name.includes('generate_process'))
                                      )
                                : null;

                            // 1) 프로세스 생성 요청 → 컨설팅 모드로 전환 (현재 채팅방일 때만)
                            if (directiveToolCall?.name?.includes('start_process_consulting') && this.currentRoomId === targetRoomId) {
                                // 1) 먼저 toolCall.output을 파싱해서 image_analysis_result만 추출 시도
                                // 2) 실패하면 toolCall.output 전체를 그대로 전달 (파싱 없이)
                                let imageAnalysis = null;
                                try {
                                    const parsed = this.parseToolOutput(directiveToolCall.output);
                                    if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                                        imageAnalysis = parsed.image_analysis_result;
                                    }
                                } catch (e) {
                                    // ignore → fallback 사용
                                }

                                let originalMessage;
                                if (imageAnalysis) {
                                    originalMessage = `${userMessage || ''}\n\n` + `[이미지 분석 결과]\n${imageAnalysis}`;
                                } else {
                                    // 중요: input을 재구성하지 않고, toolCall.output "전체"를 파싱 없이 그대로 넘김
                                    originalMessage =
                                        `${userMessage || ''}\n\n` +
                                        `[전체 요청 및 첨부 이미지 분석 내용]: ${JSON.stringify(directiveToolCall.output ?? null)}`;
                                }

                                console.log('[WorkAssistantChatPanel] start_process_consulting originalMessage:', originalMessage);
                                await this.switchToConsultingMode(originalMessage);
                                return;
                            }

                            // 2) 컨설팅 후 생성 확정 → definitions 생성 화면으로 전환 (현재 채팅방일 때만)
                            if (directiveToolCall?.name?.includes('generate_process') && this.currentRoomId === targetRoomId) {
                                // 현재까지의 대화 내용을 store에 저장
                                this.$store.dispatch('updateMessages', this.messages);
                                // /definitions/chat로 이동
                                this.$router.push('/definitions/chat');
                                return;
                            }

                            // 3) 기타 도구 호출 결과는 name 기반으로 상위 컴포넌트에 전달
                            if (lastToolCall?.name) {
                                this.$emit('response-parsed', {
                                    name: lastToolCall.name,
                                    input: lastToolCall.input || null,
                                    output: lastToolCall.output || null,
                                    toolCalls
                                });
                            }

                            // 현재 채팅방일 때만 스크롤
                            if (this.currentRoomId === targetRoomId) {
                                this.scrollToBottom();
                            }
                        },
                        onError: (error) => {
                            // 로딩 상태 해제 (해당 채팅방)
                            if (this.loadingStates[targetRoomId]) {
                                this.loadingStates[targetRoomId].isLoading = false;
                            }
                            // 컨트롤러 정리
                            delete this.agentAbortControllers[targetRoomId];
                            delete this.agentAbortRequested[targetRoomId];
                            console.error('에이전트 오류:', error);

                            // 오류 메시지 추가 (현재 채팅방일 때만 UI에 추가)
                            const errorMsgObj = this.createMessageObj(
                                '죄송합니다. 요청 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
                                'assistant'
                            );
                            if (this.currentRoomId === targetRoomId) {
                                this.messages.push(errorMsgObj);
                            }
                            // DB에는 항상 저장
                            this.saveMessageToRoom(errorMsgObj, targetRoomId);
                        }
                    },
                    { signal: abortController.signal }
                );
            } catch (error) {
                // 로딩 상태 해제 (해당 채팅방)
                if (this.loadingStates[targetRoomId]) {
                    this.loadingStates[targetRoomId].isLoading = false;
                }
                // 컨트롤러 정리
                delete this.agentAbortControllers[targetRoomId];
                delete this.agentAbortRequested[targetRoomId];
                console.error('메시지 전송 오류:', error);
            }
        },

        // 메시지 객체 생성
        createMessageObj(content, role, options = {}) {
            const obj = {
                uuid: this.uuid(),
                content: content,
                role: role,
                name: role === 'user' ? this.userInfo.name || this.userInfo.username : 'AI 어시스턴트',
                email: role === 'user' ? this.userInfo.email : 'system@uengine.org',
                timeStamp: Date.now()
            };

            // 이미지 정보 추가
            if (options.images && options.images.length > 0) {
                obj.images = options.images;
                obj.image = options.images[0].url;
            }

            // PDF 파일 정보 추가 (Chat.vue에서 전달된 필드명: fileName, fileUrl, fileType, fileSize)
            if (options.pdfFile) {
                obj.pdfFile = {
                    name: options.pdfFile.fileName || options.pdfFile.name,
                    url: options.pdfFile.fileUrl || options.pdfFile.url,
                    size: options.pdfFile.fileSize || options.pdfFile.size,
                    type: options.pdfFile.fileType || options.pdfFile.type
                };
            }

            return obj;
        },

        // MCP 도구 output 파싱 (content='...' name=... 형식 처리)
        parseToolOutput(outputStr) {
            if (!outputStr) return null;

            // 파싱 전, JSON 바깥(따옴표 밖)에 섞인 불필요 토큰 정리:
            // - 실제 개행/탭 문자
            // - content='{\\n ... \\n}' 처럼 JSON 포맷팅용으로 들어간 "\\n", "\\r", "\\t" (따옴표 밖)
            //   ※ 따옴표 안의 "\\n"은 의미가 있을 수 있으므로 건드리지 않음
            const sanitizeForJsonParse = (s) => {
                if (typeof s !== 'string') return s;
                let out = '';
                let inString = false;
                let escaped = false;

                for (let i = 0; i < s.length; i++) {
                    const ch = s[i];

                    // 실제 개행/탭은 위치와 무관하게 제거 (JSON 파싱 안정화)
                    if (ch === '\n' || ch === '\r' || ch === '\t') continue;

                    if (inString) {
                        out += ch;
                        if (escaped) {
                            escaped = false;
                        } else if (ch === '\\') {
                            escaped = true;
                        } else if (ch === '"') {
                            inString = false;
                        }
                        continue;
                    }

                    // 문자열 시작
                    if (ch === '"') {
                        inString = true;
                        out += ch;
                        continue;
                    }

                    // 문자열 밖에서의 "\\n" / "\\r" / "\\t" 제거 (pdf2bpmn 등)
                    if (ch === '\\') {
                        const next = s[i + 1];
                        if (next === 'n' || next === 'r' || next === 't') {
                            i++; // 다음 문자도 소비
                            continue;
                        }
                    }

                    out += ch;
                }

                return out.trim();
            };

            // content='...' name=... 형식 처리 (Python ToolMessage repr 형식)
            if (typeof outputStr === 'string' && outputStr.startsWith('content=')) {
                try {
                    // content=' 이후부터 ' name= 직전까지 추출 (인덱스 기반으로 더 안정적)
                    const contentStart = "content='".length;
                    // ' name= 또는 ' tool_call_id= 패턴 찾기 (content 끝 마커)
                    const endMarkers = [/' name=/, /' tool_call_id=/];
                    let endIdx = -1;

                    for (const marker of endMarkers) {
                        const match = outputStr.match(marker);
                        if (match && (endIdx === -1 || match.index < endIdx)) {
                            endIdx = match.index;
                        }
                    }

                    if (endIdx > contentStart) {
                        const raw = outputStr.substring(contentStart, endIdx);

                        // 중요:
                        // - 여기서 \\n(문자열 이스케이프)을 실제 개행 문자로 바꾸면 JSON 문자열 내부에 "control character"가 생겨 JSON.parse가 실패함
                        // - 따라서 JSON.parse 이후(파싱된 필드 값)에 대해서만 필요한 경우 개행 정규화를 수행

                        const normalizeNewlines = (val) => {
                            if (typeof val !== 'string') return val;
                            // "\\\\n" -> "\\n" -> "\n" 순으로 정규화
                            return val.replace(/\\\\\\\\n/g, '\\\\n').replace(/\\\\n/g, '\n');
                        };

                        // 1) 처음부터 불필요 토큰 제거 후 파싱 시도
                        const rawSanitized = sanitizeForJsonParse(raw);
                        try {
                            const parsed = JSON.parse(rawSanitized);
                            if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                                parsed.image_analysis_result = normalizeNewlines(parsed.image_analysis_result);
                            }
                            return parsed;
                        } catch (e1) {
                            // 2) ToolMessage repr에서 이스케이프가 과하게 들어온 경우만 보정 후 재시도
                            // - 4중 백슬래시 -> 2중 백슬래시 (repr에서 흔히 발생)
                            // - \\\" -> \" 형태로 줄여 파싱 가능성 확보
                            let jsonStr = raw.replace(/\\\\\\\\/g, '\\\\').replace(/\\\\"/g, '\\"');
                            try {
                                const parsed = JSON.parse(sanitizeForJsonParse(jsonStr));
                                if (parsed && typeof parsed === 'object' && typeof parsed.image_analysis_result === 'string') {
                                    parsed.image_analysis_result = normalizeNewlines(parsed.image_analysis_result);
                                }
                                return parsed;
                            } catch (e2) {
                                // 3) 최후의 보루: 파싱은 실패했지만 타입만이라도 감지
                                if (outputStr.includes('"user_request_type": "start_process_consulting"')) {
                                    return { user_request_type: 'start_process_consulting' };
                                }
                                if (outputStr.includes('"user_request_type": "generate_process"')) {
                                    return { user_request_type: 'generate_process' };
                                }
                                throw e2;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[parseToolOutput] content= 형식 파싱 실패:', e.message);
                }
            }

            // 일반 JSON 문자열
            if (typeof outputStr === 'string') {
                try {
                    return JSON.parse(sanitizeForJsonParse(outputStr));
                } catch (e) {
                    console.warn('[parseToolOutput] JSON 파싱 실패:', e.message);
                    return null;
                }
            }

            // 이미 객체인 경우
            return outputStr;
        },

        // 메시지 저장 (현재 채팅방에 저장)
        async saveMessage(msg) {
            await this.saveMessageToRoom(msg, this.currentRoomId);
        },

        // 특정 채팅방에 메시지 저장 (비동기 콜백에서 사용)
        async saveMessageToRoom(msg, roomId) {
            if (!roomId) {
                console.error('[WorkAssistantChatPanel] saveMessageToRoom: roomId가 없습니다.');
                return;
            }

            const messageData = {
                uuid: msg.uuid,
                id: roomId,
                messages: msg
            };
            await this.putObject(`chats/${msg.uuid}`, messageData);

            // 채팅방 마지막 메시지 업데이트
            const room = this.chatRooms.find((r) => r.id === roomId);
            if (room) {
                room.message = {
                    msg: typeof msg.content === 'string' ? msg.content.substring(0, 50) : 'New message',
                    type: 'text',
                    createdAt: msg.timeStamp
                };
                await this.putObject('chat_rooms', room);
                // 최신 메시지 기준으로 정렬하여 "최신이 상단" 유지
                this.chatRooms.sort((a, b) => new Date(b.message?.createdAt || 0) - new Date(a.message?.createdAt || 0));
                this.EventBus.emit('chat-rooms-updated');
            }
        },

        // DB 저장 유틸리티 (ChatModule과 동일한 방식)
        async putObject(path, obj, options) {
            try {
                await backend.putObject(`db://${path}`, obj, options);
            } catch (error) {
                console.error('저장 오류:', error);
            }
        },

        // 현재 사용자가 어떤 채팅방을 보고 있는지 DB(user_devices)에 기록
        // - notifications 트리거(handle_chat_insert)가 이 값을 보고 "알림을 만들지" 결정함
        async updateChatAccessPage(roomId) {
            try {
                const email = this.userInfo?.email;
                if (!email || !roomId) return;
                if (backend?.saveAccessPage) {
                    await backend.saveAccessPage(email, `chat:${roomId}`);
                }
            } catch (e) {
                // 알림 억제용 부가 기능이므로 실패해도 UX를 막지 않음
                console.warn('[WorkAssistantChatPanel] saveAccessPage 실패:', e);
            }
        },

        // 메시지 포맷팅
        formatMessage(content) {
            if (!content) return '';

            // JSON 코드 블록 처리
            let formatted = content.replace(/```json\s*([\s\S]*?)\s*```/g, (match, json) => {
                try {
                    const parsed = JSON.parse(json);
                    return `<pre class="json-block">${JSON.stringify(parsed, null, 2)}</pre>`;
                } catch {
                    return `<pre class="code-block">${json}</pre>`;
                }
            });
            // let formatted = content.replace(/```json\s*([\s\S]*?)\s*```/g, "");

            // 일반 코드 블록 처리
            formatted = formatted.replace(/```(\w*)\s*([\s\S]*?)\s*```/g, '<pre class="code-block">$2</pre>');

            // 마크다운 링크 형식 [텍스트](URL) 처리
            formatted = formatted.replace(
                /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
                '<a href="$2" target="_blank" class="message-link">$1</a>'
            );

            // 일반 URL을 클릭 가능한 링크로 변환 - href=" 뒤에 있는 URL은 제외
            formatted = formatted.replace(
                /(?<!href=")(https?:\/\/[^\s<)\]"]+)/g,
                '<a href="$1" target="_blank" class="message-link">$1</a>'
            );

            // 줄바꿈 처리
            formatted = formatted.replace(/\n/g, '<br>');

            return formatted;
        },

        // 도구 이름 포맷팅
        formatToolName(name) {
            if (!name) return '';
            // work-assistant__get_process_list -> 프로세스 목록 조회
            const toolNameMap = {
                get_process_list: '프로세스 목록 조회',
                get_process_detail: '프로세스 상세 조회',
                get_form_fields: '폼 필드 조회',
                execute_process: '프로세스 실행',
                get_instance_list: '인스턴스 목록 조회',
                get_todolist: '할일 목록 조회',
                get_organization: '조직도 조회',
                start_process_consulting: '프로세스 컨설팅 시작',
                generate_process: '프로세스 생성'
            };

            const toolKey = name.split('__').pop();
            return toolNameMap[toolKey] || toolKey;
        },

        // 시간 포맷팅
        formatTime(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        },

        // 텍스트 자르기
        truncateText(text, maxLength) {
            if (!text) return '';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        },

        // 스크롤 하단으로
        scrollToBottom() {
            try {
                this.$refs.thread?.scrollToBottom?.();
            } catch (e) {}
        },

        // 컨설팅 모드로 전환 (프로세스 생성용)
        async switchToConsultingMode(userMessage) {
            const me = this;

            // ConsultingGenerator 초기화
            me.generator = new ConsultingGenerator(me, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
            // 컨설팅은 "고정 모드"가 아니라, start_process_consulting 도구 호출 시마다 1회 응답 생성으로 처리합니다.
            // (사용자 다음 메시지는 항상 에이전트가 받아 의도 판단)
            me.isConsultingMode = true;

            // 마지막 시스템 메시지 제거 (work-assistant-agent의 응답)
            if (me.messages.length > 0 && me.messages[me.messages.length - 1].role !== 'user') {
                me.messages.pop();
            }

            // 전체 대화 내역을 previousMessages에 추가 (마지막 사용자 메시지 제외)
            let chatMsgs = [];
            if (me.messages && me.messages.length > 0) {
                me.messages.forEach((msg, idx) => {
                    // 마지막 사용자 메시지는 제외 (합쳐진 userMessage로 대체할 예정)
                    const isLastUserMsg = idx === me.messages.length - 1 && msg.role === 'user';
                    if (msg.content && !msg.isLoading && !isLastUserMsg) {
                        chatMsgs.push({
                            role: msg.role,
                            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                        });
                    }
                });
            }

            // 합쳐진 userMessage를 사용자 메시지로 추가
            chatMsgs.push({
                role: 'user',
                content: userMessage
            });

            me.generator.previousMessages = [me.generator.previousMessages[0], ...chatMsgs];

            // 컨설팅 시작
            me.lastSendMessage = { text: userMessage };
            await me.startConsultingGenerate();
        },

        // 컨설팅 생성 시작
        async startConsultingGenerate() {
            const me = this;

            if (!me.generator) return;

            // 컨설팅 모드 시작 시점의 roomId 캡처
            const targetRoomId = me.currentRoomId;
            me._consultingTargetRoomId = targetRoomId; // 콜백에서 사용하기 위해 저장

            // 로딩 상태를 채팅방별로 관리
            me.loadingStates[targetRoomId] = {
                isLoading: true,
                message: '프로세스를 설계하고 있습니다...'
            };

            // 로딩 메시지 표시
            const loadingMsg = me.createMessageObj('...', 'assistant');
            loadingMsg.isLoading = true;
            me.messages.push(loadingMsg);
            me.scrollToBottom();

            try {
                // AIGenerator는 client의 onModelCreated, onGenerationFinished 메서드를 호출함
                await me.generator.generate();
            } catch (error) {
                console.error('컨설팅 생성 오류:', error);
                if (me.loadingStates[targetRoomId]) {
                    me.loadingStates[targetRoomId].isLoading = false;
                }

                // 로딩 메시지 제거
                if (me.messages.length > 0 && me.messages[me.messages.length - 1].isLoading) {
                    me.messages.pop();
                }

                const errorMsg = me.createMessageObj('죄송합니다. 프로세스 설계 중 오류가 발생했습니다.', 'assistant');
                me.messages.push(errorMsg);
            }
        },

        // AIGenerator에서 호출 - 스트리밍 중 토큰 처리
        onModelCreated(response) {
            const me = this;

            if (me.messages && me.messages.length > 0) {
                const lastMsg = me.messages[me.messages.length - 1];
                if (lastMsg.isLoading) {
                    if (response.content) {
                        lastMsg.content = (lastMsg.content === '...' ? '' : lastMsg.content) + response.content;
                        lastMsg.htmlContent = (lastMsg.htmlContent || '') + response.content.replaceAll('\n', '<br>');
                    }
                }
            }
            me.scrollToBottom();
        },

        // AIGenerator에서 호출 - 생성 완료
        async onGenerationFinished(response, chatRoomId = null) {
            const me = this;
            const targetRoomId = me._consultingTargetRoomId || me.currentRoomId;
            if (me.loadingStates[targetRoomId]) {
                me.loadingStates[targetRoomId].isLoading = false;
            }

            // 로딩 상태 제거
            me.messages.forEach((message) => {
                if (message.role === 'assistant') {
                    delete message.isLoading;
                }
            });

            if (me.messages.length > 0) {
                const lastMsg = me.messages[me.messages.length - 1];
                lastMsg.timeStamp = Date.now();
            }

            // JSON 파싱 시도
            let jsonData = response;
            if (typeof response === 'string') {
                try {
                    if (response.includes('{')) {
                        const jsonMatch = response.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            jsonData = JSON.parse(jsonMatch[0]);
                        }
                    }
                } catch (e) {
                    // JSON 파싱 실패 시 원본 사용
                }
            }

            // afterGenerationFinished 호출
            await me.afterGenerationFinished(jsonData);

            // 컨설팅 1회 실행 종료: 다음 사용자 메시지는 에이전트가 받도록 컨설팅 상태를 정리
            me.isConsultingMode = false;
            me.generator = null;
            me._consultingTargetRoomId = null;

            me.scrollToBottom();
        },

        // AIGenerator에서 호출 - 에러 처리
        async onError(error) {
            const me = this;
            console.error('Generator 에러:', error);
            const targetRoomId = me._consultingTargetRoomId || me.currentRoomId;
            if (me.loadingStates[targetRoomId]) {
                me.loadingStates[targetRoomId].isLoading = false;
            }

            // 로딩 메시지 제거
            if (me.messages.length > 0 && me.messages[me.messages.length - 1].isLoading) {
                me.messages.pop();
            }

            const errorMsg = me.createMessageObj(error.message || '죄송합니다. 프로세스 설계 중 오류가 발생했습니다.', 'assistant');
            me.messages.push(errorMsg);
        },

        // 컨설팅 모드에서 메시지 전송
        async sendConsultingMessage(text) {
            const me = this;

            if (!text.trim() || !me.generator) return;

            // 사용자 메시지 추가
            const userMsgObj = me.createMessageObj(text, 'user');
            me.messages.push(userMsgObj);
            await me.saveMessage(userMsgObj);

            // 대화 내역 업데이트
            me.generator.previousMessages.push({
                role: 'user',
                content: text
            });

            me.lastSendMessage = { text: text };
            await me.startConsultingGenerate();
        },

        // 컨설팅 응답 처리 (Chats.vue의 afterGenerationFinished와 동일)
        async afterGenerationFinished(responseObj) {
            const me = this;

            // 컨설팅 모드 응답 처리
            if (responseObj && (responseObj.answerType || responseObj.validity)) {
                // 컨설팅 응답 메시지 저장
                if (me.messages.length > 0) {
                    const lastMessage = me.messages[me.messages.length - 1];
                    if (lastMessage.role === 'assistant' && !lastMessage.uuid) {
                        lastMessage.uuid = me.uuid();
                    }
                    lastMessage.content = responseObj.content;
                    if (!lastMessage.isLoading) {
                        await me.saveMessage(lastMessage);
                    }
                }

                // 프로세스 생성 모드로 전환
                if (responseObj.answerType === 'generateProcessDef') {
                    // 컨설팅 LLM이 "이미 생성 가능"하다고 판단한 경우에는 생성 화면으로 전환
                    // (generate_process 도구 호출과 동일하게 처리)
                    me.$store.dispatch('updateMessages', me.messages);
                    me.$router.push('/definitions/chat');
                    return;
                }
            }

            // 일반 응답 저장
            if (me.messages.length > 0) {
                const lastMsg = me.messages[me.messages.length - 1];
                if (!lastMsg.uuid) {
                    lastMsg.uuid = me.uuid();
                }
                if (!lastMsg.isLoading) {
                    await me.saveMessage(lastMsg);
                }
            }

            me.scrollToBottom();
        },

        // ===== PDF2BPMN Events Watch =====

        /**
         * roomId 기준으로 PDF2BPMN 진행 상태 객체를 생성/반환
         */
        _getOrInitPdf2bpmnProgress(roomId) {
            if (!roomId) return null;
            if (!this.pdf2bpmnProgressByRoomId[roomId]) {
                this.pdf2bpmnProgressByRoomId[roomId] = {
                    isActive: false,
                    taskId: null,
                    status: '',
                    progress: 0,
                    message: '',
                    generatedBpmns: []
                };
            }
            return this.pdf2bpmnProgressByRoomId[roomId];
        },

        /**
         * 기존 메시지에서 PDF2BPMN 작업 확인 및 구독/표시 (채팅방별)
         */
        async checkExistingPdf2BpmnTask(roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;

            // 최근 메시지부터 역순으로 확인 (현재 로드된 messages는 targetRoomId의 메시지)
            for (let i = me.messages.length - 1; i >= 0; i--) {
                const msg = me.messages[i];

                // 1. 이미 완료된 결과가 있는 경우 - 메시지에 이미 표시됨
                if (msg.pdf2bpmnResult) {
                    console.log('[WorkAssistantChatPanel] Found existing pdf2bpmn result in message (already displayed)');
                    return;
                }

                // 2. toolCalls에서 create_pdf2bpmn_workitem 찾기
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    const pdf2bpmnTool = msg.toolCalls.find((t) => t.name && t.name.includes('create_pdf2bpmn_workitem'));

                    if (pdf2bpmnTool && pdf2bpmnTool.output) {
                        try {
                            const output = this.parseToolOutput(pdf2bpmnTool.output);
                            if (output) {
                                const taskId = output.workitem_id || output.task_id || output.todo_id || output.id;
                                if (taskId) {
                                    console.log(`[WorkAssistantChatPanel] Found existing pdf2bpmn task: ${taskId} (room: ${targetRoomId})`);
                                    await me.checkTaskStatusAndSubscribe(taskId, targetRoomId);
                                    return;
                                }
                            }
                        } catch (e) {
                            console.log('[WorkAssistantChatPanel] Failed to parse existing tool output:', e);
                        }
                    }
                }
            }
        },

        /**
         * 작업 상태 확인 후 진행 중이면 구독 시작
         */
        async checkTaskStatusAndSubscribe(taskId, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;
            if (window.$mode === 'uEngine') return;
            if (!window.$supabase) return;

            try {
                // events 테이블에서 task_completed 이벤트 확인
                const { data: completedEvent, error: eventError } = await window.$supabase
                    .from('events')
                    .select('*')
                    .eq('todo_id', taskId)
                    .eq('event_type', 'task_completed')
                    .single();

                if (completedEvent && !eventError) {
                    // 완료된 작업 - events의 data에서 결과 가져오기
                    console.log('[WorkAssistantChatPanel] Found task_completed event');
                    const resultData = typeof completedEvent.data === 'string' ? JSON.parse(completedEvent.data) : completedEvent.data;
                    await me.showCompletedTaskResult(resultData, targetRoomId);
                    return;
                }

                // task_completed가 없으면 todolist에서 상태 확인
                const { data: todo, error } = await window.$supabase.from('todolist').select('id, status').eq('id', taskId).single();

                if (error) {
                    console.error('[WorkAssistantChatPanel] Error fetching todo status:', error);
                    return;
                }

                console.log(`[WorkAssistantChatPanel] Todo status: ${todo?.status}`);

                if (todo) {
                    // 진행 중인 작업이면 구독 시작
                    if (todo.status === 'IN_PROGRESS' || todo.status === 'PENDING') {
                        me.subscribeToEventsForTask(taskId, targetRoomId);

                        // 기존 events도 로드
                        await me.loadExistingEvents(taskId, targetRoomId);
                    }
                }
            } catch (e) {
                console.error('[WorkAssistantChatPanel] Error checking task status:', e);
            }
        },

        /**
         * 기존 events 로드 (채팅방 재입장 시)
         */
        async loadExistingEvents(taskId, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;
            if (window.$mode === 'uEngine') return;
            if (!window.$supabase) return;

            try {
                const { data: events, error } = await window.$supabase
                    .from('events')
                    .select('*')
                    .eq('todo_id', taskId)
                    .eq('crew_type', 'pdf2bpmn')
                    .order('timestamp', { ascending: true });

                if (error) {
                    console.error('[WorkAssistantChatPanel] Error loading existing events:', error);
                    return;
                }

                if (events && events.length > 0) {
                    console.log(`[WorkAssistantChatPanel] Loaded ${events.length} existing events`);

                    // 각 이벤트 처리 (UI 업데이트)
                    for (const event of events) {
                        me.handlePdf2BpmnEvent(event, targetRoomId);
                    }
                }
            } catch (e) {
                console.error('[WorkAssistantChatPanel] Error in loadExistingEvents:', e);
            }
        },

        /**
         * 완료된 작업 결과 표시 (events에서 가져온 데이터)
         * 메시지에 결과가 없으면 메시지에 추가
         */
        async showCompletedTaskResult(resultData, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;

            try {
                console.log('[WorkAssistantChatPanel] Showing completed result:', resultData);

                if (resultData.saved_processes || resultData.bpmn_xmls) {
                    // generatedBpmns 구성
                    let generatedBpmns = [];

                    // saved_processes에 bpmn_xml이 포함된 경우
                    if (resultData.saved_processes) {
                        for (const proc of resultData.saved_processes) {
                            generatedBpmns.push({
                                process_id: proc.id,
                                process_name: proc.name,
                                bpmn_xml: proc.bpmn_xml || null
                            });
                        }
                    }

                    // 이미 메시지에 결과가 있는지 확인
                    // (현재 로드된 messages는 targetRoomId의 메시지)
                    const hasResult = me.messages.some((m) => m.pdf2bpmnResult);

                    if (!hasResult && generatedBpmns.length > 0) {
                        // 결과 메시지 추가
                        const processCount = resultData.process_count || generatedBpmns.length;
                        let content = `✅ **PDF2BPMN 변환 완료**\n\n`;
                        content += `${processCount}개의 프로세스가 생성되었습니다.`;

                        const msgObj = me.createMessageObj(content, 'assistant');
                        msgObj.pdf2bpmnResult = {
                            processCount: processCount,
                            savedProcesses: resultData.saved_processes || [],
                            generatedBpmns: generatedBpmns,
                            taskId: resultData.task_id || resultData.taskId || resultData.todo_id || resultData.id || '',
                            savedSkills: resultData.saved_skills || resultData.savedSkills || [],
                            savedAgents: resultData.saved_agents || resultData.savedAgents || []
                        };
                        // UI에는 현재 방일 때만 추가, DB에는 항상 저장
                        if (me.currentRoomId === targetRoomId) {
                            me.messages.push(msgObj);
                            me.scrollToBottom();
                        }
                        await me.saveMessageToRoom(msgObj, targetRoomId);

                        console.log('[WorkAssistantChatPanel] Added result message with', generatedBpmns.length, 'BPMNs');
                    }
                }
            } catch (e) {
                console.error('[WorkAssistantChatPanel] Error showing completed result:', e);
            }
        },

        /**
         * todolist에서 최근 pdf2bpmn 작업 감지 후 구독 시작
         */
        async checkAndWatchPdf2BpmnTodo(roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;
            if (window.$mode === 'uEngine') return;
            if (!window.$supabase) return;

            try {
                // 최근 5분 이내 생성된 pdf2bpmn 작업 조회
                const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                const { data, error } = await window.$supabase
                    .from('todolist')
                    .select('id, query, agent_orch, start_date')
                    .eq('agent_orch', 'pdf2bpmn')
                    .gte('start_date', fiveMinAgo)
                    .order('start_date', { ascending: false })
                    .limit(1);

                if (error) {
                    console.error('[WorkAssistantChatPanel] Error fetching pdf2bpmn todo:', error);
                    return;
                }

                if (data && data.length > 0) {
                    const todo = data[0];
                    console.log('[WorkAssistantChatPanel] Found recent pdf2bpmn todo:', todo.id);

                    // 이미 구독 중인지 확인
                    const currentTaskId = me.pdf2bpmnTaskIdByRoomId[targetRoomId];
                    if (currentTaskId !== todo.id) {
                        me.subscribeToEventsForTask(todo.id, targetRoomId);
                    }
                }
            } catch (e) {
                console.error('[WorkAssistantChatPanel] Error in checkAndWatchPdf2BpmnTodo:', e);
            }
        },

        /**
         * 특정 task_id에 대한 events 테이블 watch 시작
         * PDF2BPMN 에이전트의 진행 상황을 실시간으로 받아옴
         */
        subscribeToEventsForTask(taskId, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;

            if (!window.$supabase) {
                console.warn('[WorkAssistantChatPanel] Supabase not available');
                return;
            }

            // 이미 taskId 구독 중이면 재구독하지 않음
            if (me.pdf2bpmnEventsChannelByTaskId[taskId]) {
                console.log(`[WorkAssistantChatPanel] Already subscribed to pdf2bpmn task: ${taskId}`);
                // roomId 매핑만 보정
                me.pdf2bpmnTaskIdByRoomId[targetRoomId] = taskId;
                const progress = me._getOrInitPdf2bpmnProgress(targetRoomId);
                if (progress) progress.taskId = taskId;
                return;
            }

            // 같은 room에 기존 task 구독이 있으면 제거 (room별 1개 작업을 기본 가정)
            const prevTaskId = me.pdf2bpmnTaskIdByRoomId[targetRoomId];
            if (prevTaskId && prevTaskId !== taskId) {
                me.unsubscribePdf2bpmnEventsForTask(prevTaskId);
            }
            me.pdf2bpmnTaskIdByRoomId[targetRoomId] = taskId;

            const progress = me._getOrInitPdf2bpmnProgress(targetRoomId);
            if (progress) {
                progress.isActive = true;
                progress.taskId = taskId;
                progress.status = 'started';
                progress.progress = Math.max(progress.progress || 0, 0);
                progress.message = progress.message || 'PDF2BPMN 작업 시작 대기 중...';
                progress.generatedBpmns = progress.generatedBpmns || [];
            }

            console.log(`[WorkAssistantChatPanel] Subscribing to events for task: ${taskId} in room: ${targetRoomId}`);

            // events 테이블 실시간 구독 (todo_id로 필터링)
            const channel = window.$supabase
                .channel(`pdf2bpmn-events-${taskId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'events',
                        filter: `todo_id=eq.${taskId}`
                    },
                    (payload) => {
                        me.handlePdf2BpmnEvent(payload.new, targetRoomId);
                    }
                )
                .subscribe((status) => {
                    console.log(`[WorkAssistantChatPanel] Events subscription status: ${status}`);
                });

            me.pdf2bpmnEventsChannelByTaskId[taskId] = channel;
        },

        /**
         * 특정 taskId의 events 구독 해제
         */
        unsubscribePdf2bpmnEventsForTask(taskId) {
            try {
                const channel = this.pdf2bpmnEventsChannelByTaskId?.[taskId];
                if (channel && window.$supabase) {
                    window.$supabase.removeChannel(channel);
                }
            } catch (e) {
                // ignore
            } finally {
                if (this.pdf2bpmnEventsChannelByTaskId) {
                    delete this.pdf2bpmnEventsChannelByTaskId[taskId];
                }
            }
        },

        /**
         * PDF2BPMN 전체 구독 해제 (패널 종료 시)
         */
        unsubscribeAllPdf2bpmnEvents() {
            try {
                const map = this.pdf2bpmnEventsChannelByTaskId || {};
                Object.keys(map).forEach((taskId) => this.unsubscribePdf2bpmnEventsForTask(taskId));
            } catch (e) {
                // ignore
            }
        },

        /**
         * PDF2BPMN 이벤트 처리 (browser_use_agent_executor.py와 동일한 패턴)
         */
        handlePdf2BpmnEvent(event, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;
            const progressState = me._getOrInitPdf2bpmnProgress(targetRoomId);
            if (!progressState) return;

            console.log('[WorkAssistantChatPanel] Received PDF2BPMN event:', event);

            try {
                // 이벤트 타입 추출 (event_type 컬럼에서)
                const eventType = event.event_type;
                const crewType = event.crew_type;

                // pdf2bpmn 에이전트의 이벤트만 처리
                if (crewType && crewType !== 'pdf2bpmn') {
                    console.log(`[WorkAssistantChatPanel] Skipping non-pdf2bpmn event: ${crewType}`);
                    return;
                }

                // data 필드에서 메시지 파싱 (data는 jsonb 컬럼)
                let messageData = {};
                try {
                    const dataField = event.data || {};
                    if (typeof dataField === 'string') {
                        messageData = JSON.parse(dataField);
                    } else {
                        messageData = dataField;
                    }
                } catch (e) {
                    messageData = {};
                }

                // data 필드에서 progress 추출
                const progress = messageData.progress || 0;
                const message = messageData.message || '';

                console.log(
                    `[WorkAssistantChatPanel] Event: type=${eventType}, progress=${progress}, message=${message.substring(0, 50)}...`
                );

                // 이벤트 타입별 상태 업데이트
                switch (eventType) {
                    case 'task_started':
                        progressState.isActive = true;
                        progressState.status = 'started';
                        progressState.progress = progress || 5;
                        progressState.message = message || 'PDF2BPMN 작업 시작됨';
                        break;

                    case 'tool_usage_started':
                        progressState.isActive = true;
                        progressState.status = 'processing';
                        progressState.progress = Math.max(progressState.progress, progress || 10);
                        progressState.message = message || '처리 중...';
                        break;

                    case 'tool_usage_finished':
                        progressState.isActive = true;
                        progressState.progress = Math.max(progressState.progress, progress || 80);
                        progressState.message = message || '처리 완료';

                        // bpmn_xml이 있으면 generatedBpmns에 추가
                        if (messageData.bpmn_xml && messageData.process_id) {
                            const existing = progressState.generatedBpmns.find((b) => b.process_id === messageData.process_id);
                            if (!existing) {
                                progressState.generatedBpmns.push({
                                    process_id: messageData.process_id,
                                    process_name: messageData.process_name || 'Unnamed Process',
                                    bpmn_xml: messageData.bpmn_xml
                                });
                                console.log(`[WorkAssistantChatPanel] Added BPMN to list: ${messageData.process_name}`);
                            }
                        }
                        break;

                    case 'task_completed':
                    case 'crew_completed':
                        progressState.isActive = true;
                        progressState.status = 'completed';
                        progressState.progress = 100;
                        progressState.message = message || '변환 완료!';

                        // 완료 메시지를 채팅에 추가
                        me.addPdf2BpmnResultMessage(messageData, targetRoomId);

                        // 잠시 후 진행 상황 패널 숨김
                        setTimeout(() => {
                            const st = me._getOrInitPdf2bpmnProgress(targetRoomId);
                            if (st) st.isActive = false;
                        }, 3000);
                        break;

                    case 'error':
                        progressState.isActive = true;
                        progressState.status = 'failed';
                        progressState.message = messageData.error || message || '작업 실패';

                        // 에러 메시지를 채팅에 추가
                        const errorMsg = me.createMessageObj(`PDF2BPMN 변환 실패: ${messageData.error || '알 수 없는 오류'}`, 'assistant');
                        if (me.currentRoomId === targetRoomId) {
                            me.messages.push(errorMsg);
                        }
                        me.saveMessageToRoom(errorMsg, targetRoomId);
                        break;

                    default:
                        // 기타 이벤트는 진행률 업데이트만
                        if (progress > 0) {
                            progressState.progress = Math.max(progressState.progress, progress);
                        }
                        if (message) {
                            progressState.message = message;
                        }
                }
            } catch (e) {
                console.error('[WorkAssistantChatPanel] Error handling PDF2BPMN event:', e);
            }
        },

        /**
         * PDF2BPMN 아티팩트 이벤트 처리 (TaskArtifactUpdateEvent)
         * 이벤트 채널과 별도로 artifact 이벤트도 처리
         */
        handlePdf2BpmnArtifactEvent(event) {
            const me = this;

            // artifact 필드 확인
            if (!event.artifact) return;

            me.handleBpmnArtifact(event.artifact);

            // lastChunk가 true면 최종 결과
            if (event.lastChunk === true) {
                console.log('[WorkAssistantChatPanel] Received final artifact (lastChunk=true)');
                const progressState = me._getOrInitPdf2bpmnProgress(me.currentRoomId);
                if (progressState) {
                    progressState.isActive = true;
                    progressState.status = 'completed';
                    progressState.progress = 100;
                }
            }
        },

        /**
         * BPMN 아티팩트 처리
         */
        handleBpmnArtifact(artifact) {
            const me = this;

            try {
                const progressState = me._getOrInitPdf2bpmnProgress(me.currentRoomId);
                if (!progressState) return;
                let artifactData = artifact;

                // 문자열인 경우 파싱
                if (typeof artifact === 'string') {
                    try {
                        artifactData = JSON.parse(artifact);
                    } catch (e) {
                        return;
                    }
                }

                // pdf2bpmn_result 타입인 경우 최종 결과 처리
                if (artifactData.type === 'pdf2bpmn_result') {
                    console.log('[WorkAssistantChatPanel] Received final pdf2bpmn_result:', artifactData);

                    // 저장된 프로세스 정보로 결과 메시지 추가
                    if (artifactData.saved_processes && artifactData.saved_processes.length > 0) {
                        // generatedBpmns가 비어있으면 saved_processes로 대체
                        if (progressState.generatedBpmns.length === 0) {
                            progressState.generatedBpmns = artifactData.saved_processes.map((proc) => ({
                                process_id: proc.id,
                                process_name: proc.name,
                                bpmn_xml: null, // XML은 별도로 가져와야 함
                                generated_at: artifactData.completed_at
                            }));
                        }
                    }

                    progressState.isActive = true;
                    progressState.status = 'completed';
                    progressState.progress = 100;
                    return;
                }

                // parts 배열에서 text 추출 (SDK 형식)
                if (artifactData.parts && Array.isArray(artifactData.parts)) {
                    for (const part of artifactData.parts) {
                        if (part.type === 'text' && part.text) {
                            try {
                                const bpmnData = JSON.parse(part.text);
                                if (bpmnData.type === 'bpmn' && bpmnData.bpmn_xml) {
                                    // 중복 체크
                                    const exists = progressState.generatedBpmns.some((b) => b.process_id === bpmnData.process_id);
                                    if (!exists) {
                                        progressState.generatedBpmns.push({
                                            process_id: bpmnData.process_id,
                                            process_name: bpmnData.process_name,
                                            bpmn_xml: bpmnData.bpmn_xml,
                                            generated_at: bpmnData.generated_at
                                        });
                                        console.log(`[WorkAssistantChatPanel] Added BPMN: ${bpmnData.process_name}`);
                                    }
                                } else if (bpmnData.type === 'pdf2bpmn_result') {
                                    // 내부에 pdf2bpmn_result가 있는 경우 재귀 처리
                                    me.handleBpmnArtifact(bpmnData);
                                }
                            } catch (e) {
                                // 파싱 실패 무시
                            }
                        }
                    }
                }

                // 직접 bpmn_xml이 있는 경우
                if (artifactData.bpmn_xml) {
                    const progressState = me._getOrInitPdf2bpmnProgress(me.currentRoomId);
                    if (!progressState) return;
                    // 중복 체크
                    const exists = progressState.generatedBpmns.some((b) => b.process_id === artifactData.process_id);
                    if (!exists) {
                        progressState.generatedBpmns.push({
                            process_id: artifactData.process_id,
                            process_name: artifactData.process_name,
                            bpmn_xml: artifactData.bpmn_xml,
                            generated_at: artifactData.generated_at
                        });
                    }
                }
            } catch (e) {
                console.error('[WorkAssistantChatPanel] Error handling BPMN artifact:', e);
            }
        },

        /**
         * PDF2BPMN 결과 메시지 추가
         */
        async addPdf2BpmnResultMessage(resultData, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;
            if (!targetRoomId) return;
            const progressState = me._getOrInitPdf2bpmnProgress(targetRoomId);
            if (!progressState) return;

            const processCount = resultData.process_count || progressState.generatedBpmns.length;
            const savedProcesses = resultData.saved_processes || [];

            let content = `✅ **PDF2BPMN 변환 완료**\n\n`;
            content += `${processCount}개의 프로세스가 생성되었습니다.\n\n`;

            if (savedProcesses.length > 0) {
                content += `**생성된 프로세스:**\n`;
                savedProcesses.forEach((proc, idx) => {
                    content += `${idx + 1}. ${proc.name} (ID: ${proc.id})\n`;
                });
            } else if (progressState.generatedBpmns.length > 0) {
                content += `**생성된 프로세스:**\n`;
                progressState.generatedBpmns.forEach((bpmn, idx) => {
                    content += `${idx + 1}. ${bpmn.process_name}\n`;
                });
            }

            content += `\n프로세스 정의가 저장되었습니다. 왼쪽 메뉴에서 확인할 수 있습니다.`;

            const msgObj = me.createMessageObj(content, 'assistant');
            msgObj.pdf2bpmnResult = {
                processCount: processCount,
                savedProcesses: savedProcesses,
                generatedBpmns: progressState.generatedBpmns,
                taskId: resultData.task_id || resultData.taskId || resultData.todo_id || resultData.id || '',
                savedSkills: resultData.saved_skills || resultData.savedSkills || [],
                savedAgents: resultData.saved_agents || resultData.savedAgents || []
            };

            // UI에는 현재 방일 때만 추가, DB에는 항상 저장
            if (me.currentRoomId === targetRoomId) {
                me.messages.push(msgObj);
                me.scrollToBottom();
            }
            await me.saveMessageToRoom(msgObj, targetRoomId);

            // 정의 목록 새로고침 이벤트
            me.EventBus.emit('definitions-updated');
        },

        /**
         * BPMN 미리보기 표시
         */
        async showBpmnPreview(bpmn) {
            const me = this;

            // bpmn_xml / definition이 없으면 DB에서 로드
            if ((!bpmn.bpmn_xml || !bpmn.definition) && bpmn.process_id) {
                try {
                    console.log(`[WorkAssistantChatPanel] Loading BPMN XML for: ${bpmn.process_id}`);

                    const { data, error } = await window.$supabase
                        .from('proc_def')
                        .select('bpmn, definition')
                        .eq('id', bpmn.process_id)
                        .single();

                    if (error) {
                        console.error('[WorkAssistantChatPanel] Error loading BPMN:', error);
                    } else if (data) {
                        if (data.bpmn) {
                            bpmn.bpmn_xml = data.bpmn;
                            console.log(`[WorkAssistantChatPanel] Loaded BPMN XML, length: ${data.bpmn.length}`);
                        }
                        if (data.definition) {
                            bpmn.definition = data.definition;
                        }
                    }
                } catch (e) {
                    console.error('[WorkAssistantChatPanel] Error in showBpmnPreview:', e);
                }
            }

            me.selectedBpmn = bpmn;
            me.bpmnPreviewDialog = true;
        },

        /**
         * 이미지 미리보기 (새 탭에서 열기)
         */
        openImagePreview(imageUrl) {
            if (!imageUrl) return;
            this.previewImageUrl = imageUrl;
            this.imagePreviewDialog = true;
        },

        /**
         * 외부 URL 열기 (PDF 등)
         */
        openExternalUrl(url) {
            if (!url) return;
            window.open(url, '_blank');
        },

        /**
         * BPMN XML 클립보드 복사
         */
        async copyBpmnToClipboard() {
            if (this.selectedBpmn?.bpmn_xml) {
                try {
                    await navigator.clipboard.writeText(this.selectedBpmn.bpmn_xml);
                    this.$try({
                        context: this,
                        action: () => {},
                        successMsg: 'BPMN XML이 클립보드에 복사되었습니다.'
                    });
                } catch (e) {
                    console.error('클립보드 복사 실패:', e);
                }
            }
        },

        /**
         * 진행 상태에 따른 칩 색상 반환
         */
        getProgressChipColor(status) {
            const colors = {
                started: 'blue',
                processing: 'orange',
                generating: 'purple',
                saving: 'teal',
                completed: 'success',
                failed: 'error'
            };
            return colors[status] || 'primary';
        },

        /**
         * 모델러에서 열기
         */
        openInModeler() {
            if (this.selectedBpmn && this.selectedBpmn.process_id) {
                // 현재 접속 주소 기반 모델러 URL
                const modelerUrl = `${window.location.origin}/definitions/${this.selectedBpmn.process_id}?edit=true`;
                window.open(modelerUrl, '_blank');
                this.bpmnPreviewDialog = false;
            }
        },

        /**
         * 응답에서 PDF2BPMN 작업 감지 및 watch 시작
         */
        checkAndSubscribePdf2Bpmn(responseText, toolCalls, roomId) {
            const me = this;
            const targetRoomId = roomId || me.currentRoomId;

            console.log('[WorkAssistantChatPanel] checkAndSubscribePdf2Bpmn called');
            console.log('[WorkAssistantChatPanel] toolCalls:', JSON.stringify(toolCalls, null, 2));
            console.log('[WorkAssistantChatPanel] responseText preview:', responseText?.substring(0, 500));

            // 도구 호출에서 create_pdf2bpmn_workitem 찾기
            if (toolCalls && toolCalls.length > 0) {
                const pdf2bpmnTool = toolCalls.find(
                    (t) => t.name && (t.name.includes('create_pdf2bpmn_workitem') || t.name.includes('pdf2bpmn'))
                );

                console.log('[WorkAssistantChatPanel] pdf2bpmnTool found:', pdf2bpmnTool);

                if (pdf2bpmnTool) {
                    // output 필드에서 결과 추출
                    const outputStr = pdf2bpmnTool.output || pdf2bpmnTool.result || pdf2bpmnTool.content;
                    console.log('[WorkAssistantChatPanel] tool output:', outputStr);

                    if (outputStr) {
                        try {
                            const output = me.parseToolOutput(outputStr);
                            console.log('[WorkAssistantChatPanel] parsed output:', output);

                            // workitem_id 추출
                            if (output) {
                                const taskId = output.workitem_id || output.task_id || output.todo_id || output.id;
                                if (taskId) {
                                    console.log(`[WorkAssistantChatPanel] Detected PDF2BPMN task: ${taskId}`);
                                    me.subscribeToEventsForTask(taskId, targetRoomId);
                                    return true;
                                }
                            }
                        } catch (e) {
                            console.log('[WorkAssistantChatPanel] Failed to parse tool output:', e);
                        }
                    }
                }
            }

            // 응답 텍스트에서 PDF2BPMN 작업 ID 찾기 (여러 패턴 시도)
            if (responseText) {
                // 다양한 패턴 시도
                const patterns = [
                    /workitem_id["\s:]+["']?([a-f0-9-]{36})["']?/i,
                    /task_id["\s:]+["']?([a-f0-9-]{36})["']?/i,
                    /todo_id["\s:]+["']?([a-f0-9-]{36})["']?/i,
                    /"id"\s*:\s*"([a-f0-9-]{36})"/i,
                    /워크아이템.*?([a-f0-9-]{36})/i,
                    /PDF2BPMN.*?([a-f0-9-]{36})/i
                ];

                for (const pattern of patterns) {
                    const match = responseText.match(pattern);
                    if (match) {
                        const taskId = match[1];
                        console.log(`[WorkAssistantChatPanel] Detected PDF2BPMN task from response pattern: ${taskId}`);
                        me.subscribeToEventsForTask(taskId, targetRoomId);
                        return true;
                    }
                }
            }

            // MCP 응답에서 감지 못함 - todolist에서 직접 확인
            console.log('[WorkAssistantChatPanel] No PDF2BPMN task detected from response, checking todolist...');

            // PDF 업로드 관련 키워드가 있으면 todolist 확인
            if (
                responseText &&
                (responseText.includes('PDF') ||
                    responseText.includes('pdf2bpmn') ||
                    responseText.includes('BPMN') ||
                    responseText.includes('워크아이템') ||
                    responseText.includes('변환'))
            ) {
                // 약간의 지연 후 todolist 확인 (DB 저장 시간 고려)
                setTimeout(() => {
                    me.checkAndWatchPdf2BpmnTodo(targetRoomId);
                }, 1000);
            }

            return false;
        },

        // ===== 음성 인식 =====

        // 음성 인식 시작
        async startVoiceRecording() {
            this.isMicRecording = true;
            if (!navigator.mediaDevices) {
                alert('getUserMedia를 지원하지 않는 브라우저입니다.');
                this.isMicRecording = false;
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.micRecorder = new MediaRecorder(stream);
                this.micAudioChunks = [];
                this.micRecorder.ondataavailable = (e) => {
                    this.micAudioChunks.push(e.data);
                };
                this.micRecorder.start();
            } catch (error) {
                console.error('마이크 접근 오류:', error);
                this.isMicRecording = false;
            }
        },

        // 음성 인식 중지
        stopVoiceRecording() {
            this.isMicRecording = false;
            if (this.micRecorder && this.micRecorder.state === 'recording') {
                this.micRecorder.stop();
                this.micRecorder.onstop = async () => {
                    const audioBlob = new Blob(this.micAudioChunks, { type: 'audio/wav' });
                    await this.uploadAudio(audioBlob);
                };
            }
        },

        // 음성 파일 업로드 및 텍스트 변환
        async uploadAudio(audioBlob) {
            this.isMicRecorderLoading = true;
            const formData = new FormData();
            formData.append('audio', audioBlob);
            try {
                const response = await fetch('/completion/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.transcript) {
                    this.inputText = data.transcript;
                }
            } catch (error) {
                console.error('음성 인식 오류:', error);
            } finally {
                this.isMicRecorderLoading = false;
            }
        },
        /**
         * 에이전트 스트림 중지 (현재 채팅방 또는 특정 채팅방)
         */
        stopAgent(roomId) {
            if (!roomId) return;
            const controller = this.agentAbortControllers[roomId];
            const state = this.loadingStates[roomId];
            if (!controller || !state?.isLoading) return;

            // 사용자 요청에 의한 중지임을 표시 (onAbort에서 메시지 남김)
            this.agentAbortRequested[roomId] = true;
            controller.abort();
        },

        /**
         * 패널 종료 시 진행 중인 모든 스트림 중지
         * (사용자 중지 메시지는 남기지 않음)
         */
        abortAllAgentStreams() {
            try {
                const controllers = this.agentAbortControllers || {};
                Object.keys(controllers).forEach((roomId) => {
                    try {
                        delete this.agentAbortRequested[roomId];
                        controllers[roomId]?.abort?.();
                    } catch (e) {
                        // ignore
                    }
                });
                this.agentAbortControllers = {};
            } catch (e) {
                // ignore
            }
        }
    }
};
</script>

<style scoped>
.work-assistant-chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f8fafc;
}

/* 채팅방 탭 */
.chat-tabs-container {
    display: flex;
    align-items: center;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 12px;
    gap: 8px;
}

.chat-tabs {
    display: flex;
    gap: 4px;
    flex: 1;
    overflow-x: auto;
}

.chat-tab {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background: #f1f5f9;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
    font-size: 13px;
    color: #64748b;
}

.chat-tab:hover {
    background: #e2e8f0;
}

.chat-tab.active {
    background: rgb(var(--v-theme-primary));
    color: white;
}

.chat-tab .tab-title {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.chat-tab .tab-close {
    margin-left: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.chat-tab:hover .tab-close {
    opacity: 1;
}

.new-chat-btn {
    flex-shrink: 0;
}

/* 채팅 메시지 영역 */
.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
}

.message-item {
    display: flex;
    gap: 12px;
}

.message-avatar {
    flex-shrink: 0;
}

.message-content {
    flex: 1;
    min-width: 0;
}

.message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.message-sender {
    font-weight: 600;
    font-size: 13px;
    color: #1e293b;
}

.message-time {
    font-size: 11px;
    color: #94a3b8;
}

.message-text {
    font-size: 14px;
    line-height: 1.6;
    color: #334155;
    word-break: break-word;
}

.message-text :deep(.message-link) {
    color: #3b82f6;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
}

.message-text :deep(.message-link:hover) {
    color: #1d4ed8;
}

.message-text :deep(.json-block),
.message-text :deep(.code-block) {
    background: #1e293b;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 8px;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    overflow-x: auto;
    margin: 8px 0;
}

.tool-calls {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.tool-call-item {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    background: rgba(var(--v-theme-primary), 0.1);
    border-radius: 4px;
    font-size: 11px;
    color: rgb(var(--v-theme-primary));
}

.loading-indicator {
    display: flex;
    align-items: center;
    color: #64748b;
    font-size: 13px;
}

/* 입력 영역 */
.chat-input-container {
    padding: 8px 16px 12px;
    background: white;
    border-top: 1px solid #e2e8f0;
}

/* Chat 컴포넌트 내부 스타일 오버라이드 (패널 모드) */
.chat-input-container :deep(.v-card) {
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
}

.chat-input-container :deep(.v-textarea) {
    font-size: 14px;
}

.chat-input-container :deep(.message-input-box) {
    min-height: 40px;
}

.chat-input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 8px;
}

.chat-input {
    flex: 1;
}

.chat-input :deep(.v-field) {
    border-radius: 12px;
}

.send-btn {
    flex-shrink: 0;
    margin-bottom: 2px;
}

.mic-btn {
    flex-shrink: 0;
    margin-right: 4px;
}

/* PDF2BPMN 진행 상황 */
.pdf2bpmn-progress-container {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    margin: 0 16px 12px 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.pdf2bpmn-progress-header {
    display: flex;
    align-items: center;
}

.progress-title {
    font-weight: 600;
    font-size: 14px;
    color: #1e293b;
}

.progress-message {
    min-height: 18px;
}

.generated-bpmns {
    border-top: 1px solid #e2e8f0;
    padding-top: 12px;
}

.bpmn-list-header {
    display: flex;
    align-items: center;
    color: #64748b;
    font-weight: 500;
}

.bpmn-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.bpmn-item:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    transform: translateX(2px);
}

.bpmn-name {
    flex: 1;
    font-size: 13px;
    color: #334155;
    font-weight: 500;
}

.preview-btn {
    opacity: 0;
    transition: opacity 0.2s ease;
}

.bpmn-item:hover .preview-btn {
    opacity: 1;
}

/* 메시지 하단 BPMN 결과 */
.pdf2bpmn-result-container {
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    border: 1px solid #86efac;
    border-radius: 12px;
    padding: 16px;
}

.result-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
}

.result-title {
    font-weight: 600;
    font-size: 14px;
    color: #166534;
}

.bpmn-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
}

.bpmn-card {
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.bpmn-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    transform: translateY(-2px);
}

.bpmn-card-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
}

.bpmn-card-content {
    flex: 1;
    min-width: 0;
}

.bpmn-card-title {
    font-weight: 600;
    font-size: 13px;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bpmn-card-subtitle {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bpmn-card-action {
    opacity: 0;
    transition: opacity 0.2s ease;
}

.bpmn-card:hover .bpmn-card-action {
    opacity: 1;
}

/* 진행상황 카드 (메시지 내부) */
.pdf2bpmn-progress-card {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #93c5fd;
    border-radius: 12px;
    padding: 16px;
    margin-top: 8px;
}

.progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
}

.progress-info .progress-message {
    color: #475569;
    flex: 1;
}

.progress-info .progress-percent {
    color: #3b82f6;
    font-weight: 600;
    margin-left: 12px;
}

.generated-bpmns-scroll {
    border-top: 1px solid #bfdbfe;
    padding-top: 12px;
}

.bpmn-list-title {
    display: flex;
    align-items: center;
    color: #1e40af;
    font-weight: 600;
    font-size: 12px;
    margin-bottom: 10px;
}

.bpmn-cards-scroll {
    max-height: 200px;
    overflow-y: auto;
    padding-right: 4px;
}

.bpmn-cards-scroll::-webkit-scrollbar {
    width: 4px;
}

.bpmn-cards-scroll::-webkit-scrollbar-track {
    background: #e0e7ff;
    border-radius: 2px;
}

.bpmn-cards-scroll::-webkit-scrollbar-thumb {
    background: #93c5fd;
    border-radius: 2px;
}

.bpmn-card-mini {
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.bpmn-card-mini:hover {
    background: #f8fafc;
    border-color: #3b82f6;
    transform: translateX(4px);
}

.bpmn-card-mini:last-child {
    margin-bottom: 0;
}

.bpmn-card-mini-icon {
    margin-right: 10px;
    flex-shrink: 0;
}

.bpmn-card-mini-content {
    flex: 1;
    min-width: 0;
}

.bpmn-card-mini-title {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* BPMN 미리보기 */
.bpmn-view-toggle .bpmn-toggle-btn {
    min-width: 40px !important;
    width: 40px !important;
    height: 36px !important;
}

.bpmn-diagram-container {
    height: 450px;
    background: #f8fafc;
    position: relative;
}

.bpmn-preview-container {
    height: 450px;
    overflow: auto;
    background: #1e293b;
}

.bpmn-ontology-container {
    height: 450px;
    background: #0b1220;
}

.bpmn-xml-content {
    padding: 16px;
    margin: 0;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #e2e8f0;
    white-space: pre-wrap;
    word-break: break-all;
}

/* 첨부된 이미지 */
.attached-images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.attached-image-item {
    position: relative;
}

.attached-image {
    max-width: 200px;
    max-height: 150px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.attached-image:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 첨부된 PDF */
.attached-pdf {
    display: inline-block;
}
</style>
