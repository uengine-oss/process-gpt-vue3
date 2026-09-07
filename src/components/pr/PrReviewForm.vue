<template>
    <div :class="['pr-review-form', { collapsed: !expanded }]">
        <!--
            기본은 한 줄로 접어 둔다. 이 폼은 다 읽고 판단을 내리는 마지막 한 순간에만 쓰는데,
            펼친 채로 두면 라디오 + 입력창 + 버튼이 200px 넘게 상시 차지해 정작 읽어야 할
            diff·검증 결과가 그만큼 좁아진다(노트북 높이에서 검증 결과가 37%만 보였다).
        -->
        <button v-if="!expanded" type="button" class="prf-collapsed" @click="expand">
            <span class="prf-collapsed-text">{{ collapsedPlaceholder }}</span>
            <span class="prf-collapsed-cta">{{ isOwner ? '리뷰 남기기' : '코멘트 남기기' }}</span>
        </button>

        <template v-else>
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

        <!-- 두 줄에서 시작해 입력한 만큼만 늘어난다 — 빈 입력창이 고정 높이를 먹지 않게. -->
        <textarea
            ref="textarea"
            class="prf-textarea"
            v-model="localComment"
            :placeholder="textareaPlaceholder"
            rows="2"
            @input="autoGrow"
        ></textarea>

        <div v-if="error" class="prf-error">{{ error }}</div>

        <div class="prf-footer">
            <button type="button" class="prf-cancel" @click="collapse">닫기</button>
            <button :class="['prf-btn', btnClass]" :disabled="isDisabled" @click="handleSubmit">
                <span v-if="loading">처리 중…</span>
                <span v-else>{{ submitLabel }}</span>
            </button>
        </div>
        </template>

        <slot name="status-bar"></slot>
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
            localComment: '',
            expanded: false
        };
    },
    watch: {
        // 제출 실패 사유는 접힌 줄에 담기지 않는다 — 사유가 오면 폼을 열어 그 자리에서 보여준다.
        error(v) {
            if (v) this.expanded = true;
        }
    },
    computed: {
        collapsedPlaceholder() {
            if (this.localComment.trim()) return this.localComment.trim();
            return this.isOwner ? '이 병합 요청에 승인·변경요청·코멘트를 남깁니다.' : '코멘트를 남깁니다.';
        },
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
        expand() {
            this.expanded = true;
            this.$nextTick(() => {
                const el = this.$refs.textarea;
                if (!el) return;
                el.focus();
                this.autoGrow();
            });
        },
        collapse() {
            this.expanded = false;
        },
        /** 입력 높이를 내용에 맞춘다. 상한을 두어 폼이 다시 화면을 잡아먹지 않게 한다. */
        autoGrow() {
            const el = this.$refs.textarea;
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 160) + 'px';
        },
        handleSubmit() {
            this.$emit('submit', this.localAction, this.localComment);
            this.localComment = '';
            // 제출하고 나면 읽기 화면을 다시 넓게 돌려준다.
            this.expanded = false;
        }
    }
};
</script>

<style scoped>
.pr-review-form {
    padding: 12px 16px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* ── 접힌 상태: 한 줄짜리 열기 바 ── */
.prf-collapsed {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    font: inherit;
    font-size: 13px;
    text-align: left;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    background: transparent;
    cursor: text;
    color: rgba(var(--v-theme-on-surface), 0.35);
}
.prf-collapsed:hover {
    border-color: rgb(var(--v-theme-primary));
}
.prf-collapsed-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.prf-collapsed-cta {
    flex: none;
    font-size: 12.5px;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
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
.prf-opt:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
}
.prf-opt.sel {
    font-weight: 600;
}
.prf-opt-cmt.sel {
    border-color: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.06);
}
.prf-opt-ok.sel {
    border-color: #3e9a3e;
    color: #2e6b16;
    background: #e7f4df;
}
.prf-opt-chg.sel {
    border-color: #c7922b;
    color: #92610a;
    background: #fbf0da;
}

.prf-radio {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid currentColor;
    flex: none;
}
.prf-opt.sel .prf-radio {
    background: currentColor;
}

.prf-textarea {
    width: 100%;
    max-height: 160px;
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
.prf-textarea:focus {
    border-color: rgb(var(--v-theme-primary));
}
.prf-textarea::placeholder {
    color: rgba(var(--v-theme-on-surface), 0.35);
}

.prf-error {
    margin-top: 6px;
    font-size: 12px;
    color: var(--cds-text-danger);
}

.prf-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
}

.prf-cancel {
    font-size: 12.5px;
    font-family: inherit;
    padding: 6px 10px;
    border: none;
    border-radius: 8px;
    background: none;
    cursor: pointer;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.prf-cancel:hover {
    color: rgba(var(--v-theme-on-surface), 0.85);
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
.prf-btn:disabled {
    opacity: 0.5;
    cursor: default;
}
.prf-btn-ok {
    background: #3e9a3e;
}
.prf-btn-chg {
    background: #c7922b;
}
.prf-btn-cmt {
    background: rgb(var(--v-theme-primary));
}
</style>
