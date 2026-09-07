import test from 'node:test';
import assert from 'node:assert/strict';

import { isFirstUserMessage, shouldGenerateChatRoomName } from './index.js';

test('이름이 없거나 "새 대화" 면 지어 준다', () => {
    assert.equal(shouldGenerateChatRoomName({ name: '' }), true);
    assert.equal(shouldGenerateChatRoomName({ name: '새 대화' }), true);
    assert.equal(shouldGenerateChatRoomName({ name: 'New Chat' }), true);
});

test('번역된 라벨도 이름 없음으로 본다', () => {
    assert.equal(shouldGenerateChatRoomName({ name: 'Neuer Chat' }, 'Neuer Chat'), true);
});

test('사용자가 지은 이름은 건드리지 않는다', () => {
    assert.equal(shouldGenerateChatRoomName({ name: '휴가 관련 문의' }), false);
});

test('명시적 지시가 있으면 그것을 따른다', () => {
    assert.equal(shouldGenerateChatRoomName({ name: '이미 있음', context: { auto_name_pending: true } }), true);
    assert.equal(shouldGenerateChatRoomName({ name: '', context: { auto_name_pending: false } }), false);
});

test('방이 없으면 짓지 않는다', () => {
    assert.equal(shouldGenerateChatRoomName(null), false);
});

test('첫 사용자 메시지일 때만 짓는다 — 두 번째부터 지으면 바꾼 이름을 덮는다', () => {
    assert.equal(isFirstUserMessage([]), true);
    assert.equal(isFirstUserMessage([{ role: 'assistant' }]), true);
    assert.equal(isFirstUserMessage([{ role: 'user' }]), false);
    assert.equal(isFirstUserMessage([{ mine: true }]), false);
});
