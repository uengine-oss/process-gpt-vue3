/**
 * 개발 서버가 에이전트 채팅(`/process-gpt-<agent>/**`)을 어디로 보내는지.
 *
 * vite.config.ts 안에 인라인으로 있던 것을 여기로 뺐다. 규칙 두 가지가 배포 환경과
 * 어긋나면 화면에서만 드러나고 단위 테스트로는 잡히지 않아서, 테스트가 볼 수 있는
 * 곳에 둔다.
 *
 * 1. **게이트웨이로 보낼 때는 prefix 를 벗기지 않는다.** 어느 에이전트인지는 그
 *    prefix 로만 구분되고, 벗기는 것은 게이트웨이의 일이다(gateway application.yml 의
 *    `RewritePath=/process-gpt-codex/?(?<segment>.*), /${segment}`). 여기서 미리
 *    벗겨 보내면 게이트웨이가 라우트를 찾지 못해 404 가 난다.
 *
 * 2. **changeOrigin 을 켜지 않는다.** 게이트웨이는 Host 의 첫 라벨로 테넌트를 정하고
 *    `X-Tenant-Id` 를 그 값으로 덮어쓴다. changeOrigin 은 Host 를 프록시 타깃으로
 *    바꿔 버려서, `127.0.0.1:18090` 이면 테넌트가 '127' 이 되고 모든 채팅 요청이
 *    403 으로 끊긴다.
 *
 * 게이트웨이를 거치지 않을 때(기본)는 예전처럼 각 에이전트 프로세스로 직접 가고,
 * 그때는 게이트웨이가 없으니 prefix 를 여기서 벗긴다.
 */

/** 에이전트별 기본 직결 포트. deepagents 8888 · codex 8891. */
export const AGENT_DIRECT_TARGETS = {
    '/process-gpt-deepagents': 'http://127.0.0.1:8888',
    '/process-gpt-codex': 'http://127.0.0.1:8891'
};

export function agentProxy(prefix, directTarget, gatewayTarget = '') {
    const gateway = (gatewayTarget ?? '').toString().trim();
    if (gateway) {
        return { target: gateway, changeOrigin: false, timeout: 0, proxyTimeout: 0 };
    }
    return {
        target: directTarget,
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(new RegExp('^' + prefix), '')
    };
}

/** `server.proxy` 에 펼쳐 넣을 항목들. 키에 슬래시가 붙는 것은 vite 의 prefix 매칭 규칙. */
export function buildAgentProxies(gatewayTarget = '') {
    const rules = {};
    for (const [prefix, direct] of Object.entries(AGENT_DIRECT_TARGETS)) {
        rules[`${prefix}/`] = agentProxy(prefix, direct, gatewayTarget);
    }
    return rules;
}
