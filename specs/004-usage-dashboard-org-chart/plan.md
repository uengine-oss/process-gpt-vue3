# Implementation Plan: 사용 활성도 대시보드 — 변경된 조직도·프로세스 UUID 기반 표시

**Branch**: `004-usage-dashboard-org-chart` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Status**: 구현 완료 (소급 작성)

## Summary

사용 활성도 대시보드의 팀/프로세스 표시를 **집계(표시) 시점 해석 변경**만으로 고친다.
이벤트 기록·DB 스키마는 손대지 않아 과거 데이터에 소급 적용되고 마이그레이션이 필요 없다.
모든 변경은 `src/services/usageAnalytics.ts`의 `getUsageAdoptionDashboard()` 경로에 국한된다.

## Technical Context

**Language/Framework**: TypeScript, Vue 3, Supabase JS (`window.$supabase` 직접 사용)

**대상 파일**: `src/services/usageAnalytics.ts` (집계 서비스),
표시 화면 `src/views/admin/tabs/UsageAdoptionDashboard.vue` 는 변경 없음

**의존 데이터**:
- `configuration` `key='organization'` → `value.chart` (조직도 재구현 스펙의 저장 포맷,
  읽기 전용 — `orgChartModel.ts` 노드 규약: `id`/`data`/`children`, 부서 `data.isTeam===true`)
- `proc_def` (`id`, `uuid`, `name`), `tb_bpmn_model` (`id`, `proc_def_id`, `name`)
- `app_usage_events` (식별자 + 부서 스냅샷 + `proc_def_id`/`model_id`)

**Constraints**:
- PAL 전용 레포 방침이나, 이 화면(admin 콘솔)과 조직도 저장 포맷은 양 모드 공용 —
  읽기 전용 해석 변경이므로 비 PAL 동작에 영향 없음.
- 조직도 저장 포맷 불변(다른 화면들이 공유). 부서명은 조직도 전체에서 유일
  (공백·대소문자 무시) — 이름 기반 팀 병합의 전제.
- 사용 추적은 앱 흐름을 깨지 않아야 함(모든 실패는 무해하게 폴백).

## 설계 결정

1. **표시 시점 해석 vs 기록 시점 스냅샷**: 기록 측(`resolveIdentity`)에 조직도 조회를
   넣으면 이벤트마다 비용이 들고 과거 데이터는 여전히 틀린다. 집계 시 1회 조회로
   현재 조직도를 최우선 적용하는 쪽을 선택 (FR-007).
2. **팀 판정 우선순위** (FR-002): 조직도 인덱스 → 이벤트 스냅샷 → users 부서 컬럼 →
   Unassigned. 스냅샷 폴백은 이벤트 select 에 부서 컬럼을 추가해 복구.
3. **식별자 매칭**: `organizationUtils.ts`와 동일하게 trim+lowercase 정규화, 복수
   식별자(uid/email/이름) 시도. 중복 배치는 첫 배치 우선.
4. **중복 병합 전략**:
   - 프로세스: 별칭(소문자 `proc_def.id`/`uuid`/`tb_bpmn_model.id`) → 대표 키
     (`proc_def.id`) 사전을 만들어 집계 키를 정규화.
   - 팀: 폴백 팀 이름을 `normalizeTeamName` 규칙(공백 제거+소문자)으로 조직도
     `teamsByName`과 대조해 일치 시 조직도 팀 id로 치환.

## 변경 내역 (구현 완료)

`src/services/usageAnalytics.ts`:

| 구분 | 내용 |
|---|---|
| 추가 | `OrgTeamRef`/`OrgChartIndex` 타입, `normalizeIdentifier`, `normalizeTeamNameKey` |
| 추가 | `buildOrgChartIndex(rawValue)` — chart 트리 워크로 3개 인덱스 구축 |
| 추가 | `orgTeamOf(index, value)` — 복수 식별자로 소속 부서 조회 |
| 변경 | `Promise.all`에 `configuration` 조회 추가, 이벤트 select 에 `user_name`/`department_*`/`org_*` 추가, `proc_def` select 에 `uuid` 추가 |
| 추가 | `procCanonicalKey` 별칭 사전 + `canonicalProcKey()`, uuid→name 매핑 |
| 추가 | `canonicalizeFallbackTeam()`, `resolveTeamPreferOrg()` |
| 변경 | `users.forEach` 팀 배정, `eventTeam()`, `toUserRanking()` 이 새 판정 사용 |
| 변경 | `modelViewMap` 집계 키·`modelTop` 이름 해석이 canonical 키 사용 |

## Verification

- 파일 스코프 `tsc --noEmit` (스크래치 tsconfig, `skipLibCheck`) — 해당 파일 오류 0.
- 수동 검증 시나리오는 spec.md 의 Acceptance Scenarios / Independent Test 참조.
