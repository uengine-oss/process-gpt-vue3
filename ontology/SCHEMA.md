# Process GPT 그래프 스키마 레퍼런스 (Apache AGE)

> **이 문서가 스키마 계약의 정본이다.** 스키마 버전: `0.2.0` · 그래프명: `process_gpt`
> 배포 범위: 노드 29종 · 엣지 47종. **Governance 레이어(Review·ResourcePR·Terminology + 엣지 10종)는 보류**(2026-07-10 결정, §4.6·§5.5 — 스펙은 보존, 라벨 미생성).
> 설계 배경·동기화·질의 시나리오: [docs/specs/graph-ontology-apache-age.md](../docs/specs/graph-ontology-apache-age.md)
> 실행 DDL: [`schema/00-init.sql`](./schema/00-init.sql) → [`01-labels.sql`](./schema/01-labels.sql) → [`02-indexes.sql`](./schema/02-indexes.sql) → [`03-seed.sql`](./schema/03-seed.sql)
> 외부 프로젝트용: [INTEGRATION.md](./INTEGRATION.md)(통합 가이드) · [ontology-spec.yaml](./ontology-spec.yaml)(기계가독 미러 — 이 문서와 버전 동기 유지)

## 1. 스키마 계약의 성격 — AGE에서 "스키마"란 무엇인가

Apache AGE는 property graph로서 **속성 스키마와 엣지 endpoint를 DB 수준에서 강제하지 않는다**(라벨은 존재만 보장). 따라서 이 스키마는 세 겹으로 강제된다:

| 계층 | 강제 수단 | 담당 |
|---|---|---|
| 라벨 존재 | `create_vlabel`/`create_elabel` (01-labels.sql) | DB |
| **업무키 유일성** | agtype 표현식 **UNIQUE INDEX** (02-indexes.sql §1) — 동시 MERGE 중복을 오류로 차단 | DB |
| 속성 집합·타입·endpoint 조합·카디널리티 | **이 문서(§4, §5)** + 동기화 코드의 MERGE 규율 + 검증 질의(§7) | 코드/운영 |

원칙(설계 문서 §3.1): 그래프는 **원천(관계형)의 파생 projection**이다. 원천에 없는 사실을 그래프에만 쓰지 않는다. 노드가 없는 참조는 placeholder를 만들지 않고 `public.graph_sync_dangling`에 적재한다.

## 2. 명명·타입 규약

| 대상 | 규약 | 예 |
|---|---|---|
| 노드 라벨 | PascalCase 단수 (AGE는 노드당 **라벨 1개** — 세부 유형은 `type` 속성) | `ProcessDefinition`, `Activity {type:'userTask'}` |
| 엣지 라벨 | UPPER_SNAKE 동사(구). **전역 네임스페이스** — endpoint가 달라도 라벨이 같으면 같은 관계로 취급되므로 의미가 다르면 이름을 분리 | `FLOWS_TO`, `SOURCED_FROM`(KPI 전용) vs `ORIGINATED_FROM`(인스턴스 전용) |
| 속성 | snake_case. 원천 컬럼명 최대한 보존 | `proc_def_id`, `measure_type` |
| 시간 | **ISO-8601 UTC 문자열** (agtype에 timestamp 타입 없음; 문자열 정렬 = 시간 정렬) | `"2026-07-10T09:00:00Z"` |
| enum | 원천 값 그대로 (대소문자 포함) | `status: 'IN_PROGRESS'`, `state: 'public_feedback'` |
| 다중값 | agtype 리스트/맵 | `survey_questions: ['...']`, `checkpoints: [...]` |
| 예약어 회피 | cypher 키워드와 겹치는 속성명 금지 | `order` → `sort_order` |
| 키 속성 | 모든 노드는 §6의 업무키 속성을 **반드시** 가진다. MERGE는 항상 업무키 전체로만 수행 | `MERGE (a:Activity {tenant_id:…, proc_def_id:…, element_id:…})` |

**공통 속성**(전 노드): `tenant_id`(Tenant 노드 제외 필수), `created_at`, `updated_at`(동기화 시각).
**삭제 정책**: 원천이 soft-delete(`is_deleted`/`deleted_at`)면 그래프에서는 `DETACH DELETE`(그래프는 "현재 유효한 세계"만 유지). 정의류는 재구축(delete+rebuild) 시 자연 반영, 실행류는 outbox의 `DELETE` op으로 반영. 이력이 필요한 분석은 원천 테이블에서 수행한다.

