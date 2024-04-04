<template>
    <div>
        <v-card elevation="10" :style="!$globalState.state.isZoomed ? 'height:calc(100vh - 155px)' :'height:100vh;'"
            style="overflow: auto;"
        >
            <div v-if="componentName != 'SubProcessDetail'" class="pa-3 d-flex align-center" style="position: sticky; top: 0; z-index:2; background-color:white">
                <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                
                <!-- buttons -->
                <div class="ml-auto d-flex">
                    <span v-if="lock && userInfo.email && userInfo.email != editUser" class="text-body-1 pt-1 mr-1">
                        {{ editUser }} 님이 수정 중 입니다.
                    </span>
                    <v-btn v-if="!lock && isAdmin" 
                        icon variant="text" size="24"
                        class="ml-3 cp-unlock"
                        @click="openAlertDialog('checkout')"
                        @mouseenter="hover = true"
                        @mouseleave="hover = false"
                    >
                        <LockIcon width="24" height="24" />
                    </v-btn>
                    
                    <v-btn v-if="lock && isAdmin"
                        icon variant="text" size="24"
                        class="cp-lock"
                        @click="openAlertDialog('checkin')"
                        @mouseenter="hover = true"
                        @mouseleave="hover = false"
                    >
                        <LockOpenIcon width="24" height="24" />
                    </v-btn>

                    <v-btn icon variant="text" class="ml-3" :size="24" @click="capturePng">
                        <Icon icon="mage:image-download" width="24" height="24" />
                    </v-btn>

                    <!-- <ProcessMenu
                        class="ml-3 cp-add-process"
                        :size="24" 
                        :type="type" 
                        :enableEdit="enableEdit"
                        :process="value"
                        :storage="storage"
                        @add="addProcess"
                    /> -->
                    
                    <!-- 프로세스 정의 체계도 캔버스 확대 축소 버튼 및 아이콘 -->
                    <v-tooltip v-if="!isViewMode" :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="ml-3 processVariables-zoom"
                                @click="$globalState.methods.toggleZoom()"
                                icon variant="text" :size="24"    
                            >
                                <!-- 캔버스 확대 -->
                                <Icon v-if="!$globalState.state.isZoomed" icon="material-symbols:zoom-out-map-rounded"
                                    width="24" height="24"
                                />
                                <!-- 캔버스 축소 -->
                                <Icon v-else icon="material-symbols:zoom-in-map-rounded"
                                    width="24" height="24"
                                />
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <!-- <v-btn v-if="componentName != 'DefinitionMapList'"
                        icon variant="text" 
                        class="ml-3"
                        size="24"
                        @click="goProcessMap">
                        <v-icon size="24">mdi-arrow-left</v-icon>
                    </v-btn> -->
                </div>
            </div>
            
            <!-- route path 별 컴포넌트 호출 -->
            <div v-if="componentName == 'ViewProcessDetails'">
                <ViewProcessDetails
                    class="pa-5"
                    :parent="value"
                    :storage="storage"
                    :enableEdit="enableEdit"
                />
            </div>
            <div v-else-if="componentName == 'SubProcessDetail'">
                <SubProcessDetail
                    :value="value"
                    :storage="storage"
                    @capture="capturePng"
                />
            </div>
            <div v-else>
                <DefinitionMapList
                    :value="value"
                    :storage="storage"
                    :enableEdit="enableEdit"
                    :userInfo="userInfo"
                />
            </div>
        </v-card>
        <v-dialog v-model="alertDialog" max-width="500" persistent>
            <v-card>
                <v-card-text class="mt-2">
                    {{ alertMessage }}
                </v-card-text>
                <v-card-actions class="justify-center">
                    <v-btn v-if="alertType =='checkout'" 
                        color="primary" 
                        class="cp-check-out"
                        variant="flat" 
                        @click="checkOut"
                    >확인</v-btn>
                    <v-btn v-else-if="alertType =='checkin'" 
                        color="primary"
                        class="cp-check-in" 
                        variant="flat" 
                        @click="checkIn"
                    >확인</v-btn>
                    <v-btn color="error" 
                    variant="flat" 
                    @click="alertDialog=false"
                    >닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-overlay v-model="overlay">
            <div class="d-flex justify-center align-center" 
                style="min-width: 100vw; min-height: 100vh;">
                <v-progress-circular
                    color="primary"
                    indeterminate
                    :size="50"
                ></v-progress-circular>
            </div>
        </v-overlay>
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import ProcessMenu from './ProcessMenu.vue';
import ViewProcessDetails from './ViewProcessDetails.vue'
import SubProcessDetail from './SubProcessDetail.vue'
import DefinitionMapList from './DefinitionMapList.vue'
import domtoimage from 'dom-to-image';

const storageKey = 'configuration'

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
        userInfo: {},
        lock: null,
        editUser: null,
        alertType: '',
        alertDialog: false,
        alertMessage: '',
        overlay: false,
        isAdmin: false,
    }),
    async created() {
        var me = this;
        if (!me.$app.try) {
            me.$app = me.$app._component.methods;
        }
        this.$app.try({
            action: async () => {
                this.overlay = true;
                this.storage = StorageBaseFactory.getStorage();
                await this.getProcessMap();
                await this.init();
                this.overlay = false;
            },
        });
    },
    methods: {
        async init() {
            this.userInfo = await this.storage.getUserInfo();
            const isAdmin = localStorage.getItem("isAdmin");
            if (isAdmin == "true") {
                this.isAdmin = true;
                this.enableEdit = false;
                const lockObj =  await this.storage.getObject('lock/process-map', {key: 'id'});
                if (lockObj && lockObj.id && lockObj.user_id) {
                    this.lock = true;
                    this.editUser = lockObj.user_id;
                    if (this.userInfo.email == this.editUser) {
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
            const procMap = await this.storage.getObject(storageKey + '/proc_map', {key: 'key'});
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
            this.closeAlertDialog();
        },
        async checkIn() {
            this.lock = false;
            this.enableEdit = false;
            await this.saveProcess();
            await this.storage.delete('lock/process-map', {key: 'id'});
            this.closeAlertDialog();
        },
        async checkOut() {
            this.lock = true;
            this.enableEdit = true;
            this.editUser = this.userInfo.email;
            this.closeAlertDialog();
            let lockObj = {
                id: 'process-map',
                user_id: this.editUser,
            }
            await this.storage.putObject('lock', lockObj);
        },
        openAlertDialog(type) {
            this.alertType = type;
            const isAdmin = localStorage.getItem("isAdmin");
            if (isAdmin == "true") {
                if (type == 'checkin') {
                    if (this.editUser == this.userInfo.email) {
                        this.alertDialog = true;
                        this.alertMessage = '수정된 내용을 저장 및 체크인 하시겠습니까?';
                    } else {
                        this.alertDialog = true;
                        this.alertMessage = `현재 ${this.editUser} 님께서 수정 중입니다. 체크인 하는 경우 ${this.editUser} 님이 수정한 내용은 저장되지 않습니다. 체크인 하시겠습니까?`;
                    }
                } else if (type == 'checkout') {
                    this.alertDialog = true;
                    this.alertMessage = `프로세스 정의 체계도를 수정하시겠습니까?`;                    
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