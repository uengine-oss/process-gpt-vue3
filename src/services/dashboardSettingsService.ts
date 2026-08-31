/**
 * 분석 대시보드 탭 설정 서비스
 * configuration 테이블에 단일 페이지 탭 목록으로 저장/조회
 */

import { ROLES, ROLE_HIERARCHY, type RoleType } from '@/utils/roles';

const CONFIG_KEY = 'analysis_dashboard_tabs';

export type DashboardTabMode = 'embed' | 'native';
export type DashboardDataPath = 'operational' | 'analytical';
export type NativeDashboardView = 'operational-board' | 'executive-summary' | 'process-analytics' | 'governance-quality';

export interface DashboardTab {
    key: string;
    label: string;
    url: string;
    mode?: DashboardTabMode;
    nativeView?: NativeDashboardView;
    dataPath?: DashboardDataPath;
    refreshSeconds?: number;
    latencyLabel?: string;
    /** 탭 조회 최소 역할. 미지정 시 embed=admin(기존 어드민 전용), native=viewer(전체) */
    viewRole?: RoleType;
}

/** @deprecated 하위 호환용. 신규 코드에서는 DashboardTab[] 직접 사용 */
export interface DashboardTabGroup {
    key: string;
    label: string;
    tabs: DashboardTab[];
}

const NATIVE_VIEWS: NativeDashboardView[] = ['operational-board', 'executive-summary', 'process-analytics', 'governance-quality'];
const TAB_MODES: DashboardTabMode[] = ['embed', 'native'];
const DATA_PATHS: DashboardDataPath[] = ['operational', 'analytical'];

/** Native View 기본 한국어 라벨 (라벨 미지정 시 사용) */
export const NATIVE_VIEW_LABELS: Record<NativeDashboardView, string> = {
    'operational-board': '운영현황',
    'executive-summary': '진행현황',
    'process-analytics': '프로세스분석',
    'governance-quality': '입력정확도'
};

function getTenantId(): string {
    return (window as any).$tenantName || 'default';
}

function getSupabase() {
    const supabase = (window as any).$supabase;
    if (!supabase) throw new Error('Supabase not initialized');
    return supabase;
}

function isNativeView(value: unknown): value is NativeDashboardView {
    return typeof value === 'string' && NATIVE_VIEWS.includes(value as NativeDashboardView);
}

function isTabMode(value: unknown): value is DashboardTabMode {
    return typeof value === 'string' && TAB_MODES.includes(value as DashboardTabMode);
}

function isDataPath(value: unknown): value is DashboardDataPath {
    return typeof value === 'string' && DATA_PATHS.includes(value as DashboardDataPath);
}

function isViewRole(value: unknown): value is RoleType {
    return typeof value === 'string' && (ROLE_HIERARCHY as string[]).includes(value.toLowerCase());
}

/** viewRole 미지정 시 기존 동작을 유지하는 기본값 (embed=관리자 전용, native=전체) */
export function defaultViewRole(mode: DashboardTabMode | undefined): RoleType {
    return mode === 'native' ? ROLES.VIEWER : ROLES.ADMIN;
}

function inferNativeView(tab: Partial<DashboardTab>, fallbackKey: string): NativeDashboardView | undefined {
    if (isNativeView(tab.nativeView)) return tab.nativeView;

    const normalizedKey = (tab.key || fallbackKey || '').toLowerCase();
    const normalizedLabel = (tab.label || '').toLowerCase();

    if (normalizedKey === 'a' || normalizedLabel.includes('operational')) return 'operational-board';
    if (normalizedLabel.includes('executive') || normalizedLabel.includes('summary')) return 'executive-summary';
    if (normalizedLabel.includes('process analytics') || normalizedLabel.includes('분석')) return 'process-analytics';
    if (normalizedLabel.includes('governance') || normalizedLabel.includes('quality')) return 'governance-quality';

    return undefined;
}

