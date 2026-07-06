# ProcessGPT Mapper Runtime

## Status

MVP implemented for backend polling completion.

Implemented in:

- `D:\uEngineProjectC\processEsecution\process-gpt-execution\polling_service\mapper_runtime.py`
- `D:\uEngineProjectC\processEsecution\process-gpt-execution\polling_service\workitem_processor.py`

Frontend scope remains mapper authoring and persistence only.

## Goal

Enable mapper definitions created with the existing uEngine mapper UI to execute in ProcessGPT mode.

This is not only a persistence problem. Saving mapper JSON into BPMN extension properties or `proc_def.definition.activities[].properties` is necessary, but it does not make mapping work. ProcessGPT must evaluate mapper JSON at runtime and apply the mapped values to the correct form-data or execution payload.

## Core Assumption

ProcessGPT does not currently behave like classic uEngine where process variables are the single execution source of truth.

The practical source of truth is form-oriented data:

- current workitem form data,
- submitted `form_values` or `parameterValues`,
- previous activity form data,
- service response payloads,
- business rule facts/results,
- instance-level `variables_data` for values that must be shared across the whole process instance.

Therefore, ProcessGPT mapper runtime should be designed as a form-data mapping runtime, not as a direct clone of uEngine process-variable mapping.

## Current Mapper Producers

Existing frontend producers of mapper JSON include:

- `UserTaskPanel`
  - `eventSynchronization.mappingContext`
  - form input/output mapping paths.
- `EventSynchronizationForm`
  - `eventSynchronization.mappingContext`.
- `MultiEventSynchronizationForm`
  - event-specific `mappingContext`.
- `ReceiveTaskPanel`
  - `mapperIn`.
- `ServiceTaskPanel`
  - `mapperIn`
  - `outputMapping.mappingContext`.
- `BusinessRuleTaskPanel`
  - `eventSynchronization.mappingContext`.
- `GPTCallActivityPanel`
  - `mapperIn` for parent-to-child variable and lane mapping.

These producers generally emit mapper JSON in this shape:

```json
{
  "mappingElements": [
    {
      "argument": {
        "text": "targetField"
      },
      "direction": "out",
      "variable": {
        "name": "sourceField"
      }
    }
  ]
}
```

Transformer mappings use `transformerMapping`:

```json
{
  "mappingElements": [
    {
      "argument": {
        "text": "fullName"
      },
      "direction": "out",
      "transformerMapping": {
        "transformer": {
          "_type": "org.uengine.processdesigner.mapper.transformers.ConcatTransformer",
          "argumentSourceMap": {
            "left": "firstName",
            "right": "lastName"
          }
        },
        "linkedArgumentName": "fullName"
      }
    }
  ]
}
```

## Terms

- Mapping context: the saved mapper JSON object with `mappingElements`.
- Mapping element: one target assignment inside `mappingElements`.
- Source path: the value path read from ProcessGPT execution context.
- Target path: the value path written into the target form-data or payload.
- Transformer: a mapper operation identified by `transformerMapping.transformer._type`.
- Form-data context: the normalized runtime context that exposes current form data, previous form data, workitem metadata, instance metadata, and external payloads.

## Runtime Source Context

The mapper runtime must not assume that all source paths are process variables. It should resolve values from a normalized context with explicit namespaces.

Recommended context shape:

```json
{
  "forms": {
    "current": {
      "firstName": "Jane",
      "lastName": "Kim"
    },
    "byId": {
      "customer_registration_form": {
        "firstName": "Jane",
        "lastName": "Kim"
      }
    },
    "byActivity": {
      "Task_A": {
        "approved": true,
        "amount": 1000
      }
    }
  },
  "payload": {
    "request": {},
    "response": {}
  },
  "workitem": {
    "id": "todo-id",
    "activityId": "Task_B",
    "output": {}
  },
  "instance": {
    "id": "proc-inst-id",
    "variablesData": {
      "customerId": "C001",
      "approved": true
    },
    "roleBindings": [],
    "participants": []
  }
}
```

### Source Resolution Order

For legacy mapper paths without an explicit namespace, resolve in this order:

1. `forms.current`
2. `forms.byId[*]`
3. `forms.byActivity[*]`, newest or configured source activity first
4. `payload.response`
5. `payload.request`
6. `workitem`
7. `instance.variablesData`
8. `instance`

The runtime should record which source won in the trace. Silent ambiguity makes mapper behavior hard to debug.

Explicit namespace examples:

- `forms.current.customerName`
- `forms.customer_registration_form.customerName`
- `forms.byId.customer_registration_form.customerName`
- `forms.byActivity.Task_A.amount`
- `payload.response.status`
- `workitem.id`
- `instance.roleBindings`

For explicit paths that start with `forms.`, the runtime first reads from the direct `forms` object and then falls back to `forms.byId`. This makes mapper links such as `forms.vendor_onboarding_task_submit_vendor_need_form.담당자` resolve to submitted workitem output stored as `todolist.output.vendor_onboarding_task_submit_vendor_need_form.담당자`.

Legacy namespace examples from the existing mapper UI:

- `[instance].instanceId`
- `[roles].requester`
- `[activities].Task_A.status`

These should be translated into the ProcessGPT context when possible.

## Runtime Target Context

The same mapper JSON can target different runtime surfaces depending on where it is used.

### UserTask Input Mapping

Purpose:

- Prepare the initial form data for the current or next user task.

Target:

- form data shown to the user before submission.

Example:

- Previous task `firstName`, `lastName` -> current form `fullName`.

