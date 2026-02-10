<template>
    <v-container fluid class="pa-0">
        <div class="pa-0">
            <!-- 로딩 중 -->
            <template v-if="initialLoading">
                <div class="d-flex flex-column align-center justify-center pa-8">
                    <v-progress-circular indeterminate color="primary" size="40" width="3" />
                    <span class="text-body-1 text-grey mt-4">{{ $t('common.loading') || 'Loading...' }}</span>
                </div>
            </template>

            <!-- 로딩 완료 -->
            <template v-else>
                <!-- Tabs -->
                <v-tabs v-model="activeTab" color="primary"
                    :direction="isMobile ? 'vertical' : 'horizontal'"
                    class="pa-0"
                >
                    <v-tab v-for="tab in tabs" :key="tab.value" :value="tab.value">
                        <v-icon size="18" class="mr-2">{{ tab.icon }}</v-icon>
                        <span>{{ $t(tab.label) }}</span>
                    </v-tab>
                </v-tabs>

                <v-divider />

                <!-- Tab Content -->
                <v-card-text class="pa-4">
                    <TaskTypeSettings v-if="activeTab === 'taskTypes'" />
                    <SystemManager v-if="activeTab === 'systems'" />
                    <PropertySchemaManager v-if="activeTab === 'schemas'" />
                    <TaskCatalogList v-if="activeTab === 'catalog'" />
                </v-card-text>
            </template>
        </div>
    </v-container>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
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

        const isMobile = computed(() => window.innerWidth <= 768);

        const tabs = [
            { value: 'taskTypes', label: 'taskCatalog.taskTypes', icon: 'mdi-checkbox-marked-outline' },
            { value: 'systems', label: 'taskCatalog.systems', icon: 'mdi-server' },
            { value: 'schemas', label: 'taskCatalog.propertySchemas', icon: 'mdi-form-select' },
            { value: 'catalog', label: 'taskCatalog.catalog', icon: 'mdi-view-grid' }
        ];

        onMounted(async () => {
            try {
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
            tabs,
            isMobile
        };
    }
});
</script>

<style scoped>
/* 추가 스타일 필요 시 여기에 작성 */
</style>
