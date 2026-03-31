<template>
    <div class="property-schema-studio">
        <!-- Page Header -->
        <div class="studio-header">
            <div class="studio-header-left">
                <v-icon class="studio-header-icon" color="primary">mdi-table-cog</v-icon>
                <div>
                    <div class="studio-title">{{ $t('adminConsole.propertySchema.title') }}</div>
                    <div class="studio-subtitle">{{ $t('adminConsole.tabSchemas') }}</div>
                </div>
            </div>
            <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openAddForm">
                {{ $t('adminConsole.propertySchema.addField') }}
            </v-btn>
        </div>

        <!-- Add / Edit Form Card -->
        <div v-if="showForm" class="schema-manager">
            <div class="add-form-card">
                <div class="add-form-title">
                    <span>{{ editingSchema ? $t('adminConsole.propertySchema.editField') : $t('adminConsole.propertySchema.addField') }}</span>
                    <button class="form-close-btn" @click="cancelForm">
                        <v-icon size="16">mdi-close</v-icon>
                    </button>
                </div>
                <div class="add-form-body">
                    <!-- Row 1: property_key + property_label -->
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">
                                {{ $t('adminConsole.propertySchema.fieldKey') }}
                                <span class="required-mark">*</span>
                            </label>
                            <input
                                v-model="formData.property_key"
                                class="form-input"
                                :class="{ 'input-disabled': !!editingSchema }"
                                :disabled="!!editingSchema"
                                placeholder="e.g. system_name"
                            />
                            <div v-if="editingSchema" class="field-hint">
                                <v-icon size="12" color="grey">mdi-lock-outline</v-icon>
                                {{ $t('adminConsole.propertySchema.keyNotEditable') }}
                            </div>
                        </div>
                        <div class="form-group" style="flex: 1.5;">
                            <label class="form-label">
                                {{ $t('adminConsole.propertySchema.fieldLabel') }}
                                <span class="required-mark">*</span>
                            </label>
                            <input
                                v-model="formData.property_label"
                                class="form-input"
                                :placeholder="$t('taskCatalog.fieldNamePlaceholder')"
                            />
                        </div>
                    </div>

                    <!-- Row 2: property_type + applies_to + display_order -->
                    <div class="form-row">
                        <div class="form-group" style="flex: 1.5;">
                            <label class="form-label">{{ $t('adminConsole.propertySchema.fieldType') }}</label>
                            <!-- Type Change Block warning -->
                            <div v-if="editingSchema && usageCount > 0" class="type-blocked-wrapper">
                                <select
                                    v-model="formData.property_type"
                                    class="form-select input-disabled"
                                    disabled
                                >
                                    <option v-for="pt in propertyTypes" :key="pt.value" :value="pt.value">{{ pt.label }}</option>
                                </select>
                                <div class="type-change-warning">
                                    <v-icon size="13" color="warning">mdi-alert-circle-outline</v-icon>
                                    {{ $t('adminConsole.propertySchema.typeChangeBlocked') }}
                                </div>
                            </div>
                            <select v-else v-model="formData.property_type" class="form-select">
                                <option v-for="pt in propertyTypes" :key="pt.value" :value="pt.value">{{ pt.label }}</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1.5;">
                            <label class="form-label">{{ $t('adminConsole.propertySchema.appliesTo') }}</label>
                            <select v-model="formData.applies_to" class="form-select">
                                <option v-for="opt in appliesToOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 0.6;">
                            <label class="form-label">{{ $t('adminConsole.propertySchema.order') }}</label>
                            <input
                                v-model.number="formData.display_order"
                                class="form-input"
                                type="number"
                                min="0"
                                style="width: 100%;"
                            />
                        </div>
                    </div>

                    <!-- Row 3: description + placeholder -->
                    <div class="form-row">
                        <div class="form-group" style="flex: 1.5;">
                            <label class="form-label">{{ $t('adminConsole.propertySchema.description') }}</label>
                            <input
                                v-model="formData.description"
                                class="form-input"
                                :placeholder="$t('adminConsole.propertySchema.descriptionPlaceholder')"
                            />
                        </div>
                        <div class="form-group" style="flex: 1.5;">
                            <label class="form-label">{{ $t('taskCatalog.placeholder') }}</label>
                            <input
                                v-model="formData.placeholder"
                                class="form-input"
                                :placeholder="$t('taskCatalog.placeholderPlaceholder')"
                            />
                        </div>
                    </div>

                    <!-- Row 4: checkboxes -->
                    <div class="form-row-checkboxes">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="formData.is_readonly" />
                            <span>{{ $t('adminConsole.propertySchema.readonly') }}</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="formData.is_mandatory" />
                            <span>{{ $t('adminConsole.propertySchema.mandatory') }}</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="formData.visible_by_default" />
                            <span>{{ $t('taskCatalog.visibleByDefault') }}</span>
                        </label>
                    </div>

                    <!-- Options section for select / multiselect -->
                    <div v-if="formData.property_type === 'select' || formData.property_type === 'multiselect'" class="options-section">
                        <label class="form-label">{{ $t('taskCatalog.options') }}</label>
                        <div
                            v-for="(option, index) in formData.options"
                            :key="index"
                            class="option-row"
                        >
                            <input
                                v-model="option.label"
                                class="form-input"
                                :placeholder="$t('taskCatalog.optionLabel')"
                            />
                            <input
                                v-model="option.value"
                                class="form-input"
                                :placeholder="$t('taskCatalog.optionValue')"
                            />
                            <button class="option-remove-btn" @click="removeOption(index)">
                                <v-icon size="14">mdi-minus</v-icon>
                            </button>
                        </div>
                        <button class="option-add-btn" @click="addOption">
                            <v-icon size="14">mdi-plus</v-icon>
                            {{ $t('taskCatalog.addOption') }}
                        </button>
                    </div>

                    <!-- Usage warning (edit mode with usage > 0) -->
                    <div v-if="editingSchema && usageCount > 0" class="usage-warning-banner">
                        <v-icon size="16" color="warning">mdi-information-outline</v-icon>
                        {{ $t('adminConsole.propertySchema.usageWarning', { count: usageCount }) }}
                    </div>

                    <!-- Form actions -->
                    <div class="form-actions">
                        <v-btn
                            color="primary"
                            size="small"
                            :disabled="!formData.property_label || !formData.property_key || saving"
                            :loading="saving"
                            @click="saveField"
                        >
                            {{ editingSchema ? $t('taskCatalog.save') : $t('adminConsole.propertySchema.addField') }}
                        </v-btn>
                        <v-btn variant="text" color="grey" size="small" @click="cancelForm">
                            {{ $t('taskCatalog.cancel') }}
                        </v-btn>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filter Row -->
        <div class="schema-manager">
            <div class="filter-row">
                <div class="filter-select-wrapper">
                    <select v-model="selectedTarget" class="form-select filter-select">
                        <option v-for="opt in filterTargets" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                </div>
                <div class="filter-toggle-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="showDeprecated" />
                        <span>{{ $t('adminConsole.propertySchema.deprecated') }}</span>
                    </label>
                </div>
            </div>

            <!-- Table -->
            <div class="flat-table-container">
                <table class="flat-table">
                    <thead>
                        <tr>
                            <th>{{ $t('adminConsole.propertySchema.fieldKey') }}</th>
                            <th>{{ $t('adminConsole.propertySchema.fieldLabel') }}</th>
                            <th>{{ $t('adminConsole.propertySchema.fieldType') }}</th>
                            <th>{{ $t('adminConsole.propertySchema.appliesTo') }}</th>
                            <th>{{ $t('adminConsole.propertySchema.description') }}</th>
                            <th style="text-align: center;">{{ $t('adminConsole.propertySchema.readonly') }}</th>
                            <th style="text-align: center;">{{ $t('adminConsole.propertySchema.mandatory') }}</th>
                            <th style="text-align: center;">{{ $t('taskCatalog.visible') }}</th>
                            <th style="text-align: center;">{{ $t('adminConsole.propertySchema.order') }}</th>
                            <th style="width: 90px; text-align: right;">{{ $t('taskCatalog.actions') }}</th>
                        </tr>
                    </thead>
                    <tbody style="height: calc(100vh - 264px); overflow-y: auto;">
                        <tr v-if="loading">
                            <td colspan="10" class="loading-cell">
                                <v-progress-circular indeterminate size="24" color="primary" />
                            </td>
                        </tr>
                        <tr v-else-if="filteredSchemas.length === 0">
                            <td colspan="10" class="empty-cell">
                                {{ $t('taskCatalog.noSchemas') }}
                            </td>
                        </tr>
                        <tr
                            v-else
                            v-for="item in filteredSchemas"
                            :key="item.id"
                            :class="{ 'deprecated-row': !!item.deprecated_at }"
                        >
                            <td>
                                <div class="key-cell">
                                    <span class="key-text">{{ item.property_key }}</span>
                                    <span v-if="item.deprecated_at" class="deprecated-badge">
                                        {{ $t('adminConsole.propertySchema.deprecated') }}
                                    </span>
                                </div>
                            </td>
                            <td>
                                <div class="field-name">{{ item.property_label }}</div>
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
                                <span v-if="item.description" class="description-text" :title="item.description">
                                    {{ truncate(item.description, 40) }}
                                </span>
                                <span v-else class="empty-dash">—</span>
                            </td>
                            <td class="center-cell">
                                <v-icon v-if="item.is_readonly" size="18" color="primary">mdi-checkbox-marked</v-icon>
                                <v-icon v-else size="18" color="grey-lighten-2">mdi-checkbox-blank-outline</v-icon>
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
                            <td class="center-cell">
                                <span class="order-badge">{{ item.display_order || 0 }}</span>
                            </td>
                            <td class="actions-cell">
                                <button
                                    class="action-btn action-edit"
                                    :title="$t('taskCatalog.editProperty')"
                                    :disabled="!!item.deprecated_at"
                                    @click="openEditForm(item)"
                                >
                                    <v-icon size="16">mdi-pencil</v-icon>
                                </button>
                                <button
                                    v-if="!item.deprecated_at"
                                    class="action-btn action-deprecate"
                                    :title="$t('adminConsole.propertySchema.softDelete')"
                                    @click="confirmSoftDelete(item)"
                                >
                                    <v-icon size="16">mdi-archive-arrow-down-outline</v-icon>
                                </button>
                                <button
                                    v-else
                                    class="action-btn action-restore"
                                    title="Restore"
                                    @click="restoreSchema(item)"
                                >
                                    <v-icon size="16">mdi-restore</v-icon>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Soft Delete Confirmation Dialog -->
        <v-dialog v-model="softDeleteDialogOpen" max-width="440">
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6">
                    {{ $t('adminConsole.propertySchema.softDelete') }}
                </v-card-title>
                <v-card-text class="px-6 pb-2">
                    <div class="dialog-body">
                        <p>{{ $t('adminConsole.propertySchema.softDeleteConfirm') }}</p>
                        <div v-if="softDeleteTarget && softDeleteUsageCount > 0" class="usage-warning-banner mt-3">
                            <v-icon size="16" color="warning">mdi-information-outline</v-icon>
                            {{ $t('adminConsole.propertySchema.usageWarning', { count: softDeleteUsageCount }) }}
                        </div>
                        <div v-if="softDeleteTarget" class="target-info mt-3">
                            <span class="target-key">{{ softDeleteTarget.property_key }}</span>
                            &nbsp;/&nbsp;
                            <span class="target-label">{{ softDeleteTarget.property_label }}</span>
                        </div>
                    </div>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="softDeleteDialogOpen = false">
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn
                        color="warning"
                        variant="tonal"
                        :loading="deleting"
                        @click="executeSoftDelete"
                    >
                        {{ $t('adminConsole.propertySchema.softDelete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { defineComponent, ref, computed, watch, getCurrentInstance } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { PROPERTY_TYPES, APPLIES_TO_OPTIONS } from '@/stores/taskCatalog';

const ALL_PROPERTY_TYPES = [
    ...PROPERTY_TYPES,
    { value: 'date', label: 'Date' },
    { value: 'user', label: 'User' },
    { value: 'multiselect', label: 'Multi-Select' },
];

const defaultFormData = () => ({
    property_key: '',
    property_label: '',
    property_type: 'string',
    description: '',
    is_readonly: false,
    is_mandatory: false,
    display_order: 0,
    applies_to: 'both',
    placeholder: '',
    visible_by_default: true,
    options: [],
    deprecated_at: null,
});

export default defineComponent({
    name: 'PropertySchemaStudio',

    setup() {
        const { proxy } = getCurrentInstance();
        const locale = computed(() => proxy.$i18n?.locale || 'en');

        // ---- State ----
        const schemas = ref([]);
        const loading = ref(false);
        const saving = ref(false);
        const deleting = ref(false);

        const showForm = ref(false);
        const editingSchema = ref(null);
        const formData = ref(defaultFormData());
        const usageCount = ref(0);

        const selectedTarget = ref('__all__');
        const showDeprecated = ref(false);

        const softDeleteDialogOpen = ref(false);
        const softDeleteTarget = ref(null);
        const softDeleteUsageCount = ref(0);

        // ---- Constants ----
        const propertyTypes = computed(() => ALL_PROPERTY_TYPES);

        const appliesToOptions = computed(() => {
            return APPLIES_TO_OPTIONS.map(item => ({
                ...item,
                label: locale.value === 'ko' ? (item.labelKo || item.label) : item.label,
            }));
        });

        const filterTargets = computed(() => {
            const all = { value: '__all__', label: locale.value === 'ko' ? '전체' : 'All' };
            return [all, ...appliesToOptions.value];
        });

        // ---- Computed ----
        const filteredSchemas = computed(() => {
            let list = schemas.value || [];

            // Deprecated filter
            if (!showDeprecated.value) {
                list = list.filter(s => !s.deprecated_at);
            }

            // Target filter
            if (selectedTarget.value && selectedTarget.value !== '__all__') {
                list = list.filter(s => {
                    const at = s.applies_to || 'both';
                    return at === selectedTarget.value;
                });
            }

            return list.slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        });

        // ---- API ----
        const loadSchemas = async () => {
            loading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.getPropertySchemas();
                schemas.value = result || [];
            } catch (e) {
                console.error('[PropertySchemaStudio] loadSchemas error:', e);
            } finally {
                loading.value = false;
            }
        };

        const fetchUsageCount = async (propertyKey) => {
            if (!propertyKey) {
                usageCount.value = 0;
                return;
            }
            try {
                const backend = BackendFactory.createBackend();
                usageCount.value = await backend.getPropertyUsageCount(propertyKey);
            } catch (e) {
                console.error('[PropertySchemaStudio] fetchUsageCount error:', e);
                usageCount.value = 0;
            }
        };

        // ---- Form helpers ----
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
            usageCount.value = 0;
            showForm.value = true;
        };

        const openEditForm = async (schema) => {
            if (schema.deprecated_at) return;
            editingSchema.value = schema;
            formData.value = {
                ...defaultFormData(),
                ...schema,
                options: schema.options ? schema.options.map(o => ({ ...o })) : [],
                applies_to: schema.applies_to || 'both',
                placeholder: schema.placeholder || '',
                description: schema.description || '',
                visible_by_default: schema.visible_by_default !== false,
                is_readonly: !!schema.is_readonly,
                is_mandatory: !!schema.is_mandatory,
            };
            showForm.value = true;
            await fetchUsageCount(schema.property_key);
        };

        const cancelForm = () => {
            showForm.value = false;
            editingSchema.value = null;
            formData.value = defaultFormData();
            usageCount.value = 0;
        };

        // Auto-generate key from label when adding
        watch(
            () => formData.value.property_label,
            (newLabel) => {
                if (!editingSchema.value && !formData.value.property_key) {
                    formData.value.property_key = generateKey(newLabel);
                }
            }
        );

        const saveField = async () => {
            if (!formData.value.property_label || !formData.value.property_key) return;
            saving.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const payload = {
                    ...formData.value,
                    id: editingSchema.value ? editingSchema.value.id : undefined,
                    task_type: formData.value.applies_to,
                };
                await backend.savePropertySchema(payload);
                cancelForm();
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] saveField error:', e);
            } finally {
                saving.value = false;
            }
        };

        // ---- Options ----
        const addOption = () => {
            if (!formData.value.options) formData.value.options = [];
            formData.value.options.push({ label: '', value: '' });
        };

        const removeOption = (index) => {
            formData.value.options.splice(index, 1);
        };

        // ---- Soft Delete ----
        const confirmSoftDelete = async (schema) => {
            softDeleteTarget.value = schema;
            softDeleteUsageCount.value = 0;
            softDeleteDialogOpen.value = true;
            try {
                const backend = BackendFactory.createBackend();
                softDeleteUsageCount.value = await backend.getPropertyUsageCount(schema.property_key);
            } catch (e) {
                softDeleteUsageCount.value = 0;
            }
        };

        const executeSoftDelete = async () => {
            if (!softDeleteTarget.value) return;
            deleting.value = true;
            try {
                const backend = BackendFactory.createBackend();
                await backend.softDeletePropertySchema(softDeleteTarget.value.id);
                softDeleteDialogOpen.value = false;
                softDeleteTarget.value = null;
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] executeSoftDelete error:', e);
            } finally {
                deleting.value = false;
            }
        };

        const restoreSchema = async (schema) => {
            try {
                const backend = BackendFactory.createBackend();
                await backend.savePropertySchema({
                    ...schema,
                    deprecated_at: null,
                });
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] restoreSchema error:', e);
            }
        };

        // ---- Display helpers ----
        const getTypeLabel = (type) => {
            const found = ALL_PROPERTY_TYPES.find(t => t.value === type);
            return found ? found.label : (type || '—');
        };

        const getAppliesToClass = (val) => {
            if (val === 'process') return 'process';
            if (val === 'both') return 'both';
            if (val === 'task') return 'task';
            if (val) return 'specific_task';
            return '';
        };

        const getAppliesToLabel = (val) => {
            const found = APPLIES_TO_OPTIONS.find(o => o.value === val);
            if (found) return locale.value === 'ko' ? (found.labelKo || found.label) : found.label;
            return val || (locale.value === 'ko' ? '프로세스 + Task' : 'Process + Task');
        };

        const truncate = (str, max) => {
            if (!str) return '';
            return str.length > max ? str.slice(0, max) + '…' : str;
        };

        // ---- Init ----
        loadSchemas();

        return {
            // state
            schemas,
            loading,
            saving,
            deleting,
            showForm,
            editingSchema,
            formData,
            usageCount,
            selectedTarget,
            showDeprecated,
            softDeleteDialogOpen,
            softDeleteTarget,
            softDeleteUsageCount,
            // computed
            propertyTypes,
            appliesToOptions,
            filterTargets,
            filteredSchemas,
            // methods
            openAddForm,
            openEditForm,
            cancelForm,
            saveField,
            addOption,
            removeOption,
            confirmSoftDelete,
            executeSoftDelete,
            restoreSchema,
            // display helpers
            getTypeLabel,
            getAppliesToClass,
            getAppliesToLabel,
            truncate,
        };
    },
});
</script>

