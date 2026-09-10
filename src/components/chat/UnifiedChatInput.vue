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
                :disableChat="disableChat || folderUploading"
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
                        :class="{ 'has-selected': knowledgeSelectionCount > 0 }"
                        variant="outlined"
                        rounded="pill"
                        prepend-icon="mdi-bookshelf"
                    >
                        <span class="knowledge-tool-btn__label">지식 베이스</span>
                        <span v-if="knowledgeSelectionCount > 0" class="knowledge-tool-btn__count">
                            {{ knowledgeSelectionCount }}
                        </span>
                    </v-btn>
                    <!-- 폴더 통째 업로드(webkitdirectory).
                         codex: 원본 그대로 대화 워크스페이스로. 그 외: 허용 확장자만 지식 첨부로. -->
                    <v-btn
                        @click="uploadFolder"
                        class="ml-2 text-medium-emphasis knowledge-tool-btn"
                        :class="{ 'has-selected': folderBadgeCount > 0 }"
                        :loading="folderUploading"
                        variant="outlined"
                        rounded="pill"
                        prepend-icon="mdi-folder-upload-outline"
                    >
                        <span class="knowledge-tool-btn__label">폴더 업로드</span>
                        <span v-if="folderBadgeCount > 0" class="knowledge-tool-btn__count">
                            {{ folderBadgeCount }}
                        </span>
                    </v-btn>
                </template>
            </Chat>
            <!-- codex 전용 폴더 입력. Chat 의 것과 달리 accept 제한이 없다 —
                 원본 그대로 올리는 게 목적이라 확장자로 거르지 않는다. -->
            <input ref="codexFolderInput" type="file" class="d-none" webkitdirectory directory multiple @change="onCodexFolderPicked" />
        </div>

        <!-- 대기/진행/결과 (codex 원본 폴더) -->
        <div v-if="folderBadgeCount > 0 || folderUploading" class="codex-folder-status">
            <v-icon size="14" class="mr-1" color="primary">mdi-folder-open-outline</v-icon>
            <template v-if="folderUploading">
                폴더 올리는 중 <strong>{{ folderProgress.sent }}</strong> / {{ folderProgress.total }} — 다 올라간 뒤에 답변이 시작됩니다
            </template>
            <template v-else-if="pendingFolderCount > 0">
                <strong>{{ pendingFolderName || '폴더' }}</strong>
                ({{ pendingFolderCount }}개) 준비됨 — 메시지를 보내면 이 대화로 함께 올라갑니다
            </template>
            <template v-else>
                이 대화에 폴더 <strong>{{ codexFolderFileCount }}</strong
                >개 파일이 올라가 있습니다 — codex가 직접 열어봅니다
            </template>
        </div>

        <KnowledgeSpacePicker
            v-if="enableKnowledgeBase"
            v-model="knowledgePickerOpen"
            :initiallySelectedIds="selectedKnowledgeIds"
            :initiallySelectedDocs="selectedKnowledgeDocs"
            :initiallySelectedFolders="selectedKnowledgeFolders"
            @confirm="handleKnowledgeConfirm"
        />
    </div>
</template>

<script>
import Chat from '@/components/ui/Chat.vue';
import KnowledgeSpacePicker from '@/components/knowledge/KnowledgeSpacePicker.vue';
import { mimeIcon } from '@/utils/fileIcon';
import { useKnowledgeSelectionStore } from '@/stores/knowledgeSelection';
import { normalizeOrchestration } from '@/utils/orchestration';
import codexSessionFolderService from '@/services/CodexSessionFolderService';
import { getTenantId } from '@/utils/tenant';
import { useCodexFolderStore } from '@/stores/codexFolder';

