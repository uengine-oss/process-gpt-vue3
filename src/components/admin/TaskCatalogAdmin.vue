<template>
    <v-container fluid class="task-catalog-admin">
        <div class="admin-container">
            <!-- Header -->
            <div class="admin-header">
                <v-icon class="header-icon">mdi-folder-cog</v-icon>
                <span class="header-title">{{ $t('taskCatalog.title') }}</span>
            </div>

            <!-- 로딩 중 -->
            <template v-if="initialLoading">
                <div class="loading-container">
                    <v-progress-circular indeterminate color="primary" size="40" width="3" />
                    <span class="loading-text">{{ $t('common.loading') || 'Loading...' }}</span>
                </div>
            </template>

            <!-- 로딩 완료 -->
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
                    <TaskTypeSettings v-if="activeTab === 'taskTypes'" />
                    <SystemManager v-if="activeTab === 'systems'" />
                    <PropertySchemaManager v-if="activeTab === 'schemas'" />
                    <TaskCatalogList v-if="activeTab === 'catalog'" />
                </div>
            </template>
        </div>
    </v-container>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue';
import { useTaskCatalogStore } from '@/stores/taskCatalog';
import TaskTypeSettings from './TaskTypeSettings.vue';
import SystemManager from './SystemManager.vue';
import PropertySchemaManager from './PropertySchemaManager.vue';
import TaskCatalogList from './TaskCatalogList.vue';

export default defineComponent({
    name: 'TaskCatalogAdmin',
    components: {
        TaskTypeSettings,
        SystemManager,
        PropertySchemaManager,
        TaskCatalogList
    },
    setup() {
        const activeTab = ref('taskTypes');
        const initialLoading = ref(true);
        const store = useTaskCatalogStore();

        const tabs = [
            { value: 'taskTypes', label: 'taskCatalog.taskTypes', icon: 'mdi-checkbox-marked-outline' },
            { value: 'systems', label: 'taskCatalog.systems', icon: 'mdi-server' },
            { value: 'schemas', label: 'taskCatalog.propertySchemas', icon: 'mdi-form-select' },
            { value: 'catalog', label: 'taskCatalog.catalog', icon: 'mdi-view-grid' }
        ];

        onMounted(async () => {
            try {
                // Load all data
                await Promise.all([
                    store.loadPaletteSettings(),
                    store.loadSystems(),
                    store.loadSchemas(),
                    store.loadCatalog()
                ]);
            } catch (error) {
                console.error('Failed to load task catalog data:', error);
            } finally {
                initialLoading.value = false;
            }
        });

        return {
            activeTab,
            initialLoading,
            tabs
        };
    }
});
</script>

<style scoped>
.task-catalog-admin {
    padding: 24px;
    background: #f8fafc;
    min-height: 100vh;
}

.admin-container {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
}

/* Header */
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

/* Loading */
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

/* Flat Tabs */
.flat-tabs {
    display: flex;
    gap: 0;
    padding: 0 24px;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
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

/* Tab Content */
.tab-content {
    padding: 0;
    background: #ffffff;
}
</style>
