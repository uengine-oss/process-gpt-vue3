# Feature Specification: 테넌트 관리자 사용자화 — 도메인 관리·미분류 정리·메뉴 목록 설정

**Feature Branch**: `009-tenant-admin-customization`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "매뉴얼 기반으로 사용자화가 부족한 부분(도메인 수정/삭제, 미분류 도메인, 메뉴 목록 설정 등)을 찾아 수정하여 각 테넌트의 관리자가 uEngine PAL을 자신의 업무 환경에 맞춰 사용할 수 있도록 한다."

**Constraint**: 이 레포의 모든 변경은 PAL 모드 전용(`window.$pal`). 비 PAL 동작은 그대로 둔다.

## 배경 (코드 조사 결과)

- 도메인 마스터는 `configuration(key='metrics').value.domains` JSONB, 계층은 `configuration(key='proc_map')`. 도메인↔계층 연결은 major 노드의 `domain`/`domain_id` 문자열 필드뿐.
- 현행 화면 `/process-architecture`(프로세스 체계도)에는 도메인 **추가**만 존재(`saveDomainAdd`, admin+PAL). 수정/삭제/순서변경 UI 없음. `DOMAIN_SORT_ORDER` 6개(특정 고객사 값)가 하드코딩되어 있고 `domains[].order`는 저장만 되고 미사용.
- 레거시 `/definition-map`의 도메인 삭제는 metrics만 지우고 proc_map을 정리하지 않아, 현행 화면의 `deriveDomainsFromProcMap` 추론으로 도메인 칩이 부활함.
- `미분류`는 `uncategorizedProcess.js`에서 "편집 금지 임시 노드"로 선언됐지만, 어떤 CRUD 경로도 이 가드를 호출하지 않음. 현행 화면에는 미분류 프로세스 일괄 재배정 UI가 없고, major 편집 다이얼로그의 도메인 선택은 해제(clearable)가 불가.
- 사이드바 메뉴는 `VerticalSidebar.vue`에 하드코딩. `menu_role_overrides` 테이블 + `menuRoleOverrides.ts` 캐시 + `lookupRequiredRole()` 체인은 완성돼 있으나 관리 UI(매뉴얼 19장 5절 "권한별 메뉴/기능관리")가 미구현. 테넌트별 메뉴 숨김/이름/순서 설정은 저장소·UI 모두 없음.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 도메인 수정/삭제/순서 관리 (Priority: P1)

테넌트 관리자가 프로세스 체계도 화면에서 도메인 이름·색상을 수정하고, 불필요한 도메인을 영향 범위를 확인한 뒤 삭제하며, 도메인 표시 순서를 조정한다.

**Why this priority**: 도메인은 체계도·리뷰보드·KPI·정책문서 등 전 화면의 최상위 분류 축인데 현재 오탈자 하나 고칠 방법이 없음.

**Independent Test**: `/process-architecture`에서 도메인 관리 다이얼로그를 열어 이름 변경→체계도·필터 칩에 즉시 반영, 삭제→소속 major가 미분류로 이동함을 확인.

**Acceptance Scenarios**:

1. **Given** admin이 PAL 모드에서 체계도 화면을 열었을 때, **When** 도메인 관리 다이얼로그에서 도메인 이름을 변경하면, **Then** metrics.domains와 proc_map의 모든 major 도메인 참조가 함께 갱신되고(체계도에서 프로세스가 떨어져 나가지 않음) 감사 로그 `process_domain_update`가 남는다.
2. **Given** 도메인에 major가 소속된 상태에서, **When** 도메인 삭제를 시도하면, **Then** 영향 받는 major/프로세스 수가 확인 다이얼로그에 표시되고, 확정 시 metrics에서 제거되며 소속 major의 도메인 참조가 정리되어 미분류로 이동한다(도메인 칩 부활 없음). 감사 로그 `process_domain_delete`.
3. **Given** 도메인이 여러 개일 때, **When** 위/아래 버튼으로 순서를 바꾸면, **Then** `domains[].order`가 저장되고 도메인 칩·트리·계층 뷰 정렬이 order를 따른다.
4. **Given** 비관리자 또는 비 PAL 모드, **When** 체계도를 열면, **Then** 도메인 관리 진입점이 보이지 않는다.