<style scoped>
/* ── Page Container ── */
.property-schema-studio {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* ── Page Header ── */
.studio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4px;
}

.studio-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.studio-header-icon {
    font-size: 28px;
}

.studio-title {
    font-size: 17px;
    font-weight: 700;
    color: #1f2937;
    line-height: 1.3;
}

.studio-subtitle {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 2px;
}

/* ── Schema Manager Wrapper ── */
.schema-manager {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
}

/* ── Add/Edit Form Card ── */
.add-form-card {
    background: #ffffff;
}

.add-form-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
}

.form-close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.form-close-btn:hover {
    background: #f3f4f6;
    color: #1f2937;
}

.add-form-body {
    padding: 20px;
}

/* ── Form Layout ── */
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

.required-mark {
    color: #ef4444;
    margin-left: 2px;
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
    width: 100%;
    box-sizing: border-box;
}
.form-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
.form-input::placeholder {
    color: #9ca3af;
}
.form-input.input-disabled,
.form-input:disabled {
    background: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
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
    width: 100%;
    box-sizing: border-box;
}
.form-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}
.form-select.input-disabled,
.form-select:disabled {
    background: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
}

.field-hint {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 11px;
    color: #9ca3af;
}

/* ── Type Change Block ── */
.type-blocked-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.type-change-warning {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #d97706;
}

