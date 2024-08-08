<template>
    <v-card flat class="w-100">
        <div :class="{'d-flex': !isMobile}">
            <div class="pa-4" style="min-width: 300px;">
                <div style="font-size: 20px; font-weight: 500">Role Mapping</div>
                <div class="mt-4">
                    <div v-for="roleMapping in roleMappings" :key="roleMapping.name">
                        <user-select-field v-model="roleMapping.endpoint" 
                            :name="roleMapping.name"
                            :item-value="'email'"
                        ></user-select-field>
                    </div>
                </div>
            </div>
            <div class="w-100 pa-2">
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
                    Loading...                    
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
                            endpoint: ""
                        };
                    });

                    const roleBindings = await backend.bindRole(me.definition.roles);
                    if (roleBindings && roleBindings.length > 0) {
                        roleBindings.forEach((roleBinding) => {
                            me.roleMappings.find((role) => role.name === roleBinding.roleName).endpoint = roleBinding.userId;
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
                                    if (item.direction == 'OUT') {
                                        item.direction = 'IN';
                                    } else if (item.direction == 'IN') {
                                        item.direction = 'OUT';
                                    }
                                    item.variable.defaultValue = "";
                                })
                            } else if (properties.variableForHtmlFormContext) {
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
                                instruction: startActivity.instruction ? startActivity.instruction : "",
                                checkpoints: startActivity.checkpoints ? startActivity.checkpoints : []
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
            me.$try({
                context: me,
                action: async () => {
                    let input = {
                        process_definition_id: me.definitionId,
                        activity_id: me.workItem.activity.tracingTag,
                        role_mappings: me.roleMappings,
                        answer: value
                    };
                    me.roleMappings.forEach(role => {
                        if (me.workItem.worklist.role === role.name && role.endpoint) {
                            me.workItem.worklist.endpoint = role.endpoint;
                        }
                    })
                    const result = await backend.start(input);
                    if (result && result.errors && result.errors.length > 0) {
                    } else {
                        me.closeDialog();
                        me.EventBus.emit('instances-updated');
                        me.$router.push(`/instancelist/${btoa(result.instanceId)}`);
                    }
                },
                successMsg: 'Process 실행 완료'
            });
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
        }
    }
};
</script>
