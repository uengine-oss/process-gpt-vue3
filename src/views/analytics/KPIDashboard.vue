<script setup lang="ts">
/**
 * KPI Dashboard
 * KPI 달성률, 프로세스 파이프라인, 도메인 진도, 주간 배포 속도
 */
import { onMounted, ref, shallowRef, computed, getCurrentInstance, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Filler
} from 'chart.js';
import { Doughnut, Line, Bar } from 'vue-chartjs';
import { useKpiStore } from '@/stores/analytics/kpiStore';
import { useStrategyStore } from '@/stores/strategy/strategyStore';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler);

const router = useRouter();
const instance = getCurrentInstance();
const t = (key: string) => instance?.proxy?.$t(key) || key;
const store = useKpiStore();

const loading = ref(true);
const chartsReady = ref(false);

// ============== Chart Data (shallowRef for vue-chartjs) ==============

const achievementChartData = shallowRef({
    labels: ['Published', 'Remaining'],
    datasets: [
        {
            data: [0, 100],
            backgroundColor: ['#4caf50', '#e0e0e0'],
            borderWidth: 0,
            cutout: '75%'
        }
    ]
});

const domainChartData = shallowRef({
    labels: [] as string[],
    datasets: [
        { label: 'Target', data: [] as number[], backgroundColor: 'rgba(158, 158, 158, 0.5)', borderRadius: 4 },
        { label: 'Actual', data: [] as number[], backgroundColor: 'rgba(76, 175, 80, 0.8)', borderRadius: 4 }
    ]
});

const velocityChartData = shallowRef({
    labels: [] as string[],
    datasets: [
        {
            label: 'Deployments',
            data: [] as number[],
            borderColor: '#4caf50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#4caf50',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
        }
    ]
});

// ============== Chart Options ==============

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } }
};

const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: true, position: 'top' as const }
    },
    scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
};

const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
};

// ============== Computed ==============

const remainingCount = computed(() => {
    const target = store.currentTarget?.total_target || 0;
    const published = store.pipeline?.published_count || 0;
    return Math.max(0, target - published);
});

const canRenderDoughnut = computed(() => {
    if (!chartsReady.value) return false;
    const d = achievementChartData.value;
    return d && d.datasets && d.datasets.length > 0;
});

const canRenderDomainChart = computed(() => {
    if (!chartsReady.value) return false;
    const d = domainChartData.value;
    return d && d.labels && d.labels.length > 0;
});

const canRenderVelocityChart = computed(() => {
    if (!chartsReady.value) return false;
    const d = velocityChartData.value;
    return d && d.labels && d.labels.length > 0;
});

// ============== Helpers ==============

function pipelinePercent(type: string) {
    const total = store.pipeline?.total_processes || 1;
    if (type === 'draft') return ((store.pipeline?.draft_count || 0) / total) * 100;
    if (type === 'review') return ((store.pipeline?.review_count || 0) / total) * 100;
    if (type === 'published') return ((store.pipeline?.published_count || 0) / total) * 100;
    return 0;
}

// ============== Strategy 목표달성도 (strategy 서비스 연동) ==============

const strategyStore = useStrategyStore();
const PERSPECTIVE_COLORS: Record<string, string> = {
    financial: '#1565c0',
    customer: '#2e7d32',
    internal_process: '#e65100',
    learning_growth: '#6a1b9a'
};

// 측정된 목표들의 평균 달성률 (전략 종합 달성도)
const strategyOverall = computed(() => {
    const rates = strategyStore.objectives.map((o: any) => o.achievement).filter((r: any) => r != null);
    if (!rates.length) return null;
    return Math.round((rates.reduce((a: number, b: number) => a + b, 0) / rates.length) * 10) / 10;
});

function strategyBarColor(rate: number | null) {
    if (rate == null) return 'grey';
    if (rate >= 100) return 'success';
    if (rate >= 70) return 'primary';
    if (rate >= 40) return 'warning';
    return 'error';
}

// ============== Data Loading ==============

async function loadData() {
    loading.value = true;
    chartsReady.value = false;
    try {
        await store.fetchAll();
        updateCharts();
    } catch (e) {
        console.error('KPI loadData error:', e);
    } finally {
        loading.value = false;
        await nextTick();
        chartsReady.value = true;
    }
    // 전략 서비스는 별도 기동이므로 실패해도 대시보드 본체에 영향 없게 분리
    try {
        await strategyStore.loadMap();
    } catch (e) {
        console.warn('strategy map load skipped:', e);
    }
}

