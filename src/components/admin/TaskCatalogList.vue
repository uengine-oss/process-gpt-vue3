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
                <v-card
                    class="task-card"
                    :class="{ draggable: true }"
                    draggable="true"
                    @dragstart="onDragStart($event, item)"
                >
                    <v-card-title class="d-flex align-center">
                        <v-icon class="mr-2" size="small">
                            {{ getTaskTypeIcon(item.task_type) }}
                        </v-icon>
                        <span class="text-truncate">{{ item.name }}</span>
                    </v-card-title>

                    <v-card-subtitle>
                        <v-chip size="x-small" class="mr-1">{{ item.system_name }}</v-chip>
                        <v-chip size="x-small" variant="outlined">{{ getTaskTypeLabel(item.task_type) }}</v-chip>
                    </v-card-subtitle>

                    <v-card-text v-if="item.description" class="text-body-2">
                        {{ item.description }}
                    </v-card-text>

                    <v-card-actions>
                        <v-spacer />
                        <v-btn
                            icon
                            size="small"
                            variant="text"
                            @click="openDialog(item)"
                        >
                            <v-icon>mdi-pencil</v-icon>
                        </v-btn>
                        <v-btn
                            icon
                            size="small"
                            variant="text"
                            color="error"
                            @click="confirmDelete(item)"
                        >
                            <v-icon>mdi-delete</v-icon>
                        </v-btn>
                    </v-card-actions>
                </v-card>
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
.task-card {
    cursor: grab;
    transition: all 0.2s;
}

.task-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.task-card.draggable:active {
    cursor: grabbing;
}
</style>
