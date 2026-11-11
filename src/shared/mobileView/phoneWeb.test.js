/**
 * 라이트를 고른 휴대폰은 앱 화면을 휴대폰 웹(/m/)으로 연다. 기본(고르지 않음)과 desktop 은 데스크톱 화면.
 *
 * 지키려는 것: 포털 주소 → 휴대폰 주소 규칙이 index.html 한 곳에 있고, 그 규칙이
 *   - 라이트를 고른 휴대폰에서만 옮기며(기본 · 데스크톱 · 컴퓨터 · 앱 · PAL 은 그대로),
 *   - 로그인 · 랜딩 · 외부 폼 · 조직 고르기는 포털에 남기고,
 *   - 할 일 · 인스턴스 · 대화 · 알림은 휴대폰의 같은 화면으로 보낸다.
 * 규칙은 index.html 의 인라인 스크립트를 그대로 떼어 가짜 브라우저에서 돌려 확인한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { phoneWebUrl } from './index.js';

const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('__pgptViewport'));

/** index.html 의 스크립트를 한 번 돌린다. 옮겼으면 replaced 에 주소가 남는다. */
function boot({ phone = true, view = null, path: p = '/todolist', env = {}, native = false } = {}) {
    const store = view ? { mobileView: view } : {};
    const meta = { content: 'width=device-width', getAttribute: () => 'width=device-width', setAttribute() {} };
    const win = {
        _env_: env,
        Capacitor: native ? { isNativePlatform: () => true } : undefined,
        matchMedia: () => ({ matches: phone }),
        localStorage: { getItem: (k) => (k in store ? store[k] : null) },
        location: {
            pathname: p,
            replaced: null,
            replace(url) {
                this.replaced = url;
            }
        },
        document: {
            querySelector: () => meta,
            documentElement: { setAttribute() {} }
        },
        screen: { width: phone ? 390 : 1920, height: phone ? 844 : 1080 }
    };
    win.window = win;
    vm.runInNewContext(script, { window: win, document: win.document, location: win.location, localStorage: win.localStorage, screen: win.screen, String, encodeURIComponent, decodeURIComponent, Math });
    return win;
}

test('포털 주소 → 휴대폰 주소', () => {
    const api = boot({ view: 'desktop' }).__pgptViewport;
    assert.equal(api.phoneWebHash('/todolist/abc-1'), '#/tasks/abc-1');
    assert.equal(api.phoneWebHash('/todolist'), '#/tasks');
    assert.equal(api.phoneWebHash('/instancelist/def.inst-1'), '#/instances/def.inst-1');
    assert.equal(api.phoneWebHash('/instance-viewer/x1'), '#/instances/x1');
    assert.equal(api.phoneWebHash('/instancelist/running'), '#/progress');
    assert.equal(api.phoneWebHash('/chats'), '#/chat');
    assert.equal(api.phoneWebHash('/chat/room-9'), '#/chat');
    assert.equal(api.phoneWebHash('/agent-chat/a1'), '#/chat');
    assert.equal(api.phoneWebHash('/notifications'), '#/notifications');
    assert.equal(api.phoneWebHash('/definition-map'), '#/tasks');
    assert.equal(api.phoneWebHash('/admin/task-catalog'), '#/tasks');
});

test('식별자에 든 특수 문자는 한 번만 인코딩한다', () => {
    const api = boot({ view: 'desktop' }).__pgptViewport;
    assert.equal(api.phoneWebHash('/todolist/a%20b'), '#/tasks/a%20b');
    assert.equal(api.phoneWebHash('/todolist/a b'), '#/tasks/a%20b');
});

test('라이트를 고른 휴대폰만 첫 렌더 전에 휴대폰 웹으로 옮긴다', () => {
    assert.equal(boot({ view: 'light', path: '/todolist/t-1' }).location.replaced, '/m/#/tasks/t-1');
});

test('기본(고르지 않음)과 「PC 화면으로 보기」(desktop)는 옮기지 않고 데스크톱 폭으로 그린다', () => {
    for (const view of [null, 'desktop']) {
        const win = boot({ view, path: '/todolist/t-1' });
        assert.equal(win.location.replaced, null, String(view));
        assert.equal(win.__pgptViewport.desktop, true, String(view));
    }
});

test('컴퓨터 · 네이티브 앱 · PAL · uEngine 은 옮기지 않는다', () => {
    assert.equal(boot({ view: 'light', phone: false }).location.replaced, null);
    assert.equal(boot({ view: 'light', native: true }).location.replaced, null);
    assert.equal(boot({ view: 'light', env: { VITE_PAL_MODE: 'true' } }).location.replaced, null);
    assert.equal(boot({ view: 'light', env: { VITE_MODE: 'uEngine' } }).location.replaced, null);
});

test('로그인 · 랜딩 · 외부 폼 · 조직 고르기 · 약관 · 계정 설정(2단계 인증 등록)은 포털에 남는다', () => {
    for (const p of ['/', '/auth/login', '/auth/two-step', '/auth/signup-pending', '/external-forms/f1', '/tenant/manage', '/tenant', '/privacy', '/terms', '/account-settings']) {
        assert.equal(boot({ view: 'light', path: p }).location.replaced, null, p);
    }
});

test('라우터가 쓰는 phoneWebUrl 은 같은 규칙을 그대로 부른다', () => {
    const win = boot({ view: 'light', path: '/auth/login' });
    assert.equal(phoneWebUrl('/notifications', win), '/m/#/notifications');
    assert.equal(phoneWebUrl('/auth/login', win), null);
    assert.equal(phoneWebUrl('/todolist', {}), null, '규칙이 없는 곳(앱 · 테스트)에서는 옮기지 않는다');
});

test('포털 라우터는 MFA 게이트를 지난 뒤에만 휴대폰 웹으로 옮긴다', () => {
    // 앞에 두면 비밀번호만 통과한 세션(aal1)이 2단계 인증 없이 휴대폰 웹으로 간다.
    const router = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../router/index.ts'), 'utf8');
    const gate = router.indexOf('await evaluateMfaGate(to.path)');
    const move = router.indexOf('phoneWebUrl(to.path)');
    assert.ok(gate > 0 && move > 0, '두 호출이 다 있다');
    assert.ok(move > gate, 'phoneWebUrl 은 evaluateMfaGate 뒤');
});
