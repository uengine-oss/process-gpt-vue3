/**
 * 에이전트(work-assistant / agent-router / deepagents) 호출용 공통 헤더 빌더.
 *
 * 과거에는 JWT 를 요청 **본문의 user_jwt** 로만 실어 보냈다. 에이전트 프로세스 자체는
 * 본문 JWT 를 읽지만, 그 앞단(ingress / gateway) 은 Authorization 헤더가 없는 요청을
 * 미인증으로 보고 **401** 로 끊는다. uengine 호스트만 게이트웨이에 개별 라우트가 박혀 있어
 * 동작하고, 다른 테넌트 호스트에서는 stream 이 401 로 실패하던 원인이다.
 *
 * → 모든 에이전트 요청에 Authorization: Bearer 와 테넌트 헤더를 함께 실어 보낸다.
 *   (본문 user_jwt / tenant_id 는 하위호환을 위해 그대로 유지)
 */
export function buildAgentHeaders(params = {}) {
    const headers = {
        'Content-Type': 'application/json; charset=utf-8'
    };
    const jwt = (params.user_jwt || params.userJwt || '').toString().trim();
    if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
    }
    const tenantId = (params.tenant_id || params.tenantId || '').toString().trim();
    if (tenantId) {
        headers['X-Tenant-Id'] = tenantId;
    }
    return headers;
}

export default buildAgentHeaders;
