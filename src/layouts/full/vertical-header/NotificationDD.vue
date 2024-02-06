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
                    <Icon icon="solar:bell-bing-line-duotone" height="24" width="24" />
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
                    <v-list-item v-for="item in notifications" 
                            :key="item.key" 
                            :value="item.chatId" 
                            color="primary" 
                            class="py-4 px-8"
                            @click="checkNotification(item)"
                    >
                        <template v-slot:prepend>
                            <v-avatar v-for="img in item.participantImgs" size="48" class="mr-3">
                                <v-img :src="img" width="48" />
                            </v-avatar>
                        </template>
                        <div>
                            <h6 class="text-h6 font-weight-medium mb-1">{{ item.title }}</h6>
                        </div>
                        <p class="text-subtitle-1 font-weight-medium text-grey100">{{ item.subtitle }}</p>
                    </v-list-item>
                    <v-divider></v-divider>
                </v-list>
            </perfect-scrollbar>
            <div class="py-4 px-6 text-center">
                <v-btn color="primary" size="large" rounded="pill" block>See all Notifications</v-btn>
            </div>
        </v-sheet>
    </v-menu>
</template>

<script>
import { Icon } from '@iconify/vue';

import { getGlobalContext } from '@/stores/auth';

const globalContext = getGlobalContext();

export default {
    components: {
        Icon,
    },
    data: () => ({
        uid: "",
        notiCount: 0,
        notifications: [],
    }),
    async created() {
        await globalContext.storage.loginUser();

        if (globalContext.storage.userInfo && globalContext.storage.userInfo.name) {
            this.getNotifications();
        }
    },
    methods: {
        async getNotifications() {
            this.uid = globalContext.storage.userInfo.uid;
            await globalContext.storage.watch(`db://users/${this.uid}`, callback => {
                if (callback) {
                    if (callback.notifications) {
                        let notiList = Object.values(callback.notifications);
                        notiList = notiList.filter(noti => !noti.isChecked);
                        this.notifications = notiList;
                        this.notiCount = notiList.length;
                    }
                }
            });
        },
        checkNotification(item) {
            this.$router.push(`/${item.noti_type}/${item.chatId}`);
            item.isChecked = true;
            globalContext.storage.putObject(`db://users/${this.uid}/notifications/${item.key}`, item);
        },
        async getUserImage(email) {
            var convertEmail = email.replace(/\./gi, '_');
            var image = await globalContext.storage.getString(`db://enrolledUsers/${convertEmail}/profile`)
            return image;
        },
    }
}
</script>