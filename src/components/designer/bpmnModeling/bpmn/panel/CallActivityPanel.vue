<template>
    <div>
        <div class="included" style="margin-bottom: 22px;">
            <div style="margin-bottom: 8px;">Select Definition</div>
            <v-autocomplete v-model="copyUengineProperties.definition" :items="definitions" :disabled="isViewMode"
                item-title="name" color="primary" label="Definition" variant="outlined" hide-details></v-autocomplete>
        </div>
        <div :key="definitionCnt">
            <div>
                <v-row class="ma-0 pa-0">
                    <div>Parameter Context</div>
                    <v-spacer></v-spacer>
                </v-row>
                <v-row>
                    <bpmn-parameter-contexts :for-sub-process="true" :definition-variables="definitionVariables"
                        :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts>
                </v-row>
            </div>
            <div>
                <v-row class="ma-0 pa-0">
                    <div>Extended Property</div>
                </v-row>
                <v-row v-if="copyUengineProperties.definition">
                    <bpmn-role-parameter-contexts :role-bindings="copyUengineProperties.roleBindings"
                        :definition-roles="definitionRoles"></bpmn-role-parameter-contexts>
                </v-row>
                <v-row v-else>
                    Process Definition이 선택되지 않았습니다.
                </v-row>
            </div>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage()
export default {
    name: 'call-activity-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {
        // console.log(this.element)
        // this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        Object.keys(this.requiredKeyLists).forEach(key => {
            this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key])
        })
    },
    data() {
        return {
            requiredKeyLists: {
                "parameters": [],
                "checkpoints": [],
                "parameters": [],
                "roleBindings": [],
                "definitionId": ""
            },
            definitions: [],
            definitionRoles: [],
            copyUengineProperties: this.uengineProperties,
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
            paramValue: "",
            definitionCnt: 0
        };
    },
    async mounted() {
        let me = this
        if (!me.$app.try) {
            me.$app = me.$app._component.methods;
        }
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        const value = await storage.list('proc_def');
        if (value) {
            this.definitions = value
        }
    },
    computed: {
        inputData() {
            let params = this.copyUengineProperties.parameters
            let result = []
            if (params)
                params.forEach(element => {
                    if (element.direction == 'IN')
                        result.push(element)
                });
            return result
        },
        outputData() {
            let params = this.copyUengineProperties.parameters
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
        async "copyUengineProperties.definition"(after, before) {
            // definition 정보 호출
            const def = await storage.getObject(`proc_def/${after}`, { key: 'id' })
            // XML에서 role 정보 추출
            this.definitionRoles = this.extractLanesFromBpmnXml(def.bpmn)
            this.definitionVariables = this.extractVariablesFromBpmnXml(def.bpmn)
            this.definitionCnt++
        }
    },
    methods: {
        extractVariablesFromBpmnXml(bpmnXml) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(bpmnXml, "application/xml");
            const variables = xmlDoc.getElementsByTagName('uengine:variable')
            const variableInfo = Array.from(variables).map(val => {
                if (val.getAttribute('name')?.length > 0)
                    return {
                        type: val.getAttribute('type'),
                        name: val.getAttribute('name')
                    };
            }).filter(Boolean);;

            console.log(variableInfo);
            return variableInfo;
        },
        extractLanesFromBpmnXml(bpmnXml) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(bpmnXml, "application/xml");
            const lanes = xmlDoc.getElementsByTagName('bpmn:lane')
            const laneInfo = Array.from(lanes).map(lane => {
                if (lane.getAttribute('name')?.length > 0)
                    return {
                        id: lane.getAttribute('id'),
                        name: lane.getAttribute('name')
                    };
            }).filter(Boolean);;

            console.log(laneInfo);
            return laneInfo;
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        deleteParameter(item) {
            const index = this.copyUengineProperties.parameters.findIndex(element => element.key === item.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
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
            this.copyUengineProperties.parameters.push({ key: this.paramKey, value: this.paramValue })
            this.$emit('update:uEngineProperties', this.copyUengineProperties)
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
    }
};
</script>