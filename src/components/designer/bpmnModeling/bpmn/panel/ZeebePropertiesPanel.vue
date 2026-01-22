<template>
    <div class="zeebe-properties-panel">
        <!-- Task Definition (Service Task, Send Task) -->
        <div v-if="showTaskDefinition" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Task Definition</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <v-row class="ma-0 pa-0">
                    <v-col cols="8" class="pa-0 pr-2">
                        <v-text-field
                            v-model="copyUengineProperties.zeebe.taskDefinition.type"
                            label="Job Type"
                            variant="outlined"
                            density="compact"
                            hide-details
                            :disabled="isViewMode"
                        />
                    </v-col>
                    <v-col cols="4" class="pa-0">
                        <v-text-field
                            v-model="copyUengineProperties.zeebe.taskDefinition.retries"
                            label="Retries"
                            variant="outlined"
                            density="compact"
                            hide-details
                            type="number"
                            :disabled="isViewMode"
                        />
                    </v-col>
                </v-row>
            </v-card>
        </div>

        <!-- Form Definition (User Task) -->
        <div v-if="showFormDefinition" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Form Definition</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <v-text-field
                    v-model="copyUengineProperties.zeebe.formDefinition.formId"
                    label="Form ID"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-2"
                    :disabled="isViewMode"
                />
                <v-text-field
                    v-model="copyUengineProperties.zeebe.formDefinition.formKey"
                    label="Form Key"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :disabled="isViewMode"
                />
            </v-card>
        </div>

        <!-- Assignment Definition (User Task) -->
        <div v-if="showAssignmentDefinition" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Assignment</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <v-text-field
                    :model-value="stripEqual(copyUengineProperties.zeebe.assignmentDefinition.assignee)"
                    @update:model-value="(v) => copyUengineProperties.zeebe.assignmentDefinition.assignee = addEqual(v)"
                    label="Assignee"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-2"
                    placeholder="variableName"
                    :disabled="isViewMode"
                />
                <v-text-field
                    :model-value="stripEqual(copyUengineProperties.zeebe.assignmentDefinition.candidateGroups)"
                    @update:model-value="(v) => copyUengineProperties.zeebe.assignmentDefinition.candidateGroups = addEqual(v)"
                    label="Candidate Groups"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-2"
                    placeholder="group1,group2"
                    :disabled="isViewMode"
                />
                <v-text-field
                    :model-value="stripEqual(copyUengineProperties.zeebe.assignmentDefinition.candidateUsers)"
                    @update:model-value="(v) => copyUengineProperties.zeebe.assignmentDefinition.candidateUsers = addEqual(v)"
                    label="Candidate Users"
                    variant="outlined"
                    density="compact"
                    hide-details
                    placeholder="user1,user2"
                    :disabled="isViewMode"
                />
            </v-card>
        </div>

        <!-- Called Decision (Business Rule Task) -->
        <div v-if="showCalledDecision" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Called Decision (DMN)</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <v-text-field
                    v-model="copyUengineProperties.zeebe.calledDecision.decisionId"
                    label="Decision ID"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-2"
                    :disabled="isViewMode"
                />
                <v-text-field
                    v-model="copyUengineProperties.zeebe.calledDecision.resultVariable"
                    label="Result Variable"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :disabled="isViewMode"
                />
            </v-card>
        </div>

        <!-- Called Element (Call Activity) -->
        <div v-if="showCalledElement" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Called Element</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <v-text-field
                    v-model="copyUengineProperties.zeebe.calledElement.processId"
                    label="Process ID"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-2"
                    :disabled="isViewMode"
                />
                <v-checkbox
                    v-model="copyUengineProperties.zeebe.calledElement.propagateAllChildVariables"
                    label="Propagate All Child Variables"
                    density="compact"
                    hide-details
                    :disabled="isViewMode"
                />
            </v-card>
        </div>

        <!-- Script (Script Task) -->
        <div v-if="showScript" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Script (FEEL)</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <v-textarea
                    :model-value="stripEqual(copyUengineProperties.zeebe.script.expression)"
                    @update:model-value="(v) => copyUengineProperties.zeebe.script.expression = addEqual(v)"
                    label="Expression"
                    variant="outlined"
                    density="compact"
                    hide-details
                    class="mb-2"
                    rows="4"
                    placeholder="{ key: value }"
                    :disabled="isViewMode"
                />
                <v-text-field
                    v-model="copyUengineProperties.zeebe.script.resultVariable"
                    label="Result Variable"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :disabled="isViewMode"
                />
            </v-card>
        </div>

        <!-- IO Mapping -->
        <div v-if="showIoMapping" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Input/Output Mapping</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <!-- Input Parameters -->
                <div class="mb-3">
                    <div class="text-caption mb-2">Input Parameters</div>
                    <div v-for="(input, index) in copyUengineProperties.zeebe.ioMapping.inputs" :key="'input-' + index" class="mb-2">
                        <v-row class="ma-0 pa-0 align-center">
                            <v-col cols="5" class="pa-0 pr-1">
                                <v-text-field
                                    :model-value="stripEqual(input.source)"
                                    @update:model-value="(v) => input.source = addEqual(v)"
                                    label="Source"
                                    variant="outlined"
                                    density="compact"
                                    hide-details
                                    placeholder="expression"
                                    :disabled="isViewMode"
                                />
                            </v-col>
                            <v-col cols="5" class="pa-0 pr-1">
                                <v-text-field
                                    v-model="input.target"
                                    label="Target"
                                    variant="outlined"
                                    density="compact"
                                    hide-details
                                    :disabled="isViewMode"
                                />
                            </v-col>
                            <v-col cols="2" class="pa-0 d-flex justify-end">
                                <v-btn variant="text" density="comfortable" size="x-small" icon="mdi-delete" @click="removeInput(index)" :disabled="isViewMode" />
                            </v-col>
                        </v-row>
                    </div>
                    <v-btn variant="text" density="comfortable" size="small" @click="addInput" :disabled="isViewMode">
                        <v-icon size="small" start>mdi-plus</v-icon>
                        Add Input
                    </v-btn>
                </div>

                <v-divider class="my-3" />

                <!-- Output Parameters -->
                <div>
                    <div class="text-caption mb-2">Output Parameters</div>
                    <div v-for="(output, index) in copyUengineProperties.zeebe.ioMapping.outputs" :key="'output-' + index" class="mb-2">
                        <v-row class="ma-0 pa-0 align-center">
                            <v-col cols="5" class="pa-0 pr-1">
                                <v-text-field
                                    :model-value="stripEqual(output.source)"
                                    @update:model-value="(v) => output.source = addEqual(v)"
                                    label="Source"
                                    variant="outlined"
                                    density="compact"
                                    hide-details
                                    placeholder="expression"
                                    :disabled="isViewMode"
                                />
                            </v-col>
                            <v-col cols="5" class="pa-0 pr-1">
                                <v-text-field
                                    v-model="output.target"
                                    label="Target"
                                    variant="outlined"
                                    density="compact"
                                    hide-details
                                    :disabled="isViewMode"
                                />
                            </v-col>
                            <v-col cols="2" class="pa-0 d-flex justify-end">
                                <v-btn variant="text" density="comfortable" size="x-small" icon="mdi-delete" @click="removeOutput(index)" :disabled="isViewMode" />
                            </v-col>
                        </v-row>
                    </div>
                    <v-btn variant="text" density="comfortable" size="small" @click="addOutput" :disabled="isViewMode">
                        <v-icon size="small" start>mdi-plus</v-icon>
                        Add Output
                    </v-btn>
                </div>
            </v-card>
        </div>

        <!-- Task Headers -->
        <div v-if="showTaskHeaders" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Task Headers</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <div v-for="(header, index) in copyUengineProperties.zeebe.taskHeaders" :key="'header-' + index" class="mb-2">
                    <v-row class="ma-0 pa-0 align-center">
                        <v-col cols="5" class="pa-0 pr-1">
                            <v-text-field
                                v-model="header.key"
                                label="Key"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="5" class="pa-0 pr-1">
                            <v-text-field
                                v-model="header.value"
                                label="Value"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="2" class="pa-0 d-flex justify-end">
                            <v-btn variant="text" density="comfortable" size="x-small" icon="mdi-delete" @click="removeHeader(index)" :disabled="isViewMode" />
                        </v-col>
                    </v-row>
                </div>
                <v-btn variant="text" density="comfortable" size="small" @click="addHeader" :disabled="isViewMode">
                    <v-icon size="small" start>mdi-plus</v-icon>
                    Add Header
                </v-btn>
            </v-card>
        </div>

        <!-- Execution Listeners -->
        <div v-if="showExecutionListeners" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Execution Listeners</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <div v-for="(listener, index) in copyUengineProperties.zeebe.executionListeners" :key="'execListener-' + index" class="mb-3 pa-2 border rounded">
                    <v-row class="ma-0 pa-0">
                        <v-col cols="4" class="pa-0 pr-1">
                            <v-select
                                v-model="listener.eventType"
                                :items="['start', 'end']"
                                label="Event"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="4" class="pa-0 pr-1">
                            <v-text-field
                                v-model="listener.type"
                                label="Type"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="3" class="pa-0 pr-1">
                            <v-text-field
                                v-model="listener.retries"
                                label="Retries"
                                variant="outlined"
                                density="compact"
                                hide-details
                                type="number"
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="1" class="pa-0 d-flex justify-end align-center">
                            <v-btn variant="text" density="comfortable" size="x-small" icon="mdi-delete" @click="removeExecutionListener(index)" :disabled="isViewMode" />
                        </v-col>
                    </v-row>
                </div>
                <v-btn variant="text" density="comfortable" size="small" @click="addExecutionListener" :disabled="isViewMode">
                    <v-icon size="small" start>mdi-plus</v-icon>
                    Add Listener
                </v-btn>
            </v-card>
        </div>

        <!-- Task Listeners (User Task) -->
        <div v-if="showTaskListeners" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Task Listeners</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <div v-for="(listener, index) in copyUengineProperties.zeebe.taskListeners" :key="'taskListener-' + index" class="mb-3 pa-2 border rounded">
                    <v-row class="ma-0 pa-0">
                        <v-col cols="4" class="pa-0 pr-1">
                            <v-select
                                v-model="listener.eventType"
                                :items="taskListenerEventTypes"
                                label="Event"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="4" class="pa-0 pr-1">
                            <v-text-field
                                v-model="listener.type"
                                label="Type"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="3" class="pa-0 pr-1">
                            <v-text-field
                                v-model="listener.retries"
                                label="Retries"
                                variant="outlined"
                                density="compact"
                                hide-details
                                type="number"
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="1" class="pa-0 d-flex justify-end align-center">
                            <v-btn variant="text" density="comfortable" size="x-small" icon="mdi-delete" @click="removeTaskListener(index)" :disabled="isViewMode" />
                        </v-col>
                    </v-row>
                </div>
                <v-btn variant="text" density="comfortable" size="small" @click="addTaskListener" :disabled="isViewMode">
                    <v-icon size="small" start>mdi-plus</v-icon>
                    Add Listener
                </v-btn>
            </v-card>
        </div>

        <!-- Zeebe Properties -->
        <div v-if="showZeebeProperties" class="mb-4 mt-4">
            <div class="text-subtitle-2 mb-2">Zeebe Properties</div>
            <v-card variant="outlined" class="pa-3" style="border-radius: 8px !important;">
                <div v-for="(prop, index) in copyUengineProperties.zeebe.properties" :key="'prop-' + index" class="mb-2">
                    <v-row class="ma-0 pa-0 align-center">
                        <v-col cols="5" class="pa-0 pr-1">
                            <v-text-field
                                v-model="prop.name"
                                label="Name"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="5" class="pa-0 pr-1">
                            <v-text-field
                                v-model="prop.value"
                                label="Value"
                                variant="outlined"
                                density="compact"
                                hide-details
                                :disabled="isViewMode"
                            />
                        </v-col>
                        <v-col cols="2" class="pa-0 d-flex justify-end">
                            <v-btn variant="text" density="comfortable" size="x-small" icon="mdi-delete" @click="removeProperty(index)" :disabled="isViewMode" />
                        </v-col>
                    </v-row>
                </div>
                <v-btn variant="text" density="comfortable" size="small" @click="addProperty" :disabled="isViewMode">
                    <v-icon size="small" start>mdi-plus</v-icon>
                    Add Property
                </v-btn>
            </v-card>
        </div>
    </div>
