# Tasks: 사용 활성도 대시보드 — 변경된 조직도·프로세스 UUID 기반 표시

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

**Status**: 전체 완료 (2026-09-16, 소급 작성)

**대상 파일**: `src/services/usageAnalytics.ts` (단일 파일)

## Phase 1: 조직도 인덱스 기반 팀 판정 (User Story 1, P1)

- [x] T001 조직도 인덱스 헬퍼 추가 — `buildOrgChartIndex()`: `configuration.value.chart`
      트리를 워크해 `memberTeams`(정규화 식별자→부서), `teamNames`(부서 id→이름)
      구축. 문자열 JSON·chart 래핑·root 직속 구성원 처리 포함.
- [x] T002 `orgTeamOf()` 추가 — 이벤트/사용자 행의 `user_id`/`id`/`email`/
      `employee_no`/`user_name`/`username` 순으로 조직도 소속 조회.
- [x] T003 `getUsageAdoptionDashboard()`의 `Promise.all`에 `configuration`
      (`key='organization'`) 조회 추가, `orgChartIndex` 구축.
- [x] T004 이벤트 select 에 `user_name`, `department_id`, `department_name`,
      `org_code`, `org_name` 컬럼 추가 (스냅샷 폴백 복구).
- [x] T005 팀 판정 교체 — `resolveTeamPreferOrg()` 도입, `users.forEach`
      (소속 인원 집계)·`eventTeam()`(이벤트 팀 집계)·`toUserRanking()`(랭킹 팀명)에
      우선순위(조직도→스냅샷→부서 컬럼→Unassigned) 적용.

## Phase 2: 프로세스명 해석 (User Story 2, P2)

- [x] T006 `proc_def` select 에 `uuid` 추가, `uuid → name` 매핑을 `procNameMap`에 등록.

## Phase 3: 중복 집계 병합 (User Story 3, P2)

- [x] T007 프로세스 대표 키 사전 — `procCanonicalKey`(소문자 `id`/`uuid`/
      `tb_bpmn_model.id` → `proc_def.id`) + `canonicalProcKey()`.
- [x] T008 `modelViewMap` 집계 키와 `modelTop`의 `procDefId`/`modelName` 해석을
      canonical 키 기준으로 변경 (viewCount/uniqueViewers 합산 병합).
- [x] T009 팀 이름 병합 — `OrgChartIndex.teamsByName`(정규화 부서명→부서) 추가,
      `normalizeTeamNameKey()`(공백 제거+소문자, `orgChartModel.normalizeTeamName`
      동일 규칙), `canonicalizeFallbackTeam()`을 폴백 경로 전체에 적용.

## Phase 4: 검증

- [x] T010 파일 스코프 `tsc --noEmit` 타입 체크 — 해당 파일 오류 0
      (기존 무관 이슈 `ssoAuth.ts` import.meta.env 제외).
- [ ] T011 (후속) 실환경 수동 검증 — spec.md Acceptance Scenarios 3종:
      조직도 이동 반영, uuid 라우트 프로세스명 표시, 중복 행 병합 확인.

## Dependencies

- T001→T002→T003→T005, T004→T005 (Phase 1 내 순차)
- T006→T007→T008 (프로세스 병합은 uuid 매핑 전제)
- T001→T009 (팀 병합은 조직도 인덱스 전제)
- Phase 4 는 전체 완료 후
