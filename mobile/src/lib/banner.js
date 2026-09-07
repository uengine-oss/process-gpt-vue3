/**
 * 앱이 실행 중일 때 뜨는 알림 배너.
 *
 * 왜 필요한가
 *   기기의 알림 배너는 앱이 **꺼져 있거나 뒤에 있을 때만** 뜬다. 앱을 보고 있는
 *   동안 온 알림은 안드로이드가 화면에 띄우지 않고 앱에게만 넘긴다. 그대로 두면
 *   내 차례가 왔는데도 아무 일도 일어나지 않은 것처럼 보인다.
 *
 *   그래서 앱 안에서 같은 모양의 배너를 띄운다. 누르면 그 건으로 바로 간다 —
 *   알림 서랍을 거치지 않으므로 오히려 빠르다.
 */

/** 배너가 저절로 사라지기까지. 읽고 누를 시간은 주되, 화면을 오래 가리지 않는다. */
export const AUTO_DISMISS_MS = 6000;

/**
 * 밀려 온 알림에서 배너에 쓸 것만 꺼낸다.
 *
 * 서버는 `notification`(제목·본문)과 `data`(어디로 갈지)를 함께 보낸다.
 * 안드로이드와 iOS 가 담는 자리가 조금 달라 둘 다 본다.
 */
export function toBanner(payload, routeOf) {
    if (!payload) return null;

    const data = payload.data || payload.notification?.data || {};
    const title = (payload.title || payload.notification?.title || data.title || '').toString().trim();
    const body = (payload.body || payload.notification?.body || data.body || '').toString().trim();

    // 제목도 본문도 없으면 보여 줄 것이 없다. 빈 배너는 방해만 된다.
    if (!title && !body) return null;

    return {
        // 같은 알림이 두 번 와도 하나로 본다.
        id: (data.notification_id || data.id || `${title}|${body}`).toString(),
        title: title || '새 알림',
        body,
        route: routeOf ? routeOf(payload) : null
    };
}

/**
 * 이미 보여 준 것과 같은가.
 *
 * 서버가 재시도하거나 화면이 두 번 구독하면 같은 알림이 겹쳐 쌓인다.
 */
export function isSame(current, next) {
    return Boolean(current && next && current.id === next.id);
}
