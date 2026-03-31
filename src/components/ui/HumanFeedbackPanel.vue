<template>
    <div class="human-feedback-panel" :class="{ 'is-submitted': submitted }">
        <div class="human-feedback-panel__header">
            <v-icon size="18" class="human-feedback-panel__icon">{{ headerIcon }}</v-icon>
            <span class="human-feedback-panel__title">{{ question }}</span>
        </div>

        <!-- 설명/컨텍스트 -->
        <div v-if="context" class="human-feedback-panel__context">
            {{ context }}
        </div>

        <!-- 아이템 선택 모드 (select_items) -->
        <div v-if="feedbackType === 'select_items'" class="human-feedback-panel__items">
            <div
                v-for="item in items"
                :key="item.id"
                class="human-feedback-panel__item"
                :class="{ 'is-selected': selectedIds.has(item.id), 'is-disabled': submitted }"
                @click="!submitted && toggleItem(item.id)"
            >
                <v-checkbox
                    :model-value="selectedIds.has(item.id)"
                    density="compact"
                    hide-details
                    :disabled="submitted"
                    @click.stop="!submitted && toggleItem(item.id)"
                    color="primary"
                    class="human-feedback-panel__checkbox"
                />
                <div class="human-feedback-panel__item-content">
                    <span class="human-feedback-panel__item-label">{{ item.label }}</span>
                    <span v-if="item.description" class="human-feedback-panel__item-desc">
                        {{ item.description }}
                    </span>
                </div>
            </div>
        </div>

        <!-- 제안 선택 모드 (suggestions) -->
        <div v-else-if="feedbackType === 'suggestions'" class="human-feedback-panel__suggestions">
            <v-chip
                v-for="(suggestion, idx) in suggestions"
                :key="idx"
                :color="selectedSuggestion === suggestion ? 'primary' : undefined"
                :variant="selectedSuggestion === suggestion ? 'flat' : 'outlined'"
                :disabled="submitted"
                @click="!submitted && selectSuggestion(suggestion)"
                class="human-feedback-panel__chip"
            >
                {{ suggestion }}
            </v-chip>
        </div>

        <!-- 확인/전송 영역 -->
        <div v-if="!submitted" class="human-feedback-panel__actions">
            <span v-if="feedbackType === 'select_items' && selectedIds.size > 0" class="human-feedback-panel__count">
                {{ selectedIds.size }}개 선택됨
            </span>
            <v-spacer />
            <v-btn
                v-if="allowSkip"
                variant="text"
                size="small"
                @click="handleSkip"
            >
                건너뛰기
            </v-btn>
            <v-btn
                color="primary"
                size="small"
                variant="flat"
                :disabled="!canSubmit"
                @click="handleSubmit"
            >
                {{ submitLabel }}
            </v-btn>
        </div>

        <!-- 제출 완료 표시 -->
        <div v-else class="human-feedback-panel__submitted">
            <v-icon size="14" color="success">mdi-check-circle</v-icon>
            <span>{{ submittedText }}</span>
        </div>
    </div>
</template>

