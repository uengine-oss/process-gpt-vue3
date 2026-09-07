/**
 * 이 건이 지금 어디까지 왔는가.
 *
 * 목록에 "진행 중" 이라고만 쓰면 사용자가 알 수 있는 것이 없다. 정작 궁금한 것은
 * **내 신청이 지금 누구 손에 있고 언제 끝나는가** 다.
 *
 * 그 답은 그 건에 속한 업무들(todolist)에 이미 들어 있다. 끝난 단계, 지금 하는
 * 단계, 아직 오지 않은 단계를 순서대로 세우면 그대로 진행 상황이 된다.
 */

const DONE = ['DONE', 'COMPLETED'];
const CANCELLED = ['CANCELLED'];
const WAITING = ['TODO', 'NEW', 'PENDING'];

function statusOf(item) {
    return (item?.status || '').toString().toUpperCase();
}

/** 한 단계가 어떤 상태인가. */
export function stepState(item) {
    const s = statusOf(item);
    if (DONE.includes(s)) return 'done';
    if (CANCELLED.includes(s)) return 'cancelled';
    if (WAITING.includes(s)) return 'waiting';
    return 'current'; // IN_PROGRESS · SUBMITTED · 그 밖의 모르는 상태
}

const STATE_LABEL = {
    done: '완료',
    current: '진행 중',
    waiting: '대기',
    cancelled: '취소됨'
};

export function stateLabel(state) {
    return STATE_LABEL[state] || state;
}

function timeOf(value) {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}

/**
 * 단계들을 시간 순으로 세운다.
 *
 * 시작 시각이 있는 것부터, 없으면 뒤로. 같은 시각이면 원래 순서를 지킨다 —
 * 흔들리면 화면을 새로 고칠 때마다 순서가 바뀌어 어디까지 봤는지 잃는다.
 */
export function toSteps(items) {
    return [...(Array.isArray(items) ? items : [])]
        .map((item, index) => ({
            id: item?.taskId || `step-${index}`,
            index,
            name: (item?.name || '').trim() || '이름 없는 단계',
            who: (item?.username || '').trim(),
            state: stepState(item),
            startedAt: item?.startDate || null,
            endedAt: item?.endDate || null,
            raw: item
        }))
        .sort((a, b) => {
            const ta = timeOf(a.startedAt);
            const tb = timeOf(b.startedAt);
            if (ta !== null && tb !== null && ta !== tb) return ta - tb;
            if (ta !== null && tb === null) return -1;
            if (ta === null && tb !== null) return 1;
            return a.index - b.index;
        });
}

/**
 * 한 줄 요약.
 *
 * "3/5 단계" 처럼 숫자로 보여 주면 훑기만 해도 얼마나 남았는지 안다.
 * 취소된 단계는 세지 않는다 — 진행률을 깎아 실제보다 덜 온 것처럼 보인다.
 */
export function summarize(steps) {
    const counted = steps.filter((s) => s.state !== 'cancelled');
    const done = counted.filter((s) => s.state === 'done').length;
    const current = steps.find((s) => s.state === 'current') || null;

    return {
        done,
        total: counted.length,
        current,
        text: counted.length ? `${done}/${counted.length} 단계` : '단계 없음',
        percent: counted.length ? Math.round((done / counted.length) * 100) : 0
    };
}

/**
 * 아직 안 끝난 첫 단계. "지금 여기까지 와 있다" 는 지점이다.
 *
 * 진행 중(IN_PROGRESS)만 찾지 않는다. 다음 사람에게 막 넘어가 아직 손대지 않은
 * 단계는 대기(TODO)로 남아 있는데, 그것도 분명히 "지금 그 사람 차례" 다.
 * 진행 중만 보면 그런 건이 "아무 데도 없는" 것처럼 보인다.
 */
export function activeStep(steps) {
    return steps.find((s) => s.state === 'current' || s.state === 'waiting') || null;
}

/**
 * 지금 누구 차례인가. 진행 현황에서 가장 자주 찾는 정보다 —
 * "내 신청이 누구한테 가 있나".
 *
 * 담당자를 모를 때 이름 자리에 "담당자 미정" 을 끼워 넣지 않는다.
 * "지금 담당자 미정 차례" 같은 말이 되어 읽히지 않는다. 대신 화면이 다른
 * 문장을 고를 수 있게 이름은 비워 둔다.
 */
export function currentHolder(steps) {
    const step = activeStep(steps);
    return step?.who || '';
}

/**
 * 지금 상태를 한 문장으로.
 *
 * 남은 단계가 없을 때 "진행 중인 단계가 없습니다" 라고만 하면 잘 끝난 건인지
 * 어디서 멈춘 건인지 알 수 없다. 다 끝난 것이면 끝났다고 말한다.
 */
export function holderText(steps) {
    const step = activeStep(steps);
    if (step) return step.who ? `지금 ${step.who} 차례` : '아직 담당자가 정해지지 않았습니다';

    const counted = (Array.isArray(steps) ? steps : []).filter((s) => s.state !== 'cancelled');
    if (counted.length && counted.every((s) => s.state === 'done')) return '모두 끝났습니다';
    return '진행 중인 단계가 없습니다';
}

/** 이 단계를 지금 처리할 수 있는가. 끝났거나 취소된 것은 아니다. */
export function isActionable(step) {
    return step?.state === 'current' || step?.state === 'waiting';
}
