export type Mode = 'light' | 'dark';

const STORAGE_KEY = 'pg-color-mode';

/**
 * 라이트/다크 전환.
 *
 * 토큰이 전부 CSS custom property 라서 루트의 `data-mode` 속성 하나만 바꾸면 된다.
 * 값을 지우면 `prefers-color-scheme` 를 따라간다.
 */
export function setMode(mode: Mode | 'system') {
    const root = document.documentElement;

    if (mode === 'system') {
        root.removeAttribute('data-mode');
        localStorage.removeItem(STORAGE_KEY);
        return;
    }

    root.setAttribute('data-mode', mode);
    localStorage.setItem(STORAGE_KEY, mode);
}

export function getMode(): Mode {
    const attr = document.documentElement.getAttribute('data-mode');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleMode() {
    setMode(getMode() === 'dark' ? 'light' : 'dark');
}

/** 앱 부팅 시 1회 호출. 저장된 선택이 없으면 OS 설정을 따른다. */
export function initMode() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-mode', saved);
    }
    document.documentElement.setAttribute('data-theme', 'claude');
}
