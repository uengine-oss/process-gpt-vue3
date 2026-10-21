# Prompt History — 009-tenant-admin-customization

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-09-28T02:33:39+00:00

```text
> 의도 (why & value)
현재 추가되어있는 기능들 중, 메뉴얼 기반으로 사용자화가 부족 한 부분(도메인 수정/삭제, 미분류 도메인, 메뉴 목록 설정 등)을 찾아 수정하여 각 테넌트의 관리자가 uEngine PAL을 자신의 업무 환경에 맞춰 사용 할 수 있도록 한다.

> 인수조건 (Definition of Done)
- 변경(추가) 된 기능 목록 (최소 위 3가지 포함)
- 해당 기능에 대한 사용자 가이드

> 컨텍스트 (참고자료 위치)
- @docs/PI_System_통합_사용자_매뉴얼.docx
```

## Prompt — 2026-09-28T02:38:40+00:00

```text
<task-notification>
<task-id>a9da457192300d087</task-id>
<tool-use-id>toolu_012KdWaXH2wi83KJftw1xCiN</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/49f9096d-2df4-4b1e-84f9-16ce235e27e8/tasks/a9da457192300d087.output</output-file>
<status>completed</status>
<summary>Agent "Explore menu settings code" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## 1. How the sidebar is built

**Single component, no data-driven menu file.** The vertical sidebar is one monolithic `.vue` (~59 KB) that hardcodes every menu array inline.

`/home/kimsanghoon/process-gpt-vue3/src/layouts/full/vertical-sidebar/VerticalSidebar.vue`

- **Mounted in** `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/FullLayout.vue:71` (and `:145`) — always `&lt;VerticalSidebarVue&gt;`, there is no separate PAL sidebar component.
- **Local state** `:539-568` — `sidebarItem`, `instanceItem`, `organizationItem`, `definitionItem`, `processItem`, `processSectionListItems`, `processSectionDropdownItems`, `analyticsItem`.
- **Builder** `loadSidebar(isAdmin)` `:703-958`, called from `mounted()` `:601-624` and re-called on a `localStorageChange` event for `isAdmin` (`:611-619`).

### There is **no** `sidebarItem.ts`
`sidebarItem` is declared `[]` at `:540`, rendered at `:87-95` (`NavGroup`/`NavCollapse`/`NavItem`) — and **never assigned anywhere in the repo**. That whole top loop is dead code. The real menu is a series of hand-written `&lt;div v-if="..."&gt;` blocks in the template.

### Item shape (informal, per-array, not typed)
```js
{ title: 'i18n.key' | '한글 리터럴', icon: 'iconKey', BgColor: 'primary',
  to: '/path', disable: false, type?: 'rule'|'external', size?: 20,
  header?: 'i18n.key', children?: [...] }
```
The only formal interface is for the *horizontal* layout: `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/horizontal-sidebar/horizontalItems.ts:3-20` (`interface menu`), with a hardcoded 600-line array at `:22-621`. The header has its own separate hardcoded list: `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/vertical-header/VerticalHeader.vue:49-110` (`interface SidebarItem` + `sidebarItems` ref).

### Hardcoded per mode — yes, thoroughly
Everything branches on `window.$pal` / `window.$mode` / `window.$jms` / `window.$gs` at both template and script level:

| Section | Location | Gate |
|---|---|---|
| ChatList | `:125` | `!gs &amp;&amp; !pal` |
| Instances | `:128-144` | `isShowInstances` (`:586-591` = `!pal &amp;&amp; !JMS`) |
| Agents | `:147-178` | `mode !== 'uEngine' &amp;&amp; isAdmin &amp;&amp; !pal` |
| Users | `:181-193` | `mode !== 'uEngine' &amp;&amp; !gs &amp;&amp; !pal` |
| Skills | `:196-212` | `mode !== 'uEngine' &amp;&amp; !gs &amp;&amp; isAdmin &amp;&amp; !pal` |
| PAL notifications | `:216-220` | `pal` |
| PAL 프로세스 관리 | `:223-243` | `pal &amp;&amp; processItem.length &gt; 0` |
| PAL 조직관리 (labels `조직도`, `권한 변경 신청` inline in template) | `:246-266` | `pal` |
| 정의관리 | `:269-379` | `isAdmin &amp;&amp; !pal` |
| 분석 | `:382-402` | `analyticsItem.length &gt; 0 &amp;&amp; !gs` |
| **관리자 (PAL)** | `:404-436` | `pal &amp;&amp; isAdmin` |

The PAL 관리자 section is the worst case — a **14-item array literal written inline in the template's `v-for`** (`:408-423`), with raw Korean labels and no i18n:

```
{ title: '속성 스키마', icon: 'formList', to: '/admin-console/property-schemas' },
{ title: '목록 관리', ... }, { title: '수정 잠금', ... }, { title: '휴지통', ... },
{ title: '시스템 운영', ... }, { title: '보안 설정', ... }, { title: 'KPI 목표', ... },
{ title: '사용 활성도', ... }, { title: '감사 로그', ... }, { title: 'PI Flag', ... },
{ title: 'Task 종류 설정', ... }, { title: '카탈로그', ... },
{ title: '업무분장', ... }, { title: '사내 정책문서', ... }
```

Other mode-specific builders: `definitionItem` `:707-772` (filtered for `ProcessGPT` at `:756-764`, for `pal` at `:765-772`), `processItem` `:801-842` (PAL gets `프로세스 목록` + `용어 사전`, non-PAL gets `reviewBoard.myInbox`), `analyticsItem` `:862-933` **entirely replaced** for PAL by a single item at `:936-946`.

---

## 2. "권한별 메뉴/기능관리" screen — **does not exist**

There is a *designed and partially built* menu-permission system, but **the admin UI was never created**.

### The single source of truth that was intended
`/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts`

- `:25-50` — `interface MenuDefinition { path, label, section, icon, requiredRole, minRole?, hiddenInSidebar?, action?, excludeFromMatrix? }`
- `:61-338` — `MENU_DEFINITIONS` array (~30 entries), sections typed at `:13` (`process | analytics | admin | notice | request`), section labels at `:16-22`.
- `:344-354` — derived `ROUTE_REQUIRED_ROLES`, `ROUTE_MIN_ROLES`; `:377-384` — `ROUTE_LABELS` / `lookupMenuLabel`.
- `:398-409` — `lookupRequiredRole(path)`: **DB override → code default → null**, clamped by `minRole`.

The file header `:1-8` claims:
&gt; "VerticalSidebar.vue, RoleMenuMatrix.vue, 라우터 가드 모두 이 모듈에서 import."

**All three claims are false.** Actual importers (verified by grep across `src/`):
- `/home/kimsanghoon/process-gpt-vue3/src/utils/customPermissions.ts:4`
- `/home/kimsanghoon/process-gpt-vue3/src/views/admin/AdminConsoleLayout.vue:23`
- `/home/kimsanghoon/process-gpt-vue3/src/services/activityAuditLog.ts:3` (labels only)

`RoleMenuMatrix.vue` **does not exist anywhere in the repo** — the name appears only in the comment above, in `supabase/migrations/20260521_menu_role_overrides.sql:11`, and in `specs/005-prompt-archive/prompt-history.md:1016-1020` (which already flagged this exact discrepancy).

### Storage table: `menu_role_overrides`
`/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260521_menu_role_overrides.sql:18-32`
```sql
CREATE TABLE public.menu_role_overrides (
    id uuid PK, name text, menu_path text, required_role text,
    tenant_id text, updated_at timestamptz, updated_by uuid,
    UNIQUE (tenant_id, menu_path),
    CHECK (required_role IN ('admin','owner','editor','reviewer','viewer')))
