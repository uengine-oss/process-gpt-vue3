# Handover-driven process identification

## Why

업무는 상당 부분 `/chat` 대화창에서 처리된다. 에이전트와 함께 산출물까지 만들지만,
**"이 다음은 누가 무엇을 하는가"가 시스템에 전혀 남지 않는다.** 대화창에는 사람에게
일을 넘기는 수단 자체가 없었다(`ChatRoomPage.vue` 에 `todolist` INSERT 가 한 줄도 없다).
기존 `위임하기`는 *같은 작업의 재할당*이지 *다음 단계로의 인계*가 아니다.

그 결과 조직에서 반복적으로 수행되는 업무인데도 프로세스 정의가 없는 영역이 남는다.
이는 **기존 프로세스를 고치는 개선(improvement)이 아니라, 아직 정의조차 없는 업무를
찾아내는 식별(identification)** 문제다. 리뷰 보드(`/review-board`)는 이미 정의된
프로세스의 승인 라이프사이클을 다루므로 이 문제를 담지 못한다.

## What Changes

1. **대화창 인계(handover)** — `/chat` 컴포저에 `인계하기`를 추가한다. 이 방의 산출물을
   골라 다음 담당자(사람 또는 AI 에이전트)에게 넘기면 수신자 방·할 일이 생기고,
   인계 사실이 이벤트로 기록된다.
2. **암묵적 에이전트 위임 추적** — 버튼을 누르지 않아도 에이전트에게 일이 넘어가는
   순간(초대·라우팅)을 자동 기록한다. 이것이 없으면 도출 결과에서 자동화된 단계가
   통째로 빠진다.
3. **스레드 상관** — 이메일의 References 처럼 `origin_room_id` 를 인계받는 방으로
   전파해, 여러 방·여러 담당자를 거친 인계가 한 묶음으로 모인다.
4. **프로세스 식별 화면** — 사이드바 `프로세스 식별`(`/mining/handover`). 쌓인 인계
   기록을 스레드로 묶어 보여주고, 반복되는 흐름에서 프로세스를 도출해 **기존 BPMN
   모델러**로 렌더한다. 도출 결과는 **새 프로세스 제안(PR)** 으로 등록된다.
5. **process-miner 서비스** — 결정론적 DFG + Inductive Miner. LLM 을 쓰지 않으며,
   트리에서 변환하므로 교착·도달 불가 노드가 구조적으로 생길 수 없다.

## Impact

- Affected specs: `chat-work-handover` (new), `process-identification` (new)
- Affected code:
  - `src/components/chat/HandoverDialog.vue` (new), `UnifiedChatInput.vue` (slot passthrough)
  - `src/views/chat/ChatRoomPage.vue` (button, artifact collection, delegation hooks)
  - `src/components/api/ProcessGPTBackend.ts` (`createChatHandover`, `recordAgentDelegation`,
    `completeAgentDelegation`, `resolveOriginRoomId`, `getHandoverThread`)
  - `src/views/mining/HandoverMining.vue` (new), `src/utils/processMiner.ts` (new)
  - `layouts/full/vertical-sidebar/VerticalSidebar.vue` (menu entry)
  - DB: `public.handover_events` (new table), `resource_pull_requests` 재사용
  - Service: `services/process-miner` (new, FastAPI)

## Non-goals

- 조직도 재계산 제안(조직 마이닝)은 이번 범위 밖이다. 핸드오버 매트릭스와 자동화율은
  `/network` 로 계산하지만 조직도 변경은 제안하지 않는다.
- 외부 이메일·그룹웨어 커넥터는 범위 밖이다.
- 도출된 활동명의 LLM 정규화(labeling)는 아직 없다. 그래서 라벨이 없는 암묵 위임은
  제어 흐름 도출에서 제외된다(아래 스펙 참조).
