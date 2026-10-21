# Feature Specification: 전략–실행 Ontology Explorer (전략 보드 고도화)

**Feature Branch**: `013-ontology-explorer`
**Created**: 2026-10-07
**Status**: Implemented (manual: docs/manuals/ontology-explorer.md)
**Input**: "데이터 분석을 위한 Ontology Explorer의 구현. 전략부터 실행까지의 데이터를 각 Ontology화 하여 각 연관 관계를 분석 할 수 있다." (전문: prompt-history.md)

## 배경 — 현재 상태

| 구성 | 현재 | 한계 |
|---|---|---|
| 전략 보드 `/strategy-board` (StrategyBoard.vue) | BSC 4관점 전략맵·KPI·이니셔티브·기여도. 데이터는 strategy-service(`/strategy-service/api`) | 전략맵에서 끝난다 — KPI가 어떤 프로세스·실행 결과로 채워지는지 보이지 않음. PAL 메뉴에 진입점이 없음 |
| strategy-service 온톨로지 (`corp_ontology`, Apache AGE) | Strategy·KPI·Initiative·Process·Task·User·Agent·Team·Skill 노드 9종(+Canvas) / 엣지 14종 | **실행 결과(프로세스 인스턴스·워크아이템)가 노드가 아님** — 실행은 IMPACTS_KPI/PERFORMS 엣지의 집계값으로만 존재 |
| `/analytics/ontology` (strategy/OntologyExplorer.vue) | cytoscape 레이어 그래프 + 영향도 탭 | 전략↔실행 체인 추적 불가, 비 PAL 메뉴 전용 |
| `/ontology-explorer`, `/ontology-explorer-new` | BPMN 지식그래프 / `process_gpt` AGE 그래프(전략 레이어 꺼짐) | 전략 데이터와 연결되지 않음 |

참고자료: process-gpt-strategy-skill(BSC 인터뷰 → 목표·KPI·프로세스 연결), 쏠리드 AX 제안서 §온톨로지 기반 전략맵(7단 워터폴: 북극성 전략 → 하위 전략 → KPI → 프로세스 → 태스크 → 리소스 → 스킬, 미달 KPI 빨간 테두리, KPI→병목 태스크 역추적), Enterprise Brain(KPI·지표·프로세스·리소스 인과관계를 "판단 자산"으로 공유).

## 범위 결정

- 전략 데이터의 정본은 strategy-service 이므로 **strategy-service 온톨로지(`corp_ontology`)를 확장**한다(제3의 그래프를 만들지 않음).
- 실행 레이어(`execution`)를 추가: `ProcessInstance`, `WorkItem` 노드 + `HAS_INSTANCE`, `HAS_WORK_ITEM`, `EXECUTES_TASK`, `ASSIGNED_TO` 엣지.
- 화면은 **PAL 모드에서만** 바뀐다. 비 PAL 의 전략 보드·`/analytics/ontology` 동작은 그대로(조망 API 기본 레이어에서 execution 제외 → 기존 화면 응답 불변).

## User Scenarios & Testing

### User Story 1 — 전략에서 실행 결과까지 한 화면에서 추적 (P1)

경영기획 담당자는 전략 보드의 **온톨로지 익스플로러** 탭에서 전략 → KPI → 프로세스 → 태스크 → 실행(인스턴스) → 워크아이템 → 리소스 → 스킬 8단 워터폴을 본다. 노드를 클릭하면 그 노드의 상류(왜 존재하는가)와 하류(무엇으로 실행되는가) 체인만 강조되고 나머지는 흐려진다.

**Acceptance**
1. Given KPI가 프로세스에 연결되고 그 프로세스의 인스턴스가 실행됨, When KPI 클릭, Then 상위 전략, 연결 프로세스, 그 태스크·인스턴스·워크아이템·수행자·스킬이 하나의 체인으로 강조된다.
2. Given 인스턴스 클릭, Then 상류로 프로세스 → KPI → 전략까지 거슬러 올라간 체인이 강조되고, 상세 패널에 상태·시작/완료·소요시간·지연 여부가 보인다.
3. 목표 미달 KPI 는 빨간 테두리, 완료/진행/지연 인스턴스는 상태색으로 구분된다.
4. "선택 체인만 보기"를 켜면 체인 밖 노드가 숨겨지고 화면이 체인에 맞춰진다.
5. 기본 보기는 전략과 연결된 체인만 보여주며, "연결 안 된 노드 포함" 토글로 전체를 볼 수 있다.

### User Story 2 — 노드 상세와 원천 이동 (P1)

