/**
 * 2026-11-12 휴대폰 사진(설정 › 테마 설정 · 다크 테마) — 「설정창에 들어갔을 때 이렇게 그 테마가 깨지는 부분이 있어.
 * 왼쪽 편 그 메뉴 부분이 흰색으로 지금 나오고 있지?」 (F-RV-G01 ~ G03)
 *
 * 테마 설정 화면은 열릴 때 저장해 둔 Vuetify 테마 이름(userSettings.actTheme)으로 사이드바 · 상단바 색을 다시 덮었다.
 * 그 이름은 테마를 고를 때 한 박자 늦게 저장돼 늘 직전 선택이었고, 휴대폰 웹(/m/)에서 바꾼 테마는 따라오지도 않았다.
 * 그래서 본문은 다크인데 사이드바 · 상단바만 흰색이 됐다. 지금 적용된 테마(pg-appearance)만 기준으로 삼는다.
 *
 *   BASE_URL=http://localhost:8088 UX_BASE_URL=http://localhost:8088 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/rev1112c/theme-settings.spec.ts
 *
 * 데이터는 읽기만 한다(테마는 이 브라우저의 저장소에만 남는다).
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.UX_BASE_URL || 'http://localhost:8088';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
const SHOT_DIR = process.env.SHOT_DIR || '';

test.use({
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    launchOptions: {
        args: process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [],
        executablePath: process.env.UX_CHROMIUM || undefined
    }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);

/** 적용된 테마와, 그와 어긋나게 저장된 Vuetify 테마 이름을 심고 로그인한다(처음 한 번만 심는다). */
async function login(page: Page, appearance: 'dark' | 'light' | 'sky', staleTheme: string) {
    const a = accounts.admin;
    await page.addInitScript(
        ([ap, theme]) => {
            try {
                if (sessionStorage.getItem('rv-seeded')) return;
                localStorage.setItem('pg.simpleUi', '0');
                localStorage.setItem('pg-appearance', ap);
                localStorage.setItem('userSettings', JSON.stringify({ boxed: false, mini_sidebar: false, actTheme: theme }));
                sessionStorage.setItem('rv-seeded', '1');
            } catch (e) {
                /* 저장소가 막힌 환경 */
            }
        },
        [appearance, staleTheme]
    );
    await page.goto(`${BASE}/auth/login`);
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page
        .locator('button')
        .filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i })
        .first()
        .click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth/'), { timeout: 45_000 });
}

async function openThemeSettings(page: Page) {
    await page.goto(`${BASE}/account-settings`);
    await page.getByText('테마 설정', { exact: true }).first().click();
    await expect(page.locator('.theme-card').first()).toBeVisible({ timeout: 30_000 });
    // 지연 로드되는 Vuetify 테마 맞춤이 끝날 시간
    await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string) {
    if (!SHOT_DIR) return;
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

/** 바탕색의 밝기 합(r+g+b) — 투명하면 부모로 올라간다 */
const brightness = (page: Page, selector: string) =>
    page
        .locator(selector)
        .first()
        .evaluate((el) => {
            for (let n: Element | null = el; n; n = n.parentElement) {
                const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
                if (!m) continue;
                const [r, g, b, a = '1'] = m;
                if (Number(a) > 0.5) return Number(r) + Number(g) + Number(b);
            }
            return 765;
        });
const DARK = 3 * 80;
const LIGHT = 3 * 200;
const storedTheme = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('userSettings') || '{}').actTheme);
const activeCard = (page: Page) => page.locator('.theme-card--active');

test('F-RV-G01 다크: 저장된 테마 이름이 어긋나 있어도 테마 설정을 열면 사이드바 · 상단바가 어둡다', async ({ page }) => {
    await login(page, 'dark', 'BLUE_THEME');
    await openThemeSettings(page);
    await shot(page, 'g01-dark-settings');
    expect(await brightness(page, '.v-navigation-drawer'), '사이드바 바탕').toBeLessThan(DARK);
    expect(await brightness(page, '.v-app-bar'), '상단바 바탕').toBeLessThan(DARK);
    expect(await brightness(page, '.v-main'), '본문 바탕').toBeLessThan(DARK);
    await expect(activeCard(page)).toHaveCount(1);
    await expect(activeCard(page)).toContainText('다크');
    // 어긋나 있던 저장값도 바로잡는다
    expect(await storedTheme(page)).toBe('DARK_BLUE_THEME');
});

test('F-RV-G02 테마를 고르면 그 테마가 바로 저장되고, 설정을 다시 열어도 화면 전체가 같은 테마다', async ({ page }) => {
    await login(page, 'light', 'BLUE_THEME');
    await openThemeSettings(page);
    await page.locator('.theme-card', { hasText: '다크' }).click();
    // 고른 그 순간에 새 테마가 저장된다(전에는 직전 테마가 저장됐다)
    expect(await storedTheme(page)).toBe('DARK_BLUE_THEME');
    expect(await page.evaluate(() => localStorage.getItem('pg-appearance'))).toBe('dark');

    await page.goto(`${BASE}/todolist`);
    await expect(page.locator('.v-navigation-drawer').first()).toBeVisible({ timeout: 30_000 });
    await openThemeSettings(page);
    await shot(page, 'g02-dark-reopened');
    expect(await brightness(page, '.v-navigation-drawer'), '사이드바 바탕').toBeLessThan(DARK);
    expect(await brightness(page, '.v-app-bar'), '상단바 바탕').toBeLessThan(DARK);
    await expect(activeCard(page)).toContainText('다크');

    await page.locator('.theme-card', { hasText: '라이트' }).click();
    expect(await storedTheme(page)).toBe('BLUE_THEME');
    await page.waitForTimeout(1000);
    expect(await brightness(page, '.v-navigation-drawer'), '사이드바 바탕').toBeGreaterThan(LIGHT);
    expect(await brightness(page, '.v-app-bar'), '상단바 바탕').toBeGreaterThan(LIGHT);
});

test('F-RV-G03 라이트: 저장된 이름이 다크로 남아 있어도 테마 설정을 열면 사이드바 · 상단바가 밝다', async ({ page }) => {
    await login(page, 'light', 'DARK_BLUE_THEME');
    await openThemeSettings(page);
    await shot(page, 'g03-light-settings');
    expect(await brightness(page, '.v-navigation-drawer'), '사이드바 바탕').toBeGreaterThan(LIGHT);
    expect(await brightness(page, '.v-app-bar'), '상단바 바탕').toBeGreaterThan(LIGHT);
    await expect(activeCard(page)).toContainText('라이트');
    expect(await storedTheme(page)).toBe('BLUE_THEME');
});
