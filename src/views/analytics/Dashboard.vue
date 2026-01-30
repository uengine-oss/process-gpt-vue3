<script setup>
/**
 * Analytics Dashboard
 * 프로세스 실행 요약 통계 및 차트
 * BPM 표준 통계 포함: 부서별 Task 수량, 프로세스 성능, Agent vs Human 비교
 */
import { onMounted, computed, ref, shallowRef } from 'vue'
import { useOlapStore } from '@/stores/analytics/olapStore'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js'
import { Doughnut, Line, Bar } from 'vue-chartjs'
import dayjs from 'dayjs'
import BackendFactory from '@/components/api/BackendFactory'
import { olapApi, syncDepartmentsFromOrgChart } from '@/services/analyticsApi'

const backend = BackendFactory.createBackend()

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler)

const store = useOlapStore()
const loading = ref(false)
const syncing = ref(false)

// Chart ready flags
const chartsReady = ref(false)

// Chart data - shallowRef 사용 (vue-chartjs 권장)
const taskDistributionData = shallowRef({
  labels: ['Agent', 'Human'],
  datasets: [{
    data: [0, 0],
    backgroundColor: ['#0085db', '#8763da'],
    borderWidth: 0,
    cutout: '70%'
  }]
})

const monthlyTrendData = shallowRef({
  labels: ['1월', '2월', '3월', '4월', '5월', '6월'],
  datasets: [{
    label: 'Tasks',
    data: [0, 0, 0, 0, 0, 0],
    borderColor: '#0085db',
    backgroundColor: 'rgba(0, 133, 219, 0.1)',
    fill: true,
    tension: 0.4,
    pointBackgroundColor: '#0085db',
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6
  }]
})

// FTE Heatmap 데이터
const fteHeatmapData = ref({
  processes: [],
  departments: [],
  data: []
})

// 프로세스 성능 데이터
const processPerformanceData = ref([])

// 병목 분석 데이터
const bottleneckData = ref([])

// Domain 별 Sub Process Count (실제 데이터)
const domainData = ref([])
const domainColors = ['primary', 'success', 'error', 'indigo', 'warning', 'info']

// 부서별 Task 수량 데이터
const departmentTaskData = ref([])
const departmentChartData = shallowRef({
  labels: [],
  datasets: [
    {
      label: 'Agent Tasks',
      data: [],
      backgroundColor: 'rgba(0, 133, 219, 0.8)',
      borderRadius: 4
    },
    {
      label: 'Human Tasks',
      data: [],
      backgroundColor: 'rgba(135, 99, 218, 0.8)',
      borderRadius: 4
    }
  ]
})

// Agent vs Human 비교 데이터
const agentVsHumanData = ref(null)

// 총 FTE 계산
const totalFte = computed(() => {
  let sum = 0
  const data = fteHeatmapData.value?.data
  if (data && Array.isArray(data) && data.length > 0) {
    data.forEach(row => {
      if (row && Array.isArray(row) && row.length > 0) {
        row.forEach(val => sum += (val || 0))
      }
    })
  }
  return sum.toFixed(1)
})

// FTE Heatmap 데이터 유무 확인
const hasFteData = computed(() => {
  const val = fteHeatmapData.value
  return val?.processes?.length > 0 && val?.departments?.length > 0
})

// 최대 domain count
const maxDomainCount = computed(() => {
  if (!domainData.value || domainData.value.length === 0) return 1
  return Math.max(...domainData.value.map(d => d.subProcessCount), 1)
})

async function refresh() {
  loading.value = true
  try {
    // 기존 데이터 fetch + BPM 표준 통계 fetch
    await Promise.all([
      store.fetchDashboardSummary(),
      store.fetchInstances({ limit: 10 }),
      loadDepartmentTaskStats(),
      loadAgentVsHumanStats(),
      loadMonthlyTrend(),
      loadFteHeatmap(),
      loadProcessPerformance(),
      loadBottleneckAnalysis()
    ])

    const summary = store.dashboardSummary
    const inst = summary?.instances || {}

    // Task distribution chart - 전체 객체 교체 (shallowRef 필수)
    taskDistributionData.value = {
      labels: ['Agent', 'Human'],
      datasets: [{
        data: [inst.agent_tasks || 0, inst.human_tasks || 0],
        backgroundColor: ['#0085db', '#8763da'],
        borderWidth: 0,
        cutout: '70%'
      }]
    }

    // Domain별 Sub Process Count - 실제 데이터 가져오기
    await loadDomainProcessCount()

    chartsReady.value = true
  } catch (e) {
    console.error('[Dashboard] refresh error:', e)
    chartsReady.value = true
  } finally {
    loading.value = false
  }
}

