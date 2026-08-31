<script setup lang="ts">
/**
 * View 1: Executive Summary
 * PI 진행 현황 종합, 본부별 KPI, Weekly Velocity, 단계 역행 현황
 *
 * 단계: draft / in_review / public_feedback / final_edit / published (5단계)
 * 데이터 소스: 체계도와 동일 (proc_def 테이블 + supabase proc_def_approval_state / proc_def_version)
 */
import { onMounted, ref, computed } from 'vue';
import { fetchExecutiveSummary } from '@/services/dashboardDataService';
import type { ExecutiveSummaryData } from '@/services/dashboardDataService';
import BackendFactory from '@/components/api/BackendFactory';
import {
    STAGE_DEFS,
    collectHierarchyProcIds,
    collectModuleProcIds,
    deriveStatus,
    emptyStageCounts,
    getStageDef,
    type Stage,
    type ProcessStatus
} from '@/utils/processStages';

const backend = BackendFactory.createBackend() as any;
const props = defineProps<{ filters?: { domains?: string[] } }>();

const loading = ref(true);
const error = ref('');
const d = ref<ExecutiveSummaryData | null>(null);

const procStateMap = ref<Map<string, ProcessStatus>>(new Map());
const stateCounts = ref<Record<Stage, number>>(emptyStageCounts());
const totalProcessCount = ref(0);
const kpiTargets = ref<any[]>([]);

// 체계도(useProcessArchitecture.stats) 와 동일한 카운트 기준 사용.
// proc_def 전체가 아니라 체계도 계층(getProcessDefinitionMap) 에 등록된 sub_proc 만 카운트.
async function loadProcessStates() {
    const supabase = (window as any).$supabase;
    try {
        const [defs, procMap]: [any[], any] = await Promise.all([
            backend.listDefinitionStatusLite('', { match: { isdeleted: false } }),
            backend.getProcessDefinitionMap({ skipPermissionFilter: true })
        ]);
        if (!Array.isArray(defs)) return;

        // 체계도 계층의 sub_proc id 집합 — 공유 utils 사용 (리뷰보드/체계도와 동일 모집단)
        const visibleSubIds = collectHierarchyProcIds(procMap);
        // 체계도에 등록되지 않는 "프로세스 모듈"(call-activity-sub)은 카운트 모집단에서 제외
        for (const id of collectModuleProcIds(defs)) visibleSubIds.delete(id);

        const approvalStateMap = new Map<string, any>();
        const latestVersionMap = new Map<string, any>();
        if (supabase) {
            try {
                const { data: approvalStates } = await supabase
                    .from('proc_def_approval_state')
                    .select('proc_def_id, state, created_at')
                    .eq('tenant_id', (window as any).$tenantName)
                    .order('created_at', { ascending: false });
                if (approvalStates) {
                    for (const row of approvalStates) {
                        if (!approvalStateMap.has(row.proc_def_id)) approvalStateMap.set(row.proc_def_id, row);
                    }
                }
            } catch (e) {
                console.warn('approval states load failed:', e);
            }
            try {
                const { data: versionRows } = await supabase
                    .from('proc_def_version')
                    .select('proc_def_id, version_tag, timeStamp')
                    .eq('tenant_id', (window as any).$tenantName)
                    .order('timeStamp', { ascending: false });
                if (versionRows) {
                    for (const row of versionRows) {
                        if (row?.proc_def_id && !latestVersionMap.has(row.proc_def_id)) {
                            latestVersionMap.set(row.proc_def_id, row);
                        }
                    }
                }
            } catch (e) {
                console.warn('versions load failed:', e);
            }
        }

        const statusMap = new Map<string, ProcessStatus>();
        const counts = emptyStageCounts();
        for (const def of defs) {
            const approval = approvalStateMap.get(def.id);
            const versionRow = latestVersionMap.get(def.id);
            const status = deriveStatus({
                approvalStateName: approval?.state,
                directStatus: def.approval_state || def.status,
                versionTag: versionRow?.version_tag,
                hasVersion: latestVersionMap.has(def.id)
            });
            // KPI 도트 매핑 등을 위해 모든 proc_def 의 status 는 statusMap 에 유지 (계층 밖이어도)
            statusMap.set(def.id, status);
            // 단, 좌측 5단계 카운터는 체계도 계층 안의 것만 카운트
            if (!visibleSubIds.has(def.id)) continue;
            if (status !== 'none' && status !== 'wip' && status !== 'sunset') counts[status]++;
        }
        procStateMap.value = statusMap;
        stateCounts.value = counts;
        totalProcessCount.value = visibleSubIds.size;
    } catch (e) {
        console.error('loadProcessStates error:', e);
    }
}

