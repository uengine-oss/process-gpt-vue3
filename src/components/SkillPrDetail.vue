<template>
    <div class="pr-detail d-flex flex-column" style="height: 100%; overflow: hidden">
        <!-- 백 네비게이션 -->
        <div class="pd-nav flex-shrink-0">
            <button class="pd-back-btn" @click="$emit('back')">
                <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="m15 18-6-6 6-6" />
                </svg>
                변경 이력
            </button>
            <span class="pd-slash">/</span>
            <span class="pd-ref">PR{{ pr.git_pr_number ? ' #' + pr.git_pr_number : '' }}</span>
        </div>

        <!-- PR 헤더 -->
        <PrHeader :pr="pr" :requester-profile="requesterProfile" class="flex-shrink-0">
            <template #meta-extra>
                <template v-if="reviews.length">
                    <span style="color: rgba(var(--v-theme-on-surface), 0.3)">&middot;</span>
                    <span style="font-size: 11.5px">리뷰 {{ reviews.length }}건</span>
                </template>
            </template>
        </PrHeader>

        <!-- 탭바 -->
        <div class="pd-tabbar flex-shrink-0">
            <button :class="['pd-tab', { on: activeTab === 'changes' }]" @click="activeTab = 'changes'">
                변경사항
                <span v-if="files.length" class="pd-cnt">{{ files.length }}</span>
            </button>
            <button :class="['pd-tab', { on: activeTab === 'reviews' }]" @click="activeTab = 'reviews'">
                리뷰 이력
                <span v-if="reviews.length" class="pd-cnt">{{ reviews.length }}</span>
            </button>
            <button v-if="canVerify" :class="['pd-tab', { on: activeTab === 'verify' }]" @click="activeTab = 'verify'">
                병합 전 검증
                <span v-if="verification.brokenCount" class="pd-cnt danger">{{ verification.brokenCount }}</span>
            </button>
        </div>

        <!-- ── 변경사항 탭 ── -->
        <template v-if="activeTab === 'changes'">
            <div v-if="filesLoading" class="d-flex justify-center py-8">
                <v-progress-circular indeterminate size="22" color="primary" />
            </div>
            <div v-else-if="!files.length" class="text-caption text-center py-8 text-medium-emphasis flex-shrink-0">
                변경 파일 정보가 없습니다.
            </div>
            <div v-else class="pd-diff-wrap d-flex flex-grow-1" style="min-height: 0; overflow: hidden">
                <!-- 파일 사이드바 -->
                <div class="pd-file-sidebar overflow-y-auto flex-shrink-0">
                    <div class="pd-sidebar-label">변경 파일</div>
                    <div
                        v-for="f in files"
                        :key="f.filename"
                        :class="['pd-file-row', { on: activeFile === f.filename }]"
                        @click="activeFile = f.filename"
                    >
                        <span :class="['ftag', fileTagClass(f.status)]">{{ fileTag(f.status) }}</span>
                        <span class="pd-fname">{{ f.filename }}</span>
                        <span class="pd-fstats">
                            <span v-if="f.additions" class="plus">+{{ f.additions }}</span>
                            <span v-if="f.deletions" class="minus">-{{ f.deletions }}</span>
                        </span>
                    </div>
                </div>
                <!-- 우측 diff -->
                <div class="pd-diff-view overflow-y-auto flex-grow-1" style="min-width: 0">
                    <template v-if="activeFileObj">
                        <div class="pd-diff-header">{{ activeFileObj.filename }}</div>
                        <div v-if="activeFileObj.patch" class="diff-block">
                            <div v-for="(line, i) in parsePatch(activeFileObj.patch)" :key="i" :class="['dl', diffLineClass(line)]">
                                {{ line }}
                            </div>
                        </div>
                        <div v-else class="text-caption text-center py-6 text-medium-emphasis">패치 데이터 없음</div>
                    </template>
                    <div v-else class="pd-no-sel">← 파일을 선택하세요</div>
                </div>
            </div>
        </template>

        <!-- ── 리뷰 이력 탭 ── -->
        <div v-else-if="activeTab === 'reviews'" class="pd-reviews-pane overflow-y-auto flex-grow-1">
            <PrReviewTimeline :reviews="reviews" />
        </div>

        <!-- ── 병합 전 검증 탭 ── -->
        <div v-else class="pd-verify-pane overflow-y-auto flex-grow-1">
            <PrVerification
                ref="verifier"
                :skill-name="skillName || pr.resource_id"
                :pr-number="pr.git_pr_number"
                @status="verification = $event"
            />
        </div>

        <!-- ── 리뷰 / 코멘트 제출 폼 ── -->
        <PrReviewForm
            v-if="canReview || canComment"
            :is-owner="isOwner"
            :loading="reviewLoading || commentLoading"
            :error="reviewError || commentError"
            class="flex-shrink-0"
            @submit="handleFormSubmit"
        />

        <!-- ── 병합 전 검증 경고 ── -->
        <!-- 병합 버튼 바로 위에 둔다: 리뷰어가 병합을 누르기 직전에 보게 하는 것이 요점이다. -->
        <div v-if="canMerge && verifyNotice" :class="['pd-verify-notice', verifyNotice.tone]" @click="activeTab = 'verify'">
            <span class="pd-vn-text">{{ verifyNotice.text }}</span>
            <span class="pd-vn-link">자세히</span>
        </div>

        <!-- ── 병합 폼 ── -->
        <PrMergeSection
            :can-merge="canMerge"
            :merge-loading="mergeLoading"
            :merge-error="mergeError"
            :base-branch="pr.base_branch"
            merge-description="으로 병합하면 에이전트에 즉시 반영됩니다."
            class="flex-shrink-0"
            @merge="$emit('submit-merge')"
        />
    </div>
