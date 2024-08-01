<template>
    <div>
        <v-radio-group v-model="selectedActivity" inline>
            <v-radio label="Default" value="DefaultActivity"></v-radio>
            <v-radio label="Form" value="FormActivity"></v-radio>
            <v-radio v-if="useEvent" label="외부 어플리케이션" value="URLActivity"></v-radio>
        </v-radio-group>
        <div v-if="!isLoading && selectedActivity == 'DefaultActivity'">
            <EventSynchronizationForm
                v-if="useEvent"
                v-model="copyUengineProperties"
                :roles="roles"
                :taskName="name"
                :definition="copyDefinition"
            ></EventSynchronizationForm>
            <div v-else>
                <DefaultArguments v-model="copyUengineProperties"></DefaultArguments>
                <Instruction v-model="activity.instruction"></Instruction>
                <Checkpoints v-model="activity.checkpoints"></Checkpoints>
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
            <EventSynchronizationForm
                v-if="useEvent"
                v-model="copyUengineProperties"
                :roles="roles"
                :taskName="name"
                :definition="copyDefinition"
            ></EventSynchronizationForm>
            <div v-else>
                <Instruction v-model="activity.instruction"></Instruction>
                <Checkpoints v-model="activity.checkpoints"></Checkpoints>
            </div>
        </div>
        <div v-else-if="!isLoading && selectedActivity == 'URLActivity' && useEvent">
            <EventSynchronizationForm
                v-model="copyUengineProperties"
                :roles="roles"
                :taskName="name"
                :definition="copyDefinition"
            ></EventSynchronizationForm>
        </div>
    </div>

    <v-dialog
        v-model="isOpenFieldMapper"
        class="mapper-dialog"
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
                {{ '폼 생성을 하시겠습니까?' }}
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="error" @click="isOpenFormCreateDialog = false">아니오</v-btn>
                <v-btn
                    color="primary"
                    @click="
                        isOpenFormCreateDialog = false;
                        createForm();
                    "
                    >예</v-btn
                >
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
import DefaultArguments from '@/components/designer/DefaultArguments.vue';
import Checkpoints from '@/components/designer/CheckpointsField.vue';
import Instruction from '@/components/designer/InstructionField.vue';

