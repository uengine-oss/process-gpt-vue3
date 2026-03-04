<script setup lang="ts">
/**
 * Tab B: Operational Board
 * 리소스 & 효율 — Native UI 데이터 테이블 3종
 */
import { onMounted, ref, computed, getCurrentInstance } from 'vue'
import { useAnalysisDashboardStore } from '@/stores/analytics/analysisDashboardStore'

const props = defineProps<{
    filters: { domains: string[]; orgId: string; dateRange: string; comparisonMode: boolean }
}>()

const instance = getCurrentInstance()
const t = (key: string) => instance?.proxy?.$t(key) || key

const store = useAnalysisDashboardStore()
const staleFilter = ref(0)
const snackbar = ref(false)

// ============== Bottleneck Table ==============
const bottleneckHeaders = [
    { title: '#', key: 'rank', width: '50px', sortable: false, align: 'center' as const },
    { title: '', key: 'name', sortable: true },
    { title: 'Total FTE', key: 'total_fte', sortable: true, align: 'end' as const },
    { title: '', key: 'owner', sortable: true },
    { title: 'OSS', key: 'oss_count', sortable: true, align: 'center' as const },
]

// ============== Stale Table ==============
const staleHeaders = [
    { title: '', key: 'name', sortable: true },
    { title: 'Owner', key: 'owner', sortable: true },
    { title: '', key: 'last_modified', sortable: true },
    { title: '', key: 'status', sortable: false, align: 'center' as const },
    { title: '', key: 'days_since_update', sortable: true, align: 'end' as const },
    { title: '', key: 'actions', sortable: false, width: '100px', align: 'center' as const },
]

// ============== Action Required Table ==============
const actionHeaders = [
    { title: '', key: 'name', sortable: true },
    { title: '', key: 'type', sortable: true, align: 'center' as const },
    { title: '', key: 'days_overdue', sortable: true, align: 'end' as const },
    { title: '', key: 'assignee', sortable: true },
]

const filteredStaleProcesses = computed(() => {
    if (staleFilter.value === 0) return store.staleProcesses
    return store.staleProcesses.filter(p => p.days_since_update >= staleFilter.value)
})

function openProcess(id: string, name: string) {
    window.open(`/definitions/chat?id=${id}&name=${encodeURIComponent(name)}&modeling=true`, '_blank')
}

function requestRefresh() {
    snackbar.value = true
}