/* ── Checkboxes Row ── */
.form-row-checkboxes {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #4b5563;
    cursor: pointer;
    user-select: none;
}
.checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
}

/* ── Options Section ── */
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
    flex-shrink: 0;
    border: none;
    border-radius: 4px;
    background: #fef2f2;
    color: #ef4444;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.option-remove-btn:hover {
    background: #fee2e2;
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
.option-add-btn:hover {
    background: #eff6ff;
}

/* ── Usage Warning Banner ── */
.usage-warning-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    font-size: 12px;
    color: #92400e;
    margin-bottom: 16px;
}
.usage-warning-banner.mt-3 {
    margin-top: 12px;
}

/* ── Form Actions ── */
.form-actions {
    display: flex;
    gap: 10px;
}

/* ── Filter Row ── */
.filter-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
}

.filter-select-wrapper {
    min-width: 200px;
}

.filter-select {
    padding: 7px 10px;
    font-size: 13px;
}

.filter-toggle-wrapper {
    display: flex;
    align-items: center;
}

/* ── Flat Table ── */
.flat-table-container {
    overflow-x: auto;
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
    padding: 11px 16px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}

.flat-table td {
    padding: 11px 16px;
    border-bottom: 1px solid #f3f4f6;
    color: #4b5563;
    vertical-align: middle;
}

