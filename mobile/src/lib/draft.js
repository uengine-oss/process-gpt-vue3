/**
 * 에이전트가 쓴 초안을 폼에 채우고, 사람이 읽을 요약을 만든다.
 *
 * 초안(todolist.draft)은 폼 id 로 감싼 값이다: { "<formId>": { proposal_title: …, … } }.
 * 딥 에이전트는 폼 값과 따로 요약(agent_summary) · 팀 구성(team_agent_ids)을 이벤트에 싣는다
 * (@/shared/agentSummary). 그 둘은 폼 값이 아니므로 채우지 않는다.
 */

import { latestAgentSummary, stripAgentMeta } from '../../../src/shared/agentSummary/index.js';

function parse(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (_e) {
        return null;
    }
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** 초안에서 이 폼의 값. 없으면 {} */
export function draftValues(task, formId) {
    const draft = parse(task?.draft);
    if (!isPlainObject(draft)) return {};
    let values = null;
    if (formId && isPlainObject(draft[formId])) values = draft[formId];
    else {
        const nested = Object.values(draft).filter(isPlainObject);
        values = nested.length === 1 && Object.keys(draft).length === 1 ? nested[0] : draft;
    }
    return stripAgentMeta({ ...values }) || {};
}

/** 폼에 채울 값만(폼에 있는 칸, 읽기 전용 아닌 칸). */
export function fillableDraft(fields, draft) {
    const out = {};
    for (const f of Array.isArray(fields) ? fields : []) {
        if (!f?.key || f.readonly || !f.supported) continue;
        if (!(f.key in (draft || {}))) continue;
        const v = draft[f.key];
        if (v === null || v === undefined || v === '') continue;
        out[f.key] = v;
    }
    return out;
}

/** 이미 사람이 무엇이든 적었는가 — 그렇다면 초안으로 덮어쓰지 않는다. */
export function hasUserInput(values) {
    return Object.values(values || {}).some((v) => {
        if (v === null || v === undefined || v === false) return false;
        if (typeof v === 'string') return v.trim() !== '';
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'object') return Object.keys(v).length > 0;
        return true;
    });
}

/** 요약 글을 몇 줄의 항목으로. 문단이면 문장 단위로 나눈다. */
export function summaryLines(summary, max = 4) {
    const text = (summary || '').toString().trim();
    if (!text) return [];
    let parts = text
        .split(/\n+/)
        .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
        .filter(Boolean);
    if (parts.length === 1) {
        parts = parts[0]
            .split(/(?<=[.!?。])\s+/)
            .map((l) => l.trim())
            .filter(Boolean);
    }
    return parts.slice(0, max);
}

/** 요약이 없을 때: 채운 값에서 앞 몇 칸을 한 줄씩. */
export function fallbackLines(fields, values, max = 3) {
    const lines = [];
    for (const f of Array.isArray(fields) ? fields : []) {
        const v = values?.[f.key];
        if (typeof v !== 'string' || !v.trim()) continue;
        const one = v.replace(/[─━=_-]{3,}/g, ' ').replace(/\s+/g, ' ').trim();
        if (!one) continue;
        lines.push(`${f.label}: ${one.length > 40 ? `${one.slice(0, 40)}…` : one}`);
        if (lines.length >= max) break;
    }
    return lines;
}

/** 팀 구성 결과 — 「함께 일할 에이전트: …」 첫 줄과 고른 에이전트 수. 없으면 null */
export function teamNote(events) {
    let found = null;
    for (const e of Array.isArray(events) ? events : []) {
        const d = parse(e?.data);
        if (e?.event_type !== 'task_completed' || !isPlainObject(d) || !Array.isArray(d.team_agent_ids)) continue;
        const first = typeof d.result === 'string' ? d.result.split('\n')[0].trim() : '';
        found = { text: first, count: d.team_agent_ids.length };
    }
    return found;
}

/** 이벤트에서 최근 요약 */
export function summaryOf(events) {
    return latestAgentSummary(events);
}