```
Sparse override — only rows that deviate from code defaults; delete-to-reset (`:6-8`). RLS: authenticated read, admin-only write (`:58-79`).

Client cache: `/home/kimsanghoon/process-gpt-vue3/src/utils/menuRoleOverrides.ts` — `loadMenuRoleOverrides()` `:37-70` (tenant-scoped fetch into a `Map&lt;menu_path, row&gt;`), `getMenuOverrideRole()` `:78-80`, `getAllMenuOverrides()` `:83-85` (comment says "매트릭스 UI 등에서 일괄 조회용" — **zero callers**). Loaded once per auth change at `/home/kimsanghoon/process-gpt-vue3/src/utils/authClaims.ts:286`.

### Other permission tables
- `permissions` (custom action catalog: `id, name, label, api_path, verb`) read at `/home/kimsanghoon/process-gpt-vue3/src/utils/customPermissions.ts:34`; per-user grants in `users.permission_ids` jsonb (`:47-52`). **No CRUD UI** — `getPermissionCatalog()` `:92-94` ("관리자 UI 의 정책 CRUD 화면용") has no callers.
- Role catalog: `/home/kimsanghoon/process-gpt-vue3/src/utils/roles.ts:13-77` — `ROLES`, `ROLE_HIERARCHY`, `ROLE_META`, `ROLE_LEVEL` (all hardcoded constants).
- Role *assignment* UI exists: `/home/kimsanghoon/process-gpt-vue3/src/views/organization/MembershipApprovalPanel.vue` (approve 가입/권한 신청, `:19` role picker) and `/home/kimsanghoon/process-gpt-vue3/src/views/organization/RoleRequestPage.vue`. `/admin-console/admin-requests` and `/admin-console/signup-approvals` are just redirects to `/organization?approvals=1` (`/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts:105-111`).

---

## 3. Per-tenant menu visibility / order / label — **none**

No table, no column, no UI. Searched for `menu_permission`, `role_menu`, `menu_role`, `menu_config`, `menu_items`, `tenant_menu`, `menu_settings` — only `menu_role_overrides` (role threshold only, no visibility/order/label).

**Tenant settings storage that *does* exist** (the natural home for menu config, currently unused for it):

- `public.tenants` — `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260101_base_schema.sql:60-66`. Only `id, owner, is_deleted, deleted_at, mcp`. **No settings/branding/menu columns.** Never queried from `src/` (`from('tenants')` → 0 hits).
- `public.configuration` — the actual tenant KV settings table, `UNIQUE (tenant_id, key)`, admin-only write. Established keys: `organization`, `proc_map`, `pi_flag_types`, `session_timeout` (`/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260911000010_tenant_session_timeout.sql:1-10`), `mfa_policy` (`/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260911000005_mfa_policy.sql:1-16`), dashboard tabs (`/home/kimsanghoon/process-gpt-vue3/src/services/dashboardSettingsService.ts:181-222`). The MFA migration explicitly documents the pattern: *"값은 public.tenants 에 컬럼을 더하지 않고 … public.configuration 에 한 행으로 둔다."* **No `menu` / `sidebar` key exists.**
- Closest existing precedent for tenant-editable ordered lists: `option_list` — `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260914000001_option_lists.sql:21-45` (`tenant_id`, `list_key`, `name`, `items jsonb` as *ordered* `[{value,label}]`, `is_active`), with UI `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/OptionListManagement.vue`. This is the shape a menu-config table should copy.

There is an open spec for exactly this gap: `/home/kimsanghoon/process-gpt-vue3/specs/009-tenant-admin-customization/prompt-history.md:9` — "도메인 수정/삭제, 미분류 도메인, **메뉴 목록 설정** 등" — with `spec.md` still an unfilled template.

---

## 4. PAL mode detection

`/home/kimsanghoon/process-gpt-vue3/src/palMode.ts:3-11` — build-time or runtime flag, frozen onto `window.$pal`:
```ts
const runtimePalMode = (window as any)._env_?.VITE_PAL_MODE;
const buildPalMode = import.meta.env.VITE_PAL_MODE;
const enabled = runtimePalMode === true || runtimePalMode === 'true' || buildPalMode === 'true';
Object.defineProperty(window, '$pal', { value: enabled, writable: false, configurable: false });
```
Declared at `/home/kimsanghoon/process-gpt-vue3/src/main.ts:211`; env sample `/home/kimsanghoon/process-gpt-vue3/.env.example:3`. **Process/deploy-level, not per-tenant** — a single tenant cannot flip it.

Consumers read it directly as a computed: `VerticalSidebar.vue:580-582` (`pal()`), `FullLayout.vue:39`, `ExtraBox.vue:56-58`, `AdminConsoleLayout.vue:27`, `VerticalHeader.vue:89,103,117`, router guard `/home/kimsanghoon/process-gpt-vue3/src/router/index.ts:168,181`, route components `MainRoutes.ts:97,118,201,453,693`.

### Menu differences in PAL
Additionally, **`isAdmin` resolves differently**: `VerticalSidebar.vue:595-599`
```js
isAdmin() {
    if (this.pal) return getIsAdminClaim();          // JWT/DB claim
    const isAdmin = localStorage.getItem('isAdmin') == 'true';   // localStorage
    return isAdmin;
}
```
PAL hides: chat list, instance list, agent list, user list, skill list, 정의관리 + 정의 목록, header (`FullLayout.vue:72`), `/admin` link (`VerticalHeader.vue:103,117-118`), `strategy-board` (`VerticalHeader.vue:89`).
PAL adds: NotificationSidebarMenu, 조직관리 block, the 14-item 관리자 block, replaces 분석 with one `/analysis-dashboard` item.

---

## 5. Where admin-only screens are gated

**One place only:** `/home/kimsanghoon/process-gpt-vue3/src/views/admin/AdminConsoleLayout.vue:31-38`
```ts
const canEnter = computed(() =&gt; {
    if (canEnterAdminConsole()) return true;                  // isAdmin || adminViewer
    return canAccess({ apiPath: route.path, verb: 'GET' });    // custom permission fallback
});
```
- `canEnterAdminConsole()` — `/home/kimsanghoon/process-gpt-vue3/src/utils/authClaims.ts:324-326`
- `canAccess()` — `/home/kimsanghoon/process-gpt-vue3/src/utils/customPermissions.ts:129-143`; `:132` is the **only** production path where `menu_role_overrides` actually influences behaviour.
- `hasRoleAtLeast` / `resolveRole` — `/home/kimsanghoon/process-gpt-vue3/src/utils/roles.ts`
- Denied users see `/home/kimsanghoon/process-gpt-vue3/src/views/authentication/NoAccessView.vue` (only usage in the repo).

**The global router guard does no role checking at all.** `/home/kimsanghoon/process-gpt-vue3/src/router/index.ts:142-237` runs only: membership approval (`membershipRedirect`), PAL maintenance (`evaluateMaintenanceGate`, `:168-176`), MFA (`evaluateMfaGate`, `:192-198`), tenant-server routing (`:200-229`) — then `next()`. No route `meta.requiredRole` exists in `MainRoutes.ts` (only `adminTitle`/`adminDescription`, e.g. `:516-534`).

Other gates: `/home/kimsanghoon/process-gpt-vue3/src/utils/maintenanceGate.ts:92` (`hasRole(ROLES.ADMIN)`), `/home/kimsanghoon/process-gpt-vue3/src/utils/membershipGate.ts:6`, `/home/kimsanghoon/process-gpt-vue3/src/utils/execFeatureGate.ts:31`.

---

## Concrete gaps — what a tenant admin currently CANNOT do

1. **Show/hide any sidebar menu item.** Visibility is `v-if` on build-time flags (`$pal`, `$mode`, `$gs`, `$jms`) plus a binary `isAdmin`. `MenuDefinition.hiddenInSidebar` exists (`routePermissions.ts:45`) but the sidebar never reads it. To hide a menu today you edit `VerticalSidebar.vue` and redeploy.
2. **Reorder menus or sections.** Order == literal array order in `VerticalSidebar.vue` (e.g. `:408-423`) and `v-if` block order in the template (`:125-436`). No `order`/`sort` column anywhere; `menu_role_overrides` has no such field.
3. **Rename a menu label.** Non-PAL items use i18n keys (`$t(item.title)`); PAL items use hardcoded Korean literals (`:409-422`, `:247`, `:258`, `:263`, `:819`, `:826`, `:871`, `:939`). No per-tenant label override — `menu_role_overrides.name` is documented as display-only ("UI 표시·관리 편의", migration `:36`) and is never rendered.
4. **Change which role sees which menu, from the UI.** The DB table + cache + `lookupRequiredRole` chain is complete, but `RoleMenuMatrix.vue` was never written, so the only way to insert a row is raw SQL. And even then it would not affect the sidebar — `VerticalSidebar.vue` imports only `getIsAdminClaim` (`:479`), never `canAccess`/`lookupRequiredRole`. So an override on e.g. `/admin-console/kpi-targets` opens the *page* but the *menu item* stays admin-only.
5. **Grant granular action permissions.** `permissions` catalog + `users.permission_ids` are read-only from the client; `getPermissionCatalog()` (`customPermissions.ts:92`) has no consumer — no screen to create a permission or assign one to a user.
6. **Add a custom menu item** (e.g. a link to an internal wiki). The only externalizable shape is `MenuDefinition.action` (`routePermissions.ts:46`, used once for `openNoticeConfluencePage` at `:325`) — and that handler isn't wired into the sidebar either.
7. **Enable/disable PAL mode or per-tenant feature flags.** `window.$pal` is frozen non-writable at boot from env (`palMode.ts:7-11`); it's per-deployment, so two tenants on one deployment cannot differ. `docs/feature-flag-analysis.md:43,470` proposes reusing the `menu_role_overrides` pattern + a `configuration` `feature_flags` key — not implemented.
8. **Non-PAL mode has even less.** `isAdmin` in non-PAL reads `localStorage.getItem('isAdmin')` (`:597`) — a boolean, so the 5-level role hierarchy is entirely unused for menu decisions outside PAL, and it's client-mutable.
9. **Three independent menu sources drift.** `VerticalSidebar.vue` (inline), `VerticalHeader.vue:61-110`, and `horizontalItems.ts:22-621` each hardcode their own list; `MENU_DEFINITIONS` is a fourth that none of them use. Any tenant-customization feature must first collapse these, or a tenant hiding a menu in one place will still see it in another.</result>
<usage><subagent_tokens>98866</subagent_tokens><tool_uses>55</tool_uses><duration_ms>243046</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-28T02:40:16+00:00

```text
<task-notification>
<task-id>aabb0908caf7b54ea</task-id>
<tool-use-id>toolu_01Ap9KjvdZvddm3QpqEiFUWD</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/49f9096d-2df4-4b1e-84f9-16ce235e27e8/tasks/aabb0908caf7b54ea.output</output-file>
<status>completed</status>
<summary>Agent "Explore domain management code" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Here's the full picture.

