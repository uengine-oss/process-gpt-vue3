/**
 * 프로세스 정의에서 "시작 지점"과 "첫 번째 실행 대상 액티비티"를 찾는 공용 유틸.
 *
 * [왜 이 파일이 필요한가]
 * 예전에는 화면마다 각자 다른 방식으로 시작 지점을 찾았다.
 *   - ProcessGPTExecute.vue : sequences 에서 source === 'start_event' 인 것을 찾음 (id 문자열 하드코딩)
 *   - Chats.vue            : events 에서 type === 'startEvent' 인 것을 찾음
 * 첫 번째 방식은 시작 이벤트 id 가 'start_event1' 처럼 다르게 생성된 정의에서 조회에 실패했고,
 * 그때 activities[0] 로 폴백했는데 이 배열 순서는 실행 순서와 무관해서
 * "프로세스를 실행하면 마지막 태스크가 열리는" 문제가 발생했다.
 *
 * [판별 규칙]
 * 이름이나 id 문자열에 의존하지 않고 그래프 구조로 판별한다.
 *   시작 지점 = 나가는 연결(outgoing)은 있고 들어오는 연결(incoming)은 없는 노드
 * 그 위에 두 가지 보정을 둔다.
 *   1) 후보가 여럿이면 type 이 startEvent 인 것을 우선한다.
 *   2) 서브프로세스 안의 시작 이벤트는 제외한다.
 *      (이벤트의 process 필드가 subProcesses 의 id 를 가리키면 그 서브프로세스 소속이다)
 *
 * [시작 이벤트에서 나가는 연결선이 없는 정의]
 * 딥 에이전트가 시작 이벤트의 Sequence 를 빠뜨리고 첫 액티비티에 source:'start' 만 적은 정의는
 * 그림(BPMN XML)에는 화살표가 있는데 정의 JSON 에는 없다. 그러면 위 규칙의 시작 지점이 첫 액티비티
 * 자신이 되는데, 예전 findStartActivity 는 시작 지점의 "다음" 액티비티를 돌려줘 첫 단계를 건너뛰었다
 * (VM 녹화: 「견적 요청 접수」를 건너뛰고 「재고 확인」으로 시작). 실행 엔진(completion
 * find_initial_activity)도 같은 규칙이라 같은 답을 준다 — hasDanglingStartEvent 로 가려 로컬 판별을 쓴다.
 *   1) 그림 XML 이 있으면 XML 의 시작 이벤트에서 나가는 연결선을 따른다.
 *   2) 없으면 시작 지점이 액티비티일 때 그 액티비티 자신이 첫 단계다.
 */

type AnyRecord = Record<string, any>;
type Edge = { source?: any; target?: any };

const NODE_COLLECTIONS = ['events', 'gateways', 'activities', 'subProcesses'] as const;

function asArray(value: any): AnyRecord[] {
    return Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : [];
}

function isStartType(type: any): boolean {
    return String(type || '')
        .toLowerCase()
        .includes('start');
}

/** 정의 안의 모든 노드를 { id: { collection, node } } 형태로 모은다. */
function collectNodes(definition: AnyRecord): Map<string, { collection: string; node: AnyRecord }> {
    const map = new Map<string, { collection: string; node: AnyRecord }>();
    for (const collection of NODE_COLLECTIONS) {
        for (const node of asArray(definition?.[collection])) {
            const id = node.id;
            if (id && !map.has(id)) map.set(id, { collection, node });
        }
    }
    return map;
}

/**
 * 시작 지점 노드의 id 를 찾는다. (없으면 null)
 * 서브프로세스 내부의 시작 이벤트는 제외한다.
 */
export function findStartNodeId(definition: AnyRecord): string | null {
    const sequences = asArray(definition?.sequences);
    if (sequences.length === 0) return null;

    const targets = new Set(sequences.map((s) => s.target));
    // 나가는 연결은 있고 들어오는 연결은 없는 노드 (등장 순서 유지)
    const candidates: string[] = [];
    for (const seq of sequences) {
        const source = seq.source;
        if (source && !targets.has(source) && !candidates.includes(source)) candidates.push(source);
    }
    if (candidates.length === 0) return null;

    const nodes = collectNodes(definition);
    const subProcessIds = new Set(asArray(definition?.subProcesses).map((s) => s.id));

    // 서브프로세스 소속 시작 이벤트 제외 (event.process 가 서브프로세스 id 를 가리킨다)
    const topLevel = candidates.filter((id) => {
        const owner = nodes.get(id)?.node?.process;
        return !(owner && subProcessIds.has(owner));
    });
    const pool = topLevel.length > 0 ? topLevel : candidates;

    // type 이 startEvent 인 후보를 우선한다
    const typed = pool.find((id) => isStartType(nodes.get(id)?.node?.type));
    return typed || pool[0];
}

