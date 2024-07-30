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
            <div class="d-flex align-center pa-3">
                <h6 class="text-h5 font-weight-semibold">Notifications</h6>
                <v-chip color="primary" variant="flat" size="x-small" class="text-white ml-4" rounded="xl">
                    {{ notiCount }} New
                </v-chip>
            </div>
            <v-divider></v-divider>
            <perfect-scrollbar style="height:300px">
                <v-list lines="one">
                    <v-list-item v-for="item in filteredNotifications" :key="item.id" @click="checkNotification(item)">
                        <template v-slot:prepend>
                            <div class="mr-2">
                                <v-chip color="primary" variant="tonal" size="x-small" label>
                                    {{ item.type == 'workitem' ? 'To-Do' : 'Chat' }}
                                </v-chip>
                            </div>
                        </template>
                        <v-list-item-subtitle class="d-flex">
                            <div>{{ item.description }}</div>
                            <div class="ml-auto">{{ item.timeStamp }} ago</div>
                        </v-list-item-subtitle>
                        <v-list-item-title class="d-flex mt-1">
                            <div>{{ item.title }}</div>
                            <div class="ml-auto">
                                <v-badge v-if="item.count > 1" color="primary" :content="item.count" inline></v-badge>
                            </div>
                        </v-list-item-title>
                        <v-divider class="mt-1"></v-divider>
                    </v-list-item>
                </v-list>
            </perfect-scrollbar>
        </v-sheet>
    </v-menu>
</template>

<script>
import StorageBaseFactory from '@/utils/StorageBaseFactory';
const storage = StorageBaseFactory.getStorage();

import { formatDistanceToNowStrict } from 'date-fns';

export default {
    data: () => ({
        notifications: [],
        filteredNotifications: [],
    }),
    async created() {
        // await this.getNotifications();
        // await storage.watch('notifications', async (data) => {
        //     if(data && data.new) {
        //         await this.getNotifications();
        //     }
        // });
    },
    computed: {
        notiCount() {
            if (this.filteredNotifications.length > 0) {
                return this.filteredNotifications.length;
            }
            return 0;
        },
   },
    methods: {
        async getNotifications() {
            const userId = localStorage.getItem('email');
            const options = {
                limit: 10,
                orderBy: 'time_stamp',
                sort: 'desc',
                match: { user_id: userId, is_checked: false },
            }
            const list = await storage.list('notifications', options);
            if (list.length > 0) {
                this.notifications = list;
                this.filteredNotifications = Object.values(list.reduce((acc, item) => {
                    const timeStamp = formatDistanceToNowStrict(new Date(item.time_stamp), {
                        addSuffix: false
                    });
                    item.timeStamp = timeStamp;

                    if (!acc[item.url]) {
                        item.count = 1;
                        acc[item.url] = item;
                    } else if (new Date(item.time_stamp) > new Date(acc[item.url].time_stamp)) {
                        item.count = acc[item.url].count + 1;
                        acc[item.url] = item;
                    } else {
                        acc[item.url].count += 1;
                    }
                    return acc;
                }, {}));
            } else {
                this.notifications = [];
                this.filteredNotifications = [];
            }
        },
        async checkNotification(value) {
            this.$router.push(value.url);
            if (value.count > 1) {
                this.notifications.forEach(async (item) => {
                    if (item.url === value.url && item.user_id === value.user_id) {
                        const putObj = { id: item.id, is_checked: true };
                        await storage.putObject('notifications', putObj);
                    }
                })
            } else {
                const putObj = { id: value.id, is_checked: true };
                await storage.putObject('notifications', putObj);
            }
            await this.getNotifications();
        }
    }
}
</script>