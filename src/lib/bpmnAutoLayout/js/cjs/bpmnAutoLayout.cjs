"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBpmnLayout = computeBpmnLayout;
exports.autoLayoutBpmnXml = autoLayoutBpmnXml;
exports.isOrthogonalPath = isOrthogonalPath;
/* ------------------------------------------------------------------ */
/* 상수                                                                 */
/* ------------------------------------------------------------------ */
const TASK_W = 100;
const TASK_H = 80;
const GATEWAY_SIZE = 50;
const EVENT_SIZE = 36;
const H_GAP = 60; // 열 사이 여백
const V_GAP = 30; // 행 사이 여백
const LANE_PAD_Y = 20; // 레인 위/아래 여백
const LANE_PAD_X = 40; // 레인 왼쪽(라벨 옆)/오른쪽 여백
const LANE_LABEL_W = 30; // 참여자 라벨 폭 (bpmn-js 기본)
const LANE_MIN_H = 120;
const SUBPROCESS_PAD = 30;
const ANNOTATION_W = 120;
const ANNOTATION_H = 50;
const DATA_W = 36;
const DATA_H = 50;
const DATA_LABEL_H = 20; // 데이터 객체 이름 라벨 높이
const DATA_SIDE_GAP = 60; // 같은 노드에 붙은 데이터 객체 가로 간격(라벨 겹침 방지)
const PROCESS_GAP = 60; // 참여자(프로세스) 사이 세로 간격
const TASK_TYPES = new Set([
    'task',
    'userTask',
    'serviceTask',
    'manualTask',
    'scriptTask',
    'businessRuleTask',
    'sendTask',
    'receiveTask',
    'callActivity'
]);
const CONTAINER_TYPES = new Set(['subProcess', 'adHocSubProcess', 'transaction']);
const GATEWAY_TYPES = new Set(['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway']);
const EVENT_TYPES = new Set(['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent']);
const BOUNDARY = 'boundaryEvent';
const PROCESS_TYPES = new Set(['process', ...CONTAINER_TYPES]);
const ARTIFACT_TYPES = new Set(['textAnnotation', 'dataObjectReference', 'dataStoreReference']);
const NS_BPMNDI = 'http://www.omg.org/spec/BPMN/20100524/DI';
const NS_DC = 'http://www.omg.org/spec/DD/20100524/DC';
const NS_DI = 'http://www.omg.org/spec/DD/20100524/DI';
/* ------------------------------------------------------------------ */
/* 토크나이저                                                           */
/* ------------------------------------------------------------------ */
const TAG_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/)?(?:([\w.-]+):)?([\w.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/)?>/g;
function attr(attrs, name) {
    const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
    return decodeEntities(m ? m[1] ?? m[2] ?? '' : '');
}
function decodeEntities(v) {
    return String(v || '')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
function escapeAttr(v) {
    return String(v || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function parseModel(xml) {
    const model = {
        definitionsPrefix: 'bpmn',
        definitionsOpen: null,
        definitionsCloseStart: -1,
        collaborationId: '',
        processes: [],
        participants: [],
        messageFlows: [],
        nodes: new Map(),
        edges: [],
        lanes: [],
        artifacts: [],
        associations: [],
        diagramRanges: [],
        prefixes: { bpmndi: null, dc: null, di: null },
        diBounds: new Map()
    };
    const stack = [];
    let order = 0;
    let diagramDepth = null;
    let diagramStart = -1;
    let flowNodeRefOpenEnd = -1;
    let pendingDiShape = '';
    let refTextOpenEnd = -1;
    let pendingDataAssoc = null;
    const containerOf = () => {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (PROCESS_TYPES.has(stack[i].name))
                return stack[i].id;
        }
        return '';
    };
    const processOf = () => {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].name === 'process')
                return stack[i].id;
        }
        return '';
    };
    const currentLane = () => {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].name === 'lane')
                return stack[i];
        }
        return null;
    };
    const currentActivity = () => {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (isFlowNodeType(stack[i].name))
                return stack[i].id;
        }
        return '';
    };
    TAG_RE.lastIndex = 0;
    let m;
    while ((m = TAG_RE.exec(xml))) {
        const full = m[0];
        if (full.startsWith('<!') || full.startsWith('<?'))
            continue;
        const closing = !!m[1];
        const prefix = m[2] || '';
        const name = m[3];
        const attrs = m[4] || '';
        const selfClosing = !!m[5];
        const start = m.index;
        const end = m.index + full.length;
        if (closing) {
            // 매칭되는 열린 태그 pop
            let idx = stack.length - 1;
            while (idx >= 0 && stack[idx].name !== name)
                idx--;
            if (idx < 0)
                continue;
            const frame = stack[idx];
            stack.length = idx;
            if (name === 'flowNodeRef' && flowNodeRefOpenEnd >= 0) {
                const text = xml.slice(flowNodeRefOpenEnd, start).trim();
                const lane = currentLane();
                if (lane && lane.laneIdx !== undefined && text)
                    model.lanes[lane.laneIdx].refs.push(decodeEntities(text));
                flowNodeRefOpenEnd = -1;
            }
            else if ((name === 'sourceRef' || name === 'targetRef') && refTextOpenEnd >= 0) {
                const text = decodeEntities(xml.slice(refTextOpenEnd, start).trim());
                refTextOpenEnd = -1;
                if (pendingDataAssoc && text) {
                    // dataInputAssociation: sourceRef=데이터, dataOutputAssociation: targetRef=데이터
                    if (pendingDataAssoc.kind === 'in' && name === 'sourceRef')
                        pendingDataAssoc.data = text;
                    if (pendingDataAssoc.kind === 'out' && name === 'targetRef')
                        pendingDataAssoc.data = text;
                }
            }
            else if ((name === 'dataInputAssociation' || name === 'dataOutputAssociation') && pendingDataAssoc) {
                const d = pendingDataAssoc;
                pendingDataAssoc = null;
                if (d.id && d.data && d.activity) {
                    model.associations.push(d.kind === 'in'
                        ? { id: d.id, source: d.data, target: d.activity }
                        : { id: d.id, source: d.activity, target: d.data });
                }
            }
            else if (name === 'lane' && frame.laneIdx !== undefined) {
                model.lanes[frame.laneIdx].closeTagStart = start;
                if (frame.childLanes) {
                    // 자식 레인이 있는 부모 레인은 잎(leaf) 이 아니므로 제외
                    model.lanes[frame.laneIdx].refs = [];
                    model.lanes[frame.laneIdx].closeTagStart = -1;
                }
            }
            else if (name === 'BPMNDiagram' && diagramDepth === stack.length && diagramStart >= 0) {
                model.diagramRanges.push({ start: diagramStart, end });
                diagramDepth = null;
                diagramStart = -1;
            }
            else if (name === 'definitions') {
                model.definitionsCloseStart = start;
            }
            continue;
        }
        const id = attr(attrs, 'id');
        const frame = { name, prefix, id, start };
        if (name === 'definitions') {
            model.definitionsPrefix = prefix;
            model.definitionsOpen = { start, end, attrs };
            const nsRe = /xmlns:([\w.-]+)\s*=\s*"([^"]*)"/g;
            let ns;
            while ((ns = nsRe.exec(attrs))) {
                if (ns[2] === NS_BPMNDI)
                    model.prefixes.bpmndi = ns[1];
                else if (ns[2] === NS_DC)
                    model.prefixes.dc = ns[1];
                else if (ns[2] === NS_DI)
                    model.prefixes.di = ns[1];
            }
        }
        else if (name === 'BPMNDiagram') {
            if (diagramDepth === null) {
                diagramDepth = stack.length;
                diagramStart = start;
            }
            if (selfClosing) {
                model.diagramRanges.push({ start, end });
                diagramDepth = null;
                diagramStart = -1;
            }
        }
        else if (diagramDepth !== null) {
            // DI 내부 — 레인/참여자 순서 유지를 위해 도형 위치만 기록
            if (name === 'BPMNShape') {
                pendingDiShape = attr(attrs, 'bpmnElement');
            }
            else if (name === 'Bounds' && pendingDiShape) {
                const bx = Number(attr(attrs, 'x'));
                const by = Number(attr(attrs, 'y'));
                if (Number.isFinite(bx) && Number.isFinite(by) && !model.diBounds.has(pendingDiShape)) {
                    model.diBounds.set(pendingDiShape, { x: bx, y: by });
                }
                pendingDiShape = '';
            }
        }
        else if (name === 'collaboration') {
            model.collaborationId = id;
        }
        else if (name === 'participant') {
            const processRef = attr(attrs, 'processRef');
            if (id)
                model.participants.push({ id, processRef });
        }
        else if (name === 'messageFlow') {
            if (id)
                model.messageFlows.push({ id, source: attr(attrs, 'sourceRef'), target: attr(attrs, 'targetRef') });
        }
        else if (name === 'process') {
            if (id)
                model.processes.push(id);
        }
        else if (name === 'lane') {
            const parentLane = currentLane();
            if (parentLane)
                parentLane.childLanes = (parentLane.childLanes || 0) + 1;
            frame.laneIdx = model.lanes.length;
            model.lanes.push({ id, process: processOf(), refs: [], closeTagStart: -1, prefix });
        }
        else if (name === 'flowNodeRef') {
            flowNodeRefOpenEnd = end;
        }
        else if (name === 'sequenceFlow') {
            const container = containerOf();
            if (id && container) {
                model.edges.push({ id, source: attr(attrs, 'sourceRef'), target: attr(attrs, 'targetRef'), container });
            }
        }
        else if (name === 'association') {
            if (id)
                model.associations.push({ id, source: attr(attrs, 'sourceRef'), target: attr(attrs, 'targetRef') });
        }
        else if (name === 'dataInputAssociation' || name === 'dataOutputAssociation') {
            if (!selfClosing)
                pendingDataAssoc = { id, kind: name === 'dataInputAssociation' ? 'in' : 'out', activity: currentActivity(), data: '' };
        }
        else if ((name === 'sourceRef' || name === 'targetRef') && pendingDataAssoc && !selfClosing) {
            refTextOpenEnd = end;
        }
        else if (ARTIFACT_TYPES.has(name)) {
            // collaboration 직속 아티팩트는 container 가 비어 있음 → 파싱 후 연결 노드의 컨테이너로 해석
            if (id)
                model.artifacts.push({ id, type: name, container: containerOf() });
        }
        else if (isFlowNodeType(name) || name === BOUNDARY) {
            const container = containerOf();
            if (id && container && !model.nodes.has(id)) {
                const node = { id, type: name, order: order++, container };
                if (name === BOUNDARY)
                    node.attachedTo = attr(attrs, 'attachedToRef');
                model.nodes.set(id, node);
                if (CONTAINER_TYPES.has(name)) {
                    const parent = model.nodes.get(container);
                    void parent;
                }
            }
        }
        if (!selfClosing)
            stack.push(frame);
    }
    // 컨테이너가 없는(collaboration 직속) 아티팩트 → 연결된 노드/아티팩트의 컨테이너, 없으면 첫 process
    for (const art of model.artifacts) {
        if (art.container)
            continue;
        for (const a of model.associations) {
            if (a.source !== art.id && a.target !== art.id)
                continue;
            const otherId = a.source === art.id ? a.target : a.source;
            const node = model.nodes.get(otherId);
            const otherArt = model.artifacts.find((x) => x.id === otherId && x.container);
            if (node)
                art.container = node.container;
            else if (otherArt)
                art.container = otherArt.container;
            if (art.container)
                break;
        }
        if (!art.container)
            art.container = model.processes[0] || '';
    }
    model.artifacts = model.artifacts.filter((a) => a.container);
    // 확장 subProcess 판별: 자식 flow node 가 하나라도 있으면 expanded
    for (const node of model.nodes.values()) {
        if (CONTAINER_TYPES.has(node.type)) {
            for (const other of model.nodes.values()) {
                if (other.container === node.id) {
                    node.hasChildren = true;
                    break;
                }
            }
        }
    }
    return model;
}
function isFlowNodeType(name) {
    return TASK_TYPES.has(name) || CONTAINER_TYPES.has(name) || GATEWAY_TYPES.has(name) || EVENT_TYPES.has(name);
}
function nodeSize(node, sub) {
    if (GATEWAY_TYPES.has(node.type))
        return { w: GATEWAY_SIZE, h: GATEWAY_SIZE };
    if (EVENT_TYPES.has(node.type) || node.type === BOUNDARY)
        return { w: EVENT_SIZE, h: EVENT_SIZE };
    if (sub) {
        return {
            w: Math.max(TASK_W, sub.width + SUBPROCESS_PAD * 2),
            h: Math.max(TASK_H, sub.height + SUBPROCESS_PAD * 2)
        };
    }
    return { w: TASK_W, h: TASK_H };
}
function layoutContainer(model, containerId, lanes, warnings) {
    const allNodes = [...model.nodes.values()].filter((n) => n.container === containerId).sort((a, b) => a.order - b.order);
    const boundaries = allNodes.filter((n) => n.type === BOUNDARY);
    const nodes = allNodes.filter((n) => n.type !== BOUNDARY);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const boundaryHost = new Map();
    for (const b of boundaries) {
        if (b.attachedTo && byId.has(b.attachedTo))
            boundaryHost.set(b.id, b.attachedTo);
        else
            warnings.push(`boundaryEvent ${b.id}: 호스트 활동을 찾지 못해 배치에서 제외`);
    }
    // 하위 컨테이너(확장 subProcess) 먼저 배치 → 크기 결정
    const subLayouts = new Map();
    for (const n of nodes) {
        if (n.hasChildren)
            subLayouts.set(n.id, layoutContainer(model, n.id, [{ id: '', refs: new Set() }], warnings));
    }
    // 간선(층 계산용: boundary 출발은 호스트 출발로 치환)
    const edges = model.edges.filter((e) => e.container === containerId);
    const layerEdges = [];
    for (const e of edges) {
        const src = byId.has(e.source) ? e.source : boundaryHost.get(e.source);
        if (!src || !byId.has(e.target))
            continue;
        layerEdges.push({ source: src, target: e.target });
    }
    const succ = new Map();
    const pred = new Map();
    for (const n of nodes) {
        succ.set(n.id, []);
        pred.set(n.id, []);
    }
    for (const e of layerEdges) {
        succ.get(e.source).push(e.target);
        pred.get(e.target).push(e.source);
    }
    // 1) 순환 제거(back edge) — DFS
    const color = new Map();
    const backEdges = new Set(); // `${s}->${t}`
    const roots = nodes.filter((n) => (pred.get(n.id) || []).length === 0);
    const dfsOrder = [...roots, ...nodes.filter((n) => !roots.includes(n))];
    for (const root of dfsOrder) {
        if (color.get(root.id))
            continue;
        const stack = [{ id: root.id, i: 0 }];
        color.set(root.id, 1);
        while (stack.length) {
            const top = stack[stack.length - 1];
            const outs = succ.get(top.id) || [];
            if (top.i < outs.length) {
                const next = outs[top.i++];
                const c = color.get(next) || 0;
                if (c === 0) {
                    color.set(next, 1);
                    stack.push({ id: next, i: 0 });
                }
                else if (c === 1) {
                    backEdges.add(`${top.id}->${next}`);
                }
            }
            else {
                color.set(top.id, 2);
                stack.pop();
            }
        }
    }
    const isBack = (s, t) => backEdges.has(`${s}->${t}`);
    // 2) 열 배정 — longest path (Kahn)
    const indeg = new Map();
    for (const n of nodes)
        indeg.set(n.id, 0);
    for (const e of layerEdges)
        if (!isBack(e.source, e.target))
            indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
    const col = new Map();
    const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
    const topo = [];
    while (queue.length) {
        const id = queue.shift();
        topo.push(id);
        if (!col.has(id))
            col.set(id, 0);
        for (const t of succ.get(id) || []) {
            if (isBack(id, t))
                continue;
            col.set(t, Math.max(col.get(t) || 0, (col.get(id) || 0) + 1));
            indeg.set(t, (indeg.get(t) || 0) - 1);
            if ((indeg.get(t) || 0) === 0)
                queue.push(t);
        }
    }
    for (const n of nodes) {
        if (!col.has(n.id)) {
            col.set(n.id, 0);
            topo.push(n.id);
        }
    }
    // 레인 배정
    const laneIndexOfRef = new Map();
    lanes.forEach((lane, i) => lane.refs.forEach((ref) => laneIndexOfRef.set(ref, i)));
    const laneOf = new Map();
    const addedLaneRefs = [];
    for (const id of topo) {
        let lane = laneIndexOfRef.get(id);
        if (lane === undefined) {
            const p = (pred.get(id) || []).find((s) => laneOf.has(s));
            lane = p !== undefined ? laneOf.get(p) : 0;
            if (lanes[lane]?.id)
                addedLaneRefs.push({ laneId: lanes[lane].id, nodeId: id });
        }
        laneOf.set(id, lane);
    }
    for (const b of boundaries) {
        const host = boundaryHost.get(b.id);
        if (!host)
            continue;
        const lane = laneOf.get(host) ?? 0;
        if (lanes[lane]?.id && !laneIndexOfRef.has(b.id))
            addedLaneRefs.push({ laneId: lanes[lane].id, nodeId: b.id });
    }
    // 3) 행 배정 — 열 오름차순, 레인 안 barycenter
    const maxCol = nodes.length ? Math.max(...nodes.map((n) => col.get(n.id) || 0)) : -1;
    const row = new Map();
    const occupied = new Map(); // `${lane}:${col}:${row}` → node id
    const orderOf = new Map(nodes.map((n) => [n.id, n.order]));
    for (let c = 0; c <= maxCol; c++) {
        const inCol = nodes.filter((n) => col.get(n.id) === c);
        const bary = new Map();
        for (const n of inCol) {
            const lane = laneOf.get(n.id);
            const rows = (pred.get(n.id) || [])
                .filter((p) => !isBack(p, n.id) && row.has(p) && laneOf.get(p) === lane)
                .map((p) => row.get(p));
            bary.set(n.id, rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : 0);
        }
        inCol.sort((a, b) => {
            const la = laneOf.get(a.id);
            const lb = laneOf.get(b.id);
            if (la !== lb)
                return la - lb;
            const ba = bary.get(a.id);
            const bb = bary.get(b.id);
            if (ba !== bb)
                return ba - bb;
            return (orderOf.get(a.id) || 0) - (orderOf.get(b.id) || 0);
        });
        for (const n of inCol) {
            const lane = laneOf.get(n.id);
            let r = Math.max(0, Math.floor(bary.get(n.id) + 0.499));
            while (occupied.has(`${lane}:${c}:${r}`))
                r++;
            occupied.set(`${lane}:${c}:${r}`, n.id);
            row.set(n.id, r);
        }
    }
    // 크기
    const placed = new Map();
    for (const n of nodes) {
        const sub = subLayouts.get(n.id);
        const size = nodeSize(n, sub);
        placed.set(n.id, {
            node: n,
            lane: laneOf.get(n.id),
            col: col.get(n.id),
            row: row.get(n.id),
            w: size.w,
            h: size.h,
            x: 0,
            y: 0,
            sub
        });
    }
    // 4) 열 폭 / 행 높이
    const colW = [];
    for (let c = 0; c <= maxCol; c++) {
        const ws = [...placed.values()].filter((p) => p.col === c).map((p) => p.w);
        colW.push((ws.length ? Math.max(...ws) : TASK_W) + H_GAP);
    }
    const colX = [];
    let acc = 0;
    for (let c = 0; c <= maxCol; c++) {
        colX.push(acc);
        acc += colW[c];
    }
    const contentWidth = Math.max(acc - H_GAP, 0);
    // 아티팩트가 붙은 노드가 있는 행은 위(어노테이션)/아래(데이터 객체) 여백을 키운다
    const annotationTargets = new Set();
    const dataTargets = new Set();
    for (const a of model.associations) {
        const art = model.artifacts.find((x) => x.id === a.source || x.id === a.target);
        if (!art)
            continue;
        const other = art.id === a.source ? a.target : a.source;
        if (!placed.has(other))
            continue;
        (art.type === 'textAnnotation' ? annotationTargets : dataTargets).add(other);
    }
    const laneRowH = lanes.map(() => []); // 행별 최대 도형 높이(순수)
    const rowExtraTop = lanes.map(() => []);
    const rowExtraBottom = lanes.map(() => []);
    for (const p of placed.values()) {
        const rows = laneRowH[p.lane];
        rows[p.row] = Math.max(rows[p.row] || 0, p.h);
        if (annotationTargets.has(p.node.id))
            rowExtraTop[p.lane][p.row] = ANNOTATION_H + 10;
        if (dataTargets.has(p.node.id))
            rowExtraBottom[p.lane][p.row] = DATA_H + DATA_LABEL_H + 10;
    }
    const laneRowY = []; // 행의 도형 밴드 시작 y(레인 상대)
    const laneHeights = [];
    const laneY = [];
    let yAcc = 0;
    lanes.forEach((_, li) => {
        const rows = laneRowH[li];
        const ys = [];
        let y = LANE_PAD_Y;
        for (let r = 0; r < rows.length; r++) {
            const top = rowExtraTop[li][r] || 0;
            const bottom = rowExtraBottom[li][r] || 0;
            rows[r] = rows[r] || TASK_H;
            ys.push(y + top);
            y += top + rows[r] + bottom + V_GAP;
        }
        const height = Math.max(LANE_MIN_H, y - (rows.length ? V_GAP : 0) + LANE_PAD_Y);
        laneRowY.push(ys);
        laneHeights.push(height);
        laneY.push(yAcc);
        yAcc += height;
    });
    const contentHeight = yAcc;
    // 좌표
    for (const p of placed.values()) {
        const cw = colW[p.col] - H_GAP;
        p.x = colX[p.col] + (cw - p.w) / 2;
        const rh = laneRowH[p.lane][p.row];
        p.y = laneY[p.lane] + laneRowY[p.lane][p.row] + (rh - p.h) / 2;
    }
    const shapes = [];
    const edgesOut = [];
    const bounds = new Map();
    for (const p of placed.values()) {
        const b = { x: p.x, y: p.y, w: p.w, h: p.h };
        bounds.set(p.node.id, b);
        shapes.push({
            id: p.node.id,
            type: p.node.type,
            ...b,
            isExpanded: CONTAINER_TYPES.has(p.node.type) ? !!p.sub : undefined,
            isMarkerVisible: p.node.type === 'exclusiveGateway' ? true : undefined
        });
        if (p.sub) {
            const dx = p.x + SUBPROCESS_PAD;
            const dy = p.y + SUBPROCESS_PAD;
            for (const s of p.sub.shapes)
                shapes.push({ ...s, x: s.x + dx, y: s.y + dy });
            for (const e of p.sub.edges)
                edgesOut.push({ id: e.id, points: e.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) });
        }
    }
    // 5) 경계 이벤트 — 호스트 아래 변
    const boundaryCount = new Map();
    for (const b of boundaries) {
        const host = boundaryHost.get(b.id);
        if (!host)
            continue;
        const hb = bounds.get(host);
        const k = boundaryCount.get(host) || 0;
        boundaryCount.set(host, k + 1);
        const bx = Math.max(hb.x, hb.x + hb.w - EVENT_SIZE - 6 - k * (EVENT_SIZE + 6));
        const bb = { x: bx, y: hb.y + hb.h - EVENT_SIZE / 2, w: EVENT_SIZE, h: EVENT_SIZE };
        bounds.set(b.id, bb);
        shapes.push({ id: b.id, type: b.type, ...bb });
    }
    // 6) 선 라우팅
    const gutterX = (c) => (c + 1 <= maxCol ? colX[c + 1] - H_GAP / 2 : colX[c] + colW[c] - H_GAP / 2);
    const cellOccupied = (lane, c, r) => occupied.has(`${lane}:${c}:${r}`);
    const allBounds = [...bounds.entries()];
    /** 수직/수평 선분이 다른 도형을 관통하는지 (양 끝 도형 제외) */
    const segmentBlocked = (p, q, skip) => {
        const x1 = Math.min(p.x, q.x) - 1;
        const x2 = Math.max(p.x, q.x) + 1;
        const y1 = Math.min(p.y, q.y) - 1;
        const y2 = Math.max(p.y, q.y) + 1;
        for (const [id, b] of allBounds) {
            if (skip.has(id))
                continue;
            if (b.x < x2 && x1 < b.x + b.w && b.y < y2 && y1 < b.y + b.h)
                return true;
        }
        return false;
    };
    const pathBlocked = (pts, skip) => {
        for (let i = 1; i < pts.length; i++)
            if (segmentBlocked(pts[i - 1], pts[i], skip))
                return true;
        return false;
    };
    for (const e of edges) {
        const sIsBoundary = boundaryHost.has(e.source);
        const sId = sIsBoundary ? boundaryHost.get(e.source) : e.source;
        const s = placed.get(sId);
        const t = placed.get(e.target);
        const sb = bounds.get(e.source);
        const tb = bounds.get(e.target);
        if (!s || !t || !sb || !tb) {
            warnings.push(`sequenceFlow ${e.id}: 양 끝 요소를 찾지 못해 선을 생략`);
            continue;
        }
        const sy = sb.y + sb.h / 2;
        const ty = tb.y + tb.h / 2;
        const scx = sb.x + sb.w / 2;
        const tcx = tb.x + tb.w / 2;
        const sRight = sb.x + sb.w;
        const sBottom = sb.y + sb.h;
        const tBottom = tb.y + tb.h;
        const forward = t.col > s.col;
        let points;
        if (sIsBoundary) {
            const g = sBottom + V_GAP / 2;
            if (forward) {
                const mx = tb.x - H_GAP / 2;
                points = [
                    { x: scx, y: sBottom },
                    { x: scx, y: g },
                    { x: mx, y: g },
                    { x: mx, y: ty },
                    { x: tb.x, y: ty }
                ];
            }
            else {
                const yr = Math.max(sBottom, tBottom) + V_GAP / 2;
                points = [
                    { x: scx, y: sBottom },
                    { x: scx, y: yr },
                    { x: tcx, y: yr },
                    { x: tcx, y: tBottom }
                ];
            }
        }
        else if (forward) {
            const skip = new Set([e.source, e.target, sId]);
            const gutterRoute = () => {
                // 열 사이 여백 중 도형과 겹치지 않는 곳에서 꺾는다 (가까운 순)
                let bestC = s.col;
                let bestCost = Number.POSITIVE_INFINITY;
                for (let c = s.col; c < t.col; c++) {
                    let cost = 0;
                    for (let k = s.col + 1; k <= c; k++)
                        if (cellOccupied(s.lane, k, s.row))
                            cost++;
                    for (let k = c + 1; k < t.col; k++)
                        if (cellOccupied(t.lane, k, t.row))
                            cost++;
                    const mx = gutterX(c);
                    if (segmentBlocked({ x: mx, y: sy }, { x: mx, y: ty }, skip))
                        cost += 0.5;
                    if (cost < bestCost) {
                        bestCost = cost;
                        bestC = c;
                    }
                }
                const mx = gutterX(bestC);
                return [
                    { x: sRight, y: sy },
                    { x: mx, y: sy },
                    { x: mx, y: ty },
                    { x: tb.x, y: ty }
                ];
            };
            if (Math.abs(sy - ty) < 0.5) {
                points = [
                    { x: sRight, y: sy },
                    { x: tb.x, y: ty }
                ];
            }
            else if (GATEWAY_TYPES.has(s.node.type)) {
                // 분기 게이트웨이: 위/아래 꼭짓점에서 수직으로 나간 뒤 수평 — 같은 열의 다른 도형을 관통하면 여백 경로로
                points = [
                    { x: scx, y: ty > sy ? sBottom : sb.y },
                    { x: scx, y: ty },
                    { x: tb.x, y: ty }
                ];
                if (pathBlocked(points, skip))
                    points = gutterRoute();
            }
            else if (GATEWAY_TYPES.has(t.node.type)) {
                // 합류 게이트웨이: 수평으로 온 뒤 위/아래 꼭짓점으로 수직 진입 — 관통 시 여백 경로로
                points = [
                    { x: sRight, y: sy },
                    { x: tcx, y: sy },
                    { x: tcx, y: ty > sy ? tb.y : tBottom }
                ];
                if (pathBlocked(points, skip))
                    points = gutterRoute();
            }
            else {
                points = gutterRoute();
            }
        }
        else if (sId === e.target) {
            const yr = sBottom + V_GAP / 2;
            points = [
                { x: sRight, y: sy },
                { x: sRight + 20, y: sy },
                { x: sRight + 20, y: yr },
                { x: scx, y: yr },
                { x: scx, y: sBottom }
            ];
        }
        else {
            // 역방향(루프) — 아래 여백으로 우회
            const yr = Math.max(sBottom, tBottom) + V_GAP / 2;
            points = [
                { x: scx, y: sBottom },
                { x: scx, y: yr },
                { x: tcx, y: yr },
                { x: tcx, y: tBottom }
            ];
        }
        edgesOut.push({ id: e.id, points: dedupePoints(points) });
    }
    // 7) 아티팩트 — 어노테이션은 연결 노드 위, 데이터 객체는 아래(같은 노드에 여럿이면 오른쪽으로 나란히), 연결 없으면 마지막 열 뒤
    const artifacts = model.artifacts.filter((a) => a.container === containerId);
    let trailingX = contentWidth + H_GAP;
    const artCount = new Map();
    const partnerOf = (art, allowArtifact) => {
        // 1순위: 배치된 flow node, 2순위(allowArtifact): 이미 배치된 다른 아티팩트(데이터 객체에 붙은 어노테이션 등)
        let fallback = '';
        for (const a of model.associations) {
            if (a.source !== art.id && a.target !== art.id)
                continue;
            const otherId = a.source === art.id ? a.target : a.source;
            if (placed.has(otherId) && bounds.has(otherId))
                return otherId;
            if (allowArtifact && !fallback && bounds.has(otherId))
                fallback = otherId;
        }
        return fallback;
    };
    const pending = new Set(artifacts.map((a) => a.id));
    const passes = [];
    for (const pass of [false, true]) {
        for (const art of artifacts) {
            if (!pending.has(art.id))
                continue;
            if (partnerOf(art, pass)) {
                passes.push(art);
                pending.delete(art.id);
            }
        }
    }
    for (const art of artifacts)
        if (pending.has(art.id))
            passes.push(art);
    for (const art of passes) {
        const otherId = partnerOf(art, true);
        const other = otherId ? bounds.get(otherId) : undefined;
        const isAnno = art.type === 'textAnnotation';
        const w = isAnno ? ANNOTATION_W : DATA_W;
        const h = isAnno ? ANNOTATION_H : DATA_H;
        let b;
        if (other) {
            const key = `${otherId}:${isAnno ? 'a' : 'd'}`;
            const k = artCount.get(key) || 0;
            artCount.set(key, k + 1);
            const otherIsArtifact = !placed.has(otherId);
            if (isAnno && otherIsArtifact) {
                // 데이터 객체 등 아티팩트에 붙은 어노테이션은 같은 띠(band)의 마지막 아티팩트 오른쪽에 나란히 (위에 두면 호스트 노드와 겹침)
                let right = other.x + other.w;
                for (const sh of shapes) {
                    if (!ARTIFACT_TYPES.has(sh.type))
                        continue;
                    if (sh.y < other.y + other.h && other.y < sh.y + sh.h && sh.x + sh.w > right && sh.x < right + 400)
                        right = sh.x + sh.w;
                }
                b = { x: right + DATA_SIDE_GAP - DATA_W + k * (w + 10), y: other.y, w, h };
            }
            else {
                b = isAnno
                    ? { x: other.x + k * (w + 10), y: other.y - h - 10, w, h }
                    : { x: other.x + k * DATA_SIDE_GAP, y: other.y + other.h + 10, w, h };
            }
        }
        else {
            b = { x: trailingX, y: LANE_PAD_Y, w, h };
            trailingX += ANNOTATION_W + H_GAP;
        }
        bounds.set(art.id, b);
        shapes.push({ id: art.id, type: art.type, ...b });
    }
    for (const a of model.associations) {
        const sb = bounds.get(a.source);
        const tb = bounds.get(a.target);
        if (!sb || !tb)
            continue;
        const above = sb.y + sb.h <= tb.y;
        points(a.id, sb, tb, above, edgesOut);
    }
    return {
        width: Math.max(contentWidth, trailingX - H_GAP),
        height: contentHeight,
        laneHeights,
        shapes,
        edges: edgesOut,
        addedLaneRefs
    };
}
function points(id, sb, tb, above, out) {
    // 위/아래로 붙은 아티팩트 연결선: 작은 쪽 중심 x 가 큰 쪽 폭 안이면 수직선, 아니면 중심끼리 대각선
    // 좌우로 나란한 경우(아티팩트에 붙은 어노테이션): 수평 직선
    const sideBySide = sb.y < tb.y + tb.h && tb.y < sb.y + sb.h;
    if (sideBySide) {
        const [left, right] = sb.x <= tb.x ? [sb, tb] : [tb, sb];
        const y = Math.max(left.y, right.y) + Math.min(left.h, right.h) / 2;
        const p1 = { x: left.x + left.w, y };
        const p2 = { x: right.x, y };
        out.push({ id, points: left === sb ? [p1, p2] : [p2, p1] });
        return;
    }
    const [upper, lower] = above ? [sb, tb] : [tb, sb];
    const small = upper.w <= lower.w ? upper : lower;
    const big = small === upper ? lower : upper;
    const cx = small.x + small.w / 2;
    const inside = cx >= big.x && cx <= big.x + big.w;
    const ux = inside ? cx : upper.x + upper.w / 2;
    const lx = inside ? cx : lower.x + lower.w / 2;
    const p1 = { x: ux, y: upper.y + upper.h };
    const p2 = { x: lx, y: lower.y };
    out.push({ id, points: above ? [p1, p2] : [p2, p1] });
}
function dedupePoints(pts) {
    const out = [];
    for (const p of pts) {
        const last = out[out.length - 1];
        if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5)
            continue;
        out.push(p);
    }
    // 일직선 위의 중간점 제거
    const simplified = [];
    for (let i = 0; i < out.length; i++) {
        const prev = simplified[simplified.length - 1];
        const next = out[i + 1];
        const cur = out[i];
        if (prev && next && ((prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y)))
            continue;
        simplified.push(cur);
    }
    return simplified;
}
/* ------------------------------------------------------------------ */
/* 최상위 조립                                                          */
/* ------------------------------------------------------------------ */
/**
 * 순수 배치 계산 — DI 문자열 생성 없이 도형/선 좌표만 반환(테스트·다른 소비자용).
 */