---

# 프로세스 체계도 — 도메인(Domain) 관리 현황

## 1. 도메인은 어디서 오는가

**저장소: `configuration` 테이블, `key = 'metrics'`, `tenant_id = &lt;tenant&gt;` 의 JSONB `value.domains` 배열.** 전용 테이블은 없습니다.

- 스키마 형태: `{ domains: [{id, name, color, order}], mega_processes: [], processes: [] }`
- 읽기: `ProcessGPTBackend.getMetricsMap()` — `/home/kimsanghoon/process-gpt-vue3/src/components/api/ProcessGPTBackend.ts:2029-2051` (없으면 `{domains:[],...}` 기본 반환)
- 쓰기: `ProcessGPTBackend.putMetricsMap()` — 같은 파일 `:2001-2023` (`upsert onConflict: 'key,tenant_id'`, **전체 value 덮어쓰기**)
- 인터페이스 선언: `/home/kimsanghoon/process-gpt-vue3/src/components/api/Backend.ts:69-70`
- 마이그레이션이 이를 명시: `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260515_audit_policy_domains.sql:3-4` — *"도메인 마스터는 configuration.metrics.domains 에서 관리"*

계층(mega/major/sub)은 **별도 행** `configuration.key='proc_map'` 입니다 (`ProcessGPTBackend.ts:1908-1995`). 도메인↔계층 연결은 **major 노드의 문자열 필드**(`domain` / `domain_id` / `business_domain` / `network_domain`)로만 이루어집니다.

### 화면에서 쓰는 도메인 목록 = metrics ∪ proc_map 추론

`/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/useProcessArchitecture.ts:671-675`
```ts
const domains = computed(() =&gt; {
    const fromMetrics = Array.isArray(metricsMap.value?.domains) ? metricsMap.value.domains : [];
    const fromProcMap = deriveDomainsFromProcMap(procMap.value);
    return sortDomains(mergeDomainLists(fromMetrics, fromProcMap));
});
```
- `deriveDomainsFromProcMap` (`:248-288`) — major의 domain 필드/ID 코드 패턴에서 도메인을 **추론해 가짜 도메인 항목을 만들어냄**. (metrics에 없어도 칩이 생김)
- **하드코딩 시드/정렬 순서**: `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/useProcessArchitecture.ts:16-28`
  ```ts
  export const DOMAIN_SORT_ORDER = ['Access', 'Core', 'IP', '유선', '설비', '공통'];
  export const DEFAULT_SELECTED_DOMAINS = [...DOMAIN_SORT_ORDER];
  ```
  → 이 6개는 `deriveDomainsFromProcMap:252`에서 `knownDomainSeed`로도 쓰여 텍스트 매칭에 동원됩니다. 특정 고객사(통신사) 전용 값이 코드에 박혀 있고, 그 외 도메인은 `getDomainSortIndex`가 전부 같은 index(=6)를 반환해 **정렬 순서가 사실상 입력 순서**가 됩니다. `domains[].order` 필드는 저장만 하고 **어디서도 정렬에 쓰이지 않습니다**.
- 도메인↔major 매칭 로직: `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/processClassification.ts:200-236` (`getMajorBusinessDomain`, `majorMatchesDomain`) — 이름/ID 문자열 비교 + 추론.

### 파생 저장: `proc_def` 컬럼
`/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260428_proc_def_hierarchy_columns.sql:3-6` 가 `proc_def`에 `domain_id / mega_process_id / major_process_id` 컬럼을 추가하고, proc_map+metrics로부터 백필합니다. 런타임 동기화는 `PalModeBackend.syncProcessDefinitionHierarchyFromMap` / `syncAllProcessDefinitionHierarchyFromMap` (`/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts:539-605`)에서 수행 — 이 두 메서드는 **PalModeBackend에만 존재**합니다.

### 스토어
전용 Pinia 스토어 없음. `useProcessArchitecture()` 컴포저블의 `metricsMap` ref(`useProcessArchitecture.ts:399`, 로드 `:515-528`)가 사실상의 스토어입니다. 다른 화면은 각자 `backend.getMetricsMap()`을 직접 호출합니다(아래 §4).

---

## 2. 도메인 생성/수정/삭제 UI

두 개의 화면이 공존하며 **기능 차이가 큽니다.**

### (A) 현행 화면 — `/process-architecture` "프로세스 체계도"
`/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue` (사이드바 메뉴 `processArchitecture.title`, `VerticalSidebar.vue:801-808`; 라우트 `MainRoutes.ts:444-448`; 권한 `routePermissions.ts:63-69` requiredRole `reviewer`)

**추가(Add)만 존재:**
- 칩 버튼: `:264-276` — `v-if="isAdmin &amp;&amp; isPalMode"` (편집 모드와 무관하게 표시)
- 다이얼로그: `:450-490` (이름 + 12색 팔레트)
- 상태/색상표: `:767-785` (`domainAddDialog`, `domainColors`)
- `openDomainAddDialog()` `:787-789`
- `saveDomainAdd()` `:791-829` — 중복 이름 체크 → `id = name.toLowerCase().replace(/[/.]/g,'_')` → `order = length+1` → `saveMetricsMap(updated)` → 감사 로그 `action: 'process_domain_create'`

**수정/삭제 UI 없음.** Tree/Hierarchy/Matrix/Card 뷰 어디에도 `type === 'domain'` 행에 대한 편집 아이콘이 없습니다 — 편집/추가 아이콘은 `mega`/`major`만 대상입니다:
- `ProcessArchTreeView.vue:104-133` (`row.type === 'mega' || row.type === 'major'`)
- `ProcessArchHierarchyView.vue:85-86, 120`
- `ProcessArchMatrixView.vue:34, 41, 86`
- `ProcessArchCardView.vue:108`

