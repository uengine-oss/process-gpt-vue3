<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { differenceInDays, formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale';
import BackendFactory from '@/components/api/BackendFactory';
import {
    buildProcessHierarchyQuery,
    PROCESS_HIERARCHY_ENTRY,
    PROCESS_HIERARCHY_MODE,
    PROCESS_HIERARCHY_PANEL_STATE,
    PROCESS_HIERARCHY_RIGHT_TAB
} from '@/views/process-hierarchy/navigation';

const backend = BackendFactory.createBackend() as any;
const router = useRouter();

const loading = ref(false);
const boardData = ref<any[]>([]);
const metricsMap = ref<any>(null);
const selectedItem = ref<any>(null);
const sidebarOpen = ref(false);
const sidebarHistory = ref<any[]>([]);
const sidebarLoading = ref(false);

// Tab & table state
const activeTab = ref<'inbox' | 'reopen' | 'submissions'>('inbox');
const selectedRows = ref<Set<string>>(new Set());
const selectAll = ref(false);

const enrichedData = computed(() => {
    const domains = metricsMap.value?.domains || [];
    return boardData.value.map((item) => {
        const domain = domains.find((d: any) => d.id === item.domain_id);
        return {
            ...item,
            domain_name: domain?.name || item.domain_id || '',
            domain_color: domain?.color || '#0085db'
        };
    });
});

// Step flow stats (신규 상태값 기준)
const draftItems = computed(() => enrichedData.value.filter((i) => i.state === 'draft' || i.state === 'rejected'));
const reviewItems = computed(() => enrichedData.value.filter((i) => i.state === 'in_review' || i.state === 'review'));
const publicFeedbackItems = computed(() => enrichedData.value.filter((i) => i.state === 'public_feedback'));
const finalEditItems = computed(() => enrichedData.value.filter((i) => i.state === 'final_edit'));
const publishedItems = computed(() => enrichedData.value.filter((i) => i.state === 'published' || i.state === 'confirmed'));
const reopenItems = computed(() => enrichedData.value.filter((i) => i.state === 'reopen_requested'));
const archivedItems = computed(() => enrichedData.value.filter((i) => i.state === 'archived'));

// Tab-filtered items
// "Approval Inbox" = items currently in review states (not draft, not published/archived)
const inboxItems = computed(() =>
    enrichedData.value.filter((i) => ['in_review', 'review', 'public_feedback', 'final_edit'].includes(i.state))
);
// "My Submissions" = drafts + rejected (user's own submissions)
const mySubmissions = computed(() => enrichedData.value.filter((i) => ['draft', 'rejected', 'published', 'confirmed'].includes(i.state)));

const activeTabItems = computed(() => {
    if (activeTab.value === 'inbox') return inboxItems.value;
    if (activeTab.value === 'reopen') return reopenItems.value;
    if (activeTab.value === 'submissions') return mySubmissions.value;
    return [];
});

// Critical alert counts
const publicFeedbackUrgentCount = computed(() => {
    const now = new Date();
    return enrichedData.value.filter((item) => {
        if (item.state !== 'public_feedback' || !item.public_feedback_ends_at) return false;
        const daysLeft = differenceInDays(new Date(item.public_feedback_ends_at), now);
        return daysLeft <= 7 && daysLeft >= 0;
    }).length;
});

const stalledCount = computed(() => {
    const now = new Date();
    return enrichedData.value.filter((item) => {
        if (['published', 'confirmed', 'cancelled', 'archived'].includes(item.state)) return false;
        if (!item.updated_at) return false;
        return differenceInDays(now, new Date(item.updated_at)) >= 7;
    }).length;
});

// Critical alerts
const urgentItems = computed(() => {
    const now = new Date();
    return enrichedData.value.filter((item) => {
        if (['published', 'confirmed', 'cancelled', 'archived'].includes(item.state)) return false;
        // 공람 D-7 이하
        if (item.state === 'public_feedback' && item.public_feedback_ends_at) {
            const daysLeft = differenceInDays(new Date(item.public_feedback_ends_at), now);
            if (daysLeft <= 7 && daysLeft >= 0) return true;
        }
        if (item.updated_at) {
            const daysSinceUpdate = differenceInDays(now, new Date(item.updated_at));
            if (daysSinceUpdate >= 7) return true;
        }
        return false;
    });
});

// Kanban columns
const kanbanColumns = computed(() => [
    {
        key: 'draft',
        label: 'Draft',
        color: '#78909c',
        chipColor: 'grey',
        icon: 'mdi-file-edit-outline',
        items: draftItems.value
    },
    {
        key: 'in_review',
        label: 'Expert Review',
        color: '#f59e0b',
        chipColor: 'warning',
        icon: 'mdi-magnify',
        items: reviewItems.value
    },
    {
        key: 'public_feedback',
        label: 'Public Feedback',
        color: '#8b5cf6',
        chipColor: 'purple',
        icon: 'mdi-account-group-outline',
        items: publicFeedbackItems.value
    },
    {
        key: 'final_edit',
        label: 'Final Edit',
        color: '#3b82f6',
        chipColor: 'info',
        icon: 'mdi-pencil-outline',
        items: finalEditItems.value
    },
    {
        key: 'published',
        label: 'Published',
        color: '#10b981',
        chipColor: 'success',
        icon: 'mdi-rocket-launch-outline',
        items: publishedItems.value
    }
]);

// Step flow pipeline steps
const pipelineSteps = computed(() => [
    { label: 'Draft', count: draftItems.value.length, color: '#78909c', active: draftItems.value.length > 0 },
    { label: 'Expert Review', count: reviewItems.value.length, color: '#f59e0b', active: reviewItems.value.length > 0 },
    { label: 'Public Feedback', count: publicFeedbackItems.value.length, color: '#8b5cf6', active: publicFeedbackItems.value.length > 0 },
    { label: 'Final Edit', count: finalEditItems.value.length, color: '#3b82f6', active: finalEditItems.value.length > 0 },
    { label: 'Published', count: publishedItems.value.length, color: '#10b981', active: publishedItems.value.length > 0 }
]);

function openDetail(reviewId: string) {
    router.push('/review-board/' + reviewId);
}

function openInEditor(item: any) {
    const procDefId = item.proc_def_id;
    if (!procDefId) return;

    const mode = ['draft', 'rejected'].includes(item.state) ? PROCESS_HIERARCHY_MODE.EDIT : PROCESS_HIERARCHY_MODE.VIEW;
    router.push({
        name: 'Process Hierarchy',
        params: { id: procDefId },
        query: buildProcessHierarchyQuery({
            name: item.process_name || procDefId,
            entry: PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD,
            mode,
            right: PROCESS_HIERARCHY_PANEL_STATE.OPEN,
            rightTab: PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE,
            reviewId: item.review_id || item.id
        })
    });
}

async function openSidebar(item: any) {
    selectedItem.value = item;
    sidebarOpen.value = true;
    sidebarLoading.value = true;
    try {
        const procDefId = item.proc_def_id;
        if (procDefId) {
            // 2.3: Cross-version timeline (전체 리뷰 사이클 + 이력)
            const timeline = await backend.getCrossVersionTimeline(procDefId);
            sidebarHistory.value = timeline || [];
        } else {
            const id = item.review_id || item.id;
            if (id) {
                const historyData = await backend.getApprovalHistory(id, true);
                sidebarHistory.value = historyData || [];
            }
        }
    } catch (e) {
        sidebarHistory.value = [];
    } finally {
        sidebarLoading.value = false;
    }
}

function closeSidebar() {
    sidebarOpen.value = false;
    selectedItem.value = null;
}

function getActionColor(action: string): string {
    const colorMap: Record<string, string> = {
        submit: 'warning',
        approve_level1: 'info',
        approve_level2: 'primary',
        approve_hq: 'success',
        approve_field: 'success',
        confirm: 'success',
        publish: 'success',
        reject: 'error',
        reject_hq: 'error',
        reject_field: 'error',
        reopen: 'grey',
        reassign: 'primary',
        cancel: 'warning',
        comment: 'grey',
        end_public_feedback: 'info'
    };
    return colorMap[action] || 'grey';
}

function getActionLabel(action: string): string {
    const labelMap: Record<string, string> = {
        submit: '상신',
        approve_level1: '1차 승인',
        approve_level2: '2차 승인',
        approve_hq: 'HQ 승인',
        approve_field: 'Field 승인',
        confirm: '최종 확정',
        publish: '배포',
        reject: '반려',
        reject_hq: 'HQ 반려',
        reject_field: 'Field 반려',
        reopen: '재상신',
        reassign: '담당자 변경',
        cancel: '취소',
        comment: '코멘트',
        end_public_feedback: '공람 종료'
    };
    return labelMap[action] || action;
}

function getStateLabel(state: string): string {
    const map: Record<string, string> = {
        draft: '초안',
        review: '검토중',
        in_review: '검토중',
        public_feedback: '전사 공람',
        final_edit: '최종 편집',
        confirmed: '배포 완료',
        published: '배포 완료',
        rejected: '반려',
        cancelled: '취소',
        archived: '아카이브'
    };
    return map[state] || state;
}

function getStateColor(state: string): string {
    const map: Record<string, string> = {
        draft: 'grey',
        review: 'warning',
        in_review: 'warning',
        public_feedback: 'purple',
        final_edit: 'info',
        confirmed: 'success',
        published: 'success',
        rejected: 'error',
        cancelled: 'grey'
    };
    return map[state] || 'grey';
}

function formatTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return dateStr;
    }
}

