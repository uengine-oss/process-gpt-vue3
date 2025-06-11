<template>
    <v-card elevation="10" v-if="instance" style="height: calc(100vh - 131px); ">
        <div class="d-flex">
            <div class="px-3 py-3 pb-2 pl-4 align-center">
                <div class="d-flex">
                    <h5 class="text-h5 font-weight-semibold">
                        {{ instance.name }}
                    </h5>

                    <v-chip v-if="instance.status" size="x-small" variant="outlined"
                        style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center">
                        {{ instance.status }}
                    </v-chip>
                </div>
                <div v-if="instance.instId" class="font-weight-medium" style="color:gray; font-size:14px;">
                    ID: {{ instance.instId }}
                </div>
            </div>
        </div>

        <div style="height: 100%;">
            <v-tabs v-model="tab" color="primary">
                <v-tab
                    v-for="item in filteredTabItems"
                    :key="item.value"
                    :value="item.value"
                >
                {{ item.label }}
            </v-tab>
            </v-tabs>
            <v-window v-model="tab">
                <v-window-item value="managment">
                    <div class="gantt-area" v-if="!isLoading">
                        <Gantt 
                            :tasks="tasks" 
                            :dependencies="dependencies"
                            :users="[]" 
                            @task-updated="handleTaskUpdated" 
                            @task-added="handleTaskAdded"
                            @task-clicked="handleTaskClicked"
                            @grid-row-clicked="handleGridRowClicked"
                            @task-tree-opened="handleTaskTreeOpened"
                            @link-event="handleLinkEvent"
                        />
                    </div>
                </v-window-item>
                <v-window-item value="progress">
                    <div style="height: 860px;">
                        <KanbanProgress 
                            :instance="instance"  
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
                <v-window-item value="workhistory">
                  
                </v-window-item>
            </v-window>
        </div>
    </v-card>
    <v-card v-else>
        <!-- 존재 하지 않은 인스턴스 -->
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

// import InstanceProgress from './InstanceProgress.vue';
// import InstanceTodo from './InstanceTodo.vue';
// import InstanceWorkHistory from './InstanceWorkHistory.vue';
// import InstanceGantt from './InstanceGantt.vue';

//
import KanbanBoard from './KanbanBoard.vue';
import KanbanProgress from './KanbanProgress.vue';
import Gantt from '@/components/Gantt.vue';

export default {
    components: {
        // InstanceProgress,
        // InstanceTodo,
        // InstanceWorkHistory,
        // InstanceGantt,
        KanbanBoard,
        KanbanProgress,
        Gantt
    },
    data: () => ({
        instance: null,
        eventList: [],
       
        // tabItems: [
        //     { value: 'gantt', label: 'InstanceCard.ganttChart', component: 'InstanceGantt' },
        //     { value: 'progress', label: 'InstanceCard.progress', component: 'InstanceProgress' },
        //     { value: 'todo', label: 'InstanceCard.workItem', component: 'InstanceTodo' },
        //     { value: 'workhistory', label: 'InstanceCard.workHistory', component: 'InstanceWorkHistory' },  
        // ],
        tabItems: [
            { value: 'managment', label: '인스턴스 관리' },
            { value: 'progress', label: '진행 상황' },
            { value: 'workflow', label: '내 업무 목록' },
            { value: 'workhistory', label: '워크히스토리' }
        ],
        tab: "managment",
        ///
        isLoading: true,
        tasks: [],
        dependencies: [],
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
    }),
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.tab = "progress";
                    await this.init();
                }
            }
        },
        async tab(newVal, oldVal) {
            if (newVal !== oldVal) {
                const activeComponents = this.$refs[newVal];
                if (activeComponents && activeComponents.length > 0 && activeComponents[0].init) {
                    await activeComponents[0].init();
                }
            }
        },
    },
    mounted() {
        this.init();
    },
    computed: {
        id() {
           return this.$route.params.instId
        },
        filteredTabItems() {
            if (this.instance && !this.instance.defId) {
                this.tab = 'managment';
                return this.tabItems.filter(item => item.value !== 'progress');
            }
            return this.tabItems;
        }
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    me.isLoading = true;
                    me.instance = await backend.getInstance(me.id);

                    let result = [];
                    const tasks = await backend.getWorkList({instId: me.id});
                    result = result.concat(tasks);
                    // 바로 아래 자식 태스크 추가
                    for (const task of tasks) {
                        let childTaks = await backend.getWorkList({instId: task.taskId});
                        const updatedWorklist = childTaks.map(item => ({
                            ...item,
                            parent: task.taskId, // 인스턴스가 부모
                        }));
                        result = result.concat(updatedWorklist);
                    }
                    me.tasks = result;
                    me.dependencies = await backend.getTaskDependencyByInstId(me.id)
                    // 칸반 컬럼 업데이트
                    me.columns.forEach(column => {
                        column.tasks = me.tasks.filter(task => task.status === column.id);
                    });
                    me.isLoading = false
                }
            });
        },
        async handleTaskUpdated(task){
            await backend.putWorklist(task.taskId, task)
        },
        async handleTaskAdded(task){
            task.projectId = this.instance.projectId;
            task.parent = this.instance.instId;

            await backend.putWorklist(null, task);
        },
        async handleTaskClicked(event){
            console.log(event);
        },
        async handleGridRowClicked(event){
            console.log(event);
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
        async handleTaskTreeOpened(event){
            var me = this
            const rootTaskId = event.id;
            let rootTask = this.tasks.find(x=>x.taskId == rootTaskId);
            if(rootTask.isOpened) return;


            let result = [];
            const tasks = await backend.getWorkList({instId: rootTaskId});
            result = result.concat(tasks);
            // 바로 아래 자식 태스크 추가
            for (let task of tasks) {
                task.parent = rootTaskId;
                let childTaks = await backend.getWorkList({instId: task.taskId});
                const updatedWorklist = childTaks.map(item => ({
                    ...item,
                    parent: task.taskId,
                }));
                result = result.concat(updatedWorklist);
            }
            me.tasks = me.tasks.concat(result);


            const rootTaskDependencies = await backend.getTaskDependencyByInstId(rootTaskId);
            me.dependencies = me.dependencies.concat(rootTaskDependencies);

            rootTask.isOpened = true;
        },
        // taskDependency(){

        // }
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