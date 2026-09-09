/**
 * 폼 정의를 휴대폰용으로 바꾸는 규칙.
 *
 * 여기서 지키려는 것: **못 그리는 항목을 조용히 빼지 않는 것.**
 * 빼면 사용자는 다 채웠다고 믿고 제출하는데, 빈 값이 넘어가 프로세스가 다음
 * 단계에서 멈춘다. 멈춘 이유는 어디에도 남지 않는다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    blockingFields,
    canSubmitOnMobile,
    flattenFields,
    initialValues,
    isReadOnly,
    normalizeItems,
    toMobileFields
} from './formSchema.js';

const textField = { key: 'reason', text: '사유', type: 'text' };
const reportField = { key: 'report', text: '보고서', type: 'report' };

// ---------------------------------------------------------------------------
// 못 그리는 항목
// ---------------------------------------------------------------------------

test('그릴 수 없는 항목도 목록에 남긴다', () => {
    const fields = toMobileFields([textField, reportField]);

    assert.equal(fields.length, 2);
    assert.equal(fields[1].supported, false);
});

test('입력이 필요한데 못 그리면 제출을 막는다', () => {
    const fields = toMobileFields([textField, reportField]);

    assert.equal(canSubmitOnMobile(fields), false);
    assert.deepEqual(blockingFields(fields).map((f) => f.key), ['report']);
});

test('보여주기만 하는 항목은 못 그려도 막지 않는다', () => {
    // 읽기 전용이면 사용자가 채울 것이 없다. 막으면 아무 이유 없이 갇힌다.
    const fields = toMobileFields([textField, { ...reportField, readonly: 'true' }]);

    assert.equal(canSubmitOnMobile(fields), true);
});

test('값을 적는 칸은 모두 휴대폰에서 받는다. 산출물 보기 항목만 웹으로 미룬다', () => {
    const fields = toMobileFields([
        { key: 'a', type: 'file' },
        { key: 'b', type: 'user-select' },
        { key: 'c', type: 'slide' },
        { key: 'd', type: 'bpmn-uengine' }
    ]);

    // 파일·담당자는 입력 칸이므로 앱에서 받는다.
    // 슬라이드·도면은 넓은 화면에서 보고 편집하는 산출물이다.
    assert.deepEqual(fields.map((f) => f.supported), [true, true, false, false]);
});

test('평범한 입력 항목은 전부 그릴 수 있다', () => {
    const types = ['text', 'textarea', 'boolean', 'select', 'radio', 'checkbox', 'label'];
    const fields = toMobileFields(types.map((t, i) => ({ key: `k${i}`, type: t })));

    assert.ok(fields.every((f) => f.supported), fields.filter((f) => !f.supported).map((f) => f.type).join());
});

// ---------------------------------------------------------------------------
// 중첩 펴기
// ---------------------------------------------------------------------------

test('칸 나누기는 휴대폰에서 의미가 없으므로 편다', () => {
    const fields = toMobileFields([
        {
            key: 'row1',
            type: 'row-layout',
            fields: [textField, { key: 'amount', type: 'text' }]
        }
    ]);

    assert.deepEqual(fields.map((f) => f.key), ['reason', 'amount']);
});

test('반복 입력 묶음은 펴지 않는다. 안쪽 칸을 지닌 채 반복으로 남는다', () => {
    // 펴 버리면 "여러 번 반복" 이라는 뜻이 사라져 한 번만 입력하게 된다.
    const fields = toMobileFields([
        {
            key: 'items',
            text: '품목',
            type: 'row-layout',
            is_multidata_mode: 'true',
            fields: [{ key: 'name', type: 'text' }]
        }
    ]);

    assert.equal(fields.length, 1);
    assert.equal(fields[0].repeating, true);
    // 안쪽 칸이 그릴 수 있으면 앱에서도 여러 줄을 넣을 수 있다.
    assert.equal(fields[0].supported, true);
    assert.deepEqual(fields[0].fields.map((f) => f.key), ['name']);
});

test('중첩이 여러 겹이어도 편다', () => {
    const fields = flattenFields([
        { type: 'row-layout', fields: [{ type: 'row-layout', fields: [textField] }] }
    ]);

    assert.deepEqual(fields.map((f) => f.key), ['reason']);
});

test('키가 없는 항목은 버린다', () => {
    // 키가 없으면 어디에 담을지 알 수 없다. 그려 봐야 값이 사라진다.
    assert.equal(toMobileFields([{ text: '이름 없음', type: 'text' }]).length, 0);
});

test('정의가 비어 있어도 터지지 않는다', () => {
    assert.deepEqual(toMobileFields(null), []);
    assert.deepEqual(toMobileFields(undefined), []);
    assert.deepEqual(toMobileFields([null, 'x', 3]), []);
});

// ---------------------------------------------------------------------------
// 읽기 전용
// ---------------------------------------------------------------------------

test('readonly · disabled · label 은 읽기 전용이다', () => {
    assert.equal(isReadOnly({ readonly: 'true' }), true);
    assert.equal(isReadOnly({ disabled: true }), true);
    assert.equal(isReadOnly({ type: 'label' }), true);
    assert.equal(isReadOnly({ readonly: 'false', disabled: false, type: 'text' }), false);
});

// ---------------------------------------------------------------------------
// 선택지
// ---------------------------------------------------------------------------

test('정의에 담긴 선택지 형태를 통일한다', () => {
    const items = normalizeItems([{ y: '예' }, { n: '아니오' }]);

    assert.deepEqual(items, [
        { value: 'y', label: '예' },
        { value: 'n', label: '아니오' }
    ]);
});

test('문자열 목록도 받는다', () => {
    assert.deepEqual(normalizeItems(['하나', '둘']), [
        { value: '하나', label: '하나' },
        { value: '둘', label: '둘' }
    ]);
});

test('이미 통일된 형태는 그대로 둔다', () => {
    assert.deepEqual(normalizeItems([{ value: 'a', label: 'A' }]), [{ value: 'a', label: 'A' }]);
});

test('선택지가 없으면 빈 목록이다', () => {
    assert.deepEqual(normalizeItems(null), []);
    assert.deepEqual(normalizeItems('items'), []);
});

// ---------------------------------------------------------------------------
// 처음 값
// ---------------------------------------------------------------------------

test('종류에 맞는 빈 값으로 시작한다', () => {
    const fields = toMobileFields([
        { key: 'memo', type: 'text' },
        { key: 'agree', type: 'boolean' },
        { key: 'tags', type: 'checkbox' }
    ]);

    assert.deepEqual(initialValues(fields, null), { memo: '', agree: false, tags: [] });
});

test('저장해 둔 값이 있으면 그것으로 채운다', () => {
    // 임시 저장했다가 다시 열었을 때 처음부터 다시 쓰게 하면 안 된다.
    const fields = toMobileFields([{ key: 'memo', type: 'text' }]);

    assert.deepEqual(initialValues(fields, { memo: '쓰던 내용' }), { memo: '쓰던 내용' });
});

test('저장된 값에 없는 항목은 빈 값으로 둔다', () => {
    const fields = toMobileFields([
        { key: 'memo', type: 'text' },
        { key: 'extra', type: 'text' }
    ]);

    assert.deepEqual(initialValues(fields, { memo: 'x' }), { memo: 'x', extra: '' });
});

test('이메일·전화·시간 같은 칸도 휴대폰에서 받는다', () => {
    const out = toMobileFields([
        { key: 'a', type: 'email', text: '이메일' },
        { key: 'b', type: 'tel', text: '전화' },
        { key: 'c', type: 'datetime', text: '일시' }
    ]);
    assert.deepEqual(out.map((f) => f.supported), [true, true, true]);
});

test('파일 첨부와 담당자 선택도 휴대폰에서 받는다 — 웹으로 미루면 앱에서 업무를 끝낼 수 없다', () => {
    const out = toMobileFields([
        { key: 'f', type: 'file', text: '증빙' },
        { key: 'u', type: 'user-select', text: '담당자' }
    ]);
    assert.deepEqual(out.map((f) => f.supported), [true, true]);
});

test('반복 입력도 안쪽 칸이 모두 그릴 수 있으면 받는다', () => {
    const [row] = toMobileFields([
        {
            key: 'items',
            type: 'row-layout',
            text: '항목',
            is_multidata_mode: true,
            fields: [{ key: 'n', type: 'text', text: '이름' }, { key: 'q', type: 'number', text: '수량' }]
        }
    ]);
    assert.equal(row.repeating, true);
    assert.equal(row.supported, true);
    assert.deepEqual(row.fields.map((f) => f.key), ['n', 'q']);
});

test('반복 입력 안에 그릴 수 없는 칸이 섞이면 받지 않는다 — 빈 채로 제출되면 뒤에서 멈춘다', () => {
    const [row] = toMobileFields([
        {
            key: 'items',
            type: 'row-layout',
            is_multidata_mode: true,
            fields: [{ key: 'n', type: 'text' }, { key: 'r', type: 'report' }]
        }
    ]);
    assert.equal(row.supported, false);
});

test('보고서·슬라이드·도면은 여전히 웹에서 — 값을 적는 칸이 아니다', () => {
    const out = toMobileFields([{ key: 'r', type: 'report' }, { key: 's', type: 'slide' }]);
    assert.deepEqual(out.map((f) => f.supported), [false, false]);
});
