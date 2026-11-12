/**
 * 휴대폰 화면 (F-MV-01 ~ F-MV-20) — 2026-11-11, 세 가지 화면은 2026-11-12
 *   - 휴대폰은 기본으로 데스크톱 화면(1280px — PC와 같은 화면)으로 연다. 설정에서 모바일 버전을 고른 휴대폰은
 *     휴대폰 웹(/m/ — 할 일 · 진행 · AI · 알림 · 나)으로, 라이트 모드를 고른 휴대폰은 Process GPT Lite(/lite/)로 연다
 *     (F-MV-03 · 17 ~ 20). 전에 「라이트 버전」(저장값 light)을 골라 둔 휴대폰은 모바일 버전으로 읽는다.
 *   - 홈 화면에 추가하지 않은 휴대폰에는 맨 위 「홈 화면에 추가」 띠, 「다시 보지 않기」 뒤로는 보이지 않는다(F-MV-15 · 16).
 *   - 휴대폰 웹도 포털과 같은 로그인 · 2단계 인증(TOTP)을 거친다(F-MV-13 · 14).
 *   - 홈 화면에 추가(매니페스트 · iPhone 안내), 좁은 화면의 관리 · 설계 · 분석 숨김 · 막기, 결정 칸.
 *
 * 실제 백엔드(설치본)에 붙은 프런트를 휴대폰처럼(터치 · 390px 폭) 연다. 휴대폰 웹(/m/)도 같은 서버가 낸다.
 *
 * 실행 (VM 설치본 예):
 *   UX_BASE_URL=http://localhost:8088 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/mobile-view
 *   (MV_TASK_ID: 김민지의 진행 중 업무 id, MV_APPROVAL_TASK_ID: 장진영의 처음 연 승인/반려 업무 id — 없으면 그 시험은 건너뛴다)
 *
 * 계정 파일: { admin: {email,password}, minji: {...}, mfa: {email,password,totp} } — ux-review 묶음과 같은 파일.
 *   mfa 는 TOTP 를 등록한 계정(totp: base32 비밀). 없으면 F-MV-14 를 건너뛴다.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

const BASE = process.env.UX_BASE_URL || 'http://127.0.0.1:5291';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const IPHONE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
// screen 도 정해야 한다 — 설정의 Desktop Chrome 프로젝트에서 1920×1080 을 물려받으면 휴대폰으로 보지 않는다.
const phone = {
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: ANDROID_UA
};

test.use({
    locale: 'ko-KR',
    launchOptions: {
        args: process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [],
        executablePath: process.env.UX_CHROMIUM || undefined
    }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);

async function login(page: Page) {
    const a = accounts.admin;
    await page.goto(`${BASE}/auth/login`);
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page.locator('button').filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
}

/** RFC 6238 TOTP(30초 · 6자리 · SHA-1) — 인증 앱이 보여 주는 코드 */
function totp(secret: string, at = Date.now()): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
    const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
    const h = crypto.createHmac('sha1', key).update(counter).digest();
    const o = h[h.length - 1] & 15;
    return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

async function fillLogin(page: Page, a: { email: string; password: string }) {
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page.locator('button').filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i }).first().click();
}

const viewport = (page: Page) => page.evaluate(() => ({ mode: document.documentElement.dataset.viewport, width: window.innerWidth }));
const tabs = (page: Page) => page.locator('nav.m-tabs');

async function phoneContext(browser: any, extra: Record<string, unknown> = {}, saved?: 'desktop' | 'mobile' | 'lite' | 'light'): Promise<BrowserContext> {
    const ctx = await browser.newContext({ ...phone, ...extra });
    // 처음 한 번만 심는다 — 초기화 스크립트는 페이지를 열 때마다 돌아 새로 연 뒤의 저장값을 덮는다
    if (saved)
        await ctx.addInitScript((v: string) => {
            if (sessionStorage.getItem('mv-seeded')) return;
            localStorage.setItem('mobileView', v);
            sessionStorage.setItem('mv-seeded', '1');
        }, saved);
    return ctx;
}

async function openPhoneScreenSetting(page: Page) {
    await page.goto(`${BASE}/account-settings`);
    await page.getByText('테마 설정', { exact: true }).first().click();
    const setting = page.getByTestId('mobile-view-setting');
    await expect(setting).toBeVisible({ timeout: 30_000 });
    return setting;
}

