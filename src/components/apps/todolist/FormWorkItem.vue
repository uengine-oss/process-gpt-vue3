<template>
    <div>
        <v-row class="ma-0 pa-0 task-btn">
            <v-spacer></v-spacer>
            <div class="from-work-item-pc" style="margin-right: 10px;" v-if="!isCompleted">
                <v-btn v-if="!isDryRun" @click="saveTask" color="primary" density="compact" class="mr-2" rounded variant="flat">중간 저장</v-btn>
                <v-icon v-if="isSimulate == 'true' && isFinishedAgentGeneration"
                    class="bouncing-arrow-horizontal" 
                    color="primary" 
                    size="large"
                >
                    mdi-arrow-right-bold
                </v-icon>
                <v-btn @click="executeProcess" color="primary" density="compact" rounded variant="flat">제출 완료</v-btn>
            </div>
            <!-- <div class="form-work-item-mobile" v-if="!isCompleted">
                <v-tooltip v-if="isMobile"
                    text="중간 저장"
                >
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
            </div> -->
        </v-row>

        <v-card flat>
            <v-card-text class="pa-4 pt-3">
                <DynamicForm v-if="html" ref="dynamicForm" :formHTML="html" v-model="formData" class="dynamic-form mb-4"></DynamicForm>
                <div v-if="!isCompleted" class="mb-4">
                    <v-checkbox v-if="html" v-model="useTextAudio" label="자유롭게 결과 입력" hide-details density="compact"></v-checkbox>
                    <AudioTextarea v-model="newMessage" :workItem="workItem" :useTextAudio="useTextAudio" @close="close" />
                </div>
                <Checkpoints ref="checkpoints" :workItem="workItem" @update-checkpoints="updateCheckpoints" />
            </v-card-text>
        </v-card>
    </div>
</template>

<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';

