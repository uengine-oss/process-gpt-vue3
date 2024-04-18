<template>
    <v-row class="ma-0 pa-0">
        <v-spacer></v-spacer>
        <v-btn @click="saveTask()">중간 저장</v-btn>
        <v-btn @click="completeTask()" color="blue-darken-4" variant="tex">제출 완료</v-btn>
        
    </v-row>
   <div style="height:calc(100vh - 255px)">
        <!-- <FormMapper></FormMapper> -->
        Form Mapper
    </div>
   
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
// import FormMapper from '@/components/apps/todolist/FormMapper.vue';

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

      
    }),
    components: {
        // FormMapper
    },
    created() {
        this.init();
    },
    methods: {
       async init(){
            var me = this
            // const backend = BackendFactory.createBackend()

        },
        saveTask(){
            alert('saveTask')
        },
        async completeTask(){
            var me = this
            const backend = BackendFactory.createBackend()
            let result = await backend.putWorkItemComplate(me.$route.params.taskId, {"parameterValues": {}})
            alert('completeTask')
        },
    },
}
</script>