</template>

<script>
import PrHeader from '@/components/pr/PrHeader.vue';
import PrReviewTimeline from '@/components/pr/PrReviewTimeline.vue';
import PrReviewForm from '@/components/pr/PrReviewForm.vue';
import PrMergeSection from '@/components/pr/PrMergeSection.vue';
import PrVerification from '@/components/pr/PrVerification.vue';

export default {
    name: 'SkillPrDetail',
    components: { PrHeader, PrReviewTimeline, PrReviewForm, PrMergeSection, PrVerification },
    props: {
        pr: { type: Object, required: true },
        skillName: { type: String, default: '' },
        files: { type: Array, default: () => [] },
        filesLoading: Boolean,
        reviews: { type: Array, default: () => [] },
        isOwner: Boolean,
        reviewLoading: Boolean,
        reviewError: { type: String, default: '' },
        mergeLoading: Boolean,
        mergeError: { type: String, default: '' },
        commentLoading: Boolean,
        commentError: { type: String, default: '' },
        requesterProfile: { type: String, default: null }
    },
    emits: ['back', 'submit-review', 'submit-merge', 'submit-comment'],
    data() {
        return {
            activeTab: 'changes',
            activeFile: null,
            verification: { hasSuite: false, status: null, brokenCount: 0, incomparableCount: 0, noSignalCount: 0, backfillStatus: null }
        };
    },
    watch: {
        files(newFiles) {
            if (newFiles.length && !this.activeFile) {
                const first = newFiles.find((f) => f.patch) || newFiles[0];
                this.activeFile = first?.filename || null;
            }
        },
        pr() {
            this.activeTab = 'changes';
            this.activeFile = null;
            this.verification = { hasSuite: false, status: null, brokenCount: 0, incomparableCount: 0, noSignalCount: 0, backfillStatus: null };
        }
    },
    computed: {
        canReview() {
            return this.isOwner && (this.pr.status === 'OPEN' || this.pr.status === 'CHANGES_REQUESTED');
        },
        canComment() {
            return !this.isOwner && (this.pr.status === 'OPEN' || this.pr.status === 'CHANGES_REQUESTED');
        },
        canMerge() {
            return this.isOwner && this.pr.status === 'APPROVED';
        },
        /** 병합 전 검증은 스킬 PR 이면서 깃 PR 번호가 있을 때만 돌릴 수 있다. */
        canVerify() {
            const type = this.pr.resource_type || 'skill';
            return type === 'skill' && !!this.pr.git_pr_number && !!(this.skillName || this.pr.resource_id);
        },
        /**
         * 병합 버튼 옆에 띄울 한 줄. 검증 결과를 병합 직전에 보게 하는 것이 목적이므로,
         * "아직 안 돌렸다" 도 알려준다 — 침묵은 "이상 없음" 으로 오해된다.
         */
        verifyNotice() {
            if (!this.canVerify) return null;
            const v = this.verification;
            if (v.status === 'running') {
                return { tone: 'info', text: '병합 전 검증이 진행 중입니다.' };
            }
            if (v.status === 'succeeded') {
                if (v.brokenCount) {
                    return { tone: 'bad', text: `이 병합은 기존 동작 ${v.brokenCount}개 단계를 깨뜨립니다.` };
                }
                const unknown = (v.noSignalCount || 0) + (v.incomparableCount || 0);
                if (unknown) {
                    return { tone: 'warn', text: `시나리오 ${unknown}건은 깨졌는지 판단할 수 없습니다.` };
                }
                return { tone: 'ok', text: '병합 전 검증 통과 — 깨지는 단계가 없습니다.' };
            }
            if (v.status === 'failed') {
                return { tone: 'warn', text: '병합 전 검증이 완료되지 못했습니다.' };
            }
            if (!v.hasSuite) {
                if (v.backfillStatus === 'running') {
                    return { tone: 'info', text: '검증에 쓸 시나리오를 만드는 중입니다.' };
                }
                return { tone: 'warn', text: '비교할 시나리오가 없어 자동 검증을 할 수 없습니다.' };
            }
            return { tone: 'warn', text: '아직 병합 전 검증을 실행하지 않았습니다.' };
        },
        activeFileObj() {
            return this.files.find((f) => f.filename === this.activeFile) || null;
        }
    },
    methods: {
        handleFormSubmit(action, comment) {
            if (action === 'COMMENT') {
                this.$emit('submit-comment', comment);
            } else {
                this.$emit('submit-review', action, comment);
            }
        },
        fileTag(status) {
            return { added: 'A', removed: 'D', modified: 'M', renamed: 'R' }[status] || '~';
        },
        fileTagClass(status) {
            return { added: 'ftag-add', removed: 'ftag-del', modified: 'ftag-mod', renamed: 'ftag-ren' }[status] || 'ftag-mod';
        },
        parsePatch(patch) {
            return (patch || '').split('\n');
        },
        diffLineClass(line) {
            if (line.startsWith('+++') || line.startsWith('---')) return 'dl-header';
            if (line.startsWith('@@')) return 'dl-hunk';
            if (line.startsWith('+')) return 'dl-add';
            if (line.startsWith('-')) return 'dl-del';
            return 'dl-ctx';
        }
    }
};
</script>

