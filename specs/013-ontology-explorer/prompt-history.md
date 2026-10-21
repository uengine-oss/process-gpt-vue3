# Prompt History — 013-ontology-explorer

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-10-07T02:22:14+00:00

```text
> 의도 (why & value)
데이터 분석을 위한 Ontology Explorer의 구현. 전략부터 실행까지의 데이터를 각 Ontology화 하여 각 연관 관계를 분석 할 수 있다.  

> 인수조건 (Definition of Done)
- 전략페이지 고도화(/strategy-board)
- 전략맵 부터 프로세스 실행 결과까지의 데이터가 모두 이어지고, 한 화면에서 각 데이터의 연관관계를 파악 할 수 있어야 한다.
- Ontology Schemas
- Ontology Explorer 메뉴얼

> 컨텍스트 (참고자료 위치)
- process-gpt-strategy-skill
- process-gpt-strategy
- 쏠리드(SOLiD) AX 제안 전략 플랜.pdf
- https://www.uengine.org/contents/blog/enterprisebrain.html (해당 기능을 통한 목적)
- https://www.youtube.com/watch?v=7A2b3TaJt4U (구현 의도 영상 - 초기 버전)
```

## Prompt — 2026-10-07T02:24:04+00:00

```text
<task-notification>
<task-id>a65ead10f7d22435d</task-id>
<tool-use-id>toolu_0115TLUVy5mkUPULXHkbU1Ny</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/a65ead10f7d22435d.output</output-file>
<status>completed</status>
<summary>Agent "Survey process-gpt-strategy service" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I found no `process-gpt-strategy` process running on this machine. Nothing listens on :8014 (`curl /health` failed with exit 7), there's no strategy container, and `../start-all.sh` doesn't start it. Everything below was read from source, and repo paths are relative to `/home/kimsanghoon/process-gpt-strategy`.

## 1. HTTP API (FastAPI, `app/main.py`)

Every endpoint except `/health`, `/api/kpis/{id}/measurements` and `/api/surveys/{id}[/respond]` takes `tenant_id` as a query parameter. CORS allows `*` (main.py:98-104).

**Strategy map, KPIs and initiatives** (thin wrappers over `app/strategy_ops.py`):

| Method | Path | main.py line | Body / response |
|---|---|---|---|
| GET | `/health` | 120 | `{"status":"ok"}` |
| GET | `/api/map` | 132 | `{"objectives":[{...objective, parents[], kpis[{...kpi, achievement}], initiatives[], achievement}]}` (strategy_ops.py:482-531) |
| DELETE | `/api/map` | 137 | Wipes the whole map. Returns `{objectives_deleted, kpis_deleted, initiatives_deleted}` |
| POST, PUT, DELETE | `/api/objectives[/{id}]` | 143-158 | Body `ObjectiveIn`. Returns the objective with `parents` |
| POST, PUT, DELETE | `/api/kpis[/{id}]` | 161-176 | Body `KpiIn` |
| POST | `/api/kpis/{id}/value` | 179 | `{value: float}`, stored as a manual measurement |
| GET | `/api/kpis/{id}/measurements?limit=50` | 187 | `[{value, source, measured_at}]` from `strategy_kpi_measurements` |
| POST | `/api/measure/run` | 201 | Runs measurement and the completion watcher now. Returns `{kpis_checked, kpis_measured, ...watch}` |
| POST, PUT, DELETE | `/api/initiatives[/{id}]` | 208-223 | Body `InitiativeIn` |
| POST | `/api/canvas/blocks`, GET `/api/canvas` | 229, 234 | Business Model Canvas, 9 blocks (`CanvasBlockIn`) |
| POST | `/api/ai/suggest` | 242 | `SuggestIn{name, description, measure_type}` returns process-definition candidates plus survey questions |
| POST | `/api/ai/alignment` | 250 | `AlignmentLookupIn{description, proc_def_id?}` returns `{candidates[:5], generated_by}` (strategy/KPI candidates) |
| GET | `/api/process-definitions` | 261 | `[{id, name}]` from `proc_def` |
| GET | `/api/surveys[?kpi_id]`, GET `/api/surveys/{id}`, POST `/api/surveys/{id}/respond` | 273-324 | Surveys |
| POST | `/api/migrate-graph`, `/api/migrate-graph/importance` | 330, 340 | Move relational strategy data into the graph; backfill `importance` |
| POST | `/api/ontology/sync[?full=true]` | 352 | Returns the `sync_all` summary (ontology_sync.py:910-921) |
| POST | `/api/import-bscard` | 364 | Imports the legacy `configuration` key='strategy'. Returns `{imported, skipped, detail}` |

**Router modules:**
- `GET /api/ontology/graph?layers=strategy,process,resource,skill` (ontology_view.py:98) returns `{nodes:[{id, label, layer, name, properties}], edges:[{rel_type, source, target, properties}], last_synced_at, layers}`.
- `GET /api/ontology/nodes/{id}/neighbors?depth=1` (ontology_view.py:125) returns `{nodes, edges}`. Depth is clamped to 1-3, and an unknown id gives 404.
- `GET /api/impact/kpi/{id}` (impact_analysis.py:455) returns `{kpi, candidates[{type: task|resource|process|skill, id, name, score, path, metrics}], paths_summary, no_downstream, diagnosis}`.
- `GET /api/impact/strategy/{id}` (impact_analysis.py:508) returns `{strategy, sub_strategies, lagging_kpis, bottlenecks, skill_improvements, diagnosis}`.
- `GET /api/contribution/kpi/{id}` (contribution.py:278) returns `{kpi{..., importance}, traceable, performers[{id, name, performer_type: HUMAN|AGENT, share 0-1, raw_value}]}`.
- `GET /api/contribution/strategy/{id}` (contribution.py:301) returns `{strategy, kpis[], performers[{weighted_score, kpi_breakdown[]}]}`.
- `GET /api/contribution/performer/{id}` (contribution.py:318) returns `{performer, total_weighted_score, kpi_count, strategy_breakdown[]}`.
- `POST /api/strategy/chat` (chat.py:538) takes `ChatIn{message, history[]}` and returns `{reply, actions[], map}`. The LLM edits the map through OpenAI tool calls that go through the same `strategy_ops` functions as the REST routes.

**Request models** (`app/schemas.py`), quoted:
```python
PERSPECTIVES = ["financial", "customer", "internal_process", "learning_growth"]
MEASURE_TYPES = ["instance_count", "avg_duration_hours", "form_value_sum",
    "survey_score", "external_source", "manual"]
class KpiIn: objective_id, name, description, unit, measure_type="manual", form_field,
    proc_def_id, direction="increase", baseline_value, target_value, period_start, period_end,
    survey_questions[], source_url, source_field, kpi_role: Literal["leading","lagging"]|None,
    importance: 1..5 (default 3)
class InitiativeIn: objective_id, name, description, owner_email, status="planned",
    progress=0, proc_def_id, start_date, due_date
class ObjectiveIn: name, description, perspective="financial", parents[], sort_order, importance
```

## 2. Ontology schema (`app/graph/schema.py`, quoted)

```python
NODE_LABELS = [Strategy, KPI, Initiative, Process, Task, User, Agent, Team, Skill, Canvas, CanvasBlock]
EDGE_TYPES = [HAS_SUB_STRATEGY, HAS_KPI, HAS_INITIATIVE, IMPACTS_KPI, EXECUTED_BY, CONTAINS_TASK,
              PERFORMS, USES_SKILL, INHERITS, REFERENCES, HAS_SUB_TEAM, MEMBER_OF, HAS_BLOCK, CONTRIBUTED_TO]
LAYER_LABELS = {strategy:[Strategy,KPI,Initiative], process:[Process,Task],
                resource:[User,Agent,Team], skill:[Skill]}
```

Canvas and CanvasBlock belong to no layer, so the ontology graph endpoint never returns them. The graph is AGE graph `corp_ontology`. Every node has `id`, `tenant_id`, `created_at` and `updated_at` (age_adapter.py:190-198). `merge_node` upserts on (label, id, tenant_id).

**How each node is populated:**

| Node | Source | Properties | Code |
|---|---|---|---|
| Strategy | Written by this service (graph is the original) | name, description, perspective, sort_order, importance | strategy_ops.py:104 |
| KPI | Written by this service | Every `KpiIn` field, plus `current_value` and `last_measured_at` from measurement | strategy_ops.py:115 |
| Initiative | Written by this service | `InitiativeIn` fields | strategy_ops.py:158 |
| Process | `proc_def` (id, name, definition, isdeleted). Also mirrored when a KPI or initiative references a `proc_def_id` | `{name}`, id = proc_def.id | ontology_sync.py:229-262, strategy_ops.py:227 |
| Task | `proc_def.definition.activities[]` | name, activity_id, proc_def_id; id = `"{proc_def_id}:{activity_id}"` | ontology_sync.py:274-290 |
| User / Agent | `users` (split on `is_agent`) | name (username), email | ontology_sync.py:186-223 |
| Team | `configuration` key='organization', `value.chart` tree nodes with `data.isTeam` | name | ontology_sync.py:344-412 |
| Skill | `agent_skills`, or `users.skills` comma list; body text from `skills` table or `SKILLS_API_URL` | name, description; id = slug | ontology_sync.py:438-598 |

**How each edge is populated:**
- **HAS_SUB_STRATEGY** (Strategy→Strategy), **HAS_KPI** (Strategy→KPI), **HAS_INITIATIVE**: created by CRUD.
- **IMPACTS_KPI** (Process→KPI): created when a KPI has `proc_def_id`. Its properties `{completed_count, avg_duration_hours, last_measured_at}` are refreshed every measurement run from `bpm_proc_inst` (measurement.py:234-281).
- **EXECUTED_BY** (Initiative→Process): from the initiative's `proc_def_id`.
- **CONTAINS_TASK** (Process→Task): from the definition activities.
- **PERFORMS** (User/Agent→Task):
  - From the definition: `{source:"definition"}`, using `activity.role` mapped to `roles[].default`, or `activity.agent`.
  - From execution: `{count, total_hours, avg_duration_hours}`, aggregated incrementally from completed `todolist` rows (status DONE or SUBMITTED, `end_date` cursor). The first `user_id` is matched to task `proc_def_id:activity_id` (ontology_sync.py:697-771).
- **USES_SKILL** (Agent→Skill): from agent/skill pairs.
- **INHERITS / REFERENCES** (Skill→Skill): extracted by an LLM from changed skill bodies, with `{evidence, extracted_at}`.
- **HAS_SUB_TEAM** and **MEMBER_OF**: from the org chart. Members are matched by id or email.
- **CONTRIBUTED_TO** (User→Skill): from the `skill_contributions` table (ontology_sync.py:777-832).
- **HAS_BLOCK** (Canvas→CanvasBlock).

**Path from strategy to execution:**
```
Strategy(perspective) -HAS_SUB_STRATEGY-&gt; Strategy -HAS_KPI-&gt; KPI &lt;-IMPACTS_KPI- Process -CONTAINS_TASK-&gt; Task &lt;-PERFORMS- User/Agent -USES_SKILL-&gt; Skill
Strategy -HAS_INITIATIVE-&gt; Initiative -EXECUTED_BY-&gt; Process
```
- **Process instances and work items are not nodes.** Execution data reaches the graph only as aggregates: IMPACTS_KPI properties from `bpm_proc_inst` and PERFORMS properties from `todolist`.
- **KPI values** (measurement.py:135-221):
  - `instance_count`, `avg_duration_hours` and `form_value_sum` use `bpm_proc_inst` rows where `proc_def_id` matches, `status='COMPLETED'` and `is_deleted=false`, within the KPI period on `end_date`. `form_value_sum` reads `variables_data`.
  - `survey_score` uses `strategy_survey_requests`.
  - `external_source` does an HTTP GET on `source_url` and reads `source_field`.
- **Contribution** (contribution.py:43-152): finds the same completed instances, joins `todolist` on `proc_inst_id` to get performers, normalises each performer's share within the KPI, then weights it by the parent Strategy's `importance`.

**Relational tables this service owns** (database.py:16-118):
- `strategy_kpi_measurements`, `strategy_survey_requests` and `strategy_sync_state` are in use.
- `strategy_objectives`, `strategy_kpis` and `strategy_initiatives` are legacy. They are kept so data can be migrated, and runtime code no longer reads them.

## 3. Sync, ingestion and configuration

**Startup** (main.py:74-94), in order:
1. `init_schema` creates the relational tables.
2. `store.ensure_ready()` creates the AGE extension, graph and labels. It raises an error if AGE is missing (age_adapter.py:119-166).
3. The relational map is auto-migrated once.
4. Three background polling loops start when `MEASURE_AUTO_START=true`:
   - measurement: `MEASURE_INTERVAL_SECONDS`, default 60
   - survey watcher: `SURVEY_WATCH_INTERVAL_SECONDS`, default 30
   - ontology sync: `ONTOLOGY_SYNC_INTERVAL_SECONDS`, default 60

**Ingestion is polling only.** There are no database triggers and no Realtime subscription. `sync_all` (ontology_sync.py:865) runs, for each tenant: users, proc_defs, org chart, skills, performs stats, then skill contributions.
- The user, proc_def and org passes re-read the whole table each time. Only `todolist` and `skill_contributions` use incremental cursors stored in `strategy_sync_state`.
- `POST /api/ontology/sync?full=true` clears the cursors and skill hashes, then rebuilds.
- KPI measurement can also be triggered on demand with `POST /api/measure/run`.

**Environment variables** (`app/config.py`):
- `DB_HOST/PORT/NAME/USER/PASSWORD` (defaults localhost/5432/postgres/postgres/"").
- `GRAPH_DB_*` (each inherits the matching `DB_*` value).
- `GRAPH_STORE=age`, `GRAPH_NAME=corp_ontology`.
- `MEASURE_*`, `SURVEY_DUE_DAYS=7`, `ONTOLOGY_SYNC_INTERVAL_SECONDS`.
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL=gpt-4.1`, `SKILLS_API_URL`.
- `STRATEGY_SELF_URL` (ontology_agent/tools.py:23, default `http://127.0.0.1:8000`).

