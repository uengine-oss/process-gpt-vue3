<script setup lang="ts">
/**
 * View 3: Governance & Quality
 * 프로세스 자산 현황, DQ Score, BPMN 문법 오류 목록
 */
import { onMounted, ref, computed } from 'vue';
import { fetchGovernanceQuality } from '@/services/dashboardDataService';
import type { GovernanceQualityData } from '@/services/dashboardDataService';

const props = defineProps<{ filters?: { domains?: string[] } }>();

const loading = ref(true);
const error = ref('');
const d = ref<GovernanceQualityData | null>(null);

async function load() {
    loading.value = true;
    error.value = '';
    try {
        d.value = await fetchGovernanceQuality(props.filters?.domains);
    } catch (e: any) {
        error.value = e?.message || String(e);
    } finally {
        loading.value = false;
    }
}

onMounted(load);

// ─── Computed ────────────────────────────────────────────────────────
const assetStatus = computed(() => d.value?.asset_status || []);
const versionTop = computed(() => d.value?.version_top || []);
const dqMetrics = computed(() => (d.value?.dq_scores || []).filter((s) => s.field_key !== 'overall'));
const dqOverall = computed(() => (d.value?.dq_scores || []).find((s) => s.field_key === 'overall'));
const grammarErrors = computed(() => d.value?.grammar_errors || []);
const dqOverallScore = computed(() => Number(dqOverall.value?.score || 0));
const dqGaugeStyle = computed(() => ({
    background: `conic-gradient(${dqColor(dqOverallScore.value)} ${Math.min(dqOverallScore.value, 100)}%, #e2e8f0 0)`
}));
const qualityCards = computed(() => {
    const totalAssets = assetStatus.value.reduce((sum, item) => sum + Number(item.total_count || 0), 0);
    const activeAssets = assetStatus.value.reduce((sum, item) => sum + Number(item.active_count || 0), 0);
    const errorProcesses = grammarErrors.value.filter((item) => Number(item.error_count || 0) > 0).length;
    const versionChanges = versionTop.value.reduce((sum, item) => sum + Number(item.change_count || 0), 0);
    return [
        { label: '속성별 입력 충실도', value: `${dqOverallScore.value}%`, tone: dqColor(dqOverallScore.value) },
        { label: '품질 기준 준수', value: `${totalAssets ? Math.round((activeAssets / totalAssets) * 100) : 0}%`, tone: '#10B981' },
        { label: '오류 프로세스 건수', value: `${errorProcesses}건`, tone: errorProcesses > 0 ? '#EF4444' : '#10B981' },
        { label: '버전 변경 빈도', value: `${versionChanges}회`, tone: '#F59E0B' }
    ];
});

function dqColor(score: number) {
    return score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
}
</script>

