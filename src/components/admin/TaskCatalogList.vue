<template>
    <v-card-text class="pa-0">
        <!-- [BLOCK:alert.info.v1] -->
        <v-alert dense outlined type="info" color="gray" class="mb-4 pa-4 pt-2 pb-2">
            <span class="text-body-1">{{ $t('taskCatalog.catalogDescription') }}</span>
        </v-alert>

        <div class="d-flex align-center flex-wrap ga-3 mb-4">
            <!-- [BLOCK:field.search.v1] -->
            <div class="d-flex align-center border border-borderColor header-search rounded-pill px-5"
                style="max-width: 246px; min-width: 160px;"
            >
                <Icons :icon="'magnifer-linear'" :size="20" />
                <v-text-field
                    v-model="searchQuery"
                    variant="plain"
                    density="compact"
                    class="position-relative pt-0 ml-3 custom-placeholer-color"
                    :placeholder="$t('taskCatalog.search')"
                    single-line
                    hide-details
                />
            </div>
            <!-- [BLOCK:field.select.v1] -->
            <v-select
                v-model="filterTaskType"
                :items="availableTaskTypes"
                :label="$t('taskCatalog.filterByTaskType')"
                item-title="label"
                item-value="value"
                clearable
                variant="outlined"
                density="compact"
                hide-details
                class="flex-grow-0"
                style="min-width: 180px;"
            />
            <!-- [BLOCK:field.select.v1] -->
            <v-select
                v-model="filterSystem"
                :items="systems"
                :label="$t('taskCatalog.filterBySystem')"
                item-title="name"
                item-value="name"
                clearable
                variant="outlined"
                density="compact"
                hide-details
                class="flex-grow-0"
                style="min-width: 180px;"
            />
            <v-spacer />
            <!-- [BLOCK:button.primary.v1] -->
            <v-btn color="primary" rounded variant="flat" @click="openDialog()">
                <v-icon start>mdi-plus</v-icon>
                {{ $t('taskCatalog.addTask') }}
            </v-btn>
        </div>

        <v-row class="ma-0 pa-0">
            <v-col class="pa-0"
                v-for="item in filteredItems"
                :key="item.id"
                cols="12"
                md="4"
                lg="3"
            >
                <div
                    class="task-card"
                    draggable="true"
                    @dragstart="onDragStart($event, item)"
                >
                    <div class="task-card-header">
                        <div class="task-icon" :style="{ backgroundColor: getTaskTypeColor(item.task_type) }">
                            <v-icon size="18" color="white">
                                {{ getTaskTypeIcon(item.task_type) }}
                            </v-icon>
                        </div>
                        <span class="task-name">{{ item.name }}</span>
                    </div>

                    <div class="d-flex flex-wrap ga-1 mb-2">
                        <v-chip size="small" variant="tonal">{{ item.system_name }}</v-chip>
                        <v-chip size="small" variant="tonal" color="primary">{{ getTaskTypeLabel(item.task_type) }}</v-chip>
                    </div>

                    <div v-if="item.description" class="task-description">
                        {{ item.description }}
                    </div>

                    <div class="task-actions">
                        <!-- [BLOCK:button.icon.v1] -->
                        <v-btn variant="text" density="compact" icon @click="openDialog(item)">
                            <v-icon size="16">mdi-pencil</v-icon>
                        </v-btn>
                        <v-btn variant="text" density="compact" icon color="error" @click="confirmDelete(item)">
                            <v-icon size="16">mdi-delete</v-icon>
                        </v-btn>
                    </div>
                </div>
            </v-col>
        </v-row>

        <!-- [BLOCK:alert.info.v1] -->
        <div v-if="filteredItems.length === 0" class="text-center pa-8 text-medium-emphasis">{{ $t('taskCatalog.noCatalogItems') }}</div>

        <!-- Add/Edit Dialog -->
        <TaskCatalogDialog
            v-model="dialogOpen"
            :item="editingItem"
            @saved="onItemSaved"
        />

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialogOpen" max-width="400" persistent>
            <v-card>
                <!-- [BLOCK:dialog.header.v1] -->
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    <div class="d-flex align-center">{{ $t('taskCatalog.confirmDelete') }}</div>
                    <v-btn variant="text" density="compact" icon @click="deleteDialogOpen = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pa-4">
                    {{ $t('taskCatalog.deleteCatalogConfirm', { name: deletingItem?.display_name }) }}
                </v-card-text>

                <!-- [BLOCK:dialog.footer.v1] -->
                <v-card-actions class="d-flex justify-end align-center pa-4 pt-0">
                    <v-btn variant="text" @click="deleteDialogOpen = false">
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn color="error" rounded variant="flat" :loading="loading" @click="deleteItem">
                        {{ $t('taskCatalog.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card-text>
</template>

<script>
import { defineComponent, ref, computed, onMounted, getCurrentInstance } from 'vue';
import { useTaskCatalogStore, AVAILABLE_TASK_TYPES } from '@/stores/taskCatalog';
import TaskCatalogDialog from './TaskCatalogDialog.vue';

export default defineComponent({
    name: 'TaskCatalogList',
    components: {
        TaskCatalogDialog
    },
    setup() {
        const { proxy } = getCurrentInstance();
        const locale = computed(() => proxy.$i18n?.locale || 'en');
        const store = useTaskCatalogStore();

        const loading = computed(() => store?.loading || false);
        const systems = computed(() => store?.systems || []);
        const catalogItems = computed(() => store?.catalogItems || []);

        // Load data when component mounts
        onMounted(async () => {
            console.log('TaskCatalogList mounted, loading data...');
            try {
                if (!store.systemsLoaded) {
                    await store.loadSystems();
                }
                // Always reload catalog to get fresh data
                await store.loadCatalog();
                console.log('TaskCatalogList - catalogItems:', store.catalogItems);
            } catch (error) {
                console.error('TaskCatalogList - Failed to load data:', error);
            }
        });

        const searchQuery = ref('');
        const filterTaskType = ref(null);
        const filterSystem = ref(null);
        const dialogOpen = ref(false);
        const deleteDialogOpen = ref(false);
        const editingItem = ref(null);
        const deletingItem = ref(null);

        const availableTaskTypes = computed(() => {
            return AVAILABLE_TASK_TYPES.map(t => ({
                ...t,
                label: locale.value === 'ko' ? t.labelKo : t.label
            }));
        });

        const filteredItems = computed(() => {
            let items = catalogItems.value || [];

            if (searchQuery.value) {
                const query = searchQuery.value.toLowerCase();
                items = items.filter(item =>
                    (item.display_name && item.display_name.toLowerCase().includes(query)) ||
                    (item.name && item.name.toLowerCase().includes(query)) ||
                    (item.description && item.description.toLowerCase().includes(query))
                );
            }

            if (filterTaskType.value) {
                items = items.filter(item => item.task_type === filterTaskType.value);
            }

            if (filterSystem.value) {
                items = items.filter(item => item.system_name === filterSystem.value);
            }

            return items;
        });

        const getTaskTypeIcon = (taskType) => {
            const icons = {
                'bpmn:ManualTask': 'mdi-hand-back-right',
                'bpmn:ServiceTask': 'mdi-cog',
                'bpmn:UserTask': 'mdi-account',
                'bpmn:ScriptTask': 'mdi-script-text',
                'bpmn:BusinessRuleTask': 'mdi-table',
                'bpmn:SendTask': 'mdi-send',
                'bpmn:ReceiveTask': 'mdi-inbox'
            };
            return icons[taskType] || 'mdi-checkbox-blank';
        };

        const getTaskTypeColor = (taskType) => {
            const colors = {
                'bpmn:ManualTask': '#FF9800',
                'bpmn:UserTask': '#2196F3',
                'bpmn:ServiceTask': '#4CAF50',
                'bpmn:ScriptTask': '#9C27B0',
                'bpmn:BusinessRuleTask': '#795548',
                'bpmn:SendTask': '#00BCD4',
                'bpmn:ReceiveTask': '#607D8B',
                'bpmn:Task': '#9E9E9E'
            };
            return colors[taskType] || '#9E9E9E';
        };

        const getTaskTypeLabel = (taskType) => {
            const type = AVAILABLE_TASK_TYPES.find(t => t.value === taskType);
            if (type) {
                return locale.value === 'ko' ? type.labelKo : type.label;
            }
            return taskType.replace('bpmn:', '');
        };

        const openDialog = (item = null) => {
            editingItem.value = item;
            dialogOpen.value = true;
        };

        const onItemSaved = () => {
            dialogOpen.value = false;
            store.loadCatalog();
        };

        const confirmDelete = (item) => {
            deletingItem.value = item;
            deleteDialogOpen.value = true;
        };

        const deleteItem = async () => {
            try {
                await store.deleteCatalogItem(deletingItem.value.id);
                deleteDialogOpen.value = false;
            } catch (error) {
                console.error('Failed to delete catalog item:', error);
            }
        };

        const onDragStart = (event, item) => {
            event.dataTransfer.setData('application/json', JSON.stringify({
                type: 'task-catalog',
                item: item
            }));
            event.dataTransfer.effectAllowed = 'copy';
        };

        return {
            store,
            loading,
            systems,
            searchQuery,
            filterTaskType,
            filterSystem,
            availableTaskTypes,
            filteredItems,
            dialogOpen,
            deleteDialogOpen,
            editingItem,
            deletingItem,
            getTaskTypeIcon,
            getTaskTypeColor,
            getTaskTypeLabel,
            openDialog,
            onItemSaved,
            confirmDelete,
            deleteItem,
            onDragStart
        };
    }
});
</script>

<style scoped>
/* Task Card - Flat Design */
.task-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    cursor: grab;
    transition: border-color 0.2s ease, background-color 0.2s ease;
    position: relative;
    min-height: 120px;
    display: flex;
    flex-direction: column;
}

.task-card:hover {
    border-color: #3b82f6;
    background-color: #fafbfc;
}

.task-card:active {
    cursor: grabbing;
}

/* Card Header */
.task-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.task-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.task-name {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* Description */
.task-description {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.4;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* Actions */
.task-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid #f3f4f6;
}
</style>
