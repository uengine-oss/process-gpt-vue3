<template>
    <div class="data-freeze-manager">
        <!-- Section Header -->
        <div class="section-header">
            <v-icon class="section-icon">mdi-lock-outline</v-icon>
            <div>
                <span class="section-title">{{ $t('adminConsole.dataFreeze.title') }}</span>
            </div>
        </div>

        <!-- Scope Tabs -->
        <div class="scope-tabs">
            <button
                v-for="s in scopeOptions"
                :key="s.value"
                class="scope-tab"
                :class="{ active: scope === s.value }"
                @click="onScopeChange(s.value)"
            >
                <v-icon size="14">{{ s.icon }}</v-icon>
                <span>{{ $t(s.labelKey) }}</span>
                <span class="tab-count">{{ getLockedCount(s.value) }}</span>
            </button>
        </div>

        <!-- Reason Input (top bar) -->
        <div class="reason-bar">
            <v-icon size="16" color="#9ca3af">mdi-message-text-outline</v-icon>
            <input
                class="reason-input"
                v-model="reason"
                :placeholder="$t('adminConsole.dataFreeze.reasonPlaceholder')"
            />
        </div>

        <!-- Transfer List -->
        <div class="transfer-container">
            <!-- Left: Unlocked Items -->
            <div class="transfer-panel">
                <div class="panel-header">
                    <div class="panel-header-left">
                        <v-icon size="16" color="#22c55e">mdi-lock-open-outline</v-icon>
                        <span class="panel-label">{{ $t('adminConsole.dataFreeze.unlockedList') }}</span>
                        <span class="count-badge unlocked">{{ unlockedItems.length }}</span>
                    </div>
                    <label class="select-all-check" v-if="filteredUnlockedItems.length > 0">
                        <input
                            type="checkbox"
                            :checked="allUnlockedSelected"
                            @change="toggleAllUnlocked"
                        />
                        <span>{{ $t('adminConsole.dataFreeze.selectAll') }}</span>
                    </label>
                </div>
                <div class="panel-search">
                    <v-icon size="14" color="#9ca3af">mdi-magnify</v-icon>
                    <input
                        class="search-input"
                        v-model="searchUnlocked"
                        :placeholder="$t('adminConsole.dataFreeze.searchPlaceholder')"
                    />
                </div>
                <div class="panel-list">
                    <div
                        v-for="item in filteredUnlockedItems"
                        :key="item.id"
                        class="list-item"
                        :class="{ selected: selectedUnlocked.has(item.id) }"
                        @click="toggleUnlockedItem(item.id)"
                    >
                        <div class="item-checkbox">
                            <div class="checkbox-box" :class="{ checked: selectedUnlocked.has(item.id) }">
                                <v-icon v-if="selectedUnlocked.has(item.id)" size="12" color="#fff">mdi-check</v-icon>
                            </div>
                        </div>
                        <span class="item-name">{{ item.name }}</span>
                    </div>
                    <div v-if="filteredUnlockedItems.length === 0" class="empty-list">
                        <v-icon size="28" color="#d1d5db">mdi-check-circle-outline</v-icon>
                        <span>{{ $t('adminConsole.dataFreeze.noItems') }}</span>
                    </div>
                </div>
            </div>

            <!-- Center: Action Buttons -->
            <div class="transfer-actions">
                <button
                    class="action-btn lock-action"
                    :disabled="selectedUnlocked.size === 0 || store.loading"
                    @click="handleLockSelected"
                    :title="$t('adminConsole.dataFreeze.lockSelected')"
                >
                    <v-icon size="16">mdi-chevron-right</v-icon>
                    <v-icon size="14">mdi-lock</v-icon>
                </button>
                <button
                    class="action-btn unlock-action"
                    :disabled="selectedLocked.size === 0 || store.loading"
                    @click="handleUnlockSelected"
                    :title="$t('adminConsole.dataFreeze.unlockSelected')"
                >
                    <v-icon size="14">mdi-lock-open</v-icon>
                    <v-icon size="16">mdi-chevron-left</v-icon>
                </button>
            </div>

            <!-- Right: Locked Items -->
            <div class="transfer-panel locked-panel">
                <div class="panel-header">
                    <div class="panel-header-left">
                        <v-icon size="16" color="#ef4444">mdi-lock</v-icon>
                        <span class="panel-label">{{ $t('adminConsole.dataFreeze.lockedList') }}</span>
                        <span class="count-badge locked">{{ lockedItems.length }}</span>
                    </div>
                    <label class="select-all-check" v-if="filteredLockedItems.length > 0">
                        <input
                            type="checkbox"
                            :checked="allLockedSelected"
                            @change="toggleAllLocked"
                        />
                        <span>{{ $t('adminConsole.dataFreeze.selectAll') }}</span>
                    </label>
                </div>
                <div class="panel-search">
                    <v-icon size="14" color="#9ca3af">mdi-magnify</v-icon>
                    <input
                        class="search-input"
                        v-model="searchLocked"
                        :placeholder="$t('adminConsole.dataFreeze.searchPlaceholder')"
                    />
                </div>
                <div class="panel-list">
                    <div
                        v-for="item in filteredLockedItems"
                        :key="item.id"
                        class="list-item locked-item"
                        :class="{ selected: selectedLocked.has(item.target_id) }"
                        @click="toggleLockedItem(item.target_id)"
                    >
                        <div class="item-checkbox">
                            <div class="checkbox-box" :class="{ checked: selectedLocked.has(item.target_id) }">
                                <v-icon v-if="selectedLocked.has(item.target_id)" size="12" color="#fff">mdi-check</v-icon>
                            </div>
                        </div>
                        <div class="item-info">
                            <span class="item-name">{{ item.target_name }}</span>
                            <span class="item-meta">
                                {{ item.locked_by }} &middot; {{ formatDate(item.locked_at) }}
                                <span v-if="item.reason" class="item-reason">&middot; {{ item.reason }}</span>
                            </span>
                        </div>
                    </div>
                    <div v-if="filteredLockedItems.length === 0" class="empty-list">
                        <v-icon size="28" color="#d1d5db">mdi-lock-open-outline</v-icon>
                        <span>{{ $t('adminConsole.dataFreeze.noFreeze') }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <!-- Loading Overlay -->
        <div v-if="store.loading" class="loading-overlay">
            <v-progress-circular indeterminate color="primary" size="24" width="2" />
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, computed, reactive, onMounted, watch } from 'vue';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import BackendFactory from '@/components/api/BackendFactory';

