<script setup lang="ts">
/**
 * Performance Analysis Page
 * Agent vs Human 퍼포먼스 비교 분석
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useOlapStore } from '@/stores/analytics/olapStore'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Bar } from 'vue-chartjs'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const store = useOlapStore()

// Chart data as refs (null until ready)
const f1ChartData = ref<any>(null)
const taskCountChartData = ref<any>(null)

// Filters
const selectedYear = ref(new Date().getFullYear())
const selectedQuarter = ref<number | null>(null)

const years = computed(() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => currentYear - i)
})

const quarters = [
  { value: null, title: '전체' },
  { value: 1, title: 'Q1' },
  { value: 2, title: 'Q2' },
  { value: 3, title: 'Q3' },
  { value: 4, title: 'Q4' }
]

const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

const updateChartData = () => {
  const agentF1 = Array(12).fill(0)
  const humanF1 = Array(12).fill(0)
  const agentCount = Array(12).fill(0)
  const humanCount = Array(12).fill(0)

  store.performanceData.forEach((d: any) => {
    const monthIdx = (d.month || 1) - 1
    if (d.performer_type === 'AGENT') {
      agentF1[monthIdx] = d.avg_f1 || 0
      agentCount[monthIdx] = d.task_count || 0
    } else {
      humanF1[monthIdx] = d.avg_f1 || 0
      humanCount[monthIdx] = d.task_count || 0
    }
  })

  f1ChartData.value = {
    labels: months,
    datasets: [
      {
        label: 'Agent',
        data: agentF1,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Human',
        data: humanF1,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  taskCountChartData.value = {
    labels: months,
    datasets: [
      {
        label: 'Agent',
        data: agentCount,
        backgroundColor: '#06b6d4'
      },
      {
        label: 'Human',
        data: humanCount,
        backgroundColor: '#8b5cf6'
      }
    ]
  }
}

onMounted(async () => {
  await fetchData()
})

watch([selectedYear, selectedQuarter], async () => {
  await fetchData()
})

async function fetchData() {
  const params: any = { year: selectedYear.value }
  if (selectedQuarter.value) {
    params.quarter = selectedQuarter.value
  }
  await store.fetchPerformance(params)
  updateChartData()
}

// Computed stats
const agentStats = computed(() => {
  const data = store.performanceData.filter((d: any) => d.performer_type === 'AGENT')
  if (data.length === 0) return { taskCount: 0, avgF1: 0, avgDuration: 0, errorCount: 0 }

  return {
    taskCount: data.reduce((sum: number, d: any) => sum + (d.task_count || 0), 0),
    avgF1: data.reduce((sum: number, d: any) => sum + (d.avg_f1 || 0), 0) / data.length,
    avgDuration: data.reduce((sum: number, d: any) => sum + (d.avg_duration_sec || 0), 0) / data.length,
    errorCount: data.reduce((sum: number, d: any) => sum + (d.error_count || 0), 0)
  }
})

const humanStats = computed(() => {
  const data = store.performanceData.filter((d: any) => d.performer_type === 'HUMAN')
  if (data.length === 0) return { taskCount: 0, avgF1: 0, avgDuration: 0, errorCount: 0 }

  return {
    taskCount: data.reduce((sum: number, d: any) => sum + (d.task_count || 0), 0),
    avgF1: data.reduce((sum: number, d: any) => sum + (d.avg_f1 || 0), 0) / data.length,
    avgDuration: data.reduce((sum: number, d: any) => sum + (d.avg_duration_sec || 0), 0) / data.length,
    errorCount: data.reduce((sum: number, d: any) => sum + (d.error_count || 0), 0)
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
}
</script>

<template>
  <v-row class="justify-center ma-0 pa-0">
    <v-col cols="12" class="pa-0">
      <v-card elevation="10" class="is-work-height">
        <!-- Header -->
        <div class="d-flex justify-space-between align-center px-6 py-4">
          <div>
            <h1 class="text-h5 font-weight-bold">퍼포먼스 분석</h1>
            <p class="text-body-2 text-medium-emphasis mb-0">Agent vs Human 성과 비교</p>
          </div>
          <div class="d-flex ga-2">
            <v-select
              v-model="selectedYear"
              :items="years"
              label="연도"
              variant="outlined"
              density="compact"
              hide-details
              style="width: 100px;"
            />
            <v-select
              v-model="selectedQuarter"
              :items="quarters"
              item-value="value"
              item-title="title"
              label="분기"
              variant="outlined"
              density="compact"
              hide-details
              style="width: 100px;"
            />
          </div>
        </div>
        <v-divider />

        <!-- Content -->
        <div class="pa-6" style="overflow: auto; height: calc(100vh - 200px);">
          <!-- Stats Cards -->
          <v-row class="mb-4">
            <!-- Agent Stats -->
            <v-col cols="12" md="6">
              <div class="pa-4 rounded border" style="background-color: rgba(6, 182, 212, 0.05);">
                <div class="d-flex align-center mb-3">
                  <v-icon color="cyan" class="mr-2">mdi-robot</v-icon>
                  <span class="text-subtitle-2 font-weight-medium">Agent 성과</span>
                </div>
                <v-row>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-cyan">{{ agentStats.taskCount }}</div>
                    <div class="text-caption text-medium-emphasis">처리 건수</div>
                  </v-col>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-cyan">{{ (agentStats.avgF1 * 100).toFixed(1) }}%</div>
                    <div class="text-caption text-medium-emphasis">평균 F1</div>
                  </v-col>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-cyan">{{ agentStats.avgDuration.toFixed(0) }}초</div>
                    <div class="text-caption text-medium-emphasis">평균 처리시간</div>
                  </v-col>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-cyan">{{ agentStats.errorCount }}</div>
                    <div class="text-caption text-medium-emphasis">에러 건수</div>
                  </v-col>
                </v-row>
              </div>
            </v-col>

            <!-- Human Stats -->
            <v-col cols="12" md="6">
              <div class="pa-4 rounded border" style="background-color: rgba(139, 92, 246, 0.05);">
                <div class="d-flex align-center mb-3">
                  <v-icon color="deep-purple" class="mr-2">mdi-account</v-icon>
                  <span class="text-subtitle-2 font-weight-medium">Human 성과</span>
                </div>
                <v-row>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-deep-purple">{{ humanStats.taskCount }}</div>
                    <div class="text-caption text-medium-emphasis">처리 건수</div>
                  </v-col>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-deep-purple">{{ (humanStats.avgF1 * 100).toFixed(1) }}%</div>
                    <div class="text-caption text-medium-emphasis">평균 F1</div>
                  </v-col>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-deep-purple">{{ humanStats.avgDuration.toFixed(0) }}초</div>
                    <div class="text-caption text-medium-emphasis">평균 처리시간</div>
                  </v-col>
                  <v-col cols="6" sm="3">
                    <div class="text-h6 font-weight-bold text-deep-purple">{{ humanStats.errorCount }}</div>
                    <div class="text-caption text-medium-emphasis">에러 건수</div>
                  </v-col>
                </v-row>
              </div>
            </v-col>
          </v-row>

          <!-- Charts -->
          <v-row>
            <v-col cols="12" md="6">
              <div class="pa-4 rounded border">
                <div class="text-subtitle-2 font-weight-medium mb-3">F1 Score 추이</div>
                <div style="height: 280px;">
                  <Line
                    v-if="f1ChartData"
                    :data="f1ChartData"
                    :options="chartOptions"
                  />
                  <div v-else class="d-flex align-center justify-center h-100">
                    <v-progress-circular indeterminate color="primary" size="24" />
                  </div>
                </div>
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <div class="pa-4 rounded border">
                <div class="text-subtitle-2 font-weight-medium mb-3">Task 처리 건수</div>
                <div style="height: 280px;">
                  <Bar
                    v-if="taskCountChartData"
                    :data="taskCountChartData"
                    :options="chartOptions"
                  />
                  <div v-else class="d-flex align-center justify-center h-100">
                    <v-progress-circular indeterminate color="primary" size="24" />
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>
        </div>

        <!-- Loading -->
        <v-overlay :model-value="store.loading" class="align-center justify-center" contained>
          <v-progress-circular indeterminate color="primary" size="64" />
        </v-overlay>
      </v-card>
    </v-col>
  </v-row>
</template>
