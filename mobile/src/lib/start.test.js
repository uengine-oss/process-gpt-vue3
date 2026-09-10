/**
 * 프로세스 시작.
 *
 * 여기서 지키려는 것: **업무만 만들고 건을 안 만드는 일이 없게.**
 * 그러면 목록에는 뜨는데 진행 현황에는 아무것도 없고, 다음 단계로도 못 간다.
 * 화면에 오류가 없어서 원인을 찾기 어렵다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { instanceName, newInstanceId, startProcess } from './start.js';

const NOW = new Date('2026-08-31T09:00:00Z');
const definition = { id: 'def-1', name: '휴가 신청' };
const user = { id: 'u-1', name: '홍길동' };

const activity = { id: 'act-1', name: '신청서 작성', duration: 10 };

function fakeBackend(overrides = {}) {
    const calls = [];
    return {
        calls,
        getStartActivity: overrides.getStartActivity || (async () => ({ activityId: 'act-1', activity })),
        putInstance: async (instId, item) => {
            calls.push({ op: 'putInstance', instId, item });
        },
        putWorkItem: async (id, row) => {
            calls.push({ op: 'putWorkItem', id, row });
        }
    };
}

let n = 0;
const uuid = () => `id-${++n}`;

test('건을 먼저 만들고 업무를 만든다', async () => {
    // 순서가 뒤집히면, 그 사이에 엔진이 업무를 집었을 때 속한 건을 못 찾는다.
    n = 0;
    const backend = fakeBackend();

    const result = await startProcess({ backend, definition, user, uuid, now: NOW });

    assert.equal(result.ok, true);
    assert.deepEqual(backend.calls.map((c) => c.op), ['putInstance', 'putWorkItem']);
});

test('건과 업무가 같은 인스턴스를 가리킨다', async () => {
    n = 0;
    const backend = fakeBackend();

    const result = await startProcess({ backend, definition, user, uuid, now: NOW });

    const inst = backend.calls[0];
    const work = backend.calls[1];
    assert.equal(inst.instId, result.instId);
    assert.equal(work.row.proc_inst_id, result.instId);
    assert.equal(work.row.root_proc_inst_id, result.instId);
});

test('인스턴스 식별자는 정의 이름으로 시작한다', () => {
    // 다른 규칙을 쓰면 식별자만 보고 어느 정의인지 알던 도구들이 못 알아본다.
    assert.equal(newInstanceId('def-1', 'abc'), 'def-1.abc');
});

test('사람이 하는 업무는 시작한 사람이 맡는다', async () => {
    n = 0;
    const backend = fakeBackend();

    await startProcess({ backend, definition, user, uuid, now: NOW });

    assert.equal(backend.calls[1].row.user_id, 'u-1');
});

test('에이전트가 하는 업무는 담당자를 비워 둔다', async () => {
    // 시작한 사람을 담당자로 넣으면 그 사람 할 일 목록에 뜨는데, 실제로는
    // 에이전트가 처리할 업무라 사람은 할 것이 없다.
    n = 0;
    const agentActivity = { ...activity, agentMode: 'DRAFT', orchestration: 'deepagents', agent: 'agent-1' };
    const backend = fakeBackend({ getStartActivity: async () => ({ activity: agentActivity }) });

    await startProcess({ backend, definition, user, uuid, now: NOW });

    assert.equal(backend.calls[1].row.user_id, null);
    assert.equal(backend.calls[1].row.agent_orch, 'deepagents');
});

test('시작점을 못 찾으면 아무것도 만들지 않는다', async () => {
    // 억지로 만들면 아무도 처리할 수 없는 업무가 목록에 쌓인다.
    const backend = fakeBackend({ getStartActivity: async () => null });

    const result = await startProcess({ backend, definition, user, uuid, now: NOW });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no-start-activity');
    assert.equal(backend.calls.length, 0);
});

test('정의가 없으면 엔진에 묻지도 않는다', async () => {
    let asked = false;
    const backend = fakeBackend({
        getStartActivity: async () => {
            asked = true;
            return null;
        }
    });

    const result = await startProcess({ backend, definition: null, user, uuid, now: NOW });

    assert.equal(result.reason, 'no-definition');
    assert.equal(asked, false);
});

test('건 이름에 정의 이름과 날짜가 들어간다', () => {
    // 이름이 같은 건이 여럿 쌓이면 목록에서 구분할 수 없다.
    assert.equal(instanceName(definition, NOW), '휴가 신청 8/31');
});

test('이름이 없는 정의도 이름을 갖는다', () => {
    assert.match(instanceName({ id: 'def-2' }, NOW), /def-2/);
    assert.match(instanceName(null, NOW), /새 프로세스/);
});

test('담당자 지정을 인스턴스에 함께 넣는다 — 없으면 다음 단계가 아무에게도 가지 않는다', async () => {
    const saved = [];
    const be = {
        getStartActivity: async () => ({ activity: { id: 'a1', name: '작성' } }),
        putInstance: async (_id, item) => saved.push(item),
        putWorkItem: async () => {}
    };
    await startProcess({
        backend: be,
        definition: { id: 'd1', name: '휴가' },
        user: { id: 'u1', name: '나' },
        uuid: () => 'x',
        roleBindings: [{ name: '팀장', endpoint: 'u9' }]
    });
    assert.deepEqual(saved[0].roleBindings, [{ name: '팀장', endpoint: 'u9' }]);
});

test('시작하면서 적은 첫 입력을 업무에 함께 넣는다', async () => {
    const items = [];
    const be = {
        getStartActivity: async () => ({ activity: { id: 'a1', name: '작성' } }),
        putInstance: async () => {},
        putWorkItem: async (_id, item) => items.push(item)
    };
    await startProcess({
        backend: be,
        definition: { id: 'd1' },
        user: { id: 'u1' },
        uuid: () => 'x',
        initialValues: { 사유: '개인 사정' }
    });
    assert.deepEqual(items[0].output, { 사유: '개인 사정' });
});

test('입력이 없으면 업무에 빈 값을 만들지 않는다', async () => {
    const items = [];
    const be = {
        getStartActivity: async () => ({ activity: { id: 'a1' } }),
        putInstance: async () => {},
        putWorkItem: async (_id, item) => items.push(item)
    };
    await startProcess({ backend: be, definition: { id: 'd1' }, user: {}, uuid: () => 'x' });
    assert.equal('output' in items[0], false);
});
