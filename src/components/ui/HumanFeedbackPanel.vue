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

        <div v-if="impactPreview && impactPreview.length" class="human-feedback-panel__meta">
            <div class="human-feedback-panel__meta-title">예상 반영 결과</div>
            <ul class="human-feedback-panel__meta-list">
                <li v-for="(line, idx) in impactPreview" :key="`impact-${idx}`">{{ line }}</li>
            </ul>
        </div>

        <div v-if="evidenceSpans && evidenceSpans.length" class="human-feedback-panel__meta">
            <div class="human-feedback-panel__meta-title">근거 문장</div>
            <ul class="human-feedback-panel__meta-list">
                <li v-for="(line, idx) in evidenceSpans" :key="`evi-${idx}`">{{ line }}</li>
            </ul>
        </div>

        <!-- 아이템 선택 모드 (select_items) -->
        <div v-if="feedbackType === 'select_items'" class="human-feedback-panel__items">
            <div
                v-for="item in items"
                :key="item.id"
                class="human-feedback-panel__item"
                :class="{ 'is-selected': isItemSelected(item.id), 'is-disabled': submitted }"
                role="checkbox"
                :aria-checked="isItemSelected(item.id)"
                :tabindex="submitted ? -1 : 0"
                @click="onItemRowActivate(item.id)"
                @keydown.enter.prevent="onItemRowActivate(item.id)"
                @keydown.space.prevent="onItemRowActivate(item.id)"
            >
                <v-checkbox
                    :model-value="isItemSelected(item.id)"
                    density="compact"
                    hide-details
                    :disabled="submitted"
                    tabindex="-1"
                    readonly
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

        <!--
            "직접 입력" (Other) — claude code 식 A/B/C/Other 패턴.
            select_items / suggestions 모드에서 allowOther=true 면 표시.
            사용자는 옵션 선택 + 자유 의견 추가 또는 자유 의견만 단독 제출 가능.
        -->
        <div
            v-if="
                allowOther &&
                (feedbackType === 'select_items' || feedbackType === 'suggestions')
            "
            class="human-feedback-panel__other"
        >
            <div class="human-feedback-panel__other-label">직접 입력 (선택)</div>
            <v-textarea
                v-model="customText"
                :disabled="submitted"
                variant="outlined"
                density="compact"
                rows="2"
                auto-grow
                hide-details
                placeholder="원하시는 내용을 자유롭게 입력하세요"
                class="human-feedback-panel__other-input"
            />
        </div>

        <!-- 승인/반려 + 보정 입력 (approve_reject_with_edit) -->
        <div v-if="feedbackType === 'approve_reject_with_edit'" class="human-feedback-panel__decision">
            <div class="human-feedback-panel__decision-buttons">
                <v-btn
                    size="small"
                    :color="decision === 'approve' ? 'success' : undefined"
                    :variant="decision === 'approve' ? 'flat' : 'outlined'"
                    :disabled="submitted"
                    @click="!submitted && setDecision('approve')"
                >
                    승인
                </v-btn>
                <v-btn
                    size="small"
                    :color="decision === 'reject' ? 'error' : undefined"
                    :variant="decision === 'reject' ? 'flat' : 'outlined'"
                    :disabled="submitted"
                    @click="!submitted && setDecision('reject')"
                >
                    반려
                </v-btn>
            </div>

            <div v-if="suggestions && suggestions.length" class="human-feedback-panel__suggestions">
                <v-chip
                    v-for="(suggestion, idx) in suggestions"
                    :key="`decision-suggestion-${idx}`"
                    :color="selectedSuggestion === suggestion ? 'primary' : undefined"
                    :variant="selectedSuggestion === suggestion ? 'flat' : 'outlined'"
                    :disabled="submitted"
                    @click="!submitted && selectSuggestion(suggestion)"
                    class="human-feedback-panel__chip"
                >
                    {{ suggestion }}
                </v-chip>
            </div>

            <v-textarea
                v-model="freeText"
                :disabled="submitted"
                variant="outlined"
                density="compact"
                rows="2"
                auto-grow
                hide-details
                placeholder="판단 근거나 수정 의견을 입력하세요 (선택)"
                class="mt-2"
            />
        </div>

        <!-- 확인/전송 영역 (multi-question 컨테이너에 들어가 hideSubmit=true 면 숨김) -->
        <div v-if="!submitted && !hideSubmit" class="human-feedback-panel__actions">
            <span v-if="feedbackType === 'select_items' && selectedIds.size > 0" class="human-feedback-panel__count">
                {{ selectedIds.size }}개 선택됨
            </span>
            <v-spacer />
            <v-btn v-if="allowSkip" variant="text" size="small" @click="handleSkip"> 건너뛰기 </v-btn>
            <v-btn color="primary" size="small" variant="flat" :disabled="!canSubmit" @click="handleSubmit">
                {{ submitLabel }}
            </v-btn>
        </div>

        <!-- 제출 완료 표시 (hideSubmit=true 면 숨김 — multi-step 에서 체크박스 유지) -->
        <div v-else-if="submitted" class="human-feedback-panel__submitted">
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
            default: 'select_items'
        },
        /** 사용자에게 보여줄 질문/안내 */
        question: {
            type: String,
            default: '선택해 주세요.'
        },
        /** 추가 설명 텍스트 */
        context: {
            type: String,
            default: ''
        },
        /** 선택 가능한 아이템 리스트 [{id, label, description}] */
        items: {
            type: Array,
            default: () => []
        },
        /** 제안 리스트 (suggestions 모드) */
        suggestions: {
            type: Array,
            default: () => []
        },
        evidenceSpans: {
            type: Array,
            default: () => []
        },
        impactPreview: {
            type: Array,
            default: () => []
        },
        /** 복수 선택 허용 */
        allowMultiple: {
            type: Boolean,
            default: true
        },
        /** 최소 선택 개수 */
        minSelect: {
            type: Number,
            default: 1
        },
        /** 건너뛰기 허용 */
        allowSkip: {
            type: Boolean,
            default: false
        },
        /** 제출 버튼 텍스트 */
        submitLabel: {
            type: String,
            default: '확인'
        },
        /** 헤더 아이콘 */
        headerIcon: {
            type: String,
            default: 'mdi-comment-question-outline'
        },
        /** 이미 제출된 상태 (읽기 전용) */
        submitted: {
            type: Boolean,
            default: false
        },
        /** 제출 후 표시 텍스트 */
        submittedText: {
            type: String,
            default: '응답 완료'
        },
        /**
         * 초기 선택 상태 (제출 완료 후 readonly 표시할 때 사용).
         * 부모가 제출 시 message.__humanFeedback.__selectedIds 등에 저장해두면
         * 페이지 리로드/리렌더 후에도 사용자가 무엇을 골랐는지 그대로 보인다.
         */
        initialSelectedIds: {
            type: Array,
            default: () => []
        },
        initialSelectedSuggestion: {
            type: String,
            default: null
        },
        initialDecision: {
            type: String,
            default: ''
        },
        initialFreeText: {
            type: String,
            default: ''
        },
        initialCustomText: {
            type: String,
            default: ''
        },
        /** "직접 입력" (Other) 옵션 활성화. select_items / suggestions 모드에 자유 텍스트 추가. */
        allowOther: {
            type: Boolean,
            default: false
        },
        /**
         * 자체 "응답 제출" 버튼 숨김. 부모 컨테이너가 multi-question 통합 제출 버튼을 가질 때 사용.
         * 부모는 ref 로 패널의 getResponse() 를 호출해 응답 수집.
         */
        hideSubmit: {
            type: Boolean,
            default: false
        }
    },
    emits: ['submit', 'skip', 'selection-change'],
    data() {
        return {
            selectedIds: new Set(
                (this.initialSelectedIds || []).map((x) => String(x ?? '').trim()).filter(Boolean)
            ),
            selectedSuggestion: this.initialSelectedSuggestion || null,
            decision: this.initialDecision || '',
            freeText: this.initialFreeText || '',
            customText: this.initialCustomText || '',
            _selectionNotifyTimer: null
        };
    },
    watch: {
        // 부모가 readonly 상태로 전환하면서 새 초기 선택값을 넘겨준 경우 동기화.
        // (component 가 unmount 되지 않는 일반 케이스에서는 이미 data 에 보존됨)
        initialSelectedIds(val) {
            if (!Array.isArray(val) || val.length === 0) return;
            const next = new Set(val.map((x) => String(x ?? '').trim()).filter(Boolean));
            if (this.submitted) {
                if (this.selectedIds.size === 0) this.selectedIds = next;
                return;
            }
            this.selectedIds = next;
        },
        initialSelectedSuggestion(val) {
            if (this.submitted && val && !this.selectedSuggestion) {
                this.selectedSuggestion = val;
            }
        },
        initialDecision(val) {
            if (this.submitted && val && !this.decision) {
                this.decision = val;
            }
        },
        initialFreeText(val) {
            if (this.submitted && val && !this.freeText) {
                this.freeText = val;
            }
        },
        initialCustomText(val) {
            if (this.submitted && val && !this.customText) {
                this.customText = val;
            }
        },
        customText() {
            this.notifySelectionChange();
        }
    },
    computed: {
        canSubmit() {
            // allowOther + customText 가 있으면 옵션 미선택 상태에서도 제출 가능
            const hasCustom = this.allowOther && (this.customText || '').trim().length > 0;
            if (this.feedbackType === 'select_items') {
                return this.selectedIds.size >= this.minSelect || hasCustom;
            }
            if (this.feedbackType === 'suggestions') {
                return this.selectedSuggestion !== null || hasCustom;
            }
            if (this.feedbackType === 'approve_reject_with_edit') {
                // 승인/반려를 고르거나, 고르지 않아도 수정 의견을 적었으면 제출 가능.
                return (
                    this.decision === 'approve' ||
                    this.decision === 'reject' ||
                    (this.freeText || '').trim().length > 0
                );
            }
            return true; // confirm 모드
        }
    },
    beforeUnmount() {
        if (this._selectionNotifyTimer) {
            clearTimeout(this._selectionNotifyTimer);
            this._selectionNotifyTimer = null;
        }
    },
    methods: {
        notifySelectionChange() {
            if (this.submitted) return;
            if (this._selectionNotifyTimer) {
                clearTimeout(this._selectionNotifyTimer);
            }
            const delay = this.hideSubmit
                ? 0
                : (this.feedbackType === 'select_items' && this.allowMultiple ? 700 : 120);
            this._selectionNotifyTimer = setTimeout(() => {
                this._selectionNotifyTimer = null;
                this.$emit('selection-change', {
                    canSubmit: this.canSubmit,
                    feedbackType: this.feedbackType
                });
            }, delay);
        },
        itemKey(id) {
            return String(id ?? '').trim();
        },
        isItemSelected(id) {
            const key = this.itemKey(id);
            return key ? this.selectedIds.has(key) : false;
        },
        onItemRowActivate(id) {
            if (this.submitted) return;
            this.toggleItem(id);
        },
        toggleItem(id) {
            if (this.submitted) return;
            const key = this.itemKey(id);
            if (!key) return;
            const newSet = new Set(this.selectedIds);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                if (!this.allowMultiple) {
                    newSet.clear();
                }
                newSet.add(key);
            }
            this.selectedIds = newSet;
            this.notifySelectionChange();
        },
        selectSuggestion(suggestion) {
            if (this.submitted) return;
            this.selectedSuggestion = suggestion;
            if (this.feedbackType === 'approve_reject_with_edit' && !this.freeText) {
                this.freeText = suggestion;
            }
            this.notifySelectionChange();
        },
        setDecision(value) {
            if (this.submitted) return;
            this.decision = value;
        },
        handleSubmit() {
            if (!this.canSubmit) return;
            // allowOther 활성 시 customText 를 모든 응답에 포함 (도구는 비어있으면 무시)
            const customText = this.allowOther ? (this.customText || '').trim() : '';
            if (this.feedbackType === 'select_items') {
                const selectedItems = this.items.filter((item) => this.isItemSelected(item.id));
                this.$emit('submit', {
                    type: 'select_items',
                    selectedIds: [...this.selectedIds],
                    selectedItems,
                    customText
                });
            } else if (this.feedbackType === 'suggestions') {
                this.$emit('submit', {
                    type: 'suggestions',
                    selected: this.selectedSuggestion,
                    customText
                });
            } else if (this.feedbackType === 'approve_reject_with_edit') {
                this.$emit('submit', {
                    type: 'approve_reject_with_edit',
                    decision: this.decision,
                    answer:
                        this.decision === 'approve'
                            ? '승인'
                            : this.decision === 'reject'
                              ? '반려'
                              : (this.freeText || '').trim(),
                    reason: (this.freeText || '').trim(),
                    selectedSuggestion: this.selectedSuggestion || null
                });
            } else {
                this.$emit('submit', { type: 'confirm' });
            }
        },
        handleSkip() {
            this.$emit('skip');
        },
        /**
         * 부모(multi-question 컨테이너) 가 ref 로 호출.
         * emit 없이 현재 입력 상태를 응답 객체로 반환.
         * canSubmit=false 면 null 반환.
         */
        snapshotResponse() {
            const customText = this.allowOther ? (this.customText || '').trim() : '';
            if (this.feedbackType === 'select_items') {
                const selectedItems = this.items.filter((item) => this.isItemSelected(item.id));
                return {
                    type: 'select_items',
                    selectedIds: [...this.selectedIds],
                    selectedItems,
                    customText
                };
            }
            if (this.feedbackType === 'suggestions') {
                return {
                    type: 'suggestions',
                    selected: this.selectedSuggestion,
                    customText
                };
            }
            if (this.feedbackType === 'approve_reject_with_edit') {
                return {
                    type: 'approve_reject_with_edit',
                    decision: this.decision,
                    answer:
                        this.decision === 'approve'
                            ? '승인'
                            : this.decision === 'reject'
                              ? '반려'
                              : (this.freeText || '').trim(),
                    reason: (this.freeText || '').trim(),
                    selectedSuggestion: this.selectedSuggestion || null
                };
            }
            return { type: 'confirm' };
        },
        getResponse() {
            if (!this.canSubmit) return null;
            return this.snapshotResponse();
        },
        /** 부모가 통합 submit 버튼 활성화 여부 결정에 사용. */
        getCanSubmit() {
            return !!this.canSubmit;
        }
    }
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
    /* 컨설팅 초안 등 여러 줄 텍스트의 줄바꿈을 보존 */
    white-space: pre-wrap;
    max-height: 320px;
    overflow-y: auto;
}

.human-feedback-panel__meta {
    margin-bottom: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(var(--v-theme-surface), 0.5);
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.human-feedback-panel__meta-title {
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin-bottom: 4px;
}

.human-feedback-panel__meta-list {
    margin: 0;
    padding-left: 14px;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    line-height: 1.45;
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
    align-items: flex-start;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
    user-select: none;
}

.human-feedback-panel__item:not(.is-disabled) .human-feedback-panel__checkbox {
    pointer-events: none;
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
    flex: 1;
    flex-direction: column;
    min-width: 0;
    text-align: left;
    cursor: pointer;
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

/* "직접 입력" 영역 (allowOther) */
.human-feedback-panel__other {
    margin-top: 6px;
    margin-bottom: 10px;
    padding-top: 8px;
    border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.12);
}

.human-feedback-panel__other-label {
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.6);
    margin-bottom: 4px;
}

.human-feedback-panel__other-input {
    width: 100%;
}

.human-feedback-panel__decision-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
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
