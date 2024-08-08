<template>
    <div style="height: calc(100vh - 155px)">
        <v-row class="pa-0 ma-0">
            <v-spacer></v-spacer>
            <v-btn @click="save" icon text size="small" class="mr-4 mt-4">
                <Icons :icon="'close'" class="cursor-pointer" :size="16" />
            </v-btn>
        </v-row>
        <v-card-text style="overflow: auto; height: calc(100% - 30px); width: 700px">
            <ValidationField v-if="checkValidation()" :validation="checkValidation()"></ValidationField>
            <div style="float: right">Role: {{ role.name }}</div>
            <div>{{ $t('BpnmPropertyPanel.name') }}</div>
            <v-text-field v-model="name" :disabled="isViewMode" ref="cursor"></v-text-field>
            <!-- <div>
                <div>{{ $t('BpnmPropertyPanel.description') }}</div>
                <v-textarea v-if="!elementCopy.$type.includes('Event')" :disabled="isViewMode"
                    v-model="uengineProperties.description"></v-textarea>
            </div> -->
            <component
                style="height: 100%"
                :is="panelName"
                :isViewMode="isViewMode"
                :uengineProperties="uengineProperties"
                :name="name"
                :roles="roles"
                :process-variables="processVariables"
                :element="element"
                ref="panelComponent"
                @update:name="(val) => (name = val)"
                @update:text="(val) => (text = val)"
                @update:uengineProperties="(newProps) => (uengineProperties = newProps)"
                :definition="definition"
                :processDefinitionId="processDefinitionId"
                :processDefinition="processDefinition"
                @addUengineVariable="(val) => $emit('addUengineVariable', val)"
            ></component>
        </v-card-text>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import ValidationField from '@/components/designer/bpmnModeling/bpmn/panel/ValidationField.vue';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage();
export default {
    name: 'bpmn-property-panel',
    props: {
        element: Object,
        processDefinition: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        definition: Object,
        roles: Array,
        processVariables: Array,
        validationList: Object
    },
    created() {
        // if (!this.element.extensionElements.values[0].json) {
        //     this.$emit('close');
        //     return;
        // }
        console.log(this.element);
        // Extension이 없는 경우 무조건 빈 Property 생성
        if (!this.element.extensionElements) {
            this.element.extensionElements = {};
            this.element.extensionElements.values = [];
            this.element.extensionElements.values[0] = {
                json: '{}'
            };
        }
        if (this.element) {
            this.name = this.element.name;
            this.text = this.element.text;
        }
        this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json);
        if (this.element.lanes?.length > 0) {
            this.role = this.element.lanes[0];
        }
        // 필수 uEngine Properties의 key가 없다면 작업.
        // Object.keys(this.requiredKeyLists).forEach(key => {
        //     this.ensureKeyExists(this.uengineProperties, key, this.requiredKeyLists[key])
        // })
    },
    components: {
        ValidationField
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
            role: {}
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;

        this.$refs.cursor.focus();
    },
    computed: {
        panelName() {
            return _.kebabCase(this.element.$type.split(':')[1]) + '-panel';
        }
        // inputData() {
        //     let params = this.uengineProperties.parameters;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'IN') result.push(element);
        //         });
        //     return result;
        // },
        // outputData() {
        //     let params = this.uengineProperties.parameters;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'OUT') result.push(element);
        //         });
        //     return result;
        // }
    },
    watch: {},
    methods: {
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        // deleteParameters(item) {
        //     const index = this.uengineProperties.parameters.findIndex((element) => element.key === item.key);
        //     if (index > -1) {
        //         this.uengineProperties.parameters.splice(index, 1);
        //     }
        // },
        // deleteCheckPoint(item) {
        //     const index = this.uengineProperties.checkpoints.findIndex((element) => element.checkpoint === item.checkpoint);
        //     if (index > -1) {
        //         this.uengineProperties.checkpoints.splice(index, 1);
        //     }
        // },
        // addParameter() {
        //     this.uengineProperties.parameters.push({ key: this.paramKey, value: this.paramValue });
        // },
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
            this.uengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
        },
        save() {
            if (this.$refs.panelComponent && this.$refs.panelComponent.beforeSave) {
                this.$refs.panelComponent.beforeSave();
            }

            const modeling = this.bpmnModeler.get('modeling');
            const elementRegistry = this.bpmnModeler.get('elementRegistry');
            const task = elementRegistry.get(this.element.id);
            const name = this.name;

            const json = JSON.stringify(this.uengineProperties);
            
            const elementCopyDeep = _.cloneDeep(this.elementCopy);
            modeling.updateProperties(task, { name: name });
            if (task.type == 'bpmn:TextAnnotation') {
                // TextAnnotation Size 깨지는 현상 해결
                const originTaskWidth = task.width? JSON.parse(JSON.stringify(task.width)) : null;
                const originTaskHeight = task.height? JSON.parse(JSON.stringify(task.height)) : null;
                const originTaskX = task.x? JSON.parse(JSON.stringify(task.x)) : null;
                const originTaskY = task.y? JSON.parse(JSON.stringify(task.y)) : null;
                
                if (this.text) {
                    const text = this.text;
                    modeling.updateProperties(task, { text: text });
                }
                if(originTaskX && originTaskY && originTaskWidth && originTaskHeight) {
                modeling.resizeShape(task, {
                    x: originTaskX,
                    y: originTaskY,
                    width: originTaskWidth,
                    height: originTaskHeight 
                });
            }
            }

           

            if (elementCopyDeep.extensionElements && elementCopyDeep.extensionElements.values) {
                elementCopyDeep.extensionElements.values[0].json = json;
            } else {
                elementCopyDeep.extensionElements = {
                    values: [{ json }]
                };
            }

            if (this.elementCopy.text) elementCopyDeep.text = this.text;

            modeling.updateProperties(task, {
                extensionElements: elementCopyDeep.extensionElements
            });

            this.$emit('close');

            console.log(task.businessObject.extensionElements.values[0]);
        },
        checkValidation() {
            let key = Object.keys(this.validationList).filter((item) => item === this.element.id);
            if (key.length > 0) {
                return this.validationList[key];
            }
            return null;
        }
    }
};
</script>