### UserTask Output Mapping

Purpose:

- Normalize submitted form data into values other tasks or services can consume.

Target:

- submitted form-data result or execution context snapshot.

### ReceiveTask Mapping

Purpose:

- Convert inbound external payload into ProcessGPT form-data context.

Target:

- current activity form data or normalized payload object.

### ServiceTask Input Mapping

Purpose:

- Build request body, query params, headers, or path variables from form-data context.

Target:

- outbound API request config.

### ServiceTask Output Mapping

Purpose:

- Convert API response into form-data context for later activities.

Target:

- `payload.response`-derived mapped values and/or next form initial data.

### BusinessRuleTask Mapping

Purpose:

- Build rule facts from form data and apply rule output to the execution context.

Target:

- rule input facts before execution,
- rule output/result after execution.

### CallActivity Mapping

Purpose:

- Map parent process form-data or instance-variable context into the child process initial context.
- Make mapped child form data available to the child process AI decision/fill step.

Target:

- child instance `variables_data` when the mapper target is `callActivity.variables.*`.
- child initial workitem form data when the mapper target is `childForm.<formId>.<fieldKey>`.
- child role binding when the mapper target is `callActivity.lane.<laneName>.endpoint`.

Important:

- This is not only `definitionId` persistence.
- Parent-to-child mapping must be evaluated before the child workitem is created.
- In ProcessGPT authoring UI, the CallActivity panel must open the mapper from the data/parameter tab.
- The mapper target tree for CallActivity must include `callActivity > variables > <called process variable name>`.
- The mapper target tree for CallActivity must include `callActivity > lane > <called process lane name> > endpoint`.
- The mapper tree for form mapping must include `parentForm` and `childForm` roots on both sides.
- `parentForm` and `childForm` roots must be shown after `Variables`, `lane`, `instance`, and `activities`.
- The `callActivity.variables.*` target names are authored in the frontend and consumed by backend CallActivity child creation.
- The `callActivity.lane.*.endpoint` target names are authored in the frontend and consumed by backend CallActivity child role-binding creation.
- `parentForm.<formId>.<fieldKey>` and `childForm.<formId>.<fieldKey>` names are authored in the frontend and consumed by backend CallActivity child creation.

## Mapping Runtime API

Recommended runtime interface:

```ts
type MappingRuntimeInput = {
  mappingContext: MappingContext;
  sourceContext: FormDataExecutionContext;
  targetMode:
    | 'userTaskInput'
    | 'userTaskOutput'
    | 'receiveTaskInput'
    | 'serviceTaskInput'
    | 'serviceTaskOutput'
    | 'businessRuleInput'
    | 'businessRuleOutput'
    | 'callActivityInput';
  options?: {
    failOnMissingSource?: boolean;
    failOnUnsupportedTransformer?: boolean;
  };
};

type MappingRuntimeOutput = {
  mappedValues: Record<string, unknown>;
  trace: MappingTraceItem[];
  errors: MappingRuntimeError[];
};
```

Default behavior:

- `failOnMissingSource`: `true` for publish/test/runtime execution, `false` for preview.
- `failOnUnsupportedTransformer`: `true` for runtime execution.

## Mapping Element Evaluation

For each `mappingElement`:

1. Determine target path from `argument.text`.
2. If `variable.name` exists, resolve source value directly.
3. If `transformerMapping` exists, evaluate the transformer.
4. Write the result into `mappedValues[targetPath]`.
5. Append a trace item.
6. If resolution fails, append an error and stop or continue according to options.

Direct mapping example:

```json
{
  "argument": {
    "text": "customerName"
  },
  "variable": {
    "name": "name"
  }
}
```

Evaluation:

- read `name` from source context,
- write it into `customerName`.

## Transformer MVP

The mapper runtime should start with a small supported transformer set.

### Required for MVP

- Direct mapping with `variable.name`.
- `org.uengine.processdesigner.mapper.transformers.DirectValueTransformer`
- `org.uengine.processdesigner.mapper.transformers.ConcatTransformer`
- `org.uengine.processdesigner.mapper.transformers.ReplaceTransformer`
- `org.uengine.processdesigner.mapper.transformers.SumTransformer`
- `org.uengine.processdesigner.mapper.transformers.MinTransformer`
- `org.uengine.processdesigner.mapper.transformers.MaxTransformer`
- `org.uengine.processdesigner.mapper.transformers.AbsTransformer`
- `org.uengine.processdesigner.mapper.transformers.RoundTransformer`
- `org.uengine.processdesigner.mapper.transformers.CeilTransformer`
- `org.uengine.processdesigner.mapper.transformers.FloorTransformer`

### Optional Later

- `NumberFormatTransformer`
- `BeanValueTransformer`
- `DirectSqlExpressionTransformer`
- Validators such as `NotNullValidator`, `RegularExpValidator`, `SizeValidator`

Validators need separate semantics because they do not simply produce mapped output. They should probably run as validation gates and return structured validation errors.

## Unsupported Transformer Behavior

Unsupported transformers must not be ignored.

Error shape:

```json
{
  "code": "UNSUPPORTED_TRANSFORMER",
  "message": "Unsupported mapper transformer.",
  "transformerType": "org.uengine.processdesigner.mapper.transformers.BeanValueTransformer",
  "target": "customerName"
}
```

## Trace Contract

Every runtime mapping evaluation should produce trace data for debugging.

Example:

