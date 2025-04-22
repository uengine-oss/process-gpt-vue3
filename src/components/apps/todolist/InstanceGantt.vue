<template>
    <div class="overflow-y-auto" style="height: 100%;" v-if="!isLoading">
        <!-- <g-gantt-chart 
            :chart-start="chartStartDate" 
            :chart-end="chartEndDate" 
            precision="day" 
            bar-start="startDate" 
            bar-end="endDate" 
            push-on-overlap 
            color-scheme="sky"
            :display-dates="true"
            :date-format-options="{
                weekday: 'short',    // 요일 표시
                month: 'numeric',    // 월 표시 방식
                day: 'numeric'       // 일 표시 방식
            }"
            :row-height="40"
            @dragend-bar="onDragEnd">
            <g-gantt-row v-for="(item, index) in workItems" :key="index" :bars="[item]" />
        </g-gantt-chart> -->

        <Gantt 
        :tasks="workItems" 
        :users="users" 
        @task-updated="handleTaskUpdate" 
        @task-added="handleTaskAdded"
        @task-clicked="handleTaskClicked"/>
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
        const users = ref([]);
        const backend = BackendFactory.createBackend();
        const isLoading = ref(true);
        const router = useRouter();
        function formatGanttDate(date) {
            if(!date) return null;
            const d = new Date(date)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = d.getFullYear()
            
            return `${day}-${month}-${year}`
        }
        const init = async () => {
                isLoading.value = true;

                users.value = await backend.getUserList();

                if (props.instance && props.instance.instanceId) {
                    workItems.value = [];
                    let items = await backend.getAllWorkListByInstId(props.instance.instanceId)
                    if (items && items.length > 0) {
                        // 시작시간 기준 정렬
                        items.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
                        workItems.value = items.map(item => {
                            return {
                                id: item.taskId,
                                startDate: item.startDate,
                                endDate: item.endDate,
                                dueDate: item.dueDate,
                                status: item.status,
                                text: item.title,
                                endpoint: item.endpoint,
                                assignees: item.assignees,
                                parent: item.parent,
                                adhoc: item.adhoc,
                                activity_id: item.tracingTag,
                                reference_ids: item.reference_ids,
                            };
                        });

                    }
                }
                isLoading.value = false; // 초기화 완료 시 로딩 상태 false
            
        };

        // 작업 업데이트
        const handleTaskUpdate = async (updatedTask) => {
            try {
                // 백엔드에 업데이트된 작업 정보 전송
                await backend.putWorklist(updatedTask.id, {
                    id: updatedTask.id,
                    startDate: updatedTask.startDate,
                    dueDate: updatedTask.dueDate,
                    duration: updatedTask.duration,
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
        const handleTaskClicked = ({ id }) => {
            router.push(`/todolist/${id}`);
        };
        
        const handleTaskAdded = async (newTask) => {
            try {
                // 이미 존재하는 작업인지 확인
                if (workItems.value.some(item => item.id === newTask.id)) {
                    return; // 이미 존재하는 작업이면 처리하지 않음
                }

                await backend.putWorklist(newTask.taskId, {
                    title: newTask.text,
                    startDate: newTask.startDate,
                    dueDate: newTask.endDate,
                    status: newTask.status || 'TODO',
                    instId: props.instance.instanceId,
                    assignees: newTask.assignees,
                    progress: newTask.progress || 0,
                    parent: newTask.parent || null,
                    duration: parseInt(newTask.duration),
                    adhoc: newTask.adhoc || false
                });

                // 작업 목록에 추가
                const ganttTask = {
                    id: newTask.id,
                    text: newTask.text,
                    start_date: formatGanttDate(newTask.startDate),
                    duration: parseInt(newTask.duration) || 5,
                    progress: newTask.progress || 0,
                    parent: newTask.parent || null,
                    adhoc: newTask.adhoc || false,
                    status: newTask.status || 'TODO'
                };

                // workItems 배열에 추가
                workItems.value.push(ganttTask);

                // Gantt 데이터 다시 로드
                loadGanttData();

            } catch (error) {
                console.error('Failed to add task:', error);
                // 에러 발생 시 Gantt에서 작업 제거
                if (gantt.isTaskExists(newTask.id)) {
                    gantt.deleteTask(newTask.id);
                }
                await init();
            }
        };

        const loadGanttData = () => {
            gantt.clearAll();

            const formattedTasks = workItems.value.map(task => ({
                id: task.id,
                text: task.text,
                start_date: formatGanttDate(task.startDate),
                duration: parseInt(task.duration) || 3,
                progress: task.progress || 0,
                parent: task.parent || null,
                status: task.status,
                assignees: task.assignees,
                activity_id: task.activity_id,
                reference_ids: task.reference_ids
            }));
            
            const formattedData = {
                data: formattedTasks,
                links: createLinksFromReferences(workItems.value)
            };

            gantt.parse(formattedData);
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
            users,
            isLoading,
            handleTaskUpdate,
            handleTaskAdded,
            handleTaskClicked
            
            
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

</style>

