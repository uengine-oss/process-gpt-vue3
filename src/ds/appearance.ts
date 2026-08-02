/**
 * 색상 테마 — 라이트 · 스카이 · 다크 세 가지.
 *
 * 앱에는 색을 읽는 층이 셋이라, 어느 하나만 바꾸면 화면이 어긋난다.
 *   1) 토큰 레이어  — `--cds-*` / `--accent-brand` (Pg* 컴포넌트, tokenize 된 .vue 스타일)
 *   2) Vuetify 테마 — `<v-*>` 570개 파일
 *   3) BPMN 캔버스  — SVG '속성'이라 토큰을 미리 hex 로 해석해 둔 값
 * 이 모듈이 셋을 한 번에 맞춘다.
 */
import { resetDsPaletteCache } from '@/components/customBpmn/dsPalette';

export type Appearance = 'light' | 'sky' | 'dark';

const STORAGE_KEY = 'pg-appearance';

/**
 * Vuetify 테마 '이름' 은 기존 것을 그대로 쓴다.
 * `src/utils/UpdateColors.ts` 가 actTheme 문자열을 99곳에서 이름으로 분기하고 있어
 * 새 이름을 만들면 그 분기들이 전부 폴백으로 떨어진다.
 */
export const THEME_BY_APPEARANCE: Record<Appearance, string> = {
    light: 'BLUE_THEME',
    sky: 'AQUA_THEME',
    dark: 'DARK_BLUE_THEME'
};

const APPEARANCE_BY_THEME: Record<string, Appearance> = {
    BLUE_THEME: 'light',
    AQUA_THEME: 'sky',
    DARK_BLUE_THEME: 'dark'
};

export function appearanceFromTheme(themeName: string): Appearance {
    return APPEARANCE_BY_THEME[themeName] || (themeName?.startsWith('DARK') ? 'dark' : 'light');
}

/**
 * 적용.
 *
 * 토큰 레이어와 Vuetify 테마를 **여기서 함께** 바꾼다. 둘 중 하나만 바꾸면
 * 사이드바·상단바 같은 `<v-*>` 영역만 남아 화면이 갈라진다.
 */
export function applyAppearance(appearance: Appearance, persist = true) {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'claude');
    root.setAttribute('data-appearance', appearance);

    // OS 가 다크여도 라이트를 고를 수 있어야 하므로 값을 비워두지 않는다
    // (tokens.css 의 prefers-color-scheme 블록이 :root:not([data-mode=light]) 조건).
    root.setAttribute('data-mode', appearance === 'dark' ? 'dark' : 'light');

    if (persist) localStorage.setItem(STORAGE_KEY, appearance);

    syncVuetifyTheme(appearance);
    notifyAppearanceChanged();
}

/** Vuetify 테마 이름을 맞춘다. Pinia 초기화 전에는 조용히 건너뛴다. */
function syncVuetifyTheme(appearance: Appearance) {
    // 순환 import 를 피하려고 지연 로드한다
    import('@/stores/customizer')
        .then(({ useCustomizerStore }) => {
            useCustomizerStore().actTheme = THEME_BY_APPEARANCE[appearance];
        })
        .catch(() => {
            /* 부팅 초기 등 Pinia 가 아직 없으면 Customizer 가 직접 세팅한다 */
        });
}

export function getAppearance(): Appearance {
    const attr = document.documentElement.getAttribute('data-appearance');
    if (attr === 'light' || attr === 'sky' || attr === 'dark') return attr;
    return 'light';
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
    const saved = localStorage.getItem(STORAGE_KEY) as Appearance | null;
    applyAppearance(saved === 'sky' || saved === 'dark' ? saved : 'light', false);
}
