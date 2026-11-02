/**
 * 폼 생성 채팅의 진행 표시.
 *
 * 폼 디자이너 AI는 설명 없이 JSON(htmlOutput 또는 modifications)만 답한다. 그대로 보여주면
 * 코드가 흘러가는 화면이 되고, 추론 모델은 첫 토큰까지 수십 초가 걸려 그동안 화면이 멈춘 것처럼
 * 보였다. 그래서 받은 데까지의 문자열에서 "지금 무엇이 만들어지고 있는지"를 뽑아 보여준다.
 */
import { extractFields, normalizeFormRowLayout } from './formHtml.js';

// JSON 문자열 안의 HTML이라 따옴표가 \" 로 이스케이프돼 있을 수 있다
const ATTR = (name) => new RegExp(`\\b${name}=\\\\?(["'])(.*?)\\\\?\\1`);
const FIELD_TAG = /<([a-z][a-z0-9-]*-field)\b([^>]*)>/g; // 태그가 > 까지 다 온 것만

/** 받은 데까지의 응답에서 진행 상황을 뽑는다. */
export function describeFormStream(text) {
    const raw = String(text || '');
    if (!raw.trim()) return { phase: 'thinking', fields: [], rows: 0, edits: 0 };

    const fields = [];
    for (const match of raw.matchAll(FIELD_TAG)) {
        const attrs = match[2];
        const label = attrs.match(ATTR('alias'))?.[2] || attrs.match(ATTR('label'))?.[2] || attrs.match(ATTR('name'))?.[2];
        // 태그가 아직 다 오지 않아 이름을 모르면 셈하지 않는다
        if (label) fields.push(label);
    }
    const rows = (raw.match(/<row-layout\b/g) || []).length || (raw.match(/class=\\?["']row\\?["']/g) || []).length;
    const edits = (raw.match(/"action"\s*:\s*"/g) || []).length;
    return { phase: 'writing', fields, rows, edits };
}

/** 진행 말풍선(마크다운). */
export function formatFormProgress(progress, seconds) {
    if (progress.phase === 'thinking') {
        return (
            `⏳ **요청을 분석하고 폼을 설계하고 있습니다** · ${seconds}초\n\n` +
            `<small>모델이 생각하는 동안에는 글자가 나오지 않습니다. 작성을 시작하면 필드가 여기에 바로 표시됩니다.</small>`
        );
    }
    const parts = [`✍️ **폼을 작성하고 있습니다** · ${seconds}초`];
    const counts = [];
    if (progress.rows) counts.push(`행 ${progress.rows}개`);
    counts.push(`필드 ${progress.fields.length}개`);
    if (progress.edits) counts.push(`수정 ${progress.edits}건`);
    parts.push(counts.join(' · '));
    if (progress.fields.length) parts.push(progress.fields.map((label) => `\`${label}\``).join(' '));
    return parts.join('\n\n');
}

function flatFields(html, options) {
    const out = new Map();
    const visit = (list) =>
        list.forEach((field) => {
            if (field.type === 'row-layout' && field.fields) visit(field.fields);
            else out.set(field.key, field.text || field.key);
        });
    if (html) visit(extractFields(normalizeFormRowLayout(html, options), options));
    return out;
}

/** 무엇이 바뀌었는지 — 저장되는 필드 목록(fields_json 기준)으로 비교한다. */
export function summarizeFormChange(beforeHtml, afterHtml, options = {}) {
    const before = flatFields(beforeHtml, options);
    const after = flatFields(afterHtml, options);
    const added = [...after.keys()].filter((key) => !before.has(key)).map((key) => after.get(key));
    const removed = [...before.keys()].filter((key) => !after.has(key)).map((key) => before.get(key));
    const renamed = [...after.keys()]
        .filter((key) => before.has(key) && before.get(key) !== after.get(key))
        .map((key) => [before.get(key), after.get(key)]);
    return { added, removed, renamed, total: after.size, htmlChanged: (beforeHtml || '') !== (afterHtml || '') };
}

/** 완료 말풍선(마크다운). */
export function formatFormChange(change, seconds) {
    const fieldsChanged = change.added.length || change.removed.length || change.renamed.length;
    if (!fieldsChanged && !change.htmlChanged) {
        return `ℹ️ **바뀐 것이 없습니다** · ${seconds}초\n\n요청을 조금 더 구체적으로 적어 주세요.`;
    }
    const lines = [`✅ **${fieldsChanged ? '폼을 수정했습니다' : '배치·속성을 바꿨습니다'}** · ${seconds}초`];
    if (change.added.length) lines.push(`- 추가: ${change.added.map((t) => `\`${t}\``).join(', ')}`);
    if (change.removed.length) lines.push(`- 삭제: ${change.removed.map((t) => `\`${t}\``).join(', ')}`);
    if (change.renamed.length) lines.push(`- 이름 변경: ${change.renamed.map(([a, b]) => `\`${a}\` → \`${b}\``).join(', ')}`);
    if (!fieldsChanged) lines.push('- 필드 구성은 그대로입니다.');
    lines.push(`\n전체 필드 ${change.total}개 · 저장해야 반영됩니다.`);
    return lines.join('\n');
}