```json
{
  "target": "fullName",
  "source": "forms.current.firstName, forms.current.lastName",
  "transformerType": "org.uengine.processdesigner.mapper.transformers.ConcatTransformer",
  "valuePreview": "Jane Kim",
  "status": "OK"
}
```

The trace should be available in logs or execution debug output. It should not expose sensitive data in user-facing logs unless product policy allows it.

## Storage Contract

Mapper JSON should be persisted in `activity.properties` inside the runtime definition because ProcessGPT execution loads `proc_def.definition` and `proc_def_version.definition`.

Recommended property names:

- Keep existing producer-specific fields for compatibility:
  - `mapperIn`
  - `eventSynchronization.mappingContext`
  - `outputMapping.mappingContext`
- Add a normalized field only if needed:
  - `mappingContexts`

Possible normalized shape:

```json
{
  "mappingContexts": {
    "input": {
      "mappingElements": []
    },
    "output": {
      "mappingElements": []
    }
  }
}
```

Do not remove existing fields until all consumers are migrated.

## Responsibility Split

Mapper support has two separate responsibilities.

| Responsibility | Owner | Description |
| --- | --- | --- |
| Mapper authoring and persistence | Frontend | The existing mapper UI stores which mapper is configured on which activity. It persists mapper JSON into runtime definition data such as `activity.properties.eventSynchronization.mappingContext`, `mapperIn`, or `outputMapping.mappingContext`. |
| Mapper execution | Backend completion runtime | During process execution, the backend reads mapper JSON from the runtime definition and evaluates it inside the same transaction/path that advances the process. This must cover direct user completion, polling-driven completion, service execution, business rules, and CallActivity execution. |
| Mapped value persistence | Backend completion runtime | The backend writes evaluated results to the correct storage, for example `todolist.output[formId]`, `bpm_proc_inst.variables_data`, service request payload, or child instance initial data. |
| Mapper trace/audit | Backend completion runtime | The backend records source, target, transformer, result status, and errors so polling/background execution can be debugged without relying on browser state. |

Frontend must not be the runtime authority for mapper execution. It may preview or validate mapper configuration, but the authoritative execution must happen in backend completion flow.

### Frontend Authoring Requirements

Common mapper UI:

- `Mapper.vue` must support side-specific expandable trees so a panel can add target-only roots without polluting the source tree.
- ProcessGPT mapper roots should use `lane`, not `roles`, in the visible UI.
- Internally, `lane.*` remains compatible with backend role-binding storage.

CallActivity panel:

- `GPTCallActivityPanel` must show a data mapping button when a called process is selected.
- The button opens `Mapper.vue`.
- The mapper tree contains the same root set on the left and right so the saved source and target paths resolve to real ports on both sides.
- Root order is `Variables`, `lane`, `instance`, `activities`, then selected form roots.
- Selected form roots appear as `parentForm` and `childForm` at the bottom of the tree.
- Visible form labels use human-readable form names. Internal ids are persisted in paths but are not shown in parentheses in the mapper labels.
- The source tree is the parent process context: forms, variables, lane, instance, and activities.
- The target tree includes the called process variables under `callActivity > variables`.
- The target tree includes the called process lanes under `callActivity > lane > <lane name> > endpoint`.
- Saving parent-to-child form mapping persists JSON into `uengineProperties.mapperIn` with `parentForm.<formId>.<fieldKey>` source paths and `childForm.<formId>.<fieldKey>` target paths.
- Saving child-to-parent form mapping persists JSON into `uengineProperties.mapperOut` with the same prefixed path rule.

Form-selection storage:

- `parentFormFields` and `childFormFields` store selected form fields as `formId.fieldKey`.
- `mapperIn` and `mapperOut` store executable mapper paths as `parentForm.formId.fieldKey` or `childForm.formId.fieldKey`.
- The unprefixed selection arrays are UI state; the prefixed mapper paths are the runtime contract.

Role mapping tab:

- The role mapping tab must present parent-to-child lane binding in user terms, not as a generic parameter-context table.
- The visible columns are parent process lane, direction, and child process lane.
- Direction display:
  - `>` means parent-to-child only and is stored as `IN`.
  - `<` means child-to-parent only and is stored as `OUT`.
  - `<>` means bidirectional and is stored as `IN-OUT`.
- The saved shape remains compatible with existing `roleBindings`:
  - `role.name`: parent/caller lane name.
  - `argument`: child/callee lane name.
  - `direction`: `IN`, `OUT`, or `IN-OUT`.
- `split` is hidden in ProcessGPT CallActivity role mapping because it is not meaningful for the current runtime.
- Child-to-parent role propagation is applied only when the child CallActivity completes and before the parent proceeds to activities after the CallActivity. It must not rewrite already completed parent tasks.

Example target tree:

```text
callActivity
  variables
    supplierName
    assignedReviewerEmail
    remediationOwner
  lane
    보안심사자
```

Example persisted mapper:

```json
{
  "mapperIn": {
    "mappingElements": [
      {
        "argument": {
          "text": "Variables.supplierName"
        },
        "direction": "out",
        "variable": {
          "name": "callActivity.variables.supplierName"
        },
        "isKey": false
      }
    ]
  }
}
```

Example persisted form mapper:

```json
{
  "parentFormFields": [
    "vendor_onboarding_task_submit_vendor_need_form.supplierName"
  ],
  "childFormFields": [
    "vendor_security_task_assess_security_risk_form.assessmentSummary"
  ],
  "mapperIn": {
    "mappingElements": [
      {
        "argument": {
          "text": "childForm.vendor_security_task_assess_security_risk_form.assessmentSummary"
        },
        "direction": "out",
        "variable": {
          "name": "parentForm.vendor_onboarding_task_submit_vendor_need_form.supplierName"
        },
        "isKey": false
      }
    ]
  }
}
```

