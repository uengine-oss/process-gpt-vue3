<template>
    <div class="ai-console">
        <div v-if="!selectedNode && !activeInsight" class="console-empty">
            노드를 선택하면 상세 정보와 리스크 리포트가 표시됩니다.
        </div>

        <template v-else>
            <!-- (a) 선택 노드 상세 + 유형별 CQ 버튼줄 -->
            <section v-if="selectedNode" class="node-section">
                <div class="node-head">
                    <span class="node-kind">{{ typeLabel }}</span>
                    <span class="node-label">{{ nodeDisplayLabel }}</span>
                    <span class="node-type-raw">{{ selectedNode.type }}</span>
                </div>

                <div v-if="detailRows.length || degreeText" class="node-meta">
                    <span v-for="row in detailRows" :key="row.key" class="meta-item">
                        <span class="meta-key">{{ row.label }}</span>
                        <a v-if="row.isUrl" :href="row.value" target="_blank" rel="noopener" class="meta-val meta-link">{{
                            row.value
                        }}</a>
                        <span v-else class="meta-val">{{ row.value }}</span>
                    </span>
                    <span v-if="degreeText" class="meta-item">
                        <span class="meta-key">연결</span>
                        <span class="meta-val">{{ degreeText }}</span>
                    </span>
                </div>

                <div v-if="cqActions.length" class="cq-row">
                    <span class="cq-caption">CQ 질의</span>
                    <v-btn
                        v-for="action in cqActions"
                        :key="action.key"
                        size="x-small"
                        variant="tonal"
                        color="primary"
                        class="cq-btn"
                        @click="emit('run-cq', action.key)"
                    >
                        {{ action.label }}
                    </v-btn>
                </div>

                <!-- (1) 포커스 액션 줄 (FR-029, specs/002 T068) -->
                <div v-if="nodeContext" class="focus-actions">
                    <v-tooltip
                        v-if="!nodeContext.focus.canFocus && nodeContext.focus.disabledReason"
                        location="top"
                    >
                        <template #activator="{ props: tipProps }">
                            <span v-bind="tipProps" class="focus-btn-wrap">
                                <v-btn size="x-small" variant="tonal" color="primary" class="focus-btn" disabled>
                                    이 노드를 포커스로
                                </v-btn>
                            </span>
                        </template>
                        <span>{{ nodeContext.focus.disabledReason }}</span>
                    </v-tooltip>
                    <v-btn
                        v-else
                        size="x-small"
                        variant="tonal"
                        color="primary"
                        class="focus-btn"
                        :disabled="!nodeContext.focus.canFocus"
                        @click="emit('focus-node')"
                    >
                        이 노드를 포커스로
                    </v-btn>
                    <v-btn
                        v-if="nodeContext.focus.canAddToFocus"
                        size="x-small"
                        variant="text"
                        color="primary"
                        class="focus-btn"
                        @click="emit('add-to-focus')"
                    >
                        현재 포커스에 추가
                    </v-btn>
                    <v-btn
                        size="x-small"
                        variant="text"
                        color="primary"
                        class="focus-btn"
                        @click="emit('context-highlight')"
                    >
                        주변 하이라이트(Depth)
                    </v-btn>
                </div>

                <!-- (2) Process 요약 카드 (FR-029) -->
                <div v-if="nodeContext && nodeContext.processSummary" class="context-card">
                    <div class="context-caption">프로세스 요약</div>
                    <div v-if="summaryCountEntries.length" class="summary-grid">
                        <div v-for="[key, count] in summaryCountEntries" :key="key" class="summary-cell">
                            <span class="summary-value">{{ count.toLocaleString('ko-KR') }}</span>
                            <span class="summary-key">{{ key }}</span>
                        </div>
                    </div>
                    <div v-for="group in summaryListGroups" :key="group.key" class="summary-list-block">
                        <div class="summary-list-caption">{{ group.key }}</div>
                        <ul class="context-list">
                            <li v-for="(item, i) in group.items" :key="i">{{ item }}</li>
                            <li v-if="group.moreCount > 0" class="more-note">외 {{ group.moreCount }}개</li>
                        </ul>
                    </div>
                </div>

                <!-- (3) CallActivity 드릴다운 카드 (FR-029) -->
                <div v-if="nodeContext && nodeContext.callActivity" class="context-card">
                    <div class="context-caption">콜 액티비티</div>
                    <div class="ca-row">
                        <span class="ca-key">부모 프로세스</span>
                        <span class="ca-val">{{ nodeContext.callActivity.parentProcessLabel ?? '—' }}</span>
                        <v-btn
                            v-if="nodeContext.callActivity.parentFocusNodeId"
                            size="x-small"
                            variant="text"
                            color="primary"
                            class="focus-btn"
                            @click="emitFocusEntity(nodeContext.callActivity.parentFocusNodeId)"
                        >
                            부모 포커스
                        </v-btn>
                    </div>
                    <div class="ca-row ca-row--top">
                        <span class="ca-key">Invokes</span>
                        <div class="ca-invokes">
                            <template v-if="nodeContext.callActivity.invokes.length">
                                <div
                                    v-for="(invoke, i) in nodeContext.callActivity.invokes"
                                    :key="i"
                                    class="ca-invoke-row"
                                >
                                    <span class="ca-val">{{ invoke.label }}</span>
                                    <v-btn
                                        v-if="invoke.focusNodeId"
                                        size="x-small"
                                        variant="text"
                                        color="primary"
                                        class="focus-btn"
                                        @click="emitFocusEntity(invoke.focusNodeId)"
                                    >
                                        자식 포커스
                                    </v-btn>
                                </div>
                            </template>
                            <span v-else class="ca-val ca-val--muted">—</span>
                        </div>
                    </div>
                    <div class="ca-row">
                        <span class="ca-key">정의 ID</span>
                        <span class="ca-val mono">{{ nodeContext.callActivity.definitionId ?? '—' }}</span>
                    </div>
                </div>

                <!-- (4) 관련 엣지 수신/발신 (각 최대 10개, FR-029) -->
                <div v-if="nodeContext" class="context-card">
                    <div class="context-caption">관련 엣지</div>
                    <div class="edge-group">
                        <div class="edge-group-head">수신 ({{ nodeContext.incomingTotal }})</div>
                        <ul class="context-list">
                            <li v-for="(edge, i) in nodeContext.incoming" :key="i" class="edge-row">
                                <span class="mono edge-type">{{ edge.type }}</span>
                                <span v-if="edge.derived" class="edge-derived">(파생)</span>
                                <span class="edge-counterpart">{{ edge.counterpartLabel }}</span>
                                <span v-if="edge.activityCount != null" class="edge-count">
                                    · 활동 {{ edge.activityCount }}개
                                </span>
                            </li>
                            <li v-if="nodeContext.incoming.length === 0" class="more-note">없음</li>
                            <li v-else-if="incomingMore > 0" class="more-note">외 {{ incomingMore }}개</li>
                        </ul>
                    </div>
                    <div class="edge-group">
                        <div class="edge-group-head">발신 ({{ nodeContext.outgoingTotal }})</div>
                        <ul class="context-list">
                            <li v-for="(edge, i) in nodeContext.outgoing" :key="i" class="edge-row">
                                <span class="mono edge-type">{{ edge.type }}</span>
                                <span v-if="edge.derived" class="edge-derived">(파생)</span>
                                <span class="edge-counterpart">{{ edge.counterpartLabel }}</span>
                                <span v-if="edge.activityCount != null" class="edge-count">
                                    · 활동 {{ edge.activityCount }}개
                                </span>
                            </li>
                            <li v-if="nodeContext.outgoing.length === 0" class="more-note">없음</li>
                            <li v-else-if="outgoingMore > 0" class="more-note">외 {{ outgoingMore }}개</li>
                        </ul>
                    </div>
                </div>

                <!-- (5) 접이식 원본 properties (FR-029) -->
                <div v-if="nodeContext" class="raw-props-block">
                    <button type="button" class="details-toggle" @click="rawPropsOpen = !rawPropsOpen">
                        {{ rawPropsOpen ? '원본 properties 접기 ▴' : '원본 properties 펼치기 ▾' }}
                    </button>
                    <pre v-if="rawPropsOpen" class="raw-props">{{ nodeContext.rawPropertiesJson }}</pre>
                </div>
            </section>

            <!-- (b) 활성 인사이트 카드(근거 보기 / AI 해설 pass-through) -->
            <section v-if="activeInsight" class="insight-section">
                <InsightCardView
                    :card="activeInsight"
                    :narrative="narrative"
                    :narrative-loading="narrativeLoading"
                    :narrative-error="narrativeError"
                    :evidence-active="evidenceActive"
                    :workflow-status="workflowStatus"
                    :rank="rank"
                    @show-evidence="emit('show-evidence', $event)"
                    @request-narrative="emit('request-narrative', $event)"
                    @update-status="emit('update-status', $event)"
                    @create-task="emit('create-task', $event)"
                />
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { GraphNode, NodeType } from '@/lib/processKg/graph/types';
import type { InsightCard } from '@/lib/processKg/analysis/types';
import InsightCardView from '@/components/ontology-explorer/InsightCardView.vue';

