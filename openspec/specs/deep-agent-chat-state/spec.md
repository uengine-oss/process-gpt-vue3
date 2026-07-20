# deep-agent-chat-state Specification

## Purpose
Define the observable lifecycle of DeepAgent tool activity in chat so users can
distinguish active work from completed, failed, or interrupted work.

## Requirements

### Requirement: Tool execution state reaches a terminal UI state
The UI MUST represent each DeepAgent tool call with an accurate lifecycle state.
While a tool call is active, chat MAY show a friendly `실행 중` indicator and
the execution-details panel SHALL record it as running. When `tool_end` arrives,
the matching call MUST transition to `done`, its output MUST remain available in
the collapsible execution details, and the visible chat bubble MUST NOT continue
to claim that the tool is running.

The terminal tool state and cleared transient status MUST be persisted so room
reload cannot restore a stale `실행 중` bubble. Stream completion SHALL also
finalize any tool call for which the terminal callback was missed.

#### Scenario: Structured process update completes
- **GIVEN** the chat displays `update_process_definition 실행 중...`
- **WHEN** the matching tool result is received
- **THEN** the call MUST be recorded as `done`
- **AND** the visible bubble MUST no longer display `실행 중`
- **AND** reopening the same room MUST NOT restore that stale running text

#### Scenario: A tool is genuinely still running
- **GIVEN** no matching `tool_end`, stream completion, error, or abort has occurred
- **WHEN** the user observes the current DeepAgent response
- **THEN** the UI SHOULD continue to show an active progress indication
- **AND** MUST NOT mark the call complete prematurely

### Requirement: Tool details remain inspectable without raw status noise
User-visible chat text MUST use friendly tool labels. Tool name, input, output,
skill, and MCP execution details MAY be shown inside a collapsed, expandable
execution-details area, while transient machine events MUST NOT become the final
assistant message.

#### Scenario: Inspect a completed skill or MCP call
- **GIVEN** a DeepAgent used a skill or MCP tool
- **WHEN** the user expands its execution details
- **THEN** the UI MUST show the meaningful tool/skill/MCP identity and result
- **AND** the ordinary chat bubble MUST remain readable and terminal
