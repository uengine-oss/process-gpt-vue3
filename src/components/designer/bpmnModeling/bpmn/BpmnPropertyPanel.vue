<template>
    <div style="height: 95%; margin-top: 10px; overflow: auto;">
        <v-card-text>
            <div>{{ $t('BpnmPropertyPanel.name') }}</div>
            <v-text-field v-model="name" :disabled="isViewMode"></v-text-field>
            <div>
                <div>{{ $t('BpnmPropertyPanel.description') }}</div>
                <v-textarea v-if="!elementCopy.$type.includes('Event')" :disabled="isViewMode"
                    v-model="uengineProperties.description"></v-textarea>
            </div>
            <div v-if="element.$type.includes('Task') && inputData.length > 0" style="margin-bottom:20px;">
                <div style="margin-bottom:-8px;">{{ $t('BpnmPropertyPanel.inputData') }}</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(inputData, idx) in inputData" :key="idx" class="mr-2 mt-2">
                        <v-chip v-if="inputData.mandatory" color="primary" variant="outlined" class="text-body-2">
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2" variant="outlined">
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div class="included" v-if="element.$type == 'bpmn:CallActivity'" style="margin-bottom: 22px;">
                <div style="margin-bottom: 8px;">Select Definition</div>
                <v-autocomplete v-model="uengineProperties.definition" :items="definitions" :disabled="isViewMode"
                    item-title="name" color="primary" label="Definition" variant="outlined"
                    hide-details></v-autocomplete>
            </div>
            <div v-if="element.$type.includes('Task') && outputData.length > 0" style="margin-bottom:20px;">
                <div style="margin-bottom:-8px;">{{ $t('BpnmPropertyPanel.outputData') }}</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(output, idx) in outputData" :key="idx" class="mr-2 mt-2">
                        <v-chip v-if="output.mandatory" color="primary" class="text-body-2" variant="outlined">
                            {{ output.variable.name }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2" variant="outlined">
                            {{ output.variable.name }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div v-if="element.$type == 'bpmn:ScriptTask'" :disabled="isViewMode">
                Script (Python)
                <v-textarea v-model="uengineProperties.pythonCode"></v-textarea>
            </div>
            <div v-if="element.$type.includes('Flow')">
                Condition
                <br />
                <v-text-field :disabled="isViewMode" v-model="uengineProperties.condition"></v-text-field>
            </div>
            <div v-if="element.$type.includes('Task')">
                <v-row class="ma-0 pa-0">
                    <div>{{ $t('BpnmPropertyPanel.checkPoints') }}</div>
                    <v-spacer></v-spacer>
                    <v-icon v-if="editCheckpoint" @click="editCheckpoint = false"
                        style="margin-top:2px;">mdi-close</v-icon>
                </v-row>
                <div v-for="(checkpoint, idx) in uengineProperties.checkpoints" :key="idx">
                    <div>
                        <v-checkbox-btn color="success" :disabled="isViewMode" :label="checkpoint.checkpoint"
                            hide-details v-model="checkbox"></v-checkbox-btn>
                    </div>
                    <v-btn icon flat @click="deleteCheckPoint(checkpoint)" v-if="!isViewMode" v-bind="props">
                        <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                    </v-btn>
                </div>
                <v-text-field v-if="editCheckpoint" v-model="checkpointMessage.checkpoint"
                    :disabled="isViewMode"></v-text-field>
                <v-row class="ma-0 pa-0" v-if="!isViewMode">
                    <v-spacer></v-spacer>
                    <v-btn v-if="editCheckpoint" @click="addCheckpoint" color="primary" rounded="pill" size="small">{{
                $t('BpnmPropertyPanel.add') }}</v-btn>
                    <v-card v-else @click="editCheckpoint = !editCheckpoint" elevation="9" variant="outlined"
                        style="padding: 5px; display: flex; justify-content: center; align-items: center; border-radius: 10px !important;">
                        <div style="display: flex; justify-content: center; align-items: center;">
                            <Icon icon="streamline:add-1-solid" width="20" height="20" style="color: #5EB2E8" />
                        </div>
                    </v-card>
                </v-row>
            </div>
            <div>
                <v-row class="ma-0 pa-0">
                    <div>Extended Property</div>
                </v-row>
                <v-row>
                    <v-table>
                        <thead>
                            <tr>
                                <th class="text-h6">Key</th>
                                <th class="text-h6">Value</th>
                                <th class="text-h6">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="param in uengineProperties.extendedProperties" :key="param.key"
                                class="month-item">
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
                        <v-card-action>
                            <v-btn @click="addParameter">add</v-btn>
                            <v-btn>cancel</v-btn>
                        </v-card-action>
                    </v-card>
                </v-row>
            </div>
        </v-card-text>
        <v-card-actions>
            <v-btn color="primary" @click="onClickOutside" v-if="!isViewMode">Save</v-btn>
            <v-btn color="error" @click="$emit('close')">Close</v-btn>
        </v-card-actions>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage()
export default {
    name: 'bpmn-property-panel',
    props: {
        element: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {
        console.log(this.element)
        this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        Object.keys(this.requiredKeyLists).forEach(key => {
            this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key])
        })
    },
    data() {
        return {
            requiredKeyLists: {
                "description": "",
                "role": { "name": "" },
                "parameters": [],
                "checkpoints": [],
                "pythonCode": "",
                "condition": { "key": "", "value": "" },
                "extendedProperties": []
            },
            definitions: [],
            elementCopy: this.element,
            uengineProperties: {},
            name: "",
            checkpoints: [],
            editCheckpoint: false,
            checkpointMessage: {
                "$type": "uengine:Checkpoint",
                "checkpoint": ""
            },
            code: "",
            description: "",
            selectedDefinition: "",
            bpmnModeler: null,
            stroage: null,
            editParam: false,
            paramKey: "",
            paramValue: ""
        };
    },
    async mounted() {
        let me = this
        if (!me.$app.try) {
            me.$app = me.$app._component.methods;
        }
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        this.name = this.element.name
        if (this.element.$type == 'bpmn:CallActivity') {
            const value = await storage.getObject('proc_def');
            if (value) {
                this.definitions = value
            }
        }
    },
    computed: {
        inputData() {
            let params = this.uengineProperties.parameters
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.direction == 'IN')
                        result.push(element)
                });
            return result
        },
        outputData() {
            let params = this.uengineProperties.parameters
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.direction == 'OUT')
                        result.push(element)
                });
            return result
        }
    },
    watch: {
    },
    methods: {
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        deleteExtendedProperty(item) {
            const index = this.uengineProperties.extendedProperties.findIndex(element => element.key === item.key);
            if (index > -1) {
                this.uengineProperties.extendedProperties.splice(index, 1);
            }
        },
        deleteCheckPoint(item) {
            const index = this.uengineProperties.checkpoints.findIndex(element => element.checkpoint === item.checkpoint);
            if (index > -1) {
                this.uengineProperties.checkpoints.splice(index, 1);
            }
        },
        addParameter() {
            this.uengineProperties.extendedProperties.push({ key: this.paramKey, value: this.paramValue })
            // const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            // // this.checkpoints.push(this.checkpointMessage)
            // const parameter = bpmnFactory.create('uengine:ExtendedProperty', { key: this.paramKey, value: this.paramValue });
            // if (!this.elementCopy.extensionElements.values[0].ExtendedProperties) this.elementCopy.extensionElements.values[0].ExtendedProperties = []
            // this.elementCopy.extensionElements.values[0].ExtendedProperties.push(parameter)
            // this.paramKey = ""
            // this.paramValue = ""
        },
        async getData(path, options) {
            // let value;
            // if (path) {
            //     value = await this.storage.getObject(`db://${path}`, options);
            // } else {
            //     value = await this.storage.getObject(`db://${this.path}`, options);
            // }
            // return value;
        },
        addCheckpoint() {
            this.uengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint })
        },
        onClickOutside() {
            const modeling = this.bpmnModeler.get('modeling');
            const elementRegistry = this.bpmnModeler.get('elementRegistry');
            const task = elementRegistry.get(this.element.id);
            this.elementCopy.extensionElements.values[0].json = JSON.stringify(this.uengineProperties)
            this.elementCopy.name = this.name
            modeling.updateProperties(task, this.elementCopy);
            this.$emit('close');
        },

    }
};
</script>