---

### User Story 2 - 미분류 도메인 정리 (Priority: P2)

테넌트 관리자가 미분류에 쌓인 프로세스(major)를 일괄로 원하는 도메인에 재배정하고, 반대로 특정 major를 미분류로 되돌릴 수 있다. `미분류`는 시스템 예약 항목으로서 이름 변경/삭제가 차단된다.

**Why this priority**: 신규 도입 테넌트는 대부분 프로세스가 미분류로 시작하므로, 재배정 UI가 없으면 도메인 기능 자체를 쓸 수 없음.

**Independent Test**: 미분류 major가 있는 상태에서 "미분류 정리" 다이얼로그로 2건을 특정 도메인에 배정 → 체계도에 반영. major 편집에서 도메인 해제 → 미분류로 복귀.

**Acceptance Scenarios**:

1. **Given** 도메인 미지정 major가 존재할 때, **When** admin이 미분류 정리 다이얼로그에서 여러 major를 선택해 대상 도메인을 지정하면, **Then** proc_map의 해당 major에 도메인이 기록되고 체계도·필터에 즉시 반영된다.
2. **Given** major 편집 다이얼로그에서, **When** 도메인 선택을 해제(clear)하고 저장하면, **Then** 그 major는 미분류로 표시된다.
3. **Given** 도메인 관리 다이얼로그(현행)와 레거시 도메인 CRUD에서, **When** `미분류`(uncategorized) 항목에 이름 변경/삭제를 시도하면, **Then** 편집 불가로 차단된다(`isUncategorizedProcess` 가드).

---

### User Story 3 - 메뉴 목록 설정 (Priority: P1)

테넌트 관리자가 관리자 콘솔의 "메뉴 관리" 화면에서 (a) 메뉴별 최소 접근 역할을 조정하고(매뉴얼 19장 5절), (b) 테넌트에 불필요한 메뉴를 숨기고, (c) 메뉴 표시 이름을 자사 용어로 바꾸고, (d) 섹션 내 표시 순서를 조정한다. 설정은 PAL 사이드바에 반영된다.

**Why this priority**: 매뉴얼에 이미 "권한별 메뉴/기능관리"가 기술되어 있으나 실제 화면이 없고, 메뉴 하드코딩 때문에 테넌트별 업무 환경 맞춤이 불가능.

**Independent Test**: `/admin-console/menu-settings`에서 특정 메뉴를 숨김 → 사이드바에서 사라짐. 이름 변경 → 사이드바 라벨 교체. 필요 역할 상향 → 해당 역할 미만 사용자에게 메뉴 미표시.

**Acceptance Scenarios**:

1. **Given** admin이 메뉴 관리 화면을 열면, **When** 목록이 로드될 때, **Then** `MENU_DEFINITIONS` 기반으로 섹션·메뉴명·경로·표시 여부·필요 역할이 표로 표시된다.
2. **Given** 특정 메뉴의 필요 역할을 변경하면, **When** 확인 다이얼로그에서 기본 권한과 변경 전·후를 확인하고 저장하면, **Then** `menu_role_overrides`에 upsert되고(기본값 복귀 시 행 삭제) 사이드바·접근 제어에 반영되며 감사 로그가 남는다.
3. **Given** 메뉴 숨김/이름/순서를 변경하면, **When** 저장하면, **Then** 테넌트 설정(`configuration` key=`menu_settings`)에 저장되고 PAL 사이드바(프로세스 관리·조직 관리·분석·관리자 섹션)가 숨김/라벨/순서를 반영한다.
4. **Given** 숨김 처리된 메뉴, **When** 사용자가 URL로 직접 접근하면, **Then** 접근 자체는 기존 역할 검사(라우팅/AdminConsoleLayout)를 따른다(숨김은 표시 설정일 뿐 권한 축소가 아님을 화면에 안내).
5. **Given** 비 PAL 모드, **Then** 메뉴 관리 화면·사이드바 반영 로직은 동작하지 않는다(기존 동작 유지).

### Edge Cases

