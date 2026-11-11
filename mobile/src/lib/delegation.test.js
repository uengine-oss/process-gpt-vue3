/**
 * 「에이전트에 맡기기」 한 번 — 포털과 같은 규칙으로 맡길 방식을 정하고, 담당자는 바꾸지 않는다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { delegate, delegationPatch, selectedOf } from './delegation.js';

const task = { id: 't1', user_id: 'u-minji', agent_mode: null, agent_orch: null, status: 'IN_PROGRESS' };

describe('delegationPatch', () => {
    it('정해 둔 방식도 지난 선택도 없으면 딥 에이전트 · 초안', () => {
        assert.deepEqual(delegationPatch(task, null), {
            user_id: 'u-minji',
            agent_mode: 'DRAFT',
            status: 'IN_PROGRESS',
            agent_orch: 'deepagents'
        });
    });

    it('지난번에 고른 방식을 쓴다', () => {
        const p = delegationPatch(task, { orchestration: 'crewai-action', agentMode: 'complete' });
        assert.equal(p.agent_orch, 'crewai-action');
        assert.equal(p.agent_mode, 'COMPLETE');
    });

    it('업무에 정해 둔 방식이 먼저다', () => {
        const p = delegationPatch({ ...task, agent_orch: 'browser-automation-agent', agent_mode: 'DRAFT' }, { orchestration: 'deepagents' });
        assert.equal(p.agent_orch, 'browser-automation-agent');
    });

    it('휴대폰에서 쓸 수 없는 기본 LLM 빠른 생성(default)은 딥 에이전트로', () => {
        assert.equal(delegationPatch(task, { orchestration: 'default', agentMode: 'draft' }).agent_orch, 'deepagents');
    });

    it('담당자는 그대로 — 맡긴 뒤에도 내 업무다', () => {
        assert.equal(selectedOf(task).agent, 'u-minji');
        assert.equal(delegationPatch(task, null).user_id, 'u-minji');
    });
});

describe('delegate', () => {
    it('그 업무에 한 번 쓴다', async () => {
        const calls = [];
        await delegate({ putWorkItem: async (id, patch) => calls.push([id, patch]) }, task);
        assert.equal(calls.length, 1);
        assert.equal(calls[0][0], 't1');
        assert.equal(calls[0][1].status, 'IN_PROGRESS');
    });
});
