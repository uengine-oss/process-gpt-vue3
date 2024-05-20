<template>
    <v-card elevation="10" v-if="workItem" :key="updatedKey">
        <v-card-title>
            <v-row class="ma-0 pa-0 mt-1 ml-3" style="line-height: 100%">
                <div style="font-size: 20px; font-weight: 500">{{ workItem.activity.name }}</div>
                <v-chip size="small" variant="outlined" density="comfortable" style="margin-left: 5px">{{ workItemStatus }}</v-chip>
            </v-row>
        </v-card-title>
        <v-row class="ma-0 pa-2 mt-2">
            <!-- Left -->
            <v-col
                class="pa-0"
                cols="4"
                :style="$globalState.state.isZoomed ? 'height: calc(100vh - 70px);' : 'height: calc(100vh - 215px);'"
                style="overflow: auto"
            >
                <div v-if="currentComponent"
                    class="work-itme-current-component"
                >
                    <component :is="currentComponent" :work-item="workItem" :workItemStatus="workItemStatus"
                        :isComplete="isComplete"></component>
                    <v-tooltip :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                @click="$globalState.methods.toggleZoom()"
                                size="small"
                                icon
                                v-bind="props"
                                class="processVariables-zoom task-btn"
                            >
                                <!-- 캔버스 확대 -->
                                <Icon
                                    v-if="!$globalState.state.isZoomed"
                                    icon="material-symbols:zoom-out-map-rounded"
                                    width="32"
                                    height="32"
                                />
                                <!-- 캔버스 축소 -->
                                <Icon v-else icon="material-symbols:zoom-in-map-rounded" width="32" height="32" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>
            </v-col>
            <!-- Right -->
            <v-col class="pa-0" cols="8">
                <v-alert class="pa-0 mt-4" color="#2196F3" variant="outlined">
                    <v-tabs v-model="selectedTab">
                        <v-tab value="progress" v-if="checkPoints">진행 상황/체크포인트</v-tab>
                        <v-tab value="progress" v-else>진행 상황</v-tab>
                        <v-tab v-if="messages && messages.length > 0" value="history">워크 히스토리</v-tab>
                        <v-tab v-if="messages && messages.length > 0" value="agent">Agent 초안 생성</v-tab>
                    </v-tabs>
                    <v-window v-model="selectedTab">
                        <v-window-item value="progress">
                            <div
                                class="pa-2"
                                :style="$globalState.state.isZoomed ? 'height: calc(100vh - 130px);' : 'height: calc(100vh - 280px);'"
                                style="color: black; overflow: auto"
                            >
                                <div class="pa-0 pl-2" :style="!checkPoints ? 'height:100%;' : 'height:50%;'">
                                    <div v-if="bpmn" style="height: 100%">
                                        <process-definition
                                            style="height: 100%"
                                            :currentActivities="currentActivities"
                                            :bpmn="bpmn"
                                            :key="updatedDefKey"
                                            :isViewMode="true"
                                        ></process-definition>
                                    </div>
                                    <div v-else>No BPMN found</div>
                                </div>
                                <div v-if="checkPoints" style="overflow: auto; height: 50%">
                                    <v-card-title>CheckPoint ({{ checkedCount }}/{{ checkPoints ? checkPoints.length : 0 }})</v-card-title>
                                    <div style="margin: -15px 0px 0px 5px">
                                        <div v-for="(checkPoint, index) in checkPoints" :key="index" style="height: 40px">
                                            <v-checkbox
                                                style="height: 40px !important"
                                                v-model="checkPoint.checked"
                                                :label="checkPoint.name"
                                                color="primary"
                                                hide-details
                                            ></v-checkbox>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </v-window-item>
                        <v-window-item value="history" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component
                                            :is="'work-history-' + mode"
                                            :messages="messages"
                                            :isComplete="isComplete"
                                            @clickMessage="navigateToWorkItemByTaskId"
                                        />
                                    </div>
                                </perfect-scrollbar>
                            </v-card>
                        </v-window-item>
                        <v-window-item value="agent" class="pa-2">
                            <v-card elevation="10" class="pa-4">
                                <perfect-scrollbar v-if="messages.length > 0" class="h-100" ref="scrollContainer" @scroll="handleScroll">
                                    <div class="d-flex w-100" style="overflow: auto" :style="workHistoryHeight">
                                        <component
                                            :is="'work-history-' + mode"
                                            :messages="[]"
                                            :isAgentMode="true"
                                        />
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

import WorkItemChat from '@/components/ui/WorkItemChat.vue';
import ProcessInstanceChat from '@/components/ProcessInstanceChat.vue';

const backend = BackendFactory.createBackend();
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
        eventList: []
    }),
    created() {
        this.init();
    },
    computed: {
        mode() {
            return window.$mode;
        },
        checkedCount() {
            if (!this.checkPoints) return 0;
            return this.checkPoints.filter((checkPoint) => checkPoint.checked).length;
        },
        messages() {
            if (!this.workListByInstId) return [];
            return this.workListByInstId.map((workItem) => ({
                profile: 'https://avatars0.githubusercontent.com/u/9064066?v=4&s=460',
                roleName: workItem.task.roleName,
                _item: workItem,
                content: workItem.title,
                description: workItem.description,
                timeStamp: workItem.startDate
            }));
        },
        id() {
            return this.$route.params.taskId ? this.$route.params.taskId : null;
        },
        workItemStatus() {
            if (!this.workItem) return null;
            return this.workItem.worklist.status;
        },
        isComplete(){
            return this.workItemStatus == "COMPLETED" || this.workItemStatus == "DONE"
        }
    },
    methods: {
        init() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.workItem = await backend.getWorkItem(me.id);
                    me.bpmn = await backend.getRawDefinition(me.workItem.worklist.defId, { type: 'bpmn' });
                    if (me.workItem.worklist.execScope) me.workItem.execScope = me.workItem.worklist.execScope;
                    me.workListByInstId = await backend.getWorkListByInstId(me.workItem.worklist.instId);
                    me.currentComponent = me.workItem.worklist.tool.includes('formHandler') ? 'FormWorkItem' : 'DefaultWorkItem';
                    me.currentActivities = [me.workItem.activity.tracingTag];
                    me.updatedDefKey++;
                }
            });
        },
        navigateToWorkItemByTaskId(obj) {
            var me = this;
            me.$router.push(`/todolist/${obj._item.taskId}`);
            this.$nextTick(() => {
                me.delay(500).then(() => {
                    me.init();
                    me.updatedKey++;
                });
            });
        },
        delay(time) {
            return new Promise((resolve) => setTimeout(resolve, time));
        }
    }
};
</script>
<style>
.work-itme-current-component .v-checkbox .v-input__details {
    display: none;
}
.work-itme-current-component .v-checkbox {
    height: 40px;
}
.work-itme-current-component .v-checkbox label {
    opacity: 0.6 !important;
}
.work-itme-current-component .form-checkbox-label {
    font-size: 20px;
    font-weight: 500;
}
.work-itme-current-component .form-radio-box {
    margin-top: 25px;
}
.work-itme-current-component .form-radio-box .v-radio-group {
    margin-top: 8px;
}
.work-itme-current-component .form-radio-box .form-radio-label {
    font-size: 20px;
    font-weight: 500;
}

.work-itme-current-component .form-label {
    font-size: 20px;
    font-weight: 500;
}
</style>
