# tenant-scoped-agent-streaming Specification

## Purpose
Define how the frontend determines the current tenant and authenticates agent
requests, so that the default agent streams for every tenant rather than only for
the one whose name happened to be hardcoded.

## Requirements

### Requirement: A single tenant resolver is the only source of tenant identity
`src/utils/tenant.js` SHALL be the only place that decides the current tenant.
`getTenantId()` resolves `window.$tenantName` → cached session JWT
`app_metadata.tenant_id` → `localStorage.tenantId` → `''`.
`resolveTenantId()` additionally queries the session when the synchronous chain
yields nothing. Components MUST NOT re-implement the chain inline and MUST NOT
substitute a literal tenant name.

#### Scenario: Subdomain wins when present
- **GIVEN** the app is served from `acme.process-gpt.io` so `$tenantName` is `acme`
- **WHEN** `getTenantId()` is called
- **THEN** it returns `acme`

#### Scenario: Main domain falls back to the JWT claim
- **GIVEN** the app is served from the main domain so `$tenantName` is undefined
- **AND** the session's `app_metadata.tenant_id` is `acme`
- **WHEN** `App.vue` completes tenant initialization and `getTenantId()` is called
- **THEN** it returns `acme`

#### Scenario: Unknown tenant returns empty, never a literal
- **GIVEN** no subdomain, no cached claim, and no persisted selection
- **WHEN** `getTenantId()` is called
- **THEN** it returns `''`
- **AND** it MUST NOT return `'uengine'` or `'process-gpt'`

### Requirement: Agent clients send the bearer token
Every agent client SHALL build its request headers via `buildAgentHeaders()`,
which sets `Content-Type`, `Authorization: Bearer <jwt>` when a JWT is present,
and `X-Tenant-Id` when a tenant is resolved. This applies to all four clients:
`FixedBaseWorkAssistantAgentService`, `WorkAssistantAgentService`,
`AgentRouterService`, and `DeepAgentRouterService`.

#### Scenario: Every agent endpoint carries the header
- **GIVEN** a logged-in user with a valid session
- **WHEN** any of `/chat`, `/chat/stream`, `/chat/stream/attach`, `route`,
  `warmup`, or `{agentId}/chat/stream` is called
- **THEN** the request carries `Authorization: Bearer <access_token>`

#### Scenario: The stream path resolves the tenant asynchronously
- **GIVEN** `streamAgents()` is about to issue a request
- **WHEN** the tenant cannot be resolved synchronously
- **THEN** it awaits `resolveTenantId()` before sending
- **AND** the request's `tenant_id` is the resolved value

### Requirement: The default agent profile is not bound to a tenant
The hardcoded main-chat agent profile in `ProcessDefinitionMap.vue` SHALL take
its `tenant_id` from the resolver at component creation, not from a literal.

#### Scenario: Default agent profile adopts the current tenant
- **GIVEN** a user in tenant `acme`
- **WHEN** the definition-map main chat initializes
- **THEN** `mainChatAgentInfo.tenant_id` is `acme`
