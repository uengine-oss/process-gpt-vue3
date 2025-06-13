<template>
    <v-card v-if="instance" elevation="10" style="height: calc(100vh - 131px); overflow: auto;">
        <div class="d-flex">
            <div class="px-3 py-3 pb-2 pl-4 align-center">
                <div class="d-flex">
                    <h5 class="text-h5 font-weight-semibold">
                        {{ instanceName }}
                    </h5>

                    <v-chip v-if="instance.status" size="x-small" variant="outlined"
                        style="margin: 2px 0px 0px 5px !important; display: flex; align-items: center">
                        {{ instance.status }}
                    </v-chip>
                    <div v-for="event in eventList" :key="event.tracingTag">
                        <v-btn @click="fireMessage(event)"
                            color="primary"
                            rounded
                            style="font-size:12px;"
                            density="comfortable"
                            class="ml-3"
                        > {{  $t('InstanceCard.sendEvent', {event: event.name ? event.name : event.type}) }}
                        </v-btn>
                    </div>
                </div>
                <div v-if="instance.instId" class="font-weight-medium" style="color:gray; font-size:14px;">
                    ID: {{ instance.instId }}
                </div>
            </div>
            <v-btn v-if="deletable" @click="deleteInstance" variant="plain" icon class="ml-auto">
                <Icons :icon="'trash'" />
            </v-btn>
        </div>

        <div :key="updatedKey">
            <div v-if="isNew">
                <ProcessInstanceRunning :instance="instance" @updated="handleInstanceUpdated" />
            </div>
            <div v-else style="height: 100%;">
                <v-tabs v-model="tab" color="primary">
                    <v-tab
                        v-for="item in filteredTabItems"
                        :key="item.value"
                        :value="item.value"
                    >
                        {{ $t(item.label) }}
                    </v-tab>
                </v-tabs>
                <v-window v-model="tab">
                    <v-window-item value="gantt">
                        <div class="gantt-area" v-if="!isLoading">
                            <GanttChart 
                                :tasks="tasks" 
                                :dependencies="dependencies"
                                :users="userList" 
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
                            <InstanceProgress :instance="instance"/>
                        </div>
                    </v-window-item>
                    <v-window-item value="todo">
                        <v-card elevation="10">
                            <div class="pa-4 todolist-card-box">
                                <div class="d-flex align-center justify-end ml-2">
                                    <v-avatar v-if="mode === 'ProcessGPT'"
                                        size="24" elevation="10" class="bg-surface d-flex align-center cursor-pointer"
                                        @click="openDialog">
                                        <v-tooltip activator="parent" location="left">업무 등록</v-tooltip>
                                        <PlusIcon size="24" stroke-width="2" />
                                    </v-avatar>
                                </div>
                                <KanbanBoard class="instance-card-kanban-board"
                                    :columns="columns" :users="userList"
                                    :isNotAll="false"
                                    :showAddButton="false"
                                    @loadMore="handleLoadMore"
                                    @updateStatus="updateStatus"
                                />
                            </div>

                            <v-dialog v-model="dialog" max-width="500">
                                <TodoDialog :instId="instance.instId" :defId="instance.defId" :todolist="columns" @close="closeDialog" />
                            </v-dialog>
                        </v-card>
                    </v-window-item>
                    <v-window-item value="workhistory">
                        <InstanceWorkHistory :instance="instance"/>
                    </v-window-item>
                    <v-window-item value="output">
                        <InstanceOutput :instance="instance"/>
                    </v-window-item>
                </v-window>
            </div>
        </div>
    </v-card>
    <v-card v-else>
        <!-- 존재 하지 않은 인스턴스 -->
    </v-card>
</template>

