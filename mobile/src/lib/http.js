/**
 * 서버로 나가는 요청의 기본값.
 *
 * 왜 필요한가
 *   재사용하는 코드들은 `axios.get('/memento/documents/list')` 처럼 **상대 경로**로
 *   부른다. 브라우저 포털에서는 화면과 서버가 같은 주소라 그대로 맞는다.
 *   그런데 앱의 화면 주소는 `https://localhost` (Capacitor 가 앱 안에 띄우는
 *   내부 서버)라, 같은 코드가 **앱 자신에게** 요청하게 된다.
 *
 *   더 나쁜 것은 실패조차 하지 않는다는 점이다. 앱 내부 서버는 무엇을 물어도
 *   화면 HTML 을 200 으로 돌려주므로, 호출한 쪽은 "성공했는데 내용이 비었다" 로
 *   읽는다. 그래서 지식 베이스는 늘 "문서가 없습니다" 였고, 음성 입력은 녹음까지
 *   되고도 받아쓴 글이 늘 비어 있었다. 오류 한 줄 남지 않는다.
 *
 *   그리고 앞단(게이트웨이)은 /memento · /completion · /agent 를 토큰 없이는
 *   받지 않는다. 포털은 쿠키로 보내지만 앱에는 그 쿠키가 없다. 헤더로 실어야 한다.
 */

/** 앱 자신에게 보내는 주소인가. 이런 주소는 서버로 바꿔야 한다. */
export function isSelfOrigin(origin) {
    const value = (origin || '').toString();
    return /^https?:\/\/localhost(?::\d+)?$/i.test(value) || value === '';
}

/** 상대 경로인가. 절대 주소는 부른 쪽이 이미 정한 것이므로 건드리지 않는다. */
export function isRelative(url) {
    const value = (url || '').toString();
    return value.startsWith('/') && !value.startsWith('//');
}

/**
 * 이 요청이 실제로 나갈 주소.
 *
 * 상대 경로일 때만 서버 주소를 앞에 붙인다.
 */
export function resolveUrl(url, origin) {
    if (!isRelative(url)) return url;
    const base = (origin || '').replace(/\/+$/, '');
    return base ? `${base}${url}` : url;
}

/**
 * 요청에 실을 헤더.
 *
 * 토큰이 없으면 붙이지 않는다 — 빈 `Bearer ` 를 보내면 앞단이 토큰이 없는 것이
 * 아니라 **잘못된 토큰**으로 보고 다른 오류를 낸다.
 */
export function authHeaders({ token, tenant }) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (tenant) headers['X-Tenant-Id'] = tenant;
    return headers;
}

/**
 * 공용 axios 인스턴스를 앱용으로 맞춘다.
 *
 * 포털은 이 함수를 부르지 않는다(앱 진입점에서만 부른다). 같은 파일을 쓰지만
 * 빌드가 갈라져 있어 포털 동작에는 영향이 없다.
 *
 * @param {object} axios      공용 인스턴스
 * @param {object} deps
 *   originOf  지금 이 조직의 서버 주소를 돌려주는 함수 (조직을 알아낸 뒤 바뀐다)
 *   tokenOf   지금 유효한 토큰을 돌려주는 함수
 *   tenantOf  지금 소속 조직
 */
export function configure(axios, { originOf, tokenOf, tenantOf }) {
    axios.interceptors.request.use(async (config) => {
        const origin = originOf?.();
        if (!isSelfOrigin(origin)) config.url = resolveUrl(config.url, origin);

        let token = null;
        try {
            token = await tokenOf?.();
        } catch (_e) {
            // 토큰을 못 얻어도 요청은 보낸다. 앞단이 이유를 말해 준다.
        }

        config.headers = { ...(config.headers || {}), ...authHeaders({ token, tenant: tenantOf?.() }) };
        return config;
    });
    return axios;
}
