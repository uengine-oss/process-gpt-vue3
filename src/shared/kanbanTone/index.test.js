import test from 'node:test';
import assert from 'node:assert/strict';
import { kanbanTone, TONE_COLOR } from './index.js';

test('업무 상태와 칸반 열 id 를 같은 색 이름으로 읽는다', () => {
    assert.equal(kanbanTone('IN_PROGRESS'), 'progress');
    assert.equal(kanbanTone('SUBMITTED'), 'progress');
    assert.equal(kanbanTone('Running'), 'progress');
    assert.equal(kanbanTone('PENDING'), 'waiting');
    assert.equal(kanbanTone('DONE'), 'done');
    assert.equal(kanbanTone('COMPLETED'), 'done');
    assert.equal(kanbanTone('TODO'), 'todo');
    assert.equal(kanbanTone('DRAFT'), 'todo');
    assert.equal(kanbanTone(undefined), 'todo');
});

test('색은 하드코딩하지 않고 테마 토큰만 쓴다', () => {
    Object.values(TONE_COLOR).forEach((c) => assert.match(c, /var\(--/));
});
