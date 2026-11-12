/**
 * CLI 코딩 에이전트에서 "어느 CLI 로 돌릴지".
 *
 * 지키려는 것
 *   - cliagents 대화의 요청 metadata 에 agent_cli 가 실리는 것(맨 위에 두면 SDK 가 버린다)
 *   - 다른 대화에는 실리지 않는 것
 *   - cli-agent 의 거절 코드가 무엇을 하면 되는지 읽을 수 있는 문구가 되는 것
 *   - 업무 설정과 채팅이 같은 목록 · 같은 이름표를 쓰는 것
 *
 * 실행: node --test src/utils/cliAgents.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_AGENT_CLI,
    KNOWN_CLI_AGENTS,
    agentCliOf,
    agentCliTitle,
    agentStreamError,
    cliChatMetadata,
    cliRoomContext,
    readableAgentError,
    toCliAgentItems
} from './cliAgents.js';

test('아는 CLI 는 Claude Code · Codex 다 — 값은 서버의 agent_id 와 같다', () => {
    assert.deepEqual(
        KNOWN_CLI_AGENTS.map((a) => [a.value, a.title]),
        [
            ['claude-code', 'Claude Code'],
            ['codex', 'Codex']
        ]
    );
    assert.equal(DEFAULT_AGENT_CLI, 'claude-code');
});

test('cliagents 대화의 metadata 에 고른 CLI 가 실린다', () => {
    assert.deepEqual(cliChatMetadata('cliagents', 'codex'), { agent_cli: 'codex' });
    assert.deepEqual(cliChatMetadata('cliagents', 'claude-code', { model: 'sonnet', permission: 'read_only' }), {
        agent_cli: 'claude-code',
        agent_model: 'sonnet',
        agent_permission: 'read_only'
    });
});

test('모르는 실행 권한은 싣지 않는다 — 서버 기본값(workspace_write)으로 돈다', () => {
    assert.deepEqual(cliChatMetadata('cliagents', 'codex', { permission: 'full-power' }), { agent_cli: 'codex' });
});

test('고른 적이 없으면 서버 기본값을 명시해서 싣는다', () => {
    assert.deepEqual(cliChatMetadata('cliagents', ''), { agent_cli: 'claude-code' });
    assert.deepEqual(cliChatMetadata('cliagents', null), { agent_cli: 'claude-code' });
});

test('다른 대화에는 아무것도 싣지 않는다', () => {
    for (const o of ['deepagents', 'codex', 'langchain-react', '', null]) {
        assert.deepEqual(cliChatMetadata(o, 'codex'), {}, String(o));
        assert.deepEqual(cliRoomContext(o, 'codex'), {}, String(o));
    }
});

test('방에는 고른 CLI 를 기억한다(context.agent_cli)', () => {
    assert.deepEqual(cliRoomContext('cliagents', 'codex'), { agent_cli: 'codex' });
    assert.deepEqual(cliRoomContext('cliagents', ''), { agent_cli: 'claude-code' });
});

test('모르는 CLI 를 아는 CLI 로 바꾸지 않는다 — 서버가 판단한다', () => {
    assert.equal(agentCliOf('gemini'), 'gemini');
    assert.equal(agentCliTitle('gemini'), 'gemini');
    assert.equal(agentCliTitle('codex'), 'Codex');
});

test('오류 프레임 → Error: 서버의 code · available 이 붙는다', () => {
    const err = agentStreamError('no cli', { type: 'error', code: 'cli_not_selected', content: 'no cli', available: ['claude-code', 'codex'] });
    assert.equal(err.message, 'no cli');
    assert.equal(err.code, 'cli_not_selected');
    assert.deepEqual(err.available, ['claude-code', 'codex']);
    assert.equal(agentStreamError(undefined, {}).message, 'Agent error');
});

test('CLI 를 안 골랐다 → 「먼저 고르세요」와 고를 수 있는 CLI', () => {
    const err = agentStreamError('cli not selected', { code: 'cli_not_selected', available: ['claude-code', 'codex'] });
    assert.equal(readableAgentError(err), '실행할 CLI를 먼저 고르세요. (Claude Code · Codex)');
    // 포털은 locale 의 같은 키를 쓴다.
    assert.equal(readableAgentError(err, (k) => `[${k}]`), '[chats.agentErrors.cliNotSelected] (Claude Code · Codex)');
});

test('설치되지 않은 CLI → 다른 CLI 를 고르라고 하고, 서버가 준 사유를 버리지 않는다', () => {
    const err = agentStreamError('codex: not installed — npm i -g @openai/codex', { code: 'cli_unavailable' });
    assert.equal(
        readableAgentError(err),
        '고른 CLI가 이 서버에 설치되어 있지 않습니다. 다른 CLI를 고르세요. — codex: not installed — npm i -g @openai/codex'
    );
});

test('빈 내용 · 모르는 코드 · 코드 없음', () => {
    assert.equal(readableAgentError(agentStreamError('empty', { code: 'empty_message' })), '보낼 내용이 비어 있습니다.');
    assert.equal(
        readableAgentError(agentStreamError('에이전트를 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', { code: 'runner_start_timeout' })),
        '에이전트를 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
    );
    assert.equal(readableAgentError(new Error('boom')), 'boom');
});

test('서버 목록 → 선택 목록: 설치 · 인증이 안 된 이유를 그 자리에서 보인다', () => {
    const t = (k) => ({ 'AgentSelectInfo.cliAgent.cliNotInstalled': '설치 안 됨', 'AgentSelectInfo.cliAgent.cliNotAuthenticated': '인증 필요' })[k];
    const items = toCliAgentItems(
        [
            { agent_id: 'claude-code', display_name: 'Claude Code', installed: true, authenticated: true },
            { agent_id: 'codex', display_name: 'Codex', installed: true, authenticated: false, auth_hint: 'codex login' },
            { agent_id: 'gemini', installed: false, install_hint: 'npm i -g gemini' },
            { display_name: 'id 없음' }
        ],
        t
    );
    assert.deepEqual(items, [
        { value: 'claude-code', title: 'Claude Code', installed: true, hint: '' },
        { value: 'codex', title: 'Codex', installed: true, hint: '인증 필요 — codex login' },
        { value: 'gemini', title: 'gemini', installed: false, hint: '설치 안 됨 — npm i -g gemini' }
    ]);
});

test('서버가 목록이 아닌 것을 주면(서비스 없는 설치본의 HTML) 빈 목록', () => {
    assert.deepEqual(toCliAgentItems(undefined), []);
    assert.deepEqual(toCliAgentItems('<!DOCTYPE html>'), []);
});

test('회사 키 없음(company_key_required) — 무엇이 없는지와, 관리자가 어디서 넣는지 한 줄', async () => {
    const { COMPANY_KEY_ADMIN_HINT_KEY } = await import('./cliAgents.js');
    const err = agentStreamError('회사 API 키가 없어 claude-code 를 돌리지 않습니다. 관리자에게 설정 › CLI 에이전트 API 키를 요청하세요.', {
        type: 'error',
        code: 'company_key_required'
    });
    assert.equal(err.code, 'company_key_required');
    assert.equal(
        readableAgentError(err),
        '이 CLI에 쓸 회사 API 키가 없습니다. 관리자는 설정 › CLI 에이전트 API 키에서 회사 키를 넣을 수 있습니다.'
    );
    // 포털: locale 키 둘(본문 · 관리자 안내)을 그 순서로 쓴다
    assert.equal(readableAgentError(err, (k) => `[${k}]`), '[chats.agentErrors.companyKeyRequired] [chats.agentErrors.companyKeyAdminHint]');
    assert.equal(COMPANY_KEY_ADMIN_HINT_KEY, 'chats.agentErrors.companyKeyAdminHint');
});

test('회사 키 확인 실패(company_key_check_failed) — 잠시 뒤 다시 보내라고만(관리자 안내 없음)', () => {
    const err = agentStreamError('lookup timeout', { type: 'error', code: 'company_key_check_failed' });
    assert.equal(readableAgentError(err), '회사 API 키를 확인하지 못했습니다. 잠시 뒤 다시 보내 주세요.');
    assert.equal(readableAgentError(err, (k) => `[${k}]`), '[chats.agentErrors.companyKeyCheckFailed]');
});

test('회사 키 문구는 휴대폰(한국어 내장) · 포털(ko.json · en.json) 모두에 있다', async () => {
    const fs = await import('node:fs');
    const { CLI_ERROR_KEYS, COMPANY_KEY_ADMIN_HINT_KEY } = await import('./cliAgents.js');
    const keys = [CLI_ERROR_KEYS.company_key_required, CLI_ERROR_KEYS.company_key_check_failed, COMPANY_KEY_ADMIN_HINT_KEY];
    for (const lang of ['ko', 'en']) {
        const msgs = JSON.parse(fs.readFileSync(new URL(`./locales/${lang}.json`, import.meta.url), 'utf8'));
        for (const key of keys) {
            const value = key.split('.').reduce((o, k) => o?.[k], msgs);
            assert.ok(typeof value === 'string' && value.length > 0, `${lang}.json 에 ${key} 가 없다`);
        }
    }
    // 휴대폰(t 없이)은 내장 한국어 — 키 이름이 그대로 보이지 않는다
    for (const code of ['company_key_required', 'company_key_check_failed']) {
        assert.ok(!readableAgentError({ code, message: 'x' }).includes('chats.agentErrors'), code);
    }
});
