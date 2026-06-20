import { expect, test, type Page } from '@playwright/test';

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

test.describe('LIVE: 최신 휴가신청 방 열어 산출물 확인', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + creds 필요');
    test.setTimeout(300_000);

    test('방금 생성한 방을 열면 process 산출물 패널이 보인다', async ({ page }) => {
        await login(page);
        // 좌측 대화목록 최상단(가장 최근) "휴가 신청 프로세스 생성" 방 열기
        const top = page.getByText(/휴가 신청 프로세스 생성/).first();
        await expect(top).toBeVisible({ timeout: 30_000 });
        await top.click();
        await page.waitForTimeout(4_000);

        const processArtifact = page.locator('.process-artifact').first();
        let ok = false;
        for (let i = 0; i < 48; i++) {
            // 최대 ~12분. 매 라운드 HITL(승인→응답제출)을 답해 생성 완료까지 진행.
            if ((await processArtifact.count()) > 0 && (await processArtifact.isVisible())) {
                ok = true;
                break;
            }
            const approve = page.getByRole('button', { name: /^\s*승인\s*$/ }).first();
            const submit = page.getByRole('button', { name: /응답\s*제출/ }).first();
            try {
                if ((await submit.count()) > 0 && (await submit.isVisible())) {
                    if ((await approve.count()) > 0 && (await approve.isVisible())) {
                        await approve.click();
                        await page.waitForTimeout(400);
                    }
                    await submit.click();
                    await page.waitForTimeout(6_000);
                }
            } catch (e) {
                /* ignore */
            }
            // 가벼운 viewport 스크린샷(긴 페이지 fullPage 반복이 렌더러를 불안정하게 만든 정황 회피)
            await page.screenshot({ path: `${SHOT}/T-poll-${String(i).padStart(2, '0')}.png` });
            await page.waitForTimeout(12_000);
        }
        await page.screenshot({ path: `${SHOT}/T-final.png`, fullPage: true });
        expect(ok, '최신 방에 .process-artifact 패널이 표시되어야 함').toBeTruthy();
    });
});
