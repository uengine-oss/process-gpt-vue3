<template>
    <div ref="root" class="office-editor-frame" :class="{ 'is-fullscreen': fullscreen }">
        <div class="office-editor-frame__bar">
            <v-icon size="16" class="office-editor-frame__icon">mdi-file-document-edit-outline</v-icon>
            <span class="office-editor-frame__name">{{ name || '문서' }}</span>
            <span v-if="readOnly" class="office-editor-frame__badge">미리보기</span>
            <v-spacer></v-spacer>
            <v-btn
                v-if="maximizable && !fullscreen"
                variant="text"
                density="comfortable"
                size="small"
                :prepend-icon="maximized ? 'mdi-window-restore' : 'mdi-window-maximize'"
                @click="$emit('update:maximized', !maximized)"
                >{{ maximized ? '원래 크기' : '최대화' }}</v-btn
            >
            <v-btn
                variant="text"
                density="comfortable"
                size="small"
                :prepend-icon="fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
                @click="toggleFullscreen"
                >{{ fullscreen ? '전체 화면 끝내기' : '전체 화면' }}</v-btn
            >
            <v-btn v-if="closable" icon variant="text" density="comfortable" size="small" title="닫기" @click="$emit('close')">
                <v-icon size="18">mdi-close</v-icon>
            </v-btn>
        </div>
        <iframe
            v-if="frameSrc"
            ref="frame"
            :src="frameSrc"
            :title="name || '문서 편집기'"
            class="office-editor-frame__iframe"
            allow="clipboard-read; clipboard-write; fullscreen"
        ></iframe>
        <div v-else class="office-editor-frame__empty">{{ emptyText }}</div>
        <transition name="fade">
            <div v-if="notice" class="office-editor-frame__notice" :class="`is-${notice.kind}`">{{ notice.text }}</div>
        </transition>
    </div>
</template>

<script>
// 문서 편집기(이음오피스 기반 웹 편집기)를 iframe 으로 띄운다. 문서는 원본 형식(docx·xlsx·pptx·pdf·hwp…) 그대로 열리고,
// 편집기 안에서 저장하면 편집기 서버가 원본 옆에 `edited-…` 객체로 올린 뒤 그 URL 을 알려 준다.
// 받는 메시지: ready → saved{url,name} | agent{action,text} | save-failed{error} | error{error} | closed
// 보내는 메시지: context{context} — 업무 맥락(활동·지시·이전 단계 입력). 편집기 AI 가 요청을 해석하는 기준이 된다.
import { isOfficeEditorMessage, officeEditorUrl } from '@/utils/officeEditor';