/** 인사이트 검토 워크플로 상태(6종) — data-model.md §3.1(FR-026)과 동일한 리터럴. */
export type InsightWorkflowStatus = 'new' | 'reviewed' | 'accepted' | 'rejected' | 'needs_data' | 'action_created';

/** 관련 엣지 1행 — Wire(useOntologyGraph)에서 상대 노드 라벨까지 해석해 주입. */
export interface NodeContextEdge {
    type: string;
    counterpartLabel: string;
    derived: boolean;
    activityCount?: number;
}

/**
 * 선택 노드 상세 컨텍스트(FR-029, specs/002 T068).
 * useOntologyGraph(Wire 에이전트)가 그래프에서 계산해 주입하는 표시 전용 데이터.
 */
export interface NodeContext {
    /** 수신/발신 엣지 목록 — 각 최대 10개(초과분은 *Total과의 차로 '외 N개' 표시). */
    incoming: NodeContextEdge[];
    outgoing: NodeContextEdge[];
    incomingTotal: number;
    outgoingTotal: number;
    /** Process 노드일 때 요약(카운트 그리드 + 항목별 대표 목록 최대 8개). 그 외 null. */
    processSummary: { counts: Record<string, number>; lists: Record<string, string[]> } | null;
    /** CallActivity 노드일 때 부모/자식 드릴다운 정보. 그 외 null. */
    callActivity: {
        parentProcessLabel: string | null;
        parentFocusNodeId: string | null;
        invokes: Array<{ label: string; focusNodeId: string | null }>;
        definitionId: string | null;
    } | null;
    /** 원본 properties의 pretty-print JSON. */
    rawPropertiesJson: string;
    /** 포커스 액션 가능 여부(Annotation 등 제외 사유 포함). */
    focus: { canFocus: boolean; canAddToFocus: boolean; disabledReason?: string };
}

