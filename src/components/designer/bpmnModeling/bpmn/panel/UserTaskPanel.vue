<template>
    <div>
        <div v-if="inputData.length > 0" style="margin-bottom:20px;">
            <div style="margin-bottom:-8px;">{{ $t('BpnmPropertyPanel.inputData') }}</div>
            <v-row class="ma-0 pa-0">
                <div v-for="(input, idx) in inputData" :key="idx" class="mr-2 mt-2">
                    <v-chip v-if="input.mandatory" color="primary" variant="outlined" class="text-body-2"
                        @click="deleteInputData(input)">
                        {{ input.argument.text }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                    <v-chip v-else class="text-body-2" variant="outlined" @click="deleteInputData(inputData)">
                        {{ input.argument.text }}
                        <CircleXIcon class="ml-2" start size="20" />
                    </v-chip>
                </div>
            </v-row>
        </div>
        <div v-if="outputData.length > 0" style="margin-bottom:20px;">
            <div style="margin-bottom:-8px;">{{ $t('BpnmPropertyPanel.outputData') }}</div>
            <v-row class="ma-0 pa-0">
                <div v-for="(output, idx) in outputData" :key="idx" class="mr-2 mt-2">
                    <v-chip v-if="output.mandatory" color="primary" class="text-body-2" variant="outlined"
                        @click="deleteOutputData(output)">
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
            <v-row class="ma-0 pa-0">
                <div>Parameter Context</div>
                <v-spacer></v-spacer>
                <bpmn-parameter-contexts
                :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts>
            </v-row>
        </div>
        <v-spacer></v-spacer>
        <v-checkbox v-model="isFormActivity" label="폼 기반 업무"></v-checkbox>
        <div v-if="isFormActivity">
            <div>
                <v-row cclass="ma-0 pa-0">
                    <!-- <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                        <v-label class=" font-weight-medium" for="hcpm">{{ $t('ProcessVariable.defaultValue') }}</v-label>
                    </v-col> -->
                    <v-col cols="12" sm="9">
                        <v-autocomplete 
                            v-model="selectedForm"
                            :items="definition.processVariables
                                        .filter(item => item.type === 'Form' && item.defaultValue && item.defaultValue.name && item.defaultValue.alias)
                                        .map(item => item.defaultValue.name + '_' + item.defaultValue.alias)" 
                            color="primary" 
                            variant="outlined"
                            hide-details>
                        </v-autocomplete>
                    </v-col>
                </v-row>
            </div>
            <div>
                <v-row  class="ma-0 pa-0">
                    <v-btn text color="primary" class="my-3" @click="openFieldMapper = !openFieldMapper">
                        Field Mapping
                    </v-btn>
                </v-row>
            </div>
            <v-dialog  v-model="openFieldMapper"  max-width="80%" max-height="80%" @afterLeave="$refs.formMapper && $refs.formMapper.saveFormMapperJson()">
                <form-mapper 
                    ref="formMapper"
                    :definition="definition" 
                    :name="name"    
                    :formMapperJson="formMapperJson"
                    @saveFormMapperJson="saveFormMapperJson"
                />
            </v-dialog>
        </div>
        <!-- <div>
            <v-row class="ma-0 pa-0">
                <div>{{ $t('BpnmPropertyPanel.checkPoints') }}</div>
                <v-spacer></v-spacer>
                <v-icon v-if="editCheckpoint" @click="editCheckpoint = false" style="margin-top:2px;">mdi-close</v-icon>
            </v-row>
            <div v-for="(checkpoint, idx) in copyUengineProperties.checkpoints" :key="idx">
                <div>
                    <v-checkbox-btn color="success" :disabled="isViewMode" :label="checkpoint.checkpoint" hide-details
                        v-model="checkbox"></v-checkbox-btn>
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
        </div> -->
        <!-- <div>
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
                        <tr v-for="param in copyUengineProperties.extendedProperties" :key="param.key"
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
                    <v-card-actions>
                        <v-btn @click="addParameter">add</v-btn>
                        <v-btn @click="editParam = !editParam">cancel</v-btn>
                    </v-card-actions>
                </v-card>
            </v-row>
        </div> -->
    </div>
</template>
<script>
import BpmnParameterContexts from '@/components/designer/bpmnModeling/bpmn/variable/BpmnParameterContexts.vue';
import FormMapper from '@/components/designer/mapper/FormMapper.vue';
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage()
export default {
    name: 'user-task-panel',
    components: {
        BpmnParameterContexts,
        FormMapper
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        role: String,
        variableForHtmlFormContext: Object,
        definition: Object,
        name: String
    },
    created() {
        
    },
    data() {
        return {
            // requiredKeyLists: {
            //     "parameters": [],
            //     "checkpoints": []
            // },
            requiredKeyLists: {
                "role": { "name": "" },
                "parameters": [],
            },
            copyUengineProperties: this.uengineProperties,
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
            paramValue: "",
            openFieldMapper: false,
            isFormActivity: false,
            selectedForm: "",
            formMapperJson: ""
        };
    },
    async mounted() {
        let me = this

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        if (me.role?.length > 0) {
            this.copyUengineProperties.role = { "name": me.role }
        }
        if (!this.copyUengineProperties.parameters)
            this.copyUengineProperties.parameters = []

        if(this.copyUengineProperties.variableForHtmlFormContext){
            this.isFormActivity = true
            this.selectedForm = `${this.copyUengineProperties.variableForHtmlFormContext.name}_${this.copyUengineProperties.variableForHtmlFormContext.alias}`
        }

        let mapperData = 
        {}

        this.copyUengineProperties.mappingContext = mapperData
        this.$emit('update:uEngineProperties', this.copyUengineProperties)


    },
    computed: {
        inputData() {
            let params = this.copyUengineProperties.parameters
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.direction == 'IN' || element.direction == 'IN-OUT')
                        result.push(element)
                });
            return result
        },
        outputData() {
            let params = this.copyUengineProperties.parameters
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.direction == 'OUT' || element.direction == 'IN-OUT')
                        result.push(element)
                });
            return result
        }
    },
    watch: {
        selectedForm(newVal){
            if(newVal){
                const [formName, formAlias] = newVal.split('_');
                const formItem = this.definition.processVariables.find(item => item.type === 'Form' && item.defaultValue.name === formName && item.defaultValue.alias === formAlias);

                this.copyUengineProperties.variableForHtmlFormContext = formItem.defaultValue
                this.$emit('update:uEngineProperties', this.copyUengineProperties)
            }
        },
        isFormActivity(newVal){
            if(newVal){
                this.copyUengineProperties._type = "org.uengine.kernel.FormActivity"
            }
        }
    },
    methods: {
        deleteInputData(inputData) {
            const index = this.copyUengineProperties.parameters.findIndex(element => element.key === inputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties)
            }
        },
        deleteOutputData(outputData) {
            const index = this.copyUengineProperties.parameters.findIndex(element => element.key === outputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties)
            }
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        deleteExtendedProperty(item) {
            const index = this.copyUengineProperties.extendedProperties.findIndex(element => element.key === item.key);
            if (index > -1) {
                this.copyUengineProperties.extendedProperties.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties)
            }
        },
        deleteCheckPoint(item) {
            const index = this.copyUengineProperties.checkpoints.findIndex(element => element.checkpoint === item.checkpoint);
            if (index > -1) {
                this.copyUengineProperties.checkpoints.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties)
            }
        },
        addParameter() {
            this.copyUengineProperties.extendedProperties.push({ key: this.paramKey, value: this.paramValue })
            this.$emit('update:uEngineProperties', this.copyUengineProperties)
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
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint })
            this.$emit('update:uEngineProperties', this.copyUengineProperties)
        },  
        saveFormMapperJson(jsonString) {
            this.formMapperJson = jsonString;
            this.openFieldMapper = false;
        }
    }
};
</script>