## 3. 레이어 구성

```
Strategy      Perspective, Objective, KPI, Initiative               ← strategy-service (pull 동기화)
Definition    Tenant, MegaProcess, MajorProcess, ProcessDefinition,
              ProcessVersion, Activity, Event, Gateway, Role,
              Variable, Form, FormField                             ← proc_def/definition JSONB, form_def, configuration
Organization  User, Agent, Team, OrgGroup                           ← users, 조직도 JSON, org_chart_groups
Execution     ProcessInstance, WorkItem, Delegation, Project,
              ChatRoom, Topic                                       ← bpm_proc_inst, todolist, … (outbox 동기화)
Knowledge     Skill, KnowledgeDoc                                   ← tenant_skills, knowledge_files
Governance    [보류] Review, ResourcePR, Terminology                 ← proc_def_approval_state, resource_pull_requests
운영           GraphMeta (id='meta', schema_version)
```

## 4. 노드 스키마

표기: **굵게** = 업무키(§6 유니크 인덱스로 강제). 타입: `s`=string, `i`=int, `f`=float, `b`=bool, `dt`=ISO-8601 문자열, `[]`=리스트, `{}`=맵.

### 4.1 Strategy

| Label | 속성 (타입) | 원천 |
|---|---|---|
| `Perspective` | **tenant_id**, **id**(s: `financial`\|`customer`\|`internal_process`\|`learning_growth`), name(s), sort_order(i) | BSC 4관점 시드(`graph_seed_perspectives`) — 테넌트별 확장 가능 |
| `Objective` | **tenant_id**, **id**(s), name(s), description(s) | strategy-service objectives |
| `KPI` | **tenant_id**, **id**(s), name(s), unit(s), measure_type(s: `instance_count`\|`avg_duration_hours`\|`survey_score`\|`manual`), direction(s: `increase`\|`decrease`), target_value(f), current_value(f), last_measured_at(dt), survey_questions([s]) | strategy-service kpis. 측정 시계열은 미적재(최신값만) |
| `Initiative` | **tenant_id**, **id**(s), name(s), description(s), status(s: `planned`\|…), progress(i 0~100), start_date(dt), due_date(dt) | strategy-service initiatives. 담당자는 `OWNED_BY` 엣지 |

### 4.2 Definition

| Label | 속성 (타입) | 원천 |
|---|---|---|
| `Tenant` | **id**(s), owner(s: uid) | `tenants` |
| `MegaProcess` | **tenant_id**, **id**(s), name(s) | `configuration('proc_map').mega_proc_list[]` |
| `MajorProcess` | **tenant_id**, **id**(s), name(s) | `…major_proc_list[]` |
| `ProcessDefinition` | **tenant_id**, **id**(s), uuid(s), name(s), description(s), type(s: `bpmn`\|`dmn`), owner(s: uid), prod_version(s), is_draft(b) | `proc_def`. `bpmn` XML·`definition` JSONB 원문은 미적재(원천 참조) |
| `ProcessVersion` | **uuid**(s), tenant_id, arcv_id(s: `{proc_def_id}_{version}`), proc_def_id(s), version(s), version_tag(s: `published`\|`major`\|`minor`\|null), message(s), timestamp(dt), parent_version(s) | `proc_def_version`. 요소 서브그래프는 현행 head에만(§5.2 `DEFINES`) |
| `Activity` | **tenant_id**, **proc_def_id**, **element_id**(s), name(s), type(s: `userTask`\|`manualTask`\|`serviceTask`\|`scriptTask`\|`sendTask`\|`receiveTask`\|`businessRuleTask`\|`subProcess`\|`callActivity`), description(s), instruction(s), duration(i, 일), agent_mode(s: `none`\|`DRAFT`\|`COMPLETE`), orchestration(s: `none`\|`default`\|`deepagents`\|`langchain-react`\|`deep-research-custom`), checkpoints([]), properties({}: 원문 보존) | `definition.activities[]`, `subProcesses[]`(재귀) |
| `Event` | **tenant_id**, **proc_def_id**, **element_id**(s), name(s), type(s: `startEvent`\|`endEvent`\|`intermediateCatchEvent`\|`intermediateThrowEvent`\|`boundary`), trigger(s), event_definition(s: `timer`\|`message`\|`signal`\|`error`\|`escalation`\|`conditional`\|`compensate`\|`cancel`\|`terminate`\|`link`) | `definition.events[]`, `tb_bpmn_node.event_*` |
| `Gateway` | **tenant_id**, **proc_def_id**, **element_id**(s), name(s), type(s: `exclusiveGateway`\|`parallelGateway`\|`inclusiveGateway`), condition(s) | `definition.gateways[]` |
| `Role` | **tenant_id**, **proc_def_id**, **name**(s), resolution_rule(s) | `definition.roles[]` (레인). 미해석 요소는 `name:'Unknown'` Role에 연결 |
| `Variable` | **tenant_id**, **proc_def_id**, **name**(s), type(s), description(s), default_value(s) | `definition.data[]` |
| `Form` | **tenant_id**, **id**(s), uuid(s), proc_def_id(s), activity_id(s) | `form_def`. `html` 원문 미적재 |
| `FormField` | **tenant_id**, **form_id**, **key**(s), label(s), type(s: `text`\|`select`\|`checkbox`\|`radio`\|`file`\|`label`\|`boolean`\|`textarea`\|`user-select`\|`report`\|`slide`\|`bpmn-uengine`\|`row-layout`), items([]), is_multidata(b) | `form_def.fields_json[]` (row-layout 하위 필드는 개별 노드 + 동일 form_id) |

