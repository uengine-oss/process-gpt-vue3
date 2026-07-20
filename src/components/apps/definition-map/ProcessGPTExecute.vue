<template>
    <div :key="renderKey">
        <v-card flat class="w-100">
            <v-row :class="isMobile ? 'ma-0 pa-4 pb-0 flex-column align-start' : 'ma-0 pa-4 pb-0 align-center'">
                <div v-if="isSimulate == 'true'" class="text-h4 font-weight-semibold">{{ $t('ProcessGPTExecute.processSimulate') }}</div>
                <div v-else class="text-h4 font-weight-semibold">{{ processDefinition.processDefinitionName }}</div>
                <!-- 시뮬레이션 모드일 때만 단위 테스트 탭 노출 -->
                <v-tabs v-if="isSimulate == 'true'" v-model="topTab" color="primary" density="compact" class="ml-4">
                    <v-tab value="execute">
                        <v-icon start size="18">mdi-play-circle-outline</v-icon>
                        {{ $t('ProcessGPTExecute.processSimulate') }}
                    </v-tab>
                    <v-tab value="unit-test">
                        <v-icon start size="18">mdi-clipboard-check-multiple-outline</v-icon>
                        {{ $t('ProcessUnitTest.unitTest') }}
                    </v-tab>
                </v-tabs>
                <v-spacer v-if="!isMobile"></v-spacer>
                <div v-if="isMobile" class="d-flex align-center mt-2 ml-auto">
                    <v-btn @click="closeDialog" rounded density="compact" style="background-color: #808080; color: white">닫기</v-btn>
                </div>
                <div v-else>
                    <v-btn @click="closeDialog" class="ml-auto" variant="text" density="compact" icon>
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>
            </v-row>

            <!-- 단위 테스트 탭 -->
            <div v-if="isSimulate == 'true' && topTab === 'unit-test'" class="pa-4">
                <v-row class="ma-0">
                    <v-col cols="12" md="6" class="pa-2">
                        <v-card variant="outlined" class="pa-2" style="height: calc(100vh - 200px); overflow: auto">
                            <BpmnUengine
                                ref="unitTestBpmnVue"
                                :bpmn="effectiveBpmn || bpmn"
                                :options="bpmnViewerOptions"
                                :isViewMode="true"
                                style="height: 100%"
                            />
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="6" class="pa-2" style="max-height: calc(100vh - 200px); overflow-y: auto">
                        <ProcessUnitTestPanel
                            :definition-id="resolvedDefinitionId"
                            :bpmn="effectiveBpmn || bpmn"
                            :bpmn-viewer-component="$refs.unitTestBpmnVue"
                            :process-definition="processDefinition"
                        />
                    </v-col>
                </v-row>
            </div>

            <div v-else :class="isMobile ? 'Process-gpt-execute-mobile-layout' : 'd-flex'">
                <div v-if="isSimulate == 'false'" class="pa-4">
                    <v-row class="ma-0 pa-0">
                        <div class="text-h5 font-weight-semibold">{{ $t('ProcessGPTExecute.roleMapping') }}</div>
                    </v-row>
                    <div class="mt-4">
                        <div v-for="role in roleMappings" :key="role.name">
                            <user-select-field
                                v-model="role.endpoint"
                                :name="role.name"
                                :item-value="'id'"
                                :hide-details="true"
                                :use-agent="true"
                                :use-multiple="true"
                            ></user-select-field>
                        </div>
                    </div>
                    <div v-if="isSimulate == 'false'">
                        <div class="text-h5 font-weight-semibold">{{ $t('InstanceCard.source') }}</div>
                        <InstanceSource
                            ref="instanceSourceRef"
                            :isStarted="isStarted"
                            :instId="instId"
                            :processDefinitionId="resolvedDefinitionId"
                        />
                    </div>
                </div>
                <div class="w-100">
                    <div v-if="workItem != null">
                        <WorkItem
                            ref="workItemRef"
                            :definitionId="resolvedDefinitionId"
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
                            @close="closeDialog"
                            @executeProcess="executeProcess"
                            @backToPrevStep="backToPrevStep"
                            @agentGenerationFinished="agentGenerationFinished"
                        ></WorkItem>
                    </div>
                    <div v-else>
                        <v-row class="ma-0 pa-0 execute-skeleton-top" style="height: 100%">
                            <v-col cols="12" class="pa-4">
                                <v-skeleton-loader type="card"></v-skeleton-loader>
                            </v-col>
                        </v-row>
                        <v-row class="ma-0 pa-0 execute-skeleton-bottom" style="height: 100%">
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
import ProcessUnitTestPanel from '@/components/apps/definition-map/ProcessUnitTestPanel.vue';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
import customBpmnModule from '@/components/customBpmn';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import { useDefaultSetting } from '@/stores/defaultSetting';
import { useBpmnStore } from '@/stores/bpmn';

