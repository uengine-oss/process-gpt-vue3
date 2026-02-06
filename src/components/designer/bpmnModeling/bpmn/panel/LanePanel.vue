

<template>
    <div>
        <div class="included pa-4 pt-0" style="margin-bottom: 22px">
            <v-row class="ma-0 pa-0 align-center">
                <div>{{$t('LanePanel.selectRoleType')}}</div>

                <DetailComponent
                    :title="$t('LanePanel.radioDescriptionTitle')"
                    :details="radioDescription"
                />
            </v-row>
            <v-card variant="outlined" class="pa-2" style="border-radius:8px !important;">
                <v-radio-group v-model="type" row style="margin-top: 0px !important">
                    <v-radio
                        v-for="option in roleOptions"
                        :key="option.value"
                        :value="option.value"
                        :label="$t(option.label)"
                        style="margin-right: 8px !important; font-size: 15px"
                    ></v-radio>
                </v-radio-group>
                <v-text-field
                    v-if="role && role.resolutionRule"
                    v-model="role.resolutionRule"
                    :label="$t('LanePanel.resolutionRule')"
                    class="mt-4"
                ></v-text-field>

                <!-- Dispatching Option 선택 -->
                <v-autocomplete
                    v-if="type != 'org.uengine.kernel.ExternalCustomerRoleResolutionContext' && showDispatchingOption"
                    v-model="dispatchingOption"
                    persistent-hint
                    :items="availableDispatchingOptions"
                    :item-title="item => item.title ? $t(item.title) : ''"
                    :item-value="item => item.value"
                    :label="$t('LanePanel.dispatchingOption')"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                    class="mt-4"
                >
                    <template v-slot:item="{ props, item }">
                        <v-list-item v-bind="props">
                            <v-list-item-subtitle v-if="item.raw && item.raw.description">{{ $t(item.raw.description) }}</v-list-item-subtitle>
                        </v-list-item>
                    </template>
                </v-autocomplete>

                <!-- DirectRoleResolutionContext 입력 필드 -->
                <div v-if="type == 'org.uengine.kernel.DirectRoleResolutionContext'">
                    <v-autocomplete
                        v-model="userRoleContext.endpoint"
                        :label="$t('LanePanel.userIds')"
                        :items="candidateUsers"
                        :item-title="item => item.title"
                        :item-value="item => item.value"
                        chips
                        closable-chips
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        class="mt-4"
                        :hint="$t('LanePanel.userIdsHint')"
                        persistent-hint
                        @update:model-value="handleUserSelectionChange"
                    >
                        <template v-slot:item="{ props, item }">
                            <v-list-item v-bind="props">
                                <v-list-item-subtitle v-if="item.value">{{ item.value }}</v-list-item-subtitle>
                            </v-list-item>
                        </template>
                    </v-autocomplete>
                </div>

                <!-- GroupRoleResolutionContext 입력 필드 -->
                <div v-if="type == 'org.uengine.five.overriding.GroupRoleResolutionContext'">
                    <v-autocomplete
                        v-model="roleContext.group"
                        :label="$t('LanePanel.groupName')"
                        :items="candidateGroups"
                        :item-title="item => item.title"
                        :item-value="item => item.value"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        class="mt-4"
                    ></v-autocomplete>
                </div>

                <!-- IAMRoleResolutionContext 입력 필드 -->
                <div v-if="type == 'org.uengine.five.overriding.IAMRoleResolutionContext'">
                    <v-autocomplete
                        v-model="roleContext.scope"
                        :label="$t('LanePanel.scopeName')"
                        :items="candidateRoles"
                        :item-title="item => item.title"
                        :item-value="item => item.value"
                        variant="outlined"
                        density="compact"
                        hide-details="auto"
                        class="mt-4"
                    ></v-autocomplete>
                </div>

            </v-card>
        </div>
    </div>
</template>
<script>
import { useBpmnStore } from '@/stores/bpmn';
import BackendFactory from '@/components/api/BackendFactory';
import UserSelectField from '@/components/ui/field/UserSelectField.vue';
import { getAllUsers, getAllGroups, getAllRoles, getAllDepartments } from '@/utils/keycloak';

