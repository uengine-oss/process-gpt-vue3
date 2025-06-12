<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <div v-if="!todoTaskColumnBtnStatus"  class="d-flex align-center justify-space-between pa-3 pb-2 pt-2">
            <h6 class="text-h6 font-weight-semibold">{{ $t(column.title) }}</h6>
            <Icons 
                @click="todoTaskColumnFold(column.id)"
                :icon="'fold'"
                class="todo-task-fold-btn"
            />
        </div>
        <div v-else class="align-center justify-space-between pa-1">
            <Icons
                @click="todoTaskColumnUnfold(column.id)"
                :icon="'unfold'"
                class="todo-task-unfold-btn"
            />
            <h6 class="text-h6 font-weight-semibold"
                style="text-align: center;"
            >{{ $t(column.title) }}</h6>
        </div>
        
           
        <div v-if="!todoTaskColumnBtnStatus" ref="section" class="pa-3 todo-list-card-box" :style="{ height: isNotAll ? 'calc(100vh - 315px)' : 'calc(100vh - 240px)' }"
            style="overflow:auto;">
            <draggable class="dragArea list-group cursor-move" :list="column.tasks"
                :animation="200" ghost-class="ghost-card" group="tasks" @add="updateTask"
                :move="checkDraggable">
                    <transition-group>
                        <div v-for="task in column.tasks" :key="task.id" class="cursor-move todo-task-item-card-style">
                            <KanbanColumnCard :task="task" @deleteTask="deleteTask" :userInfo="users" />
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
import KanbanColumnCard from "./KanbanColumnCard.vue";
import WorkItemDialog from "./WorkItemDialog.vue";

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();
export default {
    components: {
        KanbanColumnCard,
        WorkItemDialog
    },
    props: {
        column: Object,
        loading: Boolean,
        isNotAll: {
            type: Boolean, 
            default: false
        },
        users: {
            type: Array,
            default: () => []
        }
    },
    data: () => ({
        todoTaskColumnBtnStatus: false,
        dialog: false,
        originColumnId: null,
    }),
    async mounted() {
        if(this.$refs.section) this.$refs.section.addEventListener('scroll', this.checkScrollBottom);
    },
    methods: {
        todoTaskColumnFold(id) {
            this.todoTaskColumnBtnStatus = true
            this.$emit('todoTaskColumnFold', id);
        },
        todoTaskColumnUnfold(id) {
            this.todoTaskColumnBtnStatus = false
            this.$emit('todoTaskColumnunfold', id);
        },
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
            me.updateWorkItem(movedTask);
        },
        updateWorkItem(task) {
            var me = this;
            me.$try({
                action: async () => {
                    await backend.putWorklist(task.taskId, task);
                },
                onFail: (e) => {
                    me.$emit('updateStatus', task.taskId, me.originColumnId);
                },
                successMsg: task.status == 'DONE' ? this.$t('successMsg.workCompleted') : null
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
            await backend.deleteWorkItem(task.taskId);
            this.column.tasks = this.column.tasks.filter((item) => item.taskId !== task.taskId);
        },
    }
}
</script>
<style>
    .todo-task-item-card-style:not(:first-of-type) {
        margin-top:8px;
    }
    .todo-list-card-box > div {
        width:100%;
        height:100%;
    }
    .todo-task-fold-btn {
        cursor: pointer;
        display: none;
    }
    @media (max-width: 959px) {
        .todo-task-unfold-btn,
        .todo-task-fold-btn {
            display: block;
        }
    }

</style>