export default defineComponent({
    name: 'DataFreezeManager',

    setup() {
        const store = useAdminConsoleStore();
        const backend = BackendFactory.createBackend();

        const scope = ref('domain');
        const reason = ref('');
        const errorMsg = ref('');
        const searchUnlocked = ref('');
        const searchLocked = ref('');
        const selectedUnlocked = reactive(new Set());
        const selectedLocked = reactive(new Set());

        // API에서 로드한 반응형 데이터
        const procMap = ref({ mega_proc_list: [] });
        const metricsMap = ref({ domains: [], mega_processes: [], processes: [] });
        const dataReady = ref(false);

        async function loadMapData() {
            try {
                const [pm, mm] = await Promise.all([
                    backend.getProcessDefinitionMap(),
                    backend.getMetricsMap()
                ]);
                procMap.value = pm && pm.mega_proc_list ? pm : { mega_proc_list: [] };
                metricsMap.value = mm && mm.domains ? mm : { domains: [], mega_processes: [], processes: [] };
                dataReady.value = true;
            } catch (e) {
                console.error('[DataFreezeManager] Failed to load map data:', e);
            }
        }

        const scopeOptions = [
            { value: 'domain', labelKey: 'adminConsole.dataFreeze.scopeDomain', icon: 'mdi-domain' },
            { value: 'mega_process', labelKey: 'adminConsole.dataFreeze.scopeMega', icon: 'mdi-sitemap-outline' },
            { value: 'major_process', labelKey: 'adminConsole.dataFreeze.scopeMajor', icon: 'mdi-file-tree' },
            { value: 'subprocess', labelKey: 'adminConsole.dataFreeze.scopeSub', icon: 'mdi-file-document-outline' }
        ];

        // Get all available items for the current scope
        const allItems = computed(() => {
            const mm = metricsMap.value;
            const pm = procMap.value;

            if (scope.value === 'domain') {
                if (mm?.domains?.length) {
                    return mm.domains.map((d) => ({ id: d.id, name: d.name }));
                }
                if (pm?.mega_proc_list?.length) {
                    const domainSet = new Map();
                    pm.mega_proc_list.forEach((mega) => {
                        (mega.major_proc_list || []).forEach((major) => {
                            if (major.domain && !domainSet.has(major.domain)) {
                                domainSet.set(major.domain, { id: major.domain, name: major.domain });
                            }
                        });
                    });
                    return Array.from(domainSet.values());
                }
                return [];
            }

            if (scope.value === 'mega_process') {
                if (mm?.mega_processes?.length) {
                    return mm.mega_processes.map((m) => ({ id: m.id, name: m.name }));
                }
                if (pm?.mega_proc_list?.length) {
                    return pm.mega_proc_list.map((mega) => ({ id: mega.id, name: mega.name }));
                }
                return [];
            }

            if (scope.value === 'major_process') {
                if (mm?.processes?.length) {
                    return mm.processes.map((p) => ({ id: p.id, name: p.name }));
                }
                if (pm?.mega_proc_list?.length) {
                    const majors = [];
                    pm.mega_proc_list.forEach((mega) => {
                        (mega.major_proc_list || []).forEach((major) => {
                            majors.push({ id: major.id, name: major.name });
                        });
                    });
                    return majors;
                }
                return [];
            }

            if (scope.value === 'subprocess') {
                if (pm?.mega_proc_list?.length) {
                    const subs = [];
                    pm.mega_proc_list.forEach((mega) => {
                        (mega.major_proc_list || []).forEach((major) => {
                            (major.sub_proc_list || []).forEach((sub) => {
                                subs.push({ id: sub.id, name: sub.name });
                            });
                        });
                    });
                    return subs;
                }
                return [];
            }

            return [];
        });

        // Filter freeze list by current scope
        const lockedItems = computed(() => {
            return (store.dataFreezeList || []).filter((item) => item.scope === scope.value);
        });

        const lockedIds = computed(() => {
            return new Set(lockedItems.value.map((item) => item.target_id));
        });

        // Unlocked = all items minus locked ones
        const unlockedItems = computed(() => {
            return allItems.value.filter((item) => !lockedIds.value.has(item.id));
        });

        // Filtered lists (search)
        const filteredUnlockedItems = computed(() => {
            if (!searchUnlocked.value) return unlockedItems.value;
            const q = searchUnlocked.value.toLowerCase();
            return unlockedItems.value.filter((item) => item.name.toLowerCase().includes(q));
        });

        const filteredLockedItems = computed(() => {
            if (!searchLocked.value) return lockedItems.value;
            const q = searchLocked.value.toLowerCase();
            return lockedItems.value.filter((item) => item.target_name.toLowerCase().includes(q));
        });

        // Select-all logic
        const allUnlockedSelected = computed(() => {
            if (filteredUnlockedItems.value.length === 0) return false;
            return filteredUnlockedItems.value.every((item) => selectedUnlocked.has(item.id));
        });

        const allLockedSelected = computed(() => {
            if (filteredLockedItems.value.length === 0) return false;
            return filteredLockedItems.value.every((item) => selectedLocked.has(item.target_id));
        });

        function getLockedCount(scopeValue) {
            return (store.dataFreezeList || []).filter((item) => item.scope === scopeValue).length;
        }

        function onScopeChange(val) {
            scope.value = val;
            errorMsg.value = '';
            selectedUnlocked.clear();
            selectedLocked.clear();
            searchUnlocked.value = '';
            searchLocked.value = '';
        }

        function toggleUnlockedItem(id) {
            if (selectedUnlocked.has(id)) {
                selectedUnlocked.delete(id);
            } else {
                selectedUnlocked.add(id);
            }
        }

        function toggleLockedItem(id) {
            if (selectedLocked.has(id)) {
                selectedLocked.delete(id);
            } else {
                selectedLocked.add(id);
            }
        }

        function toggleAllUnlocked() {
            if (allUnlockedSelected.value) {
                filteredUnlockedItems.value.forEach((item) => selectedUnlocked.delete(item.id));
            } else {
                filteredUnlockedItems.value.forEach((item) => selectedUnlocked.add(item.id));
            }
        }

        function toggleAllLocked() {
            if (allLockedSelected.value) {
                filteredLockedItems.value.forEach((item) => selectedLocked.delete(item.target_id));
            } else {
                filteredLockedItems.value.forEach((item) => selectedLocked.add(item.target_id));
            }
        }

        async function handleLockSelected() {
            if (selectedUnlocked.size === 0) return;
            errorMsg.value = '';

            try {
                const ids = Array.from(selectedUnlocked);
                for (const id of ids) {
                    const item = allItems.value.find((i) => i.id === id);
                    if (item) {
                        await store.setDataFreeze({
                            scope: scope.value,
                            target_id: item.id,
                            target_name: item.name,
                            reason: reason.value
                        });
                    }
                }
                selectedUnlocked.clear();
                reason.value = '';
            } catch (e) {
                errorMsg.value = e?.message || 'Failed to set freeze.';
            }
        }

        async function handleUnlockSelected() {
            if (selectedLocked.size === 0) return;
            errorMsg.value = '';

            try {
                const ids = Array.from(selectedLocked);
                for (const id of ids) {
                    await store.removeDataFreeze(id);
                }
                selectedLocked.clear();
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
            loadMapData();
        });

        return {
            store,
            scope,
            reason,
            errorMsg,
            searchUnlocked,
            searchLocked,
            selectedUnlocked,
            selectedLocked,
            scopeOptions,
            unlockedItems,
            lockedItems,
            filteredUnlockedItems,
            filteredLockedItems,
            allUnlockedSelected,
            allLockedSelected,
            getLockedCount,
            onScopeChange,
            toggleUnlockedItem,
            toggleLockedItem,
            toggleAllUnlocked,
            toggleAllLocked,
            handleLockSelected,
            handleUnlockSelected,
            formatDate
        };
    }
});
</script>