</template>

<script>
export default {
    name: 'zeebe-properties-panel',
    props: {
        uengineProperties: {
            type: Object,
            required: true
        },
        elementType: {
            type: String,
            default: ''
        },
        isViewMode: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:uengineProperties'],
    data() {
        return {
            copyUengineProperties: {},
            taskListenerEventTypes: ['creating', 'created', 'assigning', 'assigned', 'completing', 'completed', 'updating', 'updated', 'canceling', 'canceled']
        };
    },
    created() {
        // Deep clone uengineProperties
        this.copyUengineProperties = JSON.parse(JSON.stringify(this.uengineProperties || {}));

        // Ensure zeebe structure exists
        if (!this.copyUengineProperties.zeebe) {
            this.copyUengineProperties.zeebe = this.getDefaultZeebeStructure();
        } else {
            // Merge with defaults to ensure all fields exist
            this.copyUengineProperties.zeebe = {
                ...this.getDefaultZeebeStructure(),
                ...this.copyUengineProperties.zeebe
            };
        }
    },
    computed: {
        isUserTask() {
            return this.elementType.includes('UserTask');
        },
        isServiceTask() {
            return this.elementType.includes('ServiceTask');
        },
        isSendTask() {
            return this.elementType.includes('SendTask');
        },
        isBusinessRuleTask() {
            return this.elementType.includes('BusinessRuleTask');
        },
        isScriptTask() {
            return this.elementType.includes('ScriptTask');
        },
        isCallActivity() {
            return this.elementType.includes('CallActivity');
        },
        showTaskDefinition() {
            return this.isServiceTask || this.isSendTask ||
                   (this.copyUengineProperties.zeebe?.taskDefinition?.type);
        },
        showFormDefinition() {
            return this.isUserTask ||
                   (this.copyUengineProperties.zeebe?.formDefinition?.formId ||
                    this.copyUengineProperties.zeebe?.formDefinition?.formKey);
        },
        showAssignmentDefinition() {
            return this.isUserTask ||
                   (this.copyUengineProperties.zeebe?.assignmentDefinition?.assignee ||
                    this.copyUengineProperties.zeebe?.assignmentDefinition?.candidateGroups ||
                    this.copyUengineProperties.zeebe?.assignmentDefinition?.candidateUsers);
        },
        showCalledDecision() {
            return this.isBusinessRuleTask ||
                   (this.copyUengineProperties.zeebe?.calledDecision?.decisionId);
        },
        showCalledElement() {
            return this.isCallActivity ||
                   (this.copyUengineProperties.zeebe?.calledElement?.processId);
        },
        showScript() {
            return this.isScriptTask ||
                   (this.copyUengineProperties.zeebe?.script?.expression);
        },
        showIoMapping() {
            return (this.copyUengineProperties.zeebe?.ioMapping?.inputs?.length > 0 ||
                    this.copyUengineProperties.zeebe?.ioMapping?.outputs?.length > 0);
        },
        showTaskHeaders() {
            return this.copyUengineProperties.zeebe?.taskHeaders?.length > 0;
        },
        showExecutionListeners() {
            return this.copyUengineProperties.zeebe?.executionListeners?.length > 0;
        },
        showTaskListeners() {
            return this.isUserTask || this.copyUengineProperties.zeebe?.taskListeners?.length > 0;
        },
        showZeebeProperties() {
            return this.copyUengineProperties.zeebe?.properties?.length > 0;
        }
    },
    methods: {
        getDefaultZeebeStructure() {
            return {
                taskDefinition: { type: '', retries: '3' },
                formDefinition: { formId: '', formKey: '' },
                assignmentDefinition: { assignee: '', candidateGroups: '', candidateUsers: '' },
                priorityDefinition: { priority: '' },
                taskSchedule: { dueDate: '', followUpDate: '' },
                calledDecision: { decisionId: '', resultVariable: '' },
                calledElement: { processId: '', propagateAllChildVariables: false },
                script: { expression: '', resultVariable: '' },
                ioMapping: { inputs: [], outputs: [] },
                taskHeaders: [],
                executionListeners: [],
                taskListeners: [],
                properties: []
            };
        },

        // Add/Remove methods
        addInput() {
            if (!this.copyUengineProperties.zeebe.ioMapping.inputs) {
                this.copyUengineProperties.zeebe.ioMapping.inputs = [];
            }
            this.copyUengineProperties.zeebe.ioMapping.inputs.push({ source: '', target: '' });
        },
        removeInput(index) {
            this.copyUengineProperties.zeebe.ioMapping.inputs.splice(index, 1);
        },
        addOutput() {
            if (!this.copyUengineProperties.zeebe.ioMapping.outputs) {
                this.copyUengineProperties.zeebe.ioMapping.outputs = [];
            }
            this.copyUengineProperties.zeebe.ioMapping.outputs.push({ source: '', target: '' });
        },
        removeOutput(index) {
            this.copyUengineProperties.zeebe.ioMapping.outputs.splice(index, 1);
        },
        addHeader() {
            if (!this.copyUengineProperties.zeebe.taskHeaders) {
                this.copyUengineProperties.zeebe.taskHeaders = [];
            }
            this.copyUengineProperties.zeebe.taskHeaders.push({ key: '', value: '' });
        },
        removeHeader(index) {
            this.copyUengineProperties.zeebe.taskHeaders.splice(index, 1);
        },
        addExecutionListener() {
            if (!this.copyUengineProperties.zeebe.executionListeners) {
                this.copyUengineProperties.zeebe.executionListeners = [];
            }
            this.copyUengineProperties.zeebe.executionListeners.push({ eventType: 'start', type: '', retries: '3' });
        },
        removeExecutionListener(index) {
            this.copyUengineProperties.zeebe.executionListeners.splice(index, 1);
        },
        addTaskListener() {
            if (!this.copyUengineProperties.zeebe.taskListeners) {
                this.copyUengineProperties.zeebe.taskListeners = [];
            }
            this.copyUengineProperties.zeebe.taskListeners.push({ eventType: 'creating', type: '', retries: '3' });
        },
        removeTaskListener(index) {
            this.copyUengineProperties.zeebe.taskListeners.splice(index, 1);
        },
        addProperty() {
            if (!this.copyUengineProperties.zeebe.properties) {
                this.copyUengineProperties.zeebe.properties = [];
            }
            this.copyUengineProperties.zeebe.properties.push({ name: '', value: '' });
        },
        removeProperty(index) {
            this.copyUengineProperties.zeebe.properties.splice(index, 1);
        },

        // FEEL expression helpers - strip/add '=' prefix
        stripEqual(value) {
            if (!value) return '';
            return value.startsWith('=') ? value.substring(1) : value;
        },
        addEqual(value) {
            if (!value) return '';
            return value.startsWith('=') ? value : '=' + value;
        },

        beforeSave() {
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        }
    }
};
</script>

<style scoped>
.zeebe-properties-panel .border {
    border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
