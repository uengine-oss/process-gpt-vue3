<template>
    <div class="chat-thread">
        <div class="chat-messages" ref="messagesContainer">
            <div v-if="isLoadingHistory" class="empty-chat">
                <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
                <p class="mt-2 text-grey">{{ loadingHistoryText }}</p>
            </div>

            <div v-else-if="messages.length === 0" class="empty-chat">
                <v-icon size="48" color="grey-lighten-1">mdi-robot-outline</v-icon>
                <p class="mt-2 text-grey">{{ emptyText }}</p>
            </div>

            <div
                v-for="(msg, index) in messages"
                :key="msg.uuid || index"
                class="message-item"
                :class="{
                    'user-message': msg.role === 'user',
                    'assistant-message': msg.role === 'assistant' || msg.role === 'system',
                    'my-message': isMyMessage(msg)
                }"
            >
                <div v-if="!isMyMessage(msg)" class="message-avatar">
                    <v-avatar size="32" :color="msg.role === 'user' ? 'primary' : 'grey-lighten-2'">
                        <v-icon size="18" :color="msg.role === 'user' ? 'white' : 'grey-darken-1'">
                            {{ msg.role === 'user' ? 'mdi-account' : 'mdi-robot-outline' }}
                        </v-icon>
                    </v-avatar>
                </div>
                <div class="message-content" :class="{ 'message-content--my': isMyMessage(msg) }">
                    <div v-if="!isMyMessage(msg)" class="message-header">
                        <span class="message-sender">{{ assistantLabel(msg) }}</span>
                        <span class="message-time">{{ formatTime(msg.timeStamp) }}</span>
                    </div>

                    <div class="bubble-wrap" :class="{ 'bubble-wrap--my': isMyMessage(msg) }">
                        <div class="bubble" :class="{ 'bubble--my': isMyMessage(msg) }">
                            <div
                                v-if="msg.content && msg.content.trim && msg.content.trim().length > 0"
                                class="message-text"
                                v-html="formatMessage(msg.content)"
                            ></div>

                            <div v-if="msg.images && msg.images.length > 0" class="attached-images mt-2">
                                <div v-for="(image, imgIdx) in msg.images" :key="imgIdx" class="attached-image-item">
                                    <img
                                        :src="image.url || image"
                                        class="attached-image"
                                        @click="emitPreviewImage(image.url || image)"
                                    />
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="tonal"
                                        class="attached-image-download"
                                        :disabled="!getAttachmentUrl(image)"
                                        @click.stop="downloadAttachment(getAttachmentUrl(image), getAttachmentName(image, `image-${imgIdx + 1}`))"
                                    >
                                        <v-icon size="14">mdi-download</v-icon>
                                    </v-btn>
                                </div>
                            </div>

                            <div v-if="msg.pdfFile" class="attached-pdf mt-2">
                                <div
                                    class="attached-file-card"
                                    role="button"
                                    tabindex="0"
                                    @click="getAttachmentUrl(msg.pdfFile) && emitOpenExternalUrl(getAttachmentUrl(msg.pdfFile))"
                                >
                                    <div class="attached-file-card__icon">
                                        <v-icon size="18" color="primary">mdi-file-outline</v-icon>
                                    </div>
                                    <div class="attached-file-card__meta">
                                        <div class="attached-file-card__name">
                                            {{ msg.pdfFile.name || msg.pdfFile.fileName || '첨부파일' }}
                                        </div>
                                        <div class="attached-file-card__sub">
                                            {{ formatAttachmentSub(msg.pdfFile) }}
                                        </div>
                                    </div>
                                    <v-btn
                                        icon
                                        size="x-small"
                                        variant="tonal"
                                        :disabled="!getAttachmentUrl(msg.pdfFile)"
                                        @click.stop="downloadAttachment(getAttachmentUrl(msg.pdfFile), getAttachmentName(msg.pdfFile, 'attachment'))"
                                    >
                                        <v-icon size="14">mdi-download</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                        </div>
                        <div v-if="msg.timeStamp" class="bubble-time" :class="{ 'bubble-time--my': isMyMessage(msg) }">
                            {{ formatTime(msg.timeStamp) }}
                        </div>
                    </div>

                    <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="tool-calls">
                        <div v-for="(tool, idx) in msg.toolCalls" :key="idx" class="tool-call-item">
                            <v-icon size="14" color="primary" class="mr-1">mdi-wrench</v-icon>
                            <span class="tool-name">{{ formatToolName(tool.name) }}</span>
                        </div>
                    </div>

                    <div
                        v-if="msg.pdf2bpmnResult && msg.pdf2bpmnResult.generatedBpmns && msg.pdf2bpmnResult.generatedBpmns.length > 0"
                        class="pdf2bpmn-result-container mt-3"
                    >
                        <div class="result-header">
                            <v-icon size="18" color="success" class="mr-2">mdi-check-circle</v-icon>
                            <span class="result-title">생성된 BPMN 프로세스 ({{ msg.pdf2bpmnResult.generatedBpmns.length }}개)</span>
                        </div>
                        <div class="bpmn-cards">
                            <div
                                v-for="(bpmn, idx) in msg.pdf2bpmnResult.generatedBpmns"
                                :key="idx"
                                class="bpmn-card"
                                @click="emitPreviewBpmn(bpmn)"
                            >
                                <div class="bpmn-card-icon">
                                    <v-icon size="24" color="primary">mdi-sitemap</v-icon>
                                </div>
                                <div class="bpmn-card-content">
                                    <div class="bpmn-card-title">{{ bpmn.process_name }}</div>
                                    <div class="bpmn-card-subtitle">ID: {{ bpmn.process_id }}</div>
                                </div>
                                <v-btn icon variant="text" size="small" class="bpmn-card-action">
                                    <v-icon size="18">mdi-eye</v-icon>
                                </v-btn>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="pdf2bpmnProgress?.isActive" class="message-item assistant-message">
                <div class="message-avatar">
                    <v-avatar size="32" color="blue-lighten-4">
                        <v-icon size="18" color="blue-darken-1">mdi-file-document-outline</v-icon>
                    </v-avatar>
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">PDF → BPMN 변환</span>
                        <v-chip size="x-small" :color="getProgressChipColor(pdf2bpmnProgress.status)" class="ml-2">
                            {{ pdf2bpmnProgress.status }}
                        </v-chip>
                    </div>

                    <div class="pdf2bpmn-progress-card">
                        <v-progress-linear
                            :model-value="pdf2bpmnProgress.progress"
                            :color="pdf2bpmnProgress.status === 'completed' ? 'success' : 'primary'"
                            height="8"
                            rounded
                            class="mb-2"
                        ></v-progress-linear>

                        <div class="progress-info">
                            <span class="progress-message">{{ pdf2bpmnProgress.message }}</span>
                            <span class="progress-percent">{{ pdf2bpmnProgress.progress }}%</span>
                            <v-progress-circular
                                v-if="pdf2bpmnProgress.status === 'processing'"
                                style="margin-left: 3px; margin-bottom: 3px;"
                                indeterminate
                                size="12"
                                width="2"
                                color="primary"
                            />
                        </div>

                        <div v-if="pdf2bpmnProgress.generatedBpmns?.length > 0" class="generated-bpmns-scroll mt-3">
                            <div class="bpmn-list-title">
                                <v-icon size="14" class="mr-1">mdi-sitemap</v-icon>
                                생성된 프로세스 ({{ pdf2bpmnProgress.generatedBpmns.length }})
                            </div>
                            <div class="bpmn-cards-scroll">
                                <div
                                    v-for="(bpmn, idx) in pdf2bpmnProgress.generatedBpmns"
                                    :key="idx"
                                    class="bpmn-card-mini"
                                    @click="emitPreviewBpmn(bpmn)"
                                >
                                    <div class="bpmn-card-mini-icon">
                                        <v-icon size="18" color="success">mdi-check-circle</v-icon>
                                    </div>
                                    <div class="bpmn-card-mini-content">
                                        <div class="bpmn-card-mini-title">{{ bpmn.process_name }}</div>
                                    </div>
                                    <v-icon size="14" color="grey">mdi-eye</v-icon>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
    </div>
