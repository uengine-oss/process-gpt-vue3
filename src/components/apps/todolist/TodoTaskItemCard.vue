<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
    <v-card elevation="10" class="mb-3 cursor-pointer pa-3" @click="executeTask">
        <v-card-title class="ma-0 pa-0">
            <v-row class="ma-0 pa-0 mt-1" style="line-height:100%;">
                <!-- 가로배치 -->
                <v-col cols="12" class="pa-0">
                    <div class="d-flex align-items-center" style="width: 100%;">
                        <div style="font-size:16px; font-weight:500;">{{ task.title }}</div>
                        <v-spacer></v-spacer>
                        <v-chip v-if="category"
                            :color="category.color"
                            size="small" variant="outlined"
                            density="comfortable"
                            style="margin-left:5px;"
                        >{{ category.name }}</v-chip>
        
                        <RouterLink v-if="managed" to="" class="px-0" color="black">
                            <DotsVerticalIcon size="15" />
                            <v-menu activator="parent">
                                <v-list density="compact">
                                    <v-list-item @click="deleteTask">
                                        <v-list-item-title>삭제</v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                        </RouterLink>
                    </div>
                </v-col>
                <!-- 세로배치 -->
                <v-col cols="12" v-if="mode == 'uEngine'" 
                    class="pa-0"
                    style="font-size:12px; margin-top: 5px;"
                >
                    TaskId : {{ task.taskId }} / InstId: {{ task.instId }}
                </v-col>
                <v-col cols="12" class="pa-0">
                    <div class="d-flex align-center">
                        <CalendarIcon size="16" />
                        <div class="body-text-1 text-dark pl-2">
                            {{ formattedDate }}
                        </div>
                    </div>
                </v-col>
                <v-col cols="12" class="pa-0">
                    <div class="text-subtitle-2">
                        {{ task.description }}
                    </div>
                </v-col>
            </v-row>
        </v-card-title>

        <v-dialog v-model="dialog" max-width="500">
            <TodoDialog 
                :type="dialogType"
                :task="task"
                @close="closeDialog"
            />
        </v-dialog>
    </v-card>
</template>

<script>
import { format } from 'date-fns';
import TodoDialog from './TodoDialog.vue'
/*
task: {
    "defId": "sales/testProcess.xml",
    "endpoint": "manager",      
    "instId": 9,                
    "rootInstId": 9,     
    "taskId": 10,     
    "startDate": "2024-04-12",  
    "dueDate": "2024-04-17", 
    "status": "NEW",            
    "title": "Task_b",
    "description": "",  
    "tool": "defaultHandler","formHandler:definitionId"  
}
*/
export default {
    components: {
        TodoDialog,
    },
    props: {
        task: Object,
    },
    data: () => ({
        managed: false,
        dialog: false,
        dialogType: '',
        mode: window.$mode
    }),
    mounted() {
        this.mode = window.$mode; // 클라이언트 사이드에서 확실하게 설정
    },
    computed: {
        formattedDate() {
            var dateString = "";
            if (this.task.startDate) {
                dateString += format(new Date(this.task.startDate), "yyyy.MM.dd") + " ~";
            } 
            if (this.task.dueDate) {
                if (!dateString.includes("~")) dateString += "~ "
                dateString += format(new Date(this.task.dueDate), "yyyy.MM.dd");
            }
            return dateString;
        },
        category() {
            if (!this.task.instId) {
                return null
            } else {
                return { name: 'BPM', color: 'primary' };
            }
        }
    },
    created() {
        if (!this.task.instId) {
            this.managed = true;
        } else {
            this.managed = false;
        }
    },
    methods: {
        executeTask() {
            if (!this.managed) {
                this.$emit('executeTask', this.task);
            } else {
                this.dialogType = 'view';
                this.dialog = true;
            }
        },
        closeDialog() {
            this.dialog = false;
        },
        deleteTask() {
            this.$emit('deleteTask', this.task);
        }
    },
}
</script>