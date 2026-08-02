/**
 * 새 디자인 시스템이 적용된 Process GPT 를 실제 백엔드(Supabase)와 함께 구동해
 * 로그인 → 앱 진입까지 시연하고 영상으로 남긴다.
 *
 * 사용: node run-demo.mjs <출력디렉터리>
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
        steps.push({ name, ok: true, ms: Date.now() - t0 });
        console.log(`  ✓ ${name} (${Date.now() - t0}ms)`);
    } catch (e) {
        steps.push({ name, ok: false, ms: Date.now() - t0, err: e.message.split('\n')[0] });
        console.log(`  ✗ ${name} — ${e.message.split('\n')[0]}`);
    }
}

console.log('▶ Process GPT — 새 디자인 시스템 구동 시연\n');

// 1) 디자인 시스템 쇼케이스
await step('디자인 시스템 쇼케이스 로드', async () => {
    await page.goto(`${BASE}/design-system`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('.pg-app', { timeout: 20000 });
    await page.waitForTimeout(1600);
});

await step('섹션 순회 (색 → 타이포 → 버튼 → 폼)', async () => {
    for (const id of ['color', 'type', 'button', 'form']) {
        await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ behavior: 'smooth' }), id);
        await page.waitForTimeout(900);
    }
});

await step('폼 상호작용 (입력 · 검증 · 토글)', async () => {
    const name = page.locator('.pg-input__el').first();
    await name.click();
    await name.type('구매 승인 프로세스', { delay: 55 });
    await page.waitForTimeout(500);
    await page.locator('.pg-switch').first().click();
    await page.waitForTimeout(400);
    await page.locator('.pg-check').first().click();
    await page.waitForTimeout(700);
});

await step('다이얼로그 열기/닫기', async () => {
    await page.evaluate(() => document.getElementById('data')?.scrollIntoView());
    await page.waitForTimeout(800);
    await page.getByText('다이얼로그 열기').click();
    await page.waitForSelector('.pg-dialog', { timeout: 5000 });
    await page.waitForTimeout(1300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
});

await step('대화 UI 확인', async () => {
    await page.evaluate(() => document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' }));
    await page.waitForTimeout(1200);
    const composer = page.locator('.pg-composer__input');
    await composer.click();
    await composer.type('이 프로세스의 병목을 찾아줘', { delay: 45 });
    await page.waitForTimeout(1100);
});

await step('다크 모드 전환', async () => {
    await page.evaluate(() => document.getElementById('display')?.scrollIntoView());
    await page.waitForTimeout(600);
    await page.locator('[aria-label="테마 전환"]').click();
    await page.waitForTimeout(1600);
    await page.locator('[aria-label="테마 전환"]').click();
    await page.waitForTimeout(1000);
});

// 2) 실제 로그인 — Supabase 백엔드 연동
await step('로그인 화면 진입', async () => {
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('.login__card', { timeout: 30000 });
    await page.waitForTimeout(1200);
});

await step('자격증명 입력', async () => {
    const inputs = page.locator('.pg-input__el');
    await inputs.nth(0).click();
    await inputs.nth(0).fill('');
    await inputs.nth(0).type('demo@localhost', { delay: 55 });
    await page.waitForTimeout(300);
    await inputs.nth(1).click();
    await inputs.nth(1).type('demo1234', { delay: 55 });
    await page.waitForTimeout(500);
    // 비밀번호 표시 토글
    await page.locator('.login-form__reveal').click();
    await page.waitForTimeout(900);
    await page.locator('.login-form__reveal').click();
    await page.waitForTimeout(500);
});

await step('로그인 실행 → 앱 진입', async () => {
    await page.locator('.cp-login').click();
    await page.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 45000 });
    await page.waitForTimeout(4000);
});

await step('앱 화면 탐색', async () => {
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(1500);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(1500);
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
rel.slice(0, 6).forEach((e) => console.log('  - ' + e.slice(0, 180)));
