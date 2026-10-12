// 저장 직전 정규화(normalizeFormRowLayout) — 같은 폼을 다시 저장해도 HTML이 바뀌지 않아야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';

import { normalizeFormRowLayout, extractFields } from './formHtml.js';

class DOMParser {
    parseFromString(html, type) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type);
    }
}
const P = { DOMParser };
const reserialize = (html) => new DOMParser().parseFromString(html, 'text/html').body.innerHTML;

const corpus = JSON.parse(fs.readFileSync(new URL('./__fixtures__/form-corpus.json', import.meta.url), 'utf8'));

test('다중 데이터 행(v-for)은 저장 정규화에서 구조가 바뀌지 않는다', () => {
    const multi = corpus.filter((f) => f.html.includes('is_multidata_mode="true"'));
    assert.ok(multi.length >= 2);
    for (const form of multi) {
        // 예전에는 반복 항목 안의 div.row를 빈 row-layout으로 한 번 더 감쌌다(저장할 때마다 카드가 겹침)
        assert.equal(normalizeFormRowLayout(form.html, P), reserialize(form.html), form.id);
    }
});

test('다중 데이터 행의 fields_json은 하위 필드를 그룹으로 담는다', () => {
    const form = corpus.find((f) => f.id === 'order_processing_process_activity_1ojhtfh_form');
    const [group] = extractFields(normalizeFormRowLayout(form.html, P), P);
    assert.equal(group.type, 'row-layout');
    assert.deepEqual(
        group.fields.map((f) => f.key),
        ['product_name', 'input_quantity', 'stock_quantity']
    );
});

test('정규화는 두 번 해도 한 번 한 것과 같다(두 번째 저장부터 바뀌지 않는다)', () => {
    for (const form of corpus) {
        const once = normalizeFormRowLayout(form.html, P);
        assert.equal(normalizeFormRowLayout(once, P), once, form.id);
    }
});

test('바인딩 없이 생성된 폼은 첫 저장 때 row-layout과 바인딩이 붙는다(의도된 정규화)', () => {
    const form = corpus.find((f) => f.shape?.startsWith('skill-generated'));
    const doc = new DOMParser().parseFromString(normalizeFormRowLayout(form.html, P), 'text/html');
    // 속성 순서는 파서마다 다르므로 값으로 본다
    const layout = doc.querySelector('row-layout');
    assert.deepEqual(
        ['name', 'alias', 'is_multidata_mode', 'v-model', 'v-slot'].map((a) => layout.getAttribute(a)),
        ['sp_answer_layout', '답변 작성', 'false', 'formValues', 'slotProps']
    );
    assert.equal(doc.querySelector('[name="draft_answer"]').getAttribute('v-model'), "slotProps.modelValue['draft_answer']");
});
