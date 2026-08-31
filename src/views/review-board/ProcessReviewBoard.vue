<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, getCurrentInstance } from 'vue';
import { useRouter } from 'vue-router';
import { differenceInDays, formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale';
import BackendFactory from '@/components/api/BackendFactory';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { getResolvedRole, refreshAuthClaims } from '@/utils/authClaims';
import { toSafeText } from '@/utils/safeText';
import { formatIdentityWithTeam } from '@/utils/userIdentity';
import { todayKST, toKst } from '@/utils/datetime';
import { groupReviewItemsByProcess, type ReviewVersionGroup } from '@/utils/reviewVersionGrouping';
import {
    canApproveFieldReview,
    canApproveHQReview,
    canEndPublicFeedbackReview,
    canPublishReview,
    canRejectReview,
    isDesignatedOwner,
    isSelfReviewSubmission
} from '@/utils/reviewPermissions';
import { ROLES } from '@/utils/roles';
import {
    buildProcessHierarchyQuery,
    PROCESS_HIERARCHY_ENTRY,
    PROCESS_HIERARCHY_MODE,
    PROCESS_HIERARCHY_PANEL_STATE,
    PROCESS_HIERARCHY_RIGHT_TAB
} from '@/views/process-hierarchy/navigation';
import {
    collectHierarchyProcIds,
    collectModuleProcIds,
    deriveStatus,
    emptyStageCounts,
    getStageDef,
    mapStateToStage,
    STAGE_DEFS,
    type Stage
} from '@/utils/processStages';

const backend = BackendFactory.createBackend() as any;
const adminStore = useAdminConsoleStore();
const router = useRouter();
const instance = getCurrentInstance()!;
const t = (key: string) => instance.proxy!.$t(key);

const loading = ref(false);
const boardData = ref<any[]>([]);
const ownerNameMap = ref<Record<string, string>>({});
const metricsMap = ref<any>(null);
const procDomainMap = ref<Record<string, string>>({});

// 체계도 기준 단계별 카운트 (proc_def 테이블 기반) — pipelineSteps 헤더 카운터용
const stageCounts = ref<Record<Stage, number>>(emptyStageCounts());
const totalProcessCount = ref(0);
// 체계도 계층(getProcessDefinitionMap) 안에 등록된 proc_def id 집합 —
// 헤더 카운터와 동일한 기준으로 본 리스트도 필터링하기 위함
const hierarchyProcIds = ref<Set<string>>(new Set());
const currentUserId = ref('');
const currentUserName = ref('');
const currentUserEmployeeNo = ref('');
const currentUserRole = ref('viewer');

// Search & Filter state
const searchQuery = ref('');
const debouncedSearchQuery = ref('');
let _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (val) => {
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
        debouncedSearchQuery.value = val || '';
    }, 300);
});
const selectedDomains = ref<string[]>([]);
const selectedStatuses = ref<string[]>([]);

// 5단계 라벨·색은 공유 STAGE_DEFS 참조 (0~4단계 표기 통일)
const availableStatuses = [
    ...STAGE_DEFS.map((def) => ({ value: def.stage, label: def.label, color: def.vuetifyColor })),
    { value: 'rejected', label: '반려', color: 'error' },
    { value: 'reopen_requested', label: '재개요청', color: 'warning' }
];

function toggleDomain(domainName: string) {
    const idx = selectedDomains.value.indexOf(domainName);
    if (idx >= 0) {
        selectedDomains.value.splice(idx, 1);
    } else {
        selectedDomains.value.push(domainName);
    }
}

function toggleStatus(statusValue: string) {
    const idx = selectedStatuses.value.indexOf(statusValue);
    if (idx >= 0) {
        selectedStatuses.value.splice(idx, 1);
    } else {
        selectedStatuses.value.push(statusValue);
    }
}

function clearAllFilters() {
    searchQuery.value = '';
    debouncedSearchQuery.value = '';
    selectedDomains.value = [];
    selectedStatuses.value = [];
}

const hasActiveFilters = computed(() =>
    !!debouncedSearchQuery.value || selectedDomains.value.length > 0 || selectedStatuses.value.length > 0
);

const availableDomains = computed(() => {
    const domainSet = new Map<string, { id: string; name: string; color: string }>();
    const domains = metricsMap.value?.domains || [];
    for (const d of domains) {
        if (d.name || d.id) {
            domainSet.set(d.name || d.id, { id: d.id || d.name, name: d.name || d.id, color: d.color || '#0085db' });
        }
    }
    return Array.from(domainSet.values());
});

// Tab & table state
const activeTab = ref<'all' | 'inbox' | 'submissions'>('all');
const selectedRows = ref<Set<string>>(new Set());
const selectAll = ref(false);
const expandedInboxGroups = ref<Set<string>>(new Set());
const expandedSubmissionGroups = ref<Set<string>>(new Set());
const expandedAllGroups = ref<Set<string>>(new Set());

const reviewActor = computed(() => ({
    role: currentUserRole.value,
    userId: currentUserId.value,
    userName: currentUserName.value,
    employeeNo: currentUserEmployeeNo.value
}));

const canViewAllTab = computed(() => String(currentUserRole.value || '').toLowerCase() !== ROLES.EDITOR);

const enrichedData = computed(() => {
    const domains = metricsMap.value?.domains || [];
    const hierarchySet = hierarchyProcIds.value;
    // 체계도 계층에 등록된 proc_def 만 포함 (헤더 카운터와 동일 기준).
    // hierarchySet 이 비어있으면(미로드 상태) 필터 없이 통과시켜 보드가 깜빡이지 않게 함.
    return boardData.value
        .filter((item) => hierarchySet.size === 0 || hierarchySet.has(item.proc_def_id))
        .map((item) => {
            const domainId = item.domain_id || procDomainMap.value[item.proc_def_id] || '';
            const domain = domainId ? domains.find((d: any) => d.id === domainId) : null;
            return {
                ...item,
                domain_id: domainId,
                domain_name: domain?.name || domainId || '',
                domain_color: domain?.color || '#0085db'
            };
        });
});

function ownerMatchesQuery(owner: string, query: string) {
    const ownerValue = toSafeText(owner).toLowerCase();
    const ownerLabel = resolvedOwnerLabel(owner).toLowerCase();
    return ownerValue.includes(query) || ownerLabel.includes(query);
}

const filteredData = computed(() => {
    let data = enrichedData.value;
    const query = debouncedSearchQuery.value.toLowerCase().trim();
    if (query) {
        data = data.filter(
            (item) =>
                (item.process_name || '').toLowerCase().includes(query) ||
                (item.proc_def_id || '').toLowerCase().includes(query) ||
                resolvedAuthorLabel(item).toLowerCase().includes(query) ||
                (item.domain_name || '').toLowerCase().includes(query) ||
                (item.pi_owners || []).some((o: string) => ownerMatchesQuery(o, query)) ||
                (item.hq_owners || []).some((o: string) => ownerMatchesQuery(o, query)) ||
                (item.field_owners || []).some((o: string) => ownerMatchesQuery(o, query)) ||
                ownerMatchesQuery(item.master_owner || '', query)
        );
    }
    if (selectedDomains.value.length > 0) {
        data = data.filter((item) => selectedDomains.value.includes(item.domain_name || item.domain_id || ''));
    }
    if (selectedStatuses.value.length > 0) {
        data = data.filter((item) => selectedStatuses.value.includes(item.state));
    }
    return data;
});

