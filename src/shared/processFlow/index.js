/**
 * 프로세스 정의를 **읽을 수 있는 흐름**으로 바꾼다.
 *
 * 왜 도면을 그리지 않는가
 *   BPMN 도면은 bpmn-js 로 그린다. 라이브러리만 수백 KB 이고, 좁고 세로로 긴
 *   화면에서는 확대·이동을 반복해야 겨우 읽힌다. 휴대폰에서 사용자가 알고 싶은
 *   것은 도형의 배치가 아니라 **누가, 무엇을, 어떤 순서로** 다.
 *
 *   그래서 같은 정의(JSON)를 위에서 아래로 흐르는 목록으로 편다. 갈림길은
 *   조건과 함께 갈래로 보여 준다. 라이브러리가 필요 없고 그대로 읽힌다.
 *
 * 이 규칙은 웹과 앱이 함께 쓴다 — 두 벌이면 같은 프로세스가 다르게 보인다.
 */

const asArray = (v) => (Array.isArray(v) ? v : []);
const textOf = (v) => String(v ?? '').trim();

/** 정의 안의 마디들을 식별자로 찾을 수 있게 모은다. */
function indexNodes(definition) {
    const nodes = new Map();

    for (const a of asArray(definition?.activities)) {
        if (!a?.id) continue;
        const mode = textOf(a.agentMode).toLowerCase();
        nodes.set(String(a.id), {
            id: String(a.id),
            kind: 'task',
            name: textOf(a.name) || String(a.id),
            role: textOf(a.role),
            // 사람이 하는 일인지 에이전트가 하는 일인지. 담당자 지정에 쓰인다.
            byAgent: Boolean(a.agent) || (Boolean(mode) && mode !== 'none')
        });
    }

    for (const g of asArray(definition?.gateways)) {
        if (!g?.id) continue;
        nodes.set(String(g.id), {
            id: String(g.id),
            kind: 'gateway',
            name: textOf(g.name) || '갈림길',
            role: textOf(g.role),
            byAgent: false
        });
    }

    for (const e of asArray(definition?.events)) {
        if (!e?.id) continue;
        nodes.set(String(e.id), {
            id: String(e.id),
            kind: 'event',
            name: textOf(e.name) || String(e.id),
            role: textOf(e.role),
            byAgent: false
        });
    }

    return nodes;
}

/** 어디서 시작하는가. 시작 이벤트가 없으면 아무도 가리키지 않는 마디에서 시작한다. */
function startId(definition, nodes) {
    const events = asArray(definition?.events);
    const start = events.find((e) => textOf(e.type).toLowerCase().includes('start'));
    if (start?.id) return String(start.id);

    const targets = new Set(asArray(definition?.sequences).map((s) => String(s?.target ?? '')));
    for (const id of nodes.keys()) {
        if (!targets.has(id)) return id;
    }
    return nodes.keys().next().value ?? '';
}

/** 갈래 이름. 조건이 있으면 그것이 곧 이름이다("승인", "반려"). */
function branchLabel(seq, index) {
    return textOf(seq?.condition) || textOf(seq?.name) || `갈래 ${index + 1}`;
}

/**
 * 정의를 흐름으로 편다.
 *
 * 갈림길에서는 갈래마다 따로 이어 간다. 이미 지난 마디를 다시 만나면 멈춘다 —
 * 되돌아가는 흐름(반려 → 재작성)에서 끝없이 도는 것을 막는다.
 *
 * @returns {{roles: string[], steps: Array<object>}}
 */
export function toFlow(definition) {
    const nodes = indexNodes(definition);
    if (!nodes.size) return { roles: [], steps: [] };

    const outgoing = new Map();
    for (const s of asArray(definition?.sequences)) {
        const from = String(s?.source ?? '');
        if (!from) continue;
        outgoing.set(from, [...(outgoing.get(from) || []), s]);
    }

    const walk = (id, seen) => {
        const steps = [];
        let current = id;

        while (current && nodes.has(current) && !seen.has(current)) {
            seen.add(current);
            const node = nodes.get(current);
            const next = outgoing.get(current) || [];

            // 시작·끝 이벤트는 줄을 차지할 뜻이 없다. 지나친다.
            if (node.kind !== 'event') {
                if (node.kind === 'gateway' && next.length > 1) {
                    steps.push({
                        ...node,
                        branches: next.map((seq, i) => ({
                            label: branchLabel(seq, i),
                            // 갈래마다 지나온 길을 따로 기억한다. 한쪽이 지났다고
                            // 다른 쪽 단계가 통째로 빠지면 안 된다.
                            steps: walk(String(seq.target ?? ''), new Set(seen))
                        }))
                    });
                    return steps;
                }
                steps.push({ ...node, branches: null });
            }

            current = next.length ? String(next[0].target ?? '') : '';
        }
        return steps;
    };

    const steps = walk(startId(definition, nodes), new Set());

    const roles = asArray(definition?.roles)
        .map((r) => textOf(r?.name))
        .filter(Boolean);

    return { roles: [...new Set(roles)], steps };
}

/** 흐름을 한 줄로 요약한다. 목록에서 훑을 때 쓴다. */
export function summarize(flow) {
    const count = (steps) =>
        asArray(steps).reduce(
            (n, s) => n + 1 + asArray(s.branches).reduce((m, b) => m + count(b.steps), 0),
            0
        );
    const total = count(flow?.steps);
    return total ? `${total}단계` : '단계 없음';
}

/**
 * 사람이 맡아야 하는 역할들.
 *
 * 프로세스를 시작할 때 담당자를 정해야 하는 것은 사람이 하는 단계뿐이다.
 * 에이전트가 하는 단계까지 물으면 쓸데없는 질문이 된다.
 */
export function humanRoles(flow) {
    const out = [];
    const visit = (steps) => {
        for (const s of asArray(steps)) {
            if (s.kind === 'task' && !s.byAgent && s.role) out.push(s.role);
            for (const b of asArray(s.branches)) visit(b.steps);
        }
    };
    visit(flow?.steps);
    return [...new Set(out)];
}
