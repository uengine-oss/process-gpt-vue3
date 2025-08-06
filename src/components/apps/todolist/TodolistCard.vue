<template>
    <v-card elevation="10">
        <div class="pa-4" :class="this.globalIsMobile.value ? 'todolist-card-box-is-mobile' : 'todolist-card-box'">
            <div class="d-flex align-center justify-space-between ml-2">
                <h5 class="text-h5 font-weight-semibold">{{ ($t('todoList.title')) }}</h5>

                <!-- '나의 업무'에서 기존 TODO였던 '예정 업무' 부분에 업무를 등록하던 버튼은 '예정 업무'가 제거되면서 주석 처리됨 -->
                <!-- <v-avatar v-if="mode === 'ProcessGPT'"
                    size="24" elevation="10" class="bg-surface d-flex align-center cursor-pointer"
                    @click="openDialog"
                >
                    <v-tooltip activator="parent" location="left">{{ ($t('todoList.addTask')) }}</v-tooltip>
                    <PlusIcon size="24" stroke-width="2" />
                </v-avatar> -->
            </div>
            <KanbanBoard
                :columns="filteredTodolist"
                :isNotAll="false"
                :showAddButton="false"
                @loadMore="handleLoadMore"
                @updateStatus="updateStatus"
            />
        </div>

        <v-dialog v-model="dialog" max-width="500" persistent
            :fullscreen="isMobile"
        >
            <TodoDialog :todolist="todolist" @close="closeDialog" />
        </v-dialog>
    </v-card>
</template>

<script>
import KanbanBoard from './KanbanBoard.vue';
import TodoDialog from './TodoDialog.vue';

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    components: {
        KanbanBoard,
        TodoDialog
    },
    data: () => ({
        mode: window.$mode,
        userInfo: null,
        todolist: [
            {
                id: 'IN_PROGRESS',
                title: 'todoList.inProgress',
                cardbg: 'lightsecondary',
                tasks: []
            },
            {
                id: 'PENDING',
                title: 'todoList.pending',
                cardbg: 'lightinfo',
                tasks: []
            },
            {
                id: 'TODO',
                title: 'todoList.todo',
                cardbg: 'background',
                tasks: []
            },
            {
                id: 'DONE',
                title: 'todoList.done',
                cardbg: 'lightsuccess',
                tasks: []
            }
        ],
        dialog: false,
        currentPage: 0,
        deletedInstances: null
    }),
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        filteredTodolist() {
            // 삭제된 인스턴스들의 proc_inst_id 배열 생성
            const deletedInstanceIds = this.deletedInstances ? this.deletedInstances.map(instance => instance.proc_inst_id) : [];
            
            return this.todolist
                .filter(column => column.id !== 'TODO')  // 기존 TODO 컬럼 제외
                .map(column => ({
                    ...column,
                    tasks: column.tasks.filter(task => {
                        // rootInstId 또는 instId가 삭제된 인스턴스 리스트에 있는지 확인
                        return !deletedInstanceIds.includes(task.rootInstId) || !deletedInstanceIds.includes(task.instId);
                    })
                }));
        }
    },
    async mounted() {
        this.mode = window.$mode;
        this.userInfo = await backend.getUserInfo();

        await Promise.all([
            this.loadToDo(),
            this.loadCompletedWorkList(),
            this.loadDeletedInstance()
        ]);
    },
    methods: {
        loadDeletedInstance() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    this.deletedInstances = await backend.getDeletedInstances()
                }
            })
        },
        handleLoadMore(page) {
            this.loadCompletedWorkList();
        },
        loadToDo() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    let worklist = await backend.getWorkList({userId: this.userInfo.id})
                    if(!worklist) worklist = []
                    worklist.forEach(function(item) {
                        if (item.status == 'TODO' || item.status == 'NEW' || item.status == 'DRAFT') {
                            me.todolist.find(x => x.id == 'TODO').tasks.push(item);
                        } else if (item.status == 'IN_PROGRESS' || item.status == 'SUBMITTED') {
                            me.todolist.find(x => x.id == 'IN_PROGRESS').tasks.push(item);
                        } else if (item.status == 'PENDING') {
                            me.todolist.find(x => x.id == 'PENDING').tasks.push(item);
                        } 
                    })
                }
            })
        },
        loadCompletedWorkList() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    let worklist = await backend.getCompletedList({page: me.currentPage, size: 10});
                    if(!worklist) worklist = []
                    worklist.forEach(function(item) {
                        if (item.status == 'DONE' || item.status == 'COMPLETED') {
                            var tasks = me.todolist.find(x => x.id == 'DONE').tasks
                            var taskExist = tasks.find(task => task.taskId == item.taskId)
                            if(!taskExist) {
                                tasks.push(item);
                            }
                        }
                    })
                }
            })
        },
        updateStatus(taskId, originColumnId) {
            let task;
            this.todolist.forEach(column => {
                let foundTask = column.tasks.find(task => task.taskId === taskId);
                if (foundTask) {
                    task = foundTask;
                    column.tasks = column.tasks.filter(task => task.taskId !== taskId);
                }
            });
            if (task) {
                this.todolist.find(column => column.id === originColumnId).tasks.push(task);
            }
        },
        openDialog() {
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        }
    }
}
</script>