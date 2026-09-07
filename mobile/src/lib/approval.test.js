/**
 * 초안에 답하는 규칙.
 *
 * 여기서 지키려는 것 두 가지
 *   - 기존 의견 기록을 날리지 않는 것
 *   - 의견을 보냈으면 에이전트가 실제로 다시 깨어나는 것
 *     (안 깨우면 "보냈는데 아무 일도 안 일어남" 이 된다)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { appendFeedback, draftText, feedbackPatch, hasDraft, parseFeedback } from './approval.js';

const AT = '2026-08-31T00:00:00.000Z';

// ---------------------------------------------------------------------------
// 기존 기록 보존
// ---------------------------------------------------------------------------

test('배열로 저장된 기록을 읽는다', () => {
    assert.deepEqual(parseFeedback([{ content: '이전' }]), [{ content: '이전' }]);
});

test('문자열로 저장된 기록도 읽는다', () => {
    // 컬럼에 JSON 문자열로 들어 있는 경우가 있다. 한쪽만 가정하면 기존 기록을 날린다.
    assert.deepEqual(parseFeedback('[{"content":"이전"}]'), [{ content: '이전' }]);
});

test('읽을 수 없는 값은 빈 기록으로 본다', () => {
    assert.deepEqual(parseFeedback('깨진 문자열'), []);
    assert.deepEqual(parseFeedback(null), []);
    assert.deepEqual(parseFeedback({ not: 'array' }), []);
});

test('새 의견은 뒤에 붙고 앞의 것은 남는다', () => {
    const next = appendFeedback([{ content: '이전' }], '새 의견', { userId: 'u1', at: AT });

    assert.equal(next.length, 2);
    assert.equal(next[0].content, '이전');
    assert.deepEqual(next[1], { time: AT, content: '새 의견', user_id: 'u1' });
});

test('빈 의견은 기록하지 않는다', () => {
    assert.deepEqual(appendFeedback([{ content: '이전' }], '   '), [{ content: '이전' }]);
});

// ---------------------------------------------------------------------------
// 에이전트를 다시 깨우기
// ---------------------------------------------------------------------------

test('의견을 보내면 에이전트를 다시 깨운다', () => {
    const patch = feedbackPatch({
        existingFeedback: [],
        text: '금액을 다시 확인해 주세요',
        status: 'IN_PROGRESS',
        agentOrch: 'deepagents',
        userId: 'u1',
        at: AT
    });

    assert.equal(patch.draft_status, 'FB_REQUESTED');
    assert.equal(patch.agent_orch, 'deepagents');
    assert.equal(patch.feedback.length, 1);
});

test('이미 끝난 일은 다시 깨우지 않는다', () => {
    // 깨우면 완료된 건이 진행 중으로 돌아가고, 처리한 사람에게는 되돌아온 것처럼 보인다.
    for (const status of ['DONE', 'COMPLETED', 'CANCELLED', 'done']) {
        const patch = feedbackPatch({ existingFeedback: [], text: '의견', status, at: AT });
        assert.equal(patch.draft_status, undefined, status);
        assert.equal(patch.feedback.length, 1, status);
    }
});

test('빈 의견은 아무것도 보내지 않는다', () => {
    assert.equal(feedbackPatch({ existingFeedback: [], text: '', status: 'IN_PROGRESS' }), null);
});

test('오케스트레이션을 모르면 그 값은 건드리지 않는다', () => {
    const patch = feedbackPatch({ existingFeedback: [], text: '의견', status: 'IN_PROGRESS', at: AT });

    assert.equal('agent_orch' in patch, false);
});

// ---------------------------------------------------------------------------
// 초안 보여 주기
// ---------------------------------------------------------------------------

test('초안이 있는 업무를 가려낸다', () => {
    assert.equal(hasDraft({ task: { draft: '초안 내용' } }), true);
    assert.equal(hasDraft({ task: { draft: { a: 1 } } }), true);
    assert.equal(hasDraft({ task: { draft: '   ' } }), false);
    assert.equal(hasDraft({ task: { draft: {} } }), false);
    assert.equal(hasDraft({ task: {} }), false);
    assert.equal(hasDraft(null), false);
});

test('구조화된 초안도 읽을 수 있는 글로 만든다', () => {
    // 그대로 찍으면 [object Object] 가 되어 아무것도 알 수 없다.
    const text = draftText({ task: { draft: { 금액: 1000 } } });

    assert.match(text, /금액/);
    assert.doesNotMatch(text, /\[object/);
});

test('초안이 없으면 빈 글이다', () => {
    assert.equal(draftText({ task: {} }), '');
    assert.equal(draftText(null), '');
});
