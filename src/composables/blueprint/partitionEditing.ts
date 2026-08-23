/**
 * 파티션 그룹 편집(페인트 배정·변환 미리보기)용 순수 함수 모음.
 *
 * 계약: specs/011-partition-edit-ux/contracts/component-events.md
 * 데이터 모델: specs/011-partition-edit-ux/data-model.md
 *
 * 이 모듈의 함수는 모두 결정적·부작용 없음이며 입력을 변형하지 않는다.
 */
import type { PartitionBlock, PartitionTask } from './blueprintModel';

/**
 * 파티션 블록 팔레트 — 단일 소스.
 * (기존 ProcessHierarchyDesigner.vue / ProcessDefinitionTeamChat.vue 중복 상수를 이곳으로 통합)
 */
export const PARTITION_BLOCK_COLORS = [
    '#5b6ee1',
    '#21a36b',
    '#e0762b',
    '#9b59b6',
    '#c0397b',
    '#0e9aa7',
    '#b58900',
    '#475569',
] as const;

/** color_idx → 팔레트 색. 음수·비정수 등 비정상 입력은 0번 색으로 폴백. */
export function partitionColor(colorIdx: number | null | undefined): string {
    const n = PARTITION_BLOCK_COLORS.length;
    if (typeof colorIdx !== 'number' || !Number.isFinite(colorIdx)) return PARTITION_BLOCK_COLORS[0];
    const idx = ((Math.trunc(colorIdx) % n) + n) % n;
    return PARTITION_BLOCK_COLORS[idx];
}

function isValidColorIdx(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < PARTITION_BLOCK_COLORS.length;
}

/**
 * 모든 블록에 유효한 color_idx 를 보장한다(구버전 데이터 지연 마이그레이션).
 * - 이미 유효한 color_idx(0~7 정수)는 보존
 * - 미지정/비정상 블록에는 배열 순서대로 "사용 빈도가 가장 낮은 최소 인덱스"를 배정
 *   (8개 이하일 때는 곧 '사용 중이 아닌 최소 인덱스', 8개 초과 시 최소 사용 빈도 순환)
 * - 입력 불변: 항상 새 배열을 반환하며, 변경된 블록만 얕은 복사
 */
export function ensurePartitionColors(partitions: PartitionBlock[]): {
    partitions: PartitionBlock[];
    changed: boolean;
} {
    const counts = new Array(PARTITION_BLOCK_COLORS.length).fill(0);
    for (const p of partitions) {
        if (isValidColorIdx(p.color_idx)) counts[p.color_idx] += 1;
    }
    let changed = false;
    const next = partitions.map((p) => {
        if (isValidColorIdx(p.color_idx)) return p;
        const idx = counts.indexOf(Math.min(...counts));
        counts[idx] += 1;
        changed = true;
        return { ...p, color_idx: idx };
    });
    return { partitions: next, changed };
}

/** 미리보기 입력: 캔버스의 플로우 노드(이벤트·태스크·게이트웨이 등) 스냅샷. */
export interface PreviewNode {
    id: string;
    name: string;
}

/** 미리보기 입력: 시퀀스 플로우 스냅샷. */
export interface PreviewConnection {
    id: string;
    sourceId: string;
    targetId: string;
}

export interface CommitPreviewBlock {
    id: string;
    name: string;
    colorIdx: number;
    etomProcessId?: string;
    /** 캔버스에 실제 존재하는 멤버 노드 */
    members: Array<{ id: string; name: string }>;
    /** element_ids 에는 있으나 캔버스에 없는 잔재 ID */
    missingIds: string[];
    /** 멤버 0 → 변환에서 제외 */
    excluded: boolean;
}

export interface CommitPreview {
    blocks: CommitPreviewBlock[];
    /** 어느 블록에도 속하지 않은 캔버스 노드 */
    unassigned: Array<{ id: string; name: string }>;
    /** 서로 다른 블록(또는 블록↔미배정) 사이를 잇는 시퀀스 플로우 */
    crossFlows: Array<{
        flowId: string;
        fromNode: { id: string; name: string };
        toNode: { id: string; name: string };
        fromBlockId: string | null;
        toBlockId: string | null;
    }>;
    /** 변환 대상 블록 수 (멤버 1개 이상) */
    convertibleCount: number;
}

