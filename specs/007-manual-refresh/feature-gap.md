# 매뉴얼 격차 목록 (2026-09-17 조사)

기준: `docs/PI_System_통합_사용자_매뉴얼.docx`(6부 23장, 2026-08-21) +
`docs/manuals/` 4종(glossary, signup-approvals, process-export, task-catalog).
현재 코드(`src/router/MainRoutes.ts`, `VerticalSidebar.vue`)와 대조. PAL 모드 기준.

## A. 신규 매뉴얼 작성 대상

| # | 기능 | 라우트 | 화면 | 사이드바 | 권한 |
|---|------|--------|------|----------|------|
| 1 | RACI 설정 + 세부 업무 수행 절차 | /process-hierarchy (속성 패널) | RaciField, RaciMatrixDialog, TaskIoField | (순서도 내부) | 프로세스 편집 |
| 2 | 조직도 (부서 트리 편집·배치·사전등록·권한 관리) | /organization | OrganizationChartView + OrgDetailPanel | 조직관리 > 조직도 | owner/admin 편집 |
| 3 | 병합 요청함 + 병합 전 검증 | /merge-requests | MergeRequestBoard + Pr* | 없음(URL/알림 진입) | 검토자 |
| 4 | 목록 관리 (선택지 목록) | /admin-console/option-lists | OptionListManagement | 관리자 > 목록 관리 | admin |
| 5 | 보안 설정 (5개 섹션) | /admin-console/security-settings | SecuritySettings | 관리자 > 보안 설정 | admin |
| 6 | 감사 로그 (4탭 + CSV + 구조개편 이력) | /admin-console/audit-trail | AuditTrail | 관리자 > 감사 로그 | admin |
| 7 | 분석 대시보드 (Native 4뷰 + 탭 설정) | /analysis-dashboard | AnalysisDashboard | 분석 > 분석 대시보드 | reviewer+ |
| 8 | 알림 목록 + 내 수신함 | /notifications, /my-inbox | NotificationsPage, MyInbox | 알림 목록(PAL) | 전원 |
| 9 | 구조 재구성 흐름 (재구성 모드→특별 결재→Cut-over) | /process-architecture, /review-board/restructure, /admin-console/system-operations | ProcessArchRestructureStudio, RestructureApprovalBoard | 재구성 모드 버튼 | admin |

주요 근거:
- RACI: Task 요소 선택 시 속성 패널 RACI 섹션(R/A/S/C/I 5역할, R 비면 Lane 자동),
  툴바 RACI 버튼 → 통합 매트릭스(셀 클릭 순환). docx 5장은 담당자 영역만 다룸.
- 조직도: signup-approvals.md는 "가입 및 권한 승인" 탭만 커버. 조직도 탭
  (부서 추가/드래그 이동/미배치 배치/구성원 사전등록/권한 일괄 적용)은 미문서화.
- 병합 요청함: PAL에서는 사이드바·헤더 진입점이 없음 — 알림/URL로 진입. 매뉴얼에 명시.

## B. 기존 문서 보강 (docx 갱신 시 반영)

- 내 수신함(/my-inbox) 3탭(내 승인함/개선 요청함/내 상신함) — docx 10장에 없음 → A-8에 포함.
- 순서도 툴바 검증·필수 Rule 모아보기 — A-1 매뉴얼에서 함께 다룸.
- docx 17장(내부조직역할 관리): `/admin-console/suppliers` 라우트가 현재 코드에 없음(404).
  docx 갱신 시 주의 필요(이번 범위에서는 기존 장 유지).

## C. 제외

- 거버넌스 스튜디오(/admin-console/governance-studio): 프로토타입, 사이드바 의도적 숨김.
- 실행 인스턴스 관리, 외부 API 연동 상태: 사이드바 미노출 + 데이터 없음, 짧은 언급만.
- 온톨로지 익스플로러: 구현 3중, 안정화 전.
- /review-board-debug, /organization-before, VITE_FF_DEV_ROUTES 게이트 화면: dev 전용.
- 비 PAL 레거시(todolist, chats, strategy-board, analytics 7종 등): PAL 매뉴얼 범위 밖.

## D. docx 반영 계획

제7부 "조직·협업 신규 기능"(조직도, 병합 요청함, 알림·내 수신함, RACI·업무 절차)과
제8부 "관리자 신규 기능"(목록 관리, 보안 설정, 감사 로그, 분석 대시보드, 구조 재구성) +
기존 md 4종(용어 사전, 가입·권한 승인, 프로세스 내보내기, Task 카탈로그)을 장으로 추가.
