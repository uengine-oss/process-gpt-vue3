<template>
    <v-dialog :model-value="open" max-width="640" @update:model-value="$emit('update:open', $event)">
        <v-card>
            <v-card-title class="d-flex align-center pa-3">
                <v-icon size="18" color="primary" class="mr-2">mdi-flag-plus-outline</v-icon>
                <span class="text-subtitle-1">PI Flag 작성</span>
                <v-spacer />
                <v-btn icon variant="text" size="x-small" @click="$emit('update:open', false)">
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <v-divider />

            <v-card-text class="pa-3">
                <!-- 대상 노드 (있을 때만) -->
                <div class="pi-flag-editor__target mb-3">
                    <v-icon size="13" class="mr-1">mdi-target</v-icon>
                    <template v-if="elementName">
                        <span class="text-caption text-disabled mr-1">대상</span>
                        <span class="text-caption font-weight-medium">{{ elementName }}</span>
                    </template>
                    <span v-else class="text-caption text-disabled">대상 요소 없음 — 프로세스 전반 PI Flag</span>
                </div>

                <!-- 제목 -->
                <v-text-field
                    v-model="form.title"
                    label="제목"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-3"
                    placeholder="개선 이슈 제목"
                />

                <div class="d-flex ga-2 mb-3">
                    <v-select
                        v-model="form.status"
                        :items="[
                            { title: '향후 과제', value: 'open' },
                            { title: '즉시 개선', value: 'resolved' }
                        ]"
                        item-title="title"
                        item-value="value"
                        label="상태"
                        variant="outlined"
                        density="compact"
                        hide-details
                        style="max-width: 50%"
                    />
                    <v-select
                        v-model="form.category"
                        :items="typeOptions"
                        label="유형/카테고리"
                        variant="outlined"
                        density="compact"
                        hide-details
                        clearable
                        style="max-width: 50%"
                    />
                </div>

                <!-- 문제점 -->
                <div class="pi-flag-editor__label">문제점</div>
                <div class="pi-flag-editor__toolbar">
                    <v-btn
                        v-for="b in toolbarButtons"
                        :key="'p-' + b.key"
                        icon
                        variant="text"
                        size="x-small"
                        :title="b.title"
                        @click="applyMarkdown('problem', b)"
                    >
                        <v-icon size="15">{{ b.icon }}</v-icon>
                    </v-btn>
                </div>
                <textarea
                    ref="problemRef"
                    v-model="form.problem"
                    class="pi-flag-editor__textarea"
                    rows="4"
                    placeholder="현행의 문제점을 기술하세요. (bold/code/list 서식 지원)"
                ></textarea>

                <!-- 개선방향 -->
                <div class="pi-flag-editor__label mt-3">개선방향</div>
                <div class="pi-flag-editor__toolbar">
                    <v-btn
                        v-for="b in toolbarButtons"
                        :key="'i-' + b.key"
                        icon
                        variant="text"
                        size="x-small"
                        :title="b.title"
                        @click="applyMarkdown('improvement', b)"
                    >
                        <v-icon size="15">{{ b.icon }}</v-icon>
                    </v-btn>
                </div>
                <textarea
                    ref="improvementRef"
                    v-model="form.improvement"
                    class="pi-flag-editor__textarea"
                    rows="4"
                    placeholder="개선 방향/권고를 기술하세요."
                ></textarea>
            </v-card-text>

            <v-divider />
            <v-card-actions class="pa-3">
                <v-spacer />
                <v-btn variant="text" class="text-none" @click="$emit('update:open', false)">취소</v-btn>
                <v-btn color="primary" variant="flat" class="text-none" :loading="submitting" :disabled="!canSubmit" @click="submit"
                    >등록</v-btn
                >
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
const EMPTY_FORM = () => ({ title: '', status: 'open', category: '', problem: '', improvement: '' });

export default {
    name: 'PiFlagEditorDialog',
    props: {
        open: { type: Boolean, default: false },
        // 대상 요소 이름 (없으면 프로세스 전반 PI Flag)
        elementName: { type: String, default: '' },
        typeOptions: { type: Array, default: () => [] },
        submitting: { type: Boolean, default: false }
    },
    emits: ['update:open', 'submit'],
    data() {
        return {
            form: EMPTY_FORM(),
            toolbarButtons: [
                { key: 'bold', icon: 'mdi-format-bold', title: '굵게', wrap: ['**', '**'] },
                { key: 'code', icon: 'mdi-code-tags', title: '코드', wrap: ['`', '`'] },
                { key: 'bullet', icon: 'mdi-format-list-bulleted', title: '글머리 목록', line: '- ' },
                { key: 'number', icon: 'mdi-format-list-numbered', title: '번호 목록', line: '1. ' }
            ]
        };
    },
    computed: {
        canSubmit() {
            return !!(this.form.title.trim() || this.form.problem.trim());
        }
    },
    watch: {
        open(val) {
            // 열릴 때마다 폼 초기화
            if (val) this.form = EMPTY_FORM();
        }
    },
    methods: {
        applyMarkdown(field, btn) {
            const ref = field === 'problem' ? this.$refs.problemRef : this.$refs.improvementRef;
            if (!ref) return;
            const value = this.form[field] || '';
            const start = ref.selectionStart ?? value.length;
            const end = ref.selectionEnd ?? value.length;
            const selected = value.slice(start, end);
            let next;
            let cursor;
            if (btn.wrap) {
                const [b, a] = btn.wrap;
                next = value.slice(0, start) + b + selected + a + value.slice(end);
                cursor = start + b.length + selected.length + a.length;
            } else if (btn.line) {
                // 선택 영역의 각 줄 앞에 prefix 추가 (선택 없으면 현재 줄)
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const block = value.slice(lineStart, end || start);
                const prefixed = block
                    .split('\n')
                    .map((l) => (l.length ? btn.line + l : btn.line))
                    .join('\n');
                next = value.slice(0, lineStart) + prefixed + value.slice(end || start);
                cursor = lineStart + prefixed.length;
            } else {
                return;
            }
            this.form[field] = next;
            this.$nextTick(() => {
                ref.focus();
                try {
                    ref.setSelectionRange(cursor, cursor);
                } catch {
                    /* ignore */
                }
            });
        },
        submit() {
            if (!this.canSubmit) return;
            this.$emit('submit', {
                title: this.form.title.trim(),
                status: this.form.status || 'open',
                category: this.form.category || '',
                problem: this.form.problem.trim(),
                improvement: this.form.improvement.trim()
            });
        }
    }
};
</script>

<style scoped>
.pi-flag-editor__target {
    display: flex;
    align-items: center;
}
.pi-flag-editor__label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.7);
    margin-bottom: 2px;
}
.pi-flag-editor__toolbar {
    display: flex;
    gap: 2px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    padding: 2px 4px;
    background: rgba(0, 0, 0, 0.02);
}
.pi-flag-editor__textarea {
    width: 100%;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 0 0 4px 4px;
    padding: 8px;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    font-family: inherit;
}
.pi-flag-editor__textarea:focus {
    border-color: rgb(var(--v-theme-primary));
}
</style>
