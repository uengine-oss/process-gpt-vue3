import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';
import { EventBus } from '@/utils/eventBus';

const backend: any = BackendFactory.createBackend();

/**
 * 미확인 알림 건수 공용 상태.
 *
 * PAL 은 헤더(NotificationDD)를 쓰지 않으므로 사이드바 뱃지·알림 페이지가 이 스토어를
 * 통해 건수를 공유하고, realtime 구독도 여기서 한 번만 연다.
 * 비 PAL 에서는 NotificationDD 가 이미 'notifications' 채널을 구독하고 INSERT 마다
 * EventBus 'show-notification' 을 쏘므로, 채널을 중복 구독하지 않고 그 이벤트를 받는다.
 */
export const useNotificationsStore = defineStore('notifications', {
    state: () => ({
        unreadCount: 0,
        /** realtime 이벤트가 올 때마다 1 증가 — 목록 화면이 watch 해서 재조회한다. */
        pulse: 0,
        watching: false
    }),
    actions: {
        async refreshUnreadCount() {
            try {
                if (typeof backend.fetchAllNotifications === 'function') {
                    const list = await backend.fetchAllNotifications({ unreadOnly: true, size: 500 });
                    this.unreadCount = (list || []).length;
                } else {
                    // 드롭다운용 API 는 같은 url 알림을 묶어 주므로 count 를 합산한다.
                    const grouped = (await backend.fetchNotifications()) || [];
                    this.unreadCount = grouped.reduce((sum: number, item: any) => sum + (item.count || 1), 0);
                }
            } catch (e) {
                console.error('알림 미확인 건수 조회 실패:', e);
            }
        },
        async ensureWatching() {
            if (this.watching) return;
            this.watching = true;
            await this.refreshUnreadCount();
            const onEvent = () => {
                this.pulse += 1;
                void this.refreshUnreadCount();
            };
            try {
                if ((window as any).$pal) {
                    await backend.watchNotifications((payload: any) => {
                        if (payload) onEvent();
                    });
                } else {
                    EventBus.on('show-notification', onEvent);
                }
            } catch (e) {
                console.error('알림 realtime 구독 실패:', e);
                this.watching = false;
            }
        }
    }
});
