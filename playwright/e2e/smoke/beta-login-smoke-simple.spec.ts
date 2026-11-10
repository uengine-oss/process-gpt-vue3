import { expect, test } from '@playwright/test';

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for smoke test`);
    }
    return value;
}

test.describe('smoke simple: login only', () => {
    test('login -> home (definition map) visible', async ({ page }) => {
        const email = requiredEnv('E2E_USER');
        const password = requiredEnv('E2E_PASS');

        await page.context().clearCookies();
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        if (!/\/auth\/login/.test(page.url())) {
            const betaCta = page
                .locator('a,button,[role="button"]')
                .filter({ hasText: /베타\s*테스트하기|beta\s*test|start/i })
                .first();
            await expect(betaCta).toBeVisible({ timeout: 30_000 });
            await betaCta.click();
        }

        if (!/\/auth\/login/.test(page.url())) {
            await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
        }
        await expect(page).toHaveURL(/\/auth\/login/);

        await page.locator('.cp-id input').fill(email);
        await page.locator('.cp-pwd input').fill(password);

        const rememberCheckbox = page.getByRole('checkbox').first();
        if (!(await rememberCheckbox.isChecked())) {
            await rememberCheckbox.check();
        }

        await page.locator('.cp-login').click();
        // 첫 화면은 정의 체계도(/definition-map, 2026-11-09 #240). PAL 등 예전 첫 화면(/process-architecture)도 받는다.
        await expect(page).toHaveURL(/\/(definition-map|process-architecture)/, { timeout: 60_000 });

        // 로그인 후 시작 화면 메인 영역이 렌더링되는지 최소 확인
        await expect(page.getByText(/프로세스 정의 체계도|정의체계도|Process/i).first()).toBeVisible({ timeout: 30_000 });
    });
});
