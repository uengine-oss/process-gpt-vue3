<template>
    <div>
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
                :title="$t('ServiceTaskPanel.methodTypeDescriptionTitle')"
                :details="methodTypeDescription"
            />
        </div>
        <div style="height: 40%" v-if="copyUengineProperties.httpMethods != 'GET'">
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
        <div align="right" @click="generateAPI">
            <v-btn prepend-icon rounded color="primary">
                <template v-slot:prepend>
                    <Icons :icon="'magic'"  />
                </template>
                {{ $t('ServiceTaskPanel.generation') }}
            </v-btn>
        </div>
        <v-btn block text rounded color="primary" class="my-3" @click="isOpenFieldMapper = !isOpenFieldMapper">{{ $t('ServiceTaskPanel.dataMapping') }}</v-btn>
        <DetailComponent
            :title="$t('BpmnPropertyPanel.mapperDescriptionTitle')"
            :details="mapperDescription"
            :detailUrl="'https://www.youtube.com/watch?v=1tCKnzck2-c'"
        />
        <div>
            <!-- <div>Return 값을 저장 할 변수</div> -->
            <!-- <v-row class="ma-0 pa-0">
                <v-autocomplete
                    :items="processVariables"
                    item-props
                    :item-value="item"
                    :item-title="(item) => item.name"
                    v-model="copyUengineProperties.selectedOut"
                ></v-autocomplete>
                <bpmn-parameter-contexts :parameter-contexts="copyUengineProperties.parameters"></bpmn-parameter-contexts>
            </v-row> -->
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
import partialParse from 'partial-json-parser';
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';
const storage = StorageBaseFactory.getStorage();
import BPMNAPIGenerator from '@/components/ai/BPMNAPIGenerator.js';
import Mapper from '@/components/designer/mapper/Mapper.vue';
import yaml from 'yamljs';
// import { setPropeties } from '@/components/designer/bpmnModeling/bpmn/panel/CommonPanel.ts';

export default {
    name: 'service-task-panel',
    components: {
        Mapper
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        element: Object,
        definition: Object
    },
    async created() {
        this.copyUengineProperties = this.uengineProperties;
        if(!typeof this.copyUengineProperties.inputPayloadTemplate != 'string') {
            this.copyUengineProperties.inputPayloadTemplate = JSON.stringify(this.copyUengineProperties.inputPayloadTemplate)
        }
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
            apiServiceURL: '',
            formMapperJson: '',
            replaceFromExpandableNode: null,
            replaceToExpandableNode: null,
            nodes: {},
            openAPI: '',
            isOpenFieldMapper: false,
            methodTypeDescription: [
                {
                    title: 'SendTaskPanel.methodTypeDescriptionSubTitle1',
                },
            ],
            mapperDescription: [
                {
                    title: 'BpmnPropertyPanel.mapperDescriptionSubTitle1'
                },
                {
                    title: 'BpmnPropertyPanel.mapperDescriptionSubTitle2',
                    image: "EventSynchronizationFomVariablesHowToUse.gif"
                },
            ],
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
        
        let def = this.bpmnModeler.getDefinitions();
        let target = null;
        def.rootElements.forEach((element) => {
            if (element.$type == 'bpmn:Collaboration') {
                element.messageFlows?.forEach((messageFlow) => {
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

            me.formMapperJson = JSON.stringify(me.copyUengineProperties.selectedOut, null, 2);
        }
    },
    computed: {},
    watch: {},
    methods: {
        saveMapperJson(jsonString) {
            this.formMapperJson = jsonString;
            // this.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
            this.copyUengineProperties.mapperIn = JSON.parse(jsonString);
            // this.$emit('update:uEngineProperties', this.copyUengineProperties);
        },
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
                    this.copyUengineProperties.uriTemplate = response.uriTemplate;
                    this.copyUengineProperties.inputPayloadTemplate = JSON.stringify(response.inputPayloadTemplate);
                    this.copyUengineProperties.method = response.method;
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
