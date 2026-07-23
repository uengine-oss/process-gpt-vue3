# tenant-data-isolation Specification

## Purpose
Define how tenant-owned reads and tenant creation are scoped, so that a user only
ever sees the data of the tenant they are in.

## Requirements

### Requirement: The backend facade injects the tenant filter
`ProcessGPTBackend.ts` SHALL expose `withTenantMatch(options)` and use it for
every read of a tenant-owned table, so individual call sites cannot omit the
filter. It SHALL respect an explicit caller-supplied `tenant_id` and SHALL be a
no-op when the tenant is unknown.

#### Scenario: Caller-supplied tenant is respected
- **GIVEN** a caller passes `{ match: { tenant_id: 'other' } }`
- **WHEN** `withTenantMatch` processes the options
- **THEN** `tenant_id` remains `'other'`

#### Scenario: Unknown tenant adds no filter
- **GIVEN** `getTenantId()` returns `''`
- **WHEN** `withTenantMatch` processes the options
- **THEN** no `tenant_id` is added
- **AND** no literal tenant name is substituted

### Requirement: Tenant-owned reads are scoped
The following SHALL be tenant-scoped: `getChatRoomList`,
`getAllInstanceList`, `getInstanceByProjectId`, `fetchInstanceListByStatus`,
`getInstanceList`, `getDeletedInstances`, `getWorkList`, `getWorkListByInstId`,
`getWorkListByRootInstId`, and every branch of `listDefinition`
(`form_def`, `dmn`, `bpmn`, default). `StorageBaseSupabase.searchProcDef` and
`searchChatRoom` SHALL likewise be tenant-scoped.

#### Scenario: Definition list is scoped for every type
- **GIVEN** `bpmn` and `dmn` definitions exist in two tenants
- **WHEN** `listDefinition('bpmn')` or `listDefinition('dmn')` is called in tenant A
- **THEN** only tenant A's definitions are returned

#### Scenario: Chat messages are scoped by room, not by tenant column
- **GIVEN** the room list is already tenant-scoped and a room id identifies one room
- **WHEN** that room's messages are loaded
- **THEN** the query filters by room id alone
- **AND** messages persisted without a `tenant_id` (agent SDK fallback writes) remain visible

#### Scenario: Chat room list is scoped
- **GIVEN** chat rooms exist in two tenants
- **WHEN** `getChatRoomList('chat_rooms')` is called in tenant A
- **THEN** only tenant A's rooms are returned
- **AND** participant-based client-side filtering is not relied on for isolation

#### Scenario: Search does not cross tenants
- **GIVEN** a chat room and a process definition in tenant B matching the keyword
- **WHEN** a user in tenant A searches for it
- **THEN** neither result is returned

### Requirement: Tenant creation rebinds the session before seeding
`putTenant()` SHALL call `setTenant()` and update the resolver cache and
`localStorage.tenantId` **before** duplicating the default processes.

#### Scenario: Seeds land in the new tenant
- **GIVEN** a session claiming tenant A
- **WHEN** the user creates tenant B via `putTenant('B')`
- **THEN** `setTenant('B')` completes before the first `duplicateDefinition` call
- **AND** the seeded definitions belong to tenant B
