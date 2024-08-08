<template>
    <v-card style="width: 100%; height: 100%">
        <!-- <v-card-title>  </v-card-title> -->
        <v-card-text>
            <div v-for="val, key in selectedTask" :key="key" >
                <div v-if="key != '_type'">
                    {{ key }} : {{ val }}
                </div>
            </div>
        </v-card-text>
        <v-card-actions class="justify-center">
            <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
        </v-card-actions>
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
        }
    }
};
</script>
