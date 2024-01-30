<template>
    <v-card elevation="10">
        <div class="pa-5">
            <h5 class="text-h5 font-weight-semibold mb-7">Todolist</h5>
            <v-row>
                <v-col v-for="column in todolist" 
                    :key="column.id"
                    cols="12" 
                    md="3" 
                    sm="6" 
                    class="d-flex" 
                >
                    <TodoTaskColumn :column="column" :path="path" :userInfo="userInfo" />
                </v-col>
            </v-row>
        </div>
    </v-card>
</template>

<script>
import TodoTaskColumn from './TodoTaskColumn.vue';
import { getGlobalContext } from '@/stores/auth';

const globalContext = getGlobalContext();

export default {
    components: {
        TodoTaskColumn,
    },
    data: () => ({
        todolist: [],
        userInfo: {},
        path: 'todolist',
    }),
    async created() {
        await this.init();
    }, 
    methods:{
        async init() {
            this.userInfo = await globalContext.storage.getUserInfo();

            if (this.userInfo && this.userInfo.email) {
                var callPath = this.path + '/' + this.userInfo.email;
                await globalContext.storage.watch(`db://${callPath}`, callback => {
                    this.todolist =  [
                        {
                            id: 'todo',
                            title: 'Todo',
                            cardbg: 'background',
                            tasks: []
                        },
                        {
                            id: 'in_progress',
                            title: 'In Progress',
                            cardbg: 'lightsecondary',
                            tasks: []
                        },
                        {
                            id: 'pending',
                            title: 'Pending',
                            cardbg: 'lightinfo',
                            tasks: []
                        },
                        {
                            id: 'done',
                            title: 'Done',
                            cardbg: 'lightsuccess',
                            tasks: []
                        }
                    ];
                    if (callback) {
                        var list = Object.values(callback);
                        list.forEach(item => {
                            if (item.status == "todo") {
                                this.todolist[0].tasks.push(item);
                            } else if (item.status == "in_progress") {
                                this.todolist[1].tasks.push(item);
                            } else if (item.status == "pending") {
                                this.todolist[2].tasks.push(item);
                            } else if (item.status == "done") {
                                this.todolist[3].tasks.push(item);
                            }
                        })
                    }
                });
            }
        },
    },
}
</script>