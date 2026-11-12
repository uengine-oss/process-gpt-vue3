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

/**
 * 채팅에서 「CLI 코딩 에이전트」를 고를 수 있게 할지(VITE_FF_CLI_AGENT_CHAT, 기본 끔).
 *
 * 화면과 서버는 준비됐지만 운영에 열지 않는다 — CLI 가 한 사람의 Claude 구독 토큰으로 돌고(약관상
 * 여러 사람이 나눠 쓸 수 없다), CLI 셸이 파드의 자격 증명을 물려받는 문제가 남았다(D-1111-10).
 * 회사 API 키 · 게이트웨이 가상 키로 바꾼 배포에서만 켠다. 이미 cliagents 로 시작한 방은 그대로 돈다.
 * 런타임(window._env_) → 빌드타임(import.meta.env) 순으로 읽는다(aiFeatureGate 와 같은 규칙, 단 기본은 끔).
 */
export function cliAgentChatEnabled(env = typeof window !== 'undefined' ? window._env_ : undefined) {
    const runtime = env?.VITE_FF_CLI_AGENT_CHAT;
    let build;
    try {
        build = import.meta.env?.VITE_FF_CLI_AGENT_CHAT;
    } catch (_e) {
        build = undefined;
    }
    const raw = runtime !== undefined && runtime !== '' ? runtime : build;
    return raw === true || raw === 'true';
}

/**
 * 새 대화에서 고를 수 있는 오케스트레이션(꺼진 것은 뺀다).
 *
 * `companyCliKey` — 회사 관리자가 CLI 에이전트 API 키를 하나라도 넣었으면(설정 › CLI 에이전트 API 키,
 * src/shared/cliAgentKeys 의 companyCliKeyConfigured) 플래그와 상관없이 「CLI 코딩 에이전트」를 연다.
 * 그 회사의 CLI 는 개인 구독 토큰이 아니라 회사 키로 돌기 때문에 위의 약관 문제가 없다(2026-11-11).
 */
export function selectableOrchestrations(env, { companyCliKey = false } = {}) {
    return ORCHESTRATIONS.filter((v) => v !== 'cliagents' || companyCliKey === true || cliAgentChatEnabled(env));
}