test('F-MV-01 휴대폰으로 로그인하면 데스크톱 화면(PC와 같은 화면)으로 열린다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/auth/login`);
    // F-MV-05 로그인 화면은 포털이 휴대폰 폭으로 그린다
    expect(await viewport(page)).toEqual({ mode: 'device', width: 390 });
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(accounts.admin.email);
    await page.locator('input[type="password"]').first().fill(accounts.admin.password);
    await page.locator('button').filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
    await expect.poll(() => viewport(page), { timeout: 30_000 }).toEqual({ mode: 'desktop', width: 1280 });
    expect(new URL(page.url()).pathname).not.toBe('/m/');
    await expect(tabs(page)).toHaveCount(0);
    await ctx.close();
});

test('F-MV-02 휴대폰 웹 「나」의 「PC 화면으로 보기」는 포털 데스크톱 화면을 열고, 다시 열어도 그대로다', async ({ browser }) => {
    const ctx = await phoneContext(browser, {}, 'mobile');
    const page = await ctx.newPage();
    await login(page);
    await page.waitForURL((u) => u.pathname === '/m/', { timeout: 60_000 });
    await page.goto(`${BASE}/m/#/me`);
    await page.getByText('PC 화면으로 보기', { exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/definition-map', { timeout: 60_000 });
    await expect.poll(() => viewport(page)).toEqual({ mode: 'desktop', width: 1280 });
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBe('desktop');
    await page.goto(`${BASE}/todolist`);
    await page.waitForTimeout(3_000);
    expect(new URL(page.url()).pathname).toBe('/todolist');
    expect((await viewport(page)).mode).toBe('desktop');
    await ctx.close();
});

test('F-MV-03 설정 › 테마 설정 「휴대폰 화면」에서 모바일 버전을 고르면 휴대폰 웹으로 간다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    await login(page);
    expect((await viewport(page)).mode).toBe('desktop');
    const setting = await openPhoneScreenSetting(page);
    await setting.getByText(/모바일 버전/).click();
    await page.waitForURL((u) => u.pathname === '/m/', { timeout: 60_000 });
    await expect(tabs(page)).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBe('mobile');
    await ctx.close();
});

test('F-MV-06 홈 화면에 추가: 매니페스트가 있고 iPhone 에는 공유 단추 안내를 보여 준다', async ({ browser }) => {
    const ctx = await phoneContext(browser, { userAgent: IPHONE_UA }, 'desktop');
    const page = await ctx.newPage();
    await login(page);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    const manifest = await (await page.request.get(`${BASE}${href}`)).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((i: any) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons) expect((await page.request.get(`${BASE}${icon.src}`)).status(), icon.src).toBe(200);

    await page.goto(`${BASE}/account-settings`);
    await page.getByText('테마 설정', { exact: true }).first().click();
    // 맨 위 띠에도 같은 단추가 있다 — 설정의 것을 누른다
    await page.getByTestId('add-to-home-screen').last().click();
    const guide = page.getByTestId('add-to-home-guide');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('공유 단추');
    await expect(guide).toContainText('홈 화면에 추가');
    await ctx.close();
});

test('F-MV-07 컴퓨터(마우스)에서는 휴대폰 웹으로 옮기지 않고 화면 폭도 바꾸지 않는다', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page);
    await page.waitForTimeout(3_000);
    expect(new URL(page.url()).pathname).not.toBe('/m/');
    expect(await viewport(page)).toEqual({ mode: 'device', width: 1440 });
    await ctx.close();
});

// ── 좁은 화면(폭 768px 이하)에서는 내 일만 — 휴대폰 웹으로 가지 않는 좁은 창(컴퓨터)에서 확인한다 ─────────────
// MV_TASK_ID: 김민지의 진행 중 업무 id, MV_APPROVAL_TASK_ID: 장진영의 처음 연 승인/반려 업무 id (없으면 그 시험은 건너뛴다)

async function loginAs(page: Page, who: 'admin' | 'minji') {
    const a = accounts[who];
    await page.goto(`${BASE}/auth/login`);
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page.locator('button').filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
}

const narrow = { viewport: { width: 700, height: 900 } };

test('F-MV-08 좁은 화면 사이드바에는 관리 · 설계 · 분석 메뉴가 없다', async ({ browser }) => {
    const ctx = await browser.newContext(narrow);
    const page = await ctx.newPage();
    await loginAs(page, 'admin');
    await page.waitForTimeout(4_000);
    const drawer = (await page.locator('nav.v-navigation-drawer').first().textContent()) || '';
    expect(drawer).toContain('인스턴스');
    for (const hidden of ['에이전트 동료', '스킬', '대시보드', '요청 Top List', 'Heatmap', 'Strategy Board']) {
        expect(drawer, hidden).not.toContain(hidden);
    }
    await ctx.close();
});

