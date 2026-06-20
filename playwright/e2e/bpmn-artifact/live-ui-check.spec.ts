import { expect, test, type Page } from '@playwright/test';

/** LIVE UI 확인 — 기존 deepagent 방을 열어 레이아웃(우측=todos+파일, 활동=채팅 인라인) 스크린샷만. */
const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
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

test.describe('LIVE UI: Claude Desktop식 레이아웃 확인', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + creds 필요');
    test.setTimeout(180_000);

    test('기존 방 열기 → 레이아웃 스크린샷', async ({ page }) => {
        await login(page);
        // 좌측 대화목록 최상단 "휴가 신청 프로세스 생성" 방 열기
        const top = page.getByText(/휴가 신청 프로세스 생성/).first();
        await expect(top).toBeVisible({ timeout: 30_000 });
        await top.click();
        await page.waitForTimeout(5_000);
        await page.screenshot({ path: `${SHOT}/UI-1-room.png`, fullPage: true });
        // 채팅 인라인 '도구 N개 사용' 접힘 펼치기(있으면)
        const toolToggle = page.locator('.chat-tool-activity__summary').first();
        if ((await toolToggle.count()) > 0) {
            await toolToggle.click();
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${SHOT}/UI-2-tools-expanded.png`, fullPage: true });
        }
    });
});