/** 서브프로세스 밖(최상위)의 시작 이벤트들. */
function topLevelStartEvents(definition: AnyRecord): AnyRecord[] {
    const subProcessIds = new Set(asArray(definition?.subProcesses).map((s) => s.id));
    return asArray(definition?.events).filter((e) => e.id && isStartType(e.type) && !(e.process && subProcessIds.has(e.process)));
}

/**
 * 최상위 시작 이벤트가 있는데 정의 JSON 의 어떤 연결선도 거기서 나가지 않는가.
 * 이런 정의에서는 그래프 구조로 고른 시작 지점(들어오는 선 없는 노드)이 시작 이벤트가 아니라
 * 첫 액티비티라서, 같은 규칙을 쓰는 실행 엔진의 시작 액티비티 답(그 "다음" 단계)을 믿을 수 없다.
 */
export function hasDanglingStartEvent(definition: AnyRecord): boolean {
    const starts = topLevelStartEvents(definition);
    if (starts.length === 0) return false;
    const sources = new Set(asArray(definition?.sequences).map((s) => s.source));
    return !starts.some((e) => sources.has(e.id));
}

function decodeXmlAttr(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;|&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

function xmlAttr(attrs: string, name: string): string {
    const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`)) || attrs.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`));
    return m ? decodeXmlAttr(m[1]) : '';
}

/** BPMN XML 의 연결선(sequenceFlow)과 시작 이벤트 id. 접두사(bpmn:, bpmn2:, 없음)는 가리지 않는다. */
function parseBpmnFlows(bpmn: string): { edges: Edge[]; startIds: string[] } {
    const edges: Edge[] = [];
    const startIds: string[] = [];
    if (!bpmn || typeof bpmn !== 'string') return { edges, startIds };
    for (const m of bpmn.matchAll(/<(?:[\w-]+:)?sequenceFlow\b([^>]*)>/g)) {
        const source = xmlAttr(m[1], 'sourceRef');
        const target = xmlAttr(m[1], 'targetRef');
        if (source && target) edges.push({ source, target });
    }
    for (const m of bpmn.matchAll(/<(?:[\w-]+:)?startEvent\b([^>]*)>/g)) {
        const id = xmlAttr(m[1], 'id');
        if (id) startIds.push(id);
    }
    return { edges, startIds };
}

/** startIds 에서 edges 를 따라가며 처음 만나는 액티비티. 시작 id 자체가 액티비티면 그것. */
function firstActivityAlong(startIds: string[], edges: Edge[], activityById: Map<string, AnyRecord>): AnyRecord | null {
    const visited = new Set<string>();
    const queue: string[] = [...startIds];
    while (queue.length > 0) {
        const nodeId = queue.shift();
        if (!nodeId || visited.has(nodeId)) continue;
        visited.add(nodeId);
        for (const edge of edges) {
            if (edge.source !== nodeId) continue;
            const activity = activityById.get(edge.target);
            if (activity) return activity;
            queue.push(edge.target);
        }
    }
    return null;
}

/**
 * 첫 번째로 실행해야 할 액티비티를 찾는다. (없으면 null)
 * 시작 지점에서 연결을 따라가며 처음 만나는 액티비티를 반환하므로,
 * 시작 직후에 게이트웨이가 오는 정의도 올바르게 처리된다.
 *
 * options.bpmn: 정의의 BPMN XML. 시작 이벤트에서 나가는 연결선이 정의 JSON 에 없을 때 XML 의 것을 따른다.
 */
export function findStartActivity(definition: AnyRecord, options: { bpmn?: string } = {}): AnyRecord | null {
    const activities = asArray(definition?.activities);
    if (activities.length === 0) return null;

    const sequences = asArray(definition?.sequences);
    const activityById = new Map(activities.map((a) => [a.id, a]));

    if (hasDanglingStartEvent(definition)) {
        // 1) 그림 XML 에는 시작 이벤트에서 나가는 연결선이 있다 — 그것을 따른다.
        const xml = parseBpmnFlows(options?.bpmn || definition?.bpmn || '');
        const jsonStartIds = topLevelStartEvents(definition).map((e) => e.id);
        const xmlStartIds = jsonStartIds.filter((id) => xml.startIds.includes(id));
        const fromXml = firstActivityAlong(xmlStartIds.length ? xmlStartIds : xml.startIds, xml.edges, activityById);
        if (fromXml) return fromXml;
    }

    const startId = findStartNodeId(definition);
    // 2) 시작 지점이 액티비티 자신이면(시작 이벤트에서 나가는 선이 없는 정의) 그것이 첫 단계다.
    //    예전에는 그 "다음" 액티비티를 돌려줘 첫 단계를 건너뛰었다.
    if (startId && activityById.has(startId)) return activityById.get(startId) || null;

    const found = firstActivityAlong(startId ? [startId] : [], sequences, activityById);
    if (found) return found;

    // 폴백: 들어오는 연결이 없는 액티비티 → 그래도 없으면 첫 번째
    const targets = new Set(sequences.map((s) => s.target));
    return activities.find((a) => !targets.has(a.id)) || activities[0];
}
