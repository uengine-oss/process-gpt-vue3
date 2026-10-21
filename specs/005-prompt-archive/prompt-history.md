# Prompt History — 005-prompt-archive

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-09-16T03:46:32+00:00

```text
모든 세션에 대해서 프롬프트 이력 저장해두자.
```

<!-- backfilled-from: 9a88c514-2ca5-44fc-88e8-0235ae0e8f2f -->

## Prompt — 2026-08-31T02:02:36.443Z (backfill)

```text
로컬 코드와 별개의 질문
kimsanghoon@instance-20260831-003739:~/process-gpt-vue3$ supabase start --debug
NotFound: FileSystem.readFile (/home/kimsanghoon/.supabase/profile)
WARN: no SMS provider is enabled. Disabling phone login
failed to inspect container health: permission denied while trying to connect to the docker API at unix:///var/run/docker.sock

해결법.
```

<!-- backfilled-from: 72be0f98-cb70-46ed-8cea-798eb6228455 -->

## Prompt — 2026-09-02T03:43:34.983Z (backfill)

```text
라우트 admin-console/kpi-targets KPI 목표에서 지표 추가시, 관련 프로세스는 프로세스 목록에서 받아 올 수 있도록 변경.
```

<!-- backfilled-from: 4dd98e54-a9a6-401c-bd80-fc097c7029d8 -->

## Prompt — 2026-09-02T04:17:43.001Z (backfill)

```text
프로세스 순서도에서 저장 시, {
    "code": "42P10",
    "details": null,
    "hint": null,
    "message": "there is no unique or exclusion constraint matching the ON CONFLICT specification"
} 오류 발생.
```

## Prompt — 2026-09-02T04:24:10.748Z (backfill)

```text
직접 적용해줘.
```

<!-- backfilled-from: 7754d427-0e42-4446-8a08-3707f09cc8ca -->

## Prompt — 2026-09-02T06:40:18.579Z (backfill)

```text
1. 조직도 부분 엔터키로 입력시 2개 생성.
2. 컨텐츠 영역 기타 페이지와 같이 박스형태로 구성.
3. 부서명 중복 불가처리.
```

## Prompt — 2026-09-02T07:25:49.931Z (backfill)

```text
해당 레포 처리할땐 무조건 PAL mode에만 반영될 수 있도록 처리.
```

<!-- backfilled-from: 4fd8aef3-55d9-47ad-91cd-5119586e4e7d -->

## Prompt — 2026-09-02T08:21:11.195Z (backfill)

```text
프로세스 리뷰보드, 프로세스 검토의견에서 승인 절차에 대해서 1단계 승인이 완료되었는데 2단계로 넘어가지않는이유.
```

## Prompt — 2026-09-02T08:25:05.006Z (backfill)

```text
1번으로 수정하고 기존 멈춘 건도 백필해줘
```

## Prompt — 2026-09-02T08:25:20.550Z (backfill)

```text
1번으로 수정하고 기존 멈춘 건도 백필해줘.
```

## Prompt — 2026-09-02T08:31:45.162Z (backfill)

```text
백필 바로 처리해.
```

## Prompt — 2026-09-02T08:34:09.469Z (backfill)

```text
그리고 기존에 존재하던 조직도 페이지도 추가(조직도-before로) 그리고 현재 조직도데이터도 함께 기존 조직도로 migration
```

## Prompt — 2026-09-02T08:52:07.961Z (backfill)

```text
조직도-before 메뉴 제거. 그리고 프로세스 체계도에서 계층 view의 계층 구조별 색상이 현재 시스템과 어울리지않음. 따라서 전체적으로 개선이 필요해보임.
```

## Prompt — 2026-09-03T00:45:57.622Z (backfill)

```text
/compact
```

## Prompt — 2026-09-03T00:48:12.392Z (backfill)

```text
This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

Summary:
1. Primary Request and Intent:

   The user made five sequential requests (all in Korean):

   a) **"프로세스 리뷰보드, 프로세스 검토의견에서 승인 절차에 대해서 1단계 승인이 완료되었는데 2단계로 넘어가지않는이유."** — Diagnose why the process review board approval doesn't advance from stage 1 (검토/in_review) to stage 2 (공람/public_feedback) after stage-1 approval completes.

   b) **"1번으로 수정하고 기존 멈친 건도 백필해줘."** (verbatim: "1번으로 수정하고 기존 멈춘 건도 백필해줘.") — Apply fix option 1 (remove the HQ gate from `approve_field`) and backfill the already-stuck records.

   c) **"백필 바로 처리해."** — Execute the backfill immediately (not just hand over SQL).

   d) **"그리고 기존에 존재하던 조직도 페이지도 추가(조직도-before로) 그리고 현재 조직도데이터도 함께 기존 조직도로 migration"** — Add the pre-existing org chart page as "조직도-before" and migrate current org chart data into it. Via AskUserQuestion the user chose: **읽기 전용으로 공유** (read-only, shared `key='organization'` row) and **PAL 모드 사이드바에 조직도 아래** (sidebar item under 조직도).

   e) **"조직도-before 메뉴 제거. 그리고 프로세스 체계도에서 계층 view의 계층 구조별 색상이 현재 시스템과 어울리지않음. 따라서 전체적으로 개선이 필요해보임."** — Remove the 조직도-before menu item; and the hierarchy view's per-level colors in the process architecture (프로세스 체계도) clash with the current design system, so an overall improvement is needed.

   Standing project constraints (from persistent memory, must continue to apply):
   - **All changes in this repo must apply to PAL mode only** (`pal-mode-only-changes.md`); non-PAL modes (ProcessGPT / GS / JMS) must be untouched. Screen swaps branch in `src/router/MainRoutes.ts` via `component: () => (window.$pal ? import('신규') : import('기존'))`.
   - Org chart storage format must remain `configuration` table `key='organization'` → `value.chart`, node shape `id`/`data`/`children`, departments marked `data.isTeam === true` (read by `organizationUtils.ts`, `ManageAccessTab.vue`, `definition-map/PermissionDialog.vue`).
   - Department names must be globally unique across the whole org chart (`users.department_name` identifies departments elsewhere).

2. Key Technical Concepts:
   - Vue 3 + Vuetify 3.4.10 + Vite 4.5.1 + TypeScript (`vue-tsc --noEmit` for typecheck)
   - Supabase (self-hosted, running in Docker locally: `supabase_db_process-gpt-vue3` exposing 0.0.0.0:54322→5432; REST/Kong on :54321; the `.env` URL `http://34.22.71.73:54321` is this same machine)
   - PAL mode gating via `window.$pal` (`src/palMode.ts`, `VITE_PAL_MODE=true` in `.env`), PAL design system `src/assets/css/SKGlobalStyle.scss` (`.sk-page-card`, `.page-header`, `.page-title`, `.page-subtitle`)
   - Process governance state machine: `proc_def_approval_state` (state, hq_status, field_status, public_feedback_started_at/ends_at/auto_transitioned), `proc_def_approval_history`, `proc_def_snapshots`, view `v_review_board`
   - Canonical 5-stage palette in `src/utils/processStages.ts` (`STAGE_DEFS`): draft `#94a3b8`, in_review `#3B82F6`, public_feedback `#8B5CF6`, final_edit `#F59E0B`, published `#10B981`; wip `#7B1FA2` / sunset `#C62828` come from `ProgressBadge.vue`
   - Design tokens `src/ds/vuetify-bridge/theme.ts`: CLAUDE_THEME (BRAND `#d97757`, SURFACE_0 `#f9f9f7`, SURFACE_2 `#ffffff`, TEXT_PRIMARY `#0b0b0b`, TEXT_SECONDARY `#52514e`, TEXT_MUTED `#898781`, BORDER `#e6e6e4`, lightprimary `#fbeee9`, darkbg `#262624`), SKY_THEME (primary `#0085db`), CLAUDE_DARK_THEME (D_SURFACE_0 `#262624`, D_SURFACE_2 `#1f1e1d`, D_TEXT_PRIMARY `#faf9f5`, D_BORDER `#3a3936`, lightprimary `#3a2a24`, darkbg = D_SURFACE_0)
   - Vuetify CSS theme variables (`rgb(var(--v-theme-primary))`, `rgba(var(--v-theme-X), a)`, `--v-theme-on-primary`) for theme-adaptive styling
   - ApexTree-based legacy org chart with render-time flat→vertical-chain transform (`transformForVerticalLayout`)

3. Files and Code Sections:

   - **`src/components/api/ProcessGPTBackend.ts`** (MODIFIED — root cause of the approval bug)
     - `_changeApprovalState()` `case 'approve_field'` had an HQ gate that never opened. Fixed at lines ~10362-10374:
     ```ts
     // === 1단계 승인 (Field) ===
     // 본사 + 현업 병렬 승인에서 사용하던 hq_status === 'approved' 게이트 제거.
     // 본사 단계가 UI에서 빠지면서 hq_status 가 영구 'pending' 으로 남아
     // 1단계 승인 후 2단계(공람)로 넘어가지 못하던 문제 수정 — 현업 승인만으로 진입한다.
     case 'approve_field':
         updateData.field_status = 'approved';
         updateData.field_reviewed_at = now;
         updateData.field_review_comment = comment || null;
         updateData.state = 'public_feedback';
         updateData.public_feedback_started_at = now;
         updateData.public_feedback_ends_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
         toState = 'public_feedback';
         break;
     ```
     - `case 'approve_hq'` (lines 10349-10360) left as legacy, still gated on `field_status === 'approved'`.
     - Submit still inserts `hq_status: 'pending'` (lines 10023, 10321) — intentionally unchanged.
     - `toState === 'public_feedback'` triggers snapshot save (line ~10548).

   - **`supabase/migrations/20260902000004_backfill_stuck_field_approved_reviews.sql`** (NEW, APPLIED to local DB)
     - `DO $ ... $` loop over `state IN ('in_review','review') AND field_status = 'approved' FOR UPDATE`; sets `state='public_feedback'`, `public_feedback_started_at = NOW()`, `ends_at = NOW() + INTERVAL '30 days'`, `public_feedback_auto_transitioned = FALSE`; inserts an `approve_field` history row with original approval time/approver in the comment; inserts a `public_feedback` snapshot from `proc_def.bpmn` guarded by `NOT EXISTS`; `RAISE NOTICE '[backfill] 1단계 승인 완료 → 2단계 전환: % 건'`.
     - Rationale documented: started_at = NOW() because those items were never actually exposed for 공람; using the old timestamp would make `auto_transition_public_feedback()` immediately push them to final_edit.

   - **`src/components/OrganizationChartChat.vue`** (MODIFIED — legacy org chart page, shared with non-PAL)
     - Added `readonly` prop (default `false`), a readonly template branch replacing `AppBaseCard`, and save guards:
     ```vue
     <!-- 읽기 전용(조직도-before): 좌측 관리 패널 없이 차트만 전체 폭으로 렌더 -->
     <div v-if="readonly" class="organization-readonly-chart">
         <OrganizationChart :node="organizationChart" :key="organizationChart.id" :userList="userList" :readonly="true" ref="organizationChart"></OrganizationChart>
     </div>
     <v-card v-else elevation="10">
         <AppBaseCard> ... </AppBaseCard>
     ```
     - `async updateNode() { if (this.readonly) return; ... }` — the single choke point all save paths pass through (including EventBus handlers `user-deleted`/`agentDeleted`/`agentAdded`).
     - `afterGenerationFinished()` and `beforeSendMessage()` also early-return when readonly.
     - Added `<style scoped>` with `.organization-readonly-chart { height: 100%; min-height: 480px; position: relative; }`

   - **`src/components/ui/OrganizationChart.vue`** (MODIFIED — ApexTree renderer, shared)
     - Added `readonly: { type: Boolean, default: false }` prop
     - `const canEditRootName = !this.readonly && isRoot && currentUser && currentUser.role === 'superAdmin';`
     - `handleAgentEditFromBadges(agentData) { if (this.readonly) return; ... }`

   - **`src/views/organization/OrganizationChartBeforeView.vue`** (NEW, PAL-only wrapper)
     - `sk-page-card` + `page-header` with title "조직도-before", subtitle, "읽기 전용" badge, link button to `/organization`; body renders `<OrganizationChartChat readonly />`
     - Scoped CSS: `.org-before-page { height: calc(100vh - 40px) !important; min-height: 460px; display:flex; flex-direction:column; overflow:hidden; }`, `.org-before-body { flex: 1 1 auto; min-height: 0; position: relative; }`, mobile `calc(100vh - 24px)`
     - `<script setup lang="ts">` importing `OrganizationChartChat`

   - **`src/router/MainRoutes.ts`** (MODIFIED)
     ```ts
     {
         name: 'organization-before',
         path: '/organization-before',
         // 개편 전 조직도 화면(읽기 전용). 사이드바 메뉴에는 노출하지 않고 URL 직접 접근만 지원한다.
         // PAL 모드 전용이며 비 PAL 모드는 기존 /organization 으로 보낸다.
         component: () =>
             window.$pal ? import('@/views/organization/OrganizationChartBeforeView.vue') : import('@/components/OrganizationChartChat.vue'),
         beforeEnter: (to: any, from: any, next: any) => {
             if (window.$pal) next();
             else next('/organization');
         }
     },
     ```

   - **`src/layouts/full/vertical-sidebar/VerticalSidebar.vue`** — a 조직도-before item was added then REMOVED per request e; the file is now byte-identical to HEAD (no longer in `git status`).

   - **`src/views/process-architecture/ProcessArchHierarchyView.vue`** (MODIFIED — hierarchy color rework)
     - Added a token block on `.hierarchy-view-container` with a documented rationale comment (계층은 hue가 아니라 브랜드 색의 명도 램프로 표현):
     ```css
     --hier-ink: rgb(var(--v-theme-darkbg));
     --hier-on-ink: #faf9f5;
     --hier-brand: rgb(var(--v-theme-primary));
     --hier-on-brand: rgb(var(--v-theme-on-primary));
     --hier-brand-soft: rgb(var(--v-theme-lightprimary));
     --hier-surface: rgb(var(--v-theme-surface));
     --hier-panel: rgb(var(--v-theme-background));
     --hier-border: rgb(var(--v-theme-borderColor));
     --hier-line: rgba(var(--v-theme-textPrimary), 0.18);
     --hier-text: rgb(var(--v-theme-textPrimary));
     --hier-text-soft: rgb(var(--v-theme-textSecondary));
     ```
     - Level ramp: `.domain-node` → `var(--hier-ink)` bg + `--hier-on-ink` text + domain's own color only as `inset 0 3px 0 0 var(--domain-color, var(--hier-brand))` top accent (was `#00695c !important` with `!important` white text and a 2px domain-color border); `.mega-node` → `var(--hier-brand)` + `var(--hier-on-brand)` (was `#e65100`/white); `.major-node` → `var(--hier-brand-soft)` + `var(--hier-text)` + `1px solid rgba(var(--v-theme-primary), 0.3)` (was `#2e7d32`/white); `.sub-node` → `var(--hier-surface)` + `var(--hier-text)` + `var(--hier-border)`.
     - Sub-node status unified onto one `--stage-rgb` variable:
     ```css
     .sub-node::before { background: rgb(var(--stage-rgb)); }
     .sub-node {
         background: linear-gradient(rgba(var(--stage-rgb), 0.09), rgba(var(--stage-rgb), 0.09)), var(--hier-surface);
         border-color: rgba(var(--stage-rgb), 0.32);
     }
     .sub-node:hover {
         background: linear-gradient(rgba(var(--stage-rgb), 0.16), rgba(var(--stage-rgb), 0.16)), var(--hier-surface);
         border-color: rgba(var(--stage-rgb), 0.55);
     }
     .sub-node--none, .sub-node--draft { --stage-rgb: 148, 163, 184; }
     .sub-node--review, .sub-node--in-review { --stage-rgb: 59, 130, 246; }
     .sub-node--public-review, .sub-node--public-feedback { --stage-rgb: 139, 92, 246; }
     .sub-node--final-edit { --stage-rgb: 245, 158, 11; }
     .sub-node--published { --stage-rgb: 16, 185, 129; }
     .sub-node--wip { --stage-rgb: 123, 31, 162; }
     .sub-node--sunset { --stage-rgb: 198, 40, 40; }
     ```
     - Legend `.legend-pill` uses the same `--stage-rgb` mechanism; `.legend-box` classes (`domain-node-color` / `mega-node-color` / `major-node-color` / `sub-node-color`) now mirror the new level tokens.
     - Neutrals: connectors `2px solid #bdbdbd` → `2px solid var(--hier-line)` (3 occurrences), `.domain-section` `#eee` → `var(--hier-border)`, `.hierarchy-zoom-level`/`.domain-section-title`/`.legend-inline__title` `#475569` → `var(--hier-text-soft)`, `.legend-inline__divider` `#94a3b8` → `var(--hier-border)`, legend panel `#f8fafc`/`#e5e7eb` → `var(--hier-panel)`/`var(--hier-border)`, node shadows softened to `rgba(15,23,42,…)`.
     - `.node-edit-icon, .node-add-icon` color changed from `rgba(255,255,255,0.7)` to `color: inherit` (major node became light, so fixed white icons would have been invisible).
     - Script changes: `unassignedDomain.color` `'#78909C'` → `'#898781'` (design-system neutral mute); `getDomainNodeStyle()` now returns `color ? { '--domain-color': color } : {}` instead of falling back to `'#004d40'`.
     - Only remaining hardcoded hexes in the file: `'#898781'` (line 290) and `--hier-on-ink: #faf9f5` (line 650), plus STAGE_DEFS values inside explanatory comments.

   - **Read-only references consulted:** `src/utils/processStages.ts` (STAGE_DEFS, mapStateToStage, deriveStatus), `src/utils/reviewPermissions.ts` (canApproveHQReview/canApproveFieldReview/canEndPublicFeedbackReview), `src/views/review-board/ProcessReviewBoard.vue`, `src/views/review-board/ProcessReviewDetail.vue`, `src/stores/reviewBoard.ts` (unused `isParallelApprovalComplete` getter), `src/components/ui/ProgressBadge.vue`, `src/components/ui/OrganizationManagePanel.vue`, `src/components/shared/AppBaseCard.vue`, `src/views/organization/orgChartModel.ts`, `src/theme/LightTheme.ts`, `src/theme/DarkTheme.ts`, `src/ds/vuetify-bridge/theme.ts`.

   - **Memory file updated:** `/home/kimsanghoon/.claude/projects/-home-kimsanghoon-process-gpt-vue3/memory/org-chart-rebuild.md` — added a "조직도-before" section noting: PAL-only read-only page, wrapper file path, **sidebar menu NOT exposed** (added then removed at user request on 2026-09-02), URL-direct-access only, shares the same `configuration key='organization'` row (no separate copy) so read-only is mandatory to protect the new screen's nested departments/leaderId, implemented via `readonly` props defaulting to false so non-PAL `/organization` is unchanged.

4. Errors and fixes:
   - **Could not initially run the backfill** — `.env` contains only `VITE_SUPABASE_KEY=sb_publishab…` (anon/publishable), no service key or DB URL; port 5432/6543/5433 closed; anon REST returned `Content-Range: */0` (RLS blocked). I reported this honestly and supplied commands. On the user's follow-up ("백필 바로 처리해") I probed further, found port **54322 OPEN**, then `docker ps` revealed the whole Supabase stack running locally, and applied it via `docker exec supabase_db_process-gpt-vue3 psql -U postgres -d postgres`. Correction stated to user: the earlier 0-row REST reading was RLS, not an absence of data.
   - **`pkill`/`pgrep` self-match confusion** — `pgrep -f "vite --port 5199"` matched its own bash wrapper command line, reporting "still running" after the server was already dead. Resolved by verifying with `curl -o /dev/null -w "%{http_code}"` against the port (returned `000` = down).
   - **Vite restart race** — first batch of module fetches returned HTTP 000 because the server wasn't ready; resolved by retrying the curls.
   - **Questionable scoped-CSS selector** — I wrote `.org-before-body :deep(> *) { height: 100% }` in the new wrapper view, then removed it since `OrganizationChartChat`'s own scoped `.organization-readonly-chart { height: 100% }` already covers it.
   - **User feedback / direction changes:** (a) the user chose read-only shared data over a separate `organization_before` copy; (b) the user then had me remove the 조직도-before sidebar menu I had just added — I removed only the menu item and kept the route (URL-direct access), reverting `VerticalSidebar.vue` to its original content.

5. Problem Solving:
   - **Solved:** Root-caused and fixed the stage-1→stage-2 approval stall (stale HQ gate after the 본사 stage was removed from the UI). Applied and verified the DB backfill for the single stuck record (`p5.4.3-internal-audit`, tenant `tym`): state → `public_feedback`, 공람 window 2026-09-02 17:33 → 2026-10-02 17:33, `auto_transitioned=false`, history row with original approval time `2026-09-02 17:20`, snapshot `ee7e1ecb-…` (bpmn 50,875 chars), 0 remaining stuck, `v_review_board` shows 29 days remaining. Backup CSV at `<scratchpad>/backfill_before.csv`.
   - **Solved:** Determined the org-chart "migration" was a no-op — both pages already share `configuration key='organization'` → `value.chart` with identical node shape; the legacy vertical-chain look is a render-time transform, not a storage difference. Delivered the 조직도-before page read-only instead.
   - **Solved:** Hierarchy view palette reworked to a theme-token depth ramp and realigned sub-node status hues to the canonical STAGE_DEFS (previously review/public_feedback/final_edit hues were shuffled relative to the dashboard/review board/ProgressBadge).
   - **Known limitation flagged to user:** the legacy org chart doesn't understand nested departments, so if nested departments are later created in the new screen they will render chained with members in 조직도-before (display-only oddity; data is safe because it is read-only).
   - **Not verified:** actual browser rendering of `/organization-before` and of the new hierarchy colors — no login credentials (`E2E_PASS`) available.

6. All user messages:
   - "프로세스 리뷰보드, 프로세스 검토의견에서 승인 절차에 대해서 1단계 승인이 완료되었는데 2단계로 넘어가지않는이유."
   - "1번으로 수정하고 기존 멈춘 건도 백필해줘."
   - "백필 바로 처리해."
   - "그리고 기존에 존재하던 조직도 페이지도 추가(조직도-before로) 그리고 현재 조직도데이터도 함께 기존 조직도로 migration"
   - (AskUserQuestion answers) "조직도-before 페이지가 쓸 데이터를 어떻게 할까요?" = **"읽기 전용으로 공유"**; "조직도-before 메뉴를 어디에 노출할까요?" = **"PAL 모드 사이드바에 조직도 아래"**
   - "조직도-before 메뉴 제거. 그리고 프로세스 체계도에서 계층 view의 계층 구조별 색상이 현재 시스템과 어울리지않음. 따라서 전체적으로 개선이 필요해보임."

7. Pending Tasks:
   - None explicitly outstanding. The hierarchy color rework was completed and statically verified; the menu removal was completed.
   - Unverified item worth surfacing: visual confirmation in a browser of the new hierarchy colors (light / sky / dark themes) and of `/organization-before` layout, blocked on login credentials.

8. Current Work:
   Immediately before this summary request I had just finished the two tasks in the user's most recent message:

   (a) **Removed the 조직도-before sidebar menu** — deleted the `v-list-item` block I had added to `src/layouts/full/vertical-sidebar/VerticalSidebar.vue` (file now matches HEAD exactly, confirmed absent from `git status`), and updated the route comment in `src/router/MainRoutes.ts` to `// 개편 전 조직도 화면(읽기 전용). 사이드바 메뉴에는 노출하지 않고 URL 직접 접근만 지원한다.` The `/organization-before` route and `OrganizationChartBeforeView.vue` remain for direct URL access.

   (b) **Reworked `src/views/process-architecture/ProcessArchHierarchyView.vue` colors** — replaced the clashing Material hues (`#00695c` / `#e65100` / `#2e7d32` / `#bdbdbd` / slate neutrals) with a Vuetify-token depth ramp (`--hier-ink` → `--hier-brand` → `--hier-brand-soft` → `--hier-surface`) that adapts across the light/sky/dark themes, and collapsed all sub-node + legend status styling onto a single `--stage-rgb` custom property whose values now match `STAGE_DEFS` in `src/utils/processStages.ts` (fixing the shuffled review/공람/최종수정 hues) plus `ProgressBadge`'s wip/sunset colors.

   Verification performed: `npx vue-tsc --noEmit` passed; the vite dev server compiled every modified SFC (HTTP 200); the compiled scoped CSS (`?vue&type=style&index=0&scoped=true&lang.css`) contained `hier-brand-soft` (3), `hier-ink` (4), `hier-line` (4), `stage-rgb` (29), `v-theme-on-primary` (1) and **zero** occurrences of the old hexes. The dev server was then stopped (curl to :5199 returns 000).

   The very last tool action was updating the memory file `org-chart-rebuild.md` to record that the 조직도-before menu is intentionally not exposed in the sidebar — that write succeeded ("ok").

9. Optional Next Step:
   No further work is required for the user's most recent request; both parts ("조직도-before 메뉴 제거" and the hierarchy color improvement) are complete and statically verified. The appropriate next step is simply to report the results to the user, noting the one gap: browser-level visual verification of the new hierarchy palette was not possible (no `E2E_PASS` credentials), so the user should open the 프로세스 체계도 계층 view to eyeball the new ramp — particularly the mega node's `--v-theme-on-primary` text contrast on the brand orange and the domain node's ink chip in dark theme.

If you need specific details from before compaction (like exact code snippets, error messages, or content you generated), read the full transcript at: /home/kimsanghoon/.claude/projects/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d.jsonl
Continue the conversation from where it left off without asking the user any further questions. Resume directly — do not acknowledge the summary, do not recap what was happening, do not preface with "I'll continue" or similar. Pick up the last task as if the break never happened.
```

## Prompt — 2026-09-03T00:48:12.504Z (backfill)

```text
현재 색상 마음에 안들고, 마우스 호버 이벤트는 색상 살짝 바꾸는 정도로 표시하는게 어떨지. 그리고 프로세스 상태에 따른 색상에서 차세대 기획 중, 폐기 예정 2가지 색상은 어떨때 설정 가능한지 확인해봐.
```

## Prompt — 2026-09-03T01:24:03.310Z (backfill)

```text
1. 계층 폰트 크기 조절 필요 (가독성) 
2. 우선 체계도 legend에서 차세대 기획 중, 폐기 예정 제거. 완료 -> 배포됨
```

## Prompt — 2026-09-03T01:27:55.406Z (backfill)

```text
<task-notification>
<task-id>bypz58m1b</task-id>
<tool-use-id>toolu_01RjrdbNEDYpPkCeSqQy8PKg</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/bypz58m1b.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T01:28:29.728Z (backfill)

```text
체계도 프로세스 색상도 배경 모두 흰색인데, 프로세스상태에 맞춰서 배경색상 -> 호버시 진해지도록 처리하는게 좋을 것 같음.
```

## Prompt — 2026-09-03T03:56:49.462Z (backfill)

```text
카드에 단계 표시 글씨 가독성이 너무 떨어짐. 잘보이도록 폰트 색상 설정.
```

## Prompt — 2026-09-03T04:02:02.371Z (backfill)

```text
<task-notification>
<task-id>bt45dakuj</task-id>
<tool-use-id>toolu_01B23zUwmTStkSfrPUfFBVx3</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/bt45dakuj.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T04:39:41.643Z (backfill)

```text
<task-notification>
<task-id>b1302nhc2</task-id>
<tool-use-id>toolu_01ChdNpQysaEdyutV9iBEtJG</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/b1302nhc2.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T04:59:05.982Z (backfill)

```text
내장패널속성은 뭐고 왜 저렇게두었는지 확인. 기존 패널의 입력정보도 모두 커스텀화 시켜서 진행해야함.
```

## Prompt — 2026-09-03T05:06:53.279Z (backfill)

```text
<task-notification>
<task-id>b77buj7b0</task-id>
<tool-use-id>toolu_01Vrb7xnwnpNqZ3WfS5mVY53</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/b77buj7b0.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T05:27:02.280Z (backfill)

```text
기존 속성패널에 코드로 하드코딩돼 있던 필드/섹션들은 현재 구조에 맞춰서 migration해야함. 그래서 따로 관리 할 필요 없이, 속성값으로만 관리 하면 됨.
```

## Prompt — 2026-09-03T05:35:55.846Z (backfill)

```text
<task-notification>
<task-id>babih9i4z</task-id>
<tool-use-id>toolu_01ANoSZZCgqSd2YZLPPKgqH8</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/babih9i4z.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T05:49:22.880Z (backfill)

```text
화면 재검토. 우측 여백 너무 많이 남음. 우측에서 미리보기를 보여주는게 좋아보임. 목록 스크롤도 안됨.
```

## Prompt — 2026-09-03T05:52:59.713Z (backfill)

```text
<task-notification>
<task-id>b604584qy</task-id>
<tool-use-id>toolu_01DwHausPdJbjgbsrCgqwEtw</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/b604584qy.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T06:08:53.575Z (backfill)

```text
여전히 스크롤 안됨.
```

## Prompt — 2026-09-03T06:20:42.413Z (backfill)

```text
속성패널 미리보기 스타일은 실제 패널과 동일하게 맞춰줘.
```

## Prompt — 2026-09-03T06:46:51.853Z (backfill)

```text
활성화 비활성화시 새로고침되면서 스크롤이 리셋됨. 새로고침 안하도록 처리.
```

## Prompt — 2026-09-03T06:51:02.163Z (backfill)

```text
지금 여기서 더 확장(사용의 자유)가능한 기능목록 제안해봐. 그리고 특정 API를 호출해서 해당 목록을 Mapping한다거나 하는 기능도 가능한지 고려.
```

## Prompt — 2026-09-03T06:52:07.744Z (backfill)

```text
<task-notification>
<task-id>b4dkge297</task-id>
<tool-use-id>toolu_01Rtz4ErqsNawHgWjdxQwbf1</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/b4dkge297.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T06:52:07.744Z (backfill)

```text
<task-notification>
<task-id>b6iuvm0gv</task-id>
<summary>Monitor event: "vue-tsc typecheck result"</summary>
<event>TS_EXIT=0
[exited with code 0]</event>
</task-notification>
```

## Prompt — 2026-09-03T06:52:07.745Z (backfill)

```text
<task-notification>
<task-id>b6iuvm0gv</task-id>
<tool-use-id>toolu_01ESiCLKBeMznek2ZccjW3ik</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/b6iuvm0gv.output</output-file>
<status>completed</status>
<summary>Monitor "vue-tsc typecheck result" stream ended</summary>
</task-notification>
```

## Prompt — 2026-09-03T06:54:47.383Z (backfill)

```text
한개씩 계획 세워서 진행해
```

## Prompt — 2026-09-03T07:02:30.518Z (backfill)

```text
<task-notification>
<task-id>bav2f1igd</task-id>
<tool-use-id>toolu_016Asyvds3F7yh2wAUHoMmEz</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/bav2f1igd.output</output-file>
<status>completed</status>
<summary>Background command "Full typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T07:19:35.830Z (backfill)

```text
프로세스 순서도에서 왼쪽 위 메뉴 플로팅 버튼이 순서도 왼쪽 접기 펼치기 버튼을 가림.
```

## Prompt — 2026-09-03T07:26:42.758Z (backfill)

```text
<task-notification>
<task-id>bpicohv03</task-id>
<tool-use-id>toolu_01A8vYTfAMcSRBq55H6cApCT</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/bpicohv03.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T07:58:46.271Z (backfill)

```text
현재 프로세스 순서도 태스크 속성패널 보이지않음.
```

## Prompt — 2026-09-03T08:13:42.169Z (backfill)

```text
[
    {
      "id": 1,
      "name": "첫 번째 항목",
      "description": "첫 번째 mock 데이터입니다."
    },
    {
      "id": 2,
      "name": "두 번째 항목",
      "description": "두 번째 mock 데이터입니다."
    },
    {
      "id": 3,
      "name": "세 번째 항목",
      "description": "세 번째 mock 데이터입니다."
    }
  ]
  이렇게 return이 오는 API에서 속성스키마 관리에서 Options Source 설정은 어떤식으로 하면됨?
```

## Prompt — 2026-09-03T08:14:03.912Z (backfill)

```text
<task-notification>
<task-id>b1iepve9b</task-id>
<tool-use-id>toolu_01Y29Xb8Gx12wCVdW1oQmYLn</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/b1iepve9b.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-03T08:18:29.085Z (backfill)

```text
{
    "errorCode": "TENANT_MISMATCH",
    "message": "Tenant ID mismatch: expected '34', found 'tym'",
    "status": 401
}

이렇게 나오는데.
```

## Prompt — 2026-09-03T08:19:25.688Z (backfill)

```text
gateway쪽에서 관련 처리를 하는 곳이 있는지 확인해봐.
```

## Prompt — 2026-09-03T08:20:00.966Z (backfill)

```text
이어서 진행.
```

## Prompt — 2026-09-03T08:21:10.576Z (backfill)

```text
IP 접근은 검증 스킵으로 게이트웨이 수정해
```

## Prompt — 2026-09-03T08:32:50.787Z (backfill)

```text
Participant쪽 속성 스키마에 있던 프로세스 성과지표를 프로세스 레벨로 변경했는데 속성 패널에 반영이 안됨.
```

## Prompt — 2026-09-03T08:38:41.980Z (backfill)

```text
프로세스 성과지표 PPI (프로세스 성과지표)
이 프로세스의 성과를 측정하는 지표(PPI)를 정의합니다. 이부분 텍스트가 이상해서 없는게 나을 것 같음. 근데 속성패널에선 해당부분이 수정 불가능해보임. 어떤식으로 처리되는 영역인지 확인필요.
```

## Prompt — 2026-09-03T08:42:23.170Z (backfill)

```text
읽기모드에서도 스크롤은 가능핟로록 처리해줘.
```

## Prompt — 2026-09-03T08:48:24.164Z (backfill)

```text
속성스키마 페이지에서 순서 설정이 어느기준으로 되는지? 모든 태스크 설정값과, 특정 태스크 유형의 설정값을 합쳐서 순서가 정리되어야 할 것 같음.
```

## Prompt — 2026-09-03T08:54:26.359Z (backfill)

```text
<task-notification>
<task-id>b5izarxzk</task-id>
<tool-use-id>toolu_01VmKwZmeYuuzbeQv8ytnC1k</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/4fd8aef3-55d9-47ad-91cd-5119586e4e7d/tasks/b5izarxzk.output</output-file>
<status>completed</status>
<summary>Background command "Typecheck merged-order change" completed (exit code 0)</summary>
</task-notification>
```

<!-- backfilled-from: 82a55dd1-04de-416b-8d3a-ad6f562b9eee -->

## Prompt — 2026-09-04T00:53:03.999Z (backfill)

```text
전체적인 기능들을 분리해서 환경변수로 관리하고싶음. 메뉴, UI를 모두 고려해서 전체적인 기능들에 대한 활성화, 비활성화 처리를 하고싶음. 현재 코드를 확인해서 각 메뉴 페이지 단위 기능들을 점검하고, AI기능같은 경우에는 분산되어있음. 따라서 이부분도 모두 고려해서 확인해야함.
그리고 각 기능별로 활성화, 비활성화에대한 페이지 영향도까지 분석해서 markdown으로 정리해봐.
```

## Prompt — 2026-09-04T00:57:06.115Z (backfill)

```text
<task-notification>
<task-id>a066f1772aa5491ab</task-id>
<tool-use-id>toolu_01M2qnQoKCjZZ5pFAGvdYsnE</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/a066f1772aa5491ab.output</output-file>
<status>completed</status>
<summary>Agent "환경변수·설정 사용 현황" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>조사 완료. 이 프로젝트는 **3계층 설정 체계**(빌드타임 env → 런타임 `window._env_` → Supabase `configuration` 테이블)를 쓰고 있고, 새 feature flag는 이 중 어느 계층에 속하느냐에 따라 붙일 자리가 정해져 있습니다.

---

## 1. 환경변수 전체 목록

`envPrefix` 커스터마이징은 없어서 Vite 기본값(`VITE_`)만 클라이언트 번들에 노출됩니다. `vite.config.ts:31` 의 `define` 블록은 **전부 주석 처리되어 비어 있습니다** — 컴파일타임 상수 주입 방식은 현재 미사용입니다.

| 이름 | 용도 | 주요 사용 파일 |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` | Supabase 클라이언트 생성 | `src/main.ts:264-265` |
| `VITE_PAL_MODE` | **PAL 모드 on/off (핵심 플래그)** | `src/palMode.ts:4` |
| `VITE_GS_MODE` | GS 모드 — 라우트 화이트리스트 축소 | `src/router/MainRoutes.ts:3` |
| `VITE_MODE` | 제품 모드 (`ProcessGPT` / `uEngine`) | `src/main.ts:242` |
| `VITE_TENANT_OVERRIDE` | 로컬 개발 시 테넌트 강제 지정 | `src/main.ts` setupTenant (현재 working tree에서 제거됨 — 아래 참조) |
| `VITE_KEYCLOAK_URL` / `_REALM` / `_CLIENT_ID` | uEngine 모드 SSO | `src/main.ts:468-470`, `src/utils/keycloak.js` (6곳 반복) |
| `VITE_API_URL` | 레거시 users API | `src/stores/authUser.ts:5` |
| `VITE_UPSTAGE_API_KEY` | 문서 파싱 API 키 | `src/utils/upstageParser.js:30` |
| `VITE_AGENT_BASE_URL` | `/agent` 베이스 | `src/services/WorkAssistantAgentService.js:17` |
| `VITE_AGENT_ROUTER_BASE_URL` | `/agent-router` 베이스 | `src/services/AgentRouterService.js:14` |
| `VITE_MCP_VALIDATOR_URL` | `/mcp-validator` 베이스 + dev 프록시 타겟 | `src/services/McpValidatorService.js:12`, `vite.config.ts:189` |
| `VITE_ROBO_API_BASE_URL` | 용어집 API | `src/components/pages/account-settings/GlossaryManageTab.vue:202` |
| `VITE_PDF2BPMN_API_BASE_URL` | PDF→BPMN 변환 | `src/views/chat/ChatRoomPage.vue:10451,10462` |
| `VITE_REALTIME_ASSIST_WS` | 실시간 어시스트 WS | `src/components/apps/todolist/FormRealtimeAssistant.vue:179` |
| `VITE_UENGINE_GATEWAY_URL` | 게이트웨이 프록시 타겟 (20+ 경로 공용) | `vite.config.ts:10` |
| `VITE_PI_SYSTEM_BACKEND_URL` | PAL 시스템관리 백엔드 프록시 | `vite.config.ts:172` |
| `VITE_CLI_AGENT_URL` | CLI 에이전트 프록시 | `vite.config.ts:218` |
| `STRATEGY_PROXY_TARGET` | 전략 서비스 프록시 (VITE_ 접두사 없음, 빌드타임 전용) | `vite.config.ts:113` |
| `VITE_OPENAI_API_KEY` | k8s 매니페스트에만 존재, 코드에서 미사용 | `kubernetes/deployment.yaml:26` |
| `PROCESS_GPT_OFFICE_MCP_URL` | **버그 있음 — 아래 참조** | `ChatRoomPage.vue:7833`, `HwpxEditorDialog.vue:61` |

`import.meta.env.PROCESS_GPT_OFFICE_MCP_URL` 두 곳은 `VITE_` 접두사가 없어 **항상 `undefined`** 입니다. Vite는 접두사 없는 변수를 클라이언트에 노출하지 않습니다. 새 플래그 명명 시 이 함정을 피해야 합니다.

### env 파일

- `/home/kimsanghoon/process-gpt-vue3/.env` — 5줄. `VITE_TENANT_OVERRIDE=skt`, `VITE_PAL_MODE=true` (현재 로컬은 PAL 켜짐)
- `/home/kimsanghoon/process-gpt-vue3/.env.example` — `VITE_PAL_MODE=false` 가 문서화된 플래그 표준
- `/home/kimsanghoon/process-gpt-vue3/docker-compose/.env.example` — Supabase 셀프호스팅 인프라용, 프론트와 무관
- `.env.local` 은 없음. `env.d.ts` 에 `ImportMetaEnv` 인터페이스 선언이 **없어** env 변수 타입 안전성이 전혀 없습니다 (`vite/client` 레퍼런스만 있음).

---

## 2. 모드/플래그 결정 흐름

### PAL 모드 (참고할 가장 좋은 레퍼런스 패턴)

`/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` — 전체 12줄, 순수 사이드이펙트 모듈:

```ts
const runtimePalMode = (window as any)._env_?.VITE_PAL_MODE;
const buildPalMode = import.meta.env.VITE_PAL_MODE;
const enabled = runtimePalMode === true || runtimePalMode === 'true' || buildPalMode === 'true';
Object.defineProperty(window, '$pal', { value: enabled, writable: false, configurable: false });
```

흐름:
1. `src/main.ts:8` 의 `import './palMode';` — **다른 어떤 로직보다 먼저** 평가됨 (파일 상단 주석: "라우터가 모드별 화면을 구성하기 전에 이 모듈이 먼저 평가되어야 한다")
2. `window.$pal` 이 `writable: false, configurable: false` 로 동결
3. 소비처 ~50곳. 게이팅 층위가 4가지로 갈립니다:
   - **CSS 번들 조건부 로드**: `main.ts:88` → `import('@/assets/css/SKGlobalStyle.scss')`
   - **라우트 스프레드**: `MainRoutes.ts:446, 651` → `...(window.$pal ? [...routes] : [])`
   - **컴포넌트 스왑**: `MainRoutes.ts:97, 105, 188` → `window.$pal ? import('A.vue') : import('B.vue')`
   - **백엔드 구현체 교체**: `BackendFactory.ts` `createBackend()` — `$pal` + `$mode` 조합으로 `PalUengineBackend` / `PalModeBackend` / `UEngineBackend` / `ProcessGPTBackend` 4분기
   - **부팅 사이드이펙트**: `main.ts:385` → `if (window.$pal) startUsageTracking(router)`

### GS 모드 (라우트 블랙리스트 방식)

`src/router/MainRoutes.ts:3` 에서 `isGsMode` 계산 → `:5` 의 `gsExcludedRoutes` 배열(20개 라우트명) → `:684` 에서 `children: isGsMode ? allRoutes.filter(r =&gt; !gsExcludedRoutes.includes(r.name)) : allRoutes`. PAL의 화이트리스트 스프레드와 정반대 방향입니다.

### $mode (제품 모드)

`src/main.ts:242` — `window._env_?.VITE_MODE || import.meta.env.VITE_MODE || window.$mode || 'ProcessGPT'`. `window.$mode` 폴백이 있는 이유는 `index.html:40` 이 `/static/config.js` 를 로드하기 때문 (현재 0바이트 빈 파일이지만, 배포 시 교체 가능한 훅으로 남아 있음).

### 런타임 주입 (`window._env_`)

`/home/kimsanghoon/process-gpt-vue3/run.sh:17-33` — Docker 엔트리포인트가 `sed` 로 빌드된 `index.html` 의 `&lt;head&gt;` 뒤에 `window._env_ = {...}` 스크립트를 삽입합니다. **주입 목록이 하드코딩**되어 있고 현재 7개만 포함: `VITE_SUPABASE_URL/KEY`, `VITE_KEYCLOAK_*`, `VITE_UPSTAGE_API_KEY`, `VITE_GS_MODE`, `VITE_MODE`.

**`VITE_PAL_MODE` 는 이 목록에 없습니다.** `palMode.ts` 가 `window._env_?.VITE_PAL_MODE` 를 읽도록 코드는 준비되어 있지만 run.sh가 주입하지 않아 런타임 경로가 죽어 있습니다 — 프로덕션에서 PAL은 사실상 빌드타임 전용입니다. 새 플래그를 런타임 토글 가능하게 하려면 `run.sh:21-30` 에 반드시 추가해야 합니다.

---

## 3. 테넌트별 설정 로딩 구조

### 테넌트 식별 (3단계 우선순위)

`/home/kimsanghoon/process-gpt-vue3/src/utils/tenant.js` 가 정본이고, 헤더 주석에 규칙이 명시되어 있습니다:
1. `window.$tenantName` (서브도메인 파싱, main.ts `setupTenant`)
2. 세션 JWT 의 `app_metadata.tenant_id`
3. `localStorage.tenantId`

"어떤 경우에도 특정 테넌트 이름으로 **하드코딩 fallback 하지 않는다**" — 미확정 시 빈 문자열 반환. `tenantMatch()` 헬퍼가 Supabase 쿼리용 `{tenant_id}` 조각을 만들어 줍니다.

**주의: working tree에 커밋되지 않은 로컬 변경이 있습니다.** `src/main.ts:292-299` 의 `setupTenant()` 가 서브도메인 파싱 로직 전체를 지우고 `$tenantName` 을 `'tym'` 으로 하드코딩한 상태입니다 (`git diff HEAD -- src/main.ts` 로 확인). HEAD 버전이 정상 로직이며 `VITE_TENANT_OVERRIDE` 도 거기에 있습니다. 이 상태로 설계 판단을 하면 안 됩니다.

### configuration 테이블 (기존 테넌트별 설정 저장소)

`supabase/migrations/20260101_base_schema.sql:215` — **범용 key/value 설정 테이블이 이미 존재합니다**:

```sql
create table if not exists public.configuration (
    key text not null,
    value jsonb null,
    tenant_id text null default public.tenant_id(),
    uuid uuid not null default gen_random_uuid(),
    ...
);
```

현재 저장 중인 key들: `organization`, `proc_map`, `palette_settings`, `pi_flag_types`, 대시보드 탭 설정. upsert는 관용적으로 `{ onConflict: 'key,tenant_id' }` 를 씁니다.

RLS는 `20260403000001_role_based_rls.sql` 및 `20260611_palette_type_settings.sql` 패턴대로 **읽기는 `tenant_id = public.tenant_id()` 인 authenticated 전원, 쓰기는 `public.has_role_at_least('admin')`** 입니다. `piFlagTypes.js` 주석이 이 함정을 지적합니다: "configuration 쓰기는 admin+ 전용(RLS)이라 일반 사용자는 실패할 수 있음".

---

## 4. 기존 기능 on/off 스위치 코드 패턴

### 패턴 A — 테넌트 단위 기능 토글 (가장 가까운 선례)

`palette_settings`. 새 feature flag가 "테넌트 관리자가 UI에서 켜고 끄는" 성격이라면 이걸 그대로 복제하는 게 맞습니다.

- **저장**: `configuration` 테이블, `key='palette_settings'`, `value` 는 `{visibleTaskTypes: [], visibleEventTypes: []}` jsonb
- **백엔드 접근**: `src/components/api/ProcessGPTBackend.ts:9210` `getPaletteSettings()` / `:9229` `savePaletteSettings()` — **서버에 행이 없으면 하드코딩 기본값 반환** (fail-safe 기본값 패턴)
- **인터페이스 선언**: `src/components/api/Backend.ts:166`
- **스토어 캐싱**: `src/stores/taskCatalog.ts:713` `loadPaletteSettings()` — `paletteSettingsLoaded` 가드로 중복 로드 방지, `:1026` `isTaskTypeVisible` 게터로 소비
- **window 미러링**: `taskCatalog.ts:749` — Vue 밖(bpmn-js `PaletteProvider.js` 같은 non-Vue 코드)에서 읽을 수 있도록 `window.$paletteSettings` 로 복사
- **DB 시딩**: `20260611_palette_type_settings.sql` 에서 `FROM public.tenants t CROSS JOIN default_settings` 로 **모든 기존 테넌트에 기본값 백필**

별도의 `palette_task_types` 전용 테이블도 있는데(`is_enabled boolean NOT NULL DEFAULT true`, `display_order`), 이건 "항목 카탈로그 + 개별 enable" 이 필요할 때의 정규화된 변형입니다.

### 패턴 B — 서버 우선 + localStorage 레거시 마이그레이션

`/home/kimsanghoon/process-gpt-vue3/src/utils/piFlagTypes.js`. 전체가 하나의 참고 템플릿입니다: `configuration` key 상수 + `DEFAULT_*` 배열 + `normalizeItem()` 정규화 + soft delete (`deletedAt`/`deletedBy`) + `window.dispatchEvent(new Event('pi-flag-types-changed'))` 변경 브로드캐스트. 각 항목에 `active: it?.active !== false` 형태의 **기본 true 불리언 토글**이 들어 있습니다.

### 패턴 C — 사용자 단위 localStorage 토글

기능 플래그성 키는 4개뿐입니다:
- `isDevMode` — `src/components/UIDefinitionChat.vue:240` (`=== 'true'` 비교, 템플릿 `v-if="dev.isDevMode"`)
- `isUseDataSource` — `ConnectionInfoTab.vue:344` 가 v-switch로 토글, `ProcessDefinitionChat.vue:606` 이 소비. 미설정 시 기본 `true`
- `separatePanel`, `useCache`

나머지 localStorage 키(`email`, `uid`, `userName`, `isAdmin`, `role`, `accessToken`, `tenantId` 등)는 전부 세션/신원 데이터지 플래그가 아닙니다. **sessionStorage 기반 플래그는 없습니다.**

### 패턴 D — 백엔드 메서드 자체가 불리언 스위치

`enableRework`. `Backend` 인터페이스의 async 메서드로 선언되고, `UEngineBackend.ts:106` 은 `false` 고정 반환, `ProcessGPTBackend.ts:8153` 은 실제 판정. `BackendFactory.ts:38` 의 `defaultFor()` 에 `enableRework: false` 가 등록되어 있어 **미구현 백엔드에서도 크래시 없이 off로 폴백**됩니다. 모드별로 기능 유무가 갈리는 플래그에 적합합니다.

---

## 설계 시 참고할 결론

새 플래그의 성격별로 붙일 자리가 다릅니다:

- **배포 단위 on/off** → `palMode.ts` 복제 + `main.ts` 최상단 import + `run.sh:21` 주입 목록 추가 (누락하면 런타임 토글 불가) + `.env.example` 문서화
- **테넌트 단위 on/off** → `configuration` 테이블 신규 key + `Backend.ts` 인터페이스 + 4개 백엔드 구현 + pinia 스토어 `*Loaded` 가드 캐싱 + 마이그레이션 CROSS JOIN 백필
- **사용자 단위 on/off** → localStorage `=== 'true'` 패턴

전역 플래그는 예외 없이 `Object.defineProperty(window, '$X', { writable: false, configurable: false })` 로 동결하고 `env.d.ts` 또는 `main.ts:206-220` 의 `declare global { interface Window }` 블록에 타입을 추가하는 관례입니다. 다만 `env.d.ts` 에 `ImportMetaEnv` 인터페이스가 없어 env 변수는 타입 체크를 못 받고 있으니, 새 체계를 만들면서 이걸 같이 도입하면 `PROCESS_GPT_OFFICE_MCP_URL` 같은 접두사 누락 버그를 컴파일타임에 잡을 수 있습니다.</result>
<usage><subagent_tokens>73602</subagent_tokens><tool_uses>39</tool_uses><duration_ms>203854</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-04T00:57:49.076Z (backfill)

```text
<task-notification>
<task-id>ada1caab8980efe5e</task-id>
<tool-use-id>toolu_013dnChTGuwA62hTAgU1ZoC3</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/ada1caab8980efe5e.output</output-file>
<status>completed</status>
<summary>Agent "메뉴·라우팅 구조 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>조사 완료. 아래에 전체 인벤토리를 정리했습니다.

---

# 1. 모드/플래그 시스템 (가장 중요 — feature flag 설계 기반)

현재 이 프로젝트에는 **4개의 서로 다른 "모드" 축**이 있고, 각각 구현 방식이 다릅니다.

| 플래그 | 전역 변수 | 정의 위치 | 소스 | 비고 |
|---|---|---|---|---|
| **PAL 모드** | `window.$pal` | `/home/kimsanghoon/process-gpt-vue3/src/palMode.ts:3-11` | `window._env_.VITE_PAL_MODE` (런타임) \|\| `import.meta.env.VITE_PAL_MODE` (빌드) | `Object.defineProperty`로 **writable:false, configurable:false** — 런타임 토글 불가. `main.ts:8`에서 라우터보다 먼저 import |
| **GS 모드** | (전역 없음) `isGsMode` 지역변수 | `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts:3` | `window._env_.VITE_GS_MODE` \|\| `import.meta.env.VITE_GS_MODE` | 라우트 필터링 전용 |
| **GS 모드 (UI측)** | `window.$gs` | **어디에도 할당되지 않음** | — | ⚠️ 11개 파일이 `window.$gs`를 읽지만(예: `VerticalSidebar.vue:557`) 실제 대입 코드가 src 전체에 없음 → 항상 `undefined`(falsy). 사실상 죽은 플래그 |
| **엔진 모드** | `window.$mode` | `/home/kimsanghoon/process-gpt-vue3/src/main.ts:240-245` | `window._env_.VITE_MODE` \|\| `import.meta.env.VITE_MODE` \|\| `'ProcessGPT'` | 값: `'ProcessGPT'` / `'uEngine'` |
| **JMS 모드** | `window.$jms` | `/home/kimsanghoon/process-gpt-vue3/src/main.ts:247-251` | **하드코딩 `false`** | 사실상 죽은 플래그 |
| 테넌트 서버 | `window.$isTenantServer` | `/home/kimsanghoon/process-gpt-vue3/src/main.ts:290` | 서브도메인 판정 | |

**런타임 주입 경로**: `/home/kimsanghoon/process-gpt-vue3/run.sh:19-32` 가 `index.html`의 `&lt;head&gt;`에 `window._env_ = {...}`를 sed로 삽입.
⚠️ **`run.sh`는 `VITE_PAL_MODE`를 주입하지 않습니다** (`VITE_GS_MODE`, `VITE_MODE` 등만). 즉 PAL 모드는 현재 **빌드타임 전용**입니다. `.env.example:3`에 `VITE_PAL_MODE=false`.

**localStorage 기반 권한 플래그**: `localStorage.getItem('isAdmin')` — `VerticalSidebar.vue:569-572` (computed `isAdmin`), `VerticalSidebar.vue:584-592`에서 `localStorageChange` 커스텀 이벤트로 사이드바 재빌드.

---

# 2. 라우트 전체 표

## 2-1. MainRoutes (`/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts`) — `FullLayout.vue` 하위, `meta.requiresAuth: true`

| 경로 | 라우트 name | 뷰 파일 | 사이드바 메뉴명 (한/영) | 표시 조건 |
|---|---|---|---|---|
| `/todolist` | Todolist | `components/apps/todolist/TodolistCard.vue` | (사이드바 미노출; `MENU_DEFINITIONS`엔 "내 할일"/admin) | GS 제외 X |
| `/calendar` | Calendar | `views/apps/calendar/Calendar.vue` | — | **GS 모드 제외** |
| `/todolist/:taskId` | WorkItem | `components/apps/todolist/WorkItem.vue` | — | |
| `/instance-toplist` | InstanceTopList | `components/apps/instance-classifier/InstanceTopList.vue` | 요청 Top List (하드코딩 한글) | 분석 섹션, `!gs` |
| `/system` | System | `components/ui/SystemList.vue` | 시스템 정의 / System Definition | PAL이면 `/systems`로 redirect |
| `/instancelist/:instId` | InstanceCard | `components/apps/todolist/InstanceCard.vue` | — | |
| `/instance-viewer/:instId` | InstanceHistoryViewer | `components/apps/todolist/InstanceHistoryViewer.vue` | — | **GS 제외** |
| `/project/:projectId` | Project | `components/apps/todolist/ProjectCard.vue` | — | |
| `/instancelist/running` | InstanceRunning | `components/ProcessInstanceRunning.vue` | — | |
| `/list-pages/completed` | Completed Page | `components/ui/list-pages/CompletedListPage.vue` | 완료된 인스턴스 목록 보기 / View completed instance list | `!pal &amp;&amp; !JMS` + 완료 인스턴스 존재 시 (`checkCompletedInstances`) |
| `/chats` | Chats | `views/apps/chat/Chats.vue` | — | **GS 제외** |
| `/chat` | Chat Room | `views/chat/ChatRoomPage.vue` | — | **GS 제외** |
| `/proposals` | Proposals | `views/apps/proposal/Proposals.vue` | — | **GS 제외** |
| `/organization` | organization | PAL: `views/organization/OrganizationChartView.vue` / 비PAL: `components/OrganizationChartChat.vue` | 조직도 (PAL, 하드코딩) / 조직도 및 에이전트 관리 (비PAL) | **컴포넌트 자체가 PAL 분기** (`MainRoutes.ts:96-97`) |
| `/organization-before` | organization-before | PAL: `views/organization/OrganizationChartBeforeView.vue` | (사이드바 미노출) | **`beforeEnter` 가드**: 비PAL → `/organization` 리다이렉트 (`MainRoutes.ts:106-109`) |
| `/definitions-tree` | definitions-with-tree | `components/ProcessDefinitionChatWithTree.vue` | — | |
| `/definitions/:pathMatch(.*)*` | definitions | `components/ProcessDefinitionChat.vue` | 프로세스 정의 / Process Definition | `isAdmin &amp;&amp; !pal` |
| `/forms/:pathMatch(.*)*` | forms | `components/ProcessDefinitionChat.vue` | — | |
| `/ui-definitions/chat`, `/ui-definitions/*` | ui-definitions | `components/UIDefinitionChat.vue` | 화면 정의 / Screen Definition | ProcessGPT·PAL 모드에서 **필터 제거** (`VerticalSidebar.vue:729-745`) |
| `/dmn/chat`, `/dmn/*` | dmn | `components/DmnChat.vue` | — | |
| `/definition-map` | Definition Map | `components/apps/definition-map/ProcessDefinitionMap.vue` | 프로세스 정의 체계도 / Process Definition Map (로고 옆 아이콘) | `!pal &amp;&amp; isAdmin` (`VerticalSidebar.vue:41`) |
| `/definition-map/mega/:id` | Mega Process Detail | 동일 | — | |
| `/definition-map/major/:id` | Major Process Detail | 동일 | — | |
| `/definition-map/sub/:pathMatch(.+)` | Sub Process Detail | 동일 | — | |
| `/admin` | Admin | `components/ui/Admin.vue` | — | |
| `/admin/:id` | Admin Detail | `components/ui/AdminDetail.vue` | — | |
| `/admin/task-catalog` | TaskCatalogAdmin | `components/admin/TaskCatalogAdmin.vue` | — | **GS 제외**. ⚠️ 중복 정의 (`:153-166`, `:429-433`) |
| `/dashboard` | dashboard | PAL: `views/dashboard/dashboard2-pal.vue` / 비PAL: `views/dashboard/dashboard2.vue` | — | **컴포넌트 PAL 분기** (`MainRoutes.ts:188`) |
| `/account-settings` | Account Setting | `views/pages/account-settings/AccountSettings.vue` | (헤더 메뉴) | |
| `/knowledge` | Knowledge Base | `views/knowledge/KnowledgeBasePage.vue` | — | |
| `/skills` | Skills Management | `components/SkillsManagement.vue` | 스킬 / Skills | **GS 제외**, `mode!=='uEngine' &amp;&amp; !gs &amp;&amp; isAdmin &amp;&amp; !pal` |
| `/skills/:id` | Skill Detail | `components/SkillDetail.vue` | — | **GS 제외** |
| `/bscard` | BSCard | `components/ui/BSCard.vue` | (주석처리됨) | **GS 제외** |
| `/business-rule` | Business Rules | `components/business-rules/BusinessRuleDefinitions.vue` | 룰 정의(비즈니스 규칙) / Rule Definition | **GS 제외**, `isUEngineMode &amp;&amp; !pal` (`VerticalSidebar.vue:686`) |
| `/business-rule/new` | Business Rules New | 동일 | — | **GS 제외** |
| `/business-rule/:ruleId` | Business Rules Detail | 동일 | — | **GS 제외** |
| `/schedule` | Schedule | `components/scheduler/ScheduleList.vue` | — | **GS 제외** |
| `/agent-chat/:id` | Agent Chat | `components/AgentChat.vue` | — | **GS 제외** |
| `/api/test` | API Test | `components/TestPage.vue` | — | |
| `/process-architecture` | Process Architecture | `views/process-architecture/ProcessArchitecture.vue` | 프로세스 체계도 / Process Architecture | PAL 프로세스 섹션. **PAL 로그인 후 기본 랜딩** |
| `/process-hierarchy` | Process Hierarchy | `views/process-hierarchy/ProcessHierarchy.vue` | — | |
| `/version-comparison` | Version Comparison | `views/process-hierarchy/VersionComparison.vue` | 버전 비교 / Version Comparison | PAL 프로세스 섹션 |
| `/analytics` | Analytics Dashboard | `views/analytics/Dashboard.vue` | 대시보드 / Dashboard | **GS 제외**, 비PAL 분석 섹션 |
| `/analytics/heatmap` | Heatmap | `views/analytics/BottleneckAnalysis.vue` | Heatmap | **GS 제외**, 비PAL |
| `/analytics/kpi` | KPI Dashboard | `views/analytics/KPIDashboard.vue` | KPI &amp; 진도 관리 / KPI &amp; Progress | 비PAL |
| `/analytics/pi-flags` | PI Flag Board | `views/analytics/PiFlagBoard.vue` | PI Flag | 비PAL |
| `/strategy-board` | Strategy Board | `views/strategy/StrategyBoard.vue` | Strategy Board | 비PAL |
| `/analytics/ontology` | Ontology Explorer | `views/strategy/OntologyExplorer.vue` | 온톨로지 / Ontology | **GS 제외**, 비PAL. ⚠️ name 중복(`/ontology-explorer`와 동일 name) |
| `/strategy/surveys/:requestId` | Survey Response | `views/strategy/SurveyResponse.vue` | — | |
| `/review-board` | Review Board | `views/review-board/ProcessReviewBoard.vue` | 프로세스 리뷰 보드 / Process Review Board | 모든 모드 프로세스 섹션 |
| `/review-board/:reviewId` | Review Detail | `views/review-board/ProcessReviewDetail.vue` | — | |
| `/my-inbox` | My Inbox | `views/review-board/MyInbox.vue` | 내 수신함 / My Inbox | **비PAL 전용** (`VerticalSidebar.vue:806-814`) |

### PAL 전용 라우트 (`window.$pal` 스프레드 배열 — `MainRoutes.ts:446-605`)
이 블록은 **PAL이 아니면 라우트 자체가 등록되지 않음** (404).

| 경로 | name | 뷰 파일 | 사이드바 |
|---|---|---|---|
| `/process-hierarchy/process_management` | Process Hierarchy Legacy | `views/process-hierarchy/ProcessHierarchy.vue` | — |
| `/analysis-dashboard` | Analysis Dashboard | `views/analytics/AnalysisDashboard.vue` | 분석 대시보드 (PAL 분석) |
| `/ontology-explorer` | Ontology Explorer | `views/ontology-explorer/OntologyExplorer.vue` | 온톨로지 익스플로러 (PAL 분석) |
| `/ontology-explorer-new` | Ontology Explorer New | `views/ontology-explorer-new/OntologyExplorerNew.vue` | (메뉴 정의 주석처리) |
| `/systems` | SystemManagement | `views/system-management/SystemManagement.vue` | 시스템 관리 (hiddenInSidebar, owner) |
| `/system` → `/systems` | (redirect) | — | — |
| `/external-api-health` | ExternalApiHealth | `views/system-management/ExternalApiHealth.vue` | api 연동 상태 (hidden, admin) |
| `/policy-document` | Policy Document Manager | `views/policy-document/PolicyDocumentManager.vue` | 사내 정책문서 (PAL 관리자) |
| `/call-activity-management` | Process Module Management | `views/admin/tabs/CallActivityManagement.vue` | 프로세스 리스트 (**PAL 전용**, owner) |
| `/work-assignment` | WorkAssignment | `views/work-assignment/WorkAssignment.vue` | 업무분장 (PAL 관리자) |
| `/admin-console` (+children) | Admin Console | `views/admin/AdminConsoleLayout.vue` | → 아래 4장 |
| `/review-board/restructure` | Restructure Approval Board | `views/review-board/RestructureApprovalBoard.vue` | — |
| `/review-board-debug` | Review Board Submission Debug | `views/review-board/ReviewBoardSubmissionDebug.vue` | — |

### GS 모드 제외 라우트 목록
`MainRoutes.ts:5-23` `gsExcludedRoutes` 배열 — name 기준 필터링. 필터 적용은 `MainRoutes.ts:684`:
```ts
children: isGsMode ? allRoutes.filter((route) =&gt; !gsExcludedRoutes.includes(route.name as string)) : allRoutes
```
⚠️ `'Analytics Dashboard'`가 배열에 있는데 실제 name은 `'Analytics Dashboard'`이고, `'Ontology Explorer'`는 2곳(PAL/일반) 모두 제거됨.

## 2-2. AuthRoutes (`/home/kimsanghoon/process-gpt-vue3/src/router/AuthRoutes.ts`) — `BlankLayout.vue`, `requiresAuth: false`

| 경로 | name | 뷰 파일 |
|---|---|---|
| `/` | Landing Page | `views/pages/landingpage/index.vue` |
| `/auth/login` | Side Login | `views/authentication/SideLogin.vue` |
| `/auth/register` | Side Register | `views/authentication/SideRegister.vue` |
| `/auth/forgot-password` | Side Forgot Password | `views/authentication/SideForgotPassword.vue` |
| `/auth/reset-password` | Side Reset Password | `views/authentication/SideResetPassword.vue` |
| `/auth/initial-setting` | Side Initial Setting | `views/authentication/SideInitialSetting.vue` |

## 2-3. TenantRoutes (`/home/kimsanghoon/process-gpt-vue3/src/router/TenantRoutes.ts`)

| 경로 | name | 뷰 파일 |
|---|---|---|
| `/tenant/register` | Side Register For Tenant | `views/authentication/SideRegister.vue` |
| `/tenant/manage` | Tenant Manage | `components/tenant/TenantManagePage.vue` |
| `/tenant/create` | Tenant Create | `components/tenant/TenantCreatePage.vue` |
| `/tenant/edit/:tenantId` | Tenant Edit | `components/tenant/TenantEditPage.vue` |

## 2-4. 최상위 라우트 (`/home/kimsanghoon/process-gpt-vue3/src/router/index.ts:34-102`) — 레이아웃 없음

| 경로 | name | 뷰 파일 | 비고 |
|---|---|---|---|
| `/external-forms/:formId` | External Forms | `components/ui/ExternalForms.vue` | 외부 고객용, 가드 통과 |
| `/design-system` | Design System | `views/ds/DesignSystem.vue` | |
| `/design-system/login` | Design System Login Preview | `views/authentication/SideLogin.vue` | |
| `/bpmn-auto-layout-e2e` | BPMN Auto Layout E2E | `views/e2e/BpmnAutoLayoutE2E.vue` | E2E 테스트용 |
| `/processgpt-mapper-ui-e2e` | ProcessGPT Mapper UI E2E | `views/e2e/ProcessGptMapperUiE2E.vue` | |
| `/processgpt-callactivity-form-mapping-e2e` | ProcessGPT CallActivity Form Mapping E2E | `views/e2e/ProcessGptCallActivityFormMappingE2E.vue` | |
| `/markdown-editor` | Markdown Editor | `views/markdown/MarkdownEditor.vue` | |
| `/instance-classifier-demo` | Instance Classifier Demo | `views/demo/InstanceClassifierDemo.vue` | 공개 데모(인증 불필요) |
| `/slide-editor` | Slide | `views/markdown/SlideEditor.vue` | |
| `/present` | presentation | `views/markdown/SlidePresentation.vue` | query props |
| `/:pathMatch(.*)*` | (catch-all) | `views/authentication/Error.vue` | 404 |

---

# 3. 사이드바 메뉴 데이터 구조

**파일**: `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/vertical-sidebar/VerticalSidebar.vue` (1200+줄, Options API)

메뉴는 **단일 배열이 아니라 6개의 개별 `data` 배열**로 흩어져 있고, `loadSidebar(isAdmin)` 메서드(`:676`)에서 명령형으로 채웁니다. 항목 shape은 `{ title, icon, BgColor, to, disable, size?, type?, header? }`.

| 배열/블록 | 선언 | 채워지는 곳 | 렌더 위치 | 표시 조건 |
|---|---|---|---|---|
| `sidebarItem` | `:514` | **아무 데도 없음 (항상 빈 배열)** | `:87-95` | ⚠️ NavGroup/NavCollapse/NavItem 루프 전체가 죽은 코드 |
| `definitionItem` | `:517` | `:680-745` | `:238-323` | `isAdmin &amp;&amp; !pal` |
| `processSectionListItems` / `processSectionDropdownItems` | `:521-522` | `:818-832` | `:246-318` | `isAdmin`, 드롭다운은 `mode !== 'ProcessGPT'` |
| `instanceItem` | `:515` | `:749-760` | `:133-141` | `!pal &amp;&amp; !JMS` |
| `organizationItem` | `:516` | `:761-769` | `:164-172` | `mode!=='uEngine' &amp;&amp; isAdmin &amp;&amp; !pal` |
| `processItem` | `:520` | `:774-815` | `:215-235` | **`pal` 전용 렌더** (비PAL에선 채워지지만 표시 안 됨) |
| `analyticsItem` | `:523` | `:835-906` (비PAL) / `:909-926` (PAL 덮어쓰기) | `:382-402` | `analyticsItem.length &gt; 0 &amp;&amp; !gs` |
| **PAL 관리자 메뉴** | — | **템플릿 인라인 리터럴** `:354-366` | `:350-379` | `pal &amp;&amp; isAdmin` |
| 조직도 (PAL) | — | 템플릿 인라인 | `:404-415` | `pal` |
| 정의 목록 트리 | `definitionList` `:518` | `getDefinitionList()` (백엔드) | `:325-348` | `isAdmin &amp;&amp; !pal` |
| 대화목록 `ChatList` | — | 컴포넌트 | `:125` | `!gs &amp;&amp; !pal` |
| 인스턴스 목록 | — | `ProcessInstanceList` | `:128-144` | `isShowInstances` = `!pal &amp;&amp; !JMS` (`:560-565`) |
| 에이전트 목록 | — | `AgentList` | `:147-178` | `mode!=='uEngine' &amp;&amp; isAdmin &amp;&amp; !pal` |
| 사람 동료 | — | `SidebarUserList` | `:181-193` | `mode!=='uEngine' &amp;&amp; !gs &amp;&amp; !pal` |
| 스킬 목록 | — | `SkillList` | `:196-212` | `mode!=='uEngine' &amp;&amp; !gs &amp;&amp; isAdmin &amp;&amp; !pal` |

**PAL 관리자 메뉴 (하드코딩 인라인, `VerticalSidebar.vue:354-366`)** — 11개:
속성 스키마, 수정 잠금, 휴지통, 시스템 운영, KPI 목표, 사용 활성도, 감사 로그, PI Flag, Task 종류 설정, 업무분장, 사내 정책문서

**PAL 분석 메뉴 (`:910-925`)** — 2개: 분석 대시보드(`/analysis-dashboard`), 온톨로지 익스플로러(`/ontology-explorer`)

---

# 4. 권한 시스템 (`src/utils/`)

## 4-1. `/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts` — **선언적 메뉴 SSOT (단, 현재 미연결)**

`MENU_DEFINITIONS: MenuDefinition[]` (`:61-308`) — feature flag 설계에 **가장 이상적인 기존 자산**입니다.

```ts
interface MenuDefinition {
  path: string;            // 라우트 경로 ('' 이면 action 메뉴)
  label: string;           // 한글 라벨
  section: 'process'|'analytics'|'admin'|'notice'|'request';
  icon: string;
  requiredRole: RoleType;  // 코드 기본값
  minRole?: RoleType;      // DB override로도 못 내리는 하한 (RLS 대응)
  hiddenInSidebar?: boolean;
  action?: string;
  excludeFromMatrix?: boolean;
}
```

파생 맵: `ROUTE_REQUIRED_ROLES` (`:314`), `ROUTE_MIN_ROLES` (`:322`)
룩업 함수: `matchByPath()` (`:327`, 정확일치→최장 prefix), `lookupMinRole()` (`:342`), `lookupRequiredRole()` (`:358`)

권한 판정 순서 (`:358-369`): **DB override(`menu_role_overrides`) → 코드 기본값 → null**, 어느 쪽이든 `minRole`로 clamp.

⚠️ **중요 불일치**: 파일 주석은 "VerticalSidebar.vue, RoleMenuMatrix.vue, 라우터 가드 모두 이 모듈에서 import"라 하지만, 실제 import는 **2곳뿐**:
- `src/utils/customPermissions.ts:4`
- `src/views/admin/AdminConsoleLayout.vue:23`

`VerticalSidebar.vue`도, `router/index.ts` 가드도 **이 파일을 전혀 쓰지 않습니다.** `RoleMenuMatrix.vue` 파일 자체가 존재하지 않습니다.

또한 `MENU_DEFINITIONS`에만 있고 **라우트가 없는 유령 경로 5개** (접근 시 404):
`/admin-console/signup-approvals`(:218), `/admin-console/admin-requests`(:227), `/admin-console/suppliers`(:235), `/admin-console/organization-dmn-rules`(:242), `/admin-request`(:301)

## 4-2. `/home/kimsanghoon/process-gpt-vue3/src/utils/roles.ts` — RBAC 계층
`admin(100) &gt; owner(80) &gt; editor(60) &gt; reviewer(40) &gt; viewer(20)`. `ROLE_META`(`:33`)에 한/영 라벨·색·설명. `hasRoleAtLeast()`(`:100`), `resolveRole(isAdmin, role)`(`:85`).

## 4-3. `/home/kimsanghoon/process-gpt-vue3/src/utils/authClaims.ts` (334줄)
Supabase JWT claims에서 role 추출 (`user_role` → `membership_role` → `role`, `app_metadata` fallback). localStorage `isAdmin`/`role` fallback (`:44-45`). `canEnterAdminConsole()` (`:312`) = `isAdmin || adminViewer`.

## 4-4. `/home/kimsanghoon/process-gpt-vue3/src/utils/customPermissions.ts` (145줄)
Supabase `permissions` 테이블(id/name/label/api_path/verb) + `users.permission_ids`. `canAccess({requiredRole, permissionName, verb, apiPath})` (`:129-143`) — RBAC OR custom permission, 단 `minRole` 미만이면 custom permission으로도 불가.

## 4-5. `/home/kimsanghoon/process-gpt-vue3/src/utils/menuRoleOverrides.ts` (87줄)
Supabase `menu_role_overrides` 테이블 (`menu_path` → `required_role`, tenant별) 메모리 캐시. `loadMenuRoleOverrides()`, `getMenuOverrideRole(path)`.

---

# 5. 라우트 가드

## 5-1. 글로벌 `router.beforeEach` — `/home/kimsanghoon/process-gpt-vue3/src/router/index.ts:117-180`
1. `hasRouterError` 리셋 (`:120-123`)
2. 비밀번호 재설정(recovery hash) 중 `/tenant/*` 이동 차단 (`:126-131`)
3. **PAL 모드 루트 리다이렉트** (`:136-141`) — `window.$pal &amp;&amp; to.path === '/'` 이면 Supabase 세션 확인 후 로그인시 `/process-architecture`, 아니면 `/auth/login`
4. `window.$mode !== 'uEngine'` 일 때 (`:143-172`): `/auth`·`/external-forms`는 통과 / `$isTenantServer`면 `/tenant/manage` 강제 / 아니면 `/tenant/*` 접근 차단

**중요**: 이 가드에는 **역할/권한 체크가 전혀 없습니다.** `requiresAuth` meta도 선언만 되고 소비되지 않습니다 (grep 결과 정의 3곳뿐, 읽는 곳 0).

## 5-2. 라우트별 `beforeEnter` — 단 1개
`MainRoutes.ts:106-109` — `/organization-before`, PAL 아니면 `/organization`으로.

## 5-3. 컴포넌트 레벨 가드 — 단 1개
`AdminConsoleLayout.vue:31-36` — `canEnterAdminConsole() || canAccess({apiPath: route.path, verb: 'GET'})`, 실패 시 `NoAccessView` 렌더 (라우팅은 성공, 화면만 차단).

## 5-4. `router.onError` — `index.ts:183-211`
동적 import 실패 시 스낵바 + 2초 후 `window.location.reload()`.

---

# 6. 관리자 콘솔 탭 목록

**레이아웃**: `/home/kimsanghoon/process-gpt-vue3/src/views/admin/AdminConsoleLayout.vue` — 탭 UI 없이 `&lt;router-view /&gt;`만 렌더. 탭 전환은 **사이드바 링크**로 수행 (`VerticalSidebar.vue:354-366`). `isPalMode`로 높이만 조정 (`:27`, `calc(100vh - 40px)` vs `140px`).

**라우트 정의**: `MainRoutes.ts:497-603` (PAL 전용). `redirect: '/admin-console/property-schemas'`. 각 child `meta: { adminTitle, adminDescription }` (i18n 키 또는 한글 리터럴 혼재).

| # | 자식 경로 | 라우트 name | 뷰 파일 | 사이드바 | 권한(MENU_DEF) | 기능 요약 |
|---|---|---|---|---|---|---|
| 1 | `property-schemas` | Admin Property Schemas | `tabs/PropertySchemaStudio.vue` (131KB) | 속성 스키마 | admin | BPMN 속성패널 입력 필드를 그룹 단위로 정의, 태스크 유형별 표시 미리보기, JSON 가져오기/내보내기 |
| 2 | `data-freeze` | Admin Data Freeze | `tabs/DataFreezeManager.vue` | 수정 잠금 | admin | 프로세스 수정 잠금(freeze) 관리, scope 토글 |
| 3 | `recycle-bin` | Admin Recycle Bin | `tabs/RecycleBin.vue` | 휴지통 | admin | 삭제 항목 복원/영구삭제, 다중 선택 |
| 4 | `system-operations` | Admin System Operations | `tabs/SystemOperations.vue` (48KB) | 시스템 운영 | admin | 전역 공지 배너(GlobalNoticeBanner) 등 다중 섹션 시스템 운영 |
| 5 | `kpi-targets` | Admin KPI Targets | `tabs/KpiIndicatorManager.vue` | KPI 목표 | admin | 지표명·단위·측정주기·운영정의·산출식 기반 KPI 목표 관리 |
| 6 | `usage-adoption` | Admin Usage Adoption | `tabs/UsageAdoptionDashboard.vue` | 사용 활성도 | admin | 소속별 접속, BPMN 조회/편집, 사용자 기여도, 재방문 흐름 (`app_usage_events`, PAL 전용 수집 — `main.ts:384-385`) |
| 7 | `audit-trail` | Admin Audit Trail | `tabs/AuditTrail.vue` (55KB) | 감사 로그 | admin | 감사 로그 조회 + CSV 다운로드 |
| 8 | `exec-instances` | Admin Exec Instances | `tabs/ExecInstanceAdmin.vue` | (hiddenInSidebar) | admin | 테넌트 전체 프로세스 인스턴스 참여자 제한 없이 조회 |
| 9 | `governance-studio` | Admin Governance Studio | `views/governance-studio/DataGovernanceStudio.vue` | (hidden, excludeFromMatrix) | admin | 데이터 거버넌스 스튜디오 |
| 10 | `pi-flags` | Admin PI Flag Board | `tabs/PiFlagPage.vue` | PI Flag | **owner** | 내부 v-tabs: `PiFlagBoard.vue`(50KB, 보드) + `PiFlagTypeManager.vue`(유형 관리) |
| 11 | `task-types` | Admin Task Types | `tabs/TaskTypeManagement.vue` | Task 종류 설정 | admin | `components/admin/TaskTypeSettings.vue` 래퍼 — Task/Event 종류 설정 |

**`tabs/` 폴더에 있으나 admin-console 라우트가 아닌 파일 4개**:
- `CallActivityManagement.vue` — `/call-activity-management` (사이드바 "프로세스 리스트", 프로세스 섹션)
- `KpiTargetManager.vue` (43KB) — 어디에서도 라우트 연결 안 됨 (KpiIndicatorManager로 대체된 구버전)
- `KpiProcessPicker.vue` / `KpiProcessPickerDialog.vue` — KPI 화면 내부 다이얼로그 컴포넌트
- `PiFlagBoard.vue` / `PiFlagTypeManager.vue` — `PiFlagPage.vue` 내부 탭

---

# 7. Feature Flag 설계 관점 요약

**활용 가능한 기존 자산**
- `src/utils/routePermissions.ts` `MENU_DEFINITIONS` — 이미 선언적 메뉴 인벤토리 구조(path/label/section/icon/role/hidden/action)를 갖췄고 DB override 계층까지 있음. 여기에 `feature?: string` 또는 `enabledWhen?: (ctx) =&gt; boolean` 필드를 추가하는 것이 최소 변경 경로.
- `menu_role_overrides` 테이블 패턴 — feature flag도 동일하게 tenant별 DB 오버라이드 캐시 방식 재사용 가능.

**정리가 필요한 부채**
1. 사이드바가 `MENU_DEFINITIONS`를 안 씀 → 메뉴 정의가 `VerticalSidebar.vue` 명령형 코드 + 템플릿 인라인 리터럴에 3중 분산.
2. 라우터 가드에 role 체크 부재 → URL 직접 입력으로 대부분 페이지 진입 가능 (AdminConsole만 컴포넌트 레벨 차단).
3. `window.$gs`, `window.$jms` 는 실질적으로 죽은 플래그(할당 없음 / 하드코딩 false).
4. `sidebarItem` 배열과 NavGroup/NavCollapse/NavItem 렌더 루프(`VerticalSidebar.vue:87-95`)는 완전한 죽은 코드.
5. 모드 분기 방식이 3종 혼재: ① 라우트 등록 자체 제외(PAL 스프레드), ② name 기반 필터(GS), ③ 컴포넌트 동적 선택(`/organization`, `/dashboard`).
6. PAL 플래그는 `run.sh`에 주입 로직이 없어 빌드타임 전용이며, `Object.defineProperty(writable:false)`라 런타임 토글 불가.
7. `MENU_DEFINITIONS`의 유령 경로 5개(라우트 미존재)와 라우트 name 중복 2건(`TaskCatalogAdmin`, `Ontology Explorer`, `ui-definitions`, `dmn`).</result>
<usage><subagent_tokens>86881</subagent_tokens><tool_uses>43</tool_uses><duration_ms>265594</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-04T00:58:04.390Z (backfill)

```text
<task-notification>
<task-id>a230220aa67efc833</task-id>
<tool-use-id>toolu_018tmrMisRtUATE65JAaKCiF</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/a230220aa67efc833.output</output-file>
<status>completed</status>
<summary>Agent "주요 페이지 기능 인벤토리" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result># src/views 기능 인벤토리 (feature flag 설계용)

## 0. 전제: 이미 존재하는 3가지 "끄기" 메커니즘

플래그 설계 시 새로 만들기 전에 반드시 봐야 할 기존 축입니다.

| 축 | 위치 | 동작 |
|---|---|---|
| `window.$pal` (PAL 모드) | `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts` (2개의 `...(window.$pal ? [...] : [])` 블록), `src/palMode.ts` | PAL 전용 라우트 묶음(분석 대시보드, 온톨로지, 시스템관리, 정책문서, 업무분장, Admin Console 전체, 재구성 승인보드)을 통째로 등록/미등록. `/organization`, `/dashboard`는 PAL 여부로 **다른 컴포넌트**를 로드 |
| `VITE_GS_MODE` | `MainRoutes.ts` 상단 `gsExcludedRoutes` 배열 | 라우트 **이름** 리스트로 제외 (Analytics Dashboard, Ontology Explorer, Heatmap, Skills, Business Rules, Chat Room, Chats, Proposals, Calendar, Agent Chat, BSCard, Schedule …). 사실상 이미 있는 feature flag 프로토타입 |
| 역할 기반 메뉴/가드 | `/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts` (`MENU_DEFINITIONS`) | 사이드바 · 라우터 가드 · 권한 매트릭스의 **단일 소스**. `path/label/section/icon/requiredRole/minRole/hiddenInSidebar` 보유. **기능 플래그를 붙일 가장 자연스러운 자리** (이미 `/an-transformation-studio`, `/ontology-explorer-new` 항목이 주석 처리로 "꺼져" 있음) |

사이드바 렌더링은 `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/vertical-sidebar/VerticalSidebar.vue`. 단, PAL 관리자 메뉴 11개는 이 파일 355~365행에 **인라인 배열로 하드코딩**되어 있어 `MENU_DEFINITIONS`를 우회합니다 — 플래그 적용 시 누락되기 쉬운 지점입니다.

---

## 1. 기능 영역별 인벤토리

### A. 프로세스 체계도 (Process Architecture)
- **뷰**: `src/views/process-architecture/` — `ProcessArchitecture.vue`(1954줄, 셸) + 뷰모드 4종 `ProcessArchCardView` / `ProcessArchMatrixView` / `ProcessArchTreeView` / `ProcessArchMermaidView`, `ProcessArchHierarchyView`(1217줄), `ProcessArchRestructureStudio.vue`(재구성 모드), `NewProcessDialog.vue`(1422줄), `AdvancedFilterPanel.vue`
- **한 페이지 안의 복수 기능** (`ProcessArchitecture.vue`):
  1. 뷰모드 전환 (card/matrix/tree/mermaid — `useProcessArchitecture.ts`의 `ViewMode`)
  2. Export 메뉴 (excel/pdf, 범위 visible/full)
  3. **재구성 모드** (`isAdmin` 한정, `showRestructureMode` 토글 → `ProcessArchRestructureStudio`)
  4. 고급 필터 + 필터 프리셋 / 즐겨찾기 / 최근 조회 (localStorage: `process_recently_viewed`, `process_favorites`, `process_filter_presets`)
  5. 신규 프로세스 생성 다이얼로그
  6. 권한 다이얼로그 (`@/components/apps/definition-map/PermissionDialog.vue`)
- **로직 모듈**: `useProcessArchitecture.ts`, `processClassification.ts`, `processIdUtils.ts`, `processMapMove.ts`
- **컴포넌트**: `@/components/ui/ProgressBadge.vue`(4개 뷰 모두), `PermissionDialog.vue`
- **스토어**: `adminConsole`
- **의존성**: → **Process Hierarchy**(핵심. `navigation.ts`의 `buildProcessHierarchyQuery`로 `entry=architecture`), → Admin System Operations(`router.push({name:'Admin System Operations'})`). PAL 로그인 시 기본 랜딩(`router/index.ts`에서 `/` → `/process-architecture`)

### B. 프로세스 계층/편집 스튜디오 (Process Hierarchy) — 최대 덩어리
- **뷰**: `src/views/process-hierarchy/` 전체. `ProcessHierarchy.vue`(5382줄, 셸)가 아래를 조합:

| 하위 패널 | 파일 | 기능 |
|---|---|---|
| 좌: 트리 | `ProcessHierarchyTree.vue` (974) | 프로세스 계층 트리 |
| 중: 디자이너 | `ProcessHierarchyDesigner.vue` (4692) | **BPMN 편집** (`@/components/BpmnUengine.vue`), RACI 매트릭스, OpenUI 렌더러, bpmn 생성/검증 서비스 |
| 우 탭1: 속성 | `ProcessHierarchyProperties.vue` (**12414줄, 최대 파일**) | 속성/거버넌스. PPI·RACI·TaskIO 필드, 스키마 필드, 소유자 설정, 수동링크, **BPMN 리뷰 가이드**, 리뷰 제출 |
| 우 탭2: AI 가이드 | `ProcessHierarchyAIGuide.vue` (2369) | AN 파티션/로드맵/ToBe/GapToPiFlag 생성기, 인텐트 라우터, PI Flag 파서 |
| 우: 팀 채팅 | `@/components/ProcessDefinitionTeamChat.vue` | 협업 채팅 |
| 하: 히스토리 | `ProcessHierarchyHistoryPanel.vue` → `SktVersionComparisonDialog.vue` | 버전 히스토리/비교 |
| 실행 | `ExecInstancePanel.vue`, `StartEventSelectDialog.vue`, `ProcessGPTExecute.vue` | 인스턴스 실행/조회 |
| 파티션 | `PartitionCommitPreviewDialog.vue` | 파티션 커밋 프리뷰 |
| 청사진 | `blueprint/ProcessBlueprintStudio.vue` (+ `AsIsToBeCompare`, `ExecutableProcessView`(1539), `IssueSolutionBoard`, `SolutionOptionCard`, `ToBeRoiPanel`) | AsIs/ToBe 비교, 이슈-솔루션, ROI |
| AN 다이얼로그 | `blueprint/AnOrchestratorDialog.vue`, `AnRoadmapDialog.vue` | → **AN Transformation Studio** 스테이지 임베드 |

- **별도 라우트**: `VersionComparison.vue`(`/version-comparison`, `ProcessHierarchyTree` + `BpmnUengineViewer` 재사용), `ProcessHierarchyOpenButton.vue`(재사용 진입 버튼)
- **스토어**: `bpmn`, `taskCatalog`, `adminConsole`, `customizer`
- **composables**: `@/composables/blueprint/*`(blueprintModel, executableModel, partitionEditing, useBlueprintStudio, useToBeRoi, piFlagParser, piFlagIssueExport), `@/composables/anStudio/*`(useAnStudio, anIntentRouter, bpmnTaskExtractor, callActivityModularizer), `useBpmnExport`
- **의존성**: ← Process Architecture, ← Review Board, ← Analysis Dashboard (`navigation.ts`의 `PROCESS_HIERARCHY_ENTRY = direct|architecture|analysis|review-board`), ← Admin(`CallActivityManagement`, `PropertySchemaStudio`가 `ProcessHierarchyOpenButton` 사용). → Review Board(`$router.push('/review-board/:id')` from Properties), → 인스턴스 목록(`/instancelist/:id` from ExecInstancePanel)

### C. AN 변환 스튜디오 (AN Transformation Studio)
- **뷰**: `src/views/an-transformation-studio/` — `stages/AsIsPartitioningStage.vue`, `ToBeOrchestratorStage.vue`, `RoadmapStage.vue`, `components/AnPartitionCanvas.vue`(커스텀 BPMN 캔버스), `RoiWidget.vue`
- **중요**: **자체 라우트 없음** (`routePermissions.ts` 93행에 주석 처리). 오직 Process Hierarchy의 blueprint 다이얼로그에서만 렌더됨 → **B를 끄면 자동으로 죽고, 단독으로 끄려면 B 내부 진입점(AnOrchestratorDialog/AnRoadmapDialog/ProcessBlueprintStudio)을 꺼야 함**
- **스토어 대신**: `@/composables/anStudio/useAnStudio` (사실상 이 영역의 상태 저장소)

### D. 리뷰 보드 / 승인
- **뷰**: `src/views/review-board/` — `ProcessReviewBoard.vue`(2111), `ProcessReviewDetail.vue`(2358), `MyInbox.vue`(1041), `RestructureApprovalBoard.vue`(PAL), `ReviewBoardSubmissionDebug.vue`(PAL, 디버그), `ReviewBoardCard.vue`(**미참조 — 데드 코드 후보**)
- **핵심 컴포넌트**: `BpmnUengineViewer.vue`(Detail), `ProgressBadge.vue`(Board)
- **스토어**: `adminConsole`. ⚠️ `src/stores/reviewBoard.ts`(366줄)는 `useReviewBoardStore` **소비처 0건 — 데드 스토어**
- **의존성**: → `/review-board/:id`, → `/my-inbox`, → `/review-board-debug`, → Admin System Operations(재구성 승인). ← Process Hierarchy Properties에서 리뷰 제출

### E. Admin Console (PAL 전용)
- **셸**: `src/views/admin/AdminConsoleLayout.vue` — `authClaims` + `customPermissions` 권한 게이트 + `&lt;router-view&gt;`. 자식 탭 11개(각각 독립 라우트, `meta.adminTitle`):
  `PropertySchemaStudio.vue`(2822, 속성 스키마), `DataFreezeManager.vue`(수정 잠금), `RecycleBin.vue`(휴지통), `SystemOperations.vue`(1361, 시스템 운영), `KpiIndicatorManager.vue`/`KpiTargetManager.vue`(+`KpiProcessPicker(.Dialog)`), `UsageAdoptionDashboard.vue`, `AuditTrail.vue`(1524), `ExecInstanceAdmin.vue`, `PiFlagPage.vue`(→`PiFlagBoard.vue`, `PiFlagTypeManager.vue`), `TaskTypeManagement.vue`, 그리고 **다른 디렉토리에서 끌어온** `governance-studio/DataGovernanceStudio.vue`
- **Admin Console 밖의 admin 탭**: `admin/tabs/CallActivityManagement.vue`는 `/call-activity-management` 최상위 라우트로 따로 등록됨(이름 "프로세스 리스트")
- **스토어**: `adminConsole`(1800줄 — 최대 스토어, 13개 뷰가 공유), `taskCatalog`
- **의존성**: PropertySchemaStudio/CallActivityManagement → Process Hierarchy(OpenButton), PiFlagBoard → `/process-architecture`
- ⚠️ **레거시 admin 중복**: `@/components/ui/Admin.vue`(`/admin`), `AdminDetail.vue`(`/admin/:id`), `@/components/admin/TaskCatalogAdmin.vue`(`/admin/task-catalog`, MainRoutes에 **2번 중복 등록**)

### F. 분석 (Analytics)
- **뷰**: `src/views/analytics/`
  - `Dashboard.vue`(1452, `/analytics`) — `olapStore` + `analyticsApi`
  - `AnalysisDashboard.vue`(775, `/analysis-dashboard`, PAL) — **탭 셸**: `tabs/OperationalBoard`(757), `tabs/ExecutiveSummary`(721), `tabs/ProcessAnalytics`, `tabs/GovernanceQuality` 를 `defineAsyncComponent`로 지연 로드 + **Grafana iframe 임베드** + `AnalysisDashboardSettings.vue`
  - `BottleneckAnalysis.vue`(2005, `/analytics/heatmap`) — BPMN 뷰어 위 히트맵
  - `KPIDashboard.vue`(`/analytics/kpi`) — `kpiStore` + `strategyStore`
  - `PiFlagBoard.vue`(`/analytics/pi-flags`)
  - **미라우팅(주석 처리)**: `PivotTablePage.vue`, `NaturalQueryPage.vue`, `Performance.vue` — `cubeStore`/`olapStore` 사용, `@/components/analytics/olap/*` 와만 연결
- **스토어**: `analytics/olapStore`, `analytics/kpiStore`, `analytics/cubeStore`, `analytics/analysisDashboardStore`, `strategy/strategyStore`
- **서비스**: `@/services/analyticsApi`, `dashboardDataService`, `dashboardSettingsService`, `usageAnalytics`

### G. 전략 / 온톨로지
- **뷰**: `src/views/strategy/StrategyBoard.vue`(1790 — 목표/KPI/이니셔티브 탭 3종 + 기여도), `strategy/OntologyExplorer.vue`(943), `strategy/SurveyResponse.vue`(`/strategy/surveys/:requestId`)
- **별도 온톨로지 2종(중복 구현)**:
  - `src/views/ontology-explorer/OntologyExplorer.vue`(905) → `@/components/ontology-explorer/*` (OntologyCanvas2D, AiReasoningConsole, WhatIfSimulatorPanel, DimensionFilterPanel) + `@/composables/ontology/*`
  - `src/views/ontology-explorer-new/OntologyExplorerNew.vue`(530) → `@/components/ontology-explorer-new/*` (NvlCanvas, ImpactTracePanel, NodeDetailPanel…) + `@/composables/ontologyNew/*` — **라우트는 있으나 사이드바에서는 주석 처리됨**
  - `@/components/ui/OntologyGraphViewer.vue`는 또 다른 3번째 구현으로 ChatRoomPage/WorkAssistantChatPanel에서 사용
- **스토어**: `strategy/strategyStore`
- **의존성**: StrategyBoard → `/analytics/ontology`, → Agent Chat. strategy/OntologyExplorer → `/organization`, `/definitions/:id`, `/skills/:name`, `/strategy-board` (**교차 영역 허브 — 끄면 여러 진입 경로 손실**)

### H. 조직도 (Organization)
- **뷰**: `src/views/organization/` — `OrganizationChartView.vue`(1469, PAL 전용) + `OrgTreeNode.vue`(510) + `OrgDetailPanel.vue`(1024) + `orgChartModel.ts`; `OrganizationChartBeforeView.vue`(읽기전용 구버전, URL 직접접근만)
- **비-PAL 대체 구현**: `@/components/OrganizationChartChat.vue` → `@/components/ui/OrganizationChart.vue`(769). **같은 `/organization` 경로에 두 구현**
- **컴포넌트**: `@/components/ui/AgentBadgesDiagram.vue`(1009, 두 구현 모두 사용), `AgentCreateDialog.vue`, `OrganizationEditDialog.vue`
- **스토어**: 없음 (BackendFactory 직접 호출)

### I. 채팅 / 에이전트
- **뷰**: `src/views/chat/ChatRoomPage.vue`(**11513줄, 2위**) — 채팅 + DeepAgent 스트리밍 + HITL + 온톨로지 그래프 + 음성 에이전트 + **아티팩트 패널** + BPMN XML 생성 + 프로세스 정의 임베드 를 한 페이지에 전부 담음
- `src/views/apps/chat/Chats.vue`(1475) + `AssistantChats.vue` + `Attachments.vue` — 구 채팅 UI(`/chats`)
- `src/views/markdown/AgentMonitor.vue`(2005) — 에이전트 모니터링(EventTimeline, BrowserAgent). **`WorkItem.vue`, `AgentChatActions.vue`에서 임베드됨**
- **스토어**: `defaultSetting`
- **서비스**: `AgentRouterService`, `DeepAgentRouterService`, `FixedBaseWorkAssistantAgentService`
- **역참조**: `@/components/AgentChat.vue`가 `ChatRoomPage`를 임포트 (`/agent-chat/:id`)

### J. 마크다운 / 슬라이드 / 문서 산출물
- **뷰**: `src/views/markdown/` — `MarkdownEditor.vue`(955), `SlideEditor.vue`, `SlidePresentation.vue`, `SlideComponent.vue`, `SlideStyler.vue`, `MarkdownParser.vue`, `PdfExportHelper.vue` / `PptxExportHelper.vue` / `WordExportHelper.vue`
- **핵심**: 라우트(`/markdown-editor`, `/slide-editor`, `/present`) 외에 **`@/components/ui/field/MarkdownField.vue`, `ReportField.vue`, `SlideField.vue` 세 폼 필드에서 임베드** → 워크아이템 폼 전반에 파급. 끄면 폼 렌더링이 깨짐

### K. 인증 / 온보딩
- **뷰**: `src/views/authentication/` — 사용 중: `SideLogin`, `SideRegister`(일반/테넌트 겸용), `SideForgotPassword`, `SideResetPassword`, `SideInitialSetting`, `Error.vue`(catch-all 404), `NoAccessView.vue`(AdminConsoleLayout이 사용)
- **주석 처리된 미사용**: `BoxedLogin/BoxedRegister/BoxedForgotPassword/BoxedTwoStep/SideTwoStep/Maintenance`
- **스토어**: `auth`. `authUser.ts`(`useUsersStore`)는 **소비처 0 — 데드 스토어**

### L. 랜딩 / 튜토리얼 / 약관
- `src/views/pages/landingpage/index.vue`(경로 `/`, 비-PAL 전용) + `mainPage/` 하위 섹션 15종 + `tutorial/`(마크다운 11개 문서 로더) + `uengine-image/` 스크린샷 다수
- `src/views/pages/term-policy/Terms.vue`, `Privacy.vue` — 라우트는 주석 처리, `layouts/full/Footer.vue`에서 모달로 사용
- **의존성**: HeroSection → `/auth/login`, HomeView → `/marketplace`, TutorialSection → `/definitions`

### M. 계정 설정 (허브 페이지)
- `src/views/pages/account-settings/AccountSettings.vue`(558) — **15개 탭 컴포넌트를 모으는 최대 허브**: AccountTab, ConnectionInfoTab, DriveTab, GitConfigTab, GlossaryManageTab, KnowledgeFilesTab, MCPEnvSecret, MCPServer, ManageAccessTab, NotificationTab, OrgChartGroupTab, SecurityTab, SkillsTab, + TaskCatalogAdmin/TaskCatalogList
- **탭 단위로 플래그를 걸어야 하는 대표 페이지**. `KnowledgeBasePage.vue`(`/knowledge`)는 `KnowledgeFilesTab` 하나만 감싼 래퍼 → **중복 노출**

### N. 시스템 관리 / 정책문서 / 업무분장 (PAL)
- `src/views/system-management/SystemManagement.vue`(1040, 스토어 `systemManagement`), `ExternalApiHealth.vue`
- `src/views/policy-document/PolicyDocumentManager.vue`(1101, 스토어 `adminConsole`)
- `src/views/work-assignment/WorkAssignment.vue`(1220, `ProgressBadge` 사용)
- `src/views/governance-studio/DataGovernanceStudio.vue` — **전부 하드코딩 목업 데이터**(clusters/patterns가 `ref`에 리터럴). Admin Console 탭으로 노출 중

### O. 데모 / E2E / 데드 코드 (플래그 대상 아님 — 삭제/격리 후보)
- `src/views/e2e/` 3종 — `BpmnAutoLayoutE2E`, `ProcessGptMapperUiE2E`, `ProcessGptCallActivityFormMappingE2E`. **인증 없이 최상위 라우트로 노출됨**
- `src/views/demo/DemoApp.vue`(별도 엔트리 `src/demo-main.ts`), `InstanceClassifierDemo.vue`(`/instance-classifier-demo`, **인증 불필요 공개 라우트**)
- `src/views/ds/DesignSystem.vue`(`/design-system`, 인증 게이트 밖) + `/design-system/login` 프리뷰
- **완전 미참조 템플릿 잔재**: `src/views/charts/*`(7), `src/views/ui-elements/*`(10), `src/views/style-animation/Typography.vue`, `src/views/icons/TablerIcons.vue`, `src/views/forms/*`, `src/views/school-pages/*`, `src/views/apps/{email,contact,kanban,user-profile}/*`, `src/views/apps/calendar/*`(Calendar만 라우트 존재)

---

## 2. 여러 영역에 걸친 대형 재사용 컴포넌트 (플래그 시 최대 파급)

| 컴포넌트 | 줄 | 사용처 (뷰) | 파급 |
|---|---|---|---|
| `src/components/ui/Chat.vue` | **8093** | ChatRoomPage, AgentMonitor, apps/chat/Chats, AssistantChats + 컴포넌트 14곳(DmnChat, ProcessDefinitionChat, UIDefinitionChat, WorkAssistantChatPanel, OrganizationChartChat, FormInterviewChat, BSCard…) | **끄기 불가 수준의 기반 컴포넌트** |
| `src/components/ChatModule.vue` | 1307 | AgentMonitor, Chats, AssistantChats + 컴포넌트 13곳 (designer 패널 포함) | 동일 |
| `src/components/BpmnUengineViewer.vue` | 1662 | ProcessReviewDetail, BottleneckAnalysis, VersionComparison, SktVersionComparisonDialog, blueprint 3종, ToBeOrchestratorStage + 컴포넌트 8곳(WorkItem, InstanceProgress, ProcessGPTExecute, MarketPlace, AdminDetail…) | **읽기전용 BPMN 뷰어 — 리뷰/분석/실행 전 영역 공통** |
| `src/components/BpmnUengine.vue` | 3325 | ProcessHierarchyDesigner, e2e 3종 + `ProcessDefinition.vue`, `ui/field/BpmnUengineField.vue` | **편집용 BPMN 디자이너** |
| `src/components/designer/modeling/ModelCanvas.vue` | **4940** | (간접) `designer/bpmnModeling/BpmnModelCanvas.vue`(2581) ← `ProcessDefinitionChat.vue` ← `/definitions/*` 라우트 | **Process Hierarchy와는 다른 별개 BPMN 디자이너 스택**. `/definitions` 계열 전용 |
| `src/components/designer/mapper/Mapper.vue` | 934 | e2e + designer 패널 10종(UserTask/ServiceTask/SendTask/ReceiveTask/BusinessRule/CallActivity…) | 데이터 매핑 — designer 스택 전반 |
| `src/components/ui/EventTimeline.vue` | 3016 | AgentMonitor **단독** | 격리 용이 |
| `src/components/ui/AgentBadgesDiagram.vue` | 1009 | OrganizationChartView + `ui/OrganizationChart.vue` | 조직도 양쪽 구현 공통 |
| `src/components/ui/ProgressBadge.vue` | 278 | ProcessArch 4뷰 + ProcessHierarchyDesigner + ProcessReviewBoard + WorkAssignment | 소형이지만 교차 영역 |
| `src/components/ui/SchemaFieldInput.vue` | 864 | PropertySchemaStudio ↔ ProcessHierarchyProperties | **Admin ↔ Hierarchy 결합점** |
| `src/components/ui/OntologyGraphViewer.vue` | 573 | ChatRoomPage, WorkAssistantChatPanel | 채팅 안의 온톨로지 |
| `src/components/designer/RaciMatrixDialog.vue` | — | ProcessHierarchyDesigner, `ProcessDefinition.vue` | 두 디자이너 스택 공통 |
| `src/views/markdown/{Slide*,MarkdownEditor}.vue` | — | `ui/field/{Markdown,Report,Slide}Field.vue` | **뷰가 폼 필드에 역임베드 — 순환적 결합** |
| `src/views/process-hierarchy/ProcessHierarchyOpenButton.vue` | — | admin/tabs/CallActivityManagement, admin/tabs/PropertySchemaStudio | Admin → Hierarchy 진입점 |

---

## 3. 스토어 → 기능 영역 매핑

| 스토어 | 줄 | 지원 영역 | 소비 뷰 수 |
|---|---|---|---|
| `adminConsole.ts` | **1800** | Admin Console 전반 + Review Board + Process Architecture + Process Hierarchy Properties + 정책문서 + GlobalNoticeBanner | **13곳 — 가장 넓은 결합. 단독 플래그 불가** |
| `taskCatalog.ts` | 1056 | Task 카탈로그/스키마 — Hierarchy(3뷰) + PropertySchemaStudio + admin 컴포넌트 8종 + BpmnUengine | 넓음 |
| `bpmn.ts` | 53 | BPMN 편집 상태 — Hierarchy 4뷰 + designer 스택 | 넓음 |
| `strategy/strategyStore.ts` | 238 | StrategyBoard, strategy/OntologyExplorer, SurveyResponse, KPIDashboard | 영역 G+F |
| `analytics/analysisDashboardStore.ts` | 228 | AnalysisDashboard + OperationalBoard 탭 | 영역 F |
| `analytics/cubeStore.ts` | 507 | PivotTablePage, NaturalQueryPage (**둘 다 미라우팅**) + `components/analytics/olap/*` | **현재 도달 불가** |
| `analytics/olapStore.ts` | 139 | Dashboard, Performance(미라우팅) | 영역 F |
| `analytics/kpiStore.ts` | 181 | KPIDashboard | 영역 F |
| `systemManagement.ts` | 183 | SystemManagement | 영역 N (단독) |
| `defaultSetting.ts` | 118 | 에이전트/사용자 기본설정 — ChatRoomPage + 13곳 | 전역성 |
| `auth.ts` | 143 | 인증 — App.vue, router, 로그인/등록 폼 | 전역 |
| `customizer.ts` | 35 | 테마/레이아웃 — layouts 전반 + ProcessHierarchy | 전역 |
| `globalState.ts` | 31 | main.ts 전역 주입 | 전역 |
| `colorRules.ts` | 151 | BPMN 색상 규칙 — `components/settings/*` | 영역 B 부속 |
| `dmn.ts` / `mcpEditor.ts` | 25/34 | DmnChat / MCPServer 탭 단독 | 격리 용이 |
| `reviewBoard.ts` | 366 | ⚠️ **소비처 0 — 데드** | — |
| `authUser.ts` | 21 | ⚠️ **소비처 0 — 데드** | — |
| `apps/*`, `school-pages/*` | — | 템플릿 잔재. `apps/chat`만 일부 | 삭제 후보 |

---

## 4. 플래그 설계 시 주의할 결합 지점

1. **`adminConsole` 스토어가 Admin 영역을 넘어 Review Board·Process Architecture·Process Hierarchy Properties에 걸쳐 있음** → "Admin 끄기"가 곧 "리뷰보드/체계도 기능 일부 상실"이 됨. 스토어 분리 없이는 깨끗한 플래그 불가.
2. **AN Transformation Studio는 독립 라우트가 없음** — Process Hierarchy blueprint 다이얼로그 전용. 별도 플래그를 만들려면 `ProcessHierarchy.vue`의 `ProcessBlueprintStudio` / `AnOrchestratorDialog` / `AnRoadmapDialog` 진입 버튼 3곳을 가려야 함.
3. **같은 기능의 2~3중 구현**: 조직도(`views/organization/*` vs `components/OrganizationChartChat.vue`), 온톨로지(`ontology-explorer` / `ontology-explorer-new` / `ui/OntologyGraphViewer`), BPMN 디자이너(`BpmnUengine.vue` 스택 vs `designer/modeling/ModelCanvas.vue` 스택), Admin(`views/admin/*` vs `components/ui/Admin.vue`), 대시보드(`/analytics` vs `/analysis-dashboard`). 플래그는 **기능명이 아니라 구현 스택 단위**로 걸어야 합니다.
4. **`src/views/markdown/*`가 폼 필드(`ui/field/*Field.vue`)에 역임베드** — "슬라이드/문서 기능 끄기"가 워크아이템 폼 렌더링을 깨뜨림.
5. **인증 게이트 밖 라우트**: `/design-system`, `/design-system/login`, `/bpmn-auto-layout-e2e`, `/processgpt-mapper-ui-e2e`, `/processgpt-callactivity-form-mapping-e2e`, `/instance-classifier-demo`, `/external-forms/:formId`, `/markdown-editor`, `/slide-editor`, `/present` (`src/router/index.ts`가 `MainRoutes` 밖에 등록). **프로덕션 플래그 1순위**.
6. **PAL 관리자 메뉴 11개가 `VerticalSidebar.vue` 355~365행 인라인 하드코딩** — `MENU_DEFINITIONS` 기반 플래그를 적용해도 이 블록은 반영되지 않음.
7. **`MainRoutes.ts`의 `TaskCatalogAdmin` 라우트 중복 등록**(`/admin/task-catalog`가 두 번).</result>
<usage><subagent_tokens>81844</subagent_tokens><tool_uses>28</tool_uses><duration_ms>253397</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-04T00:59:15.749Z (backfill)

```text
<task-notification>
<task-id>ac529f5cbd747c8c8</task-id>
<tool-use-id>toolu_01C7C7Edtd2PQhSTt4AgCk6L</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/ac529f5cbd747c8c8.output</output-file>
<status>completed</status>
<summary>Agent "AI 기능 분산 현황 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>AI 기능 전수 조사 결과입니다. 총 **221개 파일**에 AI 관련 키워드가 있고, 실제 AI 호출 지점은 **~60개 파일**에 분산되어 있습니다.

---

## 0. 공통 인프라 (feature flag의 1차 차단 지점)

| 파일 | 역할 |
|---|---|
| `/home/kimsanghoon/process-gpt-vue3/src/components/ai/AIGenerator.js` | **모든 레거시 AI 호출의 기반 클래스.** L75 `this.backendUrl = '/completion/langchain-chat'`, L209/219 `/sanity-check`, L268 `POST {backendUrl}/messages` (XHR 스트리밍), L33 `this.model = 'gpt-4o'` |
| `/home/kimsanghoon/process-gpt-vue3/src/components/ai/llmConfig.js` | LLM 파라미터 중앙 설정 (temperature 등). 모델명은 없음 |
| `/home/kimsanghoon/process-gpt-vue3/src/components/ai/ChatBackgroundManager.js` | AI 요청 백그라운드 실행/재개 매니저 |
| `/home/kimsanghoon/process-gpt-vue3/src/components/ai/blueprintAiUtils.js` | qdrantChat 응답 파서 (10개 Blueprint/AN 생성기가 공유) |
| `/home/kimsanghoon/process-gpt-vue3/src/services/sseClient.ts` L48 `streamSse()` | POST 기반 SSE 스트리밍 공통 유틸 |
| `/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts` L841 `qdrantChat()` | **PAL 모드 AI 진입점 전부.** `POST /pi-system-backend/langchain-chat/qdrant-chat/stream` (SSE). L857 `saveCopilotLog`, L886 `deleteCopilotLog`, L897 `listCopilotLogs` |
| `/home/kimsanghoon/process-gpt-vue3/src/components/api/ProcessGPTBackend.ts` | ProcessGPT 모드 AI 엔드포인트 집합 (아래 상세) |
| `/home/kimsanghoon/process-gpt-vue3/src/components/ai/` (49개 파일) | 개별 AI 생성기 |

**`src/components/ai/`에 49개 생성기가 있고, 그중 48개가 `AIGenerator`를 상속하거나 `backend.qdrantChat`을 직접 호출합니다.** → 이 두 지점(`AIGenerator.generate()`, `PalModeBackend.qdrantChat()`)에 flag 가드를 넣으면 대부분의 AI 호출이 한 번에 차단됩니다.

---

## 1. 채팅 어시스턴트 (메인 챗) — **AI 없으면 페이지 자체가 무의미**

**진입점:** 사이드바 → `/chat` (ChatRoomPage), `/chats` (Chats), 헤더 알림 → `/chat?roomId=`, `/agent-chat/:id`

| 파일 | 라인 |
|---|---|
| `src/views/chat/ChatRoomPage.vue` (11,513줄) | L813 ConsultingGenerator, L821-823 agentRouterService/deepAgentRouterService/FixedBaseWorkAssistantAgentService import, L2806 `getAgentRouterForOrchestration()`, L3215 `attachToStream()`, L3568·L5705·L8187 라우터 호출, L6709 `import('@/components/ai/AIGenerator.js')` 동적 로드, L9372 ConsultingGenerator 생성, L9437/9526/9555 스트리밍 콜백 |
| `src/views/apps/chat/Chats.vue` (1,475줄) | L223-225 WorkAssistant/Consulting/CompanyQuery Generator, L308·357·1173·1289 생성, L1213 ConsultingGenerator |
| `src/views/apps/chat/AssistantChats.vue` | L21 ChatAssistantGenerator, L57 생성 |
| `src/components/ui/Chat.vue` (8,093줄) | L3504 ChatRoomNameGenerator, L3723/L3969/L4009 `orchestration: 'deepagents' \| 'langchain-react'` 선택 UI, L5559 `POST /completion/upload`, L5645 skill context, L5941 `/query` 슬래시 커맨드 |
| `src/components/chat/UnifiedChatInput.vue`, `ChatThread.vue`, `src/components/MainChatInput.vue` | 채팅 입력 UI |
| `src/components/apps/chats/ChatListing.vue` | ChatBackgroundManager 연동 |
| `src/components/AgentChat.vue` + `AgentChatActions/Learning/Question/Info/Rooms/RoomContext.vue` | `/agent-chat/:id` 라우트. AgentChatGenerator, WorkItemAgentGenerator |
| `src/components/WorkAssistantChatPanel.vue` (3,051줄) | L200 workAssistantAgentService, L202 ConsultingGenerator, L1347 생성, L2457 `/completion/upload` |
| `src/components/ui/AgentsChat.vue`, `AgentMessagePanel.vue`, `HumanFeedbackPanel.vue`, `ChatList.vue`, `WorkItemChat.vue` | 보조 UI |
| `src/services/AgentRouterService.js` | base `/agent-router` (L14, `VITE_AGENT_ROUTER_BASE_URL`). L29 `/route`, L41 `/{agentId}/warmup`, **L55 `/{agentId}/chat/stream` (SSE)** |
| `src/services/DeepAgentRouterService.js` | base `/process-gpt-deepagents` (L7). L17 `/health`, **L49 `/chat/stream`**, L106 `/chat/stop`, L133 `/chat/stream/attach` |
| `src/services/WorkAssistantAgentService.js`, `FixedBaseWorkAssistantAgentService.js` | base `/agent` (`VITE_AGENT_BASE_URL`) |
| `src/services/agentRequestHeaders.js`, `src/utils/deepagentsApi.ts` | 인증 토큰 주입 axios 인스턴스 |
| `src/stores/defaultSetting.ts` L11-70 | 기본 에이전트 목록 (`is_agent: true`, `agent_type: 'pgagent'`, browser-automation-agent 등) |
| `src/constants/processGptAgent.ts` | `PROCESS_GPT_AGENT_ID` |

**엔드포인트:** `/completion/langchain-chat/messages`, `/agent-router/*`, `/process-gpt-deepagents/chat/stream`, `/agent/*`, `/completion/upload`, `/completion/generate-name`

---

## 2. BPMN 프로세스 정의 생성/컨설팅 AI — **AI 없으면 페이지 무의미**

**진입점:** 사이드바 "프로세스 정의" → `/definitions/chat`, `/definitions/:id`, `/definitions-tree`, `/forms/*`

| 파일 | 라인 |
|---|---|
| `src/components/ProcessDefinitionChat.vue` (3,307줄) | L436 ProcessDefinitionGenerator, L437 ProcessConsultingGenerator, L438 ProcessConsultingMentoGenerator, L441 FormDesignGenerator / 생성: L594, L621, L1992, L2210, L2230, L2239, L2497, L2614 / L2704 fetch 스트리밍 |
| `src/components/ProcessDefinitionChatWithTree.vue`, `ProcessDefinitionChatHeader.vue` | 래퍼 + SSE |
| `src/components/ProcessDefinitionModule.vue` | DefinitionOptimizer, FormDesignGenerator |
| `src/components/BPMNXmlGenerator.vue` | BPMN XML 생성 (ChatRoomPage L7916에서 컨텍스트로 재사용) |
| `src/components/ai/ProcessDefinitionGenerator.js` (25KB, 최대), `ProcessConsultingGenerator.js`, `ProcessConsultingMentoGenerator.js`, `DefinitionOptimizer.js`, `ProcessDefinitionIdGenerator.js`, `ProcessSummaryGenerator.js`, `BestBpmnGenerator.js` | |
| `src/components/api/ProcessGPTBackend.ts` L338 | `POST /validate-and-improve` — 초안 프로세스 실엔진 검증 + **LLM 자동개선** |
| `src/components/api/ProcessGPTBackend.ts` L3989 | `POST /completion/process-search` (시맨틱 검색) |
| `src/components/api/ProcessGPTBackend.ts` L875-881 | `POST /completion/complete` / `/completion/vision-complete` (인스턴스 실행 = AI task 실행) |
| `src/components/api/ProcessGPTBackend.ts` L899 | `POST /completion/generate-name` (채팅방/인스턴스 이름 자동 생성) |
| `src/components/api/ProcessGPTBackend.ts` L5223 | `POST /completion/langchain-chat/embeddings` |

---

## 3. BPMN 디자이너 내 인라인 AI 지원 — **부가기능 (없어도 수동 편집 가능)**

**진입점:** BPMN 디자이너 우측 속성 패널 각 요소별 "생성" 버튼

| 파일 | 생성기 |
|---|---|
| `src/components/designer/bpmnModeling/bpmn/panel/SequenceFlowPanel.vue` (+`SequenceFlowPanel copy.vue`) | ConditionRuleGenerator |
| `.../panel/ConditionExampleField.vue` | ConditionExampleGenenrator |
| `.../panel/EventPanel/TimerEventDefinitionPanel.vue` | CronRuleGenerator (자연어→cron) |
| `.../panel/GenerateScriptPanel.vue` | ScriptGenerator + GPTScriptGenerator |
| `.../panel/SendTaskPanel.vue`, `ServiceTaskPanel.vue` | BPMNAPIGenerator |
| `.../panel/SubProcessPanel.vue` | SubprocessRuleGenerator |
| `.../panel/GPTUserTaskPanel.vue` | ProcessSummaryGenerator |
| `.../panel/GPTLanePanel.vue`, `BpmnPropertyPanel.vue` | GPT 관련 패널 |
| `.../mapper/ProcessVariable.vue` | `POST /completion/process-var-sql/invoke`, `/completion/process-data-query/invoke` |
| `src/components/ProcessDefinitionVersionDialog.vue` | BpmnDiffGenerator (버전 diff 요약), ProcessDefinitionIdGenerator |
| `src/components/apps/definition-map/ProcessDialog.vue`, `MetricsView.vue` | ProcessDefinitionIdGenerator |
| `src/components/apps/definition-map/ProcessDefinitionMap.vue` | L786/L1186 WorkAssistantGenerator |

---

## 4. AN Transformation / Blueprint Studio (프로세스 혁신 AI) — **AI 없으면 무의미**

**진입점:** `/process-hierarchy` (사이드바 프로세스 계층) → AI Copilot 패널 / Blueprint Studio 탭

| 파일 | 라인 |
|---|---|
| `src/views/process-hierarchy/ProcessHierarchyAIGuide.vue` (2,369줄) | **AI Copilot 본체.** L245-248 AnGapToPiFlag/AnToBeFromFlags/AnPartition/AnRoadmap Generator, L231 `bpmnCopilotPayload`, L232 `fetchTmfKbContext`, L445 슬래시 명령 안내, **L1756 `backend.qdrantChat()`**, L1632·L1774 `saveCopilotLog` |
| `src/views/process-hierarchy/ProcessHierarchy.vue` | L180 AIGuide 마운트, L633 `useAnStudio` |
| `src/views/process-hierarchy/ProcessHierarchyDesigner.vue` | L1069-1074 `generateBpmnMulti` import, L1966 호출 |
| `src/views/process-hierarchy/ProcessHierarchyProperties.vue` | L2983 `&lt;BpmnReviewGuide&gt;`, L4013 AN_STUDIO_KEY |
| `src/composables/anStudio/useAnStudio.ts` | L12 "qdrantChat 전용", analyzeGaps / designToBe / generateRoadmap / partitionAsIs / L29 generateBpmn |
| `src/composables/anStudio/anIntentRouter.ts` | L48-95 슬래시 커맨드 정의 (`/partition` `/gap` `/tobe` `/roadmap` `/modularize` `/executable`) |
| `src/composables/anStudio/bpmnTaskExtractor.ts`, `callActivityModularizer.ts` | |
| `src/composables/blueprint/useBlueprintStudio.ts` | generateToBeBpmn / proposeSolutions / generateExecutableDefinition / validationFeedback |
| `src/views/process-hierarchy/blueprint/ProcessBlueprintStudio.vue` L202-238, `AnOrchestratorDialog.vue`, `AnRoadmapDialog.vue`, `IssueSolutionBoard.vue`, `SolutionOptionCard.vue`, `ExecutableProcessView.vue`, `AsIsToBeCompare.vue` | |
| `src/views/an-transformation-studio/stages/{AsIsPartitioning,ToBeOrchestrator,Roadmap}Stage.vue`, `components/RoiWidget.vue` | *라우트는 `src/utils/routePermissions.ts` L93에서 주석 처리됨 (비활성)* |
| 생성기 8종 | `AnPartitionGenerator.js` (L178-202 qdrantChat), `AnGapGenerator.js`, `AnGapToPiFlagGenerator.js` (L132-140), `AnOrchestratorGenerator.js` (L145-149), `AnRoadmapGenerator.js`, `AnToBeFromFlagsGenerator.js` (L54-65), `BestBpmnGenerator.js`, `ExecutableProcessGenerator.js` (L132-157), `SolutionProposalGenerator.js` |
| `src/services/bpmnGenerationService.ts` | L22 `API_BASE_URL = '/pi-system-backend'`, L211 `generateBpmn`, L322 `generateBpmnPipeline`, L387 `generateBpmnMulti` — **텍스트/파일/Confluence → BPMN 생성** |
| `src/utils/bpmnCopilotPayload.ts`, `src/utils/tmfKb.ts` | Copilot 페이로드 / TM Forum eTOM RAG 컨텍스트 |

**주의:** `src/components/ui/BpmnReviewGuide.vue`는 이름과 달리 **정적 문서 컴포넌트** (AI 호출 없음).

---

## 5. 폼(Form)/UI 정의 생성 AI — **AI 없으면 페이지 무의미**

**진입점:** `/ui-definitions/chat`, `/ui-definitions/:id`, WorkItem 폼 화면

- `src/components/UIDefinitionChat.vue` L191·L272 FormDesignGenerator
- `src/components/FormDefinition.vue` L72·L172 FormDesignGenerator
- `src/components/FormDefinitionModule.vue`
- `src/components/FormScanModule.vue` — FormScanGenerator + DataSourceGenerator + FormDesignGenerator (**이미지→폼 스캔**, vision)
- `src/components/apps/todolist/FormWorkItem.vue` L226 AudioTextarea + FormDesignGenerator
- `src/components/apps/todolist/FormInterviewChat.vue` — FormInterviewChatGenerator
- `src/components/testTerminals/FormDefinitionTestTerminal.vue` — FormHtmlCodeGenerator
- 생성기: `FormDesignGenerator.js` (17KB) + `FormDesignGeneratorPromptSnipptsData.js` (19KB 프롬프트), `FormHtmlCodeGenerator.js`, `FormInterviewChatGenerator.js`, `FormScanGenerator.js`, `DataSourceGenerator.js`

---

## 6. DMN / 비즈니스룰 AI — **AI 없으면 채팅 탭만 무의미, 모델러는 유지**

**진입점:** `/dmn/chat`, `/dmn/:id`, `/business-rule`

- `src/components/DmnChat.vue` — DmnGenerator (14KB) + SSE
- `src/components/ai/DmnGenerator.js`, `ConditionRuleGenerator.js`
- `src/components/BusinessRuleLearning.vue`
- `src/utils/organizationDmnRule.ts`

---

## 7. 조직도 AI — **부가기능**

**진입점:** 사이드바 "조직도" → `/organization`, `/organization-before` (**단, `window.$pal`이 false일 때만 `OrganizationChartChat.vue` 사용** — `src/router/MainRoutes.ts` L97, L105)

- `src/components/OrganizationChartChat.vue` — OrganizationChartGenerator
- `src/components/ui/UserInputGenerator.vue` — OrganizationAgentGenerator
- `src/components/ui/AgentCreateDialog.vue`
- `src/components/ai/OrganizationChartGenerator.js`, `OrganizationAgentGenerator.js`

---

## 8. 음성 / STT / TTS (Realtime Voice Agent) — **부가기능 (완전 격리 가능)**

**진입점:** ChatRoomPage 우측 마이크 버튼, WorkItem 폼 "실시간 어시스턴트" 버튼

| 파일 | 라인 |
|---|---|
| `src/components/ui/VoiceAgentDesktopMode.vue` | L180 `wss?://{host}/voice/ws`, L182 WebSocket, L284/290 `input_audio_buffer.speech_started/stopped` (**OpenAI Realtime API 프로토콜**) — ChatRoomPage L526·L812 |
| `src/components/ui/AudioStream.vue` | L171-177 `wss://{host}/voice/ws` — Record.vue L34에서 사용 |
| `src/components/apps/todolist/FormRealtimeAssistant.vue` (1,098줄) | L183 `ws(s)://{host}/voice/ws/realtime` (`VITE_REALTIME_ASSIST_WS`), L298 WebSocket, L430 speech 이벤트 — WorkItem.vue L508·L548 |
| `src/components/ui/AudioTextarea.vue` | L110/143 MediaRecorder, **L168 `POST /completion/upload` (STT 업로드)** — FormWorkItem.vue L113 |
| `src/components/ui/Record.vue`, `Record2.vue` | L83 MediaRecorder |

**프록시:** `/voice/` → `react-voice-agent:3000` (`docker-compose/nginx/nginx.conf` L33-36). **vite.config.ts에는 `/voice` 프록시가 없음** (dev에서 미동작).

---

## 9. 이미지 생성 — **부가기능**

- `src/components/ai/ImageGenerator.js` — `this.model = 'dall-e-3'`, 마켓플레이스 대표 이미지 생성
- 사용처: `src/components/ProcessDefinitionMarketPlaceDialog.vue`

---

## 10. 문서 파싱 / 요약 / 지식(RAG) — **부가기능**

| 파일 | 내용 |
|---|---|
| `src/utils/upstageParser.js` | L29-30 `VITE_UPSTAGE_API_KEY`, **L74 `POST https://api.upstage.ai/v1/document-digitization`** (브라우저에서 외부 AI API 직접 호출 — 유일한 직접 호출) → `src/components/ui/EventTimeline.vue` L583 |
| `src/utils/GPTMemento.js` | L10 `POST /retrieve`, L20 `POST /query` (RAG) → `src/components/retrieval/RetrievalBox.vue` → `src/components/ui/Chat.vue` L3492 |
| `src/views/knowledge/KnowledgeBasePage.vue`, `src/components/knowledge/KnowledgeSpacePicker.vue` | `/memento/documents/list`, `/memento/knowledge/files/url` |
| `src/components/pages/account-settings/KnowledgeFilesTab.vue` | `/memento/knowledge/files{,/upload,/check-hash}`, `/memento/knowledge/folders` |
| `src/components/pages/account-settings/DriveTab.vue` | `/memento/auth/google/*` |
| `src/components/api/ProcessGPTBackend.ts` L4868·L4906·L5102·L5131·L5173 | `/memento/save-to-storage`, `/memento/save-to-drive`, `/memento/process`, `/memento/process/drive/status` |
| `src/views/apps/chat/Chats.vue` | `/memento/query`, `/completion/process-data-query` |
| `src/components/AgentKnowledgeManagement.vue` | `POST /agent-feedback/setup-agent-knowledge` (ProcessGPTBackend L4390) |
| `src/components/ai/MarkdownGenerator.js` → `src/views/markdown/MarkdownEditor.vue` | 마크다운 생성 |
| `src/components/ai/ProcessSummaryGenerator.js` | 프로세스 요약 |

---

## 11. Claude Skills / DeepAgents 스킬 관리 — **AI 없으면 무의미**

**진입점:** 사이드바 상단 아이콘 → `/skills` (VerticalSidebar.vue L203), `/skills/:id`

- `src/components/SkillsManagement.vue` (1,519줄), `SkillDetail.vue`, `SkillGitHistory.vue`, `SkillPrDetail.vue`, `SkillSaveDialog.vue` (CommitMessageGenerator), `AgentSkillEdit.vue` (CommitMessageGenerator), `AgentSkills.vue`, `AgentToolPriority.vue`
- `src/components/ui/SkillList.vue`, `SkillProposalBadge.vue`, `SkillProposalReviewModal.vue`
- `src/composables/useSkillProposals.js`, `useDefinitionProposals.js`, `usePrUtils.ts`
- `src/utils/skillReferencesGraph.ts`
- `src/components/ui/field/AgentSelectField.vue` — `GET /process-gpt-cli-agent/agents`
- `src/components/api/ProcessGPTBackend.ts` L5976 이하 — `/process-gpt-deepagents/skills/*` (export, files, branches, commits, pull-requests, sync, repo, inheritance), `/process-gpt-deepagents/skills-builtin`, `/claude-skills/skills/check`
- **엔드포인트:** `/process-gpt-deepagents/skills/*` (:8765 claude-skills), `/claude-skills/*`, `/process-gpt-cli-agent/*` (:8890)

---

## 12. 에이전트 피드백 / 제안 승인 — **부가기능**

- `src/views/apps/proposal/Proposals.vue`, `src/components/ui/Proposal.vue`
- `src/components/api/ProcessGPTBackend.ts` — `/feedback-proposals`, `/feedback-proposals/{batchId}/targets/{type}/{action}` (:6789 agent-feedback)

---

## 13. 브라우저 자동화 에이전트 — **부가기능**

- `src/components/BrowserAgent.vue` — L236/269 `http://localhost:8999/api/config`, L588 `/api/execute`, L641 `/api/task/stop` (**하드코딩된 localhost**)
- `src/views/markdown/AgentMonitor.vue` (2,005줄) L128 BrowserAgent 마운트 → WorkItem.vue L536
- nginx: `/browser-use/` → `browser-use:5001`

---

## 14. 인스턴스 자동분류 / 유사 인스턴스 (ML) — **부가기능**

**진입점:** 사이드바 "요청 Top List" → `/instance-toplist`, WorkItem 하단 유사 인스턴스 패널, `/instance-classifier-demo`

- `src/utils/instanceClassifier.ts` — L8 `BASE='/instance-classifier'`, `/health` `/proc-defs` `/toplist` `/topics/*/instances` `/similar` `/recluster` `/ingest`
- `src/components/apps/instance-classifier/InstanceTopList.vue`, `InstanceTopBars.vue`, `SimilarInstancesPanel.vue`
- `src/views/demo/InstanceClassifierDemo.vue`

---

## 15. 온톨로지 / 프로세스 KG 인사이트 AI — **부가기능(내러티브만)**

**진입점:** `/analytics/ontology`, `/ontology-explorer`, `/analysis-dashboard`

- `src/components/ontology-explorer/ai/InsightNarrativeGenerator.ts` L66 `generateInsightNarrative()` — qdrantChat 사용
- `src/composables/ontology/useOntologyGraph.ts` L11·L24·L1036 (온디맨드 + 캐시)
- `src/lib/processKg/analysis/types.ts` L44, `reportMarkdown.ts`, `sequenceMining.ts`
- `src/views/governance-studio/DataGovernanceStudio.vue` L169 "모듈 1: LLM 기반 용어 클러스터링"
- `src/stores/strategy/strategyStore.ts` L95 `POST /strategy-service/ai/suggest`, L99 `/ai/alignment` → `src/views/strategy/StrategyBoard.vue` L1580 (`generated_by === 'llm'`)

---

## 16. 워크아이템 실행 AI — **AI 없으면 자동화 태스크 실행 불가**

- `src/components/apps/todolist/WorkItem.vue` L543·L1594·L1709 WorkItemAgentGenerator, L1388 `/completion/upload`
- `src/components/AgentChatActions.vue` — WorkItemAgentGenerator
- `src/components/ui/ProcessFeedback.vue` L149·L182 → `/completion/get-feedback`, `/completion/get-feedback-diff`
- `src/components/apps/todolist/KanbanColumn.vue` L283, WorkItem L2317 → `/completion/get-rework-activities`, `/completion/rework-complete`
- `src/components/ProcessInstanceChat.vue` — ProcessInstanceGenerator
- `src/components/api/ProcessGPTBackend.ts` L875 `/completion/complete` · `/completion/vision-complete` — **인스턴스 실행 자체가 AI 호출**

---

## 17. 기타 단발 AI

| 기능 | 파일 |
|---|---|
| BSC 카드 생성 | `src/components/ui/BSCard.vue` (`/bscard`) + `ai/BSGenerator.js` |
| 회사 질의 | `ai/CompanyQueryGenerator.js` |
| 채팅방 이름 자동생성 | `ai/ChatRoomNameGenerator.js` + `/completion/generate-name` |
| 커밋 메시지 생성 | `ai/CommitMessageGenerator.js` |
| MCP 도구 목록 | ProcessGPTBackend L7122 `/completion/mcp-tools`, `src/services/McpValidatorService.js` (`/mcp-validator`), `src/stores/mcpEditor.ts` |
| 사용자/테넌트 초기설정 | `/completion/set-tenant` `/completion/invite-user` `/completion/create-user` `/completion/update-user` `/completion/set-initial-info` (`src/components/auth/InitialSettingForm.vue`), `/completion/role-binding` |
| 팀채팅 `/agent` 슬래시 | `src/components/ProcessDefinitionTeamChat.vue` L219·L552·L669 |
| 미사용 | `src/components/ai/JsonAIGenerator.js` (import 하는 곳 없음), `SequenceFlowPanel copy.vue` (사본) |

---

## 18. vite.config.ts 프록시 — AI 백엔드 경로 (라인 번호 기준)

| 경로 | 타겟 | AI 여부 |
|---|---|---|
| `/completion/` | `127.0.0.1:8000` | ✅ 메인 LLM 서비스 |
| `/complete` | `127.0.0.1:8099` | ✅ |
| `/vision-complete` | `:8099` | ✅ vision |
| `/validate-and-improve` | `:8099` (timeout 0) | ✅ LLM 자동개선 |
| `/langchain-chat` | `:8099` | ✅ |
| `/process-search`, `/vision-process-search` | `:8099` | ✅ 시맨틱 검색 |
| `/query`, `/retrieve`, `/memento/` | `:8005` | ✅ RAG/Memento |
| `/pi-system-backend/` | `VITE_PI_SYSTEM_BACKEND_URL` \|\| `:8000` | ✅ **qdrantChat SSE + BPMN 생성** |
| `/agent/` | `:8008` | ✅ Work Assistant Agent |
| `/agent-router/` | `:8001` | ✅ |
| `/process-gpt-deepagents/` | `:8888` | ✅ |
| `/process-gpt-deepagents/skills`, `/claude-skills/` | `:8765` | ✅ |
| `/process-gpt-cli-agent` | `VITE_CLI_AGENT_URL` \|\| `:8890` | ✅ |
| `/mcp-validator/` | `VITE_MCP_VALIDATOR_URL` \|\| `:8800` | ✅ |
| `/feedback-proposals` | `:6789` | ✅ |
| `/instance-classifier/` | `:8013` | ⚠️ ML |
| `/strategy-service/` | `:8014` | ⚠️ 일부 `/ai/*` |
| `/api/analytics` `:8899`, `/definition` `/instance` `/work-item` 등 → uEngine 게이트웨이 `:8088` | | ❌ AI 아님 |
| **`/voice/` 프록시 없음** | (nginx만 존재) | ✅ 누락 |

`/process-db-schema`, `/drop-process-table` (`:8099`)는 completion 서비스 소속이지만 AI 아님 — **flag로 `/completion` 전체를 끄면 같이 죽습니다. 주의.**

---

## 19. 기존 flag 메커니즘 (재사용 후보)

- `src/palMode.ts` — `window._env_?.VITE_PAL_MODE || import.meta.env.VITE_PAL_MODE` → `window.$pal` (readonly). **런타임 `window._env_` + 빌드타임 둘 다 지원하는 이 패턴을 그대로 따르는 것이 일관적입니다.**
- `src/main.ts` L242 `window.$mode`, L214 `_env_` 타입 선언
- 현재 사용 중인 env: `VITE_PAL_MODE`, `VITE_MODE`, `VITE_GS_MODE`, `VITE_AGENT_ROUTER_BASE_URL`, `VITE_AGENT_BASE_URL`, `VITE_MCP_VALIDATOR_URL`, `VITE_PDF2BPMN_API_BASE_URL`, `VITE_UPSTAGE_API_KEY`, `VITE_REALTIME_ASSIST_WS`, `VITE_ROBO_API_BASE_URL`, `PROCESS_GPT_OFFICE_MCP_URL`
- `src/utils/routePermissions.ts`, `src/utils/menuRoleOverrides.ts`, `src/utils/customPermissions.ts` — **라우트/메뉴 숨김 기존 인프라. AI 페이지 숨김은 여기에 훅을 걸 수 있습니다.**
- `.env` 에는 AI 관련 flag 없음

---

## AI 의존도 분류 요약

**AI 끄면 페이지가 완전히 무의미 (라우트/메뉴 자체를 숨겨야 함):**
`/chat`, `/chats`, `/agent-chat/:id`, `/definitions/chat`, `/definitions-tree`, `/ui-definitions/chat`, `/dmn/chat`, `/skills`, `/skills/:id`, `/proposals`, `/process-hierarchy` AI Copilot 패널 + Blueprint Studio 탭, `/instance-toplist`

**AI가 부가기능 (버튼/패널만 숨기면 됨):**
BPMN 디자이너 속성 패널의 생성 버튼들, 조직도 챗, 마켓플레이스 이미지 생성, 음성 입력·실시간 어시스턴트, 문서 파싱(Upstage), 온톨로지 내러티브, StrategyBoard AI 정렬, WorkItem 유사 인스턴스 패널, 브라우저 에이전트, Knowledge/Memento 업로드, 버전 diff 요약, 커밋 메시지 생성

**경계 케이스 (주의):**
`/completion/complete`·`/vision-complete`는 **인스턴스 실행 경로 자체**(ProcessGPTBackend L869-894)라, 이걸 끄면 프로세스 실행이 멈춥니다. `/completion/set-tenant`·`/invite-user`·`/create-user`·`/role-binding`은 AI가 아닌 순수 CRUD인데 같은 `/completion` 서비스에 있으므로 **프록시 단위가 아닌 함수 단위 flag가 필요**합니다.</result>
<usage><subagent_tokens>95647</subagent_tokens><tool_uses>56</tool_uses><duration_ms>341282</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-04T01:40:34.429Z (backfill)

```text
문서를 검토해봤는데, 예를들면 프로세스 순서도를 기준으로 Exec view, 실행 버튼, 실행 ID는 실행기능이므로 BPMN 모드에서만 ON 처리되어야할 것 같고, AI Copilot, AI생성은 AI 기능이 OFF된다면 버튼이 hide 처리 되는지 확인 필요함.
```

## Prompt — 2026-09-04T01:41:39.749Z (backfill)

```text
BPMN모드가 아니라 엔진 모드
```

## Prompt — 2026-09-04T01:45:08.018Z (backfill)

```text
<task-notification>
<task-id>ac9256f8e17e75627</task-id>
<tool-use-id>toolu_01U2U1tAR4Cdi7swHadcjYW4</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/ac9256f8e17e75627.output</output-file>
<status>completed</status>
<summary>Agent "실행 기능 UI 조건 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Findings below.

## 1. 이미 존재하는 실행 기능 게이트 (핵심)

`/home/kimsanghoon/process-gpt-vue3/src/utils/execFeatureGate.ts` (전체 12줄)

```ts
export function canUseExecFeatures(): boolean {
    return authClaimsState.isAdmin;
}
```

실행 UI는 이미 **단일 게이트 함수 하나**로 전부 묶여 있습니다. "BPMN 모드" 플래그 설계는 사실상 **이 함수의 판정 로직만 교체**하면 되는 구조입니다 (호출부 6곳은 그대로 둘 수 있음).

호출부 전부:
- `src/composables/anStudio/anIntentRouter.ts:14, 108, 189`
- `src/views/process-hierarchy/ProcessHierarchy.vue:634, 1314, 3462, 3634`
- `src/views/process-hierarchy/ProcessHierarchyDesigner.vue:1066, 1326`
- `src/views/process-hierarchy/ProcessHierarchyProperties.vue:4022, 4688`
- `src/views/process-hierarchy/blueprint/ProcessBlueprintStudio.vue:205, 250`

---

## 2. 실행 UI 요소별 위치 / 부모 / 렌더 조건

### (a) "실행" 버튼 (인스턴스 시작)
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue:347-366`
- 부모: `ProcessHierarchy.vue` (Designer 툴바 Row 2)
- 조건: `v-if="isExecUser"` (v-tooltip 래퍼에 걸림), 버튼 자체는 `:disabled="!processNameText" :loading="runStarting"`, `@click="$emit('run')"`
- 수신: `ProcessHierarchy.vue:85` `@run="handleRun"` → `ProcessHierarchy.vue:3460 handleRun()` (내부에서 `canUseExecFeatures()` 재확인 후 토스트 경고)

### (b) "실행 ID" 버튼
- 파일: `ProcessHierarchyDesigner.vue:367-375`
- 조건: `v-if="isExecUser"`, `@click="$emit('execInfo')"`, 아이콘 `mdi-identifier`
- 수신: `ProcessHierarchy.vue:86` `@execInfo="openExecInfo"` → `ProcessHierarchy.vue:3632 openExecInfo()` (여기서도 `canUseExecFeatures()` 재확인)

### (c) `ExecInstancePanel.vue` (실행 인스턴스/태스크 ID 다이얼로그)
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ExecInstancePanel.vue`
- 렌더 위치: `ProcessHierarchy.vue:580-586`
- **v-if 없음** — `v-model="execInfoOpen"` 로만 제어. 즉 컴포넌트는 항상 마운트되고, 열기 경로(`openExecInfo`, `onStartFormStarted`)만 게이트됨
- 데이터 소스: Supabase 직접 쿼리 (`ExecInstancePanel.vue:200-219`)
  - `bpm_proc_inst` — `proc_inst_id, proc_def_id, status, current_activity_ids, start_date, end_date`, `.in('proc_def_id', [defId, defId.toLowerCase()])`, limit 20
  - `todolist` — `id, proc_inst_id, activity_id, activity_name, status, user_id, ...`
  - 4초 폴링 (`REFRESH_INTERVAL_MS = 4000`, `startAutoRefresh` L179)
- 이동 링크: `openInstance` → `/instancelist/{instId}` (L258-262), `openTask` → `/todolist/{taskId}` 새 탭 (L263-267)

### (d) `StartEventSelectDialog.vue` (다중 시작 이벤트 선택)
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/StartEventSelectDialog.vue`
- 렌더 위치: `ProcessHierarchy.vue:588-596`
- **v-if 없음** — `v-model="startSelectOpen"` 만. `startSelectOpen` 은 `handleRun()` 안 `ProcessHierarchy.vue:3485` 에서만 true 가 됨
- 관련 상태: `ProcessHierarchy.vue:723-725` (`startSelectOpen`, `startSelectEvents`, `startSelectDefinition`)

### (e) `ProcessGPTExecute.vue` (시작 폼 풀스크린 다이얼로그)
- 실제 경로: `/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/ProcessGPTExecute.vue` (process-hierarchy 아래 아님)
- 렌더 위치: `ProcessHierarchy.vue:598-611`
  - 다이얼로그: `&lt;v-dialog v-model="startFormOpen" persistent fullscreen&gt;`
  - 내부: `&lt;ProcessGPTExecute v-if="startFormDefinition" :key="startFormKey" ... isSimulate="false" :startEventId="startFormStartEventId" :stayOnStart="true" @close="startFormOpen = false" @started="onStartFormStarted" /&gt;`
- 관련 상태: `ProcessHierarchy.vue:727-730`
- **주의(버그로 보임)**: `ProcessGPTExecute.vue:155-172` props 목록에 `startEventId` / `stayOnStart` 가 **없고**, 파일 전체에 `$emit('started')` 도 없습니다 (emit 은 `close` L528, `createInstance` L610 뿐). 즉 `onStartFormStarted`(`ProcessHierarchy.vue:3578`)는 현재 절대 호출되지 않습니다. 플래그 작업 시 이 경로가 dead 인지 확인 필요.
- 이 컴포넌트는 순서도 화면 외에도 `ProcessDefinition.vue:406`, `ProcessDefinitionVersionManager.vue:239`, `ProcessDefinitionChat.vue:444`, `ProjectCard.vue:162`, `SubProcessDetail.vue:205` 에서 재사용됨 → 게이트를 컴포넌트 내부에 넣으면 다른 화면에 파급됨. **호출부(ProcessHierarchy)에서만 막을 것.**

### (f) Exec 모드 토글 pill ("As-Is / To-Be / Exec")
- 파일: `ProcessHierarchyDesigner.vue:374-390`(템플릿), 옵션 생성 `ProcessHierarchyDesigner.vue:1478-1486`

```js
asisTobeOptions() {
    const options = [{ value: 'as-is', label: 'As-Is' }, { value: 'to-be', label: 'To-Be' }];
    if (this.isExecUser) options.push({ value: 'exec', label: 'Exec' });
    return options;
}
```
- 관련 computed: `ProcessHierarchyDesigner.vue:1324-1330`
```js
isExecUser() { return canUseExecFeatures(); },
execMode() { return this.activeMode === 'exec' &amp;&amp; this.isExecUser; }
```

### (g) `ExecutableProcessView.vue` (Exec 뷰어 본체)
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/blueprint/ExecutableProcessView.vue`
- 렌더 1: `ProcessHierarchyDesigner.vue:402-416` — `v-if="execMode &amp;&amp; activeBpmn"` (`.designer-exec-pane`), `:is-admin="isExecUser"`
  - 짝: BPMN 캔버스는 `ProcessHierarchyDesigner.vue:421` `v-show="activeBpmn &amp;&amp; !execMode"`
- 렌더 2: `ProcessBlueprintStudio.vue:126-137` — `v-else-if="viewMode === 'executable'"`, 탭 버튼은 `ProcessBlueprintStudio.vue:31` `v-if="canExec"`
- 내부 "실행 정의로 등록" 버튼: `ExecutableProcessView.vue:104-123` — `v-if="isAdmin"`
- 툴바 "Exec Mode" 칩: `ProcessHierarchyDesigner.vue:69-71` — `v-if="execMode"`

### (h) Properties의 "실행형 Pool" 지정 섹션
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue:1124-1163`
- 조건 (원문 그대로):
```
v-if="isParticipantElement &amp;&amp; isExecUser &amp;&amp; isBuiltinPropVisible('bpmn:Participant', 'exec_pool')"
```
- computed: `ProcessHierarchyProperties.vue:4686-4689` `isExecUser() { return canUseExecFeatures(); }`
- 관련: `execPoolList` (L4691-4698), `isExecPoolElement` (L4699~), `toggleExecPoolForElement`, `removeExecPool`

### (i) `/executable` 슬래시 명령 (AI Copilot)
- 정의: `anIntentRouter.ts:88-101` (`command: '/executable'`, aliases `['/실행형','/exec']`)
- 노출 게이트: `anIntentRouter.ts:106-110` `visibleSlashCommands()` — `canUseExecFeatures()` false 시 `kind !== 'executable'` 필터
- 자연어 의도 게이트: `anIntentRouter.ts:189` `if (EXECUTABLE_KW.test(t) &amp;&amp; canUseExecFeatures())`
- 처리: `ProcessHierarchyAIGuide.vue:1603-1620` → `emit('openToBeDialog', 'executable')` → `ProcessHierarchy.vue:1310-1321 openToBeStudioDialog()` 에서 `if (!canUseExecFeatures()) return;` 후 `designer.activeMode = 'exec'`
- AIGuide 자체에는 `canUseExecFeatures` import 이 **없음** — 라우터/부모 레벨 게이트에만 의존

---

## 3. "실행 ID" 표시 필드 — Properties 에는 없음

- Properties 패널에는 **실행 ID / instance id / definition id 표시 필드가 없습니다.** `proc_def_id` 는 Properties 에서 리뷰 코멘트·트리 매핑용 내부 키로만 쓰입니다 (`ProcessHierarchyProperties.vue:4842, 7856, 7873, 8247, 8260-8261, 8407, 8570, 8676`).
- Properties 의 ID 표시는 요소 단위 `elementDisplayId` (`ProcessHierarchyProperties.vue:4675-4677`, UUID 우선 / BPMN element id 폴백) 뿐이고 실행과 무관합니다.
- "실행 ID" 라는 UI 문구는 **Designer 툴바 버튼 라벨** (`ProcessHierarchyDesigner.vue:373`) 하나, 실제 ID 값 표시는 전부 `ExecInstancePanel.vue` 안 (`proc_def_id` L22-27, `proc_inst_id` L43-49, `taskId` L87-90) 입니다.

---

## 4. "BPMN 모드" 개념 — **코드에 존재하지 않음**

전 repo 검색 결과 `viewMode`/`designerMode`/`diagramMode`/`isBpmn*`/`bpmnMode`/`isExecutable`(상태로서) 중 "순서도 vs BPMN 뷰 전환"에 해당하는 것은 없습니다.

현재 존재하는 모드 축은 3개뿐:

| 축 | 변수 | 값 | 위치 |
|---|---|---|---|
| 에디터 모드 | `editorMode` | `edit` / `view` / `history` | `navigation.ts:11-15` `PROCESS_HIERARCHY_MODE`, `ProcessHierarchy.vue:1115`, Designer `modeOptions` L1425~ |
| 다이어그램 모드 | `activeMode` | `as-is` / `to-be` / `exec` | `ProcessHierarchyDesigner.vue:1221`(data), `1478-1486`(옵션), `1571`(watch) |
| Blueprint 뷰 | `viewMode` | `tobe` / `compare` / `partition` / `executable` | `ProcessBlueprintStudio.vue:248` (다이얼로그 내부 로컬 상태, BPMN 여부와 무관) |

부정 확인:
- `isExecutable` 은 BPMN XML 문자열 리터럴 속성일 뿐 (`ProcessHierarchy.vue:4781`, `ProcessHierarchyDesigner.vue:1085`: `&lt;bpmn:process id="Process_1" isExecutable="false"&gt;`) — 코드가 이 값을 읽어 분기하는 로직 없음.
- 정의 데이터에 "실행 가능 여부" 플래그로 분기하는 곳은 **런타임 1곳뿐**: `ProcessHierarchy.vue:3468-3473` — `backend.getExecutionDefinition(defId)` 결과의 `definition.activities` 배열이 비었으면 실행 거부 (토스트). 이건 UI 노출 게이트가 아니라 클릭 후 사후 검증입니다.
- 유사 개념 상태로는 `execPoolList` / `exec_pools` / `exec_pool_id` (`ProcessHierarchyProperties.vue:4691-4698`), `executable.applied_at` (`ProcessHierarchyAIGuide.vue:1606`, `ExecutableProcessView.vue:56-58`) 가 있음 — "이 프로세스에 실행 정의가 등록되어 있는가"를 나타내므로, BPMN 모드 판정에 쓸 후보 데이터입니다.
- 프로젝트 전역 feature flag 인프라는 없음. 유일한 빌드타임 모드 플래그는 `VITE_PAL_MODE` (`/home/kimsanghoon/process-gpt-vue3/src/palMode.ts:3-4` → `window.$pal`), UI 레이아웃 분기용 (`FullLayout.vue:39`, `ProcessArchitecture.vue:687`, `AdminConsoleLayout.vue:27`)이며 실행 기능과 무관합니다.

**결론: "BPMN 모드"라 부를 만한 기존 상태/플래그는 없습니다. 새로 만들어야 합니다.**

---

## 5. 실행 기능이 호출하는 백엔드 API

| 용도 | 호출부 | 구현 |
|---|---|---|
| 실행 정의 조회 (실행 가능 판정) | `ProcessHierarchy.vue:3468` `backend.getExecutionDefinition(id)` | `ProcessGPTBackend.ts:927` (Supabase `proc_def` → `proc_def_version` major/prod 버전) / `UEngineBackend` |
| 인스턴스 시작 | `ProcessHierarchy.vue:3596` `backend.start(command)` — `{ process_instance_id: 'new', process_definition_id, start_event_id? }` | `ProcessGPTBackend.ts:800 async start(input)` (Supabase 기반), `UEngineBackend.ts:450` (`POST /instance`) |
| 인스턴스/태스크 목록 | `ExecInstancePanel.vue:200-219` | Supabase 직접: `bpm_proc_inst`, `todolist` |
| 실행형 AI 변환 / 등록 | `ProcessHierarchyDesigner.vue:1654 onGenerateExecutable()`, `:1690 onApplyExecutable()` (내부 `if (!this.isExecUser)` 가드) | `useBlueprintStudio` / `composables/blueprint/executableModel.ts`, `executableForms.ts` |
| 시작 액티비티 조회 (폼 경로) | `ProcessGPTExecute.vue:333` `backend.getStartActivity(...)`, `:196 getExecutionDefinition` | — |

---

## 6. `ExecInstanceAdmin.vue` 와의 관계

- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/ExecInstanceAdmin.vue` (전체 ~50줄)
- 라우팅: `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts:569` (Admin 콘솔 탭). 이것이 유일한 참조 지점.
- 내용: 제목 + `&lt;InstanceListPage :list-type="['*']" :all-users="true" ... /&gt;` 래퍼뿐.
- **`ExecInstancePanel.vue` 와 코드/상태 공유 없음.** 공통점은 같은 실행 데이터(테넌트 인스턴스)를 본다는 것뿐이고, Admin 쪽은 `InstanceListPage` 를, 순서도 쪽은 Supabase 직접 쿼리를 씁니다. `canUseExecFeatures()` 도 참조하지 않습니다 (Admin 콘솔 자체의 isAdmin 가드에 의존).
- → **BPMN 모드 플래그의 영향 범위 밖**입니다. 다만 `ExecInstancePanel.openInstance()` 가 `/instancelist/{id}` 로 보내므로, Admin 인스턴스 화면은 순서도 실행 패널의 "착지 지점" 역할을 합니다.

---

## 7. 플래그로 실행 기능을 끌 때 함께 숨겨야 할 요소 체크리스트

이미 `isExecUser` / `canExec` / `canUseExecFeatures()` 로 묶여 있어 **`execFeatureGate.ts` 한 곳만 바꾸면 아래가 전부 따라옵니다**:

1. Designer 툴바 "실행" 버튼 — `ProcessHierarchyDesigner.vue:347`
2. Designer 툴바 "실행 ID" 버튼 — `ProcessHierarchyDesigner.vue:367`
3. As-Is/To-Be/**Exec** pill 의 Exec 옵션 — `ProcessHierarchyDesigner.vue:1484` (+ 슬라이더 폭 `mode-pill-track--three` L378)
4. "Exec Mode" 칩 + `applied_at` 칩 — `ProcessHierarchyDesigner.vue:69-71`
5. Exec 뷰어 pane (`ExecutableProcessView`) — `ProcessHierarchyDesigner.vue:402` (`execMode` 경유)
6. Properties "실행형 Pool" 지정 섹션 — `ProcessHierarchyProperties.vue:1125`
7. Blueprint Studio "실행형" 탭 버튼 + `AsIsToBeCompare` 의 executable prop — `ProcessBlueprintStudio.vue:31, 109`
8. `/executable`(`/실행형`, `/exec`) 슬래시 명령 + 자연어 의도 — `anIntentRouter.ts:108, 189`
9. 진입 핸들러 3종 (버튼 우회 방지) — `ProcessHierarchy.vue:1314`, `:3462`(handleRun), `:3634`(openExecInfo)

**게이트에 아직 안 걸려 있어 추가 처리가 필요한 것:**

10. `ExecInstancePanel` 마운트 자체 — `ProcessHierarchy.vue:581` 에 `v-if` 없음. 4초 폴링 타이머는 `modelValue` watch 로만 시작하므로 실동작 위험은 낮지만, 플래그 도입 시 `v-if="isExecUser"` 추가 권장
11. `StartEventSelectDialog` 마운트 — `ProcessHierarchy.vue:589` `v-if` 없음
12. 시작 폼 다이얼로그(`ProcessGPTExecute`) — `ProcessHierarchy.vue:598` 의 `v-dialog` 에 게이트 없음. 진입은 `openStartForm`(L3567) 뿐이고 그 앞이 `handleRun`이라 간접 보호됨. 단, 이 컴포넌트는 5개 다른 화면에서도 쓰이므로 게이트는 반드시 `ProcessHierarchy` 쪽에만
13. `ExecInstancePanel` 의 인스턴스/태스크 이동 링크 — `ExecInstancePanel.vue:258-267` (`/instancelist/...`, `/todolist/...`). 패널을 숨기면 자동 소멸
14. `onStartFormStarted` (`ProcessHierarchy.vue:3578`) — 위 (e)에서 언급한 대로 현재 dead code 로 보임. 정리 대상

**BPMN 모드 판정 로직 설계 시 참고할 데이터 후보** (모두 이미 로드되어 있음):
- `processDefinition.definition.tobe.executable.applied_at` — 실행 정의 등록 완료 여부 (`ProcessHierarchyAIGuide.vue:1606`)
- `processDefinition.definition.tobe.executable.definition` — 변환 결과 존재 여부 (`ProcessHierarchyAIGuide.vue:1607`)
- `executable.exec_pools` / `exec_pool_id` — 실행형 Pool 지정 (`ProcessHierarchyProperties.vue:4692-4696`)
- `backend.getExecutionDefinition(id).definition.activities.length &gt; 0` — 런타임 실행 가능 판정 (`ProcessHierarchy.vue:3469-3473`), 단 async 라 v-if 용으로는 캐싱 필요</result>
<usage><subagent_tokens>69342</subagent_tokens><tool_uses>44</tool_uses><duration_ms>238734</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-04T01:46:43.679Z (backfill)

```text
<task-notification>
<task-id>aa5107f4fa44a6a36</task-id>
<tool-use-id>toolu_019RuJ27bT7kQpsUkzAknm2P</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/aa5107f4fa44a6a36.output</output-file>
<status>completed</status>
<summary>Agent "AI 버튼 렌더 조건 전수 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have the complete picture. Here is the inventory.

## 1. AI Copilot 패널 / Copilot 진입점

| 기능명 | 파일:라인 | 버튼/패널 종류 | 현재 렌더 조건 | 플래그 v-if 삽입 지점 제안 |
|---|---|---|---|---|
| AI Copilot 패널 (ProcessHierarchyAIGuide 마운트) | `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchy.vue:161-199` | 우측 사이드 패널 | `v-if="selectedProcessId"` + `v-show="showCopilotPanel"` — **탭 아님. 프로세스가 선택되면 항상 마운트되고 토글은 v-show 뿐** (1567행 주석: 채팅에서 `$refs.copilotGuide` 를 직접 호출하려고 일부러 항상 마운트) | 162행 `v-if="selectedProcessId &amp;&amp; aiEnabled"` — v-show가 아니라 v-if를 바꿔야 `$refs.copilotGuide` 경로까지 죽는다 |
| Copilot 토글 버튼 | `.../ProcessHierarchyDesigner.vue:154-171` (v-btn 159, `@click="$emit('toggleCopilot')"` 165) | 툴바 v-btn "Copilot" (mdi-robot-outline) | **무조건 렌더** (`:disabled="!processNameText"` 뿐) | 154행 `&lt;v-tooltip&gt;` 에 `v-if="aiEnabled"` |
| Copilot 패널 딥링크 복원 | `.../ProcessHierarchy.vue:1499-1502` (`PROCESS_HIERARCHY_RIGHT_TAB.AI_GUIDE`, `navigation.ts:27`) | URL 상태 복원 | 무조건 | `showCopilotPanel = aiEnabled &amp;&amp; state.rightTab === ...` 런타임 가드 필요 |
| Copilot 내부 "답변 생성" | `.../ProcessHierarchyAIGuide.vue:215` | v-btn | 무조건 렌더 | 패널 자체를 v-if로 막으면 커버됨 |
| Copilot 내부 "바로 실행" / 추천질문 chips / 슬래시 메뉴 | `.../ProcessHierarchyAIGuide.vue:120`, `154-165`, `174-190` | 버튼·칩·자동완성 메뉴 | 무조건 렌더 | 동상 |

## 2. AI BPMN 생성 (generateBpmnMulti)

| 기능명 | 파일:라인 | 종류 | 현재 조건 | 삽입 지점 |
|---|---|---|---|---|
| "AI 생성" 툴바 버튼 → `openGenDialog` | `.../ProcessHierarchyDesigner.vue:280-294` (v-btn 282, 라벨 291) | 툴바 v-btn (mdi-auto-fix) | **무조건 렌더** (`:disabled="!processNameText \|\| isViewMode"` 뿐) | 280행 `&lt;v-tooltip v-if="aiEnabled"&gt;` |
| "AI로 BPMN 생성" 다이얼로그 | `.../ProcessHierarchyDesigner.vue:735` (`v-dialog v-model="genDialog"`) | v-dialog | **무조건 렌더** (v-model 뿐) | 735행 `v-if="aiEnabled"` 추가 (2차 방어) |
| 실제 호출부 | `.../ProcessHierarchyDesigner.vue:1966` `await generateBpmnMulti(...)`, 구현 `src/services/bpmnGenerationService.ts:387` | — | 없음 | `openGenDialog()` 진입부 early-return |

## 3. Blueprint Studio 진입점

| 기능명 | 파일:라인 | 종류 | 현재 조건 | 삽입 지점 |
|---|---|---|---|---|
| ProcessBlueprintStudio 마운트 | `.../ProcessHierarchy.vue:468-477` | 전체화면 다이얼로그 | `v-if="selectedProcessId &amp;&amp; processDefinition"` (AI 무관) | 469행에 `&amp;&amp; aiEnabled` |
| AnOrchestratorDialog | `.../ProcessHierarchy.vue:480` | v-dialog | **무조건 렌더** (v-model만) | `v-if="aiEnabled"` |
| AnRoadmapDialog | `.../ProcessHierarchy.vue:481` | v-dialog | **무조건 렌더** | `v-if="aiEnabled"` |
| 여는 경로 (버튼 아님) | `openToBeStudioDialog` `.../ProcessHierarchy.vue:1310-1321`, 리스너 `144`(Properties) / `189-191`(AIGuide) | — | **UI 버튼이 없음.** `openToBeDialog`/`openOrchestratorDialog`/`openRoadmapDialog` 는 오직 `ProcessHierarchyAIGuide.vue:1164, 1567, 1579, 1605` 에서만 emit. `ProcessHierarchyProperties.vue` 는 `openToBeDialog` 를 **한 번도 emit 하지 않음**(144행 리스너는 死코드) | Copilot 패널을 v-if로 끄면 진입 경로 전체가 자동 차단 |
| Blueprint "생성/재생성하기" | `.../blueprint/ProcessBlueprintStudio.vue:37-48` | 헤더 v-btn (mdi-auto-fix) | **무조건 렌더** (`:disabled="readonly"`) | 37행 `v-if="aiEnabled"` |
| Blueprint 빈 상태 "생성하기" | `.../blueprint/ProcessBlueprintStudio.vue:158-170` | 대형 v-btn | **무조건 렌더** | 158행 `v-if="aiEnabled"` |
| Exec(실행형) AI 변환 | `.../blueprint/ExecutableProcessView.vue:35-47`, `99-102` (`@click="$emit('generate')"`) → `ProcessHierarchyDesigner.vue:1654 onGenerateExecutable` | v-btn ×2 | 버튼 자체 무조건. 상위 `execMode`(`Designer.vue:1328`) → `canUseExecFeatures()` = admin 전용 | 35/99행에 `v-if="aiEnabled"` 또는 `execFeatureGate` 에 AI 플래그 AND |

## 4. BPMN 속성 패널 생성 버튼

`isBuiltinPropVisible()` = `builtinPanelVisibilityMixin.ts:23-33` — **스키마 오버라이드가 없으면 기본 true(노출)**, 예외 시에도 true. 즉 AI 게이트가 아니라 테넌트 스키마 게이트이며, 사실상 기본 렌더다.

| 기능명 | 파일:라인 | 종류 | 현재 조건 | 삽입 지점 |
|---|---|---|---|---|
| 조건 규칙 생성 | `.../bpmn/panel/SequenceFlowPanel.vue:28-29` | v-btn | `mode == 'ProcessGPT' &amp;&amp; isBuiltinPropVisible('condition_rule_generator')` | 28행 `&amp;&amp; aiEnabled` |
| 규칙 재생성 (미리보기 다이얼로그) | `.../SequenceFlowPanel.vue:52` | v-btn | 무조건 (다이얼로그 내부) | 트리거 차단으로 커버, 필요시 52행 |
| 조건 예시 생성 | `.../ConditionExampleField.vue:5-17` | v-btn | **컴포넌트 내부 무조건 렌더**. 부모 게이트는 `SequenceFlowPanel.vue:16-17` `v-if="isBuiltinPropVisible('examples')"` 뿐 | `ConditionExampleField.vue:4` 의 wrapper div에 `v-if="aiEnabled"` (예시 목록은 남기고 생성 버튼만 숨김) |
| Cron 규칙 생성 | `.../panel/EventPanel/TimerEventDefinitionPanel.vue:76-81` | v-btn | `isBuiltinPropVisible('cron_rule_generator')` | 76행 `&amp;&amp; aiEnabled` |
| Cron 재생성 | `.../TimerEventDefinitionPanel.vue:88` | 다이얼로그 내 v-btn | 무조건 | 88행 |
| 스크립트 생성 토글 카드 | `.../panel/GenerateScriptPanel.vue:4-15` | v-card(클릭 토글) | **무조건 렌더** | 4행 `v-row`에 `v-if="aiEnabled"` |
| 스크립트 생성 실행 | `.../GenerateScriptPanel.vue:27-30` | v-btn | `v-if="promptInput.isVisible"` (18행) | 동상 |
| ↳ 부모 게이트 | `.../ScriptTaskPanel.vue:23` `v-if="isBuiltinPropVisible('generate_script')"` / `.../GPTScriptTaskPanel.vue:21-22` 동일 | — | 스키마 게이트만 | 두 곳에 `&amp;&amp; aiEnabled` |
| API 생성 (SendTask) | `.../SendTaskPanel.vue:119-125` | div+v-btn (magic 아이콘) | `isBuiltinPropVisible('generate_api')` | 119행 `&amp;&amp; aiEnabled` |
| API 생성 (ServiceTask) | `.../ServiceTaskPanel.vue:55-62` | div+v-btn (magic 아이콘) | `isBuiltinPropVisible('generate_api')` | 55행 `&amp;&amp; aiEnabled` |
| Finalize 규칙 생성 | `.../SubProcessPanel.vue:80-81` | v-btn | `isBuiltinPropVisible('finalize_rule_generator')` (상위 70행 `mode == 'ProcessGPT'`) | 80행 `&amp;&amp; aiEnabled` |
| Finalize 재생성 | `.../SubProcessPanel.vue:116` | 다이얼로그 내 v-btn | 무조건 | 116행 |
| AI 요약 생성 (Phase 2-6) | `.../GPTUserTaskPanel.vue:30-42` (v-btn 31, `@click="generateAISummary"` 38) | v-btn (mdi-auto-fix) | `v-if="!isViewMode"` — **AI 조건 없음** | 31행 `v-if="!isViewMode &amp;&amp; aiEnabled"` |

## 5. 기타 AI 지점

| 기능명 | 파일:라인 | 종류 | 현재 조건 | 삽입 지점 |
|---|---|---|---|---|
| 프로세스 이름 AI 재생성 | `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionVersionDialog.vue:44-61` | text-field append-inner v-btn (mdi-auto-fix) | `information.name &amp;&amp; !isGeneratingName &amp;&amp; isNew &amp;&amp; mode === 'ProcessGPT'` | 44-45행 `&amp;&amp; aiEnabled` |
| 프로세스 ID AI 재생성 | `.../ProcessDefinitionVersionDialog.vue:78-96` | 동일 | `information.proc_def_id &amp;&amp; !isGeneratingId &amp;&amp; isNew &amp;&amp; mode === 'ProcessGPT'` | 78-79행 `&amp;&amp; aiEnabled` |
| 이름 입력 후 2초 뒤 **자동** ID 추천 | `.../ProcessDefinitionVersionDialog.vue:397-414` (watch) | UI 없음 (자동 호출) | 무조건 | `generateIdSuggestions()` 진입부 early-return |
| 버전 diff 요약 AI 생성 | `.../ProcessDefinitionVersionDialog.vue:747` 호출 / `896 generateVersionDiffDescription` | **UI 버튼 없음, 저장 시 자동 호출** | 무조건 | 747행 `if (aiEnabled)` 또는 896행 함수 초입 가드 |
| 폼 AI 인터뷰 챗 (FormInterviewChat) | `/home/kimsanghoon/process-gpt-vue3/src/components/apps/todolist/FormWorkItem.vue:88-136` (탭·컴포넌트), `222` import, `235` 등록 | — | **전체가 주석 처리된 死코드**. `isGeneratingExample` 은 prop(269행)으로 109행 readonly 계산에만 사용 | 작업 불필요 |
| 워크아이템 AI 예시 생성 (실제 진입점) | `/home/kimsanghoon/process-gpt-vue3/src/components/apps/todolist/WorkItem.vue:385-397` (`triggerBasicLlmAgentFromResearchMethod`, sparkles), `451-467` (`beforeGenerateExample`, 모바일) | v-btn ×2 | `v-if="!isMobile &amp;&amp; !gs"` / `v-if="isMobile"` — **AI 조건 없음** | 각각 `&amp;&amp; aiEnabled` |
| 조직도 AI 챗 | `/home/kimsanghoon/process-gpt-vue3/src/components/OrganizationChartChat.vue:2-32` | — | **챗 UI 전체 주석 처리**. `ChatGenerator` 인스턴스만 135행에 생성됨(렌더 없음). 라우팅은 `router/MainRoutes.ts:97,105` 에서 `window.$pal` 로 분기 | UI 작업 불필요 (135행 인스턴스화만 선택적 가드) |
| TeamChat `/agent` 커맨드 | `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionTeamChat.vue:217-231` (커맨드 정의), `609` 필터, `669` 판별, `552-566` 실행 | 슬래시 자동완성 메뉴 | `agentCommandEnabled` prop (249-252, default **false**) — `ProcessHierarchy.vue:213` 에서 `hasEditAccess &amp;&amp; !isReadOnlyMode` 로 주입 | 213행 `hasEditAccess &amp;&amp; !isReadOnlyMode &amp;&amp; aiEnabled` (prop 하나로 커맨드+핸들러 동시 차단 가능 — 가장 깔끔한 지점) |
| TeamChat(AI Chat) 패널 자체 | `.../ProcessHierarchy.vue:203-221` | 우측 패널 | `v-if="showTeamChatPanel &amp;&amp; selectedProcessId"` | 203행 `&amp;&amp; aiEnabled` |
| ↳ 주의: 이 패널의 토글 UI | `.../ProcessHierarchy.vue:925-979` `collapsedMenuItems` 내 'AI Chat' 항목(970-977) | — | **`collapsedMenuItems` 는 템플릿에서 전혀 렌더되지 않는 死 computed**. Designer도 `toggleTeamChat` 을 emits 선언(1142)만 하고 emit 하지 않음 → 현재 이 패널은 열 수 있는 UI가 없음 | 참고용 |
| Lane 설명 AI 생성 | `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue:1211-1222` (`@click="triggerGenerateLaneDescription"`) | v-btn | **무조건 렌더** (`:disabled="isViewMode \|\| laneDescriptionGenerating"`). 단 아이콘/라벨이 1220-1221행에 주석 처리돼 시각적으로 빈 버튼 | 1211행 `v-if="aiEnabled"` |
| Lane 설명 재생성 확인 다이얼로그 | `.../ProcessHierarchyProperties.vue:3816-3824` | v-dialog | v-model만 | 3816행 `v-if="aiEnabled"` |
| PI Flag "Agent 분석" 탭 | `.../ProcessHierarchyProperties.vue:2572-2585` | v-tab (mdi-robot-outline) | `isBuiltinPropVisible('process', 'pi_flag_agent_chat')` | 2572행 `&amp;&amp; aiEnabled` |
| PI Flag 기반 AI 질문 (qdrantChat) | `.../ProcessHierarchyProperties.vue:2806-2896` (전송 v-btn 2885-2895) | 챗 블록 + 전송 v-btn | **무조건 렌더** (탭 내부) | 2807행 `.pi-flag-chat` div에 `v-if="aiEnabled"` |

## 6. 이미 존재하는 조건부 은닉 패턴 (재사용 가능)

| 패턴 | 위치 | 성격 |
|---|---|---|
| `canUseExecFeatures()` → `authClaimsState.isAdmin` | `/home/kimsanghoon/process-gpt-vue3/src/utils/execFeatureGate.ts:10-12`. 사용처: `ProcessHierarchyDesigner.vue:1325,1484`, `ProcessBlueprintStudio.vue:250`, `ProcessHierarchy.vue:1314,3462,3634`, `ProcessHierarchyProperties.vue:4688`, `composables/anStudio/anIntentRouter.ts:108,189` | **가장 좋은 참고 모델** — 단일 util 함수 + computed 노출. `aiFeatureGate.ts` 를 같은 형태로 만들면 기존 코드와 일관됨 |
| `window.$pal` / `window.$mode === 'ProcessGPT'` 분기 | `main.ts:385`, `router/MainRoutes.ts:97,105,107,188,446,651`, `BpmnUengine.vue:250`, `ProcessDefinitionVersionDialog.vue:373`, `BpmnPropertyPanel.vue:338`, `PALUserTaskPanel.vue:200` 등 다수 | 제품 모드 분기. AI 플래그와는 축이 다름 |
| `isBuiltinPropVisible(key)` (task_property_schema) | `builtinPanelVisibilityMixin.ts:23-33` | 테넌트별 필드 게이트. **기본값 true** 이므로 AI 은닉 용도로는 부적합 |
| `isDevMode` (localStorage) | `components/UIDefinitionChat.vue:240` + `:89`, `components/FormDefinition.vue:129` + `:30`(주석) | 로컬 개발 토글. 전역 AI 플래그로 쓰기엔 부적절 |
| `agentCommandEnabled` prop (default false) | `ProcessDefinitionTeamChat.vue:249-252` | 유일하게 "AI 명령을 prop 하나로 끄는" 기존 패턴 |

## 요약: 플래그 작업이 필요한 지점 수

- **AI 관련 조건이 전혀 없는 완전 무조건 렌더: 14 지점**
  `Designer.vue:154`(Copilot 토글), `Designer.vue:280`(AI 생성), `Designer.vue:735`(생성 다이얼로그), `ProcessHierarchy.vue:480`(AnOrchestratorDialog), `:481`(AnRoadmapDialog), `BlueprintStudio.vue:37`, `:158`, `ExecutableProcessView.vue:35`, `:99`, `AIGuide.vue:215`, `AIGuide.vue:120/154/174`(패널 내부 묶음), `Properties.vue:1211`(Lane AI 설명), `Properties.vue:2806`(PI Flag AI 질문), `ConditionExampleField.vue:5`(예시 생성)
- **AI와 무관한 조건(권한·모드·스키마·뷰모드)만 걸려 있어 플래그 AND 추가가 필요한 지점: 15 지점**
  `ProcessHierarchy.vue:162`(Copilot 패널), `:203`(TeamChat 패널), `:213`(agentCommandEnabled), `:468`(BlueprintStudio), `Properties.vue:2572`, `SequenceFlowPanel.vue:28`, `TimerEventDefinitionPanel.vue:76`, `ScriptTaskPanel.vue:23`, `GPTScriptTaskPanel.vue:21`, `GenerateScriptPanel.vue:4`, `SendTaskPanel.vue:119`, `ServiceTaskPanel.vue:55`, `SubProcessPanel.vue:80`, `GPTUserTaskPanel.vue:31`, `WorkItem.vue:385/451`
- **UI 버튼 없이 자동 실행되어 v-if로는 못 막고 런타임 가드가 필요한 지점: 3곳**
  `ProcessDefinitionVersionDialog.vue:747`(diff 요약 자동 생성), `:397-414`(이름 watch → 자동 ID 추천), `ProcessHierarchy.vue:1502`(URL rightTab=ai-guide 복원)
- **작업 불필요(死코드)**: `FormWorkItem.vue` 의 FormInterviewChat 탭(전체 주석), `OrganizationChartChat.vue` 챗 UI(전체 주석), `ProcessHierarchy.vue:925 collapsedMenuItems`(미렌더), `ProcessHierarchy.vue:144` 의 Properties `openToBeDialog` 리스너(emit 없음)
- **총 32 지점** (v-if 29 + 런타임 가드 3). 다만 `Designer.vue:280` + `ProcessHierarchy.vue:162` 두 곳만 막아도 Blueprint Studio / Orchestrator / Roadmap / `/agent` 슬래시 명령 진입 경로 전체가 연쇄 차단되므로, 우선순위는 이 2곳 → BPMN 패널 8곳 → 나머지 순이다.</result>
<usage><subagent_tokens>84724</subagent_tokens><tool_uses>57</tool_uses><duration_ms>321722</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-04T05:56:09.866Z (backfill)

```text
실행 게이트부터 구현 시작해줘
```

## Prompt — 2026-09-04T08:53:06.756Z (backfill)

```text
AI 게이트도 이어서 구현해줘
```

## Prompt — 2026-09-08T00:55:53.253Z (backfill)

```text
다음 필요한 작업은? 어떤건지부터.
```

## Prompt — 2026-09-08T00:58:05.499Z (backfill)

```text
진행해.
```

## Prompt — 2026-09-08T01:03:11.262Z (backfill)

```text
커밋하고 2순위 이어서 진행해
```

<!-- backfilled-from: 4d0e7f28-98f7-4fd3-92f3-e2c706af49ac -->

## Prompt — 2026-09-07T07:41:04.833Z (backfill)

```text
점검모드 활성화 시, admin이 아닌 유저도 사용가능한 상태.
```

<!-- backfilled-from: a61c2753-3c00-45d0-83bf-cc65d7b96f4a -->

## Prompt — 2026-09-07T08:19:24.210Z (backfill)

```text
/goal 분석 대시보드 데이터가 현재 데이터를 기준으로는 정상적으로 보이지 않는 상황임. 따라서 현재 데이터 구조에맞게 분석대시보드쪽 backend(~/process-gpt-completion)쪽 업데이트가 필요해보임.
```

<!-- backfilled-from: 79411c1a-67d1-40e4-9130-ccd548eac712 -->

## Prompt — 2026-09-08T06:43:24.261Z (backfill)

```text
> 담당자 명 통일 (순서도쪽 명칭으로)
  - 검색
  - 새 프로세스 등록
> 템플릿 추가 (프로세스 생성/목록)
> PI Flag 기능 점검 (remote쪽 기능)
> Task 종류 설정과 프로세스 순서도에 Task 변경 유형 부분이 Sync 안맞음.
> 프로세스 순서도에서 담당자 변경쪽 제대로 안뜨는 부분 있음. (프로세스 담당자, 최종검토자)
```

## Prompt — 2026-09-08T06:46:59.187Z (backfill)

```text
<task-notification>
<task-id>a3d8cf22d5abf8dda</task-id>
<tool-use-id>toolu_0117vaWyqyvDCtaC6PpzEaK2</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/a3d8cf22d5abf8dda.output</output-file>
<status>completed</status>
<summary>Agent "프로세스 템플릿 기능 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have a complete picture. Here are my findings.

## 1. Process creation (프로세스 생성)

**Main dialog: `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/NewProcessDialog.vue`** (1422 lines)

- Opened from `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue:426` (`&lt;NewProcessDialog v-model="showNewProcessDialog" :procMap :domains @created="onProcessCreated" /&gt;`), triggered by the "+" button at `ProcessArchitecture.vue:91`, and also from the per-cell `@addProcess="openAddProcessDialog"` in the card/tree/matrix/mermaid views (`ProcessArchitecture.vue:346-420`).
- After creation, `ProcessArchitecture.vue:1825` `onProcessCreated()` routes to the `Process Hierarchy` designer in EDIT mode and reloads the list.

**Form state — `NewProcessDialog.vue:505-521`:**
```ts
creationType: 'scratch' as 'scratch' | 'template' | 'clone' | 'upload',
sourceProcessId: null as string | null,
```
Other fields: `processMode` (asis/tobe), name, description, domain/mega/major, owners (primaryOwner/fieldOwners/hqOwners/masterOwner), `sourceMappings`, `isCallActivitySub`.

**Save flow — `createProcess()` at `NewProcessDialog.vue:1057`:**
- `isCloneFlow` = `processMode === 'asis' &amp;&amp; creationType !== 'scratch' &amp;&amp; creationType !== 'upload'` (`:1073-1076`) — this means **`template` and `clone` take the exact same code path**.
  - Loads source via `backend.getRawDefinition(sourceId)` (`:1084`), normalizes the `type` marker (`:1104-1109`), builds `subEntryExtras` for proc_map (`:1111-1118`), then calls `backend.duplicateLocalProcess(sourceId, name, bpmn, definition, { targetMegaId, targetMajorId, subEntryExtras, skipProcMap })` (`:1121`).
- Else (scratch/upload/tobe): builds `defaultBpmn` with Lane + StartEvent → ManualTask → EndEvent (`:1138`), ID `${idPrefix}${defId}-${Date.now()}` (`:1202-1208`), then `backend.putRawDefinition(initialBpmn, uniqueId, {...})` (`:1211`).
- Then `syncProcessDefinitionMetadata()` (`:1262`) and `updateProcMap()` (`:1369`, which calls `backend.putProcessDefinitionMap(map)` and `syncProcessDefinitionHierarchyFromMap`).

## 2. Existing "template" concept — it is a stub/alias, not a real feature

This is the key finding: **a `template` creation type already exists in the UI but is functionally identical to `clone`.**

- UI toggle button exists: `NewProcessDialog.vue:353-355` (`&lt;v-btn value="template"&gt;`).
- Info text: `creationTypeInfo` at `:994-1008`, case `'template'` → "기존 표준 템플릿을 기반으로 프로세스를 빠르게 시작합니다."
- Validation: `:1022` treats template and clone identically (both just require `sourceProcessId`).
- **Source list is shared**: `selectableExistingProcesses` (`NewProcessDialog.vue:746-755`) returns ordinary existing processes filtered to those present in `proc_map`; the only template/clone difference is that clone additionally allows call-activity sub-modules (`:750`). There is no template registry, no `isTemplate` flag, no template-only filter.
- i18n keys already present at `/home/kimsanghoon/process-gpt-vue3/src/utils/locales/ko.json:997` (`"template": "템플릿"`), `:999` (`"selectTemplate": "템플릿을 선택하세요..."`), `:1017` (`"templateInfo"`). English equivalents in `en.json` around `:968`.

So the work is: give `template` a real backing source + a template flag, and surface templates in the list.

**Other template-adjacent things that exist:**
- **Marketplace** (`proc_def_marketplace` table) is the closest real "shared definition library": schema at `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260101_base_schema.sql:253-267` with `id, name, definition, bpmn, description, category, tags, author_name, image, import_count`. UI: `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionMarketPlace.vue` and `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionMarketPlaceDialog.vue` (register at `:203`). Backend methods in `ProcessGPTBackend.ts:5676` (`proc_def_marketplace_latest` view), `:5762`, `:5815`, `:6319-6419` (register version row), `:6469`, `:6506`. Only mounted inside `ProcessDefinitionMap.vue:780,800` and `ProcessDefinitionChat.vue:447` — **not wired into `NewProcessDialog`**.
- **`type` marker on proc_def** is the existing precedent for a boolean-ish flag: `proc_def.type` (schema `20260101_base_schema.sql:112`) + `definition.type === 'call-activity-sub'`, read by `/home/kimsanghoon/process-gpt-vue3/src/utils/processStages.ts:169-200` (`isCallActivitySubModule`). An `isTemplate` / `type: 'template'` marker would follow this same pattern and be picked up by the existing list queries for free.
- **Sample BPMN files**: `/home/kimsanghoon/process-gpt-vue3/samples/tym/` — 25 `.bpmn` files plus `manifest.json` and `process-map.json`, generated by `/home/kimsanghoon/process-gpt-vue3/scripts/generate-tym-sample-bpmn.mjs:272-273`. **Nothing at runtime loads these** (grep over `src/`, `playwright/`, `supabase/` found no reference) — they are a generator output only. Root file `P5.4.3_내부심사_프로세스.bpmn` is likewise unreferenced. These are the obvious candidate seed content for a template library. Note `manifest.json` matches in `src/utils/processComponentPackage.ts:424,473` are a *different* manifest (zip component packages), not these samples.

## 3. Process list (프로세스 목록)

Two distinct screens:

- **`/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue`** (1954 lines) — route `/process-architecture` (`/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts:438`), and the post-login default redirect (`/home/kimsanghoon/process-gpt-vue3/src/router/index.ts:173`). PAL-aware via `isPalMode` at `:687` (used at `:266`). Renders four sub-views: `ProcessArchCardView.vue`, `ProcessArchTreeView.vue`, `ProcessArchMatrixView.vue`, `ProcessArchMermaidView.vue` (`:346-420`).
- **`/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/ProcessDefinitionMap.vue`** (3134 lines) — routes `/definition-map`, `/definition-map/mega/:id`, `/definition-map/major/:id`, `/definition-map/sub/:pathMatch(.+)` (`MainRoutes.ts:148-183`). PAL branch at `:945-949` (`window.$pal &amp;&amp; window.$mode === 'uEngine'`), marketplace mounted at `:780/:800`.

**Data loading for the list**: `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/useProcessArchitecture.ts` — `loadData()` at `:513` (`getProcessDefinitionMap` + `getMetricsMap`) and `loadProcessStatuses()` at `:528`, which calls `backend.listDefinitionStatusLite('', { match: { isdeleted: false } })` (`:530`) and joins `proc_def_approval_state`, `proc_def_version`, `tb_bpmn_model`.

## 4. Data / service layer

- `src/services/` contains **no** process-definition CRUD. Definition persistence lives in the backend classes under `/home/kimsanghoon/process-gpt-vue3/src/components/api/`.
- **`BackendFactory.ts:119-125`** selects the implementation: `window.$pal === true` → `PalUengineBackend` (if mode `uEngine`) or `PalModeBackend`; otherwise `ProcessGPTBackend`.
- **`PalModeBackend.ts`** (extends `ProcessGPTBackend`) holds the PAL-mode Supabase queries — most relevant:
  - `listDefinitionStatusLite()` `:474` — `from('proc_def').select('id,name,description,definition,prod_version,owner,type,tenant_id,saved_at,deleted_at').eq('tenant_id',…).is('deleted_at', null)`. **This already selects `type` and `definition`, so a template marker stored there needs no query change.**
  - `getDefinitionDetailLite()` `:492`, `updateProcessDefinitionMetadata()` `:509`, `getRawDefinition()` `:103`, `deleteDefinition()` `:81`, `restoreDefinition()` `:92`, `syncProcessDefinitionHierarchyFromMap()` `:581`.
- **`ProcessGPTBackend.ts`**: `putRawDefinition()` `:449`, `getRawDefinition()` `:679`, `getProcessDefinitionMap()` `:1888`, `putProcessDefinitionMap()` `:1938`, `duplicateLocalProcess()` `:6664`.
- Legacy direct `proc_def` access also in `/home/kimsanghoon/process-gpt-vue3/src/utils/StorageBaseSupabase.js:1287`.
- **`proc_def` schema**: `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260101_base_schema.sql:103-118` — `id, name, definition jsonb, bpmn, prod_version, uuid, tenant_id, isdeleted, owner, type`. Later migrations add `deleted_at` (`20260316_add_deleted_at_to_proc_def.sql`), `saved_at` (`20260408_add_saved_at_to_proc_def.sql`), `description` (`20260413_add_proc_def_description.sql`), hierarchy columns (`20260428_proc_def_hierarchy_columns.sql`), editor insert policy (`20260521000001_proc_def_editor_insert_policy.sql`). Consolidated view in `supabase/manual/00_consolidated_schema.sql`.

## Summary of hooks that exist vs. don't

Exists: `creationType: 'template'` enum value, toggle button, info alert, validation branch, i18n keys (ko + en), a source-picker autocomplete, `duplicateLocalProcess` backend copy path, a `type`-marker convention on `proc_def`, a marketplace table/UI for shared definitions, and 25 unused sample BPMN files.

Missing: any way to *mark* a definition as a template (no `isTemplate`/`template_id`/`type:'template'` anywhere), any template-only query or filter in `selectableExistingProcesses` (`NewProcessDialog.vue:746`), any template presentation in the list views (`ProcessArchCardView/Tree/Matrix/Mermaid`), any migration adding template columns, and any link between `NewProcessDialog` and the marketplace or the `samples/tym` BPMN files.</result>
<usage><subagent_tokens>58055</subagent_tokens><tool_uses>34</tool_uses><duration_ms>160135</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-08T06:47:10.354Z (backfill)

```text
<task-notification>
<task-id>a269af40fc8681570</task-id>
<tool-use-id>toolu_01NKcZ56tcK5rDjeYCuP1fro</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/a269af40fc8681570.output</output-file>
<status>completed</status>
<summary>Agent "Task 종류 sync 불일치 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have the full picture. Here are the findings.

## 1. Admin side — "Task/Event 종류 설정"

**Screen:** `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/TaskTypeManagement.vue` (title literally `Task/Event 종류 설정`), routed at admin path `task-types` in `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts:593-600`. It renders `/home/kimsanghoon/process-gpt-vue3/src/components/admin/TaskTypeSettings.vue` (Task tab + Event tab, one on/off switch per row).

**Master list (hardcoded in the store, not in DB):**
- `AVAILABLE_TASK_TYPES` — `/home/kimsanghoon/process-gpt-vue3/src/stores/taskCatalog.ts:105-118` — 12 entries: `bpmn:Task, ManualTask, ServiceTask, UserTask, ScriptTask, BusinessRuleTask, SendTask, ReceiveTask, CallActivity, SubProcess, AdHocSubProcess, Transaction` (value/label/labelKo; icons+colors live separately in `TaskTypeSettings.vue:182-233`).
- `AVAILABLE_EVENT_TYPES` — `taskCatalog.ts:122-301` — ~45 entries keyed by **bpmn-js replace-menu ids** (`replace-with-none-start`, `replace-with-timer-boundary`, …), i.e. explicitly designed to filter the 변경(replace) menu.

**Two parallel persistence paths (already a split brain):**
- Legacy: `configuration` row `key='palette_settings'`, JSON `{visibleTaskTypes, visibleEventTypes}` — `ProcessGPTBackend.ts:9327-9357`; store actions `loadPaletteSettings`/`savePaletteSettings`/`setTaskTypeVisible`/`setEventTypeVisible` at `taskCatalog.ts:715-831`.
- New: table `palette_task_types` — `ProcessGPTBackend.ts:9363-9381`; store `loadPaletteTaskTypes`/`togglePaletteTaskType` at `taskCatalog.ts:833-890`, getter `enabledPaletteTaskTypes` at `taskCatalog.ts:1036`.
- `TaskTypeSettings.vue:137-157` merges them: if a `palette_task_types` DB row exists for the type it wins (`source:'db'` → `togglePaletteTaskType`), otherwise it falls back to `visibleTaskTypes` (`source:'settings'` → `setTaskTypeVisible`). **Events have only the legacy path.**

Separate from this, the "Task 카탈로그" admin (`src/components/admin/TaskCatalogAdmin.vue`, `TaskCatalogList.vue:173`, `TaskCatalogDialog.vue:167`) stores catalog rows in `task_catalog`, and each row's `task_type` dropdown is also built from the same `AVAILABLE_TASK_TYPES`.

## 2. Designer side — how "변경 유형" is built

The designer publishes the admin values onto `window` once, in `BpmnUengine.vue:883-901` (called from `mounted()` at `BpmnUengine.vue:263`): `window.$enabledPaletteTaskTypes`, `window.$paletteSettings`.

Three different consumers, each with its own hardcoded list:

**(a) Right-click / context-pad "변경" popup (the main `bpmn-replace` menu) — reads NOTHING from the catalog.**
- Opened at `/home/kimsanghoon/process-gpt-vue3/src/components/customContextPad/CustomContextPad.js:968` (`popupMenu.open(element, 'bpmn-replace', …)`).
- The only registered customization is `/home/kimsanghoon/process-gpt-vue3/src/components/customReplaceElement/CustomReplaceElement.js` (registered `BpmnUengine.vue:2031`), which extends bpmn-js `ReplaceMenuProvider` and **only translates labels** (`_createEntries` lines 18-27). No filtering.
- The filtering provider `/home/kimsanghoon/process-gpt-vue3/src/components/customReplace/CustomReplaceMenuProvider.js` — the one that actually reads `window.$enabledPaletteTaskTypes` / `$paletteSettings.visibleTaskTypes` (lines 19-29) and filters entries (lines 52-73) — is **commented out of the module list**: `BpmnUengine.vue:91` (`// import customReplaceModule`) and `BpmnUengine.vue:2033-2034` (`// skt 마이그레이션 요소 변경 비활성화 / // customReplaceModule,`).
- Net effect: the popup shows bpmn-js's full stock replace list (all tasks, all events, gateways), minus exactly one hardcoded deletion: `replace-with-conditional-intermediate-catch` in `/home/kimsanghoon/process-gpt-vue3/src/components/customPopupMenu/CustomPopupMenu.js:16` + `54-56`.

**(b) Multi-select "타입 변경" menu — reads the catalog, but from a hardcoded 7-item list (duplicated twice).**
- `CustomContextPad.js:986-1009` (`showMultiTaskReplaceMenu`) and a near-identical copy at `CustomContextPad.js:1204-1231` (`showMultiTaskReplaceMenuForElements`).
- Hardcoded types: ManualTask, ServiceTask, UserTask, ScriptTask, BusinessRuleTask, SendTask, ReceiveTask. Filtered by `enabledTypes` at `CustomContextPad.js:1011-1012` and `1228-1229`.

**(c) Palette (좌측 도구모음) — catalog reading is commented out and replaced by a hardcoded string.**
- `/home/kimsanghoon/process-gpt-vue3/src/components/customPalette/PaletteProvider.js:1268-1274`:
  ```js
  // var visibleTaskTypes = enabledTaskTypes.length &gt; 0 ? ... : window.$paletteSettings?.visibleTaskTypes || ['bpmn:UserTask'];
  var visibleTaskTypes = 'bpmn:UserTask';
  ```
  It is a **string**, so the subsequent `visibleTaskTypes.includes('bpmn:ManualTask')` checks (lines 1276-1338) are substring tests that all fail except `includes('bpmn:UserTask')`. The palette therefore always shows exactly UserTask regardless of admin settings.

## 3. The exact divergence points

| # | Divergence | Admin ref | Designer ref |
|---|---|---|---|
| 1 | **Replace ("변경 유형") menu ignores the catalog entirely** — the only filtering provider is disabled | `TaskTypeSettings.vue:143-157` toggles persist fine | `BpmnUengine.vue:2033-2034` (`customReplaceModule` commented out); `customReplaceElement/CustomReplaceElement.js:18-27` does labels only |
| 2 | **All ~45 Event toggles are dead code** — `visibleEventTypes` has zero consumers outside the store/admin (grep confirms) even though its keys are exactly the replace-menu ids | `taskCatalog.ts:122-301`, `setEventTypeVisible` `:795-825` | no reader anywhere in `customReplace*`, `CustomContextPad.js`, `PaletteProvider.js` |
| 3 | **Palette hardcodes a single type**, contradicting whatever admin shows as enabled | `AVAILABLE_TASK_TYPES` 12 types | `PaletteProvider.js:1274` `var visibleTaskTypes = 'bpmn:UserTask'` |
| 4 | **List-length mismatch, 12 vs 11 vs 7 vs 7** | admin: 12 types | `customReplace/CustomReplaceMenuProvider.js:35-47` `TASK_TYPE_MAP` has 11 keys (**missing `replace-with-adhoc-subprocess` and `replace-with-transaction`**, so `bpmn:AdHocSubProcess` / `bpmn:Transaction` toggles could never take effect even if the module were re-enabled); multi-task menus have **7** (missing `bpmn:Task`, `CallActivity`, `SubProcess`, `AdHocSubProcess`, `Transaction`); palette handles 7 conditionally and unconditionally adds SubProcess/CallActivity later |
| 5 | **Empty-array fallback bug** — if `palette_task_types` is empty, `window.$enabledPaletteTaskTypes` is `[]`; `[]?.map(...)` yields `[]` which is truthy, so the `\|\|` fallback to `visibleTaskTypes` never runs and **every** type is filtered out of the multi-select menu | — | `CustomContextPad.js:1011-1012` and `1228-1229` (contrast the correct `enabledTypes.length &gt; 0` guard at `customReplace/CustomReplaceMenuProvider.js:20-28`) |
| 6 | **Different defaults on every layer** — admin default = all 12 (`DEFAULT_VISIBLE_TASK_TYPES`, `taskCatalog.ts:120`); backend default = `['bpmn:ManualTask','bpmn:ServiceTask']` (`ProcessGPTBackend.ts:9335-9338`); designer error fallback = `['bpmn:UserTask']` (`BpmnUengine.vue:899`); uEngine backend = `['bpmn:UserTask']` (`UEngineBackend.ts:2077`); replace-provider fallback = `['bpmn:UserTask','bpmn:ManualTask','bpmn:ServiceTask']` (`CustomReplaceMenuProvider.js:26,28`) | | |
| 7 | **No live sync / cache pinning** — `window.$paletteSettings` is written once in `BpmnUengine.vue:883-895` before `initializeViewer()`; admin toggles only refresh `window.$paletteTaskTypes` from the admin page (`taskCatalog.ts:861-863`) and never `window.$paletteSettings` from `togglePaletteTaskType`. Plus `loadPaletteSettings`/`loadPaletteTaskTypes` early-return on `*Loaded` flags (`taskCatalog.ts:716, 834`), so an open designer tab keeps stale values until a full reload | | |
| 8 | **Two sources of truth for the same switch** (`palette_task_types` table vs `configuration.palette_settings` JSON) that are never reconciled — admin prefers DB, designer consumers prefer DB with a broken fallback, and `setTaskTypeVisible` writes only the JSON | `TaskTypeSettings.vue:140-155, 242-247` | `CustomContextPad.js:1011`, `CustomReplaceMenuProvider.js:19-29` | 

The single highest-impact line for the reported symptom: `/home/kimsanghoon/process-gpt-vue3/src/components/BpmnUengine.vue:2034` — re-enabling `customReplaceModule` is what would connect "Task 종류 설정" to the flowchart's "변경 유형" popup (and it would then also need `TASK_TYPE_MAP` completed for AdHocSubProcess/Transaction plus an event-key branch for `visibleEventTypes`).</result>
<usage><subagent_tokens>68358</subagent_tokens><tool_uses>27</tool_uses><duration_ms>157846</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-08T06:48:16.609Z (backfill)

```text
<task-notification>
<task-id>a193252820a3f2e08</task-id>
<tool-use-id>toolu_0178ULsPHTe3XWV1UgFH9Ajs</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/a193252820a3f2e08.output</output-file>
<status>completed</status>
<summary>Agent "담당자 명칭 불일치 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## Summary of the mismatch

There are **four owner/assignee roles** stored in `process_definition.definition.meta.owners` (`primaryOwner`, `fieldOwners`, `hqOwners`, `masterOwner`). Three UIs label them differently, and the registration + filter UIs use raw English (`Primary Owner`, `Co-Owner`, `Master`).

---

## 1. Flowchart / BPMN designer side (canonical naming)

The real property panel is **`/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue`** (the `bpmnModeling/bpmn/panel/*` GPT/uEngine stack is *not* in the execution path — stated at `builtinPanelProperties.ts:1-15`).

| Data key | Label | Location |
|---|---|---|
| section header | `프로세스 담당자` | `ProcessHierarchyProperties.vue:89` — `builtinLabel('process', 'owner', '프로세스 담당자')` |
| `primaryOwner` | `프로세스 담당자:` | `ProcessHierarchyProperties.vue:132` (and `:209` in 변경 이력 dialog) |
| `fieldOwners` | `현업담당자:` | `ProcessHierarchyProperties.vue:139` (and `:213`) |
| `hqOwners` | `검토담당자:` | `ProcessHierarchyProperties.vue:146` (and `:217`) |
| `masterOwner` | `최종검토자:` | `ProcessHierarchyProperties.vue:153` (and `:221`) |

Edit dialog launched from that panel — **`/home/kimsanghoon/process-gpt-vue3/src/components/ui/OwnerSettingDialog.vue`**:
- `:20` `label="프로세스 담당자"` / placeholder `프로세스 담당자를 선택하세요`
- `:21` `label="현업 담당자"` (note: **with a space**, vs `현업담당자` in the panel) / `현업 담당자를 선택하세요`
- `:22` `label="검토담당자"` / `검토담당자를 선택하세요`
- `:23` `label="최종검토자"` / `최종검토자를 선택하세요`
- Dialog title only comes from locale: `ownerSettingDialog.title` → `ko.json:3930` `"담당자 설정"`; `ko.json:3931` `"owner": "프로세스 담당자"` (key defined but **unused** — the dialog hardcodes labels).

Registry row (schema seed, drives visibility + optional label override):
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/builtinPanelProperties.ts:50` — `{ taskType: 'process', key: 'owner', labelKo: '프로세스 담당자', widget: 'dialog', binding: 'OwnerSettingDialog' }`. Only the **section header** is overridable from `task_property_schema` (`taskCatalog.ts:1019 builtinPropLabel`); the 4 sub-labels are hardcoded.

Task-level (Lane) assignee in the same panel:
- `ProcessHierarchyProperties.vue:1246` `Lane 담당 지정` (registry `builtinPanelProperties.ts:109`)
- `:1264` comment + `:1270` toggle buttons `담당자` / `담당 조직` (hardcoded)

Same canonical set is reused in AI context: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyAIGuide.vue:510-513` → `프로세스 담당자 / 현업담당자 / 검토담당자 / 최종검토자`.

---

## 2. Search UI

There are **two** "search" surfaces, both inconsistent:

### 2a. 프로세스 체계도 필터/검색 — `AdvancedFilterPanel.vue` (shared, non-PAL-gated)
`/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/AdvancedFilterPanel.vue`, mounted from `ProcessArchitecture.vue:428-435`.

| Line | i18n key | ko.json label |
|---|---|---|
| `:95` | `processArchitecture.advancedFilter.ownership` | `ko.json:884` `"담당자"` |
| `:101` | `...ownerSearch` | `ko.json:885` `"담당자 검색..."` |
| `:116` | `...ownerRole` | `ko.json:886` `"담당 역할"` |
| `:211` | `...ownerRoleAny` | `ko.json:887` `"모든 역할"` |
| `:212` | `...ownerRolePrimary` | `ko.json:888` **`"Primary Owner"`** ← English in ko locale |
| `:213` | `...ownerRoleCo` | `ko.json:889` **`"Co-Owner"`** |
| `:214` | `...ownerRoleMaster` | `ko.json:890` **`"Master"`** |

Note the filter model (`AdvancedFilterPanel.vue:187`) only has 3 roles (`primary | co | master`) — it collapses `fieldOwners` + `hqOwners` into one "Co-Owner", so 현업/검토 담당자 cannot be filtered separately.

### 2b. 프로세스 목록 검색 — `CallActivityManagement.vue` (**PAL-only**)
`/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/CallActivityManagement.vue`; route `/call-activity-management` is inside the `window.$pal ? [...] : []` block at `MainRoutes.ts:487-491`; sidebar entry `'프로세스 목록'` is PAL-only at `VerticalSidebar.vue:795-802`.

| Line | Label (hardcoded) |
|---|---|
| `:23` | search placeholder `"프로세스명, ID, PI/현업 담당자"` |
| `:225` | column `'PI팀담당자'` (key `pi_owner_name`) ← **mismatch**, flowchart says `프로세스 담당자` |
| `:226` | column `'현업담당자'` |
| — | no `검토담당자` / `최종검토자` columns |

### 2c. 검토보드 검색 (shared, `/review-board`) — mostly correct
`/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ProcessReviewBoard.vue`
- `:1165` placeholder `"프로세스명, ID, 담당자 검색..."`
- `:1295` `프로세스 담당자` / `:1296` `검토담당자` / `:1297` `현업담당자` — matches flowchart, but **`최종검토자` column is missing** even though `master_owner` is searched at `:180`.

---

## 3. New-process-registration UI — `NewProcessDialog.vue` (shared)

`/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/NewProcessDialog.vue`, mounted at `ProcessArchitecture.vue:425`. Section header `owners` at `:223`.

| Line | Source | Korean label shown |
|---|---|---|
| `:223` | `$t('processArchitecture.newProcessDialog.owners')` → `ko.json:988` | `담당자` |
| `:232` | `$t('...primaryOwner')` → `ko.json:989` | **`Primary Owner`** ← should be `프로세스 담당자` |
| `:241` | `$t('...ownerPlaceholder')` → `ko.json:990` | `이름 또는 이메일로 검색...` |
| `:252` | `translate('...fieldOwners', '현업담당자')` → `ko.json:1011` | `현업담당자` |
| `:265` | `...fieldOwnerPlaceholder` → `ko.json:1012` | `현업 담당자를 선택하세요` |
| `:277` | `translate('...hqOwners', '검토담당자')` → `ko.json:1013` | `검토담당자` |
| `:290` | `...hqOwnerPlaceholder` → `ko.json:1014` | **`본사 담당자를 선택하세요`** ← says 본사, label says 검토 |
| `:299` | `$t('...master')` → `ko.json:993` | **`Master`** ← should be `최종검토자` |
| `:310` | `$t('...masterPlaceholder')` → `ko.json:994` | `이름 또는 이메일로 검색...` |

Dead/legacy keys still in `ko.json:991-992`: `"coOwner": "Co-Owner(s)"`, `"coOwnerPlaceholder": "Co-Owner 추가..."` — no longer rendered (the dialog derives `coOwners` at `:1064` as `fieldOwners ∪ hqOwners`), but they remain in the locale file.

`en.json` (`:970-987`) has **no** `fieldOwners` / `hqOwners` / `fieldOwnerPlaceholder` / `hqOwnerPlaceholder` keys — that is why `:252/:265/:277/:290` use the local `translate(key, fallback)` helper (`NewProcessDialog.vue:500-503`), so English users see Korean fallbacks.

---

## 4. Where labels come from

| Source | Which labels |
|---|---|
| **Hardcoded Korean strings in `.vue`** | All 4 flowchart sub-labels (`ProcessHierarchyProperties.vue:132/139/146/153` + `:209/213/217/221`), all `OwnerSettingDialog.vue:20-23` labels/placeholders, `CallActivityManagement.vue:23/225/226`, `ProcessReviewBoard.vue:1165/1295-1297`, `AuditTrail.vue:623-627` |
| **`src/utils/locales/ko.json` (+ `en.json`)** | `processArchitecture.advancedFilter.*` (`884-890`), `processArchitecture.newProcessDialog.*` (`988-994`, `1011-1014`), `ownerSettingDialog.*` (`3929-3935`) |
| **`task_property_schema` DB rows** | Only the *section header* `process/owner` and `bpmn:Lane/lane_assignment`, seeded from `builtinPanelProperties.ts:50/109` via `taskCatalog.ts:624 syncPanelPropertySchemas()`; read back through `taskCatalog.ts:1019 builtinPropLabel` → `ProcessHierarchyProperties.vue:6858 builtinLabel()`. Admin edits them in `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/PropertySchemaStudio.vue` (note at `:168`: composite widgets only honor 라벨·노출). |
| **DB columns / view** | `supabase/migrations/20260902000002_review_owner_role_mapping.sql:51-56` maps `meta.owners.{primaryOwner,hqOwners,fieldOwners,masterOwner}` → `pi_owners / hq_owners / field_owners / master_owner`. No Korean labels in DB. |

---

## Mapping table (the mismatch)

| meta.owners key | Flowchart (`ProcessHierarchyProperties.vue` / `OwnerSettingDialog.vue`) | 검색 – 체계도 필터 (`AdvancedFilterPanel` + ko.json) | 검색 – 프로세스 목록 (PAL, `CallActivityManagement`) | 검색 – 검토보드 (`ProcessReviewBoard`) | 새 프로세스 등록 (`NewProcessDialog` + ko.json) | 감사로그 (`AuditTrail`) |
|---|---|---|---|---|---|---|
| `primaryOwner` | **프로세스 담당자** (`:132`, `OwnerSettingDialog:20`) | `Primary Owner` (`ko.json:888`) | `PI팀담당자` (`:225`) | `프로세스 담당자` (`:1295`) | `Primary Owner` (`ko.json:989`) | `PI팀 담당자` (`:624`) |
| `fieldOwners` | **현업담당자** (`:139`) / `현업 담당자` (`OwnerSettingDialog:21`) | (folded into `Co-Owner`, `ko.json:889`) | `현업담당자` (`:226`) | `현업담당자` (`:1297`) | `현업담당자` (`ko.json:1011`), placeholder `현업 담당자를…` | `현업담당자` (`:626`) |
| `hqOwners` | **검토담당자** (`:146`) | (folded into `Co-Owner`) | — | `검토담당자` (`:1296`) | `검토담당자` (`ko.json:1013`), placeholder **`본사 담당자를…`** (`ko.json:1014`) | `검토담당자` (`:627`) |
| `masterOwner` | **최종검토자** (`:153`) | `Master` (`ko.json:890`) | — | — (missing) | **`Master`** (`ko.json:993`) | `최종검토자` (`:625`) |
| group header | `프로세스 담당자` (`:89`, DB-overridable) | `담당자` / `담당 역할` (`ko.json:884/886`) | — | — | `담당자` (`ko.json:988`) | `담당자` (`:623`) |

## PAL-only vs shared

- **PAL-only**: `CallActivityManagement.vue` (`/call-activity-management`, `MainRoutes.ts:487-491`; sidebar `VerticalSidebar.vue:795-802`), `RestructureApprovalBoard`, `ReviewBoardSubmissionDebug` (`MainRoutes.ts:651-664`). PAL mode is flagged by `window.$pal` (`src/palMode.ts`).
- **Shared (both modes)**: `ProcessArchitecture.vue` + `AdvancedFilterPanel.vue` + `NewProcessDialog.vue` (`MainRoutes.ts:437-440`), `ProcessHierarchy.vue` / `ProcessHierarchyProperties.vue` (`MainRoutes.ts:441-445`), `OwnerSettingDialog.vue`, `ProcessReviewBoard.vue` (`MainRoutes.ts:646-650`).
- Legacy/unused-in-exec-path: `bpmnModeling/bpmn/role/RolePanel.vue:97` uses `$t('UserTaskPanel.assignee')` → `ko.json:2040` `"담당자 지정"`; `ZeebePropertiesPanel.vue:67` `label="Assignee"`. These are a separate (runtime task assignee) concept, not the process-owner set.

## Minimal unification targets (if you fix to flowchart naming)

1. `src/utils/locales/ko.json:989` `"primaryOwner": "Primary Owner"` → `"프로세스 담당자"`; `:993` `"master": "Master"` → `"최종검토자"`; `:990/:994` placeholders → `프로세스 담당자를 선택하세요` / `최종검토자를 선택하세요`; `:1014` `본사 담당자를 선택하세요` → `검토담당자를 선택하세요`.
2. `src/utils/locales/ko.json:888-890` `Primary Owner / Co-Owner / Master` → `프로세스 담당자 / 현업·검토담당자 / 최종검토자`.
3. `src/views/admin/tabs/CallActivityManagement.vue:225` `'PI팀담당자'` → `'프로세스 담당자'`; `:23` placeholder.
4. `src/components/ui/OwnerSettingDialog.vue:21` `현업 담당자` → `현업담당자` (space consistency).
5. Add missing `fieldOwners`/`hqOwners` keys to `src/utils/locales/en.json` (~`:982-987`).
6. `src/views/admin/tabs/AuditTrail.vue:624` `'PI팀 담당자'` → `'프로세스 담당자'`.</result>
<usage><subagent_tokens>88423</subagent_tokens><tool_uses>53</tool_uses><duration_ms>243336</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-08T06:49:30.360Z (backfill)

```text
<task-notification>
<task-id>a55bc9cdf024cc9b7</task-id>
<tool-use-id>toolu_018Nn745aXgnwgLd8T1KMLCn</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/a55bc9cdf024cc9b7.output</output-file>
<status>completed</status>
<summary>Agent "순서도 담당자 표시 버그 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## Rendering path (프로세스 순서도 → 담당자 변경)

`ProcessHierarchy.vue` → right property panel `ProcessHierarchyProperties.vue` (Process tab) → 설정 버튼 → `OwnerSettingDialog.vue` → 4× `OwnerSelect.vue` → `InternalOrganizationProvider` (org chart) → save direct to `proc_def.definition.meta.owners`.

## 1. Where the strings live

| Location | Nature |
|---|---|
| `/home/kimsanghoon/process-gpt-vue3/src/components/ui/OwnerSettingDialog.vue:20,23` | hardcoded labels on the two single-value `OwnerSelect`s (`primaryOwner`, `masterOwner`) — the actual edit UI |
| `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue:89,132,153` (+ history dialog `:209,:221`) | read-only display chips in the panel |
| `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/builtinPanelProperties.ts:50` | seed row only (`taskType:'process', key:'owner', widget:'dialog', binding:'OwnerSettingDialog'`) — consumed by `src/stores/taskCatalog.ts:4` to seed `task_property_schema`; it does **not** render anything |
| `/home/kimsanghoon/process-gpt-vue3/src/utils/locales/ko.json:3929-3935` (`ownerSettingDialog.*`), `:1288-1291` (`ownerSelect.noData`) | locale keys (the two field labels are *not* localized — hardcoded) |
| `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/NewProcessDialog.vue:231,253,275,300` | the *other* owner editor (creation flow) |
| `supabase/migrations/20260902000002_review_owner_role_mapping.sql:51-56` | `v_review_board` reads `definition-&gt;'meta'-&gt;'owners'-&gt;&gt;'primaryOwner' / masterOwner / hqOwners / fieldOwners`. No `task_property_schema` seed rows for these in SQL. |

Model keys: `proc_def.owner` + `proc_def.definition.meta.owners.{primaryOwner,fieldOwners,hqOwners,masterOwner}`.

## 2. Most likely failure points (ranked)

**A. Identity-space mismatch — org-chart UUID vs email. This is almost certainly the bug.**
- `OwnerSelect.vue:15-17` uses `item-title="name" item-value="id"`, items from `getOrganizationProvider()` (`OwnerSelect.vue:129,164`).
- `InternalOrganizationProvider.ts:84-94` builds member `id` from the org-chart node id, and `orgChartModel.ts:81-84` sets that node id = `users.id` (UUID).
- Every other path stores **email**: `NewProcessDialog.vue:231/253/275/300` (`item-value="email"`), and the panel's own resolver literally names the variable `allEmails` (`ProcessHierarchyProperties.vue:7381`); `normalizeOwnerList` prefers `email` (`:6897`).
- Result: dialog opens with `primaryOwner = "a@b.com"`, `OwnerSelect.vue:170-172` / `:218-227` calls `provider.getMember(email)`, which does `findNode` by node id/`data.id` only (`InternalOrganizationProvider.ts:134-147`) → `null` → value never enters `items` → Vuetify renders the `#selection` slot (`OwnerSelect.vue:38-48`) with `item.raw` = the raw string, so `item.raw.name` is `undefined` → **empty field with a "?" avatar**. The two `multiple` fields at least render chips, which is why the two single fields (프로세스 담당자, 최종검토자) are the ones reported as "안 뜸".

**B. PAL mode has no usable org chart / no UUIDs.** In PAL mode users come from SSO `/pi-system-backend/organization/users/search` (`PalModeBackend.ts:694-699`), and `userIdentity.ts:41-46` documents that SSO responses carry **no UUID** (`id: null`, `employee_no = user_id`). The org chart is loaded from `configuration` where `key='organization'` (`InternalOrganizationProvider.ts:35-43`); if unset, `orgChart` is null → `getMembers` returns `[]` → dropdown shows `조직 구성원이 없습니다`. `OwnerSelect` is the only user picker in the repo that never falls back to `backend.searchUsersByName`.

**C. Single vs list normalization asymmetry (display side).** `ProcessHierarchyProperties.vue:6436-6440`: `fieldOwners/hqOwners` go through `normalizeOwnerList` (`:6893-6900`, unwraps objects via `email || employee_no || user_id || id || name`), but `masterOwner` (and `processForm.owner` at `:6433`) only get `toSafeText`. `safeText.ts:16-25` picks from `['name','title','label','text','displayName','id','value','key']` — **`email` is not in that list**. So an object-shaped stored owner (`{email:'…'}`) collapses to `''` → 최종검토자 shows `미지정` / 담당자 chip disappears. Same asymmetry in `parseOwnerHistoryValue` (`:7084`, `:7087`), so the 변경 이력 dialog degrades identically.

**D. Silent save no-op on mixed-case ids.** `OwnerSettingDialog.vue:96` loads via `backend.getRawDefinition`, which **lowercases** the id (`PalModeBackend.ts:105-106`), but `:138-142` saves with `.eq('id', props.process.id)` un-lowercased. A mixed-case `definitionPath` → read works, update matches 0 rows and returns `error: null` → "저장했는데 반영 안 됨".

**E. Item-list race.** `OwnerSelect.vue:164` reassigns `members.value = await provider.getMembers(...)`, which can clobber the member injected by the `modelValue` watcher at `:226` (v-dialog content mounts lazily, so `onMounted` and the watcher fire nearly simultaneously). Also `getMembers({limit: 50})` (`:164`) truncates the org chart to 50 people.

**F. No audit row on save → 변경 이력 empty.** `OwnerSettingDialog.save()` writes `proc_def` directly and never calls `insertAdminAuditLog`; only the rollback path does (`ProcessHierarchyProperties.vue:7273-7282`). `loadOwnerHistory` (`:7112-7150`) reads `admin_audit_log` with `ownerOnly`, so normal saves produce no history.

**G. Related, separately broken: `SchemaFieldInput.vue:640`** — `Array.isArray(result) ? result : []` on `backend.searchUsersByName`, which returns `{ users, page }` (`PalModeBackend.ts:713-717`). Always empty. Correct handling for comparison: `NewProcessDialog.vue:692` and `ProcessHierarchyProperties.vue:7753` (`result.users`). Any schema-driven `property_type: 'user'` field has a permanently empty dropdown.

**H. Gating.** Edit button is `v-if="isAdmin &amp;&amp; !isViewMode"` (`ProcessHierarchyProperties.vue:105`); the whole 담당자 block hides if the `('process','owner')` row in `task_property_schema` is inactive (`:85`, via `catalogStore.isBuiltinPropVisible`, `:6886`). Fail-open otherwise.

## Suggested fix direction

Make `OwnerSelect` use the same identity source/format as the rest (`backend.searchUsersByName` + `backend.resolveUserIdentities` with `email`/`employee_no` values, mirroring `SchemaFieldInput.prepareUserLabel` at `SchemaFieldInput.vue:616-630`), or at minimum: inject an unresolved-value placeholder item so the `#selection` slot never gets a bare string, route `masterOwner`/`primaryOwner` through `normalizeOwnerList`, and lowercase the id in `OwnerSettingDialog.save`.</result>
<usage><subagent_tokens>101597</subagent_tokens><tool_uses>45</tool_uses><duration_ms>290872</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-08T06:49:59.303Z (backfill)

```text
<task-notification>
<task-id>a2380c69d6597b0e9</task-id>
<tool-use-id>toolu_01UkZ97eZXNXRgZhoyhvzXcT</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/82a55dd1-04de-416b-8d3a-ad6f562b9eee/tasks/a2380c69d6597b0e9.output</output-file>
<status>completed</status>
<summary>Agent "PI Flag 기능 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## Summary

"PI Flag" here is **not** a process-instance flag — it is a **PI(Process Innovation) 개선 이슈 태그** attached to BPMN elements. A flag = a comment object (`{id, status, type/category, title, problem, improvement, description, groupId, groupedElementIds, reflected, authorId, authorName, createdAt}`) stored **inside the BPMN XML** in `extensionElements → uengine:Properties@json → {"comments":[...]}`. There is no dedicated table, no dedicated REST endpoint; everything rides on the normal definition save/load path.

## Where it lives

**Storage / parsing**
- `/home/kimsanghoon/process-gpt-vue3/src/composables/blueprint/piFlagParser.ts` — canonical reader (`parseFlagsFromBpmn`), handles both `json` attribute (current) and legacy `textContent` slicing; documents the `PI_FLAG_PROBE_TOKENS = ['uengine:Properties','"comments"']` convention.
- `/home/kimsanghoon/process-gpt-vue3/src/utils/piFlagTypes.js` — the **type catalog** (`PROCESS_REMOVE`/`TASK_INTEGRATION`/`MANUAL_WORK`/`SYSTEM_LIMIT` defaults), persisted in Supabase `configuration` table, key `pi_flag_types`, per tenant, with soft-delete/restore/hard-delete + `pi-flag-types-changed` window event and one-shot localStorage migration.

**Authoring UI**
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/PiFlagPanel.vue` — element panel (status 향후과제/즉시개선, free-text type, description, group registration across multi-selection, status toggle, delete, delete-group). Writes straight to the modeler at `PiFlagPanel.vue:250-290` (`writeCommentsToElement`).
- Hosted in `GPTUserTaskPanel.vue:137-158` (tab) and `PALUserTaskPanel.vue:76-95` (section, gated by builtin prop `pi_flag`).
- `/home/kimsanghoon/process-gpt-vue3/src/components/customContextPad/CustomContextPad.js:1150` / `:1192` — context-pad "PI Flag 작성" fires `element.addPiFlag` / `elements.addPiFlag`.
- `/home/kimsanghoon/process-gpt-vue3/src/components/BpmnUengine.vue:529-660, 1676-1695` — canvas overlays + group boxes (`pi-flag-group` layer), `showPiFlag` prop, event relay.
- `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinition.vue:44-97, 1362` and `/home/kimsanghoon/process-gpt-vue3/src/stores/bpmn.ts:13,40` (`requestPiFlagFocus`) — toggle + focus routing into the panel.
- The richest surface is `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue` (PI Flag tab, sub-tabs 사용자 코멘트 / Agent 분석 / AI chat): `submitPiFlagDialog:8945`, `writeCommentsToElement:9401`, `togglePiFlagReflected:9440`, `deletePiFlagComment:9709`, `deletePiFlagCommentGroup:9749`, `sendPiFlagChat:9594`, type options loaded at `:6658` via `getActivePiFlagTypeLabels`. Dialog: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/PiFlagEditorDialog.vue`.
- AI drafting: `/home/kimsanghoon/process-gpt-vue3/src/components/ai/AnGapToPiFlagGenerator.js` (`analyzeGapsToPiFlags`), driven from `ProcessHierarchyAIGuide.vue:1450`, `collectPiFlagsForGap:1264`, `collectReflectedPiFlags:1275`.

**Boards / admin**
- `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/PiFlagBoard.vue` (1452 lines) — full board, route `/admin-console/pi-flags` (`MainRoutes.ts:586`, owner-only in `routePermissions.ts:251`), plus `PiFlagPage.vue`, `PiFlagTypeManager.vue`.
- `/home/kimsanghoon/process-gpt-vue3/src/views/analytics/PiFlagBoard.vue` — second, simpler board on `/analytics/pi-flags` (`MainRoutes.ts:628`, sidebar `VerticalSidebar.vue:877`).
- Trash: `RecycleBin.vue:183-190, 221-228, 568-635` (30-day retention, type `piFlagType`); audit labels `AuditTrail.vue:549-578` (`pi_flag_type_create/delete/hard_delete`).
- Panel-visibility switches: `builtinPanelProperties.ts:65,66,91` (`pi_flag_tab`, `pi_flag_agent_chat`, `pi_flag`), `taskCatalog.ts:426`, `PropertySchemaStudio.vue:1128`.
- Export: `/home/kimsanghoon/process-gpt-vue3/src/composables/blueprint/piFlagIssueExport.ts`, used only at `admin/tabs/PiFlagBoard.vue:824`.

## Remote (backend) surface

1. **Definition read/write** — flags persist only when the BPMN XML is saved: `backend.putRawDefinition(...)` (`ProcessHierarchy.vue:4262`). uEngine impl: `UEngineBackend.ts:403` → `PUT /definition/raw/{path}`; ProcessGPT impl writes `proc_def`.
2. **Admin board reads Supabase directly** — `admin/tabs/PiFlagBoard.vue:527-583`: `window.$supabase.from('proc_def').select('id,name,bpmn,owner').or('bpmn.ilike.%uengine:Properties%,bpmn.ilike.%"comments"%')`, plus `tb_bpmn_model` and `backend.getProcessDefinitionMap()` / `getMetricsMap()` for domain names.
3. **Analytics board reads via backend** — `analytics/PiFlagBoard.vue:510` `backend.listDefinition('', {match:{tenant_id}})`.
4. **AI** — `backend.qdrantChat(...)` → `POST /pi-system-backend/langchain-chat/qdrant-chat/stream` (SSE), defined **only** in `PalModeBackend.ts:842`, gated by `assertAiEnabled()`.
5. **Type catalog** — `configuration` table via `StorageBaseSupabase` (`utils/StorageBaseFactory.js` hardcodes Supabase).
6. Adjacent remote APIs on the same panel (not wired to PI Flag): `/atdt-task-mgmt/api/tasks/` and `/pi-system-backend/systems` (`ProcessHierarchyProperties.vue:10557, 10595`).
7. Nothing PI-Flag-related exists in `gateway/` (only 2 Java files, both plumbing) or in any migration except one permission row: `supabase/migrations/20260514_permissions.sql:75` `('pi_flag_read','PI Flag 접근','/admin-console/pi-flags','GET')`.

## Gaps / bugs found

1. **`/analytics/pi-flags` board is dead code — always empty.** It filters on `def.bpmn` (`analytics/PiFlagBoard.vue:513-514`), but `listDefinition` never returns the `bpmn` column in either backend: `ProcessGPTBackend.ts:38` (`PROC_DEF_LIST_COLUMNS = 'id, name, type, owner, isdeleted, is_draft, tenant_id, prod_version'` — bpmn deliberately excluded for payload size) and `UEngineBackend.ts:247-261` (`__normalizeListDefinitionItem` returns only `{path,name,directory,id,isDeleted}`). It fails silently as "등록된 PI Flag가 없습니다", not as an error. Also passes an unused 2nd arg to the uEngine signature `listDefinition(basePath)`.
2. **Admin board doesn't work against the remote uEngine backend at all.** It bypasses `BackendFactory` and queries `window.$supabase.from('proc_def')` directly; in `$mode === 'uEngine'` definitions live on the uEngine server, so the board throws/empties (`admin/tabs/PiFlagBoard.vue:527-533`).
3. **PI Flag AI features are unavailable in uEngine modes.** `qdrantChat` exists only on `PalModeBackend` (which extends `ProcessGPTBackend`); `PalUengineBackend.ts:8` is `class PalUengineBackend extends UEngineBackend {}`, so PAL+uEngine and plain uEngine/ProcessGPT have no `qdrantChat`. The null-skip proxy (`BackendFactory.ts:64-72`) substitutes a stub returning `null`, so `analyzeGapsToPiFlags`'s guard `typeof backend.qdrantChat !== 'function'` (`AnGapToPiFlagGenerator.js:132`) never trips and the user gets the misleading "AI Gap 진단 결과를 해석하지 못했습니다".
4. **Persistence is inconsistent.** Only element-level `submitPiFlagDialog` calls `saveTask()` (`ProcessHierarchyProperties.vue:8973`). Process-level flags (`appendProcessLevelComment:9385`), reflect toggle (`togglePiFlagReflected:9440`), single/group delete (`:9709`, `:9749`) and AI-applied flags only `this.$emit('taskMappingChanged')`, and `ProcessHierarchy.vue:4183` merely refreshes overlays — no `persistBpmn`. Those edits are lost unless the user manually saves. Same for the whole `PiFlagPanel.vue` (modeler-only writes).
5. **Two divergent comment models.** `PiFlagPanel.vue` writes flat `{type, description}` while `ProcessHierarchyProperties`/AI write `{category, title, problem, improvement}`; the parser carries fallbacks (`piFlagParser.ts:138-143`), and boards show "사유" from `description` only.
6. **Type catalog not used by the designer panel.** `PiFlagPanel.vue:26` is a free-text `v-text-field`, so admin-managed `pi_flag_types` (`getActivePiFlagTypeLabels`) apply only in the ProcessHierarchy dialog — board type filters get polluted with free text.
7. **Type catalog write path is Supabase/RLS-only** (`piFlagTypes.js:49-55, 63-69`): admin+ RLS, and the legacy-localStorage migration swallows failures with a `console.warn`, leaving stale local data. In uEngine mode there is no server-side equivalent.
8. **Issue export is local-only** — `downloadIssueJson` produces a JSON file; nothing POSTs to an issue tracker even though the ATDT task-management API is already proxied in the same component.
9. **Permission drift** — `pi_flag_read` exists in the migration but is referenced nowhere in `src/`; `/analytics/pi-flags` has no permission/mode gate while `/admin-console/pi-flags` is owner-only.
10. **RecycleBin 30-day retention is UI-side only** (`RecycleBin.vue:221-228`) — nothing purges expired PI Flag types server-side.
11. **uEngine save drops metadata**: `persistBpmnSnapshot` passes `{name, definition, version, version_tag, arcv_id, message}` but `UEngineBackend.putRawDefinition` (`:403-412`) forwards only `{definition, version}`.
12. **Known XML round-trip quirk, only worked around**: comments in `analytics/PiFlagBoard.vue:515-516` and `piFlagParser.ts:101-121` note that saving flips `uengine:Properties` → `uengine:properties` and that legacy data lives in `textContent` rather than the `json` attribute — the probe uses the `"comments"` string to be safe. Any server-side XML normalization on the remote side would silently strip flags.
13. **Zero test coverage** — no PI Flag references anywhere in `playwright/`, `e2e/`, or `openspec/`.</result>
<usage><subagent_tokens>107262</subagent_tokens><tool_uses>62</tool_uses><duration_ms>333572</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-08T07:09:49.854Z (backfill)

```text
5번부터 진행
```

## Prompt — 2026-09-08T07:33:33.990Z (backfill)

```text
재활성화해도 됨. 4번 진행
```

## Prompt — 2026-09-08T07:44:57.056Z (backfill)

```text
2번 템플릿 진행. 프로세스목록에서 템플릿 탭 만들어서 별도로 필터도 가능하도록.
```

## Prompt — 2026-09-08T07:45:05.604Z (backfill)

```text
2번 템플릿 진행. 프로세스목록에서 템플릿 별도로 필터도 가능하도록.
```

## Prompt — 2026-09-08T07:55:50.502Z (backfill)

```text
duplicateLocalProcess 5번째 옵션 무시되는 버그도 수정해줘
```

## Prompt — 2026-09-08T08:01:08.818Z (backfill)

```text
3번 PI Flag 문제들도 수정 진행
```

## Prompt — 2026-09-08T08:16:14.234Z (backfill)

```text
1번 담당자 명칭 수정 포함해서 지금까지 작업 커밋해줘
```

<!-- backfilled-from: 14284d11-1448-4a59-81a7-844a7d4760d5 -->

## Prompt — 2026-09-09T03:15:04.108Z (backfill)

```text
페이지들 전체적으로 Input칸의 상단 일부가 무언가에 가려져서 그런지 제대로 안보이는 현상들이 발생함. 예를들면 권한 변경 신청 페이지에서 신청 권한, 신청 사유 입력칸을 보면 윗부분이 비어있는 사각형으로 보이게됨.
```

## Prompt — 2026-09-09T03:34:58.517Z (backfill)

```text
그 문제가 아님. @"Screenshot 2026-09-09 at 12.33.24 PM.png"
```

## Prompt — 2026-09-09T06:51:37.375Z (backfill)

```text
여전히 같은 오류 발생함.
```

## Prompt — 2026-09-09T07:38:57.120Z (backfill)

```text
여전히 같은 증상 발생. .v-field__outline__end 이건 검색해도 안나오는데?
```

## Prompt — 2026-09-09T07:41:21.757Z (backfill)

```text
'{\n  "dpr": 1,\n  "borderTop": "1px solid rgb(223, 229, 239)",\n  "opacity": "1",\n  "widthVar": "1px",\n  "field": "v-field v-field--active v-field--appended v-field--center-affix v-field--dirty v-field--variant-outlined v-theme--AQUA_THEME v-locale--is-ltr"\n}'
```

## Prompt — 2026-09-09T07:48:10.193Z (backfill)

```text
'{\n  "rectY": 206,\n  "fieldH": 121,\n  "stack": [\n    "v-field__input | bg:rgba(0, 0, 0, 0) | opacity:0 | pos:relative",\n    "v-field__field | bg:rgba(0, 0, 0, 0) | opacity:1 | pos:relative",\n    "v-field.v-field--variant-outlined | bg:rgb(255, 255, 255) | opacity:1 | pos:relative",\n    "v-input__control | bg:rgba(0, 0, 0, 0) | opacity:1 | pos:static",\n    "v-input.v-input--horizontal | bg:rgba(0, 0, 0, 0) | opacity:1 | pos:static",\n    "v-form | bg:rgba(0, 0, 0, 0) | opacity:1 | pos:static",\n    "v-card.v-card--flat | bg:rgb(255, 255, 255) | opacity:1 | pos:relative"\n  ]\n}'

빨간 테두리도 약간 끊겨있음.
```

## Prompt — 2026-09-09T07:55:21.442Z (backfill)

```text
해결됐음. 다른 페이지에도 이런 증상이 있으면 해결할 수 있도록 정리해둬.
```

<!-- backfilled-from: 71f48ad1-dcba-429b-87ba-30e8470811fe -->

## Prompt — 2026-09-10T06:30:58.828Z (backfill)

```text
프로세스 순서도에서 StartEvent, EndEvent에 설정하는 선행, 후행 프로세스는 선행프로세스가 여러종류가 있을 수 있음. 따라서 Multiple 선택이 가능하도록.
```

## Prompt — 2026-09-10T07:00:40.360Z (backfill)

```text
StartEvent에서만 다중선택 가능하도록 하자. 그리고 StartEvent, EndEvent의 객체 색상을 어울리는 것으로 변경하고싶음. 현재는 동일한 색상이라 가시성면에서 잘 어울리도록.
```

<!-- backfilled-from: f66f024c-eaa4-44d1-91bf-c2fa5ca3510c -->

## Prompt — 2026-09-10T07:04:11.251Z (backfill)

```text
프로세스 순서도 패널에서 ppi input은 공간이 너무 작으므로, 입력 Dialog가 뜨는 방식으로 전환. 속성 스키마쪽을 변경해서 적용야함.
```

## Prompt — 2026-09-10T07:04:16.094Z (backfill)

```text
프로세스 순서도 패널에서 ppi input은 공간이 너무 작으므로, 입력 Dialog가 뜨는 방식으로 전환. 속성 스키마쪽을 변경해서 적용해야함.
```

## Prompt — 2026-09-10T07:11:51.200Z (backfill)

```text
다른 위젯들(RACI, 세부 업무 수행 절차)도 같은 방식으로 전환해줘
```

## Prompt — 2026-09-10T07:53:13.129Z (backfill)

```text
1. 프로세스 목록에서 모듈은 템플릿 화가 안되는 문제. 모듈도 템플릿이 될 수 있어야함.
2. 액션버튼이 두줄로 나옴. (삭제버튼이 아래로 내려감)
```

## Prompt — 2026-09-10T07:53:18.484Z (backfill)

```text
1. 프로세스 목록에서 모듈은 템플릿 화가 안되는 문제. 모듈도 템플릿이 될 수 있어야함.
2. 프로세스 목록에서 액션버튼이 두줄로 나옴. (삭제버튼이 아래로 내려감)
```

<!-- backfilled-from: 780bb742-9d9d-4929-95b7-83239a4cb429 -->

## Prompt — 2026-09-10T07:12:26.205Z (backfill)

```text
현재 git commit, push 안되어있는 파일 모두 확인해봐.
```

## Prompt — 2026-09-10T07:13:11.002Z (backfill)

```text
test-results/와 스크린샷류는 .gitignore에 추가
```

## Prompt — 2026-09-10T07:14:07.532Z (backfill)

```text
 - 라우팅/권한: AuthRoutes.ts, MainRoutes.ts, router/index.ts, routePermissions.ts, authClaims.ts, stores/auth.ts
  - 애널리틱스 대시보드: AnalysisDashboard.vue, ExecutiveSummary.vue, GovernanceQuality.vue, ProcessAnalytics.vue, dashboardDataService.ts, dashboardSettingsService.ts,
    analysisDashboardStore.ts
  - BPMN/디자이너: BpmnUengine.vue, CustomBpmnRenderer.js, dsPalette.js, custom-sequence-flow-final-module.js, builtinPanelProperties.ts, PpiField.vue
  - 프로세스 계층/아키텍처: ProcessHierarchyDesigner.vue, ProcessHierarchyProperties.vue, SktVersionComparisonDialog.vue, ProcessArchCardView.vue,
    ProcessArchTreeView.vue, ProcessReviewBoard.vue
  - 레이아웃/스타일: FullLayout.vue, GlobalNoticeBanner.vue, VerticalSidebar.vue, globalStyle.css, tokens.css, overrides.css
  - 기타: OrganizationChartView.vue, PolicyDocumentManager.vue, SystemOperations.vue, AdminConsoleLayout.vue, adminConsole.ts, StorageBaseSupabase.js,
    SchemaFieldInput.vue, 로케일(en/ko),

- 신규 기능 소스: 멤버십 승인 관련(membershipService.ts, membershipRequests.ts, membershipGate.ts, MembershipApprovalPanel.vue, RoleRequestPage.vue, SignupPending.vue,
    MembershipRequestBadge.vue), 정책문서(policyDocumentService.ts), 점검 모드(maintenanceGate.ts, PalMaintenance.vue), ModelOperationalBoard.vue, dashboardHttp.ts,
    customDrilldown/, preserve-task-replacement-connections.js
  - Supabase 마이그레이션 4건 (data_object_file_property, membership_approvals, policy_document_usage, policy_document_file_metadata) + supabase/tests/

해당부분 커밋.
```

## Prompt — 2026-09-10T07:19:06.758Z (backfill)

```text
git pull 받고나서 http://34.22.71.73:8088/tenant/manage?clear=true로 접속 시, 34 은(는) 존재하지 않는 경로입니다. 오류.
```

## Prompt — 2026-09-10T07:51:02.742Z (backfill)

```text
체계도에서 새 프로세스 생성시, 순서도 화면으로까지 넘어가는게 너무 오래걸림. 원인 파악해봐.
```

## Prompt — 2026-09-10T07:57:39.877Z (backfill)

```text
<task-notification>
<task-id>a28b2a02e40343e81</task-id>
<tool-use-id>toolu_01RoZc3qXDB6JFcT7DGcsCLa</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/71f48ad1-dcba-429b-87ba-30e8470811fe/tasks/a28b2a02e40343e81.output</output-file>
<status>completed</status>
<summary>Agent "Trace ProcessHierarchy mount loading" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## Loading pipeline for `/process-hierarchy?id=…&amp;entry=architecture&amp;mode=edit`

### Phase 0 — before any component code runs
1. `src/router/index.ts:144` `await membershipRedirect(to.path)` → `src/utils/membershipGate.ts:7,10` = `supabase.auth.getSession()` + `rpc('my_membership')`. **Uncached, on every navigation.**
2. `src/router/index.ts:168` `evaluateMaintenanceGate` → `isMaintenanceEnabled` (`src/utils/maintenanceGate.ts:38`, TTL-cached, cheap).
3. Lazy chunk `src/router/MainRoutes.ts:457`. That chunk statically pulls `ProcessHierarchyDesigner` (210 KB), `ProcessHierarchyProperties` (**694 KB source**, `ProcessHierarchy.vue:626`), `ProcessHierarchyAIGuide` (88 KB), `BpmnUengine.vue` + bpmn-js. **Likely the single biggest wall-clock item on a cold visit** — nothing in step 4+ starts until this parses.

### Phase 1 — `mounted()` (`ProcessHierarchy.vue:827`) — strictly serial
4. `applyEntryStateFromRoute()` :828 → :1504 — sync only; sets `entrySource='architecture'`, `requestedMode='edit'`, collapses left tree/sidebar.
5. `await loadInitialData()` :829 → :2317
   - **4 parallel** (`:2322-2339`):
     - `getProcessDefinitionMap({skipPermissionFilter:true})` — ⚠️ **the option is ignored**: impl takes no args (`ProcessGPTBackend.ts:1906`). It still runs `checkUsePermissions()` (`:5536`) and, for non-superAdmin/non-admin, `filterProcDefMap` (`:2393`) which does **sequential N+1**: `getOrgChartGroupList` → one `org_chart_group_teams` query *per group* → one `user_permissions` query *per user org* → one *per org group*. **Expensive for normal users.**
     - `getMetricsMap()` (cheap, single config row).
     - `fetchDefinitionListLite()` :2050 → `PalModeBackend.ts:474` — `SELECT id,name,description,**definition**,… FROM proc_def` for the **whole tenant, unbounded**. **Dominant network+JSON cost.**
     - `getDataFreezeList()` (single config row).
   - **Sequential barrier** `await enrichDefinitionStatuses(procIds)` :2348 → :2294 → 2 parallel: `getLatestVersionMapByProcIds` (`PalModeBackend.ts:792` — *every* row of `proc_def_version` for *every* process, no limit) + `getApprovalStateListByProcIds`. **Second dominant cost; blocks the designer even though the designer needs none of it.**
   - CPU: `normalizeDefinitionList` :2344/:1363 JSON-parses every definition, then `applyDefinitionStatusMaps` :2253 re-normalizes/re-parses the entire list **a second time**.
   - `loadLockMap()` :2351 — fired without `await` (good), still one `lock` query.
6. `await resolveProcessRouteId(queryId)` :835 → `src/utils/processRouteId.ts:43`. The id from `NewProcessDialog.vue:1211/1249` is a **legacy id, not a UUID**, so this short-circuits (no query).
7. `await handleSelectProcess(...)` :837 → :2375 — the rest is one long `await` chain:
   1. `await processUuidForRoute(selectedId)` :2419 → 1 supabase `proc_def` query.
   2. `await this.$router.replace(...)` :2425 (rewrites `id` legacy→uuid) — **re-runs `beforeEach`, i.e. a 2nd `my_membership` RPC**; also fires `'$route.query.id'` :1250 and deep `'$route.query'` :1271 watchers (both re-call `resolveProcessRouteId`; cached, so no extra query, but `applyEntryStateFromRoute` runs again).
   3. `await refreshDataFreezeList()` :2433 → **duplicate `getDataFreezeList`** (already fetched at :2335).
   4. `await checkEditLock(id)` :2436 → :2566 → `backend.getLock`. Note: `mode=edit` **does not acquire a lock at mount** — only `handleChangeMode` :3943 does; mount only *checks*.
   5. `await loadProcess(id)` :2437 → :2668
      - **3 parallel** :2674: `fetchProcessDefinitionDetail` (:2057 → `getDefinitionDetailLite`), `resolveReviewVersionContext` (:2170 — returns `null` synchronously because `entry !== 'review-board'`), `getProcessDefinitionHierarchy` (:2677).
      - ⚠️ **`fetchProcessDefinitionDetail` retry loop :2062-2068** — 4 attempts with `setTimeout` 250 / 500 / 750 ms. For a *just-created* process whose row isn't visible yet this adds **up to ~1.5 s of pure sleep**. This path is specific to the "created in ProcessArchitecture then navigate" case.
      - `resolveProcessBpmnXml` :2692 → :1464 — normally resolves from `def.bpmn` with no extra call; falls back to `getRawDefinition` (:1495) if empty. **`this.bpmnXml` is assigned here — this is the earliest the flowchart can render.**
      - Still awaited *after* the XML is ready: `syncProcessHierarchyMetadata` :2750-2751 → :2646 → `syncProcessDefinitionHierarchyFromMap` (`PalModeBackend.ts:581`, an UPDATE) + **`getProcessDefinitionHierarchy` again** (duplicate of :2677). A brand-new process has no `domain_id/mega/major`, so **this branch always fires on the architecture-create flow** and holds `loadingProcess=true` (the spinner) past the point the XML exists.
      - `loadHistoryVersionsQuiet()` :2759 — not awaited → `getDefinitionVersions` + `attachVersionOwnerNames`/`resolveUserIdentities` :2803.
      - `finally` :2767 `syncAnStudioProcess` → `useAnStudio.loadProcess` (`src/composables/anStudio/useAnStudio.ts:126`) → **`getDefinitionDetailLite` a second time for the same row** (:143-148). Not awaited, but competes for the connection.
   6. `await getBackup(selectedId)` :2444 (IndexedDB, cheap).

### Phase 2 — canvas becomes interactive
8. Designer `bpmn` watcher `ProcessHierarchyDesigner.vue:1545` → `bpmnKey++` → `BpmnuEngine` remount (`:432`, keyed on `bpmnKey + view/edit`).
9. `BpmnUengine.vue:264` `mounted` → `await loadPaletteSettings()` :291 → two **sequential** store calls (`stores/taskCatalog.ts:846`, `:726`); both memoized after the first load in the session → then `initializeViewer()` + `importXML` :333-351.
10. `emit('done')` `BpmnUengine.vue:1531` → `onBpmnDone` `ProcessHierarchyDesigner.vue:2458`: `$nextTick` → **`setTimeout(…, 500)` resetZoom :2475** and **`setTimeout(…, 300)` → `refreshTaskMappingBadges()` + `emit('bpmnLoaded')` :2541-2544**. So ~300–800 ms of hard-coded delay after import before the view settles.
11. `handleBpmnLoaded` :4372 sets `bpmnLoaded=true` → **only now** does the template gate `v-if="showProperties &amp;&amp; selectedProcessId &amp;&amp; bpmnLoaded"` (:114) mount `ProcessHierarchyProperties` — the 694 KB component — causing a second large render stall right at the moment the user expects interactivity.

### Where the time goes (ranked)
1. **Route chunk download/parse** of the four huge SFCs + bpmn-js (Phase 0.3).
2. **`fetchDefinitionListLite`** — whole-tenant `proc_def` including `definition` jsonb (`PalModeBackend.ts:474`), then parsed twice on the main thread.
3. **`enrichDefinitionStatuses` sequential barrier** (`:2348`) — unbounded `proc_def_version` scan, blocks everything downstream, irrelevant to the designer.
4. **`getProcessDefinitionMap` permission N+1** (`ProcessGPTBackend.ts:2393`) for non-admin users; the `skipPermissionFilter` flag passed at `:2323` is dead.
5. **The serial tail in `handleSelectProcess`**: uuid lookup → `router.replace` (2nd membership RPC) → duplicate freeze list → lock → detail → hierarchy sync. ~6 sequential round trips *after* step 5 has already finished.
6. **`getDefinitionDetailLite` retry sleeps** (`:2062-2068`) — up to 1.5 s, specific to a freshly created id.
7. **`setTimeout` 300 ms + 500 ms** in `onBpmnDone`, plus the Properties-panel mount gated behind the 300 ms one.

### Duplicate fetches observed
- `getDataFreezeList` ×2 (`:2335`, `:2433`).
- `getProcessDefinitionHierarchy` ×2 (`:2677`, `:2654`).
- `getDefinitionDetailLite` ×2 for the same row (`:2063` and `useAnStudio.ts:145`).
- `my_membership` RPC ×2 (initial push + internal `router.replace` at `:2425`).
- Definition list normalization/JSON-parse ×2 (`:2344`, `:2253`).

### Nothing found (ruled out)
No org-chart, execution-instance, or `syncAllProcessDefinitionHierarchyFromMap` call on this path — `syncAll` (`PalModeBackend.ts:590`) exists but is not invoked from `ProcessHierarchy.vue`. `ExecInstancePanel` / history panel are `v-if`-gated and don't load at mount. No polling; the only interval is the lock heartbeat, started on explicit edit-mode change, not at mount.</result>
<usage><subagent_tokens>113011</subagent_tokens><tool_uses>66</tool_uses><duration_ms>308011</duration_ms></usage>
</task-notification>
```

<!-- backfilled-from: d1c139b1-2d85-4f55-a593-e4300d5fb941 -->

## Prompt — 2026-09-10T08:00:08.745Z (backfill)

```text
프로세스 순서도패널에서 Lane 담당 지정부분 현재 조직도와 연동. 속성패널에서 수정해야함.
```

## Prompt — 2026-09-10T08:06:24.365Z (backfill)

```text
<task-notification>
<task-id>a9118d85562dd82b5</task-id>
<tool-use-id>toolu_01LGnPse4PzhsXUNbjdeJFWo</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/f66f024c-eaa4-44d1-91bf-c2fa5ca3510c/tasks/a9118d85562dd82b5.output</output-file>
<status>completed</status>
<summary>Agent "Lane 담당 속성패널 탐색" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have a complete picture. Here's the report.

---

# 1. Lane (swimlane) properties panels

There are **three distinct Lane property UIs**, selected by mode. Knowing which one you mean matters most for the wiring plan.

### A. Panel dispatch (which panel renders for `bpmn:Lane`)
`/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/BpmnPropertyPanel.vue:343-372` — `panelName()` computed kebab-cases the BPMN type and prefixes `gpt-` in ProcessGPT mode:

```js
var type = _.kebabCase(this.element.$type.split(':')[1]);   // 'lane'
if (type.indexOf('task') &gt; -1 &amp;&amp; this.isPALMode) type = 'pal-user-task';
if (this.isGPTMode) { if (... || type == 'lane' || ...) type = 'gpt-' + type; }
return type + '-panel';                                      // 'lane-panel' | 'gpt-lane-panel'
```

Panels are registered globally as kebab names by `import.meta.glob('@/components/designer/bpmnModeling/bpmn/**/*.vue')` in `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/index.js:8` (lazy-registered via `/home/kimsanghoon/process-gpt-vue3/src/utils/designerComponents.js`). So there is **no direct import** of the lane panels anywhere — they resolve by string.

### B. `GPTLanePanel.vue` (ProcessGPT mode)
`/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/GPTLanePanel.vue` (454 lines)
- `roleOptions` (hardcoded, lines 144-149): `None` / `Organization` / `IAMRoleResolutionContext` / `DirectRoleResolutionContext`.
- `Organization` branch → `v-autocomplete` bound to `selectedOrganization` / `organizationOptions` (lines 33-62).
- Direct-user branch → `&lt;user-select-field&gt;` (line 65-72).
- Writes into `copyUengineProperties.roleResolutionContext` = `{ _type: 'Organization', organizationId, organizationName, organizationType }` (lines 236-248).
- Also cascades a selected agent down to lane member tasks (`cascadeAgentToLaneActivities`, lines 313-356).

### C. `LanePanel.vue` (uEngine / non-GPT mode)
`/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/LanePanel.vue` (~700 lines)
- `roleOptions` hardcoded (lines 153-158): DirectRole / **GroupRoleResolutionContext** / IAMScope / ExternalCustomer.
- Candidate lists come from **Keycloak**: `import { getAllUsers, getAllGroups, getAllRoles, getAllDepartments } from '@/utils/keycloak'` (line 104) → `loadCandidateUsers/Roles/Departments/Groups()` (called at lines 210-213). Helper functions at `/home/kimsanghoon/process-gpt-vue3/src/utils/keycloak.js:339, 493, 582, 661`.
- Still carries a dead-ish `extractTeamsFromOrgChart()` copy at line 362.

### D. `ProcessHierarchyProperties.vue` — the **PAL / new designer** Lane panel (this is the richest, and almost certainly the one you want)
`/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue`
- Used from `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchy.vue:626` alongside `ProcessHierarchyDesigner.vue`.
- "Lane 속성" section (name/description): lines **1190-1240**.
- **"Lane 담당 지정"** section: lines **1243-1400**, driven by:
  - `laneResourceType` — `internal` | `role_group` | `external` (원가 유형)
  - `laneAssigneeType` — `user` (담당자) | `org` (담당 조직)
  - `laneAssignee[]` (users), `laneOrganization[]` (orgs), `laneSupplier[]`, `laneRoleGroupSelectedList[]`
- Declarative property registry: `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/builtinPanelProperties.ts:107-109`
  ```ts
  { taskType: 'bpmn:Lane', key: 'lane_assignment', labelKo: 'Lane 담당 지정', ...
    binding: 'laneResourceType/laneAssignee/laneOrganization/laneSupplier/laneRoleGroupSelectedList' }
  ```
- Persist/restore of these into the BPMN `uengine:Properties` JSON: **load** at lines 10191-10275, **save** at lines 11151-11178.

Also legacy/unused: `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/role/RolePanel.vue` (`bpmn-role-panel`, "Pool/Lane (Role) Name") — Camunda-style assignee/candidateUsers/candidateGroups, options fed by props only.

---

# 2. Where the Lane assignee options come from today

| Panel | Field | Data source |
|---|---|---|
| `GPTLanePanel.vue` | `organizationOptions` | **Direct Supabase**, `loadOrganizationOptions()` lines 367-429 |
| `GPTLanePanel.vue` | Direct user | `UserSelectField.vue` → `backend.getUserList()` + `defaultSetting.getAgentList` (`/home/kimsanghoon/process-gpt-vue3/src/components/ui/field/UserSelectField.vue:205-210`) |
| `LanePanel.vue` | users/groups/roles/depts | **Keycloak REST** (`src/utils/keycloak.js`) |
| `ProcessHierarchyProperties.vue` | `laneUserOptions` | `backend.searchUsersByName(kw, 0, 500)` (line 8271) |
| `ProcessHierarchyProperties.vue` | `laneGroupOptions` (담당 조직) | `backend.searchGroupsByName(kw, 0, 500)` (line 8096) |
| `ProcessHierarchyProperties.vue` | `laneSupplierOptions` | `backend.searchSuppliers()` (line 8226) |
| `ProcessHierarchyProperties.vue` | `laneRoleGroupOptions` | Supabase `lane_role_groups` + `lane_role_group_members` (lines 8110-8147) |

**`GPTLanePanel.loadOrganizationOptions()` (lines 367-429) is the one that already reads org-chart data** — it hits Supabase directly rather than any store/util:

```js
const { data: orgData } = await supabase.from('configuration')
    .select('value').eq('key', 'organization').eq('tenant_id', tenantId).single();
const chart = orgValue.chart || orgValue;
const teams = this.extractTeamsFromOrgChart(chart);   // walks nodes where n.data.isTeam
// + supabase.from('org_chart_groups').select('id, name').eq('tenant_id', tenantId)
```
`extractTeamsFromOrgChart` (lines 430-446) is a **hand-rolled duplicate** of `collectTeams()` in `orgChartModel.ts`. The exact same block is copy-pasted in `/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/ProcessDefinitionMap.vue:2242-2340`.

**Important backend gap:** `searchGroupsByName` / `searchUsersByName` / `searchSuppliers` exist **only in `PalModeBackend.ts`** (`/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts:694, 717, 737`). They hit `/pi-system-backend/organization/{users,groups}/search` and fall back to Supabase `users` — and `searchGroupsByName`'s fallback **returns an empty list**:

```ts
async searchGroupsByName(keyword, page = 0, limit = 20) {
    try { return (await axiosInstance.get('/pi-system-backend/organization/groups/search', {...})).data; }
    catch { return { groups: [], page: { index: page, limit, total_count: 0 } }; }   // &lt;-- empty when no PI backend
}
```
`ProcessGPTBackend.ts` / `UEngineBackend.ts` do **not** implement them (`BackendFactory.ts:32` lists `getGroupList: []` as a null-skip default). So the "담당 조직" autocomplete is empty whenever the external PI org service is absent — this is the natural place to plug in org-chart data.

---

# 3. New organization chart implementation (`src/views/organization/`)

Routed at `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts:93-121` — **PAL mode only**; non-PAL falls back to the legacy `@/components/OrganizationChartChat.vue`.

| File | Lines | Role |
|---|---|---|
| `orgChartModel.ts` | 422 | **Pure-function tree model + the canonical API to reuse** |
| `OrganizationChartView.vue` | 1532 | Container: load/save, drag&amp;drop, users merge, agents, pre-registration |
| `OrgTreeNode.vue` | 510 | Recursive department/member card node (presentational, `action` events) |
| `OrgDetailPanel.vue` | 1024 | Right-hand detail/edit panel for the selected team |
| `MembershipApprovalPanel.vue` | 83 | Membership approval tab |
| `RoleRequestPage.vue` | 67 | Standalone role request page |
| `OrganizationChartBeforeView.vue` | 73 | Read-only "before" snapshot view |

### Data model / storage
Storage format is **unchanged legacy**: Supabase table `configuration`, row `key='organization'`, column `value.chart` = a tree of `{ id, name, data, children }` where `data.isTeam === true` marks a department. See the header doc of `orgChartModel.ts:1-14`.

```ts
export interface OrgNode { id: string; name?: string; data: OrgNodeData; children?: OrgNode[]; }
// OrgNodeData: { id, name, username, email, role, profile, img, isTeam, isAgent, is_agent, pid, leaderId, description }
export const ROOT_ID = 'root';
```

Load/save in `OrganizationChartView.vue`:
- `loadChart()` line 606-621 → `backend.getData('configuration', { match: { key: 'organization' } })` → `normalizeTree(data.value?.chart, tenant)`
- `persist()` line 626-648 → `backend.putObject('configuration', { key:'organization', value:{ chart: serializeTree(root) } }, { onConflict: 'key,tenant_id' })`
- `loadUsers()` line 557-571 → `backend.getUserList({ match: { tenant_id } })` (Supabase `users`)
- `loadPendingMembers()` line 586-604 → Supabase `pending_org_members`
- `syncUserDepartments()` line 650+ writes department back onto `users`

### Reusable helpers in `orgChartModel.ts` (this is your best integration surface)
- `normalizeTree(raw, fallbackName)` / `serializeTree(root)` — line 341 / 413
- `collectTeams(root, includeRoot)` → `[{ node, depth, path }]` with `path` = `"회사 / 개발본부 / 플랫폼팀"` — **line 182** (exactly what an org-picker autocomplete needs)
- `collectMembers(node, deep)` — line 197, `memberCount()` — line 217
- `findNode`, `findParent`, `pathTo`, `pathLabel`, `walk`, `childTeams`, `childMembers`, `isTeam`, `isMember`, `isAgentNode`, `displayName`, `teamsOfMember`, `assignedMemberIds`
- `isDuplicateTeamName`, `normalizeTeamName` — dept names are enforced globally unique, so a name is a legitimate key.

### Reusable org-unit / member pickers — what exists
- **No dedicated org-tree picker dialog exists.** `OrgTreeNode.vue` is presentational and reusable in principle (props at lines 138-151: `node, depth, selectedId, expandedIds, matchedIds, searching, showMembers, editable, dropTargetId, memberLimit`; single `action` emit) but is tightly coupled to the chart's drag&amp;drop editing flow.
- The closest thing to a flat picker is inside `OrgDetailPanel.vue:641-654`, which builds indent-labeled department items from `collectTeams(props.root, true)` for the "move team" select. That pattern is directly liftable.
- **`/home/kimsanghoon/process-gpt-vue3/src/components/ui/OwnerSelect.vue` is the existing reusable *member* selector** and it already reads the org chart via the provider abstraction (see §4).

---

# 4. Org-chart data already consumed outside `src/views/organization/`

### 4a. `src/providers/organization/` — the intended abstraction (most reusable, currently underused)
| File | Notes |
|---|---|
| `OrganizationProvider.ts` (77) | `IOrganizationProvider` interface + `OrganizationMember` / `OrganizationDepartment` / `SearchOptions` types. Methods: `getDepartments`, `getDepartment`, `getMembers`, `getMember`, `searchMembers`, `getMembersByDepartment`, `getCurrentUser`, `getCurrentUserDepartment` |
| `InternalOrganizationProvider.ts` (302) | Reads the **same** `configuration` / `key='organization'` / `value.chart`, then maps `data.isTeam` nodes → departments and leaves → members (`initialize()` lines 31-49; `nodeToDepartment` 59-79; `nodeToMember` 82-91) |
| `OrganizationProviderFactory.ts` (122) | `getOrganizationProvider()` singleton |
| `index.ts` (26) | barrel |

Only **two** consumers today:
- `/home/kimsanghoon/process-gpt-vue3/src/components/ui/OwnerSelect.vue:62,146` — reusable member `v-autocomplete` with avatar/department/position slots, merges provider results with `backend.searchUsersByName`, `multiple` prop supported.
- `/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/SubProcess.vue:110,347`

### 4b. `src/utils/organizationUtils.ts` (487 lines) — direct-tree readers, used by permission code
Reads `configuration/key='organization'` each call (no caching). Exports:
`getCurrentUserTeamName()` (165), `getCurrentUserTeamInfo()` (215), `getCurrentUserOrganizations()` (343), `getCurrentUserOrgMemberEmails()` (389), `getCurrentUserTeamMemberIdentifiers()` (419), `getCurrentUserTeamIdentifiers()` (460).

Note the doc comment on line 456-459 — **the runtime already matches BPMN `laneOrganization` against org-chart team identifiers**:
&gt; "BPMN laneOrganization 이 팀 id/name 중 무엇으로 저장되어 있어도 비교할 수 있도록 여러 식별자를 수집한다."

Consumers: `ProcessGPTBackend.ts:2402, 5455, 5563`, `useProcessArchitecture.ts`, `BpmnUengine.vue`, `ProcessDefinitionModule.vue`.

### 4c. `RaciField.vue` — **does NOT touch org data** (this answers your specific question)
`/home/kimsanghoon/process-gpt-vue3/src/components/designer/RaciField.vue` (221 lines, modified but uncommitted). `git diff` shows the change was purely **adding a `dialogMode`** (summary-in-panel + edit-in-dialog) for narrow property panels — 135 insertions, all template/`openDialog`/`applyDialog`/`hasEntries`. No API, no store, no import at all.

Its `suggestions` prop is filled by `raciSuggestions()` in `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue:4833-4857`, which scrapes the **BPMN model itself**:

```js
modeler.get('elementRegistry').getAll().forEach((el) =&gt; {
    if (el.type === 'bpmn:Lane') { /* push lane name */ }
    else if (el.type.includes('Task')) { /* push existing raci R/A/S/C/I strings */ }
});
```
So RACI names are free text seeded from lane names — **an obvious second candidate for org-chart wiring**, and it would become consistent automatically if lane names are driven from org units.

### 4d. Other direct readers of `configuration/key='organization'`
- `/home/kimsanghoon/process-gpt-vue3/src/components/pages/account-settings/ManageAccessTab.vue:316, 449`
- `/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/PermissionDialog.vue:330` (via `backend.getGroupList()`)
- `/home/kimsanghoon/process-gpt-vue3/src/views/apps/chat/Chats.vue:881`, `AgentChat.vue:381`, `ProcessDefinitionChat.vue:647`, `OrganizationChartChat.vue:185`
- `ProcessGPTBackend.getGroupList()` at `/home/kimsanghoon/process-gpt-vue3/src/components/api/ProcessGPTBackend.ts:4147-4164` — returns only `value.chart.children` (top level only, not recursive)
- `ProcessGPTBackend.getOrgChartGroupList()` at line 5379-5396 — Supabase `org_chart_groups`

### 4e. Related tables
- `org_chart_groups` / `org_chart_group_teams` — `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260106_org_chart_groups.sql`; admin UI at `/home/kimsanghoon/process-gpt-vue3/src/components/pages/account-settings/OrgChartGroupTab.vue`. These are named bundles of org-chart team ids, used for process permissions.
- `lane_role_groups` / `lane_role_group_members` (columns `org_id`, `org_name`, `member_type: 'team'|'supplier'`) — read in `ProcessHierarchyProperties.vue:8110-8147`, recycle-bin ops in `/home/kimsanghoon/process-gpt-vue3/src/stores/adminConsole.ts:566-670`. **No creation UI in this repo** — rows come from elsewhere. `member_type='team'` `org_id`s are org-chart team ids, so this table is already an org-chart consumer.
- `suppliers`, `pending_org_members`, `users`.

---

# Wiring notes / suggested plan

1. **Pick the target panel.** `ProcessHierarchyProperties.vue:1302-1330` (`laneOrganization` + `laneGroupOptions`) is the live "담당 조직" field in PAL mode; `GPTLanePanel.vue:33-62` is the ProcessGPT one. They persist to different shapes (`uengineProps.laneOrganization[]` vs `roleResolutionContext.organizationId`), so they need separate wiring.

2. **Single source of truth.** Add an org-chart loader (a Pinia store or an extension of `getOrganizationProvider()`) that does `backend.getData('configuration', { match: { key: 'organization' } })` → `normalizeTree()` → `collectTeams(root, false)`, and cache it. Today that fetch is duplicated at least 10 times across the codebase with three different traversal implementations (`GPTLanePanel.extractTeamsFromOrgChart`, `ProcessDefinitionMap.extractTeamsFromOrgChart`, `InternalOrganizationProvider.collectDepartments`, `organizationUtils.findUserOrganizationsInTree`). Note there is **no store in `src/stores/` for org data** — this would be new.

3. **Cheapest high-value fix:** make `PalModeBackend.searchGroupsByName`'s catch-branch fall back to `collectTeams()` over the org chart instead of `return { groups: [], ... }` (`PalModeBackend.ts:717-727`). That instantly populates the existing "담당 조직" autocomplete with no template changes, and `collectTeams().path` gives good display labels. Emit `{ id, name, member_count }` to match the existing item shape (`ProcessHierarchyProperties.vue:8097-8101` and the `member_count` chip at line 1327).

4. **ID compatibility.** Save `id` = org-chart node id and `name` = department name. `organizationUtils.collectTeamIdentifiers()` (line 328-336) already matches on `node.id`, `data.id`, `data.name`, `data.org_code`, `data.org_name`, so either survives round-trip. Keeping `name` populated also keeps `onLaneOrgSelected` (line 8056) working, which copies the joined org names into the Lane's label (`taskForm.name`).

5. **If you want a tree picker**, build it on `collectTeams(root, true)` → indent-labeled flat items (copy the pattern at `OrgDetailPanel.vue:641-654`), rather than reusing `OrgTreeNode.vue`, which carries drag&amp;drop/editing concerns.</result>
<usage><subagent_tokens>132295</subagent_tokens><tool_uses>83</tool_uses><duration_ms>360609</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-10T08:13:27.613Z (backfill)

```text
프로세스 순서도에서 검증 완료 시, 이상 없을 때는 아무런 반응이 없음.
```

<!-- backfilled-from: 33800e41-6f21-4fd7-82f0-c9cf63d2346a -->

## Prompt — 2026-09-11T01:49:22.612Z (backfill)

```text
@docs/security.md 해당 문서를 기준으로 작업계획을 세우고, OPUS 모델을 활용해서 각각 작업 시키도록해.
```

## Prompt — 2026-09-11T01:53:04.332Z (backfill)

```text
<task-notification>
<task-id>ab3f792b99ffb196e</task-id>
<tool-use-id>toolu_01NXsVyZSUwYFcCmyyWJR4H5</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/ab3f792b99ffb196e.output</output-file>
<status>completed</status>
<summary>Agent "1-4 로그인 실패 메시지 통합" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>구현 완료했습니다. git commit은 하지 않았습니다.

## 핵심 발견

로그인 실패 메시지는 `LoginForm.vue`나 `stores/auth.ts`가 아니라 **`src/utils/StorageBaseSupabase.js`의 `signIn()`** 에서 만들어지고 있었습니다. 두 상위 파일은 `errorMsg`를 그대로 통과시키기만 하므로 수정 불필요 (레이아웃·스타일 무변경).

기존 분기는 세 갈래로 계정 존재 여부를 그대로 노출했습니다.
1. `public.users`에 해당 이메일(+테넌트) 행이 없으면 → Supabase Auth 호출조차 없이 `notRegisteredEmail`("가입된 이메일주소가 아닙니다.")
2. 인증 실패 시 **`this.list('users')`로 사용자 테이블 전체를 받아** 이메일 존재 여부를 확인 → 있으면 `wrongPassword`, 없으면 `wrongId`

## 수정한 파일

- **`/home/kimsanghoon/process-gpt-vue3/src/utils/StorageBaseSupabase.js`** (`signIn`, 211~280행)
  - 비밀번호 오류 분기: `list('users')` 전체 조회 + 이메일 존재 판별 로직을 제거하고 단일 문구로 통일. 사용자 테이블 전량 조회가 사라진 부수 효과도 있습니다.
  - 미등록 이메일 분기: 동일 문구로 교체.
  - `recordAuthAudit`의 `reason`(`not_registered_email` 등)은 서버 감사 로그용이므로 그대로 유지 — 사용자에게 보이는 문구만 통일했습니다.
- **`/home/kimsanghoon/process-gpt-vue3/src/utils/locales/ko.json`**, **`/home/kimsanghoon/process-gpt-vue3/src/utils/locales/en.json`**
  - `StorageBaseSupabase.wrongPassword` / `wrongId` / `notRegisteredEmail` 3개 키 삭제 → `StorageBaseSupabase.invalidCredentials` 1개로 통합.
  - ko: `"이메일 또는 비밀번호가 올바르지 않습니다."` / en: `"Invalid email or password."`
  - 로케일 파일은 이 두 개뿐(`src/utils/locales/messages.ts`가 en/ko만 등록). JSON 파싱 검증 완료, 삭제된 키의 잔존 참조 없음.

## 계정 존재 노출이 의심되는 다른 경로 (범위 밖, 보고만)

1. **회원가입 — `StorageBaseSupabase.js:337~349` / `stores/auth.ts:81~85`**: Supabase의 `User already registered` 에러를 `auth.userAlreadyRegistered`("This email is already registered.")로 표시하고, 이메일 확인이 켜진 환경에서 `identities: []`로 돌아오는 경우까지 잡아 **하드코딩 문자열 `'이미 가입된 이메일입니다.'`** 를 띄웁니다. 즉 Supabase가 일부러 숨긴 존재 여부를 프론트가 다시 드러냅니다. 가장 명확한 잔여 열거(enumeration) 경로입니다.
2. **로그인 — `emailNotConfirmed` 분기 (227~243행)**: "계정 인증이 완료되지 않았습니다"는 곧 "그 계정은 존재한다"는 뜻입니다. UX 트레이드오프가 있어 이번엔 손대지 않았습니다.
3. **타이밍 사이드채널 (218행)**: 미등록 이메일은 `signInWithPassword` 호출 없이 즉시 반환되고, 등록된 이메일은 GoTrue 왕복 + bcrypt 검증을 거칩니다. 문구는 같아져도 응답 시간 차이로 구분 가능합니다. 완전 차단하려면 사전 `users` 조회를 없애고 항상 Auth를 호출하는 구조 변경이 필요합니다.
4. 비밀번호 재설정(`resetPassword`, 458행)은 결과와 무관하게 `auth.emailSent`만 띄우므로 문제 없습니다.
5. 참고로 `mobile/src/lib/session.js`의 `classifyAuthError`는 이미 "계정 없음"과 "비밀번호 오류"를 동일 분류로 처리하고 있어(테스트 `session.test.js:52-54`에서 동등성까지 단언) 이번 변경과 방향이 일치합니다.
6. `organizationChartDefinition.emailAlreadyExists`는 관리자 조직도 다이얼로그(인증된 관리자 전용)라 노출 위험으로 보지 않았습니다.</result>
<usage><subagent_tokens>46041</subagent_tokens><tool_uses>29</tool_uses><duration_ms>125397</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T01:55:20.637Z (backfill)

```text
<task-notification>
<task-id>a717a3698be727c59</task-id>
<tool-use-id>toolu_01XVegb8jbb7vuyG39WwPRg2</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a717a3698be727c59.output</output-file>
<status>completed</status>
<summary>Agent "1-3 감사 로그 actor_id 차단" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Migration validated against a throwaway PostgreSQL 15 container (all four paths behaved correctly).

## 새 마이그레이션

`/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260911_admin_audit_log_actor_enforcement.sql`

### 트리거 로직 요약

1. **컬럼 추가** (`ADD COLUMN IF NOT EXISTS`): `actor_username`, `actor_org_name`, `actor_employee_no`. 이 세 필드는 UI(`AuditTrail.vue` `formatAdminActor`, `ProcessHierarchyProperties.vue` `ownerHistoryActor`)와 타입(`AdminAuditLogEntry`)이 이미 읽고 있었지만 **어디에서도 채우지 않아 항상 비어 있던** 필드다. 이번에 DB가 채운다.
2. **`public.enforce_admin_audit_log_actor()`** — `plpgsql`, `SECURITY DEFINER`, `SET search_path = public, pg_temp` (users에 RLS가 걸려 있어 — `20260403000001_role_based_rls.sql` — 호출자 권한으로는 조회가 막힐 수 있음).
   - `auth.uid()`가 NULL이면 즉시 `RETURN NEW` → service_role INSERT는 기존 값 유지 (`actor_id`가 NOT NULL이라 덮어쓰면 깨짐).
   - 아니면 `NEW.actor_id := auth.uid()::text`로 강제.
   - `public.users`에서 `username`, `COALESCE(org_name, department_name)`, `employee_no`를 조회해 세 컬럼에 세팅. users PK가 `(id, tenant_id)`라 `ORDER BY (u.tenant_id IS NOT DISTINCT FROM NEW.tenant_id) DESC LIMIT 1`로 로그 테넌트 행을 우선 선택.
   - users에 행이 없으면 세 컬럼을 **NULL로 남긴다** (클라이언트 값을 살려두면 위조 통로가 됨).
3. **`BEFORE INSERT` 트리거**: `DROP TRIGGER IF EXISTS` 후 `CREATE TRIGGER`. UPDATE는 `20260526`에서 이미 RLS로 차단돼 INSERT만 걸면 충분.
4. 테이블/컬럼 COMMENT 갱신 — `20260526`이 남긴 "actor_id는 클라이언트 값, 추후 트리거 예정" 문구를 해소.

컨테이너 검증 결과: 재실행 멱등, uid NULL이면 `svc@x.com` 유지, 로그인 시 위조 `actor_id: 'ceo@example.com'` / `actor_username: '사장님'`이 실제 uid·`홍길동`/`경영지원팀`/`E12345`로 교체, 미등록 uid는 uid만 기록되고 이름은 NULL.

## admin_audit_log INSERT 클라이언트 코드

INSERT를 실제로 수행하는 곳은 **한 군데**뿐이고 나머지는 그 래퍼 호출이다.

- `/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts:251` — `insertAdminAuditLog()`, 유일한 `.from('admin_audit_log').insert(...)` 지점. `actor_id`를 `localStorage.employeeNo → email → uid → window.$user → 'system'` 순으로 채운다.
- 호출부:
  - `/home/kimsanghoon/process-gpt-vue3/src/stores/systemManagement.ts:69` (시스템 관리 감사 로그 헬퍼)
  - `/home/kimsanghoon/process-gpt-vue3/src/stores/adminConsole.ts:1640`
  - `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchy.vue:3729, 4163, 4334, 4346`
  - `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyProperties.vue:7346, 8034`
- 조회부(참고): `PalModeBackend.ts:823` `getAdminAuditLogs()`.

**클라이언트는 변경하지 않았다.** `actor_id`가 `NOT NULL`이라, 세션이 없는 경로에서 INSERT가 실패하지 않으려면 클라이언트 fallback 값이 여전히 필요하다 (트리거는 `auth.uid()`가 있을 때만 덮어쓴다). 죽은 코드가 아니므로 최소 변경 원칙에 따라 그대로 뒀다.

## 남은 구멍 (이번 범위 밖, 참고)

- 세션 없는 **anon 키** 직접 INSERT는 `auth.uid()`가 NULL이라 service_role과 같은 분기를 타 클라이언트 값이 유지된다. 막으려면 `20260526`의 INSERT 정책에서 `anon`을 빼야 하는데, 이는 RLS 정책 변경(별도 작업)이다.
- `created_at`과 `tenant_id`도 클라이언트가 보낸 값을 그대로 쓴다. 항목 16이 `actor_id`만 명시해 건드리지 않았지만, 감사 로그 신뢰성 관점에서 후속 작업 후보다.
- git commit은 하지 않았다.</result>
<usage><subagent_tokens>67617</subagent_tokens><tool_uses>36</tool_uses><duration_ms>272902</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T01:58:12.252Z (backfill)

```text
<task-notification>
<task-id>a14c7383f74d122e5</task-id>
<tool-use-id>toolu_01P9WSNQgsdwqWGLS3Svcu5e</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a14c7383f74d122e5.output</output-file>
<status>completed</status>
<summary>Agent "1-1 로그인 감사 기록 활성화" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>작업 완료. 커밋은 하지 않았습니다.

## 변경 파일

**1. `src/utils/StorageBaseSupabase.js`**
- `recordAuthAudit` 본문 복원: `window.$supabase.rpc('record_auth_audit', {...})` 호출. supabase-js는 RPC 오류를 throw 하지 않고 `{ error }`로 반환하므로 `error`도 `console.warn`만 하고 흘려보내며, 전체가 try/catch 안에 있어 어떤 경우에도 로그인/로그아웃 흐름을 깨지 않음. IP/User-Agent는 **일부러 보내지 않음**(클라이언트 값은 위조 가능 → 서버측 RPC가 캡처).
- **누락 호출부 보완**: `signIn`의 성공 분기(`if (!result.error)`)에 성공 기록이 없었음 → `action:'login', success:true, metadata:{method:'password'}` 추가. 세션 발급 직후 호출하므로 `user_id`가 채워짐. 기존 6개 호출부(실패 3, oauth 2, logout 1)는 그대로.
- 참고: 같은 파일을 다른 작업(1-4 로그인 실패 메시지 통합)이 동시에 고치고 있었는데, 감사 호출부 7곳 모두 온전히 남아 있음을 확인했습니다.

**2. `supabase/migrations/20260911000001_auth_audit_log.sql` (신규)** — 원본 `supabase/migrations/auth_audit_log.sql`은 삭제.
날짜 접두어는 최근 컨벤션(`20260909000001_…`)에 맞춘 14자리 형식을 썼습니다.

원본 대비 보완한 점:
- `action`에 `login_failed` 허용 (`login | login_failed | logout | login_oauth`)
- `tenants` FK 제거 — 미등록 테넌트의 로그인 시도가 FK 위반으로 기록 실패하거나 테넌트 삭제 시 소급 NULL 되는 것 방지
- **보안 결함 수정**: 원본은 `request.headers` 전체를 `metadata`에 저장 → `authorization`/`apikey` JWT가 감사 테이블에 평문 적재됨. `origin/referer/host`만 선별 저장하도록 변경
- RLS 축소: anon 직접 INSERT 금지(RPC 전용), authenticated는 `user_id = auth.uid()` 자기 기록만, SELECT는 관리자만(`current_user_role()='admin'` OR `users.is_admin/role in (admin,superadmin)`, 테넌트 스코프 + tenant NULL 행은 관리자 열람 가능), UPDATE/DELETE는 정책 미선언 + `REVOKE`로 append-only (`20260526_admin_audit_log_append_only.sql`과 동일 패턴)
- RPC는 잘못된 action/내부 오류를 예외로 던지지 않고 `RAISE WARNING` 후 무시 (이중 방어)
- 완전 idempotent: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT/POLICY IF EXISTS` 후 재생성

**3. `docs/security.md`** — 1-1 항목에 적용된 마이그레이션 파일명/테이블명·IP 캡처 방식 기재.
**4. `scripts/validate-migrations-empty-db.sh`** — 주석에서 삭제된 `auth_audit_log.sql` 예시를 `consolidated_schema.sql`로 교체(동작 변경 없음).

## 검증
- `node --check` 통과, `prettier --check` 통과 (UI 변경 없음)
- 일회용 postgres:16 컨테이너 + Supabase shim으로 실제 검증: 신규 적용/재적용(idempotent)/구 버전 테이블 위 덮어쓰기(FK 제거·CHECK 확장·구 정책 정리) 모두 성공. 동작 확인 결과: 관리자 조회 2건/비관리자 0건, 타인 user_id 위조 INSERT 차단, 자기 기록 INSERT 통과, UPDATE/DELETE 차단, anon 직접 INSERT 차단·anon RPC 기록 성공, 미등록 테넌트·잘못된 action도 예외 없이 처리.

## 후속 작업(1-2)용 스키마

테이블 `public.auth_login_audit`:

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `created_at` | timestamptz NOT NULL | `now()`, 기본 정렬 키(DESC 인덱스 있음) |
| `tenant_id` | text NULL | 로그인 전 시도는 NULL 가능, FK 없음 |
| `email` | text NULL | 시도한 계정 |
| `action` | text NOT NULL | `login` / `login_failed` / `logout` / `login_oauth` |
| `success` | boolean NOT NULL | |
| `error_message` | text NULL | 최대 2000자 |
| `user_id` | uuid NULL | `auth.uid()` (실패 로그인은 NULL) |
| `ip_address` | text NULL | 서버측 `x-forwarded-for`/`x-real-ip` 캡처 |
| `user_agent` | text NULL | 서버측 헤더 캡처, 최대 1000자 |
| `metadata` | jsonb NOT NULL | `{method, provider, reason, origin, referer, host}` |

- 현재 클라이언트는 **실패도 `action='login'` + `success=false`**로 남깁니다(호출부 유지 지시에 따름). 조회 화면 필터는 "액션"과 "성공 여부"를 분리해 두면 되고, `login_failed` 값도 DB에서 허용되니 나중에 전환 가능합니다.
- 인덱스: `created_at DESC`, `(tenant_id, created_at DESC)`, `(email, created_at DESC)`, `(user_id, created_at DESC)`, `(action, created_at DESC)`, 부분 인덱스 `(email, created_at DESC) WHERE success = false`(2단계 계정 잠금용).
- 조회는 관리자 세션에서 그냥 `supabase.from('auth_login_audit').select(...)` 하면 RLS가 관리자만 통과시킵니다. CSV 내보내기/페이지네이션도 동일 테이블 기준.

## 남은 갭 (이번 범위 밖)
- Keycloak OAuth **최종 성공**은 여전히 미기록입니다. 코드 주석대로 `SIGNED_IN` 이벤트에서 남겨야 하는데, 리스너(`src/utils/authClaims.ts`, `src/utils/supabaseAuth.js`)를 건드려야 하고 토큰 갱신마다 중복 기록될 위험이 있어 손대지 않았습니다.
- SSO 헤더 교환 경로(`src/utils/ssoAuth.ts`)는 Supabase Auth를 쓰지 않아 감사 기록이 없습니다.</result>
<usage><subagent_tokens>91883</subagent_tokens><tool_uses>40</tool_uses><duration_ms>456032</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:04:26.399Z (backfill)

```text
<task-notification>
<task-id>a128a0731156928cf</task-id>
<tool-use-id>toolu_01P7fPfgYQ1V2ZmYMLWnA1UJ</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a128a0731156928cf.output</output-file>
<status>completed</status>
<summary>Agent "3-1 files 버킷 비공개 전환" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>구현 완료. 마이그레이션 파일 하나만 추가했고 프론트 코드는 건드리지 않았습니다.

## 새 파일
`/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260911_storage_private_buckets.sql`

## 현황 (조사 결과)
- `files` 버킷: `20260507_audit_policy.sql:66-86`에서 `public = true` + `bucket_id = 'files'`만 보는 정책 4개(SELECT/INSERT/UPDATE/DELETE). **role 제한이 없어 anon 포함 전원에게 열려 있었음.**
- `chat-images`: 마이그레이션 자체가 없음 (대시보드 수동 생성). 이번 파일에서 함께 생성·보장.
- `process-components` (`20260709_..._marketplace.sql`)는 이미 private. 범위 밖으로 두었음.
- **업로드 경로에 테넌트가 전혀 없음**: `files` = `uploads/&lt;ts&gt;_&lt;uuid8&gt;&lt;ext&gt;`, `chat-images` = `uploads/&lt;name|uuid&gt;&lt;ext&gt;`, SchemaFieldInput = `&lt;path_prefix&gt;/&lt;...&gt;`. 테넌트 격리는 DB 행(`tenant_id` 컬럼)에만 존재.
- 테넌트 판별 표준은 `public.tenant_id()` (JWT `app_metadata.tenant_id`), 관리자 판정은 `public.current_user_role()` + `users.is_admin/role` 이중 확인 (`20260403000001_role_based_rls.sql`, `20260911000001_auth_audit_log.sql` 패턴).

## 버킷 설정값
| 버킷 | public | file_size_limit | allowed_mime_types |
|---|---|---|---|
| `files` | false | 52428800 (50MB, `supabase/config.toml`의 전역 50MiB와 일치) | 46종 — pdf/office(xlsm 포함)/ODF/rtf, HWP·HWPX 변형 5종, 텍스트·JSON·XML·YAML·코드류, 이미지 8종, zip/gzip, `application/octet-stream` |
| `chat-images` | false | 10485760 (10MB) | 이미지 10종만 (svg 포함 — `accept="image/*"` 대응) |

`.hwp`/`.bpmn`/`.zip`/`.skill`은 브라우저가 Content-Type을 octet-stream으로 보내서 허용이 불가피했고, 그 구멍은 **INSERT 정책의 실행파일 확장자 블랙리스트**(exe/bat/msi/dll/vbs/ps1/jar/apk/iso/deb/rpm 등 29종, 프론트 어느 `accept`에도 없는 것만)로 막았습니다.

## RLS 요약 (`storage.objects`, `files`+`chat-images`)
헬퍼 3개 추가: `public.storage_path_tenant(name)`(경로 첫 세그먼트가 실제 `tenants.id`면 반환), `public.storage_owner_tenant(owner)`(업로더의 `users.tenant_id`), `public.storage_object_in_tenant(name, owner)` = `COALESCE(경로테넌트, 업로더테넌트, 현재테넌트) = tenant_id()`.

- **SELECT** `TO authenticated`: 자기 테넌트 객체만
- **INSERT** `TO authenticated`: 자기 테넌트 경로 + `owner = auth.uid()` + 차단 확장자 아님
- **UPDATE / DELETE** `TO authenticated`: 업로더 본인 또는 관리자 (+ 테넌트 조건)
- **anon**: 정책 없음 = 전면 차단
- 기존 `files_bucket_public_*` 4개 명시 DROP + 대시보드에서 손으로 만든 이름 불명 정책까지 `pg_policies` 스캔으로 제거(`'files'`/`'chat-images'` 리터럴 매칭, `process-components`는 보존)

### 검증
throwaway Postgres 15에 스텁 스키마를 올려 실제로 실행했습니다: 1·2회 연속 실행 통과(idempotent), 레거시 정책 4개 + "Public Access" 류 제거되고 `process-components read`는 생존, 그리고 RLS 동작 — 자기 파일 insert OK / `.exe` DENY / 남의 owner로 insert DENY / 등록된 타 테넌트 경로 insert DENY / 타 테넌트 사용자 SELECT 0건 / 동료의 파일 UPDATE·DELETE 0건 / 관리자 DELETE 1건 — 전부 의도대로 나왔습니다.

## 후속 3-2(서명 URL 전환)가 알아야 할 것
`createSignedUrl` 사용처는 현재 레포에 **0건**이고, `getPublicUrl` 원천은 딱 4곳입니다. 이 4곳만 고치면 나머지 소비처는 따라옵니다.

**깨지는 원천 4곳**
- `src/utils/StorageBaseSupabase.js:1477` `getImageUrl` (chat-images)
- `src/utils/StorageBaseSupabase.js:1522` `getFileUrl` (files)
- `src/utils/StorageBaseSupabase.js:1536` `downloadFile` — public URL을 `fetch`하는 구조라 통째로 `.download()` 또는 서명 URL로 바꿔야 함
- `src/components/ui/SchemaFieldInput.vue:787-788` — 업로드 직후 `publicUrl`을 **폼 데이터에 영구 저장**. 저장된 절대 URL 마이그레이션이 필요한 지점

**소비처(표시/다운로드 깨짐)**: `PolicyDocumentManager.vue` + `services/policyDocumentService.ts`, `ProcessHierarchyProperties.vue:10916,10939`(window.open), `GPTUserTaskPanel.vue:839`·`PALUserTaskPanel.vue:326`, `Chat.vue`(첨부 칩 다수), `ChatThread.vue:363`, `ChatRoomPage.vue`, `AgentMonitor.vue`, `EventTimeline.vue`, `FormWorkItem.vue`, `mobile/src/lib/{attachments,agentChat,download}.js`.

**안 깨지는 것**: `.download()` 호출부(`PolicyDocumentManager.vue:448,531`, `SchemaFieldInput.vue:808`, 마켓플레이스)는 인증 세션으로 내려받으므로 그대로 동작합니다.

**동작 변화 3가지** (파일 상단 주석에도 기재)
1. anon 접근 전면 차단
2. `SchemaFieldInput.vue:784`의 `upsert: true`(name_strategy='original') — 이제 남의 파일은 덮어쓸 수 없음
3. `PropertySchemaStudio`의 `file_bucket` 자유 입력으로 만든 커스텀 버킷은 정책이 없어 차단 (원래도 `files` 전용 정책뿐이라 동작 안 했음)

**남은 과제**로 파일 안에 TODO를 적어뒀습니다: 업로드 경로를 `&lt;tenant_id&gt;/uploads/...`로 바꾸고 기존 객체를 이관하면 `storage_object_in_tenant()`의 "판정 불가 시 통과" 폴백을 제거해 테넌트 격리를 완전히 닫을 수 있습니다. 현재는 owner가 유실된 레거시 객체가 테넌트 간에 열람 가능합니다. 롤백 SQL도 파일 하단 주석에 포함했습니다. git commit은 하지 않았습니다.</result>
<usage><subagent_tokens>98807</subagent_tokens><tool_uses>42</tool_uses><duration_ms>518295</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:06:14.328Z (backfill)

```text
<task-notification>
<task-id>a6a556afcb1ad6716</task-id>
<tool-use-id>toolu_01EVvB8HY5bo4w4fqap8wCnz</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a6a556afcb1ad6716.output</output-file>
<status>completed</status>
<summary>Agent "2-2 비밀번호 정책 적용" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. Implemented `docs/security.md` 2-2 (항목 21).

## 적용된 정책 규칙
- 최소 **10자**
- 영문 **소문자·대문자·숫자·특수문자 각 1자 이상**
- 특수문자 집합: `` !@#$%^&amp;*()_+-=[]{};'\":|&lt;&gt;?,./`~ ``
- 유출 비밀번호(HIBP) 차단

## GoTrue 설정 반영 위치
- `/home/kimsanghoon/process-gpt-vue3/docker-compose/docker-compose.yaml` — `services.auth.environment`에 3개 변수 추가. compose 변수 보간 때문에 `$`는 `$$`로 이스케이프(`!@#$$%^&amp;*()…`). `yaml.safe_load`로 최종 값이 의도대로 파싱됨을 확인.
- `/home/kimsanghoon/process-gpt-vue3/kubernetes/supabase-deployment.yaml` — `supabase-auth` 컨테이너 `env`에 추가 (여기선 `$` 그대로). 참고: 이 파일은 우리가 건드리지 않은 다른 위치(라인 215 부근)에 **기존부터 존재하던 YAML 파싱 오류**가 있습니다.
- `/home/kimsanghoon/process-gpt-vue3/docker-compose/.env.example` — 정책이 compose에 하드코딩되어 있다는 주석만 추가(임의 완화 방지).
- `/home/kimsanghoon/process-gpt-vue3/docs/security-gotrue-password-policy.md` (신규) — Supabase Cloud 대시보드 / `supabase/config.toml` 등 레포 밖 배포용 스니펫, 이스케이프 주의사항, 에러 매핑 표. K8s 이미지가 `gotrue:v2.143.0`으로 compose(`v2.177.0`)보다 낮아 HIBP 미동작 시 태그 상향 필요하다는 점도 기록.

## 수정·추가 파일
**신규**
- `src/utils/passwordPolicy.ts` — 공용 유틸: `getPasswordViolations`, `isPasswordValid`, `getPasswordViolationMessage`(부족 조건만 나열), `getPasswordPolicyHint`, `createPasswordRules`, `createConfirmPasswordRules`, `mapPasswordServerError`. i18n 번역기를 선택적으로 주입받고, 미주입/키 누락 시 한국어 기본 문구로 폴백.
- `docs/security-gotrue-password-policy.md`

**수정**
- `src/components/auth/RegisterForm.vue` — 회원가입. 기존 8자 규칙 3곳(rules / `isRegisterFormValid` / `validate`)을 유틸로 교체, 비밀번호 필드에 정책 hint 추가.
- `src/components/auth/ResetForm.vue` — 비밀번호 재설정. rules 교체, 제출 가드 추가, 버튼 활성 조건을 `isNewPasswordValid`(일치 + 정책 충족)로 변경, hint 추가.
- `src/components/tenant/TenantRegisterForm.vue` — 테넌트 가입. `Password is required`만 있던 규칙을 정책 규칙으로 교체 + 제출 전 가드 + hint.
- `src/components/auth/InitialSettingForm.vue` — 초기 비밀번호 설정(8자 규칙). 유틸 적용 + 서버 에러 매핑.
- `src/stores/auth.ts` — `signUp`/`updatePassword`에만 손댔습니다(`signIn` 미변경). GoTrue 원문 오류를 `mapPasswordServerError`로 사용자 문구 변환. `updatePassword`는 기존에 실패를 `console.log`만 하고 침묵하던 것을 스낵바로 노출하도록 보완(결과가 없을 때는 기존대로 조용히 종료).
- `src/utils/locales/ko.json`, `en.json` — `passwordPolicy` 섹션 13키 추가(`hint`, `unmet`, `rule*`, `server{Rejected,Leaked,SameAsOld}` 등), 더 이상 쓰이지 않는 `createAccount.passwordRequirement` 문구도 새 정책에 맞게 갱신.
- `docs/security.md` — 2-2 항목에 반영 결과 기록.

## 서버 에러 매핑
`Password should be at least…` / `Password should contain at least one character of each:…` / `weak_password` → `passwordPolicy.serverRejected`, HIBP 거부(`known to be weak`) → `serverLeaked`, `different from the old password` → `serverSameAsOld`. 정책과 무관한 오류는 `null`을 반환해 기존 분기(`User already registered` 등)를 그대로 유지합니다.

## 검증
`vue-tsc --noEmit` 통과(exit 0), 변경 파일 eslint 통과(남은 4건은 기존부터 있던 `no-setup-props-destructure` / 미사용 `errors` 슬롯 변수 / `this-alias`). 유틸 로직은 번들 후 노드에서 경계값·에러 매핑 케이스로 확인했습니다. 레이아웃은 비밀번호 입력창의 `persistent-hint` 안내 문구 외에 변경 없고, git commit은 하지 않았습니다.</result>
<usage><subagent_tokens>109586</subagent_tokens><tool_uses>78</tool_uses><duration_ms>760274</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:20:20.711Z (backfill)

```text
<task-notification>
<task-id>a2fc5c78faf4576c6</task-id>
<tool-use-id>toolu_01KEZCzQhaMnUHVs98GBJjQH</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a2fc5c78faf4576c6.output</output-file>
<status>completed</status>
<summary>Agent "2-1 세션 타임아웃 구현" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. `vue-tsc --noEmit` passes clean (baseline was also clean, so no new type errors).

## GoTrue 설정

**`JWT_EXPIRY`는 공유 변수였다** — auth(`GOTRUE_JWT_EXP`), rest(`PGRST_APP_SETTINGS_JWT_EXP`), db(`JWT_EXP`, `volumes/db/jwt.sql`가 심는 `app.settings.jwt_exp`) 셋이 같이 쓴다. 그래서 `JWT_EXPIRY=36000`은 건드리지 않고 **auth 서비스만 별도 변수로 분리**했다.

- `/home/kimsanghoon/process-gpt-vue3/docker-compose/docker-compose.yaml` (`services.auth.environment`, 비밀번호 정책 블록 아래 유지):
  `GOTRUE_JWT_EXP: ${GOTRUE_JWT_EXPIRY:-3600}`, `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT: ${...:-4h}`, `GOTRUE_SESSIONS_TIMEBOX: ${...:-12h}`
- `/home/kimsanghoon/process-gpt-vue3/docker-compose/.env.example`: `GOTRUE_JWT_EXPIRY=3600` 등 추가 + `JWT_EXPIRY` 공유 경고 주석
- `/home/kimsanghoon/process-gpt-vue3/kubernetes/supabase-deployment.yaml`: `supabase-auth` env에 `GOTRUE_JWT_EXP: "3600"`, `_INACTIVITY_TIMEOUT: "4h"`, `_TIMEBOX: "12h"` (라인 84 직전에 추가 — 라인 215 부근의 기존 YAML 들여쓰기 오류는 손대지 않았다)
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/security-gotrue-session-policy.md` 신규 (Supabase Cloud/CLI 반영법, 버전 요구사항, 영향 범위 표 포함)

## 컴포저블

`/home/kimsanghoon/process-gpt-vue3/src/composables/useIdleTimeout.ts` + 모달 `/home/kimsanghoon/process-gpt-vue3/src/components/auth/IdleTimeoutDialog.vue`(기존 Style A 다이얼로그 관례: `max-width="420" persistent` + `v-card rounded="lg"` + `v-card-actions`/`v-spacer`), `src/App.vue`에 전역 마운트(템플릿 1줄 + import/components 등록만).

- 기본값 **유휴 30분 / 유예 60초**, 이벤트 `mousemove·mousedown·click·keydown·scroll·touchstart·wheel` (passive, 1초 스로틀)
- 경고가 뜬 뒤에는 조작으로 자동 해제되지 않는다 — "로그인 유지"를 눌러야 리셋 (마우스가 스쳐 경고가 조용히 사라지는 걸 막음)
- 멀티탭: `localStorage` `sessionIdle:lastActivity` (5초 주기 브로드캐스트)로 다른 탭 활동 공유
- `/`와 `/auth/*`에서는 카운트하지 않고, 로그인 상태(`localStorage.email` 또는 유효 SSO 토큰)에서만 동작
- 로그아웃은 `useAuthStore().logout()` 호출만 (`stores/auth.ts`·`StorageBaseSupabase.js` 내부 무수정). **정적 import 대신 동적 `await import('@/stores/auth')`** — `stores/auth`는 모듈 로드 시 `BackendFactory.createBackend()`를 호출하는데, App.vue 경유로 정적 연결하면 `main.ts`가 `window.$mode`를 세우기 전에 평가돼 부팅이 깨진다

## SSO 경로

App.vue 전역 마운트라 타이머 자체는 자연히 커버된다(`exchangeSsoToken`이 `localStorage.email`을 심는다). 로그아웃만 분기했다 — `isSsoAuthenticated()`면 `redirectToSsoLogin('idle-timeout')`.

두 가지 한계를 문서에 남겼다: (1) SSO exchange는 프록시가 주입하는 `x-playground-*` 헤더로 인증하므로 재이동 즉시 다시 로그인될 수 있어 **실제 유휴 강제는 게이트웨이/IdP 세션 정책이 필요**하다. (2) 현재 이 레포에서 `exchangeSsoToken`/`hydrateSsoFromLocalStorage`는 호출부가 없고 `window.$ssoMode`도 어디서도 대입되지 않아 SSO 경로는 사실상 휴면 상태다.

## 테넌트 설정 스키마

`tenants` 테이블에 컬럼을 추가하지 **않았다**. 이 레포의 테넌트 설정 관례는 `public.configuration`(`tenant_id`+`key` 유일, SELECT는 인증 사용자, 쓰기는 `has_role_at_least('admin')`)이고 `palette_settings`·`maintenance_mode`·`pi_flag_types`가 모두 여기 있다. 같은 자리에 넣었다.

```
key   = 'session_timeout'
value = { "idle_timeout_minutes": 30, "warning_seconds": 60 }
```

행 없음 → 코드 기본값 30분/60초. `idle_timeout_minutes` ≤ 0 → 비활성. 조회 실패 → 기본값으로 진행(fail-safe, 보안 기능이 조회 장애로 사라지지 않게).

마이그레이션 `/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260911_tenant_session_timeout.sql` — idempotent. 값은 심지 않고 (a) 업서트용 `configuration_tenant_id_key_unique` 제약 존재 확인 (b) `COMMENT ON TABLE`로 키 문서화 + 설정/비활성 SQL 예시. 미설정과 명시적 설정을 구분해야 나중에 기본값을 바꿔도 조정해 둔 테넌트를 덮어쓰지 않는다.

## i18n

`ko.json`/`en.json`에 `sessionTimeout` 네임스페이스(title/message/countdown/extend/logoutNow) 추가. 수정 직전 재파싱했고 diff는 파일 끝 블록 하나뿐 — 다른 에이전트가 같은 파일에 넣은 키들(`auditLog.loginAudit`, `passwordPolicy` 등)은 그대로 보존됐다(사후 재검증 완료).

## 남긴 후속 작업

1. **관리자 콘솔 UI 노출** — 값 편집 화면은 `AuditTrail.vue`/`PalModeBackend.ts`/`adminConsole.ts` 수정이 필요해 지시대로 손대지 않았다. 지금은 SQL로 설정한다. `PalModeBackend`의 기존 `getConfigurationValue`/`setConfigurationValue` 헬퍼를 그대로 쓰면 된다.
2. **SSO 유휴 만료 실효성** — 게이트웨이 쪽 세션 정책 필요(위 참조).
3. `kubernetes/supabase-deployment.yaml` 라인 215~217의 기존 YAML 들여쓰기 오류(`supabase-analytics-deployment`의 `selector`/`matchLabels`)는 지시대로 그대로 뒀다 — 이 파일은 현재 `kubectl apply`가 안 되는 상태다.

커밋하지 않았다.</result>
<usage><subagent_tokens>139678</subagent_tokens><tool_uses>83</tool_uses><duration_ms>808281</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:25:19.416Z (backfill)

```text
<task-notification>
<task-id>a414ccb94e41e89a2</task-id>
<tool-use-id>toolu_01GmRZx4kE1stRiL5LJxhVHF</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a414ccb94e41e89a2.output</output-file>
<status>completed</status>
<summary>Agent "4-2 프로세스 공개 범위" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. Summary below.

## 1. Migration: `supabase/migrations/20260911_proc_def_visibility.sql`

**Columns** (nullable + `DEFAULT`, so existing rows keep today's behavior):
- `proc_def.visibility text DEFAULT 'all'` + `CHECK (visibility IS NULL OR visibility IN ('all','org','private'))` (added via `pg_constraint` existence guard → idempotent)
- `proc_def.allowed_org_codes text[] DEFAULT '{}'` — chose `text[]` (not jsonb) because the org "code" is a flat string (org-chart node id); GIN index added
- Backfill `UPDATE … WHERE … IS NULL`, partial btree index on restricted rows

**New helper functions** (all `STABLE`, granted to `authenticated, anon`):
- `public.current_request_uid()` — JWT `sub`, same pattern as `current_user_role()`
- `public.current_user_identity_keys()` — `SECURITY DEFINER`; user's `id/email/username`, lowercased+trimmed
- `public.current_user_org_codes()` — `SECURITY DEFINER`; unions ① `users.department_id / department_name / org_code / org_name` and ② a recursive walk of the org chart (`configuration` key=`organization`, `value-&gt;'chart'`) collecting **all ancestor department** ids/names/org_codes of the user's node. So selecting a parent 본부 also grants access to its sub-teams. Wrapped in an `EXCEPTION` block so a malformed chart can never break `SELECT`.
- `public.proc_def_is_author(text)`, `public.proc_def_visibility_allows(text, text[], text)` — reusable single-row helpers

**SELECT policy** — `proc_def_select_all` (`USING (true)`) replaced by `proc_def_select_visibility`:
```
has_role_at_least('admin')                              -- 관리자는 항상
OR ( (tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = tenant_id())
     AND ( visibility(coalesce→'all') = 'all'
        OR ('org'     AND normalized(allowed_org_codes) &amp;&amp; (SELECT current_user_org_codes()))
        OR ('private' AND lower(owner) = ANY (SELECT unnest(current_user_identity_keys()))) ) )
```
INSERT/UPDATE/DELETE policies untouched. The tenant predicate is deliberately **skipped when `tenant_id()` is NULL** (anon / external-form paths) so nothing regresses — the old policy had no tenant check at all. `current_user_org_codes()` is wrapped in `(SELECT …)` so it lands in an InitPlan (verified via `EXPLAIN`: evaluated once per query, not per row).

**Verified** in throwaway Postgres containers: applies cleanly, is re-runnable, and the full-repo `scripts/validate-migrations-empty-db.sh` run reports `OK 20260911_proc_def_visibility.sql` (the 4 failures in that run — `202609020001_notifications_updated_at`, `20260911_storage_private_buckets`, `consolidated_schema`, `schema_merge` — are pre-existing/other agents' and unrelated). Behavior test with a seeded org chart confirmed: member in `개발팀` sees `org`-scoped processes for both `개발팀` and the parent `개발본부` but not `운영팀`; owner-only sees their own `private`; admin sees everything; anon (no JWT) sees only `all`/NULL rows.

## 2. SECURITY DEFINER / RLS-bypass points (reported only, not modified)

No migration anywhere sets `security_invoker = true`, so **every view runs with owner rights and bypasses the new policy**:
- `public.v_review_board` (`20260902000002_review_owner_role_mapping.sql`) — exposes `pd.name`, `pd.owner`, `definition-&gt;meta-&gt;owners`, granted to `authenticated`. Highest-impact leak.
- `public.v_process_performance` (`20260126_departments_analytics.sql`), `public.v_sla_compliance` (`20260202_task_execution_nullable_and_view_filters.sql`)
- `SECURITY DEFINER` functions reading proc_def: `public.sync_departments_from_org_chart(text)`, `public.insert_feedback_resource_notification(...)` (tenant comes from a caller-supplied argument)
- `fetch_pending_task`, `sync_proc_map_name`, `ontology_*` do **not** read `proc_def` — unaffected
- Python backends use the service-role key and bypass RLS as before

All of this is also documented in the migration header comment.

## 3. UI

- **`src/utils/procDefVisibility.ts`** (new) — constants, `normalizeVisibility`/`normalizeOrgCodes` (lowercase+trim, matching the RLS comparison), `readVisibilityState`, `fetchProcDefVisibility` (reads just the two columns; falls back to default on `42703`), `buildVisibilityUpdatePayload`. Put here rather than in `PalModeBackend.ts` per the constraint.
- **`src/views/process-hierarchy/ProcessHierarchyProperties.vue`** — new collapsible "공개 범위" section right after the 일반 section in the process properties tab: a `v-select` (전체 공개 / 조직 한정 / 비공개) + contextual hint, and for `org` a multi-select `v-autocomplete` with chips. The org list **reuses the existing `loadLaneOrgTeams()`** memoized loader (same `normalizeTree`/`collectTeams` org-chart source as lane 담당 조직), with the same `searchGroupsByName` fallback. Warnings shown when `org` has no selection or `private` has no owner (both cases are admin-only under the RLS).
- Load: `processDefinition` watcher calls `applyVisibilityState(readVisibilityState(val))` then `loadProcessVisibility()` — needed because `PalModeBackend.getDefinitionDetailLite` / `getProcessDefinitionHierarchy` enumerate columns explicitly and I could not touch that file.
- Save path: `saveProcess()` attaches `data._visibility = { next, previous }` → `ProcessHierarchy.handlePropertiesSave` strips it and `Object.assign`s `buildVisibilityUpdatePayload(...)` into the existing `updatePayload`, which goes through the unmodified `backend.updateProcessDefinitionMetadata()`. The payload builder returns `{}` when the value is and was the default `'all'`, so saves on untouched processes are byte-identical to today (also protects environments where the migration hasn't been applied yet).

## 4. PAL gating

`/process-hierarchy` is registered unconditionally in `src/router/MainRoutes.ts:456` (only `/process-hierarchy/process_management` is inside the `window.$pal` block), so the panel is a **shared** screen. Added a `isPalMode()` computed (`!!window.$pal`) and gated both the template section (`v-if="isPalMode"`) and the save payload (`if (this.isPalMode)`) with it. DB columns + RLS apply to all modes, which is safe because the default `'all'` reproduces the old `USING (true)` behavior within a tenant.

## 5. i18n

New top-level `processVisibility` key (12 strings) appended at the end of `src/utils/locales/ko.json` and `en.json` — re-read immediately before editing, appended as a new top-level block to minimize conflict with the other agents editing those files; both files re-validated as parseable JSON (255 / 264 top-level keys, no existing keys removed).

`npx vue-tsc --noEmit` passes clean. ESLint on the touched files reports only pre-existing prettier/`vue/no-reserved-keys` noise. Nothing committed. Files I was told not to touch (`AuditTrail.vue`, `PalModeBackend.ts`, `adminConsole.ts`, signup screens, GoTrue config, `StorageBaseSupabase.js`) were read only.</result>
<usage><subagent_tokens>174572</subagent_tokens><tool_uses>127</tool_uses><duration_ms>1212984</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:30:50.453Z (backfill)

```text
<task-notification>
<task-id>aa4a59aa8bf5cde79</task-id>
<tool-use-id>toolu_013t4gJw7ksD1x1wvW2QmZ6X</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/aa4a59aa8bf5cde79.output</output-file>
<status>completed</status>
<summary>Agent "3-2 서명 URL 전환" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>All intact and verified. Here is the report.

## 구현 완료 — 3-2 서명 URL 전환

### 핵심 발견: 시그니처 변경 불필요
`getImageUrl` / `getFileUrl`은 **이미 `async`였고 호출부 4곳 전부 `await` 중**이었다. 따라서 sync→async 시그니처 변경은 발생하지 않았고, `ProcessHierarchyProperties.vue`를 포함해 원천 함수 때문에 깨지는 파일은 **없다**.

### 전환된 함수 (시그니처 무변경)
`src/utils/StorageBaseSupabase.js`
| 함수 | 변경 |
|---|---|
| `getImageUrl(path)` | `getPublicUrl` → `createSignedUrl` (chat-images, 1h). 절대 URL 입력도 파싱해 재서명 |
| `getFileUrl(path)` | `getPublicUrl` → `createSignedUrl` (files, 1h). 절대 URL 입력도 재서명 |
| `downloadFile(path)` | 공개 URL `fetch` → `storage.from(bucket).download(path)` (인증 세션, blob→File 흐름 유지) |
| `uploadFile()` | 반환값에서 절대 URL 제거: `publicUrl: ''`, `fullPath: data.path`, 신규 `bucket`·`signedUrl`(즉시 열기용) 추가 |

### 신규 파일
- **`src/shared/storageUrl/index.js`** — Vue 비의존 순수 모듈 (레포의 `src/shared/*` 규약). `parseStorageRef`(하위 호환 파싱 유틸, export), `isStorageObjectUrl`, `createSignedStorageUrl`(만료 전 캐시 + 동시요청 합치기), `resolveStorageUrl`, `resolveStorageUrls`, `clearSignedUrlCache`, `SIGNED_URL_TTL_SECONDS`
- **`src/shared/storageUrl/storageUrl.test.js`** — 12 테스트 (node --test, 전체 622개 통과)
- **`src/utils/storageUrl.js`** — Vue 계층. `storageUrlMixin`(Options API: `signedSrc`/`signedUrl`), `createSignedUrlView`(Composition API)

### 하위 호환 (저장된 public URL)
`/storage/v1/object/{public|sign|authenticated}/&lt;bucket&gt;/&lt;path&gt;` 패턴을 되돌려 읽어 버킷·경로를 복원 → 재서명. **만료된 서명 URL도 같은 형식이라 재서명 가능**하므로, 옛 채팅 메시지처럼 경로가 없는 데이터도 되살아난다. `data:`/`blob:`/`/images/...`/외부 주소는 판별해 그대로 통과.

### 수정 파일 전체
| 파일 | 내용 |
|---|---|
| `src/utils/StorageBaseSupabase.js` | 위 4함수 |
| `src/components/ui/SchemaFieldInput.vue` | 업로드 시 `{fileName, path, bucket, size}`만 저장(publicUrl 제거), 다운로드는 `storageRefOf()`로 레거시 URL 파싱 후 `.download()` |
| `src/components/ui/Chat.vue` | `storageUrlMixin`, 이미지 `:src="signedSrc(image,'chat-images')"`(3곳), `emitPreviewImage`/`emitOpenExternalUrl`/`downloadAttachment` 서명 처리, 업로드 시 `path`·`bucket` 동반 저장 |
| `src/components/chat/ChatThread.vue` | 동일 (이미지 1곳 + 3개 메서드) |
| `src/views/chat/ChatRoomPage.vue` | `openExternalUrl` 서명, `buildMessageForAgent` async 전환 + `signAttachmentUrls()` 신규 — **전송 직전 재서명** |
| `src/components/ui/EventTimeline.vue` | `downloadFile`/`openFileLink` 서명 처리 |
| `src/components/ui/field/FileField.vue` | `isRemoteUrl`이 우리 Storage URL을 익명 fetch하지 않도록 제외 → `backend.downloadFile`로 흐름 |
| `src/views/markdown/AgentMonitor.vue` | `handleUploadedFile`이 `signedUrl` 사용 (`publicUrl` 빈 값 대응) |
| `src/components/apps/todolist/InstanceSource.vue` | `downloadFile` 서명 처리 |
| `src/stores/adminConsole.ts` | 정책문서 삭제 시 `file_bucket` 존중 (`'files'` 하드코딩 제거), 타입/매핑 추가 |
| `src/views/policy-document/PolicyDocumentManager.vue` | insert 시 `file_bucket` 기록 |
| `mobile/src/lib/attachments.js` | 업로드·복원 이미지에 `path`/`bucket` 동반 |
| `mobile/src/views/ChatRoomView.vue` | `createSignedUrlView('chat-images')`로 표시 시점 서명, `openInBrowser()`로 다운로드 전 서명 |

### 변경 불필요 확인
- `GPTUserTaskPanel.vue:839`, `PALUserTaskPanel.vue:326` — `path`만 저장 + `await getFileUrl` → 그대로 동작
- `FormWorkItem.vue` — `normalizeFileFieldValue`가 `path` 우선, FileField 경유로 해결
- `PolicyDocumentManager.vue` 다운로드/미리보기, `adminConsole` 삭제 — 이미 `.download()`/`.remove()` (인증 세션)
- `KnowledgeFilesTab.vue`, memento(`uploadFileToStorage`) 경유 URL — 서버가 발급하는 주소라 프론트 범위 밖

### 만료 정책 (1시간)
- 표시 시점 생성 + 모듈 캐시(만료 5분 전까지 재사용) + 동시요청 합치기
- **채팅처럼 오래 열리는 화면**: `createSignedUrlView`가 5분마다 55분 지난 항목을 정리 → 반응형 재렌더 시 자동 재서명. 하루 종일 열어 둬도 이미지가 죽지 않는다
- **에이전트 전송**: `ChatRoomPage.signAttachmentUrls()`가 `[InputData]`의 `images`/`files`/`session_files` 주소를 전송 직전 재서명 (며칠 전 메시지에서 꺼낸 `session_files`가 만료 주소로 나가 "첨부된 문서가 없습니다"가 되는 것 방지). memento 발급 주소·경로는 규칙이 달라 건드리지 않음

### 후속 수정 필요 (다른 에이전트 작업 중이라 미수정)
**`src/views/process-hierarchy/ProcessHierarchyProperties.vue`** — 신규 업로드는 `result.publicUrl`이 `''`가 되어 자동으로 정상 동작하지만, **기존 저장된 데이터는 절대 public URL이 남아 있어 깨진다.** 필요한 수정:
- **10939행**: `const url = file.publicUrl || await backend.getFileUrl(file.path);` → `const url = await backend.getFileUrl(file.path || file.publicUrl);` (`getFileUrl`이 절대 URL도 재서명하므로 이 한 줄로 레거시까지 해결)
- **10916행** (선택): `publicUrl: result.publicUrl || ''` → `bucket: result.bucket || 'files'` 로 교체하면 저장 포맷이 SchemaFieldInput과 일치

### 검증
- `vue-tsc --noEmit` exit 0
- `npm run test:unit` 622/622 통과 (신규 12개 포함)
- 수정한 9개 SFC 전부 `@vue/compiler-sfc` 파싱·템플릿 컴파일 통과
- 레포 전체 `getPublicUrl` 사용처 **0건**
- 신규 3개 파일 eslint 클린
- 로케일 파일 미수정, git commit 없음

&gt; 주의: 작업 중 `git stash push`를 실수로 실행했으나 즉시 `git stash pop`으로 충돌 없이 복구했고, 내 변경과 다른 에이전트 변경이 모두 온전한지 grep·테스트·타입체크로 재확인했습니다.</result>
<usage><subagent_tokens>216349</subagent_tokens><tool_uses>140</tool_uses><duration_ms>1396037</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:42:55.486Z (backfill)

```text
<task-notification>
<task-id>a0bcc9e3790601f9b</task-id>
<tool-use-id>toolu_0121U255Xi4vHfaab3YNE2CE</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a0bcc9e3790601f9b.output</output-file>
<status>completed</status>
<summary>Agent "2-4 반복 실패 잠금" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. "2-4. 반복 실패 잠금 (항목 18)" 구현 완료.

## 1. 마이그레이션 — `supabase/migrations/20260911_password_lockout_hook.sql`

**훅 함수**: `public.hook_password_verification_attempt(jsonb)` (GoTrue 규격: 입력 `{user_id, valid}` → 출력 `{decision, message, should_logout_user}`)

**카운트 신뢰 원천**: 훅이 직접 쓰는 `public.auth_failed_attempts` (user_id PK, failed_count/first_failed_at/last_failed_at/locked_at/locked_until). RLS ENABLE + 정책 0개 + GRANT 0개로 클라이언트 접근 전면 차단. `auth_login_audit`는 클라이언트 RPC 기록이라 위조·누락 가능해 **판정에 쓰지 않고**, "잠금이 걸린 순간"만 `action='login_failed'`, `metadata.reason='account_locked'`로 한 줄 남겨 로그인 이력 탭에서 보이게 했다(예외 삼킴).

**정책**: 기본 5회/15분 윈도우/15분 잠금. `public.configuration` key=`login_lockout` (`{max_attempts, window_minutes, lockout_minutes}`)로 테넌트별 오버라이드 — 테넌트 행 → `tenant_id IS NULL` 전역 행 → 코드 기본값. `max_attempts&lt;=0`이면 비활성(카운터 미기록). 훅은 JWT 없이 돌아 `tenant_id()`가 NULL이므로 `public.users`에서 테넌트 역조회. 조회 함수 `public.login_lockout_policy(text)`.

**동작**: 성공 시 카운터 리셋 / 윈도우 만료 시 1부터 재시작 / 잠긴 동안은 비밀번호가 맞아도 reject / 잠긴 상태의 추가 시도로 **잠금 연장 안 함**(영구 잠금 방지) / 어떤 예외든 **fail-open**(`continue`).

**부속 객체**: `public.locked_accounts` 뷰(psql 점검용, GRANT 없음), `public.admin_list_locked_accounts()` RPC(관리자·동일 테넌트, users JOIN으로 고아 기록 제외), `public.admin_unlock_account(p_email, p_user_id)` RPC(카운터 삭제 + `admin_audit_log`에 `account_unlock` 기록), 관리자 판정 헬퍼 `public.is_lockout_admin()` (`current_user_role()` / `has_role_at_least('admin')` + `users.is_admin` 폴백). `supabase_auth_admin` GRANT는 `pg_roles` 존재 가드로 감쌌다. 전부 idempotent.

**검증**: 일회용 Postgres 컨테이너에서 17개 시나리오 통과(1~4회 continue → 5회째 reject, 잠금 중 정답 비번도 reject, 비관리자 차단, 타 테넌트 해제 차단, 해제 후 재로그인, 윈도우 만료 리셋, 오버라이드, `max_attempts=0`, user_id 없음, 고아 기록 미노출). 추가로 `scripts/validate-migrations-empty-db.sh`의 shim을 써서 **전체 마이그레이션 시퀀스(96개)에 얹어 재검증** — 내 파일은 PASS이고 실제 스키마 위에서 잠금→목록→해제→재로그인 e2e도 통과(`admin_audit_log.actor_username`까지 트리거가 채움). 실패한 2건(`202609020001_notifications_updated_at.sql`, `20260911_storage_private_buckets.sql`)은 내 작업과 무관한 기존/타 에이전트 파일이다.

## 2. GoTrue 설정

세 곳 모두 기존 블록 아래에 추가:
```
GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED: "true"
GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_URI: "pg-functions://postgres/public/hook_password_verification_attempt"
```
- `docker-compose/docker-compose.yaml` (`services.auth.environment`, 비밀번호 정책 블록 아래)
- `kubernetes/supabase-deployment.yaml` (`supabase-auth` env, 세션 블록 아래) — 라인 215 부근 기존 오류는 손대지 않음
- `docker-compose/.env.example` — 값은 compose에 직접 기재돼 있고 정책은 DB 관리라는 안내만 추가

**주의 (보고 필요)**: Auth Hooks(`pg-functions://`)는 **GoTrue v2.151.0 이상** 필요. compose는 v2.177.0로 충족하지만 **k8s 매니페스트는 v2.143.0이라 image 승격 전에는 설정이 무시된다**(로그인은 정상, 잠금만 안 걸림). 매니페스트 주석과 문서에 명시했다.

문서: **`docs/security-gotrue-lockout-policy.md` 신규 작성** (정책, 카운트 원천 근거, 훅 규격, fail-open, 버전 요구사항, **적용 순서 — 마이그레이션 먼저/롤백은 역순**, Supabase Cloud·CLI 반영법, 테넌트 설정 SQL, 운영, 한계). `docs/security.md` 2-4 절을 "반영 완료"로 갱신.

## 3. 관리자 화면

`src/views/admin/tabs/AuditTrail.vue` 로그인 이력 탭의 주석 마커 자리에 **잠금 계정 패널** 추가: 계정(이메일+이름)·실패 횟수·잠금 시각·해제 예정(+"약 N분 남음")·잠금 해제 버튼, 새로고침 버튼, 잠긴 계정이 없으면 회색 한 줄로 축소. 해제는 v-dialog 확인 후 실행. 탭 진입/전환 시 자동 로드, 해제 후 목록+로그인 이력 재조회. RPC 미배포 환경(PGRST202/42883)은 오류를 띄우지 않고 패널만 비운다. `ADMIN_ACTION_LABELS`에 `account_unlock: '계정 잠금 해제'` 추가.

`src/components/api/PalModeBackend.ts`에 `getLockedAccounts()` / `unlockAccount({email, userId})` 추가 (각각 `admin_list_locked_accounts` / `admin_unlock_account` RPC).

**제약 준수**: `src/stores/adminConsole.ts`는 건드리지 않고, 컴포넌트에서 `BackendFactory.createBackend()`를 직접 호출 + 로컬 ref로 처리했다.

i18n: `auditLog.loginAudit.lockout.*` 15개 키를 ko/en에 추가(기존 키 보존, JSON 파싱 확인). 로컬 `t()` 헬퍼가 보간 파라미터를 받도록 확장(하위 호환).

`vue-tsc --noEmit`: 내 파일 오류 0. 남은 오류 2건은 `src/stores/adminConsole.ts`(`normalizeRetentionDays` 미정의)로 **다른 에이전트가 작업 중인 수정 금지 파일**이다. git commit 하지 않았다.

## 남긴 후속 작업

1. **k8s GoTrue image를 v2.151.0+ (v2.177.0 권장)로 승격** — 안 하면 k8s 배포에서 훅이 동작하지 않는다.
2. 잠금 계정 패널의 adminConsole store 통합 (현재 컴포넌트 로컬 상태·backend 직접 호출).
3. 관리자 콘솔에서 `login_lockout` 정책 값(N회/M분)을 편집하는 UI — 현재는 SQL로만 설정.
4. SSO(`ssoAuth.ts`) 경로는 GoTrue 비밀번호 검증을 거치지 않아 잠금 대상이 아니다 — IdP 측 정책 필요.
5. 패스워드 스프레이(계정당 1회씩 분산 시도)는 계정 단위 카운터로 막히지 않음 — IP rate limit(Kong, 제외 항목 11) 영역.</result>
<usage><subagent_tokens>153424</subagent_tokens><tool_uses>99</tool_uses><duration_ms>1302503</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:47:16.998Z (backfill)

```text
<task-notification>
<task-id>ad6dbd95033e23135</task-id>
<tool-use-id>toolu_018KzSPJE5NXsdwUZzRuhjrV</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/ad6dbd95033e23135.output</output-file>
<status>completed</status>
<summary>Agent "4-3 로그 보관 정책" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Implementation complete and verified.

## 1. Migration: `supabase/migrations/20260911_audit_log_retention.sql`

**Archive tables** — `public.admin_audit_log_archive`, `public.auth_login_audit_archive`, created with `CREATE TABLE ... (LIKE 원본)` (column names/types/NOT NULL only — deliberately *not* `INCLUDING ALL`, so the source's 5–6 indexes aren't cloned onto a rarely-read table), plus `archived_at timestamptz NOT NULL DEFAULT now()` and a PK on `id`. Only two indexes each: `(created_at DESC)` and `(tenant_id, created_at DESC)`. RLS enabled with a SELECT-only admin policy (same admin predicate as `auth_login_audit`: `current_user_role() = 'admin'` OR `users.is_admin`/`role in (admin, superadmin)`); no INSERT/UPDATE/DELETE policies, plus `REVOKE ALL` + `GRANT SELECT` as the second net.

**Retention setting** — `configuration` key `audit_log_retention` = `{"retention_days": 365}`, per the repo's tenant-setting convention. Resolution order: config row matching the log row's `tenant_id` → global row (`tenant_id IS NULL`) → hardcoded 365. Log rows with `tenant_id IS NULL` join nothing and fall to the global default, as specified. Every value is clamped to 30–3650 days in SQL, so a corrupted config row can't cause a mass delete. The migration deliberately seeds no value (same reasoning as `20260911_tenant_session_timeout.sql`).

**`archive_expired_audit_logs(p_batch_size int DEFAULT 1000, p_max_batches int DEFAULT 50)`** returns `jsonb` with per-table move counts. Per table it runs a loop of at most `p_max_batches` statements, each moving ≤ `p_batch_size` rows, exiting early when a batch comes back short. Each batch is one statement — `WITH expired AS (SELECT id … LIMIT n), moved AS (DELETE … RETURNING d.*) INSERT INTO archive SELECT …` — so "deleted but not archived" is impossible, and the whole function is one transaction. The column list is computed at runtime from the intersection of source/archive columns in source order, so a future column added to `admin_audit_log` (as `20260911_admin_audit_log_actor_enforcement.sql` already did once) won't break the function.

**append-only bypass** — `SECURITY DEFINER` with `SET search_path = public, pg_temp`, justified in a comment: both source tables block DELETE via RLS-with-no-policy plus `REVOKE DELETE FROM anon, authenticated, PUBLIC`. The function owner is the table owner, PostgreSQL doesn't apply RLS to table owners (`FORCE ROW LEVEL SECURITY` is never set here), and the REVOKEs targeted app roles only. `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated` so no client key can call the log-deleting function.

**pg_cron** — registered *after* `COMMIT` in a `DO` block: skips with a `RAISE NOTICE` (including the manual command to run) if `pg_extension` has no `pg_cron`; `cron.unschedule('audit-log-retention')` first inside its own exception-swallowing sub-block, then `cron.schedule('audit-log-retention', '0 3 * * *', 'SELECT public.archive_expired_audit_logs();')`; the whole block has an outer `EXCEPTION WHEN OTHERS` so permission failures can't fail the migration. A comment notes the schedule follows `cron.timezone` (GMT default), i.e. use `'0 18 * * *'` for KST 03:00.

**Verified in a throwaway `postgres:15` container** (removed afterwards) against a minimal prereq schema extracted from the real migrations: migration applies clean and is re-runnable; t1 (no config) kept 365 days while t2 (90-day config) kept 90 and NULL-tenant rows used the global default; `retention_days: 1` clamped to 30; `archive_expired_audit_logs(5, 2)` moved exactly 10 rows; a garbage string value fell back to the global default; a `tenant_id IS NULL` config row of 60 applied globally; a newly added source column was silently skipped without error; `authenticated` was denied on the function, on archive INSERT/DELETE, and on source DELETE. The pg_cron branch was exercised separately against a mocked `cron` schema — two consecutive runs leave exactly one job row.

## 2. Settings UI

Added **Section 3 "감사 로그 보관 정책"** to `src/views/admin/tabs/SystemOperations.vue` (the tenant-settings screen that already owns `notice_banner` and `maintenance_mode`), between Maintenance Mode and the Cut-over Jobs section. It has a numeric days field with 30–3650 validation (empty / non-integer / out-of-range each get their own message), a live "이관 기준일" showing the computed cutoff date, an info alert stating the move is done by the 03:00 job rather than immediately, and a save button disabled while invalid.

Save path: `src/stores/adminConsole.ts` gained `auditLogRetention` state, `fetchAuditLogRetention()` and `saveAuditLogRetention(days)`, which call the existing `getConfigurationValue`/`setConfigurationValue` helpers through the already-standard `BackendFactory.createBackend() as any` — `PalModeBackend.ts` and `AuditTrail.vue` were not touched. A shared `normalizeRetentionDays()` plus exported `AUDIT_RETENTION_{DEFAULT,MIN,MAX}_DAYS` constants keep the UI range identical to the DB clamp, and the store re-validates so an out-of-range value can't reach the DB through a non-UI caller. Saving also writes an `audit_retention_update` entry via `writeAdminAuditLog` — changing when records get moved is itself auditable.

i18n keys added under `adminConsole.systemOps` in both `ko.json` and `en.json` (files re-read immediately before editing; existing keys preserved; en's `adminConsole` previously had no `systemOps` object, so one was added with just these keys — per-key fallback handles the rest).

## Notes / follow-ups

- `npx vue-tsc --noEmit` passes; the SFC template also compiles clean.
- `useI18n()` is unusable here — `main.ts` runs vue-i18n in legacy mode — so the component uses the repo's `window.$i18n.global.t` wrapper, same as `AuditTrail.vue`.
- In PAL + uEngine mode (`PalUengineBackend`) the config helpers don't exist; `BackendFactory`'s null-skip Proxy turns those calls into no-ops returning `null`, so the field shows the 365 default and doesn't crash — same behavior as the existing notice-banner/maintenance settings in that mode.
- **Left undone:** no UI reads the `_archive` tables — a "보관된 로그" view would belong in `AuditTrail.vue`, which another agent owns. The pg_cron schedule is GMT-based; pick `'0 18 * * *'` or set `cron.timezone` when deploying if KST 03:00 is wanted. `docs/security.md` was left untouched (other agents are editing it), so section 4-3 is not yet marked complete there. No commit was made.</result>
<usage><subagent_tokens>112222</subagent_tokens><tool_uses>79</tool_uses><duration_ms>895644</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:54:20.002Z (backfill)

```text
<task-notification>
<task-id>ac2677e3bfe62dae3</task-id>
<tool-use-id>toolu_01XdK8qsCRVafk4xNWwXUxa3</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/ac2677e3bfe62dae3.output</output-file>
<status>completed</status>
<summary>Agent "4-1 개인정보 마스킹" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## 완료 보고: 4-1 개인정보 마스킹 (항목 6) — 1단계

### 1. 마이그레이션 `supabase/migrations/20260911_pii_masking.sql`

**함수**
- `public.mask_email(text)` → `ab***@domain.com` (로컬파트 3자↑ 앞 2자, 2자 앞 1자, 1자 전체 가림. 도메인 유지)
- `public.mask_phone(text)` → `010-****-1234` (하이픈 유무·공백·괄호·`+82` 국가번호·`02` 지역번호 대응, 7자리 미만 `****`)
- `public.pii_admin()` / `public.pii_visible(uuid)` — 기존 `has_role_at_least('admin')` 패턴 사용
- `public.rebuild_pii_masked_view(table, view, owner_col, keep_when)` / `rebuild_pii_masked_views()` — 뷰 생성기
- `public.tenant_user_email_exists(text)` — SECURITY DEFINER, editor 이상, 존재 여부 boolean만 반환 (아래 3-c 참조)

**뷰** (전부 `security_invoker = true`)

| 뷰 | 원본 노출 조건 |
|---|---|
| `users_masked` | admin 이상 · 본인 행 · **에이전트 행(`is_agent`)** |
| `pending_org_members_masked` | admin 이상 |
| `signup_requests_masked` | admin 이상 · 본인 신청 |
| `admin_requests_masked` | admin 이상 · 본인 신청 |

**컬럼을 손으로 나열하지 않고 `information_schema` 로 생성**한다. `users` 는 실 스키마 기준 29컬럼이고 15개 마이그레이션이 덧붙여 왔다 — 손으로 적었으면 몇 개는 빠졌고, `select('*')` 를 쓰는 화면에서 값이 조용히 비었을 것이다. 대신 **기반 테이블에 컬럼을 추가하는 마이그레이션은 `rebuild_pii_masked_views()` 를 다시 불러야 한다** (파일 주석·`docs/security.md` 에 명시).

**전화번호 컬럼은 이 스키마에 하나도 없다.** `users`·조직 테이블·전체 마이그레이션 전수 확인 결과 0건(`src` 의 `phone` 2건은 템플릿 목업 타입). 함수만 준비하고, 생성기가 `phone`/`phone_number`/`mobile`/`tel` 계열 컬럼이 생기면 자동 편입하도록 해 뒀다(컨테이너에서 실제로 확인).

**검증** (일회용 컨테이너):
- PG15 픽스처: 마스킹 규칙 12케이스, 역할별(viewer/admin/anon) 동작, **security_invoker 로 기반 테이블 RLS 가 적용됨**(5행 중 타테넌트 1행 차단), 컬럼 순서·개수 원본 동일, 재실행 idempotent
- `scripts/validate-migrations-empty-db.sh` 방식으로 전체 98개 마이그레이션 순서 적용 → 내 파일 통과, `users_masked` 29/29 컬럼 일치. 실패 2건(`202609020001_notifications_updated_at.sql`, `20260911_storage_private_buckets.sql`)은 shim 한계로 인한 **기존 문제**, 내 변경과 무관

### 2. 전환한 화면

| 화면 | 데이터 소스 변경 |
|---|---|
| `src/views/organization/OrganizationChartView.vue` | `loadUsers()` → **편집 권한 없으면** `getMaskedUserList()`, 있으면 기존 `getUserList()` (사유는 4항). `loadPendingMembers()` → `pending_org_members_masked`. 검색 haystack 에서 조직도 JSON email 제외(읽기 전용일 때) |
| `src/views/organization/OrgDetailPanel.vue` | `memberEmail()` — 조직도 JSON 의 email 폴백을 `maskEmail()` 로 가림(JSON 은 DB 뷰를 안 거친다) |
| `src/views/organization/MembershipApprovalPanel.vue` (경유: `src/services/membershipService.ts`) | `signup_requests`/`admin_requests` → `*_masked` |
| `src/components/pages/account-settings/ManageAccessTab.vue` | `getUserList()` → `getMaskedUserList()` |
| `src/components/ui/SidebarUserList.vue` | `getUserList({})` → `getMaskedUserList({})` |

**신규**: `src/components/api/ProcessGPTBackend.ts::getMaskedUserList()` (인터페이스 `Backend.ts`, `UEngineBackend` 는 기존 `getUserList` 로 위임). **비 PAL 모드에서는 `getUserList()` 로 그대로 위임**하므로 비 PAL 동작은 바이트 단위로 동일하다. `membershipService`/`loadPendingMembers` 도 `window.$pal` 로 분기.

**신규**: `src/utils/piiMasking.ts` — `maskEmail`/`maskPhone`/`isMaskedEmail` (DB 함수와 규칙 일치)

### 3. 깨질 뻔해서 함께 고친 것

- **(a) 조직도 JSON 오염 방지** — `orgChartModel.createMemberNode()` 가 email 을 `configuration` JSON 에 **복사 저장**하고, `src/utils/organizationUtils.ts:55,291,313` 이 그 값으로 권한·공개범위를 매칭한다. 마스킹 값이 저장되면 그 사람이 조용히 팀에서 빠진다. `memberNodeFor()` 래퍼 + `storedEmailById` 맵을 넣어 마스킹 값은 절대 저장되지 않게 했다(원본을 모르면 잘못된 값 대신 비워 둔다).
- **(b) 사전등록 중복 검사** — 클라이언트에서 목록의 email 을 비교하던 것을 `tenant_user_email_exists()` RPC 로 옮겼다. 사전등록 쪽 중복은 기존 유니크 인덱스의 `23505` 를 문구로 매핑. 2단계 REVOKE 이후에도 그대로 동작한다.
- **(c) 에이전트 예외** — 에이전트 행의 email 은 연락처가 아니라 식별자(채팅 참가자 매칭·알림 대상)라 뷰에서 원본 유지.

### 4. 전환하지 않은 곳

**수정 금지 파일 — 필요한 수정 내용**
- `src/views/admin/tabs/AuditTrail.vue` — 로그인 이력 탭 actor 컬럼(L418), 헤더 `key:'email'`(L610), 잠긴 계정(L355,388), **CSV export(L1376,1389)** 가 email 을 그대로 낸다. 다만 이 화면은 관리자 전용이고 `admin_list_locked_accounts()` 도 admin+테넌트 제한이므로 **마스킹 대상이 아니라고 판단** — 감사 목적상 원본이 맞다. 전환 불필요.
- `src/components/api/PalModeBackend.ts` — `resolveUserIdentities()`(L760) 가 `.limit(5000)` 으로 테넌트 전원의 email 을 내려받는다. 이름 해결용이지만 email 을 **매칭 키로도** 쓰므로(L778) 뷰 전환은 불가. 대신 표시 문자열을 만드는 `src/utils/userIdentity.ts:59 pickName()` 의 `username → email` 폴백을 `username → employee_no → maskEmail(email)` 로 바꾸는 것이 단일 지점 개선안이다(리뷰보드·계층도·작업배정·시스템관리 전반 커버). `searchUsersByName()`(L702) 도 `email.ilike` 검색을 허용한다.
- `src/stores/adminConsole.ts` — 이번 조사에서 email 표시 경로 발견 없음. 수정 불필요.

**기능상 원본이 필요 — 전환 금지**
- 이메일을 **값(identifier)** 으로 쓰는 picker: `UserSelectField.vue`, `PermissionDialog.vue:113`, `UserTaskPanel.vue`(`value: email`), `ProcessHierarchyProperties.vue`(`item-value="email"`), `NewProcessDialog.vue`(owner 4개 모두 `item-value="email"`), `WorkAssignment.vue`, `OwnerSelect.vue`, `SchemaFieldInput.vue`, `DelegateTaskForm.vue`(+`UserListPage.vue` — `like: {key:'email'}` 서버 검색)
- 채팅/참가자 계열: `Chat.vue`(멘션 autocomplete 포함), `ChatRoomPage.vue`, `ChatListing.vue`, `ChatList.vue`, `UserChatRooms.vue`, `AgentChatRooms.vue`, `WorkAssistantChatPanel.vue`, `ParticipantPanel/Icons/ModelCanvasParticipants`
- 로그인 경로: `StorageBaseSupabase.js:449 getUserInfo()`, `:1078 writeUserData()` — 요청대로 건드리지 않았다. **인증 전 조회는 아니다**(둘 다 `auth.getUser()` 성공 후 본인 1행 조회). 뷰로 바꿔도 본인 행이라 원본이 나오지만 실익이 없어 그대로 뒀다.
- 본인 1행 조회(뷰에서도 원본): `MyInbox.vue:295`, `ProcessReviewBoard.vue:964`, `ProcessReviewDetail.vue:404`, `ProcessHierarchyProperties.vue:8566`, `PolicyDocumentManager.vue:144`, `usageAnalytics.ts:301`
- `RecycleBin.vue:251` — email→username 역치환용(오히려 마스킹에 유리), `KpiTargetManager.vue:411` / `ProcessArchitecture.vue:644` — 락 소유자 표시(본인 아닌 1행, 전환 여지 있으나 영향 작아 보류)

**애매해서 보류**
- `ReviewBoardSubmissionDebug.vue` — 디버그 화면, 제출 시 email 사용 가능성 있어 미전환
- `StrategyBoard.vue:957` `initiative.owner_email` — 사용자가 직접 입력한 값, `users` 와 무관

**조직도 편집자(owner)는 여전히 원본을 본다.** DB 뷰의 원본 기준은 admin 인데 조직도 편집 권한은 owner 이상(`OrganizationChartView.vue:481`)이다. 편집자가 배치할 때 원본 email 을 JSON 에 써야 하므로 역할이 아니라 **편집 권한**으로 조회 대상을 갈랐다. viewer/editor/reviewer(대다수)는 마스킹된다. owner 까지 가리려면 조직도 노드에서 email 저장을 없애고 `organizationUtils` 를 uuid 매칭으로 옮기는 선행 작업이 필요하다.

### 5. 기존 뷰 점검 결과
레포 전체 뷰 36건(중복 재정의 포함) 중 **`security_invoker` 설정은 0건** — 전부 뷰 소유자 권한으로 돌아 RLS 를 우회한다. 다만 `users.email` 을 직접 SELECT 하는 공개 뷰는 없다:
- `public.locked_accounts` (`20260911_password_lockout_hook.sql:324`) — email 노출하지만 `REVOKE ALL FROM anon, authenticated` 로 PostgREST 미노출. 수정 불필요.
- `v_review_board` (`20260902000002`) — 컬럼명상 email 없음. 그러나 `pd.owner` / `pi_owners` / `hq_owners` / `field_owners` / `master_owner` / `submitted_by` / `*_reviewer_name` **값이 실제로는 email 문자열**이다(`NewProcessDialog.vue` 가 `item-value="email"` 로 저장). 사실상 노출 경로다. 이 값들은 동시에 권한 매칭 키라서 뷰에서 마스킹하면 리뷰 권한 판정이 깨진다 — **수정 영향이 커서 보고만 한다.** 근본 해결은 owner 저장 포맷을 uuid 로 옮기는 것이고, 그것이 2단계 REVOKE 의 선행 조건이기도 하다.

### 6. REVOKE 2단계 적용 계획 (마이그레이션 하단 주석에 전문 수록)

**이번에 REVOKE 하지 않았다.** 근거:
- PostgreSQL 컬럼 단위 REVOKE 는 `SELECT *` **쿼리 전체를 거부**한다(빠진 컬럼만 비는 게 아님)
- `StorageBaseSupabase.js:449 / :1078` 이 로그인 직후 `select('*')` 를 한다 → REVOKE 즉시 로그인이 막힌다
- `storage.list('users')` 도 `.select()`(전 컬럼)라 `getUserList()` 40개 호출처가 전부 죽는다
- email 이 담당자 지정·채팅 매칭·알림 발송·결재선 매칭의 **식별자**로 쓰인다

**2단계 순서** (별도 마이그레이션 `2026xxxx_pii_revoke.sql`):
1. 표시용 조회가 남김없이 뷰로 옮겨졌는지 확인 — `grep -rn "from('users')" src/` 결과가 (i) 로그인/세션, (ii) email 을 식별자로 쓰는 기능 경로만 남을 것
2. 기능 경로를 가능한 한 `user_id(uuid)` 기반으로 전환. 남는 것은 SECURITY DEFINER RPC 로 감싼다(`tenant_user_email_exists` 가 그 예)
3. `SELECT *` 지점을 컬럼 명시로 교체 — **이걸 먼저 안 하면 REVOKE 와 동시에 로그인이 막힌다**
4. 그 다음에야 `REVOKE SELECT (email) ON public.users FROM authenticated, anon;` — 단 `users_masked` 는 security_invoker 라 **뷰도 함께 막힌다**. 그 시점에 (a) `users_masked` 만 `security_invoker = false` 로 바꾸고 뷰 정의에 RLS 와 같은 테넌트 조건을 직접 넣거나, (b) 마스킹 값 전용 컬럼만 GRANT — 둘 중 하나를 골라야 한다. (a) 는 그 시점의 users RLS 정책과 반드시 함께 검토
5. `users_select_all USING (true)`(`20260403000001_role_based_rls.sql:193`) 를 테넌트 한정으로 좁힌다

**마스킹보다 5번이 실효가 크다.** 지금은 인증만 되면 PostgREST 로 `select=email` 을 직접 때려 다른 테넌트 행까지 읽힌다 — 그 상태에서 1단계 마스킹은 화면 노출 축소이지 접근 통제가 아니다. 이 점을 `docs/security.md` 4-1 에도 남겼다.

### 검증
- `npx vue-tsc --noEmit` → **0 errors**
- git commit 하지 않음. 일회용 컨테이너는 모두 정리 완료.</result>
<usage><subagent_tokens>193987</subagent_tokens><tool_uses>112</tool_uses><duration_ms>1339810</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T02:58:54.586Z (backfill)

```text
<task-notification>
<task-id>aaf4c41786cc17103</task-id>
<tool-use-id>toolu_01C8vdomRb3dpPK9gz9dUpSo</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/aaf4c41786cc17103.output</output-file>
<status>completed</status>
<summary>Agent "3-3 다운로드 이력·이상 탐지" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>구현을 마쳤습니다. `vue-tsc --noEmit` 통과(EXIT=0), 유닛 테스트 622개 전부 통과, 커밋하지 않았습니다.

## 1. 마이그레이션 — `supabase/migrations/20260911_file_download_log.sql`

- **`public.file_download_log`**: id, created_at, tenant_id, user_id(uuid), email, bucket, path, file_name, action, ip_address, user_agent, metadata(jsonb). `action` CHECK = `download`/`signed_url`/`view`. 인덱스 4개 — `created_at DESC`, `(tenant_id, created_at DESC)`, `(user_id, created_at DESC)`, `(email, created_at DESC)`(이메일 필터용 추가).
- **기록 RPC `record_file_download(p_bucket, p_path, p_file_name, p_action, p_metadata)`**: SECURITY DEFINER + `SET search_path`. `user_id`는 `auth.uid()`로 강제(파라미터 없음), email/tenant는 `public.tenant_id()` → `users` → `auth.jwt()` 순으로 서버가 채우고, IP/UA는 `request.headers`에서 캡처. 토큰 헤더는 저장하지 않고 origin/referer만 metadata에 병합. 알 수 없는 action·빈 경로는 조용히 버리고, 모든 예외를 삼킨다(`record_auth_audit` 관례 그대로). `GRANT EXECUTE`는 authenticated만(anon 제외 — 버킷이 비공개라 다운로드는 항상 인증 요청).
- **RLS**: SELECT는 관리자(`current_user_role()` OR `users.is_admin/role`) + 같은 테넌트만. **INSERT 정책도 GRANT도 없음** = 직접 INSERT 전면 차단(RPC 전용). UPDATE/DELETE 정책 없음 = append-only.
- **이상 탐지 `detect_download_anomalies(p_threshold default null)`**: 오늘(`created_at &gt;= date_trunc('day', now())`) 사용자별 건수가 임계치 초과 시 같은 테넌트 관리자에게 `notifications`(type `download_anomaly`, url `/admin?tab=audit-trail`) 적재. 임계치는 `configuration.download_anomaly` → `daily_threshold` (테넌트 행 → 전역 행 → 기본 100, 1~1,000,000 clamp). 중복 방지는 **`md5('download_anomaly|user|date|admin_email')::uuid` 결정적 id + `ON CONFLICT (id) DO NOTHING`** — 매시 돌아도 하루 한 번, 별도 카운터 테이블 불필요. 함수는 앱 롤에서 REVOKE(관리자 알림을 클라이언트 키로 만들 수 없게).
- **pg_cron**: COMMIT 뒤 `DO` 블록에서 `download-anomaly-detection` / `0 * * * *` 등록. extension 없으면 NOTICE만 남기고 통과, 실패해도 마이그레이션은 통과(`20260911_audit_log_retention.sql`과 같은 방식).
- **검증**: 일회용 `postgres:15-alpine` 컨테이너 + 최소 shim(auth.uid/auth.jwt/tenant_id/current_user_role/users/notifications/configuration)으로 확인 — ① 최초 적용 OK ② 재실행 OK(idempotent) ③ RPC 기록/잘못된 action·빈 인자 무시 ④ 임계치 1 강제 시 알림 1건, 재실행 시 0건(중복 없음) ⑤ 기본 100에서는 미탐지, 테넌트 configuration 오버라이드 시 탐지 ⑥ RLS — 일반 사용자 0행, 관리자 2행, 직접 INSERT `permission denied`.

## 2. 기록 호출을 심은 지점 (공용 헬퍼 경유)

신규 공용 헬퍼 `src/shared/downloadAudit/index.js` — `recordFileDownload({bucket, path, fileName, action, metadata, client})` + `DOWNLOAD_ACTIONS`. 절대 던지지 않고 boolean만 돌려준다. Vue 비의존, 테스트 `src/shared/downloadAudit/downloadAudit.test.js` 5건(위조 가능한 파라미터를 보내지 않는지 포함).

| 지점 | action |
|---|---|
| `src/utils/StorageBaseSupabase.js` `downloadFile` | `download` |
| `src/utils/StorageBaseSupabase.js` `getFileUrl` (서명 성공 시에만) | `signed_url` |
| `src/views/policy-document/PolicyDocumentManager.vue` `downloadPolicy` | `download` |
| `src/views/policy-document/PolicyDocumentManager.vue` 미리보기(`openPreview`) | `view` |
| `src/components/ui/SchemaFieldInput.vue` `downloadFile` | `download` |
| `src/components/api/ProcessGPTBackend.ts` `installProcessComponent` / `updateInstalledComponent` (마켓플레이스 zip) | `download` |

`getImageUrl`·`createSignedStorageUrl`·`signIn/signUp/recordAuthAudit`은 손대지 않았습니다(요청대로 표시용 경로 제외).

## 3. AuditTrail "다운로드 이력" 탭

`TAB_DEFS`에 `{ key:'download', labelKey:'auditLog.tabDownload', filters:['startDate','endDate','email','bucket'] }` 추가 + `tabLoaders`/`tabExporters`/`tabItems` 각 1개 + `&lt;template v-else-if="activeTab === 'download'"&gt;` 테이블 블록 + 필터 바에 버킷 select. 컬럼: 시각 / 이메일 / 파일명(`path` 툴팁, file_name 없으면 `&lt;ts&gt;_&lt;uuid8&gt;` 앞머리를 떼어 복원) / 버킷 / 액션(chip) / IP. CSV 내보내기는 경로·User-Agent까지 포함. `adminConsole.ts`가 수정 금지라 잠금 계정 패널과 같은 방식으로 **backend를 직접 호출**하고 로컬 ref(`fileDownloadLog`/`fileDownloadTotal`/`downloadLoading`/`downloadError`/`downloadBuckets`)를 씁니다. 표 미배포 환경(`42P01`/`PGRST205`)은 오류 대신 빈 목록.

`PalModeBackend.ts`에 `getFileDownloadLog(filters)`(기간·이메일 ilike·버킷·액션·userId·페이지네이션, `getAuthLoginAudit` 패턴)와 버킷 드롭다운용 `getFileDownloadBuckets()` 추가.

## 4. i18n

`ko.json`/`en.json`의 `auditLog`에 `tabDownload` + `downloadAudit.*`(필터·컬럼·액션 라벨·empty·loadError) 추가. 수정 직전 재읽기했고 기존 키는 그대로, JSON 파싱 검증 완료.

## 5. 문서

`docs/security.md`의 3-3 절을 "반영 완료"로 갱신(테이블/RPC/RLS/탐지 로직/호출 지점/후속 작업).

## 남긴 후속 작업

- 임계치(`download_anomaly`) 편집 UI — 세션 타임아웃·잠금 정책과 같은 상태로 관리자 콘솔에 없음.
- 다운로드 이력 탭의 `adminConsole` store 통합(현재 backend 직접 호출).
- `uploadFile`이 업로드 직후 `getFileUrl`을 부르므로 업로드마다 `signed_url` 한 줄이 남는다. `metadata.source`로 구분은 되지만, 이상 탐지 카운트에 섞이는 것이 신경 쓰이면 `uploadFile`을 `resolveStorageUrl` 직접 호출로 바꾸면 된다(이번엔 "downloadFile/getFileUrl만 수정" 제약 때문에 손대지 않음).
- 운영 DB에 pg_cron이 없으면 `SELECT cron.schedule('download-anomaly-detection','0 * * * *','SELECT public.detect_download_anomalies();')` 수동 등록 필요(마이그레이션이 NOTICE로 안내).
- 전체 마이그레이션 순차 적용 검증(`scripts/validate-migrations-empty-db.sh`)은 호스트에 `psql`이 없어 실행하지 못했고, 대신 동등한 컨테이너 검증을 별도로 수행했습니다.</result>
<usage><subagent_tokens>157315</subagent_tokens><tool_uses>100</tool_uses><duration_ms>891364</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T03:04:24.171Z (backfill)

```text
<task-notification>
<task-id>ad53b3f685e1efd88</task-id>
<tool-use-id>toolu_01UqWLRDRs6hgt4cmpNrTDnh</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/ad53b3f685e1efd88.output</output-file>
<status>completed</status>
<summary>Agent "2-3 MFA TOTP 구현" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>MFA(TOTP) 구현을 완료했습니다. `vue-tsc --noEmit` 통과, 마이그레이션은 임시 Postgres 컨테이너로 실제 적용·멱등성까지 검증했습니다. 커밋은 하지 않았습니다.

## 1. GoTrue 설정
수정 전 현재 상태를 다시 읽어 기존 비밀번호·세션·잠금 훅 블록 뒤에 이어 붙였습니다.
- `docker-compose/docker-compose.yaml` `services.auth.environment` — `GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true"`, `GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true"`
- `kubernetes/supabase-deployment.yaml` `supabase-auth` env — 동일 2개 (기존 라인 246 부근 YAML 오류는 그대로 뒀습니다. HEAD 기준에서도 같은 위치에 있는 선행 오류임을 확인했습니다)
- `docker-compose/.env.example` — MFA 섹션 주석 (env가 아니라 DB로 관리한다는 안내)
- 버전: MFA는 GoTrue v2.68.0 이상이면 동작하므로 K8s의 v2.143.0도 그대로 씁니다 (2-4 잠금 훅과 달리 image 승격 불필요)
- 신규 문서 `docs/security-gotrue-mfa-policy.md` (Supabase Cloud Dashboard 경로 + Pro 요금제 제약, CLI `config.toml`, 기기 분실 시 복구 SQL 포함)

## 2. 등록 UI — 계정 설정
- 신규 `src/components/pages/account-settings/MfaSection.vue`, `src/components/pages/account-settings/AccountTab.vue` 하단에 섹션으로 삽입 (`/account-settings` → "계정 설정" 탭). 기존 레이아웃은 손대지 않았습니다.
- 등록: `enroll({factorType:'totp'})` → `totp.qr_code` SVG를 `&lt;img&gt;`로 렌더 + 수동 입력용 secret(눈 아이콘/복사 버튼) → 6자리 코드 `challenge`+`verify`
- 등록된 factor 목록(이름·등록 시각), 해제는 확인 다이얼로그 + 현재 코드 재검증 후 `unenroll`
- `enroll`만 하고 닫아 남은 unverified factor를 다음 등록 전에 정리합니다 (`friendly_name` 유일 제약 충돌 방지)
- 공용 로직은 `src/utils/mfa.ts` (`window.$supabase` 관례 사용)

## 3. 로그인 챌린지 흐름
- `src/stores/auth.ts` `signIn()` — 로그인 성공 직후 `getAuthenticatorAssuranceLevel()`로 `aal1`+`nextLevel=aal2`면 `/auth/two-step?redirect=`로 분기 (보호 화면이 깜빡였다 튕기는 것 방지). `StorageBaseSupabase.js`는 건드리지 않았습니다.
- 라우트 `/auth/two-step` → `SideTwoStep.vue` (`src/router/AuthRoutes.ts`의 주석 처리돼 있던 항목을 실제 등록)
- `TwoStepForm.vue` — 기존 6칸 입력 디자인 유지, 로직만 연결 (자동 포커스 이동·붙여넣기 분배·백스페이스·6칸 채우면 자동 제출). 실패 시 문구 표시 후 초기화
- `SideTwoStep.vue` — 레이아웃 유지, 하드코딩 영문을 i18n으로 바꾸고 마스킹 번호 자리에 계정 이메일 표시

## 4. 라우터 가드 — `src/utils/mfaGate.ts`
판정은 JWT `aal` 클레임만 봅니다(로컬 연산). `nextLevel`이 곧 "검증된 factor 보유 여부"라 네비게이션마다 `listFactors()` 네트워크 호출이 없습니다.

| 판정 | 조건 | 이동 |
|---|---|---|
| challenge | `aal1` + `nextLevel=aal2` | `/auth/two-step?redirect=&lt;원래 경로&gt;` |
| enroll | 미등록 + 테넌트 `require_mfa` | `/account-settings?tab=Account&amp;mfaRequired=1` |
| pass | 그 외 | 통과 |

제외 경로: `/`, `/auth/*`, `/external-forms/*`, `/design-system*`. `enroll` 판정에서는 `/account-settings` 자신도 제외(막으면 등록 불가). `?redirect=`는 `safeRedirectTarget()`으로 동일 출처 절대경로만 허용해 오픈 리다이렉트를 막습니다.

## 5. mfa_policy 설정
- `public.configuration` `key='mfa_policy'`, `value={"require_mfa": false}`
- 마이그레이션 `supabase/migrations/20260911_mfa_policy.sql` — 값 미주입, 유일 제약 확인 + 키 문서화
- 조회 실패는 fail-open(false). 설정 장애로 전 사용자가 등록 화면에 갇히는 것을 막되, 이미 등록한 사용자의 챌린지는 AAL만으로 판정하므로 영향 없습니다. 60초 TTL 캐시 + `invalidateMfaPolicyCache()`

## 6. SSO 제외
`evaluateMfaGate()`가 맨 앞에서 `isSsoAuthenticated()`면 통과시키고, `MfaSection`도 SSO 세션에서는 렌더하지 않습니다(켤 수 없는 스위치를 노출하지 않음). `require_mfa` 테넌트라도 SSO 사용자는 IdP 정책을 따릅니다.

## 7. i18n
`ko.json`/`en.json`에 `mfa` 키 29개 추가 (수정 직전 재읽기, 기존 키 보존 — ko 255→256, en 264→265 최상위 키).

## 발견해서 고친 것 2가지
1. **테넌트 서버 리다이렉트 루프**: `$isTenantServer`는 `/tenant/*` 밖 모든 경로를 `/tenant/manage`로 되돌리므로, 거기서 `enroll` 판정을 하면 두 리다이렉트가 서로를 불러 순환합니다. 그 서버에서는 `enroll` 유도를 하지 않게 했습니다(challenge는 `/auth/*`가 열려 있어 정상 동작).
2. **COMMENT 덮어쓰기**: `20260911_tenant_session_timeout.sql`이 파일명 정렬상 뒤에 적용되면서 `configuration` 테이블 COMMENT를 통째로 SET해 mfa_policy 설명을 지웠습니다. 두 마이그레이션 모두 "없으면 덧붙인다" 방식으로 바꿨습니다(둘 다 아직 미적용 상태의 untracked 파일이라 수정이 안전). 실제 Postgres에서 순서대로 적용 → 두 설명 모두 남고, 재실행해도 중복되지 않음을 확인했습니다.

## 남긴 후속 작업
- **관리자 콘솔 `mfa_policy.require_mfa` 편집 UI** — 지금은 SQL로 설정. 세션 타임아웃·잠금 정책도 같은 상태라 설정 화면을 한 번에 만드는 편이 낫습니다.
- **민감 테이블 RLS `aal2` 조건** — 구현하지 않고 적용 방법만 문서화(`docs/security-gotrue-mfa-policy.md`). 선행 조건 기록: 전원 등록 완료 후에 켜야 함(미등록자는 테이블 전체 차단), SSO 세션은 `aal` 클레임이 없어 함께 차단되므로 SSO 테넌트에서는 사용 불가, 테넌트 옵션화하려면 정책마다 `configuration` 조회가 붙어 안정화 함수 설계가 선행돼야 함.
- 관리자 화면의 사용자별 MFA 등록 현황 / 원격 해제 + `admin_audit_log` 기록
- 복구 코드 (GoTrue 미제공 — 자체 테이블 필요). 현재는 운영자가 `auth.mfa_factors`에서 수동 삭제.</result>
<usage><subagent_tokens>162533</subagent_tokens><tool_uses>89</tool_uses><duration_ms>1248027</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T03:13:41.205Z (backfill)

```text
supabase 설정까지 적용한건지?
```

## Prompt — 2026-09-11T03:15:10.734Z (backfill)

```text
지금 서버가 원격 서버임. @~/Start.md 이 방식으로 실행중.
```

## Prompt — 2026-09-11T05:40:08.301Z (backfill)

```text
각 기능에 대해서 직접 테스트 방법 정리해서 markdown file로 생성하고, 미비된 사항도 정리해둬.
```

## Prompt — 2026-09-11T05:43:13.751Z (backfill)

```text
관리자 UI도 만들고 좌측 사이드바 메뉴에도 추가. #5, #2도 작업 시작.
```

## Prompt — 2026-09-11T05:58:38.479Z (backfill)

```text
<task-notification>
<task-id>aa0004b61fa5fd11b</task-id>
<tool-use-id>toolu_01VZFZGCKeGeCRFkvFYYXbVu</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/aa0004b61fa5fd11b.output</output-file>
<status>completed</status>
<summary>Agent "#5 users RLS 테넌트 축소" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. Only two files touched, no commit made.

## 영향 분석

**결정적 발견 — 실제 구멍은 authenticated가 아니라 anon이었다.**
`20260908000001_membership_approvals.sql:135`가 이미 RESTRICTIVE 정책을 걸어놨다:
```sql
CREATE POLICY users_membership_read_gate ON public.users AS RESTRICTIVE FOR SELECT TO authenticated
    USING (tenant_id = public.tenant_id() AND (public.membership_approved() OR id = auth.uid()));
```
`TO authenticated`라서 **anon은 이 제한을 통째로 우회**한다. 즉 인증된 사용자는 이미 자기 테넌트로 묶여 있었고, anon 키만 있으면 전 테넌트 users를 덤프할 수 있었다. 로컬 DB에서 확인: 정책 변경 전 anon이 7행(2개 테넌트) 전부 조회 성공.

**anon 경로 전수 목록**
1. `src/utils/StorageBaseSupabase.js:242` `signIn()` — `select()`(전 컬럼) + 공격자 제공 email. 유일한 "반드시 살려야 하는" anon 경로. → RPC로 전환함.
2. `src/components/ui/field/UserSelectField.vue:205` — 비로그인 라우트 `/external-forms/:formId`에서 `mounted()`가 `getUserList()` 무조건 호출. 테넌트 사용자 디렉터리 전체가 익명 방문자에게 노출되고 있었다. **이건 의도적으로 막는다** (변경 후 빈 목록).
3. `src/utils/customPermissions.ts:47` — `localStorage.uid` 기반이라 세션 없이도 발사 가능. 변경 후 0행 → `permission_ids: []` (안전 방향, 코드가 null을 이미 처리).
4. 라우터: `requiresAuth` 메타는 **선언만 되고 아무 데서도 읽지 않는다**. 비PAL 모드에서는 라우터 레벨 세션 체크가 전혀 없다(`membershipGate.ts:6`이 `$pal`일 때만 동작). 이번 과제 범위 밖이지만 별도 과제감.
5. `signUp()`은 이미 사전 조회를 제거한 상태였다(`:353` 주석).

**tenant claim 실태** — 배포별 마이그레이션이 하드코딩으로 심는다: `20260223_..._localhost.sql`은 `'localhost'`, `20260831000001_fix_tym_tenant_signup.sql`은 `'tym'`. 라이브 로컬 DB 확인 결과 `auth.users` 8명 전원 `app_metadata.tenant_id = 'tym'`, 다중 테넌트 사용자 0명. 다만 claim을 심지 않는 배포/구 토큰에서는 **기존 RESTRICTIVE 정책이 자기 행조차 차단**해 로그인 후 화면이 통째로 비는 상태였다 — 폴백으로 이번에 고쳤다.

**크로스 테넌트 정당 경로** — `getUserAllTenants()`(`ProcessGPTBackend.ts:4101` → `TenantManagePage.vue:341`) 하나뿐. 관리 화면(ManageAccessTab, UserListPage, 조직도, 리뷰어 선택, 채팅 참가자, 분석)은 전부 `window.$tenantName`로 자기 테넌트만 본다. **관리자 전 테넌트 조회 요구는 없다** → 정책에 admin 예외를 넣지 않았다(넣어도 RESTRICTIVE 게이트 때문에 죽은 조건).

## 새 정책

`supabase/migrations/20260911000011_users_rls_tenant_scope.sql`

| 정책 | 종류 | 대상 | 조건 |
|---|---|---|---|
| `users_select_tenant` | PERMISSIVE | authenticated | `CASE WHEN tenant_id() IS NULL THEN id = auth.uid() ELSE tenant_id = tenant_id() END` |
| `users_anon_no_select` | RESTRICTIVE | anon | `false` (허용 정책이 나중에 넓어져도 anon은 영구 차단) |
| `users_membership_read_gate` | RESTRICTIVE | authenticated | 원본 + `OR (tenant_id() IS NULL AND id = auth.uid())` |

INSERT/UPDATE/DELETE 정책은 손대지 않았다. anon의 쓰기 테이블 권한만 REVOKE(SELECT GRANT는 유지 — 회수하면 PostgREST가 42501 오류를 던져 `/external-forms`가 빈 목록 대신 예외로 죽는다. RLS로 막으면 빈 배열이고 노출량은 동일하게 0이다).

**의도적으로 하지 않은 것**: `id = auth.uid()`에서 테넌트 조건을 완전히 떼는 것. 그러면 테넌트 전환 목록이 살아나지만, 다중 테넌트 사용자에서 `.eq('id', uid).maybeSingle()` 호출처들(`customPermissions.ts:47`, `PolicyDocumentManager.vue:146`)이 PGRST116으로 깨진다. 테넌트 전환은 지금도 같은 이유로 현재 테넌트만 보여주는 상태라 현상 유지했고, 마이그레이션 헤더에 사유와 해결 순서를 남겼다.

## RPC

`public.login_precheck(p_email text, p_tenant_id text DEFAULT NULL) RETURNS boolean` — SECURITY DEFINER, `GRANT ... TO anon, authenticated, service_role`.

반환 최소화 근거: 호출부가 실제로 쓰던 값은 `existUser.id`의 존재 여부 하나뿐이고 (`users`에 `is_delete` 류 컬럼은 없다 — 전 컬럼 확인), 목록/이메일/이름을 돌려주면 그 자체가 열거 수단이 된다. 기존 anon 직접 조회보다 정보량이 **줄어든다**(행 전체 → boolean, 한 번에 한 (이메일, 테넌트) 쌍). 로그인 실패 문구는 계정 유무와 무관하게 동일(`invalidCredentials`)하므로 화면상 열거 신호도 그대로 없다.

## 수정 파일

- `supabase/migrations/20260911000011_users_rls_tenant_scope.sql` (신규)
- `src/utils/StorageBaseSupabase.js` — `loginPrecheck()` 추가, `signIn()`의 `getObject('users', …)` 대체. `recordAuthAudit` 호출 6곳·`invalidCredentials`/`emailNotConfirmed`/`not_registered_email` 분기 전부 그대로. `$isTenantServer &amp;&amp; !$tenantName`일 때는 사전 조회 자체를 건너뛴다(기존엔 호출은 하고 결과만 무시했다). RPC 미배포 DB에서 전원 로그인 불가가 되지 않도록 "함수 없음"(PGRST202/42883)일 때만 예전 직접 조회로 폴백한다.

## 컨테이너 검증 (일회용 `postgres:15`, 라이브 DB 미적용)

마이그레이션 3회 연속 적용 성공(idempotent). 페르소나별 가시 행 집합을 적용 전/후로 찍어 diff한 결과:

- **사라진 행**: anon의 `users` 7행 + `users_masked` 7행 **전부**. 그 외 없음.
- **새로 보이는 행**: tenant claim 없는 사용자의 본인 행뿐.
- 즉 `변경 후 ⊇ 변경 전`(authenticated 기준) — 지금 보이던 행이 안 보이게 되는 인증 경로는 하나도 없다.

개별 시나리오: anon 조회 0행(오류 아닌 빈 결과) / anon INSERT `permission denied` / 같은 테넌트 조회 정상 / 타 테넌트 0행(alpha admin도 beta 못 봄) / claim 없는 사용자 본인 행만 / pending 멤버 본인 행만 / `users_masked` 경유 시 테넌트 범위 + 마스킹 동시 적용(본인·admin은 원본, 나머지 `ad***@alpha.com`) / `login_precheck` 8케이스(테넌트 일치·불일치·미지정·빈문자열·대소문자·공백·빈 이메일·NULL) 전부 기대값 일치 / `.eq('id',uid)` 자기 행 조회는 claim 있을 때 정확히 1행(maybeSingle 안전).

`npx vue-tsc --noEmit` 통과.

## 남은 위험

1. **`/external-forms`의 사용자 선택 필드** — 비로그인 방문자에게 빈 목록이 뜬다. 오류는 아니고 화면은 렌더된다. 의도된 차단이지만, 실제 발행된 폼에 `user-select-field`가 있다면 기능 회귀로 보일 수 있다. 필요하면 외부 폼 전용 SECURITY DEFINER RPC(폼에 지정된 후보만 반환)로 별도 설계해야 한다.
2. **테넌트 전환 화면**이 현재 테넌트 행만 보여주는 상태 유지(이번 변경으로 나빠지지도 나아지지도 않음). 고치려면 `maybeSingle()` 호출처를 먼저 정리해야 한다.
3. **`getUserList`/`getMaskedUserList`의 match 덮어쓰기**(`ProcessGPTBackend.ts:4131-4135`, `4181-4183`) — 호출자가 자기 `match`를 넘기면 `tenant_id`가 지워진다. 현재 두 호출처(`ManageAccessTab.vue:363`, `OrganizationChartView.vue:579`) 모두 tenant_id를 다시 넣고 있어 문제없고, 이제 RLS가 뒤를 받쳐준다. 다만 클라이언트가 RLS에 의존하는 구조는 남는다.
4. **`ReviewBoardSubmissionDebug.vue:106`** — 테넌트 필터 없이 `id, username, email, role, is_admin`을 무제한 조회하는 디버그 화면. 이제 RLS로 자기 테넌트로 묶이지만 코드 자체는 그대로다.
5. **비PAL 모드 라우터에 세션 가드가 없다** (`requiresAuth`가 죽은 설정). 이번 과제 범위 밖이나 별도 처리 권장.
6. 배포 순서: 마이그레이션이 먼저 적용되지 않으면 클라이언트가 폴백 경로(직접 조회)를 타는데, 그때는 기존 동작 그대로라 안전하다. 반대로 마이그레이션만 먼저 적용돼도 anon 조회가 빈 결과라 로그인이 "미등록 이메일"로 막힌다 — **마이그레이션 적용 후 프런트 배포**가 아니라 **동시 또는 프런트 먼저**가 안전하다.</result>
<usage><subagent_tokens>147726</subagent_tokens><tool_uses>67</tool_uses><duration_ms>833330</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T05:59:44.791Z (backfill)

```text
<task-notification>
<task-id>a148b22b2515bed6a</task-id>
<tool-use-id>toolu_01Vh7LLCCwiDGTJBgwvypwrP</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a148b22b2515bed6a.output</output-file>
<status>completed</status>
<summary>Agent "보안 설정 관리자 UI" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. `vue-tsc --noEmit` passes clean.

## What was built

**New screen**: `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/SecuritySettings.vue`
- Route `/admin-console/security-settings` (name `Admin Security Settings`), registered as a child of the existing `/admin-console` layout in `src/router/MainRoutes.ts` — the admin console is child-route based, not tab-query based, so this is a sibling of `system-operations`.
- 5 section cards, structured exactly like `SystemOperations.vue` (same `.section-card` / `.section-header` / `.field-row` / `.action-row` class vocabulary; no new visual language invented — the console layout owns the outer surface, so pages are bare `div` wrappers, not `.sk-page-card`, which is the table-page layout helper):
  1. 세션 타임아웃 — 유휴 분 (0=비활성, warns via a `warning` alert and disables the warning-seconds field when 0), 경고 초
  2. 로그인 잠금 — 시도 횟수 (0=비활성, same disable/warn treatment), 윈도우 분, 잠금 분
  3. MFA — `require_mfa` 스위치 + SSO 제외/fail-open 안내
  4. 다운로드 이상 탐지 — 일 임계치
  5. 감사 로그 보관 정책 — **moved here from SystemOperations**
- Each section: loads current value, shows a "기본값 사용 중" badge when no `configuration` row exists yet, validates (integer + range, ranges exported from the store), per-section save button with success/failure feedback text (red on failure), and an info alert explaining *when* the change actually takes effect (refresh / next sign-in attempt / hourly job / 03:00 job) since none of these are instant.
- Uses `window.$i18n.global.t` (legacy i18n mode), `&lt;script&gt;` + `defineComponent`/`setup`, matching SystemOperations.

**Default-vs-set detection**: `getConfigurationValue(key, null)` and checking for `null` — `getConfigurationValue` returns the fallback when the row is missing, so passing a real default would make "unset" indistinguishable from "set to the default value". No backend change needed.

## Store actions added (`src/stores/adminConsole.ts`)

Types/constants: `SessionTimeoutConfig`, `LoginLockoutConfig`, `MfaPolicyConfig`, `DownloadAnomalyConfig`, the four `*_CONFIG_KEY` constants, `*_DEFAULTS`, min/max range constants, and normalizers `clampInt` / `normalizeSessionTimeout` / `normalizeLoginLockout` / `normalizeMfaPolicy` / `normalizeDownloadAnomaly`.

State: `sessionTimeoutPolicy`, `loginLockoutPolicy`, `mfaPolicy`, `downloadAnomalyPolicy`, `securityPolicyUsingDefault`.

Actions: `saveSecurityPolicy` (shared write + audit + default-flag clear), `fetchSessionTimeoutPolicy` / `saveSessionTimeoutPolicy`, `fetchLoginLockoutPolicy` / `saveLoginLockoutPolicy`, `fetchMfaPolicy` / `saveMfaPolicy`, `fetchDownloadAnomalyPolicy` / `saveDownloadAnomalyPolicy`, `fetchSecuritySettings` (loads all five including retention).

All saves go through the existing `get/setConfigurationValue` helpers and write `writeAdminAuditLog({ action: 'security_settings_update', target_type: 'system', target_id: &lt;config key&gt;, target_name: &lt;한글 정책명&gt;, before_value, after_value })` — the changed key is the `target_id`. `saveMfaPolicy` calls `invalidateMfaPolicyCache()` after a successful write. `saveAuditLogRetention` was reused untouched (still `action: 'audit_retention_update'`).

## Sidebar registration

Two places, both needed — this repo's PAL admin menu is **hardcoded**, not derived from the permission table:
- `src/layouts/full/vertical-sidebar/VerticalSidebar.vue` ~line 405: added `{ title: '보안 설정', icon: 'user-lock', to: '/admin-console/security-settings' }` right after 시스템 운영, inside the existing `v-if="pal &amp;&amp; isAdmin"` block.
- `src/utils/routePermissions.ts`: added the matching `MENU_DEFINITIONS` entry (`requiredRole: 'admin'`, `section: 'admin'`, `icon: 'user-lock'`) — this is what `AdminConsoleLayout`'s `lookupRequiredRole` and `customPermissions` read, so without it the page would have no declared required role.
- Icon `user-lock` is an existing asset in `public/assets/images/icon/`; `lock` was already taken by 수정 잠금.

## Moved out of SystemOperations

Template section, `retentionForm`/`retentionError`/`retentionCutoffLabel`/`saveRetention`/`syncRetentionFromStore`, the `fetchAuditLogRetention()` call in `onMounted`, the two retention watches, the `AUDIT_RETENTION_*` imports, the now-unused `t` helper, and the retention-only CSS. A comment marks where it went. Sections renumbered; store actions untouched and reused.

## i18n

`adminConsole.security.*` (45 keys) added to both `ko.json` and `en.json` (re-read immediately before editing; surgical string edits, not a JSON re-dump, to avoid clobbering concurrent edits). The old `adminConsole.systemOps.retention*` keys were removed from both files and folded into `adminConsole.security.retention*` — nothing else referenced them. Note: `adminConsole.systemOps` in `en.json` contained *only* those retention keys, so that block is now gone entirely; the remaining systemOps keys were Korean-only to begin with and still fall back.

## Follow-ups left

- `docs/security.md` still says "관리자 콘솔 편집 UI는 후속 작업" in sections 2-1, 2-3, 2-4 and 3-3. I deliberately did not edit it — that file is untracked and is the concurrent security agent's active working file. Those four lines should be updated to point at `/admin-console/security-settings`.
- Session timeout changes only take effect on the user's next app load (`useIdleTimeout` reads the policy once at startup and has no invalidation export, unlike `mfaGate`). The UI says so, but adding a cache-invalidate/re-read hook there would make it live.
- `getConfigurationValue`/`setConfigurationValue` are `private` on `PalModeBackend` and reached via `as any` — the pre-existing pattern, which I followed rather than widening the surface. Worth making them public if more settings screens land.</result>
<usage><subagent_tokens>136582</subagent_tokens><tool_uses>86</tool_uses><duration_ms>931619</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T06:07:38.279Z (backfill)

```text
<task-notification>
<task-id>a7774af6bd978f505</task-id>
<tool-use-id>toolu_01Am5BB8K129ynHHscy5xAXq</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a7774af6bd978f505.output</output-file>
<status>completed</status>
<summary>Agent "#2 notifications 테이블 생성" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## 산출물

`/home/kimsanghoon/process-gpt-vue3/supabase/migrations/20260911000012_notifications_table.sql` (신규, 425줄). 다른 파일은 건드리지 않았고 커밋도 하지 않았다. (참고: `202609020001_notifications_updated_at.sql` 이 `git status` 에 M 으로 보이지만 03:20 에 이미 수정돼 있던 것으로 제 작업이 아니다.)

## 도출한 스키마 (컬럼별 근거)

| 컬럼 | 타입 | 근거 |
|---|---|---|
| `id` | uuid PK, default gen_random_uuid() | `20260716…:78` gen_random_uuid(), `20260911000004:435` md5(...)::uuid + `ON CONFLICT (id)` → PK 필수 |
| `user_id` | text NULL | 받는 사람이 **이메일·UUID·콤마 목록** 세 가지 (`fcm_service/recipients.py` 머리말·`split_recipients`), 포털은 email+uuid 둘 다 조회 (`ProcessGPTBackend.ts:3844~3861`) |
| `type` | text | `chat`/`workitem`/`workitem_bpm`/`merge_request`/`survey`/`download_anomaly`/`general` (`App.vue:453~463`, 각 INSERT 지점, `database.py:188`) |
| `title` / `description` | text | `database.py:274 notification_text(title, description)`, `NotificationDD.vue` 표시 |
| `url` | text | `database.py:264~268` (tenant 붙여 절대주소화), 포털이 이 값으로 알림을 묶음 |
| `is_checked` | boolean NOT NULL DEFAULT false | `match:{is_checked:false}`, `putObject({id, is_checked:true})` |
| `time_stamp` | timestamptz NOT NULL DEFAULT now() | `orderBy:'time_stamp', sort:'desc'` — **created_at 이 아니다** |
| `from_user_id` | text | `database.py:284`; 대화 알림엔 이메일이 아니라 **표시 이름**이 들어옴(`20260907000002:129`) |
| `tenant_id` | text NULL (기본값 없음) | `database.py:327` dev 필터. 운영과 같은 모양 유지 위해 default 안 둠 |
| `consumer` | text | `database.py:322/338` 선점 |
| `updated_at` | timestamptz, 기본값 없음 | `202609020001` 의 결정 그대로 |

`id` 외 전부 NULL 허용 — **`user_id` 에 NOT NULL 을 걸면 포털 읽음 처리(upsert)가 전부 깨진다**(ON CONFLICT 로 UPDATE 될 행도 NOT NULL 은 먼저 검사된다. 컨테이너에서 재현).

기존 표가 있는 환경은 `CREATE TABLE IF NOT EXISTS` 가 통과하고 `ADD COLUMN IF NOT EXISTS` 가 빠진 칸(consumer/updated_at)만 채운다. 기존 칸의 타입·NOT NULL·기본값은 손대지 않는다.

인덱스 2개: `(tenant_id, time_stamp) WHERE consumer IS NULL`(발송기 폴링), `(user_id, time_stamp DESC) WHERE is_checked=false`(알림함). EXPLAIN 으로 둘 다 실제 질의가 타는 것 확인.

## RLS — 여기서 중요한 것이 두 개 나왔다

순진한 정책(`SELECT/UPDATE 본인 것만`, `INSERT 본인 앞으로만`)은 **기능을 세 군데 죽인다.** 컨테이너로 전부 재현했다.

1. **INSERT 를 "자기 앞으로만" 으로 조이면 안 된다.** `handle_chat_insert()` / `handle_todolist_change()`(둘 다 SECURITY **INVOKER**, `20260907000002`)와 포털 `sendNotification()` 이 모두 **남 앞으로** 알림을 넣는다. from_user_id 강제도 불가(대화 알림은 이메일이 아니라 이름). → INSERT 는 `user_id IS NULL OR btrim(user_id) &lt;&gt; ''` 만 본다(지금과 같은 수준).
2. **`ON CONFLICT DO UPDATE` 가 UPDATE 정책의 WITH CHECK 과 SELECT 정책을 "넣으려는 행" 에 적용한다 — 충돌이 나지 않아도.** 포털의 `putObject` 는 전부 supabase `upsert` 다. 그래서
   - WITH CHECK 을 "본인 것"으로 조이면 읽음 처리·대화 알림이 멈추고,
   - SELECT 정책이 "본인 것"뿐이면 **`chats` INSERT 자체가 통째로 실패한다**(알림만 안 가는 게 아니라 대화 보내기가 죽는다).

최종 정책:
- `SELECT`: `notification_is_mine(user_id) OR user_id IS NULL OR NOT notification_row_exists(id)`. 뒤 두 갈래는 upsert 검사용 통로다. **읽기를 넓히지 않는다** — 읽을 수 있는 행은 모두 이미 표에 있으므로 `NOT row_exists(id)` 는 실제 조회에서 항상 거짓이고, 받는 사람 없는 행은 어느 알림함에도 뜨지 않는다. (`notification_row_exists` 는 SECURITY DEFINER + search_path 고정.)
- `UPDATE`: `USING(본인 것)` / `WITH CHECK (true)` — WITH CHECK 을 일부러 열고, 대신 **BEFORE UPDATE 트리거**가 `current_user IN ('authenticated','anon')` 일 때 `is_checked` 외 모든 칸을 OLD 값으로 **조용히 되돌린다**(오류를 내면 알림함이 멈추므로).
- `INSERT`: 위 1번. `DELETE`: 정책 없음 = 차단.
- GRANT: anon 전면 회수, authenticated 는 SELECT/INSERT/UPDATE(표 단위), service_role 은 ALL. **칸 단위 `GRANT UPDATE(is_checked)` 는 쓸 수 없다** — `ON CONFLICT DO UPDATE SET …` 에 적힌 칸의 UPDATE 권한을 충돌 여부와 무관하게 검사하므로 대화 보내기가 `permission denied for table` 로 죽는다(별도 컨테이너로 확인).
- 역할 존재 가드(`pg_roles`) 안에서 GRANT/REVOKE 하여 순수 PostgreSQL 에서도 통과.

Realtime: `supabase_realtime` publication 에 가드 후 추가. REPLICA IDENTITY 는 기본값 유지(INSERT 이벤트만 쓰고, 선점 UPDATE 가 알림마다 일어나므로 FULL 은 WAL 만 키운다). RLS 를 켜면서 **지금까지 화면단(`App.vue` 의 `user_id === email`)이 하던 거르기를 DB 가 대신한다 — 그전까지는 남의 알림 이벤트가 모든 브라우저로 갔다.**

## 컨테이너 검증 (일회용 postgres:15-alpine, 전부 정리 완료)

- 신규 DB 전체 체인(`20260911000004` → `202609020001` → `20260911000012`) 오류 없음, 재실행 idempotent.
- 운영 모사 DB(consumer/updated_at 없는 기존 표 + 데이터 + anon 전체 권한): 빠진 칸만 추가, 기존 행/칸 보존, anon 권한 0, 재실행 안전.
- 네 갈래 알림 생성 경로(대화 트리거·업무 트리거·sendNotification upsert(from_user_id 있음/없음)) 모두 authenticated 로 성공.
- 격리: 보낸 사람(alice)에게 0건, 받는 사람(bob) 알림함 질의 4건. 읽음 처리 upsert 성공.
- 위조: 남의 알림 UPDATE 0건 / upsert 덮어쓰기 오류(USING) / 내 알림의 url·title·user_id·consumer 변경은 되돌려짐 / DELETE·anon 권한 오류.
- fcm 선점: service_role 로 `consumer IS NULL` 폴링 → 선점 → 두 번째 파드는 0건.
- **이상 탐지 호환**: `detect_download_anomalies(1)` → `notifications_inserted: 1`, 관리자 앞 `download_anomaly` 알림 적재, 재실행 시 0건(결정적 UUID dedupe 동작), 관리자에게만 보임.

## 발견한 불일치·주의사항 (수정하지 않음)

1. **`sb-127-auth-token` 하드코딩** (`ProcessGPTBackend.ts:3848/1526`, `NotificationDD.vue:88`, `PalModeBackend.ts:38`). supabase-js 의 저장 키는 `sb-&lt;projectRef&gt;-auth-token` 이라 이 값은 URL 이 `127.0.0.1` 일 때만 맞는다. 운영에서는 `userUuid` 가 항상 null → 알림함이 **이메일로만** 조회한다. `todolist.user_id` 가 UUID 인 알림은 화면에 뜨지 않는다(`recipients.py` 머리말의 "포털은 둘 다 조회한다" 는 실제로는 성립하지 않는다). RLS 는 `auth.uid()` 도 보므로 이 문제를 악화시키지 않는다.
2. **콤마 목록 수신자**: `user_id = "uuid-a,uuid-b"` 행을 포털 질의(`user_id IN (...)`)는 못 찾는다. RLS 는 콤마를 풀어 판정하므로 정책이 병목은 아니지만, 화면에는 여전히 안 뜬다.
3. **`is_checked` 가 NULL 인 옛 행**은 `eq('is_checked', false)` 에 안 잡혀 영영 안 보인다(기존 성질 그대로, 새 표는 NOT NULL DEFAULT false).
4. **후속 과제(권장)**: `handle_chat_insert` / `sendNotification` 의 `ON CONFLICT DO UPDATE` 는 언제나 새 uuid 라 쓸모가 없다. 이것을 없애거나 트리거를 SECURITY DEFINER 로 바꾸면 SELECT 정책의 통로 두 개를 지우고 정책을 "본인 것만" 으로 깔끔하게 좁힐 수 있다. 또 클라이언트 직접 INSERT 를 SECURITY DEFINER RPC 로 옮기면 "남 앞으로 임의 알림 생성"(피싱 url 포함)도 막을 수 있다 — 현재는 RLS 적용 전과 같은 수준으로 열려 있다.
5. `notifications` 를 **읽는** 트리거가 생기면 SELECT 정책의 전제(“읽을 수 있는 행은 모두 이미 표에 있다”)는 그대로 유지되지만, 새 트리거가 알림을 upsert 로 넣는다면 같은 함정을 다시 밟게 된다. 마이그레이션 주석에 그 이유를 모두 남겨 두었다.</result>
<usage><subagent_tokens>189566</subagent_tokens><tool_uses>97</tool_uses><duration_ms>1346780</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T06:29:01.259Z (backfill)

```text
1. 사이드바 메뉴에 없음.
```

## Prompt — 2026-09-11T06:30:45.192Z (backfill)

```text
1. `/account-settings` 메뉴 진입하는 곳이 없음.
```

## Prompt — 2026-09-11T06:58:33.844Z (backfill)

```text
프로세스 순서도의 패널은 기본적으로 모든 패널이 열린상태로 시작. 그리고 읽기모드에서도 접고 펼치기 가능하도록 처리.
```

## Prompt — 2026-09-11T07:28:57.558Z (backfill)

```text
공개범위가 아닌 (권한이 없는 유저)는 체계도 목록에서도 안보여야하고, 해당 프로세스를 접근 시 권한이 없다고 메시지가 나와야 할 것 같음.
```

## Prompt — 2026-09-11T07:47:50.067Z (backfill)

```text
<task-notification>
<task-id>aaae193a3cf336772</task-id>
<tool-use-id>toolu_01GhTAhraVhnjbkt9eAkyu5P</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/aaae193a3cf336772.output</output-file>
<status>completed</status>
<summary>Agent "공개범위 트리 숨김·접근 차단 안내" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. Cleaned up the test container and verified everything.

## Report

### 1. 트리 데이터 소스 추적 결과

**트리는 proc_def RLS를 전혀 거치지 않는다.**

| 소스 | 경로 | RLS |
|---|---|---|
| `procMap` (트리 구조 + **이름**) | `ProcessHierarchy.loadInitialData` → `backend.getProcessDefinitionMap()` → `ProcessGPTBackend.ts:1908` → `storage.getObject('configuration', {key:'proc_map'})` | ❌ **우회** — 계층·이름이 `configuration` 한 행의 JSONB에 복제돼 있어 `proc_def` 정책과 무관 |
| `definitionList` (상태/버전) | `fetchDefinitionListLite()` → `PalModeBackend.listDefinitionStatusLite()` (`PalModeBackend.ts:474`) → `window.$supabase.from('proc_def')` | ✅ authenticated 키 직접 조회 → RLS 적용 |
| 단건 로드 | `getDefinitionDetailLite` / `getRawDefinition` / `resolveProcessRouteId`(uuid→id) — 전부 `proc_def` 직접 조회 | ✅ |
| 검색 | 트리 검색은 `treeNodes` 로컬 필터, `CallActivityManagement.vue`·`ProcessHierarchyProperties.vue`·`NewProcessDialog.vue`는 `.from('proc_def')` 직접 조회 | ✅ (트리 필터 적용 후 자동 반영) |

SECURITY DEFINER RPC가 트리에 관여하는 곳은 없었다(`.rpc()` 호출 전수 확인 — proc_def를 읽는 RPC 없음).

### 2. 적용한 필터 방식

권고대로 **"RLS 하에서 조회된 proc_def id 집합에 없는 id는 트리에서 제외"**.

- `ProcessHierarchy.vue`: computed `visibleProcessIdSet` — `definitionList`에서 id Set 생성. `window.$pal`이 아니거나 목록 로드가 실패하면 `null` 반환 → **fail-open**(트리가 통째로 비는 회귀 방지). `definitionListLoaded` 플래그를 `Promise.allSettled` 결과로 세팅.
- `ProcessHierarchyTree.vue`: prop `visibleProcessIds`(Set, 기본 null) + `isProcessVisible()`. `treeNodes` 계산 시 **sub 노드만** 제외, mega/major/domain 구조는 그대로 유지. `subCount`·`allSubProcesses`(접힌 미니뷰)·검색이 모두 `treeNodes` 파생이라 자동 반영.
- `VersionComparison.vue`도 같은 트리를 쓰므로 동일 규약 적용.
- **`this.procMap`은 절대 건드리지 않았다** — `putProcessDefinitionMap` 쓰기 경로가 필터된 맵을 되써서 남의 프로세스를 지우는 사고를 막기 위해 표시 계층에서만 필터한다.

### 3. 권한 안내 UI

- 위치: `ProcessHierarchy.vue` 캔버스 중앙(`.hierarchy-access-denied`, 디자이너 위 absolute 오버레이 — 디자이너를 언마운트하지 않아 에디터 상태 재생성 없음).
- 문구(ko): 제목 **"이 프로세스를 볼 수 있는 권한이 없습니다"**, 설명 "프로세스가 없거나 공개 범위 밖이라 열람할 수 없습니다. 담당자 또는 관리자에게 권한을 요청하세요.", 버튼 **"체계도로 돌아가기"** → `/process-architecture`.
- 진입 경로 3가지 모두 커버:
  1. `loadProcess()`가 0행(`def === null`) → `markProcessAccessDenied()`
  2. `mounted()`에서 `resolveProcessRouteId()`가 null (URL이 uuid인데 RLS로 가려짐 — 이 경우 기존 코드는 아무것도 안 하고 빈 화면이었다)
  3. `$route.query.id` / `$route.params.id` watcher의 같은 상황 → `openLinkedProcessInNewTab` 새 탭 경로가 여기로 수렴
- CallActivity **인라인 드릴다운**: `CallActivityDrilldown.js`의 도면 미발견 에러에 `code='LINKED_PROCESS_UNAVAILABLE'` 부여 → `BpmnUengine.vue` `onError`에서 동일 통합 문구 토스트(`processVisibility.accessDeniedShort`). 기존에는 console.warn만 하고 조용히 실패했다.
- i18n: `ko.json`/`en.json`의 기존 `processVisibility` 블록에 `accessDeniedTitle`/`accessDeniedDesc`/`accessDeniedShort`/`backToArchitecture` 4키 추가(기존 키 보존, JSON 파싱 검증 완료).

### 4. 마이그레이션 — **불필요**

`20260911000008`의 `proc_def_select_visibility`만으로 두 요구사항의 DB 전제가 충족된다. `20260911000013`은 만들지 않았다.

### 5. 컨테이너 검증 (일회용 postgres:16-alpine, 라이브 DB 미적용)

기존 `scripts/validate-migrations-empty-db.sh`는 호스트에 `psql`이 없어 실패 → 컨테이너 내부 psql을 쓰는 변형으로 실행.

- **타임스탬프 마이그레이션 100개 전부 OK**. `consolidated_schema.sql`/`schema_merge.sql`(extra) 2건은 `tb_bpmn_model_select_policy already exists`로 실패하나 **내 변경과 무관한 기존 이슈**(마이그레이션을 추가하지 않았으므로 before/after 동일).
- RLS 동작 테스트(tenant `acme`, alice=dept-sales·owner, bob=dept-hr, root=admin):

| 사용자 | 조회된 proc_def |
|---|---|
| alice (dept-sales, owner) | `p_all, p_org, p_private` |
| bob (dept-hr, 비작성자) | `p_all` ✅ |
| root (admin) | `p_all, p_org, p_private` ✅ |

- bob의 `p_private` **uuid 단건 조회 = 0행** → `resolveProcessRouteId` null 경로가 실제로 발생함을 확인(요구사항 2의 새 처리가 필요했던 이유).
- bob이 `configuration.proc_map`은 **읽을 수 있음**을 확인 → 아래 잔여 노출로 기록.

### 6. 회귀 위험 지점

1. **stale proc_map 엔트리**: proc_def에 없는 유령 sub 노드가 proc_map에 남아 있으면 이제 트리에서 사라진다(PAL 모드 한정). 클릭해도 어차피 에러였던 항목이라 실질 손실은 없지만 "개수가 줄었다"는 인상은 준다.
2. **proc_def 목록 페이지네이션**: `listDefinitionStatusLite`에 `.range()`가 없어 PostgREST `db-max-rows`가 걸리면 초과분이 트리에서 숨겨진다. 기존 `useProcessArchitecture.ts:530`도 같은 전제를 쓰고 있어 새 위험은 아니지만, 프로세스 수가 1000을 넘는 테넌트에서는 확인 필요.
3. **잔여 노출(후속 과제)**: `configuration.proc_map` 자체는 RLS로 행 내부를 못 가리므로 **숨긴 프로세스의 이름·id가 네트워크 페이로드에는 여전히 실린다**. 근본 해결은 서버측 필터 읽기 RPC + 쓰기 RPC 분리가 필요한데, 현재 클라이언트가 전체 맵을 읽어 그대로 되쓰는 구조라 같이 바꾸지 않으면 데이터 유실 위험이 있어 이번 범위에서 제외했다.
4. **`ProcessArchitecture.vue`(체계도 본화면)** 는 이번 필터 대상이 아니다 — 같은 procMap을 쓰므로 동일 노출이 남아 있다.
5. 안내 표시까지 ~1.7초 지연: `fetchProcessDefinitionDetail`의 기존 4회 재시도(250/500/750ms) 때문. 기존 동작 유지를 위해 건드리지 않았다.
6. 비 PAL 모드는 `visibleProcessIdSet`이 항상 `null`이라 트리 동작이 바이트 단위로 동일하다. 트리 드래그는 이 화면에 없고(ProcessArchitecture 소관), 추가/이름변경은 mega/major 레벨이라 영향 없음, 신규 생성 경로(`handleAddCallActivitySub`, `handleRegisterGeneratedProcesses`, `handleAddMega/MajorProcess`)는 모두 `loadInitialData()`로 definitionList를 갱신하므로 새 프로세스가 즉시 보인다.

`npx vue-tsc --noEmit` 통과. git commit 하지 않았고, 기존 마이그레이션 파일과 `StorageBaseSupabase.js` 로그인 함수는 수정하지 않았다.</result>
<usage><subagent_tokens>169114</subagent_tokens><tool_uses>140</tool_uses><duration_ms>1082331</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T08:01:24.046Z (backfill)

```text
<task-notification>
<task-id>a750068bdb86aff2e</task-id>
<tool-use-id>toolu_01KcifNL2MWrv617cWgreyoV</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/33800e41-6f21-4fd7-82f0-c9cf63d2346a/tasks/a750068bdb86aff2e.output</output-file>
<status>completed</status>
<summary>Agent "체계도 화면 공개범위 필터" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>## 완료 보고

### 1. 체계도 데이터 흐름 (표시 / 저장 분리)

**표시 경로**
- `configuration.proc_map`(JSONB, RLS 우회) → `backend.getProcessDefinitionMap()` → `procMap` ref
- `proc_def`(RLS 적용) → `backend.listDefinitionStatusLite()` → `allProcDefs` + `processStatuses`
- `procMap` → `filteredProcMap`(검색·도메인·내프로세스·고급필터) → 카드/트리/매트릭스/머메이드 뷰 4종 + `stats`(상단 카운트 바) + `isFilteredEmpty`

**저장 경로 (전부 `procMap.value` 원본을 clone)**
- `handleMoveSub` / `handleMoveMajor` → `JSON.parse(JSON.stringify(procMap.value))` → `applySubMajorMove`/`applyMajorStageMove`(전부 **id 기반** 탐색, index는 원본 맵 안에서만 계산) → `saveProcMap`
- `saveEditProcess`(mega/major 추가·이름변경·이동) → 원본 clone → `saveProcMap`
- `ProcessArchRestructureStudio`(admin 전용) → `:procMap="procMap"` 원본 → `cloneProcMap()` → draft → `adminConsole.runCutoverJob` → `putProcessDefinitionMap`
- `NewProcessDialog.updateProcMap` → prop이 아니라 `backend.getProcessDefinitionMap()` 으로 **다시 조회**해서 push

### 2. 적용한 필터 (`src/views/process-architecture/useProcessArchitecture.ts`)
- `procDefsLoaded` ref 추가 — `allProcDefs` 세팅 성공 시에만 true
- `visibleProcessIdSet` computed — ProcessHierarchy와 동일 규약(id + 소문자 동시 등록). fail-open(null) 조건: **비 PAL / PAL+uEngine 모드 / proc_def 목록 미로드·실패**
- `isSubProcessVisible()` 헬퍼, `visibleProcMap` computed — **sub 노드만** 제거, mega/major/도메인 구조 유지, 숨길 게 없으면 원본 참조 그대로 반환(재렌더 방지)
- `filteredProcMap` 의 베이스를 `procMap` → `visibleProcMap` 으로 교체 ⇒ 카드·트리·매트릭스·머메이드 뷰, 검색, `stats` 카운트, empty-state가 **한 곳 수정으로 전부** 커버됨
- `topRecentlyViewed` — 최근 본 프로세스 드롭다운에서도 권한 밖 항목 제외

`ProcessArchitecture.vue`
- `getExportProcMap()`: `full` 스코프도 `visibleProcMap` 사용 (기존엔 원본 procMap을 그대로 Excel/PDF/JSON/Mermaid로 내보내 권한 밖 프로세스명이 유출됐음 — **실제 유출 경로였고 수정함**)
- 담당자 필터 옵션(`collectOwnerIdentifiersFromProcMap`)·시스템/OSS 필터 옵션(`availableSystemsForFilter`)도 `visibleProcMap` 기준 (숨긴 프로세스의 담당자명/시스템명이 드롭다운에 새던 것 차단)

### 3. 저장 경로 안전성 검증 (가장 중요) — **안전**
- 4개 뷰는 필터된 맵을 받지만 emit은 전부 **id만** 전달(`moveSub(subId, fromMajorId, toMajorId)`, `moveMajor(majorId, megaId, stage)`, `editProcess({type,id,name})`). 리스트 전체나 index를 올려보내는 경로 없음.
- 모든 저장 핸들러가 `procMap.value`(원본) clone에서 동작하므로, 필터로 숨겨진 sub가 `proc_map`에서 삭제될 경로는 **없음**. `processMapMove.ts` 의 splice index도 원본 맵 내부에서 계산됨.
- `visibleProcMap` 은 컴포저블·뷰 양쪽 주석에 "저장 payload로 절대 사용 금지"를 명시.
- 추가 방어층: `ProcessGPTBackend.putProcessDefinitionMap` 은 PAL·비 superAdmin·usePermissions 조건에서 기존 맵과 `mergeProcessMaps` 병합함.
- 편집/재구성 UI는 owner+ 또는 admin 게이트이고, RLS(`proc_def_select_visibility`)는 `has_role_at_least('admin')` 을 무조건 통과시키므로 관리자 쪽 실질 위험도 없음.
- `PermissionDialog`(`:processMap="procMap"`)는 도메인/메가 단위 권한을 하위 sub 전체에 적용하는 용도라 **의도적으로 원본 유지**. `NewProcessDialog` 도 PID 생성 충돌 방지를 위해 원본 유지(하지만 소스 드롭다운 목록 자체는 RLS로 걸러진 proc_def 목록과 교집합이라 유출 없음).

### 4. 회귀 위험 / 주의사항
- **PAL+uEngine 모드 주의**: `PalUengineBackend` 에는 `listDefinitionStatusLite` 가 없어 BackendFactory의 null-skip 프록시가 `[]` 를 돌려준다. 이걸 "아무것도 못 봄"으로 해석하면 화면이 통째로 빈다 → 체계도는 `$mode === 'uEngine'` 일 때 필터를 끄도록 명시적으로 막아뒀다. **다만 방금 작업된 `ProcessHierarchy.vue` 의 `definitionListLoaded = (status === 'fulfilled')` 는 이 케이스를 걸러내지 못해 PAL+uEngine에서 계층 트리가 빌 수 있다.** (해당 파일 수정 금지 지시라 손대지 않음 — 담당자 확인 필요)
- PAL+ProcessGPT 모드에서 `proc_def` 는 없고 `proc_map` 에만 남은 유령 항목(소프트 삭제 잔존 등)은 이제 체계도에서도 안 보인다. 계층 화면과 동일한 기준이라 일관적이며, 삭제 시 `PalModeBackend` 가 proc_map에서도 제거하므로 실제 케이스는 드묾.
- `stats.subTotal` 등 카운트가 사용자별로 달라진다(권한 밖 프로세스 제외). 리뷰보드/Executive Summary 의 카운트와는 모집단이 달라질 수 있음 — 두 화면은 이번 범위 밖.
- DB 변경·마이그레이션 없음, 로케일 키 추가 없음, commit 하지 않음. `npx vue-tsc --noEmit` → exit 0.

**수정 파일**: `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/useProcessArchitecture.ts`, `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue` (NewProcessDialog.vue 의 diff 1줄은 이전 작업의 것으로 제가 건드리지 않았습니다)</result>
<usage><subagent_tokens>129851</subagent_tokens><tool_uses>60</tool_uses><duration_ms>768800</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-11T08:46:13.704Z (backfill)

```text
다단계 인증(MFA)은 어떻게 구현된건지 흐름 설명좀.
```

<!-- backfilled-from: 9642f7aa-e030-4081-b8c9-a789572d6a03 -->

## Prompt — 2026-09-14T05:35:01.341Z (backfill)

```text
속성스키마 관리페이지 수정.
1. 상단 유형 선택 부분 너무 큼. (미리보기부분 아님)
2. 비활성화됨 보기 왼쪽 입력창은 무엇인지? 필요없다면 없애도됨.
3. 세부 업무 수행 절차 여러줄 입력 가능하도록 변경 필요. (읽기에선 줄바꿈으로 표시되어야함.)
4. 전용 위젯자체를 편집하는 에디터 생성방안이 있을지 제안.
```

## Prompt — 2026-09-14T06:16:08.509Z (backfill)

```text
상단 유형에서 이제는 유형만 보임.
```

## Prompt — 2026-09-14T06:18:05.280Z (backfill)

```text
확인했음. 위젯 자체를 편집하는게 장기적으로 좋을 것 같은데 2번은 위젯 자체를 직접 편집 가능한 구조인지?
```

## Prompt — 2026-09-14T06:19:17.996Z (backfill)

```text
포팅까지 고려할거임.
```

## Prompt — 2026-09-14T07:56:03.203Z (backfill)

```text
목록관리 메뉴 탭 생성. 그래서 주제를 기준으로 리스트 생성하고, 해당 목록 속성스키마에서 사용 가능하도록.
```

## Prompt — 2026-09-14T08:08:16.722Z (backfill)

```text
마이그레이션 적용해줘
```

<!-- backfilled-from: 1dd8364f-a53f-4c2f-9f59-1a07ffa7134a -->

## Prompt — 2026-09-14T06:28:30.583Z (backfill)

```text
프로세스 순서도 수정사항.
1. 순서도 패널에서 읽기모드일땐, Input부분을 ReadOnly로 두는 방식이아닌, 값만 UI에 맞춰서 보여주도록. (읽기전용 view로)
2. RACI입력시, Task가 올라가있는 Lane의 이름을 R(책임)으로 자동으로 입력.
```

## Prompt — 2026-09-14T06:42:15.387Z (backfill)

```text
PI Flag부분도 마찬가지로 등록된게 없으면 등록된 개선과제가 없습니다 만 나와야하는데 Input 노출.
```

## Prompt — 2026-09-14T07:23:10.053Z (backfill)

```text
유저 계정설정 페이지에서 PAL모드의 경우, 아래 메뉴 탭 숨김 필요. 
1. 사용자관리.
2. 구글 드라이브설정.
3. 지식베이스
4. MCP서버
5. 환경변수
6. 코드편집 
7. 데이터소스
8. Git 설정
9. 용어집 관리
10. 카탈로그(해당 부분은 별도 메뉴로 분리 필요 - 순서도에서 사용 가능하도록 처리해야함.)
11. 조직그룹
12 테넌트 관리
```

## Prompt — 2026-09-14T07:39:29.469Z (backfill)

```text
카탈로그 등록 다이얼로그 현재 구조에 맞게 현행화 해줘.
```

## Prompt — 2026-09-14T07:54:59.583Z (backfill)

```text
Task 추가에 시스템 이런건 현재는 필요 없는 영역임.
```

## Prompt — 2026-09-14T08:32:21.135Z (backfill)

```text
시스템 필터도 제거해줘. Save안되는 이슈 및 태스크 유형에 따라 속성패널도 열어주면 좋을 것 같음.
```

## Prompt — 2026-09-14T08:43:19.434Z (backfill)

```text
이 Task 종류에 정의된 속성 스키마가 없습니다. 라고 나옴.
```

## Prompt — 2026-09-14T08:44:50.242Z (backfill)

```text
프로세스 순서도에서 공개 범위 부분도 읽기모드일때 Input box가 보임.
```

<!-- backfilled-from: 352d3d4e-6dfe-4614-8e14-296875935421 -->

## Prompt — 2026-09-14T08:22:35.573Z (backfill)

```text
보안설정 메뉴에서 '다운로드 이상 탐지' 기능 중 관리자 알림은 어떤식으로 동작함?
```

## Prompt — 2026-09-14T08:24:24.652Z (backfill)

```text
알림 관련 뱃지 및 페이지 필요. 현재 알림이 표시 되는 페이지가 없는 것 같음.
```

## Prompt — 2026-09-14T08:33:24.250Z (backfill)

```text
PAL에선 헤더를 안씀. 따라서 다른 곳으로 이동해야함. 알림 목록 메뉴를 만들고, 거기에 뱃지로 갯수 두는게 좋아보임.
```

## Prompt — 2026-09-14T08:38:50.818Z (backfill)

```text
1. 페이지 크기 기타 페이지와 동일하게 영역 크기 맞추기.
2. 알림 목록 처음 눌렀을 땐 자그마한 박스로 페이지 전환없이 목록 보여주고, 전체보기 누르면 페이지로 이동하도록 처리.
```

<!-- backfilled-from: 3679f9ac-6cd2-4028-8dd7-a77ef26cb9ee -->

## Prompt — 2026-09-15T04:11:49.869Z (backfill)

```text
/goal Task Catalog 기능의 현행화를 진행한다. Task 등록(프로세스 작성 시 등록, Catalog 페이지에서 직접 등록)부터 사용까지 기능을 검증해야한다. Catalog 페이지에서 직접 등록은 사용자가 실제로 사용하게되는 패널과 같은 패널을 기반으로 생성이 가능해야한다. 등록된 Task는 프로세스 순서도에서 사용 가능해야하고, 별도 메뉴추가가 아닌, 현재 프로세스 작성 흐름에서 크게 벗어나지않는 방식 (요소 변경으로 추가/속성패널에서 설정 등)으로 진행해야함. 추가 된 기능에 대하여서 유저가 직접 테스트 할 수 있도록 기능 별 메뉴얼(*-manual.md)과 테스트 가이드 문서(*-test.md)를 docs/ 하위에 각 기능 별로 작성한다.
```

## Prompt — 2026-09-15T05:42:04.651Z (backfill)

```text
Task 추가 다이얼로그 변경 필요. Task 유형 설정하면 속성패널보여지듯(속성 스키마의 미리보기같이)
```

## Prompt — 2026-09-15T05:54:22.112Z (backfill)

```text
Task Catalog 페이지 구조 수정. 다른 페이지들과 마찬가지로 제목도 필요하고, 내부 컨텐츠 영역 조절 필요함.
```

## Prompt — 2026-09-15T06:15:18.468Z (backfill)

```text
TaskCatalogDialog.vue:396 Failed to save catalog item: StorageBaseError: error in putObject
    at StorageBaseSupabase.putObject (StorageBaseSupabase.js:708:19)
    at async PalModeBackend.saveTaskCatalog (ProcessGPTBackend.ts:9749:9)
    at async Proxy.<anonymous> (BackendFactory.ts:67:88)
    at async Proxy.saveCatalogItem (taskCatalog.ts:541:31)
    at async save (TaskCatalogDialog.vue:383:31)Caused by: StorageBaseError: error in putObject:404 Not Found Could not find the table 'public.task_catalog' in the schema cache
    at StorageBaseSupabase.putObject (StorageBaseSupabase.js:704:23)
    at async PalModeBackend.saveTaskCatalog (ProcessGPTBackend.ts:9749:9)
    at async Proxy.<anonymous> (BackendFactory.ts:67:88)
    at async Proxy.saveCatalogItem (taskCatalog.ts:541:31)
    at async save (TaskCatalogDialog.vue:383:31)
```

## Prompt — 2026-09-15T06:20:15.092Z (backfill)

```text
카탈로그는 속성 스키마로 처리 안했음?
```

## Prompt — 2026-09-15T06:23:36.111Z (backfill)

```text
근데 속성 스키마 관리에서는 카탈로그 설정하는 부분이 는데?
```

## Prompt — 2026-09-15T06:23:41.494Z (backfill)

```text
근데 속성 스키마 관리에서는 카탈로그 설정하는 부분이 없는데?
```

## Prompt — 2026-09-15T06:25:18.790Z (backfill)

```text
카탈로그 전용 노출 제어 추가해줘. 이유는 카탈로그가 맨 위에 있을 필요가 없어보이는데, 순서 제어가 필요해보임.
```

## Prompt — 2026-09-15T07:07:36.533Z (backfill)

```text
EventBus.js:471 unhandled error in event listener TypeError: 'get' on proxy: property 'outgoing' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected '[object Array]' but got '[object Object]')
    at handleReplacement (CompensateBoundaryEventBehavior.js:105:41)
    at CommandInterceptor.js:57:15
    at invokeFunction (EventBus.js:614:13)
    at EventBus._invokeListener (EventBus.js:457:19
    at EventBus._invokeListeners (EventBus.js:431:24
    at EventBus.fire (EventBus.js:379:24
    at CommandStack._fire (CommandStack.js:395:29
    at CommandStack._internalExecute (CommandStack.js:435:10
    at CommandStack.execute (CommandStack.js:186:8
    at Modeling.replaceShape (Modeling.js:571:22
(익명) @ EventBus.js:471
(익명) @ EventBus.js:431
(익명) @ EventBus.js:379
(익명) @ CommandStack.js:395
(익명) @ CommandStack.js:435
(익명) @ CommandStack.js:186
(익명) @ Modeling.js:571
(익명) @ Replace.js:67
replaceElement @ BpmnReplace.js:341
applyCatalogItemToElement @ taskCatalogApply.js:42
applyCatalogToElement @ ProcessHierarchyProperties.vue:10452
(익명) @ runtime-dom.esm-bundler.js:380
callWithErrorHandling @ runtime-core.esm-bundler.js:155
callWithAsyncErrorHandling @ runtime-core.esm-bundler.js:164
callWithAsyncErrorHandling @ runtime-core.esm-bundler.js:174
(익명) @ runtime-dom.esm-bundler.js:366
ProcessHierarchyProperties.vue:10466 Failed to apply catalog item: TypeError: 'get' on proxy: property 'outgoing' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected '[object Array]' but got '[object Object]')
    at handleReplacement (CompensateBoundaryEventBehavior.js:105:41)
    at CommandInterceptor.js:57:15
    at invokeFunction (EventBus.js:614:13)
    at EventBus._invokeListener (EventBus.js:457:19
    at EventBus._invokeListeners (EventBus.js:431:24
    at EventBus.fire (EventBus.js:379:24
    at CommandStack._fire (CommandStack.js:395:29
    at CommandStack._internalExecute (CommandStack.js:435:10
    at CommandStack.execute (CommandStack.js:186:8
    at Modeling.replaceShape (Modeling.js:571:22

카탈로그 적용시 오류.
```

## Prompt — 2026-09-15T07:07:56.097Z (backfill)

```text
EventBus.js:471 unhandled error in event listener TypeError: 'get' on proxy: property 'outgoing' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected '[object Array]' but got '[object Object]')
    at handleReplacement (CompensateBoundaryEventBehavior.js:105:41)
    at CommandInterceptor.js:57:15
    at invokeFunction (EventBus.js:614:13)
    at EventBus._invokeListener (EventBus.js:457:19
    at EventBus._invokeListeners (EventBus.js:431:24
    at EventBus.fire (EventBus.js:379:24
    at CommandStack._fire (CommandStack.js:395:29
    at CommandStack._internalExecute (CommandStack.js:435:10
    at CommandStack.execute (CommandStack.js:186:8
    at Modeling.replaceShape (Modeling.js:571:22
(익명) @ EventBus.js:471
(익명) @ EventBus.js:431
(익명) @ EventBus.js:379
(익명) @ CommandStack.js:395
(익명) @ CommandStack.js:435
(익명) @ CommandStack.js:186
(익명) @ Modeling.js:571
(익명) @ Replace.js:67
replaceElement @ BpmnReplace.js:341
applyCatalogItemToElement @ taskCatalogApply.js:42
applyCatalogToElement @ ProcessHierarchyProperties.vue:10452
(익명) @ runtime-dom.esm-bundler.js:380
callWithErrorHandling @ runtime-core.esm-bundler.js:155
callWithAsyncErrorHandling @ runtime-core.esm-bundler.js:164
callWithAsyncErrorHandling @ runtime-core.esm-bundler.js:174
(익명) @ runtime-dom.esm-bundler.js:366
ProcessHierarchyProperties.vue:10466 Failed to apply catalog item: TypeError: 'get' on proxy: property 'outgoing' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected '[object Array]' but got '[object Object]')
    at handleReplacement (CompensateBoundaryEventBehavior.js:105:41)
    at CommandInterceptor.js:57:15
    at invokeFunction (EventBus.js:614:13)
    at EventBus._invokeListener (EventBus.js:457:19
    at EventBus._invokeListeners (EventBus.js:431:24
    at EventBus.fire (EventBus.js:379:24
    at CommandStack._fire (CommandStack.js:395:29
    at CommandStack._internalExecute (CommandStack.js:435:10
    at CommandStack.execute (CommandStack.js:186:8
    at Modeling.replaceShape (Modeling.js:571:22

속성 패널을 통해 카탈로그 적용시 오류.
```

## Prompt — 2026-09-15T07:08:16.023Z (backfill)

```text
EventBus.js:471 unhandled error in event listener TypeError: 'get' on proxy: property 'outgoing' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected '[object Array]' but got '[object Object]')
    at handleReplacement (CompensateBoundaryEventBehavior.js:105:41)
    at CommandInterceptor.js:57:15
    at invokeFunction (EventBus.js:614:13)
    at EventBus._invokeListener (EventBus.js:457:19
    at EventBus._invokeListeners (EventBus.js:431:24
    at EventBus.fire (EventBus.js:379:24
    at CommandStack._fire (CommandStack.js:395:29
    at CommandStack._internalExecute (CommandStack.js:435:10
    at CommandStack.execute (CommandStack.js:186:8
    at Modeling.replaceShape (Modeling.js:571:22
(익명) @ EventBus.js:471
(익명) @ EventBus.js:431
(익명) @ EventBus.js:379
(익명) @ CommandStack.js:395
(익명) @ CommandStack.js:435
(익명) @ CommandStack.js:186
(익명) @ Modeling.js:571
(익명) @ Replace.js:67
replaceElement @ BpmnReplace.js:341
applyCatalogItemToElement @ taskCatalogApply.js:42
applyCatalogToElement @ ProcessHierarchyProperties.vue:10452
(익명) @ runtime-dom.esm-bundler.js:380
callWithErrorHandling @ runtime-core.esm-bundler.js:155
callWithAsyncErrorHandling @ runtime-core.esm-bundler.js:164
callWithAsyncErrorHandling @ runtime-core.esm-bundler.js:174
(익명) @ runtime-dom.esm-bundler.js:366
ProcessHierarchyProperties.vue:10466 Failed to apply catalog item: TypeError: 'get' on proxy: property 'outgoing' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected '[object Array]' but got '[object Object]')
    at handleReplacement (CompensateBoundaryEventBehavior.js:105:41)
    at CommandInterceptor.js:57:15
    at invokeFunction (EventBus.js:614:13)
    at EventBus._invokeListener (EventBus.js:457:19
    at EventBus._invokeListeners (EventBus.js:431:24
    at EventBus.fire (EventBus.js:379:24
    at CommandStack._fire (CommandStack.js:395:29
    at CommandStack._internalExecute (CommandStack.js:435:10
    at CommandStack.execute (CommandStack.js:186:8
    at Modeling.replaceShape (Modeling.js:571:22

속성 패널을 통해 카탈로그 적용시 오류.
그리고 요소 변경을 통해 변경시, Task 명 변경 안됨.
```

## Prompt — 2026-09-15T07:27:14.851Z (backfill)

```text
패널이 열린 상태에서 요소 변경을 하면 패널에 데이터 반영이 바로 안됨.
```

## Prompt — 2026-09-15T08:15:58.932Z (backfill)

```text
기존 등록된 용어 목록이 안보임. 용어 추가시에 기존에 사용하던 용어가 있다면 해당 용어를 추천하는 기능 필요.
```

## Prompt — 2026-09-15T08:30:14.216Z (backfill)

```text
ls
```

<!-- backfilled-from: 805f21a3-66ac-4aac-824a-557a8a23d351 -->

## Prompt — 2026-09-15T05:53:02.680Z (backfill)

```text
/goal @"P5.4.3 내부심사 프로세스.pptx" 해당 문서에 작성된 사항들이 현재 프로세스 순서도에서 BPMN 작성이 누락없이 가능해야한다. Input 영역이 없다면 속성 스키마 메뉴를 통하여 추가 및 관리가 되어야한다. 그리고 PAL에서 프로세스 작성을 포함(전체를 그릴 필요는 없음) 20분 이내의 시연 시나리오를 작성해야한다. 우리 서비스의 기능 중 강조할만한 부분들까지 포함하여 시나리오를 markdown으로 작성해보고, 시연 방법까지 상세하게 작성한다.
```

## Prompt — 2026-09-15T06:21:54.262Z (backfill)

```text
1. AI 생성은 없음. (AI 기능 없을 예정 모두 수동)
2. 필수 Rule관련해서는 입력 어떻게함?
```

## Prompt — 2026-09-15T07:06:01.915Z (backfill)

```text
시나리오대로 사전 설정(목록·스키마 필드) 실제로 등록해줘
```

## Prompt — 2026-09-15T07:32:11.163Z (backfill)

```text
필수 Rule은 어디에 있는지?
```

## Prompt — 2026-09-15T07:33:42.372Z (backfill)

```text
등록해. 그리고 검증단계에서 사용할건데, AI를 미사용하므로, 우선 BPMN 검증 후, 필수 Rule을 체크리스트로 보여주고 해당 Rule을 선택 시, 속성값을 보여주면서 바로 확인 가능하도록 검증다이얼로그 개선.
```

## Prompt — 2026-09-15T08:13:58.766Z (backfill)

```text
1. 룰 모아보기 필요(RACI 모아보듯이, 검증과 같은 기능 해야함.)
2. 읽기모드에서도 속성패널 프로세스, Task, PI Flag 탭 전환 가능하도록.
```

<!-- backfilled-from: 2a09b8e6-b7db-40a5-b052-2f48c11daeb5 -->

## Prompt — 2026-09-16T03:02:57.506Z (backfill)

```text
- 사용 활성도 대시보드 부분에서 프로세스 uuid, 변경된 조직도를 기반으로 팀이 표시되지않음. 따라서 프로세스명, 유저의 팀명을 변경된 조직도를 기반 할 수 있도록 변경되어야함.
```

## Prompt — 2026-09-16T03:07:21.995Z (backfill)

```text
해당 작업 이어서 진행
```

## Prompt — 2026-09-16T03:11:44.681Z (backfill)

```text
2. 콘텐츠 생성 및 조회 활동이 2개씩 보이는 문제.
```

## Prompt — 2026-09-16T03:16:33.717Z (backfill)

```text
위 작업을 '/speckit-run'의 구조로 spec과 문서를 작성해.
```

## Prompt — 2026-09-16T03:16:45.893Z (backfill)

```text
위 작업을 '/speckit-run'의 구조로 spec과 이력를 작성해.
```

## Prompt — 2026-09-16T03:16:48.651Z (backfill)

```text
위 작업을 '/speckit-run'의 구조로 spec과 문서을 작성해.
```

<!-- backfilled-from: 172d6a8f-18e6-4786-b626-fc5459e30f59 -->

## Prompt — 2026-09-16T03:07:06.353Z (backfill)

```text
해당 작업 취
```

## Prompt — 2026-09-16T03:07:11.804Z (backfill)

```text
<task-notification>
<task-id>aae8d682630c128b3</task-id>
<tool-use-id>toolu_01Grj6Ac7BWp6jXYYDAjtFhS</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/172d6a8f-18e6-4786-b626-fc5459e30f59/tasks/aae8d682630c128b3.output</output-file>
<status>completed</status>
<summary>Agent "Map audit coverage: main pages" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Report below.

## 1. `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue` (1959 lines)

**Setup style:** `&lt;script setup lang="ts"&gt;` at line 558.
**adminConsole store:** imported L576, instantiated L588 (`const adminStore = useAdminConsoleStore()`).
**BackendFactory:** NOT imported directly — all persistence goes through `useProcessArchitecture()` composable (L561), which holds `backend` internally (`saveProcMap` at `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/useProcessArchitecture.ts:1385`, `saveMetricsMap` at :1406 — neither writes audit logs).

| # | Function (line) | What it does | Audit log? | Identifiers in scope |
|---|---|---|---|---|
| 1 | `enterEditMode` (663) | Acquires edit lock, enters proc-map edit mode | No | none beyond current user; lock owner `editLock.lockedBy` |
| 2 | `exitEditMode` (673) | Releases edit lock, exits edit mode | No | same |
| 3 | `saveDomainAdd` (791) | Creates new domain in metrics map, calls `saveMetricsMap(updated)` | No | `newId` (slugged name), `trimmedName`, full `domainsList` before/after |
| 4 | `handleOpenPermission` (756) | Opens PermissionDialog for a row (permission change happens inside child component) | No | `row.id`, `row.name`, `row.type` (domain/mega/major/sub) |
| 5 | `handleMoveSub` (1147) | Moves sub-process between majors, `saveProcMap(newMap)` | No | `subId`, `fromMajorId`, `toMajorId` |
| 6 | `handleMoveMajor` (1153) | Moves major process to a new stage/mega, `saveProcMap(newMap)` | No | `majorId`, `_megaId`, `newStage` |
| 7 | `saveEditProcess` (1223) | Add OR edit mega/major process (name, domain, mega re-parent) then `saveProcMap` + `loadData` | No | `editProcessDialog.value`: `mode`, `type`, `id` (or generated `newId` via `generateProcessId`), `name`, `domain`/`resolvedDomainId`, `megaId`, `originalMegaId`; old `procMap` clone available for before_value |
| 8 | `scheduleRestructureDraft` (1389) | Records cut-over job + schedules restructure draft | **Yes** — `action: 'restructure_draft_create'`, target_type `'system'`, target_id `` `cutover-${draft.id}` ``, target_name `draft.approvalTitle \|\| draft.summary \|\| draft.id` | (already covered) |
| 9 | `applyRestructureDraft` (1415) | Runs the cut-over job (`adminStore.runCutoverJob(jobId)`) — applies restructure to live map | **No** (gap: sibling #8 logs, this one doesn't) | `jobId = cutover-${draft.id}`, `draft.operation`, `draft.approvalTitle`, `draft.summary`, `draft.versionLabel`, blast-radius counts |
| 10 | `runExport` (1671) | Export/download: excel / pdf / png / json / mermaid; calls `downloadBlob` (1530) and `logExport` at L1816 | Partial — writes to Supabase `export_log` table via `logExport` (1639), **not** to admin audit log | `format`, `exportScope` ('visible'\|'full'), `rows.length` record count, `getTimestamp()` filename |
| 11 | `logExport` (1639) | Inserts export record into `export_log` (user_id, format, scope, record count) | No (separate table, not `admin_audit_log`) | same as above |
| 12 | `onProcessCreated` (1830) | Post-create handler from `NewProcessDialog`; routes to hierarchy editor + `loadData()` (actual insert is in child dialog) | No | `newProc.id`, `newProc.name` |
| 13 | `openSystemOperations` (1136) / `openReviewBoard` (1140) | Navigation only | No | `jobId` |

Data loads: `loadData()` comes from the composable (called at 1114-area onMounted and after mutations); `adminStore.fetchMaintenanceMode/loadCutoverJobs` L1114, `fetchKpiTargets` L1117.

## 2. `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ProcessReviewBoard.vue` (2111 lines)

**Setup style:** `&lt;script setup lang="ts"&gt;` at line 1.
**BackendFactory:** imported L6, `const backend = BackendFactory.createBackend()` L42.
**adminConsole store:** imported L8, `const adminStore = useAdminConsoleStore()` L43.

| # | Function (line) | What it does | Audit log? | Identifiers in scope |
|---|---|---|---|---|
| 1 | `handleBulkApprove` (543) | Loops `bulkApproveTargets`, calls `backend.approveHQ` / `backend.approveField` per item with comment '일괄 승인' | **No** | per-item `reviewId = item.review_id \|\| item.id \|\| item.proc_def_id`, `item.proc_def_id`, `item.process_name`, item count, success/error counts |
| 2 | `handleBulkReject` (589) | Prompts for reason, loops `backend.rejectDefinition(reviewId, reason)` | **No** | same per-item ids + `reason` (usable as comment) |
| 3 | `handleBulkPublish` (629) | Loops `backend.publishDefinition(reviewId, '일괄 배포')` — final publish, irreversible | **No** | same per-item ids |
| 4 | `openAdjustPublicFeedbackDialog` (678) | Opens dialog (no mutation) | No | `adminPublicFeedbackTarget` |
| 5 | `confirmAdjustPublicFeedback` (685) | `backend.adjustPublicFeedbackPeriod(reviewId, newEndsAtIso, reason)` | **Yes** (L703) — `action: 'admin_adjust_public_feedback_period'`, target_type `'public_feedback_review'`, target_id `target.proc_def_id \|\| reviewId`, target_name `target.process_name \|\| target.proc_def_id \|\| reviewId`, before/after `public_feedback_ends_at`, comment = reason | — |
| 6 | `openEndPublicFeedbackDialog` (725) | Opens dialog | No | — |
| 7 | `confirmEndPublicFeedback` (731) | `backend.adminEndPublicFeedback(reviewId, reason)` | **Yes** (L744) — `action: 'admin_end_public_feedback'`, same target_type/id/name pattern, before `state: 'public_feedback'` → after `state: 'final_edit'`, comment = reason | — |
| 8 | `loadData` (782) | Significant load: `getReviewBoardData`, `getMetricsMap`, `getProcessDefinitionMap({skipPermissionFilter:true})`, stage counts, owner names | No | board row count, tab/filter state |
| 9 | `loadStageCountsFromHierarchy` (805) | Loads definition statuses + proc map for stage counters | No | — |
| 10 | `openInEditor` (422) | Navigates to hierarchy editor for an item | No | `item.proc_def_id`, `item.process_name`, `item.review_id` |

No CSV/export functionality exists in this file. Items 1-3 (bulk approve/reject/publish) are the clearest audit-log gaps — note `adminStore` is already in scope, so adding logs requires no new imports.

## 3. `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ProcessReviewDetail.vue` (2358 lines)

**Setup style:** `&lt;script setup lang="ts"&gt;` at line 1.
**BackendFactory:** imported L6, `const backend = BackendFactory.createBackend()` L29.
**adminConsole store:** **NOT imported** — would need `import { useAdminConsoleStore } from '@/stores/adminConsole'`.

| # | Function (line) | What it does | Audit log? | Identifiers in scope |
|---|---|---|---|---|
| 1 | `handleApproveHQ` (580) | `backend.approveHQ(id, comment)` — stage-1/HQ approval | **No** | `id = approvalState.value?.id \|\| reviewId.value`, `approvalState.value.proc_def_id`, `processName.value`, `reviewVersion.value`, `comment.value`, `approvalState.value.state` before + after (`loadData(true)` refreshes) |
| 2 | `handleApproveField` (599) | `backend.approveField(id, comment)` — field approval | **No** | same as above |
| 3 | `handleEndPublicFeedback` (618) | `backend.endPublicFeedback(id, comment \|\| '공람 조기 종료')` — early-end public review | **No** | same; plus `totalFeedbackCount` / `unresolvedCount` |
| 4 | `handlePublish` (634) | `backend.publishDefinition(id, comment)` — final publish | **No** | same |
| 5 | `handleReject` (651) | `backend.rejectDefinition(id, comment)` — requires comment | **No** | same + rejection reason in `comment.value` |
| 6 | `handleCancel` (666) | `backend.cancelApproval(id, comment)` — cancels review | **No** | same |
| 7 | `openResolveDialog` (682) | Opens resolve dialog for a feedback entry | No | `entry.id` |
| 8 | `confirmResolve` (688) | Direct Supabase update on `proc_def_approval_history` (resolved, resolve_action_text, resolved_at, resolved_by) | **No** | `resolveTargetEntry.value.id`, `resolveActionText.value`, `currentUserName.value`, `approvalState.value.proc_def_id`, `processName.value` |
| 9 | `loadData` (453) | Significant load: approval state, history, metrics, BPMN, feedback counts, snapshots | No | `reviewId`, `procDefId`, `processName` |
| 10 | `loadBpmnData` (500) | Loads `proc_def.bpmn` + `proc_def_version` list for diff view | No | `procDefId`, `processName`, version list |
| 11 | `loadFeedbackCounts` (418) | Counts total/unresolved `proc_def_comments` | No | `procDefId` |
| 12 | `switchCompareMode` (213) | Switches published/previous/snapshot diff view | No | versions |
| 13 | `openInEditor` (713) | Navigates to hierarchy editor with reviewId | No | `procDefId`, `processName`, `approvalState.value.id` |

No CSV/export/download functionality in this file.

**Cross-file notes:** the canonical audit helper is `writeAdminAuditLog` at `/home/kimsanghoon/process-gpt-vue3/src/stores/adminConsole.ts:2091`, which wraps `backend.insertAdminAuditLog(entry)` (L2102); entry shape = `{ action, target_type, target_id, target_name, before_value?, after_value?, comment? }`. The only two view-level call sites that already follow the pattern in these three files are ProcessReviewBoard L703 and L744, plus ProcessArchitecture L1397.</result>
<usage><subagent_tokens>39233</subagent_tokens><tool_uses>11</tool_uses><duration_ms>82314</duration_ms></usage>
</task-notification>
```

<!-- backfilled-from: d93ea3d9-2606-4552-8a9c-41f04b6da5ad -->

## Prompt — 2026-09-16T03:06:44.472Z (backfill)

```text
/run-skill-generator 실행 된 프롬프트를 Speckit을 통해 spec을 정의하고 작업을 실행한다. 사용자가 입력 한 프롬프트는 해당 스펙에 작업이력으로 모두 수집하여 남긴다.
```

## Prompt — 2026-09-16T03:13:16.637Z (backfill)

```text
이미 작업 된 사항에 대해서도 위 스킬을 통해서 이력 저장이 가능한지?
```

## Prompt — 2026-09-16T03:14:38.459Z (backfill)

```text
해당 기능도 스킬로 만들어.
```

## Prompt — 2026-09-16T03:45:54.821Z (backfill)

```text
모든 세션에 대해서 프롬프트 이력 저장해두자.
```

<!-- backfilled-from: 1a4523e5-187a-4da7-b19d-dbbe3015b147 -->

## Prompt — 2026-09-16T03:20:35.237Z (backfill)

```text
<task-notification>
<task-id>a0139d447cc4fecff</task-id>
<tool-use-id>toolu_01J1ykh8sUyD1Uhc4YqrodMP</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/a0139d447cc4fecff.output</output-file>
<status>completed</status>
<summary>Agent "Explore audit logging code" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have a complete picture. Here is the report.

---

# Audit / Activity Logging Map — process-gpt-vue3

## 0. Context: a spec already exists for this task

- `/home/kimsanghoon/process-gpt-vue3/specs/002-activity-audit-logging/prompt-history.md` — contains the user's original prompt (dated 2026-09-16T03:15) listing exactly the pages to instrument and requesting `docs/logging/logging-test.md`.
- `/home/kimsanghoon/process-gpt-vue3/specs/002-activity-audit-logging/spec.md` — **still the unfilled Spec Kit template** (all placeholders, lines 1–132). Nothing has been written yet.
- `docs/logging/` **does not exist**.

---

## 1. Write mechanisms — there are FOUR separate log pipelines

### 1a. `public.admin_audit_log` — the "관리자 감사 로그" (this is the one the viewer's activity tab shows)

**Writer (single source of truth):** `/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts:251-283`

```ts
async insertAdminAuditLog(entry: {
    action: string;
    target_type: string;
    target_id?: string;
    target_name?: string;
    before_value?: any;
    after_value?: any;
    comment?: string;
}): Promise&lt;void&gt;
```

It resolves `actor_id` from `localStorage.employeeNo || localStorage.email || localStorage.uid || window.$user?.email || window.$user?.id || 'system'`, sets `tenant_id: window.$tenantName`, JSON-stringifies `before_value`/`after_value`, and **swallows all errors** (console.error only) — logging never breaks a flow. Note it is defined **only on `PalModeBackend`**, so logging is inherently PAL-only.

**Store wrapper (preferred call path):** `/home/kimsanghoon/process-gpt-vue3/src/stores/adminConsole.ts:2091-2106`

```ts
async writeAdminAuditLog(entry: {
    action: string; target_type: string; target_id?: string; target_name?: string;
    before_value?: any; after_value?: any; comment?: string;
})
```

**Canonical usage example** (`src/views/admin/tabs/PropertySchemaStudio.vue:1685-1692`):

```ts
adminStore.writeAdminAuditLog({
    action: isEdit ? 'schema_update' : 'schema_create',
    target_type: 'property_schema',
    target_id: payload.property_key,
    target_name: payload.property_label,
    before_value: beforeSnapshot,
    after_value: payload
});
```

**Domain-scoped wrapper example:** `/home/kimsanghoon/process-gpt-vue3/src/stores/systemManagement.ts:59-76` — `writeSystemAuditLog()` injects `target_type: 'system'` then delegates to `backend.insertAdminAuditLog`.

**Reader:** `PalModeBackend.ts:823-840` `getAdminAuditLogs(filters)` → filters `action`, `targetType`, `targetId`, `startDate`, `endDate`, paged; store action `adminConsole.ts:2108-2121` `fetchAdminAuditLogs`.

**Schema** (`supabase/migrations/20260403_admin_audit_log.sql` + `20260911000002_admin_audit_log_actor_enforcement.sql:50-52`):

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | text NOT NULL | |
| `actor_id` | text NOT NULL | **BEFORE INSERT trigger `enforce_admin_audit_log_actor` overwrites with `auth.uid()`** when a session exists; client value kept only for `service_role`/NULL uid |
| `actor_username`, `actor_org_name`, `actor_employee_no` | text | added 20260911, filled by the same trigger from `users` |
| `action` | text NOT NULL | |
| `target_type`, `target_id`, `target_name` | text | |
| `before_value`, `after_value` | text | JSON strings |
| `comment` | text | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Constraints worth knowing: **append-only** — `20260526_admin_audit_log_append_only.sql` enables RLS, SELECT policy = admin only, INSERT policy `WITH CHECK (true)`, plus `REVOKE UPDATE, DELETE ... FROM anon, authenticated, PUBLIC`. **There is no CHECK constraint on `action`/`target_type`** — new action codes can be added freely without a migration (only the UI label map needs updating). Retention/archival: `20260911000003_audit_log_retention.sql` creates `admin_audit_log_archive` / `auth_login_audit_archive`, `public.archive_expired_audit_logs()`, config key `audit_log_retention` (`{retention_days: 365}`), pg_cron job `audit-log-retention` daily 03:00.

### 1b. `public.app_usage_events` — usage analytics (automatic route tracking)

`/home/kimsanghoon/process-gpt-vue3/src/services/usageAnalytics.ts` (1061 lines, read in full).

- `recordUsageEvent(eventType, payload)` — **line 367**. Signature: `(eventType: UsageEventType, payload: UsageEventPayload = {})`; payload = `{ route?, procDefId?, modelId?, activeDurationMs?, metadata?, eventKey? }`. Inserts into `app_usage_events` (line 405). Drops the event entirely if no `user_id`/`email`/`employee_no` can be resolved (line 379). `eventKey` gives idempotency via unique index `idx_app_usage_events_event_key`.
- `startUsageTracking(router)` — **line 515**. Registers `router.afterEach` → `trackRouteUsage` (line 473) which emits `route_view` for every route (plus `model_view` when a procDefId is extractable), a 30 s `heartbeat`, `session_start`, `session_end` on pagehide. Skips `/auth*` and `/external-forms*` (line 427).
- **Event types are CHECK-constrained** (`supabase/migrations/20260421_usage_adoption_analytics.sql:36-46`): only `session_start, session_end, route_view, heartbeat, model_view, model_create, model_edit, model_save`. **Adding a new event type requires a migration.**
- Columns: `id, tenant_id, event_type, event_key, session_id, user_id, email, employee_no, user_name, department_id, department_name, org_code, org_name, route, proc_def_id, model_id, active_duration_ms, metadata jsonb, occurred_at, created_at`.
- Wired in `src/main.ts:420-422`: `if (window.$pal) { startUsageTracking(router); }`.
- Other writers: `src/services/bpmnModelService.ts:465` (`model_create`), `:565` (`model_edit`); `src/components/api/ProcessGPTBackend.ts:617`.
- Reader/dashboard: `getUsageAdoptionDashboard()` at line 722 → rendered by `src/views/admin/tabs/UsageAdoptionDashboard.vue`. **Note: this is a separate page from the audit trail and is NOT the "활동 로그" viewer.**

### 1c. `public.auth_login_audit` — login/logout/failure

Writer: `/home/kimsanghoon/process-gpt-vue3/src/utils/StorageBaseSupabase.js:37-59`

```js
async recordAuthAudit({ action, email, success, errorMessage, tenantId, metadata })
// -&gt; supabase.rpc('record_auth_audit', { p_action, p_email, p_success, p_error_message, p_tenant_id, p_metadata })
```
IP/User-Agent captured server-side by the SECURITY DEFINER RPC from `request.headers`. Migration `20260911000001_auth_audit_log.sql`. Actions allowed: `login | login_failed | logout | login_oauth`.

### 1d. `public.file_download_log` — downloads

Writer: `/home/kimsanghoon/process-gpt-vue3/src/shared/downloadAudit/index.js:52` — `recordFileDownload({ bucket, path, fileName, action, metadata, client })`, exports `DOWNLOAD_ACTIONS` (`download`, `signed_url`, `view`). Goes through RPC `record_file_download`. Migration `20260911000004_file_download_log.sql`. Tests at `src/shared/downloadAudit/downloadAudit.test.js`.

### 1e. Orphan: `export_log` (dead code)

`/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue:1639-1668` — `logExport(format, scope, recordCount)` inserts into a table `export_log`. **There is no migration anywhere under `supabase/` for `export_log`** (grep returns nothing), so this insert fails silently every time. This is an existing bug and an obvious candidate to redirect into `admin_audit_log`.

---

## 2. The viewer page: 감사로그 &gt; 활동 로그

**Route:** `/admin-console/audit-trail` → `src/router/MainRoutes.ts:580-588`, name `Admin Audit Trail`.
**Sidebar entry:** `src/layouts/full/vertical-sidebar/VerticalSidebar.vue:417` — `{ title: '감사 로그', icon: 'document', to: '/admin-console/audit-trail' }`.
**Menu def:** `src/utils/routePermissions.ts:210` — label `감사 로그`, `requiredRole: 'admin'`.
**Component:** `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/AuditTrail.vue` (2402 lines).

### Tab structure (`AuditTrail.vue:603-628`)

The file documents its own extension point at lines 592-602: to add a tab you edit `TAB_DEFS`, add matching keys in `tabLoaders`/`tabExporters`/`tabItems`, and add a `&lt;template v-else-if="activeTab === '&lt;key&gt;'"&gt;` block.

| tab key | label (ko) | source table | filters |
|---|---|---|---|
| `approval` | 승인 이력 | `proc_def_audit_log` (store `auditLogs`) | startDate, endDate, action, actorId |
| `admin` | 관리자 감사 로그 ← **this is the "활동 로그"** | `admin_audit_log` | startDate, endDate, adminAction, targetType, actorId |
| `login` | 로그인 이력 | `auth_login_audit` | startDate, endDate, email, loginAction, success |
| `download` | 다운로드 이력 | `file_download_log` | startDate, endDate, email, bucket |

Default tab is `admin` (line 630). Admin table headers (line 665-670): 일시 / 수행자 / 액션 / 변경 내역. Each tab has a CSV export (`exportAdminCsv` at line 1514, `downloadCsv` at 1585).

### Action vocabulary rendered/filterable

`ADMIN_ACTION_LABELS` — **`AuditTrail.vue:1003-1064`** (~55 codes). The filter dropdown is built from `Object.keys(ADMIN_ACTION_LABELS)` (line 1083), so **any action code not in this map is invisible in the filter dropdown and renders with an empty label**. Existing families: `schema_*`, `process_*`, `system_*`, `instance_hard_delete`, `permission_change`, `menu_permission_change`, `account_unlock`, `maintenance_toggle`, `notice_banner_update`, `restructure_*`, `audit_policy_*`, `admin_*_public_feedback`, `kpi_target_*`, `pi_flag_type_*`, `lane_role_group_*`, `supplier_*`, `data_freeze_lock/unlock`, `task_api_integration_change`, `task_manual_link_change`, `task_type_visibility_update`, `event_type_visibility_update`.

**Naming convention:** `&lt;resource&gt;_&lt;verb&gt;` snake_case, verb vocabulary = `create | update | soft_delete | restore | hard_delete | activate | deactivate | change | toggle | update`. **There is currently no `*_view`/`*_read`/`*_export`/`*_download` action anywhere** — view/export logging is entirely absent from this table.

Two codes are written but **missing from the label map** (they will render blank): `audit_retention_update` (`adminConsole.ts:1736`) and `security_settings_update` (`adminConsole.ts:1783`). Worth fixing while you're in there.

`TARGET_TYPE_LABELS` — **`AuditTrail.vue:1066-1080`**: `property_schema, process, permission, system, audit_policy, custom_permission, kpi_target, pi_flag_type, lane_role_group, supplier, data_freeze, task_event_type, task`. Same gating: unknown target types show an empty label and are absent from the filter dropdown.

`CHANGE_KEY_LABELS` — `AuditTrail.vue:1094-1168`: maps before/after JSON keys to Korean labels for the "변경 내역" column. New payload keys need entries here to render nicely.

`PROCESS_LINKABLE_TARGET_TYPES` — `AuditTrail.vue:554-559`: `public_feedback_review, process, process_definition, proc_def`. Rows with these target types get a click-through to the BPMN viewer.

**Separate, unrelated component:** `src/components/ui/AuditLogViewer.vue` is a per-process approval-history dialog used only by `src/components/ui/ApprovalStatePanel.vue:335`. Not the admin console page.

---

## 3. Existing call sites (complete inventory)

### 프로세스 순서도 (BPMN flowchart) — `src/views/process-hierarchy/`
- `ProcessHierarchy.vue:3831` → `process_soft_delete` / `process` (direct `backend.insertAdminAuditLog`)
- `ProcessHierarchy.vue:4279` → `process_update` / `process`
- `ProcessHierarchy.vue:4450` → `task_api_integration_change` / `task`
- `ProcessHierarchy.vue:4462` → `task_manual_link_change` / `task`
- `ProcessHierarchyProperties.vue:7811` → `process_update` / `process` (owner change, with `comment`)
- `ProcessHierarchyProperties.vue:8499` → `process_parent_change` / `process`
- `ProcessHierarchyProperties.vue:7660`, `:7685` → **reads** `getAdminAuditLogs` (owner-change history panel)

### 속성 스키마 관리 — `src/views/admin/tabs/PropertySchemaStudio.vue`
7 sites: `:1685` (`schema_create`/`schema_update`), `:1719`, `:1763`, `:1785`, `:1803`, `:1854`, `:2022` — covering activate/deactivate, soft delete, restore, hard delete. All via `adminStore.writeAdminAuditLog`, `target_type: 'property_schema'`.

### 관리자 보안 설정 — `src/views/admin/tabs/SecuritySettings.vue`
The view itself has **no** direct calls; the store does. `src/stores/adminConsole.ts:1782-1790` `saveSecurityPolicy()` → `security_settings_update` / `system`, `target_id = config key`, before/after objects. Also `adminConsole.ts:1735` → `audit_retention_update`. View's save functions: `runSave` (:529), `saveSession` (:542), `saveLockout` (:552), `saveMfa` (:563), `saveDownload` (:567), `saveRetention` (:574).

### Task 종류관리 — `src/stores/taskCatalog.ts`
- `:793` `setTaskTypeVisible()` → `task_type_visibility_update` / `task_event_type`
- `:827` `setEventTypeVisible()` → `event_type_visibility_update` / `task_event_type`
- `:885` `togglePaletteTaskType()` → `task_type_visibility_update` / `task_event_type`

### Additional sites the user didn't mention (already logging)
- `src/stores/adminConsole.ts` — **32 call sites**: `:634/659` data_freeze, `:720/742` process restore/purge, `:779` instance purge, `:869/899` lane_role_group, `:967/1000` supplier, `:1054/1078` system, `:1126/1150` schema, `:1220/1257` audit_policy, `:1439/1454/1513/1549/1581` kpi_target, `:1622` notice_banner, `:1670` maintenance_toggle, `:1735` retention, `:1782` security, `:1970/1992/2041/2058` restructure.
- `src/stores/systemManagement.ts:135`, `:161` — system create/update/soft_delete.
- `src/views/policy-document/PolicyDocumentManager.vue:350`, `:413`, `:621`
- `src/views/admin/tabs/PiFlagTypeManager.vue:270`, `:302`
- `src/views/admin/tabs/OptionListManagement.vue:331`, `:360`
- `src/views/admin/tabs/RecycleBin.vue:572`
- `src/views/review-board/ProcessReviewBoard.vue:703` (`admin_adjust_public_feedback_period`), `:744` (`admin_end_public_feedback`)
- `src/views/process-architecture/ProcessArchitecture.vue:1397` (`restructure_draft_create`)

---

## 4. Per-page instrumentation targets

Route definitions: `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts`. `src/router/index.ts` (284 lines) only assembles `MainRoutes` + `AuthRoutes` + `TenantRoutes` and holds guards. **Everything below line 453 in MainRoutes is inside a `...(window.$pal ? [ ... ] : [])` spread** — i.e. these routes only exist in PAL mode.

| Route | Line | Component | Operations needing log calls |
|---|---|---|---|
| `/process-architecture` | `MainRoutes.ts:445` | `src/views/process-architecture/ProcessArchitecture.vue` (1959) | **view/load** (none today); `saveDomainAdd` :791; `handleMoveSub` :1147; `handleMoveMajor` :1153; `saveEditProcess` :1223; `onProcessCreated` :1830; `runExport` :1671 + broken `logExport` :1639 (excel/pdf/png); `applyRestructureDraft` :1415. Only `scheduleRestructureDraft` :1397 logs today. |
| `/review-board` | `MainRoutes.ts:690` | `src/views/review-board/ProcessReviewBoard.vue` (2111) | **view/load** `loadData` :782, `loadStageCountsFromHierarchy` :805; `handleBulkApprove` :543; `handleBulkReject` :589; `handleBulkPublish` :629. Only the two public-feedback admin actions (:703, :744) log today. |
| `/review-board/restructure` | `:697` | `RestructureApprovalBoard.vue` | approve/reject (store logs `restructure_approve/reject` at adminConsole `:1970/:1992`); view not logged |
| `/review-board/:reviewId` | `:709` | `ProcessReviewDetail.vue` | view |
| `/call-activity-management` | `:502` | `src/views/admin/tabs/CallActivityManagement.vue` (654) | `loadData` :365 (view); `confirmDelete` :478 (delete); `applySearch` :306. **Zero logging today.** |
| `/glossary` | `:468` | `src/views/glossary/GlossaryDictionary.vue` (261) | `reload`/`store.loadAllTerms(true)` :128, :131 (view only — this page is read-only). Writes live in `src/stores/glossary.ts:64 saveTerm`, `:73 deleteTerm`, called from `ProcessHierarchyProperties.vue:10746/10785/10801` and `src/components/pages/account-settings/GlossaryManageTab.vue:393/425`. **Zero logging today.** |
| `/organization` | `:93` | `src/views/organization/OrganizationChartView.vue` (1595) — PAL only; non-PAL falls back to `OrganizationChartChat.vue` | `loadUsers` :573, `loadPendingMembers` :602, `loadChart` :626 (view); `scheduleSave` :674; `handleDrop` :847; `commitAddTeam` :892; `commitRemoveTeam` :917; `onUpdateTeam` :940; `onAddMembers` :1028; `onRemoveMember` :1044; `applyRole` :1092; `onUpdateRole` :1123; `onUpdateRoles` :1133; `onAgentDialogSubmit` :1201; `onUserDeleted` :1302; `onAgentDeleted` :1306; `onAgentAdded` :1312. **Zero logging today** — note `permission_change`/`menu_permission_change` labels exist in the viewer but **nothing writes them**. |
| `/organization-before` | `:113` | `OrganizationChartBeforeView.vue` | view |
| `/admin-request` | `:101` | `src/views/organization/RoleRequestPage.vue` (67) | `load` :20 (view); `submit` :30 (role request). Backed by `src/services/membershipService.ts` — `requestRole` :44, `reviewRequest` :48. **Zero logging today.** |
| `/analysis-dashboard` | `:462` | `src/views/analytics/AnalysisDashboard.vue` (777) | `fetchTabs` :80, `fetchOrgList` :93 (view); `onSettingsSaved` :187; `applyCustomDateRange` :210; `refreshOperationalBoard` :237. Persistence via `src/services/dashboardSettingsService.ts` — `saveTabs` :202, `saveTabGroups` :233. No export/download in this file. **Zero logging today.** |

### `/admin-console` children (`MainRoutes.ts:510-645`, parent `src/views/admin/AdminConsoleLayout.vue`, redirect → `property-schemas`)

| Path | Line | Component | Ops | Logs today |
|---|---|---|---|---|
| `property-schemas` | :516 | `admin/tabs/PropertySchemaStudio.vue` (2904) | `loadSchemas` :1471, `saveField` :1603, `toggleSchemaVisibility` :1713, `executeSoftDelete` :1756, `executeHardDelete` :1847, `exportTemplate` :1932, `loadOptionLists` :2042 | ✅ CUD only; **no view, no export** |
| `option-lists` | :525 | `admin/tabs/OptionListManagement.vue` (713) | `load` :215, `saveList` :302, `executeDelete` :354 | ✅ save/delete; no view |
| `data-freeze` | :534 | `admin/tabs/DataFreezeManager.vue` (753) | `loadMapData` :198, toggles :337-361 | ✅ lock/unlock via store; no view |
| `recycle-bin` | :543 | `admin/tabs/RecycleBin.vue` (1288) | `hardDeleteItem` :561, `handleRestore` :593, `handleBulkRestore` :621, `purgeExpiredItems` :679 | ✅ partial (:572 + store); no view |
| `system-operations` | :552 | `admin/tabs/SystemOperations.vue` (1376) | `saveBanner` :522, `onMaintenanceToggle` :531 | ✅ via store; no view |
| `security-settings` | :561 | `admin/tabs/SecuritySettings.vue` (775) | `saveSession/Lockout/Mfa/Download/Retention` :542-574 | ✅ via store; no view |
| `kpi-targets` | :570 | `admin/tabs/KpiIndicatorManager.vue` (424) | `load` :294, `save` :331, `remove` :363 | ✅ via store; no view |
| `usage-adoption` | :579 | `admin/tabs/UsageAdoptionDashboard.vue` (637) | `refresh` :243 | ❌ none |
| `audit-trail` | :588 | `admin/tabs/AuditTrail.vue` (2402) | `loadLogs` :814, `loadFileDownloadLog` :731, `loadLockedAccounts` :860, `exportApprovalCsv` :1499 / `exportAdminCsv` :1514 / `exportLoginCsv` :1528 / `exportDownloadCsv` :1560, account unlock | ❌ none from the UI (unlock is logged server-side by the RPC as `account_unlock`). **Careful: logging views of this page will feed itself.** |
| `exec-instances` | :597 | `admin/tabs/ExecInstanceAdmin.vue` (51) — thin wrapper over `components/ui/list-pages/InstanceListPage.vue` | list load | ❌ none |
| `governance-studio` | :606 | `views/governance-studio/DataGovernanceStudio.vue` (361) | `addBlacklist` :124, `removeBlacklist` :131 | ❌ none |
| `pi-flags` | :615 | `admin/tabs/PiFlagPage.vue` (74) — tabs over `PiFlagBoard.vue` + `PiFlagTypeManager.vue` | board load; type CRUD | ✅ `PiFlagTypeManager.vue:270/302` only |
| `task-types` | :626 | `admin/tabs/TaskTypeManagement.vue` (25) — wrapper over `src/components/admin/TaskTypeSettings.vue` | toggles | ✅ via `taskCatalog.ts` |
| `task-catalog` | :636 | `admin/tabs/TaskCatalogPage.vue` (27) — wrapper over `src/components/admin/TaskCatalogList.vue` | catalog CRUD | ❌ none |

**Dead menu entries:** `src/utils/routePermissions.ts:258` (`/admin-console/suppliers`) and `:265` (`/admin-console/organization-dmn-rules`) appear in `MENU_DEFINITIONS` but **have no route in `MainRoutes.ts`**. Confirmed by grep — no component exists for them.

**Useful for a `page`/label field:** `MENU_DEFINITIONS` in `src/utils/routePermissions.ts:61-336` gives an authoritative `path → 한글 label` mapping (e.g. `/process-architecture` → `프로세스 체계도`, `/call-activity-management` → `프로세스 목록`, `/glossary` → `용어 사전`, `/admin-request` → `권한 변경 신청`). `lookupMinRole` :372 / `lookupRequiredRole` :388 use `matchByPath` :357 for prefix matching — reusable for resolving the current page name from a route path.

---

## 5. Login logging

`/home/kimsanghoon/process-gpt-vue3/src/stores/auth.ts` (191 lines) has **no logging at all**. Its actions delegate to `storage` (`StorageBaseFactory.getStorage()`): `logout()` :17, `signInWithKeycloak()` :29, `signIn()` :45, `signUp()` :80, `resetPassword()` :142, `updatePassword()` :156.

Login **is** already logged — one layer down, in `/home/kimsanghoon/process-gpt-vue3/src/utils/StorageBaseSupabase.js`:

| site | action | success |
|---|---|---|
| `:293` | `login` | true, `metadata: { method: 'password' }` |
| `:303` | `login` | false, `reason: 'email_not_confirmed'` |
| `:320` | `login` | false, generic credential failure |
| `:339` | `login` | false, `reason: 'not_registered_email'` |
| `:372` | `login_oauth` | false (keycloak error) |
| `:381` | `login_oauth` | true (redirect started) |
| `:440` | `logout` | true, `metadata: { source: 'StorageBaseSupabase.signOut' }` |

→ these land in `auth_login_audit`, shown on the **로그인 이력** tab, **not** the 활동 로그 (admin) tab. `signUp`, `resetPassword`, `updatePassword` are **not** logged anywhere. If the requirement is "login appears in 활동 로그", you either add a mirrored `admin_audit_log` row or merge the two sources in the viewer.

---

## 6. PAL-mode gating

`/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` (13 lines) — evaluated first thing in `src/main.ts:8`:

```ts
const runtimePalMode = (window as any)._env_?.VITE_PAL_MODE;
const buildPalMode = import.meta.env.VITE_PAL_MODE;
const enabled = runtimePalMode === true || runtimePalMode === 'true' || buildPalMode === 'true';
Object.defineProperty(window, '$pal', { value: enabled, writable: false, configurable: false });
```

Three gating layers already exist, all keyed on `window.$pal`:
1. **Backend selection** — `src/components/api/BackendFactory.ts:117-127`: `pal &amp;&amp; mode === 'uEngine'` → `PalUengineBackend`; `pal` → `PalModeBackend`; otherwise `UEngineBackend`/`ProcessGPTBackend`. Since `insertAdminAuditLog` exists **only on `PalModeBackend`**, calls from non-PAL backends would be `undefined` — but `wrapBackendWithNullSkip` proxies missing methods and returns a default rather than throwing, so a bare `backend.insertAdminAuditLog(...)` is survivable. The `adminConsole.writeAdminAuditLog` wrapper also try/catches.
2. **Routes** — the `...(window.$pal ? [...] : [])` spreads in `MainRoutes.ts:453`, `:625` (admin-console block) and `:691` (review-board extensions).
3. **Usage tracking** — `src/main.ts:420-422`.

So the idiomatic gate for anything new is `if (window.$pal) { ... }`, or simply routing through `adminConsole.writeAdminAuditLog` which is already PAL-safe.

---

## 7. Existing docs

No `docs/logging/`. Relevant existing docs:

- `docs/security.md` — the design record for the whole audit stack. Line 26-34 (auth audit log + AuditTrail login tab), 38-42 (**actor_id forgery prevention, item 16**), 92-95 (lockout panel), 102-116 (`record_file_download` RPC conventions — explicitly states "예외는 삼켜 다운로드 흐름을 깨지 않는다. `record_auth_audit`과 같은 관례"), 158 (retention days), 179 (tab structure designed to be extensible).
- `docs/pal-migration/README.md:32` — admin console tab inventory incl. 감사로그.
- `docs/pal-migration/10-shared-infra.md:19,30` — admin-console children route list and sidebar menu definition rules.
- `docs/pal-migration/04-admin-console.md`, `05-usage-analytics.md` — per-feature migration notes.
- `docs/security-test-guide.md`, `docs/security-gotrue-*.md` — the existing manual-test-guide format, a good template for the requested `docs/logging/logging-test.md`.
- `docs/demo-p543-internal-audit-scenario.md` — note: "internal audit" here is a *business process* demo (P5.4.3 내부심사), unrelated to audit logging.

---

## 8. Practical notes for implementation

1. **The write path is already uniform** — `adminStore.writeAdminAuditLog(entry)`. There's no need for a new service; the gap is purely missing call sites plus missing label-map entries.
2. **View logging is a brand-new category.** No `*_view` action exists. Either (a) add `&lt;resource&gt;_view` codes to `ADMIN_ACTION_LABELS` at `AuditTrail.vue:1003`, or (b) surface the already-captured `app_usage_events.route_view` rows in the viewer. Option (b) requires no new writes at all — `startUsageTracking` already records every route change in PAL mode — but needs a new tab/loader in `TAB_DEFS`. Option (a) is more consistent with how the admin tab renders, but will substantially increase `admin_audit_log` volume against a 365-day retention policy.
3. **Every new `action` and `target_type` string must be added to `ADMIN_ACTION_LABELS` (:1003) and `TARGET_TYPE_LABELS` (:1066)**, otherwise rows render with a blank action label and are unreachable from the filter dropdowns. New before/after payload keys should also go into `CHANGE_KEY_LABELS` (:1094).
4. **No DB migration is needed for `admin_audit_log`** (no CHECK on action/target_type). A migration **is** needed if you want new `app_usage_events.event_type` values.
5. Two already-written actions are missing labels today: `audit_retention_update` and `security_settings_update`.
6. `export_log` in `ProcessArchitecture.vue:1639` is dead — redirect it to `admin_audit_log`.</result>
<usage><subagent_tokens>116121</subagent_tokens><tool_uses>49</tool_uses><duration_ms>294859</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-16T03:26:49.680Z (backfill)

```text
<task-notification>
<task-id>a541aab07b9a483bd</task-id>
<tool-use-id>toolu_01CHMXqmiQdd4fAWCFoaQ1R7</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/a541aab07b9a483bd.output</output-file>
<status>completed</status>
<summary>Agent "Instrument ProcessArchitecture logging" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>All edits complete. Report by task:

**Task 1 — logExport rewrite (lines ~1699–1708, was ~1639–1669).** Replaced the entire body (dead `export_log` Supabase insert plus its CREATE TABLE comment block) with a fire-and-forget `adminStore.writeAdminAuditLog` call using action `process_architecture_export`, `target_type: 'process'`, `target_id: format`, `target_name: '프로세스 체계도'`, `after_value: { format, scope, record_count: recordCount }`. Signature and the `runExport` call site untouched. Zero `export_log` references remain.

**Task 2 — saveDomainAdd (lines 818–825).** After `saveMetricsMap` succeeds, logs `process_domain_create` with `target_id: newId` (the generated domain id) and `target_name: trimmedName`. Inside the existing try, after the dialog closes; failure path unchanged.

**Task 3 — handleMoveSub (lines 1158–1172) and handleMoveMajor (lines 1176–1190).** Both log `process_parent_change` after `saveProcMap` succeeds. Sub: `before_value: { parent: fromMajorId }`, `after_value: { parent: toMajorId }`; name resolved by searching the saved map (falls back to the id). Major: `before_value: { parent: _megaId }`, `after_value: { parent: newStage }` — note the handler receives a `newStage` string (stage, not a mega id) per its existing signature, so that's what goes in `after_value.parent`.

**Task 4 — saveEditProcess (before-snapshot at lines 1266–1281; log at lines 1384–1394).** Captures a cheap before snapshot from the cloned map prior to mutation (mega: `{ name }`; major: `{ name, domain, mega_id }`), then after `saveProcMap` logs `process_update` with `target_id: d.id`, `target_name: d.name.trim()`, `before_value` (spread-omitted when not found), and a matching `after_value`. Only the edit path logs — the add-mode branch returns earlier and was left unlogged (add via this dialog wasn't in scope; process creation is covered by Task 5's separate flow).

**Task 5 — onProcessCreated (lines 1869–1876).** Logs `process_create` with `newProc.id`/`newProc.name` fire-and-forget before the router navigation. (This callback fires only after the child dialog has successfully created the process, so it is the success point.)

**Task 6 — applyRestructureDraft: NO edit made (finding only).** Confirmed in `/home/kimsanghoon/process-gpt-vue3/src/stores/adminConsole.ts`: `runCutoverJob` already writes `restructure_apply` (line ~2041, on success) and `restructure_apply_failed` (line ~2058, in its catch) via `this.writeAdminAuditLog`. `applyRestructureDraft` in the Vue file calls `adminStore.runCutoverJob(jobId)` directly, so adding a log there would duplicate. Left untouched.

All calls are fire-and-forget (no `await`); `writeAdminAuditLog` also catches internally (adminConsole.ts:2100–2105), so logging can never break a flow. Korean comments match file style; only `src/views/process-architecture/ProcessArchitecture.vue` was modified. No deviations beyond the two noted (newStage-as-parent in Task 3, edit-path-only logging in Task 4).</result>
<usage><subagent_tokens>45682</subagent_tokens><tool_uses>15</tool_uses><duration_ms>108934</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-16T03:27:22.627Z (backfill)

```text
<task-notification>
<task-id>aa33691fb506f9c1b</task-id>
<tool-use-id>toolu_015i2CQURkNp1QpSxVDfEL3K</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/aa33691fb506f9c1b.output</output-file>
<status>completed</status>
<summary>Agent "Instrument task catalog + governance + schema export" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>All edits complete. Summary of what was done:

**A) Task 카탈로그 CRUD — logged at the STORE level** in `/home/kimsanghoon/process-gpt-vue3/src/stores/taskCatalog.ts` (not in TaskCatalogList/TaskCatalogDialog). Reason: `saveCatalogItem` is called from TaskCatalogDialog.vue:383 and `deleteCatalogItem` from TaskCatalogList.vue:244 (and potentially other entry points such as the properties-panel registration dialog reuse), so store-level logging covers all callers with one call site — and the store already logs visibility toggles via `useAdminConsoleStore().writeAdminAuditLog` at ~:817/:851/:909, so this matches its existing pattern.

- `saveCatalogItem` (edit around lines 540–568; log call at :557): captures a before-snapshot from `this.catalogItems` prior to save; create vs update distinguished by prior existence (`item.id` — TaskCatalogDialog passes `id: props.item?.id`, undefined on create). Logs `task_catalog_create` / `task_catalog_update`, `target_type: 'task_catalog'`, `target_id: saved.id`, `target_name: saved.name || saved.display_name`, `before_value` (snapshot or null), `after_value: saved`. Logged after backend save + state update succeed, before `return saved`.
- `deleteCatalogItem` (edit around lines 574–595; log call at :585): snapshot taken before deletion, logs `task_catalog_delete` with `before_value: {...before}`, `after_value: null`, after backend delete succeeds.
- Flow safety: `writeAdminAuditLog` in adminConsole.ts (:2091) swallows its own errors internally, so the awaited calls cannot break the CRUD flow.

**B) `/home/kimsanghoon/process-gpt-vue3/src/views/governance-studio/DataGovernanceStudio.vue`** — this file has no store usage (pure local refs), so I used the store-less path: added `import { writeActivityLog } from '@/services/activityAuditLog';` at line 4 (PAL-gated, fire-and-forget).
- `addBlacklist` (log at :131): `governance_blacklist_add`, `target_type: 'governance'`, `target_id`/`target_name` = the blacklisted term; called only after the guard passes and the item is added.
- `removeBlacklist` (log at :142): `governance_blacklist_remove`, same shape.

**C) `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/PropertySchemaStudio.vue`** — `exportTemplate` (log at :1955, after the download is triggered and the object URL revoked): uses the file's existing `adminStore.writeAdminAuditLog` pattern with `action: 'schema_export'`, `target_type: 'property_schema'`, `target_name: '스키마 템플릿'`, `after_value: { count: fields.length }` (the exported field/row count already computed in the function). `adminStore` is in scope (declared at :907 in the same setup).

**Action codes wired (exact spellings):** `task_catalog_create`, `task_catalog_update`, `task_catalog_delete`, `governance_blacklist_add`, `governance_blacklist_remove`, `schema_export`; target_types `task_catalog`, `governance`, `property_schema`.

**Deviations:** none of substance. One judgment call: in the store, create/update is decided by `!!item.id` (prior existence as passed by callers) rather than probing the backend — cheap and correct for all current call paths; the before-snapshot additionally comes from the in-memory list when available. Korean comments added to match each file's style. No builds run; no other files touched (task system CRUD in the same store was deliberately left unlogged, as the task scoped logging to catalog entries only).</result>
<usage><subagent_tokens>47604</subagent_tokens><tool_uses>20</tool_uses><duration_ms>97541</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-16T03:29:39.801Z (backfill)

```text
<task-notification>
<task-id>a4f0ce65444f2186d</task-id>
<tool-use-id>toolu_01V988yE7RBsvwBkDyBmdMot</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/a4f0ce65444f2186d.output</output-file>
<status>completed</status>
<summary>Agent "Instrument organization chart logging" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Done. All changes are confined to `/home/kimsanghoon/process-gpt-vue3/src/views/organization/OrganizationChartView.vue` (the diff-stat includes some pre-existing uncommitted edits to this file from the working tree; my additions are the logging code below).

## What was added, and where (final line numbers)

**Infrastructure** (matches file style, Korean comments):
- :389 — `import { writeActivityLog } from '@/services/activityAuditLog';`
- :674–687 — new "활동 로그" section: module flag `saveCoveredByActionLog` + helper `logOrgActivity(entry, coversSave = true)` that stamps `target_type: 'organization'`, writes the log, and (by default) marks the next persist as already-covered.
- :706–708, :717 — in `persist()`: after successful `putObject`, logs `org_chart_update` (target_name '조직도') only when `!saveCoveredByActionLog`; the flag resets in `finally` so each save cycle is judged independently.

**Per-action call sites** (all log after the local mutation / backend call succeeds, fire-and-forget, never in the failure path):
- :889 `handleDrop` (member branch) → `org_member_assign`, after_value `{ members:[name], team }`, comment '드래그 이동'
- :936 `commitAddTeam` → `org_team_create` (target_id = team.id, target_name = name)
- :955 `commitRemoveTeam` → `org_team_delete`, before_value `{ memberCount }`
- :992 `onUpdateTeam` → `org_team_update`, with cheap before/after built from only the changed `patch` keys (name read from `target.name`)
- :1093 `onAddMembers` → `org_member_assign`, after_value `{ members:[names], team }`
- :1111 `onRemoveMember` → `org_member_remove`, before_value `{ team }`
- :1180 `applyRole` (success path, before `return true`) → `org_role_update` with before/after role. `onUpdateRole` and `onUpdateRoles` were deliberately NOT instrumented — both delegate to `applyRole`, so the single site logs once per user for both single and bulk changes.
- :1293 `onAgentDialogSubmit` delete branch → `org_agent_delete` (after `backend.deleteAgent` succeeds)
- :1383 `onUserDeleted` → `org_user_delete`; `coversSave` is passed as the `removed` boolean so the flag is only set when a chart save was actually scheduled
- :1396 `onAgentDeleted` → `org_agent_delete`, but only inside the `removeNodeEverywhere(...)` branch
- :1404 `onAgentAdded(agent)` → `org_agent_create` (now accepts the mitt payload — `AgentCrudMixin` emits `'agentAdded'` with the new agent object)

## Double-logging avoidance
1. **Save path vs specific actions**: every specific log sets `saveCoveredByActionLog`; the debounced `persist()` skips the generic `org_chart_update` when the flag is set and resets it in `finally`. So the generic log fires only for changes with no specific code: team drag-move, `onMoveTeam`, `onSetLeader`, agent edits, member pre-registration, `onMoveMember` — exactly the "not covered by a specific action" fallback the task allowed. Rapid actions coalesced into one debounce produce N specific logs and zero generic ones.
2. **Agent delete**: the dialog path removes the node before emitting `agentDeleted`, so the eventBus handler's `removeNodeEverywhere` returns false and its log (guarded inside that if) never fires for self-initiated deletes; it only fires for deletions initiated elsewhere while the agent was still in the chart.
3. **Agent create**: `onAgentAdded` (fires exactly once per creation, with or without team assignment) is the single log site; `onAgentAssigned` gets no log — its chart save is suppressed as covered by the create log. Known minor trade-off: a create without team assignment sets the flag with no save pending, which could suppress one later generic entry; harmless and commented.
4. **Roles**: single site in `applyRole` covers both single and bulk paths.

## Deviations from the brief
- `onUpdateRole`/`onUpdateRoles` exist but were intentionally left as-is (logging lives in shared `applyRole`).
- `onAgentDialogSubmit` is actually the agent **edit/delete** dialog, not creation — creation flows through `AgentCreateDialog` → eventBus `agentAdded` → `onAgentAdded`, so `org_agent_create` lives there; the dialog's non-delete branch (edit) has no reserved action code and is covered by generic `org_chart_update`.
- Role/membership **requests** are not submitted from this file — membership approval lives in the separate `MembershipApprovalPanel.vue` component (rendered by this view but its own file), which I did not edit per instructions.

No builds were run; a syntax parse check of the `&lt;script setup&gt;` block passed.</result>
<usage><subagent_tokens>61047</subagent_tokens><tool_uses>24</tool_uses><duration_ms>246531</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-16T03:48:59+00:00

```text
프로세스 순서도에 대한 로그는 정상적으로 쌓이지않음.
```

## Prompt — 2026-09-16T04:33:14+00:00

```text
단순 프로세스 조회시에도, proc_id, proc_name 으로 뜸
```

<!-- backfilled-from: 5cef9567-a8ef-4b25-a043-c17a06675e4d -->

## Prompt — 2026-09-16T04:35:00+00:00

```text
그 BpmnUengine 초기 import 에러도 정리해줘
```

## Prompt — 2026-09-16T05:04:30+00:00

```text
스크린샷을 현재 환경에서 남기면서 실행 될 수 있는지 확인해봐.
```

<!-- backfilled-from: a68d283e-c0fd-4b3c-959a-3bda893227bf -->

## Prompt — 2026-09-16T05:36:31+00:00

```text
현재 환경이 VM Instance인데 Mac에서 IDE로 연결해서 볼 수 있는 방법?
```

## Prompt — 2026-09-16T05:44:00+00:00

```text
해당 경로에 파일이 없는데?
```

<!-- backfilled-from: 27edaa1e-22ba-4273-90bf-933074c83d34 -->

## Prompt — 2026-09-16T05:47:47+00:00

```text
/run-skill-generator 추가된 기능에 대한 메뉴얼을 markdown으로 작성하는 스킬 생성해. 일반 신규 유저들이 순서대로 따라 할 수 있는 시나리오를 기준으로 시나리오 설명, 기능 사용 방법 등을 스크린샷과 함께 작성하도록해. 그리고 해당 스킬은 speckit-run 스킬 동작 이후에는 무조건 동작하도록 설정해.
```

## Prompt — 2026-09-16T06:18:36+00:00

```text
/admin-console/task-catalog임.
```

## Prompt — 2026-09-16T06:20:30+00:00

```text
8088로 접근해서 사용하면 안됨? 왜 새로 띄워서 실행하는지?
```

<!-- backfilled-from: 378cc188-841b-4095-badb-186b8161fae9 -->

## Prompt — 2026-09-16T06:25:12+00:00

```text
프로세스 목록 설명이 너무 길어서 다른 레이아웃 잡아먹음.
```

## Prompt — 2026-09-16T06:27:23+00:00

```text
<task-notification>
<task-id>aa94fea397d9ceaed</task-id>
<tool-use-id>toolu_01JgxCFB66vxqykFmLFrAFSh</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/d93ea3d9-2606-4552-8a9c-41f04b6da5ad/tasks/aa94fea397d9ceaed.output</output-file>
<status>completed</status>
<summary>Agent "프로세스 목록 설명 UI 찾기" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Findings.

## 1. 주 후보 — "프로세스 목록" 화면 (PAL 모드 사이드바 메뉴)

**`/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/CallActivityManagement.vue`**

이게 사용자가 말하는 그 화면이 거의 확실합니다. 근거:
- `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/vertical-sidebar/VerticalSidebar.vue:819` — PAL 모드일 때만 `title: '프로세스 목록', to: '/call-activity-management'` 메뉴 노출 (주석: "PAL 모드에서는 내 수신함 대신 프로세스 목록을 표시한다")
- `/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts:101` — `path: '/call-activity-management', label: '프로세스 목록'`
- `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts:502-503` — 해당 경로가 `CallActivityManagement.vue` 로 매핑
- 파일 7번째 줄 `&lt;h1 class="page-title"&gt;프로세스 목록&lt;/h1&gt;`

### description 표시 위치
`CallActivityManagement.vue:99-102`
```vue
&lt;template v-slot:[`item.description`]="{ item }"&gt;
    &lt;span v-if="item.description" class="cell-description" :title="item.description"&gt;{{ item.description }}&lt;/span&gt;
    &lt;span v-else class="cell-muted"&gt;-&lt;/span&gt;
&lt;/template&gt;
```

컬럼 정의: `CallActivityManagement.vue:253`
```ts
{ title: '설명', key: 'description', align: 'start' as const, width: 300 },
```

데이터 정규화: `CallActivityManagement.vue:341-350` (`normalizeDescription` — `row.description ?? definition.description ?? definition.shortDescription`)

### 현재 스타일 (`CallActivityManagement.vue:551-558`, scoped)
```css
.cell-description {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    white-space: nowrap;
}
```

### 왜 레이아웃이 밀리는가 (핵심 원인)
ellipsis 처리가 "이미 있긴 하지만 실질적으로 동작하지 않습니다":
- `max-width: 100%` 는 부모 `&lt;td&gt;` 기준인데, `&lt;td&gt;` 자체에 고정 폭이 없습니다. Vuetify `v-data-table` 의 header `width: 300` 은 `&lt;th&gt;` 에 힌트로만 들어가고, 테이블이 `table-layout: auto` 이면 내용에 따라 늘어납니다. 레포 전체에 `table-layout: fixed` 정의가 **없습니다** (`assets/css/SKGlobalStyle.scss`, 해당 컴포넌트 둘 다 grep 결과 0건).
- `white-space: nowrap` 인 inline-block 이 들어있으면 `&lt;td&gt;` 가 콘텐츠 전체 길이만큼 늘어나고, 그 결과 다른 컬럼(담당자/최종저장/액션)을 밀어냅니다.
- 참고로 글로벌 `.sk-data-table td { white-space: normal !important; }` (`/home/kimsanghoon/process-gpt-vue3/src/assets/css/SKGlobalStyle.scss:154-162`) 가 있지만, `nowrap` 은 안쪽 span 에 걸려 있어 상쇄되지 않습니다.
- 수정 방향: `max-width: 100%` → 고정 px(예: 300px) 로 바꾸거나, `-webkit-line-clamp: 2` 방식 + `white-space: normal` + `word-break` 조합으로 변경. (`.cell-multiline` 글로벌 클래스가 `max-width: 240px` 로 이미 그 패턴을 씀 — `SKGlobalStyle.scss:84-91`)

## 2. 유사 후보 (같은 테이블 패턴, 같은 증상 가능)

- **`/home/kimsanghoon/process-gpt-vue3/src/views/system-management/SystemManagement.vue:86-89`** — 시스템 관리 목록. `class="cell-multiline"` + `:title` 사용 (글로벌 `max-width:240px` + `white-space: normal` 이라 상대적으로 안전)
- **`/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/PiFlagTypeManager.vue:43-45`** — `class="cell-description"` 사용하나 해당 파일에 로컬 정의가 없으면 스타일 미적용 상태일 수 있음
- **`/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/PiFlagBoard.vue:262-264`** — `item.descriptionSummary` (요약본 사용)
- **`/home/kimsanghoon/process-gpt-vue3/src/views/analytics/PiFlagBoard.vue:120-122`** — `cell-multiline`
- **`/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/PropertySchemaStudio.vue:72`** — 유일하게 JS 레벨 자르기: `truncate(item.description, 60)`

## 3. 프로세스 관련이지만 설명이 툴팁/클램프로 이미 안전한 화면

- `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchTreeView.vue:29-37` — description 은 `:title` + `v-tooltip(max-width 360)` 으로만 표시, 본문 렌더 없음
- `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchCardView.vue:144-149` 및 `ProcessArchHierarchyView.vue:146-151` — 동일하게 툴팁 전용 (`processDescription()` 헬퍼: 각각 465행, 521행)
- `/home/kimsanghoon/process-gpt-vue3/src/views/review-board/ReviewBoardCard.vue:141` (`.rbc-desc`, 스타일 275-285행) — `-webkit-line-clamp: 2` 적용됨. 원하는 목표 스타일의 좋은 레퍼런스
- `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionMarketPlace.vue:136` — 마켓플레이스 카드, `&lt;div class="text-body-1"&gt;{{ definition.description }}&lt;/div&gt;` — **클램프/ellipsis 없음**. 카드 높이가 설명 길이에 따라 들쭉날쭉해질 수 있는 2차 후보
- `/home/kimsanghoon/process-gpt-vue3/src/components/admin/TaskCatalogList.vue:67-69` — `.task-description` 에 line-clamp 2 적용됨 (357행)

## 요약

수정 대상 1순위: `/home/kimsanghoon/process-gpt-vue3/src/views/admin/tabs/CallActivityManagement.vue` 100행(템플릿) / 551-558행(스타일). ellipsis 코드는 존재하지만 `max-width: 100%` + `table-layout: auto` 조합 때문에 무력화된 상태입니다.</result>
<usage><subagent_tokens>37978</subagent_tokens><tool_uses>21</tool_uses><duration_ms>118586</duration_ms></usage>
</task-notification>
```

<!-- backfilled-from: a6f49d91-f1b7-438b-b245-6c44f7f22050 -->

## Prompt — 2026-09-16T06:31:37+00:00

```text
/speckit-run # 프로세스 순서도 내보내기 기능
## 목적
현재는 이미지로만 내보낼 수 있는데, 내보내기 기능(export)기능을 강화하여 bpmn파일로 내보내거나, pdf 파일로 내보낸다.

## output 형태
이미지 - 현행대로.
bpmn - xml로. (가져오기 가능하도록)
pdf - 전체 프로세스를 내보낸다. 프로세스 설정, Task 설정을 내보내고 우선 전체 프로세스를 이미지로 보여주고, 프로세스 설정을 보여준 후, 각 Lane, Task에 설정 된 내용을 보여준다. 통합 RACI등 현재 프로세스 순서도 화면에서 유저가 입력 또는 설정 할 수 있는 데이터들을 정리하여 PDF로 내보내면 됨.
```

## Prompt — 2026-09-16T06:32:09+00:00

```text
PiFlagTypeManager도 같이 고쳐줘
```

## Prompt — 2026-09-16T06:33:23+00:00

```text
admin-console/task-catalog의 내부 카탈로그 목록이 너무 붙어있음.
```

## Prompt — 2026-09-16T06:33:34+00:00

```text
admin-console/task-catalog의 내부 카탈로그 목록이 너무 붙어있고, 카드 사이즈가 통일되어있지않음.
```

## Prompt — 2026-09-16T06:37:48+00:00

```text
<task-notification>
<task-id>a52ec126560e7b97d</task-id>
<tool-use-id>toolu_0123ZNvM1qpQggFcYbrGWZJ8</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/a52ec126560e7b97d.output</output-file>
<status>completed</status>
<summary>Agent "Explore BPMN export code" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>조사를 마쳤습니다. 항목별로 정리합니다.

---

## 1. 현재 이미지 내보내기 구현 위치

**핵심 공통 유틸: `/home/kimsanghoon/process-gpt-vue3/src/composables/useBpmnExport.ts`**
- `capturePng(options)` (L28-112) — **bpmn-js `saveSVG()` 방식**. 흐름:
  1. `await bpmnViewer.saveSVG()` (L38)
  2. `DOMParser`로 SVG의 `viewBox` 파싱해 크기 추출 (L41-47)
  3. `document.createElement('canvas')` 생성, `scale=2`, `titleHeight=50`, `padding=20` (L49-57)
  4. 흰 배경 → 프로세스명 텍스트(`bold 24*2px Arial`) → 구분선 그리기 (L65-81)
  5. SVG를 Blob→ObjectURL→`Image`로 로드 후 `ctx.drawImage`, `canvas.toDataURL('image/png')` → `&lt;a download="${processName}.png"&gt;` 클릭 (L83-108)
- `openPdfPreview()` / `closePdfPreview()` (L117-130)는 `isPreviewPDFDialog` ref만 토글 — **실제 PDF 생성은 이 파일에 없음**.

**호출처 3곳(모두 `bpmnVue.bpmnViewer` 인스턴스를 넘김):**
- `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue:1807-1819` — **PAL 순서도 화면** (`this.$refs.bpmnVue.bpmnViewer`, `processName`)
- `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionChat.vue:2534-2549` — `$refs.definitionComponent.$refs.bpmnVue.bpmnViewer`
- `/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/SubProcessDetail.vue:430-445`

**레거시/보조 이미지 코드**
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/ModelerImageGenerator.vue` — `canvas._RENDERER.getRootElement()` + `XMLSerializer` + localStorage 저장(구형, 현재 designer 경로에서 미사용으로 보임)
- `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue:1770-1849` — `dom-to-image`의 `toPng` + 워터마크(`Process GPT`, `Exported: &lt;KST&gt;`) → PNG, 또는 동적 `import('jspdf')`로 PDF. 체계도(아키텍처) 화면 전용이지만 **워터마크/타임스탬프 패턴은 재사용 가치 있음**.

---

## 2. BPMN 모델러 컴포넌트 구조

**`/home/kimsanghoon/process-gpt-vue3/src/components/BpmnUengine.vue` (3485줄)** — 실제 모델러 래퍼
- `import BpmnModeler from 'bpmn-js/lib/Modeler'` (L76), `BpmnViewer from 'bpmn-js/lib/Viewer'` (L77)
- 인스턴스 생성: `self.bpmnViewer = markRaw(new BpmnModeler(viewerOptions))` (L2138, L2171)
- `saveXML({format:true, preamble:true})` 호출: L246, L1563, L1837
- `importXML(xml)` 호출: L350, L459 — L414/L435/L1574에 **무한 re-import 루프 방지** 주석 있음(주의)
- PDF 다이얼로그 내장: `&lt;v-dialog v-model="isPreviewPDFDialog"&gt;` + `&lt;PDFPreviewer :bpmnViewer="bpmnViewer" @closeDialog="closePDFDialog"/&gt;` (L60-63), import는 `BPMNPDFPreviewer.vue` (L92), prop `isPreviewPDFDialog` (L175), watch (L535)
- PAL 분기: `isPal()` computed (L260), 사용처 L1708/L1717/L1737(요소 클릭 시 패널 오픈 억제), L2924(`_palCtxMenuBound` 우클릭 컨텍스트 메뉴)

**모델러 인스턴스 전역 접근: `/home/kimsanghoon/process-gpt-vue3/src/stores/bpmn.ts`**
- pinia store `useBpmnStore`, state `bpmnModeler`, getter `getModeler` (파일 끝), action `setModeler`. 또한 `processDefinition`, `runningActivityIds`, `completedActivityIds`, `piFlagFocus` 보유.
- → **export 기능에서 모델러가 필요하면 `useBpmnStore().getModeler`로 어디서든 접근 가능** (RaciMatrixDialog가 이 방식 사용).

**XML import(가져오기) — 이미 PAL 디자이너에 존재**
`/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue`
- 툴바 "가져오기" 버튼 L279-292 (`mdi-upload`, `@click="triggerBpmnUpload"`, `:disabled="!processNameText || isViewMode"`)
- `getCurrentXml()` L1843-1853 — `useBpmnStore().getModeler` → `saveXML({format:true, preamble:true})`
- `openXmlDialog()` L1855-1860 — XML 보기/수정 다이얼로그
- `triggerBpmnUpload()` L1862-1865 → `$refs.xmlFileInput.click()`
- `validateBpmnXml(xml)` L1867-1878 — DOMParser로 `parsererror` 검사 + 루트가 `definitions`인지 검사
- `applyXmlToCanvas(xml)` L1880-1899 — toBe 모드면 `toBeBlueprintXml` + `bpmnKey++`, 아니면 `$emit('replaceXml', xml)`
- `handleBpmnFileChange(event)` L1901-1925 — `file.text()` → `applyXmlToCanvas`, 에러별 한국어 메시지

&gt; **BPMN 내보내기(.bpmn 다운로드)는 아직 없음.** `getCurrentXml()`이 이미 있으므로 Blob 다운로드만 붙이면 됨. 가져오기는 이미 완비.

**기타 저장 경로**
- `ProcessHierarchy.vue:3104-3130` `handleSave()` — `modeler.saveXML` → `pendingSaveXml`, 버전/승인 상태 체크 후 저장
- `ProcessHierarchy.vue:3233-3250` `handleSaveToBe()` — To-Be는 `definition.tobe_bpmn`에 저장
- Designer 내 추가 `saveXML` 호출: L3571, L4021

---

## 3. 프로세스 설정 / Task 설정 데이터 구조

### 3-1. 저장 위치는 크게 3군데

**(a) BPMN XML 확장 속성 — `uengine:Properties` JSON**
`/home/kimsanghoon/process-gpt-vue3/src/utils/bpmnUengineProperties.js` (⚠ `.ts` 아님)
- `readUengineProperties(businessObject)` L5-15 — `bo.extensionElements.values`에서 `$type === 'uengine:Properties'` 찾아 `JSON.parse(propsEl.json)`
- `writeUengineProperties(modeler, shapeOrId, updates)` L19-47 — 기존 JSON에 merge 후 `bpmnFactory.create('uengine:Properties', {json, variables})` → `bpmn:ExtensionElements` 재생성 → `modeling.updateProperties`. 기존 `variables`(customProperties)와 다른 extensionElements는 보존.
- `getLaneTaskShapes(modeler, laneBO)` L52-63 — `lane.flowNodeRef`(bpmn-js가 지오메트리로 자동 유지)로 레인 소속 태스크 조회. **PDF에서 Lane별 Task 그룹핑에 바로 쓸 수 있음.**

사용처: `RaciMatrixDialog.vue:79,137,234`, `GPTLanePanel.vue:83,335`, `BpmnPropertyPanel.vue:159,565`, `bpmnCallActivityDefinitionSync.js:9`, `projectMappingsApi.ts:34`.
`ProcessHierarchyProperties.vue`는 유틸을 import하지 않고 **동일 로직을 인라인으로 반복** (L6424, 6467, 6688, 6757, 8842, 9726, 9824-9843, 9872-9897, 9915-9935, 10076-10093, 10114-10130 등).

**(b) Supabase `proc_def` 테이블 / `definition` JSON**
- `ProcessHierarchyProperties.vue` 내 `.from('proc_def')` — L7779, 7802, 11255, 11359, 11446, 11502
- 공개 범위: `proc_def.visibility` / `proc_def.allowed_org_codes` (L439-440 주석, L4696)
- 검토의견/결재: `proc_def_comments` (L8951-8953, 9097, 9140, 9366, 9456, 9496), `proc_def_approval_history` (L9261)
- 용어 정의: `glossary_terms` 테이블에 즉시 저장, `/glossary` 통합 사전과 연동 (L648-700)
- `processDefinition.definition` JSON 안에 `activities[]`, `meta.owners`, `ai_copilot`, `tobe_bpmn`, `type` 등 (`ProcessHierarchy.vue:992, 1000, 1119-1151, 8398`)

**(c) Pinia store** — `useBpmnStore` (모델러 + processDefinition + 실행 상태)

### 3-2. 필드 레지스트리 (PDF 목차의 사실상 정답지)

**`/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/builtinPanelProperties.ts` (154줄)**
`BUILTIN_PANEL_PROPERTIES: BuiltinPanelProperty[]` — 각 항목이 `{taskType, key, labelKo, labelI18n, propertyType, widget, binding, tab, panel, displayOrder, description, config, autoSeed}`.
파일 상단 주석(L1-15)에 **"실사용 속성패널은 `ProcessHierarchyProperties.vue`이고, bpmnModeling 하위 GPT/uEngine 패널 스택은 실행 경로에 없다"**고 명시 — PDF는 이 레지스트리 + ProcessHierarchyProperties 기준으로 만들면 됨.

스코프별 전체 목록:
- **`process` 탭** (L55-68): `owner`(담당자 dialog), `parent_hierarchy`(Domain/Mega/Major), `title`, `description`, `manual_links`, `api_integrations_summary`, `system_list`, `related_project_list`, `total_duration`, `total_cost`, `task_count`, `glossary`(PAL 전용, order 55)
- **`pi-flag` 탭** (L73-74): `pi_flag_tab`, `pi_flag_agent_chat`
- **`governance` 탭** (L79-81): `governance_tab`, `review_guide`, `release_strategy`
- **`task` 공통** (L86-101): `element_id`, `name`, `description`, `form_link`, **`raci`**(dialog, binding `taskForm.raci`), **`task_io`**(labelI18n `taskIo.tab`, binding `taskForm.procedure`), `manual_links`, `api_integrations`, `data_io`, `fte_calculator`, `opex`, `system_mapping`, `related_project_mapping`, `pi_flag`, `task_catalog`(PAL 전용)
- **`bpmn:SequenceFlow`** (L106-109): `name`, `flow_type`, `condition_expression`, `condition_llm_mode`
- **`bpmn:Participant`** (L112-113): `exec_pool`, **`ppi`**(dialog)
- **`bpmn:Lane`** (L116-118): `name`, `description`(AI 생성 버튼 포함), `lane_assignment`(binding `laneResourceType/laneAssignee/laneOrganization/laneSupplier/laneRoleGroupSelectedList`)
- **`bpmn:CallActivity`** (L121): `definition_link`
- **`bpmn:BusinessRuleTask`** (L124): `dmn_rule`
- **`bpmn:SendTask`** (L127-129): `mail_recipients`, `mail_title`, `mail_contents`
- **`bpmn:DataObjectReference`** (L132-152): `attachment` (Supabase Storage `files` 버킷)

노출 제어: `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/builtinPanelVisibilityMixin.ts:27-31` → `useTaskCatalogStore().isBuiltinPropVisible(taskType, key)`. `ProcessHierarchyProperties.vue`는 `isBuiltinPropVisible('process','glossary')`(L651), `('task','task_catalog')`(L1286) 식으로 사용. **PDF도 이 가시성 규칙을 따라야 관리자가 숨긴 필드가 새지 않음.**

### 3-3. 폼 데이터 shape (`ProcessHierarchyProperties.vue`)

- `processForm` L4683-4699: `title, description, owner, systems[], fte, futureState('as_is'), wilTask, fteHoursPerMonth, hitlRequired, manualLinks[], kpiEnabled, ppi, visibility, allowedOrgs[]`
- `taskForm` L4704-4726: `name, description, raci, procedure, ppi, manualLinks[], systems[], fte, futureStatus('maintain'), relatedProjects[], opexCost, opexUnit('건당'), opexNote, schemaProps{}, dataAttachmentUrl, dataAttachmentFile, apiIntegrations[], conditionExpression, flowType('sequence'), conditionLlmMode`
- 그 외 상태 L4760-4800: `callActivityDefinitionId(s)`, `taskFormLinkId`(uengine json `tool` = `formHandler:&lt;form_def.id&gt;`), `businessRuleId`, `taskDataInputs/taskDataOutputs`(dataInput/OutputAssociation, 조회 전용), `sendTaskRecipients/sendTaskMailTitle/sendTaskMailContents`, `laneOrgDmnModel`, `multiTaskMappingForm`
- 별도 `taskForm` 정의가 L7018에도 있음(주의 — 중복/리셋용으로 보임)

### 3-4. 통합 RACI 뷰 — **이미 존재**

**`/home/kimsanghoon/process-gpt-vue3/src/components/designer/RaciMatrixDialog.vue` (322줄)** — PDF에 그대로 재사용할 수 있는 최적 소스
- 툴바 진입: `ProcessHierarchyDesigner.vue:242-249` "RACI" 버튼(`mdi-table-account`) → `isViewRaciMatrix = true`; 다이얼로그 L588-589, import L1121, watch L1585, data L1276
- `RACI_KEYS = ['R','A','S','C','I']` (L81), 범례 `R=책임(수행) · A=승인 · S=지원 · C=자문 · I=통보` (L6)
- `build()` L114-169 — `elementRegistry.getAll()` → Lane의 `flowNodeRef`로 `laneByTaskId` 매핑 → `el.type.includes('Task')` 필터 → `readUengineProperties(el.businessObject)`로 `{id, name, taskCode, laneName, raci, x, y}` 행 생성. **정렬: 모든 태스크에 `taskCode`가 있으면 `localeCompare(numeric)`, 아니면 `x → y` 좌표순** (L150-156). 열(orgs)은 raci에 등장하는 조직명을 등장 순서대로 (L159-168)
- `normalizeRaci` L170-179, `cellLetters/cellValue/cellClass` L180-189
- `persistRow` L225-243 — `writeUengineProperties(modeler, row.id, {raci})` + `processDefinition.activities` 동기화 + `$emit('changed')`
- props: `modelValue, isViewMode, processDefinition`; 셀 색상 CSS L298-321 (R=#c62828, A=#283593, S=#2e7d32, C=#e65100, I=#616161, multi=#6a1b9a)

&gt; **`build()` 로직을 그대로 추출해 PDF의 통합 RACI 표에 재사용 권장.**

### 3-5. 개별 필드 컴포넌트 (dialog / readonly 모드 이미 지원)

- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/RaciField.vue` (226줄) — `dialogMode`(PAL 패널: 요약만 표시 + "RACI 편집" 버튼) vs 인라인(비 PAL). `rows`는 R/A/S/C/I, 값은 `string[]`. 빈 값이면 `null` emit.
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/TaskIoField.vue` (284줄) — `readonly || dialogMode`일 때 **문서형 카드 뷰**(L1-20; 번호 매긴 `&lt;ol&gt;` 스타일). `sections()` L141-152: 단일 섹션 `{key:'procedure', icon:'mdi-format-list-numbered', ordered:true, label:'업무 수행 절차'}`. 값은 `string[]`, 전부 비면 `null` emit (RaciField와 동일 규칙, L196 주석).
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/PpiField.vue` — `readonly`일 때 **성과지표 v-table**(지표명/단위/측정주기/운영정의/산출식) 렌더. `showHeader` prop으로 PAL 패널에선 헤더 끔.
- 그 외: `CheckpointsField.vue`, `DescriptionField.vue`, `InstructionField.vue`, `KeyValueField.vue`, `MandatoryRuleChecklist.vue`, `TaskCatalogSection.vue`

&gt; **`readonly` 모드가 이미 세 필드 모두에 있어 PDF 프리뷰 DOM을 이 컴포넌트로 조립 가능** → html2canvas/html-to-image 캡처 방식과 잘 맞음.

---

## 4. PDF 관련 기존 의존성 및 코드

**`package.json` dependencies (있는 것):**
- `jspdf: ^2.5.1` (L114, devDeps L207에도 중복)
- `html2pdf.js: ^0.10.3` (L107)
- `html2canvas-pro: ^1.5.8` (L106) — ⚠ 원본 `html2canvas`는 **없음**
- `html-to-image` (BPMNPDFPreviewer가 `toPng` import — package.json 해당 라인은 위 grep 범위 밖이나 실제 import 존재)
- `dom-to-image: ^2.6.0` (L93)
- `file-saver: ^2.0.5` (L101)
- `docx: ^8.0.0` (L92), `exceljs: ^4.4.0`
- **없음: `pdfmake`, `pdf-lib`**

**기존 PDF 생성 코드:**

1. **`/home/kimsanghoon/process-gpt-vue3/src/components/BPMNPDFPreviewer.vue` (221줄) — BPMN 전용, 가장 관련 높음**
   - `import { jsPDF } from 'jspdf'` (L37), `import { toPng } from 'html-to-image'` (L38)
   - props: `bpmnViewer` (required)
   - `previewSVG()` L67-146 (mounted에서 호출) — `saveSVG()` → viewBox 파싱 → `elementRegistry.filter(el =&gt; el.type === 'bpmn:Participant')`의 `participants[0].di.isHorizontal`로 **다이어그램 방향 판정** (L88-96) → `baseWidth=1920/baseHeight=1200`, 가로/세로에 따라 crop 크기 스왑 (L99-102) → 페이지 그리드 분할 (L114-118) → 각 페이지를 `viewBox` 조정한 SVG clone으로 `#svgPreviews`에 렌더 (L120-141)
   - `savePDF()` L147-213 — `bpmnViewer._definitions.name`을 파일명으로, `new jsPDF(isHorizontal ? 'l' : 'p', 'mm', 'a4')` (L159), 페이지별 `toPng(pageDiv, {pixelRatio:2, cacheBust:true, backgroundColor:'white'})` → aspect 비교 후 중앙 정렬 `addImage` (L189-206), `this.progress` 진행률 표시 → `pdf.save(`${name}.pdf`)`
   - i18n 키: `PDFPreviewer.saveDocument`, `PDFPreviewer.close`, `PDFPreviewer.savingPDF`, `PDFPreviewer.title`
   - ⚠ **한계: BPMN 다이어그램만 페이지 분할해서 넣음. 프로세스/Task 설정 데이터는 전혀 포함 안 됨** → 이번 작업의 확장 지점.

2. `/home/kimsanghoon/process-gpt-vue3/src/components/PDFPreviewer.vue` — `jsPDF` (L30), 범용(HTML 문서용)
3. `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue:1770-1849` — `dom-to-image` + 동적 `import('jspdf')`, PNG/PDF/XLSX(ExcelJS)/JSON/Mermaid 5종 export (L1740-1770). jsPDF 로드 실패 시 새 창에 `&lt;img&gt;` 폴백.
4. `/home/kimsanghoon/process-gpt-vue3/src/views/markdown/PdfExportHelper.vue:169-170` — 실제로는 `docx`의 `Packer.toBlob` + `saveAs` (Word)
5. `/home/kimsanghoon/process-gpt-vue3/src/views/markdown/WordExportHelper.vue:34` — `docx`

**i18n 파일 위치:** `/home/kimsanghoon/process-gpt-vue3/src/utils/locales/ko.json`, `en.json`

---

## 5. 내보내기 UI 진입점

### (A) PAL 순서도 화면 — `ProcessHierarchyDesigner.vue` 툴바 (**이번 작업의 주 타깃**)
`/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue` L234-358, 모두 `:disabled="!processNameText"` 패턴:

| 라인 | 버튼 | 아이콘 | 액션 |
|---|---|---|---|
| L236-239 | 검증 | `mdi-check-circle-outline` | `handleValidate` |
| L244-247 | RACI | `mdi-table-account` | `isViewRaciMatrix = true` |
| L256-259 | Rule (`v-if="isPal"`) | `mdi-clipboard-check-outline` | `openRuleOverview` |
| L264-267 | XML | `mdi-code-tags` | `openXmlDialog` |
| — L270 `&lt;v-divider vertical class="mx-1"/&gt;` — | | | |
| **L271-278** | **이미지** | **`mdi-image-outline`** | **`capturePng`** ← **여기에 내보내기 메뉴 추가** |
| L279-292 | 가져오기 | `mdi-upload` | `triggerBpmnUpload` (`+ :disabled="... \|\| isViewMode"`) |
| L293-307 | AI 생성 (`v-if="aiCopilotEnabled"`) | `mdi-auto-fix` | `openGenDialog` |
| — L308 divider — | | | |
| L309-323 | 삭제 | `mdi-delete-outline` | `$emit('delete')` (`!isAdmin` 비활성) |
| L324-344 | 복제 | `mdi-content-copy` | `$emit('clone')` |
| L345-358 | 저장 | `mdi-content-save` (flat/primary) | `$emit('save')` |

→ 툴팁 텍스트: `"현재 다이어그램을 이미지(PNG)로 저장합니다"` (L271). **이 화면엔 PDF 버튼이 없음** (`isPreviewPDFDialog`도 전달 안 함).

### (B) 비 PAL 정의 화면 — `ProcessDefinitionChatHeader.vue`
`/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionChatHeader.vue`
- L90 `&lt;div class="mr-0 d-flex" v-if="Pal"&gt;` → L92-105 **PDF 저장 버튼** (`mdi-file-pdf-box`, `@click="savePDF"`, 툴팁 `$t('processDefinition.savePDF')`). 메서드 `savePDF()` L550-551 → `$emit('savePDF')`
- L107-125+ BPMN 가져오기 메뉴 (`Icons upload`, `v-if="fullPath != 'definition-map'"`, `$t('chat.importMenu')`)
- L303-320 컴포넌트 내보내기(.zip), `exportComponent()` L559-560
- ⚠ **이 헤더에는 `capturePng` 버튼/emit이 없음** (부모는 `@capturePng` 리스너를 붙였지만 emit 소스가 없음 — 죽은 배선으로 보임)
- `Pal()` computed L406-408: `return window.$pal`

### (C) 배선 체인 (PDF)
`ProcessDefinitionChatHeader` `@savePDF` → `ProcessDefinitionChat.vue:279,334` → `savePDF()` L2530-2533 (`isPreviewPDFDialog` false→true 토글) → `:isPreviewPDFDialog` prop L66 / `@closePDFDialog` L69 → `ProcessDefinition.vue:41,45,456,1524` → `BpmnUengine.vue:60-63` `&lt;v-dialog max-width="1160px"&gt;` + `&lt;PDFPreviewer :bpmnViewer&gt;` → `BPMNPDFPreviewer.vue`
`SubProcessDetail.vue:446-449`도 동일한 `savePDF()` 토글 패턴.

---

## 6. PAL 모드 분기

### 플래그 정의: `/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` (13줄, 전문)
```ts
const runtimePalMode = (window as any)._env_?.VITE_PAL_MODE;
const buildPalMode = import.meta.env.VITE_PAL_MODE;
const enabled = runtimePalMode === true || runtimePalMode === 'true' || buildPalMode === 'true';
Object.defineProperty(window, '$pal', { value: enabled, writable: false, configurable: false });
```
- `main.ts:8`에서 `import './palMode'` — **라우터가 모드별 화면을 구성하기 전에 먼저 평가되어야 함**(L1-2 주석)
- 런타임(`window._env_.VITE_PAL_MODE`) 또는 빌드타임(`import.meta.env.VITE_PAL_MODE`) 둘 다 지원. `writable:false, configurable:false`라 **테스트에서 재정의 불가** (주의)

### 사용 패턴 3가지
1. **Options API computed** (가장 흔함): `isPal() { return !!window.$pal; }`
   - `ProcessHierarchyDesigner.vue:1328-1330`, `BpmnUengine.vue:260`, `BpmnUengineViewer.vue:249`, `ProcessDefinitionChatHeader.vue:406` (`Pal()`), `ProcessHierarchyProperties.vue:4863` (`isPalMode()`), `AccountSettings.vue:451`, `ExtraBox.vue:56`
2. **Composition computed**: `const isPalMode = computed(() =&gt; !!(window as any).$pal)` — `FullLayout.vue:39`, `ProcessArchitecture.vue:689`
3. **모듈 최상위 상수**: `const isPalMode = !!(window as any).$pal` — `AdminConsoleLayout.vue:27`
4. **템플릿 직접 참조**: `NotificationDD.vue:79` `isPal: !!window.$pal`

### 라우터 분기: `/home/kimsanghoon/process-gpt-vue3/src/router/index.ts`
- L166-176: PAL 점검 모드 — `if (window.$pal)` 시 admin 아닌 사용자를 점검 안내 화면으로
- L178-182: `if (window.$pal &amp;&amp; to.path === '/')` — PAL 루트는 랜딩 대신 인증 상태별 시작 화면

`/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts`
- L449-452: `/process-hierarchy` → `ProcessHierarchy.vue` (**PAL/비PAL 공통 등록**)
- **L453 `...(window.$pal ? [ ... ] : [])`** — PAL 전용 라우트 스프레드 블록: `/process-hierarchy/process_management`(L457-458), `/analysis-dashboard`(L462-463), `/glossary`(L466-469, "통합 용어 사전") 등

### 디자이너 화면에서의 PAL 분기 실태
- **`/process-hierarchy` 라우트 자체는 PAL 전용이 아님** (L449-452은 조건 밖). 즉 `ProcessHierarchyDesigner.vue`는 비 PAL에서도 도달 가능 → **새 export 기능은 라우트가 아니라 `isPal` computed로 명시 게이팅해야 함**.
- 디자이너 내 `isPal` 실제 사용처는 단 2곳: 툴바 "Rule" 버튼 `v-if="isPal"` (L251), `mandatoryRuleChecklist = this.isPal ? collectMandatoryRuleChecklist(modeler) : []` (L4060)
- 속성패널 `ProcessHierarchyProperties.vue`는 `isPalMode` 게이팅이 훨씬 많음: L61(탭 클릭), L441, L651(glossary), L1286(task_catalog), L6960(`loadProcessVisibility`), L7050(catalogStore 로드), L7055, L11619
- `BpmnUengine.vue`: `isPal`일 때 요소 클릭 시 패널 자동 오픈 안 함(L1708-1737), PAL 전용 우클릭 컨텍스트 메뉴(L2924)
- CSS 클래스 분기도 사용: `BpmnUengine.vue:6` `:class="{'not-pal': !isPal}"`, `FullLayout.vue:92-105` `pal-main-no-header/pal-content-container/pal-page-shell/pal-page-frame`

### 기타 PAL 관련
- `PalModeBackend` — 백엔드 구현체 클래스명. 코드가 아닌 **주석에서만** 참조됨: `stores/adminConsole.ts:1691, 1756, 2126`, `utils/procDefVisibility.ts:15`, `services/activityAuditLog.ts:8`("PAL 모드 전용: 비 PAL 에서는 아무것도 하지 않는다"), `ProcessHierarchy.vue:954`. 실제 인스턴스는 `backend` 싱글턴으로 주입되는 구조.

---

## 기존 스펙 상태

`/home/kimsanghoon/process-gpt-vue3/specs/006-process-export/` 가 이미 생성되어 있습니다.
- `spec.md` — **템플릿 미채움 상태** (`[FEATURE NAME]`, `$ARGUMENTS` 그대로)
- `prompt-history.md` — 2026-09-16T06:31:47Z에 이번 요구사항 원문 기록됨: 이미지(현행 유지) / BPMN(XML, 가져오기 가능) / PDF(전체 프로세스 이미지 → 프로세스 설정 → 각 Lane·Task 설정 → 통합 RACI). 이후 3개 프롬프트는 무관한 작업(PiFlagTypeManager, task-catalog UI)이 섞여 있음.

---

## 구현 시 핵심 포인트 요약

1. **BPMN export는 가장 쉬움** — `ProcessHierarchyDesigner.vue`의 `getCurrentXml()` (L1843-1853)이 이미 있음. Blob + `&lt;a download&gt;` 또는 `file-saver`의 `saveAs`만 추가.
2. **PDF는 `BPMNPDFPreviewer.vue`를 베이스로 확장** — `isHorizontal` 방향 판정, jsPDF A4 + `html-to-image` `toPng(pixelRatio:2)`, 진행률 표시가 이미 검증됨. 여기에 (a) 프로세스 설정 섹션, (b) Lane/Task 설정 섹션, (c) 통합 RACI 표 페이지를 앞뒤로 추가하는 형태.
3. **데이터 수집 함수는 신규 필요** — `useBpmnStore().getModeler` → `elementRegistry.getAll()` → `readUengineProperties(bo)` 순회. `RaciMatrixDialog.build()` (L114-169)와 `getLaneTaskShapes()` 패턴 그대로 차용.
4. **가시성 규칙 준수** — `useTaskCatalogStore().isBuiltinPropVisible(taskType, key)`로 관리자가 숨긴 필드는 PDF에서도 제외.
5. **`readonly` 모드 컴포넌트 재사용 가능** — `TaskIoField`(문서형 카드), `PpiField`(v-table), `RaciField`로 프리뷰 DOM 조립 후 캡처.
6. **PAL 게이팅** — `/process-hierarchy` 라우트는 PAL 전용이 아니므로 신규 UI는 반드시 `isPal` computed(`!!window.$pal`)로 감쌀 것. 툴바 L271-278 "이미지" 버튼 자리를 `v-menu` 드롭다운(이미지/BPMN/PDF)으로 교체하는 것이 가장 자연스러움.
7. **`useBpmnExport.ts`는 `openPdfPreview/closePdfPreview`만 있고 PDF 생성 로직이 없음** — 확장 지점으로 적합.</result>
<usage><subagent_tokens>91693</subagent_tokens><tool_uses>63</tool_uses><duration_ms>345475</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-16T06:38:30+00:00

```text
여기서 작업한 목록 대충 정리해봐.
```

## Prompt — 2026-09-16T06:39:08+00:00

```text
세션 아이디 뭐임? 문서쓰게할거야.
```

## Prompt — 2026-09-16T06:40:53+00:00

```text
/speckit-clarify
```

<!-- backfilled-from: 84f6a49d-f185-4b82-9fbf-f4cafc3e4fcc -->

## Prompt — 2026-09-16T06:41:01+00:00

```text
/write-feature-manual 3679f9ac-6cd2-4028-8dd7-a77ef26cb9ee세션과 docs/task-catalog-*, docs/glossary-*을 참고해서 카탈로그 기능과 용어 사전 기능에 대한 메뉴얼 작성해.
```

## Prompt — 2026-09-16T06:49:10+00:00

```text
<task-notification>
<task-id>bsr5y2cvs</task-id>
<tool-use-id>toolu_01LfgHaBWTsm66J5XEz2KS1S</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/bsr5y2cvs.output</output-file>
<status>completed</status>
<summary>Background command "Build the app to verify compilation" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-09-16T07:07:53+00:00

```text
Task에 설정되는 요소들이 모두 나오는 형식이 아니라 RACI, 업무 수행 절차만 나오고있음. 모두 표시해야함.
```

<!-- backfilled-from: 0ba95319-100d-460c-8c00-9f95725e8186 -->

## Prompt — 2026-09-17T02:46:37+00:00

```text
/speckit-run @docs/PI_System_통합_사용자_매뉴얼.docx 해당 사용자 메뉴얼이 이전에 작성한 메뉴얼인데, 최근 추가된 기능이 많아 메뉴얼을 전체적으로 업데이트 하려함.
@docs/manuals/ 이외에 더 추가된 기능들 목록(RACI, 조직도 등)을 먼저 정리하고 각각 스크린샷을 포함한 메뉴얼을 markdown으로 작성해서 docx에도 업데이트해줘. 그리고 메뉴얼 스크린샷 찍을때는 항상 좌측 사이드바메뉴를 닫고 찍도록해.
```

## Prompt — 2026-09-17T03:41:11+00:00

```text
/speckit-run > 의도 (why & value)
- ProcessGPT PAL에 대한 시연을 TYM에서 제공한 프로세스를 기반으로 시나리오를 작성하고 준비한다.

> 인수조건 (Definition of Done)
- 프로세스 드로잉부터 ProcessGPT PAL에서 강조할 수 있는 기능(AI 기능 제외)을 설명할 수 있는 20분 이내로 시연 가능한 scenario.md 
- 시나리오의 각 부분 별 영상과 음성

> 컨텍스트 (참고자료 위치)
- @"P5.4.3 내부심사 프로세스.pptx" 
- @docs/PI_System_통합_사용자_매뉴얼.docx 
- 발표 시간 20분
```

## Prompt — 2026-09-17T05:54:18+00:00

```text
영상의 화면이 너무 깜빡거림. 계속 새로고침이 되는 느낌인데.
```

<!-- backfilled-from: 01e62e4a-7308-428c-aa2d-2d36dad7c64f -->

## Prompt — 2026-09-18T01:31:18+00:00

```text
1. ProcessGPT PAL에 대한 홍보 페이지
> 의도 (why & value)
- ProcessGPT PAL에 대한 홍보 페이지를 작성하여 신규 고객들이 해당 페이지를 보고 제품에 대한 관심을 가질 수 있다.

> 인수조건 (Definition of Done)
- /to-be 기능이 pi-flag 유무에 따른 생성이 정상적으로 진행될 수 있다.

> 컨텍스트 (참고자료 위치)
- https://www.uengine.org/contents/processgpt.html
- https://www.youtube.com/watch?v=kd6_hKSQDYc
- https://www.uengine.org/contents/uengine6bpm.html
- https://www.youtube.com/watch?v=ZmytoLlvpMs
- https://www.uengine.org/contents/roboanalyzer.html
- https://www.uengine.org/contents/roboarchitect.html
```

## Prompt — 2026-09-18T01:31:55+00:00

```text
1. ProcessGPT PAL에 대한 홍보 페이지
> 의도 (why & value)
- ProcessGPT PAL에 대한 홍보 페이지를 작성하여 신규 고객들이 해당 페이지를 보고 제품에 대한 관심을 가질 수 있다.

> 인수조건 (Definition of Done)
- ProcessGPT PAL의 주요 기능 및 강점이 드러난 제품 홍보 영상
- 기존 회사의 제품 소개페이지를 참고(컨텍스트 참조)한 ProcessGPT PAL에 대한 소개 페이지

> 컨텍스트 (참고자료 위치)
- https://www.uengine.org/contents/processgpt.html
- https://www.youtube.com/watch?v=kd6_hKSQDYc
- https://www.uengine.org/contents/uengine6bpm.html
- https://www.youtube.com/watch?v=ZmytoLlvpMs
- https://www.uengine.org/contents/roboanalyzer.html
- https://www.uengine.org/contents/roboarchitect.html
```

## Prompt — 2026-09-18T01:37:11+00:00

```text
<task-notification>
<task-id>a8cb0745e9bba1fd0</task-id>
<tool-use-id>toolu_01YRhQ5s1yKHpPGkEX8wuK4a</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/01e62e4a-7308-428c-aa2d-2d36dad7c64f/tasks/a8cb0745e9bba1fd0.output</output-file>
<status>completed</status>
<summary>Agent "PAL 기능 자료 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have enough to produce the report.

---

# ProcessGPT PAL 조사 결과 (홍보 페이지용)

## 0. 먼저 — "PAL"의 풀네임에 대한 사실 확인

**레포 전체를 검색한 결과, PAL의 풀네임(약어 확장)은 어디에도 문서화되어 있지 않습니다.** `docs/`, `specs/`, 코드 주석, 커밋 메시지, i18n 파일 모두에서 "Process Autonomous Loop" 등의 확장형은 발견되지 않았습니다.

확인된 사실만 정리하면:
- 제품 표기는 항상 **"ProcessGPT PAL"** (`/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-pal/narration/part1.txt`, `scenario.md` 제목)
- 기술적으로는 **빌드타임 플래그 `VITE_PAL_MODE`** 로 켜지는 프론트엔드 **모드**이며, `/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` 가 `window.$pal` 전역을 확정(`writable: false`)합니다.
- 기원은 **PI-System**(`playground-pi-system-web`)의 기능을 ProcessGPT로 이관한 것 (`/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/README.md`). "PI"는 Process Innovation(프로세스 혁신)을 뜻하며, PAL 화면 곳곳에 "PI 진행 진도율", "PI Flag", "PI 추진 담당자" 표현이 남아 있습니다.

→ **홍보 페이지 작성 시 풀네임은 반드시 제품 오너에게 확인이 필요합니다.** 기능 실체로 유추하면 "Process Asset Lifecycle" / "Process Architecture Layer" 계열이 가장 근접하지만 **레포상 근거는 없습니다.**

### 제품 포지셔닝 (근거 있는 서술)
PAL은 ProcessGPT의 **엔터프라이즈 프로세스 자산 관리(Process Asset Governance) 모드**입니다. 기존 ProcessGPT가 "AI 에이전트가 프로세스를 실행"하는 데 방점이 있다면, PAL은 **문서(규정서·기술서)로만 존재하던 전사 프로세스 체계를 살아있는 구조화 데이터로 전환하고, 승인·버전·감사까지 통제**하는 데 방점이 있습니다.

결정적 근거 — 데모 내레이션 (`docs/demo-p543-pal/narration/part1.txt`):
&gt; "오늘 시연에는 **AI 기능을 일절 사용하지 않습니다**. 모든 화면은 사람이 직접 조작합니다."
&gt; "이 모든 것이 **AI 없이, 현업 관리자의 손으로 운영 가능한** 기능들입니다. 여기에 AI 기능이 더해지면 작성과 분석이 한층 빨라집니다." (part7)

즉 PAL의 셀링포인트는 "AI가 없어도 완결되는 엔터프라이즈 BPM 거버넌스 + 켜면 더 빨라지는 AI"라는 **이중 구조**입니다. ISO 내부심사 등 인증 대응 문서 통제를 명시적 타깃으로 삼고 있습니다.

---

## 1. 핵심 기능 목록

### A. 프로세스 자산 모델링

**1) 프로세스 체계도 (Process Architecture) — `/process-architecture`**
Mega → Major → Sub 3계층 프로세스 맵을 트리·카드·매트릭스·Mermaid 4개 뷰로 제공합니다. 기술서 문서 안에만 있던 프로세스 지도가 그대로 시스템 내비게이션이 되며, 각 카드에 승인 단계(0~4단계)와 버전이 표시되고 상단 집계 바로 전사 진척도를 한눈에 봅니다. PAL 로그인 후 **기본 랜딩 화면**입니다.
- *가치*: "프로세스 지도를 PPT로 관리하다 시스템 내비게이션으로 승격" — 문서와 시스템의 이중 관리 종식
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue`, `processClassification.ts`

**2) BPMN 순서도 디자이너 (실행 조건을 가진 모델)**
레인·태스크·게이트웨이를 컨텍스트 메뉴로 몇 번 클릭해 그립니다. 핵심은 "그림이 아니라는 점" — 승인 게이트웨이에 분기 조건이 실제 값으로 들어가고, "효과성 불충분 → 시정조치 복귀" 같은 루프까지 실행 가능한 모델로 표현됩니다. Call Activity 인라인 드릴다운으로 하위 프로세스를 캔버스에서 바로 파고듭니다.
- *가치*: 문서 흐름도를 누락 없이 옮기면서, 그 순간 실행·분석·감사 가능한 자산이 됨
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue`, `/home/kimsanghoon/process-gpt-vue3/src/components/customDrilldown/CallActivityDrilldown.js`

**3) RACI + 세부 업무 수행 절차 (속성 데이터화)**
태스크마다 R(책임)/A(승인)/S(지원)/C(자문)/I(통보) 5역할과 단계별 수행 절차를 구조화 데이터로 입력합니다. R을 비우면 해당 태스크가 놓인 레인 이름이 자동으로 채워지고, 툴바 RACI 버튼으로 **전체 Task × 조직 통합 매트릭스**를 열어 셀 클릭만으로 공백→R→A→S→C→I 순환 편집이 됩니다.
- *가치*: 규정서의 RACI 표·절차서가 "첨부 문서"가 아니라 "질의·분석·감사 가능한 데이터"가 됨
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/raci-task-settings.md`

**4) Task 카탈로그 — `/admin-console/task-catalog`**
"임원 승인", "전자결재 상신" 같은 반복 표준 업무를 카탈로그에 한 번 등록해 두고, 어느 프로세스에서든 **속성째** 꺼내 씁니다. 적용 시 이름·업무 유형만이 아니라 세부 절차·RACI·관련자료 링크·사용자 정의 속성까지 함께 들어옵니다. 순서도 요소 변경(replace) 메뉴와 속성 패널 두 경로 모두에서 사용 가능하고, 잘 만든 태스크를 그 자리에서 카탈로그에 역등록할 수도 있습니다.
- *가치*: **"두 번째 프로세스부터는 그리기가 아니라 조립"** — 속도와 전사 표기 품질 균일화를 동시에
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/task-catalog.md`, DB 테이블 `task_catalog`

**5) 속성 스키마 스튜디오 — `/admin-console/property-schemas` ★최대 차별점**
고객사마다 다른 기술서 양식(Input/Output 표, 통제 Rule 등)을 **코드 수정도 배포도 없이** 흡수합니다. 관리자가 관리 화면에서 필드(키·라벨·타입·선택지 소스·그룹·표시순서·필수 여부·조건부 표시)를 추가하면, 순서도 속성 패널에 즉시 나타납니다. 값은 태스크의 uengine json에 `property_key` 그대로 저장되어 BPMN과 완전 호환됩니다.
- *가치*: **"속성 메타모델 자체가 관리 화면에서 움직이는 것, 이것이 PAL의 큰 차별점"** (내레이션 part5 원문). 고객사별 커스터마이징이 SI 프로젝트가 아니라 설정 작업이 됨
- 발전 로드맵: `/home/kimsanghoon/process-gpt-vue3/docs/widget-composer-design.md` — 전용 위젯 자체를 선언적 DSL(`config.composite`)로 전환해 관리자가 위젯 레이아웃까지 편집·미리보기하는 설계안 (Phase 0~3)

**6) 목록 관리 (선택지 목록) — `/admin-console/option-lists`**
선택형 속성이 참조하는 공용 선택지 목록을 주제별로 관리합니다. "사업부", "내부심사 문서" 같은 목록을 한 번 만들면 여러 속성이 공유 참조하며, 항목을 고칠 때 목록 한 곳만 바꾸면 전 속성에 반영됩니다. 카드에 "속성 N개에서 사용" 배지가 표시됩니다.
- *가치*: 새 문서 양식이 생겨도 목록에 항목 한 줄 추가로 끝 — 운영 관리 포인트 최소화
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/option-lists.md`

**7) 용어 사전 (Glossary) — `/glossary`**
프로세스 규정서의 "용어 정의" 표를 시스템으로 옮깁니다. 프로세스 속성 패널에서 용어를 정의하면 **기존 용어 추천 목록**(정의 미리보기 + 출처 프로세스명)이 떠서 재사용할 수 있고, 조직 전체 용어가 `/glossary`에 용어 단위로 묶여 "어떤 프로세스가 어떤 의미로 쓰는지"를 한눈에 보여줍니다. 대소문자·공백 무시 동일 용어 판정.
- *가치*: 전사 용어 불일치 해소 — 부서마다 다른 뜻으로 쓰던 용어가 드러남
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/glossary.md`, 테이블 `glossary_terms`

### B. 검증·통제

**8) 2단계 검증 (구조 검증 + 필수 Rule 체크리스트)**
검증 버튼 한 번에 두 단계가 돕니다. 1단계는 기계 검증 — 끊어진 연결, 필수 속성 누락을 즉시 잡습니다. 2단계는 필수 Rule 체크리스트 — 항목을 클릭하면 캔버스가 해당 태스크로 이동하면서 Rule 전문·RACI·참조 문서·산출 문서·수행 절차가 한 화면에 나란히 뜨고, 사람이 근거를 대조해 체크합니다.
- *가치*: **"AI 없이도 기계 검증과 사람 확인, 두 단계로 통제가 완결"** — 인증 심사 대응의 증적 구조 그 자체

**9) 프로세스 변경 관리 / 리뷰보드 — `/review-board`, `/my-inbox`**
0~4단계(초안 → 검토중 → 공개의견수렴 → 최종편집 → 게시) 승인 워크플로. 버전 그루핑, fieldChanges 기반 상세 diff, HQ/현업 이원 승인(`approveHQ`/`approveField`), 재오픈 요청, 스냅샷을 제공합니다. 내 수신함은 내 승인함·개선 요청함·내 상신함 3탭.
- *가치*: 프로세스 문서 개정이 이메일·결재 시스템을 떠돌지 않고 한 화면에서 추적됨
- 정의: `/home/kimsanghoon/process-gpt-vue3/src/utils/processStages.ts`

**10) 병합 요청함 + 병합 전 검증 — `/merge-requests`**
스킬·프로세스·의사결정(DMN) 변경안을 한 화면에서 검토·승인·병합합니다. 백미는 **병합 전 검증 탭** — 이 변경이 기존 동작을 깨뜨리는지 자동 비교해 "이 병합은 기존 동작 N개 단계를 깨뜨립니다" 배너를 병합 버튼 위에 띄웁니다.
- *가치*: 프로세스 변경에 소프트웨어 개발의 회귀 테스트 개념을 도입 — 바꿔도 안 깨진다는 확신
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/merge-requests.md`

**11) 감사 로그 (4탭 + CSV) — `/admin-console/audit-trail`**
승인 이력 / 관리자 감사 로그 / 로그인 이력 / 다운로드 이력 4탭. 기간·액션·수행자로 필터링해 탭별 CSV 내보내기가 가능하고, 행을 펼치면 변경 전후 값과 변경 사유까지 보입니다. DB 레벨에서 `admin_audit_log`가 **append-only로 강제**됩니다.
- *가치*: 내부 감사 대응 증적을 별도 준비 없이 즉시 제출
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/audit-trail.md`, 마이그레이션 `20260526_admin_audit_log_append_only.sql`

**12) 사내 정책문서 관리 — `/policy-document`**
규정·정책 문서를 등록하고 **어느 프로세스가 그 문서를 실제로 쓰고 있는지** 자동 추적합니다. `proc_def` 저장 트리거가 현재 BPMN과 To-Be BPMN에서 사용 관계를 갱신하며, 목록의 "사용 중인 프로세스"에서 해당 프로세스로 바로 이동합니다. 문서 도메인은 직접 지정 도메인 + 사용 프로세스들의 도메인을 합집합으로 표시하고, **사용 중인 문서는 삭제할 수 없습니다.**
- *가치*: "이 규정을 고치면 어떤 프로세스가 영향받나"에 즉답 — 문서 영향도 분석
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/03-policy-document.md`, 테이블 `audit_policy`

**13) 수정 잠금(Data Freeze) + 점검 모드 + 공지 배너 — `/admin-console/data-freeze`, `/admin-console/system-operations`**
특정 대상의 편집을 기간 단위로 동결하고, 점검 모드를 켜면 `maintenanceGate`가 전 사용자를 `PalMaintenance` 화면으로 유도합니다. 전사 공지 배너도 여기서 관리합니다. 편집은 낙관적 잠금(`acquireLockWithStaleCheck` + 하트비트)으로 한 번에 한 사람만.
- *가치*: 대규모 개편·마감 기간에 데이터 정합성을 조직 차원에서 보장
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/utils/maintenanceGate.ts`, `/home/kimsanghoon/process-gpt-vue3/src/views/authentication/PalMaintenance.vue`

**14) 프로세스 구조 재구성 (3단계 Cut-over)**
조직 개편으로 체계 자체를 바꿀 때: ① 재구성 모드 Scenario Builder에서 Mega Rename·Major 이동 등을 조립하고 영향도 확인 → ② 구조변경 특별 결재 라인에서 개편안 승인 → ③ **점검 모드를 켠 상태에서 Cut-over 일괄 적용**. 반영 이력은 감사 로그에 남습니다.
- *가치*: 수십~수백 프로세스에 파급되는 개편을 무중단 사고 없이 통제된 절차로
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/process-restructure.md`

**15) 보안 설정 (테넌트 단위 5개 섹션) — `/admin-console/security-settings`**
세션 타임아웃, 로그인 잠금, MFA, 다운로드 이상 탐지, 감사 로그 보관 정책을 관리자 한 화면에서 조정하고, 모든 변경은 관리자 감사 로그에 기록됩니다. GoTrue 기반 정책 문서 4종이 별도로 정리되어 있습니다.
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/security-gotrue-{mfa,lockout,session,password}-policy.md`, `/home/kimsanghoon/process-gpt-vue3/docs/security.md`

### C. 조직·거버넌스

**16) 조직도 + 멤버십 승인 — `/organization` (최신 커밋 `3bf5a080`)**
부서 트리를 드래그로 편집하고 구성원을 배치하며, 부서장·권한까지 한 화면에서 지정합니다(자동 저장). **가입 및 권한 승인 탭**이 통합되어, 회원가입한 사용자는 관리자 승인 전까지 `SignupPending` 화면에 머무릅니다(`membershipGate`). 아직 가입 전인 신입사원을 이메일로 **사전등록**해 두면 가입 즉시 자동 배치됩니다. 사이드바 메뉴에 대기 건수 배지(`MembershipRequestBadge`)가 붙습니다.
- *가치*: 아무나 조직 데이터에 접근하지 못하는 승인 기반 온보딩 + 조직 구조가 프로세스 RACI와 연결
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/organization/OrganizationChartView.vue`, `MembershipApprovalPanel.vue`, `/home/kimsanghoon/process-gpt-vue3/src/utils/membershipGate.ts`, 마이그레이션 `20260908000001_membership_approvals.sql`

**17) 업무분장 — `/work-assignment`**
프로세스별 담당자(오너/조직)를 지정하는 전용 화면. 사용자 검색은 Supabase `users` 폴백으로 항상 동작하고, 조직 그룹 검색은 REST 1차입니다.
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/09-work-assignment.md`

### D. 분석·인사이트

**18) 분석 대시보드 — `/analysis-dashboard`**
진행현황 / 프로세스분석 / 운영현황 / 입력정확도 4탭(+ `ModelOperationalBoard` 신설). PI 진행 진도율, 단계별 프로세스 수, 조직별 KPI 달성 현황, 주차별 게시 이력, **단계 역행(Churn) 현황**을 봅니다. 관리자는 탭 구성·순서를 직접 바꾸고 Grafana 보드를 연결할 수 있습니다. **차트가 순수 Vue/CSS/SVG로 구현되어 외부 차트 라이브러리 의존이 0**입니다.
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/analysis-dashboard.md`

**19) 사용 활성도 / 도입 분석 — `/admin-console/usage-adoption`**
`startUsageTracking(router)`가 PAL 모드에서만 페이지 방문·세션을 자동 수집하고, 모델 생성/편집 이벤트(`model_create`/`model_edit`)가 `putRawDefinition`·`bpmnModelService`에서 fire-and-forget으로 적재됩니다(`app_usage_events`).
- *가치*: "시스템 도입했는데 실제로 쓰나?"를 데이터로 답변 — PI 추진 성과 보고 자동화
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/services/usageAnalytics.ts` (931줄)

**20) 온톨로지 익스플로러 (Process Knowledge Graph) — `/ontology-explorer`, `/ontology-explorer-new`**
BPMN 정의로부터 프로세스 지식그래프를 추출해 2D(cytoscape)·3D(3d-force-graph) 캔버스로 탐색합니다. `lib/processKg/` 33개 파일에 병목·SPOF(단일장애점)·자동화 가능성·조직 구조·재설계 등 **15종 분석 엔진**이 들어 있고, What-if 시뮬레이터와 AI 인사이트 내러티브 생성기가 붙습니다. 신 익스플로러는 **Apache AGE(Postgres 그래프 확장)** 기반 RPC 3종을 사용합니다.
- *가치*: "우리 회사 프로세스에서 한 사람이 빠지면 뭐가 멈추나"를 그래프로 답변
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/07-ontology-explorer.md`, `/home/kimsanghoon/process-gpt-vue3/docs/specs/graph-ontology-apache-age.md`

**21) PI Flag — `/admin-console/pi-flags`**
프로세스 혁신 과제(개선 포인트)를 태스크에 플래그로 달고, 유형별로 모아보며 관리합니다. 이슈 export 기능(`piFlagIssueExport.ts`) 포함.

**22) KPI 목표 관리 — `/admin-console/kpi-targets`**
조직별 KPI 목표를 등록하고 분석 대시보드의 달성 현황 위젯과 연동됩니다(soft delete·복원 지원).

### E. 문서 출력

**23) 프로세스 내보내기 (PNG / BPMN 2.0 / PDF 정의서)**
PNG는 빠른 공유용, `.bpmn`은 표준 BPMN 2.0 XML로 타 도구 호환·백업용. **PDF 정의서**가 하이라이트 — 표지·전체 다이어그램·프로세스 설정·Lane별 Task 전체 속성(설명·RACI·수행 절차·입출력·폼 연결·시스템·API 연동·FTE·OPEX·PPI·관리자가 추가한 사용자 정의 필드 전부)·통합 RACI 매트릭스가 한 문서로 조립됩니다.
- *가치*: **시스템에 입력하면 규정서가 자동으로 나온다** — 문서 작성 공수가 사라짐
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/process-export.md`

### F. AI 기능 (선택적 — 플래그로 ON/OFF)

**24) AI Copilot (RAG 기반 프로세스 질의)**
`PalModeBackend.qdrantChat`이 Qdrant 벡터 검색 + LangChain 백엔드에 **SSE 스트리밍**으로 질의하고, 현재 BPMN XML을 컨텍스트로 함께 전달합니다. 질의·답변은 `proc_def_copilot_log`에 사용자별로 저장되어 다시 열람할 수 있습니다.

**25) To-Be Blueprint Studio / AN Transformation Studio**
As-Is 파티셔닝 → Gap Triage → To-Be Orchestrator → Roadmap 4단계 오케스트레이션. As-Is/To-Be 비교, ROI 산정, 실행형 프로세스 생성 뷰를 제공하며 모든 데이터는 `proc_def.definition.tobe` JSON에 저장됩니다.
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/composables/anStudio/useAnStudio.ts`, `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/blueprint/ProcessBlueprintStudio.vue`

**26) AI 기능 마스터 플래그 (엔터프라이즈 배려)**
`VITE_FF_AI` 마스터 + `AI_COPILOT`/`AI_DESIGNER`/`AI_FORM` 세부 플래그로 AI 기능을 단계적으로 끌 수 있습니다. `VITE_FF_EXECUTION`으로 실행 기능도 분리 게이팅됩니다.
- *가치*: **보안 규제가 엄격한 고객사에 "AI 전부 끄고도 완전 동작"으로 납품 가능** — 이게 데모가 AI 없이 진행된 이유
- 근거: `/home/kimsanghoon/process-gpt-vue3/.env.example`, `/home/kimsanghoon/process-gpt-vue3/docs/feature-flag-analysis.md`

---

## 2. 기존 ProcessGPT / uEngine 대비 차별점

| 축 | 기존 ProcessGPT (기본 모드) | PAL 모드 |
|---|---|---|
| **1차 목적** | AI 에이전트가 프로세스를 **실행** (챗·딥리서치·A2A 오케스트레이션) | 전사 프로세스를 **자산으로 등록·통제·진화** |
| **진입 화면** | 채팅·할일 목록 | **프로세스 체계도** (`/process-architecture`) |
| **모델의 정체** | 실행 가능한 워크플로 | 실행 가능 + **규정 문서 원본**(RACI·절차·산출물·통제 Rule 포함) |
| **커스터마이징** | 코드 수정·재배포 | **속성 스키마 스튜디오로 무배포 메타모델 변경** |
| **재사용 단위** | 에이전트·스킬 | **Task 카탈로그**(속성 포함 표준 업무) |
| **변경 관리** | 버전 이력 | 0~4단계 승인 워크플로 + 병합 전 회귀 검증 + append-only 감사 로그 |
| **AI 의존도** | AI가 핵심 | **AI 없이 완결, 있으면 가속** (플래그로 전부 OFF 가능) |
| **사이드바** | 채팅 목록·에이전트·스킬 중심 | 프로세스 관리 / 조직관리 / 분석 / 관리자 14개 메뉴 |
| **분석** | 일반 analytics | 프로세스 KG(Apache AGE), SPOF·병목 분석, 도입 활성도, 입력 정확도 |

**PAL 게이팅 방식이 구현 차별점 자체**: 신규 라우트는 `MainRoutes.ts`의 `...(window.$pal ? [...] : [])` 스프레드 안에만 존재하고, 백엔드는 `PalModeBackend extends ProcessGPTBackend` 상속 오버라이드로 구성됩니다. 즉 **하나의 코드베이스가 두 제품을 서빙**하면서 비-PAL 모드는 바이트 단위로 영향받지 않습니다. `BackendFactory`가 `wrapBackendWithNullSkip` Proxy로 감싸 미구현 메서드도 크래시 없이 안전한 기본값을 반환합니다.

---

## 3. 기술 스택 / 아키텍처 하이라이트 (홍보용)

**프론트엔드**
- Vue 3 + TypeScript + Vite + Vuetify 3, Pinia, vue-i18n (한/영)
- `bpmn-js 17` (BPMN 2.0 표준 준수) + `bpmn-moddle`, `dmn-js 17` (의사결정 모델)
- 커스텀 BPMN 확장: PAL 전용 렌더러·팔레트, Call Activity 인라인 드릴다운, Task 교체 시 연결 보존
- 그래프 시각화: `cytoscape` 3.34(2D), `3d-force-graph` + `three` 0.185(3D), `@neo4j-nvl` 1.2(비즈니스 온톨로지)
- 문서/편집: TipTap 2, Monaco Editor, `fast-xml-parser`

**백엔드 / 데이터**
- **Supabase (PostgreSQL)** — RLS 기반 역할별 접근 제어, **멀티테넌시 격리**(모든 쿼리에 tenant 필터 + RLS 정책), GoTrue 인증(MFA·세션·잠금 정책), Storage, Realtime
- **Apache AGE** — Postgres 그래프 확장을 커스텀 도커 이미지로 빌드(`docker-compose/supabase-postgres-age/`), 온톨로지 RPC 3종
- 스키마는 `supabase/migrations/` 로 버전 관리, DB 타임존 KST 고정, `admin_audit_log` append-only 트리거 강제
- 파이썬 테스트(`supabase/tests/test_*.py`)로 마이그레이션 검증 (테넌트 격리·삭제/복원·다중 프로세스 재사용까지)

**AI / 에이전트 (ProcessGPT 스택 공유)**
- LLM 에이전트 마이크로서비스군: CrewAI Action, CrewAI/OpenAI Deep Research, LangChain ReAct, Work Assistant, **A2A(Agent-to-Agent) 오케스트레이션**, Computer-Use
- RAG: Memento 문서 RAG 서비스 + **Qdrant 벡터 검색**, SSE 스트리밍 응답
- 40+종 도메인 특화 생성기(`src/components/ai/`): BPMN 생성, 폼 디자인, DMN, 조건 룰, Cron, 조직도, 프로세스 컨설팅 등

**엔지니어링 성숙도 (신뢰감 소재)**
- Playwright E2E(스모크·게이트웨이·BPMN 오토레이아웃·정책문서), `vue-tsc` 타입체크 CI 게이트, semgrep/SAST 룰
- 성능 튜닝 실적: 조회 안티패턴 제거로 **운영 첫 화면 최대 지연 11.7초 → 1.4초** (커밋 `b3929976`)
- Docker Compose 원커맨드 전체 스택 기동, Kubernetes 매니페스트 제공

---

## 4. 태그라인 / 키워드 후보

### 메인 태그라인 (강도순)
1. **"프로세스 규정서를, 살아있는 데이터로."**
2. **"문서로 잠자던 프로세스 지도가, 시스템 내비게이션이 됩니다."** (내레이션 part1 직접 인용)
3. **"AI 없이도 완결됩니다. 켜면 더 빨라질 뿐입니다."** (PAL 포지셔닝의 정수)
4. **"두 번째 프로세스부터는, 그리기가 아니라 조립입니다."** (Task 카탈로그)
5. **"고객사마다 다른 양식을, 코드 수정 없이 흡수합니다."** (속성 스키마 스튜디오)

### 서브 카피
- "그림이 아닙니다. 실행 조건을 가진 모델입니다."
- "RACI 표도, 절차서도, 산출물 목록도 — 전부 분석·실행·감사 가능한 속성 데이터"
- "기계가 잡는 구조 검증 + 사람이 확인하는 필수 Rule — 2단계로 완결되는 통제"
- "입력하면, 규정서가 나옵니다." (PDF 정의서 자동 생성)
- "이 병합은 기존 동작 3개 단계를 깨뜨립니다 — 병합 전에 알려드립니다."
- "ISO 내부심사가 요구하는 문서 통제와 정합합니다."
- "배포 없는 커스터마이징. 관리 화면이 곧 메타모델입니다."

### 키워드 (SEO / 태그)
`프로세스 자산 관리` · `Process Asset Governance` · `BPM` · `BPMN 2.0` · `프로세스 혁신(PI)` · `프로세스 체계도` · `RACI 매트릭스` · `Task 카탈로그` · `속성 스키마 스튜디오` · `프로세스 지식그래프` · `온톨로지` · `Apache AGE` · `ISO 내부심사` · `문서 통제` · `감사 로그` · `승인 워크플로` · `병합 전 검증` · `멀티테넌시` · `Supabase` · `LLM 에이전트` · `RAG` · `Copilot` · `To-Be Blueprint` · `업무분장` · `용어 사전` · `PDF 정의서 자동 생성`

### 홍보 페이지 구성 제안 (데모 6파트를 그대로 스토리라인으로)
`docs/demo-p543-pal/`의 20분 데모가 이미 **완성된 6단계 내러티브 + 영상(webm/mp4) + 나레이션 음성(mp3)** 으로 존재합니다. 홍보 페이지 섹션을 그대로 여기에 맞추고, 각 섹션에 `preview/partN.mp4`를 임베드하면 즉시 쓸 수 있는 자산이 됩니다:

① 프로세스 지도 → ② 실행 조건을 가진 순서도 → ③ Task 카탈로그 → ④ 속성 데이터화(RACI·절차) → ⑤ 속성 스키마 스튜디오 → ⑥ 2단계 검증 → ⑦ 6가지 차별점 요약

또한 `docs/manuals/` 14종에 **실제 화면 스크린샷 PNG**가 전부 준비되어 있어(`docs/manuals/images/`) 홍보 페이지 이미지 소스로 바로 활용 가능합니다.

---

## 5. 참고한 주요 파일 (절대 경로)

**핵심 (필독)**
- `/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-pal/scenario.md` — 20분 발표 대본, 홍보 카피의 원천
- `/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-pal/narration/part1~7.txt` — 완성된 홍보 내러티브
- `/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-internal-audit-scenario.md` — 기술서↔BPMN 커버리지 검증표
- `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/README.md` + `01`~`10` — PAL 기능 전수 목록과 설계 결정
- `/home/kimsanghoon/process-gpt-vue3/specs/007-manual-refresh/feature-gap.md` — PAL 기능 ↔ 라우트 ↔ 권한 매핑표

**코드**
- `/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` — PAL 모드 활성화 (`window.$pal`)
- `/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts` (1,284줄, 78개 메서드)
- `/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts` — `MENU_DEFINITIONS` 전체 메뉴·권한
- `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/vertical-sidebar/VerticalSidebar.vue` — PAL 사이드바 4개 섹션
- `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts` — PAL 게이트 라우트 블록

**매뉴얼 (스크린샷 포함)**
- `/home/kimsanghoon/process-gpt-vue3/docs/manuals/` — 14종 (task-catalog, glossary, raci-task-settings, process-export, merge-requests, audit-trail, analysis-dashboard, organization-chart, signup-approvals, option-lists, security-settings, process-restructure, notifications-inbox)
- `/home/kimsanghoon/process-gpt-vue3/docs/widget-composer-design.md` — 속성 스키마 스튜디오 차기 로드맵</result>
<usage><subagent_tokens>123593</subagent_tokens><tool_uses>30</tool_uses><duration_ms>282751</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-18T02:27:46+00:00

```text
영상 기존 것 짜집기가 아닌, 새로 만들어야함. 꼭 프로세스를 그리는 걸 보여주는게 아니라 프로세스 자산화에 대한 필요성, 가치 등을 우리 제품과 함께 설명하는 영상이 됐으면 좋겠음. 그리고 기존에 있던 프로세스는 타 업체에서 사용하던 프로세스이므로 다른 프로세스를 그려서 보여주는게 맞음.  PAL은 Process Asset Library의 약어임.
```

## Prompt — 2026-09-18T02:27:51+00:00

```text
영상 기존 것 짜집기가 아닌, 새로 만들어야함. 꼭 프로세스를 그리는 걸 보여주는게 아니라 프로세스 자산화에 대한 필요성, 가치 등을 우리 제품의 강점과 함께 설명하는 영상이 됐으면 좋겠음. 그리고 기존에 있던 프로세스는 타 업체에서 사용하던 프로세스이므로 다른 프로세스를 그려서 보여주는게 맞음.  PAL은 Process Asset Library의 약어임.
```

## Prompt — 2026-09-18T04:34:52+00:00

```text
로컬에서 실행된 곳에서(외부 http://34.22.71.73:8088/) 촬영하면됨. 후속 작업 시작.
```

## Prompt — 2026-09-18T05:58:17+00:00

```text
UENGINE -> uEngine으로 대소문자 정확히 구분해야하고, @"uEngine_logo (1).png" 이건 회사 로고임.
```

## Prompt — 2026-09-18T05:59:03+00:00

```text
UENGINE -> uEngine으로 대소문자 정확히 구분해야하고, @"uEngine_logo (1).png" 이건 회사 로고임. 나레이션은 좀 더 자연스러운 보이스로.
```

## Prompt — 2026-09-18T06:44:13+00:00

```text
<task-notification>
<task-type>artifact-auto-react</task-type>
<summary>Auto-replied to comment thread on Artifact: "ProcessGPT PAL"</summary>
Auto-replied to thread 4d563752-065a-42db-8211-e83439e3462a on artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 — an acknowledgement only. If the thread asks for a change to the artifact, read the thread and make the change yourself if appropriate. The auto-posted reply (comment 1a3eabad-1432-4355-b8f1-7c922bdc074a) is already in the thread — do NOT post another; the commenter can see it. Once you have finished acting on the thread, resolve it (Artifact tool, action "resolve"); leave it open only if the conversation is still active or the commenter still needs an answer beyond the posted reply.
</task-notification>
```

## Prompt — 2026-09-18T06:45:47+00:00

```text
<task-notification>
<task-type>artifact-auto-react</task-type>
<summary>Auto-replied to comment thread on Artifact: "ProcessGPT PAL"</summary>
Auto-replied to thread 4d563752-065a-42db-8211-e83439e3462a on artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 — an acknowledgement only. If the thread asks for a change to the artifact, read the thread and make the change yourself if appropriate. The auto-posted reply (comment c3dd5abf-48fd-4127-9817-6f11f05516a4) is already in the thread — do NOT post another; the commenter can see it. Once you have finished acting on the thread, resolve it (Artifact tool, action "resolve"); leave it open only if the conversation is still active or the commenter still needs an answer beyond the posted reply.
</task-notification>
```

## Prompt — 2026-09-18T06:57:12+00:00

```text
<task-notification>
<task-type>artifact-auto-react</task-type>
<summary>Auto-replied to comment thread on Artifact: "ProcessGPT PAL"</summary>
Auto-replied to thread e3b30cc0-6337-4490-a9fa-119e217d211b on artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 — an acknowledgement only. If the thread asks for a change to the artifact, read the thread and make the change yourself if appropriate. The auto-posted reply (comment 974fa86b-e883-4485-904d-70780313d40b) is already in the thread — do NOT post another; the commenter can see it. Once you have finished acting on the thread, resolve it (Artifact tool, action "resolve"); leave it open only if the conversation is still active or the commenter still needs an answer beyond the posted reply.
</task-notification>
```

## Prompt — 2026-09-18T06:58:46+00:00

```text
<task-notification>
<task-type>artifact-changed</task-type>
<summary>Artifact changed: "ProcessGPT PAL"</summary>
Artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 appears to have been republished by another session — it is now version 1789714661-880d. Your copy is stale; re-read before editing or republishing (WebFetch the url).
</task-notification>
```

## Prompt — 2026-09-18T07:01:51+00:00

```text
@~/Downloads/유엔진솔루션즈_uEngine PAL 제안_TYM_v2.pptx The Problem부분을 pptx 5페이지 참고해서 수정하고, 6페이지부분도 넣고싶은데 이랑 why pal부분에 대체될 만한 곳이 있으면 넣거나 도입효과로 따로 넣거나 흐름에 맞게 넣어봐.
```

## Prompt — 2026-09-18T07:32:19+00:00

```text
@"docs/유엔진솔루션즈_uEngine PAL 제안_TYM_v2.pptx"
```

## Prompt — 2026-09-18T07:41:00+00:00

```text
해당 artifact 파일은 어디에 있지?
```

## Prompt — 2026-09-18T07:55:05+00:00

```text
pi-flag 관련 부분도 기능을 강조하고싶음.
```

## Prompt — 2026-09-18T08:11:12+00:00

```text
이어서 PI Flag 강조 섹션 진행해줘
```

## Prompt — 2026-09-18T08:35:14+00:00

```text
이번 세션 이전 프롬프트도 모두 추가해줘.
```

## Prompt — 2026-09-18T08:56:55+00:00

```text
# 중요한점
1. 제품소개서 페이지 - ProcessGPT -> uEngine PAL로 명칭 모두 변경. (영상도 변경필요하면 변경)
2. 이미지에서 너무 비어서 나오는 부분 수정(프로세스 체계도가 실사용 데이터로 많이 보였으면 좋겠음)
```

## Prompt — 2026-09-18T08:57:59+00:00

```text
# 중요한점
1. 제품소개서 페이지 - ProcessGPT -> uEngine PAL로 명칭 모두 변경. (영상도 변경필요하면 변경)
2. 이미지에서 너무 비어서 나오는 부분 수정(프로세스 체계도가 실사용 데이터로 많이 보였으면 좋겠음)
3. 대시보드도 데이터가 가득 찬 상태로 캡쳐됐으면 좋겠음.
4. 용어사전도 두 개밖에 안보이는데 더 많이 등록해서 보여질 수 있도록 
5. PI Flag도 4번과 마찬가지.
```

## Prompt — 2026-09-21T00:46:18+00:00

```text
체계도, Task Catalog 이미지 여전히 마음에 안듬. 체계도 이미지는 manufacturing처럼 가로로도 많이 있어야함.
```

<!-- backfilled-from: 6011ce93-62d6-47dd-b3d5-0f7563dd76f0 -->

## Prompt — 2026-09-21T00:51:08+00:00

```text
speckit-run skill을 다른사람에게 공유할 때 뭐뭐 전달해줘야함?
```

## Prompt — 2026-09-21T00:55:49+00:00

```text
UserPromptSubmit hook error
Failed with non-blocking status code: /bin/sh: /Users/kimsanghoon/IdeaProjects/playground-pi-system-web/.claude/skills/speckit-run/driver.sh: Permission denied
```

## Prompt — 2026-09-21T01:30:13+00:00

```text
프로세스 체계도 SubProcess가 한개씩만 보이는데, 여러개 두는게 좋을 것 같음.
```

<!-- backfilled-from: 49f9096d-2df4-4b1e-84f9-16ce235e27e8 -->

## Prompt — 2026-09-28T02:33:27+00:00

```text
/speckit-run > 의도 (why & value)
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

## Prompt — 2026-09-28T07:32:06+00:00

```text
1. 미분류 프로세스는 시스템 예약인데 제거 필요.
2. 도메인 관련 변경은 재구성 모드를 이용 할 수 있도록 수정.
```

## Prompt — 2026-09-28T08:34:17+00:00

```text
메뉴 관리 목록 내부 스크롤 동작하지않음.
```

<!-- backfilled-from: a3ae4626-f676-490a-8b50-811cbf563e0e -->

## Prompt — 2026-09-28T08:38:50+00:00

```text
/speckit-run @specs/009-tenant-admin-customization/next-prompt.md
```

## Prompt — 2026-09-28T09:12:06+00:00

```text
<task-notification>
<task-id>b16eh3nap</task-id>
<tool-use-id>toolu_016DJJ9MNJFgL6oqZ3otTFae</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a3ae4626-f676-490a-8b50-811cbf563e0e/tasks/b16eh3nap.output</output-file>
<status>completed</status>
<summary>Background command "Run production vite build in background" completed (exit code 0)</summary>
</task-notification>
```

<!-- backfilled-from: 0ee0eb67-c1ca-4aae-9d23-be03e778d3dc -->

## Prompt — 2026-10-01T01:20:51+00:00

```text
/speckit-run 1. 취약점 점검

> 의도 (why & value)
uEngine PAL의 취약점 점검을 진행하여 취약점이 발견된 부분을 해결하고, 이후에는 정기적인 취약점 점검을 진행하여 프로젝트의 보안 문제점을 준비한다.

> 인수조건 (Definition of Done)
- 취약점 등급 Critical / High 의 요소들이 모두 해결되어 없어진다.
- Github Actions에서 동작하여 커밋마다 취약점 점검을 진행 할 수 있도록 한다.
```

## Prompt — 2026-10-01T01:27:34+00:00

```text
<task-notification>
<task-id>bxz3iobjk</task-id>
<tool-use-id>toolu_01QcPfm7AjEq1eV5FwD4Xx32</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/0ee0eb67-c1ca-4aae-9d23-be03e778d3dc/tasks/bxz3iobjk.output</output-file>
<status>failed</status>
<summary>Background command "Install and build in scratch copy" failed with exit code 1</summary>
</task-notification>
```

## Prompt — 2026-10-01T01:32:53+00:00

```text
<task-notification>
<task-id>bya1tdihj</task-id>
<tool-use-id>toolu_0185Trt1ZJ1mxeR3ferK9fMp</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/0ee0eb67-c1ca-4aae-9d23-be03e778d3dc/tasks/bya1tdihj.output</output-file>
<status>completed</status>
<summary>Background command "Copy repo with tar, install, build" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-01T02:31:39+00:00

```text
completion도 마찬가지로 취약점 점검필요함. 그 이후에 @~/Start.md 해당 문서를 보고 모두 최신 버전으로 재실행.
```

## Prompt — 2026-10-01T04:32:00+00:00

```text
kimsanghoon@instance-20260831-003739:~/process-gpt-vue3/scripts/security$ sh scan.sh 
scan.sh: 94: Syntax error: "(" unexpected (expecting "}")
```

## Prompt — 2026-10-01T04:33:09+00:00

```text
그럼 원랜 뭐로 실행해야햇음?
```

## Prompt — 2026-10-01T04:42:04+00:00

```text
커밋이랑 푸쉬 진행해.
```

## Prompt — 2026-10-01T05:55:18+00:00

```text
ghp_****(마스킹됨)

이거 매번 치기 귀찮은데 등록해서 쓸 수 없나?
```

## Prompt — 2026-10-01T06:04:22+00:00

```text


<pasted_content id="e03c">
Run Dependabot
Dependabot encountered an error performing the update

Error: The updater encountered one or more errors.

For more information see: https://github.com/uengine-oss/process-gpt-completion/network/updates/1601882486 (write access to the repository is required to view the log)
</pasted_content id="e03c">



completion error
```

<!-- backfilled-from: 0306a697-cb6c-4e2c-b797-bc854ce638bf -->

## Prompt — 2026-10-01T07:59:50+00:00

```text
프로세스 순서도에서 자동레이아웃 진행시, 진행중이라는걸 표시해줘야될 것 같음.
```

## Prompt — 2026-10-01T08:12:40+00:00

```text
편집모드에서 정렬버튼 눌렀을때도 보여야함.
```

## Prompt — 2026-10-01T08:14:32+00:00

```text
여전히 정렬중이라는 표시가 안보임. 따라서 정렬이 된건지 안된건지도 알 수 없음.
```

## Prompt — 2026-10-01T08:36:13+00:00

```text
정렬 두가지 모두 동작 안함. 
신규: 

<pasted_content id="30a4">
PaletteProvider.js:1095 신규 자동 정렬(열·행) 적용에 실패했습니다. TypeError: modeler.saveXML is not a function
    at planColumnRowLayout (column-row-layout.js:28:35
    at applyColumnRowLayout (column-row-layout.js:78:28
    at PaletteProvider.js:1088:7
</pasted_content id="30a4">


기존: 

<pasted_content id="30a4">
?먮룞?덉씠?꾩썐???ㅽ뙣?덉뒿?덈떎. Error: Structured layout invalid: unsupported-element:DIA_AuditPlan_PlanReport:bpmn:DataInputAssociation, unsupported-element:DIA_AuditorCert_Plan:bpmn:DataInputAssociation, unsupported-element:DIA_BizPlan_Plan:bpmn:DataInputAssociation, unsupported-element:DIA_CAR_CarIssue:bpmn:DataInputAssociation, unsupported-element:DIA_CM_CmSubmit:bpmn:DataInputAssociation, unsupported-element:DIA_CheckSheet_Audit:bpmn:DataInputAssociation, unsupported-element:DIA_MgmtReview_Plan:bpmn:DataInputAssociation, unsupported-element:DIA_PrevAudit_Plan:bpmn:DataInputAssociation, unsupported-element:DIA_Report_Deploy:bpmn:DataInputAssociation, unsupported-element:DOA_CarWrite_CAR:bpmn:DataOutputAssociation, unsupported-element:DOA_CarWrite_FindingLedger:bpmn:DataOutputAssociation, unsupported-element:DOA_CmWrite_CM:bpmn:DataOutputAssociation, unsupported-element:DOA_Plan_AuditPlan:bpmn:DataOutputAssociation, unsupported-element:DOA_Prepare_CheckSheet:bpmn:DataOutputAssociation, unsupported-element:DOA_Prepare_FindingLedger:bpmn:DataOutputAssociation, unsupported-element:DOA_ResultReport_Report:bpmn:DataOutputAssociation, unsupported-element:DOR_AuditPlan:bpmn:DataObjectReference, unsupported-element:DOR_AuditorCert:bpmn:DataObjectReference, unsupported-element:DOR_BizPlan:bpmn:DataObjectReference, unsupported-element:DOR_CAR:bpmn:DataObjectReference, unsupported-element:DOR_CM:bpmn:DataObjectReference, unsupported-element:DOR_CheckSheet:bpmn:DataObjectReference, unsupported-element:DOR_FindingLedger:bpmn:DataObjectReference, unsupported-element:DOR_MgmtReview:bpmn:DataObjectReference, unsupported-element:DOR_PrevAudit:bpmn:DataObjectReference, unsupported-element:DOR_Report:bpmn:DataObjectReference
    at BpmnAutoLayout.applyAutoLayout (bpmn-auto-layout.js:2608:15
    at PaletteProvider.js:1057:37
</pasted_content id="30a4">
```

## Prompt — 2026-10-01T08:55:36+00:00

```text
<task-notification>
<task-id>bbd83y13f</task-id>
<tool-use-id>toolu_01J99kZT77ctcZvYJBTcVjSp</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/0306a697-cb6c-4e2c-b797-bc854ce638bf/tasks/bbd83y13f.output</output-file>
<status>failed</status>
<summary>Background command "ls e2e/bpmn-auto-layout/ | head; git stash list | head -2; timeout 900 npx playwright test --config=playwright.bpmn-auto-layout.config.mjs --reporter=line 2&gt;&amp;1 | tail -30" failed with exit code 143</summary>
</task-notification>
```

## Prompt — 2026-10-01T09:12:40+00:00

```text
<task-notification>
<task-id>bjjny7ezi</task-id>
<tool-use-id>toolu_01Qyzs18VcEZ631YDFUtuT63</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/0306a697-cb6c-4e2c-b797-bc854ce638bf/tasks/bjjny7ezi.output</output-file>
<status>completed</status>
<summary>Background command "SP=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/0306a697-cb6c-4e2c-b797-bc854ce638bf/scratchpad; for f in bpmn-auto-layout bpmn-auto-orientation bpmn-layout-compare; do echo "== $f"; npx playwright test --config=playwright.bpmn-auto-layout.config.mjs $f.spec.mjs --reporter=list &gt; $SP/pw-$f.log 2&gt;&amp;1; echo "exit $?"; grep -E "✓|✘|passed|failed|flaky|timed out" $SP/pw-$f.log | tail -15; done" completed (exit code 0)</summary>
</task-notification>
```

<!-- backfilled-from: f0f380b2-2ae7-4252-9c2c-cbefed8d5a0a -->

## Prompt — 2026-10-02T03:33:49+00:00

```text
/speckit-run > 의도 (why & value)
각 Dashboard의 차트에서 기준값을 하드코딩이 아닌 직접 설정 할 수 있도록 변경하여, 기준값이 변경 될 때 마다 차트 계산 데이터를 직접 수정하는 것이 아닌 해당 기준 값만 변경 가능하도록 한다.

> 인수조건 (Definition of Done)
- dashboard 관련 각 차트 별 기준값 변경 기능
- 해당 기준값이 변경 될 때, 감사로그에 변경 이력이 남아있어야한다.

> 컨텍스트 (참고자료 위치)
- pi-system-backend Dashboard API
```

## Prompt — 2026-10-02T03:44:39+00:00

```text
<task-notification>
<task-id>b2w21hggd</task-id>
<tool-use-id>toolu_016jENkLVwiF3hPwQHDx84At</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/f0f380b2-2ae7-4252-9c2c-cbefed8d5a0a/tasks/b2w21hggd.output</output-file>
<status>completed</status>
<summary>Background command "npx prettier --write src/services/dashboardThresholdsService.ts src/views/analytics/DashboardThresholdSettings.vue &gt;/dev/null &amp;&amp; timeout 300 npx eslint -f unix src/services/dashboardThresholdsService.ts src/views/analytics/DashboardThresholdSettings.vue src/views/analytics/AnalysisDashboard.vue src/views/analytics/tabs/*.vue 2&gt;&amp;1 | grep -v "prettier/prettier" | grep -i "error" | head; timeout 400 npx vue-tsc --noEmit -p tsconfig.json 2&gt;&amp;1 | grep -E "dashboardThresholds|DashboardThresholdSettings|AnalysisDashboard.vue|tabs/(Exec|Oper|Gov|Model)" | head" completed (exit code 0)</summary>
</task-notification>
```

<!-- backfilled-from: 17697b9c-c4a5-4427-99a0-735bbdb3d70d -->

## Prompt — 2026-10-07T02:22:03+00:00

```text
/speckit-run > 의도 (why & value)
데이터 분석을 위한 Ontology Explorer의 구현. 전략부터 실행까지의 데이터를 각 Ontology화 하여 각 연관 관계를 분석 할 수 있다.  

> 인수조건 (Definition of Done)
- 전략페이지 고도화(/strategy-board)
- 전략맵 부터 프로세스 실행 결과까지의 데이터가 모두 이어지고, 한 화면에서 각 데이터의 연관관계를 파악 할 수 있어야 한다.
- Ontology Schemas
- Ontology Explorer 메뉴얼

> 컨텍스트 (참고자료 위치)
- process-gpt-strategy-skill
- process-gpt-strategy
- 쏠리드(SOLiD) AX 제안 전략 플랜.pdf
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

## Prompt — 2026-10-07T04:09:23+00:00

```text
1. start-all.sh에 strategy-service 추가해줘. 그리고 프로세스 체계도쪽 타이틀 스타일 깨짐.
2. 데이터를 더 많이 넣어서 문서화면 캡쳐해줘. 이건 앞으로 메뉴얼 작성시에도 항상 데이터는 많이 둬야함.
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

## Prompt — 2026-10-08T09:47:48+00:00

```text
<task-notification>
<task-id>a38ce604c97615af0</task-id>
<tool-use-id>toolu_01XVgEMLvJJumr6nT9eNVpwK</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/f5dde063-155e-4276-9652-d1473fe692c2/tasks/a38ce604c97615af0.output</output-file>
<status>completed</status>
<summary>Agent "Verify AX use-case sources" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result># AX 선도기업 사례 공개 출처 검증 (쏠리드 오프라인 브리핑용)

작성일: 2026-10-08 · 기준: 웹 공개 출처 · 표기: **[독립]** 제3자 집계·검증, **[회사]** 당사자·벤더 발표, **[정부]** 정부 보도자료 (사업 수혜 기업 자료를 정부가 집계한 것이라 독립 검증과는 다름)

---

## Ⅰ. 초안 사례 검증

### 1. Nokia: 통신사업자용 Agent Library
- **CASE 유형**: CASE1에 가깝습니다. 다만 사내 업무용이 아니라 **제품에 넣어 고객(사업자)에게 파는 에이전트**입니다.
- **준비**: Autonomous Networks Suite, MantaRay SMO 같은 기존 자동화 제품군이 있었습니다. 직전에 Google Cloud와 제휴해 Gemini 기반 에이전트를 제품에 넣기로 했습니다(2026-06-22).
- **실행**: DTW26(코펜하겐)에서 사전 구축형 에이전트 라이브러리를 발표했습니다. 대상 업무는 보안(제로데이 공격 식별), 어슈어런스(이상 징후 추론, 이벤트 트리아지를 통한 근본원인 분석), 서비스 운영(서비스 오더 실패 트러블슈팅), 멀티에이전트 협업입니다. NTT DOCOMO와는 SMO 기반 자율화(SON 시험, Non-RT RIC)를 함께 하고 있습니다.
- **성과**: "기존 운영 대비 생산성 향상이 통상 **60~80%**"라는 수치는 **[회사]** 주장입니다. 산정 방법과 고객 실측값은 공개되지 않았습니다. 고정망 분야에서는 1차 헬프데스크 해결률 50% 이상, 장애 판정 5분 이내, 재방문 50% 감소를 내세웠고 이것도 **[회사]** 수치입니다.
- **쏠리드 시사점**: O-RAN과 DAS 운용 툴에 "알람 트리아지·RCA 에이전트"를 넣는 **제품 측 AX** 참고 모델입니다. 사내 AX 사례로 인용하면 성격이 맞지 않습니다.
- **출처**: Nokia 보도자료(2026-06-23) https://www.nokia.com/newsroom/nokia-advances-autonomous-networks-portfolio-with-upgraded-agentic-ai-capabilities-dtw26-a/ · 재배포본 https://www.finanznachrichten.de/nachrichten-2026-06/68835541-nokia-oyj-nokia-advances-autonomous-networks-portfolio-with-upgraded-agentic-ai-capabilities-dtw26-399.htm · Intelligent CIO(2026-06-24) https://www.intelligentcio.com/eu/2026/06/24/nokia-upgrades-autonomous-networks-portfolio-with-new-agentic-ai-capabilities-for-telecom-operators/
- **확인 상태**: 수치는 **확인**했고 출처는 회사 보도자료입니다. **Light Reading 기사는 찾지 못했습니다.** 초안의 "Light Reading" 출처 표기는 "Nokia 보도자료(DTW26)"로 바꾸는 것을 권합니다. 초안이 "사내(internal) 에이전트"라고 쓴 부분도 사실과 다릅니다.

### 2. 서연이화: 4년 DX 위에 올린 제조 AI 에이전트
- **CASE 유형**: CASE2 (영역별 에이전트, 업무 프로세스·데이터 정비, 전사 확장 계획)
- **준비**: 약 4년 동안 계열사 지산소프트의 로우코드 플랫폼(LAMP7)으로 설계·생산기술·품질·원가 업무를 디지털화하고 프로세스와 데이터를 정비했습니다. 2026년을 "AX 원년"으로 정했습니다.
- **실행**: 대표 에이전트 4종을 개발·실증하고 있습니다.
  - 시험계획 자동 생성
  - 품질 개선대책서 작성 지원 (연간 약 2,000건 대상)
  - 조립공정 설계안 제시
  - 설비 고장 원인·대책 추천

  네 에이전트 모두 "에이전트가 초안을 내고 현업이 검토·확정"하는 방식입니다. 코난테크놀로지가 업무별 에이전트 20종을 공급하며 사업 기간은 약 8개월입니다(2026-08 착수 보도).
- **성과**: **정량 성과는 아직 공개되지 않았습니다.** 실증·개발 단계이고, 연 2,000건은 작업 규모이지 성과 수치가 아닙니다.
- **쏠리드 시사점**: 시험계획, 품질대책서, 설비보전은 쏠리드의 시험·인증 문서, 품질 8D, 외주 제조 품질 관리와 직접 겹칩니다. "DX로 데이터 기반을 먼저 다진 뒤 AX로 간다"는 순서를 보여주는 핵심 근거로 쓸 수 있습니다.
- **출처**: 헬로티 「[헬로AX] 4년간 닦은 DX 위에 AI 에이전트…車 부품 기업의 제조 AX 접근법」(2026-09-09, 이동재 기자) https://www.hellot.net/news/article.html?no=114868 · 이데일리(착수 보도) https://edaily.co.kr/News/Read?mediaCodeNo=257&amp;newsId=03145526645543712
- **확인 상태**: 내용은 **확인**했습니다. 성과 수치는 공개 출처로 확인할 수 없습니다.

### 3. 삼성SDS FabriX(패브릭스): 패키지형 에이전트 플랫폼
- **CASE 유형**: CASE3 (완성형 솔루션 도입)
- **준비·실행**: FabriX는 AI 랩(에이전트 제작), Chat, Store(자산 공유)로 구성됩니다. 로드맵은 1.7(2026-06, 프롬프트·워크플로 도구와 HITL 오케스트레이터)을 거쳐 2.0(2026-10, 에이전틱 앱과 역할 기반 협업)으로 이어집니다. 우리은행 "AI 에이전트 뱅킹" 사업은 에이전트 175개 이상 구축 계획이며, 삼성SDS가 우선협상대상자로 선정됐습니다.
- **성과(모두 [회사])**:
  - 도입 규모: 고객사 약 70곳, 사용자 13만 명 이상 (2025-06 기준). 2024-09 기사에는 "100여 개 기업·15만 명"으로 나오는데 집계 기준이 서로 다르니 최신값을 쓰는 것이 좋습니다.
  - 금융 고객 코드 전환 에이전트: 전환율 98.8%, 수작업 대비 비용 약 68% 절감
  - 경비 처리 1,500건: 24시간에서 5시간으로 단축
  - CES 2026 시연: 유해 콘텐츠 업무에서 하루 근무시간의 약 67%(5시간 20분) 절감 가능 (시나리오 기반 수치)
- **쏠리드 시사점**: 빨리 도입할 수 있는 대신 도메인 데이터 연결과 프로세스 재설계는 고객 몫으로 남습니다. 삼성SDS AX센터장도 "AI-ready 데이터, 프로세스 재설계, 에이전트 운영체계, 거버넌스가 함께 가야 한다"고 말했습니다.
- **출처**: 전자신문 WIS 2026(2026-04-22) https://www.etnews.com/20260422000359 · 전자신문 우리은행(2026-04-07) https://www.etnews.com/20260407000065 · 삼성SDS 뉴스룸(2025-06-26) https://www.samsungsds.com/kr/news/md-250626.html · 파이낸셜뉴스 CES(2026-01-08) https://www.fnnews.com/news/202601080930362490 · Daum/AX Summit(2026-05-29) https://v.daum.net/v/20260529174217469
- **확인 상태**: **확인**했습니다. 수치는 모두 회사 발표이며, 전자신문 WIS 기사 자체에는 수치가 없습니다.

### 4. 제조 AX(M.AX) 정책 통계: 산업통상부
- **CASE 유형**: 정책 맥락 (개별 기업 사례로는 CASE1·2 혼합)
- **실행**: AI 팩토리 선도 프로젝트로 사업장 170여 곳을 지원했습니다. M.AX 얼라이언스는 2025-09 출범했고 약 1,500개 기관, 11개 분과로 운영됩니다. 2030년까지 AI 팩토리 500개를 목표로 하고, 국가 제조데이터 라이브러리도 구축할 계획입니다.
- **성과([정부])**: **170곳 전체가 아니라 먼저 착수한 42개 사업장을 점검한 결과**, 생산성은 평균 **+30.1%**, 불량률은 평균 **−15.5%**였습니다. 개별 사례는 다음과 같습니다.
  - 서플러스글로벌: 생산성 +66.7%
  - 아산성우하이텍: 품질검사 시간 −90%
  - 화신: 불량률 −20%
  - HD현대삼호: 생산성 +50%
  - 신한다이아몬드: 검사시간 −33%
  - ENK: 검사시간 −22%
- **쏠리드 시사점**: 외주 제조 협력사와 함께 정부 사업에 참여하는 경로로 활용할 수 있습니다.
- **출처**: 산업통상부 보도자료(2026-08-04) https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/172084/view · 뉴시스(2026-08-04) https://www.newsis.com/view/NISX20260804_0003735272 · SBS Biz(2026-08-04) https://biz.sbs.co.kr/amp/article/20000326577
- **확인 상태**: 수치는 **확인**했고, **정정이 필요합니다.** 초안의 "170곳 도입 → 생산성 30%"는 "170곳 지원, 이 중 42곳 점검 결과 평균 30.1%·15.5%"로 고쳐야 합니다. **"LG전자 소재·설비·품질 데이터 연결"은 이 발표와 관련 기사에 나오지 않습니다(공개 출처 확인 불가).** 대신 쓸 수 있는 LG전자 근거는 Ⅱ-1에 정리했습니다.

### 5. Goldman Sachs: PoC 분산에서 핵심 영역 집중으로
- **CASE 유형**: CASE2 (전사 전략에 AI를 넣고 업무를 front-to-back으로 재설계)
- **준비**: GS AI Platform(2024)과 GS AI Assistant를 만들었고, Assistant는 직원 1만 명 이상에게 확대했습니다. Cognition의 Devin으로 자율 코딩 파일럿을 진행했습니다(2025-07).
- **실행**: 2025-10-14 "OneGS 3.0" 메모(Solomon·Waldron·Coleman 서명)에서 AI 기반 재설계 영역을 정했습니다. 2025 주주서한(2026-03 보도)에서 이를 6개 영역으로 명시했습니다: 고객 온보딩·KYC, 벤더 관리, 규제 보고, 대출, 전사 리스크관리, 세일즈 지원. Solomon은 Q4 실적 콜(2026-01-15)에서 "six specific processes"를 공략 중이라고 말했습니다. 인력 측면에서는 인원 증가를 억제하고 일부 직무를 축소합니다.
- **성과**: 정량 ROI는 **공개되지 않았습니다.** Solomon도 "향후 분기에 투명성을 높이겠다"고만 했습니다. 개발 쪽에서는 "코드의 최대 40%를 GenAI가 작성"한다는 CIO 발언이 있습니다([회사], CNBC·Fortune 2025).
- **출처**: Business Insider 재게재(AOL, 2025-10-14) https://www.aol.com/articles/goldman-sachs-cutting-jobs-unveils-174227773.html · Banking Exchange(2026-03-24) https://www.bankingexchange.com/news-feed/item/10579-goldman-sachs-puts-ai-at-core-of-new-strategy?Itemid=620 · The Stack(2026-01-19) https://www.thestack.technology/goldman-sachs-ceo-teases-6-specific-processes-its-attacking-with-ai/ · CNBC(2025-07-11) https://www.cnbc.com/2025/07/11/goldman-sachs-autonomous-coder-pilot-marks-major-ai-milestone.html
- **확인 상태**: 6개 영역 집중은 **확인**했습니다. **"약 100개 PoC에서 5~6개로 축소"는 공개 출처로 확인할 수 없습니다.** "PoC 100개"라는 숫자는 빼고 "전사 전략(OneGS 3.0) 아래 6개 핵심 프로세스에 집중"으로 표현하는 것을 권합니다.

---

## Ⅱ. 추가 사례

### 1. LG전자: 에이전트 96개를 만들었지만 1년 뒤 46개만 남음 (반면교사형 CASE2)
- **준비**: 사내 AI 플랫폼 LGenie를 운영하고 있으며 월간 활성 사용자는 약 3만 명입니다.
- **실행**: 지난해 에이전트 96개를 개발했고 현재 전사에서 125개가 운영 중입니다. 성과가 높은 에이전트는 광고 문구 규제 검토와 다국어 번역입니다. 번역 에이전트는 임원이 직접 부서 간 조율에 나서서 성공했습니다.
- **성과([회사], 컨퍼런스 발표)**: 96개 중 **46개만 생존(약 50%)**했습니다. 실패 원인은 "기술 중심 접근"이었습니다. 이후 에이전트 수 대신 대시보드로 에이전트별 생산성과 비용 절감을 측정하는 방식으로 바꿨습니다.
- **쏠리드 시사점**: "PoC를 많이 하는 것보다 현업 문제를 먼저 정의하는 것"이 중요하다는 점을 보여주는 국내 전자업계 근거입니다. 초안에서 Goldman의 "PoC 100개" 대목을 이 사례로 바꿔도 됩니다.
- **출처**: ZDNet Korea(Daum, 2026-05-27, 이경화 LG전자 AX플랫폼팀장 발표) https://v.daum.net/v/20260527175602742 · 확인 상태: **확인**

### 2. LG디스플레이: 제조 AI와 사무 어시스턴트 병행 (CASE2)
- **준비**: 자체 'AI 생산체계'를 만들었고, 사내 어시스턴트 HI-D를 자체 개발해 외부 솔루션 대비 100억 원 이상을 절감했다고 밝혔습니다.
- **실행**: 2025년을 "AX 혁신 원년"으로 정하고 모바일 OLED부터 전 공정으로 확대하고 있습니다.
- **성과([회사])**:
  - 이형 패널 설계: 30일에서 8시간으로 단축
  - 품질 개선: 3주에서 2일로 단축
  - 수율 향상으로 연 약 2,000억 원 수익성 개선
  - HI-D로 일평균 업무생산성 약 10% 향상
  - 3년 내 생산성 30% 향상은 **목표치**입니다.
- **출처**: 아주경제(2025-08-05) https://www.ajunews.com/view/20250805141250999 · 확인 상태: **확인** (자료가 2025년이라 다소 오래됐습니다)

### 3. LG이노텍: 입고 원자재 불량 판정 AI (공급망 품질, CASE1)
- **실행**: 소재 정보와 AI 영상처리를 결합해 입고 단계에서 원자재 불량을 판정합니다. RF-SiP 공정에 먼저 도입했고 FC-BGA로 확대했습니다.
- **성과([회사])**: 분석은 1분 이내, 정확도는 90% 이상이며, 불량 원인 분석 시간을 최대 90% 줄였습니다.
- **쏠리드 시사점**: 외주 제조 구조에서 공급사 자재 품질을 관리하는 데 참고할 수 있습니다. 쏠리드는 RF 부품 비중이 크다는 점에서도 관련성이 높습니다.
- **출처**: 스마트투데이 https://www.smarttoday.co.kr/ko-kr/articles/60457 · 확인 상태: 내용은 확인했지만 **기사 게시일을 확인하지 못했습니다**. 브리핑에 쓰기 전에 날짜를 확인해야 합니다.

### 4. ABB India: RFQ(견적·제안) 응답 생성형 AI (CASE3, RFP·제안 영역)
- **준비**: 복잡한 주문설계생산(ETO) 견적은 처리에 최대 20일이 걸렸습니다.
- **실행**: SAP Business AI 기반 생성형 AI로 RFQ 처리를 자동화했습니다.
- **성과([회사]이자 벤더 고객사례)**: 응답시간을 1~4일 단축했고, 사례 제목은 "20일에서 1일로"입니다. 연간 시간 절감 160만 일, 비용 절감 2,700만 달러는 **예상치(anticipated)**입니다.
- **쏠리드 시사점**: 해외 사업자 RFP와 장비 사양 회신 업무에 바로 대응되는 사례입니다.
- **출처**: SAP 고객사례(2025-07/08) https://www.sap.com/assetdetail/2025/07/aa9c7afc-127f-0010-bca6-c68f7e60039b.html · 확인 상태: 검색 결과로 확인했습니다. 원문 페이지는 접속이 차단(403)돼 직접 열람하지 못했습니다.

### 5. Ericsson: 운영지원 에이전트와 R&amp;D용 AI 협업 (CASE1 및 제품 측)
- **실행**:
  - 'Differentiated Support'(2026-02-17) 출시: 사업자 지원 티켓 작성과 장애 해결을 지원합니다.
  - Mistral AI와 협업(2026-02-20): 레거시 코드 전환, 6G 연구 지원, Networks 조직 내부 엔지니어링 워크플로 에이전트를 개발합니다.
  - Google Gemini Enterprise로 RCA 에이전트를 운영하며 "수 시간 걸리던 원인 파악을 수 분으로" 줄였다고 밝혔습니다(정량 수치 없음).
- **성과([회사], Ericsson 추정치)**: 티켓 작성 공수 최대 −80%, 장애 해결 최대 −70% 빨라짐, 보안 위협 식별 최대 −50%. 고객 실측값은 공개되지 않았습니다.
- **쏠리드 시사점**: 같은 통신장비 업계에서 레거시 코드 전환과 6G R&amp;D에 AI를 쓰는 방향을 보여줍니다. 쏠리드처럼 R&amp;D 비중이 70%인 회사에 맞는 영역입니다.
- **출처**: https://www.ericsson.com/en/news/2026/2/ericsson-unveils-differentiated-support · RCR Wireless https://www.rcrwireless.com/20260220/ai/ericsson-mistral-ai · https://cloud.google.com/customers/ericsson-gemini-enterprise · 확인 상태: **확인** (수치는 회사 추정치)

(참고) 삼성전자 DX부문은 임직원 2,500여 명이 실효성을 검증한 뒤 2026-06-12에 ChatGPT, Gemini, Claude를 공식 도입했습니다(CASE3). 성과 수치는 공개되지 않았습니다. 출처: 디지털데일리 https://www.ddaily.co.kr/page/view/2026061109275479555

---

## Ⅲ. 검증 요약 및 초안 정정

| # | 항목 | 상태 | 출처 성격 | 초안 정정·권고 |
|---|---|---|---|---|
| 1 | Nokia Agent Library 생산성 60~80% | 확인 | 회사 | 출처를 Light Reading에서 Nokia 보도자료(2026-06-23)로 변경(Light Reading 기사 미발견). "사내 에이전트"가 아니라 "사업자용 제품 에이전트" |
| 1 | Nokia RCA 에이전트 | 확인 | 회사 | 이벤트 트리아지 기반 RCA로 표현 |
| 2 | 서연이화 4년 DX와 4대 에이전트 | 확인 | 언론(헬로티 2026-09-09) | 실증 단계이며 **성과 수치는 공개 출처로 확인할 수 없음**. 코난테크 에이전트 20종·8개월 추가 가능 |
| 3 | FabriX 플랫폼 | 확인 | 회사 | 고객사 약 70곳·13만 명(2025-06). 수치는 모두 회사 발표 |
| 4 | M.AX 170곳 / +30% / −15% | 부분 확인 | 정부 | **170곳 지원 중 42곳 점검 결과 +30.1% / −15.5%**로 정정 |
| 4 | LG전자 소재·설비·품질 데이터 연결 | **공개 출처 확인 불가** | – | 삭제하거나 LG전자 대체 근거로 교체(96→46 교훈, 품질예측 AI 3~8시간→3분, 2025-03-27 보도자료) |
| 5 | Goldman 6개 영역 집중 | 확인 | 회사(메모·주주서한) | 6개 영역 목록 명시 |
| 5 | Goldman "PoC 약 100개 → 5~6개" | **공개 출처 확인 불가** | – | "PoC 100개" 삭제 |
| 추가 | LG전자 96→46 | 확인 | 회사(발표) | 신규 권장 |
| 추가 | LG디스플레이 30일→8시간, 연 2,000억 | 확인 | 회사 | 2025 자료 |
| 추가 | LG이노텍 입고검사 AI 90% | 확인(날짜 미확인) | 회사 | 사용 전 날짜 확인 |
| 추가 | ABB RFQ 20일→1일, 2,700만 달러 | 확인(2차 경로) | 벤더 고객사례 | 금액은 예상치로 표기 |
| 추가 | Ericsson −80% / −70% | 확인 | 회사 추정 | "추정치"로 표기 |

**공통 유의사항**: 이번에 확인한 수치 가운데 **독립 검증된 것은 하나도 없습니다.** 모두 회사, 벤더, 정부(수혜 기업 집계) 발표입니다. 브리핑 자료에는 "회사 발표 기준"이라는 각주를 다는 것을 권합니다.</result>
<usage><subagent_tokens>93565</subagent_tokens><tool_uses>56</tool_uses><duration_ms>296864</duration_ms></usage>
</task-notification>
```

<!-- backfilled-from: a8bbb5e3-5e40-4a82-872b-8374fe5c4515 -->

## Prompt — 2026-10-12T03:51:08+00:00

```text
1. PAL Mode 조직도 제대로 표시안됨.
```

## Prompt — 2026-10-12T06:48:23+00:00

```text
이어서 진행.
```

## Prompt — 2026-10-12T07:08:39+00:00

```text
https://github.com/uengine-oss/ontology-studio 이 프로젝트를 참고해서 진행한건지 확인해. 해당 프로젝트도 실행해보고.
```

## Prompt — 2026-10-12T07:09:58+00:00

```text
<task-notification>
<task-id>b0zxwvrqr</task-id>
<tool-use-id>toolu_017QZ7iq7JPtGuSqbRhyzsQ2</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/tasks/b0zxwvrqr.output</output-file>
<status>completed</status>
<summary>Background command "cd /home/kimsanghoon/ontology-studio &amp;&amp; docker compose up -d --build &gt; /home/kimsanghoon/logs/ontology-studio-build.log 2&gt;&amp;1; echo exit=$?; tail -15 /home/kimsanghoon/logs/ontology-studio-build.log; docker compose ps --format '{{.Name}}\t{{.Status}}\t{{.Ports}}'" completed (exit code 0)</summary>
</task-notification>
```

<!-- backfilled-from: 8ed00e2d-ec06-4060-8730-2622c3323b25 -->

## Prompt — 2026-10-12T07:20:48+00:00

```text
프로세스 체계도에서 새 프로세스 다이얼로그에서 도메인, 메가프로세스, 메이저 프로세스 입력으로 검색 되도록. 현재는 선택만 가능.
```

## Prompt — 2026-10-12T07:21:45+00:00

```text
<task-notification>
<task-id>bfxst0owz</task-id>
<tool-use-id>toolu_01VsggyFWTXKh2rVYt7SbT5B</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/tasks/bfxst0owz.output</output-file>
<status>failed</status>
<summary>Background command "cat &gt; ./.os-build.mjs &lt;&lt;'EOF'
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const OUT = process.env.OUT; const D = '/home/kimsanghoon/ontology-studio/demo/quality-sec/';
const brief = JSON.parse(fs.readFileSync(D + 'brief.json', 'utf8'));
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
const shot = async (n) =&gt; { await p.screenshot({ path: `${OUT}/${n}` }); console.log('shot', n, new Date().toISOString().slice(11,19)); };
await p.goto('http://localhost:15173/', { waitUntil: 'networkidle' });
await p.setInputFiles('input[type=file]', [D + '현대차증권_제1671회_ELB_투자설명서_발췌.txt', D + '상품마스터_202610.csv']);
await p.waitForTimeout(3000);
await p.click('text=다음'); await p.waitForTimeout(1000);
await p.click('text=다음'); await p.waitForTimeout(1500);
// 브리프 초안 생성이 끝나기를 기다렸다가 우리 의도로 덮는다
await p.waitForFunction(() =&gt; !document.body.innerText.includes('생성 중…'), null, { timeout: 180000 }).catch(() =&gt; console.log('draft still generating'));
await p.fill('textarea', brief.intent);
const gq = p.locator('input[placeholder*="Golden Question"]');
await gq.first().fill(brief.golden_questions[0]);
await p.click('text=질문 추가'); await p.waitForTimeout(300);
await gq.nth(1).fill(brief.golden_questions[1]);
await shot('06-brief-ready.png');
await p.click('text=이 브리프로 구축 시작');
const t0 = Date.now();
for (let i = 1; i &lt;= 30; i++) {
  await p.waitForTimeout(30000);
  const txt = await p.evaluate(() =&gt; document.body.innerText);
  const done = /구축(이)? (완료|끝)|완료되었습니다|보고/.test(txt) &amp;&amp; !/실행 중|진행 중/.test(txt.slice(-2000));
  if (i % 4 === 0 || done) await shot(`07-build-${String(i).padStart(2,'0')}.png`);
  console.log('t+', Math.round((Date.now()-t0)/1000), 's', done ? 'DONE?' : '');
  if (done) break;
}
await shot('08-build-final.png');
fs.writeFileSync(`${OUT}/page.txt`, await p.evaluate(() =&gt; document.body.innerText));
await b.close();
EOF
OUT=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/scratchpad/os timeout 1200 node ./.os-build.mjs 2&gt;&amp;1 | tail -40" failed with exit code 144</summary>
</task-notification>
```

## Prompt — 2026-10-12T07:21:52+00:00

```text
<task-notification>
<task-id>bkbbre7co</task-id>
<tool-use-id>toolu_01TN81sBW63p1MpZqaSQzYJv</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/tasks/bkbbre7co.output</output-file>
<status>completed</status>
<summary>Background command "until grep -q "06-brief-ready" /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/tasks/bfxst0owz.output 2&gt;/dev/null; do sleep 5; done; until grep -q "t+" /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/tasks/bfxst0owz.output; do sleep 5; done; docker logs --since 3m ontology-backend 2&gt;&amp;1 | grep -iE "error|exception|status_code|40[0-9]|429" | tail -12; tail -4 /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/tasks/bfxst0owz.output" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-12T07:22:40+00:00

```text
<task-notification>
<task-id>b8aqhhv9x</task-id>
<tool-use-id>toolu_019NdaPPX3Sqp28ZUsD8wQJt</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/tasks/b8aqhhv9x.output</output-file>
<status>completed</status>
<summary>Background command "OUT=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/scratchpad/os timeout 1500 node ./.os-build.mjs &gt; /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/a8bbb5e3-5e40-4a82-872b-8374fe5c4515/scratchpad/os-build.log 2&gt;&amp;1; echo exit=$?" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-12T07:22:40+00:00

```text
<task-notification>
<task-id>bl027h0ep</task-id>
<summary>Monitor event: "ontology-studio build progress"</summary>
<event>name: 'TimeoutError'</event>
</task-notification>
```

## Prompt — 2026-10-12T07:24:29+00:00

```text
<task-notification>
<task-id>b0ejms3hq</task-id>
<summary>Monitor event: "ontology-studio build (chat continue)"</summary>
<event>07:23:25 sent</event>
</task-notification>
```

## Prompt — 2026-10-12T07:24:29+00:00

```text
<task-notification>
<task-id>b0ejms3hq</task-id>
<summary>Monitor event: "ontology-studio build (chat continue)"</summary>
<event>07:24:25 poll 3 {"running":false}</event>
</task-notification>
```

## Prompt — 2026-10-12T07:30:02+00:00

```text
<task-notification>
<task-id>b28po4s10</task-id>
<summary>Monitor event: "ontology-studio build v3 (Azure)"</summary>
<event>07:28:06 shot 20-brief-draft.png
07:28:07 shot 21-brief-ready.png
07:28:07 build started</event>
</task-notification>
```

## Prompt — 2026-10-12T07:30:02+00:00

```text
<task-notification>
<task-id>b28po4s10</task-id>
<summary>Monitor event: "ontology-studio build v3 (Azure)"</summary>
<event>07:28:22 t+ 15 s idle</event>
</task-notification>
```

## Prompt — 2026-10-12T07:30:02+00:00

```text
<task-notification>
<task-id>b28po4s10</task-id>
<summary>Monitor event: "ontology-studio build v3 (Azure)"</summary>
<event>07:28:37 t+ 30 s idle</event>
</task-notification>
```

## Prompt — 2026-10-12T07:30:02+00:00

```text
<task-notification>
<task-id>b28po4s10</task-id>
<summary>Monitor event: "ontology-studio build v3 (Azure)"</summary>
<event>07:28:52 t+ 45 s idle</event>
</task-notification>
```

## Prompt — 2026-10-12T07:30:02+00:00

```text
<task-notification>
<task-id>b28po4s10</task-id>
<summary>Monitor event: "ontology-studio build v3 (Azure)"</summary>
<event>07:29:07 t+ 60 s idle</event>
</task-notification>
```

## Prompt — 2026-10-12T07:30:02+00:00

```text
<task-notification>
<task-id>b28po4s10</task-id>
<summary>Monitor event: "ontology-studio build v3 (Azure)"</summary>
<event>07:29:22 t+ 75 s idle</event>
</task-notification>
```

## Prompt — 2026-10-12T07:30:02+00:00

```text
<task-notification>
<task-id>b28po4s10</task-id>
<summary>Monitor event: "ontology-studio build v3 (Azure)"</summary>
<event>07:29:37 t+ 90 s idle
07:29:52 t+ 105 s idle</event>
</task-notification>
```

## Prompt — 2026-10-12T07:52:06+00:00

```text
<task-notification>
<task-id>bl027h0ep</task-id>
<summary>Monitor event: "ontology-studio build progress"</summary>
<event>[Monitor expired after 30m with 1 event delivered. Re-arm it if you still need the watch.]</event>
</task-notification>
```

## Prompt — 2026-10-12T07:52:28+00:00

```text
프로세스 순서도에서 속성값 저장 및 서버 저장 안됨. 이전에 해킹때문에 db권한에 대한 이슈때문인거같은데 확인좀.
```

## Prompt — 2026-10-12T07:53:25+00:00

```text
<task-notification>
<task-id>b0ejms3hq</task-id>
<summary>Monitor event: "ontology-studio build (chat continue)"</summary>
<event>[Monitor expired after 30m with 2 events delivered. Re-arm it if you still need the watch.]</event>
</task-notification>
```

## Prompt — 2026-10-12T07:55:59+00:00

```text
저장시 계속 스피너만 돌고있음.
```

## Prompt — 2026-10-12T07:57:36+00:00

```text
한국어로 대답해.
```

## Prompt — 2026-10-12T07:58:51+00:00

```text
저장 눌렀음
```

## Prompt — 2026-10-12T08:01:39+00:00

```text
응 타임아웃 시 실패 메시지 띄우게 고쳐줘. 그리고 gcp cloud에서 뭔가 설정으로 해당 인스턴스쪽 (이전 해킹으로) 차단한게 있었는지도 검토 필요함.
```

## Prompt — 2026-10-12T08:03:30+00:00

```text
데모 시연시에는 고정된 IP를 사용 할 수 없으니 우선 열어두는 방향으로 진행하는게 좋을 것 같음.
```

## Prompt — 2026-10-12T08:04:13+00:00

```text
<task-notification>
<task-id>btevnt598</task-id>
<tool-use-id>toolu_015gCMXrGyg1w2gBU25goBgr</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/8ed00e2d-ec06-4060-8730-2622c3323b25/tasks/btevnt598.output</output-file>
<status>completed</status>
<summary>Background command "S=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/8ed00e2d-ec06-4060-8730-2622c3323b25/scratchpad; for i in $(seq 1 720); do docker exec supabase_kong_process-gpt-vue3 sh -c 'cd /usr/local/kong/client_body_temp &amp;&amp; for f in *; do [ -f "$f" ] &amp;&amp; echo "$(date +%T) $f $(wc -c &lt; $f)"; done' 2&gt;/dev/null; sleep 0.5; done &gt; $S/kongbody.log; echo done" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-12T08:08:16+00:00

```text
일단 전체 서버 키 변경.
```

## Prompt — 2026-10-12T08:09:34+00:00

```text
tym 테넌트에 ontology-studio MCP도 연결해줘
```

## Prompt — 2026-10-12T08:11:24+00:00

```text
OPEN AI KEY - [REDACTED-OPENAI-KEY]
```

## Prompt — 2026-10-12T08:19:22+00:00

```text
listDefinition 쪽에서 error in list: column proc_def.undefined does not exist 42703 오류나는데 원인좀.
```

## Prompt — 2026-10-12T08:20:50+00:00

```text
오류 발생 상황은 프로세스 순서도에서 패널을 여느라 Task를 우클릭 할때마다 나옴.
```

## Prompt — 2026-10-12T08:24:42+00:00

```text
<task-notification>
<task-id>b4f4u2xpx</task-id>
<tool-use-id>toolu_014ugfYivpY2fsUoW7VyRxi2</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/8ed00e2d-ec06-4060-8730-2622c3323b25/tasks/b4f4u2xpx.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3; grep -n "withTenantMatch(options)" -B2 -A2 src/components/api/ProcessGPTBackend.ts | head; npx vue-tsc --noEmit -p tsconfig.json 2&gt;&amp;1 | grep -E "PalModeBackend|ProcessGPTBackend.ts\(30" | head -5" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-12T08:31:31+00:00

```text
프로세스 순서도 우측 속성 패널에서 산출물(Input/Output) 제거.
```

<!-- backfilled-from: 1e5c6a74-c3ac-4b42-99e1-ed0ff2b6b0eb -->

## Prompt — 2026-10-12T11:35:48+00:00

```text
프로세스 순서도에서 PAL모드 pi-flag등록 버튼 누를 시 속성패널에서 바로 입력부분으로 이동. 현재는 반응 없음. 묶음 PI-Flag도 마찬가지로 동작안함. 묶음 등록 시, 선택된 목록 보여주면서 입력창 보이도록.
```

## Prompt — 2026-10-12T11:49:59+00:00

```text
브라우저에서 직접 눌러보고 확인해줘
```

## Prompt — 2026-10-12T15:22:54+00:00

```text
프로세스 삭제 안됨.
```

## Prompt — 2026-10-14T02:02:53+00:00

```text
현재 전략보드부터 온톨로지 관련 데이터가 모두 안보임. 서버 실행여부 확인하고 서비스에도 등록. 정상적으로 동작하는 것까지 확인해.
```

## Prompt — 2026-10-14T02:26:48+00:00

```text
현재 아키텍처 구조부터 모두 문서로 정리해봐.
```

## Prompt — 2026-10-14T03:43:42+00:00

```text
후속과제 진행해보고 ontological-db는 혹시 데이터 이중화가 되는게 아닌가도 봐봐.
```

## Prompt — 2026-10-14T03:54:06+00:00

```text
<task-notification>
<task-id>byx8xvqbo</task-id>
<tool-use-id>toolu_01LhQwba44mu5fcuzWqerkZv</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/274c8192-546c-477a-b0a0-cfc3c03406eb/tasks/byx8xvqbo.output</output-file>
<status>completed</status>
<summary>Background command "Wait two sync cycles then measure audit rows" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-14T04:08:04+00:00

```text
<task-notification>
<task-id>b1qfwsbby</task-id>
<tool-use-id>toolu_01DHZrnNes3ogB71WnZTdg4t</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/274c8192-546c-477a-b0a0-cfc3c03406eb/tasks/b1qfwsbby.output</output-file>
<status>completed</status>
<summary>Background command "Wait then measure audit rows after throttle" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-14T04:25:42+00:00

```text
현재 스키마도 정리해보고, 추가되면 좋은 레이어나 데이터도 뽑아봐.
```

## Prompt — 2026-10-14T04:56:47+00:00

```text
1. 시스템·데이터·문서는 필요해보임.
2. 프로세스 아키텍처도 필요해보임.
3. 그럼 프로세스가 변경 될 때, 기타 프로세스에 대한 영향도도 ontology로 분석이 가능한지도 검토.
```

## Prompt — 2026-10-14T05:32:03+00:00

```text
정의 화면에서 시스템·데이터 입력되는지 확인해봐
```

## Prompt — 2026-10-14T06:08:21+00:00

```text
앞으로 답변은 한국어로 해줘.
```

## Prompt — 2026-10-14T06:09:25+00:00

```text
tym에 시스템 등록하고 태스크당 여러 개 선택 가능하게 해줘.tym에도 solid와 같은 동작하도록.
```

## Prompt — 2026-10-14T08:01:28+00:00

```text
온톨로지 스키마에는 문서관련된 내용이 있는데, 익스플로러에선 안보임.
```

## Prompt — 2026-10-14T08:24:42+00:00

```text
근데 스키마 기준에 따라서 익스플로러에서도 보이는게 맞지 않은지?
```

<!-- backfilled-from: 5f59ad80-aebc-46d1-9315-edf26e7c715c -->

## Prompt — 2026-10-15T06:04:23+00:00

```text
/speckit-run 현재 구현된 Ontology Explorer의 기능을 테스트하기위해 프로세스 생성부터 프로세스 실행, 실행 과정 중 Agent가 Ontology 데이터 사용, Ontology를 통한 분석까지 일렬의 과정을 모두 실행하고, 기능을 설명하는 가이드 문서와 동영상으로도 만들어줘.
```

## Prompt — 2026-10-15T06:41:40+00:00

```text
<task-notification>
<task-id>b354amylq</task-id>
<tool-use-id>toolu_01DePtUMTMTzj3J8TdPhre1e</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/5f59ad80-aebc-46d1-9315-edf26e7c715c/tasks/b354amylq.output</output-file>
<status>completed</status>
<summary>Background command "cd /home/kimsanghoon/process-gpt-vue3 &amp;&amp; cat &gt; scripts/demo/ontology-e2e/make-audio.sh &lt;&lt;'EOF'
#!/usr/bin/env bash
# 온톨로지 E2E 가이드 영상 나레이션(edge-tts, ko-KR).
#   bash scripts/demo/ontology-e2e/make-audio.sh [보이스]
# 원고 docs/manuals/video/ontology-e2e-guide/narration/sN.txt → 음성 .../audio/sN.mp3
set -euo pipefail
cd "$(dirname "$0")/../../.."
VOICE="${1:-ko-KR-HyunsuMultilingualNeural}"
DIR=docs/manuals/video/ontology-e2e-guide
mkdir -p "$DIR/audio"
for f in "$DIR"/narration/s*.txt; do
    n=$(basename "$f" .txt)
    echo "TTS: $n"
    uvx edge-tts --voice "$VOICE" --rate=+4% --file "$f" --write-media "$DIR/audio/$n.mp3"
done
EOF
chmod +x scripts/demo/ontology-e2e/make-audio.sh &amp;&amp; bash scripts/demo/ontology-e2e/make-audio.sh 2&gt;&amp;1 | tail -3; ls -la docs/manuals/video/ontology-e2e-guide/audio" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-15T07:46:57+00:00

```text
upstage로 사용하지말고, 기존키로 변경. 그리고 영향가설 이건 승인버튼이 활성화가 안되는데 원인은?
그리고 8081에서 테스트하고있는지도 검토.
```

## Prompt — 2026-10-15T08:18:50+00:00

```text
8081로 진행해야함.
```

<!-- backfilled-from: 1be3c856-3a32-4955-8b67-d53b88026efc -->

## Prompt — 2026-10-19T06:42:26+00:00

```text
strategy-board, 온톨로지 익스플로러, 온톨로지 스키마 디자인 스타일 변경. 조금 더 모던(현대화) 된 스타일로 보였으면 좋겠음. 그리고 사용성 및 성능또한 고려하여 작업해야함. UI/UX Pro Max - Design Intelligence스킬을 설치해서 사용하도록 해.
```

## Prompt — 2026-10-19T07:04:07+00:00

```text
온톨로지 익스플로러에서 현재는 접기가 보기설정에만 있는데, 각 헤더에서도 접을 수 있도록.
```

## Prompt — 2026-10-19T08:34:23+00:00

```text
조직정보도 함께 있으면 좋겠음.
```

## Prompt — 2026-10-19T08:34:58+00:00

```text
조직정보도 함께 있으면 좋겠음. Lane은 개개인의 역할도 있을 수 있지만, Lane은 특정 조직에서 할당해서 작업해야 하는 경우도 있기 때문임.
```

## Prompt — 2026-10-19T08:35:53+00:00

```text
필요하다면 조직도 정보도 함께 사용하는게 좋을 것 같음.
```

## Prompt — 2026-10-19T09:17:29+00:00

```text
이번 세션에서는 8081 포트에 올라가있는 서비스 기준으로 진행해 .
1. 남은점 진행.
2. 프로세스가 실제로 실행 할 수 있는 화면이 없는 것 같고 테스트로 진행된 인스턴스도 완료된 인스턴스 목록에서 보이지않음. 어떤식으로 실행하는지?
3. Task 설정 화면이 아무것도 안나옴.
```

## Prompt — 2026-10-19T09:39:59+00:00

```text
<task-notification>
<task-id>bs743y24x</task-id>
<tool-use-id>toolu_018UVdJr5TYr4m8N5c2rLq5S</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/tasks/bs743y24x.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-strategy &amp;&amp; timeout 900 .venv/bin/python -m pytest -q -p no:cacheprovider -x -q 2&gt;&amp;1 | tail -4" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-19T09:45:44+00:00

```text
<task-notification>
<task-id>b0izsoj7v</task-id>
<tool-use-id>toolu_01HKFra13skmvsWBY9VneAYn</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/tasks/b0izsoj7v.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-strategy &amp;&amp; timeout 1200 .venv/bin/python -m pytest -q -p no:cacheprovider 2&gt;&amp;1 | tail -8" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T02:16:07+00:00

```text
1. 프로세스 순서도는 PAL에서 사용되는 구조임. 기존 BPM모드를 확인해.
2. 기존 BPM모드로 사용 가능해야함.
3. /speckit-run 

<pasted_content id="2812">
> 의도 (why & value)
데이터 분석을 위한 Ontology Explorer의 구현. 전략부터 실행까지의 데이터를 각 Ontology화 하여 각 연관 관계를 분석 할 수 있다.

> 인수조건 (Definition of Done)
- 전체 데모 시나리오 (유형 별)
  - 1. 정상적으로 전략 및 KPI에 따른 진행
  - 2. 2가지 이상의 상충 된 전략 및 KPI로 인한 판단이 필요한 경우.
  - 2.1 전략 및 KPI에 우선순위 설정하여 Agent에서 전략 및 KPI 선택하여 진행
  - 2.2 해당 Task에서 Agent가 유저 Input을 요청 받아 처리 진행.
- 각 데모 유형 별 테스트 진행 문서 및 설명 영상

> 컨텍스트 (참고자료 위치)
- ontology-studio
- ontology-explorer-manual
</pasted_content id="2812">
```

## Prompt — 2026-10-20T02:17:29+00:00

```text
1. 프로세스 순서도는 PAL에서 사용되는 구조임. 기존 BPM모드를 확인해.
2. 기존 BPM모드로 사용 가능해야함.
3. /speckit-run 

<pasted_content id="2812">
> 의도 (why & value)
Ontology 기능의 고도화. Ontology화 된 데이터를 이용하여 프로세스 실행 중 Agent가 판단하는 근거가 될 수 있다.

> 인수조건 (Definition of Done)
- 전체 데모 시나리오 (유형 별)
  - 1. 정상적으로 전략 및 KPI에 따른 진행
  - 2. 2가지 이상의 상충 된 전략 및 KPI로 인한 판단이 필요한 경우.
  - 2.1 전략 및 KPI에 우선순위 설정하여 Agent에서 전략 및 KPI 선택하여 진행
  - 2.2 해당 Task에서 Agent가 유저 Input을 요청 받아 처리 진행.
- 각 데모 유형 별 테스트 진행 문서 및 설명 영상
</pasted_content id="2812">
```

## Prompt — 2026-10-20T02:19:33+00:00

```text
<task-notification>
<task-id>aa67f6dcaf04f6a28</task-id>
<tool-use-id>toolu_011Bv4qMQYNBdQnwttdRN5MY</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/aa67f6dcaf04f6a28.output</output-file>
<status>completed</status>
<summary>Agent "Strategy priority &amp; conflict data" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>Short answer: the only ranking concept today is `importance` (1-5) on strategies and KPIs. There is no separate "priority" and no conflict or trade-off concept. No MCP tool directly answers "for this process or task, which strategies and KPIs apply and with what priority". Paths below are under `/home/kimsanghoon/process-gpt-strategy` unless they start with `src/`, which is `/home/kimsanghoon/process-gpt-vue3`.

## 1. Data model, storage, CRUD

**Where it's stored**
- The live store is the Apache AGE graph `corp_ontology` (`app/config.py:43`). CRUD goes through `get_graph_store()` (`app/main.py:154-166`) into `app/strategy_ops.py`.
- The relational tables in `app/database.py:18-57` (`strategy_objectives`, `strategy_kpis`, `strategy_initiatives`) look legacy. They have no `importance` or `kpi_role` columns. `app/migration.py` moves them into the graph.

**Strategy (objective) fields** (`app/schemas.py:24-31`, `app/graph/schema.py:182`)
- `name`, `description`, `perspective` (financial, customer, internal_process, learning_growth), `parents` (stored as `HAS_SUB_STRATEGY` edges), `sort_order`.
- `importance`: integer 1-5, defaults to 3 (`strategy_ops.py:111`).

**KPI fields** (`app/schemas.py:34-58`, `app/graph/schema.py:188`)
- `objective_id` (stored as a `HAS_KPI` edge), `unit`, `measure_type`, `form_field`, `proc_def_id`, `direction` (default "increase"), `baseline_value`, `target_value`, `current_value`, `period_start`, `period_end`, `survey_questions`, `source_url`, `source_field`.
- `kpi_role`: "leading" or "lagging" (`:56`).
- `importance`: 1-5, defaults to 3 (`strategy_ops.py:134`).

**Weight**
- The only `weight` is a property on `IMPACTS_KPI` edges (`tests/graph_contract.py:100-110`).
- `app/process_impact.py:271-279` has its own internal per-bridge weights for scoring impact.

**CRUD endpoints** (`app/main.py`)
- Strategy map: `GET` and `DELETE /api/map` (143, 148).
- Objectives: `POST /api/objectives` (154), `PUT` and `DELETE /api/objectives/{id}` (159, 167).
- KPIs: `POST /api/kpis` (172), `PUT` and `DELETE /api/kpis/{id}` (177, 185), `POST /api/kpis/{id}/value` (190), `GET /api/kpis/{id}/measurements` (198).
- Initiatives: `POST`, `PUT`, `DELETE` (219-232).
- AI helpers: `POST /api/ai/suggest` (253), `POST /api/ai/alignment` (261).
- `POST /api/migrate-graph/importance` (351) fills in `importance` where it's missing.
- `PUT` replaces the whole object (it takes the full `ObjectiveIn` / `KpiIn` body). There is no partial update just for importance.

**How importance is used**
- Contribution scoring is share × the parent strategy's importance (`app/contribution.py:195-201, 236-269, 339-357`). Endpoints: `/api/contribution/kpi|strategy|performer/{id}` (278, 301, 318).
- Objective achievement is a KPI-importance-weighted average, computed in the frontend (`StrategyBoard.vue:699-711`, `src/components/strategy/ontology/ontologyLineage.js:208`).

**Priority**
- None. The only hits for "priority" are `importance`.

**Conflicts / trade-offs**
- None. Searching for `CONFLICTS_WITH`, tradeoff, 상충 and conflict only finds SQL `on conflict` clauses.
- The relationship list (`app/graph/schema.py:55-84`) has nothing for strategy-to-strategy or KPI-to-KPI tension. The only strategy-to-strategy edge is `HAS_SUB_STRATEGY`.

## 2. Process-to-KPI links and the "what applies here" lookup

**How processes link to KPIs**
- `IMPACTS_KPI` (Process to KPI) is created from `KPI.proc_def_id` (`strategy_ops.py:235-241`). It is re-linked when `proc_def_id` changes (`:348-353`). Schema entry: `app/graph/schema.py:305`.
- `INFLUENCES_KPI` (Process to KPI) is a statistical hypothesis a person has approved (`schema.py:306`; `app/causal_hypotheses.py`, endpoints `/api/causal/*` at 255-267).
- Initiatives can also carry a `proc_def_id` (`strategy_ops.py:244`).

**Closest existing lookups** (none of them is a ranked answer for a process or task)
- **`POST /api/ai/alignment`** (`app/ai.py:219-260`)
  - Takes free text and returns up to 5 matching Strategy/KPI candidates, by LLM or keyword overlap.
  - If you pass `proc_def_id`, it also returns `existing_connections`: the KPIs on that process's `IMPACTS_KPI` edges and their parent strategy.
  - It does not return importance, priority, direction or target. It is not exposed as an MCP tool. The frontend calls it from `strategyStore.ts:98` and `StrategyBoard.vue:100-136`.
- **`ontology_trace`** walks from a Process or Task node up to KPIs and strategies. It returns raw nodes, so `importance` is in the properties but nothing is ranked.
- **`GET /api/impact/process/{proc_def_id}`** (`app/impact_analysis.py:633`) and its MCP version give the KPIs affected by a change, not the "governing" strategies.
- **`GET /api/impact/kpi/{id}`** and **`GET /api/impact/strategy/{id}`** (`impact_analysis.py:482, 517`) work in the other direction (strategy or KPI down to execution).

**All MCP tools** (`app/mcp_server.py`; they delegate to `app/ontology_tools.py:21-82`)
1. `ontology_schema()` (line 72): layers, node and relationship types, and node counts for the tenant.
2. `ontology_resolve_entity(text, class_name="", context="", limit=5)` (81): turns a name into a node id. Status is resolved, ambiguous or no_match.
3. `ontology_get_node(node_id)` (95): one node's properties plus its direct neighbours.
4. `ontology_trace(node_id)` (101): the chain up to strategy and down to execution, assignees and skills, plus `node_ids`.
5. `ontology_kpi_root_cause(kpi_id)` (111): a deterministic trace of why a KPI is below target (processes, bottleneck tasks, assignees, skills, ranked by contribution).
6. `ontology_process_change_impact(proc_def_id, changed_tasks=None, use_versions=False)` (119): the other processes and KPIs affected by a process change, rated high/medium/low with reasons.
7. `ontology_list_nodes(label, name_contains="", limit=50)` (131): lists nodes of one type.

`app/ontology_ask.py` (`POST /api/ontology/ask`, line 218) is an LLM agent that uses these same read-only tools. Its system prompt is at lines 26-38.

## 3. Strategy board UI (`src/views/strategy/StrategyBoard.vue`)

- The choices are `IMPORTANCE_LEVELS = [1, 2, 3, 4, 5]` (line 255).
- **Objective importance**: a `v-select` in the objective dialog (1429-1437; form defaults at 259 and 269). `saveObjective` calls `store.updateObjective` or `store.createObjective` (276-277). The card shows a star badge with the value (954-959).
- **KPI importance editing exists**: a `v-select` in the KPI dialog (1559-1565; defaults at 353 and 375). It saves through `store.updateKpi` (418; store at `strategyStore.ts:62`).
- Importance is also shown in the contribution breakdown (1349, 1758-1767) and in the ontology explorer's property labels (`src/components/strategy/ontology/StrategyOntologyExplorer.vue:706`).
- There is no inline or quick editor. Importance can only be changed in these dialogs, and saving sends the full PUT body.

## Gaps for your feature
- There is no `priority` field that is separate from `importance`.
- There is no conflict or trade-off relationship.
- No MCP tool takes a process or task and returns the applicable strategies and KPIs with importance, direction and target. The closest are `/api/ai/alignment` with `proc_def_id` (REST only, no importance) and `ontology_trace` (unranked).</result>
<usage><subagent_tokens>45218</subagent_tokens><tool_uses>10</tool_uses><duration_ms>61397</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-20T02:22:04+00:00

```text
<task-notification>
<task-id>a173981be69dd0aa2</task-id>
<tool-use-id>toolu_01Q1aQVb35CBghhGUwYitDuW</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/a173981be69dd0aa2.output</output-file>
<status>completed</status>
<summary>Agent "Engine agent task &amp; HITL" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I read the code paths below and changed no files. The short version: this polling service runs only serviceTasks with MCP tools, and only for workitems in `SUBMITTED` or `PENDING`. Agent-assigned userTasks (`COMPLETE` or `DRAFT`) are run by separate agent services. The pause-and-ask-the-user loop exists, but in those agent services and the Vue UI, not in this repo's MCP path.

## 1. How the polling service runs a workitem

**Picking up work**
- `polling_service/database.py:909-948` picks up rows from `todolist` where `status='SUBMITTED'` and `consumer` is null, then claims them by setting `consumer` to the pod id. `database.py:989` does the same for `PENDING`.
- `database.py:1016-1045` frees claims that have not been updated for over 30 minutes.

**Dispatch** (`polling_service/polling_service.py:44-81`)
- `SUBMITTED`: the service looks up the activity's `type` in the process definition.
  - `usertask`, `scripttask`, `manualtask` and `callactivity` go to `handle_workitem` (`workitem_processor.py:4675`).
  - `servicetask` goes to `handle_service_workitem` (`workitem_processor.py:5026`).
- `PENDING` goes to `handle_pending_workitem` (`:5308`). This only handles a parent subprocess waiting for its child instances. It is not used for asking the user anything.
- On any exception, `retry` goes up by 1. At 3 or more the workitem is forced to `DONE` with an error log (`polling_service.py:83-100`). The claim is always released afterwards (`:103-108`).

**`agent_mode` values**
- `determine_agent_mode` is at `polling_service/database.py:2323-2369`.
- If the activity's `agentMode` is set and is not "none" or "null", it is uppercased and used as is.
- Otherwise it is worked out from the assignees:
  - users and agents together: `DRAFT`
  - agents only: `COMPLETE`
  - users only: `None`
- The code knows only `None`, `DRAFT` and `COMPLETE`.

**Orchestration values (`agent_orch`)**
- It comes from the activity's `orchestration` field, and "none" becomes `None` (`database.py:1223-1225`, `1539-1543`, `1850-1854`).
- If the mode is `COMPLETE` and there is no orchestration, it defaults to `'crewai-deep-research'` (`database.py:1493-1494`, `1542-1543`, `1853-1854`).
- Ad-hoc child workitems are hardcoded to `agent_mode="COMPLETE"`, `agent_orch="deepagents"` (`workitem_processor.py:1391-1392`, `1635-1636`).
- Other values seen: `crewai-action` (summarization branch, `database.py:2741`), `browser-automation-agent` (commented out, `:1739`), and `deep-research-custom`, which the deep-research worker filters on (`/home/kimsanghoon/process-gpt-deep-research/src/db.py:32`).
- These rows are created with status `IN_PROGRESS` or `TODO`, so this service never runs them. External workers pick them up by `agent_orch`, for example through the `deep_research_fetch_pending_task` RPC in that same file.

**Query given to external agents** (`database.py:1628-1691`)
- It is built as `[Description]\n{activity.description}`, then `[Instruction]\n{activity.instruction}`, then `[InputData]\n{json}`.
- The input data comes from `get_input_data_with_file_parsing`, which includes previous form outputs and parsed files (`database.py:1496-1516`, `1669-1691`).

**ServiceTask with MCP** (`polling_service/mcp_processor.py`)
- **Which servers are used:**
  - The engine reads `tenants.mcp` from the database (`fetch_tenant_mcp_config`, `polling_service/database.py:2393-2413`), not the repo's `mcp.json`.
  - The repo-root `/home/kimsanghoon/process-gpt-completion/mcp.json` is only a static catalog of examples and is not used at runtime.
  - The agent's `tools` field is a comma-separated list of MCP server names. Only servers whose names appear in `tenants.mcp.mcpServers` are used (`mcp_processor.py:59-94`).
- **Config conversion:**
  - Each entry goes through `adapter_configs` (new, untracked file `polling_service/mcp_adapter_config.py:26-45`).
  - This drops UI-only keys and servers marked `enabled:false`. It maps `type: http|url` to `streamable_http` and `sse` to `sse`, and stdio servers to `stdio`.
  - The result feeds `MultiServerMCPClient(...).get_tools()` (`mcp_processor.py:96-121`).
- **Pinning one tool:** if the activity's `tool` is `"mcp:&lt;name&gt;"`, the tool list is filtered to that one tool. The prompt then says to call it exactly once. If the tool is missing, an error lists the available tools (`:175-178`, `:189-194`, `:210-219`).
- **What goes into the prompt** (`:196-207`):
  - proc_inst_id, activity name and activity description
  - instructions about tool parameters
  - the pin instruction, if any
  - previous outputs, as `"{prev_activity.name}: {prev_workitem.output}"` for each previous activity (`:179-187`)
- **What is not in the prompt:** the activity's `instruction`, the whole process definition, agent skills, and the agent's own system prompt or persona.
- **Running the agent:** `create_react_agent(create_llm(streaming=False), tools)` with a single `ainvoke` (`:221-223`).
- **`polling_service/mcp_tool_index.py:72-165`:** this is a separate helper that builds a tool-name-to-server map by calling `list_tools` on every server in the tenant config (fastmcp, 15 s timeout per server). It is used by the deterministic code generators and the compensation handler, not by the ReAct agent path.

## 2. Pausing to ask the user (human-in-the-loop)

**Polling service and this repo**
- There is no such mechanism here.
- The MCP ReAct agent runs to completion in one call, and no tool asks the user anything.
- `PENDING` means "subprocess parent waiting for children" only.
- The only trace is `deterministic_signature.py:30`, which skips `human_asked` events when building deterministic signatures.

**Agent services and the UI (events-table loop)**
- **The request:** the external agent writes an `events` row with `event_type='human_asked'`, `status='ASKED'`, plus `todo_id`, `job_id`, and `data: {type: text|select|confirm, options[], text, role}`.
- **What the UI reads:**
  - `AgentMonitor.vue:855-870` subscribes to `events` for the todo (`watchAgentEvents`).
  - `agentEventTimeline.js:87-110` turns `human_asked` into a card with `isHumanAsked: true`.
  - `EventTimeline.vue:54` shows the answer input.
  - `AgentMonitor.vue:1025-1027` only treats a row as an open question when `status === 'ASKED'`.
- **The reply:**
  - `AgentMonitor.vue:965-1023` (`onConfirmHumanQuery` and `onCancelHumanQuery`) inserts a new `events` row through `putEvent` (`ProcessGPTBackend.ts:7459`).
  - That row copies the asked row but has a new `id`, `event_type='human_response'`, `data: {answer}` and `status: 'APPROVED'` or `'REJECTED'`.
  - `agentEventTimeline.js:29`, `142-148` then marks the card as answered by matching `job_id`.
- **Resuming the agent:**
  - The agent checks the `events` table every 2 seconds for a matching `human_response` by `todo_id` and `job_id`, with a 600 s timeout.
  - The code is `/home/kimsanghoon/process-gpt-deep-research/src/runners/research_utils.py:179-189` and `src/db.py:189-212`.
  - In that repo `_wait_for_human_response` is defined but never called. The real waiting presumably lives in the agent SDK (`processgpt_agent_sdk`), which is not installed locally, so I could not check it.

**Chat path (deepagents)**
- `ChatRoomPage.vue:931`, `4152-4300`, `4516-4600`, `8586-8600` handle this.
- The `request_human_input` tool triggers a LangGraph interrupt, which ends the stream with `{type:'human_input_required'}`.
- The UI shows a selection panel. It resumes by sending the message again with `metadata: {run_state, human_response_answer}`.

## 3. The strategy ontology MCP server

**Server** (`/home/kimsanghoon/process-gpt-strategy/app/mcp_server.py`)
- It is a FastMCP server, stateless and JSON-only, using streamable HTTP at `POST /mcp`.
- It is added as a plain route rather than a mount, to avoid a `/mcp` to `/mcp/` redirect (`:171-172`, `app/main.py:93,128`). DNS-rebinding protection is turned off (`:42`).
- Access is read-only.
- **Auth and tenant** (`:50-60`):
  - An `Authorization: Bearer $STRATEGY_MCP_TOKEN` header is required if the token is set.
  - The tenant comes from the `X-Tenant-Id` header, or the `?tenant_id=` query parameter as a fallback.
- **Result wrapper:** every result is wrapped as `{"result": "ok"|"error", ...}`. It is `error` when `found is False` or the payload has an `error` key (`:63-68`). This matches how `handle_service_workitem` counts success.

**Tools**

| Tool (line) | Parameters | Returns |
|---|---|---|
| `ontology_schema` (`:71`) | none | `schema_version`, `layers`, `node_types[{label, description, properties, count}]`, `relationship_types[{type, from, to, description}]` (`ontology_tools.py:21-35`) |
| `ontology_resolve_entity` (`:80`) | `text`, `class_name=""` (Strategy, KPI, Initiative, Process, Task, ProcessInstance, WorkItem, User, Agent, Team, Skill), `context=""`, `limit=5` | `status` (`resolved`, `ambiguous` or `no_match`) plus `matches[]` |
| `ontology_get_node` (`:94`) | `node_id` | `{found, node, neighbors[≤60], neighbor_count}` |
| `ontology_trace` (`:100`) | `node_id` | `{found, ...}` with the chain from strategy down to execution, people and skills, including `node_ids` |
| `ontology_kpi_root_cause` (`:110`) | `kpi_id` | `{found, ...}` with processes, bottleneck tasks, assignees and skills, ranked by contribution |
| `ontology_process_change_impact` (`:118`) | `proc_def_id`, `changed_tasks: list[str] \| None`, `use_versions=False` | `{found, affected[...]}` with high/medium/low levels and reasons |
| `ontology_list_nodes` (`:130`) | `label`, `name_contains=""`, `limit=50` | a list of nodes, or `{error, labels}` for an unknown label |

**How the engine references it**
- It is not referenced in the completion repo's `mcp.json` or in any code.
- It has to be added as a `tenants.mcp` entry, which the MCP server settings screen writes. Documented forms:
  - `mcp_server.py:9-11` uses `"type": "http"`.
  - `README.md:118-125` recommends `"transport": "streamable_http"`, `url http://&lt;host&gt;:8014/mcp`, with headers `X-Tenant-Id` and `Authorization`.
- With the new `adapter_config`, both forms work. `polling_service/tests/test_mcp_adapter_config.py:7-9` tests this exact entry.
- To use it, an agent must have `strategy-ontology` in its `tools`. The activity can pin a single tool with `tool: "mcp:ontology_trace"` (or another tool name).

## 4. Uncommitted changes

- **`git diff --stat`:** 9 files, +433/−278.
  - Most of it is `dashboard_api.py` (402), `operational_board_api.py` (87), `main.py` (53), `process_db_manager.py` (44) and `supabase_config.py` (41).
  - `polling_service/workitem_processor.py` has +36 and `polling_service/mcp_processor.py` has +8.
- **Untracked files:** `polling_service/mcp_adapter_config.py` and its test, `bpmn_dashboard.py`, `dashboard_auth.py`, `dashboard_thresholds.py`, `membership_access.py`, `mock_api.py`, three new tests, and `.env.bak-20261015`.
- **`mcp_processor.py:12`, `105-109`:** configs now pass through `adapter_configs(...)` before `MultiServerMCPClient`. Without this, remote servers failed with "unexpected keyword argument" or a missing transport. It returns `False` if no usable config is left.

**`handle_service_workitem` changes** (`workitem_processor.py`)
- **`:5144-5154`, failure no longer completes the task:** if the LLM or MCP call failed (`results["error"]` with no messages, for example a 429), the workitem stays `SUBMITTED`. `retry` goes up by 1 with a log, the MCP client is cleaned up, and the function returns. At `retry &gt;= 3`, the existing check at `:5033` routes to `update_instance_status_on_error`.
- **`:5198-5208`, report shown on default forms:** for `tool == 'formHandler:defaultform'`, the last non-empty AI message is copied into `tool_results["defaultform"] = {"free_input": ...}`. The UI and the next person can then read the report. It is added after the success count, so it does not affect it.
- **`:5217-5223`, the instance now moves on:** after marking the workitem `DONE`, it calls `await handle_workitem({**workitem, "status": "DONE", "output": tool_results})`. This updates the instance's current activities and the next workitem's assignee and status, so a userTask after a serviceTask no longer stays unassigned in `TODO`. Errors here are logged only.
- **`:5225-5251`, unchanged context:** the existing step that sets the next serviceTask from `TODO` to `SUBMITTED` still runs after this.

**Possible problems with these changes**
- **Two advance steps:** the new `handle_workitem` call and the existing next-serviceTask step at `:5225-5251` now both run, so the instance may be advanced twice.
- **Wrong final status at 3 retries:** the failure branch raises `retry` without raising an exception. When `retry` reaches 3, the `:5033` check runs `update_instance_status_on_error` and returns, but the workitem itself is not set to `DONE`.
- **Possible case mismatch:** the default-form check compares against lowercase `'formHandler:defaultform'`, but ad-hoc workitems are created with `'formHandler:defaultForm'` (`:1382`), with a capital F. If the comparison is case-sensitive, the report will not be copied for those workitems.</result>
<usage><subagent_tokens>93233</subagent_tokens><tool_uses>30</tool_uses><duration_ms>217866</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-20T02:22:56+00:00

```text
<task-notification>
<task-id>a8a6c75060ce9b451</task-id>
<tool-use-id>toolu_017FsHtxAc4Rs7geWzE3FBdX</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/a8a6c75060ce9b451.output</output-file>
<status>completed</status>
<summary>Agent "Non-PAL BPM execution path" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>In general BPM mode, a process definition is drawn in the editor at `/definitions/chat` or `/definitions/:id`. To run it, you open its detail page from the definition map and press "실행", or you ask the main chat to run it. The tasks are then worked at `/todolist/:taskId` (WorkItem.vue). None of this goes through `/process-hierarchy`.

The main thing to know: in ProcessGPT mode the play button in the definition editor header is turned off. `useExecute()` returns false there.

### 1. Sidebar and navigation when `$pal` is false (`src/layouts/full/vertical-sidebar/VerticalSidebar.vue`)
- **Write icon at the top** (admins only, hidden in simple UI) goes to `/definition-map` (lines 44-58). The top header has the same link plus `/todolist` and `/strategy-board` (`src/layouts/full/vertical-header/VerticalHeader.vue:70-121`). The `/chats` item there is commented out. `/admin` is also removed from the header in ProcessGPT mode (line 126-129).
- **Simple UI (`SimpleSidebarTools.vue:161-186`)** shows "새 채팅" → `/definition-map` and "할 일" → `/todolist`. The rest goes under "더보기": `/strategy-board`, `/knowledge`, `/my-feedback`, `/merge-requests`, `/admin`.
- **Conversation list (`ChatList`)** shows when not gs and not pal (line 154).
- **Instance list (`ProcessInstanceList`)** shows when not pal and not JMS (lines 157-173). Its header icon goes to `/list-pages/completed` (lines 920-929).
- **Agents, users, skills:** the agent list with an org-chart icon to `/organization` (176-207, admins). The user list (210-222). The skills list with a settings icon to `/skills` (225-241, admins).
- **정의관리 section** (admins, lines 300-410):
  - The flowchart button goes to `/definitions/chat` (line 989).
  - The upload/release dropdown is empty in ProcessGPT mode (991-997). UI and system definitions are filtered out (898-906).
  - Under it is a list of definitions, each linking to `/definitions/&lt;id&gt;`, or `/dmn/&lt;id&gt;` and `/business-rule/&lt;id&gt;` (1218-1300).
- **Process menu items** (943-984): `/process-architecture`, `/review-board`, and `/my-inbox` (non-PAL). They render only when pal is true (252-274), so the general mode doesn't show them.
- **Analytics** (1004-1052): `/analytics`, `/instance-toplist`, `/analytics/heatmap`, `/analytics/kpi`, `/strategy-board`, `/analytics/ontology`, `/analytics/pi-flags`.

Route-to-component mapping is in `src/router/MainRoutes.ts`:

| Route | Component | Line |
|---|---|---|
| `/todolist` | TodolistCard | 28 |
| `/todolist/:taskId` | WorkItem | 39 |
| `/instancelist/:instId` | InstanceCard | 54 |
| `/instance-viewer/:instId` | InstanceHistoryViewer | 59 |
| `/list-pages/completed` | CompletedListPage | 74 |
| `/chats` | Chats | 79 |
| `/chat` | ChatRoomPage | 84 |
| `/definitions/*` | ProcessDefinitionChat | 131 |
| `/definition-map` (and `/mega/:id`, `/major/:id`) | ProcessDefinitionMap | 161, 182, 188 |
| `/definition-map/sub/*` | ProcessDefinitionMap → SubProcessDetail | 194 |

### 2. Creating a definition and starting an instance
**Creating:**
- `/definitions/chat` uses ProcessDefinitionChat.vue for AI or manual BPMN modelling. Saving in ProcessGPT mode runs `changeXML` (`ProcessDefinitionChat.vue:1631-`).
- Alternatively, ask the main chat on `/definition-map`. It uses the tool `start_process_consulting` (`ProcessDefinitionMap.vue:1790`).
- Or use "add" on the definition-map card list (`DefinitionMapList.vue:39`, ProcessDialog).

**Start points:**
- **Definition map, then the detail page (the normal button path).**
  - In ProcessGPT mode, clicking a process card goes to `/definition-map/sub/&lt;id&gt;` (`SubProcess.vue:173-178`, then `BaseProcess.vue:78-86`).
  - SubProcessDetail.vue shows 시뮬레이션 and 실행 buttons when not JMS and not pal (lines 65-89).
  - Pressing one opens `&lt;process-gpt-execute&gt;` with `isSimulate` set to 'true' or 'false' (450-456, 179-189).
  - The card's own play button shows only when `isExecutionByProject` is set (`SubProcess.vue:36-45`). That is the ProjectCard flow.
- **Definition editor header** (`src/components/ProcessDefinitionChatHeader.vue`):
  - `useExecute()` at lines 447-455 returns false when mode is 'ProcessGPT', so the play button (249-262) is hidden.
  - `useSimulate` is `!this.Pal` (439-446), so only the simulate (bug-play) button shows.
  - That button opens the same dialog, `ProcessDefinitionChat.vue:348-366`. It renders `process-gpt-execute` when not pal and mode is ProcessGPT, with `isSimulate='true'`.
- **ProcessGPTExecute.vue** (`src/components/apps/definition-map/ProcessGPTExecute.vue`):
  - It shows role mapping with UserSelectField (agents allowed), InstanceSource, and an embedded WorkItem for the start activity (lines 54-99).
  - Its `executeProcess` (530-600) calls `backend.start(input)` with `{process_instance_id, process_definition_id, activity_id, role_mappings, answer, form_values, version...}`.
  - It then routes to `/instancelist/&lt;inst&gt;?tab=todo`.
  - `ProcessGPTBackend.start` is at `src/components/api/ProcessGPTBackend.ts:822`.
- **Chat:**
  - The main chat input on `/definition-map` calls `startMainChat` (`ProcessDefinitionMap.vue:1701-1714`; `src/composables/useMainChatStart`). It creates a "새 대화" room and opens `/chat`.
  - That room's tools include `execute_process`, `ask_user` and others (`src/views/chat/ChatRoomPage.vue:883`).
  - A run started from chat appears as a launch card (`src/shared/processLaunch.js`). Clicking the card opens the instance.
- **Other entry points:**
  - `ProcessDefinitionVersionManager.vue:216,512` (deploy-request execute).
  - `apps/todolist/ProjectCard.vue:142` (run inside a project).

### 3. Working on a started instance
- **`/todolist`** (TodolistCard.vue) shows a KanbanBoard, or SimpleInstanceList in simple UI.
- **`/todolist/:taskId`** (WorkItem.vue):
  - In ProcessGPT mode without pal, the right-hand component is always FormWorkItem (line 1985).
  - Tabs are progress, history and agent-monitor ("에이전트에 맡기기"), plus "similar" when there is an instance (972-1010).
  - Completing a task goes from `FormWorkItem.completeTask` (line 837) to `backend.putWorkItemComplete` (`ProcessGPTBackend.ts:3132`). That sends `answer` (`user_input_text`) and `form_values`.
  - Save calls `saveTask` (760).
- **`/instancelist/:instId`** (InstanceCard.vue):
  - Tabs are workhistory, progress, todo (kanban), gantt, chat, source and output (366-373).
  - Simple UI uses a three-pane layout (128-157) with InstanceTimeline.
- **`/list-pages/completed`** is CompletedListPage.vue.

### 4. Agent settings on activities in the general-mode editor
- `BpmnPropertyPanel.vue:343-372` picks the panel. In ProcessGPT mode, user, script, service, task, lane, ad-hoc and call-activity elements get a `gpt-*-panel`.
- **GPTUserTaskPanel.vue** is the only one with an Agent tab (line 5).
  - That tab holds `AgentSelectField` (95-104).
  - Its fields include `agent`, `agentMode`, `orchestration`, `usePresetAgent`, `rootAgent`, `tools`, `skills`, `tool` (`formHandler:&lt;id&gt;`), `hitlEnabled` and `hitlCapabilities` (lines 205-236).
  - Values are copied onto `processDefinition.activities` (755-810).
- **AgentSelectField.vue** (`src/components/ui/field/AgentSelectField.vue`):
  - Orchestration select (6-16). Options are none, deepagents, langchain-react, a2a, codex, cliagents and more (333-433).
  - CLI agent, model and permission fields (61-110).
  - agentMode radios, draft or complete (119-135, 310-320).
  - usePresetAgent checkbox and root agent (147-185).
  - Agent tools (MCP tool list, 195-206) and agent skills (227-236).
- **GPTServiceTaskPanel.vue and GPTTaskPanel.vue** have only setting and reference-info tabs: duration, instruction, checkpoints, custom properties and color. They have no agent settings.
- **GPTLanePanel.vue:281-351** copies the lane's agent and orchestration to every task in that lane.
- At runtime, WorkItem copies `worklist.agentMode`, `orchestration` and `endpoint` into `selectedAgent` (1103-1110). `updateWorkItem` (2390-2440) upper-cases agentMode and calls `AgentMonitor.startTask`.

### 5. Existing features where the agent stops and asks the user
- **Inside a task (AgentMonitor tab of WorkItem):**
  - `src/views/markdown/AgentMonitor.vue` listens for `human_asked` and `human_checked` events (855-870).
  - `src/components/ui/agentEventTimeline.js:87-110` turns `human_asked` into a card with `humanQueryData {type: text|select|confirm, options, text}`.
  - `src/components/ui/EventTimeline.vue:54-104` draws the input (text, select or confirm).
  - On confirm or reject, `onConfirmHumanQuery` and `onCancelHumanQuery` (964-1020) write a `human_response` event with status APPROVED or REJECTED via `backend.putEvent`.
- **Feedback on a draft:** `AgentMonitor.submitChat` (1209-1270) sets `draft_status='FB_REQUESTED'` and `feedback`. While the agent works, the loading state covers `draft_status` STARTED or FB_REQUESTED (538, 901, 1092).
- **Busy check:** `WorkItem.checkInitialAgentBusyState` (1505-1550) treats the agent as busy when status is IN_PROGRESS, `agent_mode` is DRAFT or COMPLETE, and `agent_orch` is a known orchestration.
- **"내 차례" banner in the instance timeline:** `InstanceTimeline.vue:37-90,307-322`. It shows "초안 확인 후 제출해 주세요" when `agent_mode` is DRAFT.
- **Chat-level questions:**
  - `src/shared/askUser.js` handles MCP `ask_user` and feeds HumanFeedbackPanel (`src/components/ui/HumanFeedbackPanel.vue`, used in Chat.vue and ChatThread.vue).
  - `src/shared/hitl/index.js` holds the rules for deepagent `request_human_input` panels.
  - ChatRoomPage keeps `pendingHitlRunState` (931-934). It resumes the same session by sending `run_state` plus `human_response_answer` (4493-4600, 8587-8601).
  - WorkAssistantChatPanel uses `__humanFeedback` (369, 854-919).
- **pdf2bpmn HITL:** `src/shared/hitlFeedback/index.js` reads `todolist.output.hitl_checkpoint` and `hitl_feedbacks`. When every question is answered it sets `draft_status='FB_REQUESTED'`.
- **Mid-task steering:** `src/shared/steering/index.js`. Steering is refused with `awaiting_human_input` while a human answer is pending.
- **Not wired to any setting:** `hitlEnabled` and `hitlCapabilities` exist only as defaults in GPTUserTaskPanel (233-234). Nothing in the editor sets them and no other code in `src` reads them.</result>
<usage><subagent_tokens>120033</subagent_tokens><tool_uses>50</tool_uses><duration_ms>276227</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-10-20T02:37:45+00:00

```text
<task-notification>
<task-id>biog1ne86</task-id>
<tool-use-id>toolu_018xYPXjkcYyf9i7bvRBbHnL</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/biog1ne86.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3 &amp;&amp; python3 - &lt;&lt;'EOF'
def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert s.count(a)==1, (p, a[:80], s.count(a))
        s=s.replace(a,b)
    open(p,'w').write(s)
edit('src/components/strategy/ontology/StrategyOntologyExplorer.vue', [
("""    IN_CHARGE_OF: '담당 조직'
};""","""    IN_CHARGE_OF: '담당 조직',
    CONFLICTS_WITH: '상충'
};"""),
("""        ['kpi_role', '선행/후행', (v) =&gt; (v === 'leading' ? '선행' : v === 'lagging' ? '후행' : v)],""","""        ['kpi_role', '선행/후행', (v) =&gt; (v === 'leading' ? '선행' : v === 'lagging' ? '후행' : v)],
        ['priority', '판단 우선순위', (v) =&gt; `${v}${Number(v) === 1 ? ' (최우선)' : ''}`],"""),
("""        ['importance', '중요도'],
        ['description', '설명']""","""        ['importance', '중요도'],
        ['priority', '판단 우선순위', (v) =&gt; `${v}${Number(v) === 1 ? ' (최우선)' : ''}`],
        ['description', '설명']"""),
])
edit('src/components/strategy/ontology/ontologyLineage.js', [
("""        for (const { edge, other, outgoing } of index.adj.get(id)) {
            const otherStage = index.nodes.get(other).stage;""","""        for (const { edge, other, outgoing } of index.adj.get(id)) {
            // 상충(CONFLICTS_WITH)은 같은 열의 맞수 관계라 상류·하류가 아니다 — 체인에 넣지 않는다(직접 연결에는 보인다)
            if (edge.rel_type === 'CONFLICTS_WITH') continue;
            const otherStage = index.nodes.get(other).stage;"""),
])
edit('src/views/strategy/OntologyExplorer.vue', [
("""    IN_CHARGE_OF: '담당 조직',""","""    IN_CHARGE_OF: '담당 조직',
    CONFLICTS_WITH: '상충',"""),
])
EOF
grep -n "importance" src/components/strategy/ontology/StrategyOntologyExplorer.vue | head -3; node --test src/components/strategy/ontology/*.test.js 2&gt;&amp;1 | grep -E "^# (pass|fail)"; npx prettier --write src/views/strategy/StrategyBoard.vue src/components/strategy/ontology/StrategyOntologyExplorer.vue src/components/strategy/ontology/ontologyLineage.js &gt;/dev/null; npx vue-tsc --noEmit 2&gt;&amp;1 | grep -E "StrategyBoard|StrategyOntologyExplorer|OntologyExplorer\.vue" | head" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T02:50:54+00:00

```text
<task-notification>
<task-id>b8e0s4olu</task-id>
<tool-use-id>toolu_01NwoUCZumCcSPhqCt715VgL</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/b8e0s4olu.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3 &amp;&amp; npx prettier --write src/components/ui/EventTimeline.vue src/shared/awaitingUserInput.js &gt;/dev/null &amp;&amp; git diff --stat src/components/apps/todolist/ src/components/ui/EventTimeline.vue &amp;&amp; timeout 300 npx vue-tsc --noEmit 2&gt;&amp;1 | grep -E "KanbanColumnCard|FormWorkItem|WorkItem\.vue|EventTimeline|StrategyBoard" | head" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T03:28:00+00:00

```text
<task-notification>
<task-id>bp3bn1atk</task-id>
<tool-use-id>toolu_01MFTbp4UuwyjWsKyc4SAMyF</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/bp3bn1atk.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3 &amp;&amp; npx vue-tsc --noEmit &gt; /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/tsc.log 2&gt;&amp;1; echo "exit=$?"; grep -cE "error TS" /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/tsc.log; grep -E "KanbanColumnCard|FormWorkItem|WorkItem\.vue|EventTimeline|StrategyBoard|StrategyOntologyExplorer|OntologyExplorer\.vue|awaitingUserInput|ProcessHierarchy|BpmnUengine|ProcessGPTBackend" /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/tsc.log | head" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T03:30:48+00:00

```text
<task-notification>
<task-id>b42aj3wkl</task-id>
<tool-use-id>toolu_01RDmvDt9F5WAQ7NjY3jeqNY</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/b42aj3wkl.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3 &amp;&amp; T=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/tsc.log; NODE_OPTIONS=--max-old-space-size=8192 npx vue-tsc --noEmit &gt; $T 2&gt;&amp;1; echo "exit=$?"; grep -cE "error TS" $T; grep -E "KanbanColumnCard|FormWorkItem|WorkItem\.vue|EventTimeline|StrategyBoard|StrategyOntologyExplorer|OntologyExplorer\.vue|awaitingUserInput|ProcessHierarchy|BpmnUengine|ProcessGPTBackend" $T | head" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T03:38:06+00:00

```text
<task-notification>
<task-id>beho67e7t</task-id>
<tool-use-id>toolu_01FW6yG4n7eWghmS3zEaeS1Z</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/beho67e7t.output</output-file>
<status>completed</status>
<summary>Background command "docker start process-gpt-age-postgres &gt;/dev/null &amp;&amp; sleep 6 &amp;&amp; cd ~/process-gpt-strategy &amp;&amp; timeout 1500 .venv/bin/python -m pytest -q -p no:cacheprovider 2&gt;&amp;1 | tail -6; docker stop process-gpt-age-postgres &gt;/dev/null; echo stopped" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T03:42:19+00:00

```text
<task-notification>
<task-id>bjlfr2jkc</task-id>
<tool-use-id>toolu_014LvEbuSTff3fdtrMW14cd7</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/bjlfr2jkc.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3 &amp;&amp; L=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/rec3.log; : &gt; $L; for i in 1 2 3; do echo "=== round $i" &gt;&gt; $L; python3 scripts/demo/ontology-decision/seed.py &gt;&gt; $L 2&gt;&amp;1 &amp;&amp; python3 scripts/demo/ontology-decision/seed.py --priority 2.1=none &gt;&gt; $L 2&gt;&amp;1; rm -f docs/manuals/video/ontology-agent-decision/*/clips/state.json; for s in 1 2.1 2.2; do node scripts/demo/ontology-decision/record.mjs $s &gt;&gt; $L 2&gt;&amp;1 &amp;&amp; echo "PASS $s" &gt;&gt; $L || echo "FAIL $s" &gt;&gt; $L; done; done; echo DONE &gt;&gt; $L" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T03:42:24+00:00

```text
<task-notification>
<task-id>be7ev9xqj</task-id>
<tool-use-id>toolu_01SKtLyoqCeBj2XEwE98TGmB</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/be7ev9xqj.output</output-file>
<status>completed</status>
<summary>Background command "L=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/rec3.log; until grep -q "^DONE" $L; do sleep 10; done; grep -E "^(=== round|PASS|FAIL|DONE)|FAILED" $L" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T04:28:12+00:00

```text
좀더 긴 프로세스로 세가지 경우가 한번에 발생하는 프로세스도 하나 그려서 설명영상과 시나리오까지.
```

## Prompt — 2026-10-20T04:40:34+00:00

```text
그리고 현재 시나리오 별 프로세스가 너무 짧으니 어느정도 시연가능한 길이 정도의 프로세스로 구성하도록해.
```

## Prompt — 2026-10-20T05:03:16+00:00

```text
<task-notification>
<task-id>bh30wlsma</task-id>
<tool-use-id>toolu_01G9ZYXhLFWpC4xaLvACWsof</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/bh30wlsma.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3 &amp;&amp; L=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/rec4.log; : &gt; $L; python3 scripts/demo/ontology-decision/seed.py &gt;&gt; $L 2&gt;&amp;1 &amp;&amp; python3 scripts/demo/ontology-decision/seed.py --priority 2.1=none &gt;&gt; $L 2&gt;&amp;1; for s in 1 2.1 2.2 x; do node scripts/demo/ontology-decision/record.mjs $s &gt;&gt; $L 2&gt;&amp;1 &amp;&amp; echo "PASS $s" &gt;&gt; $L || echo "FAIL $s" &gt;&gt; $L; done; echo DONE &gt;&gt; $L; grep -E "^(PASS|FAIL)|FAILED|scene" $L" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T05:15:48+00:00

```text
Panel 설정을 확인해보면 프로세스의 공급사 선정 판단이 ServiceTask가 아니라 UserTask로 설정해서 진행해도 될 것 같은데 검토해봐.
```

## Prompt — 2026-10-20T05:17:06+00:00

```text
에이전트 워커 프로젝트가 필요하면 추가해줄테니 원래 흐름대로.
```

## Prompt — 2026-10-20T05:26:59+00:00

```text


<pasted_content id="2812">
에이전트 / 오케스트레이션 / 부가 서비스
crewai-action: 액션 실행 에이전트 (8001)
crewai-deep-research: 심층 리서치 에이전트 (8002)
openai-deep-research: OpenAI 기반 심층 리서치 에이전트 (8003)
langchain-react: LangChain 기반 에이전트 (8011)
work-assistant-agent: 워크 어시스턴트 에이전트 (8008)
a2a-orch: Agent-to-Agent(A2A) 오케스트레이션 (8006)
computer-use: 컴퓨터 사용(automation) 서비스 (8007)
agent-feedback: 에이전트 피드백 서비스 (6789)
process-gpt-analytic: 분석/ETL 서비스 (8009)
fcm-service: FCM 푸시 서비스 (8666)
bpmn-extractor: PDF → BPMN 추출 API (8012)
browser-use: 브라우저 자동화 서버 (5001, Nginx 경유 /browser-use/)
react-voice-agent: 음성 채팅 서비스 (3000, Nginx 경유 /voice/)
claude-skills: 스킬 서버/스토리지 (8765, Nginx 경유 /claude-skills/)
</pasted_content id="2812">


여기서 필요한건 뭐임? https://github.com/uengine-oss/ 뒤에 붙여서 ~/ 경로에 clone 받아서 실행해.
```

## Prompt — 2026-10-20T06:06:41+00:00

```text
<task-notification>
<task-id>bqenmi814</task-id>
<tool-use-id>toolu_015vaHDR31WBaC1RGMNnaTJo</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/bqenmi814.output</output-file>
<status>completed</status>
<summary>Background command "cd ~/process-gpt-vue3 &amp;&amp; L=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/scratchpad/rec5.log; : &gt; $L; rm -f docs/manuals/images/ontology-agent-decision/*.png docs/manuals/video/ontology-agent-decision/sc1/clips/*.webm docs/manuals/video/ontology-agent-decision/sc21/clips/*.webm docs/manuals/video/ontology-agent-decision/sc22/clips/*.webm docs/manuals/video/ontology-agent-decision/scx/clips/*.webm docs/manuals/video/ontology-agent-decision/sc1/clips/state.json docs/manuals/video/ontology-agent-decision/sc21/clips/state.json docs/manuals/video/ontology-agent-decision/sc22/clips/state.json docs/manuals/video/ontology-agent-decision/scx/clips/state.json; python3 scripts/demo/ontology-decision/seed.py &gt;&gt; $L 2&gt;&amp;1 &amp;&amp; python3 scripts/demo/ontology-decision/seed.py --priority 2.1=none &gt;&gt; $L 2&gt;&amp;1; for s in 1 2.1 2.2 x; do node scripts/demo/ontology-decision/record.mjs $s &gt;&gt; $L 2&gt;&amp;1 &amp;&amp; echo "PASS $s" &gt;&gt; $L || echo "FAIL $s" &gt;&gt; $L; done; echo DONE &gt;&gt; $L; grep -E "^(PASS|FAIL)|FAILED" $L" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T06:20:01+00:00

```text
현재 8081로 실행되어있는 서버에서도 같이 사용 가능한지. 그리고 시스템으로 등록도 해둬.
```

## Prompt — 2026-10-20T06:36:14+00:00

```text
8081에선 어떻게 실행함?
```

## Prompt — 2026-10-20T07:43:37+00:00

```text
일반적인 bsc에서 상충되는 kpi나 우선순위를 작성하는게 좋을지에 대한 판단도 필요 할 것 같음.
```

## Prompt — 2026-10-20T07:44:32+00:00

```text
일반적인 bsc에서 상충되는 kpi같은걸 지정하는게 일반적인지 검토. 그리고 상충이라는 단어보다 다른 단어가 더 좋을지도 검토해서 제안.
```

## Prompt — 2026-10-20T07:47:18+00:00

```text
그럼 흐름 상 agent가 kpi를 확인하고, 상충되는 kpi가 있다면 해당 KPI의 우선순위 혹은 유저 선택을 통해 진행하게 되는것임?
```

## Prompt — 2026-10-20T07:51:50+00:00

```text
질문. 상충에 따라 유저의 선택이 이후 Gateway 분기처리가 되는게 더 예제로 좋을 것 같음.
```

## Prompt — 2026-10-20T07:54:51+00:00

```text
진행. 트레이드오프는 변경하지마.
```

## Prompt — 2026-10-20T08:03:41+00:00

```text
<task-notification>
<task-id>bmtg9tmft</task-id>
<tool-use-id>toolu_01ABum3hJBsserw7beWsbzJF</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/bmtg9tmft.output</output-file>
<status>completed</status>
<summary>Background command "Run end-to-end decision checks" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T08:03:46+00:00

```text
<task-notification>
<task-id>b02dw2epe</task-id>
<tool-use-id>toolu_015XL7nBcjojXsrtM2ZYTSHf</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/b02dw2epe.output</output-file>
<status>completed</status>
<summary>Monitor "check.py run result lines" stream ended</summary>
<event>|--------|------|------|------------|
| A 공급사 | 1,840,000원 | 10일 | 97.2% |
| B 공급사 | 2,150,000원 | 12일 | 99.7% |
### 판단(결론)
선택한 공급사: A 공급사
### 근거
- **따른 전략·KPI**: 구매 원가 절감 (목표 7% 이상, 현재 5%)
- **택한 기준**: 설비 부품 구매 단가 절감률 (사용자 선택)
- **포기한 기준**: 설비 부품 품질 합격률 (사용자 선택)
### 다음 단계
선정된 A 공급사와 계약을 진행하시기 바랍니다.
OK  통합/Task_Packaging  mode=aligned      공급사=A (기대 aligned/A)
OK  통합/Task_Core       mode=priority     공급사=B (기대 priority/B)
OK  통합/Task_Parts      mode=user_choice  공급사=A (기대 user_choice/A) 답=증설 설비부품 단가 절감률(높을수록 좋음 · 목표 7% 이상)
BAD 통합/검수 분기       → Task_Inspect_Strict,Task_Inspect (기대 Task_Inspect_Strict)  ont-dec-expansion.4cf5f89c-4529-4e4e-9dfd-eda9da9a7a96
2/5 통과
[exited with code 0]</event>
</task-notification>
```

## Prompt — 2026-10-20T08:07:58+00:00

```text
<task-notification>
<task-id>bdf7vk749</task-id>
<summary>Monitor event: "check + 2.2/x recording progress"</summary>
<event>check exit 0
OK  1         mode=aligned      공급사=A (기대 aligned/A)  ont-dec-regular.02968d7f-752a-45d7-a095-ffac7eda2b24
OK  2.1       mode=priority     공급사=B (기대 priority/B)  ont-dec-urgent.c8d3aae9-23a1-4599-80aa-4edfc38269c9
OK  2.2-품질    mode=user_choice  공급사=B (기대 user_choice/B) 답=설비 부품 품질 합격률(높을수록 좋음 · 목표 99.5% 이상)  적용 기준=설비 부품 품질 합격률 → Task_Inspect (기대 Task_Inspect)  ont-dec-parts.5b7738f3-a6ed-4872-b911-2500c0b3a145
OK  2.2-단가    mode=user_choice  공급사=A (기대 user_choice/A) 답=설비 부품 구매 단가 절감률(높을수록 좋음 · 목표 7% 이상)  적용 기준=설비 부품 구매 단가 절감률 → Task_Inspect_Strict (기대 Task_Inspect_Strict)  ont-dec-parts.c8fb1d42-1ee5-43d7-b9a2-386a3039fd77
OK  통합/Task_Packaging  mode=aligned      공급사=A (기대 aligned/A)
OK  통합/Task_Core       mode=priority     공급사=B (기대 priority/B)
OK  통합/Task_Parts      mode=user_choice  공급사=A (기대 user_choice/A) 답=증설 설비부품 단가 절감률(높을수록 좋음 · 목표 7% 이상)
OK  통합/검수 분기       → Task_Inspect_Strict (기대 Task_Inspect_Strict)  ont-dec-expansion.04cffd93-f2ec-48fd-aa97-cada0195486a</event>
</task-notification>
```

## Prompt — 2026-10-20T08:14:43+00:00

```text
<task-notification>
<task-id>bdf7vk749</task-id>
<summary>Monitor event: "check + 2.2/x recording progress"</summary>
<event>5/5 통과
record 2.2 exit 0
scene1: ok (21s)
scene2: ok (33s)
scene3: ok (38s)
scene4: ok (34s)
scene5: ok (30s)
scene6: ok (78s)
scene7: ok (161s)</event>
</task-notification>
```

## Prompt — 2026-10-20T08:20:12+00:00

```text
<task-notification>
<task-id>b4h0e3d4x</task-id>
<tool-use-id>toolu_01HHUsSuvyufBXvEWGUKLMMb</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/b4h0e3d4x.output</output-file>
<status>completed</status>
<summary>Background command "Rerun checks then re-record 2.2 and integrated" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T08:20:18+00:00

```text
<task-notification>
<task-id>bdf7vk749</task-id>
<summary>Monitor event: "check + 2.2/x recording progress"</summary>
<event>record x exit 0
scene1: ok (40s)
scene2: ok (89s)
scene3: ok (35s)
scene4: ok (34s)
scene5: ok (25s)
scene6: ok (100s)
[exited with code 0]</event>
</task-notification>
```

## Prompt — 2026-10-20T08:30:57+00:00

```text
<task-notification>
<task-id>b9xrlsiys</task-id>
<tool-use-id>toolu_012V4UCvfz1b2kU1VmH8CQo5</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/ce17312c-4409-4f0c-9048-3d00fc787116/tasks/b9xrlsiys.output</output-file>
<status>completed</status>
<summary>Background command "Retry TTS until available, then build videos" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-20T08:35:11+00:00

```text
<task-notification>
<task-id>bdf7vk749</task-id>
<summary>Monitor event: "check + 2.2/x recording progress"</summary>
<event>[Monitor expired after 30m with 3 events delivered. Re-arm it if you still need the watch.]</event>
</task-notification>
```

<!-- backfilled-from: 65a1fcab-a641-4fed-ae8c-3c18ce20bd4b -->

## Prompt — 2026-10-21T06:10:09+00:00

```text
ll
```

## Prompt — 2026-10-21T06:10:41+00:00

```text
이어서 진행할거 없음?
```

## Prompt — 2026-10-21T06:12:59+00:00

```text
1. 모두 커밋
2. (선택) 고르지 않은 분기 카드는 안보이는게 맞음. 
3. 8081에 sanghoon01@uengine.org/[REDACTED] 계정으로 접속해서 위 테스트 10회 진행해봐. 현재 테스트 이력은 해당 계정에서 안보여서.
```

## Prompt — 2026-10-21T06:41:09+00:00

```text
아 [REDACTED]로 해봐.
```

## Prompt — 2026-10-21T06:42:22+00:00

```text
근데 로그인을 안했는데 어떻게 테스트를 진행했음? 실제 화면에서 진행해야함. 그리고 이제 Ontology 테스트 하는데 사용 된 프로세스에 폼도 붙혀서 각 1회씩 진행.
```

## Prompt — 2026-10-21T06:42:35+00:00

```text
<task-notification>
<task-id>btujmmsg9</task-id>
<tool-use-id>toolu_01FwsHxd69zF3c59mYhHqwdD</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/65a1fcab-a641-4fed-ae8c-3c18ce20bd4b/tasks/btujmmsg9.output</output-file>
<status>failed</status>
<summary>Background command "cd /home/kimsanghoon/process-gpt-vue3 &amp;&amp; mkdir -p /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/scratchpad &amp;&amp; python3 -u scripts/demo/ontology-decision/check.py --runs 10 --email sanghoon01@uengine.org &gt; /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/scratchpad/check10.log 2&gt;&amp;1" failed with exit code 144</summary>
</task-notification>
```

## Prompt — 2026-10-21T06:47:35+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>instance ont-dec-regular.194fc1c5-5179-1110-0f2e-68255ad3d89a</event>
</task-notification>
```

## Prompt — 2026-10-21T06:47:35+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>scene1: ok (68s)</event>
</task-notification>
```

## Prompt — 2026-10-21T06:48:19+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>scene2: FAILED — locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.</event>
</task-notification>
```

## Prompt — 2026-10-21T06:48:19+00:00

```text
<task-notification>
<task-id>bcaozm349</task-id>
<tool-use-id>toolu_01JkawkYNL65aU5w92cFNpq6</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/65a1fcab-a641-4fed-ae8c-3c18ce20bd4b/tasks/bcaozm349.output</output-file>
<status>failed</status>
<summary>Background command "E2E_USER=sanghoon01@uengine.org E2E_PASS='[REDACTED]' node scripts/demo/ontology-decision/record.mjs 1 &gt; /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/scratchpad/ui1.log 2&gt;&amp;1" failed with exit code 1</summary>
</task-notification>
```

## Prompt — 2026-10-21T06:50:41+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>instance ont-dec-regular.0d10305f-f915-0193-8573-ebc31985171d</event>
</task-notification>
```

## Prompt — 2026-10-21T06:50:42+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>scene1: ok (65s)</event>
</task-notification>
```

## Prompt — 2026-10-21T06:50:42+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>scene2: ok (38s)</event>
</task-notification>
```

## Prompt — 2026-10-21T06:56:53+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>scene3: FAILED — timeout: agent Task_Decide DONE</event>
</task-notification>
```

## Prompt — 2026-10-21T06:56:53+00:00

```text
<task-notification>
<task-id>b2fee5ud8</task-id>
<tool-use-id>toolu_019zeyBAegqSq62A8DPPYosY</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/65a1fcab-a641-4fed-ae8c-3c18ce20bd4b/tasks/b2fee5ud8.output</output-file>
<status>failed</status>
<summary>Background command "rm -f docs/manuals/video/ontology-agent-decision/sc1/clips/state.json &amp;&amp; E2E_USER=sanghoon01@uengine.org E2E_PASS='[REDACTED]' node scripts/demo/ontology-decision/record.mjs 1 &gt; /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/scratchpad/ui1.log 2&gt;&amp;1" failed with exit code 1</summary>
</task-notification>
```

## Prompt — 2026-10-21T07:00:57+00:00

```text
<task-notification>
<task-id>bt1brx8qg</task-id>
<tool-use-id>toolu_01GdRchMjErvWFFmQvTpd222</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/65a1fcab-a641-4fed-ae8c-3c18ce20bd4b/tasks/bt1brx8qg.output</output-file>
<status>completed</status>
<summary>Background command "sudo systemctl restart process-gpt-langchain-react; sleep 60; docker exec supabase_db_process-gpt-vue3 psql -U postgres -d postgres -At -c "select activity_id,status,draft_status from todolist where proc_inst_id='ont-dec-regular.0d10305f-f915-0193-8573-ebc31985171d' and activity_id='Task_Decide'"; grep -c "" ~/logs/systemd/langchain-react.log; tail -5 ~/logs/systemd/langchain-react.log | cut -c1-200" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-21T07:01:09+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>=== 2.1</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:35+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene1: ok (36s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:35+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>instance ont-dec-urgent.9f4a8d36-4411-f202-a6e7-1bebd5ef313a</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:35+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene2: ok (33s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:35+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene3: ok (38s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:35+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene4: ok (41s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:35+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene5: ok (74s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:35+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>=== 2.2</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene1: ok (20s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>instance ont-dec-parts.cba68954-abc0-858f-7668-3c5cae9be0ac</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene2: ok (33s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene3: ok (41s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene4: ok (33s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene5: ok (29s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene6: ok (87s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:11:36+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>instance ont-dec-parts.e8ae8c84-a1b9-22a2-9e50-e00d1889a4b2</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:16+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene7: ok (210s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>=== x</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene1: ok (39s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>instance ont-dec-expansion.0b64607d-bfad-27c9-0399-4dfa6d06521f</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene2: ok (94s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene3: ok (33s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene4: ok (33s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene5: ok (21s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bke7s9c2b</task-id>
<summary>Monitor event: "UI 시나리오 1 진행 로그(장면 결과·오류)"</summary>
<event>[Monitor expired after 30m with 7 events delivered. Re-arm it if you still need the watch.]</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>scene6: ok (108s)</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>b2qvsfv7q</task-id>
<tool-use-id>toolu_01X1KhDLzKLwKQgokPeorCYe</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/65a1fcab-a641-4fed-ae8c-3c18ce20bd4b/tasks/b2qvsfv7q.output</output-file>
<status>completed</status>
<summary>Background command "for s in sc21 sc22 scx; do rm -f docs/manuals/video/ontology-agent-decision/$s/clips/state.json; done; L=/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/scratchpad/ui-rest.log; : &gt; $L; for s in 2.1 2.2 x; do echo "=== $s" &gt;&gt; $L; E2E_USER=sanghoon01@uengine.org E2E_PASS='[REDACTED]' node scripts/demo/ontology-decision/record.mjs $s &gt;&gt; $L 2&gt;&amp;1 || { echo "=== $s FAILED" &gt;&gt; $L; break; }; done; echo "=== END" &gt;&gt; $L" completed (exit code 0)</summary>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bln1o6j4h</task-id>
<summary>Monitor event: "UI 시나리오 2.1·2.2·통합 진행(장면 결과·오류)"</summary>
<event>=== END</event>
</task-notification>
```

## Prompt — 2026-10-21T07:18:17+00:00

```text
<task-notification>
<task-id>bnfi3qkys</task-id>
<tool-use-id>toolu_01MNATAVfHsjioRxqMPiUWTS</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/65a1fcab-a641-4fed-ae8c-3c18ce20bd4b/tasks/bnfi3qkys.output</output-file>
<status>completed</status>
<summary>Background command "until grep -qE "^=== (END|.* FAILED)" /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/scratchpad/ui-rest.log; do sleep 10; done; grep -E "^===|scene|instance" /tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1be3c856-3a32-4955-8b67-d53b88026efc/scratchpad/ui-rest.log" completed (exit code 0)</summary>
</task-notification>
```
