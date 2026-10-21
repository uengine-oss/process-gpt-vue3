# Feature Specification: 온톨로지 그래프 플랫폼 고도화 (ontological-db · MCP · 질의 경로 · 인과 가설 · 시점 · 교차 필터)

**Feature Branch**: `014-ontology-graph-platform`

**Created**: 2026-10-08

**Status**: Implemented (2026-10-08) — US1~US6. 교차 필터는 도메인 필터가 있는 분석 대시보드(PAL 모드) 한정.

**Input**: 013(Ontology Explorer) 이후 ontology-studio(uengine-oss/ontology-studio)·ontological-db·
시연 영상("[증권예제] 연동편 MCP 엔티티해소 시연")을 비교 분석해 도출한 개선 6건을 **순서대로** 진행한다.
사용자 지시: "순서대로 진행하도록해." 전제: "Db 를 온톨로지칼 db 를 사용. 현재 아파치 Age 사용중일텐데
아파치 age 는 supabase saas와 통합이 안됨."

## 배경 / 비교 분석 요약

- 현재 Ontology Explorer 는 strategy-service(`process-gpt-strategy`) 의 Apache AGE 그래프 `corp_ontology` 를
  읽는 **조회 전용 분석 화면**이다. 실행 레이어(인스턴스·워크아이템)는 sync 로 그래프에 **복제**된다.
- ontology-studio 는 온톨로지를 **구축·검수·발행**하고 MCP 로 에이전트에 공급한다. 가상 클래스(복제 없음),
  출처(provenance), 인과 가설(통계 제안 → 사람 승인), 시점 질의(as_of/known_at), 엔티티 해소(후보→재순위→
  판정·기권)를 갖는다.
- ontological-db 는 PostgreSQL 확장(Rust/pgrx). Cypher·TypeQL·벡터·테이블 매핑·RLS·변경 이력(`og_as_of`)·
  출처(`og_set_source`)를 1급으로 가진다. **주의**: Supabase Cloud 확장 허용 목록에는 없다(외부 승인 과제) —
  **셀프호스트 Supabase** 에서 커스텀 이미지로 쓴다. AGE 와 달리 커넥션마다 `LOAD`/search_path 가 필요 없어
  PostgREST·커넥션 풀과 충돌하지 않는다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 그래프 저장소를 ontological-db 로 전환 (Priority: P0)

운영자가 strategy-service 의 그래프 저장소를 AGE 에서 ontological-db 로 바꾼다. 설정값 하나(`GRAPH_STORE=ontological`)
로 전환되며, 전략 보드·온톨로지 익스플로러는 코드 변경 없이 같은 화면을 보여 준다. 그래프는 플랫폼과 **같은
Supabase Postgres** 안에 있다(별도 그래프 DB 컨테이너 불필요).

**Why this priority**: 이후 모든 개선(MCP·시점·출처)이 ontological-db 기능 위에 선다. UI 보다 먼저 결정해야 한다.

**Independent Test**: 같은 계약 테스트(`tests/graph_contract.py`) 를 ontological 어댑터로 실행해 전부 통과,
AGE 데이터를 이관한 뒤 `/api/ontology/graph` 응답(노드·엣지 수와 id 집합)이 AGE 와 동일.

**Acceptance Scenarios**:

1. **Given** Supabase 로컬 DB 이미지에 ontological 확장이 설치되어 있고, **When** `GRAPH_STORE=ontological` 로
   strategy-service 를 띄우면, **Then** `ensure_ready()` 가 그래프·타입을 멱등 생성하고 기동한다.
2. **Given** AGE 에 데모 데이터가 있고, **When** 이관 스크립트를 실행하면, **Then** 노드·엣지 수와 속성이 일치하고
   재실행해도 중복이 생기지 않는다.
3. **Given** 전환된 상태에서, **When** 전략 보드와 익스플로러를 열면, **Then** 이전과 같은 그래프·코스·지표가 보인다.
4. **Given** 확장이 없는 DB 에서, **When** 기동하면, **Then** 설치 방법을 담은 명확한 오류를 낸다.

