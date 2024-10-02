<template>
    <div>
        <v-card elevation="10" :style="!$globalState.state.isZoomed ? 'height:calc(100vh - 155px)' : 'height:100vh;'"
            style="overflow: auto;">
            <div v-if="componentName != 'SubProcessDetail'" class="pa-3 d-flex align-center"
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
                        <span>{{ $t('processDefinitionMap.lock') }}</span>
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
                        {{ editUser }} 님이 수정 중 입니다.
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
                <Icons :icon="'magic'" :size="18"  style="margin-right: 10px;" />프로세스 컨설팅 시작하기
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
                    :mode="'consulting'"
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
                <v-card-actions class="justify-center">
                    <div v-for="(btn, index) in actionButtons" :key="index">
                        <v-btn v-if="btn.show" :color="btn.color" :class="btn.class + (index > 0 ? ' ml-2' : '')" 
                            variant="flat" @click="btn.action">
                            {{ btn.text }}
                        </v-btn>
                    </div>
                    <v-btn color="error" variant="flat" @click="alertDialog = false" class="ml-2">
                        {{ (userName && userName === editUser) ? '닫기' : '취소' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
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
        storage: null,
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
                    text: '확인',
                    color: 'primary',
                    class: 'cp-check-out',
                    action: this.checkOut   // 잠금 해제
                },
                {
                    show: this.alertType === 'checkin' && this.userName && this.userName === this.editUser,
                    text: '저장 후 체크인',
                    color: 'success',
                    class: 'cp-check-in',
                    action: () => {
                        this.checkIn();
                        this.saveProcess();
                    }
                },
                {
                    show: this.alertType === 'checkin' && this.userName && this.userName === this.editUser,
                    text: '취소 후 체크인',
                    color: 'primary',
                    class: 'cp-check-in',
                    action: async () => {
                        this.checkIn();
                        await this.getProcessMap();
                    }
                },
                {
                    show: this.alertType === 'checkin' && this.userName && this.userName !== this.editUser,
                    text: '체크인',
                    color: 'primary',
                    class: 'cp-check-in',
                    action: async () => {
                        await this.getProcessMap();
                        this.checkOut();
                    }
                },
                {
                    show: this.alertType === 'download',
                    text: '다운로드',
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
                let uncategorizedMegaProc = this.value.mega_proc_list.find(megaProc => megaProc.name === '미분류');
                if (!uncategorizedMegaProc) {
                    uncategorizedMegaProc = {
                        id: generateUniqueMegaProcessId(),
                        name: '미분류',
                        major_proc_list: [{
                            id: "0",
                            name: "미분류",
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
                    name: '미분류',
                    major_proc_list: []
                };
                this.value.mega_proc_list.push(megaProc);
            }

            let majorProc = megaProc.major_proc_list.find(majorProc => majorProc.id === res.majorProcessId);
            if (!majorProc) {
                majorProc = {
                    id: res.majorProcessId,
                    name: '미분류',
                    sub_proc_list: []
                };
                megaProc.major_proc_list.push(majorProc);
            }

            addSubProcess(majorProc);
        },
        closeConsultingDialog(){
            let answer
            if(this.ProcessPreviewMode){
                answer = window.confirm('저장하지 않은 정보는 모두 유실됩니다.\n저장하시려면 우측 자물쇠 버튼을 클릭하여 저장하실 수 있습니다.\n\n컨설팅을 종료하시겠습니까?');
            } else {
                answer = window.confirm('저장하지 않은 정보는 모두 유실됩니다. 컨설팅을 종료하시겠습니까?');
            }
            if (answer) {
                this.ProcessPreviewMode = false
                this.openConsultingDialog = false
            } 
        },
        async checkedLock() {
            if (this.isAdmin) {
                this.enableEdit = false;
                this.storage = StorageBaseFactory.getStorage();
                const lockObj = await this.storage.getObject('lock', { match: { id: 'process-map' } });
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
        goProcessMap() {
            this.$router.push(`/definition-map`);
        },
        async getProcessMap() {
            let map = await backend.getProcessDefinitionMap();
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
                this.alertMessage = "현재 DB 연결이 끊어졌습니다. 수정된 데이터를 다운로드하여 저장하고 관리자에게 문의주세요.";
                this.alertType = 'download';
            } else {
                this.lock = false;
                this.enableEdit = false;
                if (this.useLock) {
                    await this.storage.delete('lock/process-map', { key: 'id' });
                }
                this.closeAlertDialog();
            }
        },
        async checkOut() {
            const isConnected = await backend.checkDBConnection();
            if (!isConnected) {
                alert('DB 연결이 끊어졌습니다. 관리자에게 문의해주세요.');
            } else {
                this.lock = true;
                this.enableEdit = true;
                if (this.useLock && this.userName && this.userName != undefined) {
                    this.editUser = this.userName;
                    let lockObj = {
                        id: 'process-map',
                        user_id: this.editUser,
                    }
                    await this.storage.putObject('lock', lockObj);
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
                            me.storage = StorageBaseFactory.getStorage();
                            const lockObj = await me.storage.getObject('lock/process-map', { key: 'id' });
                            if (lockObj && lockObj.id && lockObj.user_id) {
                                me.lock = true;
                                me.editUser = lockObj.user_id;
                                if (me.editUser == me.userName) {
                                    me.alertDialog = true;
                                    me.alertMessage = '수정된 내용을 저장 혹은 체크인 하시겠습니까? \n' + 
                                    '(※ 취소 후 체크인을 진행하는 경우 수정된 내용은 저장되지 않습니다.)';
                                } else {
                                    me.alertDialog = true;
                                    me.alertMessage = `현재 "${me.editUser}" 님께서 수정 중입니다. \n` + 
                                    `(※ 체크인을 진행하는 경우 "${me.editUser}" 님이 수정한 내용은 손상되어 저장되지 않습니다.) \n` +
                                    `체크인 하시겠습니까?`;
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
                                me.alertMessage = `프로세스 정의 체계도를 수정하시겠습니까?`;
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