/**
 * BPMN Diff Utility
 * VersionComparison.vue에서 추출한 공유 유틸리티
 */

export interface BpmnElement {
    id: string
    name: string
    elementType: string
    sourceRef: string
    targetRef: string
    attrs: Record<string, string>
}

export interface BpmnChange {
    type: 'added' | 'removed' | 'modified'
    id: string
    name: string
    elementType: string
    description: string
}

export interface BpmnDiffResult {
    changes: BpmnChange[]
    diffActivitiesA: Record<string, string>
    diffActivitiesB: Record<string, string>
}

const ELEMENT_TYPE_NAMES: Record<string, string> = {
    'task': 'Task',
    'userTask': 'User Task',
    'serviceTask': 'Service Task',
    'manualTask': 'Manual Task',
    'scriptTask': 'Script Task',
    'sendTask': 'Send Task',
    'receiveTask': 'Receive Task',
    'businessRuleTask': 'Business Rule Task',
    'startEvent': 'Start Event',
    'endEvent': 'End Event',
    'intermediateThrowEvent': 'Intermediate Event',
    'intermediateCatchEvent': 'Intermediate Event',
    'boundaryEvent': 'Boundary Event',
    'exclusiveGateway': 'Gateway',
    'parallelGateway': 'Gateway',
    'inclusiveGateway': 'Gateway',
    'eventBasedGateway': 'Gateway',
    'complexGateway': 'Gateway',
    'subProcess': 'Sub Process',
    'callActivity': 'Call Activity',
    'sequenceFlow': 'Sequence Flow',
    'participant': 'Participant',
    'lane': 'Lane',
}

const RELEVANT_SELECTORS = [
    'task', 'userTask', 'serviceTask', 'manualTask', 'scriptTask', 'sendTask', 'receiveTask', 'businessRuleTask',
    'startEvent', 'endEvent', 'intermediateThrowEvent', 'intermediateCatchEvent', 'boundaryEvent',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway',
    'subProcess', 'callActivity',
    'sequenceFlow',
    'participant', 'lane'
]

export function formatElementTypeName(type: string): string {
    return ELEMENT_TYPE_NAMES[type] || type
}

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'

export function extractBpmnElements(xml: string): BpmnElement[] {
    if (!xml) return []
    const elements: BpmnElement[] = []
    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(xml, 'text/xml')

        RELEVANT_SELECTORS.forEach(tag => {
            // getElementsByTagNameNS로 네임스페이스 정확히 처리
            const found = doc.getElementsByTagNameNS(BPMN_NS, tag)
            for (let i = 0; i < found.length; i++) {
                const el = found[i]
                const id = el.getAttribute('id')
                if (!id) continue
                const name = el.getAttribute('name') || ''
                const sourceRef = el.getAttribute('sourceRef') || ''
                const targetRef = el.getAttribute('targetRef') || ''
                const attrs: Record<string, string> = {}
                for (let a = 0; a < el.attributes.length; a++) {
                    const attr = el.attributes[a]
                    // id와 xmlns 관련 속성 제외
                    if (attr.name !== 'id' && !attr.name.startsWith('xmlns')) {
                        attrs[attr.name] = attr.value
                    }
                }
                // lane의 flowNodeRef 자식 요소를 attrs에 포함 (레인 멤버십 변경 감지)
                if (tag === 'lane') {
                    const flowNodeRefs = el.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef')
                    const refs: string[] = []
                    for (let r = 0; r < flowNodeRefs.length; r++) {
                        const refText = flowNodeRefs[r].textContent?.trim()
                        if (refText) refs.push(refText)
                    }
                    if (refs.length > 0) {
                        attrs['__flowNodeRefs'] = refs.sort().join(',')
                    }
                }
                elements.push({ id, name, elementType: tag, sourceRef, targetRef, attrs })
            }
        })
    } catch (e) {
        console.warn('extractBpmnElements failed:', e)
    }
    return elements
}