---

### User Story 2 - 전략 온톨로지를 MCP 로 에이전트에 제공 + 엔티티 해소 (Priority: P1)

Process GPT 에서 실행되는 에이전트가 "이 업무가 기여하는 KPI 는?", "구매 리드타임 KPI 의 병목은?" 을 MCP 도구로
묻는다. 이름("구매 리드타임")은 엔티티 해소로 키로 바뀌고, 확신이 없으면 기권(후보만 제시)한다.

**Why this priority**: 영상 시나리오(워크아이템 → 에이전트 → MCP → 온톨로지)를 전략–실행 온톨로지에 적용한다.
사람만 보던 그래프를 에이전트가 쓰게 된다.

**Independent Test**: MCP 클라이언트로 도구 목록·스키마 조회·엔티티 해소·체인 조회를 호출해 기대 결과 확인.
평가 세트(정답 있는 언급 + 없는 언급)에서 정답 1위 비율과 "없는 것을 확정하지 않음"을 측정.

**Acceptance Scenarios**:

1. **Given** MCP 서버가 떠 있고, **When** 도구 목록을 요청하면, **Then** 읽기 전용 도구(스키마·엔티티 해소·노드 조회·
   체인·KPI 원인·질의)가 나온다. 쓰기 도구는 없다.
2. **Given** "구매 리드타임" 이라는 언급과 맥락, **When** 엔티티 해소를 호출하면, **Then** KPI 키와 점수, 판정
   (resolved/ambiguous/no_match) 이 나온다.
3. **Given** 존재하지 않는 이름, **When** 해소하면, **Then** `no_match` 로 기권한다(억지 확정 금지).
4. **Given** 테넌트 A 의 토큰, **When** 조회하면, **Then** 테넌트 B 의 노드는 보이지 않는다.

---

### User Story 3 - 질문 → 경로 하이라이트 (Priority: P2)

사용자가 익스플로러에서 자연어로 묻는다("구매 리드타임이 왜 목표 미달이야?"). 에이전트가 MCP 도구로 그래프를
탐색하고, **실제로 지나간 노드 경로**가 지도 위에 코스(보라색 번호)로 그려진다. 답변 문장과 함께 각 단계의 근거
노드를 클릭할 수 있다.

**Independent Test**: 질문 1건 → 응답의 `trajectory`(노드 id 순서) 가 코스로 렌더되고 코스 표에 단계가 나온다.

**Acceptance Scenarios**:

1. **Given** 익스플로러, **When** 질문을 입력하면, **Then** 답변과 경로가 함께 표시되고 경로 노드가 코스로 강조된다.
2. **Given** 답할 수 없는 질문, **When** 입력하면, **Then** "근거 없음" 을 밝히고 경로를 그리지 않는다.

---

### User Story 4 - 인과 가설 관계 + 출처 표시 (Priority: P2)

시스템이 실행 이력(프로세스 주기·지연)과 KPI 시계열을 근거로 "프로세스 → KPI 영향" 관계를 **가설**로 제안하고,
사람이 승인/거절한다. 승인된 것만 관계가 된다. 모든 관계에는 출처(선언·가져오기·통계·동기화)가 기록되어 상세
패널에 보인다.

**Independent Test**: 가설 생성 → 대기 목록 → 승인 1건/거절 1건 → 승인 건만 `IMPACTS_KPI` 로 생기고 출처가 `statistical`.
재실행해도 거절한 가설이 대기로 되돌아오지 않는다.

---

### User Story 5 - 시점 슬라이더 (Priority: P3)

사용자가 익스플로러 상단 슬라이더로 과거 시점을 고르면, 그 시점의 KPI 값·달성 수준과 체인이 보인다.
전략 변경 전후를 비교한다.

