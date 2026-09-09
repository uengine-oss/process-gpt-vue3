<template>
    <v-card flat class="sk-page-card">
        <!-- ───────────── 페이지 헤더 ───────────── -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">속성 스키마 관리</h1>
                <p class="page-subtitle">프로세스 순서도 속성패널의 입력 필드를 그룹(묶음) 단위로 정의하고, 태스크 유형별로 실제 표시 형태를 미리 확인합니다.</p>
            </div>
            <div class="page-header-right">
                <input ref="importFileInput" type="file" accept=".json,application/json" style="display: none" @change="onImportFilePicked" />
                <v-btn size="small" variant="tonal" class="text-none mr-2" prepend-icon="mdi-tray-arrow-down" @click="exportTemplate"> 내보내기 </v-btn>
                <v-btn size="small" variant="tonal" class="text-none mr-2" prepend-icon="mdi-tray-arrow-up" @click="$refs.importFileInput.click()"> 가져오기 </v-btn>
                <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openAddForm"> 필드 추가 </v-btn>
            </div>
        </div>

        <!-- sk-page-card-text 는 전역에서 column flex + overflow hidden 이므로
             내부에 .studio-split(row) 을 둬 좌 목록 / 우 미리보기를 나누고 각각 자체 스크롤한다 -->
        <v-card-text class="pa-4 pt-2 sk-page-card-text">
            <!-- 툴바 (고정) -->
            <div class="filter-row">
                <select v-model="selectedTarget" class="form-select filter-select">
                    <option v-for="opt in filterTargets" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <input v-model="searchText" class="form-input filter-search" placeholder="키 · 라벨 · 설명 검색" />
                <label class="checkbox-label">
                    <input type="checkbox" v-model="showInactive" />
                    <span>{{ $t('adminConsole.propertySchema.showInactive') }}</span>
                </label>
            </div>

            <div class="studio-split">
                <!-- ───────────── 좌: 필드 목록 (자체 스크롤) ───────────── -->
                <div class="studio-list">
                <div v-if="loading" class="text-center pa-8">
                    <v-progress-circular indeterminate size="24" color="primary" />
                </div>

                <template v-else>
                    <!-- 모든 속성(내장 이관분 포함)을 대상(scope)별 카드 하나로 통합 관리한다.
                         카드 내 순서 = display_order = 실제 속성패널의 섹션/필드 순서. -->
                    <div v-if="scopeCards.length === 0" class="empty-note">
                        {{ $t('taskCatalog.noSchemas') }}
                    </div>
                    <div v-for="card in scopeCards" :key="card.scope" class="group-card">
                        <div class="group-card-header">
                            <v-icon size="15" color="primary">{{ card.icon }}</v-icon>
                            <span class="group-card-title">{{ card.label }}</span>
                            <span class="group-card-count">{{ card.fields.length }}</span>
                            <span class="group-card-hint">순서(display_order)가 속성패널 표시 순서입니다</span>
                        </div>
                        <div
                            v-for="item in card.fields"
                            :key="item.id"
                            class="field-row"
                            :class="{ 'field-row--inactive': item.is_active === false }"
                        >
                            <div class="field-row-main">
                                <div class="field-row-top">
                                    <span class="field-name">{{ item.property_label }}</span>
                                    <code class="field-key">{{ item.property_key }}</code>
                                    <span class="type-badge">{{ getTypeLabel(item.property_type) }}</span>
                                    <span v-if="isDedicatedPanelSchema(item)" class="panel-renderer-badge">{{ getPanelTabLabel(item) }} · {{ item.config?.widget || '전용' }} 위젯</span>
                                    <span v-if="item.group_label" class="summary-chip">그룹: {{ item.group_label }}</span>
                                    <span v-if="item.is_active === false" class="inactive-badge">비활성</span>
                                </div>
                                <div class="field-row-summary">
                                    <span v-for="(chip, i) in settingSummary(item)" :key="i" class="summary-chip">{{ chip }}</span>
                                    <span v-if="item.description" class="description-text" :title="item.description">{{ truncate(item.description, 60) }}</span>
                                </div>
                            </div>
                            <div class="field-row-flags">
                                <v-icon v-if="item.is_required" size="15" color="error">mdi-asterisk</v-icon>
                                <v-icon v-if="item.is_readonly" size="15" color="primary">mdi-lock-outline</v-icon>
                                <span class="order-badge">{{ item.display_order || 0 }}</span>
                            </div>
                            <div class="actions-cell">
                                <v-icon
                                    size="18"
                                    :color="item.visible_by_default !== false ? 'primary' : 'grey-lighten-2'"
                                    class="visibility-toggle"
                                    @click="toggleSchemaVisibility(item)"
                                >
                                    {{ item.visible_by_default !== false ? 'mdi-eye' : 'mdi-eye-off' }}
                                </v-icon>
                                <v-btn icon="mdi-pencil" size="x-small" variant="text" class="action-edit" @click="openEditForm(item)" />
                                <v-btn
                                    v-if="item.is_active !== false"
                                    icon="mdi-cancel"
                                    size="x-small"
                                    variant="text"
                                    class="action-deactivate"
                                    @click="executeDeactivate(item)"
                                />
                                <v-btn v-else icon="mdi-check-circle-outline" size="x-small" variant="text" class="action-activate" @click="executeActivate(item)" />
                                <v-btn icon="mdi-delete-outline" size="x-small" variant="text" class="action-soft-delete" @click="confirmSoftDelete(item)" />
                                <v-btn
                                    v-if="!isDedicatedPanelSchema(item)"
                                    icon="mdi-delete-forever-outline"
                                    size="x-small"
                                    variant="text"
                                    class="action-soft-delete"
                                    @click="confirmHardDelete(item)"
                                />
                            </div>
                        </div>
                    </div>
                </template>
                </div>

                <!-- ───────────── 우: 태스크 유형별 미리보기 (상시 도킹, 자체 스크롤) ───────────── -->
                <div class="studio-preview">
                <div class="preview-header">
                    <v-icon size="16" color="primary">mdi-monitor-eye</v-icon>
                    <span>속성패널 미리보기</span>
                </div>
                <select v-model="previewScope" class="form-select preview-scope-select">
                    <option v-for="opt in previewScopeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>

                <!-- 패널과 동일한 섹션 구성·순서(display_order)·스타일(section-group)로 렌더한다.
                     단순 입력 행은 실제 렌더러(SchemaFieldInput)로, 복합 전용 위젯 행은 자리표시로 표시. -->
                <div class="preview-panel">
                    <template v-if="previewSections.length === 0">
                        <div class="empty-note">이 대상에 표시되는 속성이 없습니다.</div>
                    </template>
                    <div v-for="sec in previewSections" :key="sec.id + previewScope" class="section-group">
                        <div class="section-title" @click="togglePreviewSection(sec.id)">
                            <v-icon size="14" class="mr-1">{{ isPreviewSectionOpen(sec.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                            <v-icon size="14" class="mr-1" :color="sec.iconColor">{{ sec.icon }}</v-icon>
                            {{ sec.label }}
                        </div>
                        <div v-show="isPreviewSectionOpen(sec.id)" class="section-body">
                            <template v-for="item in sec.items" :key="item.id + previewScope">
                                <SchemaFieldInput v-if="item.kind === 'field'" :field="item.field" :model="previewModel" preview />
                                <div v-else class="preview-widget-placeholder">
                                    <v-icon size="14" color="grey">mdi-puzzle-outline</v-icon>
                                    <span class="preview-widget-label">{{ item.label }}</span>
                                    <span class="preview-widget-badge">{{ item.widget }} 전용 위젯</span>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </v-card-text>

        <!-- ───────────── 추가 / 수정 다이얼로그 ───────────── -->
        <v-dialog v-model="showForm" max-width="920" persistent>
            <v-card>
                <v-card-title class="schema-dialog-title">
                    <span>{{ editingSchema ? $t('adminConsole.propertySchema.editField') : $t('adminConsole.propertySchema.addField') }}</span>
                    <button class="form-close-btn" @click="cancelForm">
                        <v-icon size="16">mdi-close</v-icon>
                    </button>
                </v-card-title>
                <v-card-text class="schema-dialog-body">
                    <div class="dialog-split">
                        <div class="dialog-form">
                            <div v-if="editingSchema && isDedicatedPanelSchema(editingSchema)" class="panel-renderer-notice">
                                <v-icon size="16" color="primary">mdi-view-dashboard-outline</v-icon>
                                <span>
                                    이 속성은 기존 {{ getPanelTabLabel(editingSchema) }} 패널의
                                    {{ editingSchema.config?.widget || '전용' }} UI로 표시됩니다.
                                    라벨 · 설명 · placeholder · 필수 · 읽기전용 · 노출 설정이 패널에 반영되며,
                                    단순 입력형(프로세스명 · 설명 · 이름 등)은 사용자 정의 필드와 동일한 렌더러로 그려집니다.
                                    복합 위젯(담당자 설정 · RACI · FTE 계산기 등)은 라벨 · 노출만 적용됩니다.
                                </span>
                            </div>

                            <!-- Row 1: key + label -->
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
                                    <input v-model="formData.property_label" class="form-input" :placeholder="$t('taskCatalog.fieldNamePlaceholder')" />
                                </div>
                            </div>

                            <!-- Row 2: type + applies_to + order -->
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
                                    <select v-model="formData.applies_to" class="form-select">
                                        <option v-for="opt in appliesToOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                    </select>
                                </div>
                                <div class="form-group" style="flex: 0.6;">
                                    <label class="form-label">{{ $t('adminConsole.propertySchema.order') }}</label>
                                    <input v-model.number="formData.display_order" class="form-input" type="number" min="0" style="width: 100%;" />
                                </div>
                            </div>

                            <!-- Row 2-1: 그룹(묶음) — 속성패널의 "일반 - 이름, 설명" 처럼 섹션으로 묶는다 -->
                            <div v-if="!isPanelForm" class="form-row">
                                <div class="form-group" style="flex: 2;">
                                    <label class="form-label">그룹 (묶음)</label>
                                    <input
                                        v-model="formData.group_label"
                                        class="form-input"
                                        list="schema-group-suggestions"
                                        placeholder="비워두면 일반 섹션에 표시 · 입력하면 해당 이름의 섹션으로 묶임"
                                    />
                                    <datalist id="schema-group-suggestions">
                                        <option v-for="g in existingGroupLabels" :key="g" :value="g" />
                                    </datalist>
                                </div>
                                <div class="form-group" style="flex: 0.6;">
                                    <label class="form-label">그룹 순서</label>
                                    <input v-model.number="formData.group_order" class="form-input" type="number" min="0" style="width: 100%;" />
                                </div>
                            </div>

                            <!-- Row 2-2: 조건부 표시 -->
                            <div v-if="!isPanelForm" class="form-row">
                                <div class="form-group" style="flex: 1.2;">
                                    <label class="form-label">표시 조건 — 대상 필드</label>
                                    <input
                                        v-model="formData.cond_field"
                                        class="form-input"
                                        list="schema-cond-field-suggestions"
                                        placeholder="비우면 항상 표시 (같은 영역의 property_key)"
                                    />
                                    <datalist id="schema-cond-field-suggestions">
                                        <option v-for="k in condFieldSuggestions" :key="k" :value="k" />
                                    </datalist>
                                </div>
                                <div class="form-group" style="flex: 0.8;">
                                    <label class="form-label">연산자</label>
                                    <select v-model="formData.cond_op" class="form-select">
                                        <option value="eq">= 같음</option>
                                        <option value="ne">≠ 다름</option>
                                        <option value="contains">포함</option>
                                        <option value="not_empty">값 있음</option>
                                        <option value="empty">값 없음</option>
                                    </select>
                                </div>
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">비교 값</label>
                                    <input
                                        v-model="formData.cond_value"
                                        class="form-input"
                                        :disabled="formData.cond_op === 'not_empty' || formData.cond_op === 'empty'"
                                        placeholder="예: 예"
                                    />
                                </div>
                            </div>

                            <!-- Row 3: description + placeholder -->
                            <div class="form-row">
                                <div class="form-group" style="flex: 1.5;">
                                    <label class="form-label">{{ $t('adminConsole.propertySchema.description') }}</label>
                                    <input v-model="formData.description" class="form-input" :placeholder="$t('adminConsole.propertySchema.descriptionPlaceholder')" />
                                </div>
                                <div class="form-group" style="flex: 1.5;">
                                    <label class="form-label">{{ $t('taskCatalog.placeholder') }}</label>
                                    <input v-model="formData.placeholder" class="form-input" :placeholder="$t('taskCatalog.placeholderPlaceholder')" />
                                </div>
                            </div>

                            <!-- Row 4: 체크박스 -->
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

                            <!-- 읽기전용 기본값 (전용 패널 위젯은 기본값을 소비하지 않음) -->
                            <div v-if="formData.is_readonly && !isPanelForm" class="form-row">
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label">
                                        {{ $t('taskCatalog.defaultValue') }}
                                        <span class="required-mark">*</span>
                                    </label>
                                    <select v-if="formData.property_type === 'boolean'" v-model="formData.default_value" class="form-select">
                                        <option value="">-</option>
                                        <option value="true">true</option>
                                        <option value="false">false</option>
                                    </select>
                                    <input v-else-if="formData.property_type === 'number'" v-model="formData.default_value" class="form-input" type="number" />
                                    <input v-else-if="formData.property_type === 'date'" v-model="formData.default_value" class="form-input" type="date" />
                                    <select
                                        v-else-if="formData.property_type === 'select' && formData.select_source_type === 'static'"
                                        v-model="formData.default_value"
                                        class="form-select"
                                    >
                                        <option value="">-</option>
                                        <option v-for="opt in formData.options" :key="opt.value" :value="opt.value">{{ opt.label || opt.value }}</option>
                                    </select>
                                    <textarea v-else-if="formData.property_type === 'textarea'" v-model="formData.default_value" class="form-input" rows="2" />
                                    <input v-else v-model="formData.default_value" class="form-input" type="text" />
                                </div>
                            </div>

                            <!-- Number 설정 -->
                            <div v-if="formData.property_type === 'number' && !isPanelForm" class="type-config-section">
                                <label class="form-label section-label">Number Settings</label>
                                <div class="form-row">
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Min</label>
                                        <input v-model.number="formData.number_min" class="form-input" type="number" placeholder="Min" />
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Max</label>
                                        <input v-model.number="formData.number_max" class="form-input" type="number" placeholder="Max" />
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

                            <!-- Select / MultiSelect 설정 -->
                            <div v-if="(formData.property_type === 'select' || formData.property_type === 'multiselect') && !isPanelForm" class="type-config-section">
                                <label class="form-label section-label">Options Source</label>
                                <div class="form-row" style="margin-bottom: 10px;">
                                    <div class="form-group" style="flex: 1;">
                                        <select v-model="formData.select_source_type" class="form-select">
                                            <option value="static">Static Options (직접 입력)</option>
                                            <option value="api">External API (외부 API)</option>
                                        </select>
                                    </div>
                                </div>

                                <div v-if="formData.select_source_type === 'static'" class="options-section">
                                    <label class="form-label">{{ $t('taskCatalog.options') }}</label>
                                    <div v-for="(option, index) in formData.options" :key="index" class="option-row">
                                        <input v-model="option.value" class="form-input" :placeholder="$t('taskCatalog.optionValue')" />
                                        <input v-model="option.label" class="form-input" :placeholder="$t('taskCatalog.optionLabel')" />
                                        <button class="option-remove-btn" @click="removeOption(index)">
                                            <v-icon size="14">mdi-minus</v-icon>
                                        </button>
                                    </div>
                                    <button class="option-add-btn" @click="addOption">
                                        <v-icon size="14">mdi-plus</v-icon>
                                        {{ $t('taskCatalog.addOption') }}
                                    </button>
                                </div>

                                <div v-if="formData.select_source_type === 'api'" class="options-section">
                                    <div class="form-group" style="margin-bottom: 10px;">
                                        <label class="form-label">API Endpoint</label>
                                        <input v-model="formData.select_api_endpoint" class="form-input" placeholder="https://api.example.com/options" />
                                        <div class="field-hint">
                                            GET 응답의 배열(또는 items/results/data 키)에서 선택지를 만듭니다.
                                            {{ '{' + '{fields.다른필드키}' + '}' }} 를 넣으면 그 필드 값이 바뀔 때마다 재조회합니다 (종속 선택).
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group" style="flex: 1;">
                                            <label class="form-label">Value Field</label>
                                            <input v-model="formData.select_api_value_field" class="form-input" placeholder="e.g. id" />
                                        </div>
                                        <div class="form-group" style="flex: 1;">
                                            <label class="form-label">Label Field</label>
                                            <input v-model="formData.select_api_label_field" class="form-input" placeholder="e.g. name" />
                                        </div>
                                        <div class="form-group" style="flex: 1;">
                                            <label class="form-label">검색 파라미터</label>
                                            <input v-model="formData.api_search_param" class="form-input" placeholder="예: q (비우면 전체 로드)" />
                                        </div>
                                    </div>

                                    <label class="form-label" style="margin-top: 8px;">요청 헤더 (인증 등)</label>
                                    <div v-for="(h, i) in formData.api_headers" :key="'h' + i" class="option-row">
                                        <input v-model="h.key" class="form-input" placeholder="Header 이름 (예: Authorization)" />
                                        <input v-model="h.value" class="form-input" placeholder="값" />
                                        <button class="option-remove-btn" @click="formData.api_headers.splice(i, 1)">
                                            <v-icon size="14">mdi-minus</v-icon>
                                        </button>
                                    </div>
                                    <button class="option-add-btn" @click="formData.api_headers.push({ key: '', value: '' })">
                                        <v-icon size="14">mdi-plus</v-icon> 헤더 추가
                                    </button>

                                    <label class="form-label" style="margin-top: 8px;">필드 자동 채움 (선택 시 응답 값 → 다른 필드)</label>
                                    <div class="field-hint" style="margin-bottom: 4px;">예: 응답의 manager 값을 owner_name 필드에 자동 입력</div>
                                    <div v-for="(m, i) in formData.api_fill_map" :key="'m' + i" class="option-row">
                                        <input v-model="m.from" class="form-input" placeholder="응답 필드 (예: manager 또는 info.url)" />
                                        <input v-model="m.to" class="form-input" placeholder="채울 필드 키 (property_key)" />
                                        <button class="option-remove-btn" @click="formData.api_fill_map.splice(i, 1)">
                                            <v-icon size="14">mdi-minus</v-icon>
                                        </button>
                                    </div>
                                    <button class="option-add-btn" @click="formData.api_fill_map.push({ from: '', to: '' })">
                                        <v-icon size="14">mdi-plus</v-icon> 매핑 추가
                                    </button>
                                </div>
                            </div>

                            <!-- DB-Select 설정: 내부 테이블에서 선택지 로드 -->
                            <div v-if="formData.property_type === 'db-select'" class="type-config-section">
                                <label class="form-label section-label">DB Source (내부 테이블)</label>
                                <div class="form-row">
                                    <div class="form-group" style="flex: 1.2;">
                                        <label class="form-label">Table <span class="required-mark">*</span></label>
                                        <input v-model="formData.db_table" class="form-input" placeholder="e.g. task_system" />
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Value Column</label>
                                        <input v-model="formData.db_value_column" class="form-input" placeholder="id" />
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Label Column</label>
                                        <input v-model="formData.db_label_column" class="form-input" placeholder="name" />
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Filter Column</label>
                                        <input v-model="formData.db_filter_column" class="form-input" placeholder="(선택)" />
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Filter Value</label>
                                        <input v-model="formData.db_filter_value" class="form-input" placeholder="(선택)" />
                                    </div>
                                </div>
                                <div class="form-row-checkboxes" style="margin-top: 4px;">
                                    <label class="checkbox-label">
                                        <input type="checkbox" v-model="formData.db_tenant_scoped" />
                                        <span>테넌트 필터 적용 (tenant_id)</span>
                                    </label>
                                </div>
                            </div>

                            <!-- Table 컬럼 정의 -->
                            <div v-if="formData.property_type === 'table'" class="type-config-section">
                                <label class="form-label section-label">Table Columns</label>
                                <div v-for="(col, i) in formData.table_columns" :key="'c' + i" class="option-row">
                                    <input v-model="col.key" class="form-input" placeholder="키 (예: item_name)" />
                                    <input v-model="col.label" class="form-input" placeholder="열 이름" />
                                    <select v-model="col.type" class="form-select" style="max-width: 110px;">
                                        <option value="string">Text</option>
                                        <option value="number">Number</option>
                                        <option value="select">Select</option>
                                    </select>
                                    <input
                                        v-if="col.type === 'select'"
                                        v-model="col.options_text"
                                        class="form-input"
                                        placeholder="선택지 (쉼표 구분)"
                                    />
                                    <button class="option-remove-btn" @click="formData.table_columns.splice(i, 1)">
                                        <v-icon size="14">mdi-minus</v-icon>
                                    </button>
                                </div>
                                <button class="option-add-btn" @click="formData.table_columns.push({ key: '', label: '', type: 'string', options_text: '' })">
                                    <v-icon size="14">mdi-plus</v-icon> 열 추가
                                </button>
                            </div>

                            <!-- 파일 설정: 업로드 경로/방식 -->
                            <div v-if="formData.property_type === 'file'" class="type-config-section">
                                <label class="form-label section-label">File Upload Settings</label>
                                <div class="form-row">
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Storage Bucket</label>
                                        <input v-model="formData.file_bucket" class="form-input" placeholder="files" />
                                    </div>
                                    <div class="form-group" style="flex: 1.4;">
                                        <label class="form-label">업로드 경로 (prefix)</label>
                                        <input v-model="formData.file_path_prefix" class="form-input" placeholder="uploads" />
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group" style="flex: 1.4;">
                                        <label class="form-label">허용 확장자 (accept)</label>
                                        <input v-model="formData.file_accept" class="form-input" placeholder=".pdf,.xlsx,image/*" />
                                    </div>
                                    <div class="form-group" style="flex: 0.8;">
                                        <label class="form-label">최대 크기 (MB)</label>
                                        <input v-model.number="formData.file_max_size_mb" class="form-input" type="number" min="0" placeholder="제한 없음" />
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">파일명 저장 방식</label>
                                        <select v-model="formData.file_name_strategy" class="form-select">
                                            <option value="uuid">임의 이름 (충돌 방지)</option>
                                            <option value="original">원본 파일명 유지</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row-checkboxes" style="margin-top: 4px;">
                                    <label class="checkbox-label">
                                        <input type="checkbox" v-model="formData.file_multiple" />
                                        <span>여러 파일 업로드 허용</span>
                                    </label>
                                </div>
                            </div>

                            <!-- 데이터 유실 경고 (수정 + 사용 중) -->
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
                        </div>

                        <!-- 다이얼로그 내 실시간 미리보기 -->
                        <div v-if="!isPanelForm" class="dialog-preview">
                            <div class="preview-header">
                                <v-icon size="14" color="primary">mdi-monitor-eye</v-icon>
                                <span>입력창 미리보기</span>
                            </div>
                            <div class="preview-panel">
                                <SchemaFieldInput :key="dialogPreviewKey" :field="dialogPreviewField" :model="dialogPreviewModel" preview />
                            </div>
                            <div class="field-hint">속성패널과 동일한 렌더러(SchemaFieldInput)로 그려집니다.</div>
                        </div>
                    </div>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelForm">{{ $t('taskCatalog.cancel') }}</v-btn>
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

        <!-- ───────────── 템플릿 가져오기 다이얼로그 ───────────── -->
        <v-dialog v-model="importDialogOpen" max-width="560" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pt-5 px-6">속성 스키마 템플릿 가져오기</v-card-title>
                <v-card-text class="px-6 pb-2">
                    <div class="dialog-body">
                        <template v-if="importError">
                            <v-alert type="error" density="compact" variant="tonal">{{ importError }}</v-alert>
                        </template>
                        <template v-else-if="importPlan">
                            <p class="mb-2">
                                파일: <strong>{{ importPlan.fileName }}</strong>
                                <span v-if="importPlan.exportedAt"> · 내보낸 시각 {{ importPlan.exportedAt }}</span>
                            </p>
                            <div class="import-summary">
                                <span class="summary-chip">전체 {{ importPlan.total }}건</span>
                                <span class="summary-chip">신규 {{ importPlan.creates.length }}건</span>
                                <span class="summary-chip" :class="{ 'import-conflict': importPlan.conflicts.length }">충돌 {{ importPlan.conflicts.length }}건</span>
                            </div>
                            <div v-if="importPlan.conflicts.length" class="usage-process-list mt-3">
                                <div class="usage-process-list-title">이미 존재하는 필드 (대상 + 키 기준)</div>
                                <ul class="usage-process-list-items">
                                    <li v-for="c in importPlan.conflicts" :key="c.incoming.task_type + '::' + c.incoming.property_key">
                                        <span class="usage-process-name">{{ c.incoming.property_label || c.incoming.property_key }}</span>
                                        <code class="field-key">{{ c.incoming.property_key }}</code>
                                        <span class="usage-process-scope">{{ getAppliesToLabel(c.incoming.applies_to) }}</span>
                                    </li>
                                </ul>
                                <label class="checkbox-label mt-2">
                                    <input type="checkbox" v-model="importOverwrite" />
                                    <span>충돌 필드를 가져온 정의로 덮어쓰기 (해제 시 건너뜀)</span>
                                </label>
                            </div>
                        </template>
                    </div>
                </v-card-text>
                <v-card-actions class="px-6 pb-5">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelImport">{{ $t('taskCatalog.cancel') }}</v-btn>
                    <v-btn
                        color="primary"
                        variant="tonal"
                        :disabled="!importPlan || !!importError || importing"
                        :loading="importing"
                        @click="executeImport"
                    >
                        적용
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- ───────────── Soft Delete 다이얼로그 ───────────── -->
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
                                <li>휴지통에서 복원하면 활성 상태로 되돌아갑니다.</li>
                            </ul>
                            <div v-if="softDeleteUsageProcesses && softDeleteUsageProcesses.length > 0" class="usage-process-list">
                                <div class="usage-process-list-title">사용 중인 프로세스</div>
                                <ul class="usage-process-list-items">
                                    <li v-for="proc in softDeleteUsageProcesses" :key="proc.id">
                                        <span class="usage-process-name">{{ proc.name }}</span>
                                        <span class="usage-process-scope" :class="getUsedAtClass(proc.usedAt)">{{ getUsedAtLabel(proc.usedAt) }}</span>
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
                    <v-btn variant="text" @click="softDeleteDialogOpen = false">{{ $t('taskCatalog.cancel') }}</v-btn>
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

        <!-- ───────────── Hard Delete 다이얼로그 (DELETE 타이핑 확인) ───────────── -->
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
                                        <span class="usage-process-scope" :class="getUsedAtClass(proc.usedAt)">{{ getUsedAtLabel(proc.usedAt) }}</span>
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
                            <label class="form-label">{{ $t('adminConsole.auditTrail.typeDeleteToConfirm') }}</label>
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
                    <v-btn variant="text" @click="cancelHardDelete">{{ $t('taskCatalog.cancel') }}</v-btn>
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
import { defineComponent, ref, reactive, computed, watch, getCurrentInstance } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import {
    PROPERTY_TYPES,
    APPLIES_TO_OPTIONS,
    AVAILABLE_TASK_TYPES,
    useTaskCatalogStore,
    groupSchemaFields,
    PROCESS_PANEL_SECTION_DEFS,
    TASK_PANEL_SECTION_DEFS
} from '@/stores/taskCatalog';
import ProcessHierarchyOpenButton from '@/views/process-hierarchy/ProcessHierarchyOpenButton.vue';
import SchemaFieldInput from '@/components/ui/SchemaFieldInput.vue';

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
    number_min: null,
    number_max: null,
    number_use_comma: false,
    number_unit: '',
    select_source_type: 'static',
    select_api_endpoint: '',
    select_api_label_field: '',
    select_api_value_field: '',
    // 그룹(묶음)
    group_label: '',
    group_order: 0,
    // table 컬럼 (config.table_columns 로 저장)
    table_columns: [],
    // 조건부 표시 (config.visible_when 으로 저장)
    cond_field: '',
    cond_op: 'eq',
    cond_value: '',
    // api 고급 설정 (config.api 로 저장)
    api_headers: [],
    api_fill_map: [],
    api_search_param: '',
    // db-select (config.db 로 저장)
    db_table: '',
    db_value_column: 'id',
    db_label_column: 'name',
    db_filter_column: '',
    db_filter_value: '',
    db_tenant_scoped: true,
    // file (config.file 로 저장)
    file_bucket: 'files',
    file_path_prefix: 'uploads',
    file_accept: '',
    file_max_size_mb: null,
    file_name_strategy: 'uuid',
    file_multiple: false
});

export default defineComponent({
    name: 'PropertySchemaStudio',

    components: { ProcessHierarchyOpenButton, SchemaFieldInput },

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
        const searchText = ref('');

        const previewScope = ref('process');
        const previewModel = reactive({});

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
            { value: 'FTE', label: 'FTE' }
        ];

        const propertyTypes = computed(() => ALL_PROPERTY_TYPES);

        const isDedicatedPanelSchema = (schema) => {
            const config = schema?.config || {};
            return config.renderer === 'panel' || config.panelProperty === true || config.builtin === true;
        };

        const getPanelTabLabel = (schema) => {
            const tab = schema?.config?.tab;
            const labels = { process: '프로세스', task: 'Task', 'pi-flag': 'PI Flag', governance: '검토의견' };
            return labels[tab] || '기존';
        };

        const appliesToOptions = computed(() =>
            APPLIES_TO_OPTIONS.map((item) => ({
                ...item,
                label: locale.value === 'ko' ? item.labelKo || item.label : item.label
            }))
        );

        const filterTargets = computed(() => {
            const all = { value: '__all__', label: locale.value === 'ko' ? '전체' : 'All' };
            return [all, ...appliesToOptions.value];
        });

        // ---- 목록: 사용자 정의 / 내장 분리 + 그룹핑 ----
        // 대상 필터: 특정 대상을 고르면 "그 대상의 패널에 실제로 적용되는" 행을 전부 포함한다.
        // (예: 사용자 작업 선택 → bpmn:UserTask 전용 + 모든 Task 공통 + 프로세스+Task 공용)
        // 패널이 공통·전용 행을 display_order 로 병합 정렬하므로, 순서를 조정하려면
        // 관리 화면에서도 같은 병합 목록을 봐야 한다.
        const appliesToTarget = (row, target) => {
            const at = row.applies_to || 'both';
            if (target === '__all__') return true;
            if (target === 'process') return at === 'process' || at === 'both';
            if (target === 'task') return at === 'task' || at === 'both';
            if (target === 'both') return at === 'both';
            // 특정 BPMN 유형
            return at === target || at === 'task' || at === 'both';
        };

        const matchesFilters = (s) => {
            if (!appliesToTarget(s, selectedTarget.value || '__all__')) return false;
            const q = searchText.value.trim().toLowerCase();
            if (q) {
                const haystack = `${s.property_key || ''} ${s.property_label || ''} ${s.description || ''}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        };

        // 내장/커스텀 구분 없이 한 목록 — 대상(scope)별 카드, display_order 정렬 (패널 순서와 일치)
        const SCOPE_ORDER = ['process', 'both', 'task'];
        const scopeCards = computed(() => {
            let list = (schemas.value || []).filter((s) => !s.deleted_at);
            if (showInactive.value) list = list.filter((s) => s.is_active === false);
            else list = list.filter((s) => s.is_active !== false);
            list = list.filter(matchesFilters);

            const iconFor = (scope) => {
                if (scope === 'process') return 'mdi-sitemap-outline';
                if (scope === 'both') return 'mdi-set-all';
                if (scope === 'task') return 'mdi-checkbox-marked-circle-outline';
                return 'mdi-vector-square';
            };

            // 특정 대상을 필터로 고르면: 공통 행까지 합친 "적용 순서" 단일 목록.
            // 이 목록의 순서가 곧 그 대상의 속성패널 순서다 (display_order 병합 정렬).
            const target = selectedTarget.value || '__all__';
            if (target !== '__all__') {
                return [
                    {
                        scope: target,
                        label: `${getAppliesToLabel(target)} — 적용 순서 (공통 포함)`,
                        icon: iconFor(target),
                        fields: list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                    }
                ];
            }

            const byScope = new Map();
            for (const row of list) {
                const scope = row.applies_to || 'both';
                if (!byScope.has(scope)) byScope.set(scope, []);
                byScope.get(scope).push(row);
            }
            return [...byScope.entries()]
                .map(([scope, fields]) => ({
                    scope,
                    label: getAppliesToLabel(scope),
                    icon: iconFor(scope),
                    fields: fields.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                }))
                .sort((a, b) => {
                    const ai = SCOPE_ORDER.indexOf(a.scope);
                    const bi = SCOPE_ORDER.indexOf(b.scope);
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.scope.localeCompare(b.scope);
                });
        });

        // 표시 조건 대상 필드 제안 — 같은 대상(applies_to) 영역의 필드 키
        const condFieldSuggestions = computed(() => {
            const at = formData.value.applies_to || 'both';
            return [
                ...new Set(
                    (schemas.value || [])
                        .filter((r) => !r.deleted_at && r.property_key !== formData.value.property_key)
                        .filter((r) => {
                            const rat = r.applies_to || 'both';
                            if (at === 'process') return rat === 'process' || rat === 'both';
                            if (at === 'both') return true;
                            return rat === 'task' || rat === 'both' || rat === at;
                        })
                        .map((r) => r.property_key)
                )
            ].sort();
        });

        const existingGroupLabels = computed(() => {
            const labels = new Set();
            (schemas.value || []).forEach((s) => {
                const l = String(s.group_label || '').trim();
                if (l) labels.add(l);
            });
            return [...labels].sort();
        });

        // ---- 설정 요약 칩 ----
        const settingSummary = (item) => {
            const chips = [];
            if (item.group_label) chips.push(`그룹: ${item.group_label}`);
            const cond = item.config?.visible_when;
            if (cond?.field) {
                const opLabel = { eq: '=', ne: '≠', contains: '포함', not_empty: '값 있음', empty: '값 없음' }[cond.op] || cond.op;
                chips.push(`조건: ${cond.field} ${opLabel}${cond.value !== undefined && cond.value !== '' ? ' ' + cond.value : ''}`);
            }
            if (item.default_value !== undefined && item.default_value !== null && String(item.default_value).trim() !== '') {
                chips.push(`기본값: ${String(item.default_value).slice(0, 20)}`);
            }
            if (item.property_type === 'number') {
                const range = [item.number_min, item.number_max].map((v) => (v === null || v === undefined || v === '' ? '' : v));
                if (range[0] !== '' || range[1] !== '') chips.push(`범위: ${range[0]}~${range[1]}`);
                if (item.number_unit) chips.push(`단위: ${item.number_unit}`);
                if (item.number_use_comma) chips.push('콤마');
            }
            if (item.property_type === 'select' || item.property_type === 'multiselect') {
                if (item.select_source_type === 'api') {
                    chips.push(`API: ${truncate(item.select_api_endpoint || '', 30)}`);
                    const api = item.config?.api || {};
                    if (api.search_param) chips.push(`검색: ${api.search_param}`);
                    if (Array.isArray(api.fill_map) && api.fill_map.length) chips.push(`자동 채움 ${api.fill_map.length}건`);
                    if (/\{\{\s*fields\./.test(item.select_api_endpoint || '')) chips.push('종속 선택');
                } else chips.push(`선택지 ${(item.options || []).length}개`);
            }
            if (item.property_type === 'db-select') {
                const db = item.config?.db;
                chips.push(db?.table ? `DB: ${db.table}.${db.label_column || 'name'}` : 'DB: 미설정');
            }
            if (item.property_type === 'table') {
                const cols = item.config?.table_columns || [];
                chips.push(`열 ${cols.length}개: ${cols.map((c) => c.label || c.key).slice(0, 4).join('·')}${cols.length > 4 ? '…' : ''}`);
            }
            if (item.property_type === 'file') {
                const f = item.config?.file || {};
                chips.push(`업로드: ${f.bucket || 'files'}/${f.path_prefix || 'uploads'}`);
                if (f.accept) chips.push(f.accept);
                if (f.max_size_mb) chips.push(`최대 ${f.max_size_mb}MB`);
                if (f.multiple) chips.push('다중');
            }
            return chips;
        };

        // ---- 미리보기 ----
        const previewScopeOptions = computed(() => {
            const base = [
                { value: 'process', label: '프로세스' },
                { value: 'task', label: '모든 Task (공통)' }
            ];
            const taskTypes = AVAILABLE_TASK_TYPES.map((t) => ({
                value: t.value,
                label: locale.value === 'ko' ? t.labelKo || t.label : t.label
            }));
            // 스키마에 존재하는 특수 타입(SequenceFlow, Lane 등)도 노출
            const known = new Set(['process', 'task', 'both', ...AVAILABLE_TASK_TYPES.map((t) => t.value)]);
            const extras = [...new Set((schemas.value || []).map((s) => s.applies_to).filter((v) => v && !known.has(v)))].map((v) => ({
                value: v,
                label: v.replace(/^bpmn:/, '')
            }));
            return [...base, ...taskTypes, ...extras];
        });

        const previewFields = computed(() => {
            if (previewScope.value === 'process') return taskCatalogStore.schemasByAppliesTo('process');
            if (previewScope.value === 'task') return taskCatalogStore.schemasByAppliesTo('task');
            return taskCatalogStore.schemasByAppliesTo('task', previewScope.value);
        });

        // 패널 각 섹션의 아이콘·색 — ProcessHierarchyProperties 의 section-title 과 동일
        const SECTION_ICONS = {
            general: { icon: 'mdi-information-outline', color: 'blue-grey' },
            group: { icon: 'mdi-shape-outline', color: 'blue-grey' },
            manual_links: { icon: 'mdi-link-variant', color: 'indigo' },
            api_integrations_summary: { icon: 'mdi-api', color: 'teal' },
            system_list: { icon: 'mdi-server-network', color: 'blue' },
            related_project_list: { icon: 'mdi-clipboard-list-outline', color: 'purple' },
            total_duration: { icon: 'mdi-clock-outline', color: 'teal' },
            total_cost: { icon: 'mdi-currency-krw', color: 'orange' },
            task_count: { icon: 'mdi-counter', color: 'blue' },
            seqflow: { icon: 'mdi-vector-line', color: 'blue-grey' },
            pool_exec: { icon: 'mdi-play-circle-outline', color: 'teal' },
            pool_ppi: { icon: 'mdi-chart-line', color: 'orange' },
            lane_basic: { icon: 'mdi-account-group', color: 'primary' },
            lane_assignment: { icon: 'mdi-account-multiple', color: 'indigo' },
            call_activity: { icon: 'mdi-file-tree', color: 'deep-purple' },
            dmn: { icon: 'mdi-table-cog', color: 'purple' },
            send_mail: { icon: 'mdi-email-outline', color: 'blue' },
            data_io: { icon: 'mdi-database-import-outline', color: 'teal' },
            form_link: { icon: 'mdi-form-select', color: 'primary' },
            raci: { icon: 'mdi-table-account', color: 'deep-purple' },
            task_io: { icon: 'mdi-swap-horizontal', color: 'blue' },
            manual_links_t: { icon: 'mdi-link-variant', color: 'indigo' },
            api_integrations: { icon: 'mdi-api', color: 'teal' },
            attachment: { icon: 'mdi-paperclip', color: 'indigo' },
            costing: { icon: 'mdi-clock-outline', color: 'teal' },
            system_mapping: { icon: 'mdi-server-network', color: 'blue' },
            related_projects: { icon: 'mdi-clipboard-list-outline', color: 'purple' },
            pi_flag: { icon: 'mdi-flag-outline', color: 'red' }
        };
        const sectionIcon = (id) => SECTION_ICONS[id] || SECTION_ICONS[id.startsWith('group-') ? 'group' : 'general'] || SECTION_ICONS.general;

        // 접이식 상태 — 패널과 같은 기본 열림
        const previewClosed = reactive(new Set());
        const togglePreviewSection = (id) => {
            if (previewClosed.has(id)) previewClosed.delete(id);
            else previewClosed.add(id);
        };
        const isPreviewSectionOpen = (id) => !previewClosed.has(id);

        // ── 패널과 동일한 섹션 구성 계산 ──────────────────────────
        // SchemaFieldInput 으로 그대로 그릴 수 있는 위젯 — 그 외는 자리표시(placeholder)
        const GENERIC_WIDGETS = new Set(['text', 'textarea', 'switch', 'select', 'autocomplete', 'combobox', 'readonly']);

        const panelRowOf = (scope, key) =>
            (schemas.value || []).find(
                (r) => isDedicatedPanelSchema(r) && !r.deleted_at && (r.config?.panelTaskType || r.task_type) === scope && r.property_key === key
            ) || null;

        const rowShown = (row) => !!row && row.is_active !== false && row.visible_by_default !== false;
        // 행이 없으면 fail-open (패널의 isBuiltinPropVisible 과 동일)
        const sectionShown = (row) => (row ? rowShown(row) : true);

        const rowItem = (row) => {
            const widget = row.config?.widget || '';
            if (GENERIC_WIDGETS.has(widget)) {
                return { kind: 'field', id: row.id, field: row };
            }
            return { kind: 'widget', id: row.id, label: row.property_label || row.property_key, widget: widget || row.property_type };
        };

        const orderOf = (row, fallback) => {
            const n = Number(row?.display_order);
            return row && Number.isFinite(n) ? n : fallback;
        };

        const customFieldsFor = (scope) => previewFields.value.filter((f) => !f.group_key);
        const customGroupsFor = () => groupSchemaFields(previewFields.value).filter((g) => g.key);

        const previewSections = computed(() => {
            const scope = previewScope.value;
            const sections = [];
            const iconsOf = (id) => {
                const found = sectionIcon(id);
                return { icon: found.icon, iconColor: found.color };
            };

            const pushGeneral = (builtinKeys, builtinScope, extraFallbacks) => {
                const items = [];
                builtinKeys.forEach((key, i) => {
                    const row = panelRowOf(builtinScope, key);
                    if (row ? rowShown(row) : true) {
                        const base = row || {
                            id: `fallback::${builtinScope}::${key}`,
                            property_key: key,
                            property_label: extraFallbacks[i].label,
                            property_type: extraFallbacks[i].type,
                            config: { widget: extraFallbacks[i].widget }
                        };
                        items.push({ ...rowItem(base), __order: orderOf(row, extraFallbacks[i].order) });
                    }
                });
                for (const f of customFieldsFor(scope)) {
                    items.push({ kind: 'field', id: f.id, field: f, __order: Number(f.display_order) > 0 ? Number(f.display_order) : 500 });
                }
                items.sort((a, b) => a.__order - b.__order);
                if (items.length) sections.push({ id: 'general', label: '일반', ...iconsOf('general'), items });
            };

            const pushCustomGroups = () => {
                for (const g of customGroupsFor()) {
                    sections.push({
                        id: 'group-' + g.key,
                        label: g.label,
                        ...iconsOf('group'),
                        items: g.fields.map((f) => ({ kind: 'field', id: f.id, field: f }))
                    });
                }
            };

            const pushDefs = (defs) => {
                const processPpiRow = panelRowOf('process', 'ppi');
                const entries = defs
                    .filter((d) => !['task_basic', 'custom_groups'].includes(d.id))
                    .filter((d) => {
                        // PPI 스코프 이동 반영: process 행이 있으면 그쪽에서만, 없으면 Participant 에서만
                        if (d.id === 'pool_ppi') return !processPpiRow;
                        if (d.id === 'ppi') return !!processPpiRow;
                        return true;
                    })
                    .filter((d) => {
                        if (scope === 'process') return d.scope === 'process';
                        if (scope === 'task') return d.scope === 'task';
                        return d.scope === 'task' || d.scope === scope;
                    })
                    .map((d, idx) => {
                        const anchor = panelRowOf(d.scope, d.key);
                        return { def: d, anchor, idx, order: orderOf(anchor, d.fallbackOrder) };
                    })
                    .filter((e) => sectionShown(e.anchor))
                    .sort((a, b) => a.order - b.order || a.idx - b.idx);
                for (const e of entries) {
                    const keys = e.def.contentKeys || [e.def.key];
                    const items = keys
                        .map((k) => panelRowOf(e.def.scope, k))
                        .filter((r) => r && rowShown(r))
                        .map(rowItem);
                    const label = e.anchor && keys.length === 1 ? e.anchor.property_label || e.def.id : sectionLabelOf(e.def);
                    sections.push({
                        id: e.def.id,
                        label,
                        ...iconsOf(e.def.id),
                        items: items.length ? items : [{ kind: 'widget', id: e.def.id, label: sectionLabelOf(e.def), widget: '패널' }]
                    });
                }
            };

            const sectionLabelOf = (def) => {
                const anchor = panelRowOf(def.scope, def.key);
                const fallbackNames = {
                    seqflow: '선 정보',
                    lane_basic: 'Lane 기본',
                    send_mail: '메일 발송 설정',
                    costing: 'FTE / OPEX'
                };
                if (def.contentKeys && fallbackNames[def.id]) return fallbackNames[def.id];
                return anchor?.property_label || fallbackNames[def.id] || def.id;
            };

            if (scope === 'process') {
                pushGeneral(
                    ['title', 'description'],
                    'process',
                    [
                        { label: '프로세스명', type: 'string', widget: 'text', order: 30 },
                        { label: '설명', type: 'textarea', widget: 'textarea', order: 40 }
                    ]
                );
                pushCustomGroups();
                pushDefs(PROCESS_PANEL_SECTION_DEFS);
            } else {
                pushGeneral(
                    ['element_id', 'name'],
                    'task',
                    [
                        { label: '요소 ID', type: 'string', widget: 'readonly', order: 10 },
                        { label: '이름', type: 'string', widget: 'text', order: 20 }
                    ]
                );
                pushCustomGroups();
                pushDefs(TASK_PANEL_SECTION_DEFS);
            }
            return sections;
        });

        // 미리보기 모델: 필드 정의가 바뀌면 기본값으로 시드
        watch(
            previewFields,
            (fields) => {
                for (const f of fields || []) {
                    if (f.property_type === 'daterange') {
                        if (!(f.property_key + '_start' in previewModel)) previewModel[f.property_key + '_start'] = '';
                        if (!(f.property_key + '_end' in previewModel)) previewModel[f.property_key + '_end'] = '';
                    } else if (!(f.property_key in previewModel)) {
                        previewModel[f.property_key] = seedValue(f);
                    }
                }
            },
            { immediate: true }
        );

        function seedValue(f) {
            const dv = f.default_value;
            switch (f.property_type) {
                case 'boolean':
                    return dv === 'true';
                case 'number': {
                    const n = Number(String(dv ?? '').replace(/,/g, ''));
                    return Number.isFinite(n) && String(dv ?? '').trim() !== '' ? n : null;
                }
                case 'multiselect':
                    return [];
                case 'file':
                    return null;
                default:
                    return dv ?? '';
            }
        }

        // ---- 다이얼로그 미리보기 ----
        const dialogPreviewModel = reactive({});
        const dialogPreviewField = computed(() => buildSchemaFromForm(formData.value, editingSchema.value));
        const dialogPreviewKey = computed(
            () => `${formData.value.property_type}::${formData.value.select_source_type}::${formData.value.db_table}::${formData.value.select_api_endpoint}`
        );
        const isPanelForm = computed(() => !!editingSchema.value && isDedicatedPanelSchema(editingSchema.value));

        watch(
            () => [formData.value.property_type, formData.value.default_value, showForm.value],
            () => {
                Object.keys(dialogPreviewModel).forEach((k) => delete dialogPreviewModel[k]);
                const f = dialogPreviewField.value;
                if (f.property_type === 'daterange') {
                    dialogPreviewModel[f.property_key + '_start'] = '';
                    dialogPreviewModel[f.property_key + '_end'] = '';
                } else {
                    dialogPreviewModel[f.property_key] = seedValue(f);
                }
            },
            { immediate: true }
        );

        // formData → SchemaFieldInput 이 읽는 스키마 행 형태로 변환 (config 포함)
        function buildSchemaFromForm(fd, editing) {
            return {
                id: editing?.id || '__preview__',
                property_key: fd.property_key || 'preview_field',
                property_label: fd.property_label || '(라벨 미입력)',
                property_type: fd.property_type,
                placeholder: fd.placeholder,
                description: fd.description,
                is_readonly: fd.is_readonly,
                is_required: fd.is_required,
                options: fd.options,
                number_min: fd.number_min,
                number_max: fd.number_max,
                number_use_comma: fd.number_use_comma,
                number_unit: fd.number_unit,
                select_source_type: fd.select_source_type,
                select_api_endpoint: fd.select_api_endpoint,
                select_api_label_field: fd.select_api_label_field,
                select_api_value_field: fd.select_api_value_field,
                config: buildConfigFromForm(fd, editing)
            };
        }

        function buildConfigFromForm(fd, editing) {
            const config = { ...(editing?.config || {}) };
            // 내장(panel) 행의 대상(applies_to)을 옮기면 실제 패널 스코프(panelTaskType)도 함께 이동
            if (editing && isDedicatedPanelSchema(editing) && config.panelTaskType && fd.applies_to && config.panelTaskType !== fd.applies_to) {
                config.panelTaskType = fd.applies_to;
                config.tab = fd.applies_to === 'process' ? 'process' : 'task';
            }
            if (fd.property_type === 'table') {
                const cols = (fd.table_columns || [])
                    .filter((c) => String(c?.key || '').trim())
                    .map((c) => ({
                        key: String(c.key).trim(),
                        label: String(c.label || '').trim(),
                        type: ['number', 'select'].includes(c.type) ? c.type : 'string',
                        ...(c.type === 'select'
                            ? { options: String(c.options_text || '').split(',').map((v) => v.trim()).filter(Boolean) }
                            : {})
                    }));
                if (cols.length) config.table_columns = cols;
                else delete config.table_columns;
            }
            const condField = String(fd.cond_field || '').trim();
            if (condField) {
                config.visible_when = { field: condField, op: fd.cond_op || 'eq', value: fd.cond_value ?? '' };
            } else {
                delete config.visible_when;
            }
            if ((fd.property_type === 'select' || fd.property_type === 'multiselect') && fd.select_source_type === 'api') {
                const headers = (fd.api_headers || []).filter((h) => String(h?.key || '').trim());
                const fillMap = (fd.api_fill_map || []).filter((m) => String(m?.from || '').trim() && String(m?.to || '').trim());
                const searchParam = String(fd.api_search_param || '').trim();
                if (headers.length || fillMap.length || searchParam) {
                    config.api = {
                        ...(headers.length ? { headers } : {}),
                        ...(fillMap.length ? { fill_map: fillMap } : {}),
                        ...(searchParam ? { search_param: searchParam } : {})
                    };
                } else {
                    delete config.api;
                }
            }
            if (fd.property_type === 'db-select') {
                config.db = {
                    table: String(fd.db_table || '').trim(),
                    value_column: String(fd.db_value_column || 'id').trim() || 'id',
                    label_column: String(fd.db_label_column || 'name').trim() || 'name',
                    filter_column: String(fd.db_filter_column || '').trim(),
                    filter_value: fd.db_filter_value,
                    tenant_scoped: fd.db_tenant_scoped !== false
                };
            }
            if (fd.property_type === 'file') {
                config.file = {
                    bucket: String(fd.file_bucket || '').trim() || 'files',
                    path_prefix: String(fd.file_path_prefix || '').trim() || 'uploads',
                    accept: String(fd.file_accept || '').trim(),
                    max_size_mb: Number.isFinite(Number(fd.file_max_size_mb)) && Number(fd.file_max_size_mb) > 0 ? Number(fd.file_max_size_mb) : null,
                    name_strategy: fd.file_name_strategy === 'original' ? 'original' : 'uuid',
                    multiple: fd.file_multiple === true
                };
            }
            return config;
        }

        // ---- API ----
        // silent: 스피너(v-if 스왑) 없이 목록만 교체 — 토글/저장 후 새로고침으로
        // 스크롤이 리셋되지 않도록 최초 로드에만 스피너를 쓴다. 행 key(id)가 안정적이라
        // Vue 가 in-place patch 하므로 스크롤 위치가 유지된다.
        const loadSchemas = async ({ silent = false } = {}) => {
            if (!silent) loading.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.getPropertySchemas();
                schemas.value = result || [];
                taskCatalogStore.propertySchemas = result || [];
                taskCatalogStore.schemasLoaded = true;
            } catch (e) {
                console.error('[PropertySchemaStudio] loadSchemas error:', e);
            } finally {
                if (!silent) loading.value = false;
            }
        };

        // 빠른 토글용 로컬 패치 — 서버 왕복 후 전체 리로드 없이 해당 행만 갱신
        const patchLocalSchema = (id, patch) => {
            const row = (schemas.value || []).find((r) => r.id === id);
            if (row) Object.assign(row, patch);
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

        const generateGroupKey = (label) => {
            const trimmed = String(label || '').trim();
            if (!trimmed) return '';
            // 한글 그룹명 그대로 키로 쓴다 (공백만 하이픈으로) — 표시용 라벨과 1:1 유지
            return trimmed.toLowerCase().replace(/\s+/g, '-');
        };

        const openAddForm = () => {
            editingSchema.value = null;
            formData.value = defaultFormData();
            usageCount.value = 0;
            riskAckEdit.value = false;
            showForm.value = true;
        };

        const openEditForm = async (schema) => {
            if (schema.deleted_at) return;
            editingSchema.value = schema;
            const db = schema.config?.db || {};
            const file = schema.config?.file || {};
            const api = schema.config?.api || {};
            const cond = schema.config?.visible_when || {};
            const tableCols = Array.isArray(schema.config?.table_columns) ? schema.config.table_columns : [];
            formData.value = {
                ...defaultFormData(),
                ...schema,
                options: schema.options ? schema.options.map((o) => ({ ...o })) : [],
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
                api_headers: Array.isArray(api.headers) ? api.headers.map((h) => ({ ...h })) : [],
                api_fill_map: Array.isArray(api.fill_map) ? api.fill_map.map((m) => ({ ...m })) : [],
                api_search_param: api.search_param || '',
                table_columns: tableCols.map((c) => ({ ...c, options_text: Array.isArray(c.options) ? c.options.join(', ') : '' })),
                cond_field: cond.field || '',
                cond_op: cond.op || 'eq',
                cond_value: cond.value ?? '',
                group_label: schema.group_label || '',
                group_order: schema.group_order || 0,
                db_table: db.table || '',
                db_value_column: db.value_column || 'id',
                db_label_column: db.label_column || 'name',
                db_filter_column: db.filter_column || '',
                db_filter_value: db.filter_value ?? '',
                db_tenant_scoped: db.tenant_scoped !== false,
                file_bucket: file.bucket || 'files',
                file_path_prefix: file.path_prefix || 'uploads',
                file_accept: file.accept || '',
                file_max_size_mb: file.max_size_mb ?? null,
                file_name_strategy: file.name_strategy === 'original' ? 'original' : 'uuid',
                file_multiple: file.multiple === true
            };
            riskAckEdit.value = false;
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
                const duplicate = (schemas.value || []).find(
                    (s) => !s.deleted_at && s.property_key === formData.value.property_key && (s.task_type || '') === (formData.value.applies_to || '')
                );
                if (duplicate) {
                    proxy.$try({ action: async () => {}, warningMsg: proxy.$t('adminConsole.propertySchema.duplicateKeyWarning') });
                    return;
                }
            }
            if (formData.value.is_readonly && !isPanelForm.value) {
                const rawDefault = formData.value.default_value;
                const hasValue = rawDefault !== null && rawDefault !== undefined && String(rawDefault).trim() !== '';
                if (!hasValue) {
                    proxy.$try({ action: async () => {}, warningMsg: '읽기전용으로 지정된 속성은 기본값을 입력해야 합니다.' });
                    return;
                }
            }
            if (formData.value.property_type === 'db-select' && !String(formData.value.db_table || '').trim()) {
                proxy.$try({ action: async () => {}, warningMsg: 'DB-Select 속성은 Table 을 입력해야 합니다.' });
                return;
            }
            saving.value = true;
            try {
                const isEdit = !!editingSchema.value;
                const beforeSnapshot = isEdit ? { ...editingSchema.value } : null;
                if (isEdit && beforeSnapshot?.property_type && formData.value.property_type !== beforeSnapshot.property_type) {
                    proxy.$try({ action: async () => {}, warningMsg: proxy.$t('adminConsole.propertySchema.typeChangeBlocked') });
                    saving.value = false;
                    return;
                }
                const backend = BackendFactory.createBackend();
                const fd = formData.value;
                const groupLabel = String(fd.group_label || '').trim();
                // DB 컬럼만 명시적으로 전달한다 — putObject 가 객체를 그대로 upsert 하므로
                // UI 전용 키(db_*, file_*)가 섞이면 PostgREST 가 컬럼 오류(PGRST204)를 낸다.
                const payload = {
                    id: editingSchema.value ? editingSchema.value.id : undefined,
                    task_type: fd.applies_to,
                    applies_to: fd.applies_to,
                    property_key: fd.property_key,
                    property_label: fd.property_label,
                    property_type: isEdit ? beforeSnapshot.property_type : fd.property_type,
                    description: fd.description || '',
                    placeholder: fd.placeholder || '',
                    is_readonly: !!fd.is_readonly,
                    is_required: !!fd.is_required,
                    default_value: fd.default_value ?? '',
                    display_order: fd.display_order || 0,
                    visible_by_default: fd.visible_by_default !== false,
                    is_active: editingSchema.value ? editingSchema.value.is_active !== false : true,
                    options: fd.options || [],
                    number_min: fd.number_min ?? null,
                    number_max: fd.number_max ?? null,
                    number_use_comma: !!fd.number_use_comma,
                    number_unit: fd.number_unit || null,
                    select_source_type: fd.select_source_type || 'static',
                    select_api_endpoint: fd.select_api_endpoint || null,
                    select_api_label_field: fd.select_api_label_field || null,
                    select_api_value_field: fd.select_api_value_field || null,
                    group_key: generateGroupKey(groupLabel) || null,
                    group_label: groupLabel || null,
                    group_order: fd.group_order || 0,
                    config: buildConfigFromForm(fd, editingSchema.value)
                };
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
                    target_id: payload.property_key,
                    target_name: payload.property_label,
                    before_value: beforeSnapshot,
                    after_value: payload
                });
                cancelForm();
                await loadSchemas({ silent: true });
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
            if (schema.deleted_at) return;
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
                    comment: '속성 패널 노출 토글'
                });
                patchLocalSchema(schema.id, { visible_by_default: nextVisible });
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
                    after_value: { deleted_at: new Date().toISOString() }
                });
                softDeleteDialogOpen.value = false;
                softDeleteTarget.value = null;
                await loadSchemas({ silent: true });
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
                    after_value: { is_active: false }
                });
                patchLocalSchema(schema.id, { is_active: false });
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
                    after_value: { is_active: true }
                });
                patchLocalSchema(schema.id, { is_active: true });
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
                    comment: 'DELETE 타이핑 확인 후 영구 삭제'
                });
                hardDeleteDialogOpen.value = false;
                hardDeleteTarget.value = null;
                deleteConfirmText.value = '';
                await loadSchemas({ silent: true });
            } catch (e) {
                console.error('[PropertySchemaStudio] executeHardDelete error:', e);
            } finally {
                deleting.value = false;
            }
        };

        // ---- Display helpers ----
        const getTypeLabel = (type) => {
            const found = ALL_PROPERTY_TYPES.find((t) => t.value === type);
            return found ? found.label : type || '—';
        };

        const getAppliesToClass = (val) => {
            if (val === 'process') return 'process';
            if (val === 'both') return 'both';
            if (val === 'task') return 'task';
            if (val) return 'specific_task';
            return '';
        };

        const getAppliesToLabel = (val) => {
            const found = APPLIES_TO_OPTIONS.find((o) => o.value === val);
            if (found) return locale.value === 'ko' ? found.labelKo || found.label : found.label;
            return val || (locale.value === 'ko' ? '프로세스 + Task' : 'Process + Task');
        };

        function truncate(str, max) {
            if (!str) return '';
            return str.length > max ? str.slice(0, max) + '…' : str;
        }

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

        // ---- 템플릿 내보내기 / 가져오기 ----
        // 프로젝트(테넌트)마다 속성 구성을 재구축하지 않도록 전체 정의를 JSON 으로 이동한다.
        // id/tenant/시각 등 환경 종속 값은 제외하고, 렌더링에 필요한 정의만 담는다.
        const TEMPLATE_VERSION = 1;
        const TEMPLATE_FIELD_KEYS = [
            'task_type', 'applies_to', 'property_key', 'property_label', 'property_type',
            'description', 'placeholder', 'is_readonly', 'is_required', 'default_value',
            'display_order', 'visible_by_default', 'is_active', 'options',
            'number_min', 'number_max', 'number_use_comma', 'number_unit',
            'select_source_type', 'select_api_endpoint', 'select_api_label_field', 'select_api_value_field',
            'group_key', 'group_label', 'group_order', 'config'
        ];

        const importDialogOpen = ref(false);
        const importPlan = ref(null);
        const importError = ref('');
        const importOverwrite = ref(true);
        const importing = ref(false);

        const exportTemplate = () => {
            const fields = (schemas.value || [])
                .filter((r) => !r.deleted_at)
                .map((r) => {
                    const out = {};
                    for (const k of TEMPLATE_FIELD_KEYS) {
                        if (r[k] !== undefined && r[k] !== null) out[k] = r[k];
                    }
                    return out;
                });
            const payload = {
                version: TEMPLATE_VERSION,
                exported_at: new Date().toISOString(),
                field_count: fields.length,
                fields
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `property-schema-template-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        const onImportFilePicked = async (event) => {
            const file = event?.target?.files?.[0];
            if (event?.target) event.target.value = '';
            if (!file) return;
            importError.value = '';
            importPlan.value = null;
            importOverwrite.value = true;
            importDialogOpen.value = true;
            try {
                const parsed = JSON.parse(await file.text());
                const fields = Array.isArray(parsed?.fields) ? parsed.fields : Array.isArray(parsed) ? parsed : null;
                if (!fields) throw new Error('fields 배열을 찾을 수 없습니다.');
                const invalid = fields.filter((f) => !f || !f.property_key || !f.property_type);
                if (invalid.length) throw new Error(`property_key/property_type 이 없는 항목 ${invalid.length}건이 있습니다.`);
                const existingByKey = new Map(
                    (schemas.value || []).filter((r) => !r.deleted_at).map((r) => [`${r.task_type || ''}::${r.property_key}`, r])
                );
                const creates = [];
                const conflicts = [];
                for (const raw of fields) {
                    const incoming = {};
                    for (const k of TEMPLATE_FIELD_KEYS) {
                        if (raw[k] !== undefined) incoming[k] = raw[k];
                    }
                    incoming.task_type = incoming.task_type || incoming.applies_to || 'both';
                    incoming.applies_to = incoming.applies_to || incoming.task_type;
                    const existing = existingByKey.get(`${incoming.task_type}::${incoming.property_key}`);
                    if (existing) conflicts.push({ incoming, existing });
                    else creates.push(incoming);
                }
                importPlan.value = {
                    fileName: file.name,
                    exportedAt: parsed?.exported_at || '',
                    total: fields.length,
                    creates,
                    conflicts
                };
            } catch (e) {
                importError.value = `가져오기 실패: ${e.message || e}`;
            }
        };

        const cancelImport = () => {
            importDialogOpen.value = false;
            importPlan.value = null;
            importError.value = '';
        };

        const executeImport = async () => {
            if (!importPlan.value) return;
            importing.value = true;
            try {
                const backend = BackendFactory.createBackend();
                const plan = importPlan.value;
                let applied = 0;
                for (const incoming of plan.creates) {
                    await backend.savePropertySchema({ ...incoming });
                    applied += 1;
                }
                if (importOverwrite.value) {
                    for (const { incoming, existing } of plan.conflicts) {
                        // 기존 id 를 유지해 in-place 갱신 (유니크 인덱스 충돌 방지)
                        await backend.savePropertySchema({ ...incoming, id: existing.id });
                        applied += 1;
                    }
                }
                adminStore.writeAdminAuditLog({
                    action: 'schema_template_import',
                    target_type: 'property_schema',
                    target_id: plan.fileName,
                    target_name: '템플릿 가져오기',
                    before_value: null,
                    after_value: { total: plan.total, applied, overwrote: importOverwrite.value ? plan.conflicts.length : 0 }
                });
                cancelImport();
                await loadSchemas({ silent: true });
            } catch (e) {
                console.error('[PropertySchemaStudio] executeImport error:', e);
                importError.value = `적용 중 오류: ${e.message || e}`;
            } finally {
                importing.value = false;
            }
        };

        // ---- Init ----
        const init = async () => {
            await loadSchemas();
            try {
                const seeded = await taskCatalogStore.syncPanelPropertySchemas();
                if (seeded > 0) await loadSchemas({ silent: true });
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
            searchText,
            previewScope,
            previewModel,
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
            propertyTypes,
            numberUnitOptions,
            appliesToOptions,
            filterTargets,
            scopeCards,
            existingGroupLabels,
            condFieldSuggestions,
            previewScopeOptions,
            previewSections,
            togglePreviewSection,
            isPreviewSectionOpen,
            dialogPreviewModel,
            dialogPreviewField,
            dialogPreviewKey,
            isPanelForm,
            // template import/export
            importDialogOpen,
            importPlan,
            importError,
            importOverwrite,
            importing,
            exportTemplate,
            onImportFilePicked,
            cancelImport,
            executeImport,
            // methods
            openAddForm,
            openEditForm,
            cancelForm,
            saveField,
            isDedicatedPanelSchema,
            getPanelTabLabel,
            settingSummary,
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
    }
});
</script>

<style scoped>
/* sk-page-card / page-header 계열 클래스는 src/assets/css/SKGlobalStyle.scss 에 글로벌 정의되어 있음 */

/* sk-page-card-text(전역: column flex + overflow hidden !important) 안에서
   남은 높이를 row 로 나누는 분할 컨테이너 — 좌 목록/우 미리보기 각각 자체 스크롤 */
.studio-split {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    gap: 16px;
}

.studio-list {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 2px;
}

/* ── 툴바 (card-text 직속, 고정) ── */
.filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;
    margin-bottom: 12px;
}

.filter-select {
    min-width: 180px;
}

.filter-search {
    flex: 1;
    max-width: 320px;
}

/* ── 폼 공통 (기존 규칙 유지) ── */
.form-input,
.form-select {
    width: 100%;
    padding: 7px 10px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    font-size: 13px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-textPrimary));
    outline: none;
    transition: border-color 0.15s ease;
}

