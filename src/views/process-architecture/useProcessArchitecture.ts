import { ref, computed, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';
export { generateProcessId, collectAllProcessIds, isPidInUse } from './processIdUtils';

export type ViewMode = 'card' | 'matrix' | 'tree' | 'hierarchy';

export interface ProcessStatus {
    status: 'draft' | 'review' | 'published' | 'public_review' | 'wip' | 'sunset';
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

const RECENTLY_VIEWED_KEY = 'process_recently_viewed';
const FAVORITES_KEY = 'process_favorites';
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
    const advancedFilters: Ref<{
        statuses: string[];
        dateMode: 'none' | 'relative' | 'absolute';
        relativeDays: number | null;
        dateFrom: string;
        dateTo: string;
        owners: string[];
        ownerRole: 'any' | 'primary' | 'co' | 'master';
        tags: string[];
        fteRange: [number, number];
        leadTimeRange: [number, number];
        systems: string[];
    }> = ref({
        statuses: [],
        dateMode: 'none',
        relativeDays: 30,
        dateFrom: '',
        dateTo: '',
        owners: [],
        ownerRole: 'any',
        tags: [],
        fteRange: [0, 10],
        leadTimeRange: [0, 365],
        systems: []
    });

    async function loadData() {
        loading.value = true;
        try {
            const [pm, mm] = await Promise.all([
                backend.getProcessDefinitionMap(),
                backend.getMetricsMap()
            ]);
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
            const defs = await backend.listDefinition('', { match: { isdeleted: false } });
            if (!defs) return;
            allProcDefs.value = defs;

            // proc_def_approval_state 테이블에서 각 프로세스의 최신 승인 상태를 일괄 조회
            const approvalStateMap = new Map<string, any>();
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
            }

            // proc_def 테이블의 approval_state 컬럼도 체크 (WIP 등 직접 설정된 상태)
            const statusMap = new Map<string, ProcessStatus>();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const def of defs) {
                let status: 'draft' | 'review' | 'published' | 'public_review' | 'wip' | 'sunset' = 'draft';

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

    const domains = computed(() => {
        return metricsMap.value?.domains || [];
    });

    // Compute the set of process IDs that match My Processes filter (OR logic)
    const myProcessIds = computed((): Set<string> | null => {
        const f = myProcessFilter.value;
        if (!f.enabled) return null;

        const matchedIds = new Set<string>();
        const uid = currentUserId.value;

        // Always include favorites when that option is on (from localStorage)
        if (f.favorites) {
            favorites.value.forEach(id => matchedIds.add(id));
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
            if (!ps || !af.statuses.includes(ps.status)) return false;
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
                match = match || coOwners.some(o => af.owners.includes(o));
            }
            if (role === 'any' || role === 'master') {
                match = match || af.owners.includes(sub.master || '');
            }
            if (!match) return false;
        }

        // Tag filter
        if (af.tags.length > 0) {
            const subTags: string[] = sub.tags || [];
            if (!af.tags.some(t => subTags.includes(t))) return false;
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
        const domain = selectedDomain.value;
        const multiDomains = selectedDomains.value;
        const myIds = myProcessIds.value;
        const needFeedback = quickFilterNeedFeedback.value;
        const wil = quickFilterWIL.value;
        const af = advancedFilters.value;
        const hasAdvanced = af.statuses.length > 0 || af.dateMode !== 'none' ||
            af.owners.length > 0 || af.tags.length > 0 ||
            af.fteRange[0] !== 0 || af.fteRange[1] !== 10 ||
            af.leadTimeRange[0] !== 0 || af.leadTimeRange[1] !== 365 ||
            af.systems.length > 0;

        const hasFilter = query || domain || multiDomains.length > 0 || myIds || needFeedback || wil || hasAdvanced;
        if (!hasFilter) return map;

        const filtered = {
            ...map,
            mega_proc_list: map.mega_proc_list
                .map((mega: any) => {
                    const filteredMajors = (mega.major_proc_list || [])
                        .map((major: any) => {
                            // Single domain filter (legacy support)
                            if (domain) {
                                const majorDomain = major.domain || major.domain_id;
                                if (majorDomain && majorDomain !== domain) return null;
                            }
                            // Multi-select domain filter
                            if (multiDomains.length > 0) {
                                const majorDomain = major.domain || major.domain_id || '';
                                if (!multiDomains.includes(majorDomain)) return null;
                            }

                            const filteredSubs = (major.sub_proc_list || []).filter((sub: any) => {
                                if (myIds && !myIds.has(sub.id)) return false;
                                if (needFeedback && !needFeedbackIds.value.has(sub.id)) return false;
                                if (wil && !wilIds.value.has(sub.id)) return false;
                                if (hasAdvanced && !passesAdvancedFilters(sub)) return false;
                                if (!query) return true;
                                return sub.name?.toLowerCase().includes(query) ||
                                    sub.id?.toLowerCase().includes(query);
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

        const domain = selectedDomain.value;
        const query = debouncedSearchQuery.value.toLowerCase().trim();

        let filteredDomains = mm.domains || [];
        let filteredProcesses = mm.processes || [];

        if (domain) {
            const domainObj = filteredDomains.find((d: any) => d.name === domain);
            if (domainObj) {
                filteredDomains = [domainObj];
                filteredProcesses = filteredProcesses.filter((p: any) => p.domain_id === domainObj.id);
            }
        }

        if (query) {
            filteredProcesses = filteredProcesses.filter((p: any) =>
                p.name?.toLowerCase().includes(query)
            );
        }

        if (myProcessIds.value) {
            filteredProcesses = filteredProcesses.filter((p: any) => myProcessIds.value!.has(p.id));
        }

        return {
            ...mm,
            domains: filteredDomains,
            processes: filteredProcesses
        };
    });

    const stats = computed(() => {
        const map = procMap.value;
        let total = 0;
        let subTotal = 0;

        if (map && map.mega_proc_list) {
            for (const mega of map.mega_proc_list) {
                for (const major of (mega.major_proc_list || [])) {
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
            else draft++;
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

    function addToRecentlyViewed(id: string, name: string) {
        const existing = recentlyViewed.value.filter(item => item.id !== id);
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
        advancedFilters
    };
}
