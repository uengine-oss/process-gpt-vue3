# PI-System → PAL 모드 이관 문서

`~/IdeaProjects/playground-pi-system-web` (이하 **pi**) 프로젝트의 기능을 현재 프로젝트(process-gpt-vue3)의 **PAL 모드**(`window.$pal`)로 이관한 작업의 기록이다.
기준 문서: pi의 `docs/handover/` (README, 00-architecture-overview, 01-backend-catalog, pages/01–15).

## 범위

- **Frontend**: 화면/컴포넌트/서비스/스토어/라우팅/사이드바
- **DB Schema**: `supabase/migrations/` (Supabase 마이그레이션)

## 제외 영역 (goal에 명시)

계정 연동부분(조직도 포함)은 pi-system-web 전용이므로 **이관하지 않았다**:

- SSO 연동 (SsoGateway, ssoRoleSync)
- 회원가입 승인 (`admin-console/signup-approvals`)
- 역할 관리/권한 승인 (`admin-console/admin-requests`)
- 내부조직역할 관리 (`admin-console/suppliers`, InternalRoleManagement)
- 조직 DMN Rule 관리 (`admin-console/organization-dmn-rules`)
- 조직도 (organization-chart), `lane_role_groups` 관련 마이그레이션 일체
  (`20260609_lane_role_groups*.sql`, `20260612_lane_role_group_members_member_type.sql`, `20260701_lane_role_groups_allow_editor.sql`, `20260708_suppliers_soft_delete.sql`, `20260609_rename_supplier_permission_label.sql`)

또한 pi 핸드오버 문서에서 **미사용**으로 표시된 05 AN Transformation Studio는 이관하지 않았다.

## 기능 단위 문서 색인

| # | 기능 단위 | 문서 |
|---|---|---|
| 1 | DB 스키마 (마이그레이션 전체) | [01-db-schema.md](01-db-schema.md) |
| 2 | 시스템 관리 + API 연동 상태 | [02-system-management.md](02-system-management.md) |
| 3 | 사내 정책문서 | [03-policy-document.md](03-policy-document.md) |
| 4 | 관리자 콘솔 탭 (수정잠금/시스템운영/KPI/사용활성도/감사로그/실행인스턴스/거버넌스/PI Flag/프로세스 리스트) | [04-admin-console.md](04-admin-console.md) |
| 5 | 사용/도입 분석 (Usage Analytics) | [05-usage-analytics.md](05-usage-analytics.md) |
| 6 | 분석 대시보드 (Analysis Dashboard) | [06-analysis-dashboard.md](06-analysis-dashboard.md) |
| 7 | 온톨로지 익스플로러 (구/신 + Apache AGE) | [07-ontology-explorer.md](07-ontology-explorer.md) |
| 8 | 리뷰보드 확장 (전체 화면 pi 버전 이관 + 재구조화 승인 보드/제출 디버그) | [08-review-board-extensions.md](08-review-board-extensions.md) |
| 9 | 업무분장 (Work Assignment) | [09-work-assignment.md](09-work-assignment.md) |
| 10 | 공통 인프라 변경 (라우팅/사이드바/백엔드 어댑터/공용 컴포넌트) | [10-shared-infra.md](10-shared-infra.md) |

## 이관 방식 요약

- **PAL 게이팅**: 신규 라우트는 `src/router/MainRoutes.ts`의 `...(window.$pal ? [...] : [])` 블록 안에 두어 PAL 모드에서만 노출한다. 사이드바 노출은 `VerticalSidebar.vue`의 `pal` 분기에서 처리한다.
- **백엔드 호출**: pi가 외부 REST(`/pi-system-backend/...`)로 처리하던 조회는 `PalModeBackend`에서 "REST 시도 → 실패 시 Supabase 직접 조회(또는 안전한 빈 값)" 패턴으로 흡수했다. **pi-system-backend(`playground-pi-system-backend`)도 함께 이관되어 있으므로** systems CRUD는 pi와 동일한 REST 1차 경로로 동작하고(`vite.config.ts`에 dev 프록시 추가), 백엔드 미기동 시에만 Supabase 폴백이 동작한다 ([02-system-management.md](02-system-management.md)).
- **누락 메서드 안전망**: `BackendFactory`가 PAL 백엔드를 `wrapBackendWithNullSkip` Proxy로 감싸므로, 미구현 메서드 호출은 콘솔 경고와 함께 안전한 기본값을 반환한다 (크래시 방지).
- **파일 충돌 정책**: 두 프로젝트에 모두 존재하며 현재 프로젝트 쪽이 더 발전한 공용 파일(예: `InstanceListPage.vue`, `BpmnUengineViewer.vue`)은 **현재 버전을 유지**하고 필요한 최소 델타만 병합했다. 단 리뷰보드 화면군(`MyInbox.vue`/`ProcessReviewBoard.vue`/`ProcessReviewDetail.vue`)은 리뷰보드 라우트 전용임이 확인되어 pi 버전으로 전체 교체했다 ([08-review-board-extensions.md](08-review-board-extensions.md)).
