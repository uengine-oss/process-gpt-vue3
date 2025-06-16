<template>
    <v-card elevation="10">
        <div>
            <div class="d-flex justify-end mb-4">
                <v-btn
                    color="primary"
                    elevation="2"
                    @click="openInviteUserCard = true"
                    class="add-user-btn"
                >
                    <v-icon left>mdi-account-plus</v-icon>
                    {{ $t('accountTab.addUser') }}
                </v-btn>
            </div>
        </div>
        <div class="mt-2 mb-5">
            <v-text-field v-model="search" label="Search User" hide-details prepend-inner-icon="mdi-magnify"></v-text-field>
        </div>
        <div class="mt-8">
            <v-data-table :items="users" :search="search" :filter-keys="searchKey" :headers="headers" items-per-page="5">
                <template v-slot:default="{ items }">
                    <div class="overflow-hidden">
                        <v-row v-for="item in items" :key="item.id">
                            <v-col cols="9">
                                <div class="d-flex align-center">
                                    <div class="pl-5">
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
                            </v-col>
                            <v-col cols="3">
                                <v-select v-model="item.is_admin" :items="adminItem" item-title="name" item-value="value"
                                prefix="Role:" @update:model-value="updateUser(item)"></v-select>
                            </v-col>
                        </v-row>
                    </div>
                </template>
            </v-data-table>
        </div>
    </v-card>

    <v-dialog
        v-model="openInviteUserCard"
        persistent
    >
        <v-card>
            <div class="d-flex justify-end pa-2">
                <v-btn
                    icon
                    @click="openInviteUserCard = false"
                >
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </div>
            <v-card-text class="pa-0">
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
    created() {
        this.getUserList();
    },
    methods: {
        closeInviteUserCard(userList) {
            this.openInviteUserCard = false;
            userList.forEach(user => {
                if(user.role === 'superAdmin') {
                    user.is_admin = true;
                } else {
                    user.is_admin = false;
                }
                this.users.push(user);
            });
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
</style>