function computeBpmnLayout(xml, options = {}) {
    const model = parseModel(xml);
    const warnings = [];
    const originX = options.originX ?? 160;
    const originY = options.originY ?? 80;
    const shapes = [];
    const edges = [];
    const addedLaneRefs = [];
    const processBounds = new Map();
    const nodeBounds = new Map();
    const diY = (id) => model.diBounds.get(id)?.y;
    const orderByDi = (items, idOf) => {
        // 기존 DI 에 모두 좌표가 있으면 그 위→아래 순서를 유지(LLM 출력처럼 DI 가 없으면 문서 순)
        const ys = items.map((t) => diY(idOf(t)));
        if (items.length < 2 || ys.some((v) => v === undefined))
            return items;
        return items
            .map((t, i) => ({ t, y: ys[i], i }))
            .sort((a, b) => a.y - b.y || a.i - b.i)
            .map((x) => x.t);
    };
    const processOrder = orderByDi(model.processes, (pid) => model.participants.find((p) => p.processRef === pid)?.id || pid);
    let y = originY;
    for (const processId of processOrder) {
        const laneDefs = orderByDi(model.lanes.filter((l) => l.process === processId && l.closeTagStart >= 0), (l) => l.id).map((l) => ({ id: l.id, refs: new Set(l.refs) }));
        const hasLanes = laneDefs.length > 0;
        const layout = layoutContainer(model, processId, hasLanes ? laneDefs : [{ id: '', refs: new Set() }], warnings);
        addedLaneRefs.push(...layout.addedLaneRefs);
        const participant = model.participants.find((p) => p.processRef === processId);
        const labelW = participant || hasLanes ? LANE_LABEL_W : 0;
        const width = labelW + LANE_PAD_X + layout.width + LANE_PAD_X;
        const height = layout.laneHeights.reduce((a, b) => a + b, 0);
        const px = originX;
        const py = y;
        const contentX = px + labelW + (hasLanes ? LANE_LABEL_W : 0) + LANE_PAD_X;
        const contentY = py;
        if (participant) {
            const b = { x: px, y: py, w: width + (hasLanes ? LANE_LABEL_W : 0), h: height };
            shapes.push({ id: participant.id, type: 'participant', ...b, isHorizontal: true });
            processBounds.set(participant.id, b);
            processBounds.set(processId, b);
        }
        if (hasLanes) {
            let ly = py;
            laneDefs.forEach((lane, i) => {
                const lh = layout.laneHeights[i];
                shapes.push({
                    id: lane.id,
                    type: 'lane',
                    x: px + labelW,
                    y: ly,
                    w: width + (hasLanes ? LANE_LABEL_W : 0) - labelW,
                    h: lh,
                    isHorizontal: true
                });
                ly += lh;
            });
        }
        for (const s of layout.shapes) {
            const b = { ...s, x: s.x + contentX, y: s.y + contentY };
            shapes.push(b);
            nodeBounds.set(s.id, b);
        }
        for (const e of layout.edges)
            edges.push({ id: e.id, points: e.points.map((p) => ({ x: p.x + contentX, y: p.y + contentY })) });
        y += height + PROCESS_GAP;
    }
    // 참여자만 있고 process 가 없는(블랙박스) 참여자
    for (const p of model.participants) {
        if (processBounds.has(p.id))
            continue;
        const b = { x: originX, y, w: 600, h: 100 };
        shapes.push({ id: p.id, type: 'participant', ...b, isHorizontal: true });
        processBounds.set(p.id, b);
        y += b.h + PROCESS_GAP;
    }
    // 메시지 플로우 — 위/아래 참여자 사이 수직 직선
    for (const mf of model.messageFlows) {
        const sb = nodeBounds.get(mf.source) || processBounds.get(mf.source);
        const tb = nodeBounds.get(mf.target) || processBounds.get(mf.target);
        if (!sb || !tb) {
            warnings.push(`messageFlow ${mf.id}: 양 끝 요소를 찾지 못해 선을 생략`);
            continue;
        }
        const down = sb.y <= tb.y;
        const sx = sb.x + sb.w / 2;
        const tx = tb.x + tb.w / 2;
        const sy = down ? sb.y + sb.h : sb.y;
        const ty = down ? tb.y : tb.y + tb.h;
        const my = (sy + ty) / 2;
        edges.push({
            id: mf.id,
            points: dedupePoints([
                { x: sx, y: sy },
                { x: sx, y: my },
                { x: tx, y: my },
                { x: tx, y: ty }
            ])
        });
    }
    const planeElement = model.collaborationId || model.processes[0] || '';
    return { shapes, edges, planeElement, addedLaneRefs, warnings, model };
}
/**
 * BPMN XML 의 bpmndi 를 자동 배치 결과로 교체한다. 실패(정의 없음·요소 없음) 시 원문을 그대로 돌려준다.
 */
