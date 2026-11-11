/**
 * 업무 산출물 글(자유입력 · 에이전트 결과)을 읽기 좋게 그린다.
 *
 * 에이전트가 쓴 글은 마크다운 규칙을 반쯤만 지킨다. 줄 머리("적합한 점:") 바로 아래에 목록이 붙고,
 * 목록 바로 다음 줄에 빈 줄 없이 다음 줄 머리가 온다. 마크다운으로 그대로 그리면 다음 줄 머리가
 * 앞 목록 항목 안으로 빨려 들어가고(게으른 이어 쓰기), 2. 로 시작하는 목록은 문단을 끊지 못해
 * 문단 글로 붙는다. 그래서 그리기 전에 줄 머리 · 목록 앞뒤에 빈 줄을 넣고, 줄 머리는 굵게 따로 세운다.
 *
 * marked 의 전역 설정은 다른 화면(Chat.vue)이 바꿔 놓는다 — 어느 화면을 먼저 열었느냐에 따라 줄바꿈이
 * 달라지지 않게 여기서는 늘 옵션을 직접 준다.
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const LIST_ITEM = /^\s*(?:[-*+•·]|\d{1,3}[.)])\s+\S/;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s*#{1,6}\s/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;

/** 목록 항목 줄인가 */
export function isListItem(line) {
    return LIST_ITEM.test(line || '');
}

/**
 * 줄 머리인가 — 목록 · 제목이 아니고, 짧고, 콜론으로 끝나는 한 줄("적합한 점:", "권고 후속 조치:").
 * "검토 결과: 조건부 적합입니다." 처럼 콜론 뒤에 내용이 있는 줄은 머리가 아니다.
 */
export function isSectionLabel(line) {
    const s = String(line || '').trim();
    if (!s || s.length > 40) return false;
    if (isListItem(s) || HEADING.test(s) || TABLE_ROW.test(s)) return false;
    if (/^\*\*.*\*\*:?$/.test(s)) return false; // 이미 굵게 쓴 줄은 그대로 둔다
    return /[:：]$/.test(s);
}

/** 그리기 전에 줄 머리와 목록의 경계를 마크다운이 알아보게 고친다(코드 블록 안은 건드리지 않는다). */
export function normalizeMarkdown(text) {
    const lines = String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n');
    const out = [];
    let inFence = false;
    const last = () => (out.length ? out[out.length - 1] : '');
    const blankBefore = () => {
        if (out.length && last().trim() !== '') out.push('');
    };
    // 바로 앞 줄이 목록에 속하는가(목록 항목이거나 들여 쓴 이어 쓰기)
    let inList = false;

    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (FENCE.test(line)) {
            if (!inFence) blankBefore();
            inFence = !inFence;
            out.push(line);
            inList = false;
            continue;
        }
        if (inFence) {
            out.push(line);
            continue;
        }
        if (line.trim() === '') {
            out.push('');
            inList = false;
            continue;
        }
        if (inList && /^\s/.test(line) && !isListItem(line)) {
            // 들여 쓴 줄은 앞 항목의 이어 쓰기(들여 쓴 줄 머리도 항목 안의 글로 둔다)
            out.push(line);
            continue;
        }
        if (isSectionLabel(line)) {
            blankBefore();
            out.push(`**${line.trim()}**`);
            out.push('');
            inList = false;
            continue;
        }
        if (isListItem(line)) {
            // 글머리를 마크다운 글머리로(• · 는 마크다운이 모른다)
            const item = line.replace(/^(\s*)[•·]\s+/, '$1- ');
            if (!inList) blankBefore();
            out.push(item);
            inList = true;
            continue;
        }
        if (inList) blankBefore(); // 들여 쓰지 않은 줄은 목록이 끝난 것 — 앞 항목에 붙지 않게 끊는다
        out.push(line);
        inList = false;
    }
    return out
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** 마크다운 → HTML(거르기 전). 줄 머리 문단에는 md-section 표시를 붙인다. */
export function markdownToHtml(text) {
    const src = normalizeMarkdown(text);
    if (!src) return '';
    const html = marked.parse(src, { gfm: true, breaks: true, async: false });
    return String(html).replace(/<p><strong>([^<]*)<\/strong><\/p>/g, '<p class="md-section"><strong>$1</strong></p>');
}

/**
 * 화면에 넣을 HTML. 산출물 글은 사람 · 에이전트가 쓴 것이라 그대로 넣으면 &lt;img onerror&gt; 같은
 * 글이 실행된다 — 늘 걸러서 넣는다.
 */
export function renderMarkdown(text) {
    const html = markdownToHtml(text);
    return DOMPurify.isSupported ? DOMPurify.sanitize(html) : html;
}

/**
 * 마크다운으로 그릴 만한 글인가. 마크다운 표시가 있거나, 줄 머리(“적합한 점:”)로 나뉜 여러 줄 글이면 그린다.
 * 평문 한 줄 · 짧은 메모는 그대로 둔다(오탐 방지).
 */
export function looksLikeMarkdown(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return false;
    const signals = [
        /(^|\n)#{1,6}\s/, // 제목
        /(^|\n)\s*[-*+•]\s+\S/, // 글머리
        /(^|\n)\s*\d+\.\s+\S/, // 번호
        /```/, // 코드
        /(^|\n)\s*>\s+\S/, // 인용
        /\|.+\|/, // 표
        /\[[^\]]+\]\([^)]+\)/, // 링크
        /\*\*[^*]+\*\*/ // 굵게
    ];
    if (signals.some((re) => re.test(raw))) return true;
    const lines = raw.split(/\r?\n/);
    return lines.length > 1 && lines.some(isSectionLabel);
}