### 4.3 Organization

| Label | 속성 (타입) | 원천 |
|---|---|---|
| `User` | **tenant_id**, **id**(s: uid), username(s), email(s), role(s), is_admin(b), department_id(s) | `users` WHERE `is_agent=false`. 같은 사람도 테넌트별 별도 노드(원천 PK와 동형) |
| `Agent` | **tenant_id**, **id**(s), alias(s), username(s), agent_type(s: `agent`\|`pgagent`), goal(s), persona(s), model(s), endpoint(s), tools([s]), is_draft(b) | `users` WHERE `is_agent=true` |
| `Team` | **tenant_id**, **id**(s), name(s), level(i), path(s) | 조직도 JSON(`data.isTeam=true`) / `departments` |
| `OrgGroup` | **tenant_id**, **id**(s), name(s), description(s) | `org_chart_groups` |

### 4.4 Execution

| Label | 속성 (타입) | 원천 |
|---|---|---|
| `ProcessInstance` | **id**(s: `{proc_def_id}.{uuid}`), tenant_id, name(s), status(s: `NEW`\|`RUNNING`\|`COMPLETED`), start_date(dt), end_date(dt), due_date(dt), execution_scope(s), current_activity_ids([s]), version(s), version_tag(s) | `bpm_proc_inst`. `variables_data`·`participants` 원문 미적재(관계는 엣지로) |
| `WorkItem` | **id**(s: uuid), tenant_id, activity_id(s), activity_name(s), status(s: `NEW`\|`TODO`\|`IN_PROGRESS`\|`SUBMITTED`\|`PENDING`\|`DONE`\|`CANCELLED`), tool(s), agent_mode(s: `DRAFT`\|`COMPLETE`), agent_orch(s: `crewai-action`\|`openai-deep-research`\|`crewai-deep-research`\|`langchain-react`\|`browser-automation-agent`\|`a2a`\|`visionparse`\|`pdf2bpmn`), draft_status(s: `STARTED`\|`CANCELLED`\|`COMPLETED`\|`FB_REQUESTED`\|`HUMAN_ASKED`\|`FAILED`), start_date(dt), end_date(dt), due_date(dt), duration(i), rework_count(i), retry(i), adhoc(b), output_url(s) | `todolist`. `output`/`draft`/`feedback` JSONB 원문 미적재 |
| `Delegation` | **id**(s: uuid), tenant_id, reason(s), status(s: `REQUESTED`\|`ACCEPTED`\|`REJECTED`\|`COMPLETED`), created_at(dt), responded_at(dt) | `delegation_history` (n-ary reification) |
| `Project` | **id**(s: uuid), tenant_id, name(s), status(s), start_date(dt), end_date(dt), due_date(dt) | `project` |
| `ChatRoom` | **id**(s), tenant_id, name(s), primary_agent_id(s) | `chat_rooms`. 메시지(`chats`)는 미적재 |
| `Topic` | **tenant_id**, **proc_def_id**, **topic_id**(i), name(s), keywords(s), is_noise(b), count(i) | instance-classifier (`toplist`) |