export default {
    name: 'UnifiedChatInput',
    components: { Chat, KnowledgeSpacePicker },
    // 지식 선택은 전역 스토어가 단일 소스 — props/emit 복사본을 두지 않는다.
    setup() {
        return {
            knowledgeStore: useKnowledgeSelectionStore(),
            // 메인에서 고른 폴더를 새 방으로 이월하는 대기소
            folderStore: useCodexFolderStore()
        };
    },
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
        }
    },
    emits: ['sendMessage', 'recording-mode-change', 'stopMessage', 'desktop-voice-toggle'],
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
        // 아래 3개는 피커 바인딩용 — 전역 스토어를 그대로 참조(복사본 없음)
        selectedKnowledgeDocs() {
            return this.knowledgeStore.docs;
        },
        selectedKnowledgeIds() {
            return this.knowledgeStore.docIds;
        },
        selectedKnowledgeFolders() {
            return this.knowledgeStore.folders;
        },
        // 버튼 배지 — 폴더 + 파일 (폴더-only 면 docs 가 비어도 폴더로 카운트)
        knowledgeSelectionCount() {
            return this.knowledgeStore.count;
        },
        // 이 대화에 이미 올라가 있는 원본 폴더의 파일 수
        codexFolderFileCount() {
            const summary = this.folderSummary;
            if (!summary || !summary.present) return 0;
            return Number(summary.files) || 0;
        },
        // 메인에서 골랐지만 아직 방이 없어 대기 중인 파일 수
        pendingFolderCount() {
            return this.folderStore.pendingCount;
        },
        pendingFolderName() {
            return this.folderStore.pendingName;
        },
        // 버튼 배지 — 올라간 것이 있으면 그것, 없으면 대기 중인 것
        folderBadgeCount() {
            return this.codexFolderFileCount || this.pendingFolderCount;
        },
        // codex 는 폴더를 전처리 없이 원본으로 받는다 — 업로드 경로가 갈린다.
        isCodexOrchestration() {
            try {
                return (this.$refs.inputChat?.orchestration || '').toString().trim() === 'codex';
            } catch (e) {
                return false;
            }
        }
    },
    data() {
        return {
            isDragOver: false,
            knowledgePickerOpen: false,
            // codex 원본 폴더 업로드 상태
            folderUploading: false,
            folderProgress: { sent: 0, total: 0 },
            folderSummary: null
        };
    },
    watch: {
        // 방을 열거나 바꾸면 그 방에 이미 올라가 있는 폴더를 반영한다.
        // (새로고침해도 표시가 남아야 한다 — 폴더는 대화 워크스페이스에 계속 있으므로)
        'currentChatRoom.id': {
            immediate: true,
            handler(roomId) {
                // 메인에서 고른 폴더가 대기 중이면 방이 생긴 지금 올린다(이월).
                if (roomId && this.folderStore.hasPending) {
                    this.flushPendingFolder(roomId);
                    return;
                }
                this.refreshFolderSummary();
            }
        }
    },
    methods: {
        mimeIcon,
        /** 메인에서 골라 대기시켜 둔 폴더를 이 방으로 올린다. */
        async flushPendingFolder(conversationId) {
            const files = this.folderStore.takePending();
            if (!files.length) return;
            await this.sendFolder(files, conversationId);
        },
        async refreshFolderSummary() {
            const conversationId = this.currentChatRoom?.id || '';
            if (!conversationId) {
                this.folderSummary = null;
                return;
            }
            try {
                this.folderSummary = await codexSessionFolderService.describe(getTenantId(), conversationId);
            } catch (e) {
                this.folderSummary = null;
            }
        },
        openKnowledgePicker() {
            this.knowledgePickerOpen = true;
        },
        handleKnowledgeConfirm(docs, folders) {
            // 단일 소스에 기록 — 방/화면 배선 없이 전역 반영
            this.knowledgeStore.setSelection(docs, folders);
        },
        removeKnowledgeDoc(id) {
            this.knowledgeStore.setSelection(
                this.knowledgeStore.docs.filter((d) => d.id !== id),
                this.knowledgeStore.folders
            );
        },
        handleWrapperDrop(e) {
            this.isDragOver = false;
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            this.$refs.inputChat?.changeImage({ target: { files } });
        },
        // 폴더 통째 업로드.
        // codex: 원본 그대로 대화 워크스페이스로 (전처리 없음 — 에이전트가 셸로 뒤진다).
        // 그 외: 기존 경로 — Chat 의 webkitdirectory input → 허용 확장자만 지식 첨부로.
        uploadFolder() {
            try {
                if (this.isCodexOrchestration) {
                    const input = this.$refs.codexFolderInput;
                    if (!input) return;
                    input.value = '';
                    input.click();
                    return;
                }
                this.$refs.inputChat?.uploadFolder?.();
            } catch (e) {}
        },
        onCodexFolderPicked(event) {
            const files = Array.from(event?.target?.files || []);
            if (!files.length) return;
            const conversationId = this.currentChatRoom?.id || '';
            if (!conversationId) {
                // 메인 화면에는 아직 방이 없다. 폴더를 먼저 고르는 건 자연스러운 순서라
                // 막지 않고 들고 있다가, 대화가 열리면 그 방으로 올린다.
                this.folderStore.setPending(files);
                this.notify(
                    `폴더를 준비했습니다 — 파일 ${files.length}개`,
                    'success',
                    '메시지를 보내 대화가 열리면 이 폴더가 함께 올라갑니다'
                );
                return;
            }
            this.sendFolder(files, conversationId);
        },
        /** 실제 업로드. 방이 정해진 뒤에만 호출된다.
         *  스토어에 등록해 전송 측(ChatRoomPage)이 완료를 기다릴 수 있게 한다 —
         *  덜 올라온 폴더로 턴이 시작되면 에이전트가 잘못된 결론을 낸다. */
        async sendFolder(files, conversationId) {
            this.folderUploading = true;
            this.folderProgress = { sent: 0, total: files.length };
            const task = codexSessionFolderService.upload(files, { tenantId: getTenantId(), conversationId }, (progress) => {
                this.folderProgress = { sent: progress.sent, total: progress.total };
            });
            this.folderStore.beginUpload(task);
            try {
                const result = await task;
                this.folderSummary = result;
                const skipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
                this.notify(
                    `폴더를 올렸습니다 — 파일 ${result.files ?? result.sent}개`,
                    'success',
                    skipped ? `제외 ${skipped}개 (.git·node_modules 등 기본 제외)` : null
                );
            } catch (e) {
                this.notify('폴더 업로드 실패', 'error', e?.message || String(e));
            } finally {
                this.folderUploading = false;
            }
        },
        notify(msg, color = 'success', detail = null) {
            if (!window.$app_) return;
            window.$app_.snackbarMessage = msg;
            window.$app_.snackbarColor = color;
            window.$app_.snackbar = true;
            window.$app_.snackbarSuccessStatus = color === 'success';
            window.$app_.snackbarMessageDetail = detail;
            window.$app_.clickCount = 0;
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
            if (
                !message ||
                (!message.text && !message.file && !hasFiles && !hasRawFiles && (!message.images || message.images.length === 0))
            )
                return;
            this.$emit('sendMessage', {
                text: (message.text || '').trim(),
                timestamp: new Date().toISOString(),
                file: message.file || null,
                files: hasFiles ? messageFiles : null,
                rawFiles: hasRawFiles ? message.rawFiles : null,
                images: message.images || null,
                // orchestration pass-through (Chat.vue -> MainChatInput/ChatRoomPage)
                orchestration: normalizeOrchestration(message?.orchestration),
                // mention 메타데이터 pass-through (Chat.vue -> ChatRoomPage 라우팅)
                mentionedUsers: Array.isArray(message.mentionedUsers) ? message.mentionedUsers : [],
                // reply 메타데이터 pass-through (Chat.vue -> ChatRoomPage)
                reply: message.reply || null
                // 지식 선택(문서/폴더)은 전역 스토어가 단일 소스 — payload 로 배선하지 않는다.
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
    background: var(--cds-surface-2);
    border-radius: 20px;
    font-size: 13px;
    color: var(--cds-text-muted);
    cursor: pointer;
    white-space: nowrap;
}

.example-chip:hover {
    background: var(--cds-bg-neutral);
    border-color: var(--cds-border);
    color: var(--cds-text-muted);
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

/* codex 원본 폴더 업로드 상태 줄 */
.codex-folder-status {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 6px;
    padding: 4px 8px;
    font-size: 12px;
    line-height: 1.4;
    color: rgba(var(--v-theme-on-surface), 0.66);
}

/* 입력 툴바의 지식 베이스 버튼 (Chat custom-input-tools 슬롯) */
.knowledge-tool-btn {
    border-color: var(--cds-border) !important;
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
