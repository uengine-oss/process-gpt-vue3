<template>
    <div>
        <v-row class="pa-0 ma-0">
            <v-spacer></v-spacer>
            <v-btn @click="save">
                <Icon icon="mdi:close" width="24" height="24" class="cursor-pointer" />
            </v-btn>

            <!-- <Icon icon="mdi:close" width="24" height="24" @click="$emit('close')" class="cursor-pointer" /> -->
        </v-row>
        <v-card-text style="overflow: auto; height: calc(-155px + 100vh); width:700px;">
            <div style="float: right">Role: {{ role }}</div>
            <div>{{ $t('BpnmPropertyPanel.name') }}</div>
            <v-text-field v-model="name" :disabled="isViewMode"></v-text-field>
            <!-- <div>
                <div>{{ $t('BpnmPropertyPanel.description') }}</div>
                <v-textarea v-if="!elementCopy.$type.includes('Event')" :disabled="isViewMode"
                    v-model="uengineProperties.description"></v-textarea>
            </div> -->
            <component :is="panelName" 
                :isViewMode="isViewMode" 
                :uengine-properties="uengineProperties" 
                :name="name"
                :role="role"
                ref="panelComponent"
                @update:name="val => name = val"
                :definition="definition"
            ></component>
        </v-card-text>
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
        isViewMode: Boolean,
        definition: Object
    },
    created() {
        if(!this.element.extensionElements.values[0].json) {
            this.$emit('close');
            return;
        }
        this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        if (this.element.lanes?.length > 0) {
            this.role = this.element.lanes[0].name
        }
        // 필수 uEngine Properties의 key가 없다면 작업.
        // Object.keys(this.requiredKeyLists).forEach(key => {
        //     this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key])
        // })
    },
    components: {
    },
    data() {
        return {
            // requiredKeyLists: {
            //     "description": "",
            //     "role": { "name": "" },
            //     "parameters": []
            // },
            // requiredKeyLists: {

            //     "parameters": []
            // },
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
            paramValue: "",
            role: "",
        };
    },
    async mounted() {

        let me = this

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        this.name = this.element.name

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
        deleteParameters(item) {
            const index = this.uengineProperties.parameters.findIndex(element => element.key === item.key);
            if (index > -1) {
                this.uengineProperties.parameters.splice(index, 1);
            }
        },
        deleteCheckPoint(item) {
            const index = this.uengineProperties.checkpoints.findIndex(element => element.checkpoint === item.checkpoint);
            if (index > -1) {
                this.uengineProperties.checkpoints.splice(index, 1);
            }
        },
        addParameter() {
            this.uengineProperties.parameters.push({ key: this.paramKey, value: this.paramValue })
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
        save() {
            if (this.$refs.panelComponent && this.$refs.panelComponent.beforeSave) {
                this.$refs.panelComponent.beforeSave();
            }
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