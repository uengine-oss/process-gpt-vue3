import test from 'node:test';
import assert from 'node:assert/strict';

import {
    chatFailureMessage,
    createPersistCircuit,
    errorText,
    explainChatFailure,
    PERSIST_FAILURE_LIMIT,
    tidyDetail,
    DETAIL_MAX
} from './index.js';

test('브라우저 자원 고갈은 탭을 닫고 새로고침하라고 안내한다', () => {
    // 운영에서 실제로 채팅을 막았던 오류다. 이때 사용자가 할 수 있는 일이 있으므로
    // 그것을 적어 준다.
    const r = explainChatFailure(new Error('Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES'));
    assert.equal(r.id, 'browser-resources');
    assert.match(r.text, /탭/);
    assert.match(r.text, /새로고침/);
});

test('오프라인은 네트워크 연결을 먼저 말한다', () => {
    const r = explainChatFailure(new Error('Failed to fetch'), { online: false });
    assert.equal(r.id, 'offline');
});

test('온라인인데 fetch 가 실패하면 서버 연결 실패로 본다', () => {
    const r = explainChatFailure(new Error('TypeError: Failed to fetch'), { online: true });
    assert.equal(r.id, 'network');
});

test('권한 오류는 다시 로그인하라고 안내한다', () => {
    assert.equal(explainChatFailure(new Error('stream error: 401')).id, 'unauthorized');
    assert.equal(explainChatFailure(new Error('stream error: 403')).id, 'unauthorized');
});

test('동시 세션 상한(429)은 대화를 닫으라고 안내한다', () => {
    // 세션당 파드 배포에서 라우터가 테넌트 상한을 넘기면 429 를 준다.
    const r = explainChatFailure(new Error('DeepAgentRouter stream error: 429'));
    assert.equal(r.id, 'too-many-sessions');
    assert.match(r.text, /대화/);
});

test('서버 오류는 잠시 뒤 다시 시도하라고 안내한다', () => {
    assert.equal(explainChatFailure(new Error('stream error: 500')).id, 'server');
    assert.equal(explainChatFailure(new Error('stream error: 502')).id, 'server');
});

test('모르는 오류도 빈 화면 대신 안내를 남긴다', () => {
    const r = explainChatFailure(new Error('무언가 이상함'));
    assert.equal(r.id, 'unknown');
    assert.ok(r.text.length > 0);
});

test('오류가 없어도 터지지 않는다', () => {
    assert.equal(errorText(null), '');
    assert.equal(explainChatFailure(null).id, 'unknown');
    assert.ok(chatFailureMessage(null).startsWith('⚠️'));
});

test('말풍선 본문은 안내가 먼저, 원문은 뒤에 붙는다', () => {
    const body = chatFailureMessage(new Error('net::ERR_INSUFFICIENT_RESOURCES'));
    assert.ok(body.startsWith('⚠️'));
    assert.match(body, /탭/);
    // 원문도 남겨 둔다 — 문의가 들어오면 이게 단서가 된다.
    assert.match(body, /ERR_INSUFFICIENT_RESOURCES/);
    assert.ok(body.indexOf('탭') < body.indexOf('ERR_INSUFFICIENT_RESOURCES'));
});

test('차단기는 연속 실패가 한도에 닿으면 더 시도하지 않는다', () => {
    const c = createPersistCircuit(3);
    assert.equal(c.shouldAttempt(), true);
    c.recordFailure();
    c.recordFailure();
    assert.equal(c.shouldAttempt(), true, '한도 전에는 계속 시도한다');
    c.recordFailure();
    assert.equal(c.shouldAttempt(), false, '한도에 닿으면 멈춘다 — 이 재시도가 채팅을 막았다');
});

test('차단기는 처음 열릴 때 한 번만 알린다', () => {
    const c = createPersistCircuit(2);
    assert.equal(c.recordFailure(), false);
    assert.equal(c.recordFailure(), true, '한도에 닿은 그 순간 알린다');
    assert.equal(c.recordFailure(), false, '그 뒤로는 같은 말을 반복하지 않는다');
});

