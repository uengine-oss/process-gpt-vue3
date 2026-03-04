<script setup lang="ts">
/**
 * Tab C: Intelligence Board
 * 자동화 인사이트 — Chart.js 기반, 실데이터 연결
 */
import { onMounted, ref, shallowRef, computed, getCurrentInstance, nextTick, watch } from 'vue'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js'
import { Bar, Scatter, Doughnut } from 'vue-chartjs'
import { useKpiStore } from '@/stores/analytics/kpiStore'
import { useAnalysisDashboardStore } from '@/stores/analytics/analysisDashboardStore'
import BackendFactory from '@/components/api/BackendFactory'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler)

const props = defineProps<{
    filters: { domains: string[]; orgId: string; dateRange: string; comparisonMode: boolean }
}>()

const backend = BackendFactory.createBackend() as any
const instance = getCurrentInstance()
const t = (key: string) => instance?.proxy?.$t(key) || key

const kpiStore = useKpiStore()
const store = useAnalysisDashboardStore()
const chartsReady = ref(false)

// Domain name mapping
const domainNameMap = ref<Record<string, string>>({})

// ============== Shared Chart Styling ==============
const tooltipStyle = {
    backgroundColor: 'rgba(33, 33, 33, 0.92)',
    padding: 12,
    cornerRadius: 8,
    titleFont: { size: 12, weight: '600' as const },
    bodyFont: { size: 12 },
    bodySpacing: 4,
    boxPadding: 4,
}

const gridStyle = {
    color: 'rgba(0, 0, 0, 0.04)',
    drawBorder: false,
}

const tickStyle = {
    font: { size: 11 },
    color: '#9e9e9e',
    padding: 8,
}

// ============== Chart Data ==============

// 4-1: BPR Gap Analysis
const gapChartData = shallowRef({
    labels: [] as string[],
    datasets: [
        { label: 'Current FTE', data: [] as number[], backgroundColor: 'rgba(239, 83, 80, 0.75)', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.6 },
        { label: 'Target FTE', data: [] as number[], backgroundColor: 'rgba(46, 125, 50, 0.75)', borderRadius: 6, barPercentage: 0.7, categoryPercentage: 0.6 },
    ]
})
const gapChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: true,
            position: 'top' as const,
            labels: { usePointStyle: true, pointStyle: 'rectRounded', padding: 16, font: { size: 11, weight: '500' as const } }
        },
        tooltip: tooltipStyle,
    },
    scales: {
        x: { grid: { display: false }, ticks: tickStyle, border: { display: false } },
        y: { beginAtZero: true, grid: gridStyle, ticks: tickStyle, border: { display: false } }
    }
}
const hasGapData = computed(() => store.domainFteSummary.length > 0)

// 4-2: FTE vs OSS Scatter
const scatterChartData = shallowRef({
    datasets: [{
        label: 'Processes',
        data: [] as Array<{ x: number; y: number }>,
        backgroundColor: 'rgba(21, 101, 192, 0.5)',
        borderColor: 'rgba(21, 101, 192, 0.8)',
        borderWidth: 1.5,
        pointRadius: 7,
        pointHoverRadius: 10,
        pointStyle: 'circle' as const,
    }]
})
const scatterChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            ...tooltipStyle,
            callbacks: { label: (ctx: any) => `OSS: ${ctx.parsed.x}  |  FTE: ${ctx.parsed.y}` }
        }
    },
    scales: {
        x: {
            title: { display: true, text: 'OSS Count', font: { size: 11, weight: '500' as const }, color: '#757575' },
            beginAtZero: true, grid: gridStyle, ticks: tickStyle, border: { display: false },
        },
        y: {
            title: { display: true, text: 'FTE', font: { size: 11, weight: '500' as const }, color: '#757575' },
            beginAtZero: true, grid: gridStyle, ticks: tickStyle, border: { display: false },
        }
    }
}
const hasScatterData = computed(() => store.bottleneckList.length > 0)