**Ports:**
- The Dockerfile serves on container port 8000. The README runs it on 8014 locally, and compose maps host 8014 to container 8000.
- `docker-compose.age.yml` provides an AGE Postgres (`apache/age:release_PG16_1.5.0`) on host port 55433.
- The `run_demo.py` docstring mentions port 8114.

**How the frontend reaches it:** `process-gpt-vue3/vite.config.ts:118-123` proxies `/strategy-service/` to `env.STRATEGY_PROXY_TARGET || 'http://127.0.0.1:8014'` and strips the prefix. In production, nginx strips the same prefix. `src/stores/strategy/strategyStore.ts:7` sets `BASE = '/strategy-service/api'`. The store already calls the map, KPI, survey, ontology graph and neighbors, impact, contribution (kpi and performer) and ontology sync endpoints (lines 21-196). It does not call `/contribution/strategy` or `/strategy/chat`.

## 4. Gaps and TODOs

There are no TODO or FIXME markers in the code. PLAN.md §11 (lines 151-156) lists what is out of scope:
- Switch ingestion to Supabase Realtime or trigger push instead of polling.
- **Build frontend screens for the ontology view and impact analysis** that consume the new APIs.
- Implement Neo4j or Memgraph adapters.
- Remove the legacy relational strategy tables and the `/bscard` screen. §10 says dropping the schema is deferred.

Other gaps I found in the code:
- **No process-instance or work-item nodes.** Strategy connects to execution only through IMPACTS_KPI and PERFORMS aggregate properties. Instances are tied to KPIs only at query time, inside the measurement and contribution SQL.
- **A KPI or initiative links to at most one `proc_def_id`,** so only one process can feed it.
- **`USES_SKILL` from Task to Skill is never created by sync.** Sync only creates Agent→Skill (ontology_sync.py:592-598), but impact analysis reads Task→Skill (impact_analysis.py:330-337).
- **Process instances that are still running are never measured.**
- **The docs have drifted from the code:**
  - PLAN.md doesn't mention `CONTRIBUTED_TO`, `external_source`, Canvas or the contribution and chat APIs.
  - The adapter comment says "8 node labels and 12 edge types", but there are 11 node labels and 14 edge types.
  - PLAN.md cites `openspec/changes/strategy-graph-repository/design.md`, which doesn't exist in this repo.

## 5. Local runtime status

**The strategy service is not running.**
- Nothing listens on 8014 or 55433, and `curl 127.0.0.1:8014/health` failed.
- Port 8000 is taken by `process-gpt-completion/main.py` (pid 5920). That clashes with `STRATEGY_SELF_URL`'s default of `http://127.0.0.1:8000`.
- **`start-all.sh` doesn't start it.** It only starts frontend, supabase, gateway and completion.
- Running now: Vite on 5173 and 8081, gateway on 8088, and Supabase on 54321-54326.

**State of the local Supabase DB** (`supabase_db_process-gpt-vue3`, port 54322):
- The `age` extension is installed (version 1.6.0 is available).
- `strategy_sync_state` and the other `strategy_*` tables don't exist, so the service has never run against this database.
- `proc_def`, `bpm_proc_inst`, `todolist` and `agent_skills` exist. `skills` and `skill_contributions` do not.

To start it, use the README command: `DB_HOST=localhost DB_PORT=54322 DB_USER=postgres DB_PASSWORD=postgres uvicorn app.main:app --port 8014`, which matches the Vite proxy default. I haven't run it.</result>
<usage><subagent_tokens>130280</subagent_tokens><tool_uses>24</tool_uses><duration_ms>94939</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-07T02:24:29+00:00

```text
<task-notification>
<task-id>acda20a5eb581043b</task-id>
<tool-use-id>toolu_01SYVJ4raUdKAnYxeqPKLeSo</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/acda20a5eb581043b.output</output-file>
<status>completed</status>
<summary>Agent "Survey strategy-skill, PDF, blog" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result># Research findings: strategy skill, SOLiD AX plan, Enterprise Brain, and the YouTube video

## 1. `process-gpt-strategy-skill` (skill name `bsc-strategy-interview`)

Files are in `/home/kimsanghoon/process-gpt-strategy-skill/`: `README.md`, `SKILL.md`, and `references/{perspectives, socratic-questions, industry-templates, validation-checklist, mermaid-template, bmc-template, bmc-questions, business-model-patterns}.md`.

**What it does.** It is a Socratic interviewer that builds a BSC strategy map and a Business Model Canvas with an executive.
- It runs in both Claude Code (questions via `AskUserQuestion`) and process-gpt deepagents (questions via `request_human_input` with an `options` array and `multi_select`). In process-gpt it ships as a git submodule under `services/deepagents/system-skills/process-gpt-system/`, which makes it a system skill for every tenant.
- **Entry modes:**
  - A: BSC top-down, starting from the financial target.
  - B: BMC overview first (4 question clusters fill the 9 blocks).
  - C: hybrid, recommended.
- **Step 0:** it fetches the company website (`WebFetch` or `fetch_webpage`).
- **Step 1:** a fast draft from industry templates (B2B SaaS, retail, manufacturing).
- **Step 2:** a cascade through the perspectives in the order F → C → P → L, using a 5-stage question structure: clarify terms → surface hidden assumptions → check evidence → review alternatives → enforce causal alignment.
- **Message rules:** at most one question mark per message. Textbook BSC terms are banned in output and replaced by executive terms: "궁극적 재무 성과 / 고객 가치 및 관계 / 핵심 운영 역량 / 조직 지속 가능성 및 성장 엔진".
- **Validation gate** (4 checks):
  - no orphan objectives;
  - no one-off tasks posing as objectives (those are reclassified as **Initiatives**);
  - arrows only go one way, L → P → C → F;
  - every objective has a leading + lagging KPI pair.

**Data model it produces**
- **Objective**: `name`, `description`, `perspective ∈ {financial, customer, internal_process, learning_growth}`, `parents[]` (the objective_ids this node causally feeds into, e.g. a P node's parents are C nodes). Node IDs are F1, C1, P1, L1, and so on.
- **KPI**: `objective_id`, `name`, `kpi_role ∈ {leading, lagging}`, plus target and owner fields. Each objective needs one pair.
- **Canvas block** (BMC): `block_type ∈ {key_partners, key_activities, key_resources, value_propositions, customer_relationships, channels, customer_segments, cost_structure, revenue_streams}`, `items[]`, `notes`. It is upserted per block_type.
- **BMC ↔ BSC mapping:**
  - Revenue and Cost blocks → F
  - Customer segments, Value propositions, Channels, Customer relationships → C
  - Key activities and Key partners → P
  - Key resources → L
- **Initiative**: a one-off project. It exists only as a concept in the text and has no save tool.
- **Process link**: KPI ↔ `proc_def_id`.

**Output format**
- A Mermaid `graph BT` with fixed `classDef financial/customer/process/learning` colors, one subgraph per perspective, and arrows only L → P → C → F.
- A table with columns: node | objective | lagging KPI | leading KPI | owner.
- The BMC as a 9-block HTML grid artifact, or a Markdown table in deepagents.
- Three execution recommendations: an owner for every KPI; a weekly agile review plus a monthly management board; an Initiatives roadmap tied to KPIs.
- A list of candidate processes.

**process-gpt APIs (deepagents tools)**
- Read: `get_strategy_map`, `get_strategy_canvas`. These are called first, and if objectives already exist it switches to edit mode to avoid duplicates.
- Write: `save_strategy_objective`, `update_strategy_objective`, `save_strategy_kpi`, `update_strategy_kpi`, `save_canvas_block`, and `link_kpi_to_process(kpi_id, proc_def_id, tenant_id)`.
- It also calls the `bpmn-process-generation-skill`, one process at a time. Each call gets the objective, the KPI ids and the company context, and once it returns a `proc_def_id` the skill calls `link_kpi_to_process`.
- The README says the design mirrors process-gpt's `services/strategy` (the backend).

## 2. SOLiD AX proposal PDF (14 pages, dated Oct 6 2026, by uEngine)

**Structure**
- **Executive summary.** The pitch is to redesign how judgment and execution work so each person produces more, not to "adopt AI". The path is briefing → 4–6 week diagnosis → 1–2 process pilot → rollout.
- **Customer context.** About 350 staff, over 70% R&amp;D, outsourced manufacturing, 73% of revenue from DAS. Revenue per person is about 840M KRW.
- **Underlying needs** (5): output per person; R&amp;D decision-making for new products (NPD); data broken across the outsourced-manufacturing boundary; document load from export RFPs and certifications; CEO-led redesign.
- **Products mapped onto uEngine's 4-layer stack** (Data integration → Ontology → Multi-agent → Agentic BPM):
  - **Ontology Studio**: knowledge graph and MCP.
  - **Process GPT**: BPMN, DMN, mixed human-agent execution.
  - **Ontologic Platform**: a "KPI·Measure·Process·Driver·Resource" ontology, root-cause analysis, what-if, watch agents. When a threshold is crossed, a watch agent starts a Process GPT process.
  - uEngine6 BPM/PAL, RPA, Robo Analyzer/Architect, and the education tracks.
- **CASE 1/2/3 are layers, not alternatives** (1 = single agent, 2 = redesign, 3 = off-the-shelf), followed by a table of case studies.
- **KPI tree** (rendered from page 7). The goal is contribution margin per person, driven by 3 drivers and 5 processes:

| Driver | Driver KPI | Process | Process KPI |
|---|---|---|---|
| Revenue growth | time to launch, win rate | P1 NPD | concept-to-dev lead time, gate pass rate |
| Revenue growth | | P2 Order/RFP response | proposal lead time, engineer hours per bid, win rate |
| Margin improvement | quality cost, delivery losses | P3 Quality issue → improvement | root-cause time, recurrence, claim cost |
| Margin improvement | | P4 Supply-chain delivery risk | on-time delivery rate, delay penalty |
| Workforce efficiency | repetitive work moved to agents | P5 Tech support / certification docs | engineer repetitive-work time |

- The tree is said to become Ontologic's KPI·Measure·Process·Driver ontology directly.
- Executive dashboard metrics: contribution margin per person, auto-resolution rate, human-intervention rate, experiment speed. These are measured from Process GPT's lead-time breakdown into human judgment, agent execution and waiting.

**Ontology-based strategy map and impact analysis.** This section describes the features shown in the YouTube video.
- **Automatic graphing of assets.** Skills (markdown), executable BPMN, organization, people, agents and execution history are loaded into an ontology under the Analysis menu. A "sync" button refreshes it. An LLM reads skill bodies to extract skill-to-skill inheritance and references.
- **Waterfall strategy map, 7 layers:** North-star strategy → Sub-strategy → KPI → Process → Task → Resource → Skill. A KPI below target gets a **red border**.
- **KPI from execution.** KPI attainment is aggregated from the history of completed process instances. Demo: development process total duration at 70% attainment.
- **Impact analysis (back-trace).** Pick an under-target KPI and the path KPI → Process → Task → Resource → Skill is followed. The biggest bottleneck task is flagged (demo: implementation task averaging 6h), along with the agents and skills that perform it. An **LLM diagnosis card** gives the evidence and a direction for improvement.
- **Strategy improvement.** Pick a strategy and you get cards with the under-target KPIs, candidate skills to improve, and the paths connecting them.
- **Deep links.** From a graph node you can jump to the process definition editor or the skill document. It links both ways with the existing Strategy Board (KPI registration, quantitative and qualitative surveys, strategy map and KPI cards).
- **Implementation.** There is no separate graph DB; it uses **Apache AGE inside Supabase Postgres**.

**Example figures**
- Page 9 strategy map:
  - North star: maximize contribution margin per person.
  - Sub-strategies: workforce efficiency, revenue growth, margin improvement.
  - KPIs: proposal lead time (red), win rate, claim cost, on-time delivery rate.
  - Processes: P2, P3, P4.
  - Tasks: requirements breakdown, design review, root-cause analysis, alternative-sourcing approval.
  - Resources: sales engineer, RFP analysis agent, RF design engineer, quality analysis agent.
  - Skills: RFP breakdown, DAS design, 8D writing.
  - The note says the Resource and Skill layers link automatically from execution history.
- Page 10 impact figure:
  - Red back-trace: Proposal lead time (below target) → P2 Order/RFP (aggregated from execution history) → tasks {requirements breakdown, **design review (bottleneck candidate)**, quote calculation}.
  - From design review → RF engineer (person) → **DAS design skill (improvement candidate)**, and review agent (agent) → coverage rule (DMN rule).
  - A dashed improvement loop goes from skill/rule back to the KPI, meaning "fix it and confirm the KPI recovers in execution history".
  - An LLM diagnosis card sits underneath.
- The rollout stage adds Ontologic's VAR/Granger causal analysis and what-if, moving from "why did it miss?" to "what change makes it recover?".

**Rest of the document:** a 4-stage roadmap with 3 gates and pricing, a 2.5-hour briefing agenda (session 4 is the live demo above), positioning, risks and a checklist.

**Entity types implied:** NorthStarStrategy, SubStrategy/Driver, KPI (target, actual, attainment, under-target flag), Measure, Process (BPMN definition), ProcessInstance/ExecutionHistory, Task/Activity, Resource (Person, Role, Agent), Skill (markdown), DMN Rule, Organization/Department, Initiative/Pilot, Product, Lot, Supplier/Outsourcer, Customer, Claim, Quality Issue (8D/CAPA), Part/Component, Standard/Spec (3GPP, O-RAN), Certification document, RFP/Requirement, System (ERP, PLM, QMS, SCM, CRM).

**Relation types implied:** strategy→sub-strategy (decomposes), sub-strategy→KPI (measured by), KPI→process (produced by / aggregated from), process→task (contains), task→resource (performed by), resource→skill (uses / has), skill→skill (inherits / references), task→rule (decided by), instance→process (instance of), KPI→KPI and driver (drives / causes, statistical Granger), threshold breach → triggers process, product→customer (delivered to), claim→product/lot, lot→supplier, document→standard (cites), node → editor (deep link).

## 3. Enterprise Brain (uengine.org blog)

WebFetch only returned a summary. The page is framed as "AI-Native Enterprise", so it may hold more detail than what follows.
- **Core idea.** A "판단 자산" (judgment asset): the causal relationships among KPIs, metrics, processes and resources, taken out of people's heads into a shared, machine-readable form. Judgment logic and processes are redesigned on the assumption that AI exists.
- **4-layer stack:**
  1. Data integration: 100+ connectors, LLM analysis of legacy code.
  2. Knowledge graph / ontology (Ontologic): domain schema, ObjectTypes, semantic layer.
  3. Multi-agent: MCP/A2A; Claude Code, LangChain, CrewAI.
  4. Agentic BPM (Process GPT): goals decomposed into tasks and decision branches.
- **Questions it should answer:**
  - root cause (VAR/Granger causality);
  - what-if simulation over the ontology;
  - anomaly detection that triggers corrective workflows;
  - continuous learning, where field feedback automatically becomes agent skills and DMN business rules.
- **Example.** NPD redesigned as a "다중가설 검증 퍼널" (multi-hypothesis validation funnel), cutting 6–12 months to 1–2 months.
- **Other points.** 70% of transformation success is about people and organization; it calls for CEO-led change and "integrated builder-thinker" talent.
- The fetched content had no explicit explorer UX. The explorer UX ideas in this report come from the PDF.

## 4. YouTube video `7A2b3TaJt4U`

oEmbed returned the title **"Fable5 로 구현부터 설명영상까지 만든 process gpt 의 신규기능"**, author **장진영** (@장진영-k4w). The watch page gave no description or chapters. The PDF cites it as "Process GPT 신규 기능 영상: 기업 온톨로지·전략맵·영향도 분석", so the PDF's feature table in section 2 is effectively the video's content.

## Proposed unified ontology

| Layer | Node types (key properties) | Source |
|---|---|---|
| **Strategy** | `NorthStar` (goal statement), `Strategy`/`SubStrategy` (driver), `Objective` (perspective F/C/P/L, description), `Initiative` (one-off project, owner, period), `BMCBlock` (block_type, items) | skill, PDF |
| **Measurement** | `KPI` (kpi_role leading/lagging, target, unit, direction, actual, attainment, status, e.g. below_target), `Measure` (raw metric or formula, source query), `Threshold`/`Alert` | skill, PDF, Ontologic |
| **Process** | `ProcessDefinition` (proc_def_id, BPMN), `Task`/`Activity` (avg duration, bottleneck score), `DecisionRule` (DMN), `ProcessInstance` (execution history: durations split into human, agent and wait) | PDF, process-gpt |
| **Execution** | `Agent`, `Skill` (markdown doc), `Tool`/`System` (ERP, PLM, QMS, CRM, RPA) | PDF video features |
| **Organization** | `OrgUnit`, `Person`, `Role`; optional domain objects `Customer`, `Product`, `Supplier`, `Claim`, `Document`/`Standard` (Ontology Studio domain layer) | PDF, org chart |

**Edge types** (direction follows the causal flow upward; the back-trace walks edges in reverse)
- Strategy:
  - `NorthStar -DECOMPOSES_TO-&gt; SubStrategy`
  - `SubStrategy -REALIZED_BY-&gt; Objective`
  - `Objective -CAUSES/FEEDS-&gt; Objective` (the skill's `parents`, L→P→C→F only, acyclic)
  - `Initiative -ADVANCES-&gt; Objective`
  - `BMCBlock -MAPS_TO-&gt; Objective`
- Strategy and measurement:
  - `Objective -MEASURED_BY-&gt; KPI`
  - `KPI(leading) -LEADS-&gt; KPI(lagging)`
  - `KPI -DRIVES-&gt; KPI`, with a statistical weight from Granger
  - `KPI -COMPUTED_FROM-&gt; Measure`
- Measurement and process:
  - `KPI -PRODUCED_BY/AGGREGATED_FROM-&gt; ProcessDefinition` (equivalent to `link_kpi_to_process`)
  - `Threshold -TRIGGERS-&gt; ProcessDefinition`
- Process:
  - `ProcessDefinition -CONTAINS-&gt; Task`
  - `ProcessInstance -INSTANCE_OF-&gt; ProcessDefinition`
  - `ProcessInstance -EXECUTED-&gt; Task`, with duration
  - `Task -DECIDED_BY-&gt; DecisionRule`
- Execution:
  - `Task -PERFORMED_BY-&gt; Person|Agent|Role`
  - `Agent/Person -USES/HAS-&gt; Skill`
  - `Skill -INHERITS|REFERENCES-&gt; Skill` (LLM-extracted)
  - `Agent -USES-&gt; Tool/System`
- Organization:
  - `Person -MEMBER_OF-&gt; OrgUnit`
  - `Person -HAS_ROLE-&gt; Role`
  - `KPI/Objective/Process -OWNED_BY-&gt; Person|OrgUnit`
- Domain (optional): `Product -DELIVERED_TO-&gt; Customer`, `Claim -ABOUT-&gt; Product`, `Document -CITES-&gt; Standard`.

**Explorer and analysis features this ontology should support**
- A layered, waterfall top-down view: NorthStar → SubStrategy → KPI → Process → Task → Resource → Skill. Under-target KPIs get red borders.
- Impact back-trace from an under-target KPI to the bottleneck task, the resource behind it, and the candidate skill or rule, with an LLM diagnosis card.
- An improvement view: pick a strategy to see its weak KPIs and candidate skills.
- Deep links to the BPMN editor, skill docs and the Strategy Board.
- A sync button that rebuilds the graph from skills, processes, org and instances.
- Later: what-if analysis and Granger-weighted DRIVES edges, plus threshold-triggered processes.
- Storage the PDF names: Apache AGE in Supabase Postgres.</result>
<usage><subagent_tokens>92273</subagent_tokens><tool_uses>20</tool_uses><duration_ms>108365</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-07T02:24:34+00:00

```text
<task-notification>
<task-id>af1049056a61381b0</task-id>
<tool-use-id>toolu_01KU3ZqTwHKdWaUxsC1qVHyB</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/af1049056a61381b0.output</output-file>
<status>completed</status>
<summary>Agent "Survey vue3 strategy/ontology UI" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## Strategy and ontology frontend survey: process-gpt-vue3