.form-input:focus,
.form-select:focus {
    border-color: rgb(var(--v-theme-primary));
}

.input-disabled {
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-textSecondary));
}

.input-error {
    border-color: rgb(var(--v-theme-error));
}

.form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.form-label {
    font-size: 12px;
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
}

.section-label {
    display: block;
    margin-bottom: 8px;
    color: rgb(var(--v-theme-primary));
}

.required-mark {
    color: rgb(var(--v-theme-error));
}

.form-row-checkboxes {
    display: flex;
    gap: 16px;
    margin-bottom: 12px;
}

.checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: rgb(var(--v-theme-textPrimary));
    cursor: pointer;
    white-space: nowrap;
}

.field-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
}

.field-hint-warning {
    color: rgb(var(--v-theme-warning));
}

.type-config-section {
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    background: rgb(var(--v-theme-background));
}

.options-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.option-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.option-remove-btn,
.option-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-textSecondary));
    font-size: 12px;
    cursor: pointer;
}

.option-add-btn {
    align-self: flex-start;
    margin-top: 4px;
}

.option-remove-btn:hover,
.option-add-btn:hover {
    border-color: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-primary));
}

/* ── 그룹 카드 목록 ── */
.group-card {
    /* flex column 스크롤 컨테이너 안에서 카드가 shrink 되면 내용이 잘린 채
       scrollHeight 도 늘어나지 않아 스크롤 자체가 죽는다 — 자연 높이 고정 */
    flex: 0 0 auto;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 10px;
    background: rgb(var(--v-theme-surface));
    overflow: hidden;
}

