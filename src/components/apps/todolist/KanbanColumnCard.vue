<template>
     <div>
        <v-card elevation="10" class="cursor-pointer pa-2 pt-1" @click="executeTask"
            :class="[
                { 'choice-background-color': isMyTask && !isTodolistPath && task.status !== 'DONE'},
                { 'todo-status-opacity': task.status === 'TODO' }
            ]"
        >
            <div class="ma-0 pa-0 mt-1" style="line-height:100%;">
                <!-- 가로배치 -->
                <div class="pa-0">
                    <v-row class="ma-0 pa-0" style="width: 100%;">
                        <v-col class="pa-0" cols="9">
                            <div style="font-size:16px; font-weight:500; line-height: 20px;">{{ task.name }}</div>
                        </v-col>
                        <v-col class="pa-0" cols="3">
                            <v-row class="ma-0 pa-0 justify-end align-start"
                                style="margin-top: 1px !important;"
                            >
                                <v-chip v-if="category"
                                    :color="task.status === 'DONE' ? category.color: 'black'"
                                    size="small" variant="outlined"
                                    density="comfortable"
                                >{{ category.name }}</v-chip>
                
                                <RouterLink v-if="managed" to="" class="px-0 ml-1" >
                                    <DotsVerticalIcon size="15"
                                        :style="isMyTask && !isTodolistPath &&  task.status !== 'DONE' ? 'color: white;' : 'color: black;'"
                                    />
                                    <v-menu activator="parent">
                                        <v-list density="compact">
                                            <v-list-item @click="editTask">
                                                <v-list-item-title>수정</v-list-item-title>
                                            </v-list-item>
                                            <v-list-item @click="deleteTask">
                                                <v-list-item-title>삭제</v-list-item-title>
                                            </v-list-item>
                                        </v-list>
                                    </v-menu>
                                </RouterLink>
                            </v-row>
                        </v-col>
                    </v-row>
                </div>
               <!-- 세로배치 -->
               <div class="mt-1">
                    <div v-if="mode == 'uEngine'" 
                        class="pa-0"
                        style="font-size:12px; margin-top: 5px;"
                    >
                        TaskId : {{ task.taskId }} / InstId: {{ task.instId }}
                    </div>
                    <div v-else-if="isMyTask && isTodolistPath" class="pa-0">
                        <div class="text-caption" style="white-space: pre-wrap; word-break: break-word; max-width: 100%;">
                            {{ task.procInstName }}
                        </div>
                    </div>
                    <div v-else class="pa-0">
                        <div class="text-caption" style="white-space: pre-wrap; word-break: break-word; max-width: 100%;">
                            {{ task.instName }}
                        </div>
                    </div>
                    <div v-if="!userInfoForTask" class="d-flex align-center justify-between mt-1">
                        <div class="d-flex align-center">
                            <v-icon size="16" icon="mdi-calendar" />
                            <div class="body-text-1 text-dark ml-1">
                                {{ formattedDate }}
                            </div>
                        </div>
                        <div v-if="isDueTodayOrTomorrow" class="d-flex align-center ml-auto">
                            <v-icon size="16" icon="mdi-alert" style="color: #FF9800;" />
                            <span class="text-caption ml-1" style="color: #FF9800;">기한 임박</span>
                        </div>
                        <div v-else-if="isPastDue" class="d-flex align-center ml-auto">
                            <v-icon size="16" icon="mdi-alert-circle" style="color: #F44336;" />
                            <span class="text-caption ml-1" style="color: #F44336;">기한 지남</span>
                        </div>
                    </div>
                </div>
                <div v-if="userInfoForTask">
                    <div class="d-flex align-center mt-1">
                        <CalendarIcon size="16" class="mr-1" />
                        <div class="body-text-1 text-dark">
                            {{ formattedDate }}
                        </div>
                        <v-spacer></v-spacer>
                        <div v-if="isDueTodayOrTomorrow" class="d-flex align-center ml-auto">
                            <v-icon size="16" icon="mdi-alert" style="color: #FF9800;" />
                            <span class="text-caption ml-1" style="color: #FF9800;">기한 임박</span>
                        </div>
                        <div v-else-if="isPastDue" class="d-flex align-center ml-auto">
                            <v-icon size="16" icon="mdi-alert-circle" style="color: #F44336;" />
                            <span class="text-caption ml-1" style="color: #F44336;">기한 지남</span>
                        </div>
                    </div>
                </div>
                <div class="pa-0">
                    <div class="text-subtitle-2">
                        {{ task.description }}
                    </div>
                </div>
                <v-row v-if="!isTodolistPath" class="pa-0 ma-0 mt-1 d-flex align-center">
                    <div class="mr-1" style="width: 24px;" :class="{'mr-4': isMultiUser}">
                        <div v-if="isMultiUser" class="d-flex"> 
                            <v-img v-for="user in userInfoForTask"
                                :src="user.profile ? user.profile : '/images/defaultUser.png'"
                                alt="profile"
                                width="24"
                                height="24"
                                style="border-radius: 50%; margin-right: -8px;"
                            />
                        </div>
                        <v-img v-else-if="isMyTask"
                            :src="userInfoForTask && userInfoForTask.profile ? userInfoForTask.profile : '/images/defaultUser.png'"
                            alt="profile"
                            width="24"
                            height="24"
                            class="mr-2"
                            style="border-radius: 50%;"
                        />
                        <v-img v-else-if="userInfoForTask"
                            :src="userInfoForTask.profile ? userInfoForTask.profile : '/images/defaultUser.png'"
                            alt="profile"
                            width="24"
                            height="24"
                            style="border-radius: 50%;"
                        />
                    </div>
                    <!-- 텍스트를 세로 기준 중앙정렬하기 위해 flex와 align-center 적용 -->
                    <div class="body-text-2 text-dark mr-2">
                        <!-- isMyTask가 아니면 '내 업무'로 표시, 맞으면 기존 이름/이메일 표시 -->
                        <span v-if="isMultiUser">{{ userInfoForTask.map(user => user.username).join(', ') }}</span>
                        <span v-else-if="isMyTask">{{ $t('TodoTaskItemCard.myTask') }}</span>
                        <span v-else-if="userInfoForTask">{{ userInfoForTask.username }}</span>
                        <!-- 프로필 이미지를 v-img로 표시, 없으면 기본 이미지 사용 -->
                    </div>
                </v-row>
            </div>

            <v-dialog v-model="dialog" max-width="500" persistent>
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
export default {
    components: {
        TodoDialog,
    },
    props: {
        task: Object,
        userList: {
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
        // 오늘 또는 내일까지가 기한인 업무이면서, 상태가 'DONE'이 아닐 때 true 반환
        isDueTodayOrTomorrow() {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // 오늘 날짜의 자정
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1); // 내일 날짜의 자정

            const dueDate = new Date(this.task.dueDate);
            dueDate.setHours(0, 0, 0, 0); // 기한 날짜의 자정

            // 'DONE'이 아닐 때만 true 반환
            return dueDate >= today && dueDate <= tomorrow && this.task.status !== 'DONE';
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
            if(!this.task.adhoc && this.task.defId) {
                return { name: 'BPM', color: 'primary' };
            }
            return null
        },
        allTaskDependencies() {
            if (!this.tasks || !Array.isArray(this.tasks)) {
                return [];
            }
            
            return this.tasks.reduce((dependencies, task) => {
                if (task.referenceIds && task.referenceIds.length > 0) {
                    const taskDeps = task.referenceIds.map(refId => ({
                        id: this.generateUUID(),
                        taskId: task.taskId,
                        depends_id: refId
                    }));
                    return [...dependencies, ...taskDeps];
                }
                return dependencies;
            }, []);
        },
        userInfoForTask() {
            if (!this.userList || !this.task || !this.task.endpoint) return null;
            if (this.task.endpoint.includes(',')) {
                const endpoints = this.task.endpoint.split(',');
                let users = [];
                let user = null;
                for (const endpoint of endpoints) {
                    user = this.userList.find(user => (user.email && user.email === endpoint) || user.id == endpoint);
                    if (user) {
                        users.push(user)
                    }
                };
                return users;
            } else {
                let user = this.userList.find(user => (user.email && user.email === this.task.endpoint) || user.id == this.task.endpoint);
                if (!user) {
                    user = {
                        name: this.task.endpoint
                    }
                }
                return user;
            }
        },
        isMultiUser() {
            return this.task.endpoint.includes(',');
        },
        isMyTask() {
            // localStorage의 email과 task의 endpoint가 일치하고, task의 status가 'DONE'이 아닐 때 true 반환
            const myEmail = localStorage.getItem('email');
            if (this.task.endpoint.includes(',')) {
                const endpoints = this.task.endpoint.split(',');
                return endpoints.includes(myEmail);
            } else {
                return myEmail && this.task && this.task.endpoint === myEmail;
            }
        },
        isTodolistPath() {
            // 현재 경로가 todolist를 포함하는지 확인
            return this.$route.path.includes('/todolist');
        }
    },
    async mounted() {
        this.managed = this.task.adhoc;
        
        try {
            // 인스턴스 목록 가져오기
            const result = await backend.getInstanceListByStatus(["NEW", "RUNNING"]);
            if (!result) return;
            
            // 현재 task의 instId와 일치하는 인스턴스 찾기
            if (this.task.instId) {
                const matchingInstance = result.find(
                    inst => inst.instId === this.task.instId
                );
                if (matchingInstance) {
                    this.task.procInstName = matchingInstance.name;
                }
            }
        } catch (error) {
            console.error('인스턴스 목록을 가져오는 중 오류 발생:', error);
        }
    },
    methods: {
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        executeTask() {
            this.$router.push(`/todolist/${this.task.taskId}`)
            // if (!this.managed) {
            //     this.$router.push(`/todolist/${this.task.taskId}`)
            // } else {
            //     this.dialogType = 'view';
            //     this.dialog = true;
            // }
        },
        closeDialog() {
            this.dialog = false;
        },
        deleteTask() {
            this.$emit('deleteTask', this.task);
        },
        editTask(){
            this.dialogType = 'edit';
            this.dialog = true;
        },
    },
}
</script>

<style scoped>
.todo-status-opacity {
    opacity: 0.5;
}
</style>