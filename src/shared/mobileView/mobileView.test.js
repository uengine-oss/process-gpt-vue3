/**
 * 휴대폰 화면 고르기 · 홈 화면에 추가.
 *
 * 지키려는 것: 휴대폰은 기본으로 데스크톱 폭(PC와 같은 화면)으로 그리고, 라이트(light)를 고른 휴대폰만
 * 휴대폰 웹(/m/)으로 가는 것. 로그인 · 랜딩 · 외부 폼과 컴퓨터는 폭을 바꾸지 않는다. 폭이 바뀌어야 할 때만 새로 연다.
 * 홈 화면에 추가하지 않은 휴대폰에는 맨 위 띠를 보이고, 「다시 보지 않기」 뒤로는 그 기기에서 보이지 않는 것.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    savedMobileView,
    needsViewportReload,
    saveMobileView,
    phoneZoom,
    shouldShowInstallBar,
    hideInstallBar,
    INSTALL_BAR_KEY,
    isStandalone,
    installGuide
} from './index.js';

/** index.html 의 window.__pgptViewport 와 같은 규칙 */
function fakeWin({ phone = true, saved = {}, path = '/definition-map', scale = 0.3, enabled = true, standalone = false } = {}) {
    const store = { ...saved };
    const win = {
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => {
                store[k] = String(v);
            }
        },
        location: { pathname: path },
        visualViewport: { scale },
        matchMedia: () => ({ matches: standalone }),
        navigator: {},
        __store: store
    };
    const isDeviceWidthPath = (p) => p === '/' || p.startsWith('/auth/') || p.startsWith('/external-forms/');
    const api = {
        KEY: 'mobileView',
        isEnabled: () => enabled,
        isPhoneBrowser: () => phone,
        isDeviceWidthPath,
        view: () => win.localStorage.getItem('mobileView'),
        wantsDesktop: (p) => enabled && phone && api.view() !== 'light' && !isDeviceWidthPath(p),
        desktop: false
    };
    api.desktop = api.wantsDesktop(path);
    win.__pgptViewport = api;
    return win;
}

test('PAL · uEngine 모드(규칙 꺼짐)에서는 폭을 바꾸지 않는다', () => {
    const win = fakeWin({ enabled: false, saved: { mobileView: 'desktop' } });
    assert.equal(needsViewportReload('/auth/login', win), false);
    assert.equal(needsViewportReload('/definition-map', win), false);
});

test('규칙(__pgptViewport)이 없으면 아무것도 하지 않는다', () => {
    assert.equal(needsViewportReload('/definition-map', {}), false);
    assert.equal(savedMobileView({}), null);
});

test('휴대폰은 기본(고르지 않음)이든 데스크톱을 골랐든 폭이 바뀌는 이동에만 새로 연다', () => {
    for (const saved of [{}, { mobileView: 'desktop' }]) {
        const atLogin = fakeWin({ path: '/auth/login', saved });
        assert.equal(needsViewportReload('/auth/login', atLogin), false);
        assert.equal(needsViewportReload('/definition-map', atLogin), true, '로그인(기기 폭) → 앱(데스크톱 폭)');

        const inApp = fakeWin({ path: '/definition-map', saved });
        assert.equal(needsViewportReload('/instancelist', inApp), false);
        assert.equal(needsViewportReload('/auth/login', inApp), true, '앱 → 로그인');
    }
    const light = { mobileView: 'light' };
    assert.equal(needsViewportReload('/definition-map', fakeWin({ path: '/auth/login', saved: light })), false, '라이트는 포털에서 늘 기기 폭');
    assert.equal(needsViewportReload('/definition-map', fakeWin({ phone: false, path: '/auth/login' })), false, '컴퓨터');
});

test('라이트를 고르면 저장하고 새로 연다(휴대폰 웹으로)', () => {
    const win = fakeWin();
    assert.deepEqual(saveMobileView('light', win), { reload: true });
    assert.equal(win.__store.mobileView, 'light');
    assert.equal(savedMobileView(win), 'light');
});

