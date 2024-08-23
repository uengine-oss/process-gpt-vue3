<template>
    <div>
        <div style="height: 100%" v-if="element.$type === 'bpmn:IntermediateThrowEvent'">
            <div class="mb-2 mt-4">
                
                <v-row class="ma-0 pa-0">
                    <v-col cols="3" class="pa-0 pr-2">
                        <v-autocomplete
                            :label="$t('BpmnPropertyPanel.methodTypeUrl')"
                            :items="methodList"
                            theme="light"
                            density="comfortable"
                            variant="outlined"
                            v-model="copyUengineProperties.method"
                        ></v-autocomplete>
                    </v-col>
                    <v-col cols="9" class="pa-0">
                        <v-text-field :label="$t('BpmnPropertyPanel.apiUrl')" v-model="copyUengineProperties.uriTemplate"></v-text-field>
                    </v-col>
                </v-row>
                <DetailComponent
                    :title="$t('SendTaskPanel.methodTypeDescriptionTitle')"
                    :details="methodTypeDescription"
                    :detailUrl="'https://www.youtube.com/watch?v=bxkB-pkOpTQ'"
                />
            </div>
            <div style="height: 70%">
                <v-row class="ma-0 pa-0" style="height: 100%">
                    <vue-monaco-editor
                        v-model:value="copyUengineProperties.inputPayloadTemplate"
                        theme="vs-dark"
                        language="json"
                        :options="MONACO_EDITOR_OPTIONS"
                        @mount="handleMount"
                    />
                </v-row>
            </div>
            <div>
                <v-row class="ma-0 pa-0 mt-4">
                    <v-autocomplete
                        :label="$t('ScriptTaskPanel.return')"
                        :items="processVariables"
                        item-props
                        :item-value="item"
                        :item-title="(item) => item.name"
                        v-model="copyUengineProperties.selectedOut"
                        density="comfortable"
                        variant="outlined"
                    ></v-autocomplete>
                    <!-- <bpmn-parameter-contexts :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts> -->
                </v-row>
            </div>
            <DetailComponent
                style="padding-bottom:20px;"
                :title="$t('SendTaskPanel.returnTitle')"
            />
        </div>
        <div v-else-if="this.element.$type === 'bpmn:IntermediateCatchEvent' || this.element.$type === 'bpmn:StartEvent'">
            <div>
                <v-text-field class="mt-4" :label="$t('MessageEventDefinitionPanel.correlationKey')" v-model="copyUengineProperties.correlationKey"></v-text-field>
                <v-text-field class="mt-4" :label="$t('MessageEventDefinitionPanel.servicePath')" v-model="copyUengineProperties.servicePath"></v-text-field>
                <v-text-field class="mt-4" :label="$t('MessageEventDefinitionPanel.operationRef')" v-model="copyUengineProperties.operationRef"></v-text-field>
            </div>
        </div>
    </div>
</template>
<script>
import partialParse from 'partial-json-parser';
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage();
// import { setPropeties } from '@/components/designer/bpmnModelingf/bpmn/panel/CommonPanel.ts';

export default {
    name: 'message-event-definition-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        element: Object,
        definition: Object
    },
    async created() {
        this.copyUengineProperties = this.uengineProperties;
        this.storage = StorageBaseFactory.getStorage();
        this.openaiToken = await this.getToken();
        Object.keys(this.requiredKeyLists).forEach((key) => {
            this.ensureKeyExists(this.copyUengineProperties, key, this.requiredKeyLists[key]);
        });
    },
    data() {
        return {
            MONACO_EDITOR_OPTIONS: {
                automaticLayout: true,
                formatOnType: true,
                formatOnPaste: true
            },
            requiredKeyLists: {},
            methodList: ['GET', 'POST', 'PUT', 'PATCH'],
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
            generator: null,
            openAI: null,
            copyDefinition: this.definition,
            processVariables: [],
            apiServiceURL: '',
            methodTypeDescription: [
                {
                    title: 'MessageEventDefinitionPanel.methodTypeDescriptionSubTitle1',
                },
            ]
        };
    },
    async mounted() {
        let me = this;
        this.processVariables = this.copyDefinition.processVariables
            .filter((variable) => variable.type !== 'Form')
            .map((variable) => ({
                name: variable.name,
                type: variable.type,
                defaultValue: variable.defaultValue
            }));
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        if (this.element.$type === 'bpmn:IntermediateThrowEvent') {
            this.copyUengineProperties.headers = [
                { name: 'Authorization', value: 'Bearer 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' },
                { name: 'Accept', value: 'application/vnd.github+json' },
                { name: 'X-GitHub-Api-Version', value: '2022-11-28' }
            ];
        }
    },
    computed: {},
    watch: {},
    methods: {
        async getToken() {
            let option = {
                key: 'key'
            };
            const res = await this.storage.getObject('db://configuration/openai_key', option);
            return res?.value?.key || window.localStorage.getItem('openAIToken') || null;
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
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
        }
    }
};
</script>
