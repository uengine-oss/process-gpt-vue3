# Feature Specification: 프로세스 구조 레이어와 프로세스 변경 영향도

**Feature Branch**: `016-process-structure-impact`

**Created**: 2026-10-14

**Status**: Implemented (2026-10-14) — 스키마 1.3.0, 구조 인제스천, 변경 영향 API·MCP·익스플로러 패널, SOLiD 시드.

**Input**: 스키마 검토 문서("전략–실행 온톨로지 스키마와 확장 제안")에 대한 결정 — (1) 시스템·데이터·문서 레이어 필요,
(2) 프로세스 아키텍처 레이어 필요, (3) 프로세스가 바뀔 때 다른 프로세스에 대한 영향도를 온톨로지로 분석할 수 있는지 검토.

## 결정

- **새로 만들지 않고 잇는다.** 프런트엔드에는 BPMN 을 브라우저에서 읽는 프로세스 지식그래프(`src/lib/processKg`, `/ontology-explorer`)가
  이미 있다. 같은 BPMN 을 두 곳이 다르게 읽지 않도록 그 규칙(시스템 = 확장 속성 `systems`, 데이터 = 데이터 객체 연결,
  프로세스 간 = `definitionId(s)`·`callActivity`)을 strategy-service 에 그대로 옮겨, 전략–실행 온톨로지(서버·MCP)에 넣는다.
- 레이어 2개: `architecture`(ProcessArea·ProcessGroup), `asset`(System·DataObject·Document). 익스플로러 기본 레이어에는 넣지 않는다
  (지도는 그대로, 분석·MCP·질문하기에서 쓴다).
- 데이터·시스템은 **이름으로 묶는다**(정규화한 이름이 키). 그래야 "A 가 쓰고 B 가 읽는다"가 생긴다. 이름이 다르게 적히면 끊긴다
  — 데이터 품질 과제.

## 검토: 프로세스 변경 영향도를 온톨로지로 분석할 수 있나

**가능하다 — 단, 프로세스 사이를 잇는 사실이 그래프에 있을 때만.** 영향은 두 프로세스를 잇는 다리로 전파된다.

| 다리 | 근거 | 무게 |
|---|---|---|
| 호출·인계 | CALLS_PROCESS·HANDS_OFF_TO | 3 |
| 데이터 소비 | P 가 쓰는 데이터를 Q 가 읽음 | 3 |
| 데이터 공급·공동 작성 | P 가 읽는 데이터를 Q 가 씀 / 둘 다 씀 | 2 |
| 시스템·규정 문서·담당자·KPI 공유 | USES_SYSTEM·GOVERNED_BY·PERFORMS·IMPACTS_KPI | 1 |

점수는 다리 종류마다 한 번(같은 담당자 여럿이 점수를 부풀리지 않게). 수준: 무게 3 다리가 있으면 높음, 무게 2 다리가 있거나
약한 다리가 두 종류 이상이면 중간, 나머지 낮음 — 시스템·문서·담당자·KPI 공유만으로는 높음이 되지 않는다. 변경 범위는 프로세스 전체, 지정 태스크, 또는 **버전 비교**(최신 vs 이전 `proc_def_version`)로
정한다. 버전 비교는 사라진 태스크가 쓰던 산출물을 이름으로 다시 찾는다 — "지운 산출물을 누가 읽고 있었나"가 가장 흔한 사고다.

**한계** (2026-10-14 실측)
- tym 실데이터: 활동 266개의 systems·입출력 데이터가 비어 있음. 데이터 객체 12개·프로세스 간 참조 9건은 모두 P5.4.3 계열.
  즉 **지금 실데이터로는 대부분 프로세스가 "영향 없음"으로 나온다** — 입력이 없어서지 분석이 못 해서가 아니다.
- 이름 불일치(“제품사양서” vs “제품 사양서”)는 공백만 맞춘다. 동의어 해소는 후속(엔티티 해소 재사용).
- 데이터 필드 단위(어느 칸이 바뀌었나)·실행 중 인스턴스 영향은 범위 밖.

## 구현

| 영역 | 위치 |
|---|---|
| 스키마 1.3.0 | `process-gpt-strategy/app/graph/schema.py`, `docs/ontology-schema.md` |
| BPMN·프로세스 맵 파싱과 반영 | `app/process_structure.py`, `ontology_sync.sync_process_structure`(원천 지문 게이트) |
| 변경 영향 분석 | `app/process_impact.py`, `GET /api/impact/process/{proc_def_id}?tasks=&versions=` |
| MCP·질문하기 | `ontology_process_change_impact` (`mcp_server.py`, `ontology_tools.py`, `ontology_ask.py`) |
| 익스플로러 | 프로세스 패널 **변경 영향** — 영향 프로세스 목록·근거·위험 KPI, 지도에 파란 외곽선(실선 높음·파선 중간·점선 낮음) |
| SOLiD 시드 | `scripts/demo/seed-solid-ax-demo.py` — 시스템 5·데이터 26·규정 6·인계 2·프로세스 맵 4영역 6그룹 |
| 테스트 | `tests/test_process_structure.py` (파싱·멱등 반영·영향 순위·태스크 범위·버전 비교) |

