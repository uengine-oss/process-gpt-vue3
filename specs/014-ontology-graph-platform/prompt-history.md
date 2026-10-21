# Prompt History — 014-ontology-graph-platform

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-10-08T08:01:53+00:00

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

## Prompt — 2026-10-08T08:07:52+00:00

```text
<task-notification>
<task-id>b5df7w9z8</task-id>
<tool-use-id>toolu_014Qu49foqvXku9m5xTwVgyf</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/f5dde063-155e-4276-9652-d1473fe692c2/tasks/b5df7w9z8.output</output-file>
<status>completed</status>
<summary>Background command "mkdir -p /home/kimsanghoon/process-gpt-vue3/supabase/ontological &amp;&amp; cat &gt; /home/kimsanghoon/process-gpt-vue3/supabase/ontological/Dockerfile &lt;&lt;'EOF'
# Supabase 로컬 DB 이미지(supabase CLI 가 쓰는 public.ecr.aws/supabase/postgres)에 ontological-db 를 얹는다.
# supabase/age/Dockerfile 과 같은 방식: 이미지 안의 nix 빌드 pg_config/헤더로 컴파일하고,
# 서버가 실제로 쓰는 postgresql-and-plugins 경로에 넣는다.
# 빌드·적용: supabase/ontological/install.sh
#
# BASE_IMAGE 는 AGE 를 이미 얹은 이미지(현재 CLI 태그)를 기본으로 한다 — 전환 기간 동안 두 확장이 함께 있다.
ARG BASE_IMAGE=public.ecr.aws/supabase/postgres:15.8.1.085
ARG OG_REF=3179cc7

FROM ${BASE_IMAGE} AS build
ARG OG_REF
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 &amp;&amp; apt-get install -y --no-install-recommends \
      ca-certificates curl git pkg-config gcc g++ make libc6-dev libssl-dev clang libclang-dev \
 &amp;&amp; rm -rf /var/lib/apt/lists/*
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
RUN cargo install cargo-pgrx --version 0.19.2 --locked
RUN git clone https://github.com/uengine-oss/ontological-db.git /src \
 &amp;&amp; git -C /src checkout "${OG_REF}"
WORKDIR /src/engine
# /usr/bin/pg_config 는 심볼릭 링크라 틀린 경로를 낸다 — 실제 nix 경로의 pg_config 를 쓴다.
RUN PGC="$(readlink -f /usr/bin/pg_config)" \
 &amp;&amp; cargo pgrx init --pg15 "$PGC" \
 &amp;&amp; cargo pgrx package --features pg15 --no-default-features --pg-config "$PGC" --out-dir /pkg \
 &amp;&amp; mkdir -p /out/lib /out/extension \
 &amp;&amp; find /pkg -name 'ontological*.so' -exec cp {} /out/lib/ \; \
 &amp;&amp; find /pkg -path '*extension*' \( -name 'ontological*.sql' -o -name 'ontological*.control' \) -exec cp {} /out/extension/ \; \
 &amp;&amp; ls -l /out/lib /out/extension

FROM ${BASE_IMAGE}
COPY --from=build /out /tmp/og-out
RUN set -eux; \
    libdir="$(dirname "$(dirname "$(readlink -f /usr/bin/postgres)")")/lib"; \
    extdir="$(readlink -f /usr/share/postgresql/extension)"; \
    chmod u+w "$libdir" "$extdir"; \
    cp /tmp/og-out/lib/*.so "$libdir/"; \
    cp /tmp/og-out/extension/* "$extdir/"; \
    chmod u-w "$libdir" "$extdir"; \
    rm -rf /tmp/og-out
EOF
cd /home/kimsanghoon/process-gpt-vue3/supabase/ontological &amp;&amp; docker build -t process-gpt/supabase-postgres-ontological:15.8.1.085 . &gt; /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/scratchpad/og-build.log 2&gt;&amp;1; echo exit=$?; tail -30 /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/17697b9c-c4a5-4427-99a0-735bbdb3d70d/scratchpad/og-build.log" completed (exit code 0)</summary>
</task-notification>
```

