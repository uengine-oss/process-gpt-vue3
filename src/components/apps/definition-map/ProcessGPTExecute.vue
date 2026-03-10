<template>
    <div :key="renderKey">
        <v-card flat class="w-100">
            <v-row :class="isMobile ? 'ma-0 pa-4 pb-0 flex-column align-start' : 'ma-0 pa-4 pb-0 align-center'">
                <div v-if="isSimulate == 'true'"
                    class="text-h4 font-weight-semibold" 
                >{{ $t('ProcessGPTExecute.processSimulate') }}
                </div>
                <div v-else 
                    class="text-h4 font-weight-semibold"
                >{{ processDefinition.processDefinitionName }}
                </div>
                <v-spacer v-if="!isMobile"></v-spacer>
                <div v-if="isMobile" class="d-flex align-center mt-2 ml-auto">
                    <v-btn @click="closeDialog"
                        rounded 
                        density="compact"
                        style="background-color: #808080;
                        color: white;"
                    >닫기</v-btn>
                </div>
                <div v-else>
                    <v-btn @click="closeDialog"
                        class="ml-auto" 
                        variant="text" 
                        density="compact"
                        icon
                    >
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>
            </v-row>
            
            <div :class="isMobile ? 'Process-gpt-execute-mobile-layout' : 'd-flex'">
                <div v-if="isSimulate == 'false'" class="pa-4" :style="roleMappingPanelStyle">
                    <v-row class="ma-0 pa-0">
                        <div class="text-h5 font-weight-semibold">{{ $t('ProcessGPTExecute.roleMapping') }}</div>
                    </v-row>
                    <div class="mt-4">
                        <div v-for="role in roleMappings" :key="role.name">
                            <user-select-field v-model="role.endpoint"
                                :name="role.name"
                                :item-value="'id'"
                                :hide-details="true"
                                :use-agent="true"
                                :use-multiple="true"
                                :limit-non-agent-to-single="false"
                            ></user-select-field>
                        </div>
                    </div>
                    <div v-if="isSimulate == 'false' && !gs">
                        <div class="text-h5 font-weight-semibold">{{ $t('InstanceCard.source') }}</div>
                        <InstanceSource 
                            ref="instanceSourceRef"
                            :isStarted="isStarted"
                            :instId="instId"
                            :processDefinitionId="definitionId"
                        />
                    </div>
                </div>
                <div class="w-100">
                    <div v-if="workItem != null">
                        <WorkItem 
                            ref="workItemRef"
                            :definitionId="definitionId" 
                            :dryRunWorkItem="workItem" 
                            :isDryRun="true"
                            :isSimulate="isSimulate"
                            :simulationInstances="simulationInstances"
                            :activityIndex="activityIndex"
                            :processDefinition="processDefinition"
                            :isStarted="true"
                            :deployDefinitionId="deployDefinitionId"
                            :deployVersion="deployVersion"
                            :disableAdvancedResearch="disableAdvancedResearch"
                            :hideAgentMonitorTab="gs"
                            @close="closeDialog"
                            @executeProcess="executeProcess"
                            @backToPrevStep="backToPrevStep"
                            @agentGenerationFinished="agentGenerationFinished"
                        ></WorkItem>
                    </div>
                    <div v-else>
                        <v-row class="ma-0 pa-0 execute-skeleton-top" style="height: 100%;">
                            <v-col cols="12" class="pa-4">
                                <v-skeleton-loader type="card"></v-skeleton-loader>
                            </v-col>
                        </v-row>
                        <v-row class="ma-0 pa-0 execute-skeleton-bottom" style="height: 100%;">
                            <v-col cols="4" class="pa-4">
                                <v-skeleton-loader type="card"></v-skeleton-loader>
                            </v-col>
                            <v-col cols="8" class="pa-4">
                                <v-skeleton-loader type="card"></v-skeleton-loader>
                            </v-col>
                        </v-row>
                    </div>   
                </div>
            </div>
        </v-card>
    </div>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import WorkItem from '@/components/apps/todolist/WorkItem.vue';
