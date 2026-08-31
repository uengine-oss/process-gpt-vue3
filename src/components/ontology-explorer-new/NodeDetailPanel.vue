<template>
    <div class="ndp-root">
        <div v-if="!node" class="ndp-empty">노드를 선택하면 상세가 표시됩니다</div>

        <template v-else>
            <!-- 헤더 -->
            <div class="ndp-head">
                <span class="ndp-kind" :style="{ background: kindColor }">{{ kindLabel }}</span>
                <div class="ndp-name">{{ node.name }}</div>
                <div class="ndp-layer">{{ layerLabel }}</div>
            </div>

            <!-- 추적 액션 (FR-009/FR-011) -->
            <div v-if="traceMode" class="ndp-actions">
                <button v-if="traceMode === 'rootCause'" class="ndp-btn ndp-btn-warn" @click="$emit('trace-root-cause', node.id)">
                    ⤵ 역추적 (원인 분석)
                </button>
                <button v-else class="ndp-btn ndp-btn-up" @click="$emit('trace-contribution', node.id)">⤴ 순추적 (기여 분석)</button>
            </div>

            <!-- KPI 특화 (FR-007, US2) -->
            <section v-if="node.label === 'KPI'" class="ndp-section">
                <div class="ndp-sec-title">KPI 평가</div>
                <div class="ndp-kpi-badges">
                    <span class="ndp-chip" :class="`ndp-mt-${measureType}`">{{ measureTypeLabel }}</span>
                    <span v-if="kpiStatus" class="ndp-chip" :class="`ndp-st-${kpiStatus}`">{{ kpiStatusLabel }}</span>
                </div>
                <div v-if="kpiTarget != null" class="ndp-gauge">
                    <div class="ndp-gauge-line">
                        <span>현재 {{ kpiCurrent ?? '—' }}{{ kpiUnit }}</span>
                        <span>목표 {{ kpiTarget }}{{ kpiUnit }}</span>
                    </div>
                    <div class="ndp-gauge-track">
                        <div class="ndp-gauge-fill" :class="{ warn: kpiStatus === 'warning' }" :style="{ width: gaugePct + '%' }" />
                    </div>
                </div>
                <div v-if="survey" class="ndp-line">
                    설문 평균 <b>{{ survey.avgRating }}점</b> ({{ survey.answeredCount }}건 응답) — 정성 평가
                </div>
                <div class="ndp-line">
                    <button v-if="sourcedFromId" class="ndp-btn ndp-btn-link" @click="$emit('go-node', sourcedFromId)">
                        → 원천 프로세스로 이동
                    </button>
                    <span v-else class="ndp-gap">실행 연결 없음 — 이 KPI 는 원천 프로세스(SOURCED_FROM)가 없습니다 (전략-실행 단절)</span>
                </div>
            </section>

            <!-- Activity 특화 (US2) -->
            <section v-if="node.label === 'Activity'" class="ndp-section">
                <div class="ndp-sec-title">실행 집계</div>
                <div v-if="rollup" class="ndp-line">
                    처리 {{ rollup.workItemCount }}건 · 평균
                    {{ rollup.avgDurationHours != null ? rollup.avgDurationHours + '시간' : '—' }} · 재작업 {{ rollup.reworkSum }} · 진행 중
                    {{ rollup.inProgressCount }}
                </div>
                <div v-else class="ndp-line ndp-dim">집계 없음 (실행 데이터 미적재)</div>
            </section>

            <!-- 인접 관계 (FR-006/FR-008) -->
            <section class="ndp-section">
                <div class="ndp-sec-title">연결 관계 ({{ relations.length }})</div>
                <ul class="ndp-rel-list">
                    <li v-for="rel in relations" :key="rel.edgeId">
                        <span class="ndp-rel-type" :class="{ inh: rel.type === 'EXTENDS', ref: rel.type === 'REQUIRES_SKILL' }">
                            {{ rel.dir === 'out' ? '→' : '←' }} {{ rel.type }}
                        </span>
                        <button class="ndp-rel-target" @click="$emit('go-node', rel.otherId)">{{ rel.otherName }}</button>
                    </li>
                    <li v-if="!relations.length" class="ndp-dim">연결 없음</li>
                </ul>
            </section>

            <!-- 속성 원문 (스키마 §4) -->
            <section class="ndp-section">
                <div class="ndp-sec-title">속성</div>
                <table class="ndp-props">
                    <tbody>
                        <tr v-for="[key, value] in propEntries" :key="key">
                            <td class="ndp-prop-k">{{ key }}</td>
                            <td class="ndp-prop-v">{{ value }}</td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { availableTraceMode } from '@/composables/ontologyNew/impactTrace';
