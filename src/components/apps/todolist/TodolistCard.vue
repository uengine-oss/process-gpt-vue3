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
                    <TodoTaskColumn :column="column" :path="path" :userInfo="userInfo" :storage="storage" @executeTask="executeTask" />
                </v-col>
            </v-row>
        </div>

        <v-dialog v-model="dialog" max-width="500">
            <TodoDialog 
                :type="'new'"
                @add="addNewTask"
                @close="closeDialog"
            />
        </v-dialog>
    </v-card>
</template>

<script>
import { format } from 'date-fns';

import StorageBaseFactory from '@/utils/StorageBaseFactory';
import TodoDialog from './TodoDialog.vue';
import TodoTaskColumn from './TodoTaskColumn.vue';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    components: {
        TodoTaskColumn,
        TodoDialog,
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
    }),
    async created() {
        this.storage = StorageBaseFactory.getStorage();
        this.userInfo = await this.storage.getUserInfo();

        // this.getTodolist();
        this.loadToDo();
    },
    async mounted() {
        var me = this;
        await this.storage.watch(me.path, me.getTodolist);
    },
    methods:{
        executeTask(item){
            var me = this
            me.$router.push(`/todolist/${item.taskId}`)
        },
        loadToDo(){
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    let back = BackendFactory.createBackend();
                    let result = await back.getWorkList()

                    let mappedResult = result._embedded.worklist.map(task => ({
                        defId: task.defId,
                        endpoint: task.endpoint,
                        instId: task.instId,
                        rootInstId: task.rootInstId,
                        taskId: parseInt(task._links.self.href.split('/').pop()),
                        startDate: task.startDate,
                        dueDate: task.dueDate,
                        status: task.status,
                        title: task.title,
                        tool: task.tool,
                        description: task.description || "" // description이 null일 경우 빈 문자열로 처리
                    }));
                    me.todolist.find(x => x.id == 'TODO').tasks.push(...mappedResult);
                }
            })
        },
        loadWorkItemByInstId(instId){
            const todoTasks = this.todolist.find(item => item.id === 'TODO').tasks;
            const instanceIds = todoTasks.map(task => task.instId);
            if(instanceIds.length == 0 ) return;
            
            
            
       
        },
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
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        },
        addNewTask(task) {
            task.id = this.uuid();
            task.user_id = this.userInfo.email;
            if (task.activity_id != '' && task.user_id != '') {
                this.todolist.find(item => item.id === task.status).tasks.push(task);
                this.storage.putObject(this.path, task);
            }
            this.closeDialog();
            this.addNewSchedule(task);
        },
        async addNewSchedule(task) {
            const uid = localStorage.getItem('uid');
            const year_month = format(new Date(task.start_date), "yyyy_MM");
            const schedule = await this.storage.getObject(`calendar/${uid}`, {key: 'uid'});

            var newSchedule = {};
            if (schedule && schedule.data) {
                if (schedule.data[`${year_month}`]) {
                    newSchedule = schedule.data;
                } else {
                    newSchedule[`${year_month}`] = {}
                }
                newSchedule[`${year_month}`][`${task.id}`] = {
                    id: task.id,
                    start: task.start_date,
                    end: task.end_date,
                    title: task.activity_id,
                    allDay: true,
                }
            } else {
                newSchedule[`${year_month}`] = {}
                newSchedule[`${year_month}`][`${task.id}`] = {
                    id: task.id,
                    start: task.start_date,
                    end: task.end_date,
                    title: task.activity_id,
                    allDay: true,
                }
            }
            
            var putObj = {
                uid: uid,
                data: newSchedule
            };
            this.storage.putObject('calendar', putObj);
            
            this.sendNotification(task);
        },
        async sendNotification(data) {
            const options = {
                match: {
                    id: this.userInfo.uid,
                    email: this.userInfo.email,
                }
            };
            const result = await this.storage.getObject('users', options);
            let notifications = result.notifications;
            if (!notifications) {
                notifications = [];
            }
            const noti = {
                id: data.id,
                type: 'todo',
                isChecked: false,
            };
            notifications.push(noti);

            const obj = {
                id: this.userInfo.uid,
                notifications: notifications,
            };
            this.storage.putObject('users', obj);
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