<template>
    <div class="recycle-bin">
        <!-- Header -->
        <div class="section-header">
            <div class="header-left">
                <v-icon class="section-icon">mdi-delete-restore</v-icon>
                <span class="section-title">{{ $t('adminConsole.recycleBin.title') }}</span>
            </div>
            <div class="header-actions">
                <button
                    v-if="selectedIds.length > 0"
                    class="btn btn-outline btn-sm"
                    @click="handleBulkRestore"
                    :disabled="store.loading"
                >
                    <v-icon size="16">mdi-restore</v-icon>
                    {{ $t('adminConsole.recycleBin.bulkRestore') }} ({{ selectedIds.length }})
                </button>
                <button
                    v-if="selectedIds.length > 0"
                    class="btn btn-danger btn-sm"
                    @click="openBulkDeleteDialog"
                    :disabled="store.loading"
                >
                    <v-icon size="16">mdi-delete-forever</v-icon>
                    {{ $t('adminConsole.recycleBin.bulkDelete') }} ({{ selectedIds.length }})
                </button>
            </div>
        </div>

        <!-- Toolbar: Search + Filter Tabs -->
        <div class="toolbar">
            <div class="search-wrapper">
                <v-icon class="search-icon" size="18">mdi-magnify</v-icon>
                <input
                    v-model="searchQuery"
                    class="search-input"
                    :placeholder="$t('adminConsole.recycleBin.search')"
                    type="text"
                />
            </div>
            <div class="filter-pills">
                <button
                    v-for="f in filterOptions"
                    :key="f.value"
                    class="pill"
                    :class="{ active: activeFilter === f.value }"
                    @click="setFilter(f.value as 'all' | 'process' | 'instance')"
                >
                    {{ $t(f.label) }}
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="loading-state">
            <v-progress-circular indeterminate color="#3b82f6" size="32" width="3" />
        </div>

        <!-- Table -->
        <div v-else class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th class="col-check">
                            <input
                                type="checkbox"
                                :checked="isAllSelected"
                                :indeterminate="isIndeterminate"
                                @change="toggleSelectAll"
                                class="row-checkbox"
                            />
                        </th>
                        <th class="col-name">{{ $t('adminConsole.recycleBin.processName') }}</th>
                        <th class="col-type">유형</th>
                        <th class="col-by">{{ $t('adminConsole.recycleBin.deletedBy') }}</th>
                        <th class="col-date">{{ $t('adminConsole.recycleBin.deletedAt') }}</th>
                        <th class="col-days">{{ $t('adminConsole.recycleBin.remainingDays') }}</th>
                        <th class="col-actions">액션</th>
                    </tr>
                </thead>
                <tbody>
                    <template v-if="filteredItems.length === 0">
                        <tr>
                            <td colspan="7" class="empty-cell">
                                <div class="empty-state">
                                    <v-icon size="48" color="#d1d5db">mdi-delete-off-outline</v-icon>
                                    <p>{{ $t('adminConsole.recycleBin.noDeletedItems') }}</p>
                                </div>
                            </td>
                        </tr>
                    </template>
                    <template v-else>
                        <tr
                            v-for="item in filteredItems"
                            :key="item.uid"
                            :class="{ selected: selectedIds.includes(item.uid) }"
                        >
                            <td class="col-check">
                                <input
                                    type="checkbox"
                                    :checked="selectedIds.includes(item.uid)"
                                    @change="toggleSelect(item.uid)"
                                    class="row-checkbox"
                                />
                            </td>
                            <td class="col-name">
                                <span class="item-name">{{ item.name }}</span>
                            </td>
                            <td class="col-type">
                                <span class="type-badge" :class="item.type === 'process' ? 'type-process' : 'type-instance'">
                                    {{ item.type === 'process'
                                        ? $t('adminConsole.recycleBin.filterProcess')
                                        : $t('adminConsole.recycleBin.filterInstance') }}
                                </span>
                            </td>
                            <td class="col-by">{{ item.deleted_by || '-' }}</td>
                            <td class="col-date">{{ formatDate(item.deleted_at) }}</td>
                            <td class="col-days">
                                <span class="days-badge" :class="getDaysBadgeClass(item.remaining_days)">
                                    {{ item.remaining_days }}일
                                </span>
                            </td>
                            <td class="col-actions">
                                <button
                                    class="action-btn restore-btn"
                                    @click="handleRestore(item)"
                                    :disabled="store.loading"
                                    :title="$t('adminConsole.recycleBin.restore')"
                                >
                                    <v-icon size="16">mdi-restore</v-icon>
                                    {{ $t('adminConsole.recycleBin.restore') }}
                                </button>
                                <button
                                    class="action-btn delete-btn"
                                    @click="openDeleteDialog(item)"
                                    :disabled="store.loading"
                                    :title="$t('adminConsole.recycleBin.permanentDelete')"
                                >
                                    <v-icon size="16">mdi-delete-forever</v-icon>
                                    {{ $t('adminConsole.recycleBin.permanentDelete') }}
                                </button>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <!-- Permanent Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialog.visible" max-width="480" persistent>
            <v-card class="confirm-dialog">
                <div class="dialog-header">
                    <v-icon color="#ef4444" size="24">mdi-alert-circle-outline</v-icon>
                    <span class="dialog-title">{{ $t('adminConsole.recycleBin.confirmDelete') }}</span>
                    <button class="dialog-close" @click="closeDeleteDialog">
                        <v-icon size="20">mdi-close</v-icon>
                    </button>
                </div>
                <div class="dialog-body">
                    <p class="dialog-desc">{{ $t('adminConsole.recycleBin.confirmDeleteDesc') }}</p>
                    <div v-if="!deleteDialog.isBulk" class="target-info">
                        <strong>{{ deleteDialog.targetName }}</strong>
                    </div>
                    <div v-else class="target-info">
                        <strong>{{ selectedIds.length }}개 항목</strong>
                    </div>
                    <div class="confirm-input-wrapper">
                        <label class="confirm-label">{{ $t('adminConsole.recycleBin.typeDelete') }}</label>
                        <input
                            v-model="deleteConfirmText"
                            class="confirm-input"
                            type="text"
                            placeholder="DELETE"
                            @keydown.enter="submitDelete"
                        />
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="closeDeleteDialog">취소</button>
                    <button
                        class="btn btn-danger"
                        :disabled="deleteConfirmText !== 'DELETE' || store.loading"
                        @click="submitDelete"
                    >
                        <v-progress-circular v-if="store.loading" indeterminate size="14" width="2" color="white" />
                        <span v-else>{{ $t('adminConsole.recycleBin.permanentDelete') }}</span>
                    </button>
                </div>
            </v-card>
        </v-dialog>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';

