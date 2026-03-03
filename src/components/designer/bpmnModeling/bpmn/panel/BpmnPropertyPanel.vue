<template>
    <div id="property-panel" style="overflow: auto;"
        class="is-work-height"
        :class="{ 'view-mode-panel-content': isViewMode, 'pal-view-mode': isViewMode && isPALMode }"
    >
        <v-row class="ma-0 pa-4 pb-0" :class="{ 'view-mode-header': isViewMode }">
            <v-chip v-if="isViewMode" color="info" variant="tonal" size="x-small" class="mr-2">
                <v-icon start size="x-small">mdi-eye</v-icon>
                {{ $t('BpmnPropertyPanel.readOnly') || 'Read Only' }}
            </v-chip>
            <v-card-title v-if="isViewMode" class="pa-0 view-mode-title">{{ name }}</v-card-title>
            <v-combobox v-else-if="!isPALMode && isTaskElement" v-model="name" :label="$t('BpmnPropertyPanel.name')"
                :disabled="isViewMode" ref="cursor"
                :items="termSuggestions"
                :loading="termLoading"
                @update:search="onTermSearch"
                @update:model-value="recordTermUsage"
                hide-no-data
                clearable
                class="bpmn-property-panel-name mb-3 delete-input-details"
            ></v-combobox>
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
            <v-tooltip v-if="!isViewMode && isTaskElement && !isUEngineMode" location="bottom">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" @click="$emit('saveToCatalog')" icon variant="text" density="comfortable" class="panel-close-btn">
                        <v-icon>mdi-folder-plus</v-icon>
                    </v-btn>
                </template>
                <span>{{ $t('taskCatalog.saveToCatalog') || 'Save to Catalog' }}</span>
            </v-tooltip>
            <v-btn v-if="!isViewMode" @click="save" icon variant="text" density="comfortable" class="panel-close-btn">
                <v-icon>mdi-content-save</v-icon>
            </v-btn>
            <v-btn @click="closePanel" icon variant="text" density="comfortable" class="panel-close-btn">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-row>
        <v-card-text
            class="delete-input-details pa-0 pr-4 pl-4"
            :style="isViewMode ? 'overflow: auto; flex: 1;' : 'overflow: auto; width: 50vw; min-width: 370px; height:calc(100% - 80px);'"
        >
            <div v-if="!(isGPTMode && panelName == 'gpt-user-task-panel')" :class="isViewMode ? 'pa-2 pb-0' : 'pa-4 pb-0'">
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
                :isForCompensation="isForCompensation"
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

            <!-- Zeebe Properties Panel (Camunda 8) -->
            <ZeebePropertiesPanel
                v-if="hasZeebeProperties"
                :uengineProperties="uengineProperties"
                :elementType="element.$type"
                :isViewMode="isViewMode"
                ref="zeebePanel"
                @update:uengineProperties="(newProps) => (uengineProperties = newProps)"
            />

            <v-dialog
                v-if="isViewMode"
                v-model="printDialog"
                max-width="1150px"
                max-height="80vh"
            >
                <template v-slot:activator="{ props }">
                    <v-btn block color="primary" class="panel-download-btn" v-bind="props" @click="printDocument">
                        {{ $t('BpmnPropertyPanel.printDocument') }}
                    </v-btn>
                </template>
                <v-card style="max-height: 80vh; display: flex; flex-direction: column;">
                    <v-card-title class="headline">{{ $t('BpmnPropertyPanel.pdfPreview') }}</v-card-title>
                    <v-card-text style="flex: 1; overflow: auto;">
                        <PDFPreviewer ref="pdfPreviewer" :element="html" :name="name" />
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn color="primary" text @click="$refs.pdfPreviewer.saveDocument()">
                            {{ $t('PDFPreviewer.saveDocument') }}
                        </v-btn>
                        <v-btn color="error" text @click="printDialog = false">
                            {{ $t('PDFPreviewer.close') }}
                        </v-btn>
                    </v-card-actions>
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
import ZeebePropertiesPanel from '@/components/designer/bpmnModeling/bpmn/panel/ZeebePropertiesPanel.vue';
import { useTerminology } from '@/composables/useTerminology';

