import { reactive, readonly } from 'vue';
import jwtDecode from 'jwt-decode';

const state = reactive({
    isAdmin: false,
    role: null as string | null,
    tenantId: null as string | null,
    loaded: false
});

let initialized = false;

function normalizeBoolean(value: any) {
    return value === true || value === 'true';
}

function resolveRoleClaim(claims: Record<string, any> | null | undefined) {
    if (typeof claims?.user_role === 'string') return claims.user_role;
    if (typeof claims?.role === 'string') return claims.role;
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
    state.role = null;
    state.tenantId = null;
    state.loaded = true;
}

function applyClaims(claims: Record<string, any> | null | undefined) {
    state.isAdmin = normalizeBoolean(claims?.is_admin);
    state.role = resolveRoleClaim(claims);
    state.tenantId = typeof claims?.tenant_id === 'string' ? claims.tenant_id : null;
    state.loaded = true;
}

function hasResolvedClaims(claims: Record<string, any> | null | undefined) {
    const role = resolveRoleClaim(claims);
    const hasCustomRole = !!role && role !== 'authenticated' && role !== 'anon';

    return (
        typeof claims?.is_admin !== 'undefined' ||
        hasCustomRole ||
        typeof claims?.tenant_id === 'string'
    );
}

function hasFullAdminClaims(claims: Record<string, any> | null | undefined) {
    const role = resolveRoleClaim(claims);
    const hasCustomRole = !!role && role !== 'authenticated' && role !== 'anon';

    return typeof claims?.is_admin !== 'undefined' || hasCustomRole;
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

export function initAuthClaimsListener() {
    if (initialized) return;
    initialized = true;

    const supabase = (window as any).$supabase;
    if (!supabase?.auth) return;

    void refreshAuthClaims();

    supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (!session) {
            resetClaims();
            return;
        }

        void refreshAuthClaims(session);
    });
}

export function getIsAdminClaim() {
    return state.isAdmin;
}

export const authClaimsState = readonly(state);
