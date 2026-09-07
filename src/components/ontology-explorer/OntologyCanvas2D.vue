<template>
    <div class="ontology-canvas-root">
        <div v-show="!renderBlocked.blocked" ref="canvasEl" class="ontology-canvas"></div>

        <!-- Depth·포커스 컨트롤 (FR-016 유지) -->
        <div v-if="showOverlays" class="canvas-controls">
            <div class="controls-row">
                <span class="depth-label">Depth {{ depth }}</span>
                <button v-if="focusNodeId" class="clear-btn" title="선택/포커스 해제 (ESC)" @click="emit('background-click')">
                    해제 ✕
                </button>
            </div>
            <input type="range" min="0" max="6" step="1" :value="depth" class="depth-slider" @input="onSliderInput" />
            <div v-if="focusNodeId" class="focus-hint">focus: {{ focusLabel }} · 휠로 Depth · 배경 클릭/ESC 해제</div>
        </div>

        <!-- 근거(evidence) 모드 배지 -->
        <div v-if="showOverlays && evidenceActive" class="evidence-chip">EVIDENCE</div>

        <!-- 표시 중 타입 자동 범례 -->
        <div v-if="showOverlays && legendEntries.length" class="canvas-legend">
            <div v-for="entry in legendEntries" :key="entry.type" class="legend-row">
                <span class="legend-chip" :style="{ background: entry.color }"></span>
                <span class="legend-label">{{ entry.label }}</span>
                <span class="legend-count">{{ entry.count }}</span>
            </div>
        </div>

        <!-- 렌더 가드: 대규모 그래프는 직접 렌더 대신 분석 우선 안내 (R11) -->
        <div v-if="renderBlocked.blocked" class="canvas-blocked">
            <div class="canvas-blocked__icon">◉</div>
            <div class="canvas-blocked__title">분석 우선: 대규모 그래프는 엔터티 포커스 또는 인사이트 근거로 탐색하세요</div>
            <div class="canvas-blocked__meta">
                <span v-if="renderBlocked.visibleCount != null">가시 노드 {{ renderBlocked.visibleCount.toLocaleString() }}개</span>
                <span v-if="renderBlocked.reason" class="canvas-blocked__reason">{{ renderBlocked.reason }}</span>
            </div>
            <button class="focus-open-btn" @click="emit('open-focus-panel')">포커스 열기</button>
        </div>
        <div v-else-if="loadError" class="canvas-error">
            2D 그래프 렌더러(cytoscape)를 초기화하지 못했습니다.
            <div class="canvas-error-detail">{{ loadError }}</div>
        </div>
        <div v-else-if="!nodes.length" class="canvas-empty">
            <div class="canvas-empty__icon">◈</div>
            <div class="canvas-empty__title">표시할 온톨로지 노드가 없습니다</div>
            <div class="canvas-empty__hint">BPMN 프로세스 모델이 등록되면 프로세스·조직·시스템 그래프가 여기에 표시됩니다.</div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * OntologyCanvas2D — SAMPLE bpmn-process-kg `src/web/components/GraphCanvas.tsx` 파리티의
 * Cytoscape 2D 캔버스. OntologyCanvas3D 와 동일한 props/emits 계약을 유지해 뷰에서
 * 임포트/태그 교체만으로 전환된다(Apache AGE 연동 대비 기준 렌더).
 *
 *  - 레이아웃/줌/스타일시트: SAMPLE GraphCanvas 그대로(cose↔breadthfirst 800 기준,
 *    minZoom 0.1 / maxZoom 3, 노드 위 라벨, 타입별 색, CallActivity teal round-rectangle,
 *    derived/aggregated/invokesSubprocess/callsProcessModel 엣지 스타일)
 *  - DEST 확장(risk/selected/visibility fade/evidence)은 클래스 토글로만 반영 — 레이아웃 재실행 없음
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import cytoscape, { type Core, type ElementDefinition, type LayoutOptions, type StylesheetJson } from 'cytoscape';
import type { GraphEdge, GraphNode, NodeType } from '@/lib/processKg/graph/types';
import { colorForNodeType, labelForNodeType, NODE_TYPE_COLORS } from '@/composables/ontology/nodeTypeColors';
import { getActivityUiSubtype } from '@/composables/ontology/viewModes';

