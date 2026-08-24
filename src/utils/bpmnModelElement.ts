/**
 * BPMN 모델 요소 판별 유틸.
 *
 * Camunda Modeler(8.x) export BPMN 은 userTask 의 extensionElements 안에
 * <zeebe:userTask/> 같은 실행엔진 마커를 넣는다. XML 을 로컬 이름만으로
 * 분류하면 이 마커가 실제 flowNode 로 오인되므로(id/이름 없는 유령 태스크),
 * getElementsByTagName('*') + localName 방식 파서는 반드시 이 판별을 거친다.
 * (bpmn-js elementRegistry 경로는 렌더링된 모델 요소만 다루므로 해당 없음)
 */
export const BPMN_MODEL_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

interface ElementLike {
    namespaceURI?: string | null;
    localName?: string | null;
    nodeName?: string;
    parentElement?: ElementLike | null;
}

function elementLocalName(node: ElementLike): string {
    return node.localName || (node.nodeName || '').replace(/^.*:/, '');
}

/**
 * BPMN 표준 네임스페이스의 모델 요소인지 판별한다.
 * 확장 네임스페이스(zeebe/camunda/uengine 등) 요소와 extensionElements
 * 하위 요소는 제외하고, 네임스페이스 없는 문서는 그대로 허용한다.
 */
export function isBpmnModelElement(node: ElementLike): boolean {
    const ns = node.namespaceURI;
    if (ns && ns !== BPMN_MODEL_NS) return false;
    for (let p = node.parentElement; p; p = p.parentElement) {
        if (elementLocalName(p) === 'extensionElements') return false;
    }
    return true;
}
