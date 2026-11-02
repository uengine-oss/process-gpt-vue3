/**
 * 받는 중인 폼 디자이너 응답으로 "지금까지의 폼"을 만든다 — 편집기에 실시간으로 그리기 위해.
 *
 * 응답은 ```json { "htmlOutput": "..." } ``` 또는 { "modifications": [ {action, targetCSSSelector, tagValue}, ... ] }
 * 이다. JSON이 다 오기 전이라 JSON.parse를 쓸 수 없으므로, 필요한 문자열 값만 직접 읽는다.
 * 문자열이 아직 끝나지 않았으면 받은 데까지 쓰고, HTML은 브라우저 파서가 열린 태그를 닫아 준다.
 */
import { applyFormModifications } from './formModifications.js';

/** JSON 문자열 리터럴 본문을 읽는다(start는 여는 따옴표 다음). 끝나지 않았으면 받은 데까지. */
function readJsonString(text, start) {
    let out = '';
    let i = start;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') return { value: out, done: true, end: i + 1 };
        if (ch === '\\') {
            const next = text[i + 1];
            if (next === undefined) break; // 이스케이프가 잘려 있다
            if (next === 'u') {
                const hex = text.slice(i + 2, i + 6);
                if (hex.length < 4) break;
                out += String.fromCharCode(parseInt(hex, 16));
                i += 6;
                continue;
            }
            out += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[next] ?? next;
            i += 2;
            continue;
        }
        out += ch;
        i++;
    }
    return { value: out, done: false, end: text.length };
}

/** "key": "값" 의 값. 없으면 null */
function readKey(text, key, from = 0, to = text.length) {
    const re = new RegExp(`"${key}"\\s*:\\s*"`, 'g');
    re.lastIndex = from;
    const match = re.exec(text);
    if (!match || match.index >= to) return null;
    return readJsonString(text, match.index + match[0].length);
}

/** 끝에 잘린 태그(< 다음에 > 가 아직 없는 것)는 떼어 낸다 */
function trimPartialTag(html) {
    const lt = html.lastIndexOf('<');
    return lt > html.lastIndexOf('>') ? html.slice(0, lt) : html;
}

/**
 * @param {string} text 받은 데까지의 응답 원문
 * @param {string} prevHtml 수정 전 폼(수정 명령을 적용할 바탕)
 * @returns {string|null} 지금까지의 폼 HTML. 아직 그릴 것이 없으면 null
 */
export function buildStreamingFormHtml(text, prevHtml, options = {}) {
    const raw = String(text || '');

    const html = readKey(raw, 'htmlOutput');
    if (html) {
        const value = trimPartialTag(html.value);
        return value.trim() ? value : null;
    }

    const listStart = raw.search(/"modifications"\s*:\s*\[/);
    if (listStart < 0) return null;

    // 명령마다 "action" 이 하나씩 있다 — action 위치로 명령을 나눈다
    const starts = [];
    const actionRe = /"action"\s*:\s*"/g;
    actionRe.lastIndex = listStart;
    for (let m = actionRe.exec(raw); m; m = actionRe.exec(raw)) starts.push(m.index);
    if (!starts.length) return null;

    // 명령 객체의 시작({)부터 다음 명령 전까지를 한 명령으로 본다(키 순서는 상관없다)
    const objectStart = (pos) => Math.max(listStart, raw.lastIndexOf('{', pos));
    const modifications = [];
    starts.forEach((pos, index) => {
        const from = objectStart(pos);
        const to = index + 1 < starts.length ? objectStart(starts[index + 1]) : raw.length;
        const action = readKey(raw, 'action', from, to);
        const target = readKey(raw, 'targetCSSSelector', from, to);
        if (!action?.done || !target?.done) return; // 대상을 모르면 아직 적용할 수 없다
        const tag = readKey(raw, 'tagValue', from, to);
        if (action.value !== 'delete' && !tag) return;
        modifications.push({
            action: action.value,
            targetCSSSelector: target.value,
            tagValue: tag ? (tag.done ? tag.value : trimPartialTag(tag.value)) : undefined
        });
    });
    if (!modifications.length) return null;
    return applyFormModifications(prevHtml, modifications, options).html;
}
