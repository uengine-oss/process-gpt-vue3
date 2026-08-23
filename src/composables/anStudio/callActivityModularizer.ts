/**
 * callActivityModularizer — eTOM 블록(element_ids)을 독립 BPMN 자식 프로세스로 추출(P4)하고,
 * 원본을 Call Activity 로 치환·flow 재연결(P5)하는 순수 로직.
 *
 * 설계 원칙
 *  - 결정론적 DOM 조작으로 원본 도형의 좌표/DI 를 그대로 보존해 자식 도면이 원본 부분과 동일하게 보이도록 한다.
 *  - 자식의 진입/진출은 "서브그래프 내부 차수"로 판정(내부 incoming 0 → 진입, 내부 outgoing 0 → 진출)하여
 *    외부 flow 유무와 무관하게 항상 유효한 Start/End 를 부여한다.
 *  - 다중 진입/진출은 경고만 남기고 진행한다(결정 #4). 각 경계 노드마다 Start/End 를 추가.
 *  - 생성 XML 은 헤드리스 importXML 로 사전 검증(validateBpmn)해, 깨진 BPMN 이 proc_def 로 저장되는 것을 막는다.
 */
import BpmnViewer from 'bpmn-js/lib/Viewer';
import uEngineModdleDescriptor from '@/components/descriptors/uEngine.json';
import zeebeModdleDescriptor from '@/components/descriptors/zeebe.json';
import phaseModdle from '@/assets/bpmn/phase-moddle.json';
import { splitTmfCodes } from '@/composables/blueprint/blueprintModel';
import { mergeTmfApiIntegrations } from '@/utils/apiIntegrations';

const NS = {
    bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
    dc: 'http://www.omg.org/spec/DD/20100524/DC',
    di: 'http://www.omg.org/spec/DD/20100524/DI',
    uengine: 'http://uengine'
};

export interface ChildBpmnResult {
    xml: string;
    warnings: string[];
    entryCount: number;
    exitCount: number;
    nodeCount: number;
}

export interface ChildBpmnOptions {
    name: string;
    /** 블록의 eTOM L3 Process ID — 자식 프로세스 속성(uengine json)에 저장. */
    etomProcessId?: string;
    /** 블록의 eTOM L3 카테고리명 — 자식 프로세스 속성(uengine json)에 저장. */
    etomL3?: string;
    /**
     * 멤버 요소 id → TMF Open API 코드(들). 배열 또는 콤마 구분 문자열 허용.
     * 각 태스크 속성(uengine json)의 tmf_api(콤마 결합)·tmf_apis(배열)·apiIntegrations 로 저장.
     */
    taskTmf?: Record<string, string | string[]>;
}

interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/* ----------------------------- DOM helpers ----------------------------- */

function parse(xml: string): Document | null {
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return null;
        return doc;
    } catch {
        return null;
    }
}

function escapeXmlAttr(s: string): string {
    return String(s || '').replace(
        /[&<>"]/g,
        (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c])
    );
}

function descendantsByLocal(root: Element | Document, names: string[]): Element[] {
    const set = new Set(names);
    const out: Element[] = [];
    const all = root.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const el = all[i] as Element;
        if (set.has(el.localName || '')) out.push(el);
    }
    return out;
}

function firstByLocal(root: Element | Document, name: string): Element | null {
    const all = root.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        if ((all[i] as Element).localName === name) return all[i] as Element;
    }
    return null;
}

function directChildByLocal(root: Element, name: string): Element | null {
    for (const child of Array.from(root.children)) {
        if (child.localName === name) return child;
    }
    return null;
}

function getProcess(doc: Document): Element | null {
    return firstByLocal(doc, 'process');
}

function getPlane(doc: Document): Element | null {
    return firstByLocal(doc, 'BPMNPlane');
}

function boundsOf(plane: Element, refId: string): Bounds | null {
    const shapes = descendantsByLocal(plane, ['BPMNShape']);
    for (const s of shapes) {
        if (s.getAttribute('bpmnElement') === refId) {
            const b = descendantsByLocal(s, ['Bounds'])[0];
            if (!b) return null;
            return {
                x: Number(b.getAttribute('x') || 0),
                y: Number(b.getAttribute('y') || 0),
                width: Number(b.getAttribute('width') || 0),
                height: Number(b.getAttribute('height') || 0)
            };
        }
    }
    return null;
}

function edgeWaypoints(plane: Element, refId: string): { x: number; y: number }[] {
    const edges = descendantsByLocal(plane, ['BPMNEdge']);
    for (const e of edges) {
        if (e.getAttribute('bpmnElement') === refId) {
            return descendantsByLocal(e, ['waypoint']).map((w) => ({
                x: Number(w.getAttribute('x') || 0),
                y: Number(w.getAttribute('y') || 0)
            }));
        }
    }
    return [];
}

function removeDi(plane: Element, kind: 'BPMNShape' | 'BPMNEdge', refId: string) {
    for (const el of descendantsByLocal(plane, [kind])) {
        if (el.getAttribute('bpmnElement') === refId) {
            el.parentNode?.removeChild(el);
            return;
        }
    }
}

