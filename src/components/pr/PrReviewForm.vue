<template>
    <div class="pr-review-form">
        <div class="prf-label">{{ isOwner ? '리뷰 제출' : '리뷰 코멘트' }}</div>

        <!-- 오너: 액션 선택 -->
        <div v-if="isOwner" class="prf-opts">
            <div
                :class="['prf-opt', { sel: localAction === 'COMMENT', 'prf-opt-cmt': localAction === 'COMMENT' }]"
                @click="localAction = 'COMMENT'"
            >
                <span class="prf-radio"></span> 코멘트
            </div>
            <div
                :class="['prf-opt', { sel: localAction === 'APPROVED', 'prf-opt-ok': localAction === 'APPROVED' }]"
                @click="localAction = 'APPROVED'"
            >
                <span class="prf-radio"></span> 승인
            </div>
            <div
                :class="['prf-opt', { sel: localAction === 'CHANGES_REQUESTED', 'prf-opt-chg': localAction === 'CHANGES_REQUESTED' }]"
                @click="localAction = 'CHANGES_REQUESTED'"
            >
                <span class="prf-radio"></span> 변경요청
            </div>
        </div>

        <textarea
            class="prf-textarea"
            v-model="localComment"
            :placeholder="textareaPlaceholder"
            rows="3"
        ></textarea>

        <div v-if="error" class="prf-error">{{ error }}</div>

        <slot name="status-bar"></slot>

        <div class="prf-footer">
            <button
                :class="['prf-btn', btnClass]"
                :disabled="isDisabled"
                @click="handleSubmit"
            >
                <span v-if="loading">처리 중…</span>
                <span v-else>{{ submitLabel }}</span>
            </button>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PrReviewForm',
    props: {
        isOwner: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        error: { type: String, default: '' }
    },
    emits: ['submit'],
    data() {
        return {
            localAction: this.isOwner ? 'COMMENT' : 'COMMENT',
            localComment: ''
        };
    },
    computed: {
        textareaPlaceholder() {
            if (!this.isOwner) return '코멘트를 작성해 주세요.';
            if (this.localAction === 'APPROVED') return '전반적인 의견 (선택)';
            if (this.localAction === 'CHANGES_REQUESTED') return '변경 요청 사유를 작성해 주세요. (필수)';
            return '코멘트를 남기세요...';
        },
        submitLabel() {
            if (!this.isOwner) return '코멘트 제출';
            if (this.localAction === 'APPROVED') return '승인 제출';
            if (this.localAction === 'CHANGES_REQUESTED') return '변경 요청 제출';
            return '리뷰 제출';
        },
        btnClass() {
            if (!this.isOwner) return 'prf-btn-cmt';
            if (this.localAction === 'APPROVED') return 'prf-btn-ok';
            if (this.localAction === 'CHANGES_REQUESTED') return 'prf-btn-chg';
            return 'prf-btn-cmt';
        },
        isDisabled() {
            if (this.loading) return true;
            if (this.localAction === 'CHANGES_REQUESTED' && !this.localComment.trim()) return true;
            if (!this.isOwner && !this.localComment.trim()) return true;
            if (this.localAction === 'COMMENT' && !this.localComment.trim()) return true;
            return false;
        }
    },
    methods: {
        handleSubmit() {
            this.$emit('submit', this.localAction, this.localComment);
            this.localComment = '';
        }
    }
};
</script>

<style scoped>
.pr-review-form {
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.prf-label {
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.5);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
}

.prf-opts {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.prf-opt {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12.5px;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    color: rgba(var(--v-theme-on-surface), 0.6);
    transition: all 0.12s;
    user-select: none;
}
.prf-opt:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.prf-opt.sel { font-weight: 600; }
.prf-opt-cmt.sel { border-color: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), 0.06); }
.prf-opt-ok.sel { border-color: #3E9A3E; color: #2E6B16; background: #E7F4DF; }
.prf-opt-chg.sel { border-color: #C7922B; color: #92610A; background: #FBF0DA; }

.prf-radio {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid currentColor;
    flex: none;
}
.prf-opt.sel .prf-radio { background: currentColor; }

.prf-textarea {
    width: 100%;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 10px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    resize: vertical;
    outline: none;
    background: transparent;
    color: rgba(var(--v-theme-on-surface), 0.87);
    transition: border-color 0.12s;
}
.prf-textarea:focus { border-color: rgb(var(--v-theme-primary)); }
.prf-textarea::placeholder { color: rgba(var(--v-theme-on-surface), 0.35); }

.prf-error {
    margin-top: 6px;
    font-size: 12px;
    color: #d32f2f;
}

.prf-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
}

.prf-btn {
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    padding: 6px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    color: #fff;
    transition: opacity 0.12s;
}
.prf-btn:disabled { opacity: 0.5; cursor: default; }
.prf-btn-ok { background: #3E9A3E; }
.prf-btn-chg { background: #C7922B; }
.prf-btn-cmt { background: rgb(var(--v-theme-primary)); }
</style>
