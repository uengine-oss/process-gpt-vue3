<template>
    <div>
        <v-card elevation="10" style="height:calc(100vh - 155px); overflow: auto;">
            <div class="pt-5 pl-6 pr-6 d-flex align-center">
                <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                <!-- buttons -->
                <div class="ml-auto d-flex">
                    <span v-if="lock && userInfo.email && userInfo.email != editUser" class="pt-1">
                        {{ editUser }} 님이 수정 중 입니다.
                    </span>
                    <span v-else-if="lock && userInfo.email && userInfo.email == editUser" class="pt-1">
                        수정 중...
                    </span>
                    <v-btn v-if="lock && enableEdit" icon variant="text" size="24"
                        class="ml-3"
                        @click="openAlertDialog('checkout')"
                        @mouseenter="hover = true"
                        @mouseleave="hover = false"
                    >
                        <LockOpenIcon v-if="hover" width="24" height="24" />
                        <LockIcon v-else width="24" height="24" />
                    </v-btn>
                    <v-btn v-if="!lock && enableEdit"
                        icon variant="text" size="24"
                        @click="openAlertDialog('checkin')"
                        @mouseenter="hover = true"
                        @mouseleave="hover = false"
                    >
                        <LockIcon v-if="hover" width="24" height="24" />
                        <LockOpenIcon v-else width="24" height="24" />
                    </v-btn>
                    <ProcessMenu
                        class="ml-3"
                        :size="24" 
                        :type="type" 
                        :enableEdit="lock"
                        @add="addProcess" 
                    />
                </div>
            </div>
            <div class="pa-5">
                <draggable v-if="lock"
                    class="v-row dragArea list-group" 
                    :list="value.mega_proc_list" 
                    :animation="200" 
                    ghost-class="ghost-card"
                    group="megaProcess"
                >
                    <transition-group>
                        <v-col v-for="item in value.mega_proc_list"
                            :key="item.id" 
                            class="cursor-pointer"
                            cols="12" md="2" sm="6"
                        >
                            <MegaProcess 
                                :value="item" 
                                :parent="value" 
                                :storage="storage" 
                                :enableEdit="lock"
                                @view="goProcess"
                            />
                        </v-col>
                    </transition-group>
                </draggable>
                <v-row v-else>
                    <v-col v-for="item in value.mega_proc_list" :key="item.id" cols="12" md="2" sm="6">
                        <MegaProcess :value="item" :parent="value" :storage="storage" @view="goProcess" />
                    </v-col>
                </v-row>
            </div>
        </v-card>
        <v-dialog v-model="alertDialog" max-width="500">
            <v-card>
                <v-card-text class="mt-2">
                    {{ alertMessage }}
                </v-card-text>
                <v-card-actions class="justify-center">
                    <v-btn v-if="alertType =='checkout'" 
                        color="primary" 
                        variant="flat" 
                        @click="checkOut"
                    >확인</v-btn>
                    <v-btn v-else-if="alertType =='checkin'" 
                        color="primary" 
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
    </div>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import MegaProcess from './MegaProcess.vue';
import ProcessMenu from './ProcessMenu.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';

const storageKey = 'configuration'

export default {
    components: {
        ProcessMenu,
        MegaProcess,
        ProcessDefinition
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
        hover: false,
    }),
    async created() {
        var me = this;
        if (!me.$app.try) {
            me.$app = me.$app._component.methods;
        }
        this.storage = StorageBaseFactory.getStorage();
        await this.init();
    },
    methods: {
        async init() {
            this.getProcessMap();
            this.userInfo = await this.storage.getUserInfo();
            const isAdmin = localStorage.getItem("isAdmin");
            if (isAdmin == "true") {
                const lockObj =  await this.storage.getObject('lock/process-map', {key: 'id'});
                if (lockObj && lockObj.id && lockObj.user_id) {
                    this.lock = true;
                    this.editUser = lockObj.user_id;
                    if (this.editUser == this.userInfo.email) {
                        this.enableEdit = true;
                    }
                } else {
                    this.lock = false;
                    this.enableEdit = true;
                }
            }
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
        async goProcess(obj) {
            this.$router.push(`/definition-map/sub/${obj.id}`);
        },
        checkIn() {
            if (this.alertDialog) {
                this.closeAlertDialog();
            }
            this.$app.try({
                action: async () => {
                    this.lock = true;
                    this.editUser = this.userInfo.email;
                    let lockObj = {
                        id: 'process-map',
                        user_id: this.editUser,
                    }
                    await this.storage.putObject('lock', lockObj);
                },
                successMsg: '체크인 되었습니다.'
            });
        },
        checkOut() {
            if (this.alertDialog) {
                this.closeAlertDialog();
            }
            this.$app.try({
                action: async () => {
                    this.lock = false;
                    await this.storage.delete('lock/process-map', {key: 'id'});
                    this.saveProcess();
                },
                successMsg: '저장 및 체크아웃 되었습니다.'
            });
        },
        openAlertDialog(type) {
            this.alertType = type;
            const isAdmin = localStorage.getItem("isAdmin");
            if (isAdmin == "true") {
                if (type == 'checkout') {
                    if (this.editUser == this.userInfo.email) {
                        this.alertDialog = true;
                        this.alertMessage = '수정된 내용을 저장 및 체크아웃 하시겠습니까?';
                    } else {
                        this.alertDialog = true;
                        this.alertMessage = `현재 ${this.editUser} 님께서 수정 중입니다. 체크아웃을 하는 경우 ${this.editUser} 님이 수정한 내용은 저장되지 않습니다. 체크아웃 하시겠습니까?`;
                    }
                } else if (type == 'checkin') {
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