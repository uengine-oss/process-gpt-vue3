/**
 * 업무(워크아이템)를 누가 다른 사람에게 넘길 수 있는가.
 *
 * 담당자 본인, 그 인스턴스를 시작한 사람, 관리자만 넘길 수 있다.
 * 같은 인스턴스의 다른 참여자는 남의 업무를 열어 볼 수는 있어도 담당자를 바꿀 수 없다.
 *
 * 시작자는 화면의 「시작자」 표시와 같은 기준 — 인스턴스에서 가장 먼저 시작된 업무의 담당자다
 * (인스턴스 표에 시작자 칸이 따로 없다).
 */

/** 담당자 값(쉼표로 여러 명일 수 있다)을 목록으로 */
export function endpointList(endpoint) {
    if (!endpoint) return [];
    return String(endpoint)
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
}

/** 인스턴스의 업무 목록에서 시작자(가장 먼저 시작된 업무의 담당자)를 찾는다. 없으면 null */
export function findStarterId(workList) {
    if (!Array.isArray(workList) || workList.length === 0) return null;
    const first = workList.reduce((earliest, current) => {
        if (!earliest.startDate) return current;
        if (!current.startDate) return earliest;
        return new Date(current.startDate) < new Date(earliest.startDate) ? current : earliest;
    });
    return endpointList(first.endpoint)[0] || null;
}

/**
 * @param {object} p
 * @param {string|null} p.uid        지금 사용자
 * @param {boolean} p.isAdmin        관리자 여부
 * @param {string|null} p.endpoint   업무의 담당자(쉼표 구분 가능)
 * @param {string|null} p.starterId  인스턴스 시작자
 * @param {boolean} p.completed      이미 끝난 업무인가
 */
export function canReassignWorkItem({ uid, isAdmin, endpoint, starterId, completed }) {
    if (completed) return false;
    if (isAdmin) return true;
    if (!uid) return false;
    if (endpointList(endpoint).includes(uid)) return true;
    return !!starterId && starterId === uid;
}
