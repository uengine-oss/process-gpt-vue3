// 인계 파일을 받는 방 작업 폴더에 놓는 규칙 — 한글 이름도 저장소 키가 되고 원래 이름으로 돌아온다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    encodeStorageKeyPath,
    decodeStorageKeySegment,
    roomWorkspaceKey,
    roomWorkspacePath,
    uniqueHandoverNames
} from './handoverFiles.js';

// Supabase Storage 가 키로 받는 글자(이 밖이면 InvalidKey).
const SAFE = /^[A-Za-z0-9_/!\-.*'() &$@=;:+,?]*$/;

test('한글 파일 이름은 저장소가 받는 키가 되고 원래 이름으로 돌아온다', () => {
    const key = encodeStorageKeyPath('견적서_한빛상사_서버3대.docx');
    assert.match(key, SAFE);
    assert.equal(decodeStorageKeySegment(key), '견적서_한빛상사_서버3대.docx');
});

test('deepagents 와 같은 인코딩이다(작업 폴더 하이드레이션이 원래 이름으로 푼다)', () => {
    // python: "__u8__" + base64.urlsafe_b64encode("견적서.docx".encode()).rstrip("=")
    assert.equal(encodeStorageKeyPath('견적서.docx'), '__u8__6rKs7KCB7IScLmRvY3g');
});

test('영문 이름은 그대로 둔다', () => {
    assert.equal(encodeStorageKeyPath('quote.docx'), 'quote.docx');
});

test('받는 방 작업 폴더 키와 경로', () => {
    assert.equal(roomWorkspaceKey('localhost', 'room-1', 'a/b/대화 기록.md').split('/').slice(0, 3).join('/'), 'skills/localhost/room-1');
    assert.equal(roomWorkspacePath('room-1', 'a/b/대화 기록.md'), '/workspace/.bpmn/room-1/대화 기록.md');
});

test('같은 이름은 번호를 붙여 서로 덮어쓰지 않는다', () => {
    assert.deepEqual(uniqueHandoverNames(['x/견적서.docx', 'y/견적서.docx', 'memo']), ['견적서.docx', '견적서 (2).docx', 'memo']);
});
