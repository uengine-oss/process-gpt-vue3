<template>
    <v-card elevation="10" class="rounded-xl usage-adoption">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">사용 활성도 대시보드</h1>
                <p class="page-subtitle">소속별 접속, BPMN 조회/편집, 사용자 기여도, 재방문 흐름을 확인합니다.</p>
            </div>
            <div class="page-header-right">
                <v-btn color="primary" variant="flat" :loading="loading" prepend-icon="mdi-refresh" @click="refresh">
                    새로고침
                </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4">
            <v-alert v-if="dashboard?.tableMissing" type="warning" variant="tonal" class="mb-4">
                {{ $t('usageAdoption.migrationRequired') }}
            </v-alert>
            <v-alert v-else-if="dashboard?.error" type="error" variant="tonal" class="mb-4">
                {{ dashboard.error }}
            </v-alert>

            <div v-if="loading && !dashboard" class="loading-state">
                <v-progress-circular indeterminate color="primary" size="42" width="4" />
                <span>{{ $t('common.loading') || 'Loading...' }}</span>
            </div>

            <template v-else>
                <div class="metric-grid">
                    <div class="metric-box">
                        <span>{{ $t('usageAdoption.totalUsers') }}</span>
                        <strong>{{ formatNumber(summary.totalUsers) }}</strong>
                    </div>
                    <div class="metric-box accent-green">
                        <span>{{ $t('usageAdoption.activeUsers') }}</span>
                        <strong>{{ formatNumber(summary.activeUsers) }}</strong>
                        <em>{{ formatPercent(summary.activationRate) }}</em>
                    </div>
                    <div class="metric-box accent-amber">
                        <span>{{ $t('usageAdoption.modelViews') }}</span>
                        <strong>{{ formatNumber(summary.totalModelViews) }}</strong>
                    </div>
                    <div class="metric-box accent-red">
                        <span>{{ $t('usageAdoption.modelEdits') }}</span>
                        <strong>{{ formatNumber(summary.totalModelEdits) }}</strong>
                    </div>
                    <div class="metric-box accent-cyan">
                        <span>{{ $t('usageAdoption.activeTime') }}</span>
                        <strong>{{ formatDuration(summary.totalActiveDurationMs) }}</strong>
                    </div>
                </div>

                <section class="dashboard-section">
                    <div class="section-heading">
                        <h3>{{ $t('usageAdoption.whosIn') }}</h3>
                        <p>{{ $t('usageAdoption.whosInDesc') }}</p>
                    </div>
                    <div class="split-grid">
                        <div class="panel wide">
                            <h4>{{ $t('usageAdoption.teamActivation') }}</h4>
                            <div class="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{{ $t('usageAdoption.team') }}</th>
                                            <th>{{ $t('usageAdoption.members') }}</th>
                                            <th>{{ $t('usageAdoption.accessed') }}</th>
                                            <th>{{ $t('usageAdoption.activationRate') }}</th>
                                            <th>{{ $t('usageAdoption.avgStay') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="team in topTeams" :key="team.teamId">
                                            <td>{{ team.teamName }}</td>
                                            <td>{{ formatNumber(team.totalMembers) }}</td>
                                            <td>{{ formatNumber(team.activeUsers) }}</td>
                                            <td>
                                                <div class="bar-cell">
                                                    <span>{{ formatPercent(team.activationRate) }}</span>
                                                    <div class="bar-track">
                                                        <i :style="{ width: percentWidth(team.activationRate) }" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{{ formatDuration(team.avgDurationMs) }}</td>
                                        </tr>
                                        <tr v-if="topTeams.length === 0">
                                            <td colspan="5" class="empty">{{ $t('usageAdoption.noData') }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="panel">
                            <h4>{{ $t('usageAdoption.weeklyTopTeams') }}</h4>
                            <ol class="rank-list">
                                <li v-for="team in dashboard?.dauWauRanking || []" :key="team.teamId">
                                    <span>{{ team.teamName }}</span>
                                    <strong>WAU {{ formatNumber(team.wau) }} / DAU {{ formatNumber(team.dau) }}</strong>
                                </li>
                            </ol>
                            <div v-if="!dashboard?.dauWauRanking?.length" class="empty block">{{ $t('usageAdoption.noData') }}</div>
                        </div>
                    </div>
                </section>

                <section class="dashboard-section">
                    <div class="section-heading">
                        <h3>{{ $t('usageAdoption.whatDoing') }}</h3>
                        <p>{{ $t('usageAdoption.whatDoingDesc') }}</p>
                    </div>
                    <div class="split-grid">
                        <div class="panel">
                            <h4>{{ $t('usageAdoption.topModels') }}</h4>
                            <ol class="rank-list compact">
                                <li v-for="model in dashboard?.modelTop || []" :key="model.procDefId">
                                    <span>{{ model.modelName }}</span>
                                    <strong>{{ formatNumber(model.viewCount) }} hit</strong>
                                </li>
                            </ol>
                            <div v-if="!dashboard?.modelTop?.length" class="empty block">{{ $t('usageAdoption.noData') }}</div>
                        </div>
                        <div class="panel wide">
                            <h4>{{ $t('usageAdoption.editViewMix') }}</h4>
                            <div class="mix-list">
                                <div v-for="team in editViewTeams" :key="team.teamId" class="mix-row">
                                    <div class="mix-meta">
                                        <span>{{ team.teamName }}</span>
                                        <em>{{ formatNumber(team.modelEdits) }} edit / {{ formatNumber(team.modelViews) }} view</em>
                                    </div>
                                    <div class="stacked-bar">
                                        <i class="edit" :style="{ width: mixWidth(team, 'edit') }" />
                                        <i class="view" :style="{ width: mixWidth(team, 'view') }" />
                                    </div>
                                </div>
                                <div v-if="editViewTeams.length === 0" class="empty block">{{ $t('usageAdoption.noData') }}</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="dashboard-section">
                    <div class="section-heading">
                        <h3>{{ $t('usageAdoption.heroes') }}</h3>
                        <p>{{ $t('usageAdoption.heroesDesc') }}</p>
                    </div>
                    <div class="hero-grid">
                        <div class="panel">
                            <h4>{{ $t('usageAdoption.frequentVisitors') }}</h4>
                            <ul class="person-list">
                                <li v-for="user in dashboard?.heroes.frequentVisitors || []" :key="user.userKey">
                                    <span>{{ user.userName }}</span>
                                    <em>{{ user.teamName }}</em>
                                    <strong>{{ user.activeDays }}d</strong>
                                </li>
                            </ul>
                        </div>
                        <div class="panel">
                            <h4>{{ $t('usageAdoption.topEditors') }}</h4>
                            <ul class="person-list">
                                <li v-for="user in dashboard?.heroes.topEditors || []" :key="user.userKey">
                                    <span>{{ user.userName }}</span>
                                    <em>{{ user.teamName }}</em>
                                    <strong>{{ formatNumber(user.value) }}</strong>
                                </li>
                            </ul>
                        </div>
                        <div class="panel">
                            <h4>{{ $t('usageAdoption.longestSessions') }}</h4>
                            <ul class="person-list">
                                <li v-for="user in dashboard?.heroes.longestSessions || []" :key="`${user.userKey}-${user.durationMs}`">
                                    <span>{{ user.userName }}</span>
                                    <em>{{ user.teamName }}</em>
                                    <strong>{{ formatDuration(user.durationMs || 0) }}</strong>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section class="dashboard-section">
                    <div class="section-heading">
                        <h3>{{ $t('usageAdoption.stickiness') }}</h3>
                        <p>{{ $t('usageAdoption.stickinessDesc') }}</p>
                    </div>
                    <div class="split-grid">
                        <div class="panel">
                            <h4>{{ $t('usageAdoption.retention') }}</h4>
                            <div class="retention-list">
                                <div v-for="team in retentionTeams" :key="team.teamId" class="retention-row">
                                    <span>{{ team.teamName }}</span>
                                    <strong>{{ formatPercent(team.retentionRate) }}</strong>
                                    <em>{{ team.returningUsers }}/{{ team.previousActiveUsers }}</em>
                                </div>
                                <div v-if="retentionTeams.length === 0" class="empty block">{{ $t('usageAdoption.noData') }}</div>
                            </div>
                        </div>
                        <div class="panel wide">
                            <h4>{{ $t('usageAdoption.lastSeen') }}</h4>
                            <div class="timeline">
                                <div v-for="team in lastSeenTeams" :key="team.teamId" class="timeline-row">
                                    <span>{{ team.teamName }}</span>
                                    <i />
                                    <strong>{{ formatDate(team.lastSeen) }}</strong>
                                </div>
                                <div v-if="lastSeenTeams.length === 0" class="empty block">{{ $t('usageAdoption.noData') }}</div>
                            </div>
                        </div>
                    </div>
                </section>
            </template>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getUsageAdoptionDashboard, type TeamUsageMetric, type UsageAdoptionDashboard } from '@/services/usageAnalytics';
import { formatKST } from '@/utils/datetime';

const loading = ref(false);
const dashboard = ref<UsageAdoptionDashboard | null>(null);

const summary = computed(
    () =>
        dashboard.value?.summary || {
            totalUsers: 0,
            activeUsers: 0,
            activationRate: 0,
            totalEvents: 0,
            totalActiveDurationMs: 0,
            totalModelViews: 0,
            totalModelEdits: 0
        }
);

const topTeams = computed(() => (dashboard.value?.teamActivity || []).slice(0, 10));
const editViewTeams = computed(() => (dashboard.value?.teamEditViewMix || []).slice(0, 10));
const retentionTeams = computed(() => (dashboard.value?.retention || []).filter((team) => team.previousActiveUsers > 0).slice(0, 8));
const lastSeenTeams = computed(() => (dashboard.value?.lastSeen || []).filter((team) => team.lastSeen).slice(0, 10));

async function refresh() {
    loading.value = true;
    try {
        dashboard.value = await getUsageAdoptionDashboard({ lookbackDays: 90, topLimit: 10 });
    } finally {
        loading.value = false;
    }
}

function formatNumber(value: number | null | undefined) {
    return new Intl.NumberFormat().format(value || 0);
}

function formatPercent(value: number | null | undefined) {
    return `${Math.round((value || 0) * 1000) / 10}%`;
}

function percentWidth(value: number | null | undefined) {
    return `${Math.min(100, Math.max(0, (value || 0) * 100))}%`;
}

function formatDuration(ms: number | null | undefined) {
    const totalSeconds = Math.floor((ms || 0) / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

function formatDate(value: string | null | undefined) {
    if (!value) return '-';
    return formatKST(value, 'MM-DD HH:mm');
}

function mixWidth(team: TeamUsageMetric, type: 'edit' | 'view') {
    const total = team.modelEdits + team.modelViews;
    if (total <= 0) return '0%';
    const value = type === 'edit' ? team.modelEdits : team.modelViews;
    return `${Math.max(4, Math.round((value / total) * 100))}%`;
}

onMounted(refresh);
</script>

<style scoped>
.page-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 20px;
}

.eyebrow {
    margin: 0 0 4px;
    color: #0f766e;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

h2,
h3,
h4,
p {
    margin: 0;
}

h2 {
    font-size: 24px;
    font-weight: 700;
}

.subtitle,
.section-heading p {
    margin-top: 6px;
    color: #6b7280;
    font-size: 13px;
}

.loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 240px;
}

.metric-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 24px;
}

.metric-box,
.panel {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}

.metric-box {
    min-height: 104px;
    padding: 16px;
    border-top: 4px solid #2563eb;
}

.metric-box span {
    display: block;
    color: #6b7280;
    font-size: 12px;
    font-weight: 600;
}

.metric-box strong {
    display: block;
    margin-top: 10px;
    font-size: 26px;
}

.metric-box em {
    color: #059669;
    font-size: 12px;
    font-style: normal;
}

.accent-green {
    border-top-color: #059669;
}

.accent-amber {
    border-top-color: #d97706;
}

.accent-red {
    border-top-color: #dc2626;
}

.accent-cyan {
    border-top-color: #0891b2;
}

.dashboard-section {
    margin-top: 24px;
}

.section-heading {
    margin-bottom: 12px;
}

.section-heading h3 {
    font-size: 18px;
    font-weight: 700;
}

.split-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
    gap: 12px;
}

.hero-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

.panel {
    padding: 16px;
    min-width: 0;
}

.panel h4 {
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 700;
}

.table-wrap {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

th {
    color: #6b7280;
    font-weight: 700;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
    padding: 10px 8px;
    white-space: nowrap;
}

td {
    border-bottom: 1px solid #f1f5f9;
    padding: 10px 8px;
    vertical-align: middle;
}

.bar-cell {
    display: grid;
    grid-template-columns: 48px 1fr;
    align-items: center;
    gap: 8px;
}

.bar-track,
.stacked-bar {
    height: 8px;
    border-radius: 8px;
    background: #eef2f7;
    overflow: hidden;
}

.bar-track i {
    display: block;
    height: 100%;
    background: #0f766e;
}

.rank-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding-left: 20px;
}

.rank-list li,
.person-list li,
.retention-row,
.timeline-row {
    min-height: 34px;
}

.rank-list li {
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;
}

.rank-list span,
.person-list span,
.retention-row span,
.timeline-row span {
    display: block;
    font-weight: 600;
    color: #1f2937;
}

.rank-list strong,
.person-list strong,
.retention-row strong,
.timeline-row strong {
    color: #475569;
    font-size: 12px;
    font-weight: 700;
}

.compact li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}

