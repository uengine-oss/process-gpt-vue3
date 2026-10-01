import test from 'node:test';
import assert from 'node:assert/strict';
import { askUserFeedbackOf } from './askUser.js';
import { parseMcpToolOutput } from './toolOutput.js';

test('MCP ask_user(질문 + 제안)는 제안 선택 패널이 된다 — 감싼 결과여도', () => {
    const raw = `content=[{'type': 'text', 'text': '{"user_request_type": "ask_user", "question": "1번 사용자 역할은 누구로 설정하시겠습니까?", "waiting_for_user_input": true, "suggestions": ["저(jhyg)로 설정", "기본값 유지"]}', 'id': 'lc_1'}] name='ask_user' tool_call_id='call_1'`;
    const fb = askUserFeedbackOf(parseMcpToolOutput(raw));
    assert.equal(fb.feedback_type, 'suggestions');
    assert.equal(fb.question, '1번 사용자 역할은 누구로 설정하시겠습니까?');
    assert.deepEqual(fb.suggestions, ['저(jhyg)로 설정', '기본값 유지']);
    assert.equal(fb.allow_other, true);
});

test('제안이 없어도 질문이면 직접 입력 패널이 된다', () => {
    const fb = askUserFeedbackOf({ user_request_type: 'ask_user', question: '담당자 이름을 알려 주세요.' });
    assert.equal(fb.feedback_type, 'suggestions');
    assert.deepEqual(fb.suggestions, []);
});

test('화면 모양이 정해진 질문은 그대로 둔다', () => {
    const given = { user_request_type: 'ask_user', feedback_type: 'select_items', items: [{ id: 'a', label: 'A' }] };
    assert.equal(askUserFeedbackOf(given), given);
});

test('질문이 아닌 결과는 패널이 아니다', () => {
    assert.equal(askUserFeedbackOf({ process_instance_id: 'a.1' }), null);
    assert.equal(askUserFeedbackOf({ user_request_type: 'ask_user', question: '  ' }), null);
    assert.equal(askUserFeedbackOf(null), null);
});
