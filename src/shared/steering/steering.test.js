/**
 * 작업 중에 보낸 메시지를 수정 지시로 볼지 정하는 규칙 검증.
 *
 * 여기서 지키려는 것은 둘이다.
 *   1. 작업 중에 고쳐 말한 사람이 지금까지의 작업을 잃지 않는 것.
 *   2. 사람 확인(HITL) 답변이 수정 지시로 가로채이지 않는 것 — 가로채이면 멈춘 실행을
 *      재개할 수 없어 대화가 그대로 멎는다.
 *
 * 실행: node --test src/shared/steering/
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STEER_ACCEPTED_EVENT, STEER_APPLIED_EVENT, STEER_ACTION, shouldSteerInsteadOfNewTurn } from './index.js';

describe('수정 지시로 볼 것인가', () => {
    it('작업이 돌고 있는 중의 메시지는 수정 지시다', () => {
        assert.equal(shouldSteerInsteadOfNewTurn({ hasActiveTurn: true, text: '표 대신 글로 써 줘' }), true);
    });

    it('돌고 있는 작업이 없으면 평범한 새 메시지다', () => {
        assert.equal(shouldSteerInsteadOfNewTurn({ hasActiveTurn: false, text: '안녕' }), false);
    });

    it('빈 본문은 보낼 지시가 없다', () => {
        assert.equal(shouldSteerInsteadOfNewTurn({ hasActiveTurn: true, text: '   ' }), false);
    });

    it('사람 확인 답변은 가로채지 않는다', () => {
        // 가로채면 멈춘 실행을 재개할 수 없어 대화가 멎는다.
        const payload = { metadata: { run_state: { tool_name: 'request_human_input' }, human_response_answer: '승인' } };
        assert.equal(shouldSteerInsteadOfNewTurn({ hasActiveTurn: true, text: '승인', payload }), false);
    });

    it('첨부가 있으면 새 턴으로 보낸다', () => {
        // 수정 지시는 본문만 나른다 — 첨부를 조용히 버리지 않는다.
        assert.equal(
            shouldSteerInsteadOfNewTurn({ hasActiveTurn: true, text: '이 파일로', payload: { files: [{ name: 'a.pdf' }] } }),
            false
        );
        assert.equal(shouldSteerInsteadOfNewTurn({ hasActiveTurn: true, text: '이 그림처럼', payload: { images: ['data:...'] } }), false);
        assert.equal(shouldSteerInsteadOfNewTurn({ hasActiveTurn: true, text: '이거', payload: { file: { name: 'a.pdf' } } }), false);
    });

    it('인자가 없어도 던지지 않는다', () => {
        assert.equal(shouldSteerInsteadOfNewTurn(), false);
        assert.equal(shouldSteerInsteadOfNewTurn({}), false);
    });
});

describe('접수·반영 표시', () => {
    it('접수와 반영은 서로 다른 이벤트다', () => {
        // 한 이벤트로 합치면 접수만으로 반영된 것처럼 보인다.
        assert.notEqual(STEER_ACCEPTED_EVENT, STEER_APPLIED_EVENT);
    });

    it('동작 유형 이름은 서버 계약과 같다', () => {
        assert.equal(STEER_ACTION, 'steer');
        assert.equal(STEER_ACCEPTED_EVENT, 'steer_accepted');
        assert.equal(STEER_APPLIED_EVENT, 'steer_applied');
    });
});
