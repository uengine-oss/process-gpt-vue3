<template>
    <v-row class="ma-0 pa-0 task-btn" style="right: 40px">
        <v-spacer></v-spacer>
        <div v-if="!isCompleted">
            <v-btn @click="completeTask()" color="#0085DB" style="color: white;" rounded>완료</v-btn>
        </div>
    </v-row>
    <div style="height: calc(100vh - 255px); padding: 20px">
        <div v-if="isCompleted">
            <v-row v-for="item in outputItems" :key="item.name">
                <v-col cols="5">
                    <v-list-subheader>{{ item.key }}</v-list-subheader>
                </v-col>
                <v-col cols="7">
                    <v-list-subheader>{{ item.value }}</v-list-subheader>
                </v-col>
            </v-row>
        </div>
        <DefaultForm v-else :inputItems="inputItems"></DefaultForm>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DefaultForm from '@/components/designer/DefaultForm.vue';

const backend = BackendFactory.createBackend();
export default {
    components: {
        DefaultForm
    },
    props: {
        definitionId: String,
        workItem: {
            type: Object,
            default: function () {
                return null;
            }
        },
        workItemStatus: {
            type: String,
            default: function () {
                return null
            },
        },
        isDryRun: Boolean,
        dryRunWorkItem: Object,
    },
    data: () => ({
        inputItems: null,
        outputItems: null
    }),
    computed: {
        isCompleted() {
            return this.workItemStatus == "COMPLETED" || this.workItemStatus == "DONE"
        }
    },
    created() {
        this.init();
    },
    methods: {
        async init() {
            var me = this;
            if(me.isDryRun){
                let workitem = me.dryRunWorkItem
                let activitiy = workitem.activity
                me.inputItems = activitiy.parameters.filter((item) => item.direction.includes('OUT'))
                        .map((item) => ({ name: item.variable.name, key: item.argument.text, value: item.variable.defaultValue }));
            } else {
                if (!me.workItem.activity.parameters) me.workItem.activity.parameters = [];
                if (me.isCompleted) {
                    me.outputItems = me.workItem.activity.parameters.filter((item) => item.direction.includes('IN'))
                        .map((item) => ({ name: item.variable.name, key: item.argument.text, value: me.workItem.parameterValues[item.argument.text]}));
                } else {
                    me.inputItems = me.workItem.activity.parameters.filter((item) => item.direction.includes('OUT'))
                        .map((item) => ({ name: item.variable.name, key: item.argument.text, value: item.variable.defaultValue }));
                }
            }
        },
        async completeTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    let value = { parameterValues: {} };
                    let parameterValues = me.inputItems.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    if (parameterValues) value.parameterValues = parameterValues;
                   
                    if(me.isDryRun) {
                        let workItem = me.dryRunWorkItem
                        if (workItem.execScope) value.execScope = workItem.execScope;

                        let processExecutionCommand = {
                            processDefinitionId: me.definitionId
                        }
                        
                        await backend.startDryRun({
                            processExecutionCommand: processExecutionCommand,
                            workItem: value   
                        });
                        me.close();
                    } else {
                        if (me.workItem.execScope) value.execScope = me.workItem.execScope;
                        await backend.putWorkItemComplete(me.$route.params.taskId, value);
                        me.$router.push(`/instancelist/${btoa(me.workItem.worklist.instId)}`);  
                    }
                },
                successMsg: '해당 업무 완료'
            });
        },
        close(){
            this.$emit('close')
        },
    }
};
</script>
