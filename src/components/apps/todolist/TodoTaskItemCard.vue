<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
    <v-card elevation="10" class="mb-5">
        <div class="d-flex align-center justify-space-between px-4 py-2 pr-3">
            <h5 class="text-subtitle-2 font-weight-semibold pr-4 cursor-move">
                {{ task.activity_id }}
            </h5>
            <RouterLink to="" class="px-0">
                <DotsVerticalIcon size="15" />
                <v-menu activator="parent">
                    <v-list density="compact">
                        <v-list-item value="Delete">
                            <v-list-item-title @click="deleteTask(task.proc_inst_id)">
                                Delete
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </RouterLink>
        </div>

        <p class="text-subtitle-2 px-4 cursor-pointer" @click="goChat">
            {{ instance ? instance.proc_inst_name : '' }}
        </p>
        
        <div class="d-flex align-center justify-space-between px-4 py-3">
            <div class="d-flex align-center">
                <CalendarIcon size="16" />
                <div class="body-text-1 text-dark pl-2">
                    {{ formattedDate }} ago
                </div>
            </div>
            <!-- <div :class="'rounded-sm body-text-1 px-1 py-0 bg-' + task?.categorybg" size="small">
                {{ task?.category }}
            </div> -->
        </div>
    </v-card>
</template>

<script>
import { formatDistanceToNowStrict } from 'date-fns';

export default {
    props: {
        path: String,
        userInfo: Object,
        task: Object,
        storage: Object,
    },
    data: () => ({
        instance: null,
    }),
    async created() {
        this.instance = await this.storage.getObject(`${this.task.proc_def_id}/${this.task.proc_inst_id}`, {key: 'proc_inst_id'});
    }, 
    computed: {
        formattedDate() {
            var dateString = "";
            if (this.task.status === "DONE") {
                dateString = formatDistanceToNowStrict(new Date(this.task.end_date), {
                    addSuffix: false
                });
            } else {
                dateString = formatDistanceToNowStrict(new Date(this.task.start_date), {
                    addSuffix: false
                });
            }
            return dateString;
        }
    },
    methods: {
        goChat() {
            this.$router.push(`/instances/chat?id=${this.task.proc_inst_id}`);
        },
    },
}
</script>