<template>
    <v-container fluid class="admin-console-page">
        <!-- Non-admin access -->
        <div v-if="!isAdmin" class="no-access">
            <v-icon size="64" color="grey">mdi-shield-lock-outline</v-icon>
            <h3>{{ $t('adminConsole.noAccess') }}</h3>
            <p>{{ $t('adminConsole.noAccessDesc') }}</p>
        </div>

        <div v-else class="admin-container">
            <!-- Header -->
            <div class="admin-header">
                <v-icon class="header-icon">mdi-shield-lock-outline</v-icon>
                <div>
                    <span class="header-title">{{ $t('adminConsole.title') }}</span>
                    <div class="header-desc">{{ $t('adminConsole.description') }}</div>
                </div>
            </div>

            <!-- Loading -->
            <template v-if="initialLoading">
                <div class="loading-container">
                    <v-progress-circular indeterminate color="primary" size="40" width="3" />
                    <span class="loading-text">{{ $t('common.loading') || 'Loading...' }}</span>
                </div>
            </template>

            <!-- Content -->
            <template v-else>
                <!-- Flat Tabs -->
                <div class="flat-tabs">
                    <button
                        v-for="tab in tabs"
                        :key="tab.value"
                        class="flat-tab"
                        :class="{ active: activeTab === tab.value }"
                        @click="activeTab = tab.value"
                    >
                        <v-icon size="18">{{ tab.icon }}</v-icon>
                        <span>{{ $t(tab.label) }}</span>
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="tab-content">
                    <PropertySchemaStudio v-if="activeTab === 'schemas'" />
                    <DataFreezeManager v-if="activeTab === 'freeze'" />
                    <RecycleBin v-if="activeTab === 'recycle'" />
                    <SystemOperations v-if="activeTab === 'sysops'" />
                    <KpiTargetManager v-if="activeTab === 'kpi'" />
                    <AuditTrail v-if="activeTab === 'audit'" />
                </div>
            </template>
        </div>
    </v-container>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { authClaimsState } from '@/utils/authClaims';
import PropertySchemaStudio from './tabs/PropertySchemaStudio.vue';
import DataFreezeManager from './tabs/DataFreezeManager.vue';
import RecycleBin from './tabs/RecycleBin.vue';
import SystemOperations from './tabs/SystemOperations.vue';
import KpiTargetManager from './tabs/KpiTargetManager.vue';
import AuditTrail from './tabs/AuditTrail.vue';

export default defineComponent({
    name: 'AdminConsole',
    components: {
        PropertySchemaStudio,
        DataFreezeManager,
        RecycleBin,
        SystemOperations,
        KpiTargetManager,
        AuditTrail
    },
    setup() {
        const activeTab = ref('schemas');
        const initialLoading = ref(false);

        const isAdmin = computed(() => {
            return authClaimsState.isAdmin;
        });

        const tabs = [
            { value: 'schemas', label: 'adminConsole.tabSchemas', icon: 'mdi-form-select' },
            { value: 'freeze', label: 'adminConsole.tabFreeze', icon: 'mdi-lock-outline' },
            { value: 'recycle', label: 'adminConsole.tabRecycle', icon: 'mdi-delete-restore' },
            { value: 'sysops', label: 'adminConsole.tabSysOps', icon: 'mdi-cog-outline' },
            { value: 'kpi', label: 'adminConsole.tabKpi', icon: 'mdi-target' },
            { value: 'audit', label: 'adminConsole.tabAudit', icon: 'mdi-clipboard-text-clock-outline' }
        ];

        return {
            activeTab,
            initialLoading,
            isAdmin,
            tabs
        };
    }
});
</script>

<style scoped>
.admin-console-page {
    padding: 24px;
    background: #f8fafc;
    min-height: 100vh;
}

.no-access {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    gap: 16px;
    color: #6b7280;
}

.no-access h3 {
    font-size: 18px;
    color: #374151;
}

.admin-container {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
}

.admin-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
}

.header-icon {
    color: #3b82f6;
    font-size: 24px;
}

.header-title {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
}

.header-desc {
    font-size: 13px;
    color: #6b7280;
    margin-top: 2px;
}

.loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
}

.loading-text {
    font-size: 14px;
    color: #6b7280;
}

.flat-tabs {
    display: flex;
    gap: 0;
    padding: 0 24px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    overflow-x: auto;
}

.flat-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 20px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
    transition: all 0.15s ease;
    white-space: nowrap;
}

.flat-tab:hover {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.04);
}

.flat-tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: #ffffff;
}

.flat-tab .v-icon {
    opacity: 0.7;
}

.flat-tab.active .v-icon {
    opacity: 1;
}

.tab-content {
    padding: 0;
    background: #ffffff;
}
</style>
