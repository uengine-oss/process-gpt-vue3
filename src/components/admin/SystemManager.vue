<template>
    <div>
        <!-- Info Banner -->
        <v-alert dense outlined type="info" color="gray" class="pa-4 pt-2 pb-2">
            <v-row class="ma-0 pa-0">
                <span class="text-body-1">{{ $t('taskCatalog.systemsDescription') }}</span>
            </v-row>
        </v-alert>

        <!-- Header with Add Button -->
        <div class="d-flex align-center pa-0 pt-4 pb-4">
            <v-spacer />
            <v-btn color="primary" rounded variant="flat" @click="openDialog()">
                <v-icon size="16" class="mr-1">mdi-plus</v-icon>
                {{ $t('taskCatalog.addSystem') }}
            </v-btn>
        </div>

        <!-- Table -->
        <v-card class="pa-0" variant="outlined">
            <v-table density="comfortable">
                <thead>
                    <tr>
                        <th>{{ $t('taskCatalog.systemName') }}</th>
                        <th>{{ $t('taskCatalog.description') }}</th>
                        <th style="width: 100px;">{{ $t('taskCatalog.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="3" class="text-center pa-8">
                            <v-progress-circular indeterminate size="32" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="sortedSystems.length === 0">
                        <td colspan="3" class="text-center pa-8 text-medium-emphasis">
                            {{ $t('taskCatalog.noSystems') }}
                        </td>
                    </tr>
                    <tr v-else v-for="item in sortedSystems" :key="item.id">
                        <td>
                            <div class="d-flex align-center">
                                <v-icon size="16" class="mr-2" color="grey">mdi-server</v-icon>
                                {{ item.name }}
                            </div>
                        </td>
                        <td class="text-medium-emphasis">{{ item.description || '-' }}</td>
                        <td class="text-right">
                            <v-btn variant="text" density="compact" icon @click="openDialog(item)">
                                <v-icon size="16">mdi-pencil</v-icon>
                            </v-btn>
                            <v-btn variant="text" density="compact" icon color="error" @click="confirmDelete(item)">
                                <v-icon size="16">mdi-delete</v-icon>
                            </v-btn>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>

        <!-- Add/Edit Dialog -->
        <v-dialog v-model="dialogOpen" max-width="500" persistent>
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    <div class="d-flex align-center">
                        {{ editingSystem ? $t('taskCatalog.editSystem') : $t('taskCatalog.addSystem') }}
                    </div>
                    <v-btn variant="text" density="compact" icon @click="dialogOpen = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pa-4 pb-0">
                    <v-form ref="formRef" v-model="formValid">
                        <v-text-field
                            v-model="formData.name"
                            :label="$t('taskCatalog.systemName')"
                            :rules="[v => !!v || $t('taskCatalog.required')]"
                            variant="outlined"
                            required
                        />

                        <v-textarea
                            v-model="formData.description"
                            :label="$t('taskCatalog.description')"
                            variant="outlined"
                            rows="3"
                        />
                    </v-form>
                </v-card-text>

                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn
                        variant="text"
                        @click="dialogOpen = false"
                    >
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn
                        color="primary"
                        rounded
                        variant="flat"
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
        <v-dialog v-model="deleteDialogOpen" max-width="400" persistent>
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    <div class="d-flex align-center">
                        {{ $t('taskCatalog.confirmDelete') }}
                    </div>
                    <v-btn variant="text" density="compact" icon @click="deleteDialogOpen = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pa-4">
                    {{ $t('taskCatalog.deleteSystemConfirm', { name: deletingSystem?.name }) }}
                </v-card-text>

                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn
                        variant="text"
                        @click="deleteDialogOpen = false"
                    >
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn
                        color="error"
                        rounded
                        variant="flat"
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
</style>