## Note — 2026-10-08T08:30:01+00:00

```text
P0 완료: ontological-db PG15 확장(supabase/ontological, 패치 1건)·strategy-service OntologicalGraphStore(계약 테스트 통과, 152 passed)·AGE→ontological 이관(tym 738/1307 일치)·start-all.sh 기본 ontological. API 응답 AGE 와 동일, 서브그래프 0.1s·동기화 7.7s(AGE 7.2s). 상류 이슈 5건 supabase/ontological/README.md
```

## Prompt — 2026-10-08T08:32:08+00:00

```text
<task-notification>
<task-id>a79b754c293ab79ec</task-id>
<tool-use-id>toolu_016VQURV9XTAPk2bttzwKAAk</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/f5dde063-155e-4276-9652-d1473fe692c2/tasks/a79b754c293ab79ec.output</output-file>
<status>completed</status>
<summary>Agent "Find MCP integration in Process GPT" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Process GPT has no separate MCP registry. Each tenant's MCP servers are stored as one JSON blob in the `tenants.mcp` column, in the Claude Desktop `{"mcpServers": {...}}` format. Agents reach them by server-key name at runtime. Under /home/kimsanghoon there are no `process-gpt-agent*` repos and no repos with "mcp" in the name. The repos present are process-gpt-vue3, process-gpt-completion, process-gpt-deep-research, process-gpt-memento and process-gpt-strategy(-skill), plus `backups` and `incident-2026-10-05`, which I did not search.

## (1) Where configs are stored, and the entry format
- **DB column:** `tenants.mcp`, type `jsonb`.
  - /home/kimsanghoon/process-gpt-vue3/docker-compose/volumes/db/init.sql:138 has `mcp jsonb null,`
  - /home/kimsanghoon/process-gpt-vue3/docker-compose/volumes/db/migration.sql:78 has `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mcp jsonb;`
- **Frontend read/write:** /home/kimsanghoon/process-gpt-vue3/src/components/api/ProcessGPTBackend.ts
  - `getMCPByTenant()` (7248) runs `storage.getString('tenants', { match: { id: window.$tenantName }, column: 'mcp' })`.
  - `setMCPByTenant(mcp)` (7275) runs `storage.putObject('tenants', { id: tenantId, mcp })`. Every edit rewrites the whole blob.
- **Backend read:** `fetch_tenant_mcp_config(tenant_id)` runs `supabase.table('tenants').select('mcp').eq('id', tenant_id)`. Copies are in /home/kimsanghoon/process-gpt-completion/database.py:1769 and /home/kimsanghoon/process-gpt-completion/polling_service/database.py:2393.
- **Entry format:** `{"mcpServers": {"&lt;key&gt;": {...}}}`. There is no fixed schema. The fields the code looks at are:
  - **stdio servers:** `command` (`npx`/`uvx`/`deno`) and `args`. Environment variables are probably supplied through the "MCP 환경변수" tab, which calls `/mcp/configmaps` and `/mcp/secrets`. I did not check whether the runtime actually injects them.
  - **remote servers:** `url`, `type` or `transport` (`http`/`sse`/`url`), and `headers` (auth goes here, e.g. a Bearer token).
  - **UI-only flags:** `enabled` (defaults to true; MCPServer.vue:462) and `is_default` (a read-only built-in server; MCPServer.vue:366-374). `description` is optional and shown as a subtitle.

## (2) UI: the "MCP 서버" tab in Account Settings
- **Tab:** /home/kimsanghoon/process-gpt-vue3/src/views/pages/account-settings/AccountSettings.vue:30-36 defines `MCP-Servers` and `MCP-Environments`. Both are hidden in uEngine mode.
- **Main component:** /home/kimsanghoon/process-gpt-vue3/src/components/pages/account-settings/MCPServer.vue, which uses a Monaco JSON editor whose state lives in the store /home/kimsanghoon/process-gpt-vue3/src/stores/mcpEditor.ts.
  - `loadData()` at 458 calls `getMCPByTenant()`, then auto-validates every enabled server.
  - `addNewMCP()` at 508 seeds the editor with `{ "mcpServers": {} }`; the user pastes a Claude-Desktop-style snippet. `saveNewMCP()` at 713 merges the first key into the blob and saves it.
  - Edit, toggle and delete are `saveServerChanges()` at 589, `toggleServer()` at 570 and `deleteServer()` at 661. All three end in `setMCPByTenant`.
  - Badges at 692-710 classify servers by `command` (npx/uvx/deno) or by `type` (`url`/`sse`/`http`, shown as "Web Service").
- **Tool listing:** tools are not stored in the DB. The UI fetches them live through /home/kimsanghoon/process-gpt-vue3/src/services/McpValidatorService.js, which sends `POST ${VITE_MCP_VALIDATOR_URL || '/mcp-validator'}/validate` with `{mcpServers, timeout}` and gets back `servers[0]` (status and tools). The result is rendered by `McpValidationResult.vue`.
- **Gateway routes:** /home/kimsanghoon/process-gpt-vue3/gateway/src/main/resources/application.yml:176-217.
  - `/mcp-validator/**` goes to `http://mcp-validator:8800`.
  - `/mcp/**`, `/mcp/*/sse/**` and `/mcp/*/{create|status}` go to `http://mcp-proxy-service:80`.