const props = defineProps<{
    /** 렌더 대상(이미 소스/뷰모드/필터 파이프라인 적용된 집합) */
    nodes: GraphNode[];
    edges: GraphEdge[];
    /** focus+Depth fade 맵(노드 id 기준) */
    visibility: Record<string, { visible: boolean; opacity: number }>;
    /** 강조 대상(위험 노드) */
    riskNodeIds: Record<string, 'SPOF' | 'StructuralDefect'>;
    /** 근거 모드: 링크/노드 강조 스타일 */
    evidenceActive: boolean;
    /** 렌더 가드 판정 결과 — blocked 시 캔버스 대신 안내 카드 */
    renderBlocked: { blocked: boolean; reason?: string; visibleCount?: number };
    depth: number;
    focusNodeId: string | null;
    selectedNodeId: string | null;
}>();

const emit = defineEmits<{
    (e: 'node-click', nodeId: string): void;
    (e: 'background-click'): void;
    (e: 'focus', nodeId: string): void;
    (e: 'set-depth', n: number): void;
    (e: 'open-focus-panel'): void;
}>();

/** SAMPLE NODE_COLORS.CallActivity — DEST 팔레트에 없는 서브타입 전용 teal. */
const CALL_ACTIVITY_COLOR = '#0d9488';
const CALL_ACTIVITY_BORDER = '#115e59';

const canvasEl = ref<HTMLElement | null>(null);
const loadError = ref<string | null>(null);
const focusLabel = ref('');

let cy: Core | null = null;
let resizeObserver: ResizeObserver | null = null;

const showOverlays = computed(() => !props.renderBlocked.blocked && !loadError.value && props.nodes.length > 0);

/** 표시 중 타입만 자동 범례 생성(개수 내림차순). */
const legendEntries = computed(() => {
    const counts = new Map<NodeType, number>();
    for (const n of props.nodes) counts.set(n.type, (counts.get(n.type) || 0) + 1);
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count, color: colorForNodeType(type), label: labelForNodeType(type) }));
});

function isVisible(nodeId: string): boolean {
    return props.visibility[nodeId]?.visible ?? true;
}

// ---------------------------------------------------------------------------
// 라벨 (SAMPLE src/web/utils/{nodeLabel,activitySubtype}.ts 캔버스 라벨 인라인)
// ---------------------------------------------------------------------------