import { LAYER_LABEL_KO, colorForLabel, labelKo } from '@/composables/ontologyNew/layerMapping';
import type { ActivityRollup, BusinessEdge, BusinessNode, KpiStatus } from '@/composables/ontologyNew/types';

const props = defineProps<{
    node: BusinessNode | null;
    edges: BusinessEdge[];
    nodeById: Map<string, BusinessNode>;
    kpiStatus: KpiStatus | null;
    rollup: ActivityRollup | null;
    survey: { avgRating: number; answeredCount: number } | null;
}>();

defineEmits<{
    (e: 'go-node', nodeId: string): void;
    (e: 'trace-root-cause', nodeId: string): void;
    (e: 'trace-contribution', nodeId: string): void;
}>();

const kindLabel = computed(() => (props.node ? labelKo(props.node.label) : ''));
const kindColor = computed(() => (props.node ? colorForLabel(props.node.label) : '#94a3b8'));
const layerLabel = computed(() => (props.node ? LAYER_LABEL_KO[props.node.layer] : ''));
const traceMode = computed(() => (props.node ? availableTraceMode(props.node) : null));

/* ── KPI 파생 ── */

function numProp(key: string): number | null {
    const v = props.node?.properties?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    return null;
}

const measureType = computed(() => String(props.node?.properties?.measure_type ?? 'manual'));
const MEASURE_LABELS: Record<string, string> = {
    instance_count: '정량 — 실행 건수',
    avg_duration_hours: '정량 — 평균 소요시간',
    survey_score: '정성 — 설문',
    manual: '수동 입력'
};
const measureTypeLabel = computed(() => MEASURE_LABELS[measureType.value] ?? measureType.value);
const kpiStatusLabel = computed(() => (props.kpiStatus === 'ok' ? '달성' : props.kpiStatus === 'warning' ? '경고' : '측정 전'));
const kpiTarget = computed(() => numProp('target_value'));
const kpiCurrent = computed(() => numProp('current_value'));
const kpiUnit = computed(() => {
    const u = props.node?.properties?.unit;
    return typeof u === 'string' && u ? ` ${u}` : '';
});
const gaugePct = computed(() => {
    if (kpiTarget.value == null || kpiCurrent.value == null || kpiTarget.value === 0) return 0;
    const direction = String(props.node?.properties?.direction ?? 'increase');
    const ratio = direction === 'decrease' ? kpiTarget.value / Math.max(kpiCurrent.value, 0.0001) : kpiCurrent.value / kpiTarget.value;
    return Math.max(2, Math.min(100, Math.round(ratio * 100)));
});

/** KPI 의 원천 프로세스(SOURCED_FROM 대상) — 부재 시 전략-실행 단절 표기 (FR-018) */
const sourcedFromId = computed<string | null>(() => {
    if (!props.node || props.node.label !== 'KPI') return null;
    const hit = props.edges.find((e) => e.type === 'SOURCED_FROM' && e.source === props.node!.id);
    return hit?.target ?? null;
});

/* ── 인접 관계 ── */

