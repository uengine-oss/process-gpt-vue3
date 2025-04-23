<template>
    <v-card flat class="w-100">
        <v-row class="ma-0 pa-4 pb-0">
            <h2>{{ $t('ProcessGPTExecute.processStart') }}</h2>
            <v-spacer></v-spacer>
            <div class="form-work-item-mobile ml-auto" v-if="!isCompleted">
                <v-btn @click="executeProcess" color="primary" rounded>제출 완료</v-btn>
            </div>
        </v-row>
        <div :class="isMobile ? 'Process-gpt-execute-mobile-layout' : 'd-flex'">
            <div :class="isMobile ? 'pa-4 pb-0' : 'pa-4'" style="min-width: 300px;">
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
                        @close="closeDialog"
                        @executeProcess="executeProcess"
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
    },
    data: () => ({
        definition: null,
        workItem: null,
        roleMappings: [],
        organizationChart: {},
        userList: [],
        isMobile: false,
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
                    const defInfo = await backend.getRawDefinition(me.definitionId);
                    me.definition = defInfo.definition;
                    
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
                    
                    const startActivity = me.definition.activities[0];
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
                    }
                }
            });
        },
        closeDialog() {
            this.$emit('close');
        },
        async executeProcess(value) {
            var me = this;

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
            
            backend.start(input).then((result) => {
                me.EventBus.emit('instances-updated');
                const encodedInstanceId = btoa(encodeURIComponent(result.instanceId));
                const path = `/instancelist/${encodedInstanceId}`;
                me.$router.push(path);
            })
            .catch(error => {
                me.handleError(error);
            });
            
            me.EventBus.emit('instances-running', me.definition.processDefinitionName);

            me.$try({
                context: me,
                action: async () => {
                    me.closeDialog();
                },
                successMsg: this.$t('successMsg.runningTheProcess')
            })
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
            me.$try({
                context: me,
                action: async () => {
                    console.log(error);
                },
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
