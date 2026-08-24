<template>
    <v-card elevation="10" class="rounded-xl">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">Task/Event 종류 설정</h1>
            </div>
        </div>

        <v-card-text class="pa-4 pt-2">
            <TaskTypeSettings />
        </v-card-text>
    </v-card>
</template>

<script>
import TaskTypeSettings from '@/components/admin/TaskTypeSettings.vue';

export default {
    name: 'TaskTypeManagement',
    components: {
        TaskTypeSettings
    }
};
</script>
