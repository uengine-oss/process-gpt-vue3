<template>
    <div class="instruction-field">
        <div v-if="isViewMode" class="instruction-view">
            <div v-if="parsedSegments.length > 0" class="instruction-preview d-flex flex-wrap align-center">
                <template v-for="(segment, index) in parsedSegments" :key="index">
                    <v-chip
                        v-if="segment.type === 'mention'"
                        size="x-small"
                        class="instruction-mention-chip mx-0.5 my-0.5"
                        :color="getMentionTypeMeta(segment.mention.type).color"
                        variant="tonal"
                    >
                        <v-icon start size="14">
                            {{ getMentionTypeMeta(segment.mention.type).icon }}
                        </v-icon>
                        @{{ segment.mention.label }}
                    </v-chip>
                    <span v-else class="instruction-preview-text">{{ segment.text }}</span>
                </template>
            </div>
            <div v-else class="instruction-preview text-medium-emphasis">-</div>
        </div>

        <v-menu v-else v-model="showMentionMenu" :close-on-content-click="false" location="bottom">
            <template v-slot:activator="{ props }">
                <div v-bind="props" class="instruction-editor-wrap">
                    <div class="instruction-editor-label text-caption text-medium-emphasis mb-1">
                        {{ $t('BpmnPropertyPanel.instruction') }}
                    </div>
                    <div
                        ref="instructionEditor"
                        class="instruction-editor"
                        contenteditable="true"
                        spellcheck="false"
                        @input="onEditorInput"
                        @click="onEditorCaretEvent"
                        @keyup="onEditorCaretEvent"
                        @keydown.up="onArrowKey"
                        @keydown.down="onArrowKey"
                    ></div>
                </div>
            </template>

            <v-card max-height="300" class="py-1 instruction-mention-menu">
                <v-list v-if="isMentionActive && filteredMentionCandidates.length > 0" density="compact" class="instruction-mention-list">
                    <v-list-item v-for="item in filteredMentionCandidates" :key="item.type + ':' + item.id" @click="selectMention(item)">
                        <template v-slot:prepend>
                            <v-icon :color="getMentionTypeMeta(item.type).color">
                                {{ getMentionTypeMeta(item.type).icon }}
                            </v-icon>
                        </template>
                        <v-list-item-title>
                            <span class="font-weight-medium">{{ item.label }}</span>
                            <span class="text-caption text-grey-darken-1 ml-1"> ({{ $t(getMentionTypeMeta(item.type).labelKey) }}) </span>
                        </v-list-item-title>
                        <v-list-item-subtitle v-if="item.description">
                            {{ item.description }}
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>
                <div v-else class="px-3 py-2 text-caption text-medium-emphasis">
                    {{ $t('BpmnPropertyPanel.noMentionCandidates') || '선택할 항목이 없습니다.' }}
                </div>
            </v-card>
        </v-menu>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: String,
        isViewMode: {
            type: Boolean,
            default: false
        },
        // [{ id, type: 'agent' | 'skill' | 'activity', label, description? }]
        mentionCandidates: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            instruction: this.normalizeInstructionValue(this.modelValue ? JSON.parse(JSON.stringify(this.modelValue)) : ''),
            showMentionMenu: false,
            mentionStartIndex: null,
            mentionQuery: '',
            cursorPosition: 0,
            editorRenderRaf: null
        };
    },

    computed: {
        isMentionActive() {
            return this.mentionStartIndex !== null;
        },
        filteredMentionCandidates() {
            const list = Array.isArray(this.mentionCandidates) ? this.mentionCandidates : [];
            const query = (this.mentionQuery || '').toString().toLowerCase();
            if (!query) {
                return list;
            }
            return list.filter((item) => {
                const label = item && item.label != null ? item.label.toString() : '';
                return label.toLowerCase().includes(query);
            });
        },
        parsedSegments() {
            return this.parseInstruction(this.instruction);
        },
        mentionTypeMeta() {
            return {
                agent: {
                    color: 'primary',
                    icon: 'mdi-account-tie',
                    labelKey: 'BpmnPropertyPanel.mentionType.agent'
                },
                skill: {
                    color: 'deep-orange',
                    icon: 'mdi-lightning-bolt-outline',
                    labelKey: 'BpmnPropertyPanel.mentionType.skill'
                },
                activity: {
                    color: 'success',
                    icon: 'mdi-sitemap',
                    labelKey: 'BpmnPropertyPanel.mentionType.activity'
                }
            };
        }
    },

    watch: {
        instruction: {
            deep: true,
            handler(newValue) {
                this.$emit('update:modelValue', newValue);
            }
        },
        modelValue: {
            immediate: true,
            handler(newVal) {
                const value = this.normalizeInstructionValue(newVal ? JSON.parse(JSON.stringify(newVal)) : '');
                if (value !== this.instruction) {
                    this.instruction = value;
                    this.$nextTick(() => this.scheduleRenderEditorFromInstruction());
                }
            }
        },
        isViewMode: {
            immediate: true,
            handler() {
                this.$nextTick(() => this.scheduleRenderEditorFromInstruction());
            }
        }
    },
    mounted() {
        this.$nextTick(() => this.scheduleRenderEditorFromInstruction());
    },
    beforeUnmount() {
        try {
            if (this.editorRenderRaf) cancelAnimationFrame(this.editorRenderRaf);
        } catch (e) {
            // ignore
        }
    },
    methods: {
        scheduleRenderEditorFromInstruction() {
            if (this.isViewMode) return;
            if (this.editorRenderRaf) return;
            this.editorRenderRaf = requestAnimationFrame(() => {
                this.editorRenderRaf = null;
                this.renderEditorFromInstruction();
            });
        },
        renderEditorFromInstruction() {
            const editor = this.$refs.instructionEditor;
            if (!editor) return;

            // 현재 선택/커서 위치를 최대한 유지하려고 시도
            const caretIndex = this.getEditorCaretIndexInSerializedText();

            editor.innerHTML = '';
            const segments = this.parseInstruction(this.instruction || '');
            segments.forEach((seg) => {
                if (seg.type === 'text') {
                    editor.appendChild(document.createTextNode(seg.text || ''));
                    return;
                }

                // mention: 실제 저장 토큰은 data-raw로 들고, 화면에는 라벨을 칩처럼 렌더
                const chip = document.createElement('span');
                chip.className = 'instruction-chip';
                chip.setAttribute('contenteditable', 'false');
                chip.dataset.raw = seg.raw || '';
                chip.dataset.type = seg.mention && seg.mention.type ? String(seg.mention.type) : 'agent';
                chip.textContent = `@${seg.mention && seg.mention.label != null ? String(seg.mention.label) : ''}`;
                editor.appendChild(chip);
            });

            this.$nextTick(() => {
                this.setEditorCaretBySerializedIndex(caretIndex);
            });
        },
        serializeEditorToInstruction() {
            const editor = this.$refs.instructionEditor;
            if (!editor) return (this.instruction || '').toString();
            let out = '';
            editor.childNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    out += node.textContent || '';
                    return;
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node;
                    if (el.classList && el.classList.contains('instruction-chip')) {
                        out += el.dataset && el.dataset.raw ? el.dataset.raw : '';
                    } else {
                        out += el.textContent || '';
                    }
                }
            });
            return out;
        },
        getEditorCaretIndexInSerializedText() {
            const editor = this.$refs.instructionEditor;
            if (!editor) return 0;
            const sel = window.getSelection && window.getSelection();
            if (!sel || sel.rangeCount === 0) return 0;
            const range = sel.getRangeAt(0);
            if (!editor.contains(range.startContainer)) return 0;

            let idx = 0;
            const nodes = Array.from(editor.childNodes);
            for (const node of nodes) {
                if (node === range.startContainer || (node.nodeType === Node.ELEMENT_NODE && node.contains && node.contains(range.startContainer))) {
                    // 커서가 텍스트 노드 안에 있을 때
                    if (range.startContainer.nodeType === Node.TEXT_NODE) {
                        idx += range.startOffset;
                    }
                    // 커서가 에디터 직속 노드 사이에 있을 때
                    if (range.startContainer === editor) {
                        // startOffset은 child index
                        // 앞쪽 노드들의 길이를 이미 누적해둔 상태라 추가할 게 없다
                    }
                    break;
                }

                if (node.nodeType === Node.TEXT_NODE) {
                    idx += (node.textContent || '').length;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node;
                    if (el.classList && el.classList.contains('instruction-chip')) {
                        idx += (el.dataset && el.dataset.raw ? el.dataset.raw : '').length;
                    } else {
                        idx += (el.textContent || '').length;
                    }
                }
            }
            return idx;
        },
        setEditorCaretBySerializedIndex(targetIdx) {
            const editor = this.$refs.instructionEditor;
            if (!editor) return;
            const idx = Math.max(0, Number(targetIdx || 0));

            let acc = 0;
            const range = document.createRange();
            const sel = window.getSelection && window.getSelection();

            for (const node of Array.from(editor.childNodes)) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const len = (node.textContent || '').length;
                    if (acc + len >= idx) {
                        range.setStart(node, Math.max(0, idx - acc));
                        range.collapse(true);
                        sel && (sel.removeAllRanges(), sel.addRange(range));
                        return;
                    }
                    acc += len;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node;
                    const rawLen = el.classList && el.classList.contains('instruction-chip') ? ((el.dataset && el.dataset.raw ? el.dataset.raw : '').length) : (el.textContent || '').length;
                    if (acc + rawLen >= idx) {
                        // 칩 내부로 커서를 넣지 않고 칩 뒤로 보낸다
                        range.setStartAfter(el);
                        range.collapse(true);
                        sel && (sel.removeAllRanges(), sel.addRange(range));
                        return;
                    }
                    acc += rawLen;
                }
            }
            // 끝으로
            range.selectNodeContents(editor);
            range.collapse(false);
            sel && (sel.removeAllRanges(), sel.addRange(range));
        },
        onEditorInput() {
            const text = this.serializeEditorToInstruction();
            this.instruction = text;

            const caretPos = this.getEditorCaretIndexInSerializedText();
            this.cursorPosition = caretPos;
            this.updateMentionMenuState(text, caretPos);
        },
        onEditorCaretEvent() {
            const text = this.serializeEditorToInstruction();
            const caretPos = this.getEditorCaretIndexInSerializedText();
            this.cursorPosition = caretPos;
            this.updateMentionMenuState(text, caretPos);
        },
        onArrowKey(event) {
            // 방향키를 눌렀을 때, 현재 커서 위치가 멘션 영역이 아니라면
            // 멘션 메뉴를 닫고 기본 방향키 동작을 그대로 허용한다.
            const text = (this.instruction || '').toString();
            const caretPos = this.getEditorCaretIndexInSerializedText();

            const ctx = this.getMentionContext(text, caretPos);
            if (!ctx) {
                this.showMentionMenu = false;
                this.mentionStartIndex = null;
                this.mentionQuery = '';
            }
            // 멘션 영역일 때는 별도 처리를 하지 않고,
            // 기본 방향키 동작 및 v-menu 내 네비게이션을 그대로 두어 UX를 유지한다.
        },
        updateMentionMenuState(text, caretPos) {
            const s = (text || '').toString();
            const pos = Math.max(0, Math.min(Number(caretPos || 0), s.length));

            let ctx = this.getMentionContext(s, pos);

            // 커서가 정확히 '@' 위에 있을 때도 멘션으로 인식되도록 보정
            if (!ctx && pos < s.length && s.charAt(pos) === '@') {
                ctx = this.getMentionContext(s, pos + 1);
            }

            if (ctx) {
                this.mentionStartIndex = ctx.startIndex;
                // 저장된 포맷(@type:id)처럼 ':'가 포함된 경우에는 전체 목록을 보여주기 위해 필터를 비운다.
                this.mentionQuery = ctx.query && ctx.query.includes(':') ? '' : ctx.query;
                this.showMentionMenu = true;
            } else {
                this.mentionStartIndex = null;
                this.mentionQuery = '';
                this.showMentionMenu = false;
            }
        },
        getMentionContext(text, caretPos) {
            const s = (text || '').toString();
            const pos = Math.max(0, Math.min(Number(caretPos || 0), s.length));
            const beforeCaret = s.slice(0, pos);
            // 공백/구두점 등으로 끊기는 "@토큰" 패턴만 인식
            const m = /(^|[\s([{"'`])@([0-9A-Za-z가-힣._:-]*)$/.exec(beforeCaret);
            if (!m) return null;
            const at = beforeCaret.lastIndexOf('@');
            if (at < 0) return null;
            const query = (m[2] || '').toString();
            return { startIndex: at, query };
        },
        selectMention(item) {
            if (this.mentionStartIndex === null) {
                this.showMentionMenu = false;
                return;
            }

            const fullText = (this.instruction || '').toString();
            const length = fullText.length;
            const caretPos = Math.max(0, Math.min(this.cursorPosition || length, length));
            const start = Math.max(0, Math.min(this.mentionStartIndex, length));

            const before = fullText.substring(0, start);
            const after = fullText.substring(caretPos);

            const token = this.buildMentionToken(item);
            const nextText = `${before}${token} ${after}`;
            this.instruction = nextText;

            this.showMentionMenu = false;
            this.mentionStartIndex = null;
            this.mentionQuery = '';

            const nextPos = before.length + token.length + 1;
            this.cursorPosition = nextPos;

            this.$nextTick(() => {
                try {
                    const editor = this.$refs.instructionEditor;
                    editor && editor.focus && editor.focus();
                    this.renderEditorFromInstruction();
                    this.setEditorCaretBySerializedIndex(nextPos);
                } catch (e) {
                    // ignore
                }
            });
        },
        buildMentionToken(item) {
            const type = item && item.type ? String(item.type) : 'agent';
            const id = item && item.id != null ? String(item.id) : '';
            // 토큰은 "@type:id" 형태로 저장한다. (예: @agent:123)
            return `@${type}:${id}`;
        },
        getMentionTypeMeta(type) {
            const key = (type || 'agent').toString();
            const map = this.mentionTypeMeta;
            if (map && map[key]) {
                return map[key];
            }
            return map.agent || { color: 'primary', icon: 'mdi-account-circle', labelKey: 'BpmnPropertyPanel.mentionType.agent' };
        },
        parseInstruction(text) {
            const s = (text || '').toString();
            const segments = [];
            // "@토큰"을 기준으로 파싱한다.
            // - 신규 포맷: @type:id (예: @agent:123)
            // - 구버전 포맷: @label (예: @담당자)
            const regex = /@([0-9A-Za-z가-힣._:-]+)/g;
            let lastIndex = 0;
            let m;

            const candidateList = Array.isArray(this.mentionCandidates) ? this.mentionCandidates : [];

            // eslint-disable-next-line no-cond-assign
            while ((m = regex.exec(s)) !== null) {
                if (m.index > lastIndex) {
                    segments.push({
                        type: 'text',
                        text: s.slice(lastIndex, m.index)
                    });
                }

                const token = m[1]; // "type:id" 또는 "label"
                let type = 'agent';
                let id = null;
                let label = token;

                if (token.includes(':')) {
                    // 신규 포맷: type:id
                    const parts = token.split(':', 2);
                    const rawType = parts[0] || 'agent';
                    const rawKey = parts[1] || '';

                    type = rawType;

                    // 1순위: type + id 매칭
                    let candidate = candidateList.find((c) => {
                        const cType = c && c.type != null ? String(c.type) : '';
                        const cId = c && c.id != null ? String(c.id) : '';
                        return cType === rawType && cId === rawKey;
                    });

                    // 2순위: type + label 매칭 (혹시 id 대신 name을 저장했을 경우)
                    if (!candidate) {
                        candidate = candidateList.find((c) => {
                            const cType = c && c.type != null ? String(c.type) : '';
                            const cLabel = c && c.label != null ? String(c.label) : '';
                            return cType === rawType && cLabel === rawKey;
                        });
                    }

                    if (candidate) {
                        id = candidate.id != null ? String(candidate.id) : rawKey;
                        label = candidate.label != null ? String(candidate.label) : rawKey;
                    } else {
                        // 후보 목록에 없어도 최소한 type/id는 유지
                        id = rawKey;
                        label = rawKey;
                    }
                } else {
                    // 구버전 포맷: @label
                    const tokenLabel = token;
                    const candidate =
                        candidateList.find((c) => {
                            const cLabel = c && c.label != null ? String(c.label) : '';
                            return cLabel === tokenLabel;
                        }) || null;

                    if (candidate) {
                        type = candidate.type != null ? String(candidate.type) : 'agent';
                        id = candidate.id != null ? String(candidate.id) : null;
                        label = candidate.label != null ? String(candidate.label) : tokenLabel;
                    } else {
                        // type 정보를 알 수 없으면 기본값(agent) + label만 유지
                        type = 'agent';
                        id = null;
                        label = tokenLabel;
                    }
                }

                segments.push({
                    type: 'mention',
                    mention: { type, id, label },
                    raw: `@${token}`
                });
                lastIndex = regex.lastIndex;
            }

            if (lastIndex < s.length) {
                segments.push({
                    type: 'text',
                    text: s.slice(lastIndex)
                });
            }

            return segments;
        },
        normalizeInstructionValue(value) {
            const s = (value || '').toString();
            // 이전 포맷([[mention:type=id|label]])을 "@type:id" 형식으로 변환
            return s
                .replace(/\\r\\n/g, '\n')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\n')
                .replace(/\[\[mention:([a-zA-Z]+)=([^|]+)\|([^\]]+)\]\]/g, '@$1:$2');
        }
    }
};
</script>

<style scoped>
.instruction-mention-menu {
    width: 600px;
    max-width: 600px;
}

.instruction-mention-list .v-list-item-title,
.instruction-mention-list .v-list-item-subtitle {
    white-space: normal;
    word-break: break-word;
}

.instruction-preview {
    min-height: 40px;
    padding: 10px 12px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 6px;
    background: rgba(var(--v-theme-surface), 0.9);
}

.instruction-preview-text {
    white-space: pre-wrap;
    word-break: break-word;
}

.instruction-mention-chip {
    vertical-align: middle;
}

.instruction-editor-wrap {
    width: 100%;
}

.instruction-editor {
    min-height: 96px;
    max-height: 240px;
    overflow: auto;
    padding: 10px 12px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 6px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-on-surface));
    white-space: pre-wrap;
    word-break: break-word;
    outline: none;
    line-height: 1.5;
}

.instruction-editor:focus {
    border-color: rgba(var(--v-theme-primary), 0.7);
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.18);
}

.instruction-editor ::selection {
    background: rgba(var(--v-theme-primary), 0.35);
}

.instruction-chip {
    display: inline-block;
    margin: 0 2px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(var(--v-theme-primary), 0.12);
    color: rgb(var(--v-theme-primary));
    font-size: 12px;
    line-height: 1.4;
    vertical-align: baseline;
    user-select: none;
}
</style>