- **Other backend calls** (ProcessGPTBackend.ts):
  - `getMCPLists()` at 7948 calls `GET /mcp/tools`.
  - `getMCPTools()` at 7239 calls `GET /completion/mcp-tools`. That endpoint is served by /home/kimsanghoon/process-gpt-completion/mcp_config_api.py:6-13 and returns the static catalog in /home/kimsanghoon/process-gpt-completion/mcp.json, which contains only stdio npx/uvx entries.
  - The MCP-Environments tab uses `/mcp/configmaps` and `/mcp/secrets` (7803-7873).
- **Linking servers to agents:** /home/kimsanghoon/process-gpt-vue3/src/components/ui/field/AgentField.vue:527-541 builds the pick list from `mcpServers` keys. The selected keys are stored comma-separated in the agent's `tools` field. AgentSelectField.vue:901 does the same.

## (3) Runtime: how an agent connects
- **Service tasks:** /home/kimsanghoon/process-gpt-completion/polling_service/polling_service.py:72-76 sends activities of type `servicetask` to `handle_service_workitem` (polling_service/workitem_processor.py:5026). That function looks up the agent from `workitem.user_id` and calls `mcp_processor.execute_mcp_tools(workitem, agent_info, tenant_id)` at line 5141.
- **Client:** /home/kimsanghoon/process-gpt-completion/polling_service/mcp_processor.py uses `langchain_mcp_adapters.client.MultiServerMCPClient` with a LangGraph `create_react_agent`.
  - `get_mcp_tools_from_tenant()` (58-93) loads `tenants.mcp`, splits `agent_info['tools']` on commas, and keeps only the matching `mcpServers` entries.
  - `initialize_mcp_client()` (95-117) runs `MultiServerMCPClient(self.mcp_configs)` and then `get_tools()`.
  - An activity whose `tool` is `"mcp:&lt;name&gt;"` pins a specific tool (lines 171-173).
