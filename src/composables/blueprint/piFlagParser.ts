/**
 * BPMN XML 안에 저장된 PI Flag(개선 코멘트)를 추출.
 *
 * PI Flag 은 task 요소의 extensionElements → uengine properties → JSON(`{ comments: [...] }`)
 * 형태로 저장된다 (PiFlagBoard.PI_FLAG_PROBE_TOKENS = ['uengine:Properties', '"comments"']).
 * 노이즈에 강하도록 extensionElements 텍스트에서 comments 배열만 괄호 매칭으로 슬라이스해 파싱한다.
 */

export interface ParsedFlag {
    elementId: string;
    elementName: string;
    commentId: string;
    status: string; // 'open'(향후 과제) | 'resolved'(즉시 개선)
    type: string;
    description: string;
    /** 제목 (신규 모델). 없으면 description 앞부분으로 폴백되지 않고 빈 문자열. */
    title: string;
    /** 문제점 (신규 모델). 없으면 description 폴백. */
    problem: string;
    /** 개선방향 (신규 모델). 없으면 빈 문자열. */
    improvement: string;
    /** 카테고리 (PROCESS|DATA|AUTOMATION 등). type 과 별개 분류. */
    category: string;
    /** "반영" 등 To-Be 반영 태그 여부 */
    reflected?: boolean;
    authorId?: string;
    authorName?: string;
    createdAt?: string;
}

/** 문자열에서 `"comments"` 키에 이어지는 JSON 배열을 괄호 깊이 매칭으로 추출. */
function sliceCommentsArrays(text: string): string[] {
    const out: string[] = [];
    if (!text) return out;
    let searchFrom = 0;
    while (searchFrom < text.length) {
        const keyIdx = text.indexOf('"comments"', searchFrom);
        if (keyIdx === -1) break;
        const bracketIdx = text.indexOf('[', keyIdx);
        if (bracketIdx === -1) break;
        let depth = 0;
        let end = -1;
        let inStr = false;
        let esc = false;
        for (let i = bracketIdx; i < text.length; i++) {
            const ch = text[i];
            if (inStr) {
                if (esc) esc = false;
                else if (ch === '\\') esc = true;
                else if (ch === '"') inStr = false;
                continue;
            }
            if (ch === '"') inStr = true;
            else if (ch === '[') depth++;
            else if (ch === ']') {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end === -1) break;
        out.push(text.slice(bracketIdx, end + 1));
        searchFrom = end + 1;
    }
    return out;
}

function safeParseArray(jsonText: string): any[] {
    try {
        const parsed = JSON.parse(jsonText);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function parseFlagsFromBpmn(xml: string): ParsedFlag[] {
    if (!xml || typeof xml !== 'string') return [];
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(xml, 'application/xml');
    } catch {
        return [];
    }
    if (doc.getElementsByTagName('parsererror').length > 0) return [];

    const flags: ParsedFlag[] = [];
    const seen = new Set<string>();
    const all = Array.from(doc.getElementsByTagName('*'));

    for (const el of all) {
        // extensionElements 를 가진 요소만 대상
        const ext = Array.from(el.children).find((c) => c.localName === 'extensionElements');
        if (!ext) continue;
        const id = el.getAttribute('id') || '';
        if (!id) continue;
        const name = el.getAttribute('name') || '';

        // 코멘트는 uengine:Properties 의 `json` **속성**(isAttr:true)에 저장된다.
        // 1) properties 요소의 json 속성 파싱(표준 형식), 2) 없으면 레거시 textContent 슬라이스.
        const commentObjs: any[] = [];
        for (const child of Array.from(ext.getElementsByTagName('*'))) {
            const ln = (child as Element).localName || '';
            if (ln.toLowerCase() !== 'properties') continue;
            const j = (child as Element).getAttribute('json');
            if (!j) continue;
            try {
                const obj = JSON.parse(j);
                if (obj && Array.isArray(obj.comments)) commentObjs.push(...obj.comments);
            } catch {
                /* malformed json 은 무시 */
            }
        }
        if (!commentObjs.length) {
            const text = ext.textContent || '';
            if (text.includes('comments')) {
                for (const arrText of sliceCommentsArrays(text)) commentObjs.push(...safeParseArray(arrText));
            }
        }
        if (!commentObjs.length) continue;

        for (const c of commentObjs) {
            if (!c || typeof c !== 'object') continue;
            const commentId = String(c.id || c.commentId || c.groupId || `${id}:${flags.length}`);
            const dedupeKey = `${id}::${commentId}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            const description = String(c.description || c.content || c.text || '');
            flags.push({
                elementId: id,
                elementName: name,
                commentId,
                status: String(c.status || 'open'),
                type: String(c.type || ''),
                description,
                // 신규 모델 필드 — 없으면 구버전 description 으로 폴백
                title: String(c.title || ''),
                problem: String(c.problem || description || ''),
                improvement: String(c.improvement || ''),
                category: String(c.category || ''),
                reflected: c.reflected === true || c.status === 'reflected',
                authorId: c.authorId != null ? String(c.authorId) : undefined,
                authorName: c.authorName != null ? String(c.authorName) : undefined,
                createdAt: c.createdAt != null ? String(c.createdAt) : undefined
            });
        }
    }
    return flags;
}
