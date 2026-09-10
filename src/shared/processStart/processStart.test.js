/**
 * 시작 업무 만들기.
 *
 * 여기서 지키려는 것: **에이전트가 붙어야 할 업무가 사람 몫으로 남지 않는 것.**
 * 오케스트레이션 목록이 화면마다 따로 있으면, 새로 추가된 값을 모르는 쪽에서
 * 시작한 건은 그 값이 null 로 저장된다. 오류가 아니라 "왜인지 자동 처리가 안 되는
 * 건" 이 되어 원인을 찾기 어렵다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AGENT_ORCHESTRATIONS,
    INITIAL_STATUS,
    buildQuery,
    buildStartWorkItem,
    normalizeAgentMode,
    normalizeAgentOrch,
    runsAsAgent
} from './index.js';

const AT = '2026-08-31T00:00:00.000Z';

const activity = {
    id: 'act-1',
    name: '견적 요청',
    description: '견적을 요청한다',
    instruction: '공급사 3곳에 요청',
    duration: 30,
    tool: 'formHandler:견적요청서',
    agentMode: 'draft',
    orchestration: 'deepagents',
    agent: 'agent-1'
};

test('시작 업무의 기본 모양', () => {
    const row = buildStartWorkItem(activity, {
        id: 'wi-1',
        instId: 'inst-1',
        defId: 'def-1',
        assignee: { id: 'u-1', name: '홍길동' },
        startedAt: AT
    });

    assert.equal(row.id, 'wi-1');
    assert.equal(row.proc_inst_id, 'inst-1');
    assert.equal(row.root_proc_inst_id, 'inst-1');
    assert.equal(row.proc_def_id, 'def-1');
    assert.equal(row.activity_id, 'act-1');
    assert.equal(row.status, INITIAL_STATUS);
    assert.equal(row.user_id, 'u-1');
    assert.equal(row.username, '홍길동');
});

test('기한은 시작 시각에 소요 시간을 더한 값이다', () => {
    const row = buildStartWorkItem(activity, { startedAt: AT });

    assert.equal(row.start_date, AT);
    assert.equal(row.due_date, '2026-08-31T00:30:00.000Z');
});

test('소요 시간이 없으면 기한은 시작 시각과 같다', () => {
    const row = buildStartWorkItem({ ...activity, duration: undefined }, { startedAt: AT });

    assert.equal(row.due_date, AT);
    assert.equal(row.duration, 0);
});

test('지시문은 설명과 지시를 함께 담는다', () => {
    const query = buildQuery(activity);

    assert.match(query, /견적을 요청한다/);
    assert.match(query, /공급사 3곳/);
});

test('내용이 없어도 지시문 모양은 유지한다', () => {
    // 에이전트가 이 형식을 전제로 읽는다.
    const query = buildQuery({});

    assert.match(query, /\[Description\]/);
    assert.match(query, /\[Instruction\]/);
});

// ---------------------------------------------------------------------------
// 에이전트 방식
// ---------------------------------------------------------------------------

test('에이전트 방식은 대문자로 맞춘다', () => {
    assert.equal(normalizeAgentMode('draft'), 'DRAFT');
    assert.equal(normalizeAgentMode('COMPLETE'), 'COMPLETE');
});

test('모르는 값과 none 은 지정 안 함이다', () => {
    assert.equal(normalizeAgentMode('none'), null);
    assert.equal(normalizeAgentMode(''), null);
    assert.equal(normalizeAgentMode('처음보는값'), null);
    assert.equal(normalizeAgentOrch('none'), null);
    assert.equal(normalizeAgentOrch('처음보는오케스트레이션'), null);
});

test('아는 오케스트레이션은 그대로 쓴다', () => {
    for (const orch of AGENT_ORCHESTRATIONS) {
        assert.equal(normalizeAgentOrch(orch), orch, orch);
    }
});

test('deepagents 는 반드시 포함되어야 한다', () => {
    // 가장 많이 쓰는 값이다. 목록에서 빠지면 그 업무들이 전부 사람 몫으로 남는다.
    assert.equal(normalizeAgentOrch('deepagents'), 'deepagents');
});

test('에이전트가 맡는 업무를 가려낸다', () => {
    assert.equal(runsAsAgent(activity), true);
    assert.equal(runsAsAgent({ ...activity, agent: 'none' }), false, '에이전트가 없으면 사람 몫이다');
    assert.equal(runsAsAgent({ ...activity, agentMode: 'none' }), false);
    assert.equal(runsAsAgent({}), false);
});

test('액티비티가 없으면 만들지 않는다', () => {
    assert.equal(buildStartWorkItem(null, {}), null);
});