test('F-MV-09 좁은 화면에서 관리 주소로 가면 PC 안내로 간다', async ({ browser }) => {
    const ctx = await browser.newContext(narrow);
    const page = await ctx.newPage();
    await loginAs(page, 'admin');
    await page.goto(`${BASE}/skills`);
    await expect(page.getByTestId('desktop-only')).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get('from')).toBe('/skills');
    await expect(page.getByTestId('desktop-only-open')).toContainText('창을 넓힌 뒤 다시 열기');
    await ctx.close();
});

test('F-MV-10 휴대폰 웹 업무 화면에 「에이전트에 맡기기」가 있다', async ({ browser }) => {
    test.skip(!process.env.MV_TASK_ID, 'MV_TASK_ID 없음');
    const ctx = await phoneContext(browser, {}, 'mobile');
    const page = await ctx.newPage();
    await loginAs(page, 'minji');
    await page.goto(`${BASE}/todolist/${process.env.MV_TASK_ID}`);
    await page.waitForURL((u) => u.pathname === '/m/', { timeout: 60_000 });
    expect(new URL(page.url()).hash).toBe(`#/tasks/${process.env.MV_TASK_ID}`);
    await expect(page.getByRole('button', { name: /에이전트에 맡기기|다시 맡기기/ }).first()).toBeVisible({ timeout: 30_000 });
    await ctx.close();
});

test('F-MV-11 승인 · 반려 칸은 미리 고르지 않고, 고르지 않으면 제출되지 않는다', async ({ browser }) => {
    test.skip(!process.env.MV_APPROVAL_TASK_ID, 'MV_APPROVAL_TASK_ID 없음');
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    let submitted = false;
    page.on('request', (r) => {
        if (r.method() !== 'GET' && /complete|submit|putWorkItem|todolist/.test(r.url()) && /COMPLETED|SUBMITTED/.test(r.postData() || '')) submitted = true;
    });
    await loginAs(page, 'admin');
    await page.goto(`${BASE}/todolist/${process.env.MV_APPROVAL_TASK_ID}`);
    const select = page.locator('.form-select-field .v-select').first();
    await expect(select).toBeVisible({ timeout: 30_000 });
    // 빈 값이어도 Vuetify 는 빈 선택 글자 칸을 그린다 — 글자로 확인한다
    await expect(select).not.toContainText(/승인|반려/);
    await page.locator('.v-main button:visible').filter({ hasText: /제출 완료/ }).first().click();
    await expect(page.getByText(/칸에서 하나를 골라 주세요/)).toBeVisible({ timeout: 10_000 });
    expect(submitted).toBe(false);
    await ctx.close();
});

test('F-MV-12 휴대폰 웹 승인 화면: 미리 고른 값 없이 반려 · 승인 두 단추, 반려는 의견이 있어야 눌린다', async ({ browser }) => {
    test.skip(!process.env.MV_APPROVAL_TASK_ID, 'MV_APPROVAL_TASK_ID 없음');
    const ctx = await phoneContext(browser, {}, 'mobile');
    const page = await ctx.newPage();
    await loginAs(page, 'admin');
    await page.goto(`${BASE}/m/#/tasks/${process.env.MV_APPROVAL_TASK_ID}`);
    const reject = page.getByRole('button', { name: /반려/ }).last();
    const approve = page.getByRole('button', { name: /승인/ }).last();
    await expect(reject).toBeVisible({ timeout: 30_000 });
    await expect(approve).toBeVisible();
    await expect(reject).toBeDisabled();
    await ctx.close();
});


test('F-MV-13 로그인 전에 휴대폰 웹 주소를 열면 포털 로그인을 거쳐 그 화면으로 돌아온다', async ({ browser }) => {
    // 옛 저장값(light — 「라이트 버전」)으로 둔다: 전에 고른 휴대폰도 그대로 휴대폰 웹으로 열려야 한다
    const ctx = await phoneContext(browser, {}, 'light');
    const page = await ctx.newPage();
    await page.goto(`${BASE}/m/#/notifications`);
    // 휴대폰 웹에는 자기 로그인 화면이 없다 — 포털 로그인(소셜 로그인 · 2단계 인증이 있는 곳)으로 간다
    await page.waitForURL((u) => u.pathname === '/auth/login', { timeout: 30_000 });
    await fillLogin(page, accounts.admin);
    await page.waitForURL((u) => u.pathname === '/m/' && u.hash === '#/notifications', { timeout: 60_000 });
    await expect(tabs(page)).toBeVisible();
    await ctx.close();
});

