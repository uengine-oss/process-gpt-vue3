/**
 * 진행 현황에 무엇을 보여 줄 것인가.
 *
 * 지키려는 것 두 가지
 *   - 조직 전체 수천 건이 아니라 내 건이 보이는 것
 *   - 그렇다고 화면이 비어 버리지 않는 것
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { hasParticipantInfo, involvesMe, visibleInstances } from './instances.js';

const me = { uid: 'u-1', email: 'me@company.com' };

test('참여자에 내가 있으면 내 건이다', () => {
    assert.equal(involvesMe({ participants: ['u-9', 'u-1'] }, me), true);
});

test('역할 배정에 내가 있으면 내 건이다', () => {
    const inst = { roleBindings: [{ name: '직원', endpoint: 'u-1', default: '' }] };

    assert.equal(involvesMe(inst, me), true);
});

test('역할 배정의 endpoint 가 배열이어도 찾는다', () => {
    // 실제 데이터에 배열로 들어 있는 경우가 있다. 한 모양만 보면 놓친다.
    const inst = { roleBindings: [{ name: '도우미', endpoint: ['u-3', 'u-1'] }] };

    assert.equal(involvesMe(inst, me), true);
});

test('이메일로 적혀 있어도 찾는다', () => {
    assert.equal(involvesMe({ participants: ['me@company.com'] }, me), true);
});

test('남의 건은 내 것이 아니다', () => {
    assert.equal(involvesMe({ participants: ['u-9'], roleBindings: [{ endpoint: 'u-8' }] }, me), false);
});

test('참여 정보가 없으면 알 수 없으므로 내 것이 아니다', () => {
    assert.equal(involvesMe({}, me), false);
    assert.equal(involvesMe(null, me), false);
});

test('내가 누구인지 모르면 아무것도 내 것이 아니다', () => {
    assert.equal(involvesMe({ participants: ['u-1'] }, {}), false);
});

// ---------------------------------------------------------------------------
// 목록
// ---------------------------------------------------------------------------

test('내 건이 있으면 그것만 보여 준다', () => {
    const list = [
        { name: '내 것', participants: ['u-1'] },
        { name: '남의 것', participants: ['u-9'] }
    ];

    assert.deepEqual(visibleInstances(list, me).map((i) => i.name), ['내 것']);
});

test('참여자 정보가 아예 없으면 전부 보여 준다', () => {
    // 알 수 없는 경우다. 감추면 정보가 비어 있는 건을 가진 사람은 자기 건이
    // 사라졌다고 느낀다.
    const list = [{ name: 'A' }, { name: 'B' }];

    assert.equal(visibleInstances(list, me).length, 2);
});

test('참여자 정보가 있는데 내가 없으면 빈 목록이다', () => {
    // 전부 보여 주면 관련 없는 사람에게 조직의 수천 건이 뜬다.
    const list = [
        { name: '남의 것', participants: ['u-9'] },
        { name: '또 남의 것', participants: ['u-8'] }
    ];

    assert.deepEqual(visibleInstances(list, me), []);
});

test('참여자 정보 유무를 구분한다', () => {
    assert.equal(hasParticipantInfo({ participants: ['u-1'] }), true);
    assert.equal(hasParticipantInfo({ roleBindings: [{ endpoint: 'u-1' }] }), true);
    assert.equal(hasParticipantInfo({ participants: [], roleBindings: [] }), false);
    assert.equal(hasParticipantInfo({}), false);
});

test('목록이 없어도 터지지 않는다', () => {
    assert.deepEqual(visibleInstances(null, me), []);
});
