import test from 'node:test';
import assert from 'node:assert/strict';

import { pickAgentDelegation } from './agentDelegation.js';

test('업무에 정해 둔 방식이 있으면 그대로 맡긴다', () => {
    const picked = pickAgentDelegation({
        selected: { agent: 'agent-1', agentMode: 'COMPLETE', orchestration: 'langchain-react' },
        last: { orchestration: 'deepagents', agentMode: 'draft' }
    });
    assert.deepEqual(picked, { agent: 'agent-1', agentMode: 'complete', orchestration: 'langchain-react' });
});

test('정해 둔 방식이 없으면 지난번 고른 방식, 담당자는 그대로', () => {
    const picked = pickAgentDelegation({
        selected: { agent: 'u-me', agentMode: 'none', orchestration: null },
        last: { orchestration: 'langchain-react', agentMode: 'complete' }
    });
    assert.deepEqual(picked, { agent: 'u-me', agentMode: 'complete', orchestration: 'langchain-react' });
});

test('둘 다 없으면 딥 에이전트 · 초안', () => {
    const picked = pickAgentDelegation({ selected: { agent: 'u-me', agentMode: 'none', orchestration: null }, last: null });
    assert.deepEqual(picked, { agent: 'u-me', agentMode: 'draft', orchestration: 'deepagents' });
});

test('방식만 정해져 있고 모드가 none 이면 지난번 선택을 쓴다', () => {
    const picked = pickAgentDelegation({
        selected: { agent: 'u-me', agentMode: 'none', orchestration: 'deepagents' },
        last: { orchestration: 'langchain-react', agentMode: 'draft' }
    });
    assert.equal(picked.orchestration, 'langchain-react');
    assert.equal(picked.agentMode, 'draft');
});

test('업무 값이 아예 없어도 기본으로 시작한다', () => {
    assert.deepEqual(pickAgentDelegation({ selected: null, last: null }), { agentMode: 'draft', orchestration: 'deepagents' });
});