All paths are relative to `/home/kimsanghoon/process-gpt-vue3`.

**Short answer:** the strategy board and `/analytics/ontology` are not PAL-only. In PAL mode their sidebar entries are swapped out. The other two explorers (`/ontology-explorer`, `/ontology-explorer-new`) exist only in PAL mode and have no menu entry. Graph libraries: the strategy board draws its own SVG, `/analytics/ontology` and `/ontology-explorer` use cytoscape, and `/ontology-explorer-new` uses Neo4j NVL.

### 1. StrategyBoard.vue (`/strategy-board`, MainRoutes.ts:704-707, outside the PAL block)
- **No top-level tabs.** The page has a header toolbar, a strategy map and a side detail panel that slides in.
- **Strategy map** (lines 678-762):
  - A hand-drawn SVG edge layer with arrow markers (680-699). No graph library is used.
  - Four BSC perspective lanes: `financial`, `customer`, `internal_process`, `learning_growth` (constants at 35-41).
  - Objective cards show importance, KPI count, initiative count and an achievement % bar.
  - Clicking a card highlights the objectives connected to it. Shift+click multi-selects; right-click opens a delete menu (764-775).
- **Header buttons** (619-670):
  - Import legacy BSC data (shown only when the map is empty)
  - Refresh measurement
  - "전략 정합성 검사" (strategy alignment check), which opens a dialog at 1498+
  - "온톨로지 뷰" (ontology view), which goes to `/analytics/ontology`
  - An AI button, shown only when there are no objectives
  - "전략맵 초기화" (reset map), which asks you to type a confirmation
  - Add objective
- **No chat panel.** The AI button calls `backend.getAgentSkillsBySkill('bsc-strategy-interview')` (line 22, ProcessGPTBackend.ts:4347). It then goes to the full-page `Agent Chat` route (lines 10-33).
- **Detail panel tabs** (808-812):
  - `kpis`: measurement history, survey status, contribution per KPI (816-925)
  - `initiatives` (927)
  - `contribution`: performer ranking weighted by strategy importance, plus skill-growth contribution (974-1075)
- **Dialogs:**
  - Objective (1078)
  - KPI (1127): AI mapping suggestion (1164), survey question editor (1261), external System-of-Record URL (1284)
  - Initiative (1311), manual value (1385), performer contribution (1405), reset (1464), alignment (1499)
- **KPI measure types:** `instance_count`, `avg_duration_hours`, `survey_score`, `external_source`, `manual` (line 42).
- **Data source:** almost everything goes through `src/stores/strategy/strategyStore.ts`, which uses axios with `BASE = '/strategy-service/api'` (line 7). The page reads no Supabase tables directly.
  - Map: `GET/DELETE /map`, `GET /process-definitions`
  - CRUD: `/objectives`, `/kpis`, `/initiatives` (`linkKpisToProcess` does a PUT on `/kpis/{id}`)
  - KPI values: `POST /kpis/{id}/value`, `GET /kpis/{id}/measurements`
  - AI: `POST /ai/suggest`, `POST /ai/alignment`
  - Measurement and import: `POST /measure/run`, `POST /import-bscard`
  - Surveys: `GET /surveys?kpi_id`, `GET /surveys/{id}`, `POST /surveys/{id}/respond`
  - Ontology: `GET /ontology/graph`, `GET /ontology/nodes/{id}/neighbors`, `POST /ontology/sync`
  - Impact: `GET /impact/kpi/{id}`, `GET /impact/strategy/{id}`
  - Contribution: `GET /contribution/kpi/{id}`, `GET /contribution/performer/{id}`
  - Exception: `getObjectiveContribution` calls `/api/analytics/dashboard/contribution` (line 190), which is the analytic-service, not the strategy service.
- **Survey page:** `src/views/strategy/SurveyResponse.vue` (`/strategy/surveys/:requestId`) uses `getSurvey` and `respondSurvey`.
- **Related page:** `src/views/analytics/KPIDashboard.vue` (`/analytics/kpi`) links to the strategy board (lines 254, 268-280). Its own data comes from Supabase through `kpiStore`.

