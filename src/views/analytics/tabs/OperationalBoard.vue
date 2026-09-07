<script setup lang="ts">
/**
 * Tab B: Operational Board
 * View2 (Process Analytics) 차트 형태 — 병목·좀비·지연 데이터를 bar/heatmap/stacked/topN 형태로 시각화
 */
import { onMounted, ref, computed, getCurrentInstance, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAnalysisDashboardStore } from '@/stores/analytics/analysisDashboardStore';
import { buildProcessHierarchyQuery, PROCESS_HIERARCHY_ENTRY, PROCESS_HIERARCHY_MODE } from '@/views/process-hierarchy/navigation';

import type { AnalysisDashboardFilters } from '@/stores/analytics/analysisDashboardStore';

const props = defineProps<{
    filters: AnalysisDashboardFilters;
}>();

const instance = getCurrentInstance();
const t = (key: string) => instance?.proxy?.$t(key) || key;
const router = useRouter();

const store = useAnalysisDashboardStore();
const zombieFilter = ref<'all' | '3month' | '6month'>('all');
const snackbar = ref(false);
const snackbarMsg = ref('');
const snackbarColor = ref('info');
const activeTopNCategory = ref('delayed');

const PALETTE = ['#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EC4899', '#6366F1', '#EF4444'];
const HEAT_COLORS = ['#f1f5f9', '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8'];

