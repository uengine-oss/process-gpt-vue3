<template>
    <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-4">
            {{ $t('taskCatalog.systemsDescription') }}
        </v-alert>

        <div class="d-flex justify-end mb-4">
            <v-btn
                color="primary"
                @click="openDialog()"
            >
                <v-icon start>mdi-plus</v-icon>
                {{ $t('taskCatalog.addSystem') }}
            </v-btn>
        </div>

        <v-data-table
            :headers="headers"
            :items="sortedSystems"
            :loading="loading"
            class="elevation-1"
        >
            <template v-slot:item.actions="{ item }">
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
            </template>

            <template v-slot:no-data>
                <v-alert type="info" variant="tonal">
                    {{ $t('taskCatalog.noSystems') }}
                </v-alert>
            </template>
        </v-data-table>

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
    </v-card-text>
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