import BusinessRuleTaskPanel from '@/components/designer/bpmnModeling/bpmn/panel/BusinessRuleTaskPanel.vue';

export default {
    name: 'bpmn-property-panel',
    emits: ['close', 'addUengineVariable', 'saveToCatalog'],
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
        const extensionElement = this.element.extensionElements.values[0];
        const json = extensionElement.json;
        if( json ) {
            this.uengineProperties = JSON.parse(json);
        }

        // customProperties 복원
        if (extensionElement.variables && extensionElement.variables.length > 0) {
            this.uengineProperties.customProperties = extensionElement.variables.map(variable => {
                return {
                    key: variable.key,
                    value: variable.value
                };
            });
        }

        // Zeebe 속성 마이그레이션 (extension elements -> uengineProperties.zeebe)
        this.migrateZeebeProperties();
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
        PDFPreviewer,
        BusinessRuleTaskPanel,
        ZeebePropertiesPanel
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
            componentKey: 0,
            eventBusListener: null,
            // 용어 자동완성 관련
            termSuggestions: [],
            termLoading: false,
            allTerms: [],
            menu: false
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;

        // BPMN 모델 변경 이벤트 리스너 추가
        // this.setupModelChangeListener();

        // 템플릿 목록 불러오기
        if (this.isPALMode) {
            await this.loadTaskList();
        }

        // 용어 자동완성 로드 (Task 요소인 경우)
        if (this.isTaskElement && !this.isPALMode) {
            await this.loadTerminology();
        }

        // this.$refs.cursor.focus();
    },
    beforeUnmount() {
        // 이벤트 리스너 정리
        this.removeModelChangeListener();
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
        isUEngineMode() {
            return window.$mode === 'uEngine';
        },
        panelName() {
            var type = _.kebabCase(this.element.$type.split(':')[1])
            if(type.indexOf('task') > -1 && this.isPALMode) {
                type = 'pal-user-task';
            }
            if (this.isGPTMode) {
                if(type == 'user-task' || type == 'script-task' || type == 'service-task' || type == 'task' || type == 'lane') {
                    type = 'gpt-' + type;
                }
            }
            if(type.indexOf('gateway') > -1) {
                type = 'gateway';
            }
            return type + '-panel';
        },
        isForCompensation() {
            if(!this.element) return false;
            return this.element.isForCompensation ? true : false;
        },
        isTaskElement() {
            const type = this.element?.$type || '';
            return type.includes('Task') || type.includes('Activity');
        },
        hasZeebeProperties() {
            if (!this.element || !this.element.extensionElements || !this.element.extensionElements.values) {
                return false;
            }
            return this.element.extensionElements.values.some(ext => {
                const type = ext.$type || '';
                return type.startsWith('zeebe:');
            });
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
            }
            // Zeebe 패널 저장
            if (this.$refs.zeebePanel && this.$refs.zeebePanel.beforeSave) {
                await this.$refs.zeebePanel.beforeSave();
            }
            const modeling = this.bpmnModeler.get('modeling');
            const elementRegistry = this.bpmnModeler.get('elementRegistry');
            const task = elementRegistry.get(this.element.id);
            const name = this.name;

            const json = JSON.stringify(this.uengineProperties);
            const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            
            // customProperties 처리
            let variables = [];
            if (this.uengineProperties.customProperties && Array.isArray(this.uengineProperties.customProperties)) {
                variables = this.uengineProperties.customProperties
                    .filter(prop => prop.key && prop.key.trim() !== '') // 빈 키 필터링
                    .map(prop => {
                        return bpmnFactory.create('uengine:Variable', {
                            key: prop.key,
                            value: prop.value,
                            json: '{}'
                        });
                    });
            }

            // // uengineProperties에서 customProperties 제거 (json에는 포함되지 않도록)
            // const propertiesToSave = { ...this.uengineProperties };
            // delete propertiesToSave.customProperties;
            // const json = JSON.stringify(propertiesToSave);
            
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

            // ExtensionElements 처리
            let extensionElements = task.businessObject.extensionElements;
            let values = [];

            if (extensionElements && extensionElements.values) {
                // 기존 값들 중 uengine:Properties가 아닌 것들은 유지
                values = extensionElements.values.filter(value => value.$type !== 'uengine:Properties');
            }

            // 새로운 uengine:Properties 생성
            const uengineProps = bpmnFactory.create('uengine:Properties', {
                json: json,
                variables: variables
            });
            values.push(uengineProps);

            // 새로운 ExtensionElements 생성
            const newExtensionElements = bpmnFactory.create('bpmn:ExtensionElements', {
                values: values
            });

            if (this.elementCopy.text) elementCopyDeep.text = this.text;

            modeling.updateProperties(task, {
                extensionElements: newExtensionElements
            });

            this.$emit('close');

            console.log(task.businessObject.extensionElements.values[0]);
        },
        setupModelChangeListener() {
            if (!this.bpmnModeler) return;

            const eventBus = this.bpmnModeler.get('eventBus');
            
            // BPMN 요소 변경 이벤트 리스너 설정
            this.eventBusListener = (event) => {
                // 현재 패널이 열려있는 요소와 변경된 요소가 같은지 확인
                if (event.element && event.element.id === this.element.id) {
                    // 이름이 변경된 경우 입력 필드 업데이트
                    if (event.element.businessObject.name !== this.name) {
                        console.log('BPMN 모델 이름이 변경되었습니다:', event.element.businessObject.name);
                        this.name = event.element.businessObject.name || '';
                    }
                }
            };

            // 'element.changed' 이벤트 리스닝
            eventBus.on('element.changed', this.eventBusListener);
        },
        removeModelChangeListener() {
            if (this.bpmnModeler && this.eventBusListener) {
                const eventBus = this.bpmnModeler.get('eventBus');
                eventBus.off('element.changed', this.eventBusListener);
                this.eventBusListener = null;
            }
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
        },
        // 용어 자동완성 관련 메서드
        async loadTerminology() {
            this.termLoading = true;
            try {
                const { loadTerminology } = useTerminology();
                this.allTerms = await loadTerminology('task_name');
                this.termSuggestions = this.allTerms.slice(0, 10).map(t => t.term);
            } catch (error) {
                console.warn('용어 로드 실패:', error);
                this.allTerms = [];
                this.termSuggestions = [];
            } finally {
                this.termLoading = false;
            }
        },
        onTermSearch(searchText) {
            if (!searchText || searchText.trim() === '') {
                this.termSuggestions = this.allTerms.slice(0, 10).map(t => t.term);
                return;
            }
            const lowered = searchText.toLowerCase();
            this.termSuggestions = this.allTerms
                .filter(t => t.term.toLowerCase().includes(lowered))
                .slice(0, 10)
                .map(t => t.term);
        },
        async recordTermUsage(term) {
            try {
                const { recordUsage } = useTerminology();
                await recordUsage('task_name', term);
            } catch (error) {
                console.warn('용어 사용 기록 실패:', error);
            }
        },
        closePanel() {
            this.$emit('close');
        },
        migrateZeebeProperties() {
            if (!this.element || !this.element.extensionElements || !this.element.extensionElements.values) {
                return;
            }

            const extensionElements = this.element.extensionElements.values;
            const hasZeebe = extensionElements.some(ext => (ext.$type || '').startsWith('zeebe:'));

            if (!hasZeebe) {
                return;
            }

            // Initialize zeebe structure if not exists
            if (!this.uengineProperties.zeebe) {
                this.uengineProperties.zeebe = {
                    taskDefinition: { type: '', retries: '3' },
                    formDefinition: { formId: '', formKey: '' },
                    assignmentDefinition: { assignee: '', candidateGroups: '', candidateUsers: '' },
                    priorityDefinition: { priority: '' },
                    taskSchedule: { dueDate: '', followUpDate: '' },
                    calledDecision: { decisionId: '', resultVariable: '' },
                    calledElement: { processId: '', propagateAllChildVariables: false },
                    script: { expression: '', resultVariable: '' },
                    ioMapping: { inputs: [], outputs: [] },
                    taskHeaders: [],
                    executionListeners: [],
                    taskListeners: [],
                    properties: []
                };
            }

            // Extract Zeebe properties from extension elements
            extensionElements.forEach(ext => {
                const type = ext.$type || '';

                if (type === 'zeebe:TaskDefinition') {
                    this.uengineProperties.zeebe.taskDefinition = {
                        type: ext.type || '',
                        retries: ext.retries || '3'
                    };
                }
                else if (type === 'zeebe:FormDefinition') {
                    this.uengineProperties.zeebe.formDefinition = {
                        formId: ext.formId || '',
                        formKey: ext.formKey || ''
                    };
                }
                else if (type === 'zeebe:AssignmentDefinition') {
                    this.uengineProperties.zeebe.assignmentDefinition = {
                        assignee: ext.assignee || '',
                        candidateGroups: ext.candidateGroups || '',
                        candidateUsers: ext.candidateUsers || ''
                    };
                }
                else if (type === 'zeebe:PriorityDefinition') {
                    this.uengineProperties.zeebe.priorityDefinition = {
                        priority: ext.priority || ''
                    };
                }
                else if (type === 'zeebe:TaskSchedule') {
                    this.uengineProperties.zeebe.taskSchedule = {
                        dueDate: ext.dueDate || '',
                        followUpDate: ext.followUpDate || ''
                    };
                }
                else if (type === 'zeebe:CalledDecision') {
                    this.uengineProperties.zeebe.calledDecision = {
                        decisionId: ext.decisionId || '',
                        resultVariable: ext.resultVariable || ''
                    };
                }
                else if (type === 'zeebe:CalledElement') {
                    this.uengineProperties.zeebe.calledElement = {
                        processId: ext.processId || '',
                        propagateAllChildVariables: ext.propagateAllChildVariables === true || ext.propagateAllChildVariables === 'true'
                    };
                }
                else if (type === 'zeebe:Script') {
                    this.uengineProperties.zeebe.script = {
                        expression: ext.expression || '',
                        resultVariable: ext.resultVariable || ''
                    };
                }
                else if (type === 'zeebe:IoMapping') {
                    const inputs = [];
                    const outputs = [];

                    if (ext.inputParameters) {
                        ext.inputParameters.forEach(inp => {
                            inputs.push({ source: inp.source || '', target: inp.target || '' });
                        });
                    }
                    if (ext.outputParameters) {
                        ext.outputParameters.forEach(out => {
                            outputs.push({ source: out.source || '', target: out.target || '' });
                        });
                    }

                    this.uengineProperties.zeebe.ioMapping = { inputs, outputs };
                }
                else if (type === 'zeebe:TaskHeaders') {
                    const headers = [];
                    if (ext.values) {
                        ext.values.forEach(h => {
                            headers.push({ key: h.key || '', value: h.value || '' });
                        });
                    }
                    this.uengineProperties.zeebe.taskHeaders = headers;
                }
                else if (type === 'zeebe:ExecutionListeners') {
                    const listeners = [];
                    if (ext.executionListeners) {
                        ext.executionListeners.forEach(l => {
                            listeners.push({
                                eventType: l.eventType || 'start',
                                type: l.type || '',
                                retries: l.retries || '3'
                            });
                        });
                    }
                    this.uengineProperties.zeebe.executionListeners = listeners;
                }
                else if (type === 'zeebe:TaskListeners') {
                    const listeners = [];
                    if (ext.taskListeners) {
                        ext.taskListeners.forEach(l => {
                            listeners.push({
                                eventType: l.eventType || 'creating',
                                type: l.type || '',
                                retries: l.retries || '3'
                            });
                        });
                    }
                    this.uengineProperties.zeebe.taskListeners = listeners;
                }
                else if (type === 'zeebe:Properties') {
                    const props = [];
                    if (ext.properties) {
                        ext.properties.forEach(p => {
                            props.push({ name: p.name || '', value: p.value || '' });
                        });
                    }
                    this.uengineProperties.zeebe.properties = props;
                }
            });
        }
    }
};
</script>

