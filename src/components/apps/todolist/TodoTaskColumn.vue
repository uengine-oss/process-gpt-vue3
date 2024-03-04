<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <div class="pa-5">
            <div class="d-flex align-center justify-space-between">
                <h6 class="text-h6 font-weight-semibold">{{ column.title }}</h6>
            </div>

            <draggable 
                v-if="column.id !='DONE'"
                class="dragArea list-group cursor-move" 
                :list="column.tasks" 
                :animation="200" 
                ghost-class="ghost-card"
                group="tasks"
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
    watch: {
        "column.tasks": {
            deep: true,
            async handler(val) {
                if (val && val.length > 0) {
                    val.forEach(async (item, index) => {
                        if (item.status != this.column.id) {
                            item.status = this.column.id;
                            await this.storage.putObject('todolist', item);
                        }
                    })
                }
            }
        }
    },
}
</script>