function getInitials(name: string): string {
    if (!name) return '??';
    return name.substring(0, 2).toUpperCase();
}

function getDaysStalled(updatedAt: string): number {
    if (!updatedAt) return 0;
    return differenceInDays(new Date(), new Date(updatedAt));
}

function getDueAlertLabel(item: any): string | null {
    const now = new Date();
    if (item.due_date) {
        const daysLeft = differenceInDays(new Date(item.due_date), now);
        if (daysLeft <= 7 && daysLeft >= 0) return `D-${daysLeft}`;
    }
    if (item.updated_at) {
        const daysSinceUpdate = differenceInDays(now, new Date(item.updated_at));
        if (daysSinceUpdate >= 7) return `${daysSinceUpdate}일 정체`;
    }
    return null;
}

function getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
        return formatDistanceToNowStrict(new Date(dateStr), { addSuffix: true, locale: ko });
    } catch {
        return dateStr;
    }
}

function getAvatarColor(name: string): string {
    if (!name) return '#94a3b8';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#4f46e5', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0284c7', '#0891b2', '#65a30d'];
    return colors[Math.abs(hash) % colors.length];
}

function toggleRow(id: string) {
    const newSet = new Set(selectedRows.value);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    selectedRows.value = newSet;
    selectAll.value = newSet.size === activeTabItems.value.length && newSet.size > 0;
}

