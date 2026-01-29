<script setup lang="ts">
/**
 * Bottleneck Analysis
 * Camunda Optimize 스타일의 프로세스 병목 분석
 */
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import BackendFactory from '@/components/api/BackendFactory'
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue'
import { olapApi } from '@/services/analyticsApi'
import dayjs from 'dayjs'

const backend = BackendFactory.createBackend() as any  // FTE API 포함

// State
const loading = ref(false)
const loadingMetrics = ref(false)
const processList = ref<any[]>([])
const selectedProcess = ref<string | null>(null)
const selectedProcessName = ref('')
const bpmnXml = ref<string | null>(null)
const bpmnViewerRef = ref<InstanceType<typeof BpmnUengineViewer> | null>(null)
const bpmnKey = ref(0)
const showMetricInfo = ref(false)

// Filters
const periodOptions = [
  { title: '최근 7일', value: 7 },
  { title: '최근 30일', value: 30 },
  { title: '최근 90일', value: 90 },
  { title: '전체', value: 0 }
]
const selectedPeriod = ref(30)
const statusOptions = [
  { title: '전체', value: 'all' },
  { title: '완료', value: 'COMPLETED' },
  { title: '진행중', value: 'STARTED' }
]
const selectedStatus = ref('all')

// Metrics with descriptions (Camunda Optimize style)
// Reference: https://docs.camunda.io/docs/components/optimize/userguide/process-analysis/user-task-analytics/
const metricDefinitions = {
  duration: {
    title: 'Total Duration',
    subtitle: '총 소요시간',
    icon: 'mdi-timer-outline',
    color: 'primary',
    description: 'Task가 시작된 시점부터 완료될 때까지의 전체 시간입니다. Idle Time(대기)과 Work Time(작업)을 모두 포함합니다.',
    formula: 'AVG(end_time - start_time)',
    formulaDesc: 'Camunda: Task 생성부터 완료까지의 평균 시간',
    unit: '시간',
    camundaRef: 'Total Duration = Idle Duration + Work Duration'
  },
  frequency: {
    title: 'Flow Node Count',
    subtitle: '실행 횟수',
    icon: 'mdi-chart-bar',
    color: 'info',
    description: '해당 Flow Node(Activity)를 통과한 토큰(Token)의 수입니다. 프로세스에서 가장 많이 실행되는 경로를 파악할 수 있습니다.',
    formula: 'COUNT(flow_node_instances)',
    formulaDesc: 'Camunda: 해당 노드를 통과한 인스턴스 수',
    unit: '회',
    camundaRef: 'Flow Node Executions'
  },
  bottleneck: {
    title: 'Outlier Score',
    subtitle: '이상치 점수 (Z-Score)',
    icon: 'mdi-alert-decagram-outline',
    color: 'error',
    description: '평균보다 현저히 오래 걸린 인스턴스가 많은 노드를 식별합니다. Z-Score 기반으로 이상치를 탐지하여 병목 지점을 찾습니다.',
    formula: 'Z = (X - μ) / σ',
    formulaDesc: 'Camunda: (실제값 - 평균) ÷ 표준편차',
    unit: 'σ',
    camundaRef: 'Heatmap displays incidence of higher outliers based on z-score'
  },
  rework: {
    title: 'Rework Rate',
    subtitle: '재작업률',
    icon: 'mdi-refresh',
    color: 'warning',
    description: '동일 프로세스 인스턴스에서 해당 Activity가 2회 이상 실행된 비율입니다. 루프나 에러로 인한 재실행을 감지합니다.',
    formula: '(Loops / Total) × 100',
    formulaDesc: '(재실행 인스턴스 수 ÷ 전체 인스턴스 수) × 100',
    unit: '%',
    camundaRef: 'Loop detection in process flow'
  },
  waiting: {
    title: 'Idle Duration',
    subtitle: '대기 시간 (Unassigned)',
    icon: 'mdi-clock-alert-outline',
    color: 'secondary',
    description: 'Task가 생성된 후 담당자에게 할당(Claim)되기까지의 대기 시간입니다. 긴 Idle Time은 리소스 부족이나 워크로드 불균형을 나타냅니다.',
    formula: 'SUM(unassigned_periods)',
    formulaDesc: 'Camunda: 미할당 상태였던 모든 기간의 합계',
    unit: '시간',
    camundaRef: 'Idle Duration = Total Duration - Work Duration'
  },
  // FTE Heatmap Metrics
  workloadFte: {
    title: 'Workload FTE',
    subtitle: '업무량 기반 FTE',
    icon: 'mdi-account-hard-hat',
    color: 'indigo',
    description: '선택 기간 동안 해당 Activity를 처리하는 데 필요한 누적 FTE입니다. 실행 횟수와 표준 작업시간을 기반으로 계산됩니다.',
    formula: '(Count × Std_Hours) / Available_Hours',
    formulaDesc: '(실행횟수 × 표준작업시간) ÷ 기간내 가용시간',
    unit: 'FTE',
    camundaRef: 'Effort per Instance 기반 FTE 산정'
  },
  peakFte: {
    title: 'Peak FTE',
    subtitle: '최대 동시 FTE (P95)',
    icon: 'mdi-chart-timeline-variant',
    color: 'deep-purple',
    description: '동시에 실행 중인 인스턴스 수의 95 백분위수입니다. 피크 시간대에 필요한 최대 인력을 나타냅니다.',
    formula: 'P95(concurrent_instances)',
    formulaDesc: '동시 실행 인스턴스 수의 95번째 백분위수',
    unit: 'FTE',
    camundaRef: 'Dynamic Concurrent Usage 기반'
  },
  loadRatio: {
    title: 'Load Ratio',
    subtitle: '부하율 (용량 대비)',
    icon: 'mdi-gauge',
    color: 'deep-orange',
    description: '가용 FTE 대비 실제 필요 FTE의 비율입니다. 100%를 초과하면 인력이 부족한 병목 상태입니다.',
    formula: 'Demand_FTE / Capacity_FTE × 100',
    formulaDesc: '(필요 FTE ÷ 가용 FTE) × 100',
    unit: '%',
    camundaRef: 'Load Ratio > 100% = 병목 (Bottleneck)'
  }
}

const selectedMetric = ref<keyof typeof metricDefinitions>('duration')
const currentMetricDef = computed(() => metricDefinitions[selectedMetric.value])

// Metric select options for dropdown
const metricSelectOptions = computed(() => {
  return Object.entries(metricDefinitions).map(([key, def]) => ({
    value: key,
    title: def.title,
    subtitle: def.subtitle,
    icon: def.icon,
    color: def.color
  }))
})

// Execution data
const executionData = ref<any[]>([])
const activityMetrics = ref<Map<string, any>>(new Map())

// FTE Configuration
const activityConfig = ref<Map<string, any>>(new Map())  // Activity별 표준 작업시간 설정
const fteCapacity = ref<Map<string, any>>(new Map())     // Role별 FTE 용량
const showFteSettings = ref(false)                        // FTE 설정 다이얼로그
const defaultStandardMinutes = ref(30)                    // 기본 표준 작업시간 (분)
const defaultAvailableFte = ref(5)                        // 기본 가용 FTE