.flat-table tbody tr:last-child td {
    border-bottom: none;
}

.flat-table tbody tr:hover {
    background: #f9fafb;
}

.flat-table tbody tr.deprecated-row {
    opacity: 0.55;
    background: #fafafa;
}

.loading-cell,
.empty-cell {
    text-align: center;
    padding: 40px 16px !important;
    color: #9ca3af;
}

/* ── Key Cell ── */
.key-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.key-text {
    font-family: monospace;
    font-size: 12px;
    color: #374151;
    background: #f3f4f6;
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
}

.deprecated-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 7px;
    background: #fef3c7;
    color: #92400e;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid #fde68a;
}

/* ── Field Name ── */
.field-name {
    font-weight: 500;
    color: #1f2937;
}

/* ── Type Badge ── */
.type-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    white-space: nowrap;
}

/* ── Applies-To Badge ── */
.applies-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    background: #f3f4f6;
    color: #4b5563;
    white-space: nowrap;
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

/* ── Center Cell ── */
.center-cell {
    text-align: center;
}

/* ── Order Badge ── */
.order-badge {
    display: inline-block;
    min-width: 28px;
    padding: 2px 6px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
}

/* ── Description Text ── */
.description-text {
    font-size: 12px;
    color: #6b7280;
    cursor: help;
}

.empty-dash {
    color: #d1d5db;
}

/* ── Actions Cell ── */
.actions-cell {
    text-align: right;
    display: flex;
    justify-content: flex-end;
    align-items: center;
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
    transition: background-color 0.15s;
}
.action-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}
.action-btn:hover:not(:disabled) {
    background: #f3f4f6;
}

.action-edit {
    color: #6b7280;
}
.action-edit:hover:not(:disabled) {
    color: #3b82f6;
    background: #eff6ff !important;
}

.action-deprecate {
    color: #9ca3af;
}
.action-deprecate:hover:not(:disabled) {
    color: #d97706;
    background: #fffbeb !important;
}

.action-restore {
    color: #9ca3af;
}
.action-restore:hover {
    color: #059669;
    background: #d1fae5 !important;
}

/* ── Dialog Body ── */
.dialog-body {
    font-size: 14px;
    color: #374151;
    line-height: 1.6;
}

.target-info {
    font-size: 13px;
    padding: 8px 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #374151;
}

.target-key {
    font-family: monospace;
    color: #374151;
    font-weight: 600;
}

.target-label {
    color: #6b7280;
}

.mt-3 {
    margin-top: 12px;
}
</style>
