<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="700">
        <v-card>
            <v-card-title>
                {{ item ? $t('taskCatalog.editTask') : $t('taskCatalog.addTask') }}
            </v-card-title>

            <v-card-text>
                <v-form ref="formRef" v-model="formValid">
                    <v-row>
                        <v-col cols="12" md="6">
                            <v-text-field
                                v-model="formData.name"
                                :label="$t('taskCatalog.taskName')"
                                :rules="[v => !!v || $t('taskCatalog.required')]"
                                required
                            />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="formData.system_name"
                                :items="store.systems"
                                :label="$t('taskCatalog.system')"
                                item-title="name"
                                item-value="name"
                                :rules="[v => !!v || $t('taskCatalog.required')]"
                                required
                            >
                                <template v-slot:no-data>
                                    <v-list-item>
                                        <v-list-item-title>
                                            {{ $t('taskCatalog.noSystemsHint') }}
                                        </v-list-item-title>
                                    </v-list-item>
                                </template>
                            </v-select>
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="formData.task_type"
                                :items="availableTaskTypes"
                                :label="$t('taskCatalog.taskType')"
                                item-title="label"
                                item-value="value"
                                :rules="[v => !!v || $t('taskCatalog.required')]"
                                required
                            />
                        </v-col>
                        <v-col cols="12" md="6">
                            <v-select
                                v-model="formData.level"
                                :items="levels"
                                :label="$t('taskCatalog.level')"
                                clearable
                            />
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12">
                            <v-textarea
                                v-model="formData.description"
                                :label="$t('taskCatalog.description')"
                                rows="2"
                            />
                        </v-col>
                    </v-row>

                    <!-- Dynamic Properties based on Schema -->
                    <v-divider class="my-4" />
                    <v-label class="mb-2">{{ $t('taskCatalog.properties') }}</v-label>

                    <div v-if="propertySchemas.length > 0">
                        <v-row v-for="schema in propertySchemas" :key="schema.id">
                            <v-col cols="12">
                                <!-- String type -->
                                <v-text-field
                                    v-if="schema.property_type === 'string'"
                                    v-model="formData.properties[schema.property_key]"
                                    :label="schema.property_label + (schema.is_mandatory ? ' *' : '')"
                                    :rules="schema.is_mandatory ? [v => !!v || $t('taskCatalog.required')] : []"
                                />

                                <!-- Number type -->
                                <v-text-field
                                    v-else-if="schema.property_type === 'number'"
                                    v-model.number="formData.properties[schema.property_key]"
                                    :label="schema.property_label + (schema.is_mandatory ? ' *' : '')"
                                    type="number"
                                    :rules="schema.is_mandatory ? [v => v !== null && v !== undefined || $t('taskCatalog.required')] : []"
                                />

                                <!-- Boolean type -->
                                <v-switch
                                    v-else-if="schema.property_type === 'boolean'"
                                    v-model="formData.properties[schema.property_key]"
                                    :label="schema.property_label"
                                    color="primary"
                                />

                                <!-- Select type -->
                                <v-select
                                    v-else-if="schema.property_type === 'select'"
                                    v-model="formData.properties[schema.property_key]"
                                    :items="schema.options || []"
                                    :label="schema.property_label + (schema.is_mandatory ? ' *' : '')"
                                    item-title="label"
                                    item-value="value"
                                    :rules="schema.is_mandatory ? [v => !!v || $t('taskCatalog.required')] : []"
                                />

                                <!-- Textarea type -->
                                <v-textarea
                                    v-else-if="schema.property_type === 'textarea'"
                                    v-model="formData.properties[schema.property_key]"
                                    :label="schema.property_label + (schema.is_mandatory ? ' *' : '')"
                                    rows="2"
                                    :rules="schema.is_mandatory ? [v => !!v || $t('taskCatalog.required')] : []"
                                />
                            </v-col>
                        </v-row>
                    </div>
                    <v-alert v-else type="info" variant="tonal" density="compact">
                        {{ $t('taskCatalog.noPropertiesSchema') }}
                    </v-alert>
                </v-form>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn
                    variant="text"
                    @click="$emit('update:modelValue', false)"
                >
                    {{ $t('taskCatalog.cancel') }}
                </v-btn>
                <v-btn
                    color="primary"
                    :loading="loading"
                    :disabled="!formValid"
                    @click="save"
                >
                    {{ $t('taskCatalog.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { defineComponent, ref, watch, computed, getCurrentInstance } from 'vue';
import { useTaskCatalogStore, AVAILABLE_TASK_TYPES } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'TaskCatalogDialog',
    props: {
        modelValue: Boolean,
        item: Object
    },
    emits: ['update:modelValue', 'saved'],
    setup(props, { emit }) {
        const { proxy } = getCurrentInstance();
        const locale = computed(() => proxy.$i18n?.locale || 'en');
        const store = useTaskCatalogStore();

        const formRef = ref(null);
        const formValid = ref(false);
        const loading = ref(false);

        const levels = ['L2', 'L3', 'L4', 'L5'];

        const availableTaskTypes = computed(() => {
            return AVAILABLE_TASK_TYPES.map(item => ({
                ...item,
                label: locale.value === 'ko' ? item.labelKo : item.label
            }));
        });

        const defaultFormData = () => ({
            name: '',
            system_name: '',
            task_type: 'bpmn:ManualTask',
            level: null,
            description: '',
            properties: {}
        });

        const formData = ref(defaultFormData());

        const propertySchemas = computed(() => {
            if (!formData.value.task_type) return [];
            return store.schemasByTaskType(formData.value.task_type);
        });

        watch(() => props.modelValue, async (open) => {
            if (open) {
                // Load systems if not loaded
                if (!store.systemsLoaded) {
                    await store.loadSystems();
                }

                if (props.item) {
                    formData.value = {
                        ...props.item,
                        properties: props.item.properties ? { ...props.item.properties } : {}
                    };
                } else {
                    formData.value = defaultFormData();
                }

                // Load schemas for the task type
                if (formData.value.task_type) {
                    await store.loadSchemas(formData.value.task_type);
                }
            }
        });

        watch(() => formData.value.task_type, async (taskType) => {
            if (taskType) {
                await store.loadSchemas(taskType);
            }
        });

        const save = async () => {
            loading.value = true;
            try {
                // Find system_id from system_name
                const system = store.systems.find(s => s.name === formData.value.system_name);

                await store.saveCatalogItem({
                    ...formData.value,
                    id: props.item?.id,
                    system_id: system?.id
                });
                emit('saved');
            } catch (error) {
                console.error('Failed to save catalog item:', error);
            } finally {
                loading.value = false;
            }
        };

        return {
            store,
            formRef,
            formValid,
            loading,
            formData,
            levels,
            availableTaskTypes,
            propertySchemas,
            save
        };
    }
});
</script>
