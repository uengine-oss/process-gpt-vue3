<template>
    <div class="main-chat-input-container" :class="containerVariantClass">
        <!-- 지식베이스 사용 흐름 안내 (처음 쓰는 사람용) — 메인 채팅에서만 -->
        <div v-if="showExamples && enableKnowledgeBase" class="kb-guide">
            <v-icon size="16" class="kb-guide__bulb" color="primary">mdi-lightbulb-on-outline</v-icon>
            <span>{{ $t('mainChat.kbGuide') }}</span>
        </div>

        <!-- 지식 베이스 선택 표시는 입력 툴바의 "지식 베이스" 버튼 배지(개수) + 피커 재오픈으로 대체.
             폴더 통째 선택 시 칩이 수십 개 쏟아지는 문제로 입력창 위 칩 줄은 제거함. -->

        <!-- 입력 필드 - Chat 컴포넌트 사용 -->
        <div
            class="input-wrapper"
            :class="{ 'drag-over-highlight': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop.prevent.stop="handleWrapperDrop"
        >
            <Chat
                ref="inputChat"
                :workAssistantAgentMode="true"
                :inputOnly="variant === 'inline'"
                :disableChat="disableChat"
                :showStopButton="showStopButton"
                :deferFileUploadToParent="deferFileUploadToParent"
                :isMobile="false"
                :userList="userList"
                :currentChatRoom="currentChatRoom"
                :desktopVoiceActive="desktopVoiceActive"
                :enableDesktopVoice="enableDesktopVoice"
                @sendMessage="forwardSendMessage"
                @stopMessage="$emit('stopMessage')"
                @recording-mode-change="(v) => $emit('recording-mode-change', v)"
                @desktop-voice-toggle="$emit('desktop-voice-toggle')"
            >
                <template v-if="enableKnowledgeBase" v-slot:custom-input-tools>
                    <v-btn
                        @click="openKnowledgePicker"
                        class="ml-2 text-medium-emphasis knowledge-tool-btn"
                        :class="{ 'has-selected': selectedKnowledgeDocs.length > 0 }"
                        variant="outlined"
                        rounded="pill"
                        prepend-icon="mdi-bookshelf"
                    >
                        <span class="knowledge-tool-btn__label">지식 베이스</span>
                        <span v-if="selectedKnowledgeDocs.length > 0" class="knowledge-tool-btn__count">
                            {{ selectedKnowledgeDocs.length }}
                        </span>
                    </v-btn>
                </template>
            </Chat>
        </div>

        <KnowledgeSpacePicker
            v-if="enableKnowledgeBase"
            v-model="knowledgePickerOpen"
            :initiallySelectedIds="selectedKnowledgeIds"
            @confirm="handleKnowledgeConfirm"
        />
    </div>
</template>

<script>
import Chat from '@/components/ui/Chat.vue';
import KnowledgeSpacePicker from '@/components/knowledge/KnowledgeSpacePicker.vue';

