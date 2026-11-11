/**
 * 「에이전트에 맡기기」 한 번.
 *
 * 포털 업무 화면의 delegateToAgent → AgentMonitor.startTask 와 같은 값을 쓴다.
 * 어떤 방식으로 맡길지는 포털의 규칙(pickAgentDelegation)을 그대로 쓴다 —
 *   1) 이 업무에 정해 둔 방식 → 2) 이 사람이 지난번에 고른 방식 → 3) 딥 에이전트 · 초안
 * 담당자(user_id)는 바꾸지 않는다. 맡긴 뒤에도 내 업무이고, 초안이 오면 내가 확인해 제출한다.
 */

import {
    pickAgentDelegation,
    readLastAgentDelegation,
    rememberAgentDelegation
} from '../../../src/utils/agentDelegation.js';

/** 휴대폰에서는 「기본 LLM 빠른 생성」(포털의 default)을 쓸 수 없다. 그때는 딥 에이전트로 맡긴다. */
const MOBILE_FALLBACK = 'deepagents';

/** 업무에 지금 정해진 값 — 포털 WorkItem 의 selectedAgent 와 같은 모양 */
export function selectedOf(task) {
    return {
        agent: (task?.user_id || '').toString(),
        agentMode: (task?.agent_mode || 'none').toString().toLowerCase(),
        orchestration: task?.agent_orch || null
    };
}

/**
 * todolist 에 쓸 값.
 * @returns {{user_id: string, agent_mode: 'DRAFT'|'COMPLETE', status: 'IN_PROGRESS', agent_orch: string}}
 */
export function delegationPatch(task, last = readLastAgentDelegation()) {
    const choice = pickAgentDelegation({ selected: selectedOf(task), last });
    const orchestration = !choice.orchestration || choice.orchestration === 'default' ? MOBILE_FALLBACK : choice.orchestration;
    const mode = (choice.agentMode || 'draft').toString().toUpperCase();
    return {
        user_id: choice.agent || task?.user_id,
        agent_mode: mode === 'COMPLETE' ? 'COMPLETE' : 'DRAFT',
        status: 'IN_PROGRESS',
        agent_orch: orchestration
    };
}

/**
 * 맡긴다. 다음 「맡기기」 한 번은 이 방식으로 시작하도록 기억한다(포털과 같은 저장 칸).
 * @param {{ putWorkItem: Function }} backend  포털 데이터 계층
 */
export async function delegate(backend, task) {
    const patch = delegationPatch(task);
    await backend.putWorkItem(task.id, patch);
    rememberAgentDelegation({ orchestration: patch.agent_orch, agentMode: patch.agent_mode });
    return patch;
}