test('F-MV-14 2단계 인증 계정은 비밀번호만으로 휴대폰 웹에 들어가지 못한다', async ({ browser }) => {
    test.skip(!accounts.mfa, '계정 파일에 mfa(TOTP 등록 계정)가 없습니다');
    const ctx = await phoneContext(browser, {}, 'mobile');
    const page = await ctx.newPage();
    await page.goto(`${BASE}/auth/login`);
    await fillLogin(page, accounts.mfa);
    await page.waitForURL((u) => u.pathname === '/auth/two-step', { timeout: 60_000 });

    // 코드를 넣지 않고 휴대폰 웹 · 포털 업무 주소로 바로 가 본다 — 둘 다 2단계 인증으로 돌아와야 한다
    await page.goto(`${BASE}/m/#/tasks`);
    await page.waitForURL((u) => u.pathname === '/auth/two-step', { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/todolist');
    await page.goto(`${BASE}/notifications`);
    await page.waitForURL((u) => u.pathname === '/auth/two-step', { timeout: 30_000 });
    await expect(tabs(page)).toHaveCount(0);

    // 코드를 넣으면 가려던 화면(알림)이 휴대폰 웹으로 열린다
    const digits = page.locator('.verification input');
    await expect(digits.first()).toBeEnabled({ timeout: 30_000 });
    const code = totp(accounts.mfa.totp);
    for (let i = 0; i < 6; i++) await digits.nth(i).fill(code[i]);
    await page.waitForURL((u) => u.pathname === '/m/' && u.hash === '#/notifications', { timeout: 60_000 });
    await expect(tabs(page)).toBeVisible();
    await ctx.close();
});

test('F-MV-15 데스크톱 화면 맨 위의 「홈 화면에 추가」 띠 — 누르면 안내, 「다시 보지 않기」 뒤로는 보이지 않는다', async ({ browser }) => {
    const ctx = await phoneContext(browser, { userAgent: IPHONE_UA });
    const page = await ctx.newPage();
    await login(page);
    await expect.poll(() => viewport(page), { timeout: 30_000 }).toEqual({ mode: 'desktop', width: 1280 });
    const bar = page.getByTestId('install-bar');
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(bar).toContainText('앱처럼');
    // 띠가 머리를 가리지 않는다 — 위쪽 막대가 띠 아래에서 시작한다
    const barBox = (await bar.boundingBox())!;
    const header = (await page.locator('header.v-app-bar, .v-app-bar').first().boundingBox())!;
    expect(header.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
    await page.screenshot({ path: 'playwright/test-results/mv-install-bar-desktop.png' });

    await bar.getByTestId('add-to-home-screen').click();
    const guide = page.getByTestId('add-to-home-guide');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('공유 단추');
    await page.keyboard.press('Escape');

    await bar.getByTestId('install-bar-hide').click();
    await expect(bar).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('installBarHidden'))).toBe('1');
    await page.reload();
    await page.waitForTimeout(4_000);
    await expect(page.getByTestId('install-bar')).toHaveCount(0);
    await ctx.close();
});

test('F-MV-16 휴대폰 웹(/m/) 맨 위에도 같은 띠가 있고, 「다시 보지 않기」는 포털과 같이 기억한다', async ({ browser }) => {
    const ctx = await phoneContext(browser, { userAgent: IPHONE_UA }, 'mobile');
    const page = await ctx.newPage();
    await login(page);
    await page.waitForURL((u) => u.pathname === '/m/', { timeout: 60_000 });
    const bar = page.getByTestId('install-bar');
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'playwright/test-results/mv-install-bar-light.png' });
    await bar.getByTestId('add-to-home-screen').click();
    await expect(page.getByTestId('add-to-home-guide')).toContainText('공유 단추');
    await bar.getByTestId('install-bar-hide').click();
    await expect(bar).toHaveCount(0);
    await page.reload();
    await expect(tabs(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('install-bar')).toHaveCount(0);
    // 포털(데스크톱 화면)에서도 보이지 않는다
    await page.evaluate(() => localStorage.setItem('mobileView', 'desktop'));
    await page.goto(`${BASE}/definition-map`);
    await expect.poll(() => viewport(page), { timeout: 30_000 }).toEqual({ mode: 'desktop', width: 1280 });
    await page.waitForTimeout(3_000);
    await expect(page.getByTestId('install-bar')).toHaveCount(0);
    await ctx.close();
});

