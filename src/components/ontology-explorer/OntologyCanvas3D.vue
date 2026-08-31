<template>
    <div class="ontology-canvas-root">
        <div v-show="!renderBlocked.blocked" ref="canvasEl" class="ontology-canvas"></div>

        <!-- Depth·포커스 컨트롤 (FR-016 유지) -->
        <div v-if="showOverlays" class="canvas-controls">
            <div class="controls-row">
                <span class="depth-label">Depth {{ depth }}</span>
                <button v-if="focusNodeId" class="clear-btn" title="선택/포커스 해제 (ESC)" @click="emit('background-click')">해제 ✕</button>
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
            3D 그래프 라이브러리를 불러오지 못했습니다. <code>npm install</code> 후 다시 시도하세요.
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GraphEdge, GraphNode, NodeType } from '@/lib/processKg/graph/types';
import { colorForNodeType, labelForNodeType } from '@/composables/ontology/nodeTypeColors';

const props = defineProps<{
    /** 렌더 대상(이미 소스/뷰모드/필터 파이프라인 적용된 집합) */
    nodes: GraphNode[];
    edges: GraphEdge[];
    /** focus+Depth fade 맵(노드 id 기준) */
    visibility: Record<string, { visible: boolean; opacity: number }>;
    /** 펄스 대상(위험 노드) */
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

/** fade-out 노드는 종류색 알파가 아닌 균일한 연회색 — 밝은 배경에서 잔상만 남긴다. */
// fade 노드도 형체는 보여야 한다(배경 #eef2f8 대비) — 완전 투명에 가까우면 빈 화면으로 오인됨
const FADED_COLOR = 'rgba(140,152,175,0.55)';

const canvasEl = ref<HTMLElement | null>(null);
const loadError = ref<string | null>(null);
const focusLabel = ref('');

let graphInstance: any = null;
let THREE: any = null;
let pulseObjects: any[] = [];
let rafId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let zoomTimer: ReturnType<typeof setTimeout> | null = null;
let didInitialZoom = false;
let initialZoomTimers: ReturnType<typeof setTimeout>[] = [];

const showOverlays = computed(() => !props.renderBlocked.blocked && !loadError.value && props.nodes.length > 0);

/** 표시 중 타입만 자동 범례 생성(개수 내림차순). */
const legendEntries = computed(() => {
    const counts = new Map<NodeType, number>();
    for (const n of props.nodes) counts.set(n.type, (counts.get(n.type) || 0) + 1);
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count, color: colorForNodeType(type), label: labelForNodeType(type) }));
});

/** 캔버스 뷰포트 배경 — 좌우 패널(#fff)과 구분되는 라이트 톤. */
function canvasBg(): string {
    return '#eef2f8';
}

function isVisible(nodeId: string): boolean {
    return props.visibility[nodeId]?.visible ?? true;
}

function hexWithAlpha(hex: string, alpha: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const v = parseInt(m[1], 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

/** 타입 팔레트 색 — fade(opacity<1)는 반투명, 비가시는 균일 연회색. */
function colorFor(n: any): string {
    const vis = props.visibility[n.id];
    const base = colorForNodeType(n.type);
    if (!vis) return base;
    if (!vis.visible) return FADED_COLOR;
    if (vis.opacity < 1) return hexWithAlpha(base, Math.max(vis.opacity, 0.25));
    return base;
}

/** 노드 크기 — 모델/프로세스/조직/시스템 허브와 위험·선택 노드를 크게 해 구조가 읽히게 한다. */
function valFor(n: any): number {
    const t = n.type as NodeType;
    let base = 2;
    if (t === 'ProcessModel') base = 8;
    else if (t === 'Process') base = 7;
    else if (t === 'Organization' || t === 'Supplier' || t === 'System') base = 6;
    if (props.riskNodeIds[n.id]) base += 2;
    if (props.selectedNodeId === n.id) base += 1;
    return base;
}

function toForceData() {
    const ids = new Set(props.nodes.map((n) => n.id));
    return {
        nodes: props.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label })),
        // self-loop 및 렌더 집합 밖 끝점을 가진 엣지는 링크 렌더에서 제외
        links: props.edges
            .filter((e) => e.source !== e.target && ids.has(e.source) && ids.has(e.target))
            .map((e) => ({ source: e.source, target: e.target, relation: e.type }))
    };
}

