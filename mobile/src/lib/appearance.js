/**
 * 색상 테마.
 *
 * 포털의 "테마 설정 → 색상 테마" 와 **같은 세 가지, 같은 이름, 같은 순서** 다.
 * 브라우저에는 밝음/어두움 스위치가 아니라 색을 고르는 카드 세 장이 있고
 * (라이트 · 스카이 · 다크), 자유롭게 색을 뽑는 색상 선택기는 없다.
 * 값도 포털의 토큰에서 그대로 가져왔다 — 앱만 다른 색이면 같은 제품으로 보이지
 * 않는다.
 *
 * 포털은 이 선택을 브라우저 localStorage 에만 둔다. 앱은 그 저장소를 볼 수 없고
 * 서버 어디에도 저장되지 않으므로, **웹에서 고른 값을 그대로 가져올 방법이 없다.**
 * 대신 같은 선택지를 앱에서도 주고, 고른 값은 이 기기에 남긴다.
 * (진짜로 맞추려면 이 설정이 서버에 있어야 한다.)
 */

/** 포털 Customizer 와 같은 순서. */
export const APPEARANCES = ['light', 'sky', 'dark'];

/** 포털의 기본값과 같다. */
export const DEFAULT_APPEARANCE = 'sky';

/**
 * 포털 Customizer 의 카드와 같은 이름·같은 색이다.
 * swatch 는 그 테마의 배경, dot 은 강조색.
 */
export const APPEARANCE_LABELS = {
    light: { label: '라이트', swatch: '#f9f9f7', dot: '#d97757' },
    sky: { label: '스카이', swatch: '#f0f5f9', dot: '#0085db' },
    dark: { label: '다크', swatch: '#262624', dot: '#d97757' }
};

const KEY = 'pg-appearance';

/** 아는 값인가. 모르는 값을 그대로 쓰면 색이 하나도 안 잡힌 화면이 된다. */
export function normalize(value) {
    const v = (value || '').toString().trim();
    return APPEARANCES.includes(v) ? v : DEFAULT_APPEARANCE;
}

/**
 * 저장된 선택을 읽는다.
 *
 * 포털이 쓰는 것과 같은 키다. 앱과 포털이 같은 브라우저에서 열리는 경우
 * (예: 웹으로 접속) 서로의 선택을 그대로 잇는다.
 */
export function saved(store = globalThis.localStorage) {
    try {
        return normalize(store?.getItem(KEY));
    } catch (_e) {
        return DEFAULT_APPEARANCE;
    }
}

/** 화면에 적용한다. CSS 가 이 속성으로 색을 고른다. */
export function apply(appearance, doc = globalThis.document, store = globalThis.localStorage) {
    const value = normalize(appearance);
    doc?.documentElement?.setAttribute('data-appearance', value);
    try {
        store?.setItem(KEY, value);
    } catch (_e) {
        // 저장을 못 해도 이번 실행에는 적용된다. 막을 이유가 없다.
    }
    return value;
}

/** 앱을 켤 때 한 번. 고른 적이 없으면 기기 설정을 따른다. */
export function restore(win = globalThis) {
    const store = win?.localStorage;
    let value;
    try {
        value = store?.getItem(KEY);
    } catch (_e) {
        value = null;
    }
    if (!value) {
        // 고른 적이 없다. 기기가 어두우면 어둡게 시작한다 — 밝은 화면이
        // 갑자기 켜지는 것을 피한다.
        const prefersDark = win?.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
        return apply(prefersDark ? 'dark' : DEFAULT_APPEARANCE, win.document, store);
    }
    return apply(value, win.document, store);
}
