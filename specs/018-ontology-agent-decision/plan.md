# Implementation Plan: 018 온톨로지 근거 에이전트 판단

## 구성 요소와 흐름

```
[8081 일반 BPM] 정의 지도 → 상세 → 실행(ProcessGPTExecute) → /completion/complete
        │                                                     │
        ▼                                                     ▼
 사람 단계(요청 입력)  ──제출──▶  서비스 태스크(에이전트) SUBMITTED  ──polling──▶ handle_service_workitem
                                                                  │  execute_mcp_tools (ReAct)
                                                                  │   ├─ strategy-ontology MCP: ontology_decision_context
                                                                  │   └─ 내장 request_user_input (return_direct)
                              ┌───────── mode=aligned/priority ───┴──── 질문함(ask_user) ─────────┐
                              ▼                                                                  ▼
                      DONE + 보고서·decision                         events.human_asked + 업무 PENDING(awaiting_user_input)
                      → 다음 사람 단계                                  │  업무 화면 '에이전트에 맡기기' 질문 카드 → human_response
                                                                      ▼
                                                     handle_pending_workitem: 응답 발견 → user_answers 추가, SUBMITTED
                                                     → 다음 폴링에 재실행(답을 프롬프트에) → DONE
```

## 저장소별 변경

| 저장소 | 파일 | 변경 |
|---|---|---|
| process-gpt-strategy | `app/schemas.py`, `app/strategy_ops.py` | Objective/KPI `priority`, `conflicts_with` 저장(CONFLICTS_WITH 엣지 동기화) |
| | `app/graph/schema.py`, `schema_doc.py`, `docs/ontology-schema.md` | 메타 반영 |
| | `app/decision_context.py`(신규) | 지배 KPI 수집·상충 탐지·결정 규칙(순수 함수 + store 조회) |
| | `app/mcp_server.py`, `app/ontology_tools.py`, `app/main.py` | MCP 도구·REST |
| | `tests/test_decision_context.py`(신규) | 결정 모드 4종·우선순위 반전 |
| process-gpt-completion | `polling_service/mcp_processor.py` | 내장 질문 도구, 프롬프트(답·결정 지침), 강제 질문 |
| | `polling_service/workitem_processor.py` | 질문 → events·PENDING, PENDING 재개, decision 산출물 |
| | `polling_service/hitl_service_task.py`(신규) + 테스트 | 이벤트 쓰기·응답 조회·상태 전이 순수 로직 |
| process-gpt-vue3 | `src/views/strategy/StrategyBoard.vue`, `strategyStore.ts` | 우선순위·상충 입력/표시 |
| | `StrategyOntologyExplorer.vue`, `OntologySchemaView.vue` | CONFLICTS_WITH 이름 |
| | `WorkItem.vue`/`AgentMonitor.vue`(필요 시) | 사용자 입력 대기 안내·질문 카드 |
| | `scripts/demo/ontology-decision/`(신규) | 시드·정리·녹화·영상 |
| | `docs/manuals/ontology-agent-decision.md`, 영상 3개 | 문서 |

## 결정 규칙(결정적)

1. 지배 KPI = 프로세스 →IMPACTS_KPI→ KPI ∪ 이니셔티브(EXECUTED_BY 프로세스) ←HAS_INITIATIVE– 전략 –HAS_KPI→ KPI.
2. 상충 쌍 = 지배 KPI 들 사이의 CONFLICTS_WITH, 그리고 지배 KPI 들의 상위 전략 사이의 CONFLICTS_WITH(→ 각 전략의 지배 KPI 로 대표).
3. 상충 없음 → `aligned`. 상충 있음 → 쌍마다 priority(작을수록 높음) 비교: 둘 다 있고 다르면 `priority`(chosen=작은 쪽);
   하나라도 없거나 같으면 `ask_user`(질문 = "‘A’와 ‘B’가 상충합니다. 이번 건은 어느 기준을 우선할까요?", 선택지 = 두 KPI 이름(+ 목표)).
   상충 쌍이 여러 개면 하나라도 ask_user 면 ask_user.
4. 지배 KPI 없음 → `no_context`.