// Summary Statistics (supports both ETL and legacy data)
const summaryStats = computed(() => {
  if (!executionData.value || executionData.value.length === 0) {
    return { instances: 0, activities: 0, avgDuration: '-', completionRate: 0, agentTasks: 0, humanTasks: 0 }
  }

  // ETL 데이터 형식 체크 (execution_count 필드가 있으면 ETL 데이터)
  const isEtlData = executionData.value[0]?.execution_count !== undefined

  if (isEtlData) {
    // ETL 데이터: 이미 집계된 데이터
    const totalExecutions = executionData.value.reduce((sum, e) => sum + (e.execution_count || 0), 0)
    const totalErrors = executionData.value.reduce((sum, e) => sum + (e.total_errors || 0), 0)
    const agentTasks = executionData.value.reduce((sum, e) => sum + (e.agent_executions || 0), 0)
    const humanTasks = executionData.value.reduce((sum, e) => sum + (e.human_executions || 0), 0)

    // 가중 평균 소요시간
    const totalWeightedDuration = executionData.value.reduce(
      (sum, e) => sum + ((e.avg_processing_time_sec || 0) * (e.execution_count || 0)), 0
    )
    const avgSeconds = totalExecutions > 0 ? totalWeightedDuration / totalExecutions : 0

    return {
      instances: totalExecutions,
      activities: activityMetrics.value.size,
      avgDuration: formatDuration(avgSeconds),
      completionRate: totalExecutions > 0 ? Math.round(((totalExecutions - totalErrors) / totalExecutions) * 100) : 0,
      agentTasks,
      humanTasks
    }
  } else {
    // Legacy 데이터: 개별 실행 레코드
    const uniqueInstances = new Set(executionData.value.map(e => e.proc_inst_id))
    const completed = executionData.value.filter(e => e.execution_status === 'COMPLETED').length
    const total = executionData.value.length

    const durations = executionData.value
      .filter(e => e.actual_duration)
      .map(e => parseDuration(e.actual_duration))
    const avgSeconds = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0

    return {
      instances: uniqueInstances.size,
      activities: activityMetrics.value.size,
      avgDuration: formatDuration(avgSeconds),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      agentTasks: 0,
      humanTasks: 0
    }
  }
})

// Bottleneck ranking (top 3)
const bottleneckRanking = computed(() => {
  return Array.from(activityMetrics.value.entries())
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => b.normalizedBottleneck - a.normalizedBottleneck)
    .slice(0, 3)
})

// Duration statistics per activity
const durationStats = computed(() => {
  if (activityMetrics.value.size === 0) return null

  const durations = Array.from(activityMetrics.value.values()).map(m => m.avgDuration)
  const sorted = [...durations].sort((a, b) => a - b)

  return {
    min: formatDuration(sorted[0] || 0),
    max: formatDuration(sorted[sorted.length - 1] || 0),
    median: formatDuration(sorted[Math.floor(sorted.length / 2)] || 0),
    avg: formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length || 0)
  }
})

// Parse PostgreSQL interval to seconds
function parseDuration(interval: string | null): number {
  if (!interval) return 0
  let totalSeconds = 0
  const daysMatch = interval.match(/(\d+)\s*days?/)
  if (daysMatch) totalSeconds += parseInt(daysMatch[1]) * 86400
  const timeMatch = interval.match(/(\d{1,2}):(\d{2}):(\d{2})/)
  if (timeMatch) {
    totalSeconds += parseInt(timeMatch[1]) * 3600
    totalSeconds += parseInt(timeMatch[2]) * 60
    totalSeconds += parseInt(timeMatch[3])
  }
  return totalSeconds
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}초`
  if (seconds < 3600) return `${Math.round(seconds / 60)}분`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}시간`
  return `${(seconds / 86400).toFixed(1)}일`
}

// Load process list
async function loadProcessList() {
  try {
    const list = await backend.listDefinition('', { match: { isdeleted: false } })
    processList.value = list || []
  } catch (e) {
    console.error('[BottleneckAnalysis] loadProcessList error:', e)
    processList.value = []
  }
}

// Load BPMN diagram
async function loadBpmnDiagram() {
  if (!selectedProcess.value) return

  loading.value = true
  bpmnXml.value = null
  activityMetrics.value = new Map()
  executionData.value = []

  try {
    const defId = selectedProcess.value.replace('.bpmn', '')
    const rawDef = await backend.getRawDefinition(defId, null)
    selectedProcessName.value = rawDef?.name || defId

    const bpmnData = await backend.getRawDefinition(defId, { type: 'bpmn' })
    if (bpmnData && typeof bpmnData === 'string') {
      bpmnXml.value = bpmnData
      bpmnKey.value++
    } else {
      bpmnXml.value = null
      return
    }

    await nextTick()
    await loadExecutionData()
  } catch (e) {
    console.error('[BottleneckAnalysis] loadBpmnDiagram error:', e)
  } finally {
    loading.value = false
  }
}

// Load FTE Configuration
async function loadFteConfig() {
  if (!selectedProcess.value) return

  const defId = selectedProcess.value.replace('.bpmn', '')

  // Activity별 표준 작업시간 로드
  try {
    const configs = await backend.getActivityConfig(defId)
    const configMap = new Map<string, any>()
    if (Array.isArray(configs)) {
      configs.forEach((c: any) => {
        configMap.set(c.activity_id, {
          standardMinutes: c.standard_minutes || defaultStandardMinutes.value,
          roleName: c.role_name || 'Default',
          complexityFactor: c.complexity_factor || 1.0
        })
      })
    }
    activityConfig.value = configMap
  } catch (e) {
    console.error('[BottleneckAnalysis] loadFteConfig (activity) error:', e)
    activityConfig.value = new Map()
  }

  // Role별 FTE 용량 로드
  try {
    const capacities = await backend.getFteCapacity()
    const capacityMap = new Map<string, any>()
    if (Array.isArray(capacities)) {
      capacities.forEach((c: any) => {
        capacityMap.set(c.role_name, {
          availableFte: c.available_fte || defaultAvailableFte.value,
          hoursPerDay: c.hours_per_day || 8,
          workingDaysPerMonth: c.working_days_per_month || 20,
          monthlyCapacityHours: c.monthly_capacity_hours || (c.available_fte * 8 * 20)
        })
      })
    }
    // Default 역할이 없으면 추가
    if (!capacityMap.has('Default')) {
      capacityMap.set('Default', {
        availableFte: defaultAvailableFte.value,
        hoursPerDay: 8,
        workingDaysPerMonth: 20,
        monthlyCapacityHours: defaultAvailableFte.value * 8 * 20
      })
    }
    fteCapacity.value = capacityMap
  } catch (e) {
    console.error('[BottleneckAnalysis] loadFteConfig (capacity) error:', e)
    fteCapacity.value = new Map([['Default', {
      availableFte: defaultAvailableFte.value,
      hoursPerDay: 8,
      workingDaysPerMonth: 20,
      monthlyCapacityHours: defaultAvailableFte.value * 8 * 20
    }]])
  }
}

// Load execution data from ETL (dw.fact_task)
async function loadExecutionData() {
  if (!selectedProcess.value) return

  loadingMetrics.value = true
  try {
    const defId = selectedProcess.value.replace('.bpmn', '')

    // FTE 설정 로드
    await loadFteConfig()

    // ETL 데이터에서 병목 분석 데이터 조회
    const params: any = {
      proc_def_id: defId  // 프로세스 정의 ID로 서버에서 필터링
    }

    let data: any[] = []
    try {
      const result = await olapApi.getBottleneckAnalysis(params)
      data = Array.isArray(result) ? result : []
    } catch (err) {
      console.error('[BottleneckAnalysis] olapApi.getBottleneckAnalysis error:', err)
      data = []
    }

    executionData.value = data
    calculateActivityMetricsFromETL()
    setTimeout(() => applyHeatmapOverlay(), 800)
  } catch (e) {
    console.error('[BottleneckAnalysis] loadExecutionData error:', e)
    executionData.value = []
  } finally {
    loadingMetrics.value = false
  }
}

