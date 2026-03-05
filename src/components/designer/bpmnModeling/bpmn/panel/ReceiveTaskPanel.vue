<template>
    <div>
        <v-checkbox v-model="isEmailActivity" :label="$t('ReceiveTaskPanel.emailActivity')"></v-checkbox>
        <div v-if="!isEmailActivity">
            <div v-if="inputData.length > 0" style="margin-bottom: 20px">
                <div style="margin-bottom: -8px">{{ $t('BpmnPropertyPanel.inputData') }}</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(inputData, idx) in inputData" :key="idx" class="mr-2 mt-2">
                        <v-chip
                            v-if="inputData.mandatory"
                            color="primary"
                            variant="outlined"
                            class="text-body-2"
                            @click="deleteInputData(inputData)"
                        >
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2" variant="outlined" @click="deleteInputData(inputData)">
                            {{ inputData.key }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div v-if="outputData.length > 0" style="margin-bottom: 20px">
                <div style="margin-bottom: -8px">{{ $t('BpmnPropertyPanel.outputData') }}</div>
                <v-row class="ma-0 pa-0">
                    <div v-for="(output, idx) in outputData" :key="idx" class="mr-2 mt-2">
                        <v-chip
                            v-if="output.mandatory"
                            color="primary"
                            class="text-body-2"
                            variant="outlined"
                            @click="deleteOutputData(output)"
                        >
                            {{ output.variable.name }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                        <v-chip v-else class="text-body-2" variant="outlined" @click="deleteOutputData(output)">
                            {{ output.variable.name }}
                            <CircleXIcon class="ml-2" start size="20" />
                        </v-chip>
                    </div>
                </v-row>
            </div>
            <div>
                <v-row class="ma-0 pa-0">
                    <v-text-field v-model="copyUengineProperties.uriTemplate" :label="$t('ReceiveTaskPanel.callUri')"></v-text-field>
                </v-row>
                <v-row class="ma-0 pa-0 mb-4">
                    <v-checkbox
                        v-if="copyUengineProperties.uriTemplate && copyUengineProperties.uriTemplate.indexOf('https://') == 0"
                        v-model="copyUengineProperties.noValidationForSSL"
                        :label="$t('ReceiveTaskPanel.noValidationForSSL')"
                    ></v-checkbox>
                </v-row>
                <v-row class="ma-0 pa-0 mb-4">
                    <v-select
                        v-if="links"
                        v-model="copyUengineProperties.uriTemplate"
                        :items="links"
                        item-text="link.link"
                        item-value="link.href"
                        :label="$t('ReceiveTaskPanel.selectService')"
                    ></v-select>
                </v-row>
                <v-row class="ma-0 pa-0 mb-4">
                    <v-select v-model="copyUengineProperties.method" :items="methodList" label="호출 메서드"></v-select>
                </v-row>
                <v-row class="ma-0 pa-0 mb-4">
                    <v-textarea
                        v-if="'GET,DELETE'.indexOf(copyUengineProperties.method) == -1"
                        v-model="copyUengineProperties.inputPayloadTemplate"
                        :label="$t('ReceiveTaskPanel.inputData')"
                        dense
                    ></v-textarea>
                </v-row>
                <!-- <v-row class="ma-0 pa-0">
                    <div>{{ $t('BpmnPropertyPanel.checkPoints') }}</div>
                    <bpmn-parameter-contexts :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts>
                </v-row> -->
                <v-btn block text rounded color="primary" variant="flat" class="my-3" @click="isOpenFieldMapper = !isOpenFieldMapper">{{ $t('ReceiveTaskPanel.dataMapping') }}</v-btn>
                <v-row class="ma-0 pa-0 mb-4">
                    <v-checkbox
                        v-model="copyUengineProperties.skipIfNotFound"
                        :label="$t('ReceiveTaskPanel.skipIfNotFound')"
                    ></v-checkbox>
                </v-row>
            </div>
        </div>
        <div v-else>
            <div>{{ $t('ReceiveTaskPanel.title') }}</div>
            <v-row class="ma-0 pa-0 mb-2 mb-4">
                <v-text-field v-model="copyUengineProperties.title" :label="$t('ReceiveTaskPanel.descriptionTitle')"></v-text-field>
            </v-row>
            <div>{{ $t('ReceiveTaskPanel.content') }}</div>
            <v-row class="ma-0 pa-0 mb-4">
                <v-textarea v-model="copyUengineProperties.contents" :label="$t('ReceiveTaskPanel.descriptionContent')"></v-textarea>
            </v-row>
            <div>{{ $t('ReceiveTaskPanel.to') }}</div>
            <v-row class="ma-0 pa-0 mb-4">
                <v-text-field v-model="copyUengineProperties.to" :label="$t('ReceiveTaskPanel.descriptionTo')"></v-text-field>
            </v-row>
            <div>{{ $t('ReceiveTaskPanel.from') }}</div>
            <v-row class="ma-0 pa-0 mb-4">
                <v-text-field v-model="copyUengineProperties.from" :label="$t('ReceiveTaskPanel.descriptionFrom')"></v-text-field>
            </v-row>
            <v-btn block text rounded color="primary" variant="flat" class="my-3" @click="isOpenFieldMapper = !isOpenFieldMapper">{{ $t('ReceiveTaskPanel.dataMapping') }}</v-btn>
        </div>
        <!-- Lead Time -->
        <div class="mt-4">
            <LeadTimeInput
                v-model="copyUengineProperties.leadTime"
                :label="$t('leadTime.title') || 'Lead Time'"
                :disabled="isViewMode"
            />
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

        <v-dialog
            v-model="isOpenFieldMapper"
            max-width="80%"
            max-height="80%"
            class="mapper-dialog"
            @afterLeave="$refs.mapper && $refs.mapper.saveFormMapperJson()"
        >
            <mapper
                ref="mapper"
                :name="name"
                :definition="copyDefinition"
                :formMapperJson="formMapperJson"
                :expandableTrees="nodes"
                :replaceFromExpandableNode="replaceFromExpandableNode"
                :replaceToExpandableNode="replaceToExpandableNode"
                @saveFormMapperJson="saveMapperJson"
                @closeFormMapper="isOpenFieldMapper = !isOpenFieldMapper"
            />
        </v-dialog>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import { Icon } from '@iconify/vue';
import Mapper from '@/components/designer/mapper/Mapper.vue';
import KeyValueField from '@/components/designer/KeyValueField.vue';
import LeadTimeInput from './LeadTimeInput.vue';
import yaml from 'yamljs';

export default {
    name: 'receive-task-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        definition: Object,
        element: Object
    },
    components: {
        Mapper,
        KeyValueField,
        LeadTimeInput
    },
    created() {
        if(!this.copyUengineProperties.customProperties) this.copyUengineProperties.customProperties = [];
    },
    data() {
        return {
            formMapperJson: '',
            methodList: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
            copyUengineProperties: this.uengineProperties ? JSON.parse(JSON.stringify(this.uengineProperties)) : {},
            name: '',
            checkpoints: [],
            editCheckpoint: false,
            checkpointMessage: {
                $type: 'uengine:Checkpoint',
                checkpoint: ''
            },
            isEmailActivity: false,
            copyDefinition: null,
            code: '',
            description: '',
            selectedDefinition: '',
            bpmnModeler: null,
            stroage: null,
            editParam: false,
            paramKey: '',
            paramValue: '',
            links: ['/* 기존 eureka 서비스 목록 */'],
            isOpenFieldMapper: false,
            replaceFromExpandableNode: null,
            replaceToExpandableNode: null,
            nodes: {},
            openAPI: '',
            // Color picker
            showColorPicker: false,
            customColor: '#e0f7fa',
            presetColors: [
                { name: 'Light Cyan', value: '#e0f7fa' },
                { name: 'Light Yellow', value: '#fdf2d0' },
                { name: 'Light Blue', value: '#e3f2fd' },
                { name: 'Light Green', value: '#e8f5e9' },
                { name: 'Light Purple', value: '#f3e5f5' },
                { name: 'Light Orange', value: '#fff3e0' },
                { name: 'Light Pink', value: '#fce4ec' },
                { name: 'Light Red', value: '#ffebee' },
                { name: 'Light Gray', value: '#f5f5f5' },
                { name: 'White', value: '#ffffff' }
            ]
        };
    },
    async mounted() {
        let me = this;

        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        me.copyDefinition = me.definition;
        this.nodes['test'] = {
            text: 'test',
            children: [],
            parent: null
        };
        let instanceNodes = [
            'instanceId',
            'name',
            'locale',
            'status',
            'info',
            'dueDate',
            'mainProcessInstanceId',
            'mainActivityTracingTag',
            'rootProcessInstanceId',
            'ext1',
            'ext2',
            'ext3',
            'ext4',
            'ext5'
        ];

        if (this.nodes['test']) {
            this.nodes['test'].children = [];
            instanceNodes.forEach((node) => {
                this.nodes['test'].children.push(node);
            });
        }
        let def = this.bpmnModeler.getDefinitions();
        let target = null;
        def.rootElements.forEach((element) => {
            if (element.$type == 'bpmn:Collaboration') {
                element.messageFlows.forEach((messageFlow) => {
                    if (messageFlow.sourceRef.id == this.element.id) {
                        target = messageFlow.targetRef.id;
                    }
                });
            }
        });

        if (target) {
            let targetElement = this.findElement(def, 'id', target);
            let openAPIInfo = JSON.parse(targetElement.extensionElements.values[0].json);
            this.openAPI = openAPIInfo.openAPI;
            let nativeObject = yaml.parse(this.openAPI);
            console.log(nativeObject);
            let schemas = nativeObject.components.schemas;
            console.log(schemas);

            Object.keys(schemas).forEach((key) => {
                this.nodes[key] = {
                    text: key,
                    children: [],
                    parent: null
                };
                Object.keys(schemas[key].properties).forEach((propertyKey) => {
                    this.nodes[key].children.push(propertyKey);
                    this.nodes[propertyKey] = {
                        text: propertyKey
                    };
                });

                me.replaceFromExpandableNode = function (nodeKey) {
                    if (nodeKey.indexOf(`${key}.`) != -1) {
                        return nodeKey.replace(`${key}.`, `[${key}].`);
                    }
                    
                    return null;
                };

                me.replaceToExpandableNode = function (nodeKey) {
                    if (nodeKey.indexOf(`[${key}].`) != -1) {
                        return nodeKey.replace(`[${key}].`, `${key}.`);
                    }

                    return null;
                };
            });

            me.formMapperJson = JSON.stringify(me.copyUengineProperties.mapperIn, null, 2);
        }
    },
    computed: {
        inputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'IN') result.push(element);
                });
            return result;
        },
        outputData() {
            let params = this.copyUengineProperties.parameters;
            let result = [];
            if (params)
                params.forEach((element) => {
                    if (element.direction == 'OUT') result.push(element);
                });
            return result;
        }
    },

    watch: {
        isEmailActivity(newVal) {
            if (newVal) {
                this.copyUengineProperties._type = 'org.uengine.kernel.LocalEMailActivity';
            }
        }
    },
    methods: {
        findElement(obj, key, id) {
            if (obj.hasOwnProperty(key) && obj[key] === id) {
                return obj;
            }

            for (let prop in obj) {
                if (obj[prop] instanceof Object) {
                    let result = this.findElement(obj[prop], key, id);
                    if (result) {
                        return result;
                    }
                }
            }

            return null;
        },
        deleteInputData(inputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === inputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        deleteOutputData(outputData) {
            const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === outputData.key);
            if (index > -1) {
                this.copyUengineProperties.parameters.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        deleteExtendedProperty(item) {
            const index = this.copyUengineProperties.extendedProperties.findIndex((element) => element.key === item.key);
            if (index > -1) {
                this.copyUengineProperties.extendedProperties.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        saveMapperJson(jsonString) {
            this.formMapperJson = jsonString;
            // this.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
            this.copyUengineProperties.mapperIn = JSON.parse(jsonString);
            // this.$emit('update:uEngineProperties', this.copyUengineProperties);
        },
        deleteCheckPoint(item) {
            const index = this.copyUengineProperties.checkpoints.findIndex((element) => element.checkpoint === item.checkpoint);
            if (index > -1) {
                this.copyUengineProperties.checkpoints.splice(index, 1);
                this.$emit('update:uEngineProperties', this.copyUengineProperties);
            }
        },
        addParameter() {
            this.copyUengineProperties.extendedProperties.push({ key: this.paramKey, value: this.paramValue });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
            // const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            // // this.checkpoints.push(this.checkpointMessage)
            // const parameter = bpmnFactory.create('uengine:ExtendedProperty', { key: this.paramKey, value: this.paramValue });
            // if (!this.elementCopy.extensionElements.values[0].ExtendedProperties) this.elementCopy.extensionElements.values[0].ExtendedProperties = []
            // this.elementCopy.extensionElements.values[0].ExtendedProperties.push(parameter)
            // this.paramKey = ""
            // this.paramValue = ""
        },
        
        addCheckpoint() {
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        },
        beforeSave() {
            this.$emit('update:uengineProperties', this.copyUengineProperties);
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
