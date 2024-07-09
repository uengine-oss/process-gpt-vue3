<template>
    <v-card style="width: 100%;" class="py-4">
        <AppBaseCard>
            <template v-slot:leftpart>
                <v-card flat>
                    <v-card-title>
                        <v-row class="ma-0 pa-0 mt-1 ml-3" style="line-height: 100%">
                            <div style="font-size: 20px; font-weight: 500">Role Mapping</div>
                        </v-row>
                    </v-card-title>
                    <v-card-text>
                        <div class="mt-4">
                            <div v-for="roleMapping in roleMappings" :key="roleMapping.name">
                                <user-select-field v-model="roleMapping.endpoint" 
                                    :name="roleMapping.name"
                                    :item-value="'email'"
                                ></user-select-field>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </template>

            <template v-slot:rightpart>
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
            </template>

            <template v-slot:mobileLeftContent>
                <v-card flat>
                    <v-card-title>
                        <v-row class="ma-0 pa-0 mt-1 ml-3" style="line-height: 100%">
                            <div style="font-size: 20px; font-weight: 500">Role Mapping</div>
                        </v-row>
                    </v-card-title>
                    <v-card-text>
                        <div class="mt-4">
                            <div v-for="roleMapping in roleMappings" :key="roleMapping.name">
                                <user-select-field v-model="roleMapping.endpoint" 
                                    :name="roleMapping.name"
                                    :item-value="'email'"
                                ></user-select-field>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </template>

            <!-- <v-card-actions class="justify-center">
                <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
                <v-btn color="error" variant="flat" @click="closeDialog()">닫기</v-btn>
            </v-card-actions> -->
        </AppBaseCard>
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
    }),
    created() {
        this.init();
    },
    methods: {
        async init() {
            var me = this;
            const defInfo= await backend.getRawDefinition(me.definitionId);
            me.definition = defInfo.definition;

            const startActivity = me.definition.activities[0];
            if (startActivity) {
                let parameters = [];
                if (startActivity.properties) {
                    parameters = JSON.parse(startActivity.properties).parameters;
                    parameters.forEach((item) => {
                        if (item.direction == 'OUT') {
                            item.direction = 'IN';
                        } else if (item.direction == 'IN') {
                            item.direction = 'OUT';
                        }
                        item.variable.defaultValue = "";
                    })
                } else {
                    parameters = [];
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
                        variableForHtmlFormContext: {},
                        tool: startActivity.tool || ""
                    },
                    parameterValues: parameterValues || {}
                }
                me.roleMappings = me.definition.roles.map((role) => {
                    return {
                        name: role.name,
                        endpoint: ""
                    };
                });
            }
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
                    await backend.start(input);
                    me.closeDialog();
                    me.EventBus.emit('instances-updated');
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
        }
    }
};
</script>
