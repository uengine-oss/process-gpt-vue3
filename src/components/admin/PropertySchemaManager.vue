<template>
    <div>
        <!-- Info Banner [BLOCK:alert.info.v1] -->
        <v-alert dense outlined type="info" color="gray" class="pa-4 pt-2 pb-2">
            <v-row class="ma-0 pa-0">
                <span class="text-body-1">{{ $t('taskCatalog.schemasDescription') }}</span>
            </v-row>
        </v-alert>

        <!-- Filter Row -->
        <div class="d-flex align-center justify-space-between pa-0 pt-4 pb-4">
            <v-select
                v-model="selectedTaskType"
                :items="availableTaskTypes"
                :label="$t('taskCatalog.selectTaskType')"
                item-title="label"
                item-value="value"
                clearable
                variant="outlined"
                density="compact"
                hide-details
                class="flex-grow-0"
                style="min-width: 250px;"
            />
            <div class="d-flex ga-2">
                <!-- [BLOCK:button.secondary.v1] -->
                <v-btn
                    color="gray"
                    rounded="pill"
                    variant="flat"
                    :disabled="!selectedTaskType || filteredSchemas.length === 0"
                    @click="showLayoutPreview = !showLayoutPreview"
                >
                    <v-icon start size="16">{{ showLayoutPreview ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                    {{ $t('taskCatalog.layoutPreview') }}
                </v-btn>
                <!-- [BLOCK:button.primary.v1] -->
                <v-btn
                    color="primary"
                    rounded
                    variant="flat"
                    :disabled="!selectedTaskType"
                    @click="openDialog()"
                >
                    <v-icon start size="16">mdi-plus</v-icon>
                    {{ $t('taskCatalog.addProperty') }}
                </v-btn>
            </div>
        </div>

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

        <!-- [BLOCK:table.simple.v1] -->
        <v-card class="pa-0" variant="outlined">
            <v-table density="comfortable">
                <thead>
                    <tr>
                        <th>{{ $t('taskCatalog.propertyKey') }}</th>
                        <th>{{ $t('taskCatalog.propertyLabel') }}</th>
                        <th>{{ $t('taskCatalog.propertyType') }}</th>
                        <th>{{ $t('taskCatalog.mandatory') }}</th>
                        <th>{{ $t('taskCatalog.order') }}</th>
                        <th style="width: 100px;">{{ $t('taskCatalog.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="6" class="text-center pa-8">
                            <v-progress-circular indeterminate size="32" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="filteredSchemas.length === 0">
                        <td colspan="6" class="text-center pa-8 text-medium-emphasis">
                            {{ selectedTaskType ? $t('taskCatalog.noSchemas') : $t('taskCatalog.selectTaskTypeFirst') }}
                        </td>
                    </tr>
                    <tr v-else v-for="item in filteredSchemas" :key="item.id">
                        <td class="text-caption text-grey font-weight-medium">{{ item.property_key }}</td>
                        <td>{{ item.property_label }}</td>
                        <td>
                            <v-chip size="small" variant="tonal">{{ item.property_type }}</v-chip>
                        </td>
                        <td>
                            <v-chip :color="item.is_mandatory ? 'error' : 'grey'" size="small" variant="tonal">
                                {{ item.is_mandatory ? $t('taskCatalog.mandatory') : $t('taskCatalog.optional') }}
                            </v-chip>
                        </td>
                        <td class="text-center text-medium-emphasis">{{ item.display_order }}</td>
                        <td>
                            <!-- [BLOCK:button.icon.v1] -->
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
        <PropertySchemaDialog
            v-model="dialogOpen"
            :schema="editingSchema"
            :task-type="selectedTaskType"
            @saved="onSchemaSaved"
        />

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialogOpen" max-width="400" persistent>
            <v-card>
                <!-- [BLOCK:dialog.header.v1] -->
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    <div class="d-flex align-center">{{ $t('taskCatalog.confirmDelete') }}</div>
                    <v-btn variant="text" density="compact" icon @click="deleteDialogOpen = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pa-4">
                    {{ $t('taskCatalog.deleteSchemaConfirm', { name: deletingSchema?.property_label }) }}
                </v-card-text>

                <!-- [BLOCK:dialog.footer.actions.v1] -->
                <v-card-actions class="d-flex justify-end align-center pa-4 pt-0">
                    <v-btn variant="text" @click="deleteDialogOpen = false">
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn color="error" rounded variant="flat" :loading="loading" @click="deleteSchema">
                        {{ $t('taskCatalog.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
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
/* Layout Preview */
.layout-preview-container {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
}

.section-header {
    font-size: 14px;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
    margin: 16px 0 12px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
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
    color: rgb(var(--v-theme-primary));
    margin-bottom: 4px;
    font-weight: 500;
}

.mandatory-indicator {
    color: #ef4444;
    margin-left: 2px;
}

.field-input {
    min-height: 36px;
}

.mock-input,
.mock-select,
.mock-textarea {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 13px;
    color: #6b7280;
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
    background: #e5e7eb;
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
}
</style>
