<template>
    <div class="schema-manager">
        <!-- Add / Edit Field Dialog -->
        <v-dialog v-model="showAddForm" :fullscreen="isMobile" :max-width="isMobile ? '100%' : '700px'" persistent>
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    {{ editingSchema ? $t('taskCatalog.editProperty') : $t('taskCatalog.addField') }}
                    <v-btn variant="text" density="compact" icon @click="cancelForm">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4">
                    <div :class="isMobile ? 'd-flex flex-column ga-3 mb-3' : 'd-flex ga-4 mb-3'">
                        <v-text-field
                            v-model="formData.property_label"
                            :label="$t('taskCatalog.fieldName') + ' *'"
                            :placeholder="$t('taskCatalog.fieldNamePlaceholder')"
                            variant="outlined"
                            density="compact"
                            hide-details
                            :style="isMobile ? '' : 'flex: 2;'"
                        />
                        <v-select
                            v-model="formData.property_type"
                            :items="propertyTypes"
                            item-title="label"
                            item-value="value"
                            :label="$t('taskCatalog.fieldType')"
                            variant="outlined"
                            density="compact"
                            hide-details
                            :style="isMobile ? '' : 'flex: 1.5;'"
                        />
                        <v-select
                            v-model="formData.applies_to"
                            :items="availableTargets.filter((t) => t.value !== '__all__')"
                            item-title="label"
                            item-value="value"
                            :label="$t('taskCatalog.appliesTo')"
                            variant="outlined"
                            density="compact"
                            hide-details
                            :style="isMobile ? '' : 'flex: 1.5;'"
                        />
                    </div>
                    <div :class="isMobile ? 'd-flex flex-column ga-3 mb-3' : 'd-flex ga-4 mb-3'">
                        <v-text-field
                            v-model="formData.placeholder"
                            :label="$t('taskCatalog.placeholder')"
                            :placeholder="$t('taskCatalog.placeholderPlaceholder')"
                            variant="outlined"
                            density="compact"
                            hide-details
                            :style="isMobile ? '' : 'flex: 2;'"
                        />
                        <v-text-field
                            v-if="formData.property_type === 'db-select' || formData.property_type === 'formula'"
                            v-model="configText"
                            :label="$t('taskCatalog.config')"
                            :placeholder="$t('taskCatalog.configPlaceholder')"
                            variant="outlined"
                            density="compact"
                            hide-details
                            :style="isMobile ? '' : 'flex: 1.5;'"
                        />
                        <div v-else :style="isMobile ? 'display:none;' : 'flex: 1.5;'"></div>
                        <v-text-field
                            v-model.number="formData.display_order"
                            :label="$t('taskCatalog.order')"
                            type="number"
                            min="0"
                            variant="outlined"
                            density="compact"
                            hide-details
                            :style="isMobile ? '' : 'flex: 1;'"
                        />
                    </div>
                    <div class="d-flex ga-4 mb-3">
                        <v-checkbox
                            v-model="formData.is_mandatory"
                            :label="$t('taskCatalog.mandatory')"
                            density="compact"
                            hide-details
                            color="primary"
                        />
                        <v-checkbox
                            v-model="formData.visible_by_default"
                            :label="$t('taskCatalog.visibleByDefault')"
                            density="compact"
                            hide-details
                            color="primary"
                        />
                    </div>
                    <!-- Options for select type -->
                    <div v-if="formData.property_type === 'select'" class="mb-3">
                        <div class="text-subtitle-2 mb-2">{{ $t('taskCatalog.options') }}</div>
                        <div v-for="(option, index) in formData.options" :key="index" class="d-flex ga-2 mb-2 align-center">
                            <v-text-field
                                v-model="option.label"
                                :placeholder="$t('taskCatalog.optionLabel')"
                                variant="outlined"
                                density="compact"
                                hide-details
                            />
                            <v-text-field
                                v-model="option.value"
                                :placeholder="$t('taskCatalog.optionValue')"
                                variant="outlined"
                                density="compact"
                                hide-details
                            />
                            <v-btn icon variant="text" density="compact" color="error" @click="removeOption(index)">
                                <v-icon size="14">mdi-minus</v-icon>
                            </v-btn>
                        </div>
                        <v-btn variant="text" color="primary" size="small" @click="addOption">
                            <v-icon size="14" class="mr-1">mdi-plus</v-icon>
                            {{ $t('taskCatalog.addOption') }}
                        </v-btn>
                    </div>
                </v-card-text>
                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn color="primary" rounded variant="flat" :disabled="!formData.property_label || saving" @click="saveField">
                        <v-progress-circular v-if="saving" indeterminate size="14" width="2" class="mr-1" />
                        {{ editingSchema ? $t('taskCatalog.save') : $t('taskCatalog.addField') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Filter Row -->
        <div :class="isMobile ? 'd-flex flex-column ga-3 mb-5' : 'd-flex align-center justify-space-between mb-5 ga-4'">
            <div :class="isMobile ? '' : 'flex-grow-0'" :style="isMobile ? '' : 'min-width: 250px;'">
                <v-select
                    v-model="selectedTarget"
                    :items="availableTargets"
                    :label="$t('taskCatalog.appliesTo') || '적용 대상'"
                    item-title="label"
                    item-value="value"
                    clearable
                    variant="outlined"
                    density="compact"
                    hide-details
                    :style="isMobile ? '' : 'min-width: 250px;'"
                />
            </div>
            <div class="d-flex ga-2 ml-auto">
                <v-btn
                    variant="flat"
                    rounded
                    color="gray"
                    @click="showLayoutPreview = !showLayoutPreview"
                    :disabled="filteredSchemas.length === 0"
                >
                    <v-icon start size="16">{{ showLayoutPreview ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
                    {{ $t('taskCatalog.layoutPreview') }}
                </v-btn>
                <v-btn color="primary" rounded variant="flat" @click="openAddForm()">
                    <v-icon size="16" class="mr-1">mdi-plus</v-icon>
                    {{ $t('taskCatalog.addField') }}
                </v-btn>
            </div>
        </div>

        <!-- Field Types Guide -->
        <v-alert dense outlined type="info" color="gray" class="mt-4 mb-4 pa-4 pt-2 pb-2">
            <span class="text-body-2 font-weight-bold d-block mb-1">{{ $t('taskCatalog.fieldTypesGuide') }}</span>
            <span class="text-body-2" style="white-space: pre-line">{{
                isMobile ? $t('taskCatalog.fieldTypesGuideText.mobile') : $t('taskCatalog.fieldTypesGuideText.pc')
            }}</span>
        </v-alert>

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
                                    <v-col v-for="schema in row" :key="schema.id" :cols="schema.col_span || 12" class="preview-field">
                                        <div class="field-label-preview">
                                            {{ schema.property_label }}
                                            <span v-if="schema.is_mandatory" class="mandatory-indicator">*</span>
                                        </div>
                                        <div class="field-input" :class="schema.property_type">
                                            <div v-if="schema.property_type === 'textarea'" class="mock-textarea"></div>
                                            <div v-else-if="schema.property_type === 'boolean'" class="mock-switch"></div>
                                            <div
                                                v-else-if="schema.property_type === 'select' || schema.property_type === 'db-select'"
                                                class="mock-select"
                                            >
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

        <!-- Table (Desktop) -->
        <v-card v-if="!isMobile" class="pa-0" variant="outlined">
            <v-table density="comfortable">
                <thead>
                    <tr>
                        <th style="width: 28px"></th>
                        <th>{{ $t('taskCatalog.fieldName') }}</th>
                        <th>{{ $t('taskCatalog.fieldType') }}</th>
                        <th>{{ $t('taskCatalog.appliesTo') }}</th>
                        <th>{{ $t('taskCatalog.config') }}</th>
                        <th style="text-align: center">{{ $t('taskCatalog.mandatory') }}</th>
                        <th style="text-align: center">{{ $t('taskCatalog.visible') }}</th>
                        <th style="width: 80px; text-align: right">{{ $t('taskCatalog.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="8" class="text-center pa-8">
                            <v-progress-circular indeterminate size="32" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="filteredSchemas.length === 0">
                        <td colspan="8" class="text-center pa-8 text-medium-emphasis">
                            {{ $t('taskCatalog.noSchemas') || 'No property schemas found.' }}
                        </td>
                    </tr>
                    <tr v-else v-for="item in filteredSchemas" :key="item.id">
                        <td style="width: 28px; padding: 12px 4px 12px 12px; cursor: grab">
                            <v-icon size="14" color="grey-lighten-1">mdi-drag-vertical</v-icon>
                        </td>
                        <td>
                            <div class="font-weight-medium">{{ item.property_label }}</div>
                            <div v-if="item.placeholder" class="text-caption text-medium-emphasis mt-1">
                                Placeholder: {{ item.placeholder }}
                            </div>
                        </td>
                        <td>
                            <v-chip size="x-small" variant="tonal" color="default" label>{{ getTypeLabel(item.property_type) }}</v-chip>
                        </td>
                        <td>
                            <v-chip size="x-small" variant="tonal" :color="getAppliesToChipColor(item.applies_to)" label>
                                {{ getAppliesToLabel(item.applies_to) }}
                            </v-chip>
                        </td>
                        <td>
                            <span
                                v-if="item.config"
                                class="text-caption"
                                style="font-family: monospace; background: #f5f5f5; padding: 2px 8px; border-radius: 4px"
                            >
                                <template v-if="item.property_type === 'db-select'">DB: {{ item.config.table || '' }}</template>
                                <template v-else-if="item.property_type === 'formula'">{{ item.config.expression || '' }}</template>
                                <template v-else>{{ JSON.stringify(item.config) }}</template>
                            </span>
                        </td>
                        <td style="text-align: center">
                            <v-icon v-if="item.is_mandatory" size="18" color="primary">mdi-checkbox-marked</v-icon>
                            <v-icon v-else size="18" color="grey-lighten-2">mdi-checkbox-blank-outline</v-icon>
                        </td>
                        <td style="text-align: center">
                            <v-icon size="18" :color="item.visible_by_default !== false ? 'primary' : 'grey-lighten-2'">
                                {{ item.visible_by_default !== false ? 'mdi-eye' : 'mdi-eye-off' }}
                            </v-icon>
                        </td>
                        <td style="text-align: right">
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                        @click="openEditForm(item)"
                                    >
                                        <v-icon size="16">mdi-pencil</v-icon>
                                    </v-btn>
                                </template>
                                {{ $t('taskCatalog.editProperty') }}
                            </v-tooltip>
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        class="text-medium-emphasis"
                                        density="comfortable"
                                        @click="confirmDelete(item)"
                                    >
                                        <v-icon color="error">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </template>
                                {{ $t('taskCatalog.delete') }}
                            </v-tooltip>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>

        <!-- Card List (Mobile) -->
        <div v-else>
            <div v-if="loading" class="text-center pa-8">
                <v-progress-circular indeterminate size="32" color="primary" />
            </div>
            <div v-else-if="filteredSchemas.length === 0" class="text-center pa-8 text-medium-emphasis">
                {{ $t('taskCatalog.noSchemas') || 'No property schemas found.' }}
            </div>
            <v-card v-else v-for="item in filteredSchemas" :key="item.id" variant="outlined" class="mb-3">
                <v-card-text class="pa-3 pb-0">
                    <div class="d-flex align-center justify-space-between mb-2">
                        <div class="font-weight-bold text-body-1">{{ item.property_label }}</div>
                        <div class="d-flex ga-1">
                            <v-btn icon variant="text" density="compact" @click="openEditForm(item)">
                                <v-icon size="16">mdi-pencil</v-icon>
                            </v-btn>
                            <v-btn icon variant="text" density="compact" @click="confirmDelete(item)">
                                <v-icon size="16" color="error">mdi-delete-outline</v-icon>
                            </v-btn>
                        </div>
                    </div>
                    <div class="d-flex flex-column ga-1 mb-2">
                        <div class="d-flex align-center">
                            <span class="text-caption text-medium-emphasis" style="min-width: 70px">{{ $t('taskCatalog.fieldType') }}</span>
                            <v-chip size="x-small" variant="tonal" color="default" label>{{ getTypeLabel(item.property_type) }}</v-chip>
                        </div>
                        <div class="d-flex align-center">
                            <span class="text-caption text-medium-emphasis" style="min-width: 70px">{{ $t('taskCatalog.appliesTo') }}</span>
                            <v-chip size="x-small" variant="tonal" :color="getAppliesToChipColor(item.applies_to)" label>{{
                                getAppliesToLabel(item.applies_to)
                            }}</v-chip>
                        </div>
                        <div class="d-flex align-center">
                            <span class="text-caption text-medium-emphasis" style="min-width: 70px">{{ $t('taskCatalog.mandatory') }}</span>
                            <v-icon size="16" :color="item.is_mandatory ? 'primary' : 'grey-lighten-2'">{{
                                item.is_mandatory ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'
                            }}</v-icon>
                        </div>
                        <div class="d-flex align-center">
                            <span class="text-caption text-medium-emphasis" style="min-width: 70px">{{ $t('taskCatalog.visible') }}</span>
                            <v-icon size="16" :color="item.visible_by_default !== false ? 'primary' : 'grey-lighten-2'">{{
                                item.visible_by_default !== false ? 'mdi-eye' : 'mdi-eye-off'
                            }}</v-icon>
                        </div>
                    </div>
                    <div v-if="item.placeholder" class="text-caption text-medium-emphasis mb-1">Placeholder: {{ item.placeholder }}</div>
                    <div v-if="item.config" class="text-caption text-medium-emphasis mb-1" style="font-family: monospace">
                        <template v-if="item.property_type === 'db-select'">DB: {{ item.config.table || '' }}</template>
                        <template v-else-if="item.property_type === 'formula'">{{ item.config.expression || '' }}</template>
                        <template v-else>{{ JSON.stringify(item.config) }}</template>
                    </div>
                </v-card-text>
            </v-card>
        </div>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialogOpen" max-width="400" persistent>
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    {{ $t('taskCatalog.confirmDelete') }}
                    <v-btn variant="text" density="compact" icon @click="deleteDialogOpen = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pb-0">
                    {{ $t('taskCatalog.deleteSchemaConfirm', { name: deletingSchema?.property_label }) }}
                </v-card-text>
                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn color="gray" rounded="pill" variant="flat" @click="deleteDialogOpen = false">{{
                        $t('taskCatalog.cancel')
                    }}</v-btn>
                    <v-btn color="error" rounded variant="flat" :loading="loading" @click="deleteSchema">{{
                        $t('taskCatalog.delete')
                    }}</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { defineComponent, ref, computed, watch, getCurrentInstance, reactive } from 'vue';
import {
    useTaskCatalogStore,
    AVAILABLE_TASK_TYPES,
    PROPERTY_TYPES,
    APPLIES_TO_OPTIONS,
    BUILT_IN_PROPERTY_KEYS
} from '@/stores/taskCatalog';

export default defineComponent({
    name: 'PropertySchemaManager',
    setup() {
        const { proxy } = getCurrentInstance();
        const locale = computed(() => proxy.$i18n?.locale || 'en');
        const store = useTaskCatalogStore();

        const loading = computed(() => store?.loading || false);
        const saving = ref(false);
        const isMobile = computed(() => window.innerWidth <= 768);

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
                ...APPLIES_TO_OPTIONS.map((item) => ({
                    ...item,
                    label: locale.value === 'ko' ? item.labelKo || item.label : item.label
                }))
            ];
        });

        const filteredSchemas = computed(() => {
            let schemas = store.propertySchemas || [];
            schemas = schemas.filter((s) => !BUILT_IN_PROPERTY_KEYS.includes(s.property_key));
            if (selectedTarget.value && selectedTarget.value !== '__all__') {
                schemas = schemas.filter((s) => {
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
            schemas.forEach((schema) => {
                const section = schema.section_name || '__default__';
                if (!sections[section]) sections[section] = {};
                const rowIdx = schema.row_index ?? schema.display_order ?? 0;
                if (!sections[section][rowIdx]) sections[section][rowIdx] = [];
                sections[section][rowIdx].push(schema);
            });
            const result = {};
            Object.keys(sections)
                .sort((a, b) => {
                    if (a === '__default__') return -1;
                    if (b === '__default__') return 1;
                    return a.localeCompare(b);
                })
                .forEach((sectionName) => {
                    const rows = sections[sectionName];
                    result[sectionName] = Object.keys(rows)
                        .sort((a, b) => parseInt(a) - parseInt(b))
                        .map((rowIdx) => rows[rowIdx].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
                });
            return result;
        });

        watch(
            selectedTarget,
            async () => {
                // Load all schemas (no task_type filter)
                if (!store.schemasLoaded) {
                    await store.loadSchemas();
                }
            },
            { immediate: true }
        );

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
                config: schema.config || null
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
            try {
                return JSON.parse(trimmed);
            } catch {
                return { value: trimmed };
            }
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
                    config
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
            const found = PROPERTY_TYPES.find((t) => t.value === type);
            return found ? found.label : type;
        };

        const getAppliesToClass = (val) => {
            if (val === 'process') return 'process';
            if (val === 'both') return 'both';
            if (val === 'task') return 'task';
            return 'specific_task';
        };

        const getAppliesToChipColor = (val) => {
            if (val === 'both') return 'info';
            if (val === 'process') return 'warning';
            if (val === 'task') return 'success';
            return 'secondary';
        };

        const getAppliesToLabel = (val) => {
            const found = APPLIES_TO_OPTIONS.find((o) => o.value === val);
            if (found) return locale.value === 'ko' ? found.labelKo || found.label : found.label;
            return val || (locale.value === 'ko' ? '프로세스 + Task' : 'Process + Task');
        };

        return {
            store,
            loading,
            saving,
            isMobile,
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
            getAppliesToChipColor,
            openAddForm,
            openEditForm,
            cancelForm,
            saveField,
            addOption,
            removeOption,
            confirmDelete,
            deleteSchema,
            getTypeLabel,
            getAppliesToLabel
        };
    }
});
</script>

<style scoped>
.schema-manager {
    padding: 0px;
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
    color: rgb(var(--v-theme-primary));
    margin: 16px 0 12px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
}

.preview-row {
    margin-bottom: 12px;
}
.preview-field {
    padding: 4px 8px;
}

.field-label-preview {
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
    color: #9ca3af;
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