.group-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgb(var(--v-theme-background));
    border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.group-card-header.clickable {
    cursor: pointer;
    user-select: none;
}

.group-card-title {
    font-size: 13px;
    font-weight: 700;
    color: rgb(var(--v-theme-textPrimary));
}

.group-card-count {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgb(var(--v-theme-lightprimary));
    color: rgb(var(--v-theme-primary));
}

.group-card-hint {
    margin-left: auto;
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
}

.field-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 14px;
    border-bottom: 1px solid rgb(var(--v-theme-borderColor));
}

.field-row:last-child {
    border-bottom: none;
}

.field-row--inactive {
    opacity: 0.55;
}

.field-row-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.field-row-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.field-name {
    font-size: 13px;
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
}

.field-key {
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
    background: rgb(var(--v-theme-background));
    padding: 1px 6px;
    border-radius: 4px;
}

.type-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgb(var(--v-theme-lightprimary));
    color: rgb(var(--v-theme-primary));
}

.applies-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    color: rgb(var(--v-theme-textSecondary));
}

.applies-badge.process {
    border-color: rgba(59, 130, 246, 0.4);
    color: #1d4ed8;
}

.applies-badge.task {
    border-color: rgba(16, 185, 129, 0.4);
    color: #047857;
}

.applies-badge.specific_task {
    border-color: rgba(139, 92, 246, 0.4);
    color: #6d28d9;
}

