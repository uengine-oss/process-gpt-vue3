# process-from-document-handoff Specification

## Purpose
외부 업무 시스템이 작성한 문서(업무 절차서 등)를 Process GPT 의 기존 프로세스 생성 기능으로 넘기는 진입점을 정한다.
워크아이템 화면 플러그인([workitem-app-handler](../workitem-app-handler/spec.md))과 함께, 업무 시스템이 Process GPT 코드에 의존을 만들지 않고 붙는 두 번째 통로다.
구현: `src/views/handoff/ProcessFromDocument.vue`, 라우트 `/process-from-document` (`src/router/MainRoutes.ts`).

## Requirements

### Requirement: 같은 출처 문서로 프로세스 생성 대화 시작
시스템은 `/process-from-document?source=<경로>&title=<프로세스 이름>&from=<보낸 시스템>` 으로 열리면 `source` 를 같은 출처에서 읽어 미리 보여 주고, 사용자가 '이 문서로 프로세스 생성'을 누르면 생성 대화방을 만들어 프로세스 생성 스킬을 SHALL 시작한다.
`source` 가 다른 출처이면 문서를 읽지 않고 오류를 보여야 MUST 한다. 문서는 앞 60,000자까지만 사용한다.
`auto=1` 이면 확인 없이 바로 시작할 수 있다.

#### Scenario: 업무 절차서를 넘겨 생성 시작
- **GIVEN** 업무 시스템이 같은 출처 `/ai/ws/teach/<세션>/document.md` 에 업무 절차서를 제공한다
- **WHEN** 사용자가 `/process-from-document?source=/ai/ws/teach/<세션>/document.md&title=반복 수주 처리&from=PriMES 학습 모드` 를 열고 '이 문서로 프로세스 생성'을 누른다
- **THEN** `chat_rooms` 에 `context.orchestration='deepagents'`, `context.identification.source='process-from-document'` 인 방이 만들어진다
- **AND** 문서 전문을 붙인 요청문이 사용자 메시지로 `chats` 에 저장된다
- **AND** `/chat?roomId=<방>&autosend=1` 로 이동해 프로세스 생성 스킬이 문서에서 흐름을 추출한다

#### Scenario: 다른 출처 문서
- **WHEN** `source` 가 `https://other.example/doc.md` 이다
- **THEN** '같은 출처의 문서만 받을 수 있습니다.' 오류를 보이고 대화방을 만들지 않는다

### Requirement: 붙여 넣은 본문을 문서로 다루게 하는 요청문
요청문은 첨부 파일이 없다는 것과 아래 본문이 문서라는 것을 밝히고, 문서를 `===== 업무 절차서 (붙여 넣은 문서) =====` 와 `===== 끝 =====` 사이에 넣어야 MUST 한다. 프로세스 이름은 `title` 로 지정해야 MUST 한다.

#### Scenario: 생성 스킬이 첨부 파일을 찾지 않는다
- **GIVEN** 요청문이 위 형식으로 저장되었다
- **WHEN** 프로세스 생성 스킬이 요청을 처리한다
- **THEN** 스킬은 첨부 검색 없이 붙여 넣은 본문으로 프로세스 초안을 제시한다
