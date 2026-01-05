<template>
    <v-dialog v-model="dialogOpen" max-width="500" persistent>
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon class="mr-2">mdi-folder-plus</v-icon>
                {{ $t('taskCatalog.saveToCatalog') || 'Save to Catalog' }}
            </v-card-title>

            <v-card-text>
                <v-alert v-if="existingItem" type="warning" variant="tonal" class="mb-4" density="compact">
                    {{ $t('taskCatalog.taskExistsWarning') || '동일한 이름과 시스템의 Task가 이미 존재합니다. 저장하면 업데이트됩니다.' }}
                </v-alert>

                <v-form ref="formRef" v-model="formValid">
                    <!-- Task Name - readonly, from element -->
                    <v-text-field
                        v-model="formData.name"
                        :label="$t('taskCatalog.taskName') || 'Task Name'"
                        readonly
                        disabled
                        class="mb-2"
                        variant="outlined"
                        bg-color="grey-lighten-4"
                    />

                    <!-- Task Type - readonly, from element -->
                    <v-text-field
                        v-model="formData.task_type"
                        :label="$t('taskCatalog.taskType') || 'Task Type'"
                        readonly
                        disabled
                        class="mb-2"
                        variant="outlined"
                        bg-color="grey-lighten-4"
                    />

                    <v-select
                        v-model="formData.system_name"
                        :items="systems"
                        :label="$t('taskCatalog.system') || 'System (OSS)'"
                        item-title="name"
                        item-value="name"
                        :rules="[v => !!v || 'Required']"
                        required
                        class="mb-2"
                    >
                        <template v-slot:append>
                            <v-btn
                                icon
                                size="x-small"
                                variant="text"
                                @click="showNewSystemDialog = true"
                            >
                                <v-icon>mdi-plus</v-icon>
                            </v-btn>
                        </template>
                    </v-select>

                    <v-select
                        v-model="formData.level"
                        :items="['L2', 'L3', 'L4', 'L5']"
                        :label="$t('taskCatalog.level') || 'Level'"
                        clearable
                        class="mb-2"
                    />

                    <v-text-field
                        v-model.number="formData.fte"
                        :label="$t('taskCatalog.fte') || 'FTE'"
                        type="number"
                        step="0.001"
                        class="mb-2"
                    />
                </v-form>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="close">
                    {{ $t('taskCatalog.cancel') || 'Cancel' }}
                </v-btn>
                <v-btn
                    color="primary"
                    :loading="saving"
                    :disabled="!formValid || !formData.name"
                    @click="save"
                >
                    {{ $t('taskCatalog.save') || 'Save' }}
                </v-btn>
            </v-card-actions>
        </v-card>

        <!-- New System Dialog -->
        <v-dialog v-model="showNewSystemDialog" max-width="400">
            <v-card>
                <v-card-title>{{ $t('taskCatalog.addSystem') || 'Add System' }}</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="newSystemName"
                        :label="$t('taskCatalog.systemName') || 'System Name'"
                        autofocus
                    />
                    <v-textarea
                        v-model="newSystemDescription"
                        :label="$t('taskCatalog.description') || 'Description'"
                        rows="2"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="showNewSystemDialog = false">
                        {{ $t('taskCatalog.cancel') || 'Cancel' }}
                    </v-btn>
                    <v-btn color="primary" @click="addNewSystem" :disabled="!newSystemName">
                        {{ $t('taskCatalog.add') || 'Add' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-dialog>
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue';
import { useTaskCatalogStore } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'SaveToCatalogDialog',
    props: {
        modelValue: Boolean,
        element: Object  // BPMN element to save
    },
    emits: ['update:modelValue', 'saved'],
    setup(props, { emit }) {
        const store = useTaskCatalogStore();

        const dialogOpen = computed({
            get: () => props.modelValue,
            set: (val) => emit('update:modelValue', val)
        });

        const formRef = ref(null);
        const formValid = ref(false);
        const saving = ref(false);
        const showNewSystemDialog = ref(false);
        const newSystemName = ref('');
        const newSystemDescription = ref('');

        const systems = computed(() => store.systems);

        const formData = ref({
            name: '',
            system_name: '',
            level: null,
            fte: null,
            task_type: ''
        });

        // Store full task properties from extension elements
        const taskProperties = ref({});

        // Check if task with same name and system already exists
        const existingItem = computed(() => {
            if (!formData.value.name || !formData.value.system_name) return null;
            return store.catalogItems.find(item =>
                item.name === formData.value.name &&
                item.system_name === formData.value.system_name
            );
        });

        // Initialize form data from BPMN element
        watch(() => props.modelValue, async (open) => {
            if (open && props.element) {
                // Load systems if not loaded
                if (!store.systemsLoaded) {
                    await store.loadSystems();
                }
                if (!store.catalogLoaded) {
                    await store.loadCatalog();
                }

                // element might be a shape (has businessObject) or the businessObject itself
                const bo = props.element.businessObject || props.element;
                // Use $type for BPMN elements (not type)
                const elementType = props.element.$type || props.element.type || bo?.$type || 'bpmn:ManualTask';

                console.log('SaveToCatalog - Element:', props.element);
                console.log('SaveToCatalog - BusinessObject:', bo);
                console.log('SaveToCatalog - ElementType:', elementType);
                console.log('SaveToCatalog - BO Name:', bo?.name);
                console.log('SaveToCatalog - BO ExtensionElements:', bo?.extensionElements);

                // Extract properties from extension elements
                taskProperties.value = {};
                let existingSystemName = '';
                let existingLevel = null;
                let existingFte = null;

                if (bo?.extensionElements?.values) {
                    const uengineProps = bo.extensionElements.values.find(v => v.$type === 'uengine:Properties');
                    if (uengineProps?.json) {
                        try {
                            const parsedProps = JSON.parse(uengineProps.json);
                            console.log('SaveToCatalog - ParsedProps:', parsedProps);
                            // Store ALL task properties for saving
                            taskProperties.value = { ...parsedProps };
                            // Extract catalog-specific fields
                            existingSystemName = parsedProps._systemName || '';
                            existingLevel = parsedProps.level || null;
                            existingFte = parsedProps.fte || null;
                        } catch (e) {
                            console.error('Failed to parse extension properties:', e);
                        }
                    }
                }

                // Set form data - name comes from element and is readonly
                formData.value = {
                    name: bo?.name || '',
                    system_name: existingSystemName,
                    level: existingLevel,
                    fte: existingFte,
                    task_type: elementType
                };

                console.log('SaveToCatalog - FormData:', formData.value);
                console.log('SaveToCatalog - TaskProperties:', taskProperties.value);
            }
        });

        const close = () => {
            dialogOpen.value = false;
        };

        const save = async () => {
            saving.value = true;
            try {
                const system = systems.value.find(s => s.name === formData.value.system_name);

                // Merge all task properties with form data
                // This preserves ALL settings from the original task
                const allProperties = {
                    ...taskProperties.value,
                    fte: formData.value.fte,
                    level: formData.value.level,
                    _systemName: formData.value.system_name
                };
                // Remove internal catalog references to avoid circular data
                delete allProperties._catalogId;

                const catalogItem = {
                    id: existingItem.value?.id,  // Update if exists
                    name: formData.value.name,
                    system_name: formData.value.system_name,
                    system_id: system?.id,
                    display_name: formData.value.name,
                    task_type: formData.value.task_type,
                    level: formData.value.level,
                    properties: allProperties
                };

                console.log('SaveToCatalog - Saving:', catalogItem);

                await store.saveCatalogItem(catalogItem);
                emit('saved', catalogItem);
                close();
            } catch (error) {
                console.error('Failed to save to catalog:', error);
            } finally {
                saving.value = false;
            }
        };

        const addNewSystem = async () => {
            if (!newSystemName.value) return;

            try {
                await store.saveSystem({
                    name: newSystemName.value,
                    description: newSystemDescription.value
                });
                formData.value.system_name = newSystemName.value;
                newSystemName.value = '';
                newSystemDescription.value = '';
                showNewSystemDialog.value = false;
            } catch (error) {
                console.error('Failed to add system:', error);
            }
        };

        return {
            dialogOpen,
            formRef,
            formValid,
            saving,
            formData,
            systems,
            existingItem,
            showNewSystemDialog,
            newSystemName,
            newSystemDescription,
            close,
            save,
            addNewSystem
        };
    }
});
</script>
