<template>
    <v-row class="justify-center ma-0 pa-0">
        <!--Account Settings tabs-->
        <v-col cols="12" md="12" class="pa-0">
            <v-card elevation="10" 
                class="is-work-height"
            >
                <!-- 데스크톱: 기존 탭 -->
                <div v-if="!isMobile">
                    <v-tabs v-model="tab" bg-color="transparent" min-height="70" height="70" color="default">
                        <v-tab value="Account"> <UserCircleIcon class="mr-2" size="20" />{{ $t('accountTab.accountSetting') }} </v-tab>
                        <div v-if="admin">
                            <v-tab v-if="superAdmin" value="ManageAccess"> <UsersIcon class="mr-2" size="20" />{{ $t('accountTab.manageAccess') }} </v-tab>
                            <v-tab v-if="superAdmin" value="Drive"> <BrandGoogleDriveIcon class="mr-2" size="20" />{{ $t('accountTab.drive') }} </v-tab>
                            <v-tab value="MCP-Servers"> MCP - Servers </v-tab>
                            <v-tab value="MCP-Environments"> MCP - Environments </v-tab>
                            <v-tab value="ConnectionInfo">
                                <DatabaseIcon class="mr-2" size="20" />{{ $t('accountTab.connectionInfo') }}
                            </v-tab>
                            <v-tab v-if="superAdmin" @click="goToTenantManage">
                                <UserCircleIcon class="mr-2" size="20" />{{ $t('accountTab.tenantManage') }}
                            </v-tab>
                        </div>
                        <!-- <v-tab value="Notification"  class=""><BellIcon class="mr-2" size="20"/>Notification</v-tab> -->
                        <!-- <v-tab value="Bills"  class=""><ArticleIcon class="mr-2" size="20"/>Bills</v-tab> -->
                        <!-- <v-tab value="Security"  class=""><LockIcon class="mr-2" size="20"/>Security</v-tab> -->
                    </v-tabs>
                </div>

                <!-- 모바일: 버튼 형태 -->
                <div v-else class="pa-2">
                    <div class="d-flex flex-wrap ga-2">
                        <v-btn
                            variant="text"
                            color="default"
                            size="small"
                            @click="tab = 'Account'"
                            :class="{ 'selected-tab': tab === 'Account' }"
                        >
                            <UserCircleIcon class="mr-2" size="16" />{{ $t('accountTab.accountSetting') }}
                        </v-btn>

                        <template v-if="admin">
                            <v-btn
                                v-if="superAdmin"
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'ManageAccess'"
                                :class="{ 'selected-tab': tab === 'ManageAccess' }"
                            >
                                <UsersIcon class="mr-2" size="16" />{{ $t('accountTab.manageAccess') }}
                            </v-btn>

                            <v-btn
                                v-if="superAdmin"
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'Drive'"
                                :class="{ 'selected-tab': tab === 'Drive' }"
                            >
                                <BrandGoogleDriveIcon class="mr-2" size="16" />{{ $t('accountTab.drive') }}
                            </v-btn>

                            <v-btn
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'MCP-Servers'"
                                :class="{ 'selected-tab': tab === 'MCP-Servers' }"
                            >
                                MCP - Servers
                            </v-btn>
                            <v-btn
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'MCP-Environments'"
                                :class="{ 'selected-tab': tab === 'MCP-Environments' }"
                            >
                                MCP - Environments
                            </v-btn>
                            <v-btn
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'ConnectionInfo'"
                                :class="{ 'selected-tab': tab === 'ConnectionInfo' }"
                            >
                                <DatabaseIcon class="mr-2" size="16" />{{ $t('accountTab.connectionInfo') }}
                            </v-btn>

                            <v-btn
                                variant="text"
                                color="default"
                                size="small"
                                @click="goToTenantManage"
                            >
                                <UserCircleIcon class="mr-2" size="16" />{{ $t('accountTab.tenantManage') }}
                            </v-btn>
                        </template>
                    </div>
                </div>

                <v-divider></v-divider>
                <v-card-text class="pa-0">
                    <v-window v-model="tab">
                        <v-window-item value="Account">
                            <div 
                                style="overflow: auto;"
                                :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'"
                            >
                                <AccountTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="ManageAccess">
                            <div 
                                style="overflow: auto;"
                                :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'"
                            >
                                <ManageAccessTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="Drive">
                            <div 
                                style="overflow: auto;"
                                :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'"
                            >
                                <DriveTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="ConnectionInfo">
                            <div 
                                style="overflow: auto;"
                                :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'"
                            >
                                <ConnectionInfoTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="MCP-Servers">
                            <div 
                                style="overflow: auto;"
                                :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'"
                            >
                                <MCPServerTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="MCP-Environments">
                            <div 
                                style="overflow: auto;"
                                :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'"
                            >
                                <MCPEnvSecretTab />
                            </div>
                        </v-window-item>
                        <!-- <v-window-item value="Notification">
                            <NotificationTab/>
                        </v-window-item>
                        <v-window-item value="Bills">
                            <BillsTab/>
                        </v-window-item>
                        <v-window-item value="Security">
                            <SecurityTab/>
                        </v-window-item> -->
                    </v-window>
                </v-card-text>
            </v-card>
        </v-col>
    </v-row>
