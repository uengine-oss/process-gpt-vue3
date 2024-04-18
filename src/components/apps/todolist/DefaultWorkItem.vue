<template>
    <v-row class="ma-0 pa-0">
        <v-spacer></v-spacer>
        <v-btn @click="nextTask()">완료</v-btn>
    </v-row>
    <div style="height:calc(100vh - 255px); padding: 20px;" >
        <div v-for="item in inputItems" class="input-group">
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
        inputItems: [],      
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
    
        async nextTask(){
            var me = this
            const backend = BackendFactory.createBackend()

            let parameterValues = this.inputItems.reduce((acc, item) => ({...acc, [item.name]: item.value}), {});
            let result = await backend.putWorkItem(me.$route.params.taskId, {"parameterValues": parameterValues})
            console.log(result)
        },
    },
}
</script>