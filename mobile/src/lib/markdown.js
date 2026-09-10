/**
 * 마크다운 그리기.
 *
 * 에이전트는 답을 마크다운으로 쓴다. 그대로 두면 화면에 `**요약**` 처럼 별표가
 * 그대로 보이고, 표는 파이프 문자 줄이 되고, 코드는 백틱에 둘러싸인 한 줄이
 * 된다. 포털은 이것을 그려서 보여 주는데 앱만 날것으로 보이면 같은 답이
 * 앱에서만 읽기 어려워진다.
 *
 * 포털(Chat.vue)과 같은 설정을 쓴다 — `marked` 에 `gfm: true, breaks: true`.
 * 같은 글이 두 화면에서 다르게 보이면 안 된다.
 *
 * 다만 포털과 달리 **소독(sanitize)을 거친다.** 답의 내용은 사람이 넣은 글과
 * 바깥에서 가져온 문서가 섞여 들어오므로, 거기에 섞인 <script> 나
 * onerror= 같은 것이 그대로 실행되면 곧 로그인 토큰이 새어 나간다.
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

const ALLOWED = {
    // target/rel 은 아래에서 우리가 붙이는 것이라 통과시켜야 한다.
    ADD_ATTR: ['target', 'rel'],
    // 폼은 마크다운에 나올 이유가 없고, 나오면 그것은 낚시다.
    FORBID_TAGS: ['form', 'input', 'button', 'style'],
    FORBID_ATTR: ['formaction', 'style']
};

/**
 * 그릴 글로 다듬는다.
 *
 * 메시지 내용 칸에는 문자열만 오지 않는다. `{ msg: '...' }` 처럼 한 겹 싸인
 * 것이 그대로 저장된 경우가 있어, 그때는 안의 글을 꺼낸다. 못 꺼내면 빈 글로
 * 둔다 — 객체를 통째로 찍으면 사용자에게 `[object Object]` 가 보인다.
 */
export function normalizeSource(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        const inner = value.msg ?? value.text ?? value.content;
        return typeof inner === 'string' ? inner : '';
    }
    return '';
}

/**
 * 링크는 바깥 창으로 연다.
 *
 * 앱 안에서 그대로 열면 우리 화면이 남의 사이트로 바뀌고, 뒤로 가기가 없는
 * 앱에서는 돌아올 방법이 사라진다. `noopener` 는 열린 쪽이 우리 창을 마음대로
 * 돌리지 못하게 막는다.
 */
export function externalLinks(html) {
    return (html || '').replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
}

/** 그릴 것이 있는가. 없으면 빈 말풍선을 만들지 않는다. */
export function isBlank(value) {
    return !normalizeSource(value).trim();
}

/**
 * 마크다운 → 안전한 HTML.
 *
 * 파서와 소독기를 밖에서 넣을 수 있게 해 두었다. 이 규칙(무엇을 꺼내고,
 * 링크를 어떻게 여는가)만 따로 시험하기 위해서다.
 */
export function render(value, deps = {}) {
    const source = normalizeSource(value);
    if (!source.trim()) return '';

    const parse = deps.parse || defaultParse;
    const sanitize = deps.sanitize || defaultSanitize;

    return sanitize(externalLinks(parse(source)));
}

marked.setOptions({ gfm: true, breaks: true });

function defaultParse(text) {
    return marked.parse(text);
}

function defaultSanitize(html) {
    return DOMPurify.sanitize(html, ALLOWED);
}
