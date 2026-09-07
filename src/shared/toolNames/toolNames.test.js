import test from 'node:test';
import assert from 'node:assert/strict';

import { formatToolName } from './index.js';

test('아는 도구는 사람 말로', () => {
    assert.equal(formatToolName('get_todolist'), '할일 목록 조회');
});

test('출처가 앞에 붙어 와도 읽는다', () => {
    assert.equal(formatToolName('work-assistant__get_organization'), '조직도 조회');
});

test('모르는 도구도 감추지 않는다 — 무엇을 했는지는 알아야 한다', () => {
    assert.equal(formatToolName('some_new_tool'), 'some_new_tool');
});

test('빈 값', () => {
    assert.equal(formatToolName(''), '');
    assert.equal(formatToolName(null), '');
});
