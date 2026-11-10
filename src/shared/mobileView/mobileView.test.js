/**
 * 휴대폰 화면 고르기 · 홈 화면에 추가.
 *
 * 지키려는 것: 휴대폰에서 앱 화면에 처음 들어온 사람에게만 한 번 묻고, 답한 뒤에는 다시 묻지 않는 것.
 * 로그인 · 랜딩 · 외부 폼과 컴퓨터에서는 묻지 않는다. 화면 폭이 바뀌어야 할 때만 새로 연다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    savedMobileView,
    shouldAskMobileView,
    needsViewportReload,
    saveMobileView,
    phoneZoom,
    isStandalone,
    installGuide
} from './index.js';

/** index.html 의 window.__pgptViewport 와 같은 규칙 */
function fakeWin({ phone = true, saved = {}, path = '/definition-map', scale = 0.3, enabled = true } = {}) {
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

test('휴대폰으로 앱 화면에 처음 들어오면 묻는다', () => {
    assert.equal(shouldAskMobileView('/definition-map', fakeWin()), true);
});

test('한 번 답하면 다시 묻지 않는다(데스크톱 · 라이트 모두)', () => {
    assert.equal(shouldAskMobileView('/definition-map', fakeWin({ saved: { mobileView: 'desktop' } })), false);
    assert.equal(shouldAskMobileView('/definition-map', fakeWin({ saved: { mobileView: 'light' } })), false);
});

test('로그인 · 랜딩 · 외부 폼과 컴퓨터에서는 묻지 않는다', () => {
    for (const p of ['/', '/auth/login', '/external-forms/abc']) {
        assert.equal(shouldAskMobileView(p, fakeWin({ path: p })), false, p);
    }
    assert.equal(shouldAskMobileView('/definition-map', fakeWin({ phone: false })), false);
});

test('PAL · uEngine 모드(규칙 꺼짐)에서는 묻지도 폭을 바꾸지도 않는다', () => {
    const win = fakeWin({ enabled: false });
    assert.equal(shouldAskMobileView('/definition-map', win), false);
    assert.equal(needsViewportReload('/auth/login', win), false);
});

test('규칙(__pgptViewport)이 없으면 아무것도 하지 않는다', () => {
    assert.equal(shouldAskMobileView('/definition-map', {}), false);
    assert.equal(needsViewportReload('/definition-map', {}), false);
    assert.equal(savedMobileView({}), null);
});

test('폭이 바뀌는 이동에만 새로 연다', () => {
    const atLogin = fakeWin({ path: '/auth/login' });
    assert.equal(needsViewportReload('/auth/login', atLogin), false);
    assert.equal(needsViewportReload('/definition-map', atLogin), true, '로그인(기기 폭) → 앱(데스크톱 폭)');

    const inApp = fakeWin({ path: '/definition-map' });
    assert.equal(needsViewportReload('/instancelist', inApp), false);
    assert.equal(needsViewportReload('/auth/login', inApp), true, '앱 → 로그인');

    const light = fakeWin({ saved: { mobileView: 'light' } });
    assert.equal(needsViewportReload('/auth/login', light), false, '라이트는 어디서나 기기 폭');
    assert.equal(needsViewportReload('/definition-map', fakeWin({ phone: false, path: '/auth/login' })), false, '컴퓨터');
});

test('라이트로 답하면 저장하고 새로 열어 기기 폭으로 바꾼다', () => {
    const win = fakeWin();
    assert.deepEqual(saveMobileView('light', win), { reload: true });
    assert.equal(win.__store.mobileView, 'light');
    assert.equal(savedMobileView(win), 'light');
});

test('데스크톱으로 답하면 저장만 한다(이미 데스크톱 폭)', () => {
    const win = fakeWin();
    assert.deepEqual(saveMobileView('desktop', win), { reload: false });
    assert.equal(win.__store.mobileView, 'desktop');
});

test('라이트에서 데스크톱으로 바꾸면 새로 연다', () => {
    const win = fakeWin({ saved: { mobileView: 'light' } });
    assert.deepEqual(saveMobileView('desktop', win), { reload: true });
});

test('모르는 값은 저장하지 않는다', () => {
    assert.throws(() => saveMobileView('tablet', fakeWin()));
    assert.equal(savedMobileView(fakeWin({ saved: { mobileView: 'tablet' } })), null);
});

test('데스크톱 폭에서만 대화상자를 휴대폰 글자 크기로 키운다', () => {
    assert.equal(Math.round(phoneZoom(fakeWin({ scale: 0.3 })) * 100) / 100, 3.33);
    assert.equal(phoneZoom(fakeWin({ scale: 0.1 })), 4, '너무 커지지 않게');
    assert.equal(phoneZoom(fakeWin({ scale: 2 })), 1, '확대하면 키우지 않는다');
    assert.equal(phoneZoom(fakeWin({ saved: { mobileView: 'light' }, scale: 1 })), 1, '기기 폭');
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
