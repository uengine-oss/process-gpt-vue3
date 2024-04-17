<template>
    <div>
        <v-card v-if="type == 'new'">
            <v-card-title class="pt-5 pl-5">
                <h4 class="text-h4 mb-5">할 일 등록</h4>
            </v-card-title>

            <v-card-text>
                <v-text-field v-model="newTask.title" label="할일명" outlined></v-text-field>
                <v-text-field v-model="newTask.startDate" label="시작일" outlined type="datetime-local"></v-text-field>
                <v-text-field v-model="newTask.dueDate" label="종료일" outlined type="datetime-local"></v-text-field>
                <v-select v-model="newTask.status" :items="['TODO', 'IN_PROGRESS', 'PENDING', 'DONE']" label="진행 상태"
                    variant="outlined"></v-select>
                <v-textarea v-model="newTask.description" label="설명" outlined></v-textarea>
            </v-card-text>

            <v-card-actions class="justify-center pt-0">
                <v-btn :disabled="newTask.title == ''" color="success" variant="flat" @click="add">저장</v-btn>
                <v-btn color="error" variant="flat" @click="close">닫기</v-btn>
            </v-card-actions>
        </v-card>

        <v-card v-else-if="type == 'edit'">
            <v-card-title class="d-flex align-center justify-space-between pt-3 pl-5">
                <h4 class="text-h4">할 일 수정</h4>
                <v-btn class="edit-button" variant="flat" @click="type = 'view'">
                    <v-icon>mdi-arrow-left</v-icon>
                </v-btn>
            </v-card-title>

            <v-card-text class="mt-3">
                <v-text-field v-model="task.title" label="할일명" outlined></v-text-field>
                <v-text-field v-model="task.startDate" label="시작일" outlined type="datetime-local"></v-text-field>
                <v-text-field v-model="task.dueDate" label="종료일" outlined type="datetime-local"></v-text-field>
                <v-select v-model="task.status" :items="['TODO', 'IN_PROGRESS', 'PENDING', 'DONE']" label="진행 상태"
                    variant="outlined"></v-select>
                <v-textarea v-model="task.description" label="설명" outlined></v-textarea>
            </v-card-text>

            <v-card-actions class="justify-center pt-0">
                <v-btn :disabled="task.title == ''" color="success" variant="flat" @click="edit">저장</v-btn>
                <v-btn color="error" variant="flat" @click="close">닫기</v-btn>
            </v-card-actions>
        </v-card>

        <v-card v-else-if="type == 'view'">
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
                    <span class="text-h6">{{ startDate }}</span>
                </div>
                <div class="mb-3">
                    <span class="text-h6 font-weight-semibold">종료일: </span>
                    <span class="text-h6">{{ endDate }}</span>
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
    </div>
</template>

<script>
import { format } from 'date-fns';

export default {
    props: {
        type: String,
        task: Object,
    },
    data: () => ({
        newTask: {
            id: '',
            endpoint: '',
            title: '',
            description: '',
            status: 'TODO',
            startDate: null,
            dueDate: null,
        },
    }),
    computed: {
        startDate() {
            if (this.task.startDate) {
                return format(new Date(this.task.startDate), "yyyy-MM-dd HH:mm:ss");
            } else {
                return "";
            }
        },
        endDate() {
            if (this.task.dueDate) {
                return format(new Date(this.task.dueDate), "yyyy-MM-dd HH:mm:ss");
            } else {
                return "";
            }
        }
    },
    methods: {
        add() {
            this.$emit('add', this.newTask)
        },
        close() {
            if (this.type == 'add') {
                this.newTask = {
                    id: '',
                    endpoint: '',
                    title: '',
                    description: '',
                    status: 'TODO',
                    startDate: null,
                    dueDate: null,
                };
            }
            this.$emit('close')
        },
        edit() {
            this.$emit('edit');
        }
    },
}
</script>