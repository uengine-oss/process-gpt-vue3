/**
 * 승인 · 반려 같은 「결정」.
 *
 * 무엇이 결정 칸인지는 포털과 같은 규칙(@/shared/decisionField 의 isDecisionItems)으로 정한다 —
 * 항목 가운데 긍정(승인 · approve …)과 부정(반려 · reject …)이 함께 있는 고르는 칸.
 * 결정 칸은 미리 골라 두지 않는다. 휴대폰에서는 아래 두 단추(반려 · 승인)로만 정하고,
 * 반려는 의견이 있어야 한다.
 *
 * 끝난 단계의 결과(output)에서 "반려됐는가 · 왜" 를 읽어 다시 쓰는 사람과 다시 검토하는 사람에게 보여 준다.
 */

import { isDecisionItems } from '../../../src/shared/decisionField/index.js';

/** 하나의 값이 긍정인가 — 규칙을 두 곳에 두지 않으려고 isDecisionItems 에 부정 견본을 붙여 묻는다. */
export function isPositive(value) {
    return value !== null && value !== undefined && value !== '' && isDecisionItems([value, 'reject']) && !isDecisionItems([value, 'approve']);
}

/** 하나의 값이 부정인가 */
export function isNegative(value) {
    return value !== null && value !== undefined && value !== '' && isDecisionItems([value, 'approve']) && !isDecisionItems([value, 'reject']);
}

/** 고르는 칸이 결정 칸인가 (휴대폰 폼 칸: { type, items:[{value,label}] }) */
export function isDecisionField(field) {
    if (!field || field.readonly) return false;
    if (!['select', 'radio'].includes(field.type)) return false;
    return isDecisionItems(field.items || []);
}

/** 폼에서 결정 칸과 의견 칸. 결정 칸이 없으면 null */
export function decisionForm(fields) {
    const list = Array.isArray(fields) ? fields : [];
    const decision = list.find(isDecisionField);
    if (!decision) return null;
    const writable = list.filter((f) => f.key !== decision.key && !f.readonly && f.supported !== false);
    const comment =
        writable.find((f) => f.type === 'textarea') || writable.find((f) => ['text'].includes(f.type)) || null;
    const items = decision.items || [];
    const approve = items.find((it) => isPositive(it.value) || isPositive(it.label));
    const reject = items.find((it) => isNegative(it.value) || isNegative(it.label));
    return {
        decisionKey: decision.key,
        decisionLabel: decision.label,
        commentKey: comment ? comment.key : null,
        approveValue: approve ? approve.value : null,
        rejectValue: reject ? reject.value : null,
        // 결정 · 의견 말고 이 단계에서 따로 적어야 하는 칸
        others: writable.filter((f) => f !== comment)
    };
}

/**
 * 결정 단추가 눌릴 수 있는가.
 * 반려는 의견이 있어야 한다(받는 사람이 무엇을 고칠지 알아야 한다).
 */
export function canDecide(kind, comment) {
    if (kind === 'approve') return true;
    if (kind === 'reject') return String(comment || '').trim().length > 0;
    return false;
}

/** 제출할 값 — 결정 칸과 의견 칸만 바꾼다 */
export function decisionValues(form, kind, comment, base = {}) {
    if (!form) return { ...base };
    const out = { ...base, [form.decisionKey]: kind === 'approve' ? form.approveValue : form.rejectValue };
    if (form.commentKey) out[form.commentKey] = String(comment || '').trim();
    return out;
}

function leafValues(output, out = []) {
    if (output === null || output === undefined) return out;
    if (Array.isArray(output)) {
        output.forEach((v) => leafValues(v, out));
        return out;
    }
    if (typeof output === 'object') {
        Object.values(output).forEach((v) => leafValues(v, out));
        return out;
    }
    out.push(output);
    return out;
}

/** 끝난 단계의 결과에서 결정과 그 사유. 결정이 없으면 { decision: null } */
export function outputDecision(output) {
    const values = leafValues(output).filter((v) => typeof v === 'string' || typeof v === 'number');
    let decision = null;
    for (const v of values) {
        if (isNegative(v)) decision = 'reject';
        else if (isPositive(v) && decision !== 'reject') decision = 'approve';
    }
    if (!decision) return { decision: null, comment: '' };
    const comment = values
        .map((v) => String(v).trim())
        .filter((v) => v.length > 1 && !isNegative(v) && !isPositive(v))
        .sort((a, b) => b.length - a.length)[0] || '';
    return { decision, comment };
}

function timeOf(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
}

/**
 * 다시 열린 단계에 남은 지난번 결정.
 *
 * 엔진은 반복되는 단계(반려 → 다시 작성 → 다시 검토)를 새 행으로 만들지 않고 **같은 행을 다시 연다**
 * (status 가 IN_PROGRESS 로 돌아가고 output 은 지난번 값 그대로). 그래서 지난번 반려는 지금 열린 행의
 * output 에만 남아 있다 — 여기서 꺼내 이력 · 타임라인에 남긴다(지우지 않는다).
 */
export function priorRoundDecision(row) {
    if (!row || ['DONE', 'COMPLETED'].includes(String(row.status || '').toUpperCase())) return null;
    const d = outputDecision(row.output);
    if (!d.decision) return null;
    return { id: `${row.id}:prior`, activityId: row.activity_id || '', who: row.username || '', at: null, ...d };
}

function doneRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter((r) => ['DONE', 'COMPLETED'].includes(String(r?.status || '').toUpperCase()));
}

/**
 * 같은 단계(activity_id)에서 지난번에 내린 결정들 — 「11/10 1차 반려 — …」.
 * @param rows   그 건의 todolist 행들
 * @param current 지금 보고 있는 행
 */
export function decisionHistory(rows, current) {
    const activity = current?.activity_id;
    if (!activity) return [];
    const done = doneRows(rows)
        .filter((r) => r.id !== current.id && r.activity_id === activity)
        .map((r) => ({ id: r.id, at: r.end_date || r.updated_at || null, who: r.username || '', ...outputDecision(r.output) }))
        .filter((r) => r.decision)
        .sort((a, b) => timeOf(a.at) - timeOf(b.at));
    // 같은 행이 다시 열렸으면 그 행에 남은 지난번 결정이 가장 최근 회차다
    const self = (rows || []).find((r) => r.id === current.id) || current;
    const prior = priorRoundDecision(self);
    return [...done, ...(prior ? [prior] : [])].map((r, i) => ({ ...r, round: i + 1 }));
}

/**
 * 이 업무가 반려 때문에 다시 온 것인가 — 그 건에서 가장 최근에 끝난 결정이 반려면 그것.
 * 반려 사유를 할 일 카드와 업무 화면 맨 위에 보여 준다.
 */
export function lastRejection(rows, current) {
    const decided = doneRows(rows)
        .filter((r) => r.id !== current?.id)
        .map((r) => ({
            id: r.id,
            activityId: r.activity_id || '',
            at: r.end_date || r.updated_at || null,
            who: r.username || '',
            name: r.activity_name || '',
            ...outputDecision(r.output)
        }))
        .filter((r) => r.decision)
        .sort((a, b) => timeOf(a.at) - timeOf(b.at));
    const last = decided[decided.length - 1];
    if (!last || last.decision !== 'reject') return null;
    // 결정하는 단계 자신(다시 검토하는 사람)에게는 「반려됨」이 아니다 — 그쪽은 decisionHistory 로 본다.
    if (current?.activity_id && current.activity_id === last.activityId) return null;
    return last;
}
