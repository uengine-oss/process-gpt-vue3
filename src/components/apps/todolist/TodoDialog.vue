<template>
    <div>
        <v-card v-if="type == 'view'">
            <v-card-title class="d-flex align-center justify-space-between pt-3 pl-5">
                <h4 class="text-h4">할 일</h4>
                <v-btn class="edit-button" variant="flat" @click="type = 'edit'">
                    <v-icon>mdi-pencil</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="mt-3 px-6">
                <div class="mb-3">
                    <span class="text-h6 font-weight-semibold">제목: </span>
                    <span class="text-h6">{{ task.title }}</span>
                </div>
                <div class="mb-3">
                    <span class="text-h6 font-weight-semibold">시작일: </span>
                    <span class="text-h6">{{ task.startDate }}</span>
                </div>
                <div class="mb-3">
                    <span class="text-h6 font-weight-semibold">종료일: </span>
                    <span class="text-h6">{{ task.endDate }}</span>
                </div>
                <div class="mb-3">
                    <span class="text-h6 font-weight-semibold">상태: </span>
                    <span class="text-h6">{{ task.status }}</span>
                </div>
                <div>
                    <span class="text-h6 font-weight-semibold">설명: </span>
                    <span class="text-h6">{{ task.description }}</span>
                </div>
            </v-card-text>

            <v-card-actions class="justify-center pt-0">
                <v-btn color="error" variant="flat" @click="close">닫기</v-btn>
            </v-card-actions>
        </v-card>

        <v-card v-else>
            <v-card-title v-if="type && type == 'edit'" class="d-flex align-center justify-space-between pt-3 pl-5">
                <h4 class="text-h4">할 일 수정</h4>
                <v-btn class="edit-button" variant="flat" @click="type = 'view'">
                    <v-icon>mdi-arrow-left</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-title v-else class="pt-5 pl-5">
                <h4 class="text-h4 mb-5">할 일 등록</h4>
            </v-card-title>

            <v-card-text class="mt-3">
                <v-text-field v-model="newTask.title" label="할일명" outlined></v-text-field>
                <v-text-field v-model="newTask.startDate" label="시작일" outlined type="datetime-local"></v-text-field>
                <v-text-field v-model="newTask.dueDate" label="종료일" outlined type="datetime-local"></v-text-field>
                <v-select v-model="newTask.status" :items="['TODO', 'IN_PROGRESS', 'PENDING', 'DONE']" label="진행 상태"
                    variant="outlined"></v-select>
                <v-textarea v-model="newTask.description" label="설명" outlined></v-textarea>
            </v-card-text>

            <v-card-actions class="justify-center pt-0">
                <v-btn :disabled="newTask.title == ''" color="success" variant="flat" @click="save">저장</v-btn>
                <v-btn color="error" variant="flat" @click="close">닫기</v-btn>
            </v-card-actions>
        </v-card>
    </div>
</template>

<script>
import BackendFactory from "@/components/api/BackendFactory";

export default {
    props: {
        type: String,
        task: Object,
        todolist: Array,
    },
    data: () => ({
        newTask: {
            taskId: '',
            endpoint: '',
            title: '',
            description: '',
            status: 'TODO',
            startDate: null,
            dueDate: null,
        },
    }),
    async created() {
        if (this.task && this.task.taskId) {
            this.newTask = this.task;
        } else {
            this.newTask = {
                taskId: '',
                endpoint: '',
                title: '',
                description: '',
                status: 'TODO',
                startDate: null,
                dueDate: null,
            };
        }
    },
    methods: {
        close() {
            this.$emit('close')
        },
        async save() {
            const backend = BackendFactory.createBackend();

            if (!this.newTask.taskId) {
                this.newTask.taskId = this.uuid();
            }
            if (!this.newTask.endpoint) {
                const email = localStorage.getItem('email');
                this.newTask.endpoint = email;
            }
            if (this.todolist && this.todolist.length > 0) {
                const statusIndex = this.todolist.findIndex(t => t.id === this.newTask.status);
                if (statusIndex !== -1) {
                    this.todolist[statusIndex].tasks.push(this.newTask);
                }
            }
            await backend.putWorklist(this.newTask.taskId, this.newTask);
            this.close();
        },
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },
    },
}
</script>