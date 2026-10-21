# Feature Specification: 온톨로지 익스플로러 E2E 실행 검증 · 가이드 문서 · 영상

**Feature Branch**: `017-ontology-e2e-guide`

**Created**: 2026-10-15

**Status**: Done

**Input**: User description: "현재 구현된 Ontology Explorer의 기능을 테스트하기위해 프로세스 생성부터 프로세스 실행,
실행 과정 중 Agent가 Ontology 데이터 사용, Ontology를 통한 분석까지 일렬의 과정을 모두 실행하고, 기능을 설명하는
가이드 문서와 동영상으로도 만들어줘."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 생성 → 실행 → 에이전트 → 분석 전 과정을 실제 화면으로 실행 (Priority: P1)

검증자가 tym 테넌트(PAL 화면)에서 새 프로세스를 만들고 실행해, 실행 중 에이전트가 전략–실행 온톨로지(MCP)를 조회해
일하고, 그 실행 기록이 온톨로지 익스플로러에 반영되어 질문하기·원인 분석으로 이어지는 것을 끝까지 확인한다.

**Why this priority**: 사용자 요청의 본체. 기능이 조각별로는 있었지만 한 줄로 이어 돌린 적이 없었다.

**Independent Test**: `python3 scripts/demo/ontology-e2e/cleanup.py && node scripts/demo/ontology-e2e/record.mjs`
가 7개 장면 모두 `ok` 로 끝난다(재실행 가능).

**Acceptance Scenarios**:

1. **Given** 빈 상태, **When** 프로세스 체계도 → 새 프로세스 → 업로드(BPMN) → 순서도 → 버전 저장, **Then** 실행 정의
   (활동 3개, 레인 역할 담당자, 서비스 태스크의 배정 에이전트·자율 완료 모드)가 만들어진다.
2. **Given** 정의, **When** 전략 보드에서 KPI(완료 건수)를 추가하며 연관 프로세스로 고른다, **Then** KPI 카드에 프로세스가 붙는다.
3. **Given** 인스턴스 시작, **When** 구매팀장이 점검 요청을 제출, **Then** 에이전트 단계가 `ontology_resolve_entity` →
   `ontology_kpi_root_cause` 를 호출해 보고서를 남기고(화면에서 읽힘), 다음 사람 단계가 구매팀장에게 IN_PROGRESS 로 온다.
4. **Given** 검토 제출로 인스턴스 완료, **When** 익스플로러 동기화, **Then** 전략→KPI→프로세스→태스크→인스턴스→워크아이템→
   담당자 코스가 이어지고, 에이전트 태스크는 수행 에이전트·스킬까지, 새 KPI 는 1/4건(25%)으로 보인다.
5. **When** 질문하기 "구매 처리 리드타임이 왜 목표 미달이야?" / KPI 원인 분석, **Then** 근거 경로와 함께 에이전트 보고와
   같은 결론(견적 검토 병목)이 나온다.

### User Story 2 - 신규 유저용 가이드 문서 (Priority: P1)

`docs/manuals/ontology-e2e-guide.md` — 위 흐름을 스크린샷 19장과 함께 단계별로 따라 하게 한다.

### User Story 3 - 기능 설명 영상 (Priority: P2)

`docs/manuals/video/ontology-e2e-guide.mp4`(약 3분 50초, 한국어 나레이션·하단 단계 자막) + `.srt`.
실제 실행 녹화로 만들며, 다시 만들 수 있다(cleanup → record → make-audio → make-cards → make-video).

### Edge Cases

- 로컬 PAL 구성(VITE_MODE 미설정)은 순서도의 ▶실행 버튼이 숨겨진다(엔진 모드 배포 전용 게이트) → 인스턴스 시작만
  실행 엔진 `/initiate` 로 하고 이후 업무는 화면에서 처리한다. 문서에 명시.
- LLM 키가 소진/실패하면 에이전트 단계는 DONE 으로 넘어가지 않고 재시도(최대 3회)된다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 데모 자산 — 업로드 BPMN 생성기 `scripts/demo/ontology-e2e/make-bpmn.py`(레인 역할 담당자·에이전트 배정 포함),
  정리 `cleanup.py`, 녹화 `record.mjs`, 음성 `make-audio.sh`, 카드 `make-cards.mjs`, 합성 `make-video.sh`.
- **FR-002**: 실행 엔진(process-gpt-completion) 수정 — 서비스 태스크 완료 후 사람 작업 완료와 같은 경로로 다음 활동 진행,
  LLM 실패 시 빈 산출물 DONE 금지(재시도), defaultform 서비스 태스크는 에이전트 최종 보고를 자유입력에 기록.
- **FR-003**: 전략 서비스(process-gpt-strategy) 수정 — 워크아이템 소요시간에 실제 시작(actual_start_date) 반영,
  증분 동기화의 변경 시각을 `least(greatest(...), now())` 로(엔진의 9시간 이른 updated_at 에도 변경을 놓치지 않게).
- **FR-004**: 로컬 LLM — OpenAI 키 크레딧 소진(429)으로 completion·strategy 를 Upstage(OpenAI 호환, solar-pro4)로 전환
  (원본 `.env.bak-20261015`, `.env.llm.bak-20261015`).

## Success Criteria *(mandatory)*

- **SC-001**: record.mjs 3회 연속 7/7 장면 통과(2026-10-15).
- **SC-002**: 에이전트 단계 약 15~20초, 도구 2개 성공 로그(`모든 MCP 도구 실행 완료: ontology_resolve_entity …: 성공,
  ontology_kpi_root_cause …: 성공`).
- **SC-003**: 익스플로러에서 새 인스턴스가 완료 1 로, 에이전트 단계 소요시간이 0 이 아닌 실제 값(초 단위)으로 보인다.
- **SC-004**: completion polling 테스트 317 통과, strategy 테스트 실패 목록 변경 전후 동일(기존 DB 연결 오류만).

## Assumptions

- 대상 테넌트 tym, 계정 manual-shots@uengine.org(구매팀장 역). P-번호 고객사 프로세스는 쓰지 않는다.
- 데모가 만든 데이터(프로세스 `kpi-<ts>`·인스턴스·KPI)는 남긴다 — 지우려면 cleanup.py.
