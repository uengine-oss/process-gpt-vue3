<template>
    <v-card elevation="10" :class="'bg-' + column.cardbg">
        <v-row class="ma-0 pa-0 pa-3 pb-2 pt-2 align-center">
            <h6 class="text-h6 font-weight-semibold">{{ $t(column.title) }}</h6>
            <v-spacer></v-spacer>
            <Icons v-if="!todoTaskColumnBtnStatus"
                @click="todoTaskColumnFold(column.id)"
                :icon="'fold'"
                class="todo-task-fold-btn"
            />
            <Icons v-else
                @click="todoTaskColumnUnfold(column.id)"
                :icon="'unfold'"
                class="todo-task-unfold-btn"
            />
        </v-row>
        
           
        <div v-if="!todoTaskColumnBtnStatus" ref="section"
            class="pa-3 todo-list-card-box"
        >
            <!-- 기존 draggable 코드 (드래그 기능 테스트를 위해 주석처리)
            <draggable class="dragArea list-group cursor-move" :list="column.tasks"
                :animation="200" ghost-class="ghost-card" group="tasks" @add="updateTask"
                :move="checkDraggable">
                    <transition-group>
                        <div v-for="task in column.tasks" :key="task.id" class="cursor-move todo-task-item-card-style">
                            <KanbanColumnCard :task="task" @deleteTask="deleteTask" :userInfo="users" />
                        </div>
                    </transition-group>
            </draggable>
            -->
            
            <!-- 드래그 기능 제거된 단순 구조 -->
            <div class="list-group">
                <transition-group>
                    <div v-for="task in sortedTasks" :key="task.taskId" class="todo-task-item-card-style">
                        <KanbanColumnCard :task="task" @deleteTask="deleteTask" :userList="users" />
                    </div>
                </transition-group>
                
                <!-- 마지막 페이지 표시 (스크롤을 통해 추가 로딩이 발생한 경우에만) -->
                <div v-if="!hasMore && currentPage > 0 && column.tasks.length > 0">
                    <div class="d-flex align-center justify-center pa-2" style="color: #999; font-size: 12px;">
                        <v-icon size="small" color="grey-lighten-1" class="mr-1">mdi-checkbox-marked-circle-outline</v-icon>
                        <span>{{ $t('todoList.endOfList') }}</span>
                    </div>
                </div>
            </div>
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
        hasMore: {
            type: Boolean,
            default: true
        },
        currentPage: {
            type: Number,
            default: 0
        },
        isNotAll: {
            type: Boolean, 
            default: false
        },
        users: {
            type: Array,
            default: () => []
        },
        sortOption: {
            type: String,
            default: 'startDate'
        }
    },
    data: () => ({
        todoTaskColumnBtnStatus: false,
        dialog: false,
        originColumnId: null,
    }),
    computed: {
        sortedTasks() {
            if (!this.column.tasks || this.column.tasks.length === 0) {
                return [];
            }
            
            const sortedTasks = [...this.column.tasks];
            
            if (this.sortOption === 'dueDate') {
                // 마감일이 가까운 순 (오름차순)
                sortedTasks.sort((a, b) => {
                    const dateA = a.dueDate || a.endDate;
                    const dateB = b.dueDate || b.endDate;
                    
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return 1;  // dateA가 없으면 뒤로
                    if (!dateB) return -1; // dateB가 없으면 뒤로
                    
                    return new Date(dateA) - new Date(dateB);
                });
            } else {
                // 시작일이 최근인 순 (내림차순)
                sortedTasks.sort((a, b) => {
                    const dateA = a.startDate || a.createdDate || a.startedDate;
                    const dateB = b.startDate || b.createdDate || b.startedDate;
                    
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return 1;  // dateA가 없으면 뒤로
                    if (!dateB) return -1; // dateB가 없으면 뒤로
                    
                    return new Date(dateB) - new Date(dateA);
                });
            }
            
            return sortedTasks;
        }
    },
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
            
            if (isAtBottom && !this.loading && this.hasMore) {
                this.$emit('scrollBottom', this.column.id);
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