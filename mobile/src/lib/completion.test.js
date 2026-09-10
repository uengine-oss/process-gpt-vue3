import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { completionFailed, failureText } from './completion.js';

describe('completionFailed', () => {
    it('Error 는 실패다', () => {
        assert.equal(completionFailed(new Error('boom')), true);
    });

    it('FastAPI 의 404 본문을 실패로 본다 — 이것을 놓쳐 완료된 것처럼 보였다', () => {
        assert.equal(completionFailed({ detail: 'Not Found' }), true);
    });

    it('빈 응답도 실패다. 됐는지 모르면 됐다고 하지 않는다', () => {
        assert.equal(completionFailed(null), true);
        assert.equal(completionFailed(undefined), true);
    });

    it('진행 불가 사유가 담겨 오면 실패다', () => {
        assert.equal(completionFailed({ cannotProceedErrors: [{ type: 'DATA_FIELD_NOT_EXIST' }] }), true);
    });

    it('정상 응답은 성공이다', () => {
        assert.equal(completionFailed({ status: 'ok', proc_inst_id: 'x' }), false);
        assert.equal(completionFailed('ok'), false);
        assert.equal(completionFailed({ cannotProceedErrors: [] }), false);
    });
});

describe('failureText', () => {
    it('서버가 말한 이유를 그대로 전한다', () => {
        assert.match(failureText({ detail: '활동을 찾을 수 없습니다' }), /활동을 찾을 수 없습니다/);
    });

    it('목록으로 온 사유도 첫 줄을 보여 준다', () => {
        assert.match(failureText({ cannotProceedErrors: [{ type: 'DATA_FIELD_NOT_EXIST' }] }), /DATA_FIELD_NOT_EXIST/);
    });

    it('이유를 모르면 일반 안내로 돌아간다', () => {
        assert.match(failureText({}), /다시 시도해 주세요/);
        assert.match(failureText(new Error('')), /다시 시도해 주세요/);
    });
});