- 도메인 rename 시 id는 유지(파생 참조 `proc_def.domain_id`, `kpi_targets`, `audit_policy.domains`가 id 기준이므로 깨지지 않음). 화면 표시는 name 기준으로 갱신.
- 도메인 삭제 시 KPI/정책문서 등 id 참조는 남을 수 있음 — 확인 다이얼로그에 "다른 화면의 참조는 유지되며 이름만 표시되지 않을 수 있음" 고지.
- 편집 락: 도메인 구조 변경(F1/F2)은 체계도 편집 락과 무관한 metrics/proc_map 쓰기이므로, 저장 직전 최신 데이터 재로드 후 병합해 덮어쓰기 유실을 최소화.
- 메뉴 전부 숨김 방지: `메뉴 관리` 자기 자신은 숨김 불가.
- 미분류(`미분류`/`uncategorized`)는 도메인 목록에서 잠금 표시(수정/삭제 비활성).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 체계도 화면에 admin+PAL 전용 "도메인 관리" 다이얼로그 제공 — 목록/이름·색상 수정/삭제/순서(위·아래) 지원.
- **FR-002**: 도메인 rename은 metrics.domains[].name 갱신 + proc_map 내 모든 major의 `domain`/`domain_id`/`business_domain` 참조 동시 갱신(cascade) + proc_def 계층 동기화.
- **FR-003**: 도메인 삭제는 영향 범위(major/프로세스 수) 표시 후, metrics 제거 + 소속 major의 도메인 참조 제거(→미분류)로 dangling 참조를 남기지 않는다.
- **FR-004**: 도메인 정렬은 `domains[].order` 우선, 없으면 기존 시드 순서 유지(하위호환).
- **FR-005**: `미분류`는 `isUncategorizedProcess` 가드로 현행·레거시 모든 도메인 CRUD에서 수정/삭제 차단.
- **FR-006**: 체계도 화면에 "미분류 정리" 다이얼로그 — 도메인 미지정 major 목록에서 다중 선택 후 대상 도메인 일괄 배정.
- **FR-007**: major 편집 다이얼로그의 도메인 선택을 해제 가능(clearable)하게 하여 미분류 복귀 지원.
- **FR-008**: 관리자 콘솔에 "메뉴 관리" 화면 신설(`/admin-console/menu-settings`) — MENU_DEFINITIONS 기반 표.
- **FR-009**: 필요 역할 변경은 `menu_role_overrides` upsert/삭제로 저장(확인 다이얼로그 포함), 기존 `lookupRequiredRole` 체인으로 즉시 유효.
- **FR-010**: 메뉴 숨김/라벨/순서는 `configuration(key='menu_settings')`에 테넌트별 저장(`{ items: { [path]: { hidden, label, order } } }`).
- **FR-011**: PAL 사이드바는 menu_settings와 필요 역할을 반영해 항목 숨김/라벨 교체/정렬. 비 PAL 사이드바는 변경 없음.
- **FR-012**: 도메인 수정/삭제, 미분류 일괄 배정, 메뉴 설정 변경은 감사 로그에 기록(`process_domain_update`, `process_domain_delete`, `process_uncategorized_assign`, `menu_settings_update`, `menu_role_override_update`).

### Key Entities

- **configuration(key='metrics').domains**: `[{id, name, color, order}]` — id 불변, name/color/order 편집 대상.
- **configuration(key='menu_settings')**: `{ items: { [menuPath]: { hidden?: boolean, label?: string, order?: number } } }` — 신규 키(테이블 추가 없음).
- **menu_role_overrides**: 기존 테이블 재사용(행 존재=오버라이드, 삭제=기본값 복귀).

## Success Criteria *(mandatory)*

- **SC-001**: 관리자가 UI만으로 도메인 이름 변경·삭제·순서 조정을 완료할 수 있고, 삭제된 도메인이 화면에 부활하지 않는다.
- **SC-002**: 미분류 major를 UI에서 일괄 재배정할 수 있으며, 미분류 항목 자체는 어떤 경로로도 삭제/개명되지 않는다.
- **SC-003**: 관리자가 UI만으로 메뉴 숨김/이름/순서/필요 역할을 설정하고 사이드바에서 즉시 확인할 수 있다.
- **SC-004**: 비 PAL 모드 화면·동작에 회귀 없음 (`npm run build` 통과).
- **SC-005**: 변경 기능 목록과 사용자 가이드(매뉴얼)가 `docs/manuals/`에 산출된다.
