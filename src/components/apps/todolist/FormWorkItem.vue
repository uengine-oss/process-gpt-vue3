<template>
    <v-row class="ma-0 pa-0">
        <v-spacer></v-spacer>
        <v-btn @click="saveTask()">중간 저장</v-btn>
        <v-btn @click="completeTask()" color="blue-darken-4" variant="tex">제출 완료</v-btn>
        
    </v-row>
   <div style="height:calc(100vh - 255px)">
        <!-- <FormMapper></FormMapper> -->
        <DynamicForm :formHTML="html" v-model="formData"></DynamicForm>
    </div>
   
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DynamicForm from '@/components/designer/DynamicForm.vue';
// import FormMapper from '@/components/apps/todolist/FormMapper.vue';
const backend = BackendFactory.createBackend()
export default {
    props:{
        workItem: {
            type: Object,
            default: function () {
                return null
            },
        },
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
        async saveTask(){
            var me = this
            let variable = await backend.getVariable(me.workItem.worklist.instId, '장애신고')
            variable._type = "org.uengine.contexts.HtmlFormContext"
            variable.valueMap = this.formData
            variable.valueMap._type = "java.util.HashMap"
            await backend.setVariable(me.workItem.worklist.instId, '장애신고', variable)
            alert('saveTask: '+JSON.stringify(this.formData))
        },
        async completeTask(){
            var me = this
            let result = await backend.putWorkItemComplate(me.$route.params.taskId, {"parameterValues": {}})
            alert('completeTask')
        },
    },
}
</script>