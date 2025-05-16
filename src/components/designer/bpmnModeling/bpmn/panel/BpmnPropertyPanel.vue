<template>
    <div id="property-panel" style="height: calc(100vh - 131px)">
        <v-row class="ma-0 pa-4 pb-0">
            <v-card-title v-if="isViewMode" class="pa-0">{{ name }}</v-card-title>
            <v-text-field v-else-if="!isPALMode" v-model="name" :label="$t('BpmnPropertyPanel.name')" 
                :disabled="isViewMode" ref="cursor" 
                class="bpmn-property-panel-name mb-3 delete-input-details"
            ></v-text-field>
            <div v-if="!isViewMode && isPALMode" style="position: relative; width: 200px;">
                <v-text-field
                    v-model="name"
                    :label="$t('BpmnPropertyPanel.name')"
                    class="ml-2 mb-3 delete-input-details"
                    @focus="menu = true"
                    @input="onInput"
                    ref="inputRef"
                    autocomplete="off"
                />
                <v-menu
                    v-if="menu && filteredTemplateOptions.length > 0"
                    v-model="menu"
                    :activator="$refs.inputRef"
                    offset-y
                    transition="scale-transition"
                    min-height="0"
                    max-height="200"
                >
                    <v-list>
                        <v-list-item
                            v-for="(item, index) in filteredTemplateOptions"
                            :key="index"
                            @click="selectItem(item)"
                        >
                        <v-list-item-title>{{ item }}</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </div>
            <v-spacer></v-spacer>
            <v-btn @click="save" icon variant="text" density="comfortable" class="panel-close-btn">
                <Icons :icon="'close'" class="cursor-pointer" :size="16"/>
            </v-btn>
        </v-row>
        <v-card-text class="delete-input-details pa-4 pt-0" style="overflow: auto; width: 700px; height:calc(100% - 80px);">
            <div v-if="!(isGPTMode && panelName == 'gpt-user-task-panel')" class="mt-4">
                <ValidationField v-if="checkValidation()" :validation="checkValidation()"></ValidationField>
                <div class="mb-3" v-if="!panelName.includes('sequence-flow')">{{ $t('BpmnPropertyPanel.role') }}: {{ role.name }}</div>
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
                :key="componentKey"
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
                        <PDFPreviewer :element="html" @closeDialog="printDialog = false" :name="name" />
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
import BackendFactory from '@/components/api/BackendFactory';


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
        const json = this.element.extensionElements.values[0].json;
        if( json ) {
            this.uengineProperties = JSON.parse(json);
        }
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
            html: '',
            templateOptions: [],
            taskList: [],
            componentKey: 0
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;

        // 템플릿 목록 불러오기
        if (this.isPALMode) {
            await this.loadTaskList();
        }

        // this.$refs.cursor.focus();
    },
    computed: {
        filteredTemplateOptions() {
            const filtered = this.templateOptions.filter(option => option.includes(this.name));
            return filtered? filtered : [];
        },
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
        },
        async loadTaskList() {
            try {
                const backend = BackendFactory.createBackend();
                this.taskList = await backend.getTaskList();

                // task_name만 추출해서 templateOptions에 저장
                this.templateOptions = (this.taskList || [])
                .map(task => task.name)
                .filter(Boolean); // null/undefined 제거
            } catch (error) {
                console.error('템플릿 목록을 불러오는데 실패했습니다:', error);
            }
        },
        onInput() {
            this.menu = true;
        },
        selectItem(item) {
            this.name = item;
            this.menu = false;
            this.applyTask(); // 원래 있던 동작 유지
        },
        applyTask() {
            // 선택된 값이 템플릿 ID가 아닌 경우 (사용자 직접 입력) 종료
            const selectedTemplate = this.taskList.find(t => t.name === this.name);
            if (!selectedTemplate || !selectedTemplate.json_ko) return;
            
            try {
                const json = selectedTemplate.json_ko;
                let activity = this.processDefinition.activities.find(a => a.id === this.element.id);
                
                if (activity) {
                    // 대상 activity가 존재하면 속성을 복사합니다 (참조를 유지)
                    // 직접 대입하지 않고 개별 속성을 복사
                    Object.keys(json).forEach(key => {
                        activity[key] = json[key];
                    });
                    activity.uuid = json.uuid || activity.uuid;
                    activity.type = selectedTemplate.type || activity.type;
                    
                    // processDefinition 갱신을 위한 이벤트 발생
                    this.$forceUpdate();
                    this.$emit('update:processDefinition', this.processDefinition);
                    this.$emit('process-definition-updated');
                    
                    // 자식 컴포넌트 재렌더링을 위한 트리거
                    this.componentKey++;
                }
            } catch (error) {
                console.error('템플릿 적용 중 오류 발생:', error);
            }
        }
    }
};
</script>

<style>
</style>

