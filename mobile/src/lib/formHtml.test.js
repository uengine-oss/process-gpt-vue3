/**
 * 폼 HTML 에만 있는 항목을 휴대폰 폼 칸에 채운다 — 없으면 「검토 결과」를 고를 수 없다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { htmlFieldItems, withHtmlItems } from './formHtml.js';

const HTML = `<select-field name='review_result' alias='검토 결과' is_dynamic_load='fixed' items='[{"approve": "승인"}, {"reject": "반려"}]' disabled='false'></select-field>
<radio-field name="grade" items="[&quot;상&quot;,&quot;하&quot;]"></radio-field>
<textarea-field name='review_comment'></textarea-field>`;

describe('htmlFieldItems', () => {
    it('고르는 칸의 항목을 읽는다(작은따옴표 · 큰따옴표 · 엔티티)', () => {
        const items = htmlFieldItems(HTML);
        assert.deepEqual(items.review_result, [{ approve: '승인' }, { reject: '반려' }]);
        assert.deepEqual(items.grade, ['상', '하']);
        assert.equal(items.review_comment, undefined);
    });
});

describe('withHtmlItems', () => {
    it('항목이 빈 칸에만 채운다', () => {
        const fields = [
            { key: 'review_result', type: 'select', items: [] },
            { key: 'grade', type: 'radio', items: [{ value: 'x', label: 'X' }] }
        ];
        const out = withHtmlItems(fields, HTML);
        assert.deepEqual(out[0].items, [{ value: 'approve', label: '승인' }, { value: 'reject', label: '반려' }]);
        assert.deepEqual(out[1].items, [{ value: 'x', label: 'X' }]);
        assert.deepEqual(fields[0].items, [], '원본은 그대로');
    });
});