export default {
    name: 'user-task-panel',
    components: {
        BpmnParameterContexts,
        Mapper,
        EventSynchronizationForm,
        DefaultArguments,
        Checkpoints,
        Instruction
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        processDefinition: Object,
        element: Object,
        isViewMode: Boolean,
        role: String,
        roles: Array,
        variableForHtmlFormContext: Object,
        definition: Object,
        name: String
    },
    emits: ['update:uengineProperties', 'update:activity', 'addUengineVariable'],
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
            replaceFromExpandableNode: null,
            replaceToExpandableNode: null,
            activity: {
                instruction: '',
                checkpoints: ['']
            }
        };
    },
    created() {
        this.backend = BackendFactory.createBackend();
        if(this.processDefinition && this.processDefinition.activities && this.processDefinition.activities.length > 0){
            const activity = this.processDefinition.activities.find(activity => activity.id === this.element.id);
            if (activity) {
                this.activity = activity;
            } else {
                console.log('Activity not found');
            }
        }
    },
    mounted() {
        let me = this;
        me.bpmnModeler = useBpmnStore().getModeler;
        me.init();
    },
    computed: {
        useEvent() {
            if (window.$mode == "ProcessGPT") {
                return false;
            } else {
                return true;
            }
        }
        // inputData() {
        //     let params = this.copyUengineProperties.parameters;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'IN' || element.direction == 'IN-OUT') result.push(element);
        //         });
        //     return result;
        // },
        // outputData() {
        //     let params = this.copyUengineProperties.parameters;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'OUT' || element.direction == 'IN-OUT') result.push(element);
        //         });
        //     return result;
        // }
    },
    watch: {
        selectedActivity: function (newVal, oldVal) {
            console.log(this);
            if (!oldVal) return;
            this.updateProperties();
        },
        selectedForm: function (newVal, oldVal) {
            var me = this;
            if (newVal) {
                // const [formName, formAlias] = newVal.split('_');
                // const formItem = this.definition.processVariables.find(item => item.type === 'Form' && item.defaultValue.name === formName && item.defaultValue.alias === formAlias);
                let formVariable = me.copyDefinition.processVariables.find((item) => item.name === newVal);
                let variableForHtmlFormContext = formVariable ? { name: formVariable.name } : {};
                me.copyUengineProperties.variableForHtmlFormContext = variableForHtmlFormContext;

                if (me.useEvent) {
                    if (oldVal) me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] }; // CHECK!!!
                    me.formMapperJson = JSON.stringify(me.copyUengineProperties.eventSynchronization.mappingContext, null, 2);
                }
            } else {
                me.copyUengineProperties.variableForHtmlFormContext = {};
                if (me.useEvent) {
                    me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
                }
            }
        },
        parameters: function (newVal, oldVal) {
            this.nodes["arguments"] = {
                text: "arguments",
                children: [],
                parent: null
            };
            console.log(newVal)
            
            me.replaceFromExpandableNode = function (nodeKey) {
                if (nodeKey.indexOf(`arguments.`) != -1) {
                    return nodeKey.replace(`arguments.`, `[arguments].`);
                }

                return null;
            };

            me.replaceToExpandableNode = function (nodeKey) {
                if (nodeKey.indexOf(`[arguments].`) != -1) {
                    return nodeKey.replace(`[arguments].`, `arguments.`);
                }

                return null;
            };
        },
        activity: {
            deep: true,
            handler(newVal, oldVal) {
                if (!this.useEvent && (newVal.checkpoints || newVal.instruction) ) {
                    this.EventBus.emit('process-definition-updated', this.processDefinition);
                }
            }
        }
    },
    methods: {
        init() {
            var me = this;
            // ??
            if (me.roles.length > 0) {
                me.copyUengineProperties.role = { name: me.role };
            }
            me.selectedActivity = me.copyUengineProperties._type ? me.copyUengineProperties._type.split('.').pop() : 'DefaultActivity';
            
            //
            if (me.useEvent) {
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                if (!me.copyUengineProperties.eventSynchronization.attributes)
                    me.copyUengineProperties.eventSynchronization.attributes = [];
                if (!me.copyUengineProperties.eventSynchronization.mappingContext)
                    me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
            }

            if (me.selectedActivity == 'DefaultActivity') {
                delete me.copyUengineProperties._type;
            } else if (me.selectedActivity == 'FormActivity') {
                me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
                if (!me.copyUengineProperties.variableForHtmlFormContext) {
                    me.copyUengineProperties.variableForHtmlFormContext = {};
                }
                me.selectedForm = me.copyUengineProperties.variableForHtmlFormContext.name;
                if (me.useEvent) {
                    me.formMapperJson = JSON.stringify(me.copyUengineProperties.eventSynchronization.mappingContext, null, 2);
                }
                if (!me.selectedForm) {
                    me.isOpenFormCreateDialog = true;
                }
            } else if (me.selectedActivity == 'URLActivity') {
                me.copyUengineProperties._type = 'org.uengine.kernel.URLActivity';
                if (!me.copyUengineProperties.url) me.copyUengineProperties.url = '';
                me.formMapperJson = JSON.stringify(me.copyUengineProperties.eventSynchronization.mappingContext, null, 2);
            }

            me.copyDefinition = me.definition;
        },
        updateParameters(mappingContext) {
            console.log(mappingContext)
            this.copyUengineProperties.eventSynchronization.mappingContext = mappingContext;
        },
        updateProperties() {
            var me = this;
            me.isLoading = true;
            if (me.selectedActivity == 'FormActivity') {
                me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
                if (!me.copyUengineProperties.variableForHtmlFormContext) me.copyUengineProperties.variableForHtmlFormContext = {};
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                if (!me.copyUengineProperties.eventSynchronization.attributes)
                    me.copyUengineProperties.eventSynchronization.attributes = [];
                if (!me.copyUengineProperties.eventSynchronization.mappingContext)
                    me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };

                me.selectedForm = me.copyUengineProperties.variableForHtmlFormContext.name;
                me.formMapperJson = JSON.stringify(me.copyUengineProperties.eventSynchronization.mappingContext, null, 2);

                if (!me.selectedForm) me.isOpenFormCreateDialog = true;
            } else if (me.selectedActivity == 'URLActivity') {
                me.copyUengineProperties._type = 'org.uengine.kernel.URLActivity';
                if (!me.copyUengineProperties.url) me.copyUengineProperties.url = '';
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                if (!me.copyUengineProperties.eventSynchronization.attributes)
                    me.copyUengineProperties.eventSynchronization.attributes = [];
                if (!me.copyUengineProperties.eventSynchronization.mappingContext)
                    me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
            } else {
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.mappingContext)
                    me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
            }
            me.isLoading = false;
        },
        beforeSave() {
            var me = this;
            // 필수 요소만 포함, 나머지 제거.
            if (me.useEvent) {
                if (me.selectedActivity == 'FormActivity') {
                    const { variableForHtmlFormContext, eventSynchronization, _type } = me.copyUengineProperties;
                    me.copyUengineProperties = { variableForHtmlFormContext, eventSynchronization, _type };
                } else if (me.selectedActivity == 'URLActivity') {
                    const { url, eventSynchronization, _type } = me.copyUengineProperties;
                    me.copyUengineProperties = { url, eventSynchronization, _type };
                } else {
                    const { eventSynchronization } = me.copyUengineProperties;
                    me.copyUengineProperties = { eventSynchronization };
                }
            }
            me.$emit('update:uengineProperties', me.copyUengineProperties);
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
            this.copyUengineProperties.eventSynchronization.mappingContext = JSON.parse(jsonString);
            // this.$emit('update:uEngineProperties', this.copyUengineProperties);
        },
        closeFormMapper() {
            this.isOpenFieldMapper = false;
        },
        async openFormMapper() {
            var me = this;
            if (!me.selectedForm) return;

            me.isOpenFieldMapper = true;
        },
        createForm() {
            const getUUID = () => {
                const s4 = () => {
                    return Math.floor((1 + Math.random()) * 0x10000)
                        .toString(16)
                        .substring(1);
                };

                return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
            };

            let urlData = {};
            urlData['formName'] = `${this.name}폼`;
            urlData['inputNames'] = this.copyUengineProperties.eventSynchronization.mappingContext.map((p) => p.key);

            if (urlData['inputNames'].length > 0)
                urlData['initPrompt'] = `'${urlData['formName']}'을 생성해줘. 입력해야하는 값들은 다음과 같아: ${urlData['inputNames'].join(
                    ', '
                )}`;
            else urlData['initPrompt'] = `'${urlData['formName']}'을 생성해줘.`;

            urlData['processId'] = this.processDefinitionId;
            urlData['channelId'] = getUUID();
            console.log('새로운 폼을 만들기 위한 데이터: ' + JSON.stringify(urlData));
            console.log('채널 ID: ' + urlData['channelId']);

            const formTabUrl = `/ui-definitions/chat?process_def_url_data=${btoa(encodeURIComponent(JSON.stringify(urlData)))}`;
            window.open(formTabUrl, '_blank');

            const channel = new BroadcastChannel(urlData['channelId']);
            channel.onmessage = (event) => {
                const formValueInfo = {
                    name: event.data.name,
                    id: event.data.id
                };

                this.$emit('addUengineVariable', {
                    name: formValueInfo.name,
                    type: 'Form',
                    defaultValue: formValueInfo.id,
                    description: '',
                    datasource: {
                        type: '',
                        sql: ''
                    },
                    table: '',
                    backend: null
                });

                this.selectedForm = formValueInfo.name;
            };
        }
    }
};
</script>