import UserSelectField from '@/components/ui/field/UserSelectField.vue';
import InstanceSource from '@/components/apps/todolist/InstanceSource.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import { useDefaultSetting } from '@/stores/defaultSetting';

export default {
    setup() {
        const defaultSetting = useDefaultSetting();
        return {
            defaultSetting
        }
    },
    components: {
        AppBaseCard,
        WorkItem,
        UserSelectField,
        InstanceSource
    },
    props: {
        definitionId: String,
        isSimulate: String,
        bpmn: String,
        processDefinition: Object,
        deployDefinitionId: {
            type: String,
            default: '',
        },
        deployVersion: {
            type: String,
            default: '',
        },
        isExecutionByProject: {
            type: Boolean,
            default: false
        },
    },
    data: () => ({
        definition: {},
        workItem: null,
        instId: "",
        effectiveBpmn: "",
        roleMappings: [],
        isMobile: false,
        activityIndex: 0,
        renderKey: 0,
        simulationInstances: [],
        isStarted: true,
    }),
    async mounted() {
        if (this.processDefinition && this.processDefinition.processDefinitionId) {
            const defId = this.processDefinition.processDefinitionId;

            if (this.isSimulate === 'false') {
                // 실행 모드: 운영 버전(major 태그 최신) 기준으로 정의 로딩
                const execDef = await backend.getExecutionDefinition(defId);
                if (execDef) {
                    if (execDef.definition) {
                        Object.assign(this.processDefinition, execDef.definition);
                    }
                    if (execDef.bpmn) {
                        this.effectiveBpmn = execDef.bpmn;
                    }
                    // 프로세스 실행 시 complete 호출에 사용할 버전 정보 세팅
                    if (execDef.version) {
                        this.processDefinition.version = execDef.version;
                    }
                    if (execDef.version_tag) {
                        this.processDefinition.version_tag = execDef.version_tag;
                    }
                }
            } else {
                // 시뮬레이션 모드: 항상 proc_def(현재 정의) 기준으로 로딩
                const simDef = await backend.getSimulationDefinition(defId);
                if (simDef) {
                    if (simDef.definition) {
                        Object.assign(this.processDefinition, simDef.definition);
                    }
                    if (simDef.bpmn) {
                        this.effectiveBpmn = simDef.bpmn;
                    }
                }
            }

            // 정의에서 별도로 가져오지 못했다면, props로 들어온 bpmn을 기본값으로 사용
            if (!this.effectiveBpmn && this.bpmn) {
                this.effectiveBpmn = this.bpmn;
            }

            this.instId = `${defId}.${this.uuid()}`;
        }

        await this.init();
        this.checkIfMobile();
        window.addEventListener('resize', this.checkIfMobile);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.checkIfMobile);
    },
    computed: {
        gs() {
            return window.$gs;
        },
        roleMappingPanelStyle() {
            // gs 모드에서 소스 영역이 사라져도 역할 지정 영역 가독성을 유지하도록 폭 확보
            if (!this.isMobile && this.gs && this.isSimulate === 'false') {
                return 'min-width: 300px; width: 300px;';
            }
            return '';
        },
        isFinishedAgentGeneration() {
            return this.$refs.workItemRef && this.$refs.workItemRef.isFinishedAgentGeneration || false;
        },
        isCompleted() {
            return this.$refs.workItemRef && this.$refs.workItemRef.isCompleted || false;
        },
        disableAdvancedResearch() {
            return this.isSimulate == 'true' ? true : false;
        }
    },
    methods: {
        async getOrganizationChartRoot() {
            const supabase = window.$supabase;
            const tenantId = window.$tenantName || 'default';
            if (!supabase) return null;
            const { data, error } = await supabase
                .from('configuration')
                .select('value')
                .eq('key', 'organization')
                .eq('tenant_id', tenantId)
                .maybeSingle();
            if (error || !data?.value) return null;
            const orgValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            return orgValue?.chart || orgValue || null;
        },
        findTeamNodeById(node, teamId) {
            if (!node || !teamId) return null;
            if ((node.id === teamId || node?.data?.id === teamId) && node?.data?.isTeam) {
                return node;
            }
            if (Array.isArray(node.children)) {
                for (const child of node.children) {
                    const found = this.findTeamNodeById(child, teamId);
                    if (found) return found;
                }
            }
            return null;
        },
        findTeamNodeByName(node, teamName) {
            if (!node || !teamName) return null;
            const normalizedTarget = String(teamName).trim();
            const nodeName = node?.data?.name || node?.name || '';
            if (node?.data?.isTeam && String(nodeName).trim() === normalizedTarget) {
                return node;
            }
            if (Array.isArray(node.children)) {
                for (const child of node.children) {
                    const found = this.findTeamNodeByName(child, normalizedTarget);
                    if (found) return found;
                }
            }
            return null;
        },
        collectMemberIdsFromTeamNode(teamNode) {
            const memberIds = [];
            const traverse = (node) => {
                if (!node || !Array.isArray(node.children)) return;
                node.children.forEach((child) => {
                    const isTeam = !!child?.data?.isTeam;
                    if (isTeam) {
                        traverse(child);
                        return;
                    }
                    const id = child?.id || child?.data?.id || null;
                    if (id) memberIds.push(id);
                });
            };
            traverse(teamNode);
            return Array.from(new Set(memberIds));
        },
        async getTeamMemberIds(teamId, chartRoot = null) {
            const root = chartRoot || await this.getOrganizationChartRoot();
            if (!root || !teamId) return [];
            const teamNode = this.findTeamNodeById(root, teamId);
            if (!teamNode) return [];
            return this.collectMemberIdsFromTeamNode(teamNode);
        },
        async getTeamMemberIdsByName(teamName, chartRoot = null) {
            const root = chartRoot || await this.getOrganizationChartRoot();
            if (!root || !teamName) return [];
            const teamNode = this.findTeamNodeByName(root, teamName);
            if (!teamNode) return [];
            return this.collectMemberIdsFromTeamNode(teamNode);
        },
        findMemberIdsByName(node, memberName) {
            if (!node || !memberName) return [];
            const target = String(memberName).trim();
            const result = [];
            const traverse = (current) => {
                if (!current) return;
                const isTeam = !!current?.data?.isTeam;
                const currentName = String(current?.data?.name || current?.name || '').trim();
                const currentId = current?.id || current?.data?.id || null;
                if (!isTeam && currentId && currentName === target) {
                    result.push(currentId);
                }
                if (Array.isArray(current.children)) {
                    current.children.forEach(child => traverse(child));
                }
            };
            traverse(node);
            return Array.from(new Set(result));
        },
        async getMemberIdsByName(memberName, chartRoot = null) {
            const root = chartRoot || await this.getOrganizationChartRoot();
            if (!root || !memberName) return [];
            return this.findMemberIdsByName(root, memberName);
        },
        async expandEndpointWithTeamMembers(endpointList, chartRoot = null) {
            const normalized = this.normalizeEndpointList(endpointList);
            if (normalized.length === 0) {
                return { expandedEndpoint: [], teamMappedCount: 0 };
            }
            const expanded = [];
            let teamMappedCount = 0;
            for (const endpointId of normalized) {
                const members = await this.getTeamMemberIds(endpointId, chartRoot);
                if (members.length > 0) {
                    expanded.push(...members);
                    teamMappedCount += 1;
                } else {
                    expanded.push(endpointId);
                }
            }
            return {
                expandedEndpoint: Array.from(new Set(expanded)),
                teamMappedCount
            };
        },
        async getGroupTeamIds(groupId) {
            const supabase = window.$supabase;
            const tenantId = window.$tenantName || 'default';
            if (!supabase || !groupId) return [];
            const { data, error } = await supabase
                .from('org_chart_group_teams')
                .select('team_id')
                .eq('tenant_id', tenantId)
                .eq('group_id', groupId);
            if (error || !Array.isArray(data)) return [];
            return data.map(item => item.team_id).filter(Boolean);
        },
        async resolveOrganizationMembers(role, chartRoot = null) {
            const ctx = role?.roleResolutionContext || {};
            if (ctx?._type !== 'Organization') return [];
            const organizationType = ctx.organizationType;
            const organizationId = ctx.organizationId;
            const organizationName = ctx.organizationName;

            // 1) root > team > user 구조 기본 처리:
            // organizationType이 없더라도 organizationId/organizationName을 팀으로 우선 해석
            let teamMembers = [];
            if (organizationId) {
                teamMembers = await this.getTeamMemberIds(organizationId, chartRoot);
            }
            if (teamMembers.length === 0 && organizationName) {
                teamMembers = await this.getTeamMemberIdsByName(organizationName, chartRoot);
            }
            if (teamMembers.length > 0) {
                return teamMembers;
            }

            // 2) group 테이블 연동이 있는 경우에만 group 처리
            if (organizationType === 'team') {
                return [];
            }
            if (organizationType === 'group') {
                const teamIds = await this.getGroupTeamIds(organizationId);
                const memberIds = [];
                for (const teamId of teamIds) {
                    const ids = await this.getTeamMemberIds(teamId, chartRoot);
                    memberIds.push(...ids);
                }
                return Array.from(new Set(memberIds));
            }
            return [];
        },
        normalizeEndpointList(value) {
            if (Array.isArray(value)) {
                return value.map(v => String(v || '').trim()).filter(Boolean);
            }
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return [];
                return trimmed.includes(',')
                    ? trimmed.split(',').map(v => v.trim()).filter(Boolean)
                    : [trimmed];
            }
            return [];
        },
        findStartActivity() {
            const startSequence = this.processDefinition.sequences.find(sequence => sequence.source === 'start_event');
            if (startSequence) {
                return this.processDefinition.activities.find(activity => activity.id === startSequence.target);
            }
            return this.processDefinition.activities[0];
        },
        async init() {
            var me = this;
            if(me.effectiveBpmn) {
                me.processDefinition.bpmn = me.effectiveBpmn;
            }
            me.definition = me.processDefinition;

            let startActivity = null;
            if(me.isSimulate == 'true') {
                if(!me.processDefinition.activities) {
                    me.processDefinition.activities = this.processDefinition.elements.filter(element => 
                        element.elementType === 'Activity' && 
                        element.type === 'UserActivity'
                    );
                }
                startActivity = me.processDefinition.activities[me.activityIndex];
            } else {
                startActivity = this.findStartActivity();
            }
            if (startActivity) {
                if (me.isSimulate !== 'true') {
                    const newWorkItem = await this.createNewWorkItem(startActivity);
                    me.workItem = await backend.getWorkItem(newWorkItem.id);
                } else {
                    let parameters = [];
                    if (startActivity.properties) {
                        const properties = JSON.parse(startActivity.properties);
                        if (properties.parameters) {
                            parameters = properties.parameters;
                            parameters.forEach((item) => {
                                item.variable.defaultValue = "";
                            })
                        }
                    }
                    
                    let parameterValues = {};
                    if (parameters.length > 0) {
                        parameters.forEach((item) => {
                            parameterValues[item.argument.text] = item.variable.defaultValue
                        })
                    }

                    if(startActivity.tool && startActivity.tool.includes("formHandler:definition-map_")){
                        startActivity.tool = startActivity.tool.replace("formHandler:definition-map_", me.processDefinition.id + '_')
                    }

                    me.workItem = {
                        worklist: {
                            defId: me.processDefinition.id,
                            role: startActivity.role,
                            endpoint: "",
                            instId: me.instId,
                            rootInstId: me.instId,
                            taskId: me.uuid(),
                            startDate: new Date(),
                            dueDate: null,
                            status: 'TODO',
                            description: startActivity.description || "",
                            tool: startActivity.tool || ""
                        },
                        activity: {
                            name: startActivity.name,
                            tracingTag: startActivity.id || '',
                            parameters: parameters || [],
                            tool: startActivity.tool || "",
                            type: startActivity.type || "",
                            instruction: startActivity.instruction ? startActivity.instruction : "",
                            checkpoints: startActivity.checkpoints ? startActivity.checkpoints : [],
                            pythonCode: startActivity.pythonCode ? startActivity.pythonCode : ""
                        },
                        parameterValues: parameterValues || {}
                    }
                    me.renderKey++;
                }

                const roles = me.processDefinition.roles;
                const chartRoot = await this.getOrganizationChartRoot();
                me.roleMappings = await Promise.all(roles.map(async (role) => {
                    const rawRoleEndpoint = me.normalizeEndpointList(role.endpoint);
                    const endpointExpansion = await this.expandEndpointWithTeamMembers(rawRoleEndpoint, chartRoot);
                    let roleEndpoint = endpointExpansion.expandedEndpoint;
                    const roleDefault = me.normalizeEndpointList(role.default);
                    const organizationMembers = await this.resolveOrganizationMembers(role, chartRoot);
                    const autoResolvedMembers = organizationMembers.length > 0
                        ? organizationMembers
                        : roleEndpoint;
                    if (autoResolvedMembers.length > 0) {
                        roleEndpoint = autoResolvedMembers;
                    }

                    if (role.name == startActivity.role) {
                        const uid = localStorage.getItem('uid');
                        if (uid && autoResolvedMembers.length === 0) {
                            roleEndpoint = [uid];
                        }
                    }

                    const resolvedEndpoint = autoResolvedMembers.length > 0
                        ? autoResolvedMembers
                        : (roleDefault.length > 0 ? roleDefault : roleEndpoint);

                    return {
                        name: role.name,
                        endpoint: resolvedEndpoint,
                        resolutionRule: role.resolutionRule,
                        default: roleDefault
                    };
                }));


                // endpoint가 이미 채워진 role(직접 사용자 지정/조직팀 매핑)은 completion/role-binding 호출 없이 그대로 사용
                const unresolvedRoles = me.roleMappings.filter(
                    role => me.normalizeEndpointList(role.endpoint).length === 0
                );

                const shouldCallRoleBinding = unresolvedRoles.length > 0;
                if (shouldCallRoleBinding) {
                    try {
                        const roleBindings = await backend.bindRole(me.processDefinition.roles, me.processDefinition.id);
                        if (roleBindings && roleBindings.length > 0) {
                            roleBindings.forEach((roleBinding) => {
                                const role = me.roleMappings.find((item) => item.name === roleBinding.roleName);
                                if (role && me.normalizeEndpointList(role.endpoint).length === 0) {
                                    role.endpoint = roleBinding.userId ? [roleBinding.userId] : [];
                                    role.default = roleBinding.userId ? [roleBinding.userId] : [];
                                }
                            });
                        }
                    } catch (error) {
                        // role-binding 실패 시에도 실행 UI가 멈추지 않도록 무시(수동 지정 endpoint 사용)
                    }
                }
            }
        },
        async createNewWorkItem(activity) {
            if (!activity) return;
            var me = this;
            const query = `[Description]\n${activity.description}\n\n[Instruction]\n${activity.instruction}`;
            const agentMode = activity.agentMode && activity.agentMode !== 'none' ? activity.agentMode.toUpperCase() : null;
            const agentOrch = activity.orchestration && activity.orchestration !== 'none' ? activity.orchestration : null;
            let userId = localStorage.getItem('uid');
            let username = localStorage.getItem('userName');
            if (agentMode && activity.agent && activity.agent !== 'none') {
                let agent = this.defaultSetting.getAgentById(activity.agent);
                if (!agent) {
                    agent = await this.backend.getUserById(activity.agent);
                }
                if (agent) {
                    userId = agent.id;
                    username = agent.username;
                }
            }
            const newWorkItem = {
                id: me.uuid(),
                user_id: userId,
                username: username,
                proc_inst_id: me.instId,
                root_proc_inst_id: me.instId,
                proc_def_id: me.processDefinition.processDefinitionId,
                activity_id: activity.id,
                activity_name: activity.name,
                status: 'IN_PROGRESS',
                tool: activity.tool || "",
                description: activity.description || "",
                query: query || "",
                duration: activity.duration || 0,
                start_date: new Date().toISOString(),
                due_date: new Date(new Date().getTime() + activity.duration * 60 * 1000).toISOString(),
                agent_mode: agentMode || null,
                agent_orch: agentOrch || null
            }
            await backend.putWorkItem(newWorkItem.id, newWorkItem);
            return newWorkItem;
        },
        closeDialog() {
            this.$emit('close');
        },
        agentGenerationFinished(value) {
            if(value) {
                this.processDefinition.activities[this.activityIndex].inputFormData = value.formValues;
            }
            // Check if activity with same ID already exists in simulationInstances
            const existingIndex = this.simulationInstances.findIndex(
                instance => instance.id === this.processDefinition.activities[this.activityIndex].id
            );
            
            if (existingIndex !== -1) {
                // If exists, update the existing instance
                this.simulationInstances[existingIndex] = this.processDefinition.activities[this.activityIndex];
            } else {
                // If not exists, push as new instance
                this.simulationInstances.push(this.processDefinition.activities[this.activityIndex]);
            }
        },
        backToPrevStep() {
            this.activityIndex--;
            this.init();
        },
        executeFromHeader() {
            // WorkItem 컴포넌트를 통해 FormWorkItem의 executeProcess를 호출하여 폼 데이터 수집
            if (this.$refs.workItemRef && this.$refs.workItemRef.triggerExecuteProcess) {
                this.$refs.workItemRef.triggerExecuteProcess();
            } else {
                // 대체 방법으로 빈 객체로 실행
                this.executeProcess({});
            }
        },
        async executeProcess(value) {
            var me = this;

            if(me.isSimulate == 'true') {
                me.activityIndex++;
                if(me.processDefinition.activities.length == me.activityIndex) {
                    me.$try({
                        context: me,
                        action: async () => {
                            me.closeDialog();
                        },
                        successMsg: this.$t('successMsg.simulatedProcess')
                    })
                    // setTimeout(() => {
                        // me.closeDialog();
                    // }, 3000);
                } else {
                    me.init();
                }
            } else {

                let answer = '';
                if (value.user_input_text) {
                    answer = value.user_input_text;
                }

                const normalizedRoleMappings = (me.roleMappings || []).map(role => ({
                    ...role,
                    endpoint: me.normalizeEndpointList(role.endpoint),
                    default: me.normalizeEndpointList(role.default)
                }));

                let input = {
                    process_instance_id: me.instId,
                    process_definition_id: me.definitionId,
                    activity_id: me.workItem.activity.tracingTag,
                    role_mappings: normalizedRoleMappings,
                    answer: answer,
                    form_values: value || {},
                    // todolist / 엔진 쪽에서 사용할 버전 정보 전달
                    version_tag: me.processDefinition.version_tag || 'major',
                    version: me.processDefinition.version || null,
                    // 백엔드에서 프로세스 정의를 조회하기 위한 테넌트 정보 전달
                    tenant_id: window.$tenantName,
                };
                
                if (me.$refs.instanceSourceRef) {
                    input.source_list = me.$refs.instanceSourceRef.sourceList;
                }

                normalizedRoleMappings.forEach(role => {
                    if (me.workItem.worklist.role === role.name && role.endpoint) {
                        me.workItem.worklist.endpoint = role.endpoint;
                    }
                })
                
                if(me.isExecutionByProject) {
                    me.$emit('createInstance', input);
                } else {
                    backend.start(input).then(async (response) => {
                        if (response && response.error) {
                            me.handleError(response.error);
                        } else if (response) {
                            if (response && response.id && response.proc_inst_id) {
                                const path = `/instancelist/${response.proc_inst_id.replace(/\./g, '_DOT_')}`;
                                me.$router.push(path);
                            }
                        }
                    }).catch(error => {
                        me.handleError(error);
                    });
                    me.closeDialog();
                }
                
            }
        },
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },
        checkIfMobile() {
            this.isMobile = window.innerWidth <= 768;
        },
        handleError(error) {
            var me = this;
            me.$try({}, null, {
                errorMsg: `${me.processDefinition.processDefinitionName} 실행 중 오류가 발생했습니다: ${error}`
            })
        }
    }
};
</script>

<style>
.Process-gpt-execute-mobile-layout {
    height: calc(100vh - 78px);
    overflow: auto;
}
</style>