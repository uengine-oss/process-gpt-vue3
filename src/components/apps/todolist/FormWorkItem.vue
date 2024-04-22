<template>
    <v-row class="ma-0 pa-0 task-btn" >
        <v-spacer></v-spacer>
        <div v-if="workItemStatus == 'COMPLETED'">
            <v-btn @click="undoTask()" color="#0085DB" style="color: white;" rounded >현 시점 되돌리기</v-btn>
        </div>
        <div v-if="workItemStatus == 'NEW'">
            <v-btn @click="saveTask()" color="#0085DB" style="color: white;" rounded >중간 저장</v-btn>
            <v-btn @click="completeTask()" variant="tex" rounded>제출 완료</v-btn>
        </div>
        
    </v-row>
   <div style="height:calc(100vh - 255px)">
        <!-- <FormMapper></FormMapper> -->
        <DynamicForm :formHTML="html" v-model="formData"></DynamicForm>
    </div>
   
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DynamicForm from '@/components/designer/DynamicForm.vue';

const backend = BackendFactory.createBackend()
export default {
    props:{
        workItem: {
            type: Object,
            default: function () {
                return null
            },
        },
        workItemStatus:{
            type: String,
            default: function () {
                return null
            },
        }
    },
    data: () => ({
        html: null,
        formData: {},
    }),
    components: {
        // FormMapper
        DynamicForm
    },
    created() {
        this.init();
    },
    methods: {
       async init(){
            var me = this
            let formName = me.workItem.worklist.tool.split(':')[1];
            me.html = await backend.getRawDefinition(formName, {'type': 'form'});            
        },
        undoTask(){
            this.$emit('undoTask')
        },
        async saveTask(){
            var me = this
            let variable = await backend.getVariable(me.workItem.worklist.instId, '장애신고')
            variable._type = "org.uengine.contexts.HtmlFormContext"
            variable.valueMap = this.formData
            variable.valueMap._type = "java.util.HashMap"
            await backend.setVariable(me.workItem.worklist.instId, '장애신고', variable)
            await backend.putWorkItemComplate(me.$route.params.taskId, {"parameterValues": {}})
            me.$router.push('/todolist')
        },
        async completeTask(){
            var me = this
            await backend.putWorkItemComplate(me.$route.params.taskId, {"parameterValues": {}})
            me.$router.push('/todolist')
        },
    },
}
</script>