SOLiD 확인: 신제품 개발을 바꾸면 기술지원·인증(8)·수주·RFP(7)·품질(4) 높음 — 공통 원인은 신제품 개발이 쓰는 "제품 사양서".

## 정의 화면 입력 확인 (2026-10-14)

PAL 정의 화면(`/process-hierarchy` → 프로세스 → 편집 → 요소 **우클릭**으로 속성 패널)에서 확인했다.

| 항목 | 입력 | 저장 위치 | 비고 |
|---|---|---|---|
| 시스템 | Task 탭 **시스템 매핑** — 태스크당 1개 선택 | 활동 `uengine:properties.systems` [{id, name}] | 선택지는 시스템 관리(`systems` 테이블). tym 은 등록 0건이라 고를 게 없음 — 그래서 비어 있다 |
| 데이터 | 상단 팔레트 **데이터 객체·데이터 저장소** + 연결선 | BPMN dataObjectReference / data(Input/Output)Association | 활동 입력·출력 칸은 없다. P5.4.3(버전 21개)이 이 방식으로 그려져 있다 |
| 문서 | Process 탭 관련자료 링크, 규정 문서 연결 | `manualLinks`, `policy_document_usage` | |
| 아키텍처 | 왼쪽 트리(영역 → 도메인 → 그룹) | `configuration['proc_map']` | 그룹의 `domain_id` 가 없으면 'unknown' 으로 묶인다 |

정의 JSON 의 `activities[].inputData` 는 업무 데이터가 아니라 앞 단계 **폼 필드 참조**(`formId.fieldKey`)다 — 구조 인제스천에서 제외했다.

## tym 적용 (2026-10-14)

- 시스템 마스터 8개 등록(ERP·SRM 협력사 포털·WMS·MES·PLM·QMS·전자결재·전자세금계산서) — 사용자 프로세스에서도 선택 가능.
- 관리자 설정에서 꺼져 있던 Task 내장 필드 **시스템 매핑**을 켬(`task_property_schema` tym: is_active·visible_by_default = true).
- 시스템 매핑을 **다중 선택**으로 변경(PAL `ProcessHierarchyProperties.vue`) — 이름으로 비교·중복 제거, 저장 형식은 그대로 `systems: [{id, name}]`.
- 데모 프로세스 4개(`demo-onto-*`)에 BPMN(부서 레인·시스템·데이터 연결·발주 → 정산 인계)과 규정 4개를 넣고 기존 구매관리 프로세스 맵 그룹에 배치.
  `python3 scripts/demo/seed-strategy-ontology-demo.py --structure` (전략맵은 그대로). 사용자 프로세스(P 번호·구매관리 계열)는 건드리지 않음.
- BPMN 생성은 `scripts/demo/demo_bpmn.py` 공용 — SOLiD 시드도 같은 모듈(리팩터링 전후 출력 동일 확인).
- 확인: 발주를 바꾸면 대금 정산(높음 — 발주서·인계)·협력사 정기 평가(높음 — 납기 실적·평가 결과)·재고 실사(중간)·구매 프로세스(낮음).

## 익스플로러 표시 — 스키마가 정본 (2026-10-14)

- 지도 열은 strategy-service 스키마 `EXPLORER_COLUMNS`(app/graph/schema.py)가 정하고 `GET /api/ontology/schema` 의 `columns` 로 내려간다.
  익스플로러는 그걸 받아 `applyColumns` 로 그린다(못 받으면 같은 내용 기본값). 레이어에 속한 노드 타입은 정확히 한 열 — 테스트가 검사.
  → 스키마에 레이어·노드 타입을 추가하면 지도에도 나온다.
- 열 순서: 전략 · KPI·이니셔티브 · **영역·그룹** · 프로세스 · 태스크 · **시스템·데이터·문서** · 인스턴스 · 워크아이템 · 리소스 · 스킬.
- 굵게 쓴 두 열은 `course=false` **맥락 열** — 지도·체인에는 나오지만 코스는 건너뛴다(프로세스 코스가 그룹으로 올라가거나
  태스크 다음이 문서로 빠지지 않게). 기본 범위(전략과 이어진 노드)에는 이어진 노드에 붙은 맥락 노드와 그 위(그룹 → 영역,
  데이터 → 문서)까지 넣는다.
- 소속(PART_OF)은 지도에서 부모 → 자식으로 읽는다 — 영역을 고르면 그룹 → 프로세스 → 태스크가 하류. 패널 직접 연결은 "구성원 / 소속".
- 색·카드 높이는 열 index 가 아니라 열 키로 정한다.

## 후속

- 데이터 객체 이름 표준화(데이터 사전·용어 정의 연계) — 이름이 다르면 프로세스 간 연결이 끊긴다.
- 정의 저장(새 버전) 시 변경 영향 요약을 승인 요청에 붙이기.
- 데이터 이름 동의어 해소, `/ontology-explorer`(브라우저 그래프)와의 화면 통합 여부.