<script>
// import InstanceTodo from './InstanceTodo.vue';
import InstanceProgress from './InstanceProgress.vue';
import InstanceWorkHistory from './InstanceWorkHistory.vue';
import InstanceOutput from './InstanceOutput.vue';
import ProcessInstanceRunning from '@/components/ProcessInstanceRunning.vue';
import GanttChart from '@/components/apps/todolist/GanttChart.vue';
import KanbanBoard from '@/components/apps/todolist/KanbanBoard.vue';
import KanbanColumnConfig from './KanbanColumnConfig.vue';
import TodoDialog from './TodoDialog.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    mixins: [KanbanColumnConfig],
    components: {
        InstanceProgress,
        InstanceWorkHistory,
        InstanceOutput,
        ProcessInstanceRunning,
        GanttChart,
        KanbanBoard,
        TodoDialog
    },
    data: () => ({
        mode: window.$mode,
        isLoading: true,
        instance: null,
        eventList: [],
        // tab
        tab: "progress",
        tabItems: [
            { value: 'progress', label: 'InstanceCard.progress'},
            { value: 'todo', label: 'InstanceCard.kanbanBoard'},
            { value: 'workhistory', label: 'InstanceCard.workHistory'},
            { value: 'gantt', label: 'InstanceCard.ganttChart'},
            { value: 'output', label: 'InstanceCard.output'}
        ],

        updatedKey: 0,
    }),
    watch: {
        $route: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal && newVal.query && newVal.query.submitted) {
                    this.tab = "workhistory";
                } else if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
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
        isNew: {
            immediate: true,
            handler(newVal) {
                if (!newVal) {
                    if (this.$route.query && this.$route.query.submitted) {
                        this.tab = "workhistory";
                    } else {
                        this.tab = "progress";
                    }
                }
            }
        }
    },
    mounted() {
        this.init();
    },
    computed: {
        id() {
            if ($mode == "ProcessGPT") {
                return decodeURIComponent(atob(this.$route.params.instId))
            } else {
                return this.$route.params.instId
            }
        },
        filteredTabItems() {
            if (this.instance && !this.instance.defId) {
                this.tab = 'todo';
                return this.tabItems.filter(item => item.value !== 'progress');
            }
            return this.tabItems;
        },
        isCompleted() {
            return this.instance.status == "COMPLETED"
        },
        deletable() {
            if (this.instance) {
                const email = localStorage.getItem('email');
                if (this.instance.currentUserIds && this.instance.currentUserIds.length > 0 && this.instance.currentUserIds.includes(email)) {
                    return true;
                }
            }
            return false;
        },
        isNew() {
            return this.instance && this.instance.status == 'NEW';
        },
        instanceName() {
            if (this.instance && !this.isNew) {
                return this.instance.name;
            } else if (this.instance && this.isNew) {
                return this.instance.name + this.$t('runningInstance.running');
            } else {
                return '';
            }
        }
    },
    methods: {
        handleInstanceUpdated() {
            this.updatedKey++;
            this.init();
        },
        async init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    me.isLoading = true;
                    me.instance = await backend.getInstance(me.id);
                    if (me.instance) {
                        me.eventList = await backend.getEventList(me.instance.instId);
                    }
                    const activeComponents = me.$refs[me.tab];
                    if (activeComponents && activeComponents.length > 0 && activeComponents[0].init) {
                        await activeComponents[0].init();
                    }


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
                    let dependencies = await backend.getTaskDependencyByInstId(me.id)
                    me.dependencies = me.settingTaskDependency(dependencies, me.tasks);
                    // 칸반 컬럼 업데이트
                    me.columns.forEach(column => {
                        column.tasks = me.tasks.filter(task => task.status === column.id);
                    });
                    me.isLoading = false
                }
            });
        },
        settingTaskDependency(dependencies, tasks){
            let result = [];
            result = tasks.reduce((dependencies, task) => {
                if (task.referenceIds && task.referenceIds.length > 0) {
                    const taskDeps = task.referenceIds.map(refId => ({
                        id: this.generateUUID(),
                        taskId: task.taskId,
                        dependsId: refId
                    }));
                    return [...dependencies, ...taskDeps];
                }
                return dependencies;
            }, []);

            result = [...new Set([...result, ...dependencies])];

            return result;
        },
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        },
        async fireMessage(event) {
            await backend.fireMessage(this.instance.instId, event);
            this.init();
            const progressComponent = this.$refs.progress[0];
            if (progressComponent) {
                progressComponent.initStatus();
            }
        },
        deleteInstance() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!me.id) return;
                    await backend.deleteInstance(me.id);
                    me.EventBus.emit('instances-updated');
                    me.$router.push("/todolist");
                },
                successMsg: this.$t('successMsg.instanceDelete')
            });
        },

        async handleTaskUpdated(task){
            await backend.putWorklist(task.taskId, task)
        },
        async handleTaskAdded(task){
            task.projectId = this.instance.projectId;
            if(task.parent == 0){
                task.instId = this.instance.instId;
            } else {
                task.instId = task.parent;
            }
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
        openDialog() {
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        }
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
