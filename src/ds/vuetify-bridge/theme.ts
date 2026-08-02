import type { ThemeTypes } from '@/types/themeTypes/ThemeType';

/**
 * 새 디자인 시스템 토큰을 Vuetify 테마로 옮긴 것.
 *
 * 아직 570개 파일이 `<v-*>` 를 쓰고 있어서, 그 화면들까지 한 번에 새 디자인 언어로
 * 바꾸려면 Vuetify 의 색 팔레트 자체를 토큰 값으로 갈아끼우는 게 가장 확실하다.
 * (값의 출처는 `src/ds/styles/tokens.css` — 두 파일은 같이 움직여야 한다.)
 *
 * 색만으로는 "Material 스러움"이 남으므로 형태·타이포·그림자는
 * `overrides.css` 가 함께 덮는다.
 */

// 라이트 토큰 실측값
const BRAND = '#d97757'; // hsl(14.77 63.1% 59.6%) — Claude 오렌지
const SURFACE_0 = '#f9f9f7';
const SURFACE_1 = '#fcfcfb';
const SURFACE_2 = '#ffffff';
const TEXT_PRIMARY = '#0b0b0b';
const TEXT_SECONDARY = '#52514e';
const TEXT_MUTED = '#898781';
const BORDER = '#e6e6e4';
const NEUTRAL_BG = '#f0efec'; // bg-300

export const CLAUDE_THEME: ThemeTypes = {
    name: 'CLAUDE_THEME',
    dark: false,
    variables: {
        'border-color': BORDER,
        'theme-surface': SURFACE_2,
        'medium-emphasis-opacity': 0.72,
        'high-emphasis-opacity': 1,
        'disabled-opacity': 0.4,
        'border-opacity': 1,
        'hover-opacity': 0.05,
        'focus-opacity': 0.08,
        'selected-opacity': 0.06,
        'activated-opacity': 0.06,
        'pressed-opacity': 0.1
    },
    colors: {
        primary: BRAND,
        secondary: TEXT_SECONDARY,
        info: '#184f95',
        success: '#006300',
        warning: '#734500',
        error: '#8e2626',
        indigo: '#5b53a6',

        lightprimary: '#fbeee9',
        lightinfo: '#cde2fb',
        lightsecondary: NEUTRAL_BG,
        lightsuccess: '#caeac7',
        lighterror: '#fad6d6',
        lightwarning: '#f9dca4',
        lightindigo: '#e8e6f5',

        textPrimary: TEXT_PRIMARY,
        textSecondary: TEXT_SECONDARY,
        borderColor: BORDER,
        inputBorder: '#d8d7d3',
        containerBg: SURFACE_2,
        background: SURFACE_0,
        hoverColor: '#f4f3f0',
        surface: SURFACE_2,
        grey100: TEXT_MUTED,
        grey200: TEXT_SECONDARY,
        darkbg: '#262624',
        bglight: SURFACE_1,
        bgdark: '#1f1e1d'
    }
};

// 다크 토큰 실측값
const D_SURFACE_0 = '#262624';
const D_SURFACE_1 = '#30302e';
const D_SURFACE_2 = '#1f1e1d';
const D_TEXT_PRIMARY = '#faf9f5';
const D_TEXT_SECONDARY = '#c2c0b6';
const D_TEXT_MUTED = '#9a9890';
const D_BORDER = '#3a3936';

export const CLAUDE_DARK_THEME: ThemeTypes = {
    name: 'CLAUDE_DARK_THEME',
    dark: true,
    variables: {
        'border-color': D_BORDER,
        'theme-surface': D_SURFACE_2,
        'medium-emphasis-opacity': 0.76,
        'high-emphasis-opacity': 1,
        'disabled-opacity': 0.4,
        'border-opacity': 1,
        'hover-opacity': 0.06,
        'focus-opacity': 0.1,
        'selected-opacity': 0.08,
        'activated-opacity': 0.08,
        'pressed-opacity': 0.12
    },
    colors: {
        primary: BRAND,
        secondary: D_TEXT_SECONDARY,
        info: '#8fbdf0',
        success: '#7ec97a',
        warning: '#e0b054',
        error: '#fd8080',
        indigo: '#9b93e0',

        lightprimary: '#3a2a24',
        lightinfo: '#1d3a5c',
        lightsecondary: '#33322f',
        lightsuccess: '#233a22',
        lighterror: '#4a2020',
        lightwarning: '#4a3a1c',
        lightindigo: '#2e2b45',

        textPrimary: D_TEXT_PRIMARY,
        textSecondary: D_TEXT_SECONDARY,
        borderColor: D_BORDER,
        inputBorder: '#454340',
        containerBg: D_SURFACE_2,
        background: D_SURFACE_0,
        hoverColor: '#2e2e2b',
        surface: D_SURFACE_2,
        grey100: D_TEXT_MUTED,
        grey200: D_TEXT_SECONDARY,
        darkbg: D_SURFACE_0,
        bglight: D_SURFACE_1,
        bgdark: D_SURFACE_2
    }
};
