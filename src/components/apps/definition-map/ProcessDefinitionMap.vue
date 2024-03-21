<template>
    <div>
        <v-card elevation="10" style="height:calc(100vh - 155px); overflow: auto;">
            <div class="d-flex">
                <div class="ma-2 pa-2 me-auto">
                    <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                </div>
                <div class="ma-2 pa-2">
                    <v-btn :size="24" @click="capturePng">
                        <Icon icon="iconoir:screenshot" width="24" height="24" />
                    </v-btn>
                </div>
                <div class="ma-2 pa-2">
                    <ProcessMenu :size="24" :type="type" :isViewDetails="currentRouteId !== null" @add="addProcess" />
                </div>
            </div>
            <!-- 스위칭 필요 1 -->
            <div v-if="!currentRouteId" id="processMap" class="pa-5">
                <draggable v-if="enableEdit"
                    class="v-row dragArea list-group" 
                    :list="value.mega_proc_list" 
                    :animation="200" 
                    ghost-class="ghost-card"
                    group="megaProcess"
                >
                    <transition-group>
                        <v-col v-for="item in value.mega_proc_list" :key="item.id" class="cursor-pointer" cols="12"
                            md="2" sm="6">
                            <MegaProcess :value="item" :parent="value" :storage="storage" @view="goProcess" />
                        </v-col>
                    </transition-group>
                </draggable>
                <v-row v-else>
                    <v-col v-for="item in value.mega_proc_list" :key="item.id" cols="12" md="2" sm="6">
                        <MegaProcess :value="item" :parent="value" :storage="storage" @view="goProcess" />
                    </v-col>
                </v-row>
            </div>
            <!-- 스위칭 필요2 -->
            <router-view v-else>
                <ViewProcessDetails
                    class="pa-5"
                    :parent="value" 
                    :storage="storage" 
                />
            </router-view>
        </v-card>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import MegaProcess from './MegaProcess.vue';
import ProcessMenu from './ProcessMenu.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import ViewProcessDetails from './ViewProcessDetails.vue'
import domtoimage from 'dom-to-image';

const storageKey = 'configuration'

export default {
    components: {
        ProcessMenu,
        MegaProcess,
        ProcessDefinition,
        ViewProcessDetails
    },
    data: () => ({
        storage: null,
        value: {
            mega_proc_list: []
        },
        type: 'map',
        enableEdit: false,
        currentRouteId: null,
    }),
    watch: {
        //TODO: 변경 후 즉시 저장하면 안됩니다. 검토 완료 후 저장되어야 해서 저장 버튼으로 대체
        value: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    this.saveProcess()
                }
            }
        },
        '$route'(to) {
            // 라우트가 변경될 때마다 currentRouteId 상태 업데이트
            this.currentRouteId = to.params.id || null;
        }
    },
    created() {
        this.storage = StorageBaseFactory.getStorage();
        this.getProcessMap();

        const isAdmin = localStorage.getItem("isAdmin");
        if (isAdmin == "true") {
            this.enableEdit = true;
        } else {
            this.enableEdit = false;
        }
    },
    methods: {
        capturePng() {
            var node = document.getElementById('processMap');
            domtoimage.toPng(node)
                .then(function (dataUrl) {
                    const link = document.createElement('a');
                    // Set the link's href to the data URL of the PNG image
                    link.href = dataUrl;
                    // Configure the download attribute of the link
                    link.download = 'processMap.png';
                    // Append the link to the body
                    document.body.appendChild(link);
                    // Trigger the download by simulating a click on the link
                    link.click();
                    // Remove the link from the body
                    document.body.removeChild(link);
                })
                .catch(function (error) {
                    console.error('oops, something went wrong!', error);
                });
        },
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
        async getProcessMap() {
            const procMap = await this.storage.getObject(storageKey + '/proc_map', { key: 'key' });
            if (procMap && procMap.value) {
                this.value = procMap.value;
            }
        },
        addProcess(newProcess) {
            var newMegaProc = {
                id: newProcess.id,
                label: newProcess.label,
                major_proc_list: [],
            };
            this.value.mega_proc_list.push(newMegaProc);
        },
        async saveProcess() {
            const putObj = {
                key: 'proc_map',
                value: this.value
            }
            await this.storage.putObject(storageKey, putObj);
        },
        async goProcess(obj) {
            this.$router.push(`/definition-map/sub/${obj.id}`);
        },
    },
}
</script>