<template>
    <v-card elevation="10"
        :style="$globalState.state.isZoomed ? 'height: 100vh' : 'height:calc(100vh - 155px);'"
    >
        <div class="pa-2 d-flex align-center">
            <div v-if="selectedProc.mega" class="d-flex align-center cursor-pointer"
                @click="goProcess()">
                <h6 class="text-h6 font-weight-semibold">{{ selectedProc.mega.name }}</h6>
                <v-icon>mdi-chevron-right</v-icon>
            </div>
            <div v-if="selectedProc.major" class="d-flex align-center cursor-pointer"
                @click="goProcess(selectedProc.mega.name, 'mega')">
                <h6 class="text-h6 font-weight-semibold">{{ selectedProc.major.name }}</h6>
                <div>
                    <v-icon class="cursor-pointer">mdi-chevron-right</v-icon>
                    <v-menu activator="parent">
                        <v-list v-if="selectedProc.major.sub_proc_list" density="compact" class="cursor-pointer">
                            <v-list-item v-for="sub in selectedProc.major.sub_proc_list" :key="sub.id"
                                @click="goProcess(sub.id, 'sub')">
                                <v-list-item-title>
                                    {{ sub.name }}
                                </v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </div>
            </div>
            <div v-if="processDefinition" class="d-flex align-center"
                @click="updateBpmn(processDefinition.bpmn); subProcessBreadCrumb = []">
                <h6 class="text-h6 font-weight-semibold">
                    {{ processDefinition ? processDefinition.name : "" }}
                </h6>
            </div>
            <div v-for="(subProcess, idx) in subProcessBreadCrumb" :key="idx">
                <div class="d-flex align-center" @click="goHistory(idx)">
                    <v-icon>mdi-chevron-right</v-icon>
                    <h6 class="text-h6 font-weight-semibold">
                        {{ subProcess.processName }}
                    </h6>
                </div>
            </div>

            <div class="ml-auto d-flex">
                <div v-if="onLoad && bpmn">
                    <v-btn v-if="!JMS" icon variant="text" class="ml-3" :size="24" @click="executeProcess">
                        <Icon icon="carbon:play-outline" width="24" height="24" />
                    </v-btn>
                    <v-btn icon variant="text" class="ml-3" :size="24" @click="capture">
                        <Icons :icon="'image-download'" :color="'black'" />
                    </v-btn>
                </div>
                <v-tooltip :text="$t('processDefinition.zoom')">
                    <template v-slot:activator="{ props }">
                        <v-btn :size="30"
                            icon variant="text" class="ml-3"
                            v-bind="props"
                            @click="$globalState.methods.toggleZoom()"
                        >
                            <!-- zoom-out(캔버스 확대), zoom-in(캔버스 축소) -->
                            <Icons
                                :icon="!$globalState.state.isZoomed ? 'zoom-out' : 'zoom-in'"
                                :color="'black'"
                            />
                        </v-btn>
                    </template>
                </v-tooltip>
            </div>
        </div>

        <v-card-text style="width:100%; height:95%; padding:10px;">
            <ProcessDefinition v-if="onLoad && bpmn" style="width: 100%; height: 100%;" :bpmn="bpmn" :key="defCnt"
                :processDefinition="processDefinition.definition" :isViewMode="isViewMode"
                v-on:openSubProcess="ele => openSubProcess(ele)">
            </ProcessDefinition>
            <div v-else-if="onLoad && !bpmn" style="height: 90%; text-align: center">
                <h6 class="text-h6">정의된 프로세스 모델이 없습니다.</h6>
                <v-btn v-if="enableEdit" color="primary" variant="flat" class="mt-4" @click="editProcessModel">
                    프로세스 편집
                </v-btn>
            </div>
            <div v-else></div>
        </v-card-text>
        <v-dialog v-model="executeDialog">
            <process-execute-dialog v-if="mode === 'ProcessGPT'" :definitionId="processDefinition.id" @close="executeDialog = false"></process-execute-dialog>
            <dry-run-process v-else :definitionId="processDefinition.id"  @close="executeDialog = false"></dry-run-process>
        </v-dialog>
    </v-card>
</template>

<script>
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import ProcessExecuteDialog from '@/components/apps/definition-map/ProcessExecuteDialog.vue';
import DryRunProcess from '@/components/apps/definition-map/DryRunProcess.vue';
import BaseProcess from './BaseProcess.vue'

