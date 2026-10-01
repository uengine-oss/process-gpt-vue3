<template>
    <div class="ws-files">
        <!-- 작업 폴더 헤더 (+ 일괄 저장 버튼) -->
        <div class="ws-files__header">
            <v-icon size="16" class="mr-1">mdi-folder-outline</v-icon>
            <span class="ws-files__title">작업 폴더</span>
            <span class="ws-files__count">{{ displayFiles.length }}</span>
            <v-spacer />
            <!-- 실엔진 검증/자동개선 진행 표시 (제시 전 자동 수행) -->
            <v-chip v-if="saveState.validating" size="x-small" color="primary" variant="tonal" class="mr-2">
                <v-progress-circular indeterminate size="11" width="2" class="mr-1" />
                {{ saveState.validateMsg || '검증 중...' }}
            </v-chip>
            <v-chip
                v-else-if="saveState.validateReport"
                size="x-small"
                :color="saveState.validatePassed ? 'success' : 'warning'"
                variant="tonal"
                class="mr-2"
            >
                <v-icon size="12" class="mr-1">{{ saveState.validatePassed ? 'mdi-check-circle-outline' : 'mdi-alert-outline' }}</v-icon>
                {{ saveState.validatePassed ? '검증 통과' : `검증 보정 ${saveState.validateReport.iterations || 0}회` }}
            </v-chip>
            <v-btn
                v-if="savableFiles.length"
                size="x-small"
                color="primary"
                variant="flat"
                :loading="saveState.saving"
                :disabled="saveState.saved || saveState.validating"
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
                @click="select(f)"
            >
                <v-icon size="15" class="ws-files__item-icon">{{ fileIcon(fileExtension(f)) }}</v-icon>
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
                <v-btn
                    v-if="selectedIsDocument"
                    size="x-small"
                    variant="text"
                    prepend-icon="mdi-download"
                    :loading="downloading"
                    @click="downloadSelected"
                    >다운로드</v-btn
                >
            </div>

            <!-- 문서 산출물(docx·pdf 등): 내용이 아니라 비공개 버킷의 서명 주소로 온다.
                 브라우저가 그릴 수 있는 형식은 그려 주고, 그렇지 않으면 받게 한다. -->
            <div v-if="selectedIsDocument" class="ws-files__preview-body">
                <iframe
                    v-if="selectedPreviewKind === 'pdf' && selectedUrlReady"
                    :key="selected.url"
                    :src="selected.url"
                    class="ws-files__iframe"
                    title="문서 미리보기"
                ></iframe>
                <img
                    v-else-if="selectedPreviewKind === 'image' && selectedUrlReady"
                    :src="selected.url"
                    :alt="displayName(selected)"
                    class="ws-files__image"
                />
                <div v-else-if="selectedPreviewKind !== 'none'" class="ws-files__doc">
                    <v-progress-circular indeterminate color="primary" :size="20" />
                    <span class="ws-files__doc-note">미리보기 주소를 받는 중…</span>
                </div>
                <div v-else class="ws-files__doc">
                    <v-icon size="34" class="ws-files__doc-icon">{{ fileIcon(fileExtension(selected)) }}</v-icon>
                    <div class="ws-files__doc-name">{{ displayName(selected) }}</div>
                    <div class="ws-files__doc-note">미리보기를 지원하지 않는 형식입니다. 받아서 확인하세요.</div>
                    <v-btn
                        size="small"
                        color="primary"
                        variant="flat"
                        prepend-icon="mdi-download"
                        :loading="downloading"
                        @click="downloadSelected"
                        >다운로드</v-btn
                    >
                </div>
            </div>

            <div v-else class="ws-files__preview-body">
                <HwpxViewer
                    :key="selected.path"
                    ref="viewer"
                    :content="selected.content"
                    :ext="fileExtension(selected)"
                    :def-json="selected.json || ''"
                    :edit-target="editTarget"
                    :read-only="false"
                    @update:content="onContentEdit"
                    @update:def-json="onDefJsonEdit"
                    @ai-edit-request="onAiEditRequest"
                    @navigate-process="$emit('navigate-process', $event)"
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
import { agentStableId } from '@/utils/agentId.js';
import { isArtifactUrlFresh } from '@/utils/artifactLinks.js';
import {
    TEXT_PREVIEW_EXTENSIONS,
    documentPreviewKind,
    downloadUrlFor,
    fileExtensionOf,
    fileIconOf,
    isDocumentFile
} from '@/shared/workspaceFiles/index.js';

const PREVIEWABLE_EXTENSIONS = TEXT_PREVIEW_EXTENSIONS;

function normalizedFileExtension(file) {
    return fileExtensionOf(file);
}

