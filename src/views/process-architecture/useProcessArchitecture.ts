import { ref, computed, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
export { generateProcessId, collectAllProcessIds, isPidInUse } from './processIdUtils';

export type ViewMode = 'card' | 'matrix' | 'tree' | 'hierarchy';

export interface ProcessStatus {
    status: 'none' | 'draft' | 'review' | 'published' | 'public_review' | 'wip' | 'sunset';
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

export function useProcessArchitecture() {
    const router = useRouter();
    const backend = BackendFactory.createBackend() as any;

    const procMap: Ref<any> = ref({ mega_proc_list: [] });
    const metricsMap: Ref<any> = ref({ domains: [], mega_processes: [], processes: [] });
    const loading = ref(false);
    const searchQuery = ref('');
    // debouncedSearchQuery is the actual value used for filtering (300ms delay)
    const debouncedSearchQuery = ref('');
    let _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    watch(searchQuery, (val) => {
        if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
        _searchDebounceTimer = setTimeout(() => {
            debouncedSearchQuery.value = val;
        }, 300);
    });
    const selectedDomain: Ref<string | null> = ref(null);
    // Multi-select domain filter (empty array = all domains selected)
    const selectedDomains: Ref<string[]> = ref([]);
    // Quick filters
    const quickFilterNeedFeedback = ref(false);
    const quickFilterWIL = ref(false);
    const activeView: Ref<ViewMode> = ref('card');
    const processStatuses: Ref<Map<string, ProcessStatus>> = ref(new Map());
    const allProcDefs: Ref<any[]> = ref([]);
    const showToBe = ref(false);

    // Filter presets - persisted in localStorage
    const filterPresets: Ref<FilterPreset[]> = ref(loadFilterPresets());

    // Recently viewed - persisted in localStorage
    const recentlyViewed: Ref<RecentlyViewedItem[]> = ref(loadRecentlyViewed());
    // Favorites set - persisted in localStorage (set of IDs)
    const favorites: Ref<Set<string>> = ref(loadFavorites());

    // My Processes filter state
    const myProcessFilter = ref({
        enabled: false,
        favorites: false,
        myCreation: false,
        myOrganization: false
    });
    // Current user org IDs loaded lazily when My Organization filter is first enabled
    const currentUserOrgIds: Ref<string[]> = ref([]);
    const currentUserId: Ref<string> = ref((window as any).$user?.id || '');

    // Advanced filter state (AND-combined with quick filters)
    const advancedFilters = ref({
        statuses: [] as string[],
        dateMode: 'none' as 'none' | 'relative' | 'absolute',
        relativeDays: 30 as number,
        dateFrom: '',
        dateTo: '',
        owners: [] as string[],
        ownerRole: 'any' as 'any' | 'primary' | 'co' | 'master',
        tags: [] as string[],
        fteRange: [0, 10] as [number, number],
        leadTimeRange: [0, 365] as [number, number],
        systems: [] as string[]
    });

    async function loadData() {
        loading.value = true;
        try {
            const [pm, mm] = await Promise.all([backend.getProcessDefinitionMap(), backend.getMetricsMap()]);
            procMap.value = pm && pm.mega_proc_list ? pm : { mega_proc_list: [] };
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
            allProcDefs.value = defs;

            // proc_def_approval_state 테이블에서 각 프로세스의 최신 승인 상태를 일괄 조회
            const approvalStateMap = new Map<string, any>();
            const lockSet = new Set<string>();
            const supabase = (window as any).$supabase;
            if (supabase) {
                try {
                    const { data: approvalStates } = await supabase
                        .from('proc_def_approval_state')
                        .select('proc_def_id, state, created_at, updated_at')
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

            // proc_def 테이블의 approval_state 컬럼도 체크 (WIP 등 직접 설정된 상태)
            const statusMap = new Map<string, ProcessStatus>();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const def of defs) {
                let status: 'none' | 'draft' | 'review' | 'published' | 'public_review' | 'wip' | 'sunset' = 'none';

                // 1) proc_def_approval_state 테이블의 최신 상태
                const approval = approvalStateMap.get(def.id);
                const approvalStateName = approval?.state || '';

                // 2) proc_def 테이블의 직접 설정 상태 (wip, sunset 등)
                const directStatus = def.approval_state || def.status || '';

                // 직접 설정된 WIP/sunset이 우선
                if (directStatus === 'wip') {
                    status = 'wip';
                } else if (directStatus === 'sunset') {
                    status = 'sunset';
                } else if (approvalStateName === 'public_feedback') {
                    status = 'public_review';
                } else if (approvalStateName === 'in_review' || approvalStateName === 'final_edit') {
                    status = 'review';
                } else if (approvalStateName === 'published') {
                    status = 'published';
                } else if (def.version_tag === 'major' || def.version_tag === 'published') {
                    status = 'published';
                } else if (lockSet.has(def.id)) {
                    status = 'draft';
                }

                let dDay: number | undefined;
                let reviewEndDate: string | undefined;

                // Calculate D-day for public_review: 30 days from review start date
                if (status === 'public_review' && approval) {
                    const reviewStartStr = approval.updated_at || approval.created_at || def.updated_at || def.created_at;
                    if (reviewStartStr) {
                        const reviewStart = new Date(reviewStartStr);
                        reviewStart.setHours(0, 0, 0, 0);
                        const endDate = new Date(reviewStart);
                        endDate.setDate(endDate.getDate() + 30);
                        reviewEndDate = endDate.toISOString().slice(0, 10);
                        const diffMs = endDate.getTime() - today.getTime();
                        dDay = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    }
                }

                statusMap.set(def.id, {
                    status,
                    version: def.version || undefined,
                    dDay,
                    reviewEndDate
                });
            }
            processStatuses.value = statusMap;
        } catch (e) {
            console.error('Failed to load process statuses:', e);
        }
    }

    // 도메인: metrics API 결과 우선, 없으면(예: uEngine 모드에서 getMetricsMap 실패/빈 응답) procMap에서 추출
    const domains = computed(() => {
        const fromMetrics = metricsMap.value?.domains;
        if (fromMetrics && Array.isArray(fromMetrics) && fromMetrics.length > 0) {
            return fromMetrics;
        }
        // procMap에서 major.domain / major.domain_id로 고유 도메인 목록 추출 (uEngine 등 fallback)
        const map = procMap.value;
        if (!map?.mega_proc_list) return [];
        const seen = new Set<string>();
        const list: { id: string; name: string; color?: string }[] = [];
        for (const mega of map.mega_proc_list) {
            for (const major of mega.major_proc_list || []) {
                const d = major.domain || major.domain_id;
                if (d && typeof d === 'string' && !seen.has(d)) {
                    seen.add(d);
                    list.push({ id: d, name: d, color: (major as any).color });
                }
            }
        }
        // major에 domain이 하나도 없으면 mega 이름을 도메인으로 사용 (새 프로세스 시 도메인 선택 가능하도록)
        if (list.length === 0) {
            for (const mega of map.mega_proc_list) {
                const name = mega.name || mega.id;
                if (name && !seen.has(name)) {
                    seen.add(name);
                    list.push({ id: name, name, color: (mega as any).color });
                }
            }
        }
        return list;
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
        const uid = currentUserId.value;

        // Always include favorites when that option is on (from localStorage)
        if (f.favorites) {
            favorites.value.forEach((id) => matchedIds.add(id));
        }

        for (const def of allProcDefs.value) {
            if (f.myCreation && uid && (def.owner === uid || def.created_by === uid)) {
                matchedIds.add(def.id);
            }
            if (f.myOrganization && currentUserOrgIds.value.length > 0) {
                const defOrgs: string[] = def.organizations || def.org_ids || [];
                if (defOrgs.some((oid: string) => currentUserOrgIds.value.includes(oid))) {
                    matchedIds.add(def.id);
                }
            }
        }

        return matchedIds;
    });

    // IDs of processes in public review or review status (Need Feedback quick filter)
    const needFeedbackIds = computed((): Set<string> => {
        const ids = new Set<string>();
        processStatuses.value.forEach((ps, id) => {
            if (ps.status === 'public_review' || ps.status === 'review') {
                ids.add(id);
            }
        });
        return ids;
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
    function passesAdvancedFilters(sub: any): boolean {
        const af = advancedFilters.value;

        // Status filter
        if (af.statuses.length > 0) {
            const ps = processStatuses.value.get(sub.id);
            if (!ps || ps.status === 'none' || !af.statuses.includes(ps.status)) return false;
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
            const role = af.ownerRole;
            let match = false;
            if (role === 'any' || role === 'primary') {
                match = match || af.owners.includes(sub.owner || '');
            }
            if (role === 'any' || role === 'co') {
                const coOwners: string[] = sub.co_owners || [];
                match = match || coOwners.some((o) => af.owners.includes(o));
            }
            if (role === 'any' || role === 'master') {
                match = match || af.owners.includes(sub.master || '');
            }
            if (!match) return false;
        }

        // Tag filter
        if (af.tags.length > 0) {
            const subTags: string[] = sub.tags || [];
            if (!af.tags.some((t) => subTags.includes(t))) return false;
        }

        // FTE range filter (compare sub.fte if set)
        const fteMin = af.fteRange[0];
        const fteMax = af.fteRange[1];
        if (fteMin !== 0 || fteMax !== 10) {
            const fte = typeof sub.fte === 'number' ? sub.fte : null;
            // If no FTE data and filter is non-default, skip (don't filter out)
            if (fte !== null && (fte < fteMin || fte > fteMax)) return false;
        }

        // Lead-time range filter (compare sub.lead_time if set, in days)
        const ltMin = af.leadTimeRange[0];
        const ltMax = af.leadTimeRange[1];
        if (ltMin !== 0 || ltMax !== 365) {
            const leadTime = typeof sub.lead_time === 'number' ? sub.lead_time : null;
            if (leadTime !== null && (leadTime < ltMin || leadTime > ltMax)) return false;
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
            af.tags.length > 0 ||
            af.fteRange[0] !== 0 ||
            af.fteRange[1] !== 10 ||
            af.leadTimeRange[0] !== 0 ||
            af.leadTimeRange[1] !== 365 ||
            af.systems.length > 0;

        const hasFilter = query || domainFilterSet.size > 0 || myIds || needFeedback || wil || hasAdvanced;
        if (!hasFilter) return map;

        const filtered = {
            ...map,
            mega_proc_list: map.mega_proc_list
                .map((mega: any) => {
                    const filteredMajors = (mega.major_proc_list || [])
                        .map((major: any) => {
                            if (domainFilterSet.size > 0) {
                                const majorDomain = major.domain || major.domain_id || '';
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

                    if (filteredMajors.length === 0) return null;

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
        const map = procMap.value;
        let total = 0;
        let subTotal = 0;

        if (map && map.mega_proc_list) {
            for (const mega of map.mega_proc_list) {
                for (const major of mega.major_proc_list || []) {
                    total++;
                    subTotal += (major.sub_proc_list || []).length;
                }
            }
        }

        let published = 0;
        let review = 0;
        let draft = 0;
        processStatuses.value.forEach((ps) => {
            if (ps.status === 'published') published++;
            else if (ps.status === 'review') review++;
            else if (ps.status === 'draft') draft++;
        });

        return { total, subTotal, published, review, draft };
    });

    function getProcessStatus(subId: string): ProcessStatus | undefined {
        return processStatuses.value.get(subId);
    }

    function navigateToProcess(subId: string, subName?: string) {
        const name = subName || subId;
        addToRecentlyViewed(subId, name);
        router.push({ name: 'Process Hierarchy', query: { id: subId, name } });
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
        quickFilterNeedFeedback.value = f.quickFilterNeedFeedback || false;
        quickFilterWIL.value = f.quickFilterWIL || false;
        showToBe.value = f.showToBe || false;
        myProcessFilter.value = f.myProcessFilter || { enabled: false, favorites: false, myCreation: false, myOrganization: false };
        if (f.advancedFilters) {
            advancedFilters.value = JSON.parse(JSON.stringify(f.advancedFilters));
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

    async function loadCurrentUserOrgs() {
        try {
            currentUserId.value = (window as any).$user?.id || '';
            const { getCurrentUserOrganizations } = await import('@/utils/organizationUtils');
            currentUserOrgIds.value = await getCurrentUserOrganizations();
        } catch (e) {
            console.warn('[useProcessArchitecture] Failed to load user org info:', e);
        }
    }

    async function saveProcMap(newMap: any): Promise<void> {
        try {
            await backend.putProcessDefinitionMap(newMap);
            procMap.value = newMap;
        } catch (e) {
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
        saveMetricsMap
    };
}
