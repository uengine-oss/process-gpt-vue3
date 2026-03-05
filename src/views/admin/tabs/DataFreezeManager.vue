<template>
    <div class="data-freeze-manager">
        <!-- Section Header -->
        <div class="section-header">
            <v-icon class="section-icon">mdi-lock-outline</v-icon>
            <div>
                <span class="section-title">{{ $t('adminConsole.dataFreeze.title') }}</span>
            </div>
        </div>

        <!-- Main Content -->
        <div class="content-grid">
            <!-- Left Panel: Freeze Controls -->
            <div class="left-panel">
                <div class="panel-title">{{ $t('adminConsole.dataFreeze.scope') }}</div>

                <!-- Scope Selector -->
                <div class="scope-options">
                    <label class="radio-option" :class="{ selected: scope === 'domain' }" @click="onScopeChange('domain')">
                        <div class="radio-circle">
                            <div v-if="scope === 'domain'" class="radio-dot"></div>
                        </div>
                        <span>{{ $t('adminConsole.dataFreeze.scopeDomain') }}</span>
                    </label>

                    <label class="radio-option" :class="{ selected: scope === 'major_process' }" @click="onScopeChange('major_process')">
                        <div class="radio-circle">
                            <div v-if="scope === 'major_process'" class="radio-dot"></div>
                        </div>
                        <span>{{ $t('adminConsole.dataFreeze.scopeMajor') }}</span>
                    </label>
                </div>

                <!-- Target Dropdown -->
                <div class="field-group">
                    <div class="field-label">{{ $t('adminConsole.dataFreeze.selectTarget') }}</div>
                    <select class="custom-select" v-model="selectedTargetId" :disabled="targetOptions.length === 0">
                        <option value="">{{ $t('adminConsole.dataFreeze.selectTarget') }}</option>
                        <option
                            v-for="opt in targetOptions"
                            :key="opt.id"
                            :value="opt.id"
                        >{{ opt.name }}</option>
                    </select>
                </div>

                <!-- Reason Input -->
                <div class="field-group">
                    <div class="field-label">{{ $t('adminConsole.dataFreeze.reason') }}</div>
                    <textarea
                        class="custom-textarea"
                        v-model="reason"
                        :placeholder="$t('adminConsole.dataFreeze.reasonPlaceholder')"
                        rows="3"
                    ></textarea>
                </div>

                <!-- Lock Button -->
                <button
                    class="lock-btn"
                    :disabled="!selectedTargetId || store.loading"
                    @click="handleSetFreeze"
                >
                    <v-icon size="16">mdi-lock</v-icon>
                    <span>{{ $t('adminConsole.dataFreeze.lock') }}</span>
                </button>

                <!-- Error Message -->
                <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
            </div>

            <!-- Right Panel: Current Freeze List -->
            <div class="right-panel">
                <div class="panel-title">{{ $t('adminConsole.dataFreeze.currentList') }}</div>

                <!-- Loading state -->
                <div v-if="store.loading && store.dataFreezeList.length === 0" class="list-loading">
                    <v-progress-circular indeterminate color="primary" size="24" width="2" />
                </div>

                <!-- Empty state -->
                <div v-else-if="store.dataFreezeList.length === 0" class="empty-state">
                    <v-icon size="40" color="#d1d5db">mdi-lock-open-outline</v-icon>
                    <span>{{ $t('adminConsole.dataFreeze.noFreeze') }}</span>
                </div>

                <!-- Table -->
                <div v-else class="freeze-table-wrapper">
                    <table class="freeze-table">
                        <thead>
                            <tr>
                                <th>{{ $t('adminConsole.dataFreeze.scope') }}</th>
                                <th>{{ $t('adminConsole.dataFreeze.target') }}</th>
                                <th>{{ $t('adminConsole.dataFreeze.lockedAt') }}</th>
                                <th>{{ $t('adminConsole.dataFreeze.reason') }}</th>
                                <th>{{ $t('adminConsole.dataFreeze.lockedBy') }}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in store.dataFreezeList" :key="item.target_id" class="freeze-row">
                                <td>
                                    <span class="scope-badge" :class="item.scope">
                                        {{ item.scope === 'domain'
                                            ? $t('adminConsole.dataFreeze.scopeDomain')
                                            : $t('adminConsole.dataFreeze.scopeMajor') }}
                                    </span>
                                </td>
                                <td class="target-cell">{{ item.target_name }}</td>
                                <td class="date-cell">{{ formatDate(item.locked_at) }}</td>
                                <td class="reason-cell">{{ item.reason || '-' }}</td>
                                <td class="by-cell">{{ item.locked_by || '-' }}</td>
                                <td class="action-cell">
                                    <button
                                        class="unlock-btn"
                                        :disabled="store.loading"
                                        @click="handleRemoveFreeze(item.target_id)"
                                    >
                                        <v-icon size="14">mdi-lock-open-outline</v-icon>
                                        <span>{{ $t('adminConsole.dataFreeze.unlock') }}</span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';

