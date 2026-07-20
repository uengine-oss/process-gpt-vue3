<template>
    <div>
        <v-card
            elevation="10"
            class="cursor-pointer pa-2 pt-1"
            @click="executeTask"
            :class="[
                { 'choice-background-color': isMyTask && !isTodolistPath && task.status !== 'DONE' },
                { 'todo-status-opacity': task.status === 'TODO' },
                { 'dot-border-animation': isStartedStatus }
            ]"
        >
            <div class="ma-0 pa-0 mt-1" style="line-height: 100%">
                <!-- 가로배치 -->
                <div class="pa-0">
                    <v-row class="ma-0 pa-0" style="width: 100%">
                        <v-col class="pa-0 d-flex align-center" cols="9">
                            <span style="font-size: 16px; font-weight: 500; line-height: 20px">{{ displayTitle }}</span>
                            <v-chip v-if="reworkCount" class="ml-1" size="small" color="info" variant="flat" density="comfortable">{{
                                reworkCount
                            }}</v-chip>
                            <v-chip
                                v-if="task.status === 'SUBMITTED'"
                                class="ml-1"
                                size="small"
                                color="success"
                                variant="flat"
                                density="comfortable"
                            >
                                {{ $t('kanbanColumnCard.submitted') }}
                            </v-chip>
                        </v-col>
                        <v-col class="pa-0" cols="3">
                            <v-row class="ma-0 pa-0 justify-end align-start" style="margin-top: 1px !important">
                                <v-chip
                                    v-if="category"
                                    :color="task.status === 'DONE' ? '' : isMyTask && !isTodolistPath ? 'on-primary' : 'on-surface'"
                                    size="small"
                                    variant="outlined"
                                    density="comfortable"
                                    >{{ category.name }}</v-chip
                                >

                                <RouterLink v-if="managed" to="" class="px-0 ml-1">
                                    <DotsVerticalIcon
                                        size="15"
                                        :style="isMyTask && !isTodolistPath && task.status !== 'DONE' ? 'color: white;' : 'color: black;'"
                                    />
                                    <v-menu activator="parent">
                                        <v-list density="compact">
                                            <v-list-item @click="editTask">
                                                <v-list-item-title>{{ $t('kanbanColumnCard.edit') }}</v-list-item-title>
                                            </v-list-item>
                                            <v-list-item @click="deleteTask">
                                                <v-list-item-title>{{ $t('kanbanColumnCard.delete') }}</v-list-item-title>
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
                    <div v-if="mode == 'uEngine'" class="pa-0" style="font-size: 12px; margin-top: 5px">
                        TaskId : {{ task.taskId }} / InstId: {{ task.instId }}
                    </div>
                    <div v-else-if="isMyTask && isTodolistPath" class="pa-0">
                        <div class="text-caption" style="white-space: pre-wrap; word-break: break-word; max-width: 100%">
                            {{ task.procInstName }}
                        </div>
                    </div>
                    <div v-else class="pa-0">
                        <div class="text-caption" style="white-space: pre-wrap; word-break: break-word; max-width: 100%">
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
                            <v-icon size="16" icon="mdi-alert" style="color: #ff9800" />
                            <span class="text-caption ml-1" style="color: #ff9800">{{ $t('kanbanColumnCard.overdue') }}</span>
                        </div>
                        <div v-else-if="isPastDue" class="d-flex align-center ml-auto">
                            <v-icon size="16" icon="mdi-alert-circle" style="color: #f44336; padding-top: 3px" />
                            <span class="text-caption ml-1" style="color: #f44336">{{ $t('kanbanColumnCard.pastDue') }}</span>
                        </div>
                        <div v-if="isPending" class="d-flex align-center ml-auto">
                            <v-icon size="16" icon="mdi-alert-circle" style="color: #f44336" />
                            <span class="text-caption ml-1" style="color: #f44336">{{ errorMessage }}</span>
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
                        <v-chip
                            v-if="isDueTodayOrTomorrow || isPastDue"
                            size="x-small"
                            :color="isDueTodayOrTomorrow ? 'warning' : 'error'"
                            variant="tonal"
                            class="ml-auto"
                        >
                            {{ isPastDue ? $t('kanbanColumnCard.pastDue') : $t('kanbanColumnCard.overdue') }}
                        </v-chip>
                        <v-tooltip v-if="isPending" location="right">
                            <template v-slot:activator="{ props }">
                                <div class="d-flex align-center ml-2" v-bind="props">
                                    <v-icon size="16" icon="mdi-alert-circle" style="color: #f44336" />
                                    <span class="text-caption ml-1" style="color: #f44336">{{ $t('kanbanColumnCard.error') }}</span>
                                </div>
                            </template>
                            <div class="text-caption text-wrap" style="max-width: 200px">{{ errorMessage }}</div>
                        </v-tooltip>
                    </div>
                </div>
                <div class="pa-0">
                    <div class="text-subtitle-2">
                        {{ task.description }}
                    </div>
                </div>
                <div v-if="currentDraftStatus" class="my-2">
                    <div v-if="currentDraftStatus === 'STARTED'">
                        <div v-if="!detailContent" class="text-subtitle-2">
                            <div class="thinking-wave-text">
                                <div
                                    v-for="(char, index) in $t('kanbanColumnCard.agentWorking')"
                                    :key="index"
                                    :style="{ animationDelay: `${index * 0.1}s` }"
                                    class="thinking-char"
                                >
                                    {{ char === ' ' ? '\u00A0' : char }}
                                </div>
                            </div>
                            <span class="loading-dots">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                            </span>
                        </div>
                    </div>
                    <div v-else class="text-subtitle-2">{{ $t('kanbanColumnCard.agentCompleted') }}</div>
                </div>
                <div v-if="isSubmittedStatus && !currentDraftStatus" class="my-2">
                    <div class="text-subtitle-2">
                        <div class="thinking-wave-text">
                            <div
                                v-for="(char, index) in $t('kanbanColumnCard.submitProcessing')"
                                :key="'submit-' + index"
                                :style="{ animationDelay: `${index * 0.1}s` }"
                                class="submit-processing-char"
                            >
                                {{ char === ' ' ? '\u00A0' : char }}
                            </div>
                        </div>
                        <span class="loading-dots" style="color: #ffffff">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                        </span>
                    </div>
                </div>
                <v-row v-if="!isTodolistPath" class="pa-0 ma-0 mt-1 d-flex align-center">
                    <div
                        v-if="isMultiUser || isMyTask || userInfoForTask"
                        class="mr-1"
                        style="width: 24px"
                        :class="{ 'mr-4': isMultiUser }"
                    >
                        <div v-if="isMultiUser" class="d-flex">
                            <v-img
                                v-for="user in userInfoForTask"
                                :key="user.id || user.email"
                                :src="user.profile ? user.profile : '/images/defaultUser.png'"
                                alt="profile"
                                width="24"
                                height="24"
                                style="border-radius: 50%; margin-right: -8px"
                            />
                        </div>
                        <v-img
                            v-else-if="isMyTask"
                            :src="userInfoForTask && userInfoForTask.profile ? userInfoForTask.profile : '/images/defaultUser.png'"
                            alt="profile"
                            width="24"
                            height="24"
                            class="mr-2"
                            style="border-radius: 50%"
                        />
                        <v-img
                            v-else-if="userInfoForTask"
                            :src="userInfoForTask.profile ? userInfoForTask.profile : '/images/defaultUser.png'"
                            alt="profile"
                            width="24"
                            height="24"
                            style="border-radius: 50%"
                        />
                    </div>
                    <!-- 텍스트를 세로 기준 중앙정렬하기 위해 flex와 align-center 적용 -->
                    <div class="body-text-2 text-dark mr-2">
                        <span v-if="isMultiUser">{{ userInfoForTask.map((user) => user.username || user.name).join(', ') }}</span>
                        <span v-else-if="isMyTask">{{ $t('TodoTaskItemCard.myTask') }}</span>
                        <span v-else-if="userInfoForTask">{{ userInfoForTask.username || userInfoForTask.name }}</span>
                        <span v-else>{{ $t('TodoTaskItemCard.noAssignee') }}</span>
                        <!-- 프로필 이미지를 v-img로 표시, 없으면 기본 이미지 사용 -->
                    </div>
                </v-row>
            </div>

            <v-dialog v-model="dialog" max-width="500" persistent>
                <TodoDialog :type="dialogType" :task="task" @close="closeDialog" />
            </v-dialog>
        </v-card>
    </div>
