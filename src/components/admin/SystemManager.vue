<template>
    <div class="settings-container">
        <!-- Info Banner -->
        <div class="info-banner">
            <v-icon size="18" color="primary">mdi-information-outline</v-icon>
            <span>{{ $t('taskCatalog.systemsDescription') }}</span>
        </div>

        <!-- Header with Add Button -->
        <div class="section-header">
            <span class="section-title">{{ $t('taskCatalog.systems') }}</span>
            <button class="add-btn" @click="openDialog()">
                <v-icon size="16">mdi-plus</v-icon>
                {{ $t('taskCatalog.addSystem') }}
            </button>
        </div>

        <!-- Flat Table -->
        <div class="flat-table-container">
            <table class="flat-table">
                <thead>
                    <tr>
                        <th>{{ $t('taskCatalog.systemName') }}</th>
                        <th>{{ $t('taskCatalog.description') }}</th>
                        <th style="width: 100px; text-align: right;">{{ $t('taskCatalog.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="3" class="loading-cell">
                            <v-progress-circular indeterminate size="24" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="sortedSystems.length === 0">
                        <td colspan="3" class="empty-cell">
                            {{ $t('taskCatalog.noSystems') }}
                        </td>
                    </tr>
                    <tr v-else v-for="item in sortedSystems" :key="item.id">
                        <td class="name-cell">
                            <v-icon size="16" class="mr-2" color="grey">mdi-server</v-icon>
                            {{ item.name }}
                        </td>
                        <td class="desc-cell">{{ item.description || '-' }}</td>
                        <td class="actions-cell">
                            <button class="action-btn action-edit" @click="openDialog(item)">
                                <v-icon size="16">mdi-pencil</v-icon>
                            </button>
                            <button class="action-btn action-delete" @click="confirmDelete(item)">
                                <v-icon size="16">mdi-delete</v-icon>
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Add/Edit Dialog -->
        <v-dialog v-model="dialogOpen" max-width="500">
            <v-card>
                <v-card-title>
                    {{ editingSystem ? $t('taskCatalog.editSystem') : $t('taskCatalog.addSystem') }}
                </v-card-title>

                <v-card-text>
                    <v-form ref="formRef" v-model="formValid">
                        <v-text-field
                            v-model="formData.name"
                            :label="$t('taskCatalog.systemName')"
                            :rules="[v => !!v || $t('taskCatalog.required')]"
                            required
                        />

                        <v-textarea
                            v-model="formData.description"
                            :label="$t('taskCatalog.description')"
                            rows="3"
                        />
                    </v-form>
                </v-card-text>

                <v-card-actions>
                    <v-spacer />
                    <v-btn
                        variant="text"
                        @click="dialogOpen = false"
                    >
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn
                        color="primary"
                        :loading="loading"
                        :disabled="!formValid"
                        @click="saveSystem"
                    >
                        {{ $t('taskCatalog.save') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialogOpen" max-width="400">
            <v-card>
                <v-card-title>
                    {{ $t('taskCatalog.confirmDelete') }}
                </v-card-title>

                <v-card-text>
                    {{ $t('taskCatalog.deleteSystemConfirm', { name: deletingSystem?.name }) }}
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
                        @click="deleteSystem"
                    >
                        {{ $t('taskCatalog.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { defineComponent, ref, computed, getCurrentInstance } from 'vue';
import { useTaskCatalogStore } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'SystemManager',
    setup() {
        const { proxy } = getCurrentInstance();
        const t = (key) => proxy.$t(key);
        const store = useTaskCatalogStore();

        const loading = computed(() => store?.loading || false);
        const sortedSystems = computed(() => store?.sortedSystems || []);

        const dialogOpen = ref(false);
        const deleteDialogOpen = ref(false);
        const formRef = ref(null);
        const formValid = ref(false);
        const editingSystem = ref(null);
        const deletingSystem = ref(null);

        const formData = ref({
            name: '',
            description: ''
        });

        const headers = computed(() => [
            { title: t('taskCatalog.systemName'), key: 'name', sortable: true },
            { title: t('taskCatalog.description'), key: 'description', sortable: false },
            { title: t('taskCatalog.actions'), key: 'actions', sortable: false, align: 'end' }
        ]);

        const openDialog = (system = null) => {
            editingSystem.value = system;
            if (system) {
                formData.value = { ...system };
            } else {
                formData.value = { name: '', description: '' };
            }
            dialogOpen.value = true;
        };

        const saveSystem = async () => {
            try {
                await store.saveSystem({
                    ...formData.value,
                    id: editingSystem.value?.id
                });
                dialogOpen.value = false;
            } catch (error) {
                console.error('Failed to save system:', error);
            }
        };

        const confirmDelete = (system) => {
            deletingSystem.value = system;
            deleteDialogOpen.value = true;
        };

        const deleteSystem = async () => {
            try {
                await store.deleteSystem(deletingSystem.value.id);
                deleteDialogOpen.value = false;
            } catch (error) {
                console.error('Failed to delete system:', error);
            }
        };

        return {
            store,
            loading,
            sortedSystems,
            headers,
            dialogOpen,
            deleteDialogOpen,
            formRef,
            formValid,
            formData,
            editingSystem,
            deletingSystem,
            openDialog,
            saveSystem,
            confirmDelete,
            deleteSystem
        };
    }
});
</script>

<style scoped>
.settings-container {
    padding: 24px;
}

/* Info Banner */
.info-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 13px;
    color: #1e40af;
}

/* Section Header */
.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.section-title {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
}

.add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.add-btn:hover {
    background: #2563eb;
}

/* Flat Table */
.flat-table-container {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}

.flat-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.flat-table thead {
    background: #f9fafb;
}

.flat-table th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
}

.flat-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;
    color: #4b5563;
}

.flat-table tbody tr:last-child td {
    border-bottom: none;
}

.flat-table tbody tr:hover {
    background: #f9fafb;
}

.name-cell {
    font-weight: 500;
    color: #1f2937;
    display: flex;
    align-items: center;
}

.desc-cell {
    color: #6b7280;
}

.actions-cell {
    text-align: right;
    display: flex;
    justify-content: flex-end;
    gap: 4px;
}

.loading-cell,
.empty-cell {
    text-align: center;
    padding: 40px 16px !important;
    color: #9ca3af;
}

/* Action Buttons */
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
