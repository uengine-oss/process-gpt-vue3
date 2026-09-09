/**
 * 앱으로 설치했을 때만 필요한 것들.
 *
 * 세 가지다.
 *   1) 알림을 눌러 들어왔을 때 그 건으로 바로 보내기
 *   2) 안드로이드 뒤로 가기 버튼
 *   3) 딥링크로 들어왔을 때 그 화면으로 보내기
 *
 * 1번이 이 앱의 존재 이유에 가장 가깝다. 알림을 눌렀는데 할 일 목록만 뜨면
 * 사용자는 방금 알림이 어느 건이었는지 다시 찾아야 한다.
 *
 * 브라우저에서는 아무것도 하지 않는다. 플러그인은 import 하지 않고 런타임
 * 전역에서 찾는다 — 없는 패키지를 import 하면 웹 빌드가 실패한다.
 */

function plugins(win = globalThis) {
    return win?.Capacitor?.Plugins || null;
}

export function isNativeApp(win = globalThis) {
    const cap = win?.Capacitor;
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') return Boolean(cap.isNativePlatform());
    return Boolean(cap.isNative);
}

/** 알림을 눌렀는데 갈 곳을 모를 때. 빈 화면보다 낫다. */
export const FALLBACK_ROUTE = '/tasks';

/**
 * 서버가 알려 준 웹 주소를 앱 화면으로 옮긴다.
 *
 * 알림에는 포털(웹)의 주소가 담겨 온다 — 그 알림을 만드는 데이터베이스 트리거가
 * 웹 화면 기준으로 적기 때문이다. 앱의 경로는 그것과 달라서 그대로 쓰면
 * 아무 데도 닿지 않는다.
 *
 *   /todolist/<id>      →  /tasks/<id>       그 업무 처리 화면
 *   /chats?id=<id>      →  /chat/<id>        그 대화방
 *   /instances/<id>     →  /instances/<id>   그 건의 진행 상황
 */
