/**
 * 인계 스레드 한 건을 작업 흐름 그림으로 펴는 계산(화면과 무관한 순수 함수).
 *
 * 카드 = 임무(받은 일 하나), 연결선 = 전달(인계), 연결선 이름 = 배분 조건(인계 사유).
 * 시작 방이 맨 위 카드이고, 인계 행마다 받은 방이 카드 하나가 된다.
 *
 * 합류는 따로 설정하지 않는다. 어떤 방에서 여러 명에게 나눠 준(같은 group_id) 뒤 그 방에서
 * 다음 인계가 일어나면, 나눠 준 갈래들의 끝 카드에서 그 다음 일로 모이는 것으로 그린다.
 * 식별 화면이 같은 기록을 병렬 분기 → 합류로 도출하는 것과 같은 읽기다.
 */

export type FlowStatus = 'waiting' | 'progress' | 'done';

export interface FlowRow {
    id: string;
    from_room_id: string | null;
    to_room_id: string | null;
    to_task_id: string | null;
    from_user_id: string | null;
    from_user_name: string | null;
    from_is_agent?: boolean | null;
    to_user_id: string | null;
    to_user_name: string | null;
    to_is_agent: boolean | null;
    activity_label: string | null;
    next_activity_label: string | null;
    instruction: string | null;
    reason: string | null;
    group_id: string | null;
    occurred_at: string;
    closed_at?: string | null;
}

export interface FlowContext {
    /** to_task_id → { status, end_date } */
    tasks: Record<string, { status?: string | null; end_date?: string | null }>;
    /** 받은 사람이 아직 그 방을 열지 않았는가 (방 id → true) */
    unread: Record<string, boolean>;
    /** 사용자 id → 부서 */
    departments: Record<string, string>;
    /** 방 id → 그 방에서 마지막으로 남은 사람·에이전트 메시지(한 줄) */
    lastMessage: Record<string, string>;
}

export interface FlowHistoryItem {
    at: string;
    text: string;
}

export interface FlowNode {
    id: string;
    roomId: string;
    activity: string;
    who: string;
    whoId: string;
    department: string;
    isAgent: boolean;
    instruction: string;
    result: string;
    status: FlowStatus;
    history: FlowHistoryItem[];
    receivedAt: string;
}

export interface FlowEdge {
    from: string;
    to: string;
    label: string;
    join: boolean;
}

const DONE = new Set(['DONE', 'COMPLETED', 'SUBMITTED']);
const ROOT = 'root';

function byTime(a: FlowRow, b: FlowRow) {
    return String(a.occurred_at).localeCompare(String(b.occurred_at));
}

