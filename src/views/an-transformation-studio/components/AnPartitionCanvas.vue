<script setup lang="ts">
/**
 * AnPartitionCanvas — AN Transformation Studio 전용 편집 가능 BPMN 캔버스.
 *
 * 공용 BpmnUengineViewer 와 동일한 bpmn-js 구성(customBpmn 렌더러 + uEngine/zeebe/phase moddle +
 * ZoomScroll/MoveCanvas)을 쓰되, "읽기전용"을 강제하던 Blocker 모듈을 빼서 이동/리사이즈가 가능하다.
 * (공용 뷰어를 건드리지 않도록 스튜디오 전용으로 분리)
 *
 * 각 PartitionBlock 의 element_ids 바운딩 박스에 bpmn:Group 아티팩트를 그리고, 좌상단에 eTOM Process ID +
 * 그룹명 배지를 오버레이로 표시한다. 박스 클릭 시 select 이벤트로 해당 파티션을 선택한다.
 * getXml()/getModeler() 는 P4/P5(Call Activity 모듈화)에서 캔버스 XML·모델러에 접근하기 위한 expose.
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import type { PartitionBlock } from '@/composables/blueprint/blueprintModel';
import 'bpmn-js/dist/assets/diagram-js.css';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import ZoomScroll from '@/components/customZoomScroll';
import MoveCanvas from '@/components/customMoveCanvas';
import customBpmnModule from '@/components/customBpmn';
import paletteProvider from '@/components/customPalette/PaletteProvider';
import uEngineModdleDescriptor from '@/components/descriptors/uEngine.json';
import zeebeModdleDescriptor from '@/components/descriptors/zeebe.json';
import phaseModdle from '@/assets/bpmn/phase-moddle.json';

const props = withDefaults(
    defineProps<{
        bpmn: string;
        partitions: PartitionBlock[];
        selectedId?: string | null;
        editable?: boolean;
    }>(),
    { selectedId: null, editable: true }
);

const emit = defineEmits<{
    (e: 'ready'): void;
    (e: 'select', partitionId: string): void;
    (e: 'membership-changed', updates: { partitionId: string; members: { id: string; name: string }[] }[]): void;
}>();

const container = ref<HTMLElement | null>(null);
// 모델러 인스턴스는 reactive 로 감싸면 안 됨(내부 상태 깨짐) → 일반 클로저 변수로 보관.
let modeler: any = null;
let createdGroups: any[] = []; // 우리가 생성한 bpmn:Group shape 목록
const groupToPartition = new Map<string, string>(); // groupShape.id → partition.id
let imported = false;
let redrawing = false; // 우리가 박스를 그리는 동안 발생하는 commandStack 이벤트는 멤버십 재계산에서 무시
let recomputeTimer: ReturnType<typeof setTimeout> | null = null;
let lastSignature = ''; // 파티션 id 집합 시그니처 — 구조 변경(AI 재분할)일 때만 박스 재드로우

const GROUP_PAD = 26;

function beginRedraw() {
    redrawing = true;
    // 재드로우(파티션 구조 변경/도면 교체) 전에 대기 중인 멤버십 재계산을 취소 — 오래된 group→partition
    // 매핑으로 잘못된 partitionId 를 emit 하는 race 방지.
    if (recomputeTimer) {
        clearTimeout(recomputeTimer);
        recomputeTimer = null;
    }
}
function endRedraw() {
    // 드로잉 중 큐잉된 commandStack 이벤트가 디바운스 창을 지나친 뒤 풀리도록 지연.
    setTimeout(() => {
        redrawing = false;
    }, 200);
}
function partitionSignature(): string {
    return (props.partitions || []).map((p) => p.id).join('|');
}

function svc(name: string): any {
    return modeler ? modeler.get(name) : null;
}

/** removeShape 없이 추적 상태만 비움 (importXML 직전, 도면 자체가 교체될 때). */
function resetGroupState() {
    createdGroups = [];
    groupToPartition.clear();
}

/** 기존에 그린 그룹 박스를 캔버스에서 제거 (동일 도면에서 재드로우 시). */
function clearGroups() {
    const modeling = svc('modeling');
    if (modeling) {
        for (const g of createdGroups) {
            try {
                modeling.removeShape(g);
            } catch {
                /* 이미 제거됨 */
            }
        }
    }
    resetGroupState();
}

function computeBounds(elementIds: string[]): { x: number; y: number; width: number; height: number } | null {
    const registry = svc('elementRegistry');
    if (!registry) return null;
    const shapes = (elementIds || [])
        .map((id) => registry.get(id))
        .filter((s: any) => s && typeof s.x === 'number' && typeof s.width === 'number');
    if (!shapes.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of shapes) {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.width);
        maxY = Math.max(maxY, s.y + s.height);
    }
    return { x: minX - GROUP_PAD, y: minY - GROUP_PAD, width: maxX - minX + GROUP_PAD * 2, height: maxY - minY + GROUP_PAD * 2 };
}

