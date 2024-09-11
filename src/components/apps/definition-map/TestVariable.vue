<template>
    <tr  v-for="val, key in selectedTask" :key="key">
        <template v-if="key != '_type'">
            <td>{{ key }}</td>
            <td>{{ val }}</td>
            <td>
                <v-btn @click="executeProcess"
                    class="cp-process-save"
                    color="primary"
                    rounded
                    density="comfortable"
                >실행</v-btn>
            </td>
        </template>
    </tr>
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
    data: () => ({}),
    async created() {},
    methods: {
        executeProcess() {
            this.$emit('execute', this.idx);
        }
    }
};
</script>