# Working with these specs (for AI agents & contributors)

This repo uses **OpenSpec** as the contract layer. Specs are the source of truth
for the frontend's observable behavior.

## Layout
- `openspec/specs/<capability>/spec.md` — current agreed behavior (source of truth).
- `openspec/changes/<change>/` — in-flight proposals: `proposal.md`, `design.md`,
  `tasks.md`, and spec deltas under `specs/<capability>/spec.md`.
- `openspec/project.md` — tech stack, conventions, environments.

## Capability naming (this project)
Capabilities map to QA/behavior areas, e.g.:
- `instance-realtime-sync` — left instance list + status badges push-update.
- `work-list-display` — completed work visible in kanban/lists.
- `workitem-assignee` — assignee preserved & shown on work items.
- `deep-agent-results` — Deep Agent outputs shown in the work/artifact area.
- `workitem-history` — prior work items shown in the current-task screen.

## Delta format
Use `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements`.
Every `### Requirement:` MUST have at least one `#### Scenario:` in GIVEN/WHEN/THEN
form and use normative terms (MUST/SHALL/SHOULD). Each scenario is meant to map
1:1 to a Playwright test in `qa_report/tests`.

## Lifecycle
- Validate: `openspec validate <change> --strict`
- Archive (fold deltas into `specs/`): `openspec archive <change>`

## QA mapping
QA bugs `B01`–`B34` map 1:1 to Playwright tests `T01`–`T34` under `qa_report/tests`.
The OpenSpec change `qa-critical-fixes` covers the Critical set (`B01`–`B06`).
