# Feature Specification: 온톨로지 근거 에이전트 판단 (전략·KPI 우선순위·상충 → 선택 또는 사용자 입력 요청)

**Feature Branch**: `018-ontology-agent-decision`

**Created**: 2026-10-20

**Status**: Done

**Input**: User description:
"1. 프로세스 순서도는 PAL에서 사용되는 구조임. 기존 BPM모드를 확인해. 2. 기존 BPM모드로 사용 가능해야함.
의도: Ontology 기능의 고도화. Ontology화 된 데이터를 이용하여 프로세스 실행 중 Agent가 판단하는 근거가 될 수 있다.
인수조건: 전체 데모 시나리오(유형 별) — 1. 정상적으로 전략 및 KPI에 따른 진행 / 2. 2가지 이상의 상충 된 전략 및 KPI로
인한 판단이 필요한 경우 — 2.1 전략 및 KPI에 우선순위 설정하여 Agent에서 전략 및 KPI 선택하여 진행, 2.2 해당 Task에서
Agent가 유저 Input을 요청 받아 처리 진행. 각 데모 유형 별 테스트 진행 문서 및 설명 영상."

## 배경 · 범위

- **화면은 기존(일반) BPM 모드** — `:8081`(`npm run dev:bpm`, `VITE_PAL_MODE=false`, `$mode='ProcessGPT'`). `/process-hierarchy`
  (프로세스 순서도·계층)는 PAL 구조라 쓰지 않는다. 일반 모드의 실행 경로는
  **정의 지도(`/definition-map`) → 프로세스 상세(`/definition-map/sub/<id>`) → '실행' → 시작 폼(ProcessGPTExecute)
  → 인스턴스(`/instancelist/<id>`) → 업무(`/todolist/<taskId>`)** 이다.
- **에이전트 실행기는 실행 엔진 폴링 서비스의 서비스 태스크(MCP 도구 + ReAct)** — 로컬에 외부 에이전트 워커(deepagents 등)는
  없다. 에이전트는 테넌트 MCP 서버 `strategy-ontology`(전략 서비스 `:8014/mcp`)로 온톨로지를 조회한다(017 과 같은 경로).
- 사용자 입력 요청은 이미 있는 **이벤트(`events`) 기반 질문·응답 UI**(업무 화면 '에이전트에 맡기기' 탭의 `human_asked` 카드 →
  `human_response`)를 재사용한다. 엔진 MCP 경로에는 이 루프가 없어 새로 붙인다.
- PAL 화면 동작은 바꾸지 않는다(전략 보드·익스플로러는 원래 모든 모드 공용).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 정상: 전략·KPI 에 맞춰 에이전트가 판단하고 진행 (Priority: P1)

업무 담당자가 일반 BPM 모드에서 프로세스를 실행하면, 에이전트 단계가 온톨로지에서 "이 업무를 지배하는 전략·KPI"(목표·현재값·
방향·우선순위)를 조회해 그 기준으로 판단(예: 공급사 선택)을 내리고, 근거(어떤 전략·KPI 를 따랐는지)를 보고서로 남긴 뒤 다음
사람 단계로 넘어간다.

**Why this priority**: 온톨로지가 실행 중 판단의 근거가 된다는 의도의 최소 단위.

**Independent Test**: 시나리오 1 프로세스를 실행해 에이전트 단계가 DONE, 보고서에 지배 KPI 이름·목표·현재값과 선택 근거가
있고 '상충 없음'으로 기록되며 다음 단계가 담당자에게 진행 중으로 온다.

**Acceptance Scenarios**:

1. **Given** KPI 가 연결된(상충 없음) 데모 프로세스, **When** 정의 지도 → 상세 → 실행 → 요청 입력 → 제출,
   **Then** 에이전트 단계가 `ontology_decision_context` 를 호출하고, 결정 모드 `aligned` 로 보고서(판단·근거 KPI)를 남긴다.
2. **Given** 1 의 완료, **When** 업무 화면을 연다, **Then** 에이전트 보고서가 읽히고 다음 사람 단계가 IN_PROGRESS 다.

### User Story 2 - 상충 + 우선순위 설정: 에이전트가 우선순위로 선택해 진행 (Priority: P1)

