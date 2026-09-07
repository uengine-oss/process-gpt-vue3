/**
 * BPMN Diff Utility
 * VersionComparison.vue에서 추출한 공유 유틸리티
 */

export interface BpmnElement {
    id: string;
    name: string;
    elementType: string;
    sourceRef: string;
    targetRef: string;
    attrs: Record<string, string>;
}

export interface BpmnChange {
    type: 'added' | 'removed' | 'modified';
    id: string;
    name: string;
    elementType: string;
    description: string;
    fieldChanges?: string[];
}

export interface BpmnDiffResult {
    changes: BpmnChange[];
    diffActivitiesA: Record<string, string>;
    diffActivitiesB: Record<string, string>;
}

const ELEMENT_TYPE_NAMES: Record<string, string> = {
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
    callActivity: 'Call Activity',
    sequenceFlow: 'Sequence Flow',
    participant: 'Participant',
    lane: 'Lane'
};

const RELEVANT_SELECTORS = [
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
    'callActivity',
    'sequenceFlow',
    'participant',
    'lane'
];

export function formatElementTypeName(type: string): string {
    return ELEMENT_TYPE_NAMES[type] || type;
}

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';

function normalizeSerializedXml(xml: string): string {
    return xml.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

function tryParseJson(text: string): any | null {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
}

function flattenJsonPaths(value: any, prefix = ''): string[] {
    if (value === null || value === undefined) return prefix ? [prefix] : [];
    if (Array.isArray(value)) {
        if (!value.length) return prefix ? [prefix] : [];
        return value.flatMap((item, index) => flattenJsonPaths(item, prefix ? `${prefix}[${index}]` : `[${index}]`));
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (!entries.length) return prefix ? [prefix] : [];
        return entries.flatMap(([key, child]) => flattenJsonPaths(child, prefix ? `${prefix}.${key}` : key));
    }
    return prefix ? [prefix] : [];
}

function extractSequenceFlowExtras(doc: Document): Record<string, { waypoints: string }> {
    const edgeMap: Record<string, { waypoints: string }> = {};
    const edges = doc.getElementsByTagNameNS(BPMNDI_NS, 'BPMNEdge');
    for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const bpmnElement = edge.getAttribute('bpmnElement');
        if (!bpmnElement) continue;
        const waypoints = edge.getElementsByTagNameNS(DI_NS, 'waypoint');
        const points: string[] = [];
        for (let w = 0; w < waypoints.length; w++) {
            const x = waypoints[w].getAttribute('x') || '';
            const y = waypoints[w].getAttribute('y') || '';
            points.push(`${x},${y}`);
        }
        edgeMap[bpmnElement] = {
            waypoints: points.join(' -> ')
        };
    }
    return edgeMap;
}

export function extractBpmnElements(xml: string): BpmnElement[] {
    if (!xml) return [];
    const elements: BpmnElement[] = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const sequenceFlowExtras = extractSequenceFlowExtras(doc);
        const serializer = new XMLSerializer();

        RELEVANT_SELECTORS.forEach((tag) => {
            // getElementsByTagNameNS로 네임스페이스 정확히 처리
            const found = doc.getElementsByTagNameNS(BPMN_NS, tag);
            for (let i = 0; i < found.length; i++) {
                const el = found[i];
                const id = el.getAttribute('id');
                if (!id) continue;
                const name = el.getAttribute('name') || '';
                const sourceRef = el.getAttribute('sourceRef') || '';
                const targetRef = el.getAttribute('targetRef') || '';
                const attrs: Record<string, string> = {};
                for (let a = 0; a < el.attributes.length; a++) {
                    const attr = el.attributes[a];
                    // id와 xmlns 관련 속성 제외
                    if (attr.name !== 'id' && !attr.name.startsWith('xmlns')) {
                        attrs[attr.name] = attr.value;
                    }
                }
                // lane의 flowNodeRef 자식 요소를 attrs에 포함 (레인 멤버십 변경 감지)
                if (tag === 'lane') {
                    const flowNodeRefs = el.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef');
                    const refs: string[] = [];
                    for (let r = 0; r < flowNodeRefs.length; r++) {
                        const refText = flowNodeRefs[r].textContent?.trim();
                        if (refText) refs.push(refText);
                    }
                    if (refs.length > 0) {
                        attrs['__flowNodeRefs'] = refs.sort().join(',');
                    }
                }
                const extensionElements = Array.from(el.childNodes).filter(
                    (node) => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === 'extensionElements'
                ) as Element[];
                if (extensionElements.length > 0) {
                    const extensionKeys = new Set<string>();
                    const extensionXml = extensionElements
                        .map((ext) => normalizeSerializedXml(serializer.serializeToString(ext)))
                        .join('|');
                    for (const ext of extensionElements) {
                        const descendants = ext.getElementsByTagName('*');
                        for (let d = 0; d < descendants.length; d++) {
                            const child = descendants[d];
                            const childName = child.localName || child.nodeName;
                            if (childName) extensionKeys.add(childName);
                            for (let a = 0; a < child.attributes.length; a++) {
                                extensionKeys.add(`${childName}.${child.attributes[a].name}`);
                            }
                            if (childName === 'json') {
                                flattenJsonPaths(tryParseJson(child.textContent || '')).forEach((path) => extensionKeys.add(`json.${path}`));
                            }
                        }
                    }
                    if (extensionXml) attrs['__extensionElementsXml'] = extensionXml;
                    if (extensionKeys.size > 0) attrs['__extensionKeys'] = Array.from(extensionKeys).sort().join(',');
                }
                if (tag !== 'sequenceFlow') {
                    const childXml = Array.from(el.childNodes)
                        .filter((node) => node.nodeType === Node.ELEMENT_NODE)
                        .map((node) => node as Element)
                        .filter((node) => !['incoming', 'outgoing', 'flowNodeRef', 'extensionElements'].includes(node.localName))
                        .map((node) => normalizeSerializedXml(serializer.serializeToString(node)))
                        .join('|');
                    if (childXml) {
                        attrs['__childXml'] = childXml;
                    }
                }
                if (tag === 'sequenceFlow') {
                    const conditionExpression = el.getElementsByTagNameNS(BPMN_NS, 'conditionExpression')[0];
                    if (conditionExpression) {
                        attrs['__conditionExpression'] = normalizeSerializedXml(serializer.serializeToString(conditionExpression));
                    }
                    const childXml = Array.from(el.childNodes)
                        .filter((node) => node.nodeType === Node.ELEMENT_NODE)
                        .map((node) => normalizeSerializedXml(serializer.serializeToString(node)))
                        .join('|');
                    if (childXml) {
                        attrs['__childXml'] = childXml;
                    }
                    const extras = sequenceFlowExtras[id];
                    if (extras?.waypoints) {
                        attrs['__waypoints'] = extras.waypoints;
                    }
                }
                elements.push({ id, name, elementType: tag, sourceRef, targetRef, attrs });
            }
        });
    } catch (e) {
        console.warn('extractBpmnElements failed:', e);
    }
    return elements;
}

