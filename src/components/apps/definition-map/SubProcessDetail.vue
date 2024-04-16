<template>
    <v-card elevation="10" style="height:calc(100vh - 155px);">
        <div class="pt-5 pl-6 pr-6 d-flex align-center">
            <div v-if="selectedProc.mega" class="d-flex align-center cursor-pointer"
                @click="$try($router.push('/definition-map'))">
                <h6 class="text-h6 font-weight-semibold">{{ selectedProc.mega.label }}</h6>
                <v-icon>mdi-chevron-right</v-icon>
            </div>
            <div v-if="selectedProc.major" class="d-flex align-center cursor-pointer"
                @click="$try($router.push(`/definition-map/mega/${selectedProc.mega.id}`))">
                <h6 class="text-h6 font-weight-semibold">{{ selectedProc.major.label }}</h6>
                <div>
                    <v-icon class="cursor-pointer">mdi-chevron-right</v-icon>
                    <v-menu activator="parent">
                        <v-list v-if="selectedProc.major.sub_proc_list" density="compact" class="cursor-pointer">
                            <v-list-item v-for="sub in selectedProc.major.sub_proc_list" :key="sub.id"
                                @click="goProcess(sub)">
                                <v-list-item-title>
                                    {{ sub.label }}
                                </v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </div>
            </div>
            <div v-if="processDefinition" class="d-flex align-center"
                @click="updateBpmn(processDefinition.bpmn); subProcessBreadCrumb = []">
                <h6 class="text-h6 font-weight-semibold">
                    {{ processDefinition && processDefinition.name ? processDefinition.name : processDefinition.label }}
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
                <v-btn icon variant="text" class="ml-3" :size="24" @click="executeProcess">
                    <Icon icon="carbon:play-outline" width="24" height="24" />
                </v-btn>
                <v-btn icon variant="text" class="ml-3" :size="24" @click="capture">
                    <Icon icon="mage:image-download" width="24" height="24" />
                </v-btn>
            </div>
        </div>

        <v-card-text style="width:100%; height:95%; padding:10px;">
            <ProcessDefinition v-if="bpmn" style="width: 100%; height: 100%;" :bpmn="bpmn" :key="defCnt"
                :processDefinition="processDefinition.definition" :isViewMode="isViewMode"
                v-on:openSubProcess="ele => openSubProcess(ele)"></ProcessDefinition>
            <div v-else-if="!bpmn" style="height: 90%; text-align: center">
                <h6 class="text-h6">정의된 프로세스 모델이 없습니다.</h6>
                <v-btn color="primary" variant="flat" class="mt-4" @click="editProcessModel">
                    프로세스 편집
                </v-btn>
            </div>
        </v-card-text>
        <v-dialog v-model="executeDialog">
            <ProcessExecuteDialog :definitionId="processDefinition.id" @close="executeDialog = false"></ProcessExecuteDialog>
        </v-dialog>
    </v-card>
</template>

<script>
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import ProcessExecuteDialog from '@/components/apps/definition-map/ProcessExecuteDialog.vue';

export default {
    components: {
        ProcessDefinition,
        ProcessExecuteDialog
    },
    props: {
        value: Object,
        storage: Object,
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
    created() {
        let me = this;

        this.viewProcess(this.$route.params);
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
                const defInfo = await this.storage.getObject(`proc_def/${e.extensionElements.values[0].definition}`, { key: "name" });
                if (defInfo) {
                    let obj = { processName: e.extensionElements.values[0].definition, xml: defInfo.bpmn }
                    me.subProcessBreadCrumb.push(obj)
                    me.selectedSubProcess = e.extensionElements.values[0].definition
                    me.updateBpmn(defInfo.bpmn)
                }
            }
        },
        goProcess(obj) {
            this.$router.push(`/definition-map/sub/${obj.id}`);
            this.viewProcess(obj);
        },
        async viewProcess(obj) {
            const def_id = obj.id;

            this.value.mega_proc_list.forEach(mega => {
                mega.major_proc_list.forEach(major => {
                    major.sub_proc_list.forEach(sub => {
                        if (sub.id == def_id) {
                            obj = sub;
                            this.selectedProc.mega = mega;
                            this.selectedProc.major = major;
                        }
                    })
                })
            })

            const defInfo = await this.storage.getObject(`proc_def/${def_id}`, { key: "id" });
            if (defInfo && !defInfo.code) {
                this.processDefinition = defInfo;
                this.bpmn = defInfo.bpmn
            } else {
                this.processDefinition = obj;
                this.bpmn = null;
            }
        },
        editProcessModel() {
            if (this.processDefinition && this.processDefinition.id) {
                this.$router.push(`/definitions/chat?id=${this.processDefinition.id}&name=${this.processDefinition.label}`);
            }
        },
        capture() {
            this.$emit('capture')
        },
        executeProcess() {
            this.executeDialog = true
        }
    },
}
</script>