.inactive-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(var(--v-theme-error), 0.1);
    color: rgb(var(--v-theme-error));
}

.panel-renderer-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-textSecondary));
    border: 1px dashed rgb(var(--v-theme-borderColor));
}

.field-row-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.summary-chip {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgb(var(--v-theme-background));
    border: 1px solid rgb(var(--v-theme-borderColor));
    color: rgb(var(--v-theme-textSecondary));
    white-space: nowrap;
}

.description-text {
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.field-row-flags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.order-badge {
    font-size: 10px;
    font-weight: 700;
    min-width: 22px;
    text-align: center;
    padding: 1px 4px;
    border-radius: 4px;
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-textSecondary));
}

.actions-cell {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

.visibility-toggle {
    cursor: pointer;
    margin-right: 4px;
}

.empty-note {
    padding: 24px;
    text-align: center;
    font-size: 13px;
    color: rgb(var(--v-theme-textSecondary));
}

/* ── 미리보기 ── */
.studio-preview {
    flex: 0 0 400px;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 10px;
    padding: 12px;
    background: rgb(var(--v-theme-background));
    overflow-y: auto;
}

.preview-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: rgb(var(--v-theme-textPrimary));
}

.preview-scope-select {
    width: 100%;
}

.preview-panel {
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 8px;
    background: rgb(var(--v-theme-surface));
    padding: 16px;
    display: flex;
    flex-direction: column;
}

