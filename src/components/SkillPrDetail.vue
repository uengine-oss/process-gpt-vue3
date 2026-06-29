<template>
    <div class="pr-detail d-flex flex-column" style="height:100%;overflow:hidden">

        <!-- 백 네비게이션 -->
        <div class="pd-nav flex-shrink-0">
            <button class="pd-back-btn" @click="$emit('back')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                변경 이력
            </button>
            <span class="pd-slash">/</span>
            <span class="pd-ref">PR{{ pr.git_pr_number ? ' #' + pr.git_pr_number : '' }}</span>
        </div>

        <!-- PR 헤더 -->
        <PrHeader
            :pr="pr"
            :requester-profile="requesterProfile"
            class="flex-shrink-0"
        >
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
        </div>

        <!-- ── 변경사항 탭 ── -->
        <template v-if="activeTab === 'changes'">
            <div v-if="filesLoading" class="d-flex justify-center py-8">
                <v-progress-circular indeterminate size="22" color="primary" />
            </div>
            <div v-else-if="!files.length" class="text-caption text-center py-8 text-medium-emphasis flex-shrink-0">
                변경 파일 정보가 없습니다.
            </div>
            <div v-else class="pd-diff-wrap d-flex flex-grow-1" style="min-height:0;overflow:hidden">
                <!-- 파일 사이드바 -->
                <div class="pd-file-sidebar overflow-y-auto flex-shrink-0">
                    <div class="pd-sidebar-label">변경 파일</div>
                    <div v-for="f in files" :key="f.filename"
                         :class="['pd-file-row', { on: activeFile === f.filename }]"
                         @click="activeFile = f.filename">
                        <span :class="['ftag', fileTagClass(f.status)]">{{ fileTag(f.status) }}</span>
                        <span class="pd-fname">{{ f.filename }}</span>
                        <span class="pd-fstats">
                            <span v-if="f.additions" class="plus">+{{ f.additions }}</span>
                            <span v-if="f.deletions" class="minus">-{{ f.deletions }}</span>
                        </span>
                    </div>
                </div>
                <!-- 우측 diff -->
                <div class="pd-diff-view overflow-y-auto flex-grow-1" style="min-width:0">
                    <template v-if="activeFileObj">
                        <div class="pd-diff-header">{{ activeFileObj.filename }}</div>
                        <div v-if="activeFileObj.patch" class="diff-block">
                            <div v-for="(line, i) in parsePatch(activeFileObj.patch)" :key="i" :class="['dl', diffLineClass(line)]">{{ line }}</div>
                        </div>
                        <div v-else class="text-caption text-center py-6 text-medium-emphasis">패치 데이터 없음</div>
                    </template>
                    <div v-else class="pd-no-sel">← 파일을 선택하세요</div>
                </div>
            </div>
        </template>

        <!-- ── 리뷰 이력 탭 ── -->
        <div v-else class="pd-reviews-pane overflow-y-auto flex-grow-1">
            <PrReviewTimeline :reviews="reviews" />
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

export default {
    name: 'SkillPrDetail',
    components: { PrHeader, PrReviewTimeline, PrReviewForm, PrMergeSection },
    props: {
        pr: { type: Object, required: true },
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
            activeFile: null
        };
    },
    watch: {
        files(newFiles) {
            if (newFiles.length && !this.activeFile) {
                const first = newFiles.find(f => f.patch) || newFiles[0];
                this.activeFile = first?.filename || null;
            }
        },
        pr() {
            this.activeTab = 'changes';
            this.activeFile = null;
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
        activeFileObj() {
            return this.files.find(f => f.filename === this.activeFile) || null;
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
        fileTag(status) { return { added: 'A', removed: 'D', modified: 'M', renamed: 'R' }[status] || '~'; },
        fileTagClass(status) { return { added: 'ftag-add', removed: 'ftag-del', modified: 'ftag-mod', renamed: 'ftag-ren' }[status] || 'ftag-mod'; },
        parsePatch(patch) { return (patch || '').split('\n'); },
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
.pr-detail { background: rgb(var(--v-theme-surface)); }

/* ── 백 네비 ── */
.pd-nav { display: flex; align-items: center; gap: 6px; padding: 11px 16px; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); font-size: 13px; }
.pd-back-btn { display: inline-flex; align-items: center; gap: 5px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 500; color: rgb(var(--v-theme-primary)); font-family: inherit; padding: 0; }
.pd-back-btn:hover { opacity: 0.75; }
.pd-slash { color: rgba(var(--v-theme-on-surface), 0.3); }
.pd-ref { font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.7); }

/* ── 탭바 ── */
.pd-tabbar { display: flex; gap: 0; padding: 0 16px; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.pd-tab { border: none; background: none; padding: 10px 4px; margin-right: 18px; font-size: 13px; font-weight: 500; color: rgba(var(--v-theme-on-surface), 0.5); cursor: pointer; font-family: inherit; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 7px; transition: color 0.12s; }
.pd-tab.on { color: rgba(var(--v-theme-on-surface), 0.87); border-bottom-color: rgb(var(--v-theme-primary)); }
.pd-cnt { background: rgba(var(--v-theme-on-surface), 0.1); color: rgba(var(--v-theme-on-surface), 0.55); font-size: 11px; border-radius: 9px; padding: 0 7px; min-width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; }

/* ── Diff 레이아웃 ── */
.pd-diff-wrap { border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.pd-file-sidebar { width: 200px; border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); padding: 6px 0; }
.pd-sidebar-label { font-size: 10.5px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.4); text-transform: uppercase; letter-spacing: .04em; padding: 8px 12px 5px; }
.pd-file-row { display: flex; align-items: center; gap: 7px; padding: 6px 10px; cursor: pointer; font-size: 12.5px; transition: background 0.1s; border-radius: 0; }
.pd-file-row:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.pd-file-row.on { background: rgba(var(--v-theme-primary), 0.08); }
.pd-fname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; color: rgba(var(--v-theme-on-surface), 0.75); }
.pd-fstats { font-size: 11px; flex: none; display: flex; gap: 3px; }
.pd-diff-view { }
.pd-diff-header { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: rgba(var(--v-theme-on-surface), 0.55); padding: 9px 14px; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); background: rgba(var(--v-theme-on-surface), 0.02); position: sticky; top: 0; }
.pd-no-sel { padding: 48px 24px; text-align: center; font-size: 12px; color: rgba(var(--v-theme-on-surface), 0.35); }

/* ── 파일 태그 ── */
.ftag { font-size: 10px; font-weight: 700; width: 16px; height: 16px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.ftag-add { background: #E7F4DF; color: #2E6B16; }
.ftag-del { background: #FCEBEB; color: #A32D2D; }
.ftag-mod { background: #FBF0DA; color: #92610A; }
.ftag-ren { background: rgba(var(--v-theme-primary), 0.1); color: rgb(var(--v-theme-primary)); }

/* ── Diff 블록 ── */
.diff-block { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; line-height: 1.5; background: #1a1d2e; padding: 6px 0; white-space: pre; overflow-x: auto; }
.dl { display: block; padding: 0 13px; }
.dl-add { background: rgba(70,149,74,.2); color: #89d185; }
.dl-del { background: rgba(220,80,80,.2); color: #f48771; }
.dl-hunk { color: #569cd6; }
.dl-header { color: #6a737d; }
.dl-ctx { color: #d4d4d4; }

/* ── 리뷰 이력 ── */
.pd-reviews-pane { padding: 0; }

.plus { color: #2E6B16; font-weight: 600; }
.minus { color: #A32D2D; font-weight: 600; }
</style>
