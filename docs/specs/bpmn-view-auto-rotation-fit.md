# BPMN View Auto Rotation Fit

## Goal

In view-only BPMN screens, automatic orientation changes should preserve the
drawn process layout while fitting it into the visible canvas.

## Scope

- Applies to view, process execution, and process instance BPMN display modes.
- Does not apply to the BPMN editing canvas.
- Does not run auto layout as part of viewport fitting.
- Uses zoom/viewbox changes only after rotation.

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

- Auto rotation does not call auto layout.
- Auto rotation updates participant and lane `isHorizontal` flags.
- The participant bounds are inside the post-rotation viewbox.
- At least one axis of the participant bounds fills most of the viewbox after
  fitting.
- Existing current-task focus behavior is preserved for process instance views.
- Current-task focus shows focused task labels at a readable scale instead of
  only scrolling the full-process fit.
