import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { displayValue, fieldLabel, flattenOutput, previousOutputs } from './outputs.js';

describe('flattenOutput', () => {
    it('폼 아이디 한 겹을 벗기고 필드만 보여 준다 — 폼 아이디는 사용자에게 뜻이 없다', () => {
        const rows = flattenOutput({
            leave_request_process_apply_leave_form: {
                customer_email: 'a@b.com',
                leave_application: '연차 3일'
            }
        });
        assert.deepEqual(rows.map((r) => r.key), ['customer_email', 'leave_application']);
        assert.equal(rows[0].value, 'a@b.com');
    });

    it('빈 값은 보여 주지 않는다. 빈 줄만 늘어놓으면 오히려 읽기 어렵다', () => {
        const rows = flattenOutput({ f: { a: '', b: '   ', c: null, d: [], e: '값' } });
        assert.deepEqual(rows.map((r) => r.key), ['e']);
    });

    it('목록은 쉼표로 잇는다', () => {
        const rows = flattenOutput({ f: { checkpoints: ['제출', '검토'] } });
        assert.equal(rows[0].value, '제출, 검토');
    });

    it('산출물이 없으면 빈 목록', () => {
        assert.deepEqual(flattenOutput(null), []);
        assert.deepEqual(flattenOutput({}), []);
        assert.deepEqual(flattenOutput({ f: {} }), []);
    });
});

describe('fieldLabel', () => {
    it('기계 이름을 읽을 만하게 푼다', () => {
        assert.equal(fieldLabel('customer_email'), 'customer email');
        assert.equal(fieldLabel(''), '항목');
    });
});

describe('displayValue', () => {
    it('참/거짓을 말로 바꾼다', () => {
        assert.equal(displayValue(true), '예');
        assert.equal(displayValue(false), '아니오');
    });
});

describe('previousOutputs', () => {
    const items = [
        { taskId: 't1', name: '신청', username: '홍길동', endDate: '2026-01-01', output: { f: { 사유: '개인' } } },
        { taskId: 't2', name: '중간', output: { f: {} } },
        { taskId: 't3', name: '승인' }
    ];

    it('내 단계 앞의 산출물만 순서대로 보여 준다', () => {
        const out = previousOutputs(items, 't3');
        assert.deepEqual(out.map((s) => s.name), ['신청']);
        assert.equal(out[0].who, '홍길동');
        assert.equal(out[0].fields[0].value, '개인');
    });

    it('산출물이 없는 단계는 넣지 않는다', () => {
        assert.equal(previousOutputs(items, 't3').length, 1);
    });

    it('내 단계를 못 찾으면 전체에서 산출물이 있는 것만 보여 준다', () => {
        assert.equal(previousOutputs(items, '없는id').length, 1);
    });

    it('앞 단계가 없으면 빈 목록', () => {
        assert.deepEqual(previousOutputs(items, 't1'), []);
    });
});
