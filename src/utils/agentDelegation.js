/**
 * 「에이전트에 맡기기」 한 번으로 어떤 방식으로 맡길지 정한다.
 *
 * 1. 이 업무(프로세스 정의)에 정해 둔 방식이 있으면 그대로
 * 2. 없으면 이 사람이 지난번에 고른 방식
 * 3. 그것도 없으면 딥 에이전트 · 초안
 *
 * 담당자(agent)는 바꾸지 않는다 — 지난번 선택에서 가져오는 것은 방식(orchestration · agentMode)뿐이다.
 * 다른 방식을 고르고 싶으면 「맡길 방식 고르기」로 탭에서 고른다.
 */

// 기본 오케스트레이션은 채팅과 같은 값을 쓴다 — 두 곳에 적어 두면 한쪽만 바뀐다.
import { DEFAULT_ORCHESTRATION } from './orchestration.js';

const DEFAULT_MODE = 'draft';

function activeMode(mode) {
    if (!mode) return null;
    const m = String(mode).toLowerCase();
    return m === 'none' ? null : m;
}

/**
 * @param {object} p
 * @param {{agent?: string, agentMode?: string, orchestration?: string|null}} p.selected 업무에 지금 정해진 값
 * @param {{agentMode?: string, orchestration?: string}|null} p.last 지난번 선택
 * @returns {{agent?: string, agentMode: string, orchestration: string}}
 */
export function pickAgentDelegation({ selected, last }) {
    const base = selected || {};
    if (base.orchestration && activeMode(base.agentMode)) {
        return { ...base, agentMode: activeMode(base.agentMode) };
    }
    if (last && last.orchestration) {
        return { ...base, orchestration: last.orchestration, agentMode: activeMode(last.agentMode) || DEFAULT_MODE };
    }
    return { ...base, orchestration: base.orchestration || DEFAULT_ORCHESTRATION, agentMode: activeMode(base.agentMode) || DEFAULT_MODE };
}

function storageKey() {
    let uid = '';
    try {
        uid = localStorage.getItem('uid') || '';
    } catch (e) {
        uid = '';
    }
    return `agentDelegation.last.${uid}`;
}

export function readLastAgentDelegation() {
    try {
        const raw = localStorage.getItem(storageKey());
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

export function rememberAgentDelegation({ orchestration, agentMode }) {
    if (!orchestration || orchestration === 'default') return;
    try {
        localStorage.setItem(storageKey(), JSON.stringify({ orchestration, agentMode: activeMode(agentMode) || DEFAULT_MODE }));
    } catch (e) {
        // 저장이 막힌 브라우저에서는 다음에도 기본값으로 시작한다
    }
}