export default defineComponent({
    name: 'DataFreezeManager',

    setup() {
        const store = useAdminConsoleStore();

        const scope = ref('domain');
        const selectedTargetId = ref('');
        const reason = ref('');
        const errorMsg = ref('');

        // Build target options from window globals
        const targetOptions = computed(() => {
            if (scope.value === 'domain') {
                const metricsMap = (window).$metricsMap;
                if (metricsMap?.domains?.length) {
                    return metricsMap.domains.map((d) => ({ id: d.id, name: d.name }));
                }
                // Fallback: derive domains from procMap
                const procMap = (window).$procMap;
                if (procMap?.mega_proc_list?.length) {
                    const domainSet = new Map();
                    procMap.mega_proc_list.forEach((mega) => {
                        (mega.major_proc_list || []).forEach((major) => {
                            if (major.domain && !domainSet.has(major.domain)) {
                                domainSet.set(major.domain, { id: major.domain, name: major.domain });
                            }
                        });
                    });
                    return Array.from(domainSet.values());
                }
                return [];
            } else {
                // major_process
                const metricsMap = (window).$metricsMap;
                if (metricsMap?.mega_processes?.length) {
                    return metricsMap.mega_processes.map((m) => ({ id: m.id, name: m.name }));
                }
                // Fallback from procMap
                const procMap = (window).$procMap;
                if (procMap?.mega_proc_list?.length) {
                    return procMap.mega_proc_list.map((mega) => ({ id: mega.id, name: mega.name }));
                }
                return [];
            }
        });

        const selectedTargetName = computed(() => {
            const found = targetOptions.value.find((o) => o.id === selectedTargetId.value);
            return found ? found.name : '';
        });

        function onScopeChange(val) {
            scope.value = val;
            selectedTargetId.value = '';
            errorMsg.value = '';
        }

        async function handleSetFreeze() {
            if (!selectedTargetId.value) return;
            errorMsg.value = '';
            try {
                await store.setDataFreeze({
                    scope: scope.value,
                    target_id: selectedTargetId.value,
                    target_name: selectedTargetName.value,
                    reason: reason.value
                });
                // Reset form on success
                selectedTargetId.value = '';
                reason.value = '';
            } catch (e) {
                errorMsg.value = e?.message || 'Failed to set freeze.';
            }
        }

        async function handleRemoveFreeze(targetId) {
            errorMsg.value = '';
            try {
                await store.removeDataFreeze(targetId);
            } catch (e) {
                errorMsg.value = e?.message || 'Failed to remove freeze.';
            }
        }

        function formatDate(dateStr) {
            if (!dateStr) return '-';
            try {
                const d = new Date(dateStr);
                return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
            } catch {
                return dateStr;
            }
        }

        onMounted(() => {
            store.fetchDataFreezeList();
        });

        return {
            store,
            scope,
            selectedTargetId,
            reason,
            errorMsg,
            targetOptions,
            selectedTargetName,
            onScopeChange,
            handleSetFreeze,
            handleRemoveFreeze,
            formatDate
        };
    }
});
</script>

<style scoped>
.data-freeze-manager {
    background: #ffffff;
}

/* Section Header */
.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
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

/* Content Grid */
.content-grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 0;
    min-height: 400px;
}

/* Left Panel */
.left-panel {
    padding: 24px;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: #f8fafc;
}

/* Right Panel */
.right-panel {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* Panel Title */
.panel-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* Radio Options */
.scope-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.radio-option {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 10px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #ffffff;
    transition: all 0.15s ease;
    font-size: 14px;
    color: #374151;
    user-select: none;
}

.radio-option:hover {
    border-color: #93c5fd;
    background: #eff6ff;
}

.radio-option.selected {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1d4ed8;
}

.radio-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #d1d5db;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #ffffff;
    transition: border-color 0.15s ease;
}

.radio-option.selected .radio-circle {
    border-color: #3b82f6;
}

.radio-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b82f6;
}

/* Field Group */
.field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field-label {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
}

/* Custom Select */
.custom-select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #ffffff;
    font-size: 14px;
    color: #1f2937;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s ease;
    appearance: auto;
}

.custom-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.custom-select:disabled {
    background: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
}

/* Custom Textarea */
.custom-textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #ffffff;
    font-size: 14px;
    color: #1f2937;
    resize: vertical;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
}

.custom-textarea:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.custom-textarea::placeholder {
    color: #9ca3af;
}

/* Lock Button */
.lock-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    background: #3b82f6;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
    width: 100%;
}

.lock-btn:hover:not(:disabled) {
    background: #2563eb;
}

.lock-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Error Message */
.error-msg {
    font-size: 12px;
    color: #ef4444;
    padding: 8px 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
}

/* Loading State */
.list-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
}

/* Empty State */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    color: #9ca3af;
    font-size: 14px;
}

/* Freeze Table */
.freeze-table-wrapper {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}

.freeze-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.freeze-table thead tr {
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.freeze-table th {
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    color: #6b7280;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
}

.freeze-table td {
    padding: 11px 14px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: middle;
}

.freeze-row:last-child td {
    border-bottom: none;
}

.freeze-row:hover td {
    background: #f8fafc;
}

/* Scope Badge */
.scope-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}

.scope-badge.domain {
    background: #dbeafe;
    color: #1d4ed8;
}

.scope-badge.major_process {
    background: #d1fae5;
    color: #065f46;
}

/* Table cells */
.target-cell {
    font-weight: 500;
    color: #1f2937;
}

.date-cell {
    color: #6b7280;
    white-space: nowrap;
}

.reason-cell {
    color: #4b5563;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.by-cell {
    color: #6b7280;
    white-space: nowrap;
}

.action-cell {
    white-space: nowrap;
    text-align: right;
}

/* Unlock Button */
.unlock-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
}

.unlock-btn:hover:not(:disabled) {
    border-color: #ef4444;
    color: #ef4444;
    background: #fef2f2;
}

.unlock-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