// 부서별 Task 수량 통계 로드
async function loadDepartmentTaskStats() {
  try {
    const response = await olapApi.getTasksByDepartment()
    if (response.success && response.data) {
      departmentTaskData.value = response.data

      // 차트 데이터 업데이트
      const labels = response.data.map(d => d.department_name || '미지정')
      const agentTasks = response.data.map(d => d.agent_tasks || 0)
      const humanTasks = response.data.map(d => d.human_tasks || 0)

      departmentChartData.value = {
        labels: labels.slice(0, 8), // 최대 8개 부서만 표시
        datasets: [
          {
            label: 'Agent Tasks',
            data: agentTasks.slice(0, 8),
            backgroundColor: 'rgba(0, 133, 219, 0.8)',
            borderRadius: 4
          },
          {
            label: 'Human Tasks',
            data: humanTasks.slice(0, 8),
            backgroundColor: 'rgba(135, 99, 218, 0.8)',
            borderRadius: 4
          }
        ]
      }
    }
  } catch (e) {
    console.error('[Dashboard] loadDepartmentTaskStats error:', e)
    departmentTaskData.value = []
    // 빈 데이터 구조 유지 (Chart.js 호환)
    departmentChartData.value = {
      labels: [],
      datasets: [
        { label: 'Agent Tasks', data: [], backgroundColor: 'rgba(0, 133, 219, 0.8)', borderRadius: 4 },
        { label: 'Human Tasks', data: [], backgroundColor: 'rgba(135, 99, 218, 0.8)', borderRadius: 4 }
      ]
    }
  }
}

// Agent vs Human 비교 통계 로드
async function loadAgentVsHumanStats() {
  try {
    const response = await olapApi.getAgentVsHumanComparison()
    if (response.success && response.data) {
      agentVsHumanData.value = response.data
    }
  } catch (e) {
    console.error('[Dashboard] loadAgentVsHumanStats error:', e)
    agentVsHumanData.value = []
  }
}

