/**
 * 새 대화 만들기.
 *
 * 지키려는 것: **앱에서 시작한 대화가 웹에서도 똑같이 보이고 에이전트가 답하는 것.**
 * 방 모양이 포털과 다르면, 참가자에 에이전트가 없어 답할 사람이 없거나
 * 목록에서 이름이 비어 보인다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_ORCHESTRATION, buildRoom, isEmptyRoom, toParticipant } from './newChat.js';

const NOW = new Date('2026-09-01T00:00:00.000Z');
const me = { id: 'u-1', email: 'me@company.com', username: '홍길동' };

test('나와 에이전트가 함께 참가자로 들어간다', () => {
    // 에이전트가 없으면 답할 사람이 없다.
    const room = buildRoom(me, 'deepagents', { id: 'room-1', now: NOW });

    assert.equal(room.participants.length, 2);
    assert.equal(room.participants[0].id, 'u-1');
    assert.equal(room.participants[1].is_agent, true);
});

test('고른 에이전트가 방에 기록된다', () => {
    // 이 값으로 어느 엔진이 답할지 정해진다.
    const room = buildRoom(me, 'deepagents', { id: 'room-1', now: NOW });

    assert.equal(room.context.orchestration, 'deepagents');
});

test('고르지 않으면 기본 에이전트를 쓴다', () => {
    assert.equal(buildRoom(me, '', { id: 'r', now: NOW }).context.orchestration, DEFAULT_ORCHESTRATION);
    assert.equal(buildRoom(me, null, { id: 'r', now: NOW }).context.orchestration, DEFAULT_ORCHESTRATION);
});

test('아직 말이 오가지 않은 표식을 남긴다', () => {
    // 목록이 이것을 보고 "새 대화" 로 표시한다.
    const room = buildRoom(me, 'deepagents', { id: 'r', now: NOW });

    assert.equal(room.message.msg, 'NEW');
    assert.equal(isEmptyRoom(room), true);
});

test('말이 오간 방은 새 대화가 아니다', () => {
    assert.equal(isEmptyRoom({ message: { msg: '안녕' } }), false);
    assert.equal(isEmptyRoom({ message: '{"msg":"NEW"}' }), false, '문자열 통째로는 표식이 아니다');
    assert.equal(isEmptyRoom({}), false);
});

test('로그인 정보가 없으면 만들지 않는다', () => {
    // 참가자 없는 방을 만들면 아무도 못 여는 방이 남는다.
    assert.equal(buildRoom(null, 'deepagents', { id: 'r' }), null);
    assert.equal(buildRoom({ email: 'x@y.z' }, 'deepagents', { id: 'r' }), null);
});

// ---------------------------------------------------------------------------
// 참가자 모양
// ---------------------------------------------------------------------------

test('키 이름이 달라도 같은 모양으로 맞춘다', () => {
    // 화면마다 id/uid, username/name 이 섞여 있다. 그대로 넣으면 이름이 비어 보인다.
    assert.equal(toParticipant({ uid: 'u-2', name: '김철수' }).id, 'u-2');
    assert.equal(toParticipant({ uid: 'u-2', name: '김철수' }).username, '김철수');
});

test('이름이 없으면 이메일로 대신한다', () => {
    assert.equal(toParticipant({ id: 'u-3', email: 'a@b.c' }).username, 'a@b.c');
});

test('없는 사람은 만들지 않는다', () => {
    assert.equal(toParticipant(null), null);
});
