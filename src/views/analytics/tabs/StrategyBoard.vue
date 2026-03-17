<script setup lang="ts">
/**
 * Tab A: Strategy Board
 * KPI 진도 관리 — Chart.js 기반
 */
import { onMounted, ref, shallowRef, computed, watch, getCurrentInstance, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js'
import { Doughnut, Line } from 'vue-chartjs'
import { useKpiStore } from '@/stores/analytics/kpiStore'
import { useAnalysisDashboardStore } from '@/stores/analytics/analysisDashboardStore'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler)

const props = defineProps<{
    filters: { domains: string[]; orgId: string; dateRange: string; comparisonMode: boolean }
}>()

const router = useRouter()
const instance = getCurrentInstance()
const t = (key: string) => instance?.proxy?.$t(key) || key

const kpiStore = useKpiStore()
const dashboardStore = useAnalysisDashboardStore()
const chartsReady = ref(false)
const expandedDomains = ref<string[]>([])

// ============== Color Palette ==============
const colors = {
    published: '#2e7d32',
    publishedLight: 'rgba(46, 125, 50, 0.08)',
    review: '#ed6c02',
    reviewLight: 'rgba(237, 108, 2, 0.08)',
    draft: '#9e9e9e',
    draftLight: 'rgba(158, 158, 158, 0.08)',
    remaining: '#f0f0f0',
    velocity: '#1565c0',
    velocityFill: 'rgba(21, 101, 192, 0.06)',
}

// ============== Chart Data ==============
const achievementChartData = shallowRef({
    labels: ['Published', 'Remaining'],
    datasets: [{
        data: [0, 100],
        backgroundColor: [colors.published, colors.remaining],
        borderWidth: 0,
        cutout: '78%',
        borderRadius: 2,
    }]
})

const velocityChartData = shallowRef({
    labels: [] as string[],
    datasets: [{
        label: 'Deployments',
        data: [] as number[],
        borderColor: colors.velocity,
        backgroundColor: colors.velocityFill,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: colors.velocity,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2.5,
    }]
})

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { animateRotate: true, duration: 800 },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(33, 33, 33, 0.9)',
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 12, weight: '600' as const },
            bodyFont: { size: 12 },
        }
    }
}

const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(33, 33, 33, 0.9)',
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 12, weight: '600' as const },
            bodyFont: { size: 12 },
        }
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#9e9e9e' },
            border: { display: false },
        },
        y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 11 }, color: '#9e9e9e', padding: 8 },
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            border: { display: false },
        }
    }
}

// ============== Computed ==============
const publishedCount = computed(() => kpiStore.pipeline?.published_count || 0)
const totalTarget = computed(() => kpiStore.currentTarget?.total_target || 0)
const achievementRate = computed(() => kpiStore.achievementRate)
const remainingCount = computed(() => Math.max(0, totalTarget.value - publishedCount.value))

const achievementColor = computed(() => {
    const rate = achievementRate.value
    if (rate >= 75) return colors.published
    if (rate >= 50) return colors.review
    return '#c62828'
})

const achievementLabel = computed(() => {
    const rate = achievementRate.value
    if (rate >= 75) return 'On Track'
    if (rate >= 50) return 'Moderate'
    return 'At Risk'
})

const filteredDomainProgress = computed(() => {
    const domains = kpiStore.domainProgress || []
    if (props.filters.domains.length === 0) return domains
    return domains.filter(d => props.filters.domains.includes(d.domain_id))
})

// Pipeline funnel
const pipeline = computed(() => kpiStore.pipeline)
const draftToReviewRate = computed(() => {
    if (!pipeline.value) return 0
    const total = pipeline.value.draft_count + pipeline.value.in_review_count + pipeline.value.published_count
    if (total === 0) return 0
    return Math.round(((pipeline.value.in_review_count + pipeline.value.published_count) / total) * 100)
})
const reviewToPublishedRate = computed(() => {
    if (!pipeline.value) return 0
    const reviewTotal = pipeline.value.in_review_count + pipeline.value.published_count
    if (reviewTotal === 0) return 0
    return Math.round((pipeline.value.published_count / reviewTotal) * 100)
})

