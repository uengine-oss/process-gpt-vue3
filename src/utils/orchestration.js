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
 */
export const ORCHESTRATIONS = ['langchain-react', 'deepagents', 'codex'];

/** 명시적 값이 없는 새 대화의 기본값. */
export const DEFAULT_ORCHESTRATION = 'deepagents';

/** 알려진 값이면 그대로, 아니면 기본값으로. */
export function normalizeOrchestration(value) {
    const v = (value ?? '').toString().trim();
    return ORCHESTRATIONS.includes(v) ? v : DEFAULT_ORCHESTRATION;
}
