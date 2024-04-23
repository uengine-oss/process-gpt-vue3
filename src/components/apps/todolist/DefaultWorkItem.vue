<template>
    <v-row class="ma-0 pa-0 task-btn">
        <v-spacer></v-spacer>
        <div v-if="workItemStatus == 'NEW' || workItemStatus == 'DRAFT'">
            <v-btn @click="completeTask()" color="#0085DB" style="color: white;" rounded>완료</v-btn>
        </div>
    </v-row>
    <div style="height:calc(100vh - 255px); padding: 20px;" >
        <DefaultForm :inputItems="inputItems"></DefaultForm>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DefaultForm from '@/components/designer/DefaultForm.vue'

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
        inputItems: null,      
    }),
    components: {
        DefaultForm
        
    },
    created() {
        this.init();
    },
    methods: {
       async init(){
            var me = this
            me.inputItems = me.workItem.activity.parameters
                    .filter(item => item.direction === "OUT")
                    .map(item => ({ name: item.variable.name, value: null }));
        },
        async completeTask(){
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    let parameterValues = this.inputItems.reduce((acc, item) => ({...acc, [item.name]: item.value}), {});
                    await backend.putWorkItemComplate(me.$route.params.taskId, {"parameterValues": parameterValues})
                },
                successMsg: '해당 업무 완료'
            })

         
        },
    },
}
</script>