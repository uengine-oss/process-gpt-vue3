<template>
    <div class="task-io-field">
        <!-- ReadOnly(조회) 뷰 · 다이얼로그 모드 요약: 문서형 카드로 표시 -->
        <template v-if="readonly || dialogMode">
            <div v-for="section in sections" :key="section.key" class="io-view-section mb-4">
                <div class="io-view-header" :class="`io-view-header--${section.key}`">
                    <v-icon size="16" class="mr-1">{{ section.icon }}</v-icon>
                    {{ section.label }}
                </div>
                <ul v-if="local[section.key].length > 0" class="io-view-list">
                    <li v-for="(item, index) in local[section.key]" :key="index" class="io-view-item">
                        <span v-if="section.ordered" class="io-view-step mr-2">{{ index + 1 }}</span>
                        <v-icon v-else size="14" class="mr-1 io-view-item-icon">mdi-file-document-outline</v-icon>
                        <span class="io-view-item-text">{{ item }}</span>
                    </li>
                </ul>
                <div v-else class="io-view-empty">{{ $t('taskIo.empty') || '등록된 항목이 없습니다.' }}</div>
            </div>

            <!-- 다이얼로그 입력 모드 (PAL 속성패널): 요약 아래 편집 버튼, 입력은 넓은 다이얼로그에서 -->
            <template v-if="dialogMode && !readonly">
                <v-btn
                    size="small"
                    variant="tonal"
                    color="primary"
                    :prepend-icon="hasItems ? 'mdi-pencil' : 'mdi-plus'"
                    @click="openDialog"
                >
                    {{ hasItems ? $t('taskIo.edit') || '항목 편집' : $t('taskIo.addItem') || '항목 추가' }}
                </v-btn>

                <v-dialog v-model="dialogOpen" max-width="720" scrollable>
                    <v-card>
                        <v-card-title class="d-flex align-center">
                            <v-icon size="20" color="blue" class="mr-2">mdi-swap-horizontal</v-icon>
                            <span>{{ $t('taskIo.tab') || '세부 업무 수행 절차' }}</span>
                        </v-card-title>
                        <v-card-text>
                            <div v-for="section in sections" :key="section.key" class="mb-2">
                                <div class="d-flex align-center mb-2">
                                    <h6 class="text-body-1">
                                        <v-icon size="16" class="mr-1">{{ section.icon }}</v-icon>
                                        {{ section.label }}
                                    </h6>
                                    <v-spacer />
                                    <span class="io-edit-hint">{{ section.hint }}</span>
                                </div>
                                <!-- 절차 한 단계 안에서도 줄바꿈이 필요하므로 textarea(auto-grow) 사용 -->
                                <div v-for="(item, index) in draft[section.key]" :key="index" class="d-flex align-start mb-2">
                                    <span v-if="section.ordered" class="io-view-step io-edit-step mr-2">{{ index + 1 }}</span>
                                    <v-textarea
                                        :model-value="item"
                                        density="compact"
                                        variant="outlined"
                                        hide-details
                                        auto-grow
                                        rows="1"
                                        :placeholder="section.placeholder"
                                        @update:model-value="(val) => (draft[section.key][index] = val)"
                                    />
                                    <v-btn icon variant="text" size="small" class="ml-1" @click="draft[section.key].splice(index, 1)">
                                        <v-icon size="18">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </div>
                                <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addDraftItem(section.key)">
                                    {{ $t('taskIo.addItem') || '항목 추가' }}
                                </v-btn>
                            </div>
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer />
                            <v-btn variant="text" @click="dialogOpen = false">{{ $t('taskIo.cancel') || '취소' }}</v-btn>
                            <v-btn color="primary" variant="flat" @click="applyDialog">{{ $t('taskIo.save') || '저장' }}</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
            </template>
        </template>

        <!-- 편집(입력) 뷰: 항목별 입력창 + 추가/삭제 (인라인 — 비 PAL PALUserTaskPanel 등 기존 경로) -->
        <template v-else>
            <div v-for="section in sections" :key="section.key" class="mb-5">
                <div class="d-flex align-center mb-2">
                    <h6 class="text-body-1">
                        <v-icon size="16" class="mr-1">{{ section.icon }}</v-icon>
                        {{ section.label }}
                    </h6>
                    <v-spacer />
                    <span class="io-edit-hint">{{ section.hint }}</span>
                </div>
                <div v-for="(item, index) in local[section.key]" :key="index" class="d-flex align-center mb-2">
                    <span v-if="section.ordered" class="io-view-step mr-2">{{ index + 1 }}</span>
                    <v-text-field
                        :model-value="item"
                        density="compact"
                        variant="outlined"
                        hide-details
                        :placeholder="section.placeholder"
                        @update:model-value="(val) => updateItem(section.key, index, val)"
                    />
                    <v-btn icon variant="text" size="small" class="ml-1" @click="removeItem(section.key, index)">
                        <v-icon size="18">mdi-delete-outline</v-icon>
                    </v-btn>
                </div>
                <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addItem(section.key)">
                    {{ $t('taskIo.addItem') || '항목 추가' }}
                </v-btn>
            </div>
        </template>
    </div>