**Acceptance**
1. 상세 패널에 노드 유형·레이어·주요 속성·단계별 연결 수(예: 프로세스 3 · 인스턴스 12)가 표시된다.
2. KPI 는 현재값/목표/달성률, 프로세스는 완료 건수·평균 소요시간, 워크아이템은 담당자·소요시간을 보여준다.
3. 원천 화면으로 이동: 프로세스 → 프로세스 정의, 인스턴스 → 인스턴스 화면, 전략/KPI → 전략맵 탭에서 해당 목표 선택.
4. 전략맵 탭의 목표 상세 패널에서 "연관관계 보기"를 누르면 익스플로러 탭이 그 목표에 포커스된 상태로 열린다(양방향 이동).

### User Story 3 — 온톨로지 스키마 확인 (P2)

**Acceptance**
1. 전략 보드의 **온톨로지 스키마** 탭에 레이어별 노드 타입(설명·업무키·속성·원천)과 관계 타입(시작→끝·설명·원천)이 표와 메타 그래프로 표시된다.
2. 각 타입 옆에 현재 테넌트의 노드/관계 수가 표시된다.
3. 스키마 정본 문서(`process-gpt-strategy/docs/ontology-schema.md`)와 API(`GET /api/ontology/schema`) 내용이 일치한다.

### User Story 4 — 동기화 (P2)

**Acceptance**
1. 익스플로러의 "동기화" 버튼이 원천(proc_def, users, 조직도, 스킬, bpm_proc_inst, todolist)을 그래프에 반영하고 마지막 동기화 시각을 갱신한다.
2. 실행 레이어는 최근 `ONTOLOGY_INSTANCE_LOOKBACK_DAYS`(기본 180)일, 테넌트당 최대 `ONTOLOGY_INSTANCE_LIMIT`(기본 500)건 인스턴스만 투영하고, 창 밖으로 나간 인스턴스·워크아이템은 그래프에서 제거된다.
3. 삭제(`is_deleted`)된 인스턴스는 그래프에서 제거된다.

### Edge Cases
- strategy-service 미기동/오류 → 익스플로러는 오류 안내 + 재시도 버튼(빈 화면 아님).
- 전략맵 없음 → "전략맵을 먼저 작성하세요" 안내 + 전략맵 탭 이동 버튼. "연결 안 된 노드 포함"으로 프로세스·실행만 볼 수는 있음.
- KPI 에 프로세스 미연결 → 체인이 KPI 에서 끊기며 상세 패널에 "연결된 프로세스 없음" 표시.
- 정의에서 사라진 활동의 워크아이템 → EXECUTES_TASK 없이 인스턴스에만 연결.
- 노드 수가 많을 때(수백) → 단계 내 정렬(상류 위치 기준)로 교차 최소화, 검색으로 노드 찾기.

## Requirements

### strategy-service (process-gpt-strategy)
- **FR-001** 실행 레이어 노드/엣지 추가(아래 스키마). 업무키: ProcessInstance=`proc_inst_id`, WorkItem=`todolist.id`.
- **FR-002** `sync_all` 에 실행 레이어 인제스천 추가 — 증분 커서(`updated_at`) + 조회창 정리. `full=true` 는 커서 초기화.
- **FR-003** `GET /api/ontology/graph` 가 `execution` 레이어를 지원. `layers` 미지정 시 기본값은 기존 4레이어(하위호환).
- **FR-004** `GET /api/ontology/schema?tenant_id=` — 레이어·노드 타입·관계 타입 메타데이터와 테넌트별 개수 반환. 메타데이터는 `app/graph/schema.py` 한 곳에서 정의.
- **FR-005** 스키마 정본 문서 `docs/ontology-schema.md`.

### 프론트엔드 (PAL 전용)
- **FR-010** 전략 보드에 PAL 모드에서만 상단 탭 `전략맵 | 온톨로지 익스플로러 | 온톨로지 스키마` 표시. 탭은 `?view=` 쿼리로 딥링크.
- **FR-011** 익스플로러: 8단 워터폴 레이아웃, 단계 단조(monotone) 체인 추적, 검색, 단계 표시 토글, 체인만 보기, 연결 안 된 노드 포함 토글, 상세 패널, 원천 이동, 동기화.
- **FR-012** PAL 사이드바 분석 메뉴에 "전략 보드" 추가.
- **FR-013** 비 PAL 모드 화면·동작 불변.

### 체인 추적 규칙
단계 순서: 0 전략(Strategy) · 1 KPI/이니셔티브 · 2 프로세스 · 3 태스크 · 4 실행(ProcessInstance) · 5 워크아이템 · 6 리소스(User/Agent/Team) · 7 스킬.
선택 노드에서 엣지를 방향 무관하게 따라가되 **하류는 단계가 커지는 쪽으로만, 상류는 작아지는 쪽으로만** 확장한다. 같은 단계 내에서는 전략의 `HAS_SUB_STRATEGY` 만 방향대로 따른다. (예: 사용자 → 다른 워크아이템으로 퍼지는 폭발을 막는다.)

