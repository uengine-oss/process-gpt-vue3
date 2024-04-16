<template>
    <v-card>
        <v-card-title>
            Process 실행
        </v-card-title>

        <v-card-text>
            <!-- Role Mapping Context -->
            <v-col>
                <v-row v-for="roleMapping in roleMappings">
                    <v-text-field label="Role Name" v-model="roleMapping.roleName"></v-text-field>
                    <v-text-field label="Role Endpoint" v-model="roleMapping.roleEndpoint"></v-text-field>
                    <v-text-field label="Resource Names" v-model="roleMapping.resourceNames"></v-text-field>
                </v-row>
            </v-col>
            <v-col>
                <v-btn @click="addRoleMapping">Role Mapping 추가</v-btn>
            </v-col>
        </v-card-text>

        <v-card-actions class="justify-center">
            <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
            <v-btn color="error" variant="flat" @click="closeDialog('add')">닫기</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import BpmnRoleParameterContexts from '@/components/designer/bpmnModeling/bpmn/role/BpmnRoleParameterContexts.vue';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    components: { BpmnRoleParameterContexts },
    props: {
        definitionId: String
    },
    data: () => ({
        newProcess: {
            id: "",
            label: ""
        },
        uengine: null,
        isNewDef: false,
        addDialog: false,
        updateDialog: false,
        roleName: "initiator",
        roleEndpoint: "initiator@uengine.org",
        resourceNames: "Initiator",
        roleMappings: []
    }),
    computed: {
    },
    watch: {

    },
    created() {
        this.uengine = BackendFactory.createBackend();
    },
    methods: {
        async executeProcess() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    let command = {
                        "processDefinitionId": me.definitionId,
                        "roleMappings": me.roleMappings
                    }
                    await me.uengine.start(command);
                },
                successMsg: "Process 실행 완료"
            })

        },
        addRoleMapping() {
            this.roleMappings.push({
                roleName: "",
                roleEndpoint: "",
                resourceNames: ""
            })
        }
    }
}
</script>