// Calculate metrics from ETL data (pre-aggregated)
function calculateActivityMetricsFromETL() {
  const metricsMap = new Map<string, any>()
  if (!executionData.value || executionData.value.length === 0) {
    activityMetrics.value = metricsMap
    return
  }

  // 기간 내 가용 시간 계산 (시간 단위)
  const periodDays = selectedPeriod.value > 0 ? selectedPeriod.value : 30
  const availableHoursInPeriod = periodDays * 8 // 일 8시간 기준

  // ETL 데이터는 이미 Activity별로 집계되어 있음
  executionData.value.forEach((item: any) => {
    const activityId = item.activity_id
    const frequency = item.execution_count || 0
    const avgDuration = item.avg_processing_time_sec || 0  // 이미 초 단위
    const waitingTime = item.avg_wait_time_sec || 0

    // 오류율 기반 rework 추정
    const errorRate = item.error_rate_pct || 0
    const reworkRate = errorRate  // 오류율을 재작업률로 사용

    // 병목 점수 계산
    const bottleneckScore = frequency * avgDuration

    // FTE 계산
    const config = activityConfig.value.get(activityId) || {
      standardMinutes: defaultStandardMinutes.value,
      roleName: 'Default',
      complexityFactor: 1.0
    }
    const capacity = fteCapacity.value.get(config.roleName) || fteCapacity.value.get('Default') || {
      availableFte: defaultAvailableFte.value,
      hoursPerDay: 8
    }

    // Workload FTE = (실행횟수 × 표준작업시간(분)) / (가용시간(분))
    const standardMinutes = config.standardMinutes * config.complexityFactor
    const totalWorkMinutes = frequency * standardMinutes
    const workloadFte = totalWorkMinutes / (availableHoursInPeriod * 60)

    // Peak FTE 추정 (ETL에서는 동시 실행 정보 없음, 평균 기반 추정)
    const peakFte = Math.ceil(workloadFte * 1.5)  // 평균의 1.5배로 추정

    // Load Ratio = 필요 FTE / 가용 FTE × 100
    const loadRatio = (workloadFte / capacity.availableFte) * 100

    // 완료율 계산 (총 오류 대비)
    const totalErrors = item.total_errors || 0
    const completionRate = frequency > 0 ? ((frequency - totalErrors) / frequency) * 100 : 0

    metricsMap.set(activityId, {
      activityName: item.activity_name || activityId,
      frequency,
      avgDuration,
      maxDuration: avgDuration * 2,  // 추정치 (ETL에는 max가 없음)
      minDuration: avgDuration * 0.5,  // 추정치
      reworkRate,
      bottleneckScore,
      completionRate,
      waitingTime,
      // Agent vs Human 정보
      agentExecutions: item.agent_executions || 0,
      humanExecutions: item.human_executions || 0,
      totalErrors,
      // FTE 지표
      standardMinutes,
      totalWorkMinutes,
      workloadFte,
      peakFte,
      loadRatio,
      roleName: config.roleName,
      capacityFte: capacity.availableFte
    })
  })

  // 정규화된 병목 점수 계산
  const maxBottleneck = Math.max(...Array.from(metricsMap.values()).map(m => m.bottleneckScore), 1)
  metricsMap.forEach(m => {
    m.normalizedBottleneck = (m.bottleneckScore / maxBottleneck) * 100
  })

  activityMetrics.value = metricsMap
}

// Calculate metrics (legacy - for task_execution_properties)
function calculateActivityMetrics() {
  const metricsMap = new Map<string, any>()
  if (!executionData.value || executionData.value.length === 0) {
    activityMetrics.value = metricsMap
    return
  }

  const activityGroups = new Map<string, any[]>()
  executionData.value.forEach(item => {
    const actId = item.activity_id
    if (!activityGroups.has(actId)) activityGroups.set(actId, [])
    activityGroups.get(actId)!.push(item)
  })

  // 기간 내 가용 시간 계산 (시간 단위)
  const periodDays = selectedPeriod.value > 0 ? selectedPeriod.value : 30
  const availableHoursInPeriod = periodDays * 8 // 일 8시간 기준

  activityGroups.forEach((items, activityId) => {
    const frequency = items.length
    const durations = items.filter(i => i.actual_duration).map(i => parseDuration(i.actual_duration))
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0

    const uniqueInstances = new Set(items.map(i => i.proc_inst_id))
    const reworkRate = uniqueInstances.size < items.length
      ? ((items.length - uniqueInstances.size) / items.length) * 100
      : 0

    const bottleneckScore = frequency * avgDuration
    const completed = items.filter(i => i.execution_status === 'COMPLETED').length

    // FTE 계산
    const config = activityConfig.value.get(activityId) || {
      standardMinutes: defaultStandardMinutes.value,
      roleName: 'Default',
      complexityFactor: 1.0
    }
    const capacity = fteCapacity.value.get(config.roleName) || fteCapacity.value.get('Default') || {
      availableFte: defaultAvailableFte.value,
      hoursPerDay: 8
    }

    // Workload FTE = (실행횟수 × 표준작업시간(분)) / (가용시간(분))
    const standardMinutes = config.standardMinutes * config.complexityFactor
    const totalWorkMinutes = frequency * standardMinutes
    const workloadFte = totalWorkMinutes / (availableHoursInPeriod * 60)

    // Peak FTE 계산 (동시 실행 기반 - 간소화)
    // 실제로는 시간대별 동시 실행 수를 계산해야 하지만, 여기서는 추정치 사용
    const peakFte = calculatePeakFte(items, standardMinutes)

    // Load Ratio = 필요 FTE / 가용 FTE × 100
    const loadRatio = (workloadFte / capacity.availableFte) * 100

    metricsMap.set(activityId, {
      activityName: items[0]?.activity_name || activityId,
      frequency,
      avgDuration,
      maxDuration,
      minDuration,
      reworkRate,
      bottleneckScore,
      completionRate: (completed / items.length) * 100,
      waitingTime: 0,
      // FTE 지표
      standardMinutes,
      totalWorkMinutes,
      workloadFte,
      peakFte,
      loadRatio,
      roleName: config.roleName,
      capacityFte: capacity.availableFte
    })
  })

  const maxBottleneck = Math.max(...Array.from(metricsMap.values()).map(m => m.bottleneckScore), 1)
  metricsMap.forEach(m => {
    m.normalizedBottleneck = (m.bottleneckScore / maxBottleneck) * 100
  })

  activityMetrics.value = metricsMap
}

