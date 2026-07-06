export const BPMN_AUTO_ORIENTATION_MODE_STORAGE_KEY = 'bpmn-auto-orientation-mode';

export const BPMN_AUTO_ORIENTATION_MODES = Object.freeze({
  ROTATE_ONLY: 'rotate-only',
  ROTATE_AUTO_LAYOUT: 'rotate-auto-layout',
  NONE: 'none'
});

const VALID_MODES = new Set(Object.values(BPMN_AUTO_ORIENTATION_MODES));

export function getBpmnAutoOrientationMode() {
  try {
    const mode = window.localStorage.getItem(BPMN_AUTO_ORIENTATION_MODE_STORAGE_KEY);
    return VALID_MODES.has(mode)
      ? mode
      : BPMN_AUTO_ORIENTATION_MODES.ROTATE_ONLY;
  } catch (e) {
    return BPMN_AUTO_ORIENTATION_MODES.ROTATE_ONLY;
  }
}

export function getAutoOrientationRotateOptions(mode = getBpmnAutoOrientationMode()) {
  return mode === BPMN_AUTO_ORIENTATION_MODES.ROTATE_ONLY
    ? { skipAutoLayout: true }
    : {};
}
