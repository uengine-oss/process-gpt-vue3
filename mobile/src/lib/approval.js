/**
 * 에이전트가 만든 초안에 사람이 답하는 일.
 *
 * 흐름
 *   에이전트가 초안(`draft`)을 만들고 멈춘다 → 사람이 본다 →
 *   그대로 두면 완료, 고칠 것이 있으면 의견을 남긴다.
 *
 * 의견을 남기면 `draft_status` 를 FB_REQUESTED 로 바꿔 워커를 다시 깨운다.
 * 이 값을 바꾸지 않으면 의견만 저장되고 에이전트는 영원히 멈춘 채로 남는다 —
 * 사용자에게는 "의견을 보냈는데 아무 일도 안 일어남" 으로 보인다.
 */

/** 이미 끝난 일에는 다시 깨울 것이 없다. */
const FINISHED = ['DONE', 'COMPLETED', 'CANCELLED'];

/**
 * 저장된 의견 기록을 배열로 읽는다.
 *
 * 컬럼에 배열이 그대로 있기도 하고 JSON 문자열로 있기도 하다. 한쪽만 가정하면
 * 다른 쪽에서 기존 기록을 통째로 날린다.
 */
export function parseFeedback(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_e) {
            return [];
        }
    }
    return [];
}

/**
 * 의견 하나를 덧붙인다. 기존 기록은 그대로 둔다.
 *
 * @param {any}    existing  todolist.feedback 컬럼 값
 * @param {string} text      사용자가 쓴 의견
 * @param {object} who       { userId, at }
 */
export function appendFeedback(existing, text, who = {}) {
    const content = (text || '').toString().trim();
    if (!content) return parseFeedback(existing);

    return [
        ...parseFeedback(existing),
        {
            time: who.at || new Date().toISOString(),
            content,
            user_id: who.userId || null
        }
    ];
}

/**
 * 의견을 보낼 때 todolist 에 쓸 내용.
 *
 * 끝난 일이면 워커를 깨우지 않는다. 깨우면 이미 완료된 건이 다시 진행 중으로
 * 돌아가고, 그 건을 처리한 사람에게는 되돌아온 것처럼 보인다.
 */
export function feedbackPatch({ existingFeedback, text, status, agentOrch = null, userId = null, at = null }) {
    const feedback = appendFeedback(existingFeedback, text, { userId, at });
    if (!feedback.length) return null; // 빈 의견은 보내지 않는다

    const patch = { feedback };
    if (agentOrch) patch.agent_orch = agentOrch;
    if (!FINISHED.includes((status || '').toString().toUpperCase())) {
        patch.draft_status = 'FB_REQUESTED';
    }
    return patch;
}

/** 이 업무에 사람이 봐야 할 초안이 있는가. */
export function hasDraft(item) {
    const draft = item?.task?.draft;
    if (!draft) return false;
    if (typeof draft === 'string') return draft.trim().length > 0;
    return Object.keys(draft).length > 0;
}

/**
 * 초안을 화면에 보여 줄 글로 바꾼다.
 *
 * 초안은 문자열일 때도 있고 구조화된 객체일 때도 있다. 객체를 그대로 찍으면
 * `[object Object]` 가 되어 아무것도 알 수 없다.
 */
export function draftText(item) {
    const draft = item?.task?.draft;
    if (!draft) return '';
    if (typeof draft === 'string') return draft;
    try {
        return JSON.stringify(draft, null, 2);
    } catch (_e) {
        return '';
    }
}
