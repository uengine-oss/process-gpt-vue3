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
            <v-tabs
                v-model="activeTab"
                density="compact"
                class="properties-tabs"
                color="primary"
                height="36"
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
        </div>

        <!-- Content -->
        <div class="properties-content">
            <v-window v-model="activeTab">
                <!-- ==================== Process Tab ==================== -->
                <v-window-item value="process">
                    <div class="pa-4">
                        <!-- Basic -->
                        <div class="section-group">
                            <div class="section-title" @click="toggle('proc-basic')">
                                <v-icon size="14" class="mr-1">{{ isOpen('proc-basic') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                Basic
                            </div>
                            <div v-show="isOpen('proc-basic')" class="section-body">
                                <!-- Schema fields for Process -->
                                <template v-for="field in processFields" :key="field.id">
                                    <label class="field-label">{{ field.property_label || field.property_key }}</label>
                                    <!-- Text -->
                                    <v-text-field
                                        v-if="field.property_type === 'string'"
                                        v-model="processForm[field.property_key]"
                                        density="compact" variant="outlined" hide-details class="mb-3"
                                        :placeholder="field.placeholder"
                                    />
                                    <!-- TextArea -->
                                    <v-textarea
                                        v-else-if="field.property_type === 'textarea'"
                                        v-model="processForm[field.property_key]"
                                        density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3"
                                        :placeholder="field.placeholder"
                                    />
                                    <!-- Number -->
                                    <v-text-field
                                        v-else-if="field.property_type === 'number'"
                                        v-model.number="processForm[field.property_key]"
                                        density="compact" variant="outlined" hide-details type="number" class="mb-3"
                                        :placeholder="field.placeholder"
                                    />
                                    <!-- URL -->
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
                                    <!-- Formula (read-only display) -->
                                    <div v-else-if="field.property_type === 'formula'" class="formula-display mb-3">
                                        <span class="text-caption text-medium-emphasis">{{ field.config?.expression || '' }}</span>
                                        <span class="text-subtitle-2 font-weight-bold ml-2">{{ processForm[field.property_key] || '-' }}</span>
                                    </div>
                                    <!-- DB-Select -->
                                    <v-select
                                        v-else-if="field.property_type === 'db-select'"
                                        v-model="processForm[field.property_key]"
                                        :items="dbSelectItems[field.property_key] || []"
                                        density="compact" variant="outlined" hide-details class="mb-3"
                                        :placeholder="field.placeholder"
                                        clearable
                                    />
                                    <!-- Select -->
                                    <v-select
                                        v-else-if="field.property_type === 'select'"
                                        v-model="processForm[field.property_key]"
                                        :items="field.options || []"
                                        item-title="label" item-value="value"
                                        density="compact" variant="outlined" hide-details class="mb-3"
                                        clearable
                                    />
                                    <!-- Boolean -->
                                    <v-switch
                                        v-else-if="field.property_type === 'boolean'"
                                        v-model="processForm[field.property_key]"
                                        density="compact" color="primary" hide-details class="mb-3"
                                    />
                                </template>
                                <!-- Fallback if no schema fields -->
                                <template v-if="processFields.length === 0">
                                    <label class="field-label">Title</label>
                                    <v-text-field v-model="processForm.title" density="compact" variant="outlined" hide-details class="mb-3" placeholder="Process name" />
                                    <label class="field-label">Description</label>
                                    <v-textarea v-model="processForm.description" density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3" placeholder="Describe the process..." />
                                </template>
                            </div>
                        </div>

                        <!-- FTE Calculator -->
                        <div class="section-group">
                            <div class="section-title" @click="toggle('proc-fte')">
                                <v-icon size="14" class="mr-1">{{ isOpen('proc-fte') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                FTE Calculator
                                <v-icon size="14" class="ml-1" color="grey">mdi-information-outline</v-icon>
                                <v-chip v-if="processFteValue" size="x-small" variant="tonal" color="primary" class="ml-auto">
                                    FTE {{ processFteValue }}
                                </v-chip>
                            </div>
                            <div v-show="isOpen('proc-fte')" class="section-body">
                                <!-- Input Mode Toggle -->
                                <label class="field-label">Input Mode</label>
                                <v-btn-toggle v-model="processForm.fte.inputMode" mandatory density="compact" class="mb-3 fte-mode-toggle" color="primary">
                                    <v-btn value="direct" size="small">Direct %</v-btn>
                                    <v-btn value="time" size="small">Time-Freq-People</v-btn>
                                </v-btn-toggle>

                                <!-- Direct % Mode -->
                                <template v-if="processForm.fte.inputMode === 'direct'">
                                    <label class="field-label">FTE (%)</label>
                                    <v-text-field
                                        v-model.number="processForm.fte.directPercent"
                                        density="compact" variant="outlined" hide-details type="number"
                                        min="0" max="100" suffix="%"
                                    />
                                </template>

                                <!-- Time-Freq-People Mode -->
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

                                <!-- Calculated FTE Result -->
                                <div v-if="processFteValue" class="fte-result-card mt-3">
                                    <div class="d-flex align-center justify-space-between">
                                        <span class="fte-result-label">CALCULATED FTE</span>
                                        <v-btn variant="text" size="x-small" color="primary" class="text-none">
                                            <v-icon size="12" start>mdi-sync</v-icon>
                                            Sync with Global FTE
                                        </v-btn>
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

                        <v-btn color="primary" block variant="flat" class="mt-4 save-btn" @click="saveProcess">
                            <v-icon start size="16">mdi-content-save</v-icon>
                            Save Changes
                        </v-btn>
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

                            <v-btn color="primary" block variant="flat" class="mt-4 save-btn" @click="saveTask">
                                <v-icon start size="16">mdi-content-save</v-icon>
                                Save Changes
                            </v-btn>
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
        </div>
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import { useTaskCatalogStore } from '@/stores/taskCatalog';

const ANNUAL_WORKING_HOURS = 2080; // 52 weeks × 40 hours

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
    emits: ['save', 'close'],
    data() {
        return {
            activeTab: 'process',
            openSections: new Set(['proc-basic', 'task-basic', 'task-fte']),
            processForm: {
                title: '',
                description: '',
                systems: [],
                fte: defaultFte(),
            },
            taskForm: {
                name: '',
                description: '',
                manualLink: '',
                systems: [],
                fte: defaultFte(),
                schemaProps: {},
            },
            dbSelectItems: {},
            freqCycleOptions: ['Yearly', 'Monthly', 'Weekly', 'Daily'],
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
    },
    async mounted() {
        // Load property schemas
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

        // ---- Task: BPMN data sync (참조: BpmnPropertyPanel) ----
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

            // Load schema-based task props
            const schemaProps = {};
            this.taskFields.forEach(f => {
                schemaProps[f.property_key] = uengineProps[f.property_key] ?? f.default_value ?? null;
            });
            this.taskForm.schemaProps = schemaProps;
        },

        saveProcess() {
            const data = {
                name: this.processForm.title,
                description: this.processForm.description,
                systems: [...(this.processForm.systems || [])],
                fte: { ...this.processForm.fte },
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
            if (!this.element) return;

            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (!modeler) return;

            const modeling = modeler.get('modeling');
            const elementRegistry = modeler.get('elementRegistry');
            const bpmnFactory = modeler.get('bpmnFactory');
            const shapeElement = elementRegistry.get(this.element.businessObject.id);
            if (!shapeElement) return;

            // Build uengineProperties from form
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
                ...this.taskForm.schemaProps,
            };

            const json = JSON.stringify(uengineProps);

            // Preserve non-uengine extension elements (e.g. zeebe)
            let otherExtValues = [];
            if (bo.extensionElements?.values) {
                otherExtValues = bo.extensionElements.values.filter(v => v.$type !== 'uengine:Properties');
            }

            // customProperties → variables
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

.properties-tabs { min-height: 36px; }
.properties-tabs :deep(.v-tab) {
    font-size: 12px;
    text-transform: none;
    letter-spacing: 0;
    min-width: 0;
    padding: 0 12px;
}

.properties-content {
    flex: 1;
    overflow-y: auto;
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

/* Save button */
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
</style>