/** entry/exit edge 의 끝점(또는 시작점) waypoint 를 CA 위치로 이동. */
function setEdgeEndpoint(plane: Element, flowId: string, which: 'first' | 'last', x: number, y: number) {
    for (const e of descendantsByLocal(plane, ['BPMNEdge'])) {
        if (e.getAttribute('bpmnElement') !== flowId) continue;
        const wps = descendantsByLocal(e, ['waypoint']);
        if (!wps.length) return;
        const wp = which === 'last' ? wps[wps.length - 1] : wps[0];
        wp.setAttribute('x', String(Math.round(x)));
        wp.setAttribute('y', String(Math.round(y)));
        return;
    }
}

function readColorRulesFrom(root: Element | null): unknown[] | null {
    if (!root) return null;
    const ext = directChildByLocal(root, 'extensionElements');
    if (!ext) return null;

    for (const props of descendantsByLocal(ext, ['properties'])) {
        const json = props.getAttribute('json');
        if (!json) continue;
        try {
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed?.colorRules) && parsed.colorRules.length > 0) return parsed.colorRules;
        } catch {
            // Ignore invalid uengine properties and keep looking.
        }
    }

    return null;
}

function getSourceColorRules(doc: Document, process: Element): unknown[] {
    const collaboration = firstByLocal(doc, 'collaboration');
    return readColorRulesFrom(collaboration) || readColorRulesFrom(process) || [];
}

function buildProcessExtensionXml(processProps: Record<string, unknown>): string {
    if (!processProps || Object.keys(processProps).length === 0) return '';
    const json = escapeXmlAttr(JSON.stringify(processProps));
    return `<bpmn:extensionElements><uengine:properties json="${json}" /></bpmn:extensionElements>`;
}

/** 요소의 uengine:properties json 속성을 콜백으로 갱신 (extensionElements/properties 가 없으면 생성). */
function patchUengineJson(doc: Document, el: Element, fn: (json: Record<string, unknown>) => void) {
    let ext = directChildByLocal(el, 'extensionElements');
    if (!ext) {
        ext = doc.createElementNS(NS.bpmn, 'bpmn:extensionElements');
        el.insertBefore(ext, el.firstChild);
    }
    let props: Element | null = null;
    for (const child of descendantsByLocal(ext, ['properties'])) {
        props = child;
        break;
    }
    if (!props) {
        props = doc.createElementNS(NS.uengine, 'uengine:properties');
        ext.appendChild(props);
    }
    let json: Record<string, unknown> = {};
    try {
        json = JSON.parse(props.getAttribute('json') || '{}') || {};
    } catch {
        json = {};
    }
    fn(json);
    props.setAttribute('json', JSON.stringify(json));
}

/** 요소의 uengine:properties json 속성에 키를 병합 (extensionElements/properties 가 없으면 생성). */
function mergeUengineJson(doc: Document, el: Element, patch: Record<string, unknown>) {
    patchUengineJson(doc, el, (json) => Object.assign(json, patch));
}

/** BPMN flow node 요소 태그(멤버 노드 판정 공용). */
const FLOW_NODE_TAGS = [
    'task',
    'userTask',
    'manualTask',
    'serviceTask',
    'scriptTask',
    'businessRuleTask',
    'sendTask',
    'receiveTask',
    'callActivity',
    'subProcess',
    'startEvent',
    'endEvent',
    'intermediateCatchEvent',
    'intermediateThrowEvent',
    'boundaryEvent',
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway',
    'eventBasedGateway',
    'complexGateway'
];

/* ----------------------------- extraction ----------------------------- */

/**
 * 원본 As-Is XML 에서 element_ids 에 해당하는 노드들을 독립 BPMN 프로세스로 추출.
 * 좌표/DI 보존, 경계 노드에 Start/End 부여, Pool(Participant)+Lane 구조로 래핑. 실패 시 null.
 */
