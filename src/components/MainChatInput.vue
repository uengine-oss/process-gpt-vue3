<template>
    <div class="main-chat-input-container">
        <!-- 예시 문구들 + 히스토리 버튼 -->
        <div class="example-prompts">
            <div 
                v-for="(example, index) in examples" 
                :key="index"
                class="example-chip"
                @click="selectExample(example)"
            >
                <v-icon size="16" class="mr-1">{{ example.icon }}</v-icon>
                <span>{{ example.text }}</span>
            </div>
            
            <!-- 히스토리 버튼 -->
            <v-menu 
                v-model="showHistory" 
                :close-on-content-click="false"
                location="bottom end"
            >
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon
                        variant="text"
                        size="small"
                        class="history-btn"
                        :class="{ 'active': showHistory }"
                    >
                        <v-icon>mdi-history</v-icon>
                    </v-btn>
                </template>
                
                <!-- 히스토리 드롭다운 -->
                <v-card class="history-dropdown" min-width="320" max-width="380">
                    <v-card-title class="history-dropdown-title pa-3 pb-2">
                        <v-icon size="18" class="mr-2">mdi-chat-outline</v-icon>
                        <span>{{ $t('mainChat.history.title') }}</span>
                    </v-card-title>
                    <v-divider></v-divider>
                    
                    <div v-if="isLoadingHistory" class="history-loading pa-4">
                        <v-progress-circular indeterminate size="20" color="primary"></v-progress-circular>
                        <span class="ml-2">{{ $t('mainChat.history.loading') }}</span>
                    </div>
                    
                    <div v-else-if="chatHistory.length === 0" class="history-empty pa-4 text-center">
                        <v-icon size="40" color="grey-lighten-1">mdi-chat-outline</v-icon>
                        <p class="text-caption text-grey mt-2 mb-0">{{ $t('mainChat.history.empty') }}</p>
                    </div>
                    
                    <div v-else class="history-list-container">
                        <v-list density="compact" class="pa-0">
                            <v-list-item
                                v-for="room in displayedHistory"
                                :key="room.id"
                                @click="openHistoryItem(room)"
                                class="history-list-item"
                            >
                                <template v-slot:prepend>
                                    <v-avatar size="36" color="grey-lighten-3">
                                        <v-icon size="20" color="primary">mdi-robot-outline</v-icon>
                                    </v-avatar>
                                </template>
                                <v-list-item-title class="history-item-title">
                                    {{ room.name || '새 대화' }}
                                </v-list-item-title>
                                <v-list-item-subtitle class="history-item-subtitle">
                                    {{ truncateMessage(room.message?.msg) }}
                                </v-list-item-subtitle>
                                <template v-slot:append>
                                    <span class="history-item-date text-caption text-grey">
                                        {{ formatDate(room.message?.createdAt) }}
                                    </span>
                                </template>
                            </v-list-item>
                        </v-list>
                        
                        <!-- 더보기 버튼 -->
                        <div v-if="hasMoreHistory" class="more-history-container">
                            <v-divider></v-divider>
                            <v-btn
                                variant="text"
                                color="primary"
                                block
                                size="small"
                                class="more-history-btn"
                                @click="showAllHistory"
                            >
                                <v-icon size="16" class="mr-1">mdi-chevron-down</v-icon>
                                {{ $t('mainChat.history.showMore') || '더보기' }} ({{ remainingCount }}개)
                            </v-btn>
                        </div>
                    </div>
                </v-card>
            </v-menu>
        </div>

        <!-- 입력 필드 - Chat 컴포넌트 사용 -->
        <div class="input-wrapper">
            <Chat 
                :workAssistantAgentMode="true"
                :disableChat="isUploading"
                :isMobile="false"
                @sendMessage="handleChatMessage"
                @recording-mode-change="handleRecordingModeChange"
            />
        </div>
        <!-- NOTE: 이미지 첨부/미리보기는 workAssistantAgentMode 모드에서 Chat.vue가 전담 -->
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import Chat from '@/components/ui/Chat.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'MainChatInput',
    components: {
        Chat
    },
    props: {
        agentInfo: {
            type: Object,
            default: null
        },
        userId: {
            type: String,
            default: null
        }
    },
    data() {
        return {
            inputText: '',
            isFocused: false,
            showHistory: false,
            isLoadingHistory: false,
            chatHistory: [],
            totalHistoryCount: 0,
            displayLimit: 10,
            showAll: false,
            userInfo: null,
            isUploading: false,
            // 음성 인식 관련
            isMicRecording: false,
            micRecorder: null,
            micAudioChunks: [],
            isMicRecorderLoading: false,
            recordingMode: false,
            // NOTE: 이미지 첨부는 Chat.vue가 전담
            examples: [
                {
                    icon: 'mdi-plus-circle-outline',
                    text: this.$t('mainChat.examples.createProcess'),
                    type: 'create'
                },
                {
                    icon: 'mdi-play-circle-outline',
                    text: this.$t('mainChat.examples.executeProcess'),
                    type: 'execute'
                },
                {
                    icon: 'mdi-magnify',
                    text: this.$t('mainChat.examples.checkResult'),
                    type: 'query'
                },
                {
                    icon: 'mdi-help-circle-outline',
                    text: this.$t('mainChat.examples.askQuestion'),
                    type: 'question'
                }
            ]
        };
    },
    computed: {
        textareaRows() {
            if (!this.inputText) return 1;
            const lineCount = (this.inputText.match(/\n/g) || []).length + 1;
            return Math.min(Math.max(lineCount, 1), 7);
        },
        displayedHistory() {
            if (this.showAll) {
                return this.chatHistory;
            }
            return this.chatHistory.slice(0, this.displayLimit);
        },
        hasMoreHistory() {
            return !this.showAll && this.chatHistory.length > this.displayLimit;
        },
        remainingCount() {
            return this.chatHistory.length - this.displayLimit;
        }
    },
    watch: {
        showHistory(val) {
            if (val) {
                this.showAll = false;
                this.loadHistory();
            }
        }
    },
    async mounted() {
        // 사용자 정보 로드
        this.userInfo = await backend.getUserInfo();
    },
    methods: {
        selectExample(example) {
            // 예시 선택 시 Chat 컴포넌트로 메시지 전달하여 바로 전송
            this.$emit('submit', {
                text: example.text,
                timestamp: new Date().toISOString(),
                file: null,
                images: null
            });
        },
        // Chat 컴포넌트에서 메시지 전송 시 처리
        async handleChatMessage(message) {
            console.log('[MainChatInput] handleChatMessage 받음:', message);
            // Chat은 "입력 UI 트리거"로만 사용하고,
            // 실제 전송/업로드/첨부 구조는 기존 MainChatInput 로직(handleSubmit)로 유지
            if (!message || (!message.text && !message.file && (!message.images || message.images.length === 0))) return;
            this.inputText = (message.text || '').trim();

            const submitPayload = {
                text: this.inputText,
                timestamp: new Date().toISOString(),
                file: message.file || null,
                images: message.images || null
            };
            console.log('[MainChatInput] submit emit:', submitPayload);
            this.$emit('submit', submitPayload);

            this.inputText = '';
        },
        // 음성 대화 모드 변경 처리
        handleRecordingModeChange(isRecording) {
            this.recordingMode = isRecording;
            this.$emit('recording-mode-change', isRecording);
        },
        // NOTE: PDF 업로드/선택/미리보기는 Chat.vue로 일원화 (중복 제거)
        handleBlur() {
            this.isFocused = false;
        },
        
        // 이미지 선택 창 열기
        // NOTE: 이미지 관련 트리거/처리는 Chat.vue가 전담
        // 헤드셋(음성 대화) 모드 토글
        toggleRecordingMode() {
            this.recordingMode = !this.recordingMode;
            this.$emit('recording-mode-change', this.recordingMode);
        },
        async loadHistory() {
            if (!this.userInfo) {
                this.userInfo = await backend.getUserInfo();
            }
            
            this.isLoadingHistory = true;
            try {
                // chat_rooms 테이블에서 채팅방 목록 조회
                const rooms = await backend.getChatRoomList('chat_rooms');
                
                if (rooms && rooms.length > 0) {
                    // 내가 참여 중이고, System과의 1:1 채팅방만 필터링
                    const myRooms = rooms.filter(room => {
                        if (!room.participants || room.participants.length !== 2) return false;
                        
                        const hasSystem = room.participants.some(p => 
                            p.id === 'system_id' || p.email === 'system@uengine.org'
                        );
                        const hasMe = room.participants.some(p => 
                            p.email === this.userInfo.email
                        );
                        
                        return hasSystem && hasMe;
                    });
                    
                    // message.createdAt 기준 최신순 정렬
                    this.chatHistory = myRooms.sort((a, b) => {
                        const timeA = a.message?.createdAt || 0;
                        const timeB = b.message?.createdAt || 0;
                        return timeB - timeA;
                    });
                    
                    this.totalHistoryCount = this.chatHistory.length;
                } else {
                    this.chatHistory = [];
                    this.totalHistoryCount = 0;
                }
            } catch (error) {
                console.error('히스토리 로드 오류:', error);
                this.chatHistory = [];
                this.totalHistoryCount = 0;
            } finally {
                this.isLoadingHistory = false;
            }
        },
        showAllHistory() {
            this.showAll = true;
        },
        openHistoryItem(room) {
            this.showHistory = false;
            this.$emit('open-history', room);
        },
        truncateMessage(msg) {
            if (!msg) return '';
            if (msg === 'NEW') return '새 대화';
            const maxLength = 30;
            return msg.length > maxLength ? msg.substring(0, maxLength) + '...' : msg;
        },
        formatDate(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            // 1분 미만
            if (diff < 60 * 1000) {
                return '방금';
            }
            // 1시간 미만
            if (diff < 60 * 60 * 1000) {
                const minutes = Math.floor(diff / (60 * 1000));
                return `${minutes}분 전`;
            }
            // 24시간 미만
            if (diff < 24 * 60 * 60 * 1000) {
                return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            }
            // 7일 미만
            if (diff < 7 * 24 * 60 * 60 * 1000) {
                const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                return `${days}일 전`;
            }
            // 그 외
            return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        },
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
                this.micRecorder.ondataavailable = e => {
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
        }
    }
};
</script>

