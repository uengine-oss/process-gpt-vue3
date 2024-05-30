<template>
    <v-row class="ma-0 pa-0 task-btn" style="right: 40px">
        <v-spacer></v-spacer>
        <div v-if="!isComplete">
            <v-btn @click="completeTask()" color="#0085DB" style="color: white;" rounded>완료</v-btn>
        </div>
    </v-row>
    <div style="height: calc(100vh - 255px); padding: 20px">
        <div v-if="isComplete">
            <v-row v-for="item in outputItems" :key="item.name">
                <v-col cols="5">
                    <v-list-subheader>{{ item.name }}</v-list-subheader>
                </v-col>
                <v-col cols="7">
                    <v-list-subheader>{{ item.value }}</v-list-subheader>
                </v-col>
            </v-row>
        </div>
        <DefaultForm v-else :inputItems="inputItems"></DefaultForm>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DefaultForm from '@/components/designer/DefaultForm.vue';

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
                return null
            },
        },
        isComplete: Boolean
    },
    data: () => ({
        inputItems: null,
        outputItems: null
    }),
    components: {
        DefaultForm
    },
    created() {
        this.init();
    },
    methods: {
        async init() {
            var me = this;
            if (!me.workItem.activity.parameters) me.workItem.activity.parameters = [];
            if (me.isComplete) {
                me.outputItems = me.workItem.activity.parameters.filter((item) => item.direction.includes('IN'))
                    .map((item) => ({ name: item.variable.name, value: item.variable.value }));
            } else {
                me.inputItems = me.workItem.activity.parameters.filter((item) => item.direction.includes('OUT'))
                    .map((item) => ({ name: item.variable.name, value: item.variable.value }));
            }
        },
        async completeTask() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    let workItem = { parameterValues: {} };
                    let parameterValues = this.inputItems.reduce((acc, item) => ({ ...acc, [item.name]: item.value }), {});
                    if (parameterValues) workItem.parameterValues = parameterValues;
                    if (me.workItem.execScope) workItem.execScope = me.workItem.execScope;
                    await backend.putWorkItemComplete(me.$route.params.taskId, workItem);

                    me.$router.push('/todolist');
                },
                successMsg: '해당 업무 완료'
            });
        }
    }
};
</script>