// 4-3: Automation Opportunity Matrix
const automationColors = [
    'rgba(255, 152, 0, 0.8)',
    'rgba(255, 167, 38, 0.75)',
    'rgba(255, 183, 77, 0.7)',
    'rgba(255, 204, 128, 0.65)',
    'rgba(255, 224, 178, 0.6)',
]
const automationChartData = shallowRef({
    labels: [] as string[],
    datasets: [{
        label: 'Manual Task %',
        data: [] as number[],
        backgroundColor: automationColors,
        borderRadius: 6,
        barPercentage: 0.65,
    }]
})
const automationChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
        legend: { display: false },
        tooltip: {
            ...tooltipStyle,
            callbacks: {
                label: (ctx: any) => `Manual Task Ratio: ${ctx.parsed.x}%`,
            }
        }
    },
    scales: {
        x: {
            beginAtZero: true, max: 100,
            title: { display: true, text: 'Manual Task Ratio (%)', font: { size: 11, weight: '500' as const }, color: '#757575' },
            grid: gridStyle, ticks: { ...tickStyle, callback: (v: any) => v + '%' }, border: { display: false },
        },
        y: { grid: { display: false }, ticks: { ...tickStyle, font: { size: 11.5 } }, border: { display: false } }
    }
}
const hasAutomationData = computed(() => store.nodeTypeStats.length > 0)

// 4-4: DX Rate
const dxRateData = ref<Array<{ domain: string; automated: number; manual: number; rate: number }>>([])
const hasDxData = computed(() => dxRateData.value.length > 0)

function getDxDoughnutData(item: { automated: number; manual: number; rate: number }) {
    return {
        labels: ['Automated', 'Manual'],
        datasets: [{
            data: [item.automated, item.manual],
            backgroundColor: [
                item.rate >= 60 ? '#2e7d32' : item.rate >= 30 ? '#ed6c02' : '#c62828',
                '#eeeeee'
            ],
            borderWidth: 0,
            cutout: '72%',
            borderRadius: 2,
        }]
    }
}

function getDxColor(rate: number) {
    if (rate >= 60) return '#2e7d32'
    if (rate >= 30) return '#ed6c02'
    return '#c62828'
}

const dxDoughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { animateRotate: true, duration: 600 },
    plugins: {
        legend: { display: false },
        tooltip: {
            ...tooltipStyle,
            callbacks: {
                label: (ctx: any) => {
                    const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0)
                    const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0
                    return `${ctx.label}: ${ctx.parsed} (${pct}%)`
                }
            }
        }
    }
}

function getDomainName(domainId: string) {
    return domainNameMap.value[domainId] || domainId
}

function buildCharts() {
    const nodeStats = store.nodeTypeStats || []
    const bottleneck = store.bottleneckList || []
    const fteSummary = store.domainFteSummary || []

    // 4-1: BPR Gap Analysis
    if (fteSummary.length > 0) {
        gapChartData.value = {
            labels: fteSummary.map(d => getDomainName(d.domain_id)),
            datasets: [
                {
                    label: 'Current FTE',
                    data: fteSummary.map(d => d.current_fte),
                    backgroundColor: 'rgba(239, 83, 80, 0.75)',
                    borderRadius: 6,
                    barPercentage: 0.7,
                    categoryPercentage: 0.6,
                },
                {
                    label: 'Target FTE',
                    data: fteSummary.map(d => d.target_fte),
                    backgroundColor: 'rgba(46, 125, 50, 0.75)',
                    borderRadius: 6,
                    barPercentage: 0.7,
                    categoryPercentage: 0.6,
                }
            ]
        }
    }

    // 4-2: FTE vs OSS Scatter
    if (bottleneck.length > 0) {
        scatterChartData.value = {
            datasets: [{
                label: 'Processes',
                data: bottleneck.map(b => ({ x: b.oss_count, y: b.total_fte })),
                backgroundColor: 'rgba(21, 101, 192, 0.5)',
                borderColor: 'rgba(21, 101, 192, 0.8)',
                borderWidth: 1.5,
                pointRadius: 7,
                pointHoverRadius: 10,
                pointStyle: 'circle' as const,
            }]
        }
    }

    // 4-3: Automation Matrix — Top 5
    if (nodeStats.length > 0) {
        const withManualRatio = nodeStats.map(s => ({
            name: s.name || s.proc_def_id,
            manualRatio: s.total_nodes > 0
                ? Math.round(((s.manual_task + s.user_task) / s.total_nodes) * 100)
                : 0,
            total_nodes: s.total_nodes
        }))
        withManualRatio.sort((a, b) => b.manualRatio - a.manualRatio)
        const top5 = withManualRatio.slice(0, 5)

        automationChartData.value = {
            labels: top5.map(b => b.name.length > 30 ? b.name.substring(0, 30) + '...' : b.name),
            datasets: [{
                label: 'Manual Task %',
                data: top5.map(b => b.manualRatio),
                backgroundColor: automationColors.slice(0, top5.length),
                borderRadius: 6,
                barPercentage: 0.65,
            }]
        }
    }

    // 4-4: DX Rate
    if (nodeStats.length > 0) {
        const domainAgg: Record<string, { automated: number; manual: number }> = {}
        nodeStats.forEach(s => {
            const did = s.domain_id || 'unknown'
            if (!domainAgg[did]) domainAgg[did] = { automated: 0, manual: 0 }
            domainAgg[did].automated += (s.service_task + s.script_task)
            domainAgg[did].manual += (s.manual_task + s.user_task)
        })

        dxRateData.value = Object.entries(domainAgg).map(([did, val]) => {
            const total = val.automated + val.manual
            return {
                domain: getDomainName(did),
                automated: val.automated,
                manual: val.manual,
                rate: total > 0 ? Math.round((val.automated / total) * 100) : 0
            }
        })
    }

    chartsReady.value = true
}