function formatDate(dateStr: string) {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getStatusColor(status: string) {
    switch (status) {
        case 'draft': return 'grey'
        case 'review': case 'in_review': return 'warning'
        case 'published': return 'success'
        case 'reopen': return 'error'
        default: return 'grey'
    }
}

function getTypeLabel(type: string) {
    return type === 'delayed_review'
        ? t('analysisDashboard.delayedReview')
        : t('analysisDashboard.reopenPending')
}

async function exportToExcel() {
    try {
        const rows = store.bottleneckList.map(item =>
            [item.rank, item.name, item.total_fte, item.owner, item.oss_count].join(',')
        )
        const csv = ['Rank,Process Name,Total FTE,Owner,OSS Count', ...rows].join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `bottleneck_top10_${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
    } catch (e) {
        console.error('Export error:', e)
    }
}

onMounted(async () => {
    await store.fetchAllTabB()
})
</script>

<template>
    <v-container fluid class="pa-5">
        <!-- 1. Process Bottleneck List -->
        <v-card variant="flat" rounded="lg" class="metric-card mb-4">
            <v-card-text class="pa-5 pb-2">
                <div class="d-flex align-center justify-space-between mb-3">
                    <div class="d-flex align-center ga-2">
                        <div class="section-icon" style="background: #fef3e6">
                            <v-icon size="16" color="warning">mdi-fire</v-icon>
                        </div>
                        <span class="card-title">{{ t('analysisDashboard.bottleneckTitle') }}</span>
                    </div>
                    <v-btn variant="tonal" size="small" prepend-icon="mdi-download" @click="exportToExcel" color="primary"
                        style="text-transform: none; letter-spacing: 0; font-weight: 500"
                    >
                        Export CSV
                    </v-btn>
                </div>
            </v-card-text>
            <v-data-table
                :headers="bottleneckHeaders"
                :items="store.bottleneckList"
                :items-per-page="10"
                density="compact"
                :loading="store.loading"
                :no-data-text="t('analysisDashboard.noData')"
                class="op-table"
            >
                <template #[`header.name`]>{{ t('analysisDashboard.processName') }}</template>
                <template #[`header.owner`]>{{ t('analysisDashboard.department') }}</template>

                <template #[`item.rank`]="{ item }">
                    <div class="rank-badge" :class="{ 'rank-top': item.rank <= 3 }">
                        {{ item.rank }}
                    </div>
                </template>
                <template #[`item.name`]="{ item }">
                    <a
                        href="javascript:void(0)"
                        class="process-link"
                        @click="openProcess(item.id, item.name)"
                    >
                        {{ item.name }}
                    </a>
                </template>
                <template #[`item.total_fte`]="{ item }">
                    <span class="fte-value">{{ item.total_fte }}</span>
                </template>
                <template #[`item.owner`]="{ item }">
                    <span class="text-body-2 text-medium-emphasis">{{ item.owner }}</span>
                </template>
                <template #[`item.oss_count`]="{ item }">
                    <v-chip v-if="item.oss_count > 0" size="x-small" variant="tonal" color="info">{{ item.oss_count }}</v-chip>
                    <span v-else class="text-caption text-disabled">-</span>
                </template>
            </v-data-table>
        </v-card>

        <v-row>
            <!-- 2. Update Recency (좀비 프로세스) -->
            <v-col cols="12" md="6">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5 pb-2">
                        <div class="d-flex align-center ga-2 mb-3">
                            <div class="section-icon" style="background: #e8f0fe">
                                <v-icon size="16" color="primary">mdi-clock-alert-outline</v-icon>
                            </div>
                            <span class="card-title">{{ t('analysisDashboard.staleTitle') }}</span>
                        </div>
                        <v-chip-group v-model="staleFilter" mandatory selected-class="text-primary">
                            <v-chip :value="0" size="small" variant="outlined" label>{{ t('analysisDashboard.all') }}</v-chip>
                            <v-chip :value="90" size="small" variant="outlined" label>3{{ t('analysisDashboard.monthsInactive') }}</v-chip>
                            <v-chip :value="180" size="small" variant="outlined" label>6{{ t('analysisDashboard.monthsInactive') }}</v-chip>
                        </v-chip-group>
                    </v-card-text>
                    <v-data-table
                        :headers="staleHeaders"
                        :items="filteredStaleProcesses"
                        :items-per-page="5"
                        density="compact"
                        :no-data-text="t('analysisDashboard.noData')"
                        class="op-table"
                    >
                        <template #[`header.name`]>{{ t('analysisDashboard.processName') }}</template>
                        <template #[`header.last_modified`]>{{ t('analysisDashboard.lastModified') }}</template>
                        <template #[`header.status`]>{{ t('analysisDashboard.status') }}</template>
                        <template #[`header.days_since_update`]>{{ t('analysisDashboard.elapsedDays') }}</template>
                        <template #[`header.actions`]></template>

                        <template #[`item.name`]="{ item }">
                            <a href="javascript:void(0)" class="process-link" @click="openProcess(item.id, item.name)">
                                {{ item.name }}
                            </a>
                        </template>
                        <template #[`item.last_modified`]="{ item }">
                            <span class="text-caption text-medium-emphasis">{{ formatDate(item.last_modified) }}</span>
                        </template>
                        <template #[`item.status`]="{ item }">
                            <v-chip :color="getStatusColor(item.status)" size="x-small" variant="tonal" label>
                                {{ item.status }}
                            </v-chip>
                        </template>
                        <template #[`item.days_since_update`]="{ item }">
                            <span class="text-body-2" :class="item.days_since_update > 180 ? 'text-error font-weight-bold' : 'text-medium-emphasis'">
                                {{ item.days_since_update }}{{ t('analysisDashboard.days') }}
                            </span>
                        </template>
                        <template #[`item.actions`]>
                            <v-btn variant="tonal" density="compact" size="x-small" color="warning" @click="requestRefresh"
                                style="text-transform: none"
                            >
                                <v-icon start size="12">mdi-bell-ring-outline</v-icon>
                                {{ t('analysisDashboard.refreshRequest') }}
                            </v-btn>
                        </template>
                    </v-data-table>
                </v-card>
            </v-col>

            <!-- 3. Action Required -->
            <v-col cols="12" md="6">
                <v-card variant="flat" rounded="lg" class="metric-card fill-height">
                    <v-card-text class="pa-5 pb-2">
                        <div class="d-flex align-center ga-2 mb-3">
                            <div class="section-icon" style="background: #fce4ec">
                                <v-icon size="16" color="error">mdi-alert-circle-outline</v-icon>
                            </div>
                            <span class="card-title">{{ t('analysisDashboard.actionRequiredTitle') }}</span>
                            <v-chip v-if="store.actionRequired.length > 0" size="x-small" color="error" variant="tonal" class="ml-1">
                                {{ store.actionRequired.length }}
                            </v-chip>
                        </div>
                    </v-card-text>
                    <v-data-table
                        :headers="actionHeaders"
                        :items="store.actionRequired"
                        :items-per-page="5"
                        density="compact"
                        :no-data-text="t('analysisDashboard.noData')"
                        class="op-table"
                    >
                        <template #[`header.name`]>{{ t('analysisDashboard.processName') }}</template>
                        <template #[`header.type`]>{{ t('analysisDashboard.issueType') }}</template>
                        <template #[`header.days_overdue`]>{{ t('analysisDashboard.elapsedDays') }}</template>
                        <template #[`header.assignee`]>{{ t('analysisDashboard.assignee') }}</template>

                        <template #[`item.name`]="{ item }">
                            <a href="javascript:void(0)" class="process-link" @click="openProcess(item.id, item.name)">
                                {{ item.name }}
                            </a>
                        </template>
                        <template #[`item.type`]="{ item }">
                            <v-chip
                                :color="item.type === 'delayed_review' ? 'warning' : 'error'"
                                size="x-small"
                                variant="tonal"
                                label
                            >
                                {{ getTypeLabel(item.type) }}
                            </v-chip>
                        </template>
                        <template #[`item.days_overdue`]="{ item }">
                            <span class="text-body-2 font-weight-medium" :class="item.days_overdue > 14 ? 'text-error' : 'text-warning'">
                                {{ item.days_overdue }}{{ t('analysisDashboard.days') }}
                            </span>
                        </template>
                        <template #[`item.assignee`]="{ item }">
                            <span class="text-body-2 text-medium-emphasis">{{ item.assignee }}</span>
                        </template>
                    </v-data-table>
                </v-card>
            </v-col>
        </v-row>

        <!-- Snackbar for refresh request -->
        <v-snackbar v-model="snackbar" :timeout="3000" color="info" location="bottom right" rounded="lg">
            <v-icon start size="18">mdi-information-outline</v-icon>
            {{ t('analysisDashboard.externalIntegrationPlanned') }}
        </v-snackbar>
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

.rank-badge {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    background: #f5f5f5;
    color: #757575;
    margin: 0 auto;
}
.rank-top {
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    color: #fff;
}

.process-link {
    color: #1565c0;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    transition: color 0.15s;
}
.process-link:hover {
    color: #0d47a1;
    text-decoration: underline;
}

.fte-value {
    font-size: 14px;
    font-weight: 700;
    color: #1a1a2e;
    font-variant-numeric: tabular-nums;
}

.op-table :deep(.v-data-table__thead th) {
    font-size: 11.5px !important;
    font-weight: 600 !important;
    color: #757575 !important;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    background: #fafbfc !important;
    border-bottom: 1px solid #eaecf0 !important;
}
.op-table :deep(.v-data-table__tr td) {
    border-bottom: 1px solid #f5f5f5 !important;
}
.op-table :deep(.v-data-table__tr:hover td) {
    background: #fafbfc !important;
}
</style>
