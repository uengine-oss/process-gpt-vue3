<template>
    <div class="pr-action-bar">
        <!-- 병합 직전에 한 번 더 보게 하는 한 줄. 누르면 검증 탭으로 간다. -->
        <button v-if="notice" :class="['pab-notice', notice.tone]" @click="$emit('show-verify')">
            <span class="pab-notice-text">{{ notice.text }}</span>
            <span class="pab-notice-link">{{ $t('pr.actions.details') }}</span>
        </button>

        <!--
            펼침 영역은 액션을 고른 뒤에만 생긴다. 늘 펼쳐 두면 입력창이 화면 아래를
            상시로 차지해, 정작 읽어야 할 변경사항·검증 결과가 그만큼 좁아진다.
        -->
        <div v-if="composing" class="pab-compose">
            <textarea
                ref="textarea"
                v-model="comment"
                class="pab-textarea"
                rows="2"
                :placeholder="placeholder"
                @input="autoGrow"
            ></textarea>
            <div v-if="error" class="pab-error">{{ error }}</div>
            <div class="pab-compose-foot">
                <button class="pab-btn ghost" @click="cancel">{{ $t('pr.actions.cancel') }}</button>
                <button class="pab-btn" :class="toneClass" :disabled="submitDisabled" @click="submit">
                    {{ loading ? $t('pr.actions.submitting') : confirmLabel }}
                </button>
            </div>
        </div>

        <div v-if="mergeError" class="pab-error pab-error--bar">{{ mergeError }}</div>

        <!-- 늘 같은 자리에 있는 액션 줄. 화면이 좁아도 여기까지는 항상 닿는다. -->
        <div class="pab-row">
            <div class="pab-left">
                <button class="pab-link" @click="$emit('open-resource')">{{ $t('pr.actions.openResource') }}</button>
                <a v-if="pr.git_pr_url" class="pab-link" :href="pr.git_pr_url" target="_blank">{{ $t('pr.actions.gitPr') }}</a>
            </div>

            <!--
                이 화면에 온 목적이 곧 이 세 단추다 — 변경 요청 · 승인 · 병합.
                코멘트만 곁다리로 남기고, 판정을 내리는 쪽은 크기와 색으로 먼저 눈에 들어오게 둔다.
            -->
            <div v-if="canReview" class="pab-right">
                <button :class="['pab-btn', 'ghost', { on: composing === 'COMMENT' }]" @click="open('COMMENT')">
                    {{ $t('pr.actions.comment') }}
                </button>
                <button :class="['pab-btn', 'chg', { on: composing === 'CHANGES_REQUESTED' }]" @click="open('CHANGES_REQUESTED')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                    {{ $t('pr.actions.requestChanges') }}
                </button>
                <button
                    v-if="pr.status !== 'APPROVED'"
                    :class="['pab-btn', 'ok', { on: composing === 'APPROVED' }]"
                    @click="open('APPROVED')"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">
                        <path d="m4 12.5 5.2 5.2L20 7" />
                    </svg>
                    {{ $t('pr.actions.approve') }}
                </button>
                <button v-if="canMerge" class="pab-btn merge" :disabled="mergeLoading" @click="$emit('merge')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="6" cy="6" r="2.5" />
                        <circle cx="6" cy="18" r="2.5" />
                        <circle cx="18" cy="9" r="2.5" />
                        <path d="M6 8.5v7M8.4 7.4 15.6 7.6M18 11.5c0 3-3 4-6 4" />
                    </svg>
                    {{ mergeLoading ? $t('pr.actions.merging') : $t('pr.actions.merge') }}
                </button>
                <span v-else-if="pr.status === 'APPROVED'" class="pab-note">{{ $t('pr.actions.note.approvedElsewhere') }}</span>
            </div>
            <div v-else class="pab-note">{{ closedNote }}</div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'PrActionBar',
    props: {
        pr: { type: Object, required: true },
        canReview: { type: Boolean, default: false },
        canMerge: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        error: { type: String, default: '' },
        mergeLoading: { type: Boolean, default: false },
        mergeError: { type: String, default: '' },
        /** { tone, text } — 병합 전 검증 한 줄 판정. 없으면 줄을 세우지 않는다. */
        notice: { type: Object, default: null }
    },
    emits: ['submit', 'merge', 'open-resource', 'show-verify'],
    data() {
        return { composing: '', comment: '' };
    },
    computed: {
        placeholder() {
            if (this.composing === 'CHANGES_REQUESTED') return this.$t('pr.actions.placeholder.requestChanges');
            if (this.composing === 'APPROVED') return this.$t('pr.actions.placeholder.approve');
            return this.$t('pr.actions.placeholder.comment');
        },
        confirmLabel() {
            if (this.composing === 'CHANGES_REQUESTED') return this.$t('pr.actions.confirm.requestChanges');
            if (this.composing === 'APPROVED') return this.$t('pr.actions.confirm.approve');
            return this.$t('pr.actions.confirm.comment');
        },
        toneClass() {
            if (this.composing === 'CHANGES_REQUESTED') return 'chg';
            if (this.composing === 'APPROVED') return 'ok';
            return 'cmt';
        },
        submitDisabled() {
            if (this.loading) return true;
            // 승인만 의견 없이 낼 수 있다. 나머지는 무엇을 말하려는지가 곧 내용이다.
            if (this.composing === 'APPROVED') return false;
            return !this.comment.trim();
        },
        closedNote() {
            if (this.pr.status === 'MERGED') return this.$t('pr.actions.note.merged');
            if (this.pr.status === 'CLOSED') return this.$t('pr.actions.note.closed');
            return this.$t('pr.actions.note.noPermission');
        }
    },
    watch: {
        'pr.id'() {
            this.composing = '';
            this.comment = '';
        },
        // 제출 실패 사유는 접힌 줄에 담기지 않는다 — 사유가 오면 폼을 열어 그 자리에서 보여준다.
        error(value) {
            if (value && !this.composing) this.composing = 'COMMENT';
        }
    },
    methods: {
        open(action) {
            this.composing = this.composing === action ? '' : action;
            if (this.composing) this.$nextTick(() => this.$refs.textarea?.focus());
        },
        cancel() {
            this.composing = '';
        },
        submit() {
            const action = this.composing;
            this.$emit('submit', action, this.comment.trim());
            this.composing = '';
            this.comment = '';
        },
        autoGrow(event) {
            const el = event.target;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        }
    }
};
</script>

