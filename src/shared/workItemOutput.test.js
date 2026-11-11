import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFormDefs, fieldLabelsOf, formIdOf, hasValue, outputPreview, stripScopeSuffix } from './workItemOutput.js';

test('서브 프로세스 단계 이름의 실행 범위 표시를 뗀다', () => {
    assert.equal(stripScopeSuffix('현장조사: (:0)'), '현장조사');
    assert.equal(stripScopeSuffix('답변 검토: (민원 A:1)'), '답변 검토');
    assert.equal(stripScopeSuffix('담당 부서 배정'), '담당 부서 배정');
    assert.equal(stripScopeSuffix('예산 검토 (1차)'), '예산 검토 (1차)');
});

test('값이 모두 비어 있으면 보일 것이 없다', () => {
    assert.equal(hasValue({}), false);
    assert.equal(hasValue({ form: {} }), false);
    assert.equal(hasValue({ hwpx_file: { hwpx_file: null } }), false);
    assert.equal(hasValue({ a: '', b: [] }), false);
    assert.equal(hasValue({ investigation_required: false }), true);
    assert.equal(hasValue({ form: { action_result: '굿' } }), true);
});

test('formHandler 가 아닌 tool 은 폼이 없다', () => {
    assert.equal(formIdOf({ tool: 'formHandler:abc_form' }), 'abc_form');
    assert.equal(formIdOf({ tool: 'mcp:x' }), '');
    assert.equal(formIdOf({}), '');
});

test('정의마다 폼을 받고, 정의로 못 찾은 폼(자유 입력)은 id 로 받는다', async () => {
    const calls = [];
    const db = [
        { id: 'parent_form', proc_def_id: 'parent' },
        { id: 'child_form', proc_def_id: 'child' },
        { id: 'defaultform', proc_def_id: 'proc_defaultform' }
    ];
    const backend = {
        listDefinition: async (_path, { match }) => {
            calls.push(match);
            return db.filter((f) => Object.entries(match).every(([k, v]) => f[k] === v));
        }
    };
    const tried = new Set();
    const got = await fetchFormDefs(backend, {
        defIds: ['parent', 'child', 'child'],
        formIds: ['parent_form', 'child_form', 'defaultform'],
        tried
    });
    assert.deepEqual(got.map((f) => f.id).sort(), ['child_form', 'defaultform', 'parent_form']);
    assert.equal(calls.length, 3);

    // 이미 받아 본 것은 다시 받지 않는다.
    const again = await fetchFormDefs(backend, { defIds: ['parent', 'child'], formIds: ['defaultform'], have: got, tried });
    assert.equal(again.length, 0);
    assert.equal(calls.length, 3);
});

test('전달받은 산출물 미리보기: 폼 순서의 첫 글을 한 줄로, 값이 든 항목 수와 함께', () => {
    const values = {
        free_input: '검토 결과: 조건부 적합입니다.\n적합한 점:\n- **핵심** 요구사항을 반영했습니다.\n1. 둘째',
        'text-field-2': 'MES 시범 도입 제안 v0.1',
        'boolean-field-3': 'false',
        empty: ''
    };
    const p = outputPreview(values, { order: ['free_input', 'text-field-2', 'boolean-field-3'] });
    assert.equal(p.text, '검토 결과: 조건부 적합입니다. 적합한 점: 핵심 요구사항을 반영했습니다. 둘째');
    assert.equal(p.count, 3);

    // 순서를 주면 그 순서대로
    assert.equal(outputPreview(values, { order: ['text-field-2'] }).text, 'MES 시범 도입 제안 v0.1');
    // 길면 줄인다
    assert.equal(outputPreview({ a: '가'.repeat(10) }, { maxLength: 4 }).text, '가가가가…');
    // 글이 없으면 첫 값
    assert.deepEqual(outputPreview({ ok: true, list: ['a', 'b'] }), { text: 'true', count: 2 });
    assert.deepEqual(outputPreview({}), { text: '', count: 0 });
    assert.deepEqual(outputPreview(null), { text: '', count: 0 });
    // 태그는 글로 보이지 않게
    assert.equal(outputPreview({ a: '<img src=x onerror=alert(1)>본문' }).text, '본문');
});

test('폼 항목 키를 폼에 적힌 이름으로 읽는다', () => {
    const task = {
        id: 'task1_form',
        fields_json: [
            { key: 'request_detail', text: '요청사항' },
            { key: 'memo', text: '' }
        ]
    };
    const other = { id: 'task2_form', fields_json: '[{"key":"request_detail","text":"다른 이름"},{"key":"proposal","text":"제안서"}]' };
    assert.deepEqual(fieldLabelsOf([task, other]), { request_detail: '요청사항', proposal: '제안서' });
    assert.deepEqual(fieldLabelsOf(task), { request_detail: '요청사항' });
    assert.deepEqual(fieldLabelsOf([{ fields_json: 'not json' }, null]), {});
    // 키를 그대로 베낀 이름은 이름으로 치지 않는다
    assert.deepEqual(fieldLabelsOf({ fields_json: [{ key: 'text-field-2', text: 'text-field-2' }] }), {});
});

test('정의 전체의 이름 위에 업무의 폼 이름만 얹어도 업무 폼을 앞에 두고 다시 훑은 것과 같다(InstanceOutput)', () => {
    const task = { id: 't', fields_json: [{ key: 'request_detail', text: '요청사항' }, { key: 'memo', text: 'memo' }] };
    const other = { id: 'o', fields_json: [{ key: 'request_detail', text: '다른 이름' }, { key: 'memo', text: '메모' }, { key: 'proposal', text: '제안서' }] };
    const formList = [other, task];
    const base = fieldLabelsOf(formList);
    assert.deepEqual({ ...base, ...fieldLabelsOf(task) }, fieldLabelsOf([task, ...formList]));
    assert.deepEqual({ ...base, ...fieldLabelsOf(task) }, { request_detail: '요청사항', memo: '메모', proposal: '제안서' });
});