<script>
export default {
    name: 'HumanFeedbackPanel',
    props: {
        /** 피드백 타입: 'select_items' | 'suggestions' | 'confirm' */
        feedbackType: {
            type: String,
            default: 'select_items',
        },
        /** 사용자에게 보여줄 질문/안내 */
        question: {
            type: String,
            default: '선택해 주세요.',
        },
        /** 추가 설명 텍스트 */
        context: {
            type: String,
            default: '',
        },
        /** 선택 가능한 아이템 리스트 [{id, label, description}] */
        items: {
            type: Array,
            default: () => [],
        },
        /** 제안 리스트 (suggestions 모드) */
        suggestions: {
            type: Array,
            default: () => [],
        },
        /** 복수 선택 허용 */
        allowMultiple: {
            type: Boolean,
            default: true,
        },
        /** 최소 선택 개수 */
        minSelect: {
            type: Number,
            default: 1,
        },
        /** 건너뛰기 허용 */
        allowSkip: {
            type: Boolean,
            default: false,
        },
        /** 제출 버튼 텍스트 */
        submitLabel: {
            type: String,
            default: '확인',
        },
        /** 헤더 아이콘 */
        headerIcon: {
            type: String,
            default: 'mdi-comment-question-outline',
        },
        /** 이미 제출된 상태 (읽기 전용) */
        submitted: {
            type: Boolean,
            default: false,
        },
        /** 제출 후 표시 텍스트 */
        submittedText: {
            type: String,
            default: '응답 완료',
        },
    },
    emits: ['submit', 'skip'],
    data() {
        return {
            selectedIds: new Set(),
            selectedSuggestion: null,
        };
    },
    computed: {
        canSubmit() {
            if (this.feedbackType === 'select_items') {
                return this.selectedIds.size >= this.minSelect;
            }
            if (this.feedbackType === 'suggestions') {
                return this.selectedSuggestion !== null;
            }
            return true; // confirm 모드
        },
    },
    methods: {
        toggleItem(id) {
            if (this.submitted) return;
            const newSet = new Set(this.selectedIds);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                if (!this.allowMultiple) {
                    newSet.clear();
                }
                newSet.add(id);
            }
            this.selectedIds = newSet;
        },
        selectSuggestion(suggestion) {
            if (this.submitted) return;
            this.selectedSuggestion = suggestion;
        },
        handleSubmit() {
            if (!this.canSubmit) return;
            if (this.feedbackType === 'select_items') {
                const selectedItems = this.items.filter(item => this.selectedIds.has(item.id));
                this.$emit('submit', {
                    type: 'select_items',
                    selectedIds: [...this.selectedIds],
                    selectedItems,
                });
            } else if (this.feedbackType === 'suggestions') {
                this.$emit('submit', {
                    type: 'suggestions',
                    selected: this.selectedSuggestion,
                });
            } else {
                this.$emit('submit', { type: 'confirm' });
            }
        },
        handleSkip() {
            this.$emit('skip');
        },
    },
};
</script>

<style scoped>
.human-feedback-panel {
    background: rgba(var(--v-theme-surface-variant), 0.08);
    border: 1px solid rgba(var(--v-theme-primary), 0.15);
    border-radius: 12px;
    padding: 14px 16px;
    margin: 8px 0;
    max-width: 480px;
    margin-right: auto;
    text-align: left;
}

.human-feedback-panel.is-submitted {
    opacity: 0.7;
}

.human-feedback-panel__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13.5px;
    font-weight: 600;
    color: rgb(var(--v-theme-on-surface));
}

.human-feedback-panel__icon {
    color: rgb(var(--v-theme-primary));
}

.human-feedback-panel__context {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    margin-bottom: 10px;
    line-height: 1.5;
}

.human-feedback-panel__items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 10px;
}

.human-feedback-panel__item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
}

.human-feedback-panel__item:hover:not(.is-disabled) {
    background: rgba(var(--v-theme-primary), 0.06);
}

.human-feedback-panel__item.is-selected {
    background: rgba(var(--v-theme-primary), 0.1);
}

.human-feedback-panel__item.is-disabled {
    cursor: default;
    pointer-events: none;
}

.human-feedback-panel__checkbox {
    flex-shrink: 0;
    flex: 0 0 auto;
}

.human-feedback-panel__item-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    text-align: left;
}

.human-feedback-panel__item-label {
    font-size: 13px;
    font-weight: 500;
    color: rgb(var(--v-theme-on-surface));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.human-feedback-panel__item-desc {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.human-feedback-panel__suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}

.human-feedback-panel__chip {
    font-size: 12.5px;
}

.human-feedback-panel__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.human-feedback-panel__count {
    font-size: 12px;
    color: rgb(var(--v-theme-primary));
    font-weight: 500;
}

.human-feedback-panel__submitted {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
