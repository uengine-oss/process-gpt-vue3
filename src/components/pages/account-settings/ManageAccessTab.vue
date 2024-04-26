<template>
    <v-card elevation="10">
        <v-row class="ma-1">
            <v-col cols="12">
                <v-text-field v-model="search" label="Search User" hide-details prepend-inner-icon="mdi-magnify"></v-text-field>
            </v-col>
        </v-row>
        <div class="border-table">
            <VDataTable :items="users" :search="search" class="mt-5">
                <template v-slot:item="{ item }">
                    <tr>
                        <td>
                            <div class="d-flex align-center">
                                <div>
                                    <v-img v-if="item.raw.profile" :src="item.raw.profile" width="45px" 
                                        class="rounded-circle img-fluid" />
                                    <v-avatar v-else>
                                        <Icon icon="solar:user-circle-bold" width="50px" height="50px" />
                                    </v-avatar>
                                </div>
                                <div class="ml-5">
                                    <h4 class="text-subtitle-1 font-weight-semibold text-no-wrap">{{ item.raw.name }}</h4>
                                    <div class="text-subtitle-1 textSecondary text-no-wrap mt-1">{{ item.raw.email }}</div>
                                </div>
                            </div>
                        </td>
                        <td style="width: 20%;">
                            <v-select v-model="item.raw.isAdmin" :items="adminItem" item-title="name" item-value="value"
                                @update:model-value="updateUser(item)" prefix="Role:"></v-select>
                        </td>
                    </tr>
                </template>
            </VDataTable>
        </div>
    </v-card>
</template>

<script>
import { VDataTable } from 'vuetify/labs/VDataTable';

import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

export default {
    components: {
        VDataTable
    },
    data: () => ({
        search: '',
        users: [],
        adminItem: [
            { name: 'Admin', value: true },
            { name: 'User', value: false }
        ],
    }),
    created() {
        this.getAllUserList();
    },
    methods: {
        getAllUserList() {
            var me = this;
            me.$try({
                action: async () => {
                    me.users = await storage.list('users');
                    me.users = me.users.map(user => {
                        return {
                            id: user.id,
                            profile: user.profile,
                            name: user.username,
                            email: user.email,
                            isAdmin: user.is_admin
                        };
                    });
                }
            })
        },
        updateUser(user) {
            var me = this;
            me.$try({
                action: async () => {
                    const putObj = {
                        id: user.raw.id,
                        is_admin: user.raw.isAdmin
                    }
                    await storage.putObject('users', putObj);
                }
            })
        },
    }
};
</script>
