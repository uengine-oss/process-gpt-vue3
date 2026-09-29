# Simple UI mobile work surface

## Purpose

Define the compact mobile navigation and process-start experience shown while
`pg.simpleUi` is enabled.

## Requirements

### Mobile app shell (Claude / ChatGPT mobile layout)

-   At phone widths (768px and below) with simple UI on, authenticated users see
    a 48px top app bar instead of bottom tabs: a sidebar button on the left, the
    current screen's title, screen-specific actions, the notification bell, and
    a new-chat button on the right. The bottom tab bar is not shown.
-   The sidebar opens full-screen over the app bar: close button and product name,
    a full-width search pill, labelled rows for 새 채팅 and 할 일, a 더보기 row for
    the remaining destinations, the chat list (one line per room; unnamed rooms show
    their last message), the instance list, and the account row.
-   Choosing any destination in the sidebar closes it.
-   The chat room title and its actions (artifacts, settings) appear in the app
    bar; the room's own header row is hidden.
-   With simple UI off, the previous bottom tab bar is kept unchanged. Wider screens
    are unaffected.
-   Every icon-only action retains an accessible name.

### Mobile conversation styling

-   Agent replies render without a bubble as 16px/24px prose; the sender name is a
    small muted line above. People's messages render as bubbles (mine on the right,
    others' on the left).
-   Tool usage collapses to a single muted line (`도구 N개 실행함 ›`, with a failure
    count when any failed) and expands into a bordered list of one row per call.
-   File results render as bordered file cards below the reply text.
-   The composer is a white box docked at the bottom with a one-line AI disclaimer
    below it; the `+` and microphone menus open as bottom sheets.
-   The artifact panel opens only when the user taps (not automatically during a
    reply) and then fills the screen below the app bar.
-   The new-chat screen centers the greeting and docks the composer at the bottom.
-   The 할 일 list uses a large page title and divider-separated rows showing title,
    current task, and `status · time · count`.
-   The instance conversation shows its title in the app bar. On phones the progress
    strip above the thread is replaced by a one-line progress pill directly above the
    composer (current step, "내 차례" when it is mine, done/total). There is no
    대화 / 산출물 switch: the pill or a panel button in the app bar opens a right-side
    panel (Claude Cowork style) with collapsible 진행 상황 (vertical checklist) and
    산출물 (output cards) sections; tapping outside closes it. Wider screens keep the
    strip and the two-column layout.
-   Finished steps that left values are shown in the conversation as the same output
    card used in the 산출물 panel (not as "key: value" text); tapping the card opens the
    original form read-only. The card is the only thing a finished step adds to the
    conversation: no "아래 내용으로 제출했습니다" / "작업을 마치고 …" lead, no value text.
    A step whose values are all empty gets no card. The card shows at most four
    fields and three lines per value; the rest is in the original view.
-   The input form of my current step is loaded from the step's own definition, so
    subprocess steps and free-input (`defaultform`) steps show their fields.

### Starting a process from chat stays in the chat room

-   When the agent starts a process from a chat room (`execute_process`), the user
    stays in that chat room. While the tool runs, the conversation shows a working
    indicator `✻ {프로세스 이름}를 시작하는 중…`.
-   When it finishes, the conversation shows a card `{프로세스 이름}가 실행되었습니다`
    with the instance name. Tapping the card opens that instance's chat
    (`/instancelist/{id}`); nothing navigates automatically. The instance list in
    the sidebar is refreshed.