import BackendFactory from '@/components/api/BackendFactory';

export default {
    components: {
        ProcessDefinition,
        ProcessExecuteDialog,
        'dry-run-process': DryRunProcess
    },
    mixins: [BaseProcess],
    props: {
        value: Object,
        enableEdit: Boolean
    },
    data: () => ({
        onLoad: false,
        bpmn: null,
        processDefinition: null,
        selectedProc: {
            mega: null,
            major: null,
        },
        selectedSubProcess: null,
        subProcessBreadCrumb: [],
        defCnt: 0,
        isViewMode: true,
        executeDialog: false
    }),
    computed: {
        mode() {
            return window.$mode;
        },
        JMS() {
            return window.$jms;
        }
    },
    watch: {
        '$route.params': {
            handler(newVal, oldVal) {
                if(newVal.id !== oldVal.id) {
                    this.init(newVal);
                }
            },
        },
    },
    created() {
        this.init(this.$route.params);
    },
    methods: {
        goHistory(idx) {
            this.updateBpmn(this.subProcessBreadCrumb[idx].xml);
            this.removeHistoryAfterIndex(idx)
        },
        removeHistoryAfterIndex(index) {
            if (index < 0 || index >= this.subProcessBreadCrumb.length) {
                console.error("Invalid index");
                return;
            }
            this.subProcessBreadCrumb.splice(index + 1);
        },
        updateBpmn(bpmn) {
            this.bpmn = bpmn
            this.defCnt++
        },
        async openSubProcess(e) {
            let me = this;
            if (e.extensionElements?.values[0]?.definition) {
                const backend = BackendFactory.createBackend();
                const defId = e.extensionElements.values[0].definition;
                const defInfo = await backend.getRawDefinition(defId, null);
                if (defInfo) {
                    let obj = { processName: e.extensionElements.values[0].definition, xml: defInfo.bpmn }
                    me.subProcessBreadCrumb.push(obj)
                    me.selectedSubProcess = e.extensionElements.values[0].definition
                    me.updateBpmn(defInfo.bpmn)
                }
            }
        },
        async init(obj) {
            var me = this;
            me.$try({
               action: async () => {
                    const backend = BackendFactory.createBackend();  

                    me.onLoad = false;
                    if(!obj.name) obj.name = obj.id;
                    let processMap;
                    if (me.value && me.value.mega_proc_list && me.value.mega_proc_list.length > 0) {
                        processMap = me.value;
                    } else {
                        processMap = await backend.getProcessDefinitionMap();
                    }
                    processMap.mega_proc_list.forEach(mega => {
                        mega.major_proc_list.forEach(major => {
                            major.sub_proc_list.forEach(sub => {
                                if (sub.id == obj.id) {
                                    obj = sub;
                                    this.selectedProc.mega = mega;
                                    this.selectedProc.major = major;
                                }
                            })
                        })
                    })
                    // defObj.id.replace(/_/g, '/');
                    // const defInfo = await backend.getRawDefinition(defId, null);
                    if(obj.id){
                        let path = obj.id.replace(/_/g, '/');
                        me.bpmn = await backend.getRawDefinition(path, { type: 'bpmn' });
                    } else {
                        me.bpmn = null;
                    }
                    me.processDefinition = obj
                    me.onLoad = true;
                }
            });
        },
        editProcessModel() {
            if (this.processDefinition && this.processDefinition.id) {
                this.$router.push(`/definitions/chat?id=${this.processDefinition.id}&name=${this.processDefinition.name}`);
            }
        },
        capture() {
            this.$emit('capture')
        },
        executeProcess() {
            this.executeDialog = true
        },
        startProcess() {
            var me = this;
            me.$try({
                action: async () => {
                    const backend = BackendFactory.createBackend();
                    const input = {
                        process_instance_id: "new",
                        process_definition_id: me.processDefinition.id,
                    }
                    const data = await backend.start(input);
                    if (data.instanceId) {
                        me.$router.push(`/instancelist/${btoa(data.instanceId)}`);
                    }
                    me.EventBus.emit('instances-updated');
                },
                successMsg: 'Process 실행 완료'
            })
        },
    },
}
</script>