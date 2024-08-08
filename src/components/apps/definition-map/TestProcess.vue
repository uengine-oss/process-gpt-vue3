<template>
    <v-card style="width: 100%; height: 100%">
        <v-card-title> Testing Process </v-card-title>
        <v-card-text>
            <div>
                <v-row :class="isMobile ? 'ma-0 pa-2 mt-2' : 'ma-0 pa-2'">
                    <v-col class="pa-0" :cols="isMobile ? 12 : isSimulate ? 8 : 8">
                        <v-alert class="pa-0 mt-4" color="#2196F3" variant="outlined">
                            <div
                                class="pa-2"
                                :style="
                                    $globalState.state.isZoomed
                                        ? 'height: calc(100vh - 130px);'
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
                    <v-col class="pa-0" :cols="4" style="height: 30%">
                        <v-alert class="pa-0 mt-4" color="#2196F3" variant="outlined">
                            <v-card variant="outlined" color="black">
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
                                                <v-btn @click="taskId = task.taskId"> Button </v-btn>
                                            </v-card-actions>
                                        </v-card>
                                    </div>
                                    <div v-else>Loading...</div>
                                </v-card-item>
                            </v-card>
                        </v-alert>
                    </v-col>
                    <v-col :cols="12">
                        <test-variables
                            v-if="workItem"
                            style="height: 100%"
                            :definition-id="definitionId"
                            :task="workItem.activity.tracingTag"
                            @executeTest="executeProcess"
                        ></test-variables>
                        <div v-else>No Select Task</div>
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
        taskList: null
    }),
    created() {
        let me = this;
        me.backend = BackendFactory.createBackend();
        me.startProcess();
    },
    watch: {
        taskId: {
            handler() {
                this.setTaskInfo();
            }
        }
    },
    methods: {
        executeTestProcess(testData) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    let value = { parameterValues: testData };

                    if (me.workItem?.execScope) value.execScope = me.workItem.execScope;
                    let result = await me.backend.putWorkItemComplete(me.$route.params.taskId, testData, me.isSimulate);
                    // me.$router.push(`/instancelist/${btoa(me.workItem.worklist.instId)}`);
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
                    console.log(result.instanceId);
                    let taskInfo = await me.backend.findCurrentWorkItemByInstId(result.instanceId);
                    if (taskInfo.length == 0) {
                        // 표시 데이터 없음.
                    } else {
                        me.taskList = taskInfo;
                        me.bpmn = await me.backend.getRawDefinition(taskInfo[0].defId, { type: 'bpmn' });
                        me.workListByInstId = await me.backend.getWorkListByInstId(taskInfo[0].instId);
                        if (taskInfo.length == 1) {
                            me.taskId = taskInfo[0].taskId;
                        }
                        me.updatedDefKey++;
                    }
                }
            });
        },
        async setTaskInfo() {
            let me = this;
            me.currentActivities = []
            me.workItem = await me.backend.getWorkItem(me.taskId);
            console.log(me.workItem.activity.trcTag)
            me.currentActivities.push(me.workItem.activity.tracingTag)
            me.updatedDefKey++;
            // if (me.workItem.worklist.currentActivities) {
            //     me.currentActivities = me.workItem.worklist.currentActivities;
            // } else {
            //     me.currentActivities = me.workListByInstId.map((item) => {
            //         if (item.status != 'COMPLETED' && item.status != 'DONE') {
            //             return item.tracingTag;
            //         }
            //     });
            // }
        }
    }
};
</script>