function updateCharts() {
    // Achievement chart
    const published = store.pipeline?.published_count || 0;
    const target = store.currentTarget?.total_target || 0;
    const remaining = Math.max(0, target - published);
    achievementChartData.value = {
        labels: ['Published', 'Remaining'],
        datasets: [
            {
                data: [published, remaining || (target === 0 ? 1 : 0)],
                backgroundColor: ['#4caf50', '#e0e0e0'],
                borderWidth: 0,
                cutout: '75%'
            }
        ]
    };

    // Domain progress chart
    const domainData = store.domainProgress || [];
    const domainLabels = domainData.map((d) => d.domain_name || d.domain_id);
    const domainTargets = domainData.map((d) => d.target || 0);
    const domainActual = domainData.map((d) => d.published_count);
    domainChartData.value = {
        labels: domainLabels,
        datasets: [
            { label: t('analytics.target'), data: domainTargets, backgroundColor: 'rgba(158,158,158,0.5)', borderRadius: 4 },
            { label: t('analytics.currentPublished'), data: domainActual, backgroundColor: 'rgba(76,175,80,0.8)', borderRadius: 4 }
        ]
    };

    // Weekly velocity chart
    const weekData = store.weeklyVelocity || [];
    const weekLabels = weekData.map((_: any, i: number) => `W${i + 1}`);
    const weekValues = weekData.map((w: any) => w.deployments);
    velocityChartData.value = {
        labels: weekLabels,
        datasets: [
            {
                label: 'Deployments',
                data: weekValues,
                borderColor: '#4caf50',
                backgroundColor: 'rgba(76,175,80,0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#4caf50',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ]
    };
}

onMounted(loadData);
</script>

<template>
    <v-card elevation="0" class="kpi-dashboard-page" style="overflow: auto; height: 100%">
        <!-- Header -->
        <div class="d-flex align-center justify-space-between mb-4 px-2">
            <div>
                <h2 class="text-h5 font-weight-bold">{{ $t('analytics.kpi') }}</h2>
            </div>
            <div class="d-flex align-center gap-3">
                <v-btn variant="outlined" size="small" @click="router.push('/strategy-board')">
                    <v-icon start size="16">mdi-map-outline</v-icon>
                    {{ $t('analytics.strategyBoard') }}
                </v-btn>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="d-flex justify-center py-12">
            <v-progress-circular indeterminate color="primary" />
        </div>

        <!-- Dashboard Cards -->
        <v-row v-else>
            <!-- 전략 목표달성도 (Strategy Board 연동) -->
            <v-col v-if="strategyStore.objectives.length" cols="12">
                <v-card variant="outlined" rounded="lg" class="pa-4" data-testid="strategy-achievement-card">
                    <div class="d-flex align-center justify-space-between mb-3">
                        <span class="text-subtitle-1 font-weight-bold">{{ $t('strategyBoard.dashboardTitle') }}</span>
                        <div class="d-flex align-center ga-3">
                            <template v-if="strategyOverall != null">
                                <span class="text-caption text-medium-emphasis">{{ $t('strategyBoard.overall') }}</span>
                                <span class="text-h6 font-weight-bold" :class="`text-${strategyBarColor(strategyOverall)}`">
                                    {{ strategyOverall }}%
                                </span>
                            </template>
                            <v-btn variant="text" size="small" color="primary" @click="router.push('/strategy-board')">
                                {{ $t('analytics.strategyBoard') }}
                                <v-icon end size="14">mdi-arrow-right</v-icon>
                            </v-btn>
                        </div>
                    </div>
                    <v-row dense>
                        <v-col v-for="objective in strategyStore.objectives" :key="objective.id" cols="12" sm="6" md="3">
                            <div class="pa-2">
                                <div class="d-flex align-center justify-space-between mb-1">
                                    <span class="text-body-2 font-weight-medium text-truncate" style="max-width: 70%">
                                        {{ objective.name }}
                                    </span>
                                    <span class="text-caption font-weight-bold" :class="`text-${strategyBarColor(objective.achievement)}`">
                                        {{ objective.achievement != null ? objective.achievement + '%' : $t('strategyBoard.notMeasured') }}
                                    </span>
                                </div>
                                <v-progress-linear
                                    :model-value="Math.min(objective.achievement || 0, 100)"
                                    :color="strategyBarColor(objective.achievement)"
                                    height="6"
                                    rounded
                                />
                                <span class="text-caption text-medium-emphasis" :style="{ color: PERSPECTIVE_COLORS[objective.perspective] }">
                                    {{ $t(`strategyBoard.perspectives.${objective.perspective}`) }}
                                </span>
                            </div>
                        </v-col>
                    </v-row>
                </v-card>
            </v-col>

            <!-- KPI Achievement (Doughnut) -->
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg" class="pa-4">
                    <div class="d-flex align-center justify-space-between mb-3">
                        <span class="text-subtitle-1 font-weight-bold">{{ $t('analytics.kpiAchievement') }}</span>
                        <v-chip :color="store.isAtRisk ? 'error' : 'success'" variant="tonal" size="small">
                            {{ store.isAtRisk ? $t('analytics.atRisk') : 'On Track' }}
                        </v-chip>
                    </div>
                    <div class="d-flex align-center">
                        <div style="width: 160px; height: 160px; position: relative">
                            <Doughnut v-if="canRenderDoughnut" :chartData="achievementChartData" :chartOptions="doughnutOptions" />
                            <div class="doughnut-center-text">
                                <span class="text-h5 font-weight-bold">{{ store.achievementRate }}%</span>
                            </div>
                        </div>
                        <div class="ml-6">
                            <div class="mb-2">
                                <span class="text-caption text-medium-emphasis">{{ $t('analytics.target') }}</span>
                                <div class="text-h6 font-weight-bold">{{ store.currentTarget?.total_target || 0 }}</div>
                            </div>
                            <div class="mb-2">
                                <span class="text-caption text-medium-emphasis">{{ $t('analytics.currentPublished') }}</span>
                                <div class="text-h6 font-weight-bold text-success">{{ store.pipeline?.published_count || 0 }}</div>
                            </div>
                            <div>
                                <span class="text-caption text-medium-emphasis">{{ $t('analytics.remaining') }}</span>
                                <div class="text-h6 font-weight-bold text-grey">{{ remainingCount }}</div>
                            </div>
                        </div>
                    </div>
                </v-card>
            </v-col>

            <!-- Process Pipeline -->
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg" class="pa-4">
                    <span class="text-subtitle-1 font-weight-bold mb-3 d-block">{{ $t('analytics.processPipeline') }}</span>
                    <div class="pipeline-bars">
                        <div class="pipeline-item mb-4">
                            <div class="d-flex justify-space-between mb-1">
                                <span class="text-body-2">{{ $t('reviewBoard.draft') }}</span>
                                <span class="text-body-2 font-weight-bold">{{ store.pipeline?.draft_count || 0 }}</span>
                            </div>
                            <v-progress-linear :model-value="pipelinePercent('draft')" color="grey" height="8" rounded />
                        </div>
                        <div class="pipeline-item mb-4">
                            <div class="d-flex justify-space-between mb-1">
                                <span class="text-body-2">{{ $t('reviewBoard.review') }}</span>
                                <span class="text-body-2 font-weight-bold">{{ store.pipeline?.review_count || 0 }}</span>
                            </div>
                            <v-progress-linear :model-value="pipelinePercent('review')" color="warning" height="8" rounded />
                        </div>
                        <div class="pipeline-item mb-4">
                            <div class="d-flex justify-space-between mb-1">
                                <span class="text-body-2">{{ $t('reviewBoard.published') }}</span>
                                <span class="text-body-2 font-weight-bold">{{ store.pipeline?.published_count || 0 }}</span>
                            </div>
                            <v-progress-linear :model-value="pipelinePercent('published')" color="success" height="8" rounded />
                        </div>
                    </div>
                    <div class="text-caption text-medium-emphasis mt-2">
                        {{ $t('analytics.publishedNote') }}
                    </div>
                </v-card>
            </v-col>

            <!-- Domain Progress (Grouped Bar) -->
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg" class="pa-4">
                    <span class="text-subtitle-1 font-weight-bold mb-3 d-block">{{ $t('analytics.domainProgress') }}</span>
                    <div style="height: 280px">
                        <Bar v-if="canRenderDomainChart" :chartData="domainChartData" :chartOptions="barOptions" />
                        <div v-else-if="chartsReady" class="d-flex justify-center align-center" style="height: 100%">
                            <div class="text-center">
                                <v-icon size="40" color="grey-lighten-2">mdi-chart-bar</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">
                                    {{ $t('analytics.noData') || 'No data available' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </v-card>
            </v-col>

            <!-- Weekly Velocity (Line) -->
            <v-col cols="12" md="6">
                <v-card variant="outlined" rounded="lg" class="pa-4">
                    <div class="d-flex align-center justify-space-between mb-3">
                        <span class="text-subtitle-1 font-weight-bold">{{ $t('analytics.weeklyVelocity') }}</span>
                        <v-chip color="success" variant="tonal" size="small">
                            {{ $t('analytics.avgWeeklyDeployment') }} {{ store.avgWeeklyDeployment }}
                        </v-chip>
                    </div>
                    <div style="height: 280px">
                        <Line v-if="canRenderVelocityChart" :chartData="velocityChartData" :chartOptions="lineOptions" />
                        <div v-else-if="chartsReady" class="d-flex justify-center align-center" style="height: 100%">
                            <div class="text-center">
                                <v-icon size="40" color="grey-lighten-2">mdi-chart-line</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">
                                    {{ $t('analytics.noData') || 'No data available' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </v-card>
            </v-col>
        </v-row>
    </v-card>
</template>

<style scoped>
.kpi-dashboard-page {
    padding: 24px;
    background: #fafafa;
}

.doughnut-center-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
}
</style>