<style scoped>
.data-freeze-manager {
    background: #ffffff;
    position: relative;
    height: 100%;
}

/* Section Header */
.section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 24px 16px;
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

/* Scope Tabs */
.scope-tabs {
    display: flex;
    gap: 4px;
    padding: 0 24px;
    border-bottom: 1px solid #e5e7eb;
}

.scope-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    background: none;
    color: #6b7280;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
    white-space: nowrap;
}

.scope-tab:hover {
    color: #374151;
    background: #f9fafb;
}

.scope-tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
}

.tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #f3f4f6;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
}

.scope-tab.active .tab-count {
    background: #dbeafe;
    color: #3b82f6;
}

/* Reason Bar */
.reason-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-bottom: 1px solid #f3f4f6;
}

.reason-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 13px;
    color: #374151;
    background: transparent;
}

.reason-input::placeholder {
    color: #9ca3af;
}

/* Transfer Container */
.transfer-container {
    display: flex;
    gap: 0;
    padding: 20px 24px;
    min-height: 380px;
}

/* Transfer Panel */
.transfer-panel {
    flex: 1;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #ffffff;
}

.locked-panel {
    border-color: #fecaca;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
}

.locked-panel .panel-header {
    background: #fef2f2;
    border-bottom-color: #fecaca;
}