/* ── 실제 패널(ProcessHierarchyProperties)의 섹션 스타일 그대로 ── */
.preview-panel .section-group {
    flex-shrink: 0;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    background: #fff;
}

.preview-panel .section-title {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: #fafafa;
    user-select: none;
    transition: background-color 0.15s;
    color: #1f2937;
}

.preview-panel .section-title:hover {
    background: #f0f0f0;
}

.preview-panel .section-body {
    padding: 12px;
    border-top: 1px solid #e8e8e8;
}

.preview-widget-placeholder {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    margin-bottom: 8px;
    border: 1px dashed rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    background: rgb(var(--v-theme-background));
}

.preview-widget-label {
    font-size: 12px;
    font-weight: 600;
    color: rgb(var(--v-theme-textPrimary));
}

.preview-widget-badge {
    margin-left: auto;
    font-size: 10px;
    color: rgb(var(--v-theme-textSecondary));
    white-space: nowrap;
}

.preview-builtin-note {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed rgb(var(--v-theme-borderColor));
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.preview-builtin-title {
    width: 100%;
    font-size: 11px;
    font-weight: 700;
    color: rgb(var(--v-theme-textSecondary));
    margin-bottom: 2px;
}

/* ── 다이얼로그 ── */
.schema-dialog-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px 8px;
    font-size: 16px;
    font-weight: 700;
}

