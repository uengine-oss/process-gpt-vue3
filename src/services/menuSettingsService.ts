/**
 * 테넌트별 메뉴 표시 설정 서비스 (PAL 전용)
 *
 * configuration 테이블에 key='menu_settings' 한 행으로 저장한다.
 * (MFA 정책·대시보드 탭과 동일한 테넌트 KV 패턴 — tenants 에 컬럼을 더하지 않는다)
 *
 * 저장 형태:
 *   {
 *     items: { [menuPath]: { hidden?: boolean, label?: string, order?: number } },
 *     customItems: [{ id, label, target, external, section, icon?, order?, requiredRole? }]
 *   }
 *
 * customItems 는 관리자가 직접 추가한 메뉴다 — 코드에 정의되지 않은 화면(/merge-requests 등)이나
 * 외부 URL 을 사이드바 섹션(process/org/analytics/admin)에 올린다. requiredRole 은 표시 조건일 뿐이며
 * 내부 경로의 접근 권한은 기존 라우팅 검사에 따른다.
 *
 * 숨김(hidden)은 사이드바 표시 설정일 뿐 권한 축소가 아니다 —
 * URL 직접 접근은 기존 역할 검사(menu_role_overrides / routePermissions)를 그대로 따른다.
 */

import { CUSTOM_MENU_SECTIONS, normalizeCustomMenuItems } from '@/utils/tenantCustomizationCore';
import type { RoleType } from '@/utils/roles';

const CONFIG_KEY = 'menu_settings';

export interface MenuItemSetting {
    hidden?: boolean;
    label?: string;
    order?: number;
}

export type CustomMenuSection = 'process' | 'org' | 'analytics' | 'admin';

export const CUSTOM_MENU_SECTION_LABELS: Record<CustomMenuSection, string> = {
    process: '프로세스 관리',
    org: '조직관리',
    analytics: '분석',
    admin: '관리자'
};

export { CUSTOM_MENU_SECTIONS };

export interface CustomMenuItem {
    id: string;
    label: string;
    /** 내부 경로('/…') 또는 외부 URL(http/https) */
    target: string;
    external: boolean;
    section: CustomMenuSection;
    icon?: string;
    order?: number;
    /** 사이드바 표시 최소 역할(권한 축소 아님) */
    requiredRole?: RoleType;
}

export interface MenuSettings {
    items: Record<string, MenuItemSetting>;
    customItems: CustomMenuItem[];
}

function getTenantId(): string {
    return (window as any).$tenantName || 'default';
}

function getSupabase() {
    const supabase = (window as any).$supabase;
    if (!supabase) throw new Error('Supabase not initialized');
    return supabase;
}

function normalizeSettings(raw: unknown): MenuSettings {
    const value = typeof raw === 'string' ? safeParse(raw) : raw;
    const items = (value as any)?.items;
    const customItems = normalizeCustomMenuItems((value as any)?.customItems) as CustomMenuItem[];
    if (!items || typeof items !== 'object' || Array.isArray(items)) return { items: {}, customItems };

    const normalized: Record<string, MenuItemSetting> = {};
    for (const [path, setting] of Object.entries(items as Record<string, any>)) {
        if (!path || !setting || typeof setting !== 'object') continue;
        const entry: MenuItemSetting = {};
        if (setting.hidden === true) entry.hidden = true;
        if (typeof setting.label === 'string' && setting.label.trim()) entry.label = setting.label.trim();
        if (typeof setting.order === 'number' && Number.isFinite(setting.order)) entry.order = setting.order;
        if (Object.keys(entry).length > 0) normalized[path] = entry;
    }
    return { items: normalized, customItems };
}

function safeParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// 사이드바가 동기 조회할 수 있도록 모듈 캐시 유지 (loadMenuSettings 성공 후 유효)
let cache: MenuSettings = { items: {}, customItems: [] };
let cacheTenantId: string | null = null;

/** DB에서 메뉴 설정 로드 (+캐시 갱신). 없거나 실패하면 빈 설정 */
export async function loadMenuSettings(): Promise<MenuSettings> {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('configuration')
            .select('value')
            .eq('key', CONFIG_KEY)
            .eq('tenant_id', getTenantId())
            .maybeSingle();

        if (error) throw error;
        cache = normalizeSettings(data?.value);
    } catch (e) {
        console.error('[menuSettings] 로드 실패:', e);
        cache = { items: {}, customItems: [] };
    }
    cacheTenantId = getTenantId();
    return cache;
}

/** 메뉴 설정 저장 (+캐시 갱신) */
export async function saveMenuSettings(value: MenuSettings): Promise<MenuSettings> {
    const supabase = getSupabase();
    const normalized = normalizeSettings(value);

    const { data: existing } = await supabase
        .from('configuration')
        .select('uuid')
        .eq('key', CONFIG_KEY)
        .eq('tenant_id', getTenantId())
        .maybeSingle();

    if (existing?.uuid) {
        const { error } = await supabase.from('configuration').update({ value: normalized }).eq('uuid', existing.uuid);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('configuration').insert({
            tenant_id: getTenantId(),
            key: CONFIG_KEY,
            value: normalized
        });
        if (error) throw error;
    }

    cache = normalized;
    cacheTenantId = getTenantId();
    return normalized;
}

/** 캐시에서 특정 메뉴 경로의 설정 반환 (loadMenuSettings 이후 유효) */
export function getMenuSetting(path: string): MenuItemSetting | null {
    if (cacheTenantId !== getTenantId()) return null;
    return cache.items[path] ?? null;
}

/** 캐시 전체 반환 (사이드바 정렬/필터용) */
export function getCachedMenuSettings(): MenuSettings {
    return cache;
}

/** 캐시에서 특정 섹션의 사용자 정의 메뉴 반환 (order 오름차순, 미지정은 등록 순서) */
export function getCustomMenuItems(section: CustomMenuSection): CustomMenuItem[] {
    if (cacheTenantId !== getTenantId()) return [];
    return cache.customItems
        .map((item, index) => ({ item, key: typeof item.order === 'number' ? item.order : 100000 + index }))
        .filter(({ item }) => item.section === section)
        .sort((a, b) => a.key - b.key)
        .map(({ item }) => item);
}
