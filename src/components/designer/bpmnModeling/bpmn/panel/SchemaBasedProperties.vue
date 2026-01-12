<template>
    <div class="schema-based-properties">
        <div v-if="loading" class="text-center py-4">
            <v-progress-circular indeterminate size="24" />
        </div>

        <div v-else-if="schemas.length === 0" class="text-body-2 text-grey py-2">
            {{ $t('taskCatalog.noPropertiesSchema') || '정의된 속성 스키마가 없습니다.' }}
        </div>

        <div v-else>
            <!-- Render fields grouped by section and row -->
            <template v-for="(section, sectionName) in groupedSchemas" :key="sectionName">
                <!-- Section Header -->
                <div v-if="sectionName !== '__default__'" class="section-header">
                    {{ sectionName }}
                </div>

                <!-- Rows in Section -->
                <template v-for="(row, rowIndex) in section" :key="rowIndex">
                    <v-row class="property-row">
                        <v-col
                            v-for="schema in row"
                            :key="schema.id"
                            :cols="schema.col_span || 12"
                        >
                            <!-- String type -->
                            <v-text-field
                                v-if="schema.property_type === 'string'"
                                v-model="localValues[schema.property_key]"
                                :label="getLabel(schema)"
                                :rules="schema.is_mandatory ? [v => !!v || $t('taskCatalog.required')] : []"
                                :readonly="readonly"
                                :disabled="readonly"
                                density="compact"
                                variant="outlined"
                                @update:model-value="emitUpdate"
                            />

                            <!-- Number type -->
                            <v-text-field
                                v-else-if="schema.property_type === 'number'"
                                v-model.number="localValues[schema.property_key]"
                                :label="getLabel(schema)"
                                :rules="schema.is_mandatory ? [v => v !== null && v !== undefined && v !== '' || $t('taskCatalog.required')] : []"
                                :readonly="readonly"
                                :disabled="readonly"
                                type="number"
                                density="compact"
                                variant="outlined"
                                @update:model-value="emitUpdate"
                            />

                            <!-- Boolean type -->
                            <v-switch
                                v-else-if="schema.property_type === 'boolean'"
                                v-model="localValues[schema.property_key]"
                                :label="getLabel(schema)"
                                :readonly="readonly"
                                :disabled="readonly"
                                color="primary"
                                density="compact"
                                hide-details
                                @update:model-value="emitUpdate"
                            />

                            <!-- Select type -->
                            <v-select
                                v-else-if="schema.property_type === 'select'"
                                v-model="localValues[schema.property_key]"
                                :label="getLabel(schema)"
                                :items="schema.options || []"
                                :rules="schema.is_mandatory ? [v => !!v || $t('taskCatalog.required')] : []"
                                :readonly="readonly"
                                :disabled="readonly"
                                item-title="label"
                                item-value="value"
                                density="compact"
                                variant="outlined"
                                clearable
                                @update:model-value="emitUpdate"
                            />

                            <!-- Textarea type -->
                            <v-textarea
                                v-else-if="schema.property_type === 'textarea'"
                                v-model="localValues[schema.property_key]"
                                :label="getLabel(schema)"
                                :rules="schema.is_mandatory ? [v => !!v || $t('taskCatalog.required')] : []"
                                :readonly="readonly"
                                :disabled="readonly"
                                rows="2"
                                density="compact"
                                variant="outlined"
                                @update:model-value="emitUpdate"
                            />
                        </v-col>
                    </v-row>
                </template>
            </template>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import { useTaskCatalogStore } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'SchemaBasedProperties',
    props: {
        taskType: {
            type: String,
            required: true
        },
        modelValue: {
            type: Object,
            default: () => ({})
        },
        readonly: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        const store = useTaskCatalogStore();
        const loading = ref(false);
        const localValues = ref({});

        const schemas = computed(() => {
            return store.schemasByTaskType(props.taskType) || [];
        });

        const sortedSchemas = computed(() => {
            return [...schemas.value].sort((a, b) =>
                (a.display_order || 0) - (b.display_order || 0)
            );
        });

        // Group schemas by section and row for layout rendering
        const groupedSchemas = computed(() => {
            const schemaList = schemas.value;
            if (!schemaList.length) return {};

            // Group by section
            const sections = {};
            schemaList.forEach(schema => {
                const section = schema.section_name || '__default__';
                if (!sections[section]) {
                    sections[section] = {};
                }
                const rowIdx = schema.row_index ?? schema.display_order ?? 0;
                if (!sections[section][rowIdx]) {
                    sections[section][rowIdx] = [];
                }
                sections[section][rowIdx].push(schema);
            });

            // Sort rows within each section and convert to array
            const result = {};
            Object.keys(sections).sort((a, b) => {
                if (a === '__default__') return -1;
                if (b === '__default__') return 1;
                return a.localeCompare(b);
            }).forEach(sectionName => {
                const rows = sections[sectionName];
                result[sectionName] = Object.keys(rows)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map(rowIdx => rows[rowIdx].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
            });

            return result;
        });

        const getLabel = (schema) => {
            const label = schema.property_label || schema.property_key;
            return schema.is_mandatory ? `${label} *` : label;
        };

        const loadSchemas = async () => {
            if (!props.taskType) return;

            loading.value = true;
            try {
                await store.loadSchemas(props.taskType);
            } catch (error) {
                console.error('Failed to load schemas:', error);
            } finally {
                loading.value = false;
            }
        };

        const initializeValues = () => {
            const values = { ...props.modelValue };

            // Set default values for schemas that don't have values yet
            schemas.value.forEach(schema => {
                if (values[schema.property_key] === undefined) {
                    if (schema.default_value !== undefined && schema.default_value !== '') {
                        // Convert default value to appropriate type
                        if (schema.property_type === 'number') {
                            values[schema.property_key] = Number(schema.default_value);
                        } else if (schema.property_type === 'boolean') {
                            values[schema.property_key] = schema.default_value === 'true';
                        } else {
                            values[schema.property_key] = schema.default_value;
                        }
                    } else if (schema.property_type === 'boolean') {
                        values[schema.property_key] = false;
                    } else {
                        values[schema.property_key] = null;
                    }
                }
            });

            localValues.value = values;
        };

        const emitUpdate = () => {
            emit('update:modelValue', { ...localValues.value });
        };

        // Watch for taskType changes
        watch(() => props.taskType, async (newType) => {
            if (newType) {
                await loadSchemas();
                initializeValues();
            }
        }, { immediate: true });

        // Watch for external modelValue changes
        watch(() => props.modelValue, (newValue) => {
            if (newValue) {
                localValues.value = { ...newValue };
            }
        }, { deep: true });

        // Watch for schemas changes (after loading)
        watch(schemas, () => {
            initializeValues();
        });

        onMounted(async () => {
            if (props.taskType) {
                await loadSchemas();
                initializeValues();
            }
        });

        return {
            loading,
            schemas,
            sortedSchemas,
            groupedSchemas,
            localValues,
            getLabel,
            emitUpdate
        };
    }
});
</script>

<style scoped>
.schema-based-properties {
    padding: 8px 0;
}

.section-header {
    font-size: 13px;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
    margin: 16px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.section-header:first-child {
    margin-top: 0;
}

.property-row {
    margin: 0 -8px 4px -8px;
}

.property-row .v-col {
    padding: 4px 8px;
}
</style>
