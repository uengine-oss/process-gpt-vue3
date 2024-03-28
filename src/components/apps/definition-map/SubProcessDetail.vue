<template>
    <v-card elevation="10" style="height:calc(100vh - 200px);">
        <div class="pt-5 pl-6 pr-6 d-flex align-center">
            <div v-if="selectedProc.mega" class="d-flex align-center cursor-pointer"
                @click="$app.try($router.push('/definition-map'))">
                <h6 class="text-h6 font-weight-semibold">{{ selectedProc.mega.label }}</h6>
                <v-icon>mdi-chevron-right</v-icon>
            </div>
            <div v-if="selectedProc.major" class="d-flex align-center"
                @click="$app.try($router.push(`/definition-map/mega/${selectedProc.mega.id}`))">
                <h6 class="text-h6 font-weight-semibold">{{ selectedProc.major.label }}</h6>
                <div>
                    <v-icon class="cursor-pointer">mdi-chevron-right</v-icon>
                    <v-menu activator="parent">
                        <v-list v-if="selectedProc.major.sub_proc_list" density="compact" class="cursor-pointer">
                            <v-list-item v-for="sub in selectedProc.major.sub_proc_list" :key="sub.id">
                                <v-list-item-title @click="goProcess(sub)">
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
                    {{ processDefinition ? processDefinition.name : processDefinition.label }}
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
        </div>

        <v-card-text style="width: 100%; height: 90%">
            <ProcessDefinition v-if="onLoad && bpmn" style="width: 100%; height: 100%;" :bpmn="bpmn" :key="defCnt"
                v-on:openSubProcess="ele => openSubProcess(ele)" :processDefinition="processDefinition.definition"
                :isViewMode="true"></ProcessDefinition>
            <div v-else-if="onLoad && !bpmn" style="height: 90%; text-align: center">
                <h6 class="text-h6">정의된 프로세스 모델이 없습니다.</h6>
                <v-btn color="primary" variant="flat" class="mt-4" @click="editProcessModel">
                    프로세스 편집
                </v-btn>
            </div>
            <div v-else style="height: 100%; text-align: center">
                <v-progress-circular style="top: 40%" indeterminate color="primary"></v-progress-circular>
            </div>
        </v-card-text>
    </v-card>
</template>

<script>
import ProcessDefinition from '@/components/ProcessDefinition.vue';

export default {
    components: {
        ProcessDefinition
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
    }),
    created() {
        let me = this;
        if (!me.$app.try) {
            me.$app = me.$app._component.methods;
        }
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
                console.log(e.extensionElements.values[0].definition)
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
            this.onLoad = false;

            this.value.mega_proc_list.forEach(mega => {
                mega.major_proc_list.forEach(major => {
                    major.sub_proc_list.forEach(sub => {
                        if (sub.id == def_id) {
                            this.selectedProc.mega = mega;
                            this.selectedProc.major = major;
                        }
                    })
                })
            })

            const defInfo = await this.storage.getObject(`proc_def/${def_id}`, { key: "id" });
            if (defInfo) {
                this.processDefinition = defInfo;
                this.bpmn = defInfo.bpmn
                this.onLoad = true;
            } else {
                this.processDefinition = obj;
                this.bpmn = null;
                this.onLoad = true;
            }
        },
        editProcessModel() {
            if (this.processDefinition && this.processDefinition.id) {
                this.$router.push(`/definitions/chat?id=${this.processDefinition.id}&name=${this.processDefinition.label}`);
            }
        },
    },
}
</script>