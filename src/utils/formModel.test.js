// 폼 편집기 모델 — "기존 폼을 열었다가 저장해도 HTML이 똑같이 나온다"를 지키는지 본다.
//
// 기준 폼: __fixtures__/form-corpus.json (로컬 form_def에서 모양별로 고른 실제 폼 16개)
// 전체 덤프로 돌리려면: FORM_CORPUS=/path/forms.json npm run test:unit
//   (form_def 행 배열 [{ id, html }] — psql 로 json_agg 한 결과)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser as LinkedomParser } from 'linkedom';

import {
    parseForm,
    serializeForm,
    canonicalForm,
    canonicalBlock,
    rebaseForm,
    createRow,
    createField,
    allFields,
    reuseUnchanged
} from './formModel.js';
import { normalizeFormRowLayout, extractFields } from './formHtml.js';

// linkedom은 완전한 문서만 읽는다. 브라우저 DOMParser처럼 조각도 받게 감싼다.
class DOMParser {
    parseFromString(html, type) {
        const full = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
        return new LinkedomParser().parseFromString(full, type);
    }
}
const P = { DOMParser };

const corpus = JSON.parse(fs.readFileSync(new URL('./__fixtures__/form-corpus.json', import.meta.url), 'utf8'));
if (process.env.FORM_CORPUS) corpus.push(...JSON.parse(fs.readFileSync(process.env.FORM_CORPUS, 'utf8')).filter((f) => f.html));

/**
 * 저장되는 모양을 모델과 무관하게 DOM에서 직접 뽑는다(모델로 뽑으면 자기 자신과 비교하게 된다).
 * 저장 직전 정규화(normalizeFormRowLayout)를 거친 뒤, 필드마다
 * 태그·속성(바인딩 제외)·안쪽 내용·칸 비율·소속 행(이름/제목)·다중 데이터 여부·줄·섹션 위치를 본다.
 */
function layoutSignature(html) {
    const doc = new DOMParser().parseFromString(normalizeFormRowLayout(html, P), 'text/html');
    const lines = Array.from(doc.querySelectorAll('div.row'));
    const sections = Array.from(doc.querySelectorAll('section'));
    return Array.from(doc.querySelectorAll('*'))
        .filter((el) => el.tagName.toLowerCase().endsWith('-field'))
        .map((el) => {
            let group = el.closest('row-layout');
            while (group && !group.getAttribute('name') && !group.getAttribute('alias')) group = group.parentElement?.closest('row-layout');
            const col = el.closest('[class*="col-sm-"]');
            return {
                tag: el.tagName.toLowerCase(),
                attrs: Object.fromEntries(
                    Array.from(el.attributes)
                        .filter((a) => !/^(v-|:|@)/.test(a.name))
                        .map((a) => [a.name, a.value])
                        .sort(([a], [b]) => a.localeCompare(b))
                ),
                inner: el.innerHTML.trim(),
                span: col ? col.getAttribute('class').match(/col-sm-(\d+)/)[1] : null,
                group: group ? [group.getAttribute('name') || '', group.getAttribute('alias') || ''] : null,
                multi: Boolean(el.closest('row-layout[is_multidata_mode="true"]')),
                line: lines.indexOf(el.closest('div.row')),
                section: sections.indexOf(el.closest('section'))
            };
        });
}

/** agent-sdk가 읽는 필드 목록 — 저장할 때 실제로 만들어지는 것 */
const savedFields = (html) => extractFields(normalizeFormRowLayout(html, P), P);

// ---------------------------------------------------------------------------
// 실제 폼으로
// ---------------------------------------------------------------------------

for (const form of corpus) {
    test(`[${form.shape || 'corpus'}] ${form.id}`, async (t) => {
        await t.test('열었다가 그대로 저장하면 같은 문자열이다', () => {
            assert.equal(serializeForm(parseForm(form.html, P)), form.html);
        });

        const canon = canonicalForm(parseForm(form.html, P));
        await t.test('모든 행을 새로 써도 저장되는 모양과 fields_json이 같다', () => {
            assert.deepEqual(layoutSignature(canon), layoutSignature(form.html));
            assert.deepEqual(savedFields(canon), savedFields(form.html));
        });

        await t.test('새로 쓴 것을 다시 읽어 쓰면 바뀌지 않는다', () => {
            assert.equal(canonicalForm(parseForm(canon, P)), canon);
        });

        await t.test('DB까지: 열기 → 저장을 반복해도 두 번째 저장부터 같은 HTML이다', () => {
            // putRawDefinition은 저장 직전에 normalizeFormRowLayout을 거친다
            const save = (html) => normalizeFormRowLayout(serializeForm(parseForm(html, P)), P);
            const first = save(form.html);
            assert.equal(first, normalizeFormRowLayout(form.html, P), '편집기는 아무것도 바꾸지 않는다');
            assert.equal(save(first), first);
        });
    });
}