.mix-list,
.retention-list,
.timeline {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.mix-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 13px;
}

.mix-meta span {
    font-weight: 600;
}

.mix-meta em,
.person-list em,
.retention-row em {
    color: #6b7280;
    font-size: 12px;
    font-style: normal;
}

.stacked-bar {
    display: flex;
}

.stacked-bar i {
    height: 100%;
}

.stacked-bar .edit {
    background: #dc2626;
}

.stacked-bar .view {
    background: #2563eb;
}

.person-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.person-list li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;
}

.person-list em {
    grid-column: 1;
}

.person-list strong {
    grid-row: 1 / span 2;
    grid-column: 2;
    align-self: center;
}

.retention-row,
.timeline-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid #f1f5f9;
}

.timeline-row {
    grid-template-columns: minmax(120px, 1fr) 1fr auto;
}

.timeline-row i {
    height: 2px;
    background: #d1d5db;
}

.empty {
    color: #9ca3af;
    text-align: center;
}

.empty.block {
    padding: 24px 0;
}

@media (max-width: 1180px) {
    .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .split-grid,
    .hero-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 720px) {
    .usage-adoption {
        padding: 16px;
    }

    .page-toolbar {
        flex-direction: column;
    }

    .metric-grid {
        grid-template-columns: 1fr;
    }
}
</style>
