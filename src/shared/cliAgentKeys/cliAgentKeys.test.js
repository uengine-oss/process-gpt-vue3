/**
 * CLI 에이전트 API 키 — 상태 · 저장 · 모양 검사 · 채팅 선택지 판단 (2026-11-11)
 *
 * 실행: node --test src/shared/cliAgentKeys/cliAgentKeys.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CLI_KEY_PROVIDERS,
    CLI_KEY_RPC,
    anyKeyConfigured,
    companyCliKeyConfigured,
    deleteCliKey,
    fetchCliKeyStatus,
    formatUpdatedAt,
    invalidateCliKeyStatus,
    keyShapeWarning,
    maskedLast4,
    normalizeStatus,
    saveCliKey,
    statusDetails
} from './index.js';

function fakeClient(onRpc) {
    const calls = [];
    return {
        calls,
        rpc(name, params) {
            calls.push({ name, params });
            return Promise.resolve(onRpc ? onRpc(name, params) : { data: null, error: null });
        }
    };
}

const ADMIN_ROWS = [
    { provider: 'anthropic', configured: true, last4: '1234', updated_at: '2026-11-11T21:30:00+09:00', updated_by_name: '장진영' },
    { provider: 'openai', configured: false, last4: null, updated_at: null, updated_by_name: null }
];

test('공급자는 Claude Code(Anthropic) · Codex(OpenAI) 둘, 이 순서다', () => {
    assert.deepEqual(
        CLI_KEY_PROVIDERS.map((p) => [p.provider, p.agent]),
        [
            ['anthropic', 'Claude Code'],
            ['openai', 'Codex']
        ]
    );
});

test('상태는 공급자 둘을 늘 같은 순서로 — 서버가 행을 빠뜨려도 「설정 안 됨」 줄이 남는다', () => {
    const rows = normalizeStatus([{ provider: 'openai', configured: true, last4: '9999' }]);
    assert.deepEqual(
        rows.map((r) => [r.provider, r.configured, r.last4]),
        [
            ['anthropic', false, null],
            ['openai', true, '9999']
        ]
    );
    assert.equal(normalizeStatus(null).length, 2);
    assert.ok(normalizeStatus(undefined).every((r) => r.configured === false));
});

test('상태에 비밀 값이 실려 와도 화면 상태로 옮기지 않는다', () => {
    const [row] = normalizeStatus([{ provider: 'anthropic', configured: true, last4: '1234', secret: 'sk-ant-test-LEAK', decrypted_secret: 'x' }]);
    assert.deepEqual(Object.keys(row).sort(), ['configured', 'last4', 'provider', 'updatedAt', 'updatedByName']);
    assert.ok(!JSON.stringify(row).includes('LEAK'));
});

test('모르는 공급자 행은 버리고, configured 가 참일 때만 끝 네 자리 · 이름을 쓴다', () => {
    const rows = normalizeStatus([
        { provider: 'gemini', configured: true, last4: '0000' },
        { provider: 'anthropic', configured: false, last4: '1234', updated_by_name: '장진영' }
    ]);
    assert.deepEqual(rows[0], { provider: 'anthropic', configured: false, last4: null, updatedAt: null, updatedByName: null });
});

test('회사 키가 하나라도 있으면 채팅 선택지를 연다', () => {
    assert.equal(anyKeyConfigured(ADMIN_ROWS), true);
    assert.equal(anyKeyConfigured([{ provider: 'openai', configured: true }]), true);
    assert.equal(anyKeyConfigured([]), false);
    assert.equal(anyKeyConfigured(null), false);
    assert.equal(anyKeyConfigured([{ provider: 'anthropic', configured: 'true' }]), false, '문자열 true 는 설정으로 치지 않는다');
});

test('상태 읽기는 status RPC 하나 — 인자를 보내지 않는다(테넌트는 서버가 토큰에서 정한다)', async () => {
    const client = fakeClient(() => ({ data: ADMIN_ROWS, error: null }));
    const rows = await fetchCliKeyStatus({ client });
    assert.deepEqual(client.calls, [{ name: CLI_KEY_RPC.status, params: undefined }]);
    assert.equal(rows[0].last4, '1234');
    assert.equal(rows[0].updatedByName, '장진영');
});

test('상태 읽기 실패는 던진다 — 설정 화면이 오류를 보여 준다', async () => {
    const client = fakeClient(() => ({ data: null, error: { message: 'permission denied' } }));
    await assert.rejects(() => fetchCliKeyStatus({ client }), /permission denied/);
});

test('저장은 set RPC 에 공급자와 앞뒤 공백을 뗀 키만 보낸다 — 테넌트를 보내지 않는다', async () => {
    const client = fakeClient();
    await saveCliKey('anthropic', '  sk-ant-test-abc1234  ', { client });
    assert.deepEqual(client.calls, [{ name: CLI_KEY_RPC.set, params: { p_provider: 'anthropic', p_secret: 'sk-ant-test-abc1234' } }]);
});

test('빈 값 저장은 막는다 — 서버에서는 빈 값이 지우기라 실수로 지워지지 않게', async () => {
    const client = fakeClient();
    await assert.rejects(() => saveCliKey('openai', '   ', { client }), /API 키를 입력/);
    assert.equal(client.calls.length, 0);
});

test('모르는 공급자는 보내지 않는다', async () => {
    const client = fakeClient();
    await assert.rejects(() => saveCliKey('gemini', 'sk-test-abcdefgh', { client }), /알 수 없는 공급자/);
    await assert.rejects(() => deleteCliKey('', { client }), /알 수 없는 공급자/);
    assert.equal(client.calls.length, 0);
});

test('지우기는 같은 set RPC 에 빈 문자열', async () => {
    const client = fakeClient();
    await deleteCliKey('OpenAI', { client });
    assert.deepEqual(client.calls, [{ name: CLI_KEY_RPC.set, params: { p_provider: 'openai', p_secret: '' } }]);
});

test('저장 실패(관리자 아님)는 서버 문구 그대로 던진다', async () => {
    const client = fakeClient(() => ({ error: { code: '42501', message: '관리자만 CLI 에이전트 API 키를 바꿀 수 있습니다.' } }));
    await assert.rejects(() => saveCliKey('anthropic', 'sk-ant-test-abc1234', { client }), /관리자만/);
});

test('키 모양 검사는 경고 코드만 — 접두사가 달라도 막지 않는다', () => {
    assert.equal(keyShapeWarning('anthropic', ''), '');
    assert.equal(keyShapeWarning('anthropic', 'sk-ant-api03-abc'), '');
    assert.equal(keyShapeWarning('anthropic', 'sk-proj-abc'), 'anthropicPrefix');
    assert.equal(keyShapeWarning('openai', 'sk-proj-abc'), '');
    assert.equal(keyShapeWarning('openai', 'sk-abc'), '');
    assert.equal(keyShapeWarning('openai', 'abc123'), 'openaiPrefix');
    assert.equal(keyShapeWarning('openai', 'sk-ant-api03-abc'), 'looksAnthropic', 'Anthropic 키를 Codex 줄에 붙여 넣었다');
    assert.equal(keyShapeWarning('anthropic', 'sk-ant-abc def'), 'whitespace');
    assert.equal(keyShapeWarning('anthropic', '  sk-ant-abc  '), '', '앞뒤 공백은 떼고 본다');
});

test('끝 네 자리는 가린 꼴로', () => {
    assert.equal(maskedLast4('1234'), '••••1234');
    assert.equal(maskedLast4(null), '');
    assert.equal(maskedLast4(''), '');
});

test('바꾼 때는 「11.11 21:30」 꼴(보는 사람의 시간대)', () => {
    assert.equal(formatUpdatedAt(new Date(2026, 10, 11, 21, 30)), '11.11 21:30');
    assert.equal(formatUpdatedAt(new Date(2026, 0, 5, 7, 3)), '01.05 07:03');
    assert.equal(formatUpdatedAt('not a date'), '');
    assert.equal(formatUpdatedAt(null), '');
});

test('상태 줄 조각 — 관리자는 ••••1234 · 이름 · 때, 일반 사용자는 때만, 설정 안 됨은 빈 목록', () => {
    const at = new Date(2026, 10, 11, 21, 30).toISOString();
    assert.deepEqual(statusDetails({ configured: true, last4: '1234', updatedByName: '장진영', updatedAt: at }), ['••••1234', '장진영', '11.11 21:30']);
    assert.deepEqual(statusDetails({ configured: true, last4: null, updatedByName: null, updatedAt: at }), ['11.11 21:30']);
    assert.deepEqual(statusDetails({ configured: false, last4: '1234' }), []);
    assert.deepEqual(statusDetails(null), []);
});

test('채팅 선택지 판단: 60초 안에는 다시 묻지 않고, 동시에 물어도 요청은 하나', async () => {
    invalidateCliKeyStatus();
    const client = fakeClient(() => ({ data: ADMIN_ROWS, error: null }));
    const [a, b] = await Promise.all([companyCliKeyConfigured({ client }), companyCliKeyConfigured({ client })]);
    assert.equal(a, true);
    assert.equal(b, true);
    assert.equal(client.calls.length, 1);
    assert.equal(await companyCliKeyConfigured({ client }), true);
    assert.equal(client.calls.length, 1, '기억한 값을 쓴다');
    assert.equal(await companyCliKeyConfigured({ client, now: Date.now() + 61_000 }), true);
    assert.equal(client.calls.length, 2, '60초가 지나면 다시 묻는다');
});

test('채팅 선택지 판단은 던지지 않는다 — 못 읽으면 false, 실패는 기억하지 않는다', async () => {
    invalidateCliKeyStatus();
    let fail = true;
    const client = fakeClient(() => (fail ? { data: null, error: { message: 'boom' } } : { data: ADMIN_ROWS, error: null }));
    assert.equal(await companyCliKeyConfigured({ client }), false);
    fail = false;
    assert.equal(await companyCliKeyConfigured({ client }), true, '다음 물음에서 다시 읽는다');

    invalidateCliKeyStatus();
    const throwing = { rpc: () => Promise.reject(new Error('network')) };
    assert.equal(await companyCliKeyConfigured({ client: throwing }), false);
    invalidateCliKeyStatus();
    assert.equal(await companyCliKeyConfigured({ client: null }), false, '클라이언트가 없어도 false');
});

test('저장 · 지우기 뒤에는 다음 물음에서 새로 읽는다', async () => {
    invalidateCliKeyStatus();
    let rows = [];
    const client = fakeClient((name) => (name === CLI_KEY_RPC.status ? { data: rows, error: null } : { error: null }));
    assert.equal(await companyCliKeyConfigured({ client }), false);
    rows = ADMIN_ROWS;
    await saveCliKey('anthropic', 'sk-ant-test-abc1234', { client });
    assert.equal(await companyCliKeyConfigured({ client }), true);
    rows = [];
    await deleteCliKey('anthropic', { client });
    assert.equal(await companyCliKeyConfigured({ client }), false);
});

test('저장 전에 떠난 읽기가 늦게 돌아와도 옛 값을 기억하지 않는다', async () => {
    invalidateCliKeyStatus();
    let release;
    const slow = new Promise((r) => (release = r));
    let statusCalls = 0;
    const client = {
        rpc(name) {
            if (name !== CLI_KEY_RPC.status) return Promise.resolve({ error: null });
            statusCalls += 1;
            return statusCalls === 1 ? slow.then(() => ({ data: [], error: null })) : Promise.resolve({ data: ADMIN_ROWS, error: null });
        }
    };
    const stale = companyCliKeyConfigured({ client });
    await saveCliKey('anthropic', 'sk-ant-test-abc1234', { client });
    release();
    assert.equal(await stale, false);
    assert.equal(await companyCliKeyConfigured({ client }), true, '저장 뒤 물음은 새로 읽는다');
});

test('설정 화면의 상태 읽기도 채팅 선택지 판단에 쓰인다(같은 탭에서 다시 묻지 않게)', async () => {
    invalidateCliKeyStatus();
    const client = fakeClient(() => ({ data: ADMIN_ROWS, error: null }));
    await fetchCliKeyStatus({ client });
    assert.equal(await companyCliKeyConfigured({ client }), true);
    assert.equal(client.calls.length, 1);
});

test('키 저장소(SQL)가 없는 서버는 오류가 아니라 「준비 안 됨」으로 알아본다', async () => {
    const { isStoreMissing } = await import('./index.js');
    assert.equal(isStoreMissing({ code: 'PGRST202', message: 'Could not find the function public.cli_agent_credential_status' }), true);
    assert.equal(isStoreMissing({ code: '42883' }), true);
    assert.equal(isStoreMissing({ code: '42P01' }), true);
    assert.equal(isStoreMissing({ code: '42501', message: 'permission denied' }), false);
    assert.equal(isStoreMissing(new Error('network down')), false);
});
