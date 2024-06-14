<template>
    <div>
        <div class="included" style="margin-bottom: 22px">
            <div style="margin-bottom: 8px">Select Definition</div>
            <ProcessDefinitionDisplay 
                v-model="copyUengineProperties.definitionId" 
                :disabled="isViewMode"
                :file-extensions="['.bpmn']"
                :options="{ hideDetails: true, itemTitle: 'name', itemValue: 'path' }"
            ></ProcessDefinitionDisplay>
        </div>
        <div :key="definitionCnt" v-if="copyUengineProperties.definitionId">
            <div>
                <v-row class="ma-0 pa-0">
                    <div>Parameter Context</div>
                    <v-spacer></v-spacer>
                </v-row>
                <v-row>
                    <bpmn-parameter-contexts
                        :for-sub-process="true"
                        :definition-variables="definitionVariables"
                        :is-view-mode="isViewMode"
                        :parameter-contexts="copyUengineProperties.variableBindings"
                    ></bpmn-parameter-contexts>
                </v-row>
            </div>
            <div>
                <v-row class="ma-0 pa-0">
                    <div>Role Mapping</div>
                </v-row>
                <v-row>
                    <bpmn-role-parameter-contexts
                        :role-bindings="copyUengineProperties.roleBindings"
                        :is-view-mode="isViewMode"
                        :callee-definition-roles="calleeDefinitionRoles"
                        :definition-roles="definitionRoles"
                    ></bpmn-role-parameter-contexts>
                </v-row>
            </div>
        </div>
        <div v-else>
            <v-row> Process Definition이 선택되지 않았습니다. </v-row>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
// import StorageBaseFactory from '@/utils/StorageBaseFactory';
// const storage = StorageBaseFactory.getStorage()
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue';

export default {
    name: 'call-activity-panel',
    components: {
        ProcessDefinitionDisplay
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {
        // console.log(this.element)
        // this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        Object.keys(this.requiredKeyLists).forEach((key) => {
            this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key]);
        });
    },
    data() {
        return {
            requiredKeyLists: {
                variableBindings: [],
                roleBindings: [],
                definitionId: ''
            },
            definitions: [],
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
            definitionCnt: 0
        };
    },
    async mounted() {
        let me = this;
        const backend = BackendFactory.createBackend();
        const store = useBpmnStore();
        me.bpmnModeler = store.getModeler;
        let def = me.bpmnModeler.getDefinitions();
        if (!me.copyUengineProperties.variableBindings) me.copyUengineProperties.variableBindings = [];
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
        // // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
        // const value = await storage.list('proc_def');
        const value = await backend.listDefinition();
        if (value) {
            me.definitions = value;
        }
        if (me.copyUengineProperties.definitionId) me.setDefinitionInfo(me.copyUengineProperties.definitionId);
    },
    computed: {
        inputData() {
            let params = this.copyUengineProperties.variableBindings;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'IN') result.push(element);
                });
            return result;
        },
        outputData() {
            let params = this.copyUengineProperties.variableBindings;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'OUT') result.push(element);
                });
            return result;
        }
    },
    watch: {
        'copyUengineProperties.definitionId'(after, before) {
            this.setDefinitionInfo(after);
        }
    },
    methods: {
        async setDefinitionInfo(definitionId) {
            if(!definitionId) return;
            // definition 정보 호출
            const backend = BackendFactory.createBackend();
            if (definitionId.includes('.bpmn')) {
                definitionId = definitionId.split('.bpmn')[0];
            }
            const def = await backend.getRawDefinition(definitionId, { type: 'bpmn' });
            // XML에서 role 정보 추출
            if (def) {
                this.definitionRoles = this.extractLanesFromBpmnXml(def);
                this.definitionVariables = this.extractVariablesFromBpmnXml(def);
                this.definitionCnt++;
            }
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
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    }
};
</script>
