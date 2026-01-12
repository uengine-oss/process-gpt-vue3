<template>
    <div>
        <div class="mb-6 mt-6">
            <div>{{ $t('BpmnPropertyPanel.scriptType') }}</div>
            <v-card variant="outlined" class="pa-2" style="border-radius:8px !important;">
                <v-radio-group v-model="copyUengineProperties.language">
                    <v-radio
                        id="Javascript"
                        name="Javascript"
                        value="0"
                        label="Javascript"
                        style="margin-right: 8px !important; font-size: 15px"
                    ></v-radio>
                    <v-radio id="Java" name="Java" value="1" label="Java" style="margin-right: 8px !important; font-size: 15px"></v-radio>
                </v-radio-group>
                <v-textarea :label="$t('BpmnPropertyPanel.script')" v-model="copyUengineProperties.script" :disabled="isViewMode" style="width: 100%"></v-textarea>
                <GenerateScriptPanel v-model="copyUengineProperties.script" :language="languageLabel" />
                <DetailComponent
                    :title="$t('ScriptTaskPanel.scriptDescriptionTitle')"
                    :detailUrl="'https://bpm-intro.uengine.io/api-customizing/script-task/'"
                />
            </v-card>
        </div>
        <div>
            <v-row class="ma-0 pa-0">
                <v-autocomplete
                    :label="$t('ScriptTaskPanel.return')"
                    :items="processVariables"
                    item-props
                    :item-value="item"
                    :item-title="(item) => item.name"
                    v-model="selectedOut"
                    density="comfortable"
                    variant="outlined"
                ></v-autocomplete>
            </v-row>
        </div>
        <DetailComponent
            style="padding-bottom:20px;"
            :title="$t('ScriptTaskPanel.returnTitle')"
        />
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
                <v-btn
                    v-for="color in presetColors"
                    :key="color.value"
                    :style="{ backgroundColor: color.value, border: copyUengineProperties.taskColor === color.value ? '3px solid #1976D2' : '1px solid #ccc' }"
                    size="small"
                    icon
                    :disabled="isViewMode"
                    @click="setTaskColor(color.value)"
                >
                    <v-icon v-if="copyUengineProperties.taskColor === color.value" size="small" color="white">mdi-check</v-icon>
                </v-btn>
            </div>
            <v-row class="ma-0 pa-0 align-center">
                <v-menu v-model="showColorPicker" :close-on-content-click="false" location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" :disabled="isViewMode" variant="outlined" size="small" class="mr-2">
                            <v-icon start size="small">mdi-palette</v-icon>
                            {{ $t('BpmnPropertyPanel.customColor') || '사용자 정의 색상' }}
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
                    <v-icon size="small">mdi-close</v-icon>
                    {{ $t('BpmnPropertyPanel.resetColor') || '초기화' }}
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
import { Icon } from '@iconify/vue';
import GenerateScriptPanel from './GenerateScriptPanel.vue';
import KeyValueField from '@/components/designer/KeyValueField.vue';

export default {
    name: 'script-task-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        definition: Object,
        element: Object
    },
    components: {
        GenerateScriptPanel,
        KeyValueField
    },
    created() {},
    data() {
        return {
            requiredKeyLists: {},
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
            copyDefinition: this.definition,
            processVariables: [],
            selectedOut: '',
            // Color picker
            showColorPicker: false,
            customColor: '#e8f5e9',
            presetColors: [
                { name: 'Light Green', value: '#e8f5e9' },
                { name: 'Light Yellow', value: '#fdf2d0' },
                { name: 'Light Blue', value: '#e3f2fd' },
                { name: 'Light Purple', value: '#f3e5f5' },
                { name: 'Light Orange', value: '#fff3e0' },
                { name: 'Light Pink', value: '#fce4ec' },
                { name: 'Light Cyan', value: '#e0f7fa' },
                { name: 'Light Red', value: '#ffebee' },
                { name: 'Light Gray', value: '#f5f5f5' },
                { name: 'White', value: '#ffffff' }
            ]
        };
    },
    async mounted() {
        let me = this;
        console.log(this.copyDefinition);
        this.processVariables = this.copyDefinition.processVariables
            .filter((variable) => variable.type !== 'Form')
            .map((variable) => ({
                name: variable.name,
                type: variable.type,
                defaultValue: variable.defaultValue
            }));
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        if(this.copyUengineProperties.out) {
            // let tmp = this.processVariables.find((element) => element['name'] === this.copyUengineProperties.out.name);
            this.selectedOut = this.copyUengineProperties.out.name;
        }
        if(!this.copyUengineProperties.customProperties) this.copyUengineProperties.customProperties = [];
    },
    computed: {
        // inputData() {
        //     let params = this.copyUengineProperties.parameters;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'IN') result.push(element);
        //         });
        //     return result;
        // },
        // outputData() {
        //     let params = this.copyUengineProperties.parameters;
        //     let result = [];
        //     if (params)
        //         params.forEach((element) => {
        //             if (element.direction == 'OUT') result.push(element);
        //         });
        //     return result;
        // }
    },
    watch: {
        selectedOut(newVal) {
            if (newVal) {
                let tmp = this.processVariables.find((element) => element['name'] === newVal);
                console.log(tmp);
                let type = this.parseType(tmp.type);
                let pv = {
                    name: tmp.name,
                    type: type
                };
                this.copyUengineProperties.out = pv;
            }
        }
    },
    methods: {
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
        // deleteInputData(inputData) {
        //     const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === inputData.key);
        //     if (index > -1) {
        //         this.copyUengineProperties.parameters.splice(index, 1);
        //         this.$emit('update:uEngineProperties', this.copyUengineProperties);
        //     }
        // },
        // deleteOutputData(outputData) {
        //     const index = this.copyUengineProperties.parameters.findIndex((element) => element.key === outputData.key);
        //     if (index > -1) {
        //         this.copyUengineProperties.parameters.splice(index, 1);
        //         this.$emit('update:uEngineProperties', this.copyUengineProperties);
        //     }
        // },
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
                        if (gfx) {
                            graphicsFactory.update('shape', element, gfx);
                        }
                    }
                } catch (e) {
                    console.warn('Could not refresh task visual:', e);
                }
            }
        }
    }
};
</script>
