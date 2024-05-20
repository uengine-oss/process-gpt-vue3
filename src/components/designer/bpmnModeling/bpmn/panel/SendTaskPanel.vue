<template>
    <div>
        <div>
            Method Type & URL
            <v-row class="ma-0 pa-0">
                <v-col cols="4">
                    <v-autocomplete
                        labels="Methods Type"
                        :items="methodList"
                        theme="light"
                        rounded
                        density="comfortable"
                        variant="solo"
                        v-model="copyUengineProperties.httpMethods"
                    ></v-autocomplete>
                </v-col>
                <v-col cols="8">
                    <v-text-field label="API URL" v-model="copyUengineProperties.API"></v-text-field>
                </v-col>
            </v-row>
        </div>
        <div style="height: 70%">
            <v-row class="ma-0 pa-0" style="height: 100%">
                <vue-monaco-editor
                    v-model:value="copyUengineProperties.payload"
                    theme="vs-dark"
                    language="json"
                    :options="MONACO_EDITOR_OPTIONS"
                    @mount="handleMount"
                />
            </v-row>
        </div>
        <div align="right" @click="generateAPI">
            <v-btn prepend-icon color="primary">
                <template v-slot:prepend>
                    <Icon icon="mdi:wand" />
                </template>
                생성
            </v-btn>
        </div>
        <div>
            <div>Return 값을 저장 할 변수</div>
            <v-row class="ma-0 pa-0">
                <v-autocomplete
                    :items="processVariables"
                    item-props
                    :item-value="item"
                    :item-title="(item) => item.name"
                    v-model="selectedOut"
                ></v-autocomplete>
                <!-- <bpmn-parameter-contexts :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts> -->
            </v-row>
        </div>
    </div>
</template>
<script>
import partialParse from 'partial-json-parser';
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage();
import BPMNAPIGenerator from '@/components/ai/BPMNAPIGenerator.js';
// import { setPropeties } from '@/components/designer/bpmnModeling/bpmn/panel/CommonPanel.ts';

export default {
    name: 'send-task-panel',
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
            requiredKeyLists: { payload: '' },
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
            httpMethods: null,
            copyDefinition: this.definition,
            processVariables: [],
            apiServiceURL: ''
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
        generateAPI() {
            this.$try({
                context: this,
                action: async () => {
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
                        let targetProcessId = targetElement.$parent.id;

                        def.rootElements.forEach((element) => {
                            if (element.$type == 'bpmn:Collaboration') {
                                element.participants.forEach((participant) => {
                                    if (participant.processRef.id == targetProcessId) {
                                        let openAPIInfo = JSON.parse(participant.extensionElements.values[0].json);
                                        this.openAPI = openAPIInfo.API;
                                        this.apiServiceURL = openAPIInfo.serviceURL;
                                    }
                                });
                            }
                        });
                        this.generator = new BPMNAPIGenerator(this, {
                            isStream: true,
                            preferredLanguage: 'Korean'
                        });
                        this.generator.generate();
                    } else {
                        throw new Error('생성할 수 없는 요소입니다.');
                    }
                }
            });
        },
        ensureKeyExists(obj, key, defaultValue) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }
        },
        onGenerationFinished(response) {
            this.$try({
                context: this,
                action: async () => {
                    // Changed to arrow function
                    this.copyUengineProperties.API = response.API;
                    this.copyUengineProperties.payload = JSON.stringify(response.payloadJSON);
                    this.copyUengineProperties.httpMethods = response.httpMethods;
                }
            });
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
        },
        extractJSON(inputString, checkFunction) {
            try {
                JSON.parse(inputString); // if no problem, just return the whole thing
                return inputString;
            } catch (e) {}

            if (this.hasUnclosedTripleBackticks(inputString)) {
                inputString = inputString + '\n```';
            }

            // 정규 표현식 정의
            //const regex = /^.*?`{3}(?:json)?\n(.*?)`{3}.*?$/s;
            const regex = /```(?:json)?\s*([\s\S]*?)\s*```/;

            // 정규 표현식을 사용하여 입력 문자열에서 JSON 부분 추출
            const match = inputString.match(regex);

            // 매치된 결과가 있다면, 첫 번째 캡쳐 그룹(즉, JSON 부분)을 반환
            if (match) {
                if (checkFunction)
                    match.forEach((shouldBeJson) => {
                        if (checkFunction(shouldBeJson)) return shouldBeJson;
                    });
                else return match[1];
            }

            // 매치된 결과가 없으면 null 반환
            return null;
        }
    }
};
</script>
