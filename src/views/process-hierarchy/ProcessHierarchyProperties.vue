<template>
    <div class="hierarchy-properties">
        <!-- Header -->
        <div class="properties-header">
            <div class="d-flex align-center justify-space-between px-4 pt-3">
                <span class="text-subtitle-1 font-weight-bold">Properties</span>
                <v-btn icon variant="text" size="x-small" @click="$emit('close')">
                    <v-icon size="16">mdi-close</v-icon>
                </v-btn>
            </div>
            <!-- Top-level tabs: Properties | Governance -->
            <v-tabs
                v-model="topTab"
                density="compact"
                class="top-level-tabs"
                color="primary"
                height="36"
            >
                <v-tab value="properties" size="small">
                    <v-icon size="14" start>mdi-tune-vertical</v-icon>
                    Properties
                </v-tab>
                <v-tab value="governance" size="small">
                    <v-icon size="14" start>mdi-shield-check-outline</v-icon>
                    Governance
                </v-tab>
            </v-tabs>
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
                다른 사용자가 편집 중이라 속성 변경이 잠겨 있습니다.
            </div>
            <v-window v-model="topTab">
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
                            <v-badge v-if="element" dot color="primary" inline class="ml-1" />
                        </v-tab>
                    </v-tabs>

                    <v-window v-model="activeTab">
                        <!-- ==================== Process Tab ==================== -->
                        <v-window-item value="process">
                            <div class="pa-4">
                                <!-- 1. Strategic Properties -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('strategic')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('strategic') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="deep-purple">mdi-strategy</v-icon>
                                        Strategic Properties
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
                                </div>

                                <!-- 2. Hybrid Costing -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('hybrid-costing')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('hybrid-costing') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="teal">mdi-calculator-variant</v-icon>
                                        Hybrid Costing
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

                                        <!-- Existing FTE Calculator (collapsed) -->
                                        <div class="mt-3">
                                            <div class="d-flex align-center cursor-pointer text-caption text-medium-emphasis" @click="toggle('proc-fte-detail')">
                                                <v-icon size="12" class="mr-1">{{ isOpen('proc-fte-detail') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                                FTE Calculator (상세)
                                            </div>
                                            <div v-show="isOpen('proc-fte-detail')" class="mt-2">
                                                <label class="field-label">Input Mode</label>
                                                <v-btn-toggle v-model="processForm.fte.inputMode" mandatory density="compact" class="mb-3 fte-mode-toggle" color="primary">
                                                    <v-btn value="direct" size="small">Direct %</v-btn>
                                                    <v-btn value="time" size="small">Time-Freq-People</v-btn>
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
                                                            <label class="field-label">Freq. Cycle</label>
                                                            <v-select
                                                                v-model="processForm.fte.freqCycle"
                                                                :items="freqCycleOptions"
                                                                density="compact" variant="outlined" hide-details
                                                            />
                                                        </v-col>
                                                        <v-col cols="6">
                                                            <label class="field-label">Freq. Count</label>
                                                            <v-text-field
                                                                v-model.number="processForm.fte.freqCount"
                                                                density="compact" variant="outlined" hide-details type="number" min="0"
                                                            />
                                                        </v-col>
                                                    </v-row>
                                                    <label class="field-label mt-3">Time per Task (hours)</label>
                                                    <v-text-field
                                                        v-model.number="processForm.fte.timePerTask"
                                                        density="compact" variant="outlined" hide-details type="number" min="0" step="0.1"
                                                    />
                                                    <label class="field-label mt-3">Headcount</label>
                                                    <v-text-field
                                                        v-model.number="processForm.fte.headcount"
                                                        density="compact" variant="outlined" hide-details type="number" min="1"
                                                    />
                                                </template>
                                                <div v-if="processFteValue" class="fte-result-card mt-3">
                                                    <div class="d-flex align-center justify-space-between">
                                                        <span class="fte-result-label">CALCULATED FTE</span>
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
                                </div>

                                <!-- 3. Competency -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('competency')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('competency') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="orange">mdi-head-cog-outline</v-icon>
                                        Competency
                                    </div>
                                    <div v-show="isOpen('competency')" class="section-body">
                                        <div class="d-flex align-center justify-space-between">
                                            <div>
                                                <label class="field-label mb-0">AI 결과물 통제 (HITL)</label>
                                                <div class="text-caption text-medium-emphasis">Human-in-the-Loop 필요 여부</div>
                                            </div>
                                            <v-switch
                                                v-model="processForm.hitlRequired"
                                                density="compact"
                                                color="primary"
                                                hide-details
                                                class="mt-0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <!-- 4. General -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('general')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('general') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="blue-grey">mdi-information-outline</v-icon>
                                        General
                                    </div>
                                    <div v-show="isOpen('general')" class="section-body">
                                        <label class="field-label">프로세스명</label>
                                        <v-text-field
                                            v-model="processForm.title"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            class="mb-3"
                                            placeholder="Process name"
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
                                            <label class="field-label">{{ field.property_label || field.property_key }}</label>
                                            <v-text-field
                                                v-if="field.property_type === 'string'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :placeholder="field.placeholder"
                                            />
                                            <v-textarea
                                                v-else-if="field.property_type === 'textarea'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3"
                                                :placeholder="field.placeholder"
                                            />
                                            <v-text-field
                                                v-else-if="field.property_type === 'number'"
                                                v-model.number="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details type="number" class="mb-3"
                                                :placeholder="field.placeholder"
                                            />
                                            <v-text-field
                                                v-else-if="field.property_type === 'url'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :placeholder="field.placeholder || 'https://...'"
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
                                                :items="dbSelectItems[field.property_key] || []"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                :placeholder="field.placeholder"
                                                clearable
                                            />
                                            <v-select
                                                v-else-if="field.property_type === 'select'"
                                                v-model="processForm[field.property_key]"
                                                :items="field.options || []"
                                                item-title="label" item-value="value"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                                clearable
                                            />
                                            <v-switch
                                                v-else-if="field.property_type === 'boolean'"
                                                v-model="processForm[field.property_key]"
                                                density="compact" color="primary" hide-details class="mb-3"
                                            />
                                        </template>
                                    </div>
                                </div>

                                <!-- 5. Manual Link -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('manual-link')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('manual-link') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        <v-icon size="14" class="mr-1" color="indigo">mdi-link-variant</v-icon>
                                        MANUAL LINK
                                    </div>
                                    <div v-show="isOpen('manual-link')" class="section-body">
                                        <v-text-field
                                            v-model="processForm.manualLink"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            placeholder="https://..."
                                        >
                                            <template v-slot:prepend-inner>
                                                <v-icon size="14" color="grey">mdi-link-variant</v-icon>
                                            </template>
                                            <template v-slot:append-inner>
                                                <v-icon
                                                    v-if="processForm.manualLink"
                                                    size="16"
                                                    style="cursor:pointer"
                                                    color="primary"
                                                    @click="openLink(processForm.manualLink)"
                                                >mdi-open-in-new</v-icon>
                                            </template>
                                        </v-text-field>
                                    </div>
                                </div>

                                <!-- System Mapping -->
                                <div class="section-group">
                                    <div class="section-title" @click="toggle('proc-system')">
                                        <v-icon size="14" class="mr-1">{{ isOpen('proc-system') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        System Mapping
                                        <v-chip v-if="processForm.systems && processForm.systems.length" size="x-small" variant="tonal" class="ml-auto">
                                            {{ processForm.systems.length }}
                                        </v-chip>
                                    </div>
                                    <div v-show="isOpen('proc-system')" class="section-body">
                                        <v-combobox
                                            v-model="processForm.systems"
                                            label="연관 시스템"
                                            density="compact" variant="outlined" hide-details
                                            multiple chips closable-chips :delimiters="[',']"
                                        />
                                    </div>
                                </div>

                            </div>
                        </v-window-item>

                        <!-- ==================== Task Tab ==================== -->
                        <v-window-item value="task">
                            <div v-if="element">
                                <!-- Element Name Header -->
                                <div class="element-name-header">
                                    {{ element.businessObject?.name || element.id }}
                                </div>

                                <div class="pa-4">
                                    <!-- Basic -->
                                    <div class="section-group">
                                        <div class="section-title" @click="toggle('task-basic')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-basic') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            Basic
                                        </div>
                                        <div v-show="isOpen('task-basic')" class="section-body">
                                            <label class="field-label">Title</label>
                                            <v-text-field
                                                v-model="taskForm.name"
                                                density="compact" variant="outlined" hide-details class="mb-3"
                                            />
                                            <!-- Schema fields for Task -->
                                            <template v-for="field in taskFields" :key="field.id">
                                                <label class="field-label">{{ field.property_label || field.property_key }}</label>
                                                <v-text-field
                                                    v-if="field.property_type === 'string'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :placeholder="field.placeholder"
                                                />
                                                <v-textarea
                                                    v-else-if="field.property_type === 'textarea'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3"
                                                    :placeholder="field.placeholder"
                                                />
                                                <v-text-field
                                                    v-else-if="field.property_type === 'number'"
                                                    v-model.number="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details type="number" class="mb-3"
                                                    :placeholder="field.placeholder"
                                                />
                                                <v-text-field
                                                    v-else-if="field.property_type === 'url'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :placeholder="field.placeholder || 'https://...'"
                                                >
                                                    <template v-slot:prepend-inner>
                                                        <v-icon size="14" color="grey">mdi-link-variant</v-icon>
                                                    </template>
                                                </v-text-field>
                                                <v-select
                                                    v-else-if="field.property_type === 'db-select'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    :items="dbSelectItems[field.property_key] || []"
                                                    density="compact" variant="outlined" hide-details class="mb-3"
                                                    :placeholder="field.placeholder" clearable
                                                />
                                                <v-select
                                                    v-else-if="field.property_type === 'select'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    :items="field.options || []"
                                                    item-title="label" item-value="value"
                                                    density="compact" variant="outlined" hide-details class="mb-3" clearable
                                                />
                                                <v-switch
                                                    v-else-if="field.property_type === 'boolean'"
                                                    v-model="taskForm.schemaProps[field.property_key]"
                                                    density="compact" color="primary" hide-details class="mb-3"
                                                />
                                            </template>
                                            <!-- Fallback if no schema -->
                                            <template v-if="taskFields.length === 0">
                                                <label class="field-label">Description</label>
                                                <v-textarea v-model="taskForm.description" density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3" placeholder="Describe the task..." />
                                                <label class="field-label">Manual Link</label>
                                                <v-text-field v-model="taskForm.manualLink" density="compact" variant="outlined" hide-details placeholder="https://...">
                                                    <template v-slot:prepend-inner><v-icon size="14" color="grey">mdi-link-variant</v-icon></template>
                                                </v-text-field>
                                            </template>
                                            <!-- Future Status -->
                                            <label class="field-label mt-3">{{ $t('processHierarchy.futureStatus') || 'Future Status' }}</label>
                                            <v-select
                                                v-model="taskForm.futureStatus"
                                                :items="[
                                                    { title: $t('futureStatus.maintain') || '유지', value: 'maintain' },
                                                    { title: $t('futureStatus.sunset') || '삭제 예정', value: 'sunset' },
                                                    { title: $t('futureStatus.new') || '신규', value: 'new' },
                                                    { title: $t('futureStatus.automation_planned') || '자동화 기획중', value: 'automation_planned' },
                                                ]"
                                                item-title="title"
                                                item-value="value"
                                                density="compact"
                                                variant="outlined"
                                                hide-details
                                            />
                                        </div>
                                    </div>

                                    <!-- FTE Calculator (Task) -->
                                    <div class="section-group">
                                        <div class="section-title" @click="toggle('task-fte')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-fte') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            FTE Calculator
                                            <v-icon size="14" class="ml-1" color="grey">mdi-information-outline</v-icon>
                                            <v-chip v-if="taskFteValue" size="x-small" variant="tonal" color="primary" class="ml-auto">
                                                FTE {{ taskFteValue }}
                                            </v-chip>
                                        </div>
                                        <div v-show="isOpen('task-fte')" class="section-body">
                                            <label class="field-label">Input Mode</label>
                                            <v-btn-toggle v-model="taskForm.fte.inputMode" mandatory density="compact" class="mb-3 fte-mode-toggle" color="primary">
                                                <v-btn value="direct" size="small">Direct %</v-btn>
                                                <v-btn value="time" size="small">Time-Freq-People</v-btn>
                                            </v-btn-toggle>
                                            <template v-if="taskForm.fte.inputMode === 'direct'">
                                                <label class="field-label">FTE (%)</label>
                                                <v-text-field v-model.number="taskForm.fte.directPercent" density="compact" variant="outlined" hide-details type="number" min="0" max="100" suffix="%" />
                                            </template>
                                            <template v-else>
                                                <v-row dense>
                                                    <v-col cols="6">
                                                        <label class="field-label">Freq. Cycle</label>
                                                        <v-select v-model="taskForm.fte.freqCycle" :items="freqCycleOptions" density="compact" variant="outlined" hide-details />
                                                    </v-col>
                                                    <v-col cols="6">
                                                        <label class="field-label">Freq. Count</label>
                                                        <v-text-field v-model.number="taskForm.fte.freqCount" density="compact" variant="outlined" hide-details type="number" min="0" />
                                                    </v-col>
                                                </v-row>
                                                <label class="field-label mt-3">Time per Task (hours)</label>
                                                <v-text-field v-model.number="taskForm.fte.timePerTask" density="compact" variant="outlined" hide-details type="number" min="0" step="0.1" />
                                                <label class="field-label mt-3">Headcount</label>
                                                <v-text-field v-model.number="taskForm.fte.headcount" density="compact" variant="outlined" hide-details type="number" min="1" />
                                            </template>
                                            <div v-if="taskFteValue" class="fte-result-card mt-3">
                                                <div class="d-flex align-center justify-space-between">
                                                    <span class="fte-result-label">CALCULATED FTE</span>
                                                    <v-btn variant="text" size="x-small" color="primary" class="text-none">
                                                        <v-icon size="12" start>mdi-sync</v-icon>
                                                        Sync with Global FTE
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

                                    <!-- System Mapping (Task) -->
                                    <div class="section-group">
                                        <div class="section-title" @click="toggle('task-system')">
                                            <v-icon size="14" class="mr-1">{{ isOpen('task-system') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                            System Mapping
                                        </div>
                                        <div v-show="isOpen('task-system')" class="section-body">
                                            <v-combobox
                                                v-model="taskForm.systems"
                                                label="연관 시스템"
                                                density="compact" variant="outlined" hide-details
                                                multiple chips closable-chips :delimiters="[',']"
                                            />
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
                    </v-window>
                </v-window-item>

                <!-- ==================== Governance Tab ==================== -->
                <v-window-item value="governance">
                    <div class="pa-4">
                        <!-- Timeline -->
                        <div class="governance-timeline">
                            <div
                                v-for="(entry, idx) in visibleTimelineEntries"
                                :key="idx"
                                class="timeline-entry"
                                :class="{ 'timeline-entry--current': entry.isCurrent }"
                            >
                                <div class="timeline-dot-col">
                                    <div
                                        class="timeline-dot"
                                        :class="{ 'timeline-dot--current': entry.isCurrent }"
                                        :style="{ backgroundColor: entry.color }"
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
                                            :color="entry.roleColor || 'grey'"
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

                        <!-- Feedback Section -->
                        <div class="mt-6">
                            <div class="feedback-section-header text-overline font-weight-bold text-medium-emphasis mb-3">
                                FEEDBACK
                                <v-chip v-if="feedbackItems.length" size="x-small" variant="tonal" color="primary" class="ml-2">
                                    {{ feedbackItems.length }}
                                </v-chip>
                            </div>

                            <div v-if="feedbackItems.length === 0" class="text-center py-4">
                                <v-icon size="32" color="grey-lighten-2">mdi-comment-outline</v-icon>
                                <div class="text-caption text-disabled mt-1">피드백이 없습니다</div>
                            </div>

                            <div
                                v-for="fb in visibleFeedbackItems"
                                :key="fb.id"
                                class="feedback-card"
                                :class="{ 'feedback-card--resolved': fb.is_resolved }"
                            >
                                <div class="d-flex align-center justify-space-between mb-2">
                                    <div class="d-flex align-center ga-2">
                                        <div
                                            class="feedback-dot"
                                            :style="{ backgroundColor: fb.authorColor }"
                                        />
                                        <v-chip
                                            size="x-small"
                                            :color="fb.authorColor"
                                            variant="tonal"
                                        >{{ fb.author_name || '익명' }}</v-chip>
                                        <v-chip
                                            v-if="fb.roleTag"
                                            size="x-small"
                                            variant="outlined"
                                        >{{ fb.roleTag }}</v-chip>
                                    </div>
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
                                </div>
                                <div v-if="fb.element_id && fb.element_id !== '__process__'" class="mb-1">
                                    <v-chip
                                        size="x-small"
                                        color="primary"
                                        variant="tonal"
                                        class="cursor-pointer"
                                        @click="$emit('focusElement', fb.element_id)"
                                    >
                                        <v-icon start size="12">mdi-checkbox-marked-outline</v-icon>
                                        {{ fb.element_name || fb.element_id }}
                                    </v-chip>
                                </div>
                                <div class="text-body-2 feedback-content" :class="{ 'text-medium-emphasis': fb.is_resolved }">
                                    {{ fb.content || fb.comment || '' }}
                                </div>
                                <div class="d-flex align-center justify-space-between mt-2">
                                    <span class="text-caption text-disabled">{{ fb.relativeTime }}</span>
                                    <div v-if="!fb.is_resolved" class="d-flex ga-1">
                                        <v-btn
                                            size="x-small"
                                            variant="flat"
                                            color="primary"
                                            class="text-none"
                                            @click="resolveFeedback(fb)"
                                        >Resolve</v-btn>
                                        <v-btn
                                            size="x-small"
                                            variant="outlined"
                                            class="text-none"
                                            @click="replyFeedback(fb)"
                                        >Reply</v-btn>
                                    </div>
                                </div>
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

                            <!-- Feedback Input -->
                            <div class="feedback-input-area mt-4">
                                <!-- Reply indicator -->
                                <div v-if="replyToFeedback" class="reply-indicator mb-2">
                                    <v-icon size="14" class="mr-1">mdi-reply</v-icon>
                                    <span class="text-caption">@{{ replyToFeedback.author_name || '익명' }} 에게 답글</span>
                                    <v-btn
                                        icon
                                        variant="text"
                                        size="x-small"
                                        class="ml-auto"
                                        @click="replyToFeedback = null; newFeedbackText = ''"
                                    >
                                        <v-icon size="14">mdi-close</v-icon>
                                    </v-btn>
                                </div>
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
                                        {{ mentionedElement.name }}
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
                                        :disabled="!newFeedbackText.trim()"
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
        <v-dialog v-model="resolveDialog" max-width="480" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon size="18" color="success" class="mr-2">mdi-check-circle-outline</v-icon>
                    피드백 해결
                </v-card-title>
                <v-card-text class="pa-4">
                    <!-- Original feedback content (read-only) -->
                    <div v-if="resolvingFeedback" class="resolve-feedback-preview mb-4">
                        <div class="text-caption text-medium-emphasis mb-1">원본 피드백</div>
                        <div class="text-body-2 resolve-feedback-text">{{ resolvingFeedback.content || resolvingFeedback.comment || '' }}</div>
                    </div>
                    <!-- Action taken textarea -->
                    <label class="field-label">조치 내용 (Action Taken) <span class="text-error">*</span></label>
                    <v-textarea
                        v-model="resolveActionText"
                        placeholder="이 피드백에 대해 어떤 조치를 취했는지 입력하세요..."
                        variant="outlined"
                        density="compact"
                        rows="4"
                        auto-grow
                        hide-details
                        autofocus
                    />
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn
                        variant="text"
                        class="text-none"
                        @click="resolveDialog = false; resolvingFeedback = null; resolveActionText = ''"
                    >취소</v-btn>
                    <v-btn
                        variant="flat"
                        color="success"
                        class="text-none"
                        :disabled="!resolveActionText.trim()"
                        @click="confirmResolve"
                    >
                        <v-icon start size="14">mdi-check</v-icon>
                        해결 완료
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Fixed Save Footer -->
        <div v-if="topTab === 'properties' && (activeTab === 'process' || (activeTab === 'task' && element))" class="properties-footer">
            <v-btn
                v-if="activeTab === 'process'"
                color="primary" block variant="flat" class="save-btn" :disabled="isViewMode" @click="saveProcess"
            >
                <v-icon start size="16">mdi-content-save</v-icon>
                Save Changes
            </v-btn>
            <v-btn
                v-else
                color="primary" block variant="flat" class="save-btn" :disabled="isViewMode" @click="saveTask"
            >
                <v-icon start size="16">mdi-content-save</v-icon>
                Save Changes
            </v-btn>
        </div>
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import { useTaskCatalogStore } from '@/stores/taskCatalog';
import BackendFactory from '@/components/api/BackendFactory';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const ANNUAL_WORKING_HOURS = 2080; // 52 weeks x 40 hours

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

// State color map for timeline dots
const STATE_COLORS = {
    draft: '#9e9e9e',
    submit: '#1976d2',
    in_review: '#ff9800',
    approve_hq: '#2196f3',
    approve_field: '#4caf50',
    public_feedback: '#00bcd4',
    final_edit: '#9c27b0',
    published: '#4caf50',
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
    default: '#607d8b',
};

export default {
    name: 'ProcessHierarchyProperties',
    props: {
        processDefinition: { type: Object, default: null },
        element: { type: Object, default: null },
        isViewMode: { type: Boolean, default: false },
        roles: { type: Array, default: () => [] },
        processVariables: { type: Array, default: () => [] },
        definitionPath: { type: String, default: '' },
        definition: { type: Object, default: null },
    },
    emits: ['save', 'close', 'focusElement'],
    data() {
        return {
            topTab: 'properties',
            activeTab: 'process',
            openSections: new Set(['strategic', 'hybrid-costing', 'competency', 'general', 'manual-link', 'task-basic', 'task-fte']),
            processForm: {
                title: '',
                description: '',
                systems: [],
                fte: defaultFte(),
                futureState: 'as_is',
                wilTask: '',
                fteHoursPerMonth: null,
                hitlRequired: false,
                manualLink: '',
            },
            taskForm: {
                name: '',
                description: '',
                manualLink: '',
                systems: [],
                fte: defaultFte(),
                futureStatus: 'maintain',
                schemaProps: {},
            },
            dbSelectItems: {},
            freqCycleOptions: ['Yearly', 'Monthly', 'Weekly', 'Daily'],
            futureStateOptions: [
                { title: 'As-Is (현행 유지)', value: 'as_is' },
                { title: 'To-Be (개선 대상)', value: 'to_be' },
                { title: 'Sunset (폐지 예정)', value: 'sunset' },
            ],
            // Governance data
            approvalState: null,
            approvalHistory: [],
            comments: [],
            // Feedback input
            newFeedbackText: '',
            submittingFeedback: false,
            // Reply state
            replyToFeedback: null,
            // Resolve dialog state
            resolveDialog: false,
            resolveActionText: '',
            resolvingFeedback: null,
            // @Mention state
            mentionedElement: null,
            mentionQuery: '',
            showMentionDropdown: false,
            // 더보기 state
            timelineExpanded: false,
            feedbackExpanded: false,
        };
    },
    computed: {
        catalogStore() {
            return useTaskCatalogStore();
        },
        processFields() {
            return this.catalogStore.schemasByAppliesTo('process');
        },
        taskFields() {
            const elementType = this.element?.type || '';
            return this.catalogStore.schemasByAppliesTo('task', elementType);
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
                const name = this.element.businessObject?.name;
                if (!name || !name.trim()) {
                    alerts.push(this.$t('validation.unnamedTask') || 'Task name is required.');
                }
                this.taskFields.filter(f => f.is_required).forEach(f => {
                    const val = this.taskForm[f.property_key];
                    if (val === undefined || val === null || val === '') {
                        alerts.push(`${f.property_label || f.property_key} is required.`);
                    }
                });
            }
            if (this.activeTab === 'process') {
                if (!this.processForm.title || !this.processForm.title.trim()) {
                    alerts.push(this.$t('validation.processNameRequired') || 'Process name is required.');
                }
            }
            return alerts;
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
            // Reverse to show most recent first
            return [...this.approvalHistory].reverse().map((item, idx) => {
                let dateStr = '';
                try {
                    dateStr = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale });
                } catch { dateStr = item.created_at || ''; }

                const action = item.action || '';
                const roleTag = this.getRoleTag(action, item);
                return {
                    title: this.getTimelineTitle(item),
                    actor: item.actor_name || '',
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
        // Visible feedback (초기 5건만)
        visibleFeedbackItems() {
            if (this.feedbackExpanded) return this.feedbackItems;
            return this.feedbackItems.slice(0, 5);
        },
        hasMoreFeedback() {
            return this.feedbackItems.length > 5;
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
                    const type = el.type || '';
                    return type.includes('Task') || type.includes('Activity');
                }).map(el => ({
                    id: el.id,
                    name: el.businessObject?.name || el.id,
                    type: el.type,
                }));
            } catch { return []; }
        },
        filteredMentionTasks() {
            const q = (this.mentionQuery || '').toLowerCase();
            if (!q) return this.availableTasks;
            return this.availableTasks.filter(t =>
                t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
            );
        },
        // Feedback items from comments (all, including replies)
        feedbackItems() {
            if (!this.comments || this.comments.length === 0) return [];
            const locale = window.$lang === 'ko' ? ko : enUS;
            return this.comments
                .map(c => {
                    let relativeTime = '';
                    try {
                        relativeTime = formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale });
                    } catch { relativeTime = c.created_at || ''; }

                    const role = c.reviewer_role || c.role || '';
                    return {
                        ...c,
                        relativeTime,
                        authorColor: role === 'hq' ? ROLE_COLORS.hq : role === 'field' ? ROLE_COLORS.field : ROLE_COLORS.default,
                        roleTag: role === 'hq' ? '본사' : role === 'field' ? '현업' : (role || null),
                    };
                });
        },
    },
    watch: {
        processDefinition: {
            handler(val) {
                if (val) {
                    this.processForm.title = val.name || '';
                    this.processForm.description = val.description || '';
                    if (val.systems) this.processForm.systems = [...val.systems];
                    if (val.fte) {
                        this.processForm.fte = { ...defaultFte(), ...val.fte };
                    }
                    // New strategic fields
                    this.processForm.futureState = val.futureState || val.future_state || 'as_is';
                    this.processForm.wilTask = val.wilTask || val.wil_task || '';
                    this.processForm.fteHoursPerMonth = val.fteHoursPerMonth ?? val.fte_hours_per_month ?? null;
                    this.processForm.hitlRequired = val.hitlRequired ?? val.hitl_required ?? false;
                    this.processForm.manualLink = val.manualLink || val.manual_link || '';
                    // Load schema-based process props
                    this.processFields.forEach(f => {
                        if (val[f.property_key] !== undefined) {
                            this.processForm[f.property_key] = val[f.property_key];
                        }
                    });
                }
            },
            immediate: true,
        },
        element(val) {
            if (val) {
                this.activeTab = 'task';
                this.loadTaskProperties(val);
            }
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
    },
    async mounted() {
        await this.catalogStore.loadSchemas();
    },
    methods: {
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
        openLink(url) {
            if (url) window.open(url, '_blank');
        },

        // ---- Governance data loading ----
        async loadGovernanceData(procDefId) {
            if (!procDefId) return;
            try {
                const backend = BackendFactory.createBackend();
                const [state, history] = await Promise.all([
                    backend.getApprovalState(procDefId).catch(() => null),
                    backend.getApprovalHistory(procDefId).catch(() => []),
                ]);
                this.approvalState = state;
                this.approvalHistory = history || [];

                // Load comments (all, including replies)
                const supabase = window.$supabase;
                if (supabase) {
                    const { data } = await supabase
                        .from('proc_def_comments')
                        .select('*')
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
                entries.push({
                    title: `v${state.major_version || 1}.${state.minor_version || 0} Draft 생성`,
                    actor: state.submitted_by || '',
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
                    actor: state.hq_reviewer_name || '',
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
                    actor: state.field_reviewer_name || '',
                    date: this.formatRelativeDate(state.field_reviewed_at, locale),
                    color: STATE_COLORS.approve_field,
                    roleTag: '현업',
                    roleColor: ROLE_COLORS.field,
                    isCurrent: false,
                });
            }
            if (state.published_at) {
                entries.push({
                    title: '최종 배포 완료',
                    actor: state.published_by_name || '',
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
                return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale });
            } catch {
                return dateStr || '';
            }
        },

        getTimelineTitle(item) {
            const actionLabels = {
                submit: '검토 요청',
                approve_hq: '본사 승인 완료',
                approve_field: '현업 승인 완료',
                reject_hq: '본사 반려',
                reject_field: '현업 반려',
                start_public_feedback: '공개 검토 개시',
                auto_transition_final_edit: '최종 편집 자동 전환',
                end_public_feedback: '공람 조기 종료',
                publish: '최종 배포',
                reject: '반려',
                reopen: '재작성',
                request_reopen: '현장 개선 요청',
                approve_reopen: 'Re-open 승인',
                reject_reopen: 'Re-open 반려',
                comment: '코멘트',
            };
            const label = actionLabels[item.action] || item.action;
            const comment = item.comment ? ` (${item.comment.substring(0, 30)})` : '';
            return label + comment;
        },

        getRoleTag(action, item) {
            if (action.includes('hq')) return { label: '본사', color: ROLE_COLORS.hq };
            if (action.includes('field')) return { label: '현업', color: ROLE_COLORS.field };
            if (action === 'submit') return { label: '발의', color: ROLE_COLORS.submitter };
            return { label: null, color: null };
        },

        resolveFeedback(fb) {
            this.resolvingFeedback = fb;
            this.resolveDialog = true;
            this.resolveActionText = '';
        },

        async confirmResolve() {
            const supabase = window.$supabase;
            const fb = this.resolvingFeedback;
            if (!supabase || !fb || !fb.id) return;
            if (!this.resolveActionText.trim()) return;
            try {
                await supabase
                    .from('proc_def_comments')
                    .update({ is_resolved: true, resolve_action: this.resolveActionText.trim() })
                    .eq('id', fb.id);
                fb.is_resolved = true;
            } catch (e) {
                console.error('Resolve feedback failed:', e);
            } finally {
                this.resolveDialog = false;
                this.resolvingFeedback = null;
                this.resolveActionText = '';
            }
        },

        replyFeedback(fb) {
            this.replyToFeedback = fb;
            this.newFeedbackText = `@${fb.author_name || '익명'} `;
        },

        async submitFeedback() {
            const supabase = window.$supabase;
            const text = this.newFeedbackText.trim();
            if (!supabase || !text || !this.definitionPath) return;
            this.submittingFeedback = true;
            try {
                const user = (await supabase.auth.getUser())?.data?.user;
                const { error } = await supabase
                    .from('proc_def_comments')
                    .insert({
                        proc_def_id: this.definitionPath,
                        content: text,
                        element_id: this.mentionedElement?.id || '__process__',
                        element_name: this.mentionedElement?.name || null,
                        element_type: this.mentionedElement?.type || null,
                        author_id: user?.id || null,
                        author_name: user?.user_metadata?.full_name || user?.email || '익명',
                        is_resolved: false,
                        parent_comment_id: this.replyToFeedback?.id || null,
                    });
                if (error) throw error;
                this.newFeedbackText = '';
                this.replyToFeedback = null;
                this.mentionedElement = null;
                await this.loadGovernanceData(this.definitionPath);
            } catch (e) {
                console.error('Submit feedback failed:', e);
            } finally {
                this.submittingFeedback = false;
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
            this.mentionedElement = { id: task.id, name: task.name, type: task.type };
            // Replace @query with @taskName in textarea
            const val = this.newFeedbackText || '';
            const atIdx = val.lastIndexOf('@');
            if (atIdx >= 0) {
                this.newFeedbackText = val.substring(0, atIdx) + '@' + task.name + ' ';
            }
            this.showMentionDropdown = false;
            this.mentionQuery = '';
        },
        clearMention() {
            this.mentionedElement = null;
        },

        // ---- Task: BPMN data sync ----
        loadTaskProperties(el) {
            const bo = el.businessObject;
            this.taskForm.name = bo?.name || '';

            let uengineProps = {};
            if (bo?.extensionElements?.values?.[0]?.json) {
                try { uengineProps = JSON.parse(bo.extensionElements.values[0].json); } catch {}
            }

            this.taskForm.description = uengineProps.description || '';
            this.taskForm.manualLink = uengineProps.manualLink || '';
            this.taskForm.systems = uengineProps.systems ? [...uengineProps.systems] : [];
            this.taskForm.fte = { ...defaultFte(), ...(uengineProps.fte || {}) };
            this.taskForm.futureStatus = uengineProps.futureStatus || 'maintain';

            const schemaProps = {};
            this.taskFields.forEach(f => {
                schemaProps[f.property_key] = uengineProps[f.property_key] ?? f.default_value ?? null;
            });
            this.taskForm.schemaProps = schemaProps;
        },

        saveProcess() {
            if (this.isViewMode) {
                this.$toast?.warning('다른 사용자가 편집 중이라 저장할 수 없습니다.');
                return;
            }
            const data = {
                name: this.processForm.title,
                description: this.processForm.description,
                systems: [...(this.processForm.systems || [])],
                fte: { ...this.processForm.fte },
                futureState: this.processForm.futureState,
                wilTask: this.processForm.wilTask,
                fteHoursPerMonth: this.processForm.fteHoursPerMonth,
                hitlRequired: this.processForm.hitlRequired,
                manualLink: this.processForm.manualLink,
            };
            // Include schema-based props
            this.processFields.forEach(f => {
                if (this.processForm[f.property_key] !== undefined) {
                    data[f.property_key] = this.processForm[f.property_key];
                }
            });
            this.$emit('save', data);
        },

        async saveTask() {
            if (this.isViewMode) {
                this.$toast?.warning('다른 사용자가 편집 중이라 저장할 수 없습니다.');
                return;
            }
            if (!this.element) return;

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');
            const shapeElement = elementRegistry.get(this.element.businessObject.id);
            if (!shapeElement) return;

            let existingProps = {};
            const bo = this.element.businessObject;
            if (bo?.extensionElements?.values?.[0]?.json) {
                try { existingProps = JSON.parse(bo.extensionElements.values[0].json); } catch {}
            }

            const uengineProps = {
                ...existingProps,
                description: this.taskForm.description,
                manualLink: this.taskForm.manualLink,
                systems: [...(this.taskForm.systems || [])],
                fte: { ...this.taskForm.fte },
                futureStatus: this.taskForm.futureStatus || 'maintain',
                ...this.taskForm.schemaProps,
            };

            const json = JSON.stringify(uengineProps);

            let otherExtValues = [];
            if (bo.extensionElements?.values) {
                otherExtValues = bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties');
            }

            let variables = [];
            if (uengineProps.customProperties && Array.isArray(uengineProps.customProperties)) {
                variables = uengineProps.customProperties
                    .filter(p => p.key && p.key.trim())
                    .map(p => bpmnFactory.create('uengine:Variable', { key: p.key, value: p.value, json: '{}' }));
            }

            const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables });
            const newExtElements = bpmnFactory.create('bpmn:ExtensionElements', {
                values: [...otherExtValues, uengineEl]
            });

            modeling.updateProperties(shapeElement, {
                name: this.taskForm.name,
                extensionElements: newExtElements,
            });

            try {
                const graphicsFactory = modeler.get('graphicsFactory');
                const gfx = elementRegistry.getGraphics(shapeElement);
                if (graphicsFactory && gfx) {
                    graphicsFactory.update('shape', shapeElement, gfx);
                }
            } catch (e) { /* ignore */ }

            if (this.$toast) {
                this.$toast.success('Task 속성이 저장되었습니다.');
            }
        },
    },
};
</script>

<style scoped>
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

/* Top-level tabs */
.top-level-tabs { min-height: 36px; }
.top-level-tabs :deep(.v-tab) {
    font-size: 12px;
    text-transform: none;
    letter-spacing: 0;
    min-width: 0;
    padding: 0 16px;
    font-weight: 600;
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
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: #666;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
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
</style>
