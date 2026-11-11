/**
 * 업무 화면(해야 할 작업 · 전달받은 산출물)에 폼을 그리기 전에 보이는 이름만 고친다.
 * 저장된 폼 정의는 바꾸지 않는다 — 에이전트 · 저장 쪽은 원래 HTML 을 그대로 쓴다.
 *
 * 1) 보이는 이름(alias)이 빈 필드 — 예전 폼 편집기(KEditor)는 alias 없이 'text-field-2' 같은 이름만 넣었다
 *    (46db3a54 에서 새 필드는 고쳤지만 이미 만든 폼은 그대로다). 라벨 자리에 내부 이름이 보이던 것을
 *    필드 종류 이름 + 순번(「텍스트 2」)으로 바꾼다.
 * 2) 기본 자유입력 폼 — 카드 제목도 「자유입력」, 칸 이름도 「자유입력」이라 무엇을 쓰는 칸인지 말하지 않고
 *    같은 말이 두 번 나온다. 카드 제목을 「작업 내용」으로 바꾸고 칸 이름은 숨긴다(빈 칸에는 안내 문구).
 */
import { fieldTypeLabel } from '../../components/designer/form/fieldRegistry.js';

/** 보이는 이름을 갖는 값 필드 */
const LABELLED_FIELDS = [
    'text-field',
    'textarea-field',
    'boolean-field',
    'select-field',
    'checkbox-field',
    'radio-field',
    'user-select-field',
    'file-field',
    'folder-field',
    'report-field',
    'slide-field',
    'bpmn-uengine-field'
];

/** 기본 자유입력 폼이 쓰는 이름들(FormWorkItem 의 기본 폼 · 폼 편집기의 새 폼) */
export const FREE_INPUT_SECTION = 'free_input_section';
export const FREE_INPUT_FIELD = 'free_input';
const GENERIC_FREE_INPUT_ALIASES = ['자유입력', '자유 입력', 'free input', 'freeinput', 'free_input'];

const isGenericFreeInputAlias = (alias) =>
    GENERIC_FREE_INPUT_ALIASES.includes(
        String(alias || '')
            .trim()
            .toLowerCase()
    );

/**
 * 편집기가 자동으로 붙인 이름이면 그 순번을, 아니면 null.
 *   예전 편집기: 'text-field-2', 'boolean-field-3', 'text-field' (+ '-copy')
 *   지금 편집기: 'text', 'text_2', 'user_select_3' — 필드 종류와 같은 바탕일 때만
 */
export function autoNameNumber(tag, name) {
    const t = String(tag || '').toLowerCase();
    const n = String(name || '').trim();
    if (!t || !n) return null;
    const legacy = n.match(/^([a-z]+(?:-[a-z]+)*-field)(?:-(\d+))?(?:-copy)*$/);
    if (legacy && legacy[1] === t) return legacy[2] || '';
    const base = t.replace(/-field$/, '').replace(/-/g, '_');
    const current = n.match(/^([a-z_]+?)(?:_(\d+))?$/);
    if (current && current[1] === base) return current[2] || '';
    return null;
}

/**
 * alias 가 없을 때 라벨 자리에 쓸 사람이 읽을 이름.
 * 자동 이름이면 「필드 종류 이름 + 순번」, 직접 지은 이름이면 밑줄 · 하이픈을 띄어 쓴 이름.
 */
export function fallbackFieldLabel(tag, name, translate) {
    const n = autoNameNumber(tag, name);
    if (n !== null) {
        const type = fieldTypeLabel(tag, translate);
        if (type) return n ? `${type} ${n}` : type;
    }
    const readable = String(name || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return readable || fieldTypeLabel(tag, translate) || '';
}

/** 이 alias 는 비어 있는 것과 같은가(빈 값, 또는 자동 이름을 그대로 베낀 값) */
function aliasMissing(tag, name, alias) {
    const a = String(alias ?? '').trim();
    if (!a) return true;
    return a === String(name || '').trim() && autoNameNumber(tag, name) !== null;
}

/**
 * 업무 화면용으로 폼 HTML 의 보이는 이름을 고친다. 바꿀 것이 없으면 받은 HTML 을 그대로 돌려준다.
 *
 * @param {string} html  폼 정의 HTML
 * @param {object} [opts]
 * @param {(key: string) => string|null} [opts.translate]  번역(없으면 null)
 * @param {string} [opts.freeInputTitle]  자유입력 카드 제목(예: '작업 내용')
 * @param {string} [opts.freeInputPlaceholder]  자유입력 빈 칸 안내 문구
 * @param {typeof DOMParser} [opts.DOMParser]
 */
export function presentFormHtml(
    html,
    {
        translate,
        freeInputTitle = '',
        freeInputPlaceholder = '',
        DOMParser = typeof window !== 'undefined' ? window.DOMParser : undefined
    } = {}
) {
    if (!html || typeof html !== 'string' || html === 'null' || !DOMParser) return html;
    if (html.indexOf('-field') === -1) return html;
    let doc;
    try {
        doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
        return html;
    }
    let changed = false;

    // 1) 빈 보이는 이름
    doc.querySelectorAll(LABELLED_FIELDS.join(',')).forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const name = el.getAttribute('name') || '';
        if (!name || !aliasMissing(tag, name, el.getAttribute('alias'))) return;
        const label = fallbackFieldLabel(tag, name, translate);
        if (!label) return;
        el.setAttribute('alias', label);
        changed = true;
    });

    // 2) 기본 자유입력 폼
    doc.querySelectorAll('row-layout').forEach((row) => {
        const isFreeSection = row.getAttribute('name') === FREE_INPUT_SECTION || isGenericFreeInputAlias(row.getAttribute('alias'));
        const field = row.querySelector(`textarea-field[name="${FREE_INPUT_FIELD}"]`);
        if (!isFreeSection || !field) return;
        const rowAlias = row.getAttribute('alias') || '';
        if (freeInputTitle && isGenericFreeInputAlias(rowAlias)) {
            row.setAttribute('alias', freeInputTitle);
            changed = true;
        }
        // 칸 이름이 카드 제목과 같은 말(자유입력)이면 한 번만 보인다
        const fieldAlias = field.getAttribute('alias') || '';
        if (isGenericFreeInputAlias(fieldAlias) || fieldAlias === rowAlias) {
            field.setAttribute('hide_label', 'true');
            if (freeInputPlaceholder && !field.getAttribute('placeholder')) field.setAttribute('placeholder', freeInputPlaceholder);
            changed = true;
        }
    });

    return changed ? doc.body.innerHTML : html;
}

