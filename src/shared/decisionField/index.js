/**
 * 승인 · 반려처럼 「결정」을 고르는 칸.
 *
 * 고르는 칸(select-field)은 값이 비면 첫 항목을 골라 둔다. 결정 칸에서는 그러면 「제출」 한 번에 승인된다
 * (2026-11-11 휴대폰 점검 H6). 결정 칸은 미리 고르지 않고, 고르지 않은 채 제출하면 막는다.
 * 결정 칸: 항목 가운데 긍정(승인 · approve …)과 부정(반려 · reject …)이 함께 있는 칸.
 */

const POSITIVE = /^(approve|approved|accept|accepted|yes|ok|pass|승인|허가|합격|채택|동의|예)$/i;
const NEGATIVE = /^(reject|rejected|deny|denied|decline|no|fail|반려|거절|거부|불합격|기각|아니오)$/i;

function parseItems(items) {
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
        try {
            const parsed = JSON.parse(items);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

function words(item) {
    if (!item || typeof item !== 'object') return [String(item ?? '')];
    return [...Object.keys(item), ...Object.values(item)].map((v) => String(v ?? '').trim());
}

/** 항목 목록이 승인/반려 같은 결정인가 */
export function isDecisionItems(items) {
    const list = parseItems(items);
    const has = (re) => list.some((it) => words(it).some((w) => re.test(w)));
    return has(POSITIVE) && has(NEGATIVE);
}

/** 폼 HTML 의 결정 칸 [{ name, alias }] */
export function decisionFields(html) {
    const out = [];
    const re = /<select-field\b([^>]*)>/gi;
    const attr = (attrs, name) => {
        const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:'([^']*)'|"([^"]*)")`, 'i'));
        return m ? m[1] ?? m[2] : '';
    };
    let m;
    while ((m = re.exec(String(html || '')))) {
        const attrs = m[1];
        if (isDecisionItems(attr(attrs, 'items'))) out.push({ name: attr(attrs, 'name'), alias: attr(attrs, 'alias') || attr(attrs, 'name') });
    }
    return out.filter((f) => f.name);
}

/** 고르지 않은 결정 칸 */
export function missingDecisions(html, formData) {
    const data = formData || {};
    return decisionFields(html).filter((f) => {
        const v = data[f.name];
        return v === undefined || v === null || String(v).trim() === '';
    });
}
