# Tasks: 018 온톨로지 근거 에이전트 판단

## Phase 1 — 전략 서비스 (FR-001~004)
- [x] T001 priority·conflicts_with 스키마/저장(CONFLICTS_WITH 엣지 동기화) — schemas.py, strategy_ops.py
- [x] T002 스키마 메타·문서 갱신
- [x] T003 decision_context.py — 지배 KPI·상충·결정 규칙 + 단위 테스트
- [x] T004 MCP 도구 ontology_decision_context + REST
## Phase 2 — 실행 엔진 HITL (FR-005~008)
- [x] T005 hitl_service_task.py(events 쓰기·응답 조회) + 테스트
- [x] T006 mcp_processor: request_user_input 도구, 프롬프트(결정 지침·사용자 답), 강제 질문
- [x] T007 workitem_processor: 질문 → PENDING, PENDING 재개, decision 산출물
## Phase 3 — 프런트 (FR-009~011)
- [x] T008 전략 보드 우선순위·상충 입력/표시
- [x] T009 익스플로러·스키마 CONFLICTS_WITH 이름
- [x] T010 업무 화면 사용자 입력 대기 안내·질문 카드 확인(8081)
## Phase 4 — 데모·검증·문서 (FR-012~013)
- [x] T011 데모 시드/정리 스크립트(프로세스 3, 전략·KPI·상충·우선순위, 에이전트)
- [x] T012 8081 화면 E2E 3시나리오(녹화 스크립트) 3회 통과
- [x] T013 유형별 테스트 진행 문서(스크린샷) — write-feature-manual
- [x] T014 설명 영상 3개(나레이션·자막)
