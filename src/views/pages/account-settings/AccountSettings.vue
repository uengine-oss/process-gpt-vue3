<template>
    <v-row class="justify-center ma-0 pa-0">
        <!--Account Settings tabs-->
        <v-col cols="12" md="12" class="pa-0">
            <v-card elevation="10" class="is-work-height">
                <!-- 데스크톱: 기존 탭 -->
                <div v-if="!isMobile">
                    <v-row class="ma-0 pa-0 align-center">
                        <v-tabs v-model="tab" bg-color="transparent" min-height="70" height="70" color="default">
                            <v-tab value="Account"> <UserCircleIcon class="mr-2" size="20" />{{ $t('accountTab.accountSetting') }} </v-tab>
                            <div v-if="admin">
                                <v-tab value="ManageAccess">
                                    <UsersIcon class="mr-2" size="20" />{{ $t('accountTab.manageAccess') }}
                                </v-tab>
                                <v-tab v-if="superAdmin && !pal" value="Drive">
                                    <BrandGoogleDriveIcon class="mr-2" size="20" />{{ $t('accountTab.drive') }}
                                </v-tab>
                                <v-tab v-if="!pal" value="MCP-Servers">
                                    <v-icon class="mr-2" size="20">mdi-server</v-icon> {{ $t('accountTab.mcpServers') }}
                                </v-tab>
                                <v-tab v-if="!pal" value="MCP-Environments">
                                    <v-icon class="mr-2" size="20">mdi-application-variable-outline</v-icon>
                                    {{ $t('accountTab.environments') }}
                                </v-tab>
                                <v-tab v-if="!pal" value="Skills">
                                    <v-icon class="mr-2" size="20">mdi-brain</v-icon> {{ $t('accountTab.skills') }}
                                </v-tab>
                                <v-tab v-if="!pal" value="ConnectionInfo">
                                    <DatabaseIcon class="mr-2" size="20" />{{ $t('accountTab.dataSource') }}
                                </v-tab>
                                <v-tab value="TaskCatalog">
                                    <v-icon class="mr-2" size="20">mdi-folder-cog</v-icon> {{ $t('accountTab.taskCatalog') }}
                                </v-tab>
                                <v-tab value="OrgChartGroup">
                                    <v-icon class="mr-2" size="20">mdi-account-group</v-icon> {{ $t('accountTab.orgChartGroup') }}
                                </v-tab>
                                <v-tab v-if="pal" value="AdminConsole">
                                    <v-icon class="mr-2" size="20">mdi-shield-lock-outline</v-icon> {{ $t('adminConsole.title') }}
                                </v-tab>
                            </div>
                            <!-- <v-tab value="Notification"  class=""><BellIcon class="mr-2" size="20"/>Notification</v-tab> -->
                            <!-- <v-tab value="Bills"  class=""><ArticleIcon class="mr-2" size="20"/>Bills</v-tab> -->
                            <!-- <v-tab value="Security"  class=""><LockIcon class="mr-2" size="20"/>Security</v-tab> -->
                        </v-tabs>
                        <div
                            v-if="!pal"
                            @click="goToTenantManage"
                            class="settings-tenant-manage-btn v-tab-style text-none"
                            style="letter-spacing: 0"
                        >
                            <Icons :icon="'office'" :size="20" class="mr-2" />{{ $t('accountTab.tenantManage') }}
                        </div>
                        <v-spacer></v-spacer>

                        <!-- 언어 선택 -->
                        <v-chip variant="outlined" class="language-chip-select-wrapper" style="margin-right: 16px" color="gray">
                            <v-select
                                v-model="selectedLanguage"
                                :items="languageOptions"
                                item-title="displayLabel"
                                item-value="value"
                                @update:model-value="changeLanguage"
                                variant="plain"
                                density="compact"
                                hide-details
                            >
                                <template v-slot:selection="{ item }">
                                    <span style="font-size: 18px; margin-right: 6px">{{ item.raw.flag }}</span>
                                    <span>{{ item.raw.label }}</span>
                                </template>
                            </v-select>
                        </v-chip>
                    </v-row>
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
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'ManageAccess'"
                                :class="{ 'selected-tab': tab === 'ManageAccess' }"
                            >
                                <UsersIcon class="mr-2" size="16" />{{ $t('accountTab.manageAccess') }}
                            </v-btn>

                            <v-btn
                                v-if="superAdmin && !pal"
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'Drive'"
                                :class="{ 'selected-tab': tab === 'Drive' }"
                            >
                                <BrandGoogleDriveIcon class="mr-2" size="16" />{{ $t('accountTab.drive') }}
                            </v-btn>

                            <v-btn
                                v-if="!pal"
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'MCP-Servers'"
                                :class="{ 'selected-tab': tab === 'MCP-Servers' }"
                            >
                                {{ $t('accountTab.mcpServers') }}
                            </v-btn>
                            <v-btn
                                v-if="!pal"
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'MCP-Environments'"
                                :class="{ 'selected-tab': tab === 'MCP-Environments' }"
                            >
                                {{ $t('accountTab.environments') }}
                            </v-btn>
                            <v-btn
                                v-if="!pal"
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'ConnectionInfo'"
                                :class="{ 'selected-tab': tab === 'ConnectionInfo' }"
                            >
                                <DatabaseIcon class="mr-2" size="16" />{{ $t('accountTab.dataSource') }}
                            </v-btn>
                            <v-btn
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'TaskCatalog'"
                                :class="{ 'selected-tab': tab === 'TaskCatalog' }"
                            >
                                <v-icon class="mr-2" size="16">mdi-folder-cog</v-icon>{{ $t('accountTab.taskCatalog') }}
                            </v-btn>
                            <v-btn
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'OrgChartGroup'"
                                :class="{ 'selected-tab': tab === 'OrgChartGroup' }"
                            >
                                <v-icon class="mr-2" size="16">mdi-account-group</v-icon>{{ $t('accountTab.orgChartGroup') }}
                            </v-btn>
                            <v-btn
                                v-if="pal"
                                variant="text"
                                color="default"
                                size="small"
                                @click="tab = 'AdminConsole'"
                                :class="{ 'selected-tab': tab === 'AdminConsole' }"
                            >
                                <v-icon class="mr-2" size="16">mdi-shield-lock-outline</v-icon>{{ $t('adminConsole.title') }}
                            </v-btn>
                        </template>

                        <v-btn v-if="!pal" variant="text" color="default" size="small" @click="goToTenantManage">
                            <Icons :icon="'office'" :size="16" class="mr-2" />{{ $t('accountTab.tenantManage') }}
                        </v-btn>
                    </div>
                    <!-- 모바일 언어 선택 -->
                    <div class="d-flex justify-end mb-2">
                        <v-chip variant="outlined" class="language-chip-select-wrapper" size="small" color="gray">
                            <v-select
                                v-model="selectedLanguage"
                                :items="languageOptions"
                                item-title="displayLabel"
                                item-value="value"
                                @update:model-value="changeLanguage"
                                variant="plain"
                                density="compact"
                                hide-details
                            >
                                <template v-slot:selection="{ item }">
                                    <span style="font-size: 16px; margin-right: 4px">{{ item.raw.flag }}</span>
                                    <span style="font-size: 13px">{{ item.raw.label }}</span>
                                </template>
                            </v-select>
                        </v-chip>
                    </div>
                </div>

                <v-divider></v-divider>
                <v-card-text class="pa-0">
                    <v-window v-model="tab">
                        <v-window-item value="Account">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <AccountTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="ManageAccess">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <ManageAccessTab :editable="superAdmin" />
                            </div>
                        </v-window-item>
                        <v-window-item value="Drive">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <DriveTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="ConnectionInfo">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <ConnectionInfoTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="MCP-Servers">
                            <div>
                                <MCPServerTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="MCP-Environments">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <MCPEnvSecretTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="Skills">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <SkillsTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="TaskCatalog">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <TaskCatalogAdmin />
                            </div>
                        </v-window-item>
                        <v-window-item value="OrgChartGroup">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <OrgChartGroupTab />
                            </div>
                        </v-window-item>
                        <v-window-item value="AdminConsole">
                            <div style="overflow: auto" :style="!isMobile ? 'height: calc(100vh - 205px);' : 'height: calc(100vh - 80px);'">
                                <AdminConsole />
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
import { getMainDomainUrl } from '@/utils/domainUtils';
//components
import AccountTab from '@/components/pages/account-settings/AccountTab.vue';
import ManageAccessTab from '@/components/pages/account-settings/ManageAccessTab.vue';
import DriveTab from '@/components/pages/account-settings/DriveTab.vue';
import MCPServerTab from '@/components/pages/account-settings/MCPServer.vue';
import MCPEnvSecretTab from '@/components/pages/account-settings/MCPEnvSecret.vue';
import ConnectionInfoTab from '@/components/pages/account-settings/ConnectionInfoTab.vue';
import SkillsTab from '@/components/pages/account-settings/SkillsTab.vue';
import TaskCatalogAdmin from '@/components/admin/TaskCatalogAdmin.vue';
import OrgChartGroupTab from '@/components/pages/account-settings/OrgChartGroupTab.vue';
import AdminConsole from '@/views/admin/AdminConsole.vue';
import { authClaimsState } from '@/utils/authClaims';

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
        ConnectionInfoTab,
        SkillsTab,
        TaskCatalogAdmin,
        OrgChartGroupTab,
        AdminConsole
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
                { value: 'Skills', label: 'Skills' },
                { value: 'ConnectionInfo', label: 'Connection Info' }
            ],
            admin: authClaimsState.isAdmin,
            selectedLanguage: this.$i18n.locale || 'ko',
            languageOptions: [
                { value: 'ko', label: '한국어', flag: '🇰🇷', displayLabel: '🇰🇷 한국어' },
                { value: 'en', label: 'English', flag: '🇺🇸', displayLabel: '🇺🇸 English' }
            ]
        };
    },
    mounted() {
        this.admin = authClaimsState.isAdmin;
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        pal() {
            return window.$pal;
        }
    },
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
            location.href = getMainDomainUrl('/tenant/manage?clear=true');
        },
        changeLanguage(locale) {
            this.$try({
                action: async () => {
                    // i18n locale 변경
                    this.$i18n.locale = locale;

                    // localStorage에 저장하여 다음 접속 시에도 유지
                    localStorage.setItem('locale', locale);

                    // 전역 i18n 인스턴스 업데이트
                    if (window.$i18n) {
                        window.$i18n.global.locale = locale;
                    }
                },
                errorMsg: this.$t('errorMsg.languageChangeFailed')
            });
        }
    }
};
</script>

<style scoped>
.selected-tab {
    background: #808080 !important;
    color: white !important;
}

.v-tab-style {
    display: flex;
    align-items: center;
    padding: 0 16px;
    min-height: 70px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: 0.0892857143em;
    line-height: 1.25rem;
    text-transform: uppercase;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 4px 4px 0 0;
    position: relative;
}

.v-tab-style:hover {
    background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.v-tab-style:focus {
    outline: none;
}

.v-tab-style::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background-color: transparent;
    transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