// Weekly velocity
const avgVelocity = computed(() => kpiStore.avgWeeklyDeployment)
const etaWeeks = computed(() => {
    if (avgVelocity.value <= 0) return null
    return Math.ceil(remainingCount.value / avgVelocity.value)
})

function updateCharts() {
    const pub = publishedCount.value
    const rem = remainingCount.value
    achievementChartData.value = {
        labels: ['Published', 'Remaining'],
        datasets: [{
            data: [pub, rem],
            backgroundColor: [achievementColor.value, colors.remaining],
            borderWidth: 0,
            cutout: '78%',
            borderRadius: 2,
        }]
    }

    const velocity = kpiStore.weeklyVelocity || []
    velocityChartData.value = {
        labels: velocity.map(w => {
            const d = new Date(w.week_start)
            return `${d.getMonth() + 1}/${d.getDate()}`
        }),
        datasets: [{
            label: 'Deployments',
            data: velocity.map(w => w.deployments),
            borderColor: colors.velocity,
            backgroundColor: colors.velocityFill,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: colors.velocity,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
        }]
    }
    chartsReady.value = true
}

async function toggleDomainExpand(domainId: string) {
    const idx = expandedDomains.value.indexOf(domainId)
    if (idx >= 0) {
        expandedDomains.value.splice(idx, 1)
    } else {
        expandedDomains.value.push(domainId)
        await dashboardStore.fetchInReviewProcesses(domainId)
    }
}

function getInReviewList(domainId: string) {
    return dashboardStore.inReviewByDomain[domainId] || []
}

function goToReviewBoard(procId: string) {
    router.push(`/review-board/${procId}`)
}

function getDomainBarWidth(domain: any, type: string) {
    const target = domain.target || domain.total_processes || 1
    const val = type === 'published' ? domain.published_count
        : type === 'review' ? domain.in_review_count
        : domain.draft_count
    return Math.min(100, Math.round((val / target) * 100))
}

function getDomainAchievement(domain: any) {
    const target = domain.target || domain.total_processes || 1
    return Math.round((domain.published_count / target) * 100)
}

onMounted(async () => {
    await nextTick()
    updateCharts()
    await dashboardStore.fetchInReviewProcesses()
})

watch(() => [kpiStore.pipeline, kpiStore.weeklyVelocity, kpiStore.domainProgress], () => {
    updateCharts()
}, { deep: true })
</script>