// 월별 트렌드 로드
async function loadMonthlyTrend() {
  try {
    const response = await olapApi.getMonthlyTrend()
    if (response.success && response.data && response.data.length > 0) {
      const trendData = response.data.slice(0, 6).reverse()
      // 전체 객체 교체 (shallowRef 필수)
      monthlyTrendData.value = {
        labels: trendData.map(d => `${d.month}월`),
        datasets: [{
          label: 'Tasks',
          data: trendData.map(d => d.total_tasks || 0),
          borderColor: '#0085db',
          backgroundColor: 'rgba(0, 133, 219, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#0085db',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      }
    }
  } catch (e) {
    console.error('[Dashboard] loadMonthlyTrend error:', e)
  }
}

// FTE Heatmap 실제 데이터 로드
async function loadFteHeatmap() {
  try {
    const response = await olapApi.getFteHeatmap()
    if (response.success && response.data) {
      const data = response.data
      fteHeatmapData.value = {
        processes: data.processes || [],
        departments: data.departments || [],
        data: data.processes?.map(proc =>
          data.departments?.map(dept =>
            data.matrix?.[proc]?.[dept]?.fte || 0
          ) || []
        ) || []
      }
    }
  } catch (e) {
    console.error('[Dashboard] loadFteHeatmap error:', e)
    fteHeatmapData.value = { processes: [], departments: [], data: [] }
  }
}

// 프로세스 성능 데이터 로드
async function loadProcessPerformance() {
  try {
    const response = await olapApi.getProcessPerformance()
    if (response.success && response.data) {
      processPerformanceData.value = response.data.slice(0, 5) // 상위 5개
    }
  } catch (e) {
    console.error('[Dashboard] loadProcessPerformance error:', e)
    processPerformanceData.value = []
  }
}

// 병목 분석 데이터 로드
async function loadBottleneckAnalysis() {
  try {
    const response = await olapApi.getBottleneckAnalysis()
    if (response.success && response.data) {
      // 대기시간 기준 정렬 (병목 심한 순)
      bottleneckData.value = response.data
        .sort((a, b) => (b.avg_wait_time_sec || 0) - (a.avg_wait_time_sec || 0))
        .slice(0, 5)
    }
  } catch (e) {
    console.error('[Dashboard] loadBottleneckAnalysis error:', e)
    bottleneckData.value = []
  }
}

// Domain별 Sub Process Count 실제 데이터 로드
async function loadDomainProcessCount() {
  try {
    const metricsMap = await backend.getMetricsMap()

    if (!metricsMap || !metricsMap.domains || !metricsMap.processes) {
      domainData.value = []
      return
    }

    // Domain별 프로세스 수 계산
    const domainCountMap = new Map()

    // 도메인 초기화
    metricsMap.domains.forEach(domain => {
      domainCountMap.set(domain.id, {
        id: domain.id,
        domain: domain.name,
        subProcessCount: 0,
        color: domain.color || null
      })
    })

    // 프로세스 카운트
    metricsMap.processes.forEach(process => {
      if (process.domain_id && domainCountMap.has(process.domain_id)) {
        domainCountMap.get(process.domain_id).subProcessCount++
      }
    })

    // 정렬 (프로세스 수 내림차순) 및 색상 할당
    const sortedDomains = Array.from(domainCountMap.values())
      .filter(d => d.subProcessCount > 0) // 프로세스가 있는 도메인만
      .sort((a, b) => b.subProcessCount - a.subProcessCount)
      .map((d, idx) => ({
        ...d,
        color: d.color ? getVuetifyColor(d.color) : domainColors[idx % domainColors.length]
      }))

    domainData.value = sortedDomains
  } catch (e) {
    console.error('[Dashboard] loadDomainProcessCount error:', e)
    domainData.value = []
  }
}

// Hex 컬러를 Vuetify 컬러로 변환 (근사값)
function getVuetifyColor(hexColor) {
  if (!hexColor) return 'primary'

  const colorMap = {
    '#E53935': 'error',
    '#D81B60': 'error',
    '#8E24AA': 'indigo',
    '#5E35B1': 'indigo',
    '#3949AB': 'primary',
    '#1E88E5': 'primary',
    '#00ACC1': 'info',
    '#00897B': 'success',
    '#43A047': 'success',
    '#7CB342': 'success',
    '#FB8C00': 'warning',
    '#6D4C41': 'secondary'
  }

  return colorMap[hexColor] || 'primary'
}

onMounted(() => {
  refresh()
})

// Stats cards - 실제 데이터 사용 (하드코딩 제거)
const statsCards = computed(() => {
  const summary = store.dashboardSummary
  const instances = summary?.instances || {}
  const tasks = summary?.tasks || {}

  return [
    {
      title: '프로세스 인스턴스',
      value: instances.total_instances ?? 0,
      subtitle: `완료: ${instances.completed ?? 0}`,
      icon: 'mdi-cube-outline',
      color: 'primary',
      bgColor: 'lightprimary'
    },
    {
      title: '전체 Tasks',
      value: tasks.total_tasks ?? 0,
      subtitle: tasks.avg_duration_sec
        ? `평균 처리시간: ${Math.round(tasks.avg_duration_sec)}초`
        : '평균 처리시간: -',
      icon: 'mdi-checkbox-marked-circle-outline',
      color: 'success',
      bgColor: 'lightsuccess'
    },
    {
      title: 'Agent Tasks',
      value: instances.agent_tasks ?? 0,
      subtitle: `Human: ${instances.human_tasks ?? 0}`,
      icon: 'mdi-robot',
      color: 'info',
      bgColor: 'lightinfo'
    },
    {
      title: 'Total FTE',
      value: totalFte.value,
      subtitle: '프로세스별 인력 투입',
      icon: 'mdi-account-group-outline',
      color: 'warning',
      bgColor: 'lightwarning'
    }
  ]
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 1,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        boxWidth: 10,
        padding: 12,
        font: { size: 12, weight: '500' },
        color: '#2A3547',
        generateLabels: (chart) => {
          const data = chart.data
          if (data.labels && data.datasets.length) {
            return data.labels.map((label, i) => ({
              text: `${label}: ${data.datasets[0].data[i]?.toLocaleString() || 0}`,
              fillStyle: data.datasets[0].backgroundColor[i],
              strokeStyle: data.datasets[0].backgroundColor[i],
              lineWidth: 0,
              hidden: false,
              index: i
            }))
          }
          return []
        }
      }
    },
    tooltip: {
      backgroundColor: '#2A3547',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 10,
      cornerRadius: 6
    }
  }
}

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 3,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#2A3547',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 10,
      cornerRadius: 6
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(0, 0, 0, 0.04)' },
      ticks: { color: '#707a82', font: { size: 11 } }
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0, 0, 0, 0.04)' },
      ticks: { color: '#707a82', font: { size: 11 } }
    }
  }
}

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 1.8,
  indexAxis: 'y',
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        boxWidth: 12,
        padding: 15,
        font: { size: 12 }
      }
    },
    tooltip: {
      backgroundColor: '#2A3547',
      titleColor: '#fff',
      bodyColor: '#fff',
      padding: 12,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      stacked: true,
      grid: { color: 'rgba(0, 0, 0, 0.05)' },
      ticks: { color: '#707a82' }
    },
    y: {
      stacked: true,
      grid: { display: false },
      ticks: { color: '#707a82', font: { size: 11 } }
    }
  }
}

// Agent vs Human 비교 헬퍼
const getAgentStats = computed(() => {
  if (!agentVsHumanData.value || agentVsHumanData.value.length === 0) return null
  return agentVsHumanData.value.find(d => d.performer_type === 'AGENT')
})

const getHumanStats = computed(() => {
  if (!agentVsHumanData.value || agentVsHumanData.value.length === 0) return null
  return agentVsHumanData.value.find(d => d.performer_type === 'HUMAN')
})

const hasAgentVsHumanData = computed(() => {
  return agentVsHumanData.value && Array.isArray(agentVsHumanData.value) && agentVsHumanData.value.length > 0
})

// 차트 렌더링 조건 - 데이터 안전성 체크
const canRenderTaskDistribution = computed(() => {
  if (!chartsReady.value) return false
  const d = taskDistributionData.value
  return d && d.datasets && Array.isArray(d.datasets) && d.datasets.length > 0 && d.datasets[0]?.data
})

const hasTaskDistributionData = computed(() => {
  const data = taskDistributionData.value?.datasets?.[0]?.data
  return data && data.length >= 2 && (data[0] > 0 || data[1] > 0)
})

