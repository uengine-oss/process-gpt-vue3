# process-identification Specification

## ADDED Requirements

### Requirement: Process identification is a distinct capability from process improvement
The product MUST separate **identification** (finding work that has no process
definition yet) from **improvement** (changing a process that already exists).
Improvement is handled by the review board (`/review-board`), which is driven by
`proc_def_approval_state` for existing definitions. Identification MUST have its
own screen reachable from the sidebar, so a user can tell where a newly proposed
process came from.

#### Scenario: Identification screen is reachable from the menu
- **GIVEN** a signed-in user on the main screen
- **WHEN** the user opens the `프로세스 식별` menu entry
- **THEN** the identification screen MUST open
- **AND** the screen MUST state that it proposes new processes and that existing
  process improvement is handled in the review board

### Requirement: Handover records are grouped into threads
The identification screen MUST group accumulated handover records by their thread
root, so that work which moved across several rooms and assignees reads as one
strand. Each thread SHALL show its steps in order, distinguish agent-performed
steps, and distinguish implicit (auto-recorded) delegations from explicit ones.

#### Scenario: Threads are listed with their steps
- **GIVEN** handover records exist for several completed cases
- **WHEN** the identification screen loads
- **THEN** each thread MUST be listed with its step count and ordered steps
- **AND** steps performed by agents MUST be visually distinguished

### Requirement: The discovered process renders in the existing BPMN modeler
The discovered process MUST be displayed using the product's existing BPMN
modeler rather than a bespoke diagram, so that what a user reviews here is the
same artifact they will later edit. The discovery output is a ProcessGPT process
definition; the screen MUST convert it into the authoring shape the modeler
consumes before rendering.

#### Scenario: Discovered process is drawn with roles and gateways
- **GIVEN** discovery produced a process with role assignments and a branch
- **WHEN** the identification screen renders the result
- **THEN** the BPMN modeler MUST draw the activities, the role lanes and the gateways
- **AND** no sequence flow may reference a node that was not drawn

### Requirement: Control flow discovery is deterministic and sound
Discovery MUST NOT rely on an LLM for structure. It SHALL build a
directly-follows graph from the event log and derive a process tree by recursive
cut detection, so that the emitted model cannot contain deadlocks or nodes that
are unreachable from the start event.

Steps that do not appear in every case MUST be emitted as skippable branches. A
step observed in only some cases MUST NOT be modelled as mandatory.

#### Scenario: An optional step becomes a skippable branch
- **GIVEN** a step appears in 3 of 8 observed cases
- **WHEN** the process is discovered
- **THEN** that step MUST be enclosed in an exclusive branch that can be skipped
- **AND** steps present in every case MUST remain mandatory

#### Scenario: Rework after rejection is discovered as a loop
- **GIVEN** cases `작성→검토→승인` and `작성→검토→수정→검토→승인`
- **WHEN** the process is discovered
- **THEN** 검토 and 수정 MUST form a loop that returns to 검토
- **AND** they MUST NOT be modelled as "one of 검토 or 수정"

#### Scenario: A step always done within a branch stays mandatory in that branch
- **GIVEN** three cases `a→b→x→y` and three cases `a→c→z→y`
- **WHEN** the process is discovered
- **THEN** b and x MUST be mandatory inside their branch
- **AND** optionality MUST be counted over the cases of that branch, not over all cases

#### Scenario: Undetermined structure is not presented as an exclusive choice
- **GIVEN** a sub-log in which no cut can be found
- **WHEN** the process is discovered
- **THEN** its activities MUST be emitted as an unordered loop
- **AND** they MUST NOT be emitted as an exclusive choice of one activity

#### Scenario: Emitted definition passes the engine contract
- **GIVEN** a discovered process definition
- **WHEN** it is validated against the engine's definition contract
- **THEN** it MUST have exactly one start event and one end event
- **AND** every activity MUST declare at least one output
- **AND** every node MUST be reachable from the start event

### Requirement: Conversation text must never become an activity name
Discovery MUST NOT derive an activity label from the raw chat message that
triggered an implicit agent delegation. That text is a conversation turn, not an
activity name; using it makes whole sentences appear as process steps and the
model degenerates.

Until a normalized label exists for such an event, that event MUST be excluded
from control-flow discovery.

