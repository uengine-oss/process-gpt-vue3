<template>
    <v-card elevation="10">
        <div class="pa-4" :class="this.globalIsMobile.value ? 'todolist-card-box-is-mobile' : 'todolist-card-box'">
            <div class="d-flex align-center justify-space-between ml-2">
                <h5 class="text-h5 font-weight-semibold">{{ ($t('todoList.title')) }}</h5>

                <v-avatar v-if="mode === 'ProcessGPT'"
                    size="24" elevation="10" class="bg-surface d-flex align-center cursor-pointer"
                    @click="openDialog"
                >
                    <v-tooltip activator="parent" location="left">{{ ($t('todoList.addTask')) }}</v-tooltip>
                    <PlusIcon size="24" stroke-width="2" />
                </v-avatar>
            </div>
            <KanbanBoard
                :columns="todolist"
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
        currentPage: 0,
    }),
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
    },
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
        handleLoadMore(page) {
            this.loadCompletedWorkList();
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