편집 다이얼로그(`ProcessArchitecture.vue:500-554`, 로직 `:1192-1420`)는 mega 이름 변경 / major 이름·도메인·소속메가 변경만 지원합니다 (`editProcessDialog.type: 'mega' | 'major'` — `:1196`).

**편집 모드(isEditMode)**: `enterEditMode()/exitEditMode()` `:662-676` — 전역 편집 락 획득. 뷰들은 `:readonly="!isEditMode"` (`:357, 380, 397, 413`)로 연결됩니다. 단 도메인 추가 칩은 이 게이트를 **타지 않습니다**.

**재구성 모드(ProcessArchRestructureStudio)**: `ProcessArchitecture.vue:10-21` (`v-if="isAdmin"`), 컴포넌트 `:110-120`. 작업 목록은 `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchRestructureStudio.vue:360-366`:
```ts
const operationOptions = [
    { value: 'rename-mega', ...}, { value: 'move-major', ...}, { value: 'add-major', ...},
    { value: 'delete-major', ...}, { value: 'delete-mega', ...}
];
```
→ **도메인 레벨 작업 없음.** 도메인은 `add-major` 시 `newMajorDomain` 드롭다운(`:107-110`, `:398-402`)으로 major에 문자열 태깅될 뿐이고, 저장 시 `domain`/`domain_id`에 이름을 씁니다(`:753-754`).

### (B) 레거시 화면 — `/definition-map` "정의 체계도"
`/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/ProcessDefinitionMap.vue` (라우트 `MainRoutes.ts:159-164`; 헤더/로고 링크만 남아 있음 — `VerticalHeader.vue:65`, `LogoDark.vue:3`)

**여기에는 전체 CRUD가 있습니다** (단 `enableEdit`=체크아웃 락 획득 상태에서만, 그리고 `isPalMode`가 아니면 `display:none` — `:257-261`):
- 도메인 칩 + 편집/삭제 아이콘: `:329-372` (`v-if="enableEdit &amp;&amp; selectedDomain === domain.name"`)
- 추가 버튼: `:375-385`
- `openDomainDialog / editDomain / deleteDomain / saveDomain`: `:2368-2428`
- 다이얼로그: `:414-468`

`MetricsView.vue`(매트릭스 뷰)에도 동일한 CRUD가 있습니다: `/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/MetricsView.vue:57-60, 134-136, 522-557`.

---

## 3. "미분류" 처리

**하드코딩 문자열이며, 구현이 3갈래로 갈려 있습니다.**

**(a) 판별 유틸** — `/home/kimsanghoon/process-gpt-vue3/src/utils/uncategorizedProcess.js:11-12`
```js
const UNCATEGORIZED_NAMES = ['미분류', 'uncategorized'];
const UNCATEGORIZED_IDS = ['uncategorized', 'uncategorized_major'];
```
주석(`:4-7`)이 명시: *"미분류 Mega/Major 는 DB 에 저장된 실제 노드가 아니라 … 로드 시점에 매번 새로 만들어내는 임시 노드다. 따라서 이름 수정 등 편집 동작을 허용하면 안 된다."*

**(b) 레거시 화면 — 임시 노드 생성/제거**
- 생성: `ProcessDefinitionMap.vue:2150-2241` `updateUncategorizedProcesses()` — 모든 `proc_def`를 읽어 proc_map에 없는 것을 `{id:'uncategorized', name:'미분류'}` Mega / `{id:'uncategorized_major'}` Major 아래로 모읍니다. 미등록 프로세스가 0개면 미분류 Mega를 제거(`:2230-2237`).
- 저장 시 제거: `:2549-2554` `saveProcess()` 첫 줄에서 미분류 Mega를 필터로 걷어낸 뒤 저장.
- **미분류에서 빼내기 = 가능**: "미분류 프로세스 관리" 다이얼로그(`:107-118, 181-187, 612-766`) → `assignProcessesToCategory()` `:2804-2855`가 선택 프로세스를 미분류 Major에서 제거하고 타깃 Major의 `sub_proc_list`로 push. 대상 Mega/Major를 즉석 생성하는 `createNewMega/createNewMajor`(`:2749-2799`)도 있음. 대상 목록에서 미분류는 제외(`megaProcessOptions:990-1001`).

**(c) 모순점 — 미분류가 "진짜" 도메인으로 DB에 박힘**
위 (a)의 "저장 안 함" 원칙과 달리, 두 곳이 `configuration.metrics.domains`에 `미분류`를 **영속화**합니다:
- `ProcessDefinitionMap.vue:1348-1373` `ensureUncategorizedDomainTab()` — 로드 시 `{id:'uncategorized', name:'미분류', order:0}`를 `domains.unshift()` 후 `putMetricsMap()` 호출
- `ProcessDefinitionMap.vue:1622-1637` `syncCardToMetrics()` — 동일 항목을 `domains.push()`

→ 결과적으로 레거시 화면을 한 번이라도 연 테넌트는 `미분류`가 실제 도메인 row가 되어, 레거시 화면에서 **이름 변경도 삭제도 가능**해집니다(가드 없음 — `deleteDomain:2380-2390`, `saveDomain:2414-2423` 어디에도 `isUncategorizedProcess` 체크가 없음). `uncategorizedProcess.js`는 **도메인 CRUD 경로에서 전혀 호출되지 않습니다**.

**(d) 현행 화면 — 미분류는 순수 표시용 가상 노드**
- `ProcessArchHierarchyView.vue:285-291`
  ```ts
  const UNASSIGNED_DOMAIN_ID = '__unassigned__';
  const unassignedDomain = { id: UNASSIGNED_DOMAIN_ID, name: '미분류', color: '#898781' };
  ```
- `ProcessArchTreeView.vue:441-492` — 알려진 도메인에 매칭되지 않는 major를 모아 `id:'unassigned', name:'미분류'` 행을 렌더. 저장되지 않으며 클릭해도 편집 불가.
- **미분류에서 빼내는 방법**: (1) major 편집 다이얼로그에서 도메인 선택(`ProcessArchitecture.vue:520-531`), (2) `/process-hierarchy` 속성 패널의 Parent 변경(`ProcessHierarchyProperties.vue:326-363`, `confirmParentChange():8387-8467`)으로 sub를 다른 major로 이동. 현행 화면에는 레거시의 "미분류 프로세스 일괄 관리" 다이얼로그에 해당하는 기능이 **없습니다**.

**(e) 도메인 삭제 시 프로세스는 어떻게 되나** (레거시 경로만 존재)
`ProcessDefinitionMap.vue:2380-2390`:
```js
this.metricsValue.domains = this.metricsValue.domains.filter((d) =&gt; d.id !== domain.id);
this.metricsValue.processes = this.metricsValue.processes.filter((p) =&gt; p.domain_id !== domain.id);
await backend.putMetricsMap(this.metricsValue);
```
`MetricsView.vue:550-557`도 동일. → **metrics 쪽 미러만 지우고 `proc_map`은 건드리지 않습니다.** major의 `domain`/`domain_id` 문자열은 삭제된 이름을 그대로 들고 남습니다. 확인 절차는 `confirm()` 한 줄뿐이고, 영향 받는 프로세스 수를 보여주지 않으며, 되돌리기/감사로그도 없습니다. 삭제 후 현행 화면에서는 `deriveDomainsFromProcMap`이 그 dangling 이름으로 **도메인 칩을 다시 만들어냅니다** — 즉 삭제가 화면상 되돌아옵니다.

---

## 4. 도메인을 읽고/쓰는 백엔드·API

**쓰기 (단 2개 경로, 둘 다 `putMetricsMap`)**
| 호출처 | 라인 | 동작 |
|---|---|---|
| `ProcessArchitecture.vue` → `saveMetricsMap` | `:816` → `useProcessArchitecture.ts:1406-1414` | 도메인 추가 |
| `ProcessDefinitionMap.vue` | `:1368, 1701, 2359, 2388, 2426, 2458` | 미분류 탭 영속화 / sync / 추가·수정·삭제 / 색상 변경 |
| `MetricsView.vue` → `@update:value` | `:555` 등 → `ProcessDefinitionMap.vue:2356-2360` | 매트릭스 뷰 CRUD |

