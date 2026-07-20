# deep-agent-process-generation Specification

## Purpose
Define ProcessGPT's user-visible contract for generating an executable business
process through the main DeepAgent chat.

## Requirements

### Requirement: Process generation follows the approved five-stage workflow
The DeepAgent SHALL create a realistic numbered process proposal, obtain one
approval/rejection HITL decision, write a ProcessGPT process definition, obtain
one multi-select HITL decision for concrete skill/agent/DMN candidates, and then
generate forms, selected artifacts, validation evidence, and the final result
without additional confirmation prompts.

#### Scenario: User approves a realistic process proposal
- **GIVEN** the user requests a business process in DeepAgent mode
- **WHEN** the user approves the numbered process proposal and selects candidates
- **THEN** the agent MUST continue through generation and validation
- **AND** MUST generate every selected skill/agent/DMN artifact
- **AND** MUST not generate unselected candidates as selected deliverables

### Requirement: Process definition updates preserve one valid schema
`process-definition.json` MUST always be one parseable JSON object using the
ProcessGPT `elements[]` schema. Initial creation and deliberate structural
replacement SHALL be atomic. Field enrichment SHALL update existing elements by
stable element ID and MUST preserve unrelated elements. Generic text editing
MUST NOT concatenate wrappers, flattened structures, or a second JSON document
into the definition.

#### Scenario: Forms and skills enrich an existing definition
- **GIVEN** a valid definition with events, activities, gateways, and sequences
- **WHEN** forms, skills, agents, or decision references are attached
- **THEN** the same element IDs and process flow MUST remain present
- **AND** the resulting file MUST parse as exactly one JSON object

### Requirement: Final output is execution-engine validated
The final generated output MUST be validated through the real execution engine;
static checks alone are insufficient. Before the result is offered for saving,
the integrated definition (including forms, skills, agents, and gateway
conditions) MUST pass the real process execution validation path. The validation
receipt MUST identify the final definition hash and engine-validation outcome.
Validation retries SHALL be bounded and a failed validation MUST NOT be reported
as successful generation.

#### Scenario: Integrated definition passes validation
- **GIVEN** all selected artifacts and forms have been integrated
- **WHEN** generation completes
- **THEN** the execution engine MUST have exercised the generated process
- **AND** the final receipt hash MUST match the delivered definition
- **AND** a start-to-end executable BPMN result MUST be available for inspection

### Requirement: Successful generation is saveable and restorable
A successful result MUST expose one process artifact set with a save action.
Saving SHALL persist the definition and BPMN, and reopening the chat or definition
map MUST restore the same process and supported previews.

#### Scenario: Save and reopen a generated process
- **GIVEN** generation and engine validation succeeded
- **WHEN** the user saves and later reopens the process
- **THEN** the same process identity, BPMN flow, forms, and selected artifacts MUST be restored
- **AND** the process MUST be available for an explicit user-initiated execution
