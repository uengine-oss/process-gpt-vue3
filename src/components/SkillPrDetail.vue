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
        <div class="pd-head flex-shrink-0">
            <div class="pd-title">
                {{ pr.title }}
                <span :class="['st-badge', badgeClass]">{{ statusLabel }}</span>
            </div>
            <div class="pd-meta">
                <span v-if="pr.requester_name" class="pd-ava" :style="{background: avatarColor(pr.requester_name)}">
                    {{ initials(pr.requester_name) }}
                </span>
                <span><b>{{ pr.requester_name || '알 수 없음' }}</b>님이 <b>{{ pr.base_branch }}</b>으로 병합 요청</span>
                <span class="pd-dot">·</span>
                <span class="bchip">{{ shortBranch(pr.branch_name) }}</span>
                <span class="pd-arrow">→</span>
                <span class="bchip">{{ pr.base_branch }}</span>
                <template v-if="reviews.length">
                    <span class="pd-dot">·</span>
                    <span class="pd-rev-count">리뷰 {{ reviews.length }}건</span>
                </template>
            </div>
        </div>

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
            <div v-if="!reviews.length" class="text-caption text-center py-8 text-medium-emphasis">
                아직 리뷰가 없습니다.
            </div>
            <div v-for="r in reviews" :key="r.id" class="pd-rev-item">
                <div :class="['pd-rev-ico', r.action === 'APPROVED' ? 'rvi-ok' : 'rvi-chg']">
                    <svg v-if="r.action === 'APPROVED'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                </div>
                <div class="pd-rev-body">
                    <div class="pd-rev-who">
                        <span class="pd-rev-name">{{ r.reviewer_name || '알 수 없음' }}</span>
                        <span :class="['pd-rev-badge', r.action === 'APPROVED' ? 'rvb-ok' : 'rvb-chg']">
                            {{ r.action === 'APPROVED' ? '승인' : '변경 요청' }}
                        </span>
                        <span class="pd-rev-time">{{ formatDate(r.created_at) }}</span>
                    </div>
                    <div v-if="r.comment" class="pd-rev-comment">{{ r.comment }}</div>
                </div>
            </div>
        </div>

        <!-- ── 리뷰 제출 폼 ── -->
        <div v-if="canReview" class="pd-submitbar flex-shrink-0">
            <div class="pd-submit-label">리뷰 제출</div>
            <div class="pd-opts-row">
                <div :class="['pd-opt', { sel: localAction === 'APPROVED', 'opt-ok': localAction === 'APPROVED' }]"
                     @click="localAction = 'APPROVED'">
                    <span class="rd"></span> 승인
                </div>
                <div :class="['pd-opt', { sel: localAction === 'CHANGES_REQUESTED', 'opt-chg': localAction === 'CHANGES_REQUESTED' }]"
                     @click="localAction = 'CHANGES_REQUESTED'">
                    <span class="rd"></span> 변경 요청
                </div>
            </div>
            <textarea class="pd-textarea" v-model="localComment"
                :placeholder="localAction === 'APPROVED' ? '전반적인 의견 (선택)' : '변경 요청 사유를 작성해 주세요. (필수)'"
                rows="3"
            ></textarea>
            <div v-if="reviewError" class="pd-error">{{ reviewError }}</div>
            <div class="pd-footer">
                <button :class="['pd-btn', localAction === 'APPROVED' ? 'btn-ok' : 'btn-chg']"
                    :disabled="reviewLoading || (localAction === 'CHANGES_REQUESTED' && !localComment.trim())"
                    @click="$emit('submit-review', localAction, localComment)">
                    <span v-if="reviewLoading">처리 중…</span>
                    <span v-else>{{ localAction === 'APPROVED' ? '승인 제출' : '변경 요청 제출' }}</span>
                </button>
            </div>
        </div>

        <!-- ── 병합 폼 ── -->
        <div v-if="canMerge" class="pd-submitbar flex-shrink-0">
            <div class="pd-merge-banner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3E9A3E" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
                </svg>
                승인됨 — <b>{{ pr.base_branch }}</b>으로 병합하면 에이전트에 즉시 반영됩니다.
            </div>
            <div v-if="mergeError" class="pd-error pd-error-mt">{{ mergeError }}</div>
            <div class="pd-footer">
                <button class="pd-btn btn-merge" :disabled="mergeLoading" @click="$emit('submit-merge')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7M8.4 7.4 15.6 7.6M18 11.5c0 3-3 4-6 4"/></svg>
                    <span v-if="mergeLoading">병합 중…</span>
                    <span v-else>병합 확인</span>
                </button>
            </div>
        </div>

    </div>
