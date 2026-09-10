/**
 * 대화에 늘 들어가는 가상 에이전트.
 *
 * 데이터베이스에 없는 참가자다. 방의 participants 에만 들어가고, 이 사람이
 * 있어야 "누가 답하는가" 가 정해진다. 없으면 방은 만들어지되 아무도 답하지 않는다.
 *
 * 포털과 모바일이 같은 값을 써야 한다. 다르면 앱에서 시작한 대화가 웹에서
 * 다른 참가자로 보이거나, 목록에서 아이콘이 비어 보인다.
 *
 * 여기(.js)에 두는 이유: 모바일 쪽 검증이 Node 에서 직접 이 파일을 읽는다.
 */

export const PROCESS_GPT_AGENT_ID = 'process-gpt-agent';

export const processGptAgent = {
    id: PROCESS_GPT_AGENT_ID,
    uid: PROCESS_GPT_AGENT_ID,
    email: null,
    username: 'Process GPT Agent',
    profile: '/images/chat-icon.png',
    agent_type: 'agent',
    is_agent: true,
    alias: 'processgpt'
};
