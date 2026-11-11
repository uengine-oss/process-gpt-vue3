import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser as LinkedomParser } from 'linkedom';
import { autoNameNumber, fallbackFieldLabel, fieldLabelForKey, inferFieldTag, presentFormHtml, presentedFieldLabels } from './index.js';

class DOMParser {
    parseFromString(html, type) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type);
    }
}
const ko = {
    'formBuilder.type.text': '텍스트',
    'formBuilder.type.boolean': '예/아니오',
    'formBuilder.type.userSelect': '사용자 선택',
    'formBuilder.type.select': '선택'
};
const translate = (key) => ko[key] || null;
const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

// 운영 sales_activity_process_review_proposal_form 과 같은 모양 — 자유입력 행 + alias 없는 KEditor 필드
const REVIEW_FORM = `<section><row-layout name="free_input_section" alias="자유입력" is_multidata_mode="false" v-model="formValues" v-slot="slotProps"><div class="row"><div class="col-sm-12"><textarea-field name="free_input" alias="자유입력" rows="5" v-model="slotProps.modelValue['free_input']"></textarea-field></div></div><div class="row"><div class="col-sm-12"><text-field name="text-field-2" alias="" type="text" v-model="slotProps.modelValue['text-field-2']"></text-field></div></div><div class="row"><div class="col-sm-12"><boolean-field name="boolean-field-3" v-model="slotProps.modelValue['boolean-field-3']"></boolean-field></div></div></row-layout></section>`;

test('편집기가 자동으로 붙인 이름만 알아본다', () => {
    assert.equal(autoNameNumber('text-field', 'text-field-2'), '2');
    assert.equal(autoNameNumber('boolean-field', 'boolean-field-3-copy'), '3');
    assert.equal(autoNameNumber('text-field', 'text-field'), '');
    assert.equal(autoNameNumber('user-select-field', 'user_select_4'), '4');
    assert.equal(autoNameNumber('text-field', 'text'), '');
    assert.equal(autoNameNumber('text-field', 'boolean-field-3'), null); // 다른 종류의 이름
    assert.equal(autoNameNumber('text-field', 'customer_name'), null);
});

test('보이는 이름이 없으면 내부 이름 대신 읽을 수 있는 이름', () => {
    assert.equal(fallbackFieldLabel('text-field', 'text-field-2', translate), '텍스트 2');
    assert.equal(fallbackFieldLabel('boolean-field', 'boolean-field-3', translate), '예/아니오 3');
    assert.equal(fallbackFieldLabel('user-select-field', 'user_select', translate), '사용자 선택');
    assert.equal(fallbackFieldLabel('text-field', 'customer_name', translate), 'customer name');
    // 번역이 없으면 팔레트 이름
    assert.equal(fallbackFieldLabel('boolean-field', 'boolean-field-3'), '예/아니오 3');
});

