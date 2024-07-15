<template>
    <v-row v-if="!isCompleted" class="ma-0 pa-0 task-btn" style="right: 50px">
        <v-spacer></v-spacer>
        <v-btn v-if="!isDryRun" @click="intermediateSave" color="primary" rounded class="mr-1">중간 저장</v-btn>
        <v-btn @click="executeProcess" color="primary" rounded>완료</v-btn>
    </v-row>
    <div class="pa-4" style="height: 100%;">
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
        <div v-else class="d-flex flex-column overflow-y-auto" style="height: 100%;">
            <!-- Instruction -->
            <div class="mb-4">
                <v-alert v-if="workItem.activity.instruction" title="Instruction" type="info" variant="outlined"
                    density="compact">
                    <template v-slot:text>
                        <span style="font-size: 14px;">{{ workItem.activity.instruction }}</span>
                    </template>
                </v-alert>
            </div>
            <!-- Input Form -->
            <div>
                <DefaultForm v-if="inputItems && inputItems.length > 0" :inputItems="inputItems" />
                <AudioTextarea v-model="newMessage" :workItem="workItem" />
            </div>
            <!-- CheckPoint -->
            <v-sheet v-if="checkPoints" class="mt-auto pa-3 border border-success rounded">
                <div class="text-success font-weight-semibold">
                    <v-icon class="mr-2">$success</v-icon>
                    CheckPoint ({{ checkedCount }}/{{ checkPoints ? checkPoints.length : 0 }})
                </div>
                <div v-for="(checkPoint, index) in checkPoints" :key="index">
                    <v-checkbox v-model="checkPoint.checked" :label="checkPoint.name" hide-details density="compact" 
                        color="success"></v-checkbox>
                </div>
            </v-sheet>
        </div>
    </div>
</template>

<script>
import DefaultForm from '@/components/designer/DefaultForm.vue';
import AudioTextarea from '@/components/ui/AudioTextarea.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DefaultForm,
        AudioTextarea
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
        checkPoints: null,
        newMessage: '',
    }),
    computed: {
        isCompleted() {
            return this.workItemStatus == "COMPLETED" || this.workItemStatus == "DONE"
        },
        mode() {
            return window.$mode;
        },
        checkedCount() {
            if (!this.checkPoints) return 0;
            return this.checkPoints.filter((checkPoint) => checkPoint.checked).length;
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
            if (me.workItem && me.workItem.activity.checkpoints) {
                me.checkPoints = me.workItem.activity.checkpoints.map((checkpoint) => ({
                    name: checkpoint,
                    checked: false
                }));
            }
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
        executeProcess(){
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
    }
};
</script>