## Mapped Value Persistence Options

This section compares where evaluated mapping output should be stored after runtime evaluation.

Current code indicates that ProcessGPT form values are primarily stored on workitems, not as classic uEngine process variables:

- `ProcessGPTBackend.getVariableWithTaskId()` reads form values from `todolist.output[formDefId]`.
- `ProcessGPTBackend.setVariableWithTaskId()` writes form values into `todolist.output[formId]`.
- `FormWorkItem.loadForm()` loads submitted or previous form data from `workItem.worklist.output[formDefId]`, `getVariableWithTaskId()`, and `workItem.parameterValues`.
- `bpm_proc_inst.variables_data` exists and is used by `getVariable()` / `setVariable()` for instance-level values, but its current read/write shape must be standardized.

### Comparison Table

| Candidate storage | Example shape | Best fit | Pros | Cons | Reasoning | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| `todolist.output[formId]` | `{ "orderForm": { "amount": 1000 } }` | UserTask input/output form values, mapped values that must appear in forms, previous activity form lookup | Already used by `getVariableWithTaskId()` and `FormWorkItem`; naturally scoped to activity/workitem/form; preserves form identity | Not a global process context; later tasks must know which previous workitem/form to read; can duplicate values across workitems | This is the closest match to ProcessGPT's actual form-data behavior. It stores values where current UI and backend already look for form data. | Primary storage for mapped form values. |
| `workitem.parameterValues` or returned workitem `parameterValues` | `{ "amount": 1000 }` or `{ "orderForm": { "valueMap": {} } }` | Prefilling a workitem at open time, transient mapping output for UI rendering | Easy to return from `getWorkItem()`; does not require DB schema change | Ambiguous shape in current code; can be transient and not reliably persisted; not a good long-term source of truth | Current code builds `parameterValues` from activity parameters and instance values, and `FormWorkItem` can merge it, but it is not consistently the durable store. | Use as delivery/cache layer, not canonical storage. |
| `bpm_proc_inst.variables_data` object map | `{ "amount": 1000, "approved": true }` | Values that must be available across the whole process instance by name | Instance-scoped; direct global lookup; best fit for mapper targets that are not tied to one form/workitem | Current code has array-style readers that must be updated or made compatible; loses activity/form provenance unless trace records producer | This is the correct storage for explicit process/global mapped values. It should not replace form output storage, but it should be the canonical instance-wide context. | Canonical storage for instance-wide mapped values. |
| `todolist.output.__mapped` or reserved mapped namespace | `{ "__mapped": { "amount": 1000 } }` | Mapper outputs that are not tied to a concrete form field but should stay activity-scoped | Keeps mapping results with the producing workitem; avoids polluting form fields | New convention; every consumer must learn the namespace; still activity-scoped | Helps preserve non-form transformer results without pretending they are form fields. | Optional for non-form outputs. |
| Service request payload only | `{ "body": { "amount": 1000 } }` | ServiceTask input mapping | Avoids unnecessary persistence; request-specific | Not inspectable later unless traced; cannot feed later activities unless also stored elsewhere | Some mapping outputs are only needed to call an API. Persisting them as form data would be misleading. | Use for ServiceTask input mapping, with trace logging. |
| Service response mapped output in `todolist.output[formId]` | `{ "serviceResult": { "score": 90 } }` | ServiceTask output values consumed by later form tasks | Reuses previous form lookup pattern; inspectable per activity | Requires choosing a synthetic or configured form/result id | API response values often become later form inputs, so storing them as activity output is consistent. | Primary for ServiceTask output mapping. |
| Business rule facts only | `{ "facts": { "amount": 1000 } }` | BusinessRuleTask input mapping | Keeps rule execution pure; no unnecessary persistence | Facts are lost unless traced; cannot feed later steps directly | Rule input facts are execution inputs, not necessarily state. | Use transiently; persist only rule result or selected mapped outputs. |
| Business rule result in `todolist.output[formId]` or `todolist.output.__mapped` | `{ "__mapped": { "approved": true } }` | BusinessRuleTask output used by gateways/later forms | Activity-scoped and inspectable | Requires consumers to resolve from previous activity output | Rule results are outputs of an activity and should be available later. | Primary for rule results. |
| New execution context table | `process_execution_context(proc_inst_id, scope, values, trace)` | Future normalized context across forms, services, rules, and call activities | Clean model; can store trace, provenance, and scopes explicitly | Requires DB schema, migration, APIs, and UI changes; too large for MVP | This would be the clean long-term design, but it is more than needed to prove mapper runtime. | Defer. Consider after MVP. |

### Recommended MVP Persistence Policy

Use a three-layer policy:

1. Canonical activity/form output:
   - Store mapped form-facing values in `todolist.output[formId]`.
   - This matches current `getVariableWithTaskId()` and `FormWorkItem` behavior.

2. Canonical instance-wide context:
   - Store mapped values that must be reused across the whole instance in `bpm_proc_inst.variables_data`.
   - Standardize `variables_data` as an object map.
   - Do not store every form field here by default.

3. Delivery/cache layer:
   - Use `workitem.parameterValues` only for values being delivered to a workitem UI, especially before the target workitem has a durable form output.
   - Do not treat `parameterValues` as canonical storage.

Use transient payloads for:

