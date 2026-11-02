import test from 'node:test';
import assert from 'node:assert/strict';

import { failedJobIds, isEmptyCompletion, toolUsageByJob } from './index.js';

let clock = 0;
const ev = (event_type, data, job_id = 'job-1') => ({
    id: `e${++clock}`,
    job_id,
    event_type,
    crew_type: 'agent',
    timestamp: new Date(Date.UTC(2026, 9, 8, 0, 0, clock)).toISOString(),
    data
});

test('같은 도구를 동시에 여러 번 부르면 호출 id 로 짝을 맞춘다', () => {
    // cli-agent: Bash 세 번을 한꺼번에 시작하고 step1 만 끝났다
    const usage = toolUsageByJob([
        ev('tool_usage_started', { tool_name: 'Bash', tool_use_id: 'A', query: 'step1' }),
        ev('tool_usage_started', { tool_name: 'Bash', tool_use_id: 'B', query: 'sleep 60 && step2' }),
        ev('tool_usage_started', { tool_name: 'Bash', tool_use_id: 'C', query: 'step3' }),
        ev('tool_usage_finished', { tool_name: 'Bash', tool_use_id: 'A', result: 'ok1' })
    ])['job-1'];
    assert.deepEqual(
        usage.map((t) => [t.query, t.status, t.info]),
        [
            ['step1', 'done', 'ok1'],
            ['sleep 60 && step2', 'searching', null],
            ['step3', 'searching', null]
        ]
    );
});

test('id 가 있는 진행 중 호출은 다른 호출의 완료로 닫히지 않는다', () => {
    const usage = toolUsageByJob([
        ev('tool_usage_started', { tool_name: 'Bash', tool_use_id: 'A' }),
        ev('tool_usage_started', { tool_name: 'Read', tool_use_id: 'B' }),
        ev('tool_usage_finished', { tool_name: 'Read', tool_use_id: 'B', result: 'file' })
    ])['job-1'];
    assert.deepEqual(usage.map((t) => t.status), ['searching', 'done']);
});

test('id 가 없는 이벤트는 이전처럼 같은 이름의 가장 최근 시작과 짝짓는다', () => {
    // deepagents 는 tool_use_id 를 싣지 않는다
    const usage = toolUsageByJob([
        ev('tool_usage_started', { tool_name: 'search' }),
        ev('tool_usage_started', { tool_name: 'search' }),
        ev('tool_usage_finished', { tool_name: 'search', result: 'r' })
    ])['job-1'];
    assert.deepEqual(usage.map((t) => t.status), ['searching', 'done']);
});

test('완료가 시작보다 먼저 기록돼도 id 없는 시작은 폴백으로 닫힌다', () => {
    const usage = toolUsageByJob([
        ev('tool_usage_finished', { tool_name: 'x', result: 'r' }),
        ev('tool_usage_started', { tool_name: 'y' })
    ])['job-1'];
    assert.deepEqual(usage.map((t) => [t.status, t.info]), [['done', 'r']]);
});

test('계획(write_todos)과 진행 알림(task_working)은 그대로 담는다', () => {
    const usage = toolUsageByJob([
        ev('tool_usage_started', { tool_name: 'write_todos', args: { todos: [{ content: '읽기', status: 'in_progress' }] } }),
        { ...ev('task_working', { query: '일부 스킬을 불러오지 못했습니다' }), crew_type: '안내' }
    ])['job-1'];
    assert.deepEqual(usage[0].todos, [{ content: '읽기', status: 'in_progress' }]);
    assert.deepEqual([usage[1].tool_name, usage[1].status, usage[1].query], ['안내', 'done', '일부 스킬을 불러오지 못했습니다']);
});

test('작업(job)별로 나눈다', () => {
    const usage = toolUsageByJob([
        ev('tool_usage_started', { tool_name: 'Bash', tool_use_id: 'A' }, 'todo-1'),
        ev('tool_usage_started', { tool_name: 'Bash', tool_use_id: 'B' }, 'todo-1:1')
    ]);
    assert.deepEqual(Object.keys(usage).sort(), ['todo-1', 'todo-1:1']);
});

test('빈 완료 본문은 결과가 아니다', () => {
    for (const empty of [null, undefined, '', {}, []]) assert.equal(isEmptyCompletion(empty), true, JSON.stringify(empty));
    for (const value of [{ result: 'x' }, 'text', ['a'], { message: '' }]) {
        assert.equal(isEmptyCompletion(value), false, JSON.stringify(value));
    }
});

test('오류 이벤트의 job_id 는 실패한 작업이다', () => {
    const ids = failedJobIds([
        ev('task_started', {}, 'todo-1'),
        ev('error', { friendly: '실패' }, 'todo-1'),
        ev('task_started', {}, 'todo-2')
    ]);
    assert.deepEqual([...ids], ['todo-1']);
});