// Peak FTE 계산 (동시 실행 수 기반)
function calculatePeakFte(items: any[], standardMinutes: number): number {
  if (items.length === 0) return 0

  // 시작 시간 기준으로 정렬
  const sortedItems = [...items]
    .filter(i => i.started_at)
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  if (sortedItems.length === 0) return 0

  // 시간대별 동시 실행 수 계산
  const concurrentCounts: number[] = []
  const standardMs = standardMinutes * 60 * 1000

  sortedItems.forEach((item, idx) => {
    const startTime = new Date(item.started_at).getTime()
    const endTime = item.completed_at
      ? new Date(item.completed_at).getTime()
      : startTime + standardMs // 완료 시간이 없으면 표준 시간 사용

    // 이 시점에 동시에 실행 중인 인스턴스 수 계산
    let concurrent = 0
    sortedItems.forEach(other => {
      const otherStart = new Date(other.started_at).getTime()
      const otherEnd = other.completed_at
        ? new Date(other.completed_at).getTime()
        : otherStart + standardMs

      // 겹치는 시간이 있는지 확인
      if (otherStart < endTime && otherEnd > startTime) {
        concurrent++
      }
    })
    concurrentCounts.push(concurrent)
  })

  // P95 계산
  if (concurrentCounts.length === 0) return 0
  const sorted = [...concurrentCounts].sort((a, b) => a - b)
  const p95Index = Math.floor(sorted.length * 0.95)
  return sorted[Math.min(p95Index, sorted.length - 1)]
}

// Apply heatmap overlay (Camunda Optimize style - Glow effect)
function applyHeatmapOverlay() {
  const viewer = bpmnViewerRef.value?.bpmnViewer
  if (!viewer || activityMetrics.value.size === 0) return

  let overlays: any, elementRegistry: any
  try {
    overlays = viewer.get('overlays')
    elementRegistry = viewer.get('elementRegistry')
  } catch (e) { return }

  if (!overlays || !elementRegistry) return

  try {
    overlays.remove({ type: 'heatmap-glow' })
  } catch (e) {}

  let maxValue = 0
  activityMetrics.value.forEach(metrics => {
    const value = getMetricValue(metrics)
    if (value > maxValue) maxValue = value
  })

  activityMetrics.value.forEach((metrics, activityId) => {
    const element = elementRegistry.get(activityId)
    if (!element) return

    const value = getMetricValue(metrics)
    const intensity = maxValue > 0 ? value / maxValue : 0
    const color = getHeatmapColor(intensity)
    const displayValue = getDisplayValue(metrics)
    const elementWidth = element.width || 100
    const elementHeight = element.height || 80

    // Camunda-style thermal heatmap glow
    // intensity에 따라 보이는 색상 범위가 달라짐
    // 고강도: 빨강(중심) → 주황 → 노랑 → 초록(외곽)
    // 저강도: 초록만
    const glowContainer = document.createElement('div')
    const gradient = buildThermalGradient(intensity)
    const glowSize = 20 + intensity * 30 // 20px ~ 50px

    glowContainer.style.cssText = `
      position: absolute;
      width: ${elementWidth + glowSize * 2}px;
      height: ${elementHeight + glowSize * 2}px;
      left: ${-glowSize}px;
      top: ${-glowSize}px;
      border-radius: ${12 + glowSize}px;
      background: ${gradient};
      pointer-events: none;
      z-index: 1;
      filter: blur(${8 + intensity * 8}px);
    `

    // Tooltip on hover (positioned at top-right)
    const tooltip = document.createElement('div')
    tooltip.className = 'heatmap-tooltip'
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(30, 30, 46, 0.95);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
    `
    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: ${color};">${metrics.activityName}</div>
      <div style="display: flex; gap: 12px;">
        <span>⏱ ${formatDuration(metrics.avgDuration)}</span>
        <span>📊 ${metrics.frequency}회</span>
      </div>
      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1);">
        병목 점수: <strong style="color: ${color};">${Math.round(metrics.normalizedBottleneck)}%</strong>
      </div>
    `

    // Hover area for tooltip
    const hoverArea = document.createElement('div')
    hoverArea.style.cssText = `
      position: absolute;
      width: ${elementWidth}px;
      height: ${elementHeight}px;
      cursor: pointer;
      z-index: 50;
    `

    hoverArea.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1'
    })
    hoverArea.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0'
    })

    try {
      // Add glow effect behind the element
      overlays.add(activityId, 'heatmap-glow', {
        position: { top: 0, left: 0 },
        html: glowContainer
      })

      // Add hover area and tooltip
      overlays.add(activityId, 'heatmap-glow', {
        position: { top: 0, left: 0 },
        html: hoverArea
      })

      overlays.add(activityId, 'heatmap-glow', {
        position: { top: -70, left: elementWidth / 2 - 80 },
        html: tooltip
      })
    } catch (e) {}
  })

  // Pool 중앙 정렬 적용
  nextTick(() => {
    bpmnViewerRef.value?.resetZoom()
  })
}

// Build thermal heatmap gradient based on intensity
// 고강도: 빨강(중심) → 주황 → 노랑 → 초록(외곽)
// 저강도: 초록만
function buildThermalGradient(intensity: number): string {
  // 색상 정의 (thermal palette)
  const red = 'rgba(234, 67, 53, 0.8)'      // 빨강 (핫)
  const orange = 'rgba(251, 140, 0, 0.7)'   // 주황
  const yellow = 'rgba(251, 188, 4, 0.6)'   // 노랑
  const lime = 'rgba(156, 204, 101, 0.5)'   // 연두
  const green = 'rgba(76, 175, 80, 0.4)'    // 초록 (쿨)
  const transparent = 'rgba(76, 175, 80, 0)'

  if (intensity >= 0.8) {
    // 최고 강도: 빨강 중심, 모든 색상 표시
    return `radial-gradient(ellipse at center,
      ${red} 0%,
      ${orange} 25%,
      ${yellow} 45%,
      ${lime} 65%,
      ${green} 80%,
      ${transparent} 100%)`
  } else if (intensity >= 0.6) {
    // 고강도: 주황 중심
    return `radial-gradient(ellipse at center,
      ${orange} 0%,
      ${yellow} 30%,
      ${lime} 55%,
      ${green} 75%,
      ${transparent} 100%)`
  } else if (intensity >= 0.4) {
    // 중강도: 노랑 중심
    return `radial-gradient(ellipse at center,
      ${yellow} 0%,
      ${lime} 40%,
      ${green} 70%,
      ${transparent} 100%)`
  } else if (intensity >= 0.2) {
    // 저강도: 연두 중심
    return `radial-gradient(ellipse at center,
      ${lime} 0%,
      ${green} 50%,
      ${transparent} 100%)`
  } else {
    // 최저 강도: 초록만
    return `radial-gradient(ellipse at center,
      ${green} 0%,
      ${transparent} 100%)`
  }
}

function getMetricValue(metrics: any): number {
  switch (selectedMetric.value) {
    case 'duration': return metrics.avgDuration
    case 'frequency': return metrics.frequency
    case 'bottleneck': return metrics.normalizedBottleneck
    case 'rework': return metrics.reworkRate
    case 'waiting': return metrics.waitingTime
    // FTE metrics
    case 'workloadFte': return metrics.workloadFte || 0
    case 'peakFte': return metrics.peakFte || 0
    case 'loadRatio': return metrics.loadRatio || 0
    default: return 0
  }
}

function getDisplayValue(metrics: any): string {
  switch (selectedMetric.value) {
    case 'duration': return formatDuration(metrics.avgDuration)
    case 'frequency': return `${metrics.frequency}회`
    case 'bottleneck': return `${Math.round(metrics.normalizedBottleneck)}%`
    case 'rework': return `${metrics.reworkRate.toFixed(1)}%`
    case 'waiting': return formatDuration(metrics.waitingTime)
    // FTE metrics
    case 'workloadFte': return `${(metrics.workloadFte || 0).toFixed(2)} FTE`
    case 'peakFte': return `${(metrics.peakFte || 0).toFixed(1)} FTE`
    case 'loadRatio': return `${Math.round(metrics.loadRatio || 0)}%`
    default: return ''
  }
}

