/**
 * 할 일 · 진행 화면이 보여 줄 것을 todolist · bpm_proc_inst 행에서 만든다(화면 없이 시험할 수 있게 순수 함수로).
 *
 * 지킬 것
 *   - 「내 차례」는 지금 손댈 수 있는 업무만. 엔진은 갈 수 있는 뒤 단계를 모두 TODO 로 미리 만들어 둔다 —
 *     그것까지 세면 배타 게이트웨이의 두 가지(재작성 · 고객 발송)가 함께 내 일로 보인다.
 *     포털 받은 일 목록과 같은 상태 집합(SIMPLE_INBOX_ACTIONABLE_STATUSES)을 쓴다.
 *   - 에이전트에 맡긴 일은 「내 차례」 카드가 아니라 「에이전트에 맡긴 일」에 모은다(쓰는 중 · 초안 준비됨).
 *   - 반려 때문에 다시 온 업무는 카드에서 바로 반려 사유를 보여 준다.
 *   - 같은 단계가 반복돼도 행마다 따로 남긴다 — 지난 결과(반려 사유)를 지우지 않는다.
 */

import { SIMPLE_INBOX_ACTIONABLE_STATUSES } from '../../../src/shared/simpleInstanceInbox.js';
import { findStarterId } from '../../../src/utils/workItemAccess.js';
import { isPaused } from '../../../src/shared/hitlFeedback/index.js';
import { agentState } from './agentTask.js';
import { lastRejection, outputDecision, priorRoundDecision } from './decision.js';
import { formIdOf } from './outputs.js';
import { dueLabel, isOverdue } from './tasks.js';

const DONE = ['DONE', 'COMPLETED'];

function upper(v) {
    return (v || '').toString().trim().toUpperCase();
}

function timeOf(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
}

export function isDoneRow(row) {
    return DONE.includes(upper(row?.status));
}

export function isActionable(row) {
    return SIMPLE_INBOX_ACTIONABLE_STATUSES.has(upper(row?.status)) || SIMPLE_INBOX_ACTIONABLE_STATUSES.has(row?.status);
}

/** 미리 만들어 둔 뒤 단계(아직 차례가 오지 않음) */
export function isWaitingRow(row) {
    return upper(row?.status) === 'TODO';
}

export function assignedTo(row, uid) {
    const me = (uid || '').toString().trim();
    if (!me) return false;
    return String(row?.user_id || '')
        .split(',')
        .map((v) => v.trim())
        .includes(me);
}

/** 차례가 온 때. start_date 는 엔진이 예정일로 미리 채우기도 해서 실제 시작 시각을 먼저 본다. */
export function activeSince(row) {
    return row?.actual_start_date || row?.updated_at || row?.start_date || null;
}

/** 「영업 제안서 승인 한빛물산 대전 사무실 가구」 → 「한빛물산 대전 사무실 가구」 */
export function subjectOf(instanceName, processName) {
    const name = (instanceName || '').toString().trim();
    const proc = (processName || '').toString().trim();
    if (!name) return '';
    if (proc && name.startsWith(proc)) {
        const rest = name.slice(proc.length).replace(/^[\s·:\-–—]+/, '').trim();
        return rest || name;
    }
    return name;
}

function hasOutput(row) {
    const out = row?.output;
    if (!out || typeof out !== 'object') return false;
    return Object.values(out).some((v) => v && typeof v === 'object' && Object.values(v).some((x) => x !== '' && x !== null && x !== undefined));
}

/** 오늘 배정된 새 업무인가 — 아직 아무것도 적지 않았고 하루가 지나지 않았다 */
export function isNewTask(row, now = Date.now()) {
    const since = timeOf(activeSince(row));
    return since > 0 && now - since < 24 * 3600 * 1000 && !hasOutput(row);
}