**읽기 (`getMetricsMap()` 호출처 — 도메인 이름/색상을 이 배열에서 조회)**
- `useProcessArchitecture.ts:518`
- `stores/analytics/kpiStore.ts:106, 116-120` (KPI `domain_targets`, `domain_id` 조인)
- `stores/analytics/analysisDashboardStore.ts:116`
- `views/admin/tabs/DataFreezeManager.vue:202` (+ `utils/dataFreeze.ts:43-110` `resolveDomainContext` — freeze scope `'domain'`, `:220`)
- `views/admin/tabs/PiFlagBoard.vue:629`
- `views/review-board/ProcessReviewBoard.vue:825`, `MyInbox.vue:264`, `ProcessReviewDetail.vue:469`
- `views/process-hierarchy/ProcessHierarchy.vue:2417`, `VersionComparison.vue:477`, `ProcessHierarchyProperties.vue:5442-5446`
- `views/analytics/Dashboard.vue:323`
- `views/policy-document/PolicyDocumentManager.vue:92-126` (`audit_policy.domains TEXT[]`가 domain **id**를 저장)
- `components/ProcessDefinitionChatWithTree.vue:197`

**계층/proc_map 쓰기**
- `getProcessDefinitionMap()` / `putProcessDefinitionMap()` — `ProcessGPTBackend.ts:1908-1995`
- `saveProcMap()` — `useProcessArchitecture.ts:1385-1403` (저장 후 `syncAllProcessDefinitionHierarchyFromMap` 호출)
- `NewProcessDialog.updateProcMap()` — `NewProcessDialog.vue:1373-1404`
- RPC `public.sync_proc_map_name(p_proc_def_id, p_new_name)` — `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260612_sync_proc_map_name_rpc.sql` (SECURITY DEFINER, editor+). **이름 동기화 전용이며 도메인용 RPC는 없음.**

**RLS**
- `configuration_select_all` — SELECT 전체 허용
- `configuration_modify_admin` — `has_role_at_least('admin')`, 모든 key (`20260403000001_role_based_rls.sql:162-176`)
- `configuration_modify_proc_map_owner` — `key='proc_map'` 한정 owner+ (`20260622_proc_map_owner_write.sql:29-32`)
- → **`key='metrics'`(=도메인 마스터) 쓰기는 admin+ 전용.** owner는 계층은 고칠 수 있어도 도메인은 못 만듭니다. 마이그레이션 주석(`:15-17`)도 *"체계도의 이름 변경/삭제는 프론트엔드에서 여전히 admin 전용"*이라고 인정.

**감사 로그**: 생성만 기록 — `ProcessArchitecture.vue:818-824` → `AuditTrail.vue:1069` `process_domain_create: '도메인 추가'`. `process_domain_update` / `process_domain_delete`는 **존재하지 않음**.

---

## 5. PAL 모드 게이팅

| 위치 | 조건 |
|---|---|
| `ProcessArchitecture.vue:689` | `const isPalMode = computed(() =&gt; !!window.$pal)` |
| `ProcessArchitecture.vue:266` | 도메인 추가 칩 = `v-if="isAdmin &amp;&amp; isPalMode"` — **PAL 아니면 도메인을 아예 만들 수 없음** |
| `ProcessDefinitionMap.vue:945, 260` | 도메인 필터/CRUD 전체 영역 `:style="isPalMode ? undefined : {display:'none'}"` |
| `BackendFactory.ts:117-126` | `window.$pal` → `PalModeBackend`(ProcessGPTBackend 상속, `PalModeBackend.ts:10`) |
| `PalModeBackend.ts:539-605` | `processHierarchyContext` / `syncProcessDefinitionHierarchy(FromMap)` — **PAL 전용**. 비PAL에서는 `BackendFactory.wrapBackendWithNullSkip`이 no-op 처리 → `proc_def.domain_id` 동기화가 안 됨 |
| `ProcessGPTBackend.ts:1910, 1960, 1971` | `const isPal = window.$pal` — `putProcessDefinitionMap`에서 `role !== 'superAdmin' &amp;&amp; isPal`일 때만 권한 기반 merge |
| `ProcessArchitecture.vue:12, 111` | 재구성 모드 = `isAdmin` (PAL 무관) |
| `MainRoutes.ts:453-460` | `/process-hierarchy/process_management` 등 PAL 전용 라우트 |

---

## 6. 결론 — 되는 것 / 안 되는 것

| 기능 | 현행 `/process-architecture` | 레거시 `/definition-map` |
|---|---|---|
| 도메인 **생성** | ✅ `saveDomainAdd` (`ProcessArchitecture.vue:791`) — **admin + PAL 모드**만 | ✅ `saveDomain('add')` (`:2395-2413`) — enableEdit(락) + PAL |
| 도메인 **이름 변경** | ❌ UI 없음 | ✅ `saveDomain('edit')` (`:2414-2423`) — **단 proc_map의 major.domain 문자열로 cascade 안 됨 → 전 프로세스가 도메인에서 떨어짐** |
| 도메인 **삭제** | ❌ UI 없음 | ✅ `deleteDomain` (`:2380-2390`) — metrics만 지움, proc_map dangling, 영향도 미표시, 감사로그 없음, 현행 화면에서 추론으로 부활 |
| 도메인 **색상 변경** | 생성 시에만 (`domainColors:772-785`) | ✅ `updateDomainColor` (`:2455-2459`) |
| 도메인 **순서 변경** | ❌ `DOMAIN_SORT_ORDER` 하드코딩(`useProcessArchitecture.ts:16`). `order` 필드는 저장만 되고 미사용 | ❌ |
| 프로세스를 **미분류에서 꺼내기** | △ major 단위 도메인 재지정(`:520-531`) 또는 Parent 변경(`ProcessHierarchyProperties.vue:8387`). 일괄 관리 UI 없음 | ✅ 미분류 관리 다이얼로그 + `assignProcessesToCategory` (`:2804-2855`) |
| 프로세스를 **미분류로 되돌리기** | ❌ 도메인 v-select에 `clearable` 없음(`:520-531`) → 한 번 지정하면 해제 불가 | △ |
| **테넌트 admin 권한** | metrics 쓰기는 RLS상 `admin+`. owner는 proc_map만 가능 → **owner는 도메인 생성 불가** | 동일 |

### 핵심 갭 3가지
1. **현행 화면에 rename/delete/reorder가 전혀 없음.** 오탈자 하나 고치려면 레거시 `/definition-map`(사이드바에서 빠져 헤더/로고 링크로만 접근)으로 가야 하고, 거기서 고쳐도 `proc_map`에 cascade되지 않아 도메인이 비어버립니다. 도메인 rename은 `metrics.domains[].name`과 `proc_map` 전 major의 `domain`/`domain_id` **양쪽을 동시에** 고치는 트랜잭션이 필요한데 그런 코드가 없습니다(`grep '\.domain = '` 결과 — `processMapMove.ts:173-174`의 stage 정규화가 유일).
2. **'미분류'가 시스템 예약어인지 실제 도메인인지 불명확.** `uncategorizedProcess.js`는 "임시 노드, 편집 금지"라고 선언하지만, `ensureUncategorizedDomainTab()`(`ProcessDefinitionMap.vue:1348-1372`)가 그걸 DB에 영속화하고, 어떤 CRUD 경로도 `isUncategorizedProcess()`를 호출하지 않아 미분류 도메인을 지우거나 이름을 바꿀 수 있습니다.
3. **도메인 id 참조자가 많은데 참조 무결성이 없음.** `kpi_targets.domain_targets[].domain_id`, `audit_policy.domains TEXT[]`, `proc_def.domain_id`, data-freeze scope `'domain'` — 전부 `configuration.metrics.domains[].id`를 문자열로 참조합니다. 삭제/rename 시 이들을 정리하거나 경고하는 코드가 없고, id는 `name.toLowerCase().replace(/[/.]/g,'_')`로 **이름에서 파생**되므로 rename 시 id는 그대로 남아 이름과 어긋납니다.</result>
<usage><subagent_tokens>143919</subagent_tokens><tool_uses>83</tool_uses><duration_ms>345005</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-28T02:59:33+00:00

