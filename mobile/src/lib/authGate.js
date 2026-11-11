/**
 * 화면을 열기 전 인증 관문.
 *
 * 휴대폰 웹(포털과 같은 주소의 /m/)은 포털과 같은 Supabase 세션을 쓴다. 그래서 로그인 · 2단계 인증(TOTP)
 * · 등록은 포털 화면이 맡고, 여기서는 세션이 있는지와 포털과 같은 MFA 판정(utils/mfaGate)만 본다.
 * 못 지나가면 포털의 그 화면으로 보낸다. 휴대폰 웹이 자기 로그인 화면을 쓰면 포털의 2단계 인증과
 * 소셜 로그인을 건너뛴다 — 휴대폰 웹을 기본으로 바꾼 직후 실제로 그랬다.
 *
 * 앱(Capacitor)에는 포털 화면이 없다. 앱은 자기 로그인 화면을 쓰고, 2단계 인증이 필요한 계정은
 * 들이지 않는다(로그아웃하고 로그인 화면에서 웹 포털을 쓰라고 말한다).
 */

/** 로그인 전에 가려던 휴대폰 주소. 포털 로그인을 다녀오는 동안 같은 탭에 남긴다. */
export const NEXT_KEY = 'phoneWebNext';

export const PORTAL_LOGIN = '/auth/login';
export const PORTAL_CHALLENGE = '/auth/two-step';
export const PORTAL_ENROLL = '/account-settings?tab=Account&mfaRequired=1';

const ALLOW = { allow: true };

/**
 * 휴대폰 주소(해시 안) → 포털 주소. index.html 의 phoneWebHash 를 거꾸로 한 것이다.
 * 포털 인증 화면을 지난 뒤 포털이 이 주소를 열면, 포털이 다시 휴대폰 웹의 같은 화면으로 보낸다.
 */
export function portalPathFor(path) {
    const p = String(path || '/');
    let m = p.match(/^\/tasks\/([^/?#]+)/);
    if (m) return '/todolist/' + m[1];
    m = p.match(/^\/instances\/([^/?#]+)/);
    if (m) return '/instancelist/' + m[1];
    if (/^\/progress(?:\/|$)/.test(p)) return '/instancelist/running';
    if (/^\/chat(?:\/|$)/.test(p)) return '/chats';
    if (/^\/notifications(?:\/|$)/.test(p)) return '/notifications';
    return '/todolist';
}

function isSafeNext(path) {
    return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/login');
}

function remember(storage, path) {
    try {
        if (isSafeNext(path) && path !== '/tasks') storage?.setItem(NEXT_KEY, path);
    } catch (_e) {
        /* 저장을 못 하면 로그인 뒤 할 일로 간다 */
    }
}

function takeNext(storage) {
    try {
        const next = storage?.getItem(NEXT_KEY);
        if (next) storage.removeItem(NEXT_KEY);
        return isSafeNext(next) ? next : null;
    } catch (_e) {
        return null;
    }
}

/**
 * 어디로 보낼지 정한다.
 *   { allow: true }      그대로 연다
 *   { route }            앱 안의 다른 화면으로
 *   { location }         포털 화면으로(휴대폰 웹)
 *   { signOut: true }    로그아웃한 뒤 route 로(앱 — 2단계 인증이 필요한 계정)
 *
 * @param to        vue-router 의 to (path · fullPath · name · meta)
 * @param deps.web      휴대폰 웹인가(앱이 아닌가)
 * @param deps.session  지금 세션(없으면 null)
 * @param deps.evaluate 포털 주소를 받아 'pass' | 'challenge' | 'enroll' (utils/mfaGate 의 evaluateMfaGate)
 * @param deps.storage  sessionStorage
 */
export async function decide(to, { web, session, evaluate, storage }) {
    const isLogin = to.name === 'login';

    if (!session) {
        if (web) {
            if (!isLogin) remember(storage, to.fullPath);
            return { location: PORTAL_LOGIN };
        }
        if (to.meta?.public) return ALLOW;
        // 로그인 후 원래 가려던 곳으로 돌려보낸다. 알림을 눌러 들어왔는데 로그인이
        // 풀려 있으면, 로그인 후 목록이 아니라 그 건으로 가야 한다.
        return { route: { name: 'login', query: to.fullPath === '/tasks' ? {} : { next: to.fullPath } } };
    }

    if (isLogin) return web ? { route: '/tasks' } : ALLOW;

    const portalPath = portalPathFor(to.path);
    const decision = await evaluate(portalPath);
    if (decision === 'challenge' || decision === 'enroll') {
        if (!web) return { signOut: true, route: { name: 'login', query: { mfa: '1' } } };
        if (decision === 'challenge') return { location: `${PORTAL_CHALLENGE}?redirect=${encodeURIComponent(portalPath)}` };
        return { location: PORTAL_ENROLL };
    }

    const next = web ? takeNext(storage) : null;
    if (next && next !== to.fullPath) return { route: next };
    return ALLOW;
}
