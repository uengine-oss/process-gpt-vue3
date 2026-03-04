/**
 * Analysis Dashboard Store
 * Tab B/C 데이터 전용 store
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import BackendFactory from '@/components/api/BackendFactory'

const backend = BackendFactory.createBackend() as any

export interface ProcessBottleneck {
    rank: number
    id: string
    name: string
    total_fte: number
    owner: string
    oss_count: number
}

export interface StaleProcess {
    id: string
    name: string
    owner: string
    last_modified: string
    status: string
    days_since_update: number
}

export interface ActionItem {
    id: string
    name: string
    type: string // 'delayed_review' | 'reopen'
    days_overdue: number
    assignee: string
}

export interface InReviewProcess {
    id: string
    name: string
    submitter: string
    days_in_review: number
    domain_id: string
}

export const useAnalysisDashboardStore = defineStore('analysisDashboard', () => {
    // ============== State ==============
    const filters = ref({
        domains: [] as string[],
        orgId: 'all',
        dateRange: 'quarter',
        comparisonMode: false
    })

    const bottleneckList = ref<ProcessBottleneck[]>([])
    const staleProcesses = ref<StaleProcess[]>([])
    const actionRequired = ref<ActionItem[]>([])
    const inReviewByDomain = ref<Record<string, InReviewProcess[]>>({})
    const nodeTypeStats = ref<any[]>([])       // Tab C: 프로세스별 노드 유형 통계
    const domainFteSummary = ref<any[]>([])     // Tab C: 도메인별 FTE 집계
    const loading = ref(false)

    // ============== Actions ==============
    async function fetchBottleneckTop10() {
        try {
            bottleneckList.value = await backend.getBottleneckTop10(filters.value)
        } catch (e) {
            console.error('fetchBottleneckTop10 error:', e)
            bottleneckList.value = []
        }
    }

    async function fetchStaleProcesses(daysSince: number = 90) {
        try {
            staleProcesses.value = await backend.getStaleProcesses(daysSince)
        } catch (e) {
            console.error('fetchStaleProcesses error:', e)
            staleProcesses.value = []
        }
    }

    async function fetchActionRequired() {
        try {
            actionRequired.value = await backend.getActionRequiredItems()
        } catch (e) {
            console.error('fetchActionRequired error:', e)
            actionRequired.value = []
        }
    }

    async function fetchInReviewProcesses(domainId?: string) {
        try {
            const items = await backend.getInReviewProcesses(domainId)
            if (domainId) {
                inReviewByDomain.value[domainId] = items
            } else {
                // Group by domain_id
                const grouped: Record<string, InReviewProcess[]> = {}
                for (const item of items) {
                    const did = item.domain_id || 'unknown'
                    if (!grouped[did]) grouped[did] = []
                    grouped[did].push(item)
                }
                inReviewByDomain.value = grouped
            }
        } catch (e) {
            console.error('fetchInReviewProcesses error:', e)
        }
    }

    async function fetchNodeTypeStats(domainId?: string) {
        try {
            nodeTypeStats.value = await backend.getNodeTypeStats(domainId)
        } catch (e) {
            console.error('fetchNodeTypeStats error:', e)
            nodeTypeStats.value = []
        }
    }

    async function fetchDomainFteSummary() {
        try {
            domainFteSummary.value = await backend.getDomainFteSummary()
        } catch (e) {
            console.error('fetchDomainFteSummary error:', e)
            domainFteSummary.value = []
        }
    }

    async function fetchAllTabB() {
        loading.value = true
        try {
            await Promise.all([
                fetchBottleneckTop10(),
                fetchStaleProcesses(90),
                fetchActionRequired()
            ])
        } finally {
            loading.value = false
        }
    }

    async function fetchAllTabC() {
        loading.value = true
        try {
            await Promise.all([
                fetchNodeTypeStats(),
                fetchDomainFteSummary(),
            ])
        } finally {
            loading.value = false
        }
    }

    return {
        filters,
        bottleneckList,
        staleProcesses,
        actionRequired,
        inReviewByDomain,
        nodeTypeStats,
        domainFteSummary,
        loading,
        fetchBottleneckTop10,
        fetchStaleProcesses,
        fetchActionRequired,
        fetchInReviewProcesses,
        fetchNodeTypeStats,
        fetchDomainFteSummary,
        fetchAllTabB,
        fetchAllTabC,
    }
})
