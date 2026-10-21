# Feature Specification: 사용 활성도 대시보드 — 변경된 조직도·프로세스 UUID 기반 표시

**Feature Branch**: `004-usage-dashboard-org-chart`

**Created**: 2026-09-16

**Status**: Implemented (소급 작성 — 구현 완료 후 스펙 문서화)

**Input**: User description: "사용 활성도 대시보드 부분에서 프로세스 uuid, 변경된 조직도를 기반으로 팀이 표시되지않음. 따라서 프로세스명, 유저의 팀명을 변경된 조직도를 기반 할 수 있도록 변경되어야함." / "2. 콘텐츠 생성 및 조회 활동이 2개씩 보이는 문제."

## 배경 및 문제

관리자 콘솔의 **사용 활성도 대시보드**(`/admin/usage-adoption`,
`src/views/admin/tabs/UsageAdoptionDashboard.vue` + `src/services/usageAnalytics.ts`)에서
세 가지 표시 결함이 있었다.

1. **팀명 미표시** — 대시보드는 `users.department_*` 컬럼과 이벤트에 기록된 부서
   스냅샷으로 팀을 판정했으나, 재구현된 조직도(스펙: 조직도 재구현)는 소속 정보를
   `configuration(key='organization')`의 `value.chart` 트리에만 저장한다. 그 결과
   조직도에서 부서를 옮기거나 새로 배치한 사용자가 전부 "Unassigned"로 집계됐다.
   또한 이벤트 조회 select 에 `department_*` 컬럼이 누락되어 있어 스냅샷 폴백조차
   동작하지 않았다.
2. **프로세스명 대신 UUID 노출** — 라우트에 따라 이벤트의 `proc_def_id` 자리에
   `proc_def.uuid`가 기록되는데, 이름 매핑은 `proc_def.id`만 대상으로 해서
   "인기 모델" 목록에 UUID 원문이 노출됐다.
3. **섹션 2(콘텐츠 생성 및 조회 활동) 중복 표시** — 같은 대상이 서로 다른 키로
   따로 집계되어 두 줄씩 표시됐다.
   - 모델: 같은 프로세스가 `proc_def.id` / `uuid` / `model_id` 로 제각기 기록되어
     집계 행이 분리되고 조회수도 분산됐다.
   - 팀: 조직도 기반 팀(id=노드 uuid)과 부서 컬럼 폴백 팀(id=부서명 문자열)이
     같은 이름으로 별도 행이 됐다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 변경된 조직도 기준 팀 집계 (Priority: P1)

관리자가 사용 활성도 대시보드를 열면, 팀 활성화 테이블·WAU/DAU 랭킹·리텐션·
사용자 랭킹의 팀명이 **현재 조직도(`configuration key='organization'`) 기준 소속**으로
표시된다. 조직도에서 부서 이동/신규 배치가 있으면 새로고침 시 즉시 반영된다
(과거에 쌓인 이벤트에도 소급 적용).

**Why this priority**: 대시보드의 모든 팀 단위 지표가 이 판정에 의존하며,
조직도 개편 이후 팀이 아예 표시되지 않던 핵심 결함이다.

**Independent Test**: 조직도에서 사용자 A를 부서 X로 이동 → 대시보드 새로고침 →
A의 활동이 부서 X 행으로 집계되는지 확인.

**Acceptance Scenarios**:

1. **Given** 조직도 트리에 배치된 사용자의 사용 이벤트, **When** 대시보드 조회,
   **Then** 해당 사용자의 활동이 조직도상 소속 부서로 집계된다 (uid·email·이름
   어느 식별자로 기록된 이벤트든 동일).
2. **Given** 조직도에 배치되지 않았지만 `users.department_name`이 있는 사용자,
   **When** 대시보드 조회, **Then** 부서 컬럼 값으로 폴백 집계된다.
3. **Given** 조직도에도 부서 컬럼에도 소속이 없는 사용자, **When** 대시보드 조회,
   **Then** "Unassigned"로 집계된다.

---

### User Story 2 - 프로세스명 표시 (Priority: P2)

"인기 모델" 목록에서 이벤트에 UUID로 기록된 프로세스도 `proc_def.name`으로 표시된다.

**Why this priority**: UUID 원문 노출은 대시보드 가독성을 크게 해치지만,
팀 집계(P1)와 달리 범위가 한 패널에 국한된다.

**Independent Test**: `/process-hierarchy?id=<uuid>` 류 라우트로 프로세스를 조회한 뒤
대시보드에서 해당 항목이 프로세스명으로 표시되는지 확인.

**Acceptance Scenarios**:

1. **Given** `proc_def_id`에 uuid가 기록된 model_view 이벤트, **When** 대시보드 조회,
   **Then** `proc_def.uuid → name` 매핑으로 프로세스명이 표시된다.
2. **Given** proc_def 테이블에 없는 식별자, **When** 대시보드 조회,
   **Then** 기록된 식별자 원문이 폴백으로 표시된다 (빈 값 없음).

---

### User Story 3 - 중복 집계 병합 (Priority: P2)

섹션 2의 "인기 모델"과 "팀별 편집 vs 조회"에서 같은 프로세스/팀이 한 행으로만
나타나고, 조회수·고유 조회자 수·편집/조회 카운트는 합산된다.

**Why this priority**: 수치가 분산되어 순위와 합계가 왜곡되는 데이터 신뢰성 문제.