### 2. The three ontology views
| View | Route / PAL gating | Graph library | Data source | Node / edge types |
|---|---|---|---|---|
| `src/views/strategy/OntologyExplorer.vue` | `/analytics/ontology` (MainRoutes.ts:709-712). Not PAL-only. | `cytoscape` used directly (line 8), preset layout with compound group nodes (212-360) | strategyStore → strategy service: `/ontology/graph`, `/neighbors`, `/impact/*`, `/ontology/sync` (lines 369, 467, 481, 493, 503) | Nodes: Strategy, KPI, Initiative, Process, Task, User, Agent, Team, Skill (49-58). Edges: `rel_type` including HAS_SUB_STRATEGY, IMPACTS_KPI, PERFORMS, INHERITS, REFERENCES. Layer chips: strategy, process, resource, skill. Tabs: graph, impact analysis, strategy improvements (660-662). Has a sync button and a link back to the strategy board. |
| `src/views/ontology-explorer/OntologyExplorer.vue` | `/ontology-explorer` (MainRoutes.ts:472-475), inside the `...(window.$pal ? [...] : [])` block (453-677). **PAL-only.** | cytoscape through `src/components/ontology-explorer/OntologyCanvas2D.vue:63`. `OntologyCanvas3D.vue` (uses `3d-force-graph` and `three`) exists but this view does not import it. | `useOntologyGraph` → `ProcDefGraphSource` (`src/services/processKgGraphService.ts:57`, Supabase `proc_def.bpmn` parsed client-side) or uploaded artifact files | BPMN process-KG `NodeType` and `EdgeType` (`src/lib/processKg/graph/types.ts:1,22`): ProcessModel, Participant, Lane, Gateway, System, DataObject…; edges flowFrom, usesSystem… Has an AI reasoning console, What-If simulator, dimension filters, SPOF insights and a markdown report. |
| `src/views/ontology-explorer-new/OntologyExplorerNew.vue` | `/ontology-explorer-new` (MainRoutes.ts:477-480), same PAL block. **PAL-only.** | Neo4j NVL (`@neo4j-nvl/base`, loaded with a dynamic import in `src/components/ontology-explorer-new/NvlCanvas.vue:102`), hierarchy or force layout | `src/services/ontologyAgeGraphService.ts`: Supabase RPCs `ontology_graph_health`, `ontology_business_graph`, `ontology_execution_rollup` (lines 51, 79, 108), backed by the Apache AGE graph `process_gpt` | 16 labels across 5 layers (`src/composables/ontologyNew/layerMapping.ts:18-35`): Perspective, Objective, KPI, Initiative / MegaProcess, MajorProcess, ProcessDefinition / Activity, Role / User, Agent, Team, PiSystem, PiService / Skill, KnowledgeDoc. `config.ts` sets `ENABLED_LAYERS` without `'strategy'`, so the strategy layer is switched off in this deployment. |

**Menu links:**
- `/strategy-board`:
  - `VerticalSidebar.vue:1033-1039` (analytics section)
  - `SimpleSidebarTools.vue:165` (no PAL check)
  - `VerticalHeader.vue:92-98`, with `isVisible: !window.$pal`
  - `MobileAppBar.vue:50` (title only)
- `/analytics/ontology`: only `VerticalSidebar.vue:1040-1046`.
- **PAL mode replaces the whole analytics menu.** `VerticalSidebar.vue:1078-1088` swaps it for a single `/analysis-dashboard` entry. So in PAL mode the strategy board, KPI and ontology sidebar items disappear, but the routes still resolve.
- **`/ontology-explorer` has no menu entry.** It appears only in `src/utils/routePermissions.ts:136-143` with `hiddenInSidebar: true`, so it is reachable by URL only.
- **`/ontology-explorer-new` has no menu entry either.** Its routePermissions entry is commented out (144-150).

**Two routes share a name.** Both `/ontology-explorer` (473) and `/analytics/ontology` (710) are named `'Ontology Explorer'`. In PAL mode both are registered (vue-router 4.0.12). Also, `gsExcludedRoutes` (MainRoutes.ts:5-7) filters routes by that name in GS mode.

### 3. Backend client and proxy
- **No strategy, ontology or objective methods in `src/components/api/`.** Strategy calls go through `strategyStore` with axios. KPI methods in `ProcessGPTBackend.ts` read Supabase:
  - `getKpiPipelineSummary` (11420) → `v_kpi_pipeline_summary`
  - `getKpiDomainProgress` (11442) → `v_kpi_domain_progress`
  - `getKpiWeeklyVelocity` (11460)
  - `getKpiTargets` / `upsertKpiTarget` (11483 / 11505) → `kpi_targets`
  - `getKpiIndicators` / `upsertKpiIndicator` / `deleteKpiIndicator` (11532-11584) → `kpi_indicators`
- **PAL backend:** `PalModeBackend.ts:1061-1080` stores KPI targets in the configuration key `kpi_targets`, with soft-delete and restore.
- **Dev proxy** (`vite.config.ts:115-123`): `/strategy-service/` goes to `STRATEGY_PROXY_TARGET` (default `http://127.0.0.1:8014`) with the prefix stripped. `/api/analytics` goes to the analytic-service (vite.config.ts:89-95; gateway `application.yml:265-270`).
- **No production route for the strategy service in this repo.** `docker-compose/nginx/nginx.conf`, `docker-compose/docker-compose.yaml` and `gateway/src/main/resources/application.yml` have no strategy entry, even though the comment at vite.config.ts:117 says nginx strips the prefix in production.

### 4. Supabase migrations
- **No strategy, objective, initiative or contribution tables.** The strategy service owns its own storage.
- **KPI:**
  - `supabase/migrations/20260213000001_kpi_review_board.sql:8`: `kpi_targets`, plus the views `v_kpi_pipeline_summary` and `v_kpi_domain_progress`
  - Those views are redefined in `20260213000002_review_per_submission.sql:40,54` and `20260223000001_governance_workflow.sql:218,237`
  - `kpi_indicators` is only in `schema_merge.sql:340`
  - Copies of `kpi_targets` are also in `consolidated_schema.sql:341` and `schema_merge.sql:323`
  - Minor mentions: the `kpi_read` permission (`20260514_permissions.sql:67`) and KPI threshold settings (`20261002000001_dashboard_thresholds_audit.sql:37`)
- **Ontology:** `supabase/migrations/20260710_ontology_explorer_rpc.sql` defines helper functions `ontology_layer_of`, `ontology_node_key`, `ontology_node_id`, `ontology_node_name`, plus the RPCs `ontology_graph_health` (94), `ontology_business_graph` (196) and `ontology_execution_rollup` (357). These are read-only Cypher queries over AGE. The graph schema lives in `ontology/` (SCHEMA.md, INTEGRATION.md, `schema/01-labels.sql`) and `supabase/age/`.

### 5. How PAL mode is set and how it gates things
- **The flag:** `src/palMode.ts` sets the read-only `window.$pal = true` when either `window._env_.VITE_PAL_MODE` (runtime) or `import.meta.env.VITE_PAL_MODE` (build time) is `'true'`. It is imported first in `src/main.ts:8`.
- **Current setting:** the local `.env:5` has `VITE_PAL_MODE=true`; `.env.example` has `false`.
- **Related flags:** `window.$mode` (`VITE_MODE`, default `'ProcessGPT'`, `main.ts:246`) and `window.$gs`.
- **Route gating:** spread blocks `...(window.$pal ? [...] : [])` in MainRoutes.ts (453-677 and 723-736).
- **Sidebar gating** (`VerticalSidebar.vue`):
  - The `pal()` getter (616) wraps `window.$pal`.
  - `applyPalMenuSettings` (734) applies tenant menu settings (hidden / label / order) plus custom menus.
  - Role filtering uses `lookupRequiredRole` from `routePermissions.ts`, which applies to admin items (636-668).
  - `displayedAnalyticsItems` (684) builds the analytics list.
  - The analytics section is also hidden when `gs` is set (line 413).
  - Process items differ by mode (957-983).

### 6. Graph and visualization libraries in package.json
- **Graph:** `cytoscape ^3.34.2`, `@neo4j-nvl/base` and `@neo4j-nvl/interaction-handlers ^1.2.1`, `3d-force-graph ^1.80.0`, `three ^0.185.1`
- **Charts:** `apexcharts 3.40.0`, `apexcharts-clevision`, `vue3-apexcharts 1.4.1`, `apextree 1.7.0`, `chart.js ^3.9.1`, `vue-chartjs ^4.1.2`
- **Diagrams:** `mermaid ^11.10.1`, `bpmn-js ^17.9.1`
- **Not present:** d3, vis-network and vue-flow.

**Tests:** `playwright/e2e/strategy/` has `strategy-board.spec.ts`, `strategy-manual-demo.spec.ts` and `ontology-explorer.spec.ts`.</result>
<usage><subagent_tokens>74520</subagent_tokens><tool_uses>33</tool_uses><duration_ms>119415</duration_ms></usage>
</task-notification>
```

## Note — 2026-10-07T02:52:02+00:00

```text
구현 완료: strategy-service 실행 레이어(ProcessInstance/WorkItem)+스키마 API/문서, PAL 전략 보드 탭(온톨로지 익스플로러 8단 워터폴·체인 추적·원인분석, 온톨로지 스키마), 데모 시드 스크립트
```

## Note — 2026-10-07T02:52:02+00:00

```text
매뉴얼 작성: docs/manuals/ontology-explorer.md
```

## Prompt — 2026-10-07T04:09:23+00:00

```text
1. start-all.sh에 strategy-service 추가해줘. 그리고 프로세스 체계도쪽 타이틀 스타일 깨짐.
2. 데이터를 더 많이 넣어서 문서화면 캡쳐해줘. 이건 앞으로 메뉴얼 작성시에도 항상 데이터는 많이 둬야함.
```

## Note — 2026-10-07T04:17:14+00:00

```text
후속: start-all.sh 에 strategy-service(+AGE DB) 추가, 데모 시드를 .py 로 확장(프로세스5·담당6·에이전트3·전략10·KPI14·인스턴스59/워크아이템289) 후 매뉴얼 스크린샷 재촬영. 프로세스 체계도 타이틀 깨짐은 재현 못 함(사용자 확인 필요)
```

## Prompt — 2026-10-07T04:18:51+00:00

```text
체계도쪽 여전히 분석대시보드랑 여백이라던가 다름.
```

## Prompt — 2026-10-07T04:20:21+00:00

```text
1. 기업 운영 온톨로지 페이지는 box 레이아웃이 없음. 
2. 전체적으로 가독성이 떨어지는 문제가 있는데 해당 문제를 해결 할 방법을 제시해봐.
```

## Prompt — 2026-10-07T04:21:05+00:00

```text
그리고 전략맵에서 목표 선택시, 우측 패널이 헤더에 가려짐. 해당부분 수정 필요함.
```

## Prompt — 2026-10-07T04:22:12+00:00

```text
1. 전략맵에서 목표 선택시, 우측 패널이 헤더에 가려짐. 해당부분 수정 필요함.
2. 전략맵보기 버튼 안보임.
```

## Note — 2026-10-07T04:29:57+00:00

```text
레이아웃 정리(PAL): 프로세스 체계도 본문을 분석 대시보드와 같은 16px 인셋+테두리 카드로, 기업 운영 온톨로지(/analytics/ontology)·전략 보드에 sk-page-card+page-header 적용, 전략맵 상세 패널을 고정 오버레이→맵 옆 인라인 패널로(헤더 가림 해소). vue-tsc 0
```

## Prompt — 2026-10-07T04:33:31+00:00

```text
여전히 전략맵 패널의 윗부분이 전체 헤더에 가려지는 상황임. 헤더부분을 밀고 전략맵 패널은 우측 전체를 사용하도록 변경.
```

## Prompt — 2026-10-07T04:56:05+00:00

```text
palmode에서만 하는게 아님.
```

## Prompt — 2026-10-07T05:02:18+00:00

```text
1. 온톨로지 익스플로러 부분에서 목표 미달 등 각 컬러가 가시성 너무 떨어짐. 
2. 드래그로 이동 필요.
3. 추가적으로 필요한 사항 제안(한국어로)
```

## Note — 2026-10-07T05:05:52+00:00

```text
모든 모드 적용(사용자: PAL 전용 아님): 전략 보드 탭·익스플로러·스키마·연관관계 보기·좌우 분할 상세 패널을 비 PAL 에도 노출(PAL 디자인 클래스 헤더/박스만 isPal). 비 PAL 앱바 높이 보정. 익스플로러 상태 강조(미달/병목/지연 단색 배지·2px 테두리·진한 단계색) + 드래그로 화면 이동
```

## Prompt — 2026-10-07T05:13:12+00:00

```text
npx impeccable install 설치해서 연결하고 해당 부분 디자인 검토 필요함.
```

## Prompt — 2026-10-07T05:16:39+00:00

```text
<task-notification>
<task-id>ad9e8684d6054aa66</task-id>
<tool-use-id>toolu_013ntX9RCa9TSEJpVdYDJhwE</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/ad9e8684d6054aa66.output</output-file>
<status>completed</status>
<summary>Agent "Critique B: detector + browser" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Assessment B를 마쳤습니다. CLI 스캔에서 경고 5건(exit 2, 전부 `side-tab`)이 나왔고, 브라우저 4개 페이지 모두 detect.js가 정상 주입돼 결과를 받았습니다. 프로젝트 소스는 고치지 않았고, 레포 루트에 잠깐 복사했던 `_critB_tmp.mjs`는 삭제했습니다.

## 1. CLI 스캔
`impeccable detect --json`은 파일 4개를 한 번에 받습니다. 결과는 경고 5건이고, 모두 `side-tab`(Side-tab accent border, slop 카테고리)입니다.

