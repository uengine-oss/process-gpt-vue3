<template>
    <div>
        <v-card elevation="10" :style="!$globalState.state.isZoomed ? 'height:calc(100vh - 155px)' : 'height:100vh;'"
            style="overflow: auto;">
            <div v-if="componentName != 'SubProcessDetail'" class="pa-3 d-flex align-center"
                style="position: sticky; top: 0; z-index:2; background-color:white">
                <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                <v-btn v-if="$route.path !== '/definition-map'" style="margin-left: 3px; margin-top: 1px;" icon variant="text" size="24">
                    <Icon @click="goProcessMap" icon="humbleicons:arrow-go-back" width="24" height="24" />
                </v-btn>
                
                <!-- buttons -->
                <div class="ml-auto d-flex">
                    <v-tooltip location="bottom" v-if="!lock && isAdmin" >
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="ml-3 cp-unlock" @click="openAlertDialog">
                                <LockIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.unlock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="lock && isAdmin && userName == editUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="cp-lock" @click="openAlertDialog">
                                <LockOpenIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.lock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="lock && isAdmin && userName != editUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="cp-lock" @click="openAlertDialog">
                                <LockIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.lock') }}</span>
                    </v-tooltip>

                    <span v-if="lock && userName && userName != editUser" class="text-body-1 pt-1 mr-1">
                        {{ editUser }} 님이 수정 중 입니다.
                    </span>

                    <v-btn icon variant="text" class="ml-3" :size="24" @click="capturePng">
                        <Icon icon="mage:image-download" width="24" height="24" />
                    </v-btn>

                    <!-- 프로세스 정의 체계도 캔버스 확대 축소 버튼 및 아이콘 -->
                    <v-tooltip v-if="componentName != 'SubProcessDetail'" :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="ml-3 processVariables-zoom"
                                @click="$globalState.methods.toggleZoom()" icon variant="text" :size="24">
                                <!-- 캔버스 확대 -->
                                <Icon v-if="!$globalState.state.isZoomed" icon="material-symbols:zoom-out-map-rounded"
                                    width="24" height="24" />
                                <!-- 캔버스 축소 -->
                                <Icon v-else icon="material-symbols:zoom-in-map-rounded" width="24" height="24" />
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
                    <DefinitionMapList :value="value" :enableEdit="enableEdit" />
                </div>
            </div>
        </v-card>
        <v-dialog v-model="alertDialog" max-width="500" persistent>
            <v-card>
                <v-card-text class="mt-2">
                    {{ alertMessage }}
                </v-card-text>
                <v-card-actions class="justify-center">
                    <v-btn v-if="alertType =='checkout'" color="primary" class="cp-check-out" variant="flat"
                        @click="checkOut">확인</v-btn>
                    <v-btn v-else-if="alertType =='checkin' && userName && userName == editUser " color="primary"
                        class="cp-check-in" variant="flat" @click="checkIn">확인</v-btn>
                    <v-btn v-else-if="alertType =='checkin' && userName && userName != editUser " color="primary"
                        class="cp-check-in" variant="flat" @click="checkOut">체크인</v-btn>
                    <v-btn v-if="userName && userName == editUser" color="error" variant="flat"
                        @click="alertDialog=false">닫기</v-btn>
                    <v-btn v-else color="error" variant="flat" @click="alertDialog=false">취소</v-btn>
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

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    components: {
        ProcessMenu,
        ViewProcessDetails,
        SubProcessDetail,
        DefinitionMapList
    },
    props: {
        componentName: {
            type: String,
            required: true
        },
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
    }),
    computed: {
        useLock() {
            if (window.$mode == "ProcessGPT") {
                return true;
            } else {
                return false;
            }
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
                }
            },
        });
    },
    methods: {
        async checkedLock() {
            if (this.isAdmin) {
                this.enableEdit = false;
                this.storage = StorageBaseFactory.getStorage();
                const lockObj = await this.storage.getObject('lock/process-map', { key: 'id' });
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
            this.value = map;
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
            await backend.putProcessDefinitionMap(this.value);
            
            this.closeAlertDialog();
        },
        async checkIn() {
            this.lock = false;
            this.enableEdit = false;
            if (this.userName == this.editUser) {
                await this.saveProcess();
            }
            if (this.useLock) {
                await this.storage.delete('lock/process-map', { key: 'id' });
            }
            this.closeAlertDialog();
        },
        async checkOut() {
            this.lock = true;
            this.enableEdit = true;
            this.closeAlertDialog();
            if (this.useLock) {
                this.editUser = this.userName;
                let lockObj = {
                    id: 'process-map',
                    user_id: this.editUser,
                }
                await this.storage.putObject('lock', lockObj);
            }
        },
        async openAlertDialog() {
            if (this.isAdmin) {
                this.storage = StorageBaseFactory.getStorage();
                const lockObj = await this.storage.getObject('lock/process-map', { key: 'id' });
                if (lockObj && lockObj.id && lockObj.user_id) {
                    this.lock = true;
                    this.editUser = lockObj.user_id;
                    if (this.editUser == this.userName) {
                        this.alertDialog = true;
                        this.alertMessage = '수정된 내용을 저장 및 체크인 하시겠습니까?';
                    } else {
                        this.alertDialog = true;
                        this.alertMessage = `현재 ${this.editUser} 님께서 수정 중입니다. 체크인 하는 경우 ${this.editUser} 님이 수정한 내용은 손상되어 저장되지 않습니다. 체크인 하시겠습니까?`;
                        this.enableEdit = false;
                    }
                    this.alertType = 'checkin';
                } else {
                    this.lock = false;
                    this.enableEdit = false;
                    this.alertDialog = true;
                    this.alertMessage = `프로세스 정의 체계도를 수정하시겠습니까?`;
                    this.alertType = 'checkout';
                }
            }
        },
        closeAlertDialog() {
            this.alertDialog = false;
            this.alertType = '';
            this.alertMessage = '';
        },
    },
}
</script>