<style scoped>
.pr-detail {
    background: rgb(var(--v-theme-surface));
}

/* ── 백 네비 ── */
.pd-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 11px 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    font-size: 13px;
}
.pd-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: rgb(var(--v-theme-primary));
    font-family: inherit;
    padding: 0;
}
.pd-back-btn:hover {
    opacity: 0.75;
}
.pd-slash {
    color: rgba(var(--v-theme-on-surface), 0.3);
}
.pd-ref {
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

/* ── 탭바 ── */
.pd-tabbar {
    display: flex;
    gap: 0;
    padding: 0 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.pd-tab {
    border: none;
    background: none;
    padding: 10px 4px;
    margin-right: 18px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(var(--v-theme-on-surface), 0.5);
    cursor: pointer;
    font-family: inherit;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    display: flex;
    align-items: center;
    gap: 7px;
    transition: color 0.12s;
}
.pd-tab.on {
    color: rgba(var(--v-theme-on-surface), 0.87);
    border-bottom-color: rgb(var(--v-theme-primary));
}
.pd-cnt {
    background: rgba(var(--v-theme-on-surface), 0.1);
    color: rgba(var(--v-theme-on-surface), 0.55);
    font-size: 11px;
    border-radius: 9px;
    padding: 0 7px;
    min-width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* ── Diff 레이아웃 ── */
.pd-diff-wrap {
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.pd-file-sidebar {
    width: 200px;
    border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 6px 0;
}
.pd-sidebar-label {
    font-size: 10.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.4);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 8px 12px 5px;
}
.pd-file-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12.5px;
    transition: background 0.1s;
    border-radius: 0;
}
.pd-file-row:hover {
    background: rgba(var(--v-theme-on-surface), 0.04);
}
.pd-file-row.on {
    background: rgba(var(--v-theme-primary), 0.08);
}
.pd-fname {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.75);
}
.pd-fstats {
    font-size: 11px;
    flex: none;
    display: flex;
    gap: 3px;
}
.pd-diff-view {
}
.pd-diff-header {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.55);
    padding: 9px 14px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(var(--v-theme-on-surface), 0.02);
    position: sticky;
    top: 0;
}
.pd-no-sel {
    padding: 48px 24px;
    text-align: center;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.35);
}