| 파일:라인 | 코드 조각 | 선택자 |
|---|---|---|
| `src/views/strategy/StrategyBoard.vue:1836` | `border-left: 4px solid` | `.lane-label` |
| `src/components/strategy/ontology/StrategyOntologyExplorer.vue:938` | `border-left: 4px solid` | `.soe-card` 기본 |
| `src/components/strategy/ontology/StrategyOntologyExplorer.vue:972` | `border-left: 5px solid #dc2626 !important` | `.soe-card.below/.bottleneck` |
| `src/components/strategy/ontology/StrategyOntologyExplorer.vue:977` | `border-left: 5px solid #d97706 !important` | `.soe-card.overdue` |
| `src/components/strategy/ontology/OntologySchemaView.vue:291` | `border-left-width: 4px` | `.osv-box` |

`src/views/strategy/OntologyExplorer.vue`는 0건입니다.

## 2. 브라우저 검사
- live-server는 `--background`로 띄웠고 PORT=8400, pid 380387이었습니다. 끝날 때 `impeccable live-server stop`으로 껐고 `/health` 응답이 없는 것까지 확인했습니다.
- 4개 페이지 모두 preflight(title 변경, script 태그 추가)가 통과했고 detect.js 로드도 성공했습니다.

**/strategy-board (전략맵 탭): 21건**
- `layout-transition` 15건 (width, height, padding-bottom)
- `side-tab` 4건 (`.lane-label`, border-left 4px에 radius 8px)
- `clipped-overflow-container` 2건 (`v-navigation-drawer`)
- `bounce-easing` 1건 (`cubic-bezier(0.34, 1.3, 0.64, 1)`)
- `dark-glow` 1건 (`#0085db` 그림자)

**/strategy-board?view=explorer: 576건** (`.soe-card` 대기 성공)
- `side-tab` 429건: 4px 324건, 5px 105건. 카드마다 하나씩 잡혀서 숫자가 커졌습니다.
- `undersized-ui-text` 108건: 10px 배지 텍스트("지연" 80, "미달" 22, "병목" 6). 해당 CSS는 `StrategyOntologyExplorer.vue:987`, `:1041`(font-size 10px)입니다.
- `layout-transition` 약 30건
- `tiny-text` 5건 (11px 본문)
- `clipped-overflow-container` 4건
- `bounce-easing` 1건

**/strategy-board?view=schema: 28건** (`.osv-box` 대기 성공)
- `side-tab` 11건 (`.osv-box`)
- `low-contrast` 4건: 흰 배경 위 `#16a34a` 글자가 3.3:1로 4.5:1에 못 미칩니다. 출처는 `OntologySchemaView.vue:19`의 `resource: '#16a34a'` 색상 맵입니다.
- `layout-transition` 7건
- `tiny-text` 2건
- `clipped-overflow-container` 4건
- `bounce-easing` 1건

**/analytics/ontology: 21건**
- `low-contrast` 10건: `#707a82` on `#fff`, 4.4:1
- `low-contrast` 4건: 흰 글자 on `#0085db`, 3.9:1
- `layout-transition` 5건
- `clipped-overflow-container` 2건
- `bounce-easing` 1건

## 3. 오탐 또는 대상 밖으로 보이는 항목
- **`clipped-overflow-container`, `layout-transition`, `bounce-easing`, `dark-glow`:** 4개 페이지 모두에 똑같이 나옵니다. Vuetify 앱 셸(사이드바 drawer의 width 전환과 overflow, 공용 테마 primary `#0085db`)에서 나오는 것이고, 대상 4개 파일과는 관계없습니다. `bounce-easing` 값은 `src/ds/styles/tokens.css`에 정의돼 있습니다.
- **`/analytics/ontology`의 `low-contrast`:** `#707a82`(medium-emphasis 텍스트)와 `#0085db` 버튼은 Vuetify 테마 전역 색입니다. 페이지 고유의 문제는 아니지만, 대비 부족 자체는 실제 값입니다.
- **explorer의 `side-tab` 429건:** 같은 CSS 규칙 2개가 카드마다 반복 집계된 것이라 실제 원인은 2~3곳뿐입니다. 왼쪽 굵은 테두리 색이 노드 타입(전략, KPI, 프로세스 등)을 나타내고, 빨강·주황은 미달·병목·지연 상태를 나타냅니다. 장식이 아니라 의도된 인코딩이라 반쯤 오탐에 가깝습니다. 다만 detector 규칙상으로는 여전히 위반입니다.
- **`#dc2626`, `#d97706`, `#16a34a` hex 하드코딩:** 상태와 노드 타입 색을 고정하려고 쓴 것으로 보입니다. 그중 `#16a34a`를 흰 배경 위 글자색으로 쓴 경우는 실제 대비 미달이라 오탐이 아닙니다.
- **10px 배지(미달·병목·지연):** 의도적인 마이크로 배지지만 11px 기준 아래인 것은 사실입니다. 진짜 발견으로 봐야 합니다.

## 4. 건너뛰었거나 실패한 단계
- 첫 실행에서는 "impeccable"이 들어간 줄만 걸러서 그룹 헤더만 잡혔습니다. 그룹 안 상세 항목까지 잡도록 스크립트를 고쳐 다시 돌렸고, 위 수치는 두 번째 실행 결과입니다.
- live-server stop 때 "could not remove live script tag (config_missing)"가 출력됐습니다. live.js 주입(live-inject)을 한 적이 없어서 나온 메시지이고, `git status`에서 index.html은 바뀌지 않았습니다.
- 모든 페이지에서 `GET /feedback-proposals?tenant_id=tym`이 500을 반환합니다(콘솔 메시지 "스킬 제안 배치 조회 실패"). 대상 화면과 관계없는 공통 백엔드 오류이고, 렌더링에는 영향이 없었습니다.
- 스크린샷에는 detect.js 오버레이 배너가 함께 찍혀 있습니다.

## 파일
모두 `/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/scratchpad/` 아래에 있습니다.
- 스크린샷(1600x960): `critB/map.png`, `critB/explorer.png`, `critB/schema.png`, `critB/analytics-ontology.png`
- 원시 결과: `detect.json`(CLI 결과), `critB/result.json`(첫 실행), `critB/result2.json`(콘솔 상세 포함 재실행)
- 스크립트: `critB/run.mjs`, `critB/run2.mjs`</result>
<usage><subagent_tokens>48604</subagent_tokens><tool_uses>9</tool_uses><duration_ms>140804</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-07T05:17:39+00:00

```text
<task-notification>
<task-id>a64a7e48ddf1c52b3</task-id>
<tool-use-id>toolu_01AdJ1WiaM8LWCdhDEpejyYc</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/a64a7e48ddf1c52b3.output</output-file>
<status>completed</status>
<summary>Agent "Critique A: design review" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## 디자인 리뷰 A: 전략 보드 / 온톨로지 화면

### 디자인 특이성 판정
**절반 정도만 이 제품을 위해 만든 화면이고, 나머지는 범용 화면이다.**
- **이 제품만의 장치 (전략 보드 온톨로지 익스플로러 탭)**
  - 전략에서 스킬까지 이어지는 8단 워터폴과 계보(lineage) 강조는 이 제품만의 정보 구조다. "왜 이 KPI가 미달인가"를 실행 단위까지 추적하는 장치는 다른 제품에서 가져올 수 없다.
- **범용 화면에 가까운 부분**
  - 전략맵 탭은 흔한 BSC 카드 레인이다.
  - 스키마 탭은 개발자용 ERD 문서처럼 보인다.
  - `/analytics/ontology`는 cytoscape 기본 모양 그대로다. 보라색 사각 노드가 모두 똑같이 생겼고, 레이블이 겹치며, 엣지가 캔버스 밖으로 나간다.
- 표현 방식에는 고유한 정체성이 없다. Vuetify의 tonal 칩, 왼쪽 컬러 바가 달린 카드, 빨강/주황 배지 조합은 어느 대시보드에서나 볼 수 있다.

### Nielsen 휴리스틱 점수

| # | 휴리스틱 | 점수 | 핵심 이슈 |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | 동기화 시각과 단계별 개수는 보인다. 다만 선택 KPI에 연결된 체인이 끊겨도(d03: 전략 1, KPI 1에서 끝남) 끊겼다는 상태 표시가 없다. |
| 2 | 현실 세계와의 일치 | 2 | 스키마 탭은 영문 타입명(ProcessInstance, `proc_def.definition.activities[]`)을 쓰고 익스플로러는 한글명을 쓴다. 경영기획 사용자에게는 DB 용어가 그대로 노출된다. |
| 3 | 사용자 통제와 자유 | 3 | 선택 해제(X, 빈 곳 클릭)와 체인만 보기/전체 보기는 있다. 패닝은 드래그로만 되고 미니맵이나 "선택 노드로 이동" 기능이 없다. |
| 4 | 일관성과 표준 | **1** | 같은 달성률을 탭마다 다른 색으로 칠한다. 67%는 전략맵에서 주황(warning), 익스플로러에서 빨강이다. 80.8%는 전략맵에서 파랑(primary), 익스플로러에서 빨간 "미달" 배지다. 탭 컨테이너도 다른 PAL 화면과 다르다(아래 P1). |
| 5 | 오류 예방 | 2 | "전략맵 초기화"(파괴적 작업)가 "전략목표 추가" 옆 헤더에 같은 크기로 있다(`StrategyBoard.vue:707-711`). 타이핑 확인 절차가 있는 것은 좋다. |
| 6 | 기억보다 인식 | 2 | 상태 범례가 툴바 아래 한 줄짜리 10px 텍스트뿐이다. 스크롤하거나 패닝하면 사라진다. 열 헤더는 sticky다. |
| 7 | 유연성과 효율성 | 3 | 검색 후 Enter로 선택, 단계 칩 토글, 체인만 보기가 있다. 키보드로 노드를 이동하는 방법은 없다. |
| 8 | 미적이고 최소한의 디자인 | **1** | 첫 화면에 전략 10개 중 9개, KPI 대부분이 빨강이다. 태스크와 인스턴스 사이 점선 엣지가 회색 덩어리로 뭉친다. 리소스 열 앞에는 엣지가 모여 검은 막대가 생긴다(d02 x≈1515). |
| 9 | 오류 인식과 복구 | 2 | 연결된 프로세스가 없는 KPI를 골라도 안내가 없다. "원인 분석"을 눌러야 비로소 "연결된 프로세스가 없습니다"가 나온다. |
| 10 | 도움말과 문서 | 2 | "노드 클릭: 연결 체인 강조…" 안내가 있다. 미달 기준(100% 미만)은 어디에도 설명되지 않는다. |
| | **합계** | **21/40** | |

### 인지 부하 체크리스트: 8개 중 5개 실패
1. **단일 초점: 실패.** 익스플로러 첫 화면에서 눈이 멈출 곳이 없다. 빨강 카드 20개 이상과 주황 카드 10개 이상이 동시에 경쟁한다.
2. **청킹(≤4): 실패.** 열 8개와 단계 칩 8개가 있다. "KPI·이니셔티브"는 서로 다른 두 타입을 한 열에 섞어 덩어리 구분이 흐려진다.
3. **그룹핑: 통과.** 열 단위 그룹은 명확하다.
4. **시각 계층: 실패.** 상태 강조(2px 테두리, 연한 빨강 배경, 빨간 배지)가 선택 강조(primary 2px 링)보다 시각적으로 더 무겁다. 선택한 카드가 주변에 묻힌다(d03).
5. **한 번에 하나: 통과에 가까움.** 선택하면 나머지가 흐려진다(opacity 0.22).
6. **결정 지점 선택지 ≤4: 실패.**
   - 익스플로러 툴바: 검색 1, 단계 칩 8, 스위치 2, 동기화 1로 **12개**.
   - 전략맵 헤더 버튼 **5개**(측정 갱신, 정합성 검사, 온톨로지 뷰, 초기화, 추가).
   - 범례 줄 5개 항목.
   - 레거시 온톨로지 화면은 헤더 레이어 토글 4개, 동기화, 편집, 탭 3개.
7. **작업 기억: 실패.** 체인을 따라 오른쪽으로 패닝하면 왼쪽 KPI가 화면 밖으로 나간다. 세부 패널에는 "연결 체인" 개수만 있고 경로 자체는 없다.
8. **점진적 공개: 통과.** 상세 패널, 원인 분석 버튼 뒤의 분석 결과, 직접 연결 12개 초과분 접기가 있다.

### 감정 여정
- **진입 (전략맵):** 차분하고 정돈돼 있다. 다만 미달이 어디인지 바로 보이지 않는다. 진행 바 색이 파랑과 주황뿐이다.
- **익스플로러 전환:** "전부 불이 났다"는 경보 피로가 생긴다. 무엇이 정말 심각한지 판단할 수 없어서 불안해진다.
- **KPI 클릭:** 체인이 왼쪽 두 열에서 끝나면(d03) 막다른 길에 선 허탈감이 든다. 이 화면의 핵심 약속인 "실행까지 추적"이 깨지는 순간이다.
- **원인 분석 버튼:** 파스텔 빨강 tonal 스타일이라 비활성 버튼처럼 보인다. 핵심 행동에 확신이 생기지 않는다.
- **프로세스 클릭 (m03):** 이 화면의 최고 순간이다. 병목 태스크 "견적 검토(평균 39.3시간)"가 경고 박스로 바로 보인다. 이 경험이 KPI 쪽에서 나와야 한다.

### 강점
1. 계보 강조 상호작용이 좋다. 선택하면 비관련 노드가 흐려지고, 관련 체인은 파란 엣지로 표시되며, 단계별 개수 요약이 붙는다. 이 제품의 핵심 가치를 잘 전달한다.
2. 카드 하나에 이름, 측정값/목표, 달성률 바, 상태 배지가 밀도 있게 들어가 있다. 예: "3.2 / 5 % · 64%". 파워유저에게 정보 대비 공간 효율이 좋다.
3. 상태 배지는 흰 글자에 고정 고대비 색을 쓴다. `#dc2626`은 4.8:1, `#b45309`는 5.0:1이다(`StrategyOntologyExplorer.vue:229-231`, `:993-998`). 테마의 파스텔 색 문제를 인지하고 대응했다.

