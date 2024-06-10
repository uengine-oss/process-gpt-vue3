<template>
    <div>
        <v-radio-group v-model="selectedActivity" inline>
            <v-radio
                label="Default"
                value="DefaultActivity"
            ></v-radio>
            <v-radio
                label="Form"
                value="FormActivity"
            ></v-radio>
            <v-radio
                label="외부 어플리케이션"
                value="URLActivity"
            ></v-radio>
        </v-radio-group>
        <div v-if="!isLoading && selectedActivity == 'DefaultActivity'">
            <div v-if="inputData.length > 0" style="margin-bottom: 20px">
                <div style="margin-bottom: -8px">{{ $t('BpnmPropertyPanel.inputData') }}</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(input, idx) in inputData" :key="idx" class="mr-2 mt-2">
                        <v-chip v-if="input.mandatory" color="primary" variant="outlined" class="text-body-2" @click="deleteInputData(input)">
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
            
            <div v-if="outputData.length > 0" style="margin-bottom: 20px">
                <div style="margin-bottom: -8px">{{ $t('BpnmPropertyPanel.outputData') }}</div>
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
                <v-row class="ma-0 pa-0">
                    <div>Parameter Context</div>
                    <v-spacer></v-spacer>
                    <bpmn-parameter-contexts :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts>
                </v-row>
            </div>
        </div>
        <div v-else-if="!isLoading && selectedActivity == 'FormActivity'">
            <div>
                <v-row cclass="ma-0 pa-0">
                    <!-- <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                        <v-label class=" font-weight-medium" for="hcpm">{{ $t('ProcessVariable.defaultValue') }}</v-label>
                    </v-col> -->
                    <v-col cols="12" sm="9">
                        <!-- <v-autocomplete 
                            v-model="selectedForm"
                            :items="definition.processVariables
                                        .filter(item => item.type === 'Form' && item.defaultValue && item.defaultValue.name && item.defaultValue.alias)
                                        .map(item => item.defaultValue.name + '_' + item.defaultValue.alias)" 
                            color="primary" 
                            variant="outlined"
                            hide-details>
                        </v-autocomplete> -->
                        <v-autocomplete
                            v-model="selectedForm"
                            :items="definition.processVariables.filter((item) => item.type === 'Form').map((item) => item.name)"
                            color="primary"
                            variant="outlined"
                            hide-details
                        >
                        </v-autocomplete>
                    </v-col>
                </v-row>
            </div>
            <div>
                <v-row class="ma-0 pa-0">
                    <v-btn text color="primary" class="my-3" @click="openFormMapper()"> Field Mapping </v-btn>
                </v-row>
            </div>
        </div>
        <div v-else-if="!isLoading && selectedActivity == 'URLActivity'">
            <EventSynchronizationForm v-model="copyUengineProperties" :roles="roles" :taskName="name" :definition="copyDefinition"></EventSynchronizationForm>
        </div>
    </div>

    <v-dialog
        v-model="isOpenFieldMapper"
        max-width="80%"
        max-height="80%"
        @afterLeave="$refs.mapper && $refs.mapper.saveFormMapperJson()"
    >
        <mapper
            ref="mapper"
            :name="name"
            :definition="copyDefinition"
            :formMapperJson="formMapperJson"
            :expandableTrees="nodes"
            :replaceFromExpandableNode="replaceFromExpandableNode"
            :replaceToExpandableNode="replaceToExpandableNode"
            @saveFormMapperJson="saveFormMapperJson"
            @closeFormMapper="closeFormMapper"
        />
    </v-dialog>
            
    <v-dialog v-model="isOpenFormCreateDialog" max-width="500">
        <v-card>
            <v-card-text>
                {{"폼 생성을 하시겠습니까?"}}
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="error" @click="isOpenFormCreateDialog = false">아니오</v-btn>
                <v-btn color="primary" @click="isOpenFormCreateDialog = false; createForm()">예</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog> 
</template>
<script>
import BpmnParameterContexts from '@/components/designer/bpmnModeling/bpmn/variable/BpmnParameterContexts.vue';
import Mapper from '@/components/designer/mapper/Mapper.vue';
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import EventSynchronizationForm from '@/components/designer/EventSynchronizationForm.vue';

