import { reactive, readonly } from 'vue';
import { authClaimsState } from './authClaims';
import { resolveRole, hasRoleAtLeast, type RoleType } from './roles';
import { lookupMinRole, lookupRequiredRole } from './routePermissions';

/**
 * 커스텀 권한 (permissions 테이블) 한 row 의 모양.
 * 기본 RBAC (admin > owner > editor > reviewer > viewer) 로 부족한
 * endpoint 단위 액션 권한을 사용자별로 부여하기 위한 카탈로그 엔트리.
 */
export interface CustomPermission {
    id: string;
    name: string;
    label: string;
    api_path: string;
    verb: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | '*';
}

const state = reactive({
    catalog: [] as CustomPermission[],
    catalogById: new Map<string, CustomPermission>(),
    catalogByName: new Map<string, CustomPermission>(),
    userPermissionIds: [] as string[],
    loaded: false
});

let catalogFetched = false;

async function loadCatalog() {
    if (catalogFetched) return;
    const supabase = (window as any).$supabase;
    if (!supabase) return;

    const { data, error } = await supabase.from('permissions').select('id, name, label, api_path, verb');
    if (error || !data) return;

    state.catalog = data as CustomPermission[];
    state.catalogById = new Map(state.catalog.map((p) => [p.id, p]));
    state.catalogByName = new Map(state.catalog.map((p) => [p.name, p]));
    catalogFetched = true;
}

async function loadUserPermissionIds(userId: string) {
    const supabase = (window as any).$supabase;
    if (!supabase) return;

    const { data, error } = await supabase.from('users').select('permission_ids').eq('id', userId).maybeSingle();
    if (error) {
        state.userPermissionIds = [];
        return;
    }
    state.userPermissionIds = Array.isArray(data?.permission_ids) ? data.permission_ids : [];
}

async function resolveUserIdFallback(): Promise<string | null> {
    // 1차: localStorage 의 uid (uEngine/Keycloak 모드에서 설정됨)
    const lsUid = typeof window !== 'undefined' ? window.localStorage.getItem('uid') : null;
    if (lsUid) return lsUid;

    // 2차: backend.getUserInfo() — ProcessGPT/Supabase 모드에서 권한 화면이 쓰는 패턴
    try {
        const { default: BackendFactory } = await import('@/components/api/BackendFactory');
        const backend = BackendFactory.createBackend();
        const info = await (backend as any).getUserInfo();
        return info?.uid || info?.id || null;
    } catch {
        return null;
    }
}

/**
 * 카탈로그 + 현재 사용자의 권한 ID 배열을 로드한다.
 * authClaims 흐름과 마찬가지로 로그인/세션 갱신 시점에 호출.
 */
export async function refreshCustomPermissions(userId: string | null | undefined) {
    await loadCatalog();

    let resolvedUserId = userId ?? null;
    if (!resolvedUserId) {
        resolvedUserId = await resolveUserIdFallback();
    }

    if (resolvedUserId) {
        await loadUserPermissionIds(resolvedUserId);
    } else {
        state.userPermissionIds = [];
    }
    state.loaded = true;
}

/** 카탈로그 전체 (관리자 UI 의 정책 CRUD 화면용) */
export function getPermissionCatalog(): CustomPermission[] {
    return state.catalog;
}

/** 현재 사용자에게 할당된 permission 들 (label/verb/api_path 풀어서) */
export function getUserCustomPermissions(): CustomPermission[] {
    return state.userPermissionIds
        .map((id) => state.catalogById.get(id))
        .filter((p): p is CustomPermission => !!p);
}

/** name 으로 권한 보유 여부 (예: 'kpi_update') */
export function hasCustomPermission(name: string): boolean {
    const perm = state.catalogByName.get(name);
    if (!perm) return false;
    return state.userPermissionIds.includes(perm.id);
}

/**
 * verb + api_path 매칭으로 권한 보유 여부.
 * 카탈로그에서 verb='*' 로 정의된 항목은 모든 verb 매칭.
 */
export function hasActionPermission(verb: string, apiPath: string): boolean {
    return getUserCustomPermissions().some((p) => p.api_path === apiPath && (p.verb === verb || p.verb === '*'));
}

/**
 * RBAC ↔ custom permission OR 합성 게이트.
 * - requiredRole 만족하면 즉시 통과 (admin 은 모든 role 자동 만족하므로 별도 분기 불필요)
 * - 만족 못 해도 permissionName 또는 (verb + apiPath) 매칭 시 통과
 *
 * 사이드바 메뉴 가드 / 페이지 액션 버튼 가드 모두 이 헬퍼 하나로 처리한다.
 *
 * @example
 *   canAccess({ requiredRole: 'admin', permissionName: 'kpi_read' })
 *   canAccess({ verb: 'PUT', apiPath: '/admin-console/kpi-targets' })
 */
export function canAccess(opts: { requiredRole?: RoleType; permissionName?: string; verb?: string; apiPath?: string }): boolean {
    const userRole = resolveRole(authClaimsState.isAdmin, authClaimsState.role);
    // apiPath 가 있으면 DB override(menu_role_overrides) 우선 적용, 없으면 호출자가 넘긴 requiredRole 사용
    const effectiveRequired = opts.apiPath ? lookupRequiredRole(opts.apiPath) ?? opts.requiredRole : opts.requiredRole;
    if (effectiveRequired && hasRoleAtLeast(userRole, effectiveRequired)) return true;

    // 데이터 접근 하한(minRole) 미만이면 커스텀 권한으로도 통과시키지 않는다.
    // 커스텀 권한은 화면만 열어줄 뿐 RLS 를 넘지 못해, 통과시켜도 빈 화면만 보게 된다.
    const minRole = opts.apiPath ? lookupMinRole(opts.apiPath) : null;
    if (minRole && !hasRoleAtLeast(userRole, minRole)) return false;

    if (opts.permissionName && hasCustomPermission(opts.permissionName)) return true;
    if (opts.verb && opts.apiPath && hasActionPermission(opts.verb, opts.apiPath)) return true;
    return false;
}

export const customPermissionState = readonly(state);
