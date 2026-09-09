import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMention, mentionDraft, parseMentions, resolveMentions, suggest } from './index.js';

const AGENTS = [
    { id: 'a1', username: 'Process GPT Agent' },
    { id: 'a2', username: '휴가봇', alias: 'leave' }
];

test('멘션을 뽑는다 — 한글 이름도', () => {
    assert.deepEqual(parseMentions('@휴가봇 확인 부탁해요'), ['휴가봇']);
    assert.deepEqual(parseMentions('@a @b @a'), ['a', 'b']);
    assert.deepEqual(parseMentions('멘션 없음'), []);
});

test('적힌 이름을 실제 참가자로 맞춘다', () => {
    assert.deepEqual(resolveMentions('@휴가봇 해줘', AGENTS).map((a) => a.id), ['a2']);
    assert.deepEqual(resolveMentions('@leave 해줘', AGENTS).map((a) => a.id), ['a2']);
});

test('띄어쓰기·대소문자는 무시한다', () => {
    assert.deepEqual(resolveMentions('@processgptagent 해줘', AGENTS).map((a) => a.id), ['a1']);
});

test('없는 사람은 버린다 — 지목한 채 보내면 아무도 답하지 않는다', () => {
    assert.deepEqual(resolveMentions('@없는사람 해줘', AGENTS), []);
});

test('입력 중인 조각을 알아본다 — 후보를 띄우기 위해', () => {
    assert.equal(mentionDraft('안녕 @휴'), '휴');
    assert.equal(mentionDraft('안녕 @'), '');
    assert.equal(mentionDraft('안녕 @휴가봇 확인'), null);
    assert.equal(mentionDraft(''), null);
});

test('조각으로 후보를 좁힌다', () => {
    assert.deepEqual(suggest(AGENTS, '휴').map((a) => a.id), ['a2']);
    assert.equal(suggest(AGENTS, '').length, 2);
});

test('고른 후보를 글에 끼워 넣는다', () => {
    assert.equal(applyMention('안녕 @휴', 5, AGENTS[1]), '안녕 @휴가봇 ');
});
