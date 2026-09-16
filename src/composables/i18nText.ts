/**
 * 컴포넌트 밖에서 쓰는 번역 창구.
 *
 * 이 앱의 vue-i18n 은 legacy 모드라 `useI18n()` 을 쓸 수 없고, composable·순수 TS 에서는
 * 애초에 컴포넌트 인스턴스가 없다. main.ts 가 `window.$i18n` 으로 열어 둔 인스턴스를 쓴다.
 */
export function t(key: string, params?: Record<string, unknown>): string {
    const i18n = (window as any).$i18n;
    if (!i18n?.global) return key;
    // 언어를 바꾸면 이 값을 읽은 계산식도 다시 돌도록 locale 을 한 번 건드린다.
    void (i18n.global.locale as any)?.value;
    return params ? i18n.global.t(key, params) : i18n.global.t(key);
}

/** 날짜·숫자 서식에 쓸 현재 로케일. */
export function currentLocale(): string {
    const i18n = (window as any).$i18n;
    const locale = i18n?.global?.locale;
    const value = typeof locale === 'string' ? locale : locale?.value;
    return value === 'en' ? 'en-US' : 'ko-KR';
}