test('편집기가 다룰 수 없는 블록은 실제 폼 중 하나뿐이고, 그것도 내용 그대로 보존된다', () => {
    const raws = corpus.flatMap((f) =>
        parseForm(f.html, P).sections.flatMap((s) => s.blocks.filter((b) => b.kind === 'raw').map(() => f.id))
    );
    assert.deepEqual([...new Set(raws)], ['393e5424_cbef_4bcb_b1ea_1b2ee06a86a2_task4_form']);
    const broken = corpus.find((f) => f.id === raws[0]);
    assert.equal(canonicalForm(parseForm(broken.html, P)).replace(/\s+/g, ''), broken.html.replace(/\s+/g, ''));
});

// ---------------------------------------------------------------------------
// 고친 곳만 바뀐다
// ---------------------------------------------------------------------------

test('필드 하나를 고치면 그 필드만 바뀌고, 다른 행은 읽은 HTML 그대로 저장된다', () => {
    const source = corpus.find((f) => f.id === 'contract_management_process_draft_activity_form').html;
    const form = parseForm(source, P);
    const rows = form.sections.flatMap((s) => s.blocks);
    assert.ok(rows.length >= 3);

    const target = allFields(form)[0];
    target.attrs.alias = '바꾼 제목';
    const saved = serializeForm(form);

    const before = layoutSignature(source);
    const after = layoutSignature(saved);
    const changed = after.map((f, i) => (JSON.stringify(f) === JSON.stringify(before[i]) ? null : i)).filter((i) => i !== null);
    assert.deepEqual(changed, [0]);
    assert.equal(after[0].attrs.alias, '바꾼 제목');

    // 고치지 않은 행은 원본 HTML 조각 그대로
    rows.slice(1).forEach((row) => assert.ok(saved.includes(row.orig)));
});

test('행 순서만 바꾸면 각 행은 원본 HTML 그대로 순서만 바뀐다', () => {
    // 섹션 하나에 행 하나가 보통이다(AI 프롬프트 규칙). 섹션째 옮긴다.
    const source = corpus.find((f) => f.id === 'contract_management_process_draft_activity_form').html;
    const form = parseForm(source, P);
    const [first, second] = form.sections;
    form.sections.splice(0, 2, second, first);
    const saved = serializeForm(form);
    const [a, b] = [first.blocks[0], second.blocks[0]];
    assert.ok(saved.indexOf(b.orig) < saved.indexOf(a.orig));
    assert.deepEqual(new Set(savedFields(saved).map((f) => f.key)), new Set(savedFields(source).map((f) => f.key)));
});

test('AI가 폼 전체를 다시 보내도 바뀐 행만 새로 쓰인다', () => {
    const source = corpus.find((f) => f.shape?.startsWith('skill-generated')).html;
    const prev = parseForm(source, P);

    // AI는 정규 형식(row-layout + 바인딩)으로 받은 폼을 고쳐서 돌려준다
    const same = rebaseForm(parseForm(canonicalForm(prev), P), prev);
    assert.equal(serializeForm(same), source, '아무것도 안 고쳤으면 처음 문자열 그대로');

    const next = parseForm(canonicalForm(prev), P);
    allFields(next)[0].attrs.alias = 'AI가 바꾼 제목';
    next.sections[0].blocks.push(createRow(next, [12], { alias: 'AI가 더한 행' }));
    rebaseForm(next, prev);
    const saved = serializeForm(next);
    assert.ok(saved.includes('AI가 바꾼 제목'));
    assert.ok(saved.includes('alias="AI가 더한 행"'));
});

// ---------------------------------------------------------------------------
// 새로 만드는 것은 지금 편집기(KEditor)가 저장하던 모양과 같다
// ---------------------------------------------------------------------------

