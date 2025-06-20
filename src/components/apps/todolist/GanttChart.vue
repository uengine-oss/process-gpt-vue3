<template>
    <div class="overflow-y-auto" style="height: 100%;" v-if="!isLoading">
        <Gantt 
            :tasks="tasks" 
            :dependencies="dependencies"
            :users="users" 
            @task-updated="handleTaskUpdated" 
            @task-added="handleTaskAdded"
            @task-clicked="handleTaskClicked"
            @grid-row-clicked="handleGridRowClicked"
            @link-event="handleLinkEvent"
        />

        <v-dialog v-model="dialogVisible" max-width="500px">
            <v-card>
                <v-card-title>
                <span class="headline">작업 편집</span>
                </v-card-title>
                <v-card-text>
                <v-form v-if="selectedTask">
                    <v-text-field v-model="selectedTask.text" label="업무명" />
                    <v-text-field v-model="selectedTask.start_date" label="시작일" type="date" />
                    <v-text-field v-model="selectedTask.due_date" label="마감일" type="date" />
                    <v-text-field v-model="selectedTask.status" label="상태" />
                </v-form>
                </v-card-text>
                <v-card-actions>
                <v-spacer />
                <v-btn color="primary" @click="saveTaskEdit">저장</v-btn>
                <v-btn text @click="dialogVisible = false">취소</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
// import { format } from 'date-fns';
import BackendFactory from '@/components/api/BackendFactory';
import Gantt from '@/components/Gantt.vue';

export default {
    components: {
        Gantt
    },
    props: {
        instance: Object,
        tasks: Array,
        dependencies: Array,
        users: Array
    },
    data: () => ({
        dialogVisible: false,
        selectedTask: null
    }),
    methods: {
        handleTaskUpdated(task){
            this.$emit('task-updated', task);
        },
        handleTaskAdded(task){
            this.$emit('task-added', task);
        },
        handleTaskClicked(task){
            // const task = workItems.value.find(item => item.id == id);
            // if (task) {
            //     selectedTask.value = { ...task };
            //     dialogVisible.value = true;
            // }
            this.$emit('task-clicked', task);
        },
        handleGridRowClicked(item){
            this.$emit('grid-row-clicked', item);
        },
        handleLinkEvent(event){
            this.$emit('link-event', event);
        }
    }
};
</script>

<style>
.g-upper-timeunit {
    font-size: 20px;
    font-weight: 500;
}

.g-timeunit {
    font-size: 16px;
    font-weight: 500;
}

.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.dialog-box {
    background: #fff;
    padding: 24px;
    border-radius: 8px;
    min-width: 320px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
</style>

