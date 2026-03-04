import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend() as any;

export const useNotificationStore = defineStore('notification', {
    state: () => ({
        notifications: [] as any[],
        initialized: false,
    }),
    getters: {
        unreadCount: (state) => state.notifications.length,
    },
    actions: {
        async init() {
            if (this.initialized) return;
            this.initialized = true;

            await this.fetchNotifications();

            try {
                await backend.watchNotifications((payload: any) => {
                    if (payload?.new && payload.new.is_checked === false) {
                        this.fetchNotifications();
                    }
                });
            } catch (e) {
                console.warn('[NotificationStore] watchNotifications failed:', e);
            }
        },
        async fetchNotifications() {
            try {
                this.notifications = await backend.fetchNotifications();
            } catch (e) {
                console.warn('[NotificationStore] fetchNotifications failed:', e);
                this.notifications = [];
            }
        },
        async markAsRead(item: any) {
            try {
                await backend.setNotifications(item);
                await this.fetchNotifications();
            } catch (e) {
                console.warn('[NotificationStore] markAsRead failed:', e);
            }
        },
    },
});