<template>
    <v-container fluid class="pa-5">
        <v-row>
            <!-- 좌상단: 전사 프로세스 자산화 진도율 -->
            <v-col cols="12" md="4">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <div class="d-flex align-center justify-space-between mb-4">
                            <span class="card-title">{{ t('analysisDashboard.overallProgress') }}</span>
                            <v-chip
                                :color="achievementRate >= 75 ? 'success' : achievementRate >= 50 ? 'warning' : 'error'"
                                variant="tonal"
                                size="small"
                                class="font-weight-medium"
                            >
                                {{ achievementLabel }}
                            </v-chip>
                        </div>
                        <div class="d-flex align-center justify-center" style="min-height: 200px">
                            <div style="position: relative; width: 170px; height: 170px" v-if="chartsReady && achievementChartData?.datasets">
                                <Doughnut :chart-data="achievementChartData" :chart-options="doughnutOptions" />
                                <div class="doughnut-center">
                                    <div class="text-h4 font-weight-bold" :style="{ color: achievementColor, lineHeight: 1 }">
                                        {{ achievementRate }}%
                                    </div>
                                    <div class="text-caption text-medium-emphasis mt-1">달성률</div>
                                </div>
                            </div>
                        </div>
                        <div class="d-flex justify-center ga-4 mt-3">
                            <div class="text-center">
                                <div class="text-h6 font-weight-bold text-success">{{ publishedCount }}</div>
                                <div class="text-caption text-medium-emphasis">Published</div>
                            </div>
                            <v-divider vertical class="mx-1" />
                            <div class="text-center">
                                <div class="text-h6 font-weight-bold">{{ totalTarget }}</div>
                                <div class="text-caption text-medium-emphasis">Target</div>
                            </div>
                            <v-divider vertical class="mx-1" />
                            <div class="text-center">
                                <div class="text-h6 font-weight-bold" style="color: #9e9e9e">{{ remainingCount }}</div>
                                <div class="text-caption text-medium-emphasis">Remaining</div>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>

            <!-- 우상단: 조직별 KPI Progress -->
            <v-col cols="12" md="8">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <div class="d-flex align-center justify-space-between mb-4">
                            <span class="card-title">{{ t('analysisDashboard.domainKpiProgress') }}</span>
                            <div class="d-flex ga-3 align-center">
                                <span class="legend-dot" style="--dot-color: #2e7d32"></span><span class="legend-label">Published</span>
                                <span class="legend-dot" style="--dot-color: #ed6c02"></span><span class="legend-label">Review</span>
                                <span class="legend-dot" style="--dot-color: #bdbdbd"></span><span class="legend-label">Draft</span>
                            </div>
                        </div>
                        <div style="max-height: 340px; overflow-y: auto; padding-right: 4px">
                            <div v-for="domain in filteredDomainProgress" :key="domain.domain_id" class="domain-row mb-4">
                                <div class="d-flex align-center justify-space-between mb-2">
                                    <span class="text-body-2 font-weight-medium">{{ domain.domain_name }}</span>
                                    <div class="d-flex align-center ga-2">
                                        <span class="text-body-2 font-weight-bold" :style="{
                                            color: getDomainAchievement(domain) >= 75 ? '#2e7d32' : getDomainAchievement(domain) >= 50 ? '#ed6c02' : '#c62828'
                                        }">{{ getDomainAchievement(domain) }}%</span>
                                        <span class="text-caption text-medium-emphasis">({{ domain.published_count }}/{{ domain.target || domain.total_processes }})</span>
                                    </div>
                                </div>
                                <!-- Stacked bar -->
                                <div class="stacked-bar">
                                    <div
                                        :style="{ width: getDomainBarWidth(domain, 'published') + '%' }"
                                        class="bar-segment bar-published"
                                    >
                                        <span v-if="getDomainBarWidth(domain, 'published') > 10" class="bar-label">{{ domain.published_count }}</span>
                                    </div>
                                    <div
                                        :style="{ width: getDomainBarWidth(domain, 'review') + '%' }"
                                        class="bar-segment bar-review"
                                    >
                                        <span v-if="getDomainBarWidth(domain, 'review') > 10" class="bar-label">{{ domain.in_review_count }}</span>
                                    </div>
                                    <div
                                        :style="{ width: getDomainBarWidth(domain, 'draft') + '%' }"
                                        class="bar-segment bar-draft"
                                    >
                                        <span v-if="getDomainBarWidth(domain, 'draft') > 10" class="bar-label-dark">{{ domain.draft_count }}</span>
                                    </div>
                                </div>
                                <!-- In-Review expandable -->
                                <div v-if="domain.in_review_count > 0" class="mt-1">
                                    <v-btn
                                        variant="text"
                                        density="compact"
                                        size="small"
                                        color="warning"
                                        @click="toggleDomainExpand(domain.domain_id)"
                                        class="text-caption px-1"
                                        style="text-transform: none"
                                    >
                                        <v-icon start size="14">
                                            {{ expandedDomains.includes(domain.domain_id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                                        </v-icon>
                                        INREVIEW {{ t('analysisDashboard.detailList') }} ({{ domain.in_review_count }}{{ t('analysisDashboard.countUnit') }})
                                    </v-btn>
                                    <v-expand-transition>
                                        <div v-if="expandedDomains.includes(domain.domain_id)" class="review-detail-table">
                                            <v-table density="compact">
                                                <thead>
                                                    <tr>
                                                        <th class="text-caption" style="width: 40px">#</th>
                                                        <th class="text-caption">{{ t('analysisDashboard.processName') }}</th>
                                                        <th class="text-caption">{{ t('analysisDashboard.submitter') }}</th>
                                                        <th class="text-caption" style="width: 80px">{{ t('analysisDashboard.elapsedDays') }}</th>
                                                        <th class="text-caption" style="width: 100px"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="(item, idx) in getInReviewList(domain.domain_id)" :key="item.id">
                                                        <td class="text-caption text-medium-emphasis">{{ idx + 1 }}</td>
                                                        <td class="text-caption">{{ item.name }}</td>
                                                        <td class="text-caption text-medium-emphasis">{{ item.submitter }}</td>
                                                        <td class="text-caption">
                                                            <v-chip size="x-small" :color="item.days_in_review > 7 ? 'error' : 'warning'" variant="tonal">
                                                                {{ item.days_in_review }}{{ t('analysisDashboard.days') }}
                                                            </v-chip>
                                                        </td>
                                                        <td>
                                                            <v-btn
                                                                variant="text"
                                                                density="compact"
                                                                size="x-small"
                                                                color="primary"
                                                                @click="goToReviewBoard(item.id)"
                                                                style="text-transform: none"
                                                            >
                                                                {{ t('analysisDashboard.viewApproval') }}
                                                            </v-btn>
                                                        </td>
                                                    </tr>
                                                    <tr v-if="getInReviewList(domain.domain_id).length === 0">
                                                        <td colspan="5" class="text-center text-caption text-medium-emphasis py-3">
                                                            {{ t('analysisDashboard.noData') }}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </v-table>
                                        </div>
                                    </v-expand-transition>
                                </div>
                            </div>
                            <div v-if="filteredDomainProgress.length === 0" class="empty-state">
                                <v-icon size="36" color="grey-lighten-2">mdi-chart-bar</v-icon>
                                <div class="text-caption text-medium-emphasis mt-2">{{ t('analysisDashboard.noData') }}</div>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <v-row class="mt-1">
            <!-- 좌하단: Pipeline Funnel -->
            <v-col cols="12" md="4">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <span class="card-title d-block mb-4">{{ t('analysisDashboard.pipelineFunnel') }}</span>
                        <div v-if="pipeline" class="d-flex flex-column ga-4">
                            <!-- Draft → Review -->
                            <div>
                                <div class="d-flex justify-space-between text-body-2 mb-2">
                                    <span class="text-medium-emphasis">Draft → Review</span>
                                    <strong :style="{ color: draftToReviewRate >= 50 ? '#2e7d32' : '#ed6c02' }">{{ draftToReviewRate }}%</strong>
                                </div>
                                <v-progress-linear
                                    :model-value="draftToReviewRate"
                                    color="warning"
                                    height="28"
                                    rounded
                                    bg-color="grey-lighten-4"
                                >
                                    <template #default>
                                        <span class="text-caption font-weight-medium" style="color: rgba(255,255,255,0.95)">
                                            {{ (pipeline.in_review_count || 0) + (pipeline.published_count || 0) }}{{ t('analysisDashboard.countUnit') }}
                                        </span>
                                    </template>
                                </v-progress-linear>
                            </div>
                            <!-- Review → Published -->
                            <div>
                                <div class="d-flex justify-space-between text-body-2 mb-2">
                                    <span class="text-medium-emphasis">Review → Published</span>
                                    <strong :style="{ color: reviewToPublishedRate >= 50 ? '#2e7d32' : '#ed6c02' }">{{ reviewToPublishedRate }}%</strong>
                                </div>
                                <v-progress-linear
                                    :model-value="reviewToPublishedRate"
                                    color="success"
                                    height="28"
                                    rounded
                                    bg-color="grey-lighten-4"
                                >
                                    <template #default>
                                        <span class="text-caption font-weight-medium" style="color: rgba(255,255,255,0.95)">
                                            {{ pipeline.published_count || 0 }}{{ t('analysisDashboard.countUnit') }}
                                        </span>
                                    </template>
                                </v-progress-linear>
                            </div>
                            <!-- Summary chips -->
                            <div class="d-flex ga-2 mt-1 flex-wrap">
                                <v-chip size="small" variant="tonal" color="grey" label>
                                    <v-icon start size="12">mdi-circle</v-icon>Draft: {{ pipeline.draft_count }}
                                </v-chip>
                                <v-chip size="small" variant="tonal" color="warning" label>
                                    <v-icon start size="12">mdi-circle</v-icon>Review: {{ pipeline.in_review_count }}
                                </v-chip>
                                <v-chip size="small" variant="tonal" color="success" label>
                                    <v-icon start size="12">mdi-circle</v-icon>Published: {{ pipeline.published_count }}
                                </v-chip>
                            </div>
                        </div>
                        <div v-else class="empty-state" style="min-height: 200px">
                            <v-icon size="36" color="grey-lighten-2">mdi-filter-outline</v-icon>
                            <div class="text-caption text-medium-emphasis mt-2">{{ t('analysisDashboard.noData') }}</div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>

            <!-- 우하단: 주간 발생 속도 & ETA -->
            <v-col cols="12" md="8">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <div class="d-flex align-center justify-space-between mb-4">
                            <span class="card-title">{{ t('analysisDashboard.weeklyVelocity') }}</span>
                            <div class="d-flex ga-2">
                                <v-chip size="small" color="primary" variant="tonal" label class="font-weight-medium">
                                    <v-icon start size="14">mdi-trending-up</v-icon>
                                    +{{ avgVelocity }}{{ t('analysisDashboard.perWeek') }}
                                </v-chip>
                                <v-chip v-if="etaWeeks" size="small" color="info" variant="tonal" label class="font-weight-medium">
                                    <v-icon start size="14">mdi-flag-checkered</v-icon>
                                    ETA: {{ etaWeeks }}{{ t('analysisDashboard.weeks') }}
                                </v-chip>
                            </div>
                        </div>
                        <div style="height: 240px" v-if="chartsReady && velocityChartData?.datasets">
                            <Line :chart-data="velocityChartData" :chart-options="lineOptions" />
                        </div>
                        <div v-else class="empty-state" style="height: 240px">
                            <v-icon size="36" color="grey-lighten-2">mdi-chart-line</v-icon>
                            <div class="text-caption text-medium-emphasis mt-2">{{ t('analysisDashboard.noData') }}</div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.metric-card {
    background: #fff;
    border: 1px solid #eaecf0;
    transition: box-shadow 0.2s;
}
.metric-card:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.card-title {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a2e;
    letter-spacing: -0.2px;
}

.doughnut-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
}

.stacked-bar {
    height: 24px;
    background: #f5f5f5;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
}

.bar-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 0.4s ease;
}

.bar-published { background: #2e7d32; }
.bar-review { background: #ed6c02; }
.bar-draft { background: #e0e0e0; }

.bar-label {
    font-size: 11px;
    color: #fff;
    font-weight: 500;
}
.bar-label-dark {
    font-size: 11px;
    color: #616161;
    font-weight: 500;
}

.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--dot-color);
    display: inline-block;
}
.legend-label {
    font-size: 11px;
    color: #757575;
}

.review-detail-table {
    margin-top: 4px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #f0f0f0;
}

.domain-row {
    padding-bottom: 12px;
    border-bottom: 1px solid #f5f5f5;
}
.domain-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 120px;
}
</style>
