# workitem-app-handler Specification

## Purpose
워크아이템의 '현재 작업' 영역에 외부 업무 시스템(MES·ERP·WMS 등)의 기존 화면을 임베드하는 **워크아이템 화면 플러그인**의 계약을 정한다.
활동의 데이터 계약은 그대로 폼(`formHandler:<formId>`)이며, 이 플러그인은 "그 폼을 어떤 화면으로 보여 주고 값을 받을지"만 바꾼다.
Process GPT 코드는 특정 업무 시스템을 알지 않으며, 업무 시스템은 등록 데이터(`workitem_app`, `workitem_app_binding`)로만 붙는다.
구현 설명은 같은 폴더의 [design.md](design.md)에 있다.

## Requirements

### Requirement: 업무 시스템 앱과 화면 바인딩 등록
시스템은 테넌트별 `workitem_app`(앱 식별자·이름·`base_url`·`allowed_origin`·`enabled`)과 `workitem_app_binding`(`form_id` → `app_id`·`view_path`·`mode`·`enabled`)을 SHALL 제공한다.
두 테이블은 행 수준 보안으로 `tenant_id = public.tenant_id()` 인 행만 인증 사용자에게 보여야 MUST 한다.
바인딩은 폼 하나에 하나이며(`(tenant_id, form_id)` 기본 키), 앱이 삭제되면 그 앱의 바인딩도 함께 삭제되어야 MUST 한다.

#### Scenario: 업무 시스템이 자기 화면을 등록한다
- **GIVEN** 업무 시스템의 설치 스크립트가 `workitem_app`에 `(app_id='primes', base_url='/primes')`를 넣는다
- **AND** `workitem_app_binding`에 `(form_id='primes_repeat_order_decide_mold_form', app_id='primes', view_path='/embed/plan')`를 넣는다
- **WHEN** 같은 테넌트 사용자가 그 폼을 쓰는 워크아이템을 연다
- **THEN** 바인딩이 해석되어 앱 화면이 표시된다

#### Scenario: 다른 테넌트의 등록은 보이지 않는다
- **GIVEN** 테넌트 A 에만 바인딩이 등록되어 있다
- **WHEN** 테넌트 B 사용자가 같은 `form_id` 를 쓰는 워크아이템을 연다
- **THEN** 바인딩이 해석되지 않고 기존 폼이 표시된다

### Requirement: 폼은 데이터 계약으로 유지된다
바인딩된 활동도 `todolist.tool` 은 `formHandler:<formId>` 를 SHALL 유지한다. 에이전트 실행, 폴링, 게이트웨이 조건 평가, 완료 처리는 플러그인 유무와 관계없이 같은 폼 값(`todolist.output[formId]`)을 읽고 써야 MUST 한다.

#### Scenario: 에이전트 활동에 바인딩이 있어도 실행은 같다
- **GIVEN** 에이전트가 수행하는 활동의 폼에 앱 화면이 바인딩되어 있다
- **WHEN** 에이전트가 활동을 완료한다
- **THEN** 결과는 폼 값으로 저장되고 다음 활동·게이트웨이 분기는 그 값으로 진행된다

### Requirement: 바인딩된 화면 해석과 표시
워크아이템 화면(`FormWorkItem`)은 폼 식별자가 정해진 뒤 바인딩을 조회해, 있으면 앱 화면을 iframe 으로 SHALL 표시한다.
화면 주소는 `base_url` + `view_path` 이며, `view_path` 의 `{task_id}` `{proc_inst_id}` `{proc_def_id}` `{activity_id}` `{form_id}` 는 URI 인코딩해 치환하고, 쿼리에 `pgpt_task`·`pgpt_inst`·`pgpt_activity` 가 없으면 덧붙여야 MUST 한다.
`mode='replace'` 이면 폼 대신 앱 화면을, `mode='beside'` 이면 앱 화면과 폼을 함께 보여야 MUST 한다.
바인딩이 없거나 조회에 실패하면 기존 폼 표시로 SHALL 돌아간다.

#### Scenario: replace 모드
- **GIVEN** 폼에 `mode='replace'` 바인딩이 있다
- **WHEN** 사용자가 워크아이템을 연다
- **THEN** '현재 작업' 영역에 앱 화면이 표시되고 폼은 숨겨진다
- **AND** '데이터 폼 보기'를 누르면 폼(데이터 계약)을 함께 볼 수 있다

#### Scenario: 바인딩 조회 실패
- **GIVEN** 바인딩 조회가 오류를 낸다
- **WHEN** 사용자가 워크아이템을 연다
- **THEN** 기존 폼이 표시되고 작업은 그대로 진행할 수 있다

### Requirement: postMessage 계약 (protocol 1)
Process GPT 와 앱 화면은 `type` 이 `pgpt:workitem:` 으로 시작하는 메시지로만 SHALL 통신한다.
Process GPT 는 iframe 이 로드되거나 읽기 전용 여부가 바뀌면, 또는 앱이 `pgpt:workitem:ready` 를 보내면 `pgpt:workitem:init` 을 보내야 MUST 한다.
init 의 `workitem` 은 `taskId, procInstId, procDefId, activityId, activityName, formId, status, readonly, values, user{email,name}` 를 담아야 MUST 한다.
앱은 `values`(폼 값 병합), `save`(병합 후 중간 저장), `submit`(병합 후 제출 완료), `resize`(높이) 를 보낼 수 있다.

#### Scenario: 앱이 값을 보내면 폼 값에 병합된다
- **GIVEN** 앱 화면이 열린 진행 중 워크아이템이다
- **WHEN** 앱이 `{type:'pgpt:workitem:values', values:{choice:'ALT_MOLD'}}` 를 보낸다
- **THEN** 워크아이템 폼 값에 `choice` 가 병합되고 기존 다른 필드는 유지된다

#### Scenario: 앱에서 제출하면 기존 제출 경로로 완료된다
- **GIVEN** 내 일인 진행 중 워크아이템이다
- **WHEN** 앱이 `{type:'pgpt:workitem:submit', values:{...}}` 를 보낸다
- **THEN** 값이 병합된 뒤 폼의 '제출 완료'와 같은 절차(체크포인트 확인 → 워크아이템 완료 요청)가 실행된다

#### Scenario: 높이 조정
- **WHEN** 앱이 `{type:'pgpt:workitem:resize', height:1100}` 을 보낸다
- **THEN** iframe 높이가 1100px 이 된다 (200 이하는 무시, 최대 4000px)

### Requirement: 메시지 출처 검증과 읽기 전용
Process GPT 는 `event.origin` 이 앱 출처(`allowed_origin` 또는 화면 주소의 출처)와 같고 `event.source` 가 그 iframe 의 창인 메시지만 SHALL 처리한다.
완료됐거나 내 일이 아닌 워크아이템(읽기 전용)에서는 `save`·`submit` 을 무시해야 MUST 한다. 업무 데이터 자체의 수정 권한은 앱이 정한다.

#### Scenario: 다른 출처의 메시지는 무시한다
- **GIVEN** 앱 출처가 `http://localhost:8080` 이다
- **WHEN** 다른 출처의 창이 `pgpt:workitem:submit` 을 보낸다
- **THEN** 아무 일도 일어나지 않는다

#### Scenario: 완료된 워크아이템에서 제출 요청
- **GIVEN** 상태가 `COMPLETED` 인 워크아이템에 앱 화면이 표시되어 있다
- **WHEN** 앱이 `pgpt:workitem:submit` 을 보낸다
- **THEN** 제출은 일어나지 않는다
- **AND** 앱은 init 의 `readonly=true` 를 보고 결정 버튼을 표시하지 않아야 한다