<style>
/* ============================================
   View Mode Panel Styles - Compact
   ============================================ */
.view-mode-panel-content {
    background: #ffffff;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.view-mode-panel-content > .v-row:first-child {
    flex-shrink: 0;
}

.view-mode-panel-content > .v-card-text {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 12px !important;
}

/* View Mode Header */
.view-mode-header {
    background: linear-gradient(to right, #f8fafc, #ffffff);
    border-bottom: 1px solid #e2e8f0;
    padding: 4px 10px !important;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    min-height: 36px !important;
    max-height: 36px !important;
}

.view-mode-title {
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    font-size: 0.85rem !important;
    font-weight: 600 !important;
    color: #1e293b;
    line-height: 1.2;
    padding: 0 !important;
    margin: 0 !important;
}

.view-mode-header .v-chip {
    height: 20px !important;
    font-size: 0.7rem !important;
    font-weight: 600;
    background: rgba(99, 102, 241, 0.1) !important;
    color: #6366f1 !important;
}

.view-mode-header .panel-close-btn {
    width: 24px !important;
    height: 24px !important;
}

.view-mode-header .panel-close-btn .v-icon {
    font-size: 16px !important;
}

/* Keep tabs interactive in view mode for navigation */
.view-mode-panel-content .v-tabs {
    pointer-events: auto !important;
}

.view-mode-panel-content .v-tabs .v-tab {
    pointer-events: auto !important;
}

/* Disable form inputs in view mode */
.view-mode-panel-content .v-text-field .v-field,
.view-mode-panel-content .v-textarea .v-field,
.view-mode-panel-content .v-select .v-field,
.view-mode-panel-content .v-autocomplete .v-field,
.view-mode-panel-content .v-radio-group,
.view-mode-panel-content .v-checkbox,
.view-mode-panel-content .v-switch,
.view-mode-panel-content .v-slider {
    pointer-events: none !important;
}

/* Hide action buttons in view mode */
.view-mode-panel-content .v-window-item .v-btn:not(.panel-close-btn):not(.panel-download-btn) {
    display: none !important;
}

/* Keep header buttons visible */
.view-mode-panel-content .panel-close-btn {
    display: inline-flex !important;
    pointer-events: auto !important;
}

/* Keep print/download button visible in view mode */
.view-mode-panel-content .panel-download-btn {
    display: flex !important;
    pointer-events: auto !important;
    margin-top: 16px;
}

/* Make disabled fields look clean */
.view-mode-panel-content .v-field--disabled,
.view-mode-panel-content .v-field {
    opacity: 1 !important;
}

.view-mode-panel-content .v-field__input,
.view-mode-panel-content .v-field textarea {
    color: #1e293b !important;
    -webkit-text-fill-color: #1e293b !important;
}

/* Hide interactive UI elements in view mode */
.view-mode-panel-content .v-field__append-inner .v-icon,
.view-mode-panel-content .v-field__clearable {
    display: none !important;
}

/* View mode cards */
.view-mode-panel-content .v-card {
    box-shadow: none !important;
    border: 1px solid #e2e8f0 !important;
    background: #f8fafc;
}

/* Compact spacing */
.view-mode-panel-content .mb-6 {
    margin-bottom: 8px !important;
}

.view-mode-panel-content .mt-6 {
    margin-top: 8px !important;
}

.view-mode-panel-content .pa-4,
.view-mode-panel-content .pa-2 {
    padding: 6px !important;
}

/* Spacing adjustments for view mode */
.view-mode-panel-content .mb-4 {
    margin-bottom: 12px !important;
}

/* Section labels in view mode */
.view-mode-panel-content .text-subtitle-1,
.view-mode-panel-content .text-subtitle-2 {
    color: #6366f1;
}

/* Role display styling */
.view-mode-panel-content .mb-3 {
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    font-size: 0.8125rem;
    color: #475569;
    padding: 8px 12px;
    background: #f1f5f9;
    border-radius: 8px;
    margin-bottom: 4px !important;
}

/* Hide print button in compact view */
.view-mode-panel-content:not(.pal-view-mode) .panel-download-btn {
    display: none !important;
}
.view-mode-panel-content.pal-view-mode .panel-download-btn {
    display: inline-flex !important;
}

/* Compact input fields */
.view-mode-panel-content .v-input {
    margin-bottom: 4px !important;
}

.view-mode-panel-content .v-field {
    font-size: 0.875rem;
}
</style>

