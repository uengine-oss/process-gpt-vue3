/**
 * 새 대화 만들기.
 *
 * 포털의 메인 채팅과 같은 모양으로 만든다. 다르게 만들면 앱에서 시작한 대화가
 * 웹에서 안 보이거나, 참가자가 없어 에이전트가 답하지 않는다.
 *
 * 방 한 칸의 구성
 *   participants  나 + 가상 에이전트 두 명. 에이전트가 없으면 답할 사람이 없다.
 *   message       `{msg:'NEW'}` — 목록에서 "새 대화" 로 표시되는 표식이다.
 *   context       고른 에이전트(orchestration). 이 값으로 어느 엔진이 답할지 정해진다.
 */

// 별칭(@/) 대신 상대 경로. 이 파일은 검증에서 Node 가 직접 불러온다.
import { processGptAgent } from '../../../src/shared/processGptAgent.js';

/** 기본 에이전트. 포털의 메인 채팅과 같은 값을 쓴다. */
export const DEFAULT_ORCHESTRATION = 'langchain-react';

/**
 * 참가자 한 명을 방에 넣을 모양으로 맞춘다.
 *
 * 사용자 정보는 화면마다 키 이름이 달라서(id/uid, username/name) 그대로 넣으면
 * 어떤 방에서는 이름이 비어 보인다.
 */
export function toParticipant(person) {
    if (!person) return null;
    return {
        id: person.id || person.uid || null,
        email: person.email || null,
        username: person.username || person.name || person.email || '',
        profile: person.profile || null,
        agent_type: person.agent_type || person.agentType || null,
        is_agent: person.is_agent ?? person.isAgent ?? null
    };
}

/**
 * 새 방 한 칸을 만든다. 저장은 부르는 쪽이 한다.
 *
 * @param {object} me            로그인한 사람
 * @param {string} orchestration 고른 에이전트
 * @param {object} deps          { id, now } — 테스트에서 고정하기 위해 받는다
 */
export function buildRoom(me, orchestration, { id, now = new Date() } = {}) {
    const participant = toParticipant(me);
    if (!participant?.id) return null;

    const nowIso = now.toISOString();
    return {
        id,
        name: '새 대화',
        // 가상 에이전트는 데이터베이스에 없는 참가자다. 방에만 들어간다.
        participants: [participant, toParticipant(processGptAgent)],
        // 목록에서 "새 대화" 로 보이게 하는 표식.
        message: { msg: 'NEW', type: 'text', createdAt: nowIso },
        context: {
            orchestration: (orchestration || '').toString().trim() || DEFAULT_ORCHESTRATION,
            updatedAt: nowIso
        }
    };
}

/** 아직 아무 말도 오가지 않은 방인가. 목록에서 다르게 보여 준다. */
export function isEmptyRoom(room) {
    const raw = room?.message;
    const msg = typeof raw === 'string' ? raw : raw?.msg;
    return (msg || '').toString().trim().toUpperCase() === 'NEW';
}
