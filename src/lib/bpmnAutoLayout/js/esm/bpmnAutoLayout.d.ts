/**
 * bpmnAutoLayout — BPMN XML 의 bpmndi(도형 좌표·선 waypoint)를 버리고 결정적 규칙으로 다시 그린다.
 *
 * 용도: Copilot /tobe 처럼 LLM 이 구조(누가 누구 다음인지)는 잘 만들지만 좌표는 엉망인 도면을
 *       "선행보다 항상 오른쪽 · 레인 안 겹침 없음 · 선은 수평/수직만" 인 가독성 있는 도면으로 정리.
 *
 * 규칙(specs/015 참조):
 *  1. 열(column)  — 좌→우 longest-path 레이어링. col(n) = max(col(선행)+1). 순환(back edge)은 층 계산에서 제외.
 *  2. 행(row)     — 레인 안에서 같은 레인 선행들의 평균 행(barycenter)을 희망 행으로, 차 있으면 아래로.
 *                  → 주 경로는 한 행에 직선, 분기는 아래 행에 쌓이고, 합류는 주 행으로 복귀.
 *  3. 좌표        — 열 폭 = 열 최대 폭 + 60, 행 높이 = 행 최대 높이 + 30. 도형은 셀 중앙.
 *  4. 선(edge)    — 같은 행 직선 / 분기 게이트웨이는 위·아래 꼭짓점 수직 출발 / 합류 게이트웨이는 수직 진입 /
 *                  그 외 ㄱ자 3구간 (열 사이 여백 중 도형과 겹치지 않는 곳 선택) / 역방향·자기루프는 행 사이 여백으로 우회.
 *  5. 경계 이벤트 — 호스트 아래 변에 붙이고 아래 여백으로 나간다.
 *
 * DOM(DOMParser) 에 의존하지 않는 문자열 토크나이저 기반이라 node(vitest) 에서도 동작한다.
 */
export interface AutoLayoutResult {
    xml: string;
    changed: boolean;
    warnings: string[];
}
export interface AutoLayoutOptions {
    /** 참여자(풀) 좌상단 원점. 기본 (160, 80) */
    originX?: number;
    originY?: number;
}
interface ModelNode {
    id: string;
    type: string;
    order: number;
    container: string;
    attachedTo?: string;
    hasChildren?: boolean;
}
interface ModelEdge {
    id: string;
    source: string;
    target: string;
    container: string;
}
interface ModelLane {
    id: string;
    process: string;
    refs: string[];
    closeTagStart: number;
    prefix: string;
}
interface ModelArtifact {
    id: string;
    type: string;
    container: string;
}
interface ModelAssociation {
    id: string;
    source: string;
    target: string;
}
interface ModelParticipant {
    id: string;
    processRef: string;
}
interface ModelMessageFlow {
    id: string;
    source: string;
    target: string;
}
interface Model {
    definitionsPrefix: string;
    definitionsOpen: {
        start: number;
        end: number;
        attrs: string;
    } | null;
    definitionsCloseStart: number;
    collaborationId: string;
    processes: string[];
    participants: ModelParticipant[];
    messageFlows: ModelMessageFlow[];
    nodes: Map<string, ModelNode>;
    edges: ModelEdge[];
    lanes: ModelLane[];
    artifacts: ModelArtifact[];
    associations: ModelAssociation[];
    diagramRanges: Array<{
        start: number;
        end: number;
    }>;
    prefixes: {
        bpmndi: string | null;
        dc: string | null;
        di: string | null;
    };
    /** 기존 DI 의 도형 위치(레인/참여자 순서 유지용) */
    diBounds: Map<string, {
        x: number;
        y: number;
    }>;
}
interface Bounds {
    x: number;
    y: number;
    w: number;
    h: number;
}
interface ShapeOut extends Bounds {
    id: string;
    type: string;
    isHorizontal?: boolean;
    isExpanded?: boolean;
    isMarkerVisible?: boolean;
}
interface EdgeOut {
    id: string;
    points: Array<{
        x: number;
        y: number;
    }>;
}
/**
 * 순수 배치 계산 — DI 문자열 생성 없이 도형/선 좌표만 반환(테스트·다른 소비자용).
 */
export declare function computeBpmnLayout(xml: string, options?: AutoLayoutOptions): {
    shapes: ShapeOut[];
    edges: EdgeOut[];
    planeElement: string;
    addedLaneRefs: Array<{
        laneId: string;
        nodeId: string;
    }>;
    warnings: string[];
    model: Model;
};
/**
 * BPMN XML 의 bpmndi 를 자동 배치 결과로 교체한다. 실패(정의 없음·요소 없음) 시 원문을 그대로 돌려준다.
 */
export declare function autoLayoutBpmnXml(xml: string, options?: AutoLayoutOptions): AutoLayoutResult;
/** 두 점을 잇는 구간이 수평 또는 수직인지 (테스트·검증용) */
export declare function isOrthogonalPath(points: Array<{
    x: number;
    y: number;
}>): boolean;
export {};
