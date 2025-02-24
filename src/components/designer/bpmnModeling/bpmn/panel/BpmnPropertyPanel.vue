<template>
    <div id="property-panel" style="height: calc(100vh - 155px)">
        <v-row class="ma-0 pa-4 pb-0">
            <v-card-title v-if="isViewMode" class="pa-0">{{ name }}</v-card-title>
            <v-text-field v-else v-model="name" :label="$t('BpmnPropertyPanel.name')" 
                :disabled="isViewMode" ref="cursor" 
                class="bpmn-property-panel-name mb-3 delete-input-details"
            ></v-text-field>
            <v-spacer></v-spacer>
            <v-btn @click="save" icon variant="text" density="comfortable" class="panel-close-btn">
                <Icons :icon="'close'" class="cursor-pointer" :size="16"/>
            </v-btn>
        </v-row>
        <v-card-text class="delete-input-details pa-4 pt-0" style="overflow: auto; width: 700px; height:calc(100% - 80px);">
            <div v-if="!(isGPTMode && panelName == 'gpt-user-task-panel')" class="mt-4">
                <ValidationField v-if="checkValidation()" :validation="checkValidation()"></ValidationField>
                <div class="mb-3">{{ $t('BpmnPropertyPanel.role') }}: {{ role.name }}</div>
            </div>
            <component
                :is="panelName"
                :isViewMode="isViewMode"
                :isPreviewMode="isPreviewMode"
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
            <v-dialog v-if="isViewMode" v-model="printDialog" max-width="800px">
                <template v-slot:activator="{ on, attrs }">
                    <v-btn block color="primary" class="panel-download-btn" v-bind="attrs" v-on="on" @click="printDocument">
                        {{ $t('BpmnPropertyPanel.printDocument') }}
                    </v-btn>
                </template>
                <v-card>
                    <v-card-title class="headline">{{ $t('BpmnPropertyPanel.pdfPreview') }}</v-card-title>
                    <v-card-text >
                        <PDFPreviewer :element="html" @closeDialog="printDialog = false" />
                    </v-card-text>
                </v-card>
            </v-dialog>
        </v-card-text>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import ValidationField from '@/components/designer/bpmnModeling/bpmn/panel/ValidationField.vue';
import PDFPreviewer from '@/components/PDFPreviewer.vue';

export default {
    name: 'bpmn-property-panel',
    props: {
        element: Object,
        processDefinition: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        isPreviewMode: Boolean,
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
        ValidationField,
        PDFPreviewer
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
            role: {},
            printDialog: false,
            html: ''
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;

        // this.$refs.cursor.focus();
    },
    computed: {
        mode() {
            return window.$mode;
        },
        isGPTMode() {
            return this.mode == 'ProcessGPT';
        },
        isPALMode() {
            return window.$pal;
        },
        panelName() {
            var type = _.kebabCase(this.element.$type.split(':')[1])
            if(type.indexOf('task') > -1 && this.isPALMode) {
                type = 'pal-user-task';
            }
            if (this.isGPTMode) {
                if(type == 'user-task' || type == 'script-task') {
                    type = 'gpt-' + type;
                }
            }
            if(type.indexOf('gateway') > -1) {
                type = 'gateway';
            }
            return type + '-panel';
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
        printDocument() {
            var me = this;
            me.html = me.saveHTML();
            me.printDialog = true;
        },
        saveHTML() {
            const panelElement = document.querySelector("#property-panel");
            
            return panelElement;
        },
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
        
        addCheckpoint() {
            this.uengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
        },
        async save() {
            if(window.$pal && this.isViewMode) {
                this.$emit('close');
                return;
            }
            if (this.$refs.panelComponent && this.$refs.panelComponent.beforeSave) {
                await this.$refs.panelComponent.beforeSave();
                console.log(this.uengineProperties)
            }

            const modeling = this.bpmnModeler.get('modeling');
            const elementRegistry = this.bpmnModeler.get('elementRegistry');
            const task = elementRegistry.get(this.element.id);
            const name = this.name;

            const json = JSON.stringify(this.uengineProperties);
            
            const elementCopyDeep = _.cloneDeep(this.elementCopy);
            if(task) {
                modeling.updateProperties(task, { name: name });
            } else {
                this.$emit('close');
            }
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

<style>
</style>

