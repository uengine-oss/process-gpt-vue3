import { reactive, readonly } from 'vue';
import jwtDecode from 'jwt-decode';
import { getSsoToken, getSsoUser } from '@/utils/ssoAuth';
import { resolveRole, hasRoleAtLeast, ROLES, type RoleType } from '@/utils/roles';
import { refreshCustomPermissions } from '@/utils/customPermissions';
import { loadMenuRoleOverrides } from '@/utils/menuRoleOverrides';

const state = reactive({
    isAdmin: false,
    adminViewer: false,
    role: null as string | null,
    tenantId: null as string | null,
    loaded: false
});

let initialized = false;

function normalizeBoolean(value: any) {
    return value === true || value === 'true';
}

function getAppMetadata(claims: Record<string, any> | null | undefined) {
    return claims?.app_metadata && typeof claims.app_metadata === 'object' ? claims.app_metadata : null;
}

function resolveRoleClaim(claims: Record<string, any> | null | undefined) {
    if (typeof claims?.user_role === 'string') return claims.user_role;
    if (typeof claims?.membership_role === 'string') return claims.membership_role;
    // Supabase/GoTrue JWT 는 항상 role='authenticated'(또는 anon) 를 담는다.
    // 이를 멤버십 역할로 오인하면 owner 가 'authenticated'→viewer 로 강등되므로 제외한다.
    if (typeof claims?.role === 'string' && claims.role !== 'authenticated' && claims.role !== 'anon') {
        return claims.role;
    }
    const appMetadata = getAppMetadata(claims);
    if (typeof appMetadata?.membership_role === 'string') return appMetadata.membership_role;
    if (typeof appMetadata?.user_role === 'string') return appMetadata.user_role;
    if (typeof appMetadata?.role === 'string') return appMetadata.role;
    return null;
}

function getStoredClaimsFallback() {
    if (typeof window === 'undefined') return null;

    const isAdmin = normalizeBoolean(window.localStorage.getItem('isAdmin'));
    const role = window.localStorage.getItem('role');
    const tenantId = window.localStorage.getItem('tenantId') || window.$tenantName || null;

    if (!isAdmin && !role && !tenantId) {
        return null;
    }

    return {
        is_admin: isAdmin,
        user_role: role,
        tenant_id: tenantId
    };
}

function resetClaims() {
    state.isAdmin = false;
    state.adminViewer = false;
    state.role = null;
    state.tenantId = null;
    state.loaded = true;
}

function applyClaims(claims: Record<string, any> | null | undefined) {
    const appMetadata = getAppMetadata(claims);
    const explicitIsAdmin = normalizeBoolean(claims?.is_admin) || normalizeBoolean(appMetadata?.is_admin);
    state.adminViewer =
        normalizeBoolean(claims?.is_admin_viewer) ||
        normalizeBoolean(claims?.admin_viewer) ||
        normalizeBoolean(appMetadata?.is_admin_viewer) ||
        normalizeBoolean(appMetadata?.admin_viewer);
    state.role = resolveRoleClaim(claims);
    // [변경] role 이 'admin' 이면 isAdmin 도 true 로 reconcile.
    // 이렇게 하면 localStorage 시뮬레이션처럼 is_admin/role 이 불일치한 상태에서도
    // isAdmin 만 보는 가드(예: AdminConsoleLayout)가 role 을 따라가게 된다.
    const resolvedRoleIsAdmin = typeof state.role === 'string' && state.role.toLowerCase() === 'admin';
    state.isAdmin = explicitIsAdmin || resolvedRoleIsAdmin;
    state.tenantId =
        typeof claims?.tenant_id === 'string'
            ? claims.tenant_id
            : (typeof appMetadata?.tenant_id === 'string' ? appMetadata.tenant_id : null);
    state.loaded = true;
}

function hasResolvedClaims(claims: Record<string, any> | null | undefined) {
    const role = resolveRoleClaim(claims);
    const hasCustomRole = !!role && role !== 'authenticated' && role !== 'anon';
    const appMetadata = getAppMetadata(claims);

    return (
        typeof claims?.is_admin !== 'undefined' ||
        typeof appMetadata?.is_admin !== 'undefined' ||
        hasCustomRole ||
        typeof claims?.tenant_id === 'string' ||
        typeof appMetadata?.tenant_id === 'string'
    );
}

function hasFullAdminClaims(claims: Record<string, any> | null | undefined) {
    const role = resolveRoleClaim(claims);
    const hasCustomRole = !!role && role !== 'authenticated' && role !== 'anon';
    const appMetadata = getAppMetadata(claims);

    return typeof claims?.is_admin !== 'undefined' || typeof appMetadata?.is_admin !== 'undefined' || hasCustomRole;
}

function decodeAccessToken(accessToken: string | null | undefined) {
    if (!accessToken) return null;

    try {
        return jwtDecode<Record<string, any>>(accessToken);
    } catch (_e) {
        return null;
    }
}

async function loadUserClaimsFromProfile(supabase: any, userId: string | null | undefined, tenantId?: string | null) {
    if (!userId) return false;

    if (tenantId) {
        const { data, error } = await supabase.from('users').select('is_admin, role, tenant_id').eq('id', userId).eq('tenant_id', tenantId).maybeSingle();
        if (!error && data) {
            applyClaims(data);
            return true;
        }
    }

    const { data, error } = await supabase.from('users').select('is_admin, role, tenant_id').eq('id', userId).limit(1);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
        return false;
    }

    applyClaims(row);
    return true;
}