- ServiceTask request construction.
- BusinessRuleTask facts before rule execution.

Persist activity results for:

- ServiceTask response values needed later.
- BusinessRuleTask decisions/results needed later.
- CallActivity parent-to-child initial form values.

### Variable-by-Variable Storage Guidance

| Value type | Example | Recommended storage | Why |
| --- | --- | --- | --- |
| Current user-submitted form field | `orderForm.amount` | `todolist.output[orderForm].amount` | It is form-owned data and current UI/backend already load it from workitem output. |
| Mapped next form initial field | `approvalForm.amount` | Target workitem `todolist.output[approvalForm].amount` or returned `parameterValues` before persistence | It must appear in the target form. Persist once the target workitem exists; use `parameterValues` only to deliver prefill values at open time. |
| Cross-step scalar value | `approved = true` | `bpm_proc_inst.variables_data.approved`; optionally also keep producer output in `todolist.output.__mapped.approved` | It must be available by name across the instance. `variables_data` is the canonical instance-wide map; producer output preserves provenance. |
| Service request body field | `request.body.customerId` | Transient request payload | It exists only to call the service. Persisting it as process state would be misleading. |
| Service response field for later use in one later form | `response.score` | Producing service workitem `todolist.output.__mapped.score` or configured result form id | It is an activity output and should be available to later mappings with provenance. |
| Service response field for instance-wide reuse | `customerRiskScore` | `bpm_proc_inst.variables_data.customerRiskScore` | It is no longer only a service output; later activities/gateways should resolve it globally. |
| Business rule input fact | `facts.amount` | Transient rule input; include in trace if needed | Facts are derived inputs, not necessarily durable state. |
| Business rule result for local provenance | `approved`, `riskLevel` | BusinessRule workitem `todolist.output.__mapped` | Rule result is the durable output of that activity. |
| Business rule result for global branching/reuse | `approved`, `riskLevel` | `bpm_proc_inst.variables_data.approved`, `bpm_proc_inst.variables_data.riskLevel` | Gateways and later activities need stable instance-wide lookup. |
| CallActivity child initial form field | `childStartForm.customerId` | Child first workitem `todolist.output[childStartForm].customerId` or child workitem initial `parameterValues` before form save | The child process consumes it as form data, not as a parent process variable. |
| CallActivity parent value reused by several child activities | `customerId` | Child `bpm_proc_inst.variables_data.customerId`; optionally first form output if the form displays it | It is child instance context, not just one form field. |
| Instance metadata | `instanceId`, `rootProcInstId` | Existing `bpm_proc_inst` / `todolist` columns | These are already first-class metadata fields and should not be duplicated as mapped form data. |
| Lane assignment / assignee data | `approver.endpoint` | Existing internal `bpm_proc_inst.role_bindings` and current completion `todolist.assignees` | BPMN exposes this as lane assignment, while the ProcessGPT runtime stores it as role binding. Mapper UI/spec should use the `lane` tree, such as `lane.approver.endpoint`; backend converts that to internal role binding. |

## Instance Variables Data Contract

`bpm_proc_inst.variables_data` should be standardized as an object map.

Canonical shape:

```json
{
  "customerId": "C001",
  "approved": true,
  "riskLevel": "HIGH",
  "customerRiskScore": 82
}
```

Rules:

- Keys are mapper target names after normalization.
- Values may be scalar, object, or array, but MVP transformer outputs should prefer scalar/object JSON-safe values.
- Field names should preserve the mapper target name unless an explicit normalization rule is defined.
- Do not lowercase or replace spaces implicitly at storage time. If a compatibility API needs normalized lookup, normalize at lookup time.
- Form-owned values stay in `todolist.output[formId]` unless the mapper target explicitly marks them as instance/global values.
- Activity-owned non-form results may be written to both:
  - producer provenance: `todolist.output.__mapped[target]`,
  - instance-wide context: `bpm_proc_inst.variables_data[target]`.

### Compatibility With Current Code

Current code has mixed assumptions:

- Some readers expect array entries with `key` or `name`.
- Some writers write an object map.

The mapper runtime should use object map as canonical and provide compatibility readers during transition.

Compatibility read algorithm:

```ts
function readVariablesData(raw) {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw
        .map((item) => [item.key || item.name, item.value])
        .filter(([key]) => !!key)
    );
  }
  if (typeof raw === 'object') return raw;
  return {};
}
```

Compatibility write rule:

- Always write object map.
- Preserve existing keys not touched by the current mapper evaluation.
- Do not overwrite the whole `variables_data` object with only one key.

Example merge:

```json
{
  "before": {
    "customerId": "C001",
    "approved": false
  },
  "mappedValues": {
    "approved": true,
    "riskLevel": "HIGH"
  },
  "after": {
    "customerId": "C001",
    "approved": true,
    "riskLevel": "HIGH"
  }
}
```

### Mapper Target Scope

The mapper needs a way to distinguish form targets from instance-wide targets.

MVP target scope rules:

