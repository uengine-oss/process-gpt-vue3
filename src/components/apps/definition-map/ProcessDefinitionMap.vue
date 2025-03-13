<template>
    <div>
        <v-card elevation="10" :style="!$globalState.state.isZoomed ? 'height:calc(100vh - 155px)' : 'height:100vh;'"
            style="overflow: auto;">
            <div v-if="componentName != 'SubProcessDetail'" class="pa-0 pl-6 pt-4 pr-6 d-flex align-center"
                style="position: sticky; top: 0; z-index:2; background-color:white">
                <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                <v-btn v-if="$route.path !== '/definition-map'" style="margin-left: 3px; margin-top: 1px;" icon variant="text" 
                    size="24" @click="goProcessMap">
                    <Icons :icon="'arrow-go-back'" />
                </v-btn>
                
                <!-- buttons -->
                <div class="ml-auto d-flex">
                    <v-tooltip location="bottom" v-if="useLock && !lock && isAdmin && !isViewMode" >
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="ml-3 cp-unlock" @click="openAlertDialog">
                                <LockIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.unlock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="useLock && lock && isAdmin && userName == editUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="cp-lock" @click="openAlertDialog">
                                <LockOpenIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.lock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="useLock && lock && isAdmin && userName != editUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" @click="openAlertDialog">
                                <LockIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.unlock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="!useLock">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" @click="saveProcess()">
                                <Icons :icon="'save'" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.save') }}</span>
                    </v-tooltip>

                    <span v-if="useLock && lock && userName && userName != editUser" class="ml-1">
                        {{ $t('processDefinitionMap.editingUser', {name: editUser}) }}
                    </span>
                    <v-tooltip :text="$t('processDefinitionMap.downloadImage')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" :size="24" class="ml-3" @click="capturePng">
                                <Icons :icon="'image-download'" />
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <!-- 프로세스 정의 체계도 캔버스 확대 축소 버튼 및 아이콘 -->
                    <v-tooltip v-if="componentName != 'SubProcessDetail'" :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="ml-3"
                                @click="$globalState.methods.toggleZoom()" icon variant="text" :size="24">
                                <!-- zoom-out(캔버스 확대), zoom-in(캔버스 축소) -->
                                <Icons :icon="!$globalState.state.isZoomed ? 'zoom-out' : 'zoom-in'"/>
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>
            </div>

            <!-- route path 별 컴포넌트 호출 -->
            <div id="processMap">
                <div v-if="componentName == 'ViewProcessDetails'">
                    <ViewProcessDetails class="pa-5" :value="value" :enableEdit="enableEdit" />
                </div>
                <div v-else-if="componentName == 'SubProcessDetail'">
                    <SubProcessDetail :value="value" @capture="capturePng" :enableEdit="enableEdit" />
                </div>
                <div v-else>
                    <DefinitionMapList :value="value" :enableEdit="enableEdit" @clickProcess="clickProcess" />
                </div>
            </div>

            <v-btn v-if="componentName == 'DefinitionMapList'"
                @click="openConsultingDialog = true, ProcessPreviewMode = false"
                style="margin-left: 20px;" color="primary" rounded
            >
                <Icons :icon="'magic'" :size="18"  style="margin-right: 10px;" />
                {{ $t('processDefinitionMap.consultingButton') }}
            </v-btn>
        </v-card>
        <v-dialog :style="ProcessPreviewMode ? '' : 'max-width: 1000px;'" v-model="openConsultingDialog" persistent>
            <v-card>
                <v-row class="ma-0 pa-3" style="background-color:rgb(var(--v-theme-primary), 0.2); height:50px;">
                    <v-icon small style="margin-right: 10px;">mdi-auto-fix</v-icon>
                    <div>{{ $t('processDefinitionMap.consultingAI') }}</div>
                    <v-spacer></v-spacer>
                    <v-icon @click="closeConsultingDialog()" small style="margin-right: 5px; float: right;">mdi-close</v-icon>
                </v-row>
                <ProcessDefinitionChat 
                    :chatMode="'consulting'"
                    @createdBPMN="createdBPMN"
                    @openProcessPreview="openProcessPreview" 
                />
            </v-card>
        </v-dialog>
        <v-dialog v-model="alertDialog" max-width="500" persistent>
            <v-card>
                <v-card-text class="mt-2 alert-message">
                    {{ alertMessage }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <div v-for="(btn, index) in actionButtons" :key="index">
                        <v-btn v-if="btn.show" 
                            :color="btn.color" 
                            :class="btn.class + (index > 0 ? ' ml-2' : '')" 
                            variant="flat" @click="btn.action" rounded>
                            {{ btn.text }}
                        </v-btn>
                    </div>
                    <v-btn color="error" rounded variant="flat" @click="alertDialog = false" class="ml-2">
                        {{ (userName && userName === editUser) ? $t('processDefinitionMap.close') : $t('processDefinitionMap.cancel') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import domtoimage from 'dom-to-image';
import DefinitionMapList from './DefinitionMapList.vue';
import ProcessMenu from './ProcessMenu.vue';
import SubProcessDetail from './SubProcessDetail.vue';
import ViewProcessDetails from './ViewProcessDetails.vue';
import ProcessDefinitionChat from '@/components/ProcessDefinitionChat.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessMenu,
        ViewProcessDetails,
        SubProcessDetail,
        DefinitionMapList,
        ProcessDefinitionChat
    },
    props: {
        componentName: {
            type: String,
            required: true
        },
        isViewMode: {
            type: Boolean,
            default: false
        }
    },
    data: () => ({
        value: {
            mega_proc_list: []
        },
        type: 'map',
        enableEdit: false,
        userName: null,
        lock: null,
        editUser: null,
        alertType: '',
        alertDialog: false,
        alertMessage: '',
        isAdmin: false,
        versionHistory: [],
        openConsultingDialog: false,
        ProcessPreviewMode: false,
    }),
    computed: {
        useLock() {
            if(window.$mode == "ProcessGPT"){
                return true;
            } else {
                return this.isViewMode;
            }
        },
        actionButtons() {
            return [
                {
                    show: this.alertType === 'checkout',
                    text: this.$t('processDefinitionMap.confirm'),
                    color: 'primary',
                    class: 'cp-check-out',
                    action: this.checkOut   // 잠금 해제
                },
                {
                    show: this.alertType === 'checkin' && this.userName && this.userName === this.editUser,
                    text: this.$t('processDefinitionMap.saveCheckIn'),
                    color: 'success',
                    class: 'cp-check-in',
                    action: () => {
                        this.checkIn();
                        this.saveProcess();
                    }
                },
                {
                    show: this.alertType === 'checkin' && this.userName && this.userName === this.editUser,
                    text: this.$t('processDefinitionMap.cancelCheckIn'),
                    color: 'primary',
                    class: 'cp-check-in',
                    action: async () => {
                        this.checkIn();
                        await this.getProcessMap();
                    }
                },
                {
                    show: this.alertType === 'checkin' && this.userName && this.userName !== this.editUser,
                    text: this.$t('processDefinitionMap.confirm'),
                    color: 'primary',
                    class: 'cp-check-in',
                    action: async () => {
                        await this.getProcessMap();
                        this.checkOut();
                    }
                },
                {
                    show: this.alertType === 'download',
                    text: this.$t('processDefinitionMap.download'),
                    color: 'primary',
                    action: this.download
                }
            ];
        }
    },
    async created() {
        var me = this;
        me.$try({
            action: async () => {
                me.userName = localStorage.getItem("userName");
                const isAdmin = localStorage.getItem("isAdmin");
                if (isAdmin == "true") {
                    me.isAdmin = true;
                }
                await me.getProcessMap();
                if (me.useLock) {
                    await me.checkedLock();
                } else {
                    // uEngine
                    me.editUser = me.userName;
                    me.enableEdit = true;
                }
            },
        });
    },
    beforeRouteLeave(to, from, next) {
        if (this.lock && this.enableEdit) {
            this.openAlertDialog().then((proceed) => {
                if (proceed) {
                    next();
                } else {
                    next(false);
                }
            });
        } else {
            next();
        }
    },
    methods: {
        openProcessPreview(){
            this.ProcessPreviewMode = true
        },
        createdBPMN(res){
            const generateUniqueMegaProcessId = () => {
                function s4() {
                    return Math.floor((1 + Math.random()) * 0x10000)
                        .toString(16)
                        .substring(1);
                }

                return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
            };

            const addSubProcess = async (majorProc) => {
                majorProc.sub_proc_list.push({
                    id: res.processDefinitionId,
                    name: res.processDefinitionName,
                    new: true
                });

                await this.saveProcess();
            };

            if (res.megaProcessId === "") {
                let uncategorizedMegaProc = this.value.mega_proc_list.find(megaProc => megaProc.name === this.$t('processDefinitionMap.uncategorized'));
                if (!uncategorizedMegaProc) {
                    uncategorizedMegaProc = {
                        id: generateUniqueMegaProcessId(),
                        name: this.$t('processDefinitionMap.uncategorized'),
                        major_proc_list: [{
                            id: "0",
                            name: this.$t('processDefinitionMap.uncategorized'),
                            sub_proc_list: []
                        }]
                    };
                    this.value.mega_proc_list.push(uncategorizedMegaProc);
                }

                addSubProcess(uncategorizedMegaProc.major_proc_list[0]);
                return;
            }

            let megaProc = this.value.mega_proc_list.find(megaProc => megaProc.id === res.megaProcessId);
            if (!megaProc) {
                megaProc = {
                    id: res.megaProcessId,
                    name: this.$t('processDefinitionMap.uncategorized'),
                    major_proc_list: []
                };
                this.value.mega_proc_list.push(megaProc);
            }

            let majorProc = megaProc.major_proc_list.find(majorProc => majorProc.id === res.majorProcessId);
            if (!majorProc) {
                majorProc = {
                    id: res.majorProcessId,
                    name: this.$t('processDefinitionMap.uncategorized'),
                    sub_proc_list: []
                };
                megaProc.major_proc_list.push(majorProc);
            }

            addSubProcess(majorProc);
        },
        closeConsultingDialog(){
            let answer
            if(this.ProcessPreviewMode){
                answer = window.confirm(this.$t('processDefinitionMap.closeConsultingInPreview'));
            } else {
                answer = window.confirm(this.$t('processDefinitionMap.closeConsulting'));
            }
            if (answer) {
                this.ProcessPreviewMode = false
                this.openConsultingDialog = false
            } 
        },
        async checkedLock() {
            if (this.isAdmin) {
                this.enableEdit = false;
                const lockObj = await backend.getLock('process-map');
                if (lockObj && lockObj.id && lockObj.user_id) {
                    this.lock = true;
                    this.editUser = lockObj.user_id;
                    if (this.userName == this.editUser) {
                        this.enableEdit = true;
                    }
                } else {
                    this.lock = false;
                }
            }
        },
        capturePng() {
            var node = document.getElementById('processMap');
            domtoimage.toPng(node)
                .then(function (dataUrl) {
                    const link = document.createElement('a');
                    // Set the link's href to the data URL of the PNG image
                    link.href = dataUrl;
                    // Configure the download attribute of the link
                    link.download = 'process_definition_map.png';
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
        goProcessMap() {
            this.$router.push(`/definition-map`);
        },
        async getProcessMap() {
            let map = await backend.getProcessDefinitionMap();

            const role = localStorage.getItem('role');
            if (this.isAdmin && role !== 'user') {
                if (map.mega_proc_list) {
                    map.mega_proc_list.forEach(megaProc => {
                        if(megaProc.major_proc_list){
                            megaProc.major_proc_list.forEach(majorProc => {
                                if(majorProc.sub_proc_list){
                                    majorProc.sub_proc_list.forEach(subProc => {
                                        if (subProc.new) {
                                            subProc.new = false;
                                        }
                                    });
                                }
                            });
                        }
                    });
                    this.value = map;
                } else {
                    this.value = {
                        mega_proc_list: []
                    };
                }
            } else {
                const userId = localStorage.getItem("uid");
                const permissions = await backend.getUserPermissions({ match: { user_id: userId } });
                const processList = permissions.map(permission => permission.proc_def_ids);
                
                if (processList.length > 0) {
                    function removeDuplicates(processList) {
                        const uniqueByIdAndName = (array) => {
                            const seen = new Map();
                            return array.filter(item => {
                                const key = `${item.id}-${item.name}`;
                                if (seen.has(key)) {
                                    // Compare lengths and keep the longer list
                                    const existingItem = seen.get(key);
                                    if (item.major_proc_list && existingItem.major_proc_list) {
                                        existingItem.major_proc_list = item.major_proc_list.length > existingItem.major_proc_list.length ? item.major_proc_list : existingItem.major_proc_list;
                                    }
                                    if (item.sub_proc_list && existingItem.sub_proc_list) {
                                        existingItem.sub_proc_list = item.sub_proc_list.length > existingItem.sub_proc_list.length ? item.sub_proc_list : existingItem.sub_proc_list;
                                    }
                                    return false;
                                }
                                seen.set(key, item);
                                return true;
                            });
                        };

                        processList = uniqueByIdAndName(processList);

                        return processList.map(megaProc => {
                            megaProc.major_proc_list = uniqueByIdAndName(megaProc.major_proc_list.map(majorProc => {
                                majorProc.sub_proc_list = uniqueByIdAndName(majorProc.sub_proc_list);
                                return majorProc;
                            }));
                            return megaProc;
                        });
                    }

                    const uniqueProcessList = removeDuplicates(processList);
                    console.log(uniqueProcessList);
                    this.value = {
                        mega_proc_list: uniqueProcessList
                    }
                } else {
                    this.value = {
                        mega_proc_list: []
                    }
                }
            }
        },
        addProcess(newProcess) {
            this.value.mega_proc_list.push({
                id: newProcess.id,
                name: newProcess.name,
                major_proc_list: [],
            });
        },
        async saveProcess() {
            await backend.putProcessDefinitionMap(this.value);
            await this.getProcessMap();
            this.closeAlertDialog();
        },
        async checkIn() {
            const isConnected = await backend.checkDBConnection();
            if (!isConnected) {
                this.alertDialog = true;
                this.alertMessage = this.$t('processDefinitionMap.checkInDBError');
                this.alertType = 'download';
            } else {
                this.lock = false;
                this.enableEdit = false;
                if (this.useLock) {
                    await backend.deleteLock('process-map');
                }
                this.closeAlertDialog();
            }
        },
        async checkOut() {
            const isConnected = await backend.checkDBConnection();
            if (!isConnected) {
                alert(this.$t('processDefinitionMap.checkOutDBError'));
            } else {
                this.lock = true;
                this.enableEdit = true;
                if (this.useLock && this.userName && this.userName != undefined) {
                    this.editUser = this.userName;
                    let lockObj = {
                        id: 'process-map',
                        user_id: this.editUser,
                    }
                    await backend.setLock(lockObj);
                }
            }
            this.closeAlertDialog();
        },
        download() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.value));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "process-map.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            this.closeAlertDialog();
        },
        async openAlertDialog() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    if (this.isAdmin) {

                        if(me.useLock){
                            // GPT 모드인 경우
                            const lockObj = await backend.getLock('process-map');
                            if (lockObj && lockObj.id && lockObj.user_id) {
                                me.lock = true;
                                me.editUser = lockObj.user_id;
                                if (me.editUser == me.userName) {
                                    me.alertDialog = true;
                                    me.alertMessage = this.$t('processDefinitionMap.checkInMessage');
                                } else {
                                    me.alertDialog = true;
                                    me.alertMessage = this.$t('processDefinitionMap.forcedCheckOutMessage', {name: me.editUser});
                                    me.enableEdit = false;
                                }
                                me.alertType = 'checkin';
                                // 사용자의 응답을 기다림
                                me.$nextTick(() => {
                                    // 다이얼로그가 활성화된 후, 사용자의 응답을 처리
                                    const confirmButton = document.getElementById('confirmButton'); // 확인 버튼의 ID
                                    const cancelButton = document.getElementById('cancelButton'); // 취소 버튼의 ID
                                    confirmButton.onclick = () => resolve(true);
                                    cancelButton.onclick = () => resolve(false);
                                });
                            } else {
                                me.lock = false;
                                me.enableEdit = false;
                                me.alertDialog = true;
                                me.alertMessage = this.$t('processDefinitionMap.checkOutMessage');
                                me.alertType = 'checkout';
                                // 사용자의 응답을 기다림
                                me.$nextTick(() => {
                                    const confirmButton = document.getElementById('confirmButton');
                                    const cancelButton = document.getElementById('cancelButton');
                                    confirmButton.onclick = () => resolve(true);
                                    cancelButton.onclick = () => resolve(false);
                                });
                            }
                        } else {
                            // Uegnine 모드인 경우
                            me.lock = false;
                        }                        
                    }
                }
            });
        },
        closeAlertDialog() {
            this.alertDialog = false;
            this.alertType = '';
            this.alertMessage = '';
        },
        clickProcess(id) {
            this.$emit('clickProcess', id);
        }
    },
}
</script>

<style scoped>
.alert-message {
    white-space: pre-line;
}
</style>