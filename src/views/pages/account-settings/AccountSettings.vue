<script setup lang="ts">
import { ref } from 'vue';
/*import tabler icons*/
import { UserCircleIcon, UsersIcon, BrandGoogleDriveIcon } from 'vue-tabler-icons';
//components
import AccountTab from '@/components/pages/account-settings/AccountTab.vue';
import ManageAccessTab from '@/components/pages/account-settings/ManageAccessTab.vue';
import DriveTab from '@/components/pages/account-settings/DriveTab.vue';
import MCPTab from '@/components/pages/account-settings/MCPTab.vue';
import ConnectionInfoTab from '@/components/pages/account-settings/ConnectionInfoTab.vue';
// import NotificationTab from '@/components/pages/account-settings/NotificationTab.vue';
// import BillsTab from '@/components/pages/account-settings/BillsTab.vue';
// import SecurityTab from '@/components/pages/account-settings/SecurityTab.vue';

/*tab*/
const tab = ref('');

const superAdmin = ref(localStorage.getItem('role') === 'superAdmin');
</script>

<template>
    <v-row class="justify-center">
        <!--Account Settings tabs-->
        <v-col cols="12" md="12">
            <v-card elevation="10" >
                <v-tabs v-model="tab" bg-color="transparent" min-height="70" height="70" color="primary">
                    <v-tab value="Account">
                        <UserCircleIcon class="mr-2" size="20"/>{{ $t('accountTab.accountSetting') }}
                    </v-tab>
                    <div v-if="superAdmin">
                        <v-tab value="ManageAccess">
                            <UsersIcon class="mr-2" size="20"/>{{ $t('accountTab.manageAccess') }}
                        </v-tab>
                        <v-tab value="Drive">
                            <BrandGoogleDriveIcon class="mr-2" size="20"/>{{ $t('accountTab.drive') }}
                        </v-tab>
                        <v-tab value="MCP">
                            MCP Servers
                        </v-tab>
	                    <v-tab value="ConnectionInfo">
	                        <DatabaseIcon class="mr-2" size="20"/>{{ $t('accountTab.connectionInfo') }}
	                    </v-tab>
                    </div>
                    <!-- <v-tab value="Notification"  class=""><BellIcon class="mr-2" size="20"/>Notification</v-tab> -->
                    <!-- <v-tab value="Bills"  class=""><ArticleIcon class="mr-2" size="20"/>Bills</v-tab> -->
                    <!-- <v-tab value="Security"  class=""><LockIcon class="mr-2" size="20"/>Security</v-tab> -->
                </v-tabs>
                <v-divider></v-divider>
                <v-card-text class="pa-sm-6 pa-3 pb-sm-6 pb-6">
                    <v-window v-model="tab">
                        <v-window-item value="Account">
                            <AccountTab />
                        </v-window-item>
                        <v-window-item value="ManageAccess">
                            <ManageAccessTab />
                        </v-window-item>
                        <v-window-item value="Drive">
                            <DriveTab/>
                        </v-window-item>
                        <v-window-item value="MCP">
                            <MCPTab/>
                        </v-window-item>
                        <v-window-item value="ConnectionInfo">
                            <ConnectionInfoTab/>
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
