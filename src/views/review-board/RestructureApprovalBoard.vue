<template>
    <div class="restructure-approval-board">
        <div class="board-header">
            <div>
                <div class="board-title">구조변경 특별 결재 라인</div>
                <div class="board-subtitle">Re-Structuring draft를 검토하고 승인 완료 후 System Operations에서 cut-over를 적용합니다.</div>
            </div>
            <div class="d-flex align-center ga-2 flex-wrap">
                <v-chip size="small" color="warning" variant="tonal">Pending {{ pendingCount }}</v-chip>
                <v-chip size="small" color="success" variant="tonal">Approved {{ approvedCount }}</v-chip>
                <v-btn variant="outlined" class="text-none" size="small" @click="openSystemOperations">
                    <v-icon start size="14">mdi-cog-outline</v-icon>
                    System Operations
                </v-btn>
            </div>
        </div>

        <v-alert v-if="message.text" :type="message.type" variant="tonal" density="compact" class="mt-4">
            {{ message.text }}
        </v-alert>

        <div class="board-filter mt-4">
            <v-btn-toggle v-model="activeFilter" mandatory density="compact" color="primary">
                <v-btn value="pending" size="small">Pending</v-btn>
                <v-btn value="approved" size="small">Approved</v-btn>
                <v-btn value="rejected" size="small">Rejected</v-btn>
                <v-btn value="all" size="small">All</v-btn>
            </v-btn-toggle>
        </div>

        <div class="board-grid mt-4">
            <div class="request-list">
                <div v-if="filteredJobs.length === 0" class="request-empty">
                    <v-icon size="26" color="grey-lighten-1">mdi-file-document-outline</v-icon>
                    <span>검토할 구조변경 draft가 없습니다.</span>
                </div>
                <button
                    v-for="job in filteredJobs"
                    :key="job.id"
                    class="request-card"
                    :class="{ active: selectedJob?.id === job.id }"
                    @click="selectJob(job.id)"
                >
                    <div class="request-card__top">
                        <div class="request-card__title">{{ job.title }}</div>
                        <v-chip size="x-small" :color="approvalStatusColor(job.approval_status)" variant="tonal">
                            {{ approvalStatusLabel(job.approval_status) }}
                        </v-chip>
                    </div>
                    <div class="request-card__meta">
                        {{ job.draft_id }} · {{ job.version_label || 'version n/a' }} · {{ formatDateTime(job.created_at) }}
                    </div>
                    <div class="request-card__summary">{{ job.summary }}</div>
                </button>
            </div>

            <div class="request-detail">
                <div v-if="selectedJob" class="detail-card">
                    <div class="detail-header">
                        <div>
                            <div class="detail-title">{{ selectedJob.title }}</div>
                            <div class="detail-meta">{{ selectedJob.approval_title || selectedJob.summary }}</div>
                        </div>
                        <div class="d-flex align-center ga-2 flex-wrap">
                            <v-chip size="small" :color="approvalStatusColor(selectedJob.approval_status)" variant="flat">
                                {{ approvalStatusLabel(selectedJob.approval_status) }}
                            </v-chip>
                            <v-chip size="small" :color="cutoverStatusColor(selectedJob.status)" variant="tonal">
                                {{ selectedJob.status }}
                            </v-chip>
                        </div>
                    </div>

                    <div class="detail-grid">
                        <div class="detail-panel">
                            <div class="detail-panel__title">Request Info</div>
                            <div class="detail-kv">
                                <span>작업 유형</span>
                                <span>{{ selectedJob.operation }}</span>
                            </div>
                            <div class="detail-kv">
                                <span>생성자</span>
                                <span>{{ selectedJob.created_by || 'system' }}</span>
                            </div>
                            <div class="detail-kv">
                                <span>생성 시각</span>
                                <span>{{ formatDateTime(selectedJob.created_at) }}</span>
                            </div>
                            <div class="detail-kv">
                                <span>승인 상태</span>
                                <span>{{ approvalStatusLabel(selectedJob.approval_status) }}</span>
                            </div>
                            <div class="detail-kv" v-if="selectedJob.approved_at">
                                <span>승인 완료</span>
                                <span>{{ formatDateTime(selectedJob.approved_at) }} · {{ selectedJob.approved_by || 'system' }}</span>
                            </div>
                            <div class="detail-kv" v-if="selectedJob.rejected_at">
                                <span>반려 처리</span>
                                <span>{{ formatDateTime(selectedJob.rejected_at) }} · {{ selectedJob.rejected_by || 'system' }}</span>
                            </div>
                        </div>

                        <div class="detail-panel">
                            <div class="detail-panel__title">Impact</div>
                            <div class="impact-metrics">
                                <div class="impact-metric">
                                    <div class="impact-metric__label">Mega</div>
                                    <div class="impact-metric__value">{{ selectedJob.impacted_mega_count }}</div>
                                </div>
                                <div class="impact-metric">
                                    <div class="impact-metric__label">Major</div>
                                    <div class="impact-metric__value">{{ selectedJob.impacted_major_count }}</div>
                                </div>
                                <div class="impact-metric">
                                    <div class="impact-metric__label">Sub</div>
                                    <div class="impact-metric__value">{{ selectedJob.impacted_sub_count }}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="detail-panel mt-4">
                        <div class="detail-panel__title">Before / After Snapshot</div>
                        <div class="snapshot-grid">
                            <div class="snapshot-card">
                                <div class="snapshot-card__title">Before</div>
                                <div class="snapshot-card__metrics">
                                    <span>Mega {{ selectedJob.before_snapshot?.mega_count ?? 0 }}</span>
                                    <span>Major {{ selectedJob.before_snapshot?.major_count ?? 0 }}</span>
                                    <span>Sub {{ selectedJob.before_snapshot?.sub_count ?? 0 }}</span>
                                </div>
                                <div class="snapshot-card__lines">
                                    <div v-for="line in selectedJob.before_snapshot?.highlights || []" :key="`before-${line}`" class="snapshot-line">
                                        {{ line }}
                                    </div>
                                </div>
                            </div>

                            <div class="snapshot-card">
                                <div class="snapshot-card__title">After</div>
                                <div class="snapshot-card__metrics">
                                    <span>Mega {{ selectedJob.after_snapshot?.mega_count ?? 0 }}</span>
                                    <span>Major {{ selectedJob.after_snapshot?.major_count ?? 0 }}</span>
                                    <span>Sub {{ selectedJob.after_snapshot?.sub_count ?? 0 }}</span>
                                </div>
                                <div class="snapshot-card__lines">
                                    <div v-for="line in selectedJob.after_snapshot?.highlights || []" :key="`after-${line}`" class="snapshot-line">
                                        {{ line }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="selectedJob.change_summary?.length" class="detail-panel mt-4">
                        <div class="detail-panel__title">Change Summary</div>
                        <div class="summary-list">
                            <div v-for="line in selectedJob.change_summary" :key="line" class="summary-item">
                                <v-icon size="14" color="primary">mdi-arrow-right</v-icon>
                                <span>{{ line }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-panel mt-4">
                        <div class="detail-panel__title">Approval Comment</div>
                        <v-textarea
                            v-model="approvalComment"
                            rows="3"
                            auto-grow
                            variant="outlined"
                            density="compact"
                            hide-details
                            :disabled="!canReview"
                            placeholder="승인 또는 반려 사유를 남길 수 있습니다."
                        />
                        <div v-if="selectedJob.approval_comment" class="approval-comment mt-3">
                            최근 의견: {{ selectedJob.approval_comment }}
                        </div>
                    </div>

                    <div class="detail-actions mt-4">
                        <v-btn
                            color="success"
                            variant="flat"
                            class="text-none"
                            :disabled="!canApproveSelected"
                            :loading="actionLoading === 'approve'"
                            @click="approveSelected"
                        >
                            <v-icon start size="14">mdi-check-bold</v-icon>
                            승인
                        </v-btn>
                        <v-btn
                            color="error"
                            variant="outlined"
                            class="text-none"
                            :disabled="!canRejectSelected"
                            :loading="actionLoading === 'reject'"
                            @click="rejectSelected"
                        >
                            <v-icon start size="14">mdi-close-thick</v-icon>
                            반려
                        </v-btn>
                        <v-btn
                            variant="text"
                            class="text-none"
                            @click="openSystemOperations"
                        >
                            <v-icon start size="14">mdi-cog-outline</v-icon>
                            System Operations에서 cut-over 적용
                        </v-btn>
                    </div>
                </div>
                <div v-else class="request-empty">
                    <v-icon size="26" color="grey-lighten-1">mdi-file-search-outline</v-icon>
                    <span>좌측에서 구조변경 draft를 선택하세요.</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authClaimsState } from '@/utils/authClaims';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { formatKST } from '@/utils/datetime';

const router = useRouter();
const route = useRoute();
const adminStore = useAdminConsoleStore();

const activeFilter = ref<'pending' | 'approved' | 'rejected' | 'all'>('pending');
const selectedJobId = ref('');
const approvalComment = ref('');
const actionLoading = ref<'approve' | 'reject' | ''>('');
const message = ref<{ type: 'success' | 'info' | 'warning' | 'error'; text: string }>({ type: 'info', text: '' });

const isAdmin = computed(() => localStorage.getItem('role') === 'superAdmin' || authClaimsState.isAdmin);
const jobs = computed(() => adminStore.cutoverJobs || []);
const filteredJobs = computed(() => {
    if (activeFilter.value === 'all') return jobs.value;
    return jobs.value.filter((job) => (job.approval_status || 'pending') === activeFilter.value);
});
const selectedJob = computed(() => filteredJobs.value.find((job) => job.id === selectedJobId.value) || jobs.value.find((job) => job.id === selectedJobId.value) || null);
const pendingCount = computed(() => jobs.value.filter((job) => (job.approval_status || 'pending') === 'pending').length);
const approvedCount = computed(() => jobs.value.filter((job) => job.approval_status === 'approved').length);
const canReview = computed(() => isAdmin.value && !!selectedJob.value && selectedJob.value.status !== 'completed');
const canApproveSelected = computed(() => canReview.value && selectedJob.value?.approval_status !== 'approved');
const canRejectSelected = computed(() => canReview.value && selectedJob.value?.status !== 'completed');

function approvalStatusColor(status?: string) {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'error';
    return 'warning';
}

function approvalStatusLabel(status?: string) {
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return 'Pending';
}

function cutoverStatusColor(status?: string) {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'running') return 'info';
    return 'warning';
}