### 우선순위 이슈

**[P0] "미달" 기준이 너무 넓어 상태 색이 신호 역할을 못 한다**
- **What:**
  - `ontologyLineage.js:135`는 `a &lt; 100`이면 미달로 판정한다.
  - `:144`의 전략 판정은 KPI 중 하나라도 100% 미만이면 미달이다.
  - 그 결과 80.8% 전략과 70% KPI가 44% KPI와 똑같은 빨간 테두리와 빨간 배지를 단다.
  - 진행 바 색은 70% 이상이면 amber인데(`:233-238`), 배지는 빨강이다. 카드 한 장 안에서 색 의미가 충돌한다.
- **Why:** 사용자가 지적한 "상태 색이 잘 안 보임"의 진짜 원인은 대비 부족이 아니라 포화다. 모든 것이 빨강이면 아무것도 빨강이 아니다.
- **Fix:**
  - 심각도를 3단계로 나눈다. 위험(&lt;70%)만 빨간 채움 배지와 빨간 테두리를 쓴다. 주의(70~99%)는 amber 외곽선 배지만 쓰고 카드 배경은 흰색으로 둔다. 달성은 표시 없이 둔다.
  - 전략의 "below"는 하위 KPI 가중 달성률 기준으로 바꾼다.
  - 위험 카드에만 배경 틴트를 준다.

**[P1] 탭에 따라 달성률 색 체계가 다르다**
- **What:**
  - `StrategyBoard.vue:634-640`: ≥70 primary(파랑), ≥40 warning(파스텔 주황), 그 외 error.
  - 익스플로러 `:233-238`: ≥100 녹색, ≥70 amber, 그 외 빨강.
  - 같은 "협력사 납기 신뢰도 80.8%"가 전략맵에서는 파랑이고 익스플로러에서는 빨간 "미달"이다(d01 vs d02).
- **Why:** 탭만 바꿨는데 같은 목표의 상태가 뒤집혀 보이면 데이터 자체를 믿지 못하게 된다.
- **Fix:** `achievementColor`와 임계값을 공용 모듈 하나로 옮기고 두 화면이 함께 쓴다. 메모리에 있는 `dashboard_thresholds` configuration과 연동하는 방안도 검토한다. 전략맵 카드에도 같은 위험/주의 배지를 단다.

**[P1] KPI 원인 추적 동선이 KPI에서 끊긴다**
- **What:**
  - "구매 단가 절감률"을 선택하면 체인이 "전략 1 · KPI 1"에서 끝난다(d03). 프로세스 연결(IMPACTS_KPI)은 전체 14개 KPI 중 6건뿐이다(d05).
  - "원인 분석 (역추적)" 버튼은 `color="error" variant="tonal"`이다(`:786-795`). 테마 error가 파스텔(rgb 251,151,125)이라 글자 대비가 약 2.2:1로 추정되고, 비활성 버튼처럼 보인다.
  - 버튼 위치도 속성 표 8행 아래다.
- **Why:** 경영기획 담당자의 핵심 질문인 "왜 미달인가"에 답하는 경로가 가장 약하다.
- **Fix:**
  - KPI 상세 맨 위에 "원인 분석"을 primary filled 버튼으로 둔다.
  - 프로세스에 연결되지 않은 KPI에는 카드 배지("실행 미연결")와 패널 안내("이 KPI를 프로세스에 연결 → 전략맵에서 열기")를 표시한다.
  - 속성 표는 접힌 상태를 기본값으로 한다.

**[P1] PAL 공통 박스/여백 규약에서 벗어나 있다**
- **What:**
  - 분석 대시보드(d07)와 프로세스 체계도(d08)는 page-header 아래에 탭과 툴바를 감싸는 안쪽 테두리 컨테이너를 둔다. 틴트 헤더 바와 56px 탭을 쓴다(`AnalysisDashboard.vue:471`).
  - 전략 보드는 `density="compact"` 탭이 카드 위에 떠 있고, 내용은 `px-2`로 8px만 더 들여쓴다(`StrategyBoard.vue:719, 729`).
  - 그 결과 왼쪽 정렬선이 3개다. 헤더 33px, 탭과 툴바 41px, 맵 레인 33px.
  - 1280px에서는 툴바의 "동기화" 버튼이 혼자 다음 줄로 떨어진다(m02).
  - 390px에서는 전략맵 헤더 버튼이 줄바꿈되지 않아 제목 "전 략 보 드"가 글자마다 세로로 쪼개진다(p01).
- **Why:** 사용자가 직접 지적한 박스/여백 불일치다.
- **Fix:**
  - 탭부터 본문까지를 분석 대시보드와 같은 inner container로 감싼다. 탭 높이 56은 공통값으로 맞춘다.
  - `px-2`를 없애고 정렬선을 하나로 맞춘다.
  - 헤더 액션은 주 액션 1개(추가)와 오버플로 메뉴(측정 갱신, 정합성 검사, 초기화)로 줄인다. `page-header-right`에 `flex-wrap`을 준다.

**[P2] 엣지 시각 노이즈와 가로 폭 문제**
- **What:**
  - 8열 × (200+44)px ≈ 1950px가 1600 뷰포트를 넘는다. 리소스와 스킬 열은 항상 화면 밖에 있다.
  - 열을 건너뛰는 점선 엣지 수백 개가 해칭 띠와 검은 막대를 만든다(d02).
  - 상세 패널이 열리면 1280에서 캔버스가 약 840px로 줄어든다(m03).
- **Fix:**
  - 선택 전에는 인접 열 엣지만 아주 옅게 그리고, 열 건너뛰기 엣지는 숨긴다.
  - 워크아이템(289)과 리소스 열은 기본으로 접어 "+289" 요약 칩으로 둔다.
  - 상세 패널은 캔버스 위에 띄우는 오버레이로 바꾸거나, 열 너비를 줄인 compact 모드를 둔다.

### 페르소나 레드 플래그
**Alex (파워유저)**
- 키보드로 노드를 이동할 수 없다(화살표로 상류/하류, Tab).
- 선택 노드를 URL로 공유할 수 없다. `focusId` prop이 있지만 라우트 쿼리에 연결되어 있지 않다.
- 미니맵이 없어서 패닝만으로 2000px 폭을 오가야 한다.
- 같은 데이터를 보는 화면이 2개다. `/analytics/ontology`와 익스플로러 탭이 공존하는데, 헤더의 "온톨로지 뷰" 버튼(`StrategyBoard.vue:691-695`)은 주석과 달리 탭 전환만 한다.

**Sam (접근성)**
- 상태 배지 글자가 10px/700이다(`:980-990`). 색 대비는 4.8~5.0:1로 기준을 넘지만 크기가 너무 작다.
- 원인 분석 버튼과 "전략맵 초기화" 글자는 약 2.2~2.4:1로 AA에 미달한다.
- 비활성 스위치 "선택 체인만" 레이블이 약 2.5:1이다.
- 흐려진 카드(opacity 0.22, `:954`)의 텍스트는 약 1.4:1이다. 의도된 처리지만 체인 밖 정보를 읽을 방법이 없다.
- 카드는 `div @click`이라 role, tabindex, aria-pressed가 없다. 스크린리더와 키보드로 접근할 수 없다.
- 전략맵 별점 배지(주황 글자에 연주황 배경)는 약 1.8:1이다.
- 페이지 부제목 `#64748b` 12px는 4.76:1로 경계선에 있다.

**경영기획 담당자: "구매 단가 절감률이 왜 미달인가"**
1. 전략맵에는 미달 표시가 없다. 그래서 익스플로러로 간다.
2. 빨간 카드 20여 개 중에서 해당 KPI를 찾는다. 검색해야 한다.
3. 클릭하면 체인이 전략에서 끝난다.
4. 파스텔 버튼 "원인 분석"을 찾아 스크롤한다.
5. "연결된 프로세스·실행 이력이 없습니다"가 나온다. 여기서 이탈한다.

연결된 KPI("구매 처리 리드타임")를 고르면 프로세스까지 이어지지만, 병목 정보는 **프로세스를 클릭해야** 보인다. KPI 패널에서 병목 태스크가 바로 보이지 않는다.

### 사소한 관찰
- **스키마 탭**
  - KPI 박스 색(전략 레이어 보라)이 익스플로러 KPI 색(teal `#0f766e`)과 다르다.
  - 노드 타입 표가 1280에서 오른쪽 "원천" 열이 잘린다(m04).
  - 설명 열이 좁아서 3~4줄로 줄바꿈된다.
- **"KPI·이니셔티브" 열:** 이니셔티브("견적 비교 자동화")가 KPI 사이에 끼어 있다. teal 바와 로켓 아이콘으로만 구분된다.
- **범례:** 툴바 아래 텍스트 줄에 있어서 캔버스와 떨어져 있다. 캔버스 안에 고정 범례를 두는 편이 낫다.
- **레거시 화면:** 하단 범례가 노드를 가리고(d06), 오른쪽 패널 약 320px가 비어 있다.
- **"마지막 동기화: 26. 10. 7. 오전 5:14":** 2자리 연도 표기가 어색하다. "10월 7일 05:14 (2시간 전)"처럼 상대 시간으로 바꾸는 것을 권장한다.

### 도발적 질문
1. 이 화면의 첫 질문이 "어떤 KPI가 위험한가"라면, 기본 뷰가 8열 워터폴 전체가 아니라 **위험 KPI 3개와 각각의 병목 경로**여야 하지 않는가?
2. 프로세스에 연결되지 않은 KPI가 14개 중 8개다. 이 상태라면 익스플로러가 먼저 할 일은 시각화가 아니라 **"연결하라"는 작업 목록**이 아닌가?
3. 온톨로지 스키마 탭과 `/analytics/ontology`는 경영기획 담당자를 위한 화면인가, 개발자를 위한 화면인가? 전략 보드에서 빼서 관리자 영역으로 옮겨야 하지 않는가?

### 촬영한 스크린샷
모두 `/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/scratchpad/critA/` 아래에 있다.
- **1600×960:**
  - `d01-map.png`, `d02-explorer.png`, `d03-explorer-kpi-selected.png`
  - `d04-schema.png`, `d05-schema-bottom.png`
  - `d06-legacy-ontology.png`
  - `d07-ref-analysis.png`, `d08-ref-pa.png` (비교 기준 화면)
- **1280×800:** `m01-map.png`, `m02-explorer.png`, `m03-explorer-process.png`, `m04-schema.png`
- **390×844:** `p01-map.png` (제목이 글자 단위로 쪼개지는 버그), `p02-explorer.png`</result>
<usage><subagent_tokens>89561</subagent_tokens><tool_uses>25</tool_uses><duration_ms>210240</duration_ms></usage>
</task-notification>
```

## Note — 2026-10-07T05:58:20+00:00

```text
impeccable 설치(.claude/skills/impeccable, agents 4, settings.local.json 훅) + critique 21/40(P0 1·P1 3·P2 1) → 5건 모두 반영: 위험·주의·양호 3단계(분석 대시보드 KPI RAG 기준값 공유, achievementLevel.js), 전략맵·익스플로러 색/달성률 통일(중요도 가중), KPI 패널 원인분석 상단·병목 직접 표시·실행 미연결 안내, 분석 대시보드식 탭 박스·더보기 메뉴·모바일 헤더, 워크아이템 기본 접기·인접 엣지만·보기 설정 메뉴·촘촘히, 굵은 좌측 컬러바 제거·배지 11px·카드 키보드 접근. 매뉴얼 재촬영(13컷)
```

## Prompt — 2026-10-07T06:31:58+00:00

```text
이제 스타일 개선이 필요함. 목표는 가시성, 가독성 좋은 UI/UX를 가진 Ontology Explorer고, 현재 스타일은 너무 촌스러운 느낌이 듬. 우리 현재 디자인과 맞지 않더라도 한번 맞춰서 작업해봐.
```

## Prompt — 2026-10-07T07:27:17+00:00

```text
<task-notification>
<task-id>a94c34023997dd0f4</task-id>
<tool-use-id>toolu_0116zdvgbmcV5a49NcYAyMep</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/a94c34023997dd0f4.output</output-file>
<status>completed</status>
<summary>Agent "Finish review: explorer redesign" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>disposition: fix

