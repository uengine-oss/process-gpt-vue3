/**
 * 프로세스를 시작할 때 만들 첫 업무 한 줄.
 *
 * 왜 따로 두는가
 *   이 안에는 화면마다 다시 쓰면 조용히 어긋나는 것들이 있다.
 *     - 허용되는 에이전트 방식 목록 (데이터베이스 enum 과 맞아야 한다)
 *     - 처음 상태값
 *     - 기한 계산 (분 단위 duration → 마감 시각)
 *
 *   어긋나면 어떻게 되는가: 새로 추가된 오케스트레이션을 모르는 쪽에서 시작하면
 *   그 값이 null 로 저장되고, 업무는 만들어지되 **에이전트가 붙지 않은 채로**
 *   남는다. 오류가 아니라 "왜인지 자동 처리가 안 되는 건" 이 되어 원인을 찾기 어렵다.
 *
 * 여기서 하지 않는 것
 *   역할 배정(bindRole), 인스턴스 만들기, 저장. 그것들은 부르는 쪽이 한다.
 *   이 파일은 값을 계산할 뿐이라 화면도 네트워크도 모른다.
 */

/** 데이터베이스 agent_mode enum 과 같아야 한다. */
export const AGENT_MODES = ['DRAFT', 'COMPLETE'];

/** 데이터베이스 agent_orch enum 과 같아야 한다. 여기에 없는 값은 버려진다. */
export const AGENT_ORCHESTRATIONS = [
    'crewai-action',
    'openai-deep-research',
    'crewai-deep-research',
    'deep-research-custom',
    'deepagents',
    'langchain-react',
    'browser-automation-agent',
    'a2a',
    'visionparse'
];

/** 시작하는 업무의 처음 상태. */
export const INITIAL_STATUS = 'IN_PROGRESS';

const MINUTE = 60 * 1000;

/** 'none' 이나 빈 값은 "지정 안 함" 이다. */
function chosen(value) {
    const v = (value || '').toString().trim();
    return v && v !== 'none' ? v : null;
}

/** 정의에 적힌 에이전트 방식이 데이터베이스가 아는 값인가. */
export function normalizeAgentMode(value) {
    const v = chosen(value);
    if (!v) return null;
    const upper = v.toUpperCase();
    return AGENT_MODES.includes(upper) ? upper : null;
}

export function normalizeAgentOrch(value) {
    const v = chosen(value);
    if (!v) return null;
    return AGENT_ORCHESTRATIONS.includes(v) ? v : null;
}

/** 에이전트에게 넘길 지시문. 설명과 지시를 한 덩어리로 만든다. */
export function buildQuery(activity) {
    return `[Description]\n${activity?.description ?? ''}\n\n[Instruction]\n${activity?.instruction ?? ''}`;
}

/**
 * 시작 업무 한 줄을 만든다.
 *
 * @param {object} activity  정의에서 고른 시작 액티비티
 * @param {object} ctx
 *   id        새 업무의 식별자 (부르는 쪽이 만든다)
 *   instId    인스턴스 식별자
 *   defId     프로세스 정의 식별자
 *   assignee  { id, name } 이 업무를 맡을 사람 또는 에이전트
 *   startedAt 시작 시각 (테스트에서 고정하기 위해 받는다)
 */
export function buildStartWorkItem(activity, { id, instId, defId, assignee, startedAt } = {}) {
    if (!activity) return null;

    const started = startedAt ? new Date(startedAt) : new Date();
    const minutes = Number(activity.duration) || 0;

    return {
        id,
        user_id: assignee?.id || null,
        username: assignee?.name || null,
        proc_inst_id: instId,
        root_proc_inst_id: instId,
        proc_def_id: defId,
        activity_id: activity.id,
        activity_name: activity.name,
        status: INITIAL_STATUS,
        tool: activity.tool || '',
        description: activity.description || '',
        query: buildQuery(activity),
        duration: minutes,
        start_date: started.toISOString(),
        due_date: new Date(started.getTime() + minutes * MINUTE).toISOString(),
        agent_mode: normalizeAgentMode(activity.agentMode),
        agent_orch: normalizeAgentOrch(activity.orchestration)
    };
}

/**
 * 이 업무를 사람이 아니라 에이전트가 맡는가.
 *
 * 에이전트 방식이 정해져 있고 실제 에이전트가 지정됐을 때만이다. 방식만 있고
 * 에이전트가 없으면 사람이 하는 것이다.
 */
export function runsAsAgent(activity) {
    return Boolean(normalizeAgentMode(activity?.agentMode)) && Boolean(chosen(activity?.agent));
}
