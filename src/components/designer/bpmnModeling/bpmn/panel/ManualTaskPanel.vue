<template>
    <div>
        <div v-if="inputData.length > 0" style="margin-bottom: 20px">
            <div style="margin-bottom: -8px">{{ $t('BpmnPropertyPanel.inputData') }}</div>
            <v-row class="ma-0 pa-0">
                <div v-for="(inputData, idx) in inputData" :key="idx" class="mr-2 mt-2">
                    <v-chip
                        v-if="inputData.mandatory"
                        color="primary"
                        variant="outlined"
                        class="text-body-2"
                        @click="deleteInputData(inputData)"
                    >
                        {{ inputData.key }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                    <v-chip v-else class="text-body-2" variant="outlined" @click="deleteInputData(inputData)">
                        {{ inputData.key }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                </div>
            </v-row>
        </div>
        <div v-if="outputData.length > 0" style="margin-bottom: 20px">
            <div style="margin-bottom: -8px">{{ $t('BpmnPropertyPanel.outputData') }}</div>
            <v-row class="ma-0 pa-0">
                <div v-for="(output, idx) in outputData" :key="idx" class="mr-2 mt-2">
                    <v-chip
                        v-if="output.mandatory"
                        color="primary"
                        class="text-body-2"
                        variant="outlined"
                        @click="deleteOutputData(output)"
                    >
                        {{ output.variable.name }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                    <v-chip v-else class="text-body-2" variant="outlined" @click="deleteOutputData(output)">
                        {{ output.variable.name }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                </div>
            </v-row>
        </div>
        <div>
            <v-row class="ma-0 pa-0 mb-2">
                <v-text-field v-model="copyUengineProperties.inputPayloadTemplate" :label="$t('ManualTaskPanel.inputData')"></v-text-field>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-text-field v-model="copyUengineProperties.dataInput.name" :label="$t('ManualTaskPanel.resultInputVariable')"></v-text-field>
            </v-row>
        </div>

        <!-- <div>
            <v-row class="ma-0 pa-0">
                <div>{{ $t('BpmnPropertyPanel.checkPoints') }}</div>
                <v-spacer></v-spacer>
                <v-icon v-if="editCheckpoint" @click="editCheckpoint = false" style="margin-top: 2px">mdi-close</v-icon>
            </v-row>
            <div v-for="(checkpoint, idx) in copyUengineProperties.checkpoints" :key="idx">
                <div>
                    <v-checkbox-btn
                        color="success"
                        :disabled="isViewMode"
                        :label="checkpoint.checkpoint"
                        hide-details
                        v-model="checkbox"
                    ></v-checkbox-btn>
                </div>
                <v-btn icon flat @click="deleteCheckPoint(checkpoint)" v-if="!isViewMode" v-bind="props">
                    <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                </v-btn>
            </div>
            <v-text-field v-if="editCheckpoint" v-model="checkpointMessage.checkpoint" :disabled="isViewMode"></v-text-field>
            <v-row class="ma-0 pa-0" v-if="!isViewMode">
                <v-spacer></v-spacer>
                <v-btn v-if="editCheckpoint" @click="addCheckpoint" color="primary" rounded="pill" size="small">{{
                    $t('BpmnPropertyPanel.add')
                }}</v-btn>
                <v-card
                    v-else
                    @click="editCheckpoint = !editCheckpoint"
                    elevation="9"
                    variant="outlined"
                    style="padding: 5px; display: flex; justify-content: center; align-items: center; border-radius: 10px !important"
                >
                    <div style="display: flex; justify-content: center; align-items: center">
                        <Icons :icon="'plus'" :width="20" :height="20" :color="'#5eb2e8'" />
                    </div>
                </v-card>
            </v-row>
        </div>
        <div>
            <v-row class="ma-0 pa-0">
                <div>Extended Property</div>
            </v-row>
            <v-row class="ma-0 pa-0">
                <v-table>
                    <thead>
                        <tr>
                            <th class="text-h6">Key</th>
                            <th class="text-h6">Value</th>
                            <th class="text-h6">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="param in copyUengineProperties.extendedProperties" :key="param.key" class="month-item">
                            <td>
                                {{ param.key }}
                            </td>
                            <td>
                                {{ param.value }}
                            </td>
                            <td>
                                <v-btn icon flat @click="deleteExtendedProperty(param)" v-bind="props">
                                    <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                                </v-btn>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
                <v-btn v-if="!isViewMode" flat color="primary" @click="editParam = !editParam">add Key/Value</v-btn>

                <v-card v-if="editParam" style="margin-top: 12px">
                    <v-card-title>Add Parameter</v-card-title>
                    <v-card-text>
                        <v-text-field v-model="paramKey" label="Key"></v-text-field>
                        <v-text-field v-model="paramValue" label="Value"></v-text-field>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="addParameter">add</v-btn>
                        <v-btn @click="editParam = !editParam">cancel</v-btn>
                    </v-card-actions>
                </v-card>
            </v-row>
        </div> -->
        <!-- Schema-based Properties -->
        <div class="mt-4">
            <div class="text-subtitle-2 mb-2">{{ $t('BpmnPropertyPanel.schemaProperties') || '일반 속성' }}</div>
            <SchemaBasedProperties
                task-type="bpmn:ManualTask"
                v-model="copyUengineProperties.schemaProperties"
                :readonly="isViewMode"
                @update:model-value="onSchemaPropertiesUpdate"
            />
        </div>

        <div class="mt-3">
            <KeyValueField
                v-model="copyUengineProperties.customProperties"
                :label="$t('BpmnPropertyPanel.customProperties') || '사용자 정의 속성'"
                :readonly="isViewMode"
            />
        </div>

        <!-- Task Color Picker -->
        <div class="mt-4">
            <div class="text-subtitle-2 mb-2">{{ $t('BpmnPropertyPanel.taskColor') || '작업 색상' }}</div>

            <!-- Preset Colors -->
            <div class="d-flex flex-wrap gap-2 mb-3">
                <v-btn
                    v-for="color in presetColors"
                    :key="color.value"
                    :style="{ backgroundColor: color.value, border: copyUengineProperties.taskColor === color.value ? '3px solid #1976D2' : '1px solid #ccc' }"
                    size="small"
                    icon
                    :disabled="isViewMode"
                    @click="setTaskColor(color.value)"
                >
                    <v-icon v-if="copyUengineProperties.taskColor === color.value" size="small" color="white">mdi-check</v-icon>
                </v-btn>
            </div>

            <!-- Custom Color Picker -->
            <v-row class="ma-0 pa-0 align-center">
                <v-menu
                    v-model="showColorPicker"
                    :close-on-content-click="false"
                    location="bottom"
                >
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            :disabled="isViewMode"
                            variant="outlined"
                            size="small"
                            class="mr-2"
                        >
                            <v-icon start size="small">mdi-palette</v-icon>
                            {{ $t('BpmnPropertyPanel.customColor') || '사용자 정의 색상' }}
                        </v-btn>
                    </template>
                    <v-card min-width="300">
                        <v-color-picker
                            v-model="customColor"
                            mode="hexa"
                            hide-inputs
                        ></v-color-picker>
                        <v-card-actions>
                            <v-btn size="small" @click="showColorPicker = false">{{ $t('common.cancel') || '취소' }}</v-btn>
                            <v-btn size="small" color="primary" @click="applyCustomColor">{{ $t('common.confirm') || '적용' }}</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-menu>

                <v-btn
                    v-if="copyUengineProperties.taskColor"
                    variant="text"
                    size="small"
                    color="error"
                    :disabled="isViewMode"
                    @click="resetTaskColor"
                >
                    <v-icon size="small">mdi-close</v-icon>
                    {{ $t('BpmnPropertyPanel.resetColor') || '초기화' }}
                </v-btn>
            </v-row>

            <!-- Current Color Preview -->
            <div v-if="copyUengineProperties.taskColor" class="mt-2 d-flex align-center">
                <div
                    :style="{ backgroundColor: copyUengineProperties.taskColor, width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #ccc' }"
                    class="mr-2"
                ></div>
                <span class="text-caption">{{ copyUengineProperties.taskColor }}</span>
            </div>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import { Icon } from '@iconify/vue';
import KeyValueField from '@/components/designer/KeyValueField.vue';
import SchemaBasedProperties from './SchemaBasedProperties.vue';
// import { setPropeties } from '@/components/designer/bpmnModeling/bpmn/panel/CommonPanel.ts';

export default {
    name: 'manual-task-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    components: {
        KeyValueField,
        SchemaBasedProperties
    },
    created() {
        if (this.uengineProperties) {
            this.copyUengineProperties = JSON.parse(JSON.stringify(this.uengineProperties));
        } else {
            this.copyUengineProperties = {};
        }
        Object.keys(this.requiredKeyLists).forEach((key) => {
            this.ensureKeyExists(this.copyUengineProperties, key, this.requiredKeyLists[key]);
        });
        if(!this.copyUengineProperties.customProperties) this.copyUengineProperties.customProperties = [];
        if(!this.copyUengineProperties.schemaProperties) this.copyUengineProperties.schemaProperties = {};
    },
    data() {
        return {
            requiredKeyLists: {
                parameters: [],
                checkpoints: [],
                dataInput: { name: '' }
            },
            methodList: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
            copyUengineProperties: null,
            name: '',
            checkpoints: [],
            editCheckpoint: false,
            checkpointMessage: {
                $type: 'uengine:Checkpoint',
                checkpoint: ''
            },
            code: '',
            description: '',
            selectedDefinition: '',
            bpmnModeler: null,
            stroage: null,
            editParam: false,
            paramKey: '',
            paramValue: '',
            // Color picker
            showColorPicker: false,
            customColor: '#fdf2d0',
            presetColors: [
                { name: 'Default Yellow', value: '#fdf2d0' },
                { name: 'Light Blue', value: '#e3f2fd' },
                { name: 'Light Green', value: '#e8f5e9' },
                { name: 'Light Purple', value: '#f3e5f5' },
                { name: 'Light Orange', value: '#fff3e0' },
                { name: 'Light Pink', value: '#fce4ec' },
                { name: 'Light Cyan', value: '#e0f7fa' },
                { name: 'Light Red', value: '#ffebee' },
                { name: 'Light Gray', value: '#f5f5f5' },
                { name: 'White', value: '#ffffff' }
            ]
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        // Object.keys(this.requiredKeyLists).forEach((key) => {
        //     this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key]);
        // });
    },
    computed: {
        inputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'IN') result.push(element);
                });
            return result;
        },
        outputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'OUT') result.push(element);
                });
            return result;
        }
    },
    watch: {},
    methods: {
        onSchemaPropertiesUpdate(properties) {
            this.copyUengineProperties.schemaProperties = properties;
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        },
        deleteInputData(inputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === inputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        deleteOutputData(outputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === outputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        deleteExtendedProperty(item) {
            const index = this.copyUengineProperties.extendedProperties.findIndex((element) => element.key === item.key);
            if (index > -1) {
                this.copyUengineProperties.extendedProperties.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        deleteCheckPoint(item) {
            const index = this.copyUengineProperties.checkpoints.findIndex((element) => element.checkpoint === item.checkpoint);
            if (index > -1) {
                this.copyUengineProperties.checkpoints.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        addParameter() {
            this.copyUengineProperties.extendedProperties.push({ key: this.paramKey, value: this.paramValue });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
            // const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            // // this.checkpoints.push(this.checkpointMessage)
            // const parameter = bpmnFactory.create('uengine:ExtendedProperty', { key: this.paramKey, value: this.paramValue });
            // if (!this.elementCopy.extensionElements.values[0].ExtendedProperties) this.elementCopy.extensionElements.values[0].ExtendedProperties = []
            // this.elementCopy.extensionElements.values[0].ExtendedProperties.push(parameter)
            // this.paramKey = ""
            // this.paramValue = ""
        },
        
        addCheckpoint() {
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        },
        beforeSave() {
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        },
        setTaskColor(color) {
            this.copyUengineProperties.taskColor = color;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.refreshTaskVisual();
        },
        applyCustomColor() {
            this.copyUengineProperties.taskColor = this.customColor;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.showColorPicker = false;
            this.refreshTaskVisual();
        },
        resetTaskColor() {
            delete this.copyUengineProperties.taskColor;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.refreshTaskVisual();
        },
        refreshTaskVisual() {
            // Trigger a redraw of the element to reflect color changes
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (modeler) {
                try {
                    const elementRegistry = modeler.get('elementRegistry');
                    const graphicsFactory = modeler.get('graphicsFactory');
                    const element = elementRegistry.get(this.$parent?.element?.id);
                    if (element) {
                        const gfx = elementRegistry.getGraphics(element);
                        if (gfx) {
                            graphicsFactory.update('shape', element, gfx);
                        }
                    }
                } catch (e) {
                    console.warn('Could not refresh task visual:', e);
                }
            }
        }
    }
};
</script>
