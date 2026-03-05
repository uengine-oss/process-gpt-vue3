<template>
    <div>
        <div class="included" style="margin-bottom: 22px">
            <div style="margin-bottom: 8px">
                {{ $t('CallActivityPanel.selectDefinition') }}
                <v-btn @click="moveDefinition()" text rounded color="secondary" variant="flat" density="compact" class="ml-2">
                    {{ $t('CallActivityPanel.move') }}
                </v-btn>
            </div>
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
                    <div class="mb-1 mt-4">{{$t('SubProcessPanel.forEachVariable')}}</div>
                </v-row>
                <v-row class="ma-0 pa-0 align-center pb-4">
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
                    <DetailComponent class="ml-2"
                        :title="$t('SubProcessPanel.forEachVariableDescriptionTitle')"
                        :details="forEachVariableDescription"
                        :iconSize="24"
                    />
                </v-row>
            </div>
            <div>
                <v-row class="ma-0 pa-0">
                    <div>{{ $t('CallActivityPanel.parameterContext') }}</div>
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
                    <div>{{ $t('CallActivityPanel.roleMapping') }}</div>
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
            <v-row> {{ $t('CallActivityPanel.noDefinitionSelected') }} </v-row>
        </div>
        <div class="mt-3">
            <KeyValueField
                v-model="copyUengineProperties.customProperties"
                :label="$t('BpmnPropertyPanel.customProperties') || '사용자 속성'"
                :readonly="isViewMode"
            />
        </div>

        <!-- Task Color Picker -->
        <div class="mt-4">
            <div class="text-subtitle-2 mb-2">{{ $t('BpmnPropertyPanel.taskColor') || '작업 색상' }}</div>
            <div class="d-flex flex-wrap gap-2 mb-3">
                <v-btn v-for="color in presetColors" :key="color.value" :style="{ backgroundColor: color.value, border: copyUengineProperties.taskColor === color.value ? '3px solid #1976D2' : '1px solid #ccc' }" size="small" icon :disabled="isViewMode" @click="setTaskColor(color.value)">
                    <v-icon v-if="copyUengineProperties.taskColor === color.value" size="small" color="white">mdi-check</v-icon>
                </v-btn>
            </div>
            <v-row class="ma-0 pa-0 align-center">
                <v-menu v-model="showColorPicker" :close-on-content-click="false" location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" :disabled="isViewMode" variant="outlined" size="small" class="mr-2">
                            <v-icon start size="small">mdi-palette</v-icon>{{ $t('BpmnPropertyPanel.customColor') || '사용자 정의 색상' }}
                        </v-btn>
                    </template>
                    <v-card min-width="300">
                        <v-color-picker v-model="customColor" mode="hexa" hide-inputs></v-color-picker>
                        <v-card-actions>
                            <v-btn size="small" @click="showColorPicker = false">{{ $t('common.cancel') || '취소' }}</v-btn>
                            <v-btn size="small" color="primary" @click="applyCustomColor">{{ $t('common.confirm') || '적용' }}</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-menu>
                <v-btn v-if="copyUengineProperties.taskColor" variant="text" size="small" color="error" :disabled="isViewMode" @click="resetTaskColor">
                    <v-icon size="small">mdi-close</v-icon>{{ $t('BpmnPropertyPanel.resetColor') || '초기화' }}
                </v-btn>
            </v-row>
            <div v-if="copyUengineProperties.taskColor" class="mt-2 d-flex align-center">
                <div :style="{ backgroundColor: copyUengineProperties.taskColor, width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #ccc' }" class="mr-2"></div>
                <span class="text-caption">{{ copyUengineProperties.taskColor }}</span>
            </div>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue';
import KeyValueField from '@/components/designer/KeyValueField.vue';


export default {
    name: 'call-activity-panel',
    components: {
        ProcessDefinitionDisplay,
        KeyValueField
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        processVariables: Array,
        element: Object
    },
    created() {
        if (this.uengineProperties) {
            this.copyUengineProperties = JSON.parse(JSON.stringify(this.uengineProperties));
        } else {
            this.copyUengineProperties = {};
        }
        // console.log(this.element)
        // this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        Object.keys(this.requiredKeyLists).forEach((key) => {
            this.ensureKeyExists(this.copyUengineProperties, key, this.requiredKeyLists[key]);
        });
        if(!this.copyUengineProperties.customProperties) this.copyUengineProperties.customProperties = [];
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
            definitionRoles: [],
            calleeDefinitionRoles: [],
            copyUengineProperties: this.uengineProperties ? JSON.parse(JSON.stringify(this.uengineProperties)) : {},
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
            selectedVariable: null,
            showColorPicker: false,
            customColor: '#fce4ec',
            presetColors: [
                { name: 'Light Pink', value: '#fce4ec' },
                { name: 'Light Yellow', value: '#fdf2d0' },
                { name: 'Light Blue', value: '#e3f2fd' },
                { name: 'Light Green', value: '#e8f5e9' },
                { name: 'Light Purple', value: '#f3e5f5' },
                { name: 'Light Orange', value: '#fff3e0' },
                { name: 'Light Cyan', value: '#e0f7fa' },
                { name: 'Light Red', value: '#ffebee' },
                { name: 'Light Gray', value: '#f5f5f5' },
                { name: 'White', value: '#ffffff' }
            ]
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
        
        if (this.copyUengineProperties.forEachVariable) {
            this.selectedVariable = this.copyUengineProperties.forEachVariable.name;
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
        moveDefinition(){
            if(!this.copyUengineProperties.definitionId) return;
            window.open(`/definitions/${this.copyUengineProperties.definitionId.replace('.bpmn', '')}`, '_blank');
        },
        async beforeSave() {
            const backend = BackendFactory.createBackend();
            if(this.copyUengineProperties.definitionId) {
                let result = await backend.getDefinitionVersions(this.copyUengineProperties.definitionId.replace('.bpmn', ''), {
                    key: 'version, message',
                    sort: 'asc',
                    orderBy: 'timeStamp',
                    type: 'bpmn'
                });
                if(result) {
                    this.lists = result.map(item => ({ ...item, xml: null }));
                    this.copyUengineProperties.version = this.lists[this.lists.length - 1].version;
                } else {
                    delete this.copyUengineProperties.version;
                }
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
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
            const backend = BackendFactory.createBackend();
            if(!definitionId) return;
            // definition 정보 호출
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
            bpmnXml = bpmnXml.replace(/\$type/g, '_type'); //sanitizing for $type
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
        },
        setTaskColor(color) {
            this.copyUengineProperties.taskColor = color;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.refreshTaskVisual();
        },
        applyCustomColor() {
            this.copyUengineProperties.taskColor = this.customColor;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.showColorPicker = false;
            this.refreshTaskVisual();
        },
        resetTaskColor() {
            delete this.copyUengineProperties.taskColor;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.refreshTaskVisual();
        },
        refreshTaskVisual() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (modeler) {
                try {
                    const elementRegistry = modeler.get('elementRegistry');
                    const graphicsFactory = modeler.get('graphicsFactory');
                    const element = elementRegistry.get(this.element?.id);
                    if (element) {
                        const gfx = elementRegistry.getGraphics(element);
                        if (gfx) { graphicsFactory.update('shape', element, gfx); }
                    }
                } catch (e) { console.warn('Could not refresh task visual:', e); }
            }
        }
    }
};
</script>
