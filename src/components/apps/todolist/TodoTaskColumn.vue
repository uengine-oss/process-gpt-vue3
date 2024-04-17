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
                @end="updateTask"
            >
                <transition-group>
                    <div v-for="task in column.tasks"
                        :key="task.id" 
                        class="mt-6 cursor-move">
                        <TodoTaskItemCard :task="task" @deleteTask="deleteTask" />
                    </div>
                </transition-group>
            </draggable>
            <div v-else>
                <div v-for="task in column.tasks"
                    :key="task.id" 
                    class="mt-6">
                    <TodoTaskItemCard :task="task" @deleteTask="deleteTask" />
                </div>
            </div>
        </div>
    </v-card>
</template>

<script>
import TodoTaskItemCard from './TodoTaskItemCard.vue';

import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    components: {
        TodoTaskItemCard
    },
    props: {
        column: Object,
    },
    data: () => ({
    }),
    methods: {
        updateTask(event) {
            console.log(event)
        },
        /**
         * 할 일 목록 카드의 메뉴에서 제거 버튼을 눌렀을 경우, 매칭되는 할 일을 삭제시키기 위해서
         * @param {*} task 삭제하려는 task 정보
         */
        async deleteTask(task) {
            this.column.tasks = this.column.tasks.filter((item) => item.taskId !== task.taskId);
            await StorageBaseFactory.getStorage().delete(`todolist/${task.taskId}`, {key: 'id'});
        }
    }
}
</script>