</template>

<script>
export default {
    name: 'SkillPrDetail',
    props: {
        pr: { type: Object, required: true },
        files: { type: Array, default: () => [] },
        filesLoading: Boolean,
        reviews: { type: Array, default: () => [] },
        isOwner: Boolean,
        reviewLoading: Boolean,
        reviewError: { type: String, default: '' },
        mergeLoading: Boolean,
        mergeError: { type: String, default: '' }
    },
    emits: ['back', 'submit-review', 'submit-merge'],
    data() {
        return {
            activeTab: 'changes',
            activeFile: null,
            localAction: 'APPROVED',
            localComment: ''
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
            this.localAction = 'APPROVED';
            this.localComment = '';
        }
    },
    computed: {
        canReview() {
            return this.isOwner && (this.pr.status === 'OPEN' || this.pr.status === 'CHANGES_REQUESTED');
        },
        canMerge() {
            return this.isOwner && this.pr.status === 'APPROVED';
        },
        statusLabel() {
            return { OPEN: '검토 대기', CHANGES_REQUESTED: '변경 요청됨', APPROVED: '승인됨', MERGED: '병합됨', CLOSED: '닫힘' }[this.pr.status] || this.pr.status;
        },
        badgeClass() {
            return { OPEN: 'st-open', CHANGES_REQUESTED: 'st-chg', APPROVED: 'st-app', MERGED: 'st-merged' }[this.pr.status] || 'st-open';
        },
        activeFileObj() {
            return this.files.find(f => f.filename === this.activeFile) || null;
        }
    },
    methods: {
        initials(name) {
            if (!name) return '?';
            if (/[가-힣]/.test(name)) return name[0];
            const p = name.trim().split(/\s+/);
            return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
        },
        avatarColor(name) {
            if (!name) return '#9E9E9E';
            const colors = ['#3B82F6', '#E0822B', '#3E9A3E', '#9B59B6', '#E0A12B', '#2196F3', '#00897B', '#E35D5D'];
            let h = 0;
            for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) >>> 0;
            return colors[h % colors.length];
        },
        shortBranch(b) {
            if (!b || b.length <= 26) return b;
            const parts = b.split('/');
            if (parts.length > 1) return parts[0] + '/…' + parts[parts.length - 1].slice(-10);
            return b.slice(0, 10) + '…' + b.slice(-8);
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
        },
        formatDate(d) {
            if (!d) return '';
            try { return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
            catch { return d; }
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

/* ── PR 헤더 ── */
.pd-head { padding: 13px 16px 12px; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.pd-title { font-size: 14px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.87); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; line-height: 1.45; margin-bottom: 9px; }
.pd-meta { display: flex; align-items: center; gap: 7px; font-size: 12px; color: rgba(var(--v-theme-on-surface), 0.6); flex-wrap: wrap; }
.pd-meta b { color: rgba(var(--v-theme-on-surface), 0.87); }
.pd-ava { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; flex: none; }
.pd-dot { color: rgba(var(--v-theme-on-surface), 0.3); }
.pd-arrow { color: rgba(var(--v-theme-on-surface), 0.35); }
.pd-rev-count { font-size: 11.5px; }
.bchip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: rgba(var(--v-theme-on-surface), 0.07); border-radius: 5px; padding: 1px 7px; color: rgba(var(--v-theme-on-surface), 0.6); }

/* ── 배지 ── */
.st-badge { font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
.st-open { background: rgba(var(--v-theme-primary), 0.1); color: rgb(var(--v-theme-primary)); }
.st-chg { background: #FBF0DA; color: #92610A; }
.st-app { background: #E7F4DF; color: #2E6B16; }
.st-merged { background: #EFEAFB; color: #5b46b8; }

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
.pd-reviews-pane { padding: 8px 16px; }
.pd-rev-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.pd-rev-item:last-child { border-bottom: none; }
.pd-rev-ico { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; margin-top: 1px; }
.rvi-ok { background: #E7F4DF; color: #2E6B16; }
.rvi-chg { background: #FBF0DA; color: #92610A; }
.pd-rev-body { flex: 1; min-width: 0; }
.pd-rev-who { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap; }
.pd-rev-name { font-weight: 600; font-size: 13px; color: rgba(var(--v-theme-on-surface), 0.87); }
.pd-rev-badge { font-size: 11px; font-weight: 600; border-radius: 5px; padding: 2px 7px; }
.rvb-ok { background: #E7F4DF; color: #2E6B16; }
.rvb-chg { background: #FBF0DA; color: #92610A; }
.pd-rev-time { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.4); margin-left: auto; }
.pd-rev-comment { font-size: 12.5px; color: rgba(var(--v-theme-on-surface), 0.7); line-height: 1.5; }

/* ── 하단 제출바 ── */
.pd-submitbar { border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); padding: 14px 16px; background: rgba(var(--v-theme-on-surface), 0.015); }
.pd-submit-label { font-size: 12px; font-weight: 600; color: rgba(var(--v-theme-on-surface), 0.5); margin-bottom: 10px; }
.pd-opts-row { display: flex; gap: 8px; margin-bottom: 10px; }
.pd-opt { display: flex; align-items: center; gap: 7px; border: 1.5px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 9px; padding: 8px 13px; font-size: 13px; cursor: pointer; font-weight: 500; color: rgba(var(--v-theme-on-surface), 0.6); transition: all 0.12s; }
.pd-opt:hover { background: rgba(var(--v-theme-on-surface), 0.04); }
.pd-opt.opt-ok { border-color: #3E9A3E; background: #E7F4DF; color: #2E6B16; }
.pd-opt.opt-chg { border-color: #E0A12B; background: #FBF0DA; color: #92610A; }
.rd { width: 13px; height: 13px; border-radius: 50%; border: 2px solid currentColor; flex: none; }
.pd-textarea { width: 100%; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 9px; padding: 9px 11px; font-size: 12.5px; font-family: inherit; resize: vertical; min-height: 60px; outline: none; color: rgba(var(--v-theme-on-surface), 0.87); background: rgb(var(--v-theme-surface)); }
.pd-textarea:focus { border-color: rgb(var(--v-theme-primary)); }
.pd-footer { display: flex; justify-content: flex-end; margin-top: 10px; }
.pd-btn { border: none; border-radius: 9px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; transition: opacity 0.1s; }
.pd-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ok { background: #3E9A3E; color: #fff; }
.btn-ok:hover:not(:disabled) { opacity: 0.88; }
.btn-chg { background: #E0A12B; color: #fff; }
.btn-chg:hover:not(:disabled) { opacity: 0.88; }
.btn-merge { background: rgb(var(--v-theme-primary)); color: #fff; }
.btn-merge:hover:not(:disabled) { opacity: 0.88; }

/* ── 병합 배너 ── */
.pd-merge-banner { display: flex; align-items: center; gap: 9px; padding: 10px 13px; border-radius: 9px; background: #E7F4DF; color: #2E6B16; font-size: 13px; }
.pd-merge-banner b { color: #2E6B16; }

/* ── 에러 ── */
.pd-error { font-size: 12px; color: #A32D2D; background: #FCEBEB; border: 1px solid #F0AFAF; border-radius: 7px; padding: 8px 11px; margin-top: 8px; }
.pd-error-mt { margin-top: 10px; }

.plus { color: #2E6B16; font-weight: 600; }
.minus { color: #A32D2D; font-weight: 600; }
</style>
