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
                v-if="files.length"
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
                @click="selectedPath = f.path"
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
            </div>

            <div class="ws-files__preview-body">
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

const FILE_ICONS = {
    '.json': 'mdi-code-json',
    '.md': 'mdi-language-markdown-outline',
    '.html': 'mdi-language-html5',
    '.htm': 'mdi-language-html5',
    '.form': 'mdi-form-select',
    '.xml': 'mdi-xml',
    '.bpmn': 'mdi-sitemap-outline',
    '.dmn': 'mdi-table-large',
    '.yaml': 'mdi-cog-outline',
    '.yml': 'mdi-cog-outline',
    '.txt': 'mdi-text-box-outline',
    '.csv': 'mdi-table'
};

const PREVIEWABLE_EXTENSIONS = new Set(Object.keys(FILE_ICONS));

function normalizedFileExtension(file) {
    const explicit = (file?.ext || '').toString().trim().toLowerCase();
    if (explicit) return explicit.startsWith('.') ? explicit : `.${explicit}`;
    const name = (file?.name || file?.path || '').toString().split('/').pop() || '';
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot).toLowerCase() : '';
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
    emits: ['save', 'edit-file', 'ai-edit-file', 'navigate-process'],
    data() {
        return {
            selectedPath: null
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
                }
            }
        }
    },
    methods: {
        fileExtension(file) {
            return normalizedFileExtension(file);
        },
        fileIcon(ext) {
            const normalized = (ext || '').toString().toLowerCase();
            return FILE_ICONS[normalized.startsWith('.') ? normalized : `.${normalized}`] || 'mdi-file-outline';
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
