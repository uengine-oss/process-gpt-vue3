<template>
    <v-card elevation="10">
        <v-row class="ma-0 pa-0" style="height:calc(100vh - 270px); overflow:auto;">
            <v-col v-for="column in todolist" :key="column.id" cols="12" lg="3" md="3" sm="6">
                <TodoTaskColumn :column="column" :loading="loading" :isNotAll="true"
                    @executeTask="executeTask" @scrollBottom="handleScrollBottom" @updateStatus="updateStatus"  />
            </v-col>
        </v-row>

        <v-btn icon color="primary" size="40" elevation="10" class="todo-add-btn" @click="openDialog">
            <v-tooltip activator="parent" location="right">할 일 등록</v-tooltip>
            <PlusIcon size="24" stroke-width="2" />
        </v-btn>

        <v-dialog v-model="dialog" max-width="500">
            <TodoDialog :todolist="todolist" :instId="id" :defId="defId" @close="closeDialog" />
        </v-dialog>
    </v-card>
</template>

<script>
import TodoTaskColumn from './TodoTaskColumn.vue';
import TodoDialog from './TodoDialog.vue';

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    components: {
        TodoTaskColumn,
        TodoDialog,
    },
    props: {
        instance: Object,
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
        dialog: false,
        defId: '',
    }),
    created() {
        this.init();
        if (this.mode === 'ProcessGPT') {
            this.defId = this.id.split('.')[0];
        }
    },
    computed: {
        mode() {
            return window.$mode;
        },
        id() {
            const route = this.mode == 'ProcessGPT' ? decodeURIComponent(atob(this.$route.params.instId)) : this.$route.params.instId;
            return route;
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
        },
    },
    methods: {
        async init() {
            this.todolist.forEach(column => {
                column.tasks = [];
            });
            await this.loadToDo();
            await this.loadCompletedWorkList();
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
                    let worklist = await backend.getAllWorkListByInstId(me.id)
                    // let worklist = await backend.getWorkList({ instId: me.id })
                    if(!worklist) worklist = []
                    worklist.forEach((item) => {
                        if (item.instId != me.id) return
                        if (item.status == 'TODO' || item.status == 'DRAFT' || item.status == 'Ready' ) {
                            me.todolist.find(x => x.id == 'TODO').tasks.push(item);
                        } else if (item.status == 'IN_PROGRESS' || item.status == 'Running' || item.status == 'NEW') {
                            me.todolist.find(x => x.id == 'IN_PROGRESS').tasks.push(item);
                        } else if (item.status == 'PENDING') {
                            me.todolist.find(x => x.id == 'PENDING').tasks.push(item);
                        } else if (item.status == 'DONE' || item.status == 'COMPLETED') {
                            me.todolist.find(x => x.id == 'DONE').tasks.push(item);
                        }
                    })
                }
            })
        },
        loadCompletedWorkList() {
            // !!! REMOVE
            return [];
            // var me = this
            // me.$try({
            //     context: me,
            //     action: async () => {
            //         let worklist = await backend.getCompletedList({page: me.currentPage, size: me.offset, instId: me.id});
            //         if(!worklist) worklist = []
            //         worklist.forEach(function(item) {
            //             if (item.instId != me.id) return
            //             if (item.status == 'DONE' || item.status == 'COMPLETED') {
            //                 me.todolist.find(x => x.id == 'DONE').tasks.push(item);
            //             }
            //         })
            //     }
            // })
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
            this.EventBus.emit('instances-updated');
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
.todo-add-btn {
    position: absolute;
    left: 10px;
    bottom: 10px;
    z-index: 1000;
}
</style>