</template>

<script>
export default {
    name: 'task-io-field',
    props: {
        // 세부 업무 수행 절차의 단계 목록 — 순서가 의미를 가진다 (string[] 또는 null)
        procedure: Array,
        readonly: Boolean,
        // true면 패널에 요약(문서형 뷰)만 보여주고 입력은 다이얼로그에서 받는다 (좁은 속성패널용).
        // 기본 false — 비 PAL(PALUserTaskPanel) 인라인 편집 동작 유지.
        dialogMode: { type: Boolean, default: false }
    },
    emits: ['update:procedure'],
    data() {
        return {
            local: {
                procedure: this.normalize(this.procedure)
            },
            syncing: false,
            dialogOpen: false,
            draft: {
                procedure: []
            }
        };
    },
    computed: {
        hasItems() {
            return this.local.procedure.length > 0;
        },
        sections() {
            return [
                {
                    key: 'procedure',
                    icon: 'mdi-format-list-numbered',
                    ordered: true,
                    label: this.$t('taskIo.procedure') || '업무 수행 절차',
                    hint: this.$t('taskIo.procedureHint') || '이 업무를 수행하는 단계별 절차',
                    placeholder: this.$t('taskIo.procedurePlaceholder') || '예: 내부심사 체크리스트를 기준으로 심사 수행'
                }
            ];
        }
    },
    watch: {
        procedure: {
            deep: true,
            handler(newVal) {
                if (this.syncing) return;
                this.local.procedure = this.normalize(newVal);
            }
        }
    },
    methods: {
        normalize(value) {
            if (Array.isArray(value)) return value.map((v) => (v == null ? '' : v.toString()));
            if (typeof value === 'string' && value) return [value];
            return [];
        },
        addItem(key) {
            this.local[key].push('');
        },
        openDialog() {
            // 다이얼로그는 초안(draft)을 편집하고 저장을 눌러야만 모델에 반영한다.
            this.draft = { procedure: this.normalize(this.local.procedure) };
            if (this.draft.procedure.length === 0) this.addDraftItem('procedure');
            this.dialogOpen = true;
        },
        addDraftItem(key) {
            this.draft[key].push('');
        },
        applyDialog() {
            // 빈 행은 요약에도 남지 않게 걸러서 반영한다.
            this.local.procedure = this.draft.procedure.map((v) => (v || '').toString()).filter((v) => v.trim());
            this.emitChange('procedure');
            this.dialogOpen = false;
        },
        removeItem(key, index) {
            this.local[key].splice(index, 1);
            this.emitChange(key);
        },
        updateItem(key, index, value) {
            this.local[key][index] = value;
            this.emitChange(key);
        },
        emitChange(key) {
            if (key !== 'procedure') return;
            const cleaned = this.local[key].map((v) => (v || '').toString().trim()).filter(Boolean);
            this.syncing = true;
            // 전부 비어 있으면 null을 내보내 태스크 JSON에 빈 배열이 저장되지 않게 한다. (RaciField와 동일 규칙)
            this.$emit(`update:${key}`, cleaned.length > 0 ? cleaned : null);
            this.$nextTick(() => {
                this.syncing = false;
            });
        }
    }
};
</script>

<style scoped>
.io-edit-hint {
    font-size: 11px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
    white-space: nowrap;
}

/* ReadOnly 문서형 뷰 */
.io-view-section {
    border: 1px solid var(--cds-border-subtle, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    overflow: hidden;
}

.io-view-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
}

.io-view-header--procedure {
    background: var(--cds-layer-accent, rgba(103, 58, 183, 0.08));
    color: var(--cds-support-info, #5e35b1);
}

.io-view-step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--cds-layer-accent, rgba(103, 58, 183, 0.12));
    color: var(--cds-support-info, #5e35b1);
    font-size: 11px;
    font-weight: 600;
}

.io-view-list {
    list-style: none;
    margin: 0;
    padding: 8px 12px;
}

.io-view-item {
    display: flex;
    align-items: flex-start;
    padding: 4px 0;
    font-size: 13px;
}

/* 단계 내용의 줄바꿈(\n)을 그대로 표시 */
.io-view-item-text {
    white-space: pre-line;
    word-break: break-word;
    min-width: 0;
}

/* textarea 편집 행에서 단계 번호를 첫 줄 높이에 맞춘다 */
.io-edit-step {
    margin-top: 10px;
}

.io-view-item-icon {
    color: var(--cds-icon-secondary, rgba(0, 0, 0, 0.54));
}

.io-view-empty {
    padding: 12px;
    font-size: 12px;
    color: var(--cds-text-secondary, rgba(0, 0, 0, 0.6));
}
</style>
