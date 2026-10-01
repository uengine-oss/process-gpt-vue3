import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFormDefs, formIdOf, hasValue, stripScopeSuffix } from './workItemOutput.js';

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
