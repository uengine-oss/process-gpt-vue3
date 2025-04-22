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

        <Gantt :tasks="workItems" :users="users" @task-updated="handleTaskUpdate" @task-added="handleTaskAdded"/>
    </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
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
        const uuid = () => {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        }

        const handleTaskAdded = async (newTask) => {
            let taskId = uuid();
            try {
                
                await backend.putWorklist(taskId, {
                    title: newTask.text,
                    startDate: newTask.startDate,
                    dueDate: newTask.endDate,
                    status: 'TODO',
                    instId: props.instance.instanceId,
                    assignees: newTask.assignees,
                    progress: newTask.progress || 0,
                    parent: newTask.parent || null,
                    duration: newTask.duration || 5,
                    adhoc: newTask.adhoc || false
                });

                const ganttTask = {
                    id: taskId,
                    text: newTask.text,
                    start_date: formatGanttDate(newTask.startDate),
                    end_date: formatGanttDate(newTask.endDate),
                    duration: newTask.duration,
                    progress: newTask.progress || 0,
                    parent: newTask.parent || null,
                    adhoc: newTask.adhoc || false,
                };
                // workItems 배열에 추가
                workItems.value.push(ganttTask);

                // Gantt 차트에 작업 추가
                gantt.addTask(ganttTask);

                // 작업이 추가된 후 Gantt 차트 다시 그리기
                gantt.render();
            } catch (error) {
                console.error('Failed to add task:', error);
                // 에러 발생 시 Gantt에서 작업 제거
                gantt.deleteTask(taskId);
                await init();
            }
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
            handleTaskAdded
            
            
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