```text
<task-notification>
<task-id>a7d016482c62fe7cc</task-id>
<tool-use-id>toolu_01849XNDjzF9DbRw4yFZNRHC</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/49f9096d-2df4-4b1e-84f9-16ce235e27e8/tasks/a7d016482c62fe7cc.output</output-file>
<status>completed</status>
<summary>Agent "Implement menu settings feature" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Report — F3 메뉴 목록 설정 implementation complete.

**Files created:**
- `src/services/menuSettingsService.ts` — tenant KV service on `configuration` key=`menu_settings` (same pattern as dashboardSettingsService: select/update by uuid or insert). Exports `loadMenuSettings()`, `saveMenuSettings()`, module cache + `getMenuSetting(path)` / `getCachedMenuSettings()` for synchronous reads. Storage shape finalized as `{ items: { [menuPath]: { hidden?: true, label?: string, order?: number } } }` — default-valued fields are stripped on normalize so only real overrides persist.
- `src/views/admin/tabs/MenuSettingsManager.vue` — admin screen styled after OptionListManagement (sk-page-card, same form/button idioms, audit logging via `useAdminConsoleStore().writeAdminAuditLog`). Sections from `SECTION_LABELS`, rows from `MENU_DEFINITIONS` (skips `excludeFromMatrix` and path-less entries). Columns: 순서 (up/down; on reorder every row in the section gets `order: index` written, making order semantics deterministic), 메뉴명 (hover pencil → inline input, placeholder = default label, empty = revert to default), 경로, 표시 (v-switch; the 메뉴 관리 row's switch is disabled with tooltip), 필요 역할 (v-select; change opens the manual-19장-5.2절 confirm dialog showing 기본 권한 / 변경 전 / 변경 후; confirm → upsert or, when back to default, delete the override row; cancel → revert). Info alert states hiding is display-only, not a permission change. Audit actions: `menu_settings_update`, `menu_role_override_update`.

**Files modified:**
- `src/utils/menuRoleOverrides.ts` — added `upsertMenuRoleOverride()` (upsert on `tenant_id,menu_path`) and `deleteMenuRoleOverride()`; both refresh the module cache via `loadMenuRoleOverrides()` so `lookupRequiredRole` sees new values immediately.
- `src/utils/routePermissions.ts` — new MENU_DEFINITIONS entry `/admin-console/menu-settings` (label 메뉴 관리, section admin, icon `menu` — `public/assets/images/icon/menu.svg` exists, requiredRole admin). Left it in the matrix (not `excludeFromMatrix`) so it appears in its own table with the disabled hide switch.
- `src/router/MainRoutes.ts` — `menu-settings` child added to the admin-console block (inside the existing PAL-conditional spread), with adminTitle/adminDescription meta.
- `src/layouts/full/vertical-sidebar/VerticalSidebar.vue` —
  - mounted: when `window.$pal`, `loadMenuSettings()` into `data.palMenuSettings` (failure = default menus, warn only).
  - method `applyPalMenuSettings(items)`: filter `settings[item.to].hidden` (menu-settings path always kept), apply `label` override, stable order (`setting.order ?? 100000 + originalIndex`).
  - computeds: `palAdminItems` (the former inline 14-item template array + 메뉴 관리 item, filtered by `hasRoleAtLeast(resolveRole(getIsAdminClaim(), authClaimsState.role), lookupRequiredRole(path))` in a try/catch that falls back to the isAdmin gate, then settings applied), `palProcessItems`, `palOrgItems` (조직도/권한 변경 신청 block converted to data-driven v-for, MembershipRequestBadge kept via `item.badge`), `displayedAnalyticsItems` (returns `analyticsItem` untouched when not PAL).
  - Template: the four PAL blocks now render from those computeds; titles render `item.label || $t(item.title)` (or `|| item.title` for raw-Korean lists) so non-PAL rendering is unchanged (`label` is never set outside PAL).

**Sidebar matching:** by exact `item.to` path → `menu_settings.items[path]`; the same paths are the MENU_DEFINITIONS keys the admin screen writes, so the two stay in sync.

**Deviations:** none material; the one judgment call is that role-override filtering is applied only inside the PAL admin section (which stays behind the existing `pal &amp;&amp; isAdmin` gate), so lowering a requirement below admin doesn't surface the 관리자 section to non-admins — AdminConsoleLayout would block them anyway.

**Build/typecheck:** `npx vue-tsc --noEmit` produced zero errors (empty output). `npx vite build` OOMs at default heap during minification (pre-existing; all 7960 modules transform fine) and **succeeds with `NODE_OPTIONS=--max-old-space-size=8192` — built in 2m20s**, `MenuSettingsManager-*.js/.css` chunks emitted. No commits made (parent session owns the working tree).</result>
<usage><subagent_tokens>239719</subagent_tokens><tool_uses>38</tool_uses><duration_ms>921819</duration_ms></usage>
</task-notification>
```

## Note — 2026-09-28T03:01:49+00:00

```text
구현 완료: 도메인 수정/삭제/순서 관리 + 미분류 정리 다이얼로그(프로세스 체계도), 미분류 예약어 가드(신규·레거시), 테넌트별 메뉴 관리 화면(/admin-console/menu-settings: 숨김/이름/순서/필요 역할) 및 PAL 사이드바 반영. vue-tsc·vite build·unit 635건 통과
```

## Note — 2026-09-28T03:10:56+00:00

```text
매뉴얼 작성: docs/manuals/tenant-admin-customization.md (스크린샷 8장: docs/manuals/images/tenant-admin-customization/)
```

## Prompt — 2026-09-28T03:43:29+00:00

```text
추가적으로 사용자화가 필요한 부분을 메뉴얼에서 찾아 speckit-run으로 사용 할 수 있도록 내용 구성해봐.
```

## Prompt — 2026-09-28T03:49:44+00:00

```text
<task-notification>
<task-id>a76f551be023f5cfa</task-id>
<tool-use-id>toolu_01G3DCpiEnohEZDPT25fTCH4</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/49f9096d-2df4-4b1e-84f9-16ce235e27e8/tasks/a76f551be023f5cfa.output</output-file>
<status>completed</status>
<summary>Agent "Verify admin policy hardcoding" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Findings below. All paths absolute.

---

## E. DMN 라우팅 룰 스키마

**정의 위치**
- `/home/kimsanghoon/process-gpt-vue3/src/utils/organizationDmnRule.ts:5-16` — 입력 5열(`role/domain/region/networkType/manufacturer`)과 출력 2열(`contractor/operationPartner`)이 `as const` 배열로 고정.
- `:25-32` `ORGANIZATION_DMN_OUTPUT_REFS` — 출력마다 `xxxId/xxxType` 참조 컬럼도 고정.
- `:44-58` `OrganizationRoutingRule` 타입이 같은 필드를 TS 타입으로 못 박음. `:391` `ORGANIZATION_INPUT_KEYS`, `:170-181` `trimRule`, `:196-208` `buildOrganizationDecisionRows`, `:445-480` `projectOrganizationRulesForOrgIds`, `:530-610` `validateOrganizationDmn` 모두 이 5+2 키를 하드코딩해 개별 필드명으로 접근.
- 샘플 데이터 `:110-127`도 5G/LTE/Samsung/Ericsson 등 통신 특화.

**저장 방식**
- DMN XML 한 덩어리. 키는 `DEFAULT_ORGANIZATION_DMN_KEY = 'organization-assignment-routing'` (`:1`).
- 로드: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue:8735` → `backend.getBusinessRule(DEFAULT_ORGANIZATION_DMN_KEY)`.
- ProcessGPT/PAL 모드 실제 저장소는 **DB 테이블이 아니라 localStorage**: `/home/kimsanghoon/process-gpt-vue3/src/components/api/ProcessGPTBackend.ts:165-181` (`processgpt_raw_definition_business_rules_v1`), 읽기 `:705`, 쓰기 `:2263`. `PalModeBackend`는 `ProcessGPTBackend`를 extends 하며(`/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts:10`) business rule은 오버라이드하지 않음. uEngine 모드만 서버 `businessRules/&lt;id&gt;` raw definition (`/home/kimsanghoon/process-gpt-vue3/src/components/api/UEngineBackend.ts:1436-1494`). → 테넌트 스코프/RLS 없음.

