<template>
    <div class="instruction-field">
        <v-menu
            v-model="showMentionMenu"
            :close-on-content-click="false"
            location="bottom"
        >
            <template v-slot:activator="{ props }">
                <v-textarea
                    v-bind="props"
                    ref="instructionTextarea"
                    v-model="instruction"
                    :label="$t('BpmnPropertyPanel.instruction')"
                    rows="3"
                    auto-grow
                    @input="onInput"
                    @click="onCaretEvent"
                    @keyup="onCaretEvent"
                    @keydown.up="onArrowKey"
                    @keydown.down="onArrowKey"
                ></v-textarea>
            </template>

            <v-card max-height="300" class="py-1 instruction-mention-menu">
                <v-list
                    v-if="isMentionActive && filteredMentionCandidates.length > 0"
                    density="compact"
                    class="instruction-mention-list"
                >
                    <v-list-item
                        v-for="item in filteredMentionCandidates"
                        :key="item.type + ':' + item.id"
                        @click="selectMention(item)"
                    >
                        <template v-slot:prepend>
                            <v-icon :color="getMentionTypeMeta(item.type).color">
                                {{ getMentionTypeMeta(item.type).icon }}
                            </v-icon>
                        </template>
                        <v-list-item-title>
                            <span class="font-weight-medium">{{ item.label }}</span>
                            <span class="text-caption text-grey-darken-1 ml-1">
                                ({{ $t(getMentionTypeMeta(item.type).labelKey) }})
                            </span>
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

        <div
            v-if="parsedSegments.length > 0"
            class="mt-2 instruction-preview d-flex flex-wrap align-center"
        >
            <span class="text-caption text-medium-emphasis mr-1">
                {{ $t('BpmnPropertyPanel.instructionPreview') || '미리보기' }}:
            </span>

            <template v-for="(segment, index) in parsedSegments" :key="index">
                <v-chip
                    v-if="segment.type === 'mention'"
                    size="x-small"
                    class="ma-1"
                    :color="getMentionTypeMeta(segment.mention.type).color"
                    variant="tonal"
                >
                    <v-icon start size="14">
                        {{ getMentionTypeMeta(segment.mention.type).icon }}
                    </v-icon>
                    @{{ segment.mention.label }}
                </v-chip>
                <span v-else>{{ segment.text }}</span>
            </template>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: String,
        // [{ id, type: 'agent' | 'skill' | 'activity', label, description? }]
        mentionCandidates: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            instruction: this.normalizeInstructionValue(
                this.modelValue ? JSON.parse(JSON.stringify(this.modelValue)) : ''
            ),
            showMentionMenu: false,
            mentionStartIndex: null,
            mentionQuery: '',
            cursorPosition: 0
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
            return list.filter(item => {
                const label = (item && item.label != null) ? item.label.toString() : '';
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
                const value = this.normalizeInstructionValue(
                    newVal ? JSON.parse(JSON.stringify(newVal)) : ''
                );
                if (value !== this.instruction) {
                    this.instruction = value;
                }
            }
        }
    },
    methods: {
        onInput(event) {
            const text = typeof event === 'string'
                ? event
                : (event && event.target && event.target.value) || this.instruction || '';

            this.instruction = text;

            const textarea = this.getTextareaEl(event);
            const caretPos = (textarea && Number.isFinite(textarea.selectionStart))
                ? textarea.selectionStart
                : text.length;

            this.cursorPosition = caretPos;
            this.updateMentionMenuState(text, caretPos);
        },
        onCaretEvent(event) {
            // 텍스트는 그대로 두고, 커서 위치만 기준으로 멘션 메뉴를 갱신한다.
            const text = (this.instruction || '').toString();
            const textarea = this.getTextareaEl(event);
            if (!textarea) {
                return;
            }
            const caretPos = (textarea && Number.isFinite(textarea.selectionStart))
                ? textarea.selectionStart
                : text.length;

            this.cursorPosition = caretPos;
            this.updateMentionMenuState(text, caretPos);
        },
        onArrowKey(event) {
            // 방향키를 눌렀을 때, 현재 커서 위치가 멘션 영역이 아니라면
            // 멘션 메뉴를 닫고 기본 방향키 동작을 그대로 허용한다.
            const text = (this.instruction || '').toString();
            const textarea = this.getTextareaEl(event);
            if (!textarea) {
                return;
            }
            const caretPos = (textarea && Number.isFinite(textarea.selectionStart))
                ? textarea.selectionStart
                : text.length;

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
                this.mentionQuery = (ctx.query && ctx.query.includes(':')) ? '' : ctx.query;
                this.showMentionMenu = true;
            } else {
                this.mentionStartIndex = null;
                this.mentionQuery = '';
                this.showMentionMenu = false;
            }
        },
        getTextareaEl(event) {
            if (event && event.target && (event.target.tagName || '').toLowerCase() === 'textarea') {
                return event.target;
            }
            try {
                const ref = this.$refs.instructionTextarea;
                if (ref && ref.$el) {
                    const ta = ref.$el.querySelector('textarea');
                    return ta || null;
                }
            } catch (e) {
                return null;
            }
            return null;
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
                    const ta = this.getTextareaEl();
                    if (!ta) return;
                    ta.focus && ta.focus();
                    ta.setSelectionRange && ta.setSelectionRange(nextPos, nextPos);
                } catch (e) {
                    // ignore
                }
            });
        },
        buildMentionToken(item) {
            const type = (item && item.type) ? String(item.type) : 'agent';
            const id = (item && item.id != null) ? String(item.id) : '';
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
                    let candidate = candidateList.find(c => {
                        const cType = (c && c.type != null) ? String(c.type) : '';
                        const cId = (c && c.id != null) ? String(c.id) : '';
                        return cType === rawType && cId === rawKey;
                    });

                    // 2순위: type + label 매칭 (혹시 id 대신 name을 저장했을 경우)
                    if (!candidate) {
                        candidate = candidateList.find(c => {
                            const cType = (c && c.type != null) ? String(c.type) : '';
                            const cLabel = (c && c.label != null) ? String(c.label) : '';
                            return cType === rawType && cLabel === rawKey;
                        });
                    }

                    if (candidate) {
                        id = candidate.id != null ? String(candidate.id) : rawKey;
                        label = (candidate.label != null) ? String(candidate.label) : rawKey;
                    } else {
                        // 후보 목록에 없어도 최소한 type/id는 유지
                        id = rawKey;
                        label = rawKey;
                    }
                } else {
                    // 구버전 포맷: @label
                    const tokenLabel = token;
                    const candidate = candidateList.find(c => {
                        const cLabel = (c && c.label != null) ? String(c.label) : '';
                        return cLabel === tokenLabel;
                    }) || null;

                    if (candidate) {
                        type = candidate.type != null ? String(candidate.type) : 'agent';
                        id = candidate.id != null ? String(candidate.id) : null;
                        label = (candidate.label != null) ? String(candidate.label) : tokenLabel;
                    } else {
                        // type 정보를 알 수 없으면 기본값(agent) + label만 유지
                        type = 'agent';
                        id = null;
                        label = tokenLabel;
                    }
                }

                segments.push({
                    type: 'mention',
                    mention: { type, id, label }
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
            return s.replace(/\[\[mention:([a-zA-Z]+)=([^|]+)\|([^\]]+)\]\]/g, '@$1:$2');
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
</style>
