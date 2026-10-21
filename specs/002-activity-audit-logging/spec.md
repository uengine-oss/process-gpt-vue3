# Feature Specification: 활동 로그 전면 수집 (Activity Audit Logging Coverage)

**Feature Branch**: `002-activity-audit-logging`

**Created**: 2026-09-16

**Status**: Implemented (2026-09-16)

**Input**: 감사로그 > 활동 로그에 사용자·관리자의 모든 활성 페이지에 대한 로그가 적재되어야 한다. 현재는 프로세스 순서도, 속성 스키마 관리, 관리자 보안 설정, Task 종류관리만 적재됨. 로그인·조회·등록·수정·삭제·다운로드 등 주요 행위를 모두 기록하고, docs/logging/logging-test.md에 기능별 테스트 가이드를 작성한다.

## Current State (조사 결과 요약)

- 기록 경로는 이미 단일화되어 있음: `adminConsole.writeAdminAuditLog(entry)` → `PalModeBackend.insertAdminAuditLog` → `admin_audit_log` 테이블 (append-only, RLS, actor 서버측 강제, 365일 보존). action/target_type에 DB CHECK 없음 → **마이그레이션 불필요**.
- 뷰어: `/admin-console/audit-trail` (`src/views/admin/tabs/AuditTrail.vue`) — 기본 탭 "관리자 감사 로그"가 곧 활동 로그. `ADMIN_ACTION_LABELS`/`TARGET_TYPE_LABELS`에 없는 코드는 필터에 안 뜨고 라벨이 공백으로 렌더링됨.
- 로그인은 이미 `auth_login_audit`(로그인 이력 탭)에 적재됨 (login/login_failed/login_oauth/logout). 다운로드는 `file_download_log`(다운로드 이력 탭).
- **조회(view) 로그는 어떤 페이지에도 없음.** CUD 로그는 admin-console 일부 탭·프로세스 순서도·속성 스키마·보안 설정·Task 종류에만 존재.
- 기존 버그: `ProcessArchitecture.vue:1639` `logExport`가 존재하지 않는 `export_log` 테이블에 insert(항상 무음 실패). `audit_retention_update`·`security_settings_update` 액션은 기록되지만 라벨 맵에 없음.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 페이지 조회 로그 (Priority: P1)

관리자가 활동 로그 탭에서 "페이지 조회" 액션으로 필터하면, 대상 페이지(프로세스 체계도, 검토 보드, 프로세스 목록, 용어 사전, 조직도, 권한 변경 신청, 분석 대시보드, admin-console 하위 전 탭)에 사용자가 진입한 이력이 페이지 한글명과 함께 보인다.

**Why this priority**: 사용자가 명시한 완료 조건("모든 조회 활동에 대한 로그가 정상적으로 표시")의 핵심.

**Independent Test**: 각 페이지를 방문 → 활동 로그 탭에서 액션=페이지 조회 필터 → 방문한 페이지명이 대상에 표시.

**Acceptance Scenarios**:

1. **Given** PAL 모드 로그인 상태, **When** `/process-architecture` 등 대상 라우트 진입, **Then** `admin_audit_log`에 `page_view` 행이 적재되고 활동 로그 탭에 페이지 한글명으로 표시된다.
2. **Given** 같은 페이지 내 쿼리 변경만 발생, **When** 라우트 fullPath의 path가 동일, **Then** 중복 조회 로그를 남기지 않는다.
3. **Given** 감사 로그 페이지(`/admin-console/audit-trail`) 자체 진입, **Then** 조회 로그가 적재된다(자기 자신 포함, 단 무한 루프 없음 — 조회는 라우트 진입 시 1회만).

---

### User Story 2 - 등록/수정/삭제 행위 로그 (Priority: P1)

각 대상 페이지의 생성·수정·삭제·상태 변경 행위가 기존 `<resource>_<verb>` 규약으로 활동 로그에 적재된다.

**Independent Test**: 페이지별 대표 CUD 행위 1건 수행 → 활동 로그에서 해당 액션 필터로 확인.

**Acceptance Scenarios** (누락 지점만 — 기존 적재 지점은 유지):

1. 프로세스 체계도: 도메인 추가, 프로세스 등록/수정/이동, 재구조화 초안 적용 시 로그 적재.
2. 검토 보드: 일괄 승인/반려/게시 시 로그 적재.
3. 프로세스 목록(call-activity-management): 삭제 시 로그 적재.
4. 용어 사전: 용어 등록/수정/삭제 시 로그 적재(글로서리 스토어 경유 모든 진입점).
5. 조직도: 팀 추가/삭제/수정, 구성원 배치/제외, 역할 변경, 에이전트 추가/삭제, 차트 저장 시 로그 적재.
6. 권한 변경 신청: 신청 제출, 승인/반려 시 로그 적재.
7. 분석 대시보드: 대시보드 설정 저장 시 로그 적재.
8. admin-console: Task 카탈로그 CRUD, 거버넌스 스튜디오 블랙리스트 추가/제거 등 미적재 탭 보완.

---

### User Story 3 - 다운로드/내보내기 로그 (Priority: P2)

CSV/Excel/PDF/PNG 내보내기 행위가 활동 로그에 적재된다.

**Acceptance Scenarios**:

1. 프로세스 체계도 내보내기(runExport) 시 죽은 `export_log` insert를 `admin_audit_log`(`process_architecture_export`)로 대체.
2. 감사 로그 탭의 CSV 내보내기 4종(승인/관리자/로그인/다운로드) 시 `audit_export` 로그 적재.
3. 속성 스키마 템플릿 내보내기 시 로그 적재.

---

### User Story 4 - 뷰어 정합성 및 테스트 가이드 (Priority: P1)