function buildDescription(type: string, el: BpmnElement): string {
    const typeName = formatElementTypeName(el.elementType);
    if (type === 'added') {
        if (el.elementType === 'sequenceFlow') {
            return `Added connection${el.name ? ': ' + el.name : ''}`;
        }
        return `Added ${typeName.toLowerCase()}${el.name ? ': ' + el.name : ''}`;
    }
    if (type === 'removed') {
        if (el.elementType === 'sequenceFlow') {
            return `Removed connection${el.name ? ': ' + el.name : ''}`;
        }
        return `Removed ${typeName.toLowerCase()}${el.name ? ': ' + el.name : ''}`;
    }
    return '';
}

function buildModifiedDescription(oldEl: BpmnElement, newEl: BpmnElement): string {
    const fieldChanges = collectModifiedFieldChanges(oldEl, newEl);
    if (fieldChanges.length === 0) {
        return newEl.elementType === 'sequenceFlow'
            ? 'Updated sequence flow properties'
            : `Updated ${formatElementTypeName(newEl.elementType).toLowerCase()} properties`;
    }

    const summary = fieldChanges.slice(0, 3);
    if (fieldChanges.length > 3) {
        summary.push(`${fieldChanges.length - 3} more field(s) changed`);
    }
    return summary.join('. ');
}