function toggleSelectAll(val: boolean | null) {
    if (val) {
        selectedRows.value = new Set(activeTabItems.value.map((i) => i.review_id || i.proc_def_id));
    } else {
        selectedRows.value = new Set();
    }
}

async function handleBulkApprove() {
    const ids = Array.from(selectedRows.value);
    if (ids.length === 0) return;

    const confirmed = window.confirm(`선택된 ${ids.length}건을 일괄 승인하시겠습니까?\n(HQ 승인 및 Field 승인이 순차 처리됩니다)`);
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;

    for (const reviewId of ids) {
        try {
            await backend.approveHQ(reviewId, '일괄 승인');
            await backend.approveField(reviewId, '일괄 승인');
            successCount++;
        } catch (e) {
            console.error(`[ReviewBoard] Bulk approve failed for ${reviewId}:`, e);
            errorCount++;
        }
    }

    selectedRows.value = new Set();
    selectAll.value = false;

    if (errorCount === 0) {
        showGlobalToast(`${successCount}건 일괄 승인이 완료되었습니다.`, 'success');
    } else {
        showGlobalToast(`${successCount}건 승인 완료, ${errorCount}건 실패.`, 'error');
    }

    await loadData();
}

async function handleBulkReject() {
    const ids = Array.from(selectedRows.value);
    if (ids.length === 0) return;

    const reason = window.prompt(`선택된 ${ids.length}건을 일괄 반려합니다.\n반려 사유를 입력하세요 (필수):`);
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
        showGlobalToast('반려 사유를 입력해야 합니다.', 'error');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const reviewId of ids) {
        try {
            await backend.rejectHQ(reviewId, reason.trim());
            await backend.rejectField(reviewId, reason.trim());
            successCount++;
        } catch (e) {
            console.error(`[ReviewBoard] Bulk reject failed for ${reviewId}:`, e);
            errorCount++;
        }
    }

    selectedRows.value = new Set();
    selectAll.value = false;

    if (errorCount === 0) {
        showGlobalToast(`${successCount}건 일괄 반려가 완료되었습니다.`, 'error');
    } else {
        showGlobalToast(`${successCount}건 반려 완료, ${errorCount}건 실패.`, 'error');
    }

    await loadData();
}