function propertyString(properties: Record<string, unknown>, key: string): string | undefined {
    const value = properties[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function displayLabel(node: GraphNode): string {
    const displayName = propertyString(node.properties, 'displayName');
    if (displayName) return displayName;
    if (node.type === 'Participant') {
        const name = propertyString(node.properties, 'name');
        if (name) return `Pool: ${name}`;
    }
    if (node.label.trim()) return node.label.trim();
    const name = propertyString(node.properties, 'name');
    if (name) return name;
    return node.id;
}

function canvasLabel(node: GraphNode): string {
    const label = displayLabel(node);
    if (getActivityUiSubtype(node) === 'CallActivity') {
        return label.startsWith('[CALL]') ? label : `[CALL] ${label}`;
    }
    if (node.type === 'DataStore') {
        return label.startsWith('[STORE]') ? label : `[STORE] ${label}`;
    }
    if (node.type === 'DataObject') {
        return label.startsWith('[DATA]') ? label : `[DATA] ${label}`;
    }
    return label;
}

// ---------------------------------------------------------------------------
// elements / stylesheet / layout (SAMPLE GraphCanvas 파리티)
// ---------------------------------------------------------------------------

function buildElements(): ElementDefinition[] {
    const ids = new Set(props.nodes.map((n) => n.id));
    const nodes: ElementDefinition[] = props.nodes.map((node) => ({
        data: {
            id: node.id,
            label: canvasLabel(node),
            nodeType: node.type,
            activitySubtype: getActivityUiSubtype(node) ?? ''
        }
    }));
    // self-loop 은 샘플처럼 유지. 렌더 집합 밖 끝점을 가진 엣지만 제외(cytoscape 는 미존재 끝점에서 예외 발생).
    const edges: ElementDefinition[] = props.edges
        .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
        .map((edge) => ({
            data: {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.properties?.aggregated
                    ? String(edge.properties.roleLabel ?? 'data')
                    : edge.properties?.derived
                    ? `${edge.type}*`
                    : edge.type,
                edgeType: edge.type,
                derived: edge.properties?.derived === true,
                aggregated: edge.properties?.aggregated === true
            }
        }));
    return [...nodes, ...edges];
}

function buildStylesheet(): StylesheetJson {
    return [
        {
            selector: 'node',
            style: {
                label: 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '10px',
                'text-wrap': 'wrap',
                'text-max-width': '120px',
                color: '#111827',
                'background-color': '#94a3b8',
                width: '36px',
                height: '36px',
                'border-width': 1,
                'border-color': '#e2e8f0'
            }
        },
        {
            selector: 'node[activitySubtype = "CallActivity"]',
            style: {
                'background-color': CALL_ACTIVITY_COLOR,
                'border-width': 3,
                'border-color': CALL_ACTIVITY_BORDER,
                shape: 'round-rectangle',
                width: 'label',
                height: 'label',
                padding: '10px'
            }
        },
        {
            selector: 'node[nodeType = "ProcessActivity"][activitySubtype != "CallActivity"]',
            style: {
                'background-color': NODE_TYPE_COLORS.ProcessActivity
            }
        },
        {
            selector: 'edge',
            style: {
                width: 1,
                'line-color': '#cbd5e1',
                'target-arrow-color': '#cbd5e1',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                opacity: 0.7
            }
        },
        {
            selector: 'edge[?derived]',
            style: {
                'line-color': '#6366f1',
                'target-arrow-color': '#6366f1',
                'line-style': 'dashed'
            }
        },
        {
            selector: 'edge[?aggregated]',
            style: {
                'line-color': '#7c3aed',
                'target-arrow-color': '#7c3aed',
                'line-style': 'dashed',
                width: 2
            }
        },
        {
            selector: 'edge[edgeType = "invokesSubprocess"]',
            style: {
                'line-color': '#7c3aed',
                'target-arrow-color': '#7c3aed',
                'line-style': 'dashed',
                width: 2
            }
        },
        {
            selector: 'edge[edgeType = "callsProcessModel"]',
            style: {
                'line-color': '#0f766e',
                'target-arrow-color': '#0f766e'
            }
        },
        // 타입별 색 — CallActivity 서브타입/ProcessActivity 규칙 뒤에 배치(샘플 순서 동일)
        ...Object.entries(NODE_TYPE_COLORS)
            .filter(([nodeType]) => nodeType !== 'ProcessActivity')
            .map(([nodeType, color]) => ({
                selector: `node[nodeType = "${nodeType}"]`,
                style: {
                    'background-color': color
                }
            })),
        // --- DEST 확장 클래스(뒤에 배치해 데이터 셀렉터를 덮음) ------------------
        // 근거 모드(샘플 evidenceMode 대응): 엣지 굵게+진하게, 노드 테두리 강조
        {
            selector: 'node.oe-evidence',
            style: {
                'border-width': 3,
                'border-color': '#0f172a'
            }
        },
        {
            selector: 'node.oe-evidence[activitySubtype = "CallActivity"]',
            style: {
                'border-width': 5,
                'border-color': CALL_ACTIVITY_BORDER
            }
        },
        {
            selector: 'edge.oe-evidence',
            style: {
                width: 2.5,
                'line-color': '#334155',
                'target-arrow-color': '#334155',
                opacity: 1
            }
        },
        // 선택 하이라이트
        {
            selector: 'node.oe-selected',
            style: {
                'border-width': 4,
                'border-color': '#0085db',
                'underlay-color': '#0085db',
                'underlay-padding': 4,
                'underlay-opacity': 0.18,
                'underlay-shape': 'ellipse'
            }
        },
        // 위험 노드: SPOF 붉은 / 구조 결함 주황 테두리+글로우(underlay)
        {
            selector: 'node.oe-risk-spof',
            style: {
                'border-width': 4,
                'border-color': '#ff3b30',
                'underlay-color': '#ff3b30',
                'underlay-padding': 6,
                'underlay-opacity': 0.3,
                'underlay-shape': 'ellipse'
            }
        },
        {
            selector: 'node.oe-risk-defect',
            style: {
                'border-width': 4,
                'border-color': '#f59e0b',
                'underlay-color': '#f59e0b',
                'underlay-padding': 6,
                'underlay-opacity': 0.3,
                'underlay-shape': 'ellipse'
            }
        },
        // focus fade(visibility.visible === false): 균일 연회색 + 저불투명 — 맨 뒤 배치로 최우선
        {
            selector: 'node.oe-faded',
            style: {
                'background-color': '#8c98af',
                opacity: 0.25,
                'border-width': 1,
                'border-color': '#e2e8f0',
                'underlay-opacity': 0,
                'text-opacity': 0.5
            }
        },
        {
            selector: 'edge.oe-faded',
            style: {
                'line-color': '#8c98af',
                'target-arrow-color': '#8c98af',
                opacity: 0.15
            }
        }
    ];
}

function buildLayout(elementCount: number, nodeCount: number, edgeCount: number): LayoutOptions {
    // SAMPLE 규칙: ≤800 요소 cose, 초과 breadthfirst. 단 breadthfirst는 연결 그래프 전제 —
    // 엣지가 희소한(비연결 위주) 그래프에서는 한 줄로 무한히 넓어져 zoom이 minZoom에
    // 걸리고 콘텐츠가 화면 밖으로 나간다 → 그 경우 조밀한 grid로 대체한다.
    const sparselyConnected = edgeCount < nodeCount / 2;
    const name = elementCount > 800 ? (sparselyConnected ? 'grid' : 'breadthfirst') : 'cose';
    return {
        name,
        animate: false,
        fit: true,
        padding: 30,
        directed: true
    } as LayoutOptions;
}

// ---------------------------------------------------------------------------
// 초기화 / 데이터·클래스 반영
// ---------------------------------------------------------------------------

function initGraph() {
    if (!canvasEl.value) return;
    try {
        cy = cytoscape({
            container: canvasEl.value,
            elements: [],
            style: buildStylesheet(),
            minZoom: 0.1,
            maxZoom: 3
        });
        cy.on('tap', 'node', (event) => {
            emit('node-click', event.target.id());
        });
        cy.on('tap', (event) => {
            if (event.target === cy) emit('background-click');
        });
        applyData();
        observeResize();
        // 개발 진단용 — 프로덕션 빌드에서는 트리셰이킹됨
        if (import.meta.env.DEV) (window as any).__oeCy = cy;
    } catch (e: any) {
        loadError.value = e?.message || String(e);
    }
}

/** nodes/edges 변경 반영 — 요소 전체 교체 후 레이아웃 재실행(샘플의 재인스턴스 대응). */
function applyData() {
    if (!cy) return;
    // 렌더 가드 차단 중에는 대규모 데이터를 엔진에 올리지 않는다(분석 우선).
    const elements = props.renderBlocked.blocked ? [] : buildElements();
    cy.batch(() => {
        cy!.elements().remove();
        cy!.add(elements);
    });
    applyClasses();
    if (elements.length) {
        cy.resize();
        cy.layout(buildLayout(elements.length, cy.nodes().length, cy.edges().length)).run();
        cy.fit(undefined, 30);
    }
}

/** visibility/selected/risk/evidence 반영 — 클래스만 갱신, 레이아웃 재실행 없음. */
function applyClasses() {
    if (!cy) return;
    cy.batch(() => {
        cy!.nodes().forEach((node) => {
            const id = node.id();
            node.toggleClass('oe-faded', !isVisible(id));
            node.toggleClass('oe-selected', props.selectedNodeId === id);
            node.toggleClass('oe-risk-spof', props.riskNodeIds[id] === 'SPOF');
            node.toggleClass('oe-risk-defect', props.riskNodeIds[id] === 'StructuralDefect');
            node.toggleClass('oe-evidence', props.evidenceActive);
        });
        cy!.edges().forEach((edge) => {
            edge.toggleClass('oe-faded', !isVisible(edge.source().id()) || !isVisible(edge.target().id()));
            edge.toggleClass('oe-evidence', props.evidenceActive);
        });
    });
}

/** 컨테이너 리사이즈에 렌더러 크기 동기화 — 패널 접힘/창 크기 변화 시 캔버스가 침범/공백 없이 맞음. */
function observeResize() {
    if (!canvasEl.value || typeof ResizeObserver === 'undefined') return;
    resizeObserver = new ResizeObserver(() => {
        cy?.resize();
    });
    resizeObserver.observe(canvasEl.value);
}

function onSliderInput(ev: Event) {
    emit('set-depth', Number((ev.target as HTMLInputElement).value));
}

// 마우스 휠로 Depth 조절(FR-016 유지) — focus 노드가 있을 때만 가로채고, 그 외는 cytoscape 기본 줌.
// capture 단계에서 가로채 cytoscape 자체 휠 줌 핸들러보다 먼저 처리한다.
function onWheel(ev: WheelEvent) {
    if (!props.focusNodeId) return;
    ev.preventDefault();
    ev.stopPropagation();
    emit('set-depth', Math.min(6, Math.max(0, props.depth + (ev.deltaY < 0 ? 1 : -1))));
}

watch(() => [props.nodes, props.edges] as const, applyData, { deep: false });
watch(() => props.renderBlocked.blocked, applyData);
watch(() => props.riskNodeIds, applyClasses, { deep: false });
watch(() => props.visibility, applyClasses, { deep: false });
watch(
    () => props.evidenceActive,
    () => applyClasses()
);
watch(
    () => props.selectedNodeId,
    () => applyClasses()
);
watch(
    () => props.focusNodeId,
    (id) => {
        focusLabel.value = props.nodes.find((n) => n.id === id)?.label || '';
    }
);

onMounted(() => {
    initGraph();
    canvasEl.value?.addEventListener('wheel', onWheel, { passive: false, capture: true });
});

onBeforeUnmount(() => {
    canvasEl.value?.removeEventListener('wheel', onWheel, { capture: true });
    resizeObserver?.disconnect();
    if (cy) {
        cy.destroy();
        cy = null;
    }
});
</script>

<style scoped>
.ontology-canvas-root {
    position: relative;
    width: 100%;
    height: 100%;
    background: #eef2f8;
    overflow: hidden;
}
.ontology-canvas {
    width: 100%;
    height: 100%;
}
.canvas-controls {
    position: absolute;
    top: 12px;
    left: 12px;
    background: #ffffff;
    color: #1f2533;
    border: 1px solid #e7eaf3;
    box-shadow: 0 4px 14px rgba(31, 37, 51, 0.1);
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 200px;
    z-index: 5;
}
.controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.depth-label {
    font-weight: 600;
}
.clear-btn {
    border: 1px solid #e7eaf3;
    background: #fff;
    color: #e5484d;
    border-radius: 6px;
    font-size: 11px;
    padding: 2px 8px;
    cursor: pointer;
}
.clear-btn:hover {
    background: #fff1f0;
}
.depth-slider {
    width: 100%;
    accent-color: #0085db;
}
.focus-hint {
    color: #8a93a6;
    font-size: 11px;
}
.evidence-chip {
    position: absolute;
    top: 12px;
    right: 12px;
    background: #1f2533;
    color: #ffd166;
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    box-shadow: 0 4px 14px rgba(31, 37, 51, 0.25);
    z-index: 5;
}
.canvas-legend {
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #e7eaf3;
    box-shadow: 0 4px 14px rgba(31, 37, 51, 0.1);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 11px;
    color: #1f2533;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 40%;
    overflow-y: auto;
    z-index: 5;
}
.legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
}
.legend-chip {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
.legend-label {
    flex: 1;
}
.legend-count {
    color: #8a93a6;
    font-variant-numeric: tabular-nums;
}
.canvas-error,
.canvas-empty,
.canvas-blocked {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #1f2533;
    text-align: center;
    background: #ffffff;
    border: 1px solid #e7eaf3;
    box-shadow: 0 6px 24px rgba(31, 37, 51, 0.08);
    padding: 22px 26px;
    border-radius: 12px;
    max-width: 340px;
}
.canvas-empty__icon,
.canvas-blocked__icon {
    font-size: 26px;
    color: #b7c0d1;
    margin-bottom: 8px;
}
.canvas-empty__title,
.canvas-blocked__title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 6px;
    line-height: 1.5;
}
.canvas-empty__hint {
    font-size: 12px;
    color: #8a93a6;
    line-height: 1.5;
}
.canvas-blocked__meta {
    font-size: 12px;
    color: #8a93a6;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 12px;
}
.canvas-blocked__reason {
    font-size: 11px;
}
.focus-open-btn {
    border: none;
    background: #0085db;
    color: #fff;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 18px;
    cursor: pointer;
}
.focus-open-btn:hover {
    background: #006eb8;
}
.canvas-error-detail {
    margin-top: 6px;
    font-size: 11px;
    opacity: 0.6;
}
</style>
