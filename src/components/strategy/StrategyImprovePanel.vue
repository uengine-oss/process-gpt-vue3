<script setup lang="ts">
// 전략 개선점 — 전략목표 상세 패널의 '개선점' 탭(기존 /analytics/ontology '전략 개선점' 탭을 옮김).
// 전략 → 미달 KPI → 병목 태스크·리소스 → 개선할 스킬을 하향 분석한다(strategy-service /api/impact/strategy/{id}).
// 진단(diagnosis)은 LLM 후보라 결정적 분석(미달 KPI·병목·스킬 점수) 아래 근거와 함께 보인다.
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStrategyStore } from '@/stores/strategy/strategyStore';

const props = defineProps<{ objectiveId: string }>();
const store = useStrategyStore();
const router = useRouter();

const data = ref<any | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let loadedFor: string | null = null;

async function load(id: string) {
    loading.value = true;
    error.value = null;
    data.value = null;
    loadedFor = id;
    try {
        const res = await store.getImpactStrategy(id);
        if (loadedFor === id) data.value = res;
    } catch (e: any) {
        if (loadedFor === id) error.value = e?.response?.data?.detail || e?.message || '개선점을 불러오지 못했습니다.';
    } finally {
        if (loadedFor === id) loading.value = false;
    }
}
watch(
    () => props.objectiveId,
    (id) => id && id !== loadedFor && load(id),
    { immediate: true }
);

// 진단은 {summary, recommendations[], note} — 예전 응답(문자열)도 받는다
const diagnosis = computed(() => {
    const d = data.value?.diagnosis;
    if (!d) return null;
    if (typeof d === 'string') return { summary: d, recommendations: [], note: '' };
    return { summary: d.summary || '', recommendations: d.recommendations || [], note: d.note || '' };
});
const laggingKpis = computed(() => [...(data.value?.lagging_kpis || [])].sort((a: any, b: any) => a.achievement - b.achievement));
// 병목 태스크 — 같은 태스크가 여러 KPI 로 나오면 한 번만(처음 = 점수 높은 KPI)
const bottlenecks = computed(() => {
    const seen = new Set<string>();
    return (data.value?.bottlenecks || []).filter((b: any) => b.type === 'task' && !seen.has(b.id) && seen.add(b.id)).slice(0, 5);
});
const skills = computed(() => (data.value?.skill_improvements || []).slice(0, 6));

const KPI_LIMIT = 6;
const showAllKpis = ref(false);
const visibleKpis = computed(() => (showAllKpis.value ? laggingKpis.value : laggingKpis.value.slice(0, KPI_LIMIT)));

function fmt(v: any) {
    return v == null ? '-' : Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}
function skillName(s: any): string {
    return typeof s?.skill === 'object' ? s.skill?.name : s?.skill;
}
// 연결 경로 — 경로 배열의 노드만(관계 이름 제외) 이름으로 잇는다
function chainOf(path: any): string {
    const p = Array.isArray(path?.[0]) ? path[0] : path;
    if (!Array.isArray(p)) return '';
    return p
        .filter((_: any, i: number) => i % 2 === 0)
        .map((x: string) => x.split(':').slice(1).join(':') || x)
        .join(' → ');
}
function hours(h: any) {
    if (h == null) return '';
    return h >= 24 ? `${(h / 24).toFixed(1)}일` : `${Number(h).toFixed(1)}시간`;
}
</script>