/** 그 건이 몇 단계째인가 — 끝난 단계 수 + 1 / (끝난 + 지금 + 남은 것이 있으면 1) */
export function stepOf(row, instRows) {
    const rows = (instRows || []).filter((r) => r.proc_inst_id === row?.proc_inst_id);
    const done = rows.filter(isDoneRow).length;
    const active = rows.filter(isActionable).length;
    const waiting = rows.some(isWaitingRow) ? 1 : 0;
    const no = isDoneRow(row) ? done : done + 1;
    return { no, total: Math.max(no, done + active + waiting) };
}

/** 그 건의 진행: 끝난 단계 · 지금 단계 · 막대 비율 */
export function progressOf(instRows) {
    const rows = (instRows || []).filter((r) => upper(r.status) !== 'CANCELLED');
    const done = rows.filter(isDoneRow).length;
    const active = rows.filter(isActionable);
    const waiting = rows.some(isWaitingRow) ? 1 : 0;
    const total = Math.max(1, done + active.length + waiting);
    const current = active.sort((a, b) => timeOf(activeSince(a)) - timeOf(activeSince(b)))[0] || null;
    const rejections =
        rows.filter((r) => isDoneRow(r) && outputDecision(r.output).decision === 'reject').length +
        rows.filter((r) => priorRoundDecision(r)?.decision === 'reject').length;
    return {
        done,
        total,
        no: current ? done + 1 : done,
        percent: Math.round((done / total) * 100),
        current: current ? { id: current.id, name: current.activity_name || '', who: current.username || '', userId: current.user_id || '', due: current.due_date || null } : null,
        rejections
    };
}

/** 할 일 카드 하나 */
export function taskCard(row, ctx = {}) {
    const { instRows = [], instances = {}, defNames = {}, decisionFormIds = new Set(), now = Date.now() } = ctx;
    const process = defNames[row.proc_def_id] || '';
    const inst = instances[row.proc_inst_id] || null;
    const rejection = lastRejection(instRows.filter((r) => r.proc_inst_id === row.proc_inst_id), row);
    const approval = decisionFormIds.has(formIdOf(row));
    let badge = null;
    if (rejection) badge = 'rejected';
    else if (approval) badge = 'approval';
    else if (isNewTask(row, now)) badge = 'new';
    return {
        id: row.id,
        title: (row.activity_name || '').trim() || '이름 없는 업무',
        process,
        subject: subjectOf(inst?.proc_inst_name, process),
        instId: row.proc_inst_id || '',
        badge,
        approval,
        rejection,
        due: dueLabel(row.due_date, now),
        overdue: isOverdue(row.due_date, now),
        dueAt: row.due_date || null,
        since: activeSince(row),
        step: row.proc_inst_id ? stepOf(row, instRows) : null,
        agent: agentState(row)
    };
}

const BADGE_ORDER = { rejected: 0, approval: 1, new: 2 };

/** 급한 것 위로 — 반려된 것 → 승인 요청 → 마감 빠른 것 → 최근 배정 */
export function sortCards(cards) {
    return [...cards].sort((a, b) => {
        const ba = BADGE_ORDER[a.badge] ?? 3;
        const bb = BADGE_ORDER[b.badge] ?? 3;
        if (ba !== bb) return ba - bb;
        const da = timeOf(a.dueAt);
        const db = timeOf(b.dueAt);
        if (da && db && da !== db) return da - db;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return timeOf(b.since) - timeOf(a.since);
    });
}

const DELEGATED_TEXT = {
    running: '에이전트가 쓰는 중입니다',
    'draft-ready': '초안 준비됨 · 확인 후 제출해 주세요',
    failed: '처리하지 못했습니다 · 다시 맡기거나 직접 써 주세요'
};

/**
 * 할 일 첫 화면.
 * @param {object} p
 *   rows       내 todolist 행(아무 상태나)
 *   instRows   관련 건들의 모든 행
 *   instances  { proc_inst_id: bpm_proc_inst 행 }
 *   defNames   { proc_def_id: 이름 }
 *   decisionFormIds  결정 칸이 있는 폼 id
 */