**현재 변경 가능 여부**
- **컬럼 추가/삭제/이름변경 불가.** 값(행)만 채울 수 있음.
- 전용 편집 화면이 **아예 없음**: `/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts:258-267`에 `/admin-console/suppliers`(내부조직역할 관리)와 `/admin-console/organization-dmn-rules`가 등록돼 있으나 `MainRoutes.ts`에 해당 컴포넌트 라우트가 없음 → 404. `/home/kimsanghoon/process-gpt-vue3/specs/007-manual-refresh/feature-gap.md:32`이 이를 명시("docx 17장… `/admin-console/suppliers` 라우트가 현재 코드에 없음(404)"), `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/04-admin-console.md:21`은 "이관 제외" 처리.
- `ProcessHierarchyProperties.vue:1743-1757`은 **조회 전용**("편집: 내부조직역할 관리" 힌트만 표시).
- 범용 DMN 편집기 `/home/kimsanghoon/process-gpt-vue3/src/components/business-rules/BusinessRuleDefinitions.vue:1175-1181`(`addInput`/`removeInput`, 라우트 `/business-rule`)로 이 룰을 열어 컬럼을 늘릴 수는 있으나, 파서 `organizationDmnXmlToRule` (`organizationDmnRule.ts:270-300`)이 `if (!(normalizedKey in row)) return;`로 **미지 컬럼을 조용히 버림** → 실질 무효.

**테넌트화에 필요한 작업**
1. `ORGANIZATION_DMN_INPUTS/OUTPUTS`를 코드 상수 → 테넌트 설정으로 승격 (`configuration` key 예: `org_routing_schema`, value `{inputs:[{key,label}], outputs:[...]}`) — `audit_log_retention` 패턴 그대로.
2. `OrganizationRoutingRule`의 고정 필드를 `values: Record&lt;string,string&gt;` 형태로 리팩터 (trimRule/validate/project/match/XML 직렬화 5곳 모두 키 루프 기반으로 변경).
3. 스키마 편집 UI + `/admin-console/suppliers` 라우트·컴포넌트 신규 구현(현재 부재).
4. 저장소를 localStorage → `tenant_id` 스코프 DB 테이블로 이전(현재 테넌트 격리 없음).
5. 컬럼 삭제/이름변경 시 기존 행 마이그레이션 정책 필요.

---

## F. 휴지통 보존 기간 / 남은 일수

**정의 위치 (전부 하드코딩 30일, 상수화조차 안 된 곳 다수)**
- `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/RecycleBin.vue:221` `const PI_FLAG_TYPE_RETENTION_DAYS = 30;` (유일한 명명 상수), 계산 `:223-229`
- `RecycleBin.vue:462-464` — laneRoleGroup 인라인 `30 - floor(...)`
- `/home/kimsanghoon/process-gpt-vue3/src/stores/adminConsole.ts:702, 940, 1036, 1108, 1192, 1360-1362` — 인스턴스/스키마/시스템/공급사/감사정책/KPI 각각 동일 식 중복. `:1507`은 `remaining_days: 30` 리터럴.
- `/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts:321` — 삭제된 프로세스 `remaining_days` 30일.
- UI 문구도 하드코딩: `/home/kimsanghoon/process-gpt-vue3/src/views/policy-document/PolicyDocumentManager.vue:822`, `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/KpiTargetManager.vue:307` ("30일간 보관").
- 배지 임계값도 고정: `RecycleBin.vue:555-558` (≤5 critical, ≤10 warning).

**저장 방식 / 자동 정리 주체**
- DB에 보존 정책 **없음**. `deleted_at` 컬럼만 있고, `remaining_days`를 계산하는 SQL 뷰/함수·pg_cron purge 잡이 존재하지 않음(migrations 전수 grep 결과 cron.schedule은 `audit-log-retention`, file_download_log 두 건뿐).
- 실제 영구삭제는 **클라이언트에서만** 발생: `RecycleBin.vue:679-694` `purgeExpiredItems()` → `onMounted` `:745`. 즉 **관리자가 휴지통 화면을 열어야만** 만료 항목이 정리됨.

**현재 변경 가능 여부**
- **불가.** `configuration` 키 없음, UI 없음.

**테넌트화에 필요한 작업**
1. `configuration` key `recycle_bin_retention`(`{retention_days:30}`) 신설 — 기존 패턴: `/home/kimsanghoon/process-gpt-vue3/src/stores/adminConsole.ts:137-152`(상수/타입), `:1699-1750`(`fetchAuditLogRetention`/`saveAuditLogRetention` + `audit_retention_update` 감사로그), UI `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/SecuritySettings.vue:525`.
2. 30 하드코딩 8곳(위 목록)을 단일 헬퍼로 통합 후 설정값 주입.
3. `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260911000003_audit_log_retention.sql`의 `archive_expired_audit_logs()` + pg_cron 구조를 그대로 복제한 서버측 purge 함수 신설(현재 클라이언트 의존은 미열람 시 영구 미삭제).
4. 타입별 차등 보존이 필요하면 value를 `{default:30, byType:{...}}`로.

---

## G. 공람(리뷰) 기간 D-day

**하드코딩 30일 — 전부 별개 소스 (서로 불일치 가능)**
1. **권위 있는 쓰기 지점** — `/home/kimsanghoon/process-gpt-vue3/src/components/api/ProcessGPTBackend.ts:10986` (`approve_hq` 양측 승인 시) 및 `:11001` (`approve_field`): `public_feedback_ends_at = new Date(Date.now() + 30*24*60*60*1000)`.
2. **별도 재계산(DB 값 무시)** — `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/useProcessArchitecture.ts:653-664`: `approval.updated_at` 기준 `endDate.setDate(+30)`. DB의 `public_feedback_ends_at`을 읽지 않고 독자 계산 → 관리자가 종료일을 조정해도 체계도 D-day는 반영 안 됨(불일치 버그).
3. **DB 백필** — `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260902000004_backfill_stuck_field_approved_reviews.sql:30`: `public_feedback_ends_at = NOW() + INTERVAL '30 days'`.
4. **문구** — `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/MyInbox.vue:337`, `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ProcessReviewDetail.vue:736`, `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ProcessReviewBoard.vue:1077` — "30일 공람/2단계 기간" 문자열 고정.
5. **주석/스키마** — `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260223000001_governance_workflow.sql:34` "전사 30일 공람".

**부수 임계값(역시 하드코딩)**
- D-7 경보: `/home/kimsanghoon/process-gpt-vue3/src/stores/reviewBoard.ts:120-126` (`&lt;= 7`), `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ProcessReviewBoard.vue:315-316, 335-336`.
- 정체 7일: `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ReviewBoardCard.vue:107` (`&gt;= 7`).

**표시/자동전이 (설정 아님)**
- 잔여일 뷰 계산: `20260223000001_governance_workflow.sql:172-177` (`EXTRACT(DAY FROM ends_at - NOW())`), 동일 로직이 `20260409000002/20260409000003/20260902000002`에 중복.
- 자동 종료: 같은 파일 `:272-300` `auto_transition_public_feedback()` — `ends_at &lt;= NOW()`면 `final_edit`로. 기간 자체는 읽기만.

**현재 변경 가능 여부**
- **테넌트 기본값은 불가.** 다만 **건별 사후 조정**은 admin 전용으로 존재: `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ProcessReviewBoard.vue:703-762` (`adjustPublicFeedbackPeriod`, 감사 action `admin_adjust_public_feedback_period`) 및 `:766-800` 즉시 종료(`adminEndPublicFeedback`). 라벨 `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/AuditTrail.vue:999`.