test('라이트에서 데스크톱으로 바꾸면 새로 열어 데스크톱 폭으로 바꾼다', () => {
    const win = fakeWin({ saved: { mobileView: 'light' } });
    assert.deepEqual(saveMobileView('desktop', win), { reload: true });
    assert.equal(win.__store.mobileView, 'desktop');
});

test('기본(고르지 않음)에서 데스크톱을 고르면 폭은 그대로다', () => {
    assert.deepEqual(saveMobileView('desktop', fakeWin()), { reload: false });
    assert.equal(savedMobileView(fakeWin()), null);
});

test('모르는 값은 저장하지 않는다', () => {
    assert.throws(() => saveMobileView('tablet', fakeWin()));
    assert.equal(savedMobileView(fakeWin({ saved: { mobileView: 'tablet' } })), null);
});

test('데스크톱 폭에서만 대화상자를 휴대폰 글자 크기로 키운다', () => {
    const desk = { mobileView: 'desktop' };
    assert.equal(Math.round(phoneZoom(fakeWin({ scale: 0.3, saved: desk })) * 100) / 100, 3.33);
    assert.equal(phoneZoom(fakeWin({ scale: 0.1, saved: desk })), 4, '너무 커지지 않게');
    assert.equal(phoneZoom(fakeWin({ scale: 2, saved: desk })), 1, '확대하면 키우지 않는다');
    assert.equal(phoneZoom(fakeWin({ scale: 0.3, saved: { mobileView: 'light' } })), 1, '기기 폭');
});

test('홈 화면에서 연 앱인지 안다', () => {
    assert.equal(isStandalone({ matchMedia: () => ({ matches: true }) }), true);
    assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }), true);
    assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} }), false);
});

test('홈 화면에 추가하는 방법을 기기별로 고른다', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36';
    assert.equal(installGuide({ userAgent: android, canPrompt: true }), 'prompt');
    assert.equal(installGuide({ userAgent: iphone }), 'ios');
    assert.equal(installGuide({ userAgent: ipad, maxTouchPoints: 5 }), 'ios', 'iPadOS 는 맥으로 보인다');
    assert.equal(installGuide({ userAgent: ipad, maxTouchPoints: 0 }), 'desktop', '진짜 맥');
    assert.equal(installGuide({ userAgent: android }), 'android');
});

test('홈 화면에 추가 띠: 휴대폰 브라우저 · 홈 화면 앱 아님 · 다시 보지 않기 전에만', () => {
    assert.equal(shouldShowInstallBar(fakeWin()), true);
    assert.equal(shouldShowInstallBar(fakeWin({ saved: { mobileView: 'light' } })), true, '라이트 · 데스크톱 상관없이');
    assert.equal(shouldShowInstallBar(fakeWin({ phone: false })), false, '컴퓨터');
    assert.equal(shouldShowInstallBar(fakeWin({ enabled: false })), false, 'PAL · uEngine');
    assert.equal(shouldShowInstallBar(fakeWin({ standalone: true })), false, '이미 홈 화면에서 연 앱');
    assert.equal(shouldShowInstallBar({}), false, '규칙이 없으면(휴대폰인지 모르면) 보이지 않는다');
});

test('「다시 보지 않기」를 누르면 그 기기에서는 다시 보이지 않는다', () => {
    const win = fakeWin();
    hideInstallBar(win);
    assert.equal(win.__store[INSTALL_BAR_KEY], '1');
    assert.equal(shouldShowInstallBar(win), false);
});

test('휴대폰 웹(/m/)은 휴대폰인지 직접 넘긴다', () => {
    const win = { localStorage: fakeWin().localStorage, matchMedia: () => ({ matches: false }), navigator: {} };
    assert.equal(shouldShowInstallBar(win, { phone: true }), true);
    assert.equal(shouldShowInstallBar(win, { phone: false }), false);
});
