/**
 * BPMN XML 구조적 diff 유틸리티
 * 두 BPMN 2.0 XML 버전을 비교해 추가/변경/삭제된 요소를 감지한다.
 * XML 태그 attribute뿐 아니라 <bpmn:extensionElements><uengine:properties>에 저장된
 * JSON 내용(inputData/checkpoints/description/instruction/조건 예시 등)도 비교 대상에 포함한다.
 *
 * 사용 위치:
 * - src/views/process-hierarchy/VersionComparison.vue (버전 비교/PR 리뷰 화면)
 * - 피드백 검토 드로어 패널 (process-feedback-whole-definition-review)
 */

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const UENGINE_NS = 'http://uengine';

export interface BpmnElementInfo {
    id: string;
    name: string;
    elementType: string;
    sourceRef: string;
    targetRef: string;
    attrs: Record<string, any>;
}

export interface BpmnDiffChange {
    type: 'added' | 'modified' | 'removed';
    id: string;
    name: string;
    elementType: string;
    description: string;
}

export type BpmnDiffActivityMap = Record<string, 'added' | 'modified' | 'deleted'>;

export interface BpmnDiffResult {
    changes: BpmnDiffChange[];
    diffActivitiesA: BpmnDiffActivityMap;
    diffActivitiesB: BpmnDiffActivityMap;
}

const ELEMENT_TAGS = [
    'task',
    'userTask',
    'serviceTask',
    'manualTask',
    'scriptTask',
    'sendTask',
    'receiveTask',
    'businessRuleTask',
    'startEvent',
    'endEvent',
    'intermediateThrowEvent',
    'intermediateCatchEvent',
    'boundaryEvent',
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway',
    'eventBasedGateway',
    'complexGateway',
    'subProcess',
    'adHocSubProcess',
    'transaction',
    'callActivity',
    'sequenceFlow',
    'participant',
    'lane'
];

const TYPE_LABELS: Record<string, string> = {
    task: 'Task',
    userTask: 'User Task',
    serviceTask: 'Service Task',
    manualTask: 'Manual Task',
    scriptTask: 'Script Task',
    sendTask: 'Send Task',
    receiveTask: 'Receive Task',
    businessRuleTask: 'Business Rule Task',
    startEvent: 'Start Event',
    endEvent: 'End Event',
    intermediateThrowEvent: 'Intermediate Event',
    intermediateCatchEvent: 'Intermediate Event',
    boundaryEvent: 'Boundary Event',
    exclusiveGateway: 'Gateway',
    parallelGateway: 'Gateway',
    inclusiveGateway: 'Gateway',
    eventBasedGateway: 'Gateway',
    complexGateway: 'Gateway',
    subProcess: 'Sub Process',
    adHocSubProcess: 'Sub Process',
    transaction: 'Sub Process',
    callActivity: 'Call Activity',
    sequenceFlow: 'Sequence Flow',
    participant: 'Participant',
    lane: 'Lane'
};

export function formatElementType(type: string): string {
    return TYPE_LABELS[type] || type;
}

/**
 * 요소 자신의 <bpmn:extensionElements><uengine:properties> JSON 내용을 읽는다.
 * uengine:properties는 json="" attribute 형식과 <uengine:json> 자식 요소 형식을 모두 지원한다
 * (src/utils/uengineXmlTransform.js 참고).
 */
function extractUengineProperties(el: Element): Record<string, any> | null {
    const ext = el.getElementsByTagNameNS(BPMN_NS, 'extensionElements')[0];
    if (!ext) return null;
    const propsEl = ext.getElementsByTagNameNS(UENGINE_NS, 'properties')[0];
    if (!propsEl) return null;

    let jsonText: string | null = propsEl.getAttribute('json');
    if (jsonText == null) {
        const jsonChild = propsEl.getElementsByTagNameNS(UENGINE_NS, 'json')[0];
        jsonText = jsonChild ? jsonChild.textContent : null;
    }
    if (!jsonText || !jsonText.trim()) return null;

    try {
        return JSON.parse(jsonText);
    } catch {
        return null;
    }
}