<style scoped>
.main-chat-input-container {
    width: 100%;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    background-color: rgba(var(--v-theme-primary), 0.1);
}

/* 히스토리 버튼 */
.history-btn {
    margin-left: auto;
    color: #64748b;
    transition: all 0.2s ease;
    position: relative;
}

.history-btn:hover,
.history-btn.active {
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.1);
}

.history-badge {
    font-size: 10px;
}

/* 히스토리 드롭다운 */
.history-dropdown {
    max-height: 450px;
    overflow: hidden;
}

.history-dropdown-title {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
}

.history-loading,
.history-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
    min-height: 100px;
}

.history-list-container {
    max-height: 350px;
    overflow-y: auto;
}

.history-list-item {
    cursor: pointer;
    border-bottom: 1px solid #f1f5f9;
    padding: 12px 16px !important;
}

.history-list-item:last-child {
    border-bottom: none;
}

.history-list-item:hover {
    background: #f8fafc;
}

.history-item-title {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.history-item-subtitle {
    font-size: 12px;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
}

.history-item-date {
    font-size: 11px;
    white-space: nowrap;
    color: #94a3b8;
}

.more-history-container {
    position: sticky;
    bottom: 0;
    background: white;
}

.more-history-btn {
    text-transform: none;
    font-size: 13px;
}

/* 예시 문구들 */
.example-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
}

