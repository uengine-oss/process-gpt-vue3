<template>
    <div class="hierarchy-properties">
        <!-- Header -->
        <div class="properties-header">
            <div class="properties-header__top-row">
                <!-- 속성 | 검토의견 -->
                <v-tabs
                    v-model="topTab"
                    density="compact"
                    class="top-level-tabs"
                    color="primary"
                    height="48"
                >
                    <v-tab value="properties">
                        <v-icon size="18" start>mdi-tune-vertical</v-icon>
                        속성
                    </v-tab>
                    <v-tab value="governance">
                        <v-icon size="18" start>mdi-shield-check-outline</v-icon>
                        검토의견
                    </v-tab>
                </v-tabs>
                <v-btn
                    icon
                    variant="text"
                    size="small"
                    class="properties-header__close-btn"
                    @click="$emit('close')"
                >
                    <v-icon size="18">mdi-close</v-icon>
                </v-btn>
            </div>
        </div>

        <!-- [2.4.2] Validation Alert Banner -->
        <div v-if="validationAlerts.length > 0" class="validation-banner">
            <div class="validation-banner__indicator" />
            <svg class="validation-banner__icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
            <ul class="validation-banner__list">
                <li v-for="(alert, idx) in validationAlerts" :key="idx">{{ alert }}</li>
            </ul>
        </div>

        <!-- Content -->
        <div class="properties-content" :class="{ 'properties-content--readonly': isViewMode && topTab === 'properties' }">
            <div v-if="isViewMode && topTab === 'properties'" class="readonly-overlay">
                <v-icon size="16" class="mr-1">mdi-lock</v-icon>
                {{ readOnlyMessage || '읽기 전용 모드입니다.' }}
            </div>
            <v-window v-model="topTab" :transition="false" :reverse-transition="false">
                <!-- ==================== Properties Tab ==================== -->
                <v-window-item value="properties">
                    <!-- Sub-tabs: Process | Task -->
                    <v-tabs
                        v-model="activeTab"
                        density="compact"
                        class="properties-tabs"
                        color="primary"
                        height="32"
                    >
                        <v-tab value="process" size="small">
                            <v-icon size="14" start>mdi-cog-outline</v-icon>
                            Process
                        </v-tab>
                        <v-tab value="task" size="small">
                            <v-icon size="14" start>mdi-cursor-default-click</v-icon>
                            Task
                            <v-badge v-if="activeElement" dot color="primary" inline class="ml-1" />
                        </v-tab>
                        <v-tab v-if="isOwner" value="pi-flag" size="small">
                            <v-icon size="14" start color="error">mdi-flag</v-icon>
                            PI Flag
                        </v-tab>
                    </v-tabs>

                    <v-window v-model="activeTab" :transition="false" :reverse-transition="false">
                        <!-- ==================== Process Tab ==================== -->
                        <v-window-item value="process">
                            <div class="pa-4">
                                <!-- Process Meta Card (담당자, 메가 메이저 표시) -->
                                <div class="process-meta-card mb-4">
                                    <!-- 담당자 정보 -->
                                    <div class="process-meta-row" style="flex-direction: column; align-items: stretch;">
                                        <div class="d-flex align-center justify-space-between mb-1">
                                            <div class="process-meta-label" style="margin-bottom: 0;">
                                                <v-icon size="14" class="mr-1" color="blue-grey">mdi-account-group</v-icon>
                                                담당자
                                            </div>
                                            <div class="d-flex align-center ga-1">
                                                <v-btn
                                                    v-if="definitionPath && !isViewMode"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="grey-darken-1"
                                                    class="text-none"
                                                    :loading="ownerHistoryLoading"
                                                    @click="openOwnerHistoryDialog"
                                                >
                                                    <v-icon start size="12">mdi-history</v-icon>
                                                    변경 이력
                                                </v-btn>
                                                <v-btn
                                                    v-if="isAdmin && !isViewMode"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="primary"
                                                    class="text-none"
                                                    @click="ownerSettingDialogOpen = true"
                                                >
                                                    <v-icon start size="12">mdi-pencil</v-icon>
                                                    설정
                                                </v-btn>
                                            </div>
                                        </div>
                                        <div class="d-flex flex-column ga-1 mt-1">
                                            <div v-if="kpiAssignmentsForCurrent.length > 0" class="text-caption">
                                                <span class="text-medium-emphasis mr-1">KPI 지정:</span>
                                                <v-chip
                                                    v-for="(kpi, kpiIdx) in kpiAssignmentsForCurrent"
                                                    :key="`${kpi.year}-${kpi.label}-${kpiIdx}`"
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="grey-darken-3"
                                                    class="mr-1 mb-1"
                                                >
                                                    {{ kpi.year }} {{ kpi.label }}
                                                </v-chip>
                                            </div>
                                            <div class="text-caption">
                                                <span class="text-medium-emphasis mr-1">PI팀 담당자:</span>
                                                <template v-if="ownerResolved">
                                                    <v-chip size="x-small" variant="tonal" color="grey-darken-3" class="mr-1 mb-1">{{ displayText(ownerResolved.username) }}<template v-if="ownerResolved.org_name"> ({{ displayText(ownerResolved.org_name) }})</template></v-chip>
                                                </template>
                                                <span v-else class="text-disabled">{{ displayText(processForm.owner) || '미지정' }}</span>
                                            </div>
                                            <div class="text-caption">
                                                <span class="text-medium-emphasis mr-1">현업담당자:</span>
                                                <template v-if="procDefOwners.fieldOwners.length > 0">
                                                    <v-chip v-for="(fo, ownerIdx) in procDefOwners.fieldOwners" :key="ownerKey(fo, ownerIdx, 'field')" size="x-small" variant="tonal" color="grey-darken-3" class="mr-1 mb-1">{{ resolvedOwnerName(fo) }}</v-chip>
                                                </template>
                                                <span v-else class="text-disabled">미지정</span>
                                            </div>
                                            <div class="text-caption">
                                                <span class="text-medium-emphasis mr-1">검토담당자:</span>
                                                <template v-if="procDefOwners.hqOwners.length > 0">
                                                    <v-chip v-for="(ho, ownerIdx) in procDefOwners.hqOwners" :key="ownerKey(ho, ownerIdx, 'hq')" size="x-small" variant="tonal" color="grey-darken-3" class="mr-1 mb-1">{{ resolvedOwnerName(ho) }}</v-chip>
                                                </template>
                                                <span v-else class="text-disabled">미지정</span>
                                            </div>
                                            <div class="text-caption">
                                                <span class="text-medium-emphasis mr-1">최종검토자:</span>
                                                <v-chip v-if="procDefOwners.masterOwner" size="x-small" variant="tonal" color="grey-darken-3" class="mb-1">{{ resolvedOwnerName(procDefOwners.masterOwner) }}</v-chip>
                                                <span v-else class="text-disabled">미지정</span>
                                            </div>
                                        </div>
                                        <OwnerSettingDialog
                                            v-model="ownerSettingDialogOpen"
                                            :process="{ id: displayText(definitionPath), name: displayText(processForm.title) }"
                                            @saved="onOwnerSettingSaved"
                                        />
                                        <v-dialog v-model="ownerHistoryDialogOpen" max-width="720" scrollable>
                                            <v-card>
                                                <v-card-title class="d-flex align-center pa-4 pb-2">
                                                    <v-icon class="mr-2">mdi-history</v-icon>
                                                    담당자 변경 이력
                                                    <v-spacer />
                                                    <v-btn icon variant="text" size="small" @click="ownerHistoryDialogOpen = false">
                                                        <v-icon>mdi-close</v-icon>
                                                    </v-btn>
                                                </v-card-title>
                                                <v-card-text class="pa-4 pt-2">
                                                    <div v-if="ownerHistoryLoading" class="text-center py-6">
                                                        <v-progress-circular indeterminate size="28" color="primary" />
                                                    </div>
                                                    <div v-else-if="ownerHistoryEntries.length === 0" class="text-center py-6">
                                                        <v-icon size="36" color="grey-lighten-2">mdi-history</v-icon>
                                                        <div class="text-caption text-disabled mt-2">담당자 변경 이력이 없습니다</div>
                                                    </div>
                                                    <div v-else class="d-flex flex-column ga-3">
                                                        <v-card
                                                            v-for="entry in ownerHistoryEntries"
                                                            :key="entry.id"
                                                            variant="outlined"
                                                            class="pa-3"
                                                        >
                                                            <div class="d-flex align-center justify-space-between mb-2">
                                                                <span class="text-caption text-medium-emphasis">
                                                                    {{ ownerHistoryDate(entry) }}
                                                                </span>
                                                                <v-btn
                                                                    v-if="isAdmin && !isViewMode"
                                                                    size="x-small"
                                                                    variant="tonal"
                                                                    color="primary"
                                                                    class="text-none"
                                                                    @click="openOwnerRollbackConfirm(entry)"
                                                                >
                                                                    담당자 적용
                                                                </v-btn>
                                                            </div>
                                                            <div class="d-flex flex-column ga-1 text-caption">
                                                                <div>
                                                                    <span class="text-medium-emphasis mr-1">변경 담당자:</span>
                                                                    <span>{{ ownerHistoryActor(entry) }}</span>
                                                                </div>
                                                                <div>
                                                                    <span class="text-medium-emphasis mr-1">PI팀 담당자:</span>
                                                                    <span>{{ ownerHistorySingleOwner(entry, 'primaryOwner') }}</span>
                                                                </div>
                                                                <div>
                                                                    <span class="text-medium-emphasis mr-1">현업담당자:</span>
                                                                    <span>{{ ownerHistoryOwnerList(entry, 'fieldOwners') }}</span>
                                                                </div>
                                                                <div>
                                                                    <span class="text-medium-emphasis mr-1">검토담당자:</span>
                                                                    <span>{{ ownerHistoryOwnerList(entry, 'hqOwners') }}</span>
                                                                </div>
                                                                <div>
                                                                    <span class="text-medium-emphasis mr-1">최종검토자:</span>
                                                                    <span>{{ ownerHistorySingleOwner(entry, 'masterOwner') }}</span>
                                                                </div>
                                                            </div>
                                                        </v-card>
                                                        <div v-if="ownerHistoryCanLoadAll" class="text-center">
                                                            <v-btn
                                                                size="small"
                                                                variant="text"
                                                                color="primary"
                                                                class="text-none"
                                                                :loading="ownerHistoryLoadingAll"
                                                                @click="loadAllOwnerHistory"
                                                            >
                                                                전체 보기
                                                            </v-btn>
                                                        </div>
                                                    </div>
                                                </v-card-text>
                                            </v-card>
                                        </v-dialog>
                                        <v-dialog v-model="ownerRollbackConfirmOpen" max-width="440" persistent>
                                            <v-card>
                                                <v-card-title class="text-subtitle-1 font-weight-bold">
                                                    담당자 적용
                                                </v-card-title>
                                                <v-card-text class="text-body-2">
                                                    선택한 변경 이력에 표시된 담당자 상태를 현재 순서도에 적용합니다. 이 작업은 현재 순서도에만 적용되며 하위 프로세스에는 전파되지 않습니다.
                                                </v-card-text>
                                                <v-card-actions>
                                                    <v-spacer />
                                                    <v-btn
                                                        variant="text"
                                                        :disabled="ownerRollbackSaving"
                                                        @click="ownerRollbackConfirmOpen = false"
                                                    >
                                                        취소
                                                    </v-btn>
                                                    <v-btn
                                                        color="primary"
                                                        variant="flat"
                                                        :loading="ownerRollbackSaving"
                                                        @click="rollbackOwnerHistory"
                                                    >
                                                        적용
                                                    </v-btn>
                                                </v-card-actions>
                                            </v-card>
                                        </v-dialog>
                                    </div>

                                    <!-- Parent Hierarchy(메가 메이저 표시) -->
                                    <div class="process-meta-row">
                                        <div class="process-meta-label">
                                            <v-icon size="14" class="mr-1" color="blue-grey">mdi-file-tree</v-icon>
                                            Parent
                                        </div>
                                        <div class="process-meta-value">
                                            <template v-if="!parentEditEnabled">
                                                <!-- 모듈 마커가 있어도 proc_map에 남아있으면 실제 등록 위치를 보여준다 -->
                                                <template v-if="isCurrentlyModule && !parentHierarchy">
                                                    <div class="parent-hierarchy-path">
                                                        <v-chip size="x-small" color="grey-darken-1" variant="tonal" class="mr-1">
                                                            <v-icon start size="12">mdi-puzzle-outline</v-icon>
                                                            모듈
                                                        </v-chip>
                                                        <span class="text-medium-emphasis">체계도 미등록</span>
                                                    </div>
                                                    <div v-if="processParentRefs.length > 0" class="mt-3">
                                                        <div class="text-caption text-medium-emphasis mb-2">
                                                            참조된 곳 ({{ processParentRefs.length }})
                                                        </div>
                                                        <div class="sk-mapping-list sk-mapping-list--no-divider">
                                                            <div v-for="ref in processParentRefs" :key="ref.id" class="sk-mapping-list__row">
                                                                <div class="sk-mapping-list__head">
                                                                    <span class="sk-mapping-list__label">process</span>
                                                                    <span
                                                                        class="sk-mapping-list__name sk-mapping-list__name--link"
                                                                        @click.stop="openParentRefInNewWindow(ref)"
                                                                    >{{ ref.name }}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </template>
                                                <template v-else-if="parentHierarchy">
                                                    <div v-if="parentHierarchy.domainName" class="parent-hierarchy-path">
                                                        <v-chip size="x-small" color="deep-purple" variant="tonal" class="mr-1">Domain</v-chip>
                                                        {{ displayText(parentHierarchy.domainName) }}
                                                    </div>
                                                    <div class="parent-hierarchy-path" :class="{ 'mt-1': parentHierarchy.domainName }">
                                                        <v-chip size="x-small" color="indigo" variant="tonal" class="mr-1">Mega</v-chip>
                                                        {{ displayText(parentHierarchy.megaName) }}
                                                    </div>
                                                    <div class="parent-hierarchy-path mt-1">
                                                        <v-chip size="x-small" color="teal" variant="tonal" class="mr-1">Major</v-chip>
                                                        {{ displayText(parentHierarchy.majorName) }}
                                                    </div>
                                                </template>
                                                <span v-else class="process-meta-empty">미지정</span>
                                            </template>
                                            <template v-else>
                                                <v-select
                                                    v-model="parentForm.domainId"
                                                    :items="domainOptions"
                                                    item-title="name"
                                                    item-value="id"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    label="Domain"
                                                    class="mb-2"
                                                    clearable
                                                    @update:modelValue="onParentDomainChange"
                                                />
                                                <v-select
                                                    v-model="parentForm.megaId"
                                                    :items="megaOptionsForParentEdit"
                                                    item-title="name"
                                                    item-value="id"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    label="Mega Process"
                                                    class="mb-2"
                                                    :disabled="!parentForm.domainId"
                                                    @update:modelValue="onParentMegaChange"
                                                />
                                                <v-select
                                                    v-model="parentForm.majorId"
                                                    :items="majorOptionsForParentEdit"
                                                    item-title="name"
                                                    item-value="id"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    label="Major Process"
                                                    :disabled="!parentForm.megaId"
                                                    @update:modelValue="onParentMajorChange"
                                                />
                                                <div v-if="parentForm.domainId === null && !isCurrentlyModule" class="text-caption text-warning mt-1">
                                                    Domain을 비우면 이 프로세스는 모듈로 저장됩니다.
                                                </div>
                                                <!-- Domain이 이미 비어있으면 clear 동작이 불가능하므로 명시적 전환 버튼 제공 -->
                                                <v-btn
                                                    v-if="!isCurrentlyModule || parentHierarchy"
                                                    size="small"
                                                    variant="tonal"
                                                    color="warning"
                                                    class="mt-2 text-none"
                                                    prepend-icon="mdi-puzzle-outline"
                                                    @click="openParentChangeDialog('module')"
                                                >
                                                    모듈로 전환 (체계도 미등록)
                                                </v-btn>
                                            </template>
                                        </div>
                                    </div>

                                    <!-- FR-017: 이 프로세스모듈을 CallActivity 로 참조하는 상위(parent) 프로세스 목록 -->
                                    <div v-if="isCurrentlyModule" class="process-meta-row">
                                        <div class="process-meta-label">
                                            <v-icon size="14" class="mr-1" color="blue-grey">mdi-source-branch</v-icon>
                                            참조된 곳<template v-if="moduleParentRefs.length"> ({{ moduleParentRefs.length }})</template>
                                        </div>
                                        <div class="process-meta-value">
                                            <span v-if="moduleParentRefsLoading" class="process-meta-empty">불러오는 중…</span>
                                            <span v-else-if="!moduleParentRefs.length" class="process-meta-empty">이 모듈을 참조하는 프로세스가 없습니다</span>
                                            <div v-else class="sk-mapping-list sk-mapping-list--no-divider">
                                                <div v-for="ref in moduleParentRefs" :key="ref.id" class="sk-mapping-list__row">
                                                    <div class="sk-mapping-list__head">
                                                        <span class="sk-mapping-list__label">process</span>
                                                        <span
                                                            class="sk-mapping-list__name sk-mapping-list__name--link"
                                                            @click.stop="openParentRefInNewWindow(ref)"
                                                        >{{ ref.name }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- KPI 스위치 -->
                                    <!-- <div class="process-meta-row">
                                        <v-switch
                                            v-model="processForm.kpiEnabled"
                                            density="compact"
                                            hide-details
                                            color="primary"
                                            label="KPI"
                                            :disabled="isViewMode"
                                        />
                                    </div> -->
                                </div>

                                <!-- 기본 정보 (이름, 설명, 추가된 스키마) -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('general')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('general') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="blue-grey">mdi-information-outline</v-icon>
                                        일반
                                    </div>
                                    <div v-show="isOpen('general')" class="section-body">
                                        <label class="field-label">프로세스명</label>
                                        <v-text-field
                                            v-model="processForm.title"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            class="mb-3"
                                            placeholder="프로세스 이름 입력"
                                        />
                                        <label class="field-label">설명</label>
                                        <v-textarea
                                            v-model="processForm.description"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            rows="3"
                                            auto-grow
                                            class="mb-3"
                                            placeholder="프로세스에 대한 설명을 입력하세요..."
                                        />
                                        <!-- Schema fields for Process -->
                                        <template v-for="field in processFields" :key="field.id">
                                            <div class="field-label">
                                                <span class="field-label-left">
                                                    {{ field.property_label || field.property_key }}
                                                    <v-chip label size="x-small" density="compact" color="grey" style="font-size: 9px !important;">{{ getPropertyTypeLabel(field.property_type) }}</v-chip>
                                                    <v-chip v-if="field.is_deprecated_field" label size="x-small" density="compact" color="warning" class="ml-1" style="font-size: 9px !important;">사용 중단</v-chip>
                                                    <v-chip v-else-if="field.is_readonly" label size="x-small" density="compact" color="primary" class="ml-1" style="font-size: 9px !important;">읽기 전용</v-chip>
                                                    <v-chip v-if="field.is_required && !field.is_deprecated_field" label size="x-small" density="compact" color="red" class="ml-1" style="font-size: 9px !important;">필수</v-chip>
                                                </span>
                                                <DetailComponent
                                                    v-if="field.description"
                                                    :title="displayText(field.property_label || field.property_key)"
                                                    :details="[{ title: field.description }]"
                                                    :icon-size="14"
                                                />
                                            </div>
                                            <v-text-field
                                                v-if="field.property_type === 'string'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :placeholder="field.placeholder"
                                                :disabled="field.is_readonly"
                                            />
                                            <v-textarea
                                                v-else-if="field.property_type === 'textarea'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3"
                                                :placeholder="field.placeholder"
                                                :disabled="field.is_readonly"
                                            />
                                            <v-text-field
                                                v-else-if="field.property_type === 'number'"
                                                :model-value="numberFieldDisplay(processForm[field.property_key], field)"
                                                @focus="onNumberFocus($event)"
                                                @blur="onNumberBlur($event, field, (v) => processForm[field.property_key] = v)"
                                                density="compact" variant="outlined" hide-details="auto" class="mb-3"
                                                :placeholder="field.placeholder"
                                                :suffix="field.number_unit || undefined"
                                                :rules="numberRules(field)"
                                                :disabled="field.is_readonly"
                                            />
                                            <v-text-field
                                                v-else-if="field.property_type === 'url'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :placeholder="field.placeholder || 'https://...'"
                                                :disabled="field.is_readonly"
                                            >
                                                <template v-slot:prepend-inner>
                                                    <v-icon size="14" color="grey">mdi-link-variant</v-icon>
                                                </template>
                                                <template v-slot:append-inner>
                                                    <v-icon
                                                        v-if="processForm[field.property_key]"
                                                        size="16" style="cursor:pointer"
                                                        @click="openLink(processForm[field.property_key])"
                                                    >mdi-open-in-new</v-icon>
                                                </template>
                                            </v-text-field>
                                            <div v-else-if="field.property_type === 'formula'" class="formula-display mb-3">
                                                <span class="text-caption text-medium-emphasis">{{ field.config?.expression || '' }}</span>
                                                <span class="text-subtitle-2 font-weight-bold ml-2">{{ processForm[field.property_key] || '-' }}</span>
                                            </div>
                                            <v-select
                                                v-else-if="field.property_type === 'db-select'"
                                                v-model="processForm[field.property_key]"
                                                :items="getSelectFieldItems(field)"
                                                item-title="label" item-value="value"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :placeholder="field.placeholder"
                                                :clearable="!field.is_readonly"
                                                :disabled="field.is_readonly"
                                            />
                                            <v-select
                                                v-else-if="field.property_type === 'select'"
                                                v-model="processForm[field.property_key]"
                                                :items="getSelectFieldItems(field)"
                                                item-title="label" item-value="value"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :clearable="!field.is_readonly"
                                                :disabled="field.is_readonly"
                                            />
                                            <v-select
                                                v-else-if="field.property_type === 'multiselect'"
                                                v-model="processForm[field.property_key]"
                                                :items="getSelectFieldItems(field)"
                                                item-title="label" item-value="value"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :clearable="!field.is_readonly"
                                                multiple chips
                                                :closable-chips="!field.is_readonly"
                                                :disabled="field.is_readonly"
                                            />
                                            <v-text-field
                                                v-else-if="field.property_type === 'date'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details type="date" class="mb-3"
                                                :placeholder="field.placeholder"
                                                :disabled="field.is_readonly"
                                            />
                                            <div v-else-if="field.property_type === 'daterange'" class="daterange-row mb-3">
                                                <v-text-field
                                                    v-model="processForm[field.property_key + '_start']"
                                                    density="compact" variant="outlined" hide-details type="date"
                                                    :placeholder="field.placeholder || 'Start'"
                                                    :disabled="field.is_readonly"
                                                />
                                                <span class="daterange-separator">~</span>
                                                <v-text-field
                                                    v-model="processForm[field.property_key + '_end']"
                                                    density="compact" variant="outlined" hide-details type="date"
                                                    :placeholder="'End'"
                                                    :disabled="field.is_readonly"
                                                />
                                            </div>
                                            <v-autocomplete
                                                v-else-if="field.property_type === 'user'"
                                                v-model="processForm[field.property_key]"
                                                :items="userSearchResults[field.property_key] || []"
                                                item-title="name" item-value="id"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :placeholder="field.placeholder || 'Search user... (Enter)'"
                                                :clearable="!field.is_readonly"
                                                :loading="userSearchLoading[field.property_key]"
                                                :disabled="field.is_readonly"
                                                @keydown.enter="field.is_readonly ? null : onUserSearch(field.property_key, $event.target.value)"
                                            >
                                                <template v-slot:prepend-inner>
                                                    <v-icon size="14" color="grey">mdi-account-search-outline</v-icon>
                                                </template>
                                            </v-autocomplete>
                                            <v-switch
                                                v-else-if="field.property_type === 'boolean'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" color="primary" hide-details class="mb-3"
                                                :disabled="field.is_readonly"
                                            />
                                        </template>
                                    </div>
                                </div>

                                <!-- 메뉴얼 링크 연결 -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('manual-link')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('manual-link') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="indigo">mdi-link-variant</v-icon>
                                        관련자료 링크
                                    </div>
                                    <div v-show="isOpen('manual-link')" class="section-body">
                                        <ManualLinkField v-model="processForm.manualLinks" :disabled="isViewMode" />

                                        <!-- Task별 집계 (작업 목록에서 집계됨, 읽기 전용) -->
                                        <div v-if="taskManualLinksSummary.length > 0" class="task-manual-links-aggregate mt-3">
                                            <div class="text-caption text-medium-emphasis mb-2 d-flex align-center">
                                                Task 별 등록 링크
                                                <v-chip size="x-small" variant="tonal" color="indigo" class="ml-2">
                                                    {{ taskManualLinksTotalCount }}
                                                </v-chip>
                                            </div>
                                            <div class="sk-mapping-list">
                                                <div v-for="task in taskManualLinksSummary" :key="task.taskId" class="sk-mapping-list__row">
                                                    <div class="sk-mapping-list__head">
                                                        <span class="sk-mapping-list__label">Task</span>
                                                        <span
                                                            class="sk-mapping-list__name sk-mapping-list__name--link"
                                                            @click="$emit('focusElement', task.taskId)"
                                                        >{{ task.taskName }}</span>
                                                        <span class="sk-mapping-list__count">{{ task.links.length }}</span>
                                                    </div>
                                                    <div class="sk-mapping-list__items">
                                                        <a
                                                            v-for="(link, idx) in task.links"
                                                            :key="idx"
                                                            :href="link.url && /^https?:\/\//i.test(link.url) ? link.url : 'https://' + link.url"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            class="sk-mapping-list__item"
                                                        >
                                                            <span class="sk-mapping-list__item-label">링크</span>
                                                            <span class="sk-mapping-list__item-text">{{ link.name || link.url }}</span>
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- API 연동 (작업 목록에서 집계됨, 읽기 전용) -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('proc-api')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('proc-api') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="teal">mdi-api</v-icon>
                                        API 연동
                                        <v-chip size="x-small" variant="tonal" color="teal" class="ml-auto">
                                            {{ taskApiIntegrationsSummary.length }}
                                        </v-chip>
                                    </div>
                                    <div v-show="isOpen('proc-api')" class="section-body">
                                        <div v-if="taskApiIntegrationsSummary.length === 0" class="text-caption text-disabled">
                                            Task에 등록된 API 연동이 없습니다.
                                        </div>
                                        <div v-else class="sk-mapping-list">
                                            <div v-for="api in taskApiIntegrationsSummary" :key="api.key" class="sk-mapping-list__row">
                                                <div class="sk-mapping-list__head">
                                                    <span class="sk-mapping-list__label">API</span>
                                                    <span class="sk-mapping-list__name">{{ api.name || api.url || '-' }}</span>
                                                    <span class="sk-mapping-list__count">{{ api.tasks.length }}</span>
                                                </div>
                                                <div class="sk-mapping-list__items pi-flag-comments">
                                                    <div class="pi-flag-card__item api-agg-item">
                                                        <div class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">메서드</span>
                                                            <span class="pi-flag-card__item-value">{{ api.method || '-' }}</span>
                                                        </div>
                                                        <div class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">URL</span>
                                                            <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ api.url || '-' }}</span>
                                                        </div>
                                                        <div class="pi-flag-card__item-row pi-flag-card__item-row--column">
                                                            <span class="pi-flag-card__item-label">파라미터</span>
                                                            <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">
                                                                <template v-if="api.params.length">
                                                                    <div v-for="(p, idx) in api.params" :key="idx">{{ p.key }} : {{ p.value }}</div>
                                                                </template>
                                                                <template v-else>-</template>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="sk-mapping-list__items">
                                                    <div
                                                        v-for="task in api.tasks"
                                                        :key="task.id"
                                                        class="sk-mapping-list__item"
                                                        @click.stop="$emit('focusElement', task.id)"
                                                    >
                                                        <span class="sk-mapping-list__item-label">task</span>
                                                        <span class="sk-mapping-list__item-text">{{ task.name }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 시스템 목록 (읽기 전용, 작업 목록에서 집계됨) -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('proc-system')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('proc-system') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="blue">mdi-server-network</v-icon>
                                        시스템 리스트
                                        <v-chip size="x-small" variant="tonal" color="blue" class="ml-auto">
                                            {{ systemsSummary.length }}
                                        </v-chip>
                                    </div>
                                    <div v-show="isOpen('proc-system')" class="section-body">
                                        <div v-if="systemsSummary.length === 0" class="text-caption text-disabled">
                                            Task에 매핑된 시스템이 없습니다.
                                        </div>
                                        <div v-else class="sk-mapping-list">
                                            <div v-for="system in systemsSummary" :key="system.id || system.name" class="sk-mapping-list__row">
                                                <div class="sk-mapping-list__head">
                                                    <span class="sk-mapping-list__label">시스템</span>
                                                    <a
                                                        v-if="system.id"
                                                        :href="buildAtdtSystemDetailUrl(system.id)"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="sk-mapping-list__name sk-mapping-list__name--link"
                                                    >{{ system.name }}</a>
                                                    <span v-else class="sk-mapping-list__name">{{ system.name }}</span>
                                                    <span class="sk-mapping-list__count">{{ system.tasks.length }}</span>
                                                </div>
                                                <div class="sk-mapping-list__items">
                                                    <div
                                                        v-for="task in system.tasks"
                                                        :key="task.id"
                                                        class="sk-mapping-list__item"
                                                        @click.stop="$emit('focusElement', task.id)"
                                                    >
                                                        <span class="sk-mapping-list__item-label">task</span>
                                                        <span class="sk-mapping-list__item-text">{{ task.name }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 연관 과제 목록 -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('proc-related-projects')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('proc-related-projects') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="purple">mdi-clipboard-list-outline</v-icon>
                                        연관과제 리스트
                                        <v-chip size="x-small" variant="tonal" color="purple" class="ml-auto">
                                            {{ relatedProjectsByTask.length }}
                                        </v-chip>
                                    </div>
                                    <div v-show="isOpen('proc-related-projects')" class="section-body">
                                        <div v-if="relatedProjectsByTask.length === 0" class="text-caption text-disabled">
                                            Task에 매핑된 연관 과제가 없습니다.
                                        </div>
                                        <div v-else class="sk-mapping-list">
                                            <div
                                                v-for="entry in relatedProjectsByTask"
                                                :key="entry.kind === 'group' ? `group:${entry.groupId}` : `task:${entry.taskId}`"
                                                class="sk-mapping-list__row"
                                            >
                                                <div class="sk-mapping-list__head">
                                                    <span class="sk-mapping-list__label">{{ entry.kind === 'group' ? '묶음 task' : 'Task' }}</span>
                                                    <span
                                                        class="sk-mapping-list__name"
                                                        :class="{
                                                            'sk-mapping-list__name--wrap': entry.kind === 'group',
                                                            'sk-mapping-list__name--link': entry.kind !== 'group'
                                                        }"
                                                        @click="entry.kind !== 'group' && $emit('focusElement', entry.taskId)"
                                                    >
                                                        <template v-if="entry.kind === 'group'">
                                                            <v-chip
                                                                v-for="(name, nIdx) in entry.taskNames"
                                                                :key="name"
                                                                size="x-small"
                                                                variant="tonal"
                                                                color="grey"
                                                                class="mr-1 mb-1 sk-group-task-chip"
                                                                @click.stop="entry.taskIds[nIdx] && $emit('focusElement', entry.taskIds[nIdx])"
                                                            >{{ name }}</v-chip>
                                                        </template>
                                                        <template v-else>{{ entry.taskName }}</template>
                                                    </span>
                                                    <span class="sk-mapping-list__count">{{ entry.projects.length }}</span>
                                                </div>
                                                <div class="sk-mapping-list__items">
                                                    <a
                                                        v-for="project in entry.projects"
                                                        :key="project.id || project.name"
                                                        :href="project.id ? buildAtdtTaskDetailUrl(project.id) : undefined"
                                                        :target="project.id ? '_blank' : undefined"
                                                        rel="noopener noreferrer"
                                                        class="sk-mapping-list__item"
                                                    >
                                                        <span class="sk-mapping-list__item-label">과제</span>
                                                        <span class="sk-mapping-list__item-text">{{ project.name }}</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 전략적 자산 -->
                                <!-- <div class="section-group">
                                    <div class="section-title" @click="toggle('strategic')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('strategic') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="deep-purple">mdi-strategy</v-icon>
                                        전략 속성
                                    </div>
                                    <div v-show="isOpen('strategic')" class="section-body">
                                        <label class="field-label">미래 상태 (FUTURE STATE)</label>
                                        <v-select
                                            v-model="processForm.futureState"
                                            :items="futureStateOptions"
                                            item-title="title"
                                            item-value="value"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            class="mb-3"
                                        />
                                        <label class="field-label">관련 과제 WIL</label>
                                        <v-text-field
                                            v-model="processForm.wilTask"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            class="mb-3"
                                            placeholder="과제를 검색 또는 입력..."
                                        />
                                    </div>
                                </div> -->

                                <!-- 2. Hybrid Costing -->
                                <!-- <div class="section-group">
                                    <div class="section-title" @click="toggle('hybrid-costing')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('hybrid-costing') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="teal">mdi-calculator-variant</v-icon>
                                        비용 산정
                                        <v-chip v-if="processFteValue" size="x-small" variant="tonal" color="primary" class="ml-auto">
                                            FTE {{ processFteValue }}
                                        </v-chip>
                                    </div>
                                    <div v-show="isOpen('hybrid-costing')" class="section-body">
                                        <label class="field-label">FTE 소요 시간 (HR/MONTH)</label>
                                        <v-text-field
                                            v-model.number="processForm.fteHoursPerMonth"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            type="number"
                                            min="0"
                                            max="100"
                                            class="mb-1"
                                        >
                                            <template v-slot:append-inner>
                                                <span class="text-caption text-medium-emphasis">hr</span>
                                            </template>
                                        </v-text-field>
                                        <div class="d-flex justify-space-between">
                                            <span class="text-caption text-disabled">0h</span>
                                            <span class="text-caption text-disabled">100h</span>
                                        </div>
                                        <div class="mt-3">
                                            <div class="d-flex align-center cursor-pointer text-caption text-medium-emphasis" @click="toggle('proc-fte-detail')">
                                                <v-icon size="12" class="mr-1">{{ isOpen('proc-fte-detail') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                                FTE 상세 계산기
                                            </div>
                                            <div v-show="isOpen('proc-fte-detail')" class="mt-2">
                                                <label class="field-label">입력 방식</label>
                                                <v-btn-toggle v-model="processForm.fte.inputMode" mandatory density="compact" class="mb-3 fte-mode-toggle" color="primary">
                                                    <v-btn value="direct" size="small">직접 입력 %</v-btn>
                                                    <v-btn value="time" size="small">시간-빈도-인원</v-btn>
                                                </v-btn-toggle>
                                                <template v-if="processForm.fte.inputMode === 'direct'">
                                                    <label class="field-label">FTE (%)</label>
                                                    <v-text-field
                                                        v-model.number="processForm.fte.directPercent"
                                                        density="compact" variant="outlined" hide-details type="number"
                                                        min="0" max="100" suffix="%"
                                                    />
                                                </template>
                                                <template v-else>
                                                    <v-row dense>
                                                        <v-col cols="6">
                                                            <label class="field-label">빈도 주기</label>
                                                            <v-select
                                                                v-model="processForm.fte.freqCycle"
                                                                :items="freqCycleOptions"
                                                                item-title="title" item-value="value"
                                                                density="compact" variant="outlined" hide-details
                                                            />
                                                        </v-col>
                                                        <v-col cols="6">
                                                            <label class="field-label">빈도 횟수</label>
                                                            <v-text-field
                                                                v-model.number="processForm.fte.freqCount"
                                                                density="compact" variant="outlined" hide-details type="number" min="0"
                                                            />
                                                        </v-col>
                                                    </v-row>
                                                    <label class="field-label mt-3">건당 소요시간 (시간)</label>
                                                    <v-text-field
                                                        v-model.number="processForm.fte.timePerTask"
                                                        density="compact" variant="outlined" hide-details type="number" min="0" step="0.1"
                                                    />
                                                    <label class="field-label mt-3">투입 인원</label>
                                                    <v-text-field
                                                        v-model.number="processForm.fte.headcount"
                                                        density="compact" variant="outlined" hide-details type="number" min="1"
                                                    />
                                                </template>
                                                <div v-if="processFteValue" class="fte-result-card mt-3">
                                                    <div class="d-flex align-center justify-space-between">
                                                        <span class="fte-result-label">산출 FTE</span>
                                                    </div>
                                                    <div class="fte-result-value">{{ processFteValue }} FTE</div>
                                                    <div v-if="processForm.fte.inputMode === 'time'" class="fte-formula">
                                                        = {{ processForm.fte.timePerTask || 0 }}h
                                                        &times; {{ processForm.fte.freqCount || 0 }}/{{ freqCycleLabel }}
                                                        &times; {{ processForm.fte.headcount || 1 }}p
                                                        &divide; {{ annualWorkingHours }}h
                                                        = {{ processFteValue }} FTE
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div> -->

                                <!-- 프로세스 전체 소요시간 Total FTE / Duration (Read-only) -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('proc-total-fte')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('proc-total-fte') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="teal">mdi-clock-outline</v-icon>
                                        프로세스 전체 소요시간
                                        <v-chip v-if="totalFteSummary.totalFte" size="x-small" variant="tonal" color="teal" class="ml-auto">
                                            {{ totalFteSummary.totalFte }} FTE
                                        </v-chip>
                                    </div>
                                    <div v-show="isOpen('proc-total-fte')" class="section-body">
                                        <div v-if="totalFteSummary.items.length === 0" class="text-caption text-disabled">
                                            Task에 소요시간이 입력되지 않았습니다.
                                        </div>
                                        <template v-else>
                                            <div class="task-count-grid">
                                                <div v-if="totalFteSummary.totalFte" class="task-count-row">
                                                    <span class="task-count-label font-weight-medium">총 FTE</span>
                                                    <span class="task-count-value font-weight-bold">{{ totalFteSummary.totalFte }}</span>
                                                </div>
                                                <div v-if="totalFteSummary.totalHours" class="task-count-row">
                                                    <span class="task-count-label font-weight-medium">월간 총 시간</span>
                                                    <span class="task-count-value font-weight-bold">{{ totalFteSummary.totalHours }}h</span>
                                                </div>
                                                <div v-for="item in totalFteSummary.items" :key="item.name" class="task-count-row">
                                                    <span class="task-count-label">{{ item.name }}</span>
                                                    <span class="task-count-value">
                                                        <template v-if="item.fte">{{ item.fte }} FTE</template>
                                                        <template v-if="item.fte && item.hours"> · </template>
                                                        <template v-if="item.hours">{{ item.hours }}h/mo</template>
                                                    </span>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </div>

                                <!-- 프로세스 전체 비용 Total Cost (Read-only) -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('proc-total-cost')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('proc-total-cost') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="orange">mdi-currency-krw</v-icon>
                                        프로세스 전체 비용
                                    </div>
                                    <div v-show="isOpen('proc-total-cost')" class="section-body">
                                        <div v-if="!totalCostSummary.hasData" class="text-caption text-disabled">
                                            Task에 비용 정보가 입력되지 않았습니다.
                                        </div>
                                        <template v-else>
                                            <!-- 내부 인건비 (FTE) -->
                                            <div v-if="totalCostSummary.internalItems.length" class="mb-3">
                                                <div class="d-flex align-center mb-1">
                                                    <v-icon size="12" color="primary" class="mr-1">mdi-account</v-icon>
                                                    <span class="text-caption font-weight-bold">내부 인건비 (FTE)</span>
                                                    <v-chip size="x-small" variant="tonal" color="primary" class="ml-auto">
                                                        {{ totalCostSummary.totalFte }} FTE
                                                    </v-chip>
                                                </div>
                                                <div class="task-count-grid">
                                                    <div class="task-count-row">
                                                        <span class="task-count-label font-weight-medium">연간 총 시간</span>
                                                        <span class="task-count-value font-weight-bold">{{ totalCostSummary.totalAnnualHours }}h</span>
                                                    </div>
                                                    <div class="task-count-row">
                                                        <span class="task-count-label font-weight-medium">월간 총 시간</span>
                                                        <span class="task-count-value font-weight-bold">{{ totalCostSummary.totalMonthlyHours }}h</span>
                                                    </div>
                                                    <div v-for="item in totalCostSummary.internalItems" :key="item.name" class="task-count-row">
                                                        <span class="task-count-label">{{ item.name }}</span>
                                                        <span class="task-count-value">{{ item.fte }} FTE · {{ item.annualHours }}h/yr</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- 외부 비용 (OPEX) -->
                                            <div v-if="totalCostSummary.externalItems.length">
                                                <v-divider v-if="totalCostSummary.internalItems.length" class="mb-3" />
                                                <div class="d-flex align-center mb-1">
                                                    <v-icon size="12" color="orange" class="mr-1">mdi-handshake</v-icon>
                                                    <span class="text-caption font-weight-bold">외부 비용 (OPEX)</span>
                                                    <v-chip size="x-small" variant="tonal" color="orange" class="ml-auto">
                                                        ₩{{ totalCostSummary.totalOpex.toLocaleString() }}
                                                    </v-chip>
                                                </div>
                                                <div class="task-count-grid">
                                                    <div v-for="item in totalCostSummary.externalItems" :key="item.name" class="task-count-row">
                                                        <span class="task-count-label">{{ item.name }}</span>
                                                        <span class="task-count-value">₩{{ item.cost.toLocaleString() }} / {{ item.unit }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </div>

                                <!-- Task 개수 Task Count (Read-only) -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('task-count')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('task-count') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="blue">mdi-counter</v-icon>
                                        Task 개수
                                        <v-progress-circular
                                            v-if="isTaskCountLoading"
                                            size="12"
                                            width="2"
                                            indeterminate
                                            color="primary"
                                            class="ml-auto mr-1"
                                        />
                                        <v-chip
                                            size="x-small"
                                            variant="tonal"
                                            color="primary"
                                            :class="isTaskCountLoading ? '' : 'ml-auto'"
                                        >
                                            {{ taskCountGrandTotal }}
                                        </v-chip>
                                    </div>
                                    <div v-show="isOpen('task-count')" class="section-body">
                                        <div v-if="taskCountSummary.total === 0" class="text-caption text-disabled">
                                            캔버스에 Task가 없습니다.
                                        </div>
                                        <div v-else class="task-count-grid">
                                            <div class="task-count-row">
                                                <span class="task-count-label font-weight-medium">전체</span>
                                                <span class="task-count-value font-weight-bold">
                                                    <v-progress-circular
                                                        v-if="isTaskCountLoading"
                                                        size="12"
                                                        width="2"
                                                        indeterminate
                                                        color="primary"
                                                        class="mr-1"
                                                    />
                                                    {{ taskCountGrandTotal }}
                                                </span>
                                            </div>
                                            <div v-for="item in taskCountSummary.items" :key="item.type" class="task-count-row">
                                                <span class="task-count-label">{{ item.label }}</span>
                                                <span class="task-count-value">
                                                    <span class="task-count-percent">{{ item.percent }}%</span>
                                                    <span class="task-count-number">({{ item.count }})</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div v-if="callActivityCards.length > 0" class="call-activity-cards mt-3">
                                            <div
                                                v-for="card in callActivityCards"
                                                :key="card.defId"
                                                class="call-activity-card"
                                            >
                                                <div class="call-activity-card-header">
                                                    <v-icon size="14" color="grey-darken-1" class="mr-1">mdi-arrow-top-right-bold-box-outline</v-icon>
                                                    <span class="call-activity-card-title" :title="card.name">{{ card.name }}</span>
                                                    <v-chip
                                                        v-if="card.status === 'loaded'"
                                                        size="x-small"
                                                        variant="tonal"
                                                        color="grey-darken-1"
                                                        class="ml-auto"
                                                    >
                                                        {{ card.total }}
                                                    </v-chip>
                                                    <v-progress-circular
                                                        v-else-if="card.status === 'loading'"
                                                        size="14"
                                                        width="2"
                                                        indeterminate
                                                        color="grey-darken-1"
                                                        class="ml-auto"
                                                    />
                                                    <v-icon
                                                        v-else-if="card.status === 'error'"
                                                        size="14"
                                                        color="error"
                                                        class="ml-auto"
                                                    >
                                                        mdi-alert-circle-outline
                                                    </v-icon>
                                                </div>
                                                <div class="call-activity-card-body">
                                                    <div v-if="card.status === 'loading'" class="text-caption text-disabled">
                                                        불러오는 중...
                                                    </div>
                                                    <div v-else-if="card.status === 'error'" class="text-caption text-error">
                                                        로드에 실패했습니다.
                                                    </div>
                                                    <div v-else-if="card.total === 0" class="text-caption text-disabled">
                                                        참조 프로세스에 Task가 없습니다.
                                                    </div>
                                                    <div v-else class="task-count-grid">
                                                        <div
                                                            v-for="item in card.items"
                                                            :key="item.type"
                                                            class="task-count-row"
                                                        >
                                                            <span class="task-count-label">{{ item.label }}</span>
                                                            <span class="task-count-value">
                                                                <span class="task-count-percent">{{ item.percent }}%</span>
                                                                <span class="task-count-number">({{ item.count }})</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </v-window-item>

                        <!-- ==================== Task Tab ==================== -->
                        <v-window-item value="task">
                            <div v-if="activeElement">
                                <!-- 이름  -->
                                <div class="element-name-header">
                                    {{ displayText(activeElement.businessObject?.name || activeElement.id) }}
                                </div>

                                <div class="pa-4">
                                    <!-- Relation / SequenceFlow 속성 -->
                                    <div v-if="isSequenceFlowElement" class="section-group">
                                        <div class="section-title" @click="toggle('relation-info')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('relation-info') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="blue-grey">mdi-vector-line</v-icon>
                                            선 정보
                                            <v-chip v-if="taskForm.flowType !== 'sequence'" size="x-small" variant="tonal" color="primary" class="ml-auto">
                                                {{ taskForm.flowType === 'default' ? 'Default' : 'Condition' }}
                                            </v-chip>
                                        </div>
                                        <div v-show="isOpen('relation-info')" class="section-body">
                                            <label class="field-label">이름</label>
                                            <v-text-field
                                                v-model="taskForm.name"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                class="mb-3"
                                                placeholder="선 이름 입력"
                                            />
                                            <label class="field-label">선 종류</label>
                                            <v-select
                                                v-model="taskForm.flowType"
                                                :items="sequenceFlowTypeOptions"
                                                item-title="label"
                                                item-value="value"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                class="mb-3"
                                            />
                                            <template v-if="taskForm.flowType === 'condition'">
                                                <label class="field-label">조건식 (conditionFunction)</label>
                                                <v-textarea
                                                    v-model="taskForm.conditionExpression"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    rows="2"
                                                    auto-grow
                                                    class="mb-3"
                                                    placeholder="전송망여부 == '예'"
                                                />
                                                <v-switch
                                                    v-model="taskForm.conditionLlmMode"
                                                    color="primary"
                                                    density="compact"
                                                    hide-details
                                                    class="mb-1"
                                                    label="LLM 맥락 판단으로 평가"
                                                />
                                                <div class="text-caption text-medium-emphasis mb-3">
                                                    켜면 실행 시 조건식을 그대로 매칭하지 않고, LLM이 전체 실행 데이터를
                                                    보고 조건 충족 여부를 판단합니다(판단 사유가 로그에 남음).
                                                    끄면 조건식(conditionFunction)을 결정적으로 평가합니다.
                                                </div>
                                            </template>
                                        </div>
                                    </div>

                                    <!-- Pool(Participant) 실행형 지정 — 실행 기능 허용 사용자 전용, 다중 지정 가능 -->
                                    <div v-if="isParticipantElement && isExecUser" class="section-group">
                                        <div class="section-title" @click="toggle('pool-exec')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('pool-exec') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="teal">mdi-play-circle-outline</v-icon>
                                            실행형 Pool
                                            <v-chip v-if="isExecPoolElement" size="x-small" variant="flat" color="teal" class="ml-auto">지정됨</v-chip>
                                        </div>
                                        <div v-show="isOpen('pool-exec')" class="section-body">
                                            <v-switch
                                                :model-value="isExecPoolElement"
                                                color="teal"
                                                density="compact"
                                                hide-details
                                                :disabled="isViewMode"
                                                label="이 Pool 을 실행형 Pool 로 지정"
                                                @update:model-value="toggleExecPoolForElement"
                                            />
                                            <div class="text-caption text-medium-emphasis mt-1 mb-2">
                                                실행형 변환·실행 시작은 지정된 풀의 시작 이벤트를 기준으로 합니다. 여러 풀을 지정하면
                                                각 풀의 시작 이벤트가 다중 시작 후보가 됩니다. 지정 변경 후 Exec 뷰에서 재변환·재등록해야
                                                실행에 반영됩니다.
                                            </div>
                                            <template v-if="execPoolList.length">
                                                <label class="field-label">지정된 실행형 Pool ({{ execPoolList.length }})</label>
                                                <div class="d-flex flex-wrap ga-1">
                                                    <v-chip
                                                        v-for="p in execPoolList"
                                                        :key="p.id"
                                                        size="x-small"
                                                        variant="tonal"
                                                        color="teal"
                                                        :closable="!isViewMode"
                                                        @click:close="removeExecPool(p)"
                                                    >
                                                        {{ p.name || p.id }}
                                                    </v-chip>
                                                </div>
                                            </template>
                                        </div>
                                    </div>

                                    <!-- Lane 속성 (name: 조직도검색, description) -->
                                    <div v-if="isLaneElement" class="section-group">
                                        <div class="section-title" @click="toggle('lane-assignee')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('lane-assignee') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="primary">mdi-account-group</v-icon>
                                            Lane 속성
                                        </div>
                                        <div v-show="isOpen('lane-assignee')" class="section-body">
                                            <label class="field-label">Lane 이름</label>
                                            <v-text-field
                                                v-model="taskForm.name"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                class="mb-3"
                                                placeholder="Lane 이름 입력"
                                            />
                                            <div class="field-label lane-description-label mt-4">
                                                <span class="field-label-left">설명</span>
                                                <v-btn
                                                    size="x-small"
                                                    variant="text"
                                                    color="primary"
                                                    density="compact"
                                                    :loading="laneDescriptionGenerating"
                                                    :disabled="isViewMode || laneDescriptionGenerating"
                                                    @click="triggerGenerateLaneDescription"
                                                >
                                                    <!-- prepend-icon="mdi-creation" -->
                                                    <!-- AI 설명 생성 -->
                                                </v-btn>
                                            </div>
                                            <v-textarea
                                                v-model="laneDescription"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                rows="3"
                                                auto-grow
                                                placeholder="Lane에 대한 설명을 입력하세요..."
                                                :disabled="laneDescriptionGenerating"
                                            />
                                        </div>
                                    </div>

                                    <!-- Lane 담당 지정 (원가 유형 / 담당 유형 / 담당자·조직·공급업체) -->
                                    <div v-if="isLaneElement" class="section-group">
                                        <div class="section-title" @click="toggle('lane-assignment')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('lane-assignment') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="indigo">mdi-account-multiple</v-icon>
                                            Lane 담당 지정
                                        </div>
                                        <div v-show="isOpen('lane-assignment')" class="section-body">
                                            <label class="field-label">원가 유형</label>
                                            <v-btn-toggle v-model="laneResourceType" mandatory density="compact" class="mb-3" style="width:100%">
                                                <v-btn value="internal" size="small" color="primary" style="flex:1">
                                                    <v-icon size="14" start>mdi-account</v-icon>
                                                    내부 임직원
                                                </v-btn>
                                                <v-btn value="role_group" size="small" color="purple" style="flex:1">
                                                    <v-icon size="14" start>mdi-account-tie</v-icon>
                                                    역할 그룹
                                                </v-btn>
                                                <v-btn value="external" size="small" color="orange" style="flex:1">
                                                    <v-icon size="14" start>mdi-handshake</v-icon>
                                                    외부 협력사
                                                </v-btn>
                                            </v-btn-toggle>
                                            <!-- 내부 임직원: 담당 유형 + 담당자/조직 검색 -->
                                            <template v-if="laneResourceType === 'internal' || laneResourceType === 'family'">
                                                <label class="field-label">담당 유형</label>
                                                <v-btn-toggle v-model="laneAssigneeType" mandatory density="compact" color="primary" class="mb-3" style="width:100%">
                                                    <v-btn value="user" size="small" style="flex:1">
                                                        <v-icon size="14" start>mdi-account</v-icon>
                                                        담당자
                                                    </v-btn>
                                                    <v-btn value="org" size="small" style="flex:1">
                                                        <v-icon size="14" start>mdi-account-group</v-icon>
                                                        담당 조직
                                                    </v-btn>
                                                </v-btn-toggle>
                                                <v-autocomplete
                                                    v-if="laneAssigneeType === 'user'"
                                                    v-model="laneAssignee"
                                                    v-model:search="laneUserSearchText"
                                                    :items="laneUserOptions"
                                                    item-title="label"
                                                    item-value="key"
                                                    return-object
                                                    multiple
                                                    chips
                                                    closable-chips
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    clearable
                                                    :loading="laneUserSearchLoading"
                                                    :placeholder="'이름을 입력해 주세요'"
                                                    :no-data-text="'이름을 입력해 주세요'"
                                                    :custom-filter="() => true"
                                                    @update:search="onLaneUserSearch"
                                                    @update:modelValue="onLaneUserSelected"
                                                />
                                                <v-autocomplete
                                                    v-if="laneAssigneeType === 'org'"
                                                    v-model="laneOrganization"
                                                    :items="laneGroupOptions"
                                                    item-title="name"
                                                    item-value="id"
                                                    return-object
                                                    multiple
                                                    chips
                                                    closable-chips
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    clearable
                                                    :loading="laneGroupSearchLoading"
                                                    :placeholder="'조직명을 검색하세요'"
                                                    :no-data-text="'조직명을 입력해 주세요'"
                                                    :custom-filter="() => true"
                                                    class="mb-3"
                                                    @update:search="onLaneGroupSearch"
                                                    @update:modelValue="onLaneOrgSelected"
                                                >
                                                    <template v-slot:item="{ item, props }">
                                                        <v-list-item v-bind="props">
                                                            <template v-slot:append>
                                                                <v-chip v-if="item.raw.member_count != null" size="x-small" color="grey" variant="tonal">
                                                                    {{ item.raw.member_count }}명
                                                                </v-chip>
                                                            </template>
                                                        </v-list-item>
                                                    </template>
                                                </v-autocomplete>
                                            </template>
                                            <!-- 외부 협력사: 공급업체 검색 -->
                                            <template v-if="laneResourceType === 'external'">
                                                <label class="field-label">공급업체</label>
                                                <v-autocomplete
                                                    v-model="laneSupplier"
                                                    v-model:search="laneSupplierSearchText"
                                                    :items="laneSupplierOptions"
                                                    item-title="displayName"
                                                    item-value="id"
                                                    return-object
                                                    multiple
                                                    chips
                                                    closable-chips
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    clearable
                                                    class="mb-3"
                                                    :loading="laneSupplierSearchLoading"
                                                    :placeholder="'공급업체명 또는 사업자번호 검색'"
                                                    :no-data-text="'공급업체명을 입력해 주세요'"
                                                    :custom-filter="() => true"
                                                    @update:search="onLaneSupplierSearch"
                                                    @update:modelValue="onLaneSupplierSelected"
                                                >
                                                    <template v-slot:item="{ item, props }">
                                                        <v-list-item v-bind="props">
                                                            <template v-slot:subtitle>
                                                                <span v-if="item.raw.business_number">
                                                                    {{ formatBusinessNumber(item.raw.business_number) }}
                                                                </span>
                                                                <span v-if="item.raw.registration_type" class="ml-2">
                                                                    · {{ item.raw.registration_type }}
                                                                </span>
                                                            </template>
                                                        </v-list-item>
                                                    </template>
                                                </v-autocomplete>
                                            </template>
                                            <!-- 역할 그룹: 그룹 다중 선택 + 카드 미리보기 -->
                                            <template v-if="laneResourceType === 'role_group'">
                                                <label class="field-label">역할 그룹 (복수 선택 가능)</label>
                                                <v-autocomplete
                                                    v-model="laneRoleGroupSelectedList"
                                                    :items="laneRoleGroupVisibleOptions"
                                                    item-title="label"
                                                    item-value="id"
                                                    return-object
                                                    multiple
                                                    chips
                                                    closable-chips
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    clearable
                                                    :loading="laneRoleGroupLoading"
                                                    placeholder="역할 그룹 선택"
                                                    no-data-text="등록된 역할 그룹이 없습니다"
                                                    class="mb-3"
                                                    @update:modelValue="onLaneRoleGroupsChanged"
                                                >
                                                    <template v-slot:item="{ item, props }">
                                                        <v-list-item v-bind="props" :title="item.raw.label">
                                                            <template v-slot:append>
                                                                <v-chip
                                                                    v-if="(laneRoleGroupRoutingMap.get(item.raw.id) || []).length"
                                                                    size="x-small"
                                                                    color="primary"
                                                                    variant="tonal"
                                                                >
                                                                    DMN {{ laneRoleGroupRoutingMap.get(item.raw.id).length }}건
                                                                </v-chip>
                                                            </template>
                                                        </v-list-item>
                                                    </template>
                                                </v-autocomplete>
                                                <template v-for="(g, idx) in selectedRoleGroupDetails" :key="g.id">
                                                    <div class="role-group-item">
                                                        <div class="role-group-card-head">
                                                            <v-icon size="14">mdi-account-tie</v-icon>
                                                            <span v-if="g.parentName" class="role-group-card-parent">
                                                                [{{ g.parentName }}]
                                                            </span>
                                                            <span class="role-group-card-name">{{ g.label }}</span>
                                                            <v-chip size="x-small" variant="tonal" class="ml-2">
                                                                {{ g.members.length }}팀
                                                            </v-chip>
                                                            <v-chip
                                                                v-if="g.routing.length"
                                                                size="x-small"
                                                                variant="tonal"
                                                                color="primary"
                                                                class="ml-1"
                                                            >
                                                                DMN {{ g.routing.length }}건
                                                            </v-chip>
                                                            <v-spacer />
                                                            <v-btn
                                                                icon
                                                                size="x-small"
                                                                variant="text"
                                                                @click="removeLaneRoleGroup(g.id)"
                                                            >
                                                                <v-icon size="14">mdi-close</v-icon>
                                                            </v-btn>
                                                        </div>
                                                        <div v-if="g.members.length === 0" class="text-caption text-medium-emphasis mt-2">
                                                            연결된 팀이 없습니다.
                                                        </div>
                                                        <div v-else class="role-group-card-chips mt-2">
                                                            <v-chip
                                                                v-for="m in g.members"
                                                                :key="m.org_id"
                                                                size="x-small"
                                                                variant="tonal"
                                                                color="grey"
                                                                class="mr-1 mb-1"
                                                            >
                                                                <span :class="m.member_type === 'supplier' ? 'text-orange' : 'text-primary'" class="rg-type-text mr-1">{{ m.member_type === 'supplier' ? '외부' : '내부' }}</span>
                                                                {{ m.org_name || m.org_id }}
                                                            </v-chip>
                                                        </div>
                                                        <!-- DMN 라우팅 조건 (조회 전용 — 편집은 admin > 내부조직역할 관리) -->
                                                        <div v-if="g.routing.length" class="role-group-dmn mt-2">
                                                            <div class="role-group-dmn-head">
                                                                <v-icon size="12" class="mr-1">mdi-source-branch</v-icon>
                                                                DMN 라우팅 조건
                                                                <span class="role-group-dmn-hint">편집: 내부조직역할 관리</span>
                                                            </div>
                                                            <div
                                                                v-for="(c, ci) in g.routing"
                                                                :key="`${c.ruleId}-${c.slot}-${ci}`"
                                                                class="role-group-dmn-row"
                                                            >
                                                                <span class="role-group-dmn-cond">{{ formatLaneRoutingInputs(c) }}</span>
                                                                <v-icon size="12" class="mx-1">mdi-arrow-right-thin</v-icon>
                                                                <span class="role-group-dmn-out">{{ c.slotLabel }} · {{ c.outputOrgName }}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <v-divider v-if="idx < selectedRoleGroupDetails.length - 1" class="my-2" />
                                                </template>
                                            </template>
                                        </div>
                                    </div>

                                    <!-- CallActivity / StartEvent / EndEvent: 프로세스 정의 선택 -->
                                    <div v-if="isProcessLinkableElement" class="section-group">
                                        <div class="section-title" @click="toggle('call-activity-def')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('call-activity-def') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="deep-purple">mdi-file-tree</v-icon>
                                            {{ $t('CallActivityPanel.selectDefinition') || '프로세스 정의 선택' }}
                                        </div>
                                        <div v-show="isOpen('call-activity-def')" class="section-body">
                                            <v-autocomplete
                                                v-model="callActivityDefinitionId"
                                                :items="callActivityDisplayItems"
                                                item-title="name"
                                                item-value="path"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                clearable
                                                :loading="callActivitySearchLoading"
                                                :placeholder="$t('CallActivityPanel.selectDefinition') || '프로세스 검색...'"
                                                :disabled="isViewMode"
                                                :no-data-text="'이름을 입력하세요'"
                                                :custom-filter="() => true"
                                                class="mb-3"
                                                @update:search="onCallActivitySearch"
                                                @update:modelValue="onCallActivityDefinitionSelected"
                                            >
                                                <template v-slot:selection="{ item }">
                                                    <span>{{ displayText(item.raw.name) }}</span>
                                                </template>
                                                <template v-slot:item="{ props, item }">
                                                    <v-list-item v-bind="props" :subtitle="displayText(item.raw.id)" :title="displayText(item.raw.name)" />
                                                </template>
                                            </v-autocomplete>
                                            <v-chip
                                                v-if="callActivityDefinitionId && callActivityDefinitionDeleted"
                                                size="small"
                                                color="error"
                                                variant="tonal"
                                                class="mb-3"
                                            >
                                                <v-icon start size="14">mdi-alert-circle-outline</v-icon>
                                                삭제된 프로세스 입니다.
                                            </v-chip>

                                            <!-- 이 프로세스를 참조하고 있는 parent process 목록 -->
                                            <div v-if="callActivityParentRefs.length > 0" class="mt-3">
                                                <div class="text-caption text-medium-emphasis mb-2">
                                                    참조된 곳 ({{ callActivityParentRefs.length }})
                                                </div>
                                                <div class="sk-mapping-list sk-mapping-list--no-divider">
                                                    <div v-for="ref in callActivityParentRefs" :key="ref.id" class="sk-mapping-list__row">
                                                        <div class="sk-mapping-list__head">
                                                            <span class="sk-mapping-list__label">process</span>
                                                            <span
                                                                class="sk-mapping-list__name sk-mapping-list__name--link"
                                                                @click.stop="openParentRefInNewWindow(ref)"
                                                            >{{ ref.name }}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- BusinessRuleTask: DMN 룰 설정 -->
                                    <div v-if="isBusinessRuleElement" class="section-group">
                                        <div class="section-title" @click="toggle('business-rule-dmn')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('business-rule-dmn') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="purple">mdi-table-cog</v-icon>
                                            DMN 룰 설정
                                        </div>
                                        <div v-show="isOpen('business-rule-dmn')" class="section-body">
                                            <v-autocomplete
                                                v-model="businessRuleId"
                                                :items="businessRuleItems"
                                                item-title="name"
                                                item-value="id"
                                                density="compact" variant="outlined" hide-details clearable
                                                :loading="businessRuleListLoading"
                                                placeholder="DMN 룰 선택..."
                                                :disabled="isViewMode"
                                                class="mb-2"
                                                @update:modelValue="onBusinessRuleSelected"
                                            >
                                                <template v-slot:item="{ props, item }">
                                                    <v-list-item v-bind="props" :subtitle="displayText(item.raw.id)" :title="displayText(item.raw.name)" />
                                                </template>
                                            </v-autocomplete>
                                            <div v-if="!businessRuleId" class="text-caption text-medium-emphasis mb-2">
                                                룰을 선택하면 실행 시 폴링 엔진이 이 DMN 룰로 분기값을 자동 결정합니다.
                                                미설정 시 담당자가 직접 폼으로 처리합니다.
                                            </div>
                                            <div v-if="businessRulePreviewLoading" class="text-caption text-medium-emphasis mb-2">
                                                룰 불러오는 중...
                                            </div>
                                            <div v-else-if="businessRulePreview" class="mb-2">
                                                <div class="text-caption font-weight-bold mb-1">{{ businessRulePreview.name }}</div>
                                                <div v-if="businessRulePreview.description" class="text-caption text-medium-emphasis mb-1">
                                                    {{ businessRulePreview.description }}
                                                </div>
                                                <div class="text-caption text-medium-emphasis mb-1">
                                                    입력: {{ businessRulePreview.inputs.join(', ') || '-' }}
                                                    <v-icon size="12" class="mx-1">mdi-arrow-right-thin</v-icon>
                                                    출력: {{ businessRulePreview.outputs.join(', ') || '-' }}
                                                </div>
                                                <div v-for="(row, ri) in businessRulePreview.rows" :key="`br_row_${ri}`" class="role-group-dmn-row">
                                                    <span class="role-group-dmn-cond">{{ row.when }}</span>
                                                    <v-icon size="12" class="mx-1">mdi-arrow-right-thin</v-icon>
                                                    <span class="role-group-dmn-out">{{ row.then }}</span>
                                                </div>
                                            </div>
                                            <div v-if="businessRuleId" class="text-caption text-medium-emphasis">
                                                실행 시 저장된 DMN 키(<code>{{ businessRuleId }}</code>)로 서버에서 평가됩니다.
                                            </div>
                                        </div>
                                    </div>

                                    <!-- SendTask: 메일 발송 설정 (실행 도달 시 즉시 발송 후 자동 완료) -->
                                    <div v-if="isSendTaskElement" class="section-group">
                                        <div class="section-title" @click="toggle('send-task-mail')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('send-task-mail') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="blue">mdi-email-outline</v-icon>
                                            메일 발송 설정
                                        </div>
                                        <div v-show="isOpen('send-task-mail')" class="section-body">
                                            <label class="field-label">수신자</label>
                                            <v-combobox
                                                v-model="sendTaskRecipients"
                                                :items="sendTaskUserItems"
                                                item-title="label"
                                                item-value="email"
                                                :return-object="false"
                                                :loading="sendTaskUserLoading"
                                                density="compact" variant="outlined" hide-details
                                                multiple chips closable-chips clearable
                                                placeholder="이메일 직접 입력 또는 사용자 선택"
                                                :disabled="isViewMode"
                                                class="mb-2"
                                                @update:modelValue="taskFormDirty = true"
                                            ></v-combobox>
                                            <label class="field-label">메일 제목</label>
                                            <v-text-field
                                                v-model="sendTaskMailTitle"
                                                density="compact" variant="outlined" hide-details
                                                placeholder="미입력 시 태스크 이름으로 발송"
                                                :disabled="isViewMode"
                                                class="mb-2"
                                                @update:modelValue="taskFormDirty = true"
                                            ></v-text-field>
                                            <label class="field-label">메일 내용</label>
                                            <v-textarea
                                                v-model="sendTaskMailContents"
                                                density="compact" variant="outlined" hide-details rows="3" auto-grow
                                                :disabled="isViewMode"
                                                class="mb-2"
                                                @update:modelValue="taskFormDirty = true"
                                            ></v-textarea>
                                            <v-alert v-if="!sendTaskRecipients.length" type="warning" density="compact" variant="tonal" class="mb-2 text-caption">
                                                수신자 미지정 시 실행에서 메일 발송 없이 태스크만 완료됩니다.
                                            </v-alert>
                                            <div class="text-caption text-medium-emphasis">
                                                실행 시 프로세스가 이 태스크에 도달하면 지정된 수신자에게 즉시 메일이 발송되고 태스크는 자동 완료됩니다.
                                            </div>
                                        </div>
                                    </div>

                                    <!-- BPMN 데이터 입출력 (DataObject/DataStore 연결) -->
                                    <div v-if="taskDataInputs.length || taskDataOutputs.length" class="section-group">
                                        <div class="section-title" @click="toggle('task-data-io')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-data-io') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="teal">mdi-database-import-outline</v-icon>
                                            입출력 데이터
                                        </div>
                                        <div v-show="isOpen('task-data-io')" class="section-body">
                                            <template v-if="taskDataInputs.length">
                                                <label class="field-label">입력 데이터</label>
                                                <div v-for="(d, di) in taskDataInputs" :key="`din_${di}`" class="d-flex align-center mb-1">
                                                    <v-icon size="14" class="mr-1" :color="d.kind === 'store' ? 'indigo' : 'blue-grey'">
                                                        {{ d.kind === 'store' ? 'mdi-database-outline' : 'mdi-file-document-outline' }}
                                                    </v-icon>
                                                    <span class="text-caption">{{ d.name }}</span>
                                                    <v-chip label size="x-small" density="compact" class="ml-1" style="font-size: 9px !important;">
                                                        {{ d.kind === 'store' ? '저장소' : '문서' }}
                                                    </v-chip>
                                                </div>
                                            </template>
                                            <template v-if="taskDataOutputs.length">
                                                <label class="field-label" :class="{ 'mt-2': taskDataInputs.length }">출력 데이터</label>
                                                <div v-for="(d, dj) in taskDataOutputs" :key="`dout_${dj}`" class="d-flex align-center mb-1">
                                                    <v-icon size="14" class="mr-1" :color="d.kind === 'store' ? 'indigo' : 'teal'">
                                                        {{ d.kind === 'store' ? 'mdi-database-export-outline' : 'mdi-file-export-outline' }}
                                                    </v-icon>
                                                    <span class="text-caption">{{ d.name }}</span>
                                                    <v-chip label size="x-small" density="compact" class="ml-1" style="font-size: 9px !important;">
                                                        {{ d.kind === 'store' ? '저장소' : '문서' }}
                                                    </v-chip>
                                                </div>
                                            </template>
                                            <div class="text-caption text-medium-emphasis mt-1">
                                                실행 폼에는 입력 안내와 산출물 기록 필드로 반영됩니다.
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Basic -->
                                    <div v-if="isTaskPropertyElement" class="section-group">
                                        <div class="section-title" @click="toggle('task-basic')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-basic') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="blue-grey">mdi-information-outline</v-icon>
                                            일반
                                        </div>
                                        <div v-show="isOpen('task-basic')" class="section-body">
                                            <label class="field-label">요소 ID</label>
                                            <div class="element-id-row mb-3">
                                                <code class="element-id-value" :title="elementDisplayId">{{ elementDisplayId }}</code>
                                                <v-btn icon variant="text" size="x-small" @click="copyElementId">
                                                    <v-icon size="13">mdi-content-copy</v-icon>
                                                </v-btn>
                                            </div>
                                            <label class="field-label">이름</label>
                                            <v-text-field
                                                v-model="taskForm.name"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                            />
                                            <!-- Schema fields for Task -->
                                            <template v-for="field in taskFields" :key="field.id">
                                                <div class="field-label">
                                                    <span class="field-label-left">
                                                        {{ field.property_label || field.property_key }}
                                                        <v-chip label rounded="0" size="x-small" density="compact" color="grey" class="ml-1" style="font-size: 7px;">{{ getPropertyTypeLabel(field.property_type) }}</v-chip>
                                                        <v-chip v-if="field.is_deprecated_field" label rounded="0" size="x-small" density="compact" color="warning" class="ml-1" style="font-size: 7px;">사용 중단</v-chip>
                                                        <v-chip v-else-if="field.is_readonly" label rounded="0" size="x-small" density="compact" color="primary" class="ml-1" style="font-size: 7px;">읽기 전용</v-chip>
                                                        <v-chip v-if="field.is_required && !field.is_deprecated_field" label rounded="0" size="x-small" density="compact" color="red" class="ml-1" style="font-size: 7px;">필수</v-chip>
                                                    </span>
                                                    <DetailComponent
                                                        v-if="field.description"
                                                        :title="displayText(field.property_label || field.property_key)"
                                                        :details="[{ title: field.description }]"
                                                        :icon-size="14"
                                                    />
                                                </div>
                                                <v-text-field
                                                    v-if="field.property_type === 'string'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :placeholder="field.placeholder"
                                                    :disabled="field.is_readonly"
                                                />
                                                <v-textarea
                                                    v-else-if="field.property_type === 'textarea'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3"
                                                    :placeholder="field.placeholder"
                                                    :disabled="field.is_readonly"
                                                />
                                                <v-text-field
                                                    v-else-if="field.property_type === 'number'"
                                                    :model-value="numberFieldDisplay(taskForm.schemaProps[field.property_key], field)"
                                                    @focus="onNumberFocus($event)"
                                                    @blur="onNumberBlur($event, field, (v) => taskForm.schemaProps[field.property_key] = v)"
                                                    density="compact" variant="outlined" hide-details="auto" class="mb-3"
                                                    :placeholder="field.placeholder"
                                                    :suffix="field.number_unit || undefined"
                                                    :rules="numberRules(field)"
                                                    :disabled="field.is_readonly"
                                                />
                                                <v-text-field
                                                    v-else-if="field.property_type === 'url'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :placeholder="field.placeholder || 'https://...'"
                                                    :disabled="field.is_readonly"
                                                >
                                                    <template v-slot:prepend-inner>
                                                        <v-icon size="14" color="grey">mdi-link-variant</v-icon>
                                                    </template>
                                                </v-text-field>
                                                    <v-select
                                                        v-else-if="field.property_type === 'db-select'"
                                                        v-model="taskForm.schemaProps[field.property_key]"
                                                        :items="getSelectFieldItems(field)"
                                                        item-title="label" item-value="value"
                                                        density="compact" variant="outlined" hide-details class="mb-3"
                                                        :placeholder="field.placeholder"
                                                        :clearable="!field.is_readonly"
                                                        :disabled="field.is_readonly"
                                                />
                                                <v-select
                                                    v-else-if="field.property_type === 'select'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    :items="getSelectFieldItems(field)"
                                                    item-title="label" item-value="value"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :clearable="!field.is_readonly"
                                                    :disabled="field.is_readonly"
                                                />
                                                <v-select
                                                    v-else-if="field.property_type === 'multiselect'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    :items="getSelectFieldItems(field)"
                                                    item-title="label" item-value="value"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :clearable="!field.is_readonly"
                                                    multiple chips
                                                    :closable-chips="!field.is_readonly"
                                                    :disabled="field.is_readonly"
                                                />
                                                <v-text-field
                                                    v-else-if="field.property_type === 'date'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details type="date" class="mb-3"
                                                    :placeholder="field.placeholder"
                                                    :disabled="field.is_readonly"
                                                />
                                                <div v-else-if="field.property_type === 'daterange'" class="daterange-row mb-3">
                                                    <v-text-field
                                                        v-model="taskForm.schemaProps[field.property_key + '_start']"
                                                        density="compact" variant="outlined" hide-details type="date"
                                                        :placeholder="field.placeholder || 'Start'"
                                                        :disabled="field.is_readonly"
                                                    />
                                                    <span class="daterange-separator">~</span>
                                                    <v-text-field
                                                        v-model="taskForm.schemaProps[field.property_key + '_end']"
                                                        density="compact" variant="outlined" hide-details type="date"
                                                        :placeholder="'End'"
                                                        :disabled="field.is_readonly"
                                                    />
                                                </div>
                                                <v-autocomplete
                                                    v-else-if="field.property_type === 'user'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    :items="userSearchResults[field.property_key] || []"
                                                    item-title="name" item-value="id"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :placeholder="field.placeholder || 'Search user... (Enter)'"
                                                    :clearable="!field.is_readonly"
                                                    :loading="userSearchLoading[field.property_key]"
                                                    :disabled="field.is_readonly"
                                                    @keydown.enter="field.is_readonly ? null : onUserSearch(field.property_key, $event.target.value)"
                                                >
                                                    <template v-slot:prepend-inner>
                                                        <v-icon size="14" color="grey">mdi-account-search-outline</v-icon>
                                                    </template>
                                                </v-autocomplete>
                                                <v-switch
                                                    v-else-if="field.property_type === 'boolean'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" color="primary" hide-details class="mb-3"
                                                    :disabled="field.is_readonly"
                                                />
                                            </template>
                                            <!-- Fallback if no schema -->
                                            <template v-if="taskFields.length === 0">
                                                <label class="field-label">설명</label>
                                                <v-textarea v-model="taskForm.description" density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3" placeholder="태스크 설명 입력..." />
                                            </template>
                                        </div>
                                    </div>

                                    <!-- UserTask 계열: 폼 연결 (재사용 폼 라이브러리에서 선택) -->
                                    <div v-if="isFormLinkableElement" class="section-group">
                                        <div class="section-title" @click="toggle('task-form-link')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-form-link') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="primary">mdi-form-select</v-icon>
                                            폼 연결
                                        </div>
                                        <div v-show="isOpen('task-form-link')" class="section-body">
                                            <v-autocomplete
                                                v-model="taskFormLinkId"
                                                :items="formDefItems"
                                                item-title="name"
                                                item-value="id"
                                                density="compact" variant="outlined" hide-details clearable
                                                :loading="formDefListLoading"
                                                placeholder="폼 선택..."
                                                :disabled="isViewMode"
                                                class="mb-2"
                                            >
                                                <template v-slot:item="{ props, item }">
                                                    <v-list-item v-bind="props" :subtitle="displayText(item.raw.id)" :title="displayText(item.raw.name)" />
                                                </template>
                                            </v-autocomplete>
                                            <div v-if="!taskFormLinkId" class="text-caption text-medium-emphasis mb-2">
                                                미선택 시 기본 규칙 폼 ID(<code>{{ defaultFormIdForElement }}</code>)를 사용합니다.
                                            </div>
                                            <div v-else class="text-caption text-medium-emphasis mb-2">
                                                실행 시 워크아이템이 이 폼(<code>{{ taskFormLinkId }}</code>)을 렌더링합니다.
                                            </div>
                                            <v-btn size="x-small" variant="tonal" color="primary" :disabled="isViewMode && !taskFormLinkId" @click="openFormDesigner">
                                                <v-icon start size="14">mdi-open-in-new</v-icon>폼 디자이너에서 편집
                                            </v-btn>
                                        </div>
                                    </div>

                                    <!-- Task 관련자료 링크 -->
                                    <div v-if="!isSequenceFlowElement" class="section-group">
                                        <div class="section-title" @click="toggle('task-manual-link')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-manual-link') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="indigo">mdi-link-variant</v-icon>
                                            관련자료 링크
                                        </div>
                                        <div v-show="isOpen('task-manual-link')" class="section-body">
                                            <ManualLinkField v-model="taskForm.manualLinks" :disabled="isViewMode" />
                                        </div>
                                    </div>

                                    <!-- API 연동 -->
                                    <div v-if="!isLaneElement" class="section-group">
                                        <div class="section-title" @click="toggle('task-api')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-api') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="teal">mdi-api</v-icon>
                                            API 연동
                                        </div>
                                        <div v-show="isOpen('task-api')" class="section-body">
                                            <div v-if="!(taskForm.apiIntegrations || []).length" class="text-caption text-medium-emphasis mb-2">
                                                등록된 API 연동이 없습니다.
                                            </div>
                                            <div v-for="(api, aIdx) in taskForm.apiIntegrations" :key="aIdx" class="api-entry">
                                                <div class="api-entry__head">
                                                    <span class="api-entry__title">API {{ aIdx + 1 }}<template v-if="api.name"> — {{ api.name }}</template></span>
                                                    <v-icon
                                                        v-if="!isViewMode"
                                                        size="15" color="error" class="ml-auto api-entry__remove"
                                                        @click.stop="askRemoveApiIntegration(aIdx)"
                                                    >mdi-trash-can-outline</v-icon>
                                                </div>
                                                <label class="field-label">이름</label>
                                                <v-text-field
                                                    v-model="api.name"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    placeholder="이 API의 용도 또는 코드 (예: TMF641, 로그 수집)"
                                                    :disabled="isViewMode"
                                                />
                                                <label class="field-label">메서드</label>
                                                <v-select
                                                    v-model="api.method"
                                                    :items="['GET', 'POST', 'PUT', 'DELETE']"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    placeholder="메서드를 먼저 선택하세요"
                                                    clearable
                                                    :disabled="isViewMode || (api.params || []).length > 0"
                                                />
                                                <label class="field-label">URL</label>
                                                <v-text-field
                                                    v-model="api.url"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    placeholder="https://..."
                                                    :disabled="isViewMode || !api.method || (api.params || []).length > 0"
                                                >
                                                    <template v-slot:prepend-inner><v-icon size="14" color="grey">mdi-link-variant</v-icon></template>
                                                </v-text-field>
                                                <div v-if="(api.params || []).length > 0" class="d-flex align-center text-caption text-medium-emphasis mb-3">
                                                    <v-icon size="13" class="mr-1">mdi-lock-outline</v-icon>
                                                    파라미터 삭제 후 변경 가능
                                                </div>
                                                <label class="field-label">파라미터</label>
                                                <div v-if="!isViewMode && apiParamDrafts[aIdx]" class="d-flex align-center gap-2 mb-2">
                                                    <v-text-field
                                                        v-model="apiParamDrafts[aIdx].key"
                                                        placeholder="key"
                                                        density="compact" variant="outlined" hide-details
                                                        :disabled="!api.method || !api.url"
                                                        @keyup.enter="addApiParam(aIdx)"
                                                    />
                                                    <span class="api-param-colon">:</span>
                                                    <v-text-field
                                                        v-model="apiParamDrafts[aIdx].value"
                                                        placeholder="value"
                                                        density="compact" variant="outlined" hide-details
                                                        :disabled="!api.method || !api.url"
                                                        @keyup.enter="addApiParam(aIdx)"
                                                    />
                                                    <v-btn
                                                        size="small" color="primary" variant="tonal"
                                                        :disabled="!api.method || !api.url || !(apiParamDrafts[aIdx] && apiParamDrafts[aIdx].key.trim())"
                                                        @click="addApiParam(aIdx)"
                                                    >추가</v-btn>
                                                </div>
                                                <div v-if="(api.params || []).length > 0">
                                                    <div
                                                        v-for="(p, idx) in api.params"
                                                        :key="idx"
                                                        class="api-param-row"
                                                    >
                                                        <template v-if="isEditingApiParam(aIdx, idx)">
                                                            <v-text-field
                                                                v-model="api.params[idx].key"
                                                                placeholder="key"
                                                                density="compact" variant="outlined" hide-details
                                                                class="api-param-row__input"
                                                                @keyup.enter="editingApiParam = null"
                                                            />
                                                            <span class="api-param-colon">:</span>
                                                            <v-text-field
                                                                v-model="api.params[idx].value"
                                                                placeholder="value"
                                                                density="compact" variant="outlined" hide-details
                                                                class="api-param-row__input"
                                                                @keyup.enter="editingApiParam = null"
                                                            />
                                                            <v-icon
                                                                size="16" color="primary" class="api-param-row__del"
                                                                @click.stop="editingApiParam = null"
                                                            >mdi-check</v-icon>
                                                        </template>
                                                        <template v-else>
                                                            <span class="api-param-row__text">{{ p.key }} : {{ p.value }}</span>
                                                            <v-icon
                                                                v-if="!isViewMode"
                                                                size="14" class="api-param-row__del"
                                                                @click.stop="editingApiParam = { entry: aIdx, param: idx }"
                                                            >mdi-pencil-outline</v-icon>
                                                            <v-icon
                                                                v-if="!isViewMode"
                                                                size="14" color="error" class="api-param-row__del"
                                                                @click.stop="askRemoveApiParam(aIdx, idx)"
                                                            >mdi-trash-can-outline</v-icon>
                                                        </template>
                                                    </div>
                                                </div>
                                                <div v-else class="text-caption text-medium-emphasis">등록된 파라미터가 없습니다.</div>
                                            </div>
                                            <v-btn
                                                v-if="!isViewMode"
                                                size="small" variant="tonal" color="teal" block class="mt-1"
                                                prepend-icon="mdi-plus"
                                                @click="addApiIntegration"
                                            >API 추가</v-btn>
                                        </div>
                                    </div>

                                    <!-- Data Object / Data Store 전용: URL + 파일 첨부 -->
                                    <div v-if="isDataReferenceElement" class="section-group">
                                        <div class="section-title" @click="toggle('task-data-attachment')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-data-attachment') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="indigo">mdi-paperclip</v-icon>
                                            첨부 자료
                                            <span class="ml-auto" @click.stop>
                                                <DetailComponent
                                                    title="첨부 자료"
                                                    :details="[
                                                        { title: '이 노드가 참조하는 자료(URL · 파일)를 등록하는 영역이며, 추후 자동화 기능의 참조 데이터로 활용됩니다.' }
                                                    ]"
                                                    :icon-size="14"
                                                />
                                            </span>
                                        </div>
                                        <div v-show="isOpen('task-data-attachment')" class="section-body">
                                            <label class="field-label">URL</label>
                                            <v-text-field v-model="taskForm.dataAttachmentUrl" density="compact" variant="outlined" hide-details placeholder="https://..." class="mb-3">
                                                <template v-slot:prepend-inner><v-icon size="14" color="grey">mdi-link-variant</v-icon></template>
                                            </v-text-field>
                                            <label class="field-label">파일 첨부</label>
                                            <input ref="dataAttachmentFileInput" type="file" style="display: none" @change="onDataAttachmentFileChange" />
                                            <div v-if="taskForm.dataAttachmentFile && taskForm.dataAttachmentFile.path" class="data-attachment-file-row mb-3">
                                                <v-icon size="14" color="grey" class="mr-2">mdi-file-document-outline</v-icon>
                                                <span class="data-attachment-file-name" @click="openDataAttachmentFile">
                                                    {{ taskForm.dataAttachmentFile.fileName || taskForm.dataAttachmentFile.path }}
                                                </span>
                                                <v-spacer />
                                                <v-btn icon="mdi-close" size="x-small" variant="text" density="compact" :disabled="isViewMode" @click="removeDataAttachmentFile" />
                                            </div>
                                            <v-btn v-else size="small" variant="outlined" :disabled="isViewMode || dataAttachmentUploading" :loading="dataAttachmentUploading" class="mb-3" @click="triggerDataAttachmentFilePicker">
                                                <v-icon size="14" start>mdi-paperclip</v-icon>
                                                파일 선택
                                            </v-btn>
                                        </div>
                                    </div>

                                    <!-- 원가 스키마: Lane 기반 분기 -->
                                    <!-- 내부 Lane → FTE Calculator -->
                                    <div>
                                        <div v-if="isTaskPropertyElement && !isExternalLaneTask" class="section-group">
                                            <div class="section-title" @click="toggle('task-fte')">
                                                <v-icon size="14" class="mr-1">{{ isOpen('task-fte') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                                <v-icon size="14" class="mr-1" color="teal">mdi-clock-outline</v-icon>
                                                FTE 계산기
                                                <v-chip v-if="taskFteValue" size="x-small" variant="tonal" color="primary" class="ml-auto">
                                                    FTE {{ taskFteValue }}
                                                </v-chip>
                                            </div>
                                            <div v-show="isOpen('task-fte')" class="section-body">
                                                <label class="field-label">입력 방식</label>
                                                <v-btn-toggle v-model="taskForm.fte.inputMode" mandatory density="compact" class="mb-3 fte-mode-toggle" color="primary">
                                                    <v-btn value="direct" size="small">직접 입력 %</v-btn>
                                                    <v-btn value="time" size="small">시간-빈도-인원</v-btn>
                                                </v-btn-toggle>
                                                <template v-if="taskForm.fte.inputMode === 'direct'">
                                                    <label class="field-label">FTE (%)</label>
                                                    <v-text-field v-model.number="taskForm.fte.directPercent" density="compact" variant="outlined" hide-details type="number" min="0" max="100" suffix="%" />
                                                </template>
                                                <template v-else>
                                                    <v-row dense>
                                                        <v-col cols="6">
                                                            <label class="field-label">빈도 주기</label>
                                                            <v-select v-model="taskForm.fte.freqCycle" :items="freqCycleOptions" density="compact" variant="outlined" hide-details />
                                                        </v-col>
                                                        <v-col cols="6">
                                                            <label class="field-label">빈도 횟수</label>
                                                            <v-text-field v-model.number="taskForm.fte.freqCount" density="compact" variant="outlined" hide-details type="number" min="0" />
                                                        </v-col>
                                                    </v-row>
                                                    <label class="field-label mt-3">건당 소요시간 (시간)</label>
                                                    <v-text-field v-model.number="taskForm.fte.timePerTask" density="compact" variant="outlined" hide-details type="number" min="0" step="0.1" />
                                                    <label class="field-label mt-3">투입 인원</label>
                                                    <v-text-field v-model.number="taskForm.fte.headcount" density="compact" variant="outlined" hide-details type="number" min="1" />
                                                </template>
                                                <div v-if="taskFteValue" class="fte-result-card mt-3">
                                                    <div class="d-flex align-center justify-space-between">
                                                        <span class="fte-result-label">산출 FTE</span>
                                                        <v-btn variant="text" size="x-small" color="primary" class="text-none">
                                                            <v-icon size="12" start>mdi-sync</v-icon>
                                                            전체 FTE 동기화
                                                        </v-btn>
                                                    </div>
                                                    <div class="fte-result-value">{{ taskFteValue }} FTE</div>
                                                    <div v-if="taskForm.fte.inputMode === 'time'" class="fte-formula">
                                                        = {{ taskForm.fte.timePerTask || 0 }}h
                                                        &times; {{ taskForm.fte.freqCount || 0 }}/{{ freqCycleLabel }}
                                                        &times; {{ taskForm.fte.headcount || 1 }}p
                                                        &divide; {{ annualWorkingHours }}h
                                                        = {{ taskFteValue }} FTE
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 외부 Lane → OPEX 입력 -->
                                        <div v-if="isTaskPropertyElement && isExternalLaneTask" class="section-group">
                                            <div class="section-title" @click="toggle('task-opex')">
                                                <v-icon size="14" class="mr-1">{{ isOpen('task-opex') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                                <v-icon size="14" class="mr-1" color="orange">mdi-currency-krw</v-icon>
                                                OPEX (외부 비용)
                                                <v-chip v-if="taskForm.opexCost" size="x-small" variant="tonal" color="orange" class="ml-auto">
                                                    {{ Number(taskForm.opexCost).toLocaleString() }}원
                                                </v-chip>
                                            </div>
                                            <div v-show="isOpen('task-opex')" class="section-body">
                                                <v-chip size="small" variant="flat" color="orange-lighten-4" class="mb-3">
                                                    <v-icon size="14" start>mdi-information-outline</v-icon>
                                                    외부 협력사 Lane — 도급비/건당 단가 입력
                                                </v-chip>
                                                <label class="field-label">단가 기준</label>
                                                <v-btn-toggle v-model="taskForm.opexUnit" mandatory density="compact" class="mb-3" color="orange" style="width:100%">
                                                    <v-btn value="건당" size="small" style="flex:1">건당 단가</v-btn>
                                                    <v-btn value="월정액" size="small" style="flex:1">월정액</v-btn>
                                                    <v-btn value="도급" size="small" style="flex:1">도급비</v-btn>
                                                </v-btn-toggle>
                                                <label class="field-label">금액 (원)</label>
                                                <v-text-field
                                                    v-model.number="taskForm.opexCost"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    type="number"
                                                    min="0"
                                                    prefix="₩"
                                                    :placeholder="taskForm.opexUnit === '건당' ? '건당 단가 입력' : taskForm.opexUnit === '월정액' ? '월 고정 금액 입력' : '도급 총액 입력'"
                                                />
                                                <label class="field-label mt-3">비고</label>
                                                <v-textarea
                                                    v-model="taskForm.opexNote"
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    rows="2"
                                                    placeholder="비용 산정 근거 등"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <!-- System Mapping (Task) -->
                                    <div v-if="isTaskPropertyElement" class="section-group">
                                        <div class="section-title" @click="toggle('task-system')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-system') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="blue">mdi-server-network</v-icon>
                                            시스템 매핑
                                        </div>
                                        <div v-show="isOpen('task-system')" class="section-body">
                                            <v-autocomplete
                                                v-model="taskSystemSingle"
                                                :items="atdtSystemItems"
                                                :loading="atdtSystemListLoading"
                                                item-title="name"
                                                :item-value="systemItemValue"
                                                return-object
                                                label="연관 시스템"
                                                placeholder="시스템명을 검색..."
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                clearable
                                                chips
                                                :menu-props="{ maxHeight: 320 }"
                                                @update:menu="onAtdtSystemsMenu"
                                            >
                                                <template v-slot:chip="{ props: chipProps, item }">
                                                    <v-chip
                                                        v-bind="chipProps"
                                                        size="small"
                                                        variant="tonal"
                                                        color="blue"
                                                    >
                                                        <a
                                                            v-if="item.raw && item.raw.id"
                                                            :href="buildAtdtSystemDetailUrl(item.raw.id)"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            class="atdt-task-chip-link"
                                                            @click.stop
                                                        >{{ item.raw.name }}</a>
                                                        <span v-else>{{ item.raw ? item.raw.name : '' }}</span>
                                                    </v-chip>
                                                </template>
                                                <template v-slot:no-data>
                                                    <v-list-item>
                                                        <v-list-item-title class="text-caption">
                                                            {{ atdtSystemListLoading ? '시스템 목록을 불러오는 중...' : (atdtSystemListLoaded ? '검색 결과가 없습니다.' : '시스템 목록을 불러오지 못했습니다.') }}
                                                        </v-list-item-title>
                                                    </v-list-item>
                                                </template>
                                            </v-autocomplete>
                                        </div>
                                    </div>

                                    <!-- 연관 과제 매핑 (Task) -->
                                    <div v-if="isTaskPropertyElement" class="section-group" ref="taskMappingSection">
                                        <div class="section-title" @click="toggle('task-related-projects')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-related-projects') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="purple">mdi-clipboard-list-outline</v-icon>
                                            연관 과제 매핑
                                            <v-chip v-if="taskForm.relatedProjects && taskForm.relatedProjects.length" size="x-small" variant="tonal" color="purple" class="ml-auto">
                                                {{ taskForm.relatedProjects.length }}
                                            </v-chip>
                                        </div>
                                        <div v-show="isOpen('task-related-projects')" class="section-body">
                                            <!-- 멀티 과제 맵핑 모드 -->
                                            <template v-if="isMultiTaskMappingMode">
                                                <div class="pa-2 mb-2 rounded bg-purple-lighten-5">
                                                    <div class="d-flex align-center ga-1 mb-1">
                                                        <v-icon size="14" color="purple">mdi-checkbox-multiple-marked-outline</v-icon>
                                                        <span class="text-caption text-purple-darken-1 font-weight-medium">{{ multiTaskMappingElementIds.length }}개 태스크에 동시 매핑됩니다</span>
                                                    </div>
                                                    <div class="d-flex flex-wrap ga-1">
                                                        <v-chip
                                                            v-for="name in multiTaskMappingElementNames"
                                                            :key="name"
                                                            size="x-small"
                                                            variant="tonal"
                                                            color="purple-darken-1"
                                                        >{{ name }}</v-chip>
                                                    </div>
                                                </div>
                                                <v-autocomplete
                                                    v-model="multiTaskMappingForm.relatedProjects"
                                                    :items="multiTaskMappingProjectItems"
                                                    :loading="atdtTaskListLoading"
                                                    item-title="name"
                                                    item-value="id"
                                                    return-object
                                                    label="추가할 과제 검색"
                                                    placeholder="추가할 과제명을 검색..."
                                                    density="compact"
                                                    variant="outlined"
                                                    hide-details
                                                    multiple
                                                    chips
                                                    closable-chips
                                                    :menu-props="{ maxHeight: 320 }"
                                                    @update:menu="onAtdtRelatedProjectsMenu"
                                                >
                                                    <template v-slot:chip="{ props: chipProps, item }">
                                                        <v-chip
                                                            v-bind="chipProps"
                                                            size="small"
                                                            variant="tonal"
                                                            color="purple"
                                                            closable
                                                        >
                                                            <span>{{ item.raw ? item.raw.name : '' }}</span>
                                                        </v-chip>
                                                    </template>
                                                    <template v-slot:no-data>
                                                        <v-list-item>
                                                            <v-list-item-title class="text-caption">
                                                                {{ atdtTaskListLoading ? '과제 목록을 불러오는 중...' : (atdtTaskListLoaded ? '검색 결과가 없습니다.' : '과제 목록을 불러오지 못했습니다.') }}
                                                            </v-list-item-title>
                                                        </v-list-item>
                                                    </template>
                                                </v-autocomplete>
                                                <div class="d-flex justify-end ga-2 mt-2">
                                                    <v-btn
                                                        size="small"
                                                        variant="text"
                                                        @click="$emit('exitMultiTaskMappingSelection')"
                                                    >취소</v-btn>
                                                    <v-btn
                                                        size="small"
                                                        color="purple"
                                                        variant="flat"
                                                        :loading="multiTaskMappingSubmitting"
                                                        :disabled="!multiTaskMappingForm.relatedProjects || !multiTaskMappingForm.relatedProjects.length"
                                                        @click="submitMultiRelatedProjectsMapping"
                                                    >동시 매핑 적용</v-btn>
                                                </div>
                                            </template>
                                            <!-- 단일 모드 -->
                                            <v-autocomplete
                                                v-else
                                                v-model="taskForm.relatedProjects"
                                                :items="atdtRelatedProjectItems"
                                                :loading="atdtTaskListLoading"
                                                item-title="name"
                                                item-value="id"
                                                return-object
                                                label="과제명 입력"
                                                placeholder="과제명을 검색..."
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                multiple
                                                chips
                                                closable-chips
                                                :menu-props="{ maxHeight: 320 }"
                                                @update:menu="onAtdtRelatedProjectsMenu"
                                            >
                                                <template v-slot:chip="{ props: chipProps, item }">
                                                    <v-chip
                                                        v-bind="chipProps"
                                                        size="small"
                                                        :variant="item.raw && item.raw.groupId ? 'flat' : 'tonal'"
                                                        color="purple"
                                                        closable
                                                        :title="buildRelatedProjectChipTooltip(item.raw)"
                                                    >
                                                        <a
                                                            v-if="item.raw && item.raw.id"
                                                            :href="buildAtdtTaskDetailUrl(item.raw.id)"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            :class="['atdt-task-chip-link', item.raw && item.raw.groupId ? 'atdt-task-chip-link--on-fill' : '']"
                                                            @click.stop
                                                        >
                                                            <i
                                                                v-if="item.raw && item.raw.groupId"
                                                                class="mdi mdi-link-variant atdt-task-chip-link__icon"
                                                            ></i>{{ item.raw.name }}</a>
                                                        <span v-else>{{ item.raw ? item.raw.name : '' }}</span>
                                                    </v-chip>
                                                </template>
                                                <template v-slot:item="{ props: itemProps, item }">
                                                    <v-list-item v-bind="itemProps">
                                                        <template v-if="isRelatedProjectGroupedInForm(item.raw)" #append>
                                                            <v-icon
                                                                size="14"
                                                                color="purple"
                                                                :title="buildRelatedProjectChipTooltip(getMatchedFormItem(item.raw))"
                                                            >mdi-link-variant</v-icon>
                                                        </template>
                                                    </v-list-item>
                                                </template>
                                                <template v-slot:no-data>
                                                    <v-list-item>
                                                        <v-list-item-title class="text-caption">
                                                            {{ atdtTaskListLoading ? '과제 목록을 불러오는 중...' : (atdtTaskListLoaded ? '검색 결과가 없습니다.' : '과제 목록을 불러오지 못했습니다.') }}
                                                        </v-list-item-title>
                                                    </v-list-item>
                                                </template>
                                            </v-autocomplete>
                                        </div>
                                    </div>

                                    <!-- 엘리먼트 PI Flag 섹션 (owner 이상) -->
                                    <div v-if="isOwner" class="section-group" ref="commentSection">
                                        <div class="section-title" @click="toggle('element-comments')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('element-comments') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            <v-icon size="14" class="mr-1" color="red">mdi-flag-outline</v-icon>
                                            PI Flag
                                            <v-chip v-if="elementComments.length" size="x-small" variant="tonal" color="red" class="ml-2">{{ elementComments.length }}</v-chip>
                                        </div>
                                        <div v-show="isOpen('element-comments')" class="section-body">
                                            <!-- 멀티선택 배너 -->
                                            <div v-if="isMultiCommentMode" class="pa-2 mb-2 rounded bg-blue-lighten-5">
                                                <div class="d-flex align-center ga-1 mb-1">
                                                    <v-icon size="14" color="blue-darken-1">mdi-checkbox-multiple-marked-outline</v-icon>
                                                    <span class="text-caption text-blue-darken-1 font-weight-medium">{{ multiSelectedElementIds.length }}개 태스크에 동시 적용됩니다</span>
                                                </div>
                                                <div class="d-flex flex-wrap ga-1">
                                                    <v-chip
                                                        v-for="name in multiSelectedElementNames"
                                                        :key="name"
                                                        size="x-small"
                                                        variant="tonal"
                                                        color="blue-darken-1"
                                                    >{{ name }}</v-chip>
                                                </div>
                                            </div>
                                            <!-- 코멘트 목록 (싱글모드만) - PI Flag 탭과 동일한 UI 통일 -->
                                            <div v-if="elementComments.length === 0 && !isMultiCommentMode" class="text-center pa-3">
                                                <v-icon size="28" color="grey-lighten-2">mdi-flag-outline</v-icon>
                                                <div class="text-caption text-disabled mt-1">등록된 개선과제가 없습니다</div>
                                            </div>
                                            <div
                                                v-if="!isMultiCommentMode && elementComments.length"
                                                class="pi-flag-comments mb-2"
                                            >
                                                <template v-for="(comment, idx) in elementComments" :key="comment.id">
                                                    <div class="pi-flag-card__item">
                                                            <div class="pi-flag-card__item-meta">
                                                                <span class="text-caption text-disabled">{{ comment.authorName || '익명' }} · {{ formatCommentTime(comment.createdAt) }}</span>
                                                                <v-spacer />
                                                                <v-btn
                                                                    v-if="!isViewMode"
                                                                    size="x-small"
                                                                    variant="text"
                                                                    class="text-none mr-1"
                                                                    :color="comment.reflected ? 'primary' : undefined"
                                                                    :title="comment.reflected ? 'To-Be 반영됨 (클릭하여 해제)' : 'To-Be 에 반영'"
                                                                    @click="togglePiFlagReflected(activeElement && activeElement.id, comment.id)"
                                                                >
                                                                    <v-icon start size="13">{{ comment.reflected ? 'mdi-check-decagram' : 'mdi-decagram-outline' }}</v-icon>
                                                                    반영
                                                                </v-btn>
                                                                <v-btn
                                                                    v-if="!isViewMode && (comment.authorId === currentUserId || isAdmin)"
                                                                    icon
                                                                    variant="text"
                                                                    size="x-small"
                                                                    color="error"
                                                                    @click="requestDeleteElementComment(comment.id)"
                                                                >
                                                                    <v-icon size="13">mdi-trash-can-outline</v-icon>
                                                                </v-btn>
                                                            </div>
                                                            <div class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">상태</span>
                                                                <span class="pi-flag-card__item-value">
                                                                    <v-icon
                                                                        size="12"
                                                                        :color="comment.status === 'resolved' ? 'error' : 'success'"
                                                                        class="mr-1"
                                                                    >mdi-flag</v-icon>
                                                                    <span :class="comment.status === 'resolved' ? 'text-error' : 'text-success'">
                                                                        {{ comment.status === 'resolved' ? '즉시 개선' : '향후 과제' }}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <div class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">유형</span>
                                                                <span class="pi-flag-card__item-value">{{ comment.category || comment.type || '-' }}</span>
                                                            </div>
                                                            <div v-if="comment.title" class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">제목</span>
                                                                <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ comment.title }}</span>
                                                            </div>
                                                            <div class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">{{ (comment.problem || comment.improvement) ? '문제점' : '사유' }}</span>
                                                                <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ comment.problem || comment.description }}</span>
                                                            </div>
                                                            <div v-if="comment.improvement" class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">개선방향</span>
                                                                <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ comment.improvement }}</span>
                                                            </div>
                                                            <div
                                                                v-if="getGroupedSiblings(comment, activeElement?.id).length > 0"
                                                                class="pi-flag-card__item-row"
                                                            >
                                                                <span class="pi-flag-card__item-label">묶음</span>
                                                                <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">
                                                                    <v-chip
                                                                        v-for="sib in getGroupedSiblings(comment, activeElement?.id)"
                                                                        :key="sib.id"
                                                                        size="x-small"
                                                                        variant="tonal"
                                                                        color="grey"
                                                                        class="mr-1 mb-1 sk-group-task-chip"
                                                                        @click.stop="$emit('focusElement', sib.id)"
                                                                    >
                                                                        <v-icon start size="10">mdi-link-variant</v-icon>
                                                                        {{ sib.name }}
                                                                    </v-chip>
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <v-divider v-if="idx < elementComments.length - 1" class="my-1" />
                                                    </template>
                                                </div>
                                            <!-- 개선과제 입력 폼 -->
                                            <div class="mt-2 px-1">
                                                <v-select
                                                    v-model="newCommentStatus"
                                                    :items="[
                                                        { title: '향후 과제', value: 'open' },
                                                        { title: '즉시 개선', value: 'resolved' }
                                                    ]"
                                                    item-title="title"
                                                    item-value="value"
                                                    label="상태"
                                                    variant="outlined"
                                                    density="compact"
                                                    hide-details
                                                    class="mb-2"
                                                >
                                                    <template #selection="{ item }">
                                                        <v-icon size="14" class="mr-1" :color="item.raw.value === 'resolved' ? '#ef5350' : '#4caf50'">mdi-flag</v-icon>
                                                        <span>{{ item.raw.title }}</span>
                                                    </template>
                                                    <template #item="{ props, item }">
                                                        <v-list-item v-bind="props" :title="item.raw.title">
                                                            <template #prepend>
                                                                <v-icon size="14" :color="item.raw.value === 'resolved' ? '#ef5350' : '#4caf50'">mdi-flag</v-icon>
                                                            </template>
                                                        </v-list-item>
                                                    </template>
                                                </v-select>
                                                <v-select
                                                    v-model="newCommentType"
                                                    :items="piFlagTypeOptions"
                                                    label="유형"
                                                    variant="outlined"
                                                    density="compact"
                                                    hide-details
                                                    clearable
                                                    class="mb-2"
                                                />
                                                <v-textarea
                                                    v-model="newCommentDescription"
                                                    placeholder="개선 사유 및 문제점을 입력하세요..."
                                                    variant="outlined"
                                                    density="compact"
                                                    rows="2"
                                                    auto-grow
                                                    hide-details
                                                    class="text-body-2"
                                                    @keydown.shift.enter.stop
                                                />
                                                <div class="d-flex justify-end align-center ga-2 mt-1">
                                                    <v-btn
                                                        size="small"
                                                        variant="text"
                                                        color="primary"
                                                        class="text-none"
                                                        @click="openPiFlagEditor(false)"
                                                    >
                                                        <v-icon start size="14">mdi-text-box-edit-outline</v-icon>
                                                        팝업으로 작성
                                                    </v-btn>
                                                    <v-btn
                                                        size="small"
                                                        variant="flat"
                                                        color="primary"
                                                        class="text-none"
                                                        :loading="submittingElementComment"
                                                        :disabled="!newCommentDescription.trim() || !newCommentStatus"
                                                        @click="submitElementComment"
                                                    >등록</v-btn>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            <!-- Empty State -->
                            <div v-else class="task-empty-state">
                                <div class="task-empty-icon">
                                    <v-icon size="48" color="grey-lighten-2">mdi-cursor-default-click-outline</v-icon>
                                </div>
                                <div class="text-subtitle-2 text-medium-emphasis mt-3">
                                    BPMN 캔버스에서 요소를 클릭하세요
                                </div>
                                <div class="text-caption text-disabled mt-1">
                                    Task, Event, Gateway 등의 요소를 선택하면 속성을 편집할 수 있습니다
                                </div>
                            </div>
                        </v-window-item>

                        <!-- ==================== PI Flag Tab ==================== -->
                        <v-window-item v-if="isOwner" value="pi-flag">
                            <div class="pa-4 pi-flag-tab-content">
                                <!-- 상단 요약 -->
                                <div class="pi-flag-summary mb-3 d-flex align-center">
                                    <div class="pi-flag-summary__total d-flex align-center">
                                        <v-icon size="18" color="error" class="mr-1">mdi-flag</v-icon>
                                        <span class="font-weight-bold">{{ piFlagFocused ? '선택' : '전체' }} {{ piFlagTotalCount }}건</span>
                                        <v-chip
                                            v-if="piFlagFocused"
                                            size="x-small"
                                            variant="tonal"
                                            color="primary"
                                            class="ml-2"
                                            @click="clearPiFlagFocus"
                                        >
                                            모두 보기
                                        </v-chip>
                                    </div>
                                    <div class="pi-flag-summary__stats ga-2 d-flex ml-auto">
                                        <v-chip size="x-small" variant="flat" color="error">
                                            <v-icon start size="12">mdi-flag</v-icon>
                                            즉시 개선 {{ piFlagResolvedCount }}
                                        </v-chip>
                                        <v-chip size="x-small" variant="flat" color="success">
                                            <v-icon start size="12">mdi-flag</v-icon>
                                            향후 과제 {{ piFlagOpenCount }}
                                        </v-chip>
                                    </div>
                                </div>

                                <!-- 서브탭: 사용자 코멘트 / Agent 분석 -->
                                <v-tabs
                                    v-model="piFlagSubTab"
                                    density="compact"
                                    color="primary"
                                    class="pi-flag-subtabs mb-2"
                                >
                                    <v-tab value="user-comments" size="small">
                                        <v-icon size="14" start :color="piFlagSubTab === 'user-comments' ? 'primary' : undefined">mdi-comment-text-outline</v-icon>
                                        사용자
                                        <v-chip
                                            v-if="piFlagTotalCount"
                                            size="x-small"
                                            variant="tonal"
                                            :color="piFlagSubTab === 'user-comments' ? 'primary' : undefined"
                                            class="ml-1"
                                        >
                                            {{ piFlagTotalCount }}
                                        </v-chip>
                                    </v-tab>
                                    <v-tab value="agent-analysis" size="small">
                                        <v-icon size="14" start :color="piFlagSubTab === 'agent-analysis' ? 'primary' : undefined">mdi-robot-outline</v-icon>
                                        Agent 분석
                                        <v-chip
                                            v-if="piFlagAgentAnalysisEntries.length"
                                            size="x-small"
                                            variant="tonal"
                                            :color="piFlagSubTab === 'agent-analysis' ? 'primary' : undefined"
                                            class="ml-1"
                                        >
                                            {{ piFlagAgentAnalysisEntries.length }}
                                        </v-chip>
                                    </v-tab>
                                </v-tabs>

                                <v-window v-model="piFlagSubTab" :transition="false" :reverse-transition="false">
                                    <!-- (1) 사용자 코멘트 -->
                                    <v-window-item value="user-comments">
                                        <!-- 요소 선택 없이 프로세스 전반 PI Flag 등록 -->
                                        <div v-if="!isViewMode" class="d-flex justify-end mb-2">
                                            <v-btn
                                                size="small"
                                                variant="tonal"
                                                color="primary"
                                                class="text-none"
                                                @click="openPiFlagEditor(true)"
                                            >
                                                <v-icon start size="14">mdi-flag-plus-outline</v-icon>
                                                프로세스 전반 PI Flag 작성
                                            </v-btn>
                                        </div>
                                        <!-- 빈 상태 -->
                                        <div v-if="piFlagVisibleEntries.length === 0" class="text-center pa-4">
                                            <v-icon size="40" color="grey-lighten-2">mdi-flag-outline</v-icon>
                                            <div class="text-caption text-disabled mt-2">등록된 사용자 코멘트가 없습니다</div>
                                        </div>

                                        <!-- 엘리먼트별 그룹 카드 리스트 -->
                                        <div v-else class="sk-mapping-list">
                                            <div
                                                v-for="entry in piFlagVisibleEntries"
                                                :key="entry.kind === 'group' ? 'group:' + entry.groupId : 'task:' + entry.elementId"
                                                class="sk-mapping-list__row"
                                            >
                                                <div class="sk-mapping-list__head">
                                                    <span
                                                        v-if="entry.kind === 'group'"
                                                        class="sk-mapping-list__name sk-mapping-list__name--link"
                                                        @click.stop="$emit('focusElement', entry.taskIds)"
                                                    >PI Flag 묶음</span>
                                                    <template v-else>
                                                        <span class="sk-mapping-list__label">Task</span>
                                                        <span
                                                            class="sk-mapping-list__name sk-mapping-list__name--link"
                                                            @click.stop="$emit('focusElement', entry.elementId)"
                                                        >{{ entry.elementName }}</span>
                                                    </template>
                                                    <span class="sk-mapping-list__count">{{ entry.comments.length }}</span>
                                                    <v-btn
                                                        v-if="!isViewMode && piFlagEntryGroupKeys(entry).length"
                                                        size="x-small"
                                                        variant="text"
                                                        color="error"
                                                        class="text-none"
                                                        @click.stop="requestDeletePiFlagGroup(entry)"
                                                    >
                                                        <v-icon start size="12">mdi-delete-sweep-outline</v-icon>
                                                        일괄삭제
                                                    </v-btn>
                                                    <v-icon
                                                        size="14"
                                                        class="pi-flag-card__toggle"
                                                        @click.stop="togglePiFlagCard(entry.kind === 'group' ? entry.groupId : entry.elementId)"
                                                    >
                                                        {{ isPiFlagCardOpen(entry.kind === 'group' ? entry.groupId : entry.elementId) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                                    </v-icon>
                                                </div>
                                                <div
                                                    v-if="isPiFlagCardOpen(entry.kind === 'group' ? entry.groupId : entry.elementId)"
                                                    class="sk-mapping-list__items pi-flag-comments"
                                                >
                                                    <template v-for="(comment, idx) in entry.comments" :key="comment.id">
                                                        <div class="pi-flag-card__item">
                                                            <div class="pi-flag-card__item-meta">
                                                                <span class="text-caption text-disabled">{{ comment.authorName || '익명' }} · {{ formatCommentTime(comment.createdAt) }}</span>
                                                                <v-spacer />
                                                                <v-btn
                                                                    v-if="entry.kind !== 'group' && !isViewMode"
                                                                    size="x-small"
                                                                    variant="text"
                                                                    class="text-none mr-1"
                                                                    :color="comment.reflected ? 'primary' : undefined"
                                                                    :title="comment.reflected ? 'To-Be 반영됨 (클릭하여 해제)' : 'To-Be 에 반영'"
                                                                    @click="togglePiFlagReflected(entry.elementId, comment.id)"
                                                                >
                                                                    <v-icon start size="13">{{ comment.reflected ? 'mdi-check-decagram' : 'mdi-decagram-outline' }}</v-icon>
                                                                    반영
                                                                </v-btn>
                                                                <v-btn
                                                                    v-if="entry.kind !== 'group' && !isViewMode && (comment.authorId === currentUserId || isAdmin)"
                                                                    icon
                                                                    variant="text"
                                                                    size="x-small"
                                                                    color="error"
                                                                    @click="requestDeletePiFlagComment(entry.elementId, comment.id)"
                                                                >
                                                                    <v-icon size="13">mdi-trash-can-outline</v-icon>
                                                                </v-btn>
                                                            </div>
                                                            <div class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">상태</span>
                                                                <span class="pi-flag-card__item-value">
                                                                    <v-icon
                                                                        size="12"
                                                                        :color="comment.status === 'resolved' ? 'error' : 'success'"
                                                                        class="mr-1"
                                                                    >mdi-flag</v-icon>
                                                                    <span :class="comment.status === 'resolved' ? 'text-error' : 'text-success'">
                                                                        {{ comment.status === 'resolved' ? '즉시 개선' : '향후 과제' }}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <div class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">유형</span>
                                                                <span class="pi-flag-card__item-value">{{ comment.category || comment.type || '-' }}</span>
                                                            </div>
                                                            <div v-if="comment.title" class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">제목</span>
                                                                <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ comment.title }}</span>
                                                            </div>
                                                            <div class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">{{ (comment.problem || comment.improvement) ? '문제점' : '사유' }}</span>
                                                                <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ comment.problem || comment.description }}</span>
                                                            </div>
                                                            <div v-if="comment.improvement" class="pi-flag-card__item-row">
                                                                <span class="pi-flag-card__item-label">개선방향</span>
                                                                <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ comment.improvement }}</span>
                                                            </div>
                                                            <template v-if="entry.kind === 'group'">
                                                                <div
                                                                    v-for="(name, nIdx) in entry.taskNames"
                                                                    :key="name"
                                                                    class="sk-mapping-list__item"
                                                                    @click.stop="entry.taskIds[nIdx] && $emit('focusElement', entry.taskIds[nIdx])"
                                                                >
                                                                    <span class="sk-mapping-list__item-label">task</span>
                                                                    <span class="sk-mapping-list__item-text">{{ name }}</span>
                                                                    <v-btn
                                                                        v-if="!isViewMode && entry.taskIds[nIdx]"
                                                                        icon
                                                                        variant="text"
                                                                        size="x-small"
                                                                        color="error"
                                                                        class="sk-mapping-list__item-action"
                                                                        title="이 task에서 제거"
                                                                        @click.stop="requestRemovePiFlagFromTask(entry.taskIds[nIdx], comment.id)"
                                                                    >
                                                                        <v-icon size="13">mdi-trash-can-outline</v-icon>
                                                                    </v-btn>
                                                                </div>
                                                            </template>
                                                        </div>
                                                        <v-divider v-if="idx < entry.comments.length - 1" class="my-1" />
                                                    </template>
                                                </div>
                                            </div>
                                        </div>
                                    </v-window-item>

                                    <!-- (2) Agent 분석: Global Gap Analysis, Policy 등 -->
                                    <v-window-item value="agent-analysis">
                                        <!-- 빈 상태 -->
                                        <div v-if="piFlagAgentAnalysisEntries.length === 0" class="text-center pa-4">
                                            <v-icon size="40" color="grey-lighten-2">mdi-robot-outline</v-icon>
                                            <div class="text-caption text-disabled mt-2">분석된 항목이 없습니다</div>
                                            <div class="text-caption text-disabled">Global Gap Analysis · Policy 등 등록된 분석 결과가 표시됩니다</div>
                                        </div>

                                        <!-- Agent 분석 항목 리스트 -->
                                        <div v-else class="sk-mapping-list">
                                            <div
                                                v-for="entry in piFlagAgentAnalysisEntries"
                                                :key="entry.id"
                                                class="sk-mapping-list__row"
                                            >
                                                <div class="sk-mapping-list__head">
                                                    <span class="sk-mapping-list__label">Agent</span>
                                                    <span
                                                        class="sk-mapping-list__name sk-mapping-list__name--link"
                                                        @click.stop="entry.elementId && $emit('focusElement', entry.elementId)"
                                                    >{{ entry.title }}</span>
                                                    <span class="sk-mapping-list__count">{{ entry.source }}</span>
                                                    <v-icon
                                                        size="14"
                                                        class="pi-flag-card__toggle"
                                                        @click.stop="togglePiFlagAgentCard(entry.id)"
                                                    >
                                                        {{ isPiFlagAgentCardOpen(entry.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                                    </v-icon>
                                                </div>
                                                <div
                                                    v-if="isPiFlagAgentCardOpen(entry.id)"
                                                    class="sk-mapping-list__items pi-flag-comments"
                                                >
                                                    <div class="pi-flag-card__item">
                                                        <div class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">출처</span>
                                                            <span class="pi-flag-card__item-value">{{ entry.source }}</span>
                                                        </div>
                                                        <div v-if="entry.partitionName" class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">블록</span>
                                                            <span class="pi-flag-card__item-value">{{ entry.partitionName }}</span>
                                                        </div>
                                                        <div class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">유형</span>
                                                            <span class="pi-flag-card__item-value">{{ entry.type || '-' }}</span>
                                                        </div>
                                                        <div class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">중요도</span>
                                                            <span class="pi-flag-card__item-value">{{ entry.severity || '-' }}</span>
                                                        </div>
                                                        <div class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">상태</span>
                                                            <span class="pi-flag-card__item-value">{{ entry.triage || '-' }}</span>
                                                        </div>
                                                        <div class="pi-flag-card__item-row">
                                                            <span class="pi-flag-card__item-label">문제</span>
                                                            <span class="pi-flag-card__item-value pi-flag-card__item-value--multiline">{{ entry.description }}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- PI Flag 기반 AI 질문 (qdrantChat 스트리밍) -->
                                        <div class="pi-flag-chat mt-3">
                                            <div class="pi-flag-chat__head">
                                                <v-icon size="14" color="primary" class="mr-1">mdi-message-text-outline</v-icon>
                                                <span class="pi-flag-chat__title">PI Flag 기반 AI 질문</span>
                                                <v-chip size="x-small" variant="tonal" color="primary" class="ml-2">
                                                    {{ piFlagChatFlags.length }}건 참조
                                                </v-chip>
                                                <v-spacer />
                                                <div v-if="piFlagChatLog.length" class="pi-flag-chat__head-actions">
                                                    <v-btn
                                                        size="x-small"
                                                        variant="text"
                                                        class="text-none"
                                                        @click="openPiFlagChatDialog"
                                                    >
                                                        <v-icon start size="13">mdi-arrow-expand</v-icon>
                                                        전체보기
                                                    </v-btn>
                                                    <v-btn
                                                        size="x-small"
                                                        variant="text"
                                                        class="text-none"
                                                        @click="clearPiFlagChat"
                                                    >
                                                        <v-icon start size="13">mdi-broom</v-icon>
                                                        대화 비우기
                                                    </v-btn>
                                                </div>
                                            </div>

                                            <!-- 대화 로그 -->
                                            <div v-if="piFlagChatLog.length" class="pi-flag-chat__log">
                                                <div v-for="turn in piFlagChatLog" :key="turn.id" class="pi-flag-chat__turn">
                                                    <div class="pi-flag-chat__q">
                                                        <v-icon size="13" class="mr-1">mdi-account-outline</v-icon>{{ turn.question }}
                                                    </div>
                                                    <div class="pi-flag-chat__a">
                                                        <template v-if="turn.streaming && !turn.answer">
                                                            <span class="pi-flag-chat__thinking">PI Flag 기반으로 분석 중…</span>
                                                        </template>
                                                        <template v-else>
                                                            <div class="pi-flag-chat__a-body" v-html="formatPiFlagChatAnswer(turn.answer)"></div>
                                                            <span v-if="turn.streaming" class="pi-flag-chat__caret" aria-hidden="true"></span>
                                                        </template>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- 추천 질문 버튼 -->
                                            <div class="pi-flag-chat__suggestions">
                                                <v-chip
                                                    v-for="q in piFlagChatSuggestions"
                                                    :key="q"
                                                    size="x-small"
                                                    variant="outlined"
                                                    color="primary"
                                                    class="mr-1 mb-1"
                                                    :disabled="piFlagChatLoading"
                                                    @click="applyPiFlagChatSuggestion(q)"
                                                >
                                                    {{ q }}
                                                </v-chip>
                                            </div>

                                            <!-- 입력 -->
                                            <v-textarea
                                                v-model="piFlagChatInput"
                                                rows="2"
                                                auto-grow
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                                placeholder="등록된 PI Flag를 기반으로 질문해 보세요 (예: 가장 시급한 개선 과제는?)"
                                                class="pi-flag-chat__input mt-1"
                                                @keydown.enter.exact.prevent="sendPiFlagChat"
                                            />
                                            <div v-if="piFlagChatError" class="pi-flag-chat__error mt-1">{{ piFlagChatError }}</div>
                                            <div class="d-flex justify-end mt-1">
                                                <v-btn
                                                    color="primary"
                                                    variant="flat"
                                                    size="small"
                                                    :loading="piFlagChatLoading"
                                                    :disabled="piFlagChatLoading"
                                                    @click="sendPiFlagChat"
                                                >
                                                    <v-icon start size="14">mdi-send</v-icon>
                                                    질문하기
                                                </v-btn>
                                            </div>
                                        </div>
                                    </v-window-item>
                                </v-window>
                            </div>
                        </v-window-item>
                    </v-window>
                </v-window-item>

                <!-- ==================== Governance Tab ==================== -->
                <v-window-item value="governance">
                    <div class="pa-4">
                        <!-- Review Guide Buttons -->
                        <div class="review-guide-buttons mb-4">
                            <div class="review-guide-buttons__label">
                                <v-icon size="14" class="mr-1">mdi-lightbulb-outline</v-icon>
                                가이드
                            </div>
                            <v-btn
                                size="x-small"
                                :variant="reviewGuideTab === 'bpmn' ? 'flat' : 'tonal'"
                                :color="reviewGuideTab === 'bpmn' ? 'blue' : 'grey'"
                                class="text-none review-guide-btn"
                                @click="openReviewGuide('bpmn')"
                            >
                                <v-icon start size="14">mdi-book-open-variant</v-icon>
                                기본지식
                            </v-btn>
                            <v-btn
                                size="x-small"
                                :variant="reviewGuideTab === 'checklist' ? 'flat' : 'tonal'"
                                :color="reviewGuideTab === 'checklist' ? 'green' : 'grey'"
                                class="text-none review-guide-btn"
                                @click="openReviewGuide('checklist')"
                            >
                                <v-icon start size="14">mdi-checkbox-marked-outline</v-icon>
                                체크포인트
                            </v-btn>
                        </div>

                        <!-- Review Guide Floating Window (Teleported) -->
                        <Teleport to="body">
                            <div
                                v-if="reviewGuideTab"
                                class="review-guide-floating"
                                :style="reviewGuideWindowStyle"
                            >
                                <div
                                    class="review-guide-floating__titlebar"
                                    @mousedown="startDragGuideWindow"
                                >
                                    <div class="review-guide-floating__titlebar-left">
                                        <v-icon size="16" color="white" class="mr-1">{{ reviewGuideTab === 'bpmn' ? 'mdi-book-open-variant' : 'mdi-checkbox-marked-outline' }}</v-icon>
                                        <span>{{ reviewGuideTab === 'bpmn' ? 'BPMN 기본지식' : '체크포인트' }}</span>
                                    </div>
                                    <div class="review-guide-floating__titlebar-actions">
                                        <v-btn
                                            v-if="reviewGuideTab === 'bpmn'"
                                            icon
                                            variant="text"
                                            size="x-small"
                                            @click="switchReviewGuide('checklist')"
                                            title="체크포인트로 전환"
                                        >
                                            <v-icon size="16" color="white">mdi-checkbox-marked-outline</v-icon>
                                        </v-btn>
                                        <v-btn
                                            v-else
                                            icon
                                            variant="text"
                                            size="x-small"
                                            @click="switchReviewGuide('bpmn')"
                                            title="기본지식으로 전환"
                                        >
                                            <v-icon size="16" color="white">mdi-book-open-variant</v-icon>
                                        </v-btn>
                                        <v-btn
                                            icon
                                            variant="text"
                                            size="x-small"
                                            @click="reviewGuideTab = null"
                                        >
                                            <v-icon size="16" color="white">mdi-close</v-icon>
                                        </v-btn>
                                    </div>
                                </div>
                                <div class="review-guide-floating__body">
                                    <BpmnReviewGuide :activeTab="reviewGuideTab" />
                                </div>
                                <!-- Resize handle -->
                                <div
                                    class="review-guide-floating__resize"
                                    @mousedown.stop="startResizeGuideWindow"
                                ></div>
                            </div>
                        </Teleport>

                        <!-- 임시 숨김: 순서도/공람 표시와 중복돼 의미 없는 정보로 판단 (공람 칩 / 버전 / Review Context / Round 식별자)
                        <div class="governance-status-strip mb-4">
                            <div class="d-flex align-center flex-wrap ga-2">
                                <v-chip size="x-small" :color="governanceStateColor" variant="tonal">
                                    {{ governanceStateLabel }}
                                </v-chip>
                                <v-chip v-if="governanceVersionLabel" size="small" color="primary" variant="tonal">
                                    {{ governanceVersionLabel }}
                                </v-chip>
                                <v-chip v-if="hasReviewContext" size="small" color="indigo" variant="tonal">
                                    Review Context
                                </v-chip>
                                <v-chip v-if="approvalState && approvalState.id" size="small" color="grey" variant="outlined">
                                    Round {{ displayText(approvalState.id).slice(0, 8) }}
                                </v-chip>
                            </div>
                        </div>
                        -->


                        <div v-if="approvalState" class="governance-review-summary mb-4">
                            <div class="governance-review-summary__headline">
                                <div>
                                    <div class="governance-section-label">검토 진행</div>
                                    <div class="governance-review-summary__title">
                                        미해결 {{ unresolvedFeedbackCount }}건 / 전체 {{ reviewFeedbackItems.length }}건
                                    </div>
                                </div>
                            </div>
                            <!-- 현업 결재자 영역 — 본사 카드는 본사 제거 정책으로 노출 안 함 -->
                            <div
                                v-if="procDefOwners.fieldOwners.length > 0 || approvalState.field_reviewer_name"
                                class="governance-review-summary__approver mt-3"
                            >
                                <!-- 승인 상태 줄 -->
                                <div class="d-flex align-center flex-wrap ga-2 mb-1">
                                    <span class="text-caption text-medium-emphasis">승인 상태:</span>
                                    <v-chip
                                        size="x-small"
                                        variant="tonal"
                                        :color="approvalState.field_status === 'approved' ? 'success' : approvalState.field_status === 'rejected' ? 'error' : 'grey'"
                                    >
                                        {{ approvalState.field_status === 'approved' ? '승인' : approvalState.field_status === 'rejected' ? '반려' : '대기' }}
                                    </v-chip>
                                </div>
                                <!-- 담당자 줄 — 진행 중이면 현업 담당자 모두, 승인 완료되면 실제 승인한 사람만 표시 -->
                                <div class="d-flex align-start flex-wrap ga-1">
                                    <span class="text-caption text-medium-emphasis mr-1" style="line-height: 24px;">담당자:</span>
                                    <template v-if="approvalState.field_status === 'approved' && approvalState.field_reviewer_name">
                                        <v-chip size="x-small" variant="tonal" color="success" class="mr-1 mb-1">
                                            {{ approvalState.field_reviewer_name }}
                                        </v-chip>
                                    </template>
                                    <template v-else>
                                        <v-chip
                                            v-for="(fo, idx) in procDefOwners.fieldOwners"
                                            :key="ownerKey(fo, idx, 'field-approver')"
                                            size="x-small"
                                            variant="tonal"
                                            color="grey-darken-3"
                                            class="mr-1 mb-1"
                                        >
                                            {{ resolvedOwnerName(fo) }}
                                        </v-chip>
                                    </template>
                                </div>
                            </div>
                        </div>

                        <div v-if="approvalState" class="governance-action-box mb-5">
                            <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-2">
                                <div>
                                    <div class="governance-action-box__title">결재</div>
                                </div>
                                <v-chip size="x-small" color="primary" variant="tonal">
                                    {{ governanceStateLabel }}
                                </v-chip>
                            </div>

                            <div v-if="governanceActionNotice" class="governance-action-notice">
                                <v-icon size="14" class="mr-1">mdi-information-outline</v-icon>
                                {{ governanceActionNotice }}
                            </div>

                            <v-textarea
                                v-model="governanceActionComment"
                                placeholder="상세 내용을 입력해주세요..."
                                variant="outlined"
                                density="compact"
                                rows="3"
                                auto-grow
                                hide-details
                                class="mt-3"
                                @keydown.shift.enter.stop
                            />

                            <div class="d-flex align-center justify-space-between flex-wrap ga-2 mt-3">
                                <div class="text-caption text-medium-emphasis">
                                    배포는 미해결 피드백이 0건일 때만 가능합니다.
                                </div>
                                <div class="d-flex align-center flex-wrap ga-2 ms-auto justify-end">
                                    <!-- 본사 + 현업 단계에서 사용하던 본사 승인 버튼 — 본사 제거로 비활성화 -->
                                    <!-- <v-btn
                                        v-if="canApproveHQAction"
                                        size="small"
                                        color="primary"
                                        variant="flat"
                                        class="text-none"
                                        :loading="governanceActionLoading"
                                        :disabled="governanceActionLoading || !canApproveOrReject"
                                        @click="handleGovernanceApproveHQ"
                                    >
                                        <v-icon start size="14">mdi-domain</v-icon>
                                        본사 승인
                                    </v-btn> -->
                                    <v-btn
                                        v-if="!isGovernanceFinished"
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        class="text-none"
                                        :disabled="governanceActionLoading || !governanceActionComment.trim() || !canRejectAction"
                                        @click="handleGovernanceReject"
                                    >
                                        <v-icon start size="14">mdi-alert-circle-outline</v-icon>
                                        반려
                                    </v-btn>
                                    <v-tooltip
                                        v-if="canPublishActionState"
                                        :text="publishActionDisabledReason"
                                        :disabled="!publishActionDisabledReason"
                                        location="top"
                                    >
                                        <template #activator="{ props: tooltipProps }">
                                            <span v-bind="tooltipProps">
                                                <v-btn
                                                    size="small"
                                                    color="green"
                                                    variant="flat"
                                                    class="text-none"
                                                    :loading="governanceActionLoading"
                                                    :disabled="governanceActionLoading || !canPublishAction"
                                                    @click="handleGovernancePublish"
                                                >
                                                    <v-icon start size="14">mdi-rocket-launch-outline</v-icon>
                                                    최종 배포
                                                </v-btn>
                                            </span>
                                        </template>
                                    </v-tooltip>
                                    <v-btn
                                        v-if="canApproveFieldAction"
                                        size="small"
                                        :color="fieldApproveButton.color"
                                        variant="flat"
                                        class="text-none"
                                        :loading="governanceActionLoading"
                                        :disabled="governanceActionLoading || !canApproveOrReject"
                                        @click="handleGovernanceApproveField"
                                    >
                                        <v-icon start size="14">{{ fieldApproveButton.icon }}</v-icon>
                                        {{ fieldApproveButton.label }} 승인
                                    </v-btn>
                                    <v-btn
                                        v-if="canEndPublicFeedbackAction"
                                        size="small"
                                        :color="publicApproveButton.color"
                                        variant="flat"
                                        class="text-none"
                                        :loading="governanceActionLoading"
                                        :disabled="governanceActionLoading"
                                        @click="handleGovernanceEndPublicFeedback"
                                    >
                                        <v-icon start size="14">{{ publicApproveButton.icon }}</v-icon>
                                        {{ publicApproveButton.label }} 승인
                                    </v-btn>
                                </div>
                            </div>
                        </div>

                        <!-- Timeline -->
                        <div class="governance-timeline">
                            <div
                                v-for="(entry, idx) in visibleTimelineEntries"
                                :key="timelineKey(entry, idx)"
                                class="timeline-entry"
                                :class="{ 'timeline-entry--current': entry.isCurrent }"
                            >
                                <div class="timeline-dot-col">
                                    <div
                                        class="timeline-dot"
                                        :class="{ 'timeline-dot--current': entry.isCurrent }"
                                        :style="{ backgroundColor: displayColor(entry.color, '#9e9e9e') }"
                                    />
                                    <div v-if="idx < visibleTimelineEntries.length - 1" class="timeline-line" />
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title text-subtitle-2 font-weight-medium">
                                        {{ entry.title }}
                                    </div>
                                    <div class="timeline-meta d-flex align-center flex-wrap ga-1 mt-1">
                                        <v-chip
                                            v-if="entry.roleTag"
                                            size="x-small"
                                            :color="displayColor(entry.roleColor, 'grey')"
                                            variant="tonal"
                                        >{{ entry.roleTag }}</v-chip>
                                        <span class="text-caption text-medium-emphasis">{{ entry.actor }}</span>
                                        <span class="text-caption text-disabled">{{ entry.date }}</span>
                                    </div>
                                </div>
                            </div>
                            <!-- 더보기 / 접기 -->
                            <div v-if="hasMoreTimeline" class="text-center mt-1">
                                <v-btn
                                    variant="text"
                                    size="x-small"
                                    color="grey"
                                    class="text-none show-more-btn"
                                    @click="timelineExpanded = !timelineExpanded"
                                >
                                    <v-icon start size="14">{{ timelineExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                    {{ timelineExpanded ? '접기' : `이전 이력 더보기 (${timelineEntries.length - 3}건)` }}
                                </v-btn>
                            </div>
                            <div v-if="timelineEntries.length === 0" class="text-center py-6">
                                <v-icon size="40" color="grey-lighten-2">mdi-timeline-outline</v-icon>
                                <div class="text-caption text-disabled mt-2">거버넌스 이력이 없습니다</div>
                            </div>
                        </div>

                        <!-- 프로세스 검토 의견 피드백 관련 Feedback Section -->
                        <div class="mt-6">
                            <div class="feedback-section-header text-overline font-weight-bold text-medium-emphasis mb-3">
                                피드백
                                <v-chip v-if="feedbackItems.length" size="x-small" variant="tonal" color="primary" class="ml-2">
                                    {{ feedbackItems.length }}
                                </v-chip>
                            </div>

                            <div v-if="feedbackItems.length === 0" class="text-center py-4">
                                <v-icon size="32" color="grey-lighten-2">mdi-comment-outline</v-icon>
                                <div class="text-caption text-disabled mt-1">피드백이 없습니다</div>
                            </div>

                            <div
                                v-for="(fb, feedbackIdx) in visibleFeedbackItems"
                                :key="feedbackKey(fb, feedbackIdx)"
                                class="feedback-card"
                                :class="{ 'feedback-card--resolved': fb.is_resolved }"
                            >
                                <div class="d-flex align-center justify-space-between mb-2">
                                    <div class="d-flex align-center ga-2">
                                        <div
                                            class="feedback-dot"
                                            :style="{ backgroundColor: displayColor(fb.authorColor, '#607d8b') }"
                                        />
                                        <v-chip
                                            size="x-small"
                                            :color="displayColor(fb.authorColor, 'grey')"
                                            variant="tonal"
                                        >{{ displayText(fb.author_name) || '익명' }}</v-chip>
                                        <v-chip
                                            v-if="fb.roleTag"
                                            size="x-small"
                                            variant="outlined"
                                        >{{ fb.roleTag }}</v-chip>
                                    </div>
                                    <div class="d-flex align-center ga-1">
                                        <v-chip
                                            v-if="!fb.is_resolved"
                                            size="x-small"
                                            color="warning"
                                            variant="flat"
                                        >미해결</v-chip>
                                        <v-icon
                                            v-else
                                            size="18"
                                            color="success"
                                        >mdi-check-circle</v-icon>
                                        <template v-if="canManageFeedback(fb) && editingFeedbackId !== fb.id">
                                            <v-btn
                                                v-if="!fb.is_resolved"
                                                icon
                                                variant="text"
                                                size="x-small"
                                                color="grey"
                                                @click="startEditFeedback(fb)"
                                            >
                                                <v-icon size="14">mdi-pencil-outline</v-icon>
                                            </v-btn>
                                            <v-btn
                                                icon
                                                variant="text"
                                                size="x-small"
                                                color="grey"
                                                @click="requestDeleteFeedback(fb)"
                                            >
                                                <v-icon size="14">mdi-delete-outline</v-icon>
                                            </v-btn>
                                        </template>
                                    </div>
                                </div>
                                <div v-if="fb.element_id && fb.element_id !== '__process__'" class="mb-1">
                                    <v-chip
                                        size="x-small"
                                        color="primary"
                                        variant="tonal"
                                        class="cursor-pointer"
                                        @click="$emit('focusElement', displayText(fb.element_id))"
                                    >
                                        <v-icon start size="12">mdi-checkbox-marked-outline</v-icon>
                                        {{ displayText(fb.element_name || fb.element_id) }}
                                    </v-chip>
                                </div>
                                <template v-if="editingFeedbackId === fb.id">
                                    <v-textarea
                                        v-model="editFeedbackText"
                                        variant="outlined"
                                        density="compact"
                                        rows="2"
                                        auto-grow
                                        hide-details
                                        autofocus
                                        class="feedback-edit-textarea"
                                        @keydown.shift.enter.stop
                                    />
                                    <div class="d-flex justify-end mt-2 ga-1">
                                        <v-btn
                                            size="x-small"
                                            variant="text"
                                            class="text-none"
                                            :disabled="savingFeedbackEdit"
                                            @click="cancelEditFeedback"
                                        >취소</v-btn>
                                        <v-btn
                                            size="x-small"
                                            variant="flat"
                                            color="primary"
                                            class="text-none"
                                            :disabled="savingFeedbackEdit || !editFeedbackText.trim()"
                                            :loading="savingFeedbackEdit"
                                            @click="saveEditFeedback"
                                        >저장</v-btn>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class="text-body-2 feedback-content" :class="{ 'text-medium-emphasis': fb.is_resolved }">
                                        {{ fb.content || '' }}
                                    </div>
                                    <div class="d-flex align-center justify-space-between mt-2">
                                        <span class="text-caption text-disabled time-stamp">{{ fb.relativeTime }}<span v-if="fb.updated_at && fb.updated_at !== fb.created_at" class="ml-1 time-stamp__edited">(수정됨)</span></span>
                                        <div
                                            v-if="!fb.is_resolved && inlineReplyTargetId !== fb.id && inlineResolveTargetId !== fb.id"
                                            class="d-flex ga-1"
                                        >
                                            <v-btn
                                                size="x-small"
                                                variant="outlined"
                                                class="text-none"
                                                @click="openInlineReply(fb)"
                                            >답글</v-btn>
                                            <v-btn
                                                size="x-small"
                                                variant="flat"
                                                color="primary"
                                                class="text-none"
                                                @click="openInlineResolve(fb)"
                                            >해결</v-btn>
                                        </div>
                                    </div>
                                    <!-- 인라인 답글 입력 (최상위 피드백 대상) -->
                                    <div v-if="inlineReplyTargetId === fb.id" class="inline-input mt-3">
                                        <v-textarea
                                            v-model="inlineReplyText"
                                            variant="outlined"
                                            density="compact"
                                            rows="2"
                                            auto-grow
                                            hide-details
                                            autofocus
                                            placeholder="답글을 입력하세요..."
                                            @keydown.shift.enter.stop
                                        />
                                        <div class="d-flex justify-end mt-2 ga-1">
                                            <v-btn
                                                size="x-small"
                                                variant="text"
                                                class="text-none"
                                                :disabled="submittingFeedback"
                                                @click="cancelInlineReply"
                                            >취소</v-btn>
                                            <v-btn
                                                size="x-small"
                                                variant="flat"
                                                color="primary"
                                                class="text-none"
                                                :disabled="!inlineReplyText.trim() || submittingFeedback"
                                                :loading="submittingFeedback"
                                                @click="submitInlineReply(fb)"
                                            >등록</v-btn>
                                        </div>
                                    </div>
                                    <!-- 인라인 해결 입력 -->
                                    <div v-if="inlineResolveTargetId === fb.id" class="inline-input mt-3">
                                        <div class="text-caption text-medium-emphasis mb-1">조치 내용</div>
                                        <v-textarea
                                            v-model="inlineResolveText"
                                            variant="outlined"
                                            density="compact"
                                            rows="2"
                                            auto-grow
                                            hide-details
                                            autofocus
                                            placeholder="해결 처리한 내용을 입력하세요..."
                                            @keydown.shift.enter.stop
                                        />
                                        <div class="d-flex justify-end mt-2 ga-1">
                                            <v-btn
                                                size="x-small"
                                                variant="text"
                                                class="text-none"
                                                @click="cancelInlineResolve"
                                            >취소</v-btn>
                                            <v-btn
                                                size="x-small"
                                                variant="flat"
                                                color="success"
                                                class="text-none"
                                                :disabled="!inlineResolveText.trim()"
                                                @click="submitInlineResolve(fb)"
                                            >해결 처리</v-btn>
                                        </div>
                                    </div>
                                    <!-- 해결(Resolve) 시 남긴 조치 내용 -->
                                    <div v-if="fb.is_resolved && fb.resolve_action_text" class="thread-reply thread-reply--resolved mt-3">
                                        <div class="thread-reply__body">
                                            <div class="d-flex align-center ga-2 mb-1">
                                                <v-icon size="14" color="success">mdi-check-circle</v-icon>
                                                <span class="text-caption font-weight-medium">{{ fb.resolved_by || '해결자' }}</span>
                                                <span class="text-caption text-disabled time-stamp ml-auto">{{ fb.resolvedRelativeTime || '' }}</span>
                                            </div>
                                            <div class="text-body-2 feedback-content">{{ fb.resolve_action_text }}</div>
                                        </div>
                                    </div>
                                    <!-- 답글(대댓글) — DFS 순서 + depth 기반 들여쓰기 -->
                                    <div
                                        v-for="reply in (descendantsByRoot[fb.id] || [])"
                                        :key="reply.id"
                                        class="thread-reply mt-2"
                                        :style="{ marginLeft: (Math.min(reply.depth - 1, 4) * 20) + 'px' }"
                                    >
                                        <div class="thread-reply__body">
                                            <div class="d-flex align-center ga-2 mb-1">
                                                <div
                                                    class="feedback-dot"
                                                    :style="{ backgroundColor: displayColor(reply.authorColor, '#607d8b') }"
                                                />
                                                <v-chip
                                                    size="x-small"
                                                    :color="displayColor(reply.authorColor, 'grey')"
                                                    variant="tonal"
                                                >{{ displayText(reply.author_name) || '익명' }}</v-chip>
                                                <v-chip
                                                    v-if="reply.roleTag"
                                                    size="x-small"
                                                    variant="outlined"
                                                >{{ reply.roleTag }}</v-chip>
                                                <span class="text-caption text-disabled time-stamp ml-auto">{{ reply.relativeTime }}</span>
                                            </div>
                                            <div class="text-body-2 feedback-content">{{ reply.content }}</div>
                                            <div
                                                v-if="inlineReplyTargetId !== reply.id"
                                                class="d-flex justify-end mt-2 ga-1"
                                            >
                                                <v-btn
                                                    size="x-small"
                                                    variant="outlined"
                                                    class="text-none"
                                                    @click="openInlineReply(reply)"
                                                >답글</v-btn>
                                            </div>
                                            <!-- 답글에 대한 인라인 답글 입력 (depth 들여쓰기를 입력창만 음수 마진으로 상쇄해 부모 폭 복원) -->
                                            <div
                                                v-if="inlineReplyTargetId === reply.id"
                                                class="inline-input mt-2"
                                                :style="{
                                                    marginLeft: -(Math.min(reply.depth - 1, 4) * 20) + 'px',
                                                    width: 'calc(100% + ' + (Math.min(reply.depth - 1, 4) * 20) + 'px)'
                                                }"
                                            >
                                                <v-textarea
                                                    v-model="inlineReplyText"
                                                    variant="outlined"
                                                    density="compact"
                                                    rows="2"
                                                    auto-grow
                                                    hide-details
                                                    autofocus
                                                    placeholder="답글을 입력하세요..."
                                                />
                                                <div class="d-flex justify-end mt-2 ga-1">
                                                    <v-btn
                                                        size="x-small"
                                                        variant="text"
                                                        class="text-none"
                                                        :disabled="submittingFeedback"
                                                        @click="cancelInlineReply"
                                                    >취소</v-btn>
                                                    <v-btn
                                                        size="x-small"
                                                        variant="flat"
                                                        color="primary"
                                                        class="text-none"
                                                        :disabled="!inlineReplyText.trim() || submittingFeedback"
                                                        :loading="submittingFeedback"
                                                        @click="submitInlineReply(reply)"
                                                    >등록</v-btn>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>

                            <!-- 더보기 / 접기 -->
                            <div v-if="hasMoreFeedback" class="text-center mt-1 mb-2">
                                <v-btn
                                    variant="text"
                                    size="x-small"
                                    color="grey"
                                    class="text-none show-more-btn"
                                    @click="feedbackExpanded = !feedbackExpanded"
                                >
                                    <v-icon start size="14">{{ feedbackExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                    {{ feedbackExpanded ? '접기' : `피드백 더보기 (${feedbackItems.length - 5}건)` }}
                                </v-btn>
                            </div>

                            <div v-if="showReleaseStrategy" class="release-strategy-panel mb-4">
                                <div class="d-flex align-start justify-space-between flex-wrap ga-2">
                                    <div>
                                        <div class="release-strategy-panel__title">Release Strategy</div>
                                        <div class="release-strategy-panel__subtitle">
                                            피드백을 확인한 뒤 현재 사이클에 누적할지, 차기 major 변경으로 분리할지 결정합니다.
                                        </div>
                                    </div>
                                    <v-chip size="x-small" :color="governanceStateColor" variant="tonal">
                                        {{ governanceStateLabel }}
                                    </v-chip>
                                </div>

                                <div class="release-lanes mt-3">
                                    <div class="release-lane">
                                        <div class="d-flex align-center justify-space-between flex-wrap ga-2">
                                            <div>
                                                <div class="release-lane__eyebrow">Current Cycle</div>
                                                <div class="release-lane__title">Minor Patch</div>
                                            </div>
                                            <v-chip size="x-small" color="primary" variant="tonal">
                                                기본 경로
                                            </v-chip>
                                        </div>
                                        <div class="release-lane__desc">
                                            {{ minorPatchDescription }}
                                        </div>
                                    </div>
                                    <div class="release-lane release-lane--accent">
                                        <div class="d-flex align-center justify-space-between flex-wrap ga-2">
                                            <div>
                                                <div class="release-lane__eyebrow">Next Cycle</div>
                                                <div class="release-lane__title">{{ majorUpgradeTitle }}</div>
                                            </div>
                                            <v-chip
                                                size="x-small"
                                                :color="hasPendingMajorUpgrade ? 'warning' : 'deep-orange'"
                                                :variant="hasPendingMajorUpgrade ? 'flat' : 'tonal'"
                                            >
                                                {{ hasPendingMajorUpgrade ? '승인 대기' : '분리 경로' }}
                                            </v-chip>
                                        </div>
                                        <div class="release-lane__desc">
                                            {{ majorUpgradeDescription }}
                                        </div>
                                        <div class="d-flex align-center flex-wrap ga-2 mt-3">
                                            <v-btn
                                                v-if="canRequestMajorUpgrade"
                                                size="small"
                                                color="deep-orange"
                                                variant="flat"
                                                class="text-none"
                                                @click="openMajorUpgradeDialog"
                                            >
                                                <v-icon start size="14">mdi-source-branch-plus</v-icon>
                                                차기 Major 초안 요청
                                            </v-btn>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Feedback Input -->
                            <div class="feedback-input-area mt-4">
                                <!-- Mention indicator -->
                                <div v-if="mentionedElement" class="mention-indicator mb-2">
                                    <v-icon size="14" class="mr-1" color="primary">mdi-link-variant</v-icon>
                                    <v-chip
                                        size="x-small"
                                        color="primary"
                                        variant="tonal"
                                        closable
                                        @click:close="clearMention"
                                    >
                                        <v-icon start size="12">mdi-checkbox-marked-outline</v-icon>
                                        {{ displayText(mentionedElement.name) }}
                                    </v-chip>
                                </div>
                                <div style="position: relative;">
                                    <v-textarea
                                        v-model="newFeedbackText"
                                        placeholder="피드백을 입력하세요... (@로 태스크 멘션)"
                                        variant="outlined"
                                        density="compact"
                                        rows="2"
                                        auto-grow
                                        hide-details
                                        class="feedback-textarea"
                                        @input="onFeedbackInput"
                                        @keydown.shift.enter.stop
                                    />
                                    <!-- Mention dropdown -->
                                    <v-card
                                        v-if="showMentionDropdown && filteredMentionTasks.length > 0"
                                        class="mention-dropdown"
                                        elevation="8"
                                    >
                                        <v-list density="compact" class="py-1">
                                            <v-list-item
                                                v-for="task in filteredMentionTasks"
                                                :key="task.id"
                                                @click="selectMentionTask(task)"
                                                class="mention-item"
                                            >
                                                <template v-slot:prepend>
                                                    <v-icon size="16" color="primary">mdi-checkbox-marked-outline</v-icon>
                                                </template>
                                                <v-list-item-title class="text-body-2">{{ task.name }}</v-list-item-title>
                                                <v-list-item-subtitle class="text-caption">{{ task.id }}</v-list-item-subtitle>
                                            </v-list-item>
                                        </v-list>
                                    </v-card>
                                </div>
                                <div class="d-flex justify-end mt-2">
                                    <v-btn
                                        size="small"
                                        variant="flat"
                                        color="primary"
                                        class="text-none"
                                        :disabled="submittingFeedback || !newFeedbackText.trim() || !canLeaveFeedback"
                                        :loading="submittingFeedback"
                                        @click="submitFeedback"
                                    >
                                        <v-icon start size="14">mdi-send</v-icon>
                                        피드백 등록
                                    </v-btn>
                                </div>
                            </div>
                        </div>
                    </div>
                </v-window-item>

            </v-window>
        </div>

        <!-- Resolve Feedback Dialog -->
        <v-dialog v-model="majorUpgradeDialog" max-width="520" persistent>
            <v-card rounded="lg">
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon size="18" color="deep-orange" class="mr-2">mdi-source-branch-plus</v-icon>
                    차기 Major 초안 요청
                </v-card-title>
                <v-card-text class="pa-4">
                    <div class="text-body-2 text-medium-emphasis mb-4">
                        현재 배포본은 유지한 채, Review Board에서 차기 major 변경 사이클을 열도록 요청합니다.
                    </div>
                    <label class="field-label">요청 사유 <span class="text-error">*</span></label>
                    <v-textarea
                        v-model="majorUpgradeReason"
                        rows="4"
                        auto-grow
                        variant="outlined"
                        density="compact"
                        hide-details
                        placeholder="예: 정책 변경 반영, 상위 승인 체계 개편, 배포본과 분리된 차세대 설계 필요"
                        @keydown.shift.enter.stop
                    />
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        class="text-none"
                        :disabled="requestingMajorUpgrade"
                        @click="majorUpgradeDialog = false"
                    >
                        취소
                    </v-btn>
                    <v-btn
                        variant="flat"
                        color="deep-orange"
                        class="text-none"
                        :disabled="!majorUpgradeReason.trim()"
                        :loading="requestingMajorUpgrade"
                        @click="requestMajorUpgrade"
                    >
                        <v-icon start size="14">mdi-send</v-icon>
                        요청 등록
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 코멘트 삭제 확인 다이얼로그 -->
        <v-dialog v-model="commentDeleteDialogVisible" max-width="420" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon size="18" color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
                    코멘트 삭제
                </v-card-title>
                <v-card-text class="pa-4">
                    <div class="text-body-2">
                        {{ commentDeleteTarget && commentDeleteTarget.mode === 'pi-flag-group'
                            ? '묶음으로 작성된 코멘트를 연관된 모든 요소에서 일괄 삭제하시겠습니까?'
                            : commentDeleteTarget && commentDeleteTarget.mode === 'pi-flag-from-task'
                                ? '이 task 에서만 해당 묶음 코멘트를 빼내시겠습니까? (다른 task 의 코멘트는 유지됩니다)'
                                : '선택한 코멘트를 삭제하시겠습니까?' }}
                    </div>
                    <div class="text-caption text-disabled mt-1">삭제된 코멘트는 복구할 수 없습니다.</div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        class="text-none"
                        @click="cancelCommentDelete"
                    >취소</v-btn>
                    <v-btn
                        variant="flat"
                        color="error"
                        class="text-none"
                        @click="confirmCommentDelete"
                    >
                        <v-icon start size="14">mdi-delete-outline</v-icon>
                        삭제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- API 파라미터 삭제 확인 다이얼로그 -->
        <v-dialog v-model="apiParamDeleteDialog" max-width="420" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon size="18" color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
                    파라미터 삭제
                </v-card-title>
                <v-card-text class="pa-4">
                    <div class="text-body-2">
                        선택한 파라미터<template v-if="apiParamDeleteTarget"> "{{ apiParamDeleteTarget.key }} : {{ apiParamDeleteTarget.value }}"</template>를 삭제하시겠습니까?
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        class="text-none"
                        @click="cancelRemoveApiParam"
                    >취소</v-btn>
                    <v-btn
                        variant="flat"
                        color="error"
                        class="text-none"
                        @click="confirmRemoveApiParam"
                    >
                        <v-icon start size="14">mdi-delete-outline</v-icon>
                        삭제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- API 연동 항목 삭제 확인 다이얼로그 -->
        <v-dialog v-model="apiEntryDeleteDialog" max-width="420" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon size="18" color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
                    API 연동 삭제
                </v-card-title>
                <v-card-text class="pa-4">
                    <div class="text-body-2">
                        선택한 API 연동<template v-if="apiEntryDeleteTarget && apiEntryDeleteTarget.name"> "{{ apiEntryDeleteTarget.name }}"</template>을(를) 삭제하시겠습니까? 등록된 파라미터도 함께 삭제됩니다.
                    </div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        class="text-none"
                        @click="cancelRemoveApiIntegration"
                    >취소</v-btn>
                    <v-btn
                        variant="flat"
                        color="error"
                        class="text-none"
                        @click="confirmRemoveApiIntegration"
                    >
                        <v-icon start size="14">mdi-delete-outline</v-icon>
                        삭제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Lane 설명 AI 재생성 확인 다이얼로그 -->
        <v-dialog v-model="laneDescriptionConfirmDialog" max-width="420" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon size="18" color="primary" class="mr-2">mdi-creation</v-icon>
                    AI 설명 재생성
                </v-card-title>
                <v-card-text class="pa-4">
                    <div class="text-body-2">현재 입력된 lane 설명을 AI 가 생성한 설명으로 덮어쓰시겠습니까?</div>
                    <div class="text-caption text-disabled mt-1">덮어쓰기 후에는 이전 설명을 자동 복구할 수 없습니다.</div>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        class="text-none"
                        @click="laneDescriptionConfirmDialog = false"
                    >취소</v-btn>
                    <v-btn
                        variant="flat"
                        color="primary"
                        class="text-none"
                        :loading="laneDescriptionGenerating"
                        :disabled="laneDescriptionGenerating"
                        @click="runGenerateLaneDescription"
                    >
                        <v-icon start size="14">mdi-creation</v-icon>
                        덮어쓰기
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Parent (Domain/Mega/Major) 변경 확인 다이얼로그 -->
        <v-dialog v-model="parentChangeDialogOpen" max-width="480" persistent>
            <v-card rounded="lg">
                <v-card-title class="d-flex align-center pa-4 pb-2">
                    <v-icon class="mr-2" color="primary">
                        {{ parentChangePending?.targetType === 'module' ? 'mdi-puzzle-outline' : 'mdi-file-tree' }}
                    </v-icon>
                    <span class="text-subtitle-1 font-weight-bold">
                        {{ parentChangePending?.targetType === 'module' ? '프로세스 모듈로 저장' : 'Parent 위치 변경' }}
                    </span>
                </v-card-title>
                <v-card-text class="pa-4 pt-2">
                    <template v-if="parentChangePending?.targetType === 'module'">
                        <p class="text-body-2 mb-2">
                            이 프로세스를 모듈로 저장합니다. 체계도(계층도)에 등록되어 있다면 함께 제거됩니다.
                        </p>
                        <div v-if="parentHierarchy" class="text-caption pa-2 rounded" style="background:#f5f7fa;">
                            현재 위치:
                            <strong>{{ displayText(parentHierarchy.megaName) }}</strong>
                            ›
                            <strong>{{ displayText(parentHierarchy.majorName) }}</strong>
                        </div>
                        <p class="text-caption text-medium-emphasis mt-3">
                            BPMN 내용·소유자·버전 이력은 유지되며,
                            모듈은 "프로세스 모듈 관리" 페이지에서 확인할 수 있습니다.
                        </p>
                    </template>
                    <template v-else>
                        <p class="text-body-2 mb-3">
                            이 프로세스의 Parent 위치를 아래와 같이 변경합니다.
                        </p>
                        <div class="text-caption pa-2 rounded mb-2" style="background:#f5f7fa;">
                            <div v-if="parentChangePending?.preview?.domainName">
                                <span class="text-medium-emphasis">Domain:</span>
                                <strong>{{ displayText(parentChangePending.preview.domainName) }}</strong>
                            </div>
                            <div class="mt-1">
                                <span class="text-medium-emphasis">Mega:</span>
                                <strong>{{ displayText(parentChangePending?.preview?.megaName) }}</strong>
                            </div>
                            <div class="mt-1">
                                <span class="text-medium-emphasis">Major:</span>
                                <strong>{{ displayText(parentChangePending?.preview?.majorName) }}</strong>
                            </div>
                        </div>
                    </template>
                </v-card-text>
                <v-card-actions class="pa-4 pt-2">
                    <v-spacer />
                    <v-btn variant="text" :disabled="parentChangeSubmitting" @click="cancelParentChange">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :loading="parentChangeSubmitting"
                        @click="confirmParentChange"
                    >
                        {{ parentChangePending?.targetType === 'module' ? '모듈로 저장' : '변경' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- PI Flag Agent 분석 결과 전체보기 -->
        <v-dialog v-model="piFlagChatDialogOpen" max-width="980" scrollable>
            <v-card class="pi-flag-chat-dialog">
                <v-card-title class="pi-flag-chat-dialog__titlebar">
                    <div class="pi-flag-chat-dialog__title">
                        <v-icon size="18" color="primary">mdi-message-text-outline</v-icon>
                        <span>PI Flag Agent 분석 결과</span>
                        <v-chip size="x-small" variant="tonal" color="primary">
                            {{ piFlagChatLog.length }}개 대화
                        </v-chip>
                    </div>
                    <v-btn
                        icon
                        size="small"
                        variant="text"
                        @click="piFlagChatDialogOpen = false"
                    >
                        <v-icon size="18">mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pi-flag-chat-dialog__body">
                    <div v-if="piFlagChatLog.length" class="pi-flag-chat-dialog__turns">
                        <div
                            v-for="turn in piFlagChatLog"
                            :key="`dialog-${turn.id}`"
                            class="pi-flag-chat-dialog__turn"
                        >
                            <div class="pi-flag-chat-dialog__question">
                                <v-icon size="15" class="mr-1">mdi-account-outline</v-icon>
                                <span>{{ turn.question }}</span>
                            </div>
                            <div class="pi-flag-chat-dialog__answer">
                                <template v-if="turn.streaming && !turn.answer">
                                    <span class="pi-flag-chat__thinking">PI Flag 기반으로 분석 중…</span>
                                </template>
                                <template v-else>
                                    <div
                                        class="pi-flag-chat-dialog__answer-body"
                                        v-html="formatPiFlagChatAnswer(turn.answer)"
                                    ></div>
                                    <span v-if="turn.streaming" class="pi-flag-chat__caret" aria-hidden="true"></span>
                                </template>
                            </div>
                        </div>
                    </div>
                    <div v-else class="pi-flag-chat-dialog__empty">
                        표시할 PI Flag Agent 분석 결과가 없습니다.
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- Fixed Save Footer -->
        <div v-if="topTab === 'properties' && (activeTab === 'process' || (activeTab === 'task' && activeElement))" class="properties-footer">
            <v-btn
                v-if="activeTab === 'process'"
                color="primary" block variant="flat" class="save-btn" :disabled="isViewMode" @click="saveProcess"
            >
                <v-icon start size="16">mdi-content-save</v-icon>
                속성값 저장하기
            </v-btn>
            <v-btn
                v-else
                color="primary" block variant="flat" class="save-btn" :disabled="isViewMode" @click="saveTask"
            >
                <v-icon start size="16">mdi-content-save</v-icon>
                속성값 저장하기
            </v-btn>
        </div>

        <!-- PI Flag 작성 팝업 (제목/문제점/개선방향 + 경량 에디터) -->
        <PiFlagEditorDialog
            v-model:open="piFlagEditorOpen"
            :element-name="piFlagEditorElementless ? '' : (activeElement?.businessObject?.name || activeElement?.name || '')"
            :type-options="piFlagTypeOptions"
            :submitting="submittingPiFlagDialog"
            @submit="submitPiFlagDialog"
        />
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import { useTaskCatalogStore, PROPERTY_TYPES } from '@/stores/taskCatalog';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import BackendFactory from '@/components/api/BackendFactory';
import { userIdentityFromSearchResult, formatIdentityWithTeam } from '@/utils/userIdentity';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
import OwnerSettingDialog from '@/components/ui/OwnerSettingDialog.vue';
import ManualLinkField from '@/components/ui/ManualLinkField.vue';
import BpmnReviewGuide from '@/components/ui/BpmnReviewGuide.vue';
import PiFlagEditorDialog from '@/views/process-hierarchy/PiFlagEditorDialog.vue';
import { AN_STUDIO_KEY } from '@/composables/anStudio/useAnStudio';
import { readConditionExpressionBody } from '@/utils/bpmnSequenceFlowCondition';
import { readElementUuid } from '@/utils/bpmnElementUuid';
import { parseDmnXml } from '@/utils/dmnParser';
import { getStageDef } from '@/utils/processStages';
import { formatKST, toKst } from '@/utils/datetime';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { getResolvedRole, refreshAuthClaims } from '@/utils/authClaims';
import { canUseExecFeatures } from '@/utils/execFeatureGate';
import { getMajorBusinessDomain, majorMatchesDomain } from '@/views/process-architecture/processClassification';
import { mergeDomainLists, deriveDomainsFromProcMap, sortDomains } from '@/views/process-architecture/useProcessArchitecture';
import { toSafeText } from '@/utils/safeText';
import { readApiIntegrations, applyApiIntegrations } from '@/utils/apiIntegrations';
import {
    canApproveFieldReview,
    canApproveHQReview,
    canCommentOnReview,
    canEndPublicFeedbackReview,
    canManageReview,
    canPublishReview,
    canRejectReview,
    isSelfReviewSubmission
} from '@/utils/reviewPermissions';
import { getActivePiFlagTypeLabels, PI_FLAG_TYPES_CHANGE_EVENT } from '@/utils/piFlagTypes';
import {
    DEFAULT_ORGANIZATION_DMN_KEY,
    organizationDmnXmlToRule,
    projectOrganizationRulesForOrgIds,
    formatOrganizationRuleInputs
} from '@/utils/organizationDmnRule';
import { navigateToProcessHierarchy, PROCESS_HIERARCHY_ENTRY } from '@/views/process-hierarchy/navigation';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const backend = BackendFactory.createBackend();
const ANNUAL_WORKING_HOURS = 2080; // 52 weeks x 40 hours

const TASK_TYPE_LABELS = {
    'bpmn:Task': 'Task',
    'bpmn:UserTask': 'User Task',
    'bpmn:ManualTask': 'Manual Task',
    'bpmn:ServiceTask': 'Service Task',
    'bpmn:ScriptTask': 'Script Task',
    'bpmn:BusinessRuleTask': 'Business Rule Task',
    'bpmn:SendTask': 'Send Task',
    'bpmn:ReceiveTask': 'Receive Task',
    'bpmn:SubProcess': 'Sub Process',
    'bpmn:CallActivity': 'Call Activity',
};

function isTaskLikeBpmnType(bpmnType) {
    if (!bpmnType) return false;
    return bpmnType.includes('Task')
        || bpmnType === 'bpmn:SubProcess'
        || bpmnType === 'bpmn:CallActivity';
}

function buildTaskCountItems(typeMap) {
    const rawItems = Object.entries(typeMap).map(([type, count]) => ({
        type,
        label: TASK_TYPE_LABELS[type] || type.replace('bpmn:', ''),
        count,
    }));
    const total = rawItems.reduce((sum, i) => sum + i.count, 0);
    const items = rawItems.map(i => ({
        ...i,
        percent: total > 0 ? Math.round((i.count / total) * 100) : 0,
    }));
    return { total, items };
}

function defaultFte() {
    return {
        inputMode: 'time',
        directPercent: 0,
        freqCycle: 'Yearly',
        freqCount: 12,
        timePerTask: 0,
        headcount: 1,
    };
}

function calcFte(fte) {
    if (!fte) return '';
    if (fte.inputMode === 'direct') {
        const val = (fte.directPercent || 0) / 100;
        return val > 0 ? val.toFixed(3) : '';
    }
    const time = fte.timePerTask || 0;
    const count = fte.freqCount || 0;
    const head = fte.headcount || 1;
    let annualFreq = count;
    switch (fte.freqCycle) {
        case 'Monthly': annualFreq = count * 12; break;
        case 'Weekly': annualFreq = count * 52; break;
        case 'Daily': annualFreq = count * 260; break;
    }
    const val = (time * annualFreq * head) / ANNUAL_WORKING_HOURS;
    return val > 0 ? val.toFixed(3) : '';
}

function calcAnnualHours(fte) {
    if (!fte) return 0;
    if (fte.inputMode === 'direct') {
        return ((fte.directPercent || 0) / 100) * ANNUAL_WORKING_HOURS;
    }
    const time = fte.timePerTask || 0;
    const count = fte.freqCount || 0;
    const head = fte.headcount || 1;
    let annualFreq = count;
    switch (fte.freqCycle) {
        case 'Monthly': annualFreq = count * 12; break;
        case 'Weekly': annualFreq = count * 52; break;
        case 'Daily': annualFreq = count * 260; break;
    }
    return time * annualFreq * head;
}

// State color map for timeline dots
// 5단계 색은 공유 STAGE_DEFS 참조 (대시보드/체계도/리뷰보드 통일)
const STATE_COLORS = {
    draft: getStageDef('draft').color,
    submit: '#1976d2',
    in_review: getStageDef('in_review').color,
    approve_hq: '#2196f3',
    approve_field: '#4caf50',
    public_feedback: getStageDef('public_feedback').color,
    final_edit: getStageDef('final_edit').color,
    published: getStageDef('published').color,
    rejected: '#f44336',
    reopen: '#ff9800',
    request_reopen: '#ff9800',
    approve_reopen: '#4caf50',
    reject_reopen: '#f44336',
    comment: '#607d8b',
};

// Role color map
const ROLE_COLORS = {
    hq: '#2196f3',
    field: '#4caf50',
    submitter: '#1976d2',
    owner: '#1976d2',
    default: '#607d8b',
};

const GAP_CATEGORY_LABELS = {
    PROCESS: 'Process Gap',
    DATA: 'Data Gap',
    AUTOMATION: 'Automation Gap',
};

const GAP_TRIAGE_LABELS = {
    pending: '대기',
    accepted: '수용',
    edited: '수정',
    kept: '현행',
};

const GAP_SEVERITY_LABELS = {
    low: '낮음',
    medium: '보통',
    high: '높음',
};

export default {
    name: 'ProcessHierarchyProperties',
    inject: {
        anStudio: { from: AN_STUDIO_KEY, default: null },
    },
    components: {
        OwnerSettingDialog,
        DetailComponent,
        BpmnReviewGuide,
        ManualLinkField,
        PiFlagEditorDialog,
    },
    props: {
        processDefinition: { type: Object, default: null },
        element: { type: Object, default: null },
        isViewMode: { type: Boolean, default: false },
        isAdmin: { type: Boolean, default: false },
        isOwner: { type: Boolean, default: false },
        procMap: { type: Object, default: null },
        metricsMap: { type: Object, default: null },
        dataFreezeInfo: { type: Object, default: null },
        initialTopTab: { type: String, default: 'properties' },
        readOnlyMessage: { type: String, default: '' },
        roles: { type: Array, default: () => [] },
        processVariables: { type: Array, default: () => [] },
        definitionPath: { type: String, default: '' },
        definition: { type: Object, default: null },
        entrySource: { type: String, default: 'direct' },
        reviewId: { type: String, default: '' },
        focusCommentSection: { type: Boolean, default: false },
        focusTaskMappingSection: { type: Boolean, default: false },
        focusPiFlagAgentSection: { type: Boolean, default: false },
        multiTaskMappingElementIds: { type: Array, default: () => [] },
        multiSelectedElementIds: { type: Array, default: () => [] },
    },
    emits: ['save', 'close', 'focusElement', 'governanceUpdated', 'navigateToDefinition', 'taskMappingChanged', 'commentSectionFocused', 'exitMultiCommentSelection', 'taskMappingSectionFocused', 'exitMultiTaskMappingSelection', 'piFlagAgentSectionFocused', 'update:topTab', 'parentChanged', 'propertyAuditPending', 'persistBpmn'],
    data() {
        return {
            topTab: 'properties',
            activeTab: 'process',
            openSections: new Set(['strategic', 'hybrid-costing', 'competency', 'general', 'manual-link', 'task-manual-link', 'task-manual-links', 'kpi-history', 'task-basic', 'task-fte', 'task-opex', 'task-data-attachment', 'task-api', 'proc-api', 'relation-info', 'lane-assignee', 'lane-assignment', 'pool-exec', 'task-count', 'task-related-projects', 'proc-related-projects', 'proc-total-fte', 'proc-total-cost', 'call-activity-def', 'business-rule-dmn', 'task-data-io', 'service-agent', 'proc-system', 'task-system', 'element-comments']),
            closedPiFlagCards: new Set(),
            // 깃발 클릭 시 그 깃발이 가리키는 코멘트(들)가 속한 항목만 보여주기 위한 포커스 (null 이면 전체)
            piFlagFocusCommentIds: null,
            closedPiFlagAgentCards: new Set(),
            piFlagSubTab: 'user-comments',
            // PI Flag 기반 AI 챗 (Agent 분석 탭) — qdrantChat 스트리밍 재사용
            piFlagChatInput: '',
            piFlagChatLog: [],          // [{ id, question, answer, streaming }]
            piFlagChatLoading: false,
            piFlagChatError: '',
            piFlagChatSessionId: '',
            piFlagChatSeq: 0,           // 늦게 도착한 응답이 최신 응답을 덮어쓰지 않도록 하는 sequence guard
            piFlagChatDialogOpen: false,
            commentDeleteDialogVisible: false,
            commentDeleteTarget: null,
            // Owner 설정 다이얼로그
            ownerSettingDialogOpen: false,
            ownerHistoryDialogOpen: false,
            ownerHistoryLoading: false,
            ownerHistoryLoadingAll: false,
            ownerHistoryEntries: [],
            ownerHistoryTotal: 0,
            ownerHistoryLoadedAll: false,
            ownerHistoryHasMore: false,
            ownerHistoryInitialLimit: 10,
            ownerRollbackConfirmOpen: false,
            ownerRollbackTarget: null,
            ownerRollbackSaving: false,
            procDefOwners: { fieldOwners: [], hqOwners: [], masterOwner: null },
            ownerNameMap: {},
            processParentRefs: [],
            processParentRefsLoading: false,
            // 현재 프로세스를 CallActivity 로 참조하고 있는 다른 프로세스 목록 (역참조)
            callActivityParentRefs: [],
            callActivityParentRefsLoading: false,
            moduleParentRefs: [],
            moduleParentRefsLoading: false,
            // Owner 검색
            ownerResolved: null,
            ownerSelected: null,
            ownerSearchOptions: [],
            ownerSearchLoading: false,
            _ownerSearchTimer: null,
            // Parent hierarchy
            selectedMegaId: null,
            selectedMajorId: null,
            // Domain-aware Parent 편집 form (Domain → Mega → Major)
            parentForm: { domainId: null, megaId: null, majorId: null },
            parentChangeDialogOpen: false,
            parentChangePending: null,
            parentChangeSubmitting: false,
            // Lane 속성
            laneResourceType: 'internal',
            laneAssigneeType: 'org',
            laneAssignee: [],
            laneOrganization: [],
            laneUserOptions: [],
            laneUserSearchLoading: false,
            laneUserSearchText: '',
            _laneUserSearchTimer: null,
            laneDescription: '',
            laneDescriptionGenerating: false,
            laneDescriptionConfirmDialog: false,
            laneGroupOptions: [],
            laneGroupSearchLoading: false,
            _laneGroupSearchTimer: null,
            laneSupplier: [],
            laneSupplierOptions: [],
            laneSupplierSearchLoading: false,
            laneSupplierSearchText: '',
            _laneSupplierSearchTimer: null,
            // 역할 그룹 그룹 (admin > 내부조직역할 관리 > 역할 그룹 탭에서 정의)
            laneRoleGroups: [],              // 전체 그룹 row 들 (parent/child 다 포함)
            laneRoleGroupMembers: [],        // 전체 멤버 row 들
            laneRoleGroupLoading: false,
            laneRoleGroupSelectedList: [],   // 현재 lane 에 선택된 그룹 option 배열 [{ id, label, members }]
            laneRoleGroupIds: [],            // lane 데이터에 저장될 흔적 (참조용) — 선택된 그룹 id 배열
            // org DMN(조직 배정 라우팅) — 역할그룹별 라우팅 조건 조회 전용 투영.
            // 편집은 admin > 내부조직역할 관리에서만 한다.
            laneOrgDmnModel: null,
            laneOrgDmnLoading: false,
            laneOrgDmnLoaded: false,
            processForm: {
                title: '',
                description: '',
                owner: '',
                systems: [],
                fte: defaultFte(),
                futureState: 'as_is',
                wilTask: '',
                fteHoursPerMonth: null,
                hitlRequired: false,
                manualLinks: [],
                kpiEnabled: false,
            },
            taskForm: {
                name: '',
                description: '',
                manualLinks: [],
                systems: [],
                fte: defaultFte(),
                futureStatus: 'maintain',
                relatedProjects: [],
                opexCost: null,
                opexUnit: '건당',
                opexNote: '',
                schemaProps: {},
                dataAttachmentUrl: '',
                dataAttachmentFile: null,
                apiIntegrations: [],
                conditionExpression: '',
                flowType: 'sequence',
                conditionLlmMode: false,
            },
            sequenceFlowTypeOptions: [
                { label: 'Sequence Flow', value: 'sequence' },
                { label: 'Condition Flow', value: 'condition' },
                { label: 'Default Flow', value: 'default' },
            ],
            // API 연동 항목별 파라미터 입력 버퍼 (taskForm.apiIntegrations 와 인덱스 동기)
            apiParamDrafts: [],
            // API 파라미터 삭제 확인 다이얼로그 ({ entry, param } 참조)
            apiParamDeleteDialog: false,
            apiParamDeleteRef: null,
            // API 연동 항목 삭제 확인 다이얼로그
            apiEntryDeleteDialog: false,
            apiEntryDeleteIdx: null,
            // 인라인 편집 중인 파라미터 위치 ({ entry, param }, null 이면 편집 없음)
            editingApiParam: null,
            // 멀티 과제 맵핑 모드 전용 폼 (각 태스크에 동시 추가할 과제 목록)
            multiTaskMappingForm: {
                relatedProjects: [],
            },
            multiTaskMappingSubmitting: false,
            activeElement: null,
            taskFormDirty: false,
            _taskFormLoading: false,
            _bpmnEventBus: null,
            _bpmnElementChangedHandler: null,
            dataAttachmentUploading: false,
            // ATDT Task Management API (연관 과제 매핑용)
            atdtTaskList: [],
            atdtTaskListLoading: false,
            atdtTaskListLoaded: false,
            // ATDT Task Management API (시스템 매핑용)
            atdtSystemList: [],
            atdtSystemListLoading: false,
            atdtSystemListLoaded: false,
            // CallActivity
            callActivityDefinitionId: '',
            callActivityDefinitionName: '',
            callActivityDefinitionDeleted: false,
            callActivitySearchResults: [],
            callActivitySearchLoading: false,
            // UserTask 계열: 폼 연결 (uengine json 'tool' = 'formHandler:<form_def.id>', 미설정 시 네이밍 규칙 폴백)
            taskFormLinkId: '',
            formDefItems: [],
            formDefListLoading: false,
            // BusinessRuleTask: DMN 룰 연결 (실행 엔진이 properties.businessRuleId 로 평가)
            businessRuleId: '',
            businessRuleItems: [],
            businessRuleListLoading: false,
            businessRulePreview: null,
            businessRulePreviewLoading: false,
            // BPMN 데이터 입출력 (dataInput/OutputAssociation — 조회 전용, 연결은 캔버스에서)
            taskDataInputs: [],
            taskDataOutputs: [],
            // SendTask 메일 설정 (uengine json recipients/to/title/contents — 실행 도달 시 즉시 발송·자동 완료)
            sendTaskRecipients: [],
            sendTaskMailTitle: '',
            sendTaskMailContents: '',
            sendTaskUserItems: [],
            sendTaskUserLoading: false,
            dbSelectItems: {},
            userSearchResults: {},
            userSearchLoading: {},
            apiSelectItems: {},
            freqCycleOptions: [
                { title: '연간', value: 'Yearly' },
                { title: '월간', value: 'Monthly' },
                { title: '주간', value: 'Weekly' },
                { title: '일간', value: 'Daily' },
            ],
            futureStateOptions: [
                { title: 'As-Is (현행 유지)', value: 'as_is' },
                { title: 'To-Be (개선 대상)', value: 'to_be' },
                { title: 'Sunset (폐지 예정)', value: 'sunset' },
            ],
            // Element comment state (uengineProps 저장)
            elementComments: [],
            newCommentStatus: 'open',
            newCommentType: '',
            newCommentDescription: '',
            submittingElementComment: false,
            // PI Flag 작성 팝업 (제목/문제점/개선방향 분리 + 경량 에디터)
            piFlagEditorOpen: false,
            piFlagEditorElementless: false,
            submittingPiFlagDialog: false,
            // PI Flag 유형 마스터 (PiFlagTypeManager에서 관리, 동적 로드)
            piFlagTypeOptions: [],
            _piFlagTypesChangeHandler: null,
            // Governance data
            approvalState: null,
            approvalHistory: [],
            comments: [],
            governanceActionComment: '',
            governanceActionLoading: false,
            currentUserId: '',
            currentUserName: '',
            currentUserEmployeeNo: '',
            currentUserRole: 'viewer',
            // Feedback input
            newFeedbackText: '',
            submittingFeedback: false,
            // 인라인 답글/해결 상태 (카카오톡 답글 스타일)
            inlineReplyTargetId: null,
            inlineReplyText: '',
            inlineResolveTargetId: null,
            inlineResolveText: '',
            // Feedback edit state
            editingFeedbackId: '',
            editFeedbackText: '',
            savingFeedbackEdit: false,
            // @Mention state
            mentionedElement: null,
            mentionQuery: '',
            showMentionDropdown: false,
            bpmnDataVersion: 0,
            // Call Activity 집계 캐시: { [defId]: { status: 'loading'|'loaded'|'error', name, counts, total, error } }
            callActivityDataCache: {},
            // 더보기 state
            timelineExpanded: false,
            feedbackExpanded: false,
            // Major upgrade request
            majorUpgradeDialog: false,
            majorUpgradeReason: '',
            requestingMajorUpgrade: false,
            // Review guide floating window
            reviewGuideTab: null,
            guideWindowPos: { x: 100, y: 100 },
            guideWindowSize: { w: 480, h: 520 },
            _guideDrag: null,
            _guideResize: null,
        };
    },
    computed: {
        reviewGuideWindowStyle() {
            return {
                left: this.guideWindowPos.x + 'px',
                top: this.guideWindowPos.y + 'px',
                width: this.guideWindowSize.w + 'px',
                height: this.guideWindowSize.h + 'px',
            };
        },
        catalogStore() {
            return useTaskCatalogStore();
        },
        ownerHistoryCanLoadAll() {
            return !this.ownerHistoryLoadedAll && this.ownerHistoryHasMore;
        },
        // 현재 보고 있는 sub-process 가 등록된 KPI 목표 목록 — { year, label }
        // label: target.org_name (KPI 에 등록된 조직이 이미 고객사 기준 본부로 매핑됨 — 별도 parent 표시 불필요)
        kpiAssignmentsForCurrent() {
            const targetId = String(this.definitionPath || '').trim();
            if (!targetId) return [];
            const store = useAdminConsoleStore();
            const result = [];
            for (const target of (store.kpiTargets || [])) {
                const ids = Array.isArray(target.process_ids) ? target.process_ids : [];
                if (!ids.some((pid) => String(pid).trim() === targetId)) continue;
                const label = (target.org_name || '').trim();
                result.push({ year: target.year, label });
            }
            // 연도 내림차순 정렬 (최신 KPI 가 먼저 보이도록)
            return result.sort((a, b) => (b.year || 0) - (a.year || 0));
        },
        // ====== 역할 그룹 그룹 (lane 담당 지정 분기) ======
        // 셀렉트 옵션: 상위 그룹 + 하위 그룹 (들여쓰기) 한 리스트
        laneRoleGroupOptions() {
            const groupMap = new Map(this.laneRoleGroups.map((g) => [g.id, g]));
            const memberByGroup = new Map();
            for (const m of this.laneRoleGroupMembers) {
                if (!memberByGroup.has(m.role_group_id)) memberByGroup.set(m.role_group_id, []);
                memberByGroup.get(m.role_group_id).push(m);
            }
            const roots = this.laneRoleGroups.filter((g) => !g.parent_id)
                .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            const options = [];
            for (const root of roots) {
                const directMembers = memberByGroup.get(root.id) || [];
                const childGroups = this.laneRoleGroups.filter((g) => g.parent_id === root.id)
                    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                // 상위 그룹: 자기 직속 + 모든 자식 멤버 합쳐서 노출
                const aggregated = [...directMembers];
                for (const c of childGroups) {
                    const cm = memberByGroup.get(c.id) || [];
                    for (const m of cm) aggregated.push(m);
                }
                options.push({
                    id: root.id,
                    label: root.name,
                    members: aggregated,
                    is_root: true
                });
                for (const child of childGroups) {
                    options.push({
                        id: child.id,
                        label: '  └ ' + child.name,
                        members: memberByGroup.get(child.id) || [],
                        is_root: false
                    });
                }
            }
            return options;
        },
        // 현재 선택된 그룹들의 상세 (카드 미리보기용, 여러 개)
        selectedRoleGroupDetails() {
            const list = Array.isArray(this.laneRoleGroupSelectedList) ? this.laneRoleGroupSelectedList : [];
            return list.map((sel) => {
                const opt = this.laneRoleGroupOptions.find((o) => o.id === sel.id);
                const source = opt || sel;
                const cleanLabel = String(source.label || '').replace(/^\s*└\s*/, '');
                // 하위 그룹이면 부모(root) 이름 lookup
                const node = this.laneRoleGroups.find((g) => g.id === source.id);
                let parentName = '';
                if (node && node.parent_id) {
                    const parent = this.laneRoleGroups.find((g) => g.id === node.parent_id);
                    parentName = parent?.name || '';
                }
                return {
                    id: source.id,
                    label: cleanLabel,
                    members: source.members || [],
                    parentName,
                    routing: this.laneRoleGroupRoutingMap.get(source.id) || []
                };
            });
        },
        // 그룹별 DMN 라우팅 조건 투영 — 그룹 id + 구성원 org_id 로 출력이 연결된 규칙.
        // 내부조직역할 관리의 "라우팅 N건" 과 같은 기준 (projectOrganizationRulesForOrgIds 공유).
        laneRoleGroupRoutingMap() {
            const map = new Map();
            const model = this.laneOrgDmnModel;
            if (!model) return map;
            for (const opt of this.laneRoleGroupOptions) {
                const ids = new Set([opt.id]);
                for (const m of opt.members || []) {
                    if (m.org_id) ids.add(m.org_id);
                }
                const routing = projectOrganizationRulesForOrgIds(model, ids);
                if (routing.length) map.set(opt.id, routing);
            }
            return map;
        },
        // 멀티셀렉트 표시용 (양방향 숨김):
        //  - 하위 그룹이 선택되어 있으면 그 부모 root 를 옵션에서 숨김
        //  - 상위 그룹이 선택되어 있으면 그 자식 하위 그룹들을 옵션에서 숨김
        // (이미 상위가 모든 자식 멤버를 포함하므로 자식 또 선택해도 중복)
        laneRoleGroupVisibleOptions() {
            const selected = Array.isArray(this.laneRoleGroupSelectedList) ? this.laneRoleGroupSelectedList : [];
            const selectedIds = new Set(selected.map((s) => s.id));
            const hiddenRootIds = new Set();
            const hiddenChildIds = new Set();
            for (const sel of selected) {
                const node = this.laneRoleGroups.find((g) => g.id === sel.id);
                if (!node) continue;
                if (node.parent_id) {
                    // 선택된 하위 → 그 부모 숨김
                    hiddenRootIds.add(node.parent_id);
                } else {
                    // 선택된 상위 → 그 자식들 숨김
                    for (const g of this.laneRoleGroups) {
                        if (g.parent_id === node.id) hiddenChildIds.add(g.id);
                    }
                }
            }
            return this.laneRoleGroupOptions.filter((opt) => {
                if (selectedIds.has(opt.id)) return true; // 이미 선택된 옵션은 chip 으로 노출되므로 유지
                if (hiddenRootIds.has(opt.id)) return false;
                if (hiddenChildIds.has(opt.id)) return false;
                return true;
            });
        },
        isMultiCommentMode() {
            if (this.multiSelectedElementIds.length <= 1) return false;
            const currentId = this.element?.id;
            if (!currentId) return false;
            return this.multiSelectedElementIds.includes(currentId);
        },
        multiSelectedElementNames() {
            if (!this.isMultiCommentMode) return [];
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return this.multiSelectedElementIds;
            const elementRegistry = modeler.get('elementRegistry');
            return this.multiSelectedElementIds.map(id => {
                const el = elementRegistry.get(id);
                return el?.businessObject?.name || id;
            });
        },
        isMultiTaskMappingMode() {
            if (this.multiTaskMappingElementIds.length <= 1) return false;
            const currentId = this.element?.id;
            if (!currentId) return false;
            return this.multiTaskMappingElementIds.includes(currentId);
        },
        multiTaskMappingElementNames() {
            if (!this.isMultiTaskMappingMode) return [];
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return this.multiTaskMappingElementIds;
            const elementRegistry = modeler.get('elementRegistry');
            return this.multiTaskMappingElementIds.map(id => {
                const el = elementRegistry.get(id);
                return el?.businessObject?.name || id;
            });
        },
        multiTaskMappingProjectItems() {
            const selected = Array.isArray(this.multiTaskMappingForm.relatedProjects)
                ? this.multiTaskMappingForm.relatedProjects
                : [];
            const merged = [];
            const seenKeys = new Set();
            const pushUnique = (item) => {
                if (!item || !item.name) return;
                const key = item.id != null ? `id:${item.id}` : `name:${item.name}`;
                if (seenKeys.has(key)) return;
                seenKeys.add(key);
                merged.push(item);
            };
            selected.forEach(pushUnique);
            (this.atdtTaskList || []).forEach(pushUnique);
            return merged;
        },
        /** 요소 영구 UUID (uengine:properties json 백의 uuid) — 미부여 요소(저장 전 신규 등)는 빈 문자열 */
        elementUuid() {
            const bo = this.element?.businessObject || this.element;
            if (!bo) return '';
            try {
                return readElementUuid(bo) || '';
            } catch (e) {
                return '';
            }
        },
        /** 패널 '요소 ID' 표기 — 영구 UUID 우선, 없으면 BPMN element id 폴백 */
        elementDisplayId() {
            return this.elementUuid || toSafeText(this.element?.id).trim();
        },
        isLaneElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type.toLowerCase().includes('lane');
        },
        isParticipantElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type === 'bpmn:Participant';
        },
        /** 실행(Exec) 기능 허용 사용자 — 실행형 Pool 지정 섹션 노출 게이트. */
        isExecUser() {
            return canUseExecFeatures();
        },
        /** 지정된 실행형 Pool 목록 (공유 studio 의 executable 작업본, 다중 지정 가능). */
        execPoolList() {
            const exec = this.anStudio?.studio?.executable?.value;
            const pools = Array.isArray(exec?.exec_pools) ? exec.exec_pools : [];
            if (pools.length) return pools;
            // 구버전 단일 지정 표시 호환
            return exec?.exec_pool_id ? [{ id: exec.exec_pool_id, name: exec.exec_pool_name }] : [];
        },
        /** 현재 선택된 Pool 이 실행형으로 지정되어 있는지. */
        isExecPoolElement() {
            const id = toSafeText(this.element?.id).trim();
            return !!id && this.execPoolList.some((p) => p.id === id);
        },
        isSequenceFlowElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type === 'bpmn:SequenceFlow';
        },
        isTaskPropertyElement() {
            return !this.isLaneElement && !this.isSequenceFlowElement;
        },
        isCallActivityElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type === 'bpmn:CallActivity';
        },
        isStartEventElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type === 'bpmn:StartEvent';
        },
        isEndEventElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type === 'bpmn:EndEvent';
        },
        isDataReferenceElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type === 'bpmn:DataObjectReference' || type === 'bpmn:DataStoreReference';
        },
        isProcessLinkableElement() {
            return this.isCallActivityElement || this.isStartEventElement || this.isEndEventElement;
        },
        isBusinessRuleElement() {
            return toSafeText(this.element?.type || this.element?.$type).trim() === 'bpmn:BusinessRuleTask';
        },
        isSendTaskElement() {
            return toSafeText(this.element?.type || this.element?.$type).trim() === 'bpmn:SendTask';
        },
        // 폼 연결 가능한 태스크 (워크아이템 폼 렌더 대상 — UserTask 계열)
        isFormLinkableElement() {
            const type = toSafeText(this.element?.type || this.element?.$type).trim();
            return type === 'bpmn:UserTask' || type === 'bpmn:Task' || type === 'bpmn:ManualTask';
        },
        // 폼 미연결 시 실행 엔진이 사용하는 네이밍 규칙 폼 ID (FormWorkItem 폴백과 동일)
        defaultFormIdForElement() {
            const procId = toSafeText(
                this.processDefinition?.processDefinitionId || this.processDefinition?.id || this.definitionPath
            ).trim();
            const elId = toSafeText(this.element?.id).trim();
            if (!elId) return '';
            return `${procId}_${elId}_form`.toLowerCase().replace(/[/.]/g, '_');
        },
        callActivityDisplayItems() {
            const items = [...(this.callActivitySearchResults || [])];
            const currentId = toSafeText(this.processDefinition?.id).trim();
            // 자기 자신을 CallActivity 로 등록 못 하게 현재 프로세스 제외
            const filtered = currentId
                ? items.filter((item) => this.normalizeCallActivityDefinitionId(item?.path || item?.id) !== currentId)
                : items;
            const selectedId = this.normalizeCallActivityDefinitionId(this.callActivityDefinitionId);
            if (!selectedId) return filtered;

            const selectedPath = this.normalizeCallActivityDefinitionPath(selectedId);
            const exists = filtered.some((item) => this.normalizeCallActivityDefinitionId(item?.path || item?.id) === selectedId);
            if (!exists) {
                filtered.unshift({
                    id: selectedId,
                    name: toSafeText(this.callActivityDefinitionName).trim() || selectedId,
                    path: selectedPath
                });
            }
            return filtered;
        },
        isExternalLaneTask() {
            if (!this.element || this.isLaneElement) return false;
            try {
                // 1차: shape parent chain에서 Lane 탐색
                let parent = this.element.parent;
                while (parent) {
                    const pType = parent.type || '';
                    if (pType === 'bpmn:Lane') {
                        const laneProps = this._parseLaneExtProps(parent.businessObject);
                        if (laneProps) return laneProps.laneResourceType === 'external' || laneProps.laneResourceType === 'family';
                    }
                    if (pType === 'bpmn:Participant') break;
                    parent = parent.parent;
                }
                // 2차: BPMN 모델의 LaneSet → flowNodeRef로 Lane 탐색
                const bo = this.element.businessObject;
                const process = bo?.$parent;
                if (process?.laneSets) {
                    for (const laneSet of process.laneSets) {
                        for (const lane of (laneSet.lanes || [])) {
                            if (lane.flowNodeRef?.some(ref => ref.id === bo.id || ref === bo)) {
                                const laneProps = this._parseLaneExtProps(lane);
                                if (laneProps) return laneProps.laneResourceType === 'external' || laneProps.laneResourceType === 'family';
                            }
                        }
                    }
                }
            } catch { /* ignore */ }
            return false;
        },
        parentHierarchy() {
            const targetId = toSafeText(this.definitionPath).trim();
            if (!targetId || !this.procMap?.mega_proc_list) return null;
            // domainOptions(metrics+procMap union)와 동일 기준으로 매칭 —
            // metricsMap 단독 매칭은 metrics 미로딩/부분응답 시 domainId가 비어 Parent 편집이 막힌다
            const domains = this.domainOptions || [];
            for (const mega of this.procMap.mega_proc_list) {
                for (const major of mega.major_proc_list || []) {
                    const found = (major.sub_proc_list || []).find(sub =>
                        toSafeText(sub?.id).trim() === targetId ||
                        toSafeText(sub?.proc_def_id).trim() === targetId
                    );
                    if (found) {
                        const megaId = toSafeText(mega?.id).trim();
                        const majorId = toSafeText(major?.id).trim();
                        const domainName = getMajorBusinessDomain(major, domains) || '';
                        const matchedDomain = domains.find((d) =>
                            toSafeText(d?.name).trim() === domainName ||
                            toSafeText(d?.id).trim() === domainName
                        );
                        const domainId = matchedDomain ? toSafeText(matchedDomain.id).trim() : '';
                        return {
                            megaId,
                            megaName: toSafeText(mega?.name || megaId),
                            majorId,
                            majorName: toSafeText(major?.name || majorId),
                            domainId,
                            domainName,
                        };
                    }
                }
            }
            return null;
        },
        megaOptions() {
            if (!this.procMap?.mega_proc_list) return [];
            return this.procMap.mega_proc_list.map((m, index) => {
                const id = toSafeText(m?.id || `mega-${index}`).trim() || `mega-${index}`;
                return { id, name: toSafeText(m?.name || id) };
            });
        },
        majorOptionsForSelectedMega() {
            if (!this.selectedMegaId || !this.procMap?.mega_proc_list) return [];
            const selectedMegaId = toSafeText(this.selectedMegaId).trim();
            const mega = this.procMap.mega_proc_list.find(m => toSafeText(m?.id).trim() === selectedMegaId);
            if (!mega) return [];
            return (mega.major_proc_list || []).map((m, index) => {
                const id = toSafeText(m?.id || `${selectedMegaId}-major-${index}`).trim() || `${selectedMegaId}-major-${index}`;
                return { id, name: toSafeText(m?.name || id) };
            });
        },
        // ─── Domain-aware Parent 편집 ─────────────────────────────────────
        parentEditEnabled() {
            // 탭 내 다른 관리자 기능과 동일하게 isAdmin prop 기준 (superAdmin·SSO claims 관리자 포함)
            return this.isAdmin && !this.isViewMode;
        },
        isCurrentlyModule() {
            const type = toSafeText(this.processDefinition?.definition?.type).trim().toLowerCase();
            return type === 'call-activity-sub';
        },
        domainOptions() {
            // 신규 프로세스 다이얼로그와 동일한 source — metrics + procMap 의 union
            const fromMetrics = Array.isArray(this.metricsMap?.domains) ? this.metricsMap.domains : [];
            const fromProcMap = deriveDomainsFromProcMap(this.procMap);
            return sortDomains(mergeDomainLists(fromMetrics, fromProcMap))
                .map((d) => ({
                    id: toSafeText(d?.id || d?.name).trim(),
                    name: toSafeText(d?.name || d?.id).trim()
                }))
                .filter((d) => d.id && d.name);
        },
        megaOptionsForParentEdit() {
            if (!this.parentForm.domainId || !this.procMap?.mega_proc_list) return [];
            const domains = this.domainOptions || [];
            const targetDomain = domains.find((d) => toSafeText(d?.id).trim() === toSafeText(this.parentForm.domainId).trim());
            if (!targetDomain) return [];
            // Mega 중 그 도메인에 속한 Major 가 하나라도 있는 Mega 만
            const list = [];
            for (const mega of this.procMap.mega_proc_list) {
                const hasMatchingMajor = (mega.major_proc_list || []).some((major) => majorMatchesDomain(major, targetDomain, domains));
                if (hasMatchingMajor) {
                    list.push({
                        id: toSafeText(mega?.id).trim(),
                        name: toSafeText(mega?.name || mega?.id).trim()
                    });
                }
            }
            return list;
        },
        majorOptionsForParentEdit() {
            if (!this.parentForm.megaId || !this.procMap?.mega_proc_list) return [];
            const domains = this.domainOptions || [];
            const targetDomain = domains.find((d) => toSafeText(d?.id).trim() === toSafeText(this.parentForm.domainId).trim());
            const targetMega = this.procMap.mega_proc_list.find((m) => toSafeText(m?.id).trim() === toSafeText(this.parentForm.megaId).trim());
            if (!targetMega) return [];
            return (targetMega.major_proc_list || [])
                .filter((major) => !targetDomain || majorMatchesDomain(major, targetDomain, domains))
                .map((major) => ({
                    id: toSafeText(major?.id).trim(),
                    name: toSafeText(major?.name || major?.id).trim()
                }));
        },
        processFields() {
            const active = this.normalizeSchemaFields(this.catalogStore.schemasByAppliesTo('process'));
            const deprecatedWithValue = this.collectDeprecatedSchemaFieldsWithValue('process');
            return [...active, ...deprecatedWithValue];
        },
        taskFields() {
            const elementType = toSafeText(this.element?.type).trim();
            const active = this.normalizeSchemaFields(this.catalogStore.schemasByAppliesTo('task', elementType));
            const deprecatedWithValue = this.collectDeprecatedSchemaFieldsWithValue('task', elementType);
            return [...active, ...deprecatedWithValue];
        },
        processFteValue() {
            return calcFte(this.processForm.fte);
        },
        taskFteValue() {
            return calcFte(this.taskForm.fte);
        },
        freqCycleLabel() {
            const map = { Yearly: 'yr', Monthly: 'mo', Weekly: 'wk', Daily: 'day' };
            return map[this.taskForm.fte?.freqCycle || this.processForm.fte?.freqCycle] || 'yr';
        },
        annualWorkingHours() {
            return ANNUAL_WORKING_HOURS;
        },
        validationAlerts() {
            const alerts = [];
            if (this.topTab !== 'properties') return alerts;
            if (this.activeTab === 'task' && this.element) {
                const name = toSafeText(this.element.businessObject?.name).trim();
                if (!name || !name.trim()) {
                    alerts.push(this.$t('validation.unnamedTask') || 'Task name is required.');
                }
                this.taskFields.filter(f => f.is_required).forEach(f => {
                    const val = this.taskForm.schemaProps?.[f.property_key];
                    if (val === undefined || val === null || val === '') {
                        alerts.push(`${f.property_label || f.property_key} is required.`);
                    }
                });
                // FR-009: User Task 는 시스템 맵핑값(taskForm.systems)이 필수
                if (toSafeText(this.element.type).trim() === 'bpmn:UserTask'
                    && !(Array.isArray(this.taskForm.systems) && this.taskForm.systems.length)) {
                    alerts.push('시스템 맵핑값은 필수입니다.');
                }
            }
            if (this.activeTab === 'process') {
                const title = toSafeText(this.processForm.title).trim();
                if (!title) {
                    alerts.push(this.$t('validation.processNameRequired') || 'Process name is required.');
                }
            }
            return alerts;
        },
        governanceStateKey() {
            return toSafeText(this.approvalState?.state || this.processDefinition?.approval_state || this.processDefinition?.status || 'untracked').trim() || 'untracked';
        },
        governanceStateLabel() {
            // 5단계는 STAGE_DEFS.label 참조, 비-5단계만 별도 라벨
            const stateMap = {
                draft: getStageDef('draft').label,
                in_review: getStageDef('in_review').label,
                public_feedback: getStageDef('public_feedback').label,
                final_edit: getStageDef('final_edit').label,
                published: getStageDef('published').label,
                reopen_requested: '개선 요청',
                rejected: '반려',
                cancelled: '취소',
                archived: '보관됨',
                untracked: '관리 미등록',
            };
            return stateMap[this.governanceStateKey] || this.governanceStateKey;
        },
        governanceStateColor() {
            // 5단계 색은 공유 STAGE_DEFS 의 vuetifyColor 참조
            const colorMap = {
                draft: getStageDef('draft').vuetifyColor,
                in_review: getStageDef('in_review').vuetifyColor,
                public_feedback: getStageDef('public_feedback').vuetifyColor,
                final_edit: getStageDef('final_edit').vuetifyColor,
                published: getStageDef('published').vuetifyColor,
                reopen_requested: 'deep-orange',
                rejected: 'error',
                cancelled: 'grey',
                archived: 'grey-darken-1',
                untracked: 'blue-grey',
            };
            return colorMap[this.governanceStateKey] || 'blue-grey';
        },
        governanceVersionLabel() {
            if (this.approvalState?.version_label) {
                return toSafeText(this.approvalState.version_label).trim();
            }
            if (this.approvalState && (this.approvalState.major_version !== undefined || this.approvalState.minor_version !== undefined)) {
                return `v${toSafeText(this.approvalState.major_version || 0)}.${toSafeText(this.approvalState.minor_version || 0)}`;
            }
            if (this.approvalState?.version) {
                return `v${toSafeText(this.approvalState.version).trim()}`;
            }
            if (this.processDefinition?.version) {
                return `v${toSafeText(this.processDefinition.version).trim()}`;
            }
            return '';
        },
        canRequestMajorUpgrade() {
            return !this.dataFreezeInfo && this.governanceStateKey === 'published' && typeof backend.requestReopen === 'function';
        },
        hasPendingMajorUpgrade() {
            return this.governanceStateKey === 'reopen_requested';
        },
        hasReviewContext() {
            return this.entrySource === 'review-board' && !!this.reviewId;
        },
        currentReviewVersion() {
            if (this.approvalState?.version) {
                return toSafeText(this.approvalState.version).trim();
            }
            if (this.approvalState && (this.approvalState.major_version !== undefined || this.approvalState.minor_version !== undefined)) {
                return `${toSafeText(this.approvalState.major_version || 0)}.${toSafeText(this.approvalState.minor_version || 0)}`;
            }
            if (this.approvalState?.version_label) {
                return toSafeText(this.approvalState.version_label).replace(/^v/i, '');
            }
            return '';
        },
        canOpenPublishedBaselineDiff() {
            return !!this.definitionPath && !!this.currentReviewVersion;
        },
        reviewFeedbackItems() {
            return (this.feedbackItems || []).filter((item) => !item.parent_comment_id);
        },
        unresolvedFeedbackCount() {
            return this.reviewFeedbackItems.filter((item) => !item.is_resolved).length;
        },
        showReleaseStrategy() {
            if (this.isViewMode) return false;
            return this.feedbackItems.length > 0 || this.canRequestMajorUpgrade || this.hasPendingMajorUpgrade;
        },
        isGovernanceFinished() {
            return ['published', 'rejected', 'cancelled', 'archived'].includes(this.governanceStateKey);
        },
        assignedReviewerName() {
            return toSafeText(this.approvalState?.assigned_reviewer_name);
        },
        isSelfSubmitter() {
            return isSelfReviewSubmission(this.approvalState, {
                userId: this.currentUserId,
                userName: this.currentUserName,
                employeeNo: this.currentUserEmployeeNo
            });
        },
        canApproveOrReject() {
            return canManageReview(this.approvalState, {
                role: this.currentUserRole,
                userId: this.currentUserId,
                userName: this.currentUserName,
                employeeNo: this.currentUserEmployeeNo
            });
        },
        canApproveHQAction() {
            return canApproveHQReview(this.approvalState, {
                role: this.currentUserRole,
                userId: this.currentUserId,
                userName: this.currentUserName,
                employeeNo: this.currentUserEmployeeNo
            });
        },
        // 결재 버튼 라벨·색·아이콘은 "승인 통과 시 넘어갈 다음 단계"의 공유 STAGE_DEFS 참조 (단계 색과 일치시켜 혼선 방지)
        // 현업 승인: 검토 → 공람(2단계) / 공람 종료: 공람 → 최종수정(3단계)
        fieldApproveButton() {
            const def = getStageDef('public_feedback');
            return { label: def.label, color: def.vuetifyColor, icon: def.icon };
        },
        publicApproveButton() {
            const def = getStageDef('final_edit');
            return { label: def.label, color: def.vuetifyColor, icon: def.icon };
        },
        canApproveFieldAction() {
            return canApproveFieldReview(this.approvalState, {
                role: this.currentUserRole,
                userId: this.currentUserId,
                userName: this.currentUserName,
                employeeNo: this.currentUserEmployeeNo
            });
        },
        canEndPublicFeedbackAction() {
            return canEndPublicFeedbackReview(this.approvalState, {
                role: this.currentUserRole,
                userId: this.currentUserId,
                userName: this.currentUserName,
                employeeNo: this.currentUserEmployeeNo
            });
        },
        canRejectAction() {
            return canRejectReview(this.approvalState, {
                role: this.currentUserRole,
                userId: this.currentUserId,
                userName: this.currentUserName,
                employeeNo: this.currentUserEmployeeNo
            });
        },
        canPublishActionState() {
            return this.governanceStateKey === 'final_edit';
        },
        canPublishAction() {
            return (
                this.canPublishActionState &&
                canPublishReview(this.approvalState, {
                    role: this.currentUserRole,
                    userId: this.currentUserId,
                    userName: this.currentUserName,
                    employeeNo: this.currentUserEmployeeNo
                }) &&
                this.unresolvedFeedbackCount === 0
            );
        },
        canCommentAction() {
            return canCommentOnReview(this.currentUserRole, this.approvalState, {
                userId: this.currentUserId,
                userName: this.currentUserName,
                employeeNo: this.currentUserEmployeeNo
            });
        },
        canLeaveFeedback() {
            return !!this.definitionPath && (
                this.canCommentAction ||
                this.governanceStateKey === 'public_feedback' ||
                this.hasReviewContext
            );
        },
        publishActionDisabledReason() {
            if (!this.canPublishActionState) return '';
            if (
                !canPublishReview(this.approvalState, {
                    role: this.currentUserRole,
                    userId: this.currentUserId,
                    userName: this.currentUserName,
                    employeeNo: this.currentUserEmployeeNo
                })
            ) {
                return '배포 권한이 없습니다.';
            }
            if (this.unresolvedFeedbackCount > 0) {
                return `미해결 피드백 ${this.unresolvedFeedbackCount}건을 해결해야 배포할 수 있습니다.`;
            }
            return '';
        },
        governanceActionNotice() {
            if (!this.approvalState || this.isGovernanceFinished) return '';
            if (this.isSelfSubmitter) {
                return '본인이 상신한 리뷰 라운드는 직접 승인할 수 없습니다.';
            }
            if (!this.canApproveOrReject && ['in_review', 'review', 'public_feedback', 'final_edit'].includes(this.governanceStateKey)) {
                return '현재 역할로는 이 리뷰의 승인/반려를 처리할 수 없습니다.';
            }
            if (this.canEndPublicFeedbackAction) {
                return '공람을 조기 종료하면 즉시 최종수정 단계로 이동합니다.';
            }
            return '';
        },
        minorPatchDescription() {
            if (this.governanceStateKey === 'published') {
                return '현재 저장은 배포본을 바로 갈아엎지 않고 minor patch 검토 경로로 누적됩니다.';
            }
            if (['draft', 'in_review', 'public_feedback', 'final_edit'].includes(this.governanceStateKey)) {
                return `현재 ${this.governanceStateLabel} 사이클 안에서 변경분을 계속 축적합니다.`;
            }
            return '저장된 변경분은 minor draft로 누적되고 필요 시 검토 요청으로 이어집니다.';
        },
        majorUpgradeTitle() {
            if (this.canRequestMajorUpgrade) {
                return '배포본 유지 + 차기 v(N+1).0 초안 요청';
            }
            if (this.hasPendingMajorUpgrade) {
                return 'Master 승인 후 차기 major draft 생성 예정';
            }
            if (['draft', 'in_review', 'public_feedback', 'final_edit'].includes(this.governanceStateKey)) {
                return '이미 다음 변경 사이클 진행 중';
            }
            return '별도 major 경로 준비 필요';
        },
        majorUpgradeDescription() {
            if (this.canRequestMajorUpgrade) {
                return '정책 변경이나 구조 개편처럼 배포본과 분리된 큰 변경은 reopen 요청으로 분기해야 합니다.';
            }
            if (this.hasPendingMajorUpgrade) {
                return 'Review Board에서 승인되면 현재 배포본과 병렬로 차기 major 초안이 생성됩니다.';
            }
            if (['draft', 'in_review', 'public_feedback', 'final_edit'].includes(this.governanceStateKey)) {
                return '현재 프로세스는 이미 draft/review 파이프라인 안에 있습니다. 별도 major 요청보다 현재 사이클 완료가 우선입니다.';
            }
            return '거버넌스 상태가 확정되면 major upgrade 분기를 열 수 있습니다.';
        },
        // Timeline entries built from approvalHistory
        timelineEntries() {
            if (!this.approvalHistory || this.approvalHistory.length === 0) {
                // Show default pipeline from approvalState
                if (this.approvalState) {
                    return this.buildTimelineFromState();
                }
                return [];
            }
            const locale = window.$lang === 'ko' ? ko : enUS;
            // 백엔드가 created_at DESC 로 반환하므로 그대로 매핑 (최신이 상단)
            return this.approvalHistory.map((item, idx) => {
                let dateStr = '';
                try {
                    dateStr = formatDistanceToNow(toKst(item.created_at)?.toDate() ?? new Date(item.created_at), { addSuffix: true, locale });
                } catch { dateStr = item.created_at || ''; }

                const action = toSafeText(item.action).trim();
                const roleTag = this.getRoleTag(action, item);
                return {
                    title: this.getTimelineTitle(item),
                    actor: toSafeText(item.actor_name || item.actor_id),
                    date: dateStr,
                    color: STATE_COLORS[action] || '#9e9e9e',
                    roleTag: roleTag.label,
                    roleColor: roleTag.color,
                    isCurrent: idx === 0,
                };
            });
        },
        // Visible timeline (최신순, 초기 3건만)
        visibleTimelineEntries() {
            if (this.timelineExpanded) return this.timelineEntries;
            return this.timelineEntries.slice(0, 3);
        },
        hasMoreTimeline() {
            return this.timelineEntries.length > 3;
        },
        // Visible feedback (최상위 피드백만, 초기 5건만)
        topLevelFeedbackItems() {
            return (this.feedbackItems || []).filter((item) => !item.parent_comment_id);
        },
        visibleFeedbackItems() {
            if (this.feedbackExpanded) return this.topLevelFeedbackItems;
            return this.topLevelFeedbackItems.slice(0, 5);
        },
        hasMoreFeedback() {
            return this.topLevelFeedbackItems.length > 5;
        },
        // 루트(최상위) 피드백 ID별 후손 묶음 — DFS 순서 + depth 부여
        descendantsByRoot() {
            const all = this.feedbackItems || [];
            const childrenOf = new Map();
            all.forEach((c) => {
                const pid = toSafeText(c.parent_comment_id).trim();
                if (!pid) return;
                if (!childrenOf.has(pid)) childrenOf.set(pid, []);
                childrenOf.get(pid).push(c);
            });
            childrenOf.forEach((list) => {
                list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
            const map = {};
            const roots = all.filter((c) => !toSafeText(c.parent_comment_id).trim());
            roots.forEach((root) => {
                const result = [];
                const dfs = (parentId, depth) => {
                    const children = childrenOf.get(parentId) || [];
                    children.forEach((child) => {
                        result.push({ ...child, depth });
                        dfs(child.id, depth + 1);
                    });
                };
                dfs(root.id, 1);
                if (result.length > 0) map[root.id] = result;
            });
            return map;
        },
        taskCountSummary() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return { total: 0, items: [] };
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return { total: 0, items: [] };
                const typeMap = {};
                elementRegistry.filter(el => {
                    if (toSafeText(el.type).trim() === 'label') return false;
                    const bpmnType = toSafeText(el.businessObject?.$type || el.type).trim();
                    return isTaskLikeBpmnType(bpmnType);
                }).forEach(el => {
                    const bpmnType = toSafeText(el.businessObject?.$type || el.type || 'Unknown').trim() || 'Unknown';
                    typeMap[bpmnType] = (typeMap[bpmnType] || 0) + 1;
                });
                // Call Activity 하위 프로세스 subtree 집계도 동일 typeMap에 합산
                // (callActivityCards에서 dedup된 defId만 한 번씩 더해지며, 재귀/순환 차단은
                //  fetchAndAggregateCallActivityCounts의 ancestry Set이 처리한다.)
                (this.callActivityCards || []).forEach(card => {
                    if (card?.status !== 'loaded' || !card.defId) return;
                    const cached = this.callActivityDataCache[card.defId];
                    if (!cached || cached.status !== 'loaded') return;
                    for (const [type, count] of Object.entries(cached.counts || {})) {
                        typeMap[type] = (typeMap[type] || 0) + count;
                    }
                });
                return buildTaskCountItems(typeMap);
            } catch { return { total: 0, items: [] }; }
        },
        taskCountGrandTotal() {
            return this.taskCountSummary?.total || 0;
        },
        isTaskCountLoading() {
            return (this.callActivityCards || []).some((card) => card?.status === 'loading');
        },
        callActivityCards() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];
                const callActivityElements = elementRegistry.filter((el) => {
                    if (toSafeText(el.type).trim() === 'label') return false;
                    const bpmnType = toSafeText(el.businessObject?.$type || el.type).trim();
                    return bpmnType === 'bpmn:CallActivity';
                });
                const seenDefIds = new Set();
                const cards = [];
                const pendingFetchIds = [];
                for (const el of callActivityElements) {
                    const bo = el.businessObject;
                    let defId = '';
                    if (bo?.calledElement) {
                        defId = this.normalizeCallActivityDefinitionId(bo.calledElement);
                    }
                    if (!defId && Array.isArray(bo?.extensionElements?.values)) {
                        for (const ext of bo.extensionElements.values) {
                            if (ext?.json) {
                                try {
                                    const props = JSON.parse(ext.json);
                                    if (props?.definitionId) {
                                        defId = this.normalizeCallActivityDefinitionId(props.definitionId);
                                        break;
                                    }
                                } catch { /* ignore */ }
                            }
                        }
                    }
                    if (!defId || seenDefIds.has(defId)) continue;
                    seenDefIds.add(defId);
                    const elementName = toSafeText(bo?.name).trim();
                    const cached = this.callActivityDataCache[defId];
                    if (!cached) {
                        pendingFetchIds.push(defId);
                        cards.push({
                            defId,
                            elementName,
                            status: 'loading',
                            name: elementName || defId,
                            items: [],
                            total: 0,
                            error: null,
                        });
                    } else {
                        cards.push({
                            defId,
                            elementName,
                            status: cached.status,
                            name: cached.name || elementName || defId,
                            items: this.buildCallActivityCountItems(cached.counts || {}),
                            total: cached.total || 0,
                            error: cached.error || null,
                        });
                    }
                }
                if (pendingFetchIds.length > 0) {
                    setTimeout(() => {
                        pendingFetchIds.forEach((id) => this.ensureCallActivityData(id));
                    }, 0);
                }
                return cards;
            } catch { return []; }
        },
        // CallActivity 하위 프로세스(재귀 포함) task 들의 평탄화 목록.
        // 시스템/연관과제/FTE/비용 등 process 요약에 child 정의의 task 속성을 merge 할 때 사용.
        callActivityMergedTasks() {
            const tasks = [];
            const seen = new Set();
            (this.callActivityCards || []).forEach((card) => {
                if (card?.status !== 'loaded' || !card.defId) return;
                const cached = this.callActivityDataCache[card.defId];
                if (!cached || cached.status !== 'loaded') return;
                (cached.tasks || []).forEach((t) => {
                    if (!t || !t.id) return;
                    // 같은 정의가 여러 경로로 참조돼도 속성 표시는 한 번만
                    const key = `${card.defId}::${toSafeText(t.processName).trim()}::${t.id}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    tasks.push({ ...t, defId: card.defId, key });
                });
            });
            return tasks;
        },
        atdtRelatedProjectItems() {
            const selected = Array.isArray(this.taskForm.relatedProjects) ? this.taskForm.relatedProjects : [];
            const merged = [];
            const seenKeys = new Set();
            const pushUnique = (item) => {
                if (!item || !item.name) return;
                const key = item.id != null ? `id:${item.id}` : `name:${item.name}`;
                if (seenKeys.has(key)) return;
                seenKeys.add(key);
                merged.push(item);
            };
            selected.forEach(pushUnique);
            (this.atdtTaskList || []).forEach(pushUnique);
            return merged;
        },
        relatedProjectsSummary() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];
                const projectMap = {};
                elementRegistry.filter(el => {
                    const type = toSafeText(el.type).trim();
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                }).forEach(el => {
                    const bo = el.businessObject;
                    const uengineProps = this.readUengineProps(bo);
                    const projects = Array.isArray(uengineProps.relatedProjects) ? uengineProps.relatedProjects : [];
                    projects.forEach(p => {
                        let projectId = null;
                        let projectName = '';
                        if (typeof p === 'string') {
                            projectName = p;
                        } else if (p && typeof p === 'object') {
                            projectId = p.id ?? p.task_id ?? null;
                            projectName = p.name ?? p.title ?? '';
                        }
                        if (!projectName) return;
                        const mapKey = projectId != null ? `id:${projectId}` : `name:${projectName}`;
                        if (!projectMap[mapKey]) {
                            projectMap[mapKey] = { id: projectId, name: projectName, tasks: [] };
                        } else if (projectMap[mapKey].id == null && projectId != null) {
                            projectMap[mapKey].id = projectId;
                        }
                        projectMap[mapKey].tasks.push(bo?.name || el.id);
                    });
                });
                return Object.values(projectMap);
            } catch { return []; }
        },
        taskSystemSingle: {
            get() {
                const arr = this.taskForm.systems;
                return Array.isArray(arr) && arr.length ? arr[0] : null;
            },
            set(val) {
                this.taskForm.systems = val ? [val] : [];
            },
        },
        atdtSystemItems() {
            const byName = new Map();
            const consider = (item) => {
                if (!item || !item.name) return;
                const key = item.name.trim();
                if (!key) return;
                const existing = byName.get(key);
                if (!existing) {
                    byName.set(key, item);
                    return;
                }
                if ((item.id ?? null) != null && (existing.id ?? null) == null) {
                    byName.set(key, item);
                }
            };
            const current = this.taskSystemSingle;
            if (current) consider(current);
            (this.atdtSystemList || []).forEach(consider);
            return Array.from(byName.values());
        },
        systemsSummary() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];
                const systemMap = {};
                const collectSystems = (systems, taskRef) => {
                    (Array.isArray(systems) ? systems : []).forEach(s => {
                        let systemId = null;
                        let systemName = '';
                        if (typeof s === 'string') {
                            systemName = s;
                        } else if (s && typeof s === 'object') {
                            systemId = s.id ?? s.system_id ?? null;
                            systemName = s.name ?? s.system_name ?? '';
                        }
                        if (!systemName) return;
                        const mapKey = systemId != null ? `id:${systemId}` : `name:${systemName}`;
                        if (!systemMap[mapKey]) {
                            systemMap[mapKey] = { id: systemId, name: systemName, tasks: [] };
                        } else if (systemMap[mapKey].id == null && systemId != null) {
                            systemMap[mapKey].id = systemId;
                        }
                        systemMap[mapKey].tasks.push(taskRef);
                    });
                };
                elementRegistry.filter(el => {
                    const type = el.type || '';
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                }).forEach(el => {
                    const bo = el.businessObject;
                    const uengineProps = this.readUengineProps(bo);
                    collectSystems(uengineProps.systems, { id: el.id, name: bo?.name || el.id });
                });
                // CallActivity 하위 프로세스 task 에 매핑된 시스템도 merge
                this.callActivityMergedTasks.forEach(t => {
                    collectSystems(t.props?.systems, { id: t.key, name: this.callActivityTaskLabel(t) });
                });
                return Object.values(systemMap);
            } catch { return []; }
        },
        taskManualLinksSummary() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];
                const result = [];
                const normalizeLinks = (uengineProps) => {
                    const rawLinks = Array.isArray(uengineProps.manualLinks)
                        ? uengineProps.manualLinks
                        : (uengineProps.manualLink ? [uengineProps.manualLink] : []);
                    return rawLinks
                        .map((item) => {
                            if (item == null) return null;
                            if (typeof item === 'string') {
                                const url = item.trim();
                                return url ? { name: '', url } : null;
                            }
                            if (typeof item === 'object') {
                                const url = toSafeText(item.url ?? '').trim();
                                if (!url) return null;
                                const name = toSafeText(item.name ?? item.displayName ?? '').trim();
                                return { name, url };
                            }
                            return null;
                        })
                        .filter(Boolean);
                };
                elementRegistry.filter((el) => {
                    const type = el.type || '';
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                }).forEach((el) => {
                    const bo = el.businessObject;
                    const uengineProps = this.readUengineProps(bo);
                    const links = normalizeLinks(uengineProps);
                    if (links.length === 0) return;
                    result.push({
                        taskId: el.id,
                        taskName: bo?.name || el.id,
                        links
                    });
                });
                // CallActivity 하위 프로세스 task 에 등록된 링크도 merge
                this.callActivityMergedTasks.forEach((t) => {
                    const links = normalizeLinks(t.props || {});
                    if (links.length === 0) return;
                    result.push({
                        taskId: t.key,
                        taskName: this.callActivityTaskLabel(t),
                        links
                    });
                });
                return result;
            } catch { return []; }
        },
        taskManualLinksTotalCount() {
            return this.taskManualLinksSummary.reduce((acc, t) => acc + t.links.length, 0);
        },
        apiParamDeleteTarget() {
            const ref = this.apiParamDeleteRef;
            if (!ref) return null;
            const entry = (this.taskForm.apiIntegrations || [])[ref.entry];
            return (entry?.params || [])[ref.param] || null;
        },
        apiEntryDeleteTarget() {
            if (this.apiEntryDeleteIdx == null) return null;
            return (this.taskForm.apiIntegrations || [])[this.apiEntryDeleteIdx] || null;
        },
        taskApiIntegrationsSummary() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];
                // 같은 API(이름+메서드+URL)를 쓰는 태스크들을 API 기준으로 묶는다.
                const apiMap = new Map();
                const pushApis = (props, taskId, taskName) => {
                    readApiIntegrations(props).forEach((api) => {
                        const key = `${api.name}::${api.method}::${api.url}`;
                        if (!apiMap.has(key)) {
                            apiMap.set(key, { key, name: api.name, method: api.method, url: api.url, params: [], tasks: [] });
                        }
                        const bucket = apiMap.get(key);
                        (api.params || []).forEach((p) => {
                            if (!bucket.params.some((bp) => bp.key === p.key && bp.value === p.value)) bucket.params.push(p);
                        });
                        if (!bucket.tasks.some((t) => t.id === taskId)) bucket.tasks.push({ id: taskId, name: taskName });
                    });
                };
                elementRegistry.filter((el) => {
                    const type = el.type || '';
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                }).forEach((el) => {
                    const bo = el.businessObject;
                    pushApis(this.readUengineProps(bo), el.id, bo?.name || el.id);
                });
                // CallActivity 하위 프로세스 task 의 API 연동도 merge
                this.callActivityMergedTasks.forEach((t) => {
                    pushApis(t.props || {}, t.key, this.callActivityTaskLabel(t));
                });
                return Array.from(apiMap.values());
            } catch { return []; }
        },
        relatedProjectsByTask() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];

                // 레거시 데이터 (id 누락) 의 외부 링크 보강을 위해 atdtTaskList 에서 name → id 매핑 미리 구성
                // (atdt 목록 로드는 mounted() 에서 한 번만 트리거)
                const atdtIdByName = new Map();
                (this.atdtTaskList || []).forEach(t => {
                    if (t?.name && t.id != null && t.id !== '') {
                        atdtIdByName.set(String(t.name).trim(), t.id);
                    }
                });
                const resolveProjectId = (id, name) => {
                    if (id != null && id !== '') return id;
                    if (!name) return null;
                    return atdtIdByName.get(String(name).trim()) ?? null;
                };

                // groupId → { groupId, taskIds Set, taskNames Set, projectsMap Map<name, {id, name}> }
                const groupBuckets = new Map();
                // taskId → { taskId, taskName, projects[] (개별 매핑만) }
                const individualByTask = [];

                const collectTaskProjects = (rawProjects, taskId, taskName) => {
                    const individualProjects = [];

                    (Array.isArray(rawProjects) ? rawProjects : []).forEach(p => {
                        let projectId = null;
                        let projectName = '';
                        let groupId = null;
                        if (typeof p === 'string') {
                            projectName = p;
                        } else if (p && typeof p === 'object') {
                            projectId = p.id ?? p.task_id ?? null;
                            projectName = p.name ?? p.title ?? '';
                            groupId = p.groupId || null;
                        }
                        if (!projectName) return;
                        const resolvedId = resolveProjectId(projectId, projectName);

                        if (groupId) {
                            if (!groupBuckets.has(groupId)) {
                                groupBuckets.set(groupId, {
                                    groupId,
                                    taskIds: new Set(),
                                    taskNames: new Set(),
                                    projectsMap: new Map(),
                                });
                            }
                            const bucket = groupBuckets.get(groupId);
                            bucket.taskIds.add(taskId);
                            bucket.taskNames.add(taskName);
                            if (!bucket.projectsMap.has(projectName)) {
                                bucket.projectsMap.set(projectName, { id: resolvedId, name: projectName });
                            } else if (resolvedId != null && bucket.projectsMap.get(projectName).id == null) {
                                bucket.projectsMap.get(projectName).id = resolvedId;
                            }
                        } else {
                            individualProjects.push({ id: resolvedId, name: projectName });
                        }
                    });

                    if (individualProjects.length) {
                        individualByTask.push({
                            kind: 'individual',
                            taskId,
                            taskName,
                            projects: individualProjects,
                        });
                    }
                };

                elementRegistry.filter(el => {
                    const type = el.type || '';
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                }).forEach(el => {
                    const bo = el.businessObject;
                    const uengineProps = this.readUengineProps(bo);
                    collectTaskProjects(uengineProps.relatedProjects || [], el.id, bo?.name || el.id);
                });
                // CallActivity 하위 프로세스 task 에 매핑된 연관 과제도 merge
                this.callActivityMergedTasks.forEach(t => {
                    collectTaskProjects(t.props?.relatedProjects || [], t.key, this.callActivityTaskLabel(t));
                });

                // 그룹 카드 (멤버가 2개 이상인 진짜 그룹만 묶음, 1개뿐이면 individual 로 강등)
                const groupCards = [];
                for (const bucket of groupBuckets.values()) {
                    const projects = Array.from(bucket.projectsMap.values());
                    if (bucket.taskIds.size >= 2) {
                        groupCards.push({
                            kind: 'group',
                            groupId: bucket.groupId,
                            taskIds: Array.from(bucket.taskIds),
                            taskNames: Array.from(bucket.taskNames),
                            projects,
                        });
                    } else {
                        // 멤버 1개뿐인 그룹은 해당 Task 의 개별 카드에 합침
                        const onlyTaskId = Array.from(bucket.taskIds)[0];
                        const existingIndividual = individualByTask.find(c => c.taskId === onlyTaskId);
                        if (existingIndividual) {
                            existingIndividual.projects.push(...projects);
                        } else {
                            individualByTask.push({
                                kind: 'individual',
                                taskId: onlyTaskId,
                                taskName: Array.from(bucket.taskNames)[0] || onlyTaskId,
                                projects,
                            });
                        }
                    }
                }

                return [...groupCards, ...individualByTask];
            } catch { return []; }
        },
        commentGroupIndex() {
            // Maps groupId (or comment.id when no groupId) to [{ id, name }] of every element
            // that holds a comment with that key. Used to detect grouped (multi-task) PI flags.
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            const map = new Map();
            if (!modeler) return map;
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return map;
                elementRegistry.getAll().forEach(el => {
                    const bo = el.businessObject;
                    if (!bo) return;
                    const propsEl = bo.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
                    if (!propsEl?.json) return;
                    let uengineProps = {};
                    try { uengineProps = JSON.parse(propsEl.json); } catch { return; }
                    const comments = Array.isArray(uengineProps.comments) ? uengineProps.comments : [];
                    comments.forEach(c => {
                        if (!c) return;
                        const key = c.groupId || c.id;
                        if (!key) return;
                        if (!map.has(key)) map.set(key, []);
                        map.get(key).push({ id: el.id, name: bo.name || el.id });
                    });
                });
            } catch { /* ignore */ }
            return map;
        },
        piFlagEntries() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];

                // 묶음(여러 task 에 함께 등록된) 코멘트는 단일 task 밑에 숨지 않도록 별도 묶음 항목으로 분리.
                // 단일 task 코멘트는 task 별 항목으로. (연관과제 리스트와 동일한 group/individual 구조)
                const groupIndex = this.commentGroupIndex;
                // 그룹 키는 commentGroupIndex 와 동일하게 groupId || id (묶음이 groupId 없이
                // 같은 comment.id 로 복제 저장된 레거시 데이터까지 묶이도록)
                const groupKeyOf = (c) => c?.groupId || c?.id || null;
                const isGrouped = (c) => {
                    const key = groupKeyOf(c);
                    return !!(key && (groupIndex.get(key)?.length || 0) >= 2);
                };

                // groupId → { groupId, taskIds Set, taskNames Set, commentsMap Map<id, comment> }
                const groupBuckets = new Map();
                const individualByElement = [];

                elementRegistry.getAll().forEach(el => {
                    const bo = el.businessObject;
                    if (!bo) return;
                    const propsEl = bo.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
                    if (!propsEl?.json) return;
                    let uengineProps = {};
                    try { uengineProps = JSON.parse(propsEl.json); } catch { return; }
                    const comments = Array.isArray(uengineProps.comments) ? uengineProps.comments : [];
                    if (comments.length === 0) return;
                    const taskName = bo.name || el.id;
                    const individualComments = [];

                    comments.forEach(c => {
                        if (!c) return;
                        if (isGrouped(c)) {
                            const gid = groupKeyOf(c);
                            if (!groupBuckets.has(gid)) {
                                groupBuckets.set(gid, {
                                    groupId: gid,
                                    taskIds: new Set(),
                                    taskNames: new Set(),
                                    commentsMap: new Map(),
                                });
                            }
                            const bucket = groupBuckets.get(gid);
                            bucket.taskIds.add(el.id);
                            bucket.taskNames.add(taskName);
                            const cKey = c.id || gid;
                            if (!bucket.commentsMap.has(cKey)) bucket.commentsMap.set(cKey, c);
                        } else {
                            individualComments.push(c);
                        }
                    });

                    if (individualComments.length) {
                        individualByElement.push({
                            kind: 'individual',
                            elementId: el.id,
                            elementName: taskName,
                            comments: individualComments,
                        });
                    }
                });

                const groupCards = [];
                for (const bucket of groupBuckets.values()) {
                    groupCards.push({
                        kind: 'group',
                        groupId: bucket.groupId,
                        taskIds: Array.from(bucket.taskIds),
                        taskNames: Array.from(bucket.taskNames),
                        comments: Array.from(bucket.commentsMap.values()),
                    });
                }

                return [...groupCards, ...individualByElement];
            } catch { return []; }
        },
        // 깃발 클릭으로 전달된 코멘트 id 가 포함된 항목만 필터링 (없으면 전체)
        piFlagVisibleEntries() {
            if (!this.piFlagFocusCommentIds || !this.piFlagFocusCommentIds.size) return this.piFlagEntries;
            const focus = this.piFlagFocusCommentIds;
            return this.piFlagEntries.filter(entry =>
                (entry.comments || []).some(c => focus.has(c.id))
            );
        },
        piFlagFocused() {
            return !!(this.piFlagFocusCommentIds && this.piFlagFocusCommentIds.size);
        },
        piFlagTotalCount() {
            return this.piFlagVisibleEntries.reduce((acc, entry) => acc + entry.comments.length, 0);
        },
        piFlagResolvedCount() {
            return this.piFlagVisibleEntries.reduce(
                (acc, entry) => acc + entry.comments.filter(c => c.status === 'resolved').length,
                0
            );
        },
        piFlagOpenCount() {
            return this.piFlagVisibleEntries.reduce(
                (acc, entry) => acc + entry.comments.filter(c => c.status !== 'resolved').length,
                0
            );
        },
        // Agent 분석 결과 목록
        // 각 항목 스키마: { id, title, source, type, description, elementId? }
        piFlagAgentAnalysisEntries() {
            const gaps = this.anStudio?.gaps?.value || [];
            const globalEntries = Array.isArray(gaps)
                ? gaps.map((gap, index) => {
                      const category = String(gap?.category || 'PROCESS').toUpperCase();
                      const severity = String(gap?.severity || 'medium').toLowerCase();
                      const triage = String(gap?.triage || 'pending').toLowerCase();
                      return {
                          id: gap?.id || `gap-${index}`,
                          title: toSafeText(gap?.title || '제목 없는 Gap'),
                          source: 'Global Gap Analysis',
                          type: GAP_CATEGORY_LABELS[category] || category,
                          partitionName: toSafeText(gap?.partition_name || ''),
                          description: toSafeText(gap?.description || gap?.recommendation || ''),
                          elementId: Array.isArray(gap?.element_ids) && gap.element_ids.length === 1 ? gap.element_ids[0] : null,
                          severity: GAP_SEVERITY_LABELS[severity] || severity,
                          triage: GAP_TRIAGE_LABELS[triage] || triage,
                      };
                  })
                : [];

            // Copilot 의 /gap 명령으로 생성된 PI Flag (BPMN 요소 코멘트, source: 'ai-gap')도
            // Agent 분석 탭에 노출한다. (생성 직후 focusPiFlagAgent 로 이 탭으로 이동하므로)
            const aiGapEntries = [];
            for (const entry of this.piFlagEntries) {
                const elementId = entry.kind === 'group' ? (entry.taskIds?.[0] || null) : entry.elementId;
                const elementName = entry.kind === 'group'
                    ? (entry.taskNames || []).join(', ')
                    : entry.elementName;
                for (const c of (entry.comments || [])) {
                    if (!c || c.source !== 'ai-gap') continue;
                    const problem = toSafeText(c.problem || c.description || '');
                    const improvement = toSafeText(c.improvement || '');
                    aiGapEntries.push({
                        id: `ai-gap:${c.id}`,
                        title: toSafeText(c.title || elementName || 'AI Gap'),
                        source: 'AI Gap 진단',
                        type: c.category || c.type || '-',
                        partitionName: '',
                        description: improvement ? `${problem}\n개선방향: ${improvement}` : problem,
                        elementId,
                        severity: '-',
                        triage: c.status === 'resolved' ? '즉시 개선' : '향후 과제',
                    });
                }
            }

            return [...aiGapEntries, ...globalEntries];
        },
        // Agent 분석 탭의 AI 챗 컨텍스트로 전달할 PI Flag 평탄화 목록 ({ task, status, type, description })
        piFlagChatFlags() {
            const flags = [];
            for (const entry of this.piFlagEntries) {
                const task = entry.kind === 'group'
                    ? (entry.taskNames || []).join(', ')
                    : (entry.elementName || '');
                for (const c of (entry.comments || [])) {
                    if (!c) continue;
                    flags.push({
                        task,
                        status: c.status === 'resolved' ? '즉시 개선' : '향후 과제',
                        type: c.type || '',
                        description: toSafeText(c.description || ''),
                    });
                }
            }
            return flags;
        },
        // Agent 분석 탭 추천 질문 (PI Flag 기반)
        piFlagChatSuggestions() {
            return [
                '등록된 PI Flag를 핵심만 요약해줘',
                '가장 시급한 개선 과제는 무엇이야?',
                '즉시 개선 항목과 향후 과제로 분류해줘',
                '개선 우선순위와 기대 효과를 제안해줘',
            ];
        },
        totalFteSummary() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return { totalFte: '', totalHours: '', items: [] };
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return { totalFte: '', totalHours: '', items: [] };
                const items = [];
                let totalHours = 0;
                elementRegistry.filter(el => {
                    const type = toSafeText(el.type).trim();
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                }).forEach(el => {
                    const bo = el.businessObject;
                    const uengineProps = this.readUengineProps(bo);
                    const fte = uengineProps.fte;
                    const fteVal = calcFte(fte);
                    const hours = uengineProps.fteHoursPerMonth || 0;
                    if (fteVal || hours) {
                        items.push({
                            name: toSafeText(bo?.name || el.id),
                            fte: fteVal,
                            hours,
                        });
                    }
                    totalHours += hours;
                });
                // CallActivity 하위 프로세스 task 의 FTE 도 merge
                this.callActivityMergedTasks.forEach(t => {
                    const fteVal = calcFte(t.props?.fte);
                    const hours = t.props?.fteHoursPerMonth || 0;
                    if (fteVal || hours) {
                        items.push({
                            name: this.callActivityTaskLabel(t),
                            fte: fteVal,
                            hours,
                        });
                    }
                    totalHours += hours;
                });
                const totalFte = items.reduce((sum, i) => sum + (parseFloat(i.fte) || 0), 0);
                return {
                    totalFte: totalFte > 0 ? totalFte.toFixed(3) : '',
                    totalHours: totalHours > 0 ? totalHours : '',
                    items,
                };
            } catch { return { totalFte: '', totalHours: '', items: [] }; }
        },
        totalCostSummary() {
            void this.bpmnDataVersion;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            const empty = { totalAnnualHours: 0, totalFte: '', internalItems: [], externalItems: [], totalOpex: 0 };
            if (!modeler) return empty;
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return empty;

                const parseLaneProps = (laneBo) => {
                    if (!laneBo?.extensionElements?.values) return {};
                    const propEl = laneBo.extensionElements.values.find(v => v.$type === 'uengine:Properties') || laneBo.extensionElements.values[0];
                    if (!propEl?.json) return {};
                    try { return JSON.parse(propEl.json); } catch { return {}; }
                };

                const getLaneResourceType = (taskEl) => {
                    let parent = taskEl.parent;
                    while (parent) {
                        if (parent.type === 'bpmn:Lane') {
                            const lp = parseLaneProps(parent.businessObject);
                            if (lp.laneResourceType) return lp.laneResourceType;
                        }
                        if (parent.type === 'bpmn:Participant') break;
                        parent = parent.parent;
                    }
                    const bo = taskEl.businessObject;
                    const process = bo?.$parent;
                    if (process?.laneSets) {
                        for (const ls of process.laneSets) {
                            for (const lane of (ls.lanes || [])) {
                                if (lane.flowNodeRef?.some(ref => ref.id === bo.id || ref === bo)) {
                                    const lp = parseLaneProps(lane);
                                    if (lp.laneResourceType) return lp.laneResourceType;
                                }
                            }
                        }
                    }
                    return 'internal';
                };

                const internalItems = [];
                const externalItems = [];
                let totalAnnualHours = 0;
                let totalOpex = 0;

                const accumulateCost = (uengineProps, resType, name) => {
                    if (resType === 'external' || resType === 'family') {
                        const cost = uengineProps.opexCost || 0;
                        const unit = uengineProps.opexUnit || '';
                        if (cost > 0) {
                            externalItems.push({
                                name,
                                cost,
                                unit: toSafeText(unit),
                            });
                            totalOpex += cost;
                        }
                    } else {
                        const fte = uengineProps.fte;
                        const annualHours = calcAnnualHours(fte);
                        const fteVal = calcFte(fte);
                        if (annualHours > 0) {
                            internalItems.push({
                                name,
                                annualHours: Math.round(annualHours * 100) / 100,
                                fte: fteVal,
                            });
                            totalAnnualHours += annualHours;
                        }
                    }
                };

                elementRegistry.filter(el => {
                    const type = toSafeText(el.type).trim();
                    return type.includes('Task') || type === 'bpmn:CallActivity' || type === 'bpmn:SubProcess';
                }).forEach(el => {
                    const bo = el.businessObject;
                    let uengineProps = {};
                    if (bo?.extensionElements?.values) {
                        const propEl = bo.extensionElements.values.find(v => v.$type === 'uengine:Properties') || bo.extensionElements.values[0];
                        if (propEl?.json) {
                            try { uengineProps = JSON.parse(propEl.json); } catch { /* ignore */ }
                        }
                    }
                    const resType = getLaneResourceType(el);
                    accumulateCost(uengineProps, resType, toSafeText(bo?.name || el.id));
                });
                // CallActivity 하위 프로세스 task 의 비용도 merge (lane resourceType 은 child 정의에서 파싱됨)
                this.callActivityMergedTasks.forEach(t => {
                    accumulateCost(t.props || {}, t.resourceType || 'internal', this.callActivityTaskLabel(t));
                });
                return {
                    totalAnnualHours: Math.round(totalAnnualHours * 100) / 100,
                    totalMonthlyHours: Math.round((totalAnnualHours / 12) * 100) / 100,
                    totalFte: totalAnnualHours > 0 ? (totalAnnualHours / ANNUAL_WORKING_HOURS).toFixed(3) : '',
                    internalItems,
                    externalItems,
                    totalOpex,
                    hasData: internalItems.length > 0 || externalItems.length > 0,
                };
            } catch { return empty; }
        },
        // Available BPMN tasks from element registry
        availableTasks() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return [];
            try {
                const elementRegistry = modeler.get('elementRegistry');
                if (!elementRegistry) return [];
                return elementRegistry.filter(el => {
                    const type = toSafeText(el.type).trim();
                    return type.includes('Task') || type.includes('Activity');
                }).map(el => ({
                    id: toSafeText(el.id).trim(),
                    name: toSafeText(el.businessObject?.name || el.id),
                    type: toSafeText(el.type).trim(),
                }));
            } catch { return []; }
        },
        filteredMentionTasks() {
            const q = (this.mentionQuery || '').toLowerCase();
            if (!q) return this.availableTasks;
            return this.availableTasks.filter(t =>
                toSafeText(t.name).toLowerCase().includes(q) || toSafeText(t.id).toLowerCase().includes(q)
            );
        },
        // Feedback items from comments (all, including replies)
        feedbackItems() {
            if (!this.comments || this.comments.length === 0) return [];
            const byId = new Map();
            (this.comments || []).forEach((c) => {
                const id = toSafeText(c.id).trim();
                if (id) byId.set(id, c);
            });
            const formatKoreanDT = (iso) => {
                if (!iso) return '';
                return formatKST(iso, 'YYYY.MM.DD HH:mm', toSafeText(iso));
            };
            return this.comments
                .map(c => {
                    const relativeTime = formatKoreanDT(c.created_at);
                    const resolvedRelativeTime = c.resolved_at ? formatKoreanDT(c.resolved_at) : '';

                    const role = toSafeText(c.reviewer_type).trim();
                    const parentId = toSafeText(c.parent_comment_id).trim();
                    const directParent = parentId ? byId.get(parentId) : null;
                    return {
                        ...c,
                        id: toSafeText(c.id || c.created_at || c.content).trim(),
                        author_name: toSafeText(c.author_name),
                        content: toSafeText(c.content),
                        element_id: toSafeText(c.element_id).trim(),
                        element_name: toSafeText(c.element_name),
                        element_type: toSafeText(c.element_type).trim(),
                        relativeTime,
                        resolvedRelativeTime,
                        replyToContent: toSafeText(directParent?.content || ''),
                        replyToAuthor: toSafeText(directParent?.author_name || ''),
                        authorColor: role === 'hq' ? ROLE_COLORS.hq : role === 'field' ? ROLE_COLORS.field : role === 'owner' ? ROLE_COLORS.owner : ROLE_COLORS.default,
                        roleTag: role === 'hq' ? '본사' : role === 'field' ? '현업' : role === 'owner' ? '상신자' : role === 'public' ? '공람' : (role || null),
                    };
                });
        },
    },
    watch: {
        // 저장된 laneRoleGroupIds 가 있는데 selectedList 가 비어있으면
        // (옵션이 늦게 로드된 경우) 다시 sync + 멤버 재계산 (최신 그룹 정의 반영)
        laneRoleGroupOptions(newOpts) {
            if (!Array.isArray(this.laneRoleGroupIds) || !this.laneRoleGroupIds.length) return;
            const wasEmpty = !Array.isArray(this.laneRoleGroupSelectedList) || !this.laneRoleGroupSelectedList.length;
            if (wasEmpty) {
                this.laneRoleGroupSelectedList = this.laneRoleGroupIds
                    .map((id) => newOpts.find((o) => o.id === id))
                    .filter(Boolean);
            }
            // 옵션 갱신 (admin 에서 멤버 추가/제거된 경우 포함) → laneOrganization/laneSupplier 재계산
            if (this.laneRoleGroupSelectedList.length) {
                this.refreshLaneRoleGroupOrgs();
            }
        },
        focusCommentSection(val) {
            if (!val) return;
            this.topTab = 'properties';
            this.activeTab = 'task';
            this.$nextTick(() => {
                if (!this.isOpen('element-comments')) {
                    this.toggle('element-comments');
                }
                this.$nextTick(() => {
                    this.$refs.commentSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
                this.$emit('commentSectionFocused');
            });
        },
        focusPiFlagAgentSection(val) {
            if (!val) return;
            this.topTab = 'properties';
            this.activeTab = 'pi-flag';
            this.piFlagSubTab = 'agent-analysis';
            this.piFlagFocusCommentIds = null;
            this.$nextTick(() => {
                this.$emit('piFlagAgentSectionFocused');
            });
        },
        focusTaskMappingSection(val) {
            if (!val) return;
            this.topTab = 'properties';
            this.activeTab = 'task';
            // 새 멀티모드 진입 시 폼 초기화
            this.multiTaskMappingForm.relatedProjects = [];
            this.$nextTick(() => {
                if (!this.isOpen('task-related-projects')) {
                    this.toggle('task-related-projects');
                }
                this.$nextTick(() => {
                    this.$refs.taskMappingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
                this.$emit('taskMappingSectionFocused');
            });
        },
        initialTopTab: {
            handler(val) {
                if (val === 'governance') {
                    this.topTab = 'governance';
                } else if (val === 'properties' || val === 'ai-guide') {
                    this.topTab = 'properties';
                }
            },
            immediate: true,
        },
        topTab(val) {
            this.$emit('update:topTab', val);
        },
        processDefinition: {
            handler(val) {
                if (val) {
                    this.processForm.title = toSafeText(val.name);
                    this.processForm.description = toSafeText(val.definition?.description ?? val.description);
                    this.processForm.owner = toSafeText(val.owner).trim();
                    this.processForm.systems = this.normalizeStringList(val.systems);
                    if (val.fte) {
                        this.processForm.fte = { ...defaultFte(), ...val.fte };
                    }
                    // New strategic fields
                    this.processForm.futureState = toSafeText(val.futureState || val.future_state || 'as_is') || 'as_is';
                    this.processForm.wilTask = toSafeText(val.wilTask || val.wil_task);
                    this.processForm.fteHoursPerMonth = val.fteHoursPerMonth ?? val.fte_hours_per_month ?? null;
                    this.processForm.hitlRequired = val.hitlRequired ?? val.hitl_required ?? false;
                    const manualLinksSource = val.manualLinks
                        ?? val.manual_links
                        ?? val.definition?.manualLinks
                        ?? val.definition?.manual_links;
                    const legacyManualLink = val.manualLink
                        ?? val.manual_link
                        ?? val.definition?.manualLink
                        ?? val.definition?.manual_link;
                    const rawManualLinks = Array.isArray(manualLinksSource)
                        ? manualLinksSource
                        : (legacyManualLink ? [legacyManualLink] : []);
                    this.processForm.manualLinks = rawManualLinks
                        .map((item) => {
                            if (item == null) return null;
                            if (typeof item === 'string') {
                                const url = item.trim();
                                return url ? { name: '', url } : null;
                            }
                            if (typeof item === 'object') {
                                const url = toSafeText(item.url ?? '').trim();
                                if (!url) return null;
                                const name = toSafeText(item.name ?? item.displayName ?? '').trim();
                                return { name, url };
                            }
                            return null;
                        })
                        .filter(Boolean);
                    this.processForm.kpiEnabled = val.kpiEnabled ?? val.kpi_enabled ?? false;
                    this.resolveOwnerInfo(val.owner);
                    // Load proc_def owners for governance
                    const metaOwners = val.definition?.meta?.owners || {};
                    this.procDefOwners = {
                        fieldOwners: this.normalizeOwnerList(metaOwners.fieldOwners),
                        hqOwners: this.normalizeOwnerList(metaOwners.hqOwners),
                        masterOwner: toSafeText(metaOwners.masterOwner).trim() || null
                    };
                    this.resolveOwnerNames();
                    this.applyProcessSchemaFieldsFromDefinition(val.definition || val);
                    this.loadProcessParentRefs();
                } else {
                    this.processParentRefs = [];
                }
            },
            immediate: true,
        },
        callActivityDefinitionId: {
            handler() {
                this.loadCallActivityParentRefs();
            },
            immediate: true,
        },
        processFields: {
            handler(newFields) {
                if (newFields && newFields.length && this.processDefinition) {
                    this.applyProcessSchemaFieldsFromDefinition(this.processDefinition.definition || this.processDefinition);
                }
            },
            immediate: false,
        },
        element(val, oldVal) {
            if (oldVal && this.taskFormDirty) {
                if (!window.confirm('저장되지 않은 내용이 있습니다. 떠나시겠습니까?')) {
                    return;
                }
            }
            this.activeElement = val;
            if (val) {
                this.bindBpmnElementChangedHandler();
                this.activeTab = 'task';
                this.loadTaskProperties(val);
            } else {
                this.activeTab = 'process';
            }
        },
        parentHierarchy: {
            handler(val) {
                this.selectedMegaId = val?.megaId || null;
                this.selectedMajorId = val?.majorId || null;
                this.parentForm.domainId = val?.domainId || null;
                this.parentForm.megaId = val?.megaId || null;
                this.parentForm.majorId = val?.majorId || null;
            },
            immediate: true,
        },
        taskForm: {
            handler() {
                if (!this._taskFormLoading) this.taskFormDirty = true;
            },
            deep: true,
            flush: 'sync'
        },
        definitionPath: {
            handler(val) {
                if (val) {
                    this.timelineExpanded = false;
                    this.feedbackExpanded = false;
                    this.loadGovernanceData(val);
                }
            },
            immediate: true,
        },
        definition: {
            handler() {
                this.bpmnDataVersion++;
            },
        },
        isViewMode: {
            handler() {
                this.bpmnDataVersion++;
            },
        },
    },
    async mounted() {
        await this.ensureCurrentUser();
        await this.catalogStore.loadSchemas();
        this.refreshPiFlagTypeOptions();
        this._piFlagTypesChangeHandler = () => this.refreshPiFlagTypeOptions();
        window.addEventListener(PI_FLAG_TYPES_CHANGE_EVENT, this._piFlagTypesChangeHandler);
        // 읽기 모드 연관과제 리스트 항목도 외부 링크 이동 가능하도록 atdt task list 미리 로드
        // (id 가 누락된 레거시 항목은 name 기준으로 id 매칭)
        this.loadAtdtTaskList();
        this.loadLaneRoleGroups();
        this.loadLaneOrgDmn();
        this.bindBpmnElementChangedHandler();

        // KPI 목표를 store 에 로드 — 새 탭으로 진입한 경우(예: KPI 목표 페이지의 프로세스 chip 클릭)
        // pinia 저장소가 초기화된 상태라 담당자 섹션의 "KPI 지정" 항목이 비어보이는 문제 방지
        try {
            const adminStore = useAdminConsoleStore();
            if (!Array.isArray(adminStore.kpiTargets) || adminStore.kpiTargets.length === 0) {
                await adminStore.fetchKpiTargets(new Date().getFullYear());
            }
        } catch (e) {
            console.warn('[ProcessHierarchyProperties] fetchKpiTargets on mount failed:', e);
        }

        // 패널 오픈 시 컴포넌트가 새로 마운트되는데 element watcher 는 non-immediate 라
        // 최초 선택 요소가 반영되지 않아 process 탭이 먼저 뜨는 문제 → 마운트 시 초기 요소를 직접 반영
        if (this.element) {
            this.activeElement = this.element;
            this.activeTab = 'task';
            this.loadTaskProperties(this.element);
        }
    },
    beforeUnmount() {
        this.unbindBpmnElementChangedHandler();
        if (this._piFlagTypesChangeHandler) {
            window.removeEventListener(PI_FLAG_TYPES_CHANGE_EVENT, this._piFlagTypesChangeHandler);
            this._piFlagTypesChangeHandler = null;
        }
    },
    methods: {
        /**
         * 외부(AI 생성 등)에서 프로세스 관련자료 링크(processForm.manualLinks)를 병합 추가한다.
         * url 기준 중복 제거. 저장 시 processForm.manualLinks가 정의에 반영된다.
         * 주의: watch 블록에 두면 메서드로 노출되지 않아 $refs 호출이 조용히 무시된다.
         */
        addProcessManualLinks(links) {
            if (!Array.isArray(links) || links.length === 0) return;
            const existing = Array.isArray(this.processForm.manualLinks) ? this.processForm.manualLinks : [];
            const seen = new Set(
                existing
                    .map((l) => (typeof l === 'string' ? l : l?.url))
                    .filter(Boolean)
                    .map((u) => String(u).trim())
            );
            const merged = [...existing];
            links.forEach((link) => {
                const url = String(link?.url || '').trim();
                if (!url || seen.has(url)) return;
                seen.add(url);
                merged.push({ name: String(link?.name || '').trim(), url });
            });
            if (merged.length === existing.length) return;
            this.processForm.manualLinks = merged;
            // 자동 등록을 사용자가 인지할 수 있도록 관련자료 링크 섹션을 펼친다
            if (!this.isOpen('manual-link')) this.toggle('manual-link');
        },
        async copyElementId() {
            const id = this.elementDisplayId;
            if (!id) return;
            try {
                await navigator.clipboard.writeText(id);
                this.$toast?.success(`복사됨: ${id}`);
            } catch (e) {
                this.$toast?.error('클립보드 복사에 실패했습니다.');
            }
        },
        openReviewGuide(tab) {
            if (this.reviewGuideTab === tab) {
                this.reviewGuideTab = null;
                return;
            }
            // Center window on first open
            if (!this.reviewGuideTab) {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                this.guideWindowPos = {
                    x: Math.max(40, Math.round((vw - this.guideWindowSize.w) / 2)),
                    y: Math.max(40, Math.round((vh - this.guideWindowSize.h) / 2)),
                };
            }
            this.reviewGuideTab = tab;
        },
        switchReviewGuide(tab) {
            this.reviewGuideTab = tab;
        },
        startDragGuideWindow(e) {
            if (e.button !== 0) return;
            const startX = e.clientX - this.guideWindowPos.x;
            const startY = e.clientY - this.guideWindowPos.y;
            const onMove = (ev) => {
                this.guideWindowPos = {
                    x: Math.max(0, ev.clientX - startX),
                    y: Math.max(0, ev.clientY - startY),
                };
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        },
        startResizeGuideWindow(e) {
            if (e.button !== 0) return;
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = this.guideWindowSize.w;
            const startH = this.guideWindowSize.h;
            const onMove = (ev) => {
                this.guideWindowSize = {
                    w: Math.max(320, startW + (ev.clientX - startX)),
                    h: Math.max(300, startH + (ev.clientY - startY)),
                };
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        },
        async refreshPiFlagTypeOptions() {
            try {
                this.piFlagTypeOptions = await getActivePiFlagTypeLabels();
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] PI Flag 유형 조회 실패:', e);
            }
        },
        collectLaneTasks(laneBo) {
            const refs = Array.isArray(laneBo?.flowNodeRef) ? laneBo.flowNodeRef : [];
            const tasks = [];
            for (const ref of refs) {
                if (!ref) continue;
                const id = toSafeText(ref.id || '');
                if (!id) continue;
                const name = toSafeText(ref.name || id);
                const type = toSafeText(ref.$type || '');
                let description = '';
                try {
                    const ext = ref.extensionElements?.values || ref.extensionElements?.$children || [];
                    for (const v of ext) {
                        const vType = v?.$type || v?.type || '';
                        const isUengineProps = typeof vType === 'string' && vType.toLowerCase().includes('properties');
                        if (isUengineProps && typeof v.json === 'string') {
                            const props = JSON.parse(v.json || '{}');
                            description = toSafeText(props?.instruction || props?.description || '');
                            break;
                        }
                    }
                } catch { /* ignore */ }
                tasks.push({ id, name, type, description });
            }
            return tasks;
        },
        triggerGenerateLaneDescription() {
            if (this.isViewMode || this.laneDescriptionGenerating) return;
            if (toSafeText(this.laneDescription).trim()) {
                this.laneDescriptionConfirmDialog = true;
                return;
            }
            this.runGenerateLaneDescription();
        },
        async resolveCurrentBpmnXmlForCopilot() {
            const bpmnStore = useBpmnStore();
            const modeler = bpmnStore.getModeler;
            if (modeler && typeof modeler.saveXML === 'function') {
                try {
                    const result = await modeler.saveXML({ format: true, preamble: true });
                    if (typeof result === 'string') return result;
                    if (result?.xml) return result.xml;
                } catch (error) {
                    console.warn('[ProcessHierarchyProperties] Failed to export current BPMN XML:', error);
                }
            }
            return this.processDefinition?.bpmn || '';
        },
        async runGenerateLaneDescription() {
            if (this.laneDescriptionGenerating) return;
            if (!this.isLaneElement || !this.element) {
                this.$toast?.warning('Lane 이 선택되어 있어야 합니다.');
                return;
            }
            this.laneDescriptionConfirmDialog = false;

            const laneBo = this.element.businessObject;
            const laneName = toSafeText(laneBo?.name || this.taskForm?.name || '');
            const laneTasks = this.collectLaneTasks(laneBo);
            if (!laneTasks.length) {
                this.$toast?.warning('이 lane 안에 task 가 없어 설명을 생성할 수 없습니다.');
                return;
            }

            const tasksText = laneTasks
                .map((t, i) => {
                    const name = toSafeText(t?.name || t?.id || '');
                    const desc = toSafeText(t?.description || t?.instruction || '');
                    return desc ? `${i + 1}. ${name} - ${desc}` : `${i + 1}. ${name}`;
                })
                .join('\n');

            this.laneDescriptionGenerating = true;
            const bpmnXml = await this.resolveCurrentBpmnXmlForCopilot();
            if (!bpmnXml) {
                this.laneDescriptionGenerating = false;
                this.$toast?.error('현재 BPMN XML을 찾을 수 없습니다.');
                return;
            }

            const nextQuestion = [
                '다음은 BPMN 프로세스 안의 한 lane 에 대한 질문입니다.',
                'eTOM 25 RAG 지식과 별도 XML 필드로 전달되는 BPMN XML을 함께 참고해 주세요.',
                '',
                `프로세스 ID: ${toSafeText(this.processDefinition?.id || this.definitionPath || '')}`,
                `프로세스 이름: ${toSafeText(this.processDefinition?.name || '')}`,
                `Lane 이름: ${laneName || '(이름 없음)'}`,
                'Lane 안에 포함된 task 목록:',
                tasksText || '(task 없음)',
                '',
                '이 lane 이 담당하는 업무를 한국어로 1~2문장 길이로 간결하게 요약해 주세요.',
                'task 이름을 그대로 나열하지 말고, 업무의 의미·역할 중심으로 작성해 주세요.',
                '결과는 요약 문장만 출력해 주세요. 불필요한 머리말·꼬리말·설명은 제외합니다.'
            ].join('\n');

            try {
                const response = await backend.qdrantChat({
                    message: nextQuestion,
                    xml: bpmnXml
                });

                const summary = toSafeText(response?.answer || '').trim();
                if (!summary) {
                    this.$toast?.warning('AI 응답이 비어 있어 설명을 갱신하지 못했습니다.');
                    return;
                }
                this.laneDescription = summary;
                this.$toast?.success('AI 가 lane 설명을 생성했습니다.');
            } catch (e) {
                console.error('[lane description AI]', e);
                this.$toast?.error(e?.detail || e?.message || 'AI 설명 생성에 실패했습니다.');
            } finally {
                this.laneDescriptionGenerating = false;
            }
        },
        displayText(value) {
            return toSafeText(value);
        },
        displayColor(value, fallback = 'grey') {
            return toSafeText(value).trim() || fallback;
        },
        ownerKey(owner, index, prefix = 'owner') {
            return `${prefix}-${toSafeText(owner).trim() || index}`;
        },
        summaryItemKey(item, index, prefix = 'item') {
            const text = typeof item === 'object' && item !== null
                ? toSafeText(item.name || item.id || item.value)
                : toSafeText(item);
            return `${prefix}-${text.trim() || index}`;
        },
        timelineKey(entry, index) {
            return `timeline-${toSafeText(entry?.title || entry?.date || entry?.actor).trim() || index}`;
        },
        feedbackKey(fb, index) {
            return `feedback-${toSafeText(fb?.id || fb?.created_at || fb?.content).trim() || index}`;
        },
        normalizeStringList(value) {
            const list = Array.isArray(value) ? value : (value ? [value] : []);
            return list.map(item => toSafeText(item).trim()).filter(Boolean);
        },
        systemItemValue(item) {
            if (!item) return '';
            if (item.id != null) return `id:${item.id}`;
            if (item.name) return `name:${item.name}`;
            return '';
        },
        normalizeSystemList(value) {
            const list = Array.isArray(value) ? value : (value ? [value] : []);
            return list
                .map(item => {
                    if (item == null) return null;
                    if (typeof item === 'string') {
                        const name = item.trim();
                        return name ? { id: null, name } : null;
                    }
                    if (typeof item === 'object') {
                        const id = item.id ?? item.system_id ?? null;
                        const name = toSafeText(item.name ?? item.system_name ?? '').trim();
                        if (!id && !name) return null;
                        return { id: id ?? null, name };
                    }
                    return null;
                })
                .filter(Boolean);
        },
        normalizeOwnerList(value) {
            const list = Array.isArray(value) ? value : (value ? [value] : []);
            return list.map(item => {
                if (item && typeof item === 'object') {
                    return toSafeText(item.email || item.employee_no || item.user_id || item.id || item.name).trim();
                }
                return toSafeText(item).trim();
            }).filter(Boolean);
        },
        normalizeSelectItems(items) {
            const list = Array.isArray(items) ? items : [];
            return list
                .map((item, index) => {
                    if (item && typeof item === 'object') {
                        const value = toSafeText(item.value ?? item.id ?? item.key ?? item.code ?? item.name ?? item.label ?? index).trim();
                        const label = toSafeText(item.label ?? item.title ?? item.name ?? item.text ?? item.displayName ?? value).trim();
                        if (!value && !label) return null;
                        return {
                            ...item,
                            value: value || label,
                            label: label || value,
                        };
                    }
                    const text = toSafeText(item).trim();
                    return text ? { label: text, value: text } : null;
                })
                .filter(Boolean);
        },
        normalizeSchemaFields(fields) {
            const list = Array.isArray(fields) ? fields : [];
            return list
                .map((field, index) => this.normalizeSchemaField(field, index))
                .filter(Boolean);
        },
        collectDeprecatedSchemaFieldsWithValue(target, elementType) {
            const deprecatedList = this.catalogStore.deprecatedSchemasByAppliesTo(target, elementType) || [];
            if (!deprecatedList.length) return [];
            const normalized = this.normalizeSchemaFields(deprecatedList);
            return normalized
                .filter((field) => this.hasDeprecatedFieldValue(field, target))
                .map((field) => ({
                    ...field,
                    is_readonly: true,
                    is_required: false,
                    is_deprecated_field: true,
                }));
        },
        hasDeprecatedFieldValue(field, target) {
            if (!field) return false;
            const key = field.property_key;
            if (target === 'process') {
                if (field.property_type === 'daterange') {
                    const startVal = this.processForm?.[key + '_start'];
                    const endVal = this.processForm?.[key + '_end'];
                    return this.isNonEmptyFormValue(startVal) || this.isNonEmptyFormValue(endVal);
                }
                return this.isNonEmptyFormValue(this.processForm?.[key]);
            }
            if (target === 'task') {
                const props = this.taskForm?.schemaProps || {};
                if (field.property_type === 'daterange') {
                    return this.isNonEmptyFormValue(props[key + '_start']) || this.isNonEmptyFormValue(props[key + '_end']);
                }
                return this.isNonEmptyFormValue(props[key]);
            }
            return false;
        },
        isNonEmptyFormValue(value) {
            if (value === null || value === undefined) return false;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'string') return value.trim() !== '';
            return true;
        },
        normalizeSchemaField(field, index) {
            if (!field || typeof field !== 'object') return null;
            const propertyKey = toSafeText(field.property_key || field.key || field.id || `field_${index}`).trim();
            if (!propertyKey) return null;
            const id = toSafeText(field.id || propertyKey || `field_${index}`).trim() || `field_${index}`;
            const propertyType = toSafeText(field.property_type || 'string').trim() || 'string';
            const label = toSafeText(field.property_label || field.label || propertyKey).trim() || propertyKey;
            const normalized = {
                ...field,
                id,
                property_key: propertyKey,
                property_label: label,
                property_type: propertyType,
                description: toSafeText(field.description).trim(),
                placeholder: toSafeText(field.placeholder).trim(),
                number_unit: toSafeText(field.number_unit).trim(),
                select_source_type: toSafeText(field.select_source_type).trim(),
                select_api_endpoint: toSafeText(field.select_api_endpoint).trim(),
                select_api_label_field: toSafeText(field.select_api_label_field || 'label').trim() || 'label',
                select_api_value_field: toSafeText(field.select_api_value_field || 'value').trim() || 'value',
                options: this.normalizeSelectItems(field.options),
            };
            if (field.config && typeof field.config === 'object') {
                normalized.config = {
                    ...field.config,
                    expression: toSafeText(field.config.expression).trim(),
                };
            }
            return normalized;
        },
        coerceFieldFormValue(value, field) {
            const type = toSafeText(field?.property_type).trim();
            if (type === 'number') {
                if (value === null || value === undefined || value === '') return null;
                const num = Number(toSafeText(value).replace(/,/g, ''));
                return Number.isFinite(num) ? num : null;
            }
            if (type === 'boolean') {
                return Boolean(value);
            }
            if (type === 'multiselect') {
                return this.normalizeStringList(value);
            }
            if (type === 'formula') {
                return toSafeText(value);
            }
            return value === null || value === undefined ? '' : toSafeText(value);
        },
        getPropertyTypeLabel(type) {
            const found = PROPERTY_TYPES.find(t => t.value === type);
            return found ? found.label : type;
        },
        applyProcessSchemaFieldsFromDefinition(def) {
            if (!def) return;
            const activeFields = this.normalizeSchemaFields(this.catalogStore.schemasByAppliesTo('process'));
            const deprecatedFields = this.normalizeSchemaFields(this.catalogStore.deprecatedSchemasByAppliesTo('process'));
            const mergedFields = [...activeFields, ...deprecatedFields];
            mergedFields.forEach(f => {
                if (f.property_type === 'daterange') {
                    const startKey = f.property_key + '_start';
                    const endKey = f.property_key + '_end';
                    if (def[startKey] !== undefined) this.processForm[startKey] = def[startKey];
                    if (def[endKey] !== undefined) this.processForm[endKey] = def[endKey];
                } else if (def[f.property_key] !== undefined) {
                    this.processForm[f.property_key] = def[f.property_key];
                    if (f.property_type === 'user') {
                        this.applyStoredUserLabel(f.property_key, def[f.property_key], def[f.property_key + '_label']);
                    }
                }
            });
            this.loadApiSelectItems(mergedFields);
            this.resolveSchemaUserFieldLabels(mergedFields, this.processForm);
        },
        onOwnerSettingSaved(payload) {
            this.procDefOwners = {
                fieldOwners: payload.fieldOwners || [],
                hqOwners: payload.hqOwners || [],
                masterOwner: payload.masterOwner || null
            };
            // PI팀 담당자를 비운 경우(payload.owner 빈 값)도 즉시 반영해야 하므로 가드 없이 갱신한다.
            // resolveOwnerInfo 는 빈 값이면 ownerResolved/ownerSelected 를 null 로 비운다.
            this.processForm.owner = payload.owner || null;
            this.resolveOwnerInfo(payload.owner || '');
            if (this.processDefinition) {
                if (!this.processDefinition.definition) this.processDefinition.definition = {};
                if (!this.processDefinition.definition.meta) this.processDefinition.definition.meta = {};
                this.processDefinition.definition.meta.owners = {
                    primaryOwner: payload.owner || null,
                    fieldOwners: payload.fieldOwners || [],
                    hqOwners: payload.hqOwners || [],
                    masterOwner: payload.masterOwner || null
                };
                this.processDefinition.owner = payload.owner || null;
            }
            this.resolveOwnerNames();
            if (this.ownerHistoryDialogOpen) this.loadOwnerHistory(false);
            this.$emit('governanceUpdated');
        },
        parseOwnerHistoryValue(value) {
            let raw = value;
            if (typeof raw === 'string') {
                try {
                    raw = JSON.parse(raw);
                } catch {
                    raw = {};
                }
            }
            if (!raw || typeof raw !== 'object') raw = {};
            return {
                primaryOwner: toSafeText(raw.primaryOwner || raw.owner).trim() || null,
                fieldOwners: this.normalizeOwnerList(raw.fieldOwners),
                hqOwners: this.normalizeOwnerList(raw.hqOwners),
                masterOwner: toSafeText(raw.masterOwner).trim() || null
            };
        },
        isOwnerHistoryEntry(entry) {
            const beforeOwners = this.parseOwnerHistoryValue(entry?.before_value);
            const afterOwners = this.parseOwnerHistoryValue(entry?.after_value);
            return !!(
                beforeOwners.primaryOwner ||
                beforeOwners.fieldOwners.length ||
                beforeOwners.hqOwners.length ||
                beforeOwners.masterOwner ||
                afterOwners.primaryOwner ||
                afterOwners.fieldOwners.length ||
                afterOwners.hqOwners.length ||
                afterOwners.masterOwner
            );
        },
        async openOwnerHistoryDialog() {
            this.ownerHistoryDialogOpen = true;
            this.ownerHistoryEntries = [];
            this.ownerHistoryTotal = 0;
            this.ownerHistoryLoadedAll = false;
            this.ownerHistoryHasMore = false;
            await this.loadOwnerHistory(false);
        },
        async loadOwnerHistory(loadAll = false) {
            const procDefId = toSafeText(this.definitionPath).trim();
            if (!procDefId) return;
            if (loadAll) {
                this.ownerHistoryLoadingAll = true;
            } else {
                this.ownerHistoryLoading = true;
            }
            try {
                if (loadAll) {
                    const result = await backend.getAdminAuditLogs({
                        targetType: 'process',
                        targetId: procDefId,
                        ownerOnly: true,
                        page: 1,
                        pageSize: -1
                    });
                    const entries = (result?.data || []).filter((entry) => this.isOwnerHistoryEntry(entry));
                    const existingIds = new Set(this.ownerHistoryEntries.map((entry) => entry.id));
                    this.ownerHistoryEntries = [
                        ...this.ownerHistoryEntries,
                        ...entries.filter((entry) => !existingIds.has(entry.id))
                    ];
                    this.ownerHistoryTotal = this.ownerHistoryEntries.length;
                    this.ownerHistoryLoadedAll = true;
                    this.ownerHistoryHasMore = false;
                } else {
                    const collected = [];
                    const seenIds = new Set();
                    let page = 1;
                    let fetchedRawCount = 0;
                    let rawTotal = 0;
                    let exhausted = false;

                    while (collected.length <= this.ownerHistoryInitialLimit && !exhausted) {
                        const result = await backend.getAdminAuditLogs({
                            targetType: 'process',
                            targetId: procDefId,
                            ownerOnly: true,
                            page,
                            pageSize: this.ownerHistoryInitialLimit
                        });
                        const rawEntries = result?.data || [];
                        rawTotal = result?.total || rawTotal;
                        fetchedRawCount += rawEntries.length;

                        rawEntries
                            .filter((entry) => this.isOwnerHistoryEntry(entry))
                            .forEach((entry) => {
                                if (!entry?.id || seenIds.has(entry.id)) return;
                                seenIds.add(entry.id);
                                collected.push(entry);
                            });

                        exhausted = rawEntries.length === 0 || fetchedRawCount >= rawTotal;
                        page += 1;
                    }

                    this.ownerHistoryEntries = collected.slice(0, this.ownerHistoryInitialLimit);
                    this.ownerHistoryTotal = this.ownerHistoryEntries.length;
                    this.ownerHistoryLoadedAll = false;
                    this.ownerHistoryHasMore = collected.length > this.ownerHistoryInitialLimit || !exhausted;
                }
            } catch (e) {
                console.warn('[OwnerHistory] load failed', e);
                if (!loadAll) {
                    this.ownerHistoryEntries = [];
                    this.ownerHistoryTotal = 0;
                    this.ownerHistoryHasMore = false;
                }
            } finally {
                if (loadAll) {
                    this.ownerHistoryLoadingAll = false;
                } else {
                    this.ownerHistoryLoading = false;
                }
            }
        },
        async loadAllOwnerHistory() {
            if (this.ownerHistoryLoading || this.ownerHistoryLoadingAll || !this.ownerHistoryCanLoadAll) return;
            await this.loadOwnerHistory(true);
        },
        ownerHistoryDate(entry) {
            return formatKST(entry?.created_at, 'YYYY.MM.DD HH:mm', toSafeText(entry?.created_at));
        },
        ownerHistoryActor(entry) {
            const name = toSafeText(entry?.actor_username || entry?.actor_id).trim() || '알 수 없음';
            const org = toSafeText(entry?.actor_org_name).trim();
            return org ? `${name} (${org})` : name;
        },
        ownerHistoryAfterOwners(entry) {
            return this.parseOwnerHistoryValue(entry?.after_value);
        },
        ownerHistoryUserName(entry, ownerId) {
            const key = toSafeText(ownerId).trim();
            if (!key) return '미지정';
            const lookup = entry?.user_lookups?.[key];
            if (lookup?.username) {
                const org = toSafeText(lookup.org_name).trim();
                return org ? `${lookup.username} (${org})` : lookup.username;
            }
            return this.resolvedOwnerName(key);
        },
        ownerHistorySingleOwner(entry, fieldKey) {
            const owners = this.ownerHistoryAfterOwners(entry);
            return this.ownerHistoryUserName(entry, owners[fieldKey]);
        },
        ownerHistoryOwnerList(entry, fieldKey) {
            const owners = this.ownerHistoryAfterOwners(entry);
            const list = Array.isArray(owners[fieldKey]) ? owners[fieldKey] : [];
            if (!list.length) return '미지정';
            return list.map((ownerId) => this.ownerHistoryUserName(entry, ownerId)).join(', ');
        },
        openOwnerRollbackConfirm(entry) {
            this.ownerRollbackTarget = entry;
            this.ownerRollbackConfirmOpen = true;
        },
        async rollbackOwnerHistory() {
            const procDefId = toSafeText(this.definitionPath).trim();
            const target = this.ownerRollbackTarget;
            if (!procDefId || !target || this.ownerRollbackSaving) return;

            const rollbackOwners = this.parseOwnerHistoryValue(target.after_value);
            this.ownerRollbackSaving = true;
            try {
                const supabase = window.$supabase;
                if (!supabase) throw new Error('Supabase not initialized');

                const { data: procDef, error: fetchError } = await supabase
                    .from('proc_def')
                    .select('definition, owner')
                    .eq('id', procDefId)
                    .eq('tenant_id', window.$tenantName)
                    .maybeSingle();
                if (fetchError) throw fetchError;

                const definition = (procDef?.definition && typeof procDef.definition === 'object') ? procDef.definition : {};
                if (!definition.meta) definition.meta = {};
                const currentOwners = definition.meta.owners || {};
                const beforeOwners = {
                    primaryOwner: toSafeText(currentOwners.primaryOwner || procDef?.owner).trim() || null,
                    fieldOwners: this.normalizeOwnerList(currentOwners.fieldOwners),
                    hqOwners: this.normalizeOwnerList(currentOwners.hqOwners),
                    masterOwner: toSafeText(currentOwners.masterOwner).trim() || null
                };

                definition.meta.owners = {
                    ...currentOwners,
                    ...rollbackOwners
                };

                const { error: updateError } = await supabase
                    .from('proc_def')
                    .update({
                        owner: rollbackOwners.primaryOwner || null,
                        definition
                    })
                    .eq('id', procDefId)
                    .eq('tenant_id', window.$tenantName);
                if (updateError) throw updateError;

                await backend.insertAdminAuditLog({
                    action: 'process_update',
                    target_type: 'process',
                    target_id: procDefId,
                    target_name: toSafeText(this.processForm.title || procDefId),
                    before_value: beforeOwners,
                    after_value: rollbackOwners,
                    comment: '담당자 변경 이력 적용'
                });

                this.procDefOwners = {
                    fieldOwners: rollbackOwners.fieldOwners,
                    hqOwners: rollbackOwners.hqOwners,
                    masterOwner: rollbackOwners.masterOwner
                };
                this.processForm.owner = rollbackOwners.primaryOwner || null;
                this.resolveOwnerInfo(rollbackOwners.primaryOwner || '');
                if (this.processDefinition) {
                    if (!this.processDefinition.definition) this.processDefinition.definition = {};
                    if (!this.processDefinition.definition.meta) this.processDefinition.definition.meta = {};
                    this.processDefinition.definition.meta.owners = {
                        ...(this.processDefinition.definition.meta.owners || {}),
                        ...rollbackOwners
                    };
                    this.processDefinition.owner = rollbackOwners.primaryOwner || null;
                }
                this.resolveOwnerNames();
                await this.loadOwnerHistory(false);
                this.$emit('governanceUpdated');
                this.$toast?.success('담당자를 적용했습니다.');
                this.ownerRollbackConfirmOpen = false;
                this.ownerRollbackTarget = null;
            } catch (e) {
                console.error('[OwnerHistory] rollback failed', e);
                this.$toast?.error('담당자 적용에 실패했습니다.');
            } finally {
                this.ownerRollbackSaving = false;
            }
        },
        openParentRefInNewWindow(ref) {
            const defId = toSafeText(ref?.id).trim();
            if (!defId) return;
            const defName = toSafeText(ref?.name).trim() || defId;
            navigateToProcessHierarchy(
                this.$router,
                { id: defId, name: defName, entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE },
                { openInNewTab: true }
            );
        },
        async loadProcessParentRefs() {
            const targetId = toSafeText(this.definitionPath).trim();
            if (!this.isCurrentlyModule || !targetId) {
                this.processParentRefs = [];
                return;
            }
            this.processParentRefsLoading = true;
            try {
                const refs = await backend.findProcessesReferencing(targetId, targetId);
                this.processParentRefs = Array.isArray(refs) ? refs : [];
            } catch (e) {
                console.warn('[loadProcessParentRefs] failed', e);
                this.processParentRefs = [];
            } finally {
                this.processParentRefsLoading = false;
            }
        },
        async loadCallActivityParentRefs() {
            // CallActivity 가 가리키는 target def 를 사용 중인 다른 프로세스들을 역참조 조회
            const rawTarget = this.normalizeCallActivityDefinitionId
                ? this.normalizeCallActivityDefinitionId(this.callActivityDefinitionId)
                : this.callActivityDefinitionId;
            const targetId = toSafeText(rawTarget).trim();
            if (!targetId) {
                this.callActivityParentRefs = [];
                return;
            }
            const currentId = toSafeText(this.processDefinition?.id).trim();
            this.callActivityParentRefsLoading = true;
            try {
                const refs = await backend.findProcessesReferencing(targetId, currentId);
                this.callActivityParentRefs = Array.isArray(refs) ? refs : [];
            } catch (e) {
                console.warn('[loadCallActivityParentRefs] failed', e);
                this.callActivityParentRefs = [];
            } finally {
                this.callActivityParentRefsLoading = false;
            }
        },
        async loadModuleParentRefs() {
            // FR-017: 이 프로세스(모듈) 자신을 CallActivity 로 참조하는 상위 프로세스 역참조 조회.
            //   기존 callActivityParentRefs(선택된 CA의 target 기준)와 분리된 별도 상태(워처 덮어쓰기 방지).
            const selfId = toSafeText(this.processDefinition?.id).trim();
            if (!selfId || !this.isCurrentlyModule) {
                this.moduleParentRefs = [];
                return;
            }
            this.moduleParentRefsLoading = true;
            try {
                const refs = await backend.findProcessesReferencing(selfId, selfId);
                this.moduleParentRefs = Array.isArray(refs) ? refs : [];
            } catch (e) {
                console.warn('[loadModuleParentRefs] failed', e);
                this.moduleParentRefs = [];
            } finally {
                this.moduleParentRefsLoading = false;
            }
        },
        async resolveOwnerNames() {
            const allEmails = [
                ...this.procDefOwners.fieldOwners,
                ...this.procDefOwners.hqOwners,
                ...(this.procDefOwners.masterOwner ? [this.procDefOwners.masterOwner] : [])
            ].map(value => toSafeText(value).trim()).filter(Boolean);
            const unique = [...new Set(allEmails)];
            if (unique.length === 0) { this.ownerNameMap = {}; return; }
            // 통합 lookup — users 테이블 batch 조회 + SSO API fallback 까지 한 번에 처리
            try {
                const identityMap = await backend.resolveUserIdentities(unique);
                const map = {};
                unique.forEach((id) => {
                    map[id] = formatIdentityWithTeam(identityMap[id], id);
                });
                this.ownerNameMap = map;
            } catch (e) {
                console.warn('Failed to resolve owner names:', e);
                this.ownerNameMap = {};
            }
        },
        resolvedOwnerName(email) {
            const key = toSafeText(email).trim();
            return toSafeText(this.ownerNameMap[key] || key);
        },
        toggle(name) {
            if (this.openSections.has(name)) {
                this.openSections.delete(name);
            } else {
                this.openSections.add(name);
            }
        },
        isOpen(name) {
            return this.openSections.has(name);
        },
        // ---- Pool(Participant): 실행형 Pool 지정 (다중 가능, executable 컬럼 autosave) ----
        toggleExecPoolForElement() {
            const el = this.element;
            const id = toSafeText(el?.id).trim();
            if (!id) return;
            const studio = this.anStudio?.studio;
            if (!studio?.toggleExecutablePool) {
                this.$toast?.error('실행형 Pool 지정을 사용할 수 없습니다 (studio 미초기화).');
                return;
            }
            const name = toSafeText(el?.businessObject?.name).trim() || id;
            try {
                const designated = studio.toggleExecutablePool(id, name);
                this.$toast?.success(
                    designated
                        ? `"${name}" 을 실행형 Pool 로 지정했습니다. Exec 뷰에서 재변환·재등록하면 실행에 반영됩니다.`
                        : `"${name}" 실행형 Pool 지정을 해제했습니다.`
                );
            } catch (e) {
                this.$toast?.error(e?.message || '실행형 Pool 지정에 실패했습니다.');
            }
        },
        removeExecPool(pool) {
            const studio = this.anStudio?.studio;
            if (!studio?.toggleExecutablePool || !pool?.id) return;
            try {
                studio.toggleExecutablePool(pool.id, pool.name);
            } catch (e) {
                this.$toast?.error(e?.message || '실행형 Pool 해제에 실패했습니다.');
            }
        },
        // ---- BusinessRuleTask: DMN 룰 연결 (목록/선택/미리보기) ----
        // 폼 연결용 재사용 폼 라이브러리(form_def) 목록 로드
        async loadFormDefList() {
            if (this.formDefListLoading || this.formDefItems.length) return;
            this.formDefListLoading = true;
            try {
                const forms = await backend.listDefinition('form_def');
                this.formDefItems = (Array.isArray(forms) ? forms : [])
                    .map((f) => ({ id: toSafeText(f.id).trim(), name: toSafeText(f.name || f.id).trim() }))
                    .filter((f) => f.id)
                    .sort((a, b) => a.name.localeCompare(b.name));
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] 폼 목록 로드 실패:', e);
                this.formDefItems = [];
            } finally {
                this.formDefListLoading = false;
            }
        },
        openFormDesigner() {
            const formId = toSafeText(this.taskFormLinkId).trim() || this.defaultFormIdForElement;
            const route = this.$router?.resolve ? this.$router.resolve({ name: 'Form Designer', query: formId ? { formId } : {} }) : null;
            if (route?.href) {
                window.open(route.href, '_blank', 'noopener');
            }
        },
        async loadBusinessRuleList() {
            if (this.businessRuleListLoading) return;
            this.businessRuleListLoading = true;
            try {
                const list = await backend.listBusinessRules();
                this.businessRuleItems = Array.isArray(list) ? list : [];
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] listBusinessRules failed:', e);
                this.businessRuleItems = [];
            } finally {
                this.businessRuleListLoading = false;
            }
        },
        async onBusinessRuleSelected(ruleId) {
            const normalized = toSafeText(typeof ruleId === 'object' && ruleId ? ruleId.id : ruleId).trim();
            this.businessRuleId = normalized;
            this.businessRulePreview = null;
            this.taskFormDirty = true;
            if (normalized) await this.loadBusinessRulePreview(normalized);
        },
        async loadBusinessRulePreview(ruleId) {
            this.businessRulePreviewLoading = true;
            try {
                const rule = await backend.getBusinessRule(ruleId);
                const table = rule?.dmnXml ? parseDmnXml(rule.dmnXml)?.decisions?.[0]?.decisionTable : null;
                const unquote = (v) => toSafeText(v).trim().replace(/^"|"$/g, '');
                this.businessRulePreview = rule
                    ? {
                          name: toSafeText(rule.name).trim() || toSafeText(ruleId).trim(),
                          description: toSafeText(rule.description).trim(),
                          inputs: (table?.inputs || []).map((i) => i.label || i.expression).filter(Boolean),
                          outputs: (table?.outputs || []).map((o) => o.label || o.name).filter(Boolean),
                          rows: (table?.rules || []).map((r) => ({
                              when:
                                  (table.inputs || [])
                                      .map((inp, idx) => {
                                          const v = toSafeText(r.inputs?.[idx]?.value).trim();
                                          return v && v !== '-' ? `${inp.label || inp.expression} = ${unquote(v)}` : '';
                                      })
                                      .filter(Boolean)
                                      .join(', ') || '항상',
                              then: (table.outputs || [])
                                  .map((out, idx) => {
                                      const v = unquote(r.outputs?.[idx]?.value);
                                      return v ? `${out.label || out.name} = ${v}` : '';
                                  })
                                  .filter(Boolean)
                                  .join(', ')
                          }))
                      }
                    : null;
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] getBusinessRule failed:', e);
                this.businessRulePreview = null;
            } finally {
                this.businessRulePreviewLoading = false;
            }
        },
        async loadSendTaskUserList() {
            if (this.sendTaskUserLoading || this.sendTaskUserItems.length) return;
            this.sendTaskUserLoading = true;
            try {
                const list = await backend.getUserList();
                const seen = new Set();
                this.sendTaskUserItems = (Array.isArray(list) ? list : [])
                    .filter((u) => u && u.email && !seen.has(String(u.email).toLowerCase()) && seen.add(String(u.email).toLowerCase()))
                    .map((u) => ({
                        email: toSafeText(u.email),
                        label: u.username ? `${toSafeText(u.username)} (${toSafeText(u.email)})` : toSafeText(u.email)
                    }));
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] getUserList failed:', e);
                this.sendTaskUserItems = [];
            } finally {
                this.sendTaskUserLoading = false;
            }
        },
        openLink(url) {
            const normalizedUrl = toSafeText(url).trim();
            if (!normalizedUrl) return;
            const href = /^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`;
            window.open(href, '_blank');
        },
        numberRules(field) {
            const min = field.number_min != null ? Number(toSafeText(field.number_min)) : null;
            const max = field.number_max != null ? Number(toSafeText(field.number_max)) : null;
            return [
                v => {
                    if (v === '' || v === null || v === undefined) return true;
                    const num = Number(String(v).replace(/,/g, ''));
                    if (isNaN(num)) return '숫자만 입력 가능합니다';
                    if (min !== null && Number.isFinite(min) && num < min) return `최소 ${min} 이상`;
                    if (max !== null && Number.isFinite(max) && num > max) return `최대 ${max} 이하`;
                    return true;
                }
            ];
        },
        numberFieldDisplay(val, field) {
            if (val === null || val === undefined || val === '') return '';
            const normalized = toSafeText(val).replace(/,/g, '');
            if (field.number_use_comma) {
                const num = Number(normalized);
                return Number.isFinite(num) ? num.toLocaleString() : '';
            }
            return normalized;
        },
        onNumberFocus(e) {
            const input = e.target;
            const raw = String(input.value || '').replace(/,/g, '');
            input.type = 'number';
            setTimeout(() => {
                if (raw !== '') input.value = raw;
            }, 0);
        },
        onNumberBlur(e, field, setter) {
            const input = e.target;
            const raw = input.value;
            let num = Number(String(raw).replace(/,/g, ''));
            if (isNaN(num) || raw === '') { num = null; }
            const min = field.number_min != null ? Number(toSafeText(field.number_min)) : null;
            const max = field.number_max != null ? Number(toSafeText(field.number_max)) : null;
            if (num !== null) {
                if (min !== null && Number.isFinite(min) && num < min) num = min;
                if (max !== null && Number.isFinite(max) && num > max) num = max;
            }
            setter(num);
            input.type = 'text';
            if (num !== null && field.number_use_comma) {
                input.value = Number(num).toLocaleString();
            }
        },
        getSelectFieldItems(field) {
            const propertyKey = toSafeText(field?.property_key).trim();
            if (field.property_type === 'db-select') {
                return this.normalizeSelectItems(this.dbSelectItems[propertyKey] || []);
            }
            if (field.select_source_type === 'api' && this.apiSelectItems[field.property_key]) {
                return this.normalizeSelectItems(this.apiSelectItems[propertyKey]);
            }
            return this.normalizeSelectItems(field.options || []);
        },
        async onUserSearch(propertyKey, keyword) {
            const key = toSafeText(propertyKey).trim();
            const normalizedKeyword = toSafeText(keyword).trim();
            if (!normalizedKeyword || normalizedKeyword.length < 2) {
                this.$set ? this.$set(this.userSearchResults, key, []) : (this.userSearchResults[key] = []);
                return;
            }
            this.userSearchLoading[key] = true;
            try {
                const result = await backend.searchUsersByName(normalizedKeyword);
                const existingItems = this.userSearchResults[key] || [];
                const existingSelectedId = toSafeText(this.processForm?.[key] || this.taskForm?.schemaProps?.[key] || '').trim();
                const preservedSelected = existingSelectedId
                    ? existingItems.filter(item => toSafeText(item?.id).trim() === existingSelectedId)
                    : [];
                // 검색 결과를 통합 UserIdentity 로 정규화 → 스키마-user 필드 옵션 shape {id, name} 으로 변환
                const users = (result?.users || []).map(u => {
                    const identity = userIdentityFromSearchResult(u);
                    // 스키마-user 필드는 사번(SSO user_id) 또는 UUID·email 어느 형태로도 저장될 수 있음
                    const idValue = toSafeText(identity.id || identity.employee_no || identity.email).trim();
                    return {
                        id: idValue,
                        name: formatIdentityWithTeam(identity, idValue),
                    };
                });
                const mergedMap = new Map();
                [...preservedSelected, ...users].forEach(item => {
                    if (item?.id) mergedMap.set(item.id, item);
                });
                this.userSearchResults[key] = Array.from(mergedMap.values());
            } catch {
                this.userSearchResults[key] = [];
            } finally {
                this.userSearchLoading[key] = false;
            }
        },

        async resolveSchemaUserFieldLabels(fields, source) {
            if (!Array.isArray(fields) || !fields.length || !source) return;
            const userFieldKeys = fields
                .filter(f => f?.property_type === 'user' && source[f.property_key])
                .map(f => ({ key: f.property_key, value: toSafeText(source[f.property_key]).trim() }))
                .filter(entry => entry.value);
            if (!userFieldKeys.length) return;
            const uniqueValues = [...new Set(userFieldKeys.map(entry => entry.value))];

            // 통합 lookup — users 테이블 batch 조회 + SSO API fallback 까지 한 번에 처리
            // (이전엔 supabase 만 3쿼리, 미동기 사용자는 라벨 못 잡았음)
            let identityMap = {};
            try {
                identityMap = await backend.resolveUserIdentities(uniqueValues);
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] resolveSchemaUserFieldLabels failed:', e);
                return;
            }

            userFieldKeys.forEach(entry => {
                const identity = identityMap[entry.value];
                if (!identity) return;
                const item = {
                    id: entry.value,
                    name: formatIdentityWithTeam(identity, entry.value),
                };
                const existing = this.userSearchResults[entry.key] || [];
                const merged = [item, ...existing.filter(it => toSafeText(it?.id).trim() !== entry.value)];
                this.userSearchResults[entry.key] = merged;
            });
        },
        async loadApiSelectItems(fields) {
            for (const field of fields) {
                if ((field.property_type === 'select' || field.property_type === 'multiselect') && field.select_source_type === 'api' && field.select_api_endpoint) {
                    try {
                        const res = await fetch(field.select_api_endpoint);
                        const data = await res.json();
                        const items = (Array.isArray(data) ? data : data.items || data.results || []).map(item => ({
                            label: toSafeText(item[field.select_api_label_field || 'label'] || item.name),
                            value: toSafeText(item[field.select_api_value_field || 'value'] || item.id).trim(),
                        }));
                        this.apiSelectItems[field.property_key] = this.normalizeSelectItems(items);
                    } catch {
                        this.apiSelectItems[field.property_key] = [];
                    }
                }
            }
        },
        async resolveOwnerInfo(ownerIdentifier) {
            this.ownerResolved = null;
            this.ownerSelected = null;
            const normalizedOwner = toSafeText(ownerIdentifier).trim();
            if (!normalizedOwner) return;

            try {
                // 통합 lookup — users 테이블 + SSO fallback. 단일 ID 편의 함수 호출.
                const identityMap = await backend.resolveUserIdentities([normalizedOwner]);
                const identity = identityMap[normalizedOwner];
                if (identity) {
                    this.ownerResolved = {
                        email: identity.email,
                        username: identity.username,
                        org_name: identity.org_name,
                        employee_no: identity.employee_no,
                    };
                    this.ownerSelected = {
                        email: identity.email || normalizedOwner,
                        label: formatIdentityWithTeam(identity, normalizedOwner),
                        username: identity.username,
                        org_name: identity.org_name,
                        employee_no: identity.employee_no,
                    };
                    this.ownerSearchOptions = [this.ownerSelected];
                }
            } catch (e) {
                console.warn('Failed to resolve owner info:', e);
            }
        },
        onOwnerSearch(keyword) {
            clearTimeout(this._ownerSearchTimer);
            const normalizedKeyword = toSafeText(keyword).trim();
            if (!normalizedKeyword) {
                this.ownerSearchOptions = this.ownerSelected ? [this.ownerSelected] : [];
                return;
            }
            this._ownerSearchTimer = setTimeout(() => this.searchOwnerUsers(normalizedKeyword), 300);
        },
        async searchOwnerUsers(keyword) {
            this.ownerSearchLoading = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.searchUsersByName(keyword);
                // 검색 결과를 통합 UserIdentity 로 정규화 → autocomplete 옵션 형태로 변환
                this.ownerSearchOptions = (result.users || []).map(u => {
                    const identity = userIdentityFromSearchResult(u);
                    const value = toSafeText(identity.email || identity.id || identity.employee_no).trim();
                    return {
                        email: value,
                        label: formatIdentityWithTeam(identity, value),
                        username: toSafeText(identity.username),
                        org_name: toSafeText(identity.org_name),
                        employee_no: toSafeText(identity.employee_no).trim(),
                    };
                });
            } catch (e) {
                console.warn('Failed to search owner users:', e);
            } finally {
                this.ownerSearchLoading = false;
            }
        },
        onOwnerSelected(item) {
            if (item && item.email) {
                this.processForm.owner = toSafeText(item.email).trim();
                this.ownerResolved = {
                    email: toSafeText(item.email).trim(),
                    username: toSafeText(item.username),
                    org_name: toSafeText(item.org_name),
                    employee_no: toSafeText(item.employee_no).trim(),
                };
            } else {
                this.processForm.owner = '';
                this.ownerResolved = null;
            }
        },
        onParentChanged() {
        },
        // ─── Domain-aware Parent 편집 ─────────────────────────────────────
        syncParentFormFromHierarchy() {
            const h = this.parentHierarchy;
            this.parentForm.domainId = h?.domainId || null;
            this.parentForm.megaId = h?.megaId || null;
            this.parentForm.majorId = h?.majorId || null;
        },
        onParentDomainChange(newDomainId) {
            // Domain 변경 시 Mega/Major 자동 리셋
            this.parentForm.megaId = null;
            this.parentForm.majorId = null;
            if (!newDomainId) {
                // Domain clear → 즉시 모듈 전환 확인.
                // 모듈 마커가 있어도 proc_map에 남아있으면(비정상 상태) 제거할 수 있도록 다이얼로그를 연다
                if (this.isCurrentlyModule && !this.parentHierarchy) {
                    return;
                }
                this.openParentChangeDialog('module');
            }
        },
        onParentMegaChange() {
            this.parentForm.majorId = null;
        },
        onParentMajorChange(newMajorId) {
            // Major 선택 완료 시 (Domain·Mega 도 채워져 있어야) 확인 다이얼로그
            if (!newMajorId) return;
            if (!this.parentForm.domainId || !this.parentForm.megaId) return;
            // 변경된 게 없으면 무시 (read-only mode 진입 후 재선택했는데 같은 값일 때)
            const h = this.parentHierarchy;
            const sameAsCurrent = h
                && toSafeText(h.domainId).trim() === toSafeText(this.parentForm.domainId).trim()
                && toSafeText(h.megaId).trim() === toSafeText(this.parentForm.megaId).trim()
                && toSafeText(h.majorId).trim() === toSafeText(this.parentForm.majorId).trim();
            if (sameAsCurrent && !this.isCurrentlyModule) return;
            this.openParentChangeDialog('hierarchy');
        },
        openParentChangeDialog(targetType) {
            const preview = {};
            if (targetType === 'hierarchy') {
                const domains = this.domainOptions || [];
                const targetDomain = domains.find((d) => toSafeText(d?.id).trim() === toSafeText(this.parentForm.domainId).trim());
                const targetMega = (this.procMap?.mega_proc_list || []).find((m) => toSafeText(m?.id).trim() === toSafeText(this.parentForm.megaId).trim());
                const targetMajor = (targetMega?.major_proc_list || []).find((m) => toSafeText(m?.id).trim() === toSafeText(this.parentForm.majorId).trim());
                preview.domainName = toSafeText(targetDomain?.name || targetDomain?.id);
                preview.megaName = toSafeText(targetMega?.name || targetMega?.id);
                preview.majorName = toSafeText(targetMajor?.name || targetMajor?.id);
            }
            this.parentChangePending = {
                targetType,
                domainId: this.parentForm.domainId,
                megaId: this.parentForm.megaId,
                majorId: this.parentForm.majorId,
                preview,
            };
            this.parentChangeDialogOpen = true;
        },
        cancelParentChange() {
            if (this.parentChangeSubmitting) return;
            this.parentChangeDialogOpen = false;
            this.parentChangePending = null;
            // 사용자가 변경한 셀렉트들 → 현재 상태로 되돌림
            this.syncParentFormFromHierarchy();
        },
        async confirmParentChange() {
            const pending = this.parentChangePending;
            if (!pending) return;
            const procDefId = toSafeText(this.processDefinition?.id || this.definitionPath).trim();
            if (!procDefId) {
                this.$toast?.error('프로세스 ID를 확인할 수 없습니다.');
                return;
            }

            this.parentChangeSubmitting = true;
            try {
                // 1) proc_def.definition.type 업데이트
                const baseDef = this.processDefinition?.definition && typeof this.processDefinition.definition === 'object'
                    ? { ...this.processDefinition.definition }
                    : {};
                if (pending.targetType === 'module') {
                    baseDef.type = 'call-activity-sub';
                } else {
                    delete baseDef.type;
                }
                const procName = toSafeText(this.processDefinition?.name || baseDef.processDefinitionName || procDefId);
                await backend.putRawDefinition(
                    this.processDefinition?.bpmn || '',
                    procDefId,
                    {
                        name: procName,
                        definition: baseDef,
                        skipSaveProcMap: true
                    }
                );

                // 2) proc_map 업데이트
                const currentMap = await backend.getProcessDefinitionMap();
                const map = currentMap && currentMap.mega_proc_list ? currentMap : { mega_proc_list: [] };

                // 어디에 있든 일단 제거 — 엔트리에 따라 id 대신 proc_def_id 만 갖는 경우가 있어 양쪽 모두 매칭
                for (const mega of (map.mega_proc_list || [])) {
                    for (const major of (mega.major_proc_list || [])) {
                        if (!Array.isArray(major.sub_proc_list)) continue;
                        major.sub_proc_list = major.sub_proc_list.filter(sub =>
                            toSafeText(sub?.id).trim() !== procDefId &&
                            toSafeText(sub?.proc_def_id).trim() !== procDefId
                        );
                    }
                }

                if (pending.targetType === 'hierarchy') {
                    // 선택된 위치에 추가
                    const targetMegaId = toSafeText(pending.megaId).trim();
                    const targetMajorId = toSafeText(pending.majorId).trim();
                    const targetMega = (map.mega_proc_list || []).find(m => toSafeText(m?.id).trim() === targetMegaId);
                    if (!targetMega) throw new Error('선택한 Mega 프로세스를 찾을 수 없습니다.');
                    if (!Array.isArray(targetMega.major_proc_list)) targetMega.major_proc_list = [];
                    const targetMajor = targetMega.major_proc_list.find(m => toSafeText(m?.id).trim() === targetMajorId);
                    if (!targetMajor) throw new Error('선택한 Major 프로세스를 찾을 수 없습니다.');
                    if (!Array.isArray(targetMajor.sub_proc_list)) targetMajor.sub_proc_list = [];
                    targetMajor.sub_proc_list.push({
                        id: procDefId,
                        proc_def_id: procDefId,
                        name: procName,
                        path: procDefId
                    });
                }

                await backend.putProcessDefinitionMap(map);
                try {
                    if (pending.targetType === 'module') {
                        // proc_map에서 빠진 프로세스는 FromMap 동기화가 no-op이므로 계층 컬럼을 직접 비운다
                        if (typeof backend.syncProcessDefinitionHierarchy === 'function') {
                            await backend.syncProcessDefinitionHierarchy(procDefId, {
                                domain_id: null,
                                mega_process_id: null,
                                major_process_id: null
                            });
                        }
                    } else if (typeof backend.syncProcessDefinitionHierarchyFromMap === 'function') {
                        await backend.syncProcessDefinitionHierarchyFromMap(procDefId, map);
                    }
                } catch (syncErr) {
                    console.warn('[ParentChange] hierarchy sync failed:', syncErr);
                }

                // 감사 로그 — 한눈에 읽히도록 "계층 위치" 한 줄로 압축
                const formatLocation = (info) => {
                    if (!info) return '미분류 (체계도·모듈 어느 쪽도 아님)';
                    if (info.kind === 'module') return '프로세스 모듈 (체계도 미등록)';
                    const parts = [];
                    if (info.domainName) parts.push(`${info.domainName} 도메인`);
                    if (info.megaName) parts.push(`${info.megaName} (메가)`);
                    if (info.majorName) parts.push(`${info.majorName} (메이저)`);
                    return parts.length > 0 ? parts.join(' › ') : '미분류';
                };

                const beforeInfo = this.isCurrentlyModule
                    ? { kind: 'module' }
                    : (this.parentHierarchy
                        ? {
                            kind: 'hierarchy',
                            domainName: this.parentHierarchy.domainName || '',
                            megaName: this.parentHierarchy.megaName || '',
                            majorName: this.parentHierarchy.majorName || '',
                        }
                        : null);
                const afterInfo = pending.targetType === 'module'
                    ? { kind: 'module' }
                    : {
                        kind: 'hierarchy',
                        domainName: pending.preview?.domainName || '',
                        megaName: pending.preview?.megaName || '',
                        majorName: pending.preview?.majorName || '',
                    };

                backend.insertAdminAuditLog({
                    action: 'process_parent_change',
                    target_type: 'process',
                    target_id: procDefId,
                    target_name: procName,
                    before_value: { hierarchy_location: formatLocation(beforeInfo) },
                    after_value: { hierarchy_location: formatLocation(afterInfo) },
                }).catch((err) => {
                    console.warn('[ParentChange] audit log insert failed:', err);
                });

                this.$toast?.success(
                    pending.targetType === 'module'
                        ? '프로세스 모듈로 저장되었습니다.'
                        : 'Parent 위치가 변경되었습니다.'
                );
                this.parentChangeDialogOpen = false;
                this.parentChangePending = null;
                this.$emit('parentChanged', { procDefId, targetType: pending.targetType });
            } catch (e) {
                console.error('[ParentChange] failed:', e);
                this.$toast?.error(`변경에 실패했습니다: ${e?.message || e}`);
                // 실패 시 form 되돌리기
                this.syncParentFormFromHierarchy();
            } finally {
                this.parentChangeSubmitting = false;
            }
        },
        onLaneOrgSelected(selectedOrgs) {
            const orgList = Array.isArray(selectedOrgs)
                ? selectedOrgs
                : (selectedOrgs ? [selectedOrgs] : []);
            const joinedOrgName = orgList
                .map(org => (org && typeof org === 'object') ? toSafeText(org.name) : toSafeText(org))
                .filter(name => name)
                .join(', ');
            this.taskForm.name = joinedOrgName;
            // 패밀리사 토글 제거 후: external/role_group 이 아닐 때는 internal 로 유지
            if (orgList.length > 0 && this.laneResourceType !== 'external' && this.laneResourceType !== 'role_group') {
                this.laneResourceType = 'internal';
            }
        },
        onLaneSupplierSelected(selectedSuppliers) {
            const list = Array.isArray(selectedSuppliers)
                ? selectedSuppliers
                : (selectedSuppliers ? [selectedSuppliers] : []);
            const joinedName = list
                .map(s => (s && typeof s === 'object') ? toSafeText(s.name) : toSafeText(s))
                .filter(Boolean)
                .join(', ');
            this.taskForm.name = joinedName;
            this.$nextTick(() => {
                this.laneSupplierSearchText = '';
            });
        },
        onLaneGroupSearch(keyword) {
            clearTimeout(this._laneGroupSearchTimer);
            const normalizedKeyword = toSafeText(keyword).trim();
            if (!normalizedKeyword) {
                this.laneGroupOptions = [];
                return;
            }
            this._laneGroupSearchTimer = setTimeout(() => this.searchLaneGroups(normalizedKeyword), 300);
        },
        async searchLaneGroups(keyword) {
            this.laneGroupSearchLoading = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.searchGroupsByName(keyword, 0, 500);
                this.laneGroupOptions = (result.groups || []).map(g => ({
                    id: toSafeText(g.id).trim(),
                    name: toSafeText(g.name),
                    member_count: g.member_count
                }));
            } catch (e) {
                console.error('Failed to search lane groups:', e);
            } finally {
                this.laneGroupSearchLoading = false;
            }
        },

        // ====== 역할 그룹 그룹 (admin 에서 정의한 lane_role_groups) 로드 ======
        async loadLaneRoleGroups() {
            const supabase = window.$supabase;
            if (!supabase) return;
            const tenantId = window.$tenantName;
            this.laneRoleGroupLoading = true;
            try {
                const [{ data: g, error: gErr }, { data: m, error: mErr }] = await Promise.all([
                    supabase
                        .from('lane_role_groups')
                        .select('*')
                        .eq('tenant_id', tenantId)
                        .is('deleted_at', null)
                        .order('name', { ascending: true }),
                    supabase
                        .from('lane_role_group_members')
                        .select('*')
                        .eq('tenant_id', tenantId)
                        .is('deleted_at', null)
                ]);
                if (gErr) throw gErr;
                if (mErr) throw mErr;
                this.laneRoleGroups = g || [];
                this.laneRoleGroupMembers = m || [];
            } catch (e) {
                console.error('Failed to load lane role groups:', e);
            } finally {
                this.laneRoleGroupLoading = false;
            }
        },
        // org DMN(조직 배정 라우팅) 로드 — 역할그룹 선택 목록/카드에 라우팅 조건을 조회 전용으로 표시.
        async loadLaneOrgDmn() {
            if (this.laneOrgDmnLoaded || this.laneOrgDmnLoading) return;
            this.laneOrgDmnLoading = true;
            try {
                const saved = await backend.getBusinessRule(DEFAULT_ORGANIZATION_DMN_KEY);
                this.laneOrgDmnModel = saved?.dmnXml
                    ? organizationDmnXmlToRule(saved.dmnXml, { id: DEFAULT_ORGANIZATION_DMN_KEY })
                    : null;
                this.laneOrgDmnLoaded = true;
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] org DMN 로드 실패:', e);
            } finally {
                this.laneOrgDmnLoading = false;
            }
        },
        formatLaneRoutingInputs(condition) {
            return formatOrganizationRuleInputs(condition);
        },
        // 역할 그룹 다중 선택 변경 시: 모든 선택 그룹의 멤버 union 을 lane 의 담당 조직으로 펴서 박기
        // 카드 내부 x 버튼: 해당 그룹만 selectedList 에서 제거
        removeLaneRoleGroup(id) {
            const next = (this.laneRoleGroupSelectedList || []).filter((s) => s.id !== id);
            this.laneRoleGroupSelectedList = next;
            this.onLaneRoleGroupsChanged(next);
        },
        // 현재 selectedList 기준으로 laneRoleGroupIds + laneOrganization + laneSupplier 재계산.
        // 부작용 (laneAssigneeType, onLaneOrgSelected) 은 호출 안 함 — lane 자동 동기화 (로드/옵션 sync/저장) 에서 사용.
        refreshLaneRoleGroupOrgs() {
            const selected = Array.isArray(this.laneRoleGroupSelectedList) ? this.laneRoleGroupSelectedList : [];
            this.laneRoleGroupIds = selected.map((s) => s.id);
            const seenTeam = new Set();
            const seenSupplier = new Set();
            const teams = [];
            const suppliers = [];
            for (const sel of selected) {
                for (const m of (sel.members || [])) {
                    const orgId = m.org_id;
                    if (!orgId) continue;
                    const memberType = m.member_type || 'team';
                    if (memberType === 'supplier') {
                        if (seenSupplier.has(orgId)) continue;
                        seenSupplier.add(orgId);
                        const nm = m.org_name || orgId;
                        suppliers.push({ id: orgId, name: nm, displayName: nm });
                    } else {
                        if (seenTeam.has(orgId)) continue;
                        seenTeam.add(orgId);
                        teams.push({ id: orgId, name: m.org_name || orgId });
                    }
                }
            }
            this.laneOrganization = teams;
            this.laneGroupOptions = [...teams];
            this.laneSupplier = suppliers;
            this.laneSupplierOptions = [...suppliers];
        },
        onLaneRoleGroupsChanged(list) {
            const selected = Array.isArray(list) ? list : [];
            this.laneRoleGroupSelectedList = selected;
            this.refreshLaneRoleGroupOrgs();
            this.laneAssigneeType = 'org';
            if (typeof this.onLaneOrgSelected === 'function') {
                this.onLaneOrgSelected(this.laneOrganization);
            }
            // FR-010: 역할그룹 선택 시 Lane 이름(taskForm.name)을 (대표=첫번째) 역할그룹명으로 설정.
            //   본 핸들러는 역할그룹 (재)선택 시에만 호출되므로 "선택 시점 1회 반영",
            //   이후 사용자가 Lane 이름을 직접 수정하면 그 값이 유지된다(수동 개명 우선).
            if (selected.length && this.taskForm) {
                const primaryName = toSafeText(selected[0].label || selected[0].name).trim();
                if (primaryName) this.taskForm.name = primaryName;
            }
        },

        onLaneSupplierSearch(keyword) {
            clearTimeout(this._laneSupplierSearchTimer);
            const normalizedKeyword = toSafeText(keyword).trim();
            if (!normalizedKeyword) {
                this.laneSupplierOptions = [];
                return;
            }
            this._laneSupplierSearchTimer = setTimeout(() => this.searchLaneSuppliers(normalizedKeyword), 300);
        },
        async searchLaneSuppliers(keyword) {
            this.laneSupplierSearchLoading = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.searchSuppliers(keyword, 0, 500);
                this.laneSupplierOptions = (result.items || []).map(s => ({
                    id: toSafeText(s.id).trim(),
                    name: toSafeText(s.name),
                    displayName: s.business_number
                        ? `${toSafeText(s.name)} (${this.formatBusinessNumber(s.business_number)})`
                        : toSafeText(s.name),
                    business_number: toSafeText(s.business_number),
                    registration_type: toSafeText(s.registration_type)
                }));
            } catch (e) {
                console.error('Failed to search suppliers:', e);
            } finally {
                this.laneSupplierSearchLoading = false;
            }
        },
        formatBusinessNumber(num) {
            const text = toSafeText(num).trim();
            if (!text || text.length !== 10) return text;
            return `${text.slice(0, 3)}-${text.slice(3, 5)}-${text.slice(5)}`;
        },
        _parseLaneExtProps(laneBo) {
            if (!laneBo) return null;
            const extVals = laneBo.extensionElements?.values;
            if (!extVals || !extVals.length) return null;
            const propEl = extVals.find(v => v.$type === 'uengine:Properties') || extVals[0];
            if (!propEl?.json) return null;
            try { return JSON.parse(propEl.json); } catch { return null; }
        },
        onLaneUserSearch(keyword) {
            clearTimeout(this._laneUserSearchTimer);
            const normalizedKeyword = toSafeText(keyword).trim();
            if (!normalizedKeyword) {
                this.laneUserOptions = this.laneAssignee?.length ? [...this.laneAssignee] : [];
                return;
            }
            this._laneUserSearchTimer = setTimeout(() => this.searchLaneUsers(normalizedKeyword), 300);
        },
        onLaneUserSelected() {
            this.laneUserSearchText = '';
        },
        async searchLaneUsers(keyword) {
            this.laneUserSearchLoading = true;
            try {
                const backend = BackendFactory.createBackend();
                const result = await backend.searchUsersByName(keyword, 0, 500);
                // 검색 결과를 통합 UserIdentity 로 정규화 후 lane assignee 옵션으로 변환.
                // 기존 옵션 shape (email/name/org_name/org_id/user_id/key) 유지 — 다른 코드에서 참조 중.
                this.laneUserOptions = (result.users || []).map((u, idx) => {
                    const identity = userIdentityFromSearchResult(u);
                    const email = toSafeText(identity.email).trim();
                    const userId = toSafeText(u.user_id ?? identity.employee_no ?? '').trim();
                    const name = toSafeText(identity.username);
                    const orgName = toSafeText(identity.org_name);
                    const orgId = toSafeText(identity.org_code).trim();
                    const compound = `${userId}|${email}|${name}|${orgName}|${orgId}`;
                    return {
                        label: formatIdentityWithTeam(identity, name || email || userId),
                        email,
                        name,
                        org_name: orgName,
                        org_id: orgId,
                        user_id: userId,
                        key: compound.replace(/^\|+|\|+$/g, '') || `${name}|${orgName}|${idx}`,
                    };
                });
            } catch (e) {
                console.error('Failed to search lane users:', e);
            } finally {
                this.laneUserSearchLoading = false;
            }
        },
        async ensureCurrentUser() {
            if (this.currentUserId || this.currentUserName) {
                this.currentUserEmployeeNo = this.currentUserEmployeeNo || localStorage.getItem('employeeNo') || '';
                if (this.currentUserEmployeeNo) return;
            }

            const supabase = window.$supabase;
            if (!supabase) return;

            try {
                await refreshAuthClaims();
                this.currentUserRole = getResolvedRole();
                this.currentUserId = localStorage.getItem('uid') || this.currentUserId;
                this.currentUserName =
                    localStorage.getItem('userName') || localStorage.getItem('email') || window.$userName || this.currentUserName;
                this.currentUserEmployeeNo = localStorage.getItem('employeeNo') || this.currentUserEmployeeNo;
                const { data: authData } = await supabase.auth.getUser();
                const user = authData?.user;
                if (!user) return;

                this.currentUserId = user.id || '';
                let resolvedName = user.user_metadata?.full_name || user.email || '';

                try {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('username, email, role, employee_no')
                        .eq('id', user.id)
                        .limit(1)
                        .maybeSingle();
                    resolvedName = userData?.username || userData?.email || resolvedName;
                    this.currentUserEmployeeNo = userData?.employee_no || this.currentUserEmployeeNo;
                    this.currentUserRole = userData?.role || this.currentUserRole;
                } catch (e) {
                    console.warn('Current user profile lookup failed:', e);
                }

                this.currentUserName = resolvedName || '';
            } catch (e) {
                console.warn('Failed to resolve current governance user:', e);
            }
        },

        // ---- Governance data loading ----
        async loadGovernanceData(procDefId) {
            if (!procDefId) return;
            try {
                await this.ensureCurrentUser();
                const useReviewContext = this.hasReviewContext && typeof backend.getApprovalStateById === 'function';
                const reviewState = useReviewContext ? await backend.getApprovalStateById(this.reviewId).catch(() => null) : null;
                const matchesReviewContext = !!reviewState && reviewState.proc_def_id === procDefId;
                const [state, history] = await Promise.all([
                    matchesReviewContext ? reviewState : backend.getApprovalState(procDefId).catch(() => null),
                    matchesReviewContext ? backend.getApprovalHistory(this.reviewId, true).catch(() => []) : backend.getApprovalHistory(procDefId).catch(() => []),
                ]);
                this.approvalState = state;
                this.approvalHistory = history || [];

                // Load comments (all, including replies)
                const supabase = window.$supabase;
                if (supabase) {
                    const { data } = await supabase
                        .from('proc_def_comments')
                        .select('id, proc_def_id, parent_comment_id, element_id, element_name, element_type, author_id, author_name, content, is_resolved, resolved_by, resolved_at, resolve_action_text, reviewer_type, submission_round, created_at')
                        .eq('proc_def_id', procDefId)
                        .order('created_at', { ascending: false })
                        .limit(50);
                    this.comments = data || [];
                }
            } catch (e) {
                console.warn('Governance data load failed:', e);
            }
        },

        buildTimelineFromState() {
            if (!this.approvalState) return [];
            const state = this.approvalState;
            const entries = [];
            const locale = window.$lang === 'ko' ? ko : enUS;

            // Build from state timestamps
            if (state.submitted_at) {
                const majorVersion = toSafeText(state.major_version || 1);
                const minorVersion = toSafeText(state.minor_version || 0);
                entries.push({
                    title: `v${majorVersion}.${minorVersion} 초안 생성`,
                    actor: toSafeText(state.submitted_by),
                    date: this.formatRelativeDate(state.submitted_at, locale),
                    color: STATE_COLORS.submit,
                    roleTag: '발의',
                    roleColor: ROLE_COLORS.submitter,
                    isCurrent: false,
                });
            }
            if (state.hq_reviewed_at) {
                entries.push({
                    title: '본사 검토 완료',
                    actor: toSafeText(state.hq_reviewer_name),
                    date: this.formatRelativeDate(state.hq_reviewed_at, locale),
                    color: STATE_COLORS.approve_hq,
                    roleTag: '본사',
                    roleColor: ROLE_COLORS.hq,
                    isCurrent: false,
                });
            }
            if (state.field_reviewed_at) {
                entries.push({
                    title: '현업 검토 완료',
                    actor: toSafeText(state.field_reviewer_name),
                    date: this.formatRelativeDate(state.field_reviewed_at, locale),
                    color: STATE_COLORS.approve_field,
                    roleTag: '현업',
                    roleColor: ROLE_COLORS.field,
                    isCurrent: false,
                });
            }
            if (state.published_at) {
                entries.push({
                    title: '배포완료',
                    actor: toSafeText(state.published_by_name),
                    date: this.formatRelativeDate(state.published_at, locale),
                    color: STATE_COLORS.published,
                    roleTag: null,
                    roleColor: null,
                    isCurrent: false,
                });
            }

            // Reverse so most recent is on top
            entries.reverse();
            if (entries.length > 0) entries[0].isCurrent = true;
            return entries;
        },

        formatRelativeDate(dateStr, locale) {
            try {
                return formatDistanceToNow(toKst(dateStr)?.toDate() ?? new Date(dateStr), { addSuffix: true, locale });
            } catch {
                return toSafeText(dateStr);
            }
        },

        getTimelineTitle(item) {
            const actionLabels = {
                submit: '검토 요청',
                approve_hq: '본사 승인 완료',
                approve_field: '현업 승인 완료',
                reject_hq: '본사 반려',
                reject_field: '현업 반려',
                start_public_feedback: '공람 개시',
                auto_transition_final_edit: '최종수정 자동 전환',
                end_public_feedback: '공람 조기 종료',
                publish: '최종 배포',
                reject: '반려',
                reopen: '재작성',
                request_reopen: '현장 개선 요청',
                approve_reopen: 'Re-open 승인',
                reject_reopen: 'Re-open 반려',
                comment: '코멘트',
            };
            const action = toSafeText(item.action).trim();
            const label = actionLabels[action] || action;
            const commentText = toSafeText(item.comment).trim();
            const comment = commentText ? ` (${commentText.substring(0, 30)})` : '';
            return label + comment;
        },

        getRoleTag(action) {
            const normalizedAction = toSafeText(action).trim();
            if (normalizedAction.includes('hq')) return { label: '본사', color: ROLE_COLORS.hq };
            if (normalizedAction.includes('field')) return { label: '현업', color: ROLE_COLORS.field };
            if (normalizedAction === 'submit') return { label: '발의', color: ROLE_COLORS.submitter };
            return { label: null, color: null };
        },

        resolveQuotePreview(content) {
            const text = toSafeText(content).replace(/\s+/g, ' ').trim();
            const max = 40;
            return text.length > max ? `${text.slice(0, max)}...` : text;
        },

        // ---- Inline reply ----
        openInlineReply(target) {
            this.inlineReplyTargetId = target.id;
            this.inlineReplyText = '';
            this.cancelInlineResolve();
        },
        cancelInlineReply() {
            this.inlineReplyTargetId = null;
            this.inlineReplyText = '';
        },
        async submitInlineReply(target) {
            const supabase = window.$supabase;
            const text = (this.inlineReplyText || '').trim();
            if (!text || !target || !target.id || !this.definitionPath) return;
            if (!supabase) {
                this.$toast?.error('Supabase가 초기화되지 않아 답글을 저장할 수 없습니다.');
                return;
            }
            await this.ensureCurrentUser();
            if (!this.canLeaveFeedback) {
                this.$toast?.warning('답글 작성 권한이 없습니다. (Reviewer 이상 권한 또는 공람 기간 중에만 작성 가능)');
                return;
            }
            this.submittingFeedback = true;
            try {
                const user = (await supabase.auth.getUser())?.data?.user;
                const { error } = await supabase
                    .from('proc_def_comments')
                    .insert({
                        proc_def_id: this.definitionPath,
                        content: text,
                        element_id: toSafeText(target.element_id).trim() || '__process__',
                        element_name: toSafeText(target.element_name).trim() || null,
                        element_type: toSafeText(target.element_type).trim() || null,
                        author_id: this.currentUserId || user?.id || 'anonymous',
                        author_name: this.currentUserName || user?.user_metadata?.full_name || user?.email || '익명',
                        reviewer_type: this.getCurrentFeedbackReviewerType(),
                        is_resolved: false,
                        parent_comment_id: target.id,
                        tenant_id: window.$tenantName || 'default',
                    });
                if (error) throw error;
                this.cancelInlineReply();
                await this.loadGovernanceData(this.definitionPath);
                this.$toast?.success('답글이 등록되었습니다.');
            } catch (e) {
                console.error('Submit reply failed:', e);
                this.$toast?.error(this.describeFeedbackSubmitError(e));
            } finally {
                this.submittingFeedback = false;
            }
        },

        // ---- Inline resolve ----
        openInlineResolve(target) {
            this.inlineResolveTargetId = target.id;
            this.inlineResolveText = '';
            this.cancelInlineReply();
        },
        cancelInlineResolve() {
            this.inlineResolveTargetId = null;
            this.inlineResolveText = '';
        },
        async submitInlineResolve(target) {
            const supabase = window.$supabase;
            const text = (this.inlineResolveText || '').trim();
            if (!supabase || !target || !target.id) return;
            if (!text) return;
            try {
                const { error } = await supabase
                    .from('proc_def_comments')
                    .update({
                        is_resolved: true,
                        resolve_action_text: text,
                        resolved_by: this.currentUserName || this.currentUserId || 'Unknown',
                        resolved_at: new Date().toISOString()
                    })
                    .eq('id', target.id);
                if (error) throw error;
                this.cancelInlineResolve();
                await this.loadGovernanceData(this.definitionPath);
            } catch (e) {
                console.error('Resolve feedback failed:', e);
                this.$toast?.error('피드백 해결 처리에 실패했습니다.');
            }
        },

        openMajorUpgradeDialog() {
            if (!this.canRequestMajorUpgrade) {
                if (this.dataFreezeInfo) {
                    this.$toast?.warning(this.readOnlyMessage || 'Data Freeze가 적용된 범위입니다.');
                }
                return;
            }
            this.majorUpgradeReason = '';
            this.majorUpgradeDialog = true;
        },

        openReviewDetail() {
            if (!this.reviewId) return;
            this.$router.push(`/review-board/${this.reviewId}`);
        },

        openReviewBoard() {
            this.$router.push('/review-board');
        },

        async openPublishedBaselineDiff() {
            if (!this.definitionPath || !this.currentReviewVersion) return;

            try {
                const versions = await backend.getDefinitionVersions(this.definitionPath, {
                    sort: 'desc',
                    orderBy: 'version',
                });
                const publishedVersion = (versions || []).find((row) => toSafeText(row.version_tag).trim() === 'published');
                if (!publishedVersion?.version) {
                    this.$toast?.warning('배포 기준 버전을 찾지 못했습니다.');
                    return;
                }

                this.$router.push({
                    path: '/version-comparison',
                    query: {
                        processId: this.definitionPath,
                        versionA: this.currentReviewVersion,
                        versionB: toSafeText(publishedVersion.version).trim()
                    }
                });
            } catch (e) {
                console.error('Open published baseline diff failed:', e);
                this.$toast?.error('배포 기준 비교 화면을 열지 못했습니다.');
            }
        },

        async requestMajorUpgrade() {
            if (!this.canRequestMajorUpgrade || !this.definitionPath || !this.majorUpgradeReason.trim()) {
                if (this.dataFreezeInfo) {
                    this.$toast?.warning(this.readOnlyMessage || 'Data Freeze가 적용된 범위입니다.');
                }
                return;
            }

            this.requestingMajorUpgrade = true;
            try {
                await backend.requestReopen(this.definitionPath, this.majorUpgradeReason.trim());
                await this.loadGovernanceData(this.definitionPath);
                this.majorUpgradeDialog = false;
                this.majorUpgradeReason = '';
                this.$toast?.success('차기 Major 초안 요청이 등록되었습니다.');
            } catch (e) {
                console.error('Major upgrade request failed:', e);
                this.$toast?.error('차기 Major 초안 요청에 실패했습니다.');
            } finally {
                this.requestingMajorUpgrade = false;
            }
        },

        async executeGovernanceAction(action) {
            if (!this.approvalState?.id || !this.definitionPath) return;

            const reviewId = this.approvalState.id;
            const trimmedComment = this.governanceActionComment.trim();
            const supabase = window.$supabase;

            if (action === 'reject' && !trimmedComment) {
                this.$toast?.warning('반려 사유를 입력하세요.');
                return;
            }

            if (action === 'comment' && !trimmedComment) {
                this.$toast?.warning('코멘트를 입력하세요.');
                return;
            }

            this.governanceActionLoading = true;
            try {
                await this.ensureCurrentUser();

                if (action === 'approve_hq') {
                    await backend.approveHQ(reviewId, trimmedComment || undefined);
                } else if (action === 'approve_field') {
                    await backend.approveField(reviewId, trimmedComment || undefined);
                } else if (action === 'end_public_feedback') {
                    await backend.endPublicFeedback(reviewId, trimmedComment || '공람 조기 종료');
                } else if (action === 'publish') {
                    await backend.publishDefinition(reviewId, trimmedComment || undefined);
                } else if (action === 'reject') {
                    await backend.rejectDefinition(reviewId, trimmedComment);
                } else if (action === 'comment') {
                    if (!supabase) throw new Error('Supabase not initialized');
                    const { error } = await supabase.from('proc_def_approval_history').insert({
                        proc_def_id: this.definitionPath,
                        review_id: reviewId,
                        action: 'comment',
                        from_state: this.governanceStateKey,
                        to_state: this.governanceStateKey,
                        actor_id: this.currentUserId || 'anonymous',
                        actor_name: this.currentUserName || 'Anonymous',
                        comment: trimmedComment,
                        tenant_id: window.$tenantName
                    });
                    if (error) throw error;
                }

                await this.loadGovernanceData(this.definitionPath);
                this.$emit('governanceUpdated', {
                    reviewId: this.approvalState?.id || reviewId,
                    state: this.approvalState?.state || this.governanceStateKey
                });

                this.governanceActionComment = '';

                const successMessages = {
                    approve_hq: '본사 승인 완료',
                    approve_field: '현업 승인 완료',
                    end_public_feedback: '공람 종료 후 최종수정으로 이동했습니다.',
                    publish: '배포완료되었습니다.',
                    reject: '반려 처리되었습니다.',
                    comment: '코멘트가 등록되었습니다.'
                };
                this.$toast?.success(successMessages[action] || '거버넌스 액션이 처리되었습니다.');
            } catch (e) {
                console.error(`Governance action failed: ${action}`, e);
                const errorMessages = {
                    approve_hq: '본사 승인에 실패했습니다.',
                    approve_field: '현업 승인에 실패했습니다.',
                    end_public_feedback: '공람 종료 처리에 실패했습니다.',
                    publish: '배포 처리에 실패했습니다.',
                    reject: '반려 처리에 실패했습니다.',
                    comment: '코멘트 등록에 실패했습니다.'
                };
                const fallbackMessage = errorMessages[action] || '거버넌스 액션 처리에 실패했습니다.';
                // 배포 차단 사유(BPMN 검증/미해결 피드백)는 메시지를 그대로 노출한다
                this.$toast?.error(action === 'publish' && e?.message ? e.message : fallbackMessage);
            } finally {
                this.governanceActionLoading = false;
            }
        },

        handleGovernanceApproveHQ() {
            if (!this.canApproveHQAction || !this.canApproveOrReject) return;
            this.executeGovernanceAction('approve_hq');
        },

        handleGovernanceApproveField() {
            if (!this.canApproveFieldAction || !this.canApproveOrReject) return;
            this.executeGovernanceAction('approve_field');
        },

        handleGovernanceEndPublicFeedback() {
            if (!this.canEndPublicFeedbackAction) return;
            this.executeGovernanceAction('end_public_feedback');
        },

        handleGovernancePublish() {
            if (!this.canPublishAction) return;
            this.executeGovernanceAction('publish');
        },

        handleGovernanceReject() {
            if (!this.canRejectAction || this.isGovernanceFinished) return;
            this.executeGovernanceAction('reject');
        },

        handleGovernanceComment() {
            if (!this.canCommentAction) return;
            this.executeGovernanceAction('comment');
        },

        getCurrentFeedbackReviewerType() {
            if (this.canApproveHQAction) return 'hq';
            if (this.canApproveFieldAction) return 'field';
            if (this.isSelfSubmitter) return 'owner';
            return 'public';
        },

        async submitFeedback() {
            const supabase = window.$supabase;
            const text = this.newFeedbackText.trim();
            if (!text || !this.definitionPath) return;
            if (!supabase) {
                this.$toast?.error('Supabase가 초기화되지 않아 피드백을 저장할 수 없습니다.');
                return;
            }

            await this.ensureCurrentUser();
            if (!this.canLeaveFeedback) {
                this.$toast?.warning('피드백 작성 권한이 없습니다. (Reviewer 이상 권한 또는 공람 기간 중에만 작성 가능)');
                return;
            }

            this.submittingFeedback = true;
            try {
                const user = (await supabase.auth.getUser())?.data?.user;
                const { error } = await supabase
                    .from('proc_def_comments')
                    .insert({
                        proc_def_id: this.definitionPath,
                        content: text,
                        element_id: toSafeText(this.mentionedElement?.id).trim() || '__process__',
                        element_name: toSafeText(this.mentionedElement?.name).trim() || null,
                        element_type: toSafeText(this.mentionedElement?.type).trim() || null,
                        author_id: this.currentUserId || user?.id || 'anonymous',
                        author_name: this.currentUserName || user?.user_metadata?.full_name || user?.email || '익명',
                        reviewer_type: this.getCurrentFeedbackReviewerType(),
                        is_resolved: false,
                        parent_comment_id: null,
                        tenant_id: window.$tenantName || 'default',
                    });
                if (error) throw error;
                this.newFeedbackText = '';
                this.mentionedElement = null;
                await this.loadGovernanceData(this.definitionPath);
                this.$toast?.success('피드백이 등록되었습니다.');
            } catch (e) {
                console.error('Submit feedback failed:', e);
                this.$toast?.error(this.describeFeedbackSubmitError(e));
            } finally {
                this.submittingFeedback = false;
            }
        },

        describeFeedbackSubmitError(e) {
            const code = e?.code || '';
            const message = e?.message || '';
            // 컬럼 미존재 (마이그레이션 누락)
            if (code === 'PGRST204' || /does not exist/i.test(message)) {
                return `피드백 등록 실패: 댓글 테이블 스키마가 최신이 아닙니다. 마이그레이션을 적용해 주세요. (${message})`;
            }
            // CHECK 제약 위반 (reviewer_type 등 허용되지 않은 값)
            if (code === '23514') {
                return '피드백 등록 실패: 허용되지 않은 검토자 유형입니다. reviewer_type 제약을 확인해 주세요.';
            }
            // RLS 거부
            if (code === '42501' || /permission denied|row-level security/i.test(message)) {
                return '피드백 등록 실패: 작성 권한이 거부되었습니다. (RLS 정책 확인 필요)';
            }
            // FK 위반
            if (code === '23503') {
                return `피드백 등록 실패: 참조 데이터가 유효하지 않습니다. (${message})`;
            }
            // NOT NULL 위반
            if (code === '23502') {
                return `피드백 등록 실패: 필수 항목이 비어 있습니다. (${message})`;
            }
            return message ? `피드백 등록 실패: ${message}` : '피드백 등록 실패: 알 수 없는 오류가 발생했습니다.';
        },

        // ---- Feedback edit / delete ----
        canManageFeedback(fb) {
            if (!fb) return false;
            if (this.isAdmin) return true;
            const authorId = toSafeText(fb.author_id).trim();
            const myId = toSafeText(this.currentUserId).trim();
            return !!authorId && !!myId && authorId === myId;
        },

        startEditFeedback(fb) {
            if (!this.canManageFeedback(fb)) return;
            this.editingFeedbackId = toSafeText(fb.id).trim();
            this.editFeedbackText = toSafeText(fb.content || '');
        },

        cancelEditFeedback() {
            this.editingFeedbackId = '';
            this.editFeedbackText = '';
        },

        async saveEditFeedback() {
            const id = this.editingFeedbackId;
            const text = this.editFeedbackText.trim();
            if (!id || !text) return;
            const target = this.feedbackItems.find(f => f.id === id);
            if (!target || !this.canManageFeedback(target)) {
                this.$toast?.warning('수정 권한이 없습니다.');
                return;
            }
            const supabase = window.$supabase;
            if (!supabase) {
                this.$toast?.error('Supabase가 초기화되지 않아 피드백을 수정할 수 없습니다.');
                return;
            }
            this.savingFeedbackEdit = true;
            try {
                const { error } = await supabase
                    .from('proc_def_comments')
                    .update({
                        content: text,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id);
                if (error) throw error;
                this.editingFeedbackId = '';
                this.editFeedbackText = '';
                await this.loadGovernanceData(this.definitionPath);
                this.$toast?.success('피드백이 수정되었습니다.');
            } catch (e) {
                console.error('Edit feedback failed:', e);
                this.$toast?.error('피드백 수정에 실패했습니다.');
            } finally {
                this.savingFeedbackEdit = false;
            }
        },

        requestDeleteFeedback(fb) {
            if (!this.canManageFeedback(fb)) return;
            this.commentDeleteTarget = { mode: 'feedback', commentId: toSafeText(fb.id).trim() };
            this.commentDeleteDialogVisible = true;
        },

        async deleteFeedback(commentId) {
            const id = toSafeText(commentId).trim();
            if (!id) return;
            const target = this.feedbackItems.find(f => f.id === id);
            if (!target || !this.canManageFeedback(target)) {
                this.$toast?.warning('삭제 권한이 없습니다.');
                return;
            }
            const supabase = window.$supabase;
            if (!supabase) {
                this.$toast?.error('Supabase가 초기화되지 않아 피드백을 삭제할 수 없습니다.');
                return;
            }
            try {
                const { error } = await supabase
                    .from('proc_def_comments')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                if (this.editingFeedbackId === id) {
                    this.editingFeedbackId = '';
                    this.editFeedbackText = '';
                }
                if (this.inlineReplyTargetId === id) {
                    this.cancelInlineReply();
                }
                if (this.inlineResolveTargetId === id) {
                    this.cancelInlineResolve();
                }
                await this.loadGovernanceData(this.definitionPath);
                this.$toast?.success('피드백이 삭제되었습니다.');
            } catch (e) {
                console.error('Delete feedback failed:', e);
                this.$toast?.error('피드백 삭제에 실패했습니다.');
            }
        },

        // ---- @Mention helpers ----
        onFeedbackInput(e) {
            const val = e.target.value || '';
            const cursorPos = e.target.selectionStart || val.length;
            // Find the last '@' before cursor
            const beforeCursor = val.substring(0, cursorPos);
            const atIdx = beforeCursor.lastIndexOf('@');
            if (atIdx >= 0) {
                const afterAt = beforeCursor.substring(atIdx + 1);
                // Close if space+space or if user typed beyond the mention
                if (afterAt.includes('\n')) {
                    this.showMentionDropdown = false;
                    this.mentionQuery = '';
                    return;
                }
                this.mentionQuery = afterAt;
                this.showMentionDropdown = true;
            } else {
                this.showMentionDropdown = false;
                this.mentionQuery = '';
            }
        },
        selectMentionTask(task) {
            this.mentionedElement = {
                id: toSafeText(task.id).trim(),
                name: toSafeText(task.name),
                type: toSafeText(task.type).trim(),
            };
            // Replace @query with @taskName in textarea
            const val = this.newFeedbackText || '';
            const atIdx = val.lastIndexOf('@');
            if (atIdx >= 0) {
                this.newFeedbackText = val.substring(0, atIdx) + '@' + toSafeText(task.name) + ' ';
            }
            this.showMentionDropdown = false;
            this.mentionQuery = '';
        },
        clearMention() {
            this.mentionedElement = null;
        },

        // ---- Element comments (uengineProps 저장 방식) ----
        async submitElementComment() {
            const description = this.newCommentDescription.trim();
            if (!description || !this.newCommentStatus) return;

            await this.ensureCurrentUser();
            this.submittingElementComment = true;
            try {
                const comment = {
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
                    status: this.newCommentStatus,
                    type: this.newCommentType || '',
                    description,
                    authorId: this.currentUserId || 'anonymous',
                    authorName: this.currentUserName || '익명',
                    createdAt: new Date().toISOString(),
                };

                if (this.isMultiCommentMode) {
                    comment.groupId = comment.id;
                    comment.groupedElementIds = [...this.multiSelectedElementIds];
                    await this.applyCommentToElements(this.multiSelectedElementIds, comment);
                    // 현재 패널에 표시된 요소(첫 번째)에도 반영
                    this.elementComments = [...this.elementComments, comment];
                    this.$emit('exitMultiCommentSelection');
                } else {
                    this.elementComments = [...this.elementComments, comment];
                    await this.saveTask();
                }

                this.newCommentStatus = 'open';
                this.newCommentType = '';
                this.newCommentDescription = '';
            } finally {
                this.submittingElementComment = false;
            }
        },

        openPiFlagEditor(elementless = false) {
            this.piFlagEditorElementless = !!elementless;
            this.piFlagEditorOpen = true;
        },

        /** 팝업(제목/문제점/개선방향)에서 작성된 PI Flag 등록. */
        async submitPiFlagDialog(payload) {
            if (!payload) return;
            const title = String(payload.title || '').trim();
            const problem = String(payload.problem || '').trim();
            if (!title && !problem) return;

            await this.ensureCurrentUser();
            this.submittingPiFlagDialog = true;
            try {
                const comment = {
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
                    status: payload.status || 'open',
                    type: String(payload.category || ''),
                    category: String(payload.category || ''),
                    title,
                    problem,
                    improvement: String(payload.improvement || '').trim(),
                    // 구버전 UI(사유 표시) 호환
                    description: problem,
                    authorId: this.currentUserId || 'anonymous',
                    authorName: this.currentUserName || '익명',
                    createdAt: new Date().toISOString(),
                };

                if (this.piFlagEditorElementless) {
                    // 프로세스 전반 PI Flag → 루트 프로세스 요소에 기록
                    this.appendProcessLevelComment(comment);
                } else {
                    this.elementComments = [...this.elementComments, comment];
                    await this.saveTask();
                }
                this.piFlagEditorOpen = false;
            } finally {
                this.submittingPiFlagDialog = false;
            }
        },

        async submitMultiRelatedProjectsMapping() {
            const pickedRaw = Array.isArray(this.multiTaskMappingForm.relatedProjects)
                ? this.multiTaskMappingForm.relatedProjects
                : [];
            if (!pickedRaw.length) {
                this.$toast?.warning('맵핑할 과제를 선택하세요.');
                return;
            }
            if (!this.multiTaskMappingElementIds.length) return;

            const groupId = this.generateRelatedProjectsGroupId();
            // id 도 함께 보존 (autocomplete 의 이미-선택 판정에 사용)
            const groupedItems = pickedRaw
                .map(p => {
                    if (!p) return null;
                    if (typeof p === 'string') {
                        const name = p.trim();
                        return name ? { name, groupId } : null;
                    }
                    if (typeof p === 'object') {
                        const name = toSafeText(p.name ?? p.title ?? '').trim();
                        if (!name) return null;
                        const out = { name, groupId };
                        const id = p.id ?? p.task_id ?? null;
                        if (id != null && id !== '') out.id = id;
                        return out;
                    }
                    return null;
                })
                .filter(Boolean);

            this.multiTaskMappingSubmitting = true;
            try {
                await this.applyRelatedProjectsToElements(this.multiTaskMappingElementIds, groupedItems);
                // 현재 패널에 표시된 요소도 멀티 대상에 포함된 경우 taskForm 갱신 (autocomplete chip 동기화)
                if (this.activeElement && this.multiTaskMappingElementIds.includes(this.activeElement.id)) {
                    const existingTaskForm = Array.isArray(this.taskForm.relatedProjects) ? this.taskForm.relatedProjects : [];
                    this.taskForm.relatedProjects = this.mergeRelatedProjects(existingTaskForm, groupedItems);
                    // 멀티 매핑은 자체 cascade 라 dirty 플래그 불필요
                    this.$nextTick(() => { this.taskFormDirty = false; });
                }
                this.multiTaskMappingForm.relatedProjects = [];
                this.$emit('exitMultiTaskMappingSelection');
                this.$emit('persistBpmn', {
                    projectIds: groupedItems.map(item => item.id).filter(id => id != null && id !== ''),
                });
                this.$toast?.success(`${this.multiTaskMappingElementIds.length}개 태스크에 과제 ${groupedItems.length}건이 그룹으로 매핑되었습니다.`);
            } finally {
                this.multiTaskMappingSubmitting = false;
            }
        },

        generateRelatedProjectsGroupId() {
            return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        },

        // dropdown 항목이 현재 폼에서 그룹 매핑된 상태인지 판정
        isRelatedProjectGroupedInForm(item) {
            if (!item || !item.name) return false;
            const list = Array.isArray(this.taskForm.relatedProjects) ? this.taskForm.relatedProjects : [];
            return list.some(p => p && typeof p === 'object' && p.name === item.name && p.groupId);
        },
        // dropdown 항목에 대응하는 폼 내부 객체 (groupId 포함) 반환 — tooltip 계산용
        getMatchedFormItem(item) {
            if (!item || !item.name) return null;
            const list = Array.isArray(this.taskForm.relatedProjects) ? this.taskForm.relatedProjects : [];
            return list.find(p => p && typeof p === 'object' && p.name === item.name && p.groupId) || item;
        },

        // chip 호버 시 표시할 tooltip 문자열 생성
        // - 그룹 매핑: 같은 groupId 를 보유한 다른 Task 이름들을 나열
        // - 개별 매핑: "개별 매핑" 표기
        buildRelatedProjectChipTooltip(item) {
            if (!item) return '';
            if (!item.groupId) return '개별 매핑';
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return `그룹 매핑 (${item.groupId})`;
            const elementRegistry = modeler.get('elementRegistry');
            const currentId = this.activeElement?.id;
            const memberNames = [];
            elementRegistry.forEach(el => {
                if (!el) return;
                const type = el.type || '';
                if (!type.includes('Task')) return;
                const bo = el.businessObject;
                const propsEl = bo?.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
                if (!propsEl?.json) return;
                let props;
                try { props = JSON.parse(propsEl.json); } catch { return; }
                const list = Array.isArray(props.relatedProjects) ? props.relatedProjects : [];
                const hasSameMapping = list.some(p => p && typeof p === 'object' && p.groupId === item.groupId && p.name === item.name);
                if (hasSameMapping) {
                    memberNames.push(bo?.name || el.id);
                }
            });
            const others = currentId ? memberNames.filter(name => {
                const currentBo = elementRegistry.get(currentId)?.businessObject;
                return name !== (currentBo?.name || currentId);
            }) : memberNames;
            if (!others.length) return '그룹 매핑 (현재 Task 단독)';
            return `그룹으로 묶인 Task:\n· ${others.join('\n· ')}`;
        },

        // 저장용 정규화: 문자열/객체 혼재 입력 → { name, id?, groupId? } 객체 배열
        // - id 를 보존해야 autocomplete 가 같은 항목을 이미 선택된 것으로 인식 (중복 추가 방지)
        // - 같은 name 이 두 번 이상 들어오면 한 항목으로 합쳐서 id / groupId 모두 보존
        normalizeRelatedProjectsForStorage(list) {
            const arr = Array.isArray(list) ? list : (list ? [list] : []);
            const byName = new Map();
            arr.forEach(item => {
                if (item == null) return;
                let name = '';
                let id = null;
                let groupId = null;
                if (typeof item === 'string') {
                    name = item.trim();
                } else if (typeof item === 'object') {
                    name = toSafeText(item.name ?? item.title ?? '').trim();
                    const rawId = item.id ?? item.task_id ?? null;
                    if (rawId != null && rawId !== '') id = rawId;
                    if (item.groupId) groupId = item.groupId;
                }
                if (!name) return;
                if (id == null) {
                    const matched = (this.atdtTaskList || []).find(task => toSafeText(task?.name).trim() === name);
                    if (matched?.id != null && matched.id !== '') id = matched.id;
                }
                const existing = byName.get(name);
                if (!existing) {
                    const out = { name };
                    if (id != null) out.id = id;
                    if (groupId) out.groupId = groupId;
                    byName.set(name, out);
                } else {
                    // 기존 항목에 빠진 정보 보강 (id / groupId 중 하나만 가진 항목들이 합쳐짐)
                    if (existing.id == null && id != null) existing.id = id;
                    if (!existing.groupId && groupId) existing.groupId = groupId;
                }
            });
            return Array.from(byName.values());
        },

        mergeRelatedProjects(existing, incoming) {
            // 같은 name 충돌 시 incoming 우선 (groupId promotion 등 새 정보 반영)
            const map = new Map();
            const keyOf = (item) => {
                if (!item) return null;
                if (typeof item === 'string') {
                    const name = item.trim();
                    return name ? `name:${name}` : null;
                }
                if (typeof item === 'object') {
                    const name = (item.name || '').trim();
                    if (name) return `name:${name}`;
                    if (item.id != null) return `id:${item.id}`;
                }
                return null;
            };
            existing.forEach(item => {
                const key = keyOf(item);
                if (key) map.set(key, item);
            });
            incoming.forEach(item => {
                const key = keyOf(item);
                if (key) map.set(key, item);
            });
            return Array.from(map.values());
        },

        async applyRelatedProjectsToElements(elementIds, incomingProjects) {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');

            for (const elementId of elementIds) {
                const shapeElement = elementRegistry.get(elementId);
                if (!shapeElement) continue;

                const bo = shapeElement.businessObject;
                const propsEl = bo.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
                let uengineProps = {};
                if (propsEl?.json) {
                    try { uengineProps = JSON.parse(propsEl.json); } catch { /* ignore */ }
                }

                const existing = Array.isArray(uengineProps.relatedProjects) ? uengineProps.relatedProjects : [];
                // groupId 정보를 보존하도록 객체 형태로 저장
                uengineProps.relatedProjects = this.normalizeRelatedProjectsForStorage(this.mergeRelatedProjects(existing, incomingProjects));

                const json = JSON.stringify(uengineProps);
                const otherExtValues = bo.extensionElements?.values
                    ? bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties')
                    : [];
                const existingVars = propsEl?.variables || [];
                const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables: existingVars });
                const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                    values: [...otherExtValues, uengineEl],
                });
                modeling.updateProperties(shapeElement, { extensionElements: newExtElements });
            }

            this.bpmnDataVersion++;
            this.$emit('taskMappingChanged');
        },

        // 단일 모드 saveTask 에서 호출: 그룹 매핑 항목이 제거되면 같은 groupId 보유 Task 들에서 동일 항목 cascade 제거
        cascadeRemoveGroupedRelatedProjects(originElementId, removedItems) {
            const grouped = removedItems.filter(item => item && item.groupId && item.name);
            if (!grouped.length) return;

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');

            // groupId+name 조합 인덱스 (빠른 매칭용)
            const removalKeys = new Set(grouped.map(item => `${item.groupId}::${item.name}`));

            elementRegistry.getAll().forEach(el => {
                if (!el || el.id === originElementId) return;
                const type = el.type || '';
                if (!type.includes('Task')) return;

                const bo = el.businessObject;
                const propsEl = bo?.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
                if (!propsEl?.json) return;

                let uengineProps;
                try { uengineProps = JSON.parse(propsEl.json); } catch { return; }
                const list = Array.isArray(uengineProps.relatedProjects) ? uengineProps.relatedProjects : [];
                if (!list.length) return;

                const filtered = list.filter(p => {
                    if (!p || typeof p !== 'object') return true;
                    const key = `${p.groupId || ''}::${p.name || ''}`;
                    return !removalKeys.has(key);
                });
                if (filtered.length === list.length) return; // 변경 없음

                uengineProps.relatedProjects = filtered;
                const json = JSON.stringify(uengineProps);
                const otherExtValues = bo.extensionElements?.values
                    ? bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties')
                    : [];
                const existingVars = propsEl?.variables || [];
                const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables: existingVars });
                const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                    values: [...otherExtValues, uengineEl],
                });
                modeling.updateProperties(el, { extensionElements: newExtElements });
            });
        },

        async applyCommentToElements(elementIds, comment) {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');

            for (const elementId of elementIds) {
                const shapeElement = elementRegistry.get(elementId);
                if (!shapeElement) continue;

                const bo = shapeElement.businessObject;
                // values[0] 가정 대신 명시적으로 uengine:Properties 탐색
                const propsEl = bo.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
                let uengineProps = {};
                if (propsEl?.json) {
                    try { uengineProps = JSON.parse(propsEl.json); } catch { /* ignore */ }
                }

                const existing = Array.isArray(uengineProps.comments) ? uengineProps.comments : [];
                uengineProps.comments = [...existing, comment];

                const json = JSON.stringify(uengineProps);
                const otherExtValues = bo.extensionElements?.values
                    ? bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties')
                    : [];
                // 기존 variables(customProperties) 보존
                const existingVars = propsEl?.variables || [];
                const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables: existingVars });
                const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                    values: [...otherExtValues, uengineEl],
                });
                modeling.updateProperties(shapeElement, { extensionElements: newExtElements });
            }

            this.bpmnDataVersion++;
            this.$emit('taskMappingChanged');
        },

        /**
         * AI Gap 진단 결과(PI Flag 초안 배열)를 BPMN 요소들에 일괄 기록.
         * - elementIds 가 여러 개인 초안 → 수동 다중 선택 PI Flag 과 동일하게 groupId +
         *   groupedElementIds 를 부여하고 같은 코멘트를 모든 요소에 기록 (그룹 코멘트)
         * - elementId(단수) 초안 → 해당 요소 extensionElements 에 코멘트 추가
         * - 요소가 없는 초안(프로세스 전반 이슈) → 루트 프로세스 요소에 기록
         * 멀티 코멘트(applyCommentToElements)와 동일하게 modeler 를 직접 변경한다.
         * @param {{elementId?:string,elementIds?:string[],category?:string,title?:string,problem?:string,improvement?:string}[]} drafts
         * @returns {{applied:number, unmatched:number}}
         */
        async applyGapDrafts(drafts) {
            const list = Array.isArray(drafts) ? drafts : [];
            if (!list.length) return { applied: 0, unmatched: 0 };

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return { applied: 0, unmatched: 0 };
            const elementRegistry = modeler.get('elementRegistry');

            await this.ensureCurrentUser();
            const authorId = this.currentUserId || 'ai-gap';
            const authorName = 'AI Gap 진단';

            // 프로세스 루트 요소(element 미지정 초안 귀속 대상) 탐색
            const rootEl = this.findRootProcessElement();

            // 요소별로 추가할 코멘트들을 모은 뒤 한 번에 기록 (요소당 updateProperties 1회)
            const byElement = new Map(); // elementId -> comment[]
            let unmatched = 0;
            list.forEach((d, i) => {
                const problem = String(d?.problem || d?.description || '').trim();
                const title = String(d?.title || '').trim();
                if (!problem && !title) return;
                const comment = {
                    id: `${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 6)}`,
                    status: 'open',
                    type: String(d?.category || ''),
                    category: String(d?.category || ''),
                    title,
                    problem,
                    improvement: String(d?.improvement || '').trim(),
                    // 구버전 UI(사유 표시) 호환
                    description: problem,
                    source: 'ai-gap',
                    authorId,
                    authorName,
                    createdAt: new Date().toISOString(),
                };

                // 초안이 걸친 캔버스 요소들 — 실제 존재하는 요소만 채택.
                const draftIds = (Array.isArray(d?.elementIds) && d.elementIds.length ? d.elementIds : [d?.elementId])
                    .map((id) => String(id || '').trim())
                    .filter((id, idx, arr) => id && arr.indexOf(id) === idx && !!elementRegistry.get(id));

                if (draftIds.length > 1) {
                    // 다중 요소 이슈 → 그룹 코멘트 (submitElementComment 의 멀티 모드와 동일 구조)
                    comment.groupId = comment.id;
                    comment.groupedElementIds = [...draftIds];
                    draftIds.forEach((id) => {
                        if (!byElement.has(id)) byElement.set(id, []);
                        byElement.get(id).push(comment);
                    });
                    return;
                }

                const targetId = draftIds[0] || (rootEl ? rootEl.id : '');
                if (!targetId) {
                    unmatched++;
                    return;
                }
                if (!byElement.has(targetId)) byElement.set(targetId, []);
                byElement.get(targetId).push(comment);
            });

            let applied = 0;
            const appliedGroupIds = new Set();
            for (const [elementId, comments] of byElement.entries()) {
                if (!elementRegistry.get(elementId)) { unmatched += comments.length; continue; }
                const written = this.writeCommentsToElement(elementId, comments);
                // 그룹 코멘트는 요소 수만큼 중복 집계하지 않고 이슈 1건으로 센다.
                comments.forEach((c) => {
                    if (c.groupId) {
                        if (!appliedGroupIds.has(c.groupId) && written > 0) {
                            appliedGroupIds.add(c.groupId);
                            applied += 1;
                        }
                    } else if (written > 0) {
                        applied += 1;
                    }
                });
            }

            this.bpmnDataVersion++;
            this.$emit('taskMappingChanged');
            return { applied, unmatched };
        },

        /** 루트 프로세스 요소(element 미지정 PI Flag 귀속 대상)를 반환. */
        findRootProcessElement() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return null;
            const elementRegistry = modeler.get('elementRegistry');
            return elementRegistry.find((el) => el && /Process$/.test(el.type || '') && el.businessObject) || null;
        },

        /** 완성된 코멘트 1건을 루트 프로세스 요소에 기록(프로세스 전반 PI Flag). */
        appendProcessLevelComment(comment) {
            const root = this.findRootProcessElement();
            if (!root) return false;
            this.writeCommentsToElement(root.id, [comment]);
            this.bpmnDataVersion++;
            this.$emit('taskMappingChanged');
            return true;
        },

        /** 지정 요소 extensionElements 의 comments 배열에 코멘트들을 append (modeler 직접 변경). */
        writeCommentsToElement(elementId, comments) {
            if (!elementId || !comments?.length) return 0;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return 0;
            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');

            const shapeElement = elementRegistry.get(elementId);
            if (!shapeElement) return 0;

            const bo = shapeElement.businessObject;
            const propsEl = bo.extensionElements?.values?.find((v) => v.$type === 'uengine:Properties');
            let uengineProps = {};
            if (propsEl?.json) {
                try { uengineProps = JSON.parse(propsEl.json); } catch { /* ignore */ }
            }
            const existing = Array.isArray(uengineProps.comments) ? uengineProps.comments : [];
            uengineProps.comments = [...existing, ...comments];

            const json = JSON.stringify(uengineProps);
            const otherExtValues = bo.extensionElements?.values
                ? bo.extensionElements.values.filter((v) => v.$type !== 'uengine:Properties')
                : [];
            const existingVars = propsEl?.variables || [];
            const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables: existingVars });
            const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                values: [...otherExtValues, uengineEl],
            });
            modeling.updateProperties(shapeElement, { extensionElements: newExtElements });

            if (this.activeElement?.id === elementId) {
                this.elementComments = [...this.elementComments, ...comments];
            }
            return comments.length;
        },

        /** PI Flag 코멘트의 "반영"(To-Be 반영) 태그를 토글하고 BPMN 에 반영. */
        togglePiFlagReflected(elementId, commentId) {
            if (!elementId || !commentId) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;
            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');

            const shapeElement = elementRegistry.get(elementId);
            if (!shapeElement) return;
            const bo = shapeElement.businessObject;
            const propsEl = bo.extensionElements?.values?.find((v) => v.$type === 'uengine:Properties');
            let uengineProps = {};
            if (propsEl?.json) {
                try { uengineProps = JSON.parse(propsEl.json); } catch { /* ignore */ }
            }
            const comments = Array.isArray(uengineProps.comments) ? uengineProps.comments : [];
            const idx = comments.findIndex((c) => c && c.id === commentId);
            if (idx === -1) return;
            comments[idx] = { ...comments[idx], reflected: !comments[idx].reflected };
            uengineProps.comments = comments;

            const json = JSON.stringify(uengineProps);
            const otherExtValues = bo.extensionElements?.values
                ? bo.extensionElements.values.filter((v) => v.$type !== 'uengine:Properties')
                : [];
            const existingVars = propsEl?.variables || [];
            const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables: existingVars });
            const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                values: [...otherExtValues, uengineEl],
            });
            modeling.updateProperties(shapeElement, { extensionElements: newExtElements });

            // 활성 요소면 로컬 상태도 동기화
            if (this.activeElement?.id === elementId) {
                this.elementComments = this.elementComments.map((c) =>
                    c.id === commentId ? { ...c, reflected: !c.reflected } : c
                );
            }
            this.bpmnDataVersion++;
            this.$emit('taskMappingChanged');
        },

        async deleteElementComment(commentId) {
            this.elementComments = this.elementComments.filter(c => c.id !== commentId);
            await this.saveTask();
        },

        openPiFlagTab(focusCommentIds) {
            this.topTab = 'properties';
            this.activeTab = 'pi-flag';
            this.piFlagSubTab = 'user-comments';
            // 깃발 클릭으로 코멘트 id 가 전달되면 그 코멘트가 속한 항목만 표시 (없으면 전체)
            this.piFlagFocusCommentIds =
                Array.isArray(focusCommentIds) && focusCommentIds.length ? new Set(focusCommentIds) : null;
        },

        clearPiFlagFocus() {
            this.piFlagFocusCommentIds = null;
        },

        isPiFlagCardOpen(elementId) {
            return !this.closedPiFlagCards.has(elementId);
        },

        togglePiFlagCard(elementId) {
            const next = new Set(this.closedPiFlagCards);
            if (next.has(elementId)) {
                next.delete(elementId);
            } else {
                next.add(elementId);
            }
            this.closedPiFlagCards = next;
        },

        isPiFlagAgentCardOpen(entryId) {
            return !this.closedPiFlagAgentCards.has(entryId);
        },

        togglePiFlagAgentCard(entryId) {
            const next = new Set(this.closedPiFlagAgentCards);
            if (next.has(entryId)) {
                next.delete(entryId);
            } else {
                next.add(entryId);
            }
            this.closedPiFlagAgentCards = next;
        },

        // ===== PI Flag 기반 AI 챗 (Agent 분석 탭) =====
        ensurePiFlagChatSession() {
            if (this.piFlagChatSessionId) return this.piFlagChatSessionId;
            const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                ? crypto.randomUUID()
                : `pi-flag-chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            this.piFlagChatSessionId = id;
            return id;
        },

        formatPiFlagChatAnswer(text) {
            const html = marked(text || '', { breaks: true, gfm: true });
            return DOMPurify.sanitize(typeof html === 'string' ? html : '');
        },

        buildPiFlagChatMessage(question) {
            const flags = this.piFlagChatFlags;
            const context = {
                process: {
                    id: this.processDefinition?.id || '',
                    name: this.processDefinition?.name || '',
                },
                piFlagCount: flags.length,
                piFlags: flags,
            };
            let contextText = '{}';
            try {
                contextText = JSON.stringify(context, null, 2);
            } catch {
                contextText = JSON.stringify({ ...context, piFlags: '[unserializable]' }, null, 2);
            }
            return [
                '프로세스 순서도 PI Flag 기반 질문입니다.',
                '아래는 현업이 등록한 PI Flag(개선 코멘트) 목록입니다.',
                '이 PI Flag와 BPMN 프로세스 정의를 함께 참고해 한국어로 구체적이고 실무적으로 답변해 주세요.',
                'PI Flag 가 비어 있으면 그 사실을 먼저 안내한 뒤 일반적인 개선 관점을 제시해 주세요.',
                '',
                `질문: ${question}`,
                '',
                '화면 컨텍스트(JSON):',
                contextText,
            ].join('\n');
        },

        applyPiFlagChatSuggestion(q) {
            if (this.piFlagChatLoading) return;
            this.piFlagChatInput = q;
            this.sendPiFlagChat();
        },

        clearPiFlagChat() {
            // 진행 중 응답이 로그에 다시 기록되지 않도록 sequence 를 무효화
            this.piFlagChatSeq++;
            this.piFlagChatLog = [];
            this.piFlagChatError = '';
            this.piFlagChatLoading = false;
            this.piFlagChatDialogOpen = false;
        },

        openPiFlagChatDialog() {
            if (!this.piFlagChatLog.length) return;
            this.piFlagChatDialogOpen = true;
        },

        async sendPiFlagChat() {
            const question = toSafeText(this.piFlagChatInput || '').trim();
            if (!question) {
                this.piFlagChatError = '질문을 입력해 주세요.';
                return;
            }
            if (this.piFlagChatLoading) return;

            const requestId = ++this.piFlagChatSeq;
            this.piFlagChatLoading = true;
            this.piFlagChatError = '';
            this.piFlagChatInput = '';

            const entryId = `pi-flag-chat-${requestId}`;
            this.piFlagChatLog = [...this.piFlagChatLog, { id: entryId, question, answer: '', streaming: true }];

            try {
                const sessionId = this.ensurePiFlagChatSession();
                const bpmnXml = await this.resolveCurrentBpmnXmlForCopilot();
                const message = this.buildPiFlagChatMessage(question);

                let accumulated = '';
                const onDelta = (text) => {
                    if (requestId !== this.piFlagChatSeq) return;
                    accumulated = text;
                    const target = this.piFlagChatLog.find(e => e.id === entryId);
                    if (target) target.answer = text;
                };

                const response = await backend.qdrantChat(
                    { message, xml: bpmnXml || undefined, sessionId },
                    { onDelta }
                );
                if (requestId !== this.piFlagChatSeq) return;

                const answerText = toSafeText(response?.answer || accumulated || '').trim();
                const target = this.piFlagChatLog.find(e => e.id === entryId);
                if (target) {
                    target.answer = answerText || 'PI Flag 기반 답변을 생성하지 못했습니다.';
                    target.streaming = false;
                }
            } catch (e) {
                if (requestId !== this.piFlagChatSeq) return;
                // 실패한 임시 엔트리는 제거하고 에러만 표시
                this.piFlagChatLog = this.piFlagChatLog.filter(e => e.id !== entryId);
                this.piFlagChatError = e?.detail || e?.message || 'PI Flag 기반 답변 생성에 실패했습니다.';
            } finally {
                if (requestId === this.piFlagChatSeq) {
                    this.piFlagChatLoading = false;
                }
            }
        },

        requestDeleteElementComment(commentId) {
            this.commentDeleteTarget = { mode: 'element', commentId };
            this.commentDeleteDialogVisible = true;
        },

        requestDeletePiFlagComment(elementId, commentId) {
            this.commentDeleteTarget = { mode: 'pi-flag', elementId, commentId };
            this.commentDeleteDialogVisible = true;
        },

        // 카드(요소) 안에서 2개 이상 요소에 걸친 묶음 코멘트의 그룹 키 목록
        piFlagEntryGroupKeys(entry) {
            const keys = [];
            (entry?.comments || []).forEach(c => {
                const key = c.groupId || c.id;
                if (key && (this.commentGroupIndex.get(key)?.length || 0) > 1 && !keys.includes(key)) {
                    keys.push(key);
                }
            });
            return keys;
        },

        requestDeletePiFlagGroup(entry) {
            const groupKeys = this.piFlagEntryGroupKeys(entry);
            if (!groupKeys.length) return;
            this.commentDeleteTarget = { mode: 'pi-flag-group', groupKeys };
            this.commentDeleteDialogVisible = true;
        },

        // 묶음에서 특정 task 하나만 빼냄 (그 task 에서만 해당 코멘트 제거 — 묶음은 같은 id 로
        // 복제 저장되므로 기존 개별 삭제(deletePiFlagComment)를 그대로 재사용)
        requestRemovePiFlagFromTask(elementId, commentId) {
            if (!elementId || !commentId) return;
            this.commentDeleteTarget = { mode: 'pi-flag-from-task', elementId, commentId };
            this.commentDeleteDialogVisible = true;
        },

        cancelCommentDelete() {
            this.commentDeleteDialogVisible = false;
            this.commentDeleteTarget = null;
        },

        async confirmCommentDelete() {
            const target = this.commentDeleteTarget;
            this.commentDeleteDialogVisible = false;
            this.commentDeleteTarget = null;
            if (!target) return;
            if (target.mode === 'element') {
                await this.deleteElementComment(target.commentId);
            } else if (target.mode === 'pi-flag') {
                await this.deletePiFlagComment(target.elementId, target.commentId);
            } else if (target.mode === 'pi-flag-group') {
                for (const groupKey of target.groupKeys) {
                    await this.deletePiFlagCommentGroup(groupKey);
                }
            } else if (target.mode === 'pi-flag-from-task') {
                await this.deletePiFlagComment(target.elementId, target.commentId);
            } else if (target.mode === 'feedback') {
                await this.deleteFeedback(target.commentId);
            }
        },

        async deletePiFlagComment(elementId, commentId) {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');

            const shapeElement = elementRegistry.get(elementId);
            if (!shapeElement) return;

            const bo = shapeElement.businessObject;
            const propsEl = bo.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
            if (!propsEl?.json) return;
            let uengineProps = {};
            try { uengineProps = JSON.parse(propsEl.json); } catch { return; }
            const existing = Array.isArray(uengineProps.comments) ? uengineProps.comments : [];
            uengineProps.comments = existing.filter(c => c.id !== commentId);

            const json = JSON.stringify(uengineProps);
            const otherExtValues = bo.extensionElements?.values
                ? bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties')
                : [];
            const existingVars = propsEl?.variables || [];
            const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables: existingVars });
            const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                values: [...otherExtValues, uengineEl],
            });
            modeling.updateProperties(shapeElement, { extensionElements: newExtElements });

            if (this.activeElement?.id === elementId) {
                this.elementComments = this.elementComments.filter(c => c.id !== commentId);
            }

            this.bpmnDataVersion++;
            this.$emit('taskMappingChanged');
        },

        // 묶음(groupId) 코멘트를 연관된 모든 요소에서 한 번에 삭제
        async deletePiFlagCommentGroup(groupKey) {
            if (!groupKey) return;
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');

            // 삭제 전에 멤버 요소 목록을 캡처 (이후 model 변경으로 index 가 갱신되므로)
            const members = [...(this.commentGroupIndex.get(groupKey) || [])];

            members.forEach(({ id: elementId }) => {
                const shapeElement = elementRegistry.get(elementId);
                if (!shapeElement) return;
                const bo = shapeElement.businessObject;
                const propsEl = bo.extensionElements?.values?.find(v => v.$type === 'uengine:Properties');
                if (!propsEl?.json) return;
                let uengineProps = {};
                try { uengineProps = JSON.parse(propsEl.json); } catch { return; }
                const existing = Array.isArray(uengineProps.comments) ? uengineProps.comments : [];
                uengineProps.comments = existing.filter(c => (c.groupId || c.id) !== groupKey);

                const json = JSON.stringify(uengineProps);
                const otherExtValues = bo.extensionElements?.values
                    ? bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties')
                    : [];
                const existingVars = propsEl?.variables || [];
                const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables: existingVars });
                const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                    values: [...otherExtValues, uengineEl],
                });
                modeling.updateProperties(shapeElement, { extensionElements: newExtElements });
            });

            // 현재 열린 요소의 코멘트 동기화
            this.elementComments = this.elementComments.filter(c => (c.groupId || c.id) !== groupKey);

            this.bpmnDataVersion++;
            this.$emit('taskMappingChanged');
        },

        formatCommentTime(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const diffMin = Math.floor((Date.now() - date) / 60000);
            if (diffMin < 1) return '방금';
            if (diffMin < 60) return `${diffMin}분 전`;
            const diffHour = Math.floor(diffMin / 60);
            if (diffHour < 24) return `${diffHour}시간 전`;
            const diffDay = Math.floor(diffHour / 24);
            if (diffDay < 7) return `${diffDay}일 전`;
            return formatKST(timestamp, 'M월 D일');
        },

        getGroupedSiblings(comment, excludeElementId) {
            if (!comment) return [];
            const key = comment.groupId || comment.id;
            if (!key) return [];
            const list = this.commentGroupIndex.get(key) || [];
            if (list.length <= 1) return [];
            return excludeElementId ? list.filter(e => e.id !== excludeElementId) : list;
        },

        isDefaultSequenceFlowElement(el) {
            const bo = el?.businessObject;
            if (!bo) return false;
            const defaultFlow = bo.sourceRef?.default || el.source?.businessObject?.default;
            return defaultFlow === bo || toSafeText(defaultFlow?.id).trim() === toSafeText(bo.id || el.id).trim();
        },

        getSequenceFlowType(el) {
            if (this.isDefaultSequenceFlowElement(el)) return 'default';
            if (el?.businessObject?.conditionExpression) return 'condition';
            return 'sequence';
        },

        bindBpmnElementChangedHandler() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            const eventBus = modeler?.get?.('eventBus');
            if (!eventBus || this._bpmnElementChangedHandler) return;

            this._bpmnEventBus = eventBus;
            this._bpmnElementChangedHandler = (event) => {
                const changedElement = event?.element;
                if (!changedElement || changedElement.id !== this.activeElement?.id) return;
                if (changedElement.type !== 'bpmn:SequenceFlow') return;
                if (this.taskFormDirty || this._taskFormLoading) return;

                this.activeElement = changedElement;
                this.loadTaskProperties(changedElement);
            };
            eventBus.on('element.changed', this._bpmnElementChangedHandler);
        },

        unbindBpmnElementChangedHandler() {
            if (this._bpmnEventBus && this._bpmnElementChangedHandler) {
                this._bpmnEventBus.off('element.changed', this._bpmnElementChangedHandler);
            }
            this._bpmnEventBus = null;
            this._bpmnElementChangedHandler = null;
        },

        // businessObject 에서 uengine:Properties JSON 을 파싱 (values[0] 고정 대신 타입으로 탐색
        // — zeebe:UserTask 등 다른 extension 이 0번에 오면 values[0] 로는 못 읽기 때문)
        readUengineProps(bo) {
            const el = bo?.extensionElements?.values?.find((v) => v.$type === 'uengine:Properties');
            if (!el?.json) return {};
            try { return JSON.parse(el.json) || {}; } catch { return {}; }
        },

        // taskForm.apiIntegrations 와 파라미터 입력 버퍼(apiParamDrafts)의 인덱스를 동기화.
        ensureApiParamDrafts() {
            const n = (this.taskForm.apiIntegrations || []).length;
            const drafts = Array.isArray(this.apiParamDrafts) ? this.apiParamDrafts : [];
            while (drafts.length < n) drafts.push({ key: '', value: '' });
            if (drafts.length > n) drafts.length = n;
            this.apiParamDrafts = drafts;
        },
        addApiIntegration() {
            if (!Array.isArray(this.taskForm.apiIntegrations)) this.taskForm.apiIntegrations = [];
            this.taskForm.apiIntegrations.push({ name: '', method: '', url: '', params: [] });
            this.ensureApiParamDrafts();
        },
        askRemoveApiIntegration(idx) {
            this.apiEntryDeleteIdx = idx;
            this.apiEntryDeleteDialog = true;
        },
        cancelRemoveApiIntegration() {
            this.apiEntryDeleteDialog = false;
            this.apiEntryDeleteIdx = null;
        },
        confirmRemoveApiIntegration() {
            if (this.apiEntryDeleteIdx != null && Array.isArray(this.taskForm.apiIntegrations)) {
                this.taskForm.apiIntegrations.splice(this.apiEntryDeleteIdx, 1);
                this.ensureApiParamDrafts();
            }
            this.editingApiParam = null;
            this.cancelRemoveApiIntegration();
        },
        isEditingApiParam(entryIdx, paramIdx) {
            return !!this.editingApiParam && this.editingApiParam.entry === entryIdx && this.editingApiParam.param === paramIdx;
        },
        addApiParam(entryIdx) {
            const api = (this.taskForm.apiIntegrations || [])[entryIdx];
            const draft = (this.apiParamDrafts || [])[entryIdx];
            if (!api || !draft || !api.method || !api.url) return;
            const key = (draft.key || '').trim();
            if (!key) return;
            const value = (draft.value || '').trim();
            if (!Array.isArray(api.params)) api.params = [];
            api.params.push({ key, value });
            draft.key = '';
            draft.value = '';
        },
        removeApiParam(entryIdx, paramIdx) {
            const api = (this.taskForm.apiIntegrations || [])[entryIdx];
            if (!api || !Array.isArray(api.params)) return;
            api.params.splice(paramIdx, 1);
        },
        askRemoveApiParam(entryIdx, paramIdx) {
            this.apiParamDeleteRef = { entry: entryIdx, param: paramIdx };
            this.apiParamDeleteDialog = true;
        },
        cancelRemoveApiParam() {
            this.apiParamDeleteDialog = false;
            this.apiParamDeleteRef = null;
        },
        confirmRemoveApiParam() {
            if (this.apiParamDeleteRef) this.removeApiParam(this.apiParamDeleteRef.entry, this.apiParamDeleteRef.param);
            this.editingApiParam = null;
            this.cancelRemoveApiParam();
        },

        // ---- Task: BPMN data sync ----
        loadTaskProperties(el) {
            this._taskFormLoading = true;
            const bo = el.businessObject;
            this.taskForm.name = toSafeText(bo?.name);

            const uengineProps = this.readUengineProps(bo);

            this.elementComments = Array.isArray(uengineProps.comments) ? [...uengineProps.comments] : [];
            this.newCommentStatus = 'open';
            this.newCommentType = '';
            this.newCommentDescription = '';

            this.taskForm.description = uengineProps.description || '';
            const rawTaskManualLinks = Array.isArray(uengineProps.manualLinks)
                ? uengineProps.manualLinks
                : (uengineProps.manualLink ? [uengineProps.manualLink] : []);
            this.taskForm.manualLinks = rawTaskManualLinks
                .map((item) => {
                    if (item == null) return null;
                    if (typeof item === 'string') {
                        const url = item.trim();
                        return url ? { name: '', url } : null;
                    }
                    if (typeof item === 'object') {
                        const url = toSafeText(item.url ?? '').trim();
                        if (!url) return null;
                        const name = toSafeText(item.name ?? item.displayName ?? '').trim();
                        return { name, url };
                    }
                    return null;
                })
                .filter(Boolean);
            this.taskForm.systems = this.normalizeSystemList(uengineProps.systems).slice(0, 1);
            this.taskForm.fte = { ...defaultFte(), ...(uengineProps.fte || {}) };
            this.taskForm.futureStatus = toSafeText(uengineProps.futureStatus || 'maintain') || 'maintain';
            this.taskForm.dataAttachmentUrl = toSafeText(uengineProps.dataAttachmentUrl || '');
            this.taskForm.dataAttachmentFile = uengineProps.dataAttachmentFile && typeof uengineProps.dataAttachmentFile === 'object'
                ? { ...uengineProps.dataAttachmentFile }
                : null;
            
            // API 연동: 신형 apiIntegrations 배열 우선, 레거시 단일 필드(apiName/...)는 1개 항목으로 승격.
            this.taskForm.apiIntegrations = readApiIntegrations(uengineProps).map((a) => ({
                name: a.name,
                method: a.method,
                url: a.url,
                params: a.params.map((p) => ({ ...p }))
            }));
            this.apiParamDrafts = [];
            this.ensureApiParamDrafts();
            this.editingApiParam = null;
            // 엔진이 실제 평가하는 값은 uengine bag의 conditionFunction — 이를 우선 표시하고,
            // 없으면 BPMN 표준 conditionExpression body 로 폴백한다 (저장 시 양쪽에 동기화됨).
            const actualConditionExpression = readConditionExpressionBody(bo?.conditionExpression);
            this.taskForm.conditionExpression = toSafeText(uengineProps.conditionFunction).trim() || actualConditionExpression;
            this.taskForm.flowType = this.getSequenceFlowType(el);
            // 분기 평가 방식: conditionMode='llm' 이면 폴링 엔진이 결정적 eval 대신 LLM 맥락 판단 사용
            this.taskForm.conditionLlmMode = toSafeText(uengineProps.conditionMode).trim().toLowerCase() === 'llm';

            // CallActivity / StartEvent / EndEvent: definitionId 로드
            const elType = toSafeText(el.type || el.$type).trim();
            if (elType === 'bpmn:CallActivity' || elType === 'bpmn:StartEvent' || elType === 'bpmn:EndEvent') {
                const definitionValue = toSafeText(uengineProps.definitionId || bo?.calledElement).trim();
                this.callActivityDefinitionId = this.normalizeCallActivityDefinitionPath(definitionValue);
                this.callActivityDefinitionName = toSafeText(uengineProps.definitionName).trim();
                this.callActivitySearchResults = [];
                this.resolveCallActivityDefinitionName(definitionValue);
            } else {
                this.callActivityDefinitionId = '';
                this.callActivityDefinitionName = '';
                this.callActivityDefinitionDeleted = false;
                this.callActivitySearchResults = [];
            }

            // BPMN 데이터 입출력(DataObject/DataStore 연결) 로드 — 조회 전용
            const readDataRefs = (assocs, refKey) =>
                (assocs || [])
                    .map((assoc) => {
                        const ref = refKey === 'source'
                            ? (Array.isArray(assoc.sourceRef) ? assoc.sourceRef[0] : assoc.sourceRef)
                            : assoc.targetRef;
                        if (!ref) return null;
                        const refType = toSafeText(ref.$type).trim();
                        if (refType !== 'bpmn:DataStoreReference' && refType !== 'bpmn:DataObjectReference') return null;
                        return {
                            name: toSafeText(ref.name || ref.id).replace(/\s+/g, ' ').trim(),
                            kind: refType === 'bpmn:DataStoreReference' ? 'store' : 'object'
                        };
                    })
                    .filter(Boolean);
            this.taskDataInputs = readDataRefs(bo?.dataInputAssociations, 'source');
            this.taskDataOutputs = readDataRefs(bo?.dataOutputAssociations, 'target');

            // UserTask 계열: 연결된 폼 로드 (구 BPMN 편집기와 동일 규약 tool='formHandler:<id>')
            if (elType === 'bpmn:UserTask' || elType === 'bpmn:Task' || elType === 'bpmn:ManualTask') {
                const activityTool = toSafeText(uengineProps.tool).trim();
                this.taskFormLinkId = activityTool.startsWith('formHandler:')
                    ? activityTool.slice('formHandler:'.length).trim()
                    : '';
                this.loadFormDefList();
            } else {
                this.taskFormLinkId = '';
            }

            // BusinessRuleTask: 연결된 DMN 룰 로드 (구 BPMN 편집기 저장 위치 호환 포함)
            if (elType === 'bpmn:BusinessRuleTask') {
                this.businessRuleId = toSafeText(
                    uengineProps.businessRuleId || uengineProps.eventSynchronization?.businessRuleId
                ).trim();
                this.businessRulePreview = null;
                this.loadBusinessRuleList();
                if (this.businessRuleId) this.loadBusinessRulePreview(this.businessRuleId);
            } else {
                this.businessRuleId = '';
                this.businessRulePreview = null;
            }

            // ServiceTask 실행 설정(agent/agentEnabled/http) UI 는 순서도 패널에서 제거됨 —
            // 관련 속성 로드·에이전트 목록 조회도 하지 않는다 (BPMN 의 기존 값은 저장 시 그대로 보존).

            // SendTask: 메일 설정 로드 (recipients 배열 우선, 레거시 to 콤마 문자열 폴백)
            if (elType === 'bpmn:SendTask') {
                const savedRecipients = uengineProps.recipients;
                if (Array.isArray(savedRecipients)) {
                    this.sendTaskRecipients = savedRecipients.map((r) => toSafeText(r).trim()).filter(Boolean);
                } else {
                    this.sendTaskRecipients = toSafeText(uengineProps.to)
                        .split(',')
                        .map((r) => r.trim())
                        .filter(Boolean);
                }
                this.sendTaskMailTitle = toSafeText(uengineProps.title);
                this.sendTaskMailContents = toSafeText(uengineProps.contents);
                this.loadSendTaskUserList();
            } else {
                this.sendTaskRecipients = [];
                this.sendTaskMailTitle = '';
                this.sendTaskMailContents = '';
            }

            if (elType === 'bpmn:SequenceFlow') {
                this.taskForm.relatedProjects = [];
                this.taskForm.opexCost = null;
                this.taskForm.opexUnit = '건당';
                this.taskForm.opexNote = '';
                this.taskForm.schemaProps = {};
                this.$nextTick(() => {
                    this._taskFormLoading = false;
                    this.taskFormDirty = false;
                });
                return;
            }

            // Lane 담당자/조직 정보 로드
            if (elType.toLowerCase().includes('lane')) {
                this.taskForm.name = toSafeText(el.businessObject?.name);
                let savedResourceType = toSafeText(uengineProps.laneResourceType || 'internal') || 'internal';
                this.laneAssigneeType = toSafeText(uengineProps.laneAssigneeType || 'org') || 'org';
                const savedUsers = uengineProps.laneAssignee;
                this.laneAssignee = (Array.isArray(savedUsers) ? savedUsers : (savedUsers ? [savedUsers] : [])).map((user, index) => {
                    const base = user && typeof user === 'object' ? user : {};
                    const label = toSafeText(base.label || base.name || base.email || user || `user-${index}`);
                    const email = toSafeText(base.email || base.id || user).trim();
                    const name = toSafeText(base.name || base.label || user);
                    const userId = toSafeText(base.user_id || '').trim();
                    const orgName = toSafeText(base.org_name || '');
                    const orgId = toSafeText(base.org_id || '').trim();
                    const compound = `${userId}|${email}|${name}|${orgName}|${orgId}`;
                    const key = toSafeText(base.key) || compound.replace(/^\|+|\|+$/g, '') || `${name}|${orgName}|${index}`;
                    return {
                        ...base,
                        label,
                        email,
                        name,
                        user_id: userId,
                        org_name: orgName,
                        org_id: orgId,
                        key,
                    };
                });
                const savedOrgs = uengineProps.laneOrganization;
                this.laneOrganization = (Array.isArray(savedOrgs) ? savedOrgs : (savedOrgs ? [savedOrgs] : [])).map((org, index) => ({
                    ...(org && typeof org === 'object' ? org : {}),
                    id: toSafeText(org?.id || org?.value || org || `org-${index}`).trim(),
                    name: toSafeText(org?.name || org?.label || org || `org-${index}`),
                }));
                if (this.laneAssignee.length) {
                    this.laneUserOptions = [...this.laneAssignee];
                }
                if (this.laneOrganization.length) {
                    this.laneGroupOptions = [...this.laneOrganization];
                }
                // 기존 'family' 로 저장된 데이터는 'internal' 로 자동 변환 (패밀리사 토글 제거됨)
                if (savedResourceType === 'family') {
                    savedResourceType = 'internal';
                }
                this.laneResourceType = savedResourceType;
                // 역할 그룹 그룹 흔적 복원 (role_group 모드일 때만 유효)
                // 신규 포맷: laneRoleGroupIds (array). 구포맷 호환: laneRoleGroupId (단일 string)
                let savedIds = [];
                if (Array.isArray(uengineProps.laneRoleGroupIds)) {
                    savedIds = uengineProps.laneRoleGroupIds.map((x) => toSafeText(x).trim()).filter(Boolean);
                } else if (uengineProps.laneRoleGroupId) {
                    const legacy = toSafeText(uengineProps.laneRoleGroupId).trim();
                    if (legacy) savedIds = [legacy];
                }
                this.laneRoleGroupIds = savedIds;
                if (savedResourceType === 'role_group' && savedIds.length) {
                    this.laneRoleGroupSelectedList = savedIds
                        .map((id) => this.laneRoleGroupOptions.find((o) => o.id === id))
                        .filter(Boolean);
                    // 최신 그룹 정의 기준으로 laneOrganization/laneSupplier 자동 갱신
                    if (this.laneRoleGroupSelectedList.length) {
                        this.refreshLaneRoleGroupOrgs();
                    }
                } else {
                    this.laneRoleGroupSelectedList = [];
                }
                this.laneDescription = toSafeText(uengineProps.laneDescription);
                const savedSupplier = uengineProps.laneSupplier;
                if (Array.isArray(savedSupplier) && savedSupplier.length) {
                    this.laneSupplier = savedSupplier;
                    this.laneSupplierOptions = [...savedSupplier];
                } else if (savedSupplier && typeof savedSupplier === 'object' && !Array.isArray(savedSupplier)) {
                    // 단일 객체 -> 배열 마이그레이션
                    const item = {
                        id: toSafeText(savedSupplier.id || '').trim(),
                        name: toSafeText(savedSupplier.name || savedSupplier.displayName || ''),
                        displayName: toSafeText(savedSupplier.displayName || savedSupplier.name || ''),
                    };
                    this.laneSupplier = [item];
                    this.laneSupplierOptions = [item];
                } else {
                    this.laneSupplier = [];
                    this.laneSupplierOptions = [];
                }
                this.$nextTick(() => {
                    this._taskFormLoading = false;
                    this.taskFormDirty = false;
                });
                return;
            }

            this.taskForm.relatedProjects = Array.isArray(uengineProps.relatedProjects)
                ? uengineProps.relatedProjects
                    .map(v => {
                        if (typeof v === 'string') return { id: null, name: v };
                        if (v && typeof v === 'object') {
                            const out = {
                                id: v.id ?? v.task_id ?? null,
                                name: v.name ?? v.title ?? '',
                            };
                            if (v.groupId) out.groupId = v.groupId;
                            return out;
                        }
                        return null;
                    })
                    .filter(v => v && v.name)
                : [];
            this.taskForm.opexCost = uengineProps.opexCost ?? null;
            this.taskForm.opexUnit = toSafeText(uengineProps.opexUnit || '건당') || '건당';
            this.taskForm.opexNote = toSafeText(uengineProps.opexNote);

            const schemaProps = {};
            this.taskFields.forEach(f => {
                if (f.property_type === 'daterange') {
                    const startKey = f.property_key + '_start';
                    const endKey = f.property_key + '_end';
                    schemaProps[startKey] = toSafeText(uengineProps[startKey]);
                    schemaProps[endKey] = toSafeText(uengineProps[endKey]);
                } else {
                    schemaProps[f.property_key] = this.coerceFieldFormValue(uengineProps[f.property_key] ?? f.default_value ?? null, f);
                }
            });
            this.taskForm.schemaProps = schemaProps;
            this.loadApiSelectItems(this.taskFields);
            this.$nextTick(() => {
                this._taskFormLoading = false;
                this.taskFormDirty = false;
            });
        },

        normalizeCallActivityDefinitionId(value) {
            return toSafeText(value).trim().replace(/\.bpmn$/i, '');
        },

        normalizeCallActivityDefinitionPath(value) {
            const id = this.normalizeCallActivityDefinitionId(value);
            return id ? `${id}.bpmn` : '';
        },

        buildCallActivityCountItems(counts) {
            return buildTaskCountItems(counts || {}).items;
        },

        // parent 요약 목록에서 child 프로세스 task 를 "프로세스명 ▸ task명" 으로 표시
        callActivityTaskLabel(t) {
            const processName = toSafeText(t?.processName).trim();
            const taskName = toSafeText(t?.name).trim() || toSafeText(t?.id).trim();
            return processName ? `${processName} ▸ ${taskName}` : taskName;
        },

        resolveCallActivityDefinitionBpmnXml(procRow) {
            if (!procRow) return '';
            const def = procRow.definition;
            const candidates = [
                procRow.bpmn,
                def?.bpmn,
                def?.snapshot,
                def?.xml,
                def?.content,
                def?.definition?.bpmn,
                def?.definition?.snapshot,
            ];
            for (const candidate of candidates) {
                if (typeof candidate === 'string' && candidate.trim()) return candidate;
            }
            return '';
        },

        parseBpmnTaskCounts(xmlStr) {
            const counts = {};
            const childCallActivityDefIds = [];
            const tasks = [];
            if (!xmlStr) return { counts, childCallActivityDefIds, tasks };
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(xmlStr, 'application/xml');

                // 요소 "직속" extensionElements > properties 의 json 만 읽는다.
                // (getElementsByTagName* 은 자손 전체를 뒤져 subProcess 내부 task 속성이 섞임)
                const readOwnUengineJson = (el) => {
                    for (const child of el.children) {
                        if (toSafeText(child.localName).trim() !== 'extensionElements') continue;
                        for (const ext of child.children) {
                            if (toSafeText(ext.localName).trim() !== 'properties') continue;
                            const jsonAttr = ext.getAttribute('json');
                            if (!jsonAttr) continue;
                            try { return JSON.parse(jsonAttr) || {}; } catch { /* ignore */ }
                        }
                    }
                    return {};
                };

                // lane 의 laneResourceType → 소속 task(flowNodeRef) 매핑 (비용 내부/외부 분류용)
                const laneResourceTypeByTaskId = {};
                const allElements = doc.getElementsByTagName('*');
                for (let i = 0; i < allElements.length; i++) {
                    const laneEl = allElements[i];
                    if (toSafeText(laneEl.localName).trim() !== 'lane') continue;
                    const laneProps = readOwnUengineJson(laneEl);
                    const resourceType = toSafeText(laneProps.laneResourceType).trim();
                    if (!resourceType) continue;
                    for (const refEl of laneEl.children) {
                        if (toSafeText(refEl.localName).trim() !== 'flowNodeRef') continue;
                        const refId = toSafeText(refEl.textContent).trim();
                        if (refId) laneResourceTypeByTaskId[refId] = resourceType;
                    }
                }

                const taskLocalNames = new Set([
                    'task', 'userTask', 'manualTask', 'serviceTask', 'scriptTask',
                    'businessRuleTask', 'sendTask', 'receiveTask', 'subProcess', 'callActivity',
                ]);
                for (let i = 0; i < allElements.length; i++) {
                    const el = allElements[i];
                    const localName = toSafeText(el.localName).trim();
                    if (!taskLocalNames.has(localName)) continue;
                    const bpmnType = `bpmn:${localName.charAt(0).toUpperCase()}${localName.slice(1)}`;
                    counts[bpmnType] = (counts[bpmnType] || 0) + 1;
                    const elId = toSafeText(el.getAttribute('id')).trim();
                    tasks.push({
                        id: elId,
                        name: toSafeText(el.getAttribute('name')).trim() || elId,
                        type: bpmnType,
                        props: readOwnUengineJson(el),
                        resourceType: laneResourceTypeByTaskId[elId] || 'internal',
                    });
                    if (localName === 'callActivity') {
                        const calledAttr = el.getAttribute('calledElement') || '';
                        let childId = this.normalizeCallActivityDefinitionId(calledAttr);
                        if (!childId) {
                            const uengineProps = el.getElementsByTagNameNS('*', 'properties');
                            for (let j = 0; j < uengineProps.length; j++) {
                                const jsonAttr = uengineProps[j].getAttribute('json');
                                if (!jsonAttr) continue;
                                try {
                                    const parsedProps = JSON.parse(jsonAttr);
                                    if (parsedProps?.definitionId) {
                                        childId = this.normalizeCallActivityDefinitionId(parsedProps.definitionId);
                                        break;
                                    }
                                } catch { /* ignore */ }
                            }
                        }
                        if (childId) childCallActivityDefIds.push(childId);
                    }
                }
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] parseBpmnTaskCounts failed', e);
            }
            return { counts, childCallActivityDefIds, tasks };
        },

        async fetchAndAggregateCallActivityCounts(defId, ancestry) {
            const normalizedId = this.normalizeCallActivityDefinitionId(defId);
            if (!normalizedId) return { name: '', counts: {}, total: 0, tasks: [] };
            const supabase = window.$supabase;
            if (!supabase) return { name: normalizedId, counts: {}, total: 0, tasks: [] };
            const { data, error } = await supabase
                .from('proc_def')
                .select('id, name, definition, bpmn')
                .eq('tenant_id', window.$tenantName)
                .eq('id', normalizedId)
                .is('deleted_at', null)
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            if (!data) return { name: normalizedId, counts: {}, total: 0, tasks: [] };

            const xml = this.resolveCallActivityDefinitionBpmnXml(data);
            const { counts, childCallActivityDefIds, tasks } = this.parseBpmnTaskCounts(xml);
            const aggregatedCounts = { ...counts };
            const name = toSafeText(data.name).trim() || normalizedId;
            // 이 정의 소속 task 에 출처 프로세스명을 태깅 (parent 요약에서 라벨로 사용)
            const aggregatedTasks = tasks.map((t) => ({ ...t, processName: name }));

            for (const childId of childCallActivityDefIds) {
                if (!childId || ancestry.has(childId)) continue;
                const childAncestry = new Set([...ancestry, childId]);
                try {
                    const childResult = await this.fetchAndAggregateCallActivityCounts(childId, childAncestry);
                    for (const [type, count] of Object.entries(childResult.counts)) {
                        aggregatedCounts[type] = (aggregatedCounts[type] || 0) + count;
                    }
                    aggregatedTasks.push(...(childResult.tasks || []));
                } catch (e) {
                    console.warn('[ProcessHierarchyProperties] child CallActivity aggregation failed', childId, e);
                }
            }

            const total = Object.values(aggregatedCounts).reduce((sum, v) => sum + v, 0);
            return { name, counts: aggregatedCounts, total, tasks: aggregatedTasks };
        },

        async ensureCallActivityData(defId) {
            const normalizedId = this.normalizeCallActivityDefinitionId(defId);
            if (!normalizedId) return;
            if (this.callActivityDataCache[normalizedId]) return;
            this.callActivityDataCache = {
                ...this.callActivityDataCache,
                [normalizedId]: { status: 'loading', name: '', counts: {}, total: 0, tasks: [], error: null },
            };
            try {
                const result = await this.fetchAndAggregateCallActivityCounts(
                    normalizedId,
                    new Set([normalizedId])
                );
                this.callActivityDataCache = {
                    ...this.callActivityDataCache,
                    [normalizedId]: {
                        status: 'loaded',
                        name: result.name,
                        counts: result.counts,
                        total: result.total,
                        tasks: result.tasks || [],
                        error: null,
                    },
                };
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] ensureCallActivityData failed', normalizedId, e);
                this.callActivityDataCache = {
                    ...this.callActivityDataCache,
                    [normalizedId]: {
                        status: 'error',
                        name: '',
                        counts: {},
                        total: 0,
                        tasks: [],
                        error: e?.message || String(e),
                    },
                };
            }
        },

        findCallActivityItem(value) {
            const id = this.normalizeCallActivityDefinitionId(value);
            if (!id) return null;
            return (this.callActivityDisplayItems || []).find((item) => this.normalizeCallActivityDefinitionId(item?.path || item?.id) === id) || null;
        },

        async resolveCallActivityDefinitionName(value, options = {}) {
            const id = this.normalizeCallActivityDefinitionId(value);
            this.callActivityDefinitionDeleted = false;
            if (!id) {
                this.callActivityDefinitionName = '';
                return '';
            }

            const existing = this.findCallActivityItem(id);
            const existingName = toSafeText(existing?.name).trim();
            if (existingName && existingName !== id) {
                this.callActivityDefinitionName = existingName;
                if (options.updateTaskTitle) this.taskForm.name = existingName;
                return existingName;
            }

            try {
                const supabase = window.$supabase;
                if (!supabase) return '';
                // 이미 선택돼 참조 중인 정의의 "이름 표시"용 조회이므로 소프트 삭제된
                // 정의(deleted_at)도 포함해야 id 대신 실제 이름이 보인다.
                // (신규 선택 검색 onCallActivitySearch 는 삭제건 제외를 유지한다.)
                const { data, error } = await supabase
                    .from('proc_def')
                    .select('id, name, deleted_at')
                    .eq('tenant_id', window.$tenantName)
                    .eq('id', id)
                    .limit(1)
                    .maybeSingle();
                if (error) throw error;

                // 비동기 응답 도착 시 다른 요소로 바뀌었으면 무시
                if (this.normalizeCallActivityDefinitionId(this.callActivityDefinitionId) !== id) {
                    return toSafeText(data?.name).trim();
                }

                // 참조 정의가 없음(영구 삭제 등) 또는 소프트 삭제됨 → 삭제된 모듈로 표시
                if (!data) {
                    this.callActivityDefinitionDeleted = true;
                    return '';
                }
                this.callActivityDefinitionDeleted = !!data.deleted_at;

                const name = toSafeText(data.name).trim();
                if (!name) return name;

                const item = {
                    id,
                    name,
                    path: this.normalizeCallActivityDefinitionPath(id)
                };
                const exists = (this.callActivitySearchResults || []).some((result) => this.normalizeCallActivityDefinitionId(result?.path || result?.id) === id);
                if (!exists) {
                    this.callActivitySearchResults = [item, ...(this.callActivitySearchResults || [])];
                }
                this.callActivityDefinitionName = name;
                if (options.updateTaskTitle) this.taskForm.name = name;
                return name;
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] resolveCallActivityDefinitionName failed', e);
                return '';
            }
        },

        async onCallActivityDefinitionSelected(value) {
            const path = this.normalizeCallActivityDefinitionPath(value);
            this.callActivityDefinitionId = path;
            this.callActivityDefinitionDeleted = false;
            if (!path) {
                this.callActivityDefinitionName = '';
                return;
            }

            const selected = this.findCallActivityItem(path);
            const selectedName = toSafeText(selected?.name).trim();
            if (selectedName && selectedName !== this.normalizeCallActivityDefinitionId(path)) {
                this.callActivityDefinitionName = selectedName;
                this.taskForm.name = selectedName;
                return;
            }

            await this.resolveCallActivityDefinitionName(path, { updateTaskTitle: true });
        },

        onCallActivitySearch(keyword) {
            clearTimeout(this._callActivitySearchTimer);
            const normalizedKeyword = toSafeText(keyword).trim();
            if (!normalizedKeyword || normalizedKeyword.length < 1) {
                this.callActivitySearchResults = this.callActivityDefinitionName && this.callActivityDefinitionId
                    ? [{
                        id: this.normalizeCallActivityDefinitionId(this.callActivityDefinitionId),
                        name: this.callActivityDefinitionName,
                        path: this.normalizeCallActivityDefinitionPath(this.callActivityDefinitionId)
                    }]
                    : [];
                return;
            }
            this._callActivitySearchTimer = setTimeout(async () => {
                this.callActivitySearchLoading = true;
                try {
                    const supabase = window.$supabase;
                    if (!supabase) return;
                    const { data, error } = await supabase
                        .from('proc_def')
                        .select('id, name')
                        .eq('tenant_id', window.$tenantName)
                        .is('deleted_at', null)
                        .ilike('name', `%${normalizedKeyword}%`)
                        .limit(20);
                    if (error) throw error;
                    this.callActivitySearchResults = (data || []).map(item => ({
                        ...item,
                        id: toSafeText(item.id).trim(),
                        name: toSafeText(item.name),
                        path: `${toSafeText(item.id).trim()}.bpmn`
                    }));
                } catch (e) {
                    console.warn('[ProcessHierarchyProperties] onCallActivitySearch failed', e);
                } finally {
                    this.callActivitySearchLoading = false;
                }
            }, 300);
        },


        onAtdtRelatedProjectsMenu(isOpen) {
            if (!isOpen) return;
            if (this.atdtTaskListLoaded || this.atdtTaskListLoading) return;
            this.loadAtdtTaskList();
        },
        async loadAtdtTaskList() {
            if (this.atdtTaskListLoading) return;
            this.atdtTaskListLoading = true;
            try {
                const res = await fetch('/atdt-task-mgmt/api/tasks/', {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                });
                if (!res.ok) throw new Error(`ATDT task list fetch failed: ${res.status}`);
                const payload = await res.json();
                const rawList = Array.isArray(payload?.data)
                    ? payload.data
                    : (Array.isArray(payload) ? payload : []);
                this.atdtTaskList = rawList
                    .map(item => ({
                        id: item?.id ?? null,
                        name: item?.title ?? '',
                    }))
                    .filter(item => !!item.name);
                this.atdtTaskListLoaded = true;
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] loadAtdtTaskList failed', e);
                this.atdtTaskList = [];
                this.atdtTaskListLoaded = false;
            } finally {
                this.atdtTaskListLoading = false;
            }
        },
        buildAtdtTaskDetailUrl(taskId) {
            if (!taskId) return '';
            return `/atdt-task-mgmt-web/tasks/${encodeURIComponent(taskId)}`;
        },

        onAtdtSystemsMenu(isOpen) {
            if (!isOpen) return;
            if (this.atdtSystemListLoaded || this.atdtSystemListLoading) return;
            this.loadAtdtSystemList();
        },
        async loadAtdtSystemList() {
            if (this.atdtSystemListLoading) return;
            this.atdtSystemListLoading = true;
            try {
                const res = await fetch('/pi-system-backend/systems', {
                    headers: { 'Accept': 'application/json' },
                    credentials: 'include',
                });
                if (!res.ok) throw new Error(`System list fetch failed: ${res.status}`);
                const payload = await res.json();
                const rawList = Array.isArray(payload) ? payload : [];
                this.atdtSystemList = rawList
                    .map(item => ({
                        id: item?.id ?? null,
                        name: item?.name ?? '',
                    }))
                    .filter(item => !!item.name);
                this.atdtSystemListLoaded = true;
            } catch (e) {
                console.warn('[ProcessHierarchyProperties] loadAtdtSystemList failed', e);
                this.atdtSystemList = [];
                this.atdtSystemListLoaded = false;
            } finally {
                this.atdtSystemListLoading = false;
            }
        },
        buildAtdtSystemDetailUrl(systemId) {
            if (!systemId) return '';
            return `/atdt-task-mgmt/api/info/systems/${encodeURIComponent(systemId)}`;
        },

        saveProcess() {
            if (this.isViewMode) {
                this.$toast?.warning(this.readOnlyMessage || '읽기 전용 모드에서는 저장할 수 없습니다.');
                return;
            }
            const data = {
                name: this.processForm.title,
                description: this.processForm.description,
                owner: this.processForm.owner,
                systems: [...(this.processForm.systems || [])],
                fte: { ...this.processForm.fte },
                futureState: this.processForm.futureState,
                wilTask: this.processForm.wilTask,
                fteHoursPerMonth: this.processForm.fteHoursPerMonth,
                hitlRequired: this.processForm.hitlRequired,
                manualLinks: [...(this.processForm.manualLinks || [])],
                kpiEnabled: this.processForm.kpiEnabled,
            };
            // Include schema-based props (active + deprecated-with-value merged via processFields)
            this.processFields.forEach(f => {
                if (f.property_type === 'daterange') {
                    const startKey = f.property_key + '_start';
                    const endKey = f.property_key + '_end';
                    if (this.processForm[startKey] !== undefined) data[startKey] = this.processForm[startKey];
                    if (this.processForm[endKey] !== undefined) data[endKey] = this.processForm[endKey];
                } else if (this.processForm[f.property_key] !== undefined) {
                    data[f.property_key] = this.processForm[f.property_key];
                    if (f.property_type === 'user') {
                        const labelKey = f.property_key + '_label';
                        const selectedId = toSafeText(this.processForm[f.property_key]).trim();
                        const matchedItem = (this.userSearchResults[f.property_key] || [])
                            .find(item => toSafeText(item?.id).trim() === selectedId);
                        if (matchedItem) {
                            data[labelKey] = matchedItem.name;
                        } else {
                            const existingLabel = this.processDefinition?.definition?.[labelKey];
                            data[labelKey] = existingLabel !== undefined ? existingLabel : '';
                        }
                    }
                }
            });

            const oldH = this.parentHierarchy;
            const parentChanged = oldH
                && (oldH.megaId !== this.selectedMegaId || oldH.majorId !== this.selectedMajorId)
                && this.selectedMegaId && this.selectedMajorId;
            if (parentChanged) {
                data._parentChange = {
                    megaId: this.selectedMegaId,
                    majorId: this.selectedMajorId,
                };
            }

            this.$emit('save', data);
        },

        triggerDataAttachmentFilePicker() {
            const input = this.$refs.dataAttachmentFileInput;
            if (input) input.click();
        },
        async onDataAttachmentFileChange(event) {
            const file = event?.target?.files?.[0];
            if (!file) return;
            if (this.isViewMode) {
                event.target.value = '';
                return;
            }
            this.dataAttachmentUploading = true;
            try {
                const result = await backend.uploadFile(file.name, file);
                if (result && result.path) {
                    this.taskForm.dataAttachmentFile = {
                        fileName: file.name,
                        path: result.path,
                        publicUrl: result.publicUrl || ''
                    };
                    this.taskFormDirty = true;
                } else {
                    this.$toast?.error('파일 업로드에 실패했습니다.');
                }
            } catch (err) {
                console.error('데이터 첨부 파일 업로드 실패:', err);
                this.$toast?.error('파일 업로드 중 오류가 발생했습니다.');
            } finally {
                this.dataAttachmentUploading = false;
                if (event?.target) event.target.value = '';
            }
        },
        removeDataAttachmentFile() {
            if (this.isViewMode) return;
            this.taskForm.dataAttachmentFile = null;
            this.taskFormDirty = true;
        },
        async openDataAttachmentFile() {
            const file = this.taskForm.dataAttachmentFile;
            if (!file || !file.path) return;
            try {
                const url = file.publicUrl || await backend.getFileUrl(file.path);
                if (url) window.open(url, '_blank');
            } catch (err) {
                console.error('데이터 첨부 파일 열기 실패:', err);
                this.$toast?.error('파일을 열 수 없습니다.');
            }
        },
        async saveTask() {
            if (this.isViewMode) {
                this.$toast?.warning(this.readOnlyMessage || '읽기 전용 모드에서는 저장할 수 없습니다.');
                return;
            }
            const targetElement = this.activeElement || this.element;
            if (!targetElement) return;

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');
            const shapeElement = elementRegistry.get(targetElement.businessObject.id);
            if (!shapeElement) return;

            const bo = targetElement.businessObject;
            const existingProps = this.readUengineProps(bo);
            const relatedProjectIdsBeforeSave = this.normalizeRelatedProjectsForStorage(existingProps.relatedProjects)
                .map(item => item.id)
                .filter(id => id != null && id !== '');
            const targetType = targetElement.type || targetElement.$type || '';
            const targetIsSequenceFlow = targetType === 'bpmn:SequenceFlow';

            if (targetIsSequenceFlow) {
                const flowType = toSafeText(this.taskForm.flowType || 'sequence').trim() || 'sequence';
                const isConditionFlow = flowType === 'condition';
                const isDefaultFlow = flowType === 'default';
                const conditionExpression = isConditionFlow ? toSafeText(this.taskForm.conditionExpression).trim() : '';
                const relationProps = {
                    ...existingProps,
                    comments: [...this.elementComments],
                };
                // 패널의 조건식은 엔진 평가 대상(bag.conditionFunction)과 BPMN 표준(conditionExpression)
                // 양쪽에 동기화한다. 해제 시 키 삭제 대신 빈 문자열 톰스톤을 남긴다 —
                // 삭제하면 definition 병합(mergePropertiesStrings)이 저장 전용 키로 보고 부활시킨다.
                if (isConditionFlow && conditionExpression) {
                    relationProps.conditionFunction = conditionExpression;
                } else if ('conditionFunction' in relationProps) {
                    relationProps.conditionFunction = '';
                }
                // 분기 평가 방식 저장: 켜면 폴링 엔진이 이 시퀀스를 LLM 맥락 판단으로 평가
                if (isConditionFlow && this.taskForm.conditionLlmMode) {
                    relationProps.conditionMode = 'llm';
                } else {
                    delete relationProps.conditionMode;
                }
                const otherExtValues = bo.extensionElements?.values
                    ? bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties')
                    : [];
                const propsEl = bo.extensionElements?.values?.find((v) => v.$type === 'uengine:Properties');
                const uengineEl = bpmnFactory.create('uengine:Properties', {
                    json: JSON.stringify(relationProps),
                    variables: propsEl?.variables || [],
                });
                const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                    values: [...otherExtValues, uengineEl],
                });
                const nextConditionExpression = isConditionFlow
                    ? bpmnFactory.create('bpmn:FormalExpression', { body: conditionExpression })
                    : null;

                modeling.updateProperties(shapeElement, {
                    name: toSafeText(this.taskForm.name),
                    conditionExpression: nextConditionExpression,
                    extensionElements: newExtElements,
                });
                if (!isConditionFlow) {
                    delete bo.conditionExpression;
                    delete shapeElement.businessObject.conditionExpression;
                }

                const sourceElement = shapeElement.source || elementRegistry.get(toSafeText(bo.sourceRef?.id).trim());
                if (sourceElement?.businessObject) {
                    const sourceBo = sourceElement.businessObject;
                    const currentDefault = sourceBo.default;
                    const isCurrentDefault = currentDefault === bo || toSafeText(currentDefault?.id).trim() === toSafeText(bo.id).trim();
                    if (isDefaultFlow) {
                        modeling.updateProperties(sourceElement, { default: shapeElement.businessObject });
                    } else if (isCurrentDefault) {
                        modeling.updateProperties(sourceElement, { default: null });
                        delete sourceBo.default;
                        delete sourceElement.businessObject.default;
                    }
                }

                try {
                    const graphicsFactory = modeler.get('graphicsFactory');
                    const gfx = elementRegistry.getGraphics(shapeElement);
                    if (graphicsFactory && gfx) {
                        graphicsFactory.update('connection', shapeElement, gfx);
                    }
                } catch (e) { /* ignore */ }

                this.bpmnDataVersion++;
                this.taskFormDirty = false;
                this.$emit('taskMappingChanged');
                this.$emit('persistBpmn');
                this.$toast?.success('선 정보가 저장되었습니다.');
                return;
            }

            const isLane = (targetElement.type || targetElement.$type || '').toLowerCase().includes('lane');

            // 그룹 매핑 cascade 판정용: 저장 전 기존 relatedProjects 와 현재 폼 비교 → 제거된 그룹 항목 추출
            let removedGroupedItems = [];
            if (!isLane) {
                const existingNormalized = this.normalizeRelatedProjectsForStorage(existingProps.relatedProjects);
                const currentNormalized = this.normalizeRelatedProjectsForStorage(this.taskForm.relatedProjects);
                const currentKeys = new Set(currentNormalized.map(p => `${p.groupId || ''}::${p.name}`));
                removedGroupedItems = existingNormalized.filter(
                    p => p.groupId && !currentKeys.has(`${p.groupId}::${p.name}`)
                );
            }

            const uengineProps = isLane
                ? { ...existingProps, laneDescription: toSafeText(this.laneDescription) }
                : {
                    ...existingProps,
                    description: toSafeText(this.taskForm.description),
                    manualLinks: [...(this.taskForm.manualLinks || [])],
                    systems: this.normalizeSystemList(this.taskForm.systems),
                    fte: { ...this.taskForm.fte },
                    futureStatus: toSafeText(this.taskForm.futureStatus || 'maintain') || 'maintain',
                    relatedProjects: this.normalizeRelatedProjectsForStorage(this.taskForm.relatedProjects),
                    opexCost: this.taskForm.opexCost,
                    opexUnit: toSafeText(this.taskForm.opexUnit),
                    opexNote: toSafeText(this.taskForm.opexNote),
                    dataAttachmentUrl: toSafeText(this.taskForm.dataAttachmentUrl),
                    dataAttachmentFile: this.taskForm.dataAttachmentFile && this.taskForm.dataAttachmentFile.path
                        ? { ...this.taskForm.dataAttachmentFile }
                        : null,
                    ...this.taskForm.schemaProps,
                    comments: [...this.elementComments],
                };

            // API 연동 다중 목록 기록 (레거시 단일 필드는 첫 항목 미러링, 비면 제거)
            if (!isLane) {
                applyApiIntegrations(uengineProps, this.taskForm.apiIntegrations || []);
            }

            const targetIsCallActivity = targetType === 'bpmn:CallActivity';
            const targetIsStartEvent = targetType === 'bpmn:StartEvent';
            const targetIsEndEvent = targetType === 'bpmn:EndEvent';
            const targetIsProcessLinkable = targetIsCallActivity || targetIsStartEvent || targetIsEndEvent;
            const targetIsLane = targetType.toLowerCase().includes('lane');

            // CallActivity / StartEvent / EndEvent: definitionId 저장
            if (targetIsProcessLinkable) {
                uengineProps.definitionId = this.callActivityDefinitionId || '';
            }

            // UserTask 계열: 폼 연결 저장 — 워크아이템이 tool('formHandler:<form_def.id>')로 폼을 로드한다
            if (targetType === 'bpmn:UserTask' || targetType === 'bpmn:Task' || targetType === 'bpmn:ManualTask') {
                const linkedFormId = toSafeText(this.taskFormLinkId).trim();
                const existingTool = toSafeText(uengineProps.tool).trim();
                if (linkedFormId) {
                    uengineProps.tool = `formHandler:${linkedFormId}`;
                } else if (existingTool.startsWith('formHandler:')) {
                    // 연결 해제 — 실행 시 네이밍 규칙 폴백. formHandler 외 tool 값은 보존한다.
                    delete uengineProps.tool;
                }
            }

            // BusinessRuleTask: DMN 룰 연결 저장 (실행 엔진이 properties.businessRuleId 로 평가)
            if (targetType === 'bpmn:BusinessRuleTask') {
                const ruleId = toSafeText(this.businessRuleId).trim();
                if (ruleId) {
                    uengineProps.businessRuleId = ruleId;
                } else {
                    delete uengineProps.businessRuleId;
                }
            }

            // ServiceTask 실행 설정(agentEnabled/agent/http) 저장 로직은 순서도 패널에서 제거됨 —
            // 기존 BPMN 에 저장된 실행 속성은 건드리지 않고 그대로 유지한다.

            // SendTask: 메일 설정 저장 — 실행 엔진(polling)이 도달 즉시 발송 후 자동 완료 처리한다
            if (targetType === 'bpmn:SendTask') {
                const mailRecipients = (this.sendTaskRecipients || []).map((r) => toSafeText(r).trim()).filter(Boolean);
                const mailTitle = toSafeText(this.sendTaskMailTitle).trim();
                const mailContents = toSafeText(this.sendTaskMailContents).trim();
                if (mailRecipients.length || mailTitle || mailContents) {
                    uengineProps._type = 'org.uengine.kernel.LocalEMailActivity';
                    uengineProps.recipients = mailRecipients;
                    uengineProps.to = mailRecipients.join(','); // 레거시 호환 미러
                    if (mailTitle) uengineProps.title = mailTitle;
                    else delete uengineProps.title;
                    if (mailContents) uengineProps.contents = mailContents;
                    else delete uengineProps.contents;
                } else {
                    delete uengineProps._type;
                    delete uengineProps.recipients;
                    delete uengineProps.to;
                    delete uengineProps.title;
                    delete uengineProps.contents;
                }
            }

            // Lane 속성 저장
            if (targetIsLane) {
                // role_group 모드: 저장 직전 최신 그룹 정의로 멤버 재계산 (admin 에서 멤버 변경된 경우 반영)
                if (this.laneResourceType === 'role_group' && Array.isArray(this.laneRoleGroupSelectedList) && this.laneRoleGroupSelectedList.length) {
                    this.refreshLaneRoleGroupOrgs();
                }
                uengineProps.laneResourceType = this.laneResourceType || 'internal';
                uengineProps.laneAssigneeType = this.laneAssigneeType || 'user';
                if (this.laneAssigneeType === 'user' && this.laneAssignee?.length) {
                    uengineProps.laneAssignee = [...this.laneAssignee];
                } else if (this.laneAssigneeType === 'org' && this.laneOrganization?.length) {
                    uengineProps.laneOrganization = [...this.laneOrganization];
                }
                if ((this.laneResourceType === 'external' || this.laneResourceType === 'role_group') && this.laneSupplier?.length) {
                    uengineProps.laneSupplier = [...this.laneSupplier];
                } else {
                    delete uengineProps.laneSupplier;
                }
                // 역할 그룹 그룹 흔적 (참조 id 배열) — role_group 모드일 때만 기록
                if (this.laneResourceType === 'role_group' && Array.isArray(this.laneRoleGroupIds) && this.laneRoleGroupIds.length) {
                    uengineProps.laneRoleGroupIds = [...this.laneRoleGroupIds];
                } else {
                    delete uengineProps.laneRoleGroupIds;
                }
                // 구포맷(laneRoleGroupId 단일) 흔적도 정리
                delete uengineProps.laneRoleGroupId;
            }

            const json = JSON.stringify(uengineProps);

            let otherExtValues = [];
            if (bo.extensionElements?.values) {
                otherExtValues = bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties');
            }

            let variables = [];
            if (uengineProps.customProperties && Array.isArray(uengineProps.customProperties)) {
                variables = uengineProps.customProperties
                    .filter(p => toSafeText(p?.key).trim())
                    .map(p => bpmnFactory.create('uengine:Variable', { key: toSafeText(p.key).trim(), value: toSafeText(p.value), json: '{}' }));
            }

            const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables });
            const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                values: [...otherExtValues, uengineEl]
            });

            modeling.updateProperties(shapeElement, {
                name: toSafeText(this.taskForm.name),
                extensionElements: newExtElements,
            });

            // 그룹 매핑 항목이 제거된 경우 동일 groupId 보유 다른 Task 들에서 cascade 제거
            if (removedGroupedItems.length) {
                this.cascadeRemoveGroupedRelatedProjects(shapeElement.id, removedGroupedItems);
            }

            try {
                const graphicsFactory = modeler.get('graphicsFactory');
                const gfx = elementRegistry.getGraphics(shapeElement);
                if (graphicsFactory && gfx) {
                    graphicsFactory.update('shape', shapeElement, gfx);
                }
            } catch (e) { /* ignore */ }

            this.bpmnDataVersion++;
            this.taskFormDirty = false;

            // 감사 로그용 변경분 적재 — 부모의 영구 반영(persistBpmn 또는 confirmSaveVersion) 성공 시점에 일괄 기록된다.
            if (!isLane) {
                const summarizeApi = (props) => readApiIntegrations(props).map((a) => ({
                    name: a.name,
                    method: a.method,
                    url: a.url,
                    params: a.params.map((p) => `${p.key} : ${p.value}`),
                }));
                const apiHasContent = (s) => s.length > 0;
                const apiBefore = summarizeApi(existingProps);
                const apiAfter = summarizeApi(uengineProps);
                const apiChanged = JSON.stringify(apiBefore) !== JSON.stringify(apiAfter) && (apiHasContent(apiBefore) || apiHasContent(apiAfter));

                const normLinks = (arr) => (Array.isArray(arr) ? arr : [])
                    .map((l) => ({ name: toSafeText(l?.name), url: toSafeText(l?.url).trim() }))
                    .filter((l) => l.url);
                const linksBefore = normLinks(existingProps.manualLinks);
                const linksAfter = normLinks(uengineProps.manualLinks);
                const linksChanged = JSON.stringify(linksBefore) !== JSON.stringify(linksAfter) && (linksBefore.length > 0 || linksAfter.length > 0);

                if (apiChanged || linksChanged) {
                    this.$emit('propertyAuditPending', {
                        elementId: shapeElement.id,
                        elementName: toSafeText(this.taskForm.name),
                        api: apiChanged ? { before: apiBefore, after: apiAfter } : null,
                        manualLinks: linksChanged ? { before: linksBefore, after: linksAfter } : null,
                    });
                }
            }

            this.$emit('taskMappingChanged');
            const relatedProjectIdsAfterSave = this.normalizeRelatedProjectsForStorage(uengineProps.relatedProjects)
                .map(item => item.id)
                .filter(id => id != null && id !== '');
            this.$emit('persistBpmn', {
                projectIds: [...new Set([...relatedProjectIdsBeforeSave, ...relatedProjectIdsAfterSave])],
            });

            if (this.$toast) {
                if (removedGroupedItems.length) {
                    this.$toast.success(`Task 속성이 저장되었습니다. 그룹 매핑 ${removedGroupedItems.length}건이 동일 그룹 Task 에서도 함께 제거되었습니다.`);
                } else {
                    this.$toast.success('Task 속성이 저장되었습니다.');
                }
            }
        },
    },
};
</script>

<style scoped>
.api-entry {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;
}
.api-entry__head {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
}
.api-entry__title {
    font-size: 12px;
    font-weight: 700;
    color: #00695c;
}
.api-entry__remove {
    cursor: pointer;
}
.api-param-colon {
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.5);
    font-weight: 600;
}
.api-param-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: #212121;
}
.api-param-row__text {
    flex: 1;
    min-width: 0;
    word-break: break-word;
}
.api-param-row__input {
    flex: 1;
    min-width: 0;
}
.api-param-row__del {
    cursor: pointer;
    opacity: 0.7;
}
.api-param-row__del:hover {
    opacity: 1;
}
.hierarchy-properties {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
}

.properties-header {
    flex-shrink: 0;
    border-bottom: 1px solid #e8e8e8;
    background: #fafafa;
}

.properties-header__top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-right: 8px;
}

.properties-header__top-row .top-level-tabs {
    flex: 1 1 auto;
    min-width: 0;
}

.properties-header__close-btn {
    flex-shrink: 0;
    margin-left: 4px;
}

.process-meta-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    overflow: hidden;
}

.process-meta-row {
    padding: 10px 14px;
}

.process-meta-row + .process-meta-row {
    border-top: 1px solid #e2e8f0;
}

.process-meta-row--inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.process-meta-label {
    display: flex;
    align-items: center;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-bottom: 6px;
}

.process-meta-value {
    padding-left: 2px;
}

.process-meta-empty {
    font-size: 12px;
    color: #94a3b8;
}

.owner-info-name {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    display: block;
}

.owner-info-org {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
    display: block;
}

.parent-hierarchy-path {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    display: flex;
    align-items: center;
}

/* ── Review Guide Buttons (scoped) ── */
.review-guide-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
}
.review-guide-buttons__label {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    letter-spacing: 0.02em;
    white-space: nowrap;
    display: flex;
    align-items: center;
    margin-right: 2px;
}
.review-guide-btn {
    font-size: 11px !important;
    letter-spacing: -0.01em !important;
    padding: 0 8px !important;
    min-width: 0 !important;
    height: 28px !important;
}

.governance-status-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
}

.governance-context-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 14px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
}

.governance-review-summary {
    padding: 14px;
    border: 1px solid #dbe4f0;
    border-radius: 14px;
    background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}

.governance-review-summary__headline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.governance-section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #94a3b8;
}

.governance-review-summary__title {
    margin-top: 6px;
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
}

.governance-action-box {
    padding: 14px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #fcfdff;
}

.governance-action-box__title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
}

.governance-action-box__subtitle {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: #64748b;
}

.governance-action-notice {
    display: flex;
    align-items: flex-start;
    padding: 10px 12px;
    border: 1px solid #fed7aa;
    border-radius: 10px;
    background: #fff7ed;
    font-size: 12px;
    line-height: 1.5;
    color: #9a3412;
}

.release-strategy-panel {
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}

.release-strategy-panel__title {
    font-size: 13px;
    font-weight: 700;
    color: #111827;
}

.release-strategy-panel__subtitle {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: #64748b;
}

.release-lanes {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.release-lane {
    padding: 13px 14px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
}

.release-lane--accent {
    border-color: #fdba74;
    background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
}

.release-lane__eyebrow {
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.release-lane__title {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
}

.release-lane__desc {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.6;
    color: #4b5563;
}

/* Top-level tabs */
.top-level-tabs { min-height: 48px; }
.top-level-tabs :deep(.v-tab) {
    font-size: 15px;
    text-transform: none;
    letter-spacing: 0;
    min-width: 0;
    padding: 0 20px;
    font-weight: 700;
    height: 48px;
    opacity: 0.75;
}
.top-level-tabs :deep(.v-tab.v-tab--selected) {
    opacity: 1;
    font-weight: 800;
}
.top-level-tabs :deep(.v-tab__slider) {
    height: 3px;
}

@media (max-width: 880px) {
    .governance-review-summary__headline {
        align-items: flex-start;
    }

    .governance-context-banner {
        align-items: flex-start;
    }
}

/* [2.4.2] Validation Banner */
.validation-banner {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 6px 12px 0;
    padding: 6px 10px;
    background: #fef9f0;
    border: 1px solid #f5d9a8;
    border-radius: 6px;
    position: relative;
    overflow: hidden;
}
.validation-banner__indicator {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: #ef9a0a;
    border-radius: 6px 0 0 6px;
}
.validation-banner__icon {
    flex-shrink: 0;
    color: #d97706;
    margin-top: 1px;
}
.validation-banner__list {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #92400e;
    font-weight: 500;
}

.properties-tabs { min-height: 32px; border-bottom: 1px solid #eee; }
.properties-tabs :deep(.v-tab) {
    font-size: 11px;
    text-transform: none;
    letter-spacing: 0;
    min-width: 0;
    padding: 0 12px;
}

.properties-content {
    flex: 1;
    overflow-y: auto;
    position: relative;
}

.properties-content--readonly .properties-tabs,
.properties-content--readonly .pa-4,
.properties-content--readonly .section-group,
.properties-content--readonly .element-name-header,
.properties-content--readonly .task-empty-state {
    pointer-events: none;
}
.properties-content--readonly .manual-link-open-icon {
    pointer-events: auto;
}
/* 읽기 모드에서도 "새창에서 열기" 버튼은 조회 기능이므로 클릭 가능해야 함 */
.properties-content--readonly .ca-open-new-btn {
    pointer-events: auto;
}
/* 읽기 모드에서도 PI Flag 탭은 조회 기능(모두 보기·카드 토글·요소 이동)이 동작해야 함
   (삭제/생성 버튼은 읽기 모드에서 이미 숨김 처리됨) */
.properties-content--readonly .pi-flag-tab-content {
    pointer-events: auto;
}
/* 읽기 모드에서도 매핑 리스트(시스템/연관과제/관련자료 링크)의 조회 기능
   — 항목 클릭(외부 링크/요소 focus), 제목 링크, 묶음 task 칩 focus — 은 동작해야 함 */
.properties-content--readonly .sk-mapping-list__item,
.properties-content--readonly .sk-mapping-list__name--link,
.properties-content--readonly .sk-group-task-chip,
.properties-content--readonly .atdt-task-chip-link {
    pointer-events: auto;
}
/* 묶음 task 칩: 클릭 시 해당 task focus */
.sk-group-task-chip {
    cursor: pointer;
}
.properties-content--readonly .manual-link-field :deep(.manual-link-row__link),
.properties-content--readonly .task-manual-links-aggregate :deep(.manual-link-row__link) {
    pointer-events: auto;
}

.readonly-overlay {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    margin: 8px 12px 0;
    border: 1px solid rgba(245, 158, 11, 0.28);
    border-radius: 10px;
    background: rgba(255, 248, 235, 0.96);
    color: #9a6700;
    font-size: 12px;
    line-height: 1.4;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
}

/* Element name header (Task tab) */
.element-name-header {
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 600;
    border-bottom: 1px solid #e8e8e8;
    background: #fff;
    position: sticky;
    top: 0;
    z-index: 2;
}

/* Section Groups */
.section-group {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
}
.section-title {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: #fafafa;
    user-select: none;
    transition: background-color 0.15s;
}
.section-title:hover { background: #f0f0f0; }
.section-body {
    padding: 12px;
    border-top: 1px solid #e8e8e8;
}

/* Field Labels */
.field-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 500;
    color: #666;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.element-id-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
}

.element-id-value {
    font-family: Menlo, Consolas, 'D2Coding', monospace;
    font-size: 11px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    padding: 2px 6px;
    flex: 0 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: all;
}

.field-label-left {
    display: flex;
    align-items: center;
    gap: 6px;
}

.data-attachment-file-row {
    display: flex;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fafafa;
    font-size: 12px;
}

.data-attachment-file-name {
    color: #1976d2;
    cursor: pointer;
    word-break: break-all;
}

.data-attachment-file-name:hover {
    text-decoration: underline;
}

.field-type-badge {
    display: inline-block;
    padding: 0 5px;
    font-size: 9px;
    font-weight: 600;
    color: #9ca3af;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    text-transform: lowercase;
    letter-spacing: 0;
    line-height: 16px;
}

.field-readonly-mark {
    display: inline-block;
    padding: 0 5px;
    font-size: 9px;
    font-weight: 600;
    color: #6b7280;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 3px;
    letter-spacing: 0;
    line-height: 16px;
    text-transform: none;
}

/* FTE */
.fte-mode-toggle {
    width: 100%;
}
.fte-mode-toggle :deep(.v-btn) {
    flex: 1;
    font-size: 12px;
    text-transform: none;
    letter-spacing: 0;
}
.fte-result-card {
    background: #e8f5e9;
    border-radius: 8px;
    padding: 12px;
}
.fte-result-label {
    font-size: 11px;
    font-weight: 600;
    color: #2e7d32;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.fte-result-value {
    font-size: 22px;
    font-weight: 700;
    color: #1b5e20;
    margin: 4px 0;
}
.fte-formula {
    font-size: 11px;
    color: #4caf50;
    font-family: monospace;
}

/* Formula display */
.formula-display {
    background: #f5f5f5;
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
}

.daterange-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.daterange-separator {
    color: #9ca3af;
    font-size: 11px;
    text-align: center;
}

/* Save button - fixed footer */
.properties-footer {
    flex-shrink: 0;
    padding: 10px 16px;
    border-top: 1px solid #e8e8e8;
    background: #fff;
}
.save-btn {
    text-transform: none;
    letter-spacing: 0;
}

/* Empty state */
.task-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;
}
.task-empty-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ==================== Governance Timeline ==================== */
.governance-timeline {
    position: relative;
}

.timeline-entry {
    display: flex;
    gap: 12px;
    padding-bottom: 20px;
    position: relative;
}

.timeline-entry:last-child {
    padding-bottom: 0;
}

.timeline-dot-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 20px;
}

.timeline-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
    transition: transform 0.15s;
}

.timeline-dot--current {
    width: 14px;
    height: 14px;
    margin-top: 2px;
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.06);
}

.timeline-line {
    flex: 1;
    width: 2px;
    background: #e0e0e0;
    margin-top: 4px;
    min-height: 16px;
}

.timeline-content {
    flex: 1;
    min-width: 0;
}

.timeline-title {
    line-height: 1.3;
}

.timeline-entry--current .timeline-title {
    color: #1976d2;
}

/* Show more button */
.show-more-btn {
    font-size: 11px !important;
    letter-spacing: 0;
    opacity: 0.7;
}
.show-more-btn:hover {
    opacity: 1;
}

/* ==================== Feedback Section ==================== */
.feedback-section-header {
    display: flex;
    align-items: center;
    letter-spacing: 0.1em;
}

.feedback-card {
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    transition: opacity 0.2s;
}

.feedback-card--resolved {
    opacity: 0.6;
    background: #fafafa;
}

.feedback-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.feedback-content {
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}

/* 답글 — 카드/배경 없이 들여쓰기와 상단 구분선으로만 hierarchy 표현 */
.thread-reply {
    padding: 10px 0 6px 0;
    border-top: 1px solid #eef0f4;
}
.thread-reply--resolved {
    background: #f4faf5;
    border-top: none;
    border-left: 3px solid #66bb6a;
    border-radius: 4px;
    padding: 8px 12px;
}
.thread-reply__body {
    line-height: 1.5;
}

/* 한국식 절대 시각 표시 (한 줄) */
.time-stamp {
    white-space: nowrap;
    text-align: right;
    flex-shrink: 0;
}
.time-stamp__edited {
    white-space: nowrap;
}

/* 인라인 답글/해결 입력 — 외곽 박스 없이 textarea 만 노출 */
.inline-input {
    background: transparent;
    border: none;
    padding: 0;
}
.inline-input :deep(.v-field) {
    font-size: 13px;
    background: #fff;
}
.feedback-input-area {
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e8e8e8;
}
.feedback-textarea :deep(.v-field) {
    font-size: 13px;
    background: #fff;
}

/* Reply indicator */
.reply-indicator {
    display: flex;
    align-items: center;
    background: #e3f2fd;
    border-left: 3px solid #1976d2;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    color: #1565c0;
}

/* Mention */
.mention-indicator {
    display: flex;
    align-items: center;
    font-size: 12px;
}
.mention-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    border-radius: 8px;
    margin-bottom: 4px;
}
.mention-item {
    cursor: pointer;
    min-height: 36px;
}
.mention-item:hover {
    background: #f0f7ff;
}
.cursor-pointer {
    cursor: pointer;
}

/* Resolve dialog feedback preview */
.resolve-feedback-preview {
    background: #f5f5f5;
    border-radius: 6px;
    padding: 10px 12px;
    border-left: 3px solid #e0e0e0;
}
.resolve-feedback-text {
    color: #555;
    line-height: 1.5;
}

/* Task Count Grid */
.task-count-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.task-count-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid #f0f0f0;
}
.task-count-row:last-child {
    border-bottom: none;
}
.task-count-row:first-child {
    padding-bottom: 6px;
    margin-bottom: 2px;
    border-bottom: 1px solid #e0e0e0;
}
.task-count-label {
    font-size: 12px;
    color: #616161;
}
.task-count-value {
    font-size: 12px;
    color: #212121;
    min-width: 24px;
    text-align: right;
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 6px;
}
.task-count-percent {
    font-weight: 700;
    color: #1d4ed8;
    min-width: 34px;
    text-align: right;
}
.call-activity-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.call-activity-card {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: #fafafa;
    padding: 8px 10px;
}
.call-activity-card-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-bottom: 6px;
    border-bottom: 1px dashed #d6d6d6;
    margin-bottom: 6px;
}
.call-activity-card-title {
    font-size: 12px;
    font-weight: 600;
    color: #424242;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 70%;
}
.call-activity-card-body {
    padding: 2px 0;
}
.task-count-number {
    color: #616161;
    font-variant-numeric: tabular-nums;
}

/* PI Flag 코멘트 리스트 (공통 sk-mapping-list 안에서 코멘트 상세를 표시) */
.pi-flag-comments {
    padding-left: 0;
    gap: 0;
}
.pi-flag-card__toggle {
    cursor: pointer;
}
.pi-flag-card__item {
    min-height: 26px !important;
    padding: 6px 10px !important;
    display: block !important;
}
.pi-flag-card__item-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: #212121;
}
.pi-flag-card__item-row + .pi-flag-card__item-row {
    margin-top: 2px;
}
.pi-flag-card__item-label {
    flex: 0 0 36px;
    color: #757575;
    font-weight: 600;
}
.pi-flag-card__item-value {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
}
.pi-flag-card__item-value--multiline {
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
}
.api-agg-item .pi-flag-card__item-label {
    flex-basis: 48px;
}
.pi-flag-card__item-row--column {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
}
.pi-flag-card__item-row--column .pi-flag-card__item-label {
    flex: 0 0 auto;
}
.pi-flag-card__item-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

/* sk-mapping-list 변형: 행간 divider 없음 */
.sk-mapping-list--no-divider .sk-mapping-list__row + .sk-mapping-list__row {
    border-top: none;
}

/* 연관 과제 chip 안 외부 링크 */
.atdt-task-chip-link {
    display: inline-flex;
    align-items: center;
    color: inherit;
    text-decoration: none;
}
.atdt-task-chip-link:hover {
    text-decoration: underline;
}
/* solid fill (variant="flat") 그룹 chip 위에 올라간 링크는 흰색으로 */
.atdt-task-chip-link--on-fill {
    color: #fff !important;
}
/* chip 안 링크 아이콘 (그룹 매핑 chip 전용) */
.atdt-task-chip-link__icon {
    font-size: 13px;
    margin-right: 3px;
    line-height: 1;
}


/* 역할 그룹 그룹 항목 (Lane 담당 지정 - role_group 분기) */
.role-group-item {
    padding: 8px 0;
}
.role-group-card-head {
    display: flex;
    align-items: center;
    gap: 6px;
}
.role-group-card-name {
    font-size: 13px;
    font-weight: 600;
}
.role-group-card-parent {
    margin-left: 2px;
    font-size: 12px;
    color: #6b7280;
}
.role-group-card-chips {
    display: flex;
    flex-wrap: wrap;
}
/* 역할 그룹 카드 칩 내부 내부/외부 표시 텍스트 (칩 아님, 색상만) */
.rg-type-text {
    font-size: 10px;
    font-weight: 600;
}
/* 역할 그룹 카드 — DMN 라우팅 조건 (조회 전용) */
.role-group-dmn {
    padding: 6px 8px;
    border: 1px dashed #e5e7eb;
    border-radius: 6px;
}
.role-group-dmn-head {
    display: flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 4px;
}
.role-group-dmn-hint {
    margin-left: auto;
    font-size: 10px;
    font-weight: 400;
    color: #9ca3af;
}
.role-group-dmn-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    font-size: 11.5px;
    line-height: 1.6;
}
.role-group-dmn-cond {
    color: #374151;
}
.role-group-dmn-out {
    font-weight: 600;
    color: #1f2937;
}

/* ===== PI Flag 기반 AI 질문 (Agent 분석 탭) ===== */
.pi-flag-chat {
    border-top: 1px dashed #e5e7eb;
    padding-top: 12px;
    min-height: 0;
}
.pi-flag-chat__head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
}
.pi-flag-chat__head-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 2px;
}
.pi-flag-chat__title {
    font-size: 12px;
    font-weight: 700;
    color: #374151;
}
.pi-flag-chat__log {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
    max-height: clamp(180px, 30vh, 280px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
    scrollbar-gutter: stable;
}
.pi-flag-chat__turn {
    border: 1px solid #dbeafe;
    border-radius: 10px;
    overflow: hidden;
    background: #ffffff;
}
.pi-flag-chat__q {
    display: flex;
    align-items: flex-start;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #1e3a8a;
    background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
    word-break: break-word;
}
.pi-flag-chat__a {
    padding: 10px;
    font-size: 13px;
    line-height: 1.7;
    color: #1f2937;
    overflow-wrap: anywhere;
}
.pi-flag-chat__thinking {
    color: #64748b;
    font-size: 12px;
}
.pi-flag-chat__a-body {
    display: block;
    max-width: 100%;
    overflow-x: auto;
}
.pi-flag-chat__a-body :deep(p) {
    margin: 0 0 8px;
}
.pi-flag-chat__a-body :deep(p:last-child) {
    margin-bottom: 0;
}
.pi-flag-chat__a-body :deep(ul),
.pi-flag-chat__a-body :deep(ol) {
    margin: 6px 0 8px;
    padding-left: 18px;
}
.pi-flag-chat__a-body :deep(table) {
    width: 100%;
    margin: 8px 0;
    border-collapse: collapse;
    font-size: 12px;
}
.pi-flag-chat__a-body :deep(th),
.pi-flag-chat__a-body :deep(td) {
    padding: 5px 7px;
    border: 1px solid #dbeafe;
    text-align: left;
    vertical-align: top;
}
.pi-flag-chat__a-body :deep(th) {
    background: #eff6ff;
    font-weight: 700;
}
/* 스트리밍 타이핑 커서 */
.pi-flag-chat__caret {
    display: inline-block;
    width: 7px;
    height: 1em;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: #6366f1;
    border-radius: 1px;
    animation: pi-flag-chat-caret 1s steps(2, start) infinite;
}
@keyframes pi-flag-chat-caret {
    0%,
    50% {
        opacity: 1;
    }
    50.01%,
    100% {
        opacity: 0;
    }
}
.pi-flag-chat__suggestions {
    display: flex;
    flex-wrap: wrap;
}
.pi-flag-chat__error {
    font-size: 12px;
    color: #b91c1c;
}
.pi-flag-chat-dialog {
    max-height: min(86vh, 840px);
    display: flex;
    flex-direction: column;
}
.pi-flag-chat-dialog__titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-shrink: 0;
    padding: 14px 16px 10px;
}
.pi-flag-chat-dialog__title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
    font-size: 15px;
    font-weight: 700;
    color: #1f2937;
}
.pi-flag-chat-dialog__body {
    flex: 1 1 auto;
    min-height: 0;
    max-height: calc(86vh - 64px);
    overflow-y: auto;
    padding: 12px 16px 16px !important;
}
.pi-flag-chat-dialog__turn + .pi-flag-chat-dialog__turn {
    margin-top: 12px;
}
.pi-flag-chat-dialog__turn {
    border: 1px solid #dbeafe;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
}
.pi-flag-chat-dialog__question {
    display: flex;
    align-items: flex-start;
    padding: 10px 12px;
    background: #f8fbff;
    color: #1e3a8a;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    overflow-wrap: anywhere;
}
.pi-flag-chat-dialog__answer {
    padding: 14px 16px;
    color: #1f2937;
    font-size: 14px;
    line-height: 1.75;
    overflow-wrap: anywhere;
}
.pi-flag-chat-dialog__answer-body {
    display: block;
    max-width: 100%;
    overflow-x: auto;
}
.pi-flag-chat-dialog__answer-body :deep(p) {
    margin: 0 0 10px;
}
.pi-flag-chat-dialog__answer-body :deep(p:last-child) {
    margin-bottom: 0;
}
.pi-flag-chat-dialog__answer-body :deep(ul),
.pi-flag-chat-dialog__answer-body :deep(ol) {
    margin: 8px 0 10px;
    padding-left: 20px;
}
.pi-flag-chat-dialog__answer-body :deep(table) {
    width: 100%;
    min-width: 620px;
    margin: 10px 0;
    border-collapse: collapse;
    font-size: 13px;
}
.pi-flag-chat-dialog__answer-body :deep(th),
.pi-flag-chat-dialog__answer-body :deep(td) {
    padding: 7px 9px;
    border: 1px solid #dbeafe;
    text-align: left;
    vertical-align: top;
}
.pi-flag-chat-dialog__answer-body :deep(th) {
    background: #eff6ff;
    font-weight: 700;
}
.pi-flag-chat-dialog__empty {
    padding: 40px 12px;
    color: #64748b;
    font-size: 13px;
    text-align: center;
}
</style>

<!-- Unscoped styles for Teleported floating guide window -->
<style>
.review-guide-floating {
    position: fixed;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10);
    border: 1px solid #cbd5e1;
    min-width: 320px;
    min-height: 300px;
}
.review-guide-floating__titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    cursor: grab;
    user-select: none;
    flex-shrink: 0;
}
.review-guide-floating__titlebar:active {
    cursor: grabbing;
}
.review-guide-floating__titlebar-left {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
}
.review-guide-floating__titlebar-actions {
    display: flex;
    align-items: center;
    gap: 2px;
}
.review-guide-floating__body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.review-guide-floating__resize {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, #94a3b8 50%, transparent 52%, transparent 65%, #94a3b8 65%, transparent 67%);
    border-radius: 0 0 12px 0;
}
</style>