// 월별 트렌드
const canRenderMonthlyTrend = computed(() => {
  if (!chartsReady.value) return false
  const d = monthlyTrendData.value
  return d && d.datasets && Array.isArray(d.datasets) && d.datasets.length > 0 && d.datasets[0]?.data
})

const hasMonthlyTrendData = computed(() => {
  const data = monthlyTrendData.value?.datasets?.[0]?.data
  return data && Array.isArray(data) && data.some(v => v > 0)
})

// 부서별 차트
const canRenderDepartmentChart = computed(() => {
  if (!chartsReady.value) return false
  const d = departmentChartData.value
  return d && d.datasets && Array.isArray(d.datasets) && d.datasets.length > 0 && d.labels && d.labels.length > 0
})

// Safe chart data computed - 항상 유효한 구조 반환 (vue-chartjs 내부 에러 방지)
const safeTaskDistributionData = computed(() => {
  const d = taskDistributionData.value
  if (d && typeof d === 'object' && d.datasets && Array.isArray(d.datasets)) {
    return d
  }
  return {
    labels: ['Agent', 'Human'],
    datasets: [{
      data: [0, 0],
      backgroundColor: ['#0085db', '#8763da'],
      borderWidth: 0,
      cutout: '70%'
    }]
  }
})

const safeMonthlyTrendData = computed(() => {
  const d = monthlyTrendData.value
  if (d && typeof d === 'object' && d.datasets && Array.isArray(d.datasets)) {
    return d
  }
  return {
    labels: ['1월', '2월', '3월', '4월', '5월', '6월'],
    datasets: [{
      label: 'Tasks',
      data: [0, 0, 0, 0, 0, 0],
      borderColor: '#0085db',
      backgroundColor: 'rgba(0, 133, 219, 0.1)',
      fill: true,
      tension: 0.4
    }]
  }
})

const safeDepartmentChartData = computed(() => {
  const d = departmentChartData.value
  if (d && typeof d === 'object' && d.datasets && Array.isArray(d.datasets) && d.labels) {
    return d
  }
  return {
    labels: [],
    datasets: [
      { label: 'Agent Tasks', data: [], backgroundColor: 'rgba(0, 133, 219, 0.8)', borderRadius: 4 },
      { label: 'Human Tasks', data: [], backgroundColor: 'rgba(135, 99, 218, 0.8)', borderRadius: 4 }
    ]
  }
})

// 부서별 총 Task 수
const totalDeptTasks = computed(() => {
  if (!departmentTaskData.value || !Array.isArray(departmentTaskData.value)) return 0
  return departmentTaskData.value.reduce((sum, d) => sum + (d.total_tasks || 0), 0)
})

// FTE Heatmap 색상 계산 (Primary color 기반)
function getFteColor(value) {
  const intensity = Math.min(value / 4, 1)
  if (intensity < 0.2) return 'rgba(0, 133, 219, 0.08)'
  if (intensity < 0.4) return 'rgba(0, 133, 219, 0.2)'
  if (intensity < 0.6) return 'rgba(0, 133, 219, 0.4)'
  if (intensity < 0.8) return 'rgba(0, 133, 219, 0.6)'
  return 'rgba(0, 133, 219, 0.85)'
}

function getFteTextColor(value) {
  return value > 1.5 ? '#ffffff' : '#2A3547'
}

function formatDateTime(timestamp) {
  return dayjs(timestamp).format('MM/DD HH:mm')
}

function getBarWidth(count) {
  return (count / maxDomainCount.value) * 100
}

