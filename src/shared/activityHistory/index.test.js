import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateHistory, branchChoiceBetween, branchLabelBetween, formatHistoryTime } from './index.js';

// VM 「영업 제안서 승인」 정의 — 검토 → 갈림길(반려) → 재작성 → 다시 작성
const approval = {
    gateways: [
        { id: 'gateway1', type: 'exclusiveGateway', name: '제안서 승인 여부 판단' },
        { id: 'start_event', type: 'startEvent' },
        { id: 'end_event', type: 'endEvent' }
    ],
    sequences: [
        { source: 'start_event', target: 'task1' },
        { source: 'task1', target: 'task2' },
        { source: 'task2', target: 'task3' },
        { source: 'task3', target: 'gateway1' },
        { source: 'gateway1', target: 'task4_approve', name: '승인인 경우', condition: '승인인 경우' },
        { source: 'gateway1', target: 'task4_reject', name: '반려인 경우', condition: '반려인 경우' },
        { source: 'task4_reject', target: 'task2' },
        { source: 'task4_approve', target: 'end_event' }
    ]
};

const row = (c, n) => ({ completedActivityId: c, nextActivityId: n });
// 요청 → 작성 → 검토 → 재작성 → 작성 → 검토 → 재작성 → 작성 → (검토 진행 중)
const looped = [
    row('task1', 'task2'),
    row('task2', 'task3'),
    row('task3', 'task4_reject'),
    row('task4_reject', 'task2'),
    row('task2', 'task3'),
    row('task3', 'task4_reject'),
    row('task4_reject', 'task2'),
    row('task2', 'task3')
];

test('갈림길을 지난 길이면 고른 갈래 이름을 돌려준다', () => {
    assert.equal(branchLabelBetween(approval, 'task3', 'task4_reject'), '반려인 경우');
    assert.equal(branchLabelBetween(approval, 'task3', 'task4_approve'), '승인인 경우');
    // 갈림길 없이 바로 잇는 길, 사이에 다른 업무가 끼는 길, 정의가 없는 경우
    assert.equal(branchLabelBetween(approval, 'task4_reject', 'task2'), '');
    assert.equal(branchLabelBetween(approval, 'task1', 'task3'), '');
    assert.equal(branchLabelBetween(null, 'task3', 'task4_reject'), '');
});

test('조건이 식이면 갈래 이름으로 쓰지 않는다', () => {
    const def = {
        gateways: [{ id: 'g', type: 'exclusiveGateway' }],
        sequences: [
            { source: 'a', target: 'g' },
            { source: 'g', target: 'b', condition: "review_result == 'reject'" }
        ]
    };
    assert.equal(branchLabelBetween(def, 'a', 'b'), '');
});

test('같은 단계를 다시 하면 회차가 붙는다', () => {
    const notes = annotateHistory(looped, { definition: approval, currentActivityIds: ['task3'] });
    assert.deepEqual(
        notes.map((n) => n.completedRound),
        [1, 1, 1, 1, 2, 2, 2, 3]
    );
    assert.deepEqual(
        notes.map((n) => n.nextRound),
        [1, 1, 1, 2, 2, 2, 3, 3]
    );
});

test('흐름을 돌려보낸 줄은 갈래 이름과 함께 「되돌아감」 이 된다', () => {
    const notes = annotateHistory(looped, { definition: approval, currentActivityIds: ['task3'] });
    const loops = notes.map((n, i) => (n.loop ? [i, n.loop.label] : null)).filter(Boolean);
    // 검토(반려) 줄 두 곳 — 재작성 → 작성 으로 돌아오는 줄이 아니라 그렇게 정한 검토 줄이다
    assert.deepEqual(loops, [
        [2, '반려인 경우'],
        [5, '반려인 경우']
    ]);
});

test('정의가 없으면 다시 하게 된 줄에 이름 없이 표시한다(「다시 진행」)', () => {
    const notes = annotateHistory(looped, { currentActivityIds: ['task3'] });
    const loops = notes.map((n, i) => (n.loop ? [i, n.loop.label] : null)).filter(Boolean);
    assert.deepEqual(loops, [
        [3, ''],
        [6, '']
    ]);
});

test('제자리로 돌아오는 고리도 찾는다', () => {
    const def = {
        gateways: [{ id: 'g', type: 'exclusiveGateway' }],
        sequences: [
            { source: 'review', target: 'g' },
            { source: 'g', target: 'review', name: '보완 요청' },
            { source: 'g', target: 'done', name: '승인' }
        ]
    };
    const notes = annotateHistory([row('draft', 'review'), row('review', 'review'), row('review', 'done')], { definition: def });
    assert.deepEqual(notes[1].loop, { label: '보완 요청' });
    assert.equal(notes[1].nextRound, 2);
    assert.equal(notes[2].loop, null);
});