function oneLine(text: string | null | undefined, max = 60): string {
    const s = String(text || '')
        .replace(/[*#>`_]/g, '')
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0);
    if (!s) return '';
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function buildFlow(originRoomId: string, input: FlowRow[], ctx: FlowContext): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const rows = [...input].filter((r) => r.to_room_id).sort(byTime);
    if (!rows.length) return { nodes: [], edges: [] };

    const nodeOfRoom: Record<string, string> = { [originRoomId]: ROOT };
    const outgoing = (roomId: string) => rows.filter((r) => r.from_room_id === roomId);

    const first = rows[0];
    const root: FlowNode = {
        id: ROOT,
        roomId: originRoomId,
        activity: first.activity_label || '—',
        who: first.from_user_name || '',
        whoId: first.from_user_id || '',
        department: ctx.departments[first.from_user_id || ''] || '',
        isAgent: !!first.from_is_agent,
        instruction: '',
        result: '',
        status: 'done',
        history: [],
        receivedAt: first.occurred_at
    };
    const nodes: FlowNode[] = [root];

    for (const r of rows) {
        const roomId = r.to_room_id as string;
        if (nodeOfRoom[roomId]) continue;
        nodeOfRoom[roomId] = r.id;
        const handedOn = outgoing(roomId);
        const task = r.to_task_id ? ctx.tasks[r.to_task_id] : undefined;
        const taskDone = DONE.has(String(task?.status || '').toUpperCase());
        let status: FlowStatus;
        if (r.closed_at || handedOn.length || taskDone) status = 'done';
        else if (!r.to_is_agent && ctx.unread[roomId]) status = 'waiting';
        else status = 'progress';
        nodes.push({
            id: r.id,
            roomId,
            activity: r.next_activity_label || '—',
            who: r.to_user_name || r.to_user_id || '',
            whoId: r.to_user_id || '',
            department: ctx.departments[r.to_user_id || ''] || '',
            isAgent: !!r.to_is_agent,
            instruction: oneLine(r.instruction, 80),
            result: '',
            status,
            history: [],
            receivedAt: r.occurred_at
        });
    }

    const byId: Record<string, FlowNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));

    // 결과 요약 — 다음 사람에게 넘길 때 적은 '지금까지 한 일'(활동명과 다를 때), 없으면 그 방의 마지막 메시지
    for (const n of nodes) {
        if (n.id === ROOT) continue;
        const handed = outgoing(n.roomId);
        const done = handed.map((h) => oneLine(h.activity_label)).find((d) => d && d !== n.activity);
        n.result = n.status === 'done' ? done || oneLine(ctx.lastMessage[n.roomId]) : '';
    }

    // 작업 히스토리 — 받음 · 다시 넘김 · 끝남
    for (const n of nodes) {
        const items: FlowHistoryItem[] = [];
        if (n.id !== ROOT) items.push({ at: n.receivedAt, text: '업무 받음' });
        const handed = outgoing(n.roomId);
        const seenGroups = new Set<string>();
        for (const h of handed) {
            if (h.group_id) {
                if (seenGroups.has(h.group_id)) continue;
                seenGroups.add(h.group_id);
                const names = handed.filter((x) => x.group_id === h.group_id).map((x) => x.to_user_name || '');
                items.push({ at: h.occurred_at, text: `${names.join(', ')}에게 나눠 줌` });
            } else {
                items.push({ at: h.occurred_at, text: `${h.to_user_name || ''}에게 넘김` });
            }
        }
        if (n.id !== ROOT && !handed.length && n.status === 'done') {
            const r = rows.find((x) => x.id === n.id);
            const end = r?.closed_at || (r?.to_task_id ? ctx.tasks[r.to_task_id]?.end_date : null);
            if (end) items.push({ at: String(end), text: '완료' });
        }
        n.history = items;
    }

    // 연결선 — 넘긴 방의 카드 → 받은 방의 카드. 나눠 준 뒤 같은 방에서 다시 넘기면 합류.
    const edges: FlowEdge[] = [];
    const childrenOf = (id: string) => edges.filter((e) => e.from === id).map((e) => e.to);
    const subtree = (id: string): string[] => {
        const out = [id];
        for (const c of childrenOf(id)) out.push(...subtree(c));
        return out;
    };
    const sinks = (id: string) => subtree(id).filter((x) => !edges.some((e) => e.from === x));

    // 나눠 준 묶음 중 아직 다음 일로 모이지 않은 것. 묶음이 모이는 지점은 처음 한 번뿐이다.
    const joined = new Set<string>();
    // 합류 지점이 다시 여러 명에게 나눠 주는 인계면, 그 묶음의 형제들도 같은 끝에서 이어진다
    const joinEndsOfGroup: Record<string, string[]> = {};

    for (const r of rows) {
        const to = nodeOfRoom[r.to_room_id as string];
        if (to !== r.id) continue; // 같은 방이 두 번 나오면 처음 것만
        const from = r.from_room_id && nodeOfRoom[r.from_room_id] ? nodeOfRoom[r.from_room_id] : ROOT;
        const label = oneLine(r.reason, 40);

        let ends: string[] | null = r.group_id ? joinEndsOfGroup[r.group_id] || null : null;
        if (!ends) {
            const open = rows.filter(
                (x) =>
                    x.from_room_id === r.from_room_id &&
                    x.group_id &&
                    x.group_id !== r.group_id &&
                    byTime(x, r) < 0 &&
                    !joined.has(x.group_id)
            );
            const group = open.length ? (open[open.length - 1].group_id as string) : null;
            if (group) {
                joined.add(group);
                const heads = rows.filter((x) => x.group_id === group).map((x) => nodeOfRoom[x.to_room_id as string]);
                ends = Array.from(new Set(heads.flatMap((h) => sinks(h))));
                if (r.group_id) joinEndsOfGroup[r.group_id] = ends;
            }
        }
        if (ends && ends.length) {
            for (const e of ends) edges.push({ from: e, to, label, join: true });
        } else {
            edges.push({ from, to, label, join: false });
        }
    }

    return { nodes: nodes.filter((n) => byId[n.id]), edges };
}