function buildDescription(type: string, el: BpmnElement): string {
    const typeName = formatElementTypeName(el.elementType)
    if (type === 'added') {
        if (el.elementType === 'sequenceFlow') {
            return `Added connection${el.name ? ': ' + el.name : ''}`
        }
        return `Added ${typeName.toLowerCase()}${el.name ? ': ' + el.name : ''}`
    }
    if (type === 'removed') {
        if (el.elementType === 'sequenceFlow') {
            return `Removed connection${el.name ? ': ' + el.name : ''}`
        }
        return `Removed ${typeName.toLowerCase()}${el.name ? ': ' + el.name : ''}`
    }
    return ''
}

function buildModifiedDescription(oldEl: BpmnElement, newEl: BpmnElement): string {
    const parts: string[] = []
    if (oldEl.name !== newEl.name) {
        parts.push(`Name changed: "${oldEl.name}" → "${newEl.name}"`)
    } else {
        parts.push(`Updated ${formatElementTypeName(newEl.elementType).toLowerCase()} properties`)
    }
    return parts.join('. ')
}

export function computeBpmnDiff(oldXml: string, newXml: string): BpmnDiffResult {
    const oldElements = extractBpmnElements(oldXml)
    const newElements = extractBpmnElements(newXml)

    const oldMap = new Map(oldElements.map(el => [el.id, el]))
    const newMap = new Map(newElements.map(el => [el.id, el]))

    const changes: BpmnChange[] = []
    const diffActivitiesA: Record<string, string> = {}
    const diffActivitiesB: Record<string, string> = {}

    // Added: new에 있지만 old에 없는 요소
    for (const [id, el] of newMap) {
        if (!oldMap.has(id)) {
            changes.push({
                type: 'added',
                id,
                name: el.name,
                elementType: el.elementType,
                description: buildDescription('added', el),
            })
            diffActivitiesA[id] = 'added'
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
                description: buildDescription('removed', el),
            })
            diffActivitiesB[id] = 'deleted'
        }
    }

    // Modified: 양쪽에 있지만 내용이 변경된 요소
    for (const [id, newEl] of newMap) {
        const oldEl = oldMap.get(id)
        if (oldEl) {
            // Lane: flowNodeRef 변경 시 lane이 아닌 이동한 요소를 마킹
            if (newEl.elementType === 'lane') {
                const oldRefs = new Set((oldEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean))
                const newRefs = new Set((newEl.attrs['__flowNodeRefs'] || '').split(',').filter(Boolean))
                // 이 lane에 새로 들어온 요소 (다른 lane에서 이동)
                for (const ref of newRefs) {
                    if (!oldRefs.has(ref) && !diffActivitiesA[ref]) {
                        const movedEl = newMap.get(ref)
                        if (movedEl) {
                            diffActivitiesA[ref] = 'modified'
                            diffActivitiesB[ref] = 'modified'
                            changes.push({
                                type: 'modified',
                                id: ref,
                                name: movedEl.name || ref,
                                elementType: movedEl.elementType,
                                description: `Moved to ${newEl.name || 'another lane'}`,
                            })
                        }
                    }
                }
                // Lane 자체의 name 등 속성 변경도 체크 (flowNodeRef 제외)
                const oldLaneAttrs = { ...oldEl.attrs }
                const newLaneAttrs = { ...newEl.attrs }
                delete oldLaneAttrs['__flowNodeRefs']
                delete newLaneAttrs['__flowNodeRefs']
                if (JSON.stringify(oldLaneAttrs) !== JSON.stringify(newLaneAttrs)) {
                    changes.push({
                        type: 'modified',
                        id,
                        name: newEl.name || oldEl.name,
                        elementType: newEl.elementType,
                        description: buildModifiedDescription(oldEl, newEl),
                    })
                    diffActivitiesA[id] = 'modified'
                    diffActivitiesB[id] = 'modified'
                }
                continue
            }

            const oldAttrs = JSON.stringify(oldEl.attrs)
            const newAttrs = JSON.stringify(newEl.attrs)
            if (oldAttrs !== newAttrs) {
                changes.push({
                    type: 'modified',
                    id,
                    name: newEl.name || oldEl.name,
                    elementType: newEl.elementType,
                    description: buildModifiedDescription(oldEl, newEl),
                })
                diffActivitiesA[id] = 'modified'
                diffActivitiesB[id] = 'modified'
            }
        }
    }

    return { changes, diffActivitiesA, diffActivitiesB }
}
