import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSteps, groupSteps, orderActivities, stepStateOf, summarizeSteps, untakenBranches } from './instanceSteps.js';

const ids = (list) => list.map((a) => a.id);

test('예정(TODO)은 진행 중이 아니다', () => {
    assert.equal(stepStateOf('TODO'), 'todo');
    assert.equal(stepStateOf('IN_PROGRESS'), 'current');
    assert.equal(stepStateOf('DONE'), 'done');
    assert.equal(stepStateOf('CANCELLED'), 'skipped');
});

test('배타 게이트웨이 뒤의 가지들이 모이는 단계는 가지들 뒤에 온다', () => {
    // 민원서 → 부서 배정 → (건축 | 농업 | 교통) → 최종
    const activities = ['final', 'a1', 'a2', 'build', 'farm', 'traffic'].map((id) => ({ id, name: id }));
    const events = [{ id: 'start', type: 'startEvent' }];
    const sequences = [
        { source: 'start', target: 'a1' },
        { source: 'a1', target: 'a2' },
        { source: 'a2', target: 'gw' },
        { source: 'gw', target: 'build' },
        { source: 'gw', target: 'farm' },
        { source: 'gw', target: 'traffic' },
        { source: 'build', target: 'final' },
        { source: 'farm', target: 'final' },
        { source: 'traffic', target: 'final' }
    ];
    const order = ids(orderActivities(activities, sequences, events));
    assert.deepEqual(order.slice(0, 2), ['a1', 'a2']);
    assert.equal(order[order.length - 1], 'final');
});

test('되돌아가는 흐름(고리)이 있어도 끝나고, 순서는 앞으로 가는 흐름을 따른다', () => {
    const activities = ['write', 'review', 'publish'].map((id) => ({ id }));
    const events = [{ id: 's', type: 'startEvent' }];
    const sequences = [
        { source: 's', target: 'write' },
        { source: 'write', target: 'review' },
        { source: 'review', target: 'write' }, // 반려
        { source: 'review', target: 'publish' }
    ];
    assert.deepEqual(ids(orderActivities(activities, sequences, events)), ['write', 'review', 'publish']);
});

test('흐름에서 닿지 못한 액티비티도 뒤에 붙는다', () => {
    const activities = [{ id: 'orphan' }, { id: 'a' }];
    const events = [{ id: 's', type: 'startEvent' }];
    const sequences = [{ source: 's', target: 'a' }];
    assert.deepEqual(ids(orderActivities(activities, sequences, events)), ['a', 'orphan']);
});

test('단계 상태는 가장 최근 업무를 따르고, 내 차례를 표시한다', () => {
    const activities = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    const events = [{ id: 's', type: 'startEvent' }];
    const sequences = [
        { source: 's', target: 'a' },
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' }
    ];
    const workList = [
        { tracingTag: 'a', status: 'DONE', taskId: 't1', endDate: '2026-09-01' },
        { tracingTag: 'b', status: 'IN_PROGRESS', taskId: 't2', startDate: '2026-09-02' },
        { tracingTag: 'c', status: 'TODO', taskId: 't3', startDate: '2026-09-30' }
    ];
    const steps = buildSteps({ activities, sequences, events, workList, mineTaskId: 't2', whoOf: () => '나' });
    assert.deepEqual(
        steps.map((s) => s.state),
        ['done', 'current', 'todo']
    );
    assert.equal(steps[1].mine, true);

    const sum = summarizeSteps(steps);
    assert.equal(sum.done, 1);
    assert.equal(sum.total, 3);
    assert.equal(sum.current.id, 'b');
    assert.equal(sum.finished, false);
});

test('모두 끝나면 finished', () => {
    const sum = summarizeSteps([
        { id: 'a', state: 'done' },
        { id: 'b', state: 'skipped' }
    ]);
    assert.equal(sum.finished, true);
    assert.equal(sum.current, null);
});

// 민원서 → 부서 배정 → 배타 게이트웨이(건축 | 농업 | 교통) → 최종
const branchDef = () => ({
    activities: ['final', 'a1', 'a2', 'build', 'farm', 'traffic'].map((id) => ({ id, name: id })),
    events: [],
    // 시작 이벤트가 gateways 에 담겨 오는 정의
    gateways: [
        { id: 'gw', type: 'exclusiveGateway' },
        { id: 'start', type: 'startEvent' },
        { id: 'end', type: 'endEvent' }
    ],
    sequences: [
        { source: 'start', target: 'a1' },
        { source: 'a1', target: 'a2' },
        { source: 'a2', target: 'gw' },
        { source: 'gw', target: 'build' },
        { source: 'gw', target: 'farm' },
        { source: 'gw', target: 'traffic' },
        { source: 'build', target: 'final' },
        { source: 'farm', target: 'final' },
        { source: 'traffic', target: 'final' },
        { source: 'final', target: 'end' }
    ]
});
const work = (tracingTag, status) => ({ tracingTag, status, taskId: tracingTag });

const stateOf = (steps) => Object.fromEntries(steps.map((s) => [s.id, s.state]));

