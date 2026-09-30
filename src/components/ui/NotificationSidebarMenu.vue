<template>
    <!-- 사이드바 알림 메뉴: 클릭하면 페이지 이동 없이 작은 패널로 미확인 알림을 보여주고,
         '전체 알림 보기'를 눌러야 /notifications 페이지로 이동한다. -->
    <v-menu v-model="menuOpen" location="end" :close-on-content-click="false" offset="8">
        <template v-slot:activator="{ props }">
            <v-list-item
                v-bind="props"
                density="compact"
                class="leftPadding sidebar-list-hover-bg"
                :class="{ 'sidebar-list-hover-bg--active': menuOpen || $route?.path === '/notifications' }"
            >
                <template #prepend>
                    <Icons icon="bell-bing-line-duotone" :size="20" class="mr-2" />
                </template>
                <v-list-item-title>알림 목록</v-list-item-title>
                <template #append><NotificationUnreadBadge /></template>
            </v-list-item>
        </template>

        <v-sheet class="notification-quick-panel" rounded="lg" elevation="10" width="360">
            <div class="d-flex align-center pa-3">
                <h6 class="text-h5 font-weight-semibold">{{ $t('NotificationsPage.title') }}</h6>
                <v-chip
                    v-if="notificationsStore.unreadCount > 0"
                    color="error"
                    variant="flat"
                    size="x-small"
                    class="text-white ml-3"
                    rounded="xl"
                >
                    {{ notificationsStore.unreadCount }}
                </v-chip>
                <v-spacer></v-spacer>
                <v-btn icon variant="text" size="x-small" :loading="loading" @click="fetchItems">
                    <v-icon size="16">mdi-refresh</v-icon>
                </v-btn>
            </div>
            <v-divider></v-divider>

            <div class="notification-quick-scroll">
                <div v-if="loading && items.length === 0" class="pa-6 text-center">
                    <v-progress-circular indeterminate size="20" color="primary"></v-progress-circular>
                </div>
                <div v-else-if="items.length === 0" class="pa-6 text-center text-medium-emphasis">
                    <v-icon size="28" class="mb-1">mdi-bell-off-outline</v-icon>
                    <div class="text-caption">{{ $t('NotificationsPage.emptyUnread') }}</div>
                </div>
                <v-list v-else lines="two" class="py-0">
                    <v-list-item v-for="item in items" :key="item.id" class="py-2" @click="openNotification(item)">
                        <template v-slot:prepend>
                            <div class="mr-2">
                                <v-chip :color="typeColor(item.type)" variant="tonal" size="x-small" label>
                                    {{ typeLabel(item.type) }}
                                </v-chip>
                            </div>
                        </template>
                        <v-list-item-title class="text-body-2 quick-item-title">
                            {{ item.title || '-' }}
                            <v-badge v-if="item.count > 1" color="primary" :content="item.count" inline></v-badge>
                        </v-list-item-title>
                        <v-list-item-subtitle class="d-flex text-caption">
                            <span class="text-truncate">{{ item.description || '' }}</span>
                            <span class="ml-auto flex-shrink-0 pl-2">{{ relativeTime(item.time_stamp) }}</span>
                        </v-list-item-subtitle>
                    </v-list-item>
                </v-list>
            </div>

            <v-divider></v-divider>
            <v-btn block variant="text" color="primary" size="small" class="my-1" @click="goToNotificationsPage">
                {{ $t('NotificationDD.viewAll') }}
            </v-btn>
        </v-sheet>
    </v-menu>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import NotificationUnreadBadge from '@/components/ui/NotificationUnreadBadge.vue';
import { useNotificationsStore } from '@/stores/notifications';
import { resolveNotificationTarget } from '@/utils/notificationRouting';
import { formatDistanceToNowStrict } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const backend = BackendFactory.createBackend();

export default {
    name: 'NotificationSidebarMenu',
    components: { NotificationUnreadBadge },
    data: () => ({
        menuOpen: false,
        items: [],
        loading: false,
        notificationsStore: useNotificationsStore()
    }),
    watch: {
        menuOpen(open) {
            if (open) this.fetchItems();
        },
        // 패널이 열려 있는 동안 realtime 이벤트가 오면 목록 갱신
        'notificationsStore.pulse'() {
            if (this.menuOpen) this.fetchItems();
        }
    },
    methods: {
        async fetchItems() {
            this.loading = true;
            try {
                let list = [];
                if (typeof backend.fetchAllNotifications === 'function') {
                    list = await backend.fetchAllNotifications({ unreadOnly: true, size: 100 });
                } else {
                    list = (await backend.fetchNotifications()) || [];
                }
                // 같은 url(같은 대화방 등) 알림은 최신 1건 + 건수로 묶는다 — NotificationDD 와 같은 규칙.
                this.items = Object.values(
                    list.reduce((acc, item) => {
                        const key = item.url || item.id;
                        if (!acc[key]) {
                            acc[key] = { ...item, count: item.count || 1 };
                        } else {
                            acc[key].count += item.count || 1;
                            if (new Date(item.time_stamp) > new Date(acc[key].time_stamp)) {
                                acc[key] = { ...item, count: acc[key].count };
                            }
                        }
                        return acc;
                    }, {})
                );
            } catch (e) {
                console.error('알림 목록 조회 실패:', e);
            } finally {
                this.loading = false;
            }
        },
        typeLabel(type) {
            if (!type) return this.$t('NotificationsPage.typeGeneral');
            if (type.includes('workitem')) return 'To-Do';
            const map = {
                merge_request: 'PR',
                chat: 'Chat',
                download_anomaly: this.$t('NotificationsPage.typeSecurity'),
                survey: this.$t('NotificationsPage.typeSurvey'),
                general: this.$t('NotificationsPage.typeGeneral')
            };
            return map[type] || this.$t('NotificationsPage.typeGeneral');
        },
        typeColor(type) {
            if (type === 'download_anomaly') return 'error';
            if (type === 'merge_request') return 'secondary';
            if (type === 'survey') return 'warning';
            return 'primary';
        },
        relativeTime(timeStamp) {
            if (!timeStamp) return '';
            try {
                const locale = (this.$i18n?.locale || 'ko').startsWith('ko') ? ko : enUS;
                return formatDistanceToNowStrict(new Date(timeStamp), { addSuffix: true, locale });
            } catch {
                return '';
            }
        },
        async openNotification(item) {
            this.menuOpen = false;
            try {
                await backend.setNotifications(item);
            } catch (e) {
                console.error('알림 읽음 처리 실패:', e);
            }
            this.items = this.items.filter((n) => n.id !== item.id);
            this.notificationsStore.refreshUnreadCount();
            const target = await resolveNotificationTarget(backend, item);
            if (target) {
                this.$router.push(target);
            }
        },
        goToNotificationsPage() {
            this.menuOpen = false;
            this.$router.push('/notifications');
        }
    }
};
</script>

<style scoped>
.notification-quick-panel {
    display: flex;
    flex-direction: column;
}
.notification-quick-scroll {
    max-height: 340px;
    overflow-y: auto;
}
.quick-item-title {
    word-wrap: break-word;
    white-space: normal;
}
</style>
