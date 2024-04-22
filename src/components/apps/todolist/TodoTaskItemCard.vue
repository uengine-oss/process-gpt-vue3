<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
    <v-card elevation="10" class="mb-5 cursor-pointer" @click="executeTask">
        <div class="d-flex align-center justify-space-between px-4 py-2 pr-3">
            <h5 class="text-subtitle-2 font-weight-semibold pr-4">
                {{ formattedTitle }}
            </h5>
            
            <RouterLink v-if="managed" to="" class="px-0">
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

        <p class="text-subtitle-2 px-4">
            {{ task.description }}
        </p>
        
        <div class="d-flex align-center justify-space-between px-4 py-3">
            <div class="d-flex align-center">
                <CalendarIcon size="16" />
                <div class="body-text-1 text-dark pl-2">
                    {{ formattedDate }}
                </div>
            </div>
            <div v-if="category" :class="'rounded-sm body-text-1 px-1 py-0 bg-' + category.color" size="small">
                {{ category.name }}
            </div>
        </div>

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
    }),
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
        formattedTitle() {
            if (window.$mode == 'ProcessGPT') {
                return this.task.title;
            } else if (window.$mode == 'uEngine') {
                return `${this.task.title}  (TaskId: ${this.task.taskId}/InstId: ${this.task.instId})`;
            }
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