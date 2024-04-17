<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <div class="pa-5">
            <div class="d-flex align-center justify-space-between">
                <h6 class="text-h6 font-weight-semibold">{{ column.title }}</h6>
            </div>

            <draggable v-if="column.id != 'DONE'" class="dragArea list-group cursor-move" :list="column.tasks"
                :animation="200" ghost-class="ghost-card" group="tasks" @add="updateTask"
                :component-data="getComponentData()">
                <transition-group>
                    <div v-for="task in column.tasks" :key="task.id" class="mt-6 cursor-move">
                        <TodoTaskItemCard :task="task" @deleteTask="deleteTask" @executeTask="executeTask"
                            @add="addTask" />
                    </div>
                </transition-group>
            </draggable>
            <div v-else>
                <div v-for="task in column.tasks" :key="task.id" class="mt-6">
                    <TodoTaskItemCard :task="task" @deleteTask="deleteTask" @executeTask="executeTask" />
                </div>
            </div>
        </div>
    </v-card>
</template>

<script>
import TodoTaskItemCard from './TodoTaskItemCard.vue';

import StorageBaseFactory from '@/utils/StorageBaseFactory';
import BackendFactory from "@/components/api/BackendFactory";

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
        addTask(task) {
            console.log(task)
        },
        async updateTask(event) {
            const movedTask = this.column.tasks.find(task => task.id === event.item.dataset.id);
            movedTask.status = this.column.id;
            console.log(movedTask)
            const back = BackendFactory.createBackend();
            await back.putWorklist(movedTask.taskId, movedTask);
        },
        /*
         * 할 일 목록 카드의 메뉴에서 삭제 버튼을 눌렀을 경우, 매칭되는 할 일을 삭제시키기 위해서
         * @param {*} task 삭제하려는 task 정보
         * TODO:: UEngineBackend.ts 에서 workitem 삭제 사용시 Backend.ts 로 삭제 함수 공통화
         */
        async deleteTask(task) {
            const storage = StorageBaseFactory.getStorage();
            this.column.tasks = this.column.tasks.filter((item) => item.taskId !== task.taskId);
            await storage.delete(`todolist/${task.id}`, { key: 'id' });
        },
        executeTask(task) {
            this.$emit('executeTask', task)
        },
        handleChange() {
            console.log('changed');
        },
        inputChanged(value) {
            console.log(value);
        },
        getComponentData() {
            return {
                onChange: this.handleChange,
                onInput: this.inputChanged,
                wrap: true,
                value: this.activeNames
            };
        }
    }
}
</script>
