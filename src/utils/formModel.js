/**
 * 폼 편집기 모델 — 저장된 폼 HTML ↔ 편집 모델.
 *
 * 저장 형식(<row-layout> + <xxx-field>)은 화면만 쓰는 것이 아니다. deepagents·cli-agent의
 * 프로세스 생성 스킬이 이 형식으로 폼을 만들고, agent-sdk는 여기서 뽑은 fields_json을 읽는다.
 * 그래서 편집기는 형식을 바꾸지 않는다. 지켜야 할 것은 하나다.
 *
 *   기존 폼을 열었다가 저장하면 HTML이 똑같이 나온다.
 *
 * - 아무것도 고치지 않았으면 읽은 HTML 문자열을 그대로 돌려준다(serializeForm).
 * - 고쳤으면, 고친 행만 정규 형식으로 다시 쓰고 나머지 행은 읽은 그대로 둔다.
 *   "고쳤는가"는 플래그가 아니라 정규 형식 문자열 비교로 판단한다. 그래서 AI가 폼 전체를
 *   다시 보내도(rebaseForm) 실제로 바뀐 행만 새로 쓰인다.
 * - 편집기가 이해하지 못하는 구조는 고치지 않고 통째로 보존한다(kind: 'raw').
 *
 * 모델
 *   form    { source, sourceCanon, sections: [section] }
 *   section { id, wrapped, blocks: [row | raw] }          wrapped=false: <section> 없이 저장돼 있던 것
 *   row     { id, kind:'row', name, alias, multi, lines: [line], orig, origCanon }
 *   line    { id, items: [col | field | raw] }             div.row 하나
 *   col     { id, kind:'col', cls, span, items: [field | section | raw] }
 *           칸 안의 section은 중첩 레이아웃이다(AI 프롬프트가 안내하는 형식). 안쪽도 같은 규칙으로 읽고 쓴다.
 *   field   { id, kind:'field', tag, attrs, inner, bindKey }
 *   raw     { id, kind:'raw', html, orig, origCanon }
 */

/** 런타임 바인딩. 모델에 담지 않고 쓸 때 다시 붙인다. */
const BINDING_ATTR = /^(v-|:|@)/;
const COL_CLASS = /(^|\s)col-sm-(\d+)(\s|$)/;

let seq = 0;
export const uid = (prefix) => `${prefix}_${(++seq).toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const isFieldTag = (tag) => tag.endsWith('-field');
const tagOf = (el) => el.tagName.toLowerCase();
const isRowDiv = (el) => tagOf(el) === 'div' && el.classList.contains('row');
const isBlank = (node) => node.nodeType === 3 && !node.textContent.trim();

function meaningfulChildren(el) {
    return Array.from(el.childNodes).filter((node) => (node.nodeType === 1 || node.nodeType === 3) && !isBlank(node));
}

function rawOf(node) {
    const html = node.nodeType === 1 ? node.outerHTML : escapeText(node.textContent);
    return { id: uid('raw'), kind: 'raw', html };
}

// ---------------------------------------------------------------------------
// 읽기
// ---------------------------------------------------------------------------

export function parseForm(html, { DOMParser = globalThis.DOMParser } = {}) {
    const source = html || '';
    const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${source}</body></html>`, 'text/html');

    const sections = [];
    let loose = null; // <section> 밖에 있던 것들
    for (const node of meaningfulChildren(doc.body)) {
        if (node.nodeType === 1 && tagOf(node) === 'section') {
            loose = null;
            sections.push({ id: uid('section'), wrapped: true, blocks: meaningfulChildren(node).map(readBlock) });
        } else {
            if (!loose) {
                loose = { id: uid('section'), wrapped: false, blocks: [] };
                sections.push(loose);
            }
            loose.blocks.push(readBlock(node));
        }
    }

    const form = { source, sourceCanon: '', sections };
    form.sections.forEach((section) => section.blocks.forEach((block) => markOriginal(block)));
    form.sourceCanon = canonicalForm(form);
    return form;
}

function readBlock(node) {
    if (node.nodeType === 1 && (tagOf(node) === 'row-layout' || isRowDiv(node))) {
        const row = readRow(node);
        if (row) {
            row.orig = node.outerHTML;
            return row;
        }
    }
    const raw = rawOf(node);
    raw.orig = raw.html;
    return raw;
}

/**
 * row-layout(또는 row-layout 없이 저장된 div.row) 하나를 행으로 읽는다.
 * 경로에 아는 것(row-layout, v-for 래퍼, row-layout-item-head, div.row)만 있어야 한다.
 * 모르는 것이 있으면 null — 그 블록은 raw로 보존된다.
 */
