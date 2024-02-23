<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <div class="pa-5">
            <div class="d-flex align-center justify-space-between">
                <h6 class="text-h6 font-weight-semibold">{{ column.title }}</h6>
                <!-- <v-avatar size="22" 
                    elevation="10" 
                    class="bg-surface d-flex align-center cursor-pointer" 
                >
                    <v-tooltip activator="parent" location="top">Add Task</v-tooltip>
                    <PlusIcon size="13" stroke-width="2" />
                </v-avatar> -->
            </div>
            <!-- <draggable class="dragArea list-group" 
                :list="column.tasks" 
                :animation="200" 
                ghost-class="ghost-card"
                group="tasks"
            > -->
                <transition-group>
                    <div v-for="task in column.tasks"
                        :key="task.key" 
                        class="mt-6 cursor-move"
                    >
                        <TodoTaskItemCard :task="task" :path="path" :userInfo="userInfo" :storage="storage" />
                    </div>
                </transition-group>
            <!-- </draggable> -->
        </div>
    </v-card>
</template>

<script>
import TodoTaskItemCard from './TodoTaskItemCard.vue';

export default {
    components: {
        TodoTaskItemCard
    },
    props: {
        path: String,
        userInfo: Object,
        column: Object,
        storage: Object
    },
    data: () => ({
    }),
    created() {
    }, 
    methods: {
    },
}
</script>