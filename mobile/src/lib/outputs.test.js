import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    displayValue,
    fieldLabel,
    flattenOutput,
    formIdOf,
    labelsFromFields,
    previousOutputs
} from './outputs.js';

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

describe('폼에 적힌 이름을 쓴다', () => {
    // 없으면 end_date 가 "end date" 로 보인다. 값은 맞지만 무엇을 뜻하는지
    // 알 수 없어, 승인 판단의 근거로 쓰는 화면에서는 곤란하다.
    const FIELDS = [
        { key: 'end_date', text: '출장 종료일', type: 'text' },
        { key: 'employee_name', text: '출장자 성명', type: 'text' },
        {
            key: 'items',
            text: '품목',
            type: 'repeating',
            fields: [{ key: 'unit_price', text: '단가', type: 'number' }]
        }
    ];

    it('필드 키와 이름의 표를 만든다 — 되풀이 묶음 안쪽까지', () => {
        assert.deepEqual(labelsFromFields(FIELDS), {
            end_date: '출장 종료일',
            employee_name: '출장자 성명',
            items: '품목',
            unit_price: '단가'
        });
    });

    it('이름이 없는 필드는 표에 넣지 않는다', () => {
        assert.deepEqual(labelsFromFields([{ key: 'a' }, { text: '이름만' }, null, 'x']), {});
    });

    it('폼 정의가 없어도 깨지지 않는다', () => {
        assert.deepEqual(labelsFromFields(null), {});
    });

    it('이름이 있으면 그것을 쓴다', () => {
        assert.equal(fieldLabel('end_date', { end_date: '출장 종료일' }), '출장 종료일');
    });

    it('이름이 없으면 기계 이름의 밑줄을 푼다 — 차선책이다', () => {
        assert.equal(fieldLabel('end_date', {}), 'end date');
        assert.equal(fieldLabel('end_date'), 'end date');
    });

    it('빈 이름은 없는 것으로 본다', () => {
        assert.equal(fieldLabel('end_date', { end_date: '   ' }), 'end date');
    });

    it('산출물의 항목 이름을 폼 이름으로 바꾼다', () => {
        const rows = flattenOutput({ f1: { end_date: '2026-09-22' } }, { end_date: '출장 종료일' });
        assert.deepEqual(rows, [{ key: 'end_date', label: '출장 종료일', value: '2026-09-22' }]);
    });
});

describe('formIdOf', () => {
    it('formHandler 접두어를 벗긴다', () => {
        assert.equal(formIdOf({ tool: 'formHandler:worktrip_form' }), 'worktrip_form');
    });

    it('원본 행이 task 안에 들어 있어도 찾는다', () => {
        assert.equal(formIdOf({ task: { tool: 'formHandler:a_form' } }), 'a_form');
    });

    it('폼이 아닌 도구는 폼 아이디가 아니다', () => {
        assert.equal(formIdOf({ tool: 'mcp:search' }), '');
        assert.equal(formIdOf({}), '');
        assert.equal(formIdOf(null), '');
    });
});

describe('previousOutputs 에 폼 이름을 넘긴다', () => {
    const items = [
        {
            id: 't1',
            name: '출장 계획 등록',
            username: '홍길동',
            tool: 'formHandler:trip_form',
            output: { trip_form: { end_date: '2026-09-22' } }
        },
        { id: 't2', name: '숙소 검색', output: {} }
    ];

    it('그 단계가 쓰는 폼의 이름으로 항목을 표시한다', () => {
        const out = previousOutputs(items, 't2', { trip_form: { end_date: '출장 종료일' } });
        assert.equal(out[0].fields[0].label, '출장 종료일');
    });

    it('이름표가 없으면 예전처럼 기계 이름으로 보인다 — 값은 그대로다', () => {
        const out = previousOutputs(items, 't2');
        assert.equal(out[0].fields[0].label, 'end date');
        assert.equal(out[0].fields[0].value, '2026-09-22');
    });
});