export default {
    name: 'lane-panel',
    components: {
        UserSelectField
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean,
        processDefinition: Object,
        element: Object,
    },
    created() {

    },
    data() {
        return {
            definitions: [],
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
            type: 'org.uengine.kernel.DirectRoleResolutionContext',
            role: null,
            roleOptions: [
                { value: 'org.uengine.kernel.DirectRoleResolutionContext', label: 'LanePanel.UserRole' },
                { value: 'org.uengine.five.overriding.GroupRoleResolutionContext', label: 'LanePanel.Group' },
                { value: 'org.uengine.five.overriding.IAMRoleResolutionContext', label: 'LanePanel.IAMScope' },
                { value: 'org.uengine.kernel.ExternalCustomerRoleResolutionContext', label: 'LanePanel.externalCustomer' }
            ],
            radioDescription: [
                {
                    title: 'LanePanel.radioDescriptionSubTitle'
                }
            ],
            dispatchingOption: 1, // 0: All, 1: Racing, 2: LoadBalanced, -1: Auto, 7: Direct
            dispatchingOptions: [
                // { value: 0, title: 'LanePanel.dispatchingOptionAll', description: 'LanePanel.dispatchingOptionAllDescription' },
                { value: 1, title: 'LanePanel.dispatchingOptionRacing', description: 'LanePanel.dispatchingOptionRacingDescription' },
                // { value: 2, title: 'LanePanel.dispatchingOptionLoadBalanced', description: 'LanePanel.dispatchingOptionLoadBalancedDescription' },
                // { value: -1, title: 'LanePanel.dispatchingOptionAuto', description: 'LanePanel.dispatchingOptionAutoDescription' },
            ],
            // Context별 데이터 저장
            userRoleContext: {
                endpoint: null // 선택된 사용자 목록 (단일/다중 모두 처리)
            },
            roleContext: {
                scope: null, // GroupRoleResolutionContext용
                group: null
            },
            candidateUsers: [],
            candidateRoles: [],
            candidateDepartments: [],
            candidateGroups: [],
        };
    },
    async mounted() {
        let me = this;
        this.initialize();
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        let def = this.bpmnModeler.getDefinitions();
        const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
        if (!processElement || processElement.length === 0) {
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
        const backend = BackendFactory.createBackend();
        const value = await backend.listDefinition();
        if (value) {
            this.definitions = value;
        }
        me.loadCandidateUsers();
        me.loadCandidateRoles();
        me.loadCandidateDepartments();
        me.loadCandidateGroups();
    },
    computed: {
        availableDispatchingOptions() {
            // IAMRoleResolutionContext만 Auto 옵션 사용 가능
            if (this.type === 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                return this.dispatchingOptions;
            }
            // 나머지는 Auto 제외
            return this.dispatchingOptions.filter(opt => opt.value !== -1);
        },
        showDispatchingOption() {
            if (this.type === 'org.uengine.kernel.DirectRoleResolutionContext') {
                return false
            }
            // 나머지는 항상 표시
            return true;
        }
    },
    watch: {
        type(after, before) {
            if(!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {}
         
            if (after == 'org.uengine.kernel.DirectRoleResolutionContext') {
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.DirectRoleResolutionContext';

                this.dispatchingOption = 7; // Direct
            } else if (after == 'org.uengine.five.overriding.GroupRoleResolutionContext') {
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.five.overriding.GroupRoleResolutionContext';

                this.dispatchingOption = 1; // Racing
            } else if (after == 'org.uengine.five.overriding.IAMRoleResolutionContext') {        
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.five.overriding.IAMRoleResolutionContext';

                this.dispatchingOption = 1; // Racing
            } else if (after == 'org.uengine.kernel.ExternalCustomerRoleResolutionContext') {
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.ExternalCustomerRoleResolutionContext';
                this.copyUengineProperties.roleResolutionContext.endpoint = 'external_customer'

                this.dispatchingOption = 0;
            }
            this.updateRoleResolutionContext();
        },
        'userRoleContext': {
            handler() {
                this.updateRoleResolutionContext();
            },
            deep: true,
            immediate: false
        },
        'roleContext': {
            handler() {
                this.updateRoleResolutionContext();
            },
            deep: true
        },
        'dispatchingOption': {
            handler() {
                this.updateRoleResolutionContext();
            },
            deep: true
        },
    },
    methods: {
        initialize() {
            this.initialized = false;
            if(!this.copyUengineProperties.roleResolutionContext) {
                // 기본값 설정 (DirectRoleResolutionContext)
                this.type = 'org.uengine.kernel.DirectRoleResolutionContext';
                this.userRoleContext.endpoint = null;
                this.dispatchingOption = 7;
                return;
            }

            if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.kernel.DirectRoleResolutionContext') {
                this.type = 'org.uengine.kernel.DirectRoleResolutionContext';
                this.userRoleContext.endpoint = this.copyUengineProperties.roleResolutionContext.endpoint || null;
                this.dispatchingOption = 7;
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.five.overriding.GroupRoleResolutionContext') {
                this.type = 'org.uengine.five.overriding.GroupRoleResolutionContext';
                this.roleContext.group = this.copyUengineProperties.roleResolutionContext.scope;
                this.dispatchingOption = this.copyUengineProperties.dispatchingOption == undefined ? 1 : this.copyUengineProperties.dispatchingOption;
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                this.type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                this.roleContext.scope = this.copyUengineProperties.roleResolutionContext.scope;
                this.dispatchingOption = this.copyUengineProperties.dispatchingOption == undefined ? 1 : this.copyUengineProperties.dispatchingOption;
            } else if (this.copyUengineProperties.roleResolutionContext._type == 'org.uengine.kernel.ExternalCustomerRoleResolutionContext') {
                this.type = 'org.uengine.kernel.ExternalCustomerRoleResolutionContext';
                this.userRoleContext.endpoint = 'external_customer';
            }        
        },
        handleUserSelectionChange(newValue) {
            // 사용자 선택 변경 시 반응성 보장 (Vue 3에서는 직접 할당)
            this.userRoleContext.endpoint = newValue || null;
            this.updateRoleResolutionContext();
        },
        
        updateRoleResolutionContext() {
            if (!this.copyUengineProperties.roleResolutionContext) this.copyUengineProperties.roleResolutionContext = {};

            // Context Type별 데이터 저장
            if (this.type == 'org.uengine.kernel.DirectRoleResolutionContext') {
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.DirectRoleResolutionContext';
                this.copyUengineProperties.roleResolutionContext.endpoint = this.userRoleContext.endpoint;
                this.copyUengineProperties.dispatchingOption = this.dispatchingOption;

                delete this.copyUengineProperties.roleResolutionContext.scope;
            } else if (this.type == 'org.uengine.five.overriding.GroupRoleResolutionContext') {
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.five.overriding.GroupRoleResolutionContext';
                this.copyUengineProperties.roleResolutionContext.scope = this.roleContext.group;
                this.copyUengineProperties.dispatchingOption = this.dispatchingOption;

                delete this.copyUengineProperties.roleResolutionContext.endpoint;
            } else if (this.type == 'org.uengine.five.overriding.IAMRoleResolutionContext') {
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.five.overriding.IAMRoleResolutionContext';
                this.copyUengineProperties.roleResolutionContext.scope = this.roleContext.scope;
                this.copyUengineProperties.dispatchingOption = this.dispatchingOption;

                delete this.copyUengineProperties.roleResolutionContext.endpoint;
            } else if (this.type == 'org.uengine.kernel.ExternalCustomerRoleResolutionContext') {
                this.copyUengineProperties.roleResolutionContext._type = 'org.uengine.kernel.ExternalCustomerRoleResolutionContext';
                this.copyUengineProperties.roleResolutionContext.endpoint = 'external_customer';
                
                // delete dispatchingOption and scope
                delete this.copyUengineProperties.dispatchingOption;
                delete this.copyUengineProperties.roleResolutionContext.scope;
            }

            // 변경사항 emit
            this.$emit('update:uengineProperties', this.copyUengineProperties);
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
            if (!this.copyUengineProperties.checkpoints) {
                this.copyUengineProperties.checkpoints = [];
            }
            this.copyUengineProperties.checkpoints.push({ checkpoint: this.checkpointMessage.checkpoint });
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        },
        async loadCandidateUsers() {
            try {
                const users = await getAllUsers({ max: 100 });
                // SelectBox 형식으로 변환
                this.candidateUsers = users.map(user => ({
                    title: user.username,
                    value: user.email || user.id
                }));
                console.log('Candidate users loaded:', this.candidateUsers);
            } catch (error) {
                console.error('Failed to load candidate users:', error);
                this.candidateUsers = [];
            }
        },
        async loadCandidateRoles() {
            try {
                const roles = await getAllRoles({ max: 100 });
                // SelectBox 형식으로 변환
                this.candidateRoles = roles.map(role => ({
                    title: role.name,
                    value: role.name
                }));
                console.log('Candidate roles loaded:', this.candidateRoles);
            } catch (error) {
                console.error('Failed to load candidate roles:', error);
                this.candidateRoles = [];
            }
        },
        async loadCandidateDepartments() {
            try {
                const departments = await getAllDepartments();
                // SelectBox 형식으로 변환
                this.candidateDepartments = departments.map(dept => ({
                    title: dept.name,
                    value: dept.name
                }));
                // console.log('Candidate departments loaded:', this.candidateDepartments);
            } catch (error) {
                console.error('Failed to load candidate departments:', error);
                this.candidateDepartments = [];
            }
        },
        async loadCandidateGroups() {
            try {
                const groups = await getAllGroups();
                // SelectBox 형식으로 변환
                this.candidateGroups = groups.map(group => ({
                    title: group,
                    value: group
                }));
                // console.log('Candidate groups loaded:', this.candidateGroups);
            } catch (error) {
                console.error('Failed to load candidate groups:', error);
                this.candidateGroups = [];
            }
        },
    }
};
</script>