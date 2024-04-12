<template>
    <div>
        <v-card v-if="type == 'new'">
            <v-card-title class="pt-5 pl-5">
                <h4 class="text-h4 mb-5">할 일 등록</h4>
            </v-card-title>

            <v-card-text>
                <v-text-field v-model="newTask.activity_id" label="할일명" outlined></v-text-field>
                <v-text-field v-model="newTask.start_date" label="시작일" outlined type="datetime-local"></v-text-field>
                <v-text-field v-model="newTask.end_date" label="종료일" outlined type="datetime-local"></v-text-field>
                <v-select v-model="newTask.status" :items="['TODO', 'IN_PROGRESS', 'PENDING', 'DONE']" label="진행 상태"
                    variant="outlined"></v-select>
                <v-textarea v-model="newTask.description" label="설명" outlined></v-textarea>
            </v-card-text>

            <v-card-actions class="justify-center pt-0">
                <v-btn :disabled="newTask.activity_id == ''" color="success" variant="flat" @click="add">저장</v-btn>
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
                <v-text-field v-model="task.activity_id" label="할일명" outlined></v-text-field>
                <v-text-field v-model="task.start_date" label="시작일" outlined type="datetime-local"></v-text-field>
                <v-text-field v-model="task.end_date" label="종료일" outlined type="datetime-local"></v-text-field>
                <v-select v-model="task.status" :items="['TODO', 'IN_PROGRESS', 'PENDING', 'DONE']" label="진행 상태"
                    variant="outlined"></v-select>
                <v-textarea v-model="task.description" label="설명" outlined></v-textarea>
            </v-card-text>

            <v-card-actions class="justify-center pt-0">
                <v-btn :disabled="task.activity_id == ''" color="success" variant="flat" @click="edit">저장</v-btn>
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
                    <span class="text-h6">{{ task.activity_id }}</span>
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
            user_id: '',
            activity_id: '',
            description: '',
            status: 'TODO',
            start_date: null,
            end_date: null,
        },
    }),
    computed: {
        startDate() {
            if (this.task.start_date) {
                return format(new Date(this.task.start_date), "yyyy-MM-dd HH:mm:ss");
            } else {
                return "";
            }
        },
        endDate() {
            if (this.task.end_date) {
                return format(new Date(this.task.end_date), "yyyy-MM-dd HH:mm:ss");
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
                    user_id: '',
                    activity_id: '',
                    description: '',
                    status: 'TODO',
                    start_date: null,
                    end_date: null,
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