| Target expression | Meaning | Storage |
| --- | --- | --- |
| `fieldName` | Default target for the current mapper usage | Usage-specific default: form output for form mappings, request payload for service input, etc. |
| `variables.fieldName` | Explicit instance-wide variable | `bpm_proc_inst.variables_data.fieldName` |
| `[variables].fieldName` | Legacy-compatible explicit instance-wide variable | `bpm_proc_inst.variables_data.fieldName` |
| `forms.formId.fieldName` | Explicit form value | `todolist.output[formId].fieldName` |
| `forms.byId.formId.fieldName` | Explicit form value using normalized context root | Same as `forms.formId.fieldName` |
| `__mapped.fieldName` | Activity-scoped non-form output | `todolist.output.__mapped.fieldName` |
| `lane.laneName.endpoint` | Explicit lane assignment endpoint update | Internal `bpm_proc_inst.role_bindings[]` and current completion `workitem.assignees[]` for next activity routing |
| `instance.lane.laneName.endpoint` | Alias for explicit lane assignment endpoint update | Same as `lane.laneName.endpoint` |
| `laneBindings.laneName.endpoint` | Backward-compatible alias | Same storage as `lane.laneName.endpoint`; prefer the `lane` tree in mapper UI/spec |
| `roleBindings.roleName.endpoint` | Backward-compatible internal alias | Same storage as `lane.laneName.endpoint`; prefer the `lane` tree in mapper UI/spec |
| `instance.roleBindings.roleName.endpoint` | Backward-compatible internal alias | Same storage as `instance.lane.laneName.endpoint`; prefer `instance.lane.*` |
| `callActivity.variables.variableName` | CallActivity parent-to-child instance variable mapping | Child `bpm_proc_inst.variables_data.variableName` before the child first workitem is created |
| `callActivity.lane.laneName.endpoint` | CallActivity child lane assignment endpoint update | Child `bpm_proc_inst.role_bindings[]` before the child first workitem is created |

If no explicit scope is provided, each integration point chooses the default target storage.

State-changing targets remain blocked unless they are explicitly listed above. For example, `instance.status`, `current_activity_ids`, `workitem.status`, and lane status targets are not runtime state commands; they must not be treated as direct state mutation by the mapper.

## Execution Insertion Points

### Workitem Open

Evaluate input mapping before rendering the form.

Inputs:

- current instance,
- previous form data,
- workitem,
- activity properties.

Output:

- initial form data for the workitem.

### Workitem Submit

Evaluate output mapping after form submission.

Inputs:

- submitted form data,
- workitem,
- instance,
- activity properties.

Output:

- normalized output form data or execution context update.
- submitted form values remain under `todolist.output[formId]`; mapper source links may read them as either `forms.<formId>.<field>` or `forms.byId.<formId>.<field>`.

### ServiceTask Before Call

Evaluate input mapping before sending request.

Output:

- request body,
- query params,
- headers,
- path variables.

### ServiceTask After Call

Evaluate output mapping after response.

Output:

- mapped values available to later activities.

### BusinessRuleTask Before Rule Execution

Evaluate mapping into rule facts.

Output:

- rule input object.

### BusinessRuleTask After Rule Execution

Evaluate mapping from rule result to later context if an output mapping is defined.

Output:

- mapped rule output values.

### CallActivity Child Creation

Evaluate parent-to-child mapping before child first workitem creation.

Output:

- child initial form data in the child first workitem `output[formId][fieldKey]`.
- child execution context such as `variables_data` or `role_bindings`.
- mapper trace data in reserved output fields such as `__mapped` and `__mappedTrace`.
- parent CallActivity waiting workitem status is `PENDING` while the child is active.
- the already completed parent activity immediately before the CallActivity must remain `DONE`; it must not be rewritten to `PENDING` just because the CallActivity is waiting.

AI prompt input rule:

- If the child first workitem has `ui_definition.id`, and its `output` contains a matching form id, runtime processing unwraps `output[ui_definition.id]`.
- The unwrapped mapped child form values become the AI prompt input under `chain_input_completed["output"]`.
- The same mapped values are available to the next-step prompt context, so the AI decision/fill stage can use data that came from the parent CallActivity mapping.

Example child first workitem output after `mapperIn`:

```json
{
  "vendor_security_task_assess_security_risk_form": {
    "assessmentSummary": "ACME Partners",
    "criticalFinding": "5000000"
  },
  "__mapped": {
    "childForm.vendor_security_task_assess_security_risk_form.assessmentSummary": "ACME Partners"
  },
  "__mappedTrace": [
    {
      "source": "parentForm.vendor_onboarding_task_submit_vendor_need_form.supplierName",
      "target": "childForm.vendor_security_task_assess_security_risk_form.assessmentSummary",
      "status": "mapped"
    }
  ]
}
```

### CallActivity Parent Resume

When all child instances of a CallActivity are complete, apply child-to-parent role mappings before the parent CallActivity workitem is submitted for continuation.

Rules:

- `IN` or `>`: no child-to-parent propagation.
- `OUT` or `<`: copy the child lane binding back to the mapped parent lane.
- `IN-OUT` or `<>`: copy parent-to-child on child creation and child-to-parent on parent resume.
- Persist the propagated value to both parent `bpm_proc_inst.role_bindings` and the parent CallActivity waiting workitem `assignees`.
- The propagated value affects only parent workitems created after the CallActivity resumes.
- Parent follow-up workitems are created only after the waiting CallActivity proceeds. Child-to-parent propagation must not rewrite already completed parent tasks.

## Implementation Plan

### Phase 1 - Discovery and Contract Lock

Scope:

- Inventory all mapper JSON producers.
- Confirm where each mapping is saved.
- Confirm which runtime path consumes each activity type.
- Decide the exact source and target context for each usage.
- Lock `bpm_proc_inst.variables_data` as an object map for instance-wide values.

Verify:

- A table exists for each mapper producer with source context, target context, and runtime insertion point.
- The `variables_data` object-map contract is documented and accepted.

### Phase 2 - Instance Variables Compatibility Layer

