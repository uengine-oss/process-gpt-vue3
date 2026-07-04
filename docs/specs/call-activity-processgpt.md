# CallActivity Execution in ProcessGPT Mode

## Status

Draft

## Goal

Enable BPMN `CallActivity` in ProcessGPT mode so a parent process can call another process definition during execution.

The execution source of truth for ProcessGPT is the Supabase runtime JSON stored in `proc_def.definition` and `proc_def_version.definition`. BPMN XML in `proc_def.bpmn` or `proc_def_version.snapshot` is used for modeling/viewing and compatibility, but completion execution primarily loads `definition`.

## Background

Current frontend support:

- BPMN modeler can create or replace an element with `bpmn:CallActivity`.
- BPMN XML can store uEngine extension properties including `definitionId`.
- uEngine/PAL mode has a CallActivity process selector panel.

Current completion behavior:

- The execution project loads `proc_def.definition` or `proc_def_version.definition`.
- It maps that JSON into `ProcessDefinition` and `ProcessActivity`.
- Existing child process logic supports embedded `subProcesses[].children`.
- External process calls through `CallActivity.definitionId` are not yet a first-class execution path.

uEngine reference behavior:

- In `uengine6-jdk21`, `org.uengine.kernel.bpmn.CallActivity` extends `SubProcessActivity`.
- `SubProcessActivity` creates a separate child `ProcessInstance` from `definitionId` and `version`.
- The child instance is linked to the parent with root/returning process metadata.
- The parent activity waits for the child process unless `runAndForget` is enabled.
- Variable and role bindings are transferred through explicit binding definitions.

ProcessGPT should follow this model: a `CallActivity` is an external child process invocation, not a UI-only link or embedded subprocess.

## Terms

- Parent process: the process containing the CallActivity node.
- Child process: the process definition referenced by the CallActivity.
- CallActivity node: an activity whose `type` is `CallActivity`.
- Runtime definition: JSON stored in `proc_def.definition` or `proc_def_version.definition`.
- Modeling XML: BPMN XML stored in `proc_def.bpmn` or `proc_def_version.snapshot`.
- External subprocess: a separate process instance created from another process definition.

## Runtime Definition Contract

The frontend must persist CallActivity in the runtime JSON because completion executes from JSON.

Minimum activity shape:

```json
{
  "id": "Task_call_child",
  "name": "Call child process",
  "type": "CallActivity",
  "role": "initiator",
  "description": "",
  "properties": "{\"definitionId\":\"sales/testProcess\",\"roleBindings\":[],\"parameters\":[]}"
}
```

Required fields:

- `id`: unique activity id in the parent process.
- `name`: display name.
- `type`: must be `CallActivity`.
- `role`: role used for parent work item assignment and inherited defaults.
- `properties.definitionId`: child process definition id.

Recommended optional fields inside `properties`:

- `roleBindings`: array for parent-to-child role mapping.
- `parameters`: array for parent-to-child variable mapping.
- `version`: optional child definition version selector when the runtime supports fixed-version calls.
- `runAndForget`: optional boolean. Defaults to `false`.

`properties` is currently a JSON string in the completion `ProcessActivity` model. The frontend must write valid JSON when storing CallActivity-specific settings.

## BPMN XML Compatibility Contract

When BPMN XML is saved, the same `definitionId` should also be stored in the CallActivity extension JSON:

```xml
<bpmn:callActivity id="Task_call_child" name="Call child process">
  <bpmn:extensionElements>
    <uengine:properties>
      <uengine:json>{"definitionId":"sales/testProcess","roleBindings":[],"parameters":[]}</uengine:json>
    </uengine:properties>
  </bpmn:extensionElements>
</bpmn:callActivity>
```

The runtime JSON wins if XML and JSON disagree. Validation should warn or fail on mismatch before publish.

## Frontend Requirements

1. ProcessGPT mode must allow selecting a child process for CallActivity.
2. Saving a CallActivity must update both:
   - BPMN XML extension properties.
   - `proc_def.definition.activities[].properties`.
3. The selected child process id must be normalized consistently with existing definition ids:
   - no `.bpmn` suffix for runtime `definitionId`, unless existing ProcessGPT ids require it.
   - lowercased only if the existing `proc_def.id` lookup contract requires lowercase.
4. Validation must fail when a ProcessGPT CallActivity has no `definitionId`.
5. Version publish flow must copy the updated runtime JSON into `proc_def_version.definition`.

## Completion Requirements

Completion must treat CallActivity as an external child-process invocation.

Execution flow:

1. Detect next activity whose runtime activity type is `CallActivity`.
2. Read `definitionId` from `activity.properties`.
3. Load the child runtime definition through the same version resolution policy used for normal process start.
4. Create a child process instance:
   - `proc_def_id`: child `definitionId`.
   - `parent_proc_inst_id`: parent instance id.
   - `root_proc_inst_id`: parent root id or parent instance id.
   - parent return activity id: parent CallActivity id or tracing tag.
   - `status`: `NEW`.
5. Create the initial child work item from the child process start event or initial activity.
6. Store the child instance id under the parent CallActivity execution state.
7. If `runAndForget` is `true`, complete the parent CallActivity immediately after child creation.
8. Otherwise, keep the parent CallActivity pending until child completion.
9. When all child instances for the parent CallActivity complete, mark the parent CallActivity work item as submitted or otherwise trigger parent progression.
10. Continue the parent process through outgoing sequence flows from the CallActivity.

Initial MVP may inherit parent role bindings directly only as a compatibility fallback. The uEngine-compatible target is explicit `roleBindings` and `parameters`.

## Parent-Child State Contract

The completion project should persist enough state to resume the parent after the child completes.

Minimum state:

