<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
     <div :class="{'border-animation': isMyTask && !isTodolistPath}">
        <v-card elevation="10" class="cursor-pointer pa-2" @click="executeTask"
            :class="{
                'border-primary': isDueTodayOrTomorrow, 
                'border-purple': isPastDue,
            }"
        >
            <v-card-title class="ma-0 pa-0">
                <div class="ma-0 pa-0 mt-1" style="line-height:100%;">
                    <!-- 가로배치 -->
                    <div class="pa-0">
                        <div class="d-flex align-items-center" style="width: 100%;">
                            <div style="font-size:16px; font-weight:500;">{{ task.title }}</div>
                            <v-spacer></v-spacer>
                            <v-chip v-if="category"
                                :color="category.color"
                                size="small" variant="outlined"
                                density="comfortable"
                                style="margin-left:5px;"
                            >{{ category.name }}</v-chip>
            
                            <RouterLink v-if="managed" to="" class="px-0" color="black">
                                <DotsVerticalIcon size="15" />
                                <v-menu activator="parent">
                                    <v-list density="compact">
                                        <v-list-item @click="deleteTask">
                                            <v-list-item-title>삭제</v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </RouterLink>
                        </div>
                    </div>
                    <!-- 세로배치 -->
                    <div class="mt-1">
                        <div v-if="mode == 'uEngine'" 
                            class="pa-0"
                            style="font-size:12px; margin-top: 5px;"
                        >
                            TaskId : {{ task.taskId }} / InstId: {{ task.instId }}
                        </div>
                        <div v-else-if="isMyTask && isTodolistPath" colos="12" class="pa-0">
                            <div class="text-caption" style="white-space: pre-wrap; word-break: break-word; max-width: 100%;">
                                {{ task.proc_inst_name }}
                            </div>
                        </div>
                        <div v-else colos="12" class="pa-0">
                            <div class="text-caption" style="white-space: pre-wrap; word-break: break-word; max-width: 100%;">
                                {{ task.instName }}
                            </div>
                        </div>
                    </div>
                    <div class="pa-0 mt-1">
                        <div class="d-flex align-center">
                            <CalendarIcon size="16" />
                            <div class="body-text-1 text-dark pl-2">
                                {{ formattedDate }}
                            </div>
                        </div>
                    </div>
                    <div class="pa-0">
                        <div class="text-subtitle-2">
                            {{ task.description }}
                        </div>
                    </div>
                    <!-- 담당자 정보 표시 -->
                    <div class="pa-0 mt-1" v-if="userInfoForTask && !isMyTask">
                        <div class="d-flex align-center">
                            <div class="body-text-1 text-dark">
                            {{ $t('TodoTaskItemCard.assignee') }}: {{ userInfoForTask.username || userInfoForTask.email }}
                            </div>
                        </div>
                    </div>
                </div>
            </v-card-title>

            <v-dialog v-model="dialog" max-width="500">
                <TodoDialog 
                    :type="dialogType"
                    :task="task"
                    @close="closeDialog"
                />
            </v-dialog>
        </v-card>
    </div>
</template>

<script>
import { format } from 'date-fns';
import TodoDialog from './TodoDialog.vue'

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
/*
task: {
    "defId": "sales/testProcess.xml",
    "endpoint": "manager",      
    "instId": 9,                
    "rootInstId": 9,     
    "taskId": 10,     
    "startDate": "2024-04-12",  
    "dueDate": "2024-04-17", 
    "status": "NEW",            
    "title": "Task_b",
    "description": "",  
    "tool": "defaultHandler","formHandler:definitionId"  
}
*/
export default {
    components: {
        TodoDialog,
    },
    props: {
        task: Object,
        userInfo: {
            type: Array,
            default: () => []
        }
    },
    data: () => ({
        managed: false,
        dialog: false,
        dialogType: '',
        instanceList: []
    }),
    computed: {
        mode() {
            return window.$mode;
        },
        remainingDays() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(this.task.dueDate);
            dueDate.setHours(0, 0, 0, 0);

            const timeDiff = dueDate - today;
            const daysDiff = timeDiff / (1000 * 3600 * 24);

            return daysDiff >= 0 ? `${daysDiff} days remaining` : `Due date passed`;
        },
        isDueTodayOrTomorrow() {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // 오늘 날짜의 자정
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1); // 내일 날짜의 자정

            const dueDate = new Date(this.task.dueDate);
            dueDate.setHours(0, 0, 0, 0); // 기한 날짜의 자정

            return dueDate >= today && dueDate <= tomorrow;
        },
        isPastDue() {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // 오늘 날짜의 자정

            const dueDate = new Date(this.task.dueDate);
            dueDate.setHours(0, 0, 0, 0); // 기한 날짜의 자정

            return dueDate < today;
        },
        formattedDate() {
            var dateString = "";
            if (this.task.startDate) {
                dateString += format(new Date(this.task.startDate), "yyyy.MM.dd") + " ~";
            } 
            if (this.task.dueDate) {
                if (!dateString.includes("~")) dateString += "~ "
                dateString += format(new Date(this.task.dueDate), "yyyy.MM.dd");
            }
            return dateString;
        },
        category() {
            if (!this.task.instId || this.task.adhoc) {
                return null
            } else {
                return { name: 'BPM', color: 'primary' };
            }
        },
        userInfoForTask() {
            if (!this.userInfo || !this.task || !this.task.endpoint) return null;
            return this.userInfo.find(user => user.email === this.task.endpoint);
        },
        isMyTask() {
            // localStorage의 email과 task의 endpoint가 일치하는지 확인
            const myEmail = localStorage.getItem('email');
            return myEmail && this.task && this.task.endpoint === myEmail;
        },
        isTodolistPath() {
            // 현재 경로가 todolist를 포함하는지 확인
            return this.$route.path.includes('/todolist');
        }
    },
    async created() {
        if (!this.task.instId) {
            this.managed = true;
        } else {
            this.managed = false;
        }
        
        try {
            // 인스턴스 목록 가져오기
            const result = await backend.getInstanceList();
            if (!result) return;
            
            // 현재 task의 instId와 일치하는 인스턴스 찾기
            if (this.task.instId) {
                const matchingInstance = result.find(
                    inst => inst.instId === this.task.instId
                );
                if (matchingInstance) {
                    this.task.proc_inst_name = matchingInstance.instName;
                }
            }
        } catch (error) {
            console.error('인스턴스 목록을 가져오는 중 오류 발생:', error);
        }
    },
    methods: {
        executeTask() {
            console.log(this.managed)
            if (!this.managed) {
                this.$emit('executeTask', this.task);
            } else {
                this.dialogType = 'view';
                this.dialog = true;
            }
        },
        closeDialog() {
            this.dialog = false;
        },
        deleteTask() {
            this.$emit('deleteTask', this.task);
        }
    },
}
</script>