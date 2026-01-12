<template>
    <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-4">
            {{ $t('taskCatalog.catalogDescription') }}
        </v-alert>

        <v-row class="mb-4">
            <v-col cols="12" md="4">
                <v-text-field
                    v-model="searchQuery"
                    :label="$t('taskCatalog.search')"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    hide-details
                />
            </v-col>
            <v-col cols="12" md="3">
                <v-select
                    v-model="filterTaskType"
                    :items="availableTaskTypes"
                    :label="$t('taskCatalog.filterByTaskType')"
                    item-title="label"
                    item-value="value"
                    clearable
                    hide-details
                />
            </v-col>
            <v-col cols="12" md="3">
                <v-select
                    v-model="filterSystem"
                    :items="systems"
                    :label="$t('taskCatalog.filterBySystem')"
                    item-title="name"
                    item-value="name"
                    clearable
                    hide-details
                />
            </v-col>
            <v-col cols="12" md="2" class="d-flex align-center justify-end">
                <v-btn
                    color="primary"
                    @click="openDialog()"
                >
                    <v-icon start>mdi-plus</v-icon>
                    {{ $t('taskCatalog.addTask') }}
                </v-btn>
            </v-col>
        </v-row>

        <v-row>
            <v-col
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

                    <div class="task-tags">
                        <span class="tag tag-system">{{ item.system_name }}</span>
                        <span class="tag tag-type">{{ getTaskTypeLabel(item.task_type) }}</span>
                    </div>

                    <div v-if="item.description" class="task-description">
                        {{ item.description }}
                    </div>

                    <div class="task-actions">
                        <button class="action-btn action-edit" @click="openDialog(item)">
                            <v-icon size="16">mdi-pencil</v-icon>
                        </button>
                        <button class="action-btn action-delete" @click="confirmDelete(item)">
                            <v-icon size="16">mdi-delete</v-icon>
                        </button>
                    </div>
                </div>
            </v-col>
        </v-row>

        <v-alert v-if="filteredItems.length === 0" type="info" variant="tonal" class="mt-4">
            {{ $t('taskCatalog.noCatalogItems') }}
        </v-alert>

        <!-- Add/Edit Dialog -->
        <TaskCatalogDialog
            v-model="dialogOpen"
            :item="editingItem"
            @saved="onItemSaved"
        />

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialogOpen" max-width="400">
            <v-card>
                <v-card-title>
                    {{ $t('taskCatalog.confirmDelete') }}
                </v-card-title>

                <v-card-text>
                    {{ $t('taskCatalog.deleteCatalogConfirm', { name: deletingItem?.display_name }) }}
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn
                        variant="text"
                        @click="deleteDialogOpen = false"
                    >
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn
                        color="error"
                        :loading="loading"
                        @click="deleteItem"
                    >
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

/* Tags */
.task-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
}

.tag-system {
    background-color: #f3f4f6;
    color: #4b5563;
    border: 1px solid #e5e7eb;
}

.tag-type {
    background-color: #eff6ff;
    color: #3b82f6;
    border: 1px solid #dbeafe;
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

.action-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
}

.action-btn:hover {
    background-color: #f3f4f6;
}

.action-edit {
    color: #6b7280;
}

.action-edit:hover {
    color: #3b82f6;
    background-color: #eff6ff;
}

.action-delete {
    color: #9ca3af;
}

.action-delete:hover {
    color: #ef4444;
    background-color: #fef2f2;
}
</style>