export default {
    name: 'OfficeEditorFrame',
    props: {
        fileUrl: { type: String, default: '' },
        name: { type: String, default: '' },
        readOnly: { type: Boolean, default: false },
        /** { process, activity, description, instruction, inputs: [{ label, value }] } — 없으면 보내지 않는다 */
        context: { type: Object, default: null },
        /** 부모가 크기를 바꿀 수 있을 때(대화 상자) 최대화/원래 크기 단추를 보인다 */
        maximizable: { type: Boolean, default: false },
        maximized: { type: Boolean, default: false },
        closable: { type: Boolean, default: false }
    },
    emits: ['ready', 'saved', 'error', 'agent', 'update:maximized', 'close'],
    data() {
        return {
            frameSrc: '',
            emptyText: '문서를 여는 중…',
            notice: null,
            noticeTimer: null,
            fullscreen: false,
            ready: false,
            // 편집기가 방금 올린 URL 로 부모가 fileUrl 을 바꿔도 다시 열지 않는다(편집 기록 보존)
            savedUrls: new Set()
        };
    },
    watch: {
        fileUrl(url) {
            if (url && !this.savedUrls.has(url)) this.load();
        },
        readOnly() {
            this.load();
        },
        context: {
            deep: true,
            handler() {
                this.sendContext();
            }
        }
    },
    mounted() {
        window.addEventListener('message', this.onMessage);
        document.addEventListener('fullscreenchange', this.onFullscreenChange);
        this.load();
    },
    beforeUnmount() {
        window.removeEventListener('message', this.onMessage);
        document.removeEventListener('fullscreenchange', this.onFullscreenChange);
        clearTimeout(this.noticeTimer);
    },
    methods: {
        async load() {
            this.ready = false;
            const src = await officeEditorUrl({ fileUrl: this.fileUrl, name: this.name, readOnly: this.readOnly });
            this.frameSrc = src;
            if (!src) this.emptyText = '이 문서는 편집기로 열 수 없습니다.';
        },
        onMessage(event) {
            if (!isOfficeEditorMessage(event, this.$refs.frame?.contentWindow)) return;
            const message = event.data;
            if (message.type === 'ready') {
                this.ready = true;
                this.sendContext();
                this.$emit('ready');
            } else if (message.type === 'saved') {
                if (message.url) this.savedUrls.add(message.url);
                this.show('success', message.url ? '저장했습니다.' : '저장했습니다(업로드 없이 작업 폴더에만 저장).');
                this.$emit('saved', { url: message.url || '', name: message.name || this.name });
            } else if (message.type === 'agent') {
                // process-gpt 에이전트가 이 문서를 사람이 보는 앞에서 고치는 중(실시간 공동 편집)
                const label = { write: '내용을 쓰는 중', replace: '내용을 바꾸는 중', ops: '서식·구조를 고치는 중', save: '저장했습니다' }[
                    message.action
                ];
                this.show('agent', `에이전트가 ${label || '작업하는 중'}${message.text ? ` · ${message.text}` : ''}`);
                this.$emit('agent', message);
            } else if (message.type === 'save-failed') {
                this.show('error', `저장한 문서를 올리지 못했습니다: ${message.error || ''}`);
                this.$emit('error', message.error);
            } else if (message.type === 'error') {
                this.show('error', `문서를 열지 못했습니다: ${message.error || ''}`);
                this.$emit('error', message.error);
            }
        },
        sendContext() {
            const frame = this.$refs.frame?.contentWindow;
            if (!this.ready || !frame || !this.context) return;
            // 편집기 출처는 iframe 주소에서 정한다(다른 출처로는 보내지 않는다)
            const origin = new URL(this.frameSrc, window.location.href).origin;
            frame.postMessage({ source: 'process-gpt', type: 'context', context: JSON.parse(JSON.stringify(this.context)) }, origin);
        },
        async toggleFullscreen() {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await this.$refs.root.requestFullscreen();
            } catch (e) {
                this.show('error', '이 브라우저에서는 전체 화면을 쓸 수 없습니다.');
            }
        },
        onFullscreenChange() {
            this.fullscreen = document.fullscreenElement === this.$refs.root;
        },
        show(kind, text) {
            clearTimeout(this.noticeTimer);
            this.notice = { kind, text };
            this.noticeTimer = setTimeout(() => (this.notice = null), kind === 'error' ? 8000 : kind === 'agent' ? 6000 : 2500);
        }
    }
};
</script>

<style scoped>
/* the iframe takes the height left in the column; an explicit height:100% would fall back
   to the 150px iframe default whenever the parent's height is not definite (dialogs) */
.office-editor-frame {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-height: min(78vh, 900px);
    background: rgb(var(--v-theme-surface));
}
.office-editor-frame.is-fullscreen {
    min-height: 100vh;
}
.office-editor-frame__bar {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
    height: 40px;
    padding: 0 8px 0 14px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.office-editor-frame__icon {
    opacity: 0.7;
}
.office-editor-frame__name {
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.office-editor-frame__badge {
    padding: 1px 8px;
    border-radius: 10px;
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
    font-size: 11px;
}
.office-editor-frame__iframe {
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    border: 0;
}
.office-editor-frame__empty {
    margin: auto;
    color: rgba(0, 0, 0, 0.6);
    font-size: 14px;
}
.office-editor-frame__notice {
    position: absolute;
    right: 16px;
    bottom: 40px;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.office-editor-frame__notice.is-success {
    background: #2e7d32;
}
.office-editor-frame__notice.is-agent {
    max-width: 60%;
    background: #3949ab;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.office-editor-frame__notice.is-error {
    background: #c62828;
}
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