/**
 * Call Activity 변환 미리보기 계산.
 * 노드가 여러 블록의 element_ids 에 중복 등장하면 배열 순서상 첫 블록 소속으로 본다.
 */
export function computeCommitPreview(
    partitions: PartitionBlock[],
    nodes: PreviewNode[],
    connections: PreviewConnection[],
): CommitPreview {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const blockByElementId = new Map<string, string>();

    const blocks: CommitPreviewBlock[] = partitions.map((p, i) => {
        const members: Array<{ id: string; name: string }> = [];
        const missingIds: string[] = [];
        for (const elId of p.element_ids || []) {
            if (blockByElementId.has(elId)) continue; // 첫 블록 우선
            const node = nodeById.get(elId);
            if (node) {
                blockByElementId.set(elId, p.id);
                members.push({ id: node.id, name: node.name });
            } else {
                missingIds.push(elId);
            }
        }
        return {
            id: p.id,
            name: p.name,
            colorIdx: isValidColorIdx(p.color_idx) ? p.color_idx : i % PARTITION_BLOCK_COLORS.length,
            etomProcessId: p.etom_process_id,
            members,
            missingIds,
            excluded: members.length === 0,
        };
    });

    const unassigned = nodes
        .filter((n) => !blockByElementId.has(n.id))
        .map((n) => ({ id: n.id, name: n.name }));

    const crossFlows: CommitPreview['crossFlows'] = [];
    for (const conn of connections) {
        const fromNode = nodeById.get(conn.sourceId);
        const toNode = nodeById.get(conn.targetId);
        if (!fromNode || !toNode) continue;
        const fromBlockId = blockByElementId.get(conn.sourceId) ?? null;
        const toBlockId = blockByElementId.get(conn.targetId) ?? null;
        if (fromBlockId === toBlockId) continue; // 같은 블록 내부(둘 다 미배정 포함)는 교차 아님
        crossFlows.push({
            flowId: conn.id,
            fromNode: { id: fromNode.id, name: fromNode.name },
            toNode: { id: toNode.id, name: toNode.name },
            fromBlockId,
            toBlockId,
        });
    }

    return {
        blocks,
        unassigned,
        crossFlows,
        convertibleCount: blocks.filter((b) => !b.excluded).length,
    };
}

/**
 * 채팅 패널 드래그 이동: taskId 를 fromBlockId → toBlockId 로 옮긴다.
 * - element_ids 와 tasks 를 동기 이동, 기존 태스크 속성(tmf 등) 보존
 * - fromBlockId/toBlockId 가 partitions 에 없거나 동일하면 입력 그대로 반환(무동작)
 * - 입력 불변: 변경되는 블록만 얕은 복사한 새 배열 반환
 */
export function movePartitionTask(
    partitions: PartitionBlock[],
    move: { taskId: string; fromBlockId: string; toBlockId: string },
): PartitionBlock[] {
    const { taskId, fromBlockId, toBlockId } = move;
    if (!taskId || fromBlockId === toBlockId) return partitions;
    const from = partitions.find((p) => p.id === fromBlockId);
    const to = partitions.find((p) => p.id === toBlockId);
    if (!from || !to) return partitions;

    const inElementIds = (from.element_ids || []).includes(taskId);
    const taskEntry = (from.tasks || []).find((t) => t.id === taskId);
    if (!inElementIds && !taskEntry) return partitions;

    const movedTask: PartitionTask = taskEntry ? { ...taskEntry } : { id: taskId, name: taskId };

    return partitions.map((p) => {
        if (p.id === fromBlockId) {
            return {
                ...p,
                element_ids: (p.element_ids || []).filter((id) => id !== taskId),
                tasks: (p.tasks || []).filter((t) => t.id !== taskId),
            };
        }
        if (p.id === toBlockId) {
            const elementIds = (p.element_ids || []).filter((id) => id !== taskId);
            const tasks = (p.tasks || []).filter((t) => t.id !== taskId);
            return {
                ...p,
                element_ids: [...elementIds, taskId],
                tasks: [...tasks, movedTask],
            };
        }
        return p;
    });
}