export function buildChildBpmn(asIsXml: string, elementIds: string[], opts: ChildBpmnOptions): ChildBpmnResult | null {
    const doc = parse(asIsXml);
    if (!doc) return null;
    const process = getProcess(doc);
    const plane = getPlane(doc);
    if (!process || !plane) return null;

    const memberSet = new Set((elementIds || []).filter(Boolean));
    if (!memberSet.size) return null;
    const sourceColorRules = getSourceColorRules(doc, process);

    // 멤버 노드 DOM 수집 (flow node 만; sequenceFlow/lane 등 제외).
    const memberNodes: Element[] = [];
    for (const el of descendantsByLocal(process, FLOW_NODE_TAGS)) {
        const id = el.getAttribute('id') || '';
        if (memberSet.has(id)) memberNodes.push(el);
    }
    if (!memberNodes.length) return null;
    const memberIds = new Set(memberNodes.map((n) => n.getAttribute('id') || ''));

    const warnings: string[] = [];

    // boundaryEvent 는 host(attachedToRef)가 함께 멤버일 때만 유효 — host 가 다른 블록이면 제외해
    // 자식 BPMN 의 dangling attachedToRef(→ unresolved reference)를 방지한다.
    for (let i = memberNodes.length - 1; i >= 0; i--) {
        const n = memberNodes[i];
        if (n.localName === 'boundaryEvent' && !memberIds.has(n.getAttribute('attachedToRef') || '')) {
            memberIds.delete(n.getAttribute('id') || '');
            memberNodes.splice(i, 1);
            warnings.push('호스트가 다른 블록에 있는 경계 이벤트(boundaryEvent)를 제외했습니다.');
        }
    }
    if (!memberNodes.length) return null;

    // 내부 sequenceFlow (양 끝이 모두 멤버) 수집.
    const internalFlows: { id: string; source: string; target: string; el: Element }[] = [];
    for (const f of descendantsByLocal(process, ['sequenceFlow'])) {
        const src = f.getAttribute('sourceRef') || '';
        const tgt = f.getAttribute('targetRef') || '';
        if (memberIds.has(src) && memberIds.has(tgt)) {
            internalFlows.push({ id: f.getAttribute('id') || '', source: src, target: tgt, el: f });
        }
    }

    // 서브그래프 내부 차수 → 경계 노드.
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    for (const id of memberIds) {
        inDeg.set(id, 0);
        outDeg.set(id, 0);
    }
    for (const f of internalFlows) {
        outDeg.set(f.source, (outDeg.get(f.source) || 0) + 1);
        inDeg.set(f.target, (inDeg.get(f.target) || 0) + 1);
    }
    let entryTargets = [...memberIds].filter((id) => (inDeg.get(id) || 0) === 0);
    let exitSources = [...memberIds].filter((id) => (outDeg.get(id) || 0) === 0);

    // 순환 구조(모든 노드 in/out > 0)라 경계가 비면 임의 멤버를 진입/진출로 지정해 항상 Start/End 를 보장(빈 BPMN 방지).
    const memberList = [...memberIds];
    if (!entryTargets.length) {
        entryTargets = memberList.slice(0, 1);
        warnings.push('순환 구조라 진입점이 모호하여 첫 노드를 Start 로 지정했습니다.');
    }
    if (!exitSources.length) {
        exitSources = memberList.slice(-1);
        warnings.push('순환 구조라 진출점이 모호하여 마지막 노드를 End 로 지정했습니다.');
    }
    if (entryTargets.length > 1)
        warnings.push(`진입점이 ${entryTargets.length}개입니다(다중 진입). 각 진입 노드에 Start 를 부여하고 진행합니다.`);
    if (exitSources.length > 1)
        warnings.push(`진출점이 ${exitSources.length}개입니다(다중 진출). 각 진출 노드에 End 를 부여하고 진행합니다.`);

    const serializer = new XMLSerializer();

    // 신규 생성 id 가 원본 id 와 충돌하지 않도록 유니크 보장.
    const usedIds = new Set<string>();
    for (const el of Array.from(doc.getElementsByTagName('*'))) {
        const eid = el.getAttribute('id');
        if (eid) usedIds.add(eid);
    }
    const uid = (base: string): string => {
        let id = base;
        let n = 1;
        while (usedIds.has(id)) id = `${base}_${n++}`;
        usedIds.add(id);
        return id;
    };

    // 자식 flow 집합 (내부 + 신규 Start/End flow) — 멤버 노드 incoming/outgoing 재구성용.
    const childFlows: { id: string; source: string; target: string }[] = internalFlows.map((f) => ({
        id: f.id,
        source: f.source,
        target: f.target
    }));
    const startEvents: { id: string; flowId: string; target: string }[] = [];
    const endEvents: { id: string; flowId: string; source: string }[] = [];
    entryTargets.forEach((tgt, i) => {
        const id = uid(`StartEvent_an_${i}`);
        const flowId = uid(`Flow_an_s_${i}`);
        startEvents.push({ id, flowId, target: tgt });
        childFlows.push({ id: flowId, source: id, target: tgt });
    });
    exitSources.forEach((src, i) => {
        const id = uid(`EndEvent_an_${i}`);
        const flowId = uid(`Flow_an_e_${i}`);
        endEvents.push({ id, flowId, source: src });
        childFlows.push({ id: flowId, source: src, target: id });
    });

    /* ----- lane(swimlane) 보존 ----- */
    // 원본 process 의 laneSet 에서 "멤버를 포함하고 DI 좌표가 있는" lane 만 자식으로 보존한다.
    // (Pool/Lane 이 없어 정상 프로세스로 보기 어렵던 문제 해소)
    const laneSetEl = firstByLocal(process, 'laneSet');
    const childLanes: { id: string; name: string; isHorizontal: string; bounds: Bounds; refs: string[] }[] = [];
    const memberLaneId = new Map<string, string>();
    if (laneSetEl) {
        for (const lane of descendantsByLocal(laneSetEl, ['lane'])) {
            const lid = lane.getAttribute('id') || '';
            if (!lid) continue;
            const b = boundsOf(plane, lid);
            if (!b) continue; // DI 좌표 없는 lane 은 생략(→ "no bpmndi" 검증 실패 방지)
            // 직계 flowNodeRef 만 수집(중첩 lane 의 ref 중복 방지).
            const directRefs: string[] = [];
            for (const c of Array.from(lane.childNodes)) {
                if ((c as Element).localName === 'flowNodeRef') {
                    const t = ((c as Element).textContent || '').trim();
                    if (t) directRefs.push(t);
                }
            }
            const laneMembers = directRefs.filter((id) => memberIds.has(id));
            if (!laneMembers.length) continue;
            const isHorizontal = (() => {
                for (const s of descendantsByLocal(plane, ['BPMNShape'])) {
                    if (s.getAttribute('bpmnElement') === lid) return s.getAttribute('isHorizontal') || 'true';
                }
                return 'true';
            })();
            childLanes.push({ id: lid, name: lane.getAttribute('name') || '', isHorizontal, bounds: b, refs: [...laneMembers] });
            laneMembers.forEach((m) => memberLaneId.set(m, lid));
        }
    }
    // Start/End 이벤트를 인접 멤버(진입 target / 진출 source)의 lane 에 배정.
    if (childLanes.length) {
        const laneById = new Map(childLanes.map((l) => [l.id, l]));
        startEvents.forEach((s) => {
            const lid = memberLaneId.get(s.target);
            if (lid) laneById.get(lid)?.refs.push(s.id);
        });
        endEvents.forEach((e) => {
            const lid = memberLaneId.get(e.source);
            if (lid) laneById.get(lid)?.refs.push(e.id);
        });
    }

    // 자식 문서에 실제 존재할 모든 id (멤버 노드 + 그 하위 요소 + 자식 flow + Start/End). dangling 참조 판정용.
    const validIds = new Set<string>();
    for (const n of memberNodes) {
        const nid = n.getAttribute('id');
        if (nid) validIds.add(nid);
        for (const d of Array.from(n.getElementsByTagName('*'))) {
            const did = d.getAttribute('id');
            if (did) validIds.add(did);
        }
    }
    for (const f of childFlows) validIds.add(f.id);
    for (const s of startEvents) validIds.add(s.id);
    for (const e of endEvents) validIds.add(e.id);

    // 참조 속성이 자식 밖 id 를 가리키면 제거 → bpmn-js "unresolved reference" 방지.
    // (예: 경계 flow 로 잘린 gateway/task 의 default, 미포함 message/signal/error 정의 ref 등)
    const REF_ATTRS = [
        'default',
        'sourceRef',
        'targetRef',
        'attachedToRef',
        'messageRef',
        'signalRef',
        'errorRef',
        'escalationRef',
        'dataObjectRef'
    ];
    let prunedRefs = 0;
    const pruneDanglingRefs = (clone: Element) => {
        const all = [clone, ...(Array.from(clone.getElementsByTagName('*')) as Element[])];
        for (const el of all) {
            for (const attr of REF_ATTRS) {
                const v = el.getAttribute(attr);
                if (v && !validIds.has(v)) {
                    el.removeAttribute(attr);
                    prunedRefs++;
                }
            }
        }
        // 데이터 연관의 sourceRef/targetRef(텍스트 참조)가 자식 밖이면 연관 요소 자체 제거.
        for (const assoc of descendantsByLocal(clone, ['dataInputAssociation', 'dataOutputAssociation'])) {
            let dangling = false;
            for (const ref of descendantsByLocal(assoc, ['sourceRef', 'targetRef'])) {
                const t = (ref.textContent || '').trim();
                if (t && !validIds.has(t)) dangling = true;
            }
            if (dangling && assoc.parentNode) {
                assoc.parentNode.removeChild(assoc);
                prunedRefs++;
            }
        }
    };

    // 멤버 노드 직렬화 (incoming/outgoing 를 자식 flow 기준으로 재구성).
    const nodeXmls: string[] = [];
    for (const node of memberNodes) {
        const id = node.getAttribute('id') || '';
        const clone = node.cloneNode(true) as Element;
        // 기존 incoming/outgoing 제거 — 직계 자식만(중첩 subProcess 내부 노드의 참조는 보존).
        for (const child of Array.from(clone.childNodes)) {
            const ln = (child as Element).localName;
            if (ln === 'incoming' || ln === 'outgoing') clone.removeChild(child);
        }
        // 파티셔닝에서 추정한 TMF Open API 코드(들)를 태스크 속성(uengine json)으로 저장.
        // tmf_api(콤마 결합, 구버전 호환) + tmf_apis(배열) + API 연동 목록(apiIntegrations) 병합.
        const tmfCodes = splitTmfCodes(opts?.taskTmf?.[id]);
        if (tmfCodes.length) {
            patchUengineJson(doc, clone, (json) => {
                json.tmf_api = tmfCodes.join(', ');
                json.tmf_apis = tmfCodes;
                mergeTmfApiIntegrations(json, tmfCodes);
            });
        }
        // 자식 flow 기준으로 재부여 (incoming/outgoing 는 다른 자식 요소보다 앞에 와야 하므로 맨 앞에 삽입).
        const refs: Element[] = [];
        for (const f of childFlows) {
            if (f.target === id) {
                const inc = doc.createElementNS(NS.bpmn, 'bpmn:incoming');
                inc.textContent = f.id;
                refs.push(inc);
            }
        }
        for (const f of childFlows) {
            if (f.source === id) {
                const out = doc.createElementNS(NS.bpmn, 'bpmn:outgoing');
                out.textContent = f.id;
                refs.push(out);
            }
        }
        // extensionElements 다음, 그 외 요소 앞에 오도록 단순히 맨 앞(또는 extensionElements 뒤)에 삽입.
        const ext = descendantsByLocal(clone, ['extensionElements'])[0];
        const anchor = ext && ext.parentNode === clone ? ext.nextSibling : clone.firstChild;
        for (const r of refs) clone.insertBefore(r, anchor);
        pruneDanglingRefs(clone);
        nodeXmls.push(serializer.serializeToString(clone));
    }
    if (prunedRefs) warnings.push(`자식 프로세스 밖을 가리키는 참조 ${prunedRefs}건을 정리했습니다.`);
    if (childLanes.length) warnings.push(`스윔레인(Lane) ${childLanes.length}개를 보존했습니다.`);

    // 내부 flow 직렬화 (원본 그대로).
    const flowXmls: string[] = internalFlows.map((f) => serializer.serializeToString(f.el));
    // Start/End event + 신규 flow.
    for (const s of startEvents) {
        nodeXmls.push(`<bpmn:startEvent id="${s.id}" name="Start"><bpmn:outgoing>${s.flowId}</bpmn:outgoing></bpmn:startEvent>`);
        flowXmls.push(`<bpmn:sequenceFlow id="${s.flowId}" sourceRef="${s.id}" targetRef="${s.target}" />`);
    }
    for (const e of endEvents) {
        nodeXmls.push(`<bpmn:endEvent id="${e.id}" name="End"><bpmn:incoming>${e.flowId}</bpmn:incoming></bpmn:endEvent>`);
        flowXmls.push(`<bpmn:sequenceFlow id="${e.flowId}" sourceRef="${e.source}" targetRef="${e.id}" />`);
    }

    /* ----- DI 구성 ----- */
    const diShapes: string[] = [];
    const diEdges: string[] = [];
    // Pool(Participant) 바운딩 계산용 콘텐츠 bbox (멤버 + 신규 Start/End).
    let contentMinX = Infinity;
    let contentMinY = Infinity;
    let contentMaxX = -Infinity;
    let contentMaxY = -Infinity;
    const growContent = (bx: number, by: number, bw: number, bh: number) => {
        contentMinX = Math.min(contentMinX, bx);
        contentMinY = Math.min(contentMinY, by);
        contentMaxX = Math.max(contentMaxX, bx + bw);
        contentMaxY = Math.max(contentMaxY, by + bh);
    };
    for (const id of memberIds) {
        const b = boundsOf(plane, id);
        if (!b) continue; // 좌표 없는 멤버는 DI 생략(bpmn-js 가 위치만 비워도 import 는 가능)
        growContent(b.x, b.y, b.width, b.height);
        diShapes.push(
            `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" /></bpmndi:BPMNShape>`
        );
    }
    for (const f of internalFlows) {
        const wps = edgeWaypoints(plane, f.id);
        if (wps.length < 2) continue;
        const wpXml = wps.map((w) => `<di:waypoint x="${w.x}" y="${w.y}" />`).join('');
        diEdges.push(`<bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">${wpXml}</bpmndi:BPMNEdge>`);
    }
    // Start/End DI: 경계 노드 좌표 기준으로 배치.
    startEvents.forEach((s) => {
        const tb = boundsOf(plane, s.target);
        const ex = tb ? tb.x - 80 : 120;
        const ey = tb ? tb.y + tb.height / 2 - 18 : 120;
        growContent(ex, ey, 36, 36);
        diShapes.push(
            `<bpmndi:BPMNShape id="${s.id}_di" bpmnElement="${s.id}"><dc:Bounds x="${ex}" y="${ey}" width="36" height="36" /></bpmndi:BPMNShape>`
        );
        const sx = ex + 36;
        const sy = ey + 18;
        const tx = tb ? tb.x : ex + 80;
        const ty = tb ? tb.y + tb.height / 2 : sy;
        diEdges.push(
            `<bpmndi:BPMNEdge id="${s.flowId}_di" bpmnElement="${s.flowId}"><di:waypoint x="${sx}" y="${sy}" /><di:waypoint x="${tx}" y="${ty}" /></bpmndi:BPMNEdge>`
        );
    });
    endEvents.forEach((e) => {
        const sb = boundsOf(plane, e.source);
        const ex = sb ? sb.x + sb.width + 44 : 320;
        const ey = sb ? sb.y + sb.height / 2 - 18 : 120;
        growContent(ex, ey, 36, 36);
        diShapes.push(
            `<bpmndi:BPMNShape id="${e.id}_di" bpmnElement="${e.id}"><dc:Bounds x="${ex}" y="${ey}" width="36" height="36" /></bpmndi:BPMNShape>`
        );
        const sx = sb ? sb.x + sb.width : ex - 44;
        const sy = sb ? sb.y + sb.height / 2 : ey + 18;
        diEdges.push(
            `<bpmndi:BPMNEdge id="${e.flowId}_di" bpmnElement="${e.flowId}"><di:waypoint x="${sx}" y="${sy}" /><di:waypoint x="${ex}" y="${
                ey + 18
            }" /></bpmndi:BPMNEdge>`
        );
    });

    // laneSet(swimlane) XML — process 의 flowElement 앞에 와야 한다(XSD 순서: laneSet* → flowElement*).
    const laneSetXml = childLanes.length
        ? [
              `<bpmn:laneSet id="LaneSet_an_child">`,
              ...childLanes.map(
                  (l) =>
                      `      <bpmn:lane id="${l.id}"${l.name ? ` name="${escapeXmlAttr(l.name)}"` : ''}>` +
                      l.refs.map((r) => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('') +
                      `</bpmn:lane>`
              ),
              `    </bpmn:laneSet>`
          ].join('\n')
        : '';
    // lane DI — 노드보다 먼저(뒤 레이어) 배치해야 노드가 lane 위에 렌더된다.
    const laneDiShapes: string[] = childLanes.map(
        (l) =>
            `<bpmndi:BPMNShape id="${l.id}_di" bpmnElement="${l.id}" isHorizontal="${l.isHorizontal}"><dc:Bounds x="${l.bounds.x}" y="${l.bounds.y}" width="${l.bounds.width}" height="${l.bounds.height}" /></bpmndi:BPMNShape>`
    );

    const procId = 'Process_an_child';
    const collabId = 'Collaboration_an_child';
    const participantId = 'Participant_an_child';
    const procName = escapeXmlAttr(opts?.name || '');

    // Pool(Participant) 바운딩 — lane 이 있으면 lane 합집합(+콘텐츠), 없으면 콘텐츠 bbox 에 여백.
    // 좌측 30px 는 pool 라벨 밴드. (lane 만 있고 pool 이 없어 비정상 도면으로 보이던 문제 해소)
    const hasContent = contentMinX !== Infinity;
    const unionBounds = (a: Bounds, b: Bounds): Bounds => {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        return {
            x,
            y,
            width: Math.max(a.x + a.width, b.x + b.width) - x,
            height: Math.max(a.y + a.height, b.y + b.height) - y
        };
    };
    let poolBounds: Bounds | null = null;
    if (childLanes.length) {
        let u = childLanes[0].bounds;
        for (let i = 1; i < childLanes.length; i++) u = unionBounds(u, childLanes[i].bounds);
        if (hasContent) {
            u = unionBounds(u, {
                x: contentMinX,
                y: contentMinY,
                width: contentMaxX - contentMinX,
                height: contentMaxY - contentMinY
            });
        }
        poolBounds = { x: u.x - 30, y: u.y, width: u.width + 30, height: u.height };
    } else if (hasContent) {
        poolBounds = {
            x: contentMinX - 60,
            y: contentMinY - 40,
            width: contentMaxX - contentMinX + 100,
            height: contentMaxY - contentMinY + 80
        };
    }

    // 프로세스 속성(uengine json): colorRules + eTOM/TMF 매핑 메타.
    const processProps: Record<string, unknown> = {};
    if (sourceColorRules.length) processProps.colorRules = sourceColorRules;
    const etomProcessId = String(opts?.etomProcessId || '').trim();
    const etomL3 = String(opts?.etomL3 || '').trim();
    const tmfApis = Array.from(new Set(Object.values(opts?.taskTmf || {}).flatMap((v) => splitTmfCodes(v))));
    if (etomProcessId) processProps.etom_process_id = etomProcessId;
    if (etomL3) processProps.etom_l3 = etomL3;
    if (tmfApis.length) processProps.tmf_apis = tmfApis;
    const processExtXml = buildProcessExtensionXml(processProps);

    // 확장 namespace 는 descriptor 의 prefix/uri 에서 동적으로 선언(클론 노드의 uengine/zeebe/phase 접두사 미선언 방지).
    const extNs = [uEngineModdleDescriptor, zeebeModdleDescriptor, phaseModdle]
        .map((d: any) => (d && d.prefix && d.uri ? `xmlns:${d.prefix}="${d.uri}"` : ''))
        .filter(Boolean)
        .join(' ');
    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<bpmn:definitions xmlns:bpmn="${NS.bpmn}" xmlns:bpmndi="${NS.bpmndi}" xmlns:dc="${NS.dc}" xmlns:di="${NS.di}" ${extNs} id="Definitions_an_child" targetNamespace="http://bpmn.io/schema/bpmn">`,
        ...(poolBounds
            ? [
                  `  <bpmn:collaboration id="${collabId}">`,
                  `    <bpmn:participant id="${participantId}"${procName ? ` name="${procName}"` : ''} processRef="${procId}" />`,
                  '  </bpmn:collaboration>'
              ]
            : []),
        `  <bpmn:process id="${procId}"${procName ? ` name="${procName}"` : ''} isExecutable="false">`,
        ...(processExtXml ? ['    ' + processExtXml] : []),
        ...(laneSetXml ? ['    ' + laneSetXml] : []),
        ...nodeXmls.map((s) => '    ' + s),
        ...flowXmls.map((s) => '    ' + s),
        '  </bpmn:process>',
        '  <bpmndi:BPMNDiagram id="BPMNDiagram_an_child">',
        `    <bpmndi:BPMNPlane id="BPMNPlane_an_child" bpmnElement="${poolBounds ? collabId : procId}">`,
        ...(poolBounds
            ? [
                  `      <bpmndi:BPMNShape id="${participantId}_di" bpmnElement="${participantId}" isHorizontal="true"><dc:Bounds x="${poolBounds.x}" y="${poolBounds.y}" width="${poolBounds.width}" height="${poolBounds.height}" /></bpmndi:BPMNShape>`
              ]
            : []),
        ...laneDiShapes.map((s) => '      ' + s),
        ...diShapes.map((s) => '      ' + s),
        ...diEdges.map((s) => '      ' + s),
        '    </bpmndi:BPMNPlane>',
        '  </bpmndi:BPMNDiagram>',
        '</bpmn:definitions>'
    ].join('\n');

    return { xml, warnings, entryCount: entryTargets.length, exitCount: exitSources.length, nodeCount: memberNodes.length };
}

/* --------------------------- original rewire --------------------------- */

export interface RewireReplacement {
    element_ids: string[];
    name: string;
    called_def_id: string;
    etom_process_id?: string;
    /** 블록 태스크들에 매핑된 TMF Open API 코드 — CA 요소 속성(uengine json)으로 저장. */
    tmf_apis?: string[];
}

export interface RewireResult {
    xml: string;
    warnings: string[];
    replaced: number;
}

/**
 * 원본 As-Is XML 에서 각 블록의 멤버 노드를 삭제하고 그 자리에 Call Activity 1개를 삽입한다(P5/Task 3-3).
 *  - 내부 flow 는 삭제, 진입 flow(외부→멤버)는 targetRef 를, 진출 flow(멤버→외부)는 sourceRef 를 CA 로 재배선.
 *  - 다중 진입/진출은 단일 CA 로 모으고 경고를 남긴다(결정 #4).
 *  - 블록 간 연결(A멤버→B멤버)은 순차 처리로 CA_A→CA_B 로 자연스럽게 이어진다.
 * 결과는 호출부에서 definition.tobe 에만 저장한다(live proc_def.bpmn 미변경, 결정 #5).
 */
export function rewireOriginalBpmn(asIsXml: string, replacements: RewireReplacement[]): RewireResult | null {
    const doc = parse(asIsXml);
    if (!doc) return null;
    const process = getProcess(doc);
    const plane = getPlane(doc);
    if (!process || !plane) return null;

    const warnings: string[] = [];
    let replaced = 0;

    (replacements || []).forEach((rep, idx) => {
        const memberSet = new Set((rep.element_ids || []).filter(Boolean));
        if (!memberSet.size) return;

        // 실제 존재하는 멤버 flow node.
        const memberNodeIds = new Set<string>();
        for (const el of descendantsByLocal(process, FLOW_NODE_TAGS)) {
            const id = el.getAttribute('id') || '';
            if (memberSet.has(id)) memberNodeIds.add(id);
        }
        if (!memberNodeIds.size) return;

        // 멤버에 부착된 boundaryEvent 도 함께 삭제 대상에 포함(원본에 attachedToRef dangling 방지).
        // 이후 flow 분류·삭제 로직이 boundaryEvent 와 그 예외 flow 를 함께 처리한다.
        for (const be of descendantsByLocal(process, ['boundaryEvent'])) {
            const att = be.getAttribute('attachedToRef') || '';
            if (memberNodeIds.has(att)) memberNodeIds.add(be.getAttribute('id') || '');
        }

        // CA 위치 = 멤버 DI 바운딩 박스 중심.
        const caW = 100;
        const caH = 80;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let hasBounds = false;
        for (const id of memberNodeIds) {
            const b = boundsOf(plane, id);
            if (!b) continue;
            hasBounds = true;
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        const caX = hasBounds ? Math.round((minX + maxX) / 2 - caW / 2) : 200 + idx * 160;
        const caY = hasBounds ? Math.round((minY + maxY) / 2 - caH / 2) : 160;
        const caId = `CallActivity_an_${idx}`;

        // flow 분류 + 재배선.
        const entryFlowIds: string[] = [];
        const exitFlowIds: string[] = [];
        const internalFlowEls: Element[] = [];
        for (const f of descendantsByLocal(process, ['sequenceFlow'])) {
            const fid = f.getAttribute('id') || '';
            const src = f.getAttribute('sourceRef') || '';
            const tgt = f.getAttribute('targetRef') || '';
            const sIn = memberNodeIds.has(src);
            const tIn = memberNodeIds.has(tgt);
            if (sIn && tIn) {
                internalFlowEls.push(f);
            } else if (!sIn && tIn) {
                f.setAttribute('targetRef', caId);
                entryFlowIds.push(fid);
                setEdgeEndpoint(plane, fid, 'last', caX, caY + caH / 2);
            } else if (sIn && !tIn) {
                f.setAttribute('sourceRef', caId);
                exitFlowIds.push(fid);
                setEdgeEndpoint(plane, fid, 'first', caX + caW, caY + caH / 2);
            }
        }
        if (entryFlowIds.length > 1)
            warnings.push(`${rep.name}: 진입 flow ${entryFlowIds.length}개가 하나의 Call Activity 로 모입니다(다중 진입).`);
        if (exitFlowIds.length > 1)
            warnings.push(`${rep.name}: 진출 flow ${exitFlowIds.length}개가 하나의 Call Activity 에서 나갑니다(다중 진출).`);

        // 내부 flow 삭제(+DI).
        for (const f of internalFlowEls) {
            removeDi(plane, 'BPMNEdge', f.getAttribute('id') || '');
            f.parentNode?.removeChild(f);
        }
        // laneSet 의 멤버 flowNodeRef 제거(+CA 를 넣을 lane 기억).
        let targetLane: Element | null = null;
        for (const ref of descendantsByLocal(process, ['flowNodeRef'])) {
            const t = (ref.textContent || '').trim();
            if (memberNodeIds.has(t)) {
                if (!targetLane) targetLane = ref.parentNode as Element;
                ref.parentNode?.removeChild(ref);
            }
        }
        // 멤버 노드 삭제(+DI shape).
        for (const el of descendantsByLocal(process, FLOW_NODE_TAGS)) {
            const id = el.getAttribute('id') || '';
            if (memberNodeIds.has(id)) {
                removeDi(plane, 'BPMNShape', id);
                el.parentNode?.removeChild(el);
            }
        }

        // Call Activity 요소 생성.
        const ca = doc.createElementNS(NS.bpmn, 'bpmn:callActivity');
        ca.setAttribute('id', caId);
        ca.setAttribute('name', rep.name || 'Call Activity');
        if (rep.called_def_id) ca.setAttribute('calledElement', rep.called_def_id);
        // eTOM/TMF 매핑을 CA 속성(uengine json)으로 저장 — extensionElements 는 incoming/outgoing 앞이어야 한다.
        const caTmfApis = Array.from(new Set((rep.tmf_apis || []).map((v) => String(v || '').trim()).filter(Boolean)));
        if (rep.etom_process_id || caTmfApis.length) {
            const caProps: Record<string, unknown> = {};
            if (rep.etom_process_id) caProps.etom_process_id = rep.etom_process_id;
            if (caTmfApis.length) caProps.tmf_apis = caTmfApis;
            mergeUengineJson(doc, ca, caProps);
        }
        for (const fid of entryFlowIds) {
            const inc = doc.createElementNS(NS.bpmn, 'bpmn:incoming');
            inc.textContent = fid;
            ca.appendChild(inc);
        }
        for (const fid of exitFlowIds) {
            const out = doc.createElementNS(NS.bpmn, 'bpmn:outgoing');
            out.textContent = fid;
            ca.appendChild(out);
        }
        process.appendChild(ca);
        if (targetLane) {
            const ref = doc.createElementNS(NS.bpmn, 'bpmn:flowNodeRef');
            ref.textContent = caId;
            targetLane.appendChild(ref);
        }

        // CA DI shape.
        const shape = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNShape');
        shape.setAttribute('id', `${caId}_di`);
        shape.setAttribute('bpmnElement', caId);
        const b = doc.createElementNS(NS.dc, 'dc:Bounds');
        b.setAttribute('x', String(caX));
        b.setAttribute('y', String(caY));
        b.setAttribute('width', String(caW));
        b.setAttribute('height', String(caH));
        shape.appendChild(b);
        plane.appendChild(shape);

        replaced += 1;
    });

    if (!replaced) return null;
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc.documentElement);
    return { xml, warnings, replaced };
}

/* ----------------------------- validation ----------------------------- */

/**
 * 헤드리스 importXML 로 BPMN 유효성(요소/참조/DI) 검증. 깨진 XML 이 proc_def 로 저장되는 것을 차단.
 */
export async function validateBpmn(xml: string): Promise<{ ok: boolean; error?: string }> {
    if (!xml) return { ok: false, error: 'empty xml' };
    let viewer: any = null;
    let container: HTMLElement | null = null;
    try {
        // 분리된(detached) 컨테이너를 줘서 canvas 렌더 단계에서 정상 XML 이 실패하지 않도록 함.
        container = document.createElement('div');
        viewer = new BpmnViewer({
            container,
            moddleExtensions: { uengine: uEngineModdleDescriptor, zeebe: zeebeModdleDescriptor, phase: phaseModdle }
        });
        const result = await viewer.importXML(xml);
        const warnings = (result && result.warnings) || [];
        // 치명 경고(미해결 참조 등)는 막고, 라벨 등 경미한 경고는 통과.
        const fatal = warnings.filter((w: any) => /unresolved|unknown type|failed to|no bpmndi/i.test(String(w?.message || w)));
        return fatal.length ? { ok: false, error: fatal.map((w: any) => w.message || String(w)).join('; ') } : { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'importXML failed' };
    } finally {
        try {
            viewer?.destroy();
        } catch {
            /* noop */
        }
        try {
            container?.remove();
        } catch {
            /* noop */
        }
    }
}

/* ----------------------------- id helper ------------------------------ */

/** 그룹명 + (선택) eTOM ID 로 자식 proc_def id 생성. handleAddCallActivitySub 의 slug 규칙 답습. */
export function makeChildDefId(name: string, etomProcessId?: string): string {
    const slug = String(name || 'module')
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const etom = (etomProcessId || '').replace(/[^a-z0-9.]/gi, '');
    const stamp = Date.now();
    return `ca-${etom ? etom + '-' : ''}${slug || 'module'}-${stamp}`;
}