async function initGraph() {
    if (!canvasEl.value) return;
    try {
        const [{ default: ForceGraph3D }, threeMod] = await Promise.all([import('3d-force-graph'), import('three')]);
        THREE = threeMod;
        // 3d-force-graph@1.80+ 생성자 API
        graphInstance = new ForceGraph3D(canvasEl.value)
            .backgroundColor(canvasBg())
            .nodeLabel((n: any) => `${n.label} (${labelForNodeType(n.type)})`)
            .nodeColor(colorFor)
            .nodeVal(valFor)
            .nodeRelSize(6)
            .nodeThreeObjectExtend(true)
            .nodeThreeObject((n: any) => buildRiskObject(n))
            .onNodeClick((n: any) => {
                // 클릭 = 선택+상세(샘플 사용법). Depth fade 하이라이트는 콘솔에서 명시적으로만
                // 발동한다 — 링크 희소 그래프에서 클릭만으로 전 노드가 fade되어
                // 빈 화면처럼 보이던 문제(사용자 리포트) 방지.
                emit('node-click', n.id);
            })
            .onBackgroundClick(() => emit('background-click'))
            .onEngineStop(() => {
                if (!didInitialZoom && graphInstance) {
                    didInitialZoom = true;
                    graphInstance.zoomToFit(600, 60);
                }
            });
        // 링크가 희소한 대형 그래프에서 반발력이 노드 구름을 수천 유닛으로 흩뿌려
        // zoomToFit 후 노드가 서브픽셀로 보이는(빈 화면처럼 보이는) 문제 방지 —
        // 반발을 낮춰 조밀한 구름을 유지한다(샘플 Cytoscape의 컴팩트 레이아웃에 대응).
        const charge = graphInstance.d3Force('charge');
        if (charge?.strength) charge.strength(-10);
        applyEvidenceStyle();
        applyData();
        startPulse();
        observeResize();
        // 개발 진단용 — 프로덕션 빌드에서는 트리셰이킹됨
        if (import.meta.env.DEV) (window as any).__oeGraph = graphInstance;
    } catch (e: any) {
        loadError.value = e?.message || String(e);
    }
}

/** 위험 노드(SPOF/구조 결함)에 펄스 오브젝트 부착(FR-019 유지). fade 시 함께 숨긴다. */
function buildRiskObject(n: any) {
    const riskType = props.riskNodeIds[n.id];
    if (!THREE || !riskType) return undefined;
    const geometry = new THREE.SphereGeometry(6, 16, 16);
    const color = riskType === 'SPOF' ? 0xff3b30 : 0xf59e0b;
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isPulse = true;
    mesh.userData.nodeId = n.id;
    pulseObjects.push(mesh);
    return mesh;
}

function startPulse() {
    const animate = () => {
        const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 400;
        const scale = 1 + Math.sin(t) * 0.35;
        for (const m of pulseObjects) {
            if (m?.scale) m.scale.setScalar(scale);
            if (m?.material) m.material.opacity = 0.2 + (Math.sin(t) + 1) * 0.15;
        }
        rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
}

function applyData() {
    if (!graphInstance) return;
    pulseObjects = [];
    didInitialZoom = false;
    // 렌더 가드 차단 중에는 대규모 데이터를 3D 엔진에 올리지 않는다(분석 우선).
    graphInstance.graphData(props.renderBlocked.blocked ? { nodes: [], links: [] } : toForceData());
    scheduleInitialZoom();
    applyVisibility();
}

/** 초기 카메라 프레이밍 — 엔진 종료(onEngineStop)를 기다리지 않는 단계적 폴백.
 *  링크가 희소한 대형 그래프는 시뮬레이션이 오래 돌아 종료 콜백이 늦고,
 *  그동안 기본 카메라가 노드 구름 밖을 봐 빈 화면처럼 보이는 문제를 방지한다. */
function scheduleInitialZoom() {
    for (const t of initialZoomTimers) clearTimeout(t);
    initialZoomTimers = [800, 2500, 7000].map((ms) =>
        setTimeout(() => {
            if (!graphInstance || props.renderBlocked.blocked || props.focusNodeId) return;
            graphInstance.zoomToFit(600, 60);
            if (ms >= 7000) didInitialZoom = true;
        }, ms)
    );
}

/** 가시성 맵 반영 — 색·크기·링크·펄스를 함께 갱신하고 포커스 클러스터로 카메라 이동. */
function applyVisibility() {
    if (!graphInstance) return;
    graphInstance
        .nodeColor(colorFor)
        .nodeVal(valFor)
        .linkVisibility((l: any) => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            return isVisible(s) && isVisible(t);
        });
    // 위험 펄스는 노드 fade와 동기화 — 흐려진 위험 노드의 펄스가 화면을 지배하지 않게(가독성)
    for (const m of pulseObjects) {
        if (m?.userData?.nodeId) m.visible = isVisible(m.userData.nodeId);
    }
    scheduleZoom();
}

