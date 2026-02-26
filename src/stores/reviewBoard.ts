import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';

const backend: any = BackendFactory.createBackend();

export interface ReviewItem {
    review_id: string;
    proc_def_id: string;
    process_name: string;
    owner: string;
    description?: string;
    state: string;
    version?: string;
    version_label?: string;
    major_version?: number;
    minor_version?: number;
    submitted_by?: string;
    submitted_at?: string;
    // 병렬 승인
    hq_reviewer_id?: string;
    hq_reviewer_name?: string;
    hq_reviewed_at?: string;
    hq_status?: string;
    field_reviewer_id?: string;
    field_reviewer_name?: string;
    field_reviewed_at?: string;
    field_status?: string;
    // 공람
    public_feedback_started_at?: string;
    public_feedback_ends_at?: string;
    public_feedback_days_remaining?: number;
    // 배포
    published_by_name?: string;
    published_at?: string;
    // 반려
    rejected_by_name?: string;
    rejected_at?: string;
    reject_comment?: string;
    // Re-open
    reopen_requested_by?: string;
    reopen_requested_at?: string;
    reopen_reason?: string;
    // 기타
    assigned_reviewer_id?: string;
    assigned_reviewer_name?: string;
    domain_id?: string;
    comment_count?: number;
    unresolved_comment_count?: number;
    days_since_update?: number;
    tenant_id?: string;
    created_at?: string;
    updated_at?: string;
}

export interface PipelineSummary {
    draft: number;
    in_review: number;
    public_feedback: number;
    final_edit: number;
    published: number;
    reopen_requested: number;
    rejected: number;
    archived: number;
    total: number;
}

type InboxType = 'all' | 'approval' | 'reopen' | 'submissions';