function formatDateTime(value?: string) {
    if (!value) return '—';
    try {
        return formatKST(value);
    } catch {
        return value;
    }
}

function selectJob(jobId: string) {
    selectedJobId.value = jobId;
}

function openSystemOperations() {
    router.push({ name: 'Admin System Operations' });
}

async function approveSelected() {
    if (!selectedJob.value) return;
    actionLoading.value = 'approve';
    try {
        await adminStore.approveCutoverJob(selectedJob.value.id, approvalComment.value.trim());
        message.value = { type: 'success', text: '구조변경 draft가 승인되었습니다. 이제 System Operations에서 cut-over를 적용할 수 있습니다.' };
    } catch (e: any) {
        console.error('Failed to approve restructure draft:', e);
        message.value = { type: 'error', text: e?.message || '승인 처리에 실패했습니다.' };
    } finally {
        actionLoading.value = '';
    }
}

async function rejectSelected() {
    if (!selectedJob.value) return;
    actionLoading.value = 'reject';
    try {
        await adminStore.rejectCutoverJob(selectedJob.value.id, approvalComment.value.trim());
        message.value = { type: 'warning', text: '구조변경 draft가 반려되었습니다. 요청자는 draft를 다시 생성해야 합니다.' };
    } catch (e: any) {
        console.error('Failed to reject restructure draft:', e);
        message.value = { type: 'error', text: e?.message || '반려 처리에 실패했습니다.' };
    } finally {
        actionLoading.value = '';
    }
}

