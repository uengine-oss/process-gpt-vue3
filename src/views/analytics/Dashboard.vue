<script setup>
/**
 * Analytics Dashboard
 * 프로세스 실행 요약 통계 및 차트
 */
import { onMounted, computed, ref } from 'vue'
import { useOlapStore } from '@/stores/analytics/olapStore'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js'
import { Doughnut, Line } from 'vue-chartjs'
import dayjs from 'dayjs'

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement)

const store = useOlapStore()
const loading = ref(false)

// Chart data - same pattern as reference project
const chartData = ref({
  taskDistribution: null,
  monthlyTrend: null
})

async function refresh() {
  loading.value = true
  try {
    await Promise.all([
      store.fetchDashboardSummary(),
      store.fetchInstances({ limit: 10 })
    ])

    // Update chart data after API call
    const summary = store.dashboardSummary
    const inst = summary?.instances || {}

    // Update task distribution chart
    chartData.value.taskDistribution = {
      labels: ['Agent Tasks', 'Human Tasks'],
      datasets: [{
        data: [inst.agent_tasks || 0, inst.human_tasks || 0],
        backgroundColor: ['#06b6d4', '#8b5cf6'],
        borderWidth: 0
      }]
    }

    // Update monthly trend chart
    chartData.value.monthlyTrend = {
      labels: ['1월', '2월', '3월', '4월', '5월', '6월'],
      datasets: [{
        label: 'Tasks',
        data: [65, 78, 90, 81, 95, 110],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: true,
        tension: 0.4
      }]
    }
  } catch (e) {
    console.error('[Dashboard] refresh 에러:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()
})

// Stats cards data
const statsCards = computed(() => {
  const summary = store.dashboardSummary
  if (!summary) return []

  return [
    {
      title: '프로세스 인스턴스',
      value: summary.instances?.total || 0,
      subtitle: `완료: ${summary.instances?.completed || 0} / 실행중: ${summary.instances?.running || 0}`,
      icon: 'mdi-cog-outline',
      color: 'primary'
    },
    {
      title: '전체 Tasks',
      value: summary.tasks?.total_tasks || 0,
      subtitle: `평균 처리시간: ${Math.round(summary.tasks?.avg_duration_sec || 0)}초`,
      icon: 'mdi-checkbox-marked-circle-outline',
      color: 'success'
    },
    {
      title: 'Agent Tasks',
      value: summary.instances?.agent_tasks || 0,
      subtitle: `Human: ${summary.instances?.human_tasks || 0}`,
      icon: 'mdi-robot',
      color: 'info'
    },
    {
      title: 'LLM 사용량',
      value: formatTokens(summary.usage?.total_tokens || 0),
      subtitle: `비용: $${(summary.usage?.total_cost || 0).toFixed(2)}`,
      icon: 'mdi-lightning-bolt',
      color: 'warning'
    }
  ]
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom'
    }
  }
}

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
}

function formatTokens(tokens) {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + 'M'
  } else if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K'
  }
  return tokens.toString()
}

function formatDateTime(timestamp) {
  return dayjs(timestamp).format('MM/DD HH:mm')
}
</script>

<template>
  <v-row class="justify-center ma-0 pa-0">
    <v-col cols="12" class="pa-0">
      <v-card elevation="10" class="is-work-height">
        <!-- Header -->
        <div class="d-flex justify-space-between align-center px-6 py-4">
          <div>
            <h1 class="text-h5 font-weight-bold">Analytics Dashboard</h1>
            <p class="text-body-2 text-medium-emphasis mb-0">프로세스 실행 현황 및 분석</p>
          </div>
          <v-btn
            variant="text"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="refresh"
          >
            새로고침
          </v-btn>
        </div>
        <v-divider />

        <!-- Content -->
        <div class="pa-6" style="overflow: auto; height: calc(100vh - 200px);">
          <!-- Stats Cards -->
          <v-row class="mb-4">
            <v-col v-for="card in statsCards" :key="card.title" cols="12" sm="6" lg="3">
              <div class="d-flex align-center pa-3 rounded border">
                <v-avatar :color="card.color" variant="tonal" size="40" class="mr-3">
                  <v-icon :icon="card.icon" size="20" />
                </v-avatar>
                <div>
                  <div class="text-h6 font-weight-bold">{{ card.value }}</div>
                  <div class="text-body-2">{{ card.title }}</div>
                  <div class="text-caption text-medium-emphasis">{{ card.subtitle }}</div>
                </div>
              </div>
            </v-col>
          </v-row>

          <!-- Charts Row -->
          <v-row class="mb-4">
            <!-- Task Distribution -->
            <v-col cols="12" md="4">
              <div class="pa-4 rounded border">
                <div class="text-subtitle-2 font-weight-medium mb-3">Task 배분</div>
                <div style="height: 220px;">
                  <Doughnut
                    v-if="chartData.taskDistribution"
                    :data="chartData.taskDistribution"
                    :options="chartOptions"
                  />
                  <div v-else class="d-flex align-center justify-center h-100">
                    <v-progress-circular indeterminate color="primary" size="24" />
                  </div>
                </div>
              </div>
            </v-col>

            <!-- Monthly Trend -->
            <v-col cols="12" md="8">
              <div class="pa-4 rounded border">
                <div class="text-subtitle-2 font-weight-medium mb-3">월별 Task 추이</div>
                <div style="height: 220px;">
                  <Line
                    v-if="chartData.monthlyTrend"
                    :data="chartData.monthlyTrend"
                    :options="lineChartOptions"
                  />
                  <div v-else class="d-flex align-center justify-center h-100">
                    <v-progress-circular indeterminate color="primary" size="24" />
                  </div>
                </div>
              </div>
            </v-col>
          </v-row>

          <!-- Recent Instances -->
          <div class="rounded border">
            <div class="d-flex justify-space-between align-center pa-4">
              <span class="text-subtitle-2 font-weight-medium">최근 프로세스 인스턴스</span>
              <v-btn variant="text" size="small" to="/analytics/pivot">
                더보기
                <v-icon end size="16">mdi-arrow-right</v-icon>
              </v-btn>
            </div>
            <v-divider />
            <v-table density="compact" hover>
              <thead>
                <tr>
                  <th>인스턴스 ID</th>
                  <th>프로세스</th>
                  <th>상태</th>
                  <th>시작 시간</th>
                  <th>소요 시간</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="instance in store.instances" :key="instance.id">
                  <td class="font-weight-medium">{{ instance.id?.slice(0, 8) }}...</td>
                  <td>{{ instance.process_name || '-' }}</td>
                  <td>
                    <v-chip
                      size="x-small"
                      :color="instance.status === 'completed' ? 'success' : 'warning'"
                      variant="tonal"
                    >
                      {{ instance.status }}
                    </v-chip>
                  </td>
                  <td class="text-medium-emphasis">{{ formatDateTime(instance.started_at) }}</td>
                  <td>{{ instance.duration_sec ? `${instance.duration_sec}초` : '-' }}</td>
                </tr>
                <tr v-if="store.instances.length === 0">
                  <td colspan="5" class="text-center text-medium-emphasis pa-4">
                    데이터가 없습니다
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>
