/**
 * OLAP Store
 * 대시보드 및 분석 데이터 상태 관리
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { olapApi, type DashboardSummary, type PerformanceData } from '@/services/analyticsApi'

export const useOlapStore = defineStore('olap', () => {
  // ============== State ==============
  const dashboardSummary = ref<DashboardSummary | null>(null)
  const performanceData = ref<PerformanceData[]>([])
  const processes = ref<any[]>([])
  const users = ref<any[]>([])
  const activities = ref<any[]>([])
  const dateRange = ref<{ start: string; end: string } | null>(null)
  const instances = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============== Actions ==============

  /**
   * 대시보드 요약 데이터 조회
   */
  async function fetchDashboardSummary() {
    loading.value = true
    error.value = null
    try {
      dashboardSummary.value = await olapApi.getDashboardSummary()
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch dashboard summary'
      console.error('Failed to fetch dashboard summary:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 퍼포먼스 데이터 조회
   */
  async function fetchPerformance(params: { year?: number; quarter?: number } = {}) {
    loading.value = true
    error.value = null
    try {
      const result = await olapApi.getPerformance(params)
      performanceData.value = result.data || result || []
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch performance data'
      console.error('Failed to fetch performance data:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 차원 데이터 일괄 조회
   */
  async function fetchDimensions() {
    loading.value = true
    error.value = null
    try {
      const [procRes, userRes, actRes, dateRes] = await Promise.all([
        olapApi.getProcesses(),
        olapApi.getUsers(),
        olapApi.getActivities(),
        olapApi.getDateRange()
      ])
      processes.value = procRes.processes || []
      users.value = userRes.users || []
      activities.value = actRes.activities || []
      dateRange.value = dateRes.date_range || null
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch dimensions'
      console.error('Failed to fetch dimensions:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 프로세스 인스턴스 조회
   */
  async function fetchInstances(params: { limit?: number; offset?: number } = {}) {
    loading.value = true
    error.value = null
    try {
      const result = await olapApi.getInstances(params)
      instances.value = result.instances || []
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch instances'
      console.error('Failed to fetch instances:', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 에러 초기화
   */
  function clearError() {
    error.value = null
  }

  /**
   * 상태 초기화
   */
  function reset() {
    dashboardSummary.value = null
    performanceData.value = []
    processes.value = []
    users.value = []
    activities.value = []
    dateRange.value = null
    instances.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    dashboardSummary,
    performanceData,
    processes,
    users,
    activities,
    dateRange,
    instances,
    loading,
    error,
    // Actions
    fetchDashboardSummary,
    fetchPerformance,
    fetchDimensions,
    fetchInstances,
    clearError,
    reset
  }
})
