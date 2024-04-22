<template>
    <div>
        <div class="included" style="margin-bottom: 22px">
            <div style="margin-bottom: 8px">Select Role Type</div>
            <v-radio-group v-model="copyUengineProperties.roleResolutionContext._type" row style="margin-top: 0px !important">
                <v-radio
                    id="roleResolution"
                    name="roleResolution"
                    value="null"
                    label="None"
                    style="margin-right: 8px !important; font-size: 15px"
                ></v-radio>
                <v-radio
                    id="roleResolution"
                    name="roleResolution"
                    value="org.uengine.five.overriding.IAMRoleResolutionContext"
                    label="Role Resolution By IAM Scope"
                    style="margin-right: 8px !important; font-size: 15px"
                ></v-radio>
                <v-radio
                    id="roleResolution"
                    name="roleResolution"
                    value="org.uengine.kernel.DirectRoleResolutionContext"
                    label="Role Resolution By Direct user"
                    style="margin-right: 8px !important; font-size: 15px"
                ></v-radio>
            </v-radio-group>

            <v-text-field
                v-if="copyUengineProperties.roleResolutionContext._type == 'org.uengine.five.overriding.IAMRoleResolutionContext'"
                v-model="copyUengineProperties.roleResolutionContext.scope"
                label="Scope Name"
            ></v-text-field>

            <v-text-field
                v-if="copyUengineProperties.roleResolutionContext._type == 'org.uengine.kernel.DirectRoleResolutionContext'"
                v-model="copyUengineProperties.roleResolutionContext.endpoint"
                label="User ID"
            ></v-text-field>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

export default {
    name: 'lane-panel',
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
                roleResolutionContext: {}
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

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        let def = this.bpmnModeler.getDefinitions();
        if (!this.copyUengineProperties.variableBindings) this.copyUengineProperties.variableBindings = [];
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
        const value = await storage.list('proc_def');
        if (value) {
            this.definitions = value;
        }
        if (this.copyUengineProperties.definitionId) this.setDefinitionInfo(this.copyUengineProperties.definitionId);
    },
    computed: {},
    watch: {
        'copyUengineProperties.roleResolutionContext._type'(after, before) {
            if (after == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                delete this.copyUengineProperties.roleResolutionContext.endpoint;
            } else if (after == 'org.uengine.kernel.DirectRoleResolutionContext') {
                delete this.copyUengineProperties.roleResolutionContext.scope;
            } else if (after == 'null') {
                delete this.copyUengineProperties.roleResolutionContext.scope;
                delete this.copyUengineProperties.roleResolutionContext.endpoint;
            }
        }
    },
    methods: {
        async setDefinitionInfo(definitionId) {
            // definition 정보 호출
            const def = await storage.getObject(`proc_def/${definitionId}`, { key: 'id' });
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
