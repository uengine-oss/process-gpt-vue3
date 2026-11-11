/**
 * 폼 HTML 에만 있는 항목 목록을 휴대폰 폼 칸에 채운다.
 *
 * form_def.fields_json 의 고르는 칸(select · radio · checkbox)에는 항목(items)이 빠져 있는 경우가 많다.
 * 항목은 HTML 의 <select-field items='[{"approve":"승인"},{"reject":"반려"}]'> 에만 있다.
 * 그대로 두면 휴대폰 폼의 고르는 칸이 「선택하세요」 하나뿐이라 아무것도 고를 수 없다
 * (2026-11-11 휴대폰 웹 확인 — 「검토 결과」).
 */

import { normalizeItems } from './formSchema.js';

const TAGS = ['select-field', 'radio-field', 'checkbox-field'];

function attr(attrs, name) {
    const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:'([^']*)'|"([^"]*)")`, 'i'));
    return m ? (m[1] ?? m[2]) : '';
}

function decodeEntities(text) {
    return text
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

/** HTML 에서 { 칸 이름: 원래 항목 배열 } */
export function htmlFieldItems(html) {
    const out = {};
    const re = new RegExp(`<(${TAGS.join('|')})\\b([^>]*)>`, 'gi');
    let m;
    while ((m = re.exec(String(html || '')))) {
        const attrs = m[2];
        const name = attr(attrs, 'name');
        const raw = attr(attrs, 'items');
        if (!name || !raw) continue;
        try {
            const parsed = JSON.parse(decodeEntities(raw));
            if (Array.isArray(parsed)) out[name] = parsed;
        } catch (_e) {
            // 읽을 수 없는 항목은 건너뛴다 — 칸은 그대로 남는다
        }
    }
    return out;
}

/** 항목이 빈 칸에 HTML 의 항목을 채운다(원본은 바꾸지 않는다). */
export function withHtmlItems(fields, html) {
    const items = htmlFieldItems(html);
    return (Array.isArray(fields) ? fields : []).map((f) => {
        if (f?.items?.length || !items[f?.key]) return f;
        return { ...f, items: normalizeItems(items[f.key]) };
    });
}
