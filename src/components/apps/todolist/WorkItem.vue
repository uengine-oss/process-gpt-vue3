<template>
    <v-card elevation="10">
        <v-row>
            <v-col cols="12" md="6">
                <!-- 좌측 컨텐츠 -->
                <div class="pa-5">
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
                <div style="float: right;">
                    <v-btn @click="nextTask()">완료</v-btn>
                </div>
            </v-col>
            <v-col cols="12" md="6">
                <process-definition class="process-definition-resize" :bpmn="xml" :key="updatedKey" :isViewMode="true"></process-definition>
            </v-col>
        </v-row>

       
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinition from '@/components/ProcessDefinition.vue';

export default {
    data: () => ({
        workItem: null,
        inputItems: [],
        xml: null,
        updatedKey: 0,
      
    }),
    components: {
        ProcessDefinition
    },
    created() {
        this.init();
    },
    methods: {
       async init(){
            var me = this
            const backend = BackendFactory.createBackend()

            me.workItem = await backend.getWorkItem(me.$route.params.taskId);
            if(!me.workItem) return;
            me.inputItems = me.workItem.activity.parameters
            .filter(item => item.direction === "OUT")
            .map(item => ({ name: item.variable.name, value: null }));

            // xml
            me.xml = await backend.getRawDefinition(me.workItem.worklist.defId);
            me.updatedKey ++
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