</template>

<script>
export default {
    name: 'ChatThread',
    props: {
        messages: { type: Array, default: () => [] },
        currentUserEmail: { type: String, default: '' },
        isLoadingHistory: { type: Boolean, default: false },
        isLoading: { type: Boolean, default: false },
        loadingMessage: { type: String, default: '' },
        pdf2bpmnProgress: { type: Object, default: null },
        loadingHistoryText: { type: String, default: '대화 내역을 불러오는 중...' },
        emptyText: { type: String, default: '무엇을 도와드릴까요?' }
    },
    emits: ['preview-image', 'preview-bpmn', 'open-external-url'],
    methods: {
        isMyMessage(msg) {
            const myEmail = (this.currentUserEmail || '').toString();
            if (!myEmail) return false;
            return msg?.role === 'user' && !!msg?.email && msg.email === myEmail;
        },
        scrollToBottom() {
            this.$nextTick(() => {
                const container = this.$refs.messagesContainer;
                if (container) container.scrollTop = container.scrollHeight;
            });
        },
        emitPreviewImage(url) {
            if (!url) return;
            this.$emit('preview-image', url);
        },
        emitPreviewBpmn(bpmn) {
            if (!bpmn) return;
            this.$emit('preview-bpmn', bpmn);
        },
        emitOpenExternalUrl(url) {
            if (!url) return;
            this.$emit('open-external-url', url);
        },
        getAttachmentUrl(fileOrUrl) {
            if (!fileOrUrl) return '';
            if (typeof fileOrUrl === 'string') return fileOrUrl;
            return (
                fileOrUrl.url ||
                fileOrUrl.fileUrl ||
                fileOrUrl.publicUrl ||
                fileOrUrl.signedUrl ||
                ''
            );
        },
        getAttachmentName(fileObj, fallbackBaseName = 'download') {
            if (!fileObj) return fallbackBaseName;
            if (typeof fileObj === 'string') return this.getFilenameFromUrl(fileObj) || fallbackBaseName;
            return fileObj.name || fileObj.fileName || this.getFilenameFromUrl(this.getAttachmentUrl(fileObj)) || fallbackBaseName;
        },
        getFilenameFromUrl(url) {
            try {
                const u = new URL(url);
                const pathname = (u.pathname || '').toString();
                const last = pathname.split('/').filter(Boolean).pop();
                return last ? decodeURIComponent(last) : '';
            } catch (e) {
                return '';
            }
        },
        formatBytes(bytes) {
            const b = Number(bytes);
            if (!Number.isFinite(b) || b <= 0) return '';
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
            const v = b / Math.pow(1024, i);
            const fixed = v >= 10 || i === 0 ? 0 : 1;
            return `${v.toFixed(fixed)}${units[i]}`;
        },
        formatAttachmentSub(fileObj) {
            try {
                const size = this.formatBytes(fileObj?.size || fileObj?.fileSize);
                const type = (fileObj?.type || fileObj?.fileType || '').toString();
                const parts = [size, type].filter(Boolean);
                return parts.join(' · ') || ' ';
            } catch (e) {
                return ' ';
            }
        },
        async downloadAttachment(url, filename) {
            if (!url) return;
            const name = filename || this.getFilenameFromUrl(url) || 'download';
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = name;
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();

                // revoke는 약간 지연시켜 다운로드 실패 확률을 낮춤
                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            } catch (e) {
                // CORS/네트워크 이슈 등으로 fetch 다운로드가 막히면 새 탭으로라도 열어준다.
                this.emitOpenExternalUrl(url);
            }
        },
        assistantLabel(msg) {
            // 기존 WorkAssistantChatPanel 스타일 유지: 기본 라벨은 AI 어시스턴트
            return msg?.name || msg?.userName || 'AI 어시스턴트';
        },
        formatMessage(content) {
            if (!content) return '';
            let formatted = content.replace(/```json\s*([\s\S]*?)\s*```/g, (match, json) => {
                try {
                    const parsed = JSON.parse(json);
                    return `<pre class="json-block">${JSON.stringify(parsed, null, 2)}</pre>`;
                } catch {
                    return `<pre class="code-block">${json}</pre>`;
                }
            });
            formatted = formatted.replace(/```(\w*)\s*([\s\S]*?)\s*```/g, '<pre class="code-block">$2</pre>');
            formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" class="message-link">$1</a>');
            formatted = formatted.replace(/(?<!href=")(https?:\/\/[^\s<)\]"]+)/g, '<a href="$1" target="_blank" class="message-link">$1</a>');
            formatted = formatted.replace(/\n/g, '<br>');
            return formatted;
        },
        formatToolName(name) {
            if (!name) return '';
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
        formatTime(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        },
        getProgressChipColor(status) {
            if (status === 'completed') return 'success';
            if (status === 'failed' || status === 'error') return 'error';
            if (status === 'processing') return 'primary';
            return 'grey';
        }
    },
    watch: {
        messages: {
            deep: true,
            handler() {
                this.scrollToBottom();
            }
        }
    },
    mounted() {
        this.scrollToBottom();
    }
};
</script>

