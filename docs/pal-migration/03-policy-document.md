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

## 순서도 첨부 파일 공유

- `20260909000001_policy_document_usage.sql`을 프런트엔드와 함께 적용한다. 로컬 적용 검증을 완료했으며, 다른 환경에도 이 마이그레이션이 필요하다.
- 이어서 `20260909000002_policy_document_file_metadata.sql`을 적용한다. 크기가 없는 기존 문서는 Storage 객체의 실제 크기로 보완하며, 이후 등록하는 구형 첨부에도 동일하게 적용한다.
- 데이터 객체/저장소 참조의 파일 업로드는 `audit_policy`에 등록된다. **사내 정책문서에서 선택**으로 기존 파일을 연결할 때는 파일을 다시 업로드하지 않는다.
- 첨부에는 `policyId`, `fileName`, `bucket`, `path`, `size`를 보관한다. 기존 첨부의 버킷 생략은 `files`로 해석한다. 저장소의 같은 버킷·경로를 같은 문서로 식별한다.
- `proc_def` 저장 트리거가 현재 BPMN과 `definition.tobe_bpmn`에서 사용 관계를 갱신한다. 마이그레이션은 기존 순서도에도 같은 처리를 수행하므로 다시 저장할 필요가 없다. 과거 버전 스냅샷은 현재 사용 현황에 포함하지 않는다.
- 정책문서 목록의 **사용 중인 프로세스**에서 프로세스로 이동할 수 있다. 같은 프로세스의 여러 요소가 파일을 참조해도 프로세스는 한 번만 표시한다.
- 문서의 도메인은 직접 지정한 도메인과 현재 사용 프로세스들의 도메인을 합쳐 중복 없이 표시한다. 프로세스 도메인 변경이나 첨부 해제 후 새로고침하면 현재 관계에 맞게 표시되며, 직접 지정한 도메인은 유지한다.
- 첨부 해제/프로세스 삭제는 사용 관계만 제거한다. 문서 파일은 목록에 남는다. 사용 중인 문서는 삭제할 수 없으며, 모든 프로세스에서 첨부를 해제한 뒤 삭제한다.

검증 명령 (로컬 Supabase 및 Vite 실행 필요):

```bash
npm run typecheck
python3 supabase/tests/test_policy_document_usage.py
BASE_URL=http://127.0.0.1:5173 npx playwright test playwright/e2e/policy-document/policy-documents.spec.ts --reporter=list
```

DB 검증은 전체 마이그레이션, 기존 파일 반영, 다중 프로세스 재사용, XML 속성/CDATA, To-Be, 삭제·복원, 테넌트 격리를 검사한 뒤 롤백한다. 브라우저 검증은 실제 화면 컴포넌트를 사용하고 저장소/API 응답을 격리된 fixture로 제공한다.
