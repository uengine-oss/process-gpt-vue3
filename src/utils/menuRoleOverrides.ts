import { reactive, readonly } from 'vue';
import type { RoleType } from '@/utils/roles';

/**
 * menu_role_overrides 테이블 한 row 의 모양.
 * 코드 기본값(routePermissions.ts) 에서 벗어난 메뉴 권한 조정 이력.
 */
export interface MenuRoleOverride {
    id: string;
    name: string;
    menu_path: string;
    required_role: RoleType;
    tenant_id: string;
    updated_at: string;
    updated_by: string | null;
}

const state = reactive({
    /** menu_path → override row 캐시 */
    overrides: new Map<string, MenuRoleOverride>(),
    loaded: false,
    tenantId: null as string | null
});

function getSupabase(): any {
    return (window as any).$supabase || null;
}

function getCurrentTenantId(): string | null {
    return (window as any).$tenantName || null;
}

/**
 * 현재 tenant 의 menu_role_overrides 전체를 1회 fetch 해 메모리 캐시.
 * 앱 시작 시 1회 + 필요 시 강제 새로고침.
 */
export async function loadMenuRoleOverrides(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) {
        state.overrides = new Map();
        state.loaded = true;
        return;
    }
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
        state.overrides = new Map();
        state.loaded = true;
        return;
    }
    state.tenantId = tenantId;

    const { data, error } = await supabase
        .from('menu_role_overrides')
        .select('id, name, menu_path, required_role, tenant_id, updated_at, updated_by')
        .eq('tenant_id', tenantId);

    if (error) {
        console.error('menu_role_overrides 로드 실패:', error);
        state.overrides = new Map();
        state.loaded = true;
        return;
    }

    const next = new Map<string, MenuRoleOverride>();
    for (const row of (data || []) as MenuRoleOverride[]) {
        if (row?.menu_path) next.set(row.menu_path, row);
    }
    state.overrides = next;
    state.loaded = true;
}

/** menu_path 의 override row 반환 (없으면 null) */
export function getMenuOverride(menuPath: string): MenuRoleOverride | null {
    return state.overrides.get(menuPath) ?? null;
}

/** menu_path 의 override required_role 만 반환 (없으면 null) */
export function getMenuOverrideRole(menuPath: string): RoleType | null {
    return state.overrides.get(menuPath)?.required_role ?? null;
}

/** 현재 캐시된 override 전체 (매트릭스 UI 등에서 일괄 조회용) */
export function getAllMenuOverrides(): MenuRoleOverride[] {
    return Array.from(state.overrides.values());
}

/**
 * menu_path 의 필요 역할 override 를 upsert 한다. (RLS: admin 전용 쓰기)
 * 성공 시 메모리 캐시를 새로고침해 lookupRequiredRole 이 즉시 새 값을 보게 한다.
 */
export async function upsertMenuRoleOverride(menuPath: string, requiredRole: RoleType, name?: string): Promise<void> {
    const supabase = getSupabase();
    const tenantId = getCurrentTenantId();
    if (!supabase || !tenantId) throw new Error('Supabase/tenant not initialized');

    const { error } = await supabase.from('menu_role_overrides').upsert(
        {
            tenant_id: tenantId,
            menu_path: menuPath,
            required_role: requiredRole,
            name: name || menuPath,
            updated_at: new Date().toISOString(),
            updated_by: (window as any).$user?.id || localStorage.getItem('uid') || null
        },
        { onConflict: 'tenant_id,menu_path' }
    );
    if (error) throw error;

    await loadMenuRoleOverrides();
}

/**
 * menu_path 의 override 행을 삭제해 코드 기본값으로 되돌린다. (행 삭제 = 기본값 복귀)
 */
export async function deleteMenuRoleOverride(menuPath: string): Promise<void> {
    const supabase = getSupabase();
    const tenantId = getCurrentTenantId();
    if (!supabase || !tenantId) throw new Error('Supabase/tenant not initialized');

    const { error } = await supabase
        .from('menu_role_overrides')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('menu_path', menuPath);
    if (error) throw error;

    await loadMenuRoleOverrides();
}

export const menuRoleOverrideState = readonly(state);