/** 근거 모드 강조 — 링크 굵기/불투명도 상향, 종료 시 기본 스타일 복원. */
function applyEvidenceStyle() {
    if (!graphInstance) return;
    if (props.evidenceActive) {
        graphInstance
            .linkWidth(2.5)
            .linkOpacity(0.9)
            .linkColor(() => 'rgba(51,65,85,0.9)');
    } else {
        graphInstance
            .linkWidth(1)
            .linkOpacity(0.6)
            .linkColor(() => 'rgba(90,110,150,0.45)');
    }
}

/** 포커스가 있으면 관련 클러스터로, 해제되면 전체로 카메라 프레이밍(디바운스). */
function scheduleZoom() {
    if (!graphInstance || !didInitialZoom) return;
    if (zoomTimer) clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => {
        if (!graphInstance) return;
        if (props.focusNodeId) {
            const anyVisible = props.nodes.some((n) => isVisible(n.id));
            if (anyVisible) graphInstance.zoomToFit(600, 80, (n: any) => isVisible(n.id));
        } else {
            graphInstance.zoomToFit(600, 60);
        }
    }, 350);
}

/** 컨테이너 리사이즈에 렌더러 크기 동기화 — 패널 접힘/창 크기 변화 시 캔버스가 침범/공백 없이 맞음. */
function observeResize() {
    if (!canvasEl.value || typeof ResizeObserver === 'undefined') return;
    resizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect && graphInstance) {
            graphInstance.width(rect.width).height(rect.height);
        }
    });
    resizeObserver.observe(canvasEl.value);
}

function onSliderInput(ev: Event) {
    emit('set-depth', Number((ev.target as HTMLInputElement).value));
}

// 마우스 휠로 Depth 조절(FR-016 유지) — focus 노드가 있을 때만 가로채고, 그 외는 기본 줌
function onWheel(ev: WheelEvent) {
    if (!props.focusNodeId) return;
    ev.preventDefault();
    emit('set-depth', Math.min(6, Math.max(0, props.depth + (ev.deltaY < 0 ? 1 : -1))));
}

watch(() => [props.nodes, props.edges] as const, applyData, { deep: false });
watch(() => props.renderBlocked.blocked, applyData);
// 위험 맵 변경은 nodeThreeObject(펄스) 재생성이 필요 → 데이터 재적용
watch(() => props.riskNodeIds, applyData, { deep: false });
watch(() => props.visibility, applyVisibility, { deep: false });
watch(
    () => props.evidenceActive,
    () => applyEvidenceStyle()
);
watch(
    () => props.selectedNodeId,
    () => {
        if (graphInstance) graphInstance.nodeVal(valFor);
    }
);
watch(
    () => props.focusNodeId,
    (id) => {
        focusLabel.value = props.nodes.find((n) => n.id === id)?.label || '';
    }
);

onMounted(() => {
    initGraph();
    canvasEl.value?.addEventListener('wheel', onWheel, { passive: false });
});

onBeforeUnmount(() => {
    canvasEl.value?.removeEventListener('wheel', onWheel);
    if (rafId != null) cancelAnimationFrame(rafId);
    if (zoomTimer) clearTimeout(zoomTimer);
    for (const t of initialZoomTimers) clearTimeout(t);
    resizeObserver?.disconnect();
    if (graphInstance?._destructor) graphInstance._destructor();
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
