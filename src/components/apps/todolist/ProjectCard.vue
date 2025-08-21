<template>
    <div class="center-container">
        <v-card elevation="10" class="list-card">
            <v-tabs v-model="tab" color="primary">
                <v-tab value="managment">{{ $t('ProjectCard.managment') }}</v-tab>
                <v-tab value="kanbanBoard">{{ $t('ProjectCard.kanbanBoard') }}</v-tab>
                <v-tab value="instanceList">{{ $t('ProjectCard.instanceList') }}</v-tab>
                <Icons :icon="'play'" :size="20" @click="openPDM()" style="align-self: center;"/>
            </v-tabs>
            
            <v-window v-model="tab"
                :touch="false"
            >
                <v-window-item value="managment" class="h-100">
                    <div class="gantt-area" v-if="!isLoading">
                        <GanttChart 
                            :tasks="tasks" 
                            :dependencies="dependencies"
                            :users="userList" 
                            @task-updated="handleTaskUpdated" 
                            @task-added="handleTaskAdded"
                            @task-clicked="handleTaskClicked"
                            @link-event="handleLinkEvent"
                        />
                    </div>
                </v-window-item>
                <v-window-item value="kanbanBoard">
                    <div class="project-card-kanban-board">
                        <KanbanBoard 
                            :columns="columns"
                            :users="userList"
                        />
                    </div>
                </v-window-item>
                <v-window-item value="instanceList">
                    <div class="project-card-kanban-instanceList">
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
                    </div>
                </v-window-item>
            </v-window>
        </v-card>

        <v-dialog v-model="isPDMOpen" style="width: 100%; height: 100%;" persistent>
            <div v-if="!isShowProcess">
                <ProcessDefinitionMap :isViewMode="true" :isExecutionByProject="true" @clickPlayBtn="clickPlayBtn" @closePDM="closePDM()"/>
            </div>
            <div v-else>
                <process-gpt-execute v-if="mode === 'ProcessGPT'" :isExecutionByProject="true" :processDefinition="processDefinitionData" :definitionId="processDefinition.id" @close="closePDM()" :isSimulate="'false'" @createInstance="createInstance"></process-gpt-execute>
            </div>
        </v-dialog>
    </div>
  </template>

<script>
import KanbanBoard from './KanbanBoard.vue';
import GanttChart from './GanttChart.vue';
import KanbanColumnConfig from './KanbanColumnConfig.vue';
import ProcessDefinitionMap from '@/components/apps/definition-map/ProcessDefinitionMap.vue';
import DryRunProcess from '@/components/apps/definition-map/DryRunProcess.vue';
import ProcessGPTExecute from '@/components/apps/definition-map/ProcessGPTExecute.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    mixins: [KanbanColumnConfig],
    components: {
        KanbanBoard,
        GanttChart,
        ProcessDefinitionMap,
        'dry-run-process': DryRunProcess,
        'process-gpt-execute': ProcessGPTExecute
    },
    data: () => ({  
        tab: 'managment', // 탭 인덱스
        project: null, // 프로젝트 정보
        instanceList: [], // 인스턴스 리스트
        tasks: [], // 작업 리스트
        dependencies: [], // 작업 의존성 리스트
        isLoading: true, // 데이터 로딩 여부
        isPDMOpen: false, // PDM 모달 열림 여부
        isShowProcess: false,
        processDefinitionData: null,
        processDefinition: null,
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
            return this.$route.params.projectId.replace(/_DOT_/g, '.');
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
                column.tasks = me.tasks.filter(task => {
                    if ((task.status === 'PENDING' || task.status === 'CANCELLED') && column.id === 'PENDING') {
                        return true;
                    } else if ((task.status === 'IN_PROGRESS' || task.status === 'SUBMITTED') && column.id === 'IN_PROGRESS') {
                        return true;
                    } else {
                        return task.status === column.id;
                    }
                });
            });
        },
        openPDM(){
            this.isShowProcess = false
            this.isPDMOpen = true
        },
        closePDM(){
            this.processInfo = null
            this.isPDMOpen = false
        },
        clickPlayBtn(obj){
            var me = this
            me.$try({
                action: async () => {
                    me.processDefinition = obj;
                    
                    const value = await backend.getRawDefinition(me.processDefinition.id);
                    if (value)  me.processDefinitionData = value.definition;
                    
                    this.isShowProcess = true
                }
            })
        },
        createInstance(value){
            var me = this
            me.$try({
                action: async () => {
                    if(!value.project_id) value['project_id'] = me.projectId;
                    await backend.start(value);

                    this.isShowProcess = false
                    me.closePDM();
                },
                successMsg: me.$t('successMsg.processExecutionCompleted')
            })

        },
        async handleTaskUpdated(task){
            if(task.parent == 0){
                await backend.putInstance(task.instId, task)
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
            this.$router.push(`/instancelist/${item.instId}`);
        },
    }
};
</script>

<style>
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
</style>