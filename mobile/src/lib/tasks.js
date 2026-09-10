/**
 * 할 일 목록을 휴대폰에서 읽기 좋게 정리한다.
 *
 * 포털의 칸반은 상태별 열로 보여 준다. 휴대폰에는 열이 하나뿐이라 같은 방식이
 * 통하지 않는다. 대신 **지금 해야 하는 것을 위로** 올린다 — 목록을 스크롤하며
 * 급한 것을 찾게 하면 그게 바로 앱을 안 쓰게 되는 이유가 된다.
 */

import { runsByAgent, taskTitle } from './agentTask.js';
import { isPaused } from '../../../src/shared/hitlFeedback/index.js';

/** 아직 내 손이 필요한 상태. */
export const OPEN_STATUSES = ['TODO', 'NEW', 'IN_PROGRESS', 'PENDING', 'SUBMITTED', 'DELEGATED', 'DRAFT'];

/** 끝났거나 더 볼 것이 없는 상태. */
export const CLOSED_STATUSES = ['DONE', 'COMPLETED', 'CANCELLED'];

function statusOf(item) {
    return (item?.status || '').toString().toUpperCase();
}

/**
 * 이 업무가 **내 할 일** 인가.
 *
 * 에이전트가 대신 하는 업무(프로세스 생성 등)는 내가 할 일이 아니다.
 * 목록에 두면 "내가 처리해야 할 것" 이라는 목록의 뜻이 흐려진다.
 * 다만 그 작업이 **나에게 물어보며 멈춰 있으면** 그때는 내 차례다 —
 * 그것만 목록에 올린다.
 */
export function needsMe(item) {
    if (!runsByAgent(item?.task || item)) return true;
    return isPaused(item?.task?.output ?? item?.output);
}

export function isOpen(item) {
    const s = statusOf(item);
    // 모르는 상태는 열린 것으로 본다. 감추면 사용자는 할 일이 사라졌다고 느끼고,
    // 그 일이 어디 갔는지 앱 안에서는 찾을 방법이 없다.
    return !CLOSED_STATUSES.includes(s);
}

export function isDone(item) {
    return CLOSED_STATUSES.includes(statusOf(item));
}

function timeOf(value) {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}

/**
 * 급한 순서로 세운다.
 *
 *   1) 기한이 있는 것이 먼저, 그중 빠른 것부터 — 오늘 넘길 일이 맨 위여야 한다
 *   2) 기한이 없으면 최근에 움직인 것부터
 */
export function sortForMobile(items) {
    return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
        const da = timeOf(a?.dueDate);
        const db = timeOf(b?.dueDate);
        if (da !== null && db !== null) return da - db;
        if (da !== null) return -1;
        if (db !== null) return 1;
        return (timeOf(b?.updatedAt) || 0) - (timeOf(a?.updatedAt) || 0);
    });
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * 기한을 사람 말로.
 *
 * 날짜를 그대로 보여 주면 사용자가 매번 오늘이 며칠인지 계산해야 한다.
 * 지난 것은 특히 눈에 띄어야 한다.
 */
export function dueLabel(dueDate, now = Date.now()) {
    const due = timeOf(dueDate);
    if (due === null) return '';

    const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
    if (days === 0) return '오늘 마감';
    if (days === 1) return '내일';
    if (days === -1) return '어제 지남';
    if (days < 0) return `${Math.abs(days)}일 지남`;
    if (days <= 7) return `${days}일 뒤`;

    const d = new Date(due);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 기한이 지났는가. 화면에서 눈에 띄게 표시할 때 쓴다. */
export function isOverdue(dueDate, now = Date.now(), item = null) {
    // 끝난 업무는 아무리 오래됐어도 지연이 아니다. 완료 목록에 "188일 지남" 이
    // 빨갛게 뜨면 아직 할 일이 남은 것처럼 보인다 — 실제로 그렇게 보였다.
    if (item && isDone(item)) return false;

    const due = timeOf(dueDate);
    return due !== null && startOfDay(due) < startOfDay(now);
}

/**
 * 카드에 보여 줄 두 줄.
 *
 * 기준 시각을 받는다 — 안 받으면 "오늘 마감" 같은 표현이 실제 날짜에 따라
 * 달라져, 검증이 하루가 지나면 깨진다(실제로 겪었다).
 *
 * 첫 줄은 무엇을 하는지, 둘째 줄은 어느 건인지와 언제까지인지.
 * 이름이 비어 있는 워크아이템이 실제로 있어서 대체 문구가 필요하다.
 */
export function cardLines(item, now = Date.now()) {
    // 에이전트가 맡은 업무는 활동 이름이 내부 엔진 이름 그대로다(pdf2bpmn).
    // 목록에서도 사람이 아는 말로 보여야 한다.
    const title = taskTitle(item?.task || item, (item?.name || '').trim() || '이름 없는 업무');
    const parts = [];
    // todolist 에는 건 이름 칸이 없다(bpm_proc_inst 쪽에 있다). 대신 무슨 프로세스인지
    // 알 수 있는 정의 이름을 쓴다 — 확인해 보니 proc_inst_name 은 늘 비어 있었다.
    const process = (item?.defId || item?.task?.proc_def_id || '').toString().trim();
    if (process) parts.push(process);
    // 끝난 업무는 언제 끝났는지가 궁금하지, 기한이 궁금하지 않다.
    if (isDone(item)) {
        const ended = timeOf(item?.endDate ?? item?.task?.end_date);
        if (ended !== null) {
            const d = new Date(ended);
            parts.push(`${d.getMonth() + 1}월 ${d.getDate()}일 완료`);
        } else {
            parts.push('완료');
        }
        return { title, subtitle: parts.join(' · ') };
    }

    const due = dueLabel(item?.dueDate, now);
    if (due) parts.push(due);
    return { title, subtitle: parts.join(' · ') };
}


/**
 * 이 업무가 정말 내 것인가.
 *
 * `user_id` 는 콤마로 여러 명이 들어갈 수 있는 칸이다. 조회는 부분 일치(`like`)로
 * 하므로, 확인하지 않으면 내 식별자를 일부로 포함하는 남의 업무까지 목록에 뜬다.
 * 포털도 조회 뒤 같은 확인을 한다.
 */
export function assignedTo(item, userId) {
    const me = (userId || '').toString().trim();
    if (!me) return false;

    const raw = item?.endpoint ?? item?.task?.user_id ?? '';
    return raw
        .toString()
        .split(',')
        .map((v) => v.trim())
        .includes(me);
}
