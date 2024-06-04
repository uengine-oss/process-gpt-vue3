<template>
    <div>
        <div class="included" style="margin-bottom: 22px; height: 100%">
            <div style="margin-bottom: 8px">API URL</div>
            <v-row class="ma-0 pa-0">
                <v-text-field v-model="copyUengineProperties.serviceURL"></v-text-field>
            </v-row>
            <div style="margin-bottom: 8px">Open API 스펙</div>
            <v-row class="ma-0 pa-0" style="height: 100%">
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
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();
export default {
    name: 'participant-panel',
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
            editorRef: {}
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
        // // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
        const value = await storage.list('proc_def');
        if (value) {
            this.definitions = value;
        }
    },
    computed: {},
    watch: {
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
        async getData(path, options) {
            // let value;
            // if (path) {
            //     value = await this.storage.getObject(`db://${path}`, options);
            // } else {
            //     value = await this.storage.getObject(`db://${this.path}`, options);
            // }
            // return value;
        },
        addCheckpoint() {
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uEngineProperties', this.copyUengineProperties);
        }
    }
};
</script>
