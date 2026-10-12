import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser as LinkedomParser } from 'linkedom';

import { buildStreamingFormHtml } from './formStreamPreview.js';

class DOMParser {
    parseFromString(html, type) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type);
    }
}
const P = { DOMParser };
const PREV =
    '<section id="info"><row-layout name="info"><div class="row"><div class="col-sm-12"><text-field name="a" alias="A"></text-field></div></div></row-layout></section>';

test('아직 폼 내용이 오지 않았으면 그릴 것이 없다', () => {
    assert.equal(buildStreamingFormHtml('', PREV, P), null);
    assert.equal(buildStreamingFormHtml('```json\n{\n  "modifications": [\n    {\n      "action": "addAf', PREV, P), null);
});

test('htmlOutput은 받은 데까지 쓰고, 끝에 잘린 태그는 뗀다', () => {
    const partial =
        "```json\n{\"htmlOutput\": \"<section><row-layout name=\\\"x\\\"><div class='row'><div class='col-sm-6'><text-field name='a' alias='회사명'></text-field><text-field name='b";
    const html = buildStreamingFormHtml(partial, PREV, P);
    assert.match(html, /alias='회사명'><\/text-field>$/);
    assert.match(html, /name="x"/); // \" 이스케이프를 풀었다
});

test('수정 명령은 다 온 것까지 적용하고, 작성 중인 명령의 tagValue도 받은 데까지 넣는다', () => {
    const partial =
        '{"modifications": [' +
        '{"action": "addAfter", "targetCSSSelector": "section#info", "tagValue": "<section><row-layout name=\'quote\' alias=\'견적\'><div class=\'row\'><div class=\'col-sm-6\'><text-field name=\'q1\' alias=\'견적 번호\'></text-field></div></div></row-layout></section>"},' +
        '{"targetCSSSelector": "section#info", "action": "addAfter", "tagValue": "<section><row-layout name=\'memo\'><div class=\'row\'><div class=\'col-sm-12\'><textarea-field name=\'m\' alias=\'메모\'></textarea-fi';
    const html = buildStreamingFormHtml(partial, PREV, P);
    assert.match(html, /name="a"/); // 기존 폼 위에
    assert.match(html, /견적 번호/); // 다 온 명령
    assert.match(html, /name="memo"/); // 작성 중인 명령(키 순서가 달라도)
    assert.doesNotMatch(html, /textarea-fi[^e]/);
});

test('대상이 아직 다 오지 않은 명령은 적용하지 않는다', () => {
    const partial = '{"modifications": [{"action": "replace", "targetCSSSelector": "section#in';
    assert.equal(buildStreamingFormHtml(partial, PREV, P), null);
});
