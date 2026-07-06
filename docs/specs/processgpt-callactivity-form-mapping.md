# ProcessGPT CallActivity Form Mapping Spec

## Goal

ProcessGPT mode CallActivity must let users choose parent reference forms and child reference forms, then map only the selected fields between `parentForm` and `childForm`.

## Scope

- Add a Data Mapping UI to the ProcessGPT CallActivity panel.
- Reuse the reference-info style: select forms, show fields, and open Mapper for field connections.
- Persist mapping data inside the CallActivity `uengine:Properties` JSON and `proc_def.definition.activities[].properties`.
- Cover the feature with an e2e UI test and screenshots.

## Data Contract

CallActivity properties store:

```json
{
  "definitionId": "child-process-id",
  "inheritParentReferenceInfo": true,
  "roleBindings": [],
  "variableBindings": [],
  "parentFormFields": ["parentFormId.fieldKey"],
  "childFormFields": ["childFormId.fieldKey"],
  "mapperIn": {
    "mappingElements": []
  },
  "mapperOut": {
    "mappingElements": []
  }
}
```

Selection fields and mapper paths intentionally use different shapes:

- `parentFormFields` and `childFormFields` store selected form fields as `formId.fieldKey`.
- `mapperIn.mappingElements[].variable.name` and `mapperIn.mappingElements[].argument.text` store fully scoped paths such as `parentForm.formId.fieldKey` and `childForm.formId.fieldKey`.
- `mapperOut` uses the same fully scoped path rule.
- The UI may hide internal form ids from visible labels, but persisted mapper paths must keep form ids so runtime execution can resolve the exact form.

Example parent-to-child form mapping:

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
        "variable": {
          "name": "parentForm.vendor_onboarding_task_submit_vendor_need_form.supplierName"
        },
        "direction": "out"
      }
    ]
  }
}
```

## UI Behavior

1. Load parent reference forms from all parent process form tasks, not only tasks before the CallActivity.
2. When `definitionId` is set, load child reference forms from the child process definition.
3. Find form activities whose `tool` starts with `formHandler:`.
4. Resolve each form from:
   - `proc_def.definition.formDrafts`
   - `form_def` by `formId`
   - local form HTML fallback when available
5. Show parent forms and child forms in separate multi-select controls.
6. Show fields for selected forms as checkboxes, matching the user task reference-info tab pattern.
7. Open Mapper in two directions:
   - Parent to child: selected fields are mapped from `parentForm` to `childForm`.
   - Child to parent: selected fields are mapped from `childForm` to `parentForm`.
8. Save all values immediately through `update:uengineProperties`; the existing CallActivity save path persists them.

Mapper dialog requirements:

- The left and right mapper trees show the same top-level roots so users can compare equivalent context on both sides.
- Root order is `Variables`, `lane`, `instance`, `activities`, then selected form roots.
- `parentForm` and `childForm` appear at the bottom of the mapper tree.
- Parent reference form candidates include every form task in the parent process except the CallActivity activity itself. This is required because child-to-parent mapping may target a parent form that appears after the CallActivity.
- Selected `parentForm` and `childForm` nodes are expanded by default.
- Visible form names should show the human-readable form title only. Internal ids inside parentheses must not be shown in the mapper labels.
- The mapper line renderer must connect the real saved path, not a fallback row. For form paths this means `parentForm.formId.fieldKey` and `childForm.formId.fieldKey` must resolve to concrete ports on both sides.

## Runtime Behavior

The ProcessGPT frontend is the authoring surface, but the authoritative execution happens in the completion project's polling-service runtime.

For CallActivity parent-to-child execution:

1. The parent process completes the activity before the CallActivity.
2. CallActivity child creation loads persisted `mapperIn` from `proc_def.definition.activities[].properties`.
3. `parentForm.formId.fieldKey` sources are resolved from the parent execution form context.
4. `childForm.formId.fieldKey` targets are written to the child first workitem output under `output[formId][fieldKey]`.
5. The child first workitem output also keeps `__mapped` and `__mappedTrace` for debug/audit.
6. When the child workitem is processed, completion unwraps `output[ui_definition.id]`.
7. The unwrapped mapped child form values are passed into the AI decision/fill prompt input as `chain_input_completed["output"]` and then into next-step prompt context.

Current runtime scope:

- Implemented: `mapperIn` parent-to-child form prefill into the child first workitem.
- Implemented: `mapperIn` parent-to-child `callActivity.variables.*` and `callActivity.lane.*.endpoint`.
- Implemented: child-to-parent role propagation for CallActivity completion.
- UI persisted, runtime follow-up: `mapperOut` child-to-parent form writeback is stored but is not yet the accepted runtime path for parent form mutation.

## Acceptance Criteria

- Given a CallActivity, the Data Mapping tab shows parent reference form selection and child reference form selection.
- Selecting a parent form shows only the selected parent form fields.
- Selecting a child form shows only the selected child form fields.
- Opening Parent to Child mapping shows the same root set on both sides, with `parentForm` and `childForm` at the bottom.
- Opening Child to Parent mapping shows the same root set on both sides, with `parentForm` and `childForm` at the bottom.
- Saved form mappings use fully scoped mapper paths such as `parentForm.formId.fieldKey` and `childForm.formId.fieldKey`.
- Mapper screenshots show actual connected lines between selected form fields, not a fallback straight line.
- Saving the CallActivity preserves `parentFormFields`, `childFormFields`, `mapperIn`, and `mapperOut`.
- Runtime CallActivity child creation applies `mapperIn` form values to the child first workitem output.
- The child AI processing path receives the mapped child form values through workitem output.
- E2E screenshots demonstrate the tab, selected form fields, and both mapping dialogs.

## Out of Scope

- Complex transform functions beyond the existing Mapper capability.
- Automatic semantic matching between parent fields and child fields.
- Mutating already completed parent form workitems from `mapperOut`.
- Long-running live daemon smoke test is separate from deterministic polling-service runtime tests.

## Verification

Frontend E2E:

- `playwright/e2e/gateway/call-activity-form-mapping-ui.spec.ts`
- `playwright/e2e/gateway/call-activity-form-mapping-save.spec.ts`

Completion runtime tests:

- `polling_service/tests/test_mapper_runtime.py`
- `polling_service/tests/test_workitem_processor_unit.py`

Verified behavior:

- UI can select parent and child reference forms.
- Mapper opens with matching left/right roots and form roots at the bottom.
- Saved mapper JSON contains prefixed `parentForm` and `childForm` paths.
- Runtime maps parent form values into child first workitem output.
- Child AI prompt input receives mapped child form values from that workitem output.
