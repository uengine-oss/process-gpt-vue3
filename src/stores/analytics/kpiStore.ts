/**
 * KPI Store
 * KPI 달성률 및 프로세스 파이프라인 데이터 관리
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import BackendFactory from '@/components/api/BackendFactory'

const backend = BackendFactory.createBackend() as any

export interface KpiSummary {
    total_processes: number
    draft_count: number
    review_count: number
    published_count: number
    rejected_count: number
}

export interface DomainProgress {
    domain_id: string
    domain_name?: string
    domain_color?: string
    total_processes: number
    published_count: number
    draft_count: number
    review_count: number
    target?: number
}

export interface WeeklyVelocity {
    week_start: string
    deployments: number
}

export interface KpiTarget {
    id?: string
    period_type: string
    period_start: string
    period_end: string
    total_target: number
    domain_targets: Array<{ domain_id: string; domain_name: string; target: number }>
    org_targets: any[]
}

export const useKpiStore = defineStore('kpi', () => {
    // ============== State ==============
    const pipeline = ref<KpiSummary | null>(null)
    const domainProgress = ref<DomainProgress[]>([])
    const weeklyVelocity = ref<WeeklyVelocity[]>([])
    const currentTarget = ref<KpiTarget | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // ============== Filters ==============
    const selectedDomainId = ref<string>('all')
    const selectedOrgId = ref<string>('all')
    const selectedPeriod = ref<string>('3months')

    // ============== Computed ==============
    const achievementRate = computed(() => {
        if (!currentTarget.value || !pipeline.value) return 0
        const target = currentTarget.value.total_target
        if (target <= 0) return 0
        return Math.round((pipeline.value.published_count / target) * 100)
    })

    const isAtRisk = computed(() => achievementRate.value < 50)

    const avgWeeklyDeployment = computed(() => {
        if (weeklyVelocity.value.length === 0) return 0
        const total = weeklyVelocity.value.reduce((sum, w) => sum + w.deployments, 0)
        return Math.round((total / weeklyVelocity.value.length) * 10) / 10
    })

    // ============== Actions ==============
    async function fetchAll() {
        loading.value = true
        error.value = null
        try {
            // fetchTarget 먼저 (domainProgress에서 domain_targets 참조)
            await Promise.all([
                fetchPipeline(),
                fetchWeeklyVelocity(),
                fetchTarget()
            ])
            // fetchTarget 완료 후 domainProgress 호출 (target 매핑 필요)
            await fetchDomainProgress()
        } catch (e: any) {
            error.value = e.message || 'Failed to fetch KPI data'
            console.error('KPI fetchAll error:', e)
        } finally {
            loading.value = false
        }
    }

    async function fetchPipeline() {
        try {
            pipeline.value = await backend.getKpiPipelineSummary()
        } catch (e) {
            console.error('fetchPipeline error:', e)
        }
    }

    async function fetchDomainProgress() {
        try {
            const data = await backend.getKpiDomainProgress()
            // metricsMap에서 도메인 이름/색상 매핑
            let metricsMap: any = null
            try {
                metricsMap = await backend.getMetricsMap()
            } catch (e) {
                console.warn('getMetricsMap failed, using defaults:', e)
            }
            const domains = metricsMap?.domains || []

            // kpi_targets에서 도메인별 목표 가져오기
            const domainTargets = currentTarget.value?.domain_targets || []

            domainProgress.value = (data || []).map((d: any) => {
                const domain = domains.find((dm: any) => dm.id === d.domain_id)
                const targetEntry = domainTargets.find((dt: any) => dt.domain_id === d.domain_id)
                return {
                    ...d,
                    domain_name: domain?.name || d.domain_id || 'Unknown',
                    domain_color: domain?.color || '#0085db',
                    target: targetEntry?.target || 0
                }
            })
        } catch (e) {
            console.error('fetchDomainProgress error:', e)
        }
    }

    async function fetchWeeklyVelocity(weeks = 10) {
        try {
            weeklyVelocity.value = await backend.getKpiWeeklyVelocity(weeks)
        } catch (e) {
            console.error('fetchWeeklyVelocity error:', e)
        }
    }

    async function fetchTarget() {
        try {
            const targets = await backend.getKpiTargets()
            currentTarget.value = targets?.[0] || null
        } catch (e) {
            console.error('fetchTarget error:', e)
        }
    }

    async function upsertTarget(data: KpiTarget) {
        try {
            await backend.upsertKpiTarget(data)
            await fetchTarget()
        } catch (e) {
            console.error('upsertTarget error:', e)
            throw e
        }
    }

    return {
        // State
        pipeline,
        domainProgress,
        weeklyVelocity,
        currentTarget,
        loading,
        error,
        // Filters
        selectedDomainId,
        selectedOrgId,
        selectedPeriod,
        // Computed
        achievementRate,
        isAtRisk,
        avgWeeklyDeployment,
        // Actions
        fetchAll,
        fetchPipeline,
        fetchDomainProgress,
        fetchWeeklyVelocity,
        fetchTarget,
        upsertTarget,
    }
})
