<template>
    <div class="signup-approval">
        <div class="section-header">
            <div class="header-left">
                <v-icon class="section-icon">mdi-account-check-outline</v-icon>
                <span class="section-title">{{ $t('adminConsole.signupApproval.title') }}</span>
            </div>
            <div class="header-right">
                <v-btn size="small" variant="outlined" :loading="store.loading" @click="refreshList">
                    <v-icon size="16" start>mdi-refresh</v-icon>
                    {{ $t('adminConsole.signupApproval.refresh') }}
                </v-btn>
            </div>
        </div>

        <div class="toolbar">
            <div class="filter-pills">
                <button
                    v-for="opt in filterOptions"
                    :key="opt.value"
                    class="pill"
                    :class="{ active: selectedFilter === opt.value }"
                    @click="selectedFilter = opt.value"
                >
                    {{ $t(opt.label) }}
                </button>
            </div>
        </div>

        <div v-if="store.loading" class="loading-state">
            <v-progress-circular indeterminate color="#3b82f6" size="30" width="3" />
        </div>

        <div v-else class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>{{ $t('adminConsole.signupApproval.userName') }}</th>
                        <th>{{ $t('adminConsole.signupApproval.email') }}</th>
                        <th>{{ $t('adminConsole.signupApproval.requestedAt') }}</th>
                        <th>{{ $t('adminConsole.signupApproval.status') }}</th>
                        <th>{{ $t('adminConsole.signupApproval.reviewedBy') }}</th>
                        <th>{{ $t('adminConsole.signupApproval.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="filteredRequests.length === 0">
                        <td colspan="6" class="empty-cell">
                            <div class="empty-state">
                                <v-icon size="46" color="#d1d5db">mdi-account-search-outline</v-icon>
                                <p>{{ $t('adminConsole.signupApproval.noRequests') }}</p>
                            </div>
                        </td>
                    </tr>
                    <tr v-for="item in filteredRequests" :key="item.id">
                        <td>{{ item.username || '-' }}</td>
                        <td>{{ item.email }}</td>
                        <td>{{ formatDateTime(item.created_at) }}</td>
                        <td>
                            <span class="status-badge" :class="`status-${item.status}`">
                                {{ $t(statusLabelKey(item.status)) }}
                            </span>
                        </td>
                        <td>{{ item.reviewed_by || '-' }}</td>
                        <td>
                            <div class="row-actions">
                                <button
                                    class="action-btn approve-btn"
                                    :disabled="item.status === 'approved' || store.loading"
                                    @click="approve(item.id)"
                                >
                                    {{ $t('adminConsole.signupApproval.approve') }}
                                </button>
                                <button
                                    class="action-btn reject-btn"
                                    :disabled="item.status === 'rejected' || store.loading"
                                    @click="openRejectDialog(item.id)"
                                >
                                    {{ $t('adminConsole.signupApproval.reject') }}
                                </button>
                            </div>
                            <p v-if="item.reject_reason" class="reject-reason">
                                {{ $t('adminConsole.signupApproval.rejectReason') }}: {{ item.reject_reason }}
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <v-dialog v-model="rejectDialog.visible" max-width="500" persistent>
            <v-card class="confirm-dialog">
                <div class="dialog-header">
                    <v-icon color="#ef4444" size="24">mdi-account-cancel-outline</v-icon>
                    <span class="dialog-title">{{ $t('adminConsole.signupApproval.rejectDialogTitle') }}</span>
                </div>
                <div class="dialog-body">
                    <v-textarea
                        v-model="rejectDialog.reason"
                        :label="$t('adminConsole.signupApproval.rejectReason')"
                        :placeholder="$t('adminConsole.signupApproval.rejectReasonPlaceholder')"
                        variant="outlined"
                        density="compact"
                        rows="3"
                        auto-grow
                    />
                </div>
                <div class="dialog-footer">
                    <v-btn variant="outlined" @click="closeRejectDialog">{{ $t('common.cancel') || 'Cancel' }}</v-btn>
                    <v-btn color="error" :loading="store.loading" @click="submitReject">
                        {{ $t('common.confirm') || 'Confirm' }}
                    </v-btn>
                </div>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAdminConsoleStore, type SignupRequest } from '@/stores/adminConsole';

const store = useAdminConsoleStore();
const selectedFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('pending');

const rejectDialog = ref({
    visible: false,
    requestId: '',
    reason: ''
});

const filterOptions = [
    { value: 'pending', label: 'adminConsole.signupApproval.filterPending' },
    { value: 'approved', label: 'adminConsole.signupApproval.filterApproved' },
    { value: 'rejected', label: 'adminConsole.signupApproval.filterRejected' },
    { value: 'all', label: 'adminConsole.signupApproval.filterAll' }
] as const;

const filteredRequests = computed(() => {
    const list = store.signupRequests || [];
    if (selectedFilter.value === 'all') return list;
    return list.filter((item: SignupRequest) => item.status === selectedFilter.value);
});

function statusLabelKey(status: SignupRequest['status']) {
    if (status === 'approved') return 'adminConsole.signupApproval.statusApproved';
    if (status === 'rejected') return 'adminConsole.signupApproval.statusRejected';
    return 'adminConsole.signupApproval.statusPending';
}

function formatDateTime(iso?: string | null) {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return String(iso);
    }
}

async function refreshList() {
    await store.fetchSignupRequests('all');
}

async function approve(requestId: string) {
    await store.approveSignupRequest(requestId);
    await refreshList();
}

function openRejectDialog(requestId: string) {
    rejectDialog.value.visible = true;
    rejectDialog.value.requestId = requestId;
    rejectDialog.value.reason = '';
}

function closeRejectDialog() {
    rejectDialog.value.visible = false;
    rejectDialog.value.requestId = '';
    rejectDialog.value.reason = '';
}

async function submitReject() {
    if (!rejectDialog.value.requestId) return;
    await store.rejectSignupRequest(rejectDialog.value.requestId, rejectDialog.value.reason);
    closeRejectDialog();
    await refreshList();
}

watch(selectedFilter, async () => {
    await refreshList();
});

onMounted(async () => {
    await refreshList();
});
</script>

<style scoped>
.signup-approval {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
    border-bottom: 1px solid #e5e7eb;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.section-icon {
    color: #3b82f6;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
}

.toolbar {
    padding: 12px 22px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
}

.filter-pills {
    display: flex;
    gap: 6px;
}

.pill {
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #4b5563;
    font-size: 12px;
    cursor: pointer;
}

.pill.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
}