읽지 않은 파일: `ontologyLineage.js`(coursePath 로직), `StrategyBoard.vue`(바깥 셸). 둘 다 이번 판정과 직접 관련이 없습니다.

## persistence
통과. PRODUCT.md가 있고, 서피스 브리프 FORM에 seed a65d9fa9가 적혀 있으며 이는 결정 패킷과 맞습니다. 코드 주도 빌드라서 `state.json`과 comp 승인 기록은 필요하지 않습니다. `.impeccable/mocks/decision/`의 파일 4개는 예외 대상입니다. DESIGN.md는 새 세계이므로 이 리뷰 뒤에 작성하면 됩니다. 증거 확인(check 0)도 통과했습니다. `desktop.png` 1440x900, `mobile.png` 390x844 모두 유효합니다.

## fidelity
승인 comp가 없어 방향 계약을 기준으로 봤습니다. 결정 목업은 참고(도발)로만 썼습니다.

| 요소 | 판정 | 근거 |
|---|---|---|
| 툴바(검색·보기 설정·동기화) | match | |
| 기호표 범례 "한 줄" | contradicted | 1440에서 두 줄(힌트 줄 바꿈), 모바일에서는 6줄로 첫 화면의 절반을 차지 |
| 지형 띠 "아주 옅은 틴트" | contradicted | `#fff6cf` 노랑이 전략·KPI 두 열 전체를 크림색으로 칠함. 흐린 카드까지 노랗게 물들어 프로젝터에서 탁해짐. 크림 쪽으로 드리프트 |
| 규칙선 "등고선 갈색 1px" | contradicted (경미) | 열 머리 밑줄 `border-bottom: 2px`(1277행). 근거 없는 이탈 |
| 열 머리 큰 응축 숫자 | match | Barlow Condensed 24px, fontsource에서 직접 호스팅 |
| "전체 데이터는 조용한 지형" | contradicted | 비코스 카드를 `opacity: .32`로 흐리게만 해서 글자 대비가 약 2:1. 프로세스→태스크 팬아웃 엣지가 빗금 무아레 덩어리를 만들고(x≈760–790), 태스크 열 오른쪽에는 점선 skip 엣지가 커튼처럼 깔림. THESIS가 거부한 "흐린 엣지 덩어리" 그대로 |
| 번호 코스 1번→끝 | missing (부분) | 첫 화면에는 1–5번만 보임. 5→6 구간이 캔버스 오른쪽 아래로 빠져나가고 6–8번은 패널 뒤 열에 숨음. STORY의 "1번부터 끝까지"가 화면에서 이뤄지지 않음 |
| 코스 퍼플 독점 | contradicted (경미) | 검색 일치 카드의 점선 퍼플 outline(1396행), `.soe-link` 퍼플(1600행), 보기 설정 스위치 `:color="COURSE"`에 퍼플이 쓰임 |
| 상태 기호표 ▲◆, 양호는 무표시 | match | SVG 기호, 글리프 아님. 다만 카드 이름 뒤 "위험/주의/병목" 글자가 이름을 잘라 먹음(material_fixes 5번) |
| 우측 340px 패널, 코스 설명표 맨 위, 원인 분석 퍼플 버튼 | match | 표 위의 종류 칩은 금지 항목(material_fixes 4번) |
| TYPE | 숫자는 match, 열 이름은 acceptable adaptation | Barlow에 한글 글리프가 없음 |
| MATERIAL | match | 평면 인쇄 잉크. 가짜 물성(베벨·엠보스) 없음 |
| GROUND | 캔버스는 match, 띠는 contradicted | 캔버스 `#ffffff`는 OWN-WORLD의 흰 바탕과 일치. 띠 틴트는 위 행과 같이 너무 진하고 따뜻함 |

결정 목업에서 아직 받아들이지 않은 시도(fix에 포함):
- 맥락 노드에서 상자를 없애고 글자만 남김
- 패널에서 달성률을 큰 응축 숫자로 표시
- 상태 기호를 이름 앞에 둠
- 코스 노드를 열 위쪽에 두어 코스가 가로로 읽힘

## ceiling
- 출발점 △, 결승점 ◎이 없습니다. 지금은 모든 지점이 같은 번호 원입니다.
- 번호가 원 안에 들어가 있어 흔한 스텝 배지처럼 보입니다. ISOM 규칙대로 빈 통제점 원(r≈12) 바깥에 응축 퍼플 숫자를 두고, 구간 선은 원 가장자리에서 끊어야 합니다.
- 패널의 달성률 53.1%가 캡션 크기에 묻혀 있습니다. 카드의 응축 대형 숫자 처리를 쓰지 않았습니다.
- 코스 설명표에 ISOM 설명표의 칸 구획선(세로 규칙선)이 없습니다.
- 모든 카드의 진행 막대가 숫자를 중복합니다. 지도 잉크 세계에는 없는 UI 장치입니다.

## material_fixes
1. 조용한 지형 / THESIS
   - 대상: `StrategyOntologyExplorer.vue` 1392행 `.soe-card.dimmed { opacity: .32 }`
   - 변경: `opacity: 1; background: transparent; border-color: transparent; color: #7a7064;`으로 상자를 없앱니다. 흐린 카드에서는 진행 막대(`v-progress-linear`)와 `.soe-num` 색을 숨기거나 회색으로 바꿉니다.
   - 기준: 띠 위에서 글자 대비 3:1 이상. 프로젝터에서 맥락이 읽혀야 합니다.
2. 엣지 덩어리 제거 / THESIS
   - 대상: `drawnEdges`(192–207행)
   - 변경: 코스가 있을 때는 코스 구간에 닿는 엣지만 남기고 `e.skip` 엣지는 그리지 않습니다. 나머지 in-chain 엣지는 `stroke: #d8cbb8; opacity: .35`로 낮춥니다. 휴지 상태에서는 한 노드에서 나가는 팬아웃이 6개를 넘으면 hover 때만 그립니다.
3. 코스 끝까지 보이기 / STORY·FIRST VIEWPORT
   - 대상: layout 계산
   - 변경: 코스가 있으면 각 열의 코스 노드를 그 열의 첫 행으로 올려서, 5→6 구간이 아래로 떨어지지 않고 목업처럼 가로로 이어지게 합니다.
   - 추가: 선택 후 `scrollTo`가 코스 끝 지점 쪽으로 가로 스크롤하게 합니다. 캔버스 밖으로 나가는 구간에는 가장자리에 "→ 6" 표식을 그립니다(`courseDrawn`).
4. 금지된 키커 / Floor
   - 대상: 패널 제목 위의 `.soe-kind` 칩 "KPI 코스 3번"(916–919행)
   - 변경: 칩을 삭제합니다. 코스 번호는 제목 왼쪽의 퍼플 통제점 원으로, 종류는 부제 줄("KPI · 70.5 / 48 시간")로 옮깁니다.
5. 이름 잘림 / 가독성
   - 대상: 카드 제목 영역(850–866행)
   - 변경: `OntologySymbol`을 이름 앞으로 옮기고, 카드에서는 "위험/주의/병목/지연" 글자를 지웁니다. 상태 정보는 `aria-label`과 `title`에 남깁니다.
   - 이유: 지금은 "구매 프로세스…", "현업 구매 요청 …"처럼 핵심 이름이 잘립니다.
6. 지형 띠 강도 / OWN-WORLD
   - 대상: `TERRAIN_BAND`(40행)
   - 변경: `#fffbea`, `#f4f7ec`, `#eef4fa` 수준으로 낮춥니다. 범례 견본(744행)도 같은 값으로 맞추고, 열 머리 밑줄은 2px에서 1px로 바꿉니다(1277행).
7. 범례 한 줄 / FIRST VIEWPORT
   - 변경: 힌트("클릭: 코스 그리기…·동기화 시각")를 툴바 오른쪽의 동기화 버튼 옆으로 옮겨 범례를 1440에서 한 줄로 만듭니다.
   - 760px 이하에서는 범례를 "기호표" 토글 하나로 접습니다(736–748행, 1630행 미디어쿼리).
8. 퍼플 독점 / OWN-WORLD
   - `.soe-card.match`의 outline을 `2px dashed var(--contour)`로 바꿉니다.
   - `.soe-link`를 `var(--ink)` + 밑줄로 바꿉니다.
   - 보기 설정 `v-switch`의 `:color`를 잉크색으로 바꿉니다.

## keep
흰 캔버스 위의 퍼플 번호 코스와 오른쪽 코스 설명표(번호·종류·이름·값)가 1:1로 맞물리는 구조, SVG 기호 세트, Barlow Condensed 숫자는 고치는 동안 그대로 둡니다. 퍼플을 다른 용도에 나눠 쓰지 마세요.

검토한 파일:
- `/home/kimsanghoon/process-gpt-vue3/src/components/strategy/ontology/StrategyOntologyExplorer.vue`
- `/home/kimsanghoon/process-gpt-vue3/src/components/strategy/ontology/OntologySymbol.vue`
- `/home/kimsanghoon/process-gpt-vue3/.impeccable/surfaces/egy-ontology-strategyontologyexplorer-vue-475b4776.md`
- `/home/kimsanghoon/process-gpt-vue3/.impeccable/review/desktop.png`
- `/home/kimsanghoon/process-gpt-vue3/.impeccable/review/desktop-rest.png`
- `/home/kimsanghoon/process-gpt-vue3/.impeccable/review/mobile.png`
- `/home/kimsanghoon/process-gpt-vue3/.impeccable/mocks/decision/c-orienteering.png`</result>
<usage><subagent_tokens>59163</subagent_tokens><tool_uses>15</tool_uses><duration_ms>164442</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-07T07:34:22+00:00

```text
<task-notification>
<task-id>a94c34023997dd0f4</task-id>
<tool-use-id>toolu_01PfbNNfXfPheEgH6fc1vUiY</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/a94c34023997dd0f4.output</output-file>
<status>completed</status>
<summary>Agent "Finish review: explorer redesign" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>disposition: fix

## verdict
1. 조용한 지형: **resolved**. 코스 밖 카드는 상자 없이 회색 글자로만 남고, 프로젝터 거리에서도 읽히는 대비입니다. 진행 막대는 모든 카드에서 사라졌습니다. 코스 밖의 위험 카드(구매 프로세스 표준화, 표준 견적 비교 적용률, 재고 정확도 개선)는 빨간 테두리 상자를 유지합니다. "경보는 진짜 위험에만"이라는 원칙에 맞으므로 결함으로 보지 않습니다.
2. 엣지 덩어리: **partial**.
   - 선택 상태에서는 skip 점선 커튼이 사라졌습니다.
   - 하지만 구매 프로세스에서 태스크로 가는 팬아웃 빗금(x≈755–790)이 옅어진 채 남아 있습니다.
   - `desktop-rest.png`에서는 전략·KPI 사이(x≈270–310), 프로세스·태스크 사이(x≈750–790), 태스크·인스턴스 사이(x≈990–1030) 세 거터에 갈색 선 다발이 그대로 뭉쳐 있습니다.
   - 팬아웃이 6개를 넘는 엣지를 hover에서만 그린다는 변경이 휴지 화면에서 확인되지 않습니다.
3. 코스 끝까지: **partial**. pinFirst 덕분에 코스가 첫 행을 따라 가로로 읽히고, 1번 △부터 6번까지 첫 화면에 보입니다. 그러나 7·8번(워크아이템·사용자)은 패널 뒤 열에 숨어 있고, 6번 원이 캔버스 오른쪽 가장자리에서 끝납니다. 가장자리 표식("→ 7")은 넣지 않았다고 직접 밝혔습니다. STORY의 "끝까지"는 아직 화면만으로 전달되지 않습니다.
4. 키커 칩: **resolved**. 칩이 사라졌고 부제가 "KPI · 70.5 / 48 시간"입니다.
5. 이름 잘림: **partial**. 기호가 이름 앞으로 갔고 상태 글자도 빠져서 "표준 견적 비교 적용률"은 이제 다 보입니다. 하지만 전략 열은 계층 들여쓰기로 카드 폭이 줄어 "현업 구매 요청 만족도 …", "구매 프로세스 표준화…", "구매 담당자 역량 …", "AI 에이전트 활용 …"이 여전히 잘립니다. 데스크톱·모바일 모두 같습니다.
6. 지형 띠: **resolved**. 띠는 아주 옅은 틴트가 되었고, 열 머리와 표의 규칙선은 1px 갈색입니다.
7. 범례 한 줄: **resolved**. 1440에서 한 줄이고 힌트는 툴바로 옮겨졌습니다. 모바일에서는 "기호표" 토글로 접힙니다.
8. 퍼플 독점: **resolved**. 퍼플은 코스, 선택 카드, 원인 분석 버튼, 코스 설명표 번호 원에만 남았습니다.

이번 수정 묶음이 만든 회귀:
- **코스 번호 가독성 저하.** 원 바깥으로 뺀 번호("3", "4", "5", "6")가 약 10px로 작고 원에서 떨어져 떠 있습니다. "4"는 열 사이 빈 곳에 혼자 떠 있어 프로젝터에서는 거의 사라집니다. 패널 제목의 "○³"는 각주 위첨자처럼 읽힙니다. 번호는 Barlow Condensed 14–16px 이상으로 원에 붙여 두고, 패널 제목에서는 원 안에 번호를 넣으세요.
- **선택할 때마다 지형이 재배열됨.** pinFirst 때문에 KPI를 고를 때마다 열 순서가 바뀝니다. 예를 들어 휴지 상태에서 4번째인 "구매 처리 리드타임"이 맨 위로 올라갑니다. 카드는 absolute 위치에 전환 효과 없이 순간 이동하므로, 사용자가 익힌 공간 감각("지도는 움직이지 않는다")이 깨집니다. top에 ease-out 200ms 정도 전환을 주고 reduced-motion에서는 끄거나, 고정은 코스 노드에 한해 열 안에서만 하도록 범위를 줄이세요.

## remaining
- 2 (partial): 휴지 상태의 세 거터 엣지 다발. hover 전용 처리가 실제 렌더에 반영되었는지 확인하고, 휴지 엣지를 `opacity .3` 이하로 낮추세요.
- 3 (partial): 7·8번이 화면에 보이지 않습니다. 캔버스 가장자리에 "→ 7·8" 표식을 넣거나, 선택 시 사람 열까지 가로로 스크롤하세요.
- 5 (partial): 전략 열 들여쓰기 때문에 이름이 잘립니다. 들여쓰기 단계를 줄이거나(예: 8px/단계), 제목을 2줄 clamp로 바꾸세요.
- 회귀 2건: 코스 번호 가독성, 선택 시 재배열 순간 이동.

이번 판정 결과는 fix입니다. 여기서 ship이 나오더라도 위에서 채점한 수정 항목에만 해당하며, 화면 전체에 대한 판정은 아닙니다.

disposition: fix</result>
<usage><subagent_tokens>68541</subagent_tokens><tool_uses>3</tool_uses><duration_ms>47997</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-07T07:38:34+00:00

```text
<task-notification>
<task-id>a94c34023997dd0f4</task-id>
<tool-use-id>toolu_01Loocry9Enkc4HQzfnCk9CN</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/a94c34023997dd0f4.output</output-file>
<status>completed</status>
<summary>Agent "Finish review: explorer redesign" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>disposition: fix

