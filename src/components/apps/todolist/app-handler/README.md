# 워크아이템 화면 플러그인 (Workitem App Handler)

업무 시스템(MES·ERP·WMS …)의 기존 화면을 Process GPT 워크아이템의 '현재 작업' 영역에 임베드한다.
Process GPT 는 특정 업무 시스템을 모른다 — 시스템은 **등록 데이터**로만 붙는다.

- 데이터 계약은 그대로 폼(`formHandler:<formId>`)이다. 에이전트 실행·폴링·완료 처리·게이트웨이 조건은 바뀌지 않는다.
- `workitem_app` 에 앱(base_url, allowed_origin)을, `workitem_app_binding` 에 폼 → 화면 경로(view_path)를 등록하면
  FormWorkItem 이 그 화면을 iframe 으로 띄운다(`mode=replace` 폼 대신, `beside` 폼과 함께). 마이그레이션: `supabase/migrations/20261018_workitem_app_handler.sql`
- view_path 치환: `{task_id} {proc_inst_id} {proc_def_id} {activity_id} {form_id}`. 쿼리에 `pgpt_task / pgpt_inst / pgpt_activity` 가 자동으로 붙는다.
- 같은 출처(게이트웨이 경로, 예: `/myapp/`)를 권장한다. 다른 출처면 `allowed_origin` 을 정확히 적는다.

## 원칙
에이전트·폼이 만든 값은 업무 화면에 **저장 전 초안(`fill`)** 으로만 전달된다. 업무 데이터 저장은 업무 화면 자신의 저장, 또는 Process GPT 가 제출 전에 보내는 `save-request` 에 대한 응답으로만 한다.
그래서 사용자는 에이전트를 멈추고 화면을 고친 뒤 반영할 수 있다. 같은 출처여도 서로의 함수를 직접 부르지 않는다 — 메시지 계약만 쓴다.

## postMessage 계약 (protocol 2, protocol 1 호환)

| 방향 | type | 내용 |
|---|---|---|
| 앱 → PGPT | `pgpt:workitem:ready` | `{protocol:2, accepts:['fill','update','save-request','ack'], channel:true}` — 받을 메시지를 밝힌다 |
| PGPT → 앱 | `pgpt:workitem:init` | `{protocol, capabilities, workitem:{taskId, procInstId, procDefId, activityId, activityName, formId, status, readonly, values, user}}` (+ `channel:true` 면 MessagePort 전달, 이후 그 포트로만) |
| PGPT → 앱 | `pgpt:workitem:fill` | `{values, source:'agent'\|'form', draft:true}` — **저장하지 말 것**, 입력값만 채운다 |
| PGPT → 앱 | `pgpt:workitem:update` | `{status, readonly}` |
| PGPT → 앱 | `pgpt:workitem:save-request` | `{requestId}` — 화면 수정분을 저장하고 `saved` 로 응답 |
| 앱 → PGPT | `pgpt:workitem:saved` | `{requestId, ok, values?, error?}` |
| 앱 → PGPT | `pgpt:workitem:values` | `{values}` 폼 값 병합 |
| 앱 → PGPT | `pgpt:workitem:save` / `submit` | `{values, requestId?}` 병합 후 중간 저장 / 제출 → `ack {requestId, ok, stage}` |
| PGPT → 앱 | `pgpt:workitem:ack` | 앱의 save/submit 처리 결과 |
| 앱 → PGPT | `pgpt:workitem:resize` | `{height}` |

protocol 1 앱(ready 를 안 보내거나 protocol 1)은 `init` 만 받고, `fill`·`update`·`save-request`·`ack` 는 오지 않는다.
`readonly`(완료됐거나 내 일이 아닌 워크아이템)이면 save/submit 은 처리되지 않는다(`ack ok:false`).

## 문서로 프로세스 만들기 핸드오프

`/process-from-document?source=<같은 출처 문서 경로>&title=<프로세스 이름>&from=<보낸 시스템>` — 문서를 읽어 생성 대화방을 만들고
프로세스 생성 스킬을 바로 시작한다(`/chat?roomId=…&autosend=1`).