<template>
    <div class="improve-panel" data-testid="improve-panel">
        <div v-if="loading" class="d-flex flex-column align-center py-6 text-caption text-medium-emphasis">
            <v-progress-circular indeterminate size="24" color="primary" class="mb-2" />
            KPI·병목·스킬을 분석하는 중…
        </div>
        <v-alert v-else-if="error" type="warning" variant="tonal" density="compact">{{ error }}</v-alert>
        <template v-else-if="data">
            <div class="text-caption text-medium-emphasis mb-3">
                이 목표와 하위 전략의 KPI 중 목표에 못 미친 것과, 그 KPI 로 이어지는 병목 태스크·개선할 스킬입니다.
            </div>

            <div v-if="diagnosis?.summary" class="improve-diagnosis mb-4">
                <div class="d-flex align-center ga-1 mb-1">
                    <v-icon size="16" color="primary">mdi-stethoscope</v-icon>
                    <span class="text-subtitle-2 font-weight-bold">진단</span>
                </div>
                <div class="text-body-2">{{ diagnosis.summary }}</div>
                <ul v-if="diagnosis.recommendations.length" class="improve-reco text-body-2 mt-2">
                    <li v-for="(r, i) in diagnosis.recommendations" :key="i">{{ r }}</li>
                </ul>
                <div v-if="diagnosis.note" class="text-caption text-medium-emphasis mt-1">{{ diagnosis.note }}</div>
            </div>

            <div class="improve-section-title">미달 KPI {{ laggingKpis.length }}</div>
            <div v-if="!laggingKpis.length" class="text-caption text-medium-emphasis mb-4">미달 KPI 가 없습니다.</div>
            <div v-else class="mb-4">
                <div v-for="k in visibleKpis" :key="k.id" class="improve-kpi">
                    <div class="d-flex align-center ga-2">
                        <span class="text-body-2 font-weight-medium flex-grow-1 text-truncate" :title="k.name">{{ k.name }}</span>
                        <span class="text-caption text-error font-weight-bold">{{ Math.round(k.achievement) }}%</span>
                    </div>
                    <v-progress-linear :model-value="Math.min(100, k.achievement)" color="error" bg-color="error" bg-opacity="0.12" height="4" rounded />
                    <div class="text-caption text-medium-emphasis">
                        현재 {{ fmt(k.current_value) }} / 목표 {{ fmt(k.target_value) }} {{ k.unit }}
                        <span v-if="k.strategy_name && k.strategy_id !== objectiveId"> · {{ k.strategy_name }}</span>
                    </div>
                </div>
                <v-btn v-if="laggingKpis.length > KPI_LIMIT" size="x-small" variant="text" @click="showAllKpis = !showAllKpis">
                    {{ showAllKpis ? '접기' : `${laggingKpis.length - KPI_LIMIT}개 더 보기` }}
                </v-btn>
            </div>

            <template v-if="bottlenecks.length">
                <div class="improve-section-title">병목 태스크</div>
                <div class="mb-4">
                    <div v-for="b in bottlenecks" :key="b.id" class="improve-row">
                        <v-icon size="16" color="warning">mdi-timer-sand</v-icon>
                        <div class="flex-grow-1 min-w-0">
                            <div class="text-body-2 text-truncate">{{ b.name }}</div>
                            <div class="text-caption text-medium-emphasis text-truncate">{{ b.kpi_name }}</div>
                        </div>
                        <span class="text-caption">{{ hours(b.metrics?.avg_duration_hours) }}</span>
                    </div>
                </div>
            </template>

            <div class="improve-section-title">개선할 스킬</div>
            <div v-if="!skills.length" class="text-caption text-medium-emphasis">스킬 개선 후보가 없습니다.</div>
            <v-card v-for="(s, si) in skills" :key="si" variant="outlined" class="pa-3 mb-2">
                <div class="d-flex align-center ga-2 mb-1">
                    <v-icon size="16" color="pink">mdi-star-four-points-outline</v-icon>
                    <span class="text-body-2 font-weight-bold flex-grow-1">{{ skillName(s) }}</span>
                    <v-chip size="x-small" color="pink" variant="tonal">점수 {{ fmt(s.score) }}</v-chip>
                </div>
                <div class="text-caption text-medium-emphasis">{{ chainOf(s.linked_via) }}</div>
                <v-btn class="mt-1 px-0" size="x-small" variant="text" color="pink" @click="router.push(`/skills/${encodeURIComponent(skillName(s))}`)">
                    스킬 상세 보기
                </v-btn>
            </v-card>
        </template>
    </div>
</template>

<style scoped>
.improve-diagnosis {
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(var(--v-theme-primary), 0.06);
}
.improve-reco {
    padding-left: 18px;
}
.improve-section-title {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 6px;
}
.improve-kpi {
    padding: 6px 0;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.improve-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.min-w-0 {
    min-width: 0;
}
</style>