<style scoped>
.pr-action-bar {
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgb(var(--v-theme-surface));
}

.pab-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 14px;
    font-family: inherit;
    font-size: 12.5px;
    text-align: left;
    border: none;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    cursor: pointer;
    background: rgba(var(--v-theme-on-surface), 0.04);
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.pab-notice.ok {
    background: rgba(46, 107, 22, 0.08);
}
.pab-notice.bad {
    background: rgba(var(--v-theme-error), 0.09);
    color: rgb(var(--v-theme-error));
    font-weight: 600;
}
.pab-notice.warn {
    background: rgba(var(--v-theme-warning), 0.12);
    color: #92610a;
}
.pab-notice.info {
    background: rgba(var(--v-theme-primary), 0.08);
}
.pab-notice-text {
    flex: 1;
    min-width: 0;
}
.pab-notice-link {
    font-size: 11px;
    text-decoration: underline;
    opacity: 0.75;
    white-space: nowrap;
}

.pab-compose {
    padding: 10px 14px 0;
}
.pab-textarea {
    width: 100%;
    resize: none;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    padding: 8px 10px;
    font-family: inherit;
    font-size: 12.5px;
    line-height: 1.5;
    color: rgba(var(--v-theme-on-surface), 0.87);
    background: transparent;
}
.pab-textarea:focus {
    outline: none;
    border-color: rgba(var(--v-theme-primary), 0.6);
}
.pab-compose-foot {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin: 6px 0 2px;
}

.pab-error {
    font-size: 11.5px;
    color: rgb(var(--v-theme-error));
    margin-top: 4px;
}
.pab-error--bar {
    padding: 6px 14px 0;
}

.pab-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    padding: 10px 12px;
}
.pab-left,
.pab-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.pab-link {
    border: none;
    background: none;
    padding: 2px 4px;
    font-family: inherit;
    font-size: 11.5px;
    color: rgb(var(--v-theme-primary));
    cursor: pointer;
    text-decoration: none;
}
.pab-link:hover {
    text-decoration: underline;
}

/* ── 판정 단추 ── */
.pab-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 40px;
    border: 1.5px solid transparent;
    border-radius: 10px;
    padding: 0 22px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    background: rgba(var(--v-theme-on-surface), 0.06);
    color: rgba(var(--v-theme-on-surface), 0.75);
    transition: filter 0.12s, box-shadow 0.12s, transform 0.06s;
}
.pab-btn:disabled {
    opacity: 0.45;
    cursor: default;
    box-shadow: none;
}
/* 코멘트는 판정이 아니다 — 곁다리로 물러나 있게 둔다. */
.pab-btn.ghost {
    height: 38px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 600;
    background: transparent;
    border-color: transparent;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.pab-btn.ghost:hover:not(:disabled) {
    background: rgba(var(--v-theme-on-surface), 0.06);
}
.pab-btn.chg {
    background: #fff8ea;
    border-color: #e0a83c;
    color: #8a5a08;
}
.pab-btn.ok {
    background: #2e6b16;
    color: #fff;
    box-shadow: 0 1px 3px rgba(46, 107, 22, 0.35);
}
.pab-btn.cmt {
    background: rgb(var(--v-theme-primary));
    color: #fff;
}
.pab-btn.merge {
    background: #6b46c1;
    color: #fff;
    box-shadow: 0 1px 3px rgba(107, 70, 193, 0.4);
}
.pab-btn:hover:not(:disabled) {
    filter: brightness(1.06);
}
.pab-btn.ok:hover:not(:disabled),
.pab-btn.merge:hover:not(:disabled) {
    filter: brightness(1.12);
    box-shadow: 0 2px 7px rgba(0, 0, 0, 0.18);
}
.pab-btn:active:not(:disabled) {
    transform: translateY(1px);
}
/* 지금 쓰고 있는 액션임을 알린다. */
.pab-btn.on {
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.22);
}

.pab-note {
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
