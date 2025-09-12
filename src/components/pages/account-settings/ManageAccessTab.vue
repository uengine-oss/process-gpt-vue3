<template>
    <v-card flat class="pa-4">
        <div>
            <v-row class="ma-0 pa-0">
                <!-- 검색 -->
                <v-row class="ma-0 pa-0 align-center border header-search rounded-pill px-5" style="background-color: #fff;">
                    <Icons :icon="'magnifer-linear'" :size="22" />
                    <v-text-field 
                    v-model="search" 
                    variant="plain" 
                    density="compact"
                    class="position-relative pt-0 ml-3 custom-placeholer-color" 
                    :placeholder="$t('accountTab.search')"
                    single-line 
                    hide-details
                    dense
                    ></v-text-field>
                </v-row>
                <!-- <v-text-field v-model="search" label="Search User" hide-details prepend-inner-icon="mdi-magnify"></v-text-field> -->
                <v-spacer></v-spacer>
                <v-btn @click="openInviteUserCard = true"
                    color="primary"
                    variant="flat"
                    rounded
                >
                    <v-icon style="padding-top: 3px;">mdi-account-plus</v-icon>
                    <span class="ml-2">{{ $t('accountTab.addUser') }}</span>
                </v-btn>
            </v-row>
        </div>

        <div>
            <v-data-table :items="users" :search="search" :filter-keys="searchKey" :headers="headers" items-per-page="5">
                <template v-slot:default="{ items }">
                    <div v-for="item in items" :key="item.id" 
                        class="d-flex align-center justify-space-between pa-4 pr-0 pl-0 user-row"
                    >
                        <div class="d-flex align-center">
                            <div>
                                <v-img v-if="item.profile" :src="item.profile" width="45px" 
                                    class="rounded-circle img-fluid" />
                                <v-avatar v-else>
                                    <Icons :icon="'user-circle-bold'" :size="50" />
                                </v-avatar>
                            </div>
                            <div class="ml-5">
                                <h4 class="text-subtitle-1 font-weight-semibold text-no-wrap">{{ item.name }}</h4>
                                <div class="text-subtitle-1 textSecondary text-no-wrap mt-1">{{ item.email }}</div>
                            </div>
                        </div>
                        <div class="d-flex align-center">
                            <v-chip variant="elevated"
                                :color="item.is_admin ? 'primary' : 'gray'"
                                class="chip-select-wrapper"
                                size="small"
                            >
                                <v-select 
                                    v-model="item.is_admin" 
                                    :items="adminItem" 
                                    item-title="name" 
                                    item-value="value"
                                    @update:model-value="updateUser(item)"
                                    variant="plain"
                                    density="compact"
                                    hide-details
                                    class="chip-select"
                                >
                                    <template v-slot:selection="{ item: selectedItem }">
                                        {{ selectedItem.title }}
                                    </template>
                                </v-select>
                            </v-chip>
                        </div>
                    </div>
                </template>
            </v-data-table>
        </div>
    </v-card>

    <v-dialog
        v-model="openInviteUserCard"
        max-width="800px"
        persistent
    >
        <v-card class="pa-4">
            <v-row class="ma-0 pa-0 align-center">
                <v-card-title class="pa-0"
                >{{ $t('accountTab.inviteUser') }}
                </v-card-title>
                <v-spacer></v-spacer>
                <v-btn @click="openInviteUserCard = false"
                    class="ml-auto" 
                    variant="text" 
                    density="compact"
                    icon
                >
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-row>
            <v-card-title class="headline pa-0">
                <p class="text-subtitle-1 text-grey-darken-1">{{ $t('accountTab.inviteUserMessage') }}</p>
                <p class="text-caption text-grey-darken-1">{{ $t('accountTab.inviteUserMessage2') }}</p>
            </v-card-title>
            <v-card-text class="pa-0" max-height="500" style="overflow-y: auto;">
                <InviteUserCard @close="closeInviteUserCard" type="manageAccess" :userList="users" />
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import { VDataTable } from 'vuetify/components/VDataTable';
import InviteUserCard from '@/components/tenant/inviteUserCard.vue';

export default {
    name: 'ManageAccessTab',
    components: {
        VDataTable,
        InviteUserCard
    },
    data: () => ({
        isMobile: false,
        search: '',
        searchKey: ['name', 'email'],
        users: [],
        adminItem: [
            { name: 'Admin', value: true },
            { name: 'User', value: false }
        ],
        headers: [
            { title: 'User', key: 'name' },
            { title: 'Role', key: 'is_admin', sortable: false },
            { title: 'Action', key: 'action', sortable: false, align: 'end' }
        ],
        openInviteUserCard: false,
    }),
    async mounted() {
        this.checkIfMobile();
        window.addEventListener('resize', this.checkIfMobile);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.checkIfMobile);
    },
    created() {
        this.getUserList();
    },
    methods: {
        closeInviteUserCard(userList) {
            this.users = [...this.users, ...userList];
            this.openInviteUserCard = false;
        },
        async getUserList() {
            this.users  = await backend.getUserList();
            this.users = this.users.map(user => {
                return {
                    id: user.id,
                    profile: user.profile,
                    name: user.username,
                    email: user.email,
                    is_admin: user.is_admin
                };
            });
        },
        async updateUser(user) {
            const userInfo = {
                id: user.id,
                is_admin: user.is_admin
            }
            await backend.updateUserInfo({ type: 'update', user: userInfo });
        },
        async deleteUser(user) {
            await backend.updateUserInfo({ type: 'delete', user: user });
        },
        checkIfMobile() {
            this.isMobile = window.innerWidth <= 768;
        }
    }
};
</script>

<style scoped>
.add-user-btn {
    border-radius: 8px;
    text-transform: none;
    font-weight: 500;
    letter-spacing: 0.5px;
}

.add-user-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
}

.header-search {
    max-width: 280px;
}

.chip-select-wrapper {
    cursor: pointer;
}

.chip-select {
    width: 100%;
}

.chip-select .v-field {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
}

.chip-select .v-field__outline {
    display: none !important;
}

.chip-select .v-field__input {
    padding: 0 !important;
    min-height: auto !important;
    color: inherit !important;
}

.chip-select .v-field__field {
    padding: 0 !important;
}

.chip-select .v-input__control {
    min-height: auto !important;
}

.chip-select .v-field__append-inner {
    padding: 0 !important;
    margin: 0 !important;
}

.user-row {
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s ease;
}

.user-row:last-child {
    border-bottom: none;
}

.user-row:hover {
    background-color: #f8f9fa;
}

.is-mobile {
    display: none;
}

@media screen and (max-width: 768px) {
    .header-search {
        max-width: 200px;
    }
    .is-mobile {
        display: block;
    }
}


</style>
