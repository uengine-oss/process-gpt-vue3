/**
 * @deprecated specs/002 — src/lib/processKg 로 대체됨(다음 정리 시 삭제 예정).
 * 대체 경로: src/lib/processKg/parser/parseBpmnXml.ts (canonical BPMN 파서).
 *
 * bpmnOntologyParser — proc_def.bpmn(XML)에서 온톨로지 매퍼 입력을 추출하는 DOMParser 파서.
 *
 * bpmnModelService.parseBpmnXml 는 lane 멤버십을 DB 저장 이후에만 채우므로(순수 파싱 시 lane_id 유실),
 * 온톨로지 용도로는 별도 파서를 둔다. bpmnTaskExtractor / piFlagParser 와 동일하게 브라우저 DOMParser 사용.
 *
 * 추출:
 *  - nodes: activity(task 계열/callActivity/subProcess) + gateway + event (흐름 축약용)
 *  - lanes: <*:lane> + flowNodeRef 멤버십(node → lane)
 *  - links: <*:sequenceFlow> (sourceRef → targetRef)
 *  - properties: 각 노드 extensionElements 의 usesSystem / hasManual(Confluence URL)
 */
import type { OntologyParseInput, OntologyParseLane, OntologyParseLink, OntologyParseNode } from './ontologyTypes';

const FLOWNODE_RE = /Task$|^task$|callActivity|subProcess|Gateway$|Event$/;

/** extensionElements 에서 usesSystem / hasManual 등 커스텀 속성을 관대하게 추출. */
function readExtensionProps(el: Element): Record<string, string> {
    const props: Record<string, string> = {};
    const ext = Array.from(el.children).find((c) => c.localName === 'extensionElements');
    if (!ext) return props;

    // (a) <...:property name="usesSystem" value="SAP"/> 형태(camunda/uengine 스타일)
    for (const p of Array.from(ext.getElementsByTagName('*'))) {
        if ((p.localName || '').toLowerCase() !== 'property') continue;
        const name = p.getAttribute('name');
        const value = p.getAttribute('value') ?? p.textContent ?? '';
        if (name && value != null && String(value).trim() !== '') props[name] = String(value).trim();
    }

    // (b) extensionElements 텍스트(uengine properties JSON 등)에서 관심 키를 직접 매칭
    const text = (ext.textContent || '').trim();
    for (const key of ['usesSystem', 'uses_system', 'hasManual', 'has_manual', 'confluenceUrl', 'manualUrl', 'lifecycle']) {
        if (props[key] != null) continue;
        const m = new RegExp(`["']${key}["']\\s*:\\s*["']([^"']+)["']`).exec(text);
        if (m) props[key] = m[1];
    }
    return props;
}

/**
 * BPMN XML → 온톨로지 매퍼 입력. 파싱 실패 시 빈 입력 반환(에러를 던지지 않음 — 개별 모델 스킵).
 */
export function parseBpmnToOntologyInput(xml: string): OntologyParseInput {
    const empty: OntologyParseInput = { nodes: [], lanes: [], links: [] };
    if (!xml || !xml.trim()) return empty;

    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(xml, 'application/xml');
    } catch {
        return empty;
    }
    if (doc.getElementsByTagName('parsererror').length > 0) return empty;

    const all = Array.from(doc.getElementsByTagName('*'));

    // 1) lanes + flowNodeRef 멤버십
    const lanes: OntologyParseLane[] = [];
    const nodeToLane = new Map<string, string>();
    for (const el of all) {
        if ((el.localName || '') !== 'lane') continue;
        const laneId = el.getAttribute('id') || '';
        if (!laneId) continue;
        lanes.push({ element_id: laneId, name: el.getAttribute('name'), properties: readExtensionProps(el) });
        for (const ref of Array.from(el.children)) {
            if ((ref.localName || '') === 'flowNodeRef') {
                const nodeId = (ref.textContent || '').trim();
                if (nodeId) nodeToLane.set(nodeId, laneId);
            }
        }
    }

    // 2) flow nodes (activity/gateway/event)
    const nodes: OntologyParseNode[] = [];
    const seen = new Set<string>();
    for (const el of all) {
        const ln = el.localName || '';
        if (!FLOWNODE_RE.test(ln)) continue;
        const id = el.getAttribute('id') || '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        nodes.push({
            element_id: id,
            element_type: ln,
            name: (el.getAttribute('name') || '').replace(/\s+/g, ' ').trim() || null,
            lane_id: nodeToLane.get(id) || null,
            properties: readExtensionProps(el)
        });
    }

    // 3) sequenceFlows
    const links: OntologyParseLink[] = [];
    for (const el of all) {
        if ((el.localName || '') !== 'sequenceFlow') continue;
        const source = el.getAttribute('sourceRef') || '';
        const target = el.getAttribute('targetRef') || '';
        if (source && target) links.push({ source_element_id: source, target_element_id: target });
    }

    return { nodes, lanes, links };
}
