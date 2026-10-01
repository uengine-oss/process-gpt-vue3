<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header (공통 page-header 패턴) -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">{{ $t('NotificationsPage.title') }}</h1>
                    <v-chip v-if="unreadCount > 0" color="error" variant="flat" size="small" class="text-white" rounded="xl">
                        {{ unreadCount }}
                    </v-chip>
                </div>
            </div>
            <div class="page-header-right">
                <v-btn variant="text" size="small" :loading="loading" prepend-icon="mdi-refresh" @click="fetchList">
                    {{ $t('NotificationsPage.refresh') }}
                </v-btn>
                <v-btn
                    variant="tonal"
                    color="primary"
                    size="small"
                    :disabled="unreadCount === 0"
                    :loading="markingAll"
                    prepend-icon="mdi-check-all"
                    @click="markAllRead"
                >
                    {{ $t('NotificationsPage.markAllRead') }}
                </v-btn>
            </div>
        </div>

        <v-tabs v-model="tab" color="primary" class="px-4 mt-1 flex-shrink-0">
            <v-tab value="unread">
                {{ $t('NotificationsPage.unread') }}
                <v-badge v-if="unreadCount > 0" :content="unreadCount" color="error" inline class="ml-1"></v-badge>
            </v-tab>
            <v-tab value="all">{{ $t('NotificationsPage.all') }}</v-tab>
        </v-tabs>
        <v-divider></v-divider>

        <v-card-text class="sk-page-card-text pa-0">
            <div v-if="loading && notifications.length === 0" class="pa-10 text-center">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
            </div>

            <div v-else-if="visibleNotifications.length === 0" class="pa-10 text-center text-medium-emphasis">
                <v-icon size="40" class="mb-2">mdi-bell-off-outline</v-icon>
                <div>{{ tab === 'unread' ? $t('NotificationsPage.emptyUnread') : $t('NotificationsPage.empty') }}</div>
            </div>

            <div v-else class="notification-scroll">
                <v-list lines="two" class="py-0">
                    <template v-for="(item, idx) in visibleNotifications" :key="item.id">
                        <v-list-item
                            :class="{ 'notification-unread': !item.is_checked }"
                            class="py-3"
                            @click="openNotification(item)"
                        >
                            <template v-slot:prepend>
                                <div class="mr-3 d-flex flex-column align-center">
                                    <v-chip :color="typeColor(item.type)" variant="tonal" size="x-small" label>
                                        {{ typeLabel(item.type) }}
                                    </v-chip>
                                </div>
                            </template>
                            <v-list-item-title class="font-weight-medium notification-title">
                                <span v-if="!item.is_checked" class="unread-dot mr-1"></span>
                                {{ item.title || '-' }}
                            </v-list-item-title>
                            <v-list-item-subtitle>
                                {{ item.description || '' }}
                            </v-list-item-subtitle>
                            <template v-slot:append>
                                <div class="text-caption text-medium-emphasis text-right" style="min-width: 90px">
                                    <v-tooltip :text="absoluteTime(item.time_stamp)" location="top">
                                        <template v-slot:activator="{ props }">
                                            <span v-bind="props">{{ relativeTime(item.time_stamp) }}</span>
                                        </template>
                                    </v-tooltip>
                                </div>
                            </template>
                        </v-list-item>
                        <v-divider v-if="idx < visibleNotifications.length - 1"></v-divider>
                    </template>
                </v-list>
            </div>
        </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { useNotificationsStore } from '@/stores/notifications';
import { resolveNotificationTarget } from '@/utils/notificationRouting';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const backend = BackendFactory.createBackend();

export default {
    name: 'NotificationsPage',
    data: () => ({
        tab: 'unread',
        notifications: [],
        loading: false,
        markingAll: false,
        notificationsStore: useNotificationsStore()
    }),
    computed: {
        unreadCount() {
            return this.notifications.filter((n) => !n.is_checked).length;
        },
        visibleNotifications() {
            if (this.tab === 'unread') {
                return this.notifications.filter((n) => !n.is_checked);
            }
            return this.notifications;
        }
    },
    watch: {
        // 스토어가 realtime 이벤트(PAL: 직접 구독, 비 PAL: NotificationDD 경유)마다 pulse 를 올린다.
        'notificationsStore.pulse'() {
            this.fetchList();
        }
    },
    mounted() {
        this.fetchList();
        this.notificationsStore.ensureWatching();
    },
    methods: {
        async fetchList() {
            this.loading = true;
            try {
                if (typeof backend.fetchAllNotifications === 'function') {
                    this.notifications = await backend.fetchAllNotifications({ size: 200 });
                } else {
                    this.notifications = (await backend.fetchNotifications()) || [];
                }
            } catch (e) {
                console.error('알림 목록 조회 실패:', e);
            } finally {
                this.loading = false;
            }
        },
        async markAllRead() {
            this.markingAll = true;
            try {
                if (typeof backend.markAllNotificationsRead === 'function') {
                    await backend.markAllNotificationsRead();
                }
                this.notifications = this.notifications.map((n) => ({ ...n, is_checked: true }));
                this.notificationsStore.refreshUnreadCount();
            } catch (e) {
                console.error('알림 일괄 읽음 처리 실패:', e);
            } finally {
                this.markingAll = false;
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
        dateLocale() {
            return (this.$i18n?.locale || 'ko').startsWith('ko') ? ko : enUS;
        },
        relativeTime(timeStamp) {
            if (!timeStamp) return '';
            try {
                return formatDistanceToNowStrict(new Date(timeStamp), { addSuffix: true, locale: this.dateLocale() });
            } catch {
                return '';
            }
        },
        absoluteTime(timeStamp) {
            if (!timeStamp) return '';
            try {
                return format(new Date(timeStamp), 'yyyy-MM-dd HH:mm');
            } catch {
                return '';
            }
        },
        async openNotification(item) {
            // 읽음 처리(같은 url 의 미확인 알림 일괄) 후 알림이 가리키는 곳으로 이동 — NotificationDD 와 같은 규칙.
            if (!item.is_checked) {
                try {
                    await backend.setNotifications(item);
                } catch (e) {
                    console.error('알림 읽음 처리 실패:', e);
                }
                const urlToMark = item.url || '';
                this.notifications = this.notifications.map((n) =>
                    (urlToMark ? n.url === urlToMark : n.id === item.id) ? { ...n, is_checked: true } : n
                );
                this.notificationsStore.refreshUnreadCount();
            }
            const target = await resolveNotificationTarget(backend, item);
            if (target) {
                this.$router.push(target);
            }
        }
    }
};
</script>

<style scoped>
.notification-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
}
.notification-unread {
    background: rgba(var(--v-theme-primary), 0.04);
}
.notification-title {
    word-wrap: break-word;
    white-space: normal;
}
.unread-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgb(var(--v-theme-error));
    vertical-align: middle;
}
</style>
