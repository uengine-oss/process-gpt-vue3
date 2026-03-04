<script setup lang="ts">
/**
 * Analysis Dashboard
 * 3-탭 분석 대시보드: Strategy / Operational / Intelligence
 */
import { ref, onMounted, computed, getCurrentInstance } from 'vue'
import { useKpiStore } from '@/stores/analytics/kpiStore'
import { useAnalysisDashboardStore } from '@/stores/analytics/analysisDashboardStore'
import BackendFactory from '@/components/api/BackendFactory'
import StrategyBoard from './tabs/StrategyBoard.vue'
import OperationalBoard from './tabs/OperationalBoard.vue'
import IntelligenceBoard from './tabs/IntelligenceBoard.vue'

const backend = BackendFactory.createBackend() as any
const instance = getCurrentInstance()
const t = (key: string) => instance?.proxy?.$t(key) || key

const kpiStore = useKpiStore()
const dashboardStore = useAnalysisDashboardStore()

const activeTab = ref('strategy')
const loading = ref(true)

// Global filters
const selectedDomains = ref<string[]>([])
const selectedOrg = ref('all')
const dateRange = ref('quarter')
const comparisonMode = ref(false)

// Domain list
const domainOptions = ref<Array<{ id: string; name: string; color?: string }>>([])

const dateRangeOptions = [
    { title: 'This Quarter', value: 'quarter' },
    { title: 'YTD', value: 'ytd' },
    { title: 'Custom Range', value: 'custom' },
]

const filters = computed(() => ({
    domains: selectedDomains.value,
    orgId: selectedOrg.value,
    dateRange: dateRange.value,
    comparisonMode: comparisonMode.value,
}))

onMounted(async () => {
    try {
        const metricsMap = await backend.getMetricsMap()
        domainOptions.value = metricsMap?.domains || []
        await kpiStore.fetchAll()
    } catch (e) {
        console.error('AnalysisDashboard init error:', e)
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <v-card elevation="0" class="analysis-dashboard-page">
        <v-card-text class="pa-5 pa-md-6">
            <!-- Header -->
            <div class="d-flex align-center ga-3 mb-5">
                <div class="header-icon-wrap">
                    <v-icon size="22" color="white">mdi-chart-box-outline</v-icon>
                </div>
                <div>
                    <h1 class="text-h5 font-weight-bold" style="letter-spacing: -0.3px">{{ t('analysisDashboard.title') }}</h1>
                    <p class="text-body-2 text-medium-emphasis mb-0" style="margin-top: 2px">
                        {{ t('analysisDashboard.subtitle') }}
                    </p>
                </div>
            </div>

            <!-- Global Filters -->
            <v-card variant="flat" class="filter-bar mb-5" rounded="lg">
                <v-card-text class="py-3 px-4">
                    <v-row align="center" dense>
                        <v-col cols="12" sm="3">
                            <v-select
                                v-model="selectedDomains"
                                :items="domainOptions"
                                item-title="name"
                                item-value="id"
                                :label="t('analysisDashboard.domainScope')"
                                multiple
                                chips
                                closable-chips
                                density="compact"
                                variant="outlined"
                                hide-details
                                :placeholder="t('analysisDashboard.allDomains')"
                            />
                        </v-col>
                        <v-col cols="12" sm="3">
                            <v-select
                                v-model="selectedOrg"
                                :items="[{ title: t('analysisDashboard.allOrgs'), value: 'all' }]"
                                :label="t('analysisDashboard.organization')"
                                density="compact"
                                variant="outlined"
                                hide-details
                            />
                        </v-col>
                        <v-col cols="12" sm="3">
                            <v-select
                                v-model="dateRange"
                                :items="dateRangeOptions"
                                :label="t('analysisDashboard.dateRange')"
                                density="compact"
                                variant="outlined"
                                hide-details
                            />
                        </v-col>
                        <v-col cols="12" sm="3">
                            <v-checkbox
                                v-model="comparisonMode"
                                :label="t('analysisDashboard.vsLastQuarter')"
                                density="compact"
                                hide-details
                            />
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>

            <!-- Tabs -->
            <v-card variant="flat" rounded="lg" class="tab-card">
                <v-tabs v-model="activeTab" color="primary" class="tab-header" height="52">
                    <v-tab value="strategy" class="tab-item">
                        <v-icon start size="18">mdi-strategy</v-icon>
                        {{ t('analysisDashboard.strategyBoard') }}
                    </v-tab>
                    <v-tab value="operational" class="tab-item">
                        <v-icon start size="18">mdi-cog-outline</v-icon>
                        {{ t('analysisDashboard.operationalBoard') }}
                    </v-tab>
                    <v-tab value="intelligence" class="tab-item">
                        <v-icon start size="18">mdi-lightbulb-outline</v-icon>
                        {{ t('analysisDashboard.intelligenceBoard') }}
                    </v-tab>
                </v-tabs>

                <v-divider />

                <v-window v-model="activeTab">
                    <v-window-item value="strategy">
                        <StrategyBoard v-if="!loading" :filters="filters" />
                        <div v-else class="d-flex justify-center align-center" style="min-height: 400px">
                            <v-progress-circular indeterminate color="primary" size="40" />
                        </div>
                    </v-window-item>
                    <v-window-item value="operational">
                        <OperationalBoard :filters="filters" />
                    </v-window-item>
                    <v-window-item value="intelligence">
                        <IntelligenceBoard :filters="filters" />
                    </v-window-item>
                </v-window>
            </v-card>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.analysis-dashboard-page {
    overflow: auto;
    height: 100%;
    background: #fff;
}

.header-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, #5c6bc0, #3949ab);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.filter-bar {
    background: #fff;
    border: 1px solid #e8eaed;
}

.tab-card {
    background: #fff;
    border: 1px solid #e8eaed;
    overflow: hidden;
}

.tab-header {
    background: #fafbfc;
}

.tab-item {
    text-transform: none !important;
    font-weight: 500;
    letter-spacing: 0 !important;
    font-size: 13.5px;
}
</style>
