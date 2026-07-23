/**
 * 테넌트 식별 유틸리티
 *
 * 테넌트 ID 는 다음 우선순위로 결정한다.
 *   1) window.$tenantName        — 서브도메인에서 파싱한 값 (main.ts setupTenant)
 *   2) 로그인 세션 JWT 의 app_metadata.tenant_id — 서버가 승인한 실제 소속 테넌트
 *   3) localStorage.tenantId     — 테넌트 선택 화면에서 저장한 값
 *
 * 어떤 경우에도 특정 테넌트 이름('uengine', 'process-gpt' 등)으로 **하드코딩 fallback 하지 않는다**.
 * 하드코딩 fallback 은 (a) 다른 테넌트 요청이 uengine 으로 나가 스트림이 401 로 거절되고
 * (b) 신규 테넌트에서 다른 테넌트 데이터가 조회되는 원인이 된다.
 * 확정할 수 없으면 빈 문자열을 반환하고, 호출부가 "테넌트 미확정" 으로 처리하게 한다.
 */

let cachedJwtTenantId = '';

/** JWT 세션에서 읽어둔 tenant_id 캐시를 갱신한다. (App 부팅/로그인/테넌트 전환 시 호출) */
export function setCachedJwtTenantId(tenantId) {
    cachedJwtTenantId = (tenantId || '').toString().trim();
}

/** 세션(JWT)에서 app_metadata.tenant_id 를 읽어 캐시에 반영하고 반환한다. */
export async function refreshTenantFromSession() {
    try {
        const supabase = window.$supabase;
        if (!supabase) return '';
        const {
            data: { session }
        } = await supabase.auth.getSession();
        const claim = session?.user?.app_metadata?.tenant_id || session?.user?.user_metadata?.tenant_id || '';
        setCachedJwtTenantId(claim);
        return cachedJwtTenantId;
    } catch (e) {
        console.warn('[tenant] 세션에서 tenant_id 조회 실패:', e);
        return '';
    }
}

/**
 * 동기적으로 현재 테넌트 ID 를 반환한다. 확정할 수 없으면 '' 를 반환한다.
 * @returns {string}
 */
export function getTenantId() {
    const fromWindow = (window.$tenantName || '').toString().trim();
    if (fromWindow) return fromWindow;
    if (cachedJwtTenantId) return cachedJwtTenantId;
    try {
        return (localStorage.getItem('tenantId') || '').toString().trim();
    } catch (e) {
        return '';
    }
}

/**
 * 비동기 버전. 동기 경로로 결정되지 않으면 세션 JWT 까지 조회한다.
 * 스트리밍 요청처럼 테넌트가 반드시 정확해야 하는 경로에서 사용한다.
 * @returns {Promise<string>}
 */
export async function resolveTenantId() {
    const sync = getTenantId();
    if (sync) return sync;
    return await refreshTenantFromSession();
}

/**
 * supabase 쿼리에 붙일 tenant 필터 조각. 테넌트가 미확정이면 빈 객체를 돌려준다.
 * @returns {{tenant_id?: string}}
 */
export function tenantMatch() {
    const tenantId = getTenantId();
    return tenantId ? { tenant_id: tenantId } : {};
}

export default {
    getTenantId,
    resolveTenantId,
    refreshTenantFromSession,
    setCachedJwtTenantId,
    tenantMatch
};