// 초를 시간 포맷으로 변환
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}초`
  if (seconds < 3600) return `${Math.round(seconds / 60)}분`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
}

// 완료율 계산
function getCompletionRate(completed, total) {
  if (!total || total === 0) return 0
  return Math.round((completed / total) * 100)
}

// 병목 바 너비 계산
function getBottleneckBarWidth(item, type) {
  const wait = item.avg_wait_time_sec || 0
  const process = item.avg_processing_time_sec || 0
  const total = wait + process
  if (total === 0) return 0
  if (type === 'wait') return (wait / total) * 100
  return (process / total) * 100
}

// 조직도에서 부서 동기화
async function syncDepartments() {
  syncing.value = true
  try {
    const result = await syncDepartmentsFromOrgChart()
    if (result.success) {
      console.log(`[Dashboard] Synced ${result.count} departments`)
      // 데이터 새로고침
      await Promise.all([
        loadDepartmentTaskStats(),
        loadFteHeatmap()
      ])
    } else {
      console.error('[Dashboard] Sync failed:', result.error)
    }
  } catch (e) {
    console.error('[Dashboard] syncDepartments error:', e)
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <v-card elevation="10" class="rounded-xl">
    <v-card-text class="pa-6">
      <!-- Header -->
      <div class="d-flex justify-space-between align-center mb-6">
        <div>
          <h1 class="text-h5 font-weight-bold text-textPrimary">Analytics Dashboard</h1>
          <p class="text-body-2 text-grey100 mb-0 mt-1">프로세스 실행 현황 및 분석</p>
        </div>
        <v-btn
          color="primary"
          variant="tonal"
          :loading="loading"
          @click="refresh"
        >
          <v-icon start>mdi-refresh</v-icon>
          새로고침
        </v-btn>
      </div>

      <!-- Stats Cards -->
      <v-row class="mb-2">
        <v-col v-for="card in statsCards" :key="card.title" cols="12" sm="6" lg="3">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-5">
              <div class="d-flex align-center">
                <v-avatar :color="card.bgColor" size="52" class="mr-4">
                  <v-icon :icon="card.icon" :color="card.color" size="24" />
                </v-avatar>
                <div>
                  <p class="text-subtitle-2 text-grey100 mb-1">{{ card.title }}</p>
                  <h3 class="text-h4 font-weight-bold text-textPrimary">{{ card.value }}</h3>
                  <p class="text-caption text-grey100 mb-0 mt-1">{{ card.subtitle }}</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts Row 1 -->
      <v-row class="mb-2" align="stretch">
        <!-- Task Distribution -->
        <v-col cols="12" md="4">
          <v-card variant="outlined" class="rounded-lg task-distribution-card">
            <v-card-text class="pa-4">
              <div class="d-flex justify-space-between align-center mb-3">
                <h3 class="text-subtitle-1 font-weight-semibold text-textPrimary">Task 배분</h3>
                <v-chip size="x-small" color="primary" variant="tonal">Agent vs Human</v-chip>
              </div>
              <div v-if="canRenderTaskDistribution && hasTaskDistributionData" class="doughnut-wrapper">
                <Doughnut
                  :chartData="safeTaskDistributionData"
                  :chartOptions="doughnutOptions"
                />
              </div>
              <div v-else-if="loading" class="d-flex align-center justify-center" style="height: 200px;">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else class="d-flex align-center justify-center" style="height: 200px;">
                <div class="text-center">
                  <v-icon icon="mdi-chart-donut" size="40" color="grey-lighten-1" class="mb-2" />
                  <p class="text-body-2 text-grey100 mb-0">데이터가 없습니다</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Monthly Trend -->
        <v-col cols="12" md="8">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-4">
              <div class="d-flex justify-space-between align-center mb-3">
                <h3 class="text-subtitle-1 font-weight-semibold text-textPrimary">월별 Task 추이</h3>
                <v-chip size="x-small" color="info" variant="tonal">최근 6개월</v-chip>
              </div>
              <div v-if="canRenderMonthlyTrend" class="chart-wrapper">
                <Line
                  :chartData="safeMonthlyTrendData"
                  :chartOptions="lineChartOptions"
                />
              </div>
              <div v-else-if="loading" class="d-flex align-center justify-center" style="height: 150px;">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else class="d-flex align-center justify-center" style="height: 150px;">
                <div class="text-center">
                  <v-icon icon="mdi-chart-line" size="40" color="grey-lighten-1" class="mb-2" />
                  <p class="text-body-2 text-grey100 mb-0">월별 데이터가 없습니다</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts Row 2: FTE Heatmap & Domain Count -->
      <v-row class="mb-2">
        <!-- FTE Heatmap -->
        <v-col cols="12" md="7">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <h3 class="text-h6 font-weight-semibold text-textPrimary">FTE Heatmap</h3>
                <v-chip size="small" color="success" variant="tonal">프로세스 × 부서</v-chip>
              </div>
              <div v-if="hasFteData" class="heatmap-scroll">
                <table class="heatmap-table">
                  <thead>
                    <tr>
                      <th class="heatmap-corner"></th>
                      <th v-for="dept in fteHeatmapData.departments" :key="dept" class="heatmap-header">
                        {{ dept }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(process, pIdx) in fteHeatmapData.processes" :key="process">
                      <td class="heatmap-row-label">{{ process }}</td>
                      <td
                        v-for="(dept, dIdx) in fteHeatmapData.departments"
                        :key="`${pIdx}-${dIdx}`"
                        class="heatmap-cell"
                        :style="{
                          backgroundColor: getFteColor(fteHeatmapData.data[pIdx]?.[dIdx] || 0),
                          color: getFteTextColor(fteHeatmapData.data[pIdx]?.[dIdx] || 0)
                        }"
                      >
                        {{ (fteHeatmapData.data[pIdx]?.[dIdx] || 0).toFixed(1) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="hasFteData" class="d-flex align-center justify-end ga-3 mt-4">
                <span class="text-caption text-grey100">FTE 강도</span>
                <div class="legend-gradient"></div>
                <div class="d-flex ga-2">
                  <span class="text-caption text-grey100">0</span>
                  <span class="text-caption text-grey100">4+</span>
                </div>
              </div>
              <div v-else class="text-center pa-6">
                <v-icon icon="mdi-table-large" size="48" color="grey-lighten-1" class="mb-2" />
                <p class="text-body-2 text-grey100 mb-0">FTE 데이터가 없습니다<br/>부서별 프로세스 실행 후 확인하세요</p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Domain 별 Sub Process Count -->
        <v-col cols="12" md="5">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <h3 class="text-h6 font-weight-semibold text-textPrimary">Domain별 Sub Process</h3>
                <v-chip size="small" color="warning" variant="tonal">
                  {{ domainData.reduce((a, b) => a + b.subProcessCount, 0) }}개
                </v-chip>
              </div>
              <div v-if="domainData.length > 0" class="domain-list">
                <div
                  v-for="item in domainData"
                  :key="item.domain"
                  class="domain-item"
                >
                  <div class="d-flex justify-space-between align-center mb-2">
                    <span class="text-body-2 text-textPrimary">{{ item.domain }}</span>
                    <span class="text-body-2 font-weight-bold text-textPrimary">{{ item.subProcessCount }}</span>
                  </div>
                  <v-progress-linear
                    :model-value="getBarWidth(item.subProcessCount)"
                    :color="item.color"
                    height="10"
                    rounded
                    bg-color="grey-lighten-3"
                  />
                </div>
              </div>
              <div v-else class="text-center pa-6">
                <v-icon icon="mdi-domain" size="48" color="grey-lighten-1" class="mb-2" />
                <p class="text-body-2 text-grey100 mb-0">프로세스 체계도에서<br/>Domain을 설정해주세요</p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts Row 3: 부서별 Task 수량 & Agent vs Human -->
      <v-row class="mb-2">
        <!-- 부서별 Task 수량 -->
        <v-col cols="12" md="7">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <h3 class="text-h6 font-weight-semibold text-textPrimary">부서별 Task 수량</h3>
                <div class="d-flex align-center ga-2">
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    color="grey"
                    :loading="syncing"
                    @click="syncDepartments"
                    title="조직도에서 부서 동기화"
                  >
                    <v-icon size="18">mdi-sync</v-icon>
                  </v-btn>
                  <v-chip size="small" color="primary" variant="tonal">
                    총 {{ totalDeptTasks }}건
                  </v-chip>
                </div>
              </div>
              <div v-if="canRenderDepartmentChart" class="chart-wrapper">
                <Bar
                  :chartData="safeDepartmentChartData"
                  :chartOptions="barChartOptions"
                />
              </div>
              <div v-else-if="loading" class="d-flex align-center justify-center" style="height: 150px;">
                <v-progress-circular indeterminate color="primary" />
              </div>
              <div v-else class="text-center pa-6">
                <v-icon icon="mdi-office-building-outline" size="48" color="grey-lighten-1" class="mb-2" />
                <p class="text-body-2 text-grey100 mb-0">부서별 데이터가 없습니다</p>
                <v-btn
                  color="primary"
                  variant="tonal"
                  size="small"
                  class="mt-3"
                  :loading="syncing"
                  @click="syncDepartments"
                >
                  <v-icon start size="16">mdi-sync</v-icon>
                  조직도에서 부서 동기화
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Agent vs Human 비교 -->
        <v-col cols="12" md="5">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <h3 class="text-h6 font-weight-semibold text-textPrimary">Agent vs Human</h3>
                <v-chip size="small" color="info" variant="tonal">성능 비교</v-chip>
              </div>
              <div v-if="hasAgentVsHumanData" class="comparison-grid">
                <!-- Agent Column -->
                <div class="comparison-col agent-col">
                  <div class="comparison-header">
                    <v-icon icon="mdi-robot" color="primary" size="20" class="mr-1" />
                    <span class="font-weight-semibold">Agent</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-primary">{{ getAgentStats?.total_tasks || 0 }}</span>
                    <span class="stat-label">Tasks</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-primary">{{ getAgentStats?.avg_duration_sec?.toFixed(0) || 0 }}초</span>
                    <span class="stat-label">평균 처리시간</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-success">{{ getAgentStats?.first_time_right_pct?.toFixed(1) || 0 }}%</span>
                    <span class="stat-label">First-Time-Right</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-error">{{ getAgentStats?.error_rate_pct?.toFixed(1) || 0 }}%</span>
                    <span class="stat-label">오류율</span>
                  </div>
                </div>

                <!-- VS Divider -->
                <div class="vs-divider">
                  <span class="vs-text">VS</span>
                </div>

                <!-- Human Column -->
                <div class="comparison-col human-col">
                  <div class="comparison-header">
                    <v-icon icon="mdi-account" color="indigo" size="20" class="mr-1" />
                    <span class="font-weight-semibold">Human</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-indigo">{{ getHumanStats?.total_tasks || 0 }}</span>
                    <span class="stat-label">Tasks</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-indigo">{{ getHumanStats?.avg_duration_sec?.toFixed(0) || 0 }}초</span>
                    <span class="stat-label">평균 처리시간</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-success">{{ getHumanStats?.first_time_right_pct?.toFixed(1) || 0 }}%</span>
                    <span class="stat-label">First-Time-Right</span>
                  </div>
                  <div class="comparison-stat">
                    <span class="stat-value text-error">{{ getHumanStats?.error_rate_pct?.toFixed(1) || 0 }}%</span>
                    <span class="stat-label">오류율</span>
                  </div>
                </div>
              </div>
              <div v-else class="text-center pa-6">
                <div v-if="loading">
                  <v-progress-circular indeterminate color="primary" />
                </div>
                <div v-else>
                  <v-icon icon="mdi-account-multiple-outline" size="48" color="grey-lighten-1" class="mb-2" />
                  <p class="text-body-2 text-grey100 mb-0">비교 데이터가 없습니다</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts Row 4: Process Performance & Bottleneck -->
      <v-row class="mb-2">
        <!-- 프로세스 성능 -->
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <h3 class="text-h6 font-weight-semibold text-textPrimary">프로세스 성능</h3>
                <v-chip size="small" color="success" variant="tonal">Cycle Time</v-chip>
              </div>
              <div v-if="processPerformanceData.length > 0" class="process-perf-list">
                <div
                  v-for="proc in processPerformanceData"
                  :key="proc.proc_def_id"
                  class="process-perf-item"
                >
                  <div class="d-flex justify-space-between align-center mb-1">
                    <span class="text-body-2 font-weight-medium text-textPrimary">
                      {{ proc.process_name || 'Unnamed' }}
                    </span>
                    <span class="text-caption text-grey100">
                      {{ proc.completed_instances }}/{{ proc.total_instances }} 완료
                    </span>
                  </div>
                  <div class="d-flex align-center ga-3 mb-2">
                    <v-progress-linear
                      :model-value="getCompletionRate(proc.completed_instances, proc.total_instances)"
                      color="success"
                      height="6"
                      rounded
                      bg-color="grey-lighten-3"
                      style="flex: 1"
                    />
                    <span class="text-caption font-weight-bold" style="min-width: 36px">
                      {{ getCompletionRate(proc.completed_instances, proc.total_instances) }}%
                    </span>
                  </div>
                  <div class="d-flex justify-space-between text-caption text-grey100">
                    <span>평균: {{ formatDuration(proc.avg_cycle_time_sec) }}</span>
                    <span>P95: {{ formatDuration(proc.p95_cycle_time_sec) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="text-center pa-6">
                <v-icon icon="mdi-chart-timeline-variant" size="48" color="grey-lighten-1" class="mb-2" />
                <p class="text-body-2 text-grey100 mb-0">성능 데이터가 없습니다</p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 병목 분석 -->
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="rounded-lg">
            <v-card-text class="pa-5">
              <div class="d-flex justify-space-between align-center mb-4">
                <h3 class="text-h6 font-weight-semibold text-textPrimary">병목 분석</h3>
                <v-chip size="small" color="error" variant="tonal">대기시간 Top 5</v-chip>
              </div>
              <div v-if="bottleneckData.length > 0" class="bottleneck-list">
                <div
                  v-for="(item, idx) in bottleneckData"
                  :key="idx"
                  class="bottleneck-item"
                >
                  <div class="d-flex align-center mb-2">
                    <v-avatar size="28" :color="idx === 0 ? 'error' : idx === 1 ? 'warning' : 'grey-lighten-1'" class="mr-3">
                      <span class="text-caption font-weight-bold" :class="idx < 2 ? 'text-white' : ''">{{ idx + 1 }}</span>
                    </v-avatar>
                    <div class="flex-grow-1">
                      <div class="text-body-2 font-weight-medium text-textPrimary">{{ item.activity_name }}</div>
                      <div class="text-caption text-grey100">{{ item.process_name }}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-body-2 font-weight-bold text-error">{{ formatDuration(item.avg_wait_time_sec) }}</div>
                      <div class="text-caption text-grey100">대기</div>
                    </div>
                  </div>
                  <div class="bottleneck-bar">
                    <div
                      class="bottleneck-bar-wait"
                      :style="{ width: getBottleneckBarWidth(item, 'wait') + '%' }"
                    ></div>
                    <div
                      class="bottleneck-bar-process"
                      :style="{ width: getBottleneckBarWidth(item, 'process') + '%' }"
                    ></div>
                  </div>
                  <div class="d-flex justify-space-between text-caption mt-1">
                    <span class="text-error">대기: {{ formatDuration(item.avg_wait_time_sec) }}</span>
                    <span class="text-primary">처리: {{ formatDuration(item.avg_processing_time_sec) }}</span>
                    <span class="text-grey100">{{ item.execution_count }}건</span>
                  </div>
                </div>
              </div>
              <div v-else class="text-center pa-6">
                <v-icon icon="mdi-traffic-cone" size="48" color="grey-lighten-1" class="mb-2" />
                <p class="text-body-2 text-grey100 mb-0">병목 데이터가 없습니다</p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recent Instances Table -->
      <v-card variant="outlined" class="rounded-lg">
        <v-card-text class="pa-0">
          <div class="d-flex justify-space-between align-center pa-5 pb-0">
            <h3 class="text-h6 font-weight-semibold text-textPrimary">최근 프로세스 인스턴스</h3>
            <v-btn variant="text" color="primary" size="small" to="/analytics/heatmap">
              더보기
              <v-icon end size="16">mdi-arrow-right</v-icon>
            </v-btn>
          </div>
          <v-table class="month-table" hover>
            <thead>
              <tr>
                <th class="text-subtitle-2 font-weight-semibold">인스턴스 ID</th>
                <th class="text-subtitle-2 font-weight-semibold">프로세스</th>
                <th class="text-subtitle-2 font-weight-semibold">상태</th>
                <th class="text-subtitle-2 font-weight-semibold">시작 시간</th>
                <th class="text-subtitle-2 font-weight-semibold">소요 시간</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="instance in store.instances" :key="instance.id" class="month-item">
                <td class="text-body-2 font-weight-medium text-textPrimary">
                  {{ instance.id?.slice(0, 8) }}...
                </td>
                <td class="text-body-2 text-grey100">{{ instance.process_name || 'Unnamed Process' }}</td>
                <td>
                  <v-chip
                    size="small"
                    :color="instance.status === 'completed' ? 'success' : 'warning'"
                    variant="tonal"
                  >
                    {{ instance.status }}
                  </v-chip>
                </td>
                <td class="text-body-2 text-grey100">{{ formatDateTime(instance.started_at) }}</td>
                <td class="text-body-2 font-weight-medium text-textPrimary">
                  {{ instance.duration_sec ? `${instance.duration_sec}초` : '-' }}
                </td>
              </tr>
              <tr v-if="!store.instances || store.instances.length === 0">
                <td colspan="5" class="text-center pa-8">
                  <v-icon icon="mdi-clipboard-text-outline" size="48" color="grey-lighten-1" class="mb-2" />
                  <p class="text-body-2 text-grey100 mb-0">데이터가 없습니다</p>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<style scoped>
/* Task Distribution Card - compact layout */
.task-distribution-card {
  height: auto !important;
}

/* Chart container - Chart.js requires position: relative */
.doughnut-wrapper {
  position: relative;
  width: 100%;
  max-width: 220px;
  margin: 0 auto;
}

/* Chart wrapper class for line/bar charts */
.chart-wrapper {
  position: relative;
  width: 100%;
}

/* Force canvas to fit within container */
.doughnut-wrapper :deep(canvas),
.chart-wrapper :deep(canvas) {
  max-width: 100% !important;
  max-height: 100% !important;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bg-primary {
  background-color: #0085db;
}

.bg-indigo {
  background-color: #8763da;
}

/* Heatmap Styles */
.heatmap-scroll {
  overflow-x: auto;
}

.heatmap-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 4px;
  min-width: 500px;
}

.heatmap-corner {
  width: 90px;
}

.heatmap-header {
  font-size: 12px;
  font-weight: 500;
  color: #707a82;
  text-align: center;
  padding: 8px 4px;
  white-space: nowrap;
}

.heatmap-row-label {
  font-size: 13px;
  font-weight: 500;
  color: #2A3547;
  text-align: left;
  padding: 8px 12px 8px 0;
  white-space: nowrap;
}

.heatmap-cell {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  padding: 14px 10px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.heatmap-cell:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 133, 219, 0.25);
}

.legend-gradient {
  width: 80px;
  height: 10px;
  background: linear-gradient(90deg, rgba(0, 133, 219, 0.08), rgba(0, 133, 219, 0.85));
  border-radius: 5px;
}

/* Domain List */
.domain-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.domain-item {
  transition: transform 0.2s ease;
}

.domain-item:hover {
  transform: translateX(4px);
}

/* Table adjustments */
.month-table {
  background: transparent !important;
}

.month-table th {
  background: rgb(var(--v-theme-background)) !important;
  color: #2A3547 !important;
  border-bottom: 1px solid #e5eaef !important;
}

.month-table td {
  border-bottom: 1px solid #e5eaef !important;
}

.month-item td {
  padding-top: 16px !important;
  padding-bottom: 16px !important;
}

/* Agent vs Human Comparison */
.comparison-grid {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.comparison-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comparison-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
}

.agent-col .comparison-header {
  background: rgba(0, 133, 219, 0.1);
  color: #0085db;
}

.human-col .comparison-header {
  background: rgba(135, 99, 218, 0.1);
  color: #8763da;
}

.comparison-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 11px;
  color: #707a82;
  margin-top: 2px;
}

.vs-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  flex-shrink: 0;
}

.vs-text {
  font-size: 12px;
  font-weight: 700;
  color: #adb5bd;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 50%;
}

.text-indigo {
  color: #8763da !important;
}

/* Process Performance */
.process-perf-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.process-perf-item {
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.process-perf-item:hover {
  background: rgba(0, 133, 219, 0.05);
}

/* Bottleneck Analysis */
.bottleneck-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bottleneck-item {
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.bottleneck-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f5f5;
}

.bottleneck-bar-wait {
  background: linear-gradient(90deg, #ff5252, #ff8a80);
  transition: width 0.3s ease;
}

.bottleneck-bar-process {
  background: linear-gradient(90deg, #0085db, #42a5f5);
  transition: width 0.3s ease;
}
</style>
