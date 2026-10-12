import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser as LinkedomParser } from 'linkedom';

import { applyFormModifications } from './formModifications.js';

class DOMParser {
    parseFromString(html, type) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type);
    }
}
const P = { DOMParser };
const FORM =
    '<section id="s1"><row-layout name="a"><div class="row"><div class="col-sm-12"><text-field name="x" alias="X"></text-field></div></div></row-layout></section>';

test('명령 하나에 섹션이 둘이면 둘 다 들어간다', () => {
    // 실제로: 기존 섹션을 "고객 발굴 폼" + "발굴 메모" 두 섹션으로 교체했는데 메모가 사라졌다
    const { html, skipped } = applyFormModifications(
        FORM,
        [
            {
                action: 'replace',
                targetCSSSelector: 'section',
                tagValue:
                    '<section><row-layout name="main"></row-layout></section>\n<section><row-layout name="memo"></row-layout></section>'
            }
        ],
        P
    );
    assert.deepEqual(skipped, []);
    assert.match(html, /name="main"[\s\S]*name="memo"/);
    assert.doesNotMatch(html, /name="a"/);
});

test('addAfter는 여러 요소를 순서대로 대상 뒤에 넣는다', () => {
    const { html } = applyFormModifications(
        FORM,
        [
            {
                action: 'addAfter',
                targetCSSSelector: 'text-field[name="x"]',
                tagValue: '<text-field name="y"></text-field><text-field name="z"></text-field>'
            }
        ],
        P
    );
    assert.match(html, /name="x"[\s\S]*name="y"[\s\S]*name="z"/);
});

test('대상을 찾지 못한 명령은 건너뛰고 알려준다(다른 명령은 적용)', () => {
    const { html, skipped } = applyFormModifications(
        FORM,
        [
            { action: 'delete', targetCSSSelector: '#없는-대상' },
            { action: 'addAsChild', targetCSSSelector: '.col-sm-12', tagValue: '<textarea-field name="memo"></textarea-field>' }
        ],
        P
    );
    assert.equal(skipped.length, 1);
    assert.match(html, /name="memo"/);
});

test("빈 폼에 넣을 때 AI가 주는 'body' 대상도 찾는다", () => {
    // 실제로: 기존 섹션을 지운 뒤 body에 섹션 3개를 넣으라는 명령이 모두 건너뛰어져 폼이 비었다
    const { html, skipped } = applyFormModifications(
        FORM,
        [
            { action: 'delete', targetCSSSelector: 'section' },
            { action: 'addAsChild', targetCSSSelector: 'body', tagValue: '<section><row-layout name="info"></row-layout></section>' },
            { action: 'addAsChild', targetCSSSelector: 'body', tagValue: '<section><row-layout name="memo"></row-layout></section>' }
        ],
        P
    );
    assert.deepEqual(skipped, []);
    assert.match(html, /^<section><row-layout name="info"><\/row-layout><\/section><section><row-layout name="memo">/);
});

test('선택자가 중첩 섹션에도 걸리면 최상위 섹션을 대상으로 한다', () => {
    const nested =
        '<section><row-layout name="top"><div class="row"><div class="col-sm-12"><section><row-layout name="inner"></row-layout></section></div></div></row-layout></section>' +
        '<section><row-layout name="last"></row-layout></section>';
    const { html } = applyFormModifications(
        nested,
        [
            {
                action: 'addAfter',
                targetCSSSelector: 'section:last-child',
                tagValue: '<section><row-layout name="added"></row-layout></section>'
            }
        ],
        P
    );
    assert.match(html, /name="last"><\/row-layout><\/section><section><row-layout name="added">/);
});