</template>

<script>
import { format } from 'date-fns';
import TodoDialog from './TodoDialog.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
export default {
    components: {
        TodoDialog
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
        instanceList: [],
        eventSubscription: null,
        taskLogSubscription: null,
        currentDraftStatus: null
    }),
    watch: {
        'task.task.draft_status': {
            immediate: true,
            handler(newValue, oldValue) {
                this.currentDraftStatus = newValue;
            }
        }
    },
    computed: {
        displayTitle() {
            // 모드별 필드 우선순위:
            // - uEngine(worklist): title
            // - ProcessGPT(worklist): name
            const mode = window.$mode;
            if (mode === 'ProcessGPT') return this.task?.name || this.task?.title || '';
            return this.task?.title || this.task?.name || '';
        },
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

            // 완료된 업무는 기한 지남 메시지를 표시하지 않음
            return dueDate < today && this.task.status !== 'DONE';
        },
        formattedDate() {
            let dateString = '';
            if (this.task.startDate) {
                dateString += format(new Date(this.task.startDate), 'yyyy.MM.dd') + ' ~';
            }
            if (this.task.dueDate) {
                if (!dateString.includes('~')) dateString += '~ ';
                dateString += format(new Date(this.task.dueDate), 'yyyy.MM.dd');
            }
            return dateString;
        },
        category() {
            if (!this.task.adhoc && this.task.defId) {
                return { name: 'BPM', color: 'primary' };
            }
            return null;
        },
        allTaskDependencies() {
            if (!this.tasks || !Array.isArray(this.tasks)) {
                return [];
            }

            return this.tasks.reduce((dependencies, task) => {
                if (task.referenceIds && task.referenceIds.length > 0) {
                    const taskDeps = task.referenceIds.map((refId) => ({
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
            if (!this.userList || !this.task) return null;
            if (!this.task.endpoint) {
                if (this.task.assignees && this.task.assignees.length > 0) {
                    return this.task.assignees.map((a) => ({
                        username: a.username || a.email,
                        name: a.username || a.email,
                        id: a.uid || a.email
                    }));
                }
                if (this.task.username) {
                    return { username: this.task.username, name: this.task.username };
                }
                return null;
            }

            if (this.task.endpoint.includes(',')) {
                const endpoints = this.task.endpoint.split(',').map((e) => e.trim());
                let users = [];
                let user = null;
                for (const endpoint of endpoints) {
                    user = this.userList.find((user) => (user.email && user.email === endpoint) || user.id == endpoint);
                    if (user) {
                        users.push(user);
                    } else {
                        // 사용자를 못 찾은 경우 역할명인지 체크
                        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(endpoint);
                        const isEmail = endpoint.includes('@');

                        if (!isUUID && !isEmail) {
                            users.push({
                                username: `[${this.$t('Common.role')}] ${endpoint}`,
                                name: `[${this.$t('Common.role')}] ${endpoint}`,
                                id: endpoint
                            });
                        } else {
                            users.push({
                                username: endpoint,
                                name: endpoint,
                                id: endpoint
                            });
                        }
                    }
                }
                return users.length > 0 ? users : null;
            } else {
                let user = this.userList.find((user) => (user.email && user.email === this.task.endpoint) || user.id == this.task.endpoint);
                if (!user) {
                    // UUID나 email 형식이 아니면 역할명으로 판단
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.task.endpoint);
                    const isEmail = this.task.endpoint.includes('@');

                    if (!isUUID && !isEmail) {
                        user = {
                            username: `[${this.$t('Common.role')}] ${this.task.endpoint}`,
                            name: `[${this.$t('Common.role')}] ${this.task.endpoint}`
                        };
                    } else {
                        user = {
                            username: this.task.endpoint,
                            name: this.task.endpoint
                        };
                    }
                }
                return user;
            }
        },
        isMultiUser() {
            if (this.task.endpoint && this.task.endpoint.includes(',')) return true;
            if (!this.task.endpoint && this.task.assignees && this.task.assignees.length > 1) return true;
            return false;
        },
        isMyTask() {
            const myUid = localStorage.getItem('uid');
            if (!myUid || !this.task) return false;
            if (!this.task.endpoint) {
                if (this.task.assignees && this.task.assignees.length > 0) {
                    return this.task.assignees.some((a) => a.uid === myUid || a.email === localStorage.getItem('email'));
                }
                return false;
            }

            // 현재 사용자의 이메일 정보 가져오기 (userList에서)
            const myUserInfo = this.userList.find((user) => user.id === myUid);
            const myEmail = myUserInfo ? myUserInfo.email : null;

            if (this.task.endpoint.includes(',')) {
                const endpoints = this.task.endpoint.split(',');
                return endpoints.includes(myUid) || (myEmail && endpoints.includes(myEmail));
            } else {
                return this.task.endpoint === myUid || (myEmail && this.task.endpoint === myEmail);
            }
        },
        isTodolistPath() {
            // 현재 경로가 todolist를 포함하는지 확인
            return this.$route.path.includes('/todolist');
        },
        isPending() {
            return this.task.status === 'PENDING';
        },
        errorMessage() {
            if (this.task.status === 'PENDING' && this.task.log && this.task.log.length > 0) {
                if (
                    this.task.log.includes('PROCEED_CONDITION_NOT_MET') ||
                    this.task.log.includes('SYSTEM_ERROR') ||
                    this.task.log.includes('DATA_FIELD_NOT_EXIST')
                ) {
                    return this.task.log;
                }
            }
            return '출력된 메시지가 없습니다.';
        },
        isStartedStatus() {
            return this.currentDraftStatus === 'STARTED';
        },
        isSubmittedStatus() {
            return this.task.status === 'SUBMITTED';
        },
        reworkCount() {
            if (this.task && this.task.task && this.task.task.rework_count) {
                return this.task.task.rework_count;
            }
            return null;
        }
    },
    async mounted() {
        this.managed = this.task.adhoc;
        // 초기 draft_status 설정
        this.currentDraftStatus = this.task.task?.draft_status;

        try {
            // 인스턴스 목록 가져오기
            const result = await backend.getInstanceListByStatus(['NEW', 'RUNNING']);
            if (!result) return;

            // 현재 task의 instId와 일치하는 인스턴스 찾기
            if (this.task.instId) {
                const matchingInstance = result.find((inst) => inst.instId === this.task.instId);
                if (matchingInstance) {
                    this.task.procInstName = matchingInstance.name;
                }
            }
        } catch (error) {
            console.error('인스턴스 목록을 가져오는 중 오류 발생:', error);
        }

        // 백엔드 이벤트 신호 직접 구독
        this.subscribeToBackendEvents();

        // 태스크 로그 구독
        this.subscribeToTaskLog();
    },
    beforeUnmount() {
        // 이벤트 구독 해제
        if (this.eventSubscription) {
            this.eventSubscription.unsubscribe();
        }
        if (this.taskLogSubscription) {
            window.$supabase.removeChannel(this.taskLogSubscription);
        }
    },
    methods: {
        async subscribeToTaskLog() {
            if (!this.task.taskId || this.task.status == 'DONE') return;
            let lastStatus = this.task.status;
            this.taskLogSubscription = await backend.getTaskLog(this.task.taskId, async (task) => {
                if (task.status !== lastStatus) {
                    lastStatus = task.status;
                    this.EventBus.emit('todolist-updated');
                    if (task.status === 'DONE') {
                        window.$supabase.removeChannel(this.taskLogSubscription);
                        this.taskLogSubscription = null;
                    }
                }
            });
        },
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },
        executeTask() {
            this.$router.push(`/todolist/${this.task.taskId}`);
        },
        closeDialog() {
            this.dialog = false;
        },
        deleteTask() {
            this.$emit('deleteTask', this.task);
        },
        editTask() {
            this.dialogType = 'edit';
            this.dialog = true;
        },
        subscribeToBackendEvents() {
            try {
                // window.$supabase로 Supabase 클라이언트 접근
                if (!window.$supabase) {
                    console.error('Supabase 클라이언트를 찾을 수 없음');
                    return;
                }

                const channel = window.$supabase
                    .channel(`task-${this.task.taskId}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'events',
                            filter: `todo_id=eq.${this.task.taskId}`
                        },
                        (payload) => {
                            this.handleBackendEvent(payload.new);
                        }
                    )
                    .subscribe();

                this.eventSubscription = channel;
            } catch (error) {
                console.error('이벤트 구독 실패:', error);
            }
        },
        handleBackendEvent(eventData) {
            if (eventData.event_type === 'task_started') {
                this.updateDraftStatus('STARTED');
            } else if (eventData.event_type === 'task_completed') {
                this.updateDraftStatus('COMPLETED');
            }
        },
        updateDraftStatus(newStatus) {
            this.currentDraftStatus = newStatus;
        }
    }
};
</script>

<style scoped>
.todo-status-opacity {
    opacity: 0.5;
}
</style>