async function loadKpiTargets() {
    try {
        const targets = await backend.getKpiTargets();
        const raw = Array.isArray(targets) ? targets : [];

        // KpiTargetManager 와 동일 기준 — (alive ∩ 체계도 등록) 만 본부별 카운트에 노출.
        //   alive      = proc_def.deleted_at IS NULL 인 살아있는 proc
        //   registered = procMap.sub_proc_list 에 정식 등록된 sub-process
        //   체계도 미등록(모듈/빈 껍데기/사고로 빠진 것) 은 KPI 집계 대상 아님.
        //   jsonb 원본은 건드리지 않고 화면용 ref 에 채울 때만 필터.
        const allProcessIds = [
            ...new Set(
                raw.flatMap((t: any) => (Array.isArray(t?.process_ids) ? t.process_ids : []))
            )
        ] as string[];

        const [aliveSet, procMap]: [Set<string>, any] =
            allProcessIds.length > 0
                ? await Promise.all([
                      backend.getAliveProcessIdsAmong(allProcessIds),
                      backend.getProcessDefinitionMap({ skipPermissionFilter: true })
                  ])
                : [new Set(), null];

        const registeredSet: Set<string> = collectHierarchyProcIds(procMap?.value || procMap || {});

        kpiTargets.value = raw.map((t: any) => {
            const ids: string[] = Array.isArray(t?.process_ids) ? t.process_ids : [];
            const visibleIds = ids.filter((id) => aliveSet.has(id) && registeredSet.has(id));
            return { ...t, process_ids: visibleIds, target: visibleIds.length };
        });
    } catch (e) {
        console.error('loadKpiTargets error:', e);
    }
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const [exec] = await Promise.all([
            fetchExecutiveSummary(props.filters?.domains),
            loadProcessStates(),
            loadKpiTargets()
        ]);
        d.value = exec;
    } catch (e: any) {
        error.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
}

onMounted(load);

// ─── Computed helpers ────────────────────────────────────────────────
const ANNUAL_TARGET_COUNT = 70;

const cumulativeStages = computed(() =>
    STAGE_DEFS.map((def) => ({
        label: def.label,
        count: stateCounts.value[def.stage] || 0,
        cls: def.cls
    }))
);

const progressPct = computed(() => {
    const total = totalProcessCount.value;
    if (!total) return 0;
    return Math.round((stateCounts.value.published / total) * 1000) / 10;
});
const targetPct = computed(() => Math.round((stateCounts.value.published / ANNUAL_TARGET_COUNT) * 1000) / 10);
const velocity = computed(() => {
    const raw = d.value?.velocity || [];
    return raw.map((w) => ({
        week: w.week_label?.replace(/^\d{4}-/, '') || w.week_label,
        actual: Number(w.actual) || 0,
        target: Number(w.target) || 0
    }));
});
const velocityMax = computed(() => Math.max(...velocity.value.map((w) => Math.max(w.actual, w.target)), 1));
const churnData = computed(() => d.value?.churn || []);
const maxChurn = computed(() => Math.max(...churnData.value.map((c) => c.total_churn), 1));

interface KpiDivision {
    division: string;
    target_count: number;
    process_ids: string[];
    counts: Record<Stage, number>;
    rag: 'G' | 'A' | 'R';
}

