# Simple UI mobile work surface

## Purpose

Define the compact mobile navigation and process-start experience shown while
`pg.simpleUi` is enabled.

## Requirements

### Mobile bottom navigation

-   At phone widths (768px and below), authenticated users see four icon-only
    actions in this order: chat, work, account, notifications.
-   The notification action is the right-most bell and opens the existing live
    notification list without navigating away from the current screen.
-   Every icon-only action retains an accessible name.

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
