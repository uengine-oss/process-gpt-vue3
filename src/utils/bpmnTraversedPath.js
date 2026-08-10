/**
 * 프로세스 모니터링 화면에서 "이미 흘러간 경로"(traversed path)를 계산한다.
 *
 * 배경:
 *   인스턴스 진행 상태(`getActivitiesStatus`)는 액티비티 단위 상태맵만 제공한다.
 *   게이트웨이/이벤트에는 워크아이템이 없어 상태맵에 나타나지 않으므로,
 *   "A(완료) -> 게이트웨이 -> B(실행중)" 같은 구간을 강조하려면 BPMN 그래프를
 *   따라가며 토큰이 지나간 시퀀스 플로우를 추론해야 한다.
 *
 * 안전 원칙:
 *   확실히 지나갔다고 말할 수 있는 간선만 표시한다. 분기 게이트웨이에서
 *   어느 쪽으로 갔는지 판단할 수 없으면 아무 쪽도 표시하지 않는다.
 */

// 워크아이템(=상태맵의 키)이 생성되는 노드. 이 목록에 없는 flow node 는
// 게이트웨이/이벤트처럼 상태맵에 절대 나타나지 않는 "통과 노드"로 본다.
const ACTIVITY_TYPE_PATTERN = /(Task|SubProcess|CallActivity|Transaction)$/;

// 토큰이 도달했음이 확실한 상태. 'New'(=TODO)는 서브프로세스/애드혹에서
// 시작 시점에 일괄 생성되는 경우가 있어 도달 근거로 쓰지 않는다.
const ARRIVED_STATUSES = ['Completed', 'Running', 'Pending', 'Cancelled', 'Failed', 'Stopped'];

// 토큰이 이 노드를 이미 떠났음이 확실한 상태. 실행중/대기중 액티비티의
// 나가는 간선은 아직 지나가지 않았으므로 표시하지 않는다.
const DEPARTED_STATUSES = ['Completed'];

// 모든 갈래가 동시에 실행되는 게이트웨이. 그 밖의 분기(배타/포함/이벤트기반)는
// 실행 흔적에 닿는 갈래만 지나간 것으로 판단한다.
const PARALLEL_GATEWAY_TYPES = ['bpmn:ParallelGateway'];

export function isActivityType(type) {
    return typeof type === 'string' && ACTIVITY_TYPE_PATTERN.test(type);
}

/**
 * bpmn-js elementRegistry 를 계산에 필요한 최소 그래프로 정규화한다.
 * @param {{ getAll: Function }} elementRegistry
 * @returns {{ nodes: Array<{id: string, type: string}>, flows: Array<{id: string, sourceId: string, targetId: string}> }}
 */
export function buildGraphFromElementRegistry(elementRegistry) {
    const nodes = [];
    const flows = [];

    if (!elementRegistry || typeof elementRegistry.getAll !== 'function') {
        return { nodes, flows };
    }

    elementRegistry.getAll().forEach((element) => {
        if (!element || !element.id || !element.type) return;

        if (element.type === 'bpmn:SequenceFlow') {
            const sourceId = element.source ? element.source.id : element.businessObject?.sourceRef?.id;
            const targetId = element.target ? element.target.id : element.businessObject?.targetRef?.id;
            if (sourceId && targetId) {
                flows.push({ id: element.id, sourceId, targetId });
            }
            return;
        }

        // 레인/풀/라벨/루트는 흐름 계산 대상이 아니다.
        if (element.type === 'label' || element.waypoints) return;
        if (element.type === 'bpmn:Lane' || element.type === 'bpmn:Participant' || element.type === 'bpmn:Collaboration') return;
        if (element.type === 'bpmn:Process' || element.type === 'bpmn:Definitions') return;

        nodes.push({ id: element.id, type: element.type });
    });

    return { nodes, flows };
}

