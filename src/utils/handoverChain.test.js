import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHandoverChain } from './handoverChain.js';

// 홍길동이 생산 계획(P)을 1공장(이팀장)·2공장(박대리)에게 나눠 준 뒤, 같은 방에서 결과를 모아
// 최과장(J)에게 넘긴다. 2공장은 중간에 김주임(C2)에게 한 번 더 넘겼다.
const G = 'g-1';
const ROWS = [
    { from_room_id: 'P', to_room_id: 'B1', occurred_at: '2026-10-27T01:00:00Z', from_user_name: '홍길동', to_user_name: '이팀장', group_id: G, next_activity_label: '1공장 생산' },
    { from_room_id: 'P', to_room_id: 'B2', occurred_at: '2026-10-27T01:00:00.200Z', from_user_name: '홍길동', to_user_name: '박대리', group_id: G, next_activity_label: '2공장 생산' },
    { from_room_id: 'B2', to_room_id: 'C2', occurred_at: '2026-10-27T02:00:00Z', from_user_name: '박대리', to_user_name: '김주임', group_id: null },
    { from_room_id: 'P', to_room_id: 'J', occurred_at: '2026-10-27T03:00:00Z', from_user_name: '홍길동', to_user_name: '최과장', group_id: null }
];
const eventsOf = (rows) => async (col, id) => rows.filter((r) => r[col] === id);

test('합류로 받은 방은 나눠 준 갈래들을 갈래별로 받는다', async () => {
    const chain = await resolveHandoverChain(eventsOf(ROWS), 'J');
    assert.equal(chain.length, 1);
    assert.equal(chain[0].roomId, 'P');
    assert.deepEqual(
        chain[0].branches.map((b) => [b.label, b.rooms.map((r) => r.roomId)]),
        [
            ['이팀장 · 1공장 생산', ['B1']],
            ['박대리 · 2공장 생산', ['B2', 'C2']]
        ]
    );
});

test('갈래 방은 다음 방으로 넘긴 시각까지, 끝 방은 합류 시각까지다', async () => {
    const [p] = await resolveHandoverChain(eventsOf(ROWS), 'J');
    const until = Object.fromEntries(p.branches.flatMap((b) => b.rooms.map((r) => [r.roomId, r.until])));
    assert.equal(until.B1, '2026-10-27T03:00:00Z');
    assert.equal(until.B2, '2026-10-27T02:00:00Z');
    assert.equal(until.C2, '2026-10-27T03:00:00Z');
});

test('갈래 방은 형제 갈래를 받지 않는다', async () => {
    const chain = await resolveHandoverChain(eventsOf(ROWS), 'B1');
    assert.deepEqual(chain.map((c) => [c.roomId, c.branches.length]), [['P', 0]]);
});

test('나눠 주기 전에 넘긴 인계는 합류가 아니다', async () => {
    const rows = [{ from_room_id: 'P', to_room_id: 'E', occurred_at: '2026-10-27T00:55:00Z', group_id: null }, ...ROWS];
    const chain = await resolveHandoverChain(eventsOf(rows), 'E');
    assert.equal(chain[0].branches.length, 0);
});

test('갈래가 없는 한 줄 인계는 예전과 같다', async () => {
    const rows = [
        { from_room_id: 'A', to_room_id: 'B', occurred_at: '2026-10-20T07:09:30Z', from_user_name: '홍길동', to_user_name: '문서 생성 전문가' },
        { from_room_id: 'B', to_room_id: 'C', occurred_at: '2026-10-20T07:11:35Z', from_user_name: '홍길동', to_user_name: '이팀장' }
    ];
    const chain = await resolveHandoverChain(eventsOf(rows), 'C');
    assert.deepEqual(
        chain.map((c) => [c.roomId, c.until, c.handedTo, c.branches.length]),
        [
            ['A', '2026-10-20T07:09:30Z', '문서 생성 전문가', 0],
            ['B', '2026-10-20T07:11:35Z', '이팀장', 0]
        ]
    );
});

test('인계 행을 아직 못 읽으면 방 context 의 넘긴 방을 첫 단계로 쓴다', async () => {
    const chain = await resolveHandoverChain(eventsOf([]), 'X', 'W');
    assert.deepEqual(chain.map((c) => c.roomId), ['W']);
});
