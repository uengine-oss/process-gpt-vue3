import test from 'node:test';
import assert from 'node:assert/strict';

import { canReassignWorkItem, endpointList, findStarterId } from './workItemAccess.js';

const work = [
    { endpoint: 'u-lead', startDate: '2026-11-09T05:40:00Z' },
    { endpoint: 'u-starter', startDate: '2026-11-09T05:31:00Z' },
    { endpoint: 'u-starter', startDate: '2026-11-09T05:33:00Z' }
];

test('시작자는 가장 먼저 시작된 업무의 담당자다', () => {
    assert.equal(findStarterId(work), 'u-starter');
    assert.equal(findStarterId([]), null);
    assert.equal(findStarterId(null), null);
    // 시작일이 없는 업무는 건너뛴다
    assert.equal(findStarterId([{ endpoint: 'u-x' }, { endpoint: 'u-y', startDate: '2026-01-01' }]), 'u-y');
});

test('담당자 값은 쉼표로 여러 명일 수 있다', () => {
    assert.deepEqual(endpointList('a, b,,c'), ['a', 'b', 'c']);
    assert.deepEqual(endpointList(null), []);
});

test('담당자 본인 · 시작자 · 관리자만 넘길 수 있다', () => {
    const base = { endpoint: 'u-lead', starterId: 'u-starter', completed: false };
    assert.equal(canReassignWorkItem({ ...base, uid: 'u-lead', isAdmin: false }), true, '담당자');
    assert.equal(canReassignWorkItem({ ...base, uid: 'u-starter', isAdmin: false }), true, '시작자');
    assert.equal(canReassignWorkItem({ ...base, uid: 'u-admin', isAdmin: true }), true, '관리자');
    assert.equal(canReassignWorkItem({ ...base, uid: 'u-other', isAdmin: false }), false, '다른 참여자');
    assert.equal(canReassignWorkItem({ ...base, uid: null, isAdmin: false }), false, '로그인 정보 없음');
});

test('여러 담당자 중 한 명이면 담당자로 본다', () => {
    assert.equal(canReassignWorkItem({ uid: 'u-b', isAdmin: false, endpoint: 'u-a,u-b', starterId: null, completed: false }), true);
});

test('담당자가 비어 있는 업무는 시작자와 관리자만 넘길 수 있다', () => {
    const base = { endpoint: null, starterId: 'u-starter', completed: false };
    assert.equal(canReassignWorkItem({ ...base, uid: 'u-starter', isAdmin: false }), true);
    assert.equal(canReassignWorkItem({ ...base, uid: 'u-other', isAdmin: false }), false);
});

test('끝난 업무는 아무도 넘길 수 없다', () => {
    assert.equal(canReassignWorkItem({ uid: 'u-admin', isAdmin: true, endpoint: 'u-lead', starterId: 'u-s', completed: true }), false);
});
