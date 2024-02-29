<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
    <v-card elevation="10" class="mb-5 cursor-pointer" @dblclick="openDetail">
        <div class="d-flex align-center justify-space-between px-4 py-2 pr-3">
            <h5 class="text-subtitle-2 font-weight-semibold pr-4">
                {{ task.activity_id }}
            </h5>
            <RouterLink to="" class="px-0 ">
                <DotsVerticalIcon size="15" />
                <v-menu activator="parent">
                    <v-list density="compact">
                        <v-list-item @click="deleteTask(task.id)">
                            <v-list-item-title >
                                삭제
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </RouterLink>
        </div>

        <p class="text-subtitle-2 px-4">
            {{ instance ? instance.proc_inst_name : task.description }}
        </p>
        
        <div class="d-flex align-center justify-space-between px-4 py-3">
            <div class="d-flex align-center">
                <CalendarIcon size="16" />
                <div class="body-text-1 text-dark pl-2">
                    {{ formattedDate }}
                </div>
            </div>
            <!-- <div :class="'rounded-sm body-text-1 px-1 py-0 bg-' + task?.categorybg" size="small">
                {{ task?.category }}
            </div> -->
        </div>

        <v-dialog v-model="dialog" max-width="500">
            <TodoDialog 
                :type="dialogType"
                :task="task"
                @edit="editTask"
                @close="closeDialog"
            />
        </v-dialog>
    </v-card>
</template>

<script>
import { format } from 'date-fns';

import TodoDialog from './TodoDialog.vue'

export default {
    components: {
        TodoDialog,
    },
    props: {
        path: String,
        userInfo: Object,
        task: Object,
        storage: Object,
    },
    data: () => ({
        instance: null,
        dialog: false,
        dialogType: '',
    }),
    computed: {
        formattedDate() {
            var dateString = "";
            if (this.task.start_date) {
                dateString += format(new Date(this.task.start_date), "yyyy.MM.dd HH:mm") + " ~";
            } 
            if (this.task.end_date) {
                if (!dateString.includes("~")) dateString += "~ "
                dateString += format(new Date(this.task.end_date), "yyyy.MM.dd HH:mm");
            }
            return dateString;
        }
    },
    created() {
        this.init();
    },
    methods: {
        async init() {
            if (this.task.proc_def_id) {
                this.instance = await this.storage.getObject(`${this.task.proc_def_id}/${this.task.proc_inst_id}`, 
                    {key: 'proc_inst_id'}
                );
            
                if (this.instance) {
                    var isUpdated = false
                    if (!this.task.activity_id) {
                        isUpdated = true
                        this.task.activity_id = this.instance.current_activity_ids[0];
                    }
                    if (this.task.status == "IN_PROGRESS" && !this.task.start_date) {
                        isUpdated = true
                        this.task.start_date = this.task.end_date;
                    }

                    if (isUpdated) {
                        await this.storage.putObject('todolist', this.task);
                    }
                }
            }
        },
        openDetail() {
            if (this.task.proc_inst_id) {
                this.$router.push(`/instances/chat?id=${this.task.proc_inst_id}`);
            } else {
                this.dialogType = 'view';
                this.dialog = true;
            }
        },
        deleteTask(id) {
            this.storage.delete(`todolist/${id}`, {key: 'id'});
        },
        async editTask() {
            await this.storage.putObject('todolist', this.task);
            this.closeDialog();
        },
        closeDialog() {
            this.dialog = false;
        }
    },
}
</script>