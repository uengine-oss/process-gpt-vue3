<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <div class="d-flex align-center justify-space-between pa-3 pb-2 pt-2">
            <h6 class="text-h6 font-weight-semibold">{{ $t(column.title) }}</h6>
        </div>
        <div ref="section" class="pa-3" :style="{ height: isNotAll ? 'calc(100vh - 320px)' : 'calc(100vh - 300px)' }"
            style="overflow:auto;">
            <draggable class="dragArea list-group cursor-move" :list="column.tasks"
                :animation="200" ghost-class="ghost-card" group="tasks" @add="updateTask"
                :component-data="getComponentData()" :move="checkDraggable">
                    <transition-group>
                        <div v-for="task in column.tasks" :key="task.taskId" class="cursor-move todo-task-item-card-style">
                            <TodoTaskItemCard :task="task" @deleteTask="deleteTask" @executeTask="executeTask" />
                        </div>
                    </transition-group>
            </draggable>
        </div>
        <v-dialog v-model="dialog" max-width="500">
            <v-card flat class="pa-2">
                <v-card-title>
                    <h6 class="text-h6 font-weight-semibold">Data</h6>
                </v-card-title>
                <v-card-text>
                    <DefaultForm :inputItems="inputItems" />
                </v-card-text>
                <v-card-actions class="justify-center">
                    <v-btn color="primary" variant="flat" @click="$try({action: async () => { await back.putWorkItemComplete(taskId, inputItems); dialog = false; }})">submit</v-btn>
                    <v-btn color="error" variant="flat" @click="closeDialog(false)">cancel</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import TodoTaskItemCard from './TodoTaskItemCard.vue';
import DefaultForm from '@/components/designer/DefaultForm.vue';

import BackendFactory from "@/components/api/BackendFactory";
const back = BackendFactory.createBackend();

export default {
    components: {
        TodoTaskItemCard,
        DefaultForm
    },
    props: {
        column: Object,
        loading: Boolean,
        isNotAll: {
            type: Boolean, 
            default: false
        },
    },
    data: () => ({
        back: null,
        dialog: false,
        taskId: null,
        originColumnId: null,
        inputItems: null,
    }),
    mounted(){
        this.back = BackendFactory.createBackend();
        if(this.$refs.section) this.$refs.section.addEventListener('scroll', this.checkScrollBottom);
    },
    methods: {
        checkScrollBottom(){
            const section = this.$refs.section;
            const isAtBottom = section.scrollTop + section.clientHeight >= section.scrollHeight - 1;
            if (isAtBottom && this.column.id == 'DONE') {
                // console.log("!! RUN")
                if(!this.loading) this.$emit('scrollBottom')
            }
        },
        checkDraggable(event) {
            // const task = event.draggedContext.element;
            // if (!task.instId) {
            //     return true;
            // } else {
            //     if (this.column.id != 'DONE') {
            //         return true;
            //     }
            // }
            return true;
        },
        updateTask(event) {
            var me = this;
            const movedTaskId = event.item.dataset.id;
            const movedTask = me.column.tasks.find(task => task.id === movedTaskId);
            me.originColumnId = movedTask.status;
            movedTask.status = me.column.id;

            me.$try({
                action: async () => {
                    const result = await me.back.putWorklist(movedTask.taskId, movedTask);
                    if (result.cannotProceedErrors && result.cannotProceedErrors.length > 0) {
                        me.taskId = movedTask.taskId;
                        me.openDialog(movedTask.taskId)
                    } else {
                        const status = result.completedActivities.find(
                            item => item.completedActivityId == movedTask.tracingTag
                        ).result;
                        this.$emit('updateStatus', this.taskId, status);
                    }
                },
                onFail: (e) => {
                    me.$emit('updateStatus', movedTask.taskId, me.originColumnId);
                }
            });
        },
        async openDialog(taskId) {
            var me = this;
            me.$try({
                action: async () => {
                    const workItem = await me.back.getWorkItem(taskId);
                    if (workItem.activity && workItem.activity.parameters && workItem.activity.parameters.length > 0) {
                        me.inputItems = workItem.activity.parameters
                            .filter((item) => item.direction.includes('OUT'))
                            .map((item) => ({ name: item.variable.name, value: item.variable.value }));
                        me.dialog = true;
                    }
                }
            })
        },
        closeDialog(isUpdated) {
            this.dialog = false;
            if(!isUpdated) {
                this.$emit('updateStatus', this.taskId, this.originColumnId);
            }
            this.taskId = null;
            this.originColumnId = null;
        },
        /*
         * 할 일 목록 카드의 메뉴에서 삭제 버튼을 눌렀을 경우, 매칭되는 할 일을 삭제시키기 위해서
         * @param {*} task 삭제하려는 task 정보
         * TODO:: UEngineBackend.ts 에서 workitem 삭제 사용시 Backend.ts 로 삭제 함수 공통화
         */
        async deleteTask(task) {
            await this.back.deleteWorkItem(task.taskId);
            this.column.tasks = this.column.tasks.filter((item) => item.taskId !== task.taskId);
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
                // onChange: this.handleChange,
                // onInput: this.inputChanged,
                // wrap: true,
                // value: this.activeNames
            };
        }
    }
}
</script>
<style>
    .todo-task-item-card-style:not(:first-of-type) {
        margin-top:16px;
    }
</style>