<template>
    <v-container fluid>
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-folder-cog</v-icon>
                {{ $t('taskCatalog.title') }}
            </v-card-title>

            <!-- 로딩 중 -->
            <template v-if="initialLoading">
                <v-card-text class="text-center py-8">
                    <v-progress-circular indeterminate color="primary" size="48" />
                    <div class="mt-4 text-body-1">{{ $t('common.loading') || 'Loading...' }}</div>
                </v-card-text>
            </template>

            <!-- 로딩 완료 -->
            <template v-else>
                <v-tabs v-model="activeTab" bg-color="primary">
                    <v-tab value="taskTypes">
                        <v-icon start>mdi-checkbox-marked-outline</v-icon>
                        {{ $t('taskCatalog.taskTypes') }}
                    </v-tab>
                    <v-tab value="systems">
                        <v-icon start>mdi-server</v-icon>
                        {{ $t('taskCatalog.systems') }}
                    </v-tab>
                    <v-tab value="schemas">
                        <v-icon start>mdi-form-select</v-icon>
                        {{ $t('taskCatalog.propertySchemas') }}
                    </v-tab>
                    <v-tab value="catalog">
                        <v-icon start>mdi-view-grid</v-icon>
                        {{ $t('taskCatalog.catalog') }}
                    </v-tab>
                </v-tabs>

                <v-window v-model="activeTab">
                    <v-window-item value="taskTypes">
                        <TaskTypeSettings />
                    </v-window-item>

                    <v-window-item value="systems">
                        <SystemManager />
                    </v-window-item>

                    <v-window-item value="schemas">
                        <PropertySchemaManager />
                    </v-window-item>

                    <v-window-item value="catalog">
                        <TaskCatalogList />
                    </v-window-item>
                </v-window>
            </template>
        </v-card>
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
            initialLoading
        };
    }
});
</script>

<style scoped>
.v-card-title {
    font-size: 1.25rem;
    font-weight: 500;
}
</style>