// ── 휴대폰 화면 세 가지: 데스크톱 버전 · 모바일 버전(/m/) · 라이트 모드(/lite/ — Process GPT Lite) ─────────────────
// 「데스크탑 버전, 모바일 버전, 라이트 모드 이렇게 있는 거야 … 라이트 모드 말 그대로 프로세스 GPT 라이트로 연결이 돼야 돼」

/** 이 서버에 Process GPT Lite 가 실제로 있나(없으면 /lite/ 도 포털 화면이 나온다) */
async function hasLite(page: Page) {
    const html = await (await page.request.get(`${BASE}/lite/`)).text();
    return html.includes('/lite/assets/') && !html.includes('__pgptViewport');
}

/** Lite 가 없는 시험 서버에서 Lite 자리를 대신하는 화면 — /lite/ 문서만 바꾼다(포털 문서는 건드리지 않는다) */
async function fakeLite(ctx: BrowserContext) {
    await ctx.route(/\/lite\/(\?.*)?$/, (route) =>
        route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: '<!doctype html><title>process gpt pro</title><script type="module" src="/lite/assets/index.js"></script><div data-testid="fake-lite">Process GPT Lite</div>'
        })
    );
    await ctx.route(/\/lite\/assets\//, (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
}

test('F-MV-17 「휴대폰 화면」에는 데스크톱 버전 · 모바일 버전 · 라이트 모드 세 가지가 있다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    await login(page);
    const setting = await openPhoneScreenSetting(page);
    const radios = setting.getByRole('radio');
    await expect(radios).toHaveCount(3);
    await expect(setting).toContainText('데스크톱 버전');
    await expect(setting).toContainText('모바일 버전');
    await expect(setting).toContainText('라이트 모드');
    // 고르지 않은 휴대폰은 데스크톱 버전이다
    await expect(setting.getByRole('radio', { name: /데스크톱 버전/ })).toBeChecked();
    await page.screenshot({ path: 'playwright/test-results/mv-three-options.png' });
    await ctx.close();
});

test('F-MV-18 라이트 모드를 고르면 Process GPT Lite(/lite/)로 가고, 포털 주소를 열어도 Lite 로 간다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    if (!(await hasLite(page))) await fakeLite(ctx);
    await login(page);
    const setting = await openPhoneScreenSetting(page);
    await setting.getByText(/라이트 모드/).click();
    await page.waitForURL((u) => u.pathname === '/lite/', { timeout: 60_000 });
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBe('lite');
    await expect(tabs(page)).toHaveCount(0);
    // 포털 업무 주소(알림 링크 등)를 열어도 Lite 로 간다 — 휴대폰 웹(/m/)이 아니다
    await page.goto(`${BASE}/todolist`);
    await page.waitForURL((u) => u.pathname === '/lite/', { timeout: 60_000 });
    await ctx.close();
});

test('F-MV-19 Lite 가 없는 서버에서 라이트 모드를 고르면 안내만 하고 바꾸지 않는다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    test.skip(await hasLite(page), '이 서버에는 Process GPT Lite 가 있다');
    await login(page);
    const setting = await openPhoneScreenSetting(page);
    await setting.getByText(/라이트 모드/).click();
    await expect(page.getByTestId('mobile-view-lite-missing')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('mobile-view-lite-missing')).toContainText('Process GPT Lite');
    await expect(setting.getByRole('radio', { name: /데스크톱 버전/ })).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBeNull();
    expect(new URL(page.url()).pathname).toBe('/account-settings');
    await page.screenshot({ path: 'playwright/test-results/mv-lite-missing.png' });
    await ctx.close();
});

test('F-MV-20 라이트 모드인 휴대폰이 ?mobileView=desktop 주소로 오면 데스크톱 화면으로 돌아온다', async ({ browser }) => {
    const ctx = await phoneContext(browser, {}, 'lite');
    const page = await ctx.newPage();
    if (!(await hasLite(page))) await fakeLite(ctx);
    await login(page);
    await page.waitForURL((u) => u.pathname === '/lite/', { timeout: 60_000 });
    // Lite 설정의 「데스크톱 화면으로」가 여는 주소
    await page.goto(`${BASE}/definition-map?mobileView=desktop`);
    await expect.poll(() => viewport(page), { timeout: 30_000 }).toEqual({ mode: 'desktop', width: 1280 });
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBe('desktop');
    const url = new URL(page.url());
    expect(url.pathname).toBe('/definition-map');
    expect(url.searchParams.has('mobileView')).toBe(false);
    // 설정에는 데스크톱 버전이 골라져 있다
    const setting = await openPhoneScreenSetting(page);
    await expect(setting.getByRole('radio', { name: /데스크톱 버전/ })).toBeChecked();
    await ctx.close();
});