/**
 * 폼 없이 값의 키만 있을 때 키 모양으로 필드 종류를 짐작한다. 편집기가 붙인 자동 이름일 때만.
 *   예전 편집기 'boolean-field-3' → boolean-field, 지금 편집기 'boolean_3' · 'user_select_2' → boolean-field · user-select-field
 * 직접 지은 이름(customer_name)이면 ''.
 */
export function inferFieldTag(key) {
    const k = String(key || '').trim();
    const legacy = k.match(/^([a-z]+(?:-[a-z]+)*-field)(?:-\d+)?(?:-copy)*$/);
    if (legacy) return legacy[1];
    const current = k.match(/^([a-z_]+?)(?:_\d+)?$/);
    if (current) {
        const tag = `${current[1].replace(/_/g, '-')}-field`;
        if (LABELLED_FIELDS.includes(tag)) return tag;
    }
    return '';
}

/**
 * 값의 키만 있을 때(산출물 카드 · 폼 정의를 못 받은 값 목록)의 항목 이름. 업무 화면(presentFormHtml)과 같은 규칙 —
 * 자동 이름은 「예/아니오 3」, 기본 자유입력 칸은 카드 제목(「작업 내용」), 직접 지은 키는 밑줄을 띄어 쓴 이름.
 * 한쪽만 「boolean 3」 으로 보이지 않게 두 화면이 이 함수 하나를 쓴다.
 *
 * @param {string} key
 * @param {{translate?: (key: string) => string|null, freeInputTitle?: string}} [opts]
 */
export function fieldLabelForKey(key, { translate, freeInputTitle = '' } = {}) {
    const k = String(key ?? '');
    if (k === FREE_INPUT_FIELD && freeInputTitle) return freeInputTitle;
    return fallbackFieldLabel(inferFieldTag(k) || 'text-field', k, translate);
}

/**
 * 업무 화면에 보이는 그대로의 칸 이름 — 칸 name → 이름.
 * presentFormHtml 을 거친 폼에서 읽는다(빈 alias → 「텍스트 2」). 이름을 숨긴 기본 자유입력 칸은
 * 화면에서 카드 제목(「작업 내용」)으로 보이므로 그 제목을 쓴다.
 * 받아쓰기 결과 한 줄(「텍스트 2, 작업 내용 칸을 채웠습니다」)이 화면과 다른 이름을 말하지 않게 한다.
 *
 * @param {string} html  폼 정의 HTML(저장된 원본)
 * @param {Parameters<typeof presentFormHtml>[1]} [opts]  presentFormHtml 과 같은 옵션
 * @returns {Record<string, string>}
 */
export function presentedFieldLabels(html, opts = {}) {
    const Parser = opts.DOMParser || (typeof window !== 'undefined' ? window.DOMParser : undefined);
    const labels = {};
    if (!html || typeof html !== 'string' || html === 'null' || !Parser) return labels;
    let doc;
    try {
        doc = new Parser().parseFromString(presentFormHtml(html, { ...opts, DOMParser: Parser }), 'text/html');
    } catch (e) {
        return labels;
    }
    doc.querySelectorAll(LABELLED_FIELDS.join(',')).forEach((el) => {
        const name = el.getAttribute('name') || '';
        if (!name || labels[name]) return;
        if (el.getAttribute('hide_label') === 'true') {
            const row = el.closest('row-layout');
            const title = row && String(row.getAttribute('alias') || '').trim();
            if (title) {
                labels[name] = title;
                return;
            }
        }
        const alias = String(el.getAttribute('alias') || el.getAttribute('label') || '').trim();
        labels[name] = alias || fallbackFieldLabel(el.tagName.toLowerCase(), name, opts.translate);
    });
    return labels;
}
