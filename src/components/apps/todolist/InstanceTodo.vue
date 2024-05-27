<template>
    <v-card elevation="10">
        <div class="pa-5 h-100">
            <v-row class="ma-0 pa-0">
                <v-col v-for="column in todolist" :key="column.id" cols="12" md="3" sm="6">
                    <TodoTaskColumn :column="column" :loading="loading" @executeTask="executeTask" @scrollBottom="handleScrollBottom" />
                </v-col>
            </v-row>
        </div>
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

        loading: false,
        offset: 10,
        currentPage: 0,
    }),
    created() {
        this.loadToDo();
        this.loadCompletedWorkList();
    },
    computed: {
        id() {
            return atob(this.$route.params.instId);
        },
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.todolist.forEach(column => {
                        column.tasks = [];
                    });
                    this.loadToDo();
                    this.loadCompletedWorkList();
                }
            }
        }
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
                    worklist.forEach((item) => {
                        if (item.instId != me.id) return
                        if (item.status == 'TODO' || item.status == 'NEW' || item.status == 'DRAFT') {
                            me.todolist.find(x => x.id == 'TODO').tasks.push(item);
                        } else if (item.status == 'IN_PROGRESS') {
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
                        if (item.instId != me.id) return
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
                    me.loading = true
                    me.currentPage++
                    await me.loadCompletedWorkList()
                    me.loading = false
                }
            })
        },
    },
}
</script>