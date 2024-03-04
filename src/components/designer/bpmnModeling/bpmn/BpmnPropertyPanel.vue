<template>
    <div style="height: 95%; margin-top: 10px; overflow: auto;">
        <v-card-text>
            <div>{{ $t('BpnmPropertyPanel.name') }}</div>
            <v-text-field v-model="name"></v-text-field>
            <div>
                <div>{{ $t('BpnmPropertyPanel.description') }}</div>
                <v-textarea v-if="!elementCopy.$type.includes('Event')"
                    v-model="elementCopy.extensionElements.values[0].description"></v-textarea>
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
                <v-autocomplete v-model="elementCopy.extensionElements.values[0].definition" :items="definitions"
                    item-title="name" color="primary" label="Definition" variant="outlined" hide-details></v-autocomplete>
            </div>
            <div v-if="element.$type.includes('Task') && outputData.length > 0" style="margin-bottom:20px;">
                <div style="margin-bottom:-8px;">{{ $t('BpnmPropertyPanel.outputData') }}</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(output, idx) in outputData" :key="idx" class="mr-2 mt-2">
                        <v-chip v-if="output.mandatory" color="primary" class="text-body-2" variant="outlined">
                            {{ output.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2" variant="outlined">
                            {{ output.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div v-if="element.$type == 'bpmn:ScriptTask'">
                Script (Python)
                <v-textarea v-model="elementCopy.extensionElements.values[0].pythonCode"></v-textarea>
            </div>
            <div v-if="element.$type.includes('Flow')">
                Condition
                <br />
                <v-text-field
                    v-model="elementCopy.extensionElements.values[0].$children[0].$children[0].$body"></v-text-field>
            </div>
            <div v-if="element.$type.includes('Task')">
                <v-row class="ma-0 pa-0">
                    <div>{{ $t('BpnmPropertyPanel.checkPoints') }}</div>
                    <v-spacer></v-spacer>
                    <v-icon v-if="editCheckpoint" @click="editCheckpoint = false" style="margin-top:2px;">mdi-close</v-icon>
                </v-row>
                <div v-for="(checkpoint, idx) in elementCopy.extensionElements.values[0].checkpoints" :key="idx">
                    <v-checkbox-btn color="success" :label="checkpoint.checkpoint" hide-details
                        v-model="checkbox"></v-checkbox-btn>
                </div>
                <v-text-field v-if="editCheckpoint" v-model="checkpointMessage.checkpoint"></v-text-field>
                <v-row class="ma-0 pa-0">
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
                <div>Key/Value Parameter</div>
                <v-spacer></v-spacer>
                <v-table class="month-table">
                    <thead>
                        <tr>
                            <th class="text-h6">Key</th>
                            <th class="text-h6">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="param in elementCopy.extensionElements.values[0].parameters" :key="param.key"
                            class="month-item">
                            <td>
                                {{ param.key }}
                            </td>
                            <td>
                                {{ param.value }}
                            </td>
                        </tr>
                    </tbody>
                </v-table>
                <v-btn flat color="primary" @click="editParam = !editParam">add Key/Value</v-btn>

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
            </div>
        </v-card-text>
        <v-card-actions>
            <v-btn color="primary" @click="onClickOutside">Save</v-btn>
            <v-btn color="error" @click="$emit('close')">Close</v-btn>
        </v-card-actions>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

const storage = StorageBaseFactory.getStorage()
export default {
    name: 'bpmn-property-panel',
    props: {
        element: Object,
        processDefinitionId: String
    },
    created() {
        console.log(this.element)
    },
    data() {
        return {
            definitions: [],
            elementCopy: this.element,
            uengineProperties: this.element.extensionElements?.values?.[0],
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
        console.log(this.element)
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        this.name = this.element.name

        if (this.element.$type == 'bpmn:CallActivity') {
            const value = await storage.getObject('proc_def');
            if (value) {
                // let result = []
                // value.forEach(function (def) {
                //     if (def.id != this.processDefinitionId)
                //         result.push(def.id)
                // })
                this.definitions = value
            }
        }
    },
    computed: {
        inputData() {
            let params = this.elementCopy?.extensionElements?.values?.[0].instanceData
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.category == 'input')
                        result.push(element)
                });
            return result
        },
        outputData() {
            let params = this.elementCopy?.extensionElements?.values?.[0].instanceData
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.category == 'output')
                        result.push(element)
                });
            return result
        }
    },
    watch: {
        elementCopy: {
            deep: true,
            handler(val) {
                // console.log(val);
            }
        }
    },
    methods: {
        // include() {
        //     return [document.querySelector('.included')]
        // },
        addParameter() {
            const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            // this.checkpoints.push(this.checkpointMessage)
            const parameter = bpmnFactory.create('uengine:Parameter', { key: this.paramKey, value: this.paramValue });
            this.elementCopy.extensionElements.values[0].parameters.push(parameter)
            this.paramKey = ""
            this.paramValue = ""
        },
        async getData(path, options) {
            let value;
            if (path) {
                value = await this.storage.getObject(`db://${path}`, options);
            } else {
                value = await this.storage.getObject(`db://${this.path}`, options);
            }
            return value;
        },
        addCheckpoint() {
            const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            // this.checkpoints.push(this.checkpointMessage)
            const checkpoint = bpmnFactory.create('uengine:Checkpoint', { checkpoint: this.checkpointMessage.checkpoint });
            this.elementCopy.extensionElements.values[0].checkpoints.push(checkpoint)
        },
        onClickOutside() {
            const modeling = this.bpmnModeler.get('modeling');
            const elementRegistry = this.bpmnModeler.get('elementRegistry');
            const task = elementRegistry.get(this.element.id);
            this.elementCopy.name = this.name
            modeling.updateProperties(task, this.elementCopy);

            this.$emit('close');
        },

    }
};
</script>