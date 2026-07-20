/**
 * BPMN 부분 병합 유틸리티 (bpmn-selective-merge-engine)
 *
 * computeBpmnDiff(useBpmnDiff.ts)가 계산한 changes[] 중 사용자가 선택한 노드만
 * beforeXml에 반영해 최종 BPMN XML을 만든다. beforeXml을 기준 문서로 삼아 요소 단위로
 * patch하는 방식이라(전체 재생성 아님) 레이아웃/ID/선택되지 않은 요소는 그대로 보존된다.
 *
 * 사용 위치: src/components/ui/ProcessFeedbackCompare.vue
 */

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

function parseXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const error = doc.getElementsByTagName('parsererror')[0];
    if (error) {
        throw new Error('BPMN XML 파싱 실패: ' + error.textContent);
    }
    return doc;
}

function findElementById(doc, id) {
    if (!id) return null;
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
        if (node.getAttribute && node.getAttribute('id') === id) return node;
        node = walker.nextNode();
    }
    return null;
}

function findElementsByAttr(doc, attrName, value) {
    const results = [];
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
        if (node.getAttribute && node.getAttribute(attrName) === value) results.push(node);
        node = walker.nextNode();
    }
    return results;
}

function childrenByLocalName(el, localName) {
    return Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.localName === localName);
}

function getDepth(doc, id) {
    let el = findElementById(doc, id);
    let depth = 0;
    while (el && el.parentNode && el.parentNode.nodeType === 1) {
        depth++;
        el = el.parentNode;
    }
    return depth;
}

function findPlane(doc) {
    const planes = doc.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/DI', 'BPMNPlane');
    return planes[0] || null;
}

/** afterDoc에서 nodeId가 속한 lane을 찾아, beforeDoc의 동일 id lane에 flowNodeRef를 추가한다. */
function addToLaneMembership(beforeDoc, afterDoc, nodeId) {
    const afterLanes = Array.from(afterDoc.getElementsByTagNameNS(BPMN_NS, 'lane'));
    const ownerLane = afterLanes.find((lane) =>
        childrenByLocalName(lane, 'flowNodeRef').some((ref) => ref.textContent.trim() === nodeId)
    );
    if (!ownerLane) return;
    const laneId = ownerLane.getAttribute('id');
    const beforeLane = findElementById(beforeDoc, laneId);
    if (!beforeLane) return;
    const already = childrenByLocalName(beforeLane, 'flowNodeRef').some((ref) => ref.textContent.trim() === nodeId);
    if (already) return;
    const ref = beforeDoc.createElementNS(BPMN_NS, 'bpmn:flowNodeRef');
    ref.textContent = nodeId;
    beforeLane.appendChild(ref);
}

/** beforeDoc의 모든 lane에서 nodeId에 대한 flowNodeRef를 제거한다. */
function removeFromAllLanes(beforeDoc, nodeId) {
    const lanes = Array.from(beforeDoc.getElementsByTagNameNS(BPMN_NS, 'lane'));
    lanes.forEach((lane) => {
        childrenByLocalName(lane, 'flowNodeRef').forEach((ref) => {
            if (ref.textContent.trim() === nodeId) lane.removeChild(ref);
        });
    });
}

/** modified 노드의 레인 소속을 afterDoc 기준으로 재동기화한다(레인 이동 반영). */
function syncNodeLaneMembership(beforeDoc, afterDoc, nodeId) {
    removeFromAllLanes(beforeDoc, nodeId);
    addToLaneMembership(beforeDoc, afterDoc, nodeId);
}

function copyDiagramElements(beforeDoc, afterDoc, id) {
    const plane = findPlane(beforeDoc);
    if (!plane) return;
    const diEls = findElementsByAttr(afterDoc, 'bpmnElement', id);
    diEls.forEach((diEl) => {
        const existing = findElementsByAttr(beforeDoc, 'bpmnElement', id);
        existing.forEach((e) => e.parentNode && e.parentNode.removeChild(e));
        plane.appendChild(beforeDoc.importNode(diEl, true));
    });
}