export function routeForUrl(url) {
    const raw = (url || '').toString().trim();
    if (!raw) return null;

    // 절대 주소로 올 수도 있다. 경로 부분만 본다.
    const path = raw.replace(/^[a-z]+:\/\/[^/]+/i, '');

    const todo = path.match(/^\/todolist\/([^/?#]+)/);
    if (todo) return `/tasks/${encodeURIComponent(decodeURIComponent(todo[1]))}`;

    const chatQuery = path.match(/^\/chats\?(?:.*[&?])?id=([^&#]+)/);
    if (chatQuery) return `/chat/${encodeURIComponent(decodeURIComponent(chatQuery[1]))}`;

    const chatPath = path.match(/^\/chats?\/([^/?#]+)/);
    if (chatPath) return `/chat/${encodeURIComponent(decodeURIComponent(chatPath[1]))}`;

    const inst = path.match(/^\/instances?\/([^/?#]+)/);
    if (inst) return `/instances/${encodeURIComponent(decodeURIComponent(inst[1]))}`;

    return null;
}

/**
 * 알림에 담긴 내용에서 갈 곳을 정한다.
 *
 * 알림을 눌렀는데 목록만 뜨면 사용자는 방금 그 알림이 어느 건이었는지 다시
 * 찾아야 한다 — 알림을 받는 의미가 절반으로 준다.
 *
 * 서버(fcm_service)가 실제로 싣는 것은 `type` 과 `url` 뿐이다. 예전 코드는
 * task_id · chat_room_id 같은 칸을 봤는데 그런 칸은 오지 않아, 무엇을 눌러도
 * 늘 할 일 목록으로 갔다. 그래서 url 을 먼저 본다.
 */
export function routeForNotification(payload) {
    const data = payload?.notification?.data || payload?.data || payload || {};

    const fromUrl = routeForUrl(data.url);
    if (fromUrl) return fromUrl;

    // 서버가 나중에 식별자를 직접 싣게 되면 그때도 동작하도록 남겨 둔다.
    const taskId = data.task_id || data.taskId || data.todo_id;
    if (taskId) return `/tasks/${encodeURIComponent(String(taskId))}`;

    const roomId = data.chat_room_id || data.chatRoomId || data.room_id;
    if (roomId) return `/chat/${encodeURIComponent(String(roomId))}`;

    const instId = data.proc_inst_id || data.instId;
    if (instId) return `/instances/${encodeURIComponent(String(instId))}`;

    // 종류만 아는 경우. 적어도 맞는 탭으로 보낸다.
    const type = (data.type || '').toString().toLowerCase();
    if (type === 'chat') return '/chat';

    return FALLBACK_ROUTE;
}

/**
 * 딥링크 주소에서 갈 곳을 정한다.
 *
 * 앱은 해시(#) 방식으로 화면을 나누므로 그 뒷부분이 곧 경로다.
 * 알 수 없으면 목록으로 보낸다.
 */
export function routeForDeepLink(url) {
    const raw = (url || '').toString();
    const hash = raw.indexOf('#');
    if (hash < 0) return '/tasks';

    const path = raw.slice(hash + 1);
    return path.startsWith('/') ? path : '/tasks';
}

/**
 * 앱 전용 동작을 붙인다.
 *
 * @param {object} router  vue-router
 * @param {object} win     테스트에서 가짜 전역을 넣기 위해 받는다
 * @returns 떼어내는 함수
 */
export function attachNativeBehaviour(router, win = globalThis, onForegroundPush = null) {
    if (!isNativeApp(win)) return () => {};

    const p = plugins(win);
    const handles = [];

    // 알림을 눌러 들어온 경우
    if (p?.PushNotifications?.addListener) {
        handles.push(
            p.PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
                router.push(routeForNotification(event));
            })
        );

        // 앱을 보고 있는 동안 온 알림. 기기가 배너를 띄우지 않으므로 앱이 띄운다 —
        // 그러지 않으면 내 차례가 왔는데 아무 일도 없었던 것처럼 지나간다.
        if (onForegroundPush) {
            handles.push(
                p.PushNotifications.addListener('pushNotificationReceived', (event) => {
                    onForegroundPush(event);
                })
            );
        }
    }

    // 딥링크
    if (p?.App?.addListener) {
        handles.push(
            p.App.addListener('appUrlOpen', (event) => {
                router.push(routeForDeepLink(event?.url));
            })
        );

        // 안드로이드 뒤로 가기. 기본 동작은 앱을 그냥 닫는 것이라, 화면 하나만
        // 들어와 있어도 곧바로 종료된다.
        handles.push(
            p.App.addListener('backButton', () => {
                if (window.history.length > 1) {
                    router.back();
                    return;
                }
                p.App.exitApp?.();
            })
        );
    }

    return () => {
        for (const h of handles) {
            try {
                // addListener 는 즉시 핸들을 주기도 하고 Promise 를 주기도 한다.
                if (h && typeof h.then === 'function') h.then((x) => x?.remove?.());
                else h?.remove?.();
            } catch (_e) {}
        }
    };
}

/**
 * 알림을 눌러 앱이 **처음 켜진** 경우 그 알림으로 보낸다.
 *
 * 왜 이벤트만으로는 안 되는가
 *   앱이 꺼져 있을 때는 알림 탭이 앱을 켜는 동시에 일어난다. 그 순간
 *   자바스크립트는 아직 없어서 `pushNotificationActionPerformed` 를 들을 사람이
 *   없다. Capacitor 는 그 이벤트를 다시 쏘지 않으므로 그대로 사라진다 —
 *   실제로 알림을 눌러도 늘 첫 화면만 열렸다.
 *
 *   그래서 네이티브가 실행 인텐트에 담아 둔 내용을 직접 꺼내 온다.
 */
export async function consumeLaunchNotification(router, win = globalThis) {
    const checker = win?.Capacitor?.Plugins?.PushSupport;
    if (!checker?.consumeLaunchNotification) return null;

    try {
        const result = await checker.consumeLaunchNotification();
        if (!result?.found) return null;

        const route = routeForNotification({ data: result.data || {} });
        if (route) await router.replace(route);
        return route;
    } catch (_e) {
        // 못 꺼내도 앱은 정상으로 뜬다. 첫 화면이 보일 뿐이다.
        return null;
    }
}