```json
{
  "parent_proc_inst_id": "parent-uuid",
  "root_proc_inst_id": "root-uuid",
  "return_activity_id": "Task_call_child",
  "child_proc_inst_id": "child-uuid",
  "runAndForget": false
}
```

Expected behavior:

- Parent CallActivity is not considered complete while a non-`runAndForget` child instance is active.
- Child completion checks `parent_proc_inst_id` and `return_activity_id`.
- Parent resumes from the CallActivity outgoing sequence only after the relevant child instance is completed.
- If multiple child instances are added later, parent resumes only after all children for the same CallActivity are completed.

## Data Mapping

### Role Mapping

uEngine-compatible target:

- `properties.roleBindings` maps parent roles to child roles.
- The child role binding is created by copying the parent role mapping and assigning it to the target child role.

Example:

```json
{
  "roleBindings": [
    {
      "sourceRole": "requester",
      "targetRole": "initiator"
    }
  ]
}
```

MVP fallback:

- If `roleBindings` is empty, copy parent `role_bindings` unchanged to the child instance.
- This fallback is intentionally simpler than uEngine and should be documented as compatibility behavior.

### Parameter Mapping

uEngine-compatible target:

- `properties.parameters` maps parent variables to child variables before child execution.
- `direction` supports at least `IN` for MVP-level execution.

Example:

```json
{
  "parameters": [
    {
      "direction": "IN",
      "source": "customerId",
      "target": "customerId"
    }
  ]
}
```

MVP:

- No parameter mapping UI is required initially.
- Backend parser should tolerate an empty `parameters` array.

## Implementation Plan

### Phase 1 - Frontend Definition Contract

Scope:

- Enable the existing CallActivity child-process selector in ProcessGPT mode.
- Save `definitionId` into both BPMN XML extension properties and runtime JSON `activities[].properties`.
- Validate that every ProcessGPT `CallActivity` has a valid `definitionId`.

Verify:

- A saved parent process has `type: "CallActivity"` in `proc_def.definition.activities`.
- The activity `properties` parses as JSON and contains the same `definitionId` as the BPMN XML extension JSON.
- Publish copies the runtime JSON into `proc_def_version.definition`.

### Phase 2 - Completion Child Instance Creation

Scope:

- Detect `ProcessActivity.type == "CallActivity"`.
- Parse `activity.properties`.
- Load child definition by `definitionId` using the existing completion version-resolution path.
- Create a child process instance with parent/root/return activity metadata.
- Create the child initial work item.

Verify:

- Completing the parent activity before the CallActivity creates one child instance.
- The child instance has `parent_proc_inst_id`, `root_proc_inst_id`, and return activity metadata.
- The child first work item is assigned according to inherited or mapped role bindings.

### Phase 3 - Parent Wait and Resume

Scope:

- Keep parent CallActivity pending while the child is active.
- On child completion, find the waiting parent CallActivity.
- Resume parent outgoing flow after the CallActivity.
- Support `runAndForget: true` as immediate parent continuation after child creation.

Verify:

- Parent does not create the next activity before child completion when `runAndForget` is false.
- Completing the child creates the next parent work item.
- `runAndForget: true` creates the child and immediately continues the parent.

### Phase 4 - uEngine-Compatible Mapping

Scope:

- Implement explicit `roleBindings` mapping.
- Implement basic `parameters` `IN` mapping.
- Keep unchanged role inheritance as a fallback only when no explicit mapping exists.

Verify:

- `sourceRole -> targetRole` creates the expected child assignee binding.
- Parent variable values are copied to child variables according to `parameters`.
- Missing source roles or variables fail with a clear execution error.

## Acceptance Criteria

1. A user can create a CallActivity in ProcessGPT mode and select a child process.
2. Saving the process stores the child process id in `proc_def.definition.activities[].properties.definitionId`.
3. Saving the process also stores the same child process id in BPMN XML extension JSON.
4. Validation blocks publish or execution when a CallActivity has no `definitionId`.
5. Starting a parent process proceeds normally until the CallActivity.
6. When the parent reaches the CallActivity, completion creates a child process instance using the referenced `definitionId`.
7. The child process creates its first work item.
8. Completing the child process resumes the parent process after the CallActivity.
9. Parent and child instances retain traceability through `parent_proc_inst_id` and `root_proc_inst_id`.
10. Explicit role binding maps a parent role to a different child role.

## Out of Scope for MVP

- Multi-instance CallActivity.
- Complex role mapping UI.
- Complex parameter mapping UI.
- Cross-tenant child process invocation.
- XML-only CallActivity execution without runtime JSON.
- Compensation/error-boundary behavior around CallActivity.
- Full uEngine execution-scope parity beyond parent/root/return metadata.

## Risks

- XML and runtime JSON can diverge. Runtime JSON must be treated as execution source of truth.
- Existing completion model stores `properties` as a string. Invalid JSON will break CallActivity parsing unless validation catches it.
- Child process version selection must match existing `getExecutionDefinition` and completion version resolution rules, or frontend preview and runtime execution can disagree.
- Parent resume logic must avoid resuming before all child instances complete.
- Blindly inheriting all parent roles may hide missing role mapping errors. Treat inheritance as MVP fallback, not the final contract.

## Verification Plan

Create a parent process:

```text
Start -> A(UserTask) -> B(CallActivity: child_process) -> C(UserTask) -> End
```

Create a child process:

```text
Start -> X(UserTask) -> End
```

Verify:

- Parent `proc_def.definition.activities` includes B with `type: "CallActivity"`.
- B `properties` parses to `{ "definitionId": "child_process" }`.
- Parent BPMN XML includes the same `definitionId`.
- Completing A creates a child instance for `child_process`.
- Completing X resumes parent and creates C.
