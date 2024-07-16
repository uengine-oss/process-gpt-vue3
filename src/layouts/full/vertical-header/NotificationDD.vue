<template>
    <!-- ---------------------------------------------- -->
    <!-- notifications DD -->
    <!-- ---------------------------------------------- -->
    <v-menu :close-on-content-click="true" class="notification_popup">
        <template v-slot:activator="{ props }">
            <v-btn icon flat v-bind="props" size="small">
                <div class="position-realtive">
                    <div class="notify" v-if="notiCount > 0">
                        <span class="heartbit"></span>
                        <span class="point"></span>
                    </div>
                    <Icons :icon="'bell-bing-line-duotone'" />
                </div>
            </v-btn>
        </template>

        <v-sheet rounded="lg" width="385" elevation="10" class="mt-5 dropdown-box">
            <div class="px-8 pb-4 pt-6">
                <div class="d-flex align-center">
                    <h6 class="text-h5 font-weight-semibold">Notifications</h6>
                    <v-chip color="primary" 
                            variant="flat" 
                            size="x-small" 
                            class="text-white ml-4" 
                            rounded="xl">
                        {{ notiCount }} New
                    </v-chip>
                </div>
            </div>
            <perfect-scrollbar style="height:300px">
                <v-list class="py-0 theme-list" lines="two">
                    <v-list-item v-for="item in filteredNotiList" 
                            :key="item.id" 
                            color="primary" 
                            class="py-4 px-8"
                            @click="checkNotification(item)"
                    >
                        <div>
                            <h6 class="text-h6 font-weight-medium mb-1">{{ item.type.toUpperCase() }}</h6>
                        </div>
                        <p v-if="item.type =='todo'" class="text-subtitle-1 font-weight-medium text-grey100">
                            {{ item.detail.activity_id }}
                        </p>
                        <p v-else-if="item.type =='instance'" class="text-subtitle-1 font-weight-medium text-grey100">
                            {{ item.detail.proc_inst_name }}
                        </p>
                    </v-list-item>
                    <v-divider></v-divider>
                </v-list>
            </perfect-scrollbar>
            <!-- <div class="py-4 px-6 text-center">
                <v-btn color="primary" size="large" rounded="pill" block>See all Notifications</v-btn>
            </div> -->
        </v-sheet>
    </v-menu>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
import { Icon } from '@iconify/vue';

export default {
    components: {
        Icon,
    },
    data: () => ({
        storage: null,
        userInfo: null,
        notifications: [],
    }),
    async created() {
        if(window.$mode == "ProcessGPT"){
            this.storage = StorageBaseFactory.getStorage("supabase");
            this.userInfo = await this.storage.getUserInfo();
            this.getNotifications();
        }
    },
    computed: {
        filteredNotiList() {
            var list = [];
            if (this.notifications && this.notifications.length > 0) {
                list = this.notifications.filter(item => !item.isChecked);
                list = JSON.parse(JSON.stringify(list));
                if (list.length > 0) {
                    list.forEach(async item => {
                        let result;
                        if (item.type == 'todo') {
                            const options = {
                                match: {
                                    id: item.id,
                                }
                            };
                            result = await this.storage.getObject('todolist', options);

                        } else if (item.type == 'instance') {
                            const defId = item.id.split('.')[0];
                            const options = {
                                match: {
                                    proc_inst_id: item.id,
                                }
                            };
                            result = await this.storage.getObject(defId, options);
                        }
                        item['detail'] = result;
                    });
                }
            }
            return list;
        },
        notiCount() {
            if (this.filteredNotiList.length > 0) {
                return this.filteredNotiList.length;
            }
            return 0;
        },
    },
    methods: {
        async getNotifications() {
            const options = {
                match: {
                    id: this.userInfo.uid,
                    email: this.userInfo.email,
                }
            };
            const result = await this.storage.getObject('users', options);
            this.notifications = result.notifications;
        },
        checkNotification(item) {
            if (item.type == 'todo') {
                this.$router.push(`/todolist`);
            } else if (item.type == 'instance') {
                this.$router.push(`/instances/chat?id=${item.id}`);
            } else {
                //
            }

            item.isChecked = true;
            this.notifications.forEach(noti => {
                if (item.id === noti.id) {
                    noti.isChecked = true;
                }
            });

            const obj = {
                id: this.userInfo.uid,
                notifications: this.notifications,
            };
            this.storage.putObject('users', obj);
        },
    }
}
</script>