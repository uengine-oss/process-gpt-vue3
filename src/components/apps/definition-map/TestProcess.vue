<template>
    <v-card style="width: 100%; height: 100%">
        <v-card-title class="pb-0">{{ $t('TestProcess.title') }}</v-card-title>
        <div>
            <v-row :class="isMobile ? 'ma-0 pa-2 mt-2' : 'ma-0 pa-4 pt-0'">
                <v-col class="pa-0" :cols="isMobile ? 12 : isSimulate ? 6 : 6">
                    <v-alert v-if="bpmn || subBpmn" class="pa-0 mt-4" color="#2196F3" variant="outlined">
                        <div
                            class="pa-2"
                            :style="
                                $globalState.state.isZoomed
                                    ? 'height: calc(100vh - 130px); overflow: auto'
                                    : 'height: calc(100vh - 240px); color: black; overflow: auto'
                            "
                        >
                            <div class="pa-0" style="height: 100%;" :key="updatedDefKey">
                                <div v-if="bpmn" style="border-bottom: 1px solid #E0E0E0;">
                                    {{ $t('TestProcess.mainInstanceId') }}{{ instanceId }}
                                    <BpmnUengine
                                        ref="bpmnVue"
                                        :key="bpmnKey"
                                        :bpmn="bpmn"
                                        :taskStatus="taskStatus"
                                        :options="options"
                                        :isViewMode="true"
                                        :currentActivities="currentActivities"
                                        v-on:openDefinition="(ele) => openSubProcess(ele)"
                                        style="height: 45vh;"
                                    ></BpmnUengine>
                                </div>
                                <div v-if="subBpmn">
                                    <div v-for="(sub, key) in subBpmn"
                                         style="border-bottom: 1px solid #E0E0E0;"
                                    >
                                        {{ $t('TestProcess.subInstanceId') }}{{ key }}
                                        <BpmnUengine
                                            ref="bpmnVue"
                                            :key= "subBpmnKey"
                                            :bpmn="sub"
                                            :options="options"
                                            :isViewMode="true"
                                            :taskStatus="subTaskStatus[key]"
                                            :currentActivities="subCurrentActivities[key]"
                                            v-on:openDefinition="(ele) => openSubProcess(ele)"
                                            style="height: 45vh"
                                        ></BpmnUengine>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </v-alert>
                    <v-row v-else class="ma-0 pa-0 test-process-skeleton" style="height: 100%;">
                        <v-col cols="12" class="pa-4">
                            <v-skeleton-loader type="card"></v-skeleton-loader>
                        </v-col>
                    </v-row>
                </v-col>
                <v-col class="pa-4" :cols="6">
                    <v-card-title class="pa-0">{{ $t('TestProcess.worklist') }}</v-card-title>
                    <div
                        style="max-height: calc(-270px + 100vh);
                        color: black;
                        overflow: auto;"
                    >
                        <div v-if="eventList">
                            <div v-for="event in eventList" :key="event">
                                <v-btn
                                    @click="
                                        $try({
                                            context: this,
                                            action: () => fireMessage(event.tracingTag),
                                            successMsg: `${event.name} ${this.$t('TestProcess.success')}`
                                        })
                                    "
                                    v-if="event.name"
                                    >{{ event.name }}</v-btn
                                >
                            </div>
                        </div>
                        <div v-if="taskList">
                            <v-card
                                v-for="task in taskList"
                                variant="outlined"
                                class="pa-4 mb-0"
                                :key="task.taskId"
                            >
                                <div>
                                    <div class="text-h6 mb-1">
                                        {{ task.title }}
                                    </div>
                                    <div class="text-caption">{{ $t('TestProcess.taskID') }}{{ task.taskId }}</div>
                                    <div class="text-caption">{{ $t('TestProcess.instanceID') }}{{ task.instId }}</div>
                                </div>
                                <test-variables
                                    style="height: 100%"
                                    :definition-id="definitionId"
                                    :task="task.trcTag"
                                    :task-id="task.taskId"
                                    @executeTest="(e) => executeTestProcess(e, task)"
                                    @type="(e) => (tool = e)"
                                    @work-item="(e) => addWorkItem(e, task.taskId)"
                                ></test-variables>
                            </v-card>
                        </div>
                        <v-row v-else class="ma-0 pa-0 test-process-work-list-skeleton" style="height: 100%;">
                            <v-col cols="12" class="pa-0">
                                <v-skeleton-loader type="card"></v-skeleton-loader>
                            </v-col>
                        </v-row>
                    </div>
                </v-col>
            </v-row>
        </div>

        <!-- <v-card-actions class="justify-center" v-if="tool == 'DefaultWorkItem'">
            <v-btn color="primary" variant="flat" class="cp-process-save" @click="executeProcess">실행</v-btn>
            <v-btn color="error" variant="flat" @click="closeDialog()">닫기</v-btn>
        </v-card-actions> -->
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import TestVariables from '@/components/apps/definition-map/TestVariables.vue';
import customBpmnModule from '@/components/customBpmn';
import BpmnUengine from '@/components/BpmnUengineViewer.vue';
export default {
    components: { TestVariables, BpmnUengine },
    props: {
        definitionId: String // proceeName (proceeName.bpmn)
    },
    data: () => ({
        backend: null,
        dryRunWorkItem: undefined,
        isSimulate: 'true',
        isDryRun: true,
        taskId: null,
        bpmn: null,
        updatedDefKey: 0,
        options: {
            additionalModules: [customBpmnModule]
        },
        eventList: [],
        workListByInstId: null,
        currentActivities: [],
        workItem: {},
        taskList: null,
        instanceId: null,
        tool: null,
        subBpmn: null,
        subBpmnKey: 0,
        subTaskStatus : {},
        subCurrentActivities: null,
        taskStatus: null,
        bpmnKey: 0
    }),
    created() {
        let me = this;
        me.backend = BackendFactory.createBackend();
        me.startProcess();
    },
    watch: {
        // taskId: {
        //     handler() {
        //         this.setTaskInfo();
        //     }
        // }
    },
    methods: {
        async addWorkItem(item, taskId) {
            let me = this;
            this.workItem[taskId] = item;
            console.log(item);
            if (item.worklist.instId != item.worklist.rootInstId) {
                let tasks = await me.backend.getActivitiesStatus(item.worklist.instId);
                if (!me.subCurrentActivities) me.subCurrentActivities = {};
                Object.keys(tasks).forEach(function (task) {
                    if(!me.subCurrentActivities[item.worklist.instId]) me.subCurrentActivities[item.worklist.instId] = []
                    // me.workItem = await me.backend.getWorkItem(task.taskId);
                    me.subCurrentActivities[item.worklist.instId].push(task);
                });
                // me.subCurrentActivities[item.worklist.instId] = tasks;

                if (me.subBpmn == null) me.subBpmn = {};
                me.subBpmn[item.worklist.instId] = await me.backend.getRawDefinition(item.worklist.defId, { type: 'bpmn' });
                await me.setStatus();
                me.updatedDefKey++;

                
                // me.subCurrentActivities ?  : me.subCurrentActivities
            }
        },
        executeTestProcess(testData, task) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    // Form은 Variable부터 Set
                    let value;
                    if (this.tool == 'FormWorkItem') {
                        me.saveForm(testData, task);
                    }
                    if (testData.parameterValues) value = testData;
                    else value = { parameterValues: testData };

                    if (task?.execScope) value.execScope = task.execScope;
                    let result = await me.backend.putWorkItemComplete(task.taskId, value, me.isSimulate);
                    let taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
                    me.taskList = taskInfo;
                    me.setTaskInfo();
                    
                    await me.setStatus();
                    
                },
                successMsg: this.$t('successMsg.workCompleted')
            });
            
        },
        async saveForm(testData, task) {
            let me = this;

            let varName = me.workItem[task.taskId].activity.variableForHtmlFormContext.name;
            let variable = {};

            variable._type = 'org.uengine.contexts.HtmlFormContext';
            let tmp;
            Object.keys(testData).forEach(function (key) {
                tmp = testData[key];
            });

            variable.valueMap = tmp;
            Object.keys(variable.valueMap).forEach((key) => {
                if (Array.isArray(variable.valueMap[key])) {
                    if (!variable.valueMap[key]) return;
                    variable.valueMap[key]?.forEach((item) => {
                        if (item && item._type) {
                            item._type = 'java.util.HashMap';
                        }
                    });
                }
            });
            // variable.valueMap._type = 'java.util.HashMap';

            await me.backend.setVariableWithTaskId(me.instanceId, task.taskId, varName, variable);
            // Delete a specific key from the JSON object
            const keyToDelete = 'specificKey'; // Replace 'specificKey' with the actual key you want to delete
            if (me.workItem.hasOwnProperty(task.taskId)) {
                delete me.workItem[task.taskId];
            }
        },
        setStatus() {
            let me = this;
            if(me.subBpmn) {
                Object.keys(me.subBpmn).forEach(async function (instId) {
                    me.subTaskStatus[instId] = await me.backend.getActivitiesStatus(instId);
                    me.bpmnKey++;
                    me.subBpmnKey++;
                    me.updatedDefKey++;
                });
            }
        },
        startProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    console.log(me.isSimulate);
                    let command = {
                        processDefinitionId: me.definitionId,
                        simulation: true
                    };
                    let result = await me.backend.start(command);
                    this.instanceId = result.instanceId;
                    let taskInfo = await me.backend.findCurrentWorkItemByInstId(result.instanceId);
                    me.taskList = taskInfo;
                    me.bpmn = await me.backend.getRawDefinition(me.taskList[0].defId, { type: 'bpmn' });
                    me.setTaskInfo();
                }
            });
        },
        async setEventList() {
            let me = this;
            this.eventList = await me.backend.getEventList(this.instanceId);
        },
        async setTaskInfo() {
            let me = this;

            me.workListByInstId = await me.backend.getWorkListByInstId(me.instanceId);
            // me.updatedDefKey++;
            // me.taskList.forEach(function (task) {
            //     console.log(task);
            //     // me.workItem = await me.backend.getWorkItem(task.taskId);
            //     me.currentActivities.push(task.trcTag);
            // });
            me.setEventList();
            let tasks = await me.backend.getActivitiesStatus(me.instanceId);
            console.log(tasks);
            Object.keys(tasks).forEach(function (task) {
                console.log(task);
                // me.workItem = await me.backend.getWorkItem(task.taskId);
                me.currentActivities.push(task);
            });
            // let me = this;
            // me.currentActivities = [];
            // me.workItem = await me.backend.getWorkItem(me.taskId);

            me.taskStatus = tasks;
            me.bpmnKey++;
            me.updatedDefKey++;
        },
        async fireMessage(event) {
            let me = this;
            await me.backend.fireMessage(me.instanceId, event);
            let taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
            me.taskList = taskInfo;
            me.setTaskInfo();
        }
    }
};
</script>
