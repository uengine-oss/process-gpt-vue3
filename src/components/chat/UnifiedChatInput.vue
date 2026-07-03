<template>
    <div class="main-chat-input-container" :class="containerVariantClass">
        <!-- 예시 문구들 (메인/시스템 채팅에서만 사용) -->
        <div v-if="showExamples" class="example-prompts">
            <div v-for="(example, index) in examples" :key="index" class="example-chip" @click="selectExample(example)">
                <v-icon size="16" class="mr-1">{{ example.icon }}</v-icon>
                <span>{{ example.text }}</span>
            </div>
        </div>

        <!-- 지식 베이스 선택 칩 (입력창 위) -->
        <div v-if="enableKnowledgeBase && selectedKnowledgeDocs.length > 0" class="knowledge-chip-row">
            <v-chip
                v-for="doc in selectedKnowledgeDocs"
                :key="doc.id"
                color="primary"
                variant="tonal"
                size="small"
                closable
                @click:close="removeKnowledgeDoc(doc.id)"
                @click="openKnowledgePicker"
                class="knowledge-chip"
            >
                <v-icon size="14" start :color="mimeIcon(doc.mimeType).color">{{ mimeIcon(doc.mimeType).icon }}</v-icon>
                {{ doc.name }}
            </v-chip>
        </div>

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
                    <!-- 폴더 통째 업로드(webkitdirectory) — 허용 확장자 파일만 첨부됨. -->
                    <v-btn
                        @click="uploadFolder"
                        class="ml-2 text-medium-emphasis knowledge-tool-btn"
                        variant="outlined"
                        rounded="pill"
                        prepend-icon="mdi-folder-upload-outline"
                    >
                        <span class="knowledge-tool-btn__label">폴더 업로드</span>
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
import { mimeIcon } from '@/utils/fileIcon';

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
        examples() {
            return [
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
            ];
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
        mimeIcon,
        openKnowledgePicker() {
            this.knowledgePickerOpen = true;
        },
        handleKnowledgeConfirm(docs) {
            this.internalKnowledgeDocs = docs;
            this.$emit('update:knowledgeDocs', docs);
        },
        removeKnowledgeDoc(id) {
            const next = this.selectedKnowledgeDocs.filter((d) => d.id !== id);
            this.internalKnowledgeDocs = next;
            this.$emit('update:knowledgeDocs', next);
        },
        handleWrapperDrop(e) {
            this.isDragOver = false;
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            this.$refs.inputChat?.changeImage({ target: { files } });
        },
        // 폴더 통째 업로드 — Chat 의 webkitdirectory input 을 연다(허용 확장자만 changeImage 에서 필터).
        uploadFolder() {
            try {
                this.$refs.inputChat?.uploadFolder?.();
            } catch (e) {}
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
        selectExample(example) {
            if (!example) return;
            let orchestration = 'langchain-react';
            try {
                const o = this.$refs.inputChat?.orchestration;
                if ((o || '').toString().trim() === 'deepagents') orchestration = 'deepagents';
            } catch (e) {}
            this.$emit('sendMessage', {
                text: example.text,
                timestamp: new Date().toISOString(),
                file: null,
                images: null,
                orchestration
            });
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
                orchestration:
                    (message?.orchestration || '').toString().trim() === 'deepagents' ? 'deepagents' : 'langchain-react',
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

/* 지식 베이스 선택 칩 (textarea 위) */
.knowledge-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px 6px;
}

.knowledge-chip {
    max-width: 240px;
}

.knowledge-chip :deep(.v-chip__content) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
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

    .example-prompts {
        gap: 6px;
        margin-bottom: 8px;
    }

    .example-chip {
        padding: 6px 10px;
        font-size: 12px;
    }
}
</style>