새로 추가되는 모든 action/target_type이 활동 로그 화면의 라벨·필터에 정상 표시되고, 유저가 직접 검증할 수 있는 가이드 문서가 제공된다.

**Acceptance Scenarios**:

1. 신규 액션 코드 전부가 `ADMIN_ACTION_LABELS`, 신규 target_type이 `TARGET_TYPE_LABELS`에 등록되어 필터 드롭다운에 나타난다.
2. 기존 누락 라벨(`audit_retention_update`, `security_settings_update`) 보정.
3. `docs/logging/logging-test.md`에 페이지/기능별 "행위 → 기대 로그(액션·대상)" 표와 확인 절차가 작성된다.

### Edge Cases

- 비 PAL 모드: 대상 라우트 자체가 없거나(`window.$pal` 스프레드) 백엔드에 `insertAdminAuditLog`가 없음 → 조회 로그 훅은 `window.$pal` 가드, 행위 로그는 PAL-safe 래퍼(`writeAdminAuditLog` try/catch) 경유로 무해해야 한다. **비 PAL 동작 변경 금지.**
- 로그 실패가 본 기능 흐름을 깨면 안 됨(기존 규약: 예외 삼킴 + console.error).
- `/auth*` 등 미인증 라우트는 조회 로그 대상 아님. actor 미확정 상태(로그인 직후 레이스)에서는 기존 fallback(localStorage) 규약을 따른다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 대상 라우트 진입 시 `admin_audit_log`에 `action: 'page_view'`, `target_type: 'page'`, `target_id: <route path>`, `target_name: <MENU_DEFINITIONS 한글 라벨>` 행을 적재해야 한다. 라우터 전역 훅 1곳(중앙집중)에서 처리하며 대상 라우트 allowlist는 사용자 지정 8종(+admin-console 하위 전체)이다.
- **FR-002**: 동일 path 연속 진입(쿼리만 변경)은 중복 적재하지 않는다.
- **FR-003**: US2에 열거된 CUD 행위는 `adminStore.writeAdminAuditLog`로 `<resource>_<verb>` 규약에 맞춰 적재하고, 가능하면 before/after 스냅샷을 포함한다.
- **FR-004**: US3의 내보내기 행위를 적재하고 `export_log` 죽은 코드를 제거·대체한다.
- **FR-005**: 신규 action/target_type/변경키를 `AuditTrail.vue`의 라벨 맵 3종에 등록한다.
- **FR-006**: 로그인/로그아웃은 기존 `auth_login_audit`(로그인 이력 탭) 체계를 유지한다(중복 적재 금지). 테스트 가이드에 확인 방법을 포함한다.
- **FR-007**: 다운로드 파일류는 기존 `file_download_log` 체계 유지, 내보내기(생성형 export)는 `admin_audit_log`에 적재한다.
- **FR-008**: `docs/logging/logging-test.md`를 작성한다 — 기능별: 수행 행위, 기대 액션 코드/라벨, 확인 위치(탭·필터), 기존 `docs/security-test-guide.md` 형식을 따른다.
- **FR-009**: 모든 변경은 PAL 모드에서만 동작을 바꾼다. 로깅 호출은 실패해도 기능 흐름을 깨지 않는다.

### Key Entities

- **admin_audit_log**: 기존 테이블 그대로 사용. 신규 action 코드: `page_view`, `process_architecture_*`(domain_create/process_create/process_update/process_move/restructure_apply/export), `review_bulk_approve/reject/publish`, `call_activity_delete`, `glossary_term_create/update/delete`, `org_chart_update`, `org_team_create/update/delete`, `org_member_assign/remove`, `org_role_update`, `org_agent_create/delete`, `role_request_submit/approve/reject`, `dashboard_settings_update`, `task_catalog_create/update/delete`, `governance_blacklist_add/remove`, `audit_export`, `schema_export` 등. 신규 target_type: `page`, `glossary_term`, `organization`, `role_request`, `dashboard`, `task_catalog`, `governance`, `review`, `process_architecture`, `audit_log`.
- **auth_login_audit / file_download_log**: 변경 없음(가이드 문서에서 참조만).

## Success Criteria *(mandatory)*

- **SC-001**: 대상 8개 영역(+admin-console 하위 탭) 각각을 방문하면 활동 로그 탭에서 해당 페이지 조회 로그가 60초 내 확인된다.
- **SC-002**: 각 영역의 대표 CUD/내보내기 행위가 활동 로그에 올바른 한글 라벨로 표시되며, 라벨 공백 행이 0건이다.
- **SC-003**: 비 PAL 빌드에서 콘솔 에러·동작 변화가 없다.
- **SC-004**: `docs/logging/logging-test.md`만 보고 비개발자가 전 항목을 검증할 수 있다.

## Assumptions

- 조회 로그는 페이지 단위(라우트 진입)로 충분하며, 목록 내 개별 행 열람까지 추적하지 않는다(요구 문구 "페이지에 대한 로그" 기준).
- 로그인은 이미 로그인 이력 탭에 적재되므로 활동 로그 탭으로 이중 적재하지 않는다. signUp/resetPassword 감사로그는 RPC action CHECK 제약으로 마이그레이션이 필요하므로 본 스펙 범위 외.
- `app_usage_events`(usage analytics)는 별도 체계로 유지 — 활동 로그와 통합하지 않는다.
- 조회 로그 볼륨 증가는 기존 365일 보존·아카이브 정책(`archive_expired_audit_logs`)이 흡수한다.
- 죽은 메뉴(`/admin-console/suppliers`, `organization-dmn-rules`)는 라우트가 없으므로 대상 아님.
