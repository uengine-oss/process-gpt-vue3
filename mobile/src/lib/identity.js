/**
 * 로그인한 사람이 누구인지를, 재사용하는 코드가 읽는 자리에 적어 둔다.
 *
 * 왜 필요한가
 *   포털의 데이터 계층은 `localStorage` 에서 사용자 정보를 읽는다. 예를 들어
 *   업무 완료(`executeInstance`)는 `localStorage.email` 을 그대로 서버에 보낸다.
 *   비워 두면 요청은 나가지만 누가 한 것인지 없이 나간다 — 실패가 아니라
 *   **조용히 잘못된 값으로 성공한다.** 그래서 눈치채기 어렵다.
 *
 *   포털은 로그인 화면에서 이 값들을 채운다. 앱은 그 화면을 쓰지 않으므로
 *   여기서 같은 일을 한다.
 */

/** 재사용 계층이 실제로 읽는 키들. */
export const KEYS = ['email', 'uid', 'userName', 'author', 'role', 'isAdmin'];

/**
 * 세션과 사용자 레코드에서 저장할 값을 만든다.
 *
 * 이름을 모를 때 이메일로 대신한다. 비워 두면 화면 곳곳에 빈칸이 생기고,
 * 업무 이력에도 "누가" 가 빠진다.
 */
export function identityFrom(session, profile = null, claims = null) {
    const user = session?.user;
    if (!user?.email) return null;

    const name = (profile?.username || user.user_metadata?.username || '').toString().trim();

    return {
        email: user.email,
        uid: user.id || '',
        userName: name || user.email,
        author: user.email,
        role: (claims?.role || profile?.role || '').toString(),
        isAdmin: String(Boolean(claims?.isAdmin ?? profile?.is_admin))
    };
}

/** 저장한다. 값이 없는 항목은 넣지 않는다 — 빈 문자열도 "설정됨" 으로 읽힌다. */
export function applyIdentity(identity, store = globalThis.localStorage) {
    if (!identity || !store) return false;
    for (const key of KEYS) {
        const value = identity[key];
        if (value === undefined || value === null || value === '') continue;
        store.setItem(key, String(value));
    }
    return true;
}

/**
 * 로그아웃할 때 지운다.
 *
 * 남겨 두면 다음 사람이 이 폰으로 로그인했을 때, 화면은 새 계정인데 요청은
 * 이전 사람 이름으로 나간다.
 */
export function clearIdentity(store = globalThis.localStorage) {
    if (!store) return;
    for (const key of KEYS) store.removeItem(key);
}

/**
 * 사용자 레코드를 읽는다. 이름을 얻는 것이 목적이다.
 *
 * 못 읽어도 진행한다 — 이름이 없다고 일을 못 하게 할 이유는 없다.
 */
export async function loadProfile(supabase, userId) {
    if (!supabase || !userId) return null;
    try {
        const { data, error } = await supabase
            .from('users')
            .select('username, role, is_admin')
            .eq('id', userId)
            .limit(1);
        if (error) return null;
        return (Array.isArray(data) ? data[0] : data) || null;
    } catch (_e) {
        return null;
    }
}