Scope:

- Add helper functions to read `variables_data` from either legacy array shape or object-map shape.
- Add helper function to merge mapped values into object-map `variables_data`.
- Update `getProcessVariables()`, `getVariable()`, and `setVariable()` to use the helper behavior.
- Ensure writes preserve existing keys.

Verify:

- Existing array-shaped `variables_data` can still be read.
- New writes always produce object-map shape.
- Writing one variable does not delete other instance variables.

### Phase 3 - Mapping Runtime Module

Scope:

- Implement a standalone mapper runtime module.
- Implement source path resolution.
- Implement target assignment.
- Implement trace and structured errors.
- Implement required MVP transformers.

Verify:

- Unit tests cover direct mapping, transformer mapping, missing source, and unsupported transformer.
- Unit tests cover explicit `variables.fieldName` target writes to object-map `variables_data`.

### Phase 4 - UserTask Integration

Scope:

- Apply input mapping when opening workitem forms.
- Apply output mapping on submit.
- Route form targets to `todolist.output[formId]`.
- Route explicit instance targets to `bpm_proc_inst.variables_data`.

Verify:

- Submitted Task A form data can prefill Task B form data.
- Transformer output appears in Task B.
- A mapper target of `variables.approved` updates `bpm_proc_inst.variables_data.approved`.

### Phase 5 - ServiceTask and ReceiveTask Integration

Scope:

- Apply service input mapping before request.
- Apply service output mapping after response.
- Apply receive mapping for inbound payloads.
- Route response values to either activity output or instance variables based on target scope.

Verify:

- Service request payload is built from form data.
- API response fields can be mapped to later form data.
- API response fields can be mapped to `variables_data` when target scope is `variables.*`.

### Phase 6 - BusinessRuleTask Integration

Scope:

- Apply mapping to rule facts before rule execution.
- Apply mapping from rule result if required.
- Store global rule decisions in `variables_data` when target scope is `variables.*`.

Verify:

- Rule input is built from form data.
- Rule output can drive later form data or branching.
- Rule result can update `variables_data.approved` for later gateway/use.

### Phase 7 - CallActivity Integration

Scope:

- Apply parent-to-child mapping before child instance first workitem creation.
- Support child instance `variables_data` initialization from `callActivity.variables.*` mapper targets.
- Support child first form initialization separately from child instance variables.
- Support explicit `roleBindings` from parent lane names to child lane names.
- Support explicit child lane endpoint assignment from `callActivity.lane.*.endpoint` mapper targets.
- Support child-to-parent role propagation for `OUT` and `IN-OUT` role mappings when the CallActivity completes.

Verify:

- Parent form field maps into child first form initial data.
- Parent value maps into child `variables_data` when target is `callActivity.variables.*`.
- Parent value maps into child role binding when target is `callActivity.lane.*.endpoint`.
- Child role binding maps back into the parent role binding for `OUT` and `IN-OUT` mappings before parent follow-up workitems are created.
- Unsupported or missing fields fail clearly.
- Parent lane `Security Review Coordinator` can bind to child lane `Vendor Security Analyst`.

## Acceptance Criteria

1. A mapper configured in ProcessGPT mode is persisted into runtime definition JSON.
2. Direct mapping changes actual runtime form data or payload, not only saved metadata.
3. Transformer mapping executes through a supported transformer registry.
4. UserTask input mapping can prefill a later task form from an earlier submitted form.
5. ServiceTask input mapping can build an API request payload.
6. ServiceTask output mapping can expose API response values to later steps.
7. BusinessRuleTask mapping can build rule facts from form data.
8. CallActivity mapping can pass parent form data into child initial form data.
9. Unsupported transformers fail with a structured error.
10. Runtime evaluation produces a trace that can identify source, target, transformer, and result status.
11. Instance-wide mapper targets are stored in `bpm_proc_inst.variables_data` using object-map shape.
12. Existing legacy array-shaped `variables_data` can still be read during transition.
13. Explicit lane mapper targets such as `lane.approver.endpoint` update internal `bpm_proc_inst.role_bindings` and are visible to next task assignment.
14. CallActivity mapper UI can persist parent-to-child mappings into `mapperIn` using `callActivity.variables.*` targets.
15. CallActivity child creation applies `callActivity.variables.*` into the child instance `variables_data` before the child first workitem is created.
16. CallActivity mapper UI can persist parent-to-child lane endpoint mappings into `mapperIn` using `callActivity.lane.*.endpoint` targets.
17. CallActivity child creation applies `callActivity.lane.*.endpoint` into the child instance `role_bindings` before the child first workitem is created.
18. CallActivity role mapping supports `>`, `<`, and `<>` direction UI.
19. CallActivity completion applies child-to-parent role propagation for `OUT` and `IN-OUT` role mappings before creating parent follow-up workitems.
20. CallActivity form mapper UI persists executable form paths with `parentForm.<formId>.<fieldKey>` and `childForm.<formId>.<fieldKey>` prefixes.
21. CallActivity child creation applies `mapperIn` `childForm.*` targets into the child first workitem `output[formId][fieldKey]`.
22. Child workitem processing passes mapped child form values into AI prompt input by unwrapping `output[ui_definition.id]`.
23. Mapper UI renders real connected lines for saved prefixed form paths on both sides.

## MVP Definition of Done

This MVP covers backend ProcessGPT completion runtime only. The frontend scope is limited to persisting mapper JSON in the runtime definition.