### 4.5 Knowledge / 운영

| Label | 속성 (타입) | 원천 |
|---|---|---|
| `Skill` | **tenant_id**, **name**(s), description(s) | `tenant_skills` + SKILL.md frontmatter |
| `KnowledgeDoc` | **id**(s: uuid), tenant_id, file_name(s), doc_role(s: `content`\|`glossary`\|`template`\|`reference`\|`dataset`), source_type(s: `drive`\|`upload`), source_ref(s), folder_path(s), index_status(s: `pending`\|`processing`\|`indexed`\|`failed`\|`excluded`) | `knowledge_files`. 임베딩(`documents`)은 pgvector 유지 |
| `GraphMeta` | **id**(s: 고정 `'meta'`), schema_version(s), applied_at(dt) | 03-seed.sql |

### 4.6 Governance — **[보류]** (미배포 스펙, Phase 4 활성화 대상)

> 2026-07-10 결정으로 보류. 라벨은 생성하지 않는다. 활성화 시 01-labels/02-indexes의 보류 주석을 해제하고 아래 스펙을 그대로 적용한다.

| Label | 속성 (타입) | 원천 |
|---|---|---|
| `Review` | **id**(s: review uuid), tenant_id, proc_def_id(s), state(s: `draft`\|`in_review`\|`public_feedback`\|`final_edit`\|`published`\|`reopen_requested`\|`archived`\|`rejected`\|`cancelled`), version_label(s), major_version(i), minor_version(i), hq_status(s: `pending`\|`approved`\|`rejected`), field_status(s: 동일), submitted_at(dt), published_at(dt) | `proc_def_approval_state`. 전이 이력(`approval_history`)은 미적재 |
| `ResourcePR` | **id**(s: uuid), tenant_id, resource_type(s: `skill`\|`bpmn`\|`dmn`), status(s: `OPEN`\|`CHANGES_REQUESTED`\|`APPROVED`\|`MERGED`\|`CLOSED`), branch_name(s), base_branch(s), title(s), git_pr_url(s) | `resource_pull_requests` |
| `Terminology` | **tenant_id**, **category**(s: `task_name`\|`lane_name`\|`gateway_name`\|`event_name`\|`condition`), **term**(s), usage_count(i) | `standard_terminology` |

## 5. 엣지 스키마

표기: 카디널리티는 `From:To` 기준. MERGE 키 = 엣지 중복 판정 기준(기본은 양끝 노드 쌍 + 라벨; 속성 키가 있으면 명시).

### 5.1 Strategy — 북극성 계보

| 엣지 | From → To | 속성 | 카디널리티 | MERGE 키 | 원천 |
|---|---|---|---|---|---|
| `IN_PERSPECTIVE` | Objective → Perspective | — | N:1 | 양끝 | `objective.perspective` |
| `CONTRIBUTES_TO` | Objective → Objective | — | N:M (DAG, 자기참조 금지) | 양끝 | `objective.parents[]` — 스트레티지 맵 인과관계(하위→상위) |
| `MEASURES` | KPI → Objective | — | N:1 | 양끝 | `kpi.objective_id` |
| `DRIVES` | Initiative → Objective | — | N:1 | 양끝 | `initiative.objective_id` |
| `SOURCED_FROM` | KPI → ProcessDefinition | measure_type(s) | N:1 | 양끝 | `kpi.proc_def_id` — 정량 집계 원천·설문 발행 대상 |
| `REALIZED_BY` | Initiative → ProcessDefinition | — | N:1 | 양끝 | `initiative.proc_def_id` |
| `OWNED_BY` | Initiative → User | — | N:1 | 양끝 | `initiative.owner_email` (email→uid resolver 경유) |
| `SURVEYED` | ProcessInstance → KPI | request_id(s), status(s: →`ANSWERED`), avg_rating(f 1~5), answered_at(dt) | N:M | **request_id** | strategy-service surveys — 정성 평가의 인스턴스 단위 계보 |

### 5.2 Definition 구조

