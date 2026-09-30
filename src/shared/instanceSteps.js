/**
 * 인스턴스 진행 단계 — 정의의 순서와 업무 상태로 "지금 어디쯤인지" 를 만든다.
 *
 * 화면(InstanceFlow)에서 떼어 둔 까닭은 둘이다. 같은 계산을 띠 · 알약 · 목록 세 모양이
 * 함께 쓰고, 순서와 상태를 가르는 규칙은 틀리기 쉬워 따로 시험해야 한다.
 */

/**
 * 이미 시작됐지만 아직 끝나지 않은 업무의 상태.
 *
 * TODO 는 넣지 않는다. 엔진은 인스턴스를 시작할 때 닿을 수 있는 뒤 단계를 모두
 * TODO 로 미리 만들어 둔다(예정 업무). 넣으면 배타 게이트웨이의 가지와 마지막
 * 단계까지 한꺼번에 '진행 중' 이 된다.
 */
export const LIVE_STATUSES = new Set(['IN_PROGRESS', 'SUBMITTED', 'PENDING', 'NEW', 'RUNNING', 'Running']);

/** 업무 상태 → 단계 상태('done' | 'current' | 'skipped' | 'todo'). */
export function stepStateOf(status) {
    if (status === 'DONE') return 'done';
    if (status === 'CANCELLED') return 'skipped';
    if (LIVE_STATUSES.has(status)) return 'current';
    return 'todo';
}

/** 여러 갈래 중 고르는 게이트웨이. 병렬 게이트웨이는 모든 가지를 함께 여니 넣지 않는다. */
const CHOOSING_GATEWAYS = new Set(['exclusiveGateway', 'inclusiveGateway', 'eventBasedGateway']);

/**
 * 흐름 그래프 — 다음 · 앞 노드와 '시작에서 가장 먼 거리'(깊이).
 *
 * 되돌아가는 흐름(반려 → 다시 작성 같은 고리)은 깊이를 셀 때 뺀다. 빼지 않으면
 * 고리를 돌 때마다 깊이가 늘어 끝나지 않는다. 가지를 가를 때도 이 흐름은 따라가지 않는다 —
 * 따라가면 한 가지에서 되돌아간 앞 단계까지 그 가지의 것이 된다.
 */
function flowGraph(sequences, events) {
    const next = new Map();
    const prev = new Map();
    (sequences || []).forEach((seq) => {
        if (!seq || !seq.source || !seq.target) return;
        if (!next.has(seq.source)) next.set(seq.source, []);
        next.get(seq.source).push(seq.target);
        if (!prev.has(seq.target)) prev.set(seq.target, []);
        prev.get(seq.target).push(seq.source);
    });

    const depth = new Map();
    const backEdges = new Set();
    const start = (events || []).find((e) => e && e.type === 'startEvent');
    if (!start || next.size === 0) return { next, prev, depth, backEdges };

    // 깊이우선 방문으로 되돌아가는 흐름을 찾고, 끝난 차례(postorder)를 모은다.
    const visiting = new Set();
    const visited = new Set();
    const postorder = [];
    const visit = (id) => {
        visiting.add(id);
        (next.get(id) || []).forEach((to) => {
            if (visiting.has(to)) backEdges.add(`${id}>${to}`);
            else if (!visited.has(to)) visit(to);
        });
        visiting.delete(id);
        visited.add(id);
        postorder.push(id);
    };
    visit(start.id);

    // 되돌아가는 흐름을 뺀 나머지는 고리가 없다. 위상 순서로 가장 먼 거리를 잰다.
    depth.set(start.id, 0);
    postorder.reverse().forEach((from) => {
        const d = depth.get(from);
        if (d === undefined) return;
        (next.get(from) || []).forEach((to) => {
            if (backEdges.has(`${from}>${to}`)) return;
            if ((depth.get(to) ?? -1) < d + 1) depth.set(to, d + 1);
        });
    });
    return { next, prev, depth, backEdges };
}

