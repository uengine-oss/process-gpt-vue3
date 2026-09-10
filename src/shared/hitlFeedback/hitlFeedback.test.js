import test from 'node:test';
import assert from 'node:assert/strict';

import { allAnswered, answeredIds, isPaused, mergeFeedback, parseOutput, questionIds, unansweredIds } from './index.js';

// 실제 데이터 모양
const OUTPUT = {
    hitl_paused: true,
    hitl_feedbacks: [],
    hitl_checkpoint: {
        wait_started_at: '2026-09-03T05:54:19.971Z',
        question_ids: { dmn: 'todo-1-dmn_apply', agents: {}, skills: {} }
    }
};

test('중첩된 question_ids 에서 실제 물음만 꺼낸다', () => {
    assert.deepEqual(questionIds(OUTPUT), ['todo-1-dmn_apply']);
    assert.deepEqual(questionIds({}), []);
});

test('문자열로 저장된 output 도 읽는다 — 한쪽만 처리하면 답이 사라진다', () => {
    assert.deepEqual(questionIds(JSON.stringify(OUTPUT)), ['todo-1-dmn_apply']);
    assert.deepEqual(parseOutput('깨진 json'), {});
});

test('답을 기록하면 아직 안 한 물음이 줄어든다', () => {
    const next = mergeFeedback(OUTPUT, { question_id: 'todo-1-dmn_apply', answer: '예' }, '2026-09-03T06:00:00.000Z');
    assert.deepEqual(answeredIds(next), ['todo-1-dmn_apply']);
    assert.deepEqual(unansweredIds(next), []);
    assert.equal(allAnswered(next), true);
});

test('지난 대기 때의 답은 세지 않는다 — 묻지도 않고 재개하면 안 된다', () => {
    const stale = {
        ...OUTPUT,
        hitl_feedbacks: [{ question_id: 'todo-1-dmn_apply', answer: '예', submitted_at: '2026-09-01T00:00:00.000Z' }]
    };
    assert.deepEqual(answeredIds(stale), []);
    assert.equal(allAnswered(stale), false);
});

test('같은 물음에 다시 답하면 덮어쓴다', () => {
    let out = mergeFeedback(OUTPUT, { question_id: 'todo-1-dmn_apply', answer: '예' }, '2026-09-03T06:00:00.000Z');
    out = mergeFeedback(out, { question_id: 'todo-1-dmn_apply', answer: '아니오' }, '2026-09-03T06:01:00.000Z');
    assert.equal(out.hitl_feedbacks.length, 1);
    assert.equal(out.hitl_feedbacks[0].answer, '아니오');
    assert.equal(out.hitl_last_feedback.answer, '아니오');
});

test('물음이 없으면 재개하지 않는다', () => {
    assert.equal(allAnswered({}), false);
});

test('식별자 없는 답은 기록하지 않는다', () => {
    assert.deepEqual(mergeFeedback(OUTPUT, { answer: '예' }).hitl_feedbacks, []);
});

test('멈춰 있는지 알아본다', () => {
    assert.equal(isPaused(OUTPUT), true);
    assert.equal(isPaused({}), false);
});