관리자가 전략 보드에서 서로 상충하는 두 KPI(예: 구매 단가 절감률 ↔ 긴급 납기 준수율)를 '상충'으로 연결하고 우선순위를 정해 두면,
에이전트는 상충을 인지하고 우선순위가 높은 쪽을 택해 진행하며, 어떤 KPI 를 왜 택했고 무엇을 포기했는지 보고한다.

**Why this priority**: 인수조건 2.1.

**Independent Test**: 시나리오 2.1 프로세스 실행 → 에이전트 단계 결정 모드 `priority`, 선택 KPI = 우선순위 1, 보고서에
상충 KPI 둘과 선택·포기 근거가 있고 사용자에게 묻지 않고 DONE.

**Acceptance Scenarios**:

1. **Given** 전략 보드 KPI 편집 대화상자에 '우선순위'와 '상충 KPI' 입력, **When** 저장, **Then** 그래프에 KPI.priority 와
   KPI↔KPI `CONFLICTS_WITH` 관계가 생기고 익스플로러·스키마에 보인다.
2. **Given** 상충 KPI 두 개에 서로 다른 우선순위, **When** 프로세스 실행, **Then** 에이전트가 우선순위가 높은 KPI 를 택한다.
3. **When** 우선순위를 뒤바꿔 다시 실행, **Then** 반대 KPI 를 택한다(판단이 온톨로지 설정을 따른다는 증거).

### User Story 3 - 상충 + 우선순위 없음/동률: 에이전트가 사용자 입력을 요청해 처리 (Priority: P1)

상충 KPI 의 우선순위가 정해지지 않았거나 같으면, 에이전트 단계는 스스로 정하지 않고 업무 화면에 "어느 기준을 따를지" 선택
질문을 남기고 멈춘다. 담당자가 '에이전트에 맡기기' 탭에서 답하면 에이전트가 그 답을 근거로 이어서 처리하고 DONE 이 된다.

**Why this priority**: 인수조건 2.2.

**Independent Test**: 시나리오 2.2 실행 → 에이전트 단계가 PENDING(사용자 입력 대기) + 질문 카드(선택지 = 상충 KPI) →
선택·확인 → 1 폴링 주기 안에 재개되어 DONE, 보고서에 사용자 선택이 근거로 남는다.

**Acceptance Scenarios**:

1. **Given** 상충 KPI 동률, **When** 실행, **Then** `events` 에 `human_asked`(type=select, 선택지 ≥2) 가 생기고 업무 상태 PENDING,
   로그 "사용자 입력 대기".
2. **Given** 질문 카드, **When** 담당자가 하나를 골라 확인, **Then** `human_response` 가 기록되고 엔진이 다시 실행해 DONE,
   다음 단계 진행.
3. **Given** 질문에 '거절'(취소), **Then** 에이전트는 판단을 보류한 보고서로 마치고 다음 사람 단계에서 사람이 결정하게 넘긴다.

### User Story 4 - 유형별 테스트 진행 문서 · 설명 영상 (Priority: P2)

시나리오 1 / 2.1 / 2.2 각각 따라 할 수 있는 테스트 진행 문서(스크린샷)와 설명 영상(한국어 나레이션·자막).

**Independent Test**: `docs/manuals/ontology-agent-decision.md` + 시나리오별 영상 3개(`docs/manuals/video/…`)가 있고,
녹화 스크립트를 다시 돌리면 같은 결과가 나온다.

### User Story 5 - 통합: 긴 프로세스 한 건에서 세 경우가 차례로 (Priority: P2)

후속 요청(2026-10-20): "좀더 긴 프로세스로 세가지 경우가 한번에 발생하는 프로세스도 하나 그려서 설명영상과 시나리오까지" /
"시나리오 별 프로세스가 너무 짧으니 어느정도 시연가능한 길이 정도의 프로세스로 구성".

- 시나리오 1·2.1·2.2 프로세스를 7단계(요청 → 접수·사양 확인 → 견적 접수 → 에이전트 판단 → 발주 승인 → 발주서 발행 → 입고·검수)로 늘린다.
- 통합 프로세스 '생산라인 증설 자재 조달'(9단계) — 에이전트 판단 3단계(포장 부자재 · 핵심 자재 · 설비 부품)에서
  aligned → priority → ask_user 가 한 인스턴스에서 차례로 일어난다.
