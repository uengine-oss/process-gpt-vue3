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
 * 기기마다 한 줄
 *   예전에는 표의 열쇠가 이메일 하나여서 사람당 기기가 하나였다. 회사 PC 에서
 *   웹을 켜면 휴대폰 토큰이 덮어써져 **휴대폰 알림이 조용히 끊겼다.** 반대도
 *   같다. 지금은 기기가 스스로 만든 식별자(@/shared/deviceIdentity)로 자기
 *   줄만 갱신한다.
 *
 *   어느 기기로 보낼지는 보내는 쪽이 정한다 — 지금 쓰고 있는 기기가 있으면
 *   거기로만, 아무 기기도 안 쓰고 있으면 가진 기기 모두로. 그래서 앱은 쓰이고
 *   있는 동안 자기가 살아 있다고 알려야 한다(touchDevice).
 */

import { deviceId, deviceType } from '../../../src/shared/deviceIdentity/index.js';

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
export function deviceRow(session, token, at = new Date().toISOString(), win = globalThis) {
    const email = session?.user?.email;
    const value = (token || '').toString().trim();
    if (!email || !value) return null;

    return {
        user_email: email,
        // 기기를 가리키는 열쇠. 토큰이 갱신돼도 같은 줄을 고친다 — 토큰으로
        // 구분하면 갱신될 때마다 죽은 줄이 하나씩 쌓인다.
        device_id: deviceId(win),
        device_type: deviceType(win),
        device_token: value,
        // 보내는 쪽이 "지금 쓰고 있는 기기" 를 고르는 근거.
        last_active_at: at,
        last_access_at: at
    };
}

/**
 * 이 기기를 알림 받을 곳으로 등록한다.
 *
 * 자기 줄만 고친다(`user_email` + `device_id`). 예전에는 이메일만으로 덮어써서
 * PC 에서 웹을 켜면 휴대폰 줄이 사라졌다 — 휴대폰 알림이 조용히 끊겼다.
 */
export async function registerDevice({ supabase, session, token, at = undefined, win = globalThis }) {
    const row = deviceRow(session, token, at, win);
    if (!row) return { ok: false, reason: 'invalid' };

    const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_email,device_id' });
    if (error) return { ok: false, reason: 'rejected', error };
    return { ok: true };
}

/**
 * 알림을 끈다.
 *
 * **이 기기 줄만** 지운다. 이메일로 지우면 사용자가 휴대폰에서 알림을 끄는 순간
 * 회사 PC 의 알림까지 함께 꺼진다 — 끈 적도 없는데 안 오게 된다.
 */
export async function unregisterDevice({ supabase, session, win = globalThis }) {
    const email = session?.user?.email;
    if (!email) return { ok: false, reason: 'invalid' };

    const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('user_email', email)
        .eq('device_id', deviceId(win));
    if (error) return { ok: false, reason: 'rejected', error };
    return { ok: true };
}

/**
 * 지금 **이 기기로** 알림이 오게 돼 있는가.
 *
 * 이 기기 줄에 토큰이 들어 있어야 켜진 것이다. 표에 아무 줄이나 있는지만 보면
 * 안 된다 — 포털은 로그인할 때마다 토큰 없는 빈 줄을 만들고, 그것을 내 것으로
 * 세면 "알림 켜짐" 으로 보여 사용자가 켤 생각을 하지 않는다. 실제로 운영
 * 192줄 중 184줄이 그런 빈 줄이었다.
 *
 * 잘못 꺼졌다고 말하면 한 번 더 누를 뿐이지만, 잘못 켜졌다고 말하면 알림은
 * 영영 오지 않는다. 그래서 확신이 없으면 꺼진 쪽으로 답한다.
 */
export async function isRegistered({ supabase, session, win = globalThis }) {
    const email = session?.user?.email;
    if (!email) return false;

    const { data, error } = await supabase
        .from(TABLE)
        .select('device_token')
        .eq('user_email', email)
        .eq('device_id', deviceId(win))
        .limit(1);
    if (error) return false;

    return (Array.isArray(data) ? data : []).some((r) => Boolean((r?.device_token || '').trim()));
}

/**
 * 이 기기를 지금 쓰고 있다고 알린다.
 *
 * 보내는 쪽은 이 시각 하나로 어디에 보낼지 정한다. 쓰고 있는 기기가 있으면
 * 거기로만, 아무 데도 없으면 가진 기기 모두로. 이것을 갱신하지 않으면 앱은
 * 언제나 "안 쓰는 기기" 라서, PC 를 켜 둔 사람은 휴대폰 알림을 받지 못한다.
 *
 * 등록하지 않은 기기에는 아무 일도 하지 않는다 — 없는 줄을 만들지 않는다.
 */
export async function touchDevice({
    supabase,
    session,
    at = undefined,
    accessPage = undefined,
    win = globalThis
}) {
    const email = session?.user?.email;
    if (!email) return { ok: false, reason: 'invalid' };

    const now = at || new Date().toISOString();
    const patch = { last_active_at: now };

    // 지금 보고 있는 화면. 대화방을 보고 있는 동안에는 그 방의 알림을 만들지
    // 않는다(데이터베이스 트리거가 이 값을 본다) — 읽고 있는 화면에 대고
    // 알림을 울리는 것은 방해일 뿐이다.
    if (accessPage !== undefined) {
        patch.access_page = accessPage || null;
        patch.last_access_at = now;
    }

    const { error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq('user_email', email)
        .eq('device_id', deviceId(win));
    if (error) return { ok: false, reason: 'rejected', error };
    return { ok: true };
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
    checkAvailable = pushConfigured,
    win = globalThis
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
    return registerDevice({ supabase, session, token, win });
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