function getHeatmapColor(intensity: number): string {
  // Camunda Optimize style: Green → Yellow → Orange → Red
  if (intensity < 0.25) {
    // Green zone (low intensity)
    const t = intensity / 0.25
    return `rgb(${Math.round(76 + t * 60)}, ${Math.round(175 + t * 20)}, ${Math.round(80 - t * 20)})`
  } else if (intensity < 0.5) {
    // Yellow zone (medium-low)
    const t = (intensity - 0.25) / 0.25
    return `rgb(${Math.round(136 + t * 115)}, ${Math.round(195 + t * 25)}, ${Math.round(60 - t * 20)})`
  } else if (intensity < 0.75) {
    // Orange zone (medium-high)
    const t = (intensity - 0.5) / 0.25
    return `rgb(${Math.round(251)}, ${Math.round(220 - t * 100)}, ${Math.round(40 - t * 10)})`
  } else {
    // Red zone (high intensity)
    const t = (intensity - 0.75) / 0.25
    return `rgb(${Math.round(251 - t * 30)}, ${Math.round(120 - t * 60)}, ${Math.round(30 + t * 10)})`
  }
}

// Activity table data
const activityTableData = computed(() => {
  return Array.from(activityMetrics.value.entries())
    .map(([activityId, metrics]) => ({ activityId, ...metrics }))
    .sort((a, b) => b.normalizedBottleneck - a.normalizedBottleneck)
})

// FTE Settings Functions
const savingConfig = ref(false)
const editedActivityConfig = ref<Map<string, any>>(new Map())

function getActivityStandardMinutes(activityId: string): number {
  if (editedActivityConfig.value.has(activityId)) {
    return editedActivityConfig.value.get(activityId).standardMinutes
  }
  return activityConfig.value.get(activityId)?.standardMinutes || defaultStandardMinutes.value
}

function setActivityStandardMinutes(activityId: string, activityName: string, value: number) {
  const current = editedActivityConfig.value.get(activityId) || {
    standardMinutes: defaultStandardMinutes.value,
    roleName: 'Default',
    complexityFactor: 1.0,
    activityName
  }
  current.standardMinutes = Number(value)
  editedActivityConfig.value.set(activityId, current)
}

function getActivityRole(activityId: string): string {
  if (editedActivityConfig.value.has(activityId)) {
    return editedActivityConfig.value.get(activityId).roleName
  }
  return activityConfig.value.get(activityId)?.roleName || 'Default'
}

function setActivityRole(activityId: string, activityName: string, value: string) {
  const current = editedActivityConfig.value.get(activityId) || {
    standardMinutes: defaultStandardMinutes.value,
    roleName: 'Default',
    complexityFactor: 1.0,
    activityName
  }
  current.roleName = value
  editedActivityConfig.value.set(activityId, current)
}

function getActivityComplexity(activityId: string): number {
  if (editedActivityConfig.value.has(activityId)) {
    return editedActivityConfig.value.get(activityId).complexityFactor
  }
  return activityConfig.value.get(activityId)?.complexityFactor || 1.0
}

function setActivityComplexity(activityId: string, activityName: string, value: number) {
  const current = editedActivityConfig.value.get(activityId) || {
    standardMinutes: defaultStandardMinutes.value,
    roleName: 'Default',
    complexityFactor: 1.0,
    activityName
  }
  current.complexityFactor = Number(value)
  editedActivityConfig.value.set(activityId, current)
}

function addNewRole() {
  const roleName = `Role_${fteCapacity.value.size + 1}`
  fteCapacity.value.set(roleName, {
    availableFte: 1.0,
    hoursPerDay: 8,
    workingDaysPerMonth: 20,
    monthlyCapacityHours: 160
  })
}

function deleteRole(roleName: string) {
  if (roleName === 'Default') return
  fteCapacity.value.delete(roleName)
}

function updateRoleCapacity(roleName: string, field: string, value: number) {
  const capacity = fteCapacity.value.get(roleName)
  if (capacity) {
    capacity[field] = Number(value)
    capacity.monthlyCapacityHours = capacity.availableFte * capacity.hoursPerDay * capacity.workingDaysPerMonth
    fteCapacity.value.set(roleName, { ...capacity })
  }
}

async function saveActivityConfigs() {
  if (!selectedProcess.value) return

  savingConfig.value = true
  const defId = selectedProcess.value.replace('.bpmn', '')

  try {
    // Activity 설정 저장
    for (const [activityId, config] of editedActivityConfig.value) {
      await backend.saveActivityConfig({
        procDefId: defId,
        activityId,
        activityName: config.activityName,
        standardMinutes: config.standardMinutes,
        roleName: config.roleName,
        complexityFactor: config.complexityFactor
      })
    }

    // Role 용량 저장
    for (const [roleName, capacity] of fteCapacity.value) {
      await backend.saveFteCapacity({
        roleName,
        availableFte: capacity.availableFte,
        hoursPerDay: capacity.hoursPerDay,
        workingDaysPerMonth: capacity.workingDaysPerMonth
      })
    }

    console.log('[BottleneckAnalysis] FTE settings saved')
  } catch (e) {
    console.error('[BottleneckAnalysis] saveActivityConfigs error:', e)
  } finally {
    savingConfig.value = false
  }
}

async function applyFteSettings() {
  await saveActivityConfigs()
  showFteSettings.value = false
  // 설정 적용 후 메트릭 재계산
  await loadFteConfig()
  calculateActivityMetrics()
  applyHeatmapOverlay()
}

// Watchers
watch([selectedPeriod, selectedStatus], () => {
  if (selectedProcess.value) loadExecutionData()
})

watch(selectedMetric, () => applyHeatmapOverlay())

watch(selectedProcess, () => {
  if (selectedProcess.value) loadBpmnDiagram()
})

onMounted(() => loadProcessList())
</script>