- **How tenant is passed:** only as `tenant_id`, which selects which `tenants` row is read (through a Supabase client held in a contextvar). I found no tenant header injected into MCP requests. Any per-tenant auth must already be in the entry's `headers`.
- **Transports supported:**
  - `MultiServerMCPClient` gets the raw entries and supports stdio, sse and streamable_http according to the library.
  - /home/kimsanghoon/process-gpt-completion/mcp_tool_index.py (copy in polling_service/) uses fastmcp. `_remote_transport` (~27-53) reads `transport` or `type`, defaulting to `"http"`, and uses `SSETransport` if the value is `sse`, otherwise `StreamableHttpTransport(url=url, headers=headers)`. It keeps the URL exactly as written, with no trailing slash added; the docstring explains that `mcp.supabase.com` returns 404 on `/mcp/`.
  - `_client_config` (~56-70) renames `type` to `transport` for fastmcp and falls back to stdio when there is no `url`.
- **Deterministic code path:** /home/kimsanghoon/process-gpt-completion/deterministic_template.py:100-120 generates code with `call_tool(server_key, tool_name, args)`. That code reads the config from the `MCP_CONFIG` env var and calls `fastmcp.Client({"mcpServers": {key: cfg}})`. Generated code is stored in the `mcp_python_code` table (migrations in /home/kimsanghoon/process-gpt-completion/supabase/migrations/2026082*/2026090*_mcp_python_code_*.sql).

## (4) Example entries and URL formats
- **No seed or migration inserts a `tenants.mcp` value.** I found no `is_default` MCP seed in the SQL files under process-gpt-vue3/docker-compose and process-gpt-completion.
- **/home/kimsanghoon/process-gpt-completion/mcp.json** is a stdio-only catalog, for example `"airbnb": {"command": "npx", "args": ["-y", "airbnb-mcp-server"]}` and `"arxiv": {"command": "uvx", "args": ["mcp_server_arxiv"]}`.
- **Remote URL formats seen in the code:**
  - /home/kimsanghoon/process-gpt-deep-research/src/config.py:58 has `PROCESS_GPT_OFFICE_MCP_URL` with default `http://process-gpt-office-mcp-service:1192/mcp` (streamable-http on `/mcp`).
  - The `mcp.supabase.com` `/mcp` case in the mcp_tool_index.py docstring.
  - /home/kimsanghoon/supabase.md:6 lists local Supabase MCP at `http://127.0.0.1:54321/mcp`.
- **Implied remote entry shape** (assembled from what the code reads; not taken from a real record):
  ```json
  {"mcpServers": {"office": {"type": "http", "url": "http://host:port/mcp", "headers": {"Authorization": "Bearer ..."}, "enabled": true}}}
  ```</result>
<usage><subagent_tokens>46307</subagent_tokens><tool_uses>17</tool_uses><duration_ms>115672</duration_ms></usage>
</task-notification>
```

## Note — 2026-10-08T08:57:44+00:00

```text
P1 완료: strategy-service MCP(/mcp, streamable-http, 읽기 전용 6도구)·엔티티 해소(평가 22/22, 없는 이름 확정 0)·Process GPT tenants.mcp 등록(tym)·completion mcp_adapter_config(화면용 키로 원격 MCP 실패하던 기존 버그 수정). P2-1 완료: /api/ontology/ask + 익스플로러 질문하기(답·근거 경로 코스·에이전트 단계, 근거 없으면 경로 미표시)
```

## Note — 2026-10-08T09:12:12+00:00

```text
P2-2 완료: 영향 가설(시차 상관+순열 검정, 판정 유지, 승인→INFLUENCES_KPI, 원인 분석·질의에 반영), 관계 출처(EDGE_META origin, 상세 패널 표시), 데모 KPI 주간 이력 17주(대조군 포함). 엔진 동시성 이슈 #7 어댑터 재시도.
```

## Note — 2026-10-08T09:41:26+00:00

```text
P3 완료: 시점 슬라이더(/api/ontology/graph?as_of, KPI 측정 이력·실행 시작/종료 기준), 분석 대시보드 교차 필터(도메인·기간 양방향, PAL 대시보드). 발견·수정: PERFORMS 실행 집계가 full 동기화마다 누적되던 기존 버그. 매뉴얼 작성: docs/manuals/ontology-graph-platform.md
```
