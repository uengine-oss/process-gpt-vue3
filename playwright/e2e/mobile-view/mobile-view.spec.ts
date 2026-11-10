/**
 * 휴대폰 화면: 기본은 데스크톱 화면, 라이트 버전은 한 번만 묻기, 설정에서 바꾸기, 홈 화면에 추가 (F-MV-01 ~ F-MV-07)
 * — 2026-11-11 사용자 요청
 *
 * 실제 백엔드(설치본)에 붙은 프런트를 휴대폰처럼(터치 · 390px 폭) 연다. 데이터는 바꾸지 않는다.
 *
 * 실행 (VM 설치본 예):
 *   UX_BASE_URL=http://localhost:8088 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/mobile-view
 *
 * 계정 파일: { admin: {email,password}, ... } — ux-review 묶음과 같은 파일.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
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

const viewport = (page: Page) => page.evaluate(() => ({ mode: document.documentElement.dataset.viewport, width: window.innerWidth }));
const prompt = (page: Page) => page.getByTestId('mobile-view-prompt');

async function phoneContext(browser: any, extra: Record<string, unknown> = {}, saved?: 'desktop' | 'light'): Promise<BrowserContext> {
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

test('F-MV-01 휴대폰으로 로그인하면 데스크톱 화면(폭 1280)으로 열리고 라이트 버전을 묻는다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/auth/login`);
    // F-MV-05 로그인 화면은 휴대폰 폭 그대로다
    expect(await viewport(page)).toEqual({ mode: 'device', width: 390 });
    await login(page);
    await expect(prompt(page)).toBeVisible({ timeout: 30_000 });
    expect(await viewport(page)).toEqual({ mode: 'desktop', width: 1280 });
    // 데스크톱 상단 막대가 있고, 휴대폰 간소화 앱바는 없다
    await expect(page.locator('.full-header #top.v-app-bar')).toBeVisible();
    await expect(prompt(page)).toContainText('라이트 버전');
    await expect(prompt(page)).toContainText('휴대폰 화면');
    // 화면이 다 그려진 뒤에도 폭이 그대로다(문서에 다른 viewport meta 가 끼어들면 기기 폭으로 돌아간다)
    await page.waitForTimeout(4_000);
    expect(await viewport(page)).toEqual({ mode: 'desktop', width: 1280 });
    expect(await page.locator('meta[name="viewport"]').count()).toBe(1);
    await ctx.close();
});

test('F-MV-02 「데스크톱 화면 유지」를 고르면 다시 묻지 않는다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    await login(page);
    await page.getByTestId('mobile-view-desktop').click();
    await expect(prompt(page)).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBe('desktop');
    await page.reload();
    await page.waitForTimeout(3_000);
    await expect(prompt(page)).toHaveCount(0);
    expect((await viewport(page)).mode).toBe('desktop');
    await ctx.close();
});

test('F-MV-03 「라이트 버전 보기」를 고르면 휴대폰 폭 간소화 화면으로 바뀌고 다시 묻지 않는다', async ({ browser }) => {
    const ctx = await phoneContext(browser);
    const page = await ctx.newPage();
    await login(page);
    await Promise.all([page.waitForEvent('load'), page.getByTestId('mobile-view-light').click()]);
    await expect.poll(() => viewport(page)).toEqual({ mode: 'device', width: 390 });
    await page.waitForTimeout(3_000);
    await expect(prompt(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBe('light');
    await ctx.close();
});

test('F-MV-04 설정 › 테마 설정의 「휴대폰 화면」에서 라이트를 데스크톱으로 바꾼다', async ({ browser }) => {
    const ctx = await phoneContext(browser, {}, 'light');
    const page = await ctx.newPage();
    await login(page);
    expect((await viewport(page)).mode).toBe('device');
    await page.goto(`${BASE}/account-settings`);
    await page.getByText('테마 설정', { exact: true }).first().click();
    const setting = page.getByTestId('mobile-view-setting');
    await expect(setting).toBeVisible({ timeout: 30_000 });
    // 고르면 바로 새로 열리므로 check() 대신 누르기만 한다(check 는 새로 열린 뒤 상태를 다시 확인하려다 멈춘다)
    await Promise.all([page.waitForEvent('load'), setting.getByText(/데스크톱 버전/).click()]);
    await expect.poll(() => viewport(page)).toEqual({ mode: 'desktop', width: 1280 });
    expect(await page.evaluate(() => localStorage.getItem('mobileView'))).toBe('desktop');
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
    await page.getByTestId('add-to-home-screen').click();
    const guide = page.getByTestId('add-to-home-guide');
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('공유 단추');
    await expect(guide).toContainText('홈 화면에 추가');
    await ctx.close();
});

test('F-MV-07 컴퓨터(마우스)에서는 묻지 않고 화면 폭도 바꾸지 않는다', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page);
    await page.waitForTimeout(3_000);
    await expect(prompt(page)).toHaveCount(0);
    expect(await viewport(page)).toEqual({ mode: 'device', width: 1440 });
    await ctx.close();
});