const props = withDefaults(
    defineProps<{
        selectedNode: GraphNode | null;
        cqActions: Array<{ key: string; label: string }>;
        activeInsight: InsightCard | null;
        nodeContext?: NodeContext | null;
        narrative?: string | null;
        narrativeLoading?: boolean;
        narrativeError?: string | null;
        evidenceActive?: boolean;
        /** 활성 인사이트의 검토 상태 — InsightCardView로 그대로 전달(FR-026). */
        workflowStatus?: InsightWorkflowStatus;
        /** 활성 인사이트의 목록 내 순위(#n) — InsightCardView로 그대로 전달. */
        rank?: number | null;
    }>(),
    {
        nodeContext: null,
        narrative: null,
        narrativeLoading: false,
        narrativeError: null,
        evidenceActive: false,
        workflowStatus: undefined,
        rank: null,
    },
);

const emit = defineEmits<{
    (e: 'run-cq', key: string): void;
    (e: 'show-evidence', card: InsightCard): void;
    (e: 'request-narrative', card: InsightCard): void;
    (e: 'focus-node'): void;
    (e: 'add-to-focus'): void;
    (e: 'context-highlight'): void;
    (e: 'focus-entity', nodeId: string): void;
    (e: 'update-status', payload: { card: InsightCard; status: string }): void;
    (e: 'create-task', card: InsightCard): void;
}>();

/** canonical NodeType 전수(18종+ProcessElement)의 한국어 라벨. */
const NODE_TYPE_LABELS: Record<NodeType, string> = {
    ProcessModel: '프로세스 모델',
    Process: '프로세스',
    Participant: '참여자(풀)',
    Lane: '레인',
    Organization: '조직',
    Supplier: '공급업체',
    ProcessElement: '프로세스 요소',
    ProcessActivity: '활동',
    Gateway: '게이트웨이',
    Event: '이벤트',
    SequenceFlow: '시퀀스 플로우',
    System: '시스템',
    DataStore: '데이터 저장소',
    DataObject: '데이터 객체',
    Manual: '매뉴얼',
    Annotation: '주석',
    FTEProfile: 'FTE 프로파일',
    CostProfile: '비용 프로파일',
    Project: '프로젝트',
};

