<template>
    <div class="nvl-root">
        <div ref="frameEl" class="nvl-frame" />

        <!-- 레이아웃 토글 — 계층(dagre, 기본) / Force -->
        <div class="nvl-layout-toggle">
            <button
                v-for="mode in layoutModes"
                :key="mode.key"
                class="nvl-mode-btn"
                :class="{ active: layoutMode === mode.key }"
                :title="mode.hint"
                @click="switchMode(mode.key)"
            >
                {{ mode.label }}
            </button>
        </div>

        <!-- 로드/레이아웃 스피너 -->
        <div v-if="rendering" class="nvl-spinner">
            <v-progress-circular indeterminate color="primary" size="40" width="4" />
            <span>{{ layoutMode === 'hierarchy' ? '계층(dagre) 레이아웃 계산 중…' : 'Force 레이아웃 계산 중…' }}</span>
        </div>

        <div v-if="trace" class="nvl-trace-hint">
            {{ trace.mode === 'rootCause' ? '역추적(원인 분석)' : '순추적(기여 분석)' }} 표시 중 — ESC 로 종료
        </div>

        <div v-if="loadError" class="nvl-error">{{ loadError }}</div>
        <div v-else class="nvl-hint">
            NVL(Neo4j) WebGL · {{ layoutMode === 'hierarchy' ? '계층(dagre)' : 'forceDirected' }} · 노드 드래그 이동 · 휠 줌 · 빈 곳 드래그
            팬 · 클릭 = 선택+이웃 하이라이트{{ fallbackNote ? ` · ${fallbackNote}` : '' }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { colorForLabel, edgeStyleClass } from '@/composables/ontologyNew/layerMapping';
import type { BusinessEdge, BusinessNode, CanvasPerfMetric, ImpactTrace } from '@/composables/ontologyNew/types';

const props = defineProps<{
    nodes: BusinessNode[];
    edges: BusinessEdge[];
    /** 선택 노드 — 있으면 1-hop 이웃만 남기고 나머지 disabled(흐림) */
    selectedNodeId?: string | null;
    /** 역추적/순추적 상태 — 있으면 경로만 남기고 나머지 disabled (선택 하이라이트보다 우선, FR-009) */
    trace?: ImpactTrace | null;
}>();

const emit = defineEmits<{
    (e: 'node-click', nodeId: string): void;
    (e: 'background-click'): void;
    (e: 'perf', metric: CanvasPerfMetric): void;
}>();

type NvlLayoutMode = 'hierarchy' | 'force';

const frameEl = ref<HTMLElement | null>(null);
const loadError = ref<string | null>(null);
const rendering = ref(false);
const layoutMode = ref<NvlLayoutMode>('hierarchy');
const fallbackNote = ref<string | null>(null);

const layoutModes: Array<{ key: NvlLayoutMode; label: string; hint: string }> = [
    { key: 'hierarchy', label: '계층', hint: 'NVL hierarchical(dagre) — 위→아래 위계' },
    { key: 'force', label: 'Force', hint: 'NVL forceDirected — 자유 배치' }
];

/** 계층(dagre) 레이아웃 무응답 안전장치 — 워커가 죽으면 onLayoutDone 이 영영 안 온다 */
const HIERARCHY_TIMEOUT_MS = 25_000;

let nvlInstance: any = null;
let interactions: Array<{ destroy: () => void }> = [];
let layoutReported = false;
let hierarchyTimer: ReturnType<typeof setTimeout> | null = null;

function timestamp(): string {
    return new Date().toLocaleTimeString('ko-KR', { hour12: false }) + `.${String(Date.now() % 1000).padStart(3, '0')}`;
}

function relColor(type: string): string {
    const cls = edgeStyleClass(type);
    return cls === 'gateway' ? '#334155' : cls === 'inheritance' ? '#15803d' : '#cbd5e1';
}

function switchMode(mode: NvlLayoutMode) {
    if (layoutMode.value === mode) return;
    layoutMode.value = mode;
    render();
}

async function render() {
    if (!frameEl.value) return;
    loadError.value = null;
    rendering.value = true;
    layoutReported = false;
    if (hierarchyTimer) clearTimeout(hierarchyTimer);
    const t0 = performance.now();
    try {
        const [{ NVL }, handlers] = await Promise.all([import('@neo4j-nvl/base'), import('@neo4j-nvl/interaction-handlers')]);
        const tLib = performance.now();

        const nvlNodes = props.nodes.map((n) => ({
            id: n.id,
            caption: n.name,
            color: colorForLabel(n.label),
            size: n.label === 'ProcessDefinition' || n.label === 'MegaProcess' ? 22 : 16
        }));
        const nvlRels = props.edges.map((e) => ({
            id: e.id,
            from: e.source,
            to: e.target,
            color: relColor(e.type)
        }));

        destroyInstance();
        nvlInstance = new NVL(
            frameEl.value,
            nvlNodes,
            nvlRels,
            layoutMode.value === 'hierarchy'
                ? // 계층 — dagre 기반. SharedWorker 로 실행되므로 vite optimizeDeps 설정 필수
                  // (vite.config.ts 의 @neo4j-nvl/layout-workers exclude 항목 참조)
                  { layout: 'hierarchical', layoutOptions: { direction: 'down' } as any, disableTelemetry: true }
                : { layout: 'forceDirected', disableTelemetry: true },
            {
                onLayoutDone: () => {
                    if (hierarchyTimer) clearTimeout(hierarchyTimer);
                    rendering.value = false;
                    if (layoutReported) return;
                    layoutReported = true;
                    emit('perf', {
                        lib: 'nvl',
                        libLoadMs: Math.round(tLib - t0),
                        renderMs: Math.round(performance.now() - tLib),
                        finishedAt: timestamp(),
                        nodes: props.nodes.length,
                        edges: props.edges.length
                    });
                }
            }
        );

        // 무응답 폴백 — 계층 워커가 (환경 문제로) 응답하지 않으면 Force 로 자동 전환
        if (layoutMode.value === 'hierarchy') {
            hierarchyTimer = setTimeout(() => {
                if (!rendering.value) return;
                fallbackNote.value = '계층 레이아웃 무응답 → Force 자동 전환됨';
                layoutMode.value = 'force';
                render();
            }, HIERARCHY_TIMEOUT_MS);
        }

        const click = new handlers.ClickInteraction(nvlInstance);
        click.updateCallback('onNodeClick', ((node: any) => {
            if (node?.id) emit('node-click', String(node.id));
        }) as any);
        click.updateCallback('onCanvasClick', (() => emit('background-click')) as any);
        interactions = [
            click,
            new handlers.DragNodeInteraction(nvlInstance), // 노드 드래그 이동
            new handlers.ZoomInteraction(nvlInstance),
            new handlers.PanInteraction(nvlInstance),
            new handlers.HoverInteraction(nvlInstance) // 드래그/호버 대상 판정 지원
        ];

        applyHighlight();
    } catch (e: any) {
        rendering.value = false;
        loadError.value = `NVL 로드/렌더 실패: ${e?.message ?? e}`;
    }
}

/**
 * 하이라이트 — 우선순위: ① 추적(역추적/순추적) 경로 ② 선택 이웃(1-hop) ③ 없음(전체 복원).
 * 경로/이웃 밖은 disabled(흐림), 강조 관계는 주황.
 */
function applyHighlight() {
    if (!nvlInstance) return;

    // ① 추적 모드 — 경로 서브그래프만 하이라이트 (선택보다 우선)
    const t = props.trace ?? null;
    if (t) {
        nvlInstance.updateElementsInGraph(
            props.nodes.map((n) => ({ id: n.id, selected: n.id === t.originId, disabled: !t.nodeIds.has(n.id) })),
            props.edges.map((e) =>
                t.edgeIds.has(e.id) ? { id: e.id, color: '#d97706', width: 3 } : { id: e.id, color: '#eef2f7', width: 1 }
            )
        );
        return;
    }

    const selected = props.selectedNodeId ?? null;

    if (!selected) {
        nvlInstance.updateElementsInGraph(
            props.nodes.map((n) => ({ id: n.id, selected: false, disabled: false })),
            props.edges.map((e) => ({ id: e.id, color: relColor(e.type), width: undefined }))
        );
        return;
    }

    const hood = new Set<string>([selected]);
    const incident = new Set<string>();
    for (const e of props.edges) {
        if (e.source === selected || e.target === selected) {
            hood.add(e.source);
            hood.add(e.target);
            incident.add(e.id);
        }
    }

    nvlInstance.updateElementsInGraph(
        props.nodes.map((n) => ({ id: n.id, selected: n.id === selected, disabled: !hood.has(n.id) })),
        props.edges.map((e) => (incident.has(e.id) ? { id: e.id, color: '#f59e0b', width: 3 } : { id: e.id, color: '#eef2f7', width: 1 }))
    );
}

function destroyInstance() {
    for (const it of interactions) {
        try {
            it.destroy();
        } catch {
            /* noop */
        }
    }
    interactions = [];
    if (nvlInstance) {
        try {
            nvlInstance.destroy();
        } catch {
            /* noop */
        }
        nvlInstance = null;
    }
}

onMounted(() => render());
onBeforeUnmount(() => {
    if (hierarchyTimer) clearTimeout(hierarchyTimer);
    destroyInstance();
});

watch(
    () => [props.nodes, props.edges],
    () => render()
);
watch(
    () => [props.selectedNodeId, props.trace],
    () => applyHighlight()
);

/** 외부에서 특정 노드로 카메라 이동 (원인 후보/관계 클릭 등) */
function focusNode(nodeId: string) {
    try {
        nvlInstance?.fit([nodeId], { animated: true } as any);
    } catch {
        /* 노드 미존재 등 — 무시 */
    }
}

defineExpose({ focusNode });
</script>

<style scoped>
.nvl-root {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 420px;
    background: #fff;
    overflow: hidden;
}
.nvl-frame {
    position: absolute;
    inset: 0;
}
.nvl-layout-toggle {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 3;
    display: flex;
    gap: 4px;
}
.nvl-mode-btn {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.92);
    color: #64748b;
    font-size: 12px;
    padding: 4px 12px;
    cursor: pointer;
}
.nvl-mode-btn.active {
    border-color: #1d4ed8;
    color: #1d4ed8;
    font-weight: 700;
}
.nvl-spinner {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.7);
    color: #475569;
    font-size: 13px;
}
.nvl-hint {
    position: absolute;
    bottom: 8px;
    left: 12px;
    font-size: 11px;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.85);
    padding: 2px 8px;
    border-radius: 6px;
    z-index: 2;
}
.nvl-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #991b1b;
    background: #fef2f2;
}
.nvl-trace-hint {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(217, 119, 6, 0.95);
    color: #fff;
    z-index: 3;
}
</style>