test('이름 없는 갈래로 되돌아가면 그 줄에 「다시 진행」 — 앞에서 앞으로 나간 줄의 갈래 이름을 빌려 오지 않는다', () => {
    // 작성 →(XOR 「검토 필요」)→ 검토, 검토 →(XOR, 이름 없는 흐름)→ 작성
    const def = {
        gateways: [
            { id: 'g_draft', type: 'exclusiveGateway' },
            { id: 'g_review', type: 'exclusiveGateway' }
        ],
        sequences: [
            { source: 'draft', target: 'g_draft' },
            { source: 'g_draft', target: 'review', name: '검토 필요' },
            { source: 'g_draft', target: 'done', name: '바로 완료' },
            { source: 'review', target: 'g_review' },
            { source: 'g_review', target: 'draft', condition: "result == 'rework'" },
            { source: 'g_review', target: 'done', name: '승인' }
        ]
    };
    assert.deepEqual(branchChoiceBetween(def, 'review', 'draft'), { chose: true, label: '' });
    assert.deepEqual(branchChoiceBetween(def, 'draft', 'review'), { chose: true, label: '검토 필요' });
    const rows = [row('draft', 'review'), row('review', 'draft'), row('draft', 'review')];
    const notes = annotateHistory(rows, { definition: def, currentActivityIds: ['review'] });
    const loops = notes.map((n, i) => (n.loop ? [i, n.loop.label] : null)).filter(Boolean);
    // 표시는 검토(1) → 작성(2) 줄 하나, 이름 없이(「다시 진행」). 작성(1) → 검토(1) 줄에는 붙지 않는다.
    assert.deepEqual(loops, [[1, '']]);
});

test('되돌아간 흐름에 이름이 있으면 그 줄에 그 이름', () => {
    const def = {
        gateways: [{ id: 'g_review', type: 'exclusiveGateway' }],
        sequences: [
            { source: 'draft', target: 'review' },
            { source: 'review', target: 'g_review' },
            { source: 'g_review', target: 'draft', name: '보완 필요' },
            { source: 'g_review', target: 'done', name: '승인' }
        ]
    };
    const notes = annotateHistory([row('draft', 'review'), row('review', 'draft')], { definition: def });
    assert.deepEqual(
        notes.map((n) => n.loop),
        [null, { label: '보완 필요' }]
    );
});

test('지금 단계는 그 단계를 가리킨 마지막 줄 하나다', () => {
    const notes = annotateHistory(looped, { definition: approval, currentActivityIds: ['task3'] });
    assert.deepEqual(
        notes.map((n, i) => (n.current ? i : -1)).filter((i) => i >= 0),
        [7]
    );
    // 이미 끝난 인스턴스에는 지금 단계가 없다
    assert.equal(
        annotateHistory(looped, { currentActivityIds: ['task3'], finished: true }).some((n) => n.current),
        false
    );
    // 지금 단계를 제출해 마친 줄이 뒤에 있으면 표시하지 않는다(처리 중)
    const submitted = [...looped, { completedActivityId: 'task3', nextActivityId: null }];
    assert.equal(
        annotateHistory(submitted, { currentActivityIds: ['task3'] }).some((n) => n.current),
        false
    );
    // 인스턴스의 지금 단계를 모르면 마지막 줄의 다음 업무
    assert.equal(annotateHistory(looped, {})[7].current, true);
});

test('시간은 「MM.dd HH:mm」 한 줄, 올해가 아니면 연도를 붙이고 툴팁에는 초까지', () => {
    const now = new Date(2026, 10, 11, 21, 0, 0);
    const t = new Date(2026, 10, 11, 20, 5, 56).getTime();
    assert.deepEqual(formatHistoryTime(t, now), { short: '11.11 20:05', full: '2026.11.11 20:05:56' });
    assert.deepEqual(formatHistoryTime(String(t), now), { short: '11.11 20:05', full: '2026.11.11 20:05:56' });
    assert.equal(formatHistoryTime(new Date(2025, 0, 2, 9, 3).getTime(), now).short, '2025.01.02 09:03');
    assert.deepEqual(formatHistoryTime(null, now), { short: '-', full: '' });
    assert.deepEqual(formatHistoryTime('not a date', now), { short: '-', full: '' });
});
