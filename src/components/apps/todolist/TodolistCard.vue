<template>
    <v-card elevation="10">
        <div class="pa-4 todolist-card-box">
            <div class="d-flex align-center justify-space-between ml-2">
                <h5 class="text-h5 font-weight-semibold">{{ ($t('todoList.title')) }}</h5>

                <v-avatar v-if="mode === 'ProcessGPT'"
                    size="24" elevation="10" class="bg-surface d-flex align-center cursor-pointer"
                    @click="openDialog">
                    <v-tooltip activator="parent" location="left">할 일 등록</v-tooltip>
                    <PlusIcon size="24" stroke-width="2" />
                </v-avatar>
            </div>

            <v-row class="ma-0 pa-0 todo-task-column-box-pc">
                <v-col v-for="column in todolist" :key="column.id"
                    class="pa-2"
                    cols="12" md="3" sm="3"
                >
                    
                    <TodoTaskColumn :column="column"
                        :loading="loading" 
                        @executeTask="executeTask" 
                        @scrollBottom="handleScrollBottom"
                    />
                </v-col>
            </v-row>

            <v-row class="ma-0 pa-0 todo-list-container todo-task-column-box-mobile">
                <div class="todo-list-scroll">
                    <v-col v-for="column in todolist" :key="column.id"
                        class="pa-1 todo-list-scroll-v-col"
                        :style="foldedColumns.includes(column.id) ? 'max-width: 40px !important;' : ''"
                    >
                        <TodoTaskColumn 
                            :column="column" 
                            :loading="loading" 
                            @executeTask="executeTask" 
                            @scrollBottom="handleScrollBottom"
                            @todoTaskColumnFold="todoTaskColumnFold"
                            @todoTaskColumnunfold="todoTaskColumnUnfold"
                        />
                    </v-col>
                </div>
            </v-row>
        </div>

        <v-dialog v-model="dialog" max-width="500">
            <TodoDialog :todolist="todolist" @close="closeDialog" />
        </v-dialog>
    </v-card>
</template>

<script>
import TodoDialog from './TodoDialog.vue';
import TodoTaskColumn from './TodoTaskColumn.vue';

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();
export default {
    components: {
        TodoTaskColumn,
        TodoDialog,
    },
    data: () => ({
        mode: window.$mode,
        foldedColumns: [],
        todolist: [
            {
                id: 'TODO',
                title: 'todoList.todo',
                cardbg: 'background',
                tasks: []
            },
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
                id: 'DONE',
                title: 'todoList.done',
                cardbg: 'lightsuccess',
                tasks: []
            }
        ],
        dialog: false,

        loading: false,
        offset: 10,
        currentPage: 0,
    }),
    mounted() {
        this.mode = window.$mode;
    },
    async created() {
        await Promise.all([
            this.loadToDo(),
            this.loadCompletedWorkList()
        ]);
    },
    methods: {
        todoTaskColumnFold(id) {
            if (!this.foldedColumns.includes(id)) {
                this.foldedColumns.push(id);
            }
        },
        todoTaskColumnUnfold(id) {
            this.foldedColumns = this.foldedColumns.filter(columnId => columnId !== id);
        },
        executeTask(item) {
            var me = this
            me.$router.push(`/todolist/${item.taskId}`)
        },
        loadToDo() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    let worklist = await backend.getWorkList()
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
                    let worklist = await backend.getCompletedList({page: me.currentPage, size: me.offset});
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
        handleScrollBottom() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    // console.log("!! EXECUTE")
                    me.loading = true
                    me.currentPage++
                    await me.loadCompletedWorkList()
                    // await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 지연
                    me.loading = false
                }
            })
        },
        loadWorkItemByInstId(instId) {
            const todoTasks = this.todolist.find(item => item.id === 'TODO').tasks;
            const instanceIds = todoTasks.map(task => task.instId);
            if (instanceIds.length == 0) return;
        },
        openDialog() {
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        },
    },
}
</script>
<style>
.todo-task-column-box-mobile {
    display: none;
}
/* 모바일 사이즈(md 미만)에서만 가로 스크롤 적용 */
@media (max-width: 959px) {
    .todo-task-column-box-pc {
        display: none;
    }
    .todo-task-column-box-mobile {
        display: block;
    }
    .todo-list-container {
        position: relative;
        width: 100%;
    }

    .todo-list-scroll {
        display: block;
        width: 100%;
    }
    .todo-list-scroll {
        display: flex;
        overflow-x: auto;
        padding-bottom: 12px;
    }

    .todo-list-scroll .todo-list-scroll-v-col {
        flex: 0 25 auto;
    }

    .todolist-card-box {
        padding: 4px !important;
    }

    /* 스크롤바 스타일링 */
    .todo-list-scroll::-webkit-scrollbar {
        height: 8px;
    }

    .todo-list-scroll::-webkit-scrollbar-track {
        background: transparent;
    }

    .todo-list-scroll::-webkit-scrollbar-thumb {
        background: #d1d1d1;
        border-radius: 4px;
    }
}

/* 모바일 사이즈(md 미만)에서만 가로 스크롤 적용 */
@media (max-width: 700px) {
    .todo-list-scroll .todo-list-scroll-v-col {
        max-width: 250px;
        flex: 0 0 auto;
    }
}
</style>