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
                <h6 class="text-h5 font-weight-semibold">{{ $t('NotificationDD.notification') }}</h6>
                <v-chip color="primary" variant="flat" size="x-small" class="text-white ml-4" rounded="xl">
                    {{ notiCount }} New
                </v-chip>
            </div>
            <v-divider></v-divider>
            <perfect-scrollbar style="height:300px">
                <v-list lines="one">
                    <v-list-item v-for="item in notifications" :key="item.id" @click="checkNotification(item)">
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
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    data: () => ({
        notifications: [],
    }),
    computed: {
        notiCount() {
            if (this.notifications.length > 0) {
                return this.notifications.length;
            }
            return 0;
        },
    },
    async created() {
        await this.getNotifications();
    },
    methods: {
        async getNotifications() {
            this.notifications = await backend.getNotifications();
        },
        async checkNotification(value) {
            if (value.type == 'workitem') {
                this.$router.push('/todolist');
            } else {
                this.$router.push(value.url);
            }
            await backend.setNotifications(value);
            await this.getNotifications();
        }
    }
}
</script>