test('업무 화면 폼: 빈 alias 를 채우고, 자유입력은 제목 한 번 · 칸 이름 숨김', () => {
    const out = presentFormHtml(REVIEW_FORM, {
        translate,
        freeInputTitle: '작업 내용',
        freeInputPlaceholder: '한 일을 적어 주세요',
        DOMParser
    });
    const doc = parse(out);
    assert.equal(doc.querySelector('text-field').getAttribute('alias'), '텍스트 2');
    assert.equal(doc.querySelector('boolean-field').getAttribute('alias'), '예/아니오 3');
    assert.equal(doc.querySelector('row-layout').getAttribute('alias'), '작업 내용');
    const free = doc.querySelector('textarea-field');
    assert.equal(free.getAttribute('hide_label'), 'true');
    assert.equal(free.getAttribute('placeholder'), '한 일을 적어 주세요');
    // 바인딩(v-model · v-slot)은 그대로
    assert.equal(free.getAttribute('v-model'), "slotProps.modelValue['free_input']");
    assert.equal(doc.querySelector('row-layout').getAttribute('v-slot'), 'slotProps');
    assert.ok(!/text-field-2"\s*type|alias=""/.test(out));
});

test('제목이 따로 있는 폼 · 이름이 다 있는 폼은 건드리지 않는다', () => {
    const named = `<section><row-layout name="review" alias="검토"><text-field name="title" alias="제목"></text-field></row-layout></section>`;
    assert.equal(presentFormHtml(named, { translate, freeInputTitle: '작업 내용', DOMParser }), named);
    // 자유입력 칸이 다른 이름(접수내용)을 갖고 있으면 그 이름은 남긴다
    const custom = `<row-layout name="free_input_section" alias="자유입력"><textarea-field name="free_input" alias="접수내용"></textarea-field></row-layout>`;
    const doc = parse(presentFormHtml(custom, { translate, freeInputTitle: '작업 내용', DOMParser }));
    assert.equal(doc.querySelector('row-layout').getAttribute('alias'), '작업 내용');
    assert.equal(doc.querySelector('textarea-field').getAttribute('hide_label'), null);
    assert.equal(doc.querySelector('textarea-field').getAttribute('alias'), '접수내용');
});

test('빈 HTML · "null" 은 그대로', () => {
    assert.equal(presentFormHtml('', { DOMParser }), '');
    assert.equal(presentFormHtml('null', { DOMParser }), 'null');
    assert.equal(presentFormHtml(null, { DOMParser }), null);
});

test('키만 있을 때(산출물 카드) — 키 모양으로 필드 종류를 짐작한다, 편집기 자동 이름일 때만', () => {
    assert.equal(inferFieldTag('text-field-2'), 'text-field');
    assert.equal(inferFieldTag('boolean-field-3-copy'), 'boolean-field');
    assert.equal(inferFieldTag('boolean_3'), 'boolean-field');
    assert.equal(inferFieldTag('user_select_2'), 'user-select-field');
    assert.equal(inferFieldTag('select'), 'select-field');
    assert.equal(inferFieldTag('customer_name'), '');
    assert.equal(inferFieldTag('request_detail_2'), '');
    assert.equal(inferFieldTag(''), '');
});

test('키만 있을 때의 이름도 업무 화면과 같은 규칙 — 「boolean 3」 이 아니라 「예/아니오 3」', () => {
    const opts = { translate, freeInputTitle: '작업 내용' };
    // 지금 편집기의 자동 이름(밑줄)
    assert.equal(fieldLabelForKey('boolean_3', opts), '예/아니오 3');
    assert.equal(fieldLabelForKey('user_select_2', opts), '사용자 선택 2');
    assert.equal(fieldLabelForKey('select_4', opts), '선택 4');
    // 예전 편집기의 자동 이름(하이픈)
    assert.equal(fieldLabelForKey('text-field-2', opts), '텍스트 2');
    assert.equal(fieldLabelForKey('boolean-field-3', opts), '예/아니오 3');
    // 기본 자유입력 칸은 카드 제목
    assert.equal(fieldLabelForKey('free_input', opts), '작업 내용');
    assert.equal(fieldLabelForKey('free_input', { translate }), 'free input', '제목을 모르면 읽을 수 있는 이름');
    // 직접 지은 키
    assert.equal(fieldLabelForKey('customer_name', opts), 'customer name');
});

test('업무 화면에 보이는 칸 이름 — 빈 alias 는 「텍스트 2」, 이름을 숨긴 자유입력 칸은 카드 제목 「작업 내용」', () => {
    const labels = presentedFieldLabels(REVIEW_FORM, { translate, freeInputTitle: '작업 내용', DOMParser });
    assert.deepEqual(labels, { free_input: '작업 내용', 'text-field-2': '텍스트 2', 'boolean-field-3': '예/아니오 3' });
    const named = `<section><row-layout name="review" alias="검토"><text-field name="title" alias="제목"></text-field></row-layout></section>`;
    assert.deepEqual(presentedFieldLabels(named, { translate, DOMParser }), { title: '제목' });
    assert.deepEqual(presentedFieldLabels('', { DOMParser }), {});
    assert.deepEqual(presentedFieldLabels(null, { DOMParser }), {});
});
