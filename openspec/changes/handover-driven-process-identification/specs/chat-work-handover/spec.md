# chat-work-handover Specification

## ADDED Requirements

### Requirement: Handover entry point in the room header
The room header MUST expose a `인계하기` icon action so a user can hand the current
work to the next assignee without leaving the conversation. It sits with the other
header icons; the composer stays a single `+` menu and is not given another button.

The action MUST NOT be offered on draft views that have no room yet, since there
are no artifacts to hand over.

#### Scenario: Handover action available in an active room
- **GIVEN** a user is in a chat room
- **WHEN** the room header renders
- **THEN** an `인계하기` icon action MUST be visible
- **AND** activating it MUST open the handover dialog

#### Scenario: Existing composer tools are preserved
- **GIVEN** the composer renders its `+` menu (파일 첨부 · 지식 베이스 · 폴더 업로드)
- **WHEN** the handover feature is present
- **THEN** the composer MUST render unchanged

### Requirement: Artifacts of the room are collected automatically
When the handover dialog opens it MUST present the artifacts this room already
holds as selectable candidates: agent workspace files, room attachments,
selected knowledge documents, and a conversation transcript. All candidates
SHALL be selected by default.

Agent workspace files live only in the agent sandbox, so on submit the selected
files MUST be persisted to storage before being referenced.

#### Scenario: Generated files appear as candidates
- **GIVEN** an agent has emitted workspace files into the room
- **WHEN** the user opens the handover dialog
- **THEN** each emitted file MUST appear as a selectable artifact
- **AND** internal manifests and dotfiles MUST NOT appear

### Requirement: Assignee picker treats people and agents as one resource kind
The next assignee MUST be chosen from a single picker covering both humans and AI
agents, because both are rows of `public.users` and both are placed on the
organization chart. The picker MUST be the app's standard user/agent field so
that built-in agents (which exist only in client defaults, not in `users`) are
also selectable.

#### Scenario: Built-in agents are selectable
- **GIVEN** the deployment has built-in agents that are not rows in `users`
- **WHEN** the user opens the assignee picker in the handover dialog
- **THEN** those built-in agents MUST appear alongside humans and tenant agents

#### Scenario: Choosing an agent routes the work item
- **GIVEN** the user selects an AI agent as the next assignee
- **WHEN** the handover is submitted
- **THEN** the created work item MUST carry an orchestration that a poller claims
- **AND** the orchestration MUST default to the current room's runtime, never to a
  value derived from `users.agent_type` (which is a type marker, not a runtime)

### Requirement: Handover creates real downstream work
Submitting a handover MUST create a chat room for the recipient, insert a briefing
message, attach the handed-over artifacts, create an ad-hoc work item referencing
the source room, and notify the recipient.

The created work item MUST NOT go through a path that writes a process-instance
row, because an ad-hoc handover has no process instance.

#### Scenario: Recipient receives room, task and artifacts
- **GIVEN** a user hands over work with three artifacts selected
- **WHEN** the handover completes
- **THEN** a new chat room MUST exist for the recipient containing a briefing message
- **AND** an ad-hoc work item MUST exist assigned to the recipient
- **AND** the work item MUST reference the source room via `reference_ids`

#### Scenario: A work item without a process instance is accepted
- **GIVEN** the database records task execution for every new work item
- **WHEN** an ad-hoc handover work item without a process instance is created
- **THEN** the work item MUST be created
- **AND** the handover MUST NOT fail on the missing instance id

#### Scenario: Handing over to an agent keeps the sender in the room
- **GIVEN** a user hands over work to an agent
- **WHEN** the recipient room is created
- **THEN** the sender MUST be a participant of that room
- **AND** the sender MUST be able to hand the agent's result to the next assignee

### Requirement: The recipient can see and pass on what was handed over
Whoever receives the work — a person or an agent — MUST be able to see the result and
the files handed over, and pass them on to the next assignee. Handed-over files MUST be
placed in the receiving room's agent workspace (`files/skills/{tenant}/{room}/`), so the
room's agent finds them on its first turn and the room's file panel lists them. File
names the storage cannot key directly (e.g. Korean) MUST round-trip unchanged.

A work item handed to an agent runs on the task poller, yet MUST use the receiving
room's workspace and MUST leave its result (text and document files) in that room, so
the sender who stays in the room can pass it on.

The recipient's work item MUST appear in the recipient's work list.

