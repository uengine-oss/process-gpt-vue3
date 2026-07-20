# Project Context — ProcessGPT

## Purpose
Process GPT is a BPM/agentic-workflow web application. Users run business
process instances (e.g. 휴가 신청, 계약 관리), interact with chat-style agents,
delegate work to humans and AI agents (incl. Deep Agent), and track work
items on a kanban board and instance lists.

This `openspec/` captures the **observable ProcessGPT product contract** across
the frontend and the supporting services exercised through it. It is stored in
the Vue application because that is the primary acceptance surface, but it is
not merely a UI test specification. Product changes, repairs, and E2E tests MUST
read the relevant current specs first and preserve their requirements.

## Tech stack
- **Framework**: Vue 3 (Options API predominant) + Vite
- **UI**: Vuetify 3 (`v-chip`, `v-card`, `v-window`, etc.)
- **Language**: TypeScript + `.vue` SFCs
- **State**: Pinia stores + a global `EventBus`
- **Backend access**: `src/components/api/ProcessGPTBackend.ts` (via
  `BackendFactory.createBackend()`), talking to **Supabase** (Postgres + Realtime).
  Realtime subscriptions go through `storage._watch({ channel, table, filter }, cb)`.
- **Key tables**: `bpm_proc_inst` (process instances), work items / todolist.
- **E2E**: Playwright (`@playwright/test`), existing suite under `playwright/e2e`,
  QA acceptance suite under `qa_report/tests`.

## Runtime / environments
- Local dev: `npm run dev -- --host` (Vite). QA tests target `http://localhost:8088`.
- Live: `https://uengine.process-gpt.io`.
- The frontend authenticates against the shared Supabase backend even in local dev,
  so authenticated E2E tests require real credentials (`E2E_USER` / `E2E_PASS`).

## Architecture rules / conventions
- Specs are organized **by product capability/area**, not by repository or
  service. A requirement may therefore constrain DeepAgent, completion,
  polling, gateway, Supabase, and frontend behavior when they jointly deliver
  one user-visible capability.
- Realtime/push: views that show instance or work-item state SHOULD subscribe to
  Supabase realtime via `watch*` helpers rather than relying solely on manual
  `EventBus` emits or full-page refreshes.
- i18n: user-facing strings live in `src/utils/locales/*.json`. User-facing text
  MUST NOT expose raw function/tool names.
- Status vocabulary (instances): `NEW`, `IN_PROGRESS`, `PENDING` (approval-waiting),
  `DONE`/`COMPLETED`, `CANCELLED`. Rendered by `StatusChip.vue`.

## Testing conventions
- Playwright LIVE/authenticated tests are **env-gated** (skip unless the required
  env vars are set) so CI stays green without credentials. See the existing
  `playwright/e2e/bpmn-artifact/live-deepagent-draft-validate.spec.ts` for the
  established login flow and selector style (`.cp-id input`, `.cp-pwd input`,
  `.cp-login`, `.cp-chat textarea`, `.ws-files`, `.human-feedback-panel`).
- QA acceptance tests encode **expected (correct) behavior**. While the underlying
  bug is open, the corresponding test is expected to fail; it turns green once the
  bug is fixed. Tests assert observable outcomes, not implementation internals.
