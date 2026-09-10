/**
 * 로그인 실패 이유 가르기.
 *
 * 지키려는 것: **네트워크가 막혔을 때 "비밀번호가 틀렸다" 고 말하지 않는 것.**
 * 실제로 겪은 일이다 — 에뮬레이터에서 평문 통신이 막혔는데 화면에는 비밀번호
 * 오류로 떠서, 맞는 비밀번호를 계속 다시 치게 됐다.
 *
 * 동시에 지키는 것: 서버가 거절한 이유는 더 나누지 않는 것.
 * "없는 계정" 과 "비밀번호 틀림" 을 구분해 주면 계정 존재를 확인하는 수단이 된다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyAuthError, signIn } from './session.js';

// ---------------------------------------------------------------------------
// 서버에 닿지 못한 경우
// ---------------------------------------------------------------------------

test('Supabase 가 통신 실패라고 알려 주면 연결 문제로 본다', () => {
    assert.equal(classifyAuthError({ name: 'AuthRetryableFetchError' }), 'offline');
});

test('웹뷰가 요청을 막은 경우도 연결 문제다', () => {
    // 혼합 콘텐츠 차단이 이 모양으로 온다.
    assert.equal(classifyAuthError(new TypeError('Failed to fetch')), 'offline');
});

test('브라우저마다 다른 표현도 알아본다', () => {
    assert.equal(classifyAuthError({ message: 'NetworkError when attempting to fetch resource.' }), 'offline');
    assert.equal(classifyAuthError({ message: 'Load failed' }), 'offline');
});

test('HTTP 상태가 없으면 서버 답이 아니다', () => {
    assert.equal(classifyAuthError({ message: '알 수 없는 오류' }), 'offline');
    assert.equal(classifyAuthError({ status: 0, message: 'x' }), 'offline');
});

// ---------------------------------------------------------------------------
// 서버가 거절한 경우
// ---------------------------------------------------------------------------

test('서버가 거절하면 입력 문제로 본다', () => {
    assert.equal(classifyAuthError({ status: 400, message: 'Invalid login credentials' }), 'rejected');
    assert.equal(classifyAuthError({ status: 401, message: 'Unauthorized' }), 'rejected');
});

test('거절 이유는 더 나누지 않는다', () => {
    // 없는 계정과 비밀번호 틀림이 같은 결과여야 한다. 다르면 계정 존재를 확인할 수 있다.
    const noAccount = classifyAuthError({ status: 400, message: 'User not found' });
    const wrongPassword = classifyAuthError({ status: 400, message: 'Invalid login credentials' });

    assert.equal(noAccount, wrongPassword);
});

test('너무 자주 시도해 잠긴 것은 비밀번호 문제가 아니다', () => {
    assert.equal(classifyAuthError({ status: 429, message: 'Too many requests' }), 'too-many');
});

test('오류가 없으면 이유도 없다', () => {
    assert.equal(classifyAuthError(null), null);
});

// ---------------------------------------------------------------------------
// signIn 이 그 구분을 그대로 전한다
// ---------------------------------------------------------------------------

function fakeAuth(behaviour) {
    return { auth: { signInWithPassword: async () => behaviour() } };
}

test('연결 실패를 그대로 전한다', async () => {
    const supabase = fakeAuth(() => ({ data: null, error: new TypeError('Failed to fetch') }));

    assert.deepEqual(await signIn('a@b.c', 'pw', supabase), { ok: false, reason: 'offline' });
});

test('거절을 그대로 전한다', async () => {
    const supabase = fakeAuth(() => ({ data: null, error: { status: 400, message: 'Invalid login credentials' } }));

    assert.deepEqual(await signIn('a@b.c', 'pw', supabase), { ok: false, reason: 'rejected' });
});

test('예외로 던져진 실패도 가린다', async () => {
    // 어떤 실패는 반환이 아니라 예외로 온다. 놓치면 화면이 멈춘 것처럼 보인다.
    const supabase = fakeAuth(() => {
        throw new TypeError('Failed to fetch');
    });

    assert.deepEqual(await signIn('a@b.c', 'pw', supabase), { ok: false, reason: 'offline' });
});

test('성공하면 세션을 준다', async () => {
    const supabase = fakeAuth(() => ({ data: { session: { user: { email: 'a@b.c' } } }, error: null }));

    const result = await signIn('a@b.c', 'pw', supabase);

    assert.equal(result.ok, true);
    assert.equal(result.session.user.email, 'a@b.c');
});

test('이메일 앞뒤 공백은 떼고 보낸다', async () => {
    let sent = null;
    const supabase = { auth: { signInWithPassword: async (a) => { sent = a; return { data: {}, error: null }; } } };

    await signIn('  a@b.c  ', 'pw', supabase);

    assert.equal(sent.email, 'a@b.c');
});

test('Supabase 가 아예 없으면 그렇다고 말한다', async () => {
    assert.deepEqual(await signIn('a@b.c', 'pw', null), { ok: false, reason: 'unavailable' });
});
