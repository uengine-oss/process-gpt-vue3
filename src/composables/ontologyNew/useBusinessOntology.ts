/**
 * useBusinessOntology — Ontology Explorer New 화면 상태·로드·가시성 파이프라인
 * (specs/005 data-model.md §7, contracts/explorer-new-ui.contract.md).
 *
 * 흐름: mount → loadHealth → (ready 면) loadBusinessGraph + loadExecutionRollup 병렬.
 * 가시성 파이프라인 순서 고정: trace 배타 하이라이트 → 레이어 토글 → 검색 → 렌더 가드.
 */
import { computed, reactive, ref, shallowRef } from 'vue';

import { loadBusinessGraph, loadExecutionRollup, loadHealth } from '@/services/ontologyAgeGraphService';

import { ENABLED_LAYERS, allLayersEnabled, isLayerEnabled } from './config';
import { deriveEmptyLayers, deriveHealthState } from './health';
import { availableTraceMode, computeImpactTrace } from './impactTrace';
import type { EdgeStyleClass } from './layerMapping';
import { LABEL_LAYER } from './layerMapping';
import { ALL_EDGE_GROUPS, applyTypeFilters, countByLabel } from './typeFilters';
import { buildActivityRollupMap, buildKpiStatusRecord, buildKpiSurveyMap, buildRunningCountMap } from './rollup';
import type {
    BusinessEdge,
    BusinessLayer,
    BusinessNode,
    BusinessOntologyGraph,
    ExecutionRollup,
    GraphHealth,
    HealthState,
    ImpactTrace,
    RenderBlocked,
    TraceMode
} from './types';
import { MAX_VISIBLE_NODES } from './types';