function autoLayoutBpmnXml(xml, options = {}) {
    const source = String(xml || '');
    if (!source.trim())
        return { xml: source, changed: false, warnings: ['empty xml'] };
    const { shapes, edges, planeElement, addedLaneRefs, warnings, model } = computeBpmnLayout(source, options);
    if (!model.definitionsOpen || model.definitionsCloseStart < 0) {
        return { xml: source, changed: false, warnings: [...warnings, 'bpmn:definitions 를 찾지 못해 배치를 건너뜀'] };
    }
    if (!planeElement || !shapes.some((s) => s.type !== 'participant' && s.type !== 'lane')) {
        return { xml: source, changed: false, warnings: [...warnings, '배치할 flow 요소가 없어 건너뜀'] };
    }
    const bpmndi = model.prefixes.bpmndi || 'bpmndi';
    const dc = model.prefixes.dc || 'dc';
    const di = model.prefixes.di || 'di';
    const fmt = (n) => String(Math.round(n));
    const lines = [];
    lines.push(`  <${bpmndi}:BPMNDiagram id="BPMNDiagram_1">`);
    lines.push(`    <${bpmndi}:BPMNPlane id="BPMNPlane_1" bpmnElement="${escapeAttr(planeElement)}">`);
    for (const s of shapes) {
        const extra = [];
        if (s.isHorizontal)
            extra.push(' isHorizontal="true"');
        if (s.isExpanded !== undefined)
            extra.push(` isExpanded="${s.isExpanded ? 'true' : 'false'}"`);
        if (s.isMarkerVisible)
            extra.push(' isMarkerVisible="true"');
        lines.push(`      <${bpmndi}:BPMNShape id="${escapeAttr(s.id)}_di" bpmnElement="${escapeAttr(s.id)}"${extra.join('')}>`);
        lines.push(`        <${dc}:Bounds x="${fmt(s.x)}" y="${fmt(s.y)}" width="${fmt(s.w)}" height="${fmt(s.h)}" />`);
        lines.push(`      </${bpmndi}:BPMNShape>`);
    }
    for (const e of edges) {
        lines.push(`      <${bpmndi}:BPMNEdge id="${escapeAttr(e.id)}_di" bpmnElement="${escapeAttr(e.id)}">`);
        for (const p of e.points)
            lines.push(`        <${di}:waypoint x="${fmt(p.x)}" y="${fmt(p.y)}" />`);
        lines.push(`      </${bpmndi}:BPMNEdge>`);
    }
    lines.push(`    </${bpmndi}:BPMNPlane>`);
    lines.push(`  </${bpmndi}:BPMNDiagram>`);
    const diagramXml = `\n${lines.join('\n')}\n`;
    // 편집(뒤에서부터 적용해 오프셋 유지)
    const edits = [];
    for (const r of model.diagramRanges)
        edits.push({ start: r.start, end: r.end, text: '' });
    edits.push({ start: model.definitionsCloseStart, end: model.definitionsCloseStart, text: diagramXml });
    const refsByLane = new Map();
    for (const ref of addedLaneRefs) {
        if (!refsByLane.has(ref.laneId))
            refsByLane.set(ref.laneId, []);
        refsByLane.get(ref.laneId).push(ref.nodeId);
    }
    for (const lane of model.lanes) {
        const ids = refsByLane.get(lane.id);
        if (!ids || lane.closeTagStart < 0)
            continue;
        const p = lane.prefix ? `${lane.prefix}:` : '';
        edits.push({
            start: lane.closeTagStart,
            end: lane.closeTagStart,
            text: ids.map((id) => `  <${p}flowNodeRef>${escapeAttr(id)}</${p}flowNodeRef>\n    `).join('')
        });
    }
    // 네임스페이스 보강
    const missingNs = [];
    if (!model.prefixes.bpmndi)
        missingNs.push(` xmlns:bpmndi="${NS_BPMNDI}"`);
    if (!model.prefixes.dc)
        missingNs.push(` xmlns:dc="${NS_DC}"`);
    if (!model.prefixes.di)
        missingNs.push(` xmlns:di="${NS_DI}"`);
    if (missingNs.length) {
        const open = model.definitionsOpen;
        const insertAt = open.start + `<${model.definitionsPrefix ? `${model.definitionsPrefix}:` : ''}definitions`.length;
        edits.push({ start: insertAt, end: insertAt, text: missingNs.join('') });
    }
    edits.sort((a, b) => b.start - a.start || b.end - a.end);
    let out = source;
    for (const e of edits)
        out = out.slice(0, e.start) + e.text + out.slice(e.end);
    // 다이어그램 제거 자리의 빈 줄 정리
    out = out.replace(/\n[ \t]*\n(?=[ \t]*<)/g, '\n');
    return { xml: out, changed: true, warnings };
}
/** 두 점을 잇는 구간이 수평 또는 수직인지 (테스트·검증용) */
function isOrthogonalPath(points) {
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5)
            return false;
    }
    return true;
}
