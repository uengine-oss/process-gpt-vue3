/**
 * 알림 클릭 시 이동할 곳을 계산하는 공용 로직.
 * 알림 페이지(NotificationsPage)와 사이드바 퀵 패널(NotificationSidebarMenu)이 함께 쓴다.
 * 규칙은 헤더 드롭다운(NotificationDD.checkNotification)과 동일하다.
 */
export function getChatRoomIdFromUrl(url: any): string | null {
    if (!url || typeof url !== 'string') return null;
    try {
        const parsed = new URL(url, window.location.origin);
        const id = parsed.searchParams.get('id');
        return id ? decodeURIComponent(id) : null;
    } catch (e) {
        const match = url.match(/[?&]id=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }
}

/** router.push 에 그대로 넘길 수 있는 값(문자열 또는 location 객체)을 돌려준다. 이동할 곳이 없으면 null. */
export async function resolveNotificationTarget(backend: any, item: any): Promise<any | null> {
    if (item?.type === 'workitem') return '/todolist';
    if (item?.type === 'chat') {
        const roomId = getChatRoomIdFromUrl(item.url) || item.url?.replace('/chats?id=', '');
        if (roomId) {
            let room: any = null;
            try {
                const idx = JSON.parse(localStorage.getItem('chatRoomIndex') || '{}');
                room = idx && idx[roomId] ? idx[roomId] : null;
            } catch (e) {}
            if (!room) {
                try {
                    room = await backend.getChatRoom(roomId);
                } catch (e) {}
            }
            if (room && room.id) {
                return { path: '/chat', query: { roomId: room.id }, hash: '' };
            }
        }
    }
    return item?.url || null;
}