- 이를 위해 KPI 에 **판단 적용 활동**(`activity_ids`)을 둔다 — 비우면 프로세스 전체, 고르면 그 활동의 판단에만 근거가 된다.
  전략 보드 KPI 대화상자에서 연관 프로세스를 고르면 그 정의의 활동을 고를 수 있다(수동 입력 KPI 도 판단 근거용으로 연결 가능).

**Independent Test**: `check.py --only expansion` → 판단 1 A(aligned) · 판단 2 B(priority) · 판단 3 질문 후 B(user_choice),
통합 발주 승인이 진행 중. `record.mjs x` 6장면 통과, 영상 `docs/manuals/video/ontology-agent-decision/scx.mp4`.

### 판단 단계 유형 전환 — 사용자 태스크 + 에이전트 (2026-10-20 후속)

사용자: "공급사 선정 판단이 ServiceTask가 아니라 UserTask로 설정해서 진행해도 될 것 같은데 검토" / "에이전트 워커 프로젝트가 필요하면
추가해줄테니 원래 흐름대로" / "필요한 건 clone 받아서 실행".

- 판단 단계를 **사용자 태스크 + 에이전트 탭**(기본 에이전트 = `langchain-react`, 완성 모드, 구매 판단 에이전트)으로 바꾼다.
  실행은 오케스트레이션 워커 `uengine-oss/process-gpt-langchain-react`(~/process-gpt-langchain-react, :8011).
- 워커 수정(로컬, 미커밋): 에이전트에 설정된 테넌트 MCP 도구 사용(없으면 기존 코드 인터프리터), SDK 질문 도구를 감싼
  `request_user_input`(대기 30분, 대기 중 draft.awaiting_user_input), 판단 지침·강제 질문, 산출물에 decision 요약,
  실패 시 빈 결과로 완료하지 않음, 모델은 env MODEL.
- 서비스 태스크 경로는 `seed.py --service-task` 로 남긴다(워커 없는 환경).

### Edge Cases

- 프로세스에 연결된 KPI 가 없으면 결정 모드 `no_context` — 에이전트는 활동 설명만으로 진행하고 보고서에 "근거 KPI 없음"을 남긴다.
- 상충 KPI 중 하나만 이 프로세스에 연결되어 있으면 상충으로 보지 않는다(이 업무가 실제로 양쪽을 건드릴 때만).
- 사용자 응답이 오래 없으면 업무는 PENDING 으로 남는다(재시도 횟수를 소모하지 않는다).
- LLM 이 질문 도구를 부르지 않고 스스로 정하려 하면? → 결정 모드 `ask_user` 일 때는 엔진이 질문을 강제한다(LLM 재량에 맡기지 않음).
- 같은 질문에 이미 답이 있으면 다시 묻지 않는다.

## Requirements *(mandatory)*

### Functional Requirements

**전략 서비스(process-gpt-strategy)**

- **FR-001**: Strategy·KPI 에 `priority`(정수, 1 = 가장 높음, 비우면 미정) 속성 — 기존 `importance`(달성률 가중치)와 별개.
- **FR-002**: 상충 관계 `CONFLICTS_WITH`(KPI↔KPI, Strategy↔Strategy, 무방향 의미 — 저장은 한 방향, 조회는 양방향, origin=declared,
  속성 `note`) — KPI·전략 저장 API 의 `conflicts_with: [id]` 로 선언한다.
- **FR-003**: MCP 도구 `ontology_decision_context(proc_def_id, activity_id="", text="")` — 그 프로세스(와 태스크)를 지배하는
  KPI(IMPACTS_KPI·이니셔티브 EXECUTED_BY 경로)와 상위 전략을 목표·현재값·방향·달성 상태·우선순위와 함께 돌려주고,
  그 KPI 들 사이(또는 상위 전략 사이)의 상충을 찾아 **결정 규칙**을 결정적으로 계산한다:
  `aligned`(상충 없음) / `priority`(상충 + 우선순위 차이 → 선택 KPI·포기 KPI) / `ask_user`(상충 + 우선순위 없음·동률 → 질문 문구·선택지) /
  `no_context`(연결 KPI 없음). 같은 계산을 REST `GET /api/ontology/decision-context` 로도 노출.
- **FR-004**: 스키마 메타(NODE_META·EDGE_META)·문서(`docs/ontology-schema.md`)에 priority·CONFLICTS_WITH 반영.

**실행 엔진(process-gpt-completion polling)**

