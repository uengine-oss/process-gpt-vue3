/**
 * Blueprint Studio AI 응답 파싱 유틸.
 * qdrantChat 은 자유형 텍스트(answer)를 반환하므로, 코드펜스/괄호 슬라이스/부분파서를
 * 단계적으로 적용해 JSON 또는 BPMN XML 을 안전하게 추출한다.
 */
import partialParse from 'partial-json-parser';

/** ```lang ... ``` 코드펜스 내용 추출 (없으면 null). */
export function extractFencedBlock(text, lang) {
    if (!text) return null;
    const src = String(text);
    const langPattern = lang ? lang : '[a-zA-Z]*';
    const re = new RegExp('```' + langPattern + '\\s*([\\s\\S]*?)```', 'i');
    const m = src.match(re);
    return m && m[1] ? m[1].trim() : null;
}

/** 텍스트에서 JSON(객체 또는 배열)을 관대하게 파싱. 실패 시 null. */
export function parseJsonLoose(text) {
    if (!text) return null;
    const candidates = [];

    const fenced = extractFencedBlock(text, 'json') || extractFencedBlock(text, '');
    if (fenced) candidates.push(fenced);
    candidates.push(String(text));

    // 첫 '[' ~ 마지막 ']' / 첫 '{' ~ 마지막 '}' 슬라이스
    const raw = String(text);
    const arrStart = raw.indexOf('[');
    const arrEnd = raw.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) candidates.push(raw.slice(arrStart, arrEnd + 1));
    const objStart = raw.indexOf('{');
    const objEnd = raw.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) candidates.push(raw.slice(objStart, objEnd + 1));

    for (const c of candidates) {
        try {
            return JSON.parse(c);
        } catch {
            /* try next */
        }
    }
    // 최후: 부분 JSON 파서 (스트리밍/불완전 응답 대비)
    for (const c of candidates) {
        try {
            const parsed = partialParse(c);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch {
            /* ignore */
        }
    }
    return null;
}

/** 텍스트에서 BPMN 2.0 XML 추출. 코드펜스(xml/없음) → <definitions> 슬라이스 순. */
export function extractBpmnXml(text) {
    if (!text) return '';
    const fenced = extractFencedBlock(text, 'xml') || extractFencedBlock(text, '');
    const tryExtract = (s) => {
        if (!s) return '';
        const str = String(s);
        // namespace prefix 가 있을 수 있으므로 localName 기준 매칭
        const startMatch = str.match(/<([a-zA-Z0-9]+:)?definitions[\s>]/);
        const endMatch = str.match(/<\/([a-zA-Z0-9]+:)?definitions>/);
        if (startMatch && endMatch) {
            const start = str.indexOf(startMatch[0]);
            const end = str.lastIndexOf(endMatch[0]) + endMatch[0].length;
            if (start !== -1 && end > start) return str.slice(start, end).trim();
        }
        return '';
    };
    return tryExtract(fenced) || tryExtract(text) || '';
}

/** qdrantChat 응답에서 텍스트 본문 추출 (answer / content / 문자열). */
export function readAnswerText(response) {
    if (!response) return '';
    if (typeof response === 'string') return response;
    return response.answer || response.content || response.text || response.message || '';
}

export function coerceArray(val) {
    if (Array.isArray(val)) return val;
    if (val && Array.isArray(val.solutions)) return val.solutions;
    if (val && Array.isArray(val.options)) return val.options;
    if (val && Array.isArray(val.items)) return val.items;
    if (val && typeof val === 'object') return [val];
    return [];
}
