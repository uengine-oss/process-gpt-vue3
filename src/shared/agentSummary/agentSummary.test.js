/**
 * 에이전트 결과 요약.
 *
 * 지키려는 것: 요약은 가장 최근 것 하나만 보이고, 폼에는 절대 채우지 않는 것.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { latestAgentSummary, stripAgentMeta } from './index.js';

const ev = (type, data, timestamp) => ({ event_type: type, data, timestamp });

test('가장 최근 task_completed 의 요약을 고른다', () => {
    const events = [
        ev('task_completed', { result: 'x', agent_summary: '첫 번째 요약' }, '2026-11-11T08:00:00Z'),
        ev('task_started', { agent_summary: '시작 이벤트는 보지 않는다' }, '2026-11-11T09:30:00Z'),
        ev('task_completed', { result: 'y', agent_summary: '  다시 맡긴 결과 요약 ' }, '2026-11-11T09:00:00Z'),
        ev('task_completed', { result: 'z' }, '2026-11-11T09:10:00Z')
    ];
    assert.equal(latestAgentSummary(events), '다시 맡긴 결과 요약');
});

test('data 가 문자열(JSON)이어도 읽는다', () => {
    assert.equal(latestAgentSummary([ev('task_completed', '{"agent_summary":"문자열 요약"}', '2026-11-11T08:00:00Z')]), '문자열 요약');
});

test('요약이 없으면 빈 값', () => {
    assert.equal(latestAgentSummary([ev('task_completed', { result: 'x' }), ev('task_completed', 'not json')]), '');
    assert.equal(latestAgentSummary(null), '');
});

test('폼 값에서는 요약 · 팀 정보를 뺀다', () => {
    const payload = { approval_decision: 'reject', agent_summary: '요약', team_agent_ids: ['a1'] };
    assert.deepEqual(stripAgentMeta(payload), { approval_decision: 'reject' });
    assert.equal(payload.agent_summary, '요약', '원본은 그대로');
    const plain = { a: 1 };
    assert.equal(stripAgentMeta(plain), plain);
    assert.equal(stripAgentMeta('text'), 'text');
});
