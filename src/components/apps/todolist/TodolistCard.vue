<template>
    <v-card elevation="10">
        <div class="pa-5">
            <div class="d-flex align-center justify-space-between mb-7">
                <h5 class="text-h5 font-weight-semibold">{{ ($t('todoList.title')) }}</h5>
                <v-avatar size="24" 
                    elevation="10" 
                    class="bg-surface d-flex align-center cursor-pointer"
                    @click="openDialog" 
                >
                    <v-tooltip activator="parent" location="left">할 일 등록</v-tooltip>
                    <PlusIcon size="24" stroke-width="2" />
                </v-avatar>
            </div>

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

        <v-dialog v-model="dialog" max-width="500">
            <v-card>
                <v-card-text class="mb-4">
                    <h4 class="text-h6 mb-5">할 일 등록</h4>
                    <v-text-field
                        v-model="newTask.activity_id" 
                        label="할일명"
                        outlined
                    ></v-text-field>
                    <v-textarea
                        v-model="newTask.description"
                        label="설명"
                        outlined
                    ></v-textarea>
                    <v-text-field
                        v-model="newTask.start_date"
                        label="시작일"
                        outlined
                        type="datetime-local"
                    ></v-text-field>
                    <v-text-field
                        v-model="newTask.end_date"
                        label="종료일"
                        outlined
                        type="datetime-local"
                    ></v-text-field>
                    <v-select 
                        v-model="newTask.status"
                        :items="['TODO', 'IN_PROGRESS', 'PENDING', 'DONE']"
                        label="진행 상태"
                        variant="outlined"
                    ></v-select>
                </v-card-text>
                <v-card-actions class="justify-center">
                    <v-btn color="primary" 
                        variant="flat" 
                        :disabled="newTask.activity_id==''" 
                        @click="addNewTask"
                    >저장</v-btn>
                    <v-btn color="error" 
                        variant="flat" 
                        @click="dialog = false"
                    >취소</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
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
        userInfo: {},
        path: 'todolist',
        dialog: false,
        newTask: {},
    }),
    async created() {
        this.storage = StorageBase.getStorage("supabase");
        this.userInfo = await this.storage.getUserInfo();
        
        this.getTodolist();
    },
    async mounted() {
        // await this.storage.watch(this.path, this.getTodolist);
    },
    methods:{
        async getTodolist() {
            if (this.userInfo && this.userInfo.email) {
                const list = await this.storage.list(this.path);
                if (list && list.length > 0) {
                    this.todolist =  [
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
        openDialog() {
            this.newTask = {
                id: this.uuid(),
                user_id: '',
                activity_id: '',
                status: 'TODO',
                start_date: null,
                end_date: null,
            };
            this.dialog = true;
        },
        addNewTask() {
            this.newTask.user_id = this.userInfo.email;
            if (this.newTask.activity_id != '' && this.newTask.user_id != '') {
                this.storage.putObject(this.path, this.newTask);
            }
            this.dialog = false;
        },
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },
    },
}
</script>