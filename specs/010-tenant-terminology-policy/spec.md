# Feature Specification: 테넌트 용어·분류축·운영 정책 사용자화

**Feature Branch**: `010-tenant-terminology-policy`
**Created**: 2026-09-28
**Status**: Implemented
**Input**: specs/009-tenant-admin-customization/next-prompt.md (프롬프트 원문은 prompt-history.md)
**Constraint**: 모든 변경은 PAL 모드 전용. 기본값이 곧 기존 동작이라 설정이 없는 테넌트·비 PAL 모드는 그대로 동작한다.

## 배경 (코드 검증 결과)

- 계층 용어(도메인/메가/메이저/서브)는 ko.json 6개 네임스페이스와 4개 뷰의 한글 fallback 리터럴에 중복.
- 진행 단계는 `STAGE_DEFS`(TS hex) + ExecutiveSummary CSS + HierarchyView `--stage-rgb` 3중 정의. wip/sunset 은 ProgressBadge 에 별도 hex.
- 카드 보기 분류축은 `processClassification.ts` 와 `ProcessArchCardView.vue` 에 COLUMN_DEFS 가 중복되고, 열 이름은 브라우저 localStorage 에만 저장. 열 이동 시 `proc_map.major.category` 에 한글 라벨('설계')을 기록.
- 도메인 추론은 `DOMAIN_SORT_ORDER` 6개(특정 고객사) 시드로 텍스트 매칭 → 색상/순서 저장 시 metrics 에 영속화되어 굳음.
- 정책값: 공람 30일(백엔드 2곳), 체계도 D-day 30일 재계산(DB `public_feedback_ends_at` 미사용), D-7/정체 7일(리뷰보드 3곳), 휴지통 30일(스토어 8곳 + 백엔드 + 화면), 2080시간·주기 계수·인건비 단가 5곳.
- 역할 라벨은 `ROLE_META` 고정. 런타임 i18n 오버라이드(`mergeLocaleMessage`) 0건.
- 휴지통 영구삭제는 `RecycleBin.vue` mount 시 클라이언트에서만 실행.

## User Scenarios & Testing

### US1 - 사용자 정의 메뉴 항목 (P1)
관리자가 메뉴 관리에서 임의 경로(`/merge-requests`)나 외부 URL 메뉴를 추가/수정/삭제하고, 섹션·아이콘·최소 역할·순서를 지정한다. 사이드바에 즉시 반영된다.
- Given 메뉴 관리 화면, When "사용자 정의 메뉴 추가"에서 라벨·대상·섹션 입력 후 저장, Then `configuration(menu_settings).customItems` 에 저장되고 사이드바 해당 섹션 끝(또는 order 위치)에 표시. 외부 URL 은 새 탭.
- 최소 역할은 사이드바 표시 조건일 뿐이며 URL 접근 권한은 기존 검사에 따른다(화면 안내).

### US2 - 용어 사용자화 (P1)
계층 레벨명 4종과 진행 단계 7종(0~4단계 + 차세대 기획 중/폐기 예정)의 표시명·짧은 이름·색상을 테넌트가 변경한다.
- Given 용어 설정 저장, Then i18n 런타임 메시지(`terminology.*` + 레거시 중복 키)가 `mergeLocaleMessage` 로 덮이고, `STAGE_DEFS`(reactive)·`:root` CSS 변수(`--pal-stage-*-rgb`)가 갱신되어 체계도/대시보드/리뷰보드/배지가 같은 값을 쓴다.

### US3 - 분류축(카드 보기 열) 사용자화 (P1)
열 key/라벨/색/아이콘/키워드를 정의하고 폴백 열을 지정한다. ID 코드 기반 추론(`X.1` → 1열)은 끌 수 있다.
- Given 열 이동, Then `proc_map.major.category` 에 라벨 대신 **key** 가 기록된다. 읽기는 라벨/키 모두 허용.
- "저장된 분류 값을 key 로 변환" 버튼으로 기존 proc_map 을 일괄 마이그레이션(감사 로그 `process_classification_migrate`).

### US4 - 도메인 추론 시드 제거 (P2)
고정 시드를 제거하고 metrics.domains(테넌트 도메인 목록) 기반으로만 추론하며, 추론 자체를 끌 수 있다.
- 도메인 관리 다이얼로그에 "추론 도메인 검토" 섹션: 명시 배정 major 가 0인 도메인을 추론 전용으로 표시하고 [고정](명시 배정으로 전환) / [제거] 가능.

### US5 - 운영 정책값 설정 (P1)
공람 기간, D-경보 일수, 정체 기준 일수, 휴지통 보존 일수, 연간 근무시간, 주기 환산 계수, 연간 인건비 단가, 통화를 `/admin-console/operation-policy` 에서 조정한다(보안 설정과 같은 카드형 UI + 감사 로그).
- 체계도 D-day 는 DB `public_feedback_ends_at` 을 우선 읽고, 없을 때만 시작일 + 정책 일수로 계산.
- 휴지통 만료 항목은 DB 함수 `purge_expired_recycle_bin()` + pg_cron(매일 03:30) 이 정리한다. 클라이언트 mount 시 purge 는 제거.

### US6 - 역할 표시 라벨 (P2)
5개 역할의 표시명·설명을 변경(추가/삭제 없음). `ROLE_META` 가 reactive 로 바뀌어 모든 소비처에 반영.

## Requirements

- FR-001 `menu_settings.customItems[]` = `{id,label,target,external,section,icon,order,requiredRole}`; 사이드바 4개 PAL 섹션 지원; 외부 URL 은 `href` + `_blank`.
- FR-002 `configuration(key='terminology')` = `{hierarchy:{domain,mega,major,sub}, stages:{<stage>:{label,shortLabel,color}}}`.
- FR-003 `configuration(key='process_classification')` = `{columns:[{key,label,color,icon,keywords[]}], fallback_key, infer_stage_from_code, infer_domain}`.
- FR-004 `configuration(key='operation_policy')` = `{public_feedback_days, feedback_alert_days, stalled_days, recycle_bin_retention_days, annual_working_hours, cycle_factors:{Monthly,Weekly,Daily}, annual_cost_per_fte, currency}` (범위 clamp: DB 함수와 동일).
- FR-005 `configuration(key='role_labels')` = `{<role>:{label,description}}`.
- FR-006 모든 설정은 `window.$pal` 일 때 부트스트랩(authClaims 재로딩)에서 1회 로드 후 reactive 로 적용. 실패 시 기본값.
- FR-007 감사 로그: `menu_settings_update`, `terminology_update`, `process_classification_update`, `process_classification_migrate`, `operation_policy_update`, `role_labels_update`, `process_domain_delete`, `process_domain_pin`.
- FR-008 회귀 없음: vue-tsc, vite build, `npm run test:unit` 통과. 비 PAL 동작 불변.

## Success Criteria

- SC-001 관리자가 UI만으로 메뉴·용어·분류축·정책·역할 라벨을 바꾸고 새로고침 후에도 유지된다.
- SC-002 설정이 없는 테넌트는 화면·저장 포맷이 이전과 동일하다.
- SC-003 휴지통 만료 항목이 화면을 열지 않아도 DB 스케줄로 정리된다.
- SC-004 매뉴얼 `docs/manuals/tenant-terminology-policy.md` 산출.