function readRow(groupEl) {
    const path = []; // 행 이름을 줄 수 있는 요소들(바깥 → 안)
    const lineEls = [];
    let hasRepeater = false;

    const walk = (el) => {
        if (isRowDiv(el)) {
            path.push(el);
            lineEls.push(el);
            return true;
        }
        if (tagOf(el) === 'row-layout') path.push(el);
        for (const child of meaningfulChildren(el)) {
            if (child.nodeType !== 1) return false;
            const tag = tagOf(child);
            if (tag === 'row-layout-item-head') continue; // 다중 데이터 행에서 다시 만든다
            if (tag === 'div' && child.hasAttribute('v-for')) {
                hasRepeater = true;
                if (!walk(child)) return false;
            } else if (tag === 'row-layout' || isRowDiv(child)) {
                if (!walk(child)) return false;
            } else {
                return false;
            }
        }
        return true;
    };
    if (!walk(groupEl) || lineEls.length === 0) return null;

    const named = path.find((el) => el.getAttribute('name')) || path.find((el) => el.getAttribute('alias'));
    const multi = path.some((el) => el.getAttribute('is_multidata_mode') === 'true');
    // 반복 래퍼(v-for)는 있는데 다중 데이터가 아닌 행은 모르는 구조다.
    // 다중 데이터인데 래퍼가 없는 행은 AI 프롬프트가 쓰는 모양이다 — 예전 편집기처럼 저장할 때 래퍼를 붙인다.
    if (hasRepeater && !multi) return null;

    return {
        id: uid('row'),
        kind: 'row',
        name: named?.getAttribute('name') || '',
        alias: named?.getAttribute('alias') || '',
        multi,
        lines: lineEls.map((lineEl) => ({ id: uid('line'), items: meaningfulChildren(lineEl).map(readLineItem) }))
    };
}

function readLineItem(node) {
    if (node.nodeType === 1) {
        const match = (node.getAttribute('class') || '').match(COL_CLASS);
        if (tagOf(node) === 'div' && match) {
            // class 말고 다른 속성(v-for 등)이 붙은 칸은 모르는 구조다 — raw로 보존
            const extraAttrs = Array.from(node.attributes).filter((a) => a.name !== 'class');
            if (extraAttrs.length === 0) {
                return {
                    id: uid('col'),
                    kind: 'col',
                    cls: node.getAttribute('class'),
                    span: Number(match[2]),
                    items: meaningfulChildren(node).flatMap(readColItems)
                };
            }
        }
        if (isFieldTag(tagOf(node))) return readField(node);
    }
    return rawOf(node);
}

/**
 * 칸 안의 항목들. AI가 칸 안에 칸(div.col-sm-N)을 하나 더 두는 경우가 있다 — 그 칸은 화면에서
 * 전체 너비 블록일 뿐이라 안쪽 항목을 바깥 칸으로 꺼낸다(속성이 class 뿐일 때만).
 */
function readColItems(node) {
    if (node.nodeType === 1 && tagOf(node) === 'div' && COL_CLASS.test(node.getAttribute('class') || '')) {
        const onlyClass = Array.from(node.attributes).every((a) => a.name === 'class');
        if (onlyClass) return meaningfulChildren(node).flatMap(readColItems);
    }
    return [readColItem(node)];
}

function readColItem(node) {
    if (node.nodeType === 1) {
        if (isFieldTag(tagOf(node))) return readField(node);
        // 중첩 레이아웃: 칸 안의 <section>, 또는 section 없이 바로 놓인 row-layout/div.row
        if (tagOf(node) === 'section') {
            return { id: uid('section'), kind: 'section', wrapped: true, blocks: meaningfulChildren(node).map(readBlock) };
        }
        if (tagOf(node) === 'row-layout' || isRowDiv(node)) {
            return { id: uid('section'), kind: 'section', wrapped: false, blocks: [readBlock(node)] };
        }
    }
    return rawOf(node);
}

