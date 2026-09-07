<script setup lang="ts">
/**
 * View 2: Process Analytics
 * 시스템 활용 맵, R&R 히트맵, Task 유형 분포, 프로세스별 Task 비율, Top5 이상 프로세스
 */
import { onMounted, ref, computed } from 'vue';
import { fetchProcessAnalytics } from '@/services/dashboardDataService';
import type { ProcessAnalyticsData } from '@/services/dashboardDataService';

const props = defineProps<{ filters?: { domains?: string[] } }>();

const loading = ref(true);
const error = ref('');
const d = ref<ProcessAnalyticsData | null>(null);

async function load() {
    loading.value = true;
    error.value = '';
    try {
        d.value = await fetchProcessAnalytics(props.filters?.domains);
    } catch (e: any) {
        error.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
}

onMounted(load);

// ─── Computed ────────────────────────────────────────────────────────
const systemMap = computed(() => d.value?.system_map || []);
const maxTaskCount = computed(() => Math.max(...systemMap.value.map((s) => s.task_count), 1));
const selectedSystem = ref<(typeof systemMap.value)[number] | null>(null);
const projectMap = computed(() => d.value?.project_map || []);
const maxProjectTaskCount = computed(() => Math.max(...projectMap.value.map((s) => s.task_count), 1));
const selectedProject = ref<(typeof projectMap.value)[number] | null>(null);
const heatmapData = computed(() => d.value?.heatmap || []);
const roles = computed(() => [...new Set(heatmapData.value.map((h) => h.role_name))]);
const depts = computed(() => [...new Set(heatmapData.value.map((h) => h.domain))]);
const taskTypes = computed(() => {
    const raw = d.value?.task_types || [];
    const total = raw.reduce((s, t) => s + t.total_count, 0) || 1;
    return raw.map((t) => ({
        type: t.task_type,
        count: t.total_count,
        pct: Math.round((t.total_count / total) * 100)
    }));
});
const totalTasks = computed(() => taskTypes.value.reduce((s, t) => s + t.count, 0));
const taskRatio = computed(() => d.value?.task_ratio || []);
const showAllProcesses = ref(false);
const visibleTaskRatio = computed(() => (showAllProcesses.value ? taskRatio.value : taskRatio.value.slice(0, 10)));
const automationScore = computed(() => d.value?.automation_score || { overall: 0, total_count: 0, by_domain: [] });

const TASK_COLORS: Record<string, string> = {
    manual: '#F59E0B', service: '#10B981', user: '#3B82F6',
    send: '#EC4899', receive: '#06B6D4',
    'Manual Task': '#F59E0B', 'Service Task': '#10B981', 'User Task': '#3B82F6',
    'Send Task': '#EC4899', 'Receive Task': '#06B6D4', 'Script Task': '#6366F1',
    'Business Rule Task': '#EC4899'
};
const TYPE_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#6366F1', '#EC4899', '#06B6D4', '#8B5CF6'];

const SYSTEM_COLORS = ['#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#10B981', '#EC4899', '#6366F1'];

// TopN
const TOPN_META: Record<string, { label: string; color: string; icon: string; metric: string; desc: string }> = {
    handoff: {
        label: 'Hand-off 과다', color: '#F59E0B', icon: '↔', metric: '부서 간 인수인계 횟수',
        desc: '담당자나 부서 간 업무 넘기기가 잦아 대기 시간이 길어지고 병목이 발생하기 쉬운 구간입니다.'
    },
    xor: {
        label: 'XOR 분기 과다', color: '#8B5CF6', icon: '⊕', metric: '배타적 게이트웨이 수',
        desc: '조건에 따른 예외 처리나 갈림길이 지나치게 많아 표준화가 부족하고 관리 복잡도가 높은 상태입니다.'
    },
    manual: {
        label: 'Manual Task 과다', color: '#EF4444', icon: 'M', metric: '수작업 Task 수',
        desc: '시스템 자동화 없이 작업자가 직접 수기로 처리하는 비중이 높아 효율 저하와 인적 오류가 발생하기 쉬운 상태입니다.'
    },
    decision: {
        label: '판단/분석 Task', color: '#06B6D4', icon: 'D', metric: '판단/분석 Task 수',
        desc: '단순 반복이 아니라 실무자의 전문 검토나 의사결정이 요구되는 핵심 업무로 인적 역량이 중요한 구간입니다.'
    },
    loop: {
        label: '루프/재작업', color: '#10B981', icon: '↺', metric: '반복·재처리 구간 수',
        desc: '반려나 오류로 앞 단계로 돌아가 업무를 반복하는 상태로 비용 낭비와 처리 시간 지연의 주요 원인입니다.'
    }
};
const activeTopN = ref('handoff');
const topNCategories = computed(() => {
    const topN = d.value?.top_n || {};
    return Object.entries(TOPN_META).map(([key, meta]) => ({
        key,
        ...meta,
        items: (topN as any)[key] || []
    }));
});
const activeCat = computed(() => topNCategories.value.find((c) => c.key === activeTopN.value) || topNCategories.value[0]);
const maxTopNCount = computed(() => Math.max(...(activeCat.value?.items || []).map((i: any) => i.count), 1));

// Heatmap (라이트 배경용 blue ramp — 낮음: 연회색 → 높음: 진파랑)
const heatRatio = (count: number) => {
    const max = Math.max(...heatmapData.value.map((h) => h.task_count), 1);
    return count / max;
};
const heatColor = (count: number) => {
    const ratio = heatRatio(count);
    if (ratio >= 0.8) return '#1d4ed8';
    if (ratio >= 0.6) return '#2563eb';
    if (ratio >= 0.4) return '#3b82f6';
    if (ratio >= 0.2) return '#93c5fd';
    return '#e8edf3';
};
// 옅은 셀은 어두운 글자, 진한 셀은 흰 글자
const heatTextColor = (count: number) => (heatRatio(count) >= 0.4 ? 'rgba(255, 255, 255, 0.92)' : '#475569');

function getHeatValue(role: string, dept: string) {
    return heatmapData.value.find((h) => h.role_name === role && h.domain === dept)?.task_count || 0;
}

// Task ratio helpers
function getProcessTotal(proc: { tasks: Record<string, number> }) {
    return Object.values(proc.tasks).reduce((s, v) => s + v, 0);
}
function getAutoScore(proc: any): number {
    if ('automation_score' in proc && typeof proc.automation_score === 'number') return proc.automation_score;
    // fallback: TM Forum 기반 가중 평균 (5점 만점)
    const SCORE_MAP: Record<string, number> = { manual: 1, send: 1, receive: 1, user: 2, service: 3, script: 3, businessrule: 3, other: 1 };
    const total = getProcessTotal(proc);
    if (!total) return 0;
    const totalScore = Object.entries(proc.tasks).reduce((s, [k, v]) => s + (SCORE_MAP[k] || 1) * (v as number), 0);
    return Math.round((totalScore / total / 3) * 5 * 10) / 10;
}

const domainBadgeClass: Record<string, string> = {
    Customer: 'domain-blue', Resource: 'domain-violet', Service: 'domain-cyan',
    Operations: 'domain-amber', Enterprise: 'domain-slate', '미분류': 'domain-slate'
};
</script>

<template>
    <div class="process-analytics">
        <div v-if="loading" class="ds-loading">
            <v-progress-circular indeterminate color="#3B82F6" size="40" />
            <p class="text-slate-400 mt-3">데이터를 불러오는 중...</p>
        </div>
        <v-alert v-else-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>

        <v-row v-else dense>
            <!-- 시스템 활용 맵 -->
            <v-col cols="12" lg="5">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">시스템 활용 맵</h3>
                            <p class="ds-card-subtitle">시스템별 연결 프로세스 수 및 Task 총량</p>
                        </div>
                    </div>
                    <div class="oss-header">
                        <div class="oss-col-sys">시스템</div>
                        <div class="oss-col-proc">연결 프로세스</div>
                        <div class="oss-col-task">연결 Task 수</div>
                    </div>
                    <div class="oss-list system-list">
                        <div v-for="(item, idx) in systemMap" :key="item.system_id || item.tool_name" class="oss-row">
                            <div class="oss-col-sys">
                                <span class="oss-dot" :style="{ backgroundColor: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] }"></span>
                                <div class="oss-info">
                                    <p class="oss-name">{{ item.tool_name }}</p>
                                </div>
                            </div>
                            <div class="oss-col-proc">
                                <button class="oss-proc-badge" :style="{ color: SYSTEM_COLORS[idx % SYSTEM_COLORS.length], backgroundColor: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] + '18' }"
                                    @click="selectedSystem = item">
                                    {{ item.process_count }}<span class="oss-proc-unit">건</span>
                                </button>
                            </div>
                            <div class="oss-col-task">
                                <div class="oss-task-bar-bg">
                                    <div class="oss-task-bar-fill" :style="{ width: Math.round((item.task_count / maxTaskCount) * 100) + '%', backgroundColor: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] + 'BB' }"></div>
                                </div>
                                <span class="oss-task-num" :style="{ color: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] }">{{ item.task_count }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="oss-summary">
                        <div><p class="oss-sum-val">{{ systemMap.length }}개</p><p class="oss-sum-label">전체 시스템</p></div>
                        <div><p class="oss-sum-val text-blue">{{ systemMap.reduce((s, i) => s + i.process_count, 0) }}건</p><p class="oss-sum-label">연결 프로세스</p></div>
                        <div><p class="oss-sum-val text-violet">{{ systemMap.reduce((s, i) => s + i.task_count, 0).toLocaleString() }}건</p><p class="oss-sum-label">연결 Task</p></div>
                    </div>
                </div>
            </v-col>

            <!-- Task 유형 분포 -->
            <v-col cols="12" lg="7">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">Task 유형 분포</h3>
                            <p class="ds-card-subtitle">전체 {{ totalTasks }}건 기준</p>
                        </div>
                    </div>
                    <div class="task-type-list">
                        <div v-for="(t, idx) in taskTypes" :key="t.type" class="task-type-item">
                            <div class="task-type-label-row">
                                <span class="text-slate-400">{{ t.type }}</span>
                                <span class="task-type-count">{{ t.count }}건 ({{ t.pct }}%)</span>
                            </div>
                            <div class="task-type-bar-bg">
                                <div class="task-type-bar-fill" :style="{ width: t.pct + '%', backgroundColor: TASK_COLORS[t.type] || TYPE_COLORS[idx % TYPE_COLORS.length] }"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </v-col>

            <!-- 자동화 점수 -->
            <v-col cols="12">
                <div class="ds-card automation-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">자동화 점수</h3>
                            <p class="ds-card-subtitle">TM Forum 기준 Task 유형별 가중 평균 (5점 만점)</p>
                        </div>
                        <div class="automation-overall">
                            <span class="automation-label">전체</span>
                            <strong :class="automationScore.overall >= 4 ? 'text-emerald' : automationScore.overall >= 2.5 ? 'text-amber' : 'text-red'">
                                {{ automationScore.overall }}<span class="text-slate-500" style="font-size:14px">/5</span>
                            </strong>
                        </div>
                    </div>
                    <div class="automation-domain-grid">
                        <div v-for="item in automationScore.by_domain" :key="item.domain" class="automation-domain-item">
                            <div class="automation-domain-row">
                                <span class="automation-domain-name">{{ item.domain }}</span>
                                <span :class="['automation-domain-score', item.automation_score >= 4 ? 'text-emerald' : item.automation_score >= 2.5 ? 'text-amber' : 'text-red']">
                                    {{ item.automation_score }}<span class="text-slate-500" style="font-size:10px">/5</span>
                                </span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" :style="{ width: (item.automation_score / 5 * 100) + '%', backgroundColor: item.automation_score >= 4 ? '#10B981' : item.automation_score >= 2.5 ? '#F59E0B' : '#EF4444' }"></div>
                            </div>
                            <p class="automation-domain-sub">/ {{ item.total_count }} Task</p>
                        </div>
                    </div>
                </div>
            </v-col>

            <!-- R&R 히트맵 -->
            <v-col cols="12">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">R&R 집중도 히트맵</h3>
                            <p class="ds-card-subtitle">부서/Role별 Task 총량</p>
                        </div>
                    </div>
                    <div v-if="heatmapData.length" class="heatmap-wrap">
                        <table class="heatmap-table">
                            <thead>
                                <tr>
                                    <th class="heatmap-th">Role \ 부서</th>
                                    <th v-for="dep in depts" :key="dep" class="heatmap-th">{{ dep }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="role in roles" :key="role">
                                    <td class="heatmap-role" :title="role">{{ role }}</td>
                                    <td v-for="dept in depts" :key="dept" class="heatmap-cell">
                                        <div class="heatmap-val" :style="{ backgroundColor: heatColor(getHeatValue(role, dept)), color: heatTextColor(getHeatValue(role, dept)) }">
                                            {{ getHeatValue(role, dept) || '-' }}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="ds-empty-mini">데이터 없음</div>
                    <div class="heat-legend">
                        <span class="text-xs text-slate-500">낮음</span>
                        <div v-for="(c, i) in ['#e8edf3','#93c5fd','#3b82f6','#2563eb','#1d4ed8']" :key="i" class="heat-legend-box" :style="{ backgroundColor: c }"></div>
                        <span class="text-xs text-slate-500">높음</span>
                    </div>
                </div>
            </v-col>

            <!-- 과제 연결 맵 -->
            <v-col cols="12">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">과제 연결 맵</h3>
                            <p class="ds-card-subtitle">과제별 연결 프로세스 수 및 Task 총량</p>
                        </div>
                    </div>
                    <template v-if="projectMap.length">
                    <div class="oss-header">
                        <div class="oss-col-sys">과제</div>
                        <div class="oss-col-proc">연결 프로세스</div>
                        <div class="oss-col-task">연결 Task 수</div>
                    </div>
                    <div class="oss-list project-list">
                        <div v-for="(item, idx) in projectMap" :key="item.project_name" class="oss-row">
                            <div class="oss-col-sys">
                                <span class="oss-dot" :style="{ backgroundColor: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] }"></span>
                                <div class="oss-info">
                                    <p class="oss-name">{{ item.project_name }}</p>
                                </div>
                            </div>
                            <div class="oss-col-proc">
                                <button class="oss-proc-badge" :style="{ color: SYSTEM_COLORS[idx % SYSTEM_COLORS.length], backgroundColor: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] + '18' }"
                                    @click="selectedProject = item">
                                    {{ item.process_count }}<span class="oss-proc-unit">건</span>
                                </button>
                            </div>
                            <div class="oss-col-task">
                                <div class="oss-task-bar-bg">
                                    <div class="oss-task-bar-fill" :style="{ width: Math.round((item.task_count / maxProjectTaskCount) * 100) + '%', backgroundColor: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] + 'BB' }"></div>
                                </div>
                                <span class="oss-task-num" :style="{ color: SYSTEM_COLORS[idx % SYSTEM_COLORS.length] }">{{ item.task_count }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="oss-summary">
                        <div><p class="oss-sum-val">{{ projectMap.length }}개</p><p class="oss-sum-label">전체 과제</p></div>
                        <div><p class="oss-sum-val text-blue">{{ projectMap.reduce((s, i) => s + i.process_count, 0) }}건</p><p class="oss-sum-label">연결 프로세스</p></div>
                        <div><p class="oss-sum-val text-violet">{{ projectMap.reduce((s, i) => s + i.task_count, 0).toLocaleString() }}건</p><p class="oss-sum-label">연결 Task</p></div>
                    </div>
                    </template>
                    <div v-else class="ds-empty-mini">과제 연결 데이터 없음</div>
                </div>
            </v-col>

            <!-- 프로세스별 Task 유형 비율 -->
            <v-col cols="12">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">프로세스별 Task 유형 비율</h3>
                            <p class="ds-card-subtitle">Task 구성 비율</p>
                        </div>
                        <button v-if="taskRatio.length > 10" class="text-toggle" @click="showAllProcesses = !showAllProcesses">
                            {{ showAllProcesses ? 'Top 10 보기' : '전체 보기' }}
                        </button>
                    </div>
                    <div v-if="taskRatio.length" class="ratio-rows">
                        <div v-for="proc in visibleTaskRatio" :key="proc.proc_def_id || proc.name" class="ratio-row">
                            <div class="ratio-col-name">
                                <p class="ratio-proc-name">{{ proc.name }}</p>
                                <span :class="['domain-badge', domainBadgeClass[proc.domain] || 'domain-slate']">{{ proc.domain }}</span>
                            </div>
                            <div class="ratio-col-total">
                                <span class="ratio-total-num">{{ getProcessTotal(proc) }}</span>
                            </div>
                            <div class="ratio-col-bar">
                                <div class="ratio-stacked-bar">
                                    <template v-for="([key, val]) in Object.entries(proc.tasks)" :key="key">
                                        <div v-if="val > 0" class="ratio-bar-seg"
                                            :title="`${key}: ${val}건`"
                                            :style="{ width: Math.round((val / getProcessTotal(proc)) * 100) + '%', backgroundColor: (TASK_COLORS[key] || '#64748B') + 'CC', minWidth: '24px' }">
                                            <span>{{ val }}</span>
                                        </div>
                                    </template>
                                </div>
                            </div>
                            <div class="ratio-col-auto">
                                <span :class="['ratio-auto-pct', getAutoScore(proc) >= 4 ? 'text-emerald' : getAutoScore(proc) >= 2.5 ? 'text-amber' : 'text-red']">
                                    {{ getAutoScore(proc) }}<span class="text-slate-500 text-xs">/5</span>
                                </span>
                                <div class="progress-bar">
                                    <div class="progress-fill" :style="{ width: (getAutoScore(proc) / 5 * 100) + '%', backgroundColor: getAutoScore(proc) >= 4 ? '#10B981' : getAutoScore(proc) >= 2.5 ? '#F59E0B' : '#EF4444' }"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="ds-empty-mini">데이터 없음</div>
                </div>
            </v-col>

            <!-- Top 5 이상 프로세스 -->
            <v-col cols="12">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">Top 5 이상 프로세스</h3>
                            <p class="ds-card-subtitle">유형별 상위 5개 프로세스</p>
                        </div>
                    </div>
                    <div class="topn-tabs">
                        <button v-for="c in topNCategories" :key="c.key"
                            :class="['topn-tab', { active: activeTopN === c.key }]"
                            :style="activeTopN === c.key ? { backgroundColor: c.color + '22', borderColor: c.color + '66', color: c.color } : {}"
                            @click="activeTopN = c.key">
                            <span>{{ c.icon }}</span>{{ c.label }}
                        </button>
                    </div>
                    <p v-if="activeCat" class="topn-desc">{{ activeCat.desc }}</p>
                    <v-row v-if="activeCat?.items?.length" dense>
                        <v-col v-for="(item, i) in activeCat.items" :key="item.process" cols="12" sm="6" md>
                            <div class="topn-card">
                                <div class="topn-card-header">
                                    <span class="topn-rank" :style="{ color: i === 0 ? activeCat.color : '#475569' }">#{{ i + 1 }}</span>
                                    <span :class="['domain-badge', domainBadgeClass[item.domain] || 'domain-slate']">{{ item.domain }}</span>
                                </div>
                                <p class="topn-proc-name">{{ item.process }}</p>
                                <div>
                                    <div class="topn-count-row">
                                        <span class="text-xs text-slate-500">{{ activeCat.metric }}</span>
                                        <span class="topn-count" :style="{ color: activeCat.color }">{{ item.count }}</span>
                                    </div>
                                    <div class="topn-bar-bg">
                                        <div class="topn-bar-fill" :style="{ width: Math.round((item.count / maxTopNCount) * 100) + '%', backgroundColor: activeCat.color + 'CC' }"></div>
                                    </div>
                                </div>
                            </div>
                        </v-col>
                    </v-row>
                    <div v-else class="ds-empty-mini">해당 유형 데이터 없음</div>
                </div>
            </v-col>
        </v-row>

        <v-dialog :model-value="!!selectedSystem" max-width="560" @update:model-value="(value) => { if (!value) selectedSystem = null; }">
            <div v-if="selectedSystem" class="link-dialog">
                <div class="link-dialog-header">
                    <div>
                        <h3>{{ selectedSystem.tool_name }}</h3>
                        <p>{{ selectedSystem.process_count }}개 프로세스 · {{ selectedSystem.task_count }}개 Task</p>
                    </div>
                    <button class="link-dialog-close" @click="selectedSystem = null">닫기</button>
                </div>
                <div class="link-dialog-list">
                    <div v-for="proc in selectedSystem.connected_processes || []" :key="proc.proc_def_id" class="link-dialog-row">
                        <span>{{ proc.proc_def_name }}</span>
                        <span :class="['domain-badge', domainBadgeClass[proc.domain] || 'domain-slate']">{{ proc.domain }}</span>
                    </div>
                    <div v-if="!(selectedSystem.connected_processes || []).length" class="ds-empty-mini">연결 프로세스 없음</div>
                </div>
            </div>
        </v-dialog>

        <v-dialog :model-value="!!selectedProject" max-width="560" @update:model-value="(value) => { if (!value) selectedProject = null; }">
            <div v-if="selectedProject" class="link-dialog">
                <div class="link-dialog-header">
                    <div>
                        <h3>{{ selectedProject.project_name }}</h3>
                        <p>{{ selectedProject.process_count }}개 프로세스 · {{ selectedProject.task_count }}개 Task</p>
                    </div>
                    <button class="link-dialog-close" @click="selectedProject = null">닫기</button>
                </div>
                <div class="link-dialog-list">
                    <div v-for="proc in selectedProject.connected_processes || []" :key="proc.proc_def_id" class="link-dialog-row">
                        <span>{{ proc.proc_def_name }}</span>
                        <span :class="['domain-badge', domainBadgeClass[proc.domain] || 'domain-slate']">{{ proc.domain }}</span>
                    </div>
                </div>
            </div>
        </v-dialog>
    </div>
</template>

<style scoped>
.process-analytics { color: #1e293b; }
.ds-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; }
.ds-empty-mini { text-align: center; padding: 32px; color: #64748b; font-size: 13px; }
.ds-card { background: #ffffff; border: 1px solid #e5eaef; border-radius: 12px; padding: 20px; height: 100%; }
.ds-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.ds-card-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.ds-card-subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }

/* ─── OSS System Map ──────────────────────────────────────────────── */
.oss-header { display: grid; grid-template-columns: 4fr 3fr 5fr; gap: 8px; padding: 0 8px 8px; border-bottom: 1px solid #e8edf3; font-size: 11px; font-weight: 500; color: #64748b; }
.oss-header .oss-col-proc { text-align: center; }
.oss-header .oss-col-task { text-align: right; }
.oss-list { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.system-list { max-height: calc(40px * 6 + 2px * 5); overflow-y: auto; padding-right: 4px; }
.system-list .oss-row { min-height: 40px; }
.system-list::-webkit-scrollbar { width: 6px; }
.system-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
.system-list::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 99px; }
.oss-row { display: grid; grid-template-columns: 4fr 3fr 5fr; gap: 8px; align-items: center; padding: 10px 8px; border-radius: 8px; transition: background 0.2s; }
.oss-row:hover { background: #f8fafc; }
.oss-col-sys { display: flex; align-items: center; gap: 8px; min-width: 0; }
.oss-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.oss-info { min-width: 0; }
.oss-name { font-size: 12px; font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oss-col-proc { display: flex; justify-content: center; }
.oss-proc-badge { font-size: 14px; font-weight: 700; padding: 2px 8px; border-radius: 6px; border: 0; cursor: pointer; }
.oss-proc-badge:hover { filter: brightness(0.94); }
.oss-proc-unit { font-size: 11px; font-weight: 400; margin-left: 2px; }
.oss-col-task { display: flex; align-items: center; gap: 8px; }
.oss-task-bar-bg { flex: 1; height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.oss-task-bar-fill { height: 100%; border-radius: 99px; transition: width 0.7s; }
.oss-task-num { font-size: 12px; font-weight: 700; width: 32px; text-align: right; flex-shrink: 0; }
.oss-summary { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8edf3; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; }
.oss-sum-val { font-size: 14px; font-weight: 700; color: #1e293b; }
.oss-sum-label { font-size: 11px; color: #64748b; margin-top: 2px; }

/* ─── Automation Score ───────────────────────────────────────────── */
.automation-card { min-height: 0; }
.automation-overall { display: flex; align-items: baseline; gap: 8px; }
.automation-label { font-size: 11px; color: #64748b; }
.automation-overall strong { font-size: 24px; font-weight: 900; }
.automation-domain-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.automation-domain-item { background: #f8fafc; border: 1px solid #e8edf3; border-radius: 8px; padding: 10px; }
.automation-domain-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
.automation-domain-name { color: #334155; font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.automation-domain-score { color: #1e293b; font-size: 12px; font-weight: 800; }
.automation-domain-sub { margin-top: 6px; color: #64748b; font-size: 11px; }

/* ─── Heatmap ──────────────────────────────────────────────────────── */
.heatmap-wrap { overflow-x: auto; max-height: 360px; overflow-y: auto; }
.heatmap-table { width: 100%; font-size: 12px; }
.heatmap-th { text-align: center; color: #64748b; font-weight: 500; padding-bottom: 8px; }
.heatmap-th:first-child { text-align: left; color: #64748b; }
.heatmap-role { color: #475569; padding: 4px 8px 4px 0; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
.heatmap-cell { padding: 4px; }
.heatmap-val { width: 48px; height: 32px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin: 0 auto; }
.heat-legend { display: flex; align-items: center; gap: 6px; margin-top: 12px; }
.heat-legend-box { width: 24px; height: 12px; border-radius: 2px; }

/* ─── Task Type Distribution ───────────────────────────────────────── */
.task-type-list { display: flex; flex-direction: column; gap: 10px; }
.task-type-label-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
.task-type-count { color: #334155; font-weight: 500; }
.task-type-bar-bg { height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.task-type-bar-fill { height: 100%; border-radius: 99px; transition: width 0.5s; }

/* ─── Task Ratio ─────────────────────────────────────────────────── */
.ratio-rows { max-height: 520px; overflow-y: auto; }
.ratio-row { display: grid; grid-template-columns: 3fr 1fr 6fr 2fr; gap: 8px; align-items: center; padding: 10px 12px; transition: background 0.2s; border-bottom: 1px solid #eef2f7; }
.ratio-row:hover { background: #f8fafc; }
.ratio-col-name { min-width: 0; }
.ratio-proc-name { font-size: 12px; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ratio-col-total { text-align: center; }
.ratio-total-num { font-size: 14px; font-weight: 700; color: #334155; }
.ratio-col-bar { display: flex; flex-direction: column; gap: 6px; }
.ratio-stacked-bar { height: 16px; width: 100%; display: flex; border-radius: 6px; overflow: hidden; gap: 1px; }
.ratio-bar-seg { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: rgba(255, 255, 255, 0.9); font-weight: 800; transition: width 0.7s; }
.ratio-col-auto { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.ratio-auto-pct { font-size: 12px; font-weight: 700; }
.progress-bar { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; width: 100%; }
.progress-fill { height: 100%; border-radius: 99px; transition: width 0.7s; }
.text-toggle { border: 1px solid #d5dbe3; background: #ffffff; color: #64748b; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.text-toggle:hover { color: #1e293b; border-color: #b6c0cc; }

/* ─── TopN Widget ──────────────────────────────────────────────────── */
.topn-tabs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.topn-tab { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; border: 1px solid #d5dbe3; color: #64748b; background: transparent; cursor: pointer; transition: all 0.2s; }
.topn-desc { margin: -6px 0 14px; color: #64748b; font-size: 12px; line-height: 1.5; }
.topn-card { background: #f8fafc; border: 1px solid #e8edf3; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; transition: border-color 0.2s; }
.topn-card:hover { border-color: #cbd5e1; }
.topn-card-header { display: flex; align-items: center; justify-content: space-between; }
.topn-rank { font-size: 18px; font-weight: 900; }
.topn-proc-name { font-size: 12px; font-weight: 600; color: #1e293b; min-height: 32px; line-height: 1.4; }
.topn-count-row { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 4px; }
.topn-count { font-size: 16px; font-weight: 900; }
.topn-bar-bg { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.topn-bar-fill { height: 100%; border-radius: 99px; transition: width 0.5s; }

/* ─── Domain badges ──────────────────────────────────────────────── */
.domain-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-top: 2px; display: inline-block; font-weight: 500; }
.domain-blue { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
.domain-violet { background: rgba(139, 92, 246, 0.12); color: #7c3aed; }
.domain-cyan { background: rgba(6, 182, 212, 0.12); color: #0e7490; }
.domain-amber { background: rgba(245, 158, 11, 0.12); color: #b45309; }
.domain-slate { background: rgba(100, 116, 139, 0.14); color: #475569; }

/* ─── Link Dialog ─────────────────────────────────────────────────── */
.link-dialog { background: #ffffff; border: 1px solid #e0e5eb; border-radius: 10px; padding: 18px; color: #1e293b; }
.link-dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.link-dialog-header h3 { font-size: 15px; font-weight: 800; }
.link-dialog-header p { font-size: 12px; color: #64748b; margin-top: 4px; }
.link-dialog-close { border: 1px solid #d5dbe3; color: #64748b; background: transparent; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.link-dialog-list { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
.link-dialog-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e8edf3; border-radius: 7px; padding: 9px 10px; font-size: 12px; }
.link-dialog-row > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 960px) {
    .automation-domain-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
    .automation-domain-grid { grid-template-columns: 1fr; }
}

/* ─── Color utilities ──────────────────────────────────────────────── */
.text-blue { color: #2563eb; }
.text-emerald { color: #059669; }
.text-violet { color: #7c3aed; }
.text-amber { color: #d97706; }
.text-red { color: #dc2626; }
.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }
.text-xs { font-size: 11px; }
.font-bold { font-weight: 700; }
</style>
