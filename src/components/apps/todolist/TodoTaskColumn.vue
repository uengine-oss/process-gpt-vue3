<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <div class="pa-5">
            <div class="d-flex align-center justify-space-between">
                <h6 class="text-h6 font-weight-semibold">{{ column.title }}</h6>
                <v-avatar size="20" 
                    elevation="10" 
                    class="bg-surface font-weight-bold align-center"
                >{{ count }}</v-avatar>
            </div>

            <draggable 
                v-if="column.id !='DONE'"
                class="dragArea list-group cursor-move" 
                :list="column.tasks" 
                :animation="200" 
                ghost-class="ghost-card"
                group="tasks"
                @add="handleDragAdd"
                @remove="handleDragRemove"
            >
                <transition-group>
                    <div v-for="task in column.tasks"
                        :key="task.id" 
                        class="mt-6 cursor-move"
                    >
                        <TodoTaskItemCard 
                            :task="task" 
                            :path="path" 
                            :userInfo="userInfo" 
                            :storage="storage" 
                            ref="taskCard" 
                        />
                    </div>
                </transition-group>
            </draggable>
            <div v-else>
                <div v-for="task in column.tasks"
                    :key="task.id" 
                    class="mt-6"
                >
                    <TodoTaskItemCard 
                        :task="task" 
                        :path="path" 
                        :userInfo="userInfo" 
                        :storage="storage" 
                        ref="taskCard" 
                    />
                </div>
            </div>
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
        count: 0,
    }),
    async created() {
        this.count = await this.getCount();
    },
    methods: {
        async getCount() {
            const userId = localStorage.getItem('email');
            return await this.storage.getCount(this.path, {match: {
                status: this.column.id,
                user_id: userId
            }});
        },
        async handleDragAdd(event) {
            this.$refs.taskCard[0].updateTask(this.column.id);
            this.count = await this.getCount();
        },
        async handleDragRemove(event) {
            this.count = await this.getCount();
        }
    },
}
</script>