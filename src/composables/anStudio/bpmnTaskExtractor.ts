/**
 * As-Is BPMN XML 에서 활동(Task/CallActivity/SubProcess) 목록을 추출.
 * AI 프롬프트에 정확한 활동명을 함께 전달해 파티셔닝/Gap 분석 품질을 높이는 용도.
 */

export interface ExtractedTask {
    id: string;
    name: string;
    type: string;
}

const ACTIVITY_RE = /Task$|^task$|callActivity|subProcess/;

export function extractTasksFromXml(xml: string): ExtractedTask[] {
    if (!xml) return [];
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return [];
        const out: ExtractedTask[] = [];
        const seen = new Set<string>();
        for (const el of Array.from(doc.getElementsByTagName('*'))) {
            const ln = el.localName || '';
            if (!ACTIVITY_RE.test(ln)) continue;
            const id = el.getAttribute('id') || '';
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const name = (el.getAttribute('name') || '').replace(/\s+/g, ' ').trim();
            out.push({ id, name: name || id, type: ln });
        }
        return out;
    } catch {
        return [];
    }
}

/** 활동명만 (빈 이름 제외) — 프롬프트 컨텍스트용. */
export function extractTaskNames(xml: string): string[] {
    return extractTasksFromXml(xml)
        .map((t) => t.name)
        .filter((n) => n && !/^(Activity|Task|Flow)_/.test(n));
}

// Task/CallActivity/SubProcess + 모든 Gateway + Start/End/Intermediate Event.
// (sequenceFlow, lane, process, collaboration 등 구조 요소는 제외)
const ISSUE_ELEMENT_RE = /Task$|^task$|callActivity|subProcess|Gateway$|Event$/;

/**
 * Gap 진단 대상이 되는 이슈 후보 요소(activity/gateway/event) 목록을 추출.
 * Gap→PI Flag 생성기가 LLM 에 "어떤 요소에 이슈가 있는지" 식별을 요청할 때 사용.
 */
export function extractIssueElementsFromXml(xml: string): ExtractedTask[] {
    if (!xml) return [];
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return [];
        const out: ExtractedTask[] = [];
        const seen = new Set<string>();
        for (const el of Array.from(doc.getElementsByTagName('*'))) {
            const ln = el.localName || '';
            if (!ISSUE_ELEMENT_RE.test(ln)) continue;
            const id = el.getAttribute('id') || '';
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const name = (el.getAttribute('name') || '').replace(/\s+/g, ' ').trim();
            out.push({ id, name: name || id, type: ln });
        }
        return out;
    } catch {
        return [];
    }
}