export function homeModel({ rows = [], instRows = [], instances = {}, defNames = {}, decisionFormIds = new Set(), uid, now = Date.now() }) {
    const mine = rows.filter((r) => assignedTo(r, uid));
    const open = mine.filter(isActionable);
    const ctx = { instRows, instances, defNames, decisionFormIds, now };

    const turnRows = open.filter((r) => {
        const s = agentState(r);
        if (s === 'none') return true;
        // 그 자체가 에이전트 일인 업무는 나에게 물으며 멈췄을 때만 내 차례다
        return s === 'agent-only' && isPaused(r.output);
    });
    const turn = sortCards(turnRows.map((r) => taskCard(r, ctx)));

    const delegated = open
        .filter((r) => ['running', 'draft-ready', 'failed'].includes(agentState(r)))
        .map((r) => {
            const card = taskCard(r, ctx);
            return { ...card, state: card.agent, text: DELEGATED_TEXT[card.agent] || '' };
        })
        .sort((a, b) => (a.state === 'draft-ready' ? -1 : 0) - (b.state === 'draft-ready' ? -1 : 0));

    const requests = myRequests({ instRows, instances, defNames, uid });

    return {
        turn,
        approvals: turn.filter((c) => c.approval),
        delegated,
        requests,
        doneCount: mine.filter(isDoneRow).length
    };
}

/** 이 건을 내가 시작했는가 — 가장 먼저 시작된 단계의 담당자(포털 findStarterId 와 같은 규칙) */
export function startedBy(rows, uid) {
    if (!uid) return false;
    const starter = findStarterId(
        (rows || []).map((r) => ({ endpoint: r.user_id, startDate: r.actual_start_date || r.start_date }))
    );
    return starter === uid;
}

/** 내가 올린 요청 — 내가 시작했고 아직 진행 중이며 지금은 남의 차례인 건 */
export function myRequests({ instRows = [], instances = {}, defNames = {}, uid }) {
    const byInst = new Map();
    for (const r of instRows) {
        if (!r.proc_inst_id) continue;
        if (!byInst.has(r.proc_inst_id)) byInst.set(r.proc_inst_id, []);
        byInst.get(r.proc_inst_id).push(r);
    }
    const out = [];
    for (const [instId, rows] of byInst) {
        const inst = instances[instId];
        if (!inst || upper(inst.status) !== 'RUNNING') continue;
        if (!startedBy(rows, uid)) continue;
        if (rows.some((r) => isActionable(r) && assignedTo(r, uid))) continue;
        out.push(instanceCard(inst, rows, defNames, uid));
    }
    return out.sort((a, b) => timeOf(b.startedAt) - timeOf(a.startedAt));
}

const INSTANCE_STATUS = { RUNNING: '진행 중', COMPLETED: '완료', DONE: '완료', CANCELLED: '취소됨', STOPPED: '멈춤', FAILED: '실패' };

export function instanceStatusLabel(status) {
    return INSTANCE_STATUS[upper(status)] || '진행 중';
}

/** 진행 목록 · 내가 올린 요청의 카드 하나 */
export function instanceCard(inst, rows, defNames = {}, uid = '') {
    const process = defNames[inst?.proc_def_id] || '';
    const progress = progressOf(rows);
    return {
        instId: inst?.proc_inst_id || '',
        subject: subjectOf(inst?.proc_inst_name, process) || inst?.proc_inst_name || process || '진행 건',
        process,
        status: upper(inst?.status),
        statusLabel: instanceStatusLabel(inst?.status),
        startedAt: inst?.start_date || null,
        progress,
        mine: !!progress.current && assignedTo({ user_id: progress.current.userId }, uid),
        myTaskId: (rows || []).find((r) => isActionable(r) && assignedTo(r, uid))?.id || null
    };
}