export default {
    name: 'WorkspaceFilesViewer',
    components: { HwpxViewer },
    props: {
        // [{ path, name, ext, content, op:'create'|'edit', truncated, status }]
        files: { type: Array, default: () => [] },
        // { saving, saved, error } — 부모(ChatRoomPage)가 DB 저장 상태를 전달
        saveState: { type: Object, default: () => ({ saving: false, saved: false, error: '' }) }
    },
    emits: ['save', 'edit-file', 'ai-edit-file', 'navigate-process', 'resolve-url'],
    data() {
        return {
            selectedPath: null,
            downloading: false
        };
    },
    computed: {
        /**
         * 목록에 표시할 파일 — 내부 메타데이터를 제외한 미리보기 가능한 산출물을 모두 표시한다.
         * - "." 로 시작하는 파일·process-definition.json·manifest.json 은 숨김.
         * - bpmn/md/json/html/form/xml/yaml/txt/csv 등은 각 형식 뷰어로 표시한다.
         */
        displayFiles() {
            return (this.files || []).filter((f) => {
                const p = (f.path || '').replace(/\\/g, '/');
                const lp = p.toLowerCase();
                const base = (f.name || p.split('/').pop() || '').toString();
                const normalizedBase = base.toLowerCase().replace(/^\.+/, '');
                if (base.startsWith('.')) return false; // 숨김 파일
                // 문서 산출물(docx·pdf 등)은 바이너리라 내용이 없다. 미리보기 가능한
                // 확장자 목록으로 걸러 버리면 만들어진 문서가 목록에서 통째로 빠진다 —
                // 받을 수 있는 주소를 들고 있으면 산출물이다.
                if (isDocumentFile(f)) return true;
                // DeepAgent may emit internal files with or without a leading dot.
                if (normalizedBase === 'process-definition.json' || normalizedBase === 'manifest.json') return false;
                const ext = normalizedFileExtension(f);
                const isBpmn = ext === '.bpmn' || lp.endsWith('.bpmn');
                const isSkill = lp.endsWith('/skill.md') || base.toLowerCase() === 'skill.md';
                // 에이전트: 개별 파일 `agents/<id>.json` 또는 레거시 단일 `agents.json`.
                const isAgent = lp.endsWith('/agents.json') || base.toLowerCase() === 'agents.json' || /\/agents\/[^/]+\.json$/.test(lp);
                return isBpmn || isSkill || isAgent || PREVIEWABLE_EXTENSIONS.has(ext);
            });
        },
        selected() {
            return this.displayFiles.find((f) => f.path === this.selectedPath) || null;
        },
        /** 저장(정식 등록) 대상 — 문서 산출물은 등록할 정의가 아니라 받아 갈 결과물이다. */
        savableFiles() {
            return (this.files || []).filter((f) => f && !isDocumentFile(f));
        },
        selectedIsDocument() {
            return isDocumentFile(this.selected);
        },
        /** 선택한 문서를 화면에서 그릴 수 있는가 — 'pdf' | 'image' | 'none'. */
        selectedPreviewKind() {
            return documentPreviewKind(this.selected);
        },
        /**
         * 지금 이 주소로 그려도 되는가.
         *
         * 만료된 주소를 그대로 iframe 에 걸면 브라우저가 저장소의 오류 XML 을 문서인 양
         * 그린다 — 어제 대화를 다시 연 사람은 깨진 화면을 먼저 본다. 새 주소를 받을
         * 때까지는 그리지 않고 기다린다고 말한다.
         */
        selectedUrlReady() {
            const file = this.selected;
            return !!(file && file.url && isArtifactUrlFresh(file));
        },
        /**
         * 선택 산출물의 '편집' 시 이동할 내부 편집기 타깃.
         * - bpmn → process(/definitions/{id}), SKILL.md → skill(/skills/{name}), agents.json → agent(/agent-chat/{id})
         * 없으면 null(=코드탭 직접수정).
         */
        editTarget() {
            const f = this.selected;
            if (!f) return null;
            const p = (f.path || '').replace(/\\/g, '/');
            const lp = p.toLowerCase();
            const ext = normalizedFileExtension(f);
            // 1) bpmn → process
            if (ext === '.bpmn' || lp.endsWith('.bpmn')) {
                let id = '';
                try {
                    let j = JSON.parse((f.json || f.content || '').toString());
                    if (j && j.processDefinition) j = j.processDefinition;
                    id = ((j && (j.processDefinitionId || j.id)) || '').toString().trim();
                } catch (e) {
                    /* ignore */
                }
                return id ? { kind: 'process', id } : null;
            }
            // 2) SKILL.md → skill (폴더명 = 스킬명)
            if (lp.endsWith('/skill.md') || (f.name || '').toLowerCase() === 'skill.md') {
                const m = p.match(/\/skills\/([^/]+)\/SKILL\.md$/i) || p.match(/([^/]+)\/SKILL\.md$/i);
                const name = m ? m[1] : '';
                return name ? { kind: 'skill', name } : null;
            }
            // 3) 에이전트 → agent (/agent-chat/{id})
            //    개별 파일 agents/<id>.json: 단일 객체. 레거시 agents.json: 배열 첫 항목.
            //    id 는 draft 저장과 동일하게 agentStableId 로 결정(슬러그 → 결정적 uuid; reload 에도 일치).
            if (lp.endsWith('/agents.json') || (f.name || '').toLowerCase() === 'agents.json' || /\/agents\/[^/]+\.json$/.test(lp)) {
                let obj = null;
                try {
                    const parsed = JSON.parse((f.content || '').toString());
                    if (Array.isArray(parsed)) {
                        obj = parsed.find((a) => a && (a.id || a.name)) || null;
                    } else if (parsed && Array.isArray(parsed.agents)) {
                        obj = parsed.agents.find((a) => a && (a.id || a.name)) || null;
                    } else if (parsed && typeof parsed === 'object') {
                        obj = parsed;
                    }
                } catch (e) {
                    /* ignore */
                }
                const id = agentStableId(obj || {}, p);
                return id ? { kind: 'agent', id } : null;
            }
            return null;
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
                    // 주소 확보는 selectedPath watcher 에 맡기지 않는다 — 같은 flush 안에서
                    // 이미 지나간 watcher 는 다시 뛰지 않아, 방에 들어와 자동 선택된 파일만
                    // 영영 "주소를 받는 중" 에 멈춰 있었다.
                    this.$nextTick(() => this.ensureDocumentUrl());
                }
            }
        }
    },
    methods: {
        /** 목록에서 파일을 고른다. 고르는 즉시 받을 수 있는 주소를 확보한다. */
        select(file) {
            this.selectedPath = file?.path || null;
            this.ensureDocumentUrl();
        },
        fileExtension(file) {
            return normalizedFileExtension(file);
        },
        fileIcon(ext) {
            return fileIconOf(ext);
        },
        /**
         * 선택한 문서의 주소가 아직 살아 있게 한다.
         *
         * 서명 주소는 한 시간이면 죽는다. 어제 대화를 다시 연 사람에게는 목록에 파일이
         * 보이는데 눌러도 아무것도 안 나오는 상태가 된다 — 주소를 받아 오는 일은 부모가
         * 하고(열쇠는 `file_id`), 여기서는 필요할 때 부탁만 한다.
         */
        ensureDocumentUrl() {
            const file = this.selected;
            if (!isDocumentFile(file)) return null;
            if (file.url && isArtifactUrlFresh(file)) return null;
            return new Promise((resolve) => {
                this.$emit('resolve-url', { path: file.path, done: resolve });
            });
        },
        /** 선택한 문서를 받는다. 주소가 죽어 있으면 먼저 새로 받아 온다. */
        async downloadSelected() {
            const file = this.selected;
            if (!file || this.downloading) return;
            this.downloading = true;
            try {
                const pending = this.ensureDocumentUrl();
                if (pending) await pending;
                const url = file.url || '';
                // 주소를 못 받았으면 아무것도 하지 않는다 — 죽은 주소로 빈 창을 띄우면
                // 사용자는 파일이 깨진 줄로 안다.
                if (!url) return;
                const name = file.name || this.displayName(file) || 'download';
                const a = document.createElement('a');
                a.href = downloadUrlFor(url, name);
                a.download = name;
                // 크로스 오리진이면 download 속성이 무시될 수 있어 새 탭 fallback 도 허용.
                a.target = '_blank';
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } finally {
                this.downloading = false;
            }
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
        /** 목록 표시명: 스킬 → '스킬명/SKILL.md', 에이전트 → 'agent/<이름>', 폼 → 'form/<파일>', 그 외 → 파일명. */
        displayName(f) {
            const p = (f.path || '').replace(/\\/g, '/');
            const sk = p.match(/\/skills\/([^/]+)\/(.+)$/);
            if (sk) return `${sk[1]}/${sk[2].split('/').pop()}`;
            // 에이전트 개별 파일 agents/<id>.json → 'agent/<이름>'(없으면 파일 stem).
            const ag = p.match(/\/agents\/([^/]+)\.json$/i);
            if (ag) {
                let nm = '';
                try {
                    const o = JSON.parse((f.content || '').toString());
                    if (o && typeof o === 'object' && !Array.isArray(o)) nm = (o.name || '').toString().trim();
                } catch (e) {
                    /* ignore */
                }
                return `agent/${nm || ag[1]}`;
            }
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
    background: var(--cds-surface-2);
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
.ws-files__image {
    max-width: 100%;
    border: 1px solid rgba(var(--v-theme-borderColor), 0.6);
    border-radius: 6px;
}
.ws-files__doc {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    min-height: 200px;
    text-align: center;
}
.ws-files__doc-icon {
    opacity: 0.6;
}
.ws-files__doc-name {
    font-weight: 600;
    word-break: break-all;
}
.ws-files__doc-note {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.ws-files__truncated {
    display: flex;
    align-items: center;
    margin-top: 10px;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
</style>