function escapeHtml(s: string): string {
    return String(s || '').replace(
        /[&<>"]/g,
        (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c])
    );
}

function badgeHtml(p: PartitionBlock): string {
    const idTxt = p.etom_process_id ? `<span class="anpc-badge__id">${escapeHtml(p.etom_process_id)}</span>` : '';
    return `<div class="anpc-badge">${idTxt}<span class="anpc-badge__name">${escapeHtml(p.name || '논리 블록')}</span></div>`;
}

function drawGroups() {
    if (!modeler || !imported) return;
    const modeling = svc('modeling');
    const elementFactory = svc('elementFactory');
    const overlays = svc('overlays');
    const canvas = svc('canvas');
    if (!modeling || !elementFactory || !canvas) return;

    beginRedraw();
    clearGroups();
    const root = canvas.getRootElement();
    for (const p of props.partitions || []) {
        const bounds = computeBounds(p.element_ids || []);
        if (!bounds) continue; // element_ids 가 비면(매칭 실패) 박스 생략 — 카드는 그대로 표시
        const shape = elementFactory.createShape({ type: 'bpmn:Group' });
        try {
            modeling.createShape(shape, bounds, root);
        } catch {
            continue;
        }
        createdGroups.push(shape);
        groupToPartition.set(shape.id, p.id);
        try {
            overlays.add(shape.id, 'anpc-label', { position: { top: -28, left: -2 }, html: badgeHtml(p) });
        } catch {
            /* 오버레이 실패는 무시 */
        }
    }
    lastSignature = partitionSignature();
    applySelection();
    endRedraw();
}

/** bpmn:FlowNode(Task/Event/Gateway/CallActivity/SubProcess) 이며 좌표를 가진 도형인가. */
function isFlowNode(el: any): boolean {
    const bo = el?.businessObject;
    try {
        if (bo && typeof bo.$instanceOf === 'function') return bo.$instanceOf('bpmn:FlowNode') && typeof el.x === 'number';
    } catch {
        /* fallthrough */
    }
    return typeof el?.x === 'number' && /Task$|Event$|Gateway$|CallActivity$|SubProcess$/.test(el?.type || '');
}