<template>
  <v-card elevation="10" class="rounded-xl">
    <v-card-text class="pa-6">
      <!-- Header -->
      <div class="d-flex justify-space-between align-center mb-5">
        <div>
          <h1 class="text-h5 font-weight-bold text-textPrimary">Process Analytics</h1>
          <p class="text-body-2 text-grey100 mb-0 mt-1">히스토리 기반 프로세스 성능 분석 및 병목 지점 탐지</p>
        </div>
        <div class="d-flex ga-2">
          <v-btn
            variant="text"
            color="primary"
            size="small"
            prepend-icon="mdi-information-outline"
            @click="showMetricInfo = !showMetricInfo"
          >
            지표 설명
          </v-btn>
          <v-btn
            variant="tonal"
            color="indigo"
            size="small"
            prepend-icon="mdi-cog-outline"
            @click="showFteSettings = true"
            :disabled="!selectedProcess"
          >
            FTE 설정
          </v-btn>
        </div>
      </div>

      <!-- Metric Info Panel -->
      <v-expand-transition>
        <v-card v-show="showMetricInfo" variant="outlined" class="rounded-lg mb-5 metric-info-card">
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-4">
              <v-icon icon="mdi-lightbulb-outline" color="warning" size="20" class="mr-2" />
              <span class="text-subtitle-2 font-weight-semibold">지표 설명 및 계산 방식</span>
            </div>
            <v-row dense>
              <v-col v-for="(def, key) in metricDefinitions" :key="key" cols="12" md="4">
                <div
                  class="metric-def-item pa-3 rounded-lg"
                  :class="{ 'metric-def-active': selectedMetric === key }"
                >
                  <div class="d-flex align-center mb-2">
                    <v-icon :icon="def.icon" :color="def.color" size="18" class="mr-2" />
                    <span class="text-body-2 font-weight-semibold">{{ def.title }}</span>
                    <v-chip v-if="selectedMetric === key" size="x-small" color="primary" class="ml-2">선택됨</v-chip>
                  </div>
                  <p class="text-caption text-grey100 mb-2">{{ def.description }}</p>
                  <div class="formula-box">
                    <div class="formula-label">계산 공식</div>
                    <code class="formula-code">{{ def.formula }}</code>
                    <div class="formula-desc">{{ def.formulaDesc }}</div>
                    <div class="camunda-ref">
                      <v-icon icon="mdi-information-outline" size="10" class="mr-1" />
                      {{ def.camundaRef }}
                    </div>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-expand-transition>

      <!-- Process Selector & Filters -->
      <v-card variant="outlined" class="rounded-lg mb-5">
        <v-card-text class="pa-4">
          <v-row dense align="center">
            <v-col cols="12" md="5">
              <v-autocomplete
                v-model="selectedProcess"
                :items="processList"
                item-title="name"
                item-value="path"
                label="분석할 프로세스 선택"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                prepend-inner-icon="mdi-sitemap"
                :loading="loading"
                bg-color="white"
              />
            </v-col>
            <v-col cols="6" md="2">
              <v-select
                v-model="selectedPeriod"
                :items="periodOptions"
                label="기간"
                density="compact"
                variant="outlined"
                hide-details
                bg-color="white"
              />
            </v-col>
            <v-col cols="6" md="2">
              <v-select
                v-model="selectedStatus"
                :items="statusOptions"
                label="상태"
                density="compact"
                variant="outlined"
                hide-details
                bg-color="white"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="selectedMetric"
                :items="metricSelectOptions"
                item-title="title"
                item-value="value"
                label="지표"
                density="compact"
                variant="outlined"
                hide-details
                bg-color="white"
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props">
                    <template v-slot:prepend>
                      <v-icon :icon="item.raw.icon" :color="item.raw.color" size="18" />
                    </template>
                  </v-list-item>
                </template>
                <template v-slot:selection="{ item }">
                  <v-icon :icon="item.raw.icon" :color="item.raw.color" size="16" class="mr-2" />
                  {{ item.raw.title }}
                </template>
              </v-select>
            </v-col>
          </v-row>
          <!-- Metric Category Tabs -->
          <v-row dense class="mt-3">
            <v-col cols="12">
              <div class="metric-category-tabs">
                <div class="category-label">기본 지표</div>
                <v-btn-toggle
                  v-model="selectedMetric"
                  mandatory
                  density="compact"
                  color="primary"
                  class="metric-toggle mr-4"
                >
                  <v-btn value="duration" size="x-small">Duration</v-btn>
                  <v-btn value="frequency" size="x-small">Frequency</v-btn>
                  <v-btn value="bottleneck" size="x-small">Outlier</v-btn>
                </v-btn-toggle>
                <div class="category-label">FTE 지표</div>
                <v-btn-toggle
                  v-model="selectedMetric"
                  mandatory
                  density="compact"
                  color="indigo"
                  class="metric-toggle"
                >
                  <v-btn value="workloadFte" size="x-small">Workload</v-btn>
                  <v-btn value="peakFte" size="x-small">Peak</v-btn>
                  <v-btn value="loadRatio" size="x-small">Load Ratio</v-btn>
                </v-btn-toggle>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Empty State -->
      <div v-if="!selectedProcess" class="empty-state">
        <v-icon icon="mdi-chart-timeline-variant-shimmer" size="72" color="grey-lighten-1" class="mb-4" />
        <h3 class="text-h6 text-grey100 mb-2">프로세스를 선택하세요</h3>
        <p class="text-body-2 text-grey100">분석할 프로세스를 선택하면 실행 히스토리 기반의<br>성능 분석 결과가 표시됩니다.</p>
      </div>

      <!-- Main Content -->
      <template v-else>
        <!-- Current Metric Info Bar -->
        <v-card variant="tonal" :color="currentMetricDef.color" class="rounded-lg mb-4">
          <v-card-text class="pa-3">
            <div class="d-flex align-center">
              <v-icon :icon="currentMetricDef.icon" size="20" class="mr-3" />
              <div class="flex-grow-1">
                <span class="text-subtitle-2 font-weight-semibold">{{ currentMetricDef.title }}</span>
                <span class="text-caption ml-2">{{ currentMetricDef.subtitle }}</span>
              </div>
              <div class="heatmap-legend d-flex align-center ga-2">
                <span class="text-caption">낮음</span>
                <div class="legend-gradient"></div>
                <span class="text-caption">높음</span>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Stats Row -->
        <v-row class="mb-4">
          <v-col cols="6" md="3">
            <div class="stat-box">
              <div class="stat-icon primary">
                <v-icon icon="mdi-cube-outline" size="20" />
              </div>
              <div class="stat-content">
                <span class="stat-label">인스턴스</span>
                <span class="stat-value">{{ summaryStats.instances }}</span>
              </div>
            </div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="stat-box">
              <div class="stat-icon success">
                <v-icon icon="mdi-shape-outline" size="20" />
              </div>
              <div class="stat-content">
                <span class="stat-label">Activity</span>
                <span class="stat-value">{{ summaryStats.activities }}</span>
              </div>
            </div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="stat-box">
              <div class="stat-icon info">
                <v-icon icon="mdi-timer-sand" size="20" />
              </div>
              <div class="stat-content">
                <span class="stat-label">평균 소요</span>
                <span class="stat-value">{{ summaryStats.avgDuration }}</span>
              </div>
            </div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="stat-box">
              <div class="stat-icon warning">
                <v-icon icon="mdi-check-circle-outline" size="20" />
              </div>
              <div class="stat-content">
                <span class="stat-label">완료율</span>
                <span class="stat-value">{{ summaryStats.completionRate }}%</span>
              </div>
            </div>
          </v-col>
        </v-row>

        <!-- BPMN & Analysis Panel -->
        <v-row>
          <!-- BPMN Diagram -->
          <v-col cols="12" lg="8">
            <v-card variant="outlined" class="rounded-lg">
              <v-card-text class="pa-0">
                <div class="bpmn-header pa-4 pb-2">
                  <div class="d-flex justify-space-between align-center">
                    <h3 class="text-subtitle-1 font-weight-semibold text-textPrimary">
                      {{ selectedProcessName }}
                    </h3>
                    <v-chip v-if="loadingMetrics" size="small" color="primary" variant="tonal">
                      <v-progress-circular indeterminate size="12" width="2" class="mr-2" />
                      분석 중...
                    </v-chip>
                  </div>
                </div>

                <div v-if="loading" class="bpmn-placeholder">
                  <v-progress-circular indeterminate color="primary" size="40" />
                  <p class="text-body-2 text-grey100 mt-3">다이어그램 로딩 중...</p>
                </div>

                <div v-else-if="bpmnXml" class="bpmn-wrapper">
                  <BpmnUengineViewer
                    :key="bpmnKey"
                    ref="bpmnViewerRef"
                    :bpmn="bpmnXml"
                  />
                </div>

                <div v-else class="bpmn-placeholder">
                  <v-icon icon="mdi-file-document-alert-outline" size="48" color="grey-lighten-1" />
                  <p class="text-body-2 text-grey100 mt-2">BPMN 데이터를 불러올 수 없습니다</p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Analysis Panel -->
          <v-col cols="12" lg="4">
            <!-- Bottleneck Ranking -->
            <v-card variant="outlined" class="rounded-lg mb-4">
              <v-card-text class="pa-4">
                <div class="d-flex align-center mb-3">
                  <v-icon icon="mdi-podium" color="error" size="20" class="mr-2" />
                  <span class="text-subtitle-2 font-weight-semibold">병목 순위 Top 3</span>
                </div>
                <div v-if="bottleneckRanking.length > 0" class="ranking-list">
                  <div
                    v-for="(item, idx) in bottleneckRanking"
                    :key="item.id"
                    class="ranking-item"
                  >
                    <div class="rank-badge" :class="['rank-' + (idx + 1)]">{{ idx + 1 }}</div>
                    <div class="rank-content">
                      <span class="rank-name">{{ item.activityName }}</span>
                      <span class="rank-stats">
                        {{ formatDuration(item.avgDuration) }} · {{ item.frequency }}회
                      </span>
                    </div>
                    <v-progress-linear
                      :model-value="item.normalizedBottleneck"
                      :color="idx === 0 ? 'error' : idx === 1 ? 'warning' : 'grey'"
                      height="6"
                      rounded
                      class="rank-bar"
                    />
                  </div>
                </div>
                <div v-else class="text-center pa-4">
                  <p class="text-caption text-grey100">실행 데이터가 없습니다</p>
                </div>
              </v-card-text>
            </v-card>

            <!-- Duration Statistics -->
            <v-card v-if="durationStats" variant="outlined" class="rounded-lg mb-4">
              <v-card-text class="pa-4">
                <div class="d-flex align-center mb-3">
                  <v-icon icon="mdi-chart-box-outline" color="primary" size="20" class="mr-2" />
                  <span class="text-subtitle-2 font-weight-semibold">소요시간 분포</span>
                </div>
                <div class="duration-stats-grid">
                  <div class="duration-stat">
                    <span class="stat-label-sm">최소</span>
                    <span class="stat-value-sm text-success">{{ durationStats.min }}</span>
                  </div>
                  <div class="duration-stat">
                    <span class="stat-label-sm">최대</span>
                    <span class="stat-value-sm text-error">{{ durationStats.max }}</span>
                  </div>
                  <div class="duration-stat">
                    <span class="stat-label-sm">중앙값</span>
                    <span class="stat-value-sm text-info">{{ durationStats.median }}</span>
                  </div>
                  <div class="duration-stat">
                    <span class="stat-label-sm">평균</span>
                    <span class="stat-value-sm text-primary">{{ durationStats.avg }}</span>
                  </div>
                </div>
              </v-card-text>
            </v-card>

            <!-- Activity Table -->
            <v-card variant="outlined" class="rounded-lg">
              <v-card-text class="pa-0">
                <div class="d-flex justify-space-between align-center pa-4 pb-2">
                  <span class="text-subtitle-2 font-weight-semibold">Activity 상세</span>
                  <v-chip size="x-small" color="primary" variant="tonal">
                    {{ activityMetrics.size }}개
                  </v-chip>
                </div>
                <div class="activity-table-wrapper">
                  <v-table density="compact" class="activity-table">
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th class="text-right">소요</th>
                        <th class="text-right">빈도</th>
                        <th class="text-right">점수</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in activityTableData" :key="item.activityId">
                        <td class="activity-name">{{ item.activityName }}</td>
                        <td class="text-right">{{ formatDuration(item.avgDuration) }}</td>
                        <td class="text-right">{{ item.frequency }}</td>
                        <td class="text-right">
                          <span
                            class="score-badge"
                            :class="{
                              'high': item.normalizedBottleneck > 70,
                              'medium': item.normalizedBottleneck > 40 && item.normalizedBottleneck <= 70,
                              'low': item.normalizedBottleneck <= 40
                            }"
                          >
                            {{ Math.round(item.normalizedBottleneck) }}%
                          </span>
                        </td>
                      </tr>
                      <tr v-if="activityTableData.length === 0">
                        <td colspan="4" class="text-center text-caption text-grey100 pa-4">
                          데이터 없음
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </v-card-text>
  </v-card>

  <!-- FTE Settings Dialog -->
  <v-dialog v-model="showFteSettings" max-width="800" scrollable>
    <v-card class="rounded-lg">
      <v-card-title class="d-flex align-center pa-4 bg-indigo-lighten-5">
        <v-icon icon="mdi-account-hard-hat" color="indigo" class="mr-2" />
        <span>FTE 설정</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="showFteSettings = false" />
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- Default Settings -->
        <v-card variant="outlined" class="rounded-lg mb-4">
          <v-card-text class="pa-4">
            <div class="text-subtitle-2 font-weight-semibold mb-3">기본 설정</div>
            <v-row dense>
              <v-col cols="6">
                <v-text-field
                  v-model.number="defaultStandardMinutes"
                  label="기본 표준 작업시간 (분)"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  min="1"
                  max="480"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="defaultAvailableFte"
                  label="기본 가용 FTE"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  min="0.1"
                  max="100"
                  step="0.1"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Role Capacity Settings -->
        <v-card variant="outlined" class="rounded-lg mb-4">
          <v-card-text class="pa-4">
            <div class="d-flex justify-space-between align-center mb-3">
              <span class="text-subtitle-2 font-weight-semibold">Role별 FTE 용량</span>
              <v-btn
                size="small"
                color="indigo"
                variant="tonal"
                prepend-icon="mdi-plus"
                @click="addNewRole"
              >
                역할 추가
              </v-btn>
            </div>
            <v-table density="compact" class="fte-table">
              <thead>
                <tr>
                  <th>역할명</th>
                  <th class="text-center">가용 FTE</th>
                  <th class="text-center">일일 근무시간</th>
                  <th class="text-center">월 근무일</th>
                  <th class="text-center">월 용량(시간)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="[roleName, capacity] in fteCapacity" :key="roleName">
                  <td>{{ roleName }}</td>
                  <td class="text-center">
                    <v-text-field
                      :model-value="capacity.availableFte"
                      @update:model-value="updateRoleCapacity(roleName, 'availableFte', $event)"
                      type="number"
                      density="compact"
                      variant="plain"
                      hide-details
                      class="centered-input"
                      style="max-width: 60px"
                      min="0.1"
                      step="0.1"
                    />
                  </td>
                  <td class="text-center">
                    <v-text-field
                      :model-value="capacity.hoursPerDay"
                      @update:model-value="updateRoleCapacity(roleName, 'hoursPerDay', $event)"
                      type="number"
                      density="compact"
                      variant="plain"
                      hide-details
                      class="centered-input"
                      style="max-width: 60px"
                    />
                  </td>
                  <td class="text-center">
                    <v-text-field
                      :model-value="capacity.workingDaysPerMonth"
                      @update:model-value="updateRoleCapacity(roleName, 'workingDaysPerMonth', $event)"
                      type="number"
                      density="compact"
                      variant="plain"
                      hide-details
                      class="centered-input"
                      style="max-width: 60px"
                    />
                  </td>
                  <td class="text-center text-primary font-weight-semibold">
                    {{ (capacity.availableFte * capacity.hoursPerDay * capacity.workingDaysPerMonth).toFixed(0) }}h
                  </td>
                  <td class="text-center">
                    <v-btn
                      v-if="roleName !== 'Default'"
                      icon="mdi-delete-outline"
                      size="x-small"
                      color="error"
                      variant="text"
                      @click="deleteRole(roleName)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>

        <!-- Activity Standard Time Settings -->
        <v-card variant="outlined" class="rounded-lg">
          <v-card-text class="pa-4">
            <div class="d-flex justify-space-between align-center mb-3">
              <span class="text-subtitle-2 font-weight-semibold">Activity별 표준 작업시간</span>
              <v-btn
                size="small"
                color="primary"
                variant="tonal"
                prepend-icon="mdi-content-save"
                @click="saveActivityConfigs"
                :loading="savingConfig"
              >
                저장
              </v-btn>
            </div>
            <div class="activity-config-wrapper">
              <v-table density="compact" class="fte-table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th class="text-center">표준시간(분)</th>
                    <th class="text-center">역할</th>
                    <th class="text-center">복잡도</th>
                    <th class="text-center">FTE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in activityTableData" :key="item.activityId">
                    <td class="activity-name">{{ item.activityName }}</td>
                    <td class="text-center">
                      <v-text-field
                        :model-value="getActivityStandardMinutes(item.activityId)"
                        @update:model-value="setActivityStandardMinutes(item.activityId, item.activityName, $event)"
                        type="number"
                        density="compact"
                        variant="plain"
                        hide-details
                        class="centered-input"
                        style="max-width: 60px"
                        min="1"
                      />
                    </td>
                    <td class="text-center">
                      <v-select
                        :model-value="getActivityRole(item.activityId)"
                        @update:model-value="setActivityRole(item.activityId, item.activityName, $event)"
                        :items="Array.from(fteCapacity.keys())"
                        density="compact"
                        variant="plain"
                        hide-details
                        style="max-width: 100px"
                      />
                    </td>
                    <td class="text-center">
                      <v-text-field
                        :model-value="getActivityComplexity(item.activityId)"
                        @update:model-value="setActivityComplexity(item.activityId, item.activityName, $event)"
                        type="number"
                        density="compact"
                        variant="plain"
                        hide-details
                        class="centered-input"
                        style="max-width: 50px"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                      />
                    </td>
                    <td class="text-center">
                      <span class="text-primary font-weight-semibold">
                        {{ (item.workloadFte || 0).toFixed(2) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </v-card-text>
        </v-card>
      </v-card-text>

      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn variant="text" @click="showFteSettings = false">닫기</v-btn>
        <v-btn color="indigo" variant="flat" @click="applyFteSettings">적용</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 16px;
  text-align: center;
}

.metric-info-card {
  background: #fffbf0 !important;
  border-color: #ffd54f !important;
}

.metric-def-item {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #e5eaef;
  transition: all 0.2s ease;
  height: 100%;
}

.metric-def-item:hover {
  border-color: #90caf9;
  box-shadow: 0 2px 8px rgba(0, 133, 219, 0.1);
}

.metric-def-active {
  background: rgba(0, 133, 219, 0.08) !important;
  border-color: #0085db !important;
  box-shadow: 0 2px 8px rgba(0, 133, 219, 0.15);
}

.formula-box {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 8px;
}

.formula-label {
  font-size: 10px;
  font-weight: 600;
  color: #707a82;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.formula-code {
  display: block;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #0085db;
  background: rgba(0, 133, 219, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.formula-desc {
  font-size: 10px;
  color: #707a82;
  line-height: 1.4;
}

.camunda-ref {
  display: flex;
  align-items: center;
  font-size: 9px;
  color: #9e9e9e;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #e0e0e0;
  font-style: italic;
}

.metric-toggle {
  width: 100%;
}

.metric-toggle .v-btn {
  flex: 1;
  font-size: 11px !important;
}

.heatmap-legend {
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 12px;
  border-radius: 20px;
}

.legend-gradient {
  width: 100px;
  height: 10px;
  background: linear-gradient(90deg, #4caf50, #8bc34a, #fbc02d, #fb8c00, #f44336);
  border-radius: 5px;
  border: 1px solid rgba(0,0,0,0.1);
}

.stat-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e5eaef;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.primary { background: linear-gradient(135deg, #0085db, #00a8e8); }
.stat-icon.success { background: linear-gradient(135deg, #4bd08b, #2ecc71); }
.stat-icon.info { background: linear-gradient(135deg, #46caeb, #17a2b8); }
.stat-icon.warning { background: linear-gradient(135deg, #f8c076, #f39c12); }

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 12px;
  color: #707a82;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #2a3547;
}

.bpmn-header {
  border-bottom: 1px solid #e5eaef;
}

.bpmn-wrapper {
  height: 420px;
  background: #fafbfc;
}

.bpmn-placeholder {
  height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fafbfc;
}

.bpmn-wrapper :deep(.djs-palette) {
  display: none !important;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ranking-item {
  display: grid;
  grid-template-columns: 28px 1fr 60px;
  align-items: center;
  gap: 10px;
}

.rank-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  color: white;
}

.rank-badge.rank-1 { background: linear-gradient(135deg, #ea4335, #c62828); }
.rank-badge.rank-2 { background: linear-gradient(135deg, #fbbc04, #f57c00); }
.rank-badge.rank-3 { background: linear-gradient(135deg, #9e9e9e, #757575); }

.rank-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.rank-name {
  font-size: 13px;
  font-weight: 600;
  color: #2a3547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-stats {
  font-size: 11px;
  color: #707a82;
}

.rank-bar {
  width: 60px;
}

.duration-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.duration-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-label-sm {
  font-size: 11px;
  color: #707a82;
  margin-bottom: 4px;
}

.stat-value-sm {
  font-size: 14px;
  font-weight: 600;
}

.activity-table-wrapper {
  max-height: 240px;
  overflow-y: auto;
}

.activity-table {
  background: transparent !important;
}

.activity-table th {
  background: #f8f9fa !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #707a82 !important;
  padding: 8px 12px !important;
  border-bottom: 1px solid #e5eaef !important;
}

.activity-table td {
  font-size: 12px !important;
  padding: 8px 12px !important;
  border-bottom: 1px solid #e5eaef !important;
}

.activity-name {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.score-badge.high {
  background: #fdeaea;
  color: #ea4335;
}

.score-badge.medium {
  background: #fff8e1;
  color: #f57c00;
}

.score-badge.low {
  background: #e8f5e9;
  color: #4caf50;
}

/* Metric Category Tabs */
.metric-category-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.category-label {
  font-size: 11px;
  font-weight: 600;
  color: #707a82;
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 4px;
}

/* FTE Settings Dialog */
.fte-table {
  background: transparent !important;
}

.fte-table th {
  background: #f8f9fa !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  color: #707a82 !important;
  padding: 8px 12px !important;
  border-bottom: 1px solid #e5eaef !important;
}

.fte-table td {
  font-size: 12px !important;
  padding: 6px 12px !important;
  border-bottom: 1px solid #e5eaef !important;
}

.centered-input :deep(input) {
  text-align: center;
}

.activity-config-wrapper {
  max-height: 300px;
  overflow-y: auto;
}

/* Load Ratio Color Coding */
.load-ratio-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.load-ratio-badge.overload {
  background: #fdeaea;
  color: #ea4335;
}

.load-ratio-badge.warning {
  background: #fff8e1;
  color: #f57c00;
}

.load-ratio-badge.optimal {
  background: #e3f2fd;
  color: #1976d2;
}

.load-ratio-badge.underload {
  background: #e8f5e9;
  color: #4caf50;
}
</style>
