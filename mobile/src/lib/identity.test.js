/**
 * 로그인한 사람 정보를 재사용 계층이 읽는 자리에 적어 두기.
 *
 * 비워 두면 업무 완료 요청이 "누가" 없이 나간다. 실패가 아니라 조용히 잘못된
 * 값으로 성공하기 때문에 눈치채기 어렵다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { KEYS, applyIdentity, clearIdentity, identityFrom } from './identity.js';

const session = { user: { id: 'u-1', email: 'me@company.com' } };

function fakeStore() {
    const data = new Map();
    return {
        data,
        setItem: (k, v) => data.set(k, v),
        removeItem: (k) => data.delete(k),
        getItem: (k) => (data.has(k) ? data.get(k) : null)
    };
}

test('세션에서 기본 정보를 만든다', () => {
    const id = identityFrom(session);

    assert.equal(id.email, 'me@company.com');
    assert.equal(id.uid, 'u-1');
    assert.equal(id.author, 'me@company.com');
});

test('이름을 모르면 이메일로 대신한다', () => {
    // 비워 두면 화면 곳곳에 빈칸이 생기고 업무 이력에도 "누가" 가 빠진다.
    assert.equal(identityFrom(session).userName, 'me@company.com');
});

test('사용자 레코드의 이름을 우선한다', () => {
    const id = identityFrom(session, { username: '홍길동' });

    assert.equal(id.userName, '홍길동');
});

test('권한은 claims 를 우선한다', () => {
    const id = identityFrom(session, { role: 'viewer', is_admin: false }, { role: 'admin', isAdmin: true });

    assert.equal(id.role, 'admin');
    assert.equal(id.isAdmin, 'true');
});

test('로그인하지 않았으면 만들지 않는다', () => {
    assert.equal(identityFrom(null), null);
    assert.equal(identityFrom({ user: {} }), null);
});

test('저장한다', () => {
    const store = fakeStore();

    applyIdentity(identityFrom(session), store);

    assert.equal(store.getItem('email'), 'me@company.com');
    assert.equal(store.getItem('uid'), 'u-1');
});

test('빈 값은 저장하지 않는다', () => {
    // 빈 문자열도 "설정됨" 으로 읽혀, 없는 것보다 나쁜 값이 된다.
    const store = fakeStore();

    applyIdentity(identityFrom(session), store);

    assert.equal(store.getItem('role'), null);
});

test('로그아웃하면 지운다', () => {
    // 남겨 두면 다음 사람 화면인데 요청은 이전 사람 이름으로 나간다.
    const store = fakeStore();
    applyIdentity(identityFrom(session), store);

    clearIdentity(store);

    for (const key of KEYS) assert.equal(store.getItem(key), null, key);
});

test('저장소가 없어도 터지지 않는다', () => {
    assert.equal(applyIdentity(identityFrom(session), null), false);
    clearIdentity(null);
});
