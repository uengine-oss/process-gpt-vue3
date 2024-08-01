<template>
    <v-row v-if="!isCompleted" class="ma-0 pa-0 task-btn" style="right: 50px">
        <v-spacer></v-spacer>
        <v-btn v-if="!isDryRun" @click="intermediateSave" color="primary" rounded class="mr-1">중간 저장</v-btn>
        <v-btn @click="executeProcess" color="primary" rounded>완료</v-btn>
    </v-row>
    <div class="pa-4" style="height: 100%;">
        <div class="d-flex flex-column overflow-y-auto"  style="height: 100%;">
            <Instruction :workItem="workItem" />
            <div>
                <v-row class="w-100" v-for="item in outputItems" :key="item.name">
                    <v-col cols="5">
                        <v-list-subheader>{{ item.key }}</v-list-subheader>
                    </v-col>
                    <v-col cols="7">
                        <v-list-subheader>{{ item.value }}</v-list-subheader>
                    </v-col>
                </v-row>
            </div>
            <div>
                <DefaultForm v-if="inputItems && inputItems.length > 0" :inputItems="inputItems" />
                <AudioTextarea v-model="newMessage" :workItem="workItem" />
            </div>
            <Checkpoints ref="checkpoints" :workItem="workItem" @update-checkpoints="updateCheckpoints" />
        </div>
    </div>
</template>

<script>
import DefaultForm from '@/components/designer/DefaultForm.vue';

import Instruction from '@/components/ui/Instruction.vue';
import AudioTextarea from '@/components/ui/AudioTextarea.vue';
import Checkpoints from '@/components/ui/Checkpoints.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DefaultForm,
        Instruction,
        AudioTextarea,
        Checkpoints
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
        currentActivities: {
            type: Array,
            default: function () {
                return []
            }
        },
    },
    data: () => ({
        inputItems: null,
        outputItems: null,
        newMessage: '',
        allCheckpointsChecked: false,
    }),
    computed: {
        isCompleted() {
            return this.workItemStatus == "COMPLETED" || this.workItemStatus == "DONE"
        },
        mode() {
            return window.$mode;
        },
    },
    created() {
        this.init();
    },
    methods: {
        close(){
            this.$emit('close')
        },
        async init() {
            var me = this;
            let workitem = me.workItem
            let parameterValues = workitem.parameterValues;
            
            me.inputItems = [];
            Object.keys(parameterValues).forEach(key => {
                me.inputItems.push({ name: key, key: key, value: parameterValues[key] });
            });
        },
        completeTask(value) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if(me.isDryRun) {
                        let workItem = me.dryRunWorkItem
                        if (workItem.execScope) value.execScope = workItem.execScope;

                        let processExecutionCommand = {
                            processDefinitionId: me.definitionId
                        }
                        
                        await backend.startAndComplete({
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
        executeProcess() {
            if (!this.allCheckpointsChecked) {
                this.$refs.checkpoints.snackbar = true;
                return;
            }
            let value = { parameterValues: {} };
            let parameterValues = this.inputItems.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
            if (parameterValues) value.parameterValues = parameterValues;
            if (this.newMessage && this.newMessage.length > 0) {
                value.parameterValues['user_input_text'] = this.newMessage;
            }
            if(this.isDryRun && this.mode == 'ProcessGPT') {
                this.$emit('executeProcess', value)
            } else {
                this.completeTask(value)
            }
        },
        intermediateSave() {
            var me = this;
            me.$try({
                context: me,
                action: () => {
                    if (me.inputItems && me.inputItems.length > 0) {
                        me.inputItems.forEach(async (variable) => {
                            await backend.setVariable(me.workItem.worklist.instId, variable.name, variable.value);
                        })
                    }
                },
                successMsg: '중간 저장 완료'
            });
        },
        updateCheckpoints(status) {
            this.allCheckpointsChecked = status;
        },
    }
};
</script>
