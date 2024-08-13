<template>
    <v-card style="width: 100%; height: 100%">
        <v-card-title> Testing Process </v-card-title>
        <v-card-text>
            <div>
                <v-row :class="isMobile ? 'ma-0 pa-2 mt-2' : 'ma-0 pa-2'">
                    <v-col class="pa-0" :cols="isMobile ? 12 : isSimulate ? 6 : 6">
                        <v-alert class="pa-0 mt-4" color="#2196F3" variant="outlined">
                            <div
                                class="pa-2"
                                :style="
                                    $globalState.state.isZoomed
                                        ? 'height: calc(100vh - 130px); overflow: auto'
                                        : 'height: calc(100vh - 280px); color: black; overflow: auto'
                                "
                            >
                                <div class="pa-0 pl-2" style="height: 100%" :key="updatedDefKey">
                                    <div v-if="bpmn" style="height: 100%">
                                        <BpmnUengine
                                            ref="bpmnVue"
                                            :bpmn="bpmn"
                                            :options="options"
                                            :isViewMode="true"
                                            :currentActivities="currentActivities"
                                            v-on:openDefinition="(ele) => openSubProcess(ele)"
                                            style="height: 100%"
                                        ></BpmnUengine>
                                    </div>
                                    <div v-else class="no-bpmn-found-text">No BPMN found</div>
                                </div>
                            </div>
                        </v-alert>
                    </v-col>
                    <v-col class="pa-0" :cols="6" style="height: 30%">
                        <v-alert class="pa-0 mt-4" color="#2196F3" variant="outlined">
                            <v-card variant="outlined" color="black" style="height: 600px; overflow: auto">
                                <v-card-title>worklist</v-card-title>
                                <v-card-item>
                                    <div v-if="taskList">
                                        <v-card
                                            v-for="task in taskList"
                                            color="primary"
                                            variant="outlined"
                                            class="mx-auto"
                                            :key="task.taskId"
                                        >
                                            <v-card-item>
                                                <div>
                                                    <div class="text-h6 mb-1">
                                                        {{ task.title }}
                                                    </div>
                                                    <div class="text-caption">Task ID: {{ task.taskId }}</div>
                                                    <div class="text-caption">Instance ID: {{ task.instId }}</div>
                                                </div>
                                            </v-card-item>
                                            <v-card-actions>
                                                <test-variables
                                                    style="height: 100%"
                                                    :definition-id="definitionId"
                                                    :task="task.trcTag"
                                                    :task-id="task.taskId"
                                                    @executeTest="(e) => executeTestProcess(e, task)"
                                                ></test-variables>
                                            </v-card-actions>
                                        </v-card>
                                    </div>
                                    <div v-else>Loading...</div>
                                </v-card-item>
                            </v-card>
                        </v-alert>
                    </v-col>
                </v-row>
            </div>
        </v-card-text>

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
import BpmnUengine from '@/components/BpmnUengine.vue';
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
            propertiesPanel: {},
            additionalModules: [customBpmnModule]
        },
        workListByInstId: null,
        currentActivities: [],
        workItem: null,
        taskList: null,
        instanceId: null
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
        executeTestProcess(testData, task) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    let value;
                    if (testData.parameterValues) value = testData;
                    else value = { parameterValues: testData };

                    if (task?.execScope) value.execScope = task.execScope;
                    let result = await me.backend.putWorkItemComplete(task.taskId, value, me.isSimulate);
                    let taskInfo = await me.backend.findCurrentWorkItemByInstId(me.instanceId);
                    me.taskList = taskInfo;
                    me.setTaskInfo();
                },
                successMsg: '해당 업무 완료'
            });
        },
        startProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    console.log(me.isSimulate);
                    let command = {
                        processDefinitionId: me.definitionId
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
        async setTaskInfo() {
            let me = this;

            me.workListByInstId = await me.backend.getWorkListByInstId(me.instanceId);
            // me.updatedDefKey++;
            me.taskList.forEach(function (task) {
                console.log(task);
                // me.workItem = await me.backend.getWorkItem(task.taskId);
                me.currentActivities.push(task.trcTag);
            });
            // let me = this;
            // me.currentActivities = [];
            // me.workItem = await me.backend.getWorkItem(me.taskId);

            me.updatedDefKey++;
        }
    }
};
</script>
