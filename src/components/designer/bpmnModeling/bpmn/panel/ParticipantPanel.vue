<template>
    <div>
        <!-- PPI(프로세스 성과지표) — 프로세스 레벨 uengine:json(ppi)에 저장 -->
        <div class="mt-4 mb-6">
            <PpiField :model-value="copyUengineProperties.ppi" :readonly="isViewMode" @update:model-value="onPpiUpdate" />
        </div>

        <v-divider class="mb-2" />

        <div class="included" style="margin-bottom: 22px; height: 100%">
            <div class="mb-1 mt-4">{{}}</div>
            <v-row v-if="isBuiltinPropVisible('selected_system')" class="ma-0 pa-0 align-center pb-2">
                <v-autocomplete
                    v-model="copyUengineProperties.selectedSystem"
                    :items="systemList"
                    @input="($evt) => selectSystem($evt)"
                    density="comfortable"
                    variant="outlined"
                    :label="$t('ParticipantPanel.system')"
                />
                <DetailComponent
                    class="ml-2"
                    :title="$t('ParticipantPanel.systemDefinitionDescriptionTitle')"
                    :details="methodTypeDescription"
                    :iconSize="24"
                />
            </v-row>

            <v-row v-if="isBuiltinPropVisible('service_url')" class="ma-0 pa-0 align-center pb-2">
                <v-text-field :label="$t('ParticipantPanel.apiUrl')" v-model="copyUengineProperties.serviceURL"></v-text-field>
                <DetailComponent
                    class="ml-2"
                    :title="$t('ParticipantPanel.apiUrlDescriptionTitle')"
                    :details="apiUrlDescription"
                    :detailUrl="'https://www.youtube.com/watch?v=bxkB-pkOpTQ'"
                    :iconSize="24"
                />
            </v-row>

            <div v-if="isBuiltinPropVisible('open_api')" class="mb-1 mt-4">{{ $t('ParticipantPanel.openAPISpec') }}</div>
            <v-row v-if="isBuiltinPropVisible('open_api')" class="ma-0 pa-0" style="height: 50vh">
                <vue-monaco-editor
                    v-model:value="copyUengineProperties.openAPI"
                    theme="vs-dark"
                    language="yaml"
                    :options="MONACO_EDITOR_OPTIONS"
                    @mount="handleMount"
                />
            </v-row>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import PpiField from '@/components/designer/PpiField.vue';
import builtinPanelVisibilityMixin from './builtinPanelVisibilityMixin';

export default {
    name: 'participant-panel',
    mixins: [builtinPanelVisibilityMixin],
    components: {
        PpiField
    },
    props: {
        element: Object,
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    created() {},
    data() {
        return {
            MONACO_EDITOR_OPTIONS: {
                automaticLayout: true,
                formatOnType: true,
                formatOnPaste: true
            },
            definitions: [],
            definitionRoles: [],
            calleeDefinitionRoles: [],
            copyUengineProperties: this.uengineProperties,
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
            type: 'None',
            editorRef: {},
            systemList: [],
            selectedSystem: '',
            backend: null,
            methodTypeDescription: [
                {
                    image: 'systemDefinition.gif'
                }
            ],
            apiUrlDescription: [
                {
                    title: 'ParticipantPanel.apiUrlDescriptionSubTitle1'
                }
            ]
        };
    },
    async mounted() {
        let me = this;
        this.checkType();
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        let def = this.bpmnModeler.getDefinitions();
        let process = me.element.processRef;

        if (this.copyUengineProperties?.serviceURL?.length > 0) {
            process.isExecutable = false;
        } else {
            process.isExecutable = true;
        }
        const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
        if (!processElement) {
            console.error('bpmn:Process element not found');
            return;
        }
        processElement.forEach((process) => {
            (process.laneSets || []).forEach((laneSet) => {
                (laneSet.lanes || []).forEach((lane) => {
                    // 레인의 이름을 배열에 추가합니다.
                    if (lane?.name?.length > 0) me.calleeDefinitionRoles.push(lane.name);
                });
            });
        });
        this.backend = BackendFactory.createBackend();
        // // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
        const value = await this.backend.listDefinition();
        if (value) {
            this.definitions = value;
        }
        const systemList = await this.backend.getSystemList();
        systemList.forEach((system) => {
            this.systemList.push(system.name.replace('.json', ''));
        });
    },
    computed: {},
    watch: {
        'copyUengineProperties.selectedSystem'(newVal) {
            this.backend.getSystem(newVal).then((result) => {
                console.log(result);
                this.copyUengineProperties.selectedSystem = newVal;
                this.copyUengineProperties.serviceURL = result.url;
                this.copyUengineProperties.openAPI = result.spec;
            });
        },
        'copyUengineProperties.serviceURL': function (newVal, oldVal) {
            let me = this;
            let process = me.element.processRef;
            if (newVal.length > 0) {
                process.isExecutable = false;
            } else {
                process.isExecutable = true;
            }
        },
        type(after, before) {
            if (after == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                if (!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {};
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                if (!this.copyUengineProperties.roleResolutionContext.scope) this.copyUengineProperties.roleResolutionContext.scope = '';
            } else if (after == 'org.uengine.kernel.DirectRoleResolutionContext') {
                if (!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {};
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.DirectRoleResolutionContext';
                if (!this.copyUengineProperties.roleResolutionContext.endpoint)
                    this.copyUengineProperties.roleResolutionContext.endpoint = '';
            } else if (after == 'None') {
                if (this.copyUengineProperties.roleResolutionContext) {
                    delete this.copyUengineProperties.roleResolutionContext;
                }
            }
        }
    },
    methods: {
        onPpiUpdate(value) {
            // 비어 있으면 키 자체를 제거해 프로세스 JSON에 null이 남지 않게 한다.
            if (value && value.length > 0) {
                this.copyUengineProperties.ppi = value;
            } else {
                delete this.copyUengineProperties.ppi;
            }
        },
        handleMount(editor) {
            this.editorRef.value = editor;
        },
        checkType() {
            if (!this.copyUengineProperties.roleResolutionContext) {
                this.type = 'None';
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.kernel.DirectRoleResolutionContext') {
                this.type = 'org.uengine.kernel.DirectRoleResolutionContext';
                this.scope = this.copyUengineProperties.roleResolutionContext.scope;
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                this.type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                this.endpoint = this.copyUengineProperties.roleResolutionContext.endpoint;
            }
        },
        ensureKeyExists(obj, key, defaultValue) {
            console.log(key);
            console.log(obj.hasOwnProperty(key));

            if (!obj.hasOwnProperty(key)) {
                obj[key] = defaultValue;
            }

            return obj;
        },

        addCheckpoint() {
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    }
};
</script>
