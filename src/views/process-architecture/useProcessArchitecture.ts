import { ref, computed, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import BackendFactory from '@/components/api/BackendFactory';

export type ViewMode = 'card' | 'tree' | 'matrix' | 'hierarchy';

export interface ProcessStatus {
    status: 'draft' | 'review' | 'published';
    version?: string;
}

export function useProcessArchitecture() {
    const router = useRouter();
    const backend = BackendFactory.createBackend() as any;

    const procMap: Ref<any> = ref({ mega_proc_list: [] });
    const metricsMap: Ref<any> = ref({ domains: [], mega_processes: [], processes: [] });
    const loading = ref(false);
    const searchQuery = ref('');
    const selectedDomain: Ref<string | null> = ref(null);
    const activeView: Ref<ViewMode> = ref('card');
    const processStatuses: Ref<Map<string, ProcessStatus>> = ref(new Map());
    const allProcDefs: Ref<any[]> = ref([]);

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
            const statusMap = new Map<string, ProcessStatus>();
            for (const def of defs) {
                let status: 'draft' | 'review' | 'published' = 'draft';
                if (def.version_tag === 'major' || def.version_tag === 'published') {
                    status = 'published';
                } else if (def.version_tag === 'review') {
                    status = 'review';
                }
                statusMap.set(def.id, {
                    status,
                    version: def.version || undefined
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

    const filteredProcMap = computed(() => {
        const map = procMap.value;
        if (!map || !map.mega_proc_list) return { mega_proc_list: [] };

        const query = searchQuery.value.toLowerCase().trim();
        const domain = selectedDomain.value;

        if (!query && !domain) return map;

        const filtered = {
            ...map,
            mega_proc_list: map.mega_proc_list
                .map((mega: any) => {
                    const filteredMajors = (mega.major_proc_list || [])
                        .map((major: any) => {
                            // Domain filter: check if major has domain matching
                            if (domain) {
                                const majorDomain = major.domain || major.domain_id;
                                if (majorDomain && majorDomain !== domain) return null;
                            }

                            const filteredSubs = (major.sub_proc_list || []).filter((sub: any) => {
                                if (!query) return true;
                                return sub.name?.toLowerCase().includes(query) ||
                                    sub.id?.toLowerCase().includes(query);
                            });

                            if (query && filteredSubs.length === 0 && !major.name?.toLowerCase().includes(query)) {
                                return null;
                            }

                            return {
                                ...major,
                                sub_proc_list: query ? filteredSubs : major.sub_proc_list
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
        const query = searchQuery.value.toLowerCase().trim();

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
        const url = `/definitions/chat?id=${subId}&name=${encodeURIComponent(name)}&modeling=true`;
        window.open(url, '_blank');
    }

    function getDomainColor(domainName: string): string {
        const d = domains.value.find((d: any) => d.name === domainName);
        return d?.color || '#607D8B';
    }

    return {
        procMap,
        metricsMap,
        loading,
        searchQuery,
        selectedDomain,
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
        getDomainColor
    };
}
