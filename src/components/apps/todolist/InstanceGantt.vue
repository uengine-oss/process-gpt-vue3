<template>
    <div class="overflow-y-auto" style="height: 100%;" v-if="!isLoading">
        <Gantt 
            :tasks="workItems" 
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
    },
    setup(props) {
        const workItems = ref([]);
        const dependencies = ref([]);
        const users = ref([]);
        const backend = BackendFactory.createBackend();
        const isLoading = ref(true);
        const router = useRouter();
        const dialogVisible = ref(false);
        const selectedTask = ref(null);
        
        const init = async () => {
                isLoading.value = true;

                // users.value = await backend.getUserList();

                if (props.instance && props.instance.instance_id) {
                    workItems.value = [];
                    let items = await backend.getAllWorkListByInstId(props.instance.instance_id)
                    if (items && items.length > 0) {
                        // 시작시간 기준 정렬
                        items.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                        workItems.value = items.map(item => {
                            return {
                                id: item.taskId,
                                text: item.name,
                                start_date: item.startDate,
                                end_date: item.endDate,
                                due_date: item.dueDate,
                                instance_id: item.task.instance_id,
                                project_id: item.task.project_id,
                                status: item.status,
                                parent: item.parent || null,

                                progress: item.progress || 0,
                                endpoint: item.endpoint,
                                assignees: item.assignees,
                                adhoc: item.adhoc,
                                activity_id: item.tracingTag,
                                task: JSON.parse(JSON.stringify(item))
                            };
                        });

                    }

                    dependencies.value = [];
                    dependencies.value = await backend.getTaskDependencyByInstId(props.instance.instance_id)

                }
                isLoading.value = false; // 초기화 완료 시 로딩 상태 false
            
        };

        // 작업 업데이트
        const handleTaskUpdated = async (updatedTask) => {
            try {
                // 백엔드에 업데이트된 작업 정보 전송
                await backend.putWorklist(updatedTask.id, {
                    // task_id: updatedTask.id,
                    instd: updatedTask.instance_id,
                    projectId: updatedTask.project_id,
                    name: updatedTask.text,
                    startDate: updatedTask.start_date,
                    endDate: updatedTask.end_date,
                    dueDate: updatedTask.due_date,
                    status: updatedTask.status,
                })

                // 성공적으로 업데이트되면 로컬 상태도 업데이트
                // const index = workItems.value.findIndex(item => item.id === updatedTask.id)
                // if (index !== -1) {
                //     workItems.value[index] = {
                //         ...workItems.value[index],
                //         startDate: updatedTask.startDate,
                //         dueDate: updatedTask.endDate,
                //         // 다른 필드들 업데이트
                //     }
                // }
            } catch (error) {
                console.error('Failed to update task:', error)
                // 에러 처리 (필요한 경우 원래 상태로 되돌리기)
                await init() // 또는 다른 에러 처리 방법
            }
        }

        const handleLinkEvent = async (event) => {
            let link = event.link;
            if(event.type == 'add') {
                await backend.putTaskDependency({
                    id: link.id,
                    task_id: link.target,
                    depends_id: link.source,
                    type: link.type
                })
            } else if(event.type == 'delete') {
                await backend.deleteTaskDependency(link.id)
            }
        }

        const handleGridRowClicked = ({ id }) => {
            router.push(`/todolist/${id}`);
        };

        const handleTaskClicked = ({ id }) => {
            const task = workItems.value.find(item => item.id == id);
            if (task) {
                selectedTask.value = { ...task };
                dialogVisible.value = true;
            }
        };
        // 작업 추가
        const handleTaskAdded = async (newTask) => {
            try {
                await backend.putWorklist(null, {
                    name: newTask.text,
                    startDate: newTask.startDate,
                    dueDate: newTask.dueDate,
                    endDate: newTask.endDate,
                    status: newTask.status || 'TODO',
                    instId: props.instance.instanceId,
                    endpoint: newTask.endpoint,
                    assignees: newTask.assignees,
                    progress: newTask.progress || 0,
                    parent: newTask.parent || null,
                    duration: parseInt(newTask.duration),
                    adhoc: newTask.adhoc || false
                });

                
                // // workItems 배열에만 추가 (Gantt는 이미 추가되어 있음)
                // const ganttTask = {
                //     id: newTask.id,
                //     text: newTask.text,
                //     startDate: newTask.startDate,
                //     dueDate: newTask.endDate,
                //     // duration: parseInt(newTask.duration),
                //     activity_id: "",
                //     reference_ids: [],
                //     progress: newTask.progress || 0,
                //     parent: newTask.parent || null,
                //     adhoc: newTask.adhoc || false,
                //     status: newTask.status || 'TODO'
                // };
                // workItems.value.push(ganttTask);

            } catch (error) {
                console.error('Failed to add task:', error);
                // 에러 발생 시 Gantt에서 작업 제거
                if (gantt.isTaskExists(newTask.id)) {
                    gantt.deleteTask(newTask.id);
                }
                await init();
            }
        };

        const saveTaskEdit = async () => {
            if (!selectedTask.value) return;
            // 백엔드에 저장
            await handleTaskUpdated(selectedTask.value);
            // 로컬 데이터 갱신
            const idx = workItems.value.findIndex(item => item.id == selectedTask.value.id);
            if (idx !== -1) {
                workItems.value[idx] = { ...selectedTask.value };
            }
            dialogVisible.value = false;
        };

        onMounted(init);
    
        watch(() => props.instance.instanceId, async (newVal, oldVal) => {
            if (newVal !== oldVal) {
                await init();
            }
        }, { deep: true });
    
        return {
            // chartStartDate,
            // chartEndDate,
            // onDragEnd,
            workItems,
            dependencies,
            users,
            isLoading,
            handleTaskUpdated,
            handleTaskAdded,
            handleTaskClicked,
            handleGridRowClicked,
            handleLinkEvent,
            dialogVisible,
            selectedTask,
            saveTaskEdit
        };
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