/**
 * 정의에 적힌 흐름 순서대로 액티비티를 늘어놓는다.
 *
 * 정의 파일의 배열 순서는 그린 순서라 흐름과 다를 수 있다. 시작 이벤트에서 흐름을
 * 따라가며 '시작에서 가장 먼 거리' 를 단계의 깊이로 삼는다. 깊이우선으로 방문한 차례를
 * 그대로 쓰면 게이트웨이 뒤에서 한 가지를 끝까지 파고들어, 가지들이 모이는 마지막 단계가
 * 다른 가지들보다 먼저 나왔다(건축허가 → 최종 산출물 → 농업 → 교통).
 *
 * 흐름에서 닿지 못한 것(끊긴 정의 등)은 뒤에 붙인다 — 빠뜨리는 것보다 낫다.
 */
export function orderActivities(activities, sequences, events, graph = flowGraph(sequences, events)) {
    const all = (activities || []).filter(Boolean);
    if (all.length === 0) return [];
    const { depth } = graph;
    if (depth.size === 0) return all.slice();

    const indexOf = new Map(all.map((a, i) => [a.id, i]));
    const reached = all.filter((a) => depth.has(a.id));
    reached.sort((a, b) => depth.get(a.id) - depth.get(b.id) || indexOf.get(a.id) - indexOf.get(b.id));
    return [...reached, ...all.filter((a) => !depth.has(a.id))];
}

/**
 * 가지 않게 된 가지의 노드 id.
 *
 * 엔진은 게이트웨이 뒤의 가지를 모두 TODO 로 미리 만들어 두고, 고르지 않은 가지를
 * 지우지 않는다. 그대로 두면 이미 교통 민원으로 갈라진 뒤에도 '다음: 건축허가 민원 처리'
 * 처럼 가지 않을 단계가 남은 일로 보인다.
 *
 * 고르는 게이트웨이의 가지 가운데 하나라도 시작됐으면 나머지 가지는 간 적 없는 가지다.
 * 그 가지에서만 닿는 뒤 단계도 함께 빠진다(모든 앞 단계가 빠진 단계) — 가지들이 다시
 * 모이는 단계는 고른 가지에서도 닿으므로 남는다.
 */
export function untakenBranches({ sequences, gateways, started }) {
    const { next, prev } = flowGraph(sequences, []);
    const typeOf = new Map((gateways || []).filter(Boolean).map((g) => [g.id, g.type]));

    // 가지 머리에서 흐름을 따라가며 시작된 액티비티가 있는지 — 가지가 게이트웨이나 이벤트로
    // 시작하는 경우도 있어, 액티비티를 만날 때까지 게이트웨이 · 이벤트를 건너 내려간다.
    const branchStarted = (head) => {
        const seen = new Set();
        const stack = [head];
        while (stack.length) {
            const id = stack.pop();
            if (seen.has(id)) continue;
            seen.add(id);
            if (started.has(id)) return true;
            if (typeOf.has(id)) (next.get(id) || []).forEach((t) => stack.push(t));
        }
        return false;
    };

    const skipped = new Set();
    typeOf.forEach((type, gw) => {
        if (!CHOOSING_GATEWAYS.has(type)) return;
        const heads = next.get(gw) || [];
        const taken = heads.filter(branchStarted);
        if (taken.length === 0) return;
        heads.filter((h) => !taken.includes(h)).forEach((h) => skipped.add(h));
    });
    if (skipped.size === 0) return skipped;

    // 앞 단계가 모두 빠진(그리고 시작되지 않은) 단계도 빠진다. 더 늘지 않을 때까지.
    let grew = true;
    while (grew) {
        grew = false;
        prev.forEach((from, id) => {
            if (skipped.has(id) || started.has(id)) return;
            if (from.length > 0 && from.every((f) => skipped.has(f))) {
                skipped.add(id);
                grew = true;
            }
        });
    }
    return skipped;
}

