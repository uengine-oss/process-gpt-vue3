# BPMN View Auto Rotation Fit

## Goal

In view-only BPMN screens, automatic orientation changes should preserve the
drawn process layout while fitting it into the visible canvas.

The long-term requirement is that rotation must not break the shape intentionally
drawn by the user. Rotation should transform orientation and viewport fit only;
it should not reinterpret or redesign the process structure.

## Scope

- Applies to view, process execution, and process instance BPMN display modes.
- Does not apply to the BPMN editing canvas.
- Temporarily runs auto layout after rotation to avoid broken rotated lane and
  flow geometry.
- Uses zoom/viewbox changes after the rotation and relayout step.

## Behavior

- When the viewport is wider than tall, the view may rotate the process to
  horizontal orientation.
- When the viewport is taller than wide, the view may rotate the process to
  vertical orientation.
- After automatic rotation, the visible canvas fits the full participant bounds
  with a small padding.
- If the process layout is larger than the visible canvas, the canvas zooms out
  so the layout is contained.
- If the process layout is smaller than the visible canvas, the canvas may zoom
  in up to a capped zoom level so the process fills the screen better.
- In process execution or instance views with running/current tasks, the view
  first fits the full process, then applies the existing task focus behavior so
  the active task remains easy to see. The focus step may zoom in after the
  full-process fit so task labels are readable.

## Acceptance Criteria

- Auto rotation calls auto layout after rotation until the rotated geometry is
  stable enough to preserve without relayout.
- Auto rotation updates participant and lane `isHorizontal` flags.
- The participant bounds are inside the post-rotation viewbox.
- At least one axis of the participant bounds fills most of the viewbox after
  fitting.
- Existing current-task focus behavior is preserved for process instance views.
- Current-task focus shows focused task labels at a readable scale instead of
  only scrolling the full-process fit.

## Follow-up Requirement

- The current post-rotation auto layout is a temporary mitigation for broken
  rotated geometry.
- A later fix must make rotation preserve the user's drawn structure without
  relying on auto layout.
- When that fix is complete, auto rotation in view modes should rotate, sync
  orientation flags, and fit the viewport without moving tasks/gateways/flows
  into a newly computed layout.
