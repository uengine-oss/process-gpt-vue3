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
 */

type AnyRecord = Record<string, any>;

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

/**
 * 첫 번째로 실행해야 할 액티비티를 찾는다. (없으면 null)
 * 시작 지점에서 연결을 따라가며 처음 만나는 액티비티를 반환하므로,
 * 시작 직후에 게이트웨이가 오는 정의도 올바르게 처리된다.
 */
export function findStartActivity(definition: AnyRecord): AnyRecord | null {
    const activities = asArray(definition?.activities);
    if (activities.length === 0) return null;

    const sequences = asArray(definition?.sequences);
    const activityById = new Map(activities.map((a) => [a.id, a]));

    const startId = findStartNodeId(definition);
    const visited = new Set<string>();
    const queue: string[] = startId ? [startId] : [];

    while (queue.length > 0) {
        const nodeId = queue.shift();
        if (!nodeId || visited.has(nodeId)) continue;
        visited.add(nodeId);
        for (const seq of sequences) {
            if (seq.source !== nodeId) continue;
            const activity = activityById.get(seq.target);
            if (activity) return activity;
            queue.push(seq.target);
        }
    }

    // 폴백: 들어오는 연결이 없는 액티비티 → 그래도 없으면 첫 번째
    const targets = new Set(sequences.map((s) => s.target));
    return activities.find((a) => !targets.has(a.id)) || activities[0];
}
