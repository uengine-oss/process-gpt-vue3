<template>
    <v-card elevation="10">
        <div class="pa-5">
            <h5 class="text-h5 font-weight-semibold mb-7">{{ ($t('todoList.title')) }}</h5>
            <v-row>
                <v-col v-for="column in todolist" 
                    :key="column.id"
                    cols="12" 
                    md="3" 
                    sm="6" 
                    class="d-flex" 
                >
                    <TodoTaskColumn :column="column" :path="path" :userInfo="userInfo" :storage="storage" />
                </v-col>
            </v-row>
        </div>
    </v-card>
</template>

<script>
import StorageBase from '@/utils/StorageBase';
import TodoTaskColumn from './TodoTaskColumn.vue';

export default {
    components: {
        TodoTaskColumn,
    },
    data: () => ({
        storage: null,
        todolist: [
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
        ],
        userInfo: {},
        path: 'todolist',
    }),
    async created() {
        this.storage = StorageBase.getStorage("supabase");
        this.userInfo = await this.storage.getUserInfo();
        await this.getTodolist();
        await this.storage.watch(this.path, this.getTodolist);
    }, 
    methods:{
        async getTodolist() {
            if (this.userInfo && this.userInfo.email) {
                const list = await this.storage.list(this.path);
                if (list && list.length > 0) {
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

                    list.forEach(item => {
                        if (item.user_id == this.userInfo.email) {
                            if (item.status == "TODO") {
                                this.todolist[0].tasks.push(item);
                            } else if (item.status == "IN_PROGRESS") {
                                this.todolist[1].tasks.push(item);
                            } else if (item.status == "PENDING") {
                                this.todolist[2].tasks.push(item);
                            } else if (item.status == "DONE") {
                                this.todolist[3].tasks.push(item);
                            }
                        }
                    })
                }
            }
        },
    },
}
</script>