<style scoped>
.chat-thread {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 12px;
    min-height: 0;
}

.empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 0;
    color: rgba(0, 0, 0, 0.55);
}

.message-item {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
}

.message-item.my-message {
    justify-content: flex-end;
}

.message-avatar {
    flex: 0 0 auto;
}

.message-content {
    flex: 1;
    min-width: 0;
}

.message-content--my {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.bubble-wrap {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: min(720px, 80vw);
}

.bubble-wrap--my {
    align-items: flex-end;
}

.bubble {
    background: #f5f5f5;
    border-radius: 12px;
    padding: 10px 12px;
    width: fit-content;
    max-width: 100%;
}

.bubble--my {
    background: rgba(var(--v-theme-primary), 0.12);
    border-radius: 15px 3px 15px 15px;
}

.bubble-time {
    margin-top: 4px;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
}

.bubble-time--my {
    align-self: flex-start; /* 말풍선 좌측 하단 느낌 */
}

.message-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
}

.message-sender {
    font-size: 13px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.72);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.message-time {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.42);
    white-space: nowrap;
}

.message-text {
    font-size: 14px;
    line-height: 1.55;
    color: rgba(0, 0, 0, 0.82);
    word-break: break-word;
}

.attached-image {
    width: 160px;
    max-width: 45vw;
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.08);
}