/* ── 파일 태그 ── */
.ftag {
    font-size: 10px;
    font-weight: 700;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
}
.ftag-add {
    background: #e7f4df;
    color: #2e6b16;
}
.ftag-del {
    background: #fcebeb;
    color: #a32d2d;
}
.ftag-mod {
    background: #fbf0da;
    color: #92610a;
}
.ftag-ren {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}

/* ── Diff 블록 ── */
.diff-block {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11.5px;
    line-height: 1.5;
    background: #1a1d2e;
    padding: 6px 0;
    white-space: pre;
    overflow-x: auto;
}
.dl {
    display: block;
    padding: 0 13px;
}
.dl-add {
    background: rgba(70, 149, 74, 0.2);
    color: #89d185;
}
.dl-del {
    background: rgba(220, 80, 80, 0.2);
    color: #f48771;
}
.dl-hunk {
    color: #569cd6;
}
.dl-header {
    color: #6a737d;
}
.dl-ctx {
    color: #d4d4d4;
}

/* ── 리뷰 이력 ── */
.pd-reviews-pane {
    padding: 0;
}

.plus {
    color: #2e6b16;
    font-weight: 600;
}
.minus {
    color: #a32d2d;
    font-weight: 600;
}

/* ── 병합 전 검증 알림 ── */
.pd-verify-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 16px;
    padding: 9px 12px;
    border-radius: 9px;
    font-size: 12.5px;
    cursor: pointer;
    border: 1px solid transparent;
}
.pd-verify-notice.ok {
    background: rgba(var(--v-theme-success), 0.09);
    border-color: rgba(var(--v-theme-success), 0.25);
    color: rgba(var(--v-theme-on-surface), 0.75);
}
.pd-verify-notice.bad {
    background: rgba(var(--v-theme-error), 0.09);
    border-color: rgba(var(--v-theme-error), 0.32);
    color: rgb(var(--v-theme-error));
    font-weight: 600;
}
.pd-verify-notice.warn {
    background: rgba(var(--v-theme-warning), 0.1);
    border-color: rgba(var(--v-theme-warning), 0.3);
    color: rgba(var(--v-theme-on-surface), 0.75);
}
.pd-verify-notice.info {
    background: rgba(var(--v-theme-primary), 0.08);
    border-color: rgba(var(--v-theme-primary), 0.22);
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.pd-vn-text {
    flex: 1;
}
.pd-vn-link {
    font-size: 11.5px;
    text-decoration: underline;
    opacity: 0.75;
    white-space: nowrap;
}

.pd-cnt.danger {
    background: rgba(var(--v-theme-error), 0.15);
    color: rgb(var(--v-theme-error));
}

.pd-verify-pane {
    min-height: 0;
}
</style>