export function useBusinessOntology() {
    /* ── 핵심 상태 ── */
    const health = ref<GraphHealth | null>(null);
    const graph = shallowRef<BusinessOntologyGraph | null>(null);
    const rollup = shallowRef<ExecutionRollup | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const visibleLayers = reactive<Set<BusinessLayer>>(new Set(ENABLED_LAYERS));
    const searchTerm = ref('');
    const selectedNodeId = ref<string | null>(null);
    const trace = shallowRef<ImpactTrace | null>(null);

    /* ── 유형 필터 (라벨·엣지 그룹 — 레이어 토글보다 세밀한 단계) ── */
    const enabledLabels = Object.keys(LABEL_LAYER).filter((l) => isLayerEnabled(LABEL_LAYER[l]));
    const visibleLabels = reactive<Set<string>>(new Set(enabledLabels));
    const visibleEdgeGroups = reactive<Set<EdgeStyleClass>>(new Set(ALL_EDGE_GROUPS));

    /* ── 헬스 파생 (US5) ── */
    const healthState = computed<HealthState>(() =>
        error.value ? 'error' : loading.value && !health.value ? 'loading' : deriveHealthState(health.value)
    );
    const emptyLayers = computed<BusinessLayer[]>(() => deriveEmptyLayers(health.value, ENABLED_LAYERS));

    /* ── 조회 인덱스 ── */
    const nodeById = computed(() => new Map((graph.value?.nodes ?? []).map((n) => [n.id, n] as const)));
    const selectedNode = computed<BusinessNode | null>(() =>
        selectedNodeId.value ? nodeById.value.get(selectedNodeId.value) ?? null : null
    );

    /* ── 실행 집계 파생 (US2) ── */
    const kpiStatusRecord = computed(() => buildKpiStatusRecord(graph.value?.nodes ?? []));
    const activityRollupMap = computed(() => buildActivityRollupMap(graph.value?.nodes ?? [], rollup.value));
    const runningCountMap = computed(() => buildRunningCountMap(graph.value?.nodes ?? [], rollup.value));
    const kpiSurveyMap = computed(() => buildKpiSurveyMap(graph.value?.nodes ?? [], rollup.value));

    /* ── 가시성 파이프라인 (data-model.md §7 순서) ── */
    const visible = computed<{ nodes: BusinessNode[]; edges: BusinessEdge[]; blocked: RenderBlocked }>(() => {
        const g = graph.value;
        if (!g) return { nodes: [], edges: [], blocked: { blocked: false } };

        let nodes = g.nodes;
        let edges = g.edges;

        // 1) trace 배타 — 경로 서브그래프만 (밖은 캔버스가 fade 처리하도록 전체 유지 + 판정 맵 제공)
        //    (노드 제거가 아니라 fade — 문맥 유지를 위해 노드는 남긴다, ui.contract)

        // 2) 레이어 토글 (비활성 레이어는 서버에서 이미 제외 — FR-021)
        if (visibleLayers.size < ENABLED_LAYERS.length) {
            nodes = nodes.filter((n) => visibleLayers.has(n.layer));
        }

        // 3) 검색 (이름/라벨 부분 일치 — 대소문자 무시)
        const term = searchTerm.value.trim().toLowerCase();
        if (term) {
            nodes = nodes.filter((n) => n.name.toLowerCase().includes(term) || n.label.toLowerCase().includes(term));
        }

        const ids = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));

        // 3b) 유형 필터 — 라벨·엣지 그룹 (typeFilters.ts)
        if (visibleLabels.size < enabledLabels.length || visibleEdgeGroups.size < ALL_EDGE_GROUPS.length) {
            const filtered = applyTypeFilters(nodes, edges, visibleLabels, visibleEdgeGroups);
            nodes = filtered.nodes;
            edges = filtered.edges;
        }

        // 4) 렌더 가드 (FR-017)
        if (nodes.length > MAX_VISIBLE_NODES) {
            return {
                nodes: [],
                edges: [],
                blocked: { blocked: true, visibleCount: nodes.length }
            };
        }
        return { nodes, edges, blocked: { blocked: false, visibleCount: nodes.length } };
    });

    /** trace 활성 시 노드별 하이라이트/페이드 판정 (캔버스 opacity 맵) */
    const traceVisibility = computed<Record<string, boolean>>(() => {
        const t = trace.value;
        if (!t) return {};
        const record: Record<string, boolean> = {};
        for (const n of graph.value?.nodes ?? []) record[n.id] = t.nodeIds.has(n.id);
        return record;
    });

    /* ── 로드 ── */
    async function load() {
        loading.value = true;
        error.value = null;
        try {
            health.value = await loadHealth();
            if (!health.value.installed || !health.value.compatible) {
                graph.value = null; // V4 — 불호환/미설치는 그래프 로드 스킵(렌더 중단)
                return;
            }
            const [g, r] = await Promise.all([
                // 비활성 레이어는 서버에서 제외(p_layers) — 전 레이어 활성이면 생략(기본 전체)
                loadBusinessGraph(allLayersEnabled() ? undefined : ENABLED_LAYERS),
                loadExecutionRollup().catch((e) => {
                    // 집계 실패는 '집계 없음' 강등 (FR-010) — 페이지는 동작
                    console.warn('[ontology-new] 실행 집계 로드 실패 — 집계 없음으로 강등:', e);
                    return null;
                })
            ]);
            graph.value = g;
            rollup.value = r;
        } catch (e: any) {
            error.value = e?.message ?? String(e);
        } finally {
            loading.value = false;
        }
    }

    /* ── 선택/토글/검색 ── */
    function selectNode(nodeId: string | null) {
        selectedNodeId.value = nodeId;
    }

    function clearSelection() {
        selectedNodeId.value = null;
    }

    /* ── 유형 필터 액션 ── */
    const labelCounts = computed<Record<string, number>>(() => countByLabel(graph.value?.nodes ?? []));
    const typeFilterActive = computed(() => visibleLabels.size < enabledLabels.length || visibleEdgeGroups.size < ALL_EDGE_GROUPS.length);

    function toggleLabel(label: string) {
        if (visibleLabels.has(label)) visibleLabels.delete(label);
        else visibleLabels.add(label);
    }

    function toggleEdgeGroup(group: EdgeStyleClass) {
        if (visibleEdgeGroups.has(group)) visibleEdgeGroups.delete(group);
        else visibleEdgeGroups.add(group);
    }

    function resetTypeFilters() {
        visibleLabels.clear();
        for (const l of enabledLabels) visibleLabels.add(l);
        visibleEdgeGroups.clear();
        for (const g of ALL_EDGE_GROUPS) visibleEdgeGroups.add(g);
    }

    function toggleLayer(layer: BusinessLayer) {
        if (!isLayerEnabled(layer)) return; // 비활성 레이어는 토글 대상 아님 (FR-021)
        if (visibleLayers.has(layer)) {
            if (visibleLayers.size <= 1) return; // 최소 1개 레이어 유지
            visibleLayers.delete(layer);
        } else {
            visibleLayers.add(layer);
        }
    }

    /* ── 역추적/순추적 (US3/US4) ── */
    function traceModeFor(nodeId: string): TraceMode | null {
        const node = nodeById.value.get(nodeId);
        return node ? availableTraceMode(node) : null;
    }

    function startTrace(nodeId: string, mode: TraceMode): boolean {
        const g = graph.value;
        if (!g || !nodeById.value.has(nodeId)) return false;
        trace.value = computeImpactTrace(g, nodeId, mode, activityRollupMap.value);
        selectedNodeId.value = nodeId;
        return true;
    }

    function exitTrace() {
        trace.value = null;
    }

    return {
        // 상태
        health,
        healthState,
        emptyLayers,
        graph,
        rollup,
        loading,
        error,
        visibleLayers,
        visibleLabels,
        visibleEdgeGroups,
        labelCounts,
        typeFilterActive,
        searchTerm,
        selectedNodeId,
        selectedNode,
        trace,
        // 파생
        visible,
        traceVisibility,
        kpiStatusRecord,
        activityRollupMap,
        runningCountMap,
        kpiSurveyMap,
        nodeById,
        // 액션
        load,
        selectNode,
        clearSelection,
        toggleLayer,
        toggleLabel,
        toggleEdgeGroup,
        resetTypeFilters,
        traceModeFor,
        startTrace,
        exitTrace
    };
}
