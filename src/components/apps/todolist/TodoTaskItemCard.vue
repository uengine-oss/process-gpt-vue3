<template>
    <!-- ---------------------------------------------------- -->
    <!-- Table Basic -->
    <!-- ---------------------------------------------------- -->
    <v-card elevation="10" class="mb-5">
        <div class="d-flex align-center justify-space-between px-4 py-2 pr-3">
            <h5 class="text-subtitle-2 font-weight-semibold pr-4 cursor-move">{{ task.activityName }}</h5>
            <RouterLink to="" class="px-0">
                <DotsVerticalIcon size="15" />
                <v-menu activator="parent">
                    <v-list density="compact">
                        <v-list-item value="Delete">
                            <v-list-item-title @click="deleteTask(task.instanceId)">
                                Delete
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </RouterLink>
        </div>

        <p class="text-subtitle-2 px-4 cursor-pointer" @click="goChat">
            {{ task.instanceName }}
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
        task: Object
    },
    data: () => ({
    }),
    computed: {
        formattedDate() {
            var dateString = "";
            if (this.task.status === "done") {
                dateString = formatDistanceToNowStrict(new Date(this.task.endDate), {
                    addSuffix: false
                });
            } else {
                dateString = formatDistanceToNowStrict(new Date(this.task.startDate), {
                    addSuffix: false
                });
            }
            return dateString;
        }
    },
    methods: {
        goChat() {
            this.$router.push(`/instances/${this.task.instanceId}`);
        },
    },
}
</script>