<template>
    <div :key="renderKey">
        <v-card flat class="w-100">
            <v-row class="ma-0 pa-4 pb-0">
                <h2 v-if="isSimulate == 'true'">{{ $t('ProcessGPTExecute.processSimulate') }}</h2>
                <h2 v-else>{{ $t('ProcessGPTExecute.processStart') }}</h2>
                <v-spacer></v-spacer>
                <div class="form-work-item-mobile ml-auto" v-if="!isCompleted">
                    <v-btn @click="executeProcess" color="primary" rounded>제출 완료</v-btn>
                </div>
            </v-row>
            <div :class="isMobile ? 'Process-gpt-execute-mobile-layout' : 'd-flex'">
                <div v-if="isSimulate == 'false'" :class="isMobile ? 'pa-4 pb-0' : 'pa-4'" style="min-width: 300px;">
                    <v-row class="ma-0 pa-0">
                        <div style="font-size: 20px; font-weight: 500">{{ $t('ProcessGPTExecute.roleMapping') }}</div>
                    </v-row>
                    <div class="mt-4">
                        <div v-for="roleMapping in roleMappings" :key="roleMapping.name">
                            <user-select-field v-model="roleMapping.endpoint"
                                :name="roleMapping.name"
                                :item-value="'email'"
                                :hide-details="true"
                            ></user-select-field>
                        </div>
                    </div>
                </div>
                <div class="w-100">
                    <div v-if="workItem != null">
                        <WorkItem 
                            :definitionId="definitionId" 
                            :dryRunWorkItem="workItem" 
                            :isDryRun="true"
                            :isSimulate="isSimulate"
                            :simulationInstances="simulationInstances"
                            :activityIndex="activityIndex"
                            :processDefinition="processDefinition"
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
import OrganizationChart from "@/components/ui/OrganizationChart.vue";
import UserSelectField from '@/components/ui/field/UserSelectField.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        AppBaseCard,
        WorkItem,
        OrganizationChart,
        UserSelectField
    },
    props: {
        definitionId: String,
        isSimulate: String,
        bpmn: String,
        processDefinition: Object,
    },
    data: () => ({
        definition: null,
        workItem: null,
        roleMappings: [],
        organizationChart: {},
        userList: [],
        isMobile: false,
        activityIndex: 0,
        renderKey: 0,
        simulationInstances: [],
    }),
    created() {
        this.init();
        this.checkIfMobile();
        window.addEventListener('resize', this.checkIfMobile);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.checkIfMobile);
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                action: async () => {
                    if(me.isSimulate == 'true') {
                        me.processDefinition.bpmn = me.bpmn;
                        me.definition = me.processDefinition;
                    } else {
                        const defInfo = await backend.getRawDefinition(me.definitionId);
                        me.definition = defInfo.definition;
                    }
                    
                    me.roleMappings = me.definition.roles.map((role) => {
                        return {
                            name: role.name,
                            endpoint: "",
                            resolutionRule: role.resolutionRule
                        };
                    });

                    const roleBindings = await backend.bindRole(me.definition.roles);
                    if (roleBindings && roleBindings.length > 0) {
                        roleBindings.forEach((roleBinding) => {
                            let role = me.roleMappings.find((role) => role.name === roleBinding.roleName);
                            if(role) {
                                role['endpoint'] = roleBinding.userId;
                            }
                        })
                    }

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
                        startActivity = me.definition.activities[0];
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
                            startActivity.tool = startActivity.tool.replace("formHandler:definition-map_", me.definitionId + '_')
                        }

                        me.workItem = {
                            worklist: {
                                defId: me.definitionId,
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
                    }
                }
            });
        },
        closeDialog() {
            this.$emit('close');
        },
        agentGenerationFinished(value) {
            if(value) {
                this.processDefinition.activities[this.activityIndex].inputFormData = value.formValues;
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
            }
        },
        backToPrevStep() {
            this.activityIndex--;
            this.init();
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

                let formId = ''
                if (me.workItem.activity.tool) formId = me.workItem.activity.tool.replace('formHandler:', '');
                let formValues = {};
                if (formId) {
                    const formatted = value;
                    delete formatted.user_input_text;
                    formValues[formId] = formatted;
                }

                let input = {
                    process_definition_id: me.definitionId,
                    activity_id: me.workItem.activity.tracingTag,
                    role_mappings: me.roleMappings,
                    answer: answer,
                    form_values: formValues
                };
                me.roleMappings.forEach(role => {
                    if (me.workItem.worklist.role === role.name && role.endpoint) {
                        me.workItem.worklist.endpoint = role.endpoint;
                    }
                })
                
                backend.start(input).then(async (response) => {
                    if (response && response.error) {
                        me.handleError(response.error);
                    } else if (response) {
                        let receivedText = "";
                        const { reader, decoder } = response;

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                    
                            const chunk = decoder.decode(value, { stream: true });
                            receivedText += chunk;
                            me.EventBus.emit('process-instance-streaming', receivedText);
                        }

                        let result = {};
                        if (receivedText.includes("```json")) {
                            const textArr = receivedText.replace(/```json/g, "").split(/```/g);
                            const jsonText = textArr.shift();
                            result = JSON.parse(jsonText);
                        }

                        if (result && result.instanceId) {
                            const encodedInstanceId = btoa(encodeURIComponent(result.instanceId));
                            const path = `/instancelist/${encodedInstanceId}`;
                            me.$router.push(path);
                        }
                    }
                    me.EventBus.emit('instances-updated');
                });
                
                me.closeDialog();
                me.EventBus.emit('instances-running', me.definition.processDefinitionName);
                const path = `/instancelist/running?proc_def_id=${me.definition.processDefinitionId}`;
                me.$router.push(path);

                me.$try({
                    context: me,
                    action: () => {
                    },
                    successMsg: this.$t('successMsg.runningTheProcess')
                })
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
            this.isMobile = window.innerWidth <= 1080;
        },
        handleError(error) {
            var me = this;
            me.$try({}, null, {
                errorMsg: `${me.definition.processDefinitionName} 실행 중 오류가 발생했습니다: ${error}`
            })
        }
    }
};
</script>

<style>
.Process-gpt-execute-mobile-layout {
    height:85vh;
    overflow: auto;
}
</style>
