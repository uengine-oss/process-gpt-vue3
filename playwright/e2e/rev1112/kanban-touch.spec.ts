/**
 * 2026-11-12 오전 5:26 화면 녹화(휴대폰 Chrome, 가로, PC 화면) — 인스턴스 칸반의 카드를 손가락으로 누르면
 * 눌린 빛만 돌고 업무가 열리지 않는다 (F-RV-D01 ~ D04)
 *
 * 휴대폰의 PC 화면은 viewport 를 width=1280 으로 둔다(index.html). 그래서 화면 폭으로 휴대폰을 가리던
 * 칸반(innerWidth <= 768)은 데스크톱으로 보고 카드를 끌어 옮기기(SortableJS)를 켠다 — 손가락 화면에서도.
 *
 * 실행 (VM 설치본 예):
 *   BASE_URL=http://localhost:8088 UX_BASE_URL=http://localhost:8088 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/rev1112
 *
 * 필요한 데이터: 칸반에 「내 업무」 카드가 있는 인스턴스(RV_LOOP_INST). VM 의 「영업 제안서 승인 한빛물산 대전
 * 사무실 가구」 가 기본값이다. 데이터는 읽기만 한다.
 */
import { test, expect, devices, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.UX_BASE_URL || 'http://localhost:8088';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
const LOOP_INST = process.env.RV_LOOP_INST || 'cb456fd9_3c3a_47f7_83d6_dd5aa93e7191.0c540ac2-b39c-abcc-dd32-86f15d7f8e80';
const SHOT_DIR = process.env.SHOT_DIR || '';
const SHOT_TAG = process.env.SHOT_TAG || 'after';

// 녹화한 기기와 같은 꼴: 안드로이드 Chrome, 가로(2316×1080, 배율 2.625 → 882×411), 손가락.
const phone = devices['Galaxy S9+ landscape'];
test.use({
    ...phone,
    viewport: { width: 882, height: 411 },
    // 프로젝트(Desktop Chrome)의 screen 1920×1080 이 남으면 휴대폰으로 보지 않는다(index.html isPhoneBrowser).
    screen: { width: 882, height: 411 },
    deviceScaleFactor: 2.625,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    launchOptions: {
        args: process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [],
        executablePath: process.env.UX_CHROMIUM || undefined
    }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);

async function login(page: Page, who: 'admin' | 'minji' | 'seoyeon') {
    const a = accounts[who];
    // 기존 탭 화면(간소화 끔) · PC 화면으로 들어간다 — 녹화와 같은 화면.
    await page.addInitScript(() => {
        try {
            localStorage.setItem('pg.simpleUi', '0');
        } catch (e) {
            /* 저장소가 막힌 환경 */
        }
    });
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
    await page.screenshot({ path: path.join(SHOT_DIR, `${SHOT_TAG}-${name}.png`) });
}

const instPath = (id: string) => `/instancelist/${id.replace(/\./g, '_DOT_')}`;

/**
 * 손가락 누르기. page.tap() 은 움직임 없이 떼지만 실제 손가락은 누르는 동안 한두 픽셀 흔들린다 —
 * 그 흔들림 한 번이 SortableJS 에는 끌기 시작(fallbackTolerance 0)이고, 끌고 난 뒤의 클릭은 버려진다.
 */
async function fingerTap(page: Page, x: number, y: number, moves: Array<[number, number]>, holdMs = 90) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (const [dx, dy] of moves) {
        await page.waitForTimeout(holdMs / (moves.length + 1));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] });
    }
    await page.waitForTimeout(holdMs / (moves.length + 1));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
}

/** 카드 가운데. 탭을 바꾼 직후에는 화면이 미끄러지며 들어오므로 자리가 멈춘 뒤의 좌표를 쓴다. */
async function centerOf(page: Page, locator: ReturnType<Page['locator']>) {
    let prev = '';
    for (let i = 0; i < 40; i++) {
        const box = (await locator.boundingBox())!;
        const now = `${Math.round(box.x)},${Math.round(box.y)}`;
        if (now === prev) return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 30) };
        prev = now;
        await page.waitForTimeout(100);
    }
    throw new Error('카드 자리가 멈추지 않는다');
}