## Ontology Schema (확장 후)

| 레이어 | 노드 | 주요 속성 | 원천 |
|---|---|---|---|
| strategy | Strategy, KPI, Initiative | perspective·importance / target·current·measure_type·kpi_role / status·progress | strategy-service |
| process | Process, Task | name / activity_id·proc_def_id | proc_def |
| **execution** | **ProcessInstance**, **WorkItem** | proc_def_id·status·start/end/due·duration_hours·is_overdue / activity_id·status·user_id·duration_hours·rework_count | bpm_proc_inst / todolist |
| resource | User, Agent, Team | name·email | users, 조직도 |
| skill | Skill | name·description | agent_skills, users.skills |

| 관계 | 시작 → 끝 | 의미 |
|---|---|---|
| HAS_SUB_STRATEGY | Strategy → Strategy | 상위 전략의 하위 전략 |
| HAS_KPI | Strategy → KPI | 전략을 측정하는 KPI |
| HAS_INITIATIVE | Strategy → Initiative | 전략 실행과제 |
| IMPACTS_KPI | Process → KPI | 프로세스 실행이 KPI 값을 만든다 |
| EXECUTED_BY | Initiative → Process | 이니셔티브를 수행하는 프로세스 |
| CONTAINS_TASK | Process → Task | 정의상 활동 |
| **HAS_INSTANCE** | Process → ProcessInstance | 정의의 실행 인스턴스 |
| **HAS_WORK_ITEM** | ProcessInstance → WorkItem | 인스턴스에서 발생한 워크아이템 |
| **EXECUTES_TASK** | WorkItem → Task | 워크아이템이 수행한 정의상 활동 |
| **ASSIGNED_TO** | WorkItem → User/Agent | 워크아이템 담당자 |
| PERFORMS | User/Agent → Task | 정의상 담당/실행 집계 |
| USES_SKILL | Agent → Skill | 에이전트 보유 스킬 |
| INHERITS / REFERENCES | Skill → Skill | 스킬 간 상속/참조(LLM 추출) |
| HAS_SUB_TEAM / MEMBER_OF | Team → Team / User → Team | 조직 |
| CONTRIBUTED_TO | User → Skill | 스킬 기여 |

## Success Criteria
- **SC-001** 연결된 KPI 하나를 클릭하면 1초 안에 전략~스킬 체인이 강조된다(노드 1,000개 이하).
- **SC-002** 비 PAL 모드의 `/strategy-board`, `/analytics/ontology` 응답·화면이 변경 전과 동일.
- **SC-003** strategy-service 기존 테스트 + 신규 테스트 통과, 프론트 타입체크/빌드 통과.
- **SC-004** 매뉴얼 `docs/manuals/ontology-explorer.md`(스크린샷 포함).

## 구현 기록

| 영역 | 파일 |
|---|---|
| strategy-service (../process-gpt-strategy) | `app/graph/schema.py`(실행 레이어 라벨·관계, DEFAULT_LAYERS, 스키마 메타), `app/ontology_sync.py`(`sync_process_instances`), `app/ontology_view.py`(`GET /api/ontology/schema`), `app/config.py`, `app/graph/schema_doc.py` → `docs/ontology-schema.md`, 테스트 `tests/test_ontology_execution.py`·`tests/test_ontology_schema_doc.py` |
| 프론트 | `src/components/strategy/ontology/`(`ontologyLineage.js`+test, `StrategyOntologyExplorer.vue`, `OntologySchemaView.vue`), `src/views/strategy/StrategyBoard.vue`(PAL 탭·연관관계 보기), `src/stores/strategy/strategyStore.ts`(`getOntologySchema`), PAL 사이드바·`routePermissions.ts` |
| 데모 데이터 | `scripts/demo/seed-strategy-ontology-demo.py` (`--cleanup` 으로 삭제, 프로세스 5·담당자 6·에이전트 3·전략 10·KPI 14·인스턴스 59) |
| 매뉴얼 | `docs/manuals/ontology-explorer.md` |

로컬 실행: strategy-service 는 start-all.sh 에 없다. AGE 그래프 DB(`docker compose -f docker-compose.age.yml up -d`, 55433) + `DB_PORT=54322 GRAPH_DB_PORT=55433 uvicorn app.main:app --port 8014` (vite/게이트웨이가 `/strategy-service` 를 8014 로 프록시).
