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
    notifyModeChanged();
}

/**
 * CSS 변수를 읽어 실제 색으로 캐시해 둔 곳들(BPMN 캔버스 등)에 테마 변경을 알린다.
 * SVG 속성값은 `var()` 를 해석하지 못해 토큰을 미리 해석해 두기 때문에 필요하다.
 */
function notifyModeChanged() {
    import('@/components/customBpmn/dsPalette')
        .then((m) => m.resetDsPaletteCache())
        .catch(() => {
            /* BPMN 모듈이 로드되지 않은 화면에서는 무시 */
        });
    window.dispatchEvent(new CustomEvent('pg:color-mode-changed'));
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
