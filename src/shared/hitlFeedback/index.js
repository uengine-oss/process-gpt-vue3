/**
 * 사람이 답해야 진행되는 작업(HITL)의 답변 기록과 재개 판단.
 *
 * 프로세스 생성(pdf2bpmn)은 도중에 멈추고 사람에게 묻는다.
 *   todolist.output.hitl_checkpoint.question_ids  물어본 것들
 *   todolist.output.hitl_feedbacks                답한 것들
 * 모든 물음에 답이 차면 `draft_status = 'FB_REQUESTED'` 로 바꿔야 워커가
 * 다시 깨어난다. 이 갱신이 없으면 작업은 영원히 멈춰 있는다 — 실제로 그랬다.
 *
 * 규칙을 여기 한 곳에 둔다. 웹과 앱이 각자 구현하면 한쪽에서만 재개된다.
 */

/** 문자열로 저장돼 오는 경우가 있다. 한쪽만 처리하면 답이 통째로 사라진다. */
export function parseOutput(output) {
    if (typeof output === 'string') {
        try {
            const parsed = JSON.parse(output);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_e) {
            return {};
        }
    }
    return output && typeof output === 'object' ? output : {};
}

/**
 * 물어본 것들의 식별자.
 *
 * `question_ids` 는 `{dmn: "id", agents: {...}, skills: {...}}` 처럼 중첩된다.
 * 값이 문자열인 것만 실제 물음이다.
 */
export function questionIds(output) {
    const root = parseOutput(output)?.hitl_checkpoint?.question_ids;
    const ids = [];

    const walk = (node) => {
        if (typeof node === 'string') {
            const id = node.trim();
            if (id) ids.push(id);
            return;
        }
        if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(root);

    return [...new Set(ids)];
}

/**
 * 이번 대기에 대한 답만 센다.
 *
 * 같은 작업이 여러 번 멈출 수 있어, 지난 대기 때의 답이 남아 있으면 묻지도
 * 않고 재개해 버린다. 대기 시작 시각보다 이른 답은 세지 않는다.
 */
export function answeredIds(output) {
    const parsed = parseOutput(output);
    const waitStarted = String(parsed?.hitl_checkpoint?.wait_started_at || '');
    const waitTs = waitStarted ? Date.parse(waitStarted) : NaN;
    const list = Array.isArray(parsed.hitl_feedbacks) ? parsed.hitl_feedbacks : [];

    const valid = list.filter((fb) => {
        if (!fb || typeof fb !== 'object') return false;
        const submitted = String(fb.submitted_at || '');
        if (waitStarted && submitted) {
            const subTs = Date.parse(submitted);
            if (!Number.isNaN(waitTs) && !Number.isNaN(subTs) && subTs < waitTs) return false;
        }
        return true;
    });

    return [...new Set(valid.map((fb) => String(fb.question_id || '').trim()).filter(Boolean))];
}

/** 아직 답하지 않은 물음. 화면이 무엇을 더 물어야 하는지 안다. */
export function unansweredIds(output) {
    const answered = new Set(answeredIds(output));
    return questionIds(output).filter((id) => !answered.has(id));
}

/** 다 답했는가. 그래야 워커를 깨운다. */
export function allAnswered(output) {
    const ids = questionIds(output);
    return ids.length > 0 && unansweredIds(output).length === 0;
}

/**
 * 답 하나를 기록한 새 output.
 *
 * 같은 물음에 다시 답하면 덮어쓴다 — 두 답이 남으면 어느 것이 진짜인지 알 수 없다.
 */
export function mergeFeedback(output, payload, at = new Date().toISOString()) {
    const parsed = { ...parseOutput(output) };
    const questionId = String(payload?.question_id || '').trim();
    if (!questionId) return parsed;

    const current = Array.isArray(parsed.hitl_feedbacks) ? parsed.hitl_feedbacks : [];
    const entry = { ...payload, question_id: questionId, submitted_at: at };

    parsed.hitl_feedbacks = [...current.filter((x) => x?.question_id !== questionId), entry];
    parsed.hitl_last_feedback = entry;
    return parsed;
}

/** 이 작업이 지금 사람을 기다리는가. */
export function isPaused(output) {
    return parseOutput(output).hitl_paused === true;
}

/**
 * 질문 카드에 보일 문구.
 *
 * SDK 에이전트(deepagents 등)는 질문을 `question` 에 담고, 다른 도구는 `text` 에
 * 담는다. 한쪽만 읽으면 질문 없는 빈 카드가 된다.
 */
export function humanQuestionText(data) {
    return String(data?.text || data?.question || '');
}

/**
 * 질문 카드에 답했을 때 작업을 다시 진행시키는 갱신. 그럴 필요가 없으면 null.
 *
 * 에이전트 실행이 질문을 남기고 끝난 작업은 `draft_status = 'HUMAN_ASKED'` 로
 * 멈춰 있다. 응답 이벤트만 남기면 아무도 다시 집지 않으므로, 답을 feedback 에
 * 붙이고 `FB_REQUESTED` 로 돌려야 워커가 이어서 실행한다. 실행 안에서 응답
 * 이벤트를 폴링하며 기다리는 도구는 `STARTED` 라 여기에 해당하지 않는다.
 */
export function resumePatchForAnswer(todo, answer, { userId = null, at = new Date().toISOString() } = {}) {
    if (todo?.draft_status !== 'HUMAN_ASKED') return null;

    let feedback = todo.feedback;
    if (typeof feedback === 'string') {
        try {
            feedback = JSON.parse(feedback);
        } catch (_e) {
            feedback = [];
        }
    }
    const existing = Array.isArray(feedback) ? feedback : [];

    return {
        feedback: [...existing, { time: at, content: String(answer), user_id: userId }],
        draft_status: 'FB_REQUESTED'
    };
}