.form-close-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: rgb(var(--v-theme-textSecondary));
    cursor: pointer;
}

.form-close-btn:hover {
    background: rgb(var(--v-theme-background));
}

.schema-dialog-body {
    padding: 8px 24px 4px;
}

.dialog-split {
    display: flex;
    gap: 16px;
    align-items: flex-start;
}

.dialog-form {
    flex: 1 1 auto;
    min-width: 0;
}

.dialog-preview {
    flex: 0 0 260px;
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 10px;
    padding: 12px;
    background: rgb(var(--v-theme-background));
}

.panel-renderer-notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    margin-bottom: 12px;
    border: 1px solid rgba(var(--v-theme-primary), 0.3);
    border-radius: 8px;
    background: rgb(var(--v-theme-lightprimary));
    font-size: 12px;
    color: rgb(var(--v-theme-textPrimary));
}

.dialog-body {
    font-size: 13px;
    color: rgb(var(--v-theme-textPrimary));
}

.target-info {
    padding: 8px 10px;
    border-radius: 6px;
    background: rgb(var(--v-theme-background));
    font-size: 12px;
}

.target-key {
    font-weight: 700;
}

.target-label {
    color: rgb(var(--v-theme-textSecondary));
}

.delete-confirm-input {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.import-summary {
    display: flex;
    gap: 6px;
    margin-top: 4px;
}

.import-conflict {
    border-color: rgba(var(--v-theme-error), 0.5);
    color: rgb(var(--v-theme-error));
}

/* ── 데이터 유실 경고 배너 ── */
.data-loss-warning-banner {
    border: 1px solid rgba(var(--v-theme-error), 0.35);
    border-radius: 8px;
    padding: 12px;
    background: rgba(var(--v-theme-error), 0.05);
}

.data-loss-warning-banner.critical {
    border-color: rgb(var(--v-theme-error));
    background: rgba(var(--v-theme-error), 0.08);
}

.data-loss-warning-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
}

