/**
 * 이전 API 호환 레이어. 실제 구현은 `appearance.ts` 에 있다.
 * (색상 테마가 모드 + 강조색 조합으로 확장되면서 옮겼다)
 */
export type Mode = 'light' | 'dark';

import { applyMode, getMode as getAppearanceMode, initAppearance } from './appearance';

export function setMode(mode: Mode | 'system') {
    applyMode(mode === 'dark' ? 'dark' : 'light');
}

export function getMode(): Mode {
    return getAppearanceMode();
}

export function toggleMode() {
    setMode(getMode() === 'dark' ? 'light' : 'dark');
}

export function initMode() {
    initAppearance();
}
