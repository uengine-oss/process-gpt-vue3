<template>
    <v-card flat class="sk-page-card">
        <!-- Page Header (공통 page-header 패턴) -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">속성 스키마 관리</h1>
            </div>
            <div class="page-header-right">
                <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openAddForm">
                    필드 추가
                </v-btn>
            </div>
        </div>

        <!-- Add / Edit Field Dialog -->
        <v-dialog v-model="showForm" max-width="640" persistent>
            <v-card>
                <v-card-title class="schema-dialog-title">
                    <span>{{ editingSchema ? $t('adminConsole.propertySchema.editField') : $t('adminConsole.propertySchema.addField') }}</span>
                    <button class="form-close-btn" @click="cancelForm">
                        <v-icon size="16">mdi-close</v-icon>
                    </button>
                </v-card-title>
                <v-card-text class="schema-dialog-body">
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
                            <div v-if="editingSchema" class="field-hint field-hint-warning">
                                <v-icon size="12" color="warning">mdi-lock-outline</v-icon>
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
                            <select
                                v-model="formData.property_type"
                                class="form-select"
                                :class="{ 'input-disabled': !!editingSchema }"
                                :disabled="!!editingSchema"
                            >
                                <option v-for="pt in propertyTypes" :key="pt.value" :value="pt.value">{{ pt.label }}</option>
                            </select>
                            <div v-if="editingSchema" class="field-hint field-hint-warning">
                                <v-icon size="12" color="warning">mdi-lock-outline</v-icon>
                                {{ $t('adminConsole.propertySchema.typeChangeBlocked') }}
                            </div>
                        </div>
                        <div class="form-group" style="flex: 1.5;">
                            <label class="form-label">{{ $t('adminConsole.propertySchema.appliesTo') }}</label>
                            <select
                                v-model="formData.applies_to"
                                class="form-select"
                            >
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
                            <input type="checkbox" v-model="formData.is_required" />
                            <span>{{ $t('adminConsole.propertySchema.mandatory') }}</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="formData.visible_by_default" />
                            <span>{{ $t('taskCatalog.visibleByDefault') }}</span>
                        </label>
                    </div>

                    <!-- Row 4-1: Readonly fixed value (is_readonly 체크 시에만 표시) -->
                    <div v-if="formData.is_readonly" class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">
                                {{ $t('taskCatalog.defaultValue') }}
                                <span class="required-mark">*</span>
                            </label>
                            <select
                                v-if="formData.property_type === 'boolean'"
                                v-model="formData.default_value"
                                class="form-select"
                            >
                                <option value="">-</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                            </select>
                            <input
                                v-else-if="formData.property_type === 'number'"
                                v-model="formData.default_value"
                                class="form-input"
                                type="number"
                            />
                            <input
                                v-else-if="formData.property_type === 'date'"
                                v-model="formData.default_value"
                                class="form-input"
                                type="date"
                            />
                            <select
                                v-else-if="formData.property_type === 'select' && formData.select_source_type === 'static'"
                                v-model="formData.default_value"
                                class="form-select"
                            >
                                <option value="">-</option>
                                <option
                                    v-for="opt in formData.options"
                                    :key="opt.value"
                                    :value="opt.value"
                                >
                                    {{ opt.label || opt.value }}
                                </option>
                            </select>
                            <textarea
                                v-else-if="formData.property_type === 'textarea'"
                                v-model="formData.default_value"
                                class="form-input"
                                rows="2"
                            />
                            <input
                                v-else
                                v-model="formData.default_value"
                                class="form-input"
                                type="text"
                            />
                        </div>
                    </div>

                    <!-- Number type settings -->
                    <div v-if="formData.property_type === 'number'" class="type-config-section">
                        <label class="form-label section-label">Number Settings</label>
                        <div class="form-row">
                            <div class="form-group" style="flex: 1;">
                                <label class="form-label">Min</label>
                                <input
                                    v-model.number="formData.number_min"
                                    class="form-input"
                                    type="number"
                                    placeholder="Min"
                                />
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label class="form-label">Max</label>
                                <input
                                    v-model.number="formData.number_max"
                                    class="form-input"
                                    type="number"
                                    placeholder="Max"
                                />
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label class="form-label">Unit</label>
                                <select v-model="formData.number_unit" class="form-select">
                                    <option value="">None</option>
                                    <option v-for="u in numberUnitOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row-checkboxes" style="margin-top: 4px;">
                            <label class="checkbox-label">
                                <input type="checkbox" v-model="formData.number_use_comma" />
                                <span>Thousands Comma (1,000)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Select / MultiSelect settings -->
                    <div v-if="formData.property_type === 'select' || formData.property_type === 'multiselect'" class="type-config-section">
                        <label class="form-label section-label">Options Source</label>
                        <div class="form-row" style="margin-bottom: 10px;">
                            <div class="form-group" style="flex: 1;">
                                <select v-model="formData.select_source_type" class="form-select">
                                    <option value="static">Static Options</option>
                                    <option value="api">External API</option>
                                </select>
                            </div>
                        </div>

                        <!-- Static options -->
                        <div v-if="formData.select_source_type === 'static'" class="options-section">
                            <label class="form-label">{{ $t('taskCatalog.options') }}</label>
                            <div
                                v-for="(option, index) in formData.options"
                                :key="index"
                                class="option-row"
                            >
                                <input
                                    v-model="option.value"
                                    class="form-input"
                                    :placeholder="$t('taskCatalog.optionValue')"
                                />
                                <input
                                    v-model="option.label"
                                    class="form-input"
                                    :placeholder="$t('taskCatalog.optionLabel')"
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

                        <!-- API-based dynamic source -->
                        <div v-if="formData.select_source_type === 'api'" class="options-section">
                            <div class="form-group" style="margin-bottom: 10px;">
                                <label class="form-label">API Endpoint</label>
                                <input
                                    v-model="formData.select_api_endpoint"
                                    class="form-input"
                                    placeholder="https://api.example.com/options"
                                />
                            </div>
                            <div class="form-row">
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">Value Field</label>
                                    <input
                                        v-model="formData.select_api_value_field"
                                        class="form-input"
                                        placeholder="e.g. id"
                                    />
                                </div>
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">Label Field</label>
                                    <input
                                        v-model="formData.select_api_label_field"
                                        class="form-input"
                                        placeholder="e.g. name"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- User type info -->
                    <div v-if="formData.property_type === 'user'" class="type-config-section">
                        <label class="form-label section-label">User Field</label>
                        <div class="type-config-info">
                            <v-icon size="14" color="primary">mdi-account-search-outline</v-icon>
                            <span>조직 기반 사용자 검색 및 담당자 태그 기능이 활성화되어 있나요?</span>
                        </div>
                    </div>

                    <!-- Usage warning (edit mode with usage > 0) -->
                    <div v-if="editingSchema && usageCount > 0" class="data-loss-warning-banner">
                        <div class="data-loss-warning-header">
                            <v-icon size="18" color="error">mdi-alert-outline</v-icon>
                            <span class="data-loss-warning-title">데이터 유실 위험</span>
                            <span class="data-loss-warning-count">사용 중 {{ usageCount }}건</span>
                        </div>
                        <ul class="data-loss-warning-list">
                            <li>라벨·설명 변경은 즉시 모든 프로세스에 반영됩니다.</li>
                            <li>선택지(option) 값 제거 시, 제거된 값을 저장한 기존 데이터는 빈 값으로 표시될 수 있습니다.</li>
                            <li>필수 여부를 켜면 기존 공란 데이터가 있는 프로세스 저장 시 오류가 발생할 수 있습니다.</li>
                            <li>읽기전용 기본값 변경은 기존 값이 있는 프로세스에 소급 적용되지 않습니다.</li>
                        </ul>
                        <label class="data-loss-warning-ack">
                            <input type="checkbox" v-model="riskAckEdit" />
                            <span>위 위험 사항을 확인하였으며 수정을 진행하겠습니다.</span>
                        </label>
                    </div>

                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelForm">
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn
                        color="primary"
                        variant="tonal"
                        :disabled="!formData.property_label || !formData.property_key || saving || (!!editingSchema && usageCount > 0 && !riskAckEdit)"
                        :loading="saving"
                        @click="saveField"
                    >
                        {{ editingSchema ? $t('taskCatalog.save') : $t('adminConsole.propertySchema.addField') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-card-text class="pa-4 pt-0 sk-page-card-text">
            <!-- Filter Row -->
            <div class="filter-row">
                <div class="filter-select-wrapper">
                    <select v-model="selectedTarget" class="form-select filter-select">
                        <option v-for="opt in filterTargets" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                </div>
                <div class="filter-toggle-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="showInactive" />
                        <span>{{ $t('adminConsole.propertySchema.showInactive') }}</span>
                    </label>
                </div>
            </div>

            <!-- Table -->
            <v-data-table
                :headers="schemaTableHeaders"
                :items="filteredSchemas"
                :loading="loading"
                density="compact"
                hover
                :items-per-page="25"
                :items-per-page-options="[25, 50, 100, 200]"
                :row-props="schemaRowProps"
                class="sk-data-table"
            >
                <template #loading>
                    <div class="text-center pa-8">
                        <v-progress-circular indeterminate size="24" color="primary" />
                    </div>
                </template>
                <template #no-data>
                    <div class="text-center pa-8 text-medium-emphasis">
                        {{ $t('taskCatalog.noSchemas') }}
                    </div>
                </template>
                <template #[`item.property_key`]="{ item }">
                    <div class="key-cell">
                        <span class="key-text">{{ item.property_key }}</span>
                        <span v-if="item.deleted_at" class="deprecated-badge">
                            {{ $t('adminConsole.propertySchema.deprecated') }}
                        </span>
                    </div>
                </template>
                <template #[`item.property_label`]="{ item }">
                    <div class="field-name">{{ item.property_label }}</div>
                </template>
                <template #[`item.property_type`]="{ item }">
                    <span class="type-badge">{{ getTypeLabel(item.property_type) }}</span>
                </template>
                <template #[`item.applies_to`]="{ item }">
                    <span class="applies-badge" :class="getAppliesToClass(item.applies_to)">
                        {{ getAppliesToLabel(item.applies_to) }}
                    </span>
                </template>
                <template #[`item.description`]="{ item }">
                    <span v-if="item.description" class="description-text" :title="item.description">
                        {{ truncate(item.description, 40) }}
                    </span>
                    <span v-else class="empty-dash">—</span>
                </template>
                <template #[`item.is_readonly`]="{ item }">
                    <v-icon v-if="item.is_readonly" size="18" color="primary">mdi-checkbox-marked</v-icon>
                    <v-icon v-else size="18" color="grey-lighten-2">mdi-checkbox-blank-outline</v-icon>
                </template>
                <template #[`item.is_required`]="{ item }">
                    <v-icon v-if="item.is_required" size="18" color="primary">mdi-checkbox-marked</v-icon>
                    <v-icon v-else size="18" color="grey-lighten-2">mdi-checkbox-blank-outline</v-icon>
                </template>
                <template #[`item.visible_by_default`]="{ item }">
                    <v-icon
                        size="18"
                        :color="item.visible_by_default !== false ? 'primary' : 'grey-lighten-2'"
                        :class="{ 'visibility-toggle': !item.deleted_at }"
                        @click="!item.deleted_at ? toggleSchemaVisibility(item) : null"
                    >
                        {{ item.visible_by_default !== false ? 'mdi-eye' : 'mdi-eye-off' }}
                    </v-icon>
                </template>
                <template #[`item.display_order`]="{ item }">
                    <span class="order-badge">{{ item.display_order || 0 }}</span>
                </template>
                <template #[`item.actions`]="{ item }">
                    <div class="actions-cell">
                        <v-tooltip :text="$t('taskCatalog.editProperty')" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-pencil"
                                    size="x-small"
                                    variant="text"
                                    class="action-edit"
                                    :disabled="!!item.deleted_at"
                                    @click="openEditForm(item)"
                                />
                            </template>
                        </v-tooltip>
                        <v-tooltip v-if="item.is_active !== false" :text="$t('adminConsole.propertySchema.deactivate')" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-cancel"
                                    size="x-small"
                                    variant="text"
                                    class="action-deactivate"
                                    @click="executeDeactivate(item)"
                                />
                            </template>
                        </v-tooltip>
                        <v-tooltip v-else :text="$t('adminConsole.propertySchema.activate')" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-check-circle-outline"
                                    size="x-small"
                                    variant="text"
                                    class="action-activate"
                                    @click="executeActivate(item)"
                                />
                            </template>
                        </v-tooltip>
                        <v-tooltip :text="$t('taskCatalog.delete')" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-delete-outline"
                                    size="x-small"
                                    variant="text"
                                    class="action-soft-delete"
                                    @click="confirmSoftDelete(item)"
                                />
                            </template>
                        </v-tooltip>
                    </div>
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Soft Delete Confirmation Dialog -->
        <v-dialog v-model="softDeleteDialogOpen" max-width="440">
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6">
                    {{ $t('adminConsole.propertySchema.softDelete') }}
                </v-card-title>
                <v-card-text class="px-6 pb-2">
                    <div class="dialog-body">
                        <p>{{ $t('adminConsole.propertySchema.softDeleteConfirm') }}</p>
                        <div v-if="softDeleteTarget && softDeleteUsageCount > 0" class="data-loss-warning-banner mt-3">
                            <div class="data-loss-warning-header">
                                <v-icon size="18" color="error">mdi-alert-outline</v-icon>
                                <span class="data-loss-warning-title">데이터 유실 위험</span>
                                <span class="data-loss-warning-count">사용 중 {{ softDeleteUsageCount }}건</span>
                            </div>
                            <ul class="data-loss-warning-list">
                                <li>해당 속성은 모든 프로세스 속성 패널에서 <strong>"사용 중단" 읽기전용</strong>으로 전환됩니다.</li>
                                <li>기존에 입력된 값은 보존되지만 <strong>수정이 불가능</strong>해집니다.</li>
                                <li>새로운 프로세스 생성 시 해당 속성은 더 이상 선택할 수 없습니다.</li>
                                <li>휴지통에서 복원하면 활성 상태로 되돌아옵니다.</li>
                            </ul>
                            <div v-if="softDeleteUsageProcesses && softDeleteUsageProcesses.length > 0" class="usage-process-list">
                                <div class="usage-process-list-title">사용 중인 프로세스</div>
                                <ul class="usage-process-list-items">
                                    <li v-for="proc in softDeleteUsageProcesses" :key="proc.id">
                                        <span class="usage-process-name">{{ proc.name }}</span>
                                        <span class="usage-process-scope" :class="getUsedAtClass(proc.usedAt)">
                                            {{ getUsedAtLabel(proc.usedAt) }}
                                        </span>
                                        <ProcessHierarchyOpenButton :id="proc.id" :name="proc.name" />
                                    </li>
                                </ul>
                            </div>
                            <label class="data-loss-warning-ack">
                                <input type="checkbox" v-model="riskAckSoftDelete" />
                                <span>위 위험 사항을 확인하였으며 삭제를 진행하겠습니다.</span>
                            </label>
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
                        color="error"
                        variant="tonal"
                        :disabled="softDeleteUsageCount > 0 && !riskAckSoftDelete"
                        :loading="deleting"
                        @click="executeSoftDelete"
                    >
                        {{ $t('adminConsole.propertySchema.softDelete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
        <!-- Hard Delete Confirmation Dialog (DELETE 타이핑 확인) -->
        <v-dialog v-model="hardDeleteDialogOpen" max-width="480" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6">
                    {{ $t('taskCatalog.delete') }}
                </v-card-title>
                <v-card-text class="px-6 pb-2">
                    <div class="dialog-body">
                        <p>{{ $t('adminConsole.propertySchema.hardDeleteConfirm') }}</p>
                        <div v-if="hardDeleteTarget && hardDeleteUsageCount > 0" class="data-loss-warning-banner critical mt-3">
                            <div class="data-loss-warning-header">
                                <v-icon size="18" color="error">mdi-alert-octagon-outline</v-icon>
                                <span class="data-loss-warning-title">치명적 위험: 복구 불가</span>
                                <span class="data-loss-warning-count">사용 중 {{ hardDeleteUsageCount }}건</span>
                            </div>
                            <ul class="data-loss-warning-list">
                                <li>스키마 정의가 <strong>DB에서 영구적으로 삭제</strong>됩니다.</li>
                                <li>기존 프로세스에 남아있는 값은 <strong>스키마 없이 고아 데이터</strong>로 남게 됩니다.</li>
                                <li>속성 패널에서 더 이상 노출되지 않으며 <strong>복구할 방법이 없습니다</strong>.</li>
                                <li>히스토리·감사 로그 추적이 어려워질 수 있습니다.</li>
                            </ul>
                            <div v-if="hardDeleteUsageProcesses && hardDeleteUsageProcesses.length > 0" class="usage-process-list">
                                <div class="usage-process-list-title">사용 중인 프로세스</div>
                                <ul class="usage-process-list-items">
                                    <li v-for="proc in hardDeleteUsageProcesses" :key="proc.id">
                                        <span class="usage-process-name">{{ proc.name }}</span>
                                        <span class="usage-process-scope" :class="getUsedAtClass(proc.usedAt)">
                                            {{ getUsedAtLabel(proc.usedAt) }}
                                        </span>
                                        <ProcessHierarchyOpenButton :id="proc.id" :name="proc.name" />
                                    </li>
                                </ul>
                            </div>
                            <label class="data-loss-warning-ack">
                                <input type="checkbox" v-model="riskAckHardDelete" />
                                <span>위 치명적 위험을 확인하였으며 영구 삭제를 진행하겠습니다.</span>
                            </label>
                        </div>
                        <div v-if="hardDeleteTarget" class="target-info mt-3">
                            <span class="target-key">{{ hardDeleteTarget.property_key }}</span>
                            &nbsp;/&nbsp;
                            <span class="target-label">{{ hardDeleteTarget.property_label }}</span>
                        </div>
                        <div class="delete-confirm-input mt-3">
                            <label class="form-label">
                                {{ $t('adminConsole.auditTrail.typeDeleteToConfirm') }}
                            </label>
                            <input
                                v-model="deleteConfirmText"
                                class="form-input"
                                :class="{ 'input-error': deleteConfirmText && deleteConfirmText !== 'DELETE' }"
                                placeholder="DELETE"
                                autocomplete="off"
                            />
                        </div>
                    </div>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelHardDelete">
                        {{ $t('taskCatalog.cancel') }}
                    </v-btn>
                    <v-btn
                        color="error"
                        variant="tonal"
                        :disabled="deleteConfirmText !== 'DELETE' || (hardDeleteUsageCount > 0 && !riskAckHardDelete)"
                        :loading="deleting"
                        @click="executeHardDelete"
                    >
                        {{ $t('taskCatalog.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, watch, getCurrentInstance } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { PROPERTY_TYPES, APPLIES_TO_OPTIONS, useTaskCatalogStore } from '@/stores/taskCatalog';
import ProcessHierarchyOpenButton from '@/views/process-hierarchy/ProcessHierarchyOpenButton.vue';

const ALL_PROPERTY_TYPES = PROPERTY_TYPES;

const defaultFormData = () => ({
    property_key: '',
    property_label: '',
    property_type: 'string',
    description: '',
    is_readonly: false,
    is_required: false,
    default_value: '',
    display_order: 0,
    applies_to: 'both',
    placeholder: '',
    visible_by_default: true,
    options: [],
    deleted_at: null,
    deleted_by: null,
    number_min: null,
    number_max: null,
    number_use_comma: false,
    number_unit: '',
    select_source_type: 'static',
    select_api_endpoint: '',
    select_api_label_field: '',
    select_api_value_field: '',
});

export default defineComponent({
    name: 'PropertySchemaStudio',

    components: { ProcessHierarchyOpenButton },

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
        const showInactive = ref(false);

        const softDeleteDialogOpen = ref(false);
        const softDeleteTarget = ref(null);
        const softDeleteUsageCount = ref(0);
        const softDeleteUsageProcesses = ref([]);

        const hardDeleteDialogOpen = ref(false);
        const hardDeleteTarget = ref(null);
        const hardDeleteUsageCount = ref(0);
        const hardDeleteUsageProcesses = ref([]);
        const deleteConfirmText = ref('');

        const riskAckEdit = ref(false);
        const riskAckSoftDelete = ref(false);
        const riskAckHardDelete = ref(false);

        const adminStore = useAdminConsoleStore();
        const taskCatalogStore = useTaskCatalogStore();

        // ---- Constants ----
        const numberUnitOptions = [
            { value: '%', label: '%' },
            { value: 'EA', label: 'EA' },
            { value: 'won', label: '원 (₩)' },
            { value: 'dollar', label: 'Dollar ($)' },
            { value: 'hours', label: 'Hours' },
            { value: 'days', label: 'Days' },
            { value: 'months', label: 'Months' },
            { value: 'kg', label: 'kg' },
            { value: 'km', label: 'km' },
            { value: 'score', label: 'Score' },
            { value: 'FTE', label: 'FTE' },
        ];

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

        // ---- Table Headers ----
        const schemaTableHeaders = computed(() => [
            { title: proxy.$t('adminConsole.propertySchema.fieldKey'), key: 'property_key', sortable: false },
            { title: proxy.$t('adminConsole.propertySchema.fieldLabel'), key: 'property_label', sortable: false },
            { title: proxy.$t('adminConsole.propertySchema.fieldType'), key: 'property_type', sortable: false },
            { title: proxy.$t('adminConsole.propertySchema.appliesTo'), key: 'applies_to', sortable: false },
            { title: proxy.$t('adminConsole.propertySchema.description'), key: 'description', sortable: false },
            { title: proxy.$t('adminConsole.propertySchema.readonly'), key: 'is_readonly', align: 'center', sortable: false },
            { title: proxy.$t('adminConsole.propertySchema.mandatory'), key: 'is_required', align: 'center', sortable: false },
            { title: proxy.$t('taskCatalog.visible'), key: 'visible_by_default', align: 'center', sortable: false },
            { title: proxy.$t('adminConsole.propertySchema.order'), key: 'display_order', align: 'center', sortable: false },
            { title: proxy.$t('taskCatalog.actions'), key: 'actions', align: 'end', width: '120px', sortable: false },
        ]);

        const schemaRowProps = ({ item }) => {
            return item.deleted_at ? { class: 'deprecated-row' } : {};
        };

        // ---- Computed ----
        const filteredSchemas = computed(() => {
            let list = schemas.value || [];

            // 휴지통(Soft Delete)된 스키마는 기본 목록에서 숨김
            list = list.filter(s => !s.deleted_at);

            // 비활성화 스키마: 기본 숨김, 토글 시 해당 항목만 노출
            if (showInactive.value) {
                list = list.filter(s => s.is_active === false);
            } else {
                list = list.filter(s => s.is_active !== false);
            }

            // Target filter
            if (selectedTarget.value && selectedTarget.value !== '__all__') {
                list = list.filter(s => {
                    const at = s.applies_to || 'both';
                    return at === selectedTarget.value;
                });
            }

            return list.slice().sort((a, b) => {
                const aTime = getSchemaTimestamp(a);
                const bTime = getSchemaTimestamp(b);
                if (aTime !== bTime) return bTime - aTime;
                return (a.display_order || 0) - (b.display_order || 0);
            });
        });

        function getSchemaTimestamp(schema) {
            const raw = schema?.created_at || schema?.updated_at;
            if (!raw) return 0;

            const timestamp = new Date(raw).getTime();
            return Number.isFinite(timestamp) ? timestamp : 0;
        }

        // ---- API ----
        const loadSchemas = async () => {
            loading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.getPropertySchemas();
                schemas.value = result || [];
                taskCatalogStore.propertySchemas = result || [];
                taskCatalogStore.schemasLoaded = true;
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
            if (schema.deleted_at) return;
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
                is_required: !!schema.is_required,
                default_value: schema.default_value ?? '',
                number_min: schema.number_min ?? null,
                number_max: schema.number_max ?? null,
                number_use_comma: !!schema.number_use_comma,
                number_unit: schema.number_unit || '',
                select_source_type: schema.select_source_type || 'static',
                select_api_endpoint: schema.select_api_endpoint || '',
                select_api_label_field: schema.select_api_label_field || '',
                select_api_value_field: schema.select_api_value_field || '',
            };
            showForm.value = true;
            await fetchUsageCount(schema.property_key);
        };

        const cancelForm = () => {
            showForm.value = false;
            editingSchema.value = null;
            formData.value = defaultFormData();
            usageCount.value = 0;
            riskAckEdit.value = false;
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
            if (!editingSchema.value) {
                const duplicate = schemas.value.find(s => s.property_key === formData.value.property_key);
                if (duplicate) {
                    proxy.$try({
                        action: async () => {},
                        warningMsg: proxy.$t('adminConsole.propertySchema.duplicateKeyWarning'),
                    });
                    return;
                }
            }
            if (formData.value.is_readonly) {
                const rawDefault = formData.value.default_value;
                const hasValue = rawDefault !== null && rawDefault !== undefined && String(rawDefault).trim() !== '';
                if (!hasValue) {
                    proxy.$try({
                        action: async () => {},
                        warningMsg: '읽기전용으로 지정된 속성은 기본값을 입력해야 합니다.',
                    });
                    return;
                }
            }
            saving.value = true;
            try {
                const isEdit = !!editingSchema.value;
                const beforeSnapshot = isEdit ? { ...editingSchema.value } : null;
                const backend = BackendFactory.createBackend();
                const payload = {
                    ...formData.value,
                    id: editingSchema.value ? editingSchema.value.id : undefined,
                    task_type: formData.value.applies_to,
                };
                if (isEdit && beforeSnapshot && beforeSnapshot.property_type) {
                    if (payload.property_type !== beforeSnapshot.property_type) {
                        proxy.$try({
                            action: async () => {},
                            warningMsg: proxy.$t('adminConsole.propertySchema.typeChangeBlocked'),
                        });
                        saving.value = false;
                        return;
                    }
                    payload.property_type = beforeSnapshot.property_type;
                }
                await backend.savePropertySchema(payload);
                if (!isEdit && typeof backend.backfillProcessDefinitionNullForProperty === 'function') {
                    try {
                        await backend.backfillProcessDefinitionNullForProperty(payload.property_key, payload.applies_to);
                    } catch (backfillError) {
                        console.warn('[PropertySchemaStudio] backfill null failed:', backfillError);
                    }
                }
                adminStore.writeAdminAuditLog({
                    action: isEdit ? 'schema_update' : 'schema_create',
                    target_type: 'property_schema',
                    target_id: formData.value.property_key,
                    target_name: formData.value.property_label,
                    before_value: beforeSnapshot,
                    after_value: payload,
                });
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

        // ---- Visibility quick toggle ----
        const toggleSchemaVisibility = async (schema) => {
            const nextVisible = schema.visible_by_default === false;
            try {
                const backend = BackendFactory.createBackend();
                await backend.savePropertySchema({ ...schema, visible_by_default: nextVisible });
                adminStore.writeAdminAuditLog({
                    action: 'schema_update',
                    target_type: 'property_schema',
                    target_id: schema.property_key,
                    target_name: schema.property_label,
                    before_value: { visible_by_default: !nextVisible },
                    after_value: { visible_by_default: nextVisible },
                    comment: '속성 패널 노출 토글',
                });
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] toggleSchemaVisibility error:', e);
            }
        };

        // ---- Soft Delete ----
        const confirmSoftDelete = async (schema) => {
            softDeleteTarget.value = schema;
            softDeleteUsageCount.value = 0;
            softDeleteUsageProcesses.value = [];
            riskAckSoftDelete.value = false;
            softDeleteDialogOpen.value = true;
            try {
                const backend = BackendFactory.createBackend();
                if (typeof backend.getPropertyUsageProcesses === 'function') {
                    const list = await backend.getPropertyUsageProcesses(schema.property_key);
                    softDeleteUsageProcesses.value = Array.isArray(list) ? list : [];
                    softDeleteUsageCount.value = softDeleteUsageProcesses.value.length;
                } else {
                    softDeleteUsageCount.value = await backend.getPropertyUsageCount(schema.property_key);
                }
            } catch (e) {
                softDeleteUsageCount.value = 0;
                softDeleteUsageProcesses.value = [];
            }
        };

        const executeSoftDelete = async () => {
            if (!softDeleteTarget.value) return;
            deleting.value = true;
            try {
                const target = softDeleteTarget.value;
                const backend = BackendFactory.createBackend();
                await backend.softDeletePropertySchema(target.id);
                adminStore.writeAdminAuditLog({
                    action: 'schema_soft_delete',
                    target_type: 'property_schema',
                    target_id: target.property_key,
                    target_name: target.property_label,
                    before_value: { deleted_at: null },
                    after_value: { deleted_at: new Date().toISOString() },
                });
                softDeleteDialogOpen.value = false;
                softDeleteTarget.value = null;
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] executeSoftDelete error:', e);
            } finally {
                deleting.value = false;
            }
        };

        const executeDeactivate = async (schema) => {
            try {
                const backend = BackendFactory.createBackend();
                await backend.deactivatePropertySchema(schema.id);
                adminStore.writeAdminAuditLog({
                    action: 'schema_deactivate',
                    target_type: 'property_schema',
                    target_id: schema.property_key,
                    target_name: schema.property_label,
                    before_value: { is_active: true },
                    after_value: { is_active: false },
                });
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] executeDeactivate error:', e);
            }
        };

        const executeActivate = async (schema) => {
            try {
                const backend = BackendFactory.createBackend();
                await backend.activatePropertySchema(schema.id);
                adminStore.writeAdminAuditLog({
                    action: 'schema_activate',
                    target_type: 'property_schema',
                    target_id: schema.property_key,
                    target_name: schema.property_label,
                    before_value: { is_active: false },
                    after_value: { is_active: true },
                });
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] executeActivate error:', e);
            }
        };

        // ---- Hard Delete ----
        const confirmHardDelete = async (schema) => {
            hardDeleteTarget.value = schema;
            hardDeleteUsageCount.value = 0;
            hardDeleteUsageProcesses.value = [];
            deleteConfirmText.value = '';
            riskAckHardDelete.value = false;
            hardDeleteDialogOpen.value = true;
            try {
                const backend = BackendFactory.createBackend();
                if (typeof backend.getPropertyUsageProcesses === 'function') {
                    const list = await backend.getPropertyUsageProcesses(schema.property_key);
                    hardDeleteUsageProcesses.value = Array.isArray(list) ? list : [];
                    hardDeleteUsageCount.value = hardDeleteUsageProcesses.value.length;
                } else {
                    hardDeleteUsageCount.value = await backend.getPropertyUsageCount(schema.property_key);
                }
            } catch (e) {
                hardDeleteUsageCount.value = 0;
                hardDeleteUsageProcesses.value = [];
            }
        };

        const cancelHardDelete = () => {
            hardDeleteDialogOpen.value = false;
            hardDeleteTarget.value = null;
            deleteConfirmText.value = '';
            riskAckHardDelete.value = false;
        };

        const executeHardDelete = async () => {
            if (!hardDeleteTarget.value || deleteConfirmText.value !== 'DELETE') return;
            deleting.value = true;
            try {
                const target = hardDeleteTarget.value;
                const backend = BackendFactory.createBackend();
                await backend.deletePropertySchema(target.id);
                adminStore.writeAdminAuditLog({
                    action: 'schema_hard_delete',
                    target_type: 'property_schema',
                    target_id: target.property_key,
                    target_name: target.property_label,
                    before_value: target,
                    after_value: null,
                    comment: 'DELETE 타이핑 확인 후 영구 삭제',
                });
                hardDeleteDialogOpen.value = false;
                hardDeleteTarget.value = null;
                deleteConfirmText.value = '';
                await loadSchemas();
            } catch (e) {
                console.error('[PropertySchemaStudio] executeHardDelete error:', e);
            } finally {
                deleting.value = false;
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

        const getUsedAtLabel = (usedAt) => {
            if (usedAt === 'process') return '프로세스';
            if (usedAt === 'task') return 'Task';
            if (usedAt === 'both') return '프로세스 + Task';
            return '—';
        };

        const getUsedAtClass = (usedAt) => {
            if (usedAt === 'process') return 'scope-process';
            if (usedAt === 'task') return 'scope-task';
            if (usedAt === 'both') return 'scope-both';
            return '';
        };

        // ---- Init ----
        const init = async () => {
            await loadSchemas();
            try {
                // 전용 패널 위젯도 사용자 정의 속성으로 통합하고 레거시 builtin 행을 변환한다.
                const seeded = await taskCatalogStore.syncPanelPropertySchemas();
                if (seeded > 0) await loadSchemas();
            } catch (e) {
                console.warn('[PropertySchemaStudio] syncPanelPropertySchemas failed:', e);
            }
        };
        init();

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
            showInactive,
            softDeleteDialogOpen,
            softDeleteTarget,
            softDeleteUsageCount,
            softDeleteUsageProcesses,
            hardDeleteDialogOpen,
            hardDeleteTarget,
            hardDeleteUsageCount,
            hardDeleteUsageProcesses,
            deleteConfirmText,
            riskAckEdit,
            riskAckSoftDelete,
            riskAckHardDelete,
            // computed
            schemaTableHeaders,
            schemaRowProps,
            propertyTypes,
            numberUnitOptions,
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
            toggleSchemaVisibility,
            confirmHardDelete,
            cancelHardDelete,
            executeHardDelete,
            executeDeactivate,
            executeActivate,
            // display helpers
            getTypeLabel,
            getAppliesToClass,
            getAppliesToLabel,
            truncate,
            getUsedAtLabel,
            getUsedAtClass
        };
    },
});
</script>

<style scoped>
/* sk-page-card / sk-page-card-text / sk-data-table / page-header 계열 클래스는
   src/assets/css/SKGlobalStyle.scss 에 글로벌 정의되어 있음 */

/* filter-row 는 v-row 가 아니라서 글로벌 'flex: 0 0 auto' 규칙이 안 잡힘 → 직접 부여 */
.sk-page-card-text > .filter-row {
    flex: 0 0 auto !important;
}

.visibility-toggle {
    cursor: pointer;
}

/* ── Schema Dialog ── */
.schema-dialog-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px !important;
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
}

.schema-dialog-body {
    padding: 0 20px 8px !important;
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

/* ── Type Change Block (Orange hint, same layout as id field-hint) ── */
.field-hint-warning {
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

/* ── Type Config Section ── */
.type-config-section {
    margin-bottom: 16px;
    padding: 12px 14px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}

.type-config-section .section-label {
    font-weight: 600;
    color: #374151;
    margin-bottom: 10px;
    font-size: 12px;
}

.type-config-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #6b7280;
    padding: 8px 0 2px;
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

/* ── Data Loss Risk Warning Banner ── */
.data-loss-warning-banner {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-left: 4px solid #ef4444;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 16px;
}
.data-loss-warning-banner.mt-3 {
    margin-top: 12px;
}
.data-loss-warning-banner.critical {
    background: #fee2e2;
    border-color: #f87171;
    border-left-color: #dc2626;
}
.data-loss-warning-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.data-loss-warning-title {
    font-size: 13px;
    font-weight: 700;
    color: #b91c1c;
}
.data-loss-warning-count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    color: #ffffff;
    background: #dc2626;
    padding: 2px 8px;
    border-radius: 10px;
}
.data-loss-warning-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    line-height: 1.6;
    color: #7f1d1d;
}
.data-loss-warning-list li {
    margin-bottom: 2px;
}
.data-loss-warning-list li:last-child {
    margin-bottom: 0;
}
.data-loss-warning-list strong {
    font-weight: 700;
    color: #991b1b;
}
.data-loss-warning-ack {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #fca5a5;
    font-size: 12px;
    font-weight: 600;
    color: #7f1d1d;
    cursor: pointer;
}
.data-loss-warning-ack input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #dc2626;
    cursor: pointer;
}
.data-loss-warning-banner.critical .data-loss-warning-ack {
    border-top-color: #f87171;
}

.usage-process-list {
    margin-top: 10px;
    padding: 8px 10px;
    background: #fff5f5;
    border: 1px solid #fecaca;
    border-radius: 6px;
}
.usage-process-list-title {
    font-size: 12px;
    font-weight: 700;
    color: #991b1b;
    margin-bottom: 4px;
}
.usage-process-list-items {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    line-height: 1.6;
    color: #7f1d1d;
    max-height: 140px;
    overflow-y: auto;
}
.usage-process-list-items li {
    margin-bottom: 2px;
    word-break: break-all;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.usage-process-list-items li:last-child {
    margin-bottom: 0;
}
.usage-process-name {
    flex: 1;
    min-width: 0;
}
.usage-process-scope {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
    border: 1px solid transparent;
}
.usage-process-scope.scope-process {
    background: #fef3c7;
    color: #92400e;
    border-color: #fde68a;
}
.usage-process-scope.scope-task {
    background: #dbeafe;
    color: #1e40af;
    border-color: #bfdbfe;
}
.usage-process-scope.scope-both {
    background: #ede9fe;
    color: #6d28d9;
    border-color: #ddd6fe;
}
.data-loss-warning-banner.critical .usage-process-list {
    background: #fef2f2;
    border-color: #fca5a5;
}

/* ── Filter Row ── */
.filter-row {
    display: flex;
    align-items: center;
    padding: 16px 0px 16px 0px;
    gap: 16px;
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

/* deprecated 행 — sk-data-table 의 row 톤 위에 페이지 고유 표시 */
:deep(tr.deprecated-row) {
    opacity: 0.55;
    background: #fafafa;
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

.action-edit {
    color: #6b7280 !important;
}
.action-edit:hover:not(:disabled) {
    color: #3b82f6 !important;
}

.action-deprecate {
    color: #d97706 !important;
}
.action-deprecate:hover:not(:disabled) {
    color: #b45309 !important;
}

.action-deactivate {
    color: #d97706 !important;
}
.action-deactivate:hover:not(:disabled) {
    color: #b45309 !important;
}

.action-activate {
    color: #9ca3af !important;
}
.action-activate:hover:not(:disabled) {
    color: #059669 !important;
}

.action-restore {
    color: #9ca3af !important;
}
.action-restore:hover {
    color: #059669 !important;
}

.action-soft-delete {
    color: #ef4444 !important;
}
.action-soft-delete:hover:not(:disabled) {
    color: #dc2626 !important;
}

.action-hard-delete {
    color: #ef4444 !important;
}
.action-hard-delete:hover {
    color: #dc2626 !important;
}

.delete-confirm-input {
    margin-top: 12px;
}

.form-input.input-error {
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
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
