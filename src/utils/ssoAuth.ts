/**
 * SSO Auth 유틸리티
 * 백엔드 /auth/sso/exchange 엔드포인트를 통한 자동 SSO 인증
 */

import jwtDecode from 'jwt-decode';
import { isAdminRole } from '@/utils/roles';

interface SsoUser {
    id: string;
    email: string;
    username: string;
    role: string;
    is_admin: boolean;
    employee_no: string;
    org_code: string;
    org_name: string;
}

interface SsoExchangeResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    expires_at: number;
    tenant_id: string;
    user: SsoUser;
}

function normalizeBoolean(value: any): boolean {
    return value === true || value === 'true';
}

function decodeAccessTokenClaims(accessToken: string | null | undefined): Record<string, any> | null {
    if (!accessToken) return null;

    try {
        return jwtDecode<Record<string, any>>(accessToken);
    } catch {
        return null;
    }
}

function resolveRoleFromClaims(claims: Record<string, any> | null | undefined, fallbackRole?: string | null): string {
    const appMetadata = claims?.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : null;
    return (
        (typeof claims?.user_role === 'string' ? claims.user_role : null) ||
        (typeof claims?.membership_role === 'string' ? claims.membership_role : null) ||
        (typeof claims?.role === 'string' && claims.role !== 'authenticated' && claims.role !== 'anon' ? claims.role : null) ||
        (typeof appMetadata?.membership_role === 'string' ? appMetadata.membership_role : null) ||
        (typeof appMetadata?.user_role === 'string' ? appMetadata.user_role : null) ||
        (typeof appMetadata?.role === 'string' ? appMetadata.role : null) ||
        fallbackRole ||
        ''
    );
}

function resolveIsAdminFromClaims(claims: Record<string, any> | null | undefined, fallbackIsAdmin?: boolean): boolean {
    const appMetadata = claims?.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : null;
    return (
        normalizeBoolean(claims?.is_admin) ||
        normalizeBoolean(appMetadata?.is_admin) ||
        isAdminRole(resolveRoleFromClaims(claims)) ||
        !!fallbackIsAdmin
    );
}

// SSO 토큰은 메모리에 저장 (보안)
let ssoAccessToken: string | null = null;
let ssoExpiresAt: number = 0;
let ssoUser: SsoUser | null = null;
let ssoTenantId: string | null = null;
let ssoLoginRedirectInProgress = false;

const SSO_POST_LOGIN_REDIRECT_KEY = 'sso_post_login_redirect';
const SSO_REAUTH_REASON_KEY = 'sso_reauth_reason';

function getDefaultPostLoginPath(): string {
    return '/process-architecture';
}

function getBasePathPrefix(): string {
    const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return basePath === '/' ? '' : basePath;
}

function normalizeRedirectPath(value: string | null | undefined): string {
    if (!value || typeof value !== 'string') return getDefaultPostLoginPath();

    const trimmed = value.trim();
    if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return getDefaultPostLoginPath();
    }

    const basePath = getBasePathPrefix();
    if (basePath && basePath !== '/' && trimmed === basePath) {
        return '/';
    }
    if (basePath && basePath !== '/' && trimmed.startsWith(`${basePath}/`)) {
        return trimmed.slice(basePath.length) || '/';
    }

    if (trimmed === '/auth' || trimmed.startsWith('/auth?') || trimmed.startsWith('/auth/')) {
        return getDefaultPostLoginPath();
    }

    return trimmed;
}