async function handleBulkPublish() {
    const ids = Array.from(selectedRows.value);
    if (ids.length === 0) return;

    const confirmed = window.confirm(`선택된 ${ids.length}건을 최종 배포(Publish)하시겠습니까?\n배포 후에는 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;

    for (const reviewId of ids) {
        try {
            await backend.publishDefinition(reviewId, '일괄 배포');
            successCount++;
        } catch (e) {
            console.error(`[ReviewBoard] Bulk publish failed for ${reviewId}:`, e);
            errorCount++;
        }
    }

    selectedRows.value = new Set();
    selectAll.value = false;

    if (errorCount === 0) {
        showGlobalToast(`${successCount}건 배포가 완료되었습니다.`, 'success');
    } else {
        showGlobalToast(`${successCount}건 배포 완료, ${errorCount}건 실패.`, 'error');
    }

    await loadData();
}

async function loadData() {
    loading.value = true;
    try {
        const [data, metrics] = await Promise.all([backend.getReviewBoardData(), backend.getMetricsMap()]);
        boardData.value = data || [];
        metricsMap.value = metrics;
    } catch (e) {
        console.error('Failed to load review board:', e);
    } finally {
        loading.value = false;
    }
}

// ── Realtime: 상태 변경 시 Toast + 자동 갱신 ──
let realtimeChannel: any = null;
const globalToast = ref<{ message: string; color: string } | null>(null);

function showGlobalToast(message: string, color = 'success') {
    globalToast.value = { message, color };
    setTimeout(() => {
        globalToast.value = null;
    }, 5000);
}

const stateMessages: Record<string, (name: string) => string> = {
    public_feedback: (n) => `"${n}" 전문가 검토 완료. 전사 30일 공람 기간이 시작되었습니다.`,
    final_edit: (n) => `"${n}" 공람 종료. 최종 편집 단계로 이동했습니다.`,
    published: (n) => `"${n}" 프로세스가 배포 완료되었습니다.`,
    rejected: (n) => `"${n}" 프로세스가 반려되었습니다.`,
    reopen_requested: (n) => `"${n}" 현장 개선 요청이 등록되었습니다.`
};

function setupRealtime() {
    const supabase = (window as any).$supabase;
    if (!supabase) return;

    realtimeChannel = supabase
        .channel('review-board-global')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'proc_def_approval_state'
            },
            (payload: any) => {
                const newState = payload.new?.state;
                const oldState = payload.old?.state;
                const procDefId = payload.new?.proc_def_id;
                const oldKeys = Object.keys(payload.old || {});
                const hasOldState = oldKeys.includes('state');
                // REPLICA IDENTITY FULL 미적용 시 boardData에서 로컬 상태 참조
                const localItem = boardData.value.find((i) => i.proc_def_id === procDefId);
                const localState = localItem?.state;
                const effectiveOldState = hasOldState ? oldState : localState;

                console.log('[Realtime Board] UPDATE:', {
                    procDefId,
                    newState,
                    oldState,
                    localState,
                    effectiveOldState,
                    hasOldState,
                    oldKeysCount: oldKeys.length,
                    stateChanged: newState !== effectiveOldState
                });

                if (newState && newState !== effectiveOldState) {
                    const name = localItem?.process_name || procDefId || '';
                    const msgFn = stateMessages[newState];
                    if (msgFn) {
                        showGlobalToast(msgFn(name), newState === 'rejected' ? 'error' : 'success');
                    }
                }
                loadData();
            }
        )
        .subscribe((status: string) => {
            console.log('[Realtime Board] Subscription status:', status);
        });
}

function cleanupRealtime() {
    if (realtimeChannel) {
        const supabase = (window as any).$supabase;
        if (supabase) supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
}

onMounted(async () => {
    await loadData();
    setupRealtime();
});

onBeforeUnmount(cleanupRealtime);
</script>

<template>
    <div class="review-board-page">
        <!-- ── Page Header + Critical Alerts ── -->
        <v-card elevation="10" class="rounded-xl content-card">
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">Governance Control Center</h1>
                <p class="page-subtitle">프로세스 거버넌스 라이프사이클 관리</p>
            </div>
            <div class="page-header-right">
                <!-- Critical Alerts Card -->
                <div v-if="urgentItems.length > 0" class="critical-alerts-card">
                    <div class="critical-alerts-header">
                        <v-icon size="14" color="error">mdi-alert-circle</v-icon>
                        <span class="critical-alerts-title">CRITICAL ALERTS</span>
                    </div>
                    <div class="critical-alerts-body">
                        <div class="critical-alert-row" @click="activeTab = 'inbox'">
                            <v-icon size="14" color="#e57373" class="mr-1">mdi-clock-alert-outline</v-icon>
                            <span>공람 종료 임박</span>
                            <v-chip size="x-small" color="error" variant="flat" class="ml-auto"> {{ publicFeedbackUrgentCount }}건 </v-chip>
                        </div>
                        <div class="critical-alert-row" @click="activeTab = 'inbox'">
                            <v-icon size="14" color="#ffb74d" class="mr-1">mdi-timer-sand</v-icon>
                            <span>7일 이상 지연</span>
                            <v-chip size="x-small" color="error" variant="flat" class="ml-auto"> {{ stalledCount }}건 </v-chip>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ── Main Content Card ── -->

        <!-- Pipeline Bar -->
        <div class="pipeline-bar">
            <template v-for="(step, idx) in pipelineSteps" :key="step.label">
                <div class="pipeline-info" :class="{ 'pipeline-info--active': step.active }">
                    <span class="pipeline-label">{{ step.label }}</span>
                    <span class="pipeline-count" :style="{ color: step.active ? step.color : '#b0b8c4' }">
                        {{ step.count }}<small>건</small>
                    </span>
                </div>
                <div v-if="idx < pipelineSteps.length - 1" class="pipeline-bar-connector">
                    <div class="pipeline-bar-line" :style="{ background: step.active ? step.color : '#e2e8f0' }"></div>
                    <v-icon size="12" color="grey-lighten-1" class="pipeline-chevron">mdi-chevron-right</v-icon>
                </div>
            </template>
        </div>

        <!-- Tab Filters -->
        <div class="tab-filters">
            <button class="tab-filter-btn" :class="{ 'tab-filter-btn--active': activeTab === 'inbox' }" @click="activeTab = 'inbox'">
                <v-icon size="15" class="tab-filter-icon">mdi-inbox-arrow-down</v-icon>
                Approval Inbox
                <span class="tab-filter-label">(내 승인함)</span>
                <v-chip
                    size="x-small"
                    :color="activeTab === 'inbox' ? 'primary' : 'grey'"
                    :variant="activeTab === 'inbox' ? 'flat' : 'tonal'"
                    class="ml-2"
                >
                    {{ inboxItems.length }}
                </v-chip>
            </button>
            <button class="tab-filter-btn" :class="{ 'tab-filter-btn--active': activeTab === 'reopen' }" @click="activeTab = 'reopen'">
                <v-icon size="15" class="tab-filter-icon">mdi-refresh-circle</v-icon>
                Re-open Request
                <span class="tab-filter-label">(재개 요청함)</span>
                <v-chip
                    size="x-small"
                    :color="activeTab === 'reopen' ? 'primary' : 'grey'"
                    :variant="activeTab === 'reopen' ? 'flat' : 'tonal'"
                    class="ml-2"
                >
                    {{ reopenItems.length }}
                </v-chip>
            </button>
            <button
                class="tab-filter-btn"
                :class="{ 'tab-filter-btn--active': activeTab === 'submissions' }"
                @click="activeTab = 'submissions'"
            >
                <v-icon size="15" class="tab-filter-icon">mdi-file-send-outline</v-icon>
                My Submissions
                <span class="tab-filter-label">(내 발의함)</span>
                <v-chip
                    size="x-small"
                    :color="activeTab === 'submissions' ? 'primary' : 'grey'"
                    :variant="activeTab === 'submissions' ? 'flat' : 'tonal'"
                    class="ml-2"
                >
                    {{ mySubmissions.length }}
                </v-chip>
            </button>
        </div>

        <!-- Table Area -->
        <div class="board-layout">
            <div class="board-main">
                <div v-if="loading" class="d-flex justify-center py-12">
                    <v-progress-circular indeterminate color="primary" />
                </div>

                <div v-else-if="activeTabItems.length === 0" class="table-empty">
                    <v-icon size="48" color="grey-lighten-2">mdi-inbox-outline</v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-3">해당 탭에 항목이 없습니다</div>
                </div>

                <div v-else class="table-container">
                    <table class="review-table">
                        <thead>
                            <tr>
                                <th class="th-checkbox">
                                    <v-checkbox v-model="selectAll" hide-details density="compact" @update:model-value="toggleSelectAll" />
                                </th>
                                <th class="th-process">프로세스</th>
                                <th class="th-author">기안자</th>
                                <th class="th-domain">도메인</th>
                                <th class="th-reviewer">리뷰어</th>
                                <th class="th-state">상태</th>
                                <th class="th-time">생성 시간</th>
                                <th class="th-action">액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="item in activeTabItems"
                                :key="item.review_id || item.proc_def_id"
                                class="review-row"
                                :class="{ 'review-row--selected': selectedRows.has(item.review_id || item.proc_def_id) }"
                                @click="openSidebar(item)"
                            >
                                <td class="td-checkbox" @click.stop>
                                    <v-checkbox
                                        :model-value="selectedRows.has(item.review_id || item.proc_def_id)"
                                        hide-details
                                        density="compact"
                                        @update:model-value="toggleRow(item.review_id || item.proc_def_id)"
                                    />
                                </td>
                                <td class="td-process">
                                    <div class="process-name">{{ item.process_name }}</div>
                                    <div class="process-id">
                                        {{ item.proc_def_id ? item.proc_def_id.substring(0, 8) : '' }}
                                        <span v-if="item.version"> &middot; v{{ item.version }}</span>
                                    </div>
                                </td>
                                <td class="td-author">
                                    <div class="author-cell">
                                        <div
                                            class="author-dot"
                                            :style="{ background: getAvatarColor(item.submitted_by || item.owner) }"
                                        ></div>
                                        <span>{{ item.submitted_by || item.owner || 'Unknown' }}</span>
                                    </div>
                                </td>
                                <td class="td-domain">
                                    <span class="domain-text">{{ item.domain_name || '-' }}</span>
                                </td>
                                <td class="td-reviewer">
                                    <div class="reviewer-badges">
                                        <v-chip
                                            v-if="item.hq_reviewer_name"
                                            size="x-small"
                                            :color="
                                                item.hq_status === 'approved'
                                                    ? 'success'
                                                    : item.hq_status === 'rejected'
                                                    ? 'error'
                                                    : '#2196f3'
                                            "
                                            variant="tonal"
                                            class="mr-1"
                                        >
                                            <v-icon start size="10">mdi-domain</v-icon>
                                            {{ item.hq_reviewer_name }}
                                        </v-chip>
                                        <v-chip
                                            v-if="item.field_reviewer_name"
                                            size="x-small"
                                            :color="
                                                item.field_status === 'approved'
                                                    ? 'success'
                                                    : item.field_status === 'rejected'
                                                    ? 'error'
                                                    : '#4caf50'
                                            "
                                            variant="tonal"
                                        >
                                            <v-icon start size="10">mdi-account-hard-hat</v-icon>
                                            {{ item.field_reviewer_name }}
                                        </v-chip>
                                        <span v-if="!item.hq_reviewer_name && !item.field_reviewer_name" class="text-caption text-disabled"
                                            >-</span
                                        >
                                    </div>
                                </td>
                                <td class="td-state">
                                    <v-chip size="small" :color="getStateColor(item.state)" variant="tonal" label>
                                        {{ getStateLabel(item.state) }}
                                    </v-chip>
                                    <div v-if="item.total_feedback_count > 0" class="resolution-indicator mt-1">
                                        <span class="text-caption" :class="item.unresolved_count > 0 ? 'text-warning' : 'text-success'">
                                            <v-icon size="10" :color="item.unresolved_count > 0 ? 'warning' : 'success'">
                                                {{ item.unresolved_count > 0 ? 'mdi-comment-alert-outline' : 'mdi-comment-check-outline' }}
                                            </v-icon>
                                            {{ item.unresolved_count || 0 }}/{{ item.total_feedback_count }}
                                        </span>
                                    </div>
                                </td>
                                <td class="td-time">
                                    <span class="time-text">{{ getRelativeTime(item.updated_at) }}</span>
                                </td>
                                <td class="td-action" @click.stop>
                                    <div class="d-flex align-center ga-2 flex-wrap justify-end">
                                        <v-btn
                                            size="small"
                                            variant="outlined"
                                            color="primary"
                                            rounded
                                            @click="openDetail(item.review_id || item.proc_def_id)"
                                        >
                                            <v-icon start size="14">mdi-eye-outline</v-icon>
                                            Review
                                        </v-btn>
                                        <v-btn
                                            size="small"
                                            variant="tonal"
                                            color="secondary"
                                            rounded
                                            @click="openInEditor(item)"
                                        >
                                            <v-icon start size="14">
                                                {{ ['draft', 'rejected'].includes(item.state) ? 'mdi-file-document-edit-outline' : 'mdi-open-in-app' }}
                                            </v-icon>
                                            {{ ['draft', 'rejected'].includes(item.state) ? 'Edit' : 'Editor' }}
                                        </v-btn>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ── Right: Audit Sidebar ── -->
            <transition name="sidebar-slide">
                <div v-if="sidebarOpen" class="audit-sidebar">
                    <div class="audit-sidebar-header">
                        <div class="d-flex align-center gap-2 flex-1 min-w-0">
                            <v-icon size="18" color="primary">mdi-timeline-clock-outline</v-icon>
                            <span class="text-subtitle-2 font-weight-bold text-truncate">
                                {{ selectedItem?.process_name }}
                            </span>
                        </div>
                        <v-btn icon size="x-small" variant="text" @click="closeSidebar">
                            <v-icon size="16">mdi-close</v-icon>
                        </v-btn>
                    </div>

                    <!-- Item metadata -->
                    <div v-if="selectedItem" class="audit-meta">
                        <div class="d-flex align-center gap-2 flex-wrap">
                            <v-chip size="x-small" :color="selectedItem.domain_color" variant="flat">
                                {{ selectedItem.domain_name || 'N/A' }}
                            </v-chip>
                            <v-chip v-if="selectedItem.version" size="x-small" variant="tonal" color="grey">
                                v{{ selectedItem.version }}
                            </v-chip>
                            <v-chip
                                size="x-small"
                                :color="
                                    selectedItem.state === 'confirmed' ? 'success' : selectedItem.state === 'rejected' ? 'error' : 'warning'
                                "
                                variant="tonal"
                            >
                                {{ getStateLabel(selectedItem.state) }}
                            </v-chip>
                        </div>
                        <div class="d-flex flex-column ga-2 mt-3">
                            <v-btn
                                size="small"
                                variant="flat"
                                color="primary"
                                class="w-100"
                                @click="openDetail(selectedItem.review_id || selectedItem.proc_def_id)"
                            >
                                <v-icon start size="16">mdi-open-in-new</v-icon>
                                상세 보기
                            </v-btn>
                            <v-btn
                                size="small"
                                variant="tonal"
                                color="secondary"
                                class="w-100"
                                @click="openInEditor(selectedItem)"
                            >
                                <v-icon start size="16">
                                    {{ ['draft', 'rejected'].includes(selectedItem.state) ? 'mdi-file-document-edit-outline' : 'mdi-open-in-app' }}
                                </v-icon>
                                {{ ['draft', 'rejected'].includes(selectedItem.state) ? 'Page2 편집 열기' : 'Page2 리뷰 열기' }}
                            </v-btn>
                        </div>
                    </div>

                    <!-- Governance Timeline -->
                    <div class="audit-timeline-section">
                        <div class="text-caption text-medium-emphasis font-weight-medium mb-3 px-1">거버넌스 타임라인</div>

                        <div v-if="sidebarLoading" class="d-flex justify-center py-6">
                            <v-progress-circular indeterminate color="primary" size="20" />
                        </div>

                        <div v-else-if="sidebarHistory.length === 0" class="text-center py-6">
                            <v-icon size="32" color="grey-lighten-2">mdi-timeline-outline</v-icon>
                            <div class="text-caption text-medium-emphasis mt-2">이력이 없습니다</div>
                        </div>

                        <div v-else class="audit-timeline-list">
                            <template v-for="(entry, idx) in sidebarHistory" :key="idx">
                                <div v-if="entry.type === 'cycle_start'" class="audit-cycle-divider">
                                    <div class="audit-cycle-line"></div>
                                    <div class="audit-cycle-chip">
                                        <v-chip size="x-small" variant="tonal" color="primary" class="mr-1">
                                            <v-icon start size="10">mdi-refresh-circle</v-icon>
                                            {{ entry.version ? 'v' + entry.version : '리뷰 사이클' }}
                                        </v-chip>
                                        <v-chip size="x-small" :color="getStateColor(entry.state)" variant="flat">
                                            {{ getStateLabel(entry.state) }}
                                        </v-chip>
                                    </div>
                                    <div class="text-caption text-medium-emphasis mt-1 px-1">{{ formatTime(entry.created_at) }}</div>
                                </div>

                                <div v-else class="audit-entry">
                                    <div
                                        class="audit-entry-dot"
                                        :style="{ background: getActionColor(entry.action) === 'grey' ? '#9ca3af' : '' }"
                                    >
                                        <v-icon size="10" color="white">mdi-circle-small</v-icon>
                                    </div>
                                    <div class="audit-entry-body">
                                        <div class="d-flex align-center gap-2 mb-1">
                                            <v-avatar size="20" :color="getActionColor(entry.action)">
                                                <span class="audit-avatar-text">{{ getInitials(entry.actor_name || entry.actor_id) }}</span>
                                            </v-avatar>
                                            <span class="text-caption font-weight-medium">{{ entry.actor_name || entry.actor_id }}</span>
                                            <v-chip size="x-small" :color="getActionColor(entry.action)" variant="tonal">
                                                {{ getActionLabel(entry.action) }}
                                            </v-chip>
                                        </div>
                                        <div v-if="entry.comment" class="audit-comment">{{ entry.comment }}</div>
                                        <div v-if="entry.resolved" class="audit-resolved">
                                            <v-icon size="10" color="success">mdi-check-circle</v-icon>
                                            <span class="text-caption">Resolved</span>
                                        </div>
                                        <div class="text-caption text-medium-emphasis">{{ formatTime(entry.created_at) }}</div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </transition>
        </div>
        </v-card>
        <!-- end content-card -->

        <!-- ── Bottom Action Bar ── -->
        <div v-if="selectedRows.size > 0" class="bottom-action-bar">
            <div class="bottom-action-info">
                <v-icon size="16" class="mr-1">mdi-check-circle-outline</v-icon>
                {{ selectedRows.size }}건 선택됨
            </div>
            <div class="bottom-action-buttons">
                <v-btn color="primary" variant="flat" size="small" @click="handleBulkApprove">
                    <v-icon start size="16">mdi-check</v-icon>
                    승인: 차기 Draft 생성
                </v-btn>
                <v-btn color="default" variant="outlined" size="small" @click="handleBulkReject">
                    <v-icon start size="16">mdi-close</v-icon>
                    반려: 현행 유지
                </v-btn>
                <v-btn color="success" variant="flat" size="small" @click="handleBulkPublish">
                    <v-icon start size="16">mdi-rocket-launch-outline</v-icon>
                    Publish (최종 배포)
                </v-btn>
            </div>
        </div>
    </div>

    <!-- ── Global Toast (Realtime 알림) ── -->
    <transition name="toast-slide">
        <div v-if="globalToast" class="global-toast" :class="`global-toast--${globalToast.color}`">
            <v-icon size="16" class="mr-2">
                {{
                    globalToast.color === 'success'
                        ? 'mdi-check-circle'
                        : globalToast.color === 'error'
                        ? 'mdi-alert-circle'
                        : 'mdi-information'
                }}
            </v-icon>
            {{ globalToast.message }}
            <button class="global-toast-close" @click="globalToast = null">
                <v-icon size="14">mdi-close</v-icon>
            </button>
        </div>
    </transition>
</template>

<style scoped>
.review-board-page {
    min-height: calc(100dvh - var(--v-layout-top, 0px) - 56px);
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* ── Page Header ── */
.page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 20px 24px 16px;
    flex-shrink: 0;
}
.page-header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.page-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.3;
    margin: 0;
}
.page-subtitle {
    font-size: 12px;
    color: #64748b;
    margin: 0;
}
.page-header-right {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

/* ── Critical Alerts Card ── */
.critical-alerts-card {
    background: #fff;
    border: 1px solid #fecdd3;
    border-radius: 12px;
    padding: 0;
    min-width: 200px;
    box-shadow: 0 2px 8px rgba(220, 38, 38, 0.08);
}
.critical-alerts-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-bottom: 1px solid #fee2e2;
}
.critical-alerts-title {
    font-size: 11px;
    font-weight: 700;
    color: #dc2626;
    letter-spacing: 0.5px;
}
.critical-alerts-body {
    padding: 4px 0;
}
.critical-alert-row {
    display: flex;
    align-items: center;
    padding: 8px 14px;
    font-size: 12px;
    color: #374151;
    cursor: pointer;
    transition: background 0.15s;
    gap: 4px;
}
.critical-alert-row:hover {
    background: #fef2f2;
}

/* ── Content Card (v-card elevation-10 rounded-xl) ── */
.content-card {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

/* ── Pipeline Bar (content-card 내부) ── */
.pipeline-bar {
    display: flex;
    align-items: center;
    padding: 20px 24px 16px;
    flex-shrink: 0;
    border-bottom: 1px solid #f0f2f5;
}
.pipeline-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    min-width: 60px;
}
.pipeline-label {
    font-size: 11px;
    color: #94a3b8;
    white-space: nowrap;
}
.pipeline-info--active .pipeline-label {
    color: #64748b;
}
.pipeline-count {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
}
.pipeline-count small {
    font-size: 11px;
    font-weight: 500;
    color: #b0b8c4;
    margin-left: 1px;
}
.pipeline-bar-connector {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 20px;
    padding: 0 4px;
}
.pipeline-bar-line {
    height: 4px;
    border-radius: 2px;
    flex: 1;
}
.pipeline-chevron {
    flex-shrink: 0;
    opacity: 0.35;
    margin-left: 2px;
}

/* ── Tab Filters (content-card 내부) ── */
.tab-filters {
    display: flex;
    gap: 0;
    padding: 0 24px;
    flex-shrink: 0;
    border-bottom: 1px solid #e8ecf0;
    background: #fafbfc;
}
.tab-filter-btn {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    font-size: 13px;
    font-weight: 500;
    color: #94a3b8;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    margin-bottom: -1px;
}
.tab-filter-icon {
    margin-right: 6px;
    opacity: 0.7;
}
.tab-filter-label {
    font-size: 11px;
    margin-left: 4px;
    opacity: 0.7;
}
.tab-filter-btn:hover {
    color: #475569;
    background: #f1f5f9;
}
.tab-filter-btn--active {
    color: #1e40af;
    border-bottom-color: #3b82f6;
    font-weight: 600;
    background: #fff;
}
.tab-filter-btn--active .tab-filter-icon {
    opacity: 1;
}
.tab-filter-btn--active .tab-filter-label {
    opacity: 1;
}

/* ── Layout (content-card 내부) ── */
.board-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
}
.board-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* ── Table ── */
.table-container {
    flex: 1;
    overflow-y: auto;
}
.table-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 48px 16px;
}
.review-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
}
.review-table thead {
    position: sticky;
    top: 0;
    z-index: 2;
}
.review-table th {
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    background: #f8fafc;
    border-bottom: 1px solid #e8ecf0;
    text-align: left;
    white-space: nowrap;
}
.th-checkbox {
    width: 44px;
}
.th-process {
    min-width: 200px;
}
.th-author {
    min-width: 120px;
}
.th-domain {
    min-width: 80px;
}
.th-reviewer {
    min-width: 160px;
}
.th-state {
    min-width: 100px;
}
.th-time {
    min-width: 100px;
}
.th-action {
    width: 100px;
}

.review-row {
    cursor: pointer;
    transition: background 0.12s;
}
.review-row:hover {
    background: #f8fafc;
}
.review-row--selected {
    background: #eff6ff;
}
.review-row td {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
    vertical-align: middle;
}

/* Process cell */
.process-name {
    font-weight: 600;
    color: #0f172a;
    line-height: 1.4;
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 280px;
}
.process-id {
    font-size: 11px;
    color: #b0b8c4;
}

/* Author cell */
.author-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}
.author-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

/* Reviewer badges */
.reviewer-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
}

/* Domain */
.domain-text {
    font-size: 12px;
    color: #475569;
}

/* Time */
.time-text {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
}

/* ── Bottom Action Bar ── */
.bottom-action-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    background: #fff;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.bottom-action-info {
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
}
.bottom-action-buttons {
    display: flex;
    gap: 8px;
}

@media screen and (max-width: 1279px) {
    .review-board-page {
        min-height: calc(100dvh - var(--v-layout-top, 0px));
        gap: 12px;
    }
}

/* ── Audit Sidebar (content-card 내부) ── */
.audit-sidebar {
    width: 320px;
    flex-shrink: 0;
    background: #fafbfc;
    border-left: 1px solid #e8ecf0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.audit-sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    border-bottom: 1px solid #e8ecf0;
    flex-shrink: 0;
}
.audit-meta {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f2f5;
    flex-shrink: 0;
}
.audit-timeline-section {
    flex: 1;
    overflow-y: auto;
    padding: 12px 8px;
}
.audit-avatar-text {
    font-size: 9px;
    font-weight: 700;
    color: white;
}
.audit-comment {
    font-size: 11px;
    color: #555;
    background: #f8fafb;
    border-radius: 6px;
    padding: 4px 8px;
    margin: 4px 0;
    border-left: 2px solid #e0e0e0;
}

/* Cross-version timeline */
.audit-timeline-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.audit-cycle-divider {
    padding: 10px 4px 6px;
    margin-top: 4px;
}
.audit-cycle-divider:first-child {
    margin-top: 0;
}
.audit-cycle-line {
    height: 1px;
    background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
    margin-bottom: 8px;
}
.audit-cycle-divider:first-child .audit-cycle-line {
    display: none;
}
.audit-cycle-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}
.audit-entry {
    display: flex;
    gap: 8px;
    padding: 6px 4px;
    position: relative;
}
.audit-entry-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 3px;
}
.audit-entry-body {
    flex: 1;
    min-width: 0;
}
.audit-resolved {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 2px;
    color: #059669;
}

/* ── Sidebar Transition ── */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
    transition: width 0.25s ease, opacity 0.2s ease;
    overflow: hidden;
}
.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
    width: 0;
    opacity: 0;
}
.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
    width: 320px;
    opacity: 1;
}

/* ── Scrollbar ── */
.table-container::-webkit-scrollbar,
.audit-timeline-section::-webkit-scrollbar {
    width: 4px;
    height: 4px;
}
.table-container::-webkit-scrollbar-thumb,
.audit-timeline-section::-webkit-scrollbar-thumb {
    background: #d0d7de;
    border-radius: 4px;
}

/* ── Global Toast ── */
.global-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    white-space: nowrap;
    max-width: 90vw;
}
.global-toast--success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
}
.global-toast--error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
}
.global-toast--info {
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
}
.global-toast-close {
    background: none;
    border: none;
    cursor: pointer;
    margin-left: 12px;
    opacity: 0.6;
    padding: 2px;
}
.global-toast-close:hover {
    opacity: 1;
}
.toast-slide-enter-active,
.toast-slide-leave-active {
    transition: all 0.3s ease;
}
.toast-slide-enter-from,
.toast-slide-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(12px);
}
</style>