1. Frontend mapper UI persists mapper JSON into the runtime definition activity properties without executing the mapper.
2. Backend completion runtime loads the current activity mapper from persisted runtime definition data.
3. Backend completion runtime evaluates mapper before deciding or creating the next process step.
4. The same backend mapper path is used for browser-driven completion and polling/background completion.
5. Direct mapper output with a plain target name is persisted to `bpm_proc_inst.variables_data[target]` using object-map shape.
6. Explicit form target output is merged into the backend form payload or target workitem form data, not only browser state.
7. Backend compatibility reader can consume both legacy array-shaped `variables_data` and object-map `variables_data`.
8. Backend variable writer preserves existing instance variables when adding or replacing one variable.
9. Backend trace records mapped/skipped status, source, target, transformer, scope, and errors.
10. Unsupported transformers produce structured runtime errors or trace entries according to backend policy; they must not be silently ignored.
11. Explicit lane binding targets update internal instance role bindings and current completion assignees before next activity routing.
12. Automated backend/integration tests cover object-map compatibility, legacy array compatibility, direct mapping, explicit form target mapping, supported transformer mapping, lane binding mapping, CallActivity child initial form mapping, AI prompt input usage, and polling/background completion.

## Manual E2E Checkpoints

Use a ProcessGPT definition where one activity has persisted mapper JSON in its runtime definition properties.

| Check | Expected Result |
| --- | --- |
| Complete through normal UI | Backend completion writes mapped values to `bpm_proc_inst.variables_data` or target form storage. |
| Complete through polling/background path without browser mapper execution | Same mapped values are produced. |
| Map `name = Jane Kim` to plain target `customerName` | `bpm_proc_inst.variables_data.customerName` is `Jane Kim`. |
| Map to an explicit form target | Backend completion payload or created target workitem contains that form field. |
| Map `approverEmail` to `lane.approver.endpoint` | Internal `bpm_proc_inst.role_bindings` contains `{ name: "approver", endpoint: approverEmail }` and the next approver task is assigned to that endpoint. |
| Map `supplierName` to `callActivity.variables.supplierName` | Child process instance `variables_data.supplierName` is initialized before the called process first workitem is created. |
| Map `parentForm.vendorForm.supplierName` to `childForm.securityForm.assessmentSummary` | Child first workitem output contains `{ "securityForm": { "assessmentSummary": "<supplierName>" } }`. |
| Process the child first workitem after CallActivity mapping | AI prompt input receives the mapped child form data as `chain_input_completed["output"]`. |
| Inspect backend trace/log/debug output | Trace shows source, target, transformer, scope, and `mapped` or `skipped/error` status. |
| Use legacy array-shaped `variables_data` as source | Backend mapper can read the value and write the mapped target. |
| Use unsupported transformer | Backend returns/records a structured unsupported-transformer result instead of silently succeeding. |

## Demo and Regression Sample Processes

The repository includes practical BPMN samples for manual verification and visual regression:

| File | Purpose | Features covered |
| --- | --- | --- |
| `public/case/uengine6-definitions/12-vendor-onboarding-improvement.bpmn` | Parent process for vendor onboarding and contract-risk improvement | Long horizontal process for auto orientation/layout, CallActivity, `mapperIn`, `callActivity.variables.*`, dynamic lane endpoint mapping, and parent-to-child role binding |
| `public/case/uengine6-definitions/13-vendor-security-review.bpmn` | Called process for security assessment | Called process variables and child lanes used by CallActivity mapper and role mapping |

These samples are registered in:

- `src/views/e2e/BpmnAutoLayoutE2E.vue`
- `e2e/bpmn-auto-layout/bpmn-auto-layout.spec.mjs`

Manual verification flow:

1. Open `/bpmn-auto-layout-e2e`.
2. Load `Vendor Onboarding Improvement`.
3. Confirm the process is long enough to verify auto orientation/layout.
4. Open the CallActivity `Run vendor security review`.
5. Confirm the data mapping target tree shows `callActivity > variables` from `Vendor Security Review`.
6. Confirm role mapping maps parent lanes to child lanes.

## Out of Scope for MVP

- Full uEngine process-variable scope parity.
- SQL expression execution.
- Arbitrary Java bean/property execution.
- Cross-tenant mapping.
- UI redesign of the mapper.
- Direct process state commands such as changing `instance.status`, `current_activity_ids`, `workitem.status`, task cancellation/completion, or lane status.
- Complex validation transformer semantics.
- Automatic migration of all legacy mapper fields into one normalized field.

## Risks

- Treating ProcessGPT as if it has uEngine-style process variables will produce incorrect behavior.
- Mapper source paths may be ambiguous when several previous forms contain the same field name.
- Transformer behavior may not exactly match uEngine without a compatibility test suite.
- Sensitive form data may leak if traces log full values.
- Runtime JSON and BPMN XML can diverge if save paths are not consistently synchronized.
- Existing data may contain array-shaped `variables_data`; readers must tolerate both shapes during migration.
- A global variable map can hide provenance if activity trace is not persisted.

## Open Questions

1. Should unqualified source paths prefer current submitted form data or the latest previous activity form data?
2. Should explicit instance-wide mapper targets use `variables.fieldName`, `[variables].fieldName`, or both?
3. Should CallActivity child initial data be stored as child instance context or directly as first child workitem form values?
4. Should unsupported transformer block publish, block runtime execution, or only warn during preview?
5. Do we need one normalized `mappingContexts` field, or should each panel keep its current storage shape?
6. Should existing array-shaped `variables_data` be migrated in DB, or only normalized lazily on next write?