-   A failed start shows `프로세스를 시작하지 못했습니다 — {reason}` instead of a card.
-   Flow (deep agent and 기본 에이전트/work-assistant): request → questions only for
    what is missing (roles one at a time, then the start step's input form) → one
    `execute_process` with the final values → working indicator → card. If the
    request already gives the roles and the first form's values, the agent starts
    the process directly and no input form is shown.
-   The start-step input form (`get_form_fields`) is shown only on the latest reply
    and only when that reply did not start a process, so no `제출` appears under a
    launch card and an old form cannot start the process again.
-   The MCP server (`process-gpt-mcp`) enforces the start: `execute_process` only
    accepts the start activity (`get_process_detail` returns `start_activities`),
    returns the existing instance (`already_started`) when the same user started the
    same process with the same first-form values in the last 10 minutes, strips a
    `formHandler:` prefix from `form_key`, and normalises `role_mappings` to the
    engine's `{name, endpoint, default, resolutionRule}` shape. Cards pointing to the
    same instance collapse into one, and rejected attempts are hidden once a start
    succeeded.
-   An `ask_user` question that only has `question` and `suggestions` is shown as a
    question panel (suggestions plus free text) instead of being hidden in the tool log.
-   The card is rebuilt from the saved tool record, so it is still there when the
    chat room is reopened. A start whose result never arrived is shown as failed,
    not as a spinner that never ends.

### Instance progress reflects the engine's planned work

-   The engine pre-creates every reachable later step as `TODO` (planned). Planned
    steps are shown as waiting: they are not "in progress" in the progress views,
    they do not produce "다음 단계로 … 진행되며" announcements, and they are not counted
    as work in the 할 일 list. A step becomes current only when its work item is
    `IN_PROGRESS`, `PENDING`, `SUBMITTED` or `NEW`.
-   Step announcements are timed by the work item's actual start time
    (`actual_start_date`), not its planned `start_date`.
-   Steps are ordered by their longest distance from the start event, so a step
    where exclusive-gateway branches rejoin appears after all of the branches.
-   Every step of the definition stays in the progress views. The branches of an
    exclusive, inclusive or event-based gateway are drawn as one branch block
    (`1 > 2 > 3-a 또는 3-b 또는 3-c > 4`) marked with a diamond. Once a branch has
    started, only that branch is checked and the other branches (and the steps
    reachable only through them) are shown as `건너뜀`. Before the gateway decides,
    all branches are open and the "next" hint names the branch block.
-   Once the instance is finished, steps that never started are shown as `건너뜀`.
-   The done/total count covers the steps that are actually walked: skipped
    steps are not counted, and an undecided branch block counts as its longest branch.
-   A subprocess (call activity) step records its start time when it starts
    waiting for its children, so its announcement appears before the subprocess
    steps rather than after them.
-   When my current step is in agent-draft mode, the prompt tells me to review the
    draft and submit it.

### Work tab uses process instances

-   The work tab continues to use `/todolist` as its stable route, but simple UI
    renders an instance list instead of the work-item kanban.
-   Each row identifies the process instance and its current actionable work.
-   When a newly assigned actionable work item is observed, its instance moves to
    the top according to that work item's latest timestamp and displays a
    `새 할 일` indicator.
-   An actionable work item whose instance row is missing still appears as its own
    row and opens the work-item screen, so assigned work is never hidden.
-   The indicator survives reload and is cleared for that instance when the user
    opens it.
-   Non-simple UI keeps the existing work-item kanban.

### Conversational process start

-   A request to run an existing process stays in chat instead of sending the user
    to the definition execution screen.
-   After resolving the process, the assistant asks for each role assignment in
    definition order, one role at a time, using the question
    `{n}번 {role} 역할은 누구로 설정하시겠습니까?`.
-   After all roles are assigned, the assistant fetches the first activity form;
    the chat renders that form inline.
-   Submitting the first form executes the process with the collected role
    mappings and immediately opens `/instancelist/{instance-id}`, whose simple UI
    provides the instance chat surface.

### Instance conversation shows progress

-   The instance conversation shows the process steps in definition order above the
    thread, marking each step as done, current, or waiting, and scrolls the current
    step into view.
-   Each step carries the name of whoever performs it.
-   When a step starts, the conversation records a Process GPT message naming the
    step and who performs it; when it is the reader's own turn it says so.
