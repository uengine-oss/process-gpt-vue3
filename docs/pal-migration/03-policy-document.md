# 03. 사내 정책문서 (Policy Document Manager)

## 이관 파일

| 파일 | 출처 |
|---|---|
| `src/views/policy-document/PolicyDocumentManager.vue` | pi 동일 경로 (42K, 그대로 복사) |

## 라우트 / 사이드바

- PAL 블록에 `/policy-document` → PolicyDocumentManager
- 관리자 섹션 사이드바에 `사내 정책문서` (icon `submit-document`)

## 의존성 (모두 현재 프로젝트에 이미 존재)

- `window.$supabase` 직접 사용: `audit_policy`, `files`, `users` 테이블
- `backend.uploadFile` / `backend.downloadFile` (ProcessGPTBackend 기존 구현)
- `useAdminConsoleStore().writeAdminAuditLog` (stores/adminConsole.ts — pi와 동일 파일)
- `formatKST` (utils/datetime.ts)

## DB

- `20260507_audit_policy.sql`, `20260508_audit_policy_soft_delete.sql`, `20260515_audit_policy_domains.sql` (pi 그대로)
- deleted_by 통일: `20260520_audit_policy_unify_deleted_by.sql` (pi 20260519를 리네임 적용)
