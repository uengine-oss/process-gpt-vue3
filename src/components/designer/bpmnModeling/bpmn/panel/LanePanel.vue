<template>
    <div>
        <div class="included" style="margin-bottom: 22px">
            <div class="mt-4">{{$t('LanePanel.selectRoleType')}}</div>
            <v-card variant="outlined" class="pa-2" style="border-radius:8px !important;">
                <v-radio-group v-model="type" row style="margin-top: 0px !important">
                    <v-radio
                        id="roleResolution"
                        name="roleResolution"
                        value="None"
                        :label="$t('LanePanel.none')"
                        style="margin-right: 8px !important; font-size: 15px"
                    ></v-radio>
                    <v-radio
                        id="roleResolution"
                        name="roleResolution"
                        value="org.uengine.five.overriding.IAMRoleResolutionContext"
                        :label="$t('LanePanel.IAMScope')"
                        style="margin-right: 8px !important; font-size: 15px"
                    ></v-radio>
                    <v-radio
                        id="roleResolution"
                        name="roleResolution"
                        value="org.uengine.kernel.DirectRoleResolutionContext"
                        :label="$t('LanePanel.DirecUser')"
                        style="margin-right: 8px !important; font-size: 15px"
                    ></v-radio>
                </v-radio-group>
                <v-text-field
                    v-if="role && role.resolutionRule"
                    v-model="role.resolutionRule"
                    :label="$t('LanePanel.resolutionRule')"
                    class="mt-4"
                ></v-text-field>

                <v-text-field
                    v-if="type == 'org.uengine.five.overriding.IAMRoleResolutionContext'"
                    v-model="copyUengineProperties.roleResolutionContext.scope"
                    :label="$t('LanePanel.scopeName')"
                    class="mt-4"
                ></v-text-field>

                <v-text-field
                    v-if="type == 'org.uengine.kernel.DirectRoleResolutionContext'"
                    v-model="copyUengineProperties.roleResolutionContext.endpoint"
                    :label="$t('LanePanel.userID')"
                    class="mt-4"
                ></v-text-field>
                <DetailComponent
                    :title="$t('LanePanel.radioDescriptionTitle')"
                    :details="radioDescription"
                />
            </v-card>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

export default {
    name: 'lane-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        processDefinition: Object,
        element: Object,
    },
    created() {
        // console.log(this.element)
        // this.uengineProperties = JSON.parse(this.element.extensionElements.values[0].json)
        // 필수 uEngine Properties의 key가 없다면 작업.
        // Object.keys(this.requiredKeyLists).forEach((key) => {
        //     this.ensureKeyExists(this.copyUengineProperties, key, this.requiredKeyLists[key]);
        // });
        // if(this.processDefinition && this.processDefinition.roles && this.processDefinition.roles.length > 0){
        //     const role = this.processDefinition.roles.find(role => role.name === this.element.name);
        //     if (role) {
        //         this.role = role
        //     } else {
        //         console.log('Role not found');
        //     }
        // }

    },
    data() {
        return {
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
            role: null,
            radioDescription: [
                {
                    title: 'LanePanel.radioDescriptionSubTitle'
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
        type(after, before) {
            if (after == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                if(!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {}
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                if(!this.copyUengineProperties.roleResolutionContext.scope) this.copyUengineProperties.roleResolutionContext.scope = ''
            } else if (after == 'org.uengine.kernel.DirectRoleResolutionContext') {
                if(!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {}
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.DirectRoleResolutionContext';
                if(!this.copyUengineProperties.roleResolutionContext.endpoint) this.copyUengineProperties.roleResolutionContext.endpoint = ''
            } else if (after == 'None') {
                if (this.copyUengineProperties.roleResolutionContext) {
                    delete this.copyUengineProperties.roleResolutionContext;
                }
            }
        }
    },
    methods: {
        checkType() {
            if (!this.copyUengineProperties.roleResolutionContext) {
                this.type = 'None';
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.kernel.DirectRoleResolutionContext') {
                this.type = 'org.uengine.kernel.DirectRoleResolutionContext';
                this.scope = this.copyUengineProperties.roleResolutionContext.scope
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                this.type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                this.endpoint = this.copyUengineProperties.roleResolutionContext.endpoint
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
