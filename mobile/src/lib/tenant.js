/**
 * 이 사용자가 어느 조직 소속인가.
 *
 * 포털은 주소로 안다 — `uengine.process-gpt.io` 의 맨 앞이 조직 이름이다.
 * 앱 안에서는 그 방법이 통하지 않는다. Capacitor 는 페이지를 `localhost` 로 띄우므로
 * 주소에 조직 이름이 들어갈 자리가 없다.
 *
 * 그래서 **로그인 세션에서 읽는다.** 세션은 서버가 서명한 것이라 사용자가 고칠 수
 * 없고, 어차피 데이터베이스도 같은 세션을 근거로 접근을 판단한다. 주소보다 오히려
 * 정확한 출처다.
 *
 * 조직 이름을 알아야 하는 이유가 하나 더 있다: completion 서비스는 요청이 들어온
 * 주소의 앞부분으로 조직을 판단한다. 그래서 앱은 그 조직의 주소로 요청해야 한다.
 */

/** 포털이 조직 서버가 아니라고 알려 줄 때 쓰는 전역 이름들. */
export const TENANT_GLOBAL = '$tenantName';
export const IS_TENANT_SERVER_GLOBAL = '$isTenantServer';

/** 주소에 조직 이름을 붙일 수 없는 곳들. 개발 중에는 그냥 그 주소로 간다. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.0.2.2'];

function isLocalHost(host) {
    return LOCAL_HOSTS.some((h) => host.includes(h));
}

/**
 * 그 조직의 포털 주소를 만든다.
 *
 * @param {string|null|undefined} tenantId  조직 이름 (예: 'uengine')
 * @param {string} baseUrl   기준 주소 (예: 'https://process-gpt.io')
 * @returns {string}
 *
 * 조직을 모르거나 개발용 주소면 기준 주소를 그대로 돌려준다 — 억지로 붙이면
 * 존재하지 않는 곳을 가리키게 되고, 그때 나는 오류는 원인이 드러나지 않는다.
 */
export function portalOriginFor(tenantId, baseUrl) {
    const base = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return '';

    let url;
    try {
        url = new URL(base);
    } catch (_e) {
        return base;
    }

    const tenant = (tenantId || '').trim();
    if (!tenant || isLocalHost(url.hostname)) return `${url.protocol}//${url.host}`;

    // 이미 그 조직 주소면 그대로 둔다. 붙이면 uengine.uengine.process-gpt.io 가 된다.
    if (url.hostname === tenant || url.hostname.startsWith(`${tenant}.`)) {
        return `${url.protocol}//${url.host}`;
    }

    const port = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${tenant}.${url.hostname}${port}`;
}

/**
 * 알아낸 조직을 포털 코드가 보는 자리에 심는다.
 *
 * 재사용하는 화면·API 계층이 `window.$tenantName` 을 읽는다. 포털은 부팅할 때
 * 한 번 정하고 고정하지만, 앱에서는 로그인해야 알 수 있으므로 나중에 바꿀 수
 * 있게 둔다(계정 전환).
 */
export function applyTenant(tenantId, win = globalThis) {
    const tenant = (tenantId || '').trim() || null;

    Object.defineProperty(win, TENANT_GLOBAL, {
        value: tenant,
        writable: false,
        configurable: true // 계정을 바꾸면 다시 정해야 한다
    });
    Object.defineProperty(win, IS_TENANT_SERVER_GLOBAL, {
        // 앱은 언제나 특정 조직으로 들어간다. 조직 선택 화면(포털의 최상위 도메인)은 없다.
        value: false,
        writable: false,
        configurable: true
    });
}

/**
 * 세션 하나에서 조직을 읽는다.
 *
 * `app_metadata` 만 본다. `user_metadata` 는 **사용자가 직접 고칠 수 있어서**,
 * 그것을 믿으면 남의 조직 자료를 달라고 말할 수 있게 된다.
 *
 * 여기서 못 찾으면 null 이다. 그때는 `@/utils/authClaims` 가 사용자 레코드까지
 * 뒤져 알아낸다 — 이 함수는 그 앞단의 빠른 길일 뿐이다.
 */
export function tenantFromSession(session) {
    const appMetadata = session?.user?.app_metadata;
    const tenant = appMetadata && typeof appMetadata === 'object' ? appMetadata.tenant_id : null;
    return typeof tenant === 'string' && tenant.trim() ? tenant.trim() : null;
}
