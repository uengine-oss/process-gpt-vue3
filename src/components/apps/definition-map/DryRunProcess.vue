<template>
    <v-card style="width: 100%; height: 100%">
        <v-card-title> Process 실행 </v-card-title>
        <v-card-text>
            <div v-if="dryRunActivity">
                <WorkItem :definitionId="definitionId" :isDryRun="true" :dryRunActivity="dryRunActivity"></WorkItem>
            </div>
            <div v-else-if="dryRunActivity == undefined">
                Loading...
            </div>
            <div v-else>
                Not Found...
            </div>
        </v-card-text>

        <v-card-actions class="justify-center" v-if="tool == 'DefaultWorkItem'">
            <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
            <v-btn color="error" variant="flat" @click="closeDialog()">닫기</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import WorkItem from '@/components/apps/todolist/WorkItem.vue';

export default {
    components: { WorkItem },
    props: {
        definitionId: String,
    },
    data: () => ({
        backend: null,
        dryRunActivity: undefined,
        tool: null,
    }),
    created() {
        let me = this;
        me.backend = BackendFactory.createBackend();
        me.exectueDryRun();
    },
    methods: {
        exectueDryRun(){
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    let dryRunInstance = await me.backend.getDryRunInstance(me.definitionId);
                    me.dryRunActivity = dryRunInstance.activity
                    me.tool = me.dryRunActivity.tool.includes('urlHandler') ? 'URLWorkItem' : (me.dryRunActivity.tool.includes('formHandler') ? 'FormWorkItem' : 'DefaultWorkItem');
                },
            });
        },
        executeProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    // let roleMappings = [];
                    // me.roleMappings.forEach((roleMapping) => {
                    //     let endpoints = roleMapping.roleEndpoint.split(',');
                    //     let resourceNames = roleMapping.resourceNames.split(',');
                    //     endpoints = endpoints.map((endpoint) => endpoint.trim()).filter(item => item !== "")
                    //     resourceNames = resourceNames.map((resourceName) => resourceName.trim());
                    //     if(endpoints.length > 0 ){
                    //         roleMappings.push({
                    //             name: roleMapping.roleName,
                    //             endpoints: endpoints,
                    //             resourceNames: resourceNames
                    //         });
                    //     } 
                    // });
                    // let command = {
                    //     processDefinitionId: me.definitionId,
                    // };
                    // if(roleMappings.length > 0){
                    //     command.roleMappings = roleMappings;
                    // }
                    // await me.uengine.start(command);
                    // // First Completed.
                    // // ..
                    me.closeDialog();
                },
                successMsg: 'Process 실행 완료'
            });
        },
        closeDialog() {
            this.$emit('close');
        },
    }
};
</script>