const kpiDivisions = computed<KpiDivision[]>(() => {
    const targets = kpiTargets.value;
    if (!targets.length) return [];
    const currentYear = new Date().getFullYear();
    const groups = new Map<string, KpiDivision>();
    for (const t of targets) {
        if (t.year != null && Number(t.year) !== currentYear) continue;
        // KPI 할당 단위(org_name) 기준으로 본부 카드 생성. parent 는 보통 상위(센터/사업부)
        const division: string = t.org_name || t.parent?.name || '미분류';
        const procIds: string[] = Array.isArray(t.process_ids) ? t.process_ids : [];
        const target = Number(t.target) || 0;
        let entry = groups.get(division);
        if (!entry) {
            entry = {
                division,
                target_count: 0,
                process_ids: [],
                counts: emptyStageCounts(),
                rag: 'R'
            };
            groups.set(division, entry);
        }
        entry.target_count += target;
        for (const pid of procIds) {
            if (entry.process_ids.includes(pid)) continue;
            entry.process_ids.push(pid);
            const s = procStateMap.value.get(pid);
            // wip/sunset/none/undefined → draft 로 분류 (KPI 할당됐는데 진행 흔적 없는 케이스)
            const stage: Stage = s && s !== 'none' && s !== 'wip' && s !== 'sunset' ? s : 'draft';
            entry.counts[stage]++;
        }
    }
    for (const entry of groups.values()) {
        const ratio = entry.target_count > 0 ? entry.counts.published / entry.target_count : 0;
        entry.rag = ratio >= 1 ? 'G' : ratio >= 0.5 ? 'A' : 'R';
    }
    return Array.from(groups.values());
});

// ─── Helpers ──────────────────────────────────────────────────────────
// 5단계 색·짧은 라벨은 공유 STAGE_DEFS 참조 (대시보드/체계도/리뷰보드 통일)
const STAGE_META: Record<string, { color: string; short: string }> = {
    draft: { color: getStageDef('draft').color, short: getStageDef('draft').shortLabel },
    in_review: { color: getStageDef('in_review').color, short: getStageDef('in_review').shortLabel },
    public_feedback: { color: getStageDef('public_feedback').color, short: getStageDef('public_feedback').shortLabel },
    final_edit: { color: getStageDef('final_edit').color, short: getStageDef('final_edit').shortLabel },
    published: { color: getStageDef('published').color, short: getStageDef('published').shortLabel }
};
const ragColor = (s: string) => ({ G: '#10B981', A: '#F59E0B', R: '#EF4444' }[s] || '#6B7280');
const ragBg = (s: string) => ({ G: 'rag-green', A: 'rag-amber', R: 'rag-red' }[s] || '');

function getKpiDots(div: KpiDivision): Array<{ stage: Stage; color: string; label: string }> {
    const dots: Array<{ stage: Stage; color: string; label: string }> = [];
    // 우→좌 진행 단계 순서대로(완료부터) 도트 채움
    const order: Stage[] = ['published', 'final_edit', 'public_feedback', 'in_review', 'draft'];
    for (const s of order) {
        const def = STAGE_DEFS.find((sd) => sd.stage === s)!;
        for (let i = 0; i < div.counts[s]; i++) {
            dots.push({ stage: s, color: def.color, label: def.label });
        }
    }
    return dots;
}

function getSeverity(row: { approved_to_review: number; review_to_draft: number }) {
    const totalRev = row.approved_to_review + row.review_to_draft;
    return totalRev >= 3 ? 'high' : totalRev >= 2 ? 'med' : 'low';
}
function severityColor(sev: string) {
    return sev === 'high' ? '#EF4444' : sev === 'med' ? '#F59E0B' : '#64748B';
}

const domainBadgeClass: Record<string, string> = {
    Customer: 'domain-blue', Resource: 'domain-violet', Service: 'domain-cyan',
    Operations: 'domain-amber', '미분류': 'domain-slate'
};

const selectedChurn = ref<typeof churnData.value[0] | null>(null);
function toggleChurn(row: typeof churnData.value[0]) {
    selectedChurn.value = selectedChurn.value?.proc_def_id === row.proc_def_id ? null : row;
}
</script>