| 엣지 | From → To | 속성 | 카디널리티 | MERGE 키 | 원천 |
|---|---|---|---|---|---|
| `OWNS` | Tenant → ProcessDefinition | — | 1:N | 양끝 | `proc_def.tenant_id` |
| `CONTAINS` | MegaProcess → MajorProcess → ProcessDefinition / Activity(subProcess) → 하위 요소 | sort_order(i) | 1:N | 양끝 | `proc_map` JSON / `subProcesses[].children` |
| `HAS_VERSION` | ProcessDefinition → ProcessVersion | — | 1:N | 양끝 | `proc_def_version.proc_def_id` |
| `PRODUCTION` | ProcessDefinition → ProcessVersion | — | 1:0..1 | from 단독(교체형) | `proc_def.prod_version` |
| `DERIVED_FROM` | ProcessVersion → ProcessVersion | — | N:1 | 양끝 | `parent_version` |
| `DEFINES` | ProcessDefinition → Activity\|Event\|Gateway\|Role\|Variable | — | 1:N | 양끝 | 현행 head의 `definition` JSON (버전별 복제 없음 — 설계 문서 §3.5) |
| `FLOWS_TO` | Activity\|Event\|Gateway → Activity\|Event\|Gateway | seq_id(s), name(s), condition(s) | N:M | **seq_id** (동일 쌍 병렬 흐름 허용) | `definition.sequences[]` |
| `CALLS` | Activity(type=`callActivity`\|`subProcess`) → ProcessDefinition | — | N:1 | 양끝 | `called_element` / `subProcesses[].process` |
| `IN_LANE` | Activity\|Event\|Gateway → Role | — | N:1 | 양끝 | `element.role == roles[].name` |
| `RESOLVES_TO` | Role → User\|Team\|OrgGroup | kind(s: `direct`\|`default`\|`organization`\|`external`\|`iam`), rule(s) | N:M | 양끝+kind | `roles[].endpoint`/`default`, Organization 바인딩 |
| `USES_FORM` | Activity → Form | — | N:1 | 양끝 | `tool='formHandler:<form_id>'` |
| `HAS_FIELD` | Form → FormField | sort_order(i) | 1:N | 양끝 | `fields_json[]` |
| `REFERENCES` | Activity → FormField | as(s: `input`) | N:M | 양끝 | `inputData[] "formId.fieldId"` |
| `DECIDES_BY` | Gateway → FormField | — | N:M | 양끝 | `conditionData[]` |
| `BINDS_TO` | FormField → Variable | — | N:1 | 양끝 | `variableForHtmlFormContext` |
| `PERFORMED_BY_AGENT` | Activity → Agent | mode(s: `DRAFT`\|`COMPLETE`), orchestration(s) | N:1 | 양끝 | `activity.agent` + `agentMode` |
| `REQUIRES_SKILL` | Activity → Skill | — | N:M | 양끝 | `activity.skills[]` |
| `INVOLVES` | ProcessDefinition → Team | organization_type(s) | N:M | 양끝 | `process_organizations` |

### 5.3 Organization

| 엣지 | From → To | 속성 | 카디널리티 | MERGE 키 | 원천 |
|---|---|---|---|---|---|
| `MEMBER_OF` | User\|Agent → Team | position(s) | N:1 (조직도 기준 단일 소속) | 양끝 | 조직도 JSON / `users.department_id` |
| `PART_OF` | Team → Team | — | N:1 (트리) | 양끝 | 조직도 `children` / `departments.parent_id` |
| `INCLUDES` | OrgGroup → Team | — | N:M | 양끝 | `org_chart_group_teams` |
| `HAS_SKILL` | Agent → Skill | — | N:M | 양끝 | `agent_skills` |
| `EXTENDS` | Skill → Skill | — | N:M (DAG) | 양끝 | SKILL.md frontmatter `extends` |

### 5.4 Execution

