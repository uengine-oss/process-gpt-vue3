<template>
    <v-row class="ma-0 pa-0 task-btn" style="right:50px; top:12px;">
        <v-spacer></v-spacer>
        <div class="from-work-item-pc" v-if="!isCompleted">
            <v-btn v-if="!isDryRun" @click="saveTask" color="primary" class="mr-2" rounded>중간 저장</v-btn>
            <v-btn @click="executeProcess" color="primary" rounded>제출 완료</v-btn>
        </div>
        <div class="from-work-item-mobile" v-if="!isCompleted">
            <v-tooltip text="중간 저장">
                <template v-slot:activator="{ props }">
                    <v-btn @click="saveTask" icon v-bind="props" density="comfortable">
                        <Icons :icon="'save'" :width="32" :height="32"/>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip text="제출 완료">
                <template v-slot:activator="{ props }">
                    <v-btn @click="executeProcess" icon v-bind="props"
                        density="comfortable">
                        <Icons :icon="'submit-document'" :width="28" :height="28"/>
                    </v-btn>
                </template>
            </v-tooltip>
        </div>
    </v-row>
    <div class="pa-4">
        <!-- <FormMapper></FormMapper> -->
        <Instruction :workItem="workItem" />
        <DynamicForm ref="dynamicForm" :formHTML="html" v-model="formData"></DynamicForm>
        <AudioTextarea v-if="!isCompleted" v-model="newMessage" :workItem="workItem" />
        <CheckPoints :workItem="workItem" />
    </div>
</template>

<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';

import Instruction from '@/components/ui/Instruction.vue';
import AudioTextarea from '@/components/ui/AudioTextarea.vue';
import CheckPoints from '@/components/ui/CheckPoints.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DynamicForm,
        Instruction,
        AudioTextarea,
        CheckPoints
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
                return null;
            }
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
        html: null,
        formDefId: null,
        formData: {},
        newMessage: '',
        checkPoints: null,
    }),
    computed: {
        isCompleted(){
            return this.workItemStatus == "COMPLETED" || this.workItemStatus == "DONE"
        },
        checkedCount() {
            if (!this.checkPoints) return 0;
            return this.checkPoints.filter((checkPoint) => checkPoint.checked).length;
        },
    },
    watch:  {
        html() {
            if (this.isCompleted) {
                this.html = this.disableFormHTML(this.html);
            }
        }
    },
    mounted() {
        this.init();
    },
    methods: {
        async init() {
            var me = this;
            if(me.isDryRun) {
                me.formDefId = me.dryRunWorkItem.activity.tool.split(':')[1];
            } else {
                me.formDefId = me.workItem.worklist.tool.split(':')[1];
            }
            if(!me.formDefId) return;
            me.html = await backend.getRawDefinition(me.formDefId, { type: 'form' });
            if(!me.isDryRun) {
                me.loadForm()
            }
        },
        async loadForm(){
            var me = this;

            if(!me.workItem.activity || !me.workItem.activity.variableForHtmlFormContext) return;

            let varName = me.workItem.activity.variableForHtmlFormContext.name;
            let variable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName);
            if (variable && variable.valueMap) {
                me.formData = variable.valueMap;
            }
        },
        async saveTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    // 추후 로직 변경 . 않좋은 패턴. -> 아래 코드
                    // let varName = me.workItem.activity.variableForHtmlFormContext.name;
                    // let variable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName);
                    // if (!variable) variable = {};
                    // variable._type = 'org.uengine.contexts.HtmlFormContext';
                    // variable.valueMap = this.formData;
                    // Object.keys(variable.valueMap).forEach((key) => {
                    //     if (typeof variable.valueMap[key] == 'object') {
                    //         variable.valueMap[key].forEach((item) => {
                    //             item._type = 'java.util.HashMap';
                    //         });
                    //     }
                    // });
                    // variable.valueMap._type = 'java.util.HashMap';
                    // await backend.setVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName, variable);

                    await me.saveForm();
                    ///////////////////////////////////
                    await backend.putWorkItem(me.$route.params.taskId, { parameterValues: {} });
                },
                successMsg: '중간 저장 완료'
            });
        },
        async saveForm(variables){
            let me = this;

            let varName = me.workItem.activity.variableForHtmlFormContext.name;
            let variable = {};
            if(!me.isDryRun){
                variable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName);
            } 

            variable._type = 'org.uengine.contexts.HtmlFormContext';
            variable.valueMap = me.formData;
            Object.keys(variable.valueMap).forEach((key) => {
                if (typeof variable.valueMap[key] == 'object') {
                    variable.valueMap[key].forEach((item) => {
                        item._type = 'java.util.HashMap';
                    });
                }
            });
            variable.valueMap._type = 'java.util.HashMap';

            if(me.isDryRun) {
                if(!variables) variables = {}
                variable.formDefId = me.formDefId
                variable.filePath = `${me.formDefId}.form`
                variables[varName] = JSON.stringify(variable);
            } else {
                await backend.setVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName, variable);
            }
        },
        async completeTask() {
            let me = this
            // 추후 로직 변경 . 않좋은 패턴. -> 아래 코드
            let workItem = { parameterValues: {} };
            let variables = {}

            if($mode=="uEngine")
                await me.saveForm(variables)
            
            if($mode=="ProcessGPT"){
                workItem.parameterValues = me.formData
            }

            ///////////////////////////////////


            //#region 폼 정의시에 검증 스크립트가 등록된 경우, 해당 스크립트를 실행시켜서 유효성을 검사
            const error = me.$refs.dynamicForm.validate()
            if (error && error.length > 0) {
                alert("※ 폼에 정의된 유효성 검사에 실패했습니다 !\n> " + error)
                return;
            }
            //#endregion

            if (me.workItem.execScope) workItem.execScope = me.workItem.execScope;

            if(me.isDryRun){
                let processExecutionCommand = {
                    processDefinitionId: me.definitionId
                }
                        
                await backend.startDryRun({
                    processExecutionCommand: processExecutionCommand,
                    workItem: workItem,
                    variables: variables
                });
                me.close()
            } else {  
                await backend.putWorkItemComplete(me.$route.params.taskId, workItem);
                me.$router.push('/todolist');
            }
        },
        disableFormHTML(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const elements = doc.querySelectorAll('[disabled="false"]');
            elements.forEach(element => {
                element.setAttribute('disabled', 'true');
            });
            return doc.body.innerHTML;
        },
        close(){
            this.$emit('close')
        },
        fail(msg){
            this.$emit('fail', msg)
        },
        executeProcess() {
            let value = {};
            // if (this.newMessage && this.newMessage.length > 0) {
            //     value.parameterValues['user_input_text'] = this.newMessage;
            // }

            if(this.isDryRun && $mode == 'ProcessGPT') {
                const formColumn = this.formDefId.replace(/\s+/g, '_').toLowerCase();
                value[formColumn] = this.formData;
                this.$emit('executeProcess', value);
            } else {
                this.completeTask();
            }
        },
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