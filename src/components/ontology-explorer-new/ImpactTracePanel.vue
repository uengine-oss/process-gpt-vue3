<template>
    <div class="itp-root">
        <div v-if="!trace" class="itp-empty">
            <template v-if="strategyEnabled">
                KPI/전략목표에서 <b>역추적(원인 분석)</b>, 스킬/리소스에서 <b>순추적(기여 분석)</b>을 실행하면 결과가 표시됩니다.
            </template>
            <template v-else>
                스킬/리소스 노드에서 <b>순추적(기여 분석)</b>을 실행하면 해당 자산이 어느 테스크·프로세스에 기여하는지 표시됩니다.
            </template>
        </div>

        <template v-else>
            <!-- 요약 -->
            <div class="itp-head">
                <span class="itp-mode" :class="trace.mode === 'rootCause' ? 'down' : 'up'">
                    {{ trace.mode === 'rootCause' ? '⤵ 역추적 (원인 분석)' : '⤴ 순추적 (기여 분석)' }}
                </span>
                <button class="itp-exit" @click="$emit('exit-trace')">종료 (ESC)</button>
            </div>
            <div class="itp-summary">
                시작: <button class="itp-link" @click="$emit('go-node', trace.originId)">{{ originName }}</button> · 경로 노드
                {{ trace.nodeIds.size }}개 · 엣지 {{ trace.edgeIds.size }}개
            </div>

            <!-- 경고 (FR-018/019, 순환) -->
            <div v-for="w in trace.warnings" :key="w.kind + w.nodeId" class="itp-warning" :class="w.kind">
                <b>{{ warningTitle(w.kind) }}</b> — {{ w.message }}
                <button class="itp-link" @click="$emit('go-node', w.nodeId)">해당 노드</button>
            </div>

            <!-- 원인 후보 (rootCause, FR-010) -->
            <section v-if="trace.mode === 'rootCause'" class="itp-section">
                <div class="itp-sec-title">원인 후보 ({{ trace.causeCandidates.length }}) — 집계 내림차순</div>
                <ol class="itp-cands">
                    <li v-for="cand in trace.causeCandidates" :key="cand.nodeId">
                        <button class="itp-cand" @click="$emit('go-node', cand.nodeId)">
                            <span class="itp-cand-name">{{ nameOf(cand.nodeId) }}</span>
                            <span class="itp-cand-reason" :class="cand.reason">{{ reasonLabel(cand.reason) }}</span>
                            <span v-if="cand.metrics" class="itp-cand-metrics">
                                <template v-if="cand.metrics.avgDurationHours != null">⏱ {{ cand.metrics.avgDurationHours }}h</template>
                                <template v-if="cand.metrics.reworkSum > 0"> · ↻ {{ cand.metrics.reworkSum }}</template>
                                <template v-if="cand.metrics.inProgressCount > 0"> · ▶ {{ cand.metrics.inProgressCount }}</template>
                            </span>
                            <span v-else class="itp-cand-nometrics">집계 없음</span>
                        </button>
                    </li>
                    <li v-if="!trace.causeCandidates.length" class="itp-dim">원인 후보 없음</li>
                </ol>
            </section>

            <!-- 순추적 도달 요약 (contribution) — 전략 레이어 비활성 시 프로세스 정의가 도달점 -->
            <section v-else class="itp-section">
                <div class="itp-sec-title">{{ strategyEnabled ? '기여 경로 도달점' : '기여 프로세스 (도달점)' }}</div>
                <ul class="itp-cands">
                    <li v-for="n in reachedTop" :key="n.id">
                        <button class="itp-cand" @click="$emit('go-node', n.id)">
                            <span class="itp-cand-name">{{ n.name }}</span>
                            <span class="itp-cand-reason contribution">{{ kindOf(n) }}</span>
                        </button>
                    </li>
                    <li v-if="!reachedTop.length" class="itp-dim">
                        {{
                            strategyEnabled
                                ? '전략 레이어까지 도달하지 못했습니다 — 중간 연결(테스크·프로세스·KPI)을 확인하세요'
                                : '연결된 프로세스가 없습니다 — 테스크의 스킬 참조/수행 주체 연결을 확인하세요'
                        }}
                    </li>
                </ul>
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { isLayerEnabled } from '@/composables/ontologyNew/config';
import { labelKo } from '@/composables/ontologyNew/layerMapping';
import type { BusinessNode, CauseReason, ImpactTrace, TraceWarningKind } from '@/composables/ontologyNew/types';