function removeDiagramElements(beforeDoc, id) {
    findElementsByAttr(beforeDoc, 'bpmnElement', id).forEach((el) => {
        if (el.parentNode) el.parentNode.removeChild(el);
    });
}

function addElement(beforeDoc, afterDoc, id) {
    const afterEl = findElementById(afterDoc, id);
    if (!afterEl) return;
    if (findElementById(beforeDoc, id)) return; // 이미 존재하면 건너뜀(중복 방지)

    const parent = afterEl.parentNode;
    const parentId = parent && parent.nodeType === 1 ? parent.getAttribute('id') : null;
    let beforeParent = parentId ? findElementById(beforeDoc, parentId) : null;
    if (!beforeParent) {
        beforeParent = beforeDoc.getElementsByTagNameNS(BPMN_NS, 'process')[0];
    }
    if (!beforeParent) return;

    beforeParent.appendChild(beforeDoc.importNode(afterEl, true));
    copyDiagramElements(beforeDoc, afterDoc, id);
    addToLaneMembership(beforeDoc, afterDoc, id);
}

// beforeEl을 afterEl로 통째로 치환한다(속성 patch가 아니라 노드 자체를 교체).
// 요소 타입 자체가 바뀌는 경우(예: adHocSubProcess -> subProcess처럼 태그명이 달라지는 변경)에도
// attribute만 덮어써서는 태그명을 바꿀 수 없으므로, 반드시 노드를 교체해야 정확히 반영된다.
// 레이아웃(bpmndi:BPMNShape/BPMNEdge)은 별도 트리라 영향을 받지 않아 beforeXml의 배치가 유지된다.
function modifyElement(beforeDoc, afterDoc, id) {
    const beforeEl = findElementById(beforeDoc, id);
    const afterEl = findElementById(afterDoc, id);
    if (!beforeEl || !afterEl || !beforeEl.parentNode) return;

    beforeEl.parentNode.replaceChild(beforeDoc.importNode(afterEl, true), beforeEl);
    syncNodeLaneMembership(beforeDoc, afterDoc, id);
}

function removeElement(beforeDoc, id) {
    const el = findElementById(beforeDoc, id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    removeDiagramElements(beforeDoc, id);
    removeFromAllLanes(beforeDoc, id);
}

/**
 * @param {string} beforeXml 현재(원본) BPMN XML
 * @param {string} afterXml 개선안 BPMN XML
 * @param {Array<{type: 'added'|'modified'|'removed', id: string}>} changes computeBpmnDiff 결과
 * @param {Set<string>|string[]} selectedIds 반영할 노드 ID
 * @returns {string} beforeXml에 선택된 변경만 병합한 최종 BPMN XML
 */
export function applySelectedChanges(beforeXml, afterXml, changes, selectedIds) {
    if (!beforeXml) return afterXml;
    if (!afterXml || !changes || changes.length === 0) return beforeXml;

    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    const beforeDoc = parseXml(beforeXml);
    const afterDoc = parseXml(afterXml);

    const added = changes.filter((c) => c.type === 'added' && selected.has(c.id));
    const modified = changes.filter((c) => c.type === 'modified' && selected.has(c.id));
    const removed = changes.filter((c) => c.type === 'removed' && selected.has(c.id));

    // 부모 컨테이너가 먼저 처리되도록 얕은 요소부터 처리(added: 먼저 삽입돼야 자식이 들어갈 자리가 생김,
    // modified: 부모를 통째로 치환한 뒤 자식을 다시 치환해도 동일 결과라 안전하지만 얕은 순서가 더 직관적)
    added
        .map((c) => ({ c, depth: getDepth(afterDoc, c.id) }))
        .sort((a, b) => a.depth - b.depth)
        .forEach(({ c }) => addElement(beforeDoc, afterDoc, c.id));

    modified
        .map((c) => ({ c, depth: getDepth(afterDoc, c.id) }))
        .sort((a, b) => a.depth - b.depth)
        .forEach(({ c }) => modifyElement(beforeDoc, afterDoc, c.id));

    removed.forEach((c) => removeElement(beforeDoc, c.id));

    return new XMLSerializer().serializeToString(beforeDoc);
}
