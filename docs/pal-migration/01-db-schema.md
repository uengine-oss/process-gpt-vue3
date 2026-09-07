# 01. DB 스키마 (Supabase 마이그레이션)

pi의 `supabase/migrations/`를 현재 프로젝트로 이관했다. 파일명 타임스탬프의 사전순으로 적용되는 규칙은 동일하다.

## 신규 추가된 마이그레이션 (pi에서 그대로 복사 — 내용 동일)

| 파일 | 내용 |
|---|---|
| `00_consolidated_schema.sql` | pi 통합 스키마 스냅샷 |
| `20260130_bpmn_model_tables.sql` | BPMN 모델 테이블 |
| `20260130_proc_def_comments_approval.sql` | 프로세스 정의 코멘트/승인 |
| `20260130_standard_terminology.sql` | 표준 용어 |
| `20260213_add_cancelled_state.sql` / `20260213_assigned_reviewer.sql` / `20260213_kpi_review_board.sql` / `20260213_review_per_submission.sql` | 리뷰보드/KPI 확장 |
| `20260223_governance_workflow.sql` | 거버넌스 워크플로 (reviewer_type 등) |
| `20260303_comment_round_tracking.sql` | 코멘트 라운드 트래킹 |
| `20260403_role_based_rls.sql` | 역할 기반 RLS |
| `20260408_add_saved_at_to_proc_def.sql` | proc_def.saved_at |
| `20260409_review_owner_enforcement.sql` / `20260409_review_role_alignment.sql` / `20260409_review_submission_identity.sql` | 리뷰 권한/식별자 정비 |
| `20260413_add_proc_def_description.sql` | proc_def.description |
| `20260421_usage_adoption_analytics.sql` | **`app_usage_events` 테이블** — 사용/도입 분석의 데이터 원천 |
| `20260507_audit_policy.sql` / `20260508_audit_policy_soft_delete.sql` / `20260515_audit_policy_domains.sql` | **`audit_policy`(사내 정책문서) 테이블** + soft delete + 도메인 |
| `20260514_permissions.sql` | 커스텀 권한 (suppliers seed row 포함 — 제외 영역이지만 seed는 무해하여 원본 유지) |
| `20260514_users_last_seen.sql` | users.last_seen |
| `20260521_menu_role_overrides.sql` | 메뉴 역할 오버라이드 |
| `20260521_proc_def_editor_insert_policy.sql` | proc_def editor INSERT 정책 |
| `20260525_allow_owner_reviewer_type.sql` | reviewer_type 'owner' 허용 |
| `20260526_admin_audit_log_append_only.sql` | **`admin_audit_log`** append-only 강화 |
| `20260527_lock_rls_allow_editor.sql` | 편집 잠금 RLS |
| `20260612_sync_proc_map_name_rpc.sql` | proc_map 이름 동기화 RPC |
| `20260623_kst_timezone.sql` | DB 타임존 KST 설정 (`ALTER DATABASE ... SET timezone`) — 현재 DB에도 그대로 적용 가능 |
| `20260626_analysis_dashboard_reviewer_access.sql` | 분석 대시보드 reviewer 접근 |
| `20260629_add_owner_to_proc_def_version.sql` | proc_def_version.owner |
| `20260710_ontology_explorer_rpc.sql` | **온톨로지 익스플로러 RPC 3종** (`ontology_graph_health`, `ontology_business_graph`, `ontology_execution_rollup`) |
| `20260710_systems_soft_delete.sql` | systems soft delete 컬럼 (아래 신규 작성한 20260709보다 뒤에 적용됨) |

## 수정하여 이관 (ADAPTED)

### `20260511_external_api_health_table.sql`
- pi 원본 파일은 **동일 내용이 2회 중복**되어 있었다 (pi 쪽 버그 — 신규 부트스트랩 시 두 번째 `CREATE POLICY`에서 실패).
- 단일본으로 재작성하고, 각 `CREATE POLICY` 앞에 `DROP POLICY IF EXISTS` 가드를 추가하여 멱등성을 확보했다.
- 테이블: `external_api_health` (integration_target_name, call_address, health_status('정상'/'비정상' CHECK), last_check_time, error_message_log, manual_sync_enabled, last_manual_sync_requested_at 등).

## 신규 작성 (NEW — pi에 없던 파일)

### `20260709_systems_table.sql`
- pi에서 `systems` 테이블은 외부 REST 백엔드(pi-system-backend)가 소유하여 **DDL이 pi 레포에 없었다** (핸드오버 문서 12에도 "미확인"으로 표기).
- 프런트의 `System` 인터페이스와 `20260710_systems_soft_delete.sql`(ALTER 대상)의 요구사항으로부터 DDL을 새로 작성했다.
- 컬럼: `id UUID PK DEFAULT gen_random_uuid()`, `tenant_id`, `name`, `system_type`, `category`, `description`, `shortcut_link`, `is_active INTEGER DEFAULT 1`, `responsible_org_id`, `responsible_person`, `registration_status`, `created_by(_display)`, `created_at/updated_at`, `deleted_at`, `deleted_by`.
- 인덱스 `idx_systems_tenant_name`, public RLS(DROP-first 가드), `GRANT ALL TO authenticated`.
- 타임스탬프를 `20260709`로 하여 `20260710_systems_soft_delete.sql`보다 **먼저** 적용되게 했다.

### `20260520_audit_policy_unify_deleted_by.sql`
- pi의 `20260519_unify_deleted_by.sql`을 현재 프로젝트 상황에 맞게 조정한 파일. 현재 프로젝트에는 같은 날짜의 `20260519_pal_recycle_deleted_by.sql`이 이미 있어 적용 순서 충돌을 피하려고 `20260520`으로 명명했다.

## 기존 파일 수정

### `supabase/migrations/schema_merge.sql`
- `proc_def_comments.reviewer_type` CHECK에 `'owner'` 추가 (pi의 20260525 반영).
- `proc_def_approval_state.submitted_by_id` 컬럼 및 관련 뷰 컬럼 추가 (pi의 20260409 반영).

## 이관하지 않은 마이그레이션 (제외 영역)

- `20260609_lane_role_groups.sql`, `20260609_lane_role_groups_drop_deleted_by_trigger.sql`, `20260612_lane_role_group_members_member_type.sql`, `20260701_lane_role_groups_allow_editor.sql` — 조직도/레인 역할 그룹
- `20260708_suppliers_soft_delete.sql`, `20260609_rename_supplier_permission_label.sql` — 내부조직(suppliers)
- `20260519_deleted_by_auto_fill_trigger.sql`, `20260519_unify_deleted_by.sql` — 현재 프로젝트의 `20260519_pal_recycle_deleted_by.sql` / 신규 `20260520_audit_policy_unify_deleted_by.sql`로 대체
- `20260316_duplicate_definition_from_marketplace.sql` — pi 전용 마켓플레이스 RPC. 현재 프로젝트는 자체 마켓플레이스 구현(`20260709_process_component_marketplace.sql`)이 있고 해당 RPC를 호출하는 코드가 없다.
