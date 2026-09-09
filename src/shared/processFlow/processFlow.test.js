import test from 'node:test';
import assert from 'node:assert/strict';

import { humanRoles, summarize, toFlow } from './index.js';

const DEF = {
    roles: [{ name: '직원' }, { name: '팀장' }, { name: '인사팀' }],
    events: [
        { id: 'start_event', name: '시작', type: 'startEvent' },
        { id: 'end_event', name: '종료', type: 'endEvent' }
    ],
    activities: [
        { id: 'apply', name: '휴가 신청서 작성', role: '직원', agentMode: 'none' },
        { id: 'review', name: '검토 및 승인', role: '팀장' },
        { id: 'register', name: '휴가 등록', role: '인사팀' },
        { id: 'reject', name: '반려 통보', role: '팀장', agent: 'bot-1' }
    ],
    gateways: [{ id: 'decision', name: '검토 결정', type: 'exclusiveGateway' }],
    sequences: [
        { source: 'start_event', target: 'apply' },
        { source: 'apply', target: 'decision' },
        { source: 'decision', target: 'review', condition: '승인' },
        { source: 'decision', target: 'reject', condition: '반려' },
        { source: 'review', target: 'register' },
        { source: 'register', target: 'end_event' }
    ]
};

test('시작에서 순서대로 편다 — 시작·끝 이벤트는 줄을 차지하지 않는다', () => {
    const flow = toFlow(DEF);
    assert.deepEqual(
        flow.steps.map((s) => s.name),
        ['휴가 신청서 작성', '검토 결정']
    );
});

test('갈림길은 조건과 함께 갈래로 보여 준다', () => {
    const gw = toFlow(DEF).steps[1];
    assert.equal(gw.kind, 'gateway');
    assert.deepEqual(
        gw.branches.map((b) => b.label),
        ['승인', '반려']
    );
    assert.deepEqual(
        gw.branches[0].steps.map((s) => s.name),
        ['검토 및 승인', '휴가 등록']
    );
    assert.deepEqual(
        gw.branches[1].steps.map((s) => s.name),
        ['반려 통보']
    );
});

test('갈래마다 지나온 길을 따로 센다 — 한쪽 때문에 다른 쪽이 빠지면 안 된다', () => {
    const gw = toFlow(DEF).steps[1];
    assert.equal(gw.branches[1].steps.length, 1);
});

test('되돌아가는 흐름에서 끝없이 돌지 않는다', () => {
    const loop = {
        activities: [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' }
        ],
        sequences: [
            { source: 'a', target: 'b' },
            { source: 'b', target: 'a' }
        ]
    };
    assert.deepEqual(
        toFlow(loop).steps.map((s) => s.name),
        ['A', 'B']
    );
});

test('역할 목록을 함께 준다', () => {
    assert.deepEqual(toFlow(DEF).roles, ['직원', '팀장', '인사팀']);
});

test('에이전트가 맡는 단계는 담당자를 묻지 않는다', () => {
    const agentOnly = {
        activities: [{ id: 'a', name: '자동 처리', role: '봇역할', agent: 'bot-1' }],
        sequences: []
    };
    assert.deepEqual(humanRoles(toFlow(agentOnly)), []);
});

test('사람이 맡는 역할만 담당자를 묻는다', () => {
    assert.deepEqual(humanRoles(toFlow(DEF)), ['직원', '팀장', '인사팀']);
});

test('한 줄 요약', () => {
    assert.equal(summarize(toFlow(DEF)), '5단계');
    assert.equal(summarize({ steps: [] }), '단계 없음');
});

test('정의가 없어도 깨지지 않는다', () => {
    assert.deepEqual(toFlow(null), { roles: [], steps: [] });
});
