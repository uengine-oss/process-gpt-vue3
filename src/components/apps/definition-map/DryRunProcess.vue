<template>
    <v-card style="width: 100%; height: 100%">
        <v-card-title> Process 실행 </v-card-title>
        <v-card-text>
            <div v-if="dryRunWorkItem">
                <WorkItem :definitionId="definitionId" :is-simulate="isSimulate" :isDryRun="true" :dryRunWorkItem="dryRunWorkItem" @close="closeDialog"></WorkItem>
            </div>
            <div v-else-if="dryRunWorkItem == undefined">
                Loading...
            </div>
            <div v-else>
                Not Found...
            </div>
        </v-card-text>

        <!-- <v-card-actions class="justify-center" v-if="tool == 'DefaultWorkItem'">
            <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
            <v-btn color="error" variant="flat" @click="closeDialog()">닫기</v-btn>
        </v-card-actions> -->
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import WorkItem from '@/components/apps/todolist/WorkItem.vue';

export default {
    components: { WorkItem },
    props: {
        definitionId: String, // proceeName (proceeName.bpmn)
        isSimulate: String
    },
    data: () => ({
        backend: null,
        dryRunWorkItem: undefined,
    }),
    created() {
        let me = this;
        me.backend = BackendFactory.createBackend();
        me.dryRun();
    },
    methods: {
        dryRun(){
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    console.log(me.isSimulate)
                    me.dryRunWorkItem = await me.backend.dryRun(me.definitionId, me.isSimulate);
                },
            });
        },
        closeDialog() {
            this.$emit('close');
        },
    }
};
</script>