/** 유형별 핵심 properties 노출 스펙(값이 있을 때만 렌더). */
const PROPERTY_SPECS: Partial<Record<NodeType, Array<{ key: string; label: string }>>> = {
    ProcessModel: [
        { key: 'displayName', label: '표시명' },
        { key: 'processCode', label: '프로세스 코드' },
    ],
    Process: [
        { key: 'displayName', label: '표시명' },
        { key: 'processCode', label: '프로세스 코드' },
    ],
    Organization: [
        { key: 'organizationId', label: '조직 ID' },
        { key: 'memberCount', label: '인원수' },
        { key: 'organizationType', label: '조직 유형' },
    ],
    Supplier: [
        { key: 'organizationId', label: '공급업체 ID' },
        { key: 'businessNumber', label: '사업자번호' },
    ],
    System: [
        { key: 'systemId', label: '시스템 ID' },
        { key: 'category', label: '분류' },
    ],
    ProcessActivity: [
        { key: 'activityKind', label: '활동 유형' },
        { key: 'bpmnType', label: 'BPMN 타입' },
        { key: 'futureStatus', label: '전환 상태' },
    ],
    Lane: [{ key: 'laneResourceType', label: '레인 자원 유형' }],
    Gateway: [
        { key: 'gatewayType', label: '게이트웨이 유형' },
        { key: 'bpmnType', label: 'BPMN 타입' },
    ],
    Event: [
        { key: 'eventType', label: '이벤트 유형' },
        { key: 'bpmnType', label: 'BPMN 타입' },
    ],
    DataStore: [{ key: 'dataStoreType', label: '저장소 유형' }],
    DataObject: [{ key: 'dataObjectType', label: '객체 유형' }],
    Manual: [
        { key: 'url', label: 'URL' },
        { key: 'source', label: '출처' },
    ],
    Project: [
        { key: 'projectType', label: '프로젝트 유형' },
        { key: 'url', label: 'URL' },
    ],
};

interface DetailRow {
    key: string;
    label: string;
    value: string;
    isUrl: boolean;
}

const typeLabel = computed(() =>
    props.selectedNode ? (NODE_TYPE_LABELS[props.selectedNode.type] ?? props.selectedNode.type) : '',
);

const nodeDisplayLabel = computed(() => {
    const node = props.selectedNode;
    if (!node) return '';
    const displayName = node.properties.displayName;
    if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
    return node.label.trim() || node.id;
});

function stringifyProperty(raw: unknown): string {
    if (typeof raw === 'string') return raw.trim();
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    return '';
}

const detailRows = computed<DetailRow[]>(() => {
    const node = props.selectedNode;
    if (!node) return [];
    const rows: DetailRow[] = [];
    for (const spec of PROPERTY_SPECS[node.type] ?? []) {
        const value = stringifyProperty(node.properties[spec.key]);
        if (!value) continue;
        rows.push({
            key: spec.key,
            label: spec.label,
            value,
            isUrl: spec.key === 'url' || /^https?:\/\//i.test(value),
        });
    }
    return rows;
});

