<template>
    <template v-if="Object.values(selectedTask).some(val => Array.isArray(val))">
        <tr v-for="(val, key, index) in selectedTask" :key="key">
            <td>{{ key }}</td>
            <td>{{ val }}</td>
            <template v-if="index === Object.keys(selectedTask).length - 1">
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
    <template v-else>
        <tr>
            <!-- key를 세로로 배치 -->
            <td>
                <div v-for="(val, key) in selectedTask" :key="key">
                    {{ key }}
                </div>
            </td>
            <!-- value를 세로로 배치 -->
            <td>
                <div v-for="(val, key) in selectedTask" :key="key">
                    {{ val }}
                </div>
            </td>
            <!-- 실행 버튼을 마지막에 추가 -->
            <td>
                <v-btn @click="executeProcess"
                    class="cp-process-save"
                    color="primary"
                    rounded
                    density="comfortable"
                >실행</v-btn>
                <v-btn @click="deleteTest"
                    class="cp-process-save"
                    color="error"
                    rounded
                    density="comfortable"
                >삭제</v-btn>
            </td>
        </tr>
    </template>
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
            this.$emit('execute', this.idx)
        },
        deleteTest() {
            // backend.deleteTest(this.idx);
            this.$emit('delete', this.idx)
        }
    }
};
</script>