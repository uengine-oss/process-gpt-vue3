/**
 * 에이전트가 무엇을 하고 있는지 실시간으로 보여 준다.
 *
 * 왜 필요한가
 *   프로세스 생성처럼 오래 걸리는 일은 워크아이템으로 넘어가 뒤에서 진행된다.
 *   그동안 화면에는 "처리하고 있습니다" 한 줄뿐이라, 사용자는 멈춘 것인지
 *   진행 중인지 알 수 없고 결과도 볼 수 없다.
 *
 *   포털은 `events` 표를 그 워크아이템(todo_id)으로 구독해 진행을 보여 준다
 *   (ChatRoomPage.subscribeToEventsForTask). 같은 표를 그대로 쓴다 — 앱만
 *   따로 만들면 서버가 보내는 것과 어긋난다.
 *
 * 실제로 오는 것
 *   task_started        [START] PDF2BPMN 변환 작업을 시작합니다...
 *   tool_usage_started  [FORM] 폼 생성 시작 (1/4): 휴가 신청 프로세스 / ...
 *   tool_usage_finished [FORM] 폼 저장 성공: 휴가 등록 (form_id=...)
 *   task_completed      (끝)
 */

const DONE_TYPES = ['task_completed', 'task_failed', 'task_cancelled'];

/**
 * 사람의 답을 기다리며 멈춘 상태.
 *
 * 프로세스 생성은 도중에 사용자에게 묻는다 —
 *   "[HITL] 사용자 확인 대기 중: 1개 프로세스의 스킬/에이전트/DMN 생성 결정"
 * 이때 화면이 계속 "처리하고 있습니다" 라고 하면, 사용자는 기다리기만 하고
 * 작업은 영원히 진행되지 않는다. 실제로 그랬다. 기다리는 쪽은 사람이다.
 */
const WAITING_TYPES = ['waiting_for_user'];

/** 대괄호 꼬리표는 단계 이름으로 쓰고, 본문에서는 뗀다. */
function splitTag(text) {
    const m = (text || '').match(/^\s*\[([^\]]{1,20})\]\s*([\s\S]*)$/);
    return m ? { tag: m[1].trim(), body: m[2].trim() } : { tag: '', body: (text || '').trim() };
}

/**
 * 이벤트 한 줄을 화면에 그릴 모양으로.
 *
 * 보여 줄 말이 없는 이벤트는 만들지 않는다 — 빈 줄이 쌓이면 무슨 일이
 * 벌어지는지 오히려 더 안 보인다.
 */
export function toFeedItem(row) {
    const type = (row?.event_type || '').toString();
    const raw = (row?.data?.message ?? row?.data?.msg ?? '').toString().trim();
    if (!raw) return null;

    const { tag, body } = splitTag(raw);
    // (form_id=...) 같은 내부 식별자는 사용자가 쓸 수 없는 값이다.
    // 좁은 화면에서 줄을 두 배로 늘리기만 한다.
    const clean = body.replace(/\s*\((?:form_id|task_id|id)=[^)]*\)/g, '').trim();
    return {
        id: `${row?.id ?? row?.seq ?? raw}`,
        seq: Number(row?.seq) || 0,
        tag,
        text: clean || body || raw,
        done: type === 'tool_usage_finished' || DONE_TYPES.includes(type),
        waiting: WAITING_TYPES.includes(type),
        failed: type === 'task_failed'
    };
}

/** 작업이 끝났는가. 끝나면 더 기다릴 이유가 없다. */
export function isFinished(row) {
    return DONE_TYPES.includes((row?.event_type || '').toString());
}

/** 사람의 답을 기다리는가. */
export function isWaitingForUser(row) {
    return WAITING_TYPES.includes((row?.event_type || '').toString());
}

/**
 * 지금 상태 한 줄. 기다리는 사람에게 필요한 것은 "누가 기다리는가" 다.
 *
 * @returns {'waiting'|'done'|'failed'|'running'}
 */
export function feedState(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let state = 'running';
    for (const row of list) {
        const type = (row?.event_type || '').toString();
        if (isWaitingForUser(row)) state = 'waiting';
        else if (type === 'task_failed') state = 'failed';
        else if (DONE_TYPES.includes(type)) state = state === 'waiting' ? 'waiting' : 'done';
    }
    return state;
}

/**
 * 이벤트들을 순서대로 세운다.
 *
 * 같은 이벤트가 두 번 올 수 있다(구독과 최초 조회가 겹칠 때). seq 로 하나만 남긴다.
 */
export function toFeed(rows) {
    const bySeq = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
        const item = toFeedItem(row);
        if (item) bySeq.set(item.id, item);
    }
    return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/** 방금 무엇을 하고 있는지 한 줄. 목록을 접어 둘 때 쓴다. */
export function latestText(feed) {
    const last = feed[feed.length - 1];
    return last ? last.text : '';
}
