/**
 * 2026-11-12 오전 휴대폰 사진(PC 화면 · 다크 테마) — 「다크 모드에서 글자가 … 검정색으로 해서 안 보이는 부분이 있고,
 * 에이전트 창에서도 흰색 바탕으로 그 테마가 다크가 안 먹히는 부분이 있고」 (F-RV-E01 ~ E04)
 *
 * 사이드바 대화목록 · 에이전트 · 사람 · 스킬 이름과 대화방 머리 · 본문이 검정 반투명 글자로 고정돼 있었고,
 * 대화 칸은 흰 바탕이 박혀 있었다. 다크용 로고 그림(logo-light.svg)도 글자가 검정이었다.
 *
 *   BASE_URL=http://localhost:8088 UX_BASE_URL=http://localhost:8088 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/rev1112b/dark-theme.spec.ts
 *
 * 필요한 데이터: 대화목록 · 에이전트 동료가 있는 계정, 마크다운 답이 있는 대화방(RV_CHAT_ROOM — VM 「영업 제안서 승인
 * 프로세스 설계」 방이 기본값). 데이터는 읽기만 한다.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lowContrast } from './contrast';

const BASE = process.env.UX_BASE_URL || 'http://localhost:8088';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
const CHAT_ROOM = process.env.RV_CHAT_ROOM || 'bee38bab-0f88-4865-ac0f-3f4cab596aa7';
const SHOT_DIR = process.env.SHOT_DIR || '';
// 글자와 바탕의 대비가 이보다 낮으면 「안 보인다」로 본다(WCAG 큰 글자 기준 3 보다 조금 느슨하게).
const MIN_RATIO = 2.5;

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

async function login(page: Page, appearance: 'dark' | 'light') {
    const a = accounts.admin;
    await page.addInitScript((ap) => {
        try {
            localStorage.setItem('pg.simpleUi', '0');
            localStorage.setItem('pg-appearance', ap);
        } catch (e) {
            /* 저장소가 막힌 환경 */
        }
    }, appearance);
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

async function shot(page: Page, name: string) {
    if (!SHOT_DIR) return;
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

const describe = (items: any[]) => items.map((x) => `${x.ratio} ${x.color} on ${x.bg} "${x.text}" (${x.path})`).join('\n');

test('F-RV-E01 다크: 사이드바 대화목록 · 에이전트 · 사람 · 스킬 이름이 보인다', async ({ page }) => {
    await login(page, 'dark');
    await page.goto(`${BASE}/todolist`);
    const drawer = page.locator('.v-navigation-drawer').first();
    await expect(drawer.locator('.chat-room-title').first()).toBeVisible({ timeout: 30_000 });
    await expect(drawer.locator('.agent-name').first()).toBeVisible({ timeout: 30_000 });
    await shot(page, 'e01-sidebar');
    const bad = (await lowContrast(page, '.v-navigation-drawer')).filter((x: any) => x.ratio < MIN_RATIO);
    expect(bad, describe(bad)).toEqual([]);
});

test('F-RV-E02 다크: 대화방 바탕이 어둡고 머리 · 본문 글자가 보인다', async ({ page }) => {
    await login(page, 'dark');
    await page.goto(`${BASE}/chat?roomId=${CHAT_ROOM}`);
    const wrapper = page.locator('.chat-info-view-wrapper').first();
    await expect(wrapper).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.markdown-content').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await shot(page, 'e02-chat');

    // 흰 바탕이 박혀 있던 대화 칸
    const bg = await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = (bg.match(/\d+/g) || []).map(Number);
    expect(r + g + b, `대화 칸 바탕 ${bg}`).toBeLessThan(3 * 80);

    // 초록 「저장됨」 칩처럼 색 바탕 위의 흰 글자는 이 회차의 범위가 아니다 — 어두운 바탕 위의 글자만 본다
    const bad = (await lowContrast(page, 'body')).filter((x: any) => {
        const [br, bg2, bb] = (x.bg.match(/\d+/g) || []).map(Number);
        return x.ratio < MIN_RATIO && br + bg2 + bb < 3 * 80;
    });
    expect(bad, describe(bad)).toEqual([]);
});

test('F-RV-E03 다크: 사이드바 로고의 「Process GPT」 글자가 밝은 색이다', async ({ page }) => {
    await login(page, 'dark');
    await page.goto(`${BASE}/todolist`);
    const img = page.locator('.v-navigation-drawer .logo img').first();
    await expect(img).toBeVisible({ timeout: 30_000 });
    const src = await img.getAttribute('src');
    const svg = await page.evaluate(async (u) => (await fetch(u!)).text(), src);
    const fill = (svg.match(/\.cls-1\s*\{[^}]*?fill:\s*(#[0-9a-fA-F]{3,6})/) || [])[1];
    expect(fill, '로고 글자 색').toBeTruthy();
    const n = parseInt(fill!.slice(1).padEnd(6, fill!.slice(1)), 16);
    expect(((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255), `로고 글자 색 ${fill}`).toBeGreaterThan(3 * 200);
});

test('F-RV-E04 라이트: 사이드바 · 대화방 글자색은 예전과 같다', async ({ page }) => {
    await login(page, 'light');
    await page.goto(`${BASE}/chat?roomId=${CHAT_ROOM}`);
    const drawer = page.locator('.v-navigation-drawer').first();
    // 지금 연 방이 아닌 대화방 제목(활성 줄은 0.87)
    const title = drawer.locator('.chat-room-item:not(.sidebar-list-hover-bg--active) .chat-room-title').first();
    await expect(title).toBeVisible({ timeout: 30_000 });
    expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe('rgba(0, 0, 0, 0.62)');
    const wrapper = page.locator('.chat-info-view-wrapper').first();
    await expect(wrapper).toBeVisible({ timeout: 30_000 });
    expect(await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await shot(page, 'e04-light');
});
