/**
 * 색상 테마 = 모드(라이트/다크) + 강조색.
 *
 * 앱에는 색을 읽는 층이 셋이라, 어느 하나만 바꾸면 화면이 어긋난다.
 *   1) 토큰 레이어  — `--cds-*` / `--accent-brand` (Pg* 컴포넌트, tokenize 된 .vue 스타일)
 *   2) Vuetify 테마 — `<v-*>` 570개 파일
 *   3) BPMN 캔버스  — SVG '속성'이라 토큰을 미리 hex 로 해석해 둔 값
 * 이 모듈이 셋을 한 번에 맞춘다.
 */
import { resetDsPaletteCache } from '@/components/customBpmn/dsPalette';

export type AppearanceMode = 'light' | 'dark';

const MODE_KEY = 'pg-color-mode';
const ACCENT_KEY = 'pg-accent-color';

/** Vuetify 테마 이름 — 기존 이름을 그대로 쓴다 (UpdateColors.ts 가 이름으로 분기) */
export const THEME_BY_MODE: Record<AppearanceMode, string> = {
    light: 'BLUE_THEME',
    dark: 'DARK_BLUE_THEME'
};

export function modeFromTheme(themeName: string): AppearanceMode {
    return themeName?.startsWith('DARK') ? 'dark' : 'light';
}

/** `#rrggbb` → `H S% L%` (토큰이 채널 문자열을 쓰기 때문에 필요) */
export function hexToHslChannels(hex: string): string | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return null;

    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;

    let h = 0;
    let s = 0;
    if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
    }

    return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

/**
 * 라이트/다크 적용.
 *
 * 토큰 레이어와 Vuetify 테마를 **여기서 함께** 바꾼다. 둘 중 하나만 바꾸면
 * 사이드바·상단바 같은 `<v-*>` 영역만 밝은 채로 남아 화면이 갈라진다.
 */
export function applyMode(mode: AppearanceMode, persist = true) {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'claude');
    // OS 가 다크여도 라이트를 고를 수 있어야 하므로 값을 비워두지 않는다
    // (tokens.css 의 prefers-color-scheme 블록이 :root:not([data-mode=light]) 조건).
    root.setAttribute('data-mode', mode);
    if (persist) localStorage.setItem(MODE_KEY, mode);

    syncVuetifyTheme(mode);
    notifyAppearanceChanged();
}

/** Vuetify 테마 이름을 모드에 맞춘다. Pinia 초기화 전에는 조용히 건너뛴다. */
function syncVuetifyTheme(mode: AppearanceMode) {
    // 순환 import 를 피하려고 지연 로드한다
    import('@/stores/customizer')
        .then(({ useCustomizerStore }) => {
            useCustomizerStore().actTheme = THEME_BY_MODE[mode];
        })
        .catch(() => {
            /* 부팅 초기 등 Pinia 가 아직 없으면 Customizer 가 직접 세팅한다 */
        });
}

/** 자율선택 강조색 적용. 비우면 토큰 기본값(Claude 오렌지)으로 되돌린다. */
export function applyAccent(hex: string | null, persist = true) {
    const root = document.documentElement;

    if (!hex) {
        root.style.removeProperty('--accent-brand');
        if (persist) localStorage.removeItem(ACCENT_KEY);
        notifyAppearanceChanged();
        return;
    }

    const channels = hexToHslChannels(hex);
    if (!channels) return;

    root.style.setProperty('--accent-brand', channels);
    if (persist) localStorage.setItem(ACCENT_KEY, hex);
    notifyAppearanceChanged();
}

export function getMode(): AppearanceMode {
    const attr = document.documentElement.getAttribute('data-mode');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getAccent(): string | null {
    return localStorage.getItem(ACCENT_KEY);
}

/**
 * 토큰 값을 미리 읽어 캐시해 둔 곳(BPMN 캔버스)에 변경을 알린다.
 * BpmnUengine 이 이 이벤트를 받아 캔버스를 다시 그린다.
 */
function notifyAppearanceChanged() {
    resetDsPaletteCache();
    window.dispatchEvent(new CustomEvent('pg:appearance-changed'));
}

/** 앱 부팅 시 1회. 저장된 선택을 복원한다. */
export function initAppearance() {
    const savedMode = localStorage.getItem(MODE_KEY);
    applyMode(savedMode === 'dark' ? 'dark' : 'light', false);

    const savedAccent = localStorage.getItem(ACCENT_KEY);
    if (savedAccent) applyAccent(savedAccent, false);
}
