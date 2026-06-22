<template>
    <div class="ws-files">
        <!-- 작업 폴더 헤더 (+ 일괄 저장 버튼) -->
        <div class="ws-files__header">
            <v-icon size="16" class="mr-1">mdi-folder-outline</v-icon>
            <span class="ws-files__title">작업 폴더</span>
            <span class="ws-files__count">{{ files.length }}</span>
            <v-spacer />
            <v-btn
                v-if="files.length"
                size="x-small"
                color="primary"
                variant="flat"
                :loading="saveState.saving"
                :disabled="saveState.saved"
                prepend-icon="mdi-content-save-outline"
                @click="$emit('save')"
                >{{ saveState.saved ? '저장됨' : '저장' }}</v-btn
            >
        </div>

        <!-- 파일 목록 (process-definition.json·manifest.json 은 숨김 — BPMN 파일 내부 JSON 탭에서 확인/편집) -->
        <div class="ws-files__list">
            <button
                v-for="f in displayFiles"
                :key="f.path"
                class="ws-files__item"
                :class="{ 'is-active': f.path === selectedPath }"
                @click="selectedPath = f.path"
            >
                <v-icon size="15" class="ws-files__item-icon">{{ fileIcon(f.ext) }}</v-icon>
                <span class="ws-files__item-name">{{ displayName(f) }}</span>
                <span v-if="f.status === 'running'" class="ws-files__item-badge is-running">편집 중…</span>
                <span v-else-if="f.op === 'edit'" class="ws-files__item-badge is-edit">수정</span>
                <span v-else class="ws-files__item-badge is-create">생성</span>
            </button>
            <div v-if="!displayFiles.length" class="ws-files__empty">아직 생성된 파일이 없습니다.</div>
        </div>

        <!-- 선택 파일 미리보기 — 확장자별 공통 뷰어(HwpxViewer)로 동적 디스패치(URL 없이 content 렌더) -->
        <div v-if="selected" class="ws-files__preview">
            <div class="ws-files__preview-bar">
                <span class="ws-files__preview-path">{{ selected.path }}</span>
            </div>

            <div class="ws-files__preview-body">
                <HwpxViewer
                    :key="selected.path"
                    ref="viewer"
                    :content="selected.content"
                    :ext="selected.ext"
                    :def-json="selected.json || ''"
                    :read-only="false"
                    @update:content="onContentEdit"
                    @update:def-json="onDefJsonEdit"
                    @ai-edit-request="onAiEditRequest"
                />

                <div v-if="selected.truncated" class="ws-files__truncated">
                    <v-icon size="13" class="mr-1">mdi-information-outline</v-icon>미리보기가 일부만 표시됩니다(파일이 큽니다).
                </div>
                <div v-if="saveState && saveState.error" class="ws-files__truncated" style="color: rgb(var(--v-theme-error))">
                    <v-icon size="13" class="mr-1">mdi-alert-circle-outline</v-icon>{{ saveState.error }}
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import HwpxViewer from '@/components/HwpxViewer.vue';

const FILE_ICONS = {
    '.json': 'mdi-code-json',
    '.md': 'mdi-language-markdown-outline',
    '.html': 'mdi-language-html5',
    '.htm': 'mdi-language-html5',
    '.xml': 'mdi-xml',
    '.bpmn': 'mdi-sitemap-outline',
    '.dmn': 'mdi-table-large',
    '.yaml': 'mdi-cog-outline',
    '.yml': 'mdi-cog-outline',
    '.txt': 'mdi-text-box-outline',
    '.csv': 'mdi-table'
};

