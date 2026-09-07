import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clear, stash, take } from './handoff.js';

test('맡긴 것을 그대로 찾아간다', () => {
    stash(['a', 'b']);
    assert.deepEqual(take(), ['a', 'b']);
});

test('한 번 찾아가면 비워진다 — 다음 대화에 지난 사진이 딸려 붙으면 안 된다', () => {
    stash(['a']);
    take();
    assert.deepEqual(take(), []);
});

test('맡긴 적이 없으면 빈 목록', () => {
    clear();
    assert.deepEqual(take(), []);
});
