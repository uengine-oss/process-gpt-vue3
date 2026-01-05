<template>
    <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-4">
            {{ $t('taskCatalog.schemasDescription') }}
        </v-alert>

        <v-row class="mb-4">
            <v-col cols="12" md="6">
                <v-select
                    v-model="selectedTaskType"
                    :items="availableTaskTypes"
                    :label="$t('taskCatalog.selectTaskType')"
                    item-title="label"
                    item-value="value"
                    clearable
                />
            </v-col>
            <v-col cols="12" md="6" class="d-flex align-center justify-end" style="gap: 8px;">
                <v-btn
                    variant="outlined"
                    :color="showLayoutPreview ? 'primary' : 'grey'"
                    @click="showLayoutPreview = !showLayoutPreview"
                    :disabled="!selectedTaskType || filteredSchemas.length === 0"
                >
                    <v-icon start>mdi-eye</v-icon>
                    {{ $t('taskCatalog.layoutPreview') }}
                </v-btn>
                <v-btn
                    color="primary"
                    @click="openDialog()"
                    :disabled="!selectedTaskType"
                >
                    <v-icon start>mdi-plus</v-icon>
                    {{ $t('taskCatalog.addProperty') }}
                </v-btn>
            </v-col>
        </v-row>

        <!-- Layout Preview Section -->
        <v-expand-transition>
            <div v-show="showLayoutPreview && filteredSchemas.length > 0" class="mb-6">
                <v-card variant="outlined" class="pa-4">
                    <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center">
                        <v-icon start color="primary">mdi-view-dashboard</v-icon>
                        {{ $t('taskCatalog.layoutPreviewTitle') }}
                    </div>
                    <v-divider class="mb-4" />

                    <div class="layout-preview-container">
                        <template v-for="(section, sectionName) in groupedSchemas" :key="sectionName">
                            <!-- Section Header -->
                            <div v-if="sectionName !== '__default__'" class="section-header">
                                {{ sectionName }}
                            </div>

                            <!-- Rows in Section -->
                            <template v-for="(row, rowIndex) in section" :key="rowIndex">
                                <v-row class="preview-row">
                                    <v-col
                                        v-for="schema in row"
                                        :key="schema.id"
                                        :cols="schema.col_span || 12"
                                        class="preview-field"
                                    >
                                        <div class="field-label">
                                            {{ schema.property_label }}
                                            <span v-if="schema.is_mandatory" class="mandatory-indicator">*</span>
                                        </div>
                                        <div class="field-input" :class="schema.property_type">
                                            <template v-if="schema.property_type === 'textarea'">
                                                <div class="mock-textarea"></div>
                                            </template>
                                            <template v-else-if="schema.property_type === 'boolean'">
                                                <div class="mock-switch"></div>
                                            </template>
                                            <template v-else-if="schema.property_type === 'select'">
                                                <div class="mock-select">
                                                    <span>{{ schema.default_value || '- 선택 -' }}</span>
                                                    <v-icon size="16">mdi-chevron-down</v-icon>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <div class="mock-input">{{ schema.default_value || '' }}</div>
                                            </template>
                                        </div>
                                    </v-col>
                                </v-row>
                            </template>
                        </template>
                    </div>
                </v-card>
            </div>
        </v-expand-transition>

        <v-data-table
            :headers="headers"
            :items="filteredSchemas"
            :loading="loading"
            class="elevation-1"
        >
            <template v-slot:item.is_mandatory="{ item }">
                <v-chip
                    :color="item.is_mandatory ? 'error' : 'grey'"
                    size="small"
                >
                    {{ item.is_mandatory ? $t('taskCatalog.mandatory') : $t('taskCatalog.optional') }}
                </v-chip>
            </template>

            <template v-slot:item.property_type="{ item }">
                <v-chip size="small" variant="outlined">
                    {{ item.property_type }}
                </v-chip>
            </template>

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
                    {{ selectedTaskType ? $t('taskCatalog.noSchemas') : $t('taskCatalog.selectTaskTypeFirst') }}
                </v-alert>
            </template>
        </v-data-table>

        <!-- Add/Edit Dialog -->
        <PropertySchemaDialog
            v-model="dialogOpen"
            :schema="editingSchema"
            :task-type="selectedTaskType"
            @saved="onSchemaSaved"
        />

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialogOpen" max-width="400">
            <v-card>
                <v-card-title>
                    {{ $t('taskCatalog.confirmDelete') }}
                </v-card-title>

                <v-card-text>
                    {{ $t('taskCatalog.deleteSchemaConfirm', { name: deletingSchema?.property_label }) }}
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
                        @click="deleteSchema"
                    >
                        {{ $t('taskCatalog.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card-text>
</template>

<script>
import { defineComponent, ref, computed, watch, getCurrentInstance } from 'vue';
import { useTaskCatalogStore, AVAILABLE_TASK_TYPES } from '@/stores/taskCatalog';
import PropertySchemaDialog from './PropertySchemaDialog.vue';

export default defineComponent({
    name: 'PropertySchemaManager',
    components: {
        PropertySchemaDialog
    },
    setup() {
        const { proxy } = getCurrentInstance();
        const t = (key) => proxy.$t(key);
        const locale = computed(() => proxy.$i18n?.locale || 'en');
        const store = useTaskCatalogStore();

        const loading = computed(() => store?.loading || false);

        const selectedTaskType = ref(null);
        const dialogOpen = ref(false);
        const deleteDialogOpen = ref(false);
        const editingSchema = ref(null);
        const deletingSchema = ref(null);
        const showLayoutPreview = ref(false);

        const availableTaskTypes = computed(() => {
            return AVAILABLE_TASK_TYPES.map(item => ({
                ...item,
                label: locale.value === 'ko' ? item.labelKo : item.label
            }));
        });

        const headers = computed(() => [
            { title: t('taskCatalog.propertyKey'), key: 'property_key', sortable: true },
            { title: t('taskCatalog.propertyLabel'), key: 'property_label', sortable: true },
            { title: t('taskCatalog.propertyType'), key: 'property_type', sortable: false },
            { title: t('taskCatalog.mandatory'), key: 'is_mandatory', sortable: false },
            { title: t('taskCatalog.order'), key: 'display_order', sortable: true },
            { title: t('taskCatalog.actions'), key: 'actions', sortable: false, align: 'end' }
        ]);

        const filteredSchemas = computed(() => {
            if (!selectedTaskType.value) return [];
            return store.schemasByTaskType(selectedTaskType.value);
        });

        // Group schemas by section and row for layout preview
        const groupedSchemas = computed(() => {
            const schemas = filteredSchemas.value;
            if (!schemas.length) return {};

            // Group by section
            const sections = {};
            schemas.forEach(schema => {
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

        watch(selectedTaskType, async (newVal) => {
            if (newVal) {
                await store.loadSchemas(newVal);
            }
        });

        const openDialog = (schema = null) => {
            editingSchema.value = schema;
            dialogOpen.value = true;
        };

        const onSchemaSaved = () => {
            dialogOpen.value = false;
            if (selectedTaskType.value) {
                store.loadSchemas(selectedTaskType.value);
            }
        };

        const confirmDelete = (schema) => {
            deletingSchema.value = schema;
            deleteDialogOpen.value = true;
        };

        const deleteSchema = async () => {
            try {
                await store.deleteSchema(deletingSchema.value.id);
                deleteDialogOpen.value = false;
            } catch (error) {
                console.error('Failed to delete schema:', error);
            }
        };

        return {
            store,
            loading,
            selectedTaskType,
            availableTaskTypes,
            headers,
            filteredSchemas,
            groupedSchemas,
            showLayoutPreview,
            dialogOpen,
            deleteDialogOpen,
            editingSchema,
            deletingSchema,
            openDialog,
            onSchemaSaved,
            confirmDelete,
            deleteSchema
        };
    }
});
</script>

<style scoped>
.layout-preview-container {
    background: #fafafa;
    border-radius: 8px;
    padding: 16px;
}

.section-header {
    font-size: 14px;
    font-weight: 600;
    color: #7c4dff;
    margin: 16px 0 12px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #e0e0e0;
}

.section-header:first-child {
    margin-top: 0;
}

.preview-row {
    margin-bottom: 12px;
}

.preview-field {
    padding: 4px 8px;
}

.field-label {
    font-size: 12px;
    color: #7c4dff;
    margin-bottom: 4px;
    font-weight: 500;
}

.mandatory-indicator {
    color: #f44336;
    margin-left: 2px;
}

.field-input {
    min-height: 36px;
}

.mock-input,
.mock-select,
.mock-textarea {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 13px;
    color: #666;
}

.mock-textarea {
    min-height: 60px;
}

.mock-select {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.mock-switch {
    width: 40px;
    height: 20px;
    background: #e0e0e0;
    border-radius: 10px;
    position: relative;
}

.mock-switch::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
</style>
