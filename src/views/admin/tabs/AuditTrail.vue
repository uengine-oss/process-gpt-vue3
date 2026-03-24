<template>
    <div class="audit-trail-wrapper">
        <!-- Header -->
        <div class="section-header">
            <div class="section-title-group">
                <v-icon class="section-icon">mdi-clipboard-text-clock-outline</v-icon>
                <span class="section-title">{{ $t('adminConsole.auditTrail.title') }}</span>
            </div>
            <button class="export-btn" :disabled="auditLogs.length === 0" @click="exportCsv">
                <v-icon size="16">mdi-download</v-icon>
                <span>{{ $t('adminConsole.auditTrail.exportCsv') }}</span>
            </button>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar">
            <div class="filter-group">
                <label class="filter-label">{{ $t('adminConsole.auditTrail.startDate') }}</label>
                <input
                    v-model="filters.startDate"
                    type="date"
                    class="filter-input filter-date"
                    @change="onFilterChange"
                />
            </div>
            <div class="filter-group">
                <label class="filter-label">{{ $t('adminConsole.auditTrail.endDate') }}</label>
                <input
                    v-model="filters.endDate"
                    type="date"
                    class="filter-input filter-date"
                    @change="onFilterChange"
                />
            </div>
            <div class="filter-group">
                <label class="filter-label">{{ $t('adminConsole.auditTrail.action') }}</label>
                <select v-model="filters.action" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">{{ $t('adminConsole.auditTrail.allActions') }}</option>
                    <option value="submit">submit</option>
                    <option value="approve">approve</option>
                    <option value="reject">reject</option>
                    <option value="reset_approvals">reset_approvals</option>
                    <option value="request_changes">request_changes</option>
                    <option value="publish">publish</option>
                    <option value="unpublish">unpublish</option>
                    <option value="cancel">cancel</option>
                </select>
            </div>
            <div class="filter-group filter-group-actor">
                <label class="filter-label">{{ $t('adminConsole.auditTrail.actor') }}</label>
                <input
                    v-model="filters.actorId"
                    type="text"
                    class="filter-input filter-text"
                    :placeholder="$t('adminConsole.auditTrail.filterActor')"
                    @input="onActorInput"
                />
            </div>
        </div>

        <div class="cutover-audit-card">
            <div class="cutover-audit-card__header">
                <div class="cutover-audit-card__title">Restructure Cut-over Events</div>
                <div class="cutover-audit-card__subtitle">Scenario 4 구조개편 cut-over 이력을 운영 감사 화면에서 함께 확인합니다.</div>
            </div>
            <div v-if="cutoverJobs.length === 0" class="cutover-audit-empty">
                cut-over 이벤트가 없습니다.
            </div>
            <div v-else class="cutover-audit-list">
                <div v-for="job in cutoverJobs.slice(0, 5)" :key="job.id" class="cutover-audit-item">
                    <div class="cutover-audit-item__top">
                        <span class="cutover-audit-item__title">{{ job.title }}</span>
                        <span class="action-chip chip-teal">{{ job.status }}</span>
                    </div>
                    <div class="cutover-audit-item__meta">
                        {{ formatDatetime(job.executed_at || job.failed_at || job.started_at || job.created_at) }} · {{ job.executed_by || job.created_by || 'system' }} · {{ job.approval_type }} · {{ job.version_label || 'version n/a' }}
                    </div>
                    <div class="cutover-audit-item__summary">
                        {{ job.summary }}
                    </div>
                    <div v-if="job.error_message" class="cutover-audit-item__summary">
                        Error: {{ job.error_message }}
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <v-progress-circular indeterminate color="primary" size="32" width="3" />
            <span class="loading-text">{{ $t('common.loading') || 'Loading...' }}</span>
        </div>

        <!-- Table -->
        <template v-else>
            <div class="table-container">
                <table class="audit-table">
                    <thead>
                        <tr>
                            <th class="col-datetime">{{ $t('adminConsole.auditTrail.createdAt') }}</th>
                            <th class="col-action">{{ $t('adminConsole.auditTrail.action') }}</th>
                            <th class="col-from">{{ $t('adminConsole.auditTrail.fromState') }}</th>
                            <th class="col-to">{{ $t('adminConsole.auditTrail.toState') }}</th>
                            <th class="col-actor">{{ $t('adminConsole.auditTrail.actor') }}</th>
                            <th class="col-comment">{{ $t('adminConsole.auditTrail.comment') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-if="auditLogs.length > 0">
                            <tr v-for="log in auditLogs" :key="log.id" class="audit-row">
                                <td class="col-datetime">
                                    <span class="datetime-text">{{ formatDatetime(log.created_at) }}</span>
                                </td>
                                <td class="col-action">
                                    <span
                                        class="action-chip"
                                        :class="getActionChipClass(log.action)"
                                    >{{ log.action }}</span>
                                </td>
                                <td class="col-from">
                                    <span class="state-text">{{ log.from_state || '—' }}</span>
                                </td>
                                <td class="col-to">
                                    <span class="state-text">{{ log.to_state || '—' }}</span>
                                </td>
                                <td class="col-actor">
                                    <span class="actor-text">{{ log.actor_id || '—' }}</span>
                                </td>
                                <td class="col-comment">
                                    <span
                                        class="comment-text"
                                        :title="log.comment || ''"
                                    >{{ truncateComment(log.comment) }}</span>
                                </td>
                            </tr>
                        </template>
                        <tr v-else>
                            <td colspan="6" class="empty-cell">
                                <div class="empty-state">
                                    <v-icon size="40" color="grey-lighten-1">mdi-clipboard-text-off-outline</v-icon>
                                    <span class="empty-text">{{ $t('adminConsole.auditTrail.noLogs') }}</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div v-if="auditTotal > pageSize" class="pagination-bar">
                <button
                    class="page-btn"
                    :disabled="currentPage === 1"
                    @click="goToPage(currentPage - 1)"
                >
                    <v-icon size="16">mdi-chevron-left</v-icon>
                </button>
                <button
                    v-for="p in visiblePages"
                    :key="p"
                    class="page-btn"
                    :class="{ active: p === currentPage }"
                    @click="goToPage(p)"
                >{{ p }}</button>
                <button
                    class="page-btn"
                    :disabled="currentPage === totalPages"
                    @click="goToPage(currentPage + 1)"
                >
                    <v-icon size="16">mdi-chevron-right</v-icon>
                </button>
                <span class="pagination-info">{{ paginationInfo }}</span>
            </div>
        </template>
    </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { storeToRefs } from 'pinia';

export default defineComponent({
    name: 'AuditTrail',

    setup() {
        const store = useAdminConsoleStore();
        const { auditLogs, auditTotal, loading, cutoverJobs } = storeToRefs(store);

        const pageSize = 50;
        const currentPage = ref(1);

        const filters = ref({
            startDate: '',
            endDate: '',
            action: '',
            actorId: ''
        });

        let actorInputTimer = null;

        // -----------------------------------------------
        // Computed
        // -----------------------------------------------
        const totalPages = computed(() => {
            return Math.max(1, Math.ceil(auditTotal.value / pageSize));
        });

        const visiblePages = computed(() => {
            const total = totalPages.value;
            const current = currentPage.value;
            const pages = [];

            const start = Math.max(1, current - 2);
            const end = Math.min(total, start + 4);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            return pages;
        });

        const paginationInfo = computed(() => {
            const start = (currentPage.value - 1) * pageSize + 1;
            const end = Math.min(currentPage.value * pageSize, auditTotal.value);
            return `${start}–${end} / ${auditTotal.value}`;
        });

        // -----------------------------------------------
        // Methods
        // -----------------------------------------------
        function buildFilters() {
            return {
                startDate: filters.value.startDate || undefined,
                endDate: filters.value.endDate || undefined,
                action: filters.value.action || undefined,
                actorId: filters.value.actorId || undefined,
                page: currentPage.value,
                pageSize
            };
        }

        async function loadLogs() {
            await store.fetchAuditLogs(buildFilters());
        }

        function onFilterChange() {
            currentPage.value = 1;
            loadLogs();
        }

        function onActorInput() {
            if (actorInputTimer) clearTimeout(actorInputTimer);
            actorInputTimer = setTimeout(() => {
                currentPage.value = 1;
                loadLogs();
            }, 400);
        }

        function goToPage(page) {
            if (page < 1 || page > totalPages.value) return;
            currentPage.value = page;
            loadLogs();
        }

        function formatDatetime(isoStr) {
            if (!isoStr) return '—';
            try {
                const d = new Date(isoStr);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const hh = String(d.getHours()).padStart(2, '0');
                const min = String(d.getMinutes()).padStart(2, '0');
                return `${mm}/${dd} ${hh}:${min}`;
            } catch {
                return isoStr;
            }
        }

        function truncateComment(text) {
            if (!text) return '—';
            return text.length > 40 ? text.slice(0, 40) + '…' : text;
        }

        function getActionChipClass(action) {
            const map = {
                submit: 'chip-blue',
                approve: 'chip-green',
                reject: 'chip-red',
                reset_approvals: 'chip-orange',
                request_changes: 'chip-amber',
                publish: 'chip-teal',
                unpublish: 'chip-grey',
                cancel: 'chip-pink'
            };
            return map[action] || 'chip-default';
        }

        function exportCsv() {
            if (auditLogs.value.length === 0) return;

            const headers = ['일시', '액션', '이전상태', '이후상태', '수행자', '코멘트', '프로세스'];
            const rows = auditLogs.value.map(log => [
                log.created_at || '',
                log.action || '',
                log.from_state || '',
                log.to_state || '',
                log.actor_id || '',
                (log.comment || '').replace(/"/g, '""'),
                (log.proc_def_name || log.proc_def_id || '')
            ]);

            const csvLines = [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ];
            const csvStr = '\uFEFF' + csvLines.join('\r\n');

            const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            anchor.href = url;
            anchor.download = `audit_log_${dateStr}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        }

        // -----------------------------------------------
        // Lifecycle
        // -----------------------------------------------
        onMounted(() => {
            store.loadCutoverJobs();
            loadLogs();
        });

        return {
            auditLogs,
            auditTotal,
            cutoverJobs,
            loading,
            filters,
            currentPage,
            pageSize,
            totalPages,
            visiblePages,
            paginationInfo,
            onFilterChange,
            onActorInput,
            goToPage,
            formatDatetime,
            truncateComment,
            getActionChipClass,
            exportCsv
        };
    }
});
</script>

<style scoped>
.audit-trail-wrapper {
    padding: 24px;
    background: #ffffff;
    min-height: 400px;
}

/* ── Header ─────────────────────────────────────────── */
.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.section-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-icon {
    color: #3b82f6;
    font-size: 20px;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
}

.export-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.export-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
}

.export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* ── Filter Bar ──────────────────────────────────────── */
.filter-bar {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.filter-group-actor {
    flex: 1;
    min-width: 160px;
}

.filter-label {
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.filter-input {
    height: 34px;
    padding: 0 10px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #1f2937;
    outline: none;
    transition: border-color 0.15s ease;
}

.filter-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.filter-date {
    width: 140px;
}

.filter-select {
    width: 160px;
    cursor: pointer;
}

.filter-text {
    width: 100%;
}

/* ── Cut-over Audit Card ───────────────────────────── */
.cutover-audit-card {
    margin-bottom: 20px;
    padding: 16px;
    border: 1px solid #e0e7ff;
    border-radius: 10px;
    background: #f8faff;
}

.cutover-audit-card__header {
    margin-bottom: 12px;
}

.cutover-audit-card__title {
    font-size: 14px;
    font-weight: 600;
    color: #1e3a8a;
}

.cutover-audit-card__subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #64748b;
}

.cutover-audit-empty {
    font-size: 13px;
    color: #64748b;
}

.cutover-audit-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.cutover-audit-item {
    padding: 12px 14px;
    border-radius: 8px;
    background: #ffffff;
    border: 1px solid #dbeafe;
}

.cutover-audit-item__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.cutover-audit-item__title {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
}

.cutover-audit-item__meta {
    margin-top: 6px;
    font-size: 12px;
    color: #64748b;
}

.cutover-audit-item__summary {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: #334155;
}

/* ── Loading ─────────────────────────────────────────── */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
}

.loading-text {
    font-size: 13px;
    color: #9ca3af;
}

/* ── Table ───────────────────────────────────────────── */
.table-container {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    overflow-x: auto;
}

.audit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    table-layout: fixed;
}

.audit-table thead tr {
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.audit-table th {
    padding: 11px 14px;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
}

.audit-table tbody tr.audit-row {
    border-bottom: 1px solid #f3f4f6;
    transition: background 0.1s ease;
}

.audit-table tbody tr.audit-row:last-child {
    border-bottom: none;
}

.audit-table tbody tr.audit-row:hover {
    background: #f8fafc;
}

.audit-table td {
    padding: 10px 14px;
    vertical-align: middle;
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Column widths */
.col-datetime { width: 110px; }
.col-action   { width: 140px; }
.col-from     { width: 110px; }
.col-to       { width: 110px; }
.col-actor    { width: 140px; }
.col-comment  { width: auto; }

.datetime-text {
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    color: #6b7280;
}

.state-text {
    font-size: 12px;
    color: #6b7280;
}

.actor-text {
    font-size: 12px;
    color: #374151;
    font-weight: 500;
}

.comment-text {
    font-size: 12px;
    color: #6b7280;
}

/* ── Action Chips ────────────────────────────────────── */
.action-chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
}

.chip-blue {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
}

.chip-green {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
}

.chip-red {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
}

.chip-orange {
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #fed7aa;
}

.chip-amber {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
}

.chip-teal {
    background: #f0fdfa;
    color: #0f766e;
    border: 1px solid #99f6e4;
}

.chip-grey {
    background: #f9fafb;
    color: #6b7280;
    border: 1px solid #e5e7eb;
}

.chip-pink {
    background: #fdf2f8;
    color: #9d174d;
    border: 1px solid #fbcfe8;
}

.chip-default {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
}

/* ── Empty State ─────────────────────────────────────── */
.empty-cell {
    padding: 0 !important;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 56px 20px;
    gap: 12px;
}

.empty-text {
    font-size: 13px;
    color: #9ca3af;
}

/* ── Pagination ──────────────────────────────────────── */
.pagination-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 20px 0 4px;
}

.page-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled):not(.active) {
    background: #f3f4f6;
    border-color: #9ca3af;
}

.page-btn.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
    font-weight: 600;
}

.page-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.pagination-info {
    margin-left: 12px;
    font-size: 12px;
    color: #9ca3af;
}
</style>