| 엣지 | From → To | 속성 | 카디널리티 | MERGE 키 | 원천 |
|---|---|---|---|---|---|
| `INSTANCE_OF` | ProcessInstance → ProcessDefinition | version(s), version_tag(s) | N:1 | 양끝 | `proc_def_id` + `proc_def_version` |
| `SUB_OF` | ProcessInstance → ProcessInstance | execution_scope(s) | N:1 (트리; root는 경로 집계로 도출) | 양끝 | `parent_proc_inst_id` |
| `IN_INSTANCE` | WorkItem → ProcessInstance | — | N:1 | 양끝 | `todolist.proc_inst_id` |
| `EXECUTES` | WorkItem → Activity | — | N:1 | 양끝 | `(proc_def_id, activity_id)` 매칭. 대상 없으면(adhoc·구버전 요소) 엣지 생략 + dangling 기록 |
| `ASSIGNED_TO` | WorkItem → User\|Agent | kind(s: `single`\|`multi`) | N:M | 양끝 | `user_id`(email/uid resolver), `assignees` |
| `ROLE_BOUND` | ProcessInstance → User | role_name(s), is_default(b) | N:M | 양끝+**role_name** | `role_bindings` JSONB |
| `DEPENDS_ON` | WorkItem → WorkItem | type(s), lag_time(i), lead_time(i) | N:M | 양끝 | `task_dependency(task_id→depends_id)` |
| `DELEGATION_OF` | Delegation → WorkItem | — | N:1 | 양끝 | `delegation_history.task_id` |
| `DELEGATION_FROM` | Delegation → User | — | N:1 | 양끝 | `from_user_id` |
| `DELEGATION_TO` | Delegation → User | — | N:1 | 양끝 | `to_user_id` |
| `CLASSIFIED_AS` | ProcessInstance → Topic | similarity(f) | N:1 (재군집 시 교체) | from 단독(교체형) | instance-classifier |
| `ABOUT` | ChatRoom → ProcessInstance | — | 1:0..1 | 양끝 | `chat_rooms.id == proc_inst_id` |
| `PARTICIPATES_IN` | User\|Agent → ChatRoom | — | N:M | 양끝 | `participants` JSONB |
| `IN_PROJECT` | ProcessInstance → Project | — | N:1 | 양끝 | `project_id` |
| `ORIGINATED_FROM` | ProcessInstance → KnowledgeDoc | — | N:M | 양끝 | `proc_inst_source`(file_id 매칭 시) |
| `TRIGGERED_BY` | ProcessVersion → WorkItem | — | N:1 | 양끝 | `source_todolist_id` — 피드백→minor 버전 계보 |

### 5.5 Governance — **[보류]** (미배포 스펙, Phase 4 활성화 대상)

| 엣지 | From → To | 속성 | 카디널리티 | MERGE 키 | 원천 |
|---|---|---|---|---|---|
| `REVIEWS` | Review → ProcessDefinition | — | N:1 | 양끝 | `approval_state.proc_def_id` |
| `SUBMITTED` | User → Review | at(dt), comment(s) | 1:N | 양끝 | `submitted_by/at/submit_comment` |
| `HQ_REVIEWED` | User → Review | status(s: `approved`\|`rejected`), at(dt), comment(s) | 1:N | 양끝 | `hq_reviewer_*`, `hq_status` |
| `FIELD_REVIEWED` | User → Review | status(s), at(dt), comment(s) | 1:N | 양끝 | `field_reviewer_*`, `field_status` |
| `PUBLISHED` | User → Review | at(dt), comment(s) | 1:N | 양끝 | `published_by_*` |
| `REJECTED` | User → Review | at(dt), comment(s) | 1:N | 양끝 | `rejected_by_*` |
| `FOLLOWS` | Review → Review | — | N:1 | 양끝 | `root_cause_review_id` (reopen 계보) |
| `TARGETS` | ResourcePR → Skill\|ProcessDefinition | — | N:1 | 양끝 | `resource_type` + `resource_id` |
| `REQUESTED` | User → ResourcePR | at(dt) | 1:N | 양끝 | `requester_id` |
| `REVIEWS_PR` | User → ResourcePR | action(s: `APPROVED`\|`CHANGES_REQUESTED`), comment(s), at(dt) | N:M | 양끝+at | `resource_pr_reviews` |

## 6. 키·인덱스 정책 (02-indexes.sql이 물리 강제)

| 분류 | 내용 |
|---|---|
| **업무키 UNIQUE** | §4의 굵은 속성 조합. 배포된 29개 노드 라벨 전부에 표현식 UNIQUE INDEX (`uq_v_<label>`) |
| 테넌트 스캔 | 전 노드 라벨 `tenant_id` btree (`ix_v_<label>_tenant`) |
| 탐색 | 전 엣지 라벨 `start_id`/`end_id` btree (`ix_e_<label>_s/_e`) — MATCH 성능의 핵심 |
| 보조 | `User.email`, `Agent.alias`, `WorkItem.status`, `WorkItem.activity_id`, `ProcessInstance.status`, `KPI.measure_type`, `KnowledgeDoc.doc_role` |
| 애드혹 | 허브 라벨 9종 GIN(properties): ProcessDefinition, Activity, ProcessInstance, WorkItem, KPI, Objective, User, Agent, KnowledgeDoc |