interface DisplayItem {
    uid: string;
    name: string;
    type: 'process' | 'instance';
    deleted_by: string;
    deleted_at: string;
    remaining_days: number;
    raw_id: string;
}

interface DeleteDialogState {
    visible: boolean;
    isBulk: boolean;
    targetId: string;
    targetName: string;
    targetType: 'process' | 'instance';
}

export default defineComponent({
    name: 'RecycleBin',

    setup() {
        const store = useAdminConsoleStore();

        const searchQuery = ref('');
        const activeFilter = ref<'all' | 'process' | 'instance'>('all');
        const selectedIds = ref<string[]>([]);
        const deleteConfirmText = ref('');

        const deleteDialog = ref<DeleteDialogState>({
            visible: false,
            isBulk: false,
            targetId: '',
            targetName: '',
            targetType: 'process'
        });

        const filterOptions = [
            { value: 'all', label: 'adminConsole.recycleBin.filterAll' },
            { value: 'process', label: 'adminConsole.recycleBin.filterProcess' },
            { value: 'instance', label: 'adminConsole.recycleBin.filterInstance' }
        ];

        // Merge processes and instances into unified display items
        const allItems = computed<DisplayItem[]>(() => {
            const processes = (store.deletedProcesses || []).map(p => ({
                uid: `process::${p.id}`,
                name: p.name || p.id,
                type: 'process' as const,
                deleted_by: p.deleted_by || '',
                deleted_at: p.deleted_at,
                remaining_days: p.remaining_days,
                raw_id: p.id
            }));

            const instances = (store.deletedInstances || []).map(i => ({
                uid: `instance::${i.proc_inst_id}`,
                name: i.name || i.proc_inst_id,
                type: 'instance' as const,
                deleted_by: '',
                deleted_at: i.deleted_at,
                remaining_days: i.remaining_days,
                raw_id: i.proc_inst_id
            }));

            return [...processes, ...instances];
        });

        const filteredItems = computed<DisplayItem[]>(() => {
            let items = allItems.value;

            if (activeFilter.value === 'process') {
                items = items.filter(i => i.type === 'process');
            } else if (activeFilter.value === 'instance') {
                items = items.filter(i => i.type === 'instance');
            }

            const q = searchQuery.value.trim().toLowerCase();
            if (q) {
                items = items.filter(i => i.name.toLowerCase().includes(q));
            }

            return items;
        });

        const isAllSelected = computed(() => {
            return filteredItems.value.length > 0 &&
                filteredItems.value.every(i => selectedIds.value.includes(i.uid));
        });

        const isIndeterminate = computed(() => {
            const count = filteredItems.value.filter(i => selectedIds.value.includes(i.uid)).length;
            return count > 0 && count < filteredItems.value.length;
        });

        function setFilter(val: 'all' | 'process' | 'instance') {
            activeFilter.value = val;
            selectedIds.value = [];
        }

        function toggleSelectAll(e: Event) {
            const checked = (e.target as HTMLInputElement).checked;
            if (checked) {
                selectedIds.value = filteredItems.value.map(i => i.uid);
            } else {
                selectedIds.value = [];
            }
        }

        function toggleSelect(uid: string) {
            const idx = selectedIds.value.indexOf(uid);
            if (idx === -1) {
                selectedIds.value = [...selectedIds.value, uid];
            } else {
                selectedIds.value = selectedIds.value.filter(id => id !== uid);
            }
        }

        function formatDate(dateStr: string): string {
            if (!dateStr) return '-';
            try {
                const d = new Date(dateStr);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${mm}/${dd}`;
            } catch {
                return dateStr;
            }
        }

        function getDaysBadgeClass(days: number): string {
            if (days <= 5) return 'days-critical';
            if (days <= 10) return 'days-warning';
            return 'days-normal';
        }

        async function handleRestore(item: DisplayItem) {
            try {
                if (item.type === 'process') {
                    await store.restoreProcess(item.raw_id);
                } else {
                    await store.restoreInstance(item.raw_id);
                }
                selectedIds.value = selectedIds.value.filter(id => id !== item.uid);
            } catch (e) {
                console.error('Restore failed:', e);
            }
        }

        async function handleBulkRestore() {
            const toRestore = filteredItems.value.filter(i => selectedIds.value.includes(i.uid));
            for (const item of toRestore) {
                try {
                    if (item.type === 'process') {
                        await store.restoreProcess(item.raw_id);
                    } else {
                        await store.restoreInstance(item.raw_id);
                    }
                } catch (e) {
                    console.error('Bulk restore failed for', item.raw_id, e);
                }
            }
            selectedIds.value = [];
        }

        function openDeleteDialog(item: DisplayItem) {
            deleteDialog.value = {
                visible: true,
                isBulk: false,
                targetId: item.uid,
                targetName: item.name,
                targetType: item.type
            };
            deleteConfirmText.value = '';
        }

        function openBulkDeleteDialog() {
            deleteDialog.value = {
                visible: true,
                isBulk: true,
                targetId: '',
                targetName: '',
                targetType: 'process'
            };
            deleteConfirmText.value = '';
        }

        function closeDeleteDialog() {
            deleteDialog.value.visible = false;
            deleteConfirmText.value = '';
        }

        async function submitDelete() {
            if (deleteConfirmText.value !== 'DELETE') return;

            if (deleteDialog.value.isBulk) {
                const toDelete = filteredItems.value.filter(i => selectedIds.value.includes(i.uid));
                for (const item of toDelete) {
                    try {
                        if (item.type === 'process') {
                            await store.hardDeleteProcess(item.raw_id);
                        } else {
                            await store.hardDeleteInstance(item.raw_id);
                        }
                    } catch (e) {
                        console.error('Hard delete failed for', item.raw_id, e);
                    }
                }
                selectedIds.value = [];
            } else {
                const uid = deleteDialog.value.targetId;
                const item = allItems.value.find(i => i.uid === uid);
                if (item) {
                    try {
                        if (item.type === 'process') {
                            await store.hardDeleteProcess(item.raw_id);
                        } else {
                            await store.hardDeleteInstance(item.raw_id);
                        }
                        selectedIds.value = selectedIds.value.filter(id => id !== uid);
                    } catch (e) {
                        console.error('Hard delete failed:', e);
                    }
                }
            }

            closeDeleteDialog();
        }

        onMounted(async () => {
            await Promise.all([
                store.fetchDeletedProcesses(),
                store.fetchDeletedInstances()
            ]);
        });

        return {
            store,
            searchQuery,
            activeFilter,
            filterOptions,
            selectedIds,
            deleteDialog,
            deleteConfirmText,
            filteredItems,
            isAllSelected,
            isIndeterminate,
            setFilter,
            toggleSelectAll,
            toggleSelect,
            formatDate,
            getDaysBadgeClass,
            handleRestore,
            handleBulkRestore,
            openDeleteDialog,
            openBulkDeleteDialog,
            closeDeleteDialog,
            submitDelete
        };
    }
});
</script>

<style scoped>
.recycle-bin {
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
}

/* ── Header ─────────────────────────────────────────── */
.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
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

.header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 24px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    flex-wrap: wrap;
}

.search-wrapper {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 320px;
}

.search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
}

.search-input {
    width: 100%;
    height: 34px;
    padding: 0 12px 0 34px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    color: #111827;
    background: #ffffff;
    outline: none;
    transition: border-color 0.15s;
}

.search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.filter-pills {
    display: flex;
    gap: 6px;
}

.pill {
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
}

.pill:hover {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #2563eb;
}

.pill.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
    font-weight: 600;
}

/* ── Loading ─────────────────────────────────────────── */
.loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 48px;
}

/* ── Table ───────────────────────────────────────────── */
.table-wrapper {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.data-table thead tr {
    background: #f9fafb;
}

.data-table th {
    padding: 10px 14px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}

.data-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: middle;
}

.data-table tbody tr:last-child td {
    border-bottom: none;
}

.data-table tbody tr:hover td {
    background: #f9fafb;
}

.data-table tbody tr.selected td {
    background: #eff6ff;
}

/* Column widths */
.col-check {
    width: 40px;
    text-align: center;
}

.col-name {
    min-width: 200px;
}

.col-type {
    width: 100px;
}

.col-by {
    width: 120px;
}

.col-date {
    width: 80px;
}

.col-days {
    width: 80px;
    text-align: center;
}

.col-actions {
    width: 180px;
    white-space: nowrap;
}

/* Checkbox */
.row-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
    cursor: pointer;
}

/* Item name */
.item-name {
    font-weight: 500;
    color: #111827;
}

/* Type badge */
.type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
}

.type-process {
    background: #dbeafe;
    color: #1d4ed8;
}

.type-instance {
    background: #f3e8ff;
    color: #7c3aed;
}

/* Days badge */
.days-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
}

.days-normal {
    background: #dcfce7;
    color: #166534;
}

.days-warning {
    background: #fef9c3;
    color: #854d0e;
}

.days-critical {
    background: #fee2e2;
    color: #991b1b;
}

/* Action buttons */
.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 10px;
    border-radius: 5px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    margin-right: 6px;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.restore-btn {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #2563eb;
}

.restore-btn:hover:not(:disabled) {
    background: #dbeafe;
    border-color: #93c5fd;
}

.delete-btn {
    background: #fff1f2;
    border-color: #fecdd3;
    color: #e11d48;
}

.delete-btn:hover:not(:disabled) {
    background: #ffe4e6;
    border-color: #fda4af;
}

/* Empty state */
.empty-cell {
    padding: 0 !important;
    border-bottom: none !important;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 56px 24px;
    gap: 12px;
    color: #9ca3af;
    font-size: 14px;
}

/* ── Buttons ─────────────────────────────────────────── */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-sm {
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
}

.btn-outline {
    background: #ffffff;
    border-color: #d1d5db;
    color: #374151;
}

.btn-outline:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
}

.btn-danger {
    background: #ef4444;
    border-color: #ef4444;
    color: #ffffff;
}

.btn-danger:hover:not(:disabled) {
    background: #dc2626;
    border-color: #dc2626;
}

/* ── Confirm Dialog ──────────────────────────────────── */
.confirm-dialog {
    border-radius: 10px !important;
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 20px 0;
}

.dialog-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: #111827;
}

.dialog-close {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    border-radius: 4px;
}

.dialog-close:hover {
    background: #f3f4f6;
    color: #374151;
}

.dialog-body {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.dialog-desc {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.5;
    margin: 0;
}

.target-info {
    background: #f3f4f6;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
    color: #374151;
}

.confirm-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.confirm-label {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
}

.confirm-input {
    height: 36px;
    padding: 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    color: #111827;
    outline: none;
    font-family: monospace;
    letter-spacing: 0.08em;
    transition: border-color 0.15s;
}

.confirm-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 20px 20px;
}
</style>
