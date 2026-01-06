<template>
    <div class="work-assistant-chat-panel">
        <!-- 채팅방 탭 -->
        <div class="chat-tabs-container">
            <div class="chat-tabs">
                <div 
                    v-for="room in chatRooms" 
                    :key="room.id"
                    class="chat-tab"
                    :class="{ 'active': currentRoomId === room.id }"
                    @click="selectRoom(room)"
                >
                    <v-icon size="16" class="mr-1">mdi-message-text-outline</v-icon>
                    <span class="tab-title">{{ room.name || '새 대화' }}</span>
                    <v-btn
                        v-if="chatRooms.length > 1"
                        icon
                        variant="text"
                        size="x-small"
                        class="tab-close"
                        @click.stop="deleteRoom(room.id)"
                    >
                        <v-icon size="14">mdi-close</v-icon>
                    </v-btn>
                </div>
            </div>
            <v-btn
                icon
                variant="text"
                size="small"
                class="new-chat-btn"
                @click="createNewRoom"
            >
                <v-icon>mdi-plus</v-icon>
            </v-btn>
        </div>

        <!-- 채팅 내역 -->
        <div class="chat-messages" ref="messagesContainer">
            <!-- 히스토리 로딩 중 -->
            <div v-if="isLoadingHistory" class="empty-chat">
                <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
                <p class="mt-2 text-grey">대화 내역을 불러오는 중...</p>
            </div>
            <!-- 메시지 없음 -->
            <div v-else-if="messages.length === 0" class="empty-chat">
                <v-icon size="48" color="grey-lighten-1">mdi-robot-outline</v-icon>
                <p class="mt-2 text-grey">무엇을 도와드릴까요?</p>
            </div>
            
            <div 
                v-for="(msg, index) in messages" 
                :key="msg.uuid || index"
                class="message-item"
                :class="{ 'user-message': msg.role === 'user', 'assistant-message': msg.role === 'assistant' || msg.role === 'system' }"
            >
                <div class="message-avatar">
                    <v-avatar size="32" :color="msg.role === 'user' ? 'primary' : 'grey-lighten-2'">
                        <v-icon size="18" :color="msg.role === 'user' ? 'white' : 'grey-darken-1'">
                            {{ msg.role === 'user' ? 'mdi-account' : 'mdi-robot-outline' }}
                        </v-icon>
                    </v-avatar>
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">{{ msg.role === 'user' ? '나' : 'AI 어시스턴트' }}</span>
                        <span class="message-time">{{ formatTime(msg.timeStamp) }}</span>
                    </div>
                    <div class="message-text" v-html="formatMessage(msg.content)"></div>
                    
                    <!-- 도구 호출 표시 -->
                    <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="tool-calls">
                        <div v-for="(tool, idx) in msg.toolCalls" :key="idx" class="tool-call-item">
                            <v-icon size="14" color="primary" class="mr-1">mdi-wrench</v-icon>
                            <span class="tool-name">{{ formatToolName(tool.name) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 로딩 표시 -->
            <div v-if="isLoading" class="message-item assistant-message">
                <div class="message-avatar">
                    <v-avatar size="32" color="grey-lighten-2">
                        <v-icon size="18" color="grey-darken-1">mdi-robot-outline</v-icon>
                    </v-avatar>
                </div>
                <div class="message-content">
                    <div class="loading-indicator">
                        <v-progress-circular indeterminate size="16" width="2" color="primary"></v-progress-circular>
                        <span class="ml-2">{{ loadingMessage }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 입력 영역 -->
        <div class="chat-input-container">
            <div class="chat-input-wrapper">
                <v-textarea
                    v-model="inputText"
                    :placeholder="$t('mainChat.placeholder')"
                    rows="1"
                    auto-grow
                    max-rows="4"
                    hide-details
                    variant="outlined"
                    density="compact"
                    class="chat-input"
                    @keydown.enter.exact.prevent="sendMessage"
                    :disabled="isLoading"
                />
                <v-btn
                    icon
                    color="primary"
                    size="small"
                    :disabled="!inputText.trim() || isLoading"
                    @click="sendMessage"
                    class="send-btn"
                >
                    <v-icon>mdi-send</v-icon>
                </v-btn>
            </div>
        </div>
    </div>
</template>

<script>
import workAssistantAgentService from '@/services/WorkAssistantAgentService.js';
import BackendFactory from '@/components/api/BackendFactory';
import ConsultingGenerator from '@/components/ai/ProcessConsultingGenerator.js';

const backend = BackendFactory.createBackend();

export default {
    name: 'WorkAssistantChatPanel',
    props: {
        initialMessage: {
            type: String,
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
            isLoading: false,
            isLoadingHistory: true,
            loadingMessage: '생각 중...',
            streamingContent: '',
            // ConsultingGenerator 관련
            generator: null,
            isConsultingMode: false,
            lastSendMessage: null,
            // 중복 처리 방지 플래그
            initialMessageHandled: false
        };
    },
    computed: {
        tenantId() {
            return window.$tenantName || 'uengine';
        },
        currentRoom() {
            return this.chatRooms.find(r => r.id === this.currentRoomId);
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
            this.initialMessageHandled = true;
            await this.handleInitialMessage(this.initialMessage);
        }
    },
    beforeUnmount() {
        // 패널이 닫힐 때 채팅방 선택 해제 알림 (알림 활성화)
        if (this.currentRoomId) {
            this.EventBus.emit('chat-room-unselected');
        }
    },
    methods: {
        // UUID 생성
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        // 채팅방 목록 로드
        async loadChatRooms() {
            try {
                const rooms = await backend.getChatRoomList('chat_rooms');
                if (rooms && rooms.length > 0) {
                    // 현재 사용자가 참가한 채팅방만 필터링 (System 참가자가 있는 것)
                    this.chatRooms = rooms.filter(room => {
                        const hasSystem = room.participants?.some(p => p.id === 'system_id' || p.email === 'system@uengine.org');
                        const hasUser = room.participants?.some(p => p.email === this.userInfo.email);
                        return hasSystem && hasUser && room.participants.length === 2;
                    }).sort((a, b) => new Date(b.message?.createdAt || 0) - new Date(a.message?.createdAt || 0));
                    
                    // 자동 선택은 하지 않음 (initialMessage나 openHistoryRoom에서 처리)
                }
            } catch (error) {
                console.error('채팅방 로드 오류:', error);
            }
        },

        // 채팅방 선택
        async selectRoom(room) {
            this.currentRoomId = room.id;
            // App.vue에 현재 채팅방 알림 (알림 중복 방지용)
            this.EventBus.emit('chat-room-selected', room.id);
            await this.loadMessages(room.id);
        },

        // 메시지 로드 (ChatModule과 동일한 방식)
        async loadMessages(roomId) {
            try {
                this.isLoadingHistory = true;
                this.messages = [];
                
                const messages = await backend.getMessages(roomId);
                if (messages && messages.length > 0) {
                    const allMessages = messages.map(message => {
                        const newMessage = message.messages;
                        newMessage.thread_id = message.thread_id || null;
                        newMessage.uuid = message.uuid;
                        return newMessage;
                    });
                    allMessages.sort((a, b) => new Date(a.timeStamp) - new Date(b.timeStamp));
                    this.messages = allMessages;
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
                name: initialMessage ? this.truncateText(initialMessage, 20) : '새 대화',
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
            this.messages = [];

            return room;
        },

        // 채팅방 삭제
        async deleteRoom(roomId) {
            try {
                await backend.delete(`chats/${roomId}`, { key: 'id' });
                await backend.delete(`chat_rooms/${roomId}`, { key: 'id' });
                
                this.chatRooms = this.chatRooms.filter(r => r.id !== roomId);
                
                if (this.currentRoomId === roomId) {
                    if (this.chatRooms.length > 0) {
                        await this.selectRoom(this.chatRooms[0]);
                    } else {
                        this.currentRoomId = null;
                        this.messages = [];
                    }
                }
            } catch (error) {
                console.error('채팅방 삭제 오류:', error);
            }
        },

        // 초기 메시지 처리
        async handleInitialMessage(message) {
            // 새 채팅방 생성
            const room = await this.createNewRoom(message);
            
            // 메시지 전송
            this.inputText = message;
            await this.sendMessage();
        },

        // 히스토리에서 선택된 채팅방 열기
        async openHistoryChatRoom(room) {
            // 채팅방 목록에 없으면 추가
            if (!this.chatRooms.find(r => r.id === room.id)) {
                this.chatRooms.unshift(room);
            }
            
            // 채팅방 선택 및 메시지 로드
            await this.selectRoom(room);
        },

        // 메시지 전송
        async sendMessage() {
            if (!this.inputText.trim() || this.isLoading) return;

            const userMessage = this.inputText.trim();
            this.inputText = '';
            
            // 컨설팅 모드인 경우 컨설팅 메시지 전송
            if (this.isConsultingMode && this.generator) {
                await this.sendConsultingMessage(userMessage);
                return;
            }

            // 채팅방이 없으면 메시지 전송 불가
            if (!this.currentRoomId) {
                console.error('채팅방이 없습니다.');
                return;
            }

            // 사용자 메시지 추가
            const userMsgObj = this.createMessageObj(userMessage, 'user');
            this.messages.push(userMsgObj);
            await this.saveMessage(userMsgObj);
            
            // API 호출
            this.isLoading = true;
            this.loadingMessage = '생각 중...';

            this.scrollToBottom();
            
            try {
                // 스트리밍 응답 처리
                let fullResponse = '';
                const toolCalls = [];
                
                // Supabase 세션에서 JWT 가져오기
                const session = await window.$supabase?.auth?.getSession();
                const userJwt = session?.data?.session?.access_token || '';
                
                await workAssistantAgentService.sendMessageStream(
                    {
                        message: userMessage,
                        tenant_id: this.tenantId,
                        user_uid: this.userInfo.uid || this.userInfo.id,
                        user_email: this.userInfo.email,
                        user_name: this.userInfo.name || this.userInfo.username,
                        user_jwt: userJwt
                    },
                    {
                        onToken: (token) => {
                            fullResponse += token;
                            // 스트리밍 중 표시 업데이트
                            this.loadingMessage = fullResponse.length > 50 
                                ? fullResponse.substring(0, 50) + '...' 
                                : fullResponse || '생각 중...';
                        },
                        onToolStart: (toolName, input) => {
                            toolCalls.push({ name: toolName, input });
                            this.loadingMessage = `🔧 ${this.formatToolName(toolName)} 실행 중...`;
                        },
                        onToolEnd: (output) => {
                            // 도구 완료 처리
                        },
                        onDone: async (content) => {
                            this.isLoading = false;
                            
                            // AI 응답 메시지 추가
                            const assistantMsgObj = this.createMessageObj(content, 'assistant');
                            assistantMsgObj.toolCalls = toolCalls;
                            this.messages.push(assistantMsgObj);
                            await this.saveMessage(assistantMsgObj);
                            
                            // 채팅방 이름 업데이트 (첫 메시지인 경우)
                            if (this.messages.length <= 2 && this.currentRoom) {
                                this.currentRoom.name = this.truncateText(userMessage, 20);
                                await this.putObject('chat_rooms', this.currentRoom);
                            }
                            
                            // 응답 파싱 및 이벤트 발생
                            const parsed = workAssistantAgentService.parseAgentResponse(content);
                            if (parsed) {
                                // 프로세스 생성 요청인 경우 컨설팅 모드로 전환
                                if (parsed.action === 'process_created' || 
                                    (parsed.user_request_type === 'generate_process')) {
                                    await this.switchToConsultingMode(parsed.data?.user_message || userMessage);
                                    return;
                                }
                                
                                this.$emit('response-parsed', parsed);
                            }
                            
                            this.scrollToBottom();
                        },
                        onError: (error) => {
                            this.isLoading = false;
                            console.error('에이전트 오류:', error);
                            
                            // 오류 메시지 추가
                            const errorMsgObj = this.createMessageObj(
                                '죄송합니다. 요청 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
                                'assistant'
                            );
                            this.messages.push(errorMsgObj);
                        }
                    }
                );
            } catch (error) {
                this.isLoading = false;
                console.error('메시지 전송 오류:', error);
            }
        },

        // 메시지 객체 생성
        createMessageObj(content, role) {
            return {
                uuid: this.uuid(),
                content: content,
                role: role,
                name: role === 'user' ? (this.userInfo.name || this.userInfo.username) : 'AI 어시스턴트',
                email: role === 'user' ? this.userInfo.email : 'system@uengine.org',
                timeStamp: Date.now()
            };
        },

        // 메시지 저장
        async saveMessage(msg) {
            const messageData = {
                uuid: msg.uuid,
                id: this.currentRoomId,
                messages: msg
            };
            await this.putObject(`chats/${msg.uuid}`, messageData);
            
            // 채팅방 마지막 메시지 업데이트
            if (this.currentRoom) {
                this.currentRoom.message = {
                    msg: typeof msg.content === 'string' ? msg.content.substring(0, 50) : 'New message',
                    type: 'text',
                    createdAt: msg.timeStamp
                };
                await this.putObject('chat_rooms', this.currentRoom);
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
            
            // 줄바꿈 처리
            formatted = formatted.replace(/\n/g, '<br>');
            
            return formatted;
        },

        // 도구 이름 포맷팅
        formatToolName(name) {
            if (!name) return '';
            // work-assistant__get_process_list -> 프로세스 목록 조회
            const toolNameMap = {
                'get_process_list': '프로세스 목록 조회',
                'get_process_detail': '프로세스 상세 조회',
                'get_form_fields': '폼 필드 조회',
                'execute_process': '프로세스 실행',
                'get_instance_list': '인스턴스 목록 조회',
                'get_todolist': '할일 목록 조회',
                'get_organization': '조직도 조회',
                'generate_process': '프로세스 생성'
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
            this.$nextTick(() => {
                const container = this.$refs.messagesContainer;
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            });
        },

        // 컨설팅 모드로 전환 (프로세스 생성용)
        async switchToConsultingMode(userMessage) {
            const me = this;
            
            // ConsultingGenerator 초기화
            me.generator = new ConsultingGenerator(me, {
                isStream: true,
                preferredLanguage: "Korean"
            });
            me.isConsultingMode = true;
            
            // 마지막 시스템 메시지 제거 (work-assistant-agent의 응답)
            if (me.messages.length > 0 && me.messages[me.messages.length - 1].role !== 'user') {
                me.messages.pop();
            }
            
            // 전체 대화 내역을 previousMessages에 추가
            let chatMsgs = [];
            if (me.messages && me.messages.length > 0) {
                me.messages.forEach((msg) => {
                    if (msg.content && !msg.isLoading) {
                        chatMsgs.push({
                            role: msg.role,
                            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                        });
                    }
                });
            }
            me.generator.previousMessages = [me.generator.previousMessages[0], ...chatMsgs];
            
            // 컨설팅 시작
            me.lastSendMessage = { text: userMessage };
            await me.startConsultingGenerate();
        },

        // 컨설팅 생성 시작
        async startConsultingGenerate() {
            const me = this;
            
            if (!me.generator) return;
            
            me.isLoading = true;
            me.loadingMessage = '프로세스를 설계하고 있습니다...';
            
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
                me.isLoading = false;
                
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
            me.isLoading = false;
            
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
            
            me.scrollToBottom();
        },

        // AIGenerator에서 호출 - 에러 처리
        async onError(error) {
            const me = this;
            console.error('Generator 에러:', error);
            me.isLoading = false;
            
            // 로딩 메시지 제거
            if (me.messages.length > 0 && me.messages[me.messages.length - 1].isLoading) {
                me.messages.pop();
            }
            
            const errorMsg = me.createMessageObj(
                error.message || '죄송합니다. 프로세스 설계 중 오류가 발생했습니다.',
                'assistant'
            );
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
                    // 현재까지의 대화 내용을 store에 저장
                    me.$store.dispatch('updateMessages', me.messages);
                    
                    // /definitions/chat로 이동
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
    padding: 12px 16px;
    background: white;
    border-top: 1px solid #e2e8f0;
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
</style>