function readDegree(key: 'inDegree' | 'outDegree'): number | null {
    const raw = props.selectedNode?.properties[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
    return null;
}

const degreeText = computed(() => {
    const inDegree = readDegree('inDegree');
    const outDegree = readDegree('outDegree');
    if (inDegree == null && outDegree == null) return '';
    return `in ${inDegree ?? '-'} / out ${outDegree ?? '-'}`;
});

/* ── 노드 컨텍스트(FR-029) ───────────────────────────────── */

const summaryCountEntries = computed<Array<[string, number]>>(() =>
    Object.entries(props.nodeContext?.processSummary?.counts ?? {}),
);

interface SummaryListGroup {
    key: string;
    items: string[];
    moreCount: number;
}

/** processSummary.lists → 항목별 대표 목록(최대 8) + counts 대비 초과분 '외 N개'. */
const summaryListGroups = computed<SummaryListGroup[]>(() => {
    const summary = props.nodeContext?.processSummary;
    if (!summary) return [];
    const groups: SummaryListGroup[] = [];
    for (const [key, values] of Object.entries(summary.lists)) {
        if (!Array.isArray(values) || values.length === 0) continue;
        const items = values.slice(0, 8);
        const total = summary.counts[key];
        const moreCount = Math.max(
            (typeof total === 'number' && Number.isFinite(total) ? total : values.length) - items.length,
            0,
        );
        groups.push({ key, items, moreCount });
    }
    return groups;
});

const incomingMore = computed(() => {
    const ctx = props.nodeContext;
    if (!ctx) return 0;
    return Math.max(ctx.incomingTotal - ctx.incoming.length, 0);
});

const outgoingMore = computed(() => {
    const ctx = props.nodeContext;
    if (!ctx) return 0;
    return Math.max(ctx.outgoingTotal - ctx.outgoing.length, 0);
});

function emitFocusEntity(nodeId: string | null): void {
    if (nodeId) emit('focus-entity', nodeId);
}

/** 접이식 '원본 properties' — 노드가 바뀌면 접힌 상태로 초기화. */
const rawPropsOpen = ref(false);

watch(
    () => props.selectedNode?.id,
    () => {
        rawPropsOpen.value = false;
    },
);
</script>

<style scoped>
.ai-console {
    height: 100%;
    overflow-y: auto;
    padding: 12px 16px;
    color: #1f2533;
    background: #ffffff;
}
.console-empty {
    opacity: 0.6;
    font-size: 13px;
}
.node-section {
    margin-bottom: 10px;
}
.node-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}
.node-kind {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #e5f3fb;
    color: #0085db;
    white-space: nowrap;
}
.node-label {
    font-weight: 600;
}
.node-type-raw {
    font-size: 11px;
    color: #8a93a6;
    font-family: 'JetBrains Mono', monospace;
}
.node-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 12px;
    margin-bottom: 10px;
}
.meta-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
}
.meta-key {
    color: #8a93a6;
    white-space: nowrap;
}
.meta-val {
    color: #1f2533;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 260px;
}
.meta-link {
    color: #0085db;
}
.cq-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid #f0f2f8;
}
.cq-caption {
    font-size: 11px;
    font-weight: 700;
    color: #5a6478;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-right: 4px;
}
.cq-btn {
    text-transform: none;
    letter-spacing: 0;
}
.insight-section {
    border-top: 1px solid #e7eaf3;
    padding-top: 10px;
}

/* ── 노드 컨텍스트(FR-029) ─────────────────────────────── */
.focus-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
}
.focus-btn {
    text-transform: none;
    letter-spacing: 0;
}
.focus-btn-wrap {
    display: inline-flex;
}
.context-card {
    margin-top: 10px;
    border: 1px solid #e7eaf3;
    border-radius: 8px;
    padding: 10px 12px;
}
.context-caption {
    font-size: 11px;
    font-weight: 700;
    color: #5a6478;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
}
.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 6px;
    margin-bottom: 8px;
}
.summary-cell {
    display: flex;
    flex-direction: column;
    background: #f4f6fb;
    border-radius: 6px;
    padding: 5px 8px;
    min-width: 0;
}
.summary-value {
    font-size: 14px;
    font-weight: 700;
    color: #1f2533;
}
.summary-key {
    font-size: 10px;
    color: #8a93a6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.summary-list-block {
    margin-top: 6px;
}
.summary-list-caption {
    font-size: 11px;
    font-weight: 600;
    color: #5a6478;
    margin-bottom: 2px;
}
.context-list {
    margin: 0;
    padding-left: 16px;
    font-size: 12px;
    color: #1f2533;
}
.context-list li {
    margin-bottom: 2px;
}
.more-note {
    color: #8a93a6;
    list-style: none;
    margin-left: -16px;
}
.ca-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
    padding: 2px 0;
}
.ca-row--top {
    align-items: flex-start;
}
.ca-key {
    flex: 0 0 auto;
    color: #8a93a6;
    white-space: nowrap;
    min-width: 84px;
}
.ca-val {
    color: #1f2533;
    word-break: break-all;
}
.ca-val--muted {
    color: #8a93a6;
}
.ca-invokes {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.ca-invoke-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
}
.mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
}
.edge-group {
    margin-bottom: 8px;
}
.edge-group:last-child {
    margin-bottom: 0;
}
.edge-group-head {
    font-size: 12px;
    font-weight: 600;
    color: #5a6478;
    margin-bottom: 4px;
}
.edge-row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
}
.edge-type {
    color: #0085db;
}
.edge-derived {
    font-size: 11px;
    color: #b25b12;
}
.edge-counterpart {
    color: #1f2533;
    word-break: break-all;
}
.edge-count {
    font-size: 11px;
    color: #8a93a6;
}
.raw-props-block {
    margin-top: 10px;
}
.details-toggle {
    border: none;
    background: none;
    color: #0085db;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
}
.raw-props {
    margin: 6px 0 0;
    padding: 8px 10px;
    background: #f4f6fb;
    border: 1px solid #e7eaf3;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: #1f2533;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 260px;
    overflow: auto;
}
</style>