- **FR-005**: 서비스 태스크 MCP 에이전트에 내장 도구 `request_user_input(question, options)`(return_direct) — 부르면 엔진이
  `events` 에 `human_asked`(data: type select|text, text, options, role)를 쓰고 업무를 `PENDING` + `output.awaiting_user_input`
  (job_id·질문·선택지)로 둔 뒤 멈춘다(재시도 횟수 소모 없음).
- **FR-006**: PENDING 처리기는 `awaiting_user_input` 업무에 대해 같은 job_id 의 `human_response` 를 찾고, 있으면 답을
  `output.user_answers` 에 붙여 `SUBMITTED` 로 되돌린다(다음 폴링에 에이전트 재실행). 없으면 아무것도 바꾸지 않는다.
- **FR-007**: 에이전트 프롬프트에 사용자 답(질문·답)과 "결정 근거 도구를 먼저 호출하고, 결정 모드에 따라 행동하라"(aligned·priority →
  진행, ask_user → 반드시 질문, 이미 답이 있으면 그 답을 따름) 지침을 넣는다. 결정 모드가 `ask_user` 인데 답이 없고 LLM 이
  질문하지 않았으면 엔진이 도구 결과의 질문으로 직접 질문한다.
- **FR-008**: 보고서(defaultform 자유입력)에 판단과 근거(선택·포기 KPI, 우선순위, 사용자 답)를 남기고, 산출물에
  구조화된 `decision`(mode, chosen, rejected, basis)을 함께 저장한다.

**프런트(일반 BPM 모드 + 공용 전략 보드)**

- **FR-009**: 전략 보드 KPI·전략 편집 대화상자에 '우선순위'(미정/1~5)와 '상충 KPI/전략'(다중 선택) 입력. 카드에 우선순위·상충 표시.
- **FR-010**: 업무 화면 '에이전트에 맡기기' 탭에서 엔진이 남긴 질문 카드가 보이고 답할 수 있다(기존 UI 재사용 — 필요한 보정만).
  PENDING(사용자 입력 대기) 업무가 인스턴스 칸반·할 일 목록에서 담당자에게 보이고, 업무를 열면 질문이 있음을 안내한다.
- **FR-011**: 온톨로지 익스플로러 관계 이름에 '상충'(CONFLICTS_WITH) 추가.

**데모 · 문서**

- **FR-012**: 데모 시드 스크립트 — 시나리오 1·2.1·2.2 용 프로세스 3개(일반 BPM 모드 정의, 사람 → 에이전트(서비스 태스크,
  strategy-ontology) → 사람), 전략·KPI·상충·우선순위, 에이전트 사용자. 재실행·정리 가능. P-번호 고객사 프로세스는 쓰지 않는다.
- **FR-013**: 유형별 테스트 진행 문서(스크린샷) + 설명 영상(017 영상 파이프라인 재사용) — 시나리오 3개 + 통합 1개.
- **FR-014**: KPI `activity_ids`(판단 적용 활동) 저장·응답, `GET /api/process-definitions/{id}/activities`, 판단 근거 조회가 활동 범위로 KPI 를 거른다.
- **FR-015**: 데모 프로세스는 시연 가능한 길이(7단계, 통합 9단계). 단계별 입력 문구는 `scripts/demo/ontology-decision/scenarios.json` 하나를 녹화·점검이 같이 쓴다.

## Success Criteria *(mandatory)*

- **SC-001**: 시나리오 1·2.1·2.2 각각 일반 BPM 모드(:8081) 화면만으로 시작→완료까지 진행된다(녹화 스크립트 3회 연속 통과).
- **SC-002**: 2.1 에서 우선순위를 뒤바꾸면 선택 KPI 가 바뀐다(결정이 온톨로지 설정을 따른다).
- **SC-003**: 2.2 에서 질문 카드 응답 후 30초 안에 에이전트 단계가 DONE.
- **SC-004**: `ontology_decision_context` 단위 테스트(결정 모드 4종) 통과, 엔진 HITL 단위 테스트 통과, 기존 테스트 회귀 없음.

## Assumptions

- 테넌트 tym, 계정 manual-shots@uengine.org(관리자). LLM 은 기존 OpenAI 키(2026-10-20 정상 확인).
- 상충은 사람이 선언한다(자동 추론하지 않는다). 우선순위가 같으면 동률로 본다.
- 질문 응답자는 업무 화면을 연 사람(인스턴스 참여자)이다 — 별도 배정 규칙은 두지 않는다.