test('배타 게이트웨이에서 고르지 않은 가지는 지우지 않고 건너뜀으로 둔다', () => {
    const steps = buildSteps({
        ...branchDef(),
        workList: [work('a1', 'DONE'), work('a2', 'DONE'), work('build', 'TODO'), work('farm', 'TODO'), work('traffic', 'PENDING'), work('final', 'TODO')]
    });
    assert.deepEqual(ids(steps), ['a1', 'a2', 'build', 'farm', 'traffic', 'final']);
    assert.deepEqual(stateOf(steps), { a1: 'done', a2: 'done', build: 'skipped', farm: 'skipped', traffic: 'current', final: 'todo' });
    const sum = summarizeSteps(steps);
    assert.equal(sum.total, 4);
    assert.equal(sum.current.id, 'traffic');
});

test('가지들은 한 묶음(분기)으로 그리고, 간 가지 · 건너뛴 가지를 가른다', () => {
    const steps = buildSteps({
        ...branchDef(),
        gateways: [{ id: 'gw', type: 'exclusiveGateway', name: '담당 부서로 분기' }, { id: 'start', type: 'startEvent' }],
        workList: [work('a1', 'DONE'), work('a2', 'DONE'), work('build', 'TODO'), work('farm', 'TODO'), work('traffic', 'DONE'), work('final', 'IN_PROGRESS')]
    });
    const items = groupSteps(steps);
    assert.deepEqual(
        items.map((i) => (i.type === 'step' ? i.step.id : `branch:${i.id}`)),
        ['a1', 'a2', 'branch:gw', 'final']
    );
    const branch = items[2];
    assert.equal(branch.name, '담당 부서로 분기');
    assert.equal(branch.decided, true);
    assert.deepEqual(
        branch.lanes.map((l) => [l.steps.map((s) => s.id).join(','), l.state]),
        [
            ['build', 'skipped'],
            ['farm', 'skipped'],
            ['traffic', 'taken']
        ]
    );
});

test('게이트웨이가 아직 고르기 전이면 가지는 모두 열려 있고, 다음 단계로 분기를 알린다', () => {
    const steps = buildSteps({
        ...branchDef(),
        workList: [work('a1', 'DONE'), work('a2', 'DONE'), work('build', 'TODO'), work('farm', 'TODO'), work('traffic', 'TODO')]
    });
    assert.ok(steps.every((s) => s.state !== 'skipped'));
    const sum = summarizeSteps(steps);
    // a1 · a2 · (가지 하나) · final
    assert.equal(sum.total, 4);
    assert.equal(sum.next.branch, true);
    assert.equal(groupSteps(steps)[2].decided, false);
});

test('끝난 인스턴스에 남은 예정 단계는 건너뜀이고 다음 단계로 알리지 않는다', () => {
    const steps = buildSteps({
        ...branchDef(),
        finished: true,
        workList: [work('a1', 'DONE'), work('a2', 'DONE'), work('build', 'TODO'), work('traffic', 'DONE'), work('final', 'DONE')]
    });
    const sum = summarizeSteps(steps);
    assert.equal(stateOf(steps).build, 'skipped');
    assert.equal(stateOf(steps).farm, 'skipped');
    assert.equal(sum.total, 4);
    assert.equal(sum.done, 4);
    assert.equal(sum.next, null);
    assert.equal(sum.finished, true);
});

test('가지 안에 여러 단계가 있으면 그 가지에 모두 담기고, 가지가 모이는 단계는 묶음 밖이다', () => {
    const steps = buildSteps({
        activities: ['a', 'x1', 'x2', 'y', 'join'].map((id) => ({ id })),
        events: [{ id: 's', type: 'startEvent' }],
        gateways: [{ id: 'gw', type: 'exclusiveGateway' }],
        sequences: [
            { source: 's', target: 'a' },
            { source: 'a', target: 'gw' },
            { source: 'gw', target: 'x1' },
            { source: 'gw', target: 'y' },
            { source: 'x1', target: 'x2' },
            { source: 'x2', target: 'join' },
            { source: 'y', target: 'join' }
        ],
        workList: [work('a', 'DONE'), work('y', 'IN_PROGRESS')]
    });
    const items = groupSteps(steps);
    assert.deepEqual(
        items.map((i) => (i.type === 'step' ? i.step.id : i.lanes.map((l) => l.steps.map((s) => s.id).join('+')).join('|'))),
        ['a', 'x1+x2|y', 'join']
    );
});

test('고르지 않은 가지에서만 닿는 뒤 단계도 빠지고, 가지가 모이는 단계는 남는다', () => {
    const skipped = untakenBranches({
        gateways: [{ id: 'gw', type: 'exclusiveGateway' }],
        sequences: [
            { source: 'gw', target: 'x' },
            { source: 'gw', target: 'y' },
            { source: 'x', target: 'x2' },
            { source: 'x2', target: 'join' },
            { source: 'y', target: 'join' }
        ],
        started: new Set(['y'])
    });
    assert.deepEqual([...skipped].sort(), ['x', 'x2']);
});

test('병렬 게이트웨이의 가지는 빼지 않는다', () => {
    const skipped = untakenBranches({
        gateways: [{ id: 'gw', type: 'parallelGateway' }],
        sequences: [
            { source: 'gw', target: 'x' },
            { source: 'gw', target: 'y' }
        ],
        started: new Set(['y'])
    });
    assert.equal(skipped.size, 0);
});