function formatFieldLabel(key: string): string {
    const specialMap: Record<string, string> = {
        __flowNodeRefs: 'Lane membership',
        __conditionExpression: 'Condition',
        __childXml: 'Internal BPMN structure',
        __waypoints: 'Connection path',
        __extensionElementsXml: 'Extension properties',
        __extensionKeys: 'Extension fields',
        sourceRef: 'Source',
        targetRef: 'Target',
        name: 'Name'
    };
    if (specialMap[key]) return specialMap[key];
    return key
        .replace(/^__/, '')
        .replace(/_/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitValueList(value: string | undefined): string[] {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function collectModifiedFieldChanges(oldEl: BpmnElement, newEl: BpmnElement): string[] {
    const changes: string[] = [];

    if (oldEl.sourceRef !== newEl.sourceRef || oldEl.targetRef !== newEl.targetRef) {
        changes.push(`Connection changed: ${oldEl.sourceRef} -> ${oldEl.targetRef} => ${newEl.sourceRef} -> ${newEl.targetRef}`);
    }

    if (oldEl.name !== newEl.name) {
        changes.push(`${formatFieldLabel('name')}: "${oldEl.name}" -> "${newEl.name}"`);
    }

    const allKeys = new Set([...Object.keys(oldEl.attrs), ...Object.keys(newEl.attrs)]);
    for (const key of Array.from(allKeys).sort()) {
        if (key === 'name') continue;
        const oldValue = oldEl.attrs[key] || '';
        const newValue = newEl.attrs[key] || '';
        if (oldValue === newValue) continue;

        if (key === '__extensionKeys') {
            const before = new Set(splitValueList(oldValue));
            const after = new Set(splitValueList(newValue));
            const added = Array.from(after).filter((item) => !before.has(item));
            const removed = Array.from(before).filter((item) => !after.has(item));
            if (added.length > 0) changes.push(`Extension fields added: ${added.slice(0, 4).join(', ')}`);
            if (removed.length > 0) changes.push(`Extension fields removed: ${removed.slice(0, 4).join(', ')}`);
            continue;
        }

        if (key === '__extensionElementsXml') {
            changes.push('Extension properties changed');
            continue;
        }

        if (key === '__childXml') {
            changes.push('Internal BPMN structure changed');
            continue;
        }

        if (key === '__flowNodeRefs') {
            changes.push('Lane membership changed');
            continue;
        }

        if (key === '__conditionExpression') {
            changes.push('Condition updated');
            continue;
        }

        if (key === '__waypoints') {
            changes.push('Connection path updated');
            continue;
        }

        changes.push(`${formatFieldLabel(key)} changed`);
    }

    return Array.from(new Set(changes));
}

function serializeAttrs(attrs: Record<string, string>): string {
    const sorted: Record<string, string> = {};
    Object.keys(attrs)
        .sort()
        .forEach((key) => {
            sorted[key] = attrs[key];
        });
    return JSON.stringify(sorted);
}

export function computeBpmnDiff(oldXml: string, newXml: string): BpmnDiffResult {
    const oldElements = extractBpmnElements(oldXml);
    const newElements = extractBpmnElements(newXml);

    const oldMap = new Map(oldElements.map((el) => [el.id, el]));
    const newMap = new Map(newElements.map((el) => [el.id, el]));

    const changes: BpmnChange[] = [];
    const diffActivitiesA: Record<string, string> = {};
    const diffActivitiesB: Record<string, string> = {};

    // Added: new에 있지만 old에 없는 요소
    for (const [id, el] of newMap) {
        if (!oldMap.has(id)) {
            changes.push({
                type: 'added',
                id,
                name: el.name,
                elementType: el.elementType,
                description: buildDescription('added', el)
            });
            diffActivitiesA[id] = 'added';
        }
    }

    // Removed: old에 있지만 new에 없는 요소
    for (const [id, el] of oldMap) {
        if (!newMap.has(id)) {
            changes.push({
                type: 'removed',
                id,
                name: el.name,
                elementType: el.elementType,
                description: buildDescription('removed', el)
            });
            diffActivitiesB[id] = 'deleted';
        }
    }

    // Modified: 양쪽에 있지만 내용이 변경된 요소
    for (const [id, newEl] of newMap) {
        const oldEl = oldMap.get(id);
        if (oldEl) {
            // Lane: flowNodeRef 변경 시 lane이 아닌 이동한 요소를 마킹
            if (newEl.elementType === 'lane') {
                const oldRefs = new Set((oldEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean));
                const newRefs = new Set((newEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean));
                // 이 lane에 새로 들어온 요소 (다른 lane에서 이동)
                for (const ref of newRefs) {
                    if (!oldRefs.has(ref) && !diffActivitiesA[ref]) {
                        const movedEl = newMap.get(ref);
                        if (movedEl) {
                            diffActivitiesA[ref] = 'modified';
                            diffActivitiesB[ref] = 'modified';
                            changes.push({
                                type: 'modified',
                                id: ref,
                                name: movedEl.name || ref,
                                elementType: movedEl.elementType,
                                description: `Moved to ${newEl.name || 'another lane'}`
                            });
                        }
                    }
                }
                // Lane 자체의 name 등 속성 변경도 체크 (flowNodeRef 제외)
                const oldLaneAttrs = { ...oldEl.attrs };
                const newLaneAttrs = { ...newEl.attrs };
                delete oldLaneAttrs['__flowNodeRefs'];
                delete newLaneAttrs['__flowNodeRefs'];
                if (JSON.stringify(oldLaneAttrs) !== JSON.stringify(newLaneAttrs)) {
                    const fieldChanges = collectModifiedFieldChanges(oldEl, newEl);
                    changes.push({
                        type: 'modified',
                        id,
                        name: newEl.name || oldEl.name,
                        elementType: newEl.elementType,
                        description: buildModifiedDescription(oldEl, newEl),
                        fieldChanges
                    });
                    diffActivitiesA[id] = 'modified';
                    diffActivitiesB[id] = 'modified';
                }
                continue;
            }

            const oldAttrs = serializeAttrs(oldEl.attrs);
            const newAttrs = serializeAttrs(newEl.attrs);
            if (oldAttrs !== newAttrs) {
                const fieldChanges = collectModifiedFieldChanges(oldEl, newEl);
                changes.push({
                    type: 'modified',
                    id,
                    name: newEl.name || oldEl.name,
                    elementType: newEl.elementType,
                    description: buildModifiedDescription(oldEl, newEl),
                    fieldChanges
                });
                diffActivitiesA[id] = 'modified';
                diffActivitiesB[id] = 'modified';
            }
        }
    }

    return { changes, diffActivitiesA, diffActivitiesB };
}
