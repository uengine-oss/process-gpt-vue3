<template>
    <div>
        <DetailComponent
            :title="$t('UserTaskPanel.radioSelectDescriptionTitle')"
            :details="radioSelectDescription"
            :detailUrl="'https://www.youtube.com/watch?v=E-tjj20-xxI&t'"
        />
      
        <v-radio-group v-model="selectedActivity" inline class="delete-input-details">
            <v-radio :label="$t('UserTaskPanel.default')" value="HumanActivity"></v-radio>
            <v-radio :label="$t('UserTaskPanel.form')" value="FormActivity"></v-radio>
            <v-radio v-if="useEvent" :label="$t('UserTaskPanel.external')" value="URLActivity"></v-radio>
        </v-radio-group>
        
        <div v-if="copyUengineProperties.assignType === 'default'" class="mt-2">
            <DetailComponent
                :title="$t('UserTaskPanel.defaultInfo')"
            />
        </div>

       

        <div v-if="copyUengineProperties.assignType === 'expression'" class="mt-2">
            <DetailComponent :title="$t('UserTaskPanel.expressionInfo')" />
            <v-text-field
                v-model="copyUengineProperties.assignmentExpression"
                :label="$t('UserTaskPanel.expression')"
                variant="outlined"
                density="compact"
                hide-details
                placeholder="${initiatorManager}"
            ></v-text-field>
        </div>


      
        <div v-if="!isLoading && selectedActivity == 'HumanActivity'">
            <EventSynchronizationForm
                v-if="useEvent"
                v-model="copyUengineProperties"
                :roles="roles"
                :taskName="name"
                :definition="copyDefinition"
                :selectedActivity="selectedActivity"
            ></EventSynchronizationForm>
            <div v-else>
                <DefaultArguments v-model="copyUengineProperties"></DefaultArguments>
                <Instruction v-model="activity.instruction"></Instruction>
                <Checkpoints v-model="activity.checkpoints"
                    class="user-task-panel-check-points" 
                ></Checkpoints>
            </div>
        </div>
        <div v-else-if="!isLoading && selectedActivity == 'FormActivity'">
            <div>
                <v-row class="ma-0 pa-0">
                    <v-col class="pa-0 pb-2">
                        <v-row class="ma-0 pa-0 align-center">
                            <v-col>
                                <v-label class="font-weight-medium" for="hcpm">{{ $t('UserTaskPanel.inputForm') }}</v-label>
                            </v-col>
                            <v-col cols="auto" class="pa-0">
                                <v-btn 
                                    v-if="inParameters.length === 0"
                                    color="primary" 
                                    @click="addFormParameter"
                                    prepend-icon="mdi-plus"
                                    size="small"
                                >
                                    {{ $t('UserTaskPanel.addFormParameter')}}
                                </v-btn>
                            </v-col>
                        </v-row>
                        <div v-if="inParameters.length > 0">
                            <div v-for="(parameter, index) in inParameters" :key="'input-'+index" class="mb-2">
                                <v-row class="ma-0 pa-0">
                                    <v-col class="pa-0 pr-2">
                                        <v-autocomplete
                                            v-model="parameter.variable.name"
                                            :items="definition.processVariables.filter((item) => item.type === 'Form').map((item) => item.name)"
                                            :label="$t('UserTaskPanel.form')" 
                                            color="primary"
                                            variant="outlined"
                                            hide-details
                                            density="compact"
                                            class="align-center"
                                        >
                                        </v-autocomplete>
                                    </v-col>
                                    <v-col cols="1" class="pa-0 d-flex align-center">
                                        <v-icon small @click="removeFormParameter(parameter)" :disabled="inParameters.length <= 1">mdi-delete</v-icon>
                                        <v-icon v-if="index === inParameters.length - 1" small class="ml-1" @click="addFormParameter">mdi-plus</v-icon>
                                    </v-col>
                                </v-row>
                            </div>
                        </div>

                        <v-row class="ma-0 pa-0 align-center">
                            <v-col>
                                <v-label class="font-weight-medium" for="hcpm">{{ $t('UserTaskPanel.outputForm') }}</v-label>
                            </v-col>
                        </v-row>
                        <v-autocomplete
                            :label="$t('UserTaskPanel.form')" 
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
                :selectedActivity="selectedActivity"
                :showAttributes="false"
            ></EventSynchronizationForm>
            <div v-else>
                <Instruction v-model="activity.instruction"></Instruction>
                <Checkpoints v-model="activity.checkpoints"
                    class="user-task-panel-check-points"
                ></Checkpoints>
            </div>
        </div>
        <div v-else-if="!isLoading && selectedActivity == 'URLActivity' && useEvent">
            <EventSynchronizationForm
                v-model="copyUengineProperties"
                :roles="roles"
                :taskName="name"
                :definition="copyDefinition"
                :selectedActivity="selectedActivity"
            ></EventSynchronizationForm>
        </div>
    </div>

    <!-- Schema-based Properties -->
    <div class="mt-4">
        <div class="text-subtitle-2 mb-2">{{ $t('BpmnPropertyPanel.schemaProperties') || '일반 속성' }}</div>
        <SchemaBasedProperties
            task-type="bpmn:UserTask"
            v-model="copyUengineProperties.schemaProperties"
            :readonly="isViewMode"
            @update:model-value="onSchemaPropertiesUpdate"
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
                {{ $t('UserTaskPanel.formCreateDialog') }}
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="error" @click="isOpenFormCreateDialog = false">{{ $t('UserTaskPanel.no') }}</v-btn>
                <v-btn
                    color="primary"
                    @click="
                        isOpenFormCreateDialog = false;
                        createForm();
                    "
                    >{{ $t('UserTaskPanel.yes') }}</v-btn
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
import { getGroups, getUsersByGroups, getAllUsers } from '@/utils/keycloak';
import SchemaBasedProperties from './SchemaBasedProperties.vue';

