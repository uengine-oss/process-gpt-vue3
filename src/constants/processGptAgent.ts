/**
 * 가상 에이전트 상수.
 *
 * 실제 정의는 @/shared 에 있다 — 모바일 화면도 같은 값을 써야 하는데, 그쪽 검증은
 * Node 가 파일을 직접 읽으므로 TypeScript 파일을 읽을 수 없다.
 * 기존 임포트 경로를 그대로 쓸 수 있도록 여기서 다시 내보낸다.
 */
export { PROCESS_GPT_AGENT_ID, processGptAgent } from '@/shared/processGptAgent.js';
