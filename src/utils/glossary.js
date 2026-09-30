/**
 * 용어 정의 사전 순수 로직 — 스토어(stores/glossary.ts)와 통합 사전 페이지가 공유한다.
 * 같은 용어 판정은 trim + 대소문자 무시.
 */

export const glossaryTermKey = (term) =>
    String(term || '')
        .trim()
        .toLowerCase();

/** 통합 사전 뷰 — 같은 용어를 묶고, 그룹은 용어순·사용처는 프로세스명순으로 정렬 */
export function groupGlossaryTerms(terms) {
    const groups = new Map();
    for (const row of terms || []) {
        const key = glossaryTermKey(row?.term);
        if (!key) continue;
        const existing = groups.get(key);
        if (existing) {
            existing.usages.push(row);
        } else {
            groups.set(key, { key, term: String(row.term).trim(), usages: [row] });
        }
    }
    const list = Array.from(groups.values());
    for (const group of list) {
        group.usages.sort((a, b) =>
            String(a.proc_def_name || a.proc_def_id || '').localeCompare(String(b.proc_def_name || b.proc_def_id || ''))
        );
    }
    return list.sort((a, b) => a.term.localeCompare(b.term));
}

/** 재사용 자동완성 후보: 용어별 대표 1건 — 가장 최근 갱신 행의 정의를 프리필로 쓴다 */
export function pickReusableTerms(terms) {
    const byKey = new Map();
    for (const row of terms || []) {
        const key = glossaryTermKey(row?.term);
        if (!key) continue;
        const existing = byKey.get(key);
        if (!existing || String(row.updated_at || '') > String(existing.updated_at || '')) {
            byKey.set(key, row);
        }
    }
    return Array.from(byKey.values()).sort((a, b) => String(a.term).localeCompare(String(b.term)));
}