function elementName(el: any): string {
    const bo = el?.businessObject;
    return String(bo?.name || el?.id || '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 현재 그룹 박스들의 기하학적 위치를 기준으로 각 박스에 속한 노드를 재계산해 emit.
 * 노드 중심이 여러 박스에 겹치면 면적이 가장 작은(가장 구체적인) 박스에 배정한다.
 */
function recomputeMembership() {
    if (!modeler || !imported || !createdGroups.length) return;
    const registry = svc('elementRegistry');
    if (!registry) return;
    // 살아있는 그룹만 (사용자가 삭제했을 수 있음). shape 좌표는 이동/리사이즈 시 in-place 갱신됨.
    const groups = createdGroups.map((g) => registry.get(g.id)).filter((g: any) => g && groupToPartition.has(g.id));
    if (!groups.length) return;

    const result = new Map<string, { id: string; name: string }[]>();
    for (const g of groups) result.set(g.id, []);

    const nodes = registry.filter((el: any) => isFlowNode(el));
    for (const node of nodes) {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        let best: any = null;
        let bestArea = Infinity;
        for (const g of groups) {
            if (cx >= g.x && cx <= g.x + g.width && cy >= g.y && cy <= g.y + g.height) {
                const area = g.width * g.height;
                if (area < bestArea) {
                    bestArea = area;
                    best = g;
                }
            }
        }
        if (best) (result.get(best.id) as { id: string; name: string }[]).push({ id: node.id, name: elementName(node) });
    }

    const updates = groups.map((g: any) => ({
        partitionId: groupToPartition.get(g.id) as string,
        members: result.get(g.id) || []
    }));
    emit('membership-changed', updates);
}

function scheduleRecompute() {
    if (redrawing) return;
    if (recomputeTimer) clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(() => {
        recomputeTimer = null;
        recomputeMembership();
    }, 150);
}

function applySelection() {
    const canvas = svc('canvas');
    if (!canvas) return;
    for (const g of createdGroups) {
        const pid = groupToPartition.get(g.id);
        try {
            if (pid && pid === props.selectedId) canvas.addMarker(g.id, 'anpc-group--active');
            else canvas.removeMarker(g.id, 'anpc-group--active');
        } catch {
            /* noop */
        }
    }
}

async function importXml(xml: string) {
    imported = false;
    resetGroupState();
    if (!modeler || !xml) return;
    beginRedraw(); // import 중 발생하는 이벤트는 멤버십 재계산에서 무시
    try {
        await modeler.importXML(xml);
        imported = true;
        try {
            svc('canvas').zoom('fit-viewport', 'auto');
        } catch {
            /* noop */
        }
        drawGroups(); // 내부에서 endRedraw 호출
        emit('ready');
    } catch {
        imported = false; // 잘못된 XML → 빈 캔버스 유지
        endRedraw();
    }
}

function initModeler() {
    modeler = new BpmnModeler({
        container: container.value,
        additionalModules: [
            customBpmnModule,
            {
                __init__: ['paletteProvider'],
                paletteProvider: ['type', paletteProvider],
                viewModeFlag: ['value', !props.editable]
            },
            ZoomScroll,
            MoveCanvas
        ],
        moddleExtensions: {
            uengine: uEngineModdleDescriptor,
            zeebe: zeebeModdleDescriptor,
            phase: phaseModdle
        }
    });

    const eventBus = svc('eventBus');
    // 그룹 박스 클릭 → 파티션 선택
    eventBus?.on('element.click', (ev: any) => {
        const pid = groupToPartition.get(ev?.element?.id);
        if (pid) emit('select', pid);
    });
    // 박스 이동/리사이즈·노드 이동 등 모델 변경 → 멤버십 재계산 (P2)
    eventBus?.on('commandStack.changed', scheduleRecompute);
}

defineExpose({
    /** 현재 캔버스 XML(그룹 박스 포함) 직렬화 — P4/P5 모듈화에서 사용. */
    async getXml(): Promise<string> {
        if (!modeler) return '';
        try {
            const r = await modeler.saveXML({ format: true });
            return r?.xml || '';
        } catch {
            return '';
        }
    },
    getModeler(): any {
        return modeler;
    },
    redraw: drawGroups
});

let resizeObs: ResizeObserver | null = null;

onMounted(() => {
    initModeler();
    importXml(props.bpmn);
    // 컨테이너 크기 변경(패널 리사이즈) 시 diagram-js viewbox 캐시 갱신
    if (container.value && typeof ResizeObserver !== 'undefined') {
        resizeObs = new ResizeObserver(() => {
            try {
                svc('canvas')?.resized();
            } catch {
                /* noop */
            }
        });
        resizeObs.observe(container.value);
    }
});
onBeforeUnmount(() => {
    resizeObs?.disconnect();
    resizeObs = null;
    if (recomputeTimer) clearTimeout(recomputeTimer);
    try {
        modeler?.destroy();
    } catch {
        /* noop */
    }
    modeler = null;
});

watch(
    () => props.bpmn,
    (xml) => importXml(xml)
);
// 파티션 "집합"이 바뀔 때(AI 재분할 등)만 박스 재드로우. 같은 집합의 element_ids 변경
// (사용자 멤버십 조정 결과)은 박스를 다시 그리지 않아 사용자가 맞춘 박스 위치/크기를 보존.
watch(
    () => props.partitions,
    () => {
        if (partitionSignature() !== lastSignature) drawGroups();
    },
    { deep: true }
);
watch(
    () => props.selectedId,
    () => applySelection()
);
</script>

<template>
    <div ref="container" class="anpc"></div>
</template>

<style scoped>
.anpc {
    width: 100%;
    height: 100%;
    position: relative;
    background: #ffffff;
}
.anpc :deep(.bjs-container),
.anpc :deep(.djs-container) {
    height: 100% !important;
}

/* 좌측 팔레트가 캔버스 높이보다 길면 잘리는 대신 내부 스크롤 */
.anpc :deep(.djs-palette) {
    max-height: calc(100% - 20px);
    overflow-y: auto;
    overflow-x: hidden;
}

/* 선택된 그룹 박스 강조 */
.anpc :deep(.djs-element.anpc-group--active .djs-visual > :first-child) {
    stroke: #6366f1 !important;
    stroke-width: 2.4px !important;
}

/* eTOM Process ID + 그룹명 배지 */
.anpc :deep(.anpc-badge) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    background: #eef0fe;
    color: #4f46e5;
    border: 1px solid #c7ccfb;
    border-radius: 8px;
    padding: 2px 9px;
    font-size: 11px;
    font-weight: 700;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.18);
    pointer-events: none;
}
.anpc :deep(.anpc-badge__id) {
    background: #4f46e5;
    color: #ffffff;
    border-radius: 5px;
    padding: 0 5px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
}
</style>