export default {
    setup() {
        const defaultSetting = useDefaultSetting();
        return {
            defaultSetting
        };
    },
    components: {
        AppBaseCard,
        WorkItem,
        UserSelectField,
        InstanceSource,
        ProcessUnitTestPanel,
        BpmnUengine
    },
    props: {
        definitionId: String,
        isSimulate: String,
        bpmn: String,
        processDefinition: Object,
        deployDefinitionId: {
            type: String,
            default: ''
        },
        deployVersion: {
            type: String,
            default: ''
        },
        isExecutionByProject: {
            type: Boolean,
            default: false
        }
    },
    data: () => ({
        definition: {},
        workItem: null,
        instId: '',
        effectiveBpmn: '',
        roleMappings: [],
        isMobile: false,
        activityIndex: 0,
        renderKey: 0,
        simulationInstances: [],
        isStarted: true,
        // 시뮬레이션/단위테스트 전환용 상단 탭.
        topTab: 'execute',
        bpmnViewerOptions: {
            additionalModules: [customBpmnModule]
        }
    }),
    async mounted() {
        const defId = this.resolvedDefinitionId;
        if (defId) {
            if (this.isSimulate === 'false') {
                // 실행 모드: 운영 버전(major 태그 최신) 기준으로 정의 로딩
                try {
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
                } catch (e) {
                    console.error(e);
                }
            } else {
                // 시뮬레이션 모드: 항상 proc_def(현재 정의) 기준으로 로딩
                try {
                    const simDef = await backend.getSimulationDefinition(defId);
                    if (simDef) {
                        if (simDef.definition) {
                            Object.assign(this.processDefinition, simDef.definition);
                        }
                        if (simDef.bpmn) {
                            this.effectiveBpmn = simDef.bpmn;
                        }
                    }
                } catch (e) {
                    console.error(e);
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
    beforeUnmount() {
        window.removeEventListener('resize', this.checkIfMobile);
        // 단위 테스트 인스턴스 잔재 정리.
        try {
            const store = useBpmnStore();
            store.clearRunningActivityIds();
            store.clearCompletedActivityIds();
        } catch (e) {
            /* ignore */
        }
    },
    computed: {
        resolvedDefinitionId() {
            return this.processDefinition?.processDefinitionId || this.definitionId || '';
        },
        isFinishedAgentGeneration() {
            return (this.$refs.workItemRef && this.$refs.workItemRef.isFinishedAgentGeneration) || false;
        },
        isCompleted() {
            return (this.$refs.workItemRef && this.$refs.workItemRef.isCompleted) || false;
        },
        disableAdvancedResearch() {
            return this.isSimulate == 'true' ? true : false;
        },
        unitTestMarkerSnapshot() {
            const store = useBpmnStore();
            const running = Array.isArray(store.runningActivityIds) ? store.runningActivityIds : [];
            const completed = Array.isArray(store.completedActivityIds) ? store.completedActivityIds : [];
            return running.join(',') + '|' + completed.join(',');
        }
    },
    watch: {
        // 단위 테스트 실행 중 활성/완료 활동 id 변경을 임베드된 viewer 캔버스에 반영.
        unitTestMarkerSnapshot() {
            this.applyUnitTestMarkers();
        },
        topTab(newVal) {
            // 단위 테스트 탭으로 전환 시 마커 재적용 (viewer 재마운트 대비).
            if (newVal === 'unit-test') {
                this.$nextTick(() => this.applyUnitTestMarkers());
            }
        }
    },
    methods: {
        // 단위 테스트 진행 상황을 임베드된 BpmnUengineViewer 캔버스에 반영.
        applyUnitTestMarkers() {
            const viewer = this.$refs.unitTestBpmnVue && this.$refs.unitTestBpmnVue.bpmnViewer;
            if (!viewer) return;
            let canvas, elementRegistry;
            try {
                canvas = viewer.get('canvas');
                elementRegistry = viewer.get('elementRegistry');
            } catch (e) {
                return;
            }
            const store = useBpmnStore();
            const running = new Set((store.runningActivityIds || []).filter(Boolean).map(String));
            const completed = new Set((store.completedActivityIds || []).filter(Boolean).map(String));
            const prevRunning = this._markedRunningIds instanceof Set ? this._markedRunningIds : new Set();
            const prevCompleted = this._markedCompletedIds instanceof Set ? this._markedCompletedIds : new Set();
            const diff = (prev, next, marker) => {
                prev.forEach((id) => {
                    if (!next.has(id) && elementRegistry.get(id)) {
                        try {
                            canvas.removeMarker(id, marker);
                        } catch (e) {}
                    }
                });
                next.forEach((id) => {
                    if (elementRegistry.get(id)) {
                        try {
                            canvas.addMarker(id, marker);
                        } catch (e) {}
                    }
                });
            };
            diff(prevRunning, running, 'running');
            diff(prevCompleted, completed, 'completed');
            this._markedRunningIds = running;
            this._markedCompletedIds = completed;
        },
        findStartActivity() {
            const startSequence = this.processDefinition.sequences.find((sequence) => sequence.source === 'start_event');
            if (startSequence) {
                return this.processDefinition.activities.find((activity) => activity.id === startSequence.target);
            }
            return this.processDefinition.activities[0];
        },
        async init() {
            var me = this;
            if (me.effectiveBpmn) {
                me.processDefinition.bpmn = me.effectiveBpmn;
            }
            me.definition = me.processDefinition;

            let startActivity = null;
            if (me.isSimulate == 'true') {
                if (!me.processDefinition.activities) {
                    me.processDefinition.activities = this.processDefinition.elements.filter(
                        (element) => element.elementType === 'Activity' && element.type === 'UserActivity'
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
                                item.variable.defaultValue = '';
                            });
                        }
                    }

                    let parameterValues = {};
                    if (parameters.length > 0) {
                        parameters.forEach((item) => {
                            parameterValues[item.argument.text] = item.variable.defaultValue;
                        });
                    }

                    if (startActivity.tool && startActivity.tool.includes('formHandler:definition-map_')) {
                        startActivity.tool = startActivity.tool.replace('formHandler:definition-map_', me.processDefinition.id + '_');
                    }

                    me.workItem = {
                        worklist: {
                            defId: me.processDefinition.id,
                            role: startActivity.role,
                            endpoint: '',
                            instId: me.instId,
                            rootInstId: me.instId,
                            taskId: me.uuid(),
                            startDate: new Date().toISOString(),
                            dueDate: null,
                            status: 'TODO',
                            description: startActivity.description || '',
                            tool: startActivity.tool || ''
                        },
                        activity: {
                            name: startActivity.name,
                            tracingTag: startActivity.id || '',
                            parameters: parameters || [],
                            tool: startActivity.tool || '',
                            type: startActivity.type || '',
                            instruction: startActivity.instruction ? startActivity.instruction : '',
                            checkpoints: startActivity.checkpoints ? startActivity.checkpoints : [],
                            pythonCode: startActivity.pythonCode ? startActivity.pythonCode : ''
                        },
                        parameterValues: parameterValues || {}
                    };
                    me.renderKey++;
                }

                function isUUID(uuid) {
                    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    return regex.test(uuid);
                }
                const roles = me.processDefinition.roles;
                let hasDefaultRole = false;
                me.roleMappings = roles.map((role) => {
                    let disabled = 'false';
                    if (role.name == startActivity.role) {
                        const uid = localStorage.getItem('uid');
                        role.endpoint = uid;
                        disabled = 'true';
                    } else if (role.default && role.default.length > 0) {
                        hasDefaultRole = true;
                        if (Array.isArray(role.default)) {
                            role.default = role.default.filter((item) => isUUID(item));
                        } else {
                            role.default = isUUID(role.default) ? role.default : '';
                        }
                    } else {
                        hasDefaultRole = false;
                        role.endpoint = isUUID(role.endpoint) ? role.endpoint : '';
                    }
                    return {
                        name: role.name,
                        endpoint: hasDefaultRole ? role.default : role.endpoint,
                        resolutionRule: role.resolutionRule,
                        default: hasDefaultRole ? role.default : ''
                        // disabled: disabled
                    };
                });

                if (!hasDefaultRole) {
                    const roleBindings = await backend.bindRole(me.processDefinition.roles, me.processDefinition.id);
                    if (roleBindings && roleBindings.length > 0) {
                        roleBindings.forEach((roleBinding) => {
                            let role = me.roleMappings.find((role) => role.name === roleBinding.roleName);
                            if (role && role.endpoint == '') {
                                role['endpoint'] = roleBinding.userId;
                                role['default'] = roleBinding.userId;
                            }
                        });
                    }
                }
            }
        },
        async createNewWorkItem(activity) {
            if (!activity) return;
            var me = this;
            const query = `[Description]\n${activity.description}\n\n[Instruction]\n${activity.instruction}`;

            // enum 유효성 검사
            const validAgentModes = ['DRAFT', 'COMPLETE'];
            const validAgentOrch = [
                'crewai-action',
                'openai-deep-research',
                'crewai-deep-research',
                'deep-research-custom',
                'deepagents',
                'langchain-react',
                'browser-automation-agent',
                'a2a',
                'visionparse'
            ];

            const rawAgentMode = activity.agentMode && activity.agentMode !== 'none' ? activity.agentMode.toUpperCase() : null;
            const agentMode = rawAgentMode && validAgentModes.includes(rawAgentMode) ? rawAgentMode : null;

            const rawAgentOrch = activity.orchestration && activity.orchestration !== 'none' ? activity.orchestration : null;
            const agentOrch = rawAgentOrch && validAgentOrch.includes(rawAgentOrch) ? rawAgentOrch : null;
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
                tool: activity.tool || '',
                description: activity.description || '',
                query: query || '',
                duration: activity.duration || 0,
                start_date: new Date().toISOString(),
                due_date: new Date(new Date().getTime() + activity.duration * 60 * 1000).toISOString(),
                agent_mode: agentMode || null,
                agent_orch: agentOrch || null
            };
            await backend.putWorkItem(newWorkItem.id, newWorkItem);
            return newWorkItem;
        },
        closeDialog() {
            this.$emit('close');
        },
        agentGenerationFinished(value) {
            if (value) {
                this.processDefinition.activities[this.activityIndex].inputFormData = value.formValues;
            }
            // Check if activity with same ID already exists in simulationInstances
            const existingIndex = this.simulationInstances.findIndex(
                (instance) => instance.id === this.processDefinition.activities[this.activityIndex].id
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

            if (me.isSimulate == 'true') {
                me.activityIndex++;
                if (me.processDefinition.activities.length == me.activityIndex) {
                    me.$try({
                        context: me,
                        action: async () => {
                            me.closeDialog();
                        },
                        successMsg: this.$t('successMsg.simulatedProcess')
                    });
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

                let input = {
                    process_instance_id: me.instId,
                    process_definition_id: me.resolvedDefinitionId,
                    activity_id: me.workItem.activity.tracingTag,
                    role_mappings: me.roleMappings,
                    answer: answer,
                    form_values: value || {},
                    // todolist / 엔진 쪽에서 사용할 버전 정보 전달
                    version_tag: me.processDefinition.version_tag || 'major',
                    version: me.processDefinition.version || null,
                    // 백엔드에서 프로세스 정의를 조회하기 위한 테넌트 정보 전달
                    tenant_id: window.$tenantName
                };

                if (me.$refs.instanceSourceRef) {
                    input.source_list = me.$refs.instanceSourceRef.sourceList;
                }

                me.roleMappings.forEach((role) => {
                    if (me.workItem.worklist.role === role.name && role.endpoint) {
                        me.workItem.worklist.endpoint = role.endpoint;
                    }
                });

                if (me.isExecutionByProject) {
                    me.$emit('createInstance', input);
                } else {
                    backend
                        .start(input)
                        .then(async (response) => {
                            if (response && response.error) {
                                me.handleError(response.error);
                            } else if (response) {
                                if (response && response.id && response.proc_inst_id) {
                                    const path = `/instancelist/${response.proc_inst_id.replace(/\./g, '_DOT_')}`;
                                    me.$router.push({ path, query: { tab: 'todo' } });
                                }
                            }
                        })
                        .catch((error) => {
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
            });
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