**Independent Test**: KPI 값을 두 번 바꾼 뒤 각 시점으로 슬라이더를 옮겨 값·색이 그 시점대로 나오는지 확인.

---

### User Story 6 - 분석 대시보드와 교차 필터 (Priority: P3)

지도에서 노드(프로세스·KPI·사람)를 클릭하면 분석 대시보드의 위젯이 그 노드 기준으로 걸러지고, 반대로 대시보드의
필터가 지도에 반영된다(한 홉만).

**Independent Test**: 익스플로러에서 프로세스 선택 → "대시보드에서 보기" → 대시보드 필터 칩에 그 프로세스가 걸린 상태.

---

### Edge Cases

- ontological 확장의 PG 버전(이미지 PG15.8) 과 빌드 대상이 다르면 기동 실패 → 이미지 재빌드 안내.
- AGE 와 ontological 이 같은 DB 에 공존하는 전환 기간: 두 확장 모두 설치되어 있어도 서로 간섭하지 않아야 한다.
- 매우 큰 테넌트(인스턴스 수천): subgraph 응답 시간이 AGE 대비 나빠지지 않아야 한다.
- 엔티티 해소 재순위 모델이 없을 때: 어휘 점수만으로 동작하되 판정 임계를 보수적으로.

## Requirements *(mandatory)*

- **FR-001**: strategy-service 는 `GRAPH_STORE=ontological` 로 ontological-db 어댑터를 선택할 수 있어야 한다.
  기본값은 전환 완료 전까지 `age`.
- **FR-002**: ontological 어댑터는 `GraphStore` 계약 테스트를 전부 통과해야 한다.
- **FR-003**: AGE → ontological 이관 스크립트(멱등, dry-run, 수 비교 리포트).
- **FR-004**: Supabase 로컬 이미지에 ontological 확장을 얹는 빌드 레시피(`supabase/ontological/`)와 셀프호스트
  compose 용 이미지.
- **FR-005**: MCP 서버(읽기 전용) — 스키마, 엔티티 해소, 노드/체인 조회, KPI 원인 경로, 제한된 Cypher 질의.
  테넌트 격리 필수.
- **FR-006**: 엔티티 해소 — 토큰 단위 어휘 + (가능 시) 벡터 후보, 재순위, 판정 resolved/ambiguous/no_match.
- **FR-007**: 익스플로러 질의 입력 → 답변 + trajectory → 코스 렌더.
- **FR-008**: 인과 가설 생성·승인·거절·적용 API 와 검토 UI. 거절 판정은 재실행에도 유지.
- **FR-009**: 관계 출처 기록·표시 (declared / imported / statistical / synced).
- **FR-010**: 시점 조회 API(`as_of`) 와 슬라이더 UI.
- **FR-011**: 익스플로러 ↔ 분석 대시보드 교차 필터(한 홉).

## Success Criteria *(mandatory)*

- **SC-001**: 계약 테스트 100% 통과(ontological), 이관 후 노드·엣지 수 AGE 와 동일.
- **SC-002**: 익스플로러 그래프 로딩 시간이 AGE 대비 같거나 빠름(데모 데이터 기준).
- **SC-003**: 엔티티 해소 평가 세트에서 정답 1위 ≥ 90%, 없는 이름 확정 0건.
- **SC-004**: 질문 → 경로 하이라이트가 데모 질문 3건에서 근거 노드와 함께 표시.

## Assumptions

- 배포 대상은 셀프호스트 Supabase(커스텀 Postgres 이미지 사용 가능). Supabase Cloud 는 확장 등재 전까지 범위 밖.
- ontological-db 는 `uengine-oss/ontological-db@3179cc7` 을 PG15 로 빌드한다.
- `og_map_table` 은 노드만 매핑하고 id 가 정수여야 한다 — 우리 실행 데이터 id 는 텍스트/UUID 이므로 1차는
  기존 sync 를 유지하고 쓰기 대상만 ontological 로 바꾼다. 매핑 전환은 후속 검토.
