<template>
     <v-card elevation="10" v-if="workItem" :key="updatedKey"
        :style="$globalState.state.isZoomed ? 'height:100vh;' : 'height:calc(100vh - 150px);'"
     >
        <v-card-title>
            <v-row class="ma-0 pa-0">
                <h3>{{workItem.activity.name}}</h3>
                <v-chip size="x-small" variant="outlined" style="margin:2px 0px 0px 5px !important; display: flex; align-items: center;">{{workItemStatus}}</v-chip>
                <v-spacer></v-spacer>
            </v-row>
        </v-card-title>
        <v-row class="ma-0 pa-2 mt-2">
             <!-- Left -->
            <v-col class="pa-0" cols="4">
                <div v-if="currentComponent"
                    class="work-itme-current-component"
                    style="overflow:auto;"
                    :style="$globalState.state.isZoomed ? 'height: calc(100vh - 50px);' : 'height: calc(100vh - 215px);'"
                >
                    <component :is="currentComponent" :work-item="workItem" :workItemStatus="workItemStatus"></component>
                </div>
            </v-col>
            <!-- Right -->
            <v-col class="pa-0" cols="8">
                <v-alert class="pa-0" color="#2196F3" variant="outlined">
                    <v-tabs v-model="selectedTab">
                        <v-tab value="progress">진행 상황/체크포인트</v-tab>
                        <v-tab v-if="messages && messages.length > 0" value="history">워크 히스토리</v-tab>
                    </v-tabs>
                    <v-window v-model="selectedTab">
                        <v-window-item value="progress" class="pa-2">
                            <v-card-title style="color:black;">프로세스 진행상태</v-card-title>
                            <div class="pa-0 pl-3" style="overflow:auto;"
                                :style="dynamicHeight"
                            >
                                <div v-if="bpmn" style="height: 100%;">
                                    <process-definition class="work-item-definition" :currentActivities="currentActivities" :bpmn="bpmn" :key="updatedDefKey" :isViewMode="true"></process-definition>
                                </div>
                                <dif v-else>
                                    No BPMN found
                                </dif>
                            </div>
                            <div v-if="checkPoints">
                                <v-card-title>CheckPoint ({{checkedCount}}/{{ checkPoints ? checkPoints.length : 0 }})</v-card-title>
                                <div>
                                    <div v-for="(checkPoint, index) in checkPoints" :key="index">
                                        <v-checkbox v-model="checkPoint.checked" :label="checkPoint.name" color="primary" hide-details></v-checkbox>
                                    </div>
                                </div>
                            </div>
                        </v-window-item>
                        <v-window-item value="history" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="height: calc(100vh - 300px); overflow: auto;">
                                        <component :is="'work-history-'+mode" :messages="messages" @clickMessage="navigateToWorkItemByTaskId" />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                    </v-window>
                </v-alert>
            </v-col>
        </v-row>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import DefaultWorkItem from './DefaultWorkItem.vue'; // DefaultWorkItem 컴포넌트 임포트
import FormWorkItem from './FormWorkItem.vue'; // FormWorkItem 컴포넌트 임포트

import WorkItemChat from "@/components/ui/WorkItemChat.vue";
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';

const backend = BackendFactory.createBackend()
export default {
    components: {
        ProcessDefinition,
        DefaultWorkItem,
        FormWorkItem,
        'work-history-uEngine': WorkItemChat,
        'work-history-ProcessGPT': ProcessInstanceChat
    },
    data: () => ({
        bpmn: null,
        workItem: null,
        checkPoints: null,
        workListByInstId: null,
        currentComponent: null,
        currentActivities: [],

        // status variables
        updatedKey: 0,
        updatedDefKey: 0,
        loading: false,
        selectedTab: 'progress',
        dynamicHeight: '',
    }),
    created() {
        this.init();
    },
    watch : {
        '$globalState.state.isZoomed': {
            handler(newVal) {
                // isZoomed 값이 변경될 때 실행될 로직
                if (newVal) {
                    if(this.checkPoints) {
                        this.dynamicHeight = 'height: calc(100vh - 620px);';
                    } else {
                        this.dynamicHeight = 'height: calc(100vh - 185px)';
                    }
                } else {
                    this.dynamicHeight = !this.checkPoints ? 'height: calc(100vh - 325px);' : 'height: calc(100vh - 650px);';
                }
            },
            immediate: true // 컴포넌트 생성 시에도 핸들러를 실행
        }
    },
    computed:{
        mode(){
            return window.$mode;
        },
        checkedCount(){
            if(!this.checkPoints) return 0
            return this.checkPoints.filter(checkPoint => checkPoint.checked).length;
        },
        messages(){
            if(!this.workListByInstId) return []
            return this.workListByInstId.map(workItem => ({
                roleName: workItem.task.roleName,
                _item: workItem,
                content: workItem.title,
                description: workItem.description,
                timeStamp: workItem.startDate
            }))
        },
        id() {
            return this.$route.params.taskId ? this.$route.params.taskId : null;
        },
        workItemStatus(){
            if(!this.workItem) return null
            return this.workItem.worklist.status
        }
    },
    methods: {
        init() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    me.workItem = await backend.getWorkItem(me.id);
                    me.bpmn = await backend.getRawDefinition(me.workItem.worklist.defId, {type: 'bpmn'});
                    me.workListByInstId = await backend.getWorkListByInstId(me.workItem.worklist.instId);
                    me.currentComponent = me.workItem.worklist.tool.includes('formHandler') ? 'FormWorkItem' : 'DefaultWorkItem';
                    me.currentActivities = [ me.workItem.activity.tracingTag ];
                    me.updatedDefKey++
                }
            })
        },
        navigateToWorkItemByTaskId(obj){
            var me = this
            me.$router.push(`/todolist/${obj._item.taskId}`);
            this.$nextTick(() => {
                me.delay(500)
                .then(() => {
                    me.init();
                    me.updatedKey++;
                });
            });
        },
        delay(time) {
            return new Promise(resolve => setTimeout(resolve, time));
        },
    },
}
</script>
<style>
.work-itme-current-component .v-checkbox .v-input__details {
    display: none;
}
.work-itme-current-component .v-checkbox {
    height:40px;
}
.work-itme-current-component .v-checkbox label {
    opacity: 0.6 !important;
}
.work-itme-current-component .form-checkbox-label {
    font-size:20px;
    font-weight:500;
}
.work-itme-current-component .form-radio-box {
    margin-top:25px;
}
.work-itme-current-component .form-radio-box .v-radio-group {
    margin-top:8px;
}
.work-itme-current-component .form-radio-box .form-radio-label {
    font-size:20px;
    font-weight:500;
}

.work-itme-current-component .form-label {
    font-size:20px;
    font-weight:500;
}
</style>