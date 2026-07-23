# chat-hitl-single-render Specification

## Purpose
Define how a single assistant turn — delivered over the SSE stream, the `chats`
table via supabase realtime, and (for pdf2bpmn) the `events` table — is collapsed
into exactly one rendered message, so that a human-in-the-loop card such as the
컨설팅 초안 confirmation never appears twice.

## Requirements

### Requirement: Streaming assistant messages defer persistence until the server row exists
A streaming assistant message registered in `activeStreams` SHALL be marked as
server-persisted. While that mark is set and no `rowUuid` has been assigned,
`persistMessageFrontendState()` MUST NOT write to `chats`, because an upsert
keyed on the client uuid creates a second row for the same turn.

#### Scenario: tool_end attaches a HITL panel before the realtime INSERT
- **GIVEN** an assistant turn is streaming and the backend will persist its `chats` row
- **WHEN** `onToolEnd` attaches `__humanFeedback` and schedules a state persist
- **AND** the realtime INSERT has not yet assigned `rowUuid`
- **THEN** no `chats` write is issued at that moment
- **AND** a single fallback flush is scheduled

#### Scenario: Realtime INSERT flushes the deferred state into the server row
- **GIVEN** deferred frontend state on a streaming assistant message
- **WHEN** the supabase realtime INSERT for that turn arrives and `rowUuid` is stamped
- **THEN** the state is written into the row identified by `rowUuid`
- **AND** no row keyed on the client uuid is created

#### Scenario: Fallback flush runs only when the server row never arrives
- **GIVEN** deferred frontend state and no realtime INSERT within the grace period
- **WHEN** the fallback timer fires
- **THEN** it SHALL re-check `rowUuid` and skip the write if one has since arrived
- **AND** otherwise persist once under the client uuid
- **AND** all pending fallback timers are cleared when the room is left

### Requirement: HITL submission writes to the server row
`handleHumanFeedbackSubmit()` SHALL persist the submitted panel state using
`rowUuid || uuid`, never `uuid` alone.

#### Scenario: Submitting a panel updates the existing row
- **GIVEN** a HITL panel on an assistant message that has a `rowUuid`
- **WHEN** the user submits a response
- **THEN** the update targets `db://chats/<rowUuid>`
- **AND** the `chats` row count for that room is unchanged

### Requirement: The read path collapses duplicates
Message loading and rendering SHALL be resilient to rows written by earlier
client versions.

#### Scenario: loadMessages merges rows sharing a logical uuid
- **GIVEN** two `chats` rows whose `messages.uuid` is identical
- **WHEN** `loadMessages` maps them
- **THEN** one message is produced, based on the server row (`rowUuid !== uuid`)
- **AND** `__humanFeedback` and `pdf2bpmnResult` present on either row are preserved

#### Scenario: displayMessages does not duplicate a stream already in messages
- **GIVEN** a streaming message whose `uuid`, `clientUuid`, or `rowUuid` already
  matches an entry in `messages`
- **WHEN** `displayMessages` is computed
- **THEN** the streaming entry is omitted

#### Scenario: Chat.vue collapses identical HITL panels
- **GIVEN** two rendered messages whose `__humanFeedback` share the same
  `question`, `context`, `feedback_type`, and submitted state
- **WHEN** `filteredMessages` is computed
- **THEN** only the first is kept
- **AND** panels with neither a question nor a context are left untouched