export default {
    name: 'WorkspaceFilesViewer',
    components: { HwpxViewer },
    props: {
        // [{ path, name, ext, content, op:'create'|'edit', truncated, status }]
        files: { type: Array, default: () => [] },
        // { saving, saved, error } — 부모(ChatRoomPage)가 DB 저장 상태를 전달
        saveState: { type: Object, default: () => ({ saving: false, saved: false, error: '' }) }
    },
    emits: ['save', 'edit-file', 'ai-edit-file'],
    data() {
        return {
            selectedPath: null
        };
    },
    computed: {
        /** 목록에 표시할 파일 — process-definition.json·manifest.json 은 숨긴다(BPMN 파일 내부 JSON 탭에서 다룸). */
        displayFiles() {
            return (this.files || []).filter((f) => {
                const p = (f.path || '').replace(/\\/g, '/').toLowerCase();
                return !/\/process-definition\.json$/.test(p) && !/\/manifest\.json$/.test(p);
            });
        },
        selected() {
            return this.displayFiles.find((f) => f.path === this.selectedPath) || null;
        }
    },
    watch: {
        files: {
            immediate: true,
            deep: true,
            handler() {
                const list = this.displayFiles;
                if (!list.length) {
                    this.selectedPath = null;
                    return;
                }
                // 선택이 없거나 사라졌으면 마지막(가장 최근 갱신) 파일을 선택
                const stillThere = list.some((f) => f.path === this.selectedPath);
                if (!this.selectedPath || !stillThere) {
                    this.selectedPath = list[list.length - 1].path;
                }
            }
        }
    },
    methods: {
        fileIcon(ext) {
            return FILE_ICONS[ext] || 'mdi-file-outline';
        },
        /** 미리보기 뷰어에서 파일 내용을 편집하면 부모(ChatRoomPage)로 전달 → 패널 데이터 갱신·저장에 반영. */
        onContentEdit(newContent) {
            if (!this.selected) return;
            this.$emit('edit-file', { path: this.selected.path, content: (newContent ?? '').toString() });
        },
        /** BPMN JSON(process-definition) 편집 → 부모가 XML/다이어그램 재파생 + 저장 반영. */
        onDefJsonEdit(newJson) {
            if (!this.selected) return;
            this.$emit('edit-file', { path: this.selected.path, json: (newJson ?? '').toString(), target: 'def-json' });
        },
        /** AI 편집 요청 → 부모(ChatRoomPage)가 LLM 으로 수정 후 edit-file 로 반영. */
        onAiEditRequest(payload) {
            if (!this.selected) return;
            this.$emit('ai-edit-file', { path: this.selected.path, ...payload });
        },
        /** 목록 표시명: 스킬 → '스킬명/SKILL.md', 폼 → 'form/<파일>.html', 그 외 → 파일명. */
        displayName(f) {
            const p = (f.path || '').replace(/\\/g, '/');
            const sk = p.match(/\/skills\/([^/]+)\/(.+)$/);
            if (sk) return `${sk[1]}/${sk[2].split('/').pop()}`;
            const fm = p.match(/\/forms\/(.+)$/);
            if (fm) return `form/${fm[1].split('/').pop()}`;
            return f.name || p.split('/').pop() || '';
        }
    }
};
</script>

<style scoped>
.ws-files {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font-size: 13px;
}
.ws-files__header {
    display: flex;
    align-items: center;
    padding: 10px 14px 6px;
    color: rgba(var(--v-theme-on-surface), 0.75);
    font-weight: 600;
    flex-shrink: 0;
}
.ws-files__title {
    font-size: 13px;
}
.ws-files__count {
    margin-left: 6px;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.5);
    background: rgba(var(--v-theme-on-surface), 0.06);
    border-radius: 9px;
    padding: 0 7px;
}
.ws-files__list {
    flex-shrink: 0;
    max-height: 38%;
    overflow-y: auto;
    padding: 0 8px 8px;
    border-bottom: 1px solid rgba(var(--v-theme-borderColor), 0.6);
}
.ws-files__item {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    color: rgba(var(--v-theme-on-surface), 0.85);
}
.ws-files__item:hover {
    background: rgba(var(--v-theme-on-surface), 0.05);
}
.ws-files__item.is-active {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}
.ws-files__item-icon {
    flex-shrink: 0;
    opacity: 0.8;
}
.ws-files__item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ws-files__item-badge {
    flex-shrink: 0;
    font-size: 10px;
    border-radius: 8px;
    padding: 1px 7px;
}
.ws-files__item-badge.is-create {
    color: rgb(var(--v-theme-success));
    background: rgba(var(--v-theme-success), 0.12);
}
.ws-files__item-badge.is-edit {
    color: rgb(var(--v-theme-warning));
    background: rgba(var(--v-theme-warning), 0.12);
}
.ws-files__item-badge.is-running {
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.12);
}
.ws-files__empty {
    padding: 16px 8px;
    color: rgba(var(--v-theme-on-surface), 0.45);
    text-align: center;
}
.ws-files__preview {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.ws-files__preview-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    flex-shrink: 0;
}
.ws-files__preview-path {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ws-files__preview-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 14px 16px;
}
.ws-files__md {
    line-height: 1.6;
    word-break: break-word;
}
.ws-files__md :deep(pre) {
    background: rgba(var(--v-theme-on-surface), 0.05);
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
}
.ws-files__md :deep(code) {
    font-family: 'D2Coding', 'Consolas', monospace;
    font-size: 12px;
}
.ws-files__md :deep(table) {
    border-collapse: collapse;
}
.ws-files__md :deep(th),
.ws-files__md :deep(td) {
    border: 1px solid rgba(var(--v-theme-borderColor), 0.7);
    padding: 4px 8px;
}
.ws-files__iframe {
    width: 100%;
    height: 100%;
    min-height: 320px;
    border: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    border-radius: 6px;
    background: #fff;
}
.ws-files__code {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'D2Coding', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
    background: rgba(var(--v-theme-on-surface), 0.04);
    padding: 12px;
    border-radius: 6px;
}
.ws-files__truncated {
    display: flex;
    align-items: center;
    margin-top: 10px;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
</style>