watch(
    [filteredJobs, selectedJob],
    ([list, current]) => {
        if (!list.length && jobs.value.length > 0 && activeFilter.value !== 'all') {
            activeFilter.value = 'all';
            return;
        }
        if (!list.length) {
            selectedJobId.value = '';
            return;
        }
        if (!current || !list.some((job) => job.id === selectedJobId.value)) {
            selectedJobId.value = String(route.query.jobId || list[0].id);
        }
    },
    { immediate: true }
);

watch(selectedJob, (job) => {
    approvalComment.value = job?.approval_comment || '';
});

onMounted(async () => {
    await adminStore.loadCutoverJobs();
});
</script>

<style scoped>
.restructure-approval-board {
    padding: 24px;
    background: #f8fafc;
    min-height: 100%;
}

.board-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.board-title {
    font-size: 22px;
    font-weight: 700;
    color: #111827;
}

.board-subtitle {
    margin-top: 6px;
    font-size: 13px;
    color: #6b7280;
}

.board-filter {
    display: flex;
    justify-content: flex-end;
}

.board-grid {
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 18px;
}

.request-list,
.detail-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.request-empty,
.request-card,
.detail-card {
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    background: #ffffff;
}

.request-empty {
    min-height: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #6b7280;
}

.request-card {
    width: 100%;
    padding: 16px;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.request-card:hover,
.request-card.active {
    border-color: #f59e0b;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
}

.request-card__top,
.detail-header,
.detail-kv,
.detail-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.request-card__title,
.detail-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
}

.request-card__meta,
.detail-meta {
    margin-top: 8px;
    font-size: 12px;
    color: #6b7280;
}

.request-card__summary {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.6;
    color: #374151;
}

.detail-card {
    padding: 20px;
}

.detail-grid,
.snapshot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.detail-panel,
.snapshot-card {
    padding: 16px;
    border-radius: 14px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
}

.detail-panel__title,
.snapshot-card__title {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
}

.detail-kv {
    margin-top: 10px;
    font-size: 13px;
    color: #374151;
}

.impact-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
}

.impact-metric {
    padding: 12px;
    border-radius: 12px;
    background: #fff7ed;
    border: 1px solid #fdba74;
}

.impact-metric__label {
    font-size: 11px;
    font-weight: 700;
    color: #9a3412;
    text-transform: uppercase;
}

.impact-metric__value {
    margin-top: 8px;
    font-size: 22px;
    font-weight: 700;
    color: #7c2d12;
}

.snapshot-card__metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
    font-size: 12px;
    color: #475569;
}

.snapshot-card__lines,
.summary-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
}

.snapshot-line,
.summary-item,
.approval-comment {
    font-size: 13px;
    line-height: 1.6;
    color: #374151;
}

.summary-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.approval-comment {
    padding: 12px 14px;
    border-radius: 12px;
    background: #fffbeb;
    border: 1px solid #fde68a;
}

@media (max-width: 1080px) {
    .board-header,
    .detail-header,
    .detail-actions {
        flex-direction: column;
        align-items: flex-start;
    }

    .board-grid,
    .detail-grid,
    .snapshot-grid {
        grid-template-columns: 1fr;
    }
}
</style>
