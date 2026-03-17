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

function resetClaims() {
    state.isAdmin = false;
    state.role = null;
    state.tenantId = null;
    state.loaded = true;
}

function applyClaims(claims: Record<string, any> | null | undefined) {
    state.isAdmin = normalizeBoolean(claims?.is_admin);
    state.role = typeof claims?.role === 'string' ? claims.role : null;
    state.tenantId = typeof claims?.tenant_id === 'string' ? claims.tenant_id : null;
    state.loaded = true;
}

function hasResolvedClaims(claims: Record<string, any> | null | undefined) {
    const role = typeof claims?.role === 'string' ? claims.role : null;
    const hasCustomRole = !!role && role !== 'authenticated' && role !== 'anon';

    return (
        typeof claims?.is_admin !== 'undefined' ||
        hasCustomRole ||
        typeof claims?.tenant_id === 'string'
    );
}

function hasFullAdminClaims(claims: Record<string, any> | null | undefined) {
    const role = typeof claims?.role === 'string' ? claims.role : null;
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

    let query = supabase.from('users').select('is_admin, role, tenant_id').eq('id', userId);

    if (tenantId) {
        query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
        return false;
    }

    applyClaims(data);
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

        resetClaims();
    } catch (_e) {
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
