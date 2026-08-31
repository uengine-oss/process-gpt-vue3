/**
 * Analysis Dashboard Store
 * Tab B: Operational Board 데이터 전용 store
 * pi-system-backend /operational-board API 기반
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import BackendFactory from '@/components/api/BackendFactory';

const API_BASE = '/pi-system-backend/operational-board';

// ============== Types (API Spec) ==============

export interface BottleneckItem {
    rank: number;
    proc_def_id: string;
    proc_def_name: string | null;
    domain: string;
    total_fte: number;
    task_count: number;
    owner_department: string;
    oss_count: number;
    tenant_id: string;
}

export interface RoleInfo {
    role: string | null;
    default: string | null;
    endpoint: string | null;
}

export interface ZombieProcess {
    proc_def_id: string;
    proc_def_name: string | null;
    domain: string;
    current_status: 'draft' | 'in-review';
    owner_roles: RoleInfo[];
    last_modified_at: string | null;
    days_since_update: number | null;
    tenant_id: string;
}

export interface DelayedReview {
    proc_def_id: string;
    proc_def_name: string | null;
    domain: string;
    from_state: string | null;
    current_status: string;
    action: string | null;
    actor_name: string | null;
    submitted_at: string;
    days_delayed: number;
    tenant_id: string;
}

export interface PendingReopen {
    proc_def_id: string;
    proc_def_name: string | null;
    domain: string;
    from_state: string | null;
    to_state: string | null;
    action: string | null;
    requester_name: string | null;
    requested_at: string;
    days_pending: number;
    tenant_id: string;
}

export interface ActionRequiredSummary {
    delayed_review_count: number;
    pending_reopen_count: number;
}

export interface RequestUpdatePayload {
    proc_def_id: string;
    requester_id?: string;
    requester_name?: string;
    message?: string;
}

export type DateRangePreset = 'quarter' | 'ytd' | 'custom';

export interface CustomDateRange {
    from: string; // YYYY-MM-DD
    to: string;   // YYYY-MM-DD
}

export interface AnalysisDashboardFilters {
    domains: string[];
    orgCode: string;
    includeSubOrgs: boolean;
    dateRangePreset: DateRangePreset;
    customDateRange: CustomDateRange | null;
    comparisonMode: boolean;
}

export const useAnalysisDashboardStore = defineStore('analysisDashboard', () => {
    const backend = BackendFactory.createBackend();
    // ============== State ==============
    const filters = ref<AnalysisDashboardFilters>({
        domains: [],
        orgCode: '',
        includeSubOrgs: true,
        dateRangePreset: 'quarter',
        customDateRange: null,
        comparisonMode: false
    });

    const domainOptions = ref<string[]>([]);

    async function fetchDomainOptions() {
        try {
            const metricsMap = await backend.getMetricsMap();
            const domains: any[] = Array.isArray(metricsMap?.domains) ? metricsMap.domains : [];
            domainOptions.value = [...new Set(
                domains
                    .map((domain: any) =>
                        typeof domain === 'string'
                            ? domain.trim()
                            : String(domain?.name || domain?.id || '').trim()
                    )
                    .filter(Boolean)
            )];
        } catch (e) {
            console.error('fetchDomainOptions error:', e);
            domainOptions.value = [];
        }
    }

    const bottleneckList = ref<BottleneckItem[]>([]);
    const bottleneckTotalCount = ref(0);
    const zombieProcesses = ref<ZombieProcess[]>([]);
    const zombieTotalCount = ref(0);
    const delayedReviews = ref<DelayedReview[]>([]);
    const pendingReopens = ref<PendingReopen[]>([]);
    const actionSummary = ref<ActionRequiredSummary>({ delayed_review_count: 0, pending_reopen_count: 0 });
    const loading = ref(false);

    // ============== Actions ==============
    function setFilters(nextFilters: Partial<AnalysisDashboardFilters>) {
        filters.value = {
            ...filters.value,
            ...nextFilters,
            domains: Array.isArray(nextFilters.domains) ? nextFilters.domains : filters.value.domains,
            customDateRange: nextFilters.customDateRange !== undefined ? nextFilters.customDateRange : filters.value.customDateRange
        };
    }

    async function fetchBottleneck(limit = 10, sort: string = 'fte_desc') {
        try {
            const { data } = await axios.get(`${API_BASE}/bottleneck`, { params: { limit, sort } });
            bottleneckList.value = data.data || [];
            bottleneckTotalCount.value = data.total_count || 0;
        } catch (e) {
            console.error('fetchBottleneck error:', e);
            bottleneckList.value = [];
            bottleneckTotalCount.value = 0;
        }
    }

    async function fetchZombieProcesses(filter: 'all' | '3month' | '6month' = 'all') {
        try {
            const { data } = await axios.get(`${API_BASE}/zombie-processes`, { params: { filter } });
            zombieProcesses.value = data.data || [];
            zombieTotalCount.value = data.total_count || 0;
        } catch (e) {
            console.error('fetchZombieProcesses error:', e);
            zombieProcesses.value = [];
            zombieTotalCount.value = 0;
        }
    }

    async function fetchActionRequired(userId?: string) {
        try {
            const params: Record<string, string> = {};
            if (userId) params.user_id = userId;
            const { data } = await axios.get(`${API_BASE}/action-required`, { params });
            delayedReviews.value = data.delayed_reviews || [];
            pendingReopens.value = data.pending_reopens || [];
            actionSummary.value = data.summary || { delayed_review_count: 0, pending_reopen_count: 0 };
        } catch (e) {
            console.error('fetchActionRequired error:', e);
            delayedReviews.value = [];
            pendingReopens.value = [];
            actionSummary.value = { delayed_review_count: 0, pending_reopen_count: 0 };
        }
    }

    async function requestUpdate(payload: RequestUpdatePayload): Promise<{ success: boolean; message: string }> {
        try {
            const { data } = await axios.post(`${API_BASE}/request-update`, payload);
            return { success: data.success, message: data.message };
        } catch (e: any) {
            const detail = e?.response?.data?.detail;
            return { success: false, message: typeof detail === 'string' ? detail : '갱신 요청에 실패했습니다.' };
        }
    }

    async function fetchAllTabB() {
        loading.value = true;
        try {
            await Promise.all([fetchBottleneck(), fetchZombieProcesses(), fetchActionRequired()]);
        } finally {
            loading.value = false;
        }
    }

    return {
        filters,
        domainOptions,
        fetchDomainOptions,
        bottleneckList,
        bottleneckTotalCount,
        zombieProcesses,
        zombieTotalCount,
        delayedReviews,
        pendingReopens,
        actionSummary,
        loading,
        setFilters,
        fetchBottleneck,
        fetchZombieProcesses,
        fetchActionRequired,
        requestUpdate,
        fetchAllTabB
    };
});