.attached-image-item {
    position: relative;
    display: inline-block;
}

.attached-image-download {
    position: absolute;
    right: 8px;
    bottom: 8px;
    backdrop-filter: blur(6px);
}

.attached-file-row {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.attached-file-card {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: rgba(var(--v-theme-primary), 0.06);
    cursor: pointer;
    max-width: min(520px, 80vw);
    user-select: none;
}

.attached-file-card:hover {
    border-color: rgba(var(--v-theme-primary), 0.35);
    background: rgba(var(--v-theme-primary), 0.09);
}

.attached-file-card__icon {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--v-theme-primary), 0.12);
    flex: 0 0 auto;
}

.attached-file-card__meta {
    min-width: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.attached-file-card__name {
    font-size: 13px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.78);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.attached-file-card__sub {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tool-calls {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.tool-call-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
}

.code-block,
.json-block {
    margin-top: 8px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #0b1020;
    color: #e6edf3;
    overflow: auto;
    font-size: 12px;
}

.message-link {
    color: rgb(var(--v-theme-primary));
    text-decoration: underline;
}

.loading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(0, 0, 0, 0.65);
    font-size: 13px;
}

/* PDF2BPMN */
.pdf2bpmn-progress-card {
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px;
    padding: 12px;
    background: #fff;
}

.progress-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: rgba(0,0,0,0.6);
}

.progress-message {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.generated-bpmns-scroll {
    border-top: 1px dashed rgba(0,0,0,0.12);
    padding-top: 10px;
}
</style>