/**
 * 고르는 게이트웨이마다 가지(갈래)에 속한 노드 — 액티비티 id → { id, name, lane, lanes }.
 *
 * 한 가지의 머리에서만 닿고 다른 가지의 머리에서는 닿지 않는 노드가 그 가지의 것이다.
 * 가지들이 다시 모이는 단계(와 그 뒤)는 어느 가지에서나 닿으므로 가지에 들지 않는다.
 * 게이트웨이가 겹치면(가지 안의 분기) 바깥 게이트웨이의 가지로 묶는다.
 */
function branchLanes(gateways, graph) {
    const { next, depth, backEdges } = graph;
    const reach = (head) => {
        const seen = new Set();
        const stack = [head];
        while (stack.length) {
            const id = stack.pop();
            if (seen.has(id)) continue;
            seen.add(id);
            (next.get(id) || []).forEach((to) => {
                if (!backEdges.has(`${id}>${to}`)) stack.push(to);
            });
        }
        return seen;
    };

    const laneOf = new Map();
    (gateways || [])
        .filter((g) => g && CHOOSING_GATEWAYS.has(g.type) && (next.get(g.id) || []).length > 1)
        .sort((a, b) => (depth.get(a.id) ?? Infinity) - (depth.get(b.id) ?? Infinity))
        .forEach((g) => {
            const heads = next.get(g.id);
            const reached = heads.map(reach);
            reached.forEach((set, lane) => {
                set.forEach((id) => {
                    if (laneOf.has(id)) return;
                    if (reached.some((other, j) => j !== lane && other.has(id))) return;
                    laneOf.set(id, { id: g.id, name: g.name || '', lane, lanes: heads.length });
                });
            });
        });
    return laneOf;
}

/**
 * 단계 목록을 만든다.
 *
 * 같은 단계를 다시 한 경우(반려 후 재작성 등)는 가장 최근 업무의 상태를 쓴다.
 * 게이트웨이에서 고르지 않은 가지와, 인스턴스가 끝난 뒤에도 남은 예정 단계는 지우지 않고
 * '건너뜀'(skipped) 으로 둔다 — 흐름 전체를 보여 주되 어느 쪽으로 갔는지가 보여야 한다.
 * 가지에 속한 단계에는 branch({ id, name, lane, lanes }) 가 붙는다.
 *
 * @param {object} p
 * @param {Array} p.activities, p.sequences, p.events  정의
 * @param {Array} [p.gateways]  정의의 게이트웨이(시작 · 끝 이벤트가 함께 담겨 오기도 한다)
 * @param {Array} p.workList  업무 목록(tracingTag · status · taskId · startDate · endDate)
 * @param {(work) => string} [p.whoOf]  업무를 맡은 사람의 이름
 * @param {string} [p.mineTaskId]  지금 내 차례인 업무
 * @param {boolean} [p.finished]  인스턴스가 끝났는가
 */
export function buildSteps({ activities, sequences, events, gateways, workList, whoOf, mineTaskId, finished }) {
    const latest = new Map();
    const at = (x) => new Date((x && (x.endDate || x.startDate)) || 0).getTime();
    (workList || []).forEach((w) => {
        const key = w && (w.tracingTag || (w.task && w.task.activity_id));
        if (!key) return;
        const prev = latest.get(key);
        if (!prev || at(w) >= at(prev)) latest.set(key, w);
    });

    const started = new Set();
    latest.forEach((w, id) => {
        if (stepStateOf(w.status) !== 'todo') started.add(id);
    });
    const untaken = untakenBranches({ sequences, gateways, started });
    // 시작 이벤트가 events 가 아니라 gateways 에 담겨 오는 정의도 있다.
    const graph = flowGraph(sequences, [...(events || []), ...(gateways || [])]);
    const lanes = branchLanes(gateways, graph);

    return orderActivities(activities, sequences, null, graph).map((activity) => {
        const work = latest.get(activity.id);
        let state = work ? stepStateOf(work.status) : 'todo';
        if (state === 'todo' && (finished || untaken.has(activity.id))) state = 'skipped';
        return {
            id: activity.id,
            name: activity.name || activity.id,
            who: (work && whoOf ? whoOf(work) : '') || activity.role || '',
            state,
            taskId: work ? work.taskId : null,
            mine: !!(work && mineTaskId && work.taskId === mineTaskId),
            branch: lanes.get(activity.id) || null
        };
    });
}