**테넌트화에 필요한 작업**
1. `configuration` key `review_policy` (`{public_feedback_days:30, dday_warning_days:7, stalled_days:7}`) 신설.
2. 쓰기 지점 `ProcessGPTBackend.ts:10986/11001`을 설정값 기반으로 변경(설정 미조회 시 30 fallback).
3. `useProcessArchitecture.ts:653-664`는 **설정화 이전에 우선** `public_feedback_ends_at`를 직접 읽도록 수정해야 함 — 그렇지 않으면 설정만 바꿔도 체계도 D-day가 틀어짐.
4. 문구 3곳을 동적 일수 보간으로 교체.
5. DB 측 `auto_transition_public_feedback()`은 기간을 쓰지 않으므로 변경 불필요.

---

## H. 역할 체계

**정의 위치 (전부 코드 하드코딩)**
- `/home/kimsanghoon/process-gpt-vue3/src/utils/roles.ts:15-21` `ROLES` (5개 고정), `:24-30` `ROLE_HIERARCHY`, `:33-69` `ROLE_META`(label/labelEn/color/icon/description), `:71-77` `ROLE_LEVEL`(100/80/60/40/20).
- **DB에도 5개가 못 박힘**: `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260521_menu_role_overrides.sql:31` CHECK, `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260902000003_pending_org_member_assignment.sql:8-9` CHECK, `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260908000001_membership_approvals.sql:29, 153, 200` CHECK/검증, `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260403000001_role_based_rls.sql:33-105` `has_role_at_least()` 레벨 매핑, `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260101_base_schema.sql:381` `('admin',5)...('viewer',1)`.
- ROLE_META 라벨 소비처(전부 읽기 전용): `MenuSettingsManager.vue:177-178`, `/home/kimsanghoon/process-gpt-vue3/src/views/organization/OrgDetailPanel.vue:534-564`, `/home/kimsanghoon/process-gpt-vue3/src/views/organization/RoleRequestPage.vue:16-19`, `/home/kimsanghoon/process-gpt-vue3/src/views/organization/MembershipApprovalPanel.vue:19`, `/home/kimsanghoon/process-gpt-vue3/src/views/organization/OrganizationChartView.vue:500`, `/home/kimsanghoon/process-gpt-vue3/src/views/authentication/NoAccessView.vue:18`.

**DB 주도인 것 vs 하드코딩**

| 항목 | 상태 |
|---|---|
| 역할 목록·계층·레벨 | 하드코딩 (코드 + DB CHECK + RLS 함수 3중) |
| 역할 표시 라벨/색/아이콘/설명 | 하드코딩 (`ROLE_META`) — i18n 키조차 아님, 한글 리터럴 |
| 사용자 ↔ 역할 할당 | DB (`users.role`) + UI 있음 (OrgDetailPanel, MembershipApprovalPanel, RoleRequestPage) |
| 메뉴별 필요 역할 | **DB 주도** — `menu_role_overrides` (tenant_id + menu_path UNIQUE, `20260521_menu_role_overrides.sql:20-32`), UI 있음 `MenuSettingsManager.vue`, 조회 `/home/kimsanghoon/process-gpt-vue3/src/utils/menuRoleOverrides.ts:53-121`, 코드 기본값 `/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts` |
| 메뉴 표시/이름/순서 | DB 주도 (`configuration`, `/home/kimsanghoon/process-gpt-vue3/src/services/menuSettingsService.ts:70-108`) |
| 세밀 권한 카탈로그 | DB 테이블 존재 (`permissions`), **글로벌·테넌트 무관**(`20260514_permissions.sql:12` 주석 명시), `tenant_id` 컬럼 없음 |
| 사용자별 권한 부여 | `users.permission_ids uuid[]` (`20260514_permissions.sql:41-47`) |

**권한 카탈로그 관리 화면: 없음.**
- `/home/kimsanghoon/process-gpt-vue3/src/utils/customPermissions.ts:92`의 `getPermissionCatalog()`는 주석에 "관리자 UI 의 정책 CRUD 화면용"이라 적혀 있으나 **호출처가 0건**. 전체 리포에서 `customPermissions`의 소비는 `/home/kimsanghoon/process-gpt-vue3/src/views/admin/AdminConsoleLayout.vue:35`의 `canAccess({apiPath, verb:'GET'})` 단 한 곳. `hasCustomPermission`/`getUserCustomPermissions`/`hasActionPermission` 호출처도 없음 → permissions 테이블은 시드된 채 **사실상 미사용(dead path)**.
- 사용자에게 permission_ids를 붙이는 UI도 없음(`/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/AuditTrail.vue:1164`의 라벨 '임시 권한 목록'은 감사로그 diff 표시용일 뿐).

**현재 변경 가능 여부**
- 역할 **라벨 변경 불가**, **커스텀 역할 추가 불가**. 테넌트가 조정 가능한 것은 "어떤 메뉴에 어떤 기존 역할이 필요한가"(menu_role_overrides)와 "사용자에게 어떤 기존 역할을 줄 것인가"뿐.

**테넌트화에 필요한 작업**
1. **라벨만 테넌트화(저비용)**: `configuration` key `role_labels`(`{admin:{label,description}, ...}`) + `ROLE_META`를 오버레이하는 리졸버 도입, 소비처 6곳을 리졸버 경유로 교체. DB 변경 불필요.
2. **커스텀 역할 추가(고비용)**: `roles` 테이블(tenant_id, code, label, level) 신설 → `20260521/20260902000003/20260908000001` 세 CHECK 제약 제거, `20260403000001`의 `has_role_at_least()`/레벨 매핑을 테이블 조회로 재작성, JWT 클레임·`resolveRole`(`roles.ts:80-86`)·`isAdminRole`(`:89-93`) 정규화 로직 수정. RLS가 레벨에 의존하므로 파급 큼.
3. **권한 카탈로그 UI**: `permissions`에 `tenant_id` 추가(현재 글로벌) + `/admin-console/permissions` CRUD 화면 + 사용자 권한 할당 UI 신설. 기존 `canAccess()` 게이트는 이미 준비돼 있어 UI만 붙이면 동작(단 `customPermissions.ts:135-138` 주석대로 커스텀 권한은 RLS를 넘지 못하므로 RLS 정책도 함께 손봐야 실효).</result>
<usage><subagent_tokens>91057</subagent_tokens><tool_uses>68</tool_uses><duration_ms>275577</duration_ms></usage>
</task-notification>
```

## Note — 2026-09-28T03:53:57+00:00

```text
후속 갭 분석 완료: 매뉴얼 재스캔 + 코드 검증 12건. 후속 프롬프트 specs/009-tenant-admin-customization/next-prompt.md 작성. 부수 수정: ProcessHierarchyTree 도메인 정렬이 order 무시하던 문제 수정
```

## Prompt — 2026-09-28T07:32:06+00:00

```text
1. 미분류 프로세스는 시스템 예약인데 제거 필요.
2. 도메인 관련 변경은 재구성 모드를 이용 할 수 있도록 수정.
```

## Note — 2026-09-28T07:58:48+00:00

```text
도메인 정책 변경: (1) '미분류'를 도메인 목록/필터/관리에서 완전 제외 + 레거시 영속화 경로 차단, (2) 도메인 이름변경·삭제를 재구성 모드(rename-domain/delete-domain)로 이관 — 영향도 분석·결재·점검모드 cut-over 흐름 적용, metrics를 draft_metrics로 함께 반영. 체계도 도메인 관리는 추가/색상/순서만 즉시 반영. 매뉴얼 갱신
```

## Prompt — 2026-09-28T08:34:17+00:00

```text
메뉴 관리 목록 내부 스크롤 동작하지않음.
```

## Prompt — 2026-09-28T08:38:50+00:00

```text
/speckit-run @specs/009-tenant-admin-customization/next-prompt.md
```

## Note — 2026-09-28T08:40:33+00:00

```text
버그 수정: 메뉴 관리 목록 내부 스크롤 미동작 — .list-scroll(flex column)의 자식 .section-block 이 flex-shrink 기본값으로 눌려 overflow:hidden 에 잘림(스크롤바 자체가 안 생김). flex:0 0 auto 로 자연 높이 유지. 동일 잠재 결함인 OptionListManagement .list-card 도 함께 수정
```