export async function refreshAuthClaims(session?: any) {
    // SSO 모드: SSO JWT에서 claims 추출
    if ((window as any).$ssoMode) {
        const ssoToken = getSsoToken();
        const ssoUser = getSsoUser();
        if (ssoToken) {
            const tokenClaims = decodeAccessToken(ssoToken);
            if (tokenClaims && hasResolvedClaims(tokenClaims)) {
                // JWT에 tenant_id/is_admin 등은 있으나 role 클레임이 누락된 경우
                // (역할이 백엔드 user 레코드에만 존재) state.role 이 null 이 되어
                // owner 가 viewer 로 강등된다. ssoUser 의 resolved 값(백엔드 fallback
                // 포함)으로 role / is_admin 을 보강한다.
                const mergedClaims: Record<string, any> = { ...tokenClaims };
                if (!resolveRoleClaim(tokenClaims) && ssoUser?.role) {
                    mergedClaims.user_role = ssoUser.role;
                }
                if (!normalizeBoolean(tokenClaims?.is_admin) && ssoUser?.is_admin) {
                    mergedClaims.is_admin = true;
                }
                applyClaims(mergedClaims);
                return state;
            }
            // JWT claims가 없으면 SSO user 정보로 직접 적용
            if (ssoUser) {
                applyClaims({
                    is_admin: ssoUser.is_admin,
                    user_role: ssoUser.role,
                    tenant_id: (window as any).$tenantName || null
                });
                return state;
            }
        }
        resetClaims();
        return state;
    }

    const supabase = (window as any).$supabase;
    if (!supabase?.auth) {
        resetClaims();
        return state;
    }

    try {
        if (session) {
            const tokenClaims = decodeAccessToken(session?.access_token);
            if (hasResolvedClaims(tokenClaims)) {
                applyClaims(tokenClaims);
                if (hasFullAdminClaims(tokenClaims)) {
                    return state;
                }
            }

            const appMetadata = session?.user?.app_metadata || {};
            if (hasResolvedClaims(appMetadata)) {
                applyClaims(appMetadata);
                if (hasFullAdminClaims(appMetadata)) {
                    return state;
                }
            }

            const tenantHint = state.tenantId || window.$tenantName || null;
            const loaded = await loadUserClaimsFromProfile(supabase, session?.user?.id, tenantHint);
            if (!loaded) {
                const storedClaims = getStoredClaimsFallback();
                if (storedClaims) {
                    applyClaims(storedClaims);
                    return state;
                }

                resetClaims();
            }
            return state;
        }

        if (typeof supabase.auth.getClaims === 'function') {
            const { data, error } = await supabase.auth.getClaims();
            if (!error && hasResolvedClaims(data?.claims)) {
                applyClaims(data.claims);
                return state;
            }
        }

        const { data } = await supabase.auth.getSession();
        if (data?.session) {
            const loaded = await refreshAuthClaims(data.session);
            return loaded;
        }

        const storedClaims = getStoredClaimsFallback();
        if (storedClaims) {
            applyClaims(storedClaims);
            return state;
        }

        resetClaims();
    } catch (_e) {
        const storedClaims = getStoredClaimsFallback();
        if (storedClaims) {
            applyClaims(storedClaims);
            return state;
        }

        resetClaims();
    }

    return state;
}

async function resolveCurrentUserId(session?: any): Promise<string | null> {
    if (session?.user?.id) return session.user.id;

    if ((window as any).$ssoMode) {
        const ssoUser = getSsoUser();
        return ssoUser?.id ?? null;
    }

    const supabase = (window as any).$supabase;
    if (!supabase?.auth?.getSession) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
}

async function reloadClaimsAndPermissions(session?: any) {
    await refreshAuthClaims(session);
    const userId = await resolveCurrentUserId(session);
    await refreshCustomPermissions(userId);
    await loadMenuRoleOverrides();
}

export function initAuthClaimsListener() {
    if (initialized) return;
    initialized = true;

    // SSO 모드: supabase auth listener 대신 SSO 기반 claims 로드
    if ((window as any).$ssoMode) {
        void reloadClaimsAndPermissions();
        return;
    }

    const supabase = (window as any).$supabase;
    if (!supabase?.auth) return;

    void reloadClaimsAndPermissions();

    supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (!session) {
            resetClaims();
            void refreshCustomPermissions(null);
            return;
        }

        void reloadClaimsAndPermissions(session);
    });
}

export function getIsAdminClaim() {
    return state.isAdmin;
}

export function getIsAdminViewerClaim() {
    return state.adminViewer;
}

/** 어드민 패널 진입 가능 여부 (Admin 또는 Admin Viewer) */
export function canEnterAdminConsole() {
    return state.isAdmin || state.adminViewer;
}

/** 현재 사용자의 resolved role 반환 */
export function getResolvedRole(): RoleType {
    return resolveRole(state.isAdmin, state.role);
}

/** 현재 사용자가 특정 역할 이상인지 확인 */
export function hasRole(requiredRole: RoleType): boolean {
    return hasRoleAtLeast(getResolvedRole(), requiredRole);
}

export interface AuthClaimsState {
    readonly isAdmin: boolean;
    readonly adminViewer: boolean;
    readonly role: string | null;
    readonly tenantId: string | null;
    readonly loaded: boolean;
}

export const authClaimsState = readonly(state) as unknown as AuthClaimsState;