#### Scenario: Raw trigger text is rejected as a label
- **GIVEN** an implicit delegation whose only label is the raw triggering message
- **WHEN** the event log is built
- **THEN** that event MUST NOT contribute an activity to the discovered process

#### Scenario: A normalized label is accepted
- **GIVEN** an implicit delegation that has a normalized activity label
- **WHEN** the event log is built
- **THEN** that label MUST be used as the activity name

### Requirement: The thread starter's work is the first step
The first trusted handover of a thread (`chat_handover` or `todolist`) carries what
the sender has done so far. That work, performed by the sender, MUST become the first
step of the case. Without it the step that started the work and its performer are
lost, and a plain handover between two people has a single step and is never analyzed.
An implicit delegation's raw text MUST NOT be used for this.

#### Scenario: The starter's work becomes the first step
- **GIVEN** 김 hands over to 이팀장 after "견적서 작성", and 이팀장 hands over to 박대리
- **WHEN** the event log is built
- **THEN** the case MUST read 견적서 작성 → 견적 검토 → 고객 발송
- **AND** 견적서 작성 MUST be attributed to 김

#### Scenario: A handover between two people is analyzed
- **GIVEN** threads that consist of a single handover from one person to another
- **WHEN** the process is discovered
- **THEN** each thread MUST be a two-step case and MUST NOT be excluded

### Requirement: Only finished threads are discovered
A thread is finished when the work item last received in it is completed. The last
assignee does not hand over again, so "no further handover" cannot tell the end. When
the last handover went to an agent, the thread is finished only when the sender ended
the work (`closed_at`). Threads in progress MUST NOT change the discovered process; they
MUST still be listed, marked as in progress, and counted in the statistics.

#### Scenario: An unfinished thread does not make later steps optional
- **GIVEN** three finished quote threads and one stopped after the draft
- **WHEN** the process is discovered
- **THEN** the result MUST equal the result of the three finished threads alone
- **AND** the stopped thread MUST be listed as in progress

#### Scenario: The thread list is shown even when nothing can be discovered yet
- **GIVEN** fewer than three finished threads
- **WHEN** the identification screen opens
- **THEN** the threads MUST be listed with their progress
- **AND** the discovery panel MUST say why nothing was discovered

### Requirement: Cases without ordering information are excluded
A case containing a single step MUST be excluded from control-flow discovery,
because it carries no ordering information and would make every step look
optional. The number of excluded cases SHALL be reported.

#### Scenario: Single-step cases do not weaken the model
- **GIVEN** the log contains one case with a single step and eight multi-step cases
- **WHEN** the process is discovered
- **THEN** the single-step case MUST be excluded
- **AND** steps present in all eight remaining cases MUST stay mandatory

### Requirement: Discovery results are proposed, never applied
Identification MUST NOT modify a live process definition. The result SHALL be
recorded as a draft version plus a proposal in the existing resource pull-request
workflow, so that the existing review and approval UI applies unchanged.

The identification screen MUST list the proposals it has produced, so a user can
see where a proposed new process went.

#### Scenario: Proposing does not touch the live definition
- **GIVEN** a discovered process for an identifier that has no live definition
- **WHEN** the user proposes it as a new process
- **THEN** a draft version and an open proposal MUST be created
- **AND** no live process definition row may be created or modified

#### Scenario: Proposals are listed on the identification screen
- **GIVEN** proposals have been created from this screen
- **WHEN** the screen loads
- **THEN** each proposal MUST be listed with its status and branch

### Requirement: A discovered process converts to execution without re-describing it
Once a process has been discovered and drawn, the user MUST be able to convert it
toward execution directly from the identification screen. Because the flow is
already modelled, the user MUST NOT be required to describe the process again in
prose.

Activating the conversion SHALL open a conversation that already carries the
discovered flow — its ordered steps, the role assigned to each step, which steps
run automatically, which steps are conditional, and the observed evidence — and
generation SHALL begin without further input.

#### Scenario: Conversion opens a prepared conversation
- **GIVEN** a discovered process is displayed on the identification screen
- **WHEN** the user activates the conversion action
- **THEN** a conversation MUST open that already contains the generation request
- **AND** the request MUST list the discovered steps with their assigned roles
- **AND** the user MUST NOT have to type any description

#### Scenario: Conditional steps survive the conversion
- **GIVEN** the discovered process contains a step that can be skipped
- **WHEN** the conversion request is composed
- **THEN** that step MUST be marked as conditional in the request
