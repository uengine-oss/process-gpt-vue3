# 워크아이템 화면 플러그인 (Workitem App Handler)

업무 시스템(MES·ERP·WMS …)의 기존 화면을 Process GPT 워크아이템의 '현재 작업' 영역에 임베드한다.
Process GPT 는 특정 업무 시스템을 모른다 — 시스템은 **등록 데이터**로만 붙는다.

- 데이터 계약은 그대로 폼(`formHandler:<formId>`)이다. 에이전트 실행·폴링·완료 처리·게이트웨이 조건은 바뀌지 않는다.
- `workitem_app` 에 앱(base_url, allowed_origin)을, `workitem_app_binding` 에 폼 → 화면 경로(view_path)를 등록하면
  FormWorkItem 이 그 화면을 iframe 으로 띄운다(`mode=replace` 폼 대신, `beside` 폼과 함께). 마이그레이션: `supabase/migrations/20261018_workitem_app_handler.sql`
- view_path 치환: `{task_id} {proc_inst_id} {proc_def_id} {activity_id} {form_id}`. 쿼리에 `pgpt_task / pgpt_inst / pgpt_activity` 가 자동으로 붙는다.
- 같은 출처(게이트웨이 경로, 예: `/myapp/`)를 권장한다. 다른 출처면 `allowed_origin` 을 정확히 적는다.

## postMessage 계약 (protocol 1)

| 방향 | type | 내용 |
|---|---|---|
| Process GPT → 앱 | `pgpt:workitem:init` | `workitem: { taskId, procInstId, procDefId, activityId, activityName, formId, status, readonly, values, user }` |
| 앱 → Process GPT | `pgpt:workitem:ready` | init 재요청 |
| 앱 → Process GPT | `pgpt:workitem:values` | `values` 를 폼 값에 병합 (데이터 계약 동기화) |
| 앱 → Process GPT | `pgpt:workitem:save` | 병합 후 중간 저장 |
| 앱 → Process GPT | `pgpt:workitem:submit` | 병합 후 제출 완료 (기존 폼 제출과 같은 경로) |
| 앱 → Process GPT | `pgpt:workitem:resize` | `height` 로 iframe 높이 조정 |

`readonly`(완료됐거나 내 일이 아닌 워크아이템)이면 save/submit 은 무시된다. 업무 데이터 자체의 수정 권한은 앱이 정한다.

## 문서로 프로세스 만들기 핸드오프

`/process-from-document?source=<같은 출처 문서 경로>&title=<프로세스 이름>&from=<보낸 시스템>` — 문서를 읽어 생성 대화방을 만들고
프로세스 생성 스킬을 바로 시작한다(`/chat?roomId=…&autosend=1`).
