/**
 * 새 디자인 시스템이 적용된 Process GPT 를 실제 백엔드(Supabase)와 함께 구동해
 * 로그인 → 앱 전반까지 시연하고 영상으로 남긴다.
 *
 * 사용: node playwright/demo/design-system-run.mjs <출력디렉터리>
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const OUT = process.argv[2] || '/tmp/pg-demo';

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
    locale: 'ko-KR'
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const steps = [];
async function step(name, fn) {
    const t0 = Date.now();
    try {
        await fn();
        steps.push({ name, ok: true });
        console.log(`  ✓ ${name} (${Date.now() - t0}ms)`);
    } catch (e) {
        steps.push({ name, ok: false, err: e.message.split('\n')[0] });
        console.log(`  ✗ ${name} — ${e.message.split('\n')[0]}`);
    }
}

console.log('▶ Process GPT — 디자인 시스템 전면 교체 시연\n');

/* ---------- 1부. 디자인 시스템 자체 ---------- */

await step('디자인 시스템 쇼케이스', async () => {
    await page.goto(`${BASE}/design-system`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('.pg-app', { timeout: 20000 });
    await page.waitForTimeout(1500);
    for (const id of ['color', 'type', 'button']) {
        await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ behavior: 'smooth' }), id);
        await page.waitForTimeout(850);
    }
});

await step('폼 · 다이얼로그 · 대화 UI', async () => {
    await page.evaluate(() => document.getElementById('form')?.scrollIntoView({ behavior: 'smooth' }));
    await page.waitForTimeout(900);
    const first = page.locator('.pg-input__el').first();
    await first.click();
    await first.type('구매 승인 프로세스', { delay: 50 });
    await page.locator('.pg-switch').first().click();
    await page.waitForTimeout(700);

    await page.evaluate(() => document.getElementById('data')?.scrollIntoView());
    await page.waitForTimeout(700);
    await page.getByText('다이얼로그 열기').click();
    await page.waitForSelector('.pg-dialog', { timeout: 5000 });
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await page.evaluate(() => document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' }));
    await page.waitForTimeout(1100);
    const composer = page.locator('.pg-composer__input');
    await composer.click();
    await composer.type('이 프로세스의 병목을 찾아줘', { delay: 40 });
    await page.waitForTimeout(900);
});

await step('다크 모드 전환', async () => {
    await page.evaluate(() => document.getElementById('display')?.scrollIntoView());
    await page.waitForTimeout(600);
    await page.locator('[aria-label="테마 전환"]').click();
    await page.waitForTimeout(1500);
    await page.locator('[aria-label="테마 전환"]').click();
    await page.waitForTimeout(900);
});

/* ---------- 2부. 실제 제품 화면 ---------- */

await step('로그인 화면 (신규 디자인 시스템)', async () => {
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('.login__card', { timeout: 30000 });
    await page.waitForTimeout(1200);
});

await step('로그인 → 앱 진입', async () => {
    const inputs = page.locator('.pg-input__el');
    await inputs.nth(0).click();
    await inputs.nth(0).type('demo@localhost', { delay: 50 });
    await inputs.nth(1).click();
    await inputs.nth(1).type('demo1234', { delay: 50 });
    await page.waitForTimeout(400);
    await page.locator('.cp-login').click();
    await page.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 45000 });
    await page.waitForTimeout(5000);
});

await step('프로세스 정의 체계도 둘러보기', async () => {
    await page.waitForTimeout(1500);
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(1400);
    await page.mouse.wheel(0, -350);
    await page.waitForTimeout(1200);
});

await step('프로세스 정의 열기 (BPMN 편집기)', async () => {
    await page.getByText('휴가 신청 프로세스', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForTimeout(6000);
});

await step('할일 목록 화면', async () => {
    await page.goto(`${BASE}/todolist`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(4500);
});

await step('관리자 화면', async () => {
    await page.goto(`${BASE}/admin`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(4500);
});

const finalUrl = page.url();
await page.screenshot({ path: `${OUT}/final.png` });

await context.close();
await browser.close();

console.log('\n--- 결과 ---');
console.log('최종 URL:', finalUrl);
console.log('성공:', steps.filter((s) => s.ok).length + '/' + steps.length);
const rel = errors.filter((e) => !/favicon|clarity|ipinfo|ipapi|ip-api|net::ERR_|Failed to load resource|404/i.test(e));
console.log('앱 레벨 콘솔 에러:', rel.length);
[...new Set(rel)].slice(0, 6).forEach((e) => console.log('  - ' + e.slice(0, 160)));