## verdict
- 2 휴지 엣지: **resolved**. `desktop-rest.png`에서 세 거터의 선 다발이 0.3 투명도로 물러나 배경 지형처럼 읽힙니다. 카드와 글자가 앞에 섭니다.
- 3 코스 끝: **partial**. 데스크톱에서는 "코스 8 →" 표식이 보이고, 7번은 접힌 열이라 표에만 나오는 것도 맞습니다. 하지만 `mobile.png`에서는 4–8번이 모두 화면 밖인데 표식이 하나도 보이지 않습니다.
- 5 이름 잘림: **resolved**. "현업 구매 요청 만족도 향상", "구매 담당자 역량 강화", "AI 에이전트 활용 확대"가 데스크톱과 모바일 모두에서 끝까지 보입니다. 남은 "구매 프로세스 표준화·…"는 원래 이름이 긴 경우라 허용합니다.
- 회귀 1 (코스 번호): **resolved**. 2·3·4·5번이 응축 굵은 숫자로 링 왼쪽 위에 붙어 있어 읽힙니다. 패널 제목도 ③ 통제점 원 안에 번호가 들어갔습니다.
- 회귀 2 (재배열 순간 이동): **resolved**. 정지 캡처로는 움직임을 볼 수 없어서 소스로 확인했습니다. `.soe-card`에 `transition: top .2s ease-out, left .2s ease-out`(1498행)이 있고, reduced-motion에서는 `transition: none`(1788–1791행)입니다.

이번 수정 묶음이 만든 회귀:
1. **모바일 페이지 가로 넘침 (material).** `mobile.png`에서 페이지 전체가 왼쪽으로 밀려 있습니다. "전략 보드" 제목, 탭 카드, 상세 패널의 왼쪽이 잘리고 오른쪽에는 빈 여백이 생겼습니다.
   - 원인: 새로 생긴 `.soe-canvas-wrap`(1329행, `display: flex`) 안에서 760px 이하 미디어쿼리의 `.soe-canvas { flex: 0 0 auto }`가 캔버스를 내용 폭(전체 레이아웃 폭)만큼 늘립니다.
   - 같은 원인 때문에 `courseOff` 계산에 쓰는 캔버스 가시 폭도 내용 폭과 같아져, 모바일에서 표식이 사라졌을 가능성이 큽니다.
   - 수정: 미디어쿼리를 `.soe-canvas { flex: 1 1 0; min-width: 0; height: 60vh }`로 바꾸고, `.soe-canvas-wrap`에 `width: 100%`를 줍니다.
2. **데스크톱 표식 충돌.** "코스 8 →" 알약(`.soe-offmark` `top: 64px`)이 코스 5번 카드 "견적 검토"의 오른쪽 위 모서리와 6번 링 위를 덮습니다. 수정은 둘 중 하나입니다.
   - 알약을 열 머리 띠 안(`top: 12px`, 52px 높이의 sticky 머리 영역)으로 올립니다.
   - 6번이 잘려 보이는 동안에는 6번 링에서 떨어진 오른쪽 아래 가장자리로 옮깁니다.

## remaining
- 3 (partial): 모바일에서 화면 밖 코스 표식이 보이지 않습니다. 회귀 1을 고친 뒤 다시 캡처해 확인하세요.
- 회귀 1 (material): 390px에서 페이지가 가로로 넘칩니다. `StrategyOntologyExplorer.vue`의 760px 미디어쿼리와 `.soe-canvas-wrap`을 고쳐야 합니다.
- 회귀 2: "코스 8 →" 알약이 5번 카드와 6번 링을 덮습니다.

ship 판정이 나오더라도 이번에 채점한 항목에만 해당하며, 화면 전체에 대한 판정은 아닙니다. 지금은 위 항목이 열려 있어 ship이 아닙니다.

disposition: fix</result>
<usage><subagent_tokens>79475</subagent_tokens><tool_uses>6</tool_uses><duration_ms>49656</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-07T07:43:14+00:00

```text
<task-notification>
<task-id>a518f441b5af6397c</task-id>
<tool-use-id>toolu_01QZ2GCoyh2Mpdi45vYtwcTk</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/tasks/a518f441b5af6397c.output</output-file>
<status>completed</status>
<summary>Agent "Document explorer design world" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I wrote DESIGN.md and its sidecar. The first section of DESIGN.md says this system covers only the 온톨로지 익스플로러 screen, and that the rest of the app keeps the existing Vuetify / PAL design system (`SKGlobalStyle.scss`, `_variables.scss`). There was no DESIGN.md before, so nothing was merged or overwritten. No source files were edited.

**Paths written**
- /home/kimsanghoon/process-gpt-vue3/DESIGN.md
- /home/kimsanghoon/process-gpt-vue3/.impeccable/design.json

**System summary**
1. **Palette:** course purple `#7b2cbf` and its wash `#f3eafb` for the selected course and main actions only. Status inks: risk `#c4231b`, warn `#a85b00`. Achievement-rate colours shared with the strategy map tab: `#dc2626` / `#b45309` / `#15803d` / `#6b7280`. Three terrain tints: `#fffbea` / `#f4f7ec` / `#eef4fa`, plus four matching terrain inks. Neutrals: white paper, `#1d1b18` ink, contour brown `#8c5a2b` and soft contour `#e2d6c6`.
2. **Type ramp:** Barlow Condensed with tabular figures for all numbers (44 / 24 / 20 / 17 / 15 / 14px). All other text inherits the app font, Plus Jakarta Sans (18 / 13 / 12.5 / 12 / 11.5px).
3. **Colour rules:** Course-Only Purple, Shape-Before-Color, Quiet Terrain.
4. **Type and depth rules:** Condensed Numerals; Contour Line (1px lines, no shadows).
5. **Token groups recorded:** in the frontmatter, colours (27), typography (12 roles), corner radius (5), spacing (6) and components (11). In the sidecar, colour details with 8-step tonal ramps in OKLCH, type descriptions, one shadow, stroke and focus rules, motion, the 760px breakpoint, layout constants, 9 component snippets and the narrative.

**Defects and drift recorded only as findings, not as system rules or tokens**
- **Two reds and ambers for the same status:** the symbols and status words use `#c4231b` / `#a85b00`, while achievement numbers use `#dc2626` / `#b45309`. I recorded both sets with their roles and did not pick one.
- **Faded-node subtext is below the contrast floor:** greyed-out nodes use `#8a8073` (3.9:1 on white) and their icons use `#9a8f80` (3.2:1), both under PRODUCT.md's 4.5:1. I left them out of the tokens so the system doesn't make them look intentional.
- **Pastel Vuetify chips and caption labels remain in the detail panel:** 연결 체인, 개선 후보 and 직접 연결 still use them, which the direction contract rejects. I kept the "no pastel chips" rule to the map canvas, because the build still uses these chips in the panel.
- **`--ink` means two things in the CSS:** it's the main text colour (`#1d1b18`), but it's reset to the column's terrain colour in the column headers.
- **Terrain tints are hard-coded twice:** the legend swatches repeat the terrain tint values inline instead of using the same constant as the columns.

**Not derived**
- Button corner radius, height and hover/focus states come from Vuetify defaults, which this surface doesn't override. The sidecar button hovers imitate Vuetify's hover overlay and are marked as not part of the system.
- How Korean text actually renders depends on the system font, since the app font only covers Latin text.
- I did not ask you to confirm the names and descriptive wording, as the document process normally would. They are taken from the direction contract and the code comments.</result>
<usage><subagent_tokens>70936</subagent_tokens><tool_uses>18</tool_uses><duration_ms>228862</duration_ms></usage>
</task-notification>
```

## Note — 2026-10-07T07:46:08+00:00

```text
익스플로러 리디자인(impeccable new-work): PRODUCT.md 작성, 방향 4종 목업(현황판·노선도·오리엔티어링·표준) 중 사용자가 C 오리엔티어링 선택. 지형 틴트·등고선 1px·코스 퍼플(선택 경로 전용)·▲◆○◎ 기호·Barlow Condensed 숫자·코스(결정적 경로, coursePath)·코스 설명표·화면 밖 코스 표식. finish review 2라운드(fix→fix) 후 남은 회귀 직접 수정·확인, detect []. DESIGN.md(익스플로러 전용 범위)+.impeccable/design.json. 매뉴얼 이미지·본문 갱신.
```

## Prompt — 2026-10-08T07:54:05+00:00

```text
1. https://github.com/uengine-oss/ontology-studio
2. Db 를 온톨로지칼 db 를 사용. 현재 아파치 Age 사용중일텐데 아파치 age 는 supabase saas와 통합이 안됨.
```

## Prompt — 2026-10-08T07:56:17+00:00

```text
1. https://github.com/uengine-oss/ontology-studio
2. Db 를 온톨로지칼 db 를 사용. 현재 아파치 Age 사용중일텐데 아파치 age 는 supabase saas와 통합이 안됨.
3. https://youtu.be/NoPGRBnHOXs?si=kLiZehqEThQWrxu3 
해당 유튜브 까지 참고하여 현재 Ontology explorer과 어떤 차이가 있는지 확인하고, ontology-studio를 참고하여 개선포인트 확인.
```

## Prompt — 2026-10-08T07:58:46+00:00

```text
한국어로.
```

## Prompt — 2026-10-08T08:01:39+00:00

```text
순서대로 진행하도록해.
이후에 B.      단기 목표 : 귀사를 통해 아래 사항을 설명을 오프라인 미팅 또는 설명회 형태로 받고 싶습니다.

1. AX전환에 앞서나가는 다른 회사들은 어떻게 AX 전환을 준비하고, 실행하고, 성과를 얻고 있는가?
l   아래 CASE는 단순 예시로 제 상상력에 기반한 사항입니다.
       i.         CASE1) 특정 영역에 내부 AI 서비스 구축 ( 에이전트 )
       ii.         CASE2) 특정 영역에 내부 AI 서비스 구축 + 중장기적으로 전사 AI 솔루션 준비중 + AI에 적합한 BPM 재설계 등
       iii.         CASE3) 완성된 AI Solution 도입 등

l   가능하면 USE CASE가 몇 건 있길 희망합니다.

2. 귀사의 솔루션을 가지고 SOLiD에 어떤 AX체계를 구축할 기회를 제공할 수 있는지 알고 싶습니다.
두가지를 위하여 Ontology Explorer를 포함한 전체 Process-GPT에 대한 시연 및 시나리오가 필요한데 이것도 /speckit-run을 통해서 계획을 세우고 진행해봐.
```