.data-loss-warning-title {
    font-size: 13px;
    font-weight: 700;
    color: rgb(var(--v-theme-error));
}

.data-loss-warning-count {
    font-size: 11px;
    font-weight: 700;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgb(var(--v-theme-error));
    color: #fff;
    margin-left: auto;
}

.data-loss-warning-list {
    margin: 0 0 8px;
    padding-left: 18px;
    font-size: 12px;
    color: rgb(var(--v-theme-textPrimary));
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.data-loss-warning-ack {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}

.usage-process-list {
    margin: 8px 0;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgb(var(--v-theme-surface));
    border: 1px solid rgb(var(--v-theme-borderColor));
}

.usage-process-list-title {
    font-size: 11px;
    font-weight: 700;
    color: rgb(var(--v-theme-textSecondary));
    margin-bottom: 4px;
}

.usage-process-list-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 160px;
    overflow: auto;
}

.usage-process-list-items li {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
}

.usage-process-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.usage-process-scope {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 4px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    color: rgb(var(--v-theme-textSecondary));
    flex-shrink: 0;
}

.action-edit:hover {
    color: rgb(var(--v-theme-primary));
}

.action-deactivate:hover,
.action-soft-delete:hover {
    color: rgb(var(--v-theme-error));
}

.action-activate:hover {
    color: rgb(var(--v-theme-success));
}

@media (max-width: 1100px) {
    .studio-split {
        flex-direction: column;
        overflow-y: auto;
    }

    .studio-list {
        overflow-y: visible;
        flex: 0 0 auto;
    }

    .studio-preview {
        flex: 0 0 auto;
        width: 100%;
        max-height: 420px;
    }

    .dialog-split {
        flex-direction: column;
    }

    .dialog-preview {
        flex: 1 1 auto;
        width: 100%;
        position: static;
    }
}
</style>
