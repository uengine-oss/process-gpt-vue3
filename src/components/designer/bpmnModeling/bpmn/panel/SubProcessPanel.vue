<template>
    <div>
        <!-- <div class="included" style="margin-bottom: 22px;">
            <div style="margin-bottom: 8px;">Select Definition</div>
            <v-autocomplete v-model="copyUengineProperties.definitionId" :items="definitions" :disabled="isViewMode"
                item-title="name" color="primary" label="Definition" variant="outlined" hide-details></v-autocomplete>
        </div> -->
        <div>
            <v-radio-group v-model="isForEachRole" inline>
                <v-radio :label="$t('SubProcessPanel.forEachRole')" :value="false"></v-radio>
                <v-radio :label="$t('SubProcessPanel.forEachVariable')" :value="true"></v-radio>
            </v-radio-group>
            <div v-if="isForEachRole">
                <v-row class="ma-0 pa-0">
                    <v-autocomplete
                        :items="roles"
                        v-model="selectedRole"
                        color="primary"
                        :label="$t('SubProcessPanel.role')"
                        variant="outlined"
                        hide-details
                    ></v-autocomplete>
                    <!-- <bpmn-parameter-contexts
                        :for-sub-process="true"
                        :definition-variables="definitionVariables"
                        :is-view-mode="isViewMode"
                        :parameter-contexts="copyUengineProperties.variableBindings"
                    ></bpmn-parameter-contexts> -->
                </v-row>
                <DetailComponent
                    :title="$t('SubProcessPanel.forEachRoleDescriptionTitle')"
                    :details="forEachRoleDescription"
                />
            </div>
            <div v-else> 
                <v-row class="ma-0 pa-0">
                    <v-autocomplete
                        :items="processVariables"
                        :item-props="true"
                        item-value
                        item-title="name"
                        color="primary"
                        v-model="selectedVariable"
                        :label="$t('SubProcessPanel.variable')"
                        variant="outlined"
                    ></v-autocomplete>
                    <!-- <bpmn-parameter-contexts
                        :for-sub-process="true"
                        :definition-variables="definitionVariables"
                        :is-view-mode="isViewMode"
                        :parameter-contexts="copyUengineProperties.variableBindings"
                    ></bpmn-parameter-contexts> -->
                </v-row>
                <DetailComponent
                    :title="$t('SubProcessPanel.forEachVariableDescriptionTitle')"
                    :details="SubProcessDescription"
                    :detailUrl="'https://www.youtube.com/watch?v=nhQCDfYa6Gk'"
                />
            </div>
        </div>
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'sub-process-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        roles: Array,
        processVariables: Array
    },
    created() {
        // console.log(this.element)
        // this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        // Object.keys(this.requiredKeyLists).forEach((key) => {
        //     this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key]);
        // });
    },
    data() {
        return {
            requiredKeyLists: {
                // variableBindings: [],
                // roleBindings: [],
                definitionId: ''
            },
            definitions: [],
            definitionVariables: [],
            definitionRoles: [],
            calleeDefinitionRoles: [],
            copyUengineProperties: this.uengineProperties,
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
            definitionCnt: 0,
            isForEachRole: false,
            selectedRole: null,
            selectedVariable: null,
            SubProcessDescription: [
                {   
                    title: "SubProcessPanel.forEachVariableDescriptionSubTitle1",
                    image: "CreateMultidataForm.gif"
                },
                {
                    title: "SubProcessPanel.forEachVariableDescriptionSubTitle2",
                    image: "typeFormMapping.gif"
                }
            ],
            forEachRoleDescription: [
                {
                    title: "SubProcessPanel.forEachRoleDescriptionSubTitle1",
                    image: "forEachRoleDescriptionSubTitle1.png"
                }
            ],
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        let def = this.bpmnModeler.getDefinitions();
        // if (!this.copyUengineProperties.variableBindings) this.copyUengineProperties.variableBindings = [];
        const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
        if (!processElement) {
            console.error('bpmn:Process element not found');
            return;
        }
        processElement.forEach((process) => {
            (process.laneSets || []).forEach((laneSet) => {
                (laneSet.lanes || []).forEach((lane) => {
                    // 레인의 이름을 배열에 추가합니다.
                    if (lane?.name?.length > 0) me.calleeDefinitionRoles.push(lane.name);
                });
            });
        });

        if (this.copyUengineProperties.forEachVariable) {
            this.selectedVariable = this.copyUengineProperties.forEachVariable.name;
            this.isForEachRole = false;
        }
        if (this.copyUengineProperties.forEachRole) {
            this.selectedRole = this.copyUengineProperties.forEachRole.name;
            this.isForEachRole = true;
        }
    },
    computed: {
        // inputData() {
        //     let params = this.copyUengineProperties.variableBindings;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'IN') result.push(element);
        //         });
        //     return result;
        // },
        // outputData() {
        //     let params = this.copyUengineProperties.variableBindings;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'OUT') result.push(element);
        //         });
        //     return result;
        // }
    },
    watch: {
        'copyUengineProperties.definitionId'(after, before) {
            this.setDefinitionInfo(after);
        },
        selectedRole(after, before) {
            console.log(after);
            if (after) {
                this.copyUengineProperties.forEachRole = {
                    name: after
                };
            } else {
                delete this.copyUengineProperties.forEachRole;
            }
        },
        selectedVariable(after, before) {
            if (after) {
                const variableObject = this.processVariables.find((variable) => variable.name === after);
                if (variableObject) {
                    let DuplicateVo = JSON.parse(JSON.stringify(variableObject));
                    DuplicateVo.type = this.parseType(variableObject.type);
                    this.copyUengineProperties.forEachVariable = DuplicateVo;
                }
            } else {
                delete this.copyUengineProperties.forEachVariable;
            }
        }
    },
    methods: {
        parseType(type) {
            switch (type) {
                case 'Text':
                    return 'java.lang.String';
                case 'Number':
                    return 'java.lang.Number';
                case 'Date':
                    return 'java.util.Date';
                case 'Form':
                    return 'org.uengine.kernel.FormActivity';
            }
        },
        async setDefinitionInfo(definitionId) {
            // definition 정보 호출
            const backend = BackendFactory.createBackend();
            const def = await backend.getRawDefinition(definitionId);
            // XML에서 role 정보 추출
            this.definitionRoles = this.extractLanesFromBpmnXml(def.bpmn);
            this.definitionVariables = this.extractVariablesFromBpmnXml(def.bpmn);
            this.definitionCnt++;
        },
        extractVariablesFromBpmnXml(bpmnXml) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(bpmnXml, 'application/xml');
            const variables = xmlDoc.getElementsByTagName('uengine:variable');
            const variableInfo = Array.from(variables)
                .map((val) => {
                    if (val.getAttribute('name')?.length > 0)
                        return {
                            type: val.getAttribute('type'),
                            name: val.getAttribute('name')
                        };
                })
                .filter(Boolean);

            console.log(variableInfo);
            return variableInfo;
        },
        extractLanesFromBpmnXml(bpmnXml) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(bpmnXml, 'application/xml');
            const lanes = xmlDoc.getElementsByTagName('bpmn:lane');
            const laneInfo = Array.from(lanes)
                .map((lane) => {
                    if (lane.getAttribute('name')?.length > 0)
                        return {
                            id: lane.getAttribute('id'),
                            name: lane.getAttribute('name')
                        };
                })
                .filter(Boolean);

            console.log(laneInfo);
            return laneInfo;
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        deleteParameter(item) {
            const index = this.copyUengineProperties.variableBindings.findIndex((element) => element.key === item.key);
            if (index > -1) {
                this.copyUengineProperties.variableBindings.splice(index, 1);
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
            this.copyUengineProperties.variableBindings.push({ key: this.paramKey, value: this.paramValue });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        },
        
        addCheckpoint() {
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    }
};
</script>