const relations = computed(() => {
    const node = props.node;
    if (!node) return [];
    const list: Array<{ edgeId: string; type: string; dir: 'out' | 'in'; otherId: string; otherName: string }> = [];
    for (const e of props.edges) {
        if (e.source !== node.id && e.target !== node.id) continue;
        const dir = e.source === node.id ? 'out' : 'in';
        const otherId = dir === 'out' ? e.target : e.source;
        const other = props.nodeById.get(otherId);
        if (!other) continue;
        list.push({ edgeId: e.id, type: e.type, dir, otherId, otherName: other.name });
    }
    return list.sort((a, b) => a.type.localeCompare(b.type) || a.otherName.localeCompare(b.otherName, 'ko'));
});

/* ── 속성 표 (ISO 시간은 로컬 표기) ── */

const propEntries = computed<Array<[string, string]>>(() => {
    const properties = props.node?.properties ?? {};
    return Object.entries(properties)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
            let text: string;
            if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
                const d = new Date(v);
                text = Number.isNaN(d.getTime()) ? v : d.toLocaleString();
            } else if (typeof v === 'object') {
                text = JSON.stringify(v);
            } else {
                text = String(v);
            }
            return [k, text] as [string, string];
        })
        .sort((a, b) => a[0].localeCompare(b[0]));
});
</script>

<style scoped>
.ndp-root {
    height: 100%;
    overflow-y: auto;
    padding: 14px;
    font-size: 13px;
    color: #1e293b;
}
.ndp-empty {
    color: #94a3b8;
    text-align: center;
    padding: 40px 0;
}
.ndp-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
}
.ndp-kind {
    color: #fff;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
}
.ndp-name {
    font-weight: 700;
    font-size: 15px;
}
.ndp-layer {
    color: #94a3b8;
    font-size: 11px;
}
.ndp-actions {
    margin-bottom: 12px;
}
.ndp-btn {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;
}
.ndp-btn-warn {
    border-color: #f59e0b;
    color: #92400e;
    background: #fffbeb;
}
.ndp-btn-up {
    border-color: #16a34a;
    color: #14532d;
    background: #f0fdf4;
}
.ndp-btn-link {
    border-color: #93c5fd;
    color: #1d4ed8;
    background: #eff6ff;
}
.ndp-section {
    border-top: 1px solid #f1f5f9;
    padding: 10px 0;
}
.ndp-sec-title {
    font-weight: 600;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 6px;
}
.ndp-kpi-badges {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
}
.ndp-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid #e2e8f0;
}
.ndp-mt-survey_score {
    background: #fdf4ff;
    border-color: #e9d5ff;
    color: #7e22ce;
}
.ndp-mt-instance_count,
.ndp-mt-avg_duration_hours {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
}
.ndp-st-ok {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #15803d;
}
.ndp-st-warning {
    background: #fef2f2;
    border-color: #fecaca;
    color: #b91c1c;
}
.ndp-gauge {
    margin: 6px 0;
}
.ndp-gauge-line {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #64748b;
    margin-bottom: 4px;
}
.ndp-gauge-track {
    height: 8px;
    border-radius: 999px;
    background: #f1f5f9;
    overflow: hidden;
}
.ndp-gauge-fill {
    height: 100%;
    background: #22c55e;
    border-radius: 999px;
}
.ndp-gauge-fill.warn {
    background: #ef4444;
}
.ndp-line {
    margin: 4px 0;
}
.ndp-gap {
    color: #b91c1c;
    font-size: 12px;
}
.ndp-dim {
    color: #94a3b8;
}
.ndp-rel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
    max-height: 220px;
    overflow-y: auto;
}
.ndp-rel-type {
    font-size: 11px;
    color: #64748b;
    margin-right: 6px;
}
.ndp-rel-type.inh {
    color: #15803d;
    font-weight: 600;
}
.ndp-rel-type.ref {
    color: #16a34a;
}
.ndp-rel-target {
    border: none;
    background: none;
    color: #1d4ed8;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
}
.ndp-props {
    width: 100%;
    border-collapse: collapse;
}
.ndp-prop-k {
    color: #64748b;
    font-size: 11px;
    padding: 2px 8px 2px 0;
    vertical-align: top;
    white-space: nowrap;
}
.ndp-prop-v {
    font-size: 12px;
    word-break: break-all;
}
</style>
