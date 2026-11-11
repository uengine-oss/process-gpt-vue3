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

/** 사람 일을 맡는 것이 아니라 그 자체가 에이전트의 일인 업무(프로세스 생성 등). */
const AGENT_ONLY_ORCH = ['pdf2bpmn'];

function upper(value) {
    return (value || '').toString().trim().toUpperCase();
}

/** 그 자체가 에이전트의 일인가 — 사람이 채울 폼이 없다. */
export function isAgentOnly(task) {
    const orch = (task?.agent_orch || task?.agentOrch || '').toString().trim();
    if (!orch) return false;
    const name = (task?.activity_name || '').toString().trim();
    return AGENT_ONLY_ORCH.includes(orch) || name === orch;
}

/**
 * 에이전트와 얽힌 업무가 지금 어떤 상태인가.
 *
 *   none        에이전트가 손대지 않음 — 사람이 처리
 *   agent-only  그 자체가 에이전트의 일(프로세스 생성 등)
 *   running     사람이 「에이전트에 맡기기」 한 뒤 에이전트가 쓰는 중
 *   draft-ready 에이전트가 초안을 다 썼다 — **사람 차례**(확인하고 제출)
 *   failed · cancelled · done
 *
 * 예전에는 agent_orch 가 있기만 하면 "에이전트가 처리 중" 으로 보았다. 그러면 초안이 다 된
 * 업무(agent_mode=DRAFT, draft_status=COMPLETED)도 「에이전트가 처리하고 있습니다」 로 보여
 * 사람은 검토 · 제출할 길이 없었다(2026-11-11 휴대폰 웹 확인).
 */
export function agentState(task) {
    const orch = (task?.agent_orch || task?.agentOrch || '').toString().trim();
    if (!orch) return 'none';
    const status = upper(task?.status);
    if (status === 'DONE' || status === 'COMPLETED') return 'done';
    const draft = upper(task?.draft_status);
    if (draft === 'FAILED') return 'failed';
    if (draft === 'CANCELLED' || status === 'CANCELLED') return 'cancelled';
    if (isAgentOnly(task)) return 'agent-only';
    if (draft === 'COMPLETED') return 'draft-ready';
    return 'running'; // STARTED · FB_REQUESTED · 아직 집어 가지 않음
}

/** 사람 대신 에이전트가 하고 있는 업무인가. 그동안은 사람이 제출할 것이 없다. */
export function runsByAgent(task) {
    const state = agentState(task);
    return state === 'agent-only' || state === 'running';
}

/** 에이전트가 쓴 초안이 사람을 기다리는가. */
export function draftReady(task) {
    return agentState(task) === 'draft-ready';
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

/**
 * 에이전트 실행이 실패로 끝났는가.
 *
 * 실패는 `status` 가 아니라 `draft_status` 에 남는다. 업무 자체는 IN_PROGRESS
 * 그대로다. 그래서 status 만 보면 **실패한 일이 영원히 "처리하고 있습니다" 로
 * 보인다** — 사용자는 오지 않을 결과를 계속 기다린다. 운영에 그런 업무가
 * 117건 있었다.
 */
export function agentFailed(task) {
    return (task?.draft_status || '').toString().toUpperCase() === 'FAILED';
}

/** 지금 어떤 상태인지 한 문장. 기다리는 사람에게 필요한 것은 이것뿐이다. */
export function agentStatusText(task) {
    // 포털의 실행 화면과 같은 말을 쓴다. 같은 일을 두 곳이 다르게 말하면
    // 사용자는 둘 중 무엇을 믿어야 할지 모른다.
    if (agentFailed(task)) return '처리에 실패했습니다.';

    const draft = (task?.draft_status || '').toString().toUpperCase();
    if (draft === 'CANCELLED') return '취소되었습니다.';

    const status = (task?.status || '').toString().toUpperCase();
    return STATE_TEXT[status] || '진행 중입니다.';
}

/** 아직 진행 중인가. 그렇다면 화면이 스스로 다시 확인해야 한다. */
export function stillRunning(task) {
    // 실패하거나 취소된 것을 계속 "진행 중" 으로 두면 화면이 영원히 기다린다.
    const draft = (task?.draft_status || '').toString().toUpperCase();
    if (draft === 'FAILED' || draft === 'CANCELLED') return false;

    const status = (task?.status || '').toString().toUpperCase();
    return status !== 'DONE' && status !== 'COMPLETED' && status !== 'CANCELLED';
}
