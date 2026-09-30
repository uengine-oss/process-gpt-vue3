/**
 * 작업 중에 보낸 메시지를 **수정 지시**로 볼 것인가 — 그 규칙.
 *
 * 왜 여기 있는가
 *   에이전트가 일하는 중에 사용자가 메시지를 보내면, 지금까지는 그 턴을 **대체**했다.
 *   방향이 어긋난 것을 발견해 고쳐 말한 사람이, 그 대가로 지금까지 진행된 작업을 잃는다.
 *   수정 지시(스티어링)는 맥락을 유지한 채 지시만 바꿔 얹는다.
 *
 *   무엇을 수정 지시로 볼지는 화면(포털·모바일) 어디서나 같아야 한다. 갈라지면 한쪽에서는
 *   사람 확인 답변이 수정 지시로 가로채여 재개가 깨진다 — 그래서 규칙을 한 곳에 둔다.
 *
 * 무엇을 하지 않는가
 *   전송하지 않는다. HTTP 호출은 서비스(DeepAgentRouterService.steerStream)가 하고,
 *   화면 표시는 각 화면이 한다. 그래서 이 파일에는 Vue 도 fetch 도 없다.
 */

/** 채팅 요청 본문에 싣는 동작 유형. 없으면 서버는 종전대로 새 턴을 돌린다. */
export const STEER_ACTION = 'steer';

/** 서버가 내보내는 이벤트 두 개. 접수와 반영은 절대 같은 이벤트가 아니다. */
export const STEER_ACCEPTED_EVENT = 'steer_accepted';
export const STEER_APPLIED_EVENT = 'steer_applied';

/** 서버가 돌려주는 거절 사유. */
export const STEER_REASONS = {
    unsupported: 'unsupported',
    noActiveTurn: 'no_active_turn',
    awaitingHumanInput: 'awaiting_human_input',
    emptyMessage: 'empty_message'
};

/**
 * 이 메시지를 수정 지시로 보낼 것인가.
 *
 * 아래는 수정 지시가 아니다 —
 *   - 돌고 있는 턴이 없다: 평범한 새 메시지다.
 *   - 빈 본문: 보낼 지시가 없다.
 *   - 첨부(파일·이미지)가 있다: 수정 지시는 본문만 나른다. 첨부를 조용히 버리는 것보다
 *     새 턴으로 보내는 편이 낫다.
 *   - 사람 확인(HITL) 답변이다: 그 답변 자체가 이미 방향 전환이고, 멈춘 실행을 재개하는
 *     경로가 따로 있다. 이걸 수정 지시로 가로채면 재개가 깨져 대화가 멎는다.
 */
export function shouldSteerInsteadOfNewTurn({ hasActiveTurn = false, text = '', payload = null } = {}) {
    if (!hasActiveTurn) return false;
    if (!(text ?? '').toString().trim()) return false;

    const meta = (payload && typeof payload === 'object' && payload.metadata) || {};
    if (meta.run_state || meta.human_response_answer) return false;

    const files = Array.isArray(payload?.files) ? payload.files : [];
    const images = Array.isArray(payload?.images) ? payload.images : [];
    if (payload?.file || files.length > 0 || images.length > 0) return false;

    return true;
}