/**
 * 화면에 그릴 줄 — 가지 밖의 단계는 한 줄, 한 게이트웨이의 가지들은 한 묶음.
 *
 * 묶음은 가지의 첫 단계가 나오는 자리에 둔다. 가지마다 속한 단계를 흐름 순서대로 담고,
 * 가지의 상태는 taken(간 가지) · skipped(가지 않은 가지) · open(아직 고르기 전) 이다.
 *
 * @returns {Array<{ type: 'step', step } | { type: 'branch', id, name, decided, lanes: Array<{ lane, state, steps }> }>}
 */
export function groupSteps(steps) {
    const out = [];
    const groups = new Map();
    (steps || []).forEach((step) => {
        const b = step.branch;
        if (!b) {
            out.push({ type: 'step', step });
            return;
        }
        let group = groups.get(b.id);
        if (!group) {
            group = {
                type: 'branch',
                id: b.id,
                name: b.name,
                lanes: Array.from({ length: b.lanes }, (_, lane) => ({ lane, state: 'open', steps: [] }))
            };
            groups.set(b.id, group);
            out.push(group);
        }
        group.lanes[b.lane].steps.push(step);
    });

    groups.forEach((group) => {
        // 머리가 게이트웨이 · 이벤트뿐이라 액티비티가 없는 가지는 그릴 것이 없다.
        group.lanes = group.lanes.filter((l) => l.steps.length > 0);
        group.lanes.forEach((l) => {
            if (l.steps.some((s) => s.state === 'done' || s.state === 'current')) l.state = 'taken';
            else if (l.steps.every((s) => s.state === 'skipped')) l.state = 'skipped';
        });
        group.decided = group.lanes.some((l) => l.state === 'taken');
    });
    return out;
}

/**
 * 한 줄 요약에 쓸 값 — 지금 단계, 끝난 수, 전체 수.
 * 지금 단계가 없으면(모두 끝났거나 아직 시작 전) 다음에 올 단계를 대신 알린다.
 *
 * 전체 수는 실제로 거칠 단계 수다. 건너뛴 단계는 세지 않고, 아직 고르기 전인 분기는
 * 가지 하나(가장 긴 가지)만큼만 센다 — 세 갈래를 모두 세면 할 일이 부풀어 보인다.
 * 다음 단계가 고르기 전인 분기면 그 분기를 알린다({ name, branch: true }).
 */
export function summarizeSteps(steps) {
    const list = steps || [];
    const items = groupSteps(list);
    let total = 0;
    let next = null;
    items.forEach((item) => {
        if (item.type === 'step') {
            if (item.step.state !== 'skipped') total += 1;
            if (!next && item.step.state === 'todo') next = item.step;
            return;
        }
        const live = item.lanes.filter((l) => l.state !== 'skipped');
        const counted = item.decided ? live.filter((l) => l.state === 'taken') : live;
        const size = (l) => l.steps.filter((s) => s.state !== 'skipped').length;
        total += item.decided ? counted.reduce((n, l) => n + size(l), 0) : Math.max(0, ...counted.map(size));
        if (next) return;
        if (!item.decided && live.length > 1) {
            next = { name: item.name || `${live.length}갈래 중 하나`, branch: true };
            return;
        }
        const todo = counted.flatMap((l) => l.steps).find((s) => s.state === 'todo');
        if (todo) next = todo;
    });

    const done = list.filter((s) => s.state === 'done').length;
    const current = list.find((s) => s.state === 'current') || null;
    if (current) next = null;
    return { total, done, current, next, finished: list.length > 0 && !current && !next };
}