function normalizeTab(tab: Partial<DashboardTab>, index: number): DashboardTab {
    const fallbackKey = tab.key || String.fromCharCode(65 + index);
    const nativeView = inferNativeView(tab, fallbackKey);
    const trimmedUrl = typeof tab.url === 'string' ? tab.url.trim() : '';

    let mode: DashboardTabMode;
    if (isTabMode(tab.mode)) {
        mode = tab.mode;
    } else if (nativeView && !trimmedUrl) {
        mode = 'native';
    } else {
        mode = nativeView && !trimmedUrl ? 'native' : 'embed';
    }

    const dataPath: DashboardDataPath = isDataPath(tab.dataPath)
        ? tab.dataPath
        : mode === 'native' && nativeView === 'operational-board'
        ? 'operational'
        : 'analytical';

    const hasExplicitRefresh = typeof tab.refreshSeconds === 'number' && Number.isFinite(tab.refreshSeconds);
    const refreshSeconds = hasExplicitRefresh
        ? Math.max(0, Math.round(tab.refreshSeconds))
        : mode === 'native' && dataPath === 'operational'
        ? 5
        : 0;

    // 라벨이 비어있거나 키(A/B/C…)와 동일하면 Native View 한국어 기본 라벨로 대체
    const trimmedLabel = tab.label?.trim() || '';
    const label = trimmedLabel && trimmedLabel !== fallbackKey ? trimmedLabel : nativeView ? NATIVE_VIEW_LABELS[nativeView] : fallbackKey;

    const viewRole: RoleType = isViewRole(tab.viewRole) ? (tab.viewRole.toLowerCase() as RoleType) : defaultViewRole(mode);

    return {
        key: fallbackKey,
        label,
        url: trimmedUrl,
        mode,
        nativeView,
        dataPath,
        refreshSeconds,
        latencyLabel: tab.latencyLabel?.trim() || '',
        viewRole
    };
}

function normalizeTabs(raw: Partial<DashboardTab>[]): DashboardTab[] {
    return raw.map((tab, index) => normalizeTab(tab, index));
}

/** 환경변수 기반 기본 탭 (DB에 값이 없을 때 폴백) */
function getEnvFallbackTabs(): DashboardTab[] {
    return normalizeTabs([
        {
            key: 'A',
            label: '',
            mode: 'native',
            nativeView: 'operational-board',
            url: '',
            dataPath: 'operational',
            refreshSeconds: 5,
            latencyLabel: ''
        }
    ]);
}

/** DB에 저장된 데이터를 flat DashboardTab[]로 변환 (레거시 그룹 구조 마이그레이션 포함) */
function migrateRawToTabs(raw: unknown): DashboardTab[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;

    // 이미 그룹 구조인 경우 → 첫 번째 그룹의 탭을 사용
    if (raw[0]?.tabs && Array.isArray(raw[0].tabs)) {
        const allTabs: Partial<DashboardTab>[] = [];
        for (const group of raw as DashboardTabGroup[]) {
            if (Array.isArray(group.tabs)) {
                allTabs.push(...group.tabs);
            }
        }
        return normalizeTabs(allTabs);
    }

    // flat 구조 → 그대로 정규화
    return normalizeTabs(raw as Partial<DashboardTab>[]);
}

/** DB에서 탭 목록 조회. 없으면 환경변수 폴백 */
export async function loadTabs(): Promise<DashboardTab[]> {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('configuration')
            .select('value')
            .eq('key', CONFIG_KEY)
            .eq('tenant_id', getTenantId())
            .maybeSingle();

        if (error) throw error;

        if (data?.value) {
            const raw = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            const tabs = migrateRawToTabs(raw);
            if (tabs && tabs.length > 0) return tabs;
        }
    } catch (e) {
        console.error('[dashboardSettings] 탭 로드 실패:', e);
    }

    return getEnvFallbackTabs();
}

/** 탭 목록을 DB에 저장 */
export async function saveTabs(tabs: DashboardTab[]): Promise<void> {
    const supabase = getSupabase();
    const normalizedTabs = normalizeTabs(tabs);

    const { data: existing } = await supabase
        .from('configuration')
        .select('uuid')
        .eq('key', CONFIG_KEY)
        .eq('tenant_id', getTenantId())
        .maybeSingle();

    if (existing?.uuid) {
        const { error } = await supabase.from('configuration').update({ value: normalizedTabs }).eq('uuid', existing.uuid);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('configuration').insert({
            tenant_id: getTenantId(),
            key: CONFIG_KEY,
            value: normalizedTabs
        });
        if (error) throw error;
    }
}

/** @deprecated 하위 호환. loadTabs 사용 */
export async function loadTabGroups(): Promise<DashboardTabGroup[]> {
    const tabs = await loadTabs();
    return [{ key: 'default', label: 'Dashboard', tabs }];
}

/** @deprecated 하위 호환. saveTabs 사용 */
export async function saveTabGroups(groups: DashboardTabGroup[]): Promise<void> {
    const allTabs: DashboardTab[] = [];
    for (const group of groups) {
        if (Array.isArray(group.tabs)) allTabs.push(...group.tabs);
    }
    await saveTabs(allTabs);
}
