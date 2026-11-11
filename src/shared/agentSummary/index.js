/**
 * 「에이전트에 맡기기」 결과의 요약과 팀 구성.
 *
 * 딥 에이전트는 폼 값과 따로, 작업 이벤트(task_completed)에 사람이 읽을 요약(agent_summary)과
 * 고른 전문 에이전트(team_agent_ids)를 싣는다. 요약은 결과 폼 위 안내 상자로 보여 주고,
 * 두 값 모두 폼 값이 아니므로 폼에 채우지 않는다.
 */

export const AGENT_META_KEYS = ['agent_summary', 'team_agent_ids'];

function dataOf(event) {
    const d = event?.data;
    if (d && typeof d === 'object') return d;
    if (typeof d === 'string') {
        try {
            const parsed = JSON.parse(d);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }
    return null;
}

/** 이벤트 목록에서 가장 최근 요약. 없으면 '' */
export function latestAgentSummary(events) {
    let best = null;
    for (const e of events || []) {
        if (e?.event_type !== 'task_completed') continue;
        const s = dataOf(e)?.agent_summary;
        if (typeof s !== 'string' || !s.trim()) continue;
        const t = new Date(e.timestamp || 0).getTime() || 0;
        if (!best || t >= best.t) best = { t, s: s.trim() };
    }
    return best ? best.s : '';
}

/** 폼에 채울 값에서 요약 · 팀 정보를 뺀다(원본은 바꾸지 않는다). */
export function stripAgentMeta(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    if (!AGENT_META_KEYS.some((k) => k in payload)) return payload;
    const out = { ...payload };
    AGENT_META_KEYS.forEach((k) => delete out[k]);
    return out;
}

/**
 * 에이전트가 만든 초안(todolist.draft)에서 폼 값을 꺼낸다 — 다시 열어도 초안이 보이게.
 * 초안은 { <폼 id>: { 칸: 값 } } 이거나 칸 값 그대로다. 요약 · 팀 정보는 뺀다. 꺼낼 값이 없으면 null.
 */
export function agentDraftValues(draft, formDefId) {
    let d = draft;
    if (typeof d === 'string') {
        try {
            d = JSON.parse(d);
        } catch (e) {
            return null;
        }
    }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    let values = d;
    if (formDefId && d[formDefId] && typeof d[formDefId] === 'object' && !Array.isArray(d[formDefId])) {
        values = d[formDefId];
    } else {
        const keys = Object.keys(d).filter((k) => !AGENT_META_KEYS.includes(k) && k !== '_summary');
        if (keys.length === 1 && d[keys[0]] && typeof d[keys[0]] === 'object' && !Array.isArray(d[keys[0]])) values = d[keys[0]];
    }
    const out = { ...stripAgentMeta(values) };
    delete out._summary;
    return Object.keys(out).length ? out : null;
}

