/**
 * 인계받은 방의 '이전 대화'가 거슬러 오를 방 목록(화면과 무관한 순수 계산).
 *
 * 규칙은 에이전트 이력(process-gpt-deepagents core/chat/handover_history.py)과 같다.
 *  - handover_events 의 to_room_id → from_room_id 를 따라 시작 방까지 올라간다.
 *  - 각 방은 그 방에서 다음 방으로 인계한 시각까지만 읽는다.
 *  - 넘긴 방이 그 전에 여러 명에게 나눠 주고(같은 group_id) 아직 모으지 않았으면 이 인계는 합류다.
 *    작업 흐름 그림(handoverFlow)의 합류 규칙과 같다. 합류면 나눠 준 갈래 방들과 그 뒤로 이어 넘긴
 *    방들도 갈래별로 싣는다. 갈래 방은 다음 방으로 넘긴 시각까지, 끝 방은 합류 시각까지다.
 *
 * events(col, roomId) 는 그 열이 roomId 인 handover_events 행을 돌려주는 함수다.
 */

// 인계 체인이 순환하거나 비정상적으로 길어도 화면이 멈추지 않게 거슬러 오를 단계 수를 제한한다.
export const MAX_DEPTH = 20;

const time = (e) => new Date(e?.occurred_at || 0).getTime();
const before = (e, at) => time(e) < new Date(at || 0).getTime();

async function eventsOf(events, col, roomId) {
    const rows = (await events(col, roomId)) || [];
    return [...rows].sort((a, b) => time(a) - time(b));
}

/** ev 가 합류면 모으는 묶음 id. 넘긴 방이 ev 전에 나눠 준 묶음 중 아직 다음 인계로 모이지 않은 것. */
export async function openGroup(events, ev) {
    let open = null;
    for (const e of await eventsOf(events, 'from_room_id', ev.from_room_id)) {
        if (!before(e, ev.occurred_at) || (ev.group_id && e.group_id === ev.group_id)) continue;
        if (open && e.group_id === open) continue;
        // 묶음이 아닌 인계나 다른 묶음이 오면 앞 묶음은 거기서 모였다.
        open = e.group_id || null;
    }
    return open;
}

async function branchesOf(events, ev, groupId, seen) {
    const out = [];
    const members = (await eventsOf(events, 'from_room_id', ev.from_room_id)).filter((e) => e.group_id === groupId);
    for (const m of members) {
        const rooms = [];
        const queue = [[m.to_room_id, m]];
        while (queue.length && rooms.length < MAX_DEPTH) {
            const [roomId, came] = queue.shift();
            if (!roomId || seen.has(roomId)) continue;
            seen.add(roomId);
            const nexts = (await eventsOf(events, 'from_room_id', roomId)).filter((e) => before(e, ev.occurred_at));
            rooms.push({
                roomId,
                until: nexts.length ? nexts[0].occurred_at : ev.occurred_at,
                handedBy: came.from_user_name || '',
                handedTo: came.to_user_name || ''
            });
            for (const e of nexts) queue.push([e.to_room_id, e]);
        }
        if (rooms.length) {
            out.push({ label: [m.to_user_name, m.next_activity_label].filter(Boolean).join(' · '), rooms });
        }
    }
    return out;
}

/**
 * 이 방에서 시작 방까지, 시작 방 → 바로 앞 방 순서의 인계 고리.
 * 각 항목: { roomId, until, handedBy, handedTo, branches } — branches 는 이 인계가 합류일 때 모이는 갈래들.
 * fallbackFrom: 인계 행을 아직 못 읽을 때(방 context 의 from_room_id) 첫 단계에만 쓴다.
 */
export async function resolveHandoverChain(events, roomId, fallbackFrom = null) {
    const chain = [];
    const seen = new Set([roomId]);
    let toRoomId = roomId;
    for (let i = 0; i < MAX_DEPTH; i++) {
        const ev = (await eventsOf(events, 'to_room_id', toRoomId))[0] || null;
        const fromRoomId = ev?.from_room_id || fallbackFrom;
        if (!fromRoomId || seen.has(fromRoomId)) break;
        seen.add(fromRoomId);
        const group = ev ? await openGroup(events, ev) : null;
        chain.unshift({
            roomId: fromRoomId,
            until: ev?.occurred_at || null,
            handedBy: ev?.from_user_name || '',
            handedTo: ev?.to_user_name || '',
            branches: group ? await branchesOf(events, ev, group, seen) : []
        });
        toRoomId = fromRoomId;
        fallbackFrom = null;
    }
    return chain;
}
