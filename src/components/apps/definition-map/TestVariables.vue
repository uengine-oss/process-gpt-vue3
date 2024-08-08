<template>
    <v-card class="h-100" style="width: 100%; height: 100%">
        <v-card-title> Test Variable </v-card-title>
        <v-card-text v-if="selectedTask">
            <test-variable v-for="val,idx in selectedTask" :key="idx" :idx="idx" :selected-task="val" @execute="e => executeTest(e)"></test-variable>
        </v-card-text>
        <v-card-text v-else>
            No Data
        </v-card-text>
        <v-card-actions>
            <v-btn>ADD</v-btn>
        </v-card-actions>

        <!-- <v-card-actions class="justify-center" v-if="tool == 'DefaultWorkItem'">
            <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
            <v-btn color="error" variant="flat" @click="closeDialog()">닫기</v-btn>
        </v-card-actions> -->
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
import TestVariable from './TestVariable.vue';
export default {
    components: {
        TestVariable
    },
    watch: {
        task(newVal) {
            if (this.testList[newVal]) this.selectedTask = JSON.parse(this.testList[newVal]);
        }
    },
    props: {
        definitionId: String,
        task: String
    },
    data: () => ({
        testList: {},
        selectedTask: null
    }),
    async created() {
        console.log(this.definitionId);
        const list = await backend.testList(this.definitionId);
        this.testList = list;
        console.log(this.task)
        if (this.testList[this.task]) this.selectedTask = JSON.parse(this.testList[this.task]);
    },
    methods: {
        executeTest(e) {
            console.log(this.selectedTask[e])
            delete this.selectedTask[e]["_type"];
            this.$emit('executeTest', this.selectedTask[e])
        }
    }
};
</script>