// ── Navigation / Actions ──
function openProcess(procDefId: string, name: string | null) {
    router.push({
        name: 'Process Hierarchy',
        params: { id: procDefId },
        query: buildProcessHierarchyQuery({ name: name || procDefId, entry: PROCESS_HIERARCHY_ENTRY.ANALYSIS, mode: PROCESS_HIERARCHY_MODE.VIEW })
    });
}
async function requestRefresh(procDefId: string) {
    const result = await store.requestUpdate({ proc_def_id: procDefId });
    snackbarMsg.value = result.message;
    snackbarColor.value = result.success ? 'success' : 'warning';
    snackbar.value = true;
}
function hasRecipients(item: any): boolean {
    return Array.isArray(item.owner_roles) && item.owner_roles.length > 0;
}
async function onZombieFilterChange(filter: 'all' | '3month' | '6month') {
    zombieFilter.value = filter;
    await store.fetchZombieProcesses(filter);
}
async function exportToExcel() {
    try {
        const rows = store.bottleneckList.map((item) =>
            [item.rank, item.proc_def_name, item.domain, item.total_fte.toFixed(2), item.owner_department, item.task_count, item.oss_count].join(',')
        );
        const csv = ['Rank,Process Name,Domain,Total FTE,Owner,Tasks,OSS Count', ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bottleneck_top10_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    } catch (e) { console.error('Export error:', e); }
}

// ── Helpers ──
function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatNumber(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function heatLevel(value: number, max: number): number {
    if (max === 0 || !value) return 0;
    const r = value / max;
    if (r >= 0.8) return 4;
    if (r >= 0.6) return 3;
    if (r >= 0.35) return 2;
    if (r > 0) return 1;
    return 0;
}

// ═══════════════════════════════════════════════════════
// 1. 병목 FTE 활용 맵 (시스템 활용 맵 형태)
// ═══════════════════════════════════════════════════════
const maxFte = computed(() => Math.max(...store.bottleneckList.map(b => b.total_fte), 1));
const maxTaskCount = computed(() => Math.max(...store.bottleneckList.map(b => b.task_count), 1));
const bottleneckSummary = computed(() => {
    const list = store.bottleneckList;
    return {
        count: list.length,
        totalFte: list.reduce((s, b) => s + b.total_fte, 0),
        totalTasks: list.reduce((s, b) => s + b.task_count, 0)
    };
});

// ═══════════════════════════════════════════════════════
// 2. 부서별 병목 히트맵 (R&R 히트맵 형태)
// ═══════════════════════════════════════════════════════
const deptHeatmapData = computed(() => {
    const deptMap = new Map<string, { fte: number; tasks: number; oss: number; count: number }>();
    store.bottleneckList.forEach((b) => {
        const dept = b.owner_department || '미분류';
        const cur = deptMap.get(dept) || { fte: 0, tasks: 0, oss: 0, count: 0 };
        cur.fte += b.total_fte;
        cur.tasks += b.task_count;
        cur.oss += b.oss_count;
        cur.count += 1;
        deptMap.set(dept, cur);
    });
    return Array.from(deptMap.entries())
        .map(([dept, v]) => ({ dept, ...v }))
        .sort((a, b) => b.fte - a.fte);
});
const heatMaxFte = computed(() => Math.max(...deptHeatmapData.value.map(d => d.fte), 1));
const heatMaxTasks = computed(() => Math.max(...deptHeatmapData.value.map(d => d.tasks), 1));
const heatMaxOss = computed(() => Math.max(...deptHeatmapData.value.map(d => d.oss), 1));

// ═══════════════════════════════════════════════════════
// 3. FTE 등급 분포 (Task 유형 분포 형태)
// ═══════════════════════════════════════════════════════
const fteDistribution = computed(() => {
    const buckets = [
        { label: 'Critical (≥5)', min: 5, max: Infinity, color: '#EF4444', count: 0 },
        { label: 'High (3~5)', min: 3, max: 5, color: '#F59E0B', count: 0 },
        { label: 'Medium (1~3)', min: 1, max: 3, color: '#3B82F6', count: 0 },
        { label: 'Low (<1)', min: 0, max: 1, color: '#10B981', count: 0 }
    ];
    store.bottleneckList.forEach((b) => {
        const bucket = buckets.find(bk => b.total_fte >= bk.min && b.total_fte < bk.max);
        if (bucket) bucket.count++;
    });
    const total = store.bottleneckList.length || 1;
    return buckets.map(b => ({ ...b, pct: Math.round((b.count / total) * 100) }));
});

// ═══════════════════════════════════════════════════════
// 4. 좀비 프로세스 맵 (과제 맵 형태)
// ═══════════════════════════════════════════════════════
const zombieMaxDays = computed(() => Math.max(...store.zombieProcesses.map(z => z.days_since_update ?? 0), 1));

function zombieSeverity(days: number | null): { status: string; color: string } {
    const d = days ?? 0;
    if (d >= 180) return { status: 'R', color: '#EF4444' };
    if (d >= 90) return { status: 'A', color: '#F59E0B' };
    return { status: 'G', color: '#10B981' };
}

// ═══════════════════════════════════════════════════════
// 5. 프로세스별 병목 구성 비율 (프로세스별 Task 유형 비율 형태)
//    — FTE vs Task vs OSS 비율을 stacked bar로
// ═══════════════════════════════════════════════════════
const processRatioItems = computed(() => {
    const totalFte = bottleneckSummary.value.totalFte || 1;
    const totalTasks = bottleneckSummary.value.totalTasks || 1;
    return store.bottleneckList.map((b, i) => {
        const ftePct = Math.round((b.total_fte / totalFte) * 100);
        const taskPct = Math.round((b.task_count / totalTasks) * 100);
        return {
            name: b.proc_def_name || b.proc_def_id,
            domain: b.domain,
            color: PALETTE[i % PALETTE.length],
            segments: [
                { type: 'FTE', pct: ftePct, count: b.total_fte.toFixed(1), color: '#EF4444' },
                { type: 'Task', pct: taskPct, count: String(b.task_count), color: '#3B82F6' },
                { type: 'OSS', pct: b.oss_count > 0 ? Math.max(Math.round((b.oss_count / Math.max(...store.bottleneckList.map(x => x.oss_count), 1)) * 100), 5) : 0, count: String(b.oss_count), color: '#10B981' }
            ].filter(s => s.pct > 0),
            total: `FTE ${b.total_fte.toFixed(1)} / Task ${b.task_count}`
        };
    });
});

// ═══════════════════════════════════════════════════════
// 6. Top 5 이상 항목 (Top 5 이상 프로세스 형태)
//    — delayed review / pending reopen / zombie를 카테고리 탭으로
// ═══════════════════════════════════════════════════════
const topNCategories = computed(() => {
    const delayed = store.delayedReviews.slice(0, 5).map((d) => ({
        process: d.proc_def_name || d.proc_def_id,
        count: d.days_delayed,
        domain: d.domain,
        sub: d.actor_name || '-'
    }));
    const reopens = store.pendingReopens.slice(0, 5).map((r) => ({
        process: r.proc_def_name || r.proc_def_id,
        count: r.days_pending,
        domain: r.domain,
        sub: r.requester_name || '-'
    }));
    const zombieTop = [...store.zombieProcesses]
        .sort((a, b) => (b.days_since_update ?? 0) - (a.days_since_update ?? 0))
        .slice(0, 5)
        .map((z) => ({
            process: z.proc_def_name || z.proc_def_id,
            count: z.days_since_update ?? 0,
            domain: z.domain,
            sub: formatDate(z.last_modified_at)
        }));
    const fteTop = [...store.bottleneckList]
        .sort((a, b) => b.total_fte - a.total_fte)
        .slice(0, 5)
        .map((b) => ({
            process: b.proc_def_name || b.proc_def_id,
            count: parseFloat(b.total_fte.toFixed(1)),
            domain: b.domain,
            sub: b.owner_department
        }));
    return [
        { key: 'delayed', label: t('analysisDashboard.delayedReview'), color: '#F59E0B', icon: 'mdi-timer-sand', desc: '지연 일수', items: delayed },
        { key: 'reopen', label: t('analysisDashboard.reopenPending'), color: '#EF4444', icon: 'mdi-undo-variant', desc: '대기 일수', items: reopens },
        { key: 'zombie', label: t('analysisDashboard.staleTitle'), color: '#8B5CF6', icon: 'mdi-clock-alert-outline', desc: '미갱신 일수', items: zombieTop },
        { key: 'fte', label: 'FTE Top 5', color: '#06B6D4', icon: 'mdi-fire', desc: 'Total FTE', items: fteTop }
    ];
});
const activeTopNData = computed(() => topNCategories.value.find(c => c.key === activeTopNCategory.value));
const topNMaxCount = computed(() => {
    const items = activeTopNData.value?.items || [];
    return Math.max(...items.map(i => i.count), 1);
});

// ── Lifecycle ──
onMounted(async () => {
    store.setFilters(props.filters);
    await store.fetchAllTabB();
});
watch(() => props.filters, (f) => { store.setFilters(f); }, { deep: true, immediate: true });
</script>

<template>
    <v-container fluid class="pa-5">
        <!-- Loading -->
        <div v-if="store.loading" class="d-flex flex-column align-center justify-center pa-16">
            <v-progress-circular indeterminate color="primary" size="48" />
            <p class="text-body-2 text-grey100 mt-4">데이터 로딩 중...</p>
        </div>

        <template v-else>
            <!-- ══ Row 1: 병목 FTE 맵 + 부서별 히트맵 + FTE 분포 ══ -->
            <v-row class="mb-4">
                <!-- 병목 FTE 활용 맵 (= 시스템 활용 맵) -->
                <v-col cols="12" lg="5">
                    <div class="analytics-card h-100">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">{{ t('analysisDashboard.bottleneckTitle') }}</h3>
                                <p class="card-subtitle">프로세스별 FTE 및 Task 수량</p>
                            </div>
                            <v-btn size="x-small" variant="tonal" color="primary" prepend-icon="mdi-download" class="text-none" @click="exportToExcel">CSV</v-btn>
                        </div>

                        <div class="column-header">
                            <div class="col-name">{{ t('analysisDashboard.processName') }}</div>
                            <div class="col-center">FTE</div>
                            <div class="col-bar">{{ t('analysisDashboard.taskCount') }}</div>
                        </div>

                        <div v-if="store.bottleneckList.length === 0" class="empty-hint">
                            <v-icon icon="mdi-chart-box-outline" size="32" color="grey-lighten-1" />
                            <span class="text-caption text-grey100 mt-1">{{ t('analysisDashboard.noData') }}</span>
                        </div>

                        <div v-else class="system-list">
                            <div
                                v-for="(item, i) in store.bottleneckList"
                                :key="item.proc_def_id"
                                class="system-row"
                                @click="openProcess(item.proc_def_id, item.proc_def_name)"
                            >
                                <div class="sys-name">
                                    <span class="rank-dot" :class="{ 'rank-top': item.rank <= 3 }">{{ item.rank }}</span>
                                    <div class="sys-text">
                                        <span class="sys-label">{{ item.proc_def_name || item.proc_def_id }}</span>
                                        <span class="sys-tag" :style="{ color: PALETTE[i % PALETTE.length] + '99' }">{{ item.domain }} · {{ item.owner_department }}</span>
                                    </div>
                                </div>
                                <div class="sys-count">
                                    <span class="count-badge" :style="{ color: item.total_fte >= 5 ? '#EF4444' : item.total_fte >= 2 ? '#F59E0B' : '#3B82F6', backgroundColor: (item.total_fte >= 5 ? '#EF4444' : item.total_fte >= 2 ? '#F59E0B' : '#3B82F6') + '15' }">
                                        {{ item.total_fte.toFixed(1) }}
                                    </span>
                                </div>
                                <div class="sys-bar">
                                    <div class="bar-track">
                                        <div class="bar-fill" :style="{ width: Math.round((item.task_count / maxTaskCount) * 100) + '%', backgroundColor: PALETTE[i % PALETTE.length] + 'BB' }" />
                                    </div>
                                    <span class="bar-value" :style="{ color: PALETTE[i % PALETTE.length] }">{{ formatNumber(item.task_count) }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="card-footer" v-if="store.bottleneckList.length > 0">
                            <div class="footer-stat" v-for="s in [
                                { label: t('analysisDashboard.totalProcesses'), value: bottleneckSummary.count + '개', cls: 'text-textPrimary' },
                                { label: '총 FTE', value: bottleneckSummary.totalFte.toFixed(1), cls: 'text-error' },
                                { label: '총 Task', value: formatNumber(bottleneckSummary.totalTasks) + '건', cls: 'text-primary' }
                            ]" :key="s.label">
                                <span class="footer-value" :class="s.cls">{{ s.value }}</span>
                                <span class="footer-label">{{ s.label }}</span>
                            </div>
                        </div>
                    </div>
                </v-col>

                <!-- 부서별 병목 히트맵 (= R&R 히트맵) -->
                <v-col cols="12" lg="4">
                    <div class="analytics-card h-100">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">{{ t('analysisDashboard.department') }} 병목 히트맵</h3>
                                <p class="card-subtitle">부서별 FTE · Task · OSS 집중도</p>
                            </div>
                            <v-btn icon="mdi-dots-horizontal" size="x-small" variant="text" color="grey" />
                        </div>

                        <div v-if="deptHeatmapData.length === 0" class="empty-hint">
                            <v-icon icon="mdi-grid" size="32" color="grey-lighten-1" />
                            <span class="text-caption text-grey100 mt-1">{{ t('analysisDashboard.noData') }}</span>
                        </div>

                        <div v-else class="heatmap-wrapper">
                            <table class="heatmap-table">
                                <thead>
                                    <tr>
                                        <th class="ht-dept">{{ t('analysisDashboard.department') }}</th>
                                        <th class="ht-cell">FTE</th>
                                        <th class="ht-cell">Task</th>
                                        <th class="ht-cell">OSS</th>
                                        <th class="ht-cell">건수</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="row in deptHeatmapData" :key="row.dept">
                                        <td class="ht-dept-name">{{ row.dept }}</td>
                                        <td class="ht-cell">
                                            <div class="heat-cell" :style="{ backgroundColor: HEAT_COLORS[heatLevel(row.fte, heatMaxFte)] }">
                                                {{ row.fte.toFixed(1) }}
                                            </div>
                                        </td>
                                        <td class="ht-cell">
                                            <div class="heat-cell" :style="{ backgroundColor: HEAT_COLORS[heatLevel(row.tasks, heatMaxTasks)] }">
                                                {{ row.tasks }}
                                            </div>
                                        </td>
                                        <td class="ht-cell">
                                            <div class="heat-cell" :style="{ backgroundColor: HEAT_COLORS[heatLevel(row.oss, heatMaxOss)] }">
                                                {{ row.oss }}
                                            </div>
                                        </td>
                                        <td class="ht-cell">
                                            <div class="heat-cell" style="background: #f1f5f9;">{{ row.count }}</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div class="heat-legend">
                                <span class="text-caption text-grey100">낮음</span>
                                <div v-for="(c, i) in HEAT_COLORS" :key="i" class="legend-swatch" :style="{ backgroundColor: c }" />
                                <span class="text-caption text-grey100">높음</span>
                            </div>
                        </div>
                    </div>
                </v-col>

                <!-- FTE 등급 분포 (= Task 유형 분포) -->
                <v-col cols="12" lg="3">
                    <div class="analytics-card h-100">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">FTE 등급 분포</h3>
                                <p class="card-subtitle">전체 {{ store.bottleneckList.length }}개 프로세스 기준</p>
                            </div>
                            <v-btn icon="mdi-dots-horizontal" size="x-small" variant="text" color="grey" />
                        </div>

                        <div v-if="store.bottleneckList.length === 0" class="empty-hint">
                            <v-icon icon="mdi-chart-donut" size="32" color="grey-lighten-1" />
                            <span class="text-caption text-grey100 mt-1">{{ t('analysisDashboard.noData') }}</span>
                        </div>

                        <div v-else class="task-type-list">
                            <div v-for="b in fteDistribution" :key="b.label" class="task-type-item">
                                <div class="task-type-header">
                                    <span class="task-type-label">{{ b.label }}</span>
                                    <span class="task-type-value">{{ b.count }}개 ({{ b.pct }}%)</span>
                                </div>
                                <div class="task-type-bar-track">
                                    <div class="task-type-bar-fill" :style="{ width: b.pct + '%', backgroundColor: b.color }" />
                                </div>
                            </div>
                        </div>
                    </div>
                </v-col>
            </v-row>

            <!-- ══ Row 2: 좀비 프로세스 맵 (= 과제 맵) ══ -->
            <div class="analytics-card mb-4">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">{{ t('analysisDashboard.staleTitle') }}</h3>
                        <p class="card-subtitle">장기 미갱신 프로세스 현황 · 경과일 기준</p>
                    </div>
                    <div class="d-flex ga-2">
                        <button
                            v-for="opt in [
                                { key: 'all', label: t('analysisDashboard.all') },
                                { key: '3month', label: '3' + t('analysisDashboard.monthsInactive') },
                                { key: '6month', label: '6' + t('analysisDashboard.monthsInactive') }
                            ]"
                            :key="opt.key"
                            class="filter-pill"
                            :class="{ active: zombieFilter === opt.key }"
                            @click="onZombieFilterChange(opt.key as any)"
                        >{{ opt.label }}</button>
                    </div>
                </div>

                <div class="project-header">
                    <div class="ph-name">{{ t('analysisDashboard.processName') }}</div>
                    <div class="ph-center">{{ t('analysisDashboard.status') }}</div>
                    <div class="ph-center">{{ t('analysisDashboard.lastModified') }}</div>
                    <div class="ph-bar">{{ t('analysisDashboard.elapsedDays') }}</div>
                    <div class="ph-progress">액션</div>
                </div>

                <div v-if="store.zombieProcesses.length === 0" class="empty-hint">
                    <v-icon icon="mdi-check-circle-outline" size="32" color="success" />
                    <span class="text-caption text-grey100 mt-1">{{ t('analysisDashboard.noData') }}</span>
                </div>

                <div v-else class="project-list">
                    <div v-for="(item, i) in store.zombieProcesses" :key="item.proc_def_id" class="project-row">
                        <div class="proj-name">
                            <span class="proj-indicator" :style="{ backgroundColor: zombieSeverity(item.days_since_update).color }" />
                            <div class="proj-text">
                                <a href="javascript:void(0)" class="proj-label process-link" @click="openProcess(item.proc_def_id, item.proc_def_name)">
                                    {{ item.proc_def_name || item.proc_def_id }}
                                </a>
                                <span class="proj-tag">{{ item.domain }}</span>
                            </div>
                        </div>
                        <div class="proj-metric">
                            <v-chip :color="item.current_status === 'draft' ? 'grey' : 'warning'" size="x-small" variant="tonal" label>
                                {{ item.current_status }}
                            </v-chip>
                        </div>
                        <div class="proj-metric">
                            <span class="metric-label">{{ formatDate(item.last_modified_at) }}</span>
                        </div>
                        <div class="proj-breakdown">
                            <div class="d-flex align-center ga-2">
                                <span class="metric-big" :style="{ color: zombieSeverity(item.days_since_update).color }">
                                    {{ item.days_since_update ?? '-' }}
                                </span>
                                <span class="metric-label">{{ t('analysisDashboard.days') }}</span>
                            </div>
                            <div class="stacked-bar" style="height: 6px;">
                                <div class="stacked-seg" :style="{ width: Math.round(((item.days_since_update ?? 0) / zombieMaxDays) * 100) + '%', backgroundColor: zombieSeverity(item.days_since_update).color + 'CC' }" />
                            </div>
                        </div>
                        <div class="proj-progress d-flex justify-end">
                            <v-btn
                                variant="tonal"
                                density="compact"
                                size="x-small"
                                color="warning"
                                class="text-none"
                                :disabled="!hasRecipients(item)"
                                @click.stop="requestRefresh(item.proc_def_id)"
                            >
                                <v-icon start size="12">mdi-bell-ring-outline</v-icon>
                                {{ t('analysisDashboard.refreshRequest') }}
                                <v-tooltip v-if="!hasRecipients(item)" activator="parent" location="top">{{ t('analysisDashboard.noRecipients') }}</v-tooltip>
                            </v-btn>
                        </div>
                    </div>
                </div>

                <div class="card-footer" v-if="store.zombieProcesses.length > 0">
                    <div class="footer-stat" v-for="s in [
                        { label: '총 좀비 프로세스', value: store.zombieTotalCount + '개', cls: 'text-textPrimary' },
                        { label: '180일+ (위험)', value: store.zombieProcesses.filter(z => (z.days_since_update ?? 0) >= 180).length + '개', cls: 'text-error' },
                        { label: '90~180일 (주의)', value: store.zombieProcesses.filter(z => { const d = z.days_since_update ?? 0; return d >= 90 && d < 180; }).length + '개', cls: 'text-warning' }
                    ]" :key="s.label">
                        <span class="footer-value" :class="s.cls">{{ s.value }}</span>
                        <span class="footer-label">{{ s.label }}</span>
                    </div>
                </div>
            </div>

            <!-- ══ Row 3: 프로세스별 병목 구성 비율 (= 프로세스별 Task 유형 비율) ══ -->
            <div class="analytics-card mb-4">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">프로세스별 병목 구성 비율</h3>
                        <p class="card-subtitle">FTE · Task · OSS 전체 대비 점유율</p>
                    </div>
                    <v-btn icon="mdi-dots-horizontal" size="x-small" variant="text" color="grey" />
                </div>

                <div class="ratio-legend">
                    <span v-for="l in [
                        { label: 'FTE', color: '#EF4444' },
                        { label: 'Task', color: '#3B82F6' },
                        { label: 'OSS', color: '#10B981' }
                    ]" :key="l.label" class="ratio-legend-item">
                        <span class="legend-swatch-sm" :style="{ backgroundColor: l.color }" />
                        {{ l.label }}
                    </span>
                </div>

                <div class="ratio-header">
                    <div class="rh-name">{{ t('analysisDashboard.processName') }}</div>
                    <div class="rh-total">{{ t('analysisDashboard.domain') }}</div>
                    <div class="rh-bar">비중</div>
                    <div class="rh-auto">상세</div>
                </div>

                <div v-if="processRatioItems.length === 0" class="empty-hint">
                    <v-icon icon="mdi-chart-box-outline" size="32" color="grey-lighten-1" />
                    <span class="text-caption text-grey100 mt-1">{{ t('analysisDashboard.noData') }}</span>
                </div>

                <div v-else class="ratio-list">
                    <div v-for="proc in processRatioItems" :key="proc.name" class="ratio-row" @click="openProcess(proc.name, proc.name)">
                        <div class="ratio-name">
                            <span class="ratio-name-text">{{ proc.name }}</span>
                        </div>
                        <div class="ratio-total">
                            <v-chip size="x-small" variant="tonal" color="grey">{{ proc.domain }}</v-chip>
                        </div>
                        <div class="ratio-bar-area">
                            <div class="stacked-bar ratio-bar">
                                <template v-for="seg in proc.segments" :key="seg.type">
                                    <div
                                        v-if="seg.pct > 0"
                                        class="stacked-seg ratio-seg"
                                        :title="`${seg.type}: ${seg.count}`"
                                        :style="{ width: seg.pct + '%', backgroundColor: seg.color + 'CC', minWidth: '14px' }"
                                    >
                                        <span v-if="seg.pct >= 12" class="seg-label">{{ seg.pct }}%</span>
                                    </div>
                                </template>
                            </div>
                            <div class="ratio-chips">
                                <span v-for="seg in proc.segments" :key="seg.type" class="ratio-chip" :style="{ color: seg.color }">
                                    <span class="chip-dot" :style="{ backgroundColor: seg.color }" />
                                    {{ seg.type }} {{ seg.count }}
                                </span>
                            </div>
                        </div>
                        <div class="ratio-auto">
                            <span class="text-caption text-medium-emphasis">{{ proc.total }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ══ Row 4: Top 5 이상 항목 (= Top 5 이상 프로세스) ══ -->
            <div class="analytics-card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">Top 5 이상 항목</h3>
                        <p class="card-subtitle">유형별 상위 5개 프로세스 · 값 기준 내림차순</p>
                    </div>
                    <v-btn icon="mdi-dots-horizontal" size="x-small" variant="text" color="grey" />
                </div>

                <div class="topn-pills">
                    <button
                        v-for="cat in topNCategories"
                        :key="cat.key"
                        class="topn-pill"
                        :class="{ active: activeTopNCategory === cat.key }"
                        :style="activeTopNCategory === cat.key ? { backgroundColor: cat.color + '15', borderColor: cat.color + '66', color: cat.color } : {}"
                        @click="activeTopNCategory = cat.key"
                    >
                        <v-icon :icon="cat.icon" size="14" />
                        {{ cat.label }}
                    </button>
                </div>

                <div v-if="!activeTopNData || activeTopNData.items.length === 0" class="empty-hint">
                    <v-icon icon="mdi-alert-circle-outline" size="32" color="grey-lighten-1" />
                    <span class="text-caption text-grey100 mt-1">해당 유형 데이터 없음</span>
                </div>

                <div v-else class="topn-grid">
                    <div v-for="(item, idx) in activeTopNData.items" :key="item.process" class="topn-card">
                        <div class="topn-card-head">
                            <span class="topn-rank" :style="{ color: idx === 0 ? activeTopNData.color : '#94a3b8' }">#{{ idx + 1 }}</span>
                            <v-chip size="x-small" variant="tonal" color="grey">{{ item.domain }}</v-chip>
                        </div>
                        <p class="topn-name">{{ item.process }}</p>
                        <p class="topn-sub">{{ item.sub }}</p>
                        <div class="topn-metric">
                            <span class="topn-desc">{{ activeTopNData.desc }}</span>
                            <span class="topn-count" :style="{ color: activeTopNData.color }">{{ item.count }}</span>
                        </div>
                        <div class="topn-bar-track">
                            <div class="topn-bar-fill" :style="{ width: Math.round((item.count / topNMaxCount) * 100) + '%', backgroundColor: activeTopNData.color + 'CC' }" />
                        </div>
                    </div>
                </div>

                <div class="topn-footer" v-if="activeTopNData && activeTopNData.items.length > 0">
                    <button
                        v-for="cat in topNCategories"
                        :key="cat.key"
                        class="topn-footer-btn"
                        :style="{ color: activeTopNCategory === cat.key ? cat.color : '#94a3b8', opacity: activeTopNCategory === cat.key ? 1 : 0.7 }"
                        @click="activeTopNCategory = cat.key"
                    >
                        <v-icon :icon="cat.icon" size="12" />
                        {{ cat.label }}
                        <strong :style="{ color: cat.color }" class="ml-1">{{ cat.items.length > 0 ? cat.items[0].count : 0 }}</strong>
                    </button>
                    <span class="topn-footer-note">최고 값 기준 정렬</span>
                </div>
            </div>
        </template>

        <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor" location="bottom right" rounded="lg">
            <v-icon start size="18">mdi-information-outline</v-icon>
            {{ snackbarMsg }}
        </v-snackbar>
    </v-container>
</template>

<style scoped>
/* ── Analytics Card ── */
.analytics-card { background: #ffffff; border: 1px solid #e5eaef; border-radius: 16px; padding: 20px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.card-title { font-size: 14px; font-weight: 700; color: #2a3547; margin: 0; }
.card-subtitle { font-size: 12px; color: #707a82; margin: 2px 0 0 0; }
.card-footer { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5eaef; text-align: center; }
.footer-stat { display: flex; flex-direction: column; align-items: center; }
.footer-value { font-size: 14px; font-weight: 700; }
.footer-label { font-size: 11px; color: #707a82; margin-top: 2px; }
.empty-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 16px; }
.process-link { color: #1565c0; text-decoration: none; font-size: 13px; font-weight: 500; transition: color 0.15s; }
.process-link:hover { color: #0d47a1; text-decoration: underline; }

/* ── 1. 시스템 활용 맵 형태 ── */
.column-header { display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 8px; padding: 0 8px 8px; margin-bottom: 4px; border-bottom: 1px solid #e5eaef; font-size: 12px; font-weight: 600; color: #707a82; }
.col-name {} .col-center { text-align: center; } .col-bar { text-align: right; }
.system-list { display: flex; flex-direction: column; gap: 2px; }
.system-row { display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 8px; align-items: center; padding: 8px; border-radius: 10px; transition: background 0.15s; cursor: pointer; }
.system-row:hover { background: #f8f9fa; }
.sys-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rank-dot { width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: #f1f5f9; color: #707a82; flex-shrink: 0; }
.rank-dot.rank-top { background: linear-gradient(135deg, #ff6b6b, #ee5a24); color: #fff; }
.sys-text { display: flex; flex-direction: column; min-width: 0; }
.sys-label { font-size: 12px; font-weight: 700; color: #2a3547; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sys-tag { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sys-count { display: flex; justify-content: center; }
.count-badge { font-size: 13px; font-weight: 700; padding: 2px 8px; border-radius: 6px; font-variant-numeric: tabular-nums; }
.sys-bar { display: flex; align-items: center; gap: 8px; }
.bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.7s ease; }
.bar-value { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; width: 36px; text-align: right; flex-shrink: 0; }

/* ── 2. 히트맵 ── */
.heatmap-wrapper { overflow-x: auto; }
.heatmap-table { width: 100%; font-size: 12px; border-collapse: separate; border-spacing: 3px; }
.heatmap-table thead th { font-weight: 600; color: #707a82; padding: 4px 6px 8px; text-align: center; }
.ht-dept { text-align: left !important; }
.ht-dept-name { font-size: 12px; color: #707a82; padding-right: 8px; white-space: nowrap; max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
.ht-cell { padding: 2px; }
.heat-cell { width: 52px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: #2a3547; margin: 0 auto; }
.heat-legend { display: flex; align-items: center; gap: 4px; margin-top: 12px; }
.legend-swatch { width: 24px; height: 12px; border-radius: 3px; }

/* ── 3. 유형 분포 ── */
.task-type-list { display: flex; flex-direction: column; gap: 10px; }
.task-type-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
.task-type-label { font-size: 12px; color: #707a82; }
.task-type-value { font-size: 12px; font-weight: 600; color: #2a3547; }
.task-type-bar-track { height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.task-type-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }

/* ── 4. 과제 맵 형태 ── */
.filter-pill { padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; border: 1px solid #e5eaef; background: transparent; color: #707a82; cursor: pointer; transition: all 0.15s; }
.filter-pill:hover { border-color: #cbd5e1; }
.filter-pill.active { background: #EFF6FF; border-color: #93C5FD; color: #2563EB; }
.project-header { display: grid; grid-template-columns: 2.5fr 1fr 1fr 2fr 1fr; gap: 12px; padding: 0 12px 10px; border-bottom: 1px solid #e5eaef; font-size: 12px; font-weight: 600; color: #707a82; margin-bottom: 4px; }
.ph-name {} .ph-center { text-align: center; } .ph-bar {} .ph-progress { text-align: right; }
.project-list { display: flex; flex-direction: column; gap: 4px; }
.project-row { display: grid; grid-template-columns: 2.5fr 1fr 1fr 2fr 1fr; gap: 12px; align-items: center; padding: 12px; border-radius: 12px; border: 1px solid transparent; transition: all 0.15s; }
.project-row:hover { background: #f8f9fa; border-color: #e5eaef; }
.proj-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.proj-indicator { width: 6px; height: 36px; border-radius: 3px; flex-shrink: 0; }
.proj-text { display: flex; flex-direction: column; min-width: 0; }
.proj-label { font-size: 13px; font-weight: 700; color: #2a3547; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proj-tag { font-size: 11px; color: #707a82; margin-top: 2px; }
.proj-metric { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.metric-big { font-size: 20px; font-weight: 900; font-variant-numeric: tabular-nums; }
.metric-label { font-size: 11px; color: #707a82; }
.proj-breakdown { display: flex; flex-direction: column; gap: 6px; }
.stacked-bar { height: 12px; display: flex; border-radius: 6px; overflow: hidden; gap: 1px; width: 100%; background: #f1f5f9; }
.stacked-seg { height: 100%; transition: width 0.7s ease; }
.proj-progress { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

/* ── 5. 비율 차트 ── */
.ratio-legend { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.ratio-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #707a82; }
.legend-swatch-sm { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.ratio-header { display: grid; grid-template-columns: 2fr 1fr 4fr 1.5fr; gap: 8px; padding: 0 12px 10px; border-bottom: 1px solid #e5eaef; font-size: 12px; font-weight: 600; color: #707a82; }
.rh-name {} .rh-total { text-align: center; } .rh-bar {} .rh-auto { text-align: right; }
.ratio-list { display: flex; flex-direction: column; }
.ratio-row { display: grid; grid-template-columns: 2fr 1fr 4fr 1.5fr; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; cursor: pointer; }
.ratio-row:hover { background: #f8f9fa; }
.ratio-name { min-width: 0; }
.ratio-name-text { font-size: 12px; font-weight: 600; color: #2a3547; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.ratio-total { text-align: center; }
.ratio-bar-area { display: flex; flex-direction: column; gap: 6px; }
.ratio-bar { height: 16px; border-radius: 6px; }
.ratio-seg { display: flex; align-items: center; justify-content: center; }
.seg-label { font-size: 9px; font-weight: 700; color: rgba(255, 255, 255, 0.9); }
.ratio-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ratio-chip { display: flex; align-items: center; gap: 3px; font-size: 11px; font-variant-numeric: tabular-nums; }
.chip-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.ratio-auto { display: flex; flex-direction: column; align-items: flex-end; }

/* ── 6. Top 5 ── */
.topn-pills { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.topn-pill { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid #e5eaef; background: transparent; color: #94a3b8; cursor: pointer; transition: all 0.15s; }
.topn-pill:hover { border-color: #cbd5e1; }
.topn-pill.active { border-color: currentColor; }
.topn-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
@media (max-width: 960px) { .topn-grid { grid-template-columns: repeat(2, 1fr); } }
.topn-card { background: #f8f9fa; border: 1px solid #e5eaef; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: all 0.15s; }
.topn-card:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); }
.topn-card-head { display: flex; align-items: center; justify-content: space-between; }
.topn-rank { font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums; line-height: 1; }
.topn-name { font-size: 12px; font-weight: 600; color: #2a3547; line-height: 1.4; min-height: 34px; margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.topn-sub { font-size: 11px; color: #94a3b8; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topn-metric { display: flex; align-items: flex-end; justify-content: space-between; }
.topn-desc { font-size: 11px; color: #707a82; }
.topn-count { font-size: 16px; font-weight: 900; font-variant-numeric: tabular-nums; }
.topn-bar-track { height: 6px; background: #e5eaef; border-radius: 3px; overflow: hidden; }
.topn-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.topn-footer { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5eaef; }
.topn-footer-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; background: none; border: none; cursor: pointer; transition: opacity 0.15s; padding: 0; }
.topn-footer-btn:hover { opacity: 1 !important; }
.topn-footer-note { margin-left: auto; font-size: 11px; color: #94a3b8; }

/* ── Responsive ── */
@media (max-width: 960px) {
    .project-header, .project-row { grid-template-columns: 1fr; }
    .project-header .ph-center, .project-header .ph-bar, .project-header .ph-progress { display: none; }
    .ratio-header, .ratio-row { grid-template-columns: 1fr; }
    .ratio-header .rh-total, .ratio-header .rh-bar, .ratio-header .rh-auto { display: none; }
}
</style>
