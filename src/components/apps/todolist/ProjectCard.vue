<template>
    <div class="center-container">
        <v-card elevation="10" class="list-card">
            <v-tabs v-model="tab" color="primary">
                <v-tab value="managment">프로젝트 관리</v-tab>
                <v-tab value="workflow">업무 목록</v-tab>
                <v-tab value="instance">인스턴스 목록</v-tab>
            </v-tabs>
            <v-window v-model="tab">
                <v-window-item value="managment">
                    <div class="gantt-area" v-if="!isLoading">
                        <GanttChart 
                            :tasks="tasks" 
                            :dependencies="dependencies"
                            :users="[]" 
                            @task-updated="handleTaskUpdated" 
                            @task-added="handleTaskAdded"
                            @task-clicked="handleTaskClicked"
                            @grid-row-clicked="handleGridRowClicked"
                            @link-event="handleLinkEvent"
                        />
                    </div>
                </v-window-item>
                <v-window-item value="workflow">
                    <div style="height: 860px;">
                        <KanbanBoard 
                            :columns="columns"  
                        />
                    </div>
                </v-window-item>
                <v-window-item value="instance">
                    <!-- 프로젝트 정보 -->
                    <div style="padding: 24px; text-align: left; color: #888;">
                        <div v-if="project">
                            <div style="font-size:18px; font-weight:bold; margin-bottom: 12px;">프로젝트 정보</div>
                            <div style="font-size: 16px; margin-bottom: 4px;">프로젝트ID: {{ project.projectId }}</div>
                            <div style="font-size: 16px; margin-bottom: 4px;">프로젝트명: {{ project.name }}</div>
                            <div style="font-size: 16px; margin-bottom: 4px;">예상 기간: {{ project.startDate }} ~ {{ project.endDate }}</div>
                            <div style="font-size: 16px; margin-bottom: 4px;">상태: {{ project.status }}</div>
                            <div style="font-size: 16px;">프로젝트 생성일: {{ project.createdDate }}</div>
                        </div>
                        <div v-else>
                            프로젝트 정보가 없습니다.
                        </div>
                    </div>
                    <!-- 인스턴스 리스트 -->
                    <v-list>
                        <template v-for="(item, idx) in instanceList" :key="item.name">
                            <v-list-item @click="onItemClick(item)">
                            <v-list-item-content>
                                <v-list-item-title class="font-weight-bold">{{ item.name }}</v-list-item-title>
                                <v-list-item-subtitle>
                                {{ item.instId }} | {{ item.status }} | {{ item.startDate }} ~ {{ item.endDate }}
                                </v-list-item-subtitle>
                            </v-list-item-content>
                            </v-list-item>
                            <v-divider v-if="idx < instanceList.length - 1" />
                        </template>
                    </v-list>
                </v-window-item>
            </v-window>
        </v-card>
    </div>
  </template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
import Gantt from '@/components/Gantt.vue';
import KanbanBoard from './KanbanBoard.vue';
import TodoTaskColumn from './TodoTaskColumn.vue';
import GanttChart from './GanttChart.vue';


export default {
    components: {
        Gantt,
        KanbanBoard,
        TodoTaskColumn,
        GanttChart
    },
    data: () => ({  
        
        tab: 'managment', // 탭 인덱스
        project: null,
        instanceList: [],
        columns: [
            {
                id: 'TODO',
                title: 'todoList.todo',
                cardbg: 'background',
                tasks: []
            },
            {
                id: 'IN_PROGRESS',
                title: 'todoList.inProgress',
                cardbg: 'lightsecondary',
                tasks: []
            },
            {
                id: 'PENDING',
                title: 'todoList.pending',
                cardbg: 'lightinfo',
                tasks: []
            },
            {
                id: 'DONE',
                title: 'todoList.done',
                cardbg: 'lightsuccess',
                tasks: []
            }
        ],
        isLoading: true,
        tasks: [],
        dependencies: [],
    }),
    mounted() {
        this.init();
    },
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.projectId && newVal.params.projectId !== oldVal.params.projectId) {
                    await this.init();
                }
            }
        },
    },
    computed: {
        projectId() {
            return this.$route.params.projectId
        }
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.projectId) return;
                    me.isLoading = true;

                    me.project = await backend.getProjectById(this.projectId);
                    me.instanceList = await backend.getInstanceByProjectId(this.projectId);
                    let allWorkItems = me.instanceList.map(item => ({
                        ...item,
                        parent: 0, // 인스턴스
                    }));

                    const worklists = await backend.getWorkList({projectId: this.projectId});
                    const updatedWorklist = worklists.map(item => ({
                        ...item,
                        parent: item.instId, // 인스턴스가 부모
                    }));

                    allWorkItems = allWorkItems.concat(updatedWorklist);
                    me.tasks = allWorkItems;
                    me.dependencies = await backend.getTaskDependencyByProjectId(this.projectId)
                    me.loadKanbanBoard();
                    me.isLoading = false;
                }
            });
        },
        loadKanbanBoard(){
            var me = this
            me.columns.forEach(column => {
                column.tasks = me.tasks.filter(task => task.status === column.id);
            });
        },
        async handleTaskUpdated(task){
            if(task.parent == 0){
                await backend.putInstance(task.taskId, task)
            } else {
                await backend.putWorklist(task.taskId, task)
            }
        },
        async handleTaskAdded(task){
            if(!task.projectId) task.projectId = this.project.projectId;
            if(task.parent == 0){
                await backend.putInstance(null, task);
            } else {
                await backend.putWorklist(null, task);
            }
        },
        async handleTaskClicked(task){
            console.log(task);
        },
        async handleGridRowClicked(id){
            router.push(`/todolist/${id}`);
        },
        async handleLinkEvent(event){
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
        },
        onItemClick(item) {
               this.$router.push(`/instance/${item.instId}`);
        },
    }
};
</script>

<style>
.center-container {
    display: flex;
    justify-content: center;
    align-items: flex-start; /* 상단 정렬로 변경 */
    min-height: 100vh;       /* 화면 전체 높이 */
    background: #f2f6fa;
}
.vertical-layout {
  display: flex;
  flex-direction: column;
  width: 600px;
  height: 80vh;
  min-width: 400px;
}
.top-section {
  flex: 3;
  margin-bottom: 16px;
}
.bottom-section {
  flex: 7;
}
.list-card {
  width: 100%;
  height: 100%;
}
.gantt-area {
  flex: 1;
  min-height: 400px;      /* Gantt 차트 영역 최소 높이 */
  height: 500px;          /* 필요시 고정 높이 */
}
</style>