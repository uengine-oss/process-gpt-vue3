<template>
    <div class="schema-manager">
        <!-- Add New Field Form -->
        <div v-if="showAddForm" class="add-form-card">
            <div class="add-form-title">{{ editingSchema ? $t('taskCatalog.editProperty') : 'Add New Field' }}</div>
            <div class="add-form-body">
                <div class="form-row">
                    <div class="form-group" style="flex: 2;">
                        <label class="form-label">{{ $t('taskCatalog.fieldName') }} *</label>
                        <input
                            v-model="formData.property_label"
                            class="form-input"
                            :placeholder="$t('taskCatalog.fieldNamePlaceholder')"
                        />
                    </div>
                    <div class="form-group" style="flex: 1.5;">
                        <label class="form-label">{{ $t('taskCatalog.fieldType') }}</label>
                        <select v-model="formData.property_type" class="form-select">
                            <option v-for="pt in propertyTypes" :key="pt.value" :value="pt.value">{{ pt.label }}</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1.5;">
                        <label class="form-label">{{ $t('taskCatalog.appliesTo') }}</label>
                        <select v-model="formData.applies_to" class="form-select">
                            <option v-for="opt in availableTargets.filter(t => t.value !== '__all__')" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex: 2;">
                        <label class="form-label">{{ $t('taskCatalog.placeholder') }}</label>
                        <input
                            v-model="formData.placeholder"
                            class="form-input"
                            :placeholder="$t('taskCatalog.placeholderPlaceholder')"
                        />
                    </div>
                    <div class="form-group" style="flex: 1.5;" v-if="formData.property_type === 'db-select' || formData.property_type === 'formula'">
                        <label class="form-label">{{ $t('taskCatalog.config') }}</label>
                        <input
                            v-model="configText"
                            class="form-input"
                            :placeholder="$t('taskCatalog.configPlaceholder')"
                        />
                    </div>
                    <div class="form-group" style="flex: 1.5;" v-else></div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">{{ $t('taskCatalog.order') }}</label>
                        <input v-model.number="formData.display_order" class="form-input" type="number" min="0" />
                    </div>
                </div>
                <div class="form-row-checkboxes">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="formData.is_mandatory" />
                        <span>{{ $t('taskCatalog.mandatory') }}</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="formData.visible_by_default" />
                        <span>{{ $t('taskCatalog.visibleByDefault') }}</span>
                    </label>
                </div>
                <!-- Options for select type -->
                <div v-if="formData.property_type === 'select'" class="options-section">
                    <label class="form-label">{{ $t('taskCatalog.options') }}</label>
                    <div
                        v-for="(option, index) in formData.options"
                        :key="index"
                        class="option-row"
                    >
                        <input v-model="option.label" class="form-input" :placeholder="$t('taskCatalog.optionLabel')" />
                        <input v-model="option.value" class="form-input" :placeholder="$t('taskCatalog.optionValue')" />
                        <button class="option-remove-btn" @click="removeOption(index)">
                            <v-icon size="14">mdi-minus</v-icon>
                        </button>
                    </div>
                    <button class="option-add-btn" @click="addOption">
                        <v-icon size="14">mdi-plus</v-icon>
                        {{ $t('taskCatalog.addOption') }}
                    </button>
                </div>
                <div class="form-actions">
                    <button class="btn-primary" :disabled="!formData.property_label || saving" @click="saveField">
                        <v-progress-circular v-if="saving" indeterminate size="14" width="2" class="mr-1" />
                        {{ editingSchema ? $t('taskCatalog.save') : $t('taskCatalog.addField') }}
                    </button>
                    <button class="btn-text" @click="cancelForm">{{ $t('taskCatalog.cancel') }}</button>
                </div>
            </div>
        </div>

        <!-- Filter Row -->
        <div class="filter-row">
            <div class="filter-select-wrapper">
                <v-select
                    v-model="selectedTarget"
                    :items="availableTargets"
                    :label="$t('taskCatalog.appliesTo') || '적용 대상'"
                    item-title="label"
                    item-value="value"
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
                    :disabled="filteredSchemas.length === 0"
                >
                    <v-icon size="16">mdi-eye</v-icon>
                    {{ $t('taskCatalog.layoutPreview') }}
                </button>
                <button class="add-btn" @click="openAddForm()">
                    <v-icon size="16">mdi-plus</v-icon>
                    {{ $t('taskCatalog.addField') }}
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
                            <div v-if="sectionName !== '__default__'" class="section-header">{{ sectionName }}</div>
                            <template v-for="(row, rowIndex) in section" :key="rowIndex">
                                <v-row class="preview-row">
                                    <v-col
                                        v-for="schema in row"
                                        :key="schema.id"
                                        :cols="schema.col_span || 12"
                                        class="preview-field"
                                    >
                                        <div class="field-label-preview">
                                            {{ schema.property_label }}
                                            <span v-if="schema.is_mandatory" class="mandatory-indicator">*</span>
                                        </div>
                                        <div class="field-input" :class="schema.property_type">
                                            <div v-if="schema.property_type === 'textarea'" class="mock-textarea"></div>
                                            <div v-else-if="schema.property_type === 'boolean'" class="mock-switch"></div>
                                            <div v-else-if="schema.property_type === 'select' || schema.property_type === 'db-select'" class="mock-select">
                                                <span>{{ schema.default_value || '- 선택 -' }}</span>
                                                <v-icon size="16">mdi-chevron-down</v-icon>
                                            </div>
                                            <div v-else class="mock-input">{{ schema.placeholder || schema.default_value || '' }}</div>
                                        </div>
                                    </v-col>
                                </v-row>
                            </template>
                        </template>
                    </div>
                </v-card>
            </div>
        </v-expand-transition>

        <!-- Table -->
        <div class="flat-table-container">
            <table class="flat-table">
                <thead>
                    <tr>
                        <th style="width: 28px;"></th>
                        <th>{{ $t('taskCatalog.fieldName') }}</th>
                        <th>{{ $t('taskCatalog.fieldType') }}</th>
                        <th>{{ $t('taskCatalog.appliesTo') }}</th>
                        <th>{{ $t('taskCatalog.config') }}</th>
                        <th style="text-align: center;">{{ $t('taskCatalog.mandatory') }}</th>
                        <th style="text-align: center;">{{ $t('taskCatalog.visible') }}</th>
                        <th style="width: 80px; text-align: right;">{{ $t('taskCatalog.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="8" class="loading-cell">
                            <v-progress-circular indeterminate size="24" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="filteredSchemas.length === 0">
                        <td colspan="8" class="empty-cell">
                            {{ $t('taskCatalog.noSchemas') || 'No property schemas found.' }}
                        </td>
                    </tr>
                    <tr v-else v-for="item in filteredSchemas" :key="item.id">
                        <td class="drag-handle-cell">
                            <v-icon size="14" color="grey-lighten-1">mdi-drag-vertical</v-icon>
                        </td>
                        <td>
                            <div class="field-name">{{ item.property_label }}</div>
                            <div v-if="item.placeholder" class="field-placeholder">Placeholder: {{ item.placeholder }}</div>
                        </td>
                        <td>
                            <span class="type-badge">{{ getTypeLabel(item.property_type) }}</span>
                        </td>
                        <td>
                            <span class="applies-badge" :class="getAppliesToClass(item.applies_to)">
                                {{ getAppliesToLabel(item.applies_to) }}
                            </span>
                        </td>
                        <td>
                            <span v-if="item.config" class="config-text">
                                <template v-if="item.property_type === 'db-select'">DB: {{ item.config.table || '' }}</template>
                                <template v-else-if="item.property_type === 'formula'">{{ item.config.expression || '' }}</template>
                                <template v-else>{{ JSON.stringify(item.config) }}</template>
                            </span>
                        </td>
                        <td class="center-cell">
                            <v-icon v-if="item.is_mandatory" size="18" color="primary">mdi-checkbox-marked</v-icon>
                            <v-icon v-else size="18" color="grey-lighten-2">mdi-checkbox-blank-outline</v-icon>
                        </td>
                        <td class="center-cell">
                            <v-icon
                                size="18"
                                :color="item.visible_by_default !== false ? 'primary' : 'grey-lighten-2'"
                            >
                                {{ item.visible_by_default !== false ? 'mdi-eye' : 'mdi-eye-off' }}
                            </v-icon>
                        </td>
                        <td class="actions-cell">
                            <button class="action-btn action-edit" @click="openEditForm(item)">
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

        <!-- Field Types Guide -->
        <div class="field-types-guide">
            <div class="guide-title">{{ $t('taskCatalog.fieldTypesGuide') }}</div>
            <div class="guide-content">
                <span class="guide-item"><strong class="guide-type text">Text:</strong> Single-line text input</span>
                <span class="guide-item"><strong class="guide-type number">Number:</strong> Numeric input with validation</span>
                <span class="guide-item"><strong class="guide-type textarea">Text Area:</strong> Multi-line text input</span>
                <span class="guide-item"><strong class="guide-type url">URL:</strong> URL input with link validation</span>
                <span class="guide-item"><strong class="guide-type dbselect">DB-Select:</strong> Dropdown from database table</span>
                <span class="guide-item"><strong class="guide-type formula">Formula:</strong> Calculated field from expression</span>
            </div>
        </div>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialogOpen" max-width="400">
            <v-card>
                <v-card-title>{{ $t('taskCatalog.confirmDelete') }}</v-card-title>
                <v-card-text>
                    {{ $t('taskCatalog.deleteSchemaConfirm', { name: deletingSchema?.property_label }) }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="deleteDialogOpen = false">{{ $t('taskCatalog.cancel') }}</v-btn>
                    <v-btn color="error" :loading="loading" @click="deleteSchema">{{ $t('taskCatalog.delete') }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { defineComponent, ref, computed, watch, getCurrentInstance, reactive } from 'vue';
import { useTaskCatalogStore, AVAILABLE_TASK_TYPES, PROPERTY_TYPES, APPLIES_TO_OPTIONS, BUILT_IN_PROPERTY_KEYS } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'PropertySchemaManager',
    setup() {
        const { proxy } = getCurrentInstance();
        const locale = computed(() => proxy.$i18n?.locale || 'en');
        const store = useTaskCatalogStore();

        const loading = computed(() => store?.loading || false);
        const saving = ref(false);

        const selectedTarget = ref(null);
        const showAddForm = ref(false);
        const showLayoutPreview = ref(false);
        const deleteDialogOpen = ref(false);
        const editingSchema = ref(null);
        const deletingSchema = ref(null);
        const configText = ref('');

        const propertyTypes = computed(() => PROPERTY_TYPES);

        const defaultFormData = () => ({
            property_key: '',
            property_label: '',
            property_type: 'string',
            is_mandatory: false,
            visible_by_default: true,
            default_value: '',
            display_order: 0,
            options: [],
            applies_to: 'both',
            placeholder: '',
            config: null,
            row_index: 0,
            col_span: 12,
            section_name: ''
        });

        const formData = ref(defaultFormData());

        const availableTargets = computed(() => {
            return [
                { value: '__all__', label: locale.value === 'ko' ? '전체' : 'All' },
                ...APPLIES_TO_OPTIONS.map(item => ({
                    ...item,
                    label: locale.value === 'ko' ? (item.labelKo || item.label) : item.label
                })),
            ];
        });

        const filteredSchemas = computed(() => {
            let schemas = store.propertySchemas || [];
            // Filter out built-in keys
            schemas = schemas.filter(s => !BUILT_IN_PROPERTY_KEYS.includes(s.property_key));
            // Filter by selected target
            if (selectedTarget.value && selectedTarget.value !== '__all__') {
                schemas = schemas.filter(s => {
                    const at = s.applies_to || 'both';
                    return at === selectedTarget.value;
                });
            }
            return schemas.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        });

        // Group schemas by section and row for layout preview
        const groupedSchemas = computed(() => {
            const schemas = filteredSchemas.value;
            if (!schemas.length) return {};
            const sections = {};
            schemas.forEach(schema => {
                const section = schema.section_name || '__default__';
                if (!sections[section]) sections[section] = {};
                const rowIdx = schema.row_index ?? schema.display_order ?? 0;
                if (!sections[section][rowIdx]) sections[section][rowIdx] = [];
                sections[section][rowIdx].push(schema);
            });
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

        watch(selectedTarget, async () => {
            // Load all schemas (no task_type filter)
            if (!store.schemasLoaded) {
                await store.loadSchemas();
            }
        }, { immediate: true });

        const generateKey = (label) => {
            if (!label) return '';
            return label
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
        };

        const openAddForm = () => {
            editingSchema.value = null;
            formData.value = defaultFormData();
            configText.value = '';
            showAddForm.value = true;
        };

        const openEditForm = (schema) => {
            editingSchema.value = schema;
            formData.value = {
                ...schema,
                options: schema.options ? [...schema.options] : [],
                applies_to: schema.applies_to || 'both',
                placeholder: schema.placeholder || '',
                visible_by_default: schema.visible_by_default !== false,
                config: schema.config || null,
            };
            // Serialize config for text input
            if (schema.config) {
                if (schema.property_type === 'db-select') {
                    configText.value = 'DB: ' + (schema.config.table || '');
                } else if (schema.property_type === 'formula') {
                    configText.value = schema.config.expression || '';
                } else {
                    configText.value = JSON.stringify(schema.config);
                }
            } else {
                configText.value = '';
            }
            showAddForm.value = true;
        };

        const cancelForm = () => {
            showAddForm.value = false;
            editingSchema.value = null;
            formData.value = defaultFormData();
            configText.value = '';
        };

        const parseConfig = (type, text) => {
            if (!text || !text.trim()) return null;
            const trimmed = text.trim();
            if (type === 'db-select') {
                const match = trimmed.match(/^(?:DB:\s*)?(.+)/i);
                const tableName = match ? match[1].trim() : trimmed;
                return { table: tableName, label_col: 'name', value_col: 'id' };
            }
            if (type === 'formula') {
                return { expression: trimmed };
            }
            try { return JSON.parse(trimmed); } catch { return { value: trimmed }; }
        };

        const saveField = async () => {
            if (!formData.value.property_label) return;
            saving.value = true;
            try {
                // Auto-generate key if empty
                if (!formData.value.property_key) {
                    formData.value.property_key = generateKey(formData.value.property_label);
                }
                const config = parseConfig(formData.value.property_type, configText.value);
                await store.saveSchema({
                    ...formData.value,
                    id: editingSchema.value?.id,
                    task_type: formData.value.applies_to,
                    config,
                });
                cancelForm();
                store.schemasLoaded = false;
                await store.loadSchemas();
            } catch (error) {
                console.error('Failed to save field:', error);
            } finally {
                saving.value = false;
            }
        };

        const addOption = () => {
            if (!formData.value.options) formData.value.options = [];
            formData.value.options.push({ label: '', value: '' });
        };

        const removeOption = (index) => {
            formData.value.options.splice(index, 1);
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

        const getTypeLabel = (type) => {
            const found = PROPERTY_TYPES.find(t => t.value === type);
            return found ? found.label : type;
        };

        const getAppliesToClass = (val) => {
            if (val === 'process') return 'process';
            if (val === 'both') return 'both';
            if (val === 'task') return 'task';
            return 'specific_task'; // bpmn:ManualTask, etc.
        };

        const getAppliesToLabel = (val) => {
            const found = APPLIES_TO_OPTIONS.find(o => o.value === val);
            if (found) return locale.value === 'ko' ? (found.labelKo || found.label) : found.label;
            return val || (locale.value === 'ko' ? '프로세스 + Task' : 'Process + Task');
        };

        return {
            store,
            loading,
            saving,
            selectedTarget,
            availableTargets,
            filteredSchemas,
            groupedSchemas,
            showAddForm,
            showLayoutPreview,
            deleteDialogOpen,
            editingSchema,
            deletingSchema,
            formData,
            configText,
            propertyTypes,
            getAppliesToClass,
            openAddForm,
            openEditForm,
            cancelForm,
            saveField,
            addOption,
            removeOption,
            confirmDelete,
            deleteSchema,
            getTypeLabel,
            getAppliesToLabel,
        };
    }
});
</script>

<style scoped>
.schema-manager {
    padding: 24px;
}

/* Add Form Card */
.add-form-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    margin-bottom: 20px;
    overflow: hidden;
}

.add-form-title {
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
}

.add-form-body {
    padding: 20px;
}

.form-row {
    display: flex;
    gap: 16px;
    margin-bottom: 14px;
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-label {
    font-size: 12px;
    font-weight: 500;
    color: #4b5563;
    margin-bottom: 6px;
}

.form-input {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #1f2937;
    background: #fff;
    outline: none;
    transition: border-color 0.15s;
}
.form-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
.form-input::placeholder {
    color: #9ca3af;
}

.form-select {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #1f2937;
    background: #fff;
    outline: none;
    cursor: pointer;
}
.form-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.form-row-checkboxes {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #4b5563;
    cursor: pointer;
}
.checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
}

.options-section {
    margin-bottom: 16px;
}

.option-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
}
.option-row .form-input {
    flex: 1;
}

.option-remove-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: #fef2f2;
    color: #ef4444;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.option-add-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #3b82f6;
    background: none;
    border: 1px dashed #93c5fd;
    border-radius: 4px;
    padding: 4px 10px;
    cursor: pointer;
}

.form-actions {
    display: flex;
    gap: 10px;
}

.btn-primary {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 20px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
}
.btn-primary:hover:not(:disabled) {
    background: #2563eb;
}
.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-text {
    padding: 8px 16px;
    background: none;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    color: #6b7280;
    cursor: pointer;
}
.btn-text:hover {
    background: #f3f4f6;
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

.section-header {
    font-size: 14px;
    font-weight: 600;
    color: #3b82f6;
    margin: 16px 0 12px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
}

.preview-row { margin-bottom: 12px; }
.preview-field { padding: 4px 8px; }

.field-label-preview {
    font-size: 12px;
    color: #3b82f6;
    margin-bottom: 4px;
    font-weight: 500;
}
.mandatory-indicator {
    color: #ef4444;
    margin-left: 2px;
}

.field-input { min-height: 36px; }

.mock-input,
.mock-select,
.mock-textarea {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 13px;
    color: #9ca3af;
}
.mock-textarea { min-height: 60px; }
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
.drag-handle-cell {
    width: 28px;
    padding: 12px 4px 12px 12px !important;
    cursor: grab;
}

.field-name {
    font-weight: 500;
    color: #1f2937;
}

.field-placeholder {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 2px;
}

.center-cell {
    text-align: center;
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

.applies-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    background: #f3f4f6;
    color: #4b5563;
}
.applies-badge.both {
    background: #dbeafe;
    color: #1d4ed8;
}
.applies-badge.process {
    background: #fef3c7;
    color: #92400e;
}
.applies-badge.task {
    background: #d1fae5;
    color: #065f46;
}
.applies-badge.specific_task {
    background: #ede9fe;
    color: #5b21b6;
}

.config-text {
    font-family: monospace;
    font-size: 12px;
    color: #6b7280;
    background: #f9fafb;
    padding: 2px 8px;
    border-radius: 4px;
}

/* Actions */
.actions-cell {
    text-align: right;
    display: flex;
    justify-content: flex-end;
    gap: 4px;
}

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
.action-btn:hover { background-color: #f3f4f6; }

.action-edit { color: #6b7280; }
.action-edit:hover { color: #3b82f6; background-color: #eff6ff; }
.action-delete { color: #9ca3af; }
.action-delete:hover { color: #ef4444; background-color: #fef2f2; }

/* Field Types Guide */
.field-types-guide {
    margin-top: 20px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px 20px;
}

.guide-title {
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 10px;
}

.guide-content {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
}

.guide-item {
    font-size: 12px;
    color: #6b7280;
}

.guide-type {
    font-weight: 600;
}
.guide-type.text { color: #059669; }
.guide-type.number { color: #d97706; }
.guide-type.textarea { color: #7c3aed; }
.guide-type.url { color: #2563eb; }
.guide-type.dbselect { color: #dc2626; }
.guide-type.formula { color: #059669; }
</style>