#### Scenario: A person receives an agent-made document
- **GIVEN** a user and an agent produced `계약서_한빛상사.docx` in a room
- **WHEN** the user hands over to a person with the file selected
- **THEN** the file MUST be listed in the receiving room's work folder
- **AND** the receiving room's agent MUST be able to open the file
- **AND** the file MUST be a candidate when the recipient hands over again

#### Scenario: An agent receives the work
- **GIVEN** a user hands over to an agent with the conversation record selected
- **WHEN** the agent finishes the work item
- **THEN** the agent's result MUST be one message in the receiving room
- **AND** documents it produced MUST be candidates for the next handover

#### Scenario: The received work item is on the recipient's work list
- **WHEN** a person receives a handover
- **THEN** the work item MUST be in progress and listed on the recipient's work board

### Requirement: Handing over completes the sender's received work
When a person hands over from a room they received through a handover, the work item
they received there MUST be completed. Otherwise the screen says the work was done and
passed on while the record says it is still open.

#### Scenario: Passing on completes the received work item
- **GIVEN** a person received "견적 검토" in a room
- **WHEN** they hand over from that room
- **THEN** their "견적 검토" work item MUST be completed

### Requirement: A room handed to an agent can be closed
The agent's work item completes when the agent finishes, but the sender stays in the
room and may still pass the result on, so the work item alone cannot tell whether the
work ended. In such a room, after the agent finished and before anything was handed on,
the handover dialog MUST offer ending the work, which records `closed_at` on the handover.
Rooms whose end is decided by a person's work item MUST NOT offer it.

#### Scenario: Ending work after the agent finished
- **GIVEN** a user handed work to an agent and the agent finished
- **WHEN** the user ends the work from the handover dialog
- **THEN** the handover into that room MUST record `closed_at`

### Requirement: Every handover is recorded as an event
Each handover MUST append a row to `public.handover_events` capturing who handed
over to whom, what was done, what comes next, which artifacts moved, and when.

#### Scenario: Explicit handover is recorded
- **GIVEN** a user completes the handover dialog
- **WHEN** the handover is submitted
- **THEN** exactly one `handover_events` row MUST be written with
  `source = 'chat_handover'` and `is_explicit = true`
- **AND** the sending room MUST hold exactly one handover notice and the receiving room
  exactly one briefing, neither overwritten by later handovers nor multiplied by later turns

### Requirement: Implicit agent delegation is recorded without a button
Work moving to an agent without anyone pressing a button MUST also be recorded —
whether the agent was invited into the room or a message was routed to it.
Otherwise automated steps disappear from any later analysis.

Recording SHALL happen per delegation unit (one turn), not per token, and MUST be
idempotent so that reconnecting to a stream does not duplicate rows.

#### Scenario: Routing a message to an agent is recorded
- **GIVEN** a user sends a message that is routed to an agent
- **WHEN** the agent turn starts
- **THEN** a `handover_events` row MUST be written with
  `source = 'agent_delegation'` and `is_explicit = false`

#### Scenario: Answering the agent's question is not a new delegation
- **GIVEN** an agent asked the user a question and the user answers it
- **WHEN** the answer resumes the agent run
- **THEN** no new implicit delegation MUST be recorded

#### Scenario: The conversion room is not recorded
- **GIVEN** a room opened by the identification screen to convert a discovered process
- **WHEN** the generation request is sent to the agent
- **THEN** no handover event MUST be recorded, so mining never reads its own output as work

#### Scenario: Stream reattach does not duplicate the record
- **GIVEN** a delegation has already been recorded for a trigger message
- **WHEN** the browser reloads and reattaches to the same stream
- **THEN** the number of delegation rows for that (room, agent, trigger) MUST stay 1

#### Scenario: Agent turn completion closes the round trip
- **GIVEN** a delegation row exists for an in-flight agent turn
- **WHEN** that turn finishes
- **THEN** the row's `returned_at` MUST be set
- **AND** artifacts produced in that turn MUST be referenced on the row

### Requirement: Handover threads correlate like email threads
The room where a piece of work first started MUST be propagated to each receiving
room, the way an email thread carries the root message id forward. Resolution
SHALL prefer the value carried on the room itself, fall back to tracing the event
log, and finally treat the current room as the thread root.

#### Scenario: A three-hop handover stays one thread
- **GIVEN** work is handed from A to B, then B to C
- **WHEN** the thread of the final room is resolved
- **THEN** all three handovers MUST report the same `origin_room_id`