주의: UNIQUE 인덱스는 **동시 MERGE 경합 시 duplicate key 오류**를 낸다 — 동기화 워커는 이를 재시도(멱등 MERGE) 대상으로 처리한다.

## 7. 참조 해석·dangling 정책

원천의 문자열 규약 참조(설계 문서 §2.3의 17종)를 엣지로 승격할 때:

1. **resolver 선행**: `todolist.user_id`·`initiative.owner_email`은 email/uid 혼용 → `users` 조회로 uid 확정 후 MERGE. `element.role`은 `roles[].name` 매칭(실패 시 `Role {name:'Unknown'}`에 연결해 명시적으로 관측 가능하게 유지).
2. **대상 노드 부재 시**: placeholder 노드를 만들지 않는다. 엣지 생성을 생략하고 `public.graph_sync_dangling`에 (원천, 키, 대상 라벨, 엣지)를 기록한다. 다음 동기화에서 대상이 생기면 자동 해소(`resolved_at`).
3. 서비스 경계를 넘는 참조(`kpi.proc_def_id`, `survey.proc_inst_id` 등)의 dangling은 **전략-실행 정합성 경보**로 취급한다(설계 문서 §5.4).

## 8. 검증 질의 (Phase 4 배치 — 스키마 계약의 상시 감시)

```sql
-- V1. 미해석 역할: 'Unknown' Role에 연결된 요소 (정의 품질)
SELECT public.agtext(d), public.agtext(e), public.agtext(n) FROM ag_catalog.cypher('process_gpt', $$
  MATCH (el)-[:IN_LANE]->(r:Role {name:'Unknown'}), (d:ProcessDefinition)-[:DEFINES]->(el)
  RETURN d.id, el.element_id, el.name
$$) AS (d ag_catalog.agtype, e ag_catalog.agtype, n ag_catalog.agtype);

-- V2. 배정 불가 역할: RESOLVES_TO가 하나도 없는 Role (실행 시 role-binding 실패 예정)
SELECT public.agtext(d), public.agtext(r) FROM ag_catalog.cypher('process_gpt', $$
  MATCH (d:ProcessDefinition)-[:DEFINES]->(r:Role)
  WHERE NOT (r)-[:RESOLVES_TO]->() AND r.name <> 'Unknown'
  RETURN d.id, r.name
$$) AS (d ag_catalog.agtype, r ag_catalog.agtype);

-- V3. 폼 계약 위반: USES_FORM 대상 Form이 없거나, DECIDES_BY 대상 FormField가 없는 게이트웨이
--     (동기화 시 dangling 로 기록되므로) → SELECT * FROM public.graph_sync_dangling WHERE resolved_at IS NULL;

-- V4. 흐름 무결성: 나가는 FLOWS_TO 가 없는 비종료 요소 (모델링 오류)
SELECT public.agtext(d), public.agtext(e) FROM ag_catalog.cypher('process_gpt', $$
  MATCH (d:ProcessDefinition)-[:DEFINES]->(el)
  WHERE NOT (el)-[:FLOWS_TO]->() AND NOT (el:Event AND el.type = 'endEvent')
        AND NOT el:Role AND NOT el:Variable
  RETURN d.id, el.element_id
$$) AS (d ag_catalog.agtype, e ag_catalog.agtype);

-- V5. 전략-실행 단절: 프로세스 연결 없는 Objective / KPI 없는 published 정의 (설계 문서 §6 Q9)
```

## 9. 스키마 진화 규칙

1. **추가는 자유, 변경·삭제는 마이그레이션**: 새 라벨·엣지·속성 추가는 하위 호환(01/02에 멱등 추가 + 이 문서 갱신 + `GraphMeta.schema_version` bump). 라벨명·키 변경은 재적재(백필) 이벤트로 취급한다.
2. 새 엣지 라벨을 만들기 전에 §5에서 **동명 라벨의 endpoint 충돌**을 확인한다(엣지 라벨은 전역).
3. 속성 추가 시 §4 표와 원천 매핑을 함께 갱신한다 — **표에 없는 속성은 계약 위반**이며 검증 대상.
4. 버전 표기: `MAJOR.MINOR.PATCH` — MAJOR: 재적재 필요, MINOR: 라벨/엣지/키 추가, PATCH: 속성 추가·문서 정정.
