/**
 * 채팅 오케스트레이션 목록과 게이트웨이 경로.
 *
 * 지키려는 것
 *   - CLI 코딩 에이전트(cliagents)가 목록에 있어, 고른 값이 기본값(deepagents)으로 뭉개지지 않는 것
 *   - 각 오케스트레이션이 제 게이트웨이 경로로 가는 것 — 휴대폰 웹도 같은 표를 본다
 *   - 새 대화의 기본값은 그대로 deepagents
 *
 * 실행: node --test src/utils/orchestration.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_ORCHESTRATION,
    ORCHESTRATIONS,
    ORCHESTRATION_BASE_PATHS,
    basePathForOrchestration,
    normalizeOrchestration
} from './orchestration.js';

test('CLI 코딩 에이전트도 고를 수 있는 값이다 — 기본값으로 뭉개지지 않는다', () => {
    assert.ok(ORCHESTRATIONS.includes('cliagents'));
    assert.equal(normalizeOrchestration('cliagents'), 'cliagents');
    assert.equal(normalizeOrchestration('  cliagents '), 'cliagents');
});

test('새 대화의 기본값은 바뀌지 않는다(deepagents)', () => {
    assert.equal(DEFAULT_ORCHESTRATION, 'deepagents');
    assert.equal(normalizeOrchestration(''), 'deepagents');
    assert.equal(normalizeOrchestration(null), 'deepagents');
    assert.equal(normalizeOrchestration('nope'), 'deepagents');
});

test('오케스트레이션마다 제 게이트웨이 경로로 간다', () => {
    assert.equal(basePathForOrchestration('cliagents'), '/process-gpt-cli-agent');
    assert.equal(basePathForOrchestration('codex'), '/process-gpt-codex');
    assert.equal(basePathForOrchestration('deepagents'), '/process-gpt-deepagents');
    assert.equal(basePathForOrchestration('langchain-react'), '/agent');
});

test('모르는 값은 경로를 지어내지 않는다 — 어디로 보낼지는 부르는 쪽이 정한다', () => {
    assert.equal(basePathForOrchestration('a2a'), null);
    assert.equal(basePathForOrchestration(''), null);
    assert.equal(basePathForOrchestration('constructor'), null);
});

test('목록의 모든 값에 경로가 있다 — 하나를 더할 때 경로를 빠뜨리지 않게', () => {
    for (const o of ORCHESTRATIONS) {
        assert.ok(ORCHESTRATION_BASE_PATHS[o], `${o} 의 경로가 없다`);
    }
});

test('CLI 코딩 에이전트는 켜기 전까지 새 대화에서 고를 수 없다', async () => {
    const { selectableOrchestrations, cliAgentChatEnabled } = await import('./orchestration.js');
    assert.equal(cliAgentChatEnabled({}), false);
    assert.deepEqual(selectableOrchestrations({}), ['langchain-react', 'deepagents', 'codex']);
    assert.equal(cliAgentChatEnabled({ VITE_FF_CLI_AGENT_CHAT: 'true' }), true);
    assert.ok(selectableOrchestrations({ VITE_FF_CLI_AGENT_CHAT: 'true' }).includes('cliagents'));
    assert.equal(cliAgentChatEnabled({ VITE_FF_CLI_AGENT_CHAT: 'false' }), false);
});

test('회사 CLI 키가 있으면 플래그가 꺼져 있어도 「CLI 코딩 에이전트」를 고를 수 있다', async () => {
    const { selectableOrchestrations } = await import('./orchestration.js');
    assert.ok(selectableOrchestrations({}, { companyCliKey: true }).includes('cliagents'));
    assert.ok(selectableOrchestrations({ VITE_FF_CLI_AGENT_CHAT: 'false' }, { companyCliKey: true }).includes('cliagents'));
    assert.ok(!selectableOrchestrations({}, { companyCliKey: false }).includes('cliagents'), '키도 플래그도 없으면 지금처럼 숨긴다');
    assert.ok(!selectableOrchestrations({}, { companyCliKey: 'true' }).includes('cliagents'), '참/거짓만 받는다');
    assert.ok(selectableOrchestrations({ VITE_FF_CLI_AGENT_CHAT: 'true' }, { companyCliKey: false }).includes('cliagents'), '플래그만 켜도 연다');
});
