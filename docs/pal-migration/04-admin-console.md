# 04. 관리자 콘솔 탭

pi의 `/admin-console` 하위 탭들을 이관했다. 레이아웃(`src/views/admin/AdminConsoleLayout.vue`)은 양 프로젝트 동일(순수 router-view 셸)이라 수정 불필요.

## 이관 파일 (모두 pi `src/views/admin/tabs/` → 동일 경로 복사)

| 탭 | 파일 | 라우트 (`/admin-console/...`) | meta.adminTitle |
|---|---|---|---|
| 수정 잠금 | `DataFreezeManager.vue` | `data-freeze` | `adminConsole.tabFreeze` |
| 시스템 운영 (배너/점검) | `SystemOperations.vue` | `system-operations` | `adminConsole.tabSysOps` |
| KPI 목표 | `KpiTargetManager.vue` + `KpiProcessPicker.vue` + `KpiProcessPickerDialog.vue` | `kpi-targets` | `adminConsole.tabKpi` |
| 사용 활성도 | `UsageAdoptionDashboard.vue` | `usage-adoption` | `adminConsole.tabUsageAdoption` |
| 감사 로그 | `AuditTrail.vue` | `audit-trail` | `adminConsole.tabAudit` |
| 실행 인스턴스 관리 | `ExecInstanceAdmin.vue` | `exec-instances` | `실행 인스턴스 관리` |
| 거버넌스 스튜디오 | `src/views/governance-studio/DataGovernanceStudio.vue` | `governance-studio` | `adminConsole.tabGovernance` |
| PI Flag | `PiFlagPage.vue` + `PiFlagBoard.vue` + `PiFlagTypeManager.vue` | `pi-flags` | `PI Flag` |
| 프로세스 리스트 (모듈 관리) | `CallActivityManagement.vue` | (단독 라우트 `/call-activity-management`) | — |

기존에 이미 있던 탭: property-schemas(속성 스키마), recycle-bin(휴지통), task-types(Task 종류 설정).

**이관 제외 탭** (계정/조직 연동 — 제외 영역): signup-approvals, admin-requests, suppliers(InternalRoleManagement), organization-dmn-rules.

## 함께 이관한 유틸/공용 파일

| 파일 | 용도 |
|---|---|
| `src/utils/piFlagTypes.js` | PI Flag 구분값 CRUD (configuration/storage 기반). **주의: pi 원본 확장자가 .js** |
| `src/components/ui/common/UserIdentityText.vue` | 사용자 식별 표시 공용 컴포넌트 (CallActivityManagement 등이 사용) |

이미 현재 프로젝트에 동일하게 존재하여 복사 불필요했던 의존성: `stores/adminConsole.ts`(pi와 동일, writeAdminAuditLog 포함), `composables/blueprint/piFlagIssueExport.ts`, `utils/{datetime,userIdentity,softDeleteUser,processStages,authClaims}.ts`, `views/process-hierarchy/navigation.ts`, `ProcessHierarchyOpenButton.vue`.

## 변경 파일

### `src/router/MainRoutes.ts` (PAL 블록)
- `/admin-console` children에 위 8개 탭 라우트를 pi의 정의(이름/메타 포함) 그대로 삽입 (pi의 탭 순서 유지, 제외 탭만 생략).
- `/call-activity-management` 단독 라우트 추가.

### `src/layouts/full/vertical-sidebar/VerticalSidebar.vue`
- PAL 관리자 섹션 인라인 배열에 추가 (MENU_DEFINITIONS의 라벨/아이콘/순서 준수):
  수정 잠금(lock), 시스템 운영(settings), KPI 목표(target), 사용 활성도(graph-up-linear), 감사 로그(document), 실행 인스턴스(play-outline), PI Flag(flag-line-duotone)
- 프로세스 관리 섹션에 `프로세스 리스트`(delegation) → `/call-activity-management` 추가 (PAL 한정).
- 거버넌스 스튜디오는 MENU_DEFINITIONS상 `hiddenInSidebar`라 사이드바에 넣지 않음 (직접 URL로 접근).

### 아이콘 (public/assets/images/icon/)
- pi에서 복사: `settings.svg`, `target.svg`, `flag-line-duotone.svg` (Icons 컴포넌트가 public 경로에서 fetch하는 구조)

### `src/components/api/ProcessGPTBackend.ts`
- `getInstanceListByStatus()`: `filter.allParticipants` 옵션 추가 — true면 참여자 필터(matchArray)를 제거하고 테넌트 전체 인스턴스를 조회 (ExecInstanceAdmin용).

### `src/components/api/PalModeBackend.ts`
- `getGroupById(id)` 추가 (REST 시도 → 실패 시 null). KpiTargetManager가 조직 그룹 상세를 try/catch로 조회하는 경로 대응.

### `src/components/ui/list-pages/InstanceListPage.vue`
- `allUsers` prop 추가 (기본 false). true면 `currentOptions.allParticipants = true`로 백엔드에 전달 (init/handleSearch/handleFilter 3개 경로).
- **현재 프로젝트의 최신 정렬 로직(resolveSortField/resolveSortDirection/secondaryOrderBy)은 그대로 유지** — pi 버전으로 덮어쓰지 않고 최소 델타만 병합.

## i18n

- `adminConsole.*`(tabFreeze/tabSysOps/tabKpi/tabUsageAdoption/tabAudit/tabGovernance 등), `usageAdoption.*` 키는 현재 `ko.json`에 **이미 모두 존재**함을 확인 (추가 병합 불필요). en.json에 없는 일부 키는 pi en.json에도 없음 → 원본과 동일한 파리티.

## 백엔드 의존 (이전 세션에서 이미 이관 완료)

DataFreeze(getDataFreezeList/setDataFreeze/removeDataFreeze), KPI(saveKpiTargets/deleteKpiTarget/softDeleteKpiTarget/restoreKpiTarget/getKpiTargets), 감사로그(getAdminAuditLogs/insertAdminAuditLog), 시스템 운영(notice/maintenance/cutover 계열), 잠금(acquireLockWithStaleCheck/updateLockHeartbeat), PiFlag(getMetricsMap/getProcessDefinitionMap 기존 구현) — 모두 현재 백엔드에 존재 확인.