export default {
    name: 'UnifiedChatInput',
    components: { Chat, KnowledgeSpacePicker },
    props: {
        /**
         * - panel: 기존 메인/definition-map 스타일(파란 톤 배경 + 패딩/테두리)
         * - inline: 채팅방 내부에 "핏"하게 들어가는 미니멀 스타일
         */
        variant: {
            type: String,
            default: 'panel'
        },
        showExamples: {
            type: Boolean,
            default: false
        },
        disableChat: {
            type: Boolean,
            default: false
        },
        showStopButton: {
            type: Boolean,
            default: false
        },
        // true면 Chat.vue에서 파일 업로드를 기다리지 않고 부모로 전송
        deferFileUploadToParent: {
            type: Boolean,
            default: false
        },
        // 멘션 자동완성 및 프로필 매칭에 사용
        userList: {
            type: Array,
            default: () => []
        },
        // 멘션 후보를 현재 채팅방 참여자로 제한하기 위해 필요
        currentChatRoom: {
            type: Object,
            default: null
        },
        // 데스크탑 음성 에이전트 활성화 여부 (버튼 하이라이트용)
        desktopVoiceActive: {
            type: Boolean,
            default: false
        },
        // 말하기/듣기 버튼 노출 여부 (1:1 에이전트 대화일 때만 true)
        enableDesktopVoice: {
            type: Boolean,
            default: false
        },
        // 지식 베이스(Google Drive) 피커 활성화
        enableKnowledgeBase: {
            type: Boolean,
            default: false
        },
        // 외부에서 주입된 선택된 문서 (아티팩트 패널과 동기화)
        knowledgeDocs: {
            type: Array,
            default: () => []
        }
    },
    emits: [
        'sendMessage',
        'recording-mode-change',
        'stopMessage',
        'desktop-voice-toggle',
        'update:knowledgeDocs'
    ],
    computed: {
        containerVariantClass() {
            return this.variant === 'inline' ? 'main-chat-input-container--inline' : 'main-chat-input-container--panel';
        },
        selectedKnowledgeDocs() {
            return this.knowledgeDocs && this.knowledgeDocs.length > 0 ? this.knowledgeDocs : this.internalKnowledgeDocs;
        },
        selectedKnowledgeIds() {
            return this.selectedKnowledgeDocs.map((d) => d.id);
        }
    },
    data() {
        return {
            isDragOver: false,
            knowledgePickerOpen: false,
            internalKnowledgeDocs: []
        };
    },
    methods: {
        openKnowledgePicker() {
            this.knowledgePickerOpen = true;
        },
        handleKnowledgeConfirm(docs) {
            this.internalKnowledgeDocs = docs;
            this.$emit('update:knowledgeDocs', docs);
        },
        handleWrapperDrop(e) {
            this.isDragOver = false;
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            this.$refs.inputChat?.changeImage({ target: { files } });
        },
        // ChatRoomPage(메시지 리스트)에서 reply 클릭 시, 입력창(Chat)의 reply UI를 사용하기 위한 브릿지
        setReply(message) {
            try {
                this.$refs.inputChat?.beforeReply?.(message);
            } catch (e) {}
        },
        clearReply() {
            try {
                this.$refs.inputChat?.cancelReply?.();
            } catch (e) {}
        },
        forwardSendMessage(message) {
            const messageFiles = Array.isArray(message?.files) ? message.files : Array.isArray(message?.file) ? message.file : [];
            const hasFiles = messageFiles.length > 0;
            const hasRawFiles = Array.isArray(message?.rawFiles) && message.rawFiles.length > 0;
            if (!message || (!message.text && !message.file && !hasFiles && !hasRawFiles && (!message.images || message.images.length === 0))) return;
            this.$emit('sendMessage', {
                text: (message.text || '').trim(),
                timestamp: new Date().toISOString(),
                file: message.file || null,
                files: hasFiles ? messageFiles : null,
                rawFiles: hasRawFiles ? message.rawFiles : null,
                images: message.images || null,
                // orchestration pass-through (Chat.vue -> MainChatInput/ChatRoomPage)
                // 기본 에이전트 미사용: 명시적 langchain-react 가 아니면 항상 딥 에이전트로 고정
                orchestration:
                    (message?.orchestration || '').toString().trim() === 'langchain-react' ? 'langchain-react' : 'deepagents',
                // mention 메타데이터 pass-through (Chat.vue -> ChatRoomPage 라우팅)
                mentionedUsers: Array.isArray(message.mentionedUsers) ? message.mentionedUsers : [],
                // reply 메타데이터 pass-through (Chat.vue -> ChatRoomPage)
                reply: message.reply || null,
                // 지식 베이스에서 선택된 문서 (RAG 컨텍스트로 사용)
                knowledgeDocs: this.selectedKnowledgeDocs
            });
        }
    }
};
</script>

<style scoped>
.main-chat-input-container {
    width: 100%;
    padding: 16px;
    border-radius: 16px;
}

.main-chat-input-container--panel {
    background-color: rgba(var(--v-theme-primary), 0.1);
}

.main-chat-input-container--inline {
    padding: 0;
    border: none;
    border-radius: 0;
    background-color: transparent;
}

/* 예시 문구들 */
/* 지식베이스 사용 흐름 안내 (첫 사용자용) */
.kb-guide {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    padding: 8px 12px;
    background: rgba(var(--v-theme-primary), 0.06);
    border: 1px solid rgba(var(--v-theme-primary), 0.18);
    border-radius: 10px;
    font-size: 12.5px;
    line-height: 1.45;
    color: rgba(0, 0, 0, 0.72);
}

.kb-guide__bulb {
    flex: 0 0 auto;
}

/* 입력 툴바의 지식 베이스 버튼 (Chat custom-input-tools 슬롯) */
.knowledge-tool-btn {
    border-color: #e0e0e0 !important;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
    font-size: 13px;
    height: 36px !important;
    padding: 0 14px !important;
}

.knowledge-tool-btn :deep(.v-btn__prepend) {
    margin-inline-end: 6px;
}

.knowledge-tool-btn :deep(.v-icon) {
    font-size: 18px !important;
}

.knowledge-tool-btn.has-selected {
    border-color: rgba(var(--v-theme-primary), 0.5) !important;
    color: rgb(var(--v-theme-primary)) !important;
    background: rgba(var(--v-theme-primary), 0.05);
}

.knowledge-tool-btn.has-selected :deep(.v-icon) {
    color: rgb(var(--v-theme-primary));
}

.knowledge-tool-btn__label {
    margin-left: 2px;
}

.knowledge-tool-btn__count {
    margin-left: 6px;
    background: rgb(var(--v-theme-primary));
    color: #fff;
    border-radius: 8px;
    min-width: 18px;
    height: 16px;
    padding: 0 6px;
    font-size: 10px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* 입력 필드 */
.input-wrapper {
    width: 100%;
    position: relative;
}

.input-wrapper.drag-over-highlight::before {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px dashed rgb(var(--v-theme-primary));
    border-radius: 12px;
    background-color: rgba(var(--v-theme-primary), 0.06);
    z-index: 10000;
    pointer-events: none;
}

@media (max-width: 768px) {
    .main-chat-input-container {
        padding: 0px;
    }
}
</style>
