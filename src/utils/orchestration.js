/**
 * 채팅 오케스트레이션(어느 에이전트 런타임으로 보낼지) 값의 단일 정의.
 *
 * 예전엔 곳곳에서 `=== 'deepagents' ? 'deepagents' : 'langchain-react'` 로 이진 정규화를 해서,
 * 값을 하나 더 추가하면 그 삼항식들이 조용히 새 값을 deepagents/langchain-react 로 뭉개버렸다.
 * 추가는 여기 목록 한 곳만 고치면 되도록 모은다.
 *
 * - langchain-react : 기본 에이전트 (gateway `/agent`)
 * - deepagents      : 딥 에이전트 (gateway `/process-gpt-deepagents`)
 * - codex           : 코덱스 (gateway `/process-gpt-codex`)
 * - cliagents       : CLI 코딩 에이전트 — Claude Code · Codex CLI (gateway `/process-gpt-cli-agent`)
 *                     어느 CLI 로 돌릴지는 요청 본문의 `agent_cli` 로 따로 싣는다(cliAgents.js).
 */
export const ORCHESTRATIONS = ['langchain-react', 'deepagents', 'codex', 'cliagents'];

/** 명시적 값이 없는 새 대화의 기본값. */
export const DEFAULT_ORCHESTRATION = 'deepagents';

/**
 * 오케스트레이션별 게이트웨이 경로.
 *
 * 포털(ChatRoomPage)과 휴대폰 웹(mobile/src/lib/agentChat.js)이 같은 표를 본다 —
 * 휴대폰 쪽에 따로 적어 두었더니 codex 가 빠진 채로 남아 코덱스 대화가 `/agent` 로 갔다.
 */
export const ORCHESTRATION_BASE_PATHS = {
    'langchain-react': '/agent',
    deepagents: '/process-gpt-deepagents',
    codex: '/process-gpt-codex',
    cliagents: '/process-gpt-cli-agent'
};

/** 알려진 값이면 그대로, 아니면 기본값으로. */
export function normalizeOrchestration(value) {
    const v = (value ?? '').toString().trim();
    return ORCHESTRATIONS.includes(v) ? v : DEFAULT_ORCHESTRATION;
}

/**
 * 이 오케스트레이션의 게이트웨이 경로. 모르는 값이면 null —
 * 모르는 값을 어디로 보낼지(기본값으로 바꿀지, `/agent` 로 보낼지)는 부르는 쪽이 정한다.
 */
export function basePathForOrchestration(value) {
    const v = (value ?? '').toString().trim();
    return Object.prototype.hasOwnProperty.call(ORCHESTRATION_BASE_PATHS, v) ? ORCHESTRATION_BASE_PATHS[v] : null;
}