import Instruction from '@/components/ui/Instruction.vue';
import AudioTextarea from '@/components/ui/AudioTextarea.vue';
import Checkpoints from '@/components/ui/Checkpoints.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        DynamicForm,
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
        isSimulate: {
            type: String,
            default: "false"
        },
        isFinishedAgentGeneration: Boolean,
        processDefinition: Object
    },
    data: () => ({
        html: null,
        formDefId: null,
        formData: {},
        newMessage: '',
        useTextAudio: false,
    }),
    computed: {
        simulate() {
            return this.isSimulate === 'true' || this.isSimulate === 'false' ? this.isSimulate === 'true' : this.isSimulate;
        },
        isCompleted(){
            return this.workItemStatus == "COMPLETED" || this.workItemStatus == "DONE"
        },
        isMobile() {
            return this.windowWidth <= 700;
        },
        mode() {
            return window.$mode;
        }
    },
    watch:  {
        html() {
            if (this.isCompleted) {
                this.html = this.disableFormHTML(this.html);
            }
            this.EventBus.emit('html-updated', this.html);
        },
        formData() {
            if(this.formData){
                this.EventBus.emit('formData-updated', this.formData);
            }
        },
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
            if(!me.formDefId) {
                if (this.mode == 'ProcessGPT') {
                    me.formDefId = `${me.workItem.worklist.defId}_${me.workItem.activity.tracingTag}_form`
                } else {
                    return;
                }
            }
            if(me.isSimulate == 'true' && !window.location.pathname.includes('/definitions/')) {
                const formId = `${me.processDefinition.processDefinitionId}_${me.workItem.activity.tracingTag}_form`;
                me.html = localStorage.getItem(formId);    
            } else {
                me.html = await backend.getRawDefinition(me.formDefId, { type: 'form' });
            }
            if(!me.html) {
                me.useTextAudio = true;
            }
            if(!me.isDryRun) {
                me.loadForm()
            }
            
            if(me.isSimulate == 'true' && me.processDefinition && me.processDefinition['activities']) {    
                let currentActivity = me.processDefinition['activities'].find(x => x.id == me.workItem.activity.tracingTag)
                if(currentActivity && currentActivity.inputFormData) {
                    me.formData = currentActivity.inputFormData
                }
            }

            me.EventBus.on('form-values-updated', (formValues) => {
                if(formValues){
                    Object.keys(formValues).forEach(function (key){
                        me.formData[key] = formValues[key]
                    })
                }
            });
        },
        async loadForm(){
            var me = this;

            if(!me.workItem || !me.workItem.activity || !me.workItem.activity.outParameterContext) return;
           
            let outFormName = me.workItem.activity.outParameterContext.variable.name || me.formDefId;
            let outVariable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, outFormName);

            if (outVariable && outVariable.valueMap) {
                me.formData = outVariable.valueMap;
            }
            
            if(me.workItem?.parameterValues){
                const parameterValues = me.workItem.parameterValues[outFormName];
                if(parameterValues && parameterValues.valueMap){
                    me.formData = parameterValues.valueMap;
                }
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
                    await backend.putWorkItem(me.$route.params.taskId, { parameterValues: {} }, me.isSimulate);
                },
                successMsg: this.$t('successMsg.intermediate')
            });
        },
        async saveForm(variables){
            let me = this;

            let varName = me.workItem.activity.outParameterContext.variable.name;
            // let varName = me.workItem.activity.variableForHtmlFormContext.name;
            let variable = {};
            if(!me.isDryRun){
                variable = await backend.getVariableWithTaskId(me.workItem.worklist.instId, me.$route.params.taskId, varName);
            } 

            variable._type = 'org.uengine.contexts.HtmlFormContext';
            variable.valueMap = me.formData;
            Object.keys(variable.valueMap).forEach((key) => {
                if (Array.isArray(variable.valueMap[key])) {
                    if(!variable.valueMap[key]) return;
                    variable.valueMap[key]?.forEach((item) => {
                        if(item && item._type){
                            item._type = 'java.util.HashMap';
                        }
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
            let workItem = { parameterValues: {} };
            let variables = {}

            if(this.mode == "ProcessGPT"){

                workItem.parameterValues = me.formData;
                if (this.newMessage && this.newMessage.length > 0) {
                    workItem['user_input_text'] = this.newMessage;
                }
                backend.putWorkItemComplete(me.$route.params.taskId, workItem, me.isSimulate)
                    .then(async (response) => {
                        if (response && response.error) {
                            me.handleError(response.error);
                        } else if (response) {
                            let receivedText = "";
                            const { reader, decoder } = response;

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;                        
                                const chunk = decoder.decode(value, { stream: true });
                                receivedText += chunk;
                                me.EventBus.emit('workitem-streaming', receivedText);
                            }

                            me.EventBus.emit('workitem-streaming', '');
                        }
                        // 워크아이템 완료 처리
                        me.EventBus.emit('workitem-completed');
                        // 인스턴스 업데이트
                        me.EventBus.emit('instances-updated');
                    })

                let path = btoa(me.workItem.worklist.instId);
                me.$router.push({
                    path: `/instancelist/${path}`, 
                    query: {
                        instId: me.workItem.worklist.instId,
                        workitemRunning: true
                    }
                });
            } else {
                // 추후 로직 변경 . 않좋은 패턴. -> 아래 코드
                me.$try({
                    context: me,
                    action: async () => {
                        
                        if($mode=="uEngine")
                            await me.saveForm(variables)

                        ///////////////////////////////////


                        //#region 폼 정의시에 검증 스크립트가 등록된 경우, 해당 스크립트를 실행시켜서 유효성을 검사
                        const error = me.$refs.dynamicForm ? me.$refs.dynamicForm.validate() : null;
                        if (error && error.length > 0) {
                            alert("※ 폼에 정의된 유효성 검사에 실패했습니다 !\n> " + error)
                            return;
                        }
                        //#endregion

                        if (me.workItem.execScope) workItem.execScope = me.workItem.execScope;

                        if(me.isDryRun){
                            let processExecutionCommand = {
                                processDefinitionId: me.definitionId,
                                groups: window.localStorage.getItem('groups')
                            }
                                    
                            await backend.startAndComplete({
                                processExecutionCommand: processExecutionCommand,
                                workItem: workItem,
                                variables: variables
                            });
                            me.close()
                        } else {
                            if (this.newMessage && this.newMessage.length > 0) {
                                workItem['user_input_text'] = this.newMessage;
                            }
                            await backend.putWorkItemComplete(me.$route.params.taskId, workItem, me.isSimulate);
                            
                            let path = me.workItem.worklist.instId
                            me.$router.push(`/instancelist/${path}`);
                        }
                    }
                })
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
            if (!this.$refs.checkpoints.allChecked) {
                this.$refs.checkpoints.snackbar = true;
                return;
            }
            let value = {};
            if (this.newMessage && this.newMessage.length > 0) {
                value['user_input_text'] = this.newMessage;
            }
            
            if (this.isDryRun && this.mode == 'ProcessGPT' || this.simulate) {
                const formColumn = this.formDefId.replace(/\s+/g, '_').toLowerCase();
                value[formColumn] = this.formData;
                this.$emit('executeProcess', value);
            } else {
                this.completeTask();
            }
        },
        handleError(error) {
            var me = this;
            me.$try({}, null, {
                errorMsg: `${me.workItem.activity.name} 실행 중 오류가 발생했습니다: ${error}`
            });
        }
    }
};
</script>

<style>
.dynamic-form .v-field--disabled {
    opacity: 1 !important;
    background-color: #eaeaea !important;
    pointer-events: none !important;
}

.form-work-item-mobile {
    display: none;
}

@keyframes bounce-horizontal {
    0%, 100% { transform: translateX(0); }
    40% { transform: translateX(-5px); }
    60% { transform: translateX(3px); }
    80% { transform: translateX(-2px); }
}

@keyframes bounce-horizontal-left {
    0%, 100% { transform: translateX(0); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(2px); }
}

.bouncing-arrow-horizontal {
    animation: bounce-horizontal 1.5s infinite;
}

.bouncing-arrow-horizontal-left {
    animation: bounce-horizontal-left 1.5s infinite;
}

@media only screen and (max-width:1080px) {
    .from-work-item-pc {
        display: none;
    }
    .form-work-item-mobile {
        display: block;
    }
}
</style>