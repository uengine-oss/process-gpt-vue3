<template>
    <v-row class="ma-0 pa-0 task-btn">
        <v-spacer></v-spacer>
        <div v-if="workItemStatus == 'COMPLETED'">
            <v-btn @click="undoTask()" color="#0085DB" style="color: white;" rounded >현 시점 되돌리기</v-btn>
        </div>
        <div v-else>
            <v-btn @click="completeTask()" color="#0085DB" style="color: white;" rounded>완료</v-btn>
        </div>
    </v-row>
    <div style="height:calc(100vh - 255px); padding: 20px;" >
        <div v-if="inputItems" v-for="item in inputItems" class="input-group">
            <v-row>
                <v-col cols="4">
                    <v-list-subheader>{{item.name}}</v-list-subheader>
                </v-col>

                <v-col cols="8">
                    <v-text-field
                        v-model="item.value"
                    ></v-text-field>
                </v-col>
            </v-row>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
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
        undoTask(){
            this.$emit('undoTask')
        },
        async completeTask(){
            var me = this

            let parameterValues = this.inputItems.reduce((acc, item) => ({...acc, [item.name]: item.value}), {});
            let result = await backend.putWorkItemComplate(me.$route.params.taskId, {"parameterValues": parameterValues})
            console.log(result)
        },
    },
}
</script>