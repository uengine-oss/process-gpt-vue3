<template>
    <v-card style="height: 100%;" variant="outlined" class="pa-4">
        <!-- <v-card-title>  </v-card-title> -->
        <v-card-text class="pa-0">
            <div v-for="val, key in selectedTask" :key="key" >
                <div v-if="key != '_type'"
                    style="color:black;"
                >
                    {{ key }} : {{ val }}
                </div>
            </div>
        </v-card-text>
        <v-row class="ma-0 pa-0">
            <v-spacer></v-spacer>
            <v-btn @click="executeProcess"
                class="cp-process-save"
                color="primary"
                rounded
            >실행</v-btn>
            <v-btn @click="deleteTest"
                class="cp-process-save"
                color="error"
                rounded
            >삭제</v-btn>
        </v-row>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
export default {
    components: {},
    props: {
        idx: Number,
        selectedTask: Object
    },
    data: () => ({
        
    }),
    async created() {
    },
    methods: {
        executeProcess() {
            this.$emit('execute', this.idx)
        },
        deleteTest() {
            // backend.deleteTest(this.idx);
            this.$emit('delete', this.idx)
        }
    }
};
</script>
