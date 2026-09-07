/**
 * 푸시 알림 등록.
 *
 * 서버에는 **보내는 쪽만 있고 등록하는 쪽이 없었다.** fcm_service 는
 * `user_devices` 에서 기기 토큰을 읽어 발송하는데, 그 표에 토큰을 넣는 코드가
 * 어디에도 없었다. 이 파일이 그 빠진 절반이다.
 *
 * 웹에서는 아무 일도 하지 않는다
 *   기기 토큰은 앱으로 설치했을 때만 얻을 수 있다. 브라우저에서 열었을 때
 *   실패로 처리하면 사용자는 자기가 뭘 잘못한 줄 알게 된다. 그냥 "이 환경에서는
 *   해당 없음" 이라고 말한다.
 *
 * 한 사용자당 기기 하나
 *   표의 기본키가 이메일이라 그렇다. 휴대폰과 태블릿을 함께 쓰면 나중에
 *   로그인한 쪽만 알림을 받는다. 여러 대를 받으려면 표와 발송 쪽을 함께 고쳐야
 *   하므로 여기서는 다루지 않는다.
 */

export const TABLE = 'user_devices';

/**
 * 지금이 설치된 앱 안인가.
 *
 * Capacitor 는 앱 안에서만 전역을 심는다. 없으면 브라우저다.
 */
export function isNativeApp(win = globalThis) {
    const cap = win?.Capacitor;
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') return Boolean(cap.isNativePlatform());
    return Boolean(cap.isNative);
}

/**
 * 표에 넣을 한 줄을 만든다.
 *
 * `user_email` 을 호출자가 정하게 두지 않는다. 남의 이메일을 넣으면 그 사람의
 * 알림을 가로채게 되기 때문이다. 데이터베이스도 같은 것을 막고 있지만(RLS),
 * 여기서도 세션에서 읽은 값만 쓰도록 좁혀 둔다.
 */
export function deviceRow(session, token, at = new Date().toISOString()) {
    const email = session?.user?.email;
    const value = (token || '').toString().trim();
    if (!email || !value) return null;

    return {
        user_email: email,
        device_token: value,
        last_access_at: at
    };
}

/**
 * 이 기기를 알림 받을 곳으로 등록한다.
 *
 * 같은 사용자가 다시 등록하면 덮어쓴다 — 기기를 바꾸거나 토큰이 갱신되면
 * 옛 토큰으로 계속 보내다 아무 데도 닿지 않게 된다.
 */
export async function registerDevice({ supabase, session, token, at = undefined }) {
    const row = deviceRow(session, token, at);
    if (!row) return { ok: false, reason: 'invalid' };

    const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_email' });
    if (error) return { ok: false, reason: 'rejected', error };
    return { ok: true };
}

/** 알림을 끈다. 행을 지우면 보낼 곳이 없어져 발송이 멈춘다. */
export async function unregisterDevice({ supabase, session }) {
    const email = session?.user?.email;
    if (!email) return { ok: false, reason: 'invalid' };

    const { error } = await supabase.from(TABLE).delete().eq('user_email', email);
    if (error) return { ok: false, reason: 'rejected', error };
    return { ok: true };
}

/** 지금 이 계정으로 알림이 켜져 있는가. */
export async function isRegistered({ supabase, session }) {
    const email = session?.user?.email;
    if (!email) return false;

    const { data, error } = await supabase.from(TABLE).select('device_token').eq('user_email', email).limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
}

/**
 * 앱에서 기기 토큰을 받아 등록까지 한다.
 *
 * Capacitor 플러그인은 앱으로 설치했을 때만 있다. 그래서 import 하지 않고
 * 런타임 전역에서 찾는다 — 없는 패키지를 import 하면 웹 빌드가 실패한다.
 */
export async function enablePush({
    supabase,
    session,
    loadPlugin = defaultLoadPlugin,
    checkAvailable = pushConfigured
}) {
    if (!isNativeApp()) return { ok: false, reason: 'not-an-app' };

    const plugin = await loadPlugin();
    if (!plugin) return { ok: false, reason: 'plugin-missing' };

    // 설정이 없는데 register() 를 부르면 자바 쪽에서 예외가 나 **앱이 죽는다.**
    // 자바스크립트로는 잡을 수 없으므로, 부르기 전에 막는다.
    if (!(await checkAvailable())) return { ok: false, reason: 'not-configured' };

    const permission = await plugin.requestPermissions();
    if (permission?.receive !== 'granted') return { ok: false, reason: 'denied' };

    const token = await new Promise((resolve) => {
        // 토큰은 등록 요청 뒤 이벤트로 온다. 오지 않는 경우가 있어 기다림에 끝을 둔다 —
        // 없으면 "알림 켜는 중" 에서 영원히 멈춘다.
        const timer = setTimeout(() => resolve(null), 10000);
        plugin.addListener('registration', (t) => {
            clearTimeout(timer);
            resolve(t?.value || null);
        });
        plugin.register();
    });

    if (!token) return { ok: false, reason: 'no-token' };
    return registerDevice({ supabase, session, token });
}

/**
 * 이 빌드에 알림 설정이 들어 있는가.
 *
 * 안드로이드는 Firebase 설정 파일이 있어야 기기 토큰을 받을 수 있다. 없으면
 * 등록을 시도하는 순간 네이티브에서 예외가 나고 앱이 그대로 종료된다.
 * 그래서 우리가 넣어 둔 작은 네이티브 플러그인에게 먼저 물어본다.
 *
 * 물어볼 상대가 없으면(예: iOS — 거기서는 Firebase 가 필요 없다) 막지 않는다.
 */
export async function pushConfigured(win = globalThis) {
    const checker = win?.Capacitor?.Plugins?.PushSupport;
    if (!checker?.isAvailable) return true;
    try {
        const result = await checker.isAvailable();
        return Boolean(result?.available);
    } catch (_e) {
        return false;
    }
}

/**
 * 푸시 플러그인을 가져온다.
 *
 * `import '@capacitor/push-notifications'` 로 쓰지 않는다. 그러면 웹 빌드에서
 * 번들러가 없는 패키지를 찾다가 빌드 자체가 실패한다. 앱으로 설치하면 네이티브
 * 쪽이 이 전역에 플러그인을 올려 주므로, 있으면 쓰고 없으면 없는 대로 둔다.
 */
function defaultLoadPlugin() {
    return globalThis?.Capacitor?.Plugins?.PushNotifications || null;
}
