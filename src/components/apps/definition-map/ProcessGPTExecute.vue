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
                    <!-- 모바일일 때 상단에 제출 완료 버튼 - FormWorkItem을 통해 폼 데이터 수집 -->
                    <v-row class="ma-0 pa-0 align-center">
                        <v-icon v-if="isSimulate == 'true' && isFinishedAgentGeneration"
                            class="bouncing-arrow-horizontal" 
                            color="primary" 
                            size="large"
                        >
                            mdi-arrow-right-bold
                        </v-icon>
                        <v-btn v-if="!isCompleted"
                            @click="executeFromHeader"
                            color="primary" 
                            density="compact"
                            variant="flat"
                            rounded
                            class="mr-2"
                        >제출 완료
                        </v-btn>
                    </v-row>
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
                <div v-if="isSimulate == 'false'" :class="isMobile ? 'pa-4 pb-0' : 'pa-4'" style="min-width: 300px;">
                    <v-row class="ma-0 pa-0">
                        <div class="text-h5 font-weight-semibold">{{ $t('ProcessGPTExecute.roleMapping') }}</div>
                    </v-row>
                    <div class="mt-4">
                        <div v-for="roleMapping in roleMappings" :key="roleMapping.name">
                            <user-select-field v-model="roleMapping.endpoint"
                                :name="roleMapping.name"
                                :item-value="'email'"
                                :hide-details="true"
                                :use-agent="true"
                            ></user-select-field>
                        </div>
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

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        AppBaseCard,
        WorkItem,
        UserSelectField
    },
    props: {
        definitionId: String,
        isSimulate: String,
        bpmn: String,
        processDefinition: Object,
        isExecutionByProject: {
            type: Boolean,
            default: false
        },
    },
    data: () => ({
        definition: {},
        workItem: null,
        roleMappings: [],
        isMobile: false,
        activityIndex: 0,
        renderKey: 0,
        simulationInstances: [],
    }),
    async mounted() {
        await this.init();
        this.checkIfMobile();
        window.addEventListener('resize', this.checkIfMobile);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.checkIfMobile);
    },
    computed: {
        isFinishedAgentGeneration() {
            return this.$refs.workItemRef && this.$refs.workItemRef.isFinishedAgentGeneration || false;
        },
        isCompleted() {
            return this.$refs.workItemRef && this.$refs.workItemRef.isCompleted || false;
        }
    },
    methods: {
        findStartActivity() {
            const startSequence = this.processDefinition.sequences.find(sequence => sequence.source === 'start_event');
            if (startSequence) {
                return this.processDefinition.activities.find(activity => activity.id === startSequence.target);
            }
            return this.processDefinition.activities[0];
        },
        async init() {
            var me = this;
            if(me.bpmn) {
                me.processDefinition.bpmn = me.bpmn;
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
                let parameters = [];
                let variableForHtmlFormContext = {};
                if (startActivity.properties) {
                    const properties = JSON.parse(startActivity.properties);
                    if (properties.parameters) {
                        parameters = properties.parameters;
                        parameters.forEach((item) => {
                            item.variable.defaultValue = "";
                        })
                    }
                    if (properties.variableForHtmlFormContext) {
                        variableForHtmlFormContext = properties.variableForHtmlFormContext;
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
                        instId: "",
                        rootInstId: null,
                        taskId: this.uuid(),
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
                        variableForHtmlFormContext: variableForHtmlFormContext || {},
                        tool: startActivity.tool || "",
                        type: startActivity.type || "",
                        instruction: startActivity.instruction ? startActivity.instruction : "",
                        checkpoints: startActivity.checkpoints ? startActivity.checkpoints : [],
                        pythonCode: startActivity.pythonCode ? startActivity.pythonCode : ""
                    },
                    parameterValues: parameterValues || {}
                }
                me.renderKey++;

                let activities = me.processDefinition.activities.filter((activity) => activity.agentMode && activity.agentMode != 'none');
                const roles = me.processDefinition.roles;
                let hasDefaultRole = false;
                me.roleMappings = roles.map((role) => {
                    if(role.default && role.default.length > 0) {
                        hasDefaultRole = true;
                    }

                    return {
                        name: role.name,
                        endpoint: role.default || role.endpoint,
                        resolutionRule: role.resolutionRule,
                        default: role.default || "",
                    };
                });

                if (!hasDefaultRole) {
                    const roleBindings = await backend.bindRole(me.processDefinition.roles, me.processDefinition.id);
                    if (roleBindings && roleBindings.length > 0) {
                        roleBindings.forEach((roleBinding) => {
                            let role = me.roleMappings.find((role) => role.name === roleBinding.roleName);
                            if(role && role.endpoint == '') {
                                role['endpoint'] = roleBinding.userId;
                                role['default'] = roleBinding.userId;
                            }
                        })
                    }
                }
            }
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

                let input = {
                    process_definition_id: me.definitionId,
                    activity_id: me.workItem.activity.tracingTag,
                    role_mappings: me.roleMappings,
                    answer: answer,
                    form_values: value || {}
                };
                me.roleMappings.forEach(role => {
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