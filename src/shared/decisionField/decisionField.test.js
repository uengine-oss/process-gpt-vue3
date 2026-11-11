/**
 * 결정 칸(승인 · 반려).
 *
 * 지키려는 것: 승인 · 반려를 고르는 칸은 미리 골라 두지 않고, 고르지 않으면 제출을 막는 것.
 * 다른 고르는 칸(부서 · 품목 등)은 지금처럼 둔다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { isDecisionItems, decisionFields, missingDecisions } from './index.js';

const reviewHtml = `<section><row-layout name='l'><div class='row'>
<select-field name='review_result' alias='검토 결과' is_dynamic_load='fixed' items='[{"approve": "승인"}, {"reject": "반려"}]' v-model="x"></select-field>
<select-field name='dept' alias='부서' items='[{"sales": "영업팀"}, {"dev": "개발팀"}]'></select-field>
<textarea-field name='review_comment' alias='검토 의견'></textarea-field>
</div></row-layout></section>`;

test('승인 · 반려가 함께 있으면 결정 칸', () => {
    assert.equal(isDecisionItems('[{"approve": "승인"}, {"reject": "반려"}]'), true);
    assert.equal(isDecisionItems([{ yes: '예' }, { no: '아니오' }]), true);
    assert.equal(isDecisionItems([{ a1: '승인' }, { a2: '반려' }, { a3: '보류' }]), true);
    assert.equal(isDecisionItems([{ sales: '영업팀' }, { dev: '개발팀' }]), false);
    assert.equal(isDecisionItems([{ approve: '승인' }]), false, '긍정만 있으면 결정이 아니다');
    assert.equal(isDecisionItems('not json'), false);
});

test('폼 HTML 에서 결정 칸만 찾는다', () => {
    assert.deepEqual(decisionFields(reviewHtml), [{ name: 'review_result', alias: '검토 결과' }]);
    assert.deepEqual(decisionFields(''), []);
});

test('결정 칸을 고르지 않았으면 제출을 막는다', () => {
    assert.deepEqual(missingDecisions(reviewHtml, { review_comment: '좋습니다' }), [{ name: 'review_result', alias: '검토 결과' }]);
    assert.deepEqual(missingDecisions(reviewHtml, { review_result: '' }), [{ name: 'review_result', alias: '검토 결과' }]);
    assert.deepEqual(missingDecisions(reviewHtml, { review_result: 'reject' }), []);
});
