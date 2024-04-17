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
import { format } from 'date-fns';

import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();
const storageKey = 'todolist'

export default {
    props: {
        type: String,
        task: Object,
        todolist: Array,
    },
    data: () => ({
        userInfo: {},
        newTask: {
            taskId: '',
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
                title: '',
                description: '',
                status: 'TODO',
                startDate: null,
                dueDate: null,
            };
        }
        this.userInfo = await storage.getUserInfo();
    },
    methods: {
        close() {
            this.$emit('close')
        },
        async save() {
            if (!this.newTask.taskId) {
                this.newTask.taskId = this.uuid();
            }
            if (this.todolist && this.todolist.length > 0) {
                const statusIndex = this.todolist.findIndex(t => t.id === this.newTask.status);
                if (statusIndex !== -1) {
                    this.todolist[statusIndex].tasks.push(this.newTask);
                }
            }
            const putObj = {
                id: this.newTask.taskId,
                user_id: this.userInfo.email,
                activity_id: this.newTask.title,
                description: this.newTask.description,
                status: this.newTask.status,
                start_date: this.newTask.startDate,
                end_date: this.newTask.dueDate,
            }
            await storage.putObject(storageKey, putObj);
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
        
        async addNewSchedule(task) {
            const uid = localStorage.getItem('uid');
            const year_month = format(new Date(task.start_date), "yyyy_MM");
            const schedule = await storage.getObject(`calendar/${uid}`, {key: 'uid'});

            var newSchedule = {};
            if (schedule && schedule.data) {
                if (schedule.data[`${year_month}`]) {
                    newSchedule = schedule.data;
                } else {
                    newSchedule[`${year_month}`] = {}
                }
                newSchedule[`${year_month}`][`${task.id}`] = {
                    id: task.id,
                    start: task.start_date,
                    end: task.end_date,
                    title: task.activity_id,
                    allDay: true,
                }
            } else {
                newSchedule[`${year_month}`] = {}
                newSchedule[`${year_month}`][`${task.id}`] = {
                    id: task.id,
                    start: task.start_date,
                    end: task.end_date,
                    title: task.activity_id,
                    allDay: true,
                }
            }
            
            var putObj = {
                uid: uid,
                data: newSchedule
            };
            storage.putObject('calendar', putObj);
            
            this.sendNotification(task);
        },
        async sendNotification(data) {
            const options = {
                match: {
                    id: this.userInfo.uid,
                    email: this.userInfo.email,
                }
            };
            const result = await storage.getObject('users', options);
            let notifications = result.notifications;
            if (!notifications) {
                notifications = [];
            }
            const noti = {
                id: data.id,
                type: 'todo',
                isChecked: false,
            };
            notifications.push(noti);

            const obj = {
                id: this.userInfo.uid,
                notifications: notifications,
            };
            storage.putObject('users', obj);
        },
    },
}
</script>