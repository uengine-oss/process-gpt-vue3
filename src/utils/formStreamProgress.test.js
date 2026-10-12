import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser as LinkedomParser } from 'linkedom';

import { describeFormStream, formatFormProgress, summarizeFormChange, formatFormChange } from './formStreamProgress.js';

class DOMParser {
    parseFromString(html, type) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type);
    }
}
const P = { DOMParser };

test('토큰이 오기 전에는 생각 중이다', () => {
    assert.equal(describeFormStream('').phase, 'thinking');
    assert.match(formatFormProgress(describeFormStream(''), 12), /12초/);
});

test('받은 데까지의 htmlOutput에서 다 온 필드만 센다(JSON 안의 이스케이프된 따옴표 포함)', () => {
    const partial =
        '```json\n{\n  "htmlOutput": "<section><row-layout name=\\"info\\" alias=\\"기본 정보\\"><div class=\'row\'><div class=\'col-sm-6\'>' +
        "<text-field name='client_name' alias='고객사명' type='text'></text-field>" +
        '<text-field name=\\"title\\" alias=\\"제안 제목\\"></text-field><textarea-field name=\'det';
    const p = describeFormStream(partial);
    assert.equal(p.phase, 'writing');
    assert.deepEqual(p.fields, ['고객사명', '제안 제목']); // 마지막 태그는 아직 이름이 안 왔다
    assert.equal(p.rows, 1);
    assert.match(formatFormProgress(p, 30), /필드 2개[\s\S]*`고객사명` `제안 제목`/);
});

test('이름만 오고 제목(alias)이 아직 안 온 태그는 이름을 보여주지 않는다', () => {
    // 실제로 `discount_rate` 가 잠깐 보였다가 `할인율` 로 바뀌었다
    const partial = '{"modifications":[{"action":"addAfter","tagValue":"<text-field name=\'discount_rate\' ';
    assert.deepEqual(describeFormStream(partial).fields, []);
});

test('modifications 응답은 수정 건수를 센다', () => {
    const partial =
        '{"modifications":[{"action":"addAfter","targetCSSSelector":"#a","tagValue":"<text-field name=\'phone\' alias=\'연락처\'></text-field>"},{"action":"del';
    const p = describeFormStream(partial);
    assert.equal(p.edits, 2);
    assert.deepEqual(p.fields, ['연락처']);
});

test('무엇이 바뀌었는지 fields_json 기준으로 요약한다', () => {
    const before =
        '<section><row-layout name="a" alias="" is_multidata_mode="false" v-model="formValues" v-slot="slotProps"><div class="row"><div class="col-sm-12">' +
        '<text-field name="client" alias="고객명"></text-field><text-field name="memo" alias="메모"></text-field></div></div></row-layout></section>';
    const after = before
        .replace('alias="고객명"', 'alias="고객사명"')
        .replace('<text-field name="memo" alias="메모"></text-field>', '<text-field name="phone" alias="연락처"></text-field>');
    const change = summarizeFormChange(before, after, P);
    assert.deepEqual(change.added, ['연락처']);
    assert.deepEqual(change.removed, ['메모']);
    assert.deepEqual(change.renamed, [['고객명', '고객사명']]);
    assert.match(formatFormChange(change, 41), /추가: `연락처`[\s\S]*삭제: `메모`[\s\S]*`고객명` → `고객사명`/);
});

test('배치만 바뀌면 배치를 바꿨다고, 아무것도 안 바뀌면 그렇다고 알린다', () => {
    const html =
        '<section><row-layout name="a" alias="" is_multidata_mode="false" v-model="formValues" v-slot="slotProps"><div class="row"><div class="col-sm-12">' +
        '<text-field name="client" alias="고객명"></text-field></div></div></row-layout></section>';
    const moved = html.replace('col-sm-12', 'col-sm-6');
    assert.match(formatFormChange(summarizeFormChange(html, moved, P), 4), /배치·속성을 바꿨습니다/);
    assert.match(formatFormChange(summarizeFormChange(html, html, P), 4), /바뀐 것이 없습니다/);
});