function readField(el) {
    const attrs = {};
    let bindKey = null;
    for (const { name, value } of Array.from(el.attributes)) {
        if (name === 'v-model') {
            const match = value.match(/\[['"](.+?)['"]\]/);
            if (match && match[1] !== el.getAttribute('name')) bindKey = match[1];
        }
        if (!BINDING_ATTR.test(name)) attrs[name] = value;
    }
    return { id: uid('field'), kind: 'field', tag: tagOf(el), attrs, inner: el.innerHTML, bindKey };
}

function markOriginal(block) {
    block.origCanon = canonicalBlock(block);
    if (block.kind === 'raw') block.orig = block.html;
}

// ---------------------------------------------------------------------------
// 쓰기
// ---------------------------------------------------------------------------

/** 저장할 HTML. 안 고친 폼은 읽은 문자열 그대로, 고친 폼은 고친 행만 새로 쓴다. */
export function serializeForm(form) {
    if (canonicalForm(form) === form.sourceCanon) return form.source;
    return form.sections.map((section) => wrapSection(section, section.blocks.map((block) => emitBlock(block)).join(''))).join('');
}

/** 정규 형식. 같은 폼이면 언제나 같은 문자열이다(비교 기준). */
export function canonicalForm(form) {
    return form.sections.map((section) => wrapSection(section, section.blocks.map((block) => canonicalBlock(block)).join(''))).join('');
}

function emitBlock(block) {
    const canon = canonicalBlock(block);
    return block.orig != null && canon === block.origCanon ? block.orig : canon;
}

const wrapSection = (section, inner) => (section.wrapped ? `<section>${inner}</section>` : inner);

/** @param parentMulti 이 행이 여러 건 입력 행의 칸 안에 중첩돼 있는지 */
export function canonicalBlock(block, parentMulti = false) {
    if (block.kind === 'raw') return block.html;

    // 바인딩 규칙은 FormDefinitionModule.keditorContentHTMLToDynamicFormHTML과 같다
    // (여러 건 입력 행 안에 중첩된 행은 반복 항목 item 에 묶인다)
    const head = `<row-layout name="${attr(block.name)}" alias="${attr(block.alias)}" is_multidata_mode="${block.multi}" v-model="${
        parentMulti ? 'item' : 'formValues'
    }" v-slot="slotProps">`;
    const lines = block.lines
        .map((line) => `<div class="row">${line.items.map((item) => lineItemHtml(item, block.multi)).join('')}</div>`)
        .join('');
    if (!block.multi) return `${head}${lines}</row-layout>`;
    return (
        `${head}<div v-for="(item, index) in slotProps.modelValue" :key="index">` +
        `<row-layout-item-head :index="index" v-on:on_delete_item="slotProps.deleteItem(index)"></row-layout-item-head>` +
        `${lines}</div></row-layout>`
    );
}

function lineItemHtml(item, multi) {
    if (item.kind === 'col') return `<div class="${attr(item.cls)}">${item.items.map((it) => lineItemHtml(it, multi)).join('')}</div>`;
    if (item.kind === 'field') return fieldHtml(item, { multi, bind: true });
    if (item.kind === 'section') return wrapSection(item, item.blocks.map((block) => canonicalBlock(block, multi)).join(''));
    return item.html;
}

/** 필드 태그 하나. bind=false면 바인딩 없이(편집 캔버스 렌더링용). */
export function fieldHtml(field, { multi = false, bind = false } = {}) {
    let attrs = Object.entries(field.attrs)
        .map(([key, value]) => ` ${key}="${attr(value)}"`)
        .join('');
    if (bind) {
        const key = field.bindKey || field.attrs.name || '';
        if (field.tag === 'code-field') {
            attrs += ` v-model="codeInfos['${attr(key)}']"`;
            if (field.attrs.event_type === 'click') attrs += ` v-on:on_click="executeCode('${attr(key)}')"`;
        } else {
            attrs += multi ? ` v-model="item['${attr(key)}']"` : ` v-model="slotProps.modelValue['${attr(key)}']"`;
        }
    }
    return `<${field.tag}${attrs}>${field.inner || ''}</${field.tag}>`;
}

const attr = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
const escapeText = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');

// ---------------------------------------------------------------------------
// AI가 폼 전체를 다시 보냈을 때
// ---------------------------------------------------------------------------

/**
 * 새로 읽은 폼에 이전 폼의 "원본"을 이어 붙인다.
 * 정규 형식이 이전에 읽은 행과 같은 행은 그 행의 원본 HTML로 저장된다.
 * 폼 전체가 처음 읽은 것과 같으면 처음 문자열 그대로 저장된다.
 */
export function rebaseForm(next, prev) {
    const originals = new Map();
    prev.sections.forEach((section) =>
        section.blocks.forEach((block) => {
            if (block.orig != null && !originals.has(block.origCanon)) originals.set(block.origCanon, block.orig);
        })
    );
    next.sections.forEach((section) =>
        section.blocks.forEach((block) => {
            const canon = canonicalBlock(block);
            if (originals.has(canon)) {
                block.orig = originals.get(canon);
                block.origCanon = canon;
            } else {
                block.orig = null;
                block.origCanon = null;
            }
        })
    );
    next.source = prev.source;
    next.sourceCanon = prev.sourceCanon;
    return next;
}

// ---------------------------------------------------------------------------
// 편집 동작
// ---------------------------------------------------------------------------

/** 폼의 모든 행(중첩 포함) */
export function allRows(form) {
    const rows = [];
    const visitBlocks = (blocks) =>
        blocks.forEach((block) => {
            if (block.kind !== 'row') return;
            rows.push(block);
            block.lines.forEach((line) =>
                line.items.forEach((item) => {
                    if (item.kind === 'col') item.items.forEach((it) => it.kind === 'section' && visitBlocks(it.blocks));
                    if (item.kind === 'section') visitBlocks(item.blocks);
                })
            );
        });
    form.sections.forEach((section) => visitBlocks(section.blocks));
    return rows;
}

/** 폼의 모든 필드(중첩 포함) */
export function allFields(form) {
    const out = [];
    const visit = (item) => {
        if (item.kind === 'field') out.push(item);
        else if (item.kind === 'col') item.items.forEach(visit);
    };
    allRows(form).forEach((row) => row.lines.forEach((line) => line.items.forEach(visit)));
    return out;
}

/** 폼 안에서 겹치지 않는 이름. */
export function uniqueName(form, base, extraTaken = []) {
    const taken = new Set([...allFields(form).map((f) => f.attrs.name), ...allRows(form).map((r) => r.name), ...extraTaken]);
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}_${n}`)) n++;
    return `${base}_${n}`;
}

/** 새 행. spans: [6, 6] 처럼 칸 비율. */
export function createRow(form, spans, { alias = '' } = {}) {
    return {
        id: uid('row'),
        kind: 'row',
        name: uniqueName(form, 'layout'),
        alias,
        multi: false,
        lines: [
            {
                id: uid('line'),
                items: spans.map((span) => ({ id: uid('col'), kind: 'col', cls: `col-sm-${span}`, span, items: [] }))
            }
        ],
        orig: null,
        origCanon: null
    };
}

/** 새 필드. defaults는 팔레트가 주는 기본 속성. */
export function createField(form, tag, defaults = {}, extraTaken = []) {
    const base = tag.replace(/-field$/, '').replace(/-/g, '_');
    const attrs = { ...defaults };
    // label-field는 값을 받지 않아 이름이 없다(KEditor 스니펫도 label 속성만 있다)
    if (tag !== 'label-field') attrs.name = uniqueName(form, base, extraTaken);
    return { id: uid('field'), kind: 'field', tag, attrs, inner: '', bindKey: null };
}

export function cloneField(form, field) {
    const copy = JSON.parse(JSON.stringify(field));
    copy.id = uid('field');
    copy.bindKey = null;
    copy.attrs.name = uniqueName(form, `${field.attrs.name || 'field'}_copy`);
    return copy;
}

// ---------------------------------------------------------------------------
// AI가 쓰는 중인 폼을 미리 그릴 때
// ---------------------------------------------------------------------------

/**
 * 새로 읽은 폼(next)에서 이전 폼(prev)과 같은 섹션·행은 이전 객체를 그대로 쓴다.
 * 화면이 같은 객체(같은 id)를 다시 그리지 않으므로, 실시간 미리보기에서 바뀌는 행만 새로 그려진다.
 * 이전 객체는 바꾸지 않는다(확정 전 원래 폼과 공유한다). 새로 그려지는 행의 id 집합을 돌려준다.
 */
export function reuseUnchanged(next, prev) {
    const sectionKey = (section) => wrapSection(section, section.blocks.map((block) => canonicalBlock(block)).join(''));
    const sections = new Map();
    const blocks = new Map();
    prev.sections.forEach((section) => {
        const key = sectionKey(section);
        if (!sections.has(key)) sections.set(key, section);
        section.blocks.forEach((block) => {
            const blockKey = canonicalBlock(block);
            if (!blocks.has(blockKey)) blocks.set(blockKey, block);
        });
    });

    const changed = new Set();
    next.sections = next.sections.map((section) => {
        const key = sectionKey(section);
        const same = sections.get(key);
        if (same) {
            sections.delete(key);
            return same;
        }
        return {
            ...section,
            blocks: section.blocks.map((block) => {
                const blockKey = canonicalBlock(block);
                const hit = blocks.get(blockKey);
                if (hit) {
                    blocks.delete(blockKey);
                    return hit;
                }
                changed.add(block.id);
                return block;
            })
        };
    });
    return changed;
}