async function openKanban(page: Page) {
    await page.goto(`${BASE}${instPath(LOOP_INST)}`);
    const tab = page.locator('.v-tab').filter({ hasText: '칸반보드' }).first();
    await tab.waitFor({ timeout: 45_000 });
    await tab.click();
    const board = page.locator('.instance-card-kanban-board');
    await expect(board.getByTestId('kanban-card').first()).toBeVisible({ timeout: 30_000 });
    return board;
}

const JITTERS: Record<string, Array<[number, number]>> = {
    '1~2px': [
        [1, 0],
        [1, 1],
        [2, 1]
    ],
    '4~6px': [
        [2, 1],
        [4, 3],
        [6, 4]
    ]
};

for (const [name, moves] of Object.entries(JITTERS)) {
    test(`F-RV-D01 휴대폰 PC 화면: 칸반 카드를 손가락으로 누르면 그 업무가 열린다(흔들림 ${name})`, async ({ page }) => {
        await login(page, 'admin');
        await openKanban(page);
        const card = page.locator('.instance-card-kanban-board').getByTestId('kanban-card').first();
        const { x, y } = await centerOf(page, card);
        await fingerTap(page, x, y, moves);
        await page.waitForURL(/\/todolist\//, { timeout: 15_000 });
    });
}

test('F-RV-D03 휴대폰 PC 화면: 녹화와 같은 조건(폭 1280 · 손가락)에서 카드가 열린다', async ({ page }) => {
    await login(page, 'admin');
    await openKanban(page);
    // PC 화면이 실제로 켜졌는지(녹화와 같은 조건) — 폭 1280 · 손가락 입력
    const env = await page.evaluate(() => ({
        w: window.innerWidth,
        coarse: window.matchMedia('(pointer: coarse)').matches,
        vp: document.documentElement.getAttribute('data-viewport')
    }));
    expect(env).toEqual({ w: 1280, coarse: true, vp: 'desktop' });
    await shot(page, 'd01-kanban');

    const card = page.locator('.instance-card-kanban-board').getByTestId('kanban-card').first();
    const { x, y } = await centerOf(page, card);
    // 누르는 동안 1~2px 흔들린 손가락
    await fingerTap(page, x, y, [
        [1, 0],
        [1, 1],
        [2, 1]
    ]);
    await page.waitForURL(/\/todolist\//, { timeout: 15_000 });
    await shot(page, 'd01-opened');
});

test('F-RV-D02 휴대폰 PC 화면: 길게 누르면 카드를 끌 수 있고, 끌고 놓은 뒤에는 업무가 열리지 않는다', async ({ page }) => {
    await login(page, 'admin');
    const board = await openKanban(page);
    const counts = () =>
        board
            .getByTestId('kanban-column')
            .evaluateAll((cols) => cols.map((c) => c.querySelectorAll('[data-testid="kanban-card"]').length));
    const before = await counts();
    const card = board.getByTestId('kanban-card').first();
    const { x, y } = await centerOf(page, card);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(450); // 0.3초 넘게 누르고 있다
    // 카드 안에서만 움직였다 제자리로 — 다른 열에 떨어뜨리지 않으므로 데이터는 그대로다
    for (const dx of [6, 14, 24, 30]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y }] });
        await page.waitForTimeout(40);
    }
    await expect(page.locator('.ghost-card')).toHaveCount(1); // 끌고 있다
    for (const dx of [20, 10, 0]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y }] });
        await page.waitForTimeout(40);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await page.waitForTimeout(800);

    expect(page.url()).toContain('/instancelist/');
    expect(await counts()).toEqual(before);
    await expect(page.locator('.ghost-card')).toHaveCount(0);
});

test.describe('PC 마우스', () => {
    test.use({ viewport: { width: 1440, height: 900 }, screen: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

    test('F-RV-D04 PC: 마우스로 카드를 누르면 바로 업무가 열린다(끌기 지연 없음)', async ({ page }) => {
        await login(page, 'admin');
        await openKanban(page);
        const card = page.locator('.instance-card-kanban-board').getByTestId('kanban-card').first();
        await centerOf(page, card);
        await card.click();
        await page.waitForURL(/\/todolist\//, { timeout: 15_000 });
    });
});