test('새 행·새 필드는 기존 편집기와 같은 바인딩으로 저장된다', () => {
    const form = parseForm('', P);
    form.sections.push({ id: 's', wrapped: true, blocks: [] });
    const row = createRow(form, [6, 6], { alias: '기본 정보' });
    form.sections[0].blocks.push(row);
    const name = createField(form, 'text-field', { alias: '고객사명', type: 'text' });
    row.lines[0].items[0].items.push(name);
    assert.equal(
        serializeForm(form),
        '<section><row-layout name="layout" alias="기본 정보" is_multidata_mode="false" v-model="formValues" v-slot="slotProps">' +
            '<div class="row"><div class="col-sm-6"><text-field alias="고객사명" type="text" name="text" v-model="slotProps.modelValue[\'text\']"></text-field></div>' +
            '<div class="col-sm-6"></div></div></row-layout></section>'
    );

    row.multi = true;
    assert.match(canonicalBlock(row), /<div v-for="\(item, index\) in slotProps\.modelValue" :key="index"><row-layout-item-head/);
    assert.match(canonicalBlock(row), /v-model="item\['text'\]"/);
});

test('바인딩 키가 이름과 다른 필드는 키를 지킨다(fields_json의 key가 바뀌지 않는다)', () => {
    const source =
        '<section><row-layout name="a" alias="" is_multidata_mode="false" v-model="formValues" v-slot="slotProps"><div class="row"><div class="col-sm-12">' +
        '<text-field name="display_name" alias="표시명" v-model="slotProps.modelValue[\'legacy_key\']"></text-field></div></div></row-layout></section>';
    const form = parseForm(source, P);
    allFields(form)[0].attrs.alias = '바꾼 표시명';
    assert.deepEqual(
        savedFields(serializeForm(form)).map((f) => [f.key, f.text]),
        [['legacy_key', '바꾼 표시명']]
    );
});

test('이름이 겹치지 않게 만든다', () => {
    const form = parseForm(corpus.find((f) => f.id === 'customer_cs_handling_process_reply_simple_form').html, P);
    const taken = new Set(allFields(form).map((f) => f.attrs.name));
    const field = createField(form, 'text-field');
    assert.ok(!taken.has(field.attrs.name));
    const again = createField(form, 'text-field', {}, [field.attrs.name]);
    assert.notEqual(again.attrs.name, field.attrs.name);
});

// ---------------------------------------------------------------------------
// 중첩 레이아웃 — 칸 안의 section (AI 프롬프트가 안내하는 형식)
// ---------------------------------------------------------------------------

const NESTED =
    "<section><row-layout name='prospect' alias='고객 발굴 폼' is_multidata_mode='false' v-model=\"formValues\" v-slot=\"slotProps\"><div class='row'>" +
    "<div class='col-sm-6'><section><row-layout name='company' alias='고객 정보' is_multidata_mode='false' v-model=\"formValues\" v-slot=\"slotProps\"><div class='row'><div class='col-sm-12'>" +
    "<text-field name='company_name' alias='회사명' type='text'></text-field><select-field name='industry' alias='업종' items='[{\"mfg\":\"제조\"}]'></select-field>" +
    '</div></div></row-layout></section></div>' +
    "<div class='col-sm-6'><section><row-layout name='contact' alias='담당자' is_multidata_mode='false' v-model=\"formValues\" v-slot=\"slotProps\"><div class='row'><div class='col-sm-12'>" +
    "<text-field name='contact_name' alias='이름' type='text'></text-field></div></div></row-layout></section></div>" +
    '</div></row-layout></section>' +
    "<section><row-layout name='memo_section' alias='발굴 메모' is_multidata_mode='false' v-model=\"formValues\" v-slot=\"slotProps\"><div class='row'><div class='col-sm-12'>" +
    "<textarea-field name='memo' alias='발굴 메모' rows='6'></textarea-field></div></div></row-layout></section>";

test('중첩 레이아웃은 보존 블록이 아니라 편집할 수 있는 행으로 읽힌다', () => {
    const form = parseForm(NESTED, P);
    const rawCount = JSON.stringify(form).split('"kind":"raw"').length - 1;
    assert.equal(rawCount, 0);
    assert.deepEqual(
        allFields(form).map((f) => f.attrs.name),
        ['company_name', 'industry', 'contact_name', 'memo']
    );
});