export default {
    name: 'user-task-panel',
    components: {
        BpmnParameterContexts,
        Mapper,
        EventSynchronizationForm,
        DefaultArguments,
        Checkpoints,
        Instruction,
        SchemaBasedProperties
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
            copyUengineProperties: {
                ...JSON.parse(JSON.stringify(this.uengineProperties)),
                schemaProperties: this.uengineProperties?.schemaProperties || {}
            },
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
            },
            radioSelectDescription: [
                {
                    title: 'UserTaskPanel.radioSelectDescriptionSubTitle1'
                },
            ],
            candidateRoles: [], // Keycloak 그룹 목록 (역할/그룹 선택용)
            candidateGroups: [], // 선택 가능한 그룹 목록 (candidateRoles와 동일)
            candidateUsers: [],
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
        me.loadCandidateRoles();
        me.loadCandidateUsers();
        me.loadCurrentLaneRole();
        me.loadCurrentPoolRole();
    },
    computed: {
        useEvent() {
            if (window.$mode == "ProcessGPT") {
                return false;
            } else {
                return true;
            }
        },
        inParameters() {
            if(!this.copyUengineProperties) return [];
            if(!this.copyUengineProperties.parameters) return [];
            if(this.copyUengineProperties.parameters.length === 0) return [];
            return this.copyUengineProperties.parameters.filter((item) => item.direction === 'IN' || item.direction === 'IN-OUT');
        },
        outParameters() {
            if(!this.copyUengineProperties) return [];
            if(!this.copyUengineProperties.parameters) return [];
            if(this.copyUengineProperties.parameters.length === 0) return [];
            return this.copyUengineProperties.parameters.filter((item) => item.direction === 'OUT');
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
                const existingOutParam = me.copyUengineProperties.parameters.find(param => param.direction === 'OUT');
                if (existingOutParam) {
                    // 기존 OUT 파라미터가 있으면 업데이트
                    existingOutParam.variable = variableForHtmlFormContext;
                } else {
                    // 없으면 새로 추가
                    me.copyUengineProperties.parameters.push({
                        direction: 'OUT',
                        variable: variableForHtmlFormContext,
                    });
                }
                // me.copyUengineProperties.variableForHtmlFormContext = variableForHtmlFormContext;

                if (me.useEvent) {
                    if (oldVal) me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] }; // CHECK!!!
                    me.formMapperJson = JSON.stringify(me.copyUengineProperties.eventSynchronization.mappingContext, null, 2);
                }
            } else {
                // me.copyUengineProperties.variableForHtmlFormContext = {};
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
        },
        'copyUengineProperties.candidateGroups': {
            handler(newVal) {
                // Candidate Groups가 변경되면 해당 그룹의 사용자 목록 자동 업데이트
                if (newVal && newVal.length > 0) {
                    this.loadCandidateUsersFromGroups(newVal);
                } else {
                    // 그룹이 없으면 전체 사용자 목록으로 리셋
                    this.loadCandidateUsers();
                }
            },
            deep: true
        }
    },
    methods: {
        init() {
            var me = this;
            // ??
            if (me.roles.length > 0) {
                me.copyUengineProperties.role = { name: me.role };
            }

            me.selectedActivity = me.copyUengineProperties._type ? me.copyUengineProperties._type.split('.').pop() : 'HumanActivity';
            if (me.selectedActivity == 'FormActivity') {
                me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';

                if(!me.copyUengineProperties.parameters) {
                    me.copyUengineProperties.parameters = [{
                        direction: 'OUT',
                        variable: {'name': ''}
                    }];
                }
                // if (!me.copyUengineProperties.variableForHtmlFormContext) {
                //     me.copyUengineProperties.variableForHtmlFormContext = {};
                // }
                // me.selectedForm = me.copyUengineProperties.variableForHtmlFormContext.name;
                me.selectedForm = null;
                let outputForm = me.outParameters.find(p => p.direction === 'OUT');
                if(outputForm){
                    me.selectedForm = outputForm.variable ? outputForm.variable.name : null;
                }

                if (me.useEvent) {
                    me.formMapperJson = JSON.stringify(me.copyUengineProperties.eventSynchronization.mappingContext, null, 2);
                }
                if (!me.selectedForm) {
                    me.isOpenFormCreateDialog = true;
                }
            } else if (me.selectedActivity == 'URLActivity') {
                me.copyUengineProperties._type = 'org.uengine.kernel.URLActivity';
                if (!me.copyUengineProperties.url) me.copyUengineProperties.url = '';
                if (me.useEvent) {
                    if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                    if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                    if (!me.copyUengineProperties.eventSynchronization.attributes)
                        me.copyUengineProperties.eventSynchronization.attributes = [];
                    if (!me.copyUengineProperties.eventSynchronization.mappingContext)
                        me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
                    me.formMapperJson = JSON.stringify(me.copyUengineProperties.eventSynchronization.mappingContext, null, 2);
                }
            } else {
                me.copyUengineProperties._type = 'org.uengine.kernel.HumanActivity';
                if (me.useEvent) {
                    if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                    if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                    if (!me.copyUengineProperties.eventSynchronization.attributes)
                        me.copyUengineProperties.eventSynchronization.attributes = [];
                    if (!me.copyUengineProperties.eventSynchronization.mappingContext)
                        me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
                }
            }

            if(window.$mode == "uEngine"){
                if(!me.copyUengineProperties.assignType){
                    me.copyUengineProperties.assignType = 'claim';
                }
            }

            // 경합 모드 기본값: false (Pool 역할 사용 - BPMN 기본값)
            if (me.copyUengineProperties.useCompetingMode === undefined) {
                me.copyUengineProperties.useCompetingMode = false;
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
                // if (!me.copyUengineProperties.variableForHtmlFormContext) me.copyUengineProperties.variableForHtmlFormContext = {};
                if (!me.copyUengineProperties.parameters) me.copyUengineProperties.parameters = [];
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.eventType) me.copyUengineProperties.eventSynchronization.eventType = '';
                if (!me.copyUengineProperties.eventSynchronization.attributes)
                    me.copyUengineProperties.eventSynchronization.attributes = [];
                if (!me.copyUengineProperties.eventSynchronization.mappingContext)
                    me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };

                // me.selectedForm = me.copyUengineProperties.variableForHtmlFormContext.name;
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
                me.copyUengineProperties._type = 'org.uengine.kernel.HumanActivity';
                if (!me.copyUengineProperties.eventSynchronization) me.copyUengineProperties.eventSynchronization = {};
                if (!me.copyUengineProperties.eventSynchronization.mappingContext) me.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
            }
            me.isLoading = false;
        },
        beforeSave() {
            var me = this;
            // 필수 요소만 포함, 나머지 제거.
            if (me.useEvent) {
                if (me.selectedActivity == 'FormActivity') {
                    // const { variableForHtmlFormContext, eventSynchronization, _type } = me.copyUengineProperties;
                    // me.copyUengineProperties = { variableForHtmlFormContext, eventSynchronization, _type };
                    const { parameters, eventSynchronization, _type } = me.copyUengineProperties;
                    const outParameter = parameters.find(param => param.direction === 'OUT');
                    if (outParameter) {
                        parameters.filter(param => param.direction.includes('IN')).forEach(param => {
                            if (param.variable.name === outParameter.variable.name) {
                                param.direction = 'IN-OUT';
                            } else {
                                param.direction = 'IN';
                            }
                        });
                    }

                    me.copyUengineProperties = { parameters, eventSynchronization, _type };
                } else if (me.selectedActivity == 'URLActivity') {
                    const { url, eventSynchronization, _type } = me.copyUengineProperties;
                    me.copyUengineProperties = { url, eventSynchronization, _type };
                } else if(me.selectedActivity == 'HumanActivity'){
                    const { eventSynchronization, _type } = me.copyUengineProperties;
                    me.copyUengineProperties = { eventSynchronization, _type };
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
        addFormParameter(){
            if(!this.copyUengineProperties) this.copyUengineProperties = {}
            if(!this.copyUengineProperties.parameters) this.copyUengineProperties.parameters = []
            this.copyUengineProperties.parameters.push({
                direction: 'IN',
                variable: {'name': ''},
            });
        },
        removeFormParameter(parameter){
            const index = this.copyUengineProperties.parameters.findIndex(param => param === parameter);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
            }
        },
        iconForDirection: function (direction) {
            if (direction == "IN")
                return "mdi-arrow-left";
            else if (direction == "OUT" || direction == "OUT ")
                return "mdi-arrow-right";
            else
                return "mdi-arrow-left-right";
        },
        directionChanged: function (parameterContext) {
            if (parameterContext.direction == "OUT ") {
                parameterContext.direction = "OUT";
            } else {
                parameterContext.transformerMapping = null;
            }
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
            if (this.useEvent) {
                urlData['inputNames'] = this.copyUengineProperties.eventSynchronization.mappingContext.map((p) => p.key);
            } else {
                urlData["inputNames"] = this.copyUengineProperties.parameters.map(p => p.argument.text)
            }

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
        },
        async loadCandidateRoles() {
            try { 
                this.candidateRoles = await getGroups();
                // candidateGroups도 동일하게 설정 (UI에서 사용)
                this.candidateGroups = this.candidateRoles.map(group => ({
                    title: group,
                    value: group
                }));
                console.log('Candidate groups loaded:', this.candidateGroups);
            } catch (error) {
                console.error('Failed to load candidate groups:', error);
                this.candidateRoles = [];
                this.candidateGroups = [];
            }
        },
        async loadCandidateUsers() {
            try {
                // 선택된 그룹이 있으면 해당 그룹의 사용자 가져오기
                if (this.copyUengineProperties.candidateGroups && this.copyUengineProperties.candidateGroups.length > 0) {
                    await this.loadCandidateUsersFromGroups(this.copyUengineProperties.candidateGroups);
                } else {
                    // 기본적으로 Keycloak에서 전체 사용자 목록 가져오기
                    const userList = await getAllUsers({ max: 100 });
                    this.candidateUsers = userList.map(user => ({
                        title: user.username || user.email || user.id,
                        value: user.email || user.username || user.id
                    }));
                }
                console.log(this.candidateUsers)
            } catch (error) {
                console.error('Failed to load candidate users:', error);
                this.candidateUsers = [];
            }
        },
        async loadCandidateUsersFromGroups(groupNames) {
            try {
                // Keycloak에서 그룹에 속한 사용자 목록 가져오기
                const users = await getUsersByGroups(groupNames);
                // SelectBox 형식으로 변환
                this.candidateUsers = users.map(user => ({
                    title: user.username || user.email || user.id,
                    value: user.email || user.username || user.id
                }));
                console.log('Users from groups:', this.candidateUsers);
            } catch (error) {
                console.error('Failed to load users from groups:', error);
                // 에러 발생 시 Keycloak에서 전체 사용자 목록으로 fallback
                const userList = await getAllUsers({ max: 100 });
                this.candidateUsers = userList.map(user => ({
                    title: user.username || user.email || user.id,
                    value: user.email || user.username || user.id
                }));
            }
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
                    const element = elementRegistry.get(this.element?.id);
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
        },
        onSchemaPropertiesUpdate(properties) {
            this.copyUengineProperties.schemaProperties = properties;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        }
    }
};
</script>
