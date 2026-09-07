/**
 * 에이전트가 맡은 업무를 사람에게 어떻게 보여 줄 것인가.
 *
 * 무엇이 문제였나
 *   프로세스 생성을 시키면 `pdf2bpmn` 이라는 업무가 만들어진다. 그 업무의
 *   `description` 에는 **에이전트에게 주는 지시문 전체**가 들어 있다.
 *     [Description] ... [Instruction] 1. ... [InputData] {"input_mode": ...}
 *   이것을 그대로 화면에 내면 사용자는 자기가 읽을 글이 아닌 것을 통째로 본다.
 *   게다가 입력 폼과 [완료로 제출] 이 함께 뜨니, 사람이 해야 할 일처럼 보인다.
 *   실제로는 에이전트가 뒤에서 처리 중이고 사람이 할 일은 기다리는 것뿐이다.
 */

/** 지시문에서 사람이 읽을 부분만. 뒤의 지시·입력데이터는 사용자의 것이 아니다. */
export function readableDescription(description) {
    const text = (description || '').toString();
    if (!text.trim()) return '';

    // [Description] 뒤부터 다음 대괄호 구획 전까지가 사람이 읽을 설명이다.
    const marked = text.match(/\[Description\]\s*([\s\S]*?)(?=\s*\[[A-Za-z]|$)/);
    if (marked) return marked[1].trim();

    // 구획이 없으면 원래 글이 곧 설명이다. 다만 뒤에 붙은 입력데이터는 뗀다.
    return text.split(/\[(?:Instruction|InputData|ExecutionPolicy)\]/)[0].trim();
}

/** 사람 대신 에이전트가 하는 업무인가. 그렇다면 입력 폼을 보여 줄 이유가 없다. */
export function runsByAgent(task) {
    return Boolean(task?.agent_orch || task?.agentOrch);
}

/** 사용자에게 보여 줄 업무 이름. `pdf2bpmn` 같은 내부 이름은 뜻이 없다. */
const ORCH_NAMES = {
    pdf2bpmn: '프로세스 생성',
    'crewai-deep-research': '심층 조사',
    deepagents: '심층 작업'
};

export function taskTitle(task, fallback = '업무') {
    const name = (task?.activity_name || task?.name || '').toString().trim();
    const orch = (task?.agent_orch || '').toString().trim();

    // 활동 이름이 내부 엔진 이름 그대로인 경우가 있다(pdf2bpmn).
    if (name && name !== orch) return name;
    return ORCH_NAMES[orch] || name || fallback;
}

const STATE_TEXT = {
    IN_PROGRESS: '에이전트가 처리하고 있습니다.',
    SUBMITTED: '에이전트가 처리하고 있습니다.',
    TODO: '곧 시작합니다.',
    PENDING: '곧 시작합니다.',
    DONE: '끝났습니다.',
    COMPLETED: '끝났습니다.',
    CANCELLED: '취소되었습니다.'
};

/** 지금 어떤 상태인지 한 문장. 기다리는 사람에게 필요한 것은 이것뿐이다. */
export function agentStatusText(task) {
    const status = (task?.status || '').toString().toUpperCase();
    return STATE_TEXT[status] || '진행 중입니다.';
}

/** 아직 진행 중인가. 그렇다면 화면이 스스로 다시 확인해야 한다. */
export function stillRunning(task) {
    const status = (task?.status || '').toString().toUpperCase();
    return status !== 'DONE' && status !== 'COMPLETED' && status !== 'CANCELLED';
}
