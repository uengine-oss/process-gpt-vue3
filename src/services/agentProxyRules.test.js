import test from 'node:test';
import assert from 'node:assert/strict';

import { agentProxy, buildAgentProxies, AGENT_DIRECT_TARGETS } from './agentProxyRules.js';

test('codex 에도 프록시 항목이 있다', () => {
    // 없으면 dev 화면에서 codex 대화가 SPA 라우트로 떨어져 index.html 이 돌아온다.
    const rules = buildAgentProxies('');
    assert.ok(rules['/process-gpt-codex/'], '/process-gpt-codex/ 프록시가 없다');
    assert.ok(rules['/process-gpt-deepagents/'], '/process-gpt-deepagents/ 프록시가 없다');
    assert.equal(AGENT_DIRECT_TARGETS['/process-gpt-codex'], 'http://127.0.0.1:8891');
});

test('게이트웨이로 보낼 때는 prefix 를 벗기지 않는다', () => {
    // 어느 에이전트인지는 prefix 로만 구분된다. 미리 벗기면 게이트웨이가 라우트를
    // 찾지 못해 404 가 난다.
    const rule = agentProxy('/process-gpt-codex', 'http://127.0.0.1:8891', 'http://127.0.0.1:18090');
    assert.equal(rule.target, 'http://127.0.0.1:18090');
    assert.equal(rule.rewrite, undefined, '게이트웨이 경유인데 prefix 를 벗기고 있다');
});

test('게이트웨이로 보낼 때 Host 를 바꾸지 않는다', () => {
    // 게이트웨이는 Host 의 첫 라벨로 테넌트를 정하고 X-Tenant-Id 를 덮어쓴다.
    // changeOrigin 이 켜지면 테넌트가 '127' 이 되어 모든 채팅이 403 으로 끊긴다.
    const rule = agentProxy('/process-gpt-deepagents', 'http://127.0.0.1:8888', 'http://127.0.0.1:18090');
    assert.equal(rule.changeOrigin, false, 'changeOrigin 이 켜져 있어 테넌트가 Host 에서 잘못 유도된다');
});

test('게이트웨이를 안 쓰면 직결하고 prefix 를 벗긴다', () => {
    const rule = agentProxy('/process-gpt-deepagents', 'http://127.0.0.1:8888', '');
    assert.equal(rule.target, 'http://127.0.0.1:8888');
    assert.equal(rule.changeOrigin, true);
    assert.equal(rule.rewrite('/process-gpt-deepagents/chat/stream'), '/chat/stream');
});

test('공백만 있는 게이트웨이 값은 비어 있는 것으로 본다', () => {
    const rule = agentProxy('/process-gpt-codex', 'http://127.0.0.1:8891', '   ');
    assert.equal(rule.target, 'http://127.0.0.1:8891');
});
