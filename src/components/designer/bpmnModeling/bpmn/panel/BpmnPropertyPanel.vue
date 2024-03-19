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
            <!-- <UserTaskPanel></UserTaskPanel> -->
            <component :is="panelName" :element="elementCopy"></component>
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
        console.log(this.element.$type.split(':')[1])
        console.log(this.element)
        this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        Object.keys(this.requiredKeyLists).forEach(key => {
            this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key])
        })
    },
    components: {
    },
    data() {
        return {
            requiredKeyLists: {
                "description": "",
                "role": { "name": "" },
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
        if (this.element.lanes.length > 0) {
            this.uengineProperties.role = { "name": this.element.lanes[0].name }
        }
    },
    computed: {
        panelName() {
            return _.kebabCase(this.element.$type.split(':')[1]) + '-panel'
        },
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