test('한 번 성공하면 차단기가 풀린다', () => {
    const c = createPersistCircuit(2);
    c.recordFailure();
    c.recordFailure();
    assert.equal(c.shouldAttempt(), false);
    c.recordSuccess();
    assert.equal(c.shouldAttempt(), true);
    assert.equal(c.failures, 0);
    // 다시 나빠지면 또 알려야 한다.
    c.recordFailure();
    assert.equal(c.recordFailure(), true);
});

test('기본 한도가 있다', () => {
    assert.ok(PERSIST_FAILURE_LIMIT >= 1);
    const c = createPersistCircuit();
    for (let i = 0; i < PERSIST_FAILURE_LIMIT; i++) c.recordFailure();
    assert.equal(c.shouldAttempt(), false);
});

test('감싸인 오류의 원인 사슬을 끝까지 따라간다', () => {
    // 저장 계층이 원본을 감싼다: StorageBaseError('error in putObject', 원본).
    // 겉만 보면 무엇 때문에 실패했는지가 통째로 가려진다.
    const inner = new Error('net::ERR_INSUFFICIENT_RESOURCES');
    const outer = new Error('error in putObject', { cause: inner });
    const text = errorText(outer);
    assert.match(text, /putObject/);
    assert.match(text, /ERR_INSUFFICIENT_RESOURCES/);
    assert.equal(explainChatFailure(outer).id, 'browser-resources', '감싸여 있어도 진짜 원인으로 판정해야 한다');
});

test('원인을 특정 못 해도 저장 실패라는 것은 알려 준다', () => {
    const r = explainChatFailure(new Error('error in putObject'));
    assert.equal(r.id, 'persist');
    assert.match(r.text, /저장/);
});

test('순환 참조가 있어도 터지지 않는다', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    a.cause = b;
    assert.ok(errorText(b).length > 0);
});

test('원문에서 스택 트레이스를 걷어낸다', () => {
    // 다듬지 않으면 "at https://…/index.js:47:53373" 같은 줄이 말풍선에 들어간다.
    const e = new Error('TypeError: Failed to fetch\n    at https://x/assets/index.js:47:53373\n    at async q6 (...)');
    const body = chatFailureMessage(e, { online: true });
    assert.doesNotMatch(body, /\bat https?:\/\//);
    assert.match(body, /Failed to fetch/);
});

test('겹겹이 감싸며 반복된 조각을 접는다', () => {
    const raw = 'error in putObject: error in putObject:0 TypeError: Failed to fetch: TypeError: Failed to fetch';
    assert.equal(tidyDetail(raw).match(/Failed to fetch/g).length, 1);
});

test('원문이 길면 잘라 낸다', () => {
    const long = 'x'.repeat(DETAIL_MAX * 3);
    const tidy = tidyDetail(long);
    assert.ok(tidy.length <= DETAIL_MAX + 1, '말풍선이 원문으로 뒤덮이면 안 된다');
    assert.ok(tidy.endsWith('…'));
});

test('다듬어도 원인 판정은 그대로다', () => {
    const e = new Error('error in putObject: net::ERR_INSUFFICIENT_RESOURCES\n    at https://x/y.js:1:1');
    const body = chatFailureMessage(e);
    assert.match(body, /탭/, '조치 안내는 살아 있어야 한다');
});

test('구분자가 달라도 되풀이를 접는다', () => {
    // 계층마다 "A: B" 로도, "A B" 로도 이어 붙여서 정확히 일치하는 것만 접으면 남는다.
    const raw = 'error in putObject: error in putObject:0 TypeError: Failed to fetch: TypeError: Failed to fetch TypeError: Failed to fetch';
    const tidy = tidyDetail(raw);
    assert.equal(tidy.match(/Failed to fetch/g).length, 1, `되풀이가 남았다: ${tidy}`);
    assert.match(tidy, /putObject/, '무엇이 실패했는지는 남아야 한다');
});