export const useReviewBoardStore = defineStore({
    id: 'reviewBoard',
    state: () => ({
        // Board 데이터
        items: [] as ReviewItem[],
        loading: false,
        error: null as string | null,

        // 3-Way Inbox
        activeInbox: 'all' as InboxType,
        approvalInboxItems: [] as ReviewItem[],
        reopenItems: [] as ReviewItem[],
        submissionItems: [] as ReviewItem[],

        // 선택된 리뷰
        selectedReview: null as ReviewItem | null,
        selectedReviewHistory: [] as any[],

        // Audit Sidebar
        auditSidebarOpen: false,
        auditSidebarReviewId: null as string | null,

        // Pipeline Summary
        pipelineSummary: {
            draft: 0,
            in_review: 0,
            public_feedback: 0,
            final_edit: 0,
            published: 0,
            reopen_requested: 0,
            rejected: 0,
            archived: 0,
            total: 0
        } as PipelineSummary,
    }),

    getters: {
        // Kanban 컬럼별 아이템
        draftItems: (state) => state.items.filter(i => i.state === 'draft'),
        reviewItems: (state) => state.items.filter(i => i.state === 'in_review'),
        approvedItems: (state) => state.items.filter(i =>
            ['public_feedback', 'final_edit'].includes(i.state)
        ),
        publishedItems: (state) => state.items.filter(i => i.state === 'published'),
        rejectedItems: (state) => state.items.filter(i => i.state === 'rejected'),

        // Critical Alert: 공람 D-7 이하 또는 7일 이상 정체
        criticalAlerts: (state): ReviewItem[] => {
            return state.items.filter(item => {
                if (item.public_feedback_days_remaining !== null &&
                    item.public_feedback_days_remaining !== undefined &&
                    item.public_feedback_days_remaining <= 7) {
                    return true;
                }
                if (item.days_since_update && item.days_since_update >= 7 &&
                    !['published', 'archived', 'cancelled'].includes(item.state)) {
                    return true;
                }
                return false;
            });
        },

        // 공람 D-day 포맷
        publicFeedbackDday: () => (item: ReviewItem): string | null => {
            if (!item.public_feedback_ends_at) return null;
            const end = new Date(item.public_feedback_ends_at);
            const now = new Date();
            const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diff > 0) return `D-${diff}`;
            if (diff === 0) return 'D-Day';
            return `D+${Math.abs(diff)}`;
        },

        // 활성 인박스 아이템
        activeInboxItems(state): ReviewItem[] {
            switch (state.activeInbox) {
                case 'approval': return state.approvalInboxItems;
                case 'reopen': return state.reopenItems;
                case 'submissions': return state.submissionItems;
                default: return state.items;
            }
        },

        // 미해결 피드백 요약
        unresolvedFeedbackSummary: (state) => (reviewItem: ReviewItem) => {
            return {
                total: reviewItem.comment_count || 0,
                unresolved: reviewItem.unresolved_comment_count || 0,
                resolved: (reviewItem.comment_count || 0) - (reviewItem.unresolved_comment_count || 0),
                progress: reviewItem.comment_count
                    ? Math.round(((reviewItem.comment_count - (reviewItem.unresolved_comment_count || 0)) / reviewItem.comment_count) * 100)
                    : 100,
                canPublish: (reviewItem.unresolved_comment_count || 0) === 0
            };
        },

        // 병렬 승인 완료 여부
        isParallelApprovalComplete: () => (item: ReviewItem): boolean => {
            return item.hq_status === 'approved' && item.field_status === 'approved';
        },
    },

    actions: {
        // Board 전체 데이터 로드
        async fetchBoardData() {
            this.loading = true;
            this.error = null;
            try {
                this.items = await backend.getReviewBoardData();
                this.computePipelineSummary();
            } catch (e: any) {
                this.error = e.message || 'Failed to load review board data';
                console.error('[ReviewBoardStore] fetchBoardData error:', e);
            } finally {
                this.loading = false;
            }
        },

        // 3-Way Inbox 데이터 로드
        async fetchInboxData(inbox: 'approval' | 'reopen' | 'submissions') {
            try {
                const data = await backend.getReviewBoardByInbox(inbox);
                switch (inbox) {
                    case 'approval':
                        this.approvalInboxItems = data;
                        break;
                    case 'reopen':
                        this.reopenItems = data;
                        break;
                    case 'submissions':
                        this.submissionItems = data;
                        break;
                }
            } catch (e: any) {
                console.error(`[ReviewBoardStore] fetchInboxData(${inbox}) error:`, e);
            }
        },

        // 모든 인박스 병렬 로드
        async fetchAllInboxes() {
            await Promise.all([
                this.fetchInboxData('approval'),
                this.fetchInboxData('reopen'),
                this.fetchInboxData('submissions'),
            ]);
        },

        // Pipeline 집계 계산
        computePipelineSummary() {
            const summary: PipelineSummary = {
                draft: 0, in_review: 0, public_feedback: 0, final_edit: 0,
                published: 0, reopen_requested: 0, rejected: 0, archived: 0, total: 0
            };
            for (const item of this.items) {
                if (item.state in summary) {
                    (summary as any)[item.state]++;
                }
                summary.total++;
            }
            this.pipelineSummary = summary;
        },

        // 인박스 탭 변경
        setActiveInbox(inbox: InboxType) {
            this.activeInbox = inbox;
            if (inbox !== 'all') {
                this.fetchInboxData(inbox as 'approval' | 'reopen' | 'submissions');
            }
        },

        // 리뷰 선택 및 상세 로드
        async selectReview(reviewId: string) {
            try {
                this.selectedReview = await backend.getApprovalStateById(reviewId);
                this.selectedReviewHistory = await backend.getApprovalHistory(reviewId, true);
            } catch (e: any) {
                console.error('[ReviewBoardStore] selectReview error:', e);
            }
        },

        // Audit Sidebar 토글
        openAuditSidebar(reviewId: string) {
            this.auditSidebarReviewId = reviewId;
            this.auditSidebarOpen = true;
        },

        closeAuditSidebar() {
            this.auditSidebarOpen = false;
            this.auditSidebarReviewId = null;
        },

        // === 워크플로우 액션 ===

        async submitForReview(procDefId: string, comment?: string, version?: string, reviewers?: {
            hq?: { id: string; name: string };
            field?: { id: string; name: string };
        }) {
            const result = await backend.submitForReview(procDefId, comment, version, reviewers);
            await this.fetchBoardData();
            return result;
        },

        async approveHQ(reviewId: string, comment?: string) {
            const result = await backend.approveHQ(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async approveField(reviewId: string, comment?: string) {
            const result = await backend.approveField(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async rejectHQ(reviewId: string, comment: string) {
            const result = await backend.rejectHQ(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async rejectField(reviewId: string, comment: string) {
            const result = await backend.rejectField(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async publishDefinition(reviewId: string, comment?: string) {
            const result = await backend.publishDefinition(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async rejectDefinition(reviewId: string, comment: string) {
            const result = await backend.rejectDefinition(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async requestReopen(procDefId: string, reason: string) {
            const result = await backend.requestReopen(procDefId, reason);
            await this.fetchBoardData();
            return result;
        },

        async approveReopen(reviewId: string, comment?: string) {
            const result = await backend.approveReopen(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async rejectReopen(reviewId: string, comment?: string) {
            const result = await backend.rejectReopen(reviewId, comment);
            await this.fetchBoardData();
            return result;
        },

        async resetApprovals(reviewId: string) {
            const result = await backend.resetApprovals(reviewId);
            await this.fetchBoardData();
            return result;
        },

        async checkSelfApproval(reviewId: string): Promise<boolean> {
            return backend.checkSelfApproval(reviewId);
        },

        // 스냅샷
        async saveSnapshot(reviewId: string, procDefId: string, stage: string, bpmnXml: string, bpmnJson?: any) {
            return backend.saveSnapshot(reviewId, procDefId, stage, bpmnXml, bpmnJson);
        },

        async getSnapshots(reviewId: string) {
            return backend.getSnapshots(reviewId);
        },
    }
});