function getCurrentRedirectPath(): string {
    if (typeof window === 'undefined') return getDefaultPostLoginPath();
    return normalizeRedirectPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

export function getStoredSsoPostLoginRedirect(): string {
    if (typeof window === 'undefined') return getDefaultPostLoginPath();
    const query = new URLSearchParams(window.location.search).get('redirect');
    const stored = window.sessionStorage?.getItem(SSO_POST_LOGIN_REDIRECT_KEY);
    return normalizeRedirectPath(query || stored);
}

export function clearStoredSsoPostLoginRedirect(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage?.removeItem(SSO_POST_LOGIN_REDIRECT_KEY);
    window.sessionStorage?.removeItem(SSO_REAUTH_REASON_KEY);
}

export function buildSsoLoginUrl(redirectTo?: string): string {
    const postLoginRedirect = normalizeRedirectPath(redirectTo || getCurrentRedirectPath());
    const authGatewayPath = `${getBasePathPrefix()}/auth?redirect=${encodeURIComponent(postLoginRedirect)}`;
    return `/pi-system-backend/auth/sso/exchange?redirect_to=${encodeURIComponent(authGatewayPath)}`;
}

export function redirectToSsoLogin(reason = 'sso-token-expired', redirectTo?: string): void {
    if (typeof window === 'undefined') return;
    if (ssoLoginRedirectInProgress) return;
    ssoLoginRedirectInProgress = true;

    const postLoginRedirect = normalizeRedirectPath(redirectTo || getCurrentRedirectPath());
    clearSsoState();
    window.localStorage.removeItem('accessToken');
    window.sessionStorage?.setItem(SSO_POST_LOGIN_REDIRECT_KEY, postLoginRedirect);
    window.sessionStorage?.setItem(SSO_REAUTH_REASON_KEY, reason);
    window.location.assign(buildSsoLoginUrl(postLoginRedirect));
}

/**
 * 페이지 새로고침 시 localStorage 에 보존된 access_token 을 메모리로 복원한다.
 *   - 토큰 자체는 백엔드 서명이므로 클라이언트 위변조 불가
 *   - 만료된 토큰은 거부 (false 반환 → 보호 경로에서 SSO 재로그인)
 *   - 성공 시 ssoAccessToken / ssoExpiresAt / ssoUser / ssoTenantId 메모리 복원
 *
 * 호출 시점: 앱 초기화 (main.ts initializeApp) 의 setupSupabase 호출 직전
 */
export function hydrateSsoFromLocalStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    const token = window.localStorage.getItem('accessToken');
    if (!token) return false;

    const claims = decodeAccessTokenClaims(token);
    if (!claims) {
        window.localStorage.removeItem('accessToken');
        return false;
    }

    const exp = typeof claims.exp === 'number' ? claims.exp : 0;
    const now = Math.floor(Date.now() / 1000);
    if (exp <= now) {
        window.localStorage.removeItem('accessToken');
        return false;
    }

    ssoAccessToken = token;
    ssoExpiresAt = exp;

    const userMetadata = claims.user_metadata && typeof claims.user_metadata === 'object' ? claims.user_metadata : {};
    const appMetadata = claims.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : {};
    const resolvedRole = resolveRoleFromClaims(claims, window.localStorage.getItem('role'));
    const resolvedIsAdmin = resolveIsAdminFromClaims(claims, window.localStorage.getItem('isAdmin') === 'true');

    ssoUser = {
        id: typeof claims.sub === 'string' ? claims.sub : window.localStorage.getItem('uid') || '',
        email: typeof claims.email === 'string' ? claims.email : window.localStorage.getItem('email') || '',
        username: typeof userMetadata.name === 'string' ? userMetadata.name : window.localStorage.getItem('userName') || '',
        role: resolvedRole,
        is_admin: resolvedIsAdmin,
        employee_no: typeof appMetadata.employee_no === 'string' ? appMetadata.employee_no : window.localStorage.getItem('employeeNo') || '',
        org_code: typeof appMetadata.org_code === 'string' ? appMetadata.org_code : '',
        org_name: typeof appMetadata.org_name === 'string' ? appMetadata.org_name : window.localStorage.getItem('orgName') || ''
    };
    ssoTenantId = typeof appMetadata.tenant_id === 'string' ? appMetadata.tenant_id : null;

    return true;
}

/**
 * 백엔드 SSO exchange 엔드포인트를 호출하여 토큰을 발급받는다.
 * 프록시가 주입한 x-playground-* 헤더를 백엔드가 검증한 뒤 JWT를 반환한다.
 */
