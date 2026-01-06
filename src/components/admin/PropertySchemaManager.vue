<template>
    <div class="settings-container">
        <!-- Info Banner -->
        <div class="info-banner">
            <v-icon size="18" color="primary">mdi-information-outline</v-icon>
            <span>{{ $t('taskCatalog.schemasDescription') }}</span>
        </div>

        <!-- Filter Row -->
        <div class="filter-row">
            <div class="filter-select-wrapper">
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
                    class="flat-select"
                />
            </div>
            <div class="filter-actions">
                <button
                    class="preview-btn"
                    :class="{ active: showLayoutPreview }"
                    @click="showLayoutPreview = !showLayoutPreview"
                    :disabled="!selectedTaskType || filteredSchemas.length === 0"
                >
                    <v-icon size="16">mdi-eye</v-icon>
                    {{ $t('taskCatalog.layoutPreview') }}
                </button>
                <button
                    class="add-btn"
                    @click="openDialog()"
                    :disabled="!selectedTaskType"
                >
                    <v-icon size="16">mdi-plus</v-icon>
                    {{ $t('taskCatalog.addProperty') }}
                </button>
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

        <!-- Flat Table -->
        <div class="flat-table-container">
            <table class="flat-table">
                <thead>
                    <tr>
                        <th>{{ $t('taskCatalog.propertyKey') }}</th>
                        <th>{{ $t('taskCatalog.propertyLabel') }}</th>
                        <th>{{ $t('taskCatalog.propertyType') }}</th>
                        <th>{{ $t('taskCatalog.mandatory') }}</th>
                        <th>{{ $t('taskCatalog.order') }}</th>
                        <th style="width: 100px; text-align: right;">{{ $t('taskCatalog.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="6" class="loading-cell">
                            <v-progress-circular indeterminate size="24" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="filteredSchemas.length === 0">
                        <td colspan="6" class="empty-cell">
                            {{ selectedTaskType ? $t('taskCatalog.noSchemas') : $t('taskCatalog.selectTaskTypeFirst') }}
                        </td>
                    </tr>
                    <tr v-else v-for="item in filteredSchemas" :key="item.id">
                        <td class="key-cell">{{ item.property_key }}</td>
                        <td>{{ item.property_label }}</td>
                        <td>
                            <span class="type-badge">{{ item.property_type }}</span>
                        </td>
                        <td>
                            <span class="mandatory-badge" :class="item.is_mandatory ? 'required' : 'optional'">
                                {{ item.is_mandatory ? $t('taskCatalog.mandatory') : $t('taskCatalog.optional') }}
                            </span>
                        </td>
                        <td class="order-cell">{{ item.display_order }}</td>
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

/* Filter Row */
.filter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 16px;
}

.filter-select-wrapper {
    flex: 1;
    max-width: 300px;
}

.flat-select :deep(.v-field) {
    border-radius: 6px;
}

.filter-actions {
    display: flex;
    gap: 8px;
}

.preview-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #ffffff;
    color: #6b7280;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
}

.preview-btn:hover:not(:disabled) {
    border-color: #3b82f6;
    color: #3b82f6;
}

.preview-btn.active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #3b82f6;
}

.preview-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

.add-btn:hover:not(:disabled) {
    background: #2563eb;
}

.add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Layout Preview */
.layout-preview-container {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
}

.layout-section-header {
    font-size: 14px;
    font-weight: 600;
    color: #3b82f6;
    margin: 16px 0 12px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
}

.layout-section-header:first-child {
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
    color: #3b82f6;
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

.key-cell {
    font-family: monospace;
    font-size: 12px;
    color: #6b7280;
}

.order-cell {
    color: #9ca3af;
    text-align: center;
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

/* Badges */
.type-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
}

.mandatory-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
}

.mandatory-badge.required {
    background: #fef2f2;
    color: #dc2626;
}

.mandatory-badge.optional {
    background: #f3f4f6;
    color: #6b7280;
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