/**
 * 이미 흘러간 시퀀스 플로우와 통과 노드를 계산한다.
 *
 * 분기 판단 이력(journal)이 있으면 그것을 사실로 쓰고, 없는 구간은 그래프 추론으로 메운다.
 * 이력은 워크아이템이 완료될 때부터 쌓이므로 시작 이벤트에서 첫 활동으로 들어오는 간선처럼
 * 이력이 다룰 수 없는 구간이 늘 남는다. 그래서 인스턴스 단위로 둘 중 하나만 고르지 않고,
 * "추론 결과를 이력으로 교정하는" 방식을 쓴다.
 *
 * @param {{nodes: Array, flows: Array}} graph 정규화된 BPMN 그래프
 * @param {Object<string, string>} statusMap activityId -> 상태 문자열
 * @param {{confirmedSequenceIds?: string[], rejectedSequenceIds?: string[]}} [journal]
 *        confirmedSequenceIds: 실제로 지나갔음이 확인된 시퀀스
 *        rejectedSequenceIds: 판단 지점에서 선택되지 않았음이 확인된 시퀀스
 * @returns {{ flowIds: string[], nodeIds: string[], journalApplied: boolean }}
 */
export function computeTraversedPath(graph, statusMap, journal) {
    const status = statusMap || {};
    const nodes = (graph && graph.nodes) || [];
    const flows = (graph && graph.flows) || [];

    const nodeById = new Map();
    nodes.forEach((node) => {
        nodeById.set(node.id, { id: node.id, type: node.type, outgoing: [], incoming: [] });
    });

    const flowById = new Map();
    flows.forEach((flow) => {
        const source = nodeById.get(flow.sourceId);
        const target = nodeById.get(flow.targetId);
        // 양 끝이 모두 그래프 안에 있어야 흐름 추론에 쓸 수 있다.
        if (!source || !target) return;
        flowById.set(String(flow.id), flow);
        source.outgoing.push(flow);
        target.incoming.push(flow);
    });

    const hasArrived = (nodeId) => ARRIVED_STATUSES.indexOf(status[nodeId]) !== -1;
    const hasDeparted = (nodeId) => DEPARTED_STATUSES.indexOf(status[nodeId]) !== -1;
    const isPassThrough = (node) => !!node && !isActivityType(node.type);

    // 분기 판단 이력. 같은 간선이 회차에 따라 양쪽에 나타날 수 있으므로(반려 후 재실행) 확인이 우선한다.
    const confirmed = new Set((journal && journal.confirmedSequenceIds ? journal.confirmedSequenceIds : []).map(String));
    const rejected = new Set(
        (journal && journal.rejectedSequenceIds ? journal.rejectedSequenceIds : []).map(String).filter((id) => !confirmed.has(id))
    );
    const journalApplied = confirmed.size > 0 || rejected.size > 0;

    // 이 노드의 분기를 이력이 다뤘는가. 다뤘다면 추론으로 짐작하지 않고 이력이 고른 갈래만 쓴다.
    const isJournaledDecision = (node) => node.outgoing.some((flow) => confirmed.has(String(flow.id)) || rejected.has(String(flow.id)));

    // 1) 역방향 고정점 계산: "통과 노드만 거쳐서 도달 흔적이 있는 노드에 닿을 수 있는가".
    //    사이클(반려 루프)에서도 안전하도록 BFS 로 계산한다.
    const reaching = new Set();
    const reverseQueue = [];
    nodeById.forEach((node) => {
        if (hasArrived(node.id)) {
            reaching.add(node.id);
            reverseQueue.push(node.id);
        }
    });

    while (reverseQueue.length > 0) {
        const currentId = reverseQueue.shift();
        const current = nodeById.get(currentId);
        if (!current) continue;
        current.incoming.forEach((flow) => {
            const source = nodeById.get(flow.sourceId);
            // 액티비티는 자기 상태로만 도달 여부가 결정된다. 통과 노드만 전파한다.
            if (!source || reaching.has(source.id) || !isPassThrough(source)) return;
            reaching.add(source.id);
            reverseQueue.push(source.id);
        });
    }

    // 2) 정방향 전파: 토큰을 확실히 떠나보낸 노드에서 시작해 간선을 표시한다.
    const traversedFlowIds = new Set();

    const queue = [];
    const enqueued = new Set();
    const enqueue = (nodeId) => {
        if (enqueued.has(nodeId)) return;
        enqueued.add(nodeId);
        queue.push(nodeId);
    };

    nodeById.forEach((node) => {
        // 완료된 액티비티는 확실한 출발점이다.
        if (hasDeparted(node.id)) {
            enqueue(node.id);
            return;
        }
        // 시작 이벤트처럼 들어오는 간선이 없는 통과 노드는, 뒤쪽에 실행 흔적이 있으면 실행된 것이다.
        if (isPassThrough(node) && node.incoming.length === 0 && reaching.has(node.id)) {
            enqueue(node.id);
        }
    });

    while (queue.length > 0) {
        const currentId = queue.shift();
        const current = nodeById.get(currentId);
        if (!current || current.outgoing.length === 0) continue;

        let candidates;
        if (isJournaledDecision(current)) {
            // 이력 있으면 사실: 엔진이 실제로 고른 갈래만 지나간 것이다.
            // 선택되지 않은 갈래는 여기서 끊기므로 그 아래 구간도 함께 사라진다.
            candidates = current.outgoing.filter((flow) => confirmed.has(String(flow.id)));
        } else if (current.outgoing.length === 1) {
            // 갈래가 하나면 분기 판단이 필요 없다. 종료 이벤트로 가는 마지막 간선도 여기서 표시된다.
            candidates = current.outgoing;
        } else if (PARALLEL_GATEWAY_TYPES.indexOf(current.type) !== -1) {
            // 병렬 분기는 모든 갈래가 실행된다.
            candidates = current.outgoing;
        } else {
            // 배타/포함 분기(및 액티비티의 암시적 분기)는 실행 흔적에 닿는 갈래만 지나간 것으로 본다.
            // 어느 갈래도 흔적에 닿지 않으면(예: 양쪽 모두 종료 이벤트) 아무것도 표시하지 않는다.
            candidates = current.outgoing.filter((flow) => reaching.has(flow.targetId));
        }

        candidates.forEach((flow) => {
            traversedFlowIds.add(flow.id);
            const target = nodeById.get(flow.targetId);
            if (!target) return;
            if (isPassThrough(target)) {
                enqueue(target.id);
            }
        });
    }

    // 3) 이력이 확인한 간선은 사실이므로 무조건 포함한다.
    //    상태맵이 아직 갱신되지 않아 전파가 닿지 못한 구간도 이력이 있으면 그려져야 한다.
    const finalFlowIds = new Set(traversedFlowIds);
    confirmed.forEach((id) => {
        // 정의에 없는 시퀀스(정의가 바뀐 뒤의 과거 이력 등)는 그릴 수 없으므로 무시한다.
        if (flowById.has(id)) finalFlowIds.add(id);
    });

    // 통과 노드는 최종 간선 집합에서 다시 도출한다. 간선 하나라도 지나갔다면
    // 그 양 끝의 통과 노드는 경로 위에 있다.
    const finalNodeIds = new Set();
    finalFlowIds.forEach((flowId) => {
        const flow = flowById.get(String(flowId));
        if (!flow) return;
        [flow.sourceId, flow.targetId].forEach((nodeId) => {
            const node = nodeById.get(nodeId);
            if (node && isPassThrough(node)) finalNodeIds.add(node.id);
        });
    });

    return {
        flowIds: Array.from(finalFlowIds),
        nodeIds: Array.from(finalNodeIds),
        journalApplied
    };
}