// Step flow stats (현재 탭 기준, Pipeline 수치 = 그리드 데이터 동기화)
const draftItems = computed(() => pipelineSourceData.value.filter((i) => i.state === 'draft'));
const reviewItems = computed(() => pipelineSourceData.value.filter((i) => i.state === 'in_review' || i.state === 'review'));
const fieldReviewCompletedCount = computed(() => reviewItems.value.filter((i) => i.field_status === 'approved').length);
const hqReviewCompletedCount = computed(() => reviewItems.value.filter((i) => i.hq_status === 'approved').length);
const publicFeedbackItems = computed(() => pipelineSourceData.value.filter((i) => i.state === 'public_feedback'));
const finalEditItems = computed(() => pipelineSourceData.value.filter((i) => i.state === 'final_edit'));
const publishedItems = computed(() => pipelineSourceData.value.filter((i) => i.state === 'published' || i.state === 'confirmed'));
const reopenItems = computed(() => pipelineSourceData.value.filter((i) => i.state === 'reopen_requested'));
const archivedItems = computed(() => pipelineSourceData.value.filter((i) => i.state === 'archived'));

// Tab-filtered items (각 탭별로 filteredData에서 필터링)
const allTabItems = computed(() => filteredData.value);

// 본사 + 현업 단계에서 사용하던 inbox 필터 — admin 우회 제거 정책으로 owners 매핑 strict 변경
// const inboxItemsAll = computed(() =>
//     filteredData.value.filter((i) => {
//         return (
//             (['in_review', 'review', 'public_feedback', 'final_edit'].includes(i.state) && canAccessApprovalInbox(i, reviewActor.value)) ||
//             (i.state === 'reopen_requested' && canManageReopenRequest(i, currentUserRole.value))
//         );
//     })
// );
const inboxItemsAll = computed(() =>
    filteredData.value.filter((i) => {
        // 본인이 검토 요청한 항목은 결재함에서 제외 (자기 결재 금지)
        if (isSelfReviewSubmission(i, reviewActor.value)) return false;

        // 본인이 검토담당자(hq_owners) 또는 현업담당자(field_owners) 에 매핑되었는지 strict 체크
        // (admin/owner 권한자라도 매핑 안 되어 있으면 결재함에 안 노출 — 전체 탭에서 확인)
        const isMappedOwner =
            isDesignatedOwner(i.hq_owners, reviewActor.value, { adminBypass: false }) ||
            isDesignatedOwner(i.field_owners, reviewActor.value, { adminBypass: false });
        if (!isMappedOwner) return false;

        const state = String(i.state || '');
        // 검토 단계: 현업 결재 pending (본사는 자동 통과)
        if (['in_review', 'review'].includes(state)) {
            return (i.field_status || 'pending') === 'pending';
        }
        // 최종수정 단계: 미해결 피드백 0 건
        if (state === 'final_edit') {
            return Number(i.unresolved_count || 0) === 0;
        }
        // 재작성 요청 단계
        if (state === 'reopen_requested') {
            return true;
        }
        return false;
    })
);
const mySubmissionsAll = computed(() =>
    filteredData.value.filter((i) => i.is_my_submission ?? isSelfReviewSubmission(i, reviewActor.value))
);
const allGroups = computed(() => sortReviewGroupsByDisplayTime(groupReviewItemsByProcess(allTabItems.value)));
const inboxGroups = computed(() => sortReviewGroupsByDisplayTime(groupReviewItemsByProcess(inboxItemsAll.value)));
const submissionGroups = computed(() => sortReviewGroupsByDisplayTime(groupReviewItemsByProcess(mySubmissionsAll.value)));

function getReviewDisplayTime(item: any): number {
    const value = item?.created_at || item?.updated_at || item?.submitted_at;
    const parsed = value ? new Date(value).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
}

function sortReviewGroupsByDisplayTime(groups: ReviewVersionGroup<any>[]): ReviewVersionGroup<any>[] {
    return [...groups].sort((a, b) => getReviewDisplayTime(b.latest) - getReviewDisplayTime(a.latest));
}

function flattenReviewGroups(groups: ReviewVersionGroup<any>[], expandedKeys: Set<string>): any[] {
    return groups.flatMap((group) => (expandedKeys.has(group.key) ? group.items : [group.latest]));
}

const allItems = computed(() => flattenReviewGroups(allGroups.value, expandedAllGroups.value));
const inboxItems = computed(() => flattenReviewGroups(inboxGroups.value, expandedInboxGroups.value));
const mySubmissions = computed(() => flattenReviewGroups(submissionGroups.value, expandedSubmissionGroups.value));

// 현재 탭의 그룹 데이터 (Pipeline 수치 + 그리드 동기화용)
const activeTabGroups = computed(() => {
    if (activeTab.value === 'all') return allGroups.value;
    if (activeTab.value === 'inbox') return inboxGroups.value;
    if (activeTab.value === 'submissions') return submissionGroups.value;
    return [];
});

const activeTabItems = computed(() => {
    if (activeTab.value === 'all') return allItems.value;
    if (activeTab.value === 'inbox') return inboxItems.value;
    if (activeTab.value === 'submissions') return mySubmissions.value;
    return [];
});

// Pipeline 수치를 현재 탭의 그리드 데이터와 동기화
const pipelineSourceData = computed(() => {
    if (activeTab.value === 'all') return allTabItems.value;
    if (activeTab.value === 'inbox') return inboxItemsAll.value;
    if (activeTab.value === 'submissions') return mySubmissionsAll.value;
    return filteredData.value;
});

const selectedReviewItems = computed(() => activeTabItems.value.filter((item) => selectedRows.value.has(reviewRowId(item))));
const bulkApproveTargets = computed(() =>
    selectedReviewItems.value.filter(
        (item) => canApproveHQReview(item, reviewActor.value) || canApproveFieldReview(item, reviewActor.value)
    )
);
const bulkRejectTargets = computed(() => selectedReviewItems.value.filter((item) => canRejectReview(item, reviewActor.value)));
const bulkPublishTargets = computed(() =>
    selectedReviewItems.value.filter((item) => canPublishReview(item, reviewActor.value) && Number(item.unresolved_count || 0) === 0)
);

// 2단계 기간 관리 대상 — 단건 선택 + 2단계 상태 + 담당자 권한일 때만 활성
// admin 권한자는 본인 발의 2단계도 조절 가능 (bypassSelfCheckIfAdmin: true)
const adminPublicFeedbackTarget = computed(() => {
    if (selectedReviewItems.value.length !== 1) return null;
    const item = selectedReviewItems.value[0];
    if (!canEndPublicFeedbackReview(item, reviewActor.value, { bypassSelfCheckIfAdmin: true })) return null;
    return item;
});

// Critical alert counts (현재 탭 기준)
const publicFeedbackUrgentCount = computed(() => {
    const now = new Date();
    return pipelineSourceData.value.filter((item) => {
        if (item.state !== 'public_feedback' || !item.public_feedback_ends_at) return false;
        const daysLeft = differenceInDays(new Date(item.public_feedback_ends_at), now);
        return daysLeft <= 7 && daysLeft >= 0;
    }).length;
});

const stalledCount = computed(() => {
    const now = new Date();
    return pipelineSourceData.value.filter((item) => {
        if (['published', 'confirmed', 'cancelled', 'archived'].includes(item.state)) return false;
        if (!item.updated_at) return false;
        return differenceInDays(now, new Date(item.updated_at)) >= 7;
    }).length;
});

