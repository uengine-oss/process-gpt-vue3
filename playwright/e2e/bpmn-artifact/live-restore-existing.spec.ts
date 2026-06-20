import { expect, test, type Page } from '@playwright/test';

/**
 * LIVE — 기존(영속된) "휴가 신청 프로세스" 대화방 재진입 시 ArtifactPanel 복원 검증.
 * 이번에 고친 checkExistingArtifactPanels 의 process 복원 분기를 실데이터로 확인한다.
 */
const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const SHOT = 'playwright/test-results/live';

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
    await page.locator('.cp-id input').fill(USER!);
    await page.locator('.cp-pwd input').fill(PASS!);
    const remember = page.getByRole('checkbox').first();
    if ((await remember.count()) > 0 && !(await remember.isChecked())) await remember.check();
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/definition-map|\/chat|\/main/, { timeout: 60_000 });
}

test.describe('LIVE: 기존 휴가신청 프로세스 방 재진입 → 산출물 패널 복원', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + creds 필요');
    test.setTimeout(180_000);

    test('대화목록의 휴가신청 프로세스 방을 열면 우측 process 패널이 복원된다', async ({ page }) => {
        page.on('console', (m) => console.log('[browser]', m.type(), m.text().slice(0, 200)));
        await login(page);

        // 좌측 대화목록에서 생성에 성공한 방("...생성했어요" 프리뷰)을 연다.
        // (최신 방은 Agent 500 으로 실패해 산출물이 없을 수 있어 성공 방을 고른다.)
        const convItem = page.getByText(/생성했어요|생성했습니다/).first();
        await expect(convItem).toBeVisible({ timeout: 30_000 });
        await convItem.click();

        // 채팅방 로드 대기
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(4_000);
        await page.screenshot({ path: `${SHOT}/R1-room-opened.png`, fullPage: true });

        // 우측 ArtifactPanel 의 process 산출물 복원 확인
        const processArtifact = page.locator('.process-artifact').first();
        await expect(processArtifact).toBeVisible({ timeout: 30_000 });
        await page.screenshot({ path: `${SHOT}/R2-artifact-restored.png`, fullPage: true });

        // 새로고침 후에도 복원 유지
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4_000);
        await expect(page.locator('.process-artifact').first()).toBeVisible({ timeout: 30_000 });
        await page.screenshot({ path: `${SHOT}/R3-after-reload.png`, fullPage: true });
    });
});