const props = defineProps<{
    trace: ImpactTrace | null;
    nodeById: Map<string, BusinessNode>;
}>();

defineEmits<{
    (e: 'go-node', nodeId: string): void;
    (e: 'exit-trace'): void;
}>();

const originName = computed(() => nameOf(props.trace?.originId ?? ''));

function nameOf(nodeId: string): string {
    return props.nodeById.get(nodeId)?.name ?? nodeId;
}

function kindOf(node: BusinessNode): string {
    return labelKo(node.label);
}

const REASON_LABELS: Record<CauseReason, string> = {
    bottleneck: '병목 후보',
    'agent-performance': '에이전트 성능',
    'system-dependency': '사용 시스템/서비스',
    'skill-dependency': '참조 스킬',
    'unresolved-role': '미해석 역할',
    'no-execution-link': '실행 연결 없음'
};

function reasonLabel(reason: CauseReason): string {
    return REASON_LABELS[reason];
}

const WARNING_TITLES: Record<TraceWarningKind, string> = {
    'strategy-execution-gap': '전략-실행 단절',
    'unknown-role': '미해석 역할',
    'cycle-detected': '순환 감지'
};

function warningTitle(kind: TraceWarningKind): string {
    return WARNING_TITLES[kind];
}

/** 전략 레이어 활성 여부 (FR-021) — 비활성이면 도달점 기준을 프로세스 정의로 낮춘다 */
const strategyEnabled = isLayerEnabled('strategy');

/** 순추적 도달점 — 전략 노드(활성 시) 또는 프로세스 정의(전략 비활성 시 최상위) */
const reachedTop = computed<BusinessNode[]>(() => {
    const t = props.trace;
    if (!t || t.mode !== 'contribution') return [];
    const list: BusinessNode[] = [];
    for (const id of t.nodeIds) {
        const node = props.nodeById.get(id);
        if (!node) continue;
        if (strategyEnabled ? node.layer === 'strategy' : node.label === 'ProcessDefinition') list.push(node);
    }
    return list.sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name, 'ko'));
});
</script>

<style scoped>
.itp-root {
    height: 100%;
    overflow-y: auto;
    padding: 14px;
    font-size: 13px;
    color: #1e293b;
}
.itp-empty {
    color: #94a3b8;
    padding: 30px 6px;
    line-height: 1.7;
}
.itp-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}
.itp-mode {
    font-weight: 700;
    font-size: 13px;
}
.itp-mode.down {
    color: #b45309;
}
.itp-mode.up {
    color: #15803d;
}
.itp-exit {
    border: 1px solid #e2e8f0;
    background: #fff;
    border-radius: 6px;
    font-size: 11px;
    padding: 3px 8px;
    cursor: pointer;
}
.itp-summary {
    color: #64748b;
    font-size: 12px;
    margin-bottom: 10px;
}
.itp-warning {
    border: 1px solid #fde68a;
    background: #fffbeb;
    color: #92400e;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    margin-bottom: 6px;
}
.itp-warning.strategy-execution-gap {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
}
.itp-section {
    border-top: 1px solid #f1f5f9;
    padding-top: 10px;
    margin-top: 8px;
}
.itp-sec-title {
    font-weight: 600;
    font-size: 12px;
    color: #64748b;
    margin-bottom: 6px;
}
.itp-cands {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
}
.itp-cand {
    width: 100%;
    text-align: left;
    border: 1px solid #f1f5f9;
    background: #fff;
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
}
.itp-cand:hover {
    border-color: #cbd5e1;
}
.itp-cand-name {
    font-weight: 600;
}
.itp-cand-reason {
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
}
.itp-cand-reason.bottleneck {
    background: #fef2f2;
    color: #b91c1c;
}
.itp-cand-reason.agent-performance,
.itp-cand-reason.system-dependency {
    background: #fff7ed;
    color: #c2410c;
}
.itp-cand-reason.skill-dependency,
.itp-cand-reason.contribution {
    background: #f0fdf4;
    color: #15803d;
}
.itp-cand-reason.unresolved-role,
.itp-cand-reason.no-execution-link {
    background: #fefce8;
    color: #a16207;
}
.itp-cand-metrics {
    color: #b45309;
    font-size: 11px;
    margin-left: auto;
}
.itp-cand-nometrics {
    color: #94a3b8;
    font-size: 11px;
    margin-left: auto;
}
.itp-link {
    border: none;
    background: none;
    color: #1d4ed8;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
}
.itp-dim {
    color: #94a3b8;
    font-size: 12px;
}
</style>
