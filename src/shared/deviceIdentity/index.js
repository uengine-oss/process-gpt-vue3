/**
 * 이 기기는 무엇인가.
 *
 * 왜 필요한가
 *   알림 표(`user_devices`)의 열쇠가 이메일 하나였다. 그래서 한 사람은 기기를
 *   하나만 가질 수 있었고, 회사 PC 에서 웹을 켜면 휴대폰 토큰이 덮어써져
 *   **휴대폰 알림이 조용히 끊겼다.** 반대도 마찬가지다. 끊긴 줄도 모른다.
 *
 *   메신저들이 하는 방식은 다르다. 기기마다 한 줄을 두고, 지금 쓰고 있는 기기로
 *   보낸다. 아무 기기도 안 쓰고 있으면 가진 기기 모두에 보낸다 — 어느 것을 집어
 *   들든 보이게.
 *
 * 기기를 무엇으로 구분하는가
 *   토큰으로 구분하면 안 된다. 토큰은 앱을 다시 깔거나 오래 두면 바뀌는데,
 *   그때마다 새 기기가 하나 더 생겨 죽은 줄이 쌓인다.
 *
 *   그래서 기기가 스스로 만든 식별자를 쓴다. 한 번 만들어 그 기기에 보관하고,
 *   토큰이 바뀌어도 같은 줄을 갱신한다. 브라우저 프로필 하나가 곧 기기 하나다.
 *
 * 웹과 앱이 같은 규칙을 써야 한다 — 다르면 같은 사람의 기기가 서로 다른 방식으로
 * 등록돼, 어느 쪽에서 보낸 알림인지에 따라 결과가 달라진다.
 */

export const DEVICE_ID_KEY = 'processgpt.deviceId';

/** 저장소가 막힌 환경(사생활 보호 모드 등)도 있다. 없으면 없는 대로 돈다. */
function storeOf(win) {
    try {
        return win?.localStorage || null;
    } catch (_e) {
        return null;
    }
}

function newId() {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (_e) {
        // 아래 대체 방법으로 간다.
    }
    return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 이 기기의 식별자. 없으면 만들어 보관한다.
 *
 * 보관에 실패해도 식별자는 돌려준다. 그때는 열 때마다 새 기기로 보여 줄이 쌓이지만,
 * 알림이 아예 안 가는 것보다는 낫다. 죽은 줄은 발송 쪽에서 정리한다.
 */
export function deviceId(win = globalThis) {
    const store = storeOf(win);
    try {
        const saved = store?.getItem(DEVICE_ID_KEY);
        if (saved && saved.trim()) return saved.trim();
    } catch (_e) {
        // 못 읽으면 새로 만든다.
    }

    const made = newId();
    try {
        store?.setItem(DEVICE_ID_KEY, made);
    } catch (_e) {
        // 못 적어도 이번 회차에는 쓸 수 있다.
    }
    return made;
}

/**
 * 어떤 종류의 기기인가.
 *
 * 사용자에게 "어느 기기로 알림이 가고 있는지" 를 말해 주려면 필요하다.
 * 발송 규칙 자체는 종류를 보지 않는다 — 최근에 쓴 기기인가만 본다.
 */
export function deviceType(win = globalThis) {
    const cap = win?.Capacitor;
    const native =
        cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : Boolean(cap.isNative));

    if (!native) return 'web';

    const platform = String(cap?.getPlatform?.() || '').toLowerCase();
    if (platform === 'ios' || platform === 'android') return platform;
    return 'app';
}