<template>
    <div class="exec-summary">
        <!-- Loading -->
        <div v-if="loading" class="ds-loading">
            <v-progress-circular indeterminate color="#3B82F6" size="40" />
            <p class="text-slate-400 mt-3">데이터를 불러오는 중...</p>
        </div>

        <!-- Error -->
        <v-alert v-else-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>

        <!-- Data -->
        <v-row v-else dense>
            <!-- Box 1: 전체 진행 현황 -->
            <v-col cols="12" lg="5">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">전체 진행 현황</h3>
                            <p class="ds-card-subtitle">PI 진행 현황 종합</p>
                        </div>
                    </div>
                    <v-row dense class="mb-3">
                        <v-col cols="6">
                            <div class="stat-box">
                                <p class="stat-label">전체 진도율</p>
                                <div class="stat-value-row">
                                    <span class="stat-big">{{ stateCounts.published }}</span>
                                    <span class="stat-sub">/ {{ totalProcessCount }}건</span>
                                </div>
                                <div class="progress-bar mt-2">
                                    <div class="progress-fill bg-blue" :style="{ width: progressPct + '%' }"></div>
                                </div>
                                <p class="stat-pct text-blue">{{ progressPct }}% 완료</p>
                            </div>
                        </v-col>
                        <v-col cols="6">
                            <div class="stat-box">
                                <p class="stat-label">연간 목표 대비</p>
                                <div class="stat-value-row">
                                    <span class="stat-big text-emerald">{{ stateCounts.published }}</span>
                                    <span class="stat-sub">/ {{ ANNUAL_TARGET_COUNT }}건</span>
                                </div>
                                <div class="progress-bar mt-2">
                                    <div class="progress-fill bg-emerald" :style="{ width: Math.min(targetPct || 0, 100) + '%' }"></div>
                                </div>
                                <p class="stat-pct text-emerald">{{ targetPct || 0 }}% 달성</p>
                            </div>
                        </v-col>
                    </v-row>
                    <p class="text-xs text-slate-500 mb-2">단계별 현황</p>
                    <div class="cumulative-grid">
                        <div v-for="s in cumulativeStages" :key="s.label" :class="['stage-box', s.cls]">
                            <p class="stage-count">{{ s.count }}</p>
                            <p class="stage-label">{{ s.label }}</p>
                        </div>
                    </div>
                </div>
            </v-col>

            <!-- Box 2: 본부별 KPI 달성 현황 -->
            <v-col cols="12" lg="7">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">본부별 KPI 달성 현황</h3>
                            <p class="ds-card-subtitle">본부당 KPI · 단계별 현황</p>
                        </div>
                    </div>
                    <div class="kpi-legend">
                        <span v-for="l in STAGE_DEFS" :key="l.label" class="legend-item">
                            <span class="legend-dot" :style="{ backgroundColor: l.color }"></span>
                            {{ l.label }}
                        </span>
                    </div>
                    <div class="kpi-org-list">
                        <div v-for="org in kpiDivisions" :key="org.division" class="kpi-org-item">
                            <div class="kpi-org-header">
                                <div class="kpi-org-name">
                                    <span class="kpi-org-dot" :style="{ backgroundColor: ragColor(org.rag) }"></span>
                                    <span>{{ org.division }}</span>
                                </div>
                                <!-- R/A/G 뱃지 숨김 (요청)
                                <span :class="['rag-badge', ragBg(org.rag)]">{{ org.rag }}</span>
                                -->
                            </div>
                            <div class="kpi-dot-grid">
                                <div v-for="(dot, di) in getKpiDots(org)" :key="di" class="kpi-dot-wrap"
                                    :title="dot.label">
                                    <div class="kpi-dot" :style="{ backgroundColor: dot.color + 'DD' }"></div>
                                </div>
                            </div>
                            <div class="kpi-stage-counts">
                                <span v-if="org.counts.draft > 0" class="text-slate-400"
                                    >0단계 <b>{{ org.counts.draft }}</b></span
                                >
                                <span v-if="org.counts.in_review > 0" class="text-blue"
                                    >1단계 <b>{{ org.counts.in_review }}</b></span
                                >
                                <span v-if="org.counts.public_feedback > 0" class="text-violet"
                                    >2단계 <b>{{ org.counts.public_feedback }}</b></span
                                >
                                <span v-if="org.counts.final_edit > 0" class="text-amber"
                                    >3단계 <b>{{ org.counts.final_edit }}</b></span
                                >
                                <span v-if="org.counts.published > 0" class="text-emerald"
                                    >4단계 <b>{{ org.counts.published }}</b></span
                                >
                                <span class="ml-auto text-slate-600">/ {{ org.target_count }}개</span>
                            </div>
                        </div>
                    </div>
                    <!-- Red/Amber/Green 요약 숨김 (요청)
                    <div class="kpi-rag-summary">
                        <div
                            v-for="r in [
                                { label: 'Green', n: kpiDivisions.filter((d) => d.rag === 'G').length, cls: 'text-emerald' },
                                { label: 'Amber', n: kpiDivisions.filter((d) => d.rag === 'A').length, cls: 'text-amber' },
                                { label: 'Red', n: kpiDivisions.filter((d) => d.rag === 'R').length, cls: 'text-red' }
                            ]"
                            :key="r.label"
                            class="rag-sum-item"
                        >
                            <p :class="['rag-sum-value', r.cls]">{{ r.n }}</p>
                            <p class="rag-sum-label">{{ r.label }}</p>
                        </div>
                    </div>
                    -->
                </div>
            </v-col>

            <!-- Weekly Velocity -->
            <v-col cols="12">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">Weekly Velocity</h3>
                            <p class="ds-card-subtitle">주차별 과제 처리 건수 및 목표선</p>
                        </div>
                    </div>
                    <div v-if="velocity.length" class="velocity-chart">
                        <div v-for="w in velocity" :key="w.week" class="velocity-col">
                            <div class="velocity-bar-area">
                                <div class="velocity-target-line" :style="{ bottom: Math.round((w.target / velocityMax) * 100) + '%' }"></div>
                                <div class="velocity-bar"
                                    :style="{ height: Math.round((w.actual / velocityMax) * 100) + '%', backgroundColor: w.actual >= w.target ? '#10B981CC' : '#3B82F6CC' }">
                                </div>
                            </div>
                            <span class="velocity-label">{{ w.week }}</span>
                        </div>
                    </div>
                    <div v-else class="ds-empty-mini">데이터 없음</div>
                    <div class="velocity-legend">
                        <span class="legend-item"><span class="legend-swatch bg-blue-500"></span>실적</span>
                        <span class="legend-item"><span class="legend-swatch bg-emerald-500"></span>목표 초과</span>
                        <span class="legend-item"><span class="legend-line"></span>목표선</span>
                    </div>
                </div>
            </v-col>

            <!-- 단계 역행(Churn) 현황 -->
            <v-col cols="12">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">단계 역행(Churn) 현황</h3>
                            <p class="ds-card-subtitle">승인 단계를 역행한 횟수가 많은 프로세스 · 현업↔본사 왕복 및 초안 복귀 이력</p>
                        </div>
                        <div class="churn-legend">
                            <span class="churn-legend-item"><span class="churn-icon rev">↩</span>역행</span>
                            <span class="churn-legend-item"><span class="churn-icon fwd">→</span>순방향</span>
                        </div>
                    </div>
                    <div v-if="churnData.length">
                        <v-row dense>
                            <v-col cols="12" lg="5">
                                <div class="churn-table-header">
                                    <div class="col-rank">#</div>
                                    <div class="col-name">프로세스명</div>
                                    <div class="col-total">총 역행</div>
                                    <div class="col-hq">본사→현업</div>
                                    <div class="col-draft">현업→초안</div>
                                    <div class="col-current">현재</div>
                                </div>
                                <div class="churn-rows">
                                    <div v-for="(row, i) in churnData" :key="row.proc_def_id"
                                        :class="['churn-row', { selected: selectedChurn?.proc_def_id === row.proc_def_id }]"
                                        @click="toggleChurn(row)">
                                        <div class="col-rank">
                                            <span :class="['rank-num', i === 0 ? 'text-red' : i === 1 ? 'text-amber' : 'text-slate-500']">{{ i + 1 }}</span>
                                        </div>
                                        <div class="col-name">
                                            <p class="churn-proc-name">{{ row.proc_def_name }}</p>
                                            <span :class="['domain-badge', domainBadgeClass[row.domain] || 'domain-slate']">{{ row.domain }}</span>
                                        </div>
                                        <div class="col-total">
                                            <span :style="{ color: severityColor(getSeverity(row)) }">{{ row.total_churn }}</span>
                                            <div class="churn-total-bar">
                                                <div class="churn-total-fill" :style="{ width: Math.round((row.total_churn / maxChurn) * 100) + '%', backgroundColor: severityColor(getSeverity(row)) }"></div>
                                            </div>
                                        </div>
                                        <div class="col-hq"><span class="text-violet font-bold">{{ row.approved_to_review }}</span></div>
                                        <div class="col-draft"><span class="text-amber font-bold">{{ row.review_to_draft }}</span></div>
                                        <div class="col-current">
                                            <span class="stage-chip" :style="{ color: STAGE_META[row.current_state]?.color, backgroundColor: STAGE_META[row.current_state]?.color + '22' }">
                                                {{ STAGE_META[row.current_state]?.short || row.current_state }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div class="churn-summary">
                                    <div><p class="text-red font-bold text-sm">{{ churnData.reduce((s, r) => s + r.total_churn, 0) }}</p><p class="text-slate-500">총 역행 건수</p></div>
                                    <div><p class="text-violet font-bold text-sm">{{ churnData.reduce((s, r) => s + r.approved_to_review, 0) }}</p><p class="text-slate-500">본사→현업</p></div>
                                    <div><p class="text-amber font-bold text-sm">{{ churnData.reduce((s, r) => s + r.review_to_draft, 0) }}</p><p class="text-slate-500">현업→초안</p></div>
                                </div>
                            </v-col>
                            <v-col cols="12" lg="7">
                                <div v-if="selectedChurn" class="churn-detail">
                                    <div class="churn-detail-header">
                                        <div>
                                            <p class="churn-detail-title">{{ selectedChurn.proc_def_name }}</p>
                                            <p class="text-xs text-slate-500">단계 변경 이력 · 마지막 역행: {{ selectedChurn.last_revert || '-' }}</p>
                                        </div>
                                        <button class="churn-close" @click="selectedChurn = null">✕ 닫기</button>
                                    </div>
                                    <div v-if="selectedChurn.history" class="churn-timeline">
                                        <template v-for="(h, idx) in selectedChurn.history" :key="idx">
                                            <span v-if="idx === 0" class="timeline-stage" :style="{ color: STAGE_META[h.from]?.color, backgroundColor: (STAGE_META[h.from]?.color || '#64748B') + '22' }">{{ STAGE_META[h.from]?.short || h.from }}</span>
                                            <span :class="['timeline-arrow', h.dir === 'rev' ? 'rev' : 'fwd']">{{ h.dir === 'rev' ? '↩' : '→' }}</span>
                                            <span class="timeline-stage" :style="{ color: STAGE_META[h.to]?.color, backgroundColor: (STAGE_META[h.to]?.color || '#64748B') + '22' }">{{ STAGE_META[h.to]?.short || h.to }}</span>
                                        </template>
                                    </div>
                                    <v-row dense class="mt-3">
                                        <v-col cols="6">
                                            <div class="revert-card violet">
                                                <p class="revert-label">본사 수정 후 현업 재검토</p>
                                                <p class="revert-value">{{ selectedChurn.approved_to_review }}회</p>
                                                <p class="revert-sub">승인완료 → 현업검토</p>
                                            </div>
                                        </v-col>
                                        <v-col cols="6">
                                            <div class="revert-card amber">
                                                <p class="revert-label">현업 재작성으로 초안 복귀</p>
                                                <p class="revert-value">{{ selectedChurn.review_to_draft }}회</p>
                                                <p class="revert-sub">현업검토 → 초안</p>
                                            </div>
                                        </v-col>
                                    </v-row>
                                </div>
                                <div v-else class="churn-empty">
                                    <v-icon size="18" color="#475569">mdi-chart-timeline-variant</v-icon>
                                    <p class="churn-empty-title">이력 상세 보기</p>
                                    <p class="churn-empty-desc">좌측 목록에서 프로세스를 클릭하면<br />단계 변경 이력 타임라인이 표시됩니다.</p>
                                </div>
                            </v-col>
                        </v-row>
                    </div>
                    <div v-else class="ds-empty-mini">역행 데이터 없음</div>
                </div>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
/* ─── Light theme base ────────────────────────────────────────────── */
.exec-summary { color: #1e293b; }
.ds-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; }
.ds-empty-mini { text-align: center; padding: 32px; color: #64748b; font-size: 13px; }

.ds-card {
    background: #ffffff;
    border: 1px solid #e5eaef;
    border-radius: 12px;
    padding: 20px;
    height: 100%;
}
.ds-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.ds-card-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.ds-card-subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }

/* ─── Stat boxes ───────────────────────────────────────────────────── */
.stat-box { background: #f8fafc; border-radius: 8px; padding: 12px; border: 1px solid #e8edf3; }
.stat-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
.stat-value-row { display: flex; align-items: flex-end; gap: 4px; }
.stat-big { font-size: 28px; font-weight: 700; color: #0f172a; }
.stat-sub { font-size: 13px; color: #64748b; margin-bottom: 4px; }
.stat-pct { font-size: 11px; margin-top: 4px; }
.progress-bar { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 99px; }
.bg-blue { background: linear-gradient(to right, #3b82f6, #60a5fa); }
.bg-emerald { background: linear-gradient(to right, #10b981, #34d399); }

/* ─── Stage boxes ──────────────────────────────────────────────────── */
.cumulative-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
}
@media (max-width: 720px) {
    .cumulative-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
.stage-box {
    border-radius: 8px;
    padding: 10px;
    text-align: center;
}
.stage-count { font-size: 20px; font-weight: 700; }
.stage-label { font-size: 11px; color: #64748b; margin-top: 2px; }
.stage-slate { background: #f1f5f9; }
.stage-slate .stage-count { color: #475569; }
.stage-blue { background: rgba(59, 130, 246, 0.1); }
.stage-blue .stage-count { color: #2563eb; }
.stage-violet { background: rgba(139, 92, 246, 0.1); }
.stage-violet .stage-count { color: #7c3aed; }
.stage-amber { background: rgba(245, 158, 11, 0.1); }
.stage-amber .stage-count { color: #d97706; }
.stage-cyan { background: rgba(6, 182, 212, 0.1); }
.stage-cyan .stage-count { color: #0891b2; }
.stage-emerald { background: rgba(16, 185, 129, 0.1); }
.stage-emerald .stage-count { color: #059669; }

/* ─── KPI ──────────────────────────────────────────────────────────── */
.kpi-legend { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-dot.empty { border: 1px dashed #cbd5e1; }
.kpi-org-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.kpi-org-item { background: #f8fafc; border: 1px solid #e8edf3; border-radius: 8px; padding: 10px; min-width: 0; }
.kpi-org-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.kpi-org-name { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #1e293b; min-width: 0; }
.kpi-org-name span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-org-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.rag-badge { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
.rag-green { background: rgba(16, 185, 129, 0.12); color: #059669; }
.rag-amber { background: rgba(245, 158, 11, 0.12); color: #d97706; }
.rag-red { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.kpi-dot-grid { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 5px; }
.kpi-dot-wrap { position: relative; min-width: 0; }
.kpi-dot { width: 100%; aspect-ratio: 1; border-radius: 6px; transition: transform 0.15s; cursor: default; }
.kpi-dot.empty { border: 1px dashed #cbd5e1; background: #f1f5f9; }
.kpi-dot-wrap:hover .kpi-dot { transform: scale(1.1); }
.kpi-stage-counts { display: flex; align-items: center; gap: 12px; margin-top: 6px; flex-wrap: wrap; font-size: 11px; }
.kpi-rag-summary { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e8edf3; display: flex; justify-content: space-around; text-align: center; }
.rag-sum-value { font-size: 18px; font-weight: 700; }
.rag-sum-label { font-size: 11px; color: #64748b; }

@media (max-width: 1264px) {
    .kpi-org-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
    .kpi-org-list { grid-template-columns: 1fr; }
}

/* ─── Velocity ─────────────────────────────────────────────────────── */
.velocity-chart { display: flex; align-items: flex-end; gap: 8px; height: 128px; margin-top: 8px; }
.velocity-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.velocity-bar-area { position: relative; width: 100%; flex: 1; display: flex; align-items: flex-end; }
.velocity-target-line { position: absolute; width: 100%; border-top: 2px dashed rgba(217, 119, 6, 0.55); }
.velocity-bar { width: 100%; border-radius: 2px 2px 0 0; transition: height 0.7s; }
.velocity-label { font-size: 11px; color: #64748b; }
.velocity-legend { display: flex; align-items: center; gap: 16px; margin-top: 12px; font-size: 11px; color: #64748b; }
.legend-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.bg-blue-500 { background: rgba(59, 130, 246, 0.8); }
.bg-emerald-500 { background: rgba(16, 185, 129, 0.8); }
.legend-line { display: inline-block; width: 20px; border-top: 2px dashed #f59e0b; margin-right: 4px; vertical-align: middle; }

/* ─── Churn ─────────────────────────────────────────────────────────── */
.churn-legend { display: flex; align-items: center; gap: 12px; font-size: 11px; }
.churn-legend-item { display: flex; align-items: center; gap: 6px; color: #64748b; }
.churn-icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; font-weight: 700; font-size: 12px; }
.churn-icon.rev { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.churn-icon.fwd { background: rgba(16, 185, 129, 0.12); color: #059669; }
.churn-table-header { display: grid; grid-template-columns: 30px 1fr 80px 70px 70px 50px; gap: 8px; padding: 0 12px 8px; border-bottom: 1px solid #e8edf3; font-size: 11px; font-weight: 500; color: #64748b; }
.churn-table-header > div { text-align: center; }
.churn-table-header .col-name { text-align: left; }
.churn-rows { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
.churn-row { display: grid; grid-template-columns: 30px 1fr 80px 70px 70px 50px; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
.churn-row:hover { background: #f1f5f9; }
.churn-row.selected { background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.3); }
.col-rank { text-align: center; }
.col-total { text-align: center; }
.col-hq, .col-draft { text-align: center; font-size: 12px; }
.col-current { display: flex; justify-content: center; }
.rank-num { font-size: 12px; font-weight: 900; }
.churn-proc-name { font-size: 12px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.domain-badge { font-size: 11px; padding: 2px 4px; border-radius: 4px; margin-top: 2px; display: inline-block; }
.domain-blue { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
.domain-violet { background: rgba(139, 92, 246, 0.12); color: #7c3aed; }
.domain-cyan { background: rgba(6, 182, 212, 0.12); color: #0e7490; }
.domain-amber { background: rgba(245, 158, 11, 0.12); color: #b45309; }
.domain-slate { background: rgba(100, 116, 139, 0.14); color: #475569; }
.churn-total-bar { width: 100%; height: 4px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-top: 4px; }
.churn-total-fill { height: 100%; border-radius: 99px; }
.stage-chip { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
.churn-summary { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e8edf3; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 11px; }
.churn-detail { background: #f8fafc; border: 1px solid #e8edf3; border-radius: 12px; padding: 16px; height: 100%; }
.churn-detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.churn-detail-title { font-size: 12px; font-weight: 700; color: #1e293b; }
.churn-close { font-size: 12px; color: #64748b; cursor: pointer; background: none; border: none; }
.churn-close:hover { color: #1e293b; }
.churn-timeline { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.timeline-stage { font-size: 12px; padding: 4px 8px; border-radius: 6px; font-weight: 600; }
.timeline-arrow { display: inline-flex; align-items: center; padding: 4px 6px; border-radius: 6px; font-size: 12px; font-weight: 700; }
.timeline-arrow.rev { background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3); }
.timeline-arrow.fwd { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); }
.revert-card { border-radius: 8px; padding: 12px; }
.revert-card.violet { background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); }
.revert-card.amber { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); }
.revert-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
.revert-value { font-size: 20px; font-weight: 900; }
.revert-card.violet .revert-value { color: #7c3aed; }
.revert-card.amber .revert-value { color: #d97706; }
.revert-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
.churn-empty { height: 100%; min-height: 192px; background: #f8fafc; border: 1px dashed #dbe2ea; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; gap: 8px; }
.churn-empty-title { font-size: 14px; color: #475569; font-weight: 500; }
.churn-empty-desc { font-size: 12px; color: #64748b; }

/* ─── Color utilities ──────────────────────────────────────────────── */
.text-blue { color: #2563eb; }
.text-emerald { color: #059669; }
.text-violet { color: #7c3aed; }
.text-amber { color: #d97706; }
.text-cyan { color: #0891b2; }
.text-red { color: #dc2626; }
.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }
.text-slate-600 { color: #475569; }
.text-xs { font-size: 11px; }
.text-sm { font-size: 14px; }
.font-bold { font-weight: 700; }
</style>
