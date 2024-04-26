<template>
    <v-card elevation="10">
        <div class="pa-5">
            <div class="d-flex align-center justify-space-between mb-7">
                <h5 class="text-h5 font-weight-semibold">{{ ($t('todoList.title')) }}</h5>

                <v-avatar size="24" elevation="10" class="bg-surface d-flex align-center cursor-pointer"
                    @click="openDialog">
                    <v-tooltip activator="parent" location="left">할 일 등록</v-tooltip>
                    <PlusIcon size="24" stroke-width="2" />
                </v-avatar>
            </div>

            <v-row>
                <v-col v-for="column in todolist" :key="column.id" cols="12" md="3" sm="6" class="d-flex">
                    <TodoTaskColumn :column="column" :loading="loading" @executeTask="executeTask" @scrollBottom="handleScrollBottom" />
                </v-col>
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
        todolist: [
            {
                id: 'TODO',
                title: 'Todo',
                cardbg: 'background',
                tasks: []
            },
            {
                id: 'IN_PROGRESS',
                title: 'In Progress',
                cardbg: 'lightsecondary',
                tasks: []
            },
            {
                id: 'PENDING',
                title: 'Pending',
                cardbg: 'lightinfo',
                tasks: []
            },
            {
                id: 'DONE',
                title: 'Done',
                cardbg: 'lightsuccess',
                tasks: []
            }
        ],
        dialog: false,

        loading: false,
        offset: 5,
        currentPage: 0,
    }),
    created() {
        this.loadToDo();
        this.loadCompletedWorkList();
        // this.loadInProgress();
        // this.loadPending();
    },
    methods: {
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
                        } else if (item.status == 'IN_PROGRESS') {
                            me.todolist.find(x => x.id == 'IN_PROGRESS').tasks.push(item);
                        } else if (item.status == 'PENDING') {
                            me.todolist.find(x => x.id == 'PENDING').tasks.push(item);
                        } 
                    })
                    // me.todolist.find(x => x.id == 'TODO').tasks.push(...worklist);
                    // me.todolist.find(x => x.id == 'IN_PROGRESS').tasks.push(...worklist);
                    // me.todolist.find(x => x.id == 'PENDING').tasks.push(...worklist);
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
                            me.todolist.find(x => x.id == 'DONE').tasks.push(item);
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
        // loadInProgress() {
        //     var me = this
        //     me.$try({
        //         context: me,
        //         action: async () => {
        //             let back = BackendFactory.createBackend();
        //             let worklist = await back.getInProgressList()
        //             
        //         }
        //     })
        // },
        // loadPending() {
        //     var me = this
        //     me.$try({
        //         context: me,
        //         action: async () => {
        //             let back = BackendFactory.createBackend();
        //             let worklist = await back.getPendingList()
        //             
        //         }
        //     })
        // },
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