// Critical alerts
const urgentItems = computed(() => {
    const now = new Date();
    return pipelineSourceData.value.filter((item) => {
        if (['published', 'confirmed', 'cancelled', 'archived'].includes(item.state)) return false;
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

// Kanban columns — 색·아이콘·라벨 모두 공유 STAGE_DEFS 참조
const kanbanColumns = computed(() => {
    const stageItems: Record<Stage, any[]> = {
        draft: draftItems.value,
        in_review: reviewItems.value,
        public_feedback: publicFeedbackItems.value,
        final_edit: finalEditItems.value,
        published: publishedItems.value
    };
    return STAGE_DEFS.map((def) => ({
        key: def.stage,
        label: def.label,
        color: def.color,
        chipColor: def.vuetifyColor,
        icon: def.icon,
        items: stageItems[def.stage]
    }));
});

// Step flow pipeline steps (체계도 기준 5단계 — proc_def 테이블 기반 카운트)
const pipelineSteps = computed(() =>
    STAGE_DEFS.map((def) => ({
        label: def.label,
        count: stageCounts.value[def.stage] || 0,
        color: def.color,
        active: (stageCounts.value[def.stage] || 0) > 0,
        unit: '건'
    }))
);

function reviewRowId(item: any): string {
    return toSafeText(item?.review_id || item?.proc_def_id).trim();
}

function getExpandedGroupState(tab: 'all' | 'inbox' | 'submissions') {
    if (tab === 'all') return expandedAllGroups;
    if (tab === 'inbox') return expandedInboxGroups;
    return expandedSubmissionGroups;
}

function pruneExpandedGroups(source: typeof expandedInboxGroups, groups: ReviewVersionGroup<any>[]) {
    const validKeys = new Set(groups.map((group) => group.key));
    source.value = new Set(Array.from(source.value).filter((key) => validKeys.has(key)));
}

function isVersionGroupExpanded(tab: 'all' | 'inbox' | 'submissions', groupKey: string): boolean {
    return getExpandedGroupState(tab).value.has(groupKey);
}

function toggleVersionGroup(tab: 'all' | 'inbox' | 'submissions', groupKey: string) {
    const target = getExpandedGroupState(tab);
    const next = new Set(target.value);
    if (next.has(groupKey)) {
        next.delete(groupKey);
    } else {
        next.add(groupKey);
    }
    target.value = next;
}

function getExpandedHistoryItems(tab: 'all' | 'inbox' | 'submissions', group: ReviewVersionGroup<any>): any[] {
    return isVersionGroupExpanded(tab, group.key) ? group.previousVersions : [];
}

function getVersionText(item: any): string {
    const versionLabel = toSafeText(item?.version_label).trim();
    if (versionLabel) return versionLabel;
    const version = toSafeText(item?.version).trim();
    return version ? `v${version}` : '';
}

function getVersionToggleLabel(group: ReviewVersionGroup<any>, expanded: boolean): string {
    return expanded ? '이전 버전 접기' : `이전 버전 ${group.previousVersions.length}개 보기`;
}

function openInEditor(item: any) {
    const procDefId = toSafeText(item?.proc_def_id).trim();
    if (!procDefId) return;

    const state = toSafeText(item?.state).trim();
    const mode = ['draft', 'rejected'].includes(state) ? PROCESS_HIERARCHY_MODE.EDIT : PROCESS_HIERARCHY_MODE.VIEW;
    router.push({
        name: 'Process Hierarchy',
        query: buildProcessHierarchyQuery({
            id: procDefId,
            name: toSafeText(item?.process_name).trim() || procDefId,
            entry: PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD,
            mode,
            left: PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED,
            right: PROCESS_HIERARCHY_PANEL_STATE.OPEN,
            rightTab: PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE,
            reviewId: toSafeText(item?.review_id || item?.id).trim()
        })
    });
}

function getReviewStatusLabel(status: string): string {
    switch (status) {
        case 'approved':
            return '승인';
        case 'rejected':
            return '반려';
        default:
            return '대기';
    }
}

function getStateLabel(state: string): string {
    const map: Record<string, string> = {
        draft: t('reviewBoard.draft'),
        review: t('reviewBoard.review'),
        in_review: t('reviewBoard.review'),
        public_feedback: t('reviewBoard.publicFeedback'),
        final_edit: t('reviewBoard.finalEdit'),
        confirmed: t('reviewBoard.published'),
        published: t('reviewBoard.published'),
        reopen_requested: '재개 요청',
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
        reopen_requested: 'warning',
        rejected: 'error',
        cancelled: 'grey'
    };
    return map[state] || 'grey';
}

function getPublicFeedbackRemainingLabel(item: any): string {
    if (!item || item.state !== 'public_feedback' || !item.public_feedback_ends_at) return '';
    const daysLeft = differenceInDays(new Date(item.public_feedback_ends_at), new Date());
    if (daysLeft < 0) return '만료';
    if (daysLeft === 0) return '오늘 종료';
    return `${daysLeft}일 남음`;
}

function getStateChipLabel(item: any): string {
    const stage = mapStateToStage(item?.state);
    // 5단계 외 상태(rejected, cancelled, archived 등) 는 기존 라벨 fallback
    const base = stage === 'none' ? getStateLabel(item?.state || '') : getStageDef(stage as Stage).label;
    const remaining = getPublicFeedbackRemainingLabel(item);
    return remaining ? `${base} · ${remaining}` : base;
}

function getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
        return formatDistanceToNowStrict(toKst(dateStr)?.toDate() ?? new Date(dateStr), { addSuffix: true, locale: ko });
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

function toggleRow(id: unknown) {
    const rowId = toSafeText(id).trim();
    if (!rowId) return;
    const newSet = new Set(selectedRows.value);
    if (newSet.has(rowId)) {
        newSet.delete(rowId);
    } else {
        newSet.add(rowId);
    }
    selectedRows.value = newSet;
    selectAll.value = newSet.size === activeTabItems.value.length && newSet.size > 0;
}

function toggleSelectAll(val: boolean | null) {
    if (val) {
        selectedRows.value = new Set(activeTabItems.value.map((item) => reviewRowId(item)).filter(Boolean));
    } else {
        selectedRows.value = new Set();
    }
}

async function handleBulkApprove() {
    const items = bulkApproveTargets.value;
    if (items.length === 0) {
        showGlobalToast('현재 역할로 승인할 수 있는 항목이 없습니다.', 'info');
        return;
    }

    const confirmed = window.confirm(`선택된 ${items.length}건에 대해 현재 역할로 가능한 승인 단계를 일괄 처리하시겠습니까?`);
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
        try {
            const reviewId = item.review_id || item.id || item.proc_def_id;
            let handled = false;
            if (canApproveHQReview(item, reviewActor.value)) {
                await backend.approveHQ(reviewId, '일괄 승인');
                handled = true;
            }
            if (canApproveFieldReview(item, reviewActor.value)) {
                await backend.approveField(reviewId, '일괄 승인');
                handled = true;
            }
            if (handled) {
                successCount++;
            }
        } catch (e) {
            console.error(`[ReviewBoard] Bulk approve failed for ${item.review_id || item.id || item.proc_def_id}:`, e);
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
    const items = bulkRejectTargets.value;
    if (items.length === 0) {
        showGlobalToast('현재 역할로 반려할 수 있는 항목이 없습니다.', 'info');
        return;
    }

    const reason = window.prompt(`선택된 ${items.length}건을 일괄 반려합니다.\n반려 사유를 입력하세요 (필수):`);
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
        showGlobalToast('반려 사유를 입력해야 합니다.', 'error');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
        try {
            const reviewId = item.review_id || item.id || item.proc_def_id;
            await backend.rejectDefinition(reviewId, reason.trim());
            successCount++;
        } catch (e) {
            console.error(`[ReviewBoard] Bulk reject failed for ${item.review_id || item.id || item.proc_def_id}:`, e);
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
    const items = bulkPublishTargets.value;
    if (items.length === 0) {
        showGlobalToast('현재 역할로 배포할 수 있는 항목이 없거나 미해결 피드백이 남아 있습니다.', 'info');
        return;
    }

    const confirmed = window.confirm(`선택된 ${items.length}건을 최종 배포하시겠습니까?\n배포 후에는 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
        try {
            const reviewId = item.review_id || item.id || item.proc_def_id;
            await backend.publishDefinition(reviewId, '일괄 배포');
            successCount++;
        } catch (e) {
            console.error(`[ReviewBoard] Bulk publish failed for ${item.review_id || item.id || item.proc_def_id}:`, e);
            errorCount++;
        }
    }

    selectedRows.value = new Set();
    selectAll.value = false;

    if (errorCount === 0) {
        showGlobalToast(`${successCount}건 배포완료되었습니다.`, 'success');
    } else {
        showGlobalToast(`${successCount}건 배포완료, ${errorCount}건 실패.`, 'error');
    }

    await loadData();
}

// ── 2단계 기간 관리 (admin 전용, 단건 한정) ──
const adjustPublicFeedbackDialog = ref(false);
const adjustPublicFeedbackNewDate = ref<string>(''); // YYYY-MM-DD
const adjustPublicFeedbackReason = ref('');
const adjustPublicFeedbackLoading = ref(false);

const endPublicFeedbackDialog = ref(false);
const endPublicFeedbackReason = ref('');
const endPublicFeedbackLoading = ref(false);

// 종료일 선택 가능 최소값 = 오늘 (과거는 즉시 종료 버튼으로 처리)
const adjustPublicFeedbackMinDate = computed(() => todayKST());

function openAdjustPublicFeedbackDialog() {
    if (!adminPublicFeedbackTarget.value) return;
    adjustPublicFeedbackNewDate.value = '';
    adjustPublicFeedbackReason.value = '';
    adjustPublicFeedbackDialog.value = true;
}

async function confirmAdjustPublicFeedback() {
    const target = adminPublicFeedbackTarget.value;
    if (!target) return;
    if (!adjustPublicFeedbackNewDate.value) {
        showGlobalToast('새 종료일을 선택하세요.', 'error');
        return;
    }
    if (!adjustPublicFeedbackReason.value.trim()) {
        showGlobalToast('사유를 입력하세요.', 'error');
        return;
    }
    const newEndsAtIso = new Date(`${adjustPublicFeedbackNewDate.value}T23:59:59`).toISOString();
    const reason = adjustPublicFeedbackReason.value.trim();
    const reviewId = target.review_id || target.id;

    adjustPublicFeedbackLoading.value = true;
    try {
        await backend.adjustPublicFeedbackPeriod(reviewId, newEndsAtIso, reason);
        await adminStore.writeAdminAuditLog({
            action: 'admin_adjust_public_feedback_period',
            target_type: 'public_feedback_review',
            target_id: target.proc_def_id || reviewId,
            target_name: target.process_name || target.proc_def_id || reviewId,
            before_value: { public_feedback_ends_at: target.public_feedback_ends_at || null, review_id: reviewId },
            after_value: { public_feedback_ends_at: newEndsAtIso, review_id: reviewId },
            comment: reason
        });
        showGlobalToast('2단계 종료일을 변경했습니다.', 'success');
        adjustPublicFeedbackDialog.value = false;
        selectedRows.value = new Set();
        selectAll.value = false;
        await loadData();
    } catch (e) {
        console.error(`[ReviewBoard] adjustPublicFeedbackPeriod failed for ${reviewId}:`, e);
        showGlobalToast('2단계 종료일 변경에 실패했습니다.', 'error');
    } finally {
        adjustPublicFeedbackLoading.value = false;
    }
}

function openEndPublicFeedbackDialog() {
    if (!adminPublicFeedbackTarget.value) return;
    endPublicFeedbackReason.value = '';
    endPublicFeedbackDialog.value = true;
}

async function confirmEndPublicFeedback() {
    const target = adminPublicFeedbackTarget.value;
    if (!target) return;
    if (!endPublicFeedbackReason.value.trim()) {
        showGlobalToast('사유를 입력하세요.', 'error');
        return;
    }
    const reason = endPublicFeedbackReason.value.trim();
    const reviewId = target.review_id || target.id;

    endPublicFeedbackLoading.value = true;
    try {
        await backend.adminEndPublicFeedback(reviewId, reason);
        await adminStore.writeAdminAuditLog({
            action: 'admin_end_public_feedback',
            target_type: 'public_feedback_review',
            target_id: target.proc_def_id || reviewId,
            target_name: target.process_name || target.proc_def_id || reviewId,
            before_value: { state: 'public_feedback', public_feedback_ends_at: target.public_feedback_ends_at || null, review_id: reviewId },
            after_value: { state: 'final_edit', public_feedback_ends_at: new Date().toISOString(), review_id: reviewId },
            comment: reason
        });
        showGlobalToast('2단계를 즉시 종료했습니다.', 'success');
        endPublicFeedbackDialog.value = false;
        selectedRows.value = new Set();
        selectAll.value = false;
        await loadData();
    } catch (e) {
        console.error(`[ReviewBoard] adminEndPublicFeedback failed for ${reviewId}:`, e);
        showGlobalToast('2단계 종료에 실패했습니다.', 'error');
    } finally {
        endPublicFeedbackLoading.value = false;
    }
}

function buildProcDomainMap(procMap: any): Record<string, string> {
    const map: Record<string, string> = {};
    for (const mega of procMap?.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            const domainId = major.domain || major.domain_id || '';
            if (domainId) {
                map[major.id] = domainId;
                for (const sub of major.sub_proc_list || major.proc_def_list || []) {
                    map[sub.id] = domainId;
                }
            }
        }
    }
    return map;
}

async function loadData() {
    loading.value = true;
    try {
        await loadCurrentUser();
        const [data, metrics, procMapData] = await Promise.all([
            backend.getReviewBoardData(),
            backend.getMetricsMap(),
            backend.getProcessDefinitionMap({ skipPermissionFilter: true }),
            loadStageCountsFromHierarchy()
        ]);
        boardData.value = data || [];
        metricsMap.value = metrics;
        procDomainMap.value = buildProcDomainMap(procMapData);
        await resolveOwnerNames();
    } catch (e) {
        console.error('Failed to load review board:', e);
    } finally {
        loading.value = false;
    }
}

// 체계도(useProcessArchitecture.stats) 와 동일한 기준으로 카운트.
// proc_def 전체가 아니라 체계도 계층(getProcessDefinitionMap) 에 등록된 sub_proc 만 카운트.
async function loadStageCountsFromHierarchy() {
    const supabase = (window as any).$supabase;
    try {
        const [defs, procMap]: [any[], any] = await Promise.all([
            backend.listDefinitionStatusLite('', { match: { isdeleted: false } }),
            backend.getProcessDefinitionMap({ skipPermissionFilter: true })
        ]);
        if (!Array.isArray(defs)) return;

        // 체계도 계층의 sub_proc id 집합 — 공유 utils 사용 (대시보드/체계도와 동일 모집단)
        const visibleSubIds = collectHierarchyProcIds(procMap);
        // 체계도에 등록되지 않는 "프로세스 모듈"(call-activity-sub)은 카운트/노출 모집단에서 제외.
        // (모집단이 곧 hierarchyProcIds → 파이프라인 카운트와 그리드/탭 카운트 모두에 반영됨)
        for (const id of collectModuleProcIds(defs)) visibleSubIds.delete(id);

        const approvalStateMap = new Map<string, any>();
        const latestVersionMap = new Map<string, any>();
        if (supabase) {
            try {
                const { data: approvalStates } = await supabase
                    .from('proc_def_approval_state')
                    .select('proc_def_id, state, created_at')
                    .eq('tenant_id', (window as any).$tenantName)
                    .order('created_at', { ascending: false });
                if (approvalStates) {
                    for (const row of approvalStates) {
                        if (!approvalStateMap.has(row.proc_def_id)) approvalStateMap.set(row.proc_def_id, row);
                    }
                }
            } catch (e) {
                console.warn('approval states load failed:', e);
            }
            try {
                const { data: versionRows } = await supabase
                    .from('proc_def_version')
                    .select('proc_def_id, version_tag, timeStamp')
                    .eq('tenant_id', (window as any).$tenantName)
                    .order('timeStamp', { ascending: false });
                if (versionRows) {
                    for (const row of versionRows) {
                        if (row?.proc_def_id && !latestVersionMap.has(row.proc_def_id)) {
                            latestVersionMap.set(row.proc_def_id, row);
                        }
                    }
                }
            } catch (e) {
                console.warn('versions load failed:', e);
            }
        }

        const counts = emptyStageCounts();
        for (const def of defs) {
            // 체계도 계층에 안 들어간 proc_def 는 카운트 제외
            if (!visibleSubIds.has(def.id)) continue;
            const approval = approvalStateMap.get(def.id);
            const versionRow = latestVersionMap.get(def.id);
            const status = deriveStatus({
                approvalStateName: approval?.state,
                directStatus: def.approval_state || def.status,
                versionTag: versionRow?.version_tag,
                hasVersion: latestVersionMap.has(def.id)
            });
            if (status !== 'none' && status !== 'wip' && status !== 'sunset') counts[status]++;
        }
        stageCounts.value = counts;
        totalProcessCount.value = visibleSubIds.size;
        hierarchyProcIds.value = visibleSubIds;
    } catch (e) {
        console.error('loadStageCountsFromHierarchy error:', e);
    }
}

async function resolveOwnerNames() {
    const allOwners: string[] = [];
    const pushIdentity = (value: unknown) => {
        const normalized = toSafeText(value).trim();
        if (normalized) allOwners.push(normalized);
    };

    for (const row of boardData.value) {
        if (Array.isArray(row?.pi_owners)) row.pi_owners.forEach(pushIdentity);
        if (Array.isArray(row?.hq_owners)) row.hq_owners.forEach(pushIdentity);
        if (Array.isArray(row?.field_owners)) row.field_owners.forEach(pushIdentity);
        pushIdentity(row?.master_owner);
        pushIdentity(row?.submitted_by_id);
        pushIdentity(row?.submitted_by);
        pushIdentity(row?.owner);
        pushIdentity(row?.assigned_reviewer_id);
        pushIdentity(row?.assigned_reviewer_name);
    }
    const unique = [...new Set(allOwners)];
    if (unique.length === 0) {
        ownerNameMap.value = {};
        return;
    }

    // 통합 lookup — users 테이블 batch 조회 + SSO API fallback 까지 한 번에 처리
    try {
        const identityMap = await backend.resolveUserIdentities(unique);
        const map: Record<string, string> = {};
        unique.forEach((id) => {
            const identity = identityMap[id];
            if (identity) {
                map[id] = formatIdentityWithTeam(identity, id);
            }
        });
        ownerNameMap.value = map;
    } catch (e) {
        console.warn('[ProcessReviewBoard] resolveOwnerNames failed:', e);
        ownerNameMap.value = {};
    }
}

function resolvedOwnerLabel(value: string) {
    const key = toSafeText(value).trim();
    return ownerNameMap.value[key] || key;
}

function resolvedUserLabel(...values: unknown[]) {
    for (const value of values) {
        const key = toSafeText(value).trim();
        if (key && ownerNameMap.value[key]) return ownerNameMap.value[key];
    }
    for (const value of values) {
        const key = toSafeText(value).trim();
        if (key) return key;
    }
    return '';
}

function resolvedAuthorLabel(item: any) {
    // 기안자 컬럼에서 사용하던 표시 기준 — PI팀 담당자 컬럼으로 변경되어 담당자 설정값(pi_owners)을 우선 표시
    // const mapped = [item?.submitted_by_id, item?.submitted_by, item?.owner]
    //     .map((value) => toSafeText(value).trim())
    //     .find((key) => key && ownerNameMap.value[key]);
    // if (mapped) return ownerNameMap.value[mapped];
    // return resolvedUserLabel(item?.submitted_by, item?.owner) || 'Unknown';
    const piOwner = Array.isArray(item?.pi_owners) ? item.pi_owners[0] : item?.pi_owners;
    return resolvedOwnerLabel(piOwner || item?.owner || '') || 'Unknown';
}

async function loadCurrentUser() {
    const supabase = (window as any).$supabase;
    if (!supabase) return;

    try {
        await refreshAuthClaims();
        currentUserRole.value = getResolvedRole();
        currentUserId.value = localStorage.getItem('uid') || currentUserId.value;
        currentUserName.value =
            localStorage.getItem('userName') || localStorage.getItem('email') || (window as any).$userName || currentUserName.value;
        currentUserEmployeeNo.value = localStorage.getItem('employeeNo') || currentUserEmployeeNo.value;

        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) return;

        currentUserId.value = user.id || '';
        const { data: userData } = await supabase
            .from('users')
            .select('username, email, role, employee_no')
            .eq('id', user.id)
            .limit(1)
            .maybeSingle();

        currentUserName.value = userData?.username || userData?.email || user.email || '';
        currentUserEmployeeNo.value = userData?.employee_no || currentUserEmployeeNo.value;
        currentUserRole.value = userData?.role || currentUserRole.value;
    } catch (e) {
        console.warn('[ReviewBoard] 현재 사용자 조회 실패:', e);
    }
}

watch(activeTab, () => {
    selectedRows.value = new Set();
    selectAll.value = false;
});

watch(
    canViewAllTab,
    (visible) => {
        if (!visible && activeTab.value === 'all') {
            activeTab.value = 'inbox';
        }
    },
    { immediate: true }
);

watch(
    allGroups,
    (groups) => {
        pruneExpandedGroups(expandedAllGroups, groups);
    },
    { immediate: true }
);

watch(
    inboxGroups,
    (groups) => {
        pruneExpandedGroups(expandedInboxGroups, groups);
    },
    { immediate: true }
);

watch(
    submissionGroups,
    (groups) => {
        pruneExpandedGroups(expandedSubmissionGroups, groups);
    },
    { immediate: true }
);

watch(
    activeTabItems,
    (items) => {
        const visibleIds = new Set(items.map((item) => reviewRowId(item)).filter(Boolean));
        selectedRows.value = new Set(Array.from(selectedRows.value).filter((id) => visibleIds.has(id)));
        selectAll.value = items.length > 0 && selectedRows.value.size === items.length;
    },
    { immediate: true }
);

// ── Realtime: 상태 변경 시 Toast + 자동 갱신 ──
let realtimeChannel: any = null;

// App.vue 공통 v-snackbar 사용 (window.$app_)
function showGlobalToast(message: string, color = 'success') {
    const app = (window as any).$app_;
    if (!app) return;
    app.snackbarMessage = message;
    app.snackbarColor = color;
    app.snackbar = true;
}

const stateMessages: Record<string, (name: string) => string> = {
    public_feedback: (n) => `"${n}" 전문가 검토 완료. 30일 2단계 기간이 시작되었습니다.`,
    final_edit: (n) => `"${n}" 2단계 종료. 최종수정 단계로 이동했습니다.`,
    published: (n) => `"${n}" 프로세스가 배포완료되었습니다.`,
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
                    <h1 class="page-title">프로세스 리뷰보드</h1>
                    <p class="page-subtitle">프로세스 거버넌스 라이프사이클 관리</p>
                </div>
                <div class="page-header-right">
                    <!-- <v-btn variant="outlined" color="primary" size="small" class="mr-2" @click="router.push('/review-board-debug')">
                    Submission Debug
                </v-btn> -->
                    <!-- Critical Alerts (inline) -->
                    <div v-if="urgentItems.length > 0" class="critical-alerts-inline" @click="activeTab = 'inbox'">
                        <v-icon size="13" color="error">mdi-alert-circle</v-icon>
                        <span class="critical-alerts-label">ALERT</span>
                        <v-chip size="x-small" color="error" variant="flat">
                            <v-icon start size="10">mdi-clock-alert-outline</v-icon>
                            {{ getStageDef('public_feedback').label }} 임박 {{ publicFeedbackUrgentCount }}
                        </v-chip>
                        <v-chip size="x-small" color="error" variant="flat">
                            <v-icon start size="10">mdi-timer-sand</v-icon>
                            지연 {{ stalledCount }}
                        </v-chip>
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
                            {{ step.count }}<small v-if="step.unit">{{ step.unit }}</small>
                        </span>
                    </div>
                    <div v-if="idx < pipelineSteps.length - 1" class="pipeline-bar-connector">
                        <div class="pipeline-bar-line" :style="{ background: step.active ? step.color : '#e2e8f0' }"></div>
                        <v-icon size="12" color="grey-lighten-1" class="pipeline-chevron">mdi-chevron-right</v-icon>
                    </div>
                </template>
            </div>

            <!-- Search & Filters -->
            <div class="search-filter-bar">
                <div class="search-filter-left">
                    <v-text-field
                        v-model="searchQuery"
                        placeholder="프로세스명, ID, 담당자 검색..."
                        prepend-inner-icon="mdi-magnify"
                        variant="outlined"
                        density="compact"
                        hide-details
                        clearable
                        style="max-width: 320px; min-width: 200px"
                    />
                    <!-- Domain Filter Chips -->
                    <div class="domain-filter-chips">
                        <v-chip
                            :color="selectedDomains.length === 0 ? 'primary' : undefined"
                            :variant="selectedDomains.length === 0 ? 'flat' : 'outlined'"
                            size="small"
                            @click="selectedDomains = []"
                        >
                            전체
                        </v-chip>
                        <v-chip
                            v-for="domain in availableDomains"
                            :key="domain.id"
                            :color="selectedDomains.includes(domain.name) ? (domain.color || 'primary') : undefined"
                            :variant="selectedDomains.includes(domain.name) ? 'flat' : 'outlined'"
                            size="small"
                            @click="toggleDomain(domain.name)"
                        >
                            {{ domain.name }}
                        </v-chip>
                    </div>
                    <!-- Status Filter Chips -->
                    <div class="status-filter-chips">
                        <v-chip
                            v-for="status in availableStatuses"
                            :key="status.value"
                            :color="selectedStatuses.includes(status.value) ? status.color : undefined"
                            :variant="selectedStatuses.includes(status.value) ? 'flat' : 'outlined'"
                            size="small"
                            @click="toggleStatus(status.value)"
                        >
                            {{ status.label }}
                        </v-chip>
                    </div>
                </div>
                <div class="search-filter-right">
                    <v-btn
                        v-if="hasActiveFilters"
                        variant="text"
                        size="small"
                        prepend-icon="mdi-filter-remove"
                        @click="clearAllFilters"
                    >
                        필터 초기화
                    </v-btn>
                </div>
            </div>

            <!-- Tab Filters -->
            <div class="tab-filters">
                <button
                    v-if="canViewAllTab"
                    class="tab-filter-btn"
                    :class="{ 'tab-filter-btn--active': activeTab === 'all' }"
                    @click="activeTab = 'all'"
                >
                    <v-icon size="15" class="tab-filter-icon">mdi-view-list-outline</v-icon>
                    전체
                    <v-chip
                        size="x-small"
                        :color="activeTab === 'all' ? 'primary' : 'grey'"
                        :variant="activeTab === 'all' ? 'flat' : 'tonal'"
                        class="ml-2"
                    >
                        {{ allGroups.length }}
                    </v-chip>
                </button>
                <button class="tab-filter-btn" :class="{ 'tab-filter-btn--active': activeTab === 'inbox' }" @click="activeTab = 'inbox'">
                    <v-icon size="15" class="tab-filter-icon">mdi-inbox-arrow-down</v-icon>
                    내 승인함
                    <v-chip
                        size="x-small"
                        :color="activeTab === 'inbox' ? 'primary' : 'grey'"
                        :variant="activeTab === 'inbox' ? 'flat' : 'tonal'"
                        class="ml-2"
                    >
                        {{ inboxGroups.length }}
                    </v-chip>
                </button>
                <button
                    class="tab-filter-btn"
                    :class="{ 'tab-filter-btn--active': activeTab === 'submissions' }"
                    @click="activeTab = 'submissions'"
                >
                    <v-icon size="15" class="tab-filter-icon">mdi-file-send-outline</v-icon>
                    내 발의함
                    <v-chip
                        size="x-small"
                        :color="activeTab === 'submissions' ? 'primary' : 'grey'"
                        :variant="activeTab === 'submissions' ? 'flat' : 'tonal'"
                        class="ml-2"
                    >
                        {{ submissionGroups.length }}
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
                                        <v-checkbox
                                            v-model="selectAll"
                                            hide-details
                                            density="compact"
                                            @update:model-value="toggleSelectAll"
                                        />
                                    </th>
                                    <th class="th-process">프로세스</th>
                                    <th class="th-author">PI팀 담당자</th>
                                    <th class="th-hq-owners">검토담당자</th>
                                    <th class="th-field-owners">현업담당자</th>
                                    <th class="th-domain">도메인</th>
                                    <!-- 본사 + 현업 단계에서 사용하던 검토 상태 컬럼 — 본사 제거로 상태 컬럼과 중복되어 주석 처리 -->
                                    <!-- <th class="th-reviewer">검토 상태</th> -->
                                    <th class="th-state">상태</th>
                                    <th class="th-time">생성 시간</th>
                                </tr>
                            </thead>
                            <tbody>
                                <template v-for="group in activeTabGroups" :key="group.key">
                                    <tr
                                        class="review-row"
                                        :class="{ 'review-row--selected': selectedRows.has(reviewRowId(group.latest)) }"
                                        @click="openInEditor(group.latest)"
                                    >
                                        <td class="td-checkbox" @click.stop>
                                            <v-checkbox
                                                :model-value="selectedRows.has(reviewRowId(group.latest))"
                                                hide-details
                                                density="compact"
                                                @update:model-value="toggleRow(reviewRowId(group.latest))"
                                            />
                                        </td>
                                        <td class="td-process">
                                            <div class="process-name">{{ group.latest.process_name }}</div>
                                            <div class="process-id">
                                                {{ group.latest.proc_def_id ? group.latest.proc_def_id.substring(0, 8) : '' }}
                                                <span v-if="getVersionText(group.latest)">
                                                    &middot; {{ getVersionText(group.latest) }}</span
                                                >
                                            </div>
                                        </td>
                                        <td class="td-author">
                                            <div class="author-cell">
                                                <div
                                                    class="author-dot"
                                                    :style="{ background: getAvatarColor(resolvedAuthorLabel(group.latest)) }"
                                                ></div>
                                                <span>{{ resolvedAuthorLabel(group.latest) }}</span>
                                            </div>
                                        </td>
                                        <td class="td-hq-owners">
                                            <div class="owners-cell">
                                                <v-chip
                                                    v-for="(owner, oi) in (group.latest.hq_owners || []).slice(0, 2)"
                                                    :key="oi"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="#2196f3"
                                                    class="mr-1"
                                                >
                                                    {{ resolvedOwnerLabel(owner) }}
                                                </v-chip>
                                                <span v-if="(group.latest.hq_owners || []).length === 0" class="text-grey text-caption">-</span>
                                                <span v-if="(group.latest.hq_owners || []).length > 2" class="text-caption text-grey ml-1">+{{ (group.latest.hq_owners || []).length - 2 }}</span>
                                            </div>
                                        </td>
                                        <td class="td-field-owners">
                                            <div class="owners-cell">
                                                <v-chip
                                                    v-for="(owner, oi) in (group.latest.field_owners || []).slice(0, 2)"
                                                    :key="oi"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="#4caf50"
                                                    class="mr-1"
                                                >
                                                    {{ resolvedOwnerLabel(owner) }}
                                                </v-chip>
                                                <span v-if="(group.latest.field_owners || []).length === 0" class="text-grey text-caption">-</span>
                                                <span v-if="(group.latest.field_owners || []).length > 2" class="text-caption text-grey ml-1">+{{ (group.latest.field_owners || []).length - 2 }}</span>
                                            </div>
                                        </td>
                                        <td class="td-domain">
                                            <span class="domain-text">{{ group.latest.domain_name || '-' }}</span>
                                        </td>
                                        <!-- 본사 + 현업 단계에서 사용하던 검토 상태 td (그룹) — 본사 제거로 주석 처리 -->
                                        <!-- <td class="td-reviewer">
                                            <div class="reviewer-badges">
                                                <v-chip
                                                    size="x-small"
                                                    :color="
                                                        group.latest.hq_status === 'approved'
                                                            ? 'success'
                                                            : group.latest.hq_status === 'rejected'
                                                            ? 'error'
                                                            : '#2196f3'
                                                    "
                                                    variant="tonal"
                                                    class="mr-1"
                                                >
                                                    <v-icon start size="10">mdi-domain</v-icon>
                                                    본사 {{ getReviewStatusLabel(group.latest.hq_status || 'pending') }}
                                                </v-chip>
                                                <v-chip
                                                    size="x-small"
                                                    :color="
                                                        group.latest.field_status === 'approved'
                                                            ? 'success'
                                                            : group.latest.field_status === 'rejected'
                                                            ? 'error'
                                                            : '#4caf50'
                                                    "
                                                    variant="tonal"
                                                >
                                                    <v-icon start size="10">mdi-account-hard-hat</v-icon>
                                                    현업 {{ getReviewStatusLabel(group.latest.field_status || 'pending') }}
                                                </v-chip>
                                            </div>
                                        </td> -->
                                        <td class="td-state">
                                            <ProgressBadge
                                                :status="group.latest.state"
                                                :custom-text="getStateChipLabel(group.latest)"
                                                size="small"
                                                variant="tonal"
                                            />
                                            <div v-if="group.latest.total_feedback_count > 0" class="resolution-indicator mt-1">
                                                <span
                                                    class="text-caption"
                                                    :class="group.latest.unresolved_count > 0 ? 'text-warning' : 'text-success'"
                                                >
                                                    <v-icon size="10" :color="group.latest.unresolved_count > 0 ? 'warning' : 'success'">
                                                        {{
                                                            group.latest.unresolved_count > 0
                                                                ? 'mdi-comment-alert-outline'
                                                                : 'mdi-comment-check-outline'
                                                        }}
                                                    </v-icon>
                                                    {{ group.latest.unresolved_count || 0 }}/{{ group.latest.total_feedback_count }}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="td-time">
                                            <span class="time-text">{{ getRelativeTime(group.latest.updated_at) }}</span>
                                        </td>
                                    </tr>
                                    <tr v-if="group.previousVersions.length > 0" class="review-group-row">
                                        <td class="td-checkbox"></td>
                                        <td colspan="8" class="review-group-cell">
                                            <button class="review-group-toggle" @click.stop="toggleVersionGroup(activeTab, group.key)">
                                                <v-icon size="14">
                                                    {{
                                                        isVersionGroupExpanded(activeTab, group.key) ? 'mdi-chevron-up' : 'mdi-chevron-down'
                                                    }}
                                                </v-icon>
                                                {{ getVersionToggleLabel(group, isVersionGroupExpanded(activeTab, group.key)) }}
                                            </button>
                                        </td>
                                    </tr>
                                    <tr
                                        v-for="item in getExpandedHistoryItems(activeTab, group)"
                                        :key="reviewRowId(item)"
                                        class="review-row review-row--historical"
                                        :class="{ 'review-row--selected': selectedRows.has(reviewRowId(item)) }"
                                        @click="openInEditor(item)"
                                    >
                                        <td class="td-checkbox" @click.stop>
                                            <v-checkbox
                                                :model-value="selectedRows.has(reviewRowId(item))"
                                                hide-details
                                                density="compact"
                                                @update:model-value="toggleRow(reviewRowId(item))"
                                            />
                                        </td>
                                        <td class="td-process">
                                            <div class="process-name process-name--historical">{{ item.process_name }}</div>
                                            <div class="process-id">
                                                {{ item.proc_def_id ? item.proc_def_id.substring(0, 8) : '' }}
                                                <span v-if="getVersionText(item)"> &middot; {{ getVersionText(item) }}</span>
                                                <span class="process-history-badge">이전 버전</span>
                                            </div>
                                        </td>
                                         <td class="td-author">
                                            <div class="author-cell">
                                                <div
                                                    class="author-dot"
                                                    :style="{ background: getAvatarColor(resolvedAuthorLabel(item)) }"
                                                ></div>
                                                <span>{{ resolvedAuthorLabel(item) }}</span>
                                            </div>
                                        </td>
                                        <td class="td-hq-owners">
                                            <div class="owners-cell">
                                                <v-chip
                                                    v-for="(owner, oi) in (item.hq_owners || []).slice(0, 2)"
                                                    :key="oi"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="#2196f3"
                                                    class="mr-1"
                                                >
                                                    {{ resolvedOwnerLabel(owner) }}
                                                </v-chip>
                                                <span v-if="(item.hq_owners || []).length === 0" class="text-grey text-caption">-</span>
                                                <span v-if="(item.hq_owners || []).length > 2" class="text-caption text-grey ml-1">+{{ (item.hq_owners || []).length - 2 }}</span>
                                            </div>
                                        </td>
                                        <td class="td-field-owners">
                                            <div class="owners-cell">
                                                <v-chip
                                                    v-for="(owner, oi) in (item.field_owners || []).slice(0, 2)"
                                                    :key="oi"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="#4caf50"
                                                    class="mr-1"
                                                >
                                                    {{ resolvedOwnerLabel(owner) }}
                                                </v-chip>
                                                <span v-if="(item.field_owners || []).length === 0" class="text-grey text-caption">-</span>
                                                <span v-if="(item.field_owners || []).length > 2" class="text-caption text-grey ml-1">+{{ (item.field_owners || []).length - 2 }}</span>
                                            </div>
                                        </td>
                                        <td class="td-domain">
                                            <span class="domain-text">{{ item.domain_name || '-' }}</span>
                                        </td>
                                        <!-- 본사 + 현업 단계에서 사용하던 검토 상태 td (플랫) — 본사 제거로 주석 처리 -->
                                        <!-- <td class="td-reviewer">
                                            <div class="reviewer-badges">
                                                <v-chip
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
                                                    본사 {{ getReviewStatusLabel(item.hq_status || 'pending') }}
                                                </v-chip>
                                                <v-chip
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
                                                    현업 {{ getReviewStatusLabel(item.field_status || 'pending') }}
                                                </v-chip>
                                            </div>
                                        </td> -->
                                        <td class="td-state">
                                            <ProgressBadge
                                                :status="item.state"
                                                :custom-text="getStateChipLabel(item)"
                                                size="small"
                                                variant="tonal"
                                            />
                                            <div v-if="item.total_feedback_count > 0" class="resolution-indicator mt-1">
                                                <span
                                                    class="text-caption"
                                                    :class="item.unresolved_count > 0 ? 'text-warning' : 'text-success'"
                                                >
                                                    <v-icon size="10" :color="item.unresolved_count > 0 ? 'warning' : 'success'">
                                                        {{
                                                            item.unresolved_count > 0
                                                                ? 'mdi-comment-alert-outline'
                                                                : 'mdi-comment-check-outline'
                                                        }}
                                                    </v-icon>
                                                    {{ item.unresolved_count || 0 }}/{{ item.total_feedback_count }}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="td-time">
                                            <span class="time-text">{{ getRelativeTime(item.updated_at) }}</span>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>
                </div>
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
                <v-btn :color="getStageDef('public_feedback').vuetifyColor" variant="flat" size="small" :disabled="bulkApproveTargets.length === 0" @click="handleBulkApprove">
                    <v-icon start size="16">mdi-check</v-icon>
                    {{ getStageDef('public_feedback').label }} 승인
                </v-btn>
                <v-btn color="grey" variant="flat" size="small" :disabled="bulkRejectTargets.length === 0" @click="handleBulkReject">
                    <v-icon start size="16">mdi-close</v-icon>
                    반려
                </v-btn>
                <v-btn color="grey" variant="flat" size="small" :disabled="bulkPublishTargets.length === 0" @click="handleBulkPublish">
                    <v-icon start size="16">mdi-rocket-launch-outline</v-icon>
                    최종 배포
                </v-btn>
                <template v-if="adminPublicFeedbackTarget">
                    <v-btn color="grey" variant="flat" size="small" @click="openAdjustPublicFeedbackDialog">
                        <v-icon start size="16">mdi-calendar-edit</v-icon>
                        2단계 기간 조정
                    </v-btn>
                    <v-btn color="grey" variant="flat" size="small" @click="openEndPublicFeedbackDialog">
                        <v-icon start size="16">mdi-stop-circle-outline</v-icon>
                        2단계 즉시 종료
                    </v-btn>
                </template>
            </div>
        </div>

        <!-- ── 2단계 기간 조정 다이얼로그 (admin 전용, 단축/연장 모두 허용) ── -->
        <v-dialog v-model="adjustPublicFeedbackDialog" max-width="480" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold">2단계 기간 조정</v-card-title>
                <v-card-text>
                    <div class="text-body-2 mb-3">
                        선택한 2단계의 종료일을 변경합니다.
                        <br />
                        <span class="text-caption text-medium-emphasis"
                            >앞당기기(단축)와 미루기(연장) 모두 가능합니다. 오늘 이전 날짜는 [2단계 즉시 종료] 버튼을 사용하세요.</span
                        >
                    </div>
                    <v-text-field
                        v-model="adjustPublicFeedbackNewDate"
                        label="새 종료일"
                        type="date"
                        density="compact"
                        variant="outlined"
                        :min="adjustPublicFeedbackMinDate"
                        hide-details="auto"
                        class="mb-3"
                    />
                    <v-textarea
                        v-model="adjustPublicFeedbackReason"
                        label="사유 (필수)"
                        rows="3"
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        counter="200"
                        maxlength="200"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" :disabled="adjustPublicFeedbackLoading" @click="adjustPublicFeedbackDialog = false">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :loading="adjustPublicFeedbackLoading"
                        :disabled="!adjustPublicFeedbackNewDate || !adjustPublicFeedbackReason.trim()"
                        @click="confirmAdjustPublicFeedback"
                    >
                        변경 적용
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- ── 2단계 즉시 종료 다이얼로그 (admin 전용) ── -->
        <v-dialog v-model="endPublicFeedbackDialog" max-width="480" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold">2단계 즉시 종료</v-card-title>
                <v-card-text>
                    <div class="text-body-2 mb-3">
                        선택한 2단계를 즉시 종료하고 최종수정 단계로 이동합니다.
                        <br />
                        <span class="text-caption text-error">이 작업은 되돌릴 수 없습니다.</span>
                    </div>
                    <v-textarea
                        v-model="endPublicFeedbackReason"
                        label="사유 (필수)"
                        rows="3"
                        density="compact"
                        variant="outlined"
                        hide-details="auto"
                        counter="200"
                        maxlength="200"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" :disabled="endPublicFeedbackLoading" @click="endPublicFeedbackDialog = false">취소</v-btn>
                    <v-btn
                        color="error"
                        variant="flat"
                        :loading="endPublicFeedbackLoading"
                        :disabled="!endPublicFeedbackReason.trim()"
                        @click="confirmEndPublicFeedback"
                    >
                        즉시 종료
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.review-board-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* page-header 계열 클래스는 src/assets/css/SKGlobalStyle.scss 에 글로벌 정의되어 있음 */

/* ── Critical Alerts (inline) ── */
.critical-alerts-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #fff;
    border: 1px solid #fecdd3;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
}
.critical-alerts-inline:hover {
    background: #fef2f2;
}
.critical-alerts-label {
    font-size: 10px;
    font-weight: 700;
    color: #dc2626;
    letter-spacing: 0.5px;
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
    overflow-x: auto;
}
.pipeline-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    min-width: 150px;
}
.pipeline-label {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.2;
    max-width: 150px;
    min-height: 32px;
    text-align: center;
    white-space: normal;
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

/* ── Search & Filter Bar ── */
.search-filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    flex-shrink: 0;
    border-bottom: 1px solid #e8ecf0;
    background: #fafbfc;
    gap: 12px;
    flex-wrap: wrap;
}
.search-filter-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}
.search-filter-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.domain-filter-chips,
.status-filter-chips {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}

/* ── Tab Filters (content-card 내부) ── */
.tab-filters {
    display: flex;
    gap: 0;
    padding: 0px;
    flex-shrink: 0;
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
.th-hq-owners {
    min-width: 120px;
}
.th-field-owners {
    min-width: 120px;
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
.review-row--historical {
    background: #fbfcfe;
}
.review-row td {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
    vertical-align: middle;
}

.review-group-row td {
    padding: 8px 16px 10px;
    background: #fff;
    border-bottom: 1px solid #f1f5f9;
}
.review-group-cell {
    padding-left: 0;
}
.review-group-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    font-size: 12px;
    color: #475569;
    background: none;
    border: none;
    cursor: pointer;
}
.review-group-toggle:hover {
    color: #1d4ed8;
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
.process-name--historical {
    color: #334155;
}
.process-id {
    font-size: 11px;
    color: #b0b8c4;
}
.process-history-badge {
    display: inline-flex;
    align-items: center;
    margin-left: 8px;
    padding: 1px 6px;
    border-radius: 999px;
    color: #64748b;
    background: #e2e8f0;
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

/* Owners cell */
.owners-cell {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
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

/* ── Scrollbar ── */
.table-container::-webkit-scrollbar {
    width: 4px;
    height: 4px;
}
.table-container::-webkit-scrollbar-thumb {
    background: #d0d7de;
    border-radius: 4px;
}

</style>
