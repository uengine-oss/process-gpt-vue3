<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :fullscreen="isMobile" :max-width="isMobile ? '100%' : '700px'" persistent>
        <v-card>
            <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                {{ item ? $t('taskCatalog.editTask') : $t('taskCatalog.addTask') }}
                <v-btn variant="text" density="compact" icon @click="$emit('update:modelValue', false)">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="pa-4 pb-0" style="overflow: auto;">
                <v-form ref="formRef" v-model="formValid">
                    <v-row class="ma-0 pa-0">
                        <v-col cols="12" md="6" class="pa-0">
                            <v-text-field
                                v-model="formData.name"
                                :label="$t('taskCatalog.taskName')"
                                :rules="[v => !!v || $t('taskCatalog.required')]"
                                required
                            />
                        </v-col>
                        <v-col cols="12" md="6" class="pa-0">
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

                    <v-row class="ma-0 pa-0">
                        <v-col cols="12" md="6" class="pa-0">
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
                        <v-col cols="12" md="6" class="pa-0">
                            <v-select
                                v-model="formData.level"
                                :items="levels"
                                :label="$t('taskCatalog.level')"
                                clearable
                            />
                        </v-col>
                    </v-row>

                    <v-row class="ma-0 pa-0">
                        <v-col cols="12" class="pa-0">
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
                        <v-row v-for="schema in propertySchemas" :key="schema.id" class="ma-0 pa-0">
                            <v-col cols="12" class="pa-0">
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
                    <v-alert v-else dense outlined type="info" color="gray" class="pa-4 pt-2 pb-2">
                        <span class="text-body-1">{{ $t('taskCatalog.noPropertiesSchema') }}</span>
                    </v-alert>
                </v-form>
            </v-card-text>

            <v-card-actions class="d-flex justify-end align-center pa-4">
                <v-btn
                    color="primary"
                    rounded
                    variant="flat"
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

        const isMobile = computed(() => window.innerWidth <= 768);
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
            isMobile,
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