</template>

<script>
/*import tabler icons*/
import { UserCircleIcon, UsersIcon, BrandGoogleDriveIcon, DatabaseIcon } from 'vue-tabler-icons';
//components
import AccountTab from '@/components/pages/account-settings/AccountTab.vue';
import ManageAccessTab from '@/components/pages/account-settings/ManageAccessTab.vue';
import DriveTab from '@/components/pages/account-settings/DriveTab.vue';
import MCPServerTab from '@/components/pages/account-settings/MCPServer.vue';
import MCPEnvSecretTab from '@/components/pages/account-settings/MCPEnvSecret.vue';
import ConnectionInfoTab from '@/components/pages/account-settings/ConnectionInfoTab.vue';

// import NotificationTab from '@/components/pages/account-settings/NotificationTab.vue';
// import BillsTab from '@/components/pages/account-settings/BillsTab.vue';
// import SecurityTab from '@/components/pages/account-settings/SecurityTab.vue';

export default {
    components: {
        UserCircleIcon,
        UsersIcon,
        BrandGoogleDriveIcon,
        DatabaseIcon,
        AccountTab,
        ManageAccessTab,
        DriveTab,
        MCPServerTab,
        MCPEnvSecretTab,
        ConnectionInfoTab
    },
    data() {
        return {
            tab: '',
            superAdmin: localStorage.getItem('role') === 'superAdmin',
            tabItems: [
                { value: 'Account', label: 'Account' },
                { value: 'ManageAccess', label: 'Manage Access' },
                { value: 'Drive', label: 'Drive' },
                { value: 'MCP', label: 'MCP Servers' },
                { value: 'ConnectionInfo', label: 'Connection Info' }
            ],
            admin: localStorage.getItem('isAdmin') === 'true'
        };
    },
    mounted() {
        // this.admin = localStorage.getItem('isAdmin') === 'true' || localStorage.getItem('role') === 'superAdmin';
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        }
    }
    methods: {
        goToTenantManage() {
            // ===== 로컬 테스트용 코드 시작 =====
            // 로컬호스트에서 테넌트 관리 페이지 테스트를 위한 코드
            // 필요시 주석을 해제하여 사용
            // const isLocalhost = location.host.includes('localhost') || 
            //                    location.host.includes('192.168') || 
            //                    location.host.includes('127.0.0.1');
            // 
            // if (isLocalhost) {
            //     location.href = `http://${location.host}/tenant/manage?clear=true`;
            //     return;
            // }
            // ===== 로컬 테스트용 코드 끝 =====
            
            // www로 이동하면서 로컬스토리지 클리어 파라미터 추가 (기존 changeTenant 로직)
            if(!location.port || location.port == '') {
                location.href = `https://www.process-gpt.io/tenant/manage?clear=true`;
            } else {
                location.href = `http://www.process-gpt.io:${location.port}/tenant/manage?clear=true`;
            }
        }
    }
};
</script>

<style scoped>
.selected-tab {
    background: #808080 !important;
    color: white !important;
}
</style>