test('중첩 레이아웃도 열었다 저장하면 같고, 새로 써도 저장 모양·fields_json이 같다', () => {
    const form = parseForm(NESTED, P);
    assert.equal(serializeForm(form), NESTED);
    const canon = canonicalForm(form);
    assert.deepEqual(layoutSignature(canon), layoutSignature(NESTED));
    assert.deepEqual(savedFields(canon), savedFields(NESTED));
    assert.equal(canonicalForm(parseForm(canon, P)), canon);
});

test('중첩된 필드를 고치면 그 필드만 바뀐다', () => {
    const form = parseForm(NESTED, P);
    allFields(form).find((f) => f.attrs.name === 'contact_name').attrs.alias = '담당자 이름';
    const before = layoutSignature(NESTED);
    const after = layoutSignature(serializeForm(form));
    const changed = after.map((f, i) => (JSON.stringify(f) === JSON.stringify(before[i]) ? null : f.attrs.name)).filter(Boolean);
    assert.deepEqual(changed, ['contact_name']);
});

test('여러 건 입력 행 안에 중첩된 행은 반복 항목(item)에 묶인다', () => {
    const form = parseForm(NESTED, P);
    form.sections[0].blocks[0].multi = true;
    const html = canonicalForm(form);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    assert.equal(doc.querySelector('row-layout[name="company"]').getAttribute('v-model'), 'item');
    assert.equal(doc.querySelector('[name="company_name"]').getAttribute('v-model'), "slotProps.modelValue['company_name']");
});

test('미리보기: 바뀌지 않은 섹션·행은 이전 객체를 그대로 쓰고, 이전 폼은 건드리지 않는다', () => {
    const prev = parseForm(NESTED, P);
    const before = JSON.stringify(prev);
    const html = NESTED.replace("발굴 메모' rows", "발굴 메모(수정)' rows");
    const next = parseForm(html, P);
    const changed = reuseUnchanged(next, prev);
    assert.equal(next.sections[0], prev.sections[0]); // 그대로인 섹션은 같은 객체
    assert.notEqual(next.sections[1], prev.sections[1]);
    assert.equal(changed.size, 1);
    assert.equal(JSON.stringify(prev), before);
});

// ---------------------------------------------------------------------------
// AI 응답에서 실제로 나온 모양 — 보존 블록이 아니라 편집할 수 있는 행으로 읽혀야 한다
// ---------------------------------------------------------------------------

test('AI가 쓴 여러 건 입력 행(반복 래퍼 없음)은 행으로 읽고, 저장할 때 반복 래퍼를 붙인다', () => {
    const ai =
        '<section><row-layout name="items_table" alias="품목 목록" is_multidata_mode="true" v-model="formValues" v-slot="slotProps"><div class="row">' +
        '<div class="col-sm-4"><text-field name="item_name" alias="품목명" type="text"></text-field></div>' +
        '<div class="col-sm-4"><text-field name="qty" alias="수량" type="number"></text-field></div>' +
        '<div class="col-sm-4"><text-field name="price" alias="단가" type="number"></text-field></div></div></row-layout></section>';
    const form = parseForm(ai, P);
    const [row] = form.sections[0].blocks;
    assert.equal(row.kind, 'row');
    assert.equal(row.multi, true);
    assert.equal(serializeForm(form), ai, '안 고치면 그대로');
    const canon = canonicalForm(form);
    assert.match(canon, /<div v-for="\(item, index\) in slotProps\.modelValue" :key="index">/);
    assert.match(canon, /v-model="item\['qty'\]"/);
    assert.deepEqual(savedFields(canon), savedFields(ai));
});

test('AI가 칸 안에 칸을 하나 더 둔 경우 안쪽 항목을 바깥 칸으로 꺼낸다', () => {
    const ai =
        '<section><row-layout name="detail" alias="민원 상세" is_multidata_mode="false" v-model="formValues" v-slot="slotProps"><div class="row"><div class="col-sm-12">' +
        '<div class="col-sm-12"><label-field label="민원 상세 내용"></label-field></div>' +
        '<textarea-field name="detail" alias="상세 내용"></textarea-field></div></div></row-layout></section>';
    const form = parseForm(ai, P);
    assert.equal(JSON.stringify(form).includes('"kind":"raw"'), false);
    assert.deepEqual(
        form.sections[0].blocks[0].lines[0].items[0].items.map((f) => f.tag),
        ['label-field', 'textarea-field']
    );
    assert.equal(serializeForm(form), ai, '안 고치면 그대로');
});