**Independent Test**: 같은 프로세스를 id 기반 라우트와 uuid 기반 라우트로 각각 조회 →
대시보드에서 한 행으로 합산 표시되는지 확인.

**Acceptance Scenarios**:

1. **Given** 같은 프로세스가 `proc_def.id`와 `uuid`로 나뉘어 기록된 이벤트들,
   **When** 대시보드 조회, **Then** 대표 키(`proc_def.id`) 한 행으로 병합되고
   viewCount/uniqueViewers 가 합산된다.
2. **Given** 조직도 팀과 이름이 같은 부서 컬럼 폴백 팀, **When** 대시보드 조회,
   **Then** 조직도 팀 id로 병합되어 한 행으로 표시된다 (부서명 비교는 공백 제거·
   소문자 정규화, 조직도 전체 부서명 유일 제약을 전제).

---

### Edge Cases

- 조직도 configuration 행이 없거나 파싱 불가 → 조직도 인덱스 없이 기존 폴백 로직만으로 동작 (기능 저하 없음).
- 같은 사람이 여러 부서에 배치된 경우 → 트리 문서 순서상 첫 번째 배치를 대표 부서로 사용.
- `value.chart`가 문자열(JSON)로 저장된 경우 → 파싱 후 사용, 실패 시 무시.
- root 직속 구성원 → root 노드를 팀으로 취급해 조직명으로 집계.
- 이벤트 식별자 대소문자/공백 차이 → 식별자 정규화(trim+lowercase)로 매칭.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 대시보드 집계 시 `configuration(key='organization')`의 `value.chart`를
  조회해 구성원 식별자(uid/email/이름, 정규화) → 소속 부서 인덱스를 구축해야 한다.
- **FR-002**: 팀 판정 우선순위는 ① 현재 조직도 → ② 이벤트 부서 스냅샷 →
  ③ `users` 부서 컬럼 → ④ Unassigned 순이어야 한다.
- **FR-003**: 팀 판정은 팀 활성화 테이블(소속 인원 수 포함), 이벤트 팀 집계,
  사용자 랭킹 팀명에 일관되게 적용되어야 한다.
- **FR-004**: `proc_def` 조회에 `uuid`를 포함하고, `id`와 `uuid` 모두에서
  프로세스명을 찾을 수 있어야 한다.
- **FR-005**: 프로세스 집계 키는 별칭(소문자 `id`/`uuid`/`model_id`) → 대표 키
  매핑으로 정규화해 같은 프로세스가 한 행으로 합산되어야 한다.
- **FR-006**: 부서 컬럼 폴백으로 얻은 팀의 정규화된 이름이 조직도 부서명과
  일치하면 조직도 팀 id로 병합해야 한다.
- **FR-007**: 이벤트 기록 측(`recordUsageEvent`)과 저장 스키마는 변경하지 않는다 —
  표시(집계) 시점 해석만 변경하여 과거 이벤트에 소급 적용한다.
- **FR-008**: 조직도 저장 포맷(`configuration` `value.chart`, 노드 `id`/`data`/
  `children`, 부서 `data.isTeam === true`)은 읽기 전용으로만 사용한다.

### Key Entities

- **app_usage_events**: 사용 이벤트. `user_id`/`email`/`employee_no`/`user_name` +
  부서 스냅샷(`department_*`, `org_*`) + `proc_def_id`/`model_id`.
- **configuration (key='organization')**: 조직도 트리 `value.chart`. 팀 소속의 원천.
- **users**: 사용자 마스터. 부서 컬럼은 폴백 용도로만 사용.
- **proc_def**: 프로세스 정의. `id`(대표 키)·`uuid`(별칭)·`name`.
- **tb_bpmn_model**: BPMN 모델. `id`(model_id 별칭) → `proc_def_id` 연결.

## Success Criteria *(mandatory)*

- **SC-001**: 조직도에 배치된 모든 활동 사용자가 조직도상 부서명으로 집계된다
  (Unassigned는 실제 미배치·무소속 사용자에만 나타남).
- **SC-002**: "인기 모델" 목록에 UUID 원문이 노출되지 않는다 (proc_def에 존재하는
  프로세스 한정).
- **SC-003**: 섹션 2에서 동일 프로세스/동일 부서명이 두 행 이상으로 나타나지 않는다.
- **SC-004**: 기존 이벤트 데이터 마이그레이션 없이 동작한다.

## 구현 결과 (소급 기록)

- 변경 파일: `src/services/usageAnalytics.ts` 단일 파일.
  - `buildOrgChartIndex()` — 조직도 트리 → `memberTeams`(식별자→부서),
    `teamNames`, `teamsByName`(정규화 부서명→부서) 인덱스.
  - `orgTeamOf()` — 이벤트/사용자 행의 복수 식별자로 조직도 소속 조회.
  - `resolveTeamPreferOrg()` / `eventTeam()` — FR-002 우선순위 적용,
    `canonicalizeFallbackTeam()`으로 FR-006 병합.
  - `procCanonicalKey` 맵 + `canonicalProcKey()` — FR-004/005.
  - 이벤트 select 에 `user_name`, `department_*`, `org_*` 컬럼 추가(스냅샷 폴백 복구),
    `proc_def` select 에 `uuid` 추가, `configuration` 조회 추가.
- 검증: 파일 스코프 `tsc --noEmit` 통과 (기존 무관 이슈 제외 오류 0).
- UI(`UsageAdoptionDashboard.vue`)·이벤트 기록 로직·DB 스키마 변경 없음.