export function extractBpmnElements(xml: string): BpmnElementInfo[] {
    if (!xml) return [];
    const elements: BpmnElementInfo[] = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        ELEMENT_TAGS.forEach((tag) => {
            const found = doc.getElementsByTagNameNS(BPMN_NS, tag);
            for (let i = 0; i < found.length; i++) {
                const el = found[i];
                const id = el.getAttribute('id');
                if (!id) continue;
                const attrs: Record<string, any> = {};
                for (let a = 0; a < el.attributes.length; a++) {
                    const attr = el.attributes[a];
                    if (attr.name !== 'id' && !attr.name.startsWith('xmlns')) attrs[attr.name] = attr.value;
                }
                if (tag === 'lane') {
                    const refs = el.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef');
                    const arr: string[] = [];
                    for (let r = 0; r < refs.length; r++) {
                        const t = refs[r].textContent?.trim();
                        if (t) arr.push(t);
                    }
                    if (arr.length > 0) attrs['__flowNodeRefs'] = arr.sort().join(',');
                }
                const uengineProperties = extractUengineProperties(el);
                if (uengineProperties) {
                    attrs['__uengineProperties'] = uengineProperties;
                }
                elements.push({
                    id,
                    name: el.getAttribute('name') || '',
                    elementType: tag,
                    sourceRef: el.getAttribute('sourceRef') || '',
                    targetRef: el.getAttribute('targetRef') || '',
                    attrs
                });
            }
        });
    } catch (e) {
        console.warn('extractBpmnElements failed:', e);
    }
    return elements;
}

function descAdd(el: BpmnElementInfo): string {
    return `${formatElementType(el.elementType)} 추가${el.name ? ': ' + el.name : ''}`;
}
function descRem(el: BpmnElementInfo): string {
    return `${formatElementType(el.elementType)} 삭제${el.name ? ': ' + el.name : ''}`;
}
function descMod(o: BpmnElementInfo, n: BpmnElementInfo): string {
    return o.name !== n.name ? `이름 변경: "${o.name}" -> "${n.name}"` : `${formatElementType(n.elementType)} 속성 변경`;
}

export function computeBpmnDiff(oldXml: string, newXml: string): BpmnDiffResult {
    const oldEls = extractBpmnElements(oldXml);
    const newEls = extractBpmnElements(newXml);
    const oldMap = new Map(oldEls.map((e) => [e.id, e]));
    const newMap = new Map(newEls.map((e) => [e.id, e]));
    const changes: BpmnDiffChange[] = [];
    const dA: BpmnDiffActivityMap = {};
    const dB: BpmnDiffActivityMap = {};

    for (const [id, el] of newMap) {
        if (!oldMap.has(id)) {
            changes.push({ type: 'added', id, name: el.name, elementType: el.elementType, description: descAdd(el) });
            dA[id] = 'added';
        }
    }
    for (const [id, el] of oldMap) {
        if (!newMap.has(id)) {
            changes.push({ type: 'removed', id, name: el.name, elementType: el.elementType, description: descRem(el) });
            dB[id] = 'deleted';
        }
    }
    for (const [id, nEl] of newMap) {
        const oEl = oldMap.get(id);
        if (!oEl) continue;
        if (nEl.elementType === 'lane') {
            const oR = new Set((oEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean));
            const nR = new Set((nEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean));
            for (const ref of nR) {
                if (!oR.has(ref as string) && !dA[ref as string]) {
                    const m = newMap.get(ref as string);
                    if (m) {
                        dA[ref as string] = 'modified';
                        dB[ref as string] = 'modified';
                        changes.push({
                            type: 'modified',
                            id: ref as string,
                            name: m.name || (ref as string),
                            elementType: m.elementType,
                            description: `${nEl.name || '다른 레인'}으로 이동`
                        });
                    }
                }
            }
            const oA = { ...oEl.attrs };
            const nA = { ...nEl.attrs };
            delete oA['__flowNodeRefs'];
            delete nA['__flowNodeRefs'];
            if (JSON.stringify(oA) !== JSON.stringify(nA)) {
                changes.push({ type: 'modified', id, name: nEl.name || oEl.name, elementType: nEl.elementType, description: descMod(oEl, nEl) });
                dA[id] = 'modified';
                dB[id] = 'modified';
            }
            continue;
        }
        if (JSON.stringify(oEl.attrs) !== JSON.stringify(nEl.attrs)) {
            changes.push({ type: 'modified', id, name: nEl.name || oEl.name, elementType: nEl.elementType, description: descMod(oEl, nEl) });
            dA[id] = 'modified';
            dB[id] = 'modified';
        }
    }
    return { changes, diffActivitiesA: dA, diffActivitiesB: dB };
}
