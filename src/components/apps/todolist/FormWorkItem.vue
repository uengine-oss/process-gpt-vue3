<template>
    <v-row class="ma-0 pa-0 task-btn" style="right: 40px">
        <v-spacer></v-spacer>
        <div v-if="workItemStatus == 'NEW' || workItemStatus == 'DRAFT'">
            <v-btn @click="saveTask()" color="#0085DB" style="color: white" rounded>중간 저장</v-btn>
            <v-btn @click="completeTask()" variant="tex" rounded>제출 완료</v-btn>
        </div>
    </v-row>
    <div class="pa-4">
        <!-- <FormMapper></FormMapper> -->
        <DynamicForm :formHTML="html" v-model="formData" :key="html"></DynamicForm>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DynamicForm from '@/components/designer/DynamicForm.vue';

const backend = BackendFactory.createBackend();
export default {
    props: {
        workItem: {
            type: Object,
            default: function () {
                return null;
            }
        },
        workItemStatus: {
            type: String,
            default: function () {
                return null;
            }
        }
    },
    data: () => ({
        html: null,
        formData: {}
    }),
    components: {
        DynamicForm
    },
    mounted() {
        this.init();
    },
    methods: {
        async init() {
            var me = this;
            let formName = me.workItem.worklist.tool.split(':')[1];
            // let processVariables = await backend.getProcessVariables(me.workItem.worklist.instId);
            me.html = await backend.getRawDefinition(formName, { type: 'form' });
            // if (me.workItemStatus == 'COMPLETED' || me.workItemStatus == 'DONE') {
            let varName = me.workItem.activity.variableForHtmlFormContext.name;
            let variable = await backend.getVariable(me.workItem.worklist.instId, varName);
            if (variable && variable.valueMap) {
                me.formData = variable.valueMap;
            } else {
                me.formData = {};
            }

            // }

            // if (me.workItem.activity.previousActivities.length > 0) {
            //     let previousActivity = me.workItem.activity.previousActivities[0];
            //     let previousVariableForHtmlFormContext = previousActivity.variableForHtmlFormContext;
            //     if (previousVariableForHtmlFormContext) {
            //         let mappingValueMap = processVariables[`:${previousVariableForHtmlFormContext.name}`].valueMap;
            //         Object.entries(mappingValueMap).forEach(([key, value]) => {
            //             this.formData[key] = value;
            //         });
            //     }
            // }
        },
        async saveTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    // 추후 로직 변경 . 않좋은 패턴. -> 아래 코드
                    let varName = me.workItem.activity.variableForHtmlFormContext.name;
                    let variable = await backend.getVariable(me.workItem.worklist.instId, varName);
                    if (!variable) variable = {};
                    variable._type = 'org.uengine.contexts.HtmlFormContext';
                    variable.valueMap = this.formData;
                    Object.keys(variable.valueMap).forEach((key) => {
                        if (typeof variable.valueMap[key] == 'object') {
                            variable.valueMap[key].forEach((item) => {
                                item._type = 'java.util.HashMap';
                            });
                        }
                    });
                    variable.valueMap._type = 'java.util.HashMap';
                    await backend.setVariable(me.workItem.worklist.instId, varName, variable);
                    ///////////////////////////////////
                    await backend.putWorkItem(me.$route.params.taskId, { parameterValues: {} });
                },
                successMsg: '중간 저장 완료'
            });
        },
        async completeTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    // 추후 로직 변경 . 않좋은 패턴. -> 아래 코드
                    let varName = me.workItem.activity.variableForHtmlFormContext.name;
                    let variable = await backend.getVariable(me.workItem.worklist.instId, varName);
                    if (!variable) variable = {};
                    variable._type = 'org.uengine.contexts.HtmlFormContext';
                    variable.valueMap = this.formData;
                    Object.keys(variable.valueMap).forEach((key) => {
                        if (typeof variable.valueMap[key] == 'object') {
                            variable.valueMap[key].forEach((item) => {
                                item._type = 'java.util.HashMap';
                            });
                        }
                    });
                    variable.valueMap._type = 'java.util.HashMap';
                    await backend.setVariable(me.workItem.worklist.instId, varName, variable);
                    ///////////////////////////////////
                    await backend.putWorkItemComplete(me.$route.params.taskId, { parameterValues: {} });
                    me.$router.push('/todolist');
                },
                successMsg: '해당 업무 완료'
            });
        }
    }
};
</script>