export async function exchangeSsoToken(): Promise<SsoExchangeResponse> {
    let response: Response;
    try {
        response = await fetch('/pi-system-backend/auth/sso/exchange', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (networkError: any) {
        const error: any = new Error('네트워크 오류: 백엔드 서버에 연결할 수 없습니다.');
        error.code = 'NETWORK_ERROR';
        throw error;
    }

    if (!response.ok) {
        let detail = '';
        try {
            const body = await response.text();
            try {
                const json = JSON.parse(body);
                detail = json.message || json.error || body;
            } catch {
                detail = body;
            }
        } catch {}
        const error: any = new Error(`SSO exchange failed: ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.detail = detail;
        throw error;
    }

    const data: SsoExchangeResponse = await response.json();

    const tokenClaims = decodeAccessTokenClaims(data.access_token);
    const resolvedRole = resolveRoleFromClaims(tokenClaims, data.user.role);
    const resolvedIsAdmin = resolveIsAdminFromClaims(tokenClaims, data.user.is_admin);

    // 메모리에 토큰 저장
    ssoAccessToken = data.access_token;
    ssoExpiresAt = data.expires_at;
    ssoUser = {
        ...data.user,
        role: resolvedRole,
        is_admin: resolvedIsAdmin
    };
    ssoTenantId = data.tenant_id;

    // 기존 코드 호환을 위해 localStorage에 사용자 정보 저장
    localStorage.setItem('email', data.user.email);
    localStorage.setItem('userName', data.user.username || '');
    localStorage.setItem('uid', data.user.id);
    localStorage.setItem('author', data.user.email);
    localStorage.setItem('isAdmin', String(resolvedIsAdmin));
    localStorage.setItem('role', resolvedRole);
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('orgName', data.user.org_name || '');
    localStorage.setItem('employeeNo', data.user.employee_no || '');
    if (!localStorage.getItem('picture')) {
        localStorage.setItem('picture', '');
    }
    window.dispatchEvent(new CustomEvent('usage-identity-ready'));

    return data;
}

/**
 * 현재 유효한 SSO 토큰을 반환한다.
 * 만료되었으면 null을 반환한다.
 */
export function getSsoToken(): string | null {
    if (ssoAccessToken && ssoExpiresAt > Math.floor(Date.now() / 1000)) {
        return ssoAccessToken;
    }
    return null;
}

/**
 * SSO 사용자 정보를 반환한다.
 */
export function getSsoUser(): SsoUser | null {
    return ssoUser;
}

/**
 * SSO 테넌트 ID를 반환한다.
 */
export function getSsoTenantId(): string | null {
    return ssoTenantId;
}

/**
 * SSO 인증이 완료된 상태인지 확인한다.
 */
export function isSsoAuthenticated(): boolean {
    return getSsoToken() !== null;
}

/**
 * SSO 토큰이 만료되면 백그라운드 exchange를 반복하지 않고 SSO 재로그인으로 보낸다.
 */
export async function refreshSsoToken(): Promise<string | null> {
    redirectToSsoLogin('sso-token-expired');
    return null;
}

/**
 * DB 최신 role로 SSO 토큰을 재발행한다. (권한 승인 후 호출)
 * 기존 토큰으로 인증하여 새 토큰을 발급받는다.
 */
export async function refreshRoleToken(): Promise<SsoUser | null> {
    const currentToken = getSsoToken();
    if (!currentToken) return null;

    try {
        const response = await fetch('/pi-system-backend/auth/sso/refresh-role', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();

        const tokenClaims = decodeAccessTokenClaims(data.access_token);
        const resolvedRole = resolveRoleFromClaims(tokenClaims, data.user.role);
        const resolvedIsAdmin = resolveIsAdminFromClaims(tokenClaims, data.user.is_admin);

        const normalizedUser = {
            ...data.user,
            role: resolvedRole,
            is_admin: resolvedIsAdmin
        };

        // 메모리 업데이트
        ssoAccessToken = data.access_token;
        ssoExpiresAt = data.expires_at;
        ssoUser = normalizedUser;

        // localStorage 업데이트
        localStorage.setItem('isAdmin', String(resolvedIsAdmin));
        localStorage.setItem('role', resolvedRole);
        localStorage.setItem('accessToken', data.access_token);

        // Supabase 클라이언트 헤더 업데이트
        // Headers는 Web API Headers 객체이므로 .set() 메서드를 사용해야 함
        const supabase = (window as any).$supabase;
        if (supabase?.rest?.headers) {
            supabase.rest.headers.set('Authorization', `Bearer ${data.access_token}`);
        }

        window.dispatchEvent(new CustomEvent('usage-identity-ready'));

        return normalizedUser;
    } catch {
        return null;
    }
}

/**
 * SSO 상태를 초기화한다. (로그아웃 시)
 */
export function clearSsoState(): void {
    ssoAccessToken = null;
    ssoExpiresAt = 0;
    ssoUser = null;
    ssoTenantId = null;
}

export default {
    exchangeSsoToken,
    getSsoToken,
    getSsoUser,
    getSsoTenantId,
    isSsoAuthenticated,
    refreshSsoToken,
    refreshRoleToken,
    clearSsoState,
    buildSsoLoginUrl,
    redirectToSsoLogin,
    getStoredSsoPostLoginRedirect,
    clearStoredSsoPostLoginRedirect
};
