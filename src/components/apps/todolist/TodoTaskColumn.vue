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
        <!-- workItem dialog -->
        <v-dialog v-model="dialog" max-width="500">
            <WorkItemDialog :taskId="taskId" :workItem="workItem" @closeDialog="closeDialog" />
        </v-dialog>
    </v-card>
</template>

<script>
import TodoTaskItemCard from './TodoTaskItemCard.vue';
import WorkItemDialog from './WorkItemDialog.vue';

import BackendFactory from "@/components/api/BackendFactory";

export default {
    components: {
        TodoTaskItemCard,
        WorkItemDialog,
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
        dialog: false,
        taskId: null,
        workItem: null,
        originColumnId: null,
    }),
    async mounted() {
        this.workItem = await back.getWorkItem(this.taskId);
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
                    const back = BackendFactory.createBackend();
                    const result = await back.putWorklist(movedTask.taskId, movedTask);
                    
                    // Process-GPT
                    if (result && result.cannotProceedErrors && result.cannotProceedErrors.length > 0) {
                        me.taskId = movedTask.taskId;
                        me.workItem = await back.getWorkItem(me.taskId);
                        me.dialog = true;
                    } else if (result && result.completedActivities && result.completedActivities.length > 0) {
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
        closeDialog(isUpdated) {
            this.dialog = false;
            if(!isUpdated) {
                this.$emit('updateStatus', this.taskId, this.originColumnId);
            } else {
                this.EventBus.emit('instances-updated');
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