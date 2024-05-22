<template>
    <v-row class="ma-0 pa-0 task-btn" style="right: 40px">
        <v-spacer></v-spacer>
        <div class="from-work-item-pc" v-if="workItemStatus == 'NEW' || workItemStatus == 'DRAFT'">
            <v-btn @click="saveTask()" color="#0085DB" style="color: white" rounded>중간 저장</v-btn>
            <v-btn @click="$try(completeTask, null, {sucessMsg: '워크아이템 완료'})" variant="tex" rounded>제출 완료</v-btn>
        </div>
        <div class="from-work-item-mobile" v-if="workItemStatus == 'NEW' || workItemStatus == 'DRAFT'">
            <v-tooltip text="중간 저장">
                <template v-slot:activator="{ props }">
                    <v-btn @click="saveTask()"
                        icon v-bind="props"
                        density="comfortable"
                    >
                        <Icon icon="mdi:content-save-plus-outline" width="32" height="32" />
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip text="제출 완료">
                <template v-slot:activator="{ props }">
                    <v-btn @click="$try(completeTask, null, {sucessMsg: '워크아이템 완료'})" variant="tex"
                        icon v-bind="props"
                        density="comfortable"
                    >
                        <Icon icon="iconoir:submit-document" width="28" height="28" />
                    </v-btn>
                </template>
            </v-tooltip>
        </div>
    </v-row>
    <div class="pa-4">
        <!-- <FormMapper></FormMapper> -->
        <DynamicForm ref="dynamicForm" :formHTML="html" v-model="formData"></DynamicForm>
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
            this.loadForm()
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
        async loadForm(){
            var me = this;

            if(!me.workItem.activity || !me.workItem.activity.variableForHtmlFormContext) return;

            let varName = me.workItem.activity.variableForHtmlFormContext.name;
            let variable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName);
            if (variable && variable.valueMap) {
                me.formData = variable.valueMap;
            } else {
                me.formData = {};
            }
        },
        async saveTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    // 추후 로직 변경 . 않좋은 패턴. -> 아래 코드
                    let varName = me.workItem.activity.variableForHtmlFormContext.name;
                    let variable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName);
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
                    await backend.setVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName, variable);
                    ///////////////////////////////////
                    await backend.putWorkItem(me.$route.params.taskId, { parameterValues: {} });
                },
                successMsg: '중간 저장 완료'
            });
        },

        async saveForm(){
            let me = this;

            let varName = me.workItem.activity.variableForHtmlFormContext.name;
            let variable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName);
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
            await backend.setVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName, variable);

        },
        async completeTask() {
            let me = this
            // 추후 로직 변경 . 않좋은 패턴. -> 아래 코드
            let workItem = { parameterValues: {} };

            if($mode=="uEngine")
                await me.saveForm()
            
            if($mode=="ProcessGPT"){
                workItem.parameterValues = me.formData
            }

            if (me.workItem.execScope) workItem.execScope = me.workItem.execScope;

            ///////////////////////////////////


            //#region 폼 정의시에 검증 스크립트가 등록된 경우, 해당 스크립트를 실행시켜서 유효성을 검사
            const error = me.$refs.dynamicForm.validate()
            if (error && error.length > 0) {
                alert("※ 폼에 정의된 유효성 검사에 실패했습니다 !\n> " + error)
                return;
            }
            //#endregion

            await backend.putWorkItemComplete(me.$route.params.taskId, workItem);
            me.$router.push('/todolist');
        
        }
    }
};
</script>
<style>
.from-work-item-mobile {
    display: none;
}
.from-work-item-mobile button {
    margin-right:10px;
}

@media only screen and (max-width:700px) {
    .from-work-item-pc {
        display: none;
    }
    .from-work-item-mobile {
        display: block;
    }
}
</style>