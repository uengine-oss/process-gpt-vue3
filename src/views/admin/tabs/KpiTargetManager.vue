<template>
    <div class="kpi-manager">
        <!-- Section Header -->
        <div class="section-header">
            <div class="section-title-row">
                <v-icon class="section-icon">mdi-target</v-icon>
                <span class="section-title">{{ $t('adminConsole.kpiTarget.title') }}</span>
            </div>
        </div>

        <!-- Controls Bar -->
        <div class="controls-bar">
            <!-- Year Selector -->
            <div class="control-group">
                <label class="control-label">{{ $t('adminConsole.kpiTarget.year') }}</label>
                <select class="control-select" v-model="selectedYear" @change="onYearChange">
                    <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                </select>
            </div>

            <!-- Org Selector -->
            <div class="control-group">
                <label class="control-label">{{ $t('adminConsole.kpiTarget.org') }}</label>
                <select class="control-select org-select" v-model="selectedOrgId">
                    <option value="">-- {{ $t('adminConsole.kpiTarget.org') }} --</option>
                    <option
                        v-for="domain in domainList"
                        :key="domain.id"
                        :value="domain.id"
                    >{{ domain.name }}</option>
                </select>
            </div>

            <!-- Target Input -->
            <div class="control-group">
                <label class="control-label">{{ $t('adminConsole.kpiTarget.target') }}</label>
                <input
                    class="control-input"
                    type="number"
                    min="0"
                    v-model.number="newTarget"
                    :placeholder="$t('adminConsole.kpiTarget.targetPlaceholder')"
                />
            </div>

            <!-- Add Button -->
            <button
                class="btn-primary"
                :disabled="!selectedOrgId || newTarget === null || store.loading"
                @click="handleAddTarget"
            >
                <v-icon size="16">mdi-plus</v-icon>
                {{ $t('adminConsole.kpiTarget.addTarget') }}
            </button>
        </div>

        <!-- Error Alert -->
        <div v-if="store.error" class="error-alert">
            <v-icon size="16" color="#dc2626">mdi-alert-circle-outline</v-icon>
            <span>{{ store.error }}</span>
        </div>

        <!-- Table Area -->
        <div class="table-wrapper">
            <!-- Loading Overlay -->
            <div v-if="store.loading" class="table-loading">
                <v-progress-circular indeterminate color="#3b82f6" size="32" width="3" />
            </div>

            <table class="kpi-table">
                <thead>
                    <tr>
                        <th>{{ $t('adminConsole.kpiTarget.year') }}</th>
                        <th>{{ $t('adminConsole.kpiTarget.org') }}</th>
                        <th class="col-num">{{ $t('adminConsole.kpiTarget.target') }}</th>
                        <th class="col-num">{{ $t('adminConsole.kpiTarget.published') }}</th>
                        <th class="col-rate">{{ $t('adminConsole.kpiTarget.achievementRate') }}</th>
                        <th class="col-date">{{ $t('adminConsole.kpiTarget.updatedAt') }}</th>
                        <th class="col-actions"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="!store.loading && store.kpiTargets.length === 0">
                        <td colspan="7" class="empty-cell">
                            <v-icon size="36" color="#d1d5db">mdi-target-variant</v-icon>
                            <div>{{ $t('adminConsole.kpiTarget.noTargets') }}</div>
                        </td>
                    </tr>
                    <tr
                        v-for="item in store.kpiTargets"
                        :key="item.id || item.org_id"
                        class="kpi-row"
                    >
                        <!-- Year -->
                        <td class="cell-year">{{ item.year }}</td>

                        <!-- Org Name -->
                        <td class="cell-org">
                            <span class="org-badge">{{ item.org_name }}</span>
                        </td>

                        <!-- Target (Inline Edit) -->
                        <td class="col-num cell-target">
                            <input
                                v-if="editingId === item.id"
                                ref="editInputRef"
                                class="inline-edit-input"
                                type="number"
                                min="0"
                                v-model.number="editingValue"
                                @blur="handleInlineEditSave(item)"
                                @keyup.enter="handleInlineEditSave(item)"
                                @keyup.esc="cancelInlineEdit"
                            />
                            <span
                                v-else
                                class="target-value clickable"
                                :title="$t('adminConsole.kpiTarget.editTarget')"
                                @click="startInlineEdit(item)"
                            >{{ item.target }}</span>
                        </td>

                        <!-- Published Count -->
                        <td class="col-num">{{ item.published_count ?? 0 }}</td>

                        <!-- Achievement Rate -->
                        <td class="col-rate">
                            <div class="rate-cell">
                                <div class="rate-bar-track">
                                    <div
                                        class="rate-bar-fill"
                                        :class="getRateClass(item.achievement_rate)"
                                        :style="{ width: Math.min(item.achievement_rate ?? 0, 100) + '%' }"
                                    ></div>
                                </div>
                                <span
                                    class="rate-label"
                                    :class="getRateClass(item.achievement_rate)"
                                >{{ item.achievement_rate ?? 0 }}%</span>
                            </div>
                        </td>

                        <!-- Updated At -->
                        <td class="col-date cell-date">{{ formatDate(item.updated_at) }}</td>

                        <!-- Actions -->
                        <td class="col-actions">
                            <div class="action-buttons">
                                <button
                                    class="action-btn edit-btn"
                                    :title="$t('adminConsole.kpiTarget.editTarget')"
                                    @click="startInlineEdit(item)"
                                >
                                    <v-icon size="15">mdi-pencil-outline</v-icon>
                                </button>
                                <button
                                    class="action-btn delete-btn"
                                    :title="$t('adminConsole.kpiTarget.deleteTarget')"
                                    @click="promptDelete(item)"
                                >
                                    <v-icon size="15">mdi-trash-can-outline</v-icon>
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Delete Confirmation Dialog -->
        <div v-if="deleteDialog.visible" class="dialog-overlay" @click.self="cancelDelete">
            <div class="dialog-box">
                <div class="dialog-header">
                    <v-icon color="#dc2626" size="20">mdi-alert-circle-outline</v-icon>
                    <span>{{ $t('adminConsole.kpiTarget.deleteTarget') }}</span>
                </div>
                <div class="dialog-body">
                    <p class="dialog-message">{{ $t('adminConsole.kpiTarget.deleteConfirm') }}</p>
                    <div class="dialog-target-info" v-if="deleteDialog.item">
                        <span class="info-label">{{ $t('adminConsole.kpiTarget.org') }}:</span>
                        <span class="info-value">{{ deleteDialog.item.org_name }}</span>
                        <span class="info-label">{{ $t('adminConsole.kpiTarget.year') }}:</span>
                        <span class="info-value">{{ deleteDialog.item.year }}</span>
                        <span class="info-label">{{ $t('adminConsole.kpiTarget.target') }}:</span>
                        <span class="info-value">{{ deleteDialog.item.target }}</span>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn-secondary" @click="cancelDelete">
                        {{ $t('common.cancel') || '취소' }}
                    </button>
                    <button
                        class="btn-danger"
                        :disabled="store.loading"
                        @click="confirmDelete"
                    >
                        <v-icon size="14">mdi-trash-can-outline</v-icon>
                        {{ $t('adminConsole.kpiTarget.deleteTarget') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted, nextTick } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';

export default defineComponent({
    name: 'KpiTargetManager',

    setup() {
        const store = useAdminConsoleStore();

        // -------------------------------------------------------
        // Year selector
        // -------------------------------------------------------
        const currentYear = new Date().getFullYear();
        const yearOptions = computed(() => {
            const years = [];
            for (let y = currentYear - 2; y <= currentYear + 2; y++) {
                years.push(y);
            }
            return years;
        });
        const selectedYear = ref(currentYear);

        // -------------------------------------------------------
        // Domain list from window.$metricsMap
        // -------------------------------------------------------
        const domainList = computed(() => {
            const metricsMap = (window).$metricsMap;
            if (metricsMap && Array.isArray(metricsMap.domains)) {
                return metricsMap.domains.map((d) => ({
                    id: d.id,
                    name: d.name
                }));
            }
            return [];
        });

        // -------------------------------------------------------
        // New target form
        // -------------------------------------------------------
        const selectedOrgId = ref('');
        const newTarget = ref(null);

        // -------------------------------------------------------
        // Inline edit state
        // -------------------------------------------------------
        const editingId = ref(null);
        const editingValue = ref(0);
        const editInputRef = ref(null);

        // -------------------------------------------------------
        // Delete dialog state
        // -------------------------------------------------------
        const deleteDialog = ref({
            visible: false,
            item: null
        });

        // -------------------------------------------------------
        // Lifecycle
        // -------------------------------------------------------
        onMounted(() => {
            store.fetchKpiTargets(selectedYear.value);
        });

        // -------------------------------------------------------
        // Handlers
        // -------------------------------------------------------
        function onYearChange() {
            store.fetchKpiTargets(selectedYear.value);
        }

        async function handleAddTarget() {
            if (!selectedOrgId.value || newTarget.value === null) return;

            const domain = domainList.value.find((d) => d.id === selectedOrgId.value);
            const orgName = domain ? domain.name : selectedOrgId.value;

            try {
                await store.saveKpiTarget({
                    year: selectedYear.value,
                    org_id: selectedOrgId.value,
                    org_name: orgName,
                    target: newTarget.value
                });
                // Reset form on success
                selectedOrgId.value = '';
                newTarget.value = null;
            } catch (e) {
                // Error is already set in store
            }
        }

        function startInlineEdit(item) {
            editingId.value = item.id;
            editingValue.value = item.target;
            nextTick(() => {
                if (editInputRef.value) {
                    const el = Array.isArray(editInputRef.value)
                        ? editInputRef.value[0]
                        : editInputRef.value;
                    if (el) el.focus();
                }
            });
        }

        async function handleInlineEditSave(item) {
            if (editingId.value !== item.id) return;
            if (editingValue.value === item.target) {
                cancelInlineEdit();
                return;
            }
            try {
                await store.saveKpiTarget({
                    ...item,
                    target: editingValue.value
                });
            } catch (e) {
                // Error displayed via store.error
            } finally {
                editingId.value = null;
                editingValue.value = 0;
            }
        }

        function cancelInlineEdit() {
            editingId.value = null;
            editingValue.value = 0;
        }

        function promptDelete(item) {
            deleteDialog.value = { visible: true, item };
        }

        function cancelDelete() {
            deleteDialog.value = { visible: false, item: null };
        }

        async function confirmDelete() {
            const item = deleteDialog.value.item;
            if (!item || !item.id) return;
            try {
                await store.deleteKpiTarget(item.id);
            } catch (e) {
                // Error displayed via store.error
            } finally {
                deleteDialog.value = { visible: false, item: null };
            }
        }

        // -------------------------------------------------------
        // Helpers
        // -------------------------------------------------------
        function getRateClass(rate) {
            const r = rate ?? 0;
            if (r >= 80) return 'rate-green';
            if (r >= 50) return 'rate-yellow';
            return 'rate-red';
        }

        function formatDate(dateStr) {
            if (!dateStr) return '-';
            try {
                const d = new Date(dateStr);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${mm}/${dd}`;
            } catch {
                return '-';
            }
        }

        return {
            store,
            yearOptions,
            selectedYear,
            domainList,
            selectedOrgId,
            newTarget,
            editingId,
            editingValue,
            editInputRef,
            deleteDialog,
            onYearChange,
            handleAddTarget,
            startInlineEdit,
            handleInlineEditSave,
            cancelInlineEdit,
            promptDelete,
            cancelDelete,
            confirmDelete,
            getRateClass,
            formatDate
        };
    }
});
</script>

<style scoped>
/* ============================================================
   Container
   ============================================================ */
.kpi-manager {
    padding: 24px;
    background: #ffffff;
    position: relative;
    height: 100%;
}

/* ============================================================
   Section Header
   ============================================================ */
.section-header {
    margin-bottom: 20px;
}

.section-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-icon {
    color: #3b82f6;
    font-size: 20px;
}

.section-title {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
}

/* ============================================================
   Controls Bar
   ============================================================ */
.controls-bar {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    padding: 16px 20px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 16px;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.control-label {
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}

.control-select,
.control-input {
    height: 36px;
    padding: 0 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #ffffff;
    font-size: 13px;
    color: #1f2937;
    outline: none;
    transition: border-color 0.15s ease;
}

.control-select:focus,
.control-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.control-select {
    min-width: 100px;
    cursor: pointer;
}

.org-select {
    min-width: 180px;
}

.control-input {
    width: 100px;
}

/* ============================================================
   Buttons
   ============================================================ */
.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 16px;
    background: #3b82f6;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
    white-space: nowrap;
    align-self: flex-end;
}

.btn-primary:hover:not(:disabled) {
    background: #2563eb;
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-secondary {
    display: inline-flex;
    align-items: center;
    height: 34px;
    padding: 0 14px;
    background: #ffffff;
    color: #374151;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
}

.btn-secondary:hover {
    background: #f3f4f6;
}

.btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    background: #dc2626;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
}

.btn-danger:hover:not(:disabled) {
    background: #b91c1c;
}

.btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ============================================================
   Error Alert
   ============================================================ */
.error-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    font-size: 13px;
    color: #dc2626;
    margin-bottom: 14px;
}

/* ============================================================
   Table
   ============================================================ */
.table-wrapper {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: auto;
    position: relative;
    max-height: calc(100vh - 240px);
}

.table-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.75);
    z-index: 10;
}

.kpi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.kpi-table thead tr {
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.kpi-table th {
    padding: 10px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
    position: sticky;
    top: 0;
    background: #f8fafc;
    z-index: 2;
}

.kpi-table td {
    padding: 11px 14px;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
}

.kpi-row:last-child td {
    border-bottom: none;
}

.kpi-row:hover {
    background: #f9fafb;
}

/* Column sizing */
.col-num {
    text-align: right;
    width: 80px;
}

.col-rate {
    width: 160px;
}

.col-date {
    width: 80px;
    text-align: center;
}

.col-actions {
    width: 72px;
    text-align: right;
}

/* Cell styles */
.cell-year {
    font-weight: 600;
    color: #1f2937;
}

.cell-org {
    font-weight: 500;
}

.org-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #eff6ff;
    color: #1d4ed8;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
}

.cell-target {
    text-align: right;
}

.target-value.clickable {
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.12s ease;
    font-weight: 500;
}

.target-value.clickable:hover {
    background: #eff6ff;
    color: #2563eb;
}

.cell-date {
    color: #9ca3af;
    font-size: 12px;
}

/* Empty state */
.empty-cell {
    padding: 48px 16px;
    text-align: center;
    color: #9ca3af;
    font-size: 13px;
}

.empty-cell > div {
    margin-top: 10px;
}

/* ============================================================
   Inline Edit
   ============================================================ */
.inline-edit-input {
    width: 70px;
    height: 28px;
    padding: 0 6px;
    border: 1px solid #3b82f6;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    color: #1f2937;
    text-align: right;
    outline: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* ============================================================
   Achievement Rate Bar
   ============================================================ */
.rate-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}

.rate-bar-track {
    flex: 1;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
}

.rate-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.rate-label {
    font-size: 12px;
    font-weight: 600;
    min-width: 38px;
    text-align: right;
}

/* Rate color variants */
.rate-green .rate-bar-fill,
.rate-bar-fill.rate-green {
    background: #22c55e;
}

.rate-yellow .rate-bar-fill,
.rate-bar-fill.rate-yellow {
    background: #f59e0b;
}

.rate-red .rate-bar-fill,
.rate-bar-fill.rate-red {
    background: #ef4444;
}

.rate-label.rate-green {
    color: #16a34a;
}

.rate-label.rate-yellow {
    color: #d97706;
}

.rate-label.rate-red {
    color: #dc2626;
}

/* ============================================================
   Action Buttons
   ============================================================ */
.action-buttons {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.12s ease;
    color: #6b7280;
}

.action-btn:hover {
    border-color: transparent;
}

.edit-btn:hover {
    background: #eff6ff;
    color: #3b82f6;
    border-color: #bfdbfe;
}

.delete-btn:hover {
    background: #fef2f2;
    color: #dc2626;
    border-color: #fecaca;
}

/* ============================================================
   Delete Confirmation Dialog
   ============================================================ */
.dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.dialog-box {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    width: 420px;
    max-width: 90vw;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
}

.dialog-body {
    padding: 20px;
}

.dialog-message {
    font-size: 13px;
    color: #374151;
    margin-bottom: 14px;
}

.dialog-target-info {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    padding: 12px 14px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 12px;
}

.info-label {
    color: #6b7280;
    font-weight: 500;
    white-space: nowrap;
}

.info-value {
    color: #1f2937;
    font-weight: 500;
}

.dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid #e5e7eb;
    background: #f8fafc;
}
</style>