/**
 * 분기 판단 이력 이벤트들을 경로 계산에 쓸 수 있는 형태로 요약한다.
 *
 * - 실제로 지나간 것으로 볼 수 있는 것은 진행(advanced) 판단의 선택된 시퀀스뿐이다.
 *   대기(waiting)는 갈래를 골랐지만 아직 넘어가지 않았고, 진행 불가(undecided)는 아무 데도 가지 않았다.
 * - 선택되지 않은 시퀀스는 판단 결과와 무관하게 "그 회차에는 지나가지 않았다"는 사실이다.
 *
 * @param {Array} decisionEvents 판단 이력 이벤트 목록(각 항목은 data 를 갖거나 data 자체)
 * @returns {{confirmedSequenceIds: string[], rejectedSequenceIds: string[]}}
 */
export function summarizeDecisionJournal(decisionEvents) {
    const confirmed = new Set();
    const rejected = new Set();

    (decisionEvents || []).forEach((event) => {
        const data = event && event.data ? event.data : event;
        if (!data || typeof data !== 'object') return;

        if (data.outcome === 'advanced') {
            (data.selectedSequenceIds || []).forEach((id) => confirmed.add(String(id)));
        }
        (data.unselectedSequenceIds || []).forEach((id) => rejected.add(String(id)));
    });

    return {
        confirmedSequenceIds: Array.from(confirmed),
        rejectedSequenceIds: Array.from(rejected).filter((id) => !confirmed.has(id))
    };
}

export default computeTraversedPath;