onMounted(async () => {
    try {
        const metricsMap = await backend.getMetricsMap()
        const domains = metricsMap?.domains || []
        domains.forEach((d: any) => {
            domainNameMap.value[d.id] = d.name
        })
    } catch (_) {}

    await store.fetchAllTabC()
    if (store.bottleneckList.length === 0) {
        await store.fetchBottleneckTop10()
    }

    await nextTick()
    buildCharts()
})

watch(() => [store.nodeTypeStats, store.domainFteSummary, store.bottleneckList], () => {
    buildCharts()
}, { deep: true })
</script>

<template>
    <v-container fluid class="pa-5">
        <v-row>
            <!-- 4-1: BPR Gap Analysis -->
            <v-col cols="12" md="6">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <div class="d-flex align-center ga-2 mb-4">
                            <div class="section-icon" style="background: #fce4ec">
                                <v-icon size="16" color="error">mdi-swap-vertical</v-icon>
                            </div>
                            <span class="card-title">{{ t('analysisDashboard.bprGapAnalysis') }}</span>
                        </div>
                        <div style="height: 280px" v-if="chartsReady && hasGapData && gapChartData?.datasets">
                            <Bar :chart-data="gapChartData" :chart-options="gapChartOptions" />
                        </div>
                        <div v-else class="empty-state" style="height: 280px">
                            <div class="empty-icon-wrap">
                                <v-icon size="28" color="grey-lighten-1">mdi-chart-bar</v-icon>
                            </div>
                            <div class="text-body-2 text-medium-emphasis mt-3">{{ t('analysisDashboard.dataCollecting') }}</div>
                            <div class="text-caption text-disabled mt-1">activity_config FTE + fte_snapshot</div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>

            <!-- 4-2: FTE vs OSS Correlation -->
            <v-col cols="12" md="6">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <div class="d-flex align-center ga-2 mb-4">
                            <div class="section-icon" style="background: #e3f2fd">
                                <v-icon size="16" color="primary">mdi-chart-scatter-plot</v-icon>
                            </div>
                            <span class="card-title">{{ t('analysisDashboard.fteOssCorrelation') }}</span>
                        </div>
                        <div style="height: 280px" v-if="chartsReady && hasScatterData && scatterChartData?.datasets">
                            <Scatter :chart-data="scatterChartData" :chart-options="scatterChartOptions" />
                        </div>
                        <div v-else class="empty-state" style="height: 280px">
                            <div class="empty-icon-wrap">
                                <v-icon size="28" color="grey-lighten-1">mdi-chart-scatter-plot</v-icon>
                            </div>
                            <div class="text-body-2 text-medium-emphasis mt-3">{{ t('analysisDashboard.dataCollecting') }}</div>
                            <div class="text-caption text-disabled mt-1">activity_config FTE + proc_def OSS</div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <v-row class="mt-1">
            <!-- 4-3: Automation Opportunity Matrix -->
            <v-col cols="12" md="6">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <div class="d-flex align-center ga-2 mb-4">
                            <div class="section-icon" style="background: #fff3e0">
                                <v-icon size="16" color="warning">mdi-robot-outline</v-icon>
                            </div>
                            <span class="card-title">{{ t('analysisDashboard.automationMatrix') }}</span>
                            <v-chip v-if="hasAutomationData" size="x-small" variant="tonal" color="warning" class="ml-1">TOP 5</v-chip>
                        </div>
                        <div style="height: 280px" v-if="chartsReady && hasAutomationData && automationChartData?.datasets">
                            <Bar :chart-data="automationChartData" :chart-options="automationChartOptions" />
                        </div>
                        <div v-else class="empty-state" style="height: 280px">
                            <div class="empty-icon-wrap">
                                <v-icon size="28" color="grey-lighten-1">mdi-robot-outline</v-icon>
                            </div>
                            <div class="text-body-2 text-medium-emphasis mt-3">{{ t('analysisDashboard.dataCollecting') }}</div>
                            <div class="text-caption text-disabled mt-1">tb_bpmn_node task_type</div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>

            <!-- 4-4: DX Rate -->
            <v-col cols="12" md="6">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5">
                        <div class="d-flex align-center ga-2 mb-4">
                            <div class="section-icon" style="background: #e8f5e9">
                                <v-icon size="16" color="success">mdi-gauge</v-icon>
                            </div>
                            <span class="card-title">{{ t('analysisDashboard.dxRate') }}</span>
                        </div>
                        <div v-if="chartsReady && hasDxData">
                            <v-row dense class="justify-center">
                                <v-col v-for="item in dxRateData" :key="item.domain" cols="6" sm="4" class="d-flex justify-center">
                                    <div class="dx-gauge-item">
                                        <div class="dx-gauge-ring">
                                            <Doughnut :chart-data="getDxDoughnutData(item)" :chart-options="dxDoughnutOptions" />
                                            <div class="dx-gauge-center">
                                                <span class="dx-gauge-value" :style="{ color: getDxColor(item.rate) }">{{ item.rate }}%</span>
                                            </div>
                                        </div>
                                        <div class="text-caption font-weight-medium mt-2" style="color: #424242">{{ item.domain }}</div>
                                        <div class="text-caption text-disabled" style="font-size: 10px">
                                            Auto {{ item.automated }} / Manual {{ item.manual }}
                                        </div>
                                    </div>
                                </v-col>
                            </v-row>
                            <div class="d-flex ga-4 justify-center mt-4 pt-3" style="border-top: 1px solid #f5f5f5">
                                <div class="d-flex align-center ga-1">
                                    <span class="legend-dot" style="--dot-color: #2e7d32"></span>
                                    <span class="legend-text">Service/Script</span>
                                </div>
                                <div class="d-flex align-center ga-1">
                                    <span class="legend-dot" style="--dot-color: #eeeeee; border: 1px solid #ccc"></span>
                                    <span class="legend-text">Manual/User</span>
                                </div>
                            </div>
                        </div>
                        <div v-else class="empty-state" style="min-height: 280px">
                            <div class="empty-icon-wrap">
                                <v-icon size="28" color="grey-lighten-1">mdi-gauge</v-icon>
                            </div>
                            <div class="text-body-2 text-medium-emphasis mt-3">{{ t('analysisDashboard.dataCollecting') }}</div>
                            <div class="text-caption text-disabled mt-1">tb_bpmn_node task_type</div>
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

.section-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.empty-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: #f8f9fb;
    display: flex;
    align-items: center;
    justify-content: center;
}

.dx-gauge-item {
    text-align: center;
    padding: 8px;
}

.dx-gauge-ring {
    position: relative;
    width: 100px;
    height: 100px;
    margin: 0 auto;
}

.dx-gauge-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.dx-gauge-value {
    font-size: 16px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--dot-color);
    display: inline-block;
    flex-shrink: 0;
}

.legend-text {
    font-size: 11px;
    color: #757575;
}
</style>