.example-chip {
    display: flex;
    align-items: center;
    padding: 8px 14px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    font-size: 13px;
    color: #808080;
    cursor: pointer;
    white-space: nowrap;
}

.example-chip:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #808080;
}

/* 입력 필드 */
.input-wrapper {
    width: 100%;
}

.input-field-container {
    display: flex;
    align-items: flex-start;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 8px 8px 8px 16px;
    transition: all 0.2s ease;
}

.input-field-container:focus-within {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.1);
}

.input-icon {
    flex-shrink: 0;
    margin-right: 12px;
    margin-top: 10px;
}

.main-input-textarea {
    flex: 1;
    font-size: 15px;
    color: #1e293b;
    background: transparent;
}

.main-input-textarea :deep(.v-input__control) {
    min-height: unset !important;
}

.main-input-textarea :deep(.v-field) {
    padding: 0 !important;
    min-height: unset !important;
}

.main-input-textarea :deep(.v-field__field) {
    min-height: unset !important;
}

.main-input-textarea :deep(.v-field__input) {
    padding: 8px 0 !important;
    min-height: 24px !important;
    font-size: 15px;
    overflow: hidden !important;
}

.main-input-textarea :deep(textarea) {
    min-height: 24px !important;
    line-height: 1.5 !important;
}

.main-input-textarea :deep(textarea::placeholder) {
    color: #94a3b8;
}

.send-btn {
    flex-shrink: 0;
    margin-left: 8px;
    align-self: flex-end;
    margin-bottom: 2px;
}

.mic-btn {
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 2px;
}

/* 파일 첨부 버튼 */
.attach-btn {
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 2px;
}

/* 헤드셋 버튼 */
.headset-btn {
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 2px;
}

/* 첨부 메뉴 */
.attach-menu-list {
    min-width: 160px;
}

/* 첨부된 이미지 미리보기 */
.attached-images-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
}

.attached-image-item {
    position: relative;
    width: 64px;
    height: 64px;
}

.attached-image-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.remove-image-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px !important;
    height: 20px !important;
    min-width: 20px !important;
}

/* 선택된 PDF 파일 표시 */
.selected-file-container {
    margin-bottom: 12px;
}

.selected-file-chip {
    display: inline-flex;
    align-items: center;
    padding: 8px 12px;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #93c5fd;
    border-radius: 8px;
    font-size: 13px;
    color: #475569;
}

.file-name {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.remove-file-btn {
    margin-left: 4px;
    color: #475569 !important;
}

/* 모바일 반응형 */
@media (max-width: 768px) {
    .main-chat-input-container {
        padding: 12px;
    }
    
    .card-header {
        margin-bottom: 12px;
        padding-bottom: 10px;
    }
    
    .header-title {
        font-size: 14px;
    }
    
    .example-prompts {
        gap: 6px;
    }
    
    .example-chip {
        padding: 6px 10px;
        font-size: 12px;
    }
    
    .main-input {
        font-size: 14px;
    }
}
</style>