/**
 * 진행 상황 타임라인.
 * 끝난 단계는 끝난 순서대로(결정이면 승인 · 반려와 그 사유까지), 지금 단계, 그 뒤 대기 단계를 한 줄로 묶는다.
 */
export function timelineModel(rows, uid) {
    const list = (rows || []).filter((r) => upper(r.status) !== 'CANCELLED');
    const done = list
        .filter(isDoneRow)
        .sort((a, b) => timeOf(a.end_date || a.updated_at) - timeOf(b.end_date || b.updated_at))
        .map((r) => {
            const d = outputDecision(r.output);
            return {
                id: r.id,
                name: r.activity_name || '이름 없는 단계',
                who: r.username || '',
                at: r.end_date || r.updated_at || null,
                state: d.decision === 'reject' ? 'rejected' : d.decision === 'approve' ? 'approved' : 'done',
                comment: d.decision ? d.comment : ''
            };
        });
    const current = list
        .filter(isActionable)
        .sort((a, b) => timeOf(activeSince(a)) - timeOf(activeSince(b)))
        .map((r) => ({
            id: r.id,
            name: r.activity_name || '이름 없는 단계',
            who: r.username || '',
            at: activeSince(r),
            state: 'current',
            mine: assignedTo(r, uid),
            due: r.due_date || null
        }));
    // 다시 열린 단계의 지난번 결정 — 그 결정으로 간 단계(gateway_decisions 의 target) 바로 앞에 둔다.
    const done2 = [...done];
    for (const r of list.filter(isActionable)) {
        const prior = priorRoundDecision(r);
        if (!prior) continue;
        const item = {
            id: prior.id,
            name: r.activity_name || '이름 없는 단계',
            who: r.username || '',
            at: null,
            state: prior.decision === 'reject' ? 'rejected' : 'approved',
            comment: prior.comment
        };
        const target = gatewayTarget(r);
        const at = target ? done2.findIndex((s) => list.find((x) => x.id === s.id)?.activity_id === target) : -1;
        if (at >= 0) done2.splice(at, 0, item);
        else done2.push(item);
    }
    const waitingRows = list.filter(isWaitingRow);
    const waiting = [];
    if (waitingRows.length) {
        const names = [...new Set(waitingRows.map((r) => r.activity_name).filter(Boolean))];
        const whos = [...new Set(waitingRows.map((r) => r.username).filter(Boolean))];
        waiting.push({ id: 'waiting', name: names.join(' · '), who: whos.join(' · '), state: 'waiting' });
    }
    return [...done2, ...current, ...waiting];
}

/** 이 행의 결정이 보낸 다음 단계 id(gateway_decisions 의 선택된 흐름) */
function gatewayTarget(row) {
    const gd = row?.gateway_decisions;
    if (!gd || typeof gd !== 'object') return '';
    for (const g of Object.values(gd)) {
        const selected = Array.isArray(g?.selected) ? g.selected : [];
        for (const key of selected) {
            const target = g?.sequences?.[key]?.target;
            if (target) return String(target);
        }
    }
    return '';
}

/** 끝난 단계들이 남긴 파일 — 산출물 */
export function fileOutputs(rows) {
    const out = [];
    const seen = new Set();
    const visit = (v, row) => {
        if (!v) return;
        if (Array.isArray(v)) return v.forEach((x) => visit(x, row));
        if (typeof v === 'object') {
            const url = v.url || v.publicUrl || v.public_url || v.path;
            const name = v.name || v.fileName || v.filename || v.originalName;
            if (typeof url === 'string' && /^(https?:)?\/\//.test(url) && !seen.has(url)) {
                seen.add(url);
                out.push({ name: name || url.split('/').pop(), url, who: row.username || '', at: row.end_date || null });
                return;
            }
            Object.values(v).forEach((x) => visit(x, row));
        }
    };
    for (const r of (rows || []).filter(isDoneRow)) visit(r.output, r);
    return out;
}