<template>
    <div class="governance">
        <div v-if="loading" class="ds-loading">
            <v-progress-circular indeterminate color="#3B82F6" size="40" />
            <p class="text-slate-400 mt-3">데이터를 불러오는 중...</p>
        </div>
        <v-alert v-else-if="error" type="error" variant="tonal" class="ma-4">{{ error }}</v-alert>

        <v-row v-else dense>
            <v-col cols="12">
                <div class="quality-metric-grid">
                    <div v-for="card in qualityCards" :key="card.label" class="quality-metric-card">
                        <span class="quality-metric-label">{{ card.label }}</span>
                        <strong :style="{ color: card.tone }">{{ card.value }}</strong>
                    </div>
                </div>
            </v-col>

            <!-- 프로세스 자산 현황 -->
            <v-col cols="12" lg="7">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">프로세스 자산 현황</h3>
                            <p class="ds-card-subtitle">도메인별 상태 점유율 및 버전 변경 빈도</p>
                        </div>
                    </div>
                    <div class="asset-list">
                        <div v-for="a in assetStatus" :key="a.domain" class="asset-item">
                            <div class="asset-label-row">
                                <span class="asset-domain">{{ a.domain }}</span>
                                <span class="text-slate-500">총 {{ a.total_count }}건</span>
                            </div>
                            <div class="asset-bar">
                                <div class="asset-seg active" :style="{ width: (a.total_count ? Math.round((a.active_count / a.total_count) * 100) : 0) + '%' }">
                                    <span v-if="a.total_count && Math.round((a.active_count / a.total_count) * 100) > 10">{{ Math.round((a.active_count / a.total_count) * 100) }}%</span>
                                </div>
                                <div class="asset-seg draft" :style="{ width: (a.total_count ? Math.round((a.draft_count / a.total_count) * 100) : 0) + '%' }">
                                    <span v-if="a.total_count && Math.round((a.draft_count / a.total_count) * 100) > 8">{{ Math.round((a.draft_count / a.total_count) * 100) }}%</span>
                                </div>
                                <div class="asset-seg dep" :style="{ width: (a.total_count ? Math.round((a.deprecated_count / a.total_count) * 100) : 0) + '%' }">
                                    <span v-if="a.total_count && Math.round((a.deprecated_count / a.total_count) * 100) > 8">{{ Math.round((a.deprecated_count / a.total_count) * 100) }}%</span>
                                </div>
                            </div>
                            <div class="asset-legend">
                                <span><span class="asset-dot active"></span>활성 {{ a.active_count }}</span>
                                <span><span class="asset-dot draft"></span>초안 {{ a.draft_count }}</span>
                                <span><span class="asset-dot dep"></span>폐기 {{ a.deprecated_count }}</span>
                            </div>
                        </div>
                    </div>
                    <div v-if="versionTop.length" class="version-section">
                        <p class="version-title">버전 변경 빈도 Top 5</p>
                        <div class="version-list">
                            <div v-for="(v, i) in versionTop" :key="v.proc_def_name" class="version-chip">
                                <span class="version-rank">#{{ i + 1 }}</span>
                                <span class="version-name">{{ v.proc_def_name }}</span>
                                <span class="version-count">{{ v.change_count }}회</span>
                            </div>
                        </div>
                    </div>
                </div>
            </v-col>

            <!-- DQ Score -->
            <v-col cols="12" lg="5">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">표준 준수 / DQ Score</h3>
                            <p class="ds-card-subtitle">속성 입력 충실도 (Data Quality)</p>
                        </div>
                    </div>
                    <div v-if="dqOverall" class="dq-gauge-wrap">
                        <div class="dq-gauge" :style="dqGaugeStyle">
                            <div class="dq-gauge-inner">
                                <span>DQ</span>
                                <strong>{{ dqOverall.score }}%</strong>
                            </div>
                        </div>
                        <div class="dq-gauge-copy">
                            <p>전체 DQ 평균 점수</p>
                            <span :style="{ color: dqColor(dqOverall.score) }">{{ dqOverall.score }}%</span>
                        </div>
                    </div>
                    <div class="dq-list">
                        <div v-for="item in dqMetrics" :key="item.field_key" class="dq-item">
                            <span class="dq-attr">{{ item.label }}</span>
                            <div class="dq-bar-bg">
                                <div class="dq-bar-fill" :style="{ width: (item.score || 0) + '%', backgroundColor: dqColor(item.score) }"></div>
                            </div>
                            <div class="dq-score-wrap">
                                <span class="dq-score" :style="{ color: dqColor(item.score) }">{{ item.score }}%</span>
                                <v-icon v-if="item.trend === 'up'" size="10" color="#059669">mdi-trending-up</v-icon>
                                <v-icon v-else-if="item.trend === 'down'" size="10" color="#dc2626">mdi-trending-down</v-icon>
                            </div>
                        </div>
                    </div>
                </div>
            </v-col>

            <!-- 문법 오류 프로세스 목록 -->
            <v-col cols="12">
                <div class="ds-card">
                    <div class="ds-card-header">
                        <div>
                            <h3 class="ds-card-title">문법 오류 프로세스 목록</h3>
                            <p class="ds-card-subtitle">BPMN 문법 위반 항목 (자동 검사 결과)</p>
                        </div>
                    </div>
                    <div v-if="grammarErrors.length" class="grammar-table-wrap">
                        <table class="grammar-table">
                            <thead>
                                <tr>
                                    <th v-for="h in ['프로세스명', '오류 건수', '주요 오류 유형', '최종 검사일', '상태']" :key="h">{{ h }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="g in grammarErrors" :key="g.proc_def_name"
                                    :class="g.error_count > 0 ? 'grammar-row-err' : 'grammar-row-ok'">
                                    <td :class="g.error_count > 0 ? 'grammar-name' : 'text-slate-400'">{{ g.proc_def_name }}</td>
                                    <td>
                                        <span :class="g.error_count > 0 ? 'text-red font-bold' : 'text-slate-400'">{{ g.error_count }}</span>
                                        <span class="text-slate-500">건</span>
                                    </td>
                                    <td>
                                        <span v-if="g.primary_error_type !== '-'" class="error-type-badge">{{ g.primary_error_type }}</span>
                                        <span v-else class="text-slate-600">-</span>
                                    </td>
                                    <td class="text-slate-500">{{ g.last_checked_at }}</td>
                                    <td>
                                        <span :class="['status-badge', g.status === '정상' ? 'ok' : 'error']">{{ g.status }}</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="ds-empty-mini">문법 오류 데이터 없음</div>
                </div>
            </v-col>
        </v-row>
    </div>
</template>

<style scoped>
.governance { color: #1e293b; }
.ds-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; }
.ds-empty-mini { text-align: center; padding: 32px; color: #64748b; font-size: 13px; }
.ds-card { background: #ffffff; border: 1px solid #e5eaef; border-radius: 12px; padding: 20px; height: 100%; }
.ds-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.ds-card-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.ds-card-subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }

/* ─── Quality Metrics ─────────────────────────────────────────────── */
.quality-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.quality-metric-card { background: #ffffff; border: 1px solid #e5eaef; border-radius: 8px; padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.quality-metric-label { color: #64748b; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quality-metric-card strong { font-size: 20px; font-weight: 900; }

/* ─── Asset Status ─────────────────────────────────────────────────── */
.asset-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.asset-label-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
.asset-domain { color: #334155; font-weight: 500; }
.asset-bar { height: 20px; background: #e2e8f0; border-radius: 6px; overflow: hidden; display: flex; }
.asset-seg { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; transition: width 0.5s; }
.asset-seg.active { background: rgba(16, 185, 129, 0.7); color: #fff; }
.asset-seg.draft { background: rgba(59, 130, 246, 0.6); color: #fff; }
.asset-seg.dep { background: rgba(100, 116, 139, 0.45); color: #fff; }
.asset-legend { display: flex; gap: 16px; margin-top: 4px; font-size: 11px; color: #64748b; }
.asset-legend span { display: flex; align-items: center; gap: 4px; }
.asset-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
.asset-dot.active { background: rgba(16, 185, 129, 0.7); }
.asset-dot.draft { background: rgba(59, 130, 246, 0.6); }
.asset-dot.dep { background: rgba(100, 116, 139, 0.45); }

.version-section { padding-top: 12px; border-top: 1px solid #e8edf3; }
.version-title { font-size: 11px; color: #64748b; margin-bottom: 8px; }
.version-list { display: flex; flex-wrap: wrap; gap: 8px; }
.version-chip { background: #f8fafc; border: 1px solid #e8edf3; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; }
.version-rank { font-size: 11px; color: #64748b; }
.version-name { font-size: 12px; color: #334155; }
.version-count { font-size: 12px; font-weight: 600; color: #d97706; }

/* ─── DQ Score ─────────────────────────────────────────────────────── */
.dq-gauge-wrap { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; padding: 12px; background: #f8fafc; border: 1px solid #e8edf3; border-radius: 8px; }
.dq-gauge { width: 118px; height: 118px; border-radius: 50%; padding: 10px; flex-shrink: 0; }
.dq-gauge-inner { width: 100%; height: 100%; border-radius: 50%; background: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #e2e8f0; }
.dq-gauge-inner span { color: #64748b; font-size: 11px; font-weight: 700; }
.dq-gauge-inner strong { color: #1e293b; font-size: 24px; font-weight: 900; }
.dq-gauge-copy p { color: #64748b; font-size: 12px; margin-bottom: 4px; }
.dq-gauge-copy span { font-size: 18px; font-weight: 900; }
.dq-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.dq-item { display: flex; align-items: center; gap: 12px; }
.dq-attr { font-size: 12px; color: #475569; width: 96px; flex-shrink: 0; }
.dq-bar-bg { flex: 1; height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.dq-bar-fill { height: 100%; border-radius: 99px; transition: width 0.5s; }
.dq-score-wrap { display: flex; align-items: center; gap: 6px; width: 56px; }
.dq-score { font-size: 12px; font-weight: 600; }
.dq-avg-box { background: #f8fafc; border-radius: 8px; padding: 12px; border: 1px solid #e8edf3; }
.dq-avg-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.dq-avg-value { font-size: 18px; font-weight: 700; color: #d97706; }
.progress-bar { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 99px; }
.bg-amber { background: #f59e0b; }

/* ─── Grammar Table ────────────────────────────────────────────────── */
.grammar-table-wrap { overflow-x: auto; }
.grammar-table { width: 100%; font-size: 12px; }
.grammar-table th { text-align: left; color: #64748b; font-weight: 500; padding: 8px 24px 8px 0; border-bottom: 1px solid #e8edf3; }
.grammar-table td { padding: 12px 24px 12px 0; }
.grammar-row-err { border-bottom: 1px solid #eef2f7; transition: background 0.2s; }
.grammar-row-err:hover { background: #f8fafc; }
.grammar-row-ok { transition: background 0.2s; }
.grammar-row-ok:hover { background: #f8fafc; }
.grammar-name { color: #1e293b; font-weight: 500; }
.error-type-badge { background: rgba(239, 68, 68, 0.1); color: #dc2626; padding: 2px 8px; border-radius: 4px; }
.status-badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; }
.status-badge.error { background: rgba(239, 68, 68, 0.12); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.2); }
.status-badge.ok { background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); }

/* ─── Color utilities ──────────────────────────────────────────────── */
.text-red { color: #dc2626; }
.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }
.text-slate-600 { color: #475569; }
.text-xs { font-size: 11px; }
.font-bold { font-weight: 700; }

@media (max-width: 960px) {
    .quality-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
    .quality-metric-grid { grid-template-columns: 1fr; }
    .dq-gauge-wrap { flex-direction: column; align-items: flex-start; }
}
</style>
