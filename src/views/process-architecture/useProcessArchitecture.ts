import { ref, computed, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
import {
    buildProcessHierarchyQuery,
    PROCESS_HIERARCHY_ENTRY
} from '@/views/process-hierarchy/navigation';
import { getMajorBusinessDomain } from './processClassification';
import { collectHierarchyProcIds, collectModuleProcIds, deriveStatus } from '@/utils/processStages';
import { formatDateKST } from '@/utils/datetime';
export { generateProcessId, collectAllProcessIds, isPidInUse } from './processIdUtils';

export type ViewMode = 'card' | 'matrix' | 'tree' | 'mermaid';

/** 도메인 표시 순서: Access > Core > IP > 유선 > 설비 > 공통 */
export const DOMAIN_SORT_ORDER = ['Access', 'Core', 'IP', '유선', '설비', '공통'];

/** 이전 버전이 최초 진입 시 URL에 자동 기록하던 기본 도메인 필터 */
export const DEFAULT_SELECTED_DOMAINS = [...DOMAIN_SORT_ORDER];

export function getDomainSortIndex(name: string): number {
    const idx = DOMAIN_SORT_ORDER.indexOf(name);
    return idx >= 0 ? idx : DOMAIN_SORT_ORDER.length;
}

export function sortDomains<T extends { name: string }>(domains: T[]): T[] {
    return [...domains].sort((a, b) => getDomainSortIndex(a.name) - getDomainSortIndex(b.name));
}

type DomainOption = { id: string; name: string; color?: string };

function normalizeDomainKey(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function normalizeIdentity(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function buildIdentitySet(values: Iterable<unknown>): Set<string> {
    const identifiers = new Set<string>();
    for (const value of values) {
        const normalized = normalizeIdentity(value);
        if (normalized) identifiers.add(normalized);
    }
    return identifiers;
}

function matchesAnyIdentity(values: unknown[], identifiers: Set<string>): boolean {
    if (identifiers.size === 0) return false;
    return values.some((value) => {
        const normalized = normalizeIdentity(value);
        return !!normalized && identifiers.has(normalized);
    });
}

function pushIdentityCandidates(target: unknown[], value: unknown) {
    if (Array.isArray(value)) {
        for (const item of value) pushIdentityCandidates(target, item);
        return;
    }

    if (value && typeof value === 'object') {
        const item = value as Record<string, unknown>;
        target.push(
            item.id,
            item.value,
            item.uid,
            item.user_id,
            item.email,
            item.name,
            item.label,
            item.username,
            item.employee_no,
            item.org_id,
            item.org_code,
            item.org_name
        );
        return;
    }

    target.push(value);
}

function buildSubProcessIndex(map: any): Map<string, any> {
    const index = new Map<string, any>();
    for (const mega of map?.mega_proc_list || []) {
        for (const major of mega?.major_proc_list || []) {
            for (const sub of major?.sub_proc_list || []) {
                if (sub?.id) index.set(String(sub.id), sub);
            }
        }
    }
    return index;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
    if (isRecord(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function bpmnLocalName(node: Element): string {
    return node.localName || node.nodeName.replace(/^.*:/, '');
}

function getBpmnChildren(node: Element): Element[] {
    return Array.from(node.children || []) as Element[];
}

function readUengineJsonFromElement(node: Element): string {
    const ext = getBpmnChildren(node).find((child) => bpmnLocalName(child) === 'extensionElements');
    if (!ext) return '';

    const props = (Array.from(ext.getElementsByTagName('*')) as Element[]).find((child) => bpmnLocalName(child) === 'properties');
    if (!props) return '';

    const attr = props.getAttribute('json');
    if (attr) return attr;

    const jsonChild = (Array.from(props.getElementsByTagName('*')) as Element[]).find((child) => bpmnLocalName(child) === 'json');
    return jsonChild?.textContent || '';
}

function collectLaneCandidatesFromBpmnXml(xml: unknown, target: unknown[]) {
    if (typeof xml !== 'string' || !xml.includes('<') || typeof DOMParser === 'undefined') return;

    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) return;

        const laneNodes = (Array.from(doc.getElementsByTagName('*')) as Element[]).filter((node) => bpmnLocalName(node) === 'lane');
        for (const laneNode of laneNodes) {
            pushIdentityCandidates(target, laneNode.getAttribute('name'));
            const props = parseJsonRecord(readUengineJsonFromElement(laneNode));
            pushIdentityCandidates(target, props.laneOrganization);
        }
    } catch {
        // Ignore malformed BPMN in list filtering.
    }
}

function isLaneRecord(value: Record<string, unknown>): boolean {
    const type = String(value.$type || value.type || value.localName || value.nodeName || '').toLowerCase();
    return type === 'lane' || type.endsWith(':lane');
}

function collectLaneCandidatesFromDefinition(value: unknown, target: unknown[], seen = new WeakSet<object>()) {
    if (typeof value === 'string') return;

    if (Array.isArray(value)) {
        for (const item of value) collectLaneCandidatesFromDefinition(item, target, seen);
        return;
    }

    if (!isRecord(value)) return;
    if (seen.has(value)) return;
    seen.add(value);

    if (isLaneRecord(value)) {
        pushIdentityCandidates(target, value.name);
    }

    if ('laneOrganization' in value) {
        pushIdentityCandidates(target, value.laneOrganization);
    }

    const extensionElements = value.extensionElements || value['bpmn:extensionElements'];
    if (isRecord(extensionElements)) {
        const values = extensionElements.values || extensionElements.$children;
        const extList = Array.isArray(values) ? values : (values ? [values] : []);
        for (const ext of extList) {
            if (!isRecord(ext)) continue;
            const props = parseJsonRecord(ext.json || ext['uengine:json']);
            pushIdentityCandidates(target, props.laneOrganization);
        }
    }

    for (const child of Object.values(value)) {
        collectLaneCandidatesFromDefinition(child, target, seen);
    }
}

function getProcessSwimlaneTeamCandidates(def: any): unknown[] {
    const candidates: unknown[] = [];
    collectLaneCandidatesFromBpmnXml(def?.bpmn, candidates);
    if (typeof def?.definition === 'string') {
        collectLaneCandidatesFromBpmnXml(def.definition, candidates);
        collectLaneCandidatesFromDefinition(parseJsonRecord(def.definition), candidates);
    } else {
        collectLaneCandidatesFromBpmnXml(def?.definition?.bpmn, candidates);
        collectLaneCandidatesFromBpmnXml(def?.definition?.bpmnXml, candidates);
        collectLaneCandidatesFromBpmnXml(def?.definition?.xml, candidates);
        collectLaneCandidatesFromDefinition(def?.definition, candidates);
    }
    return candidates;
}

function toDomainOption(domain: any): DomainOption | null {
    const name = String(domain?.name ?? domain?.id ?? '').trim();
    const id = String(domain?.id ?? domain?.name ?? '').trim();
    if (!name || !id) return null;
    return {
        id,
        name,
        color: domain?.color
    };
}

export function mergeDomainLists(primary: any[] = [], secondary: any[] = []): DomainOption[] {
    const merged: DomainOption[] = [];

    const mergeOne = (candidate: any) => {
        const normalized = toDomainOption(candidate);
        if (!normalized) return;

        const candidateKeys = [normalizeDomainKey(normalized.name), normalizeDomainKey(normalized.id)].filter(Boolean);
        const existing = merged.find((item) => {
            const itemKeys = [normalizeDomainKey(item.name), normalizeDomainKey(item.id)].filter(Boolean);
            return candidateKeys.some((key) => itemKeys.includes(key));
        });

        if (!existing) {
            merged.push(normalized);
            return;
        }

        if (!existing.color && normalized.color) existing.color = normalized.color;
        if (!existing.name && normalized.name) existing.name = normalized.name;
        if (!existing.id && normalized.id) existing.id = normalized.id;
    };

    for (const domain of primary || []) mergeOne(domain);
    for (const domain of secondary || []) mergeOne(domain);

    return merged;
}

export function deriveDomainsFromProcMap(map: any): DomainOption[] {
    if (!map?.mega_proc_list) return [];

    const seen = new Set<string>();
    const knownDomainSeed = DOMAIN_SORT_ORDER.map((name) => ({ id: name, name }));
    const list: DomainOption[] = [];

    const addDerivedDomain = (domain: DomainOption | null) => {
        if (!domain) return;
        const key = normalizeDomainKey(domain.name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        list.push(domain);
    };

    for (const mega of map.mega_proc_list) {
        for (const major of mega.major_proc_list || []) {
            const domainName = getMajorBusinessDomain(major, [...knownDomainSeed, ...list]);
            if (!domainName || typeof domainName !== 'string') continue;
            addDerivedDomain({
                id: domainName,
                name: domainName,
                color: (major as any).color
            });
        }
    }

    if (list.length > 0) return list;

    for (const mega of map.mega_proc_list) {
        const name = String(mega?.name || mega?.id || '').trim();
        if (!name) continue;
        addDerivedDomain({
            id: name,
            name,
            color: (mega as any).color
        });
    }

    return list;
}

export interface ProcessStatus {
    status: 'none' | 'draft' | 'in_review' | 'public_feedback' | 'final_edit' | 'published' | 'wip' | 'sunset';
    version?: string;
    dDay?: number;
    reviewEndDate?: string;
    isToBe?: boolean;
}

export interface RecentlyViewedItem {
    id: string;
    name: string;
    visitedAt: number;
}

export interface FilterPreset {
    id: string;
    name: string;
    createdAt: number;
    filters: {
        searchQuery: string;
        selectedDomains: string[];
        quickFilterNeedFeedback: boolean;
        quickFilterWIL: boolean;
        showToBe: boolean;
        myProcessFilter: { enabled: boolean; favorites: boolean; myCreation: boolean; myOrganization: boolean };
        advancedFilters: any;
    };
}

const RECENTLY_VIEWED_KEY = 'process_recently_viewed';
const FAVORITES_KEY = 'process_favorites';
const FILTER_PRESETS_KEY = 'process_filter_presets';
const MAX_RECENTLY_VIEWED = 10;
const VIEW_MODES: ViewMode[] = ['card', 'matrix', 'tree', 'mermaid'];
const FILTER_QUERY_KEYS = {
    view: 'view',
    search: 'q',
    domain: 'domain',
    domains: 'domains',
    needFeedback: 'needFeedback',
    wil: 'wil',
    toBe: 'toBe',
    myFavorites: 'myFavorites',
    myCreation: 'myCreation',
    myOrganization: 'myOrg',
    // Advanced filters
    afStatuses: 'afStatuses',
    afDateMode: 'afDateMode',
    afRelativeDays: 'afRelDays',
    afDateFrom: 'afDateFrom',
    afDateTo: 'afDateTo',
    afOwners: 'afOwners',
    afOwnerRole: 'afOwnerRole',
    afTags: 'afTags',
    afFteMin: 'afFteMin',
    afFteMax: 'afFteMax',
    afLeadTimeMin: 'afLtMin',
    afLeadTimeMax: 'afLtMax',
    afSystems: 'afSystems'
} as const;

function isViewMode(value: string): value is ViewMode {
    return VIEW_MODES.includes(value as ViewMode);
}

function normalizeVersionValue(value: any): string {
    return String(value ?? '').trim().replace(/^v/i, '');
}

function deriveApprovalVersion(approval: any): string {
    const explicitVersion = normalizeVersionValue(approval?.version);
    if (explicitVersion) return explicitVersion;

    const labelVersion = normalizeVersionValue(approval?.version_label);
    if (labelVersion) return labelVersion;

    return '';
}

function parseDefinitionObject(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return {};
        try {
            const parsed = JSON.parse(trimmed);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getDefinitionLifecycleState(def: any): string {
    const definition = parseDefinitionObject(def?.definition);
    if (definition.wip === true) return 'wip';
    return String(def?.approval_state || def?.status || definition.approval_state || definition.status || '').trim();
}

export function useProcessArchitecture() {
    const router = useRouter();
    const route = useRoute();
    const backend = BackendFactory.createBackend() as any;

    const procMap: Ref<any> = ref({ mega_proc_list: [] });
    let persistedProcMap: any = procMap.value;
    let procMapSaveQueue: Promise<void> = Promise.resolve();
    const metricsMap: Ref<any> = ref({ domains: [], mega_processes: [], processes: [] });
    const loading = ref(false);
    const searchQuery = ref('');
    // debouncedSearchQuery is the actual value used for filtering (300ms delay)
    const debouncedSearchQuery = ref('');
    let _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    watch(searchQuery, (val) => {
        if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
        _searchDebounceTimer = setTimeout(() => {
            debouncedSearchQuery.value = val || '';
        }, 300);
    });
    const selectedDomain: Ref<string | null> = ref(null);
    // Multi-select domain filter (empty array = all domains selected)
    const selectedDomains: Ref<string[]> = ref([]);
    // Quick filters
    const quickFilterNeedFeedback = ref(false);
    const quickFilterWIL = ref(false);
    const activeView: Ref<ViewMode> = ref('mermaid');
    const processStatuses: Ref<Map<string, ProcessStatus>> = ref(new Map());
    const allProcDefs: Ref<any[]> = ref([]);
    const showToBe = ref(false);

    // Filter presets - persisted in localStorage
    const filterPresets: Ref<FilterPreset[]> = ref(loadFilterPresets());

    // Recently viewed - persisted in localStorage
    const recentlyViewed: Ref<RecentlyViewedItem[]> = ref(loadRecentlyViewed());
    // Favorites set - persisted in localStorage (set of IDs)
    const favorites: Ref<Set<string>> = ref(loadFavorites());

    // Last visit tracking (DB-based)
    const lastVisitAt: Ref<string | null> = ref(null);

    async function initLastVisit() {
        try {
            const email = localStorage.getItem('email');
            if (!email) return;
            const prev = await backend.getLastPageVisit(email, 'process_architecture');
            lastVisitAt.value = prev;
            await backend.updateLastPageVisit(email, 'process_architecture');
        } catch (e) {
            console.warn('Failed to init last visit:', e);
        }
    }

    function isUpdatedSinceLastVisit(process: any): boolean {
        if (!lastVisitAt.value) return false;
        // 직접 전달된 날짜 필드 우선, 없으면 allProcDefs에서 saved_at 조회
        const modified = process.last_modified || process.updated_at || process.saved_at
            || allProcDefs.value.find((d: any) => d.id === process.id)?.saved_at;
        if (!modified) return false;
        return new Date(modified).getTime() > new Date(lastVisitAt.value).getTime();
    }

    // My Processes filter state
    const myProcessFilter = ref({
        enabled: false,
        favorites: false,
        myCreation: false,
        myOrganization: false
    });
    // 현재 사용자 본인 식별자 (uid/email/name)
    const currentUserIdentifiers: Ref<Set<string>> = ref(
        buildIdentitySet([localStorage.getItem('uid'), localStorage.getItem('email'), localStorage.getItem('userName')])
    );
    // 현재 사용자의 직속 팀 식별자 (team id/name/org_code/org_name)
    const currentUserTeamIdentifiers: Ref<Set<string>> = ref(new Set());

    function createDefaultAdvancedFilters() {
        return {
            statuses: [] as string[],
            dateMode: 'none' as 'none' | 'relative' | 'absolute',
            relativeDays: 30 as number,
            dateFrom: '',
            dateTo: '',
            owners: [] as string[],
            ownerRole: 'any' as 'any' | 'primary' | 'co' | 'master',
            systems: [] as string[]
        };
    }

    function normalizeAdvancedFilters(value: any = {}) {
        const dateMode = ['none', 'relative', 'absolute'].includes(value?.dateMode) ? value.dateMode : 'none';
        const ownerRole = ['any', 'primary', 'co', 'master'].includes(value?.ownerRole) ? value.ownerRole : 'any';
        return {
            statuses: Array.isArray(value?.statuses) ? value.statuses : [],
            dateMode: dateMode as 'none' | 'relative' | 'absolute',
            relativeDays: Number.isFinite(Number(value?.relativeDays)) ? Number(value.relativeDays) : 30,
            dateFrom: String(value?.dateFrom || ''),
            dateTo: String(value?.dateTo || ''),
            owners: Array.isArray(value?.owners) ? value.owners : [],
            ownerRole: ownerRole as 'any' | 'primary' | 'co' | 'master',
            systems: Array.isArray(value?.systems) ? value.systems : []
        };
    }

    // Advanced filter state (AND-combined with quick filters)
    const advancedFilters = ref(createDefaultAdvancedFilters());

    function ensureProcMapIds(map: any): any {
        if (!map?.mega_proc_list) return map;
        for (const mega of map.mega_proc_list) {
            if (!mega.id) mega.id = mega.name || '';
            for (const major of mega.major_proc_list || []) {
                if (!major.id) major.id = major.name || '';
                for (const sub of major.sub_proc_list || []) {
                    if (!sub.id) sub.id = sub.name || sub.path || '';
                }
            }
        }
        return map;
    }

    async function loadData() {
        loading.value = true;
        try {
            const [pm, mm] = await Promise.all([backend.getProcessDefinitionMap(), backend.getMetricsMap(), initLastVisit()]);
            procMap.value = ensureProcMapIds(pm && pm.mega_proc_list ? pm : { mega_proc_list: [] });
            persistedProcMap = procMap.value;
            metricsMap.value = mm && mm.domains ? mm : { domains: [], mega_processes: [], processes: [] };
            await loadProcessStatuses();
        } catch (e) {
            console.error('Failed to load process architecture data:', e);
        } finally {
            loading.value = false;
        }
    }

    async function loadProcessStatuses() {
        try {
            const defs = await backend.listDefinitionStatusLite('', { match: { isdeleted: false } });
            if (!defs) return;

            // proc_def_approval_state/proc_def_version 테이블에서 각 프로세스의 최신 상태/버전을 일괄 조회
            const approvalStateMap = new Map<string, any>();
            const latestVersionMap = new Map<string, any>();
            const lockSet = new Set<string>();
            const creatorByProcId = new Map<string, string>();
            const supabase = (window as any).$supabase;
            if (supabase) {
                try {
                    const { data: approvalStates } = await supabase
                        .from('proc_def_approval_state')
                        .select('proc_def_id, state, version, version_label, major_version, minor_version, created_at, updated_at')
                        .eq('tenant_id', (window as any).$tenantName)
                        .order('created_at', { ascending: false });

                    if (approvalStates) {
                        // 각 proc_def_id별 최신 상태만 보존 (created_at desc 정렬이므로 첫 번째가 최신)
                        for (const row of approvalStates) {
                            if (!approvalStateMap.has(row.proc_def_id)) {
                                approvalStateMap.set(row.proc_def_id, row);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Failed to load approval states:', e);
                }
                try {
                    const { data: modelRows } = await supabase
                        .from('tb_bpmn_model')
                        .select('proc_def_id, created_by, updated_at')
                        .eq('tenant_id', (window as any).$tenantName)
                        .is('deleted_at', null)
                        .order('updated_at', { ascending: false });

                    if (modelRows) {
                        for (const row of modelRows) {
                            if (row?.proc_def_id && row.created_by && !creatorByProcId.has(row.proc_def_id)) {
                                creatorByProcId.set(row.proc_def_id, row.created_by);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Failed to load process creators:', e);
                }
                try {
                    // tenant_id로만 필터링하여 전체 조회 (.in()은 URL 길이 초과로 502 발생)
                    const { data: versionRows } = await supabase
                        .from('proc_def_version')
                        .select('proc_def_id, version, version_tag, timeStamp')
                        .eq('tenant_id', (window as any).$tenantName)
                        .order('timeStamp', { ascending: false });

                    if (versionRows) {
                        for (const row of versionRows) {
                            if (row?.proc_def_id && !latestVersionMap.has(row.proc_def_id)) {
                                latestVersionMap.set(row.proc_def_id, row);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Failed to load process versions:', e);
                }
                try {
                    const { data: locks } = await supabase.from('lock').select('id').eq('tenant_id', (window as any).$tenantName);
                    if (locks) {
                        for (const row of locks) {
                            if (row?.id) lockSet.add(row.id);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to load locks:', e);
                }
            }

            allProcDefs.value = defs.map((def: any) => ({
                ...def,
                created_by: def.created_by || creatorByProcId.get(def.id) || null
            }));
            if (myProcessFilter.value.myOrganization) {
                await hydrateProcessBpmnForSwimlaneFilter();
            }

            // proc_def에는 approval_state/status 컬럼이 없다. WIP 같은 직접 상태는 definition JSONB에 저장된다.
            const statusMap = new Map<string, ProcessStatus>();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const def of allProcDefs.value) {
                // 1) proc_def_approval_state 테이블의 최신 상태
                const approval = approvalStateMap.get(def.id);
                const latestVersionRow = latestVersionMap.get(def.id);
                const latestVersion = normalizeVersionValue(latestVersionRow?.version);
                const definitionVersion = normalizeVersionValue(def.version || def.prod_version);
                const approvalVersion = deriveApprovalVersion(approval);
                const version = latestVersion || definitionVersion || approvalVersion;

                // 공통 utils 의 단계 도출 로직 사용 — 대시보드/리뷰보드와 동일
                const status: ProcessStatus['status'] = deriveStatus({
                    approvalStateName: approval?.state,
                    directStatus: def.approval_state || def.status,
                    versionTag: latestVersionRow?.version_tag,
                    hasVersion: latestVersionMap.has(def.id)
                });

                let dDay: number | undefined;
                let reviewEndDate: string | undefined;

                // Calculate D-day for public_feedback: 30 days from review start date
                if (status === 'public_feedback' && approval) {
                    const reviewStartStr = approval.updated_at || approval.created_at || def.updated_at || def.created_at;
                    if (reviewStartStr) {
                        const reviewStart = new Date(reviewStartStr);
                        reviewStart.setHours(0, 0, 0, 0);
                        const endDate = new Date(reviewStart);
                        endDate.setDate(endDate.getDate() + 30);
                        reviewEndDate = formatDateKST(endDate);
                        const diffMs = endDate.getTime() - today.getTime();
                        dDay = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    }
                }

                statusMap.set(def.id, {
                    status,
                    version: version || undefined,
                    dDay,
                    reviewEndDate
                });
            }
            processStatuses.value = statusMap;
        } catch (e) {
            console.error('Failed to load process statuses:', e);
        }
    }

    // 도메인: metrics 값을 기본으로 사용하되, procMap에서 누락된 도메인을 보강한다.
    // metrics가 부분 응답이어도 화면 분류가 "미분류"로 무너지지 않도록 union 처리한다.
    const domains = computed(() => {
        const fromMetrics = Array.isArray(metricsMap.value?.domains) ? metricsMap.value.domains : [];
        const fromProcMap = deriveDomainsFromProcMap(procMap.value);
        return sortDomains(mergeDomainLists(fromMetrics, fromProcMap));
    });

    function buildDomainFilterSet(filterValues: string[]): Set<string> {
        const filterSet = new Set<string>();

        for (const value of filterValues) {
            if (!value) continue;

            filterSet.add(value);

            const matchedDomain = domains.value.find((domain: any) => domain.name === value || domain.id === value);
            if (!matchedDomain) continue;

            if (matchedDomain.name) filterSet.add(matchedDomain.name);
            if (matchedDomain.id) filterSet.add(matchedDomain.id);
        }

        return filterSet;
    }

    function matchesDomainFilter(domainValue: string | null | undefined, filterSet: Set<string>): boolean {
        if (filterSet.size === 0) return true;
        if (!domainValue) return false;
        if (filterSet.has(domainValue)) return true;

        const matchedDomain = domains.value.find((domain: any) => domain.name === domainValue || domain.id === domainValue);
        if (!matchedDomain) return false;

        return filterSet.has(matchedDomain.name) || filterSet.has(matchedDomain.id);
    }

    // Compute the set of process IDs that match My Processes filter (OR logic)
    const myProcessIds = computed((): Set<string> | null => {
        const f = myProcessFilter.value;
        if (!f.enabled) return null;

        const matchedIds = new Set<string>();
        const myIdentifiers = currentUserIdentifiers.value;
        const teamIdentifiers = currentUserTeamIdentifiers.value;
        const subById = buildSubProcessIndex(procMap.value);

        // Always include favorites when that option is on (from localStorage)
        if (f.favorites) {
            favorites.value.forEach((id) => matchedIds.add(id));
        }

        for (const def of allProcDefs.value) {
            const sub = subById.get(def.id);

            if (f.myCreation && matchesAnyIdentity([def.owner, def.created_by, sub?.owner], myIdentifiers)) {
                matchedIds.add(def.id);
            }
            if (
                f.myOrganization &&
                matchesAnyIdentity(getProcessSwimlaneTeamCandidates(def), teamIdentifiers)
            ) {
                matchedIds.add(def.id);
            }
        }

        return matchedIds;
    });

    // IDs of processes currently in public feedback (Need Feedback quick filter)
    const needFeedbackIds = computed((): Set<string> => {
        const ids = new Set<string>();
        processStatuses.value.forEach((ps, id) => {
            if (ps.status === 'public_feedback') {
                ids.add(id);
            }
        });
        return ids;
    });

    const processDefById = computed(() => {
        const map = new Map<string, any>();
        for (const def of allProcDefs.value) {
            if (def?.id) map.set(String(def.id), def);
        }
        return map;
    });

    // IDs of processes with WIP status (AI/automation task in progress)
    const wilIds = computed((): Set<string> => {
        const ids = new Set<string>();
        processStatuses.value.forEach((ps, id) => {
            if (ps.status === 'wip') {
                ids.add(id);
            }
        });
        return ids;
    });

    // Helper: check if a sub-process passes the advanced filters
    function matchesStatusFilter(status: ProcessStatus['status'], selectedStatuses: string[]): boolean {
        if (selectedStatuses.includes(status)) return true;
        if (status === 'in_review') return selectedStatuses.includes('review');
        if (status === 'public_feedback') return selectedStatuses.includes('public_review');
        return false;
    }

    function collectOwnerCandidates(sub: any, role: 'any' | 'primary' | 'co' | 'master'): unknown[] {
        const def = processDefById.value.get(String(sub?.id || ''));
        const definition = parseDefinitionObject(def?.definition);
        const meta = isRecord(definition.meta) ? definition.meta : {};
        const owners = isRecord(meta.owners) ? meta.owners : {};
        const candidates: unknown[] = [];
        const add = (...values: unknown[]) => values.forEach((value) => pushIdentityCandidates(candidates, value));

        if (role === 'any' || role === 'primary') {
            add(
                sub?.owner,
                sub?.primary_owner,
                sub?.primaryOwner,
                def?.owner,
                def?.primary_owner,
                def?.primaryOwner,
                owners.primaryOwner
            );
        }
        if (role === 'any' || role === 'co') {
            add(
                sub?.co_owners,
                sub?.field_owners,
                sub?.hq_owners,
                def?.co_owners,
                def?.field_owners,
                def?.hq_owners,
                owners.fieldOwners,
                owners.hqOwners
            );
        }
        if (role === 'any' || role === 'master') {
            add(
                sub?.master,
                sub?.master_owner,
                sub?.masterOwner,
                def?.master,
                def?.master_owner,
                def?.masterOwner,
                owners.masterOwner
            );
        }
        if (role === 'any') {
            add(sub?.created_by, def?.created_by);
        }

        return candidates;
    }

    function passesAdvancedFilters(sub: any): boolean {
        const af = advancedFilters.value;

        // Status filter
        if (af.statuses.length > 0) {
            const ps = processStatuses.value.get(sub.id);
            if (!ps || ps.status === 'none' || !matchesStatusFilter(ps.status, af.statuses)) return false;
        }

        // Date range filter (against sub.updated_at or sub.created_at)
        if (af.dateMode !== 'none') {
            const dateStr = sub.updated_at || sub.created_at || '';
            const date = dateStr ? new Date(dateStr) : null;
            if (!date) return false;

            if (af.dateMode === 'relative' && af.relativeDays) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - af.relativeDays);
                if (date < cutoff) return false;
            } else if (af.dateMode === 'absolute') {
                if (af.dateFrom && date < new Date(af.dateFrom)) return false;
                if (af.dateTo && date > new Date(af.dateTo + 'T23:59:59')) return false;
            }
        }

        // Ownership filter
        if (af.owners.length > 0) {
            const selectedOwners = buildIdentitySet(af.owners);
            if (!matchesAnyIdentity(collectOwnerCandidates(sub, af.ownerRole), selectedOwners)) return false;
        }

        // System/OSS filter
        if (af.systems.length > 0) {
            const subSystems: string[] = sub.systems || sub.oss || [];
            if (!af.systems.some((s: string) => subSystems.includes(s))) return false;
        }

        return true;
    }

    const filteredProcMap = computed(() => {
        const map = procMap.value;
        if (!map || !map.mega_proc_list) return { mega_proc_list: [] };

        const query = debouncedSearchQuery.value.toLowerCase().trim();
        const domainFilterSet = buildDomainFilterSet([
            ...(selectedDomain.value ? [selectedDomain.value] : []),
            ...selectedDomains.value
        ]);
        const myIds = myProcessIds.value;
        const needFeedback = quickFilterNeedFeedback.value;
        const wil = quickFilterWIL.value;
        const af = advancedFilters.value;
        const hasAdvanced =
            af.statuses.length > 0 ||
            af.dateMode !== 'none' ||
            af.owners.length > 0 ||
            af.systems.length > 0;

        const hasFilter = query || domainFilterSet.size > 0 || myIds || needFeedback || wil || hasAdvanced;
        if (!hasFilter) return map;
        const shouldPreserveEmptyMegasForDomainFilter = domainFilterSet.size > 0 && !query && !myIds && !needFeedback && !wil && !hasAdvanced;

        const filtered = {
            ...map,
            mega_proc_list: map.mega_proc_list
                .map((mega: any) => {
                    const filteredMajors = (mega.major_proc_list || [])
                        .map((major: any) => {
                            if (domainFilterSet.size > 0) {
                                const majorDomain = getMajorBusinessDomain(major, domains.value);
                                if (!matchesDomainFilter(majorDomain, domainFilterSet)) return null;
                            }

                            const filteredSubs = (major.sub_proc_list || []).filter((sub: any) => {
                                if (myIds && !myIds.has(sub.id)) return false;
                                if (needFeedback && !needFeedbackIds.value.has(sub.id)) return false;
                                if (wil && !wilIds.value.has(sub.id)) return false;
                                if (hasAdvanced && !passesAdvancedFilters(sub)) return false;
                                if (!query) return true;
                                return sub.name?.toLowerCase().includes(query) || sub.id?.toLowerCase().includes(query);
                            });

                            const hasSubFilter = query || myIds || needFeedback || wil || hasAdvanced;
                            if (hasSubFilter && filteredSubs.length === 0 && !major.name?.toLowerCase().includes(query)) {
                                return null;
                            }

                            return {
                                ...major,
                                sub_proc_list: hasSubFilter ? filteredSubs : major.sub_proc_list
                            };
                        })
                        .filter(Boolean);

                    if (filteredMajors.length === 0 && !shouldPreserveEmptyMegasForDomainFilter) return null;

                    return {
                        ...mega,
                        major_proc_list: filteredMajors
                    };
                })
                .filter(Boolean)
        };

        return filtered;
    });

    const filteredMetricsMap = computed(() => {
        const mm = metricsMap.value;
        if (!mm) return { domains: [], mega_processes: [], processes: [] };

        const query = debouncedSearchQuery.value.toLowerCase().trim();
        const domainFilterSet = buildDomainFilterSet([
            ...(selectedDomain.value ? [selectedDomain.value] : []),
            ...selectedDomains.value
        ]);

        let filteredDomains = mm.domains || [];
        let filteredMegaProcesses = mm.mega_processes || [];
        let filteredProcesses = mm.processes || [];

        if (domainFilterSet.size > 0) {
            filteredDomains = filteredDomains.filter(
                (domain: any) => matchesDomainFilter(domain.name, domainFilterSet) || matchesDomainFilter(domain.id, domainFilterSet)
            );
            filteredProcesses = filteredProcesses.filter((process: any) =>
                matchesDomainFilter(process.domain_id || process.domain_name || process.domain, domainFilterSet)
            );
        }

        if (query) {
            filteredProcesses = filteredProcesses.filter((p: any) => p.name?.toLowerCase().includes(query));
        }

        if (myProcessIds.value) {
            filteredProcesses = filteredProcesses.filter((p: any) => myProcessIds.value!.has(p.id));
        }

        if (domainFilterSet.size > 0 || query || myProcessIds.value) {
            filteredDomains = filteredDomains.filter((domain: any) =>
                filteredProcesses.some(
                    (process: any) =>
                        process.domain_id === domain.id ||
                        process.domain_id === domain.name ||
                        process.domain_name === domain.name ||
                        process.domain === domain.name
                )
            );

            const visibleMegaProcessIds = new Set(filteredProcesses.map((process: any) => process.mega_process_id).filter(Boolean));
            filteredMegaProcesses = filteredMegaProcesses.filter((megaProcess: any) => visibleMegaProcessIds.has(megaProcess.id));
        }

        return {
            ...mm,
            domains: filteredDomains,
            mega_processes: filteredMegaProcesses,
            processes: filteredProcesses
        };
    });

    const stats = computed(() => {
        // 모집단 = 체계도 계층(filteredProcMap) 의 sub_proc id 집합 — 공유 utils 사용
        const visibleSubIds = collectHierarchyProcIds(filteredProcMap.value);
        // 체계도에 등록되지 않는 "프로세스 모듈"(call-activity-sub)은 카운트 모집단에서 제외
        // (리뷰보드/Executive Summary 와 동일 기준 — 카운트 통합 유지)
        for (const id of collectModuleProcIds(allProcDefs.value)) visibleSubIds.delete(id);
        const subTotal = visibleSubIds.size;

        let published = 0;
        let inReview = 0;
        let publicFeedback = 0;
        let finalEdit = 0;
        let draft = 0;
        processStatuses.value.forEach((ps, id) => {
            if (!visibleSubIds.has(id)) return;
            if (ps.status === 'published') published++;
            else if (ps.status === 'in_review') inReview++;
            else if (ps.status === 'public_feedback') publicFeedback++;
            else if (ps.status === 'final_edit') finalEdit++;
            else if (ps.status === 'draft') draft++;
        });

        return { subTotal, draft, inReview, publicFeedback, finalEdit, published };
    });

    function getProcessStatus(subId: string): ProcessStatus | undefined {
        return processStatuses.value.get(subId);
    }

    function navigateToProcess(subId: string, subName?: string) {
        const name = subName || subId;
        addToRecentlyViewed(subId, name);
        router.push({
            path: '/process-hierarchy',
            query: {
                ...buildProcessHierarchyQuery({
                    name,
                    entry: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE
                }),
                id: subId
            }
        });
    }

    // --- localStorage helpers ---
    function loadRecentlyViewed(): RecentlyViewedItem[] {
        try {
            const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveRecentlyViewed(items: RecentlyViewedItem[]) {
        try {
            localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
        } catch {}
    }

    function loadFavorites(): Set<string> {
        try {
            const raw = localStorage.getItem(FAVORITES_KEY);
            return raw ? new Set(JSON.parse(raw)) : new Set();
        } catch {
            return new Set();
        }
    }

    function saveFavorites(set: Set<string>) {
        try {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
        } catch {}
    }

    function loadFilterPresets(): FilterPreset[] {
        try {
            const raw = localStorage.getItem(FILTER_PRESETS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function persistFilterPresets() {
        localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(filterPresets.value));
    }

    function saveFilterPreset(name: string) {
        const preset: FilterPreset = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name,
            createdAt: Date.now(),
            filters: {
                searchQuery: searchQuery.value,
                selectedDomains: [...selectedDomains.value],
                quickFilterNeedFeedback: quickFilterNeedFeedback.value,
                quickFilterWIL: quickFilterWIL.value,
                showToBe: showToBe.value,
                myProcessFilter: { ...myProcessFilter.value },
                advancedFilters: JSON.parse(JSON.stringify(advancedFilters.value)),
            },
        };
        filterPresets.value.push(preset);
        persistFilterPresets();
    }

    function loadFilterPreset(presetId: string) {
        const preset = filterPresets.value.find(p => p.id === presetId);
        if (!preset) return;
        const f = preset.filters;
        searchQuery.value = f.searchQuery || '';
        selectedDomains.value = f.selectedDomains || [];
        quickFilterNeedFeedback.value = false;
        quickFilterWIL.value = f.quickFilterWIL || false;
        showToBe.value = f.showToBe || false;
        myProcessFilter.value = {
            ...(f.myProcessFilter || { enabled: false, favorites: false, myCreation: false, myOrganization: false }),
            myCreation: false
        };
        myProcessFilter.value.enabled = myProcessFilter.value.favorites || myProcessFilter.value.myOrganization;
        if (myProcessFilter.value.myCreation || myProcessFilter.value.myOrganization) {
            loadCurrentUserOrgs();
        }
        if (f.advancedFilters) {
            advancedFilters.value = normalizeAdvancedFilters(f.advancedFilters);
        }
    }

    function deleteFilterPreset(presetId: string) {
        filterPresets.value = filterPresets.value.filter(p => p.id !== presetId);
        persistFilterPresets();
    }

    function addToRecentlyViewed(id: string, name: string) {
        const existing = recentlyViewed.value.filter((item) => item.id !== id);
        const updated = [{ id, name, visitedAt: Date.now() }, ...existing].slice(0, MAX_RECENTLY_VIEWED);
        recentlyViewed.value = updated;
        saveRecentlyViewed(updated);
    }

    function toggleFavorite(id: string) {
        const newSet = new Set(favorites.value);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        favorites.value = newSet;
        saveFavorites(newSet);
    }

    function isFavorite(id: string): boolean {
        return favorites.value.has(id);
    }

    // Top 5 recently viewed items
    const topRecentlyViewed = computed(() => recentlyViewed.value.slice(0, 5));

    function getDomainColor(domainName: string): string {
        const d = domains.value.find((d: any) => d.name === domainName);
        return d?.color || '#607D8B';
    }

    async function hydrateProcessBpmnForSwimlaneFilter() {
        const supabase = (window as any).$supabase;
        const tenantId = (window as any).$tenantName;
        if (!supabase || !tenantId || allProcDefs.value.length === 0) return;
        if (!allProcDefs.value.some((def: any) => typeof def?.bpmn !== 'string' || !def.bpmn.trim())) return;

        try {
            const { data, error } = await supabase.from('proc_def').select('id,bpmn').eq('tenant_id', tenantId).is('deleted_at', null);
            if (error) {
                console.warn('[useProcessArchitecture] Failed to load BPMN for swimlane filter:', error);
                return;
            }

            const bpmnById = new Map<string, string>();
            for (const row of data || []) {
                if (row?.id && typeof row.bpmn === 'string') bpmnById.set(row.id, row.bpmn);
            }

            allProcDefs.value = allProcDefs.value.map((def: any) => {
                if (typeof def?.bpmn === 'string' && def.bpmn.trim()) return def;
                const bpmn = bpmnById.get(def.id);
                return bpmn ? { ...def, bpmn } : def;
            });
        } catch (e) {
            console.warn('[useProcessArchitecture] Failed to hydrate BPMN for swimlane filter:', e);
        }
    }

    async function loadCurrentUserOrgs() {
        try {
            const seedIdentifiers = buildIdentitySet([
                localStorage.getItem('uid'),
                localStorage.getItem('email'),
                localStorage.getItem('userName'),
                localStorage.getItem('employeeNo')
            ]);
            currentUserIdentifiers.value = seedIdentifiers;

            const { getCurrentUserTeamIdentifiers } = await import('@/utils/organizationUtils');
            const [userInfo, teamIdentifiers] = await Promise.all([
                backend.getUserInfo().catch(() => null),
                getCurrentUserTeamIdentifiers()
            ]);

            currentUserIdentifiers.value = buildIdentitySet([
                ...seedIdentifiers,
                userInfo?.uid,
                userInfo?.email,
                userInfo?.name,
                userInfo?.employee_no
            ]);
            currentUserTeamIdentifiers.value = buildIdentitySet(teamIdentifiers);
            if (myProcessFilter.value.myOrganization) {
                await hydrateProcessBpmnForSwimlaneFilter();
            }
            console.log('[useProcessArchitecture] myIdentifiers:', [...currentUserIdentifiers.value]);
            console.log('[useProcessArchitecture] teamIdentifiers:', [...currentUserTeamIdentifiers.value]);
        } catch (e) {
            console.warn('[useProcessArchitecture] Failed to load user/team identifiers:', e);
        }
    }

    // ---- 체계도 편집 잠금 (proc_map lock) ----
    const PROC_MAP_LOCK_ID = 'proc_map';
    const LOCK_HEARTBEAT_INTERVAL = 30_000; // 30초
    const LOCK_STALE_MINUTES = 5; // 5분 이상 heartbeat 없으면 stale

    const editLock = ref<{ locked: boolean; lockedBy: string; isMine: boolean }>({
        locked: false,
        lockedBy: '',
        isMine: false
    });
    let lockHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

    function getCurrentUsEmail(): string {
        return localStorage.getItem('email') || (window as any).$user?.email || '';
    }

    function getCurrentUsId(): string {
        return localStorage.getItem('uid') || (window as any).$user?.id || '';
    }

    /** 현재 lock 상태 조회 */
    async function checkEditLock(): Promise<void> {
        try {
            const lock = await backend.getLock(PROC_MAP_LOCK_ID);
            if (!lock) {
                editLock.value = { locked: false, lockedBy: '', isMine: false };
                return;
            }
            const myId = getCurrentUsId();
            const isMine = lock.user_id === myId;
            // stale 체크
            if (!isMine) {
                const heartbeat = lock.heartbeat_at ? new Date(lock.heartbeat_at).getTime() : 0;
                if (Date.now() - heartbeat > LOCK_STALE_MINUTES * 60 * 1000) {
                    // stale lock 자동 해제
                    await backend.deleteLock(PROC_MAP_LOCK_ID);
                    editLock.value = { locked: false, lockedBy: '', isMine: false };
                    return;
                }
            }
            editLock.value = { locked: true, lockedBy: lock.user_id, isMine };
        } catch (e) {
            console.warn('[useProcessArchitecture] checkEditLock failed:', e);
        }
    }

    /** lock 획득 시도 — 성공 시 heartbeat 시작, 실패 시 lockedBy 반환 */
    async function acquireEditLock(): Promise<{ acquired: boolean; lockedBy: string | null }> {
        try {
            const myId = getCurrentUsId();
            if (!myId) return { acquired: false, lockedBy: null };
            const result = await backend.acquireLockWithStaleCheck(
                { id: PROC_MAP_LOCK_ID, user_id: myId },
                LOCK_STALE_MINUTES
            );
            if (result.acquired) {
                editLock.value = { locked: true, lockedBy: myId, isMine: true };
                startLockHeartbeat();
            } else {
                editLock.value = { locked: true, lockedBy: result.lockedBy || '', isMine: false };
            }
            return result;
        } catch (e) {
            console.warn('[useProcessArchitecture] acquireEditLock failed:', e);
            return { acquired: false, lockedBy: null };
        }
    }

    /** lock 해제 */
    async function releaseEditLock(): Promise<void> {
        stopLockHeartbeat();
        try {
            const lock = await backend.getLock(PROC_MAP_LOCK_ID);
            if (lock && lock.user_id === getCurrentUsId()) {
                await backend.deleteLock(PROC_MAP_LOCK_ID);
            }
            editLock.value = { locked: false, lockedBy: '', isMine: false };
        } catch (e) {
            console.warn('[useProcessArchitecture] releaseEditLock failed:', e);
        }
    }

    function startLockHeartbeat() {
        stopLockHeartbeat();
        lockHeartbeatTimer = setInterval(async () => {
            try {
                await backend.updateLockHeartbeat(PROC_MAP_LOCK_ID);
            } catch {
                // heartbeat 실패 무시
            }
        }, LOCK_HEARTBEAT_INTERVAL);
    }

    function stopLockHeartbeat() {
        if (lockHeartbeatTimer) {
            clearInterval(lockHeartbeatTimer);
            lockHeartbeatTimer = null;
        }
    }

    async function saveProcMap(newMap: any): Promise<void> {
        procMap.value = newMap;
        const runSave = async () => {
            await backend.putProcessDefinitionMap(newMap);
            await backend.syncAllProcessDefinitionHierarchyFromMap?.(newMap, metricsMap.value);
            persistedProcMap = newMap;
        };
        const saveResult = procMapSaveQueue.then(runSave, runSave);
        procMapSaveQueue = saveResult.catch(() => undefined);
        try {
            await saveResult;
        } catch (e) {
            if (procMap.value === newMap) {
                procMap.value = persistedProcMap;
            }
            console.error('[useProcessArchitecture] Failed to save proc map:', e);
            throw e;
        }
    }

    /** 메트릭스 맵(도메인 등) 저장 — 도메인 추가/수정 시 사용 */
    async function saveMetricsMap(newMetricsMap: any): Promise<void> {
        try {
            await backend.putMetricsMap(newMetricsMap);
            metricsMap.value = newMetricsMap;
        } catch (e) {
            console.error('[useProcessArchitecture] Failed to save metrics map:', e);
            throw e;
        }
    }

    let applyingRouteQuery = false;
    // 최초 마운트 여부 — 첫 진입에서만 기본 도메인 필터를 적용하고,
    // 이후 사용자가 "전체"를 선택해 쿼리가 비어도 기본값을 다시 강제하지 않는다.
    let hasAppliedInitialRouteQuery = false;

    function readQueryString(value: any): string {
        if (Array.isArray(value)) return String(value[0] || '');
        return String(value || '');
    }

    function readQueryList(value: any): string[] {
        const values = Array.isArray(value) ? value : value ? [value] : [];
        return values
            .flatMap((item) => String(item || '').split(','))
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function readQueryBoolean(value: any): boolean {
        const normalized = readQueryString(value).toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }

    function readQueryNumber(value: any, fallback: number): number {
        const str = readQueryString(value);
        if (!str) return fallback;
        const num = Number(str);
        return Number.isFinite(num) ? num : fallback;
    }

    function setQueryValue(nextQuery: Record<string, any>, key: string, value: any) {
        if (value === undefined || value === null || value === '' || value === false) {
            delete nextQuery[key];
            return;
        }
        nextQuery[key] = value === true ? '1' : value;
    }

    function normalizeQueryValue(value: any): string[] {
        if (value === undefined || value === null) return [];
        return (Array.isArray(value) ? value : [value]).map((item) => String(item));
    }

    function isSameQuery(a: Record<string, any>, b: Record<string, any>): boolean {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) {
            const aValue = normalizeQueryValue(a[key]);
            const bValue = normalizeQueryValue(b[key]);
            if (aValue.length !== bValue.length) return false;
            for (let i = 0; i < aValue.length; i += 1) {
                if (aValue[i] !== bValue[i]) return false;
            }
        }
        return true;
    }

    function applyRouteQueryToFilters(query: Record<string, any>) {
        applyingRouteQuery = true;

        const routeView = readQueryString(query[FILTER_QUERY_KEYS.view]);
        activeView.value = routeView && isViewMode(routeView) ? routeView : 'mermaid';

        searchQuery.value = readQueryString(query[FILTER_QUERY_KEYS.search]);

        const routeDomains = readQueryList(query[FILTER_QUERY_KEYS.domains]);
        const routeSingleDomain = readQueryString(query[FILTER_QUERY_KEYS.domain]) || null;
        const isLegacyDefaultDomainFilter =
            routeDomains.length === DEFAULT_SELECTED_DOMAINS.length &&
            DEFAULT_SELECTED_DOMAINS.every((domain) => routeDomains.includes(domain));
        if (!hasAppliedInitialRouteQuery && !routeSingleDomain && (routeDomains.length === 0 || isLegacyDefaultDomainFilter)) {
            // 최초 진입은 도메인을 제한하지 않는 전체뷰가 기본이다.
            // 이전 버전이 자동으로 URL에 기록한 6개 도메인 조합도 전체뷰로 정리한다.
            selectedDomains.value = [];
            selectedDomain.value = null;
        } else {
            selectedDomains.value = routeDomains;
            selectedDomain.value = routeDomains.length > 0 ? null : routeSingleDomain;
        }
        hasAppliedInitialRouteQuery = true;

        quickFilterNeedFeedback.value = false;
        quickFilterWIL.value = readQueryBoolean(query[FILTER_QUERY_KEYS.wil]);
        showToBe.value = readQueryBoolean(query[FILTER_QUERY_KEYS.toBe]);

        const nextMyProcessFilter = {
            enabled: false,
            favorites: readQueryBoolean(query[FILTER_QUERY_KEYS.myFavorites]),
            myCreation: false,
            myOrganization: readQueryBoolean(query[FILTER_QUERY_KEYS.myOrganization])
        };
        nextMyProcessFilter.enabled = nextMyProcessFilter.favorites || nextMyProcessFilter.myCreation || nextMyProcessFilter.myOrganization;
        myProcessFilter.value = nextMyProcessFilter;
        if (nextMyProcessFilter.myCreation || nextMyProcessFilter.myOrganization) {
            loadCurrentUserOrgs();
        }

        // Advanced filters from URL
        const afStatuses = readQueryList(query[FILTER_QUERY_KEYS.afStatuses]);
        const afDateMode = readQueryString(query[FILTER_QUERY_KEYS.afDateMode]);
        const afRelativeDays = readQueryNumber(query[FILTER_QUERY_KEYS.afRelativeDays], 30);
        const afDateFrom = readQueryString(query[FILTER_QUERY_KEYS.afDateFrom]);
        const afDateTo = readQueryString(query[FILTER_QUERY_KEYS.afDateTo]);
        const afOwners = readQueryList(query[FILTER_QUERY_KEYS.afOwners]);
        const afOwnerRole = readQueryString(query[FILTER_QUERY_KEYS.afOwnerRole]);
        const afSystems = readQueryList(query[FILTER_QUERY_KEYS.afSystems]);

        advancedFilters.value = normalizeAdvancedFilters({
            statuses: afStatuses,
            dateMode: (['none', 'relative', 'absolute'].includes(afDateMode) ? afDateMode : 'none') as 'none' | 'relative' | 'absolute',
            relativeDays: afRelativeDays,
            dateFrom: afDateFrom,
            dateTo: afDateTo,
            owners: afOwners,
            ownerRole: (['any', 'primary', 'co', 'master'].includes(afOwnerRole) ? afOwnerRole : 'any') as 'any' | 'primary' | 'co' | 'master',
            systems: afSystems
        });

        Promise.resolve().then(() => {
            applyingRouteQuery = false;
        });
    }

    function syncFiltersToRoute() {
        if (applyingRouteQuery) return;

        const prevQuery = route.query as Record<string, any>;
        const nextQuery: Record<string, any> = { ...prevQuery };
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.view, activeView.value !== 'mermaid' ? activeView.value : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.search, searchQuery.value.trim());
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.domain, selectedDomain.value || undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.domains, selectedDomains.value.length > 0 ? selectedDomains.value.join(',') : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.needFeedback, undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.wil, quickFilterWIL.value);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.toBe, showToBe.value);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.myFavorites, myProcessFilter.value.favorites);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.myCreation, undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.myOrganization, myProcessFilter.value.myOrganization);

        // Advanced filters
        const af = advancedFilters.value;
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afStatuses, af.statuses.length > 0 ? af.statuses.join(',') : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afDateMode, af.dateMode !== 'none' ? af.dateMode : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afRelativeDays, af.dateMode === 'relative' && af.relativeDays !== 30 ? String(af.relativeDays) : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afDateFrom, af.dateMode === 'absolute' ? af.dateFrom : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afDateTo, af.dateMode === 'absolute' ? af.dateTo : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afOwners, af.owners.length > 0 ? af.owners.join(',') : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afOwnerRole, af.ownerRole !== 'any' ? af.ownerRole : undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afTags, undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afFteMin, undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afFteMax, undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afLeadTimeMin, undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afLeadTimeMax, undefined);
        setQueryValue(nextQuery, FILTER_QUERY_KEYS.afSystems, af.systems.length > 0 ? af.systems.join(',') : undefined);

        if (isSameQuery(prevQuery, nextQuery)) return;

        // 검색어만 변경된 경우 replace (히스토리 과다 방지), 나머지 필터 변경은 push (뒤로가기 지원)
        const onlySearchChanged = Object.keys(nextQuery).concat(Object.keys(prevQuery))
            .filter((k) => k !== FILTER_QUERY_KEYS.search)
            .every((k) => {
                const a = normalizeQueryValue(prevQuery[k]);
                const b = normalizeQueryValue(nextQuery[k]);
                return a.length === b.length && a.every((v, i) => v === b[i]);
            });
        const nav = onlySearchChanged ? router.replace({ query: nextQuery }) : router.push({ query: nextQuery });
        nav.catch(() => undefined);
    }

    watch(
        () => route.query,
        (query) => applyRouteQueryToFilters(query as Record<string, any>),
        { immediate: true }
    );

    watch(
        [searchQuery, selectedDomain, selectedDomains, quickFilterNeedFeedback, quickFilterWIL, showToBe, activeView, myProcessFilter, advancedFilters],
        syncFiltersToRoute,
        { deep: true }
    );

    return {
        procMap,
        metricsMap,
        loading,
        searchQuery,
        selectedDomain,
        selectedDomains,
        quickFilterNeedFeedback,
        quickFilterWIL,
        activeView,
        processStatuses,
        allProcDefs,
        loadData,
        loadProcessStatuses,
        domains,
        filteredProcMap,
        filteredMetricsMap,
        stats,
        getProcessStatus,
        navigateToProcess,
        getDomainColor,
        recentlyViewed,
        topRecentlyViewed,
        favorites,
        toggleFavorite,
        isFavorite,
        showToBe,
        myProcessFilter,
        loadCurrentUserOrgs,
        saveProcMap,
        advancedFilters,
        filterPresets,
        saveFilterPreset,
        loadFilterPreset,
        deleteFilterPreset,
        saveMetricsMap,
        isUpdatedSinceLastVisit,
        editLock,
        checkEditLock,
        acquireEditLock,
        releaseEditLock
    };
}
