import { expect, test, type Page } from '@playwright/test';

/** LIVE — 기존 방을 열어 ① 확장자별 공통 뷰어(HwpxViewer) 디스패치 ② createBpmnXml 파생 .bpmn 확인. */
const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const ROOM = process.env.E2E_ROOM || 'bf8bc433-dab0-46b2-a9fe-a5cca196d3b7';
const SHOT = 'playwright/live-shots';

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('.cp-id input').fill(USER!);
    await page.locator('.cp-pwd input').fill(PASS!);
    const remember = page.getByRole('checkbox').first();
    if ((await remember.count()) > 0 && !(await remember.isChecked())) await remember.check();
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/definition-map|\/chat|\/main/, { timeout: 60_000 });
}

test.describe('LIVE: 확장자별 공통 뷰어 + .bpmn 파생', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + creds 필요');
    test.setTimeout(180_000);

    test('기존 방 열기 → 파일 목록/뷰어/.bpmn', async ({ page }) => {
        page.on('console', (m) => console.log('[browser]', m.type(), m.text().slice(0, 200)));
        await page.setViewportSize({ width: 1920, height: 1080 });
        await login(page);
        await page.goto(`/chat?roomId=${ROOM}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(6_000);
        await expect(page.locator('.ws-files').first()).toBeVisible({ timeout: 30_000 });
        await page.screenshot({ path: `${SHOT}/V1-files.png`, fullPage: true });

        // 파일 목록 항목들
        const items = page.locator('.ws-files__item');
        const n = await items.count();
        const names: string[] = [];
        for (let i = 0; i < n; i++) names.push(((await items.nth(i).innerText()) || '').trim());
        console.log('[files]', JSON.stringify(names));

        // .bpmn 파생 파일이 목록에 있는지
        const bpmnItem = page.locator('.ws-files__item', { hasText: /\.bpmn/ }).first();
        const hasBpmn = (await bpmnItem.count()) > 0;
        console.log('[hasBpmn]', hasBpmn);
        if (hasBpmn) {
            await bpmnItem.click();
            await page.waitForTimeout(3_000);
            await page.screenshot({ path: `${SHOT}/V2-bpmn-view.png`, fullPage: true });
        }
        // .md / .json 파일 클릭해 뷰어 전환 확인
        const mdItem = page.locator('.ws-files__item', { hasText: /SKILL\.md|\.md/ }).first();
        if ((await mdItem.count()) > 0) {
            await mdItem.click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${SHOT}/V3-md-view.png`, fullPage: true });
        }
        expect(n).toBeGreaterThan(0);
    });
});
