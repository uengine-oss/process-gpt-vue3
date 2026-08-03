/**
 * 이전 API 호환 레이어. 실제 구현은 `appearance.ts` 에 있다.
 * (색상 테마가 라이트/스카이/다크 3종으로 확장되면서 옮겼다)
 */
export type Mode = 'light' | 'dark';

import { applyAppearance, getAppearance, initAppearance } from './appearance';

export function setMode(mode: Mode | 'system') {
    applyAppearance(mode === 'dark' ? 'dark' : 'light');
}

export function getMode(): Mode {
    return getAppearance() === 'dark' ? 'dark' : 'light';
}

export function toggleMode() {
    setMode(getMode() === 'dark' ? 'light' : 'dark');
}

export function initMode() {
    initAppearance();
}
