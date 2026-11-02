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

// ---------------------------------------------------------------------------
// 에이전트 실행이 질문을 남기고 멈춘 작업(HUMAN_ASKED) — 질문 카드 답변으로 재개
// ---------------------------------------------------------------------------

import { humanQuestionText, resumePatchForAnswer } from './index.js';

test('질문 카드는 deepagents 의 question 도 보인다', () => {
    assert.equal(humanQuestionText({ question: '이번 주 납기 지연 허용 기준이 며칠입니까?' }), '이번 주 납기 지연 허용 기준이 며칠입니까?');
    assert.equal(humanQuestionText({ text: '승인할까요?', question: '무시' }), '승인할까요?');
    assert.equal(humanQuestionText(null), '');
});

test('HUMAN_ASKED 작업에 답하면 feedback 에 붙이고 FB_REQUESTED 로 돌린다', () => {
    const patch = resumePatchForAnswer(
        { draft_status: 'HUMAN_ASKED', feedback: [{ content: '이전 피드백' }] },
        '5일까지 허용합니다',
        { userId: 'u1', at: '2026-10-06T03:16:00.000Z' }
    );
    assert.deepEqual(patch, {
        feedback: [
            { content: '이전 피드백' },
            { time: '2026-10-06T03:16:00.000Z', content: '5일까지 허용합니다', user_id: 'u1', kind: 'human_answer' }
        ],
        draft_status: 'FB_REQUESTED'
    });
});

test('문자열로 저장된 feedback 도 이어 붙인다', () => {
    const patch = resumePatchForAnswer({ draft_status: 'HUMAN_ASKED', feedback: '[{"content":"a"}]' }, 'b', { at: 't' });
    assert.deepEqual(patch.feedback.map((f) => f.content), ['a', 'b']);
    assert.deepEqual(resumePatchForAnswer({ draft_status: 'HUMAN_ASKED', feedback: 'not json' }, 'b', { at: 't' }).feedback.length, 1);
});

test('실행 중(STARTED)이거나 끝난 작업은 건드리지 않는다', () => {
    // 실행 안에서 응답 이벤트를 폴링하며 기다리는 도구는 STARTED 그대로다.
    for (const draft_status of ['STARTED', 'COMPLETED', 'FB_REQUESTED', 'CANCELLED', null]) {
        assert.equal(resumePatchForAnswer({ draft_status }, '답'), null, String(draft_status));
    }
    assert.equal(resumePatchForAnswer(null, '답'), null);
});

// ---------------------------------------------------------------------------
// 재개 사유 구분 표시(kind) — 스펙 workitem-resume-signal RS-6
//
// 사람 답변 재개와 반려 재작업은 워커가 집는 순간 행 모양이 같다(STARTED,
// claim_count=1, feedback 1건). 화면이 feedback 항목에 kind 를 남기지 않으면
// SDK 가 둘을 구분하지 못하고, CLI 에이전트는 멈춘 세션 대신 처음부터 다시 한다.
// ---------------------------------------------------------------------------

import { FEEDBACK_KIND_HUMAN_ANSWER, FEEDBACK_KIND_REVISION, revisionFeedbackEntry } from './index.js';

test('RS-6.1 질문 카드 답은 human_answer 로 표시해 원문 그대로 붙인다', () => {
    const answer = '승인합니다. 단 C사는 제외하세요';
    const patch = resumePatchForAnswer({ draft_status: 'HUMAN_ASKED', feedback: [] }, answer, { at: 't' });
    const last = patch.feedback.at(-1);
    assert.equal(last.kind, FEEDBACK_KIND_HUMAN_ANSWER);
    assert.equal(FEEDBACK_KIND_HUMAN_ANSWER, 'human_answer');
    assert.equal(last.content, answer);
    assert.equal(patch.draft_status, 'FB_REQUESTED');
});

test('RS-6.2 결과 화면 피드백은 revision 으로 표시하고 기존 필드는 그대로 둔다', () => {
    assert.deepEqual(revisionFeedbackEntry('표 형식으로 다시', { userId: 'u1', at: '2026-10-07T00:00:00.000Z' }), {
        time: '2026-10-07T00:00:00.000Z',
        content: '표 형식으로 다시',
        user_id: 'u1',
        kind: 'revision'
    });
    assert.equal(FEEDBACK_KIND_REVISION, 'revision');
    assert.equal(revisionFeedbackEntry('x').user_id, null);
});
