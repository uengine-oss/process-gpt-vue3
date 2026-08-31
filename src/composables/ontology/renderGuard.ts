/**
 * renderGuard — 대규모 그래프 렌더 가드 판정 (순수 함수).
 *
 * SAMPLE bpmn-process-kg `src/web/utils/renderGuard.ts` 번안 (specs/002 T043).
 *  - 대형 소스(isLarge)는 엔터티 포커스 또는 근거(evidence) 모드가 활성일 때만 렌더 허용
 *  - 가시 노드 수가 MAX_VISIBLE_NODES(1500) 초과 시 차단 → "분석 우선" 안내 대상
 *
 * 입력 타입은 구조적 최소 계약(structural typing)으로 정의한다:
 * entityFocus.ts 의 EntityFocusState(entityIds 포함)와 그래프 소스 설정(isLarge 포함)이
 * 그대로 대입 가능하므로 별도 의존 없이 파이프라인에 배선할 수 있다.
 */

export const MAX_VISIBLE_NODES = 1500;

/** 가드 판정에 필요한 최소 포커스 상태 — EntityFocusState 와 구조 호환. */
export interface RenderGuardFocus {
    entityIds: string[];
}

/** 가드 판정에 필요한 최소 그래프 소스 정보 — GraphSource 와 구조 호환. */
export interface RenderGuardSource {
    isLarge: boolean;
}

export interface RenderGuardInput {
    source: RenderGuardSource;
    focus: RenderGuardFocus;
    evidenceMode: boolean;
    visibleNodeCount: number;
}

export interface RenderGuardResult {
    canRender: boolean;
    reason?: string;
}

/** 엔터티 포커스가 하나 이상 선택되어 활성 상태인지 판정. */
export function hasEntityFocus(focus: RenderGuardFocus): boolean {
    return focus.entityIds.length > 0;
}

/**
 * 그래프 직접 렌더 가능 여부 판정.
 *  1) 대형 소스 + 포커스/evidence 비활성 → 차단(분석 우선 탐색 유도)
 *  2) 가시 노드 수 > MAX_VISIBLE_NODES → 차단(필터/포커스 축소 유도)
 *  3) 그 외 → 허용
 */
export function shouldRenderGraph(input: RenderGuardInput): RenderGuardResult {
    const hasFocus = hasEntityFocus(input.focus);

    if (input.source.isLarge && !hasFocus && !input.evidenceMode) {
        return {
            canRender: false,
            reason:
                'Full graph is too large to render directly. Select an entity focus or insight evidence.',
        };
    }

    if (input.visibleNodeCount > MAX_VISIBLE_NODES) {
        return {
            canRender: false,
            reason:
                'Current view has too many nodes. Narrow filters or use entity focus.',
        };
    }

    return { canRender: true };
}
