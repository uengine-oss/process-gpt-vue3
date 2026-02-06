<template>
    <div v-if="copyUengineProperties">
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
        <div class="mt-3" v-if="mode == 'ProcessGPT'">
            <KeyValueField
                v-model="copyUengineProperties.customProperties"
                :label="$t('BpmnPropertyPanel.customProperties') || '사용자 속성'"
                :readonly="isViewMode"
            />
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
        isForCompensation: Boolean
    },
    components: {
        GenerateScriptPanel,
        KeyValueField
    },
    created() {},
    data() {
        return {
            requiredKeyLists: {},
            copyUengineProperties: null,
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
            selectedOut: ''
        };
    },
    async mounted() {
        let me = this;
        me.initialize();
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
        initialize() {
            var me = this;
            const store = useBpmnStore();
            me.copyDefinition = null;
            me.processVariables = [];
            me.copyUengineProperties = {};

            if(me.definition) me.copyDefinition = JSON.parse(JSON.stringify(me.definition));

            if(me.copyDefinition) {
                me.processVariables = me.copyDefinition.processVariables
                    .filter((variable) => variable.type !== 'Form')
                    .map((variable) => ({
                        name: variable.name,
                        type: variable.type,
                        defaultValue: variable.defaultValue
                    }));
            }
          
            me.bpmnModeler = store.getModeler;

            if (me.uengineProperties) {
                me.copyUengineProperties = JSON.parse(JSON.stringify(me.uengineProperties));
            } 

            // _type 고정
            me.copyUengineProperties._type = 'org.uengine.kernel.ScriptActivity';

            // script 초기화
            if (typeof this.copyUengineProperties.script !== 'string') {
                this.copyUengineProperties.script = this.copyUengineProperties.script || '';
            }

            // language 초기화 (0: Javascript, 1: Java)
            if (!this.copyUengineProperties.language) {
                this.copyUengineProperties.language = '0';
            }

            if(me.copyUengineProperties.out) {
                // let tmp = this.processVariables.find((element) => element['name'] === this.copyUengineProperties.out.name);
                me.selectedOut = me.copyUengineProperties.out.name;
            }

            // ProcessGPT 모드에서만 쓰는 사용자 속성
            if (window.$mode === 'ProcessGPT') {
                if(!me.copyUengineProperties.customProperties) me.copyUengineProperties.customProperties = [];
                if (!Array.isArray(me.copyUengineProperties.customProperties)) me.copyUengineProperties.customProperties = [];
            } else if (me.copyUengineProperties && me.copyUengineProperties.hasOwnProperty('customProperties')) {
                delete me.copyUengineProperties.customProperties;
            }
        },
        beforeSave() {
            const { script, language, out, customProperties } = this.copyUengineProperties;
            
            const updateProperties = {
                _type: 'org.uengine.kernel.ScriptActivity',
                script: script || '',
                language: language || '0',
                out: out || {}
            };

            if (window.$mode === 'ProcessGPT') {
                updateProperties.customProperties = customProperties || [];
            }

            this.$emit('update:uengineProperties', updateProperties);
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
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    }
};
</script>