export default {
    name: 'user-task-panel',
    components: {
        BpmnParameterContexts,
        Mapper,
        EventSynchronizationForm
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        role: String,
        roles: Array,
        variableForHtmlFormContext: Object,
        definition: Object,
        name: String
    },
    created() {},
    data() {
        return {
            isLoading: false,
            selectedActivity: '',
            // requiredKeyLists: {
            //     "parameters": [],
            //     "checkpoints": []
            // },
            requiredKeyLists: {
                role: { name: '' },
                parameters: []
            },
            copyUengineProperties: JSON.parse(JSON.stringify(this.uengineProperties)),
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
            isOpenFieldMapper: false,
            isFormActivity: false,
            selectedForm: '',
            formMapperJson: '',
            backend: null,
            copyDefinition: null,
            isOpenFormCreateDialog: false,
            nodes: {},
            expandableReplaceToNode: null,
            expandableReplaceFromNode: null,
        };
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    mounted() {
        let me = this;
        me.bpmnModeler = useBpmnStore().getModeler;
        me.init();
    },
    computed: {
        inputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'IN' || element.direction == 'IN-OUT') result.push(element);
                });
            return result;
        },
        outputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'OUT' || element.direction == 'IN-OUT') result.push(element);
                });
            return result;
        }
    },
    watch: {
        "selectedActivity":function(newVal,oldVal){
            if(!oldVal) return;

            this.updateProperties();
        },
        "selectedForm":function(newVal, oldVal) {
            var me = this
            if(newVal){
                // const [formName, formAlias] = newVal.split('_');
                // const formItem = this.definition.processVariables.find(item => item.type === 'Form' && item.defaultValue.name === formName && item.defaultValue.alias === formAlias);
                let formVariable = me.copyDefinition.processVariables.find((item) => item.name === newVal);
                let variableForHtmlFormContext = formVariable ? { name: formVariable.name } : {}
                me.copyUengineProperties.variableForHtmlFormContext = variableForHtmlFormContext;

                if(oldVal) me.copyUengineProperties.mappingContext = {}; // CHECK!!!
                me.formMapperJson = JSON.stringify(me.copyUengineProperties.mappingContext, null, 2)
            } else {
                me.copyUengineProperties.variableForHtmlFormContext = {}
                me.copyUengineProperties.mappingContext = {};
            }
        },
    },
    methods: {
        init(){
            var me = this
            // ??
            if (me.roles.length > 0) {
                me.copyUengineProperties.role = { name: me.role };
            }

            me.selectedActivity = me.copyUengineProperties._type ? me.copyUengineProperties._type.split('.').pop() : 'DefaultActivity';
            if(me.selectedActivity == 'DefaultActivity') {
                delete me.copyUengineProperties._type;
                if (!me.copyUengineProperties.parameters) me.copyUengineProperties.parameters = [];
            } else if(me.selectedActivity == 'FormActivity'){
                me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
                if (!me.copyUengineProperties.variableForHtmlFormContext) me.copyUengineProperties.variableForHtmlFormContext = {} 
                if (!me.copyUengineProperties.mappingContext) me.copyUengineProperties.mappingContext = {}

                me.selectedForm = me.copyUengineProperties.variableForHtmlFormContext.name;
                me.formMapperJson = JSON.stringify(me.copyUengineProperties.mappingContext, null, 2);
                if(!me.selectedForm) me.isOpenFormCreateDialog = true
            } else if(me.selectedActivity == 'URLActivity'){     
                me.copyUengineProperties._type = 'org.uengine.kernel.URLActivity';
                if (!me.copyUengineProperties.url) me.copyUengineProperties.url = '';
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                if (!me.copyUengineProperties.eventSynchronization.attributes) me.copyUengineProperties.eventSynchronization.attributes = [];
                if (!me.copyUengineProperties.eventSynchronization.mappingContext) me.copyUengineProperties.eventSynchronization.mappingContext = {};
            }

            me.copyDefinition = me.definition;           
        },
        updateProperties(){
            var me = this   
            me.isLoading = true
            if(me.selectedActivity == 'FormActivity'){
                me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
                if (!me.copyUengineProperties.variableForHtmlFormContext) me.copyUengineProperties.variableForHtmlFormContext = {} 
                if (!me.copyUengineProperties.mappingContext) me.copyUengineProperties.mappingContext = {}

                me.selectedForm = me.copyUengineProperties.variableForHtmlFormContext.name;
                me.formMapperJson = JSON.stringify(me.copyUengineProperties.mappingContext, null, 2)

                if(!me.selectedForm) me.isOpenFormCreateDialog = true
            } else if(me.selectedActivity == 'URLActivity' ){
                me.copyUengineProperties._type = 'org.uengine.kernel.URLActivity';
                if (!me.copyUengineProperties.url) me.copyUengineProperties.url = '';
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                if (!me.copyUengineProperties.eventSynchronization.attributes) me.copyUengineProperties.eventSynchronization.attributes = [];
                if (!me.copyUengineProperties.eventSynchronization.mappingContext) me.copyUengineProperties.eventSynchronization.mappingContext = {};
            } else {
                if (!me.copyUengineProperties.parameters) me.copyUengineProperties.parameters = [];
            }
            me.isLoading = false
        },
        beforeSave(){
            var me = this
            // 필수 요소만 포함, 나머지 제거.
            if(me.selectedActivity == 'FormActivity'){
                const { variableForHtmlFormContext, mappingContext, _type } = me.copyUengineProperties;
                me.copyUengineProperties = { variableForHtmlFormContext, mappingContext, _type };
            } else if(me.selectedActivity == 'URLActivity' ){
                const { url, eventSynchronization, _type } = me.copyUengineProperties;
                me.copyUengineProperties = { url, eventSynchronization, _type };
            } else {
                const { parameters } = me.copyUengineProperties;
                me.copyUengineProperties = { parameters };
            }
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        },
        deleteInputData(inputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === inputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                // this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        deleteOutputData(outputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === outputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                // this.$emit('update:uEngineProperties', this.copyUengineProperties);
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
                // this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        deleteCheckPoint(item) {
            const index = this.copyUengineProperties.checkpoints.findIndex((element) => element.checkpoint === item.checkpoint);
            if (index > -1) {
                this.copyUengineProperties.checkpoints.splice(index, 1);
                // this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        addParameter() {
            this.copyUengineProperties.extendedProperties.push({ key: this.paramKey, value: this.paramValue });
            // this.$emit('update:uEngineProperties', this.copyUengineProperties);
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
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            // this.$emit('update:uEngineProperties', this.copyUengineProperties);
        },
        saveFormMapperJson(jsonString) {
            this.formMapperJson = jsonString;
            // this.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
            this.copyUengineProperties.mappingContext = JSON.parse(jsonString);
            // this.$emit('update:uEngineProperties', this.copyUengineProperties);
        },
        closeFormMapper() {
            this.isOpenFieldMapper = false;
        },
        async openFormMapper() {
            var me = this;
            if(!me.selectedForm) return;

            // expandableTrees 예시
            // if (!this.nodes['test']) {
            //     this.nodes['test'] = {
            //         text: 'test',
            //         children: [],
            //         parent: null
            //     };
            // }

            // let instanceNodes = [
            //     'instanceId',
            //     'name',
            //     'locale',
            //     'status',
            //     'info',
            //     'dueDate',
            //     'mainProcessInstanceId',
            //     'mainActivityTracingTag',
            //     'rootProcessInstanceId',
            //     'ext1',
            //     'ext2',
            //     'ext3',
            //     'ext4',
            //     'ext5'
            // ];

            // if (this.nodes['test']) {
            //     this.nodes['test'].children = [];
            //     instanceNodes.forEach((node) => {
            //         this.nodes['test'].children.push(node);
            //     });
            // }

            // me.replaceFromExpandableNode = function(nodeKey) {
            //     if(nodeKey.indexOf("test.") != -1) {
            //         return nodeKey.replace("test.", "[test].");
            //     }
            //     return null;
            // };

            // me.replaceToExpandableNode = function(nodeKey) {
            //     if(nodeKey.indexOf("[test].") != -1) {
            //         return nodeKey.replace("[test].", "test.");
            //     }
            //     return null;
            // };

            me.isOpenFieldMapper = true;            
        },
        createForm() {
            let urlData = {}
            urlData["formName"] = `${this.name}폼`
            urlData["inputNames"] = this.copyUengineProperties.parameters.map(p => p.argument.text)
            urlData["initPrompt"] = `'${urlData["formName"]}'폼을 생성해줘. 입력해야하는 값들은 다음과 같아: ${urlData["inputNames"].join(", ")}`
            urlData["processId"] = this.processDefinitionId
            urlData["channelId"] = crypto.randomUUID()
            console.log("새로운 폼을 만들기 위한 데이터: " + JSON.stringify(urlData))
            console.log("채널 ID: " + urlData["channelId"])

            const formTabUrl = `/ui-definitions/chat?process_def_url_data=${btoa(encodeURIComponent(JSON.stringify(urlData)))}`
            window.open(formTabUrl, '_blank')

            const channel = new BroadcastChannel(urlData["channelId"])
            channel.onmessage = (event) => {
                const formValueInfo = {
                    name: event.data.name,
                    id: event.data.id
                }


                this.$emit('addUengineVariable', {
                    "name": formValueInfo.name,
                    "type": "Form",
                    "defaultValue": formValueInfo.id,
                    "description": "",
                    "datasource": {
                        "type": "",
                        "sql": ""
                    },
                    "table": "",
                    "backend": null
                })

                this.selectedForm = formValueInfo.name
            }
        }
    }
};
</script>