.panel-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.panel-label {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
}

.count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
}

.count-badge.unlocked {
    background: #dcfce7;
    color: #16a34a;
}

.count-badge.locked {
    background: #fee2e2;
    color: #dc2626;
}

.select-all-check {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    user-select: none;
}

.select-all-check input {
    accent-color: #3b82f6;
}

/* Panel Search */
.panel-search {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-bottom: 1px solid #f3f4f6;
}

.search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 12px;
    color: #374151;
    background: transparent;
}

.search-input::placeholder {
    color: #9ca3af;
}

/* Panel List */
.panel-list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    max-height: calc(100vh - 312px);
}

.list-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    cursor: pointer;
    transition: background 0.1s ease;
    border-bottom: 1px solid #f9fafb;
}

.list-item:hover {
    background: #f0f9ff;
}

.list-item.selected {
    background: #eff6ff;
}

.locked-item.selected {
    background: #fef2f2;
}

.item-checkbox {
    flex-shrink: 0;
}

.checkbox-box {
    width: 18px;
    height: 18px;
    border: 2px solid #d1d5db;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s ease;
}

.checkbox-box.checked {
    background: #3b82f6;
    border-color: #3b82f6;
}

.locked-item .checkbox-box.checked {
    background: #ef4444;
    border-color: #ef4444;
}

.item-name {
    font-size: 13px;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.item-info .item-name {
    font-weight: 500;
}

.item-meta {
    font-size: 11px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.item-reason {
    color: #6b7280;
}

.empty-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 20px;
    color: #9ca3af;
    font-size: 13px;
}

/* Transfer Actions */
.transfer-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 14px;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 10px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    color: #6b7280;
}

.action-btn:hover:not(:disabled) {
    border-color: #93c5fd;
    background: #eff6ff;
    color: #3b82f6;
}

.action-btn.lock-action:hover:not(:disabled) {
    border-color: #fca5a5;
    background: #fef2f2;
    color: #ef4444;
}

.action-btn.unlock-action:hover:not(:disabled) {
    border-color: #86efac;
    background: #f0fdf4;
    color: #16a34a;
}

.action-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

/* Error Message */
.error-msg {
    margin: 0 24px 16px;
    font-size: 12px;
    color: #ef4444;
    padding: 8px 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
}

/* Loading Overlay */
.loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.6);
    z-index: 10;
    border-radius: inherit;
}
</style>