export interface FlowLayout {
    positions: Record<string, { x: number; y: number; height: number }>;
    width: number;
    height: number;
}

export const CARD_WIDTH = 232;
const GAP_X = 20;
const GAP_Y = 56;

/** 카드 높이 추정 — 줄 수로 정한다(그리기 전에 연결선 좌표가 필요해서). */
export function cardHeight(n: FlowNode): number {
    let h = 84;
    if (n.instruction) h += 46;
    if (n.result) h += 30;
    if (n.history.length) h += 24 + n.history.length * 20;
    return h;
}

/** 위에서 아래로 쌓는 층 배치. 층 = 시작 카드에서 가장 긴 경로의 길이, 층 안 순서는 부모 위치 평균. */
export function layoutFlow(nodes: FlowNode[], edges: FlowEdge[]): FlowLayout {
    const preds: Record<string, string[]> = {};
    const succs: Record<string, string[]> = {};
    for (const n of nodes) {
        preds[n.id] = [];
        succs[n.id] = [];
    }
    for (const e of edges) {
        if (!preds[e.to] || !succs[e.from]) continue;
        preds[e.to].push(e.from);
        succs[e.from].push(e.to);
    }

    const layer: Record<string, number> = {};
    const visit = (id: string, stack: Set<string>): number => {
        if (layer[id] !== undefined) return layer[id];
        if (stack.has(id)) return 0;
        stack.add(id);
        const l = preds[id].length ? Math.max(...preds[id].map((p) => visit(p, stack))) + 1 : 0;
        stack.delete(id);
        layer[id] = l;
        return l;
    };
    nodes.forEach((n) => visit(n.id, new Set()));

    // 처음 순서: 시작에서 깊이 우선으로 만난 순서
    const order: Record<string, number> = {};
    let k = 0;
    const dfs = (id: string) => {
        if (order[id] !== undefined) return;
        order[id] = k++;
        succs[id].forEach(dfs);
    };
    nodes.forEach((n) => dfs(n.id));

    const layers: string[][] = [];
    for (const n of nodes) (layers[layer[n.id]] = layers[layer[n.id]] || []).push(n.id);
    layers.forEach((ids) => ids.sort((a, b) => order[a] - order[b]));

    // 가로 위치: 층마다 부모 평균 위치를 원하는 자리로 두고, 겹치지 않게 민다
    const x: Record<string, number> = {};
    layers.forEach((ids) => ids.forEach((id, i) => (x[id] = i)));
    for (let pass = 0; pass < 4; pass++) {
        for (const ids of layers) {
            const want = ids.map((id) => ({
                id,
                v: preds[id].length ? preds[id].reduce((s, p) => s + x[p], 0) / preds[id].length : x[id]
            }));
            want.sort((a, b) => a.v - b.v || order[a.id] - order[b.id]);
            let prev = -Infinity;
            for (const w of want) {
                const v = Math.max(w.v, prev + 1);
                x[w.id] = v;
                prev = v;
            }
            // 원하는 자리 평균에서 벗어난 만큼 되돌려 가운데를 맞춘다
            const shift = want.reduce((s, w) => s + (x[w.id] - w.v), 0) / want.length;
            if (shift > 0) for (const w of want) x[w.id] -= shift;
            const sorted = [...want].sort((a, b) => x[a.id] - x[b.id]);
            for (let i = 1; i < sorted.length; i++) {
                if (x[sorted[i].id] < x[sorted[i - 1].id] + 1) x[sorted[i].id] = x[sorted[i - 1].id] + 1;
            }
        }
    }
    const minX = Math.min(...Object.values(x));
    const byId: Record<string, FlowNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const positions: FlowLayout['positions'] = {};
    let y = 0;
    let maxX = 0;
    for (const ids of layers) {
        const h = Math.max(...ids.map((id) => cardHeight(byId[id])));
        for (const id of ids) {
            const px = (x[id] - minX) * (CARD_WIDTH + GAP_X);
            positions[id] = { x: px, y, height: cardHeight(byId[id]) };
            maxX = Math.max(maxX, px + CARD_WIDTH);
        }
        y += h + GAP_Y;
    }
    return { positions, width: maxX, height: Math.max(0, y - GAP_Y) };
}