.loading-state {
    display: flex;
    justify-content: center;
    padding: 42px;
}

.table-wrapper {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.data-table th {
    background: #f9fafb;
    color: #6b7280;
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid #e5e7eb;
}

.data-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: top;
}

.empty-cell {
    border-bottom: none !important;
    padding: 0 !important;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 16px;
    color: #9ca3af;
}

.status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
}

.status-pending {
    background: #fff7ed;
    color: #c2410c;
}

.status-approved {
    background: #dcfce7;
    color: #166534;
}

.status-rejected {
    background: #fee2e2;
    color: #991b1b;
}

.row-actions {
    display: flex;
    gap: 6px;
}

.action-btn {
    height: 28px;
    border-radius: 5px;
    border: 1px solid transparent;
    padding: 0 10px;
    font-size: 12px;
    cursor: pointer;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.approve-btn {
    background: #ecfdf3;
    color: #166534;
    border-color: #bbf7d0;
}

.reject-btn {
    background: #fff1f2;
    color: #be123c;
    border-color: #fecdd3;
}

.reject-reason {
    margin-top: 6px;
    margin-bottom: 0;
    color: #b91c1c;
    font-size: 12px;
}

.confirm-dialog {
    border-radius: 10px !important;
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 20px 12px;
}

.dialog-title {
    font-size: 15px;
    font-weight: 600;
}

.dialog-body {
    padding: 0 20px 8px